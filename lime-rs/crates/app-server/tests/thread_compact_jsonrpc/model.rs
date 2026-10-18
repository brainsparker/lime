use super::*;
use app_server::EventLogWriter;
use app_server_protocol::{METHOD_THREAD_RESUME, METHOD_TURN_START};
use std::sync::atomic::Ordering;

#[path = "catalog_truncation.rs"]
mod catalog_truncation;
#[path = "history.rs"]
mod history;
#[path = "history_protocols.rs"]
mod history_protocols;
#[path = "history_truncation.rs"]
mod history_truncation;
#[path = "model_fixture.rs"]
mod model_fixture;
#[path = "origin_budget.rs"]
mod origin_budget;
#[path = "model_stdio.rs"]
mod stdio;
#[path = "../support/mod.rs"]
mod support;
use model_fixture::{ModelFixture, Wire};

fn runtime(temp: &TempDir, fixture: &ModelFixture) -> RuntimeCore {
    support::runtime_core_with_chat_providers_at(
        temp,
        &[(
            "compact-provider",
            fixture.wire.model(),
            fixture.wire.provider_type(),
            &fixture.url,
            fixture.wire.credential(),
        )],
    )
    .with_event_log_writer(Arc::new(
        EventLogWriter::new(temp.path().join("events")).unwrap(),
    ))
}

async fn terminal(receiver: &mut tokio::sync::broadcast::Receiver<JsonRpcMessage>) -> Value {
    timeout(Duration::from_secs(15), async {
        loop {
            let value = serde_json::to_value(receiver.recv().await.unwrap()).unwrap();
            if value["method"] == "turn/completed" {
                break value;
            }
        }
    })
    .await
    .expect("model compaction terminal notification")
}

async fn run_turn(server: &AppServer, id: u64, thread: &str, text: &str) {
    let mut outbound = server.subscribe_outbound_messages();
    request(
        server,
        id,
        METHOD_TURN_START,
        json!({
            "threadId":thread,"input":[{"type":"text","text":text}]
        }),
    )
    .await;
    let result = terminal(&mut outbound).await;
    assert_eq!(result["params"]["turn"]["status"], "completed", "{result}");
}

async fn compact(server: &AppServer, id: u64, thread: &str) -> Value {
    let mut outbound = server.subscribe_outbound_messages();
    request(
        server,
        id,
        METHOD_THREAD_COMPACT_START,
        json!({"threadId":thread}),
    )
    .await;
    terminal(&mut outbound).await
}

async fn model_summary_lifecycle(wire: Wire) {
    let temp = TempDir::new().unwrap();
    let fixture = ModelFixture::start(wire).await;
    let core = runtime(&temp, &fixture);
    let server = AppServer::with_runtime(core.clone());
    initialize_server(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model":wire.model(),"modelProvider":"compact-provider","cwd":temp.path()
        }),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    for index in 0..6 {
        run_turn(
            &server,
            10 + index,
            thread,
            &format!("user-constraint-{index}: do not discard pending work"),
        )
        .await;
    }
    assert_eq!(
        compact(&server, 20, thread).await["params"]["turn"]["status"],
        "completed"
    );
    let first_request = fixture.last_request();
    first_request.assert_route(wire);
    assert!(first_request
        .history()
        .to_string()
        .contains("user-constraint-0"));
    assert!(first_request
        .history()
        .to_string()
        .contains("MODEL-ASSISTANT-NOTE"));
    assert!(first_request
        .body
        .get("tools")
        .is_none_or(|tools| tools.as_array().is_some_and(Vec::is_empty)));
    assert_eq!(
        compact(&server, 21, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert!(fixture
        .last_request()
        .history()
        .to_string()
        .contains("MODEL-SUMMARY-1"));

    fixture.mode.store(1, Ordering::SeqCst);
    let failed = compact(&server, 22, thread).await;
    assert_eq!(failed["params"]["turn"]["status"], "failed", "{failed}");
    let events = core.events_for_session(session).unwrap();
    let markers = events
        .iter()
        .filter(|event| event.event_type == "context.compaction.completed")
        .collect::<Vec<_>>();
    assert_eq!(markers.len(), 2, "failed output must not replace history");
    assert!(markers[1].payload["summary"]
        .as_str()
        .unwrap()
        .contains("MODEL-SUMMARY-2"));
    assert_eq!(markers[1].payload["windowNumber"], 2);

    fixture.mode.store(2, Ordering::SeqCst);
    let mut outbound = server.subscribe_outbound_messages();
    request(
        &server,
        23,
        METHOD_THREAD_COMPACT_START,
        json!({"threadId":thread}),
    )
    .await;
    let active_turn = timeout(Duration::from_secs(15), async {
        loop {
            let value = serde_json::to_value(outbound.recv().await.unwrap()).unwrap();
            if value["method"] == "turn/started" {
                break value["params"]["turn"]["id"].as_str().unwrap().to_string();
            }
        }
    })
    .await
    .unwrap();
    timeout(Duration::from_secs(15), fixture.pending_response.notified())
        .await
        .unwrap();
    request(
        &server,
        24,
        "turn/interrupt",
        json!({"threadId":thread,"turnId":active_turn}),
    )
    .await;
    let interrupted = terminal(&mut outbound).await;
    assert_eq!(
        interrupted["params"]["turn"]["status"], "interrupted",
        "{interrupted}"
    );
    assert_eq!(
        core.events_for_session(session)
            .unwrap()
            .iter()
            .filter(|event| event.event_type == "context.compaction.completed")
            .count(),
        2
    );

    let events = core.events_for_session(session).unwrap();
    let started_items = events
        .iter()
        .filter(|event| event.event_type == "context.compaction.started")
        .collect::<Vec<_>>();
    assert_eq!(started_items.len(), 4);
    let ids = started_items
        .iter()
        .map(|event| event.payload["compactionId"].as_str().unwrap())
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(
        ids.len(),
        4,
        "failed attempts must not reuse a context Item identity"
    );
    let read = request(
        &server,
        25,
        "thread/read",
        json!({"threadId":thread,"includeTurns":true}),
    )
    .await;
    let read_turns = read["result"]["thread"]["turns"].as_array().unwrap();
    for start in started_items {
        let turn = read_turns
            .iter()
            .find(|turn| Some(turn["id"].as_str().unwrap()) == start.turn_id.as_deref())
            .unwrap();
        assert_ne!(turn["status"], "inProgress", "{turn}");
        let item_id = format!(
            "compaction-{}",
            start.payload["compactionId"].as_str().unwrap()
        );
        assert_eq!(
            turn["items"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|item| item["type"] == "contextCompaction" && item["id"] == item_id)
                .count(),
            1,
            "compaction Item lost from its Turn: {turn}"
        );
    }

    fixture.mode.store(0, Ordering::SeqCst);
    drop(server);
    drop(core);
    let reopened = AppServer::with_runtime(runtime(&temp, &fixture));
    initialize_server(&reopened).await;
    request(
        &reopened,
        30,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    run_turn(&reopened, 31, thread, "continue after cold reopen").await;
    let next = fixture.last_request().history().to_string();
    assert!(next.contains("MODEL-SUMMARY-2"), "{next}");
    assert!(
        !next.contains("MODEL-SUMMARY-3"),
        "failed summary leaked: {next}"
    );
    assert!(
        !next.contains("MODEL-SUMMARY-4"),
        "cancelled summary leaked: {next}"
    );
}

#[tokio::test]
async fn chat_model_summary_survives_failure_cancel_and_cold_reopen() {
    model_summary_lifecycle(Wire::Chat).await;
}

#[tokio::test]
async fn responses_model_summary_survives_failure_cancel_and_cold_reopen() {
    model_summary_lifecycle(Wire::Responses).await;
}

#[tokio::test]
async fn anthropic_model_summary_survives_failure_cancel_and_cold_reopen() {
    model_summary_lifecycle(Wire::Anthropic).await;
}

#[tokio::test]
async fn gemini_model_summary_survives_failure_cancel_and_cold_reopen() {
    model_summary_lifecycle(Wire::Gemini).await;
}

#[tokio::test]
async fn compaction_uses_current_provider_protocol_model_and_credential_after_each_switch() {
    let temp = TempDir::new().unwrap();
    let fixtures = [
        ModelFixture::start(Wire::Chat).await,
        ModelFixture::start(Wire::Responses).await,
        ModelFixture::start(Wire::Anthropic).await,
        ModelFixture::start(Wire::Gemini).await,
    ];
    let providers = fixtures
        .iter()
        .map(|fixture| {
            (
                fixture.wire.model(),
                fixture.wire.model(),
                fixture.wire.provider_type(),
                fixture.url.as_str(),
                fixture.wire.credential(),
            )
        })
        .collect::<Vec<_>>();
    let create_core = || {
        support::runtime_core_with_chat_providers_at(&temp, &providers).with_event_log_writer(
            Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap()),
        )
    };
    let core = create_core();
    let server = AppServer::with_runtime(core.clone());
    initialize_server(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model": Wire::Chat.model(), "modelProvider": Wire::Chat.model(), "cwd": temp.path(),
        }),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    run_turn(&server, 3, thread, "cross-protocol-user-constraint").await;
    let mut previous_summary = None;
    for (index, fixture) in fixtures.iter().enumerate() {
        let id = 10 + 3 * index as u64;
        request(&server, id, app_server_protocol::protocol::v2::METHOD_THREAD_SETTINGS_UPDATE, json!({
            "threadId":thread, "model":fixture.wire.model(), "modelProvider":fixture.wire.model(),
        })).await;
        let result = compact(&server, id + 1, thread).await;
        assert_eq!(result["params"]["turn"]["status"], "completed", "{result}");
        let capture = fixture.last_request();
        capture.assert_route(fixture.wire);
        assert!(capture.body.get("previous_response_id").is_none());
        let history = capture.history().to_string();
        assert!(
            history.contains("cross-protocol-user-constraint"),
            "{history}"
        );
        if let Some(previous) = previous_summary.as_ref() {
            assert!(
                history.contains(previous),
                "previous portable summary absent: {history}"
            );
        }
        previous_summary = Some(format!("MODEL-SUMMARY-1: {:?}", fixture.wire));
        run_turn(
            &server,
            id + 2,
            thread,
            "continue with the selected provider",
        )
        .await;
        let next = fixture.last_request();
        next.assert_route(fixture.wire);
        assert!(next
            .history()
            .to_string()
            .contains(previous_summary.as_ref().unwrap()));
    }
    assert_eq!(
        core.events_for_session(session)
            .unwrap()
            .iter()
            .filter(|event| event.event_type == "context.compaction.completed")
            .count(),
        4
    );
    drop(server);
    drop(core);
    let reopened = AppServer::with_runtime(create_core());
    initialize_server(&reopened).await;
    request(
        &reopened,
        30,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    run_turn(
        &reopened,
        31,
        thread,
        "resume after multiple protocol switches",
    )
    .await;
    let final_request = fixtures.last().unwrap().last_request();
    final_request.assert_route(Wire::Gemini);
    assert!(final_request
        .history()
        .to_string()
        .contains(previous_summary.as_ref().unwrap()));
}
