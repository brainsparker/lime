use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

/// 显式测试 provider：首个响应 interrupted，随后正常完成，不访问真实模型。
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
                    .contains("authorization: bearer continuation-fixture-key\r\n"));
                assert_eq!(body["model"], "continuation-model");
                let index = {
                    let mut requests = captured.lock().unwrap();
                    requests.push(body);
                    requests.len()
                };
                let text = if index == 1 {
                    "partial evidence"
                } else {
                    "final evidence"
                };
                let item = format!("message-{index}");
                let response = format!("response-{index}");
                let body = [
                    json!({"type":"response.output_text.delta","item_id":item,"delta":text}),
                    json!({"type":if index == 1 { "response.incomplete" } else { "response.completed" },"response":{
                        "id":response,"end_turn":true,"output":[],
                        "incomplete_details":if index == 1 { json!({"reason":"interrupted"}) } else { Value::Null },
                        "usage":{"input_tokens":10,"output_tokens":3}
                    }}),
                ]
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

async fn read_request(socket: &mut TcpStream) -> (String, Value) {
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
