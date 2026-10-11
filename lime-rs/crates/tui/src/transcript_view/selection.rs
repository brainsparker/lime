use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;

#[cfg(test)]
use super::text::wrap_visual_rows;
use super::text::TextLayout;
use ratatui::buffer::Buffer;
use ratatui::layout::{Position, Rect};
use ratatui::style::{Modifier, Style};

use crate::terminal_hyperlinks::HyperlinkLine;
use crate::text_selection::SelectionUnit;

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(super) struct Anchor {
    pub(super) line: usize,
    pub(super) offset: usize,
}

#[derive(Clone, Debug)]
pub(super) struct Selection {
    pub(super) pending_copy: Option<super::clipboard::PendingCopy>,
    pub(super) primary_scope: Option<Arc<()>>,
    pub(super) snapshot: Arc<Vec<HyperlinkLine>>,
    pub(super) excluded_lines: Arc<HashSet<usize>>,
    pub(super) start: Anchor,
    pub(super) end: Anchor,
    pub(super) origin: (Anchor, Anchor),
    pub(super) unit: SelectionUnit,
    pub(super) dragging: bool,
    pub(super) moved: bool,
    pub(super) moved_vertically: bool,
    pub(super) pointer_origin_row: u16,
    pub(super) pointer: Option<Position>,
    pub(super) pressed_link: Option<String>,
    pub(super) preferred_column: Option<u16>,
}

#[derive(Debug, Default)]
pub(crate) struct TranscriptSelection {
    pub(super) selection: RefCell<Option<Selection>>,
    pub(super) layout: RefCell<Option<TextLayout>>,
    pub(super) last_click: RefCell<Option<(Instant, u16, u16, u8)>>,
    pub(super) resume_distance_from_bottom: Cell<Option<usize>>,
    pub(super) copy_mode: RefCell<Option<super::copy_mode::CopyMode>>,
}

impl TranscriptSelection {
    pub(crate) fn is_active(&self) -> bool {
        self.selection.borrow().is_some()
    }

    pub(crate) fn snapshot_lines(&self) -> Option<Arc<Vec<HyperlinkLine>>> {
        self.selection
            .borrow()
            .as_ref()
            .map(|selection| Arc::clone(&selection.snapshot))
    }

    pub(crate) fn snapshot_excluded_lines(&self) -> Option<Arc<HashSet<usize>>> {
        self.selection
            .borrow()
            .as_ref()
            .map(|selection| Arc::clone(&selection.excluded_lines))
    }

    pub(crate) fn update_layout(&self, area: Rect, scroll: usize, lines: &[HyperlinkLine]) {
        self.update_layout_with_exclusions(area, scroll, lines, &HashSet::new());
    }

    pub(crate) fn update_layout_with_exclusions(
        &self,
        area: Rect,
        scroll: usize,
        lines: &[HyperlinkLine],
        excluded_lines: &HashSet<usize>,
    ) {
        let resized = self.layout_size_changed(area);
        if resized {
            if let Some(mode) = self.copy_mode.borrow().as_ref() {
                mode.reveal.set(true);
            }
        }
        let (lines, excluded_lines) = self.selection.borrow().as_ref().map_or_else(
            || (Arc::new(lines.to_vec()), Arc::new(excluded_lines.clone())),
            |selection| {
                (
                    Arc::clone(&selection.snapshot),
                    Arc::clone(&selection.excluded_lines),
                )
            },
        );
        self.layout
            .replace(Some(TextLayout::new(area, scroll, lines, excluded_lines)));
        let pointer = self
            .selection
            .borrow()
            .as_ref()
            .filter(|selection| selection.dragging && selection.moved)
            .and_then(|selection| selection.pointer);
        if let Some(pointer) = pointer {
            self.extend(pointer.x, pointer.y);
        }
    }

    pub(crate) fn clear(&self) {
        self.selection.replace(None);
        self.copy_mode.replace(None);
    }

    pub(crate) fn reset(&self) {
        self.clear();
        self.layout.replace(None);
        self.last_click.replace(None);
        self.resume_distance_from_bottom.set(None);
    }

    /// Keep the selected source and its top logical row stable across terminal reflow.
    pub(crate) fn layout_size_changed(&self, area: Rect) -> bool {
        self.layout.borrow().as_ref().is_some_and(|layout| {
            layout.area.width != area.width || layout.area.height != area.height
        })
    }

    pub(crate) fn frozen_scroll(&self, area: Rect, fallback: usize) -> usize {
        let selection = self.selection.borrow();
        let Some(selection) = selection.as_ref() else {
            return fallback;
        };
        let previous_layout = self.layout.borrow();
        let Some(previous) = previous_layout.as_ref() else {
            return fallback;
        };
        let next = TextLayout::new(
            area,
            /*scroll*/ 0,
            Arc::clone(&selection.snapshot),
            Arc::clone(&selection.excluded_lines),
        );
        let max_scroll = next.rows.len().saturating_sub(usize::from(area.height));
        let Some(top) = previous.rows.get(previous.scroll) else {
            return fallback.min(max_scroll);
        };
        next.rows
            .iter()
            .enumerate()
            .filter(|(_, row)| row.line == top.line && row.start_offset() <= top.start_offset())
            .map(|(index, _)| index)
            .next_back()
            .unwrap_or(fallback)
            .min(max_scroll)
    }

    pub(crate) fn note_resume_distance_from_bottom(&self, distance: usize) {
        if self.is_active() {
            self.resume_distance_from_bottom.set(Some(distance));
        }
    }

    pub(crate) fn take_resume_distance_from_bottom(&self) -> Option<usize> {
        self.resume_distance_from_bottom.take()
    }

    pub(crate) fn scroll_rows(&self, rows: isize) -> bool {
        let mut layout = self.layout.borrow_mut();
        let Some(layout) = layout.as_mut() else {
            return false;
        };
        let max_scroll = layout
            .rows
            .len()
            .saturating_sub(usize::from(layout.area.height));
        let next = layout.scroll.saturating_add_signed(rows).min(max_scroll);
        let changed = next != layout.scroll;
        layout.scroll = next;
        changed
    }

    pub(crate) fn is_at_top(&self) -> bool {
        self.layout
            .borrow()
            .as_ref()
            .is_some_and(|layout| layout.scroll == 0)
    }

    pub(crate) fn reveal_row(&self, row: usize) -> bool {
        let mut layout = self.layout.borrow_mut();
        let Some(layout) = layout.as_mut() else {
            return false;
        };
        let height = usize::from(layout.area.height).max(1);
        let max_scroll = layout.rows.len().saturating_sub(height);
        let next = if row < layout.scroll {
            row
        } else if row >= layout.scroll.saturating_add(height) {
            row.saturating_add(1).saturating_sub(height)
        } else {
            layout.scroll
        }
        .min(max_scroll);
        let changed = next != layout.scroll;
        layout.scroll = next;
        changed
    }

    pub(crate) fn tick_edge_scroll(&self) -> bool {
        self.edge_scroll_direction()
            .is_some_and(|rows| self.scroll_rows(rows))
    }

    /// End pointer ownership without discarding a non-empty transcript selection.
    pub(crate) fn end_drag(&self) {
        self.cancel_primary();
        let mut selection = self.selection.borrow_mut();
        let Some(active) = selection.as_mut() else {
            return;
        };
        let was_dragging = active.dragging;
        active.dragging = false;
        active.pointer = None;
        active.pressed_link = None;
        if was_dragging && active.start == active.end {
            *selection = None;
        }
    }

    /// Return the edge-scroll direction for an active vertical pointer gesture.
    pub(crate) fn edge_scroll_direction(&self) -> Option<isize> {
        let selection = self.selection.borrow();
        let selection = selection
            .as_ref()
            .filter(|selection| selection.dragging && selection.moved_vertically)?;
        let pointer = selection.pointer?;
        let layout = self.layout.borrow();
        let area = layout.as_ref()?.area;
        if pointer.y <= area.top() {
            Some(-1)
        } else if pointer.y >= area.bottom().saturating_sub(1) {
            Some(1)
        } else {
            None
        }
    }

    pub(crate) fn render_highlight(&self, buffer: &mut Buffer) {
        let selection = self.selection.borrow();
        let Some(selection) = selection.as_ref() else {
            return;
        };
        let (start, end) = ordered(selection.start, selection.end);
        if start == end {
            return;
        }
        let layout = self.layout.borrow();
        let Some(layout) = layout.as_ref() else {
            return;
        };
        let viewport_end = layout
            .scroll
            .saturating_add(usize::from(layout.area.height));
        for (row_index, row) in layout.rows.iter().enumerate() {
            if row_index < layout.scroll || row_index >= viewport_end {
                continue;
            }
            if !layout.is_selectable_line(row.line) {
                continue;
            }
            if self.copy_mode.borrow().is_some() && (start.line..=end.line).contains(&row.line) {
                let screen_y = layout.area.y + (row_index - layout.scroll) as u16;
                for column in layout.area.x..layout.area.right() {
                    buffer[(column, screen_y)]
                        .set_style(Style::default().add_modifier(Modifier::REVERSED));
                }
                continue;
            }
            let begin = if row.line == start.line {
                start.offset
            } else if row.line > start.line {
                0
            } else {
                continue;
            };
            let finish = if row.line == end.line {
                end.offset
            } else if row.line < end.line {
                layout.texts.get(row.line).map_or(0, String::len)
            } else {
                continue;
            };
            if begin >= finish {
                continue;
            }
            let screen_y = layout
                .area
                .y
                .saturating_add(u16::try_from(row_index - layout.scroll).unwrap_or(u16::MAX));
            let mut column = row.first_column;
            for cell in &row.cells {
                if cell.source.start < finish && begin < cell.source.end {
                    for selected_column in
                        column..column.saturating_add(cell.width).min(layout.area.width)
                    {
                        buffer[(layout.area.x + selected_column, screen_y)]
                            .set_style(Style::default().add_modifier(Modifier::REVERSED));
                    }
                }
                column = column.saturating_add(cell.width);
            }
        }
    }

    pub(super) fn is_dragging(&self) -> bool {
        self.selection
            .borrow()
            .as_ref()
            .is_some_and(|selection| selection.dragging)
    }

    pub(super) fn extend(&self, column: u16, row: u16) {
        let layout = self.layout.borrow();
        let Some(layout) = layout.as_ref() else {
            return;
        };
        let Some(anchor) = layout.hit_test(column, row) else {
            return;
        };
        if !layout.is_selectable_line(anchor.line) {
            return;
        }
        let Some(text) = layout.texts.get(anchor.line) else {
            return;
        };
        let mut selection = self.selection.borrow_mut();
        let Some(selection) = selection.as_mut() else {
            return;
        };
        let range = selection.unit.range(text, anchor.offset);
        selection.primary_scope = None;
        let backwards = anchor < selection.origin.0;
        selection.start = if backwards {
            selection.origin.1
        } else {
            selection.origin.0
        };
        selection.end = Anchor {
            offset: if backwards { range.start } else { range.end },
            ..anchor
        };
        selection.moved = true;
        selection.moved_vertically |= selection.pointer_origin_row != row;
        selection.pointer = Some(Position::new(column, row));
        selection.preferred_column = None;
    }

    pub(super) fn selected_text(&self) -> Option<String> {
        self.copy_selected_text().map(|(text, _)| text)
    }

    pub(crate) fn copy_selected_text(&self) -> Option<(String, crate::clipboard_copy::CopyFormat)> {
        if let Some(mode) = self.copy_mode.borrow().as_ref() {
            let target = mode.targets.get(mode.cursor)?;
            return Some((target.text.to_string(), target.kind.format()));
        }
        let selection = self.selection.borrow();
        let selection = selection.as_ref()?;
        let (start, end) = ordered(selection.start, selection.end);
        if start == end {
            return None;
        }
        let (lines, plain) =
            super::text::copy_lines(&selection.snapshot, &selection.excluded_lines, start, end)?;
        let (serialized, format) = crate::markdown_copy::selection(&lines, &plain);
        let (text, format) = if format == crate::clipboard_copy::CopyFormat::Markdown {
            (
                crate::markdown_copy::literal_selection(&lines, &plain),
                crate::clipboard_copy::CopyFormat::MarkdownSelection(serialized.into()),
            )
        } else {
            (serialized, format)
        };
        (!text.is_empty()).then_some((text, format))
    }

    #[cfg(test)]
    pub(crate) fn selected_text_for_test(&self) -> Option<String> {
        self.selected_text()
    }
}

fn ordered(start: Anchor, end: Anchor) -> (Anchor, Anchor) {
    if start <= end {
        (start, end)
    } else {
        (end, start)
    }
}

pub(super) fn line_text(line: &HyperlinkLine) -> String {
    line.line
        .spans
        .iter()
        .map(|span| span.content.as_ref())
        .collect()
}

#[cfg(test)]
#[path = "selection_tests.rs"]
mod tests;
