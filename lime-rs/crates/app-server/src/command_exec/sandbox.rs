use app_server_protocol::protocol::v2::GrantedPermissionProfile;
use app_server_protocol::JsonRpcError;
use serde_json::{json, Value};
use tool_runtime::execution_policy::ToolExecutionSandboxProfile;
use tool_runtime::execution_process::LocalExecutionSandbox;
use tool_runtime::sandbox::{
    plan_sandbox_backend, SandboxBackendPlanInput, SandboxBackendPlatform,
};

/// Standalone commands use the selected OS sandbox, not Agent tool approval heuristics.
pub(super) fn resolve_command_exec_sandbox(
    requested_policy: Option<&str>,
    granted_permissions: Option<GrantedPermissionProfile>,
    runtime_metadata: Option<&Value>,
) -> Result<Option<LocalExecutionSandbox>, JsonRpcError> {
    let mut metadata = runtime_metadata.cloned().unwrap_or_else(|| json!({}));
    if requested_policy.is_some() {
        if !metadata.is_object() {
            metadata = json!({});
        }
        metadata["workspaceSandbox"] = json!({
            "enabled": true,
            "strict": true,
            "notifyOnFallback": false,
        });
    }
    let plan = plan_sandbox_backend(SandboxBackendPlanInput {
        sandbox_profile: ToolExecutionSandboxProfile::WorkspaceCommand,
        requested_policy,
        request_metadata: Some(&metadata),
        bypass_restrictions: false,
        platform: SandboxBackendPlatform::current(),
    });
    if plan.strict_fallback_blocks_execution() {
        return Err(super::invalid_runtime(format!(
            "{}: {}",
            plan.reason_code, plan.reason
        )));
    }
    Ok(plan
        .can_run_with_backend()
        .then_some(LocalExecutionSandbox {
            backend: plan.backend,
            requested_policy: requested_policy.map(str::to_string),
            granted_permissions,
            windows_mode: plan.config.windows_mode,
        }))
}
