use crate::tool_executor::{RuntimeToolExecutionError, RuntimeToolPolicyErrorKind};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const APPROVAL_REQUEST_FAILED_METADATA_KEY: &str = "approvalRequestFailed";

/// Internal session response; the public approval decision contract stays unchanged.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionApprovalResponse {
    pub confirmed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_scope: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub request_failed: bool,
}

fn is_false(value: &bool) -> bool {
    !value
}

impl ExecutionApprovalResponse {
    pub fn ensure_approved(&self) -> Result<(), RuntimeToolExecutionError> {
        if self.request_failed {
            return Err(RuntimeToolExecutionError::new(
                "approval request failed",
                Some(RuntimeToolPolicyErrorKind::ExecutionFailed(
                    "tool_approval_request_failed".to_string(),
                )),
            )
            .before_handler());
        }
        if self.confirmed {
            return Ok(());
        }
        Err(RuntimeToolExecutionError::new(
            "用户拒绝工具执行",
            Some(RuntimeToolPolicyErrorKind::PermissionDenied(
                "tool_approval_declined".to_string(),
            )),
        )
        .before_handler())
    }
}

pub fn approval_request_failed(metadata: Option<&Value>) -> bool {
    metadata
        .and_then(|metadata| metadata.get(APPROVAL_REQUEST_FAILED_METADATA_KEY))
        .and_then(Value::as_bool)
        == Some(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool_executor::{
        RuntimeToolExecutionFailure, RuntimeToolExecutionFailureKind, RuntimeToolExecutionOutcome,
    };
    use crate::tool_result_projection::{
        NormalizedToolOutput, TOOL_HANDLER_EXECUTED_METADATA_KEY, TOOL_OUTCOME_METADATA_KEY,
        TOOL_OUTCOME_REJECTED,
    };
    use serde_json::json;

    #[test]
    fn request_failure_is_an_execution_failure_even_with_confirmation() {
        for confirmed in [false, true] {
            let response: ExecutionApprovalResponse = serde_json::from_value(json!({
                "confirmed": confirmed,
                "decision": "allow_for_session",
                "requestFailed": true,
            }))
            .expect("typed response");
            let failure = RuntimeToolExecutionFailure::from_error(
                response.ensure_approved().expect_err("request failed"),
            );
            assert_eq!(
                failure.kind(),
                RuntimeToolExecutionFailureKind::ExecutionFailed
            );
            assert_eq!(failure.reason_code(), Some("tool_approval_request_failed"));
            assert!(!failure.handler_executed());
            let output = NormalizedToolOutput::from_execution_outcome(
                RuntimeToolExecutionOutcome::Error(failure),
                0,
            );
            assert_eq!(
                output.metadata.get(TOOL_HANDLER_EXECUTED_METADATA_KEY),
                Some(&json!(false))
            );
            assert!(!output.metadata.contains_key(TOOL_OUTCOME_METADATA_KEY));
        }
    }

    #[test]
    fn explicit_decline_retains_rejected_outcome() {
        let response: ExecutionApprovalResponse = serde_json::from_value(json!({
            "confirmed": false,
            "decision": "decline",
        }))
        .expect("explicit decline");
        let failure = RuntimeToolExecutionFailure::from_error(
            response.ensure_approved().expect_err("declined"),
        );
        let output = NormalizedToolOutput::from_execution_outcome(
            RuntimeToolExecutionOutcome::Error(failure),
            0,
        );
        assert_eq!(
            output.metadata.get(TOOL_OUTCOME_METADATA_KEY),
            Some(&json!(TOOL_OUTCOME_REJECTED))
        );
    }

    #[test]
    fn valid_confirmation_is_accepted_and_malformed_response_fails_to_decode() {
        let response: ExecutionApprovalResponse = serde_json::from_value(json!({
            "confirmed": true,
            "decision": "allow_for_session",
        }))
        .expect("explicit approval");
        response.ensure_approved().expect("approved");
        assert_eq!(response.decision.as_deref(), Some("allow_for_session"));
        for value in [
            json!({}),
            json!({"confirmed": "true"}),
            json!({"confirmed": true, "requestFailed": "false"}),
        ] {
            assert!(serde_json::from_value::<ExecutionApprovalResponse>(value).is_err());
        }
    }
}
