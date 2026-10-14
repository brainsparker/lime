use super::*;
use app_server_protocol::{
    METHOD_THREAD_ITEMS_LIST, METHOD_THREAD_LIST, METHOD_THREAD_READ, METHOD_THREAD_TURNS_LIST,
};

#[tokio::test]
async fn pending_queue_is_not_public_history_or_activity_until_admission() {
    let temp = TempDir::new().unwrap();
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let backend = HoldFirstBackend::new();
    let mut client = TransportClient::start(
        AppServer::with_runtime(
            RuntimeCore::with_backend(backend.clone()).with_projection_store(store),
        ),
        "queue-history-public",
        true,
    )
    .await;
    let thread = start_thread(&mut client, 2).await;
    let active = start_turn(&mut client, 3, &thread, "execution-history-only").await;
    backend.wait_for_first_start().await;
    let queued = client
        .request_ok(
            4,
            METHOD_THREAD_QUEUE_ADD,
            json!({
                "threadId": thread,
                "input": [{"type": "text", "text": "not-yet-executing"}],
                "clientUserMessageId": "pending-client",
            }),
        )
        .await;
    let queue_id = required_string(&queued, "/result/queuedSubmission/id", "queue id");
    let live = client
        .request_ok(
            5,
            METHOD_THREAD_READ,
            json!({"threadId": thread, "includeTurns": true}),
        )
        .await;
    assert_eq!(live["result"]["thread"]["status"]["type"], "active");
    assert_eq!(
        live["result"]["thread"]["turns"].as_array().unwrap().len(),
        1
    );
    assert_eq!(live["result"]["thread"]["turns"][0]["id"], active);
    assert!(!live.to_string().contains("not-yet-executing"));

    client
        .request_ok(
            6,
            METHOD_TURN_INTERRUPT,
            json!({"threadId": thread, "turnId": active}),
        )
        .await;
    let interrupted = client.take_notification(METHOD_TURN_COMPLETED).await;
    assert_eq!(interrupted["params"]["turn"]["status"], "interrupted");
    for (id, method, params) in [
        (
            7,
            METHOD_THREAD_READ,
            json!({"threadId": thread, "includeTurns": true}),
        ),
        (8, METHOD_THREAD_RESUME, json!({"threadId": thread})),
    ] {
        let response = client.request_ok(id, method, params).await;
        assert_eq!(
            response["result"]["thread"]["status"]["type"], "idle",
            "{method}: {response}"
        );
        assert_eq!(
            response["result"]["thread"]["turns"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert!(!response.to_string().contains("not-yet-executing"));
    }
    let listed = client.request_ok(9, METHOD_THREAD_LIST, json!({})).await;
    assert_eq!(listed["result"]["data"][0]["status"]["type"], "idle");
    let turns = client
        .request_ok(
            10,
            METHOD_THREAD_TURNS_LIST,
            json!({
                "threadId": thread, "limit": 1, "sortDirection": "desc", "itemsView": "full",
            }),
        )
        .await;
    assert_eq!(turns["result"]["data"][0]["id"], active);
    assert_eq!(turns["result"]["nextCursor"], Value::Null);
    let items = client
        .request_ok(
            11,
            METHOD_THREAD_ITEMS_LIST,
            json!({
                "threadId": thread, "turnId": queue_id, "limit": 1,
            }),
        )
        .await;
    assert_eq!(
        items["result"],
        json!({"data": [], "nextCursor": null, "backwardsCursor": null})
    );
    let queue = client
        .request_ok(12, METHOD_THREAD_QUEUE_LIST, json!({"threadId": thread}))
        .await;
    assert_eq!(queue["result"]["data"].as_array().unwrap().len(), 1);
    assert_eq!(queue["result"]["data"][0]["id"], queue_id);
    assert_eq!(
        queue["result"]["data"][0]["input"][0]["text"],
        "not-yet-executing"
    );
    let started = client
        .request_ok(
            13,
            METHOD_THREAD_QUEUE_START,
            json!({
                "threadId": thread, "queuedSubmissionId": queue_id,
            }),
        )
        .await;
    assert_eq!(started["result"]["turn"]["id"], queue_id);
    backend.wait_for_start_count(2).await;
    let admitted = client
        .request_ok(
            14,
            METHOD_THREAD_READ,
            json!({"threadId": thread, "includeTurns": true}),
        )
        .await;
    assert_eq!(admitted["result"]["thread"]["status"]["type"], "active");
    let visible = admitted["result"]["thread"]["turns"].as_array().unwrap();
    assert_eq!(visible.len(), 2);
    assert_eq!(visible[1]["id"], queue_id);
    assert_eq!(visible[1]["status"], "inProgress");
    assert!(visible[1]["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["type"] == "userMessage"
            && item["clientId"] == "pending-client"
            && item["content"][0]["text"] == "not-yet-executing"));
    client.shutdown().await;
}
