use super::RuntimeToolStepSnapshot;
use model_provider::current_client::CurrentProviderContent;
use model_provider::provider_stream::RuntimeReplyModelRequestPolicy;
use std::sync::Arc;
use tool_runtime::tool_lifecycle::{
    CodeCellTraceEvent, CommandStartEvent, ToolLifecycleEmissionFuture, ToolLifecycleEmitter,
    ToolLifecycleEvent, ToolOutputDeltaEvent,
};

pub(super) fn capture(
    snapshot: &mut RuntimeToolStepSnapshot,
    policy: Option<&RuntimeReplyModelRequestPolicy>,
) {
    snapshot.history_token_limit = Some(
        policy
            .and_then(|policy| policy.truncation)
            .unwrap_or_default()
            .with_serialization_allowance()
            .token_budget(),
    );
}

pub(super) fn capture_outputs(content: &mut [CurrentProviderContent], limit: Option<usize>) {
    for part in content {
        if let CurrentProviderContent::ToolResult(result)
        | CurrentProviderContent::CustomToolResult(result) = part
        {
            result.history_token_limit = result.history_token_limit.or(limit);
        }
    }
}

pub(super) fn emitter(
    inner: Arc<dyn ToolLifecycleEmitter>,
    limit: Option<usize>,
) -> Arc<dyn ToolLifecycleEmitter> {
    Arc::new(HistoryBudgetEmitter { inner, limit })
}

struct HistoryBudgetEmitter {
    inner: Arc<dyn ToolLifecycleEmitter>,
    limit: Option<usize>,
}

impl HistoryBudgetEmitter {
    fn annotate(&self, mut event: ToolLifecycleEvent) -> ToolLifecycleEvent {
        if let Some(output) = event.output.as_mut() {
            output.history_token_limit = output.history_token_limit.or(self.limit);
        }
        event
    }
}

impl ToolLifecycleEmitter for HistoryBudgetEmitter {
    fn emit<'a>(&'a self, event: ToolLifecycleEvent) -> ToolLifecycleEmissionFuture<'a> {
        self.inner.emit(self.annotate(event))
    }

    fn emit_command_result<'a>(
        &'a self,
        event: ToolLifecycleEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        self.inner.emit_command_result(self.annotate(event))
    }

    fn command_error(&self) -> Option<String> {
        self.inner.command_error()
    }

    fn emit_command_start<'a>(
        &'a self,
        event: CommandStartEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        self.inner.emit_command_start(event)
    }

    fn emit_code_cell_trace<'a>(
        &'a self,
        event: CodeCellTraceEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        self.inner.emit_code_cell_trace(event)
    }

    fn emit_output_delta<'a>(
        &'a self,
        event: ToolOutputDeltaEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        self.inner.emit_output_delta(event)
    }
}

#[cfg(test)]
mod tests;
