use super::*;
use app_server_protocol::{AgentSessionStatus, AgentTurnStatus};

#[test]
fn compaction_artifact_does_not_claim_memory_write() {
    let session = AgentSession {
        session_id: "sess".to_string(),
        thread_id: "thread".to_string(),
        app_id: "desktop".to_string(),
        workspace_id: None,
        business_object_ref: None,
        status: AgentSessionStatus::Idle,
        created_at: "now".to_string(),
        updated_at: "now".to_string(),
    };
    let turns = vec![AgentTurn {
        turn_id: "turn_1".to_string(),
        session_id: "sess".to_string(),
        thread_id: "thread".to_string(),
        status: AgentTurnStatus::Completed,
        started_at: None,
        completed_at: None,
    }];
    let events = vec![AgentEvent {
        event_id: "evt".to_string(),
        sequence: 1,
        session_id: "sess".to_string(),
        thread_id: Some("thread".to_string()),
        turn_id: Some("turn_1".to_string()),
        event_type: "message.created".to_string(),
        timestamp: "now".to_string(),
        payload: json!({"content": {"text": "hello"}}),
    }];

    let artifact = build_session_context_compaction(
        &session,
        &turns,
        &events,
        "compact-fixture",
        "model summary",
        None,
    )
    .expect("artifact");

    assert_eq!(artifact.context_epoch, 1);
    assert_eq!(artifact.window.window_number, 1);
    assert_eq!(
        uuid::Uuid::parse_str(&artifact.window.first_window_id)
            .expect("first window id")
            .get_version_num(),
        7
    );
    assert_eq!(artifact.window.previous_window_id, None);
    assert_eq!(artifact.window.window_id, artifact.window.first_window_id);
    assert_eq!(artifact.artifact["windowNumber"].as_u64(), Some(1));
    assert_eq!(artifact.artifact["replacementHistory"][0]["role"], "user");
    assert_eq!(
        artifact.artifact["replacementHistory"][0]["type"],
        "message"
    );
    assert_eq!(artifact.artifact["policy"]["durableHistoryRewrite"], false);
    assert_eq!(artifact.artifact["policy"]["providerHistoryRewrite"], true);
    assert_eq!(artifact.artifact["policy"]["longTermMemoryWrite"], false);
    assert_eq!(artifact.summary, "model summary");
}

#[test]
fn replacement_history_keeps_compacted_user_boundaries_before_summary() {
    let session = AgentSession {
        session_id: "sess-prefix".to_string(),
        thread_id: "thread-prefix".to_string(),
        app_id: "desktop".to_string(),
        workspace_id: None,
        business_object_ref: None,
        status: AgentSessionStatus::Idle,
        created_at: "now".to_string(),
        updated_at: "now".to_string(),
    };
    let turns = (1..=5)
        .map(|index| AgentTurn {
            turn_id: format!("turn-{index}"),
            session_id: session.session_id.clone(),
            thread_id: session.thread_id.clone(),
            status: AgentTurnStatus::Completed,
            started_at: None,
            completed_at: None,
        })
        .collect::<Vec<_>>();
    let events = vec![
        AgentEvent {
            event_id: "evt-old".to_string(),
            sequence: 1,
            session_id: session.session_id.clone(),
            thread_id: Some(session.thread_id.clone()),
            turn_id: Some("turn-1".to_string()),
            event_type: "message.created".to_string(),
            timestamp: "now".to_string(),
            payload: json!({"input": {"text": "old boundary"}}),
        },
        AgentEvent {
            event_id: "evt-tail".to_string(),
            sequence: 2,
            session_id: session.session_id.clone(),
            thread_id: Some(session.thread_id.clone()),
            turn_id: Some("turn-5".to_string()),
            event_type: "message.created".to_string(),
            timestamp: "now".to_string(),
            payload: json!({"input": {"text": "tail boundary"}}),
        },
    ];

    let artifact = build_session_context_compaction(
        &session,
        &turns,
        &events,
        "compact-fixture",
        "model summary",
        None,
    )
    .expect("artifact");
    let replacement = artifact
        .artifact
        .get("replacementHistory")
        .and_then(Value::as_array)
        .expect("replacement history");
    assert_eq!(replacement.len(), 2);
    assert_eq!(replacement[0]["role"], "user");
    assert_eq!(replacement[0]["turnId"], "turn-1");
    assert_eq!(replacement[0]["content"][0]["text"], "old boundary");
    assert_eq!(
        replacement[1]["content"][0]["text"].as_str(),
        Some(artifact.summary.as_str())
    );
}

#[test]
fn replacement_history_keeps_the_most_recent_user_boundaries_within_budget() {
    let turns = (1..=4)
        .map(|index| AgentTurn {
            turn_id: format!("turn-{index}"),
            session_id: "sess-budget".to_string(),
            thread_id: "thread-budget".to_string(),
            status: AgentTurnStatus::Completed,
            started_at: None,
            completed_at: None,
        })
        .collect::<Vec<_>>();
    let events = (1..=3)
        .map(|index| AgentEvent {
            event_id: format!("evt-{index}"),
            sequence: index,
            session_id: "sess-budget".to_string(),
            thread_id: Some("thread-budget".to_string()),
            turn_id: Some(format!("turn-{index}")),
            event_type: "message.created".to_string(),
            timestamp: "now".to_string(),
            payload: json!({"input": {"text": index.to_string().repeat(6_000)}}),
        })
        .collect::<Vec<_>>();

    let replacement = build_replacement_history("summary", &turns, &events, Some("turn-4"));

    assert_eq!(replacement.len(), 3);
    assert_eq!(replacement[0]["turnId"], "turn-2");
    assert_eq!(replacement[1]["turnId"], "turn-3");
    assert_eq!(replacement[2]["content"][0]["text"], "summary");
}

#[test]
fn compaction_windows_preserve_replacement_history_lineage() {
    let session = AgentSession {
        session_id: "sess-lineage".to_string(),
        thread_id: "thread-lineage".to_string(),
        app_id: "desktop".to_string(),
        workspace_id: None,
        business_object_ref: None,
        status: AgentSessionStatus::Idle,
        created_at: "now".to_string(),
        updated_at: "now".to_string(),
    };
    let turns = vec![AgentTurn {
        turn_id: "turn-lineage".to_string(),
        session_id: "sess-lineage".to_string(),
        thread_id: "thread-lineage".to_string(),
        status: AgentTurnStatus::Completed,
        started_at: None,
        completed_at: None,
    }];
    let event = AgentEvent {
        event_id: "evt-lineage".to_string(),
        sequence: 1,
        session_id: "sess-lineage".to_string(),
        thread_id: Some("thread-lineage".to_string()),
        turn_id: Some("turn-lineage".to_string()),
        event_type: "message.created".to_string(),
        timestamp: "now".to_string(),
        payload: json!({"content": {"text": "hello"}}),
    };

    let first = build_session_context_compaction(
        &session,
        &turns,
        &[event],
        "compact-fixture",
        "model summary",
        None,
    )
    .expect("first compaction");
    let previous = AgentEvent {
        event_id: "evt-compaction-1".to_string(),
        sequence: 2,
        session_id: session.session_id.clone(),
        thread_id: Some(session.thread_id.clone()),
        turn_id: Some("turn-lineage".to_string()),
        event_type: "context.compaction.completed".to_string(),
        timestamp: "now".to_string(),
        payload: json!({"artifact": first.artifact}),
    };
    let second = build_session_context_compaction(
        &session,
        &turns,
        &[previous],
        "compact-fixture",
        "model summary",
        None,
    )
    .expect("second compaction");

    assert_eq!(second.window.window_number, 2);
    assert_eq!(second.window.first_window_id, first.window.first_window_id);
    assert_eq!(
        second.window.previous_window_id,
        Some(first.window.window_id.clone())
    );
    assert_ne!(second.window.window_id, first.window.window_id);
    assert_eq!(
        Uuid::parse_str(&second.window.window_id)
            .expect("second window id")
            .get_version_num(),
        7
    );
    assert_eq!(second.window.replacement_history.len(), 1);

    let imported_first_window_id = Uuid::now_v7();
    let imported_previous_window_id = Uuid::now_v7();
    let imported_window_id = Uuid::now_v7();
    let imported = AgentEvent {
        event_id: "evt-imported-compaction".to_string(),
        sequence: 3,
        session_id: session.session_id.clone(),
        thread_id: Some(session.thread_id.clone()),
        turn_id: Some("turn-lineage".to_string()),
        event_type: "context.compaction.completed".to_string(),
        timestamp: "now".to_string(),
        payload: json!({
            "windowNumber": 7,
            "firstWindowId": imported_first_window_id.to_string(),
            "previousWindowId": imported_previous_window_id.to_string(),
            "windowId": imported_window_id.to_string(),
            "replacementHistory": [{"role": "assistant", "content": "summary"}]
        }),
    };
    let resumed = build_session_context_compaction(
        &session,
        &turns,
        &[imported],
        "compact-fixture",
        "model summary",
        None,
    )
    .expect("imported compaction");
    assert_eq!(resumed.window.window_number, 8);
    assert_eq!(
        resumed.window.first_window_id,
        imported_first_window_id.to_string()
    );
    assert_eq!(
        resumed.window.previous_window_id,
        Some(imported_window_id.to_string())
    );
}

#[test]
fn malformed_compaction_lineage_fails_closed_instead_of_resetting_ids() {
    let session = AgentSession {
        session_id: "sess-corrupt-lineage".to_string(),
        thread_id: "thread-corrupt-lineage".to_string(),
        app_id: "desktop".to_string(),
        workspace_id: None,
        business_object_ref: None,
        status: AgentSessionStatus::Idle,
        created_at: "now".to_string(),
        updated_at: "now".to_string(),
    };
    let turns = vec![AgentTurn {
        turn_id: "turn-corrupt-lineage".to_string(),
        session_id: session.session_id.clone(),
        thread_id: session.thread_id.clone(),
        status: AgentTurnStatus::Completed,
        started_at: None,
        completed_at: None,
    }];
    let incomplete = AgentEvent {
        event_id: "evt-corrupt-lineage".to_string(),
        sequence: 1,
        session_id: session.session_id.clone(),
        thread_id: Some(session.thread_id.clone()),
        turn_id: Some("turn-corrupt-lineage".to_string()),
        event_type: "context.compaction.completed".to_string(),
        timestamp: "now".to_string(),
        payload: json!({
            "windowNumber": 3,
            "firstWindowId": Uuid::now_v7().to_string(),
            "replacementHistory": []
        }),
    };

    let error = build_session_context_compaction(
        &session,
        &turns,
        &[incomplete],
        "compact-fixture",
        "model summary",
        None,
    )
    .expect_err("partial lineage must not silently start a new chain");

    assert!(
        matches!(error, RuntimeCoreError::Backend(message) if message.contains("evt-corrupt-lineage") && message.contains("missing windowId"))
    );
}

#[test]
fn fork_compaction_seed_rejects_mismatched_nested_marker_fields() {
    let first_window_id = Uuid::now_v7().to_string();
    let window_id = Uuid::now_v7().to_string();
    let event = AgentEvent {
        event_id: "evt-mismatched-fork-marker".to_string(),
        sequence: 1,
        session_id: "sess-fork-marker".to_string(),
        thread_id: Some("thread-fork-marker".to_string()),
        turn_id: None,
        event_type: "context.compaction.completed".to_string(),
        timestamp: "now".to_string(),
        payload: json!({
            "tailStartTurnId": "turn-tail",
            "replacementHistory": [{"role": "user", "content": "summary"}],
            "windowNumber": 1,
            "firstWindowId": first_window_id,
            "windowId": window_id,
            "artifact": {
                "tailStartTurnId": "turn-other",
                "replacementHistory": [{"role": "user", "content": "summary"}],
                "windowNumber": 1,
                "firstWindowId": first_window_id,
                "windowId": window_id,
            }
        }),
    };

    let error = latest_fork_compaction_seed(&[event]).expect_err("mismatched marker");
    assert!(matches!(
        error,
        RuntimeCoreError::Backend(message)
            if message.contains("evt-mismatched-fork-marker")
                && message.contains("tailStartTurnId disagree")
    ));
}

#[test]
fn fork_compaction_seed_rejects_partial_nested_marker_fields() {
    let first_window_id = Uuid::now_v7().to_string();
    let window_id = Uuid::now_v7().to_string();
    let event = AgentEvent {
        event_id: "evt-partial-fork-marker".to_string(),
        sequence: 1,
        session_id: "sess-fork-marker".to_string(),
        thread_id: Some("thread-fork-marker".to_string()),
        turn_id: None,
        event_type: "context.compaction.completed".to_string(),
        timestamp: "now".to_string(),
        payload: json!({
            "tailStartTurnId": "turn-tail",
            "replacementHistory": [{"role": "user", "content": "summary"}],
            "windowNumber": 1,
            "firstWindowId": first_window_id,
            "windowId": window_id,
            "artifact": {
                "tailStartTurnId": "turn-tail",
                "replacementHistory": [{"role": "user", "content": "summary"}],
                "windowNumber": 1,
                "firstWindowId": first_window_id,
            }
        }),
    };

    let error = latest_fork_compaction_seed(&[event]).expect_err("partial marker");
    assert!(matches!(
        error,
        RuntimeCoreError::Backend(message)
            if message.contains("evt-partial-fork-marker")
                && message.contains("windowId disagree or are incomplete")
    ));
}
