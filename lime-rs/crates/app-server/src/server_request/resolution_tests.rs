use super::*;
use crate::thread_state::ThreadListenerCommand;
use agent_protocol::ThreadId;
use app_server_protocol::{JsonRpcNotification, JsonRpcResponse};
use serde_json::json;
use std::time::Duration;
use tokio::sync::mpsc;

async fn connect(server: &AppServer) -> mpsc::Receiver<crate::QueuedOutgoingMessage> {
    let (writer, receiver) = mpsc::channel(32);
    server
        .transport_writers
        .lock()
        .unwrap()
        .insert(ConnectionId(1), writer);
    server.mark_transport_initialized(ConnectionId(1));
    server
        .thread_states
        .connection_initialized(ConnectionId(1))
        .await;
    assert!(
        server
            .thread_states
            .subscribe_connection(ThreadId::new("thread-1"), ConnectionId(1))
            .await
    );
    receiver
}

async fn next(receiver: &mut mpsc::Receiver<crate::QueuedOutgoingMessage>) -> JsonRpcMessage {
    tokio::time::timeout(Duration::from_secs(2), receiver.recv())
        .await
        .unwrap()
        .unwrap()
        .message
        .into_json_rpc_message()
}

async fn transition(server: &AppServer) {
    let (completion_tx, completion_rx) = oneshot::channel();
    server
        .event_bridge()
        .send_thread_command(
            ThreadId::new("thread-1"),
            ThreadListenerCommand::PublishNotification {
                notification: JsonRpcNotification::new(
                    "test/turnTerminal",
                    Some(json!({"threadId":"thread-1"})),
                ),
                origin_connection_id: None,
                completion_tx: Some(completion_tx),
            },
        )
        .await
        .unwrap();
    completion_rx.await.unwrap().unwrap();
}

#[tokio::test]
async fn response_resolution_precedes_transition_without_polling_waiter() {
    for rejected in [false, true] {
        let server = AppServer::new();
        let mut receiver = connect(&server).await;
        let pending = server
            .begin_thread_server_request(
                "thread-1",
                "item/tool/requestUserInput",
                json!({"threadId":"thread-1","turnId":"turn-1"}),
            )
            .await
            .unwrap();
        let request_id = pending.id().clone();
        assert!(matches!(
            next(&mut receiver).await,
            JsonRpcMessage::Request(_)
        ));
        let response = if rejected {
            JsonRpcMessage::Error(app_server_protocol::JsonRpcErrorResponse {
                id: request_id.clone(),
                error: JsonRpcError::new(error_codes::RUNTIME_ERROR, "client failed"),
            })
        } else {
            JsonRpcMessage::Response(
                JsonRpcResponse::new(request_id.clone(), json!({"answers":{}})).unwrap(),
            )
        };
        server
            .handle_transport_message(ConnectionId(1), response)
            .await
            .unwrap();
        assert_eq!(
            server
                .server_requests
                .abort_for_thread_turn(&server.event_bridge(), "thread-1", "turn-1", "interrupted")
                .await,
            0
        );
        transition(&server).await;
        let result = server
            .finish_server_request::<Value>("thread-1", pending)
            .await;
        assert_eq!(result.is_err(), rejected);
        let JsonRpcMessage::Notification(resolved) = next(&mut receiver).await else {
            panic!("resolved")
        };
        assert_eq!(
            resolved.method, "serverRequest/resolved",
            "resolution must precede terminal even when the consumer has not resumed"
        );
        assert_eq!(
            resolved.params.unwrap()["requestId"],
            serde_json::to_value(request_id).unwrap()
        );
        let JsonRpcMessage::Notification(terminal) = next(&mut receiver).await else {
            panic!("terminal")
        };
        assert_eq!(terminal.method, "test/turnTerminal");
        assert!(receiver.try_recv().is_err());
        assert_eq!(server.server_requests.pending_count(), 0);
    }
}

#[tokio::test]
async fn interrupt_wins_before_late_response_without_duplicate_resolution() {
    let server = AppServer::new();
    let mut receiver = connect(&server).await;
    let pending = server
        .begin_thread_server_request(
            "thread-1",
            "item/tool/requestUserInput",
            json!({"threadId":"thread-1","turnId":"turn-1"}),
        )
        .await
        .unwrap();
    let request_id = pending.id().clone();
    assert!(matches!(
        next(&mut receiver).await,
        JsonRpcMessage::Request(_)
    ));
    assert_eq!(
        server
            .server_requests
            .abort_for_thread_turn(&server.event_bridge(), "thread-1", "turn-1", "interrupted")
            .await,
        1
    );
    transition(&server).await;
    server
        .handle_transport_message(
            ConnectionId(1),
            JsonRpcMessage::Response(
                JsonRpcResponse::new(request_id.clone(), json!({"answers":{}})).unwrap(),
            ),
        )
        .await
        .unwrap();
    assert_eq!(
        server
            .finish_server_request::<Value>("thread-1", pending)
            .await,
        Err(crate::approval_server_request::WaitServerRequestError::Transition)
    );
    let JsonRpcMessage::Notification(resolved) = next(&mut receiver).await else {
        panic!("resolved")
    };
    assert_eq!(resolved.method, "serverRequest/resolved");
    assert_eq!(
        resolved.params.unwrap()["requestId"],
        serde_json::to_value(request_id).unwrap()
    );
    let JsonRpcMessage::Notification(terminal) = next(&mut receiver).await else {
        panic!("terminal")
    };
    assert_eq!(terminal.method, "test/turnTerminal");
    assert!(receiver.try_recv().is_err());
    assert_eq!(server.server_requests.pending_count(), 0);
}

#[tokio::test]
async fn response_during_resume_is_removed_from_replay_and_precedes_deferred_terminal() {
    use crate::thread_state::ThreadResumeBarrier;
    let server = AppServer::new();
    let mut receiver = connect(&server).await;
    let pending = server
        .begin_thread_server_request(
            "thread-1",
            "item/tool/requestUserInput",
            json!({"threadId":"thread-1","turnId":"turn-1"}),
        )
        .await
        .unwrap();
    let request_id = pending.id().clone();
    assert!(matches!(
        next(&mut receiver).await,
        JsonRpcMessage::Request(_)
    ));
    let bridge = server.event_bridge();
    let thread_id = ThreadId::new("thread-1");
    let barrier = ThreadResumeBarrier::new(ConnectionId(1), RequestId::Integer(20));
    bridge
        .prepare_thread_resume(thread_id.clone(), barrier.clone())
        .await
        .unwrap();
    let responding = tokio::spawn({
        let server = server.clone();
        async move {
            server
                .handle_transport_message(
                    ConnectionId(1),
                    JsonRpcMessage::Response(
                        JsonRpcResponse::new(request_id, json!({"answers":{}})).unwrap(),
                    ),
                )
                .await
                .unwrap()
        }
    });
    tokio::time::timeout(Duration::from_secs(2), async {
        while server.server_requests.pending_count() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("listener takes response during resume");
    assert!(receiver.try_recv().is_err());
    assert!(!responding.is_finished());
    let (terminal_tx, terminal_rx) = oneshot::channel();
    bridge
        .send_thread_command(
            thread_id.clone(),
            ThreadListenerCommand::PublishNotification {
                notification: JsonRpcNotification::new(
                    "test/turnTerminal",
                    Some(json!({"threadId":"thread-1"})),
                ),
                origin_connection_id: None,
                completion_tx: Some(terminal_tx),
            },
        )
        .await
        .unwrap();
    let (completion_tx, completion_rx) = oneshot::channel();
    bridge
        .send_thread_command(
            thread_id,
            ThreadListenerCommand::CompleteResume {
                barrier,
                connection_id: ConnectionId(1),
                messages: vec![],
                subscribe: true,
                completion_tx,
            },
        )
        .await
        .unwrap();
    completion_rx.await.unwrap().unwrap();
    terminal_rx.await.unwrap().unwrap();
    responding.await.unwrap();
    assert_eq!(
        server
            .finish_server_request::<Value>("thread-1", pending)
            .await
            .unwrap(),
        json!({"answers":{}})
    );
    for method in ["serverRequest/resolved", "test/turnTerminal"] {
        let JsonRpcMessage::Notification(notification) = next(&mut receiver).await else {
            panic!("no stale request replay")
        };
        assert_eq!(notification.method, method);
    }
    assert!(receiver.try_recv().is_err());
}
