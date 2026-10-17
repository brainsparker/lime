use super::*;

fn thread(status: ThreadStatus, turns: Vec<Turn>) -> Thread {
    Thread {
        id: "thread-1".to_string(),
        extra: None,
        session_id: "session-1".to_string(),
        forked_from_id: None,
        parent_thread_id: None,
        preview: String::new(),
        ephemeral: false,
        section: None,
        section_entered_at: None,
        project_id: None,
        history_mode: ThreadHistoryMode::Legacy,
        model_provider: "provider".to_string(),
        created_at: 1,
        updated_at: 1,
        recency_at: None,
        status,
        path: None,
        cwd: std::path::PathBuf::new(),
        cli_version: String::new(),
        source: app_server_protocol::protocol::v2::SessionSource::AppServer,
        can_accept_direct_input: Some(true),
        thread_source: None,
        agent_nickname: None,
        agent_role: None,
        git_info: None,
        name: None,
        turns,
    }
}

fn turn(id: &str, status: TurnStatus) -> Turn {
    Turn {
        id: id.to_string(),
        items: Vec::new(),
        items_view: TurnItemsView::NotLoaded,
        status,
        error: None,
        started_at: None,
        completed_at: None,
        duration_ms: None,
    }
}

#[test]
fn resume_snapshot_keeps_live_turn_in_progress_and_thread_active() {
    let mut snapshot = thread(
        ThreadStatus::Idle,
        vec![turn("turn-live", TurnStatus::InProgress)],
    );

    normalize_thread_resume_snapshot(&mut snapshot, Some("turn-live"));

    assert_eq!(
        snapshot.status,
        ThreadStatus::Active {
            active_flags: Vec::new(),
        }
    );
    assert_eq!(snapshot.turns[0].status, TurnStatus::InProgress);
}

#[test]
fn resume_snapshot_interrupts_non_active_stale_turn() {
    let mut snapshot = thread(
        ThreadStatus::Active {
            active_flags: Vec::new(),
        },
        vec![
            turn("turn-stale", TurnStatus::InProgress),
            turn("turn-live", TurnStatus::InProgress),
        ],
    );

    normalize_thread_resume_snapshot(&mut snapshot, Some("turn-live"));

    assert_eq!(snapshot.turns[0].status, TurnStatus::Interrupted);
    assert_eq!(snapshot.turns[1].status, TurnStatus::InProgress);
}

#[test]
fn resume_snapshot_without_live_turn_is_idle_but_preserves_system_error() {
    let mut idle_snapshot = thread(
        ThreadStatus::Active {
            active_flags: Vec::new(),
        },
        vec![turn("turn-stale", TurnStatus::InProgress)],
    );
    let mut error_snapshot = thread(ThreadStatus::SystemError, Vec::new());

    normalize_thread_resume_snapshot(&mut idle_snapshot, None);
    normalize_thread_resume_snapshot(&mut error_snapshot, None);

    assert_eq!(idle_snapshot.status, ThreadStatus::Idle);
    assert_eq!(idle_snapshot.turns[0].status, TurnStatus::Interrupted);
    assert_eq!(error_snapshot.status, ThreadStatus::SystemError);
}

#[test]
fn resume_reads_typed_environment_selections_from_thread_metadata() {
    let selections =
        super::super::turn_environment::persisted_environment_selections(&serde_json::json!({
            "environments": [{
                "environmentId": "local",
                "cwd": "/workspace",
                "runtimeWorkspaceRoots": ["/workspace"]
            }]
        }))
        .expect("persisted selections should parse")
        .expect("persisted selections should exist");

    assert_eq!(selections[0].environment_id, "local");
    assert_eq!(selections[0].cwd, "/workspace");
    assert!(
        super::super::turn_environment::persisted_environment_selections(&serde_json::json!({
            "environments": "invalid"
        }))
        .is_err()
    );
}

#[test]
fn dynamic_tools_reject_deferred_and_flattened_name_collisions() {
    use app_server_protocol::protocol::v2::DynamicToolSpec;
    let deferred = vec![DynamicToolSpec::Function(
        app_server_protocol::protocol::v2::DynamicToolFunctionSpec {
            name: "later".to_string(),
            description: "Load later".to_string(),
            input_schema: serde_json::json!({"type": "object"}),
            defer_loading: true,
        },
    )];
    assert_eq!(
        validate_dynamic_tools(Some(&deferred))
            .expect_err("deferred tools are unsupported")
            .code,
        error_codes::INVALID_PARAMS
    );

    let duplicate = vec![
        DynamicToolSpec::Function(app_server_protocol::protocol::v2::DynamicToolFunctionSpec {
            name: "desktop__appInfo".to_string(),
            description: "Invalid flattened name".to_string(),
            input_schema: serde_json::json!({"type": "object"}),
            defer_loading: false,
        }),
        DynamicToolSpec::Function(app_server_protocol::protocol::v2::DynamicToolFunctionSpec {
            name: "Desktop__AppInfo".to_string(),
            description: "Invalid flattened name".to_string(),
            input_schema: serde_json::json!({"type": "object"}),
            defer_loading: false,
        }),
    ];
    assert!(validate_dynamic_tools(Some(&duplicate)).is_err());
}
