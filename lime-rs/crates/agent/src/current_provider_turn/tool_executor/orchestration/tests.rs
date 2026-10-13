use super::*;
use std::path::PathBuf;

fn execution_request(
    params: Value,
    working_directory: &str,
) -> (
    Value,
    tool_runtime::tool_executor::RuntimeToolExecutionContext,
) {
    let context = tool_runtime::tool_executor::RuntimeToolExecutionContext::new(
        tool_runtime::tool_executor::RuntimeToolExecutionContextInput {
            working_directory: PathBuf::from(working_directory),
            session_id: "approval-key-test-session".to_string(),
            cancel_token: None,
            workspace_sandbox: None,
        },
    );
    (params, context)
}

#[test]
fn shell_and_apply_patch_retry_policies_match_codex_contract() {
    assert!(!sandbox_retry_allowed(
        tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
        RuntimeToolApprovalPolicy::OnRequest,
    ));
    assert!(sandbox_retry_allowed(
        tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
        RuntimeToolApprovalPolicy::UnlessTrusted,
    ));
    assert!(sandbox_retry_allowed(
        tool_runtime::apply_patch::APPLY_PATCH_TOOL_NAME,
        RuntimeToolApprovalPolicy::OnRequest,
    ));
    assert!(!sandbox_retry_allowed(
        tool_runtime::apply_patch::APPLY_PATCH_TOOL_NAME,
        RuntimeToolApprovalPolicy::Never,
    ));
}

#[test]
fn shell_approval_key_is_scoped_to_command_cwd_sandbox_and_permissions() {
    let (params, context) = execution_request(
        json!({
            "cmd": "cargo test",
            "sandbox_permissions": "require_escalated",
            "additional_permissions": {"network": true}
        }),
        "/workspace/project",
    );
    let request = RuntimeToolExecutionRequest {
        tool_name: tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
        params: &params,
        context: &context,
        turn_context: None,
    };
    let base = shell_approval_key(request, RuntimeToolSandboxPolicy::WorkspaceWrite)
        .expect("shell approval key");

    let (different_command, _) =
        execution_request(json!({"cmd": "cargo check"}), "/workspace/project");
    let different_command_request = RuntimeToolExecutionRequest {
        tool_name: tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
        params: &different_command,
        context: &context,
        turn_context: None,
    };
    assert_ne!(
        base,
        shell_approval_key(
            different_command_request,
            RuntimeToolSandboxPolicy::WorkspaceWrite
        )
        .expect("different command key")
    );

    let (same_command_different_cwd, different_cwd_context) = execution_request(
        json!({
            "cmd": "cargo test",
            "sandbox_permissions": "require_escalated",
            "additional_permissions": {"network": true}
        }),
        "/workspace/other-project",
    );
    let different_cwd_request = RuntimeToolExecutionRequest {
        tool_name: tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
        params: &same_command_different_cwd,
        context: &different_cwd_context,
        turn_context: None,
    };
    assert_ne!(
        base,
        shell_approval_key(
            different_cwd_request,
            RuntimeToolSandboxPolicy::WorkspaceWrite
        )
        .expect("different cwd key")
    );
    assert_ne!(
        base,
        shell_approval_key(request, RuntimeToolSandboxPolicy::DangerFullAccess)
            .expect("different sandbox key")
    );

    let (different_permissions, different_permissions_context) = execution_request(
        json!({
            "cmd": "cargo test",
            "sandbox_permissions": "require_escalated",
            "additional_permissions": {"network": false}
        }),
        "/workspace/project",
    );
    let different_permissions_request = RuntimeToolExecutionRequest {
        tool_name: tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
        params: &different_permissions,
        context: &different_permissions_context,
        turn_context: None,
    };
    assert_ne!(
        base,
        shell_approval_key(
            different_permissions_request,
            RuntimeToolSandboxPolicy::WorkspaceWrite
        )
        .expect("different permissions key")
    );

    let (browser_params, browser_context) =
        execution_request(json!({"cmd": "cargo test"}), "/workspace/project");
    let browser_request = RuntimeToolExecutionRequest {
        tool_name: "browser_click",
        params: &browser_params,
        context: &browser_context,
        turn_context: None,
    };
    assert!(
        shell_approval_key(browser_request, RuntimeToolSandboxPolicy::WorkspaceWrite).is_none()
    );
}

#[test]
fn shell_approval_contract_exposes_session_scope_only_for_shell() {
    let params = json!({"cmd": "cargo test"});
    let context = tool_runtime::tool_executor::RuntimeToolExecutionContext::new(
        tool_runtime::tool_executor::RuntimeToolExecutionContextInput {
            working_directory: PathBuf::from("/workspace/project"),
            session_id: "approval-contract-test-session".to_string(),
            cancel_token: None,
            workspace_sandbox: None,
        },
    );
    let request = RuntimeToolExecutionRequest {
        tool_name: tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
        params: &params,
        context: &context,
        turn_context: None,
    };
    let mut decision = current_tool_execution_decision(request);
    decision.kind = ToolExecutionDecisionKind::RequiresApproval;
    annotate_shell_approval_contract(&mut decision, request);
    let projection = tool_runtime::execution_approval::execution_approval_projection(
        request.tool_name,
        &decision.metadata,
    );
    assert_eq!(
        projection.available_decisions,
        vec![
            "allow_once".to_string(),
            "allow_for_session".to_string(),
            "decline".to_string(),
            "cancel".to_string()
        ]
    );
    assert_eq!(
        projection.runtime_contract["session_cache_supported"],
        Value::Bool(true)
    );

    let mut browser_metadata = HashMap::from([(
        "runtime_contract".to_string(),
        json!({
            "contract_key": BROWSER_ACTION_CONTRACT_KEY,
            "tool_family": BROWSER_ACTION_TOOL_FAMILY,
            "session_cache_supported": false,
        }),
    )]);
    browser_metadata.insert(
        "availableDecisions".to_string(),
        json!(["allow_once", "allow_for_session", "decline", "cancel"]),
    );
    let browser_projection = tool_runtime::execution_approval::execution_approval_projection(
        "browser_click",
        &browser_metadata,
    );
    assert_eq!(
        browser_projection.available_decisions,
        vec!["allow_once", "decline", "cancel"]
    );
}
