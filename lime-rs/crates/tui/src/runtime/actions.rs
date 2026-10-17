//! Transcript export and link actions owned by the terminal Host.

use crate::app::App;
use crate::app_server_session::AppServerSession;
use crate::projection::TranscriptEntry;

pub(super) fn is_no_active_turn_error(error: &anyhow::Error) -> bool {
    error.chain().any(|cause| {
        let message = cause.to_string().to_ascii_lowercase();
        message.contains("no active turn") || message.contains("turn_not_active")
    })
}

pub(crate) fn open_link(destination: &str) -> Result<(), String> {
    open_link_with(destination, |destination| {
        webbrowser::open(destination).map_err(|error| error.to_string())
    })
}

pub(super) fn open_link_with(
    destination: &str,
    open: impl FnOnce(&str) -> Result<(), String>,
) -> Result<(), String> {
    let destination = crate::terminal_hyperlinks::web_destination(destination)
        .ok_or_else(|| "link destination must be a valid HTTP(S) URL".to_string())?;
    open(&destination)
}

pub(super) async fn prepare_export_transcript(
    app: &mut App,
    session: &AppServerSession,
    path: Option<std::path::PathBuf>,
) -> Option<String> {
    let live_entries = app.projection.entries();
    let entries = match session.thread_id() {
        Ok(thread_id) => match crate::thread_transcript::load_session_transcript(
            session.request_handle(),
            thread_id.to_string(),
            app.projection.show_raw_agent_reasoning(),
        )
        .await
        {
            Ok(entries) => merge_export_entries(entries, live_entries),
            Err(_) => live_entries.to_vec(),
        },
        Err(_) => live_entries.to_vec(),
    };
    let markdown = match crate::app::transcript_export::render_markdown_transcript(&entries) {
        Ok(markdown) => markdown,
        Err(error) => {
            app.projection.set_status(format!("export failed: {error}"));
            return None;
        }
    };
    match path {
        Some(path) => {
            match crate::app::transcript_export::write_transcript(&app.cwd, &path, &markdown) {
                Ok(path) => app
                    .projection
                    .set_status(format!("exported conversation to {}", path.display())),
                Err(error) => app.projection.set_status(format!("export failed: {error}")),
            }
            None
        }
        None => Some(markdown),
    }
}

pub(super) fn merge_export_entries(
    mut persisted: Vec<TranscriptEntry>,
    live: &[TranscriptEntry],
) -> Vec<TranscriptEntry> {
    for live_entry in live {
        if let Some(persisted_entry) = persisted
            .iter_mut()
            .find(|persisted_entry| persisted_entry.id == live_entry.id)
        {
            *persisted_entry = live_entry.clone();
        } else {
            persisted.push(live_entry.clone());
        }
    }
    persisted
}
