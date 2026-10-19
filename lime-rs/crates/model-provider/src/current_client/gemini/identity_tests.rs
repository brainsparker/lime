use super::*;

fn calls(event: Value) -> Vec<LlmEvent> {
    reduce_event(&mut GeminiStreamState::default(), &event).unwrap()
}

#[test]
fn anonymous_calls_in_separate_responses_have_distinct_runtime_identity() {
    let event =
        json!({"candidates":[{"content":{"parts":[{"functionCall":{"name":"Read","args":{}}}]}}]});
    let id = |events: Vec<LlmEvent>| {
        events
            .into_iter()
            .find_map(|event| {
                if let LlmEvent::ToolCall { id, .. } = event {
                    Some(id)
                } else {
                    None
                }
            })
            .unwrap()
    };
    assert_ne!(id(calls(event.clone())), id(calls(event)));
}

#[test]
fn explicit_call_identity_is_shared_by_all_lifecycle_events() {
    let events = calls(
        json!({"candidates":[{"content":{"parts":[{"functionCall":{"id":"native-call-7","name":"Read","args":{"path":"README.md"}}}]}}]}),
    );
    assert_eq!(events.len(), 4);
    for event in events {
        let id = match event {
            LlmEvent::ToolInputStart { id, .. }
            | LlmEvent::ToolInputDelta { id, .. }
            | LlmEvent::ToolInputEnd { id, .. }
            | LlmEvent::ToolCall { id, .. } => id,
            event => panic!("unexpected lifecycle: {event:?}"),
        };
        assert_eq!(id, "native-call-7");
    }
}

#[test]
fn original_tool_names_survive_gemini_parsing() {
    for original in [" read_file ", "   ", ""] {
        let events = calls(
            json!({"candidates":[{"content":{"parts":[{"functionCall":{"id":"raw-name-call","name":original,"args":{}}}]}}]}),
        );
        assert_eq!(events.len(), 4);
        for event in events {
            let name = match event {
                LlmEvent::ToolInputStart { name, .. }
                | LlmEvent::ToolInputDelta { name, .. }
                | LlmEvent::ToolInputEnd { name, .. }
                | LlmEvent::ToolCall { name, .. } => name,
                event => panic!("unexpected lifecycle: {event:?}"),
            };
            assert_eq!(name, original);
        }
    }
}
