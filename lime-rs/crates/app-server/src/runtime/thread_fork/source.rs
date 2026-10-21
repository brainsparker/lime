use super::*;

impl RuntimeCore {
    pub(super) async fn load_fork_source_session(
        &self,
        thread: &Thread,
        rollout_history: Option<(u64, Vec<AgentEvent>)>,
    ) -> Result<StoredSession, RuntimeCoreError> {
        if let Some((sequence, events)) = rollout_history {
            // Explicit file history is authoritative even if its identity is indexed or loaded.
            let mut stored = hydration::stored_session_snapshot(thread);
            stored.events = if events.is_empty() {
                let items = thread
                    .turns
                    .iter()
                    .flat_map(|turn| turn.items.iter().cloned())
                    .collect::<Vec<_>>();
                fork_history_seed_events(&stored.session, &thread.turns, &items, sequence)?
            } else {
                events
            };
            return Ok(stored);
        }
        match self.hydrate_thread_session(thread).await {
            Ok(()) => self
                .state
                .lock()
                .expect("runtime core state mutex poisoned")
                .sessions
                .get(thread.session_id.as_str())
                .cloned()
                .ok_or_else(|| {
                    RuntimeCoreError::SessionNotFound(thread.session_id.as_str().into())
                }),
            Err(error) => Err(error),
        }
    }

    pub(super) async fn read_fork_source(
        &self,
        params: &ThreadForkParams,
    ) -> Result<(Thread, Option<(u64, Vec<AgentEvent>)>), RuntimeCoreError> {
        let store = self.projection_store.as_deref().ok_or_else(|| {
            RuntimeCoreError::Backend("canonical thread store is unavailable".to_string())
        })?;
        if let Some(path) = params.path.as_deref() {
            let projection = store
                .as_any()
                .downcast_ref::<super::super::ProjectionStore>()
                .ok_or_else(|| {
                    RuntimeCoreError::Backend(
                        "thread/fork path reads require the canonical projection store".to_string(),
                    )
                })?;
            return projection
                .thread_for_rollout_path_sync(std::path::Path::new(path.trim()))
                .map(|(thread, sequence, events)| (thread, Some((sequence, events))))
                .map_err(invalid);
        }
        let thread_id = ThreadId::new(params.thread_id.trim());
        let thread = store
            .read_thread(ReadThreadParams {
                thread_id: thread_id.clone(),
                include_archived: true,
                turns_view: ThreadTurnsView::Full,
            })
            .await
            .map_err(store_error)?
            .ok_or_else(|| invalid(format!("thread not found: {thread_id}")))?;
        let history = match store
            .rollout_path_for_thread_sync(&thread_id)
            .map_err(store_error)?
        {
            Some(path) => {
                let (_, sequence, events) = store
                    .thread_for_rollout_path_sync(std::path::Path::new(&path))
                    .map_err(store_error)?;
                Some((sequence, events))
            }
            None => None,
        };
        Ok((thread, history))
    }
}
