use super::*;
use app_server_protocol::AgentInput;
use async_trait::async_trait;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};

#[derive(Default)]
struct DrainingBackend {
    drain_started: Notify,
    release_drain: Notify,
}

#[async_trait]
impl ExecutionBackend for DrainingBackend {
    async fn start_turn(
        &self,
        _request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        sink.emit(RuntimeEvent::new("turn.started", json!({})))
    }

    async fn drain_turn(&self, _request: &CancelExecutionRequest) -> Result<(), RuntimeCoreError> {
        self.drain_started.notify_one();
        self.release_drain.notified().await;
        Ok(())
    }

    async fn cancel_turn(
        &self,
        _request: CancelExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        std::future::pending().await
    }

    async fn respond_action(
        &self,
        _request: ActionRespondRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
}

#[tokio::test]
async fn interrupt_waits_for_owned_drain_but_not_backend_cancel() {
    let backend = Arc::new(DrainingBackend::default());
    let core = Arc::new(RuntimeCore::with_backend(backend.clone()));
    let session = core
        .start_session(AgentSessionStartParams {
            session_id: Some("sess_owned_drain".to_string()),
            thread_id: Some("thread_owned_drain".to_string()),
            app_id: "agent-chat".to_string(),
            workspace_id: None,
            business_object_ref: None,
            locale: None,
        })
        .expect("session")
        .session;
    let turn = core
        .start_turn(
            AgentSessionTurnStartParams {
                session_id: session.session_id.clone(),
                turn_id: Some("turn_owned_drain".to_string()),
                input: AgentInput {
                    text: "wait for local cleanup".to_string(),
                    attachments: Vec::new(),
                },
                runtime_options: None,
                queue_if_busy: false,
                skip_pre_submit_resume: false,
            },
            RuntimeHostContext::default(),
        )
        .await
        .expect("turn")
        .response
        .turn;
    let interrupt_core = core.clone();
    let session_id = session.session_id.clone();
    let turn_id = turn.turn_id.clone();
    let interrupt = tokio::spawn(async move {
        interrupt_core
            .cancel_turn(
                AgentSessionTurnCancelParams {
                    session_id,
                    turn_id,
                },
                RuntimeHostContext::default(),
            )
            .await
    });
    timeout(Duration::from_secs(3), backend.drain_started.notified())
        .await
        .expect("owned drain must start");
    assert!(!interrupt.is_finished());
    assert!(!core
        .events_for_session(&session.session_id)
        .expect("events before drain")
        .iter()
        .any(|event| event.event_type == "turn.canceled"));

    backend.release_drain.notify_one();
    let output = timeout(Duration::from_secs(3), interrupt)
        .await
        .expect("interrupt must not wait for backend cancel")
        .expect("interrupt task")
        .expect("interrupt");
    assert_eq!(output.events.len(), 1);
    assert_eq!(output.events[0].event_type, "turn.canceled");
    assert_eq!(output.events[0].session_id, session.session_id);
    assert_eq!(
        output.events[0].turn_id.as_deref(),
        Some(turn.turn_id.as_str())
    );
    assert_eq!(output.events[0].payload["turn"]["status"], "interrupted");
}
