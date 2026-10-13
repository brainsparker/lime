use std::sync::Arc;

use agent_protocol::{
    ItemId, ItemStatus, SessionId, ThreadId, ThreadItem, ThreadItemPayload, TurnId,
};
use app_server::{
    ActionRespondRequest, AppServer, CancelExecutionRequest, EventLogWriter, ExecutionBackend,
    ExecutionRequest, ProjectionStore, RuntimeCore, RuntimeCoreError, RuntimeEvent,
    RuntimeEventSink,
};
use app_server_protocol::{
    JsonRpcMessage, METHOD_INITIALIZE, METHOD_INITIALIZED, METHOD_THREAD_READ, METHOD_THREAD_START,
    METHOD_TURN_START,
};
use serde_json::{json, Value};
use tempfile::TempDir;
use tokio::time::{timeout, Duration};
use tool_runtime::tool_executor::{
    RuntimeToolExecutionError, RuntimeToolExecutionFailure, RuntimeToolExecutionOutcome,
    RuntimeToolPolicyErrorKind,
};
use tool_runtime::tool_result_projection::NormalizedToolOutput;

#[derive(Clone, Copy)]
enum Outcome {
    Rejected,
    ApprovalFailed,
    ApprovalCancelled,
    Cancelled,
    Interrupted,
}

struct CommandStatusBackend(Outcome);

#[async_trait::async_trait]
impl ExecutionBackend for CommandStatusBackend {
    async fn start_turn(
        &self,
        request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        let (status, mut metadata, output, exit_code) = match self.0 {
            Outcome::Rejected | Outcome::ApprovalFailed => {
                let kind = match self.0 {
                    Outcome::Rejected => RuntimeToolPolicyErrorKind::PermissionDenied(
                        "tool_approval_declined".to_owned(),
                    ),
                    _ => RuntimeToolPolicyErrorKind::ExecutionFailed(
                        "tool_approval_wait_failed".to_owned(),
                    ),
                };
                let output = NormalizedToolOutput::from_execution_outcome(
                    RuntimeToolExecutionOutcome::Error(RuntimeToolExecutionFailure::from_error(
                        RuntimeToolExecutionError::new("approval result", Some(kind))
                            .before_handler(),
                    )),
                    1,
                );
                (
                    ItemStatus::Failed,
                    serde_json::to_value(output.metadata).unwrap(),
                    output.text,
                    None,
                )
            }
            Outcome::ApprovalCancelled => {
                let output = NormalizedToolOutput::from_execution_outcome(
                    RuntimeToolExecutionOutcome::Aborted,
                    1,
                );
                let mut metadata = serde_json::to_value(output.metadata).unwrap();
                metadata["commandArgv"] = json!([]);
                metadata["commandExecutionSource"] = json!("unifiedExecStartup");
                (ItemStatus::Cancelled, metadata, output.text, None)
            }
            Outcome::Cancelled | Outcome::Interrupted => (
                if matches!(self.0, Outcome::Cancelled) {
                    ItemStatus::Cancelled
                } else {
                    ItemStatus::Interrupted
                },
                json!({"tool_outcome": "aborted", "handler_executed": true, "processId": "process-1"}),
                "partial output\n".to_owned(),
                Some(-1),
            ),
        };
        metadata["executionSurface"] = json!("unified_exec");
        let payload = ThreadItemPayload::Command {
            command: "read input".to_owned(),
            cwd: Some("/workspace".to_owned()),
            output: None,
            exit_code: None,
        };
        let mut item = ThreadItem {
            session_id: SessionId::new(request.session.session_id),
            thread_id: ThreadId::new(request.session.thread_id),
            turn_id: TurnId::new(request.turn.turn_id),
            item_id: ItemId::new("command-1"),
            sequence: 0,
            ordinal: 1,
            created_at_ms: 1,
            updated_at_ms: 1,
            completed_at_ms: None,
            kind: payload.kind(),
            status: ItemStatus::InProgress,
            payload,
            metadata,
        };
        sink.emit(RuntimeEvent::new("item.started", json!({"item": item})))?;
        item.status = status;
        item.updated_at_ms = 2;
        item.completed_at_ms = Some(2);
        if let ThreadItemPayload::Command {
            output: text,
            exit_code: code,
            ..
        } = &mut item.payload
        {
            *text = Some(output);
            *code = exit_code;
        }
        sink.emit(RuntimeEvent::new("item.completed", json!({"item": item})))?;
        sink.emit(RuntimeEvent::new(
            if matches!(
                self.0,
                Outcome::ApprovalCancelled | Outcome::Cancelled | Outcome::Interrupted
            ) {
                "turn.canceled"
            } else {
                "turn.completed"
            },
            json!({}),
        ))
    }

    async fn cancel_turn(
        &self,
        _request: CancelExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
    async fn respond_action(
        &self,
        _request: ActionRespondRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
}

#[tokio::test]
async fn rejected_command_is_declined_in_notifications_and_cold_public_reads() {
    verify(Outcome::Rejected, "declined", "completed").await;
}

#[tokio::test]
async fn approval_wait_failure_is_failed_in_notifications_and_cold_public_reads() {
    verify(Outcome::ApprovalFailed, "failed", "completed").await;
}

#[tokio::test]
async fn cancelled_approval_is_declined_and_turn_remains_interrupted() {
    verify(Outcome::ApprovalCancelled, "declined", "interrupted").await;
}

#[tokio::test]
async fn cancelled_process_is_failed_without_losing_output_or_turn_interruption() {
    verify(Outcome::Cancelled, "failed", "interrupted").await;
}

#[tokio::test]
async fn interrupted_process_is_failed_without_losing_output_or_turn_interruption() {
    verify(Outcome::Interrupted, "failed", "interrupted").await;
}

async fn verify(outcome: Outcome, expected_status: &str, expected_turn_status: &str) {
    let temp = TempDir::new().unwrap();
    let runtime = || {
        RuntimeCore::with_backend(Arc::new(CommandStatusBackend(outcome)))
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
            ))
            .with_event_log_writer(Arc::new(
                EventLogWriter::new(temp.path().join("events")).unwrap(),
            ))
    };
    let server = AppServer::with_runtime(runtime());
    initialize(&server).await;
    let started = request(&server, 2, METHOD_THREAD_START, json!({"model": "fixture-model", "modelProvider": "fixture-provider", "cwd": temp.path(), "historyMode": "paginated"})).await;
    let thread_id = started["thread"]["id"].as_str().unwrap();
    let mut outbound = server.subscribe_outbound_messages();
    let turn = request(
        &server,
        3,
        METHOD_TURN_START,
        json!({"threadId": thread_id, "input": [{"type": "text", "text": "command status"}]}),
    )
    .await;
    let turn_id = turn["turn"]["id"].as_str().unwrap();
    let terminal = timeout(Duration::from_secs(5), async {
        loop {
            if let JsonRpcMessage::Notification(notification) = outbound.recv().await.unwrap() {
                if notification.method == "item/completed" {
                    let params = notification.params.unwrap();
                    if params["item"]["id"] == "item_command-1" {
                        return params;
                    }
                }
            }
        }
    })
    .await
    .expect("canonical Command terminal notification");
    assert_eq!(terminal["threadId"], thread_id);
    assert_eq!(terminal["turnId"], turn_id);
    assert_eq!(terminal["item"]["type"], "commandExecution");
    assert_eq!(terminal["item"]["status"], expected_status);
    let live = timeout(Duration::from_secs(5), async {
        loop {
            let read = request(
                &server,
                4,
                METHOD_THREAD_READ,
                json!({"threadId": thread_id, "includeTurns": true}),
            )
            .await;
            if read["thread"]["turns"][0]["status"] == expected_turn_status {
                return read;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("terminal public read");
    let command = |read: &Value| {
        read["thread"]["turns"][0]["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["id"] == "item_command-1")
            .unwrap()
            .clone()
    };
    assert_eq!(command(&live), terminal["item"]);
    assert_eq!(terminal["item"]["command"], "read input");
    match outcome {
        Outcome::Cancelled | Outcome::Interrupted => {
            assert_eq!(terminal["item"]["processId"], "process-1");
            assert_eq!(terminal["item"]["aggregatedOutput"], "partial output\n");
            assert_eq!(terminal["item"]["exitCode"], -1);
        }
        _ => {
            assert!(terminal["item"]["processId"].is_null());
            assert!(terminal["item"]["exitCode"].is_null());
        }
    }
    drop(server);
    let restored = AppServer::with_runtime(runtime());
    initialize(&restored).await;
    let cold = request(
        &restored,
        5,
        METHOD_THREAD_READ,
        json!({"threadId": thread_id, "includeTurns": true}),
    )
    .await;
    assert_eq!(cold["thread"]["turns"][0]["status"], expected_turn_status);
    assert_eq!(cold["thread"]["turns"][0]["id"], turn_id);
    assert_eq!(command(&cold), terminal["item"]);
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        METHOD_INITIALIZE,
        json!({"clientInfo": {"name": "command-status-test", "version": "1"}}),
    )
    .await;
    server
        .handle_json_line(
            &json!({"jsonrpc": "2.0", "method": METHOD_INITIALIZED, "params": {}}).to_string(),
        )
        .await
        .unwrap();
}

async fn request(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let lines = server
        .handle_json_line(
            &json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params}).to_string(),
        )
        .await
        .unwrap();
    let response = lines
        .iter()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .find(|value| value["id"] == id)
        .unwrap();
    assert!(
        response.get("error").is_none(),
        "{method} failed: {response}"
    );
    response["result"].clone()
}
