use super::*;
use tool_runtime::hook_gated_executor::FixedHookReporter;
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
