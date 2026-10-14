use super::*;
use app_server_protocol::protocol::v2::{METHOD_THREAD_SEARCH, METHOD_THREAD_SEARCH_OCCURRENCES};
use app_server_protocol::METHOD_THREAD_READ;

#[tokio::test]
async fn pending_queue_search_excludes_input_and_normalizes_execution_activity() {
    let temp = TempDir::new().unwrap();
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let backend = HoldFirstBackend::new();
    let mut client = TransportClient::start(
        AppServer::with_runtime(
            RuntimeCore::with_backend(backend.clone()).with_projection_store(store),
        ),
        "queue-search-public",
        true,
    )
    .await;
    let thread = start_thread(&mut client, 2).await;
    let active = start_turn(&mut client, 3, &thread, "executed-sharedneedle").await;
    backend.wait_for_first_start().await;
    let before = client
        .request_ok(
            4,
            METHOD_THREAD_SEARCH,
            json!({"searchTerm": "sharedneedle", "sourceKinds": ["appServer"]}),
        )
        .await;
    assert_eq!(
        before["result"]["data"].as_array().unwrap().len(),
        1,
        "{before}"
    );
    assert_eq!(
        before["result"]["data"][0]["thread"]["status"]["type"],
        "active"
    );
    client
        .request_ok(
            5,
            METHOD_TURN_INTERRUPT,
            json!({"threadId": thread, "turnId": active}),
        )
        .await;
    let done = client.take_notification(METHOD_TURN_COMPLETED).await;
    assert_eq!(done["params"]["turn"]["status"], "interrupted");
    let queued = client.request_ok(6, METHOD_THREAD_QUEUE_ADD, json!({
        "threadId": thread, "input": [{"type": "text", "text": "pending-secret sharedneedle"}],
        "clientUserMessageId": "pending-search-client",
    })).await;
    let queue_id = required_string(&queued, "/result/queuedSubmission/id", "queue id");
    for (id, method, params) in [
        (
            7,
            METHOD_THREAD_SEARCH,
            json!({"searchTerm": "pending-secret", "sourceKinds": ["appServer"]}),
        ),
        (
            8,
            METHOD_THREAD_SEARCH_OCCURRENCES,
            json!({"threadId": thread, "searchTerm": "pending-secret"}),
        ),
    ] {
        let hidden = client.request_ok(id, method, params).await;
        assert!(hidden["result"]["data"].as_array().unwrap().is_empty());
        assert_eq!(hidden["result"]["nextCursor"], Value::Null);
    }
    let read = client
        .request_ok(9, METHOD_THREAD_READ, json!({"threadId": thread}))
        .await;
    let mixed = client
        .request_ok(
            10,
            METHOD_THREAD_SEARCH,
            json!({"searchTerm": "sharedneedle", "sourceKinds": ["appServer"]}),
        )
        .await;
    assert_eq!(
        mixed["result"]["data"][0]["snippet"],
        "executed-sharedneedle"
    );
    assert_eq!(
        mixed["result"]["data"][0]["thread"]["status"],
        read["result"]["thread"]["status"]
    );
    assert_eq!(
        mixed["result"]["data"][0]["thread"]["status"]["type"],
        "idle"
    );
    let hits = client
        .request_ok(
            11,
            METHOD_THREAD_SEARCH_OCCURRENCES,
            json!({
                "threadId": thread, "searchTerm": "sharedneedle", "limit": 1,
            }),
        )
        .await;
    assert_eq!(hits["result"]["data"].as_array().unwrap().len(), 1);
    assert_eq!(hits["result"]["data"][0]["turnId"], active);
    assert_eq!(hits["result"]["nextCursor"], Value::Null);
    client
        .request_ok(
            12,
            METHOD_THREAD_QUEUE_START,
            json!({"threadId": thread, "queuedSubmissionId": queue_id}),
        )
        .await;
    backend.wait_for_start_count(2).await;
    let admitted = client
        .request_ok(
            13,
            METHOD_THREAD_SEARCH,
            json!({"searchTerm": "pending-secret", "sourceKinds": ["appServer"]}),
        )
        .await;
    assert_eq!(admitted["result"]["data"].as_array().unwrap().len(), 1);
    assert_eq!(
        admitted["result"]["data"][0]["snippet"],
        "pending-secret sharedneedle"
    );
    assert_eq!(
        admitted["result"]["data"][0]["thread"]["status"]["type"],
        "active"
    );
    let hit = client
        .request_ok(
            14,
            METHOD_THREAD_SEARCH_OCCURRENCES,
            json!({"threadId": thread, "searchTerm": "pending-secret"}),
        )
        .await;
    assert_eq!(hit["result"]["data"][0]["turnId"], queue_id);
    client.shutdown().await;
}
