mod events;
mod lifecycle;
mod streaming;
mod transport;

use super::*;
use app_server_protocol::ClientCapabilities;
use app_server_protocol::ClientInfo;
use app_server_protocol::InitializeParams;
use app_server_protocol::RequestId;
use app_server_protocol::METHOD_THREAD_LIST;
use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;
use tokio::io::AsyncBufReadExt;
use tokio::io::AsyncWriteExt;
use tokio::io::BufReader;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};

#[derive(Default)]
struct ActiveTurnBackend {
    started: Notify,
    release: Notify,
}

impl ActiveTurnBackend {
    async fn wait_until_started(&self) {
        timeout(Duration::from_secs(2), self.started.notified())
            .await
            .expect("backend turn should start");
    }
}

#[async_trait]
impl ExecutionBackend for ActiveTurnBackend {
    async fn start_turn(
        &self,
        _request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        self.started.notify_one();
        self.release.notified().await;
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

fn server_with_projection_store() -> (tempfile::TempDir, AppServer) {
    let temp = tempfile::tempdir().expect("projection tempdir");
    let store = ProjectionStore::initialize(temp.path().join("projection.sqlite"))
        .expect("projection store");
    let runtime = RuntimeCore::default().with_projection_store(Arc::new(store));
    (temp, AppServer::with_runtime(runtime))
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        METHOD_INITIALIZE,
        serde_json::to_value(InitializeParams {
            client_info: ClientInfo {
                name: "test".to_string(),
                title: None,
                version: None,
            },
            capabilities: ClientCapabilities::default(),
        })
        .expect("params"),
    )
    .await;
    server
        .handle_message(JsonRpcMessage::Notification(JsonRpcNotification::new(
            METHOD_INITIALIZED,
            Some(json!({})),
        )))
        .await
        .expect("initialized");
}

async fn request(
    server: &AppServer,
    id: i64,
    method: &str,
    params: serde_json::Value,
) -> serde_json::Value {
    match server
        .handle_message(JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(id),
            method,
            Some(params),
        )))
        .await
        .expect("handle")
        .remove(0)
    {
        JsonRpcMessage::Response(response) => response.result,
        JsonRpcMessage::Error(error) => panic!("unexpected error: {error:?}"),
        other => panic!("unexpected message: {other:?}"),
    }
}

async fn write_json_message(writer: &mut tokio::io::DuplexStream, message: JsonRpcMessage) {
    let line = encode_message(&message).expect("encode");
    writer.write_all(line.as_bytes()).await.expect("write");
    writer.flush().await.expect("flush");
}

async fn next_json_message(
    lines: &mut tokio::io::Lines<BufReader<tokio::io::DuplexStream>>,
) -> JsonRpcMessage {
    next_json_message_with_timeout(lines, std::time::Duration::from_secs(1)).await
}

async fn next_json_message_with_timeout(
    lines: &mut tokio::io::Lines<BufReader<tokio::io::DuplexStream>>,
    timeout: std::time::Duration,
) -> JsonRpcMessage {
    let line = tokio::time::timeout(timeout, lines.next_line())
        .await
        .expect("output line timeout")
        .expect("read line")
        .expect("output line");
    decode_message(&line).expect("decode")
}

async fn next_json_response_result(
    lines: &mut tokio::io::Lines<BufReader<tokio::io::DuplexStream>>,
    expected_id: RequestId,
) -> serde_json::Value {
    loop {
        match next_json_message_with_timeout(lines, std::time::Duration::from_secs(10)).await {
            JsonRpcMessage::Response(response) if response.id == expected_id => {
                return response.result;
            }
            JsonRpcMessage::Error(error) if error.id == expected_id => {
                panic!("request {expected_id:?} failed: {:?}", error.error);
            }
            _ => {}
        }
    }
}

async fn assert_next_direct_delta_notification(
    lines: &mut tokio::io::Lines<BufReader<tokio::io::DuplexStream>>,
    expected_thread_id: &str,
    expected_turn_id: &str,
    expected_delta: &str,
) {
    for _ in 0..16 {
        let message =
            next_json_message_with_timeout(lines, std::time::Duration::from_secs(10)).await;
        let JsonRpcMessage::Notification(notification) = &message else {
            continue;
        };
        if notification.method != "item/agentMessage/delta" {
            continue;
        }
        let params = notification.params.as_ref().expect("params");
        if params["threadId"] != expected_thread_id || params["turnId"] != expected_turn_id {
            continue;
        }
        assert_eq!(params["delta"], expected_delta);
        return;
    }
    panic!("expected direct delta notification for {expected_turn_id}");
}
fn node_binary() -> Option<String> {
    let candidates = std::env::var("NODE")
        .ok()
        .into_iter()
        .chain(["node".to_string()]);
    for candidate in candidates {
        if std::process::Command::new(&candidate)
            .arg("--version")
            .output()
            .is_ok_and(|output| output.status.success())
        {
            return Some(candidate);
        }
    }
    None
}

fn assert_response_id(message: JsonRpcMessage, expected_id: RequestId) {
    match message {
        JsonRpcMessage::Response(response) => assert_eq!(response.id, expected_id),
        other => panic!("expected response, got {other:?}"),
    }
}
