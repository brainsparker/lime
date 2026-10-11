//! Retain visible cell revisions while reading a mutable or replaced canonical group.

use std::collections::HashSet;
use std::sync::Arc;

use super::prompt_header::PromptCell;
use super::selection::Anchor;
use super::text::TextLayout;
use super::{PromptHeaderSource, TranscriptView};
use crate::terminal_hyperlinks::HyperlinkLine;
use ratatui::layout::Rect;

#[derive(Clone, Debug)]
pub(super) struct ViewSnapshot {
    pub(super) source: PromptHeaderSource,
    pub(super) layout: TextLayout,
    pub(super) pinned: HashSet<String>,
    release_if_surviving: bool,
}

impl ViewSnapshot {
    pub(super) fn prepend_snapshot_history(
        &mut self,
        older_lines: Vec<HyperlinkLine>,
        older: PromptHeaderSource,
    ) -> bool {
        let mut source = self.source.clone();
        let mut lines = self.layout.lines.as_ref().clone();
        let Some(inserted) = source.prepend_snapshot_history(&mut lines, older, &older_lines)
        else {
            return false;
        };
        let excluded = self
            .layout
            .excluded_lines
            .iter()
            .map(|line| {
                if *line >= inserted.start {
                    *line + inserted.len()
                } else {
                    *line
                }
            })
            .collect();
        self.layout = self
            .layout
            .prepend_snapshot_history(Arc::new(lines), Arc::new(excluded), inserted)
            .0;
        self.source = source;
        true
    }

    /// A page may join unseen groups, but displayed and initially pinned revisions survive.
    fn replace_unseen_groups(&mut self, lines: &[HyperlinkLine], source: &PromptHeaderSource) {
        for current in &source.cells {
            if current.identities.is_empty() {
                continue;
            }
            let matching = self
                .source
                .cells
                .iter()
                .enumerate()
                .filter(|(_, cell)| {
                    cell.identities
                        .iter()
                        .any(|id| current.identities.contains(id))
                })
                .map(|(index, _)| index)
                .collect::<Vec<_>>();
            if matching.len() < 2 {
                continue;
            }
            let first = matching[0];
            let last = *matching.last().expect("matching groups");
            let protected = self.source.cells[first..=last].iter().any(|cell| {
                self.pinned.contains(&cell.key)
                    || self
                        .layout
                        .rows
                        .iter()
                        .skip(self.layout.scroll)
                        .take(usize::from(self.layout.area.height))
                        .any(|row| cell.lines.contains(&row.line))
            });
            if protected {
                continue;
            }
            let Some(top) = self.layout.rows.get(self.layout.scroll) else {
                continue;
            };
            let Some(reading) = self.source.cell_at_line(top.line) else {
                continue;
            };
            let anchor = (
                reading.key.clone(),
                top.line - reading.lines.start,
                top.start_offset(),
            );
            let mut cells = self.source.cells[..first]
                .iter()
                .map(|cell| (cell.clone(), self.layout.lines[cell.lines.clone()].to_vec()))
                .collect::<Vec<_>>();
            cells.push((current.clone(), lines[current.lines.clone()].to_vec()));
            cells.extend(
                self.source.cells[last + 1..]
                    .iter()
                    .map(|cell| (cell.clone(), self.layout.lines[cell.lines.clone()].to_vec())),
            );
            let mut next_lines = Vec::new();
            let mut next_source = PromptHeaderSource::default();
            for (mut cell, content) in cells {
                let start = next_lines.len();
                next_lines.extend(content);
                cell.lines = start..next_lines.len();
                next_source.cells.push(cell);
            }
            let mut next = TextLayout::new(
                self.layout.area,
                0,
                Arc::new(next_lines),
                Arc::new(HashSet::new()),
            );
            if let Some(cell) = next_source.cells.iter().find(|cell| cell.key == anchor.0) {
                next.scroll = next
                    .row_for_anchor(Anchor {
                        line: cell.lines.start + anchor.1,
                        offset: anchor.2,
                    })
                    .unwrap_or(self.layout.scroll)
                    .min(
                        next.rows
                            .len()
                            .saturating_sub(usize::from(next.area.height)),
                    );
            }
            self.source = next_source;
            self.layout = next;
        }
    }

    fn capture(layout: TextLayout, source: PromptHeaderSource) -> Self {
        let visible = layout
            .rows
            .iter()
            .skip(layout.scroll)
            .take(usize::from(layout.area.height))
            .filter_map(|row| source.cell_at_line(row.line))
            .map(|cell| cell.key.clone())
            .collect();
        Self {
            source,
            layout,
            pinned: visible,
            release_if_surviving: false,
        }
    }

    fn reading_cell(&self) -> Option<&PromptCell> {
        self.source
            .cell_at_line(self.layout.rows.get(self.layout.scroll)?.line)
    }

    fn surviving_row(&self, lines: &[HyperlinkLine], source: &PromptHeaderSource) -> Option<usize> {
        let row = self.layout.rows.get(self.layout.scroll)?;
        let retained = self.reading_cell()?;
        let current = source.cells.iter().find(|cell| {
            cell.key == retained.key && cell.identities == retained.identities && !cell.mutable
        })?;
        if self.layout.lines.get(retained.lines.clone())? != lines.get(current.lines.clone())? {
            return None;
        }
        let next = TextLayout::new(
            self.layout.area,
            0,
            Arc::new(lines.to_vec()),
            Arc::new(HashSet::new()),
        );
        next.row_for_anchor(Anchor {
            line: current.lines.start + row.line.saturating_sub(retained.lines.start),
            offset: row.start_offset(),
        })
    }
}

impl TranscriptView {
    pub(crate) fn release_live_reading(&self) {
        if self.held_reading.take().is_some() {
            self.selection.layout.replace(None);
            self.prompt_header.clear();
            self.viewport.clear();
        }
    }

    pub(crate) fn replace_unseen_groups(
        &self,
        lines: &[HyperlinkLine],
        source: &PromptHeaderSource,
    ) {
        if let Some(held) = self.held_reading.borrow_mut().as_mut() {
            held.replace_unseen_groups(lines, source);
        }
    }

    pub(crate) fn held_reading_width(&self) -> Option<u16> {
        Some(self.held_reading.borrow().as_ref()?.layout.area.width)
    }

    pub(crate) fn history_layout_width(&self) -> Option<u16> {
        self.selection
            .snapshot_layout_width()
            .or_else(|| self.held_reading_width())
            .or_else(|| {
                (self.scroll > 0 && !self.search.is_active())
                    .then(|| {
                        self.selection
                            .layout
                            .borrow()
                            .as_ref()
                            .map(|layout| layout.area.width)
                    })
                    .flatten()
            })
    }

    /// Capture the displayed revision before a page join or mutable cell can replace it.
    pub(crate) fn hold_live_reading(&self, lines: &[HyperlinkLine], source: &PromptHeaderSource) {
        if self.selection.is_active() {
            self.held_reading.take();
            return;
        }
        if !self.search.is_active() {
            let mut held = self.held_reading.borrow_mut();
            if let Some(snapshot) = held.as_mut().filter(|held| held.release_if_surviving) {
                snapshot.release_if_surviving = false;
                if snapshot.surviving_row(lines, source).is_some() {
                    *held = None;
                    return;
                }
            }
        }
        if self.search.is_active() || self.held_reading.borrow().is_some() || self.scroll == 0 {
            return;
        }
        let Some(mut layout) = self.selection.layout.borrow().clone() else {
            return;
        };
        let Some(previous) = self.prompt_header.snapshot_source() else {
            return;
        };
        let requested = self
            .viewport
            .requested_distance_from_bottom()
            .unwrap_or(self.scroll);
        layout.scroll = if self.scroll >= requested {
            layout.scroll.saturating_sub(self.scroll - requested)
        } else {
            layout.scroll.saturating_add(requested - self.scroll).min(
                layout
                    .rows
                    .len()
                    .saturating_sub(usize::from(layout.area.height)),
            )
        };
        let snapshot = ViewSnapshot::capture(layout, previous);
        let Some(cell) = snapshot.reading_cell() else {
            return;
        };
        if !cell.identities.is_empty()
            && (cell.mutable || snapshot.surviving_row(lines, source).is_none())
        {
            self.held_reading.replace(Some(snapshot));
        }
    }

    pub(super) fn retain_selection_reading(&self) {
        let Some(layout) = self.selection.layout.borrow().clone() else {
            return;
        };
        let Some(source) = self.prompt_header.snapshot_source() else {
            return;
        };
        let mut snapshot = ViewSnapshot::capture(layout, source);
        snapshot.release_if_surviving = true;
        self.held_reading.replace(Some(snapshot));
    }

    pub(crate) fn snapshot_lines(&self) -> Option<Arc<Vec<HyperlinkLine>>> {
        self.selection.snapshot_lines().or_else(|| {
            if self.search.is_active() {
                return None;
            }
            Some(Arc::clone(
                &self.held_reading.borrow().as_ref()?.layout.lines,
            ))
        })
    }

    pub(crate) fn snapshot_prompt_source(
        &self,
        current: &PromptHeaderSource,
    ) -> PromptHeaderSource {
        if !self.selection.is_active() && !self.search.is_active() {
            if let Some(held) = self.held_reading.borrow().as_ref() {
                return self.prompt_header.source(&held.source, false);
            }
        }
        self.prompt_header
            .source(current, self.selection.is_active())
    }

    pub(crate) fn snapshot_scroll(&self, area: Rect, fallback: usize) -> usize {
        if self.selection.is_active() {
            return self.selection.frozen_scroll(area, fallback);
        }
        self.held_reading
            .borrow()
            .as_ref()
            .map_or(fallback, |held| held.layout.rewrap(area).scroll)
    }

    pub(crate) fn update_snapshot_layout(&self, area: Rect, scroll: usize) {
        if self.selection.is_active() {
            return;
        }
        if let Some(held) = self.held_reading.borrow_mut().as_mut() {
            held.layout = held.layout.rewrap(area);
            held.layout.scroll = scroll;
        }
    }

    /// Scrolling joins current content when the retained top reaches an unchanged stable cell.
    pub(crate) fn scroll_held_reading(
        &mut self,
        rows: isize,
        lines: &[HyperlinkLine],
        source: &PromptHeaderSource,
    ) -> bool {
        let mut held = self.held_reading.borrow_mut();
        let Some(snapshot) = held.as_mut() else {
            return false;
        };
        snapshot.layout.scroll = snapshot.layout.scroll.saturating_add_signed(rows).min(
            snapshot
                .layout
                .rows
                .len()
                .saturating_sub(usize::from(snapshot.layout.area.height)),
        );
        if let Some(row) = snapshot.surviving_row(lines, source) {
            let layout = TextLayout::new(
                snapshot.layout.area,
                row,
                Arc::new(lines.to_vec()),
                Arc::new(HashSet::new()),
            );
            self.scroll = layout
                .rows
                .len()
                .saturating_sub(usize::from(layout.area.height))
                .saturating_sub(row);
            drop(held);
            self.release_live_reading();
        }
        true
    }
}
