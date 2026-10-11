//! A copy ticket belongs to the original selection, independently of its visible feedback.

use super::selection::Anchor;
use super::TranscriptSelection;

/// Surface coordinates remain explicit when an accepted page moves logical rows.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CopyPosition {
    Row(usize),
    DistanceFromBottom(usize),
}

#[derive(Clone, Debug)]
pub(super) struct PendingCopy {
    id: u64,
    start: Anchor,
    end: Anchor,
    position: CopyPosition,
    scroll: Option<usize>,
}

impl PendingCopy {
    pub(super) fn prepend_history(
        &mut self,
        inserted: std::ops::Range<usize>,
        row: usize,
        rows: usize,
        max_scroll: usize,
    ) {
        for anchor in [&mut self.start, &mut self.end] {
            if anchor.line >= inserted.start {
                anchor.line += inserted.len();
            }
        }
        if let CopyPosition::Row(position) = &mut self.position {
            if *position >= row {
                *position = position.saturating_add(rows).min(max_scroll);
            }
        }
        if let Some(scroll) = self.scroll.as_mut().filter(|scroll| **scroll >= row) {
            *scroll = scroll.saturating_add(rows).min(max_scroll);
        }
    }
}

impl TranscriptSelection {
    /// Mouse publication is silent and keeps the selection independently of the native lease.
    pub(crate) fn publish_primary(
        &self,
        clipboard: &mut crate::clipboard_copy::worker::ClipboardWorker,
        frames: crate::tui::FrameRequester,
    ) {
        let Some(text) = self.selected_text() else {
            return;
        };
        let scope = clipboard.select(text, frames);
        if let Some(selection) = self.selection.borrow_mut().as_mut() {
            selection.primary_scope = Some(scope);
        }
    }

    /// Cancel unpublished work without relinquishing the session's native PRIMARY owner.
    pub(crate) fn cancel_primary(&self) {
        if let Some(selection) = self.selection.borrow_mut().as_mut() {
            selection.primary_scope = None;
        }
    }

    pub(crate) fn defer_copy(&self, id: u64, position: CopyPosition) {
        let mut selection = self.selection.borrow_mut();
        let Some(selection) = selection.as_mut() else {
            return;
        };
        selection.pending_copy = Some(PendingCopy {
            id,
            start: selection.start,
            end: selection.end,
            position,
            scroll: self.layout.borrow().as_ref().map(|layout| layout.scroll),
        });
    }

    /// Replaced selections have no ticket; moved endpoints or reading positions reject it.
    pub(crate) fn finish_copy(&self, id: u64, current: bool, position: CopyPosition) -> bool {
        let mut selection = self.selection.borrow_mut();
        let Some(selection) = selection.as_mut() else {
            return false;
        };
        if selection
            .pending_copy
            .as_ref()
            .is_none_or(|pending| pending.id != id)
        {
            return false;
        }
        let pending = selection
            .pending_copy
            .take()
            .expect("matched selection copy");
        current
            && (pending.start, pending.end) == (selection.start, selection.end)
            && pending.position == position
            && pending.scroll == self.layout.borrow().as_ref().map(|layout| layout.scroll)
    }
}
