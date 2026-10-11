//! App-owned reading and interaction state for the canonical transcript projection.
//!
//! The canonical transcript remains owned by `ConversationProjection`. This module only freezes
//! the currently rendered presentation for reading and local selection, without owning history.

mod bookmark;
mod clipboard;
mod composer_gap;
mod copy_mode;
mod disclosure;
mod follow_control;
mod footer;
mod input;
mod mutations;
mod prompt_header;
mod search;
mod selection;
mod snapshot;
mod text;

pub(crate) use bookmark::{TranscriptAnchorRange, TranscriptBookmark, TranscriptFrame};
pub(crate) use clipboard::CopyPosition;
pub(crate) use composer_gap::TranscriptComposerGap;
pub(crate) use copy_mode::CopyTargetKind;
pub(crate) use disclosure::{TranscriptContent, TranscriptDisclosure};
pub(crate) use follow_control::{TranscriptFollowAction, TranscriptFollowControl};
pub(crate) use footer::{search_status, TranscriptFooter};
pub(crate) use input::TranscriptSelectionAction;
pub(crate) use prompt_header::{PromptHeaderSource, TranscriptPromptHeader};
#[cfg(test)]
pub(crate) use search::find_literal_ranges;
pub(crate) use search::{SearchAction, SearchBoundary, SearchHistoryState, TranscriptSearch};
pub(crate) use selection::TranscriptSelection;

/// One main-screen presentation owner, shared by rendering, input and thread lifecycle.
#[derive(Debug, Default)]
pub(crate) struct TranscriptView {
    pub(crate) scroll: usize,
    pub(crate) viewport: crate::transcript_reflow::TranscriptViewport,
    pub(crate) follow_control: TranscriptFollowControl,
    pub(crate) composer_gap: TranscriptComposerGap,
    pub(crate) footer: TranscriptFooter,
    pub(crate) prompt_header: TranscriptPromptHeader,
    pub(crate) search: TranscriptSearch,
    pub(crate) selection: TranscriptSelection,
    held_reading: std::cell::RefCell<Option<snapshot::ViewSnapshot>>,
}

impl TranscriptView {
    pub(crate) fn reset(&mut self) {
        self.scroll = 0;
        self.viewport.clear();
        self.follow_control.clear();
        self.composer_gap.clear();
        self.prompt_header.clear();
        self.search.clear();
        self.selection.reset();
        self.held_reading.take();
    }

    pub(crate) fn scroll_up(&mut self, amount: usize) {
        self.scroll = self.scroll.saturating_add(amount);
    }

    pub(crate) fn scroll_down(&mut self, amount: usize) {
        self.scroll = self.scroll.saturating_sub(amount);
    }

    pub(crate) fn scroll_top(&mut self) {
        self.release_live_reading();
        self.scroll = usize::MAX;
    }

    pub(crate) fn scroll_bottom(&mut self) {
        self.release_live_reading();
        self.scroll = 0;
    }

    pub(crate) fn finish_selection(&mut self, follow: bool) {
        let had_selection = self.selection.is_active();
        let resume = self.selection.take_resume_distance_from_bottom();
        if follow {
            self.scroll_bottom();
        } else if let Some(distance) = resume {
            self.scroll = distance;
        }
        if !follow && (had_selection || resume.is_some()) {
            self.retain_selection_reading();
        }
        self.selection.clear();
    }
}
