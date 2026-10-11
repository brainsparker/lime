//! Geometry for rendered transcript rows with source byte coordinates.

use super::selection::{line_text, Anchor};
use crate::terminal_hyperlinks::HyperlinkLine;
use ratatui::buffer::CellWidth;
use ratatui::layout::{Alignment, Position, Rect};
use std::collections::{HashSet, VecDeque};
use std::ops::Range;
use std::sync::Arc;
use unicode_segmentation::UnicodeSegmentation;

pub(super) fn copy_lines(
    snapshot: &[HyperlinkLine],
    excluded: &HashSet<usize>,
    start: Anchor,
    end: Anchor,
) -> Option<(Vec<crate::markdown_copy::SelectedLine>, String)> {
    let mut lines = Vec::new();
    let mut plain = String::new();
    let mut previous: Option<(crate::terminal_hyperlinks::LogicalLineSource, Range<usize>)> = None;
    for index in start.line..=end.line {
        if excluded.contains(&index) {
            continue;
        }
        let line = snapshot.get(index)?;
        let visible = line_text(line);
        let source = line.source.clone().unwrap_or_else(|| {
            crate::terminal_hyperlinks::LogicalLineSource::from_line(&line.line)
        });
        let begin = if index == start.line { start.offset } else { 0 };
        let finish = if index == end.line {
            end.offset
        } else {
            visible.len()
        };
        let display_end = source.prefix_bytes + source.range.len();
        let first = begin.clamp(source.prefix_bytes, display_end);
        let last = finish.clamp(source.prefix_bytes, display_end);
        let range = source.range.start + first - source.prefix_bytes
            ..source.range.start + last - source.prefix_bytes;
        let separator = if let Some((previous, previous_range)) = &previous {
            if Arc::ptr_eq(&previous.text, &source.text) && previous_range.end <= range.start {
                let gap = source.text.get(previous_range.end..range.start)?;
                if gap.trim().is_empty() {
                    gap
                } else {
                    "\n"
                }
            } else {
                "\n"
            }
        } else {
            ""
        };
        plain.push_str(separator);
        plain.push_str(source.text.get(range.clone())?);
        crate::markdown_copy::SelectedLine::append(
            &mut lines,
            source.clone(),
            range.clone(),
            separator,
        );
        previous = Some((source, range));
    }
    plain.retain(|character| !character.is_control() || matches!(character, '\n' | '\t'));
    Some((lines, plain))
}

#[derive(Clone, Debug)]
pub(super) struct GraphemeCell {
    pub(super) source: Range<usize>,
    pub(super) width: u16,
    pub(super) whitespace: bool,
    pub(super) destination: Option<String>,
}

#[derive(Clone, Debug)]
pub(super) struct VisualRow {
    pub(super) line: usize,
    pub(super) cells: Vec<GraphemeCell>,
    pub(super) source_cursor: usize,
    pub(super) first_column: u16,
}

#[derive(Clone, Debug)]
pub(super) struct TextLayout {
    pub(super) area: Rect,
    pub(super) scroll: usize,
    pub(super) lines: Arc<Vec<HyperlinkLine>>,
    pub(super) excluded_lines: Arc<HashSet<usize>>,
    pub(super) texts: Vec<String>,
    pub(super) rows: Vec<VisualRow>,
}

impl TextLayout {
    pub(super) fn rewrap(&self, area: Rect) -> Self {
        let mut next = Self::new(
            area,
            0,
            Arc::clone(&self.lines),
            Arc::clone(&self.excluded_lines),
        );
        let max_scroll = next.rows.len().saturating_sub(usize::from(area.height));
        next.scroll = self
            .rows
            .get(self.scroll)
            .and_then(|row| {
                next.row_for_anchor(Anchor {
                    line: row.line,
                    offset: row.start_offset(),
                })
            })
            .unwrap_or(self.scroll)
            .min(max_scroll);
        next
    }

    pub(super) fn copy_block_ranges(
        &self,
        lines: Range<usize>,
    ) -> Vec<(Range<usize>, super::CopyTargetKind, Arc<str>)> {
        let mut ranges = Vec::new();
        for kind in [
            super::CopyTargetKind::CodeBlock,
            super::CopyTargetKind::Blockquote,
        ] {
            let mut active: Option<(Range<usize>, Arc<str>)> = None;
            for index in lines.clone() {
                let source = self.lines[index]
                    .source
                    .as_ref()
                    .and_then(|source| source.copy.as_ref())
                    .and_then(|copy| {
                        if kind == super::CopyTargetKind::CodeBlock {
                            copy.code_source.as_ref()
                        } else {
                            copy.quote_source.as_ref()
                        }
                    })
                    .filter(|_| self.is_selectable_line(index));
                if let Some(source) = source {
                    if active
                        .as_ref()
                        .is_some_and(|(_, previous)| !Arc::ptr_eq(previous, source))
                    {
                        let (range, payload) = active.take().expect("active source");
                        ranges.push((range, kind, payload));
                    }
                    let (range, _) =
                        active.get_or_insert_with(|| (index..index + 1, Arc::clone(source)));
                    range.end = index + 1;
                } else if let Some((range, payload)) = active.take() {
                    ranges.push((range, kind, payload));
                }
            }
            if let Some((range, payload)) = active {
                ranges.push((range, kind, payload));
            }
        }
        ranges.retain(|(_, _, payload)| !payload.trim().is_empty());
        ranges
    }

    pub(super) fn new(
        area: Rect,
        scroll: usize,
        lines: Arc<Vec<HyperlinkLine>>,
        excluded_lines: Arc<HashSet<usize>>,
    ) -> Self {
        let texts = lines.iter().map(line_text).collect::<Vec<_>>();
        let rows = if area.width == 0 {
            Vec::new()
        } else {
            texts
                .iter()
                .enumerate()
                .zip(lines.iter())
                .flat_map(|((line_index, text), line)| {
                    wrap_visual_rows(line_index, text, area.width, line)
                })
                .collect()
        };
        let scroll = scroll.min(rows.len().saturating_sub(usize::from(area.height)));
        Self {
            area,
            scroll,
            lines,
            excluded_lines,
            texts,
            rows,
        }
    }

    pub(super) fn hit_test(&self, column: u16, row: u16) -> Option<Anchor> {
        if !self.area.contains(Position::new(column, row)) {
            return None;
        }
        let visual_row = self
            .scroll
            .saturating_add(usize::from(row.saturating_sub(self.area.y)));
        let row = self.rows.get(visual_row)?;
        Some(Anchor {
            line: row.line,
            offset: row.offset_at_column(column.saturating_sub(self.area.x)),
        })
    }

    pub(super) fn is_selectable_line(&self, line: usize) -> bool {
        !self.excluded_lines.contains(&line)
    }

    pub(super) fn link_at(&self, column: u16, row: u16) -> Option<String> {
        if !self.area.contains(Position::new(column, row)) {
            return None;
        }
        let visual_row = self
            .scroll
            .saturating_add(usize::from(row.saturating_sub(self.area.y)));
        self.rows
            .get(visual_row)?
            .link_at(column.saturating_sub(self.area.x))
    }

    pub(super) fn row_for_anchor(&self, anchor: Anchor) -> Option<usize> {
        self.rows
            .iter()
            .enumerate()
            .filter(|(_, row)| row.line == anchor.line && row.start_offset() <= anchor.offset)
            .map(|(index, _)| index)
            .next_back()
    }
}

impl VisualRow {
    pub(super) fn start_offset(&self) -> usize {
        self.cells
            .first()
            .map_or(self.source_cursor, |cell| cell.source.start)
    }

    pub(super) fn end_offset(&self) -> usize {
        self.cells
            .last()
            .map_or(self.source_cursor, |cell| cell.source.end)
    }

    pub(super) fn offset_at_column(&self, column: u16) -> usize {
        if column <= self.first_column {
            return self.start_offset();
        }
        let mut current = self.first_column;
        for cell in &self.cells {
            current = current.saturating_add(cell.width);
            if column < current {
                return cell.source.start;
            }
        }
        self.end_offset()
    }

    pub(super) fn column_for_offset(&self, offset: usize) -> u16 {
        let mut column = self.first_column;
        for cell in &self.cells {
            if offset <= cell.source.start {
                break;
            }
            column = column.saturating_add(cell.width);
            if offset < cell.source.end {
                break;
            }
        }
        column
    }

    fn link_at(&self, column: u16) -> Option<String> {
        if column < self.first_column {
            return None;
        }
        let mut current = self.first_column;
        for cell in &self.cells {
            let end = current.saturating_add(cell.width);
            if column < end {
                return cell.destination.clone();
            }
            current = end;
        }
        None
    }
}

pub(super) fn wrap_visual_rows(
    line: usize,
    text: &str,
    width: u16,
    hyperlink_line: &HyperlinkLine,
) -> Vec<VisualRow> {
    let mut source_column = 0usize;
    let cells = text
        .grapheme_indices(true)
        .map(|(start, grapheme)| {
            let width = if grapheme.chars().any(char::is_control) {
                0
            } else {
                grapheme.cell_width()
            };
            let destination = hyperlink_line.destination_at_column(source_column);
            source_column = source_column.saturating_add(usize::from(width));
            GraphemeCell {
                source: start..start + grapheme.len(),
                width,
                whitespace: grapheme == "\u{200b}"
                    || (grapheme.chars().all(char::is_whitespace) && grapheme != "\u{00a0}"),
                destination,
            }
        })
        .collect::<Vec<_>>();
    let mut rows = word_wrap_cells(cells, width);
    if rows.is_empty() {
        rows.push(Vec::new());
    }
    let mut cursor = 0usize;
    rows.into_iter()
        .map(|cells| {
            let source_cursor = cells.first().map_or(cursor, |cell| cell.source.start);
            if let Some(last) = cells.last() {
                cursor = last.source.end;
            }
            let row_width = cells
                .iter()
                .fold(0u16, |total, cell| total.saturating_add(cell.width));
            let remaining = width.saturating_sub(row_width);
            let first_column = match hyperlink_line.line.alignment.unwrap_or(Alignment::Left) {
                Alignment::Left => 0,
                Alignment::Center => remaining / 2,
                Alignment::Right => remaining,
            };
            VisualRow {
                line,
                cells,
                source_cursor,
                first_column,
            }
        })
        .collect()
}

/// Mirrors ratatui's `WordWrapper` with `trim = false`, while retaining source offsets.
fn word_wrap_cells(cells: Vec<GraphemeCell>, width: u16) -> Vec<Vec<GraphemeCell>> {
    if width == 0 {
        return Vec::new();
    }
    let mut rows = Vec::new();
    let mut pending_line = Vec::new();
    let mut pending_word = Vec::new();
    let mut pending_whitespace = VecDeque::<GraphemeCell>::new();
    let mut line_width = 0u16;
    let mut word_width = 0u16;
    let mut whitespace_width = 0u16;
    let mut non_whitespace_previous = false;

    for cell in cells {
        if cell.width > width {
            continue;
        }
        let is_whitespace = cell.whitespace;
        let word_found = non_whitespace_previous && is_whitespace;
        let untrimmed_overflow = pending_line.is_empty()
            && word_width
                .saturating_add(whitespace_width)
                .saturating_add(cell.width)
                > width;
        if word_found || untrimmed_overflow {
            pending_line.extend(pending_whitespace.drain(..));
            line_width = line_width.saturating_add(whitespace_width);
            pending_line.append(&mut pending_word);
            line_width = line_width.saturating_add(word_width);
            whitespace_width = 0;
            word_width = 0;
        }

        let line_full = line_width >= width;
        let pending_word_overflow = cell.width > 0
            && line_width
                .saturating_add(whitespace_width)
                .saturating_add(word_width)
                >= width;
        if line_full || pending_word_overflow {
            let mut remaining = width.saturating_sub(line_width);
            rows.push(std::mem::take(&mut pending_line));
            line_width = 0;
            while let Some(space) = pending_whitespace.front() {
                if space.width > remaining {
                    break;
                }
                whitespace_width = whitespace_width.saturating_sub(space.width);
                remaining = remaining.saturating_sub(space.width);
                pending_whitespace.pop_front();
            }
            if is_whitespace && pending_whitespace.is_empty() {
                non_whitespace_previous = false;
                continue;
            }
        }

        if is_whitespace {
            whitespace_width = whitespace_width.saturating_add(cell.width);
            pending_whitespace.push_back(cell);
        } else {
            word_width = word_width.saturating_add(cell.width);
            pending_word.push(cell);
        }
        non_whitespace_previous = !is_whitespace;
    }

    pending_line.extend(pending_whitespace);
    pending_line.append(&mut pending_word);
    if !pending_line.is_empty() {
        rows.push(pending_line);
    }
    if rows.is_empty() {
        rows.push(Vec::new());
    }
    rows
}
