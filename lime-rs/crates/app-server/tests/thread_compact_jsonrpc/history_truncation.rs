use super::*;
use agent_protocol::truncation::TruncationPolicy;
use agent_protocol::{
    ItemId, ItemStatus, SessionId, ThreadId, ThreadItem, ThreadItemPayload, ToolOutput, TurnId,
};
use app_server_protocol::AgentEvent;

pub(super) fn contains_text(value: &Value, expected: &str) -> bool {
    match value {
        Value::String(text) => text == expected,
        Value::Array(items) => items.iter().any(|item| contains_text(item, expected)),
        Value::Object(fields) => fields.values().any(|item| contains_text(item, expected)),
        _ => false,
    }
}

pub(super) fn append_tool_output(temp: &TempDir, thread: &str, session: &str, original: &str) {
    let log = EventLogWriter::new(temp.path().join("events")).unwrap();
    let records = log.read_session_events(session).unwrap();
    let last = &records.last().unwrap().event;
    let turn = last.turn_id.as_deref().unwrap();
    let events = [false, true]
        .into_iter()
        .enumerate()
        .map(|(index, completed)| {
            let sequence = last.sequence + index as u64 + 1;
            let mut item = ThreadItem::new(
                SessionId::new(session),
                ThreadId::new(thread),
                TurnId::new(turn),
                sequence,
                100,
                ThreadItemPayload::Tool {
                    call_id: "large-canonical".into(),
                    name: "read_file".into(),
                    arguments: vec![],
                    output: completed.then(|| ToolOutput {
                        text: Some(original.to_string()),
                        ..ToolOutput::default()
                    }),
                },
            );
            item.item_id = ItemId::new("large-item");
            item.status = if completed {
                ItemStatus::Completed
            } else {
                ItemStatus::InProgress
            };
            AgentEvent {
                event_id: format!("large-history-{index}"),
                sequence,
                session_id: session.into(),
                thread_id: Some(thread.into()),
                turn_id: Some(turn.into()),
                event_type: if completed {
                    "item.completed"
                } else {
                    "item.started"
                }
                .into(),
                timestamp: last.timestamp.clone(),
                payload: json!({"item":item}),
            }
        })
        .collect::<Vec<_>>();
    log.append_events(&events).unwrap();
}

async fn recovered_tool_output(wire: Wire) {
    let temp = TempDir::new().unwrap();
    let fixture = ModelFixture::start(wire).await;
    let server = AppServer::with_runtime(runtime(&temp, &fixture));
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
    run_turn(&server, 3, thread, "prepare history").await;
    drop(server);
    let original = format!(
        "HEAD-KEEP{}MIDDLE-MUST-NOT-REACH-MODEL{}TAIL-KEEP",
        "甲乙".repeat(4_000),
        "abcd".repeat(6_000)
    );
    let expected =
        tool_runtime::tool_io::truncate_tool_output(&original, TruncationPolicy::Bytes(12_000));
    append_tool_output(&temp, thread, session, &original);
    let log = EventLogWriter::new(temp.path().join("events")).unwrap();

    let reopened = AppServer::with_runtime(runtime(&temp, &fixture));
    initialize_server(&reopened).await;
    request(
        &reopened,
        4,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    run_turn(&reopened, 5, thread, "continue").await;
    let sampling = fixture.last_request();
    sampling.assert_route(wire);
    assert!(
        contains_text(sampling.history(), &expected),
        "{wire:?}: exact prompt truncation missing"
    );
    assert!(!sampling
        .history()
        .to_string()
        .contains("MIDDLE-MUST-NOT-REACH-MODEL"));
    assert_eq!(
        compact(&reopened, 6, thread).await["params"]["turn"]["status"],
        "completed"
    );
    let summary = fixture.last_request();
    summary.assert_route(wire);
    assert!(
        contains_text(summary.history(), &expected),
        "{wire:?}: summary and sampling must share the budget"
    );
    let records = log.read_session_events(session).unwrap();
    let durable = records
        .iter()
        .find(|record| record.event.event_id == "large-history-1")
        .unwrap();
    assert_eq!(
        durable.event.payload["item"]["payload"]["output"]["text"], original,
        "{wire:?}: full durable output must survive sampling and compaction"
    );
}

#[tokio::test]
async fn tool_history_truncation_chat() {
    recovered_tool_output(Wire::Chat).await;
}
#[tokio::test]
async fn tool_history_truncation_responses() {
    recovered_tool_output(Wire::Responses).await;
}
#[tokio::test]
async fn tool_history_truncation_anthropic() {
    recovered_tool_output(Wire::Anthropic).await;
}
#[tokio::test]
async fn tool_history_truncation_gemini() {
    recovered_tool_output(Wire::Gemini).await;
}

#[tokio::test]
async fn raw_named_output_truncates_only_prompt_text_and_keeps_durable_original() {
    use app_server_protocol::protocol::v2::METHOD_THREAD_INJECT_ITEMS;
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
    let text = format!("HEAD{}TAIL", "middle".repeat(5_000));
    let original = json!({"type":"function_call_output","id":"external-large",
    "name":"external_event","namespace":"notifications","opaque":{"keep":true},
    "output":[
        {"type":"input_text","text":text},
        {"type":"encrypted_content","encrypted_content":"provider-private-state"},
        {"type":"input_text","text":"omit extra text"}
    ]});
    let response = request(
        &server,
        3,
        METHOD_THREAD_INJECT_ITEMS,
        json!({"threadId":thread,"items":[original]}),
    )
    .await;
    assert!(response.get("error").is_none(), "{response}");
    drop(server);
    let reopened = AppServer::with_runtime(runtime(&temp, &fixture));
    initialize_server(&reopened).await;
    request(
        &reopened,
        4,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    run_turn(&reopened, 5, thread, "consume external event").await;
    let mut expected = original.clone();
    expected["output"][0]["text"] = json!(tool_runtime::tool_io::truncate_tool_output(
        &text,
        TruncationPolicy::Bytes(12_000)
    ));
    expected["output"][2]["text"] = json!("[omitted 1 text items ...]");
    let assert_prompt = || {
        let capture = fixture.last_request();
        capture.assert_route(Wire::Responses);
        assert!(
            capture.history().as_array().unwrap().contains(&expected),
            "raw output must retain its envelope and opaque fields"
        );
    };
    assert_prompt();
    assert_eq!(
        compact(&reopened, 6, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert_prompt();
    let log = EventLogWriter::new(temp.path().join("events")).unwrap();
    let records = log.read_session_events(session).unwrap();
    let injected = records
        .iter()
        .find(|record| record.event.event_type == "response_item.injected")
        .unwrap();
    assert_eq!(injected.event.payload["item"], original);
}
