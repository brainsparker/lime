use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

pub(super) fn reasoning() -> Value {
    json!({
        "type":"reasoning","id":"rs_fixture_history",
        "summary":[{"type":"summary_text","text":"completed summary"}],
        "content":[{"type":"reasoning_text","text":"completed reasoning content"}],
        "encrypted_content":"fixture-only-opaque-reasoning"
    })
}

pub(super) fn message() -> Value {
    json!({
        "type":"message","id":"msg_fixture_history","role":"assistant",
        "phase":"final_answer",
        "content":[{"type":"output_text","text":"completed answer"}]
    })
}

/// 显式 loopback 夹具；完成 item 与展示 delta 同时存在，不连接真实模型。
pub(super) struct Provider {
    pub(super) url: String,
    requests: Arc<Mutex<Vec<Value>>>,
    task: tokio::task::JoinHandle<()>,
}

impl Provider {
    pub(super) async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/v1", listener.local_addr().unwrap());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let captured = requests.clone();
        let task = tokio::spawn(async move {
            loop {
                let (mut socket, _) = listener.accept().await.unwrap();
                let (headers, body) = read_request(&mut socket).await;
                if !headers.starts_with("POST /v1/responses ") {
                    socket.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.unwrap();
                    continue;
                }
                assert!(headers
                    .to_ascii_lowercase()
                    .contains("authorization: bearer history-fixture-key\r\n"));
                assert_eq!(body["model"], "history-model");
                let count = {
                    let mut captured = captured.lock().unwrap();
                    captured.push(body);
                    captured.len()
                };
                let events = if count == 1 {
                    vec![
                        json!({"type":"response.output_item.added","output_index":0,"item":{
                            "type":"reasoning","id":"rs_fixture_history","summary":[]
                        }}),
                        json!({"type":"response.reasoning_summary_text.delta","output_index":0,
                            "item_id":"rs_fixture_history","summary_index":0,"delta":"completed summary"}),
                        json!({"type":"response.reasoning_text.delta","output_index":0,
                            "item_id":"rs_fixture_history","content_index":0,"delta":"completed reasoning content"}),
                        json!({"type":"response.output_item.done","output_index":0,"item":reasoning()}),
                        json!({"type":"response.output_item.added","output_index":1,"item":{
                            "type":"message","id":"msg_fixture_history","role":"assistant",
                            "phase":"final_answer","content":[]
                        }}),
                        json!({"type":"response.output_text.delta","output_index":1,
                            "item_id":"msg_fixture_history","content_index":0,"delta":"completed answer"}),
                        json!({"type":"response.output_item.done","output_index":1,"item":message()}),
                        json!({"type":"response.completed","response":{
                            "id":"resp_fixture_history","end_turn":true,"output":[reasoning(),message()],
                            "usage":{"input_tokens":10,"output_tokens":4}
                        }}),
                    ]
                } else {
                    vec![
                        json!({"type":"response.output_text.delta","item_id":"msg_fixture_later","delta":"later answer"}),
                        json!({"type":"response.completed","response":{
                            "id":"resp_fixture_later","end_turn":true,"output":[],
                            "usage":{"input_tokens":11,"output_tokens":2}
                        }}),
                    ]
                };
                let body = events
                    .iter()
                    .map(|event| format!("data: {event}\n\n"))
                    .collect::<String>();
                let headers = format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                socket.write_all(headers.as_bytes()).await.unwrap();
                socket.write_all(body.as_bytes()).await.unwrap();
            }
        });
        Self {
            url,
            requests,
            task,
        }
    }

    pub(super) fn requests(&self) -> Vec<Value> {
        self.requests.lock().unwrap().clone()
    }
}

impl Drop for Provider {
    fn drop(&mut self) {
        self.task.abort();
    }
}

pub(super) async fn read_request(socket: &mut TcpStream) -> (String, Value) {
    let mut bytes = Vec::new();
    let end = loop {
        let mut buffer = [0; 4096];
        let count = socket.read(&mut buffer).await.unwrap();
        assert_ne!(count, 0, "request ended before headers");
        bytes.extend_from_slice(&buffer[..count]);
        if let Some(start) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
            break start + 4;
        }
    };
    let headers = String::from_utf8(bytes[..end].to_vec()).unwrap();
    let length = headers
        .lines()
        .find_map(|line| {
            let (key, value) = line.split_once(':')?;
            key.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().unwrap())
        })
        .unwrap_or_else(|| {
            assert!(!headers.starts_with("POST "), "sampling requires a body");
            0
        });
    while bytes.len() < end + length {
        let mut buffer = [0; 4096];
        let count = socket.read(&mut buffer).await.unwrap();
        assert_ne!(count, 0, "request ended before body");
        bytes.extend_from_slice(&buffer[..count]);
    }
    let body = if length == 0 {
        Value::Null
    } else {
        serde_json::from_slice(&bytes[end..end + length]).unwrap()
    };
    (headers, body)
}
