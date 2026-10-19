use super::*;

pub(super) fn copy_model_records(
    source: &mut StoredSession,
    model_history: Vec<AgentEvent>,
    turn_ids: &HashSet<String>,
    history_sequence: u64,
) -> Result<(), RuntimeCoreError> {
    for mut event in model_history.into_iter().filter(|event| {
        event.event_type == agent_runtime::model_history::MODEL_HISTORY_EVENT_TYPE
            && event.sequence <= history_sequence
            && event
                .turn_id
                .as_ref()
                .is_some_and(|id| turn_ids.contains(id))
    }) {
        event.session_id = source.session.session_id.clone();
        event.thread_id = Some(source.session.thread_id.clone());
        event.event_id = format!(
            "evt-thread-fork-model-history-{}-{}",
            source.session.session_id, event.sequence
        );
        let slot = source
            .events
            .get_mut(event.sequence.saturating_sub(1) as usize)
            .filter(|slot| slot.event_type == "thread.fork.baseline")
            .ok_or_else(|| invalid("model tool history conflicts with canonical fork item"))?;
        *slot = event;
    }
    Ok(())
}
