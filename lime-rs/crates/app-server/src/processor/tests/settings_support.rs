use super::super::*;
use super::tests_support::initialize_processor;
use crate::{
    ActionRespondRequest, CancelExecutionRequest, ExecutionBackend, ExecutionRequest,
    ProjectionStore, RuntimeCore, RuntimeCoreError, RuntimeEvent, RuntimeEventSink,
};
use app_server_protocol::protocol::v2::ThreadSettings;
use app_server_protocol::{AgentSessionStartParams, BusinessObjectRef, RuntimeRequest};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tokio::time::{timeout, Duration};

#[derive(Default)]
pub(super) struct SettingsBackend {
    pub(super) requests: Mutex<Vec<RuntimeRequest>>,
    pub(super) settings: Mutex<Vec<ThreadSettings>>,
}

#[async_trait::async_trait]
impl ExecutionBackend for SettingsBackend {
    async fn preflight_thread_settings(
        &self,
        _: &app_server_protocol::AgentSession,
        settings: &ThreadSettings,
    ) -> Result<(), RuntimeCoreError> {
        self.settings.lock().unwrap().push(settings.clone());
        if settings.service_tier.as_deref() == Some("unsupported") {
            return Err(RuntimeCoreError::InvalidRequest("unsupported tier".into()));
        }
        Ok(())
    }

    async fn start_turn(
        &self,
        request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        self.requests.lock().unwrap().push(
            request
                .runtime_options
                .and_then(|options| options.runtime_request)
                .unwrap_or_default(),
        );
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        sink.emit(RuntimeEvent::new("turn.completed", json!({})))
    }

    async fn cancel_turn(
        &self,
        _: CancelExecutionRequest,
        _: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
    async fn respond_action(
        &self,
        _: ActionRespondRequest,
        _: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
}

pub(super) fn core(
    store: Arc<ProjectionStore>,
    backend: Arc<SettingsBackend>,
    config: &std::path::Path,
) -> RuntimeCore {
    RuntimeCore::with_backend(backend)
        .with_projection_store(store)
        .with_event_log_writer(Arc::new(
            crate::EventLogWriter::new(config.parent().unwrap().join("event-log")).unwrap(),
        ))
        .with_app_config_path(config.to_path_buf())
}

pub(super) fn start_session(runtime: &RuntimeCore) {
    runtime
        .start_session(AgentSessionStartParams {
            session_id: Some("settings-session".into()),
            thread_id: Some("settings-thread".into()),
            app_id: "agent-chat".into(),
            workspace_id: None,
            locale: None,
            business_object_ref: Some(BusinessObjectRef {
                kind: "agent.thread".into(),
                id: "settings-thread".into(),
                title: None,
                uri: None,
                metadata: Some(json!({
                    "providerSelector":"fixture", "modelName":"model", "serviceTier":"priority"
                })),
            }),
        })
        .unwrap();
}

pub(super) async fn resume(processor: &RequestProcessor) {
    initialize_processor(processor).await;
    let messages = processor
        .handle_request(JsonRpcRequest::new(
            RequestId::Integer(100),
            "thread/resume",
            Some(json!({"threadId":"settings-thread"})),
        ))
        .await
        .unwrap();
    assert!(
        messages
            .iter()
            .any(|message| matches!(message, JsonRpcMessage::Response(_))),
        "{messages:?}"
    );
}

pub(super) async fn run_turn(
    processor: &RequestProcessor,
    backend: &SettingsBackend,
    patch: Value,
    count: usize,
) -> RuntimeRequest {
    let mut params =
        json!({"threadId":"settings-thread","input":[{"type":"text","text":"continue"}]});
    params
        .as_object_mut()
        .unwrap()
        .extend(patch.as_object().unwrap().clone());
    let messages = processor
        .handle_request(JsonRpcRequest::new(
            RequestId::Integer(count as i64),
            "turn/start",
            Some(params),
        ))
        .await
        .unwrap();
    assert!(
        messages
            .iter()
            .any(|message| matches!(message, JsonRpcMessage::Response(_))),
        "turn/start must succeed: {messages:?}"
    );
    timeout(Duration::from_secs(5), async {
        loop {
            let read = processor
                .runtime
                .read_session(app_server_protocol::AgentSessionReadParams {
                    session_id: "settings-session".into(),
                    history_limit: None,
                    history_offset: None,
                    history_before_message_id: None,
                })
                .unwrap();
            if backend.requests.lock().unwrap().len() == count
                && read.turns.len() == count
                && read.turns.iter().all(|turn| {
                    matches!(turn.status, app_server_protocol::AgentTurnStatus::Completed)
                })
            {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("canonical terminal");
    backend.requests.lock().unwrap().last().unwrap().clone()
}
