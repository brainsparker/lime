use super::*;

fn command_item_event(
    call_id: &str,
    command: &str,
    status: ItemStatus,
    output: Option<&str>,
    exit_code: Option<i32>,
    metadata: Value,
) -> RuntimeAgentEvent {
    let payload = ThreadItemPayload::Command {
        command: command.to_string(),
        cwd: Some("/workspace".to_string()),
        output: output.map(str::to_string),
        exit_code,
    };
    let item = ThreadItem {
        session_id: SessionId::new("session-test"),
        thread_id: ThreadId::new("thread-test"),
        turn_id: TurnId::new("turn-test"),
        item_id: ItemId::new(call_id),
        sequence: 1,
        ordinal: 1,
        created_at_ms: 1,
        updated_at_ms: 2,
        completed_at_ms: status.is_terminal().then_some(2),
        kind: payload.kind(),
        status,
        payload,
        metadata,
    };
    if status.is_terminal() {
        RuntimeAgentEvent::ItemCompleted { item }
    } else {
        RuntimeAgentEvent::ItemUpdated { item }
    }
}

fn command_item_started(call_id: &str, command: &str) -> RuntimeAgentEvent {
    let payload = ThreadItemPayload::Command {
        command: command.to_string(),
        cwd: Some("/workspace".to_string()),
        output: None,
        exit_code: None,
    };
    RuntimeAgentEvent::ItemStarted {
        item: ThreadItem {
            session_id: SessionId::new("session-test"),
            thread_id: ThreadId::new("thread-test"),
            turn_id: TurnId::new("turn-test"),
            item_id: ItemId::new(call_id),
            sequence: 1,
            ordinal: 1,
            created_at_ms: 1,
            updated_at_ms: 2,
            completed_at_ms: None,
            kind: payload.kind(),
            status: ItemStatus::InProgress,
            payload,
            metadata: json!({}),
        },
    }
}

#[test]
fn unified_exec_command_items_only_mirror_output_and_test_lifecycle() {
    let mut mirror = CodingEventMirror::default();
    let command = "cargo test -p app-server coding_events";

    let started = mirror.process_event(&command_item_started("exec-call", command));
    let updated = mirror.process_event(&command_item_event(
        "exec-call",
        command,
        ItemStatus::InProgress,
        Some("running tests\n"),
        None,
        json!({
            "exec_command_call_id": "exec-call",
            "processId": "unified-exec-1",
            "executionProcessStatus": "running",
            "executionSurface": "unified_exec",
            "outputBytes": 14,
            "outputOmittedBytes": 0,
            "outputTruncated": false,
            "stdinWritable": true
        }),
    ));
    let completed = mirror.process_event(&command_item_event(
        "exec-call",
        command,
        ItemStatus::Completed,
        Some("all tests passed\n"),
        Some(0),
        json!({
            "exec_command_call_id": "exec-call",
            "processId": "unified-exec-1",
            "executionProcessStatus": "exited",
            "executionSurface": "unified_exec",
            "outputBytes": 31,
            "outputOmittedBytes": 0,
            "outputTruncated": false,
            "stdinWritable": false,
            "exit_code": 0
        }),
    ));

    let event_types = started
        .after_raw
        .iter()
        .chain(updated.after_raw.iter())
        .chain(completed.after_raw.iter())
        .map(|event| event.event_type.clone())
        .collect::<Vec<_>>();
    assert_eq!(
        event_types,
        vec!["test.started", "command.output", "test.completed"]
    );
    assert!(completed.before_raw.is_empty());
    for event in started
        .after_raw
        .iter()
        .chain(updated.after_raw.iter())
        .chain(completed.after_raw.iter())
        .filter(|event| event.event_type.starts_with("command."))
    {
        assert_eq!(event.payload["commandId"], "exec-call");
    }
}

#[test]
fn command_mirror_does_not_synthesize_canonical_lifecycle() {
    let mut mirror = CodingEventMirror::default();
    let completed = mirror.process_event(&command_item_event(
        "exec-call-cold",
        "printf done",
        ItemStatus::Completed,
        Some("done\n"),
        Some(0),
        json!({
            "exec_command_call_id": "exec-call-cold",
            "processId": "unified-exec-cold",
            "executionProcessStatus": "exited",
            "executionSurface": "unified_exec",
            "outputBytes": 5,
            "outputOmittedBytes": 0,
            "outputTruncated": false,
            "stdinWritable": false
        }),
    ));

    let event_types = completed
        .before_raw
        .iter()
        .map(|event| event.event_type.clone())
        .collect::<Vec<_>>();
    assert_eq!(event_types, vec!["command.output"]);
    assert!(completed.after_raw.is_empty());
    assert!(completed
        .after_raw
        .iter()
        .all(|event| event.payload["commandId"] == "exec-call-cold"));
}

#[test]
fn canceled_command_item_projects_canceled_test_result() {
    let mut mirror = CodingEventMirror::default();
    let _ = mirror.process_event(&command_item_started(
        "exec-call-canceled",
        "cargo test -p app-server",
    ));
    let canceled = mirror.process_event(&command_item_event(
        "exec-call-canceled",
        "cargo test -p app-server",
        ItemStatus::Cancelled,
        Some("interrupted\n"),
        None,
        json!({
            "exec_command_call_id": "exec-call-canceled",
            "processId": "unified-exec-canceled",
            "executionProcessStatus": "terminated",
            "executionSurface": "unified_exec",
            "tool_outcome": "aborted",
            "stdinWritable": false
        }),
    ));

    assert_eq!(canceled.before_raw[0].event_type, "command.output");
    assert!(canceled
        .after_raw
        .iter()
        .all(|event| event.event_type != "command.exited"));
    assert_eq!(
        canceled
            .after_raw
            .iter()
            .find(|event| event.event_type == "test.completed")
            .expect("test.completed")
            .payload["result"],
        "canceled"
    );
}

#[test]
fn shell_tool_events_emit_command_and_test_lifecycle() {
    let mut mirror = CodingEventMirror::default();

    let started = mirror.process_event(&tool_started(
        "Bash",
        "tool-1",
        Some(json!({ "command": "cargo test -p app-server coding_events" })),
    ));
    let output = mirror.process_event(&RuntimeAgentEvent::ToolOutputDelta {
        tool_id: "tool-1".to_string(),
        delta: "running tests".to_string(),
        output_kind: Some("stdout".to_string()),
        metadata: None,
    });
    let ended = mirror.process_event(&tool_completed(
        "tool-1",
        success_result(
            "ok",
            HashMap::from([
                ("exit_code".to_string(), json!(0)),
                (
                    "command".to_string(),
                    json!("cargo test -p app-server coding_events"),
                ),
                ("cwd".to_string(), json!("/workspace")),
                ("shell".to_string(), json!("bash")),
            ]),
        ),
    ));

    let event_types = started
        .after_raw
        .into_iter()
        .chain(output.after_raw)
        .chain(ended.after_raw)
        .map(|event| event.event_type)
        .collect::<Vec<_>>();
    assert_eq!(
        event_types,
        vec![
            "command.started",
            "test.started",
            "command.output",
            "command.exited",
            "test.completed"
        ]
    );
}

#[test]
fn shell_tool_output_delta_preserves_process_lifecycle_metadata() {
    let mut mirror = CodingEventMirror::default();

    let _ = mirror.process_event(&tool_started(
        "Bash",
        "tool-process",
        Some(json!({ "command": "npm test" })),
    ));
    let output = mirror.process_event(&RuntimeAgentEvent::ToolOutputDelta {
        tool_id: "tool-process".to_string(),
        delta: "running".to_string(),
        output_kind: Some("stdout".to_string()),
        metadata: Some(HashMap::from([
            ("processId".to_string(), json!("process-tool-process")),
            ("executionProcessStatus".to_string(), json!("running")),
            ("outputBytes".to_string(), json!(7)),
            ("outputOmittedBytes".to_string(), json!(0)),
            ("outputTruncated".to_string(), json!(false)),
        ])),
    });

    assert_eq!(output.after_raw.len(), 1);
    assert_eq!(output.after_raw[0].event_type, "command.output");
    assert_eq!(
        output.after_raw[0].payload["metadata"]["processId"].as_str(),
        Some("process-tool-process")
    );
    assert_eq!(
        output.after_raw[0].payload["metadata"]["executionProcessStatus"].as_str(),
        Some("running")
    );
    assert_eq!(
        output.after_raw[0].payload["metadata"]["outputBytes"].as_u64(),
        Some(7)
    );
    assert_eq!(
        output.after_raw[0].payload["delta"].as_str(),
        Some("running")
    );
}

#[test]
fn canonical_command_completion_emits_redacted_terminal_interaction_before_raw_item() {
    let mut mirror = CodingEventMirror::default();
    let payload = ThreadItemPayload::Command {
        command: "printf ready".to_string(),
        cwd: Some("/workspace".to_string()),
        output: Some("ready".to_string()),
        exit_code: Some(0),
    };
    let item = ThreadItem {
        session_id: SessionId::new("session-test"),
        thread_id: ThreadId::new("thread-test"),
        turn_id: TurnId::new("turn-test"),
        item_id: ItemId::new("exec-call"),
        sequence: 2,
        ordinal: 1,
        created_at_ms: 1,
        updated_at_ms: 2,
        completed_at_ms: Some(2),
        kind: payload.kind(),
        status: ItemStatus::Completed,
        payload,
        metadata: json!({
            "exec_command_call_id": "exec-call",
            "terminalInteractions": [{
                "processId": "process-7",
                "stdin": "sent 9 chars"
            }]
        }),
    };

    let output = mirror.process_event(&RuntimeAgentEvent::ItemCompleted { item });

    assert_eq!(output.before_raw.len(), 2);
    assert_eq!(output.before_raw[0].event_type, "command.output");
    assert_eq!(
        output
            .after_raw
            .iter()
            .map(|event| event.event_type.as_str())
            .collect::<Vec<_>>(),
        Vec::<&str>::new()
    );
    assert_eq!(output.before_raw[1].event_type, "command.interaction");
    assert_eq!(output.before_raw[1].payload["commandId"], "exec-call");
    assert_eq!(output.before_raw[1].payload["processId"], "process-7");
    assert_eq!(output.before_raw[1].payload["stdin"], "sent 9 chars");
    assert!(!output.before_raw[1]
        .payload
        .to_string()
        .contains("continue"));
}

#[test]
fn silent_command_completion_has_no_fake_output_after_terminal_item() {
    let mut mirror = CodingEventMirror::default();
    mirror.process_event(&command_item_started("silent-call", "true"));
    let completed = mirror.process_event(&command_item_event(
        "silent-call",
        "true",
        ItemStatus::Completed,
        None,
        Some(0),
        json!({"processId": "silent-process", "executionProcessStatus": "exited"}),
    ));
    assert!(completed.before_raw.is_empty());
    assert!(completed.after_raw.is_empty());
}

#[test]
fn shell_tool_metadata_only_delta_updates_process_lifecycle_without_consuming_output() {
    let mut mirror = CodingEventMirror::default();

    let _ = mirror.process_event(&tool_started(
        "Bash",
        "tool-process-start",
        Some(json!({ "command": "sleep 1 && echo done" })),
    ));
    let process_update = mirror.process_event(&RuntimeAgentEvent::ToolOutputDelta {
        tool_id: "tool-process-start".to_string(),
        delta: String::new(),
        output_kind: Some("process".to_string()),
        metadata: Some(HashMap::from([
            ("processId".to_string(), json!("process-tool-process-start")),
            ("executionProcessStatus".to_string(), json!("running")),
            (
                "executionProcessControlStatus".to_string(),
                json!("registered"),
            ),
            ("executionSurface".to_string(), json!("live_process")),
            ("stdinWritable".to_string(), json!(true)),
        ])),
    });
    let ended = mirror.process_event(&tool_completed(
        "tool-process-start",
        success_result(
            "done",
            HashMap::from([
                ("exit_code".to_string(), json!(0)),
                ("command".to_string(), json!("sleep 1 && echo done")),
            ]),
        ),
    ));

    assert_eq!(process_update.after_raw.len(), 1);
    assert_eq!(process_update.after_raw[0].event_type, "command.output");
    assert_eq!(
        process_update.after_raw[0].payload["metadata"]["processId"].as_str(),
        Some("process-tool-process-start")
    );
    assert_eq!(
        process_update.after_raw[0].payload["metadata"]["executionProcessStatus"].as_str(),
        Some("running")
    );
    assert_eq!(
        process_update.after_raw[0].payload["metadata"]["executionProcessControlStatus"].as_str(),
        Some("registered")
    );
    assert_eq!(
        process_update.after_raw[0].payload["metadata"]["stdinWritable"].as_bool(),
        Some(true)
    );
    assert!(process_update.after_raw[0].payload.get("preview").is_none());
    assert!(process_update.after_raw[0].payload.get("delta").is_none());
    assert_eq!(ended.after_raw[0].event_type, "command.output");
    assert_eq!(ended.after_raw[0].payload["delta"].as_str(), Some("done"));
    assert_eq!(ended.after_raw[0].payload["preview"].as_str(), Some("done"));
}

#[test]
fn shell_tool_result_emits_output_when_stream_delta_was_absent() {
    let mut mirror = CodingEventMirror::default();
    let _ = mirror.process_event(&tool_started(
        "PowerShellTool",
        "tool-2",
        Some(json!({ "command": "Write-Output ok" })),
    ));

    let ended = mirror.process_event(&tool_completed(
        "tool-2",
        success_result(
            "ok",
            HashMap::from([
                ("exit_code".to_string(), json!(0)),
                ("command".to_string(), json!("Write-Output ok")),
                ("execution_surface".to_string(), json!("embedded")),
                ("outputBytes".to_string(), json!(2)),
                ("outputOmittedBytes".to_string(), json!(0)),
                ("outputTruncated".to_string(), json!(false)),
                ("stdout_bytes".to_string(), json!(2)),
                ("stderr_bytes".to_string(), json!(0)),
            ]),
        ),
    ));

    assert_eq!(ended.after_raw[0].event_type, "command.output");
    assert_eq!(ended.after_raw[1].event_type, "command.exited");
    assert_eq!(ended.after_raw[0].payload["delta"].as_str(), Some("ok"));
    assert!(ended.after_raw[0].payload["outputRef"]
        .as_str()
        .is_some_and(|value| value.starts_with("output:command:")));
    assert_eq!(
        ended.after_raw[0].payload["processId"].as_str(),
        Some("process-tool-2")
    );
    assert_eq!(
        ended.after_raw[0].payload["executionProcessStatus"].as_str(),
        Some("exited")
    );
    assert_eq!(
        ended.after_raw[0].payload["executionSurface"].as_str(),
        Some("embedded")
    );
    assert_eq!(ended.after_raw[0].payload["outputBytes"].as_u64(), Some(2));
    assert_eq!(
        ended.after_raw[0].payload["metadata"]["stdoutBytes"].as_u64(),
        Some(2)
    );
    assert_eq!(
        ended.after_raw[1].payload["processId"].as_str(),
        Some("process-tool-2")
    );
    assert_eq!(
        ended.after_raw[1].payload["executionProcessStatus"].as_str(),
        Some("exited")
    );
    assert_eq!(
        ended.after_raw[1].payload["outputTruncated"].as_bool(),
        Some(false)
    );
}
