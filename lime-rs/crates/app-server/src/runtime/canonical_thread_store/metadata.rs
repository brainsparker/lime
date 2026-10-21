use super::*;

impl ProjectionStore {
    pub(super) fn update_thread_metadata_sync(
        &self,
        params: UpdateThreadMetadataParams,
    ) -> ThreadStoreResult<Thread> {
        let mut conn = self.open_thread_store()?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(store_error)?;
        let Some((mut thread, archived)) = read_thread_row(&tx, &params.thread_id)? else {
            return Err(error(format!("thread {} does not exist", params.thread_id)));
        };
        if archived && !params.include_archived {
            return Err(error(format!("thread {} is archived", params.thread_id)));
        }
        let expected = thread.clone();
        apply_metadata_patch(&mut thread, params.patch);
        self.persist_rollout_metadata(&tx, &expected, &mut thread, archived)?;
        persist_thread_snapshot(&tx, &thread)?;
        tx.commit().map_err(store_error)?;
        Ok(thread)
    }
}
