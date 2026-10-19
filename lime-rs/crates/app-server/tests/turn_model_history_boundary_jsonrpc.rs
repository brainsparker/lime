use app_server::{AppServer, EventLogWriter};
use lime_core::database::dao::api_key_provider::ApiProviderType;
use serde_json::{json, Value};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::{io::AsyncWriteExt, net::TcpListener};

#[allow(dead_code)]
#[path = "turn_reasoning_history_jsonrpc/provider.rs"]
mod provider;
mod support;

#[tokio::test]
async fn completed_native_items_survive_a_later_stream_failure_and_cold_resume() {
    run(false).await;
}
#[tokio::test]
async fn completed_native_items_survive_cancellation_and_cold_resume() {
    run(true).await;
}

async fn run(cancel: bool) {
    let temp = tempfile::tempdir().unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/v1", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::<Value>::new()));
    let captured = requests.clone();
    let provider_task = tokio::spawn(async move {
        let mut connections = tokio::task::JoinSet::new();
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let captured = captured.clone();
            connections.spawn(async move {
                let (headers,body)=provider::read_request(&mut socket).await;
                if !headers.starts_with("POST /v1/responses "){socket.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.unwrap();return;}
                assert!(headers.to_ascii_lowercase().contains("authorization: bearer history-fixture-key\r\n"));
                let count={let mut captured=captured.lock().unwrap();captured.push(body);captured.len()};
                let events=if count==1 {vec![
                    json!({"type":"response.output_item.added","output_index":0,"item":{"type":"reasoning","id":"rs_fixture_history","summary":[]}}),
                    json!({"type":"response.reasoning_summary_text.delta","output_index":0,"item_id":"rs_fixture_history","delta":"completed summary"}),
                    json!({"type":"response.output_item.done","output_index":0,"item":provider::reasoning()}),
                    json!({"type":"response.output_item.added","output_index":1,"item":{"type":"message","id":"msg_fixture_history","role":"assistant","content":[]}}),
                    json!({"type":"response.output_text.delta","output_index":1,"item_id":"msg_fixture_history","delta":"completed answer"}),
                    json!({"type":"response.output_item.done","output_index":1,"item":provider::message()}),
                ]}else{vec![json!({"type":"response.output_text.delta","item_id":"msg_later","delta":"after boundary"}),
                    json!({"type":"response.completed","response":{"id":"resp_later","end_turn":true,"output":[]}})]};
                let mut body=events.iter().map(|e|format!("data: {e}\n\n")).collect::<String>();
                if count==1 && cancel {
                    socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n").await.unwrap();
                    socket.write_all(format!("{:x}\r\n{body}\r\n",body.len()).as_bytes()).await.unwrap();
                    std::future::pending::<()>().await;
                }else{
                    if count==1 {body.push_str(&format!("data: {}\n\n",json!({"type":"response.failed","error":{"message":"fixture failure after completed items"}})));}
                    let headers=format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len());
                    socket.write_all(headers.as_bytes()).await.unwrap();socket.write_all(body.as_bytes()).await.unwrap();
                }
            });
        }
    });
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let runtime = || {
        support::runtime_core_with_chat_providers_at(
            &temp,
            &[(
                "history-provider",
                "history-model",
                ApiProviderType::OpenaiResponse,
                &url,
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
    let mut events = server.subscribe_outbound_messages();
    let first=request(&server,3,"turn/start",json!({"threadId":thread,"input":[{"type":"text","text":"complete two items before boundary"}]})).await;
    let first_id = first["result"]["turn"]["id"].as_str().unwrap();
    if cancel {
        tokio::time::timeout(Duration::from_secs(30), async {
            loop {
                // Synchronize on durable history, independently of presentation
                // completion. The provider remains gated before its terminal.
                let committed = writer.read_session_events(session).unwrap();
                let completed = committed
                    .iter()
                    .filter(|record| record.event.event_type == "provider.model_history")
                    .count();
                if completed == 2 {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("both completed native items durably committed before cancellation");
        request(
            &server,
            4,
            "turn/interrupt",
            json!({"threadId":thread,"turnId":first_id}),
        )
        .await;
    }
    terminal(
        &mut events,
        first_id,
        if cancel { "interrupted" } else { "failed" },
    )
    .await;
    let records = writer
        .read_session_events(session)
        .unwrap()
        .into_iter()
        .filter(|record| record.event.event_type == "provider.model_history")
        .collect::<Vec<_>>();
    assert_eq!(
        records.len(),
        2,
        "completed records must commit before failure/cancel"
    );
    assert_eq!(
        requests.lock().unwrap().len(),
        1,
        "failed/canceled sampling must not restart"
    );
    drop(server);
    server = AppServer::with_runtime(runtime());
    initialize(&server).await;
    request(&server, 5, "thread/resume", json!({"threadId":thread})).await;
    let mut events = server.subscribe_outbound_messages();
    let next = request(
        &server,
        6,
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":"resume committed native items"}]}),
    )
    .await;
    let next_id = next["result"]["turn"]["id"].as_str().unwrap();
    terminal(&mut events, next_id, "completed").await;
    let captured = requests.lock().unwrap().clone();
    assert_eq!(captured.len(), 2);
    let input = captured[1]["input"].as_array().unwrap();
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
    assert_eq!(
        writer
            .read_session_events(session)
            .unwrap()
            .into_iter()
            .filter(|record| record.event.event_type == "provider.model_history")
            .collect::<Vec<_>>(),
        records
    );
    provider_task.abort();
}

async fn terminal(
    events: &mut tokio::sync::broadcast::Receiver<app_server_protocol::JsonRpcMessage>,
    turn: &str,
    status: &str,
) {
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let event = serde_json::to_value(events.recv().await.unwrap()).unwrap();
            if event["method"] == "turn/completed" && event["params"]["turn"]["id"] == turn {
                assert_eq!(event["params"]["turn"]["status"], status, "{event}");
                break;
            }
        }
    })
    .await
    .expect("public boundary Turn terminal");
}
async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"history-boundary-fixture","version":"1"}}),
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
