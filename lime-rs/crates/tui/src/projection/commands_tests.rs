use super::*;
use crate::projection::tests::{test_thread, test_turn};
use app_server_protocol::protocol::v2::{
    CommandExecutionOutputDeltaNotification, ItemCompletedNotification, ItemStartedNotification,
    TurnCompletedNotification,
};

fn command(status: &str, process: &str, output: &str) -> ThreadItem {
    serde_json::from_value(serde_json::json!({
        "type": "commandExecution", "id": "command", "command": "read answer",
        "cwd": "/workspace", "source": "unifiedExecStartup", "status": status,
        "processId": process, "commandActions": [], "aggregatedOutput": output,
        "exitCode": if status == "completed" { Some(0) } else { None },
        "terminalInteractions": []
    }))
    .unwrap()
}

fn output(turn: &str, item: &str, text: &str) -> ServerNotification {
    ServerNotification::CommandExecutionOutputDelta(CommandExecutionOutputDeltaNotification {
        thread_id: "thread-review-filter".into(),
        turn_id: turn.into(),
        item_id: item.into(),
        delta: text.into(),
    })
}

fn complete(item: ThreadItem) -> ServerNotification {
    ServerNotification::ItemCompleted(ItemCompletedNotification {
        thread_id: "thread-review-filter".into(),
        turn_id: "original".into(),
        item,
        completed_at_ms: 4,
    })
}

#[test]
fn background_command_survives_turn_terminal_without_touching_next_turn() {
    let mut projection = ConversationProjection::default();
    projection.start_turn("original".into());
    let running = command("inProgress", "process", "ready\n");
    projection.apply(ServerNotification::ItemStarted(ItemStartedNotification {
        thread_id: "thread-review-filter".into(),
        turn_id: "original".into(),
        item: running.clone(),
        started_at_ms: 1,
    }));
    let terminal = ServerNotification::TurnCompleted(TurnCompletedNotification {
        thread_id: "thread-review-filter".into(),
        turn: test_turn("original", TurnStatus::Completed, vec![running]),
    });
    projection.apply(terminal.clone());
    assert_eq!(projection.entries()[0].status, Some(EntryStatus::Running));
    assert!(projection.entries()[0].streaming);
    projection.start_turn("next".into());
    projection.apply(terminal);
    assert_eq!(projection.active_turn_id.as_deref(), Some("next"));
    projection.apply(output("original", "command", "tail\n"));
    let before = projection.entries()[0].clone();
    assert!(before.text.ends_with("ready\ntail\n"));
    projection.apply(output("next", "command", "wrong turn"));
    projection.apply(output("original", "unknown", "unknown command"));
    projection.apply(complete(command("completed", "other", "wrong process")));
    assert_eq!(projection.entries(), &[before]);
    projection.apply(complete(command("completed", "process", "ready\ntail\n")));
    let completed = projection.entries()[0].clone();
    assert_eq!(completed.status, Some(EntryStatus::Completed));
    assert!(!completed.streaming);
    projection.apply(output("original", "command", "late"));
    assert_eq!(projection.entries(), &[completed]);
    assert_eq!(projection.active_turn_id.as_deref(), Some("next"));
}

#[test]
fn background_command_restores_from_canonical_history_and_paging() {
    let running = command("inProgress", "process", "ready\n");
    let turn = test_turn("original", TurnStatus::Completed, vec![running.clone()]);
    let mut restored = ConversationProjection::default();
    restored.hydrate_thread(test_thread(vec![turn.clone()]));
    assert!(restored.entries()[0].streaming);
    restored.apply(output("original", "command", "tail\n"));
    assert!(restored.entries()[0].text.ends_with("ready\ntail\n"));
    let mut paged = ConversationProjection::default();
    paged.hydrate_thread(test_thread(Vec::new()));
    paged.prepend_grouped_items_with_hidden_ids(
        vec![HistoryItemGroup {
            items: vec![running],
            activity_scope: Some("original".into()),
            completion: None,
        }],
        &HashSet::new(),
    );
    paged.restore_history_turns(&[turn]);
    paged.apply(output("original", "command", "tail\n"));
    assert_eq!(paged.entries(), restored.entries());
}
