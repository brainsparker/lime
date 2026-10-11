//! Logical text retained independently of rendered gutters and wrapping.

use std::ops::Range;
use std::sync::Arc;

use ratatui::text::Line;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct LogicalLineSource {
    pub(crate) text: Arc<str>,
    pub(crate) copy: Option<Arc<crate::markdown_copy::CopyLine>>,
    pub(crate) copy_as_prose: bool,
    pub(crate) range: Range<usize>,
    pub(crate) prefix_bytes: usize,
}

impl LogicalLineSource {
    pub(crate) fn new(text: String) -> Self {
        let end = text.len();
        Self {
            text: text.into(),
            copy: None,
            copy_as_prose: false,
            range: 0..end,
            prefix_bytes: 0,
        }
    }

    pub(crate) fn from_line(line: &Line<'_>) -> Self {
        Self::new(
            line.spans
                .iter()
                .map(|span| span.content.as_ref())
                .collect(),
        )
    }

    pub(crate) fn wrapped(&self, displayed: Range<usize>, prefix_bytes: usize) -> Self {
        let source_start = self.prefix_bytes;
        let source_end = source_start + self.range.len();
        let start = displayed.start.clamp(source_start, source_end);
        let end = displayed.end.clamp(source_start, source_end);
        Self {
            text: Arc::clone(&self.text),
            copy: self.copy.clone(),
            copy_as_prose: self.copy_as_prose,
            range: self.range.start + start - source_start..self.range.start + end - source_start,
            prefix_bytes: prefix_bytes + start.saturating_sub(displayed.start).min(displayed.len()),
        }
    }
}
