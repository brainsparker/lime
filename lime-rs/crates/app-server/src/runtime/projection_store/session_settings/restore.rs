use super::super::ProjectionStore;
use super::reviewer::remove_reviewer_copies;
use agent_protocol::{ApprovalsReviewer, Thread};
use rusqlite::{params, OptionalExtension, Transaction};
use serde_json::Value;

impl ProjectionStore {
    pub(in crate::runtime::projection_store) fn restore_projected_settings(
        &self,
        tx: &Transaction<'_>,
        session_id: &str,
    ) -> Result<(), String> {
        let Some((thread_json, metadata_json)) = tx
            .query_row(
                "SELECT c.thread_json, p.metadata_json FROM canonical_threads c
             JOIN projected_sessions p ON p.session_id = c.session_id AND p.thread_id = c.thread_id
             WHERE c.session_id = ?1",
                params![session_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
            )
            .optional()
            .map_err(|error| format!("cannot read canonical settings for {session_id}: {error}"))?
        else {
            return Ok(());
        };
        let thread: Thread = serde_json::from_str(&thread_json)
            .map_err(|error| format!("cannot decode settings thread for {session_id}: {error}"))?;
        let reviewer = ApprovalsReviewer::parse(thread.metadata.get("approvalsReviewer"))?;
        let original: Value = metadata_json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()
            .map_err(|error| format!("invalid projected metadata for {session_id}: {error}"))?
            .unwrap_or_else(|| serde_json::json!({}));
        let mut metadata = original
            .as_object()
            .cloned()
            .ok_or_else(|| format!("projected metadata for {session_id} must be an object"))?;
        remove_reviewer_copies(&mut metadata);
        match reviewer {
            Some(reviewer) => {
                metadata.insert(
                    "approvalsReviewer".into(),
                    Value::String(reviewer.as_str().into()),
                );
            }
            None => {
                metadata.remove("approvalsReviewer");
            }
        }
        let imported_workspace =
            super::workspace::restore_workspace_metadata(&thread.metadata, &mut metadata);
        let working_dir = metadata
            .get("workingDir")
            .and_then(Value::as_str)
            .map(str::to_string);
        let metadata = Value::Object(metadata);
        if metadata != original || imported_workspace {
            tx.execute(
                "UPDATE projected_sessions SET metadata_json = ?1,
                 working_dir = CASE WHEN ?3 THEN ?4 ELSE working_dir END WHERE session_id = ?2",
                params![
                    metadata.to_string(),
                    session_id,
                    imported_workspace,
                    working_dir
                ],
            )
            .map_err(|error| {
                format!("cannot restore canonical settings for {session_id}: {error}")
            })?;
        }
        Ok(())
    }
}
