use agent_protocol::ItemStatus;
use agent_runtime::model_history::{
    HistoryReceipt, ModelHistoryRecorder, MODEL_HISTORY_EVENT_TYPE,
};
use agent_runtime::provider_turn::*;
use agent_runtime::session_config::SessionConfigBuilder;
use agent_runtime::session_loop::RuntimeSessionInputHandle;
use app_server::*;
use async_trait::async_trait;
use futures::future::BoxFuture;
use model_provider::current_client::*;
use serde_json::json;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use tool_runtime::hook_lifecycle::*;
use tool_runtime::tool_executor::*;
use tool_runtime::tool_lifecycle::*;
use tool_runtime::turn_snapshot::*;

pub struct Observation {
    pub history: Vec<CurrentProviderMessage>,
    pub receipts: Vec<HistoryReceipt>,
}

// Test-only provider/host: actual Stop executor, session actor, recorder and EventLog.
// Does not stand in for RuntimeBackend HTTP or the Electron/CLI host boundary.
pub struct Backend {
    pub writer: Arc<EventLogWriter>,
    pub cwd: PathBuf,
    pub provider: Arc<Provider>,
    pub observed: mpsc::UnboundedSender<Observation>,
}

#[derive(Default)]
pub struct Provider(pub Mutex<Vec<CurrentProviderRequest>>);

impl CurrentProvider for Provider {
    fn stream<'a>(
        &'a self,
        request: CurrentProviderRequest,
    ) -> BoxFuture<'a, Result<CurrentProviderStream, CurrentProviderError>> {
        Box::pin(async move {
            let count = {
                let mut requests = self.0.lock().unwrap();
                requests.push(request);
                requests.len()
            };
            let events = vec![
                Ok(CanonicalLlmEvent::TextDelta {
                    id: format!("answer-{count}"),
                    text: format!("answer-{count}"),
                }),
                Ok(CanonicalLlmEvent::Finish {
                    reason: FinishReason::Stop,
                    needs_follow_up: false,
                    usage: None,
                    response_id: None,
                }),
            ];
            Ok(Box::pin(futures::stream::iter(events)) as CurrentProviderStream)
        })
    }
}

struct StopOnce;

impl RuntimeHookReporter for StopOnce {
    fn report<'a>(
        &'a self,
        _: &'a RuntimeHookSnapshot,
        _: RuntimeHookEventName,
        context: &'a RuntimeHookEventContext,
    ) -> RuntimeHookReportFuture<'a> {
        Box::pin(async move {
            Some(if context.stop.as_ref().unwrap().stop_hook_active {
                RuntimeHookHandlerReport::Allow {
                    additional_context: None,
                }
            } else {
                RuntimeHookHandlerReport::Block {
                    reason: "verify <checks> & retry".into(),
                }
            })
        })
    }
}

struct NoTools;

impl RuntimeToolExecutor for NoTools {
    fn execute<'a>(&'a self, _: RuntimeToolExecutionRequest<'a>) -> RuntimeToolExecutionFuture<'a> {
        panic!("Stop fixture does not call tools")
    }
}

impl ToolLifecycleEmitter for NoTools {
    fn emit<'a>(&'a self, _: ToolLifecycleEvent) -> ToolLifecycleEmissionFuture<'a> {
        panic!("Stop fixture does not emit tool events")
    }
}

#[async_trait]
impl ExecutionBackend for Backend {
    async fn start_turn(
        &self,
        _: ExecutionRequest,
        _: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        panic!("requires current session recorder")
    }

    async fn start_turn_with_provider_history_and_session_input(
        &self,
        request: ExecutionRequest,
        history: ProviderTurnHistory,
        pending_input: Option<RuntimeSessionInputHandle>,
        cancel_token: Option<CancellationToken>,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        let history = history.messages_for_route("fixture", "model");
        let mut messages = history.clone();
        messages.push(CurrentProviderMessage::user(vec![
            CurrentProviderContent::Text(request.input.concat_text()),
        ]));
        let receipts = Arc::new(Mutex::new(Vec::new()));
        let saved = receipts.clone();
        let recorder = sink.model_history_recorder().unwrap();
        let mut config = SessionConfigBuilder::new(&request.session.session_id)
            .thread_id(&request.session.thread_id)
            .turn_id(&request.turn.turn_id)
            .max_turns(4)
            .build();
        config.model_history_recorder = Some(ModelHistoryRecorder::new(move |record| {
            let recorder = recorder.clone();
            let saved = saved.clone();
            Box::pin(async move {
                let receipt = recorder.record(record).await?;
                saved.lock().unwrap().push(receipt.clone());
                Ok(receipt)
            })
        }));
        let hooks = (request.input.concat_text() == "record").then(|| {
            RuntimeHookSnapshotSourceHandle::fixed(RuntimeHookStepSnapshot {
                hooks: vec![RuntimeHookSnapshot {
                    key: "stop".into(),
                    event_name: RuntimeHookEventName::Stop,
                    handler_type: RuntimeHookHandlerType::Command,
                    execution_mode: RuntimeHookExecutionMode::Sync,
                    matcher: None,
                    command: Some("fixture".into()),
                    mcp_server: None,
                    mcp_tool: None,
                    mcp_input: None,
                    timeout_sec: 5,
                    status_message: None,
                    additional_context_limit: None,
                    source_path: self.cwd.join("hooks.json"),
                    source: RuntimeHookSource::System,
                    plugin_id: None,
                    display_order: 0,
                    enabled: true,
                    is_managed: true,
                    current_hash: "sha256:test".into(),
                    trust_status: RuntimeHookTrustStatus::Trusted,
                }],
                step_context: None,
                reporter: Arc::new(StopOnce),
            })
        });
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        let mut text = HashMap::<String, String>::new();
        let mut error = None;
        run_current_provider_turn(
            CurrentProviderTurnInput {
                provider: self.provider.clone(),
                provider_trace_metadata: None,
                session_config: config,
                initial_messages: messages,
                tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                    RuntimeToolStepSnapshot::new(
                        vec![],
                        RuntimeToolExecutorHandle::new(Arc::new(NoTools)),
                    ),
                ),
                hook_snapshot_source: hooks,
                model_request_policy: None,
                tool_lifecycle_emitter: Arc::new(NoTools),
                working_directory: self.cwd.clone(),
                cancel_token,
                pending_input,
                mid_turn_compaction: None,
            },
            |event| {
                let events = match event {
                    CurrentProviderTurnEvent::HookPrompt { item } => {
                        let persisted = self
                            .writer
                            .read_session_events(&request.session.session_id)
                            .unwrap();
                        assert!(
                            persisted
                                .iter()
                                .any(|entry| entry.event.event_type == MODEL_HISTORY_EVENT_TYPE
                                    && entry.event.payload["metadata"]["sourceItemId"]
                                        == item.item_id.as_str()),
                            "receipt must be durable before Item lifecycle"
                        );
                        let mut started = item.clone();
                        started.status = ItemStatus::InProgress;
                        vec![
                            RuntimeEvent::new("item.started", json!({"item":started})),
                            RuntimeEvent::new("item.completed", json!({"item":item})),
                        ]
                    }
                    CurrentProviderTurnEvent::TextDelta {
                        item_id,
                        text: delta,
                    } => {
                        text.entry(item_id.clone()).or_default().push_str(&delta);
                        vec![RuntimeEvent::new(
                            "message.delta",
                            json!({"itemId":item_id,"text":delta}),
                        )]
                    }
                    CurrentProviderTurnEvent::TextEnd { item_id, phase } => {
                        let content = text.remove(&item_id).unwrap_or_default();
                        vec![RuntimeEvent::new(
                            "message.completed",
                            json!({"itemId":item_id,"text":content,"phase":phase}),
                        )]
                    }
                    _ => vec![],
                };
                for event in events {
                    if let Err(failed) = sink.emit(event) {
                        error = Some(failed);
                        break;
                    }
                }
            },
        )
        .await
        .map_err(|error| RuntimeCoreError::Backend(error.message))?;
        if let Some(error) = error {
            return Err(error);
        }
        self.observed
            .send(Observation {
                history,
                receipts: receipts.lock().unwrap().clone(),
            })
            .unwrap();
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
