//! History loading and viewport presentation for the terminal Host.

use crate::app::App;
use crate::tui::Tui;
use crate::view;
use anyhow::Result;

pub(super) fn clear_history_page_error(app: &mut App) {
    if app.projection.status().starts_with("history page failed:") {
        app.projection.set_status("ready");
    }
}

pub(super) fn complete_history_load(app: &mut App) {
    clear_history_page_error(app);
    if let Some(pager) = app.chat_widget.pager_overlay.as_ref() {
        pager.complete_older_history_load();
        pager.reset_transcript_anchor_at_top();
    }
    app.transcript_view.search.complete_history_load();
}

pub(super) fn fail_history_load(app: &mut App, message: &str) {
    if let Some(pager) = app.chat_widget.pager_overlay.as_ref() {
        pager.fail_older_history_load();
    }
    app.transcript_view.search.fail_history_load();
    app.projection.set_status(message);
}

pub(super) fn current_transcript_page_size(terminal: &mut Tui, app: &App) -> Result<usize> {
    let size = terminal.screen_size();
    Ok(view::transcript_page_size(size.width, size.height, app))
}

pub(super) fn history_top_up_needed(terminal: &mut Tui, app: &App) -> Result<bool> {
    if app.chat_widget.resume_picker.is_some()
        || app.chat_widget.pager_overlay.is_some()
        || app.chat_widget.export_picker.is_some()
        || app.chat_widget.status_line_setup.is_some()
        || app.chat_widget.terminal_title_setup.is_some()
        || app.chat_widget.model_picker.is_some()
        || app.chat_widget.agent_picker.is_some()
        || app.chat_widget.agents_overview.is_some()
    {
        return Ok(false);
    }
    if !app.chat_widget.scrollback_has_older_history() {
        return Ok(false);
    }
    let size = terminal.screen_size();
    let minimum_rows = view::transcript_page_size(size.width, size.height, app);
    Ok(crate::app::history_ui::rendered_transcript_row_count(app, size.width) < minimum_rows)
}
