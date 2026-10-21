use super::*;

#[test]
fn approvals_reviewer_migration_reopens_archived_rollouts_idempotently() {
    let (_temp, agent_root, store) = store_with_rollout();
    let mut source = thread("reviewer-archived", 1_700_000_000_000);
    source.metadata = json!({
        "approvalsReviewer":null, "approvals_reviewer":"guardian_subagent",
        "workingDir":"/current", "unrelated":42
    });
    create(&store, &source);
    block_on(store.archive_thread(ArchiveThreadParams {
        thread_id: source.thread_id.clone(),
    }))
    .expect("archive published thread");
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
    let reopened = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root)
        .expect("migrate at actual store loading boundary");
    let migrated = block_on(reopened.read_thread(ReadThreadParams {
        thread_id: source.thread_id.clone(),
        include_archived: true,
        turns_view: ThreadTurnsView::NotLoaded,
    }))
    .unwrap()
    .unwrap();
    assert!(migrated.archived);
    assert_eq!(migrated.updated_at_ms, archived_updated_at);
    assert_eq!(
        migrated.metadata,
        json!({
            "approvalsReviewer":"auto_review", "workingDir":"/current", "unrelated":42
        })
    );
    assert_eq!(rollout_lines(&path).len(), before + 1);
    drop(reopened);
    let reopened = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap();
    assert_eq!(
        rollout_lines(&path).len(),
        before + 1,
        "reopen must not append twice"
    );
    let rebuilt = ProjectionStore::initialize_with_agent_root(
        agent_root.join("runtime/reviewer-rebuilt.sqlite"),
        &agent_root,
    )
    .expect("rebuild migrated archived history from rollout");
    let rebuilt_thread = block_on(rebuilt.read_thread(ReadThreadParams {
        thread_id: source.thread_id,
        include_archived: true,
        turns_view: ThreadTurnsView::NotLoaded,
    }))
    .unwrap()
    .unwrap();
    assert_eq!(rebuilt_thread.metadata, migrated.metadata);
    assert!(rebuilt_thread.archived);
    drop(reopened);
}

#[test]
fn approvals_reviewer_migration_retries_after_rollout_append_and_sqlite_commit_failure() {
    let (_temp, agent_root, store) = store_with_rollout();
    let mut source = thread("reviewer-retry", 1_700_000_000_000);
    source.metadata = json!({"approvals_reviewer":"guardian_subagent", "unrelated":42});
    create(&store, &source);
    let path = rollout_path(&store, &agent_root, &source.thread_id);
    let db_path = store.path().to_path_buf();
    let conn = Connection::open(&db_path).unwrap();
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE reviewer_parent (id INTEGER PRIMARY KEY);
         CREATE TABLE reviewer_child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL,
             FOREIGN KEY(parent_id) REFERENCES reviewer_parent(id) DEFERRABLE INITIALLY DEFERRED);
         CREATE TRIGGER reviewer_commit_failure AFTER UPDATE ON canonical_threads BEGIN
             INSERT INTO reviewer_child VALUES (1,999);
         END;",
    )
    .unwrap();
    drop(conn);
    drop(store);
    let error = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap_err();
    assert!(
        error.contains("reviewer-retry") && error.contains("FOREIGN KEY"),
        "{error}"
    );
    assert_eq!(rollout_lines(&path).len(), 2);
    let conn = Connection::open(&db_path).unwrap();
    conn.execute_batch("DROP TRIGGER reviewer_commit_failure;")
        .unwrap();
    let old: String = conn
        .query_row("SELECT thread_json FROM canonical_threads", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Thread>(&old).unwrap().metadata,
        source.metadata
    );
    drop(conn);
    let reopened = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap();
    let migrated = block_on(reopened.read_thread(ReadThreadParams {
        thread_id: source.thread_id,
        include_archived: false,
        turns_view: ThreadTurnsView::NotLoaded,
    }))
    .unwrap()
    .unwrap();
    assert_eq!(
        migrated.metadata,
        json!({"approvalsReviewer":"auto_review", "unrelated":42})
    );
    assert_eq!(
        rollout_lines(&path).len(),
        2,
        "retry reconciles existing durable record"
    );
}

#[test]
fn approvals_reviewer_invalid_migration_preserves_published_data_and_reports_identity() {
    let (_temp, agent_root, store) = store_with_rollout();
    let mut source = thread("reviewer-invalid", 1_700_000_000_000);
    source.metadata = json!({"approvalsReviewer":"unexpected", "approvals_reviewer":"user"});
    create(&store, &source);
    let path = rollout_path(&store, &agent_root, &source.thread_id);
    let db_path = store.path().to_path_buf();
    drop(store);
    let error = ProjectionStore::initialize_with_agent_root(&db_path, &agent_root).unwrap_err();
    assert!(
        error.contains("reviewer-invalid") && error.contains("unexpected"),
        "{error}"
    );
    assert_eq!(rollout_lines(&path).len(), 1);
    let conn = Connection::open(db_path).unwrap();
    let old: String = conn
        .query_row("SELECT thread_json FROM canonical_threads", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Thread>(&old).unwrap().metadata,
        source.metadata
    );
}
