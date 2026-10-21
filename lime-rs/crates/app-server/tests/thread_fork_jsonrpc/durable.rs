use super::*;

#[tokio::test]
async fn thread_fork_preserves_paginated_history_boundary_across_restart() {
    const SOURCE_TITLE: &str = "Paginated fork source";

    let temp = TempDir::new().expect("paginated fork temp dir");
    let projection_path = temp.path().join("projection.sqlite");
    let runtime = || {
        RuntimeCore::with_backend(Arc::new(ImmediateBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize(&projection_path).expect("paginated fork store"),
        ))
    };
    let server = AppServer::with_runtime(runtime());
    initialize(&server, 1).await;

    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model": "fixture-model",
            "modelProvider": "fixture-provider",
            "cwd": temp.path(),
            "historyMode": "paginated",
            "serviceName": SOURCE_TITLE
        }),
    )
    .await;
    let source_thread_id = required_string(&started, "/result/thread/id");
    let source_session_id = required_string(&started, "/result/thread/sessionId");
    assert_eq!(
        started.pointer("/result/thread/name"),
        Some(&json!(SOURCE_TITLE))
    );
    for (id, text, expected_turns) in [
        (3, "first paginated turn", 1),
        (4, "second paginated turn", 2),
    ] {
        request(
            &server,
            id,
            METHOD_TURN_START,
            json!({
                "threadId": source_thread_id,
                "input": [{"type": "text", "text": text}],
                "model": "fixture-model",
                "approvalPolicy": "never",
                "sandboxPolicy": "workspace-write"
            }),
        )
        .await;
        wait_for_completed_turn_count(&server, &source_thread_id, expected_turns).await;
    }
    let source_turns = request(
        &server,
        5,
        METHOD_THREAD_TURNS_LIST,
        json!({"threadId": source_thread_id, "sortDirection": "asc"}),
    )
    .await;
    let first_turn_id = required_string(&source_turns, "/result/data/0/id");

    let forked = request(
        &server,
        6,
        METHOD_THREAD_FORK,
        json!({"threadId": source_thread_id, "lastTurnId": first_turn_id}),
    )
    .await;
    let target_thread_id = required_string(&forked, "/result/thread/id");
    let target_session_id = required_string(&forked, "/result/thread/sessionId");
    assert_ne!(target_thread_id, source_thread_id);
    assert_ne!(target_session_id, source_session_id);
    assert_eq!(
        forked.pointer("/result/thread/historyMode"),
        Some(&json!("paginated"))
    );
    assert_eq!(
        forked.pointer("/result/thread/forkedFromId"),
        Some(&json!(source_thread_id))
    );
    assert_eq!(
        forked.pointer("/result/thread/name"),
        Some(&json!(SOURCE_TITLE))
    );
    assert_eq!(turn_count(&forked), 1);

    let target_read = request(
        &server,
        7,
        METHOD_THREAD_READ,
        json!({"threadId": target_thread_id, "includeTurns": false}),
    )
    .await;
    assert_eq!(
        target_read.pointer("/result/thread/name"),
        Some(&json!(SOURCE_TITLE))
    );
    let listed = request(&server, 8, METHOD_THREAD_LIST, json!({"archived": false})).await;
    let listed_threads = listed["result"]["data"]
        .as_array()
        .expect("thread/list data");
    assert_eq!(
        listed_threads
            .iter()
            .filter(|thread| {
                thread["id"] == source_thread_id || thread["id"] == target_thread_id
            })
            .filter(|thread| thread["name"] == SOURCE_TITLE)
            .count(),
        2
    );

    let target_turns = request(
        &server,
        9,
        METHOD_THREAD_TURNS_LIST,
        json!({"threadId": target_thread_id, "sortDirection": "asc"}),
    )
    .await;
    assert_eq!(
        target_turns["result"]["data"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(
        target_turns.pointer("/result/data/0/id"),
        Some(&json!(first_turn_id))
    );
    drop(server);

    let restarted = AppServer::with_runtime(runtime());
    initialize(&restarted, 10).await;
    let resumed = request(
        &restarted,
        11,
        METHOD_THREAD_RESUME,
        json!({"threadId": target_thread_id, "excludeTurns": true}),
    )
    .await;
    assert_eq!(
        resumed.pointer("/result/thread/id"),
        Some(&json!(target_thread_id))
    );
    assert_eq!(
        resumed.pointer("/result/thread/forkedFromId"),
        Some(&json!(source_thread_id))
    );
    assert_eq!(
        resumed.pointer("/result/thread/name"),
        Some(&json!(SOURCE_TITLE))
    );
    let cold_turns = request(
        &restarted,
        12,
        METHOD_THREAD_TURNS_LIST,
        json!({"threadId": target_thread_id, "sortDirection": "asc"}),
    )
    .await;
    assert_eq!(
        cold_turns["result"]["data"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(
        cold_turns.pointer("/result/data/0/id"),
        Some(&json!(first_turn_id))
    );
    let cold_read = request(
        &restarted,
        13,
        METHOD_THREAD_READ,
        json!({"threadId": target_thread_id, "includeTurns": false}),
    )
    .await;
    assert_eq!(
        cold_read.pointer("/result/thread/name"),
        Some(&json!(SOURCE_TITLE))
    );
    let cold_listed = request(
        &restarted,
        14,
        METHOD_THREAD_LIST,
        json!({"archived": false}),
    )
    .await;
    assert_eq!(
        cold_listed["result"]["data"]
            .as_array()
            .expect("cold thread/list data")
            .iter()
            .filter(|thread| thread["name"] == SOURCE_TITLE)
            .count(),
        2
    );
}

#[tokio::test]
async fn thread_fork_defers_goal_across_restart_until_explicit_turn_admission() {
    let temp = TempDir::new().expect("thread fork temp dir");
    let projection_path = temp.path().join("projection.sqlite");
    let event_log_root = temp.path().join("event-log");
    let backend = Arc::new(ForkBackend::new());
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(backend.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(&projection_path).expect("thread fork store"),
            ))
            .with_event_log_writer(Arc::new(
                EventLogWriter::new(&event_log_root).expect("thread fork event log"),
            )),
    );
    initialize(&server, 1).await;

    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model": "fixture-model",
            "modelProvider": "fixture-provider",
            "cwd": temp.path()
        }),
    )
    .await;
    let source_thread_id = required_string(&started, "/result/thread/id");

    request(
        &server,
        3,
        METHOD_TURN_START,
        json!({
            "threadId": source_thread_id,
            "input": [{"type": "text", "text": "create fork history"}],
            "model": "fixture-model",
            "approvalPolicy": "never",
            "sandboxPolicy": "workspace-write"
        }),
    )
    .await;
    timeout(Duration::from_secs(3), backend.first_completed.notified())
        .await
        .expect("source turn should complete");
    wait_for_completed_turn(&server, &source_thread_id).await;

    request(
        &server,
        4,
        METHOD_THREAD_GOAL_SET,
        json!({
            "threadId": source_thread_id,
            "objective": "finish the forked goal",
            "tokenBudget": 500
        }),
    )
    .await;
    let forked = request(
        &server,
        5,
        METHOD_THREAD_FORK,
        json!({
            "threadId": source_thread_id,
            "deferGoalContinuation": true
        }),
    )
    .await;
    let target_thread_id = required_string(&forked, "/result/thread/id");
    assert_ne!(target_thread_id, source_thread_id);
    assert_eq!(
        forked.pointer("/result/thread/forkedFromId"),
        Some(&json!(source_thread_id))
    );
    assert_eq!(
        forked
            .pointer("/result/thread/turns")
            .and_then(Value::as_array)
            .map(Vec::len),
        Some(1)
    );
    assert_eq!(deferral_count(&projection_path, &target_thread_id), 1);

    let inherited_goal = request(
        &server,
        6,
        METHOD_THREAD_GOAL_GET,
        json!({"threadId": target_thread_id}),
    )
    .await;
    assert_eq!(
        inherited_goal.pointer("/result/goal/objective"),
        Some(&json!("finish the forked goal"))
    );
    drop(server);

    let restarted = AppServer::with_runtime(
        RuntimeCore::with_backend(backend.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(&projection_path).expect("reopen thread fork store"),
            ))
            .with_event_log_writer(Arc::new(
                EventLogWriter::new(&event_log_root).expect("reopen thread fork event log"),
            )),
    );
    initialize(&restarted, 10).await;
    request(
        &restarted,
        11,
        METHOD_THREAD_RESUME,
        json!({"threadId": target_thread_id}),
    )
    .await;
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert_eq!(backend.calls.load(Ordering::SeqCst), 1);
    assert_eq!(deferral_count(&projection_path, &target_thread_id), 1);

    request(
        &restarted,
        12,
        METHOD_TURN_START,
        json!({
            "threadId": target_thread_id,
            "input": [{"type": "text", "text": "explicit fork turn"}],
            "model": "fixture-model",
            "approvalPolicy": "never",
            "sandboxPolicy": "workspace-write"
        }),
    )
    .await;
    timeout(Duration::from_secs(3), backend.explicit_started.notified())
        .await
        .expect("explicit fork turn should start");
    assert_eq!(deferral_count(&projection_path, &target_thread_id), 0);

    request(
        &restarted,
        13,
        METHOD_THREAD_GOAL_SET,
        json!({"threadId": target_thread_id, "status": "paused"}),
    )
    .await;
    backend.release_explicit.notify_one();
}

#[tokio::test]
async fn thread_fork_preserves_boundaries_and_goal_deferral_lifecycle() {
    let temp = TempDir::new().expect("thread fork boundary temp dir");
    let projection_path = temp.path().join("projection.sqlite");
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(ImmediateBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize(&projection_path).expect("thread fork boundary store"),
        )),
    );
    initialize(&server, 100).await;

    let started = request(
        &server,
        101,
        METHOD_THREAD_START,
        json!({
            "model": "fixture-model",
            "modelProvider": "fixture-provider",
            "cwd": temp.path()
        }),
    )
    .await;
    let source_thread_id = required_string(&started, "/result/thread/id");
    for (id, text, expected_turns) in [
        (102, "first source turn", 1),
        (103, "second source turn", 2),
    ] {
        request(
            &server,
            id,
            METHOD_TURN_START,
            json!({
                "threadId": source_thread_id,
                "input": [{"type": "text", "text": text}],
                "model": "fixture-model",
                "approvalPolicy": "never",
                "sandboxPolicy": "workspace-write"
            }),
        )
        .await;
        wait_for_completed_turn_count(&server, &source_thread_id, expected_turns).await;
    }

    let source = request(
        &server,
        104,
        METHOD_THREAD_READ,
        json!({"threadId": source_thread_id, "includeTurns": true}),
    )
    .await;
    let first_turn_id = required_string(&source, "/result/thread/turns/0/id");

    let ordinary = request(
        &server,
        105,
        METHOD_THREAD_FORK,
        json!({"threadId": source_thread_id}),
    )
    .await;
    let ordinary_thread_id = required_string(&ordinary, "/result/thread/id");
    assert_eq!(turn_count(&ordinary), 2);
    assert_eq!(goal_count(&projection_path, &ordinary_thread_id), 0);
    assert_eq!(deferral_count(&projection_path, &ordinary_thread_id), 0);

    let last_turn = request(
        &server,
        106,
        METHOD_THREAD_FORK,
        json!({"threadId": source_thread_id, "lastTurnId": first_turn_id}),
    )
    .await;
    assert_eq!(turn_count(&last_turn), 1);

    let before_turn = request(
        &server,
        107,
        METHOD_THREAD_FORK,
        json!({"threadId": source_thread_id, "beforeTurnId": first_turn_id}),
    )
    .await;
    assert_eq!(turn_count(&before_turn), 0);

    let without_goal = request(
        &server,
        108,
        METHOD_THREAD_FORK,
        json!({
            "threadId": source_thread_id,
            "deferGoalContinuation": true
        }),
    )
    .await;
    let without_goal_thread_id = required_string(&without_goal, "/result/thread/id");
    assert_eq!(goal_count(&projection_path, &without_goal_thread_id), 0);
    assert_eq!(deferral_count(&projection_path, &without_goal_thread_id), 0);

    request(
        &server,
        109,
        METHOD_THREAD_GOAL_SET,
        json!({
            "threadId": source_thread_id,
            "objective": "preserve the paused source goal",
            "status": "paused",
            "tokenBudget": 500
        }),
    )
    .await;
    let deferred = request(
        &server,
        110,
        METHOD_THREAD_FORK,
        json!({
            "threadId": source_thread_id,
            "deferGoalContinuation": true
        }),
    )
    .await;
    let deferred_thread_id = required_string(&deferred, "/result/thread/id");
    let inherited_goal = request(
        &server,
        111,
        METHOD_THREAD_GOAL_GET,
        json!({"threadId": deferred_thread_id}),
    )
    .await;
    assert_eq!(
        inherited_goal.pointer("/result/goal/status"),
        Some(&json!("paused"))
    );
    assert_eq!(
        inherited_goal.pointer("/result/goal/objective"),
        Some(&json!("preserve the paused source goal"))
    );
    assert_eq!(deferral_count(&projection_path, &deferred_thread_id), 1);

    request(
        &server,
        112,
        METHOD_THREAD_DELETE,
        json!({"threadId": deferred_thread_id}),
    )
    .await;
    assert_eq!(goal_count(&projection_path, &deferred_thread_id), 0);
    assert_eq!(deferral_count(&projection_path, &deferred_thread_id), 0);

    for (id, params, expected_message) in [
        (
            113,
            json!({
                "threadId": source_thread_id,
                "lastTurnId": first_turn_id,
                "beforeTurnId": first_turn_id
            }),
            "thread/fork beforeTurnId cannot be combined with lastTurnId",
        ),
        (
            114,
            json!({
                "threadId": source_thread_id,
                "ephemeral": true,
                "deferGoalContinuation": true
            }),
            "thread/fork deferGoalContinuation cannot be combined with ephemeral",
        ),
    ] {
        let error = request_error(&server, id, METHOD_THREAD_FORK, params).await;
        assert_eq!(
            error.pointer("/error/message"),
            Some(&json!(expected_message))
        );
    }
}

#[tokio::test]
async fn thread_fork_rebuilds_provider_history_across_restarts_without_duplicate_prefix() {
    let temp = TempDir::new().expect("thread fork provider history temp dir");
    let projection_path = temp.path().join("projection.sqlite");
    let event_log_root = temp.path().join("event-log");
    let sidecar_root = temp.path().join("sidecar");
    let local_image_path = temp.path().join("local-input.png");
    std::fs::write(&local_image_path, b"\x89PNG\r\n\x1a\nfixture")
        .expect("write local image fixture");
    let source_input = json!([
        {
            "type": "text",
            "text": "source user prompt",
            "text_elements": [{
                "byteRange": {"start": 0, "end": 6},
                "placeholder": "source"
            }]
        },
        {
            "type": "image",
            "url": "https://example.com/remote.png",
            "detail": "high"
        },
        {
            "type": "localImage",
            "path": local_image_path,
            "detail": "original"
        },
        {
            "type": "skill",
            "name": "review",
            "path": "/skills/review/SKILL.md"
        },
        {
            "type": "mention",
            "name": "docs",
            "path": "app://docs"
        }
    ]);
    let backend = Arc::new(HistoryCaptureBackend::default());
    let runtime = || {
        RuntimeCore::with_backend(backend.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(&projection_path)
                    .expect("thread fork provider history store"),
            ))
            .with_event_log_writer(Arc::new(
                EventLogWriter::new(&event_log_root)
                    .expect("thread fork provider history event log"),
            ))
            .with_sidecar_store(Arc::new(
                SidecarStore::new(&sidecar_root).expect("thread fork sidecar store"),
            ))
    };

    let server = AppServer::with_runtime(runtime());
    initialize(&server, 300).await;
    let started = request(
        &server,
        301,
        METHOD_THREAD_START,
        json!({
            "model": "fixture-model",
            "modelProvider": "fixture-provider",
            "cwd": temp.path()
        }),
    )
    .await;
    let source_thread_id = required_string(&started, "/result/thread/id");
    request(
        &server,
        302,
        METHOD_TURN_START,
        json!({
            "threadId": source_thread_id,
            "input": source_input,
            "clientUserMessageId": "client-1",
            "model": "fixture-model",
            "approvalPolicy": "never",
            "sandboxPolicy": "workspace-write"
        }),
    )
    .await;
    wait_for_completed_turn_count(&server, &source_thread_id, 1).await;
    let source_read = request(
        &server,
        303,
        METHOD_THREAD_READ,
        json!({"threadId": source_thread_id, "includeTurns": true}),
    )
    .await;
    let source_content = source_read
        .pointer("/result/thread/turns/0/items/0/content")
        .cloned()
        .expect("canonical source user content");
    assert_canonical_multimodal_input(&source_content);
    assert_eq!(
        source_read.pointer("/result/thread/turns/0/items/0/clientId"),
        Some(&json!("client-1"))
    );
    let forked = request(
        &server,
        304,
        METHOD_THREAD_FORK,
        json!({"threadId": source_thread_id}),
    )
    .await;
    let target_thread_id = required_string(&forked, "/result/thread/id");
    let canonical_file_name = source_content[2]["url"]
        .as_str()
        .and_then(|uri| uri.strip_prefix("sidecar://media/"))
        .expect("canonical input media URI");
    assert!(sidecar_root
        .join("sessions")
        .join(&target_thread_id)
        .join("media")
        .join(canonical_file_name)
        .is_file());
    drop(server);

    let restarted = AppServer::with_runtime(runtime());
    initialize(&restarted, 310).await;
    request(
        &restarted,
        311,
        METHOD_THREAD_RESUME,
        json!({"threadId": target_thread_id}),
    )
    .await;
    let target_read = request(
        &restarted,
        312,
        METHOD_THREAD_READ,
        json!({"threadId": target_thread_id, "includeTurns": true}),
    )
    .await;
    assert_eq!(
        target_read.pointer("/result/thread/turns/0/items/0/content"),
        Some(&source_content)
    );
    request(
        &restarted,
        313,
        METHOD_TURN_START,
        json!({
            "threadId": target_thread_id,
            "input": [{"type": "text", "text": "first target prompt"}],
            "model": "fixture-model",
            "approvalPolicy": "never",
            "sandboxPolicy": "workspace-write"
        }),
    )
    .await;
    wait_for_completed_turn_count(&restarted, &target_thread_id, 2).await;
    drop(restarted);

    let restarted_again = AppServer::with_runtime(runtime());
    initialize(&restarted_again, 320).await;
    let cold_turn = request_error(
        &restarted_again,
        321,
        METHOD_TURN_START,
        json!({
            "threadId": target_thread_id,
            "input": [{"type": "text", "text": "second target prompt"}],
            "model": "fixture-model",
            "approvalPolicy": "never",
            "sandboxPolicy": "workspace-write"
        }),
    )
    .await;
    assert_eq!(
        cold_turn.pointer("/error/code"),
        Some(&json!(error_codes::INVALID_REQUEST))
    );
    request(
        &restarted_again,
        322,
        METHOD_THREAD_RESUME,
        json!({"threadId": target_thread_id}),
    )
    .await;
    request(
        &restarted_again,
        323,
        METHOD_TURN_START,
        json!({
            "threadId": target_thread_id,
            "input": [{"type": "text", "text": "second target prompt"}],
            "model": "fixture-model",
            "approvalPolicy": "never",
            "sandboxPolicy": "workspace-write"
        }),
    )
    .await;
    wait_for_completed_turn_count(&restarted_again, &target_thread_id, 3).await;

    let histories = backend
        .histories
        .lock()
        .expect("fork history capture mutex poisoned");
    assert_eq!(histories.len(), 3);
    assert_source_provider_history(&histories[1]);
    assert_eq!(&histories[2][..histories[1].len()], histories[1].as_slice());
    assert!(matches!(
        &histories[2][histories[1].len()],
        CurrentProviderMessage {
            producer: None, role: CurrentProviderRole::User,
            content,
        } if matches!(
            &content[..],
            [CurrentProviderContent::Text(text)] if text == "first target prompt"
        )
    ));
}
