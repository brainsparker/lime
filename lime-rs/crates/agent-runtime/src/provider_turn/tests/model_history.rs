use super::*;
use crate::model_history::{HistoryReceipt, ModelHistoryRecorder};

async fn failing_history_append(fail_at: usize) {
    let provider = Arc::new(ScriptedProvider::new(vec![vec![
        Ok(CanonicalLlmEvent::ToolCall {
            id: "history-call".to_string(),
            name: "Read".to_string(),
            input: serde_json::json!({"path":"README.md"}),
            raw_arguments: Some("{ \"path\": \"README.md\" }".to_string()),
            provider_executed: None,
            provider_metadata: Default::default(),
        }),
        Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::ToolCall,
            usage: None,
            needs_follow_up: false,
            response_id: None,
        }),
    ]]));
    let tool = Arc::new(CountingTool::default());
    let writes = Arc::new(AtomicUsize::new(0));
    let recorded = writes.clone();
    let mut config = crate::session_config::SessionConfigBuilder::new("session-1")
        .thread_id("thread-1")
        .turn_id("turn-1")
        .build();
    config.model_history_recorder = Some(ModelHistoryRecorder::new(move |record| {
        let index = recorded.fetch_add(1, Ordering::SeqCst);
        Box::pin(async move {
            let message = record.into_message()?;
            if index == 0 {
                assert!(
                    matches!(&message.content[0], CurrentProviderContent::ToolCall(call)
                    if call.raw_arguments == "{ \"path\": \"README.md\" }")
                );
            }
            if index == fail_at {
                Err("durable history append rejected".to_string())
            } else {
                HistoryReceipt::new(format!("history-{index}"), index as u64 + 1)
            }
        })
    }));
    let error = run_current_provider_turn(
        CurrentProviderTurnInput {
            provider: provider.clone(),
            provider_trace_metadata: None,
            session_config: config,
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("read".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    vec![RuntimeToolDefinition::new(
                        "Read",
                        "read files",
                        serde_json::json!({"type":"object"}),
                    )],
                    RuntimeToolExecutorHandle::new(tool.clone()),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
        },
        |_| {},
    )
    .await
    .expect_err("failed history write must stop the loop");
    assert_eq!(error.message, "durable history append rejected");
    assert_eq!(
        provider.requests.lock().unwrap().len(),
        1,
        "must not sample again"
    );
    assert_eq!(
        tool.calls.load(Ordering::SeqCst),
        fail_at,
        "call must persist before execution"
    );
    assert_eq!(writes.load(Ordering::SeqCst), fail_at + 1);
}

#[tokio::test]
async fn call_append_failure_prevents_tool_execution() {
    failing_history_append(0).await;
}

#[tokio::test]
async fn output_append_failure_prevents_continuation_sampling() {
    failing_history_append(1).await;
}

#[tokio::test]
async fn committed_native_item_without_deltas_prevents_provider_reroute() {
    for transport in [false, true] {
        let failure = if transport {
            Err(CurrentProviderError {
                message: "failure after native commit".to_string(),
                status: None,
                classification: Some(FailureClassification::Transport),
                retryable: true,
                retry_after: None,
            })
        } else {
            Ok(CanonicalLlmEvent::ProviderError {
                message: "failure after native commit".to_string(),
                classification: Some(FailureClassification::ProviderInternal),
                retryable: Some(true),
            })
        };
        let provider = Arc::new(ScriptedProvider::new(vec![vec![
            Ok(CanonicalLlmEvent::ResponseItemDone {
                source_id: "reasoning-rs_commit".to_string(),
                item: serde_json::json!({"type":"reasoning","id":"rs_commit",
                    "summary":[],"encrypted_content":"fixture-only"}),
                producer: Some("fixture-producer".to_string()),
            }),
            failure,
        ]]));
        let writes = Arc::new(AtomicUsize::new(0));
        let recorded = writes.clone();
        let mut config = crate::session_config::SessionConfigBuilder::new("session-1")
            .turn_id("turn-1")
            .build();
        config.model_history_recorder = Some(ModelHistoryRecorder::new(move |record| {
            recorded.fetch_add(1, Ordering::SeqCst);
            Box::pin(async move {
                assert!(record.metadata.source_item_id.is_some());
                record.into_message()?;
                HistoryReceipt::new("completed-record", 1)
            })
        }));
        let error = run_current_provider_turn(
            CurrentProviderTurnInput {
                provider: provider.clone(),
                provider_trace_metadata: None,
                session_config: config,
                initial_messages: vec![CurrentProviderMessage::user(vec![
                    CurrentProviderContent::Text("start".to_string()),
                ])],
                tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                    RuntimeToolStepSnapshot::new(
                        Vec::new(),
                        RuntimeToolExecutorHandle::new(Arc::new(CountingTool::default())),
                    ),
                ),
                hook_snapshot_source: None,
                model_request_policy: None,
                tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
                working_directory: PathBuf::from("."),
                cancel_token: None,
                pending_input: None,
            },
            |_| {},
        )
        .await
        .unwrap_err();
        assert_eq!(writes.load(Ordering::SeqCst), 1);
        assert_eq!(provider.requests.lock().unwrap().len(), 1);
        assert_eq!(error.message, "failure after native commit");
        assert!(
            error.emitted_any,
            "durably completed native item is emitted output, transport={transport}"
        );
        assert!(!error.is_reroutable_provider_failure());
    }
}
