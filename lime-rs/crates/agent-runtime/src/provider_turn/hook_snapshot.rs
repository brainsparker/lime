use super::RuntimeToolStepSnapshot;
use code_mode_protocol::{RuntimeToolExposure, RuntimeToolIdentity, RuntimeToolSnapshot};
use std::sync::Arc;
use tool_runtime::hook_gated_executor::hook_gated_executor;
use tool_runtime::tool_executor::RuntimeToolExecutorHandle;
use tool_runtime::turn_snapshot::RuntimeTurnSnapshot;

/// Applies one immutable hook snapshot to the tool executor. The caller may retain the same
/// snapshot for the terminal Stop hook evaluation so a sampling step cannot observe two
/// different hook registries.
pub(super) fn apply_snapshot(
    tool_step: &mut RuntimeToolStepSnapshot,
    hook_step: super::RuntimeHookStepSnapshot,
) -> Result<(), String> {
    if hook_step.hooks.is_empty() {
        return Ok(());
    }
    let tools = tool_step
        .definitions
        .iter()
        .map(|definition| {
            RuntimeToolSnapshot::new(
                RuntimeToolIdentity::plain(&definition.name),
                definition.clone(),
                RuntimeToolExposure::Direct,
                false,
                true,
            )
        })
        .collect();
    let snapshot = RuntimeTurnSnapshot::try_new(tools, hook_step.hooks)
        .map_err(|error| format!("Invalid provider step Hook snapshot: {error:?}"))?;
    let gated = hook_gated_executor(
        tool_step.executor.inner_executor(),
        Arc::new(snapshot),
        hook_step.reporter,
    );
    tool_step.executor = RuntimeToolExecutorHandle::new(gated);
    Ok(())
}
