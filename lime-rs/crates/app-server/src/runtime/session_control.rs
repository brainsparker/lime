use super::status::agent_turn_blocks_queue_resume;
use super::*;
use agent_protocol::AgentInput as UserInput;
use app_server_protocol::*;

#[derive(Debug)]
pub(in crate::runtime) enum QueuedTurnResume {
    Empty,
    Blocked,
    Started {
        queued_turn_id: String,
        events: Vec<AgentEvent>,
    },
}

#[derive(Clone)]
pub(in crate::runtime) struct QueuedTurnResumeLease {
    index: usize,
    turn: AgentTurn,
    input: Vec<UserInput>,
    runtime_options: Option<RuntimeOptions>,
}

pub(in crate::runtime) fn normalize_session_control_id(
    value: &str,
    message: &str,
) -> Result<String, RuntimeCoreError> {
    let normalized = value.trim();
    if normalized.is_empty() {
        Err(RuntimeCoreError::Backend(message.to_string()))
    } else {
        Ok(normalized.to_string())
    }
}

impl RuntimeCore {
    #[cfg(test)]
    pub(in crate::runtime) async fn resume_next_queued_turn_if_idle(
        &self,
        session_id: &str,
        host: RuntimeHostContext,
    ) -> Result<QueuedTurnResume, RuntimeCoreError> {
        self.resume_queued_turn_if_idle_selected(session_id, None, host)
            .await
    }

    pub(in crate::runtime) async fn resume_queued_turn_if_idle_selected(
        &self,
        session_id: &str,
        queued_submission_id: Option<&str>,
        host: RuntimeHostContext,
    ) -> Result<QueuedTurnResume, RuntimeCoreError> {
        self.resume_queued_turn_if_idle_selected_with_mode(
            session_id,
            queued_submission_id,
            host,
            true,
        )
        .await
    }

    pub(in crate::runtime) async fn resume_next_queued_turn_for_recovery(
        &self,
        session_id: &str,
        host: RuntimeHostContext,
    ) -> Result<QueuedTurnResume, RuntimeCoreError> {
        self.resume_queued_turn_if_idle_selected_with_mode(session_id, None, host, false)
            .await
    }

    async fn resume_queued_turn_if_idle_selected_with_mode(
        &self,
        session_id: &str,
        queued_submission_id: Option<&str>,
        host: RuntimeHostContext,
        return_after_admission: bool,
    ) -> Result<QueuedTurnResume, RuntimeCoreError> {
        self.ensure_current_session_hydrated(session_id).await?;
        let queued = {
            let mut state = self
                .state
                .lock()
                .expect("runtime core state mutex poisoned");
            let stored = state
                .sessions
                .get_mut(session_id)
                .ok_or_else(|| RuntimeCoreError::SessionNotFound(session_id.to_string()))?;
            if stored
                .turns
                .iter()
                .any(|turn| agent_turn_blocks_queue_resume(turn.status))
            {
                return Ok(QueuedTurnResume::Blocked);
            }
            let index = match queued_submission_id {
                Some(queued_submission_id) => stored.turns.iter().position(|turn| {
                    turn.turn_id == queued_submission_id
                        && matches!(turn.status, AgentTurnStatus::Queued)
                }),
                None => stored
                    .turns
                    .iter()
                    .position(|turn| matches!(turn.status, AgentTurnStatus::Queued)),
            };
            let Some(index) = index else {
                if let Some(queued_submission_id) = queued_submission_id {
                    return Err(RuntimeCoreError::InvalidRequest(format!(
                        "queued submission not found: {queued_submission_id}"
                    )));
                }
                return Ok(QueuedTurnResume::Empty);
            };
            let turn = stored.turns.remove(index);
            let input = stored.turn_inputs.remove(&turn.turn_id).unwrap_or_default();
            let runtime_options = stored.turn_runtime_options.remove(&turn.turn_id);
            QueuedTurnResumeLease {
                index,
                turn,
                input,
                runtime_options,
            }
        };
        let queued_turn_id = queued.turn.turn_id.clone();
        let mut resumed_runtime_options = queued.runtime_options.clone().unwrap_or_default();
        resumed_runtime_options.queued_turn_id = Some(queued_turn_id.clone());
        let request = TurnStartRequest {
            session_id: session_id.to_string(),
            turn_id: Some(queued_turn_id.clone()),
            input: queued.input.clone(),
            runtime_options: Some(resumed_runtime_options),
            queue_if_busy: false,
            skip_pre_submit_resume: true,
        };
        let start_result = if return_after_admission {
            self.start_queued_turn_inner(
                request,
                host,
                None,
                false,
                true,
                super::turn_start::TurnStartInputKind::QueuedUser,
                queued.clone(),
            )
            .await
        } else {
            let event_hub = self.event_hub.clone();
            let mut publish_event = move |event| {
                event_hub.publish(event);
                Ok(())
            };
            self.start_queued_turn_inner(
                request,
                host,
                Some(&mut publish_event),
                false,
                false,
                super::turn_start::TurnStartInputKind::QueuedUser,
                queued.clone(),
            )
            .await
        };
        let output = match start_result {
            Ok(output) => output,
            Err(error) => {
                self.restore_queued_turn_if_missing(
                    session_id,
                    queued.index,
                    queued.turn,
                    queued.input,
                    queued.runtime_options,
                );
                return Err(error);
            }
        };
        Ok(QueuedTurnResume::Started {
            queued_turn_id,
            events: output.events,
        })
    }

    pub(in crate::runtime) fn restore_queued_turn_lease(
        &self,
        session_id: &str,
        queued: QueuedTurnResumeLease,
    ) {
        self.restore_queued_turn_if_missing(
            session_id,
            queued.index,
            queued.turn,
            queued.input,
            queued.runtime_options,
        );
    }

    pub async fn list_agent_session_file_checkpoints(
        &self,
        params: AgentSessionFileCheckpointListParams,
    ) -> Result<AgentSessionFileCheckpointListResponse, RuntimeCoreError> {
        let detail = self
            .read_current_detail_for_file_checkpoint(&params.session_id)
            .await?;
        crate::file_checkpoint::list_file_checkpoints(&detail).map_err(RuntimeCoreError::Backend)
    }

    pub async fn get_agent_session_file_checkpoint(
        &self,
        params: AgentSessionFileCheckpointGetParams,
    ) -> Result<AgentSessionFileCheckpointDetail, RuntimeCoreError> {
        let detail = self
            .read_current_detail_for_file_checkpoint(&params.session_id)
            .await?;
        let workspace_root = crate::file_checkpoint::resolve_workspace_root(&detail)
            .map_err(RuntimeCoreError::Backend)?;
        crate::file_checkpoint::get_file_checkpoint(
            &detail,
            workspace_root.as_path(),
            self.file_checkpoint_snapshot_store.as_ref(),
            &params.checkpoint_id,
        )
        .map_err(RuntimeCoreError::Backend)
    }

    pub async fn diff_agent_session_file_checkpoint(
        &self,
        params: AgentSessionFileCheckpointDiffParams,
    ) -> Result<AgentSessionFileCheckpointDiffResponse, RuntimeCoreError> {
        let detail = self
            .read_current_detail_for_file_checkpoint(&params.session_id)
            .await?;
        crate::file_checkpoint::diff_file_checkpoint(&detail, &params.checkpoint_id)
            .map_err(RuntimeCoreError::Backend)
    }

    pub async fn restore_agent_session_file_checkpoint(
        &self,
        params: AgentSessionFileCheckpointRestoreParams,
    ) -> Result<AgentSessionFileCheckpointRestoreResponse, RuntimeCoreError> {
        let detail = self
            .read_current_detail_for_file_checkpoint(&params.session_id)
            .await?;
        let workspace_root = crate::file_checkpoint::resolve_workspace_root(&detail)
            .map_err(RuntimeCoreError::Backend)?;
        crate::file_checkpoint::restore_file_checkpoint(
            &detail,
            workspace_root.as_path(),
            self.file_checkpoint_snapshot_store.as_ref(),
            &params.checkpoint_id,
            params.confirm_restore,
            params.create_backup,
        )
        .map_err(RuntimeCoreError::Backend)
    }

    async fn read_current_detail_for_file_checkpoint(
        &self,
        session_id: &str,
    ) -> Result<serde_json::Value, RuntimeCoreError> {
        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err(RuntimeCoreError::Backend(
                "sessionId is required for agentSession/fileCheckpoint".to_string(),
            ));
        }
        let response = self
            .read_session_current(AgentSessionReadParams {
                session_id: normalized_session_id.to_string(),
                history_limit: Some(1_000),
                history_offset: None,
                history_before_message_id: None,
            })
            .await?;
        response.detail.ok_or_else(|| {
            RuntimeCoreError::Backend(
                "agentSession/fileCheckpoint requires current session detail".to_string(),
            )
        })
    }
}
