use super::*;
use agent_protocol::{
    ItemId, ItemStatus, SessionId, ThreadId, ThreadItem, ThreadItemPayload, TurnId,
};
use app_server_protocol::AgentEvent;

fn contains(value: &Value, predicate: fn(&Value) -> bool) -> bool {
    predicate(value)
        || match value {
            Value::Array(items) => items.iter().any(|item| contains(item, predicate)),
            Value::Object(fields) => fields.values().any(|item| contains(item, predicate)),
            _ => false,
        }
}

fn assert_repaired(capture: &model_fixture::Capture, wire: Wire) {
    capture.assert_route(wire);
    let history = capture.history();
    let (has_call, has_result) = match wire {
        Wire::Chat => (
            contains(history, |item| {
                item["id"] == "unfinished-canonical" && item["function"]["name"] == "read_file"
            }),
            contains(history, |item| {
                item["role"] == "tool"
                    && item["tool_call_id"] == "unfinished-canonical"
                    && item["content"] == "aborted"
            }),
        ),
        Wire::Responses => (
            contains(history, |item| {
                item["type"] == "function_call" && item["call_id"] == "unfinished-canonical"
            }),
            contains(history, |item| {
                item["type"] == "function_call_output"
                    && item["call_id"] == "unfinished-canonical"
                    && item["output"] == "aborted"
            }),
        ),
        Wire::Anthropic => (
            contains(history, |item| {
                item["type"] == "tool_use" && item["id"] == "unfinished-canonical"
            }),
            contains(history, |item| {
                item["type"] == "tool_result"
                    && item["tool_use_id"] == "unfinished-canonical"
                    && item["content"] == "aborted"
            }),
        ),
        Wire::Gemini => (
            contains(history, |item| item["functionCall"]["name"] == "read_file"),
            contains(history, |item| {
                item["functionResponse"]["name"] == "read_file"
                    && item["functionResponse"]["response"]["content"] == "aborted"
            }),
        ),
    };
    assert!(
        has_call && has_result,
        "{wire:?} must keep the call and lower aborted: {history}"
    );
    assert!(!history.to_string().contains("orphan-canonical"));
    assert!(!history
        .to_string()
        .contains("orphan payload must disappear"));
}

// 显式构造崩溃时遗留的 canonical log；采样和摘要仍从公开 JSON-RPC 进入真实 provider。
async fn recovered_history(wire: Wire) {
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
    run_turn(&server, 3, thread, "prepare recoverable history").await;
    drop(server);

    let log = EventLogWriter::new(temp.path().join("events")).unwrap();
    let records = log.read_session_events(session).unwrap();
    let last = &records.last().unwrap().event;
    let turn = last.turn_id.as_deref().unwrap();
    let events = [
        ("item.started", "unfinished-canonical", false),
        ("item.completed", "orphan-canonical", true),
    ]
    .into_iter()
    .enumerate()
    .map(|(index, (kind, call, completed))| {
        let sequence = last.sequence + index as u64 + 1;
        let mut item = ThreadItem::new(
            SessionId::new(session),
            ThreadId::new(thread),
            TurnId::new(turn),
            sequence,
            100 + index as u64,
            ThreadItemPayload::DynamicToolCall {
                call_id: call.to_string(),
                namespace: None,
                tool: "read_file".to_string(),
                arguments: json!({"path":"pending.md"}),
                content_items: if completed {
                    vec![agent_protocol::DynamicToolCallContentItem::InputText {
                        text: "orphan payload must disappear".to_string(),
                    }]
                } else {
                    vec![]
                },
                success: completed.then_some(true),
                duration_ms: None,
            },
        );
        item.item_id = ItemId::new(format!("recovery-{call}"));
        item.status = if completed {
            ItemStatus::Completed
        } else {
            ItemStatus::InProgress
        };
        AgentEvent {
            event_id: format!("recovery-{call}"),
            sequence,
            session_id: session.to_string(),
            thread_id: Some(thread.to_string()),
            turn_id: Some(turn.to_string()),
            event_type: kind.to_string(),
            timestamp: last.timestamp.clone(),
            payload: json!({"item":item}),
        }
    })
    .collect::<Vec<_>>();
    log.append_events(&events).unwrap();

    let reopened = AppServer::with_runtime(runtime(&temp, &fixture));
    initialize_server(&reopened).await;
    request(
        &reopened,
        4,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    run_turn(
        &reopened,
        5,
        thread,
        "continue pending work without re-executing it",
    )
    .await;
    assert_repaired(&fixture.last_request(), wire);
    assert_eq!(
        compact(&reopened, 6, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert_repaired(&fixture.last_request(), wire);
    let records = log.read_session_events(session).unwrap();
    assert_eq!(
        records
            .iter()
            .filter(|record| record.event.event_id.starts_with("recovery-"))
            .count(),
        2
    );
    assert!(
        !records
            .iter()
            .any(|record| record.event.event_type == "item.completed"
                && record
                    .event
                    .payload
                    .to_string()
                    .contains("unfinished-canonical")),
        "sampling must not persist a fake tool completion"
    );
}

#[tokio::test]
async fn recovered_canonical_tool_history_chat() {
    recovered_history(Wire::Chat).await;
}
#[tokio::test]
async fn recovered_canonical_tool_history_responses() {
    recovered_history(Wire::Responses).await;
}
#[tokio::test]
async fn recovered_canonical_tool_history_anthropic() {
    recovered_history(Wire::Anthropic).await;
}
#[tokio::test]
async fn recovered_canonical_tool_history_gemini() {
    recovered_history(Wire::Gemini).await;
}
