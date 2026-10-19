use super::*;

/// Keep session checkpoints by rollout position, including the gap after the selected Turn.
/// A prefix ends before the first excluded Turn; a full fork includes the durable tail.
pub(super) fn selected_session_checkpoints(
    source_events: &[AgentEvent],
    source: &Thread,
    history: &ForkHistory,
) -> Result<Vec<AgentEvent>, RuntimeCoreError> {
    let events = super::super::history_replacement::effective_events(source_events);
    let cut = source
        .turns
        .iter()
        .find(|turn| !history.turn_ids.contains(turn.turn_id.as_str()))
        .map(|turn| {
            events
                .iter()
                .filter(|event| event.turn_id.as_deref() == Some(turn.turn_id.as_str()))
                .map(|event| event.sequence)
                .chain(turn.items.iter().map(|item| item.sequence))
                .min()
                .ok_or_else(|| invalid("thread/fork prefix has no durable Turn boundary"))
        })
        .transpose()?;
    let mut checkpoints = Vec::new();
    for (position, event) in events.iter().enumerate() {
        if event.event_type != "context.compaction.completed"
            || event.turn_id.is_some()
            || cut.is_some_and(|cut| event.sequence >= cut)
        {
            continue;
        }
        let snapshot = &events[..=position];
        let seed = super::super::context_compaction::latest_fork_compaction_seed(snapshot)?
            .ok_or_else(|| invalid("thread/fork session checkpoint has incomplete lineage"))?;
        super::super::context_compaction::boundary::validate_snapshot_boundary(
            snapshot,
            seed.covered_through_sequence,
        )?;
        checkpoints.push(event.clone());
    }
    Ok(checkpoints)
}

pub(super) fn copy_session_checkpoints(
    target: &mut StoredSession,
    checkpoints: Vec<AgentEvent>,
) -> Result<(), RuntimeCoreError> {
    for mut event in checkpoints {
        event.session_id = target.session.session_id.clone();
        event.thread_id = Some(target.session.thread_id.clone());
        event.event_id = format!(
            "evt-thread-fork-checkpoint-{}-{}",
            target.session.session_id, event.sequence
        );
        // Keep the checkpoint and covered prefix in the same sequence space. Only identity
        // fields change; replacement, window lineage and exact surviving suffix do not.
        event.payload["sessionId"] = Value::from(target.session.session_id.clone());
        event.payload["threadId"] = Value::from(target.session.thread_id.clone());
        if let Some(artifact) = event
            .payload
            .get_mut("artifact")
            .filter(|value| value.is_object())
        {
            artifact["sessionId"] = Value::from(target.session.session_id.clone());
            artifact["threadId"] = Value::from(target.session.thread_id.clone());
        }
        let slot = target
            .events
            .get_mut(event.sequence.saturating_sub(1) as usize)
            .filter(|slot| slot.event_type == "thread.fork.baseline")
            .ok_or_else(|| invalid("session checkpoint conflicts with canonical fork item"))?;
        *slot = event;
    }
    Ok(())
}

/// Canonical Items omit the artifact copy. Validate the selected checkpoint against its
/// original durable marker before a fork can make that checkpoint authoritative again.
pub(super) fn validate_source(
    source_events: &[AgentEvent],
    history: &ForkHistory,
) -> Result<(), RuntimeCoreError> {
    let events = super::super::history_replacement::effective_events(source_events);
    for item in history
        .changes
        .iter()
        .flat_map(|changes| &changes.changed_items)
    {
        let Some(expected) = fork_compaction_payload(item) else {
            continue;
        };
        let position = events
            .iter()
            .position(|event| {
                event.sequence == item.sequence
                    && event.event_type == "context.compaction.completed"
            })
            .ok_or_else(|| invalid("thread/fork compaction Item has no durable source marker"))?;
        let snapshot = &events[..=position];
        let seed = super::super::context_compaction::latest_fork_compaction_seed(snapshot)?
            .ok_or_else(|| invalid("thread/fork compaction marker has incomplete lineage"))?;
        super::super::context_compaction::boundary::validate_snapshot_boundary(
            snapshot,
            seed.covered_through_sequence,
        )?;
        for field in [
            "coveredThroughSequence",
            "replacementHistory",
            "windowNumber",
            "firstWindowId",
            "previousWindowId",
            "windowId",
        ] {
            if seed.payload[field] != expected[field] {
                return Err(invalid(format!(
                    "thread/fork compaction Item and durable marker disagree on {field}"
                )));
            }
        }
    }
    Ok(())
}
