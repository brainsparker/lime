use super::*;

#[test]
fn full_reasoning_arrays_replace_partial_content_including_empty_arrays() {
    for (summary, content) in [
        (vec!["completed", "second"], vec!["safe content"]),
        (vec![], vec![]),
        (vec!["", "  "], vec!["\n"]),
    ] {
        for event_type in ["reasoning.final", "item.completed"] {
            let changes = materialize_events(&[
                event("delta", 1, "reasoning.delta", "turn-1", json!({
                    "itemId":"reasoning", "summary":["partial summary"], "content":["partial content"]})),
                event("snapshot", 2, event_type, "turn-1", json!({
                    "itemId":"reasoning", "type":"reasoning", "summary":summary, "content":content,
                    "metadata":{"reasoning_is_snapshot":false}})),
            ], "session-1", "thread-1").unwrap();
            assert_eq!(changes.changed_items.len(), 1);
            assert_eq!(
                changes.changed_items[0].payload,
                ThreadItemPayload::Reasoning {
                    summary: summary.iter().map(|part| part.to_string()).collect(),
                    content: content.iter().map(|part| part.to_string()).collect(),
                }
            );
            assert_eq!(
                changes.changed_items[0].metadata["reasoning_is_snapshot"],
                true
            );
        }
    }
}

#[test]
fn bodyless_reasoning_completion_keeps_existing_arrays() {
    let changes = materialize_events(
        &[
            event(
                "delta",
                1,
                "reasoning.delta",
                "turn-1",
                json!({
            "itemId":"reasoning", "summary":["summary"], "content":["content"]}),
            ),
            event(
                "completed",
                2,
                "item.completed",
                "turn-1",
                json!({
            "itemId":"reasoning", "type":"reasoning", "metadata":{"reasoning_is_snapshot":true}}),
            ),
        ],
        "session-1",
        "thread-1",
    )
    .unwrap();
    assert_eq!(
        changes.changed_items[0].payload,
        ThreadItemPayload::Reasoning {
            summary: vec!["summary".to_string()],
            content: vec!["content".to_string()],
        }
    );
    assert_eq!(
        changes.changed_items[0].metadata["reasoning_is_snapshot"],
        false
    );
}

#[test]
fn nested_canonical_reasoning_replaces_empty_arrays_despite_stale_metadata() {
    for metadata in [
        json!(null),
        json!({"source_event_type":"reasoning.delta", "reasoning_is_snapshot":false}),
    ] {
        let mut completed = canonical_tool_item("item_reasoning", "completed", 1);
        completed["kind"] = json!("reasoning");
        completed["payload"] = json!({"type":"reasoning", "summary":[], "content":[]});
        completed["metadata"] = metadata;
        let changes = materialize_events(&[
            event("delta", 1, "reasoning.delta", "turn-1", json!({
                "itemId":"reasoning", "summary":["partial summary"], "content":["partial content"]})),
            event("completed", 2, "item.completed", "turn-1", json!({"item":completed})),
        ], "session-1", "thread-1").unwrap();
        assert_eq!(changes.changed_items.len(), 1);
        assert_eq!(
            changes.changed_items[0].payload,
            ThreadItemPayload::Reasoning {
                summary: Vec::new(),
                content: Vec::new(),
            }
        );
        assert_eq!(
            changes.changed_items[0].metadata["reasoning_is_snapshot"],
            true
        );
    }
}
