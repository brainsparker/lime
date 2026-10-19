use app_server::{AppServer, EventLogWriter};
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};

#[path = "turn_final_completion_jsonrpc/provider.rs"]
mod provider;
mod support;

use provider::{Provider, Wire, REASONING};

async fn normal_final(wire: Wire, reasoning: bool) {
    let temp = tempfile::tempdir().unwrap();
    let provider = Provider::start(wire, reasoning).await;
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let runtime = || {
        support::runtime_core_with_chat_providers_at(
            &temp,
            &[(
                "final-provider",
                "final-model",
                wire.provider_type(),
                &provider.url,
                "final-fixture-key",
            )],
        )
        .with_event_log_writer(writer.clone())
    };
    let server = AppServer::with_runtime(runtime());
    initialize(&server).await;
    let started = request(
        &server,
        2,
        "thread/start",
        json!({"cwd":temp.path(),"modelProvider":"final-provider","model":"final-model"}),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    let mut outbound = server.subscribe_outbound_messages();
    let started = request(
        &server,
        3,
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":"finish without visible text"}]}),
    )
    .await;
    let turn = started["result"]["turn"]["id"].as_str().unwrap();
    let terminal = tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let event = serde_json::to_value(outbound.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn {
                break event;
            }
        }
    })
    .await
    .expect("normal final terminal");
    let requests = provider.requests();
    assert_eq!(
        requests.len(),
        1,
        "{wire:?}, reasoning={reasoning}: ordinary completion must not resample because visible text is absent"
    );
    wire.assert_route(&requests[0]);
    assert_eq!(
        terminal["params"]["turn"]["status"], "completed",
        "{terminal}"
    );
    let events = writer.read_session_events(session).unwrap();
    let steps = events
        .iter()
        .filter(|record| record.event.event_type == "provider.step")
        .collect::<Vec<_>>();
    assert_eq!(steps.len(), 1);
    assert_eq!(steps[0].event.payload["usage"]["input_tokens"], 10);
    assert_eq!(steps[0].event.payload["usage"]["output_tokens"], 4);
    assert_eq!(steps[0].event.payload["text_output_chars"], 0);
    assert_eq!(
        steps[0].event.payload["reasoning_output_chars"],
        if reasoning { REASONING.len() } else { 0 }
    );
    assert_eq!(
        events
            .iter()
            .filter(|record| record.event.event_type == "turn.completed")
            .count(),
        1
    );
    assert!(events
        .iter()
        .filter(|record| record.event.event_type == "turn.completed")
        .all(|record| record.event.turn_id.as_deref() == Some(turn)));
    assert_eq!(
        events
            .iter()
            .any(|record| record.event.payload.to_string().contains(REASONING)),
        reasoning
    );
    drop(server);

    let cold = AppServer::with_runtime(runtime());
    initialize(&cold).await;
    request(&cold, 4, "thread/resume", json!({"threadId":thread})).await;
    assert_eq!(writer.read_session_events(session).unwrap(), events);
    let mut outbound = cold.subscribe_outbound_messages();
    let next = request(
        &cold,
        5,
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":"inspect final history"}]}),
    )
    .await;
    let next_turn = next["result"]["turn"]["id"].as_str().unwrap();
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let event = serde_json::to_value(outbound.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == next_turn {
                assert_eq!(event["params"]["turn"]["status"], "completed", "{event}");
                break;
            }
        }
    })
    .await
    .expect("cold final history terminal");
    let requests = provider.requests();
    assert_eq!(requests.len(), 2);
    wire.assert_route(&requests[1]);
    let history = wire.history(&requests[1].body);
    // Responses 的 delta 只负责展示，不能伪造完成的 reasoning item 回传。
    assert_eq!(
        history.to_string().contains(REASONING),
        reasoning && !matches!(wire, Wire::Responses),
        "{wire:?}: replay must follow the wire protocol's history contract"
    );
    if matches!(wire, Wire::Responses) {
        assert!(!history
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item["type"] == "reasoning"));
    }
}

macro_rules! final_test {
    ($name:ident, $wire:ident, $reasoning:literal) => {
        #[tokio::test]
        async fn $name() {
            normal_final(Wire::$wire, $reasoning).await;
        }
    };
}

final_test!(chat_empty_final_completes_once, Chat, false);
final_test!(chat_reasoning_final_completes_once, Chat, true);
final_test!(responses_empty_final_completes_once, Responses, false);
final_test!(
    responses_reasoning_delta_final_completes_once,
    Responses,
    true
);
final_test!(anthropic_empty_final_completes_once, Anthropic, false);
final_test!(anthropic_reasoning_final_completes_once, Anthropic, true);
final_test!(gemini_empty_final_completes_once, Gemini, false);
final_test!(gemini_reasoning_final_completes_once, Gemini, true);

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"final-fixture","version":"1"}}),
    )
    .await;
    server
        .handle_json_line(&json!({"jsonrpc":"2.0","method":"initialized","params":{}}).to_string())
        .await
        .unwrap();
}

async fn request(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let lines = server
        .handle_json_line(
            &json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}).to_string(),
        )
        .await
        .unwrap();
    let response = lines
        .iter()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .find(|value| value["id"] == id)
        .unwrap_or_else(|| panic!("missing {method}: {lines:?}"));
    assert!(response.get("error").is_none(), "{method}: {response}");
    response
}
