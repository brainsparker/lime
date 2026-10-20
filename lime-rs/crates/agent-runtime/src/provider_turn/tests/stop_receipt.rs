use super::*;
use crate::model_history::{HistoryReceipt, ModelHistoryRecorder};
use tool_runtime::hook_gated_executor::FixedHookReporter;
use tool_runtime::hook_lifecycle::{
    RuntimeHookEventContext, RuntimeHookHandlerReport, RuntimeHookReportFuture,
};
use tool_runtime::turn_snapshot::{
    RuntimeHookEventName, RuntimeHookExecutionMode, RuntimeHookHandlerType, RuntimeHookSource,
    RuntimeHookTrustStatus,
};

struct StopOnce;

#[test]
fn invalid_fragment_identity_rejects_the_entire_prompt() {
    let fragments = vec![
        HookPromptFragment {
            text: "valid".into(),
            hook_run_id: "run:1".into(),
        },
        HookPromptFragment {
            text: "must not disappear".into(),
            hook_run_id: "  ".into(),
        },
    ];
    assert!(hook_prompt_provider_message(&fragments).is_none());
}

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

fn turn(provider: Arc<ScriptedProvider>) -> CurrentProviderTurnInput {
    CurrentProviderTurnInput {
        provider,
        provider_trace_metadata: None,
        session_config: crate::session_config::SessionConfigBuilder::new("stop-session")
            .thread_id("stop-thread")
            .turn_id("stop-turn")
            .max_turns(4)
            .build(),
        initial_messages: vec![CurrentProviderMessage::user(vec![
            CurrentProviderContent::Text("work".into()),
        ])],
        tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
            RuntimeToolStepSnapshot::new(
                Vec::new(),
                RuntimeToolExecutorHandle::new(Arc::new(EchoTool)),
            ),
        ),
        hook_snapshot_source: Some(RuntimeHookSnapshotSourceHandle::fixed(
            RuntimeHookStepSnapshot {
                hooks: vec![RuntimeHookSnapshot {
                    key: "stop".into(),
                    event_name: RuntimeHookEventName::Stop,
                    handler_type: RuntimeHookHandlerType::Command,
                    execution_mode: RuntimeHookExecutionMode::Sync,
                    matcher: None,
                    command: Some("fixture".into()),
                    timeout_sec: 5,
                    status_message: None,
                    additional_context_limit: None,
                    source_path: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("hooks.json"),
                    source: RuntimeHookSource::System,
                    plugin_id: None,
                    display_order: 0,
                    enabled: true,
                    is_managed: true,
                    current_hash: "sha256:test".into(),
                    trust_status: RuntimeHookTrustStatus::Trusted,
                }],
                reporter: Arc::new(StopOnce),
            },
        )),
        model_request_policy: None,
        tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
        working_directory: PathBuf::from(env!("CARGO_MANIFEST_DIR")),
        cancel_token: None,
        pending_input: None,
        mid_turn_compaction: None,
    }
}

fn provider() -> Arc<ScriptedProvider> {
    Arc::new(ScriptedProvider::new(
        ["first", "final"]
            .map(|text| {
                vec![
                    Ok(CanonicalLlmEvent::TextDelta {
                        id: "answer".into(),
                        text: text.into(),
                    }),
                    Ok(CanonicalLlmEvent::Finish {
                        reason: FinishReason::Stop,
                        needs_follow_up: false,
                        usage: None,
                        response_id: None,
                    }),
                ]
            })
            .into(),
    ))
}

#[tokio::test]
async fn hook_prompt_waits_for_history_receipt_before_item_and_sampling() {
    let provider = provider();
    let mut input = turn(provider.clone());
    let (recorded, mut records) = tokio::sync::mpsc::unbounded_channel();
    input.session_config.model_history_recorder = Some(ModelHistoryRecorder::new(move |record| {
        let (ack, pending) = oneshot::channel();
        recorded.send((record, ack)).unwrap();
        Box::pin(async move { pending.await.unwrap() })
    }));
    let events = Arc::new(Mutex::new(Vec::new()));
    let observed = events.clone();
    let task = tokio::spawn(run_current_provider_turn(input, move |event| {
        observed.lock().unwrap().push(event)
    }));
    let (record, ack) = tokio::time::timeout(Duration::from_secs(3), records.recv())
        .await
        .expect("Stop continuation never requested a durable history receipt")
        .expect("Stop continuation dropped the history recorder");
    assert!(
        !task.is_finished(),
        "history enqueue cannot authorize continuation"
    );
    assert_eq!(provider.requests.lock().unwrap().len(), 1);
    assert!(!events
        .lock()
        .unwrap()
        .iter()
        .any(|event| matches!(event, CurrentProviderTurnEvent::HookPrompt { .. })));
    ack.send(Ok(HistoryReceipt::new("hook-history-event", 41).unwrap()))
        .unwrap();
    let result = task.await.unwrap().unwrap();
    assert!(!result.cancelled);
    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(record.message.role, CurrentProviderRole::User);
    assert_eq!(requests[1].messages.last(), Some(&record.message));
    let events = events.lock().unwrap();
    let prompts = events
        .iter()
        .filter_map(|event| match event {
            CurrentProviderTurnEvent::HookPrompt { item } => Some(item),
            _ => None,
        })
        .collect::<Vec<_>>();
    assert_eq!(prompts.len(), 1);
    assert_eq!(
        record.metadata.source_item_id.as_deref(),
        Some(prompts[0].item_id.as_str())
    );
}

#[tokio::test]
async fn rejected_or_missing_hook_prompt_receipt_cannot_resample_or_publish() {
    for missing in [false, true] {
        let provider = provider();
        let mut input = turn(provider.clone());
        if !missing {
            input.session_config.model_history_recorder = Some(ModelHistoryRecorder::new(|_| {
                Box::pin(async { Err("HookPrompt durable write rejected".into()) })
            }));
        }
        let mut events = Vec::new();
        let error = run_current_provider_turn(input, |event| events.push(event))
            .await
            .expect_err("Stop continuation requires an acknowledged history append");
        assert!(!error.is_reroutable_provider_failure());
        assert!(!error.is_credential_reroutable_provider_failure());
        if !missing {
            assert_eq!(error.message, "HookPrompt durable write rejected");
        }
        assert_eq!(provider.requests.lock().unwrap().len(), 1);
        assert!(!events
            .iter()
            .any(|event| matches!(event, CurrentProviderTurnEvent::HookPrompt { .. })));
    }
}

#[tokio::test]
async fn memory_rejects_both_block_and_abort_without_publishing_or_resampling() {
    for report in [
        RuntimeHookHandlerReport::Block {
            reason: "managed rejection".into(),
        },
        RuntimeHookHandlerReport::Abort {
            reason: Some("managed stop".into()),
        },
    ] {
        let provider = provider();
        let mut input = turn(provider.clone());
        input.session_config.stop_hook_target = RuntimeStopHookTarget::MemoryConsolidation;
        let mut snapshot = input
            .hook_snapshot_source
            .as_ref()
            .unwrap()
            .capture()
            .await
            .unwrap();
        snapshot.reporter = Arc::new(FixedHookReporter::new(Some(report)));
        input.hook_snapshot_source = Some(RuntimeHookSnapshotSourceHandle::fixed(snapshot));
        let mut events = Vec::new();
        let error = run_current_provider_turn(input, |event| events.push(event))
            .await
            .unwrap_err();
        assert_eq!(
            error.message,
            "Memory consolidation was rejected by a Stop hook"
        );
        assert!(!error.is_reroutable_provider_failure());
        assert_eq!(provider.requests.lock().unwrap().len(), 1);
        assert!(!events
            .iter()
            .any(|event| matches!(event, CurrentProviderTurnEvent::HookPrompt { .. })));
    }
}

#[tokio::test]
async fn synthetic_turn_skips_user_stop_without_requiring_a_history_recorder() {
    let provider = provider();
    let mut input = turn(provider.clone());
    input.session_config.stop_hook_target = RuntimeStopHookTarget::Disabled;
    run_current_provider_turn(input, |event| {
        assert!(!matches!(
            event,
            CurrentProviderTurnEvent::HookPrompt { .. }
        ));
    })
    .await
    .unwrap();
    assert_eq!(provider.requests.lock().unwrap().len(), 1);
}
