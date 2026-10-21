use super::*;

#[tokio::test]
async fn standalone_inflight_thread_can_resume_and_accept_a_new_turn() {
    let source = TempDir::new().unwrap();
    let target = TempDir::new().unwrap();
    let workspace = TempDir::new().unwrap();
    let root = source.path().join("agent");
    let db = source.path().join("projection.sqlite");
    let backend = Arc::new(ForkBackend::new());
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(backend.clone()).with_projection_store(Arc::new(
            ProjectionStore::initialize_with_agent_root(&db, &root).unwrap(),
        )),
    );
    initialize(&server, 1).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "cwd":workspace.path(), "model":"fixture-model", "modelProvider":"fixture-provider"
        }),
    )
    .await;
    let id = required_string(&started, "/result/thread/id");
    start_and_complete(
        &server,
        &id,
        json!([{"type":"text","text":"completed prefix"}]),
    )
    .await;
    let turn = request(
        &server,
        3,
        METHOD_TURN_START,
        json!({
            "threadId":id, "input":[{"type":"text","text":"unfinished prompt"}],
            "model":"fixture-model", "approvalPolicy":"never", "sandboxPolicy":"workspace-write"
        }),
    )
    .await;
    let turn_id = required_string(&turn, "/result/turn/id");
    timeout(Duration::from_secs(3), backend.explicit_started.notified())
        .await
        .unwrap();
    let relative: String = Connection::open(&db)
        .unwrap()
        .query_row(
            "SELECT rollout_path FROM canonical_threads WHERE thread_id=?1",
            [&id],
            |row| row.get(0),
        )
        .unwrap();
    let copied = target.path().join("agent").join(&relative);
    std::fs::create_dir_all(copied.parent().unwrap()).unwrap();
    std::fs::copy(root.join(relative), &copied).unwrap();
    // Clean up the live fixture after copying the exact interrupted/crash boundary.
    request(
        &server,
        4,
        app_server_protocol::METHOD_TURN_INTERRUPT,
        json!({"threadId":id,"turnId":turn_id}),
    )
    .await;
    drop(server);
    source.close().unwrap();

    let capture = Arc::new(HistoryCaptureBackend::default());
    let server = AppServer::with_runtime(runtime(&target, capture.clone()));
    initialize(&server, 5).await;
    request(&server, 6, METHOD_THREAD_RESUME, json!({"threadId":id})).await;
    let read = request(
        &server,
        7,
        METHOD_THREAD_READ,
        json!({"threadId":id,"includeTurns":true}),
    )
    .await;
    assert_eq!(
        read["result"]["thread"]["turns"][1]["status"], "interrupted",
        "{read}"
    );
    start_and_complete(&server, &id, json!([{"type":"text","text":"after crash"}])).await;
    let histories = capture.histories.lock().unwrap();
    let history = serde_json::to_string(&histories[0]).unwrap();
    assert_eq!(history.matches("completed prefix").count(), 1, "{history}");
    assert_eq!(history.matches("unfinished prompt").count(), 1, "{history}");
}
