use crate::runtime::session_control::normalize_session_control_id;
use crate::runtime::status::agent_turn_is_active;
use crate::runtime::*;
use agent_runtime::session_loop::{
    RuntimeSessionClosureTask, RuntimeSessionOperation, RuntimeSessionOperationResult,
    RuntimeSessionOperationSubmission, RuntimeSessionSubmitResult, RuntimeSessionTaskFailure,
    RuntimeSessionTaskKind, RuntimeSessionTaskOutcome,
};
use app_server_protocol::protocol::v2::{
    ThreadCompactStartParams, ThreadCompactStartResponse, METHOD_THREAD_COMPACT_START,
};
use app_server_protocol::*;
use serde_json::{json, Map, Value};
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};

impl RuntimeCore {
    pub async fn compact_thread(
        &self,
        params: ThreadCompactStartParams,
    ) -> Result<RuntimeCoreOutput<ThreadCompactStartResponse>, RuntimeCoreError> {
        let thread_id = normalize_session_control_id(
            &params.thread_id,
            "threadId is required for thread/compact/start",
        )?;
        let session_id = self
            .loaded_session_id_for_thread(&thread_id)
            .ok_or_else(|| {
                RuntimeCoreError::InvalidRequest(format!("thread not found: {thread_id}"))
            })?;
        let runtime = self.clone();
        let actor_session_id = session_id.clone();
        let task = RuntimeSessionClosureTask::new(
            new_id("compact"),
            Vec::new(),
            move |context, _input, cancellation| {
                let runtime = runtime.clone();
                let session_id = session_id.clone();
                let turn_id = context.turn_id().to_string();
                Box::pin(async move {
                    let output = runtime
                        .compact_session_now(
                            &session_id,
                            &turn_id,
                            None,
                            METHOD_THREAD_COMPACT_START,
                            "manual",
                            None,
                            cancellation,
                        )
                        .await
                        .map_err(|error| RuntimeSessionTaskFailure {
                            message: error.to_string(),
                            reason_code: None,
                        })?;
                    for event in output.events {
                        runtime.event_hub.publish(event);
                    }
                    Ok(())
                })
            },
        )
        .with_kind(RuntimeSessionTaskKind::Compact);
        let session = self
            .session_loops
            .get_or_create(&actor_session_id, &thread_id)
            .await
            .map_err(|error| RuntimeCoreError::Backend(error.to_string()))?;
        let result = session
            .dispatch(RuntimeSessionOperationSubmission::new(
                RuntimeSessionOperation::Compact {
                    task: Arc::new(task),
                },
            ))
            .await
            .map_err(|error| RuntimeCoreError::Backend(error.to_string()))?;
        match result {
            RuntimeSessionOperationResult::Submission(submission)
                if matches!(submission.result, RuntimeSessionSubmitResult::Started) =>
            {
                Ok(RuntimeCoreOutput {
                    response: ThreadCompactStartResponse {},
                    events: Vec::new(),
                })
            }
            RuntimeSessionOperationResult::Submission(submission) => {
                Err(RuntimeCoreError::Backend(format!(
                    "compact operation was not started: {:?}",
                    submission.result
                )))
            }
            _ => Err(RuntimeCoreError::Backend(
                "compact operation returned an invalid receipt".to_string(),
            )),
        }
    }

    pub(in crate::runtime) async fn compact_session_with_trigger(
        &self,
        session_id: &str,
        event_name: Option<&str>,
        source: &str,
        trigger: &str,
        trigger_context: Option<Value>,
    ) -> Result<RuntimeCoreOutput<ThreadCompactStartResponse>, RuntimeCoreError> {
        self.ensure_current_session_hydrated(session_id).await?;
        let thread_id = self
            .state
            .lock()
            .expect("runtime core state mutex poisoned")
            .sessions
            .get(session_id)
            .map(|stored| stored.session.thread_id.clone())
            .ok_or_else(|| RuntimeCoreError::SessionNotFound(session_id.to_string()))?;
        let runtime = self.clone();
        let session_id = session_id.to_string();
        let event_name = event_name.map(str::to_string);
        let source = source.to_string();
        let trigger = trigger.to_string();
        let actor_session_id = session_id.clone();
        let (output_tx, output_rx) = oneshot::channel();
        let output_tx = Arc::new(Mutex::new(Some(output_tx)));
        let task = RuntimeSessionClosureTask::new(
            new_id("compact"),
            Vec::new(),
            move |context, _input, cancellation| {
                let runtime = runtime.clone();
                let session_id = session_id.clone();
                let turn_id = context.turn_id().to_string();
                let event_name = event_name.clone();
                let source = source.clone();
                let trigger = trigger.clone();
                let trigger_context = trigger_context.clone();
                let output_tx = Arc::clone(&output_tx);
                Box::pin(async move {
                    let output = runtime
                        .compact_session_now(
                            &session_id,
                            &turn_id,
                            event_name.as_deref(),
                            &source,
                            &trigger,
                            trigger_context,
                            cancellation,
                        )
                        .await;
                    match output {
                        Ok(output) => {
                            if let Some(sender) = output_tx.lock().await.take() {
                                let _ = sender.send(Ok(output));
                            }
                            Ok(())
                        }
                        Err(error) => {
                            let message = error.to_string();
                            if let Some(sender) = output_tx.lock().await.take() {
                                let _ = sender.send(Err(message.clone()));
                            }
                            Err(RuntimeSessionTaskFailure {
                                message,
                                reason_code: None,
                            })
                        }
                    }
                })
            },
        )
        .with_kind(RuntimeSessionTaskKind::Compact);
        let session = self
            .session_loops
            .get_or_create(&actor_session_id, &thread_id)
            .await
            .map_err(|error| RuntimeCoreError::Backend(error.to_string()))?;
        let result = session
            .dispatch(RuntimeSessionOperationSubmission::new(
                RuntimeSessionOperation::Compact {
                    task: Arc::new(task),
                },
            ))
            .await
            .map_err(|error| RuntimeCoreError::Backend(error.to_string()))?;
        let RuntimeSessionOperationResult::Submission(submission) = result else {
            return Err(RuntimeCoreError::Backend(
                "compact operation returned an invalid receipt".to_string(),
            ));
        };
        match submission.completion.await.map_err(|_| {
            RuntimeCoreError::Backend("compact operation completion channel closed".to_string())
        })? {
            Ok(RuntimeSessionTaskOutcome::Completed) => {}
            Ok(outcome) => {
                return Err(RuntimeCoreError::Backend(format!(
                    "compact operation ended without completion: {outcome:?}"
                )));
            }
            Err(error) => return Err(RuntimeCoreError::Backend(error.message)),
        }
        output_rx
            .await
            .map_err(|_| RuntimeCoreError::Backend("compact output channel closed".to_string()))?
            .map_err(RuntimeCoreError::Backend)
    }

    async fn compact_session_now(
        &self,
        session_id: &str,
        turn_id: &str,
        event_name: Option<&str>,
        source: &str,
        trigger: &str,
        trigger_context: Option<Value>,
        cancellation: tokio_util::sync::CancellationToken,
    ) -> Result<RuntimeCoreOutput<ThreadCompactStartResponse>, RuntimeCoreError> {
        self.ensure_current_session_hydrated(session_id).await?;
        let (_, turns) = self.session_snapshot(session_id)?;
        let active_turn_ids = turns
            .iter()
            .filter(|turn| agent_turn_is_active(turn.status))
            .map(|turn| turn.turn_id.clone())
            .collect::<Vec<_>>();
        for turn_id in active_turn_ids {
            self.cancel_turn(
                AgentSessionTurnCancelParams {
                    session_id: session_id.to_string(),
                    turn_id,
                },
                RuntimeHostContext::default(),
            )
            .await?;
        }
        let (session, turns) = self.session_snapshot(session_id)?;
        let existing_events = self.events_for_session(session_id)?;
        let covered_through_sequence =
            super::boundary::retained_tail_coverage(&turns, &existing_events)?;
        let context_epoch = super::next_compaction_window_number(
            &existing_events,
            super::latest_compaction_window(&existing_events)?.as_ref(),
        );
        let compaction_id = new_id("compact_item");
        self.create_compaction_turn(&session.session_id, &session.thread_id, turn_id)?;
        let event_name = event_name
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(METHOD_THREAD_COMPACT_START);
        let started = self.append_runtime_events(
            &session.session_id,
            &session.thread_id,
            Some(turn_id),
            vec![
                RuntimeEvent::new("turn.accepted", json!({"source": source})),
                RuntimeEvent::new("turn.started", json!({"source": source})),
                RuntimeEvent::new(
                    "context.compaction.started",
                    json!({
                        "source": source,
                        "eventName": event_name,
                        "compactionId": compaction_id,
                        "contextEpoch": context_epoch,
                        "trigger": trigger,
                        "triggerContext": trigger_context,
                    }),
                ),
            ],
        )?;
        for event in started {
            self.event_hub.publish(event);
        }
        let result = async {
            let (request, history) = self.context_compaction_request(&session, turn_id)?;
            let summary = tokio::select! {
                biased;
                _ = cancellation.cancelled() => return Err(RuntimeCoreError::Backend("context compaction cancelled".to_string())),
                result = self.backend.compact_context(request, history, cancellation.clone()) => result?,
            };
            if cancellation.is_cancelled() {
                return Err(RuntimeCoreError::Backend("context compaction cancelled".to_string()));
            }
            super::build_session_context_compaction(
                &session,
                &turns,
                &existing_events,
                covered_through_sequence,
                &compaction_id,
                &summary,
                self.sidecar_store.as_deref(),
            )
        }.await;
        let compaction = match result {
            Ok(compaction) => compaction,
            Err(error) => {
                let (item_event, turn_event, stage) = if cancellation.is_cancelled() {
                    (
                        "context.compaction.canceled",
                        "turn.canceled",
                        "interrupted",
                    )
                } else {
                    ("context.compaction.failed", "turn.failed", "failed")
                };
                for event in self.append_runtime_events(
                    &session.session_id,
                    &session.thread_id,
                    Some(turn_id),
                    vec![
                        RuntimeEvent::new(
                            item_event,
                            json!({
                                "compactionId": compaction_id,
                                "message": error.to_string(),
                                "stage": stage,
                            }),
                        ),
                        RuntimeEvent::new(turn_event, json!({"message": error.to_string()})),
                    ],
                )? {
                    self.event_hub.publish(event);
                }
                return Err(error);
            }
        };
        let mut completed_payload = Map::new();
        completed_payload.insert("source".to_string(), json!(source));
        completed_payload.insert("eventName".to_string(), json!(event_name));
        completed_payload.insert("compactionId".to_string(), json!(compaction.compaction_id));
        completed_payload.insert("contextEpoch".to_string(), json!(compaction.context_epoch));
        completed_payload.insert(
            "coveredThroughSequence".to_string(),
            json!(compaction.covered_through_sequence),
        );
        completed_payload.insert(
            "replacementHistory".to_string(),
            json!(compaction.window.replacement_history),
        );
        completed_payload.insert(
            "windowNumber".to_string(),
            json!(compaction.window.window_number),
        );
        completed_payload.insert(
            "firstWindowId".to_string(),
            json!(compaction.window.first_window_id),
        );
        completed_payload.insert(
            "previousWindowId".to_string(),
            json!(compaction.window.previous_window_id),
        );
        completed_payload.insert("windowId".to_string(), json!(compaction.window.window_id));
        completed_payload.insert("turnCount".to_string(), json!(turns.len()));
        completed_payload.insert("trigger".to_string(), json!(trigger));
        if let Some(trigger_context) = trigger_context.clone() {
            completed_payload.insert("triggerContext".to_string(), trigger_context);
        }
        completed_payload.insert("summary".to_string(), json!(compaction.summary));
        completed_payload.insert("artifact".to_string(), json!(compaction.artifact));
        completed_payload.insert(
            output_refs::SIDECAR_REF_FIELD.to_string(),
            json!(compaction.sidecar_ref),
        );

        let events = self.append_runtime_events(
            &session.session_id,
            &session.thread_id,
            Some(turn_id),
            vec![
                RuntimeEvent::new(
                    "context.compaction.completed",
                    Value::Object(completed_payload),
                ),
                RuntimeEvent::new("turn.completed", json!({"source": source})),
            ],
        )?;
        Ok(RuntimeCoreOutput {
            response: ThreadCompactStartResponse {},
            events,
        })
    }

    fn context_compaction_request(
        &self,
        session: &AgentSession,
        turn_id: &str,
    ) -> Result<(ExecutionRequest, ProviderTurnHistory), RuntimeCoreError> {
        let (latest_options, history) = {
            let state = self
                .state
                .lock()
                .expect("runtime core state mutex poisoned");
            let stored = state
                .sessions
                .get(&session.session_id)
                .ok_or_else(|| RuntimeCoreError::SessionNotFound(session.session_id.clone()))?;
            let latest_options = stored
                .turns
                .iter()
                .rev()
                .find_map(|turn| stored.turn_runtime_options.get(&turn.turn_id).cloned());
            let history = crate::runtime::provider_history::provider_turn_history_excluding_current_turn_input(
                stored, self.sidecar_store.as_deref(), turn_id,
            )?;
            (latest_options, history)
        };
        let defaults = self.session_runtime_defaults(&session.session_id)?;
        let mut options = match defaults {
            Some(defaults) => crate::runtime::session_runtime_defaults::merge_with_request_options(
                defaults,
                latest_options,
            ),
            None => latest_options.unwrap_or_default(),
        };
        if let Some((_, settings, _)) = self.loaded_thread_settings(&session.thread_id)? {
            let request = options.runtime_request_mut();
            request.provider_preference = Some(settings.model_provider);
            request.model_preference = Some(settings.model);
            request.reasoning_effort = settings.effort;
            request.service_tier = settings.service_tier;
        }
        Ok((
            ExecutionRequest {
                host: RuntimeHostContext::default(),
                session: session.clone(),
                turn: AgentTurn {
                    turn_id: turn_id.to_string(),
                    session_id: session.session_id.clone(),
                    thread_id: session.thread_id.clone(),
                    status: AgentTurnStatus::Accepted,
                    started_at: None,
                    completed_at: None,
                },
                forked_from_thread_id: None,
                is_root_agent: false,
                input: agent_runtime::reply_input::RuntimeReplyInput::text(
                    lime_agent::SUMMARIZATION_PROMPT,
                ),
                runtime_options: Some(options),
                expected_output: None,
                structured_output: None,
                output_schema: None,
                event_name: None,
                queued_turn_id: None,
                queue_if_busy: false,
                skip_pre_submit_resume: false,
                agent_control_gateway: None,
                command_publisher: None,
                rollout_budget_reminder_source: None,
                mid_turn_compaction_commit: None,
                internal_agent_policy: None,
            },
            history,
        ))
    }

    fn create_compaction_turn(
        &self,
        session_id: &str,
        thread_id: &str,
        turn_id: &str,
    ) -> Result<(), RuntimeCoreError> {
        let mut state = self
            .state
            .lock()
            .expect("runtime core state mutex poisoned");
        let stored = state
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| RuntimeCoreError::SessionNotFound(session_id.to_string()))?;
        if stored.session.thread_id != thread_id {
            return Err(RuntimeCoreError::InvalidRequest(
                "session/thread identity mismatch for context compaction".to_string(),
            ));
        }
        if stored
            .turns
            .iter()
            .any(|turn| agent_turn_is_active(turn.status))
        {
            return Err(RuntimeCoreError::InvalidRequest(
                "session actor and runtime turn state disagree for context compaction".to_string(),
            ));
        }
        let now = crate::runtime::timestamp();
        stored.session.status = AgentSessionStatus::Running;
        stored.session.updated_at = now.clone();
        stored.turns.push(AgentTurn {
            turn_id: turn_id.to_string(),
            session_id: session_id.to_string(),
            thread_id: thread_id.to_string(),
            status: AgentTurnStatus::Accepted,
            started_at: Some(now),
            completed_at: None,
        });
        Ok(())
    }
}
