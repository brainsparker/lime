use lime_core::database::dao::api_key_provider::ApiProviderType;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

pub(super) const REASONING: &str = "final reasoning retained across cold recovery";
pub(super) const PORTABLE_ANSWER: &str = "portable visible assistant answer";

#[derive(Clone, Copy, Debug)]
pub(super) enum Wire {
    Chat,
    Responses,
    Anthropic,
    Gemini,
}

impl Wire {
    pub(super) fn provider_type(self) -> ApiProviderType {
        match self {
            Self::Chat => ApiProviderType::Openai,
            Self::Responses => ApiProviderType::OpenaiResponse,
            Self::Anthropic => ApiProviderType::Anthropic,
            Self::Gemini => ApiProviderType::Gemini,
        }
    }

    pub(super) fn assert_route(self, capture: &Capture) {
        let headers = capture.headers.to_ascii_lowercase();
        match self {
            Self::Chat | Self::Responses => {
                assert_eq!(capture.body["model"], "final-model");
                let path = if matches!(self, Self::Chat) {
                    "/v1/chat/completions"
                } else {
                    "/v1/responses"
                };
                assert!(capture.headers.starts_with(&format!("POST {path} ")));
                assert!(headers.contains("authorization: bearer final-fixture-key\r\n"));
            }
            Self::Anthropic => {
                assert_eq!(capture.body["model"], "final-model");
                assert!(capture.headers.starts_with("POST /v1/messages "));
                assert!(headers.contains("x-api-key: final-fixture-key\r\n"));
                assert!(headers.contains("anthropic-version:"));
            }
            Self::Gemini => {
                assert!(capture
                    .headers
                    .contains("/models/final-model:streamGenerateContent"));
                assert!(headers.contains("x-goog-api-key: final-fixture-key\r\n"));
            }
        }
    }

    pub(super) fn history(self, body: &Value) -> &Value {
        &body[match self {
            Self::Responses => "input",
            Self::Gemini => "contents",
            Self::Chat | Self::Anthropic => "messages",
        }]
    }

    fn response(self, reasoning: bool, later: bool, receipts: bool) -> String {
        let mut events = Vec::new();
        match self {
            Self::Chat => {
                let delta = if later {
                    json!({"content":"later response"})
                } else if reasoning {
                    json!({"reasoning_content":REASONING})
                } else {
                    json!({})
                };
                events.push(json!({"id":"final-chat","object":"chat.completion.chunk","created":0,"model":"final-model","choices":[{"index":0,"delta":delta,"finish_reason":null}]}));
                if receipts && !later {
                    events.push(json!({"id":"final-chat","object":"chat.completion.chunk","created":0,"model":"final-model","choices":[{"index":0,"delta":{"content":PORTABLE_ANSWER},"finish_reason":null}]}));
                }
                events.push(json!({"id":"final-chat","object":"chat.completion.chunk","created":0,"model":"final-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}));
            }
            Self::Responses => {
                if later {
                    events.push(json!({"type":"response.output_text.delta","item_id":"later-text","delta":"later response"}));
                } else if reasoning {
                    events.push(json!({"type":"response.output_item.added","output_index":0,"item":{"type":"reasoning","id":"final-reasoning","summary":[],"encrypted_content":receipts.then_some("portable-responses-encrypted")}}));
                    events.push(json!({"type":"response.reasoning_text.delta","item_id":"final-reasoning","content_index":0,"delta":REASONING}));
                    if receipts {
                        events.push(json!({"type":"response.output_item.done","output_index":0,
                            "item":{"type":"reasoning","id":"final-reasoning","summary":[],
                                "content":[{"type":"reasoning_text","text":REASONING}],
                                "encrypted_content":"portable-responses-encrypted"}}));
                    }
                }
                if receipts && !later {
                    events.push(json!({"type":"response.output_item.done","output_index":1,
                        "item":{"type":"message","id":"portable-answer","role":"assistant",
                            "content":[{"type":"output_text","text":PORTABLE_ANSWER}]}}));
                }
                events.push(json!({"type":"response.completed","response":{"id":"final-responses","end_turn":true,"output":[],"usage":{"input_tokens":10,"output_tokens":4}}}));
            }
            Self::Anthropic => {
                events.push(json!({"type":"message_start","message":{"id":"final-anthropic","type":"message","role":"assistant","model":"final-model","usage":{"input_tokens":10,"output_tokens":0}}}));
                if later {
                    events.push(json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":"later response"}}));
                } else if reasoning {
                    events.push(json!({"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":if receipts { "" } else { "final-fixture-signature" }}}));
                    events.push(json!({"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":REASONING}}));
                    if receipts {
                        for signature in ["final-fixture-", "signature"] {
                            events.push(json!({"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":signature}}));
                        }
                    }
                }
                if later || reasoning {
                    events.push(json!({"type":"content_block_stop","index":0}));
                }
                if receipts && !later {
                    events.push(json!({"type":"content_block_start","index":1,"content_block":{"type":"text","text":PORTABLE_ANSWER}}));
                    events.push(json!({"type":"content_block_stop","index":1}));
                }
                events.push(json!({"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":10,"output_tokens":4}}));
                events.push(json!({"type":"message_stop"}));
            }
            Self::Gemini => {
                if later || reasoning {
                    let mut part = if later {
                        json!({"text":"later response"})
                    } else {
                        json!({"text":REASONING,"thought":true})
                    };
                    if receipts && reasoning && !later {
                        part["thoughtSignature"] = json!("portable-gemini-signature");
                    }
                    events.push(json!({"candidates":[{"index":0,"content":{"role":"model","parts":[part]}}]}));
                }
                if receipts && !later {
                    events.push(json!({"candidates":[{"index":0,"content":{"role":"model","parts":[{
                        "text":PORTABLE_ANSWER,"thoughtSignature":"portable-gemini-text-signature"
                    }]}}]}));
                }
                events.push(json!({"candidates":[{"index":0,"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":4,"totalTokenCount":14}}));
            }
        }
        events
            .iter()
            .map(|event| format!("data: {event}\n\n"))
            .collect()
    }
}

#[derive(Clone)]
pub(super) struct Capture {
    pub(super) headers: String,
    pub(super) body: Value,
}

/// 显式 loopback 夹具；首个请求正常结束且没有可见文本，其余请求返回文本。
pub(super) struct Provider {
    pub(super) url: String,
    requests: Arc<Mutex<Vec<Capture>>>,
    task: tokio::task::JoinHandle<()>,
}

impl Provider {
    pub(super) async fn start(wire: Wire, reasoning: bool) -> Self {
        Self::start_with_receipts(wire, reasoning, false).await
    }

    pub(super) async fn start_with_receipts(wire: Wire, reasoning: bool, receipts: bool) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/v1", listener.local_addr().unwrap());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let captured = requests.clone();
        let task = tokio::spawn(async move {
            loop {
                let (mut socket, _) = listener.accept().await.unwrap();
                let request = read_request(&mut socket).await;
                if !request.headers.starts_with("POST ") {
                    socket.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.unwrap();
                    continue;
                }
                let count = {
                    let mut captured = captured.lock().unwrap();
                    captured.push(request);
                    captured.len()
                };
                let body = wire.response(reasoning, count > 1, receipts);
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

    pub(super) fn requests(&self) -> Vec<Capture> {
        self.requests.lock().unwrap().clone()
    }
}

impl Drop for Provider {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn read_request(socket: &mut TcpStream) -> Capture {
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
    Capture { headers, body }
}
