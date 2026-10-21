use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use agent_protocol::{
    ImageDetail, ItemId, ItemStatus, SessionId, ThreadId, ThreadItem, ThreadItemPayload,
    ToolArgument, ToolOutput, TurnId,
};
use app_server::{
    ActionRespondRequest, AppServer, CancelExecutionRequest, EventLogWriter, ExecutionBackend,
    ExecutionRequest, ProjectionStore, ProviderTurnHistory, RuntimeCore, RuntimeCoreError,
    RuntimeEvent, RuntimeEventSink, SidecarStore,
};
use app_server_protocol::protocol::v2::{
    METHOD_THREAD_DELETE, METHOD_THREAD_FORK, METHOD_THREAD_GOAL_GET, METHOD_THREAD_GOAL_SET,
    METHOD_THREAD_LIST, METHOD_THREAD_TURNS_LIST,
};
use app_server_protocol::{
    error_codes, METHOD_INITIALIZE, METHOD_INITIALIZED, METHOD_THREAD_READ, METHOD_THREAD_RESUME,
    METHOD_THREAD_START, METHOD_TURN_START,
};
use async_trait::async_trait;
use model_provider::current_client::{
    CurrentProviderContent, CurrentProviderMessage, CurrentProviderRole,
};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tempfile::TempDir;
use tokio::sync::Notify;
use tokio::time::timeout;

#[path = "thread_fork_jsonrpc/nested.rs"]
mod nested;

#[path = "thread_fork_jsonrpc/backend.rs"]
mod backend;
#[path = "thread_fork_jsonrpc/durable.rs"]
mod durable;
#[path = "thread_fork_jsonrpc/ephemeral.rs"]
mod ephemeral;
#[path = "thread_fork_jsonrpc/integrity.rs"]
mod integrity;
#[path = "thread_fork_jsonrpc/portable.rs"]
mod portable;
#[path = "thread_fork_jsonrpc/rollout.rs"]
mod rollout;
#[path = "thread_fork_jsonrpc/settings.rs"]
mod settings;
mod support;
#[path = "thread_fork_jsonrpc/wire.rs"]
mod wire;
use backend::HistoryCaptureBackend;

struct ForkBackend {
    calls: AtomicUsize,
    first_completed: Notify,
    explicit_started: Notify,
    release_explicit: Notify,
}

impl ForkBackend {
    fn new() -> Self {
        Self {
            calls: AtomicUsize::new(0),
            first_completed: Notify::new(),
            explicit_started: Notify::new(),
            release_explicit: Notify::new(),
        }
    }
}

#[async_trait]
impl ExecutionBackend for ForkBackend {
    async fn start_turn(
        &self,
        _request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        let call = self.calls.fetch_add(1, Ordering::SeqCst);
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        match call {
            0 => {
                sink.emit(RuntimeEvent::new("turn.completed", json!({})))?;
                self.first_completed.notify_one();
                Ok(())
            }
            1 => {
                self.explicit_started.notify_one();
                self.release_explicit.notified().await;
                sink.emit(RuntimeEvent::new("turn.completed", json!({})))
            }
            _ => Err(RuntimeCoreError::Backend(format!(
                "unexpected automatic fork continuation call {}",
                call + 1
            ))),
        }
    }

    async fn cancel_turn(
        &self,
        _request: CancelExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        self.release_explicit.notify_one();
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

struct ImmediateBackend;

#[async_trait]
impl ExecutionBackend for ImmediateBackend {
    async fn start_turn(
        &self,
        _request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        sink.emit(RuntimeEvent::new("turn.completed", json!({})))
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

fn assert_canonical_multimodal_input(content: &Value) {
    let parts = content.as_array().expect("canonical input parts");
    assert_eq!(parts.len(), 5);
    assert_eq!(parts[0]["type"], "text");
    assert_eq!(parts[0]["text"], "source user prompt");
    assert_eq!(parts[1]["type"], "image");
    assert_eq!(parts[1]["url"], "https://example.com/remote.png");
    assert_eq!(parts[2]["type"], "image");
    assert!(parts[2]["url"]
        .as_str()
        .is_some_and(|url| url.starts_with("sidecar://media/input-") && url.ends_with(".png")));
    assert!(parts[2].get("path").is_none());
    assert_eq!(parts[3]["type"], "skill");
    assert_eq!(parts[4]["type"], "mention");
}

fn assert_source_provider_history(history: &[CurrentProviderMessage]) {
    assert_eq!(
        history.len(),
        4,
        "unexpected provider history: {history:#?}"
    );
    assert!(matches!(
        &history[0],
        CurrentProviderMessage { producer: None, role: CurrentProviderRole::User, content }
            if matches!(&content[..], [
                CurrentProviderContent::Text(text),
                CurrentProviderContent::Image {
                    uri: remote_uri,
                    detail: Some(ImageDetail::High),
                    ..
                },
                CurrentProviderContent::Image {
                    uri: local_uri,
                    provider_data: Some(local_data),
                    detail: Some(ImageDetail::Original),
                    ..
                },
            ] if text == "source user prompt"
                && remote_uri == "https://example.com/remote.png"
                && local_uri.starts_with("sidecar://media/")
                && local_data.starts_with("data:image/png;base64,"))
    ));
    assert!(matches!(
        &history[1],
        CurrentProviderMessage { producer: None, role: CurrentProviderRole::Assistant, content }
            if matches!(&content[..], [CurrentProviderContent::ToolCall(call)]
                if call.id == "source-tool-call"
                    && call.name == "read_file"
                    && call.arguments == json!({"path": "README.md"}))
    ));
    assert!(matches!(
        &history[2],
        CurrentProviderMessage { producer: None, role: CurrentProviderRole::Tool, content }
            if matches!(&content[..], [CurrentProviderContent::ToolResult(result)]
                if result.call_id == "source-tool-call"
                    && result.name == "read_file"
                    && result.success
                    && result.output == "source tool output")
    ));
    assert!(matches!(
        &history[3],
        CurrentProviderMessage { producer: None, role: CurrentProviderRole::Assistant, content }
            if matches!(&content[..], [CurrentProviderContent::Text(text)] if text == "source assistant answer")
    ));
}

async fn initialize(server: &AppServer, id: u64) {
    request(
        server,
        id,
        METHOD_INITIALIZE,
        json!({
            "clientInfo": {"name": "thread-fork-jsonrpc-test", "version": "1.0.0"}
        }),
    )
    .await;
    let messages = server
        .handle_json_line(
            &json!({"jsonrpc": "2.0", "method": METHOD_INITIALIZED, "params": {}}).to_string(),
        )
        .await
        .expect("initialized notification");
    assert!(messages.is_empty());
}

async fn request(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let messages = server
        .handle_json_line(
            &json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": method,
                "params": params
            })
            .to_string(),
        )
        .await
        .expect("handle JSON-RPC request");
    let response = messages
        .iter()
        .filter_map(|message| serde_json::from_str::<Value>(message).ok())
        .find(|message| message.get("id") == Some(&json!(id)))
        .unwrap_or_else(|| panic!("missing {method} response: {messages:#?}"));
    if let Some(error) = response.get("error") {
        panic!("{method} failed: {error}");
    }
    response
}

async fn request_error(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let messages = server
        .handle_json_line(
            &json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": method,
                "params": params
            })
            .to_string(),
        )
        .await
        .expect("handle JSON-RPC error request");
    let response = messages
        .iter()
        .filter_map(|message| serde_json::from_str::<Value>(message).ok())
        .find(|message| message.get("id") == Some(&json!(id)))
        .unwrap_or_else(|| panic!("missing {method} error response: {messages:#?}"));
    assert!(response.get("error").is_some(), "expected {method} failure");
    response
}

fn required_string(response: &Value, pointer: &str) -> String {
    response
        .pointer(pointer)
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("missing string at {pointer}: {response:#}"))
        .to_string()
}

fn deferral_count(path: &std::path::Path, thread_id: &str) -> i64 {
    Connection::open(path)
        .expect("open thread fork store")
        .query_row(
            "SELECT COUNT(*) FROM thread_goal_continuation_deferrals WHERE thread_id = ?1",
            params![thread_id],
            |row| row.get(0),
        )
        .expect("count thread goal deferrals")
}

fn goal_count(path: &std::path::Path, thread_id: &str) -> i64 {
    Connection::open(path)
        .expect("open thread fork store")
        .query_row(
            "SELECT COUNT(*) FROM thread_goals WHERE thread_id = ?1",
            params![thread_id],
            |row| row.get(0),
        )
        .expect("count thread goals")
}

fn turn_count(response: &Value) -> usize {
    response
        .pointer("/result/thread/turns")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or_else(|| panic!("missing thread turns: {response:#}"))
}

async fn wait_for_completed_turn(server: &AppServer, thread_id: &str) {
    for id in 20..70 {
        let read = request(
            server,
            id,
            METHOD_THREAD_READ,
            json!({"threadId": thread_id, "includeTurns": true}),
        )
        .await;
        if read
            .pointer("/result/thread/turns/0/status")
            .is_some_and(|status| status == "completed")
        {
            return;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("source turn did not reach durable completed state");
}

async fn wait_for_completed_turn_count(server: &AppServer, thread_id: &str, count: usize) {
    let mut last_read = Value::Null;
    for id in 200..260 {
        let read = request(
            server,
            id,
            METHOD_THREAD_READ,
            json!({"threadId": thread_id, "includeTurns": true}),
        )
        .await;
        last_read = read.clone();
        let completed = read
            .pointer("/result/thread/turns")
            .and_then(Value::as_array)
            .map(|turns| {
                turns
                    .iter()
                    .filter(|turn| turn.get("status") == Some(&json!("completed")))
                    .count()
            })
            .unwrap_or_default();
        if completed == count {
            return;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("source thread did not reach {count} durable completed turns: {last_read:#}");
}
