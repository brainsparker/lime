use super::*;
use crate::tool_executor::{
    RuntimeToolExecutionError, RuntimeToolExecutionFailure, RuntimeToolPolicyErrorKind,
};

#[test]
fn rejection_is_a_typed_pre_execution_fact() {
    for (kind, executed, expected) in [
        (
            RuntimeToolPolicyErrorKind::PermissionDenied("tool_approval_declined".to_owned()),
            false,
            Some("rejected"),
        ),
        (
            RuntimeToolPolicyErrorKind::PermissionDenied("policy_denied".to_owned()),
            false,
            Some("rejected"),
        ),
        (
            RuntimeToolPolicyErrorKind::PermissionDenied("process_access_denied".to_owned()),
            true,
            None,
        ),
        (
            RuntimeToolPolicyErrorKind::ExecutionFailed("tool_approval_wait_failed".to_owned()),
            false,
            None,
        ),
        (
            RuntimeToolPolicyErrorKind::ExecutionFailed("declined".to_owned()),
            true,
            None,
        ),
    ] {
        let mut error = RuntimeToolExecutionError::new("arbitrary output", Some(kind));
        if !executed {
            error = error.before_handler();
        }
        let output = NormalizedToolOutput::from_execution_outcome(
            RuntimeToolExecutionOutcome::Error(RuntimeToolExecutionFailure::from_error(error)),
            7,
        );
        assert_eq!(
            output
                .metadata
                .get(TOOL_OUTCOME_METADATA_KEY)
                .and_then(Value::as_str),
            expected,
            "metadata={:?}",
            output.metadata
        );
        assert_eq!(
            output.metadata[TOOL_HANDLER_EXECUTED_METADATA_KEY],
            executed
        );
        assert!(!output.success);
        assert_eq!(output.text, "arbitrary output");
        assert_eq!(output.error.as_deref(), Some("arbitrary output"));
    }
}
