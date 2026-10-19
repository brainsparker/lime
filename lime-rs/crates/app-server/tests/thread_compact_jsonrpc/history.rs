use super::*;
use app_server_protocol::protocol::v2::METHOD_THREAD_INJECT_ITEMS;

pub(super) fn injected_items() -> Vec<Value> {
    vec![
        json!({"type":"function_call","id":"item-original","call_id":"missing-function",
            "name":"read_file","arguments":"{}","opaque":{"preserve":true}}),
        json!({"type":"custom_tool_call","id":"item-original","call_id":"missing-custom",
            "name":"exec_command","input":"never execute this"}),
        json!({"type":"tool_search_call","id":"item-original","call_id":"missing-search",
            "execution":"client","arguments":{}}),
        json!({"type":"local_shell_call","id":"local-shell-source","call_id":"missing-shell",
            "status":"incomplete","action":{"type":"exec","command":["never-execute"]}}),
        json!({"type":"function_call","id":"valid-call","call_id":"valid",
            "name":"read_file","arguments":"{}"}),
        json!({"type":"function_call_output","call_id":"valid","output":[
            {"type":"input_text","text":"preserve structured tool result"}],
            "opaque":{"structured":"keep-exactly"}}),
        json!({"type":"function_call_output","call_id":"orphan-function","output":"remove me"}),
        json!({"type":"custom_tool_call_output","call_id":"orphan-custom","output":"remove me"}),
        json!({"type":"tool_search_output","call_id":"orphan-search","execution":"client",
            "status":"completed","tools":[]}),
        json!({"type":"tool_search_output","call_id":"external-search","execution":"server",
            "status":"completed","tools":[{"name":"external-tool"}]}),
        json!({"type":"function_call_output","id":"external-result","name":"external_event",
            "namespace":"notifications","output":[
                {"type":"input_text","text":"keep external context without a call"},
                {"type":"encrypted_content","encrypted_content":"opaque-provider-state"}],
            "provider_extension":{"preserve":"exactly"}}),
        json!({"type":"function_call_output","call_id":null,"name":"external_event",
            "namespace":"notifications","output":"keep explicit null call id"}),
    ]
}

pub(super) fn assert_normalized(
    capture: &model_fixture::Capture,
    original: &[Value],
) -> Vec<Value> {
    capture.assert_route(Wire::Responses);
    let items = capture.history().as_array().unwrap();
    for item in original.iter().filter(|item| {
        !item["call_id"]
            .as_str()
            .is_some_and(|id| id.starts_with("orphan-"))
    }) {
        // All seeded IDs are unprefixed. Codex strips them only from the
        // request copy; assert_prompt_only still checks the exact durable item.
        let mut expected = item.clone();
        expected.as_object_mut().unwrap().remove("id");
        assert!(
            items.contains(&expected),
            "request item changed beyond its unprefixed ID: {expected}; {items:?}"
        );
    }
    assert!(!items.iter().any(|item| item["call_id"]
        .as_str()
        .is_some_and(|id| id.starts_with("orphan-"))));
    let mut outputs = Vec::new();
    for (call, family, expected_id) in [
        (
            "missing-function",
            "function_call_output",
            Some("fco_45933e0f-2a6a-53e2-9e75-c50fdd98fab1"),
        ),
        (
            "missing-custom",
            "custom_tool_call_output",
            Some("ctco_19c0acea-b34b-5d4f-a41a-d1d60f7f9d31"),
        ),
        (
            "missing-search",
            "tool_search_output",
            Some("tso_23b1c1ef-ce88-57d4-b944-2f776077f671"),
        ),
        ("missing-shell", "function_call_output", None),
    ] {
        let matches = items
            .iter()
            .filter(|item| item["type"] == family && item["call_id"] == call)
            .collect::<Vec<_>>();
        assert_eq!(matches.len(), 1, "one synthetic output per call: {call}");
        let output = matches[0];
        if let Some(id) = expected_id {
            assert_eq!(output["id"], id);
        }
        if family == "tool_search_output" {
            assert_eq!(output["tools"], json!([]));
            assert_eq!(output["execution"], "client");
        } else {
            assert_eq!(output["output"], "aborted");
        }
        outputs.push(output.clone());
    }
    outputs
}

pub(super) fn assert_prompt_only(log: &EventLogWriter, session: &str, original: &[Value]) {
    let records = log.read_session_events(session).unwrap();
    let injected = records
        .iter()
        .filter(|record| record.event.event_type == "response_item.injected")
        .map(|record| record.event.payload["item"].clone())
        .collect::<Vec<_>>();
    assert_eq!(
        injected, original,
        "durable history must keep the exact original injection"
    );
    for record in records {
        let serialized = serde_json::to_string(&record.event).unwrap();
        assert!(!serialized.contains("fco_45933e0f-2a6a-53e2-9e75-c50fdd98fab1"));
        if record.event.event_type == "item.completed" {
            assert!(
                !serialized.contains("missing-"),
                "repair cannot invent a tool completion"
            );
        }
    }
}

#[tokio::test]
async fn injected_tool_history_is_normalized_for_sampling_resume_and_model_summary() {
    let temp = TempDir::new().unwrap();
    let fixture = ModelFixture::start(Wire::Responses).await;
    let server = AppServer::with_runtime(runtime(&temp, &fixture));
    initialize_server(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model":fixture.wire.model(),"modelProvider":"compact-provider","cwd":temp.path()
        }),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    let original = injected_items();
    request(
        &server,
        3,
        METHOD_THREAD_INJECT_ITEMS,
        json!({"threadId":thread,"items":original}),
    )
    .await;
    run_turn(&server, 4, thread, "continue inherited history").await;
    let outputs = assert_normalized(&fixture.last_request(), &original);
    let log = EventLogWriter::new(temp.path().join("events")).unwrap();
    assert_prompt_only(&log, session, &original);
    drop(server);

    let reopened = AppServer::with_runtime(runtime(&temp, &fixture));
    initialize_server(&reopened).await;
    request(
        &reopened,
        5,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    run_turn(&reopened, 6, thread, "continue after cold reopen").await;
    assert_eq!(
        assert_normalized(&fixture.last_request(), &original),
        outputs
    );
    assert_eq!(
        compact(&reopened, 7, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert_eq!(
        assert_normalized(&fixture.last_request(), &original),
        outputs
    );
    assert!(fixture
        .last_request()
        .body
        .get("tools")
        .is_none_or(|tools| tools.as_array().is_some_and(Vec::is_empty)));
    assert_prompt_only(&log, session, &original);
}

#[tokio::test]
async fn active_injection_is_normalized_by_the_next_sampling_in_the_same_turn() {
    let temp = TempDir::new().unwrap();
    let fixture = ModelFixture::start(Wire::Responses).await;
    let server = AppServer::with_runtime(runtime(&temp, &fixture));
    initialize_server(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model":fixture.wire.model(),"modelProvider":"compact-provider","cwd":temp.path()
        }),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    let (ready, release) = fixture.hold_next_sampling();
    let mut outbound = server.subscribe_outbound_messages();
    let turn = request(
        &server,
        3,
        METHOD_TURN_START,
        json!({
            "threadId":thread,"input":[{"type":"text","text":"continue when new context arrives"}]
        }),
    )
    .await;
    timeout(Duration::from_secs(15), ready)
        .await
        .unwrap()
        .unwrap();
    let original = injected_items();
    request(
        &server,
        4,
        METHOD_THREAD_INJECT_ITEMS,
        json!({"threadId":thread,"items":original}),
    )
    .await;
    release.send(()).unwrap();
    let completed = terminal(&mut outbound).await;
    assert_eq!(
        completed["params"]["turn"]["id"],
        turn["result"]["turn"]["id"]
    );
    assert_eq!(completed["params"]["turn"]["status"], "completed");
    assert_normalized(&fixture.last_request(), &original);
    assert_prompt_only(
        &EventLogWriter::new(temp.path().join("events")).unwrap(),
        session,
        &original,
    );
}
