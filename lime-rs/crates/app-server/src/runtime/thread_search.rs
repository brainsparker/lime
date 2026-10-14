use super::{RuntimeCore, RuntimeCoreError};
use thread_store::{
    SearchThreadsParams, ThreadSearchPage, ThreadStore, ThreadStoreError, ThreadStoreErrorKind,
};

impl RuntimeCore {
    pub async fn search_threads(
        &self,
        params: SearchThreadsParams,
    ) -> Result<ThreadSearchPage, RuntimeCoreError> {
        let store = self
            .projection_store
            .as_deref()
            .map(|store| store as &dyn ThreadStore)
            .ok_or_else(|| {
                RuntimeCoreError::Backend("canonical thread store is unavailable".to_string())
            })?;
        let mut page = store.search_threads(params).await.map_err(search_error)?;
        for result in &mut page.data {
            // Search snippets belong to the store; activity belongs to the same
            // execution projection used by public thread/read and thread/list.
            let read = self
                .read_thread(app_server_protocol::ThreadReadParams {
                    thread_id: result.thread.thread_id.clone(),
                    turns_view: agent_protocol::ThreadTurnsView::Summary,
                })
                .await?;
            result.thread.status = read.thread.status;
        }
        Ok(page)
    }
}

fn search_error(error: ThreadStoreError) -> RuntimeCoreError {
    match error.kind() {
        ThreadStoreErrorKind::InvalidRequest | ThreadStoreErrorKind::ThreadNotFound => {
            RuntimeCoreError::InvalidRequest(error.to_string())
        }
        ThreadStoreErrorKind::Unsupported => RuntimeCoreError::MethodNotFound(error.to_string()),
        ThreadStoreErrorKind::Internal => {
            RuntimeCoreError::Backend(format!("failed to search threads: {error}"))
        }
    }
}
