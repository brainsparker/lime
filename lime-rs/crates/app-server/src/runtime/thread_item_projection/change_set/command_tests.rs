use super::*;
use agent_protocol::{ItemStatus, SessionId, ThreadId, ThreadItemPayload, TurnId};
use serde_json::{json, Value};

fn command(metadata: Value) -> ThreadItem {
    let payload = ThreadItemPayload::Command {
        command: "read input".to_owned(),
        cwd: Some("/workspace".to_owned()),
        output: None,
        exit_code: None,
    };
    ThreadItem {
        session_id: SessionId::new("session-1"),
        thread_id: ThreadId::new("thread-1"),
        turn_id: TurnId::new("turn-1"),
        item_id: ItemId::new("exec-1"),
        sequence: 1,
        ordinal: 1,
        created_at_ms: 1,
        updated_at_ms: 1,
        completed_at_ms: None,
        kind: payload.kind(),
        status: ItemStatus::InProgress,
        payload,
        metadata,
    }
}

#[test]
fn canonical_interaction_snapshots_replace_instead_of_duplicating_mirrored_facts() {
    let history = json!([{ "processId": "process-1", "stdin": "sent 9 chars" }]);
    let previous = command(json!({"terminalInteractions": history}));
    let next = command(json!({"terminalInteractions": history}));
    let merged = merge_item_snapshot(previous, next);
    assert_eq!(merged.metadata["terminalInteractions"], history);
}

#[test]
fn distinct_identical_interactions_are_kept_by_snapshot_and_delta_contracts() {
    let one = json!({"processId": "process-1", "stdin": "sent 9 chars"});
    let previous = command(json!({"terminalInteractions": [one]}));
    let delta =
        command(json!({"source_event_type": "command.interaction", "terminalInteractions": [one]}));
    let merged = merge_item_snapshot(previous, delta);
    assert_eq!(merged.metadata["terminalInteractions"], json!([one, one]));
    let snapshot = command(json!({"terminalInteractions": [one, one]}));
    let merged = merge_item_snapshot(merged, snapshot);
    assert_eq!(merged.metadata["terminalInteractions"], json!([one, one]));
}

#[test]
fn command_output_deltas_preserve_raw_text_repetition_and_snapshot_boundaries() {
    use super::super::materializer::{materialize_events, IncrementalMaterializer};
    use app_server_protocol::AgentEvent;

    let event = |sequence: u64, event_type: &str, payload: Value| AgentEvent {
        event_id: format!("command-output-{sequence}"),
        sequence,
        session_id: "session-1".to_owned(),
        thread_id: Some("thread-1".to_owned()),
        turn_id: Some("turn-1".to_owned()),
        event_type: event_type.to_owned(),
        timestamp: "2026-10-13T00:00:00Z".to_owned(),
        payload,
    };
    let mut events = vec![event(
        1,
        "item.started",
        json!({"item": command(json!({"processId": "process-1"}))}),
    )];
    let mut incremental =
        IncrementalMaterializer::from_events(&events, "session-1", "thread-1").unwrap();
    let mut raw = String::new();
    for delta in [
        "\u{1b}[?1",
        "h\u{1b}=ready\r\n",
        " repeated \r\n",
        " repeated \r\n",
        "\t\r\n",
    ] {
        let mirror = event(
            events.len() as u64 + 1,
            "tool.output.delta",
            json!({"tool_id": "exec-1", "delta": delta, "metadata": {"executionSurface": "unified_exec", "processId": "process-1"}}),
        );
        let mirrored = incremental.apply(&mirror).unwrap().item.unwrap();
        assert!(
            matches!(mirrored.payload, ThreadItemPayload::Command { .. }),
            "native output mirror must preserve the canonical Command owner"
        );
        assert_eq!(
            mirrored.payload,
            ThreadItemPayload::Command {
                command: "read input".to_owned(),
                cwd: Some("/workspace".to_owned()),
                output: (!raw.is_empty()).then(|| raw.clone()),
                exit_code: None,
            },
            "raw tool mirror must not append the Command delta twice"
        );
        events.push(mirror);
        raw.push_str(delta);
        let next = event(
            events.len() as u64 + 1,
            "command.output",
            json!({"commandId": "exec-1", "delta": delta, "preview": "lossy preview must not win"}),
        );
        let item = incremental.apply(&next).unwrap().item.unwrap();
        assert_eq!(
            item.payload,
            ThreadItemPayload::Command {
                command: "read input".to_owned(),
                cwd: Some("/workspace".to_owned()),
                output: Some(raw.clone()),
                exit_code: None,
            }
        );
        assert!(
            incremental.apply(&next).unwrap().item.is_none(),
            "replayed event identity must not append twice"
        );
        events.push(next);
        let cold = materialize_events(&events, "session-1", "thread-1").unwrap();
        assert_eq!(cold.changed_items, vec![item]);
    }

    let mut snapshot =
        command(json!({"source_event_type": "command.output", "processId": "process-1"}));
    let ThreadItemPayload::Command { output, .. } = &mut snapshot.payload else {
        unreachable!()
    };
    *output = Some(raw.clone());
    let update = event(
        events.len() as u64 + 1,
        "item.updated",
        json!({"item": snapshot}),
    );
    let item = incremental.apply(&update).unwrap().item.unwrap();
    assert_eq!(
        item.payload, snapshot.payload,
        "typed lifecycle envelope must replace a complete snapshot even with stale nested metadata"
    );
    events.push(update);
    let replacement = event(
        events.len() as u64 + 1,
        "command.output",
        json!({"commandId": "exec-1", "output": "bounded snapshot", "preview": "preview"}),
    );
    let item = incremental.apply(&replacement).unwrap().item.unwrap();
    let ThreadItemPayload::Command { output, .. } = &item.payload else {
        unreachable!()
    };
    assert_eq!(output.as_deref(), Some("bounded snapshot"));
    events.push(replacement);
    assert_eq!(
        materialize_events(&events, "session-1", "thread-1")
            .unwrap()
            .changed_items,
        vec![item]
    );
}
