use super::*;

#[test]
fn authoritative_message_body_survives_history_merge_and_serialization() {
    for text in ["completed answer", "", "  ", "完成🙂"] {
        let mut builder = ThreadHistoryBuilder::new();
        let first = item(1, 1, "message", "partial streamed body");
        builder.append_items_at(1, vec![first]).unwrap();
        let mut completed = item(2, 9, "message", text);
        completed.status = ItemStatus::Completed;
        completed.completed_at_ms = Some(2);
        completed.metadata = serde_json::json!({
            "source_event_type":"item.completed", "text_is_snapshot":true
        });
        let changes = builder.append_items_at(2, vec![completed]).unwrap();
        assert_eq!(changes.changed_items.len(), 1);
        let stored = &builder.raw_items()[0];
        assert_eq!(stored.ordinal, 1);
        assert_eq!(stored.status, ItemStatus::Completed);
        assert!(
            matches!(&stored.payload,
                ThreadItemPayload::AgentMessage { text:actual, .. } if actual == text
            ),
            "history body differs for {text:?}: {stored:?}"
        );
        let serialized = serde_json::to_value(stored).unwrap();
        let restored: ThreadItem = serde_json::from_value(serialized).unwrap();
        assert_eq!(&restored, stored);
    }
}

#[test]
fn bodyless_completion_keeps_materialized_text_and_later_delta_remains_a_delta() {
    let mut builder = ThreadHistoryBuilder::new();
    let first = item(1, 1, "message", "partial");
    builder.append_items_at(1, vec![first.clone()]).unwrap();
    let mut completed = first;
    completed.sequence = 2;
    completed.status = ItemStatus::Completed;
    completed.metadata = serde_json::json!({"text_is_snapshot":false});
    builder.append_items_at(2, vec![completed]).unwrap();
    assert!(matches!(&builder.raw_items()[0].payload,
        ThreadItemPayload::AgentMessage { text, .. } if text == "partial"
    ));

    let mut builder = ThreadHistoryBuilder::new();
    let mut snapshot = item(1, 1, "message", "snapshot");
    snapshot.metadata = serde_json::json!({"text_is_snapshot":true});
    builder.append_items_at(1, vec![snapshot]).unwrap();
    let mut delta = item(2, 1, "message", " tail");
    delta.metadata =
        serde_json::json!({"source_event_type":"message.delta", "text_is_snapshot":false});
    builder.append_items_at(2, vec![delta]).unwrap();
    assert!(matches!(&builder.raw_items()[0].payload,
        ThreadItemPayload::AgentMessage { text, .. } if text == "snapshot tail"
    ));
}
