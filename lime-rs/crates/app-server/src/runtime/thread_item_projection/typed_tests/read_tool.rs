use super::*;

#[test]
fn read_observation_cannot_replace_canonical_tool_output_or_history_budget() {
    let mut completed = canonical_tool_item("read-call", "completed", 2);
    completed["payload"]["name"] = json!("Read");
    completed["payload"]["output"] = json!({"text":"full original output"});
    completed["metadata"] = json!({"history_token_limit":17});
    let tool = event(
        "tool-result",
        2,
        "item.completed",
        "turn-1",
        json!({"item":completed}),
    );
    let observation = event(
        "read-observed",
        3,
        "file.read",
        "turn-1",
        json!({
            "toolCallId":"read-call","path":"source.txt","content":"full original output"
        }),
    );
    let changes =
        materialize_events(&[tool, observation.clone()], "session-1", "thread-1").unwrap();
    assert_eq!(changes.changed_items.len(), 1);
    let item = &changes.changed_items[0];
    assert!(
        matches!(&item.payload, ThreadItemPayload::Tool { name, output: Some(output), .. }
        if name == "Read" && output.text.as_deref() == Some("full original output"))
    );
    assert_eq!(item.metadata["history_token_limit"], 17);
    assert_eq!(changes.sequence, 3);

    // Separate event batches must not upsert a competing File snapshot either.
    let diagnostic = materialize_events(&[observation], "session-1", "thread-1").unwrap();
    assert!(diagnostic.changed_items.is_empty());
    assert_eq!(diagnostic.sequence, 3);
}
