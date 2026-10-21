use super::*;
use std::path::Path;

impl ProjectionStore {
    pub(super) fn set_archived_sync(
        &self,
        params: ArchiveThreadParams,
        archived: bool,
    ) -> ThreadStoreResult<Option<Thread>> {
        let mut conn = self.open_thread_store()?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(store_error)?;
        let Some((mut thread, current_archived)) = read_thread_row(&tx, &params.thread_id)? else {
            if !archived {
                return Err(no_archived_rollout(&params.thread_id));
            }
            return Err(error(format!("thread {} does not exist", params.thread_id)));
        };
        if !archived && !current_archived {
            return Err(no_archived_rollout(&params.thread_id));
        }
        let path = tx
            .query_row(
                "SELECT rollout_path FROM canonical_threads WHERE thread_id = ?1",
                params![params.thread_id.as_str()],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(store_error)?;
        if self.rollout_store().is_some() && path.is_none() {
            return Err(error(format!(
                "thread {} has no rollout_path",
                params.thread_id
            )));
        }
        if current_archived == archived {
            if let (Some(store), Some(path)) = (self.rollout_store(), path.as_deref()) {
                store
                    .verify_location(
                        Path::new(path),
                        thread.session_id.as_str(),
                        thread.thread_id.as_str(),
                        archived,
                    )
                    .map_err(error)?;
            }
            return Ok(None);
        }

        let movement = match (self.rollout_store(), path.as_deref()) {
            (Some(store), Some(path)) => Some(
                if archived {
                    store.archive(
                        Path::new(path),
                        thread.session_id.as_str(),
                        thread.thread_id.as_str(),
                    )
                } else {
                    store.unarchive(
                        Path::new(path),
                        thread.session_id.as_str(),
                        thread.thread_id.as_str(),
                    )
                }
                .map_err(error)?,
            ),
            _ => None,
        };
        // The file operation remains reversible until SQLite commits. File time is a
        // lifecycle fact, independent of recency and the metadata record's revision.
        let result = (|| {
            thread.archived = archived;
            let next_path = if let Some(movement) = &movement {
                thread.recency_at_ms.get_or_insert(thread.updated_at_ms);
                thread.updated_at_ms = movement.updated_at_ms();
                Some(movement.storage_path())
            } else {
                path
            };
            tx.execute(
                "UPDATE canonical_threads
                 SET archived = ?2, thread_json = ?3, rollout_path = ?4, updated_at_ms = ?5,
                     recency_at_ms = ?6
                 WHERE thread_id = ?1",
                params![
                    params.thread_id.as_str(),
                    i64::from(archived),
                    encode_json(&thread)?,
                    next_path,
                    thread.updated_at_ms,
                    thread.recency_at_ms,
                ],
            )
            .map_err(store_error)?;
            // Keep the transaction alive if COMMIT fails, so its writer lock still
            // protects file rollback. Transaction::commit consumes and drops it.
            tx.execute_batch("COMMIT").map_err(store_error)
        })();
        if let Err(cause) = result {
            if let Some(movement) = movement {
                movement.rollback().map_err(|restore| {
                    error(format!("{cause}; failed to restore rollout: {restore}"))
                })?;
            }
            return Err(cause);
        }
        if let Some(movement) = movement {
            movement.commit();
        }
        Ok((!archived).then_some(thread))
    }
}

fn no_archived_rollout(thread_id: &agent_protocol::ThreadId) -> ThreadStoreError {
    ThreadStoreError::invalid_request(format!(
        "no archived rollout found for thread id {thread_id}"
    ))
}
