use super::*;
use crate::turn_snapshot::{
    RuntimeHookExecutionMode, RuntimeHookHandlerType, RuntimeHookSource, RuntimeHookTrustStatus,
};
use std::path::PathBuf;
use std::sync::Mutex;

fn discovered(command: &str, timeout_sec: u64) -> DiscoveredHook {
    DiscoveredHook {
        snapshot: RuntimeHookSnapshot {
            key: "project:pre_tool_use:0:0".to_string(),
            event_name: RuntimeHookEventName::PreToolUse,
            handler_type: RuntimeHookHandlerType::Command,
            execution_mode: RuntimeHookExecutionMode::Sync,
            matcher: None,
            command: Some(command.to_string()),
            timeout_sec,
            status_message: Some("checking".to_string()),
            additional_context_limit: None,
            source_path: PathBuf::from("/tmp/hooks.json"),
            source: RuntimeHookSource::Project,
            plugin_id: None,
            display_order: 0,
            enabled: true,
            is_managed: false,
            current_hash: "sha256:test".to_string(),
            trust_status: RuntimeHookTrustStatus::Trusted,
        },
        executable: true,
        env: Default::default(),
    }
}

#[tokio::test]
async fn plugin_environment_is_scoped_to_the_hook_process() {
    let command = match shell_command_flag(&resolve_command_shell()) {
        "/C" => "echo %PLUGIN_ROOT%& echo %PLUGIN_DATA%& echo %CLAUDE_PLUGIN_ROOT%& echo %CLAUDE_PLUGIN_DATA%",
        "-Command" => "$env:PLUGIN_ROOT; $env:PLUGIN_DATA; $env:CLAUDE_PLUGIN_ROOT; $env:CLAUDE_PLUGIN_DATA",
        _ => "printf '%s\\n' \"$PLUGIN_ROOT\" \"$PLUGIN_DATA\" \"$CLAUDE_PLUGIN_ROOT\" \"$CLAUDE_PLUGIN_DATA\"",
    };
    let mut hook = discovered(command, 5);
    hook.env = std::collections::BTreeMap::from([
        (
            "PLUGIN_ROOT".to_string(),
            "plugin root with spaces".to_string(),
        ),
        (
            "PLUGIN_DATA".to_string(),
            "plugin data with spaces".to_string(),
        ),
        (
            "CLAUDE_PLUGIN_ROOT".to_string(),
            "plugin root with spaces".to_string(),
        ),
        (
            "CLAUDE_PLUGIN_DATA".to_string(),
            "plugin data with spaces".to_string(),
        ),
    ]);
    let previous = std::env::var_os("PLUGIN_ROOT");
    let output = run_command_hook(&hook, &context()).await;
    assert!(output.success, "{}", output.stderr);
    assert_eq!(
        output.stdout.lines().map(str::trim).collect::<Vec<_>>(),
        [
            "plugin root with spaces",
            "plugin data with spaces",
            "plugin root with spaces",
            "plugin data with spaces"
        ]
    );
    assert_eq!(std::env::var_os("PLUGIN_ROOT"), previous);
}

fn context() -> RuntimeHookEventContext {
    RuntimeHookEventContext {
        session_id: Some("thread-1".to_string()),
        turn_id: Some("turn-1".to_string()),
        tool_call_id: Some("call-1".to_string()),
        working_directory: std::env::temp_dir(),
        tool_name: Some("Bash".to_string()),
        tool_arguments: Some(r#"{"command":"pwd"}"#.to_string()),
        tool_output: None,
        content: None,
        stop: None,
    }
}

fn successful(stdout: &str) -> HookCommandOutput {
    HookCommandOutput {
        success: true,
        exit_code: Some(0),
        stdout: stdout.to_string(),
        stderr: String::new(),
        timed_out: false,
    }
}

#[test]
fn codex_pre_tool_output_can_block_rewrite_or_add_context() {
    let hook = discovered("true", 5);
    assert_eq!(
        report_from_output(
            &hook,
            &successful(
                r#"{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"denied"}}"#,
            ),
        ),
        RuntimeHookHandlerReport::Block {
            reason: "denied".to_string()
        }
    );
    assert_eq!(
        report_from_output(
            &hook,
            &successful(
                r#"{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"echo safe"}}}"#,
            ),
        ),
        RuntimeHookHandlerReport::Rewrite {
            arguments: r#"{"command":"echo safe"}"#.to_string()
        }
    );
    assert_eq!(
        report_from_output(
            &hook,
            &successful(
                r#"{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"reviewed"}}"#,
            ),
        ),
        RuntimeHookHandlerReport::Allow {
            additional_context: Some("reviewed".to_string())
        }
    );
}

#[test]
fn process_failures_fail_closed_and_exit_two_blocks() {
    let hook = discovered("false", 5);
    assert!(matches!(
        report_from_output(
            &hook,
            &HookCommandOutput {
                success: false,
                exit_code: Some(3),
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
            }
        ),
        RuntimeHookHandlerReport::Failed { .. }
    ));
    assert_eq!(
        report_from_output(
            &hook,
            &HookCommandOutput {
                success: false,
                exit_code: Some(2),
                stdout: String::new(),
                stderr: "policy denied".to_string(),
                timed_out: false,
            }
        ),
        RuntimeHookHandlerReport::Block {
            reason: "policy denied".to_string()
        }
    );
}

#[derive(Default)]
struct RecordingEmitter(Mutex<Vec<HookLifecycleEvent>>);

impl HookLifecycleEmitter for RecordingEmitter {
    fn emit(&self, event: HookLifecycleEvent) {
        self.0.lock().expect("events").push(event);
    }
}

#[derive(Default)]
struct RecordingAsyncResultSink(Mutex<Vec<HookRunSummary>>);

impl AsyncHookResultSink for RecordingAsyncResultSink {
    fn submit(&self, run: HookRunSummary) {
        self.0.lock().expect("async hook results").push(run);
    }
}

#[tokio::test]
async fn command_reporter_executes_and_emits_paired_lifecycle() {
    let hook = discovered(
        "printf '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"from hook\"}}'",
        5,
    );
    let emitter = Arc::new(RecordingEmitter::default());
    let reporter = CommandHookReporter::new(vec![hook.clone()], emitter.clone());
    let context = context();

    let report = reporter
        .report(&hook.snapshot, RuntimeHookEventName::PreToolUse, &context)
        .await
        .expect("report");

    assert_eq!(
        report,
        RuntimeHookHandlerReport::Allow {
            additional_context: Some("from hook".to_string())
        }
    );
    let events = emitter.0.lock().expect("events");
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].phase, HookLifecyclePhase::Started);
    assert_eq!(events[1].phase, HookLifecyclePhase::Completed);
    assert_eq!(events[0].run.id, events[1].run.id);
    assert_eq!(events[1].run.status, HookRunStatus::Completed);
    assert_eq!(events[1].run.entries[0].kind, HookOutputEntryKind::Context);
}

#[tokio::test]
async fn timed_out_command_is_failed() {
    let hook = discovered("sleep 5", 1);
    let output = run_command_hook(&hook, &context()).await;
    assert!(output.timed_out);
    assert!(matches!(
        report_from_output(&hook, &output),
        RuntimeHookHandlerReport::Failed { ref reason } if reason.contains("timed out")
    ));
}

#[tokio::test]
async fn async_command_returns_immediately_and_reports_context_out_of_band() {
    let mut hook = discovered(
        "printf '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"async context\"}}'",
        5,
    );
    hook.snapshot.execution_mode = RuntimeHookExecutionMode::Async;
    let emitter = Arc::new(RecordingEmitter::default());
    let sink = Arc::new(RecordingAsyncResultSink::default());
    let reporter = CommandHookReporter::new(vec![hook.clone()], emitter.clone())
        .with_async_result_sink(sink.clone());

    let report = reporter
        .report(&hook.snapshot, RuntimeHookEventName::PreToolUse, &context())
        .await
        .expect("async report admission");
    assert_eq!(
        report,
        RuntimeHookHandlerReport::Allow {
            additional_context: None
        }
    );

    tokio::time::timeout(Duration::from_secs(2), async {
        loop {
            if !sink.0.lock().expect("async hook results").is_empty() {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("async hook result");
    let events = emitter.0.lock().expect("events");
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].phase, HookLifecyclePhase::Started);
    assert_eq!(events[1].phase, HookLifecyclePhase::Completed);
    assert_eq!(
        sink.0.lock().expect("async hook results")[0].entries[0].kind,
        HookOutputEntryKind::Context
    );
}
