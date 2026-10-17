use super::super::ProjectionStore;
use agent_protocol::Thread;
use rusqlite::{params, TransactionBehavior};
use serde_json::Value;

impl ProjectionStore {
    pub(in crate::runtime) fn migrate_session_settings(&self) -> Result<(), String> {
        let conn = self.open_projection_store()?;
        let mut statement = conn
            .prepare("SELECT thread_id FROM canonical_threads ORDER BY thread_id")
            .map_err(|error| format!("cannot list session settings migration threads: {error}"))?;
        let ids = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("cannot query session settings migration threads: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| {
                format!("cannot decode session settings migration identity: {error}")
            })?;
        drop(statement);
        drop(conn);
        for id in ids {
            self.migrate_thread_settings(&id)
                .map_err(|error| format!("session settings migration for thread {id}: {error}"))?;
        }
        Ok(())
    }

    fn migrate_thread_settings(&self, id: &str) -> Result<(), String> {
        let mut conn = self.open_projection_store()?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|error| format!("cannot begin session settings migration: {error}"))?;
        let (session_id, thread_json, archived, path) = tx
            .query_row(
                "SELECT session_id, thread_json, archived, rollout_path
                 FROM canonical_threads WHERE thread_id = ?1",
                params![id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, bool>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .map_err(|error| format!("cannot read session settings migration thread: {error}"))?;
        let raw: Value = serde_json::from_str(&thread_json).map_err(|error| {
            format!("cannot decode session settings migration metadata: {error}")
        })?;
        let Some(metadata) =
            migrated_settings_metadata(raw.get("metadata").unwrap_or(&Value::Null))?
        else {
            return Ok(());
        };
        let mut thread: Thread = serde_json::from_value(raw)
            .map_err(|error| format!("cannot decode session settings migration thread: {error}"))?;
        if thread.thread_id.as_str() != id || thread.session_id.as_str() != session_id {
            return Err("canonical session/thread identity mismatch".to_string());
        }
        let expected = thread.clone();
        thread.metadata = metadata;
        self.persist_thread_metadata(&tx, &expected, &mut thread, path.as_deref(), archived)?;
        tx.execute(
            "UPDATE projected_sessions SET metadata_json = ?1,
             working_dir = COALESCE(?4, working_dir) WHERE session_id = ?2 AND thread_id = ?3",
            params![
                thread.metadata.to_string(),
                session_id,
                id,
                thread.metadata.get("workingDir").and_then(Value::as_str)
            ],
        )
        .map_err(|error| format!("cannot migrate projected session settings: {error}"))?;
        tx.commit()
            .map_err(|error| format!("cannot commit session settings migration: {error}"))
    }
}

fn migrated_settings_metadata(metadata: &Value) -> Result<Option<Value>, String> {
    let reviewer = super::reviewer::migrated_reviewer_metadata(metadata)?;
    let current = reviewer.as_ref().unwrap_or(metadata);
    let workspace = super::workspace::migrated_workspace_metadata(current)?;
    Ok(workspace.or(reviewer))
}
