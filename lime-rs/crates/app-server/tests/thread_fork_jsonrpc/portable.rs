use super::*;
use ephemeral::start_and_complete;

#[path = "portable_compression.rs"]
mod compression;
#[path = "portable_restart.rs"]
mod restart;

fn runtime(home: &TempDir, backend: Arc<HistoryCaptureBackend>) -> RuntimeCore {
    RuntimeCore::with_backend(backend)
        .with_projection_store(Arc::new(
            ProjectionStore::initialize_with_agent_root(
                home.path().join("projection.sqlite"),
                home.path().join("agent"),
            )
            .unwrap(),
        ))
        .with_sidecar_store(Arc::new(
            SidecarStore::new(home.path().join("sidecar")).unwrap(),
        ))
}

fn copy_rollout(home: &TempDir, thread: &str, target: &std::path::Path) {
    let path: String = Connection::open(home.path().join("projection.sqlite"))
        .unwrap()
        .query_row(
            "SELECT rollout_path FROM canonical_threads WHERE thread_id=?1",
            [thread],
            |row| row.get(0),
        )
        .unwrap();
    std::fs::copy(home.path().join("agent").join(path), target).unwrap();
}

#[tokio::test]
async fn standalone_rollout_keeps_image_bytes_without_source_sidecar() {
    const PNG: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
    let source = TempDir::new().unwrap();
    let destination = TempDir::new().unwrap();
    let workspace = TempDir::new().unwrap();
    let backend = Arc::new(HistoryCaptureBackend::default());
    let server = AppServer::with_runtime(runtime(&source, backend.clone()));
    initialize(&server, 1).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "cwd":workspace.path(),"model":"fixture-model","modelProvider":"fixture-provider"
        }),
    )
    .await;
    let id = required_string(&started, "/result/thread/id");
    start_and_complete(
        &server,
        &id,
        json!([
            {"type":"text","text":"portable image"}, {"type":"image","url":PNG,"detail":"original"}
        ]),
    )
    .await;
    let file = destination.path().join("source.jsonl");
    copy_rollout(&source, &id, &file);
    drop(server);
    source.close().unwrap();
    for ephemeral in [true, false] {
        let server = AppServer::with_runtime(runtime(&destination, backend.clone()));
        initialize(&server, 3).await;
        let fork = request(
            &server,
            4,
            METHOD_THREAD_FORK,
            json!({"threadId":"","path":file,"ephemeral":ephemeral}),
        )
        .await;
        let target = required_string(&fork, "/result/thread/id");
        let server = if ephemeral {
            server
        } else {
            drop(server);
            let server = AppServer::with_runtime(runtime(&destination, backend.clone()));
            initialize(&server, 5).await;
            request(&server, 6, METHOD_THREAD_RESUME, json!({"threadId":target})).await;
            // Repeated resume must use the loaded runtime without merging a second history copy.
            request(&server, 7, METHOD_THREAD_RESUME, json!({"threadId":target})).await;
            server
        };
        start_and_complete(
            &server,
            &target,
            json!([{"type":"text","text":"continue image"}]),
        )
        .await;
        let histories = backend.histories.lock().unwrap();
        let image = &histories.last().unwrap()[0].content[1];
        assert!(
            matches!(image, CurrentProviderContent::Image { provider_data: Some(data), detail: Some(agent_protocol::ImageDetail::Original), .. } if data == PNG),
            "{image:?}"
        );
    }
}

#[tokio::test]
async fn standalone_session_checkpoint_retains_exact_surviving_tail_and_nested_cold_forks() {
    let source = TempDir::new().unwrap();
    let destination = TempDir::new().unwrap();
    let workspace = TempDir::new().unwrap();
    let backend = Arc::new(HistoryCaptureBackend::default());
    let core = runtime(&source, backend.clone());
    let inspect = core.clone();
    let server = AppServer::with_runtime(core);
    initialize(&server, 1).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "cwd":workspace.path(),"model":"fixture-model","modelProvider":"fixture-provider"
        }),
    )
    .await;
    let id = required_string(&started, "/result/thread/id");
    let session = required_string(&started, "/result/thread/sessionId");
    start_and_complete(
        &server,
        &id,
        json!([{"type":"text","text":"covered prefix"}]),
    )
    .await;
    let covered = inspect
        .events_for_session(&session)
        .unwrap()
        .last()
        .unwrap()
        .sequence;
    let lineage = json!({
        "compactionId":"portable-checkpoint", "coveredThroughSequence":covered,
        "replacementHistory":[{"type":"message","role":"user","content":[{"type":"input_text","text":"earlier compacted context"}]}],
        "windowNumber":1,"firstWindowId":uuid::Uuid::now_v7(),"previousWindowId":null,"windowId":uuid::Uuid::now_v7()
    });
    let mut payload = lineage.clone();
    payload["artifact"] = lineage;
    inspect
        .append_external_runtime_events(
            &session,
            None,
            vec![RuntimeEvent::new("context.compaction.completed", payload)],
        )
        .unwrap();
    start_and_complete(
        &server,
        &id,
        json!([{"type":"text","text":"surviving user tail"}]),
    )
    .await;
    let plain = destination.path().join("source.jsonl");
    copy_rollout(&source, &id, &plain);
    let compressed = destination.path().join("compressed.jsonl.zst");
    std::fs::write(
        &compressed,
        zstd::stream::encode_all(std::fs::read(&plain).unwrap().as_slice(), 3).unwrap(),
    )
    .unwrap();
    drop(server);
    drop(inspect);
    source.close().unwrap();
    for path in [&plain, &compressed] {
        let server = AppServer::with_runtime(runtime(&destination, backend.clone()));
        initialize(&server, 3).await;
        let fork = request(
            &server,
            4,
            METHOD_THREAD_FORK,
            json!({"threadId":"","path":path}),
        )
        .await;
        let mut target = required_string(&fork, "/result/thread/id");
        drop(server);
        // Two cold forks exercise the session-only checkpoint, which has no canonical Item.
        for _ in 0..2 {
            let server = AppServer::with_runtime(runtime(&destination, backend.clone()));
            initialize(&server, 5).await;
            request(&server, 6, METHOD_THREAD_RESUME, json!({"threadId":target})).await;
            let fork = request(&server, 7, METHOD_THREAD_FORK, json!({"threadId":target})).await;
            assert_eq!(fork["result"]["thread"]["forkedFromId"], target);
            target = required_string(&fork, "/result/thread/id");
        }
        let server = AppServer::with_runtime(runtime(&destination, backend.clone()));
        initialize(&server, 8).await;
        request(&server, 9, METHOD_THREAD_RESUME, json!({"threadId":target})).await;
        start_and_complete(
            &server,
            &target,
            json!([{"type":"text","text":"continue compacted fork"}]),
        )
        .await;
        let histories = backend.histories.lock().unwrap();
        let texts = histories
            .last()
            .unwrap()
            .iter()
            .flat_map(|message| &message.content)
            .map(|part| match part {
                CurrentProviderContent::Text(text) => text.as_str(),
                _ => panic!("unexpected history part: {part:?}"),
            })
            .collect::<Vec<_>>();
        assert_eq!(texts, ["earlier compacted context", "surviving user tail"]);
    }
}
