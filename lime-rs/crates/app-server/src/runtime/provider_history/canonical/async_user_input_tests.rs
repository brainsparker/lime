use super::*;
use agent_protocol::{AgentMessageDelivery, AsyncUserInputQuestion, SessionId, ThreadId, TurnId};

#[test]
fn fork_questions_do_not_invent_assistant_history() {
    let item = ThreadItem::new(
        SessionId::new("session-1"),
        ThreadId::new("thread-1"),
        TurnId::new("turn-1"),
        1,
        1,
        ThreadItemPayload::AgentMessage {
            text: "Choose".to_string(),
            phase: None,
            content_parts: Vec::new(),
            delivery: Some(AgentMessageDelivery::Async),
            questions: Some(vec![AsyncUserInputQuestion {
                title: "Choose".to_string(),
                options: None,
            }]),
        },
    );
    let mut messages = Vec::new();
    let mut content = Vec::new();
    let mut by_item = HashMap::new();
    let mut results = Vec::new();
    let mut provider_input = |_| -> Result<RuntimeReplyInput, String> {
        panic!("questions do not create provider input")
    };
    append_fork_item(
        &item,
        &mut messages,
        &mut content,
        &mut by_item,
        &mut results,
        &mut provider_input,
    )
    .unwrap();
    assert!(messages.is_empty());
    assert!(content.is_empty());
    assert!(results.is_empty());
}
