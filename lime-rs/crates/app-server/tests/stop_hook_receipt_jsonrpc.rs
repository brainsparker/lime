use agent_runtime::model_history::{ModelHistoryRecord, MODEL_HISTORY_EVENT_TYPE};
use app_server::{AppServer, EventLogWriter, ProjectionStore, RuntimeCore};
use model_provider::current_client::{CurrentProviderContent, CurrentProviderMessage};
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};
use tokio::sync::mpsc;

#[path = "stop_hook_receipt_jsonrpc/backend.rs"]
mod backend;

#[tokio::test]
async fn stop_receipt_precedes_item_and_survives_live_and_cold_history_once() {
    recovery(false).await;
}

#[tokio::test]
async fn stop_receipt_precedes_item_and_survives_live_and_fork_history_once() {
    recovery(true).await;
}

async fn recovery(fork: bool) {
    let temp = tempfile::tempdir().unwrap();
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let provider = Arc::new(backend::Provider::default());
    let (observed, mut observations) = mpsc::unbounded_channel();
    let backend = Arc::new(backend::Backend {
        writer: writer.clone(),
        cwd: temp.path().into(),
        provider: provider.clone(),
        observed,
    });
    let runtime = || {
        RuntimeCore::with_backend(backend.clone())
            .with_event_log_writer(writer.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
            ))
    };
    let mut server = AppServer::with_runtime(runtime());
    initialize(&server).await;
    let started = request(
        &server,
        2,
        "thread/start",
        json!({"cwd":temp.path(),"modelProvider":"fixture","model":"model"}),
    )
    .await;
    let parent = started["result"]["thread"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let session = started["result"]["thread"]["sessionId"]
        .as_str()
        .unwrap()
        .to_string();
    let first_turn = turn(&server, 3, &parent, "record").await;
    let first = receive(&mut observations).await;
    assert!(first.history.is_empty());
    assert_eq!(first.receipts.len(), 1);
    let entries = writer.read_session_events(&session).unwrap();
    let records = entries
        .iter()
        .filter(|entry| entry.event.event_type == MODEL_HISTORY_EVENT_TYPE)
        .collect::<Vec<_>>();
    assert_eq!(records.len(), 1);
    let event = &records[0].event;
    assert_eq!(first.receipts[0].event_id(), event.event_id);
    assert_eq!(first.receipts[0].sequence(), event.sequence);
    assert_eq!(event.turn_id.as_deref(), Some(first_turn.as_str()));
    let record: ModelHistoryRecord = serde_json::from_value(event.payload.clone()).unwrap();
    let prompt = record.clone().into_message().unwrap();
    let identity = record.metadata.source_item_id.unwrap();
    let lifecycle = entries
        .iter()
        .filter(|entry| {
            matches!(
                entry.event.event_type.as_str(),
                "item.started" | "item.completed"
            ) && entry.event.payload["item"]["itemId"] == identity
        })
        .map(|entry| &entry.event)
        .collect::<Vec<_>>();
    assert_eq!(lifecycle.len(), 2);
    assert_eq!(lifecycle[0].event_type, "item.started");
    assert_eq!(lifecycle[1].event_type, "item.completed");
    assert!(
        event.sequence < lifecycle[0].sequence && lifecycle[0].sequence < lifecycle[1].sequence
    );
    let read = request(
        &server,
        4,
        "thread/read",
        json!({"threadId":parent,"includeTurns":true}),
    )
    .await;
    assert_eq!(hook_items(&read).len(), 1);
    assert_eq!(hook_items(&read)[0]["id"], identity);
    // Request construction injects a transient environment_context before the durable
    // conversation; it is not part of ProviderTurnHistory or the HookPrompt receipt.
    assert_eq!(provider.0.lock().unwrap()[1].messages.last(), Some(&prompt));
    let mut expected = vec![
        user("record"),
        assistant("answer-1"),
        prompt.clone(),
        assistant("answer-2"),
    ];
    turn(&server, 5, &parent, "inspect live").await;
    let live = receive(&mut observations).await;
    assert!(live.receipts.is_empty());
    assert_eq!(
        live.history, expected,
        "live history keeps one prompt between the two assistant steps"
    );
    expected.push(user("inspect live"));
    expected.push(assistant("answer-3"));
    let before = writer.read_session_events(&session).unwrap();
    let target = if fork {
        let forked = request(&server, 6, "thread/fork", json!({"threadId":parent})).await;
        let child = forked["result"]["thread"]["id"]
            .as_str()
            .unwrap()
            .to_string();
        assert_ne!(child, parent);
        assert_eq!(provider.0.lock().unwrap().len(), 3, "fork cannot sample");
        child
    } else {
        drop(server);
        server = AppServer::with_runtime(runtime());
        initialize(&server).await;
        request(&server, 6, "thread/resume", json!({"threadId":parent})).await;
        assert_eq!(
            writer.read_session_events(&session).unwrap(),
            before,
            "cold resume cannot rewrite history"
        );
        parent.clone()
    };
    let recovered = request(
        &server,
        7,
        "thread/read",
        json!({"threadId":target,"includeTurns":true}),
    )
    .await;
    assert_eq!(hook_items(&recovered).len(), 1);
    assert_eq!(hook_items(&recovered)[0]["id"], identity);
    turn(&server, 8, &target, "inspect recovery").await;
    let restored = receive(&mut observations).await;
    assert!(restored.receipts.is_empty());
    assert_eq!(
        restored.history, expected,
        "cold/fork must retain exact prompt content, order and identity without Item duplication"
    );
    assert_eq!(
        restored
            .history
            .iter()
            .filter(|message| **message == prompt)
            .count(),
        1
    );
}

fn user(text: &str) -> CurrentProviderMessage {
    CurrentProviderMessage::user(vec![CurrentProviderContent::Text(text.into())])
}

fn assistant(text: &str) -> CurrentProviderMessage {
    CurrentProviderMessage::assistant(vec![CurrentProviderContent::Text(text.into())])
}

fn hook_items(read: &Value) -> Vec<&Value> {
    read["result"]["thread"]["turns"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|turn| turn["items"].as_array().unwrap())
        .filter(|item| item["type"] == "hookPrompt")
        .collect()
}

async fn receive(
    receiver: &mut mpsc::UnboundedReceiver<backend::Observation>,
) -> backend::Observation {
    tokio::time::timeout(Duration::from_secs(3), receiver.recv())
        .await
        .unwrap()
        .unwrap()
}

async fn turn(server: &AppServer, id: u64, thread: &str, text: &str) -> String {
    let mut outbound = server.subscribe_outbound_messages();
    let response = request(
        server,
        id,
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":text}]}),
    )
    .await;
    let turn = response["result"]["turn"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let event = serde_json::to_value(outbound.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn {
                assert_eq!(event["params"]["turn"]["status"], "completed", "{event}");
                break;
            }
        }
    })
    .await
    .expect("same Turn terminal");
    turn
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"stop-receipt-test","version":"1"}}),
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
