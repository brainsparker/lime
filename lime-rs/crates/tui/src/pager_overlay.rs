use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::sync::Arc;

use crossterm::event::{Event, KeyEventKind, MouseButton, MouseEventKind};
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::{Clear, Paragraph};
use ratatui::Frame;

use crate::clipboard_copy::CopyStatus;
use crate::keymap::{KeyChordMatcher, KeymapMatch, PagerKeymapAction, TranscriptKeymap};
use crate::line_truncation::truncate_line_with_ellipsis_if_overflow;
use crate::locale::Locale;
use crate::status::StatusSnapshot;
use crate::terminal_hyperlinks::{wrapped_line_starts, HyperlinkLine, HyperlinkParagraph};
use crate::transcript_view::{
    search_status, CopyPosition, SearchAction, TranscriptBookmark, TranscriptContent,
    TranscriptDisclosure, TranscriptFrame, TranscriptSearch, TranscriptSelection,
    TranscriptSelectionAction,
};

mod browsing;
mod history;
mod render;

#[cfg(test)]
mod copy_mode_tests;

#[cfg(test)]
mod history_tests;

#[cfg(test)]
mod disclosure_tests;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PagerAction {
    Consumed,
    ScheduleFrame,
    ContinueTranscriptSelection,
    LoadOlderHistory,
    CopyTranscriptSelection {
        text: String,
        format: crate::clipboard_copy::CopyFormat,
        follow: bool,
    },
    PublishPrimarySelection,
    OpenLink(String),
    Close,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HistoryLoadState {
    Idle,
    Loading,
    Failed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct TranscriptCopyFeedback {
    result: Result<CopyStatus, ()>,
    characters: usize,
}

#[derive(Debug)]
pub(crate) struct PagerOverlay {
    browsing: Option<browsing::BrowsingPresentation>,
    title: String,
    static_lines: Option<Vec<HyperlinkLine>>,
    status_snapshot: Option<Arc<StatusSnapshot>>,
    scroll: Cell<usize>,
    page_height: Cell<usize>,
    max_scroll: Cell<usize>,
    pinned_to_bottom: Cell<bool>,
    older_history_available: Cell<bool>,
    history_load_state: Cell<HistoryLoadState>,
    /// Previous structured transcript frame used to retain canonical source identity while the
    /// projection prepends history, replaces a group, or rewraps at another terminal width.
    previous_transcript_frame: RefCell<Option<TranscriptFrame>>,
    pending_transcript_bookmark: RefCell<Option<TranscriptBookmark>>,
    search: TranscriptSearch,
    transcript_copy_feedback: Option<TranscriptCopyFeedback>,
    pending_transcript_copy: Option<(u64, usize)>,
    disclosure: TranscriptDisclosure,
    transcript_selection: TranscriptSelection,
    copy_mode_requested: Cell<bool>,
    snapshot_content: RefCell<Option<TranscriptContent>>,
    selection_history_mode: Cell<crate::app_event::OlderHistoryLoadMode>,
    keymap: TranscriptKeymap,
    key_chord_matcher: KeyChordMatcher,
}

impl PagerOverlay {
    pub(crate) fn status(locale: Locale, status_snapshot: Arc<StatusSnapshot>) -> Self {
        let lines = status_snapshot.raw_lines(locale);
        let mut overlay = Self::new(locale.status_title().to_string(), lines);
        overlay.status_snapshot = Some(status_snapshot);
        overlay
    }

    pub(crate) fn new(title: String, lines: Vec<Line<'static>>) -> Self {
        Self {
            browsing: None,
            title,
            static_lines: Some(lines.into_iter().map(HyperlinkLine::new).collect()),
            status_snapshot: None,
            scroll: Cell::new(0),
            page_height: Cell::new(1),
            max_scroll: Cell::new(0),
            pinned_to_bottom: Cell::new(false),
            older_history_available: Cell::new(false),
            history_load_state: Cell::new(HistoryLoadState::Idle),
            previous_transcript_frame: RefCell::new(None),
            pending_transcript_bookmark: RefCell::new(None),
            search: TranscriptSearch::default(),
            transcript_copy_feedback: None,
            pending_transcript_copy: None,
            disclosure: TranscriptDisclosure::default(),
            transcript_selection: TranscriptSelection::default(),
            copy_mode_requested: Cell::new(false),
            snapshot_content: RefCell::new(None),
            selection_history_mode: Cell::new(crate::app_event::OlderHistoryLoadMode::OnePage),
            keymap: TranscriptKeymap::default(),
            key_chord_matcher: KeyChordMatcher::default(),
        }
    }

    pub(crate) fn transcript(locale: Locale) -> Self {
        Self {
            browsing: None,
            title: locale.transcript_title().to_string(),
            static_lines: None,
            status_snapshot: None,
            scroll: Cell::new(usize::MAX),
            page_height: Cell::new(1),
            max_scroll: Cell::new(0),
            pinned_to_bottom: Cell::new(true),
            older_history_available: Cell::new(false),
            history_load_state: Cell::new(HistoryLoadState::Idle),
            previous_transcript_frame: RefCell::new(None),
            pending_transcript_bookmark: RefCell::new(None),
            search: TranscriptSearch::default(),
            transcript_copy_feedback: None,
            pending_transcript_copy: None,
            disclosure: TranscriptDisclosure::default(),
            transcript_selection: TranscriptSelection::default(),
            copy_mode_requested: Cell::new(false),
            snapshot_content: RefCell::new(None),
            selection_history_mode: Cell::new(crate::app_event::OlderHistoryLoadMode::OnePage),
            keymap: TranscriptKeymap::default(),
            key_chord_matcher: KeyChordMatcher::default(),
        }
    }

    pub(crate) fn with_keymap(mut self, keymap: TranscriptKeymap) -> Self {
        self.keymap = keymap;
        self.key_chord_matcher.reset();
        self
    }

    pub(crate) fn is_transcript(&self) -> bool {
        self.static_lines.is_none()
    }

    pub(crate) fn begin_copy_mode(&self) {
        self.transcript_selection.clear();
        self.copy_mode_requested.set(true);
    }

    pub(crate) fn is_copy_mode(&self) -> bool {
        self.copy_mode_requested.get() || self.transcript_selection.copy_target_kind().is_some()
    }

    pub(crate) fn set_older_history_available(&self, available: bool) {
        self.older_history_available.set(available);
        if !available {
            self.history_load_state.set(HistoryLoadState::Idle);
        }
    }

    /// Mark an asynchronous older-history request before handing it to the host event loop.
    ///
    /// The footer remains authoritative while the App Server request is in flight, and the
    /// transcript anchor stays stable until the completion event is accepted.
    pub(crate) fn begin_older_history_load(&self) {
        if self.is_transcript() {
            self.history_load_state.set(HistoryLoadState::Loading);
            self.search.begin_history_load();
        }
    }

    pub(crate) fn complete_older_history_load(&self) {
        self.history_load_state.set(HistoryLoadState::Idle);
        self.search.complete_history_load();
    }

    pub(crate) fn fail_older_history_load(&self) {
        if self.is_transcript() {
            self.history_load_state.set(HistoryLoadState::Failed);
            self.search.fail_history_load();
        }
    }

    pub(crate) fn search_needs_frame(&self) -> bool {
        self.search.needs_frame()
            || self
                .search
                .history_request_pending(self.older_history_available.get())
    }

    pub(crate) fn take_search_history_request(&self) -> bool {
        self.search
            .take_history_request(self.older_history_available.get())
    }

    /// Keep the transcript at the actual beginning after Home loads all older pages.
    pub(crate) fn reset_transcript_anchor_at_top(&self) {
        if !self.is_transcript() || self.transcript_selection.is_active() {
            return;
        }
        self.pinned_to_bottom.set(false);
        self.scroll.set(0);
        *self.previous_transcript_frame.borrow_mut() = None;
        *self.pending_transcript_bookmark.borrow_mut() = None;
    }

    pub(crate) fn bookmark(&self) -> TranscriptBookmark {
        let following = self.pinned_to_bottom.get();
        self.previous_transcript_frame
            .borrow()
            .as_ref()
            .map(|frame| TranscriptBookmark::capture(frame, following, self.scroll.get()))
            .unwrap_or_else(|| TranscriptBookmark::fallback(following, self.scroll.get()))
    }

    pub(crate) fn restore_bookmark(&self, bookmark: TranscriptBookmark) {
        self.pinned_to_bottom.set(bookmark.following());
        self.scroll.set(bookmark.fallback_scroll());
        *self.pending_transcript_bookmark.borrow_mut() = Some(bookmark);
    }

    pub(crate) fn clear_transcript_selection(&self) {
        self.transcript_selection.clear();
    }

    pub(crate) fn publish_primary(
        &self,
        clipboard: &mut crate::clipboard_copy::worker::ClipboardWorker,
        frames: crate::tui::FrameRequester,
    ) {
        self.transcript_selection.publish_primary(clipboard, frames);
    }

    pub(crate) fn cancel_primary(&self) {
        self.transcript_selection.cancel_primary();
    }

    /// Drop short-lived interaction while retaining the detailed reading position and disclosure.
    pub(crate) fn suspend_transcript_interaction(&mut self) {
        if !self.is_transcript() {
            return;
        }
        self.close_search();
        self.transcript_selection.clear();
        self.copy_mode_requested.set(false);
        self.snapshot_content.replace(None);
        self.disclosure.clear_focus();
        self.transcript_copy_feedback = None;
        self.pending_transcript_copy = None;
        self.history_load_state.set(HistoryLoadState::Idle);
    }

    pub(crate) fn end_transcript_drag(&self) {
        self.transcript_selection.end_drag();
    }

    /// Move an active vertical edge drag by exactly one wrapped row.
    pub(crate) fn tick_transcript_selection(&self) -> bool {
        let Some(rows) = self.transcript_selection.edge_scroll_direction() else {
            return false;
        };
        let previous = self.scroll.get();
        self.scroll_transcript_rows(rows);
        previous != self.scroll.get()
    }

    fn can_tick_transcript_selection(&self) -> bool {
        match self.transcript_selection.edge_scroll_direction() {
            Some(rows) if rows < 0 => self.scroll.get() > 0,
            Some(rows) if rows > 0 => self.scroll.get() < self.max_scroll.get(),
            _ => false,
        }
    }

    pub(crate) fn confirm_transcript_copy(&mut self, follow: bool) {
        self.clear_transcript_selection();
        if follow && self.is_transcript() {
            self.close_search();
            self.pinned_to_bottom.set(true);
            self.scroll.set(self.max_scroll.get());
        }
    }

    pub(crate) fn defer_transcript_copy(&mut self, id: u64, characters: usize) {
        self.pending_transcript_copy = Some((id, characters));
        self.transcript_selection
            .defer_copy(id, CopyPosition::Row(self.scroll.get()));
    }

    /// Feedback survives selection replacement within this view; only the original ticket clears it.
    pub(crate) fn finish_transcript_copy(
        &mut self,
        id: u64,
        follow: bool,
        result: &Result<CopyStatus, String>,
        current: bool,
    ) -> Option<bool> {
        let (pending_id, characters) = self.pending_transcript_copy?;
        if pending_id != id || matches!(result, Ok(CopyStatus::Pending(_) | CopyStatus::Busy)) {
            return None;
        }
        self.pending_transcript_copy = None;
        let selection_current = self.transcript_selection.finish_copy(
            id,
            current,
            CopyPosition::Row(self.scroll.get()),
        );
        self.show_transcript_copy_feedback(characters, result);
        if !current {
            return None;
        }
        if selection_current && matches!(result, Ok(CopyStatus::Confirmed)) {
            self.confirm_transcript_copy(follow);
        }
        Some(selection_current)
    }

    pub(crate) fn show_transcript_copy_feedback(
        &mut self,
        characters: usize,
        result: &Result<CopyStatus, String>,
    ) {
        self.transcript_copy_feedback = Some(TranscriptCopyFeedback {
            result: result.as_ref().copied().map_err(|_| ()),
            characters,
        });
    }

    #[cfg(test)]
    pub(crate) fn has_transcript_selection(&self) -> bool {
        self.transcript_selection.snapshot_lines().is_some()
    }

    #[cfg(test)]
    pub(crate) fn transcript_scroll_position(&self) -> usize {
        self.scroll.get()
    }

    #[cfg(test)]
    pub(crate) fn transcript_search_is_active(&self) -> bool {
        self.search.is_active()
    }

    fn close_search(&mut self) {
        let _ = self.search.close();
    }

    pub(crate) fn handle_event(&mut self, event: &Event) -> PagerAction {
        if !matches!(event, Event::Key(_)) {
            self.key_chord_matcher.reset();
        }
        self.transcript_copy_feedback = None;
        if self.is_transcript() {
            if self.is_copy_mode()
                && matches!(event, Event::Key(key) if key.kind == KeyEventKind::Press && key.code == crossterm::event::KeyCode::Esc && key.modifiers.is_empty())
            {
                return PagerAction::Close;
            }
            if !self.is_copy_mode()
                && !self.search.is_active()
                && self.disclosure.handle_event(event)
            {
                self.transcript_selection.clear();
                self.pinned_to_bottom.set(false);
                return PagerAction::Consumed;
            }
            if let Some(action) = self.transcript_selection.handle_event(event) {
                self.disclosure.clear_focus();
                if let Some(mode) = self.transcript_selection.take_copy_history_request() {
                    if self.older_history_available.get()
                        && self.history_load_state.get() != HistoryLoadState::Loading
                    {
                        self.selection_history_mode.set(mode);
                        return PagerAction::LoadOlderHistory;
                    }
                }
                return match action {
                    TranscriptSelectionAction::Consumed
                        if matches!(
                            event,
                            Event::Mouse(mouse)
                                if mouse.kind == MouseEventKind::Drag(MouseButton::Left)
                        ) && self.can_tick_transcript_selection() =>
                    {
                        PagerAction::ContinueTranscriptSelection
                    }
                    TranscriptSelectionAction::Consumed => PagerAction::Consumed,
                    TranscriptSelectionAction::PublishPrimary => {
                        PagerAction::PublishPrimarySelection
                    }
                    TranscriptSelectionAction::Copy {
                        text,
                        format,
                        follow,
                    } => PagerAction::CopyTranscriptSelection {
                        text,
                        format,
                        follow,
                    },
                    TranscriptSelectionAction::OpenLink(destination) => {
                        PagerAction::OpenLink(destination)
                    }
                    TranscriptSelectionAction::Scroll { rows } => {
                        self.scroll_transcript_rows(rows);
                        if rows < 0
                            && self.scroll.get() == 0
                            && self.older_history_available.get()
                            && self.history_load_state.get() != HistoryLoadState::Loading
                        {
                            self.selection_history_mode
                                .set(crate::app_event::OlderHistoryLoadMode::OnePage);
                            return PagerAction::LoadOlderHistory;
                        }
                        PagerAction::Consumed
                    }
                    TranscriptSelectionAction::RevealRow(row) => {
                        self.reveal_transcript_row(row);
                        PagerAction::Consumed
                    }
                };
            }
        }
        if self.search.is_active() {
            self.pinned_to_bottom.set(false);
            return match self
                .search
                .handle_event(event, self.older_history_available.get())
            {
                SearchAction::Consumed | SearchAction::Closed { .. } => PagerAction::Consumed,
                SearchAction::ScheduleFrame => PagerAction::ScheduleFrame,
                SearchAction::LoadOlderHistory => PagerAction::LoadOlderHistory,
            };
        }

        let Event::Key(key) = event else {
            return PagerAction::Consumed;
        };
        if key.kind != KeyEventKind::Press {
            return PagerAction::Consumed;
        }

        let action = match self
            .keymap
            .dispatch_pager(&mut self.key_chord_matcher, *key)
        {
            KeymapMatch::Completed(action) => action,
            KeymapMatch::Pending | KeymapMatch::Cancelled | KeymapMatch::PassThrough => {
                return PagerAction::Consumed;
            }
        };
        if action == PagerKeymapAction::Find {
            if self.is_transcript() {
                self.search
                    .begin(self.scroll.get(), /*restore_on_close*/ false);
                return PagerAction::ScheduleFrame;
            }
            return PagerAction::Consumed;
        }
        if action == PagerKeymapAction::Close
            || self.is_transcript() && action == PagerKeymapAction::CloseTranscript
        {
            return PagerAction::Close;
        }

        let load_older = self.is_transcript()
            && self.older_history_available.get()
            && matches!(
                action,
                PagerKeymapAction::ScrollUp
                    | PagerKeymapAction::PageUp
                    | PagerKeymapAction::HalfPageUp
                    | PagerKeymapAction::JumpTop
            );
        let page_height = self.page_height.get().max(1);
        match action {
            PagerKeymapAction::ScrollUp => {
                self.pinned_to_bottom.set(false);
                self.scroll.set(self.scroll.get().saturating_sub(1));
            }
            PagerKeymapAction::ScrollDown => {
                self.scroll.set(self.scroll.get().saturating_add(1));
            }
            PagerKeymapAction::PageUp => {
                self.pinned_to_bottom.set(false);
                self.scroll
                    .set(self.scroll.get().saturating_sub(page_height));
            }
            PagerKeymapAction::PageDown => {
                self.scroll
                    .set(self.scroll.get().saturating_add(page_height));
            }
            PagerKeymapAction::HalfPageUp => {
                self.pinned_to_bottom.set(false);
                self.scroll
                    .set(self.scroll.get().saturating_sub((page_height / 2).max(1)));
            }
            PagerKeymapAction::HalfPageDown => {
                self.scroll
                    .set(self.scroll.get().saturating_add((page_height / 2).max(1)));
            }
            PagerKeymapAction::JumpTop => {
                self.pinned_to_bottom.set(false);
                self.scroll.set(0);
            }
            PagerKeymapAction::JumpBottom => {
                self.pinned_to_bottom.set(true);
                self.scroll.set(self.max_scroll.get());
            }
            PagerKeymapAction::Close
            | PagerKeymapAction::CloseTranscript
            | PagerKeymapAction::Find => return PagerAction::Consumed,
        }
        self.scroll
            .set(self.scroll.get().min(self.max_scroll.get()));
        if matches!(
            action,
            PagerKeymapAction::ScrollDown
                | PagerKeymapAction::PageDown
                | PagerKeymapAction::HalfPageDown
        ) {
            self.pinned_to_bottom
                .set(self.scroll.get() == self.max_scroll.get());
        }
        if load_older && self.scroll.get() == 0 {
            self.selection_history_mode
                .set(crate::app_event::OlderHistoryLoadMode::All);
            PagerAction::LoadOlderHistory
        } else {
            PagerAction::Consumed
        }
    }

    fn scroll_transcript_rows(&self, rows: isize) {
        let next = self
            .scroll
            .get()
            .saturating_add_signed(rows)
            .min(self.max_scroll.get());
        self.scroll.set(next);
        if rows < 0 {
            self.pinned_to_bottom.set(false);
        } else if rows > 0 {
            self.pinned_to_bottom.set(next == self.max_scroll.get());
        }
    }

    fn reveal_transcript_row(&self, row: usize) {
        let page_height = self.page_height.get().max(1);
        let current = self.scroll.get();
        let next = if row < current {
            row
        } else if row >= current.saturating_add(page_height) {
            row.saturating_add(1).saturating_sub(page_height)
        } else {
            current
        };
        self.pinned_to_bottom.set(false);
        self.scroll.set(next.min(self.max_scroll.get()));
    }
}

#[cfg(test)]
mod search_tests;
#[cfg(test)]
mod tests;
