use super::*;
use tool_runtime::hook_gated_executor::FixedHookReporter;
use tool_runtime::hook_lifecycle::RuntimeHookHandlerReport;
use tool_runtime::turn_snapshot::{
    RuntimeHookEventName, RuntimeHookExecutionMode, RuntimeHookHandlerType, RuntimeHookSource,
    RuntimeHookTrustStatus,
};

fn hook(key: &str, display_order: i64) -> RuntimeHookSnapshot {
    RuntimeHookSnapshot {
        key: key.to_string(),
        event_name: RuntimeHookEventName::PreToolUse,
        handler_type: RuntimeHookHandlerType::Command,
        execution_mode: RuntimeHookExecutionMode::Sync,
        matcher: None,
        command: Some("echo hook".to_string()),
        timeout_sec: 5,
        status_message: None,
        additional_context_limit: None,
        source_path: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("hooks.json"),
        source: RuntimeHookSource::Plugin,
        plugin_id: Some("demo@team".to_string()),
        display_order,
        enabled: true,
        is_managed: false,
        current_hash: "sha256:test".to_string(),
        trust_status: RuntimeHookTrustStatus::Trusted,
    }
}

async fn assert_rejected(source: RuntimeHookSnapshotSourceHandle, expected: &str) {
    let provider = Arc::new(ScriptedProvider::new(Vec::new()));
    let result = run_current_provider_turn(
        CurrentProviderTurnInput {
            provider: provider.clone(),
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session-1")
                .turn_id("turn-1")
                .build(),
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("hello".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    Vec::new(),
                    RuntimeToolExecutorHandle::new(Arc::new(EchoTool)),
                ),
            ),
            hook_snapshot_source: Some(source),
            model_request_policy: None,
            tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
            working_directory: PathBuf::from(env!("CARGO_MANIFEST_DIR")),
            cancel_token: None,
            pending_input: None,
            mid_turn_compaction: None,
        },
        |_| {},
    )
    .await;
    let error = result.expect_err("invalid Hook source must stop the provider step");
    assert!(error.message.contains(expected), "{error:?}");
    assert!(!error.retryable());
    assert!(
        provider
            .requests
            .lock()
            .expect("provider requests")
            .is_empty(),
        "Hook validation must fail before sampling or tool execution"
    );
}

#[tokio::test]
async fn invalid_hook_snapshot_stops_sampling_instead_of_bypassing_hooks() {
    let mut relative = hook("relative", 0);
    relative.source_path = PathBuf::from("hooks.json");
    for (hooks, expected) in [
        (vec![hook("", 0)], "EmptyHookKey"),
        (
            vec![hook("duplicate", 0), hook("duplicate", 1)],
            "DuplicateHookKey",
        ),
        (vec![relative], "RelativeHookSourcePath"),
    ] {
        assert_rejected(
            RuntimeHookSnapshotSourceHandle::fixed(RuntimeHookStepSnapshot {
                hooks,
                reporter: Arc::new(FixedHookReporter::new(None)),
            }),
            expected,
        )
        .await;
    }
}

struct FailedHookSource;

impl RuntimeHookSnapshotSource for FailedHookSource {
    fn capture(&self) -> RuntimeHookSnapshotFuture<'_> {
        Box::pin(async { Err("plugin Hook source unavailable".to_string()) })
    }
}

#[tokio::test]
async fn hook_source_failure_stops_sampling() {
    assert_rejected(
        RuntimeHookSnapshotSourceHandle::new(Arc::new(FailedHookSource)),
        "plugin Hook source unavailable",
    )
    .await;
}

#[tokio::test]
async fn terminal_stop_hook_blocks_once_with_the_current_step_snapshot() {
    let mut stop = hook("stop", 0);
    stop.event_name = RuntimeHookEventName::Stop;
    let config = crate::session_config::SessionConfigBuilder::new("session-1")
        .thread_id("thread-1")
        .turn_id("turn-1")
        .build();
    let evaluation = super::super::evaluate_stop_hooks(
        &RuntimeHookStepSnapshot {
            hooks: vec![stop],
            reporter: Arc::new(FixedHookReporter::new(Some(
                RuntimeHookHandlerReport::Block {
                    reason: "continue until checks pass".to_string(),
                },
            ))),
        },
        &config,
        "turn-1",
        Path::new(env!("CARGO_MANIFEST_DIR")),
        false,
        "finished response".to_string(),
    )
    .await;
    assert!(!evaluation.should_stop);
    assert_eq!(
        evaluation.block_reason.as_deref(),
        Some("continue until checks pass")
    );
    assert_eq!(evaluation.continuation_fragments.len(), 1);
    assert_eq!(
        evaluation.continuation_fragments[0].text,
        "continue until checks pass"
    );
    assert!(evaluation.continuation_fragments[0]
        .hook_run_id
        .contains("turn-1:stop"));
}

#[tokio::test]
async fn terminal_stop_hook_abort_stops_without_continuation() {
    let mut stop = hook("stop", 0);
    stop.event_name = RuntimeHookEventName::Stop;
    let config = crate::session_config::SessionConfigBuilder::new("session-1")
        .thread_id("thread-1")
        .turn_id("turn-1")
        .build();
    let evaluation = super::super::evaluate_stop_hooks(
        &RuntimeHookStepSnapshot {
            hooks: vec![stop],
            reporter: Arc::new(FixedHookReporter::new(Some(
                RuntimeHookHandlerReport::Abort {
                    reason: Some("stop now".to_string()),
                },
            ))),
        },
        &config,
        "turn-1",
        Path::new(env!("CARGO_MANIFEST_DIR")),
        true,
        "finished response".to_string(),
    )
    .await;
    assert!(evaluation.should_stop);
    assert!(evaluation.block_reason.is_none());
    assert!(evaluation.continuation_fragments.is_empty());
}

#[tokio::test]
async fn cancellation_after_completed_provider_step_skips_stop_hook_dispatch() {
    let provider = Arc::new(ScriptedProvider::new(vec![vec![
        Ok(CanonicalLlmEvent::TextDelta {
            id: "answer".into(),
            text: "finished response".into(),
        }),
        Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            needs_follow_up: false,
            usage: None,
            response_id: None,
        }),
    ]]));
    let cancellation = CancellationToken::new();
    let mut stop = hook("stop", 0);
    stop.event_name = RuntimeHookEventName::Stop;
    let hook_snapshot = RuntimeHookStepSnapshot {
        hooks: vec![stop],
        reporter: Arc::new(FixedHookReporter::new(Some(
            RuntimeHookHandlerReport::Block {
                reason: "must not be dispatched after cancellation".to_string(),
            },
        ))),
    };
    let mut events = Vec::new();
    let result = run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session-cancel-stop")
                .thread_id("thread-cancel-stop")
                .turn_id("turn-cancel-stop")
                .build(),
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("hello".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    Vec::new(),
                    RuntimeToolExecutorHandle::new(Arc::new(EchoTool)),
                ),
            ),
            hook_snapshot_source: Some(RuntimeHookSnapshotSourceHandle::fixed(hook_snapshot)),
            model_request_policy: None,
            tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
            working_directory: PathBuf::from(env!("CARGO_MANIFEST_DIR")),
            cancel_token: Some(cancellation.clone()),
            pending_input: None,
            mid_turn_compaction: None,
        },
        |event| {
            if matches!(
                event,
                CurrentProviderTurnEvent::ProviderStep {
                    completed: true,
                    ..
                }
            ) {
                cancellation.cancel();
            }
            events.push(event);
        },
    )
    .await
    .expect("cancellation is a normal terminal result");

    assert!(result.cancelled);
    assert!(!events
        .iter()
        .any(|event| matches!(event, CurrentProviderTurnEvent::HookPrompt { .. })));
}

#[test]
fn hook_prompt_lowering_uses_codex_user_wire_shape() {
    let fragments = vec![agent_protocol::HookPromptFragment {
        text: "retry <checks> & keep going".to_string(),
        hook_run_id: "stop:0:/tmp/hooks.json:turn-1:stop".to_string(),
    }];
    let message = super::super::hook_prompt_provider_message(&fragments).expect("hook prompt");
    assert_eq!(message.role, CurrentProviderRole::User);
    assert!(matches!(
        &message.content[..],
        [CurrentProviderContent::Text(text)]
            if text == "<hook_prompt hook_run_id=\"stop:0:/tmp/hooks.json:turn-1:stop\">retry &lt;checks&gt; &amp; keep going</hook_prompt>"
    ));
}
