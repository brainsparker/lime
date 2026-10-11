//! Scheduled frame preparation for the terminal host.

use std::time::Instant;

use anyhow::{Context, Result};

use crate::app::{App, AppAction};
use crate::tui::{FrameRequester, Tui};
use crate::view;

pub(super) fn prepare_draw(
    app: &mut App,
    connected: bool,
    frames: &FrameRequester,
    now: Instant,
    input_at: Instant,
) -> Option<AppAction> {
    // Capture and freshly flushed input both need a follow-up frame. Process view timers only
    // after that boundary, so they cannot consume the flush before the render gate observes it.
    if app.chat_widget.handle_paste_burst_tick(frames, input_at) {
        return None;
    }
    let action = if connected {
        app.pre_draw_tick(now)
    } else {
        AppAction::None
    };
    Some(action)
}

pub(super) fn draw(terminal: &mut Tui, app: &App) -> Result<()> {
    terminal
        .draw(
            view::cursor_style(app),
            app.terminal_title_text(Instant::now()).as_deref(),
            |frame| view::render(frame, app),
        )
        .context("failed to render terminal")?;
    finish_draw(app, &terminal.frame_requester());
    Ok(())
}

/// Rendering may restart a bounded scan or discover missing history after the pre-draw tick.
/// Schedule its continuation without running editor timers or flushing input twice.
fn finish_draw(app: &App, frames: &FrameRequester) {
    if app.transcript_search_needs_frame() {
        frames.schedule_frame_in(crate::tui::TARGET_FRAME_INTERVAL);
    }
}

#[cfg(test)]
#[path = "render_tests.rs"]
mod tests;
