use super::{ExecutionProcessError, ExecutionProcessServer, ExecutionProcessSnapshot};
use std::time::Duration;

#[cfg(test)]
mod tests;

impl ExecutionProcessServer {
    pub async fn wait_for_exit(
        &self,
        process_id: &str,
    ) -> Result<ExecutionProcessSnapshot, ExecutionProcessError> {
        loop {
            {
                let state = self.inner.lock().map_err(|_| ExecutionProcessError::Lock)?;
                let entry = state.processes.get(process_id).ok_or_else(|| {
                    ExecutionProcessError::ProcessNotFound(process_id.to_string())
                })?;
                if let Some(snapshot) = entry.final_snapshot.as_ref() {
                    return Ok(snapshot.clone());
                }
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
    }
}
