use super::*;
use serde_json::json;

fn event(sequence: u64, kind: &str) -> AgentEvent {
    AgentEvent {
        event_id: format!("boundary-{sequence}"),
        sequence,
        session_id: "session-boundary".to_string(),
        thread_id: Some("thread-boundary".to_string()),
        turn_id: Some("same-turn".to_string()),
        event_type: kind.to_string(),
        timestamp: "2026-10-19T00:00:00Z".to_string(),
        payload: json!({}),
    }
}

fn marker(sequence: u64, covered: Value) -> AgentEvent {
    let mut event = event(sequence, "context.compaction.completed");
    let window = uuid::Uuid::now_v7().to_string();
    event.payload = json!({
        "coveredThroughSequence": covered,
        "replacementHistory": [{"role":"user", "content":"summary"}],
        "windowNumber": 1,
        "firstWindowId": window,
        "windowId": window,
    });
    event
}

#[test]
fn same_turn_compaction_keeps_the_exact_suffix_including_newer_precommit_events() {
    let events = vec![
        event(1, "message.created"),
        event(2, "provider.model_history"),
        event(3, "thread.response_items.injected"),
        event(4, "message.created"),
        marker(5, json!(2)),
        event(6, "provider.model_history"),
    ];
    let original = events.clone();
    let (replacement, tail) = provider_history_source(&events);
    assert!(
        replacement.is_some(),
        "exact compaction checkpoint must be used"
    );
    assert_eq!(
        tail.iter().map(|event| event.sequence).collect::<Vec<_>>(),
        [3, 4, 5, 6]
    );
    assert_eq!(events, original);
}

#[test]
fn fully_covered_prefix_does_not_require_a_future_tail_turn() {
    let events = vec![
        event(1, "message.created"),
        event(2, "provider.model_history"),
        marker(3, json!(2)),
    ];
    let (replacement, tail) = provider_history_source(&events);
    assert!(replacement.is_some());
    assert_eq!(
        tail.iter().map(|event| event.sequence).collect::<Vec<_>>(),
        [3]
    );
}

#[test]
fn invalid_or_conflicting_coverage_never_discards_history() {
    for covered in [
        json!(-1),
        json!(1.5),
        json!(3),
        json!(4),
        Value::Null,
        json!("1"),
    ] {
        let events = vec![
            event(1, "message.created"),
            event(2, "message.completed"),
            marker(3, covered),
        ];
        let (replacement, tail) = provider_history_source(&events);
        assert!(replacement.is_none());
        assert_eq!(tail, events);
    }
    let mut checkpoint = marker(3, json!(1));
    checkpoint.payload["artifact"] = checkpoint.payload.clone();
    checkpoint.payload["artifact"]["coveredThroughSequence"] = json!(2);
    let events = vec![
        event(1, "message.created"),
        event(2, "message.completed"),
        checkpoint,
    ];
    let (replacement, tail) = provider_history_source(&events);
    assert!(replacement.is_none());
    assert_eq!(tail, events);
}

#[test]
fn a_turn_only_marker_cannot_reintroduce_the_retired_boundary() {
    let mut checkpoint = marker(3, Value::Null);
    checkpoint
        .payload
        .as_object_mut()
        .unwrap()
        .remove("coveredThroughSequence");
    checkpoint.payload["tailStartTurnId"] = json!("same-turn");
    let events = vec![
        event(1, "message.created"),
        event(2, "message.completed"),
        checkpoint,
    ];
    let (replacement, tail) = provider_history_source(&events);
    assert!(
        replacement.is_none(),
        "retired Turn-only boundary must not be consumed"
    );
    assert_eq!(tail, events);
}
