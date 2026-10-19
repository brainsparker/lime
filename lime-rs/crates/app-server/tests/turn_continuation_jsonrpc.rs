use app_server::{AppServer, EventLogWriter};
use lime_core::database::dao::api_key_provider::ApiProviderType;
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};

#[path = "turn_continuation_jsonrpc/provider.rs"]
mod provider;
mod support;

#[tokio::test]
async fn responses_explicit_continuation_samples_again_in_the_same_public_turn() {
    let temp = tempfile::tempdir().unwrap();
    let provider = provider::Provider::start().await;
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let runtime = || {
        support::runtime_core_with_chat_providers_at(
            &temp,
            &[(
                "continuation-provider",
                "continuation-model",
                ApiProviderType::OpenaiResponse,
                &provider.url,
                "continuation-fixture-key",
            )],
        )
        .with_event_log_writer(writer.clone())
    };
    let server = AppServer::with_runtime(runtime());
    request(
        &server,
        1,
        "initialize",
        json!({
            "clientInfo":{"name":"continuation-fixture","version":"1"}
        }),
    )
    .await;
    server
        .handle_json_line(&json!({"jsonrpc":"2.0","method":"initialized","params":{}}).to_string())
        .await
        .unwrap();
    let started = request(
        &server,
        2,
        "thread/start",
        json!({
            "cwd":temp.path(),"modelProvider":"continuation-provider","model":"continuation-model"
        }),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    let mut notifications = server.subscribe_outbound_messages();
    let started = request(
        &server,
        3,
        "turn/start",
        json!({
            "threadId":thread,"input":[{"type":"text","text":"continue exactly once"}]
        }),
    )
    .await;
    let turn = started["result"]["turn"]["id"].as_str().unwrap();
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let event = serde_json::to_value(notifications.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn {
                assert_eq!(event["params"]["turn"]["status"], "completed", "{event}");
                break;
            }
        }
    })
    .await
    .expect("same Turn terminal");
    let requests = provider.requests();
    assert_eq!(
        requests.len(),
        2,
        "end_turn=false must continue after visible text"
    );
    let input = requests[1]["input"]
        .as_array()
        .expect("Responses transcript");
    let original = requests[0]["input"].as_array().unwrap();
    assert_eq!(
        input.len(),
        original.len() + 1,
        "continuation must add only the partial assistant response"
    );
    assert_eq!(
        &input[..original.len()],
        original.as_slice(),
        "continuation must retain the entire original transcript exactly once"
    );
    assert_eq!(
        input
            .iter()
            .filter(
                |item| item["role"] == "user" && item.to_string().contains("continue exactly once")
            )
            .count(),
        1
    );
    let assistant = input
        .iter()
        .filter(|item| item["role"] == "assistant")
        .collect::<Vec<_>>();
    assert_eq!(assistant.len(), 1);
    assert!(assistant[0].to_string().contains("partial evidence"));
    let events = writer.read_session_events(session).unwrap();
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
    let visible = events
        .iter()
        .map(|record| record.event.payload.to_string())
        .collect::<String>();
    assert!(visible.contains("partial evidence"));
    assert!(visible.contains("final evidence"));
    drop(server);
    let cold = AppServer::with_runtime(runtime());
    request(
        &cold,
        10,
        "initialize",
        json!({"clientInfo":{"name":"continuation-cold","version":"1"}}),
    )
    .await;
    cold.handle_json_line(&json!({"jsonrpc":"2.0","method":"initialized","params":{}}).to_string())
        .await
        .unwrap();
    request(&cold, 11, "thread/resume", json!({"threadId":thread})).await;
    assert_eq!(
        writer.read_session_events(session).unwrap(),
        events,
        "cold resume must not rewrite the first Turn"
    );
    let mut outbound = cold.subscribe_outbound_messages();
    let next = request(
        &cold,
        12,
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":"inspect cold history"}]}),
    )
    .await;
    let next_turn = next["result"]["turn"]["id"].as_str().unwrap();
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let event = serde_json::to_value(outbound.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == next_turn {
                assert_eq!(event["params"]["turn"]["status"], "completed", "{event}");
                break;
            }
        }
    })
    .await
    .expect("cold follow-up terminal");
    let requests = provider.requests();
    assert_eq!(requests.len(), 3);
    let assistant = requests[2]["input"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|item| item["role"] == "assistant")
        .collect::<Vec<_>>();
    assert_eq!(
        assistant.len(),
        2,
        "both response fragments must survive cold recovery"
    );
    assert!(assistant[0].to_string().contains("partial evidence"));
    assert!(assistant[1].to_string().contains("final evidence"));
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
