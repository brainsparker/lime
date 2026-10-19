use super::*;

#[test]
fn explicit_completed_body_replaces_streamed_text_including_empty_and_whitespace() {
    for text in ["authoritative answer", "", "  ", "完成🙂"] {
        let changes = materialize_events(
            &[
                event(
                    "delta",
                    1,
                    "message.delta",
                    "turn-1",
                    json!({
                        "itemId":"message", "text":"partial streamed body"
                    }),
                ),
                event(
                    "completed",
                    2,
                    "item.completed",
                    "turn-1",
                    json!({
                        "itemId":"message", "type":"agent_message", "text":text,
                        "phase":"final_answer"
                    }),
                ),
            ],
            "session-1",
            "thread-1",
        )
        .unwrap();
        assert_eq!(changes.changed_items.len(), 1);
        let item = &changes.changed_items[0];
        assert_eq!(item.item_id.as_str(), "item_message");
        assert_eq!(item.ordinal, 1);
        assert_eq!(item.status, ItemStatus::Completed);
        assert_eq!(
            item.payload,
            ThreadItemPayload::AgentMessage {
                text: text.to_string(),
                phase: Some(agent_protocol::response_item::MessagePhase::FinalAnswer),
                content_parts: Vec::new(),
                delivery: None,
                questions: None,
            }
        );
    }
}

#[test]
fn bodyless_completion_preserves_the_streamed_body() {
    let changes = materialize_events(
        &[
            event(
                "delta",
                1,
                "message.delta",
                "turn-1",
                json!({
                    "itemId":"message", "text":"partial streamed body"
                }),
            ),
            event(
                "completed",
                2,
                "item.completed",
                "turn-1",
                json!({
                    "itemId":"message", "type":"agent_message", "phase":"final_answer"
                }),
            ),
        ],
        "session-1",
        "thread-1",
    )
    .unwrap();
    assert_eq!(changes.changed_items.len(), 1);
    assert!(matches!(&changes.changed_items[0].payload,
        ThreadItemPayload::AgentMessage { text, .. } if text == "partial streamed body"
    ));
}

#[test]
fn typed_lifecycle_body_is_a_snapshot_even_with_missing_or_stale_metadata() {
    for text in ["authoritative answer", ""] {
        for metadata in [
            json!(null),
            json!({
                "source_event_type":"message.delta", "text_is_snapshot":false
            }),
        ] {
            let mut completed = canonical_tool_item("item_message", "completed", 1);
            completed["kind"] = json!("agentMessage");
            completed["payload"] = json!({
                "type":"agentMessage", "text":text, "phase":"final_answer", "content_parts":[]
            });
            completed["metadata"] = metadata;
            let changes = materialize_events(
                &[
                    event(
                        "delta",
                        1,
                        "message.delta",
                        "turn-1",
                        json!({
                            "itemId":"message", "text":"partial streamed body"
                        }),
                    ),
                    event(
                        "completed",
                        2,
                        "item.completed",
                        "turn-1",
                        json!({"item":completed}),
                    ),
                ],
                "session-1",
                "thread-1",
            )
            .unwrap();
            assert_eq!(changes.changed_items.len(), 1);
            let item = &changes.changed_items[0];
            assert_eq!(item.status, ItemStatus::Completed);
            assert!(
                matches!(&item.payload,
                    ThreadItemPayload::AgentMessage { text:actual, .. } if actual == text
                ),
                "typed completion lost its authoritative body: {item:?}"
            );
        }
    }
}

#[test]
fn snapshot_updates_do_not_turn_following_deltas_into_snapshots() {
    let changes = materialize_events(
        &[
            event(
                "delta",
                1,
                "message.delta",
                "turn-1",
                json!({
                    "itemId":"message", "text":"old"
                }),
            ),
            event(
                "snapshot",
                2,
                "item.updated",
                "turn-1",
                json!({
                    "itemId":"message", "type":"agent_message", "text":"new"
                }),
            ),
            event(
                "next-delta",
                3,
                "message.delta",
                "turn-1",
                json!({
                    "itemId":"message", "text":" tail"
                }),
            ),
        ],
        "session-1",
        "thread-1",
    )
    .unwrap();
    assert_eq!(changes.changed_items.len(), 1);
    assert!(matches!(&changes.changed_items[0].payload,
        ThreadItemPayload::AgentMessage { text, .. } if text == "new tail"
    ));
}
