use super::*;

fn command(session: &str, thread: &str, turn: &str, event_type: &str) -> RuntimeEvent {
    let mut event = super::super::support::canonical_tool_started_event(
        session,
        thread,
        turn,
        "background",
        "exec_command",
    );
    event.event_type = event_type.to_string();
    let item = &mut event.payload["item"];
    item["kind"] = json!("command");
    item["payload"] = json!({"type": "command", "command": "cat file; read value", "cwd": "/workspace", "output": null, "exit_code": null});
    item["metadata"] = json!({"exec_command_call_id": "background", "processId": "process-background", "executionSurface": "unified_exec"});
    if event_type == "item.updated" {
        item["metadata"]["session_id"] = json!(1000);
    }
    if event_type == "item.completed" {
        item["status"] = json!("completed");
        item["completedAtMs"] = json!(2);
        item["payload"]["exit_code"] = json!(0);
    }
    event
}

#[tokio::test]
async fn owned_background_append_keeps_terminal_turn_and_rejects_scope_drift() {
    let (core, session, turn) =
        runtime_with_active_turn("background-session", "background-thread", "background-turn")
            .await;
    let appender = core.event_appender();
    appender
        .append_command_runtime_events(
            &session,
            &turn,
            vec![
                command(&session, "background-thread", &turn, "item.started"),
                command(&session, "background-thread", &turn, "item.updated"),
            ],
        )
        .unwrap();
    core.append_external_runtime_events(
        &session,
        Some(&turn),
        vec![RuntimeEvent::new("turn.completed", json!({}))],
    )
    .unwrap();
    let before = event_count(&core, &session);
    for invalid in [
        RuntimeEvent::new("message.delta", json!({"text": "late"})),
        command(&session, "other-thread", &turn, "item.completed"),
        RuntimeEvent::new(
            "command.output",
            json!({"commandId": "background", "processId": "other-process", "delta": "late"}),
        ),
        RuntimeEvent::new(
            "command.output",
            json!({"commandId": "other-command", "processId": "process-background", "delta": "late"}),
        ),
        RuntimeEvent::new(
            "tool.output.delta",
            json!({"tool_id": "background", "delta": "late", "metadata": {"turn_id": turn, "executionSurface": "unified_exec", "processId": "other-process"}}),
        ),
    ] {
        assert!(appender
            .append_command_runtime_events(&session, &turn, vec![invalid])
            .is_err());
        assert_eq!(event_count(&core, &session), before);
    }
    let output = RuntimeEvent::new(
        "command.output",
        json!({"commandId": "background", "processId": "process-background", "delta": "finished", "outputRef": "output://background"}),
    );
    let completed = command(&session, "background-thread", &turn, "item.completed");
    let raw_output = RuntimeEvent::new(
        "tool.output.delta",
        json!({"tool_id": "background", "delta": "finished", "metadata": {"turn_id": turn, "executionSurface": "unified_exec", "processId": "process-background"}}),
    );
    let appended = appender
        .append_command_runtime_events(&session, &turn, vec![raw_output, output, completed.clone()])
        .unwrap();
    assert_eq!(appended.len(), 3);
    assert!(appended
        .iter()
        .all(|event| event.turn_id.as_deref() == Some(turn.as_str())));
    let stored = read_session(&core, &session);
    assert_eq!(stored.turns[0].status, AgentTurnStatus::Completed);
    assert_eq!(stored.session.status, AgentSessionStatus::Completed);
    assert!(appender
        .append_command_runtime_events(&session, &turn, vec![completed])
        .is_err());
}
