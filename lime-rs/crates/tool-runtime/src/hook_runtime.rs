//! Command Hook execution and lifecycle reporting.

pub use crate::hook_discovery::DiscoveredHook;
use crate::hook_lifecycle::{
    RuntimeHookEventContext, RuntimeHookHandlerReport, RuntimeHookReportFuture, RuntimeHookReporter,
};
use crate::turn_snapshot::{RuntimeHookEventName, RuntimeHookExecutionMode, RuntimeHookSnapshot};
use agent_protocol::hook::{HookOutputEntry, HookOutputEntryKind, HookRunStatus, HookRunSummary};
use serde::Deserialize;
use std::collections::HashMap;
use std::future::Future;
use std::path::Path;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::process::Command;

mod interrupt;
mod stop;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookLifecyclePhase {
    Started,
    Completed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookLifecycleEvent {
    pub phase: HookLifecyclePhase,
    pub turn_id: Option<String>,
    pub run: HookRunSummary,
}

pub trait HookLifecycleEmitter: Send + Sync {
    fn emit(&self, event: HookLifecycleEvent);
}

pub trait AsyncHookResultSink: Send + Sync {
    fn submit(&self, run: HookRunSummary);
}

/// Thread-scoped MCP owner used by MCP hooks. The hook runtime only owns
/// lifecycle and output parsing; the AgentRuntimeState remains the MCP owner.
pub struct McpHookOutput {
    pub stdout: String,
    pub is_error: bool,
}

pub trait McpHookExecutor: Send + Sync {
    fn execute<'a>(
        &'a self,
        server: &'a str,
        tool: &'a str,
        input: serde_json::Value,
    ) -> Pin<Box<dyn Future<Output = Result<McpHookOutput, String>> + Send + 'a>>;
}

pub struct CommandHookReporter {
    hooks_by_key: HashMap<String, DiscoveredHook>,
    emitter: Arc<dyn HookLifecycleEmitter>,
    async_result_sink: Option<Arc<dyn AsyncHookResultSink>>,
    mcp_executor: Option<Arc<dyn McpHookExecutor>>,
}

impl CommandHookReporter {
    pub fn new(
        hooks: impl IntoIterator<Item = DiscoveredHook>,
        emitter: Arc<dyn HookLifecycleEmitter>,
    ) -> Self {
        Self {
            hooks_by_key: hooks
                .into_iter()
                .filter(|hook| hook.is_executable())
                .map(|hook| (hook.snapshot.key.clone(), hook))
                .collect(),
            emitter,
            async_result_sink: None,
            mcp_executor: None,
        }
    }

    pub fn with_async_result_sink(mut self, sink: Arc<dyn AsyncHookResultSink>) -> Self {
        self.async_result_sink = Some(sink);
        self
    }

    pub fn with_mcp_executor(mut self, executor: Arc<dyn McpHookExecutor>) -> Self {
        self.mcp_executor = Some(executor);
        self
    }
}

impl RuntimeHookReporter for CommandHookReporter {
    fn report<'a>(
        &'a self,
        snapshot: &'a RuntimeHookSnapshot,
        _event_name: RuntimeHookEventName,
        context: &'a RuntimeHookEventContext,
    ) -> RuntimeHookReportFuture<'a> {
        let hook = self.hooks_by_key.get(&snapshot.key).cloned();
        let emitter = Arc::clone(&self.emitter);
        let async_result_sink = self.async_result_sink.clone();
        let mcp_executor = self.mcp_executor.clone();
        let context = context.clone();
        Box::pin(async move {
            let hook = hook?;
            let mut run = running_summary(snapshot, &context);
            emitter.emit(HookLifecycleEvent {
                phase: HookLifecyclePhase::Started,
                turn_id: context.turn_id.clone(),
                run: run.clone(),
            });

            if hook.snapshot.handler_type == agent_protocol::hook::HookHandlerType::McpTool {
                let Some(executor) = mcp_executor else {
                    let report = RuntimeHookHandlerReport::Failed {
                        reason: "MCP hook runtime is unavailable".to_string(),
                    };
                    run.status = status_for_report(&report);
                    run.completed_at = Some(chrono::Utc::now().timestamp());
                    run.duration_ms = Some(0);
                    run.entries = entries_for_report(&report);
                    emitter.emit(HookLifecycleEvent {
                        phase: HookLifecyclePhase::Completed,
                        turn_id: context.turn_id.clone(),
                        run,
                    });
                    return Some(report);
                };
                let server = hook.snapshot.mcp_server.clone().unwrap_or_default();
                let tool = hook.snapshot.mcp_tool.clone().unwrap_or_default();
                let input = match mcp_hook_input(&hook, &context) {
                    Ok(input) => input,
                    Err(error) => {
                        let report = RuntimeHookHandlerReport::Failed { reason: error };
                        run.status = status_for_report(&report);
                        run.completed_at = Some(chrono::Utc::now().timestamp());
                        run.duration_ms = Some(0);
                        run.entries = entries_for_report(&report);
                        emitter.emit(HookLifecycleEvent {
                            phase: HookLifecyclePhase::Completed,
                            turn_id: context.turn_id.clone(),
                            run,
                        });
                        return Some(report);
                    }
                };
                let started = Instant::now();
                let result = tokio::time::timeout(
                    Duration::from_secs(hook.snapshot.timeout_sec),
                    executor.execute(&server, &tool, input),
                )
                .await;
                let report = match result {
                    Ok(Ok(output)) => {
                        command_report(
                            &hook,
                            &HookCommandOutput {
                                success: !output.is_error,
                                exit_code: Some(if output.is_error { 1 } else { 0 }),
                                stdout: output.stdout,
                                stderr: String::new(),
                                timed_out: false,
                            },
                        )
                        .report
                    }
                    Ok(Err(error)) => RuntimeHookHandlerReport::Failed { reason: error },
                    Err(_) => RuntimeHookHandlerReport::Failed {
                        reason: format!("MCP hook timed out after {}s", hook.snapshot.timeout_sec),
                    },
                };
                run.status = status_for_report(&report);
                run.completed_at = Some(chrono::Utc::now().timestamp());
                run.duration_ms = Some(started.elapsed().as_millis().min(i64::MAX as u128) as i64);
                run.entries = entries_for_report(&report);
                emitter.emit(HookLifecycleEvent {
                    phase: HookLifecyclePhase::Completed,
                    turn_id: context.turn_id.clone(),
                    run,
                });
                return Some(report);
            }

            if hook.snapshot.execution_mode == RuntimeHookExecutionMode::Async {
                let turn_id = context.turn_id.clone();
                let emitter = Arc::clone(&emitter);
                tokio::spawn(async move {
                    let started = Instant::now();
                    let output = run_command_hook(&hook, &context).await;
                    let CommandHookReport { report, entries } = command_report(&hook, &output);
                    run.status = status_for_report(&report);
                    run.completed_at = Some(chrono::Utc::now().timestamp());
                    run.duration_ms =
                        Some(started.elapsed().as_millis().min(i64::MAX as u128) as i64);
                    run.entries = entries;
                    emitter.emit(HookLifecycleEvent {
                        phase: HookLifecyclePhase::Completed,
                        turn_id,
                        run: run.clone(),
                    });
                    if let Some(sink) = async_result_sink {
                        sink.submit(run);
                    }
                });
                return Some(RuntimeHookHandlerReport::Allow {
                    additional_context: None,
                });
            }

            let started = Instant::now();
            let output = run_command_hook(&hook, &context).await;
            let CommandHookReport { report, entries } = command_report(&hook, &output);
            let completed_at = chrono::Utc::now().timestamp();
            run.status = status_for_report(&report);
            run.completed_at = Some(completed_at);
            run.duration_ms = Some(started.elapsed().as_millis().min(i64::MAX as u128) as i64);
            run.entries = entries;
            emitter.emit(HookLifecycleEvent {
                phase: HookLifecyclePhase::Completed,
                turn_id: context.turn_id.clone(),
                run,
            });
            Some(report)
        })
    }
}

fn running_summary(
    snapshot: &RuntimeHookSnapshot,
    context: &RuntimeHookEventContext,
) -> HookRunSummary {
    HookRunSummary {
        id: context.run_id(snapshot),
        event_name: snapshot.event_name,
        handler_type: snapshot.handler_type,
        execution_mode: snapshot.execution_mode,
        scope: snapshot.scope(),
        source_path: snapshot.source_path.clone(),
        source: snapshot.source,
        display_order: snapshot.display_order,
        status: HookRunStatus::Running,
        status_message: snapshot.status_message.clone(),
        started_at: chrono::Utc::now().timestamp(),
        completed_at: None,
        duration_ms: None,
        entries: Vec::new(),
    }
}

fn status_for_report(report: &RuntimeHookHandlerReport) -> HookRunStatus {
    match report {
        RuntimeHookHandlerReport::Allow { .. } | RuntimeHookHandlerReport::Rewrite { .. } => {
            HookRunStatus::Completed
        }
        RuntimeHookHandlerReport::Block { .. } => HookRunStatus::Blocked,
        RuntimeHookHandlerReport::Abort { .. } => HookRunStatus::Stopped,
        RuntimeHookHandlerReport::Failed { .. } => HookRunStatus::Failed,
    }
}

fn entries_for_report(report: &RuntimeHookHandlerReport) -> Vec<HookOutputEntry> {
    match report {
        RuntimeHookHandlerReport::Allow {
            additional_context: Some(text),
        } => vec![HookOutputEntry {
            kind: HookOutputEntryKind::Context,
            text: text.clone(),
        }],
        RuntimeHookHandlerReport::Block { reason } => vec![HookOutputEntry {
            kind: HookOutputEntryKind::Feedback,
            text: reason.clone(),
        }],
        RuntimeHookHandlerReport::Abort {
            reason: Some(reason),
        } => vec![HookOutputEntry {
            kind: HookOutputEntryKind::Stop,
            text: reason.clone(),
        }],
        RuntimeHookHandlerReport::Failed { reason } => vec![HookOutputEntry {
            kind: HookOutputEntryKind::Error,
            text: reason.clone(),
        }],
        RuntimeHookHandlerReport::Allow {
            additional_context: None,
        }
        | RuntimeHookHandlerReport::Abort { reason: None }
        | RuntimeHookHandlerReport::Rewrite { .. } => Vec::new(),
    }
}

struct CommandHookReport {
    report: RuntimeHookHandlerReport,
    entries: Vec<HookOutputEntry>,
}

fn command_report(hook: &DiscoveredHook, output: &HookCommandOutput) -> CommandHookReport {
    if hook.snapshot.event_name == RuntimeHookEventName::Interrupt {
        return interrupt::parse_output(output);
    }
    if stop::is_stop(hook.snapshot.event_name) {
        return stop::parse_output(hook, output);
    }
    let report = limit_report_context(hook, report_from_output(hook, output));
    let entries = entries_for_report(&report);
    CommandHookReport { report, entries }
}

fn limit_report_context(
    hook: &DiscoveredHook,
    report: RuntimeHookHandlerReport,
) -> RuntimeHookHandlerReport {
    let Some(limit) = hook.snapshot.additional_context_limit else {
        return report;
    };
    match report {
        RuntimeHookHandlerReport::Allow {
            additional_context: Some(context),
        } => RuntimeHookHandlerReport::Allow {
            additional_context: Some(context.chars().take(limit).collect()),
        },
        other => other,
    }
}

fn shell_command_flag(shell: &str) -> &'static str {
    let executable = Path::new(shell)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(shell)
        .to_ascii_lowercase();
    if executable == "cmd" || executable == "cmd.exe" {
        "/C"
    } else if executable.contains("powershell") || executable == "pwsh" || executable == "pwsh.exe"
    {
        "-Command"
    } else {
        "-c"
    }
}

pub fn resolve_command_shell() -> String {
    let shell_from_env = std::env::var("SHELL").ok().and_then(|value| {
        let cleaned = value
            .split('\0')
            .next()
            .unwrap_or_default()
            .trim()
            .to_string();
        (!cleaned.is_empty()).then_some(cleaned)
    });

    #[cfg(target_os = "windows")]
    {
        if let Some(shell) = shell_from_env {
            let path = Path::new(&shell);
            if path.is_absolute() && path.exists() {
                return shell;
            }
        }
        if let Ok(comspec) = std::env::var("COMSPEC") {
            let cleaned = comspec
                .split('\0')
                .next()
                .unwrap_or_default()
                .trim()
                .to_string();
            if !cleaned.is_empty() && Path::new(&cleaned).exists() {
                return cleaned;
            }
        }
        "cmd.exe".to_string()
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(shell) = shell_from_env {
            if Path::new(&shell).exists() {
                return shell;
            }
        }
        if Path::new("/bin/sh").exists() {
            "/bin/sh".to_string()
        } else {
            "sh".to_string()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookCommandOutput {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HookCommandPayload {
    #[serde(rename = "continue")]
    continue_processing: Option<bool>,
    stop_reason: Option<String>,
    decision: Option<String>,
    reason: Option<String>,
    additional_context: Option<String>,
    hook_specific_output: Option<HookSpecificOutput>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HookSpecificOutput {
    hook_event_name: Option<String>,
    permission_decision: Option<String>,
    permission_decision_reason: Option<String>,
    updated_input: Option<serde_json::Value>,
    additional_context: Option<String>,
}

pub async fn run_command_hook(
    hook: &DiscoveredHook,
    context: &RuntimeHookEventContext,
) -> HookCommandOutput {
    let Some(command) = hook.snapshot.command.as_deref() else {
        return failed_output("command hook has no command");
    };
    if context.working_directory.as_os_str().is_empty() {
        return failed_output("command hook has no working directory");
    }
    let shell = resolve_command_shell();
    let shell_flag = shell_command_flag(&shell);
    let context_json = match command_input(hook, context) {
        Ok(input) => input.to_string(),
        Err(error) => return failed_output(error),
    };
    let timeout_started = Instant::now();
    let child = Command::new(&shell)
        .arg(shell_flag)
        .arg(command)
        .envs(&hook.env)
        .current_dir(&context.working_directory)
        .kill_on_drop(true)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();
    let mut child = match child {
        Ok(child) => child,
        Err(error) => return failed_output(format!("hook spawn failed: {error}")),
    };
    let stdin = child.stdin.take();
    let write_stdin = async {
        use tokio::io::AsyncWriteExt;
        if let Some(mut stdin) = stdin {
            if let Err(error) = stdin.write_all(context_json.as_bytes()).await {
                if error.kind() != std::io::ErrorKind::BrokenPipe {
                    return Err(format!("hook stdin write failed: {error}"));
                }
            }
        }
        Ok(())
    };
    let wait_with_output = async {
        child
            .wait_with_output()
            .await
            .map_err(|error| format!("hook wait failed: {error}"))
    };
    // Drain output concurrently and include blocked stdin writes in the same deadline.
    match tokio::time::timeout(
        Duration::from_secs(hook.snapshot.timeout_sec).saturating_sub(timeout_started.elapsed()),
        futures::future::try_join(write_stdin, wait_with_output),
    )
    .await
    {
        Ok(Ok(((), output))) => HookCommandOutput {
            success: output.status.success(),
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            timed_out: false,
        },
        Ok(Err(error)) => failed_output(error),
        Err(_) => HookCommandOutput {
            success: false,
            exit_code: None,
            stdout: String::new(),
            stderr: format!("hook timed out after {}s", hook.snapshot.timeout_sec),
            timed_out: true,
        },
    }
}

fn failed_output(message: impl Into<String>) -> HookCommandOutput {
    HookCommandOutput {
        success: false,
        exit_code: None,
        stdout: String::new(),
        stderr: message.into(),
        timed_out: false,
    }
}

fn command_input(
    hook: &DiscoveredHook,
    context: &RuntimeHookEventContext,
) -> Result<serde_json::Value, String> {
    if hook.snapshot.event_name == RuntimeHookEventName::Interrupt {
        return interrupt::command_input(context);
    }
    if stop::is_stop(hook.snapshot.event_name) {
        return stop::command_input(hook.snapshot.event_name, context);
    }
    if matches!(
        hook.snapshot.event_name,
        RuntimeHookEventName::PreCompact | RuntimeHookEventName::PostCompact
    ) {
        let compact = context
            .compact
            .as_ref()
            .ok_or_else(|| "compaction hook context is missing".to_string())?;
        return Ok(serde_json::json!({
            "session_id": context.session_id,
            "turn_id": context.turn_id,
            "cwd": context.working_directory,
            "hook_event_name": event_config_label(hook.snapshot.event_name),
            "model": compact.model,
            "trigger": compact.trigger,
            "transcript_path": compact.transcript_path,
        }));
    }
    let tool_input = context
        .tool_arguments
        .as_deref()
        .and_then(|arguments| serde_json::from_str(arguments).ok())
        .unwrap_or(serde_json::Value::Null);
    let tool_response = context
        .tool_output
        .as_deref()
        .and_then(|output| serde_json::from_str(output).ok())
        .unwrap_or(serde_json::Value::Null);
    Ok(serde_json::json!({
        "session_id": context.session_id,
        "turn_id": context.turn_id,
        "cwd": context.working_directory,
        "hook_event_name": event_config_label(hook.snapshot.event_name),
        "tool_name": context.tool_name,
        "tool_input": tool_input,
        "tool_response": tool_response,
        "tool_use_id": context.tool_call_id,
    }))
}

fn mcp_hook_input(
    hook: &DiscoveredHook,
    context: &RuntimeHookEventContext,
) -> Result<serde_json::Value, String> {
    let template = hook
        .snapshot
        .mcp_input
        .clone()
        .unwrap_or_else(|| serde_json::json!({}));
    let event = command_input(hook, context)?;
    expand_mcp_value(&template, &event)
}

fn expand_mcp_value(
    value: &serde_json::Value,
    event: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    match value {
        serde_json::Value::Object(map) => map
            .iter()
            .map(|(key, value)| Ok((key.clone(), expand_mcp_value(value, event)?)))
            .collect::<Result<serde_json::Map<_, _>, String>>()
            .map(serde_json::Value::Object),
        serde_json::Value::Array(values) => values
            .iter()
            .map(|value| expand_mcp_value(value, event))
            .collect::<Result<Vec<_>, _>>()
            .map(serde_json::Value::Array),
        serde_json::Value::String(text) => {
            let Some(path) = text
                .strip_prefix("${")
                .and_then(|value| value.strip_suffix('}'))
            else {
                return Ok(value.clone());
            };
            event
                .pointer(&format!("/{}", path.replace('.', "/")))
                .cloned()
                .ok_or_else(|| format!("MCP hook input placeholder `${{{path}}}` was not found"))
        }
        _ => Ok(value.clone()),
    }
}

fn event_config_label(event_name: RuntimeHookEventName) -> &'static str {
    match event_name {
        RuntimeHookEventName::PreToolUse => "PreToolUse",
        RuntimeHookEventName::PermissionRequest => "PermissionRequest",
        RuntimeHookEventName::PostToolUse => "PostToolUse",
        RuntimeHookEventName::PreCompact => "PreCompact",
        RuntimeHookEventName::PostCompact => "PostCompact",
        RuntimeHookEventName::SessionStart => "SessionStart",
        RuntimeHookEventName::SessionEnd => "SessionEnd",
        RuntimeHookEventName::UserPromptSubmit => "UserPromptSubmit",
        RuntimeHookEventName::SubagentStart => "SubagentStart",
        RuntimeHookEventName::SubagentStop => "SubagentStop",
        RuntimeHookEventName::Stop => "Stop",
        RuntimeHookEventName::Interrupt => "Interrupt",
    }
}

pub fn report_from_output(
    hook: &DiscoveredHook,
    output: &HookCommandOutput,
) -> RuntimeHookHandlerReport {
    if stop::is_stop(hook.snapshot.event_name) {
        return stop::parse_output(hook, output).report;
    }
    if output.exit_code == Some(2) {
        let reason = non_empty(Some(output.stderr.clone())).unwrap_or_else(|| {
            format!(
                "{} hook exited with code 2 without feedback",
                event_config_label(hook.snapshot.event_name)
            )
        });
        return RuntimeHookHandlerReport::Block { reason };
    }
    if !output.success {
        return RuntimeHookHandlerReport::Failed {
            reason: failure_reason(output),
        };
    }
    let stdout = output.stdout.trim();
    if stdout.is_empty() {
        return RuntimeHookHandlerReport::Allow {
            additional_context: None,
        };
    }
    let payload = match serde_json::from_str::<HookCommandPayload>(stdout) {
        Ok(payload) => payload,
        Err(error) if stdout.starts_with('{') || stdout.starts_with('[') => {
            return RuntimeHookHandlerReport::Failed {
                reason: format!("hook returned invalid JSON output: {error}"),
            };
        }
        Err(_) => {
            return RuntimeHookHandlerReport::Allow {
                additional_context: None,
            };
        }
    };
    if payload.continue_processing == Some(false) {
        let reason =
            non_empty(payload.stop_reason).unwrap_or_else(|| "hook stopped execution".to_string());
        return RuntimeHookHandlerReport::Abort {
            reason: Some(reason),
        };
    }
    if payload.decision.as_deref() == Some("block") {
        let reason =
            non_empty(payload.reason).unwrap_or_else(|| "hook blocked execution".to_string());
        return RuntimeHookHandlerReport::Block { reason };
    }
    if let Some(specific) = payload.hook_specific_output {
        if specific.hook_event_name.as_deref() != Some(event_config_label(hook.snapshot.event_name))
        {
            return RuntimeHookHandlerReport::Failed {
                reason: "hookSpecificOutput event does not match the invoked hook".to_string(),
            };
        }
        if specific.permission_decision.as_deref() == Some("deny") {
            let reason = non_empty(specific.permission_decision_reason)
                .unwrap_or_else(|| "hook denied execution".to_string());
            return RuntimeHookHandlerReport::Block { reason };
        }
        if let Some(arguments) = specific.updated_input {
            return RuntimeHookHandlerReport::Rewrite {
                arguments: arguments.to_string(),
            };
        }
        return RuntimeHookHandlerReport::Allow {
            additional_context: non_empty(specific.additional_context)
                .or_else(|| non_empty(payload.additional_context)),
        };
    }
    RuntimeHookHandlerReport::Allow {
        additional_context: non_empty(payload.additional_context),
    }
}

fn failure_reason(output: &HookCommandOutput) -> String {
    if output.timed_out {
        return output.stderr.clone();
    }
    let stderr = output.stderr.trim();
    if stderr.is_empty() {
        match output.exit_code {
            Some(exit_code) => format!("hook exited with code {exit_code}"),
            None => "hook exited without a status code".to_string(),
        }
    } else {
        stderr.to_string()
    }
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests;
