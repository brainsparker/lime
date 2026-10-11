//! Copy targets and bounded previews in the shared picker.
//! Preview truncation never changes the source text sent to the clipboard.

use std::cell::Cell;
use std::sync::Arc;

use crossterm::event::{Event, KeyCode, KeyEventKind, KeyModifiers};
use ratatui::layout::Rect;
use ratatui::text::{Line, Span};
use ratatui::Frame;

use super::ChatWidget;
use crate::bottom_pane::list_selection_view::{self, ListSelectionView};
use crate::bottom_pane::selection_row_layout::SelectionRow;
use crate::keymap::{KeyChordMatcher, KeymapMatch, ListAction, ListKeymap};
use crate::locale::Locale;
use crate::status::StatusSnapshot;
use crate::text_formatting::truncate_text;
use app_server_protocol::protocol::v2::{ServerNotification, ThreadItem};

#[derive(Debug)]
pub(crate) struct StatusCopySource {
    pub(crate) handle: Arc<StatusSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct CopyChoice {
    label: String,
    text: Arc<str>,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum CopyPickerAction {
    None,
    Cancel,
    Copy { text: String, label: String },
}

#[derive(Debug)]
pub(crate) struct CopyPicker {
    choices: Vec<CopyChoice>,
    selected: usize,
    page_rows: Cell<usize>,
    keymap: ListKeymap,
    chord_matcher: KeyChordMatcher,
}

impl ChatWidget {
    pub(crate) fn observe_copy_source(&mut self, notification: &ServerNotification) {
        let replaced = match notification {
            ServerNotification::TurnStarted(_)
            | ServerNotification::AgentMessageDelta(_)
            | ServerNotification::ThreadClosed(_) => true,
            ServerNotification::ItemStarted(params) => matches!(
                params.item,
                ThreadItem::AgentMessage { .. } | ThreadItem::UserMessage { .. }
            ),
            ServerNotification::ItemCompleted(params) => matches!(
                params.item,
                ThreadItem::AgentMessage { .. } | ThreadItem::UserMessage { .. }
            ),
            _ => false,
        };
        if replaced {
            self.last_status_copy_targets = None;
        }
    }

    /// Status retains the exact snapshot displayed before later thread/configuration changes.
    pub(crate) fn show_copy_picker(&mut self) -> bool {
        let Some(source) = &self.last_status_copy_targets else {
            return false;
        };
        let mut choices = vec![CopyChoice {
            label: self.locale.copy_whole_status_label().to_owned(),
            text: Arc::from(source.handle.copy_text(self.locale)),
        }];
        choices.extend(
            source
                .handle
                .copy_fields(self.locale)
                .into_iter()
                .map(|(label, text)| CopyChoice {
                    label: label.to_owned(),
                    text: Arc::from(text),
                }),
        );
        self.dismiss_pager_overlay();
        self.bottom_pane.clear_completion_popup();
        self.copy_picker = Some(CopyPicker {
            choices,
            selected: 0,
            page_rows: Cell::new(1),
            keymap: self.runtime_keymap.list().clone(),
            chord_matcher: KeyChordMatcher::default(),
        });
        true
    }

    pub(crate) fn handle_copy_picker_event(&mut self, event: &Event) -> Option<CopyPickerAction> {
        let action = self.copy_picker.as_mut()?.handle_event(event);
        if !matches!(action, CopyPickerAction::None) {
            self.copy_picker = None;
        }
        Some(action)
    }
}

impl CopyPicker {
    fn accept(&self) -> CopyPickerAction {
        let choice = &self.choices[self.selected];
        CopyPickerAction::Copy {
            text: choice.text.to_string(),
            label: choice.label.clone(),
        }
    }

    fn handle_event(&mut self, event: &Event) -> CopyPickerAction {
        let Event::Key(key) = event else {
            self.chord_matcher.reset();
            return CopyPickerAction::None;
        };
        if key.kind == KeyEventKind::Release {
            return CopyPickerAction::None;
        }
        if key.code == KeyCode::Char('c') && key.modifiers == KeyModifiers::CONTROL {
            self.chord_matcher.reset();
            return CopyPickerAction::Cancel;
        }
        let last = self.choices.len() - 1;
        match self.keymap.dispatch(&mut self.chord_matcher, *key, false) {
            KeymapMatch::Completed(ListAction::Accept) if key.kind == KeyEventKind::Press => {
                return self.accept();
            }
            KeymapMatch::Completed(ListAction::Cancel) => return CopyPickerAction::Cancel,
            KeymapMatch::Completed(action) => {
                let page = self.page_rows.get().max(1);
                self.selected = match action {
                    ListAction::MoveUp => self.selected.checked_sub(1).unwrap_or(last),
                    ListAction::MoveDown => (self.selected + 1) % self.choices.len(),
                    ListAction::PageUp => self.selected.saturating_sub(page),
                    ListAction::PageDown => self.selected.saturating_add(page).min(last),
                    ListAction::JumpTop => 0,
                    ListAction::JumpBottom => last,
                    _ => self.selected,
                };
            }
            KeymapMatch::PassThrough
                if key.kind == KeyEventKind::Press && key.modifiers.is_empty() =>
            {
                if let KeyCode::Char(number @ '1'..='9') = key.code {
                    let index = (number as usize) - ('1' as usize);
                    if index < self.choices.len() {
                        self.selected = index;
                        return self.accept();
                    }
                }
            }
            _ => {}
        }
        CopyPickerAction::None
    }

    fn view(&self, locale: Locale) -> ListSelectionView<'_> {
        ListSelectionView {
            title: locale.copy_picker_title(),
            subtitle: Line::default(),
            query: None,
            entries: self
                .choices
                .iter()
                .enumerate()
                .map(|(index, choice)| {
                    let description = choice.text.lines().find(|line| !line.trim().is_empty());
                    let description = description.map(|line| truncate_text(line.trim(), 72));
                    SelectionRow::new(
                        &choice.label,
                        description,
                        vec![Span::raw(format!("{}. ", index + 1))],
                    )
                })
                .collect(),
            selected: self.selected,
            empty_text: "",
            keymap: &self.keymap,
            locale,
            footer: None,
        }
    }

    pub(crate) fn desired_height(&self, locale: Locale, width: u16) -> u16 {
        list_selection_view::desired_height(&self.view(locale), width)
    }

    pub(crate) fn render(&self, frame: &mut Frame<'_>, area: Rect, locale: Locale) {
        self.page_rows
            .set(list_selection_view::render(frame, area, &self.view(locale)));
    }
}

#[cfg(test)]
#[path = "copy_picker_tests.rs"]
mod tests;
