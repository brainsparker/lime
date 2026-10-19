use super::*;
use serde_json::json;

fn current_request(raw: &str) -> CurrentProviderRequest {
    CurrentProviderRequest::new(vec![CurrentProviderMessage::assistant(vec![
        CurrentProviderContent::ToolCall(CurrentProviderToolCall::from_raw(
            "original-call".to_string(),
            "read_file".to_string(),
            raw.to_string(),
        )),
    ])])
}

fn request(raw: &str) -> CanonicalRequest {
    current_request(raw).into_canonical("model").unwrap()
}

#[test]
fn raw_original_arguments_survive_chat_and_responses_lowering() {
    for original in [
        r#"{ "file_path": " source.txt ", "offset": 1e2 }"#,
        "{not-json",
    ] {
        let request = request(original);
        let config = super::tests::config(Some(RuntimeProviderProtocol::Responses));
        let shape = RuntimeReplyProviderRequestWireShape::default();
        let chat = chat_completions_request(&config, &request, &shape, &BTreeMap::new()).unwrap();
        let responses = responses_request(&config, &request, &shape, &BTreeMap::new()).unwrap();
        assert_eq!(
            chat["messages"][0]["tool_calls"][0]["function"]["name"],
            "read_file"
        );
        assert_eq!(
            chat["messages"][0]["tool_calls"][0]["function"]["arguments"],
            original
        );
        assert_eq!(responses["input"][0]["arguments"], original);
        assert_eq!(responses["input"][0]["call_id"], "original-call");
        for wire in [chat, responses] {
            assert!(!wire.to_string().contains("raw_arguments"));
        }
    }
}

#[test]
fn raw_original_arguments_keep_structured_anthropic_and_gemini_history() {
    let original = r#"{ "file_path": " source.txt ", "start_line": "2" }"#;
    let request = request(original);
    let config = super::tests::config(Some(RuntimeProviderProtocol::AnthropicMessages));
    let anthropic = anthropic_request(&config, &request, &BTreeMap::new()).unwrap();
    let gemini = gemini::request(&request, &BTreeMap::new()).unwrap();
    let expected: Value = serde_json::from_str(original).unwrap();
    assert_eq!(anthropic["messages"][0]["content"][0]["name"], "read_file");
    assert_eq!(anthropic["messages"][0]["content"][0]["input"], expected);
    assert_eq!(
        gemini["contents"][0]["parts"][0]["functionCall"]["name"],
        "read_file"
    );
    assert_eq!(
        gemini["contents"][0]["parts"][0]["functionCall"]["args"],
        expected
    );
    assert_eq!(
        expected,
        json!({"file_path":" source.txt ","start_line":"2"})
    );
    assert!(!anthropic.to_string().contains("raw_arguments"));
    assert!(!gemini.to_string().contains("raw_arguments"));
}

#[test]
fn structured_history_rejects_non_object_original_arguments_without_mutation() {
    for raw in ["{private-not-json", "[]", "null", r#""private-string""#] {
        let request = request(raw);
        let original = request.clone();
        let config = super::tests::config(Some(RuntimeProviderProtocol::AnthropicMessages));
        for result in [
            anthropic_request(&config, &request, &BTreeMap::new()),
            gemini::request(&request, &BTreeMap::new()),
        ] {
            let error = result.expect_err("structured native history must reject non-object input");
            assert_eq!(
                error.classification,
                Some(FailureClassification::InvalidRequest)
            );
            assert!(!error.retryable);
            assert!(error.message.contains("original tool arguments"));
            assert!(!error.message.contains(raw));
        }
        assert_eq!(request, original);
    }
}

#[test]
fn structured_history_rejects_a_rewritten_parsed_copy() {
    let mut request = request(r#"{"path":"private-original.txt"}"#);
    let ContentPart::ToolCall { input, .. } = &mut request.messages[0].content[0] else {
        panic!("expected canonical call");
    };
    *input = json!({"path":"rewritten.txt"});
    let config = super::tests::config(Some(RuntimeProviderProtocol::AnthropicMessages));
    for result in [
        anthropic_request(&config, &request, &BTreeMap::new()),
        gemini::request(&request, &BTreeMap::new()),
    ] {
        let error = result.expect_err("raw original and parsed copy must agree");
        assert_eq!(
            error.classification,
            Some(FailureClassification::InvalidRequest)
        );
        assert!(!error.retryable);
        assert!(!error.message.contains("private-original"));
        assert!(!error.message.contains("rewritten"));
    }
}

#[tokio::test]
async fn structured_history_is_rejected_before_provider_http() {
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    use tokio::io::AsyncWriteExt;

    for protocol in [
        RuntimeProviderProtocol::AnthropicMessages,
        RuntimeProviderProtocol::GeminiGenerateContent,
    ] {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let count = Arc::new(AtomicUsize::new(0));
        let observed = count.clone();
        let task = tokio::spawn(async move {
            loop {
                let (mut socket, _) = listener.accept().await.unwrap();
                observed.fetch_add(1, Ordering::SeqCst);
                socket.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.unwrap();
            }
        });
        let mut config = super::tests::config(Some(protocol));
        config.base_url = Some(format!("http://{address}/v1"));
        let client = CurrentProviderClient::new(config).unwrap();
        let response = tokio::time::timeout(
            Duration::from_secs(5),
            client.stream(current_request("{private-not-json")),
        )
        .await
        .expect("local representation error must not wait for transport");
        let error = match response {
            Err(error) => error,
            Ok(_) => panic!("non-representable history must fail before streaming"),
        };
        task.abort();
        assert_eq!(
            count.load(Ordering::SeqCst),
            0,
            "invalid history reached HTTP"
        );
        assert_eq!(
            error.classification,
            Some(FailureClassification::InvalidRequest)
        );
        assert!(!error.retryable);
        assert!(!error.message.contains("private-not-json"));
    }
}
