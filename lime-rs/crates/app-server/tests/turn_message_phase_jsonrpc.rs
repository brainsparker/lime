use app_server::{AppServer, EventLogWriter};
use lime_core::database::dao::api_key_provider::ApiProviderType;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use std::time::Duration;
use tokio::{io::AsyncWriteExt, net::TcpListener};

#[allow(dead_code)]
#[path = "turn_reasoning_history_jsonrpc/provider.rs"]
mod provider;
mod support;

#[tokio::test]
async fn native_message_phases_survive_public_completion_and_cold_read() {
    run(true, "completed").await;
}

#[tokio::test]
async fn delta_only_message_phase_stays_unknown_after_cold_read() {
    run(false, "completed").await;
}

#[tokio::test]
async fn completed_native_message_phases_survive_later_provider_failure() {
    run(true, "failed").await;
}

#[tokio::test]
async fn completed_native_message_phases_survive_later_cancellation() {
    run(true, "interrupted").await;
}

async fn run(native: bool, status: &'static str) {
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
            let mut events = Vec::new();
            let phases = if native {
                vec![
                    Some("commentary"),
                    Some("partial_answer"),
                    Some("final_answer"),
                    None,
                ]
            } else {
                vec![None]
            };
            for (index, phase) in phases.into_iter().enumerate() {
                let id = format!("msg_phase_{index}");
                let text = format!("phase message {index}");
                let mut item = json!({"type":"message","id":id,"role":"assistant","content":[]});
                if let Some(phase) = phase {
                    item["phase"] = json!(phase);
                }
                events.push(
                    json!({"type":"response.output_item.added","output_index":index,"item":item}),
                );
                events.push(json!({"type":"response.output_text.delta","output_index":index,"item_id":id,"content_index":0,"delta":text}));
                item["content"] = json!([{"type":"output_text","text":text}]);
                if native {
                    events.push(json!({"type":"response.output_item.done","output_index":index,"item":item}));
                }
            }
            let body = events
                .iter()
                .map(|event| format!("data: {event}\n\n"))
                .collect::<String>();
            socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n").await.unwrap();
            socket
                .write_all(format!("{:x}\r\n{body}\r\n", body.len()).as_bytes())
                .await
                .unwrap();
            // The response terminal cannot arrive before all native Item completions.
            if native {
                gate.notified().await;
            }
            let terminal = if status == "failed" {
                json!({"type":"response.failed","error":{"message":"fixture failure after completed message Items"}})
            } else {
                json!({"type":"response.completed","response":{"id":"resp_phases","end_turn":true,"output":[]}})
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
                "phase-provider",
                "phase-model",
                ApiProviderType::OpenaiResponse,
                &url,
                "phase-fixture-key",
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
        json!({"cwd":temp.path(),"modelProvider":"phase-provider","model":"phase-model"}),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let mut notifications = server.subscribe_outbound_messages();
    let started = request(
        &server,
        3,
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":"preserve native phases"}]}),
    )
    .await;
    let turn = started["result"]["turn"]["id"].as_str().unwrap();
    let completed = tokio::time::timeout(Duration::from_secs(30), async {
        let mut items = Vec::new();
        loop {
            let event = serde_json::to_value(notifications.recv().await.unwrap()).unwrap();
            if event["params"]["turnId"] == turn
                && event["method"] == "item/completed"
                && event["params"]["item"]["type"] == "agentMessage"
            {
                assert_eq!(event["params"]["threadId"], thread);
                items.push(event["params"]["item"].clone());
                if native && items.len() == 4 {
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
            }
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn {
                assert_eq!(event["params"]["turn"]["status"], status, "{event}");
                break items;
            }
        }
    })
    .await
    .expect("public phase Turn terminal");
    assert_phases(&completed, native);
    let live = request(
        &server,
        4,
        "thread/read",
        json!({"threadId":thread,"includeTurns":true}),
    )
    .await;
    assert_phases(&messages(&live), native);
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
    assert_phases(&messages(&cold), native);
    assert_eq!(
        messages(&live),
        messages(&cold),
        "cold projection must preserve identity and phase"
    );
    assert_eq!(
        requests.load(Ordering::SeqCst),
        1,
        "phase and cold reads must not resample"
    );
    task.abort();
}

fn messages(response: &Value) -> Vec<Value> {
    response["result"]["thread"]["turns"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|turn| turn["items"].as_array().unwrap())
        .filter(|item| item["type"] == "agentMessage")
        .cloned()
        .collect()
}

fn assert_phases(items: &[Value], native: bool) {
    assert_eq!(
        items.len(),
        if native { 4 } else { 1 },
        "one completed Item per message: {items:?}"
    );
    let phases = items
        .iter()
        .map(|item| item["phase"].clone())
        .collect::<Vec<_>>();
    assert_eq!(
        phases,
        if native {
            vec![
                json!("commentary"),
                json!("partial_answer"),
                json!("final_answer"),
                Value::Null,
            ]
        } else {
            vec![Value::Null]
        }
    );
    for (index, item) in items.iter().enumerate() {
        assert_eq!(item["text"], format!("phase message {index}"));
    }
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"phase-fixture","version":"1"}}),
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
