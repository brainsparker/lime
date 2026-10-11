//! Frozen selection presentation absorbs only pages accepted by the canonical history owner.

use super::*;
use crate::app_event::OlderHistoryLoadMode;

impl PagerOverlay {
    pub(crate) fn snapshot_history_width(&self) -> Option<u16> {
        self.transcript_selection.snapshot_layout_width()
    }

    pub(crate) fn history_load_mode(&self) -> OlderHistoryLoadMode {
        if self.transcript_selection.is_active() {
            self.selection_history_mode.get()
        } else {
            OlderHistoryLoadMode::All
        }
    }

    pub(crate) fn prepend_snapshot_history(&self, older: TranscriptContent, locale: Locale) {
        let Some(width) = self.snapshot_history_width() else {
            return;
        };
        let mut frozen = self.snapshot_content.borrow_mut();
        let Some(frozen) = frozen.as_mut() else {
            return;
        };
        let shortcut = self.keymap.open_transcript_hint();
        let before = self.disclosure.materialize_with_presentation(
            frozen,
            locale,
            width,
            shortcut.as_deref(),
            self.browsing.as_ref().map(|state| state.detailed),
        );
        let start = before
            .anchor_ranges
            .iter()
            .filter(|range| {
                range
                    .keys
                    .iter()
                    .any(|key| key == "session-header" || key == "session-body-gap")
            })
            .map(|range| range.lines.end)
            .max()
            .unwrap_or(0);
        if !frozen.prepend_snapshot_history(older) {
            return;
        }
        let after = self.disclosure.materialize_with_presentation(
            frozen,
            locale,
            width,
            shortcut.as_deref(),
            self.browsing.as_ref().map(|state| state.detailed),
        );
        let inserted = start..start + after.lines.len().saturating_sub(before.lines.len());
        if let Some(scroll) = self
            .transcript_selection
            .prepend_snapshot_history(&after, inserted)
        {
            self.scroll.set(scroll);
            self.previous_transcript_frame
                .replace(Some(TranscriptFrame::new(
                    after.lines,
                    after.anchor_ranges,
                    width,
                )));
        }
    }
}
