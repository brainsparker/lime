use super::*;
use agent_runtime::model_history::{ModelHistoryRecord, MODEL_HISTORY_EVENT_TYPE};
use catalog_truncation::{fixture, provision, runtime as runtime_core};
use model_provider::current_client::CurrentProviderContent;

const ORIGINAL_INPUT: &str = "private-invalid-tool-input";

fn tool_records(temp: &TempDir, session: &str) -> Vec<ModelHistoryRecord> {
    EventLogWriter::new(temp.path().join("events"))
        .unwrap()
        .read_session_events(session)
        .unwrap()
        .into_iter()
        .filter(|record| record.event.event_type == MODEL_HISTORY_EVENT_TYPE)
        .map(|record| serde_json::from_value(record.event.payload).unwrap())
        .collect()
}

fn assert_chat_original(fixture: &ModelFixture) {
    let captured = fixture.last_request();
    captured.assert_route(Wire::Chat);
    let messages = captured.history().as_array().unwrap();
    let call = messages
        .iter()
        .find_map(|message| message.get("tool_calls")?.as_array()?.first())
        .expect("original failed call must stay in model history");
    assert_eq!(call["id"], "origin-tool");
    assert_eq!(call["function"]["name"], "Read");
    assert_eq!(
        call["function"]["arguments"],
        serde_json::to_string_pretty(&json!(ORIGINAL_INPUT)).unwrap()
    );
    let result = messages
        .iter()
        .find(|message| message["role"] == "tool")
        .expect("original failed result");
    assert_eq!(result["tool_call_id"], "origin-tool");
    assert!(result["content"]
        .as_str()
        .unwrap()
        .contains("arguments must be a JSON object"));
}

async fn rejected_turn(server: &AppServer, id: u64, thread: &str) {
    let mut outbound = server.subscribe_outbound_messages();
    let started = request(
        server,
        id,
        METHOD_TURN_START,
        json!({"threadId":thread,"input":[{"type":"text","text":"keep original history"}]}),
    )
    .await;
    assert!(started.get("error").is_none(), "{started}");
    let result = terminal(&mut outbound).await;
    assert_eq!(result["params"]["turn"]["status"], "failed", "{result}");
    assert!(!result.to_string().contains(ORIGINAL_INPUT));
}

#[tokio::test]
async fn unrepresentable_history_rejects_native_switch_and_remains_recoverable() {
    let temp = TempDir::new().unwrap();
    let origin = ModelFixture::start_with_catalog_and_tool(
        Wire::Chat,
        catalog_truncation::model_catalog_with_budget(
            Wire::Chat,
            catalog_truncation::budget(Wire::Chat),
        ),
        "Read",
        json!(ORIGINAL_INPUT),
    )
    .await;
    let server = AppServer::with_runtime(runtime_core(&temp).await);
    initialize_server(&server).await;
    let provider = provision(&server, &origin, 10).await;
    let started = request(
        &server,
        20,
        METHOD_THREAD_START,
        json!({
            "model":Wire::Chat.model(),"modelProvider":provider,"cwd":temp.path(),
            "approvalPolicy":"never","sandbox":"workspace-write"
        }),
    )
    .await;
    assert!(started.get("error").is_none(), "{started}");
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    run_turn(
        &server,
        21,
        thread,
        "keep the model call and its failed result",
    )
    .await;
    assert_chat_original(&origin);
    let original = tool_records(&temp, session);
    assert_eq!(original.len(), 2);
    assert!(
        matches!(&original[0].message.content[0], CurrentProviderContent::ToolCall(call)
        if call.arguments == json!(ORIGINAL_INPUT))
    );
    assert!(
        matches!(&original[1].message.content[0], CurrentProviderContent::ToolResult(result)
        if !result.success && result.name == "Read")
    );
    let events = EventLogWriter::new(temp.path().join("events"))
        .unwrap()
        .read_session_events(session)
        .unwrap();
    assert!(events.iter().any(|record| {
        record.event.event_type == "item.completed"
            && record.event.payload["item"]["metadata"]["handler_executed"] == false
    }));
    drop(server);

    let server = AppServer::with_runtime(runtime_core(&temp).await);
    initialize_server(&server).await;
    let resumed = request(
        &server,
        30,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    assert!(resumed.get("error").is_none(), "{resumed}");
    for (index, wire) in [Wire::Anthropic, Wire::Gemini].into_iter().enumerate() {
        let next = fixture(wire).await;
        let id = 40 + index as u64 * 10;
        let provider = provision(&server, &next, id).await;
        let changed = request(
            &server,
            id + 4,
            "thread/settings/update",
            json!({"threadId":thread,"model":wire.model(),"modelProvider":provider}),
        )
        .await;
        assert!(changed.get("error").is_none(), "{changed}");
        rejected_turn(&server, id + 5, thread).await;
        assert_eq!(
            next.request_count(),
            0,
            "{wire:?}: incompatible history reached HTTP"
        );
        assert_eq!(tool_records(&temp, session), original);
    }

    let restored = fixture(Wire::Chat).await;
    let provider = provision(&server, &restored, 70).await;
    let changed = request(
        &server,
        74,
        "thread/settings/update",
        json!({"threadId":thread,"model":Wire::Chat.model(),"modelProvider":provider}),
    )
    .await;
    assert!(changed.get("error").is_none(), "{changed}");
    run_turn(
        &server,
        75,
        thread,
        "continue using the original raw arguments",
    )
    .await;
    assert_chat_original(&restored);
    assert_eq!(tool_records(&temp, session), original);
    let forked = request(&server, 80, "thread/fork", json!({"threadId":thread})).await;
    assert!(forked.get("error").is_none(), "{forked}");
    let fork = &forked["result"]["thread"];
    assert_eq!(
        tool_records(&temp, fork["sessionId"].as_str().unwrap()),
        original
    );
    run_turn(
        &server,
        81,
        fork["id"].as_str().unwrap(),
        "retain the failed original call",
    )
    .await;
    assert_chat_original(&restored);
}
