use super::*;
use agent_protocol::{AgentMessageDelivery, AsyncUserInputQuestion};

#[test]
fn async_question_snapshot_retains_source_identity_and_questions_after_merge() {
    let mut started = item(1, 1, "question-call", "Choose");
    started.item_id = agent_protocol::ItemId::from_source("question-call");
    started.payload = ThreadItemPayload::AgentMessage {
        text: "Choose".to_string(),
        phase: Some(agent_protocol::response_item::MessagePhase::FinalAnswer),
        content_parts: Vec::new(),
        delivery: Some(AgentMessageDelivery::Async),
        questions: Some(vec![AsyncUserInputQuestion {
            title: "Choose".to_string(),
            options: Some(vec!["First".to_string()]),
        }]),
    };
    let mut completed = started.clone();
    completed.sequence = 2;
    completed.status = ItemStatus::Completed;
    completed.completed_at_ms = Some(2);
    completed.metadata =
        serde_json::json!({"source_event_type": "item.completed", "text_is_snapshot": true});
    let mut builder = ThreadHistoryBuilder::new();
    builder.append_items_at(1, vec![started]).unwrap();
    builder.append_items_at(2, vec![completed.clone()]).unwrap();
    let stored = &builder.raw_items()[0];
    assert_eq!(stored.item_id.as_str(), "question-call");
    assert_eq!(stored.payload, completed.payload);
    let restored: ThreadItem =
        serde_json::from_slice(&serde_json::to_vec(stored).unwrap()).unwrap();
    assert_eq!(restored.payload, completed.payload);
}
