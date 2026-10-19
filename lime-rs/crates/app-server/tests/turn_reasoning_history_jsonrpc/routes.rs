use super::*;
use std::sync::Mutex;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[derive(Clone, Copy, Debug)]
enum Wire {
    Responses,
    Chat,
    Anthropic,
    Gemini,
}

impl Wire {
    fn provider(self) -> ApiProviderType {
        match self {
            Self::Responses => ApiProviderType::OpenaiResponse,
            Self::Chat => ApiProviderType::Openai,
            Self::Anthropic => ApiProviderType::Anthropic,
            Self::Gemini => ApiProviderType::Gemini,
        }
    }
    fn response(self) -> String {
        let events = match self {
            Self::Responses => vec![
                json!({"type":"response.output_text.delta","item_id":"msg_target","delta":"target answer"}),
                json!({"type":"response.completed","response":{"id":"resp_target","end_turn":true,"output":[],"usage":{"input_tokens":12,"output_tokens":3}}}),
            ],
            Self::Chat => vec![
                json!({"id":"target-chat","object":"chat.completion.chunk","created":0,"model":"target-model","choices":[{"index":0,"delta":{"content":"target answer"},"finish_reason":null}]}),
                json!({"id":"target-chat","object":"chat.completion.chunk","created":0,"model":"target-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}),
            ],
            Self::Anthropic => vec![
                json!({"type":"message_start","message":{"id":"msg_target","type":"message","role":"assistant","model":"target-model","usage":{"input_tokens":12,"output_tokens":0}}}),
                json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}),
                json!({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"target answer"}}),
                json!({"type":"content_block_stop","index":0}),
                json!({"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}),
                json!({"type":"message_stop"}),
            ],
            Self::Gemini => vec![
                json!({"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"target answer"}]}}]}),
                json!({"candidates":[{"index":0,"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":3,"totalTokenCount":15}}),
            ],
        };
        events.iter().map(|e| format!("data: {e}\n\n")).collect()
    }
}

#[tokio::test]
async fn completed_history_switches_responses_route_after_cold_resume() {
    switch(Wire::Responses, true).await;
}
#[tokio::test]
async fn completed_history_switches_to_chat() {
    switch(Wire::Chat, false).await;
}
#[tokio::test]
async fn completed_history_switches_to_anthropic_after_cold_resume() {
    switch(Wire::Anthropic, true).await;
}
#[tokio::test]
async fn completed_history_switches_to_gemini() {
    switch(Wire::Gemini, false).await;
}

async fn switch(wire: Wire, cold: bool) {
    let temp = tempfile::tempdir().unwrap();
    let source = provider::Provider::start().await;
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let target_url = format!("http://{}/v1", listener.local_addr().unwrap());
    let captured = Arc::new(Mutex::new(Vec::<Value>::new()));
    let recorder = captured.clone();
    let target = tokio::spawn(async move {
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            let end = loop {
                let mut buf = [0; 4096];
                let count = socket.read(&mut buf).await.unwrap();
                assert_ne!(count, 0);
                bytes.extend_from_slice(&buf[..count]);
                if let Some(i) = bytes.windows(4).position(|b| b == b"\r\n\r\n") {
                    break i + 4;
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
                .unwrap_or(0);
            while bytes.len() < end + length {
                let mut buf = [0; 4096];
                let count = socket.read(&mut buf).await.unwrap();
                assert_ne!(count, 0);
                bytes.extend_from_slice(&buf[..count]);
            }
            if !headers.starts_with("POST ") {
                socket
                    .write_all(
                        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    )
                    .await
                    .unwrap();
                continue;
            }
            let lower = headers.to_ascii_lowercase();
            match wire {
                Wire::Anthropic => assert!(lower.contains("x-api-key: target-fixture-key\r\n")),
                Wire::Gemini => assert!(lower.contains("target-fixture-key")),
                _ => assert!(lower.contains("authorization: bearer target-fixture-key\r\n")),
            }
            let body: Value = serde_json::from_slice(&bytes[end..end + length]).unwrap();
            if !matches!(wire, Wire::Gemini) {
                assert_eq!(body["model"], "target-model");
            }
            recorder.lock().unwrap().push(body);
            let body = wire.response();
            let header=format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len());
            socket.write_all(header.as_bytes()).await.unwrap();
            socket.write_all(body.as_bytes()).await.unwrap();
        }
    });
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let runtime = || {
        support::runtime_core_with_chat_providers_at(
            &temp,
            &[
                (
                    "history-provider",
                    "history-model",
                    ApiProviderType::OpenaiResponse,
                    &source.url,
                    "history-fixture-key",
                ),
                (
                    "target-provider",
                    "target-model",
                    wire.provider(),
                    &target_url,
                    "target-fixture-key",
                ),
            ],
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
    turn(&server, 3, thread, "record native state").await;
    let original = writer
        .read_session_events(session)
        .unwrap()
        .into_iter()
        .filter(|e| e.event.event_type == "provider.model_history")
        .collect::<Vec<_>>();
    assert_eq!(original.len(), 2, "two native completed records");
    if cold {
        drop(server);
        server = AppServer::with_runtime(runtime());
        initialize(&server).await;
        request(&server, 4, "thread/resume", json!({"threadId":thread})).await;
    }
    request(
        &server,
        5,
        "thread/settings/update",
        json!({"threadId":thread,"modelProvider":"target-provider","model":"target-model"}),
    )
    .await;
    turn(&server, 6, thread, "continue on target").await;
    assert_eq!(source.requests().len(), 1);
    let requests = captured.lock().unwrap().clone();
    assert_eq!(requests.len(), 1, "one target sampling for {wire:?}");
    let payload = requests[0].to_string();
    assert!(
        payload.contains("completed summary")
            && payload.contains("completed answer")
            && payload.contains("continue on target"),
        "portable history missing: {requests:?}"
    );
    for opaque in [
        "fixture-only-opaque-reasoning",
        "completed reasoning content",
        "rs_fixture_history",
        "msg_fixture_history",
        "producer",
        "final_answer",
    ] {
        assert!(
            !payload.contains(opaque),
            "{wire:?} leaked {opaque}: {requests:?}"
        );
    }
    assert_eq!(
        writer
            .read_session_events(session)
            .unwrap()
            .into_iter()
            .filter(|e| e.event.event_type == "provider.model_history")
            .collect::<Vec<_>>(),
        original,
        "route switch must not rewrite native history"
    );
    target.abort();
}
