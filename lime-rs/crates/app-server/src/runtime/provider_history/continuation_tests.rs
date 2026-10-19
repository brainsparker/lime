use super::*;
use serde_json::json;

fn event(sequence: u64, event_type: &str, payload: Value) -> AgentEvent {
    AgentEvent {
        event_id: format!("step-event-{sequence}"),
        sequence,
        session_id: "session-continuation".into(),
        thread_id: Some("thread-continuation".into()),
        turn_id: Some("turn-continuation".into()),
        event_type: event_type.into(),
        timestamp: "2026-10-19T00:00:00Z".into(),
        payload,
    }
}

#[test]
fn sampling_boundaries_preserve_reasoning_and_text_in_separate_assistant_messages() {
    let messages = messages_from_events(&[
        event(1, "reasoning.delta", json!({"text":"first thought"})),
        event(
            2,
            "message.delta",
            json!({"itemId":"partial","text":"part"}),
        ),
        event(3, "message.delta", json!({"itemId":"partial","text":"ial"})),
        event(
            4,
            "message.completed",
            json!({"itemId":"partial","text":"partial"}),
        ),
        event(5, "provider.step", json!({"attempt":1,"completed":true})),
        event(6, "reasoning.delta", json!({"text":"second thought"})),
        event(7, "message.delta", json!({"itemId":"final","text":"final"})),
        event(
            8,
            "message.completed",
            json!({"itemId":"final","text":"final"}),
        ),
        event(9, "provider.step", json!({"attempt":2,"completed":true})),
    ]);
    assert_eq!(
        messages,
        vec![
            CurrentProviderMessage::assistant(vec![
                CurrentProviderContent::Reasoning("first thought".into()),
                CurrentProviderContent::Text("part".into()),
                CurrentProviderContent::Text("ial".into()),
            ]),
            CurrentProviderMessage::assistant(vec![
                CurrentProviderContent::Reasoning("second thought".into()),
                CurrentProviderContent::Text("final".into()),
            ]),
        ]
    );
}

#[test]
fn sampling_boundaries_do_not_deduplicate_identical_assistant_content() {
    let messages = messages_from_events(&[
        event(1, "message.delta", json!({"itemId":"first","text":"same"})),
        event(2, "provider.step", json!({"attempt":1,"completed":true})),
        event(3, "message.delta", json!({"itemId":"second","text":"same"})),
        event(4, "provider.step", json!({"attempt":2,"completed":true})),
    ]);
    let expected =
        CurrentProviderMessage::assistant(vec![CurrentProviderContent::Text("same".into())]);
    assert_eq!(messages, vec![expected.clone(), expected]);
}

#[test]
fn empty_sampling_boundaries_do_not_create_assistant_messages() {
    let messages = messages_from_events(&[
        event(1, "provider.step", json!({"attempt":1,"completed":true})),
        event(2, "message.delta", json!({"itemId":"final","text":"done"})),
        event(3, "provider.step", json!({"attempt":2,"completed":true})),
        event(4, "provider.step", json!({"attempt":3,"completed":true})),
    ]);
    assert_eq!(
        messages,
        vec![CurrentProviderMessage::assistant(vec![
            CurrentProviderContent::Text("done".into())
        ])]
    );
}
