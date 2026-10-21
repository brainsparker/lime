use super::*;
use app_server_protocol::protocol::v2::{
    METHOD_THREAD_ARCHIVE, METHOD_THREAD_METADATA_UPDATE, METHOD_THREAD_UNARCHIVE,
};
use std::path::{Path, PathBuf};

fn compressed(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.zst", path.display()))
}

fn compress(path: &Path, keep_plain: bool) {
    std::fs::write(
        compressed(path),
        zstd::stream::encode_all(std::fs::read(path).unwrap().as_slice(), 3).unwrap(),
    )
    .unwrap();
    if !keep_plain {
        std::fs::remove_file(path).unwrap();
    }
}

async fn seed(source: &TempDir, workspace: &TempDir) -> (String, PathBuf) {
    let server =
        AppServer::with_runtime(runtime(source, Arc::new(HistoryCaptureBackend::default())));
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
        json!([{"type":"text","text":"compressed original input"}]),
    )
    .await;
    let relative: String = Connection::open(source.path().join("projection.sqlite"))
        .unwrap()
        .query_row(
            "SELECT rollout_path FROM canonical_threads WHERE thread_id=?1",
            [&id],
            |row| row.get(0),
        )
        .unwrap();
    (id, PathBuf::from(relative))
}

#[tokio::test]
async fn compressed_only_original_thread_discovers_resumes_appends_and_restarts() {
    let source = TempDir::new().unwrap();
    let target = TempDir::new().unwrap();
    let workspace = TempDir::new().unwrap();
    let (id, relative) = seed(&source, &workspace).await;
    let path = target.path().join("agent").join(&relative);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    copy_rollout(&source, &id, &path);
    compress(&path, false);
    source.close().unwrap();

    let capture = Arc::new(HistoryCaptureBackend::default());
    let server = AppServer::with_runtime(runtime(&target, capture.clone()));
    initialize(&server, 3).await;
    let list = request(&server, 4, METHOD_THREAD_LIST, json!({})).await;
    assert_eq!(
        list["result"]["data"].as_array().unwrap().len(),
        1,
        "{list}"
    );
    assert_eq!(list["result"]["data"][0]["id"], id);
    let read = request(
        &server,
        5,
        METHOD_THREAD_READ,
        json!({"threadId":id,"includeTurns":true}),
    )
    .await;
    assert_eq!(
        read["result"]["thread"]["turns"].as_array().unwrap().len(),
        1
    );
    assert!(!path.exists(), "discovery and read must remain streaming");
    let stored: String = Connection::open(target.path().join("projection.sqlite"))
        .unwrap()
        .query_row(
            "SELECT rollout_path FROM canonical_threads WHERE thread_id=?1",
            [&id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        PathBuf::from(stored),
        relative,
        "index keeps the plain logical path"
    );
    request(&server, 6, METHOD_THREAD_RESUME, json!({"threadId":id})).await;
    start_and_complete(
        &server,
        &id,
        json!([{"type":"text","text":"after compressed restart"}]),
    )
    .await;
    assert!(path.exists());
    assert!(!compressed(&path).exists());
    {
        let histories = capture.histories.lock().unwrap();
        let history = serde_json::to_string(&histories[0]).unwrap();
        assert_eq!(
            history.matches("compressed original input").count(),
            1,
            "{history}"
        );
        assert_eq!(
            history.matches("source assistant answer").count(),
            1,
            "{history}"
        );
        assert_eq!(
            history.matches("source tool output").count(),
            1,
            "{history}"
        );
    }
    drop(server);
    compress(&path, true); // Hidden older compressed sibling must not duplicate discovery.
    let server = AppServer::with_runtime(runtime(&target, capture.clone()));
    initialize(&server, 7).await;
    request(&server, 8, METHOD_THREAD_RESUME, json!({"threadId":id})).await;
    start_and_complete(
        &server,
        &id,
        json!([{"type":"text","text":"second cold continuation"}]),
    )
    .await;
    {
        let histories = capture.histories.lock().unwrap();
        let history = serde_json::to_string(&histories[1]).unwrap();
        assert_eq!(
            history.matches("after compressed restart").count(),
            1,
            "{history}"
        );
    }
    let read = request(
        &server,
        9,
        METHOD_THREAD_READ,
        json!({"threadId":id,"includeTurns":true}),
    )
    .await;
    assert_eq!(
        read["result"]["thread"]["turns"].as_array().unwrap().len(),
        3,
        "{read}"
    );
}

#[tokio::test]
async fn compressed_archived_original_updates_restores_and_stays_deleted_after_reindex() {
    let source = TempDir::new().unwrap();
    let target = TempDir::new().unwrap();
    let workspace = TempDir::new().unwrap();
    let (id, relative) = seed(&source, &workspace).await;
    let path = target.path().join("agent").join(&relative);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    copy_rollout(&source, &id, &path);
    let capture = Arc::new(HistoryCaptureBackend::default());
    let server = AppServer::with_runtime(runtime(&target, capture.clone()));
    initialize(&server, 3).await;
    compress(&path, true);
    request(&server, 4, METHOD_THREAD_ARCHIVE, json!({"threadId":id})).await;
    assert!(!path.exists());
    assert!(!compressed(&path).exists());
    let archived = target
        .path()
        .join("agent/archived_sessions")
        .join(path.file_name().unwrap());
    compress(&archived, false);
    drop(server);
    source.close().unwrap();

    // A different, empty index must discover archived compressed history by itself.
    let core = RuntimeCore::with_backend(capture.clone()).with_projection_store(Arc::new(
        ProjectionStore::initialize_with_agent_root(
            target.path().join("rebuilt.sqlite"),
            target.path().join("agent"),
        )
        .unwrap(),
    ));
    let server = AppServer::with_runtime(core);
    initialize(&server, 5).await;
    let list = request(&server, 6, METHOD_THREAD_LIST, json!({"archived":true})).await;
    assert_eq!(
        list["result"]["data"].as_array().unwrap().len(),
        1,
        "{list}"
    );
    assert_eq!(list["result"]["data"][0]["id"], id);
    assert!(!archived.exists());
    request(
        &server,
        7,
        METHOD_THREAD_METADATA_UPDATE,
        json!({"threadId":id,"gitInfo":{"branch":"compressed-branch"}}),
    )
    .await;
    assert!(archived.exists());
    compress(&archived, false);
    request(&server, 8, METHOD_THREAD_UNARCHIVE, json!({"threadId":id})).await;
    let read = request(
        &server,
        9,
        METHOD_THREAD_READ,
        json!({"threadId":id,"includeTurns":true}),
    )
    .await;
    assert_eq!(
        read["result"]["thread"]["gitInfo"]["branch"],
        "compressed-branch"
    );
    assert_eq!(
        read["result"]["thread"]["turns"].as_array().unwrap().len(),
        1
    );
    compress(&path, false);
    request(&server, 10, METHOD_THREAD_DELETE, json!({"threadId":id})).await;
    drop(server);
    assert!(!path.exists());
    assert!(!compressed(&path).exists());
    assert!(!compressed(&archived).exists());
    let core = RuntimeCore::with_backend(capture).with_projection_store(Arc::new(
        ProjectionStore::initialize_with_agent_root(
            target.path().join("after-delete.sqlite"),
            target.path().join("agent"),
        )
        .unwrap(),
    ));
    let server = AppServer::with_runtime(core);
    initialize(&server, 11).await;
    for archived in [false, true] {
        let list = request(
            &server,
            12,
            METHOD_THREAD_LIST,
            json!({"archived":archived}),
        )
        .await;
        assert_eq!(list["result"]["data"], json!([]), "{list}");
    }
}
