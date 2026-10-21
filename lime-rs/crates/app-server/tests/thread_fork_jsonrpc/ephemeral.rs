use super::*;
use std::path::{Path, PathBuf};

const PNG: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

pub(super) fn files(root: &Path) -> Vec<PathBuf> {
    let mut result = Vec::new();
    for entry in std::fs::read_dir(root).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            result.extend(files(&path));
        } else {
            result.push(path);
        }
    }
    result.sort();
    result
}

pub(super) async fn start_and_complete(server: &AppServer, thread: &str, input: Value) {
    let mut outbound = server.subscribe_outbound_messages();
    let started = request(
        server,
        100,
        METHOD_TURN_START,
        json!({"threadId": thread, "input": input}),
    )
    .await;
    let turn_id = required_string(&started, "/result/turn/id");
    timeout(Duration::from_secs(10), async {
        loop {
            let event = serde_json::to_value(outbound.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn_id {
                assert_eq!(event["params"]["threadId"], thread);
                assert_eq!(event["params"]["turn"]["status"], "completed", "{event}");
                break;
            }
        }
    })
    .await
    .expect("canonical terminal notification");
}

pub(super) async fn fork_with_started_notification(
    server: &AppServer,
    params: Value,
    expected_usage: Option<i64>,
) -> Value {
    let messages = server
        .handle_json_line(
            &json!({
                "jsonrpc":"2.0", "id":4, "method":METHOD_THREAD_FORK, "params":params
            })
            .to_string(),
        )
        .await
        .unwrap();
    let messages: Vec<Value> = messages
        .iter()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    let response_index = messages
        .iter()
        .position(|message| message["id"] == 4)
        .unwrap();
    let response = messages[response_index].clone();
    assert!(response.get("error").is_none(), "{response}");
    let target = required_string(&response, "/result/thread/id");
    let started_index = messages
        .iter()
        .position(|message| {
            message["method"] == "thread/started" && message["params"]["thread"]["id"] == target
        })
        .unwrap();
    assert!(response_index < started_index);
    if let Some(total) = expected_usage {
        let usage_index = messages
            .iter()
            .position(|message| {
                message["method"] == "thread/tokenUsage/updated"
                    && message["params"]["threadId"] == target
            })
            .expect("restored usage notification");
        assert!(response_index < usage_index && usage_index < started_index);
        assert_eq!(
            messages[usage_index]["params"]["tokenUsage"]["total"]["totalTokens"],
            total
        );
    }
    let mut expected = response["result"]["thread"].clone();
    expected["turns"] = json!([]);
    assert_eq!(messages[started_index]["params"]["thread"], expected);
    assert!(!messages[..started_index]
        .iter()
        .any(|message| message["method"] == "thread/status/changed"
            && message["params"]["threadId"] == target));
    response
}

#[tokio::test]
async fn ephemeral_fork_preserves_items_media_and_model_overrides_without_disk_artifacts() {
    for (history_mode, exclude_turns) in [("legacy", false), ("legacy", true), ("paginated", true)]
    {
        let temp = TempDir::new().unwrap();
        let agent_root = temp.path().join("agent");
        let db = temp.path().join("projection.sqlite");
        let sidecars = temp.path().join("sidecars");
        let backend = Arc::new(HistoryCaptureBackend::default());
        let runtime = || {
            RuntimeCore::with_backend(backend.clone())
                .with_projection_store(Arc::new(
                    ProjectionStore::initialize_with_agent_root(&db, &agent_root).unwrap(),
                ))
                .with_event_log_writer(Arc::new(
                    EventLogWriter::new(temp.path().join("events")).unwrap(),
                ))
                .with_sidecar_store(Arc::new(SidecarStore::new(&sidecars).unwrap()))
        };
        let server = AppServer::with_runtime(runtime());
        initialize(&server, 1).await;
        let started = request(&server, 2, METHOD_THREAD_START, json!({
            "cwd":temp.path(), "model":"fixture-model", "modelProvider":"fixture-provider", "historyMode":history_mode
        })).await;
        let source = required_string(&started, "/result/thread/id");
        let source_session = required_string(&started, "/result/thread/sessionId");
        start_and_complete(
            &server,
            &source,
            json!([
                {"type":"text","text":"fork image source"},
                {"type":"image","url":PNG,"detail":"high"}
            ]),
        )
        .await;
        let original = request(
            &server,
            3,
            METHOD_THREAD_READ,
            json!({"threadId":source,"includeTurns":true}),
        )
        .await;
        let before = files(temp.path());
        let fork = fork_with_started_notification(
            &server,
            json!({
                "threadId":source, "ephemeral":true, "excludeTurns":exclude_turns,
                "model":"another-model", "modelProvider":"another-provider"
            }),
            None,
        )
        .await;
        let target = required_string(&fork, "/result/thread/id");
        assert_ne!(target, source);
        assert_eq!(fork["result"]["thread"]["forkedFromId"], source);
        assert_eq!(fork["result"]["thread"]["ephemeral"], true);
        assert!(fork["result"]["thread"]["path"].is_null());
        assert_eq!(fork["result"]["model"], "another-model");
        assert_eq!(fork["result"]["modelProvider"], "another-provider");
        if exclude_turns {
            assert_eq!(turn_count(&fork), 0);
        } else {
            assert_eq!(turn_count(&fork), 1);
            let inherited = fork["result"]["thread"]["turns"][0]["items"]
                .as_array()
                .unwrap();
            let original = original["result"]["thread"]["turns"][0]["items"]
                .as_array()
                .unwrap();
            assert_eq!(inherited.len(), original.len());
            assert!(inherited.len() >= 3);
            assert_eq!(
                inherited.iter().map(|item| &item["id"]).collect::<Vec<_>>(),
                original.iter().map(|item| &item["id"]).collect::<Vec<_>>()
            );
        }
        assert_eq!(
            files(temp.path()),
            before,
            "fork must not create target artifacts"
        );
        let read = request(
            &server,
            5,
            METHOD_THREAD_READ,
            json!({"threadId":target,"includeTurns":false}),
        )
        .await;
        assert_eq!(read["result"]["thread"]["forkedFromId"], source);
        for method in [METHOD_THREAD_READ, METHOD_THREAD_RESUME] {
            let error = request_error(
                &server,
                6,
                method,
                json!({"threadId":target,"includeTurns":true}),
            )
            .await;
            assert_eq!(error["error"]["code"], error_codes::INVALID_REQUEST);
        }
        // The source media may disappear after the fork. The temporary branch owns
        // inline copies and continues through the same canonical runtime pipeline.
        SidecarStore::new(&sidecars)
            .unwrap()
            .clear_session(&source_session)
            .unwrap();
        let before_turn = files(temp.path());
        start_and_complete(
            &server,
            &target,
            json!([{"type":"text","text":"continue ephemeral"}]),
        )
        .await;
        start_and_complete(
            &server,
            &target,
            json!([{"type":"text","text":"continue again"}]),
        )
        .await;
        assert_eq!(
            files(temp.path()),
            before_turn,
            "temporary turns must not write artifacts"
        );
        let histories = backend.histories.lock().unwrap();
        assert_eq!(histories.len(), 3);
        for history in &histories[1..] {
            assert!(
                matches!(&history[0].content[..], [CurrentProviderContent::Text(text), CurrentProviderContent::Image { uri, provider_data: Some(data), detail: Some(ImageDetail::High), .. }]
                if text == "fork image source" && uri.starts_with("data:image/png;base64,") && data == uri)
            );
            assert!(history.iter().any(|message| message.content.iter().any(|part| matches!(part, CurrentProviderContent::ToolResult(output) if output.output == "source tool output"))));
            assert_eq!(history.iter().filter(|message| message.content.iter().any(|part| matches!(part, CurrentProviderContent::Text(text) if text == "source assistant answer"))).count(), 1);
        }
        drop(histories);
        let sessions = backend.sessions.lock().unwrap();
        let metadata = sessions[1]
            .business_object_ref
            .as_ref()
            .unwrap()
            .metadata
            .as_ref()
            .unwrap();
        assert_eq!(metadata["modelName"], "another-model");
        assert_eq!(metadata["providerSelector"], "another-provider");
        drop(sessions);
        assert_eq!(
            backend.origins.lock().unwrap()[1],
            (Some(source.clone()), true)
        );
        let list = request(&server, 7, METHOD_THREAD_LIST, json!({"limit":100})).await;
        assert!(!list["result"]["data"]
            .as_array()
            .unwrap()
            .iter()
            .any(|thread| thread["id"] == target));
        drop(server);
        let restarted = AppServer::with_runtime(runtime());
        initialize(&restarted, 8).await;
        for method in [METHOD_THREAD_READ, METHOD_THREAD_RESUME] {
            request_error(
                &restarted,
                9,
                method,
                json!({"threadId":target,"includeTurns":false,"excludeTurns":true}),
            )
            .await;
        }
    }
}

#[tokio::test]
async fn ephemeral_paginated_and_archived_sources_reject_before_fork_creation() {
    let temp = TempDir::new().unwrap();
    let db = temp.path().join("projection.sqlite");
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(ImmediateBackend))
            .with_projection_store(Arc::new(ProjectionStore::initialize(&db).unwrap())),
    );
    initialize(&server, 1).await;
    let source = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"cwd":temp.path(),"historyMode":"paginated","model":"fixture-model","modelProvider":"fixture-provider"}),
    )
    .await;
    let source = required_string(&source, "/result/thread/id");
    let error = request_error(
        &server,
        3,
        METHOD_THREAD_FORK,
        json!({"threadId":source,"ephemeral":true}),
    )
    .await;
    assert_eq!(error["error"]["code"], error_codes::INVALID_REQUEST);
    assert!(error["error"]["message"]
        .as_str()
        .unwrap()
        .contains("excludeTurns"));
    request(&server, 4, "thread/archive", json!({"threadId":source})).await;
    for ephemeral in [true, false] {
        let error = request_error(
            &server,
            5,
            METHOD_THREAD_FORK,
            json!({"threadId":source,"ephemeral":ephemeral,"excludeTurns":true}),
        )
        .await;
        assert_eq!(error["error"]["code"], error_codes::INVALID_REQUEST);
        assert!(error["error"]["message"]
            .as_str()
            .unwrap()
            .contains("archived"));
    }
    let count: i64 = Connection::open(&db)
        .unwrap()
        .query_row("SELECT COUNT(*) FROM canonical_threads", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(count, 1);
}
