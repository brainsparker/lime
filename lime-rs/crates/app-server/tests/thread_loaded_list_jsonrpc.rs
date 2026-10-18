use std::sync::Arc;

use app_server::{AppServer, EventLogWriter, MockBackend, ProjectionStore, RuntimeCore};
use app_server_protocol::protocol::v2::{
    METHOD_THREAD_ARCHIVE, METHOD_THREAD_DELETE, METHOD_THREAD_FORK,
};
use app_server_protocol::{
    error_codes, AgentSessionStartParams, BusinessObjectRef, METHOD_INITIALIZE, METHOD_INITIALIZED,
    METHOD_THREAD_LOADED_LIST, METHOD_THREAD_READ, METHOD_THREAD_RESUME, METHOD_THREAD_START,
};
use serde_json::{json, Value};
use tempfile::TempDir;
use uuid::Uuid;

#[tokio::test]
async fn thread_loaded_list_tracks_memory_owner_and_paginates_like_codex() {
    let temp = TempDir::new().expect("loaded thread temp dir");
    let projection = ProjectionStore::initialize(temp.path().join("projection.sqlite"))
        .expect("loaded thread projection store");
    let runtime = RuntimeCore::with_backend(Arc::new(MockBackend))
        .with_projection_store(Arc::new(projection));
    runtime
        .start_session(AgentSessionStartParams {
            session_id: Some("hidden-loaded-session".to_string()),
            thread_id: Some("hidden-loaded-thread".to_string()),
            app_id: "thread-loaded-list-test".to_string(),
            workspace_id: None,
            business_object_ref: Some(BusinessObjectRef {
                kind: "agent.thread".to_string(),
                id: "hidden-loaded-thread".to_string(),
                title: None,
                uri: None,
                metadata: Some(json!({
                    "harness": {"hiddenFromUserRecents": true}
                })),
            }),
            locale: None,
        })
        .expect("hidden loaded session");
    let server = AppServer::with_runtime(runtime);
    initialize(&server).await;

    let empty = request(&server, 2, METHOD_THREAD_LOADED_LIST, json!({})).await;
    assert_eq!(empty["result"], json!({"data": [], "nextCursor": null}));

    let first = start_thread(&server, 3).await;
    let second = start_thread(&server, 4).await;
    let mut expected = [first, second];
    expected.sort();

    let first_page = request(&server, 5, METHOD_THREAD_LOADED_LIST, json!({"limit": 1})).await;
    assert_eq!(first_page["result"]["data"], json!([expected[0]]));
    assert_eq!(first_page["result"]["nextCursor"], json!(expected[0]));

    let second_page = request(
        &server,
        6,
        METHOD_THREAD_LOADED_LIST,
        json!({"cursor": expected[0], "limit": 1}),
    )
    .await;
    assert_eq!(second_page["result"]["data"], json!([expected[1]]));
    assert_eq!(second_page["result"]["nextCursor"], Value::Null);

    let stale_cursor = "00000000-0000-7000-8000-000000000000";
    let stale_page = request(
        &server,
        7,
        METHOD_THREAD_LOADED_LIST,
        json!({"cursor": stale_cursor, "limit": 1}),
    )
    .await;
    assert_eq!(stale_page["result"]["data"], json!([expected[0]]));

    let zero_limit = request(&server, 8, METHOD_THREAD_LOADED_LIST, json!({"limit": 0})).await;
    assert_eq!(zero_limit["result"]["data"], json!([expected[0]]));
    assert_eq!(zero_limit["result"]["nextCursor"], json!(expected[0]));

    let invalid = request_raw(
        &server,
        9,
        METHOD_THREAD_LOADED_LIST,
        json!({"cursor": "not-a-thread-id"}),
    )
    .await;
    assert_eq!(
        invalid.pointer("/error/code"),
        Some(&json!(error_codes::INVALID_REQUEST))
    );

    request(
        &server,
        10,
        METHOD_THREAD_DELETE,
        json!({"threadId": expected[0]}),
    )
    .await;
    let after_delete = request(&server, 11, METHOD_THREAD_LOADED_LIST, json!({})).await;
    assert_eq!(after_delete["result"]["data"], json!([expected[1]]));

    request(
        &server,
        12,
        METHOD_THREAD_ARCHIVE,
        json!({"threadId": expected[1]}),
    )
    .await;
    let after_archive = request(&server, 13, METHOD_THREAD_LOADED_LIST, json!({})).await;
    assert_eq!(
        after_archive["result"],
        json!({"data": [], "nextCursor": null})
    );
}

#[tokio::test]
async fn thread_read_does_not_load_a_cold_fork_but_resume_does() {
    let temp = TempDir::new().expect("cold fork read temp dir");
    let projection_path = temp.path().join("projection.sqlite");
    let initial = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize(&projection_path).expect("initial projection store"),
        )),
    );
    initialize(&initial).await;
    let source_thread_id = start_thread(&initial, 2).await;
    let forked = request(
        &initial,
        3,
        METHOD_THREAD_FORK,
        json!({"threadId": source_thread_id}),
    )
    .await;
    let forked_thread_id = forked["result"]["thread"]["id"]
        .as_str()
        .expect("forked thread id")
        .to_string();
    drop(initial);

    let restarted = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize(&projection_path).expect("restarted projection store"),
        )),
    );
    initialize(&restarted).await;
    let before_read = request(&restarted, 4, METHOD_THREAD_LOADED_LIST, json!({})).await;
    assert_eq!(
        before_read["result"],
        json!({"data": [], "nextCursor": null})
    );

    let read = request(
        &restarted,
        5,
        METHOD_THREAD_READ,
        json!({"threadId": forked_thread_id, "includeTurns": true}),
    )
    .await;
    assert_eq!(read["result"]["thread"]["id"], json!(forked_thread_id));
    let after_read = request(&restarted, 6, METHOD_THREAD_LOADED_LIST, json!({})).await;
    assert_eq!(
        after_read["result"],
        json!({"data": [], "nextCursor": null}),
        "thread/read must not hydrate a cold fork into the loaded owner"
    );

    request(
        &restarted,
        7,
        METHOD_THREAD_RESUME,
        json!({"threadId": forked_thread_id}),
    )
    .await;
    let after_resume = request(&restarted, 8, METHOD_THREAD_LOADED_LIST, json!({})).await;
    assert_eq!(after_resume["result"]["data"], json!([forked_thread_id]));
}

#[tokio::test]
async fn cold_resume_does_not_revive_an_orphan_turn_in_later_public_reads() {
    use agent_protocol::{
        SessionId, ThreadHistoryChangeSet, ThreadId, Turn, TurnAdmissionState, TurnApprovalState,
        TurnId, TurnItemsView, TurnQueueState, TurnStatus,
    };
    use thread_store::{ApplyThreadHistoryParams, ThreadStore};

    let temp = TempDir::new().expect("orphan read temp dir");
    let projection_path = temp.path().join("projection.sqlite");
    let store = Arc::new(ProjectionStore::initialize(&projection_path).unwrap());
    let initial = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend)).with_projection_store(store.clone()),
    );
    initialize(&initial).await;
    let source_thread_id = start_thread(&initial, 2).await;
    let forked = request(
        &initial,
        3,
        METHOD_THREAD_FORK,
        json!({"threadId": source_thread_id}),
    )
    .await;
    let thread_id = forked["result"]["thread"]["id"]
        .as_str()
        .expect("durable orphan fixture thread")
        .to_string();
    store
        .apply_history(ApplyThreadHistoryParams {
            session_id: SessionId::new(thread_id.clone()),
            thread_id: ThreadId::new(thread_id.clone()),
            changes: ThreadHistoryChangeSet {
                sequence: 1,
                changed_turns: vec![Turn {
                    session_id: SessionId::new(thread_id.clone()),
                    thread_id: ThreadId::new(thread_id.clone()),
                    turn_id: TurnId::new("orphan-turn"),
                    status: TurnStatus::InProgress,
                    admission: TurnAdmissionState::Accepted,
                    queue: TurnQueueState::Running,
                    approval: TurnApprovalState::NotRequired,
                    items: Vec::new(),
                    items_view: TurnItemsView::Full,
                    error: None,
                    created_at_ms: 1,
                    updated_at_ms: 1,
                    started_at_ms: Some(1),
                    completed_at_ms: None,
                    duration_ms: None,
                }],
                ..Default::default()
            },
        })
        .await
        .expect("persist pre-restart running turn fixture");
    drop(initial);
    drop(store);

    let restarted = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize(&projection_path).unwrap(),
        )),
    );
    initialize(&restarted).await;
    let read_params = json!({"threadId": thread_id, "includeTurns": true});
    let cold = request(&restarted, 3, METHOD_THREAD_READ, read_params.clone()).await;
    assert_eq!(cold["result"]["thread"]["status"]["type"], "notLoaded");
    assert_eq!(
        cold["result"]["thread"]["turns"][0]["status"],
        "interrupted"
    );

    let resumed = request(
        &restarted,
        4,
        METHOD_THREAD_RESUME,
        json!({"threadId": thread_id}),
    )
    .await;
    assert_eq!(resumed["result"]["thread"]["status"]["type"], "idle");
    let read = request(&restarted, 5, METHOD_THREAD_READ, read_params.clone()).await;
    assert_eq!(read["result"]["thread"]["status"]["type"], "idle");
    assert_eq!(read["result"]["thread"]["turns"][0]["id"], "orphan-turn");
    assert_eq!(
        read["result"]["thread"]["turns"][0]["status"],
        "interrupted"
    );
    let turns = request(
        &restarted,
        6,
        "thread/turns/list",
        json!({"threadId": thread_id}),
    )
    .await;
    assert_eq!(turns["result"]["data"][0]["status"], "interrupted");

    let mut outbound = restarted.subscribe_outbound_messages();
    let started = request(
        &restarted,
        7,
        "turn/start",
        json!({
            "threadId": thread_id,
            "input": [{"type": "text", "text": "continue after restart"}]
        }),
    )
    .await;
    let turn_id = started["result"]["turn"]["id"]
        .as_str()
        .expect("new turn id");
    wait_for_turn_completed(&mut outbound, &thread_id, turn_id).await;

    let after_completion = request(&restarted, 8, METHOD_THREAD_READ, read_params).await;
    assert_eq!(
        after_completion["result"]["thread"]["status"]["type"],
        "idle"
    );
    let after_turns = after_completion["result"]["thread"]["turns"]
        .as_array()
        .expect("history after new turn");
    assert_eq!(
        after_turns
            .iter()
            .find(|turn| turn["id"] == "orphan-turn")
            .unwrap()["status"],
        "interrupted"
    );
    assert_eq!(
        after_turns
            .iter()
            .find(|turn| turn["id"] == turn_id)
            .unwrap()["status"],
        "completed"
    );
}

#[tokio::test]
async fn cold_regular_thread_resume_admits_a_new_turn_after_an_orphan() {
    let temp = TempDir::new().expect("regular thread restart temp dir");
    let projection_path = temp.path().join("projection.sqlite");
    let store = Arc::new(ProjectionStore::initialize(&projection_path).unwrap());
    let writer = Arc::new(EventLogWriter::new(temp.path().join("event-log")).unwrap());
    let initial = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend))
            .with_projection_store(store.clone())
            .with_event_log_writer(writer.clone()),
    );
    initialize(&initial).await;
    let thread_id = start_thread(&initial, 2).await;
    let sequence = writer
        .read_session_events(&thread_id)
        .unwrap()
        .last()
        .map_or(0, |record| record.event.sequence);
    let events = ["turn.accepted", "turn.started"]
        .into_iter()
        .enumerate()
        .map(|(index, event_type)| app_server_protocol::AgentEvent {
            event_id: format!("pre-crash-{index}"),
            sequence: sequence + index as u64 + 1,
            session_id: thread_id.clone(),
            thread_id: Some(thread_id.clone()),
            turn_id: Some("orphan-turn".to_string()),
            event_type: event_type.to_string(),
            timestamp: "2026-10-18T00:00:00Z".to_string(),
            payload: json!({}),
        })
        .collect::<Vec<_>>();
    writer.append_events(&events).unwrap();
    store.apply_events(&events).unwrap();
    drop(initial);
    drop(store);

    let restarted = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend))
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(&projection_path).unwrap(),
            ))
            .with_event_log_writer(writer),
    );
    initialize(&restarted).await;
    let resumed = request(
        &restarted,
        3,
        METHOD_THREAD_RESUME,
        json!({"threadId": thread_id}),
    )
    .await;
    assert_eq!(resumed["result"]["thread"]["status"]["type"], "idle");
    assert_eq!(
        resumed["result"]["thread"]["turns"][0]["status"],
        "interrupted"
    );
    let mut outbound = restarted.subscribe_outbound_messages();
    let started = request(
        &restarted,
        4,
        "turn/start",
        json!({
            "threadId": thread_id,
            "input": [{"type": "text", "text": "continue after restart"}]
        }),
    )
    .await;
    let turn_id = started["result"]["turn"]["id"]
        .as_str()
        .expect("new turn id");
    assert_ne!(turn_id, "orphan-turn");
    wait_for_turn_completed(&mut outbound, &thread_id, turn_id).await;
    let after = request(
        &restarted,
        5,
        METHOD_THREAD_READ,
        json!({"threadId": thread_id, "includeTurns": true}),
    )
    .await;
    assert_eq!(after["result"]["thread"]["status"]["type"], "idle");
    let turns = after["result"]["thread"]["turns"].as_array().unwrap();
    assert_eq!(
        turns
            .iter()
            .find(|turn| turn["id"] == "orphan-turn")
            .unwrap()["status"],
        "interrupted"
    );
    assert_eq!(
        turns.iter().find(|turn| turn["id"] == turn_id).unwrap()["status"],
        "completed"
    );
}

async fn wait_for_turn_completed(
    outbound: &mut tokio::sync::broadcast::Receiver<app_server::JsonRpcMessage>,
    thread_id: &str,
    turn_id: &str,
) {
    tokio::time::timeout(std::time::Duration::from_secs(3), async {
        loop {
            let app_server::JsonRpcMessage::Notification(notification) =
                outbound.recv().await.expect("new turn lifecycle")
            else {
                continue;
            };
            let notification = serde_json::to_value(notification).unwrap();
            if notification["method"] == "turn/completed"
                && notification["params"]["threadId"] == thread_id
                && notification["params"]["turn"]["id"] == turn_id
            {
                assert_eq!(notification["params"]["turn"]["status"], "completed");
                break;
            }
        }
    })
    .await
    .expect("new turn must complete through the public lifecycle");
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        METHOD_INITIALIZE,
        json!({"clientInfo": {"name": "thread-loaded-list-test", "version": "1"}}),
    )
    .await;
    server
        .handle_json_line(
            &json!({"jsonrpc": "2.0", "method": METHOD_INITIALIZED, "params": {}}).to_string(),
        )
        .await
        .expect("initialized notification");
}

async fn start_thread(server: &AppServer, id: u64) -> String {
    let response = request(
        server,
        id,
        METHOD_THREAD_START,
        json!({"model": "fixture-model", "modelProvider": "fixture-provider"}),
    )
    .await;
    let thread_id = response["result"]["thread"]["id"]
        .as_str()
        .expect("thread id")
        .to_string();
    assert_eq!(response["result"]["thread"]["sessionId"], json!(thread_id));
    assert_eq!(
        Uuid::parse_str(&thread_id)
            .expect("thread id UUID")
            .get_version_num(),
        7
    );
    thread_id
}

async fn request(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let response = request_raw(server, id, method, params).await;
    assert!(
        response.get("error").is_none(),
        "request failed: {response:#}"
    );
    response
}

async fn request_raw(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    server
        .handle_json_line(
            &json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params}).to_string(),
        )
        .await
        .expect("JSON-RPC request")
        .iter()
        .filter_map(|message| serde_json::from_str::<Value>(message).ok())
        .find(|message| message.get("id") == Some(&json!(id)))
        .expect("JSON-RPC response")
}
