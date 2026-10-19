use super::*;
use agent_protocol::{AgentMessageDelivery, AsyncUserInputQuestion};

#[test]
fn async_questions_survive_live_materialization_rebuild_and_merge_with_call_identity() {
    let mut source = canonical_tool_item("question-call", "inProgress", 1);
    source["kind"] = json!("agentMessage");
    source["payload"] = json!({
        "type": "agentMessage", "text": "Which?\n- First", "phase": "final_answer",
        "delivery": "async", "questions": [{"title": "Which?", "options": ["First"]}]
    });
    let started = event(
        "start",
        1,
        "item.started",
        "turn-1",
        json!({"item": source}),
    );
    source["status"] = json!("completed");
    let completed = event(
        "complete",
        2,
        "item.completed",
        "turn-1",
        json!({"item": source}),
    );
    let first = materialize_events(&[started.clone()], "session-1", "thread-1").unwrap();
    let rebuilt = materialize_events(&[started, completed], "session-1", "thread-1").unwrap();
    let item = &rebuilt.changed_items[0];
    assert_eq!(item.item_id.as_str(), "question-call");
    assert_eq!(item.status, ItemStatus::Completed);
    assert!(matches!(&item.payload, ThreadItemPayload::AgentMessage {
        delivery: Some(AgentMessageDelivery::Async), questions: Some(questions), ..
    } if questions == &vec![AsyncUserInputQuestion { title: "Which?".to_string(), options: Some(vec!["First".to_string()]) }]));
    let mut accumulator = super::super::change_set::ChangeSetAccumulator::default();
    accumulator.push_item(first.changed_items[0].clone());
    accumulator.push_item(item.clone());
    assert_eq!(accumulator.finish(2).changed_items[0].payload, item.payload);
    let serialized = serde_json::to_vec(item).unwrap();
    let restored: agent_protocol::ThreadItem = serde_json::from_slice(&serialized).unwrap();
    assert_eq!(restored, *item);
}
