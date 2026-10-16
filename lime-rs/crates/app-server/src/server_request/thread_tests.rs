use super::*;
use crate::thread_state::{ThreadListenerCommand, ThreadResumeBarrier};
use agent_protocol::ThreadId;
use serde_json::json;
use std::time::Duration;
use tokio::sync::mpsc;

async fn connect(
    server: &AppServer,
    id: u64,
    thread: Option<&str>,
) -> mpsc::Receiver<crate::QueuedOutgoingMessage> {
    let connection_id = ConnectionId(id);
    let (writer, receiver) = mpsc::channel(32);
    server
        .transport_writers
        .lock()
        .unwrap()
        .insert(connection_id, writer);
    server.mark_transport_initialized(connection_id);
    server
        .thread_states
        .connection_initialized(connection_id)
        .await;
    if let Some(thread) = thread {
        assert!(
            server
                .thread_states
                .subscribe_connection(ThreadId::new(thread), connection_id)
                .await
        );
    }
    receiver
}

async fn next(receiver: &mut mpsc::Receiver<crate::QueuedOutgoingMessage>) -> JsonRpcMessage {
    tokio::time::timeout(Duration::from_secs(2), receiver.recv())
        .await
        .expect("message deadline")
        .expect("message")
        .message
        .into_json_rpc_message()
}

async fn resume(server: &AppServer, thread: &str, id: u64, barrier: ThreadResumeBarrier) {
    let (completion_tx, completion_rx) = oneshot::channel();
    server
        .event_bridge()
        .send_thread_command(
            ThreadId::new(thread),
            ThreadListenerCommand::CompleteResume {
                barrier,
                connection_id: ConnectionId(id),
                messages: vec![],
                subscribe: true,
                completion_tx,
            },
        )
        .await
        .unwrap();
    completion_rx.await.unwrap().unwrap();
}

#[tokio::test]
async fn thread_request_first_delivery_ignores_unrelated_clients_and_settles_once() {
    let server = AppServer::new();
    let mut first = connect(&server, 1, Some("thread-1")).await;
    let mut second = connect(&server, 2, Some("thread-1")).await;
    let mut unrelated = connect(&server, 3, Some("thread-2")).await;
    let waiting_server = server.clone();
    let waiting = tokio::spawn(async move {
        waiting_server
            .wait_thread_server_request::<_, Value>(
                "item/tool/requestUserInput",
                "thread-1",
                json!({ "threadId": "thread-1", "turnId": "turn-1" }),
            )
            .await
    });
    let JsonRpcMessage::Request(first_request) = next(&mut first).await else {
        panic!("first request")
    };
    let JsonRpcMessage::Request(second_request) = next(&mut second).await else {
        panic!("second request")
    };
    assert_eq!(first_request, second_request);
    assert!(unrelated.try_recv().is_err());
    assert!(matches!(
        server.server_requests.resolve_transport_response(
            ConnectionId(3),
            first_request.id.clone(),
            json!(null)
        ),
        Err(ServerRequestError::ClientMismatch { .. })
    ));
    server
        .server_requests
        .resolve_transport_response(
            ConnectionId(2),
            first_request.id.clone(),
            json!({ "answer": "second" }),
        )
        .unwrap();
    assert!(matches!(
        server.server_requests.resolve_transport_response(
            ConnectionId(1),
            first_request.id.clone(),
            json!(null)
        ),
        Err(ServerRequestError::RequestNotFound { .. })
    ));
    assert_eq!(
        waiting.await.unwrap().unwrap(),
        json!({ "answer": "second" })
    );
    for receiver in [&mut first, &mut second] {
        let JsonRpcMessage::Notification(notification) = next(receiver).await else {
            panic!("resolved notification")
        };
        assert_eq!(
            ServerNotification::try_from(notification).unwrap(),
            ServerNotification::ServerRequestResolved(ServerRequestResolvedNotification {
                thread_id: "thread-1".into(),
                request_id: first_request.id.clone()
            })
        );
        assert!(receiver.try_recv().is_err());
    }
    assert!(unrelated.try_recv().is_err());
    assert_eq!(server.server_requests.pending_count(), 0);
}

#[tokio::test]
async fn first_delivery_survives_a_closed_writer_and_disconnect_then_resume() {
    let server = AppServer::new();
    let first = connect(&server, 1, Some("thread-1")).await;
    let mut second = connect(&server, 2, Some("thread-1")).await;
    drop(first);
    let pending = server
        .begin_thread_server_request(
            "thread-1",
            "item/tool/requestUserInput",
            json!({ "threadId": "thread-1" }),
        )
        .await
        .unwrap();
    let JsonRpcMessage::Request(request) = next(&mut second).await else {
        panic!("surviving request")
    };
    assert_eq!(*pending.id(), request.id);
    assert!(matches!(
        server.server_requests.resolve_transport_response(
            ConnectionId(1),
            request.id.clone(),
            json!(null)
        ),
        Err(ServerRequestError::ClientMismatch { .. })
    ));
    assert_eq!(
        server
            .server_requests
            .cancel_owner(ServerRequestOwner::Transport(ConnectionId(2)), "disconnect"),
        0
    );
    server
        .thread_states
        .disconnect_connection(ConnectionId(2))
        .await;
    assert_eq!(server.server_requests.current_owner(pending.id()), None);
    let mut reconnected = connect(&server, 3, None).await;
    let barrier = ThreadResumeBarrier::new(ConnectionId(3), RequestId::Integer(30));
    server
        .event_bridge()
        .prepare_thread_resume(ThreadId::new("thread-1"), barrier.clone())
        .await
        .unwrap();
    resume(&server, "thread-1", 3, barrier).await;
    assert_eq!(
        next(&mut reconnected).await,
        JsonRpcMessage::Request(request.clone())
    );
    server
        .server_requests
        .resolve_transport_response(ConnectionId(3), request.id, json!({ "answer": "resumed" }))
        .unwrap();
    assert_eq!(
        pending.wait().await.unwrap(),
        json!({ "answer": "resumed" })
    );
    assert!(reconnected.try_recv().is_err());
}

#[tokio::test]
async fn resume_barrier_defers_first_request_until_both_subscribers_are_ready() {
    let server = AppServer::new();
    let mut first = connect(&server, 1, Some("thread-1")).await;
    let mut second = connect(&server, 2, None).await;
    let barrier = ThreadResumeBarrier::new(ConnectionId(2), RequestId::Integer(20));
    server
        .event_bridge()
        .prepare_thread_resume(ThreadId::new("thread-1"), barrier.clone())
        .await
        .unwrap();
    let (completion_tx, completion_rx) = oneshot::channel();
    server
        .event_bridge()
        .send_thread_command(
            ThreadId::new("thread-1"),
            ThreadListenerCommand::BeginServerRequest {
                method: "mcpServer/elicitation/request".into(),
                params: json!({ "threadId": "thread-1", "turnId": "turn-1" }),
                completion_tx,
            },
        )
        .await
        .unwrap();
    resume(&server, "thread-1", 2, barrier).await;
    let pending = completion_rx.await.unwrap().unwrap();
    let first_request = next(&mut first).await;
    assert_eq!(first_request, next(&mut second).await);
    assert_eq!(
        first_request,
        JsonRpcMessage::Request(pending.request().clone())
    );
    assert!(first.try_recv().is_err());
    assert!(second.try_recv().is_err());
}

#[tokio::test]
async fn resume_claims_existing_first_delivery_once_inside_listener() {
    let server = AppServer::new();
    let mut first = connect(&server, 1, Some("thread-1")).await;
    let mut second = connect(&server, 2, None).await;
    let pending = server
        .begin_thread_server_request(
            "thread-1",
            "item/tool/requestUserInput",
            json!({ "threadId": "thread-1" }),
        )
        .await
        .unwrap();
    let first_request = next(&mut first).await;
    let barrier = ThreadResumeBarrier::new(ConnectionId(2), RequestId::Integer(20));
    server
        .event_bridge()
        .prepare_thread_resume(ThreadId::new("thread-1"), barrier.clone())
        .await
        .unwrap();
    resume(&server, "thread-1", 2, barrier).await;
    assert_eq!(next(&mut second).await, first_request);
    assert!(first.try_recv().is_err());
    assert!(second.try_recv().is_err());
    server
        .server_requests
        .resolve_transport_response(ConnectionId(2), pending.id().clone(), json!("accepted"))
        .unwrap();
    assert_eq!(pending.wait().await.unwrap(), json!("accepted"));
}

#[tokio::test]
async fn unscoped_host_request_still_rejects_ambiguous_clients() {
    let server = AppServer::new();
    let mut first = connect(&server, 1, Some("thread-1")).await;
    let mut second = connect(&server, 2, Some("thread-1")).await;
    assert!(matches!(
        server
            .begin_server_request("item/tool/call", json!({ "threadId": "thread-1" }))
            .await,
        Err(AppServerError::ServerRequest(
            ServerRequestError::ClientAmbiguous { client_count: 2 }
        ))
    ));
    assert!(first.try_recv().is_err());
    assert!(second.try_recv().is_err());
    assert_eq!(server.server_requests.pending_count(), 0);
}

#[tokio::test]
async fn turn_interrupt_removes_deferred_first_request_before_resume_flush() {
    let server = AppServer::new();
    let mut first = connect(&server, 1, Some("thread-1")).await;
    let mut second = connect(&server, 2, None).await;
    let barrier = ThreadResumeBarrier::new(ConnectionId(2), RequestId::Integer(20));
    server
        .event_bridge()
        .prepare_thread_resume(ThreadId::new("thread-1"), barrier.clone())
        .await
        .unwrap();
    let (completion_tx, completion_rx) = oneshot::channel();
    server
        .event_bridge()
        .send_thread_command(
            ThreadId::new("thread-1"),
            ThreadListenerCommand::BeginServerRequest {
                method: "item/tool/requestUserInput".into(),
                params: json!({ "threadId": "thread-1", "turnId": "turn-1" }),
                completion_tx,
            },
        )
        .await
        .unwrap();
    tokio::time::timeout(Duration::from_secs(2), async {
        while server.server_requests.pending_count() == 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert_eq!(
        server
            .server_requests
            .abort_for_thread_turn(&server.event_bridge(), "thread-1", "turn-1", "interrupted")
            .await,
        1
    );
    resume(&server, "thread-1", 2, barrier).await;
    let mut pending = completion_rx.await.unwrap().unwrap();
    let terminal = pending.wait_terminal().await;
    assert!(terminal.resolved_in_listener);
    assert!(
        matches!(terminal.result, Err(ServerRequestError::ClientRejected { error, .. }) if error.code == error_codes::REQUEST_CANCELLED)
    );
    assert!(first.try_recv().is_err());
    assert!(second.try_recv().is_err());
    assert_eq!(server.server_requests.pending_count(), 0);
}

#[tokio::test]
async fn thread_request_rejects_mismatched_scope_and_has_no_client_fallback() {
    let server = AppServer::new();
    let mut unrelated = connect(&server, 1, Some("other-thread")).await;
    assert!(matches!(
        server
            .begin_thread_server_request(
                "thread-1",
                "item/tool/requestUserInput",
                json!({ "threadId": "other-thread" })
            )
            .await,
        Err(AppServerError::ThreadListener(_))
    ));
    assert!(matches!(
        server
            .begin_thread_server_request(
                "thread-1",
                "item/tool/requestUserInput",
                json!({ "threadId": "thread-1" })
            )
            .await,
        Err(AppServerError::ServerRequest(
            ServerRequestError::ClientUnavailable
        ))
    ));
    assert!(unrelated.try_recv().is_err());
    assert_eq!(server.server_requests.pending_count(), 0);
}

#[tokio::test]
async fn host_capabilities_are_not_replayed_to_another_subscriber_on_disconnect() {
    for method in [
        app_server_protocol::protocol::v2::METHOD_ITEM_TOOL_CALL,
        app_server_protocol::protocol::v2::METHOD_CURRENT_TIME_READ,
    ] {
        let router = ServerRequestRouter::default();
        let owner = ServerRequestOwner::Transport(ConnectionId(1));
        let pending =
            router.register_for_owner(owner, method, Some(json!({ "threadId": "thread-1" })));
        assert!(router
            .claim_owner_thread(ServerRequestOwner::Transport(ConnectionId(2)), "thread-1")
            .is_empty());
        assert_eq!(router.current_owner(pending.id()), Some(owner));
        assert_eq!(router.cancel_owner(owner, "host disconnected"), 1);
        assert!(
            matches!(pending.wait().await, Err(ServerRequestError::ClientRejected { error, .. }) if error.code == error_codes::REQUEST_CANCELLED)
        );
        assert_eq!(router.pending_count(), 0);
    }
}
