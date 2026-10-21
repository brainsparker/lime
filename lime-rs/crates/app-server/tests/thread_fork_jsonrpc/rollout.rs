use super::*;
use ephemeral::{files, start_and_complete};

fn rollout_path(db: &std::path::Path, root: &std::path::Path, thread: &str) -> std::path::PathBuf {
    let path: String = Connection::open(db)
        .unwrap()
        .query_row(
            "SELECT rollout_path FROM canonical_threads WHERE thread_id=?1",
            [thread],
            |row| row.get(0),
        )
        .unwrap();
    root.join(path)
}

#[tokio::test]
async fn rollout_fork_reads_compressed_sibling_and_explicit_zstd_without_materializing_source() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().join("agent");
    let db = temp.path().join("projection.sqlite");
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(ImmediateBackend))
            .with_projection_store(Arc::new(
                ProjectionStore::initialize_with_agent_root(&db, &root).unwrap(),
            ))
            .with_event_log_writer(Arc::new(
                EventLogWriter::new(temp.path().join("events")).unwrap(),
            )),
    );
    initialize(&server, 1).await;
    let source = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"cwd":temp.path(),"model":"fixture-model","modelProvider":"fixture-provider"}),
    )
    .await;
    let source = required_string(&source, "/result/thread/id");
    start_and_complete(
        &server,
        &source,
        json!([{"type":"text","text":"compressed fork source"}]),
    )
    .await;
    let path = rollout_path(&db, &root, &source);
    let archived_copy = temp.path().join("source-plain.jsonl");
    let compressed = path.with_extension("jsonl.zst");
    let bytes = std::fs::read(&path).unwrap();
    std::fs::write(
        &compressed,
        zstd::stream::encode_all(bytes.as_slice(), 3).unwrap(),
    )
    .unwrap();
    std::fs::rename(&path, &archived_copy).unwrap();
    let before = files(temp.path());
    for requested in [&path, &compressed] {
        let fork = request(
            &server,
            3,
            METHOD_THREAD_FORK,
            json!({"threadId":"","path":requested,"ephemeral":true}),
        )
        .await;
        assert_eq!(fork["result"]["thread"]["forkedFromId"], source);
        assert!(fork["result"]["thread"]["turns"]
            .to_string()
            .contains("compressed fork source"));
    }
    assert!(!path.exists());
    assert_eq!(files(temp.path()), before);
    std::fs::write(&compressed, b"invalid-zstd").unwrap();
    let error = request_error(
        &server,
        4,
        METHOD_THREAD_FORK,
        json!({"threadId":source,"path":compressed}),
    )
    .await;
    assert_eq!(error["error"]["code"], error_codes::INVALID_REQUEST);
}

#[tokio::test]
async fn paginated_rollout_fork_rejects_a_stale_copy_but_accepts_current_path() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().join("agent");
    let db = temp.path().join("projection.sqlite");
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(ImmediateBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize_with_agent_root(&db, &root).unwrap(),
        )),
    );
    initialize(&server, 1).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"cwd":temp.path(),"historyMode":"paginated","model":"fixture-model","modelProvider":"fixture-provider"}),
    )
    .await;
    let source = required_string(&started, "/result/thread/id");
    let path = rollout_path(&db, &root, &source);
    let stale = temp.path().join("stale.jsonl");
    std::fs::copy(&path, &stale).unwrap();
    let error = request_error(
        &server,
        3,
        METHOD_THREAD_FORK,
        json!({"threadId":source,"path":stale,"ephemeral":true,"excludeTurns":true}),
    )
    .await;
    assert_eq!(error["error"]["code"], error_codes::INVALID_REQUEST);
    assert!(error["error"]["message"]
        .as_str()
        .unwrap()
        .contains("stale path"));
    let fork = request(
        &server,
        4,
        METHOD_THREAD_FORK,
        json!({"threadId":"ignored","path":path,"ephemeral":true,"excludeTurns":true}),
    )
    .await;
    assert_eq!(fork["result"]["thread"]["forkedFromId"], source);
}

#[tokio::test]
async fn rollout_fork_reads_relative_absolute_and_external_files_with_path_precedence() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().join("agent");
    let db = temp.path().join("projection.sqlite");
    let backend = Arc::new(HistoryCaptureBackend::default());
    let runtime = || {
        RuntimeCore::with_backend(backend.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize_with_agent_root(&db, &root).unwrap(),
            ))
            .with_event_log_writer(Arc::new(
                EventLogWriter::new(temp.path().join("events")).unwrap(),
            ))
    };
    let server = AppServer::with_runtime(runtime());
    initialize(&server, 1).await;
    let source = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"cwd":temp.path(),"model":"fixture-model","modelProvider":"fixture-provider"}),
    )
    .await;
    let source = required_string(&source, "/result/thread/id");
    start_and_complete(
        &server,
        &source,
        json!([{"type":"text","text":"source user prompt"}]),
    )
    .await;
    let original = request(
        &server,
        3,
        METHOD_THREAD_READ,
        json!({"threadId":source,"includeTurns":true}),
    )
    .await;
    let path = rollout_path(&db, &root, &source);
    let external = temp.path().join("copied-rollout.jsonl");
    std::fs::copy(&path, &external).unwrap();
    request(
        &server,
        4,
        "thread/settings/update",
        json!({
            "threadId":source,
            "model":"updated-model",
            "modelProvider":"updated-provider",
            "effort":"high"
        }),
    )
    .await;
    for requested in [
        path.strip_prefix(&root).unwrap().to_path_buf(),
        path.clone(),
        external.clone(),
    ] {
        let fork = request(
            &server,
            4,
            METHOD_THREAD_FORK,
            json!({"threadId":"ignored-invalid-id","path":requested}),
        )
        .await;
        assert_eq!(fork["result"]["thread"]["forkedFromId"], source);
        assert_eq!(fork["result"]["model"], "updated-model");
        assert_eq!(fork["result"]["modelProvider"], "updated-provider");
        assert_eq!(fork["result"]["reasoningEffort"], "high");
        assert_eq!(
            fork["result"]["thread"]["turns"],
            original["result"]["thread"]["turns"]
        );
    }
    // A copied self-contained canonical rollout also works without the source index.
    let destination = temp.path().join("destination");
    std::fs::create_dir(&destination).unwrap();
    let destination_server = AppServer::with_runtime(
        RuntimeCore::with_backend(backend.clone()).with_projection_store(Arc::new(
            ProjectionStore::initialize_with_agent_root(
                destination.join("projection.sqlite"),
                &destination,
            )
            .unwrap(),
        )),
    );
    initialize(&destination_server, 5).await;
    let fork = request(
        &destination_server,
        6,
        METHOD_THREAD_FORK,
        json!({"threadId":"","path":external,"ephemeral":true}),
    )
    .await;
    assert_eq!(fork["result"]["thread"]["forkedFromId"], source);
    assert_eq!(fork["result"]["model"], "fixture-model");
    assert_eq!(fork["result"]["modelProvider"], "fixture-provider");
    assert_eq!(
        fork["result"]["thread"]["turns"],
        original["result"]["thread"]["turns"]
    );
    let target = required_string(&fork, "/result/thread/id");
    start_and_complete(
        &destination_server,
        &target,
        json!([{"type":"text","text":"continue copied source"}]),
    )
    .await;
    let histories = backend.histories.lock().unwrap();
    let history = &histories[1];
    assert_eq!(history.len(), 4);
    assert!(
        matches!(&history[0].content[..], [CurrentProviderContent::Text(text)] if text == "source user prompt")
    );
    assert!(
        matches!(&history[2].content[..], [CurrentProviderContent::ToolResult(output)] if output.output == "source tool output")
    );
    assert!(
        matches!(&history[3].content[..], [CurrentProviderContent::Text(text)] if text == "source assistant answer")
    );
}

#[tokio::test]
async fn rollout_fork_rejects_missing_directory_and_corrupt_files_without_target_artifacts() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().join("agent");
    let db = temp.path().join("projection.sqlite");
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(ImmediateBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize_with_agent_root(&db, &root).unwrap(),
        )),
    );
    initialize(&server, 1).await;
    let source = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"cwd":temp.path(),"model":"fixture-model","modelProvider":"fixture-provider"}),
    )
    .await;
    let source = required_string(&source, "/result/thread/id");
    let path = rollout_path(&db, &root, &source);
    let corrupt = temp.path().join("corrupt.jsonl");
    std::fs::write(&corrupt, b"{not a rollout}\n").unwrap();
    let moved = temp.path().join("moved.jsonl");
    std::fs::rename(&path, &moved).unwrap();
    let before = files(temp.path());
    for requested in [path, root, corrupt] {
        let error = request_error(
            &server,
            3,
            METHOD_THREAD_FORK,
            json!({"threadId":source,"path":requested}),
        )
        .await;
        assert_eq!(
            error["error"]["code"],
            error_codes::INVALID_REQUEST,
            "{error}"
        );
    }
    assert_eq!(files(temp.path()), before);
    let count: i64 = Connection::open(db)
        .unwrap()
        .query_row("SELECT COUNT(*) FROM canonical_threads", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(count, 1);
}
