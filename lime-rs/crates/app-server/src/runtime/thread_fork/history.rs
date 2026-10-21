use super::*;

pub(in crate::runtime) fn fork_history_seed_events(
    session: &AgentSession,
    canonical_turns: &[Turn],
    canonical_items: &[ThreadItem],
    through_sequence: u64,
) -> Result<Vec<AgentEvent>, RuntimeCoreError> {
    let mut turns_by_id = BTreeMap::new();
    for turn in canonical_turns {
        if turns_by_id
            .insert(turn.turn_id.as_str().to_string(), turn)
            .is_some()
        {
            return Err(invalid(format!(
                "thread/fork canonical history has duplicate turn {}",
                turn.turn_id
            )));
        }
    }
    let mut items_by_sequence = BTreeMap::new();
    for item in canonical_items {
        validate_fork_canonical_item(item)?;
        if item.sequence == 0 || item.sequence > through_sequence {
            return Err(invalid(format!(
                "thread/fork canonical item {} has invalid sequence {} through {}",
                item.item_id, item.sequence, through_sequence
            )));
        }
        if items_by_sequence.insert(item.sequence, item).is_some() {
            return Err(invalid(format!(
                "thread/fork canonical history has duplicate item sequence {}",
                item.sequence
            )));
        }
        if !turns_by_id.contains_key(item.turn_id.as_str()) {
            return Err(invalid(format!(
                "thread/fork canonical item {} has no owning turn",
                item.item_id
            )));
        }
    }
    for turn in canonical_turns {
        if !canonical_items
            .iter()
            .any(|item| item.turn_id == turn.turn_id)
        {
            return Err(invalid(format!(
                "thread/fork cannot preserve turn {} without canonical items",
                turn.turn_id
            )));
        }
    }

    (1..=through_sequence)
        .map(|sequence| {
            let item = items_by_sequence.get(&sequence).copied();
            let timestamp = item
                .and_then(|item| {
                    chrono::Utc
                        .timestamp_millis_opt(item.updated_at_ms)
                        .single()
                        .map(|value| value.to_rfc3339())
                })
                .unwrap_or_else(|| session.updated_at.clone());
            let (event_type, payload) = item.map_or_else(
                || ("thread.fork.baseline".to_string(), Value::Null),
                |item| {
                    let mut turn = (*turns_by_id
                        .get(item.turn_id.as_str())
                        .expect("canonical item turn was validated"))
                    .clone();
                    turn.items.clear();
                    if let Some(mut payload) = fork_compaction_payload(item) {
                        payload["forkTurn"] = serde_json::to_value(turn)
                            .expect("validated canonical turn must serialize");
                        return ("context.compaction.completed".to_string(), payload);
                    }
                    (
                        FORK_CANONICAL_ITEM_EVENT_TYPE.to_string(),
                        serde_json::json!({ "item": item, "forkTurn": turn }),
                    )
                },
            );
            Ok(AgentEvent {
                event_id: format!("evt-thread-fork-baseline-{}-{sequence}", session.session_id),
                sequence,
                session_id: session.session_id.clone(),
                thread_id: Some(session.thread_id.clone()),
                turn_id: item.map(|item| item.turn_id.as_str().to_string()),
                event_type,
                timestamp,
                payload,
            })
        })
        .collect()
}

pub(super) fn fork_compaction_payload(item: &ThreadItem) -> Option<Value> {
    let ThreadItemPayload::ContextCompaction {
        summary,
        replacement_history,
        window_number,
        first_window_id,
        previous_window_id,
        window_id,
        covered_through_sequence,
    } = &item.payload
    else {
        return None;
    };
    Some(serde_json::json!({
        "itemId": item.item_id.as_str(),
        "summary": summary,
        "replacementHistory": replacement_history,
        "windowNumber": window_number,
        "firstWindowId": first_window_id,
        "previousWindowId": previous_window_id,
        "windowId": window_id,
        "coveredThroughSequence": covered_through_sequence,
    }))
}

pub(super) fn merge_fork_history_seed(
    stored: &mut StoredSession,
    seed: Vec<AgentEvent>,
) -> Result<(), RuntimeCoreError> {
    stored.events = merge_fork_history_events(seed, std::mem::take(&mut stored.events))?;
    Ok(())
}

pub(in crate::runtime) fn merge_fork_history_events(
    seed: Vec<AgentEvent>,
    mut existing: Vec<AgentEvent>,
) -> Result<Vec<AgentEvent>, RuntimeCoreError> {
    let prefix_len = seed.len();
    let mut merged = seed;
    existing.sort_by_key(|event| event.sequence);

    for event in existing {
        let sequence = usize::try_from(event.sequence)
            .map_err(|_| invalid("thread/fork event sequence does not fit in memory"))?;
        if sequence == 0 {
            return Err(invalid("thread/fork event sequence must start at one"));
        }
        if sequence <= prefix_len {
            let canonical = &merged[sequence - 1];
            if canonical.event_type == "thread.fork.baseline"
                && (event.event_type == agent_runtime::model_history::MODEL_HISTORY_EVENT_TYPE
                    || (event.event_type == "context.compaction.completed"
                        && event.turn_id.is_none())
                    || event.event_type == FORK_INTERRUPTED_MARKER_EVENT_TYPE
                    || (event.event_type == "turn.canceled"
                        && event.payload.get("forkSnapshot").and_then(Value::as_bool)
                            == Some(true)))
            {
                merged[sequence - 1] = event;
                continue;
            }
            if canonical.sequence != event.sequence
                || canonical.event_id != event.event_id
                || canonical.session_id != event.session_id
                || canonical.thread_id != event.thread_id
                || canonical.turn_id != event.turn_id
                || canonical.event_type != event.event_type
                || canonical.payload != event.payload
            {
                return Err(invalid(format!(
                    "thread/fork canonical seed conflicts at sequence {}: canonical={canonical:?}, existing={event:?}",
                    event.sequence,
                )));
            }
            continue;
        }
        let expected = merged.len() + 1;
        if sequence != expected {
            return Err(invalid(format!(
                "thread/fork target EventLog is not contiguous: expected {expected}, got {sequence}"
            )));
        }
        merged.push(event);
    }
    Ok(merged)
}
