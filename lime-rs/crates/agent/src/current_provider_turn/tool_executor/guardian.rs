use super::*;
use crate::guardian_review;
use tool_runtime::execution_orchestrator::{RuntimeToolApprovalPhase, RuntimeToolApprovalRequest};

pub(super) async fn run_guardian_tool_review(
    state: &AgentRuntimeState,
    event_sender: &UnboundedSender<AgentEvent>,
    request: RuntimeToolExecutionRequest<'_>,
    thread_id: &ThreadId,
    approval: &RuntimeToolApprovalRequest,
    strict: bool,
) -> Result<(), RuntimeToolExecutionError> {
    if !tool_runtime::shell::is_shell_tool_name(request.tool_name) {
        return Err(RuntimeToolExecutionError::new(
            format!(
                "automatic approval review is not supported for tool {}",
                request.tool_name
            ),
            Some(RuntimeToolPolicyErrorKind::PermissionDenied(
                "approvals_reviewer_unsupported".into(),
            )),
        ));
    }
    let identity = request.context.tool_identity().ok_or_else(|| {
        RuntimeToolExecutionError::new(
            "Guardian review requires canonical tool identity",
            Some(RuntimeToolPolicyErrorKind::ExecutionFailed(
                "guardian_review_identity_missing".to_string(),
            )),
        )
    })?;
    let turn_id = identity.turn_id().to_string();
    let command = request
        .params
        .get("cmd")
        .or_else(|| request.params.get("command"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let cwd = request
        .context
        .working_directory()
        .to_string_lossy()
        .to_string();
    if command.is_empty() {
        return Err(RuntimeToolExecutionError::new(
            "Guardian review requires a non-empty shell command",
            Some(RuntimeToolPolicyErrorKind::PermissionDenied(
                "guardian_review_command_missing".to_string(),
            )),
        ));
    }
    let review_request = guardian_review::GuardianReviewRequest {
        session_id: request.context.session_id().to_string(),
        thread_id: thread_id.clone(),
        turn_id: turn_id.clone(),
        target_item_id: Some(identity.call_id().to_string()),
        tool_name: request.tool_name.to_string(),
        command,
        cwd,
        strict,
        user_request: request
            .turn_context
            .and_then(|context| context.user_visible_input_text.clone()),
        approval_context: serde_json::json!({
            "phase": match approval.phase { RuntimeToolApprovalPhase::Initial => "initial", RuntimeToolApprovalPhase::Escalation => "escalation" },
            "reason": approval.reason,
            "networkHost": approval.network_host,
            "sandboxPolicy": request.turn_context.and_then(|context| context.sandbox_policy.as_deref()),
            "effectiveSandboxPolicy": approval.effective_sandbox_policy.label(),
            "grantedPermissions": approval.granted_permissions,
            "requestedSandboxPermissions": request.params.get("sandbox_permissions"),
        }),
        started_at_ms: chrono::Utc::now().timestamp_millis(),
    };
    let review_id = guardian_review::review_id();
    let action = guardian_review::action_value(&review_request);
    let _ = event_sender.send(guardian_review::started_event(
        &review_request,
        &review_id,
        action.clone(),
    ));
    let provider = state
        .provider_for_session(request.context.session_id())
        .await
        .ok_or_else(|| {
            RuntimeToolExecutionError::new(
                "Guardian review provider is not ready; the action was denied",
                Some(RuntimeToolPolicyErrorKind::PermissionDenied(
                    "guardian_review_provider_unavailable".to_string(),
                )),
            )
        });
    let result = match provider {
        Ok(provider) => {
            guardian_review::run(
                provider,
                &review_request,
                request_cancel_token(request.context.cancel_token()),
            )
            .await
        }
        Err(error) => {
            let rationale = "Guardian review provider is not ready; the action was denied.";
            let _ = event_sender.send(guardian_review::completed_event(
                &review_request,
                &review_id,
                action,
                guardian_review::GuardianReviewResult {
                    status: crate::protocol::GuardianReviewStatus::Denied,
                    risk_level: Some(crate::protocol::GuardianRiskLevel::High),
                    user_authorization: Some(crate::protocol::GuardianUserAuthorization::Unknown),
                    rationale: rationale.to_string(),
                },
                chrono::Utc::now().timestamp_millis(),
            ));
            let _ = record_guardian_denial(state, event_sender, request.context, &turn_id).await;
            return Err(error);
        }
    };
    let status = result.status;
    let rationale = result.rationale.clone();
    let _ = event_sender.send(guardian_review::completed_event(
        &review_request,
        &review_id,
        action,
        result.clone(),
        chrono::Utc::now().timestamp_millis(),
    ));
    if matches!(status, crate::protocol::GuardianReviewStatus::Approved) {
        state
            .record_guardian_non_denial(request.context.session_id(), &turn_id)
            .await;
        return Ok(());
    }
    if matches!(status, crate::protocol::GuardianReviewStatus::Denied) {
        let _ = record_guardian_denial(state, event_sender, request.context, &turn_id).await;
    }
    Err(RuntimeToolExecutionError::new(
        format!("Guardian denied shell execution: {rationale}"),
        Some(RuntimeToolPolicyErrorKind::PermissionDenied(
            "guardian_review_denied".to_string(),
        )),
    ))
}

async fn record_guardian_denial(
    state: &AgentRuntimeState,
    event_sender: &UnboundedSender<AgentEvent>,
    context: &tool_runtime::tool_executor::RuntimeToolExecutionContext,
    turn_id: &str,
) -> Option<String> {
    let (consecutive_denials, recent_denials) = state
        .record_guardian_denial(context.session_id(), turn_id)
        .await?;
    let message = format!(
        "Automatic approval review rejected too many approval requests for this turn ({consecutive_denials} consecutive, {recent_denials} in the last 5 reviews); interrupting the turn."
    );
    let _ = event_sender.send(AgentEvent::GuardianWarning {
        message: message.clone(),
    });
    if let Some(cancel_token) = context.cancel_token() {
        cancel_token.cancel();
    }
    Some(message)
}
