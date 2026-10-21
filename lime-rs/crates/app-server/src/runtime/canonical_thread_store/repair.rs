use super::*;

impl ProjectionStore {
    pub(in crate::runtime) fn repair_canonical_history(
        &self,
        stored: &StoredSession,
        events: &[AgentEvent],
    ) -> Result<(), String> {
        if super::super::session_is_ephemeral(&stored.session) {
            return Ok(());
        }
        if self.rollout_store().is_some() {
            // Raw diagnostic events are not allowed to replace canonical rollout history.
            return Ok(());
        }
        let changes = super::super::thread_item_projection::materialize_events(
            events,
            &stored.session.session_id,
            &stored.session.thread_id,
        )
        .map_err(|error| error.to_string())?;
        let thread_id = ThreadId::new(stored.session.thread_id.clone());
        let session_id = agent_protocol::SessionId::new(stored.session.session_id.clone());
        let changes = normalize_replayed_change_set(&session_id, &thread_id, changes)
            .map_err(|error| error.to_string())?;
        let current = self
            .read_thread_sync(ReadThreadParams {
                thread_id: thread_id.clone(),
                include_archived: true,
                turns_view: ThreadTurnsView::Full,
            })
            .map_err(|error| error.to_string())?;
        if current
            .as_ref()
            .is_some_and(|thread| canonical_history_matches(thread, &changes))
        {
            return Ok(());
        }

        self.replace_canonical_history(stored, thread_id, changes)
            .map_err(|error| error.to_string())
    }

    fn replace_canonical_history(
        &self,
        stored: &StoredSession,
        thread_id: ThreadId,
        changes: ThreadHistoryChangeSet,
    ) -> ThreadStoreResult<()> {
        let apply_params = ApplyThreadHistoryParams {
            session_id: agent_protocol::SessionId::new(stored.session.session_id.clone()),
            thread_id: thread_id.clone(),
            changes,
        };
        validate_change_set(&apply_params)?;
        let fingerprint = change_fingerprint(&apply_params)?;
        let mut conn = self.open_thread_store()?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(store_error)?;
        let existing = tx
            .query_row(
                "SELECT session_id, last_sequence FROM canonical_threads WHERE thread_id = ?1",
                params![thread_id.as_str()],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?)),
            )
            .optional()
            .map_err(store_error)?;

        if let Some((session_id, last_sequence)) = existing {
            if session_id != stored.session.session_id {
                return Err(error("session/thread identity mismatch"));
            }
            if last_sequence
                .is_some_and(|sequence| sequence.max(0) as u64 > apply_params.changes.sequence)
            {
                return Err(error(format!(
                    "canonical history advanced to {} while repairing sequence {}",
                    last_sequence.unwrap_or_default(),
                    apply_params.changes.sequence
                )));
            }
            tx.execute(
                "DELETE FROM canonical_items WHERE thread_id = ?1",
                params![thread_id.as_str()],
            )
            .map_err(store_error)?;
            tx.execute(
                "DELETE FROM canonical_turns WHERE thread_id = ?1",
                params![thread_id.as_str()],
            )
            .map_err(store_error)?;
            tx.execute(
                "DELETE FROM canonical_history_applies WHERE thread_id = ?1",
                params![thread_id.as_str()],
            )
            .map_err(store_error)?;
            tx.execute(
                "UPDATE canonical_threads SET last_sequence = NULL WHERE thread_id = ?1",
                params![thread_id.as_str()],
            )
            .map_err(store_error)?;
        } else {
            insert_thread_row(&tx, canonical_thread_from_stored_session(stored), None)?;
        }

        if apply_params.changes.sequence > 0 {
            apply_change_set(&tx, &apply_params)?;
            refresh_thread_snapshot(&tx, &thread_id, apply_params.changes.sequence)?;
            tx.execute(
                "INSERT INTO canonical_history_applies (thread_id, sequence, fingerprint)
                 VALUES (?1, ?2, ?3)",
                params![
                    thread_id.as_str(),
                    to_i64(apply_params.changes.sequence, "history sequence")?,
                    fingerprint,
                ],
            )
            .map_err(store_error)?;
        }
        tx.commit().map_err(store_error)
    }
}
