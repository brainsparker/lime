use super::*;

#[derive(Default)]
pub(super) struct HistoryCaptureBackend {
    pub(super) calls: AtomicUsize,
    pub(super) histories: Mutex<Vec<Vec<CurrentProviderMessage>>>,
    pub(super) sessions: Mutex<Vec<app_server_protocol::AgentSession>>,
    pub(super) origins: Mutex<Vec<(Option<String>, bool)>>,
    pub(super) requests: Mutex<Vec<app_server_protocol::RuntimeRequest>>,
}

#[async_trait]
impl ExecutionBackend for HistoryCaptureBackend {
    async fn start_turn(
        &self,
        request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        self.start_turn_with_provider_history(request, ProviderTurnHistory::default(), sink)
            .await
    }

    async fn start_turn_with_provider_history(
        &self,
        request: ExecutionRequest,
        provider_history: ProviderTurnHistory,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        let call = self.calls.fetch_add(1, Ordering::SeqCst);
        self.sessions.lock().unwrap().push(request.session.clone());
        self.requests
            .lock()
            .unwrap()
            .push(request.runtime_request().cloned().unwrap_or_default());
        self.origins
            .lock()
            .unwrap()
            .push((request.forked_from_thread_id.clone(), request.is_root_agent));
        self.histories
            .lock()
            .expect("fork history capture mutex poisoned")
            .push(provider_history.messages_for_route("fixture-provider", "fixture-model"));
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        if call == 0 {
            sink.emit(RuntimeEvent::new(
                "item.started",
                canonical_tool_payload(&request, ItemStatus::InProgress, None),
            ))?;
            sink.emit(RuntimeEvent::new(
                "item.completed",
                canonical_tool_payload(
                    &request,
                    ItemStatus::Completed,
                    Some(ToolOutput {
                        text: Some("source tool output".to_string()),
                        ..ToolOutput::default()
                    }),
                ),
            ))?;
            sink.emit(RuntimeEvent::new(
                "message.delta",
                json!({"itemId": "source-answer", "text": "source assistant answer"}),
            ))?;
            sink.emit(RuntimeEvent::new(
                "message.completed",
                json!({
                    "itemId": "source-answer",
                    "phase": "final_answer",
                    "status": "completed",
                    "text": "source assistant answer"
                }),
            ))?;
        }
        sink.emit(RuntimeEvent::new("turn.completed", json!({})))
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

fn canonical_tool_payload(
    request: &ExecutionRequest,
    status: ItemStatus,
    output: Option<ToolOutput>,
) -> Value {
    let mut item = ThreadItem::new(
        SessionId::new(request.session.session_id.clone()),
        ThreadId::new(request.session.thread_id.clone()),
        TurnId::new(request.turn.turn_id.clone()),
        1,
        1,
        ThreadItemPayload::Tool {
            call_id: "source-tool-call".to_string(),
            name: "read_file".to_string(),
            arguments: vec![ToolArgument {
                name: "path".to_string(),
                value: "\"README.md\"".to_string(),
            }],
            output,
        },
    );
    item.item_id = ItemId::new("source-tool-item");
    item.status = status;
    json!({"item": item})
}
