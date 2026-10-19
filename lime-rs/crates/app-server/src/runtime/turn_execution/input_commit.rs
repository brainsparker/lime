use super::*;
use agent_runtime::session_loop::RuntimeSessionInputCommit;

impl RuntimeCore {
    /// Adds user input to the expected active regular turn without creating a
    /// replacement turn. The session loop owns the atomic active-turn check.
    pub async fn steer_turn(
        &self,
        thread_id: &str,
        expected_turn_id: &str,
        input: Vec<agent_protocol::AgentInput>,
        client_user_message_id: Option<String>,
    ) -> Result<RuntimeCoreOutput<String>, RuntimeCoreError> {
        let thread_id = thread_id.trim();
        let expected_turn_id = expected_turn_id.trim();
        if thread_id.is_empty() {
            return Err(RuntimeCoreError::InvalidRequest(
                "turn/steer requires threadId".to_string(),
            ));
        }
        if expected_turn_id.is_empty() {
            return Err(RuntimeCoreError::InvalidRequest(
                "turn/steer requires expectedTurnId".to_string(),
            ));
        }
        validate_user_input(&input).map_err(RuntimeCoreError::InvalidRequest)?;

        let session = {
            let state = self
                .state
                .lock()
                .expect("runtime core state mutex poisoned");
            let stored = state
                .sessions
                .values()
                .find(|stored| stored.session.thread_id == thread_id)
                .ok_or_else(|| RuntimeCoreError::SessionNotFound(thread_id.to_string()))?;
            let active_turn = stored
                .turns
                .iter()
                .find(|turn| agent_turn_is_active(turn.status))
                .ok_or_else(|| {
                    RuntimeCoreError::InvalidRequest("no active turn to steer".to_string())
                })?;
            if active_turn.turn_id != expected_turn_id {
                return Err(RuntimeCoreError::InvalidRequest(format!(
                    "expected active turn id `{expected_turn_id}` but found `{}`",
                    active_turn.turn_id
                )));
            }
            stored.session.clone()
        };

        let prepared_input = super::input_media::prepare_runtime_input(
            input,
            self.sidecar_store.as_deref(),
            &session.session_id,
        )
        .map_err(RuntimeCoreError::Backend)?;
        let session_loop = self
            .session_loop_for_input(&session.session_id, &session.thread_id)
            .await?;
        let commit = SteerCommit::new(
            self.clone(),
            session.clone(),
            steer_input_event_payload(
                "turn/steer",
                prepared_input.durable,
                client_user_message_id.as_deref(),
            ),
        );
        let active_turn_id = session_loop
            .steer_for_turn_id_with_metadata(
                Some(expected_turn_id),
                vec![RuntimeSessionInput::User(prepared_input.provider)],
                client_user_message_id,
                None,
                Some(commit.handler.clone()),
            )
            .await
            .map_err(|error| steer_runtime_error(error, expected_turn_id))?;
        let events = commit.take_events()?;

        Ok(RuntimeCoreOutput {
            response: active_turn_id,
            events,
        })
    }

    pub(super) async fn steer_existing_actor_turn(
        &self,
        params: &TurnStartRequest,
        mut event_callback: Option<&mut RuntimeEventCallback<'_>>,
    ) -> Result<Option<RuntimeCoreOutput<AgentSessionTurnStartResponse>>, RuntimeCoreError> {
        if params.queue_if_busy {
            return Ok(None);
        }
        let session = {
            let state = self
                .state
                .lock()
                .expect("runtime core state mutex poisoned");
            let Some(stored) = state.sessions.get(&params.session_id) else {
                return Err(RuntimeCoreError::SessionNotFound(params.session_id.clone()));
            };
            stored.session.clone()
        };

        let prepared_input = super::input_media::prepare_runtime_input(
            params.input.clone(),
            self.sidecar_store.as_deref(),
            &params.session_id,
        )
        .map_err(RuntimeCoreError::Backend)?;
        let (client_user_message_id, trace) = super::session_submission::metadata(
            params
                .runtime_options
                .as_ref()
                .and_then(RuntimeOptions::runtime_metadata),
        );
        let Some(session_loop) = self.session_loops.get_existing(&session.session_id).await else {
            return Ok(None);
        };
        let requested_turn_id = params.turn_id.as_deref().filter(|id| !id.trim().is_empty());
        let commit = SteerCommit::new(
            self.clone(),
            session.clone(),
            steer_input_event_payload(
                "session_steer",
                prepared_input.durable,
                client_user_message_id.as_deref(),
            ),
        );
        let active_turn_id = match session_loop
            .steer_for_turn_id_with_metadata(
                requested_turn_id,
                vec![RuntimeSessionInput::User(prepared_input.provider)],
                client_user_message_id.clone(),
                trace,
                Some(commit.handler.clone()),
            )
            .await
        {
            Ok(active_turn_id) => active_turn_id,
            Err(RuntimeSessionLoopError::InvalidTask(_)) => return Ok(None),
            Err(RuntimeSessionLoopError::Closed) => {
                return Err(RuntimeCoreError::Backend(
                    "runtime session submission loop is closed".to_string(),
                ));
            }
            Err(RuntimeSessionLoopError::OperationFailed(message)) => {
                return Err(RuntimeCoreError::Backend(message));
            }
        };
        let turn = {
            let state = self
                .state
                .lock()
                .expect("runtime core state mutex poisoned");
            let Some(turn) = state
                .sessions
                .get(&session.session_id)
                .and_then(|stored| {
                    stored
                        .turns
                        .iter()
                        .find(|turn| turn.turn_id == active_turn_id)
                })
                .cloned()
            else {
                return Err(RuntimeCoreError::Backend(
                    "session actor committed steer without a canonical turn".to_string(),
                ));
            };
            turn
        };
        let events = commit.take_events()?;
        if let Some(callback) = event_callback.as_deref_mut() {
            for event in events.iter().cloned() {
                callback(event)?;
            }
        }
        Ok(Some(RuntimeCoreOutput {
            response: AgentSessionTurnStartResponse { turn },
            events,
        }))
    }
}

fn steer_input_event_payload(
    source: &str,
    input: Vec<agent_protocol::AgentInput>,
    client_user_message_id: Option<&str>,
) -> Value {
    let input_text = user_input_text(&input);
    let explicit_item_id = client_user_message_id
        .map(|client_id| format!("steer-{client_id}"))
        .unwrap_or_else(|| format!("steer-{}", Uuid::new_v4()));
    let mut payload = json!({
        "itemId": explicit_item_id,
        "role": "user",
        "visibility": "user_visible",
        "source": source,
        "input": input,
        "content": {
            "kind": "inline_text",
            "text": input_text,
        },
    });
    if let Some(client_id) = client_user_message_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        payload["clientId"] = Value::String(client_id.to_string());
    }
    payload
}

fn steer_runtime_error(error: RuntimeSessionLoopError, expected_turn_id: &str) -> RuntimeCoreError {
    match error {
        RuntimeSessionLoopError::InvalidTask(message)
            if message.contains("does not accept steer input") =>
        {
            RuntimeCoreError::InvalidRequest(format!(
                "turn {expected_turn_id} does not accept steering"
            ))
        }
        RuntimeSessionLoopError::InvalidTask(message) if message.contains("has no active turn") => {
            RuntimeCoreError::InvalidRequest("no active turn to steer".to_string())
        }
        RuntimeSessionLoopError::InvalidTask(message)
            if message.contains("no longer active") || message.contains("already finishing") =>
        {
            RuntimeCoreError::InvalidRequest(format!(
                "expected active turn id `{expected_turn_id}` is no longer active"
            ))
        }
        RuntimeSessionLoopError::InvalidTask(message) => RuntimeCoreError::InvalidRequest(message),
        RuntimeSessionLoopError::Closed => {
            RuntimeCoreError::Backend("runtime session submission loop is closed".to_string())
        }
        RuntimeSessionLoopError::OperationFailed(message) => RuntimeCoreError::Backend(message),
    }
}

struct SteerCommit {
    handler: RuntimeSessionInputCommit,
    events: Arc<Mutex<Option<Vec<AgentEvent>>>>,
}

impl SteerCommit {
    fn new(runtime: RuntimeCore, session: AgentSession, payload: Value) -> Self {
        let events = Arc::new(Mutex::new(None));
        let receipt = events.clone();
        let handler = RuntimeSessionInputCommit::new(move |turn_id| {
            let committed = runtime
                .append_runtime_events(
                    &session.session_id,
                    &session.thread_id,
                    Some(turn_id),
                    vec![RuntimeEvent::new(
                        super::super::turn_input_events::TURN_INPUT_EVENT_TYPE,
                        payload.clone(),
                    )],
                )
                .map_err(|error| error.to_string())?;
            if committed.is_empty() {
                return Err("cannot deliver steer to a terminal canonical turn".to_string());
            }
            *receipt.lock().expect("steer receipt mutex poisoned") = Some(committed);
            Ok(())
        });
        Self { handler, events }
    }

    fn take_events(&self) -> Result<Vec<AgentEvent>, RuntimeCoreError> {
        self.events
            .lock()
            .expect("steer receipt mutex poisoned")
            .take()
            .ok_or_else(|| {
                RuntimeCoreError::Backend(
                    "actor accepted steer without a durable input receipt".to_string(),
                )
            })
    }
}

#[cfg(test)]
#[path = "input_commit/tests.rs"]
mod tests;
