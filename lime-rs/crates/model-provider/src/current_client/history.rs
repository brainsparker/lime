use super::*;

/// Only request copies lose provider-specific state. Durable completed envelopes
/// retain their identity and can be replayed again on their original route.
pub(super) fn prepare_request(
    mut request: CurrentProviderRequest,
    config: &RuntimeProviderConfig,
) -> Result<CurrentProviderRequest, CurrentProviderError> {
    let producer = health::history_producer(config);
    let mut messages = Vec::with_capacity(request.messages.len());
    for mut message in request.messages {
        if message
            .producer
            .as_ref()
            .is_some_and(|origin| origin != &producer)
        {
            if message.role != CurrentProviderRole::Assistant {
                return Err(invalid_history());
            }
            message.content = message
                .content
                .iter()
                .map(portable_content)
                .collect::<Result<Vec<_>, _>>()?
                .into_iter()
                .flatten()
                .collect();
            message.producer = None;
            if message.content.is_empty() {
                continue;
            }
        }
        messages.push(message);
    }
    request.messages = messages;
    Ok(request)
}

fn portable_content(
    part: &CurrentProviderContent,
) -> Result<Vec<CurrentProviderContent>, CurrentProviderError> {
    let CurrentProviderContent::RawResponseItem(item) = part else {
        return Err(invalid_history());
    };
    let (parts, kind, field) = match item.get("type").and_then(Value::as_str) {
        Some("message") if item.get("role").and_then(Value::as_str) == Some("assistant") => {
            (item.get("content"), "output_text", "text")
        }
        Some("reasoning") => (item.get("summary"), "summary_text", "text"),
        _ => return Err(invalid_history()),
    };
    let Some(parts) = parts.and_then(Value::as_array) else {
        return Err(invalid_history());
    };
    let mut content = Vec::new();
    for part in parts {
        let text = match part.get("type").and_then(Value::as_str) {
            Some(value) if value == kind => part.get(field).and_then(Value::as_str),
            Some("refusal") if kind == "output_text" => part.get("refusal").and_then(Value::as_str),
            _ => return Err(invalid_history()),
        }
        .ok_or_else(invalid_history)?;
        if !text.is_empty() {
            content.push(CurrentProviderContent::Text(text.to_string()));
        }
    }
    Ok(content)
}

fn invalid_history() -> CurrentProviderError {
    CurrentProviderError::invalid_request(
        "completed native history cannot be represented on the selected route",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn request(config: &RuntimeProviderConfig) -> CurrentProviderRequest {
        let mut reasoning = CurrentProviderMessage::raw_response_item(json!({
            "type":"reasoning","id":"rs_native","summary":[{"type":"summary_text","text":"public summary"}],
            "content":[{"type":"reasoning_text","text":"private reasoning"}],"encrypted_content":"fixture-ciphertext"
        }));
        reasoning.producer = Some(health::history_producer(config));
        let mut answer = CurrentProviderMessage::raw_response_item(json!({
            "type":"message","role":"assistant","id":"msg_native","phase":"final_answer",
            "content":[{"type":"output_text","text":"visible answer"}]
        }));
        answer.producer = reasoning.producer.clone();
        CurrentProviderRequest::new(vec![
            reasoning,
            answer,
            CurrentProviderMessage::user(vec![CurrentProviderContent::Text("next".to_string())]),
        ])
    }

    #[test]
    fn model_name_switch_on_the_same_provider_preserves_native_history() {
        let source = super::super::tests::config(Some(RuntimeProviderProtocol::Responses));
        let original = request(&source);
        let mut target = source.clone();
        target.model_name = "another-model".to_string();
        let copy = prepare_request(original.clone(), &target).unwrap();
        assert_eq!(copy.messages, original.messages);
    }

    #[test]
    fn route_switch_keeps_portable_content_and_never_mutates_persisted_state() {
        let source = super::super::tests::config(Some(RuntimeProviderProtocol::Responses));
        let original = request(&source);
        let mut routes = Vec::new();
        for protocol in [
            RuntimeProviderProtocol::Responses,
            RuntimeProviderProtocol::ChatCompletions,
            RuntimeProviderProtocol::AnthropicMessages,
            RuntimeProviderProtocol::GeminiGenerateContent,
        ] {
            let mut target = source.clone();
            target.protocol = Some(protocol);
            target.base_url = Some("https://different.invalid/v1".to_string());
            routes.push(target);
        }
        let mut credential = source.clone();
        credential.credential_uuid = "other-credential".to_string();
        routes.push(credential);
        let mut version = source.clone();
        version.api_version = Some("another-version".to_string());
        routes.push(version);
        for target in routes {
            let copy = prepare_request(original.clone(), &target).unwrap();
            assert_eq!(
                copy.messages,
                vec![
                    CurrentProviderMessage::assistant(vec![CurrentProviderContent::Text(
                        "public summary".to_string()
                    )]),
                    CurrentProviderMessage::assistant(vec![CurrentProviderContent::Text(
                        "visible answer".to_string()
                    )]),
                    CurrentProviderMessage::user(vec![CurrentProviderContent::Text(
                        "next".to_string()
                    )])
                ]
            );
            let canonical = copy.into_canonical("target").unwrap();
            let shape = RuntimeReplyProviderRequestWireShape::default();
            let wire = match target.protocol.unwrap() {
                RuntimeProviderProtocol::Responses => {
                    responses_request(&target, &canonical, &shape, &BTreeMap::new()).unwrap()
                }
                RuntimeProviderProtocol::ChatCompletions => {
                    chat_completions_request(&target, &canonical, &shape, &BTreeMap::new()).unwrap()
                }
                RuntimeProviderProtocol::AnthropicMessages => {
                    anthropic_request(&target, &canonical, &BTreeMap::new()).unwrap()
                }
                RuntimeProviderProtocol::GeminiGenerateContent => {
                    gemini::request(&canonical, &BTreeMap::new()).unwrap()
                }
                _ => unreachable!(),
            }
            .to_string();
            for forbidden in [
                "fixture-ciphertext",
                "private reasoning",
                "producer",
                "rs_native",
                "msg_native",
                "final_answer",
            ] {
                assert!(!wire.contains(forbidden), "foreign wire leaked {forbidden}");
            }
            assert!(
                wire.contains("public summary")
                    && wire.contains("visible answer")
                    && wire.contains("next")
            );
        }
        assert_eq!(original.messages, request(&source).messages);
    }

    #[test]
    fn unknown_native_content_fails_without_leaking_the_payload() {
        let source = super::super::tests::config(Some(RuntimeProviderProtocol::Responses));
        let mut original = request(&source);
        original.messages[0].content = vec![CurrentProviderContent::RawResponseItem(
            json!({"type":"unknown","private":"fixture-secret"}),
        )];
        let mut target = source.clone();
        target.credential_uuid = "other".to_string();
        let error = prepare_request(original, &target).unwrap_err();
        assert!(!error.retryable);
        assert!(!error.message.contains("fixture-secret"));
    }
}
