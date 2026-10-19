use super::*;
use async_trait::async_trait;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tool_runtime::execution_process::live::{
    LiveExecutionOutputBatch, LiveExecutionOutputQuery, LiveExecutionRequest,
    RuntimeLiveExecutionGateway,
};
use tool_runtime::execution_process::{ExecutionProcessSnapshot, ExecutionProcessStatus};
use tool_runtime::tool_executor::{
    RuntimeToolExecutionContext, RuntimeToolExecutionContextInput, RuntimeToolExecutionIdentity,
};
use tool_runtime::tool_extension::RuntimeToolCaller;

#[derive(Default)]
struct SequentialExecGateway {
    starts: AtomicUsize,
    snapshots: Mutex<HashMap<String, ExecutionProcessSnapshot>>,
    commands: Mutex<Vec<String>>,
}

#[async_trait]
impl RuntimeLiveExecutionGateway for SequentialExecGateway {
    async fn wait_for_exit(
        &self,
        process_id: &str,
    ) -> Result<ExecutionProcessSnapshot, RuntimeToolExecutionError> {
        self.status(process_id)
    }

    async fn start_process(
        &self,
        _thread_id: &str,
        display_command: &str,
        request: LiveExecutionRequest,
    ) -> Result<ExecutionProcessSnapshot, RuntimeToolExecutionError> {
        let start = self.starts.fetch_add(1, Ordering::SeqCst);
        if start == 0 {
            tokio::time::sleep(Duration::from_millis(75)).await;
        }
        self.commands
            .lock()
            .expect("commands lock")
            .push(display_command.to_string());
        let snapshot = ExecutionProcessSnapshot {
            process_id: request.process_id.clone(),
            tool_id: request.tool_id,
            tool_name: request.tool_name,
            status: ExecutionProcessStatus::Exited,
            exit_code: Some(0),
            elapsed_ms: 1,
            output_bytes: 0,
            output_omitted_bytes: 0,
            output_truncated: false,
            retained_output: String::new(),
            failure: None,
        };
        self.snapshots
            .lock()
            .expect("snapshots lock")
            .insert(request.process_id, snapshot.clone());
        Ok(snapshot)
    }

    fn write_stdin(
        &self,
        _process_id: &str,
        _data: &[u8],
    ) -> Result<(), RuntimeToolExecutionError> {
        Ok(())
    }

    fn terminate(
        &self,
        process_id: &str,
    ) -> Result<ExecutionProcessSnapshot, RuntimeToolExecutionError> {
        self.status(process_id)
    }

    fn status(
        &self,
        process_id: &str,
    ) -> Result<ExecutionProcessSnapshot, RuntimeToolExecutionError> {
        self.snapshots
            .lock()
            .expect("snapshots lock")
            .get(process_id)
            .cloned()
            .ok_or_else(|| RuntimeToolExecutionError::new("missing process", None))
    }

    fn drain_output(
        &self,
        query: LiveExecutionOutputQuery,
    ) -> Result<LiveExecutionOutputBatch, RuntimeToolExecutionError> {
        let process_id = query.process_id.unwrap_or_default();
        if !self
            .snapshots
            .lock()
            .expect("snapshots lock")
            .contains_key(&process_id)
        {
            return Err(RuntimeToolExecutionError::new("missing process", None));
        }
        Ok(LiveExecutionOutputBatch {
            deltas: Vec::new(),
            next_sequence: query.after_sequence,
        })
    }
}

fn executor(state: AgentRuntimeState) -> CurrentTurnToolExecutor {
    let (event_sender, _event_receiver) = tokio::sync::mpsc::unbounded_channel();
    CurrentTurnToolExecutor {
        state,
        policy: crate::request_tool_policy::resolve_request_tool_policy(None),
        event_sender,
        thread_id: ThreadId::new("thread-1"),
        mcp_snapshot: tool_runtime::mcp_connection::McpStepSnapshot::empty(
            RuntimeToolCaller::assistant(),
        ),
        deferred_tools: mcp_step_snapshot::DeferredToolSelections::default(),
        agent_control_gateway: None,
        pending_input: None,
        dynamic_tool_routes: mcp_step_snapshot::DynamicToolRoutes::default(),
        async_user_input_enabled: false,
    }
}

fn context(call_id: &str) -> RuntimeToolExecutionContext {
    RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
        working_directory: std::env::current_dir().expect("current directory"),
        session_id: "session-1".to_string(),
        cancel_token: None,
        workspace_sandbox: None,
    })
    .with_tool_identity(RuntimeToolExecutionIdentity::new(call_id, "turn-1"))
}

#[tokio::test]
async fn current_executor_starts_short_command_after_delayed_terminal_command() {
    let state = AgentRuntimeState::new();
    let gateway = Arc::new(SequentialExecGateway::default());
    state
        .install_live_execution_process_gateway(gateway.clone())
        .await
        .expect("install live gateway");
    let executor = executor(state);
    let turn_context = tool_runtime::tool_executor::RuntimeToolTurnContext {
        approval_policy: Some("never".to_string()),
        sandbox_policy: Some("danger-full-access".to_string()),
        ..Default::default()
    };
    let first_params = serde_json::json!({
        "cmd": "cargo test --package oxvg_optimiser",
        "login": false,
        "yield_time_ms": 250
    });
    let first_context = context("call-1");
    let first = executor
        .execute(RuntimeToolExecutionRequest {
            tool_name: tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
            params: &first_params,
            context: &first_context,
            turn_context: Some(&turn_context),
        })
        .await
        .expect("delayed command should complete");
    assert!(first.success);

    let second_params = serde_json::json!({
        "cmd": "cat crates/oxvg_optimiser/src/utils/structural_selector.rs",
        "login": false,
        "yield_time_ms": 250
    });
    let second_context = context("call-2");
    let second = tokio::time::timeout(
        Duration::from_secs(2),
        executor.execute(RuntimeToolExecutionRequest {
            tool_name: tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME,
            params: &second_params,
            context: &second_context,
            turn_context: Some(&turn_context),
        }),
    )
    .await
    .expect("second command must not hang")
    .expect("second command should complete");

    assert!(second.success);
    assert_eq!(gateway.starts.load(Ordering::SeqCst), 2);
    assert_eq!(
        gateway.commands.lock().expect("commands lock").as_slice(),
        [
            "cargo test --package oxvg_optimiser",
            "cat crates/oxvg_optimiser/src/utils/structural_selector.rs",
        ]
    );
}
