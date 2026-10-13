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
