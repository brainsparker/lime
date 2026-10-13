use super::*;
use serde_json::json;

fn event(event_id: &str, event_type: &str, payload: Value) -> AgentEvent {
    let payload = if matches!(event_type, "item.started" | "item.completed") {
        canonical_tool_item_payload(event_type, payload)
    } else {
        payload
    };
    AgentEvent {
        event_id: event_id.to_string(),
        sequence: 1,
        session_id: "sess_test".to_string(),
        thread_id: Some("thread_test".to_string()),
        turn_id: Some("turn_test".to_string()),
        event_type: event_type.to_string(),
        timestamp: "2026-06-12T00:00:00.000Z".to_string(),
        payload,
    }
}

fn canonical_tool_item_payload(event_type: &str, payload: Value) -> Value {
    let call_id = payload
        .get("toolCallId")
        .and_then(Value::as_str)
        .unwrap_or("tool_1");
    let status = if event_type == "item.started" {
        "inProgress"
    } else {
        "completed"
    };
    json!({
        "item": {
            "sessionId": "sess_test",
            "threadId": "thread_test",
            "turnId": "turn_test",
            "itemId": format!("item_{call_id}"),
            "sequence": 1,
            "ordinal": 1,
            "createdAtMs": 1,
            "updatedAtMs": 1,
            "completedAtMs": (event_type == "item.completed").then_some(1),
            "kind": "tool",
            "status": status,
            "payload": {
                "type": "tool",
                "call_id": call_id,
                "name": "Bash",
                "arguments": [],
                "output": (event_type == "item.completed").then(|| json!({"text": "ok"})),
            },
            "metadata": {},
        }
    })
}

#[test]
fn accepts_paired_tool_sequence() {
    let existing = vec![event(
        "evt_tool_start",
        "item.started",
        json!({ "toolCallId": "tool_1" }),
    )];
    let candidate = event(
        "evt_tool_result",
        "item.completed",
        json!({ "toolCallId": "tool_1" }),
    );

    validate_agent_event_sequence(&existing, &candidate).expect("valid sequence");
}

#[test]
fn rejects_tool_item_completed_without_start() {
    let candidate = event(
        "evt_tool_result",
        "item.completed",
        json!({ "toolCallId": "tool_1" }),
    );

    let error = validate_agent_event_sequence(&[], &candidate)
        .expect_err("tool result without start should fail");
    assert!(error.contains("tool_item_completed_without_start"));
}

#[test]
fn rejects_unclosed_tool_at_terminal_turn() {
    let existing = vec![event(
        "evt_tool_start",
        "item.started",
        json!({ "toolCallId": "tool_1" }),
    )];
    let candidate = event("evt_turn_done", "turn.completed", json!({}));

    let error = validate_agent_event_sequence(&existing, &candidate)
        .expect_err("terminal turn should close active tools");
    assert!(error.contains("tool_unclosed_at_turn_end"));
}

#[test]
fn accepts_message_delta_completed_stream() {
    let existing = vec![event(
        "evt_message_delta",
        "message.delta",
        json!({ "text": "hello" }),
    )];
    let candidate = event("evt_turn_done", "turn.completed", json!({}));

    validate_agent_event_sequence(&existing, &candidate)
        .expect("message.delta can be closed by turn.completed");
}

#[test]
fn accepts_action_cancel_and_expiry_as_action_terminal_events() {
    for event_type in ["action.cancelled", "action.canceled", "action.expired"] {
        let existing = vec![event(
            "evt_action_required",
            "action.required",
            json!({ "actionId": "action_1" }),
        )];
        let candidate = event(
            "evt_action_terminal",
            event_type,
            json!({ "actionId": "action_1" }),
        );

        validate_agent_event_sequence(&existing, &candidate)
            .unwrap_or_else(|error| panic!("{event_type} should close action: {error}"));
    }
}

#[test]
fn rejects_action_cancel_without_required_event() {
    let candidate = event(
        "evt_action_cancel",
        "action.canceled",
        json!({ "actionId": "action_1" }),
    );

    let error = validate_agent_event_sequence(&[], &candidate)
        .expect_err("action cancel without request should fail");
    assert!(error.contains("action_resolved_without_request"));
}

#[test]
fn legacy_final_done_does_not_close_current_turn_stream() {
    let existing = vec![event(
        "evt_message_delta",
        "message.delta",
        json!({ "text": "hello" }),
    )];
    let candidate = event("evt_turn_done", "turn.final_done", json!({}));

    validate_agent_event_sequence(&existing, &candidate)
        .expect("legacy final_done is not a current terminal event");
}

#[test]
fn legacy_final_done_does_not_close_active_tools() {
    let existing = vec![event(
        "evt_tool_start",
        "item.started",
        json!({ "toolCallId": "tool_1" }),
    )];
    let candidate = event("evt_turn_done", "turn.final_done", json!({}));

    validate_agent_event_sequence(&existing, &candidate)
        .expect("legacy final_done must not be treated as terminal");
}

#[test]
fn treats_turn_canceled_as_terminal() {
    let existing = vec![event("evt_cancel", "turn.canceled", json!({}))];
    let candidate = event("evt_late_delta", "message.delta", json!({ "text": "late" }));

    let error = validate_agent_event_sequence(&existing, &candidate)
        .expect_err("terminal canceled turn should block later execution");
    assert!(error.contains("execution_after_turn_terminal"));
}

#[test]
fn accepts_paired_coding_patch_command_and_test_sequence() {
    let existing = vec![
        event(
            "evt_patch_start",
            "patch.started",
            json!({ "patchId": "patch_1" }),
        ),
        event(
            "evt_patch_done",
            "patch.applied",
            json!({ "patchId": "patch_1" }),
        ),
        event(
            "evt_command_start",
            "command.started",
            json!({ "commandId": "cmd_1", "command": "npm test" }),
        ),
        event(
            "evt_command_output",
            "command.output",
            json!({ "commandId": "cmd_1", "outputRef": "output://cmd_1" }),
        ),
        event(
            "evt_command_exit",
            "command.exited",
            json!({ "commandId": "cmd_1", "exitCode": 0 }),
        ),
        event(
            "evt_test_start",
            "test.started",
            json!({ "testRunId": "test_1" }),
        ),
    ];
    let candidate = event(
        "evt_test_done",
        "test.completed",
        json!({ "testRunId": "test_1", "result": "passed" }),
    );

    validate_agent_event_sequence(&existing, &candidate).expect("valid coding lifecycle");
}

#[test]
fn accepts_declined_patch_before_terminal_turn() {
    let existing = vec![
        event(
            "evt_patch_start",
            "patch.started",
            json!({ "patchId": "patch_1" }),
        ),
        event(
            "evt_patch_declined",
            "patch.declined",
            json!({ "patchId": "patch_1", "status": "declined" }),
        ),
    ];
    let candidate = event("evt_turn_done", "turn.completed", json!({}));

    validate_agent_event_sequence(&existing, &candidate)
        .expect("declined patch should close before terminal turn");
}

#[test]
fn canceled_turn_can_abandon_an_active_patch() {
    let existing = vec![event(
        "evt_patch_start",
        "patch.started",
        json!({ "patchId": "patch_1" }),
    )];
    let candidate = event("evt_turn_canceled", "turn.canceled", json!({}));

    validate_agent_event_sequence(&existing, &candidate)
        .expect("cancelled turn should abandon its active patch");
}

#[test]
fn rejects_coding_terminal_events_without_start() {
    for (event_type, payload, expected_code) in [
        (
            "patch.applied",
            json!({ "patchId": "patch_1" }),
            "patch_applied_without_start",
        ),
        (
            "patch.declined",
            json!({ "patchId": "patch_1" }),
            "patch_declined_without_start",
        ),
        (
            "command.exited",
            json!({ "commandId": "cmd_1", "exitCode": 0 }),
            "command_exited_without_start",
        ),
        (
            "test.completed",
            json!({ "testRunId": "test_1", "result": "passed" }),
            "test_completed_without_start",
        ),
    ] {
        let candidate = event("evt_candidate", event_type, payload);

        let error = validate_agent_event_sequence(&[], &candidate)
            .expect_err("coding terminal without start should fail");
        assert!(
            error.contains(expected_code),
            "unexpected error for {event_type}: {error}"
        );
    }
}

#[test]
fn rejects_coding_execution_after_turn_terminal() {
    let existing = vec![event("evt_turn_done", "turn.completed", json!({}))];
    let candidate = event(
        "evt_late_file_change",
        "file.changed",
        json!({
            "path": "src/App.tsx",
            "artifactId": "artifact_1"
        }),
    );

    let error = validate_agent_event_sequence(&existing, &candidate)
        .expect_err("terminal turn should block coding execution stream");
    assert!(error.contains("execution_after_turn_terminal"));
}

#[test]
fn rejects_unclosed_coding_lifecycles_at_terminal_turn() {
    let existing = vec![
        event(
            "evt_patch_start",
            "patch.started",
            json!({ "patchId": "patch_1" }),
        ),
        event(
            "evt_command_start",
            "command.started",
            json!({ "commandId": "cmd_1" }),
        ),
        event(
            "evt_test_start",
            "test.started",
            json!({ "testRunId": "test_1" }),
        ),
    ];
    let candidate = event("evt_turn_done", "turn.completed", json!({}));

    let error = validate_agent_event_sequence(&existing, &candidate)
        .expect_err("terminal turn should close active coding lifecycles");
    assert!(error.contains("patch_unclosed_at_turn_end"));
    assert!(error.contains("command_unclosed_at_turn_end"));
    assert!(error.contains("test_unclosed_at_turn_end"));
}

fn command_item(event_id: &str, event_type: &str) -> AgentEvent {
    let mut event = event(event_id, event_type, json!({"toolCallId": "exec-1"}));
    event.payload["item"]["kind"] = json!("command");
    event.payload["item"]["payload"] = json!({
        "type": "command", "command": "cat guide.md", "cwd": "/workspace",
        "output": null, "exit_code": null
    });
    event.payload["item"]["metadata"] = json!({"exec_command_call_id": "exec-1"});
    event
}

#[test]
fn canonical_command_owns_the_output_sequence_without_mirrored_lifecycle() {
    let mut validator =
        AgentEventSequenceValidator::from_events(&[], "sess_test", Some("turn_test"));
    for candidate in [
        command_item("canonical-start", "item.started"),
        event(
            "canonical-output",
            "command.output",
            json!({"commandId": "exec-1", "delta": "data"}),
        ),
        command_item("canonical-end", "item.completed"),
        event("canonical-turn-end", "turn.completed", json!({})),
    ] {
        validator
            .validate_and_observe(&candidate)
            .expect("paired canonical command");
    }
}

#[test]
fn canonical_command_rejects_a_second_mirror_start() {
    let existing = vec![command_item("canonical-start", "item.started")];
    let duplicate = event(
        "mirror-start",
        "command.started",
        json!({"commandId": "exec-1"}),
    );
    let error =
        validate_agent_event_sequence(&existing, &duplicate).expect_err("duplicate lifecycle");
    assert!(error.contains("command_started_already_active"), "{error}");
}

#[test]
fn canonical_command_rejects_output_after_completion_and_unclosed_turns() {
    let start = command_item("canonical-start", "item.started");
    let end = command_item("canonical-end", "item.completed");
    let late = event(
        "late-output",
        "command.output",
        json!({"commandId": "exec-1"}),
    );
    let error =
        validate_agent_event_sequence(&[start.clone(), end], &late).expect_err("late output");
    assert!(error.contains("command_output_without_start"), "{error}");
    let terminal = event("unclosed-turn-end", "turn.completed", json!({}));
    let error = validate_agent_event_sequence(&[start], &terminal).expect_err("unclosed command");
    assert!(error.contains("command_unclosed_at_turn_end"), "{error}");
}

fn yielded_command(event_id: &str) -> AgentEvent {
    let mut yielded = command_item(event_id, "item.started");
    yielded.event_type = "item.updated".to_string();
    yielded.payload["item"]["metadata"] = json!({
        "exec_command_call_id": "exec-1", "executionSurface": "unified_exec",
        "processId": "process-1", "session_id": 1000, "exit_code": null
    });
    yielded
}

#[test]
fn yielded_command_outlives_its_turn_and_completes_once() {
    let mut validator =
        AgentEventSequenceValidator::from_events(&[], "sess_test", Some("turn_test"));
    let mut end = command_item("background-end", "item.completed");
    end.payload["item"]["metadata"]["processId"] = json!("process-1");
    for candidate in [
        command_item("background-start", "item.started"),
        yielded_command("background-yield"),
        event("background-turn-end", "turn.completed", json!({})),
        event(
            "background-raw-output",
            "tool.output.delta",
            json!({"tool_id": "exec-1", "delta": "done", "metadata": {"processId": "process-1"}}),
        ),
        event(
            "background-output",
            "command.output",
            json!({"commandId": "exec-1", "processId": "process-1", "delta": "done"}),
        ),
        end,
    ] {
        validator
            .validate_and_observe(&candidate)
            .expect("session command retains its original scope");
    }
    let duplicate = command_item("duplicate-background-end", "item.completed");
    assert!(validator
        .validate_and_observe(&duplicate)
        .unwrap_err()
        .contains("execution_after_turn_terminal"));
}

#[test]
fn background_turn_still_rejects_new_execution_and_other_processes() {
    let existing = vec![
        command_item("background-start", "item.started"),
        yielded_command("background-yield"),
        event("background-turn-end", "turn.completed", json!({})),
    ];
    for candidate in [
        event("late-message", "message.delta", json!({"text": "late"})),
        command_item("late-start", "item.started"),
        event(
            "other-command",
            "command.output",
            json!({"commandId": "other", "processId": "process-1"}),
        ),
        event(
            "other-process",
            "command.output",
            json!({"commandId": "exec-1", "processId": "other"}),
        ),
        event(
            "other-raw-command",
            "tool.output.delta",
            json!({"tool_id": "other", "metadata": {"processId": "process-1"}}),
        ),
        event(
            "other-raw-process",
            "tool.output.delta",
            json!({"tool_id": "exec-1", "metadata": {"processId": "other"}}),
        ),
    ] {
        assert!(validate_agent_event_sequence(&existing, &candidate)
            .unwrap_err()
            .contains("execution_after_turn_terminal"));
    }
}

#[test]
fn background_process_cannot_rebind_before_terminal_or_complete_another_commands_test() {
    let mut existing = vec![
        command_item("background-start", "item.started"),
        yielded_command("background-yield"),
    ];
    let mut drift = yielded_command("drift");
    drift.payload["item"]["metadata"]["processId"] = json!("other-process");
    assert!(validate_agent_event_sequence(&existing, &drift)
        .unwrap_err()
        .contains("command_process_scope_mismatch"));
    existing.push(event(
        "test-start",
        "test.started",
        json!({"testRunId": "test-1", "commandId": "exec-1"}),
    ));
    existing.push(event("turn-end", "turn.completed", json!({})));
    let wrong = event(
        "wrong-test-command",
        "test.completed",
        json!({"testRunId": "test-1", "commandId": "other"}),
    );
    assert!(validate_agent_event_sequence(&existing, &wrong)
        .unwrap_err()
        .contains("execution_after_turn_terminal"));
    let correct = event(
        "test-complete",
        "test.completed",
        json!({"testRunId": "test-1", "commandId": "exec-1"}),
    );
    validate_agent_event_sequence(&existing, &correct)
        .expect("original test remains pending after rejection");
}

#[test]
fn running_command_rejects_foreign_process_streams_without_closing_original() {
    for (event_type, payload) in [
        (
            "command.output",
            json!({"commandId": "exec-1", "processId": "other-process"}),
        ),
        (
            "command.interaction",
            json!({"commandId": "exec-1", "processId": "other-process", "stdin": "x"}),
        ),
        (
            "tool.output.delta",
            json!({"tool_id": "exec-1", "metadata": {"processId": "other-process"}, "delta": "foreign"}),
        ),
    ] {
        let mut validator = AgentEventSequenceValidator::from_events(
            &[
                command_item("command-start", "item.started"),
                yielded_command("command-yield"),
            ],
            "sess_test",
            Some("turn_test"),
        );
        let candidate = event("foreign-stream", event_type, payload);
        let error = validator
            .validate_and_observe(&candidate)
            .expect_err("running Command must reject output from another process");
        assert!(
            error.contains("command_process_scope_mismatch"),
            "{event_type}: {error}"
        );
        let mut completed = command_item("original-completed", "item.completed");
        completed.payload["item"]["metadata"]["processId"] = json!("process-1");
        validator
            .validate_and_observe(&completed)
            .expect("original Command remains active");
    }
}

#[test]
fn running_command_rejects_foreign_completion_without_consuming_original() {
    for (field, value) in [
        ("process", "other-process"),
        ("item", "item_other"),
        ("turn", "turn_other"),
        ("thread", "thread_other"),
        ("session", "session_other"),
    ] {
        let mut validator = AgentEventSequenceValidator::from_events(
            &[
                command_item("command-start", "item.started"),
                yielded_command("command-yield"),
            ],
            "sess_test",
            Some("turn_test"),
        );
        let mut candidate = command_item("foreign-completion", "item.completed");
        candidate.payload["item"]["metadata"]["processId"] = json!("process-1");
        match field {
            "process" => candidate.payload["item"]["metadata"]["processId"] = json!(value),
            "item" => candidate.payload["item"]["itemId"] = json!(value),
            "turn" => candidate.payload["item"]["turnId"] = json!(value),
            "thread" => candidate.payload["item"]["threadId"] = json!(value),
            "session" => candidate.payload["item"]["sessionId"] = json!(value),
            _ => unreachable!(),
        }
        let error = validator
            .validate_and_observe(&candidate)
            .expect_err("running Command completion must keep its original identity");
        assert!(
            error.contains("command_process_scope_mismatch"),
            "{field}: {error}"
        );
        let mut completed = command_item("original-completed", "item.completed");
        completed.payload["item"]["metadata"]["processId"] = json!("process-1");
        validator
            .validate_and_observe(&completed)
            .expect("rejected completion cannot consume original Command");
    }
}

#[test]
fn running_command_accepts_original_streams_and_optional_process_metadata() {
    let mut validator = AgentEventSequenceValidator::from_events(
        &[
            command_item("command-start", "item.started"),
            yielded_command("command-yield"),
        ],
        "sess_test",
        Some("turn_test"),
    );
    for (index, (event_type, payload)) in [
        ("command.output", json!({"commandId": "exec-1", "processId": "process-1"})),
        ("command.interaction", json!({"commandId": "exec-1", "processId": "process-1", "stdin": "x"})),
        ("tool.output.delta", json!({"tool_id": "exec-1", "metadata": {"processId": "process-1"}, "delta": "original"})),
        ("command.output", json!({"commandId": "exec-1", "delta": "original"})),
    ].into_iter().enumerate() {
        validator.validate_and_observe(&event(&format!("original-stream-{index}"), event_type, payload))
            .expect("running Command keeps existing optional process metadata contract");
    }
    let mut completed = command_item("original-completed", "item.completed");
    completed.payload["item"]["metadata"]["processId"] = json!("process-1");
    validator
        .validate_and_observe(&completed)
        .expect("original Command completes once");
}
