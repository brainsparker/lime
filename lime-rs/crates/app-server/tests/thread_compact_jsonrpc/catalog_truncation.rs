use super::*;
use agent_protocol::truncation::TruncationPolicy;
use app_server::AppServerRuntimeFactory;
use history_truncation::{append_tool_output, contains_text};
use lime_core::database::schema::create_tables;
use std::sync::Mutex;

const ALTERNATE_MODEL: &str = "catalog-alternate-model";

pub(super) async fn runtime(temp: &TempDir) -> RuntimeCore {
    let db = rusqlite::Connection::open(temp.path().join("product.sqlite")).unwrap();
    create_tables(&db).unwrap();
    let db = Arc::new(Mutex::new(db));
    let app_data = app_server::LocalAppDataSource::initialize_with_roots(
        db.clone(),
        temp.path(),
        temp.path().join("agent"),
    )
    .await
    .unwrap();
    AppServerRuntimeFactory::runtime_backend_core_with_db(db)
        .with_app_data_source(Arc::new(app_data))
        .with_app_config_path(temp.path().join("config.yaml"))
        .with_projection_store(Arc::new(
            ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
        ))
        .with_event_log_writer(Arc::new(
            EventLogWriter::new(temp.path().join("events")).unwrap(),
        ))
}

pub(super) fn budget(wire: Wire) -> TruncationPolicy {
    match wire {
        Wire::Chat => TruncationPolicy::Bytes(96),
        Wire::Responses => TruncationPolicy::Tokens(64),
        Wire::Anthropic => TruncationPolicy::Tokens(0),
        Wire::Gemini => TruncationPolicy::Bytes(512),
    }
}

fn model_catalog(wire: Wire) -> Value {
    let models =
        [(wire.model(), Some(budget(wire))), (ALTERNATE_MODEL, None)].map(|(model, budget)| {
            match wire {
                Wire::Gemini => json!({"name":format!("models/{model}"),"truncationPolicy":budget}),
                _ => json!({"id":model,"truncation_policy":budget}),
            }
        });
    match wire {
        Wire::Gemini => json!({"models":models}),
        _ => json!({"data":models}),
    }
}

pub(super) async fn fixture(wire: Wire) -> ModelFixture {
    ModelFixture::start_with_catalog(wire, model_catalog(wire)).await
}

pub(super) async fn fixture_with_tool(wire: Wire, arguments: Value) -> ModelFixture {
    ModelFixture::start_with_catalog_and_tool(wire, model_catalog(wire), "Read", arguments).await
}

pub(super) async fn provision(server: &AppServer, fixture: &ModelFixture, id: u64) -> String {
    let created = request(server, id, "modelProvider/create", json!({
        "name":fixture.wire.model(), "providerType":fixture.wire.provider_type().to_string(), "apiHost":fixture.url,
    })).await;
    let provider = created["result"]["provider"]["id"].as_str().unwrap();
    let models = [fixture.wire.model(), ALTERNATE_MODEL].map(|model| json!({"id":model,"capability":{
        "taskFamilies":["chat"],"inputModalities":["text"],"outputModalities":["text"],
        "runtimeFeatures":["streaming","tool_calling"],
        "capabilities":{"vision":false,"tools":true,"streaming":true,"jsonMode":false,"functionCalling":true,"reasoning":false}
    }}));
    let updated = request(
        server,
        id + 1,
        "modelProvider/update",
        json!({"providerId":provider,"enabled":true,"models":models}),
    )
    .await;
    assert!(updated.get("error").is_none(), "{updated}");
    let key = request(
        server,
        id + 2,
        "modelProviderKey/create",
        json!({
            "providerId":provider,"apiKey":fixture.wire.credential(),"replaceExisting":true,
        }),
    )
    .await;
    assert!(key.get("error").is_none(), "{key}");
    let fetched = request(
        server,
        id + 3,
        "modelProvider/fetchModels",
        json!({"providerId":provider}),
    )
    .await;
    assert!(fetched.get("error").is_none(), "{fetched}");
    assert_eq!(
        fetched["result"]["models"][0]["truncationPolicy"],
        serde_json::to_value(budget(fixture.wire)).unwrap(),
        "{fetched}"
    );
    let captures = fixture.catalog_requests();
    assert!(
        !captures.is_empty(),
        "catalog must come from actual provider HTTP"
    );
    for capture in captures {
        assert!(capture.headers.starts_with("GET "));
        let headers = capture.headers.to_ascii_lowercase();
        match fixture.wire {
            Wire::Chat | Wire::Responses => {
                assert_eq!(capture.path, "/v1/models");
                assert!(headers.contains(&format!(
                    "authorization: bearer {}\r\n",
                    fixture.wire.credential()
                )));
            }
            Wire::Anthropic => {
                assert!(capture.path.starts_with("/v1/models?"));
                assert!(headers.contains(&format!("x-api-key: {}\r\n", fixture.wire.credential())));
            }
            Wire::Gemini => {
                assert!(capture.path.starts_with("/v1/models?"), "{}", capture.path);
                assert!(headers.contains(&format!(
                    "x-goog-api-key: {}\r\n",
                    fixture.wire.credential()
                )));
            }
        }
    }
    provider.to_string()
}

fn original() -> String {
    format!(
        "HEAD-KEEP{}MIDDLE-MUST-NOT-REACH-MODEL{}TAIL-KEEP",
        "甲乙".repeat(4000),
        "abcd".repeat(6000)
    )
}

fn assert_budget(fixture: &ModelFixture, model: &str, budget: TruncationPolicy, original: &str) {
    let capture = fixture.last_request();
    capture.assert_model_route(fixture.wire, model);
    let expected = tool_runtime::tool_io::truncate_tool_output(
        original,
        budget.with_serialization_allowance(),
    );
    assert!(
        contains_text(capture.history(), &expected),
        "{:?}/{model}: catalog budget missing from actual request",
        fixture.wire
    );
    assert!(!capture
        .history()
        .to_string()
        .contains("MIDDLE-MUST-NOT-REACH-MODEL"));
}

fn assert_durable(temp: &TempDir, session: &str, original: &str) {
    let log = EventLogWriter::new(temp.path().join("events")).unwrap();
    let records = log.read_session_events(session).unwrap();
    assert_eq!(
        records
            .iter()
            .find(|record| record.event.event_id == "large-history-1")
            .unwrap()
            .event
            .payload["item"]["payload"]["output"]["text"],
        original
    );
}

async fn resume(server: &AppServer, id: u64, thread: &str) {
    let resumed = request(server, id, METHOD_THREAD_RESUME, json!({"threadId":thread})).await;
    assert!(resumed.get("error").is_none(), "{resumed}");
}

async fn cold_catalog_budget(wire: Wire) {
    let temp = TempDir::new().unwrap();
    let fixture = fixture(wire).await;
    let server = AppServer::with_runtime(runtime(&temp).await);
    initialize_server(&server).await;
    let provider = provision(&server, &fixture, 10).await;
    let started = request(
        &server,
        20,
        METHOD_THREAD_START,
        json!({"model":wire.model(),"modelProvider":provider,"cwd":temp.path()}),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    run_turn(&server, 21, thread, "prepare canonical history").await;
    let fetches = fixture.catalog_requests().len();
    drop(server);
    let original = original();
    append_tool_output(&temp, thread, session, &original);

    let server = AppServer::with_runtime(runtime(&temp).await);
    initialize_server(&server).await;
    resume(&server, 30, thread).await;
    assert_eq!(
        fixture.catalog_requests().len(),
        fetches,
        "cold resume must use the persisted scoped catalog"
    );
    run_turn(&server, 31, thread, "use the persisted catalog budget").await;
    assert_budget(&fixture, wire.model(), budget(wire), &original);
    assert_eq!(
        compact(&server, 32, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert_budget(&fixture, wire.model(), budget(wire), &original);
    assert_eq!(
        fixture.catalog_requests().len(),
        fetches,
        "sampling/summary must consume the restored scoped cache"
    );
    assert_durable(&temp, session, &original);
}

#[tokio::test]
async fn catalog_budget_cold_chat() {
    cold_catalog_budget(Wire::Chat).await;
}
#[tokio::test]
async fn catalog_budget_cold_responses() {
    cold_catalog_budget(Wire::Responses).await;
}
#[tokio::test]
async fn catalog_budget_cold_anthropic() {
    cold_catalog_budget(Wire::Anthropic).await;
}
#[tokio::test]
async fn catalog_budget_cold_gemini() {
    cold_catalog_budget(Wire::Gemini).await;
}

#[tokio::test]
async fn catalog_budget_switches_provider_protocol_and_model_in_one_thread() {
    let temp = TempDir::new().unwrap();
    let fixtures = [
        fixture(Wire::Chat).await,
        fixture(Wire::Responses).await,
        fixture(Wire::Anthropic).await,
        fixture(Wire::Gemini).await,
    ];
    let server = AppServer::with_runtime(runtime(&temp).await);
    initialize_server(&server).await;
    let mut providers = Vec::new();
    for (index, fixture) in fixtures.iter().enumerate() {
        providers.push(provision(&server, fixture, 10 + index as u64 * 10).await);
    }
    let started = request(
        &server,
        50,
        METHOD_THREAD_START,
        json!({"model":Wire::Chat.model(),"modelProvider":providers[0],"cwd":temp.path()}),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    run_turn(&server, 51, thread, "prepare model switches").await;
    drop(server);
    let original = original();
    append_tool_output(&temp, thread, session, &original);
    let server = AppServer::with_runtime(runtime(&temp).await);
    initialize_server(&server).await;
    resume(&server, 52, thread).await;
    // A normal turn keeps history; compaction is exercised after all switches and independently per wire above.
    for (index, (fixture_index, alternate)) in [
        (0, false),
        (1, false),
        (2, false),
        (3, false),
        (0, true),
        (0, false),
    ]
    .into_iter()
    .enumerate()
    {
        let fixture = &fixtures[fixture_index];
        let model = if alternate {
            ALTERNATE_MODEL
        } else {
            fixture.wire.model()
        };
        let id = 60 + index as u64 * 3;
        let updated = request(
            &server,
            id,
            "thread/settings/update",
            json!({"threadId":thread,"model":model,"modelProvider":providers[fixture_index]}),
        )
        .await;
        assert!(updated.get("error").is_none(), "{updated}");
        run_turn(&server, id + 1, thread, "sample with the selected model").await;
        assert_budget(
            fixture,
            model,
            if alternate {
                TruncationPolicy::default()
            } else {
                budget(fixture.wire)
            },
            &original,
        );
    }
    assert_eq!(
        compact(&server, 90, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert_budget(
        &fixtures[0],
        Wire::Chat.model(),
        budget(Wire::Chat),
        &original,
    );
    assert_durable(&temp, session, &original);
}
