use crate::RuntimeEvent;
use lime_agent::{AgentEvent as RuntimeAgentEvent, AgentToolResult};
use serde_json::{json, Value};
use std::borrow::Cow;
use std::collections::HashMap;

mod canonical;
mod command;
mod metadata;
mod patch;
mod policy;
mod turn_diff;

use canonical::*;
use metadata::*;
use policy::*;

use command::{command_facts_from_arguments, command_facts_from_text, CommandFacts};
use patch::{
    patch_changes_from_arguments, patch_id_for_tool_start, patch_paths_from_arguments,
    patch_terminal_events,
};

const COMMAND_OUTPUT_PREVIEW_CHARS: usize = 1_200;

#[derive(Debug, Clone)]
struct TrackedTool {
    name: String,
    arguments: Option<Value>,
    command_facts: Option<CommandFacts>,
    test_run_id: Option<String>,
    patch_id: Option<String>,
    emitted_output: bool,
}

#[derive(Debug, Default)]
pub(super) struct CodingEventMirror {
    tools: HashMap<String, TrackedTool>,
    turn_diff: turn_diff::TurnDiffTracker,
}

#[derive(Debug, Default)]
pub(super) struct CodingMirrorEvents {
    pub(super) before_raw: Vec<RuntimeEvent>,
    pub(super) after_raw: Vec<RuntimeEvent>,
}

impl CodingEventMirror {
    pub(super) fn process_event(&mut self, event: &RuntimeAgentEvent) -> CodingMirrorEvents {
        match event {
            RuntimeAgentEvent::ItemStarted { item } => CodingMirrorEvents {
                after_raw: if let Some(command) = canonical_command_item(item) {
                    self.handle_command_start(item, command)
                } else {
                    canonical_tool_item(item)
                        .map(|tool| {
                            self.handle_tool_start(
                                tool.name,
                                tool.call_id,
                                canonical_arguments_value(tool.arguments).as_ref(),
                            )
                        })
                        .unwrap_or_default()
                },
                ..CodingMirrorEvents::default()
            },
            RuntimeAgentEvent::ToolOutputDelta {
                tool_id,
                delta,
                output_kind,
                metadata,
            } => CodingMirrorEvents {
                after_raw: self.handle_tool_output_delta(
                    tool_id,
                    delta,
                    output_kind.as_deref(),
                    metadata.as_ref(),
                ),
                ..CodingMirrorEvents::default()
            },
            RuntimeAgentEvent::ItemUpdated { item } => {
                if let Some(command) = canonical_command_item(item) {
                    CodingMirrorEvents {
                        after_raw: self.handle_command_update(item, command),
                        ..CodingMirrorEvents::default()
                    }
                } else {
                    CodingMirrorEvents::default()
                }
            }
            RuntimeAgentEvent::ItemCompleted { item } => {
                let mut events = if let Some(command) = canonical_command_item(item) {
                    self.handle_command_completed(item, command)
                } else {
                    canonical_tool_item(item)
                        .and_then(|tool| {
                            tool.output.map(|output| {
                                let result = canonical_agent_tool_result(item, output);
                                self.handle_tool_end(tool.call_id, &result)
                            })
                        })
                        .unwrap_or_default()
                };
                if let Some(interaction) = terminal_interaction_event(item) {
                    events.before_raw.push(interaction);
                }
                events
            }
            _ => CodingMirrorEvents::default(),
        }
    }

    fn handle_tool_start(
        &mut self,
        tool_name: &str,
        tool_id: &str,
        arguments: Option<&Value>,
    ) -> Vec<RuntimeEvent> {
        let normalized_name = normalize_tool_name(tool_name);
        let arguments_value = arguments.cloned();
        let command_facts = command_facts_from_arguments(arguments_value.as_ref());
        let mut events = Vec::new();
        let patch_id = patch_id_for_tool_start(normalized_name, tool_id, arguments_value.as_ref());
        if let Some(patch_id) = &patch_id {
            events.push(RuntimeEvent::new(
                "patch.started",
                compact_object(json!({
                    "patchId": patch_id,
                    "toolCallId": tool_id,
                    "toolName": normalized_name,
                    "source": "runtime_tool",
                    "changes": patch_changes_from_arguments(arguments_value.as_ref()),
                    "paths": patch_paths_from_arguments(arguments_value.as_ref()),
                })),
            ));
        }
        let (shell_events, test_run_id) = self.shell_start_events(
            tool_id,
            normalized_name,
            arguments_value.as_ref(),
            command_facts.as_ref(),
            "runtime_tool",
        );
        events.extend(shell_events);

        self.tools.insert(
            tool_id.to_string(),
            TrackedTool {
                name: normalized_name.to_string(),
                arguments: arguments_value,
                command_facts,
                test_run_id,
                patch_id,
                emitted_output: false,
            },
        );

        events
    }

    fn shell_start_events(
        &self,
        tool_id: &str,
        tool_name: &str,
        arguments: Option<&Value>,
        command_facts: Option<&CommandFacts>,
        source: &str,
    ) -> (Vec<RuntimeEvent>, Option<String>) {
        if !is_shell_tool(tool_name) {
            return (Vec::new(), None);
        }
        let command = command_facts
            .map(|facts| facts.command.clone())
            .or_else(|| command_from_arguments(arguments))
            .unwrap_or_default();
        let mut events = vec![RuntimeEvent::new(
            "command.started",
            compact_object(json!({
                "commandId": tool_id,
                "toolCallId": tool_id,
                "toolName": tool_name,
                "command": command,
                "canonicalCommand": command_facts.map(|facts| facts.canonical_command.clone()),
                "commandSummary": command_facts.map(|facts| facts.summary.clone()),
                "commandArgv": command_facts.map(|facts| facts.argv.clone()),
                "commandArgvSource": command_facts.map(|facts| facts.source),
                "cwd": cwd_from_value(arguments),
                "source": source,
            })),
        )];

        let test_run_id = if is_likely_test_command(&command) {
            let test_run_id = stable_scope_id("test", tool_id);
            events.push(RuntimeEvent::new(
                "test.started",
                compact_object(json!({
                    "testRunId": test_run_id,
                    "commandId": tool_id,
                    "command": command,
                    "canonicalCommand": command_facts.map(|facts| facts.canonical_command.clone()),
                    "commandSummary": command_facts.map(|facts| facts.summary.clone()),
                    "source": source,
                })),
            ));
            Some(test_run_id)
        } else {
            None
        };
        (events, test_run_id)
    }

    fn handle_tool_output_delta(
        &mut self,
        tool_id: &str,
        delta: &str,
        output_kind: Option<&str>,
        metadata: Option<&HashMap<String, Value>>,
    ) -> Vec<RuntimeEvent> {
        let Some(tool) = self.tools.get_mut(tool_id) else {
            return Vec::new();
        };
        let has_delta = !delta.is_empty();
        let has_process_metadata = metadata_has_process_lifecycle(metadata);
        if !is_shell_tool(&tool.name) || (!has_delta && !has_process_metadata) {
            return Vec::new();
        }

        if has_delta {
            tool.emitted_output = true;
        }
        let output_ref = output_ref_from_metadata(metadata, "command")
            .unwrap_or_else(|| command_output_ref(tool_id));
        let ref_ids = output_ref_ids(metadata, &output_ref);
        let preview = has_delta.then(|| truncate_chars(delta, COMMAND_OUTPUT_PREVIEW_CHARS));
        vec![RuntimeEvent::new(
            "command.output",
            compact_object(json!({
                "commandId": tool_id,
                "toolCallId": tool_id,
                "outputRef": output_ref,
                "refIds": ref_ids,
                "kind": output_kind,
                "delta": has_delta.then(|| delta.to_string()),
                "preview": preview,
                "source": "runtime_tool_stream",
                "metadata": metadata.cloned(),
            })),
        )]
    }

    fn handle_tool_end(&mut self, tool_id: &str, result: &AgentToolResult) -> CodingMirrorEvents {
        let Some(tool) = self.tools.remove(tool_id) else {
            return CodingMirrorEvents::default();
        };
        let mut after_raw = match tool.name.as_str() {
            "Bash" | "PowerShell" | "exec_command" => {
                self.shell_tool_end_events(tool_id, &tool, result)
            }
            "Read" => file_read_tool_end_events(tool_id, &tool, result),
            "Write" | "Edit" | "apply_patch" => file_tool_end_events(tool_id, &tool, result),
            _ => Vec::new(),
        };
        if let Some(event) = self.turn_diff.update_from_result(&tool, result) {
            after_raw.push(event);
        }
        CodingMirrorEvents {
            before_raw: policy_block_events(tool_id, &tool, result),
            after_raw,
        }
    }

    fn shell_tool_end_events(
        &self,
        tool_id: &str,
        tool: &TrackedTool,
        result: &AgentToolResult,
    ) -> Vec<RuntimeEvent> {
        let metadata = result.metadata.as_ref();
        let command_text = metadata
            .and_then(|metadata| metadata_string(metadata, &["command"]))
            .or_else(|| command_from_arguments(tool.arguments.as_ref()));
        let command_facts = command_text
            .as_deref()
            .and_then(command_facts_from_text)
            .or_else(|| tool.command_facts.clone());
        let command =
            command_text.or_else(|| command_facts.as_ref().map(|facts| facts.command.clone()));
        let exit_code = metadata.and_then(|metadata| metadata_i64(metadata, &["exit_code"]));
        let status = command_status(exit_code, result.success, metadata);
        let process_metadata = shell_process_lifecycle_metadata(tool_id, metadata, status);
        let mut events = Vec::new();

        if !tool.emitted_output && !result.output.is_empty() {
            let output_ref = output_ref_from_metadata(metadata, "command")
                .unwrap_or_else(|| command_output_ref(tool_id));
            let ref_ids = output_ref_ids(metadata, &output_ref);
            events.push(RuntimeEvent::new(
                "command.output",
                compact_object(merge_object_fields(
                    json!({
                        "commandId": tool_id,
                        "toolCallId": tool_id,
                        "outputRef": output_ref,
                        "refIds": ref_ids,
                        "delta": result.output,
                        "preview": truncate_chars(&result.output, COMMAND_OUTPUT_PREVIEW_CHARS),
                        "source": "runtime_tool_result",
                        "metadata": process_metadata.clone(),
                    }),
                    &process_metadata,
                )),
            ));
        }

        events.push(RuntimeEvent::new(
            "command.exited",
            compact_object(merge_object_fields(json!({
                "commandId": tool_id,
                "toolCallId": tool_id,
                "command": command,
                "canonicalCommand": command_facts.as_ref().map(|facts| facts.canonical_command.clone()),
                "commandSummary": command_facts.as_ref().map(|facts| facts.summary.clone()),
                "commandArgv": command_facts.as_ref().map(|facts| facts.argv.clone()),
                "commandArgvSource": command_facts.as_ref().map(|facts| facts.source),
                "exitCode": exit_code,
                "status": status,
                "success": result.success,
                "cwd": metadata.and_then(|metadata| metadata_string(metadata, &["cwd"])),
                "shell": metadata.and_then(|metadata| metadata_string(metadata, &["shell"])),
                "source": "runtime_tool",
            }), &process_metadata)),
        ));
        events.extend(patch_terminal_events(tool_id, tool, result));

        if let Some(test_run_id) = &tool.test_run_id {
            events.push(RuntimeEvent::new(
                "test.completed",
                compact_object(json!({
                    "testRunId": test_run_id,
                    "commandId": tool_id,
                    "command": command,
                    "canonicalCommand": command_facts.as_ref().map(|facts| facts.canonical_command.clone()),
                    "commandSummary": command_facts.as_ref().map(|facts| facts.summary.clone()),
                    "result": match status {
                        "passed" => "passed",
                        "canceled" | "cancelled" => "canceled",
                        _ => "failed",
                    },
                    "status": status,
                    "exitCode": exit_code,
                    "source": "runtime_tool",
                })),
            ));
        }

        events
    }
}

pub(super) fn runtime_event_for_persistence(
    event: &RuntimeAgentEvent,
) -> Cow<'_, RuntimeAgentEvent> {
    turn_diff::runtime_event_for_persistence(event)
}

fn file_tool_end_events(
    tool_id: &str,
    tool: &TrackedTool,
    result: &AgentToolResult,
) -> Vec<RuntimeEvent> {
    let mut events = patch_terminal_events(tool_id, tool, result);
    if tool.patch_id.is_some() {
        return events;
    }
    if !result.success {
        return events;
    }

    let Some(path) = file_path_from_result(result, tool.arguments.as_ref()) else {
        return events;
    };
    let artifact_id = result
        .metadata
        .as_ref()
        .and_then(|metadata| metadata_string(metadata, &["artifact_id", "artifactId"]))
        .unwrap_or_else(|| stable_scope_id("artifact:file", &path));
    let metadata = result.metadata.as_ref();
    let artifact_refs = artifact_refs_from_metadata(metadata, &artifact_id);

    events.push(RuntimeEvent::new(
        "file.changed",
        compact_object(json!({
            "path": path,
            "artifactId": artifact_id,
            "artifactRefs": artifact_refs,
            "toolCallId": tool_id,
            "toolName": tool.name,
            "checkpointRef": metadata.and_then(|metadata| metadata_string(metadata, &["checkpointRef", "checkpoint_ref", "checkpointId", "checkpoint_id"])),
            "contentRef": metadata.and_then(|metadata| metadata_string(metadata, &["contentRef", "content_ref"])),
            "diffRef": metadata.and_then(|metadata| metadata_string(metadata, &["diffRef", "diff_ref"])),
            "preview": metadata.and_then(|metadata| metadata_string(metadata, &["preview", "summary", "previewText", "preview_text"])),
            "change": result
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("file_change").cloned()),
            "source": "runtime_tool",
        })),
    ));
    events
}

fn file_read_tool_end_events(
    tool_id: &str,
    tool: &TrackedTool,
    result: &AgentToolResult,
) -> Vec<RuntimeEvent> {
    if !result.success {
        return Vec::new();
    }

    let Some(path) = file_path_from_result(result, tool.arguments.as_ref()) else {
        return Vec::new();
    };
    let metadata = result.metadata.as_ref();
    let output_ref =
        output_ref_from_metadata(metadata, "file").unwrap_or_else(|| file_output_ref(tool_id));
    let ref_ids = output_ref_ids(metadata, &output_ref);

    vec![RuntimeEvent::new(
        "file.read",
        compact_object(json!({
            "path": path,
            "toolCallId": tool_id,
            "toolName": tool.name,
            "outputRef": output_ref,
            "contentRef": metadata.and_then(|metadata| metadata_string(metadata, &["contentRef", "content_ref"])),
            "refIds": ref_ids,
            "startLine": value_number_from_object(tool.arguments.as_ref(), &["start_line", "startLine"]),
            "endLine": value_number_from_object(tool.arguments.as_ref(), &["end_line", "endLine"]),
            "source": "runtime_tool",
            "fileType": result
                .metadata
                .as_ref()
                .and_then(|metadata| metadata_string(metadata, &["file_type", "fileType"])),
        })),
    )]
}

fn normalize_tool_name(tool_name: &str) -> &str {
    match lookup_key(tool_name).as_str() {
        "bashtool" | "shell" | "developershell" | "mcpsystemshell" | "shellcommand"
        | "execcommand" | "localshellcall" => "Bash",
        "powershelltool" => "PowerShell",
        "filewritetool" | "writefiletool" | "createfiletool" | "writefile" | "createfile"
        | "mcpsystemwritefile" => "Write",
        "fileedittool" | "editfile" | "developertexteditor" | "mcpsystemeditfile" => "Edit",
        "filereadtool" | "readfiletool" | "readfile" | "developerread" | "mcpsystemreadfile" => {
            "Read"
        }
        "applypatch" | "applypatchtool" => "apply_patch",
        _ => tool_name.trim(),
    }
}

fn lookup_key(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .map(|character| character.to_ascii_lowercase())
        .collect()
}

fn is_shell_tool(tool_name: &str) -> bool {
    matches!(tool_name, "Bash" | "PowerShell" | "exec_command")
}

fn command_from_arguments(arguments: Option<&Value>) -> Option<String> {
    command_facts_from_arguments(arguments)
        .map(|facts| facts.command)
        .or_else(|| value_string_from_object(arguments?, &["command", "cmd", "script"]))
}

fn cwd_from_value(value: Option<&Value>) -> Option<String> {
    value_string_from_object(value?, &["cwd", "workingDir", "working_dir"])
}

fn file_path_from_result(result: &AgentToolResult, arguments: Option<&Value>) -> Option<String> {
    result
        .metadata
        .as_ref()
        .and_then(|metadata| {
            metadata_string(
                metadata,
                &[
                    "path",
                    "file_path",
                    "filePath",
                    "artifact_path",
                    "artifactPath",
                ],
            )
        })
        .or_else(|| {
            result
                .metadata
                .as_ref()
                .and_then(|metadata| metadata_paths(metadata, "artifact_paths"))
                .and_then(|paths| paths.into_iter().next())
        })
        .or_else(|| value_string_from_object(arguments?, &["path", "filePath", "file_path"]))
}

fn command_status(
    exit_code: Option<i64>,
    success: bool,
    metadata: Option<&HashMap<String, Value>>,
) -> &'static str {
    if metadata_indicates_cancellation(metadata) {
        return "canceled";
    }
    match exit_code {
        Some(0) => "passed",
        Some(_) => "failed",
        None if success => "completed",
        None => "failed",
    }
}

fn metadata_indicates_cancellation(metadata: Option<&HashMap<String, Value>>) -> bool {
    if metadata
        .and_then(|metadata| metadata_string(metadata, &["tool_outcome", "toolOutcome"]))
        .is_some_and(|outcome| outcome.eq_ignore_ascii_case("aborted"))
    {
        return true;
    }
    metadata
        .and_then(|metadata| {
            metadata_string(
                metadata,
                &[
                    "itemStatus",
                    "item_status",
                    "executionProcessStatus",
                    "execution_process_status",
                    "status",
                ],
            )
        })
        .is_some_and(|status| {
            matches!(
                status.to_ascii_lowercase().as_str(),
                "canceled" | "cancelled" | "interrupted" | "terminated"
            )
        })
}

fn is_likely_test_command(command: &str) -> bool {
    let normalized = command.to_ascii_lowercase();
    [
        "npm test",
        "npm run test",
        "pnpm test",
        "pnpm run test",
        "yarn test",
        "cargo test",
        "cargo nextest",
        "vitest",
        "jest",
        "pytest",
        "go test",
        "deno test",
        "bun test",
    ]
    .iter()
    .any(|needle| normalized.contains(needle))
}

fn command_output_ref(tool_id: &str) -> String {
    stable_scope_id("output:command", tool_id)
}

fn file_output_ref(tool_id: &str) -> String {
    stable_scope_id("output:file", tool_id)
}

fn output_ref_from_metadata(
    metadata: Option<&HashMap<String, Value>>,
    fallback_kind: &str,
) -> Option<String> {
    let metadata = metadata?;
    metadata_string(
        metadata,
        &[
            "outputRef",
            "output_ref",
            "contentRef",
            "content_ref",
            "refId",
            "ref_id",
            "outputId",
            "output_id",
        ],
    )
    .or_else(|| {
        metadata_string_array(
            metadata,
            &[
                "refIds",
                "ref_ids",
                "outputRefs",
                "output_refs",
                "contentRefs",
                "content_refs",
            ],
        )
        .into_iter()
        .next()
    })
    .or_else(|| {
        metadata_string(metadata, &["artifact_path", "artifactPath"])
            .map(|path| stable_scope_id(&format!("output:{fallback_kind}"), &path))
    })
}

fn output_ref_ids(
    metadata: Option<&HashMap<String, Value>>,
    output_ref: &str,
) -> Option<Vec<String>> {
    let mut refs = Vec::new();
    if let Some(metadata) = metadata {
        refs.extend(metadata_string_array(
            metadata,
            &[
                "refIds",
                "ref_ids",
                "outputRefs",
                "output_refs",
                "contentRefs",
                "content_refs",
            ],
        ));
        refs.extend(
            [
                "outputRef",
                "output_ref",
                "contentRef",
                "content_ref",
                "refId",
                "ref_id",
                "outputId",
                "output_id",
            ]
            .iter()
            .filter_map(|key| metadata.get(*key))
            .filter_map(value_string),
        );
    }
    refs.push(output_ref.to_string());
    dedupe_non_empty(refs)
}

fn shell_process_lifecycle_metadata(
    tool_id: &str,
    metadata: Option<&HashMap<String, Value>>,
    status: &str,
) -> Value {
    let process_id = metadata
        .and_then(|metadata| metadata_string(metadata, &["processId", "process_id"]))
        .unwrap_or_else(|| format!("process-{tool_id}"));
    let execution_process_status = metadata
        .and_then(|metadata| {
            metadata_string(
                metadata,
                &["executionProcessStatus", "execution_process_status"],
            )
        })
        .unwrap_or_else(|| command_status_to_process_status(status));
    let execution_surface = metadata
        .and_then(|metadata| metadata_string(metadata, &["executionSurface", "execution_surface"]))
        .unwrap_or_else(|| "embedded".to_string());

    compact_object(json!({
        "processId": process_id,
        "executionProcessStatus": execution_process_status,
        "executionProcessControlStatus": metadata.and_then(|metadata| metadata_string(metadata, &["executionProcessControlStatus", "execution_process_control_status"])),
        "stdinWritable": metadata.and_then(|metadata| metadata_bool(metadata, &["stdinWritable", "stdin_writable"])),
        "executionSurface": execution_surface,
        "outputBytes": metadata.and_then(|metadata| metadata_u64(metadata, &["outputBytes", "output_bytes"])),
        "outputOmittedBytes": metadata.and_then(|metadata| metadata_u64(metadata, &["outputOmittedBytes", "output_omitted_bytes"])),
        "outputTruncated": metadata.and_then(|metadata| metadata_bool(metadata, &["outputTruncated", "output_truncated"])),
        "stdoutBytes": metadata.and_then(|metadata| metadata_u64(metadata, &["stdoutBytes", "stdout_bytes"])),
        "stderrBytes": metadata.and_then(|metadata| metadata_u64(metadata, &["stderrBytes", "stderr_bytes"])),
    }))
}

fn command_status_to_process_status(status: &str) -> String {
    match status {
        "passed" | "completed" => "exited".to_string(),
        "failed" => "failed".to_string(),
        "canceled" | "cancelled" => "terminated".to_string(),
        _ => status.to_string(),
    }
}

fn metadata_has_process_lifecycle(metadata: Option<&HashMap<String, Value>>) -> bool {
    let Some(metadata) = metadata else {
        return false;
    };
    metadata_string(metadata, &["processId", "process_id"]).is_some()
        || metadata_string(
            metadata,
            &["executionProcessStatus", "execution_process_status"],
        )
        .is_some()
        || metadata_string(
            metadata,
            &[
                "executionProcessControlStatus",
                "execution_process_control_status",
            ],
        )
        .is_some()
        || metadata_bool(metadata, &["stdinWritable", "stdin_writable"]).is_some()
        || metadata_string(metadata, &["executionSurface", "execution_surface"]).is_some()
}

fn artifact_refs_from_metadata(
    metadata: Option<&HashMap<String, Value>>,
    artifact_id: &str,
) -> Option<Vec<String>> {
    let mut refs = Vec::new();
    if let Some(metadata) = metadata {
        refs.extend(metadata_string_array(
            metadata,
            &[
                "artifactRefs",
                "artifact_refs",
                "artifactIds",
                "artifact_ids",
                "artifact_ref",
                "artifactRef",
            ],
        ));
        refs.extend(
            ["artifactId", "artifact_id"]
                .iter()
                .filter_map(|key| metadata.get(*key))
                .filter_map(value_string),
        );
    }
    refs.push(artifact_id.to_string());
    dedupe_non_empty(refs)
}

#[cfg(test)]
mod tests;
