use super::*;
use crate::current_client::{
    CurrentProviderClient, CurrentProviderContent, CurrentProviderMessage,
    CurrentProviderRequest,
};
use crate::runtime_provider::RuntimeProviderProtocol;
use futures::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};
use tokio_tungstenite::tungstenite::Message;

#[tokio::test]
async fn interrupted_sampling_keeps_the_websocket_for_the_next_request() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
        let mut requests = Vec::new();
        for index in 0..2 {
            let Message::Text(request) = socket.next().await.unwrap().unwrap() else {
                panic!("expected response.create");
            };
            requests.push(serde_json::from_str::<Value>(&request).unwrap());
            let mut response = json!({
                "id": format!("ws-completion-{index}"),
                "end_turn": true,
                "output": [],
                "usage": {"input_tokens": 10, "output_tokens": 3}
            });
            if index == 0 {
                response["incomplete_details"] = json!({"reason": "interrupted"});
            }
            socket
                .send(Message::Text(
                    json!({
                        "type": if index == 0 { "response.incomplete" } else { "response.completed" },
                        "response": response
                    })
                    .to_string(),
                ))
                .await
                .unwrap();
        }
        requests
    });
    let mut config = crate::current_client::tests::config(Some(RuntimeProviderProtocol::Responses));
    config.base_url = Some(format!("http://{address}"));
    config.supports_websockets = true;
    let client = CurrentProviderClient::new(config).unwrap();
    for index in 0..2 {
        let events = timeout(Duration::from_secs(2), async {
            client
                .stream(CurrentProviderRequest::new(vec![
                    CurrentProviderMessage::user(vec![CurrentProviderContent::Text(format!(
                        "sampling-{index}"
                    ))]),
                ]))
                .await
                .unwrap()
                .collect::<Vec<_>>()
                .await
                .into_iter()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        })
        .await
        .expect("same WebSocket must finish both samplings without HTTP fallback");
        let usage = responses_usage(&json!({"input_tokens": 10, "output_tokens": 3}));
        assert_eq!(
            events,
            vec![
                LlmEvent::Usage {
                    usage: usage.clone()
                },
                LlmEvent::Finish {
                    reason: FinishReason::Stop,
                    usage: Some(usage),
                    needs_follow_up: index == 0,
                    response_id: Some(format!("ws-completion-{index}")),
                },
            ]
        );
    }
    let requests = timeout(Duration::from_secs(2), server)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(requests.len(), 2);
    for (index, request) in requests.iter().enumerate() {
        assert_eq!(request["type"], "response.create");
        assert_eq!(request["model"], "gpt-5-codex");
        assert_eq!(
            request["input"][0]["content"][0]["text"],
            format!("sampling-{index}")
        );
        assert!(request.get("stream").is_none());
        assert!(request.get("background").is_none());
    }
}
