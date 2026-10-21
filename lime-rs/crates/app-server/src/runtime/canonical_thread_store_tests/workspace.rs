use super::*;

#[test]
fn canonical_workspace_event_repair_restores_current_directory_and_explicit_empty_roots() {
    let (_temp, agent_root, store) = store_with_rollout();
    let mut source = thread("workspace-repair", 1_700_000_000_000);
    source.metadata = workspace_metadata();
    create(&store, &source);
    let db_path = store.path().to_path_buf();
    drop(store);
    let reopened = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap();
    reopened
        .repair_session(
            source.session_id.as_str(),
            &[AgentEvent {
                event_id: "workspace-source-start".into(),
                sequence: 1,
                session_id: source.session_id.as_str().into(),
                thread_id: Some(source.thread_id.as_str().into()),
                turn_id: None,
                event_type: "session.started".into(),
                timestamp: "2026-06-16T00:00:00Z".into(),
                payload: json!({"session":{"workingDir":"/stale", "metadata":workspace_metadata()}}),
            }],
        )
        .unwrap();
    let conn = Connection::open(&db_path).unwrap();
    let (metadata, cwd): (String, String) = conn
        .query_row(
            "SELECT metadata_json, working_dir FROM projected_sessions WHERE session_id = ?1",
            [source.session_id.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&metadata).unwrap(),
        expected_workspace()
    );
    assert_eq!(cwd, "/current");
}

fn workspace_metadata() -> serde_json::Value {
    json!({
        "workingDir":"/current",
        "cwd":"/stale", "runtimeWorkspaceRoots":[], "workspaceRoot":"/stale-root",
        "unrelated":42
    })
}

fn expected_workspace() -> serde_json::Value {
    json!({
        "workingDir":"/current",
        "runtimeWorkspaceRoots":[], "unrelated":42
    })
}

#[test]
fn canonical_workspace_migration_preserves_archival_provenance_and_rebuilds_idempotently() {
    let (_temp, agent_root, store) = store_with_rollout();
    let mut source = thread("workspace-archived", 1_700_000_000_000);
    source.metadata = workspace_metadata();
    create(&store, &source);
    block_on(store.archive_thread(ArchiveThreadParams {
        thread_id: source.thread_id.clone(),
    }))
    .unwrap();
    let path = rollout_path(&store, &agent_root, &source.thread_id);
    let before = rollout_lines(&path).len();
    let archived_updated_at = block_on(store.read_thread(ReadThreadParams {
        thread_id: source.thread_id.clone(),
        include_archived: true,
        turns_view: ThreadTurnsView::NotLoaded,
    }))
    .unwrap()
    .unwrap()
    .updated_at_ms;
    let db_path = store.path().to_path_buf();
    drop(store);
    for _ in 0..2 {
        let reopened = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap();
        let migrated = block_on(reopened.read_thread(ReadThreadParams {
            thread_id: source.thread_id.clone(),
            include_archived: true,
            turns_view: ThreadTurnsView::NotLoaded,
        }))
        .unwrap()
        .unwrap();
        assert_eq!(migrated.metadata, expected_workspace());
        assert!(migrated.archived);
        assert_eq!(migrated.updated_at_ms, archived_updated_at);
        assert_eq!(rollout_lines(&path).len(), before + 1);
    }
    let rebuilt = ProjectionStore::initialize_with_agent_root(
        agent_root.join("runtime/workspace-rebuilt.sqlite"),
        &agent_root,
    )
    .unwrap();
    let read = block_on(rebuilt.read_thread(ReadThreadParams {
        thread_id: source.thread_id,
        include_archived: true,
        turns_view: ThreadTurnsView::NotLoaded,
    }))
    .unwrap()
    .unwrap();
    assert_eq!(read.metadata, expected_workspace());
    assert!(read.archived);
}

#[test]
fn canonical_workspace_migration_retries_a_failed_commit_without_duplicate_rollout_records() {
    let (_temp, agent_root, store) = store_with_rollout();
    let mut source = thread("workspace-retry", 1_700_000_000_000);
    source.metadata = workspace_metadata();
    create(&store, &source);
    let path = rollout_path(&store, &agent_root, &source.thread_id);
    let db_path = store.path().to_path_buf();
    let conn = Connection::open(&db_path).unwrap();
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
        CREATE TABLE workspace_parent (id INTEGER PRIMARY KEY);
        CREATE TABLE workspace_child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL,
            FOREIGN KEY(parent_id) REFERENCES workspace_parent(id) DEFERRABLE INITIALLY DEFERRED);
        CREATE TRIGGER workspace_commit_failure AFTER UPDATE ON canonical_threads BEGIN
            INSERT INTO workspace_child VALUES (1,999);
        END;",
    )
    .unwrap();
    drop(conn);
    drop(store);
    let error = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap_err();
    assert!(
        error.contains("workspace-retry") && error.contains("FOREIGN KEY"),
        "{error}"
    );
    assert_eq!(rollout_lines(&path).len(), 2);
    let conn = Connection::open(&db_path).unwrap();
    let original: String = conn
        .query_row("SELECT thread_json FROM canonical_threads", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Thread>(&original).unwrap().metadata,
        source.metadata
    );
    conn.execute_batch("DROP TRIGGER workspace_commit_failure;")
        .unwrap();
    drop(conn);
    let reopened = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap();
    let read = block_on(reopened.read_thread(ReadThreadParams {
        thread_id: source.thread_id,
        include_archived: false,
        turns_view: ThreadTurnsView::NotLoaded,
    }))
    .unwrap()
    .unwrap();
    assert_eq!(read.metadata, expected_workspace());
    assert_eq!(rollout_lines(&path).len(), 2);
}

#[test]
fn canonical_workspace_invalid_migration_keeps_old_data_and_reports_thread_identity() {
    let (_temp, agent_root, store) = store_with_rollout();
    let mut source = thread("workspace-invalid", 1_700_000_000_000);
    source.metadata = workspace_metadata();
    source.metadata["runtimeWorkspaceRoots"] = json!([false]);
    create(&store, &source);
    let path = rollout_path(&store, &agent_root, &source.thread_id);
    let db_path = store.path().to_path_buf();
    drop(store);
    let error = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap_err();
    assert!(
        error.contains("workspace-invalid") && error.contains("nonempty string"),
        "{error}"
    );
    assert_eq!(rollout_lines(&path).len(), 1);
    let conn = Connection::open(db_path).unwrap();
    let original: String = conn
        .query_row("SELECT thread_json FROM canonical_threads", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Thread>(&original).unwrap().metadata,
        source.metadata
    );
}
