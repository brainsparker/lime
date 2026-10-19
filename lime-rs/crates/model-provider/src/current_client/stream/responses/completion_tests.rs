use super::*;
use serde_json::json;

#[test]
fn interrupted_completion_forces_follow_up_and_preserves_response_usage() {
    for end_turn in [None, Some(false), Some(true)] {
        let mut payload = json!({
            "type": "response.incomplete",
            "response": {
                "id": "interrupted-response",
                "incomplete_details": { "reason": "interrupted" },
                "output": [],
                "usage": { "input_tokens": 10, "output_tokens": 3 }
            }
        });
        if let Some(end_turn) = end_turn {
            payload["response"]["end_turn"] = json!(end_turn);
        }
        let usage = responses_usage(&payload["response"]["usage"]);
        let batch = ResponsesEventReducer::new(None, false)
            .push(&payload)
            .expect("interrupted response");
        assert!(batch.terminal, "sampling ends while the Turn continues");
        assert_eq!(
            batch.events,
            vec![
                LlmEvent::Usage {
                    usage: usage.clone()
                },
                LlmEvent::Finish {
                    reason: FinishReason::Stop,
                    usage: Some(usage),
                    needs_follow_up: true,
                    response_id: Some("interrupted-response".to_string()),
                },
            ]
        );
    }
}

#[test]
fn interrupted_completion_closes_output_and_does_not_reemit_a_tool_call() {
    let mut reducer = ResponsesEventReducer::new(None, false);
    reducer
        .push(&json!({
            "type": "response.output_text.delta",
            "item_id": "message-1",
            "delta": "partial"
        }))
        .unwrap();
    reducer
        .push(&json!({
            "type": "response.reasoning_text.delta",
            "item_id": "reasoning-1",
            "content_index": 0,
            "delta": "reasoning"
        }))
        .unwrap();
    let call = json!({
        "type": "function_call",
        "id": "function-1",
        "call_id": "call-1",
        "name": "read_file",
        "arguments": "{}"
    });
    let first = reducer
        .push(&json!({ "type": "response.output_item.done", "item": call }))
        .unwrap();
    assert_eq!(
        first
            .events
            .iter()
            .filter(|event| matches!(
                event, LlmEvent::ToolCall { id, .. } if id == "call-1"
            ))
            .count(),
        1
    );
    let end = reducer
        .push(&json!({
            "type": "response.incomplete",
            "response": {
                "id": "interrupted-with-tool",
                "end_turn": true,
                "incomplete_details": { "reason": "interrupted" },
                "output": [call]
            }
        }))
        .unwrap();
    assert!(end.terminal);
    assert!(!end
        .events
        .iter()
        .any(|event| matches!(event, LlmEvent::ToolCall { .. })));
    assert_eq!(
        end.events
            .iter()
            .filter(|event| matches!(event, LlmEvent::TextEnd { .. }))
            .count(),
        1
    );
    assert_eq!(
        end.events
            .iter()
            .filter(|event| matches!(event, LlmEvent::ReasoningEnd { .. }))
            .count(),
        1
    );
    assert!(matches!(end.events.last(), Some(LlmEvent::Finish {
        reason: FinishReason::ToolCall, needs_follow_up: true, response_id: Some(id), ..
    }) if id == "interrupted-with-tool"));
}

#[test]
fn other_incomplete_reasons_do_not_authorize_follow_up_or_tools() {
    for reason in [
        json!("content_filter"),
        json!("max_output_tokens"),
        json!("unknown"),
        Value::Null,
    ] {
        let batch = ResponsesEventReducer::new(None, false)
            .push(&json!({
                "type": "response.incomplete",
                "response": {
                    "id": "not-interrupted",
                    "end_turn": false,
                    "incomplete_details": { "reason": reason },
                    "output": [{
                        "type": "function_call", "id": "function-unfinished",
                        "call_id": "unfinished", "name": "read_file", "arguments": "{}"
                    }]
                }
            }))
            .unwrap();
        assert!(!batch.events.iter().any(|event| matches!(
            event,
            LlmEvent::Finish {
                needs_follow_up: true,
                ..
            } | LlmEvent::ToolCall { .. }
                | LlmEvent::CustomToolCall { .. }
        )));
    }
}

#[test]
fn missing_completion_stays_a_retryable_transport_failure() {
    let mut reducer = ResponsesEventReducer::new(None, false);
    reducer
        .push(&json!({
            "type": "response.output_text.delta",
            "item_id": "partial-before-eof",
            "delta": "partial"
        }))
        .unwrap();
    let events = reducer.finish_incomplete();
    assert!(events
        .iter()
        .any(|event| matches!(event, LlmEvent::TextEnd { .. })));
    assert!(matches!(
        events.last(),
        Some(LlmEvent::ProviderError {
            classification: Some(FailureClassification::Transport),
            retryable: Some(true),
            ..
        })
    ));
    assert!(!events
        .iter()
        .any(|event| matches!(event, LlmEvent::Finish { .. })));
}

#[test]
fn interrupted_completion_does_not_dispatch_unfinished_tool_items() {
    for custom in [false, true] {
        let mut reducer = ResponsesEventReducer::new(None, false);
        let kind = if custom {
            "custom_tool_call"
        } else {
            "function_call"
        };
        let field = if custom { "input" } else { "arguments" };
        let prefix = if custom {
            "custom_tool_call_input"
        } else {
            "function_call_arguments"
        };
        let item = json!({
            "type": kind, "id": "unfinished-item", "call_id": "unfinished-call",
            "name": "read_file", "status": "in_progress", field: "{}"
        });
        let is_call = |event: &LlmEvent| {
            matches!(
                event,
                LlmEvent::ToolCall { .. } | LlmEvent::CustomToolCall { .. }
            )
        };
        let added = reducer
            .push(&json!({
                "type": "response.output_item.added",
                "output_index": 0,
                "item": item
            }))
            .unwrap();
        assert!(!added.events.iter().any(is_call));
        let arguments_done = reducer
            .push(&json!({
                "type": format!("response.{prefix}.done"),
                "item_id": "unfinished-item", field: "{}"
            }))
            .unwrap();
        assert!(!arguments_done.events.iter().any(is_call));
        let interrupted = reducer
            .push(&json!({
                "type": "response.incomplete",
                "response": {
                    "id": "interrupted-before-item-done",
                    "incomplete_details": { "reason": "interrupted" },
                    "output": [item]
                }
            }))
            .unwrap();
        assert!(interrupted.terminal);
        assert!(!interrupted.events.iter().any(is_call));
        assert!(matches!(
            interrupted.events.last(),
            Some(LlmEvent::Finish {
                reason: FinishReason::Stop,
                needs_follow_up: true,
                ..
            })
        ));
    }
}

#[path = "completion_tests/websocket.rs"]
mod websocket;
