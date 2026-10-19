use super::*;

// Assign once at the added/done boundary and retain the identity in durable history.
// Items without a provider id must not be discarded or renamed on cold replay.
pub(super) fn identified_item(
    payload: &Value,
    item: &Value,
    state: &mut ResponsesStreamState,
) -> Value {
    if !matches!(
        item.get("type").and_then(Value::as_str),
        Some("message" | "reasoning")
    ) {
        return item.clone();
    }
    let index = payload.get("output_index").and_then(Value::as_u64);
    let id = item
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
        .map(str::to_string)
        .or_else(|| index.and_then(|index| state.item_ids.get(&index).cloned()))
        .unwrap_or_else(|| format!("host_{:032x}", rand::random::<u128>()));
    if let Some(index) = index {
        state.item_ids.insert(index, id.clone());
    }
    let mut item = item.clone();
    item["id"] = Value::String(id);
    item
}

pub(super) fn source_id(payload: &Value, prefix: &str, state: &ResponsesStreamState) -> String {
    if payload.get("item_id").is_none() {
        if let Some(id) = payload
            .get("output_index")
            .and_then(Value::as_u64)
            .and_then(|index| state.item_ids.get(&index))
        {
            return format!("{prefix}-{id}");
        }
    }
    response_block_id(payload, prefix)
}

pub(super) fn completed(item: &Value, state: &mut ResponsesStreamState) -> Vec<LlmEvent> {
    let family = match item.get("type").and_then(Value::as_str) {
        Some("message") => "text",
        Some("reasoning") => "reasoning",
        _ => return Vec::new(),
    };
    let id = item["id"]
        .as_str()
        .expect("completed item has an assigned identity");
    if !state.completed_items.insert(id.to_string()) {
        return Vec::new();
    }
    let source_id = format!("{family}-{id}");
    let mut events = vec![LlmEvent::ResponseItemDone {
        source_id: source_id.clone(),
        item: item.clone(),
        producer: None,
    }];
    if family == "text" && state.text_ids.remove(&source_id) {
        events.push(LlmEvent::TextEnd { id: source_id });
    } else if family == "reasoning" && state.reasoning_ids.remove(&source_id) {
        events.push(LlmEvent::ReasoningEnd { id: source_id });
    }
    events
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completion_uses_added_identity_when_done_omits_it() {
        let mut state = ResponsesStreamState::default();
        let payload = serde_json::json!({"output_index":3});
        let added = identified_item(
            &payload,
            &serde_json::json!({"type":"reasoning","summary":[]}),
            &mut state,
        );
        let id = added["id"].as_str().unwrap();
        assert_eq!(
            source_id(&payload, "reasoning", &state),
            format!("reasoning-{id}")
        );
        let done = identified_item(
            &payload,
            &serde_json::json!({"type":"reasoning",
            "summary":[],"encrypted_content":"fixture-only"}),
            &mut state,
        );
        assert_eq!(added["id"], done["id"]);
        let events = completed(&done, &mut state);
        assert!(
            matches!(events.as_slice(), [LlmEvent::ResponseItemDone { item, producer: None, .. }] if item == &done)
        );
        assert!(
            completed(&done, &mut state).is_empty(),
            "same completed identity must not be emitted twice"
        );
    }

    #[test]
    fn terminal_output_array_is_not_a_second_completed_item_source() {
        let mut reducer = ResponsesEventReducer::new(None, false);
        let item = serde_json::json!({"type":"message","id":"msg_history","role":"assistant",
            "phase":"partial_answer","content":[{"type":"output_text","text":"answer"}]});
        let first = reducer.push(&serde_json::json!({"type":"response.output_item.done","output_index":0,"item":item})).unwrap();
        assert_eq!(
            first
                .events
                .iter()
                .filter(|event| matches!(event, LlmEvent::ResponseItemDone { .. }))
                .count(),
            1
        );
        let terminal = reducer.push(&serde_json::json!({"type":"response.completed","response":{"id":"resp_history","output":[item]}})).unwrap();
        assert!(terminal.terminal);
        assert!(!terminal
            .events
            .iter()
            .any(|event| matches!(event, LlmEvent::ResponseItemDone { .. })));
    }
}
