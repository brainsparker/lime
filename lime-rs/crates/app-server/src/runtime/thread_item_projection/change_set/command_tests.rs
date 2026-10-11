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
