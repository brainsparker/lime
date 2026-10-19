use super::*;

struct Fixture {
    _temp: TempDir,
    log: Arc<EventLogWriter>,
    store: Arc<ProjectionStore>,
    backend: Arc<BoundaryBackend>,
    runtime: RuntimeCore,
    server: AppServer,
    thread: String,
    session: String,
}

impl Fixture {
    async fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let log = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
        let store =
            Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
        let backend = Arc::new(BoundaryBackend {
            event_log: log.clone(),
            // This fixture appends session checkpoints only after a completed Turn.
            calls: AtomicUsize::new(1),
            histories: Mutex::new(Vec::new()),
            with_suffix: false,
            conflicting_artifact: false,
        });
        let runtime = RuntimeCore::with_backend(backend.clone())
            .with_event_log_writer(log.clone())
            .with_projection_store(store.clone());
        let server = AppServer::with_runtime(runtime.clone());
        initialize(&server).await;
        let started = request(
            &server,
            2,
            METHOD_THREAD_START,
            json!({
                "cwd": temp.path(), "modelProvider": "fixture-provider", "model": "fixture-model",
            }),
        )
        .await;
        let thread = required_string(&started, "/result/thread/id");
        let session = required_string(&started, "/result/thread/sessionId");
        Self {
            _temp: temp,
            log,
            store,
            backend,
            runtime,
            server,
            thread,
            session,
        }
    }

    async fn turn(&self, text: &str, count: usize) -> String {
        start_turn(&self.server, &self.thread, text).await;
        let read = wait_for_turns(&self.server, &self.thread, count).await;
        required_string(&read, &format!("/result/thread/turns/{}/id", count - 1))
    }

    fn checkpoint(&self, text: &str, corrupt: Option<&str>) {
        let covered = durable_events(&self.log, &self.session)
            .last()
            .unwrap()
            .sequence;
        let window = uuid::Uuid::now_v7().to_string();
        let lineage = json!({
            "schema": "session_context_compaction.v3", "compactionId": window,
            "coveredThroughSequence": covered,
            "replacementHistory": [{"role": "user", "content": text}],
            "windowNumber": 1, "firstWindowId": window, "previousWindowId": null, "windowId": window,
        });
        let mut payload = lineage.clone();
        payload["artifact"] = lineage;
        match corrupt {
            Some("conflict") => payload["artifact"]["coveredThroughSequence"] = json!(covered + 1),
            Some("missing-boundary") => {
                payload["coveredThroughSequence"] = json!(covered + 100);
                payload["artifact"]["coveredThroughSequence"] = json!(covered + 100);
            }
            Some("invalid-history") => {
                payload["replacementHistory"] = json!([{"role": "system", "content": text}]);
                payload["artifact"]["replacementHistory"] = payload["replacementHistory"].clone();
            }
            None => {}
            _ => panic!("unknown corruption"),
        }
        self.runtime
            .append_external_runtime_events(
                &self.session,
                None,
                vec![RuntimeEvent::new("context.compaction.completed", payload)],
            )
            .unwrap();
    }

    fn cold_server(&self) -> AppServer {
        AppServer::with_runtime(
            RuntimeCore::with_backend(self.backend.clone())
                .with_event_log_writer(self.log.clone())
                .with_projection_store(self.store.clone()),
        )
    }
}

#[tokio::test]
async fn session_checkpoints_survive_full_and_prefix_forks_and_cold_reforks() {
    let fixture = Fixture::new().await;
    let first = fixture.turn("first input", 1).await;
    fixture.checkpoint("first summary", None);
    let second = fixture.turn("second input", 2).await;
    fixture.checkpoint("second summary", None);
    let original = durable_events(&fixture.log, &fixture.session);
    let cases = [
        (json!({}), "second summary"),
        (json!({"lastTurnId": first}), "first summary"),
        (json!({"beforeTurnId": second}), "first summary"),
        (json!({"beforeTurnId": first}), ""),
        (json!({"lastTurnId": second}), "second summary"),
    ];
    for (mut params, summary) in cases {
        params["threadId"] = json!(fixture.thread);
        let fork = request(&fixture.server, 3, METHOD_THREAD_FORK, params.clone()).await;
        let thread = required_string(&fork, "/result/thread/id");
        let session = required_string(&fork, "/result/thread/sessionId");
        let before = durable_events(&fixture.log, &session);
        let cold = fixture.cold_server();
        initialize(&cold).await;
        request(&cold, 4, METHOD_THREAD_RESUME, json!({"threadId": thread})).await;
        let refork = request(&cold, 5, METHOD_THREAD_FORK, json!({"threadId": thread})).await;
        let next_thread = required_string(&refork, "/result/thread/id");
        let next_session = required_string(&refork, "/result/thread/sessionId");
        let next_before = durable_events(&fixture.log, &next_session);
        drop(cold);
        let cold = fixture.cold_server();
        initialize(&cold).await;
        let expected = if summary.is_empty() {
            Vec::new()
        } else {
            vec![text_message(CurrentProviderRole::User, summary)]
        };
        for (target, log_session, frozen) in [
            (&thread, &session, &before),
            (&next_thread, &next_session, &next_before),
        ] {
            let resumed =
                request(&cold, 6, METHOD_THREAD_RESUME, json!({"threadId": target})).await;
            let turns = resumed["result"]["thread"]["turns"]
                .as_array()
                .unwrap()
                .len();
            assert_eq!(
                &durable_events(&fixture.log, log_session),
                frozen,
                "cold resume preserves source log"
            );
            start_turn(&cold, target, "next input").await;
            wait_for_turns(&cold, target, turns + 1).await;
            assert_eq!(
                fixture.backend.histories.lock().unwrap().last().unwrap(),
                &expected,
                "fork snapshot: {params}"
            );
            assert!(durable_events(&fixture.log, log_session).starts_with(frozen));
        }
        assert_eq!(durable_events(&fixture.log, &fixture.session), original);
    }
}

#[tokio::test]
async fn invalid_session_checkpoint_is_rejected_before_child_creation_but_not_before_its_cut() {
    for corruption in ["conflict", "missing-boundary", "invalid-history"] {
        let fixture = Fixture::new().await;
        let first = fixture.turn("first input", 1).await;
        fixture.checkpoint("valid prefix", None);
        let second = fixture.turn("second input", 2).await;
        fixture.checkpoint("invalid later summary", Some(corruption));
        let original = durable_events(&fixture.log, &fixture.session);
        let response = raw_request(
            &fixture.server,
            3,
            METHOD_THREAD_FORK,
            json!({"threadId": fixture.thread}),
        )
        .await;
        assert!(
            response.get("error").is_some(),
            "must reject {corruption}: {response}"
        );
        let listed = request(
            &fixture.server,
            4,
            app_server_protocol::METHOD_THREAD_LIST,
            json!({}),
        )
        .await;
        assert_eq!(
            listed["result"]["data"].as_array().unwrap().len(),
            1,
            "no rejected child"
        );
        for prefix in [
            json!({"lastTurnId": first}),
            json!({"beforeTurnId": second}),
        ] {
            let mut params = prefix;
            params["threadId"] = json!(fixture.thread);
            let fork = request(&fixture.server, 5, METHOD_THREAD_FORK, params).await;
            let thread = required_string(&fork, "/result/thread/id");
            start_turn(&fixture.server, &thread, "next input").await;
            wait_for_turns(&fixture.server, &thread, 2).await;
            assert_eq!(
                fixture.backend.histories.lock().unwrap().last().unwrap(),
                &vec![text_message(CurrentProviderRole::User, "valid prefix")]
            );
        }
        assert_eq!(durable_events(&fixture.log, &fixture.session), original);
    }
}
