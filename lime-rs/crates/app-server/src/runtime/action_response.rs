use super::{ActionRespondRequest, RuntimeCore, RuntimeCoreError};
use app_server_protocol::AgentSessionActionType;
use serde_json::{json, Value};
use tool_runtime::execution_approval::{approval_request_failed, ExecutionApprovalResponse};

impl RuntimeCore {
    pub(super) async fn dispatch_live_action_response(
        &self,
        request: &ActionRespondRequest,
    ) -> Result<(), RuntimeCoreError> {
        let turn_id = request.turn.as_ref().map(|turn| turn.turn_id.as_str());
        let response = action_response_value(request)?;
        let session = self
            .session_loops
            .get_or_create(&request.session.session_id, &request.session.thread_id)
            .await
            .map_err(|error| RuntimeCoreError::Backend(error.to_string()))?;
        let result = match request.action_type {
            AgentSessionActionType::ToolConfirmation => {
                session
                    .approve(turn_id, &request.request_id, response)
                    .await
            }
            AgentSessionActionType::AskUser => {
                session
                    .answer_user_input(turn_id, &request.request_id, response)
                    .await
            }
            AgentSessionActionType::Elicitation => {
                session
                    .resolve_mcp_elicitation(turn_id, &request.request_id, response)
                    .await
            }
        };
        result.map_err(|error| {
            tracing::warn!(
                session_id = %request.session.session_id,
                request_id = %request.request_id,
                error = %error,
                "failed to route action response to the active session task"
            );
            RuntimeCoreError::ActionResponse {
                code: "action_response_not_pending".to_string(),
                request_id: request.request_id.clone(),
            }
        })
    }
}

fn action_response_value(request: &ActionRespondRequest) -> Result<Value, RuntimeCoreError> {
    if request.action_type == AgentSessionActionType::ToolConfirmation {
        let request_failed = approval_request_failed(request.metadata.as_ref());
        // The validated decision owns permission; user_data cannot override it.
        return serde_json::to_value(ExecutionApprovalResponse {
            confirmed: request.confirmed && !request_failed,
            decision: request
                .decision
                .map(|decision| decision.as_str().to_string()),
            decision_scope: request
                .decision
                .map(|decision| decision.scope().to_string()),
            request_failed,
        })
        .map_err(|error| RuntimeCoreError::Backend(error.to_string()));
    }
    Ok(request
        .user_data
        .clone()
        .or_else(|| {
            request
                .response
                .as_ref()
                .map(|response| json!({ "answer": response }))
        })
        .unwrap_or_else(|| json!({ "confirmed": request.confirmed })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::RuntimeHostContext;
    use app_server_protocol::{AgentSession, AgentSessionApprovalDecision, AgentSessionStatus};
    use tool_runtime::execution_approval::APPROVAL_REQUEST_FAILED_METADATA_KEY;

    fn request() -> ActionRespondRequest {
        ActionRespondRequest {
            host: RuntimeHostContext::default(),
            session: AgentSession {
                session_id: "session-1".to_string(),
                thread_id: "thread-1".to_string(),
                app_id: "agent".to_string(),
                workspace_id: None,
                business_object_ref: None,
                status: AgentSessionStatus::WaitingAction,
                created_at: "2026-10-13T00:00:00Z".to_string(),
                updated_at: "2026-10-13T00:00:00Z".to_string(),
            },
            turn: None,
            request_id: "approval-1".to_string(),
            action_type: AgentSessionActionType::ToolConfirmation,
            decision: Some(AgentSessionApprovalDecision::Decline),
            confirmed: false,
            response: Some("approve".to_string()),
            user_data: Some(json!({ "confirmed": true, "decision": "allow_for_session" })),
            metadata: None,
            event_name: None,
            action_scope: None,
            pending_action_descriptor: None,
        }
    }

    #[test]
    fn tool_response_uses_validated_decision_and_preserves_request_failure() {
        let mut request = request();
        let response = action_response_value(&request).expect("decline");
        assert_eq!(response["confirmed"], false);
        assert_eq!(response["decision"], "decline");
        assert!(response.get("requestFailed").is_none());

        request.metadata = Some(json!({ (APPROVAL_REQUEST_FAILED_METADATA_KEY): true }));
        request.confirmed = true;
        request.decision = Some(AgentSessionApprovalDecision::AllowForSession);
        let response: ExecutionApprovalResponse =
            serde_json::from_value(action_response_value(&request).expect("failed response"))
                .expect("typed approval response");
        assert!(!response.confirmed);
        assert!(response.request_failed);
        assert!(response.ensure_approved().is_err());
    }

    #[test]
    fn user_input_and_elicitation_keep_answers_and_text() {
        for action_type in [
            AgentSessionActionType::AskUser,
            AgentSessionActionType::Elicitation,
        ] {
            let mut request = request();
            request.action_type = action_type;
            request.user_data = Some(json!({ "mode": "auto" }));
            assert_eq!(
                action_response_value(&request).expect("answers"),
                json!({ "mode": "auto" })
            );
            request.user_data = None;
            assert_eq!(
                action_response_value(&request).expect("text"),
                json!({ "answer": "approve" })
            );
        }
    }
}
