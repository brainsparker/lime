use app_server::{AppServer, EventLogWriter};
use lime_core::database::dao::api_key_provider::ApiProviderType;
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};

#[path = "turn_reasoning_history_jsonrpc/provider.rs"]
mod provider;
#[path = "turn_reasoning_history_jsonrpc/routes.rs"]
mod routes;
mod support;

#[tokio::test]
async fn responses_requests_encrypted_reasoning_from_the_public_turn() {
    reasoning_history(false, false).await;
}

#[tokio::test]
async fn completed_reasoning_and_message_keep_their_order_in_live_history() {
    reasoning_history(false, true).await;
}

#[tokio::test]
async fn completed_reasoning_and_message_keep_their_order_after_cold_resume() {
    reasoning_history(true, true).await;
}

#[tokio::test]
async fn completed_envelopes_keep_their_order_after_fork() {
    let temp = tempfile::tempdir().unwrap();
    let provider = provider::Provider::start().await;
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let server = AppServer::with_runtime(
        support::runtime_core_with_chat_providers_at(
            &temp,
            &[(
                "history-provider",
                "history-model",
                ApiProviderType::OpenaiResponse,
                &provider.url,
                "history-fixture-key",
            )],
        )
        .with_event_log_writer(writer),
    );
    initialize(&server).await;
    let started = request(
        &server,
        2,
        "thread/start",
        json!({"cwd":temp.path(),"modelProvider":"history-provider","model":"history-model"}),
    )
    .await;
    let parent = started["result"]["thread"]["id"].as_str().unwrap();
    turn(&server, 3, parent, "record completed items for fork").await;
    let forked = request(&server, 4, "thread/fork", json!({"threadId":parent})).await;
    let child = forked["result"]["thread"]["id"].as_str().unwrap();
    assert_ne!(child, parent);
    assert_eq!(provider.requests().len(), 1, "fork must not sample");
    turn(&server, 5, child, "continue after fork").await;
    let requests = provider.requests();
    assert_eq!(requests.len(), 2);
    let input = requests[1]["input"].as_array().unwrap();
    assert_eq!(
        input
            .iter()
            .filter(|item| item["type"] == "reasoning")
            .collect::<Vec<_>>(),
        vec![&provider::reasoning()]
    );
    assert_eq!(
        input
            .iter()
            .filter(|item| item["role"] == "assistant")
            .collect::<Vec<_>>(),
        vec![&provider::message()]
    );
}

async fn reasoning_history(cold: bool, check_history: bool) {
    let temp = tempfile::tempdir().unwrap();
    let provider = provider::Provider::start().await;
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let runtime = || {
        support::runtime_core_with_chat_providers_at(
            &temp,
            &[(
                "history-provider",
                "history-model",
                ApiProviderType::OpenaiResponse,
                &provider.url,
                "history-fixture-key",
            )],
        )
        .with_event_log_writer(writer.clone())
    };
    let mut server = AppServer::with_runtime(runtime());
    initialize(&server).await;
    let started = request(
        &server,
        2,
        "thread/start",
        json!({"cwd":temp.path(),"modelProvider":"history-provider","model":"history-model"}),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    let first_turn = turn(&server, 3, thread, "remember the completed envelope").await;
    assert_eq!(provider.requests().len(), 1, "ordinary final samples once");
    let events = writer.read_session_events(session).unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|record| {
                record.event.event_type == "turn.completed"
                    && record.event.turn_id.as_deref() == Some(first_turn.as_str())
            })
            .count(),
        1,
        "one durable terminal for the original Turn"
    );
    if !check_history {
        assert!(
            provider.requests()[0]["include"]
                .as_array()
                .is_some_and(|include| {
                    include
                        .iter()
                        .any(|value| value == "reasoning.encrypted_content")
                }),
            "Responses must request the opaque reasoning needed for subsequent history"
        );
        return;
    }
    if cold {
        drop(server);
        server = AppServer::with_runtime(runtime());
        initialize(&server).await;
        request(&server, 4, "thread/resume", json!({"threadId":thread})).await;
        assert_eq!(
            writer.read_session_events(session).unwrap(),
            events,
            "cold resume must preserve committed event identities and order"
        );
        assert_eq!(provider.requests().len(), 1, "resume must not sample");
    }
    let later = "inspect the exact completed history";
    let second_turn = turn(&server, 5, thread, later).await;
    assert_ne!(first_turn, second_turn);
    let requests = provider.requests();
    assert_eq!(
        requests.len(),
        2,
        "one sampling per public Turn, cold={cold}"
    );
    let input = requests[1]["input"].as_array().expect("Responses input");
    let reasoning = input
        .iter()
        .enumerate()
        .filter(|(_, item)| item["type"] == "reasoning")
        .collect::<Vec<_>>();
    assert_eq!(
        reasoning.len(),
        1,
        "one completed native reasoning item, cold={cold}: {input:?}"
    );
    assert_eq!(
        reasoning[0].1,
        &provider::reasoning(),
        "summary/content/encrypted_content and prefixed producer identity must survive"
    );
    let messages = input
        .iter()
        .enumerate()
        .filter(|(_, item)| item["role"] == "assistant")
        .collect::<Vec<_>>();
    assert_eq!(
        messages.len(),
        1,
        "presentation deltas must not duplicate the completed message"
    );
    assert_eq!(
        messages[0].1,
        &provider::message(),
        "phase and completed content survive"
    );
    let later = input
        .iter()
        .enumerate()
        .filter(|(_, item)| item["role"] == "user" && item.to_string().contains(later))
        .collect::<Vec<_>>();
    assert_eq!(later.len(), 1);
    assert!(
        reasoning[0].0 < messages[0].0 && messages[0].0 < later[0].0,
        "producer item order must precede the subsequent user input, cold={cold}"
    );
}

async fn turn(server: &AppServer, id: u64, thread: &str, text: &str) -> String {
    let mut notifications = server.subscribe_outbound_messages();
    let started = request(
        server,
        id,
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":text}]}),
    )
    .await;
    let turn = started["result"]["turn"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let event = serde_json::to_value(notifications.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn {
                assert_eq!(event["params"]["threadId"], thread);
                assert_eq!(event["params"]["turn"]["status"], "completed", "{event}");
                break;
            }
        }
    })
    .await
    .expect("public history Turn terminal");
    turn
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"reasoning-history-fixture","version":"1"}}),
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
