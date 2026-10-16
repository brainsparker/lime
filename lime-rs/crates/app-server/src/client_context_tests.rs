use crate::{
    ActionRespondRequest, AppServer, CancelExecutionRequest, ExecutionBackend, ExecutionRequest,
    ProjectionStore, RuntimeCore, RuntimeCoreError, RuntimeEvent, RuntimeEventSink,
    RuntimeHostContext,
};
use app_server_protocol::{
    error_codes, JsonRpcMessage, JsonRpcNotification, JsonRpcRequest, RequestId,
    METHOD_CANCEL_REQUEST, METHOD_CAPABILITY_LIST, METHOD_INITIALIZE, METHOD_INITIALIZED,
    METHOD_THREAD_START, METHOD_TURN_START,
};
use app_server_transport::ConnectionId;
use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;

async fn initialize(server: &AppServer, connection: ConnectionId, name: &str) {
    let messages = server
        .handle_transport_message(
            connection,
            JsonRpcMessage::Request(JsonRpcRequest::new(
                RequestId::Integer(1),
                METHOD_INITIALIZE,
                Some(json!({ "clientInfo": { "name": name, "version": "1.0" } })),
            )),
        )
        .await
        .expect("initialize connection");
    assert_response(&messages, &RequestId::Integer(1));
    server
        .handle_transport_message(
            connection,
            JsonRpcMessage::Notification(JsonRpcNotification::new(METHOD_INITIALIZED, None)),
        )
        .await
        .expect("complete connection initialization");
}

async fn cancel(server: &AppServer, connection: ConnectionId, request_id: &RequestId) {
    server
        .handle_transport_message(
            connection,
            JsonRpcMessage::Notification(JsonRpcNotification::new(
                METHOD_CANCEL_REQUEST,
                Some(json!({ "id": request_id })),
            )),
        )
        .await
        .expect("cancel request");
}

async fn capabilities(
    server: &AppServer,
    connection: ConnectionId,
    request_id: &RequestId,
) -> Vec<JsonRpcMessage> {
    server
        .handle_transport_message(
            connection,
            JsonRpcMessage::Request(JsonRpcRequest::new(
                request_id.clone(),
                METHOD_CAPABILITY_LIST,
                Some(json!({})),
            )),
        )
        .await
        .expect("list capabilities")
}

fn assert_response(messages: &[JsonRpcMessage], id: &RequestId) {
    assert!(
        messages.iter().any(
            |message| matches!(message, JsonRpcMessage::Response(response) if &response.id == id)
        ),
        "expected successful response for {id:?}, got {messages:?}"
    );
}

fn assert_error(messages: &[JsonRpcMessage], id: &RequestId, code: i64) {
    let [JsonRpcMessage::Error(error)] = messages else {
        panic!("expected error {code} for {id:?}, got {messages:?}");
    };
    assert_eq!(&error.id, id);
    assert_eq!(error.error.code, code);
}

#[tokio::test]
async fn client_context_cancel_does_not_cancel_another_connection_with_the_same_id() {
    for id in [RequestId::Integer(7), RequestId::String("7".to_string())] {
        let server = AppServer::with_runtime(RuntimeCore::default());
        initialize(&server, ConnectionId(1), "gui").await;
        initialize(&server, ConnectionId(2), "tui").await;
        cancel(&server, ConnectionId(1), &id).await;

        assert_response(&capabilities(&server, ConnectionId(2), &id).await, &id);
        assert_error(
            &capabilities(&server, ConnectionId(1), &id).await,
            &id,
            error_codes::REQUEST_CANCELLED,
        );
        assert_response(&capabilities(&server, ConnectionId(1), &id).await, &id);
    }
}

#[tokio::test]
async fn client_context_both_clients_can_cancel_the_same_request_id() {
    let server = AppServer::with_runtime(RuntimeCore::default());
    initialize(&server, ConnectionId(1), "gui").await;
    initialize(&server, ConnectionId(2), "tui").await;
    let id = RequestId::Integer(7);
    cancel(&server, ConnectionId(1), &id).await;
    cancel(&server, ConnectionId(2), &id).await;

    assert_error(
        &capabilities(&server, ConnectionId(1), &id).await,
        &id,
        error_codes::REQUEST_CANCELLED,
    );
    assert_error(
        &capabilities(&server, ConnectionId(2), &id).await,
        &id,
        error_codes::REQUEST_CANCELLED,
    );
    assert_response(&capabilities(&server, ConnectionId(1), &id).await, &id);
    assert_response(&capabilities(&server, ConnectionId(2), &id).await, &id);
}

#[tokio::test]
async fn client_context_transport_initialize_does_not_initialize_another_connection() {
    let server = AppServer::with_runtime(RuntimeCore::default());
    initialize(&server, ConnectionId(1), "gui").await;
    let id = RequestId::Integer(7);

    assert_error(
        &capabilities(&server, ConnectionId(2), &id).await,
        &id,
        error_codes::NOT_INITIALIZED,
    );
    assert_response(&capabilities(&server, ConnectionId(1), &id).await, &id);
}

#[tokio::test]
async fn client_context_transport_does_not_initialize_direct_messages() {
    let server = AppServer::with_runtime(RuntimeCore::default());
    initialize(&server, ConnectionId(1), "gui").await;
    let id = RequestId::Integer(7);
    let messages = server
        .handle_message(JsonRpcMessage::Request(JsonRpcRequest::new(
            id.clone(),
            METHOD_CAPABILITY_LIST,
            Some(json!({})),
        )))
        .await
        .expect("direct message");
    assert_error(&messages, &id, error_codes::NOT_INITIALIZED);
}

#[tokio::test]
async fn client_context_disconnect_drops_initialization_and_pending_cancel() {
    let server = AppServer::with_runtime(RuntimeCore::default());
    let connection = ConnectionId(1);
    initialize(&server, connection, "gui").await;
    let id = RequestId::Integer(7);
    cancel(&server, connection, &id).await;
    server.unregister_transport_writer(connection);

    assert_error(
        &capabilities(&server, connection, &RequestId::Integer(8)).await,
        &RequestId::Integer(8),
        error_codes::NOT_INITIALIZED,
    );
    initialize(&server, connection, "reconnected-tui").await;
    assert_response(&capabilities(&server, connection, &id).await, &id);
}

#[tokio::test]
async fn client_context_rejects_reinitialize_without_changing_the_identity() {
    let server = AppServer::with_runtime(RuntimeCore::default());
    let connection = ConnectionId(1);
    initialize(&server, connection, "gui").await;
    let messages = server
        .handle_transport_message(
            connection,
            JsonRpcMessage::Request(JsonRpcRequest::new(
                RequestId::Integer(2),
                METHOD_INITIALIZE,
                Some(json!({"clientInfo": {"name": "replacement"}})),
            )),
        )
        .await
        .expect("reinitialize response");
    assert_error(
        &messages,
        &RequestId::Integer(2),
        error_codes::ALREADY_INITIALIZED,
    );
    assert_eq!(
        server
            .processor
            .connection_host_context(connection)
            .client_name
            .as_deref(),
        Some("gui")
    );
}

#[tokio::test]
async fn client_context_shutdown_clears_connections_without_registered_writers() {
    let server = AppServer::with_runtime(RuntimeCore::default());
    initialize(&server, ConnectionId(1), "gui").await;
    initialize(&server, ConnectionId(2), "tui").await;
    server.clear_transport_writers().await;
    for connection in [ConnectionId(1), ConnectionId(2)] {
        assert_error(
            &capabilities(&server, connection, &RequestId::Integer(7)).await,
            &RequestId::Integer(7),
            error_codes::NOT_INITIALIZED,
        );
    }
}

struct HostBackend(mpsc::UnboundedSender<RuntimeHostContext>);

#[async_trait]
impl ExecutionBackend for HostBackend {
    async fn start_turn(
        &self,
        request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        self.0.send(request.host).expect("record execution host");
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

#[tokio::test]
async fn client_context_turn_execution_uses_the_requesting_clients_identity() {
    let temp = tempfile::tempdir().expect("host context fixture");
    let (hosts_tx, mut hosts_rx) = mpsc::unbounded_channel();
    let runtime = RuntimeCore::with_backend(Arc::new(HostBackend(hosts_tx))).with_projection_store(
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap()),
    );
    let server = AppServer::with_runtime(runtime);
    initialize(&server, ConnectionId(1), "gui").await;
    initialize(&server, ConnectionId(2), "tui").await;
    for (connection, name) in [(ConnectionId(2), "tui"), (ConnectionId(1), "gui")] {
        let messages = server
            .handle_transport_message(
                connection,
                JsonRpcMessage::Request(JsonRpcRequest::new(
                    RequestId::Integer(3),
                    METHOD_THREAD_START,
                    Some(
                        json!({"model": "fixture", "modelProvider": "fixture", "cwd": temp.path()}),
                    ),
                )),
            )
            .await
            .expect("start thread");
        let thread_id = messages
            .iter()
            .find_map(|message| match message {
                JsonRpcMessage::Response(response) => {
                    response.result.pointer("/thread/id").cloned()
                }
                _ => None,
            })
            .expect("canonical thread identity");
        let messages = server
            .handle_transport_message(
                connection,
                JsonRpcMessage::Request(JsonRpcRequest::new(
                    RequestId::Integer(4),
                    METHOD_TURN_START,
                    Some(json!({"threadId": thread_id, "input": [{"type": "text", "text": "record host"}]})),
                )),
            )
            .await
            .expect("start turn");
        assert_response(&messages, &RequestId::Integer(4));
        let host = timeout(Duration::from_secs(5), hosts_rx.recv())
            .await
            .expect("backend admission deadline")
            .expect("execution host");
        assert_eq!(host.client_name.as_deref(), Some(name));
        assert_eq!(host.client_version.as_deref(), Some("1.0"));
    }
}
