//! Background file-search requests through the existing App Server session.

use crate::app_server_session::AppServerSession;
use crate::bottom_pane::FileSearchRequest;
use std::path::PathBuf;

#[derive(Debug)]
pub(super) struct FileSearchEvent {
    pub(super) generation: u64,
    pub(super) query: String,
    pub(super) files: Vec<app_server_protocol::protocol::v2::FuzzyFileSearchResult>,
}

pub(super) fn spawn_file_search(
    request_handle: app_server_client::RequestHandle,
    cwd: PathBuf,
    request: FileSearchRequest,
    result_tx: tokio::sync::mpsc::UnboundedSender<FileSearchEvent>,
) {
    tokio::spawn(async move {
        match AppServerSession::fuzzy_file_search_request(
            request_handle,
            cwd,
            request.query.clone(),
        )
        .await
        {
            Ok(files) => {
                let _ = result_tx.send(FileSearchEvent {
                    generation: request.generation,
                    query: request.query,
                    files,
                });
            }
            Err(error) => {
                tracing::debug!("file search request failed: {error}");
            }
        }
    });
}
