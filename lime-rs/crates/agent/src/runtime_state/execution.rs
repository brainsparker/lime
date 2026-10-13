use super::AgentRuntimeState;
use tool_runtime::tool_executor::RuntimeToolExecutionError;

impl AgentRuntimeState {
    pub async fn terminate_all_processes(
        &self,
        thread_id: &str,
    ) -> Result<(), RuntimeToolExecutionError> {
        if let Some(gateway) = self.live_execution_process_gateway().await {
            tool_runtime::unified_exec::terminate_all_processes(gateway.as_ref(), thread_id)
                .await?;
        }
        Ok(())
    }

    pub async fn cancel_turn_processes(
        &self,
        thread_id: &str,
        turn_id: &str,
    ) -> Result<(), RuntimeToolExecutionError> {
        if let Some(gateway) = self.live_execution_process_gateway().await {
            tool_runtime::unified_exec::cancel_turn(gateway.as_ref(), thread_id, turn_id).await?;
        }
        Ok(())
    }
}
