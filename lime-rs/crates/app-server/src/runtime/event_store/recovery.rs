use super::*;

impl RuntimeCore {
    /// Replays an EventLog-first tail after a downstream canonical projection failure.
    ///
    /// This is intentionally narrower than normal append: callers have already proved the exact
    /// events are durable in the canonical JSONL log, so replay must never write that log again.
    pub(in crate::runtime) fn replay_durable_runtime_events(
        &self,
        session_id: &str,
        durable_events: Vec<AgentEvent>,
    ) -> Result<Vec<AgentEvent>, RuntimeCoreError> {
        if durable_events.is_empty() {
            return Ok(Vec::new());
        }
        let mut state = self
            .state
            .lock()
            .expect("runtime core state mutex poisoned");
        let stored = state
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| RuntimeCoreError::SessionNotFound(session_id.to_string()))?;

        let mut replay = Vec::new();
        for event in durable_events {
            if event.session_id != session_id {
                return Err(RuntimeCoreError::Backend(format!(
                    "durable event replay scope mismatch for session {session_id}"
                )));
            }
            if let Some(existing) = stored.events.iter().find(|existing| {
                existing.event_id == event.event_id || existing.sequence == event.sequence
            }) {
                if existing != &event {
                    return Err(RuntimeCoreError::Backend(format!(
                        "durable event replay identity conflict for session {session_id}"
                    )));
                }
                continue;
            }
            replay.push(event);
        }
        if replay.is_empty() {
            return Ok(Vec::new());
        }
        replay.sort_by_key(|event| event.sequence);
        let next_sequence = stored
            .events
            .last()
            .map(|event| event.sequence.saturating_add(1))
            .unwrap_or(1);
        if replay
            .iter()
            .enumerate()
            .any(|(index, event)| event.sequence != next_sequence + index as u64)
        {
            return Err(RuntimeCoreError::Backend(format!(
                "durable event replay is not the contiguous EventLog tail for session {session_id}"
            )));
        }

        let notifications = notification_events_with_canonical_entities(stored, &replay)?;
        let projection_store = self.projection_store.as_deref().ok_or_else(|| {
            RuntimeCoreError::Backend(
                "durable event replay requires a ProjectionStore for canonical recovery"
                    .to_string(),
            )
        })?;
        projection_store
            .apply_canonical_events_with_media(stored, &replay, self.sidecar_store.as_deref())
            .map_err(|error| {
                RuntimeCoreError::Backend(format!(
                    "canonical mailbox Item recovery failed after EventLog append: {error}"
                ))
            })?;
        let terminal_activities = projection_store
            .append_terminal_agent_results_sync(
                &agent_protocol::ThreadId::new(stored.session.thread_id.clone()),
                &replay,
            )
            .map_err(|error| {
                RuntimeCoreError::Backend(format!(
                    "durable child terminal activity recovery failed: {error}"
                ))
            })?;
        super::agent_terminal_activity::publish_terminal_agent_activities(
            &self.session_loops,
            terminal_activities,
        );
        if let Err(error) = projection_store.apply_events(&replay) {
            tracing::warn!(
                "[projection-store] failed to replay {} durable events for session {}: {}",
                replay.len(),
                session_id,
                error
            );
        }
        for event in replay {
            apply_runtime_event_state_transition(
                stored,
                event.turn_id.as_deref(),
                event.event_type.as_str(),
                &event.timestamp,
            );
            stored.events.push(event);
        }
        Ok(notifications)
    }

    /// Appends a terminal event for a turn that exists only in a verified durable EventLog tail.
    ///
    /// Normal callers must target a loaded turn. Mailbox recovery is different: the failed turn
    /// was intentionally rolled back from memory while its EventLog-first input remained durable.
    pub(in crate::runtime) fn append_durable_recovery_terminal_event(
        &self,
        session_id: &str,
        turn_id: &str,
        runtime_event: RuntimeEvent,
    ) -> Result<Vec<AgentEvent>, RuntimeCoreError> {
        if !is_turn_terminal_event_class(normalized_runtime_event_class(&runtime_event.event_type))
        {
            return Err(RuntimeCoreError::Backend(
                "durable recovery accepts terminal events only".to_string(),
            ));
        }
        let mut state = self
            .state
            .lock()
            .expect("runtime core state mutex poisoned");
        let stored = state
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| RuntimeCoreError::SessionNotFound(session_id.to_string()))?;
        let thread_id = stored.session.thread_id.clone();
        let session_status = stored.session.status;
        let session_updated_at = stored.session.updated_at.clone();
        let events = append_runtime_events_to_stored_session(
            stored,
            self.file_checkpoint_snapshot_store.as_ref(),
            self.output_snapshot_store.as_ref(),
            self.sidecar_store.as_deref(),
            self.event_log_writer.as_deref(),
            self.trace_event_writer.as_deref(),
            self.projection_store.as_deref(),
            Some(&self.session_loops),
            session_id,
            &thread_id,
            Some(turn_id),
            vec![runtime_event],
            None,
            TerminalTurnAppendPolicy::Allow,
        )?;
        stored.session.status = session_status;
        stored.session.updated_at = session_updated_at;
        Ok(events)
    }
}
