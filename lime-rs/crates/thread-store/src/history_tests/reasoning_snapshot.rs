use super::*;

#[test]
fn full_reasoning_arrays_replace_durable_partial_content_and_round_trip() {
    for (summary, content) in [
        (vec!["completed", "second"], vec!["safe content"]),
        (vec![], vec![]),
        (vec!["", "  "], vec!["\n"]),
    ] {
        let mut builder = ThreadHistoryBuilder::new();
        let mut first = reasoning_item(1, "partial content", "reasoning.delta");
        first.payload = ThreadItemPayload::Reasoning {
            summary: vec!["partial summary".to_string()],
            content: vec!["partial content".to_string()],
        };
        builder.append_items_at(1, vec![first]).unwrap();
        let mut completed = reasoning_item(2, "", "item.completed");
        completed.payload = ThreadItemPayload::Reasoning {
            summary: summary.iter().map(|part| part.to_string()).collect(),
            content: content.iter().map(|part| part.to_string()).collect(),
        };
        completed.status = ItemStatus::Completed;
        completed.metadata["reasoning_is_snapshot"] = serde_json::json!(true);
        let expected = completed.payload.clone();
        builder.append_items_at(2, vec![completed]).unwrap();
        let stored = &builder.raw_items()[0];
        assert_eq!(stored.payload, expected);
        assert_eq!(stored.status, ItemStatus::Completed);
        let restored: ThreadItem =
            serde_json::from_value(serde_json::to_value(stored).unwrap()).unwrap();
        assert_eq!(&restored, stored);
    }
}
