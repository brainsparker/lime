//! Command display facts; never a tool execution or permission decision.

use super::*;
use tool_runtime::parse_command::parse_command;

pub(super) fn project_command_source(metadata: &Value) -> v2::CommandExecutionSource {
    match metadata_string(
        metadata,
        &["commandExecutionSource", "command_execution_source"],
    )
    .as_deref()
    {
        Some("userShell") | Some("user_shell") => v2::CommandExecutionSource::UserShell,
        Some("unifiedExecStartup") | Some("unified_exec_startup") => {
            v2::CommandExecutionSource::UnifiedExecStartup
        }
        Some("unifiedExecInteraction") | Some("unified_exec_interaction") => {
            v2::CommandExecutionSource::UnifiedExecInteraction
        }
        _ => v2::CommandExecutionSource::Agent,
    }
}

pub(super) fn project_terminal_interactions(
    metadata: &Value,
) -> Vec<v2::CommandExecutionTerminalInteraction> {
    metadata
        .get("terminalInteractions")
        .or_else(|| metadata.get("terminal_interactions"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|interaction| {
            let process_id = metadata_string(interaction, &["processId", "process_id"])?;
            let stdin = metadata_string(interaction, &["stdin"])?;
            Some(v2::CommandExecutionTerminalInteraction {
                process_id,
                stdin: bounded_safe_text(&stdin, MAX_DISPLAY_STRING_BYTES).0,
            })
        })
        .take(20)
        .collect()
}

pub(super) fn project_command_status(status: canonical::ItemStatus) -> v2::CommandExecutionStatus {
    match status {
        canonical::ItemStatus::Pending | canonical::ItemStatus::InProgress => {
            v2::CommandExecutionStatus::InProgress
        }
        canonical::ItemStatus::Completed => v2::CommandExecutionStatus::Completed,
        canonical::ItemStatus::Failed => v2::CommandExecutionStatus::Failed,
        canonical::ItemStatus::Interrupted | canonical::ItemStatus::Cancelled => {
            v2::CommandExecutionStatus::Declined
        }
    }
}

pub(super) fn project_command_actions(
    command: &str,
    cwd: Option<&str>,
    metadata: &Value,
) -> Vec<v2::CommandAction> {
    // Prefer durable argv when the producer recorded it. Invalid facts remain opaque.
    let argv = metadata
        .get("commandArgv")
        .or_else(|| metadata.get("command_argv"));
    let parsed = match argv {
        Some(value) => match serde_json::from_value::<Vec<String>>(value.clone()) {
            Ok(argv) if !argv.is_empty() => parse_command(&argv),
            _ => vec![canonical::parse_command::ParsedCommand::Unknown {
                cmd: command.to_owned(),
            }],
        },
        None => parse_command(&["sh".to_owned(), "-c".to_owned(), command.to_owned()]),
    };
    parsed
        .into_iter()
        .map(|action| {
            v2::CommandAction::from_core_with_cwd(
                action,
                std::path::Path::new(cwd.unwrap_or_default()),
            )
        })
        .collect()
}
