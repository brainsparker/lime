use super::*;

fn message(
    protocol: &str,
    source: &str,
    parts: Vec<Value>,
    config: &RuntimeProviderConfig,
) -> CurrentProviderMessage {
    let CanonicalLlmEvent::ResponseItemDone { item, .. } = completed(protocol, source, parts)
    else {
        unreachable!()
    };
    let mut message = CurrentProviderMessage::raw_response_item(item);
    message.producer = Some(health::history_producer(config));
    message
}

#[test]
fn signed_blocks_replay_exactly_on_the_original_route_and_lower_on_route_change() {
    for (protocol, wire, parts) in [
        (
            "anthropic",
            RuntimeProviderProtocol::AnthropicMessages,
            vec![json!({"type":"thinking","thinking":"first second","signature":"signed-value"})],
        ),
        (
            "gemini",
            RuntimeProviderProtocol::GeminiGenerateContent,
            vec![
                json!({"text":"first ","thought":true}),
                json!({"text":"second","thought":true,"thoughtSignature":"signed-value"}),
            ],
        ),
    ] {
        let config = super::super::tests::config(Some(wire));
        let original = message(protocol, "reasoning-0", parts.clone(), &config);
        let request = CurrentProviderRequest::new(vec![original.clone()]);
        let prepared = history::prepare_request(request.clone(), &config).unwrap();
        assert_eq!(prepared.messages, request.messages);
        let canonical = prepared.into_canonical("model").unwrap();
        let replay = if protocol == "anthropic" {
            lowering::anthropic_request(&config, &canonical, &BTreeMap::new()).unwrap()["messages"]
                [0]["content"]
                .clone()
        } else {
            gemini::request(&canonical, &BTreeMap::new()).unwrap()["contents"][0]["parts"].clone()
        };
        assert_eq!(replay, json!(parts));
        for changed in ["model", "endpoint", "credential", "protocol"] {
            let mut target = config.clone();
            match changed {
                "model" => target.model_name = "another-model".into(),
                "endpoint" => target.base_url = Some("https://different.invalid".into()),
                "credential" => target.credential_uuid = "another-key".into(),
                "protocol" => target.protocol = Some(RuntimeProviderProtocol::ChatCompletions),
                _ => unreachable!(),
            }
            let prepared = history::prepare_request(request.clone(), &target).unwrap();
            assert_eq!(
                prepared.messages,
                vec![CurrentProviderMessage::assistant(vec![
                    CurrentProviderContent::Reasoning("first second".into())
                ])],
                "{protocol}/{changed}"
            );
            assert_eq!(request.messages, vec![original.clone()]);
        }
        let mut unsigned = original;
        unsigned.producer = None;
        assert!(
            history::prepare_request(CurrentProviderRequest::new(vec![unsigned]), &config).is_err()
        );
    }
}

#[test]
fn signed_gemini_text_retains_its_signature_but_cross_route_text_is_portable() {
    let config = super::super::tests::config(Some(RuntimeProviderProtocol::GeminiGenerateContent));
    let parts = vec![json!({"text":"answer","thoughtSignature":"text-signature"})];
    let message = message("gemini", "text-0", parts.clone(), &config);
    let canonical =
        history::prepare_request(CurrentProviderRequest::new(vec![message.clone()]), &config)
            .unwrap()
            .into_canonical("model")
            .unwrap();
    assert_eq!(
        gemini::request(&canonical, &BTreeMap::new()).unwrap()["contents"][0]["parts"],
        json!(parts)
    );
    let mut target = config;
    target.model_name = "other-model".into();
    assert_eq!(
        history::prepare_request(CurrentProviderRequest::new(vec![message]), &target)
            .unwrap()
            .messages,
        vec![CurrentProviderMessage::assistant(vec![
            CurrentProviderContent::Text("answer".into())
        ])]
    );
}
