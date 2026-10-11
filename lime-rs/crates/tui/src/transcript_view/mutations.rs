//! Extend a selection's frozen revision only with explicitly accepted older history.

use std::ops::Range;
use std::sync::Arc;

use super::disclosure::MaterializedTranscript;
use super::selection::Anchor;
use super::text::TextLayout;
use super::TranscriptSelection;
use super::{PromptHeaderSource, TranscriptView};
use crate::terminal_hyperlinks::HyperlinkLine;
use crate::terminal_hyperlinks::HyperlinkParagraph;

impl TranscriptView {
    /// Extend paired main-screen lines and prompt metadata only after canonical page acceptance.
    pub(crate) fn prepend_snapshot_history(
        &self,
        older_lines: Vec<HyperlinkLine>,
        older: PromptHeaderSource,
    ) -> bool {
        if !self.selection.is_active() {
            return self
                .held_reading
                .borrow_mut()
                .as_mut()
                .is_some_and(|held| held.prepend_snapshot_history(older_lines, older));
        }
        let Some(snapshot) = self.selection.snapshot_lines() else {
            return false;
        };
        let Some(mut source) = self.prompt_header.snapshot_source() else {
            return false;
        };
        let mut lines = snapshot.as_ref().clone();
        let Some(inserted) = source.prepend_snapshot_history(&mut lines, older, &older_lines)
        else {
            return false;
        };
        let Some(excluded) = self.selection.snapshot_excluded_lines() else {
            return false;
        };
        let excluded = excluded
            .iter()
            .map(|line| {
                if *line >= inserted.start {
                    *line + inserted.len()
                } else {
                    *line
                }
            })
            .collect();
        let transcript = MaterializedTranscript::from_snapshot(lines, excluded);
        if self
            .selection
            .prepend_snapshot_history(&transcript, inserted)
            .is_none()
        {
            return false;
        }
        self.prompt_header.replace_snapshot_source(source);
        true
    }
}

#[cfg(test)]
#[path = "mutations_tests.rs"]
mod tests;

impl TranscriptSelection {
    pub(crate) fn snapshot_layout_width(&self) -> Option<u16> {
        self.selection.borrow().as_ref()?;
        Some(self.layout.borrow().as_ref()?.area.width)
    }

    pub(crate) fn prepend_snapshot_history(
        &self,
        transcript: &MaterializedTranscript,
        inserted: Range<usize>,
    ) -> Option<usize> {
        let mut selection = self.selection.borrow_mut();
        let selection = selection.as_mut()?;
        let mut layout = self.layout.borrow_mut();
        let previous = layout.as_ref()?;
        let lines = Arc::new(transcript.lines.clone());
        let excluded = Arc::new(transcript.excluded_lines.clone());
        let (next, first_row, added_rows) = previous.prepend_snapshot_history(
            Arc::clone(&lines),
            Arc::clone(&excluded),
            inserted.clone(),
        );
        if !self.remap_copy_targets(transcript, &next, inserted.clone()) {
            return None;
        }
        let shift = |anchor: &mut Anchor| {
            if anchor.line >= inserted.start {
                anchor.line += inserted.len();
            }
        };
        selection.snapshot = lines;
        selection.excluded_lines = excluded;
        shift(&mut selection.start);
        shift(&mut selection.end);
        shift(&mut selection.origin.0);
        shift(&mut selection.origin.1);
        if let Some(pending) = selection.pending_copy.as_mut() {
            pending.prepend_history(
                inserted,
                first_row,
                added_rows,
                next.rows
                    .len()
                    .saturating_sub(usize::from(next.area.height)),
            );
        }
        let scroll = next.scroll;
        *layout = Some(next);
        Some(scroll)
    }
}

impl TextLayout {
    pub(super) fn prepend_snapshot_history(
        &self,
        lines: Arc<Vec<HyperlinkLine>>,
        excluded: Arc<std::collections::HashSet<usize>>,
        inserted: Range<usize>,
    ) -> (Self, usize, usize) {
        let added = HyperlinkParagraph::new(&lines[inserted.clone()]).line_count(self.area.width);
        let first = HyperlinkParagraph::new(&lines[..inserted.start]).line_count(self.area.width);
        let scroll = self
            .scroll
            .saturating_add(if self.scroll >= first { added } else { 0 });
        (Self::new(self.area, scroll, lines, excluded), first, added)
    }
}
