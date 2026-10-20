use super::{canonical_thread_store, session_is_ephemeral, RuntimeCore, RuntimeCoreError};

impl RuntimeCore {
    pub(super) fn prepare_session_input(
        &self,
        session: &app_server_protocol::AgentSession,
        input: Vec<agent_protocol::AgentInput>,
    ) -> Result<super::input_media::PreparedRuntimeInput, RuntimeCoreError> {
        let prepare = if session_is_ephemeral(session) {
            super::input_media::prepare_ephemeral_runtime_input
        } else {
            super::input_media::prepare_runtime_input
        };
        prepare(input, self.sidecar_store.as_deref(), &session.session_id)
            .map_err(RuntimeCoreError::Backend)
    }

    pub(super) fn loaded_ephemeral_thread(
        &self,
        thread_id: &str,
    ) -> Option<agent_protocol::Thread> {
        self.state
            .lock()
            .expect("runtime core state mutex poisoned")
            .sessions
            .values()
            .find(|stored| {
                stored.session.thread_id == thread_id && session_is_ephemeral(&stored.session)
            })
            .map(canonical_thread_store::canonical_thread_from_stored_session)
    }

    pub(super) fn reject_ephemeral_history(
        &self,
        thread_id: &str,
        operation: &str,
    ) -> Result<(), RuntimeCoreError> {
        if self.loaded_ephemeral_thread(thread_id).is_some() {
            return Err(RuntimeCoreError::InvalidRequest(format!(
                "ephemeral threads do not support {operation}"
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests;
