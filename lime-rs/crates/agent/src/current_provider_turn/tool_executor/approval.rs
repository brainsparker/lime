use super::action_scope;
use crate::protocol::AgentEvent;
use crate::runtime_state::AgentRuntimeState;
use agent_protocol::action_required::{tool_confirmation_action, ActionRequiredProjection};
use agent_protocol::ThreadId;
use agent_runtime::action_required::ActionRequiredRequest;
use agent_runtime::session_loop::{RuntimeSessionInputHandle, RuntimeSessionResponseKind};
use app_server_protocol::protocol::v2::DynamicToolCallApproval;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedSender;
use tool_runtime::execution_approval::{
    ExecutionApprovalResponse, BROWSER_ACTION_CONTRACT_KEY, BROWSER_ACTION_TOOL_FAMILY,
};
use tool_runtime::tool_executor::{
    RuntimeToolExecutionError, RuntimeToolExecutionRequest, RuntimeToolPolicyErrorKind,
};

const TOOL_CONFIRMATION_TIMEOUT: Duration = Duration::from_secs(300);

pub(super) async fn wait_for_tool_approval(
    state: &AgentRuntimeState,
    event_sender: &UnboundedSender<AgentEvent>,
    request: RuntimeToolExecutionRequest<'_>,
    thread_id: &ThreadId,
    pending_input: Option<&RuntimeSessionInputHandle>,
    prompt: &str,
    metadata: &HashMap<String, Value>,
    approval_key: Option<&str>,
) -> Result<(), RuntimeToolExecutionError> {
    ensure_user_reviewer(request)?;
    let response_handle = pending_input.cloned().ok_or_else(|| {
        RuntimeToolExecutionError::new(
            "tool approval requires the active session response owner",
            Some(RuntimeToolPolicyErrorKind::ExecutionFailed(
                "session_response_owner_missing".to_string(),
            )),
        )
        .before_handler()
    })?;
    let (scope, tool_call_id) = action_scope(request, thread_id)?;
    let tool_name = request.tool_name.to_string();
    let arguments = request.params.clone();
    let approval = tool_runtime::execution_approval::execution_approval_projection(
        request.tool_name,
        metadata,
    );
    let response = state
        .action_required_state()
        .request_action_and_wait_with_notification(
            response_handle,
            RuntimeSessionResponseKind::Approval,
            agent_protocol::action_required::TOOL_CONFIRMATION_ACTION_TYPE,
            Some(tool_call_id),
            approval.available_decisions.clone(),
            scope,
            prompt.to_string(),
            serde_json::json!({
                "type": "object",
                "properties": {
                    "confirmed": { "type": "boolean" }
                },
                "required": ["confirmed"]
            }),
            TOOL_CONFIRMATION_TIMEOUT,
            {
                let event_sender = event_sender.clone();
                move |queued| {
                    let projection = materialize_tool_approval_action(
                        queued, &tool_name, &arguments, prompt, &approval,
                    );
                    let _ = event_sender.send(AgentEvent::ActionRequired {
                        request_id: projection.id,
                        action_type: projection.action_type,
                        data: projection.data,
                        scope: projection.scope,
                    });
                }
            },
        )
        .await
        .map_err(|error| {
            RuntimeToolExecutionError::new(
                format!("工具审批等待失败: {error}"),
                Some(RuntimeToolPolicyErrorKind::ExecutionFailed(
                    "tool_approval_wait_failed".to_string(),
                )),
            )
            .before_handler()
        })?;

    let response: ExecutionApprovalResponse =
        serde_json::from_value(response).map_err(|error| {
            RuntimeToolExecutionError::new(
                format!("工具审批响应解析失败: {error}"),
                Some(RuntimeToolPolicyErrorKind::ExecutionFailed(
                    "tool_approval_response_invalid".to_string(),
                )),
            )
            .before_handler()
        })?;
    response.ensure_approved()?;
    if let Some(approval_key) =
        approval_key.filter(|_| response.decision.as_deref() == Some("allow_for_session"))
    {
        state
            .record_shell_approval(request.context.session_id(), approval_key.to_string())
            .await;
    }
    Ok(())
}

pub(in crate::current_provider_turn) fn ensure_user_reviewer(
    request: RuntimeToolExecutionRequest<'_>,
) -> Result<(), RuntimeToolExecutionError> {
    if request
        .turn_context
        .and_then(|context| context.approvals_reviewer)
        == Some(agent_protocol::ApprovalsReviewer::AutoReview)
    {
        return Err(RuntimeToolExecutionError::new(
            format!(
                "automatic approval review is not supported for tool {}",
                request.tool_name
            ),
            Some(RuntimeToolPolicyErrorKind::PermissionDenied(
                "approvals_reviewer_unsupported".into(),
            )),
        )
        .before_handler());
    }
    Ok(())
}

pub(in crate::current_provider_turn) async fn wait_for_browser_action_approval(
    state: &AgentRuntimeState,
    event_sender: &UnboundedSender<AgentEvent>,
    request: RuntimeToolExecutionRequest<'_>,
    thread_id: &ThreadId,
    pending_input: Option<&RuntimeSessionInputHandle>,
    descriptor: &DynamicToolCallApproval,
) -> Result<(), RuntimeToolExecutionError> {
    let approval_scope = json!({
        "contractKey": BROWSER_ACTION_CONTRACT_KEY,
        "contract_key": BROWSER_ACTION_CONTRACT_KEY,
        "toolFamily": BROWSER_ACTION_TOOL_FAMILY,
        "tool_family": BROWSER_ACTION_TOOL_FAMILY,
        "riskClass": descriptor.risk_class,
        "risk_class": descriptor.risk_class,
        "browserActionKind": descriptor.action_kind,
        "browserSessionId": descriptor.browser_session_id,
        "tabId": descriptor.tab_id,
        "viewId": descriptor.view_id,
        "webContentsId": descriptor.web_contents_id,
        "snapshotId": descriptor.snapshot_id,
        "backendNodeId": descriptor.backend_node_id,
    });
    let metadata = HashMap::from([
        ("actionKind".to_string(), json!("browser_action")),
        ("toolFamily".to_string(), json!(BROWSER_ACTION_TOOL_FAMILY)),
        (
            "contractKey".to_string(),
            json!(BROWSER_ACTION_CONTRACT_KEY),
        ),
        ("riskClass".to_string(), json!(descriptor.risk_class)),
        ("approvalScope".to_string(), approval_scope),
        (
            "availableDecisions".to_string(),
            json!(["allow_once", "decline", "cancel"]),
        ),
        (
            "runtime_contract".to_string(),
            json!({
                "contract_key": BROWSER_ACTION_CONTRACT_KEY,
                "tool_family": BROWSER_ACTION_TOOL_FAMILY,
                "session_cache_supported": false,
            }),
        ),
    ]);
    wait_for_tool_approval(
        state,
        event_sender,
        request,
        thread_id,
        pending_input,
        &descriptor.reason,
        &metadata,
        None,
    )
    .await
    .map_err(RuntimeToolExecutionError::before_handler)
}

pub(super) fn materialize_tool_approval_action(
    queued: &ActionRequiredRequest,
    tool_name: &str,
    arguments: &Value,
    prompt: &str,
    approval: &tool_runtime::execution_approval::ExecutionApprovalProjection,
) -> ActionRequiredProjection {
    let mut projection = tool_confirmation_action(
        queued.id.clone(),
        tool_name.to_string(),
        arguments.clone(),
        Some(prompt.to_string()),
        queued.scope.clone(),
    );
    if let Some(data) = projection.data.as_object_mut() {
        data.insert("actionType".to_string(), queued.action_type.clone().into());
        data.insert("toolCallId".to_string(), queued.tool_id.clone().into());
        data.insert(
            "availableDecisions".to_string(),
            queued.available_decisions.clone().into(),
        );
        data.insert("createdAtMs".to_string(), queued.created_at_ms.into());
        data.insert("deadlineAtMs".to_string(), queued.deadline_at_ms.into());
        data.insert(
            "actionKind".to_string(),
            approval.action_kind.clone().into(),
        );
        data.insert(
            "action_kind".to_string(),
            approval.action_kind.clone().into(),
        );
        data.insert(
            "toolFamily".to_string(),
            approval.tool_family.clone().into(),
        );
        data.insert(
            "tool_family".to_string(),
            approval.tool_family.clone().into(),
        );
        data.insert(
            "runtime_contract".to_string(),
            approval.runtime_contract.clone(),
        );
        data.insert(
            "contractKey".to_string(),
            approval.contract_key.clone().into(),
        );
        data.insert(
            "contract_key".to_string(),
            approval.contract_key.clone().into(),
        );
        data.insert("approvalScope".to_string(), approval.approval_scope.clone());
        data.insert(
            "approval_scope".to_string(),
            approval.approval_scope.clone(),
        );
    }
    projection
}
