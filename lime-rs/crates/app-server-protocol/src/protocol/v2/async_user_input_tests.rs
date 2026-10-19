use super::*;
use serde_json::json;

#[test]
fn async_question_is_standard_agent_message_content() {
    let item: ThreadItem = serde_json::from_value(json!({
        "type": "agentMessage", "id": "tool-call", "text": "Choose",
        "phase": "final_answer", "delivery": "async",
        "questions": [{"title": "Choose", "options": null}]
    }))
    .unwrap();
    let value = serde_json::to_value(item).unwrap();
    assert_eq!(
        value["questions"],
        json!([{"title": "Choose", "options": null}])
    );
    assert_eq!(value["id"], "tool-call");
    assert!(value.get("requestId").is_none());
    assert!(value.get("isBlocking").is_none());
    assert!(serde_json::from_value::<AsyncUserInputQuestion>(
        json!({"title": "Choose", "requestId": "invented"})
    )
    .is_err());
}
