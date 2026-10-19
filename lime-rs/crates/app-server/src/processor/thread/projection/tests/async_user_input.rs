use super::*;

#[test]
fn async_questions_project_from_canonical_payload_with_same_source_identity() {
    let mut item = canonical::ThreadItem::new(
        canonical::SessionId::new("session-1"),
        canonical::ThreadId::new("thread-1"),
        canonical::TurnId::new("turn-1"),
        1,
        1,
        canonical::ThreadItemPayload::AgentMessage {
            text: "Choose".to_string(),
            phase: Some(canonical::response_item::MessagePhase::FinalAnswer),
            content_parts: Vec::new(),
            delivery: Some(canonical::AgentMessageDelivery::Async),
            questions: Some(vec![canonical::AsyncUserInputQuestion {
                title: "Choose".to_string(),
                options: None,
            }]),
        },
    );
    item.item_id = canonical::ItemId::from_source("question-call");
    let value = serde_json::to_value(project_item(item.clone()).unwrap()).unwrap();
    assert_eq!(value["id"], "question-call");
    assert_eq!(value["delivery"], "async");
    assert_eq!(
        value["questions"],
        json!([{"title": "Choose", "options": null}])
    );

    item.payload = canonical::ThreadItemPayload::AgentMessage {
        text: "Body".to_string(),
        phase: None,
        content_parts: Vec::new(),
        delivery: None,
        questions: None,
    };
    item.metadata = json!({"delivery": "async", "questions": [{"title": "invented"}]});
    let plain = serde_json::to_value(project_item(item).unwrap()).unwrap();
    assert!(plain.get("delivery").is_none());
    assert!(plain.get("questions").is_none());
}
