use super::*;

impl AppendingRuntimeEventSink<'_> {
    pub(super) fn close_code_cell_traces(
        &self,
        status: Option<tool_runtime::tool_lifecycle::CodeCellRuntimeStatus>,
    ) -> Result<(), RuntimeCoreError> {
        if self.is_ephemeral()? {
            return Ok(());
        }
        if let (Some(writer), Some(status)) = (self.trace_event_writer.as_ref(), status) {
            if let Err(error) = writer.close_code_cells_for_turn(
                &self.session_id,
                &self.thread_id,
                &self.turn_id,
                status,
            ) {
                tracing::warn!(
                    "[trace-event-store] failed to close CodeCells for turn {}: {}",
                    self.turn_id,
                    error
                );
            }
        }
        Ok(())
    }

    pub(super) fn is_ephemeral(&self) -> Result<bool, RuntimeCoreError> {
        self.state
            .lock()
            .expect("runtime core state mutex poisoned")
            .sessions
            .get(&self.session_id)
            .map(|stored| session_is_ephemeral(&stored.session))
            .ok_or_else(|| RuntimeCoreError::SessionNotFound(self.session_id.clone()))
    }
}
