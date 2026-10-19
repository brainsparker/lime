use super::*;
use agent_runtime::session_loop::RuntimeSessionInputHandle;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

struct InputBackend {
    started: mpsc::UnboundedSender<RuntimeSessionInputHandle>,
}

#[async_trait]
impl ExecutionBackend for InputBackend {
    async fn start_turn(
        &self,
        _request: ExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        panic!("fixture requires the real session input handle")
    }

    async fn start_turn_with_provider_history_and_session_input(
        &self,
        _request: ExecutionRequest,
        _history: ProviderTurnHistory,
        input: Option<RuntimeSessionInputHandle>,
        cancellation: Option<CancellationToken>,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        self.started.send(input.expect("session input")).unwrap();
        cancellation.expect("task cancellation").cancelled().await;
        Ok(())
    }

    async fn cancel_turn(
        &self,
        _request: CancelExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }

    async fn respond_action(
        &self,
        _request: ActionRespondRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
}

fn turn_params(text: &str) -> AgentSessionTurnStartParams {
    AgentSessionTurnStartParams {
        session_id: "admission-session".to_string(),
        turn_id: None,
        input: AgentInput {
            text: text.to_string(),
            attachments: Vec::new(),
        },
        runtime_options: None,
        queue_if_busy: false,
        skip_pre_submit_resume: false,
    }
}

async fn fixture() -> (
    tempfile::TempDir,
    RuntimeCore,
    Arc<EventLogWriter>,
    RuntimeSessionInputHandle,
    String,
) {
    let temp = tempfile::tempdir().unwrap();
    let writer = Arc::new(EventLogWriter::new(temp.path().join("events")).unwrap());
    let (started, mut receiver) = mpsc::unbounded_channel();
    let core = RuntimeCore::with_backend(Arc::new(InputBackend { started }))
        .with_event_log_writer(writer.clone());
    core.start_session(AgentSessionStartParams {
        session_id: Some("admission-session".to_string()),
        thread_id: Some("admission-thread".to_string()),
        app_id: "test".to_string(),
        workspace_id: None,
        business_object_ref: None,
        locale: None,
    })
    .unwrap();
    let turn = core
        .start_turn_admitted(turn_params("initial"), RuntimeHostContext::default())
        .await
        .unwrap()
        .response
        .turn;
    let input = timeout(Duration::from_secs(3), receiver.recv())
        .await
        .expect("backend must start")
        .expect("backend input handle");
    (temp, core, writer, input, turn.turn_id)
}

async fn cancel(core: &RuntimeCore, turn_id: String) {
    core.cancel_turn(
        AgentSessionTurnCancelParams {
            session_id: "admission-session".to_string(),
            turn_id,
        },
        RuntimeHostContext::default(),
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn steer_append_failure_never_exposes_uncommitted_input_to_the_running_turn() {
    assert_failed_commit_is_not_delivered(false).await;
}

#[tokio::test]
async fn active_start_append_failure_never_exposes_uncommitted_input_to_the_running_turn() {
    assert_failed_commit_is_not_delivered(true).await;
}

async fn assert_failed_commit_is_not_delivered(active_start: bool) {
    let (temp, core, writer, input, turn_id) = fixture().await;
    let before = writer.read_session_events("admission-session").unwrap();
    let sessions = temp.path().join("events/sessions");
    let saved = temp.path().join("saved-sessions");
    std::fs::rename(&sessions, &saved).unwrap();
    std::fs::write(
        &sessions,
        "block durable append without changing process permissions",
    )
    .unwrap();
    let result = if active_start {
        core.start_turn(turn_params("uncommitted"), RuntimeHostContext::default())
            .await
            .map(|_| ())
    } else {
        core.steer_turn(
            "admission-thread",
            &turn_id,
            vec![agent_protocol::AgentInput::text("uncommitted")],
            Some("failed-input".to_string()),
        )
        .await
        .map(|_| ())
    };
    std::fs::rename(&sessions, temp.path().join("blocked-sessions")).unwrap();
    std::fs::rename(&saved, &sessions).unwrap();
    let pending = input.try_take_pending_input(false).await.unwrap();
    let after = writer.read_session_events("admission-session").unwrap();
    cancel(&core, turn_id).await;
    assert!(
        matches!(result, Err(RuntimeCoreError::Backend(_))),
        "{result:?}"
    );
    assert_eq!(after, before);
    assert!(
        pending.is_empty(),
        "failed durable commit leaked input: {pending:?}"
    );
}

#[tokio::test]
async fn independent_equal_steers_preserve_each_durable_identity_and_delivery() {
    let (_temp, core, writer, input, turn_id) = fixture().await;
    for client_id in ["first-client", "second-client"] {
        let output = core
            .steer_turn(
                "admission-thread",
                &turn_id,
                vec![agent_protocol::AgentInput::text("equal text")],
                Some(client_id.to_string()),
            )
            .await
            .unwrap();
        assert_eq!(output.response, turn_id);
        assert!(output
            .events
            .iter()
            .all(|event| event.turn_id.as_deref() == Some(&turn_id)));
        assert!(output
            .events
            .iter()
            .any(|event| event.payload["clientId"] == client_id));
    }
    let pending = input.try_take_pending_input(false).await.unwrap();
    assert_eq!(pending.len(), 2);
    for item in pending {
        let agent_runtime::session_loop::RuntimeSessionInput::User(item) = item else {
            panic!("expected a user input");
        };
        assert_eq!(item.concat_text(), "equal text");
    }
    let records = writer.read_session_events("admission-session").unwrap();
    let identities = records
        .iter()
        .filter(|record| record.event.event_type == "message.created")
        .filter_map(|record| record.event.payload.get("clientId"))
        .collect::<Vec<_>>();
    assert_eq!(
        identities,
        vec![&json!("first-client"), &json!("second-client")]
    );
    cancel(&core, turn_id).await;
}
