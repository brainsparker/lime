use super::AgentEvent;
use agent_protocol::{
    CollabAgentOperation, ItemId, ItemStatus, SessionId, ThreadId, ThreadItem, ThreadItemPayload,
    ToolArgument, ToolOutput, TurnId,
};
use serde_json::Value;
use std::collections::HashMap;
use tool_runtime::tool_lifecycle::{CommandStartEvent, ToolLifecycleEvent, ToolLifecyclePhase};
use tool_runtime::tool_result_projection::NormalizedToolOutput;

#[derive(Clone)]
pub(crate) struct ToolItemLifecycleContext {
    pub session_id: SessionId,
    pub thread_id: ThreadId,
    pub sequence: u64,
    pub ordinal: u64,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

pub(crate) fn canonical_command_start_item(
    start: &CommandStartEvent,
    context: ToolItemLifecycleContext,
) -> ThreadItem {
    let payload = ThreadItemPayload::Command {
        command: start.command.clone(),
        cwd: Some(start.cwd.to_string_lossy().into_owned()),
        output: None,
        exit_code: None,
    };
    ThreadItem {
        session_id: context.session_id,
        thread_id: context.thread_id,
        turn_id: TurnId::new(start.turn_id.clone()),
        item_id: ItemId::new(start.call_id.clone()),
        sequence: context.sequence,
        ordinal: context.ordinal,
        created_at_ms: context.created_at_ms,
        updated_at_ms: context.updated_at_ms,
        completed_at_ms: None,
        kind: payload.kind(),
        status: ItemStatus::InProgress,
        payload,
        metadata: command_start_metadata(start),
    }
}

pub(crate) fn apply_command_start(mut event: AgentEvent, start: &CommandStartEvent) -> AgentEvent {
    let item = match &mut event {
        AgentEvent::ItemStarted { item }
        | AgentEvent::ItemUpdated { item }
        | AgentEvent::ItemCompleted { item } => item,
        _ => return event,
    };
    if let ThreadItemPayload::Command { command, cwd, .. } = &mut item.payload {
        *command = start.command.clone();
        *cwd = Some(start.cwd.to_string_lossy().into_owned());
        let metadata = item
            .metadata
            .as_object_mut()
            .expect("canonical item metadata");
        metadata.extend(command_start_metadata(start).as_object().unwrap().clone());
    }
    event
}

fn command_start_metadata(start: &CommandStartEvent) -> Value {
    serde_json::json!({
        "commandArgv": start.argv,
        "commandExecutionSource": "unifiedExecStartup",
        "processId": start.process_id,
        "exec_command_call_id": start.call_id,
        "executionSurface": "unified_exec",
    })
}

pub(crate) fn canonical_tool_item_event(
    event: ToolLifecycleEvent,
    context: ToolItemLifecycleContext,
) -> Option<AgentEvent> {
    let ToolLifecycleEvent {
        turn_id,
        call_id,
        tool_name,
        arguments,
        provider_metadata,
        environments,
        phase,
        output,
    } = event;
    if matches!(phase, ToolLifecyclePhase::Completed) && output.is_none() {
        return None;
    }
    if tool_name == tool_runtime::unified_exec::WRITE_STDIN_TOOL_NAME
        && matches!(phase, ToolLifecyclePhase::Started)
    {
        return None;
    }

    let raw_arguments = arguments.clone();
    let arguments = canonical_tool_arguments(arguments);
    let mut metadata = serde_json::Map::new();
    if provider_metadata
        .as_object()
        .is_some_and(|metadata| !metadata.is_empty())
    {
        metadata.insert("provider_metadata".to_string(), provider_metadata);
    }
    metadata.insert(
        "environments".to_string(),
        Value::Array(
            environments
                .into_iter()
                .map(|environment| {
                    serde_json::json!({
                        "environmentId": environment.environment_id,
                        "cwd": environment.cwd.to_string_lossy(),
                    })
                })
                .collect(),
        ),
    );

    let mut agent_states = HashMap::new();
    let (mut status, output) = match output {
        Some(output) => {
            let NormalizedToolOutput {
                history_token_limit,
                success,
                text,
                structured_content,
                error,
                duration_ms,
                truncation,
                sidecar_reference,
                metadata: output_metadata,
                agent_control_projection_facts: _,
                agent_control_state_facts,
            } = output;
            agent_states.extend(
                agent_control_state_facts
                    .into_iter()
                    .map(|fact| (fact.target_thread_id, fact.state)),
            );
            let aborted = output_metadata
                .get(tool_runtime::tool_result_projection::TOOL_OUTCOME_METADATA_KEY)
                .and_then(Value::as_str)
                == Some(tool_runtime::tool_result_projection::TOOL_OUTCOME_ABORTED);
            metadata.extend(output_metadata);
            // Only the typed host field can supply this reserved history attribute.
            metadata.remove(agent_protocol::truncation::HISTORY_TOKEN_LIMIT_KEY);
            if let Some(limit) = history_token_limit {
                metadata.insert(
                    agent_protocol::truncation::HISTORY_TOKEN_LIMIT_KEY.to_string(),
                    Value::from(limit),
                );
            }
            metadata.insert("success".to_string(), Value::Bool(success));
            metadata.insert("duration_ms".to_string(), Value::from(duration_ms));
            if let Some(truncation) = truncation.as_ref() {
                metadata.insert(
                    "truncation".to_string(),
                    serde_json::to_value(truncation).unwrap_or(Value::Null),
                );
            }
            if let Some(reference) = sidecar_reference.as_ref() {
                metadata.insert(
                    "sidecar_reference".to_string(),
                    serde_json::to_value(reference).unwrap_or(Value::Null),
                );
            }
            (
                if aborted {
                    ItemStatus::Cancelled
                } else if success {
                    ItemStatus::Completed
                } else {
                    ItemStatus::Failed
                },
                Some(ToolOutput {
                    text: Some(text),
                    structured_content,
                    error,
                    duration_ms: Some(duration_ms),
                    truncated: truncation.is_some(),
                    output_ref: sidecar_reference.map(|reference| reference.reference),
                }),
            )
        }
        None => (ItemStatus::InProgress, None),
    };
    let command_call_id = metadata
        .get("exec_command_call_id")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let command_running = metadata.get("session_id").is_some_and(Value::is_number)
        && metadata.get("exit_code").is_none_or(Value::is_null);
    let command_exit_code = metadata
        .get("exit_code")
        .and_then(Value::as_i64)
        .and_then(|value| i32::try_from(value).ok());
    let command_tool = tool_name == tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME
        || tool_name == tool_runtime::unified_exec::WRITE_STDIN_TOOL_NAME;
    if command_tool && !metadata.contains_key("commandArgv") {
        // Preparation may fail before execution facts exist; never guess the shell.
        metadata.insert("commandArgv".to_owned(), serde_json::json!([]));
        metadata.insert(
            "commandExecutionSource".to_owned(),
            serde_json::json!("unifiedExecStartup"),
        );
    }
    if command_running {
        status = ItemStatus::InProgress;
    }
    if tool_name == tool_runtime::agent_control::WAIT_AGENT_TOOL_NAME
        && agent_states.values().any(|state| {
            matches!(
                state.status,
                agent_protocol::CollabAgentStatus::Errored
                    | agent_protocol::CollabAgentStatus::NotFound
            )
        })
    {
        status = ItemStatus::Failed;
    }
    let payload = if command_tool {
        let command = metadata
            .get("command")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or_else(|| {
                raw_arguments
                    .get("cmd")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            })
            .unwrap_or_else(|| "command".to_string());
        let cwd = metadata
            .get("cwd")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or_else(|| {
                raw_arguments
                    .get("workdir")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            });
        let command_output = metadata
            .get("command_output")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .filter(|value| !value.is_empty());
        ThreadItemPayload::Command {
            command,
            cwd,
            output: command_output,
            exit_code: command_exit_code,
        }
    } else if tool_name == tool_runtime::agent_control::WAIT_AGENT_TOOL_NAME {
        ThreadItemPayload::CollabAgentToolCall {
            call_id: call_id.clone(),
            operation: CollabAgentOperation::Wait,
            target_thread_id: None,
            message: None,
            output,
            agent_states,
        }
    } else {
        ThreadItemPayload::Tool {
            call_id: call_id.clone(),
            name: tool_name,
            arguments,
            output,
        }
    };
    let item_id = command_call_id.unwrap_or(call_id);
    let item = ThreadItem {
        session_id: context.session_id,
        thread_id: context.thread_id,
        turn_id: TurnId::new(turn_id),
        item_id: ItemId::new(item_id),
        sequence: context.sequence,
        ordinal: context.ordinal,
        created_at_ms: context.created_at_ms,
        updated_at_ms: context.updated_at_ms,
        completed_at_ms: status.is_terminal().then_some(context.updated_at_ms),
        kind: payload.kind(),
        status,
        payload,
        metadata: Value::Object(metadata),
    };
    Some(match (phase, command_running) {
        (ToolLifecyclePhase::Started, _) => AgentEvent::ItemStarted { item },
        (ToolLifecyclePhase::Completed, true) => AgentEvent::ItemUpdated { item },
        (ToolLifecyclePhase::Completed, false) => AgentEvent::ItemCompleted { item },
    })
}

fn canonical_tool_arguments(arguments: Value) -> Vec<ToolArgument> {
    match arguments {
        Value::Object(arguments) => arguments
            .into_iter()
            .map(|(name, value)| ToolArgument {
                name,
                value: compact_tool_argument(value),
            })
            .collect(),
        Value::Array(arguments) => arguments
            .into_iter()
            .enumerate()
            .map(|(index, value)| ToolArgument {
                name: index.to_string(),
                value: compact_tool_argument(value),
            })
            .collect(),
        Value::Null => Vec::new(),
        value => vec![ToolArgument {
            name: "value".to_string(),
            value: compact_tool_argument(value),
        }],
    }
}

fn compact_tool_argument(value: Value) -> String {
    match value {
        Value::String(value) => value,
        value => value.to_string(),
    }
}
