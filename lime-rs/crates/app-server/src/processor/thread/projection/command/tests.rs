use super::*;
use serde_json::json;

#[test]
fn command_terminal_status_keeps_rejection_separate_from_execution_failure() {
    for (status, metadata, expected) in [
        (
            canonical::ItemStatus::Failed,
            json!({"tool_outcome": "rejected"}),
            v2::CommandExecutionStatus::Declined,
        ),
        (
            canonical::ItemStatus::Failed,
            json!({"reasonCode": "tool_approval_wait_failed"}),
            v2::CommandExecutionStatus::Failed,
        ),
        (
            canonical::ItemStatus::Failed,
            json!({"error": "declined by process", "handler_executed": true}),
            v2::CommandExecutionStatus::Failed,
        ),
        (
            canonical::ItemStatus::Cancelled,
            json!({"tool_outcome": "aborted", "processId": "process-1"}),
            v2::CommandExecutionStatus::Failed,
        ),
        (
            canonical::ItemStatus::Interrupted,
            json!({"processId": "process-1"}),
            v2::CommandExecutionStatus::Failed,
        ),
        (
            canonical::ItemStatus::Cancelled,
            json!({}),
            v2::CommandExecutionStatus::Failed,
        ),
        (
            canonical::ItemStatus::Cancelled,
            json!({"tool_outcome": "aborted", "commandArgv": [], "commandExecutionSource": "unifiedExecStartup"}),
            v2::CommandExecutionStatus::Declined,
        ),
        (
            canonical::ItemStatus::Cancelled,
            json!({"tool_outcome": "aborted", "commandArgv": [], "commandExecutionSource": "unifiedExecStartup", "processId": "process-1"}),
            v2::CommandExecutionStatus::Failed,
        ),
        (
            canonical::ItemStatus::Cancelled,
            json!({"tool_outcome": "aborted", "commandArgv": ["sh", "-c", "read input"], "commandExecutionSource": "unifiedExecStartup"}),
            v2::CommandExecutionStatus::Failed,
        ),
        (
            canonical::ItemStatus::Completed,
            json!({"tool_outcome": "rejected"}),
            v2::CommandExecutionStatus::Completed,
        ),
        (
            canonical::ItemStatus::InProgress,
            json!({"tool_outcome": "rejected"}),
            v2::CommandExecutionStatus::InProgress,
        ),
    ] {
        let payload = canonical::ThreadItemPayload::Command {
            command: "read input".to_owned(),
            cwd: Some("/workspace".to_owned()),
            output: Some("partial output\n".to_owned()),
            exit_code: Some(-1),
        };
        let item = canonical::ThreadItem {
            session_id: canonical::SessionId::new("session-1"),
            thread_id: canonical::ThreadId::new("thread-1"),
            turn_id: canonical::TurnId::new("turn-1"),
            item_id: canonical::ItemId::new("command-1"),
            sequence: 1,
            ordinal: 1,
            created_at_ms: 1,
            updated_at_ms: 2,
            completed_at_ms: status.is_terminal().then_some(2),
            kind: payload.kind(),
            status,
            payload,
            metadata: metadata.clone(),
        };
        let projected = project_item(item).expect("project command");
        let v2::ThreadItem::CommandExecution {
            id,
            command,
            cwd,
            status: actual,
            aggregated_output,
            exit_code,
            process_id,
            ..
        } = projected
        else {
            panic!("canonical Command must retain its owner");
        };
        assert_eq!(
            actual, expected,
            "canonical status={status:?}, metadata={metadata}"
        );
        assert_eq!(id, "item_command-1");
        assert_eq!(command, "read input");
        assert_eq!(cwd, "/workspace");
        assert_eq!(aggregated_output.as_deref(), Some("partial output\n"));
        assert_eq!(exit_code, Some(-1));
        assert_eq!(process_id.as_deref(), metadata["processId"].as_str());
    }
}
