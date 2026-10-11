use super::*;
use agent_protocol::{ItemStatus, ThreadItemPayload};
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;
use tool_runtime::tool_call::ToolCall;
use tool_runtime::tool_lifecycle::CommandStartEvent;
use tool_runtime::tool_result_projection::NormalizedToolOutput;

fn prepared_start() -> CommandStartEvent {
    CommandStartEvent {
        turn_id: "turn-command".to_owned(),
        call_id: "exec-call".to_owned(),
        command: "cat 'guide one.md'".to_owned(),
        argv: vec![
            "sh".to_owned(),
            "-c".to_owned(),
            "cat 'guide one.md'".to_owned(),
        ],
        cwd: PathBuf::from("/actual/work dir"),
        process_id: "process-command".to_owned(),
    }
}

fn call(emitter: Arc<CurrentTurnToolLifecycleEmitter>) -> ToolCall {
    ToolCall::new(
        "turn-command",
        "exec-call",
        "exec_command",
        json!({"cmd": "cat 'guide one.md'", "workdir": "work dir"}),
        Vec::new(),
        emitter,
    )
}

fn assert_invocation(item: &ThreadItem) {
    assert_eq!(item.item_id.as_str(), "item_exec-call");
    assert_eq!(item.turn_id.as_str(), "turn-command");
    assert_eq!(item.metadata["commandArgv"], json!(prepared_start().argv));
    assert_eq!(item.metadata["processId"], "process-command");
    assert_eq!(
        item.metadata["commandExecutionSource"],
        "unifiedExecStartup"
    );
    assert!(matches!(
        &item.payload,
        ThreadItemPayload::Command { command, cwd: Some(cwd), .. }
            if command == "cat 'guide one.md'" && cwd == "/actual/work dir"
    ));
}

#[tokio::test]
async fn execution_starts_once_with_prepared_facts_before_any_output() {
    let (sender, mut events) = tokio::sync::mpsc::unbounded_channel();
    let emitter = Arc::new(CurrentTurnToolLifecycleEmitter::new(
        sender,
        "session-1",
        "thread-1",
    ));
    emitter
        .emit(ToolLifecycleEvent::started(&call(emitter.clone())))
        .await;
    assert!(events.try_recv().is_err(), "preparation is not execution");
    emitter.emit_command_start(prepared_start()).await;
    let CurrentTurnHostEvent::ToolLifecycle(AgentEvent::ItemStarted { item }) =
        events.try_recv().expect("canonical actual execution start")
    else {
        panic!("expected one prepared item start");
    };
    assert_invocation(&item);
    assert_eq!(item.ordinal, 1);
    assert_eq!(item.status, ItemStatus::InProgress);
    assert!(matches!(
        item.payload,
        ThreadItemPayload::Command {
            output: None,
            exit_code: None,
            ..
        }
    ));
    assert!(events.try_recv().is_err());
}

#[tokio::test]
async fn execution_facts_survive_failure_completion_without_result_metadata() {
    let (sender, mut events) = tokio::sync::mpsc::unbounded_channel();
    let emitter = Arc::new(CurrentTurnToolLifecycleEmitter::new(
        sender,
        "session-1",
        "thread-1",
    ));
    emitter.emit_command_start(prepared_start()).await;
    let CurrentTurnHostEvent::ToolLifecycle(AgentEvent::ItemStarted { item }) =
        events.try_recv().expect("actual execution start")
    else {
        panic!("expected canonical item start");
    };
    assert_invocation(&item);
    let failed = NormalizedToolOutput {
        success: false,
        text: "execution was interrupted".to_owned(),
        structured_content: None,
        error: Some("execution was interrupted".to_owned()),
        duration_ms: 1,
        truncation: None,
        sidecar_reference: None,
        metadata: HashMap::new(),
        agent_control_projection_facts: Vec::new(),
        agent_control_state_facts: Vec::new(),
    };
    emitter
        .emit(ToolLifecycleEvent::completed(
            &call(emitter.clone()),
            failed,
        ))
        .await;
    let CurrentTurnHostEvent::ToolLifecycle(AgentEvent::ItemCompleted { item: completed }) =
        events.try_recv().unwrap()
    else {
        panic!("expected one terminal item");
    };
    assert_invocation(&completed);
    assert_eq!(completed.ordinal, item.ordinal);
    assert_eq!(completed.created_at_ms, item.created_at_ms);
    assert_eq!(completed.status, ItemStatus::Failed);
    assert!(events.try_recv().is_err());
}

#[tokio::test]
async fn failure_before_execution_keeps_the_shell_unknown() {
    let (sender, mut events) = tokio::sync::mpsc::unbounded_channel();
    let emitter = Arc::new(CurrentTurnToolLifecycleEmitter::new(
        sender,
        "session-1",
        "thread-1",
    ));
    let call = call(emitter.clone());
    emitter.emit(ToolLifecycleEvent::started(&call)).await;
    assert!(events.try_recv().is_err(), "preparation is not execution");
    let failed = NormalizedToolOutput {
        success: false,
        text: "working directory does not exist".to_owned(),
        structured_content: None,
        error: Some("working directory does not exist".to_owned()),
        duration_ms: 1,
        truncation: None,
        sidecar_reference: None,
        metadata: HashMap::new(),
        agent_control_projection_facts: Vec::new(),
        agent_control_state_facts: Vec::new(),
    };
    emitter
        .emit(ToolLifecycleEvent::completed(&call, failed))
        .await;
    let CurrentTurnHostEvent::ToolLifecycle(AgentEvent::ItemStarted { item: pending }) =
        events.try_recv().unwrap()
    else {
        panic!("failed invocation lifecycle start");
    };
    assert_eq!(pending.metadata["commandArgv"], json!([]));
    assert!(pending.metadata.get("processId").is_none());
    let CurrentTurnHostEvent::ToolLifecycle(AgentEvent::ItemCompleted { item }) =
        events.try_recv().unwrap()
    else {
        panic!("preparation failure completion");
    };
    assert_eq!(item.metadata["commandArgv"], json!([]));
    assert_eq!(
        item.metadata["commandExecutionSource"],
        "unifiedExecStartup"
    );
    assert!(item.metadata.get("processId").is_none());
    assert_eq!(item.status, ItemStatus::Failed);
    assert_eq!(item.ordinal, pending.ordinal);
    assert_eq!(item.created_at_ms, pending.created_at_ms);
    assert!(item.sequence > pending.sequence);
    assert!(events.try_recv().is_err());
}
