use serde_json::Value;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::task::JoinHandle;

pub struct Reply {
    pub status: u16,
    pub body: Value,
    pub headers: String,
    pub bytes: Option<Vec<u8>>,
}
impl Reply {
    pub fn json(body: Value) -> Self {
        Self::status(200, body)
    }
    pub fn status(status: u16, body: Value) -> Self {
        Self {
            status,
            body,
            headers: String::new(),
            bytes: None,
        }
    }
    pub fn empty(status: u16) -> Self {
        Self::status(status, Value::Null)
    }

    #[allow(dead_code)] // Shared with checkout tests; the mutation-only suite uses JSON replies.
    pub fn binary(bytes: Vec<u8>) -> Self {
        Self {
            status: 200,
            body: Value::Null,
            headers: String::new(),
            bytes: Some(bytes),
        }
    }
}
pub struct Request {
    pub headers: String,
    pub body: Vec<u8>,
}

pub async fn fixture(replies: Vec<Reply>) -> (String, JoinHandle<Vec<Request>>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let origin = url.clone();
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for reply in replies {
            let (mut socket, _) = tokio::time::timeout(Duration::from_secs(15), listener.accept())
                .await
                .unwrap()
                .unwrap();
            requests.push(receive(&mut socket).await);
            let body = if let Some(bytes) = reply.bytes {
                bytes
            } else if reply.status == 204 || reply.body.is_null() {
                Vec::new()
            } else {
                reply
                    .body
                    .to_string()
                    .replace("$ORIGIN", &origin)
                    .into_bytes()
            };
            let headers = reply.headers.replace("$ORIGIN", &origin);
            socket.write_all(format!("HTTP/1.1 {} Fixture\r\nContent-Length: {}\r\nConnection: close\r\n{headers}\r\n", reply.status, body.len()).as_bytes()).await.unwrap();
            socket.write_all(&body).await.unwrap();
        }
        requests
    });
    (url, task)
}

pub async fn receive(socket: &mut tokio::net::TcpStream) -> Request {
    let mut bytes = Vec::new();
    let mut buffer = [0; 8192];
    let end = loop {
        if let Some(index) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            break index + 4;
        }
        let size = socket.read(&mut buffer).await.unwrap();
        assert!(size > 0 && bytes.len() < 64 * 1024);
        bytes.extend_from_slice(&buffer[..size]);
    };
    let headers = String::from_utf8(bytes[..end].to_vec()).unwrap();
    let length = headers
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().unwrap())
        })
        .unwrap_or(0);
    assert!(length < 1024 * 1024);
    while bytes.len() < end + length {
        let size = socket.read(&mut buffer).await.unwrap();
        assert!(size > 0);
        bytes.extend_from_slice(&buffer[..size]);
    }
    Request {
        headers,
        body: bytes[end..end + length].to_vec(),
    }
}

pub async fn finish(task: JoinHandle<Vec<Request>>) -> Vec<Request> {
    tokio::time::timeout(Duration::from_secs(20), task)
        .await
        .unwrap()
        .unwrap()
}
