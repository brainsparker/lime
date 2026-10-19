use app_server::{AppServer, EventLogWriter};
use lime_core::database::dao::api_key_provider::ApiProviderType;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use std::time::Duration;
use tokio::{io::AsyncWriteExt, net::TcpListener};

#[path = "turn_reasoning_snapshot_jsonrpc/edge_cases.rs"]
mod edge_cases;
#[allow(dead_code)]
#[path = "turn_reasoning_history_jsonrpc/provider.rs"]
mod provider;
mod support;

#[tokio::test]
async fn completed_reasoning_without_deltas_is_public_before_response_terminal() {
    run(false).await;
}

#[tokio::test]
async fn completed_reasoning_replaces_partial_summary_and_content_by_identity() {
    run(true).await;
}

async fn run(partial: bool) {
    run_case(
        partial,
        &["authoritative summary", "second summary"],
        &["authoritative content", "second content"],
        "completed",
        false,
    )
    .await;
}

async fn run_case(
    partial: bool,
    summary: &'static [&'static str],
    content: &'static [&'static str],
    status: &'static str,
    without_added: bool,
) {
    let temp = tempfile::tempdir().unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/v1", listener.local_addr().unwrap());
    let requests = Arc::new(AtomicUsize::new(0));
    let captured = requests.clone();
    let terminal_gate = Arc::new(tokio::sync::Notify::new());
    let gate = terminal_gate.clone();
    let task = tokio::spawn(async move {
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (headers, _) = provider::read_request(&mut socket).await;
            if !headers.starts_with("POST /v1/responses ") {
                socket
                    .write_all(
                        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    )
                    .await
                    .unwrap();
                continue;
            }
            captured.fetch_add(1, Ordering::SeqCst);
            let mut events = vec![json!({"type":"response.output_item.added","output_index":0,
                "item":{"type":"reasoning","id":"rs_snapshot","summary":[]}})];
            if without_added {
                events.clear();
            }
            if partial {
                events.extend([
                    json!({"type":"response.reasoning_summary_text.delta","output_index":0,
                        "item_id":"rs_snapshot","summary_index":0,"delta":"partial summary"}),
                    json!({"type":"response.reasoning_text.delta","output_index":0,
                        "item_id":"rs_snapshot","content_index":0,"delta":"partial content"}),
                ]);
            }
            let item = json!({"type":"reasoning","id":"rs_snapshot",
                "summary":summary.iter().map(|text|json!({"type":"summary_text","text":text})).collect::<Vec<_>>(),
                "content":content.iter().enumerate().map(|(index,text)|json!({"type":if index==0 {"reasoning_text"}else{"text"},"text":text})).collect::<Vec<_>>(),
                "encrypted_content":"opaque-fixture-ciphertext-must-not-be-public"});
            events.push(json!({"type":"response.output_item.done","output_index":0,"item":item}));
            let body = events
                .iter()
                .map(|event| format!("data: {event}\n\n"))
                .collect::<String>();
            socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n").await.unwrap();
            socket
                .write_all(format!("{:x}\r\n{body}\r\n", body.len()).as_bytes())
                .await
                .unwrap();
            // A completed public Item must arrive before this response can terminate.
            gate.notified().await;
            let terminal = if status == "failed" {
                json!({"type":"response.failed","error":{"message":"fixture failure after completed reasoning"}})
            } else {
                json!({"type":"response.completed","response":{"id":"resp_snapshot","end_turn":true,"output":[item]}})
            };
            let terminal = format!("data: {terminal}\n\n");
            socket
                .write_all(format!("{:x}\r\n{terminal}\r\n0\r\n\r\n", terminal.len()).as_bytes())
                .await
                .unwrap();
        }
    });
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let runtime = || {
        support::runtime_core_with_chat_providers_at(
            &temp,
            &[(
                "snapshot-provider",
                "snapshot-model",
                ApiProviderType::OpenaiResponse,
                &url,
                "snapshot-fixture-key",
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
        json!({"cwd":temp.path(),
        "modelProvider":"snapshot-provider","model":"snapshot-model"}),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let mut notifications = server.subscribe_outbound_messages();
    let started = request(
        &server,
        3,
        "turn/start",
        json!({"threadId":thread,
        "input":[{"type":"text","text":"show the completed reasoning snapshot"}]}),
    )
    .await;
    let turn = started["result"]["turn"]["id"].as_str().unwrap();
    let completed = tokio::time::timeout(Duration::from_secs(30), async {
        let mut items = Vec::new();
        let mut started_ids = Vec::new();
        loop {
            let event = serde_json::to_value(notifications.recv().await.unwrap()).unwrap();
            if event["params"]["turnId"] == turn
                && event["method"] == "item/started"
                && event["params"]["item"]["type"] == "reasoning"
            {
                started_ids.push(event["params"]["item"]["id"].clone());
            }
            if event["params"]["turnId"] == turn
                && event["method"] == "item/completed"
                && event["params"]["item"]["type"] == "reasoning"
            {
                assert_eq!(event["params"]["threadId"], thread);
                let item = event["params"]["item"].clone();
                assert_eq!(started_ids, vec![item["id"].clone()]);
                assert_eq!(item["summary"], json!(summary));
                assert_eq!(item["content"], json!(content));
                assert!(!item.to_string().contains("opaque-fixture-ciphertext"));
                assert!(item.get("producer").is_none());
                items.push(item);
                assert_eq!(items.len(), 1, "one completed Item per native identity");
                if status == "interrupted" {
                    request(
                        &server,
                        20,
                        "turn/interrupt",
                        json!({"threadId":thread,"turnId":turn}),
                    )
                    .await;
                } else {
                    terminal_gate.notify_one();
                }
            }
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn {
                assert_eq!(event["params"]["turn"]["status"], status, "{event}");
                assert_eq!(
                    items.len(),
                    1,
                    "reasoning must complete before response terminal"
                );
                break items;
            }
        }
    })
    .await
    .expect("public reasoning snapshot must arrive before gated response terminal");
    let live = request(
        &server,
        4,
        "thread/read",
        json!({"threadId":thread,"includeTurns":true}),
    )
    .await;
    assert_eq!(reasoning_items(&live), completed);
    assert!(!live.to_string().contains("opaque-fixture-ciphertext"));
    drop(server);
    server = AppServer::with_runtime(runtime());
    initialize(&server).await;
    let cold = request(
        &server,
        5,
        "thread/read",
        json!({"threadId":thread,"includeTurns":true}),
    )
    .await;
    assert_eq!(
        reasoning_items(&cold),
        completed,
        "cold content and identity must match live"
    );
    assert!(!cold.to_string().contains("opaque-fixture-ciphertext"));
    assert_eq!(
        requests.load(Ordering::SeqCst),
        1,
        "completion and reads must not resample"
    );
    task.abort();
}

fn reasoning_items(response: &Value) -> Vec<Value> {
    response["result"]["thread"]["turns"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|turn| turn["items"].as_array().unwrap())
        .filter(|item| item["type"] == "reasoning")
        .cloned()
        .collect()
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"reasoning-snapshot-fixture","version":"1"}}),
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
        .unwrap();
    assert!(response.get("error").is_none(), "{method}: {response}");
    response
}
