use super::*;

pub(super) struct CurrentToolAttemptRunner<'a> {
    pub(super) executor: &'a CurrentTurnToolExecutor,
    pub(super) request: RuntimeToolExecutionRequest<'a>,
}

impl RuntimeToolAttemptRunner for CurrentToolAttemptRunner<'_> {
    fn handles_cancellation(&self) -> bool {
        tool_runtime::unified_exec::is_unified_exec_tool_name(self.request.tool_name)
    }

    fn run<'a>(&'a self, attempt: RuntimeToolExecutionAttempt) -> RuntimeToolAttemptFuture<'a> {
        Box::pin(async move {
            let mut turn_context = self.request.turn_context.cloned();
            if attempt.approval_source() != RuntimeToolApprovalSource::Config {
                turn_context
                    .get_or_insert_with(Default::default)
                    .metadata
                    .insert(
                        TOOL_APPROVAL_GRANTED_METADATA_KEY.to_string(),
                        Value::Bool(true),
                    );
            }
            let context = self.request.context.clone().with_execution_attempt(attempt);
            execute_current_tool_attempt(
                self.executor,
                RuntimeToolExecutionRequest {
                    tool_name: self.request.tool_name,
                    params: self.request.params,
                    context: &context,
                    turn_context: turn_context.as_ref().or(self.request.turn_context),
                },
            )
            .await
        })
    }
}
