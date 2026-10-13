use super::*;
use serde_json::json;

#[derive(Default)]
struct CancelingExecutor {
    cleanup: std::sync::atomic::AtomicBool,
}

impl RuntimeToolExecutor for CancelingExecutor {
    fn execute<'a>(
        &'a self,
        request: RuntimeToolExecutionRequest<'a>,
    ) -> RuntimeToolExecutionFuture<'a> {
        Box::pin(async move {
            request
                .context
                .cancel_token()
                .expect("cancellation token")
                .cancel();
            tokio::task::yield_now().await;
            self.cleanup
                .store(true, std::sync::atomic::Ordering::SeqCst);
            Err(RuntimeToolExecutionError::new(
                "Tool execution cancelled",
                Some(RuntimeToolPolicyErrorKind::Canceled(
                    "test_cancelled".to_string(),
                )),
            ))
        })
    }
}

#[tokio::test]
async fn unified_exec_runner_keeps_execution_until_owned_cleanup() {
    for name in [
        crate::unified_exec::EXEC_COMMAND_TOOL_NAME,
        crate::unified_exec::WRITE_STDIN_TOOL_NAME,
    ] {
        let executor = Arc::new(CancelingExecutor::default());
        let runtime = RuntimeTool::new(
            RuntimeToolDefinition::new(name, "cancellation fixture", json!({})),
            RuntimeToolExposure::Direct,
            RuntimeToolExecutorHandle::new(executor.clone()),
        );
        let context = RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
            working_directory: PathBuf::from("/tmp/workspace"),
            session_id: "cancellation-session".to_string(),
            cancel_token: Some(CancellationToken::new()),
            workspace_sandbox: None,
        });
        let call = ToolCall::new(
            "cancellation-turn",
            "cancellation-call",
            name,
            json!({}),
            Vec::new(),
            Arc::new(NoopLifecycleEmitter),
        );
        let output = runtime.execute_call(&call, &context, None).await;
        assert!(!output.success);
        assert_eq!(
            output.metadata[crate::tool_result_projection::TOOL_OUTCOME_METADATA_KEY],
            crate::tool_result_projection::TOOL_OUTCOME_ABORTED,
        );
        assert!(
            executor.cleanup.load(std::sync::atomic::Ordering::SeqCst),
            "{name}: cleanup must run"
        );
    }
}

#[test]
fn runtime_tool_result_keeps_terminal_fields() {
    let result = RuntimeToolExecutionResult::new(
        true,
        "ok".to_string(),
        None,
        HashMap::from([("source".to_string(), json!("runtime"))]),
    );

    assert!(result.success);
    assert_eq!(result.output, "ok");
    assert_eq!(result.metadata.get("source"), Some(&json!("runtime")));
}

#[test]
fn runtime_tool_context_keeps_execution_inputs_without_agent_types() {
    let metadata = HashMap::from([("sandboxBackend".to_string(), json!("seatbelt"))]);
    let context = RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
        working_directory: PathBuf::from("/tmp/workspace"),
        session_id: "session-1".to_string(),
        cancel_token: None,
        workspace_sandbox: Some(RuntimeWorkspaceSandboxInput::from_policy_metadata(
            &metadata,
        )),
    });

    assert_eq!(
        context.working_directory(),
        &PathBuf::from("/tmp/workspace")
    );
    assert_eq!(context.session_id(), "session-1");
    assert!(context.has_workspace_sandbox());
    assert_eq!(
        context
            .workspace_sandbox()
            .map(|sandbox| sandbox.metadata()),
        Some(&metadata)
    );
    assert!(context.environment().is_empty());
    assert!(context.environment_id().is_none());
    assert!(context.tool_identity().is_none());
    assert!(context.execution_attempt().is_none());
}

struct IdentityExecutor;

impl RuntimeToolExecutor for IdentityExecutor {
    fn execute<'a>(
        &'a self,
        request: RuntimeToolExecutionRequest<'a>,
    ) -> RuntimeToolExecutionFuture<'a> {
        Box::pin(async move {
            let identity = request
                .context
                .tool_identity()
                .expect("execute_call must bind canonical tool identity");
            Ok(RuntimeToolExecutionResult::new(
                true,
                format!(
                    "{}:{}:{}:{}",
                    identity.call_id(),
                    identity.turn_id(),
                    request.context.environment_id().unwrap_or("none"),
                    request.context.working_directory().display()
                ),
                None,
                HashMap::new(),
            ))
        })
    }
}

struct NoopLifecycleEmitter;

impl crate::tool_lifecycle::ToolLifecycleEmitter for NoopLifecycleEmitter {
    fn emit<'a>(
        &'a self,
        _event: crate::tool_lifecycle::ToolLifecycleEvent,
    ) -> crate::tool_lifecycle::ToolLifecycleEmissionFuture<'a> {
        Box::pin(async {})
    }
}

#[tokio::test]
async fn execute_call_binds_typed_identity_without_mutating_turn_metadata() {
    let context = RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
        working_directory: PathBuf::from("/tmp/workspace"),
        session_id: "session-identity".to_string(),
        cancel_token: None,
        workspace_sandbox: None,
    });
    let call = ToolCall::new(
        "turn-canonical",
        "call-canonical",
        "Echo",
        json!({}),
        vec![crate::tool_call::ToolEnvironment::new(
            "remote-tools",
            PathBuf::from("/remote/workspace"),
        )],
        Arc::new(NoopLifecycleEmitter),
    );
    let turn_context = RuntimeToolTurnContext {
        metadata: HashMap::from([
            ("tool_call_id".to_string(), json!("call-metadata")),
            ("turn_id".to_string(), json!("turn-metadata")),
        ]),
        ..RuntimeToolTurnContext::default()
    };
    let executor = RuntimeToolExecutorHandle::new(Arc::new(IdentityExecutor));

    let result = executor
        .execute_call(&call, &context, Some(&turn_context))
        .await
        .expect("identified call should execute");

    assert_eq!(
        result.output,
        "call-canonical:turn-canonical:remote-tools:/remote/workspace"
    );
    assert_eq!(
        turn_context.metadata.get("tool_call_id"),
        Some(&json!("call-metadata"))
    );
    assert_eq!(
        turn_context.metadata.get("turn_id"),
        Some(&json!("turn-metadata"))
    );
}

struct EchoExecutor;

impl RuntimeToolExecutor for EchoExecutor {
    fn execute<'a>(
        &'a self,
        request: RuntimeToolExecutionRequest<'a>,
    ) -> RuntimeToolExecutionFuture<'a> {
        Box::pin(async move {
            Ok(RuntimeToolExecutionResult::new(
                true,
                format!("{}:{}", request.context.session_id(), request.tool_name),
                None,
                HashMap::new(),
            ))
        })
    }
}

#[tokio::test]
async fn runtime_tool_executor_handle_dispatches_current_request() {
    let context = RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
        working_directory: PathBuf::from("/tmp/workspace"),
        session_id: "session-2".to_string(),
        cancel_token: None,
        workspace_sandbox: None,
    });
    let params = json!({});
    let executor = RuntimeToolExecutorHandle::new(Arc::new(EchoExecutor));

    let result = executor
        .execute(RuntimeToolExecutionRequest {
            tool_name: "Echo",
            params: &params,
            context: &context,
            turn_context: None,
        })
        .await
        .expect("runtime executor should return result");

    assert!(result.success);
    assert_eq!(result.output, "session-2:Echo");
}

#[tokio::test]
async fn runtime_tool_runner_materializes_current_result_outcome() {
    let context = RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
        working_directory: PathBuf::from("/tmp/workspace"),
        session_id: "session-3".to_string(),
        cancel_token: None,
        workspace_sandbox: None,
    });
    let params = json!({});
    let executor = RuntimeToolExecutorHandle::new(Arc::new(EchoExecutor));

    let outcome = run_runtime_tool_execution(
        &executor,
        RuntimeToolExecutionRequest {
            tool_name: "Echo",
            params: &params,
            context: &context,
            turn_context: None,
        },
    )
    .await;

    match outcome {
        RuntimeToolExecutionOutcome::Result(result) => {
            assert!(result.success);
            assert_eq!(result.output, "session-3:Echo");
        }
        RuntimeToolExecutionOutcome::Error(error) => {
            panic!("runtime runner should not fail: {error:?}");
        }
        RuntimeToolExecutionOutcome::Aborted => {
            panic!("runtime runner should not abort without a cancellation token");
        }
    }
}

struct FailingExecutor {
    error: RuntimeToolExecutionError,
}

impl RuntimeToolExecutor for FailingExecutor {
    fn execute<'a>(
        &'a self,
        _request: RuntimeToolExecutionRequest<'a>,
    ) -> RuntimeToolExecutionFuture<'a> {
        Box::pin(async move { Err(self.error.clone()) })
    }
}

#[tokio::test]
async fn runtime_tool_runner_materializes_policy_failure_outcome() {
    let context = RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
        working_directory: PathBuf::from("/tmp/workspace"),
        session_id: "session-4".to_string(),
        cancel_token: None,
        workspace_sandbox: None,
    });
    let params = json!({});
    let executor = RuntimeToolExecutorHandle::new(Arc::new(FailingExecutor {
        error: RuntimeToolExecutionError::new(
            "blocked by policy",
            Some(RuntimeToolPolicyErrorKind::PermissionDenied(
                "permission_denied".to_string(),
            )),
        ),
    }));

    let outcome = run_runtime_tool_execution(
        &executor,
        RuntimeToolExecutionRequest {
            tool_name: "Echo",
            params: &params,
            context: &context,
            turn_context: None,
        },
    )
    .await;

    match outcome {
        RuntimeToolExecutionOutcome::Result(result) => {
            panic!("runtime runner should fail, got {result:?}");
        }
        RuntimeToolExecutionOutcome::Error(error) => {
            assert_eq!(error.message(), "blocked by policy");
            assert_eq!(
                error.kind(),
                RuntimeToolExecutionFailureKind::PermissionDenied
            );
        }
        RuntimeToolExecutionOutcome::Aborted => {
            panic!("runtime runner should not abort without a cancellation token");
        }
    }
}

#[test]
fn policy_error_classification_projects_gui_metadata() {
    let permission_error = RuntimeToolPolicyErrorKind::PermissionDenied("blocked".to_string());
    let permission = permission_error
        .classification()
        .expect("permission denial should classify");
    assert_eq!(permission.event_class, "permission.denied");
    assert_eq!(permission.failure_category, "permission_denied");
    assert_eq!(permission.reason_code, "permission_denied");

    let sandbox_error = RuntimeToolPolicyErrorKind::SandboxDenied("sandbox_denied".to_string());
    let sandbox = sandbox_error
        .classification()
        .expect("sandbox execution failure should classify");
    assert_eq!(sandbox.event_class, "sandbox.blocked");
    assert_eq!(sandbox.failure_category, "sandbox_blocked");
    assert_eq!(sandbox.reason_code, "sandbox_denied");

    assert!(
        RuntimeToolPolicyErrorKind::ExecutionFailed("command failed".to_string())
            .classification()
            .is_none()
    );
}
