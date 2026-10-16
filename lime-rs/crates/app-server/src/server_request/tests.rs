use super::*;
use crate::finish_json_lines;
use crate::run_json_lines;
use crate::AppServer;
use app_server_protocol::JsonRpcMessage;
use serde_json::json;
use std::time::Duration;
use tokio::io::AsyncBufReadExt;
use tokio::io::AsyncWriteExt;
use tokio::io::BufReader;

#[test]
fn server_request_ids_are_unique_across_boot_scopes() {
    let first_router = ServerRequestRouter::with_boot_nonce(Uuid::from_u128(1));
    let second_router = ServerRequestRouter::with_boot_nonce(Uuid::from_u128(2));

    let first = first_router.register("test/request", None);
    let second = second_router.register("test/request", None);

    assert_ne!(first.id(), second.id());
    assert!(first.id().to_string().ends_with(":0"));
    assert!(second.id().to_string().ends_with(":0"));
}

#[tokio::test]
async fn server_request_routes_concurrent_responses_by_exact_id() {
    let router = ServerRequestRouter::default();
    let first = router.register("first/request", Some(json!({ "index": 1 })));
    let second = router.register("second/request", Some(json!({ "index": 2 })));

    router
        .resolve_response(second.id().clone(), json!({ "accepted": 2 }))
        .expect("second response");
    assert_eq!(
        second.wait().await.expect("second result"),
        json!({ "accepted": 2 })
    );
    assert_eq!(router.pending_count(), 1);

    router
        .resolve_response(first.id().clone(), json!({ "accepted": 1 }))
        .expect("first response");
    assert_eq!(
        first.wait().await.expect("first result"),
        json!({ "accepted": 1 })
    );
    assert_eq!(router.pending_count(), 0);
}

#[tokio::test]
async fn wait_terminal_preserves_claimed_owner_after_route_removal() {
    let router = ServerRequestRouter::default();
    let first_owner = ServerRequestOwner::Transport(ConnectionId(1));
    let second_owner = ServerRequestOwner::Transport(ConnectionId(2));
    let pending = router.register_for_owner(
        first_owner,
        "item/tool/requestUserInput",
        Some(json!({ "threadId": "thread-1" })),
    );

    assert_eq!(router.cancel_owner(first_owner, "disconnected"), 0);
    assert_eq!(router.current_owner(pending.id()), None);
    assert_eq!(router.claim_owner_thread(second_owner, "thread-1").len(), 1);
    assert!(matches!(
        router.resolve_transport_response(ConnectionId(1), pending.id().clone(), json!("stale"),),
        Err(ServerRequestError::ClientMismatch { .. })
    ));
    router
        .resolve_transport_response(
            ConnectionId(2),
            pending.id().clone(),
            json!({ "answer": "yes" }),
        )
        .expect("claimed owner resolves request");

    let mut pending = pending;
    let terminal = pending.wait_terminal().await;
    assert_eq!(terminal.owner, Some(second_owner));
    assert_eq!(
        terminal.result.expect("terminal result"),
        json!({ "answer": "yes" })
    );
}

#[test]
fn pending_request_snapshot_for_owner_thread_is_in_request_id_order() {
    let router = ServerRequestRouter::with_boot_nonce(Uuid::from_u128(1));
    let owner = ServerRequestOwner::Transport(ConnectionId(7));
    let pending = (0..12)
        .map(|index| {
            router.register_for_owner(
                owner,
                "test/request",
                Some(json!({ "threadId": "thread-1", "index": index })),
            )
        })
        .collect::<Vec<_>>();
    let expected_requests = pending
        .iter()
        .map(|pending| pending.request().clone())
        .collect::<Vec<_>>();

    let snapshot = router.snapshot_for_owner_thread(owner, "thread-1");

    assert_eq!(snapshot, expected_requests);
}

#[test]
fn pending_request_snapshot_isolated_by_owner_and_canonical_thread_id() {
    let router = ServerRequestRouter::default();
    let first_owner = ServerRequestOwner::Transport(ConnectionId(1));
    let second_owner = ServerRequestOwner::Transport(ConnectionId(2));
    let expected = router.register_for_owner(
        first_owner,
        "expected/request",
        Some(json!({ "threadId": "thread-1" })),
    );
    let _other_thread = router.register_for_owner(
        first_owner,
        "other-thread/request",
        Some(json!({ "threadId": "thread-2" })),
    );
    let _other_owner = router.register_for_owner(
        second_owner,
        "other-owner/request",
        Some(json!({ "threadId": "thread-1" })),
    );
    let _session_only = router.register_for_owner(
        first_owner,
        "session-only/request",
        Some(json!({ "sessionId": "thread-1" })),
    );

    let snapshot = router.snapshot_for_owner_thread(first_owner, "thread-1");

    assert_eq!(snapshot.len(), 1);
    assert_eq!(snapshot[0].id, *expected.id());
    assert_eq!(snapshot[0].method, "expected/request");
}

#[tokio::test]
async fn pending_request_snapshot_removes_resolved_and_dropped_routes() {
    let router = ServerRequestRouter::default();
    let owner = ServerRequestOwner::Transport(ConnectionId(1));
    let resolved = router.register_for_owner(
        owner,
        "resolved/request",
        Some(json!({ "threadId": "thread-1" })),
    );
    let dropped = router.register_for_owner(
        owner,
        "dropped/request",
        Some(json!({ "threadId": "thread-1" })),
    );

    router
        .resolve_transport_response(
            ConnectionId(1),
            resolved.id().clone(),
            json!({ "ok": true }),
        )
        .expect("resolve exact pending route");
    assert_eq!(
        resolved.wait().await.expect("resolved result"),
        json!({ "ok": true })
    );
    assert_eq!(
        router
            .snapshot_for_owner_thread(owner, "thread-1")
            .iter()
            .map(|request| &request.method)
            .collect::<Vec<_>>(),
        vec!["dropped/request"]
    );

    drop(dropped);

    assert!(router
        .snapshot_for_owner_thread(owner, "thread-1")
        .is_empty());
}

#[tokio::test]
async fn server_request_duplicate_and_unknown_responses_fail_closed() {
    let router = ServerRequestRouter::default();
    let pending = router.register("test/request", None);
    let id = pending.id().clone();

    router
        .resolve_response(id.clone(), json!({ "ok": true }))
        .expect("first response");
    assert!(matches!(
        router.resolve_response(id.clone(), json!({ "ok": false })),
        Err(ServerRequestError::RequestNotFound { id: missing }) if missing == id
    ));
    assert!(matches!(
        router.resolve_response(RequestId::String("unknown".to_string()), json!(null)),
        Err(ServerRequestError::RequestNotFound { .. })
    ));
    assert_eq!(
        pending.wait().await.expect("original result"),
        json!({ "ok": true })
    );
}

#[tokio::test]
async fn server_request_drop_and_disconnect_cleanup_remove_exact_waiters() {
    let router = ServerRequestRouter::default();
    let dropped = router.register("drop/request", None);
    let dropped_id = dropped.id().clone();
    drop(dropped);
    assert!(matches!(
        router.resolve_response(dropped_id, json!(null)),
        Err(ServerRequestError::RequestNotFound { .. })
    ));

    let first = router.register("disconnect/first", None);
    let second = router.register("disconnect/second", None);
    assert_eq!(router.cancel_all("transport disconnected"), 2);
    for pending in [first, second] {
        assert!(matches!(
            pending.wait().await,
            Err(ServerRequestError::ClientRejected { error, .. })
                if error.code == error_codes::REQUEST_CANCELLED
        ));
    }
    assert_eq!(router.pending_count(), 0);
}

#[tokio::test]
async fn server_request_aborted_wait_removes_waiter_before_late_response() {
    let router = ServerRequestRouter::default();
    let pending = router.register("abort/request", None);
    let id = pending.id().clone();
    let waiting = tokio::spawn(pending.wait());

    assert_eq!(router.pending_count(), 1);
    waiting.abort();
    assert!(waiting
        .await
        .expect_err("wait task should abort")
        .is_cancelled());
    assert_eq!(router.pending_count(), 0);
    assert!(matches!(
        router.resolve_response(id, json!(null)),
        Err(ServerRequestError::RequestNotFound { .. })
    ));
}

#[tokio::test]
async fn server_request_rejects_broadcast_subscribers_without_leaking_waiter() {
    let server = AppServer::new();
    let _first_client = server.subscribe_outbound_messages();
    let error = server
        .send_server_request("test/request", json!({}))
        .await
        .expect_err("broadcast subscribers must not own server requests");

    assert!(matches!(
        error,
        crate::AppServerError::ServerRequest(ServerRequestError::ClientUnavailable)
    ));
    assert_eq!(server.server_requests.pending_count(), 0);
}

#[tokio::test]
async fn json_lines_error_exit_cleans_waiters_pump_and_transport_writer() {
    let server = AppServer::new();
    let (writer, _outbound) = tokio::sync::mpsc::channel(1);
    server
        .transport_writers
        .lock()
        .expect("transport writers")
        .insert(ConnectionId(1), writer);
    let pending = server.server_requests.register_for_owner(
        ServerRequestOwner::Transport(ConnectionId(1)),
        "test/request",
        None,
    );
    let shutdown = tokio_util::sync::CancellationToken::new();
    let pump_shutdown = shutdown.clone();
    let pump = tokio::spawn(async move {
        pump_shutdown.cancelled().await;
    });

    let error = finish_json_lines(
        &server,
        shutdown,
        pump,
        Err(AppServerError::ServerRequest(
            ServerRequestError::ClientUnavailable,
        )),
    )
    .await
    .expect_err("transport error must be preserved");

    assert!(matches!(
        error,
        AppServerError::ServerRequest(ServerRequestError::ClientUnavailable)
    ));
    assert!(matches!(
        pending.wait().await,
        Err(ServerRequestError::ClientRejected { error, .. })
            if error.code == error_codes::REQUEST_CANCELLED
    ));
    assert!(server
        .transport_writers
        .lock()
        .expect("transport writers")
        .is_empty());
    assert_eq!(server.server_requests.pending_count(), 0);
}

#[tokio::test]
async fn server_request_owner_rejects_cross_connection_response_and_disconnect() {
    let router = ServerRequestRouter::default();
    let first = router.register_for_owner(
        ServerRequestOwner::Transport(ConnectionId(1)),
        "first/request",
        None,
    );
    let first_id = first.id().clone();
    let second = router.register_for_owner(
        ServerRequestOwner::Transport(ConnectionId(2)),
        "second/request",
        None,
    );

    assert!(matches!(
        router.resolve_transport_response(ConnectionId(2), first_id.clone(), json!(null)),
        Err(ServerRequestError::ClientMismatch { id }) if id == first_id
    ));
    assert_eq!(router.pending_count(), 2);
    assert_eq!(
        router.cancel_owner(
            ServerRequestOwner::Transport(ConnectionId(1)),
            "first disconnected",
        ),
        1
    );
    assert!(matches!(
        first.wait().await,
        Err(ServerRequestError::ClientRejected { error, .. })
            if error.code == error_codes::REQUEST_CANCELLED
    ));
    assert_eq!(router.pending_count(), 1);

    router
        .resolve_transport_response(ConnectionId(2), second.id().clone(), json!({ "ok": true }))
        .expect("second owner response");
    assert_eq!(
        second.wait().await.expect("second result"),
        json!({ "ok": true })
    );
}

#[tokio::test]
async fn turn_scoped_cancel_detaches_only_matching_reverse_request() {
    let server = AppServer::new();
    let router = &server.server_requests;
    let mut outbound = server.subscribe_outbound_messages();
    let owner = ServerRequestOwner::Transport(ConnectionId(1));
    let mut matching = router.register_for_owner(
        owner,
        "item/commandExecution/requestApproval",
        Some(json!({ "threadId": "thread-1", "turnId": "turn-1" })),
    );
    let matching_id = matching.id().clone();
    let other_turn = router.register_for_owner(
        owner,
        "item/commandExecution/requestApproval",
        Some(json!({ "threadId": "thread-1", "turnId": "turn-2" })),
    );
    let other_thread = router.register_for_owner(
        owner,
        "item/commandExecution/requestApproval",
        Some(json!({ "threadId": "thread-2", "turnId": "turn-1" })),
    );

    assert_eq!(
        router
            .abort_for_thread_turn(
                &server.event_bridge(),
                "thread-1",
                "turn-1",
                "turn interrupted",
            )
            .await,
        1
    );
    let resolved = tokio::time::timeout(Duration::from_secs(1), outbound.recv())
        .await
        .expect("resolved notification should arrive")
        .expect("resolved notification channel should stay open");
    let JsonRpcMessage::Notification(notification) = resolved else {
        panic!("expected resolved notification");
    };
    let ServerNotification::ServerRequestResolved(resolved) =
        ServerNotification::try_from(notification).expect("typed resolved notification")
    else {
        panic!("expected typed resolved notification");
    };
    assert_eq!(resolved.thread_id, "thread-1");
    assert_eq!(resolved.request_id, matching_id.clone());
    assert_eq!(router.pending_count(), 2);
    assert!(matches!(
        router.resolve_transport_response(ConnectionId(1), matching_id.clone(), json!(null)),
        Err(ServerRequestError::RequestNotFound { id }) if id == matching_id
    ));

    let terminal = matching.wait_terminal().await;
    assert_eq!(terminal.owner, Some(owner));
    assert!(terminal.resolved_in_listener);
    assert!(matches!(
        terminal.result,
        Err(ServerRequestError::ClientRejected { error, .. })
            if error.code == error_codes::REQUEST_CANCELLED
    ));

    router
        .resolve_transport_response(ConnectionId(1), other_turn.id().clone(), json!({}))
        .expect("other turn stays routable");
    router
        .resolve_transport_response(ConnectionId(1), other_thread.id().clone(), json!({}))
        .expect("other thread stays routable");
    assert!(other_turn.wait().await.is_ok());
    assert!(other_thread.wait().await.is_ok());
}

#[tokio::test]
async fn thread_subtree_cancel_resolves_matching_requests_in_registration_order() {
    let server = AppServer::new();
    let router = &server.server_requests;
    let mut outbound = server.subscribe_outbound_messages();
    let mut root = router.register(
        "item/commandExecution/requestApproval",
        Some(json!({ "threadId": "thread-root", "turnId": "turn-root" })),
    );
    let root_id = root.id().clone();
    let mut child = router.register(
        "item/fileChange/requestApproval",
        Some(json!({ "threadId": "thread-child", "turnId": "turn-child" })),
    );
    let child_id = child.id().clone();
    let retained = router.register(
        "item/tool/requestUserInput",
        Some(json!({ "threadId": "thread-retained", "turnId": "turn-retained" })),
    );

    assert_eq!(
        router
            .abort_for_threads(
                &server.event_bridge(),
                &["thread-root".to_string(), "thread-child".to_string()],
                "thread deleted",
            )
            .await,
        2
    );

    for expected_id in [&root_id, &child_id] {
        let message = tokio::time::timeout(Duration::from_secs(1), outbound.recv())
            .await
            .expect("resolved notification should arrive")
            .expect("resolved notification channel should stay open");
        let JsonRpcMessage::Notification(notification) = message else {
            panic!("expected resolved notification");
        };
        let ServerNotification::ServerRequestResolved(resolved) =
            ServerNotification::try_from(notification).expect("typed resolved notification")
        else {
            panic!("expected typed resolved notification");
        };
        assert_eq!(&resolved.request_id, expected_id);
    }

    for pending in [&mut root, &mut child] {
        let terminal = pending.wait_terminal().await;
        assert!(terminal.resolved_in_listener);
        assert!(matches!(
            terminal.result,
            Err(ServerRequestError::ClientRejected { error, .. })
                if error.code == error_codes::REQUEST_CANCELLED
        ));
    }
    assert_eq!(router.pending_count(), 1);
    router
        .resolve_response(retained.id().clone(), json!({ "answers": {} }))
        .expect("retained thread request stays routable");
    assert!(retained.wait().await.is_ok());
    server.thread_states.clear_all_listeners().await;
}

#[tokio::test]
async fn thread_scoped_routes_detach_on_disconnect_and_claim_on_resume() {
    let router = ServerRequestRouter::default();
    let first_owner = ServerRequestOwner::Transport(ConnectionId(1));
    let second_owner = ServerRequestOwner::Transport(ConnectionId(2));
    let first_thread_request = router.register_for_owner(
        first_owner,
        "thread/first",
        Some(json!({ "threadId": "thread-1", "index": 1 })),
    );
    let second_thread_request = router.register_for_owner(
        first_owner,
        "thread/second",
        Some(json!({ "threadId": "thread-1", "index": 2 })),
    );
    let other_thread_request = router.register_for_owner(
        first_owner,
        "thread/other",
        Some(json!({ "threadId": "thread-2" })),
    );
    let unscoped_request = router.register_for_owner(first_owner, "unscoped", None);

    assert_eq!(router.cancel_owner(first_owner, "first disconnected"), 1);
    assert_eq!(router.pending_count(), 3);
    assert_eq!(router.current_owner(first_thread_request.id()), None);
    assert!(router
        .snapshot_for_owner_thread(first_owner, "thread-1")
        .is_empty());
    assert!(matches!(
        router.resolve_transport_response(
            ConnectionId(1),
            first_thread_request.id().clone(),
            json!(null),
        ),
        Err(ServerRequestError::ClientMismatch { .. })
    ));
    assert!(matches!(
        unscoped_request.wait().await,
        Err(ServerRequestError::ClientRejected { error, .. })
            if error.code == error_codes::REQUEST_CANCELLED
    ));

    let claimed = router.claim_owner_thread(second_owner, "thread-1");
    assert_eq!(
        claimed,
        vec![
            first_thread_request.request().clone(),
            second_thread_request.request().clone()
        ]
    );
    assert_eq!(
        router.current_owner(first_thread_request.id()),
        Some(second_owner)
    );
    assert_eq!(
        router.snapshot_for_owner_thread(second_owner, "thread-1"),
        claimed
    );
    assert!(router
        .snapshot_for_owner_thread(second_owner, "thread-2")
        .is_empty());

    assert!(matches!(
        router.resolve_transport_response(
            ConnectionId(1),
            first_thread_request.id().clone(),
            json!("stale"),
        ),
        Err(ServerRequestError::ClientMismatch { .. })
    ));
    router
        .resolve_transport_response(
            ConnectionId(2),
            first_thread_request.id().clone(),
            json!({ "ok": 1 }),
        )
        .expect("claimed owner resolves first request");
    router
        .resolve_transport_response(
            ConnectionId(2),
            second_thread_request.id().clone(),
            json!({ "ok": 2 }),
        )
        .expect("claimed owner resolves second request");
    assert_eq!(
        first_thread_request.wait().await.expect("first result"),
        json!({ "ok": 1 })
    );
    assert_eq!(
        second_thread_request.wait().await.expect("second result"),
        json!({ "ok": 2 })
    );
    drop(other_thread_request);
    assert_eq!(router.pending_count(), 0);
}

#[test]
fn claim_owner_thread_replays_active_route_for_each_new_owner() {
    let router = ServerRequestRouter::default();
    let first_owner = ServerRequestOwner::Transport(ConnectionId(1));
    let second_owner = ServerRequestOwner::Transport(ConnectionId(2));
    let pending = router.register_for_owner(
        first_owner,
        "thread/request",
        Some(json!({ "threadId": "thread-1" })),
    );

    assert_eq!(
        router.claim_owner_thread(second_owner, "thread-1"),
        vec![pending.request().clone()]
    );
    assert_eq!(router.current_owner(pending.id()), Some(second_owner));
    assert_eq!(
        router.snapshot_for_owner_thread(first_owner, "thread-1"),
        vec![pending.request().clone()]
    );
    assert_eq!(
        router.snapshot_for_owner_thread(second_owner, "thread-1"),
        vec![pending.request().clone()]
    );
    assert!(router
        .claim_owner_thread(second_owner, "thread-1")
        .is_empty());
}

#[tokio::test]
async fn first_terminal_response_wins_across_claimed_thread_route_owners() {
    let router = ServerRequestRouter::default();
    let first_owner = ServerRequestOwner::Transport(ConnectionId(1));
    let second_owner = ServerRequestOwner::Transport(ConnectionId(2));
    let pending = router.register_for_owner(
        first_owner,
        "thread/request",
        Some(json!({ "threadId": "thread-1" })),
    );
    let request_id = pending.id().clone();
    router.claim_owner_thread(second_owner, "thread-1");

    router
        .resolve_transport_response(
            ConnectionId(2),
            request_id.clone(),
            json!({ "acceptedBy": 2 }),
        )
        .expect("claimed owner resolves request");
    assert!(matches!(
        router.resolve_transport_response(ConnectionId(1), request_id.clone(), json!(null)),
        Err(ServerRequestError::RequestNotFound { id }) if id == request_id
    ));

    let mut pending = pending;
    let terminal = pending.wait_terminal().await;
    assert_eq!(terminal.owner, Some(second_owner));
    assert_eq!(
        terminal.result.expect("terminal result"),
        json!({ "acceptedBy": 2 })
    );
}

#[tokio::test]
async fn disconnect_removes_only_the_matching_thread_route_owner() {
    let router = ServerRequestRouter::default();
    let first_owner = ServerRequestOwner::Transport(ConnectionId(1));
    let second_owner = ServerRequestOwner::Transport(ConnectionId(2));
    let pending = router.register_for_owner(
        first_owner,
        "thread/request",
        Some(json!({ "threadId": "thread-1" })),
    );
    let request_id = pending.id().clone();
    router.claim_owner_thread(second_owner, "thread-1");

    assert_eq!(router.cancel_owner(first_owner, "first disconnected"), 0);
    assert!(router
        .snapshot_for_owner_thread(first_owner, "thread-1")
        .is_empty());
    assert_eq!(
        router.snapshot_for_owner_thread(second_owner, "thread-1"),
        vec![pending.request().clone()]
    );
    assert_eq!(router.current_owner(&request_id), Some(second_owner));
    assert!(matches!(
        router.resolve_transport_response(ConnectionId(1), request_id.clone(), json!(null)),
        Err(ServerRequestError::ClientMismatch { id }) if id == request_id
    ));

    router
        .resolve_transport_response(ConnectionId(2), request_id, json!({ "acceptedBy": 2 }))
        .expect("remaining owner resolves request");
    assert_eq!(
        pending.wait().await.expect("remaining owner result"),
        json!({ "acceptedBy": 2 })
    );
}

#[tokio::test]
async fn resolved_notification_includes_origin_without_leaking_to_unrelated_clients() {
    let server = AppServer::new();
    let (first_tx, mut first_rx) = tokio::sync::mpsc::channel(1);
    let (second_tx, mut second_rx) = tokio::sync::mpsc::channel(1);
    server
        .transport_writers
        .lock()
        .expect("transport writers")
        .extend([(ConnectionId(1), first_tx), (ConnectionId(2), second_tx)]);
    let request_id = RequestId::String("app-server-request:boot:7".to_string());
    server.mark_transport_initialized(ConnectionId(1));
    server.mark_transport_initialized(ConnectionId(2));

    server
        .publish_server_request_resolved(
            "thread-1",
            request_id.clone(),
            Some(ServerRequestOwner::Transport(ConnectionId(1))),
        )
        .await
        .expect("send exact notification");

    let message = first_rx.recv().await.expect("first owner message");
    let JsonRpcMessage::Notification(notification) = message.message.into_json_rpc_message() else {
        panic!("expected resolved notification");
    };
    assert_eq!(
        ServerNotification::try_from(notification).expect("typed notification"),
        ServerNotification::ServerRequestResolved(ServerRequestResolvedNotification {
            thread_id: "thread-1".to_string(),
            request_id,
        })
    );
    assert!(matches!(
        second_rx.try_recv(),
        Err(tokio::sync::mpsc::error::TryRecvError::Empty)
    ));
}

#[tokio::test]
async fn server_request_round_trips_through_json_lines_transport() {
    let server = AppServer::new();
    let (client_io, server_io) = tokio::io::duplex(16 * 1024);
    let (client_read, mut client_write) = tokio::io::split(client_io);
    let (server_read, server_write) = tokio::io::split(server_io);
    let running = tokio::spawn(run_json_lines(server.clone(), server_read, server_write));

    tokio::time::timeout(Duration::from_secs(2), async {
        loop {
            if !server
                .transport_writers
                .lock()
                .expect("transport writer mutex")
                .is_empty()
            {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("transport should connect");

    let mut lines = BufReader::new(client_read).lines();
    client_write
        .write_all(
            format!(
                "{}\n",
                json!({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": crate::METHOD_INITIALIZE,
                    "params": {
                        "clientInfo": {
                            "name": "server-request-jsonl-test",
                            "version": "1.0.0"
                        }
                    }
                })
            )
            .as_bytes(),
        )
        .await
        .expect("write initialize request");
    let initialize_line = tokio::time::timeout(Duration::from_secs(2), lines.next_line())
        .await
        .expect("initialize response should arrive")
        .expect("read initialize response")
        .expect("initialize response line");
    let JsonRpcMessage::Response(initialize_response) =
        serde_json::from_str::<JsonRpcMessage>(&initialize_line)
            .expect("decode initialize response")
    else {
        panic!("expected initialize response");
    };
    assert_eq!(initialize_response.id, RequestId::Integer(1));
    client_write
        .write_all(
            format!(
                "{}\n",
                json!({
                    "jsonrpc": "2.0",
                    "method": crate::METHOD_INITIALIZED,
                    "params": {}
                })
            )
            .as_bytes(),
        )
        .await
        .expect("write initialized notification");

    let request_server = server.clone();
    let pending = tokio::spawn(async move {
        request_server
            .send_server_request(
                "mcpServer/elicitation/request",
                json!({
                    "server": "form-server",
                    "message": "Choose a value",
                    "requestedSchema": {
                        "type": "object",
                        "properties": {}
                    }
                }),
            )
            .await
    });

    let request = tokio::time::timeout(Duration::from_secs(2), async {
        loop {
            let line = lines
                .next_line()
                .await
                .expect("read server request")
                .expect("server request line");
            if let JsonRpcMessage::Request(request) =
                serde_json::from_str::<JsonRpcMessage>(&line).expect("decode server message")
            {
                break request;
            }
        }
    })
    .await
    .expect("server request should arrive");
    assert_eq!(request.method, "mcpServer/elicitation/request");

    let response = JsonRpcMessage::Response(
        app_server_protocol::JsonRpcResponse::new(request.id, json!({ "action": "decline" }))
            .expect("serialize response"),
    );
    client_write
        .write_all(
            format!(
                "{}\n",
                serde_json::to_string(&response).expect("encode response")
            )
            .as_bytes(),
        )
        .await
        .expect("write response");

    assert_eq!(
        pending
            .await
            .expect("request task")
            .expect("server request result"),
        json!({ "action": "decline" })
    );

    drop(client_write);
    drop(lines);
    tokio::time::timeout(Duration::from_secs(2), running)
        .await
        .expect("transport should stop")
        .expect("transport task")
        .expect("transport result");
}
