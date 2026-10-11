//! Semantic copy navigation over the selection's frozen transcript revision.
//! Payloads remain independent of terminal gutters, wrapping and live projection updates.

use super::disclosure::MaterializedTranscript;
use super::selection::{Anchor, Selection};
use super::TranscriptSelection;
use crate::clipboard_copy::CopyFormat;
use crate::text_selection::SelectionUnit;
use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use std::ops::Range;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CopyTargetKind {
    WholeResponse,
    UserMessage,
    CodeBlock,
    Blockquote,
}

impl CopyTargetKind {
    pub(super) fn format(self) -> CopyFormat {
        match self {
            Self::WholeResponse => CopyFormat::Markdown,
            Self::UserMessage | Self::CodeBlock | Self::Blockquote => CopyFormat::PlainText,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct CopyEntry {
    pub(super) lines: Range<usize>,
    pub(super) text: Arc<str>,
    pub(super) user: bool,
}

#[derive(Debug)]
pub(super) struct CopyTarget {
    pub(super) start: Anchor,
    pub(super) end: Anchor,
    pub(super) kind: CopyTargetKind,
    pub(super) text: Arc<str>,
}

#[derive(Debug)]
pub(super) struct CopyMode {
    pub(super) targets: Vec<CopyTarget>,
    pub(super) cursor: usize,
    pub(super) reveal: std::cell::Cell<bool>,
    history_request: std::cell::Cell<Option<crate::app_event::OlderHistoryLoadMode>>,
}

impl TranscriptSelection {
    pub(crate) fn begin_copy_mode(&self, transcript: &MaterializedTranscript) -> bool {
        let layout = self.layout.borrow();
        let Some(layout) = layout.as_ref() else {
            return false;
        };
        let targets = copy_targets(transcript, layout, true);
        if targets.is_empty() {
            return false;
        }
        let cursor = targets.len() - 1;
        self.copy_mode.replace(Some(CopyMode {
            targets,
            cursor,
            reveal: std::cell::Cell::new(true),
            history_request: std::cell::Cell::new(None),
        }));
        self.select_copy_target();
        true
    }

    pub(crate) fn take_copy_history_request(
        &self,
    ) -> Option<crate::app_event::OlderHistoryLoadMode> {
        self.copy_mode.borrow().as_ref()?.history_request.take()
    }

    /// Semantic targets retain their identity when the shared snapshot mutation inserts history.
    pub(super) fn remap_copy_targets(
        &self,
        transcript: &MaterializedTranscript,
        next: &super::text::TextLayout,
        inserted: Range<usize>,
    ) -> bool {
        let mut mode = self.copy_mode.borrow_mut();
        let Some(mode) = mode.as_mut() else {
            return true;
        };
        let shift = |anchor: &mut Anchor| {
            if anchor.line >= inserted.start {
                anchor.line += inserted.len();
            }
        };
        let current = &mode.targets[mode.cursor];
        let (mut start, mut end, kind) = (current.start, current.end, current.kind);
        shift(&mut start);
        shift(&mut end);
        let targets = copy_targets(
            transcript,
            next,
            mode.targets
                .last()
                .is_some_and(|target| target.kind == CopyTargetKind::WholeResponse),
        );
        let Some(cursor) = targets
            .iter()
            .position(|target| (target.start, target.end, target.kind) == (start, end, kind))
        else {
            return false;
        };
        mode.targets = targets;
        mode.cursor = cursor;
        true
    }

    pub(crate) fn copy_target_kind(&self) -> Option<CopyTargetKind> {
        let mode = self.copy_mode.borrow();
        let mode = mode.as_ref()?;
        Some(mode.targets[mode.cursor].kind)
    }

    pub(super) fn handle_copy_mode_key(
        &self,
        key: KeyEvent,
    ) -> Option<super::TranscriptSelectionAction> {
        self.copy_mode.borrow().as_ref()?;
        if key.kind == KeyEventKind::Release {
            return Some(super::TranscriptSelectionAction::Consumed);
        }
        if key.code == KeyCode::Enter && key.modifiers.is_empty()
            || crate::text_selection::is_copy_key(key)
        {
            let (text, format) = self.copy_selected_text()?;
            return Some(super::TranscriptSelectionAction::Copy {
                text,
                format,
                follow: true,
            });
        }
        if key.code == KeyCode::Esc && key.modifiers.is_empty() {
            self.clear();
            return Some(super::TranscriptSelectionAction::Consumed);
        }
        let direction = match (key.code, key.modifiers) {
            (KeyCode::Up | KeyCode::Char('k'), KeyModifiers::NONE) => Some(-1),
            (KeyCode::Down | KeyCode::Char('j'), KeyModifiers::NONE) => Some(1),
            (KeyCode::Home | KeyCode::Char('g'), KeyModifiers::NONE) => Some(isize::MIN),
            (KeyCode::End, KeyModifiers::NONE)
            | (KeyCode::Char('G'), KeyModifiers::NONE | KeyModifiers::SHIFT)
            | (KeyCode::Char('g'), KeyModifiers::SHIFT) => Some(isize::MAX),
            _ => None,
        };
        if let Some(direction) = direction {
            if let Some(mode) = self.copy_mode.borrow_mut().as_mut() {
                if direction == isize::MIN || direction == -1 && mode.cursor == 0 {
                    mode.history_request.set(Some(if direction == isize::MIN {
                        crate::app_event::OlderHistoryLoadMode::All
                    } else {
                        crate::app_event::OlderHistoryLoadMode::OnePage
                    }));
                }
                mode.cursor = mode
                    .cursor
                    .saturating_add_signed(direction)
                    .min(mode.targets.len() - 1);
            }
            self.select_copy_target();
        } else if key.modifiers.is_empty()
            && matches!(key.code, KeyCode::PageUp | KeyCode::PageDown)
        {
            let page = self
                .layout
                .borrow()
                .as_ref()
                .map_or(1, |layout| usize::from(layout.area.height).max(1));
            let rows = isize::try_from(page).unwrap_or(isize::MAX);
            return Some(super::TranscriptSelectionAction::Scroll {
                rows: if key.code == KeyCode::PageUp {
                    -rows
                } else {
                    rows
                },
            });
        }
        Some(super::TranscriptSelectionAction::Consumed)
    }

    fn select_copy_target(&self) {
        let mode = self.copy_mode.borrow();
        let Some(mode) = mode.as_ref() else { return };
        let target = &mode.targets[mode.cursor];
        mode.reveal.set(true);
        let layout = self.layout.borrow();
        let Some(layout) = layout.as_ref() else {
            return;
        };
        self.selection.replace(Some(Selection {
            pending_copy: None,
            primary_scope: None,
            snapshot: Arc::clone(&layout.lines),
            excluded_lines: Arc::clone(&layout.excluded_lines),
            start: target.start,
            end: target.end,
            origin: (target.start, target.end),
            unit: SelectionUnit::Character,
            dragging: false,
            moved: false,
            moved_vertically: false,
            pointer_origin_row: layout.area.y,
            pointer: None,
            pressed_link: None,
            preferred_column: None,
        }));
    }

    /// Reveal targets inside a central band; oversized blocks retain context above their start.
    pub(crate) fn reveal_copy_context(&self) -> Option<usize> {
        let mode = self.copy_mode.borrow();
        let mode = mode.as_ref()?;
        let target = &mode.targets[mode.cursor];
        let mut layout = self.layout.borrow_mut();
        let layout = layout.as_mut()?;
        if !mode.reveal.replace(false) {
            return Some(layout.scroll);
        }
        let first = layout.row_for_anchor(target.start)?;
        let end = Anchor {
            offset: target.end.offset.saturating_sub(1),
            ..target.end
        };
        let last = layout.row_for_anchor(end)?;
        let height = usize::from(layout.area.height).max(1);
        let target_height = last.saturating_sub(first) + 1;
        let free = height.saturating_sub(target_height);
        let margin = (height / 4).max(1).min(free / 2);
        let bottom_margin = (height / 4).max(1).min(free.div_ceil(2));
        let inner_top = layout.scroll + margin;
        let inner_bottom = layout.scroll + height.saturating_sub(bottom_margin + 1);
        if target_height >= height || first < inner_top || last > inner_bottom {
            let inset = if target_height >= height {
                height / 4
            } else if first < inner_top {
                margin
            } else {
                height - bottom_margin - target_height
            };
            layout.scroll = first
                .saturating_sub(inset)
                .min(layout.rows.len().saturating_sub(height));
        }
        Some(layout.scroll)
    }
}

fn copy_targets(
    transcript: &MaterializedTranscript,
    layout: &super::text::TextLayout,
    include_response: bool,
) -> Vec<CopyTarget> {
    let mut targets = Vec::new();
    let mut response = None;
    for entry in &transcript.copy_entries {
        if entry.text.trim().is_empty() || entry.lines.is_empty() {
            continue;
        }
        let first = entry.lines.start;
        let last = entry.lines.end - 1;
        let whole = CopyTarget {
            start: Anchor {
                line: first,
                offset: 0,
            },
            end: Anchor {
                line: last,
                offset: layout.texts[last].len(),
            },
            kind: if entry.user {
                CopyTargetKind::UserMessage
            } else {
                CopyTargetKind::WholeResponse
            },
            text: Arc::clone(&entry.text),
        };
        if entry.user {
            targets.push(whole);
            targets.extend(user_targets(entry, layout));
        } else {
            response = Some(whole);
            for (lines, kind, text) in layout.copy_block_ranges(entry.lines.clone()) {
                targets.push(CopyTarget {
                    start: Anchor {
                        line: lines.start,
                        offset: 0,
                    },
                    end: Anchor {
                        line: lines.end - 1,
                        offset: layout.texts[lines.end - 1].len(),
                    },
                    kind,
                    text,
                });
            }
        }
    }
    targets.sort_by_key(|target| (target.start, std::cmp::Reverse(target.end)));
    // The latest whole response is the final target, following all visible source blocks.
    if let Some(response) = response.filter(|_| include_response) {
        targets.push(response);
    }
    targets
}

fn user_targets(entry: &CopyEntry, layout: &super::text::TextLayout) -> Vec<CopyTarget> {
    use pulldown_cmark::{Event, Parser, Tag, TagEnd};
    let mut targets = Vec::new();
    let mut quote_depth = 0;
    let mut code: Option<(Range<usize>, String)> = None;
    for (event, range) in Parser::new(&entry.text).into_offset_iter() {
        match event {
            Event::Start(Tag::BlockQuote) => {
                if quote_depth == 0 {
                    if let Some((start, end)) = source_anchors(entry, layout, range.clone()) {
                        targets.push(CopyTarget {
                            start,
                            end,
                            kind: CopyTargetKind::Blockquote,
                            text: Arc::from(&entry.text[range]),
                        });
                    }
                }
                quote_depth += 1;
            }
            Event::End(TagEnd::BlockQuote) => quote_depth -= 1,
            Event::Start(Tag::CodeBlock(_)) => {
                code = Some((range.start..range.start, String::new()))
            }
            Event::Text(text) => {
                if let Some((source, content)) = code.as_mut() {
                    if content.is_empty() {
                        source.start = range.start;
                    }
                    source.end = range.end;
                    content.push_str(&text);
                }
            }
            Event::End(TagEnd::CodeBlock) => {
                if let Some((range, text)) = code.take() {
                    if let Some((start, end)) = source_anchors(entry, layout, range) {
                        targets.push(CopyTarget {
                            start,
                            end,
                            kind: CopyTargetKind::CodeBlock,
                            text: text.into(),
                        });
                    }
                }
            }
            _ => {}
        }
    }
    targets
}

fn source_anchors(
    entry: &CopyEntry,
    layout: &super::text::TextLayout,
    range: Range<usize>,
) -> Option<(Anchor, Anchor)> {
    if range.is_empty() {
        return None;
    }
    let anchor = |offset: usize| {
        let mut consumed = 0;
        for (index, line) in entry.text.split_inclusive('\n').enumerate() {
            if offset < consumed + line.len() || consumed + line.len() == entry.text.len() {
                let line_index = entry.lines.start + index;
                if !entry.lines.contains(&line_index) {
                    return None;
                }
                let prefix = layout
                    .lines
                    .get(line_index)?
                    .source
                    .as_ref()
                    .map_or(0, |source| source.prefix_bytes);
                return Some(Anchor {
                    line: line_index,
                    offset: prefix
                        + offset
                            .saturating_sub(consumed)
                            .min(line.trim_end_matches(['\r', '\n']).len()),
                });
            }
            consumed += line.len();
        }
        None
    };
    let start = anchor(range.start)?;
    let mut end = anchor(range.end - 1)?;
    end.offset = (end.offset + 1).min(layout.texts[end.line].len());
    Some((start, end))
}

#[cfg(test)]
#[path = "copy_mode_tests.rs"]
mod tests;
