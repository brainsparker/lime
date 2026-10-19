use super::*;
use std::collections::HashMap;
use tool_runtime::execution_process::live::{LiveExecutionOutputQuery, LiveExecutionRequest};
use tool_runtime::execution_process::ExecutionProcessStatus;

#[cfg(unix)]
#[tokio::test]
async fn wait_for_exit_retains_final_partial_output_from_real_process() {
    let server = ExecutionProcessServer::default();
    let workspace = tempfile::tempdir().expect("isolated process workspace");
    server
        .start_thread_process(
            "terminal-thread",
            "printf final-partial",
            LiveExecutionRequest {
                process_id: "terminal-process".to_string(),
                tool_id: "terminal-call".to_string(),
                tool_name: "exec_command".to_string(),
                environment_id: "local".to_string(),
                command: vec![
                    "/bin/sh".to_string(),
                    "-c".to_string(),
                    "printf final-partial".to_string(),
                ],
                working_directory: workspace.path().to_path_buf(),
                tty: false,
                approval_policy: Some("never".to_string()),
                sandbox_policy: Some("danger-full-access".to_string()),
                runtime_metadata: None,
                env: HashMap::new(),
                attempt: None,
            },
        )
        .await
        .expect("real process starts");
    let snapshot = tokio::time::timeout(
        Duration::from_secs(5),
        server.wait_for_exit("terminal-process"),
    )
    .await
    .expect("supervisor completion deadline")
    .expect("final supervisor snapshot");
    assert_eq!(snapshot.status, ExecutionProcessStatus::Exited);
    assert_eq!(snapshot.exit_code, Some(0));
    assert_eq!(snapshot.retained_output, "final-partial");
    let output = server
        .drain_output(LiveExecutionOutputQuery {
            process_id: Some(snapshot.process_id),
            ..Default::default()
        })
        .expect("final output already drained by supervisor");
    assert_eq!(
        output
            .deltas
            .iter()
            .map(|delta| delta.delta.as_str())
            .collect::<String>(),
        "final-partial"
    );
}

#[tokio::test]
async fn wait_for_exit_rejects_unknown_process() {
    let server = ExecutionProcessServer::default();
    assert!(matches!(server.wait_for_exit("missing-process").await,
        Err(ExecutionProcessError::ProcessNotFound(id)) if id == "missing-process"));
}

#[cfg(unix)]
#[tokio::test]
async fn background_terminal_list_uses_canonical_item_identity_without_changing_tool_identity() {
    let server = ExecutionProcessServer::default();
    let workspace = tempfile::tempdir().expect("isolated process workspace");
    for call_id in ["terminal-call", "item_prefixed-call"] {
        let snapshot = server
            .start_thread_process(
                "terminal-thread",
                "read value",
                LiveExecutionRequest {
                    process_id: call_id.to_string(),
                    tool_id: call_id.to_string(),
                    tool_name: "exec_command".to_string(),
                    environment_id: "local".to_string(),
                    command: vec![
                        "/bin/sh".to_string(),
                        "-c".to_string(),
                        "read value".to_string(),
                    ],
                    working_directory: workspace.path().to_path_buf(),
                    tty: false,
                    approval_policy: Some("never".to_string()),
                    sandbox_policy: Some("danger-full-access".to_string()),
                    runtime_metadata: None,
                    env: HashMap::new(),
                    attempt: None,
                },
            )
            .await
            .expect("real background process starts");
        assert_eq!(snapshot.tool_id, call_id);
    }
    let terminals = server
        .list_background_terminals("terminal-thread")
        .expect("background list");
    assert_eq!(
        terminals
            .iter()
            .map(|terminal| terminal.item_id.as_str())
            .collect::<Vec<_>>(),
        ["item_terminal-call", "item_prefixed-call"]
    );
    server
        .clean_background_terminals("terminal-thread")
        .expect("stop both commands");
    assert!(server
        .list_background_terminals("terminal-thread")
        .expect("cleaned list")
        .is_empty());
}

#[derive(Default)]
struct CommandResults(std::sync::Mutex<Vec<tool_runtime::tool_lifecycle::ToolLifecycleEvent>>);

impl tool_runtime::tool_lifecycle::ToolLifecycleEmitter for CommandResults {
    fn emit<'a>(
        &'a self,
        event: tool_runtime::tool_lifecycle::ToolLifecycleEvent,
    ) -> tool_runtime::tool_lifecycle::ToolLifecycleEmissionFuture<'a> {
        Box::pin(async move { self.0.lock().expect("command results lock").push(event) })
    }
}

#[cfg(unix)]
#[tokio::test]
async fn background_stop_keeps_exit_observer_until_original_command_terminal_is_published() {
    use tool_runtime::unified_exec::{
        execute_runtime_unified_exec_tool, RuntimeUnifiedExecToolRequest,
    };
    let server = std::sync::Arc::new(ExecutionProcessServer::default());
    let workspace = tempfile::tempdir().expect("isolated command workspace");
    for stop_all in [false, true] {
        let results = std::sync::Arc::new(CommandResults::default());
        let call_id = if stop_all {
            "stop-all-call"
        } else {
            "stop-one-call"
        };
        let params = serde_json::json!({
            "cmd": "printf ready; read value",
            "login": false,
            "yield_time_ms": 250,
            "sandbox_permissions": "require_escalated",
            "justification": "verify real background termination lifecycle"
        });
        let running = execute_runtime_unified_exec_tool(
            server.clone(),
            RuntimeUnifiedExecToolRequest {
                tool_name: "exec_command",
                params: &params,
                thread_id: "stop-thread",
                environment_id: "local",
                working_directory: workspace.path().to_path_buf(),
                environment: HashMap::new(),
                tool_call_id: call_id.to_string(),
                turn_id: "completed-turn".to_string(),
                cancel_token: None,
                turn_context: None,
                attempt: None,
                output_sink: Some(results.clone()),
            },
        )
        .await
        .expect("real command yields an active session");
        assert!(running.metadata["session_id"].is_number());
        let terminals = server
            .list_background_terminals("stop-thread")
            .expect("running list");
        assert_eq!(terminals.len(), 1);
        if stop_all {
            server
                .clean_background_terminals("stop-thread")
                .expect("stop all");
        } else {
            assert!(server
                .terminate_background_terminal(
                    "stop-thread",
                    terminals[0].process_id.parse().unwrap()
                )
                .expect("stop one"));
        }
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if results
                    .0
                    .lock()
                    .expect("command results")
                    .iter()
                    .any(|event| {
                        event
                            .output
                            .as_ref()
                            .is_some_and(|output| output.metadata["session_id"].is_null())
                    })
                {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("exit observer publishes the terminal result");
        let events = results.0.lock().expect("command results");
        let terminals = events
            .iter()
            .filter(|event| {
                event
                    .output
                    .as_ref()
                    .is_some_and(|output| output.metadata["session_id"].is_null())
            })
            .collect::<Vec<_>>();
        assert_eq!(terminals.len(), 1);
        assert_eq!(terminals[0].call_id, call_id);
        assert_eq!(terminals[0].turn_id, "completed-turn");
        assert_eq!(
            terminals[0].output.as_ref().unwrap().metadata["command_output"],
            "ready"
        );
    }
}
