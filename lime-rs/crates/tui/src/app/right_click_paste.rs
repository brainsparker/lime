//! Async mouse paste ownership for the editable composer.
//!
//! Native clipboard reads are owned by the session worker, but the UI ownership and draft
//! snapshot live on `ChatWidget`. This keeps a late completion from being inserted after a thread,
//! popup, selection, or draft changed while the broker was busy.

use crossterm::event::{MouseButton, MouseEventKind};

use super::App;
use crate::clipboard_copy::worker::PasteSource;
use crate::clipboard_paste::{normalize_clipboard_text, right_click_paste_allowed};
use crate::tui::TuiEvent;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub(crate) struct PendingPaste {
    id: u64,
    thread: Option<String>,
    draft: (String, usize),
    source: PasteSource,
    _scope: Arc<()>,
}

impl PendingPaste {
    pub(crate) fn source(&self) -> PasteSource {
        self.source
    }
}

fn keep_pending(event: &TuiEvent, source: PasteSource) -> bool {
    let button = match source {
        PasteSource::Clipboard => MouseButton::Right,
        PasteSource::Primary => MouseButton::Middle,
    };
    match event {
        TuiEvent::Draw | TuiEvent::Resize(_) | TuiEvent::FocusGained => true,
        TuiEvent::Mouse(mouse) => {
            mouse.kind == MouseEventKind::Moved
                || mouse.kind == MouseEventKind::Up(button)
                || (mouse.kind == MouseEventKind::Down(button) && mouse.modifiers.is_empty())
        }
        TuiEvent::Key(_) | TuiEvent::Paste(_) | TuiEvent::FocusLost | TuiEvent::Resume => false,
    }
}

impl App {
    fn clipboard_paste_target(
        &self,
        source: PasteSource,
    ) -> Option<(Option<String>, (String, usize))> {
        if !right_click_paste_allowed(self.chat_widget.right_click_paste, source)
            || self.chat_widget.pager_overlay.is_some()
            || self.chat_widget.export_picker.is_some()
            || self.chat_widget.copy_picker.is_some()
            || self.chat_widget.status_line_setup.is_some()
            || self.chat_widget.terminal_title_setup.is_some()
            || self.chat_widget.bottom_pane.is_active()
            || self.chat_widget.resume_picker.is_some()
            || self.chat_widget.agents_overview.is_some()
            || self.chat_widget.model_picker.is_some()
            || self.chat_widget.agent_picker.is_some()
            || self.transcript_view.search.is_active()
            || self.transcript_view.selection.is_active()
            || self.chat_widget.bottom_pane.history_search_active()
            || self.chat_widget.bottom_pane.vim_search_active()
            || self.chat_widget.bottom_pane.popup_active()
        {
            return None;
        }
        let target = self.chat_widget.bottom_pane.clipboard_paste_target()?;
        Some((self.thread_id.clone(), target))
    }

    pub(crate) fn begin_clipboard_paste(
        &mut self,
        id: u64,
        source: PasteSource,
        scope: Arc<()>,
    ) -> bool {
        let Some((thread, draft)) = self.clipboard_paste_target(source) else {
            return false;
        };
        self.chat_widget.set_pending_clipboard_paste(PendingPaste {
            id,
            thread,
            draft,
            source,
            _scope: scope,
        });
        true
    }

    /// Invalidate before dispatching input or polling a completion.
    pub(crate) fn invalidate_clipboard_paste(&mut self, event: &TuiEvent) {
        let Some(source) = self.chat_widget.pending_clipboard_source() else {
            return;
        };
        if keep_pending(event, source) {
            return;
        }
        self.chat_widget.clear_pending_clipboard_paste();
    }

    /// Validate before idle advance so a queued read cannot target an obsolete draft.
    pub(crate) fn validate_clipboard_paste(&mut self) {
        let Some(pending) = self.chat_widget.pending_clipboard_paste() else {
            return;
        };
        if self.clipboard_paste_target(pending.source).as_ref()
            != Some(&(pending.thread.clone(), pending.draft.clone()))
        {
            self.chat_widget.clear_pending_clipboard_paste();
        }
    }

    /// Apply only a completion that still belongs to the same thread and exact composer draft.
    pub(crate) fn finish_clipboard_paste(&mut self, id: u64, result: Result<String, String>) {
        let Some(pending) = self.chat_widget.pending_clipboard_paste().cloned() else {
            return;
        };
        if pending.id != id {
            return;
        }
        let target = self.clipboard_paste_target(pending.source);
        if target.as_ref() != Some(&(pending.thread.clone(), pending.draft.clone())) {
            self.chat_widget.clear_pending_clipboard_paste();
            return;
        }
        self.chat_widget.clear_pending_clipboard_paste();
        match result {
            Ok(text) if !text.is_empty() => {
                self.chat_widget
                    .bottom_pane
                    .handle_paste(&normalize_clipboard_text(text));
            }
            Ok(_) => {}
            Err(error) => self
                .projection
                .set_status(self.chat_widget.locale.clipboard_paste_failure(&error)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEvent};

    #[test]
    fn matching_release_survives_but_new_input_invalidates() {
        let right_release = TuiEvent::Mouse(MouseEvent {
            kind: MouseEventKind::Up(MouseButton::Right),
            column: 1,
            row: 1,
            modifiers: KeyModifiers::NONE,
        });
        assert!(keep_pending(&right_release, PasteSource::Clipboard));
        assert!(!keep_pending(&right_release, PasteSource::Primary));
        assert!(!keep_pending(
            &TuiEvent::Key(KeyEvent::new(KeyCode::Char('x'), KeyModifiers::NONE)),
            PasteSource::Clipboard
        ));
    }

    #[test]
    fn modified_same_button_does_not_keep_pending() {
        let event = TuiEvent::Mouse(MouseEvent {
            kind: MouseEventKind::Down(MouseButton::Right),
            column: 1,
            row: 1,
            modifiers: KeyModifiers::CONTROL,
        });
        assert!(!keep_pending(&event, PasteSource::Clipboard));
    }

    #[test]
    fn late_completion_is_rejected_after_draft_changes() {
        let mut app = App::default();
        app.chat_widget
            .bottom_pane
            .set_composer_text("before".to_string());
        app.chat_widget.set_pending_clipboard_paste(PendingPaste {
            id: 7,
            thread: None,
            draft: ("before".to_string(), "before".len()),
            source: PasteSource::Clipboard,
            _scope: Arc::new(()),
        });
        app.chat_widget
            .bottom_pane
            .set_composer_text("newer".to_string());
        app.finish_clipboard_paste(7, Ok("stale".to_string()));
        assert_eq!(app.chat_widget.bottom_pane.composer_text(), "newer");
        assert!(app.chat_widget.pending_clipboard_paste().is_none());
    }

    #[test]
    fn late_completion_is_rejected_after_thread_switch() {
        let mut app = App::default();
        app.chat_widget
            .bottom_pane
            .set_composer_text("draft".to_string());
        app.set_thread_id("thread-a".to_string());
        app.chat_widget.set_pending_clipboard_paste(PendingPaste {
            id: 8,
            thread: Some("thread-a".to_string()),
            draft: ("draft".to_string(), "draft".len()),
            source: PasteSource::Clipboard,
            _scope: Arc::new(()),
        });
        app.set_thread_id("thread-b".to_string());
        app.finish_clipboard_paste(8, Ok("stale".to_string()));
        assert_eq!(app.chat_widget.bottom_pane.composer_text(), "draft");
        assert!(app.chat_widget.pending_clipboard_paste().is_none());
    }

    #[test]
    fn input_and_idle_target_validation_drop_read_scope_before_late_delivery() {
        for cause in ["input", "draft", "thread", "overlay"] {
            let mut app = App::default();
            app.chat_widget
                .bottom_pane
                .set_composer_text("draft".into());
            let scope = Arc::new(());
            let owner = Arc::downgrade(&scope);
            app.chat_widget.set_pending_clipboard_paste(PendingPaste {
                id: 9,
                thread: None,
                draft: ("draft".into(), 5),
                source: PasteSource::Clipboard,
                _scope: scope,
            });
            match cause {
                "input" => app.invalidate_clipboard_paste(&TuiEvent::Key(KeyEvent::new(
                    KeyCode::Char('x'),
                    KeyModifiers::NONE,
                ))),
                "draft" => app
                    .chat_widget
                    .bottom_pane
                    .set_composer_text("new draft".into()),
                "thread" => app.set_thread_id("new thread".into()),
                "overlay" => app.open_transcript_pager(),
                _ => unreachable!(),
            }
            app.validate_clipboard_paste();
            assert_eq!(
                owner.strong_count(),
                0,
                "{cause} must cancel the pending read scope"
            );
            app.finish_clipboard_paste(9, Ok("stale text".into()));
            assert!(!app
                .chat_widget
                .bottom_pane
                .composer_text()
                .contains("stale text"));
        }
    }
}
