use super::*;
use crate::history_cell::{HistoryCell, TranscriptHistoryCell};
use crate::locale::Locale;
use crate::projection::{EntryKind, TranscriptEntry};
use crate::transcript_view::{TranscriptContent, TranscriptDisclosure, TranscriptSelectionAction};
use crossterm::event::Event;
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::Modifier;

fn selection(entries: &[(&str, bool)], width: u16) -> TranscriptSelection {
    let mut content = TranscriptContent::default();
    for (index, (text, user)) in entries.iter().enumerate() {
        let entry = TranscriptEntry {
            id: index.to_string(),
            kind: if *user {
                EntryKind::User
            } else {
                EntryKind::Assistant
            },
            text: text.to_string(),
            streaming: false,
            status: None,
            summary: Vec::new(),
            activity_group: None,
            activity_detail: None,
        };
        let lines = TranscriptHistoryCell::new(entry, Locale::EnUs, "/workspace".into())
            .display_hyperlink_lines(width.saturating_sub(2).max(1));
        content.push_copyable_lines(index.to_string(), lines, text.to_string(), *user);
    }
    let transcript = TranscriptDisclosure::default().materialize(&content, Locale::EnUs, width);
    let selection = TranscriptSelection::default();
    selection.update_layout_with_exclusions(
        Rect::new(0, 0, width, 8),
        usize::MAX,
        &transcript.lines,
        &transcript.excluded_lines,
    );
    assert!(selection.begin_copy_mode(&transcript));
    selection
}

fn key(selection: &TranscriptSelection, code: KeyCode) -> TranscriptSelectionAction {
    selection
        .handle_event(&Event::Key(KeyEvent::new(code, KeyModifiers::NONE)))
        .unwrap()
}

fn copied(selection: &TranscriptSelection) -> (String, CopyFormat) {
    let TranscriptSelectionAction::Copy {
        text,
        format,
        follow,
    } = key(selection, KeyCode::Enter)
    else {
        panic!("Enter must copy the semantic target")
    };
    assert!(follow);
    (text, format)
}

#[test]
fn navigation_uses_original_response_code_and_quote_payloads() {
    let source = "**reply**\n\n```rust\n  let x = 1;\n\n  x\n```\n\n> **quoted**\n> next\n";
    let selection = selection(&[(source, false)], 30);
    assert_eq!(copied(&selection), (source.into(), CopyFormat::Markdown));
    key(&selection, KeyCode::Up);
    assert_eq!(
        selection.copy_target_kind(),
        Some(CopyTargetKind::Blockquote)
    );
    assert_eq!(
        copied(&selection),
        ("**quoted**\nnext\n".into(), CopyFormat::PlainText)
    );
    key(&selection, KeyCode::Char('k'));
    assert_eq!(
        copied(&selection),
        ("  let x = 1;\n\n  x\n".into(), CopyFormat::PlainText)
    );
    key(&selection, KeyCode::Char('j'));
    assert_eq!(
        selection.copy_target_kind(),
        Some(CopyTargetKind::Blockquote)
    );
    key(&selection, KeyCode::End);
    assert_eq!(copied(&selection).0, source);
}

#[test]
fn equal_adjacent_blocks_keep_distinct_source_identity() {
    let selection = selection(
        &[(
            "```\nsame\n```\n```\nsame\n```\n\n> same\n\n> same\n",
            false,
        )],
        30,
    );
    let mode = selection.copy_mode.borrow();
    let targets = &mode.as_ref().unwrap().targets;
    assert_eq!(
        targets
            .iter()
            .filter(|target| target.kind == CopyTargetKind::CodeBlock)
            .count(),
        2
    );
    assert_eq!(
        targets
            .iter()
            .filter(|target| target.kind == CopyTargetKind::Blockquote)
            .count(),
        2
    );
    assert_ne!(targets[0].start, targets[1].start);
    assert!(!Arc::ptr_eq(&targets[0].text, &targets[1].text));
}

#[test]
fn markdown_table_fence_is_rendered_as_a_table_and_copied_as_original_code() {
    for width in [12, 30, 80] {
        let table = "| A | B |\n| --- | --- |\n| **one** | two |\n";
        let source = format!("```md\n{table}```\n");
        let selection = selection(&[(&source, false)], width);
        let visible = selection
            .snapshot_lines()
            .unwrap()
            .iter()
            .map(|line| line.line.to_string())
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            !visible.contains("**one**"),
            "Markdown table must use the table renderer at width {width}: {visible}"
        );
        key(&selection, KeyCode::Up);
        assert_eq!(
            selection.copy_target_kind(),
            Some(CopyTargetKind::CodeBlock)
        );
        assert_eq!(copied(&selection), (table.into(), CopyFormat::PlainText));
        key(&selection, KeyCode::Down);
        assert_eq!(copied(&selection), (source, CopyFormat::Markdown));
    }
}

#[test]
fn quote_with_nested_code_retains_both_targets() {
    let source = "> words\n>\n> ```rust\n> let 中文 = 1;\n> ```\n>\n> after\n";
    let selection = selection(&[(source, false)], 30);
    let mode = selection.copy_mode.borrow();
    let targets = &mode.as_ref().unwrap().targets;
    assert_eq!(
        targets
            .iter()
            .filter(|target| target.kind == CopyTargetKind::Blockquote)
            .count(),
        1
    );
    assert_eq!(
        targets
            .iter()
            .filter(|target| target.kind == CopyTargetKind::CodeBlock)
            .count(),
        1
    );
    drop(mode);
    key(&selection, KeyCode::Up);
    assert_eq!(
        copied(&selection),
        ("let 中文 = 1;\n".into(), CopyFormat::PlainText)
    );
    key(&selection, KeyCode::Up);
    assert_eq!(
        copied(&selection).0,
        "words\n\n```rust\nlet 中文 = 1;\n```\n\nafter\n"
    );
}

#[test]
fn user_message_and_its_blocks_exclude_terminal_gutters_and_attachment_labels() {
    let message = "prompt 😀\n\n```rust\nlet 中文 = 1;\n```\n\n> **literal**\n";
    let selection = selection(&[(message, true), ("answer", false)], 28);
    key(&selection, KeyCode::Home);
    assert_eq!(copied(&selection), (message.into(), CopyFormat::PlainText));
    key(&selection, KeyCode::Down);
    assert_eq!(
        copied(&selection),
        ("let 中文 = 1;\n".into(), CopyFormat::PlainText)
    );
    key(&selection, KeyCode::Down);
    assert_eq!(
        copied(&selection),
        ("> **literal**\n".into(), CopyFormat::PlainText)
    );
    key(&selection, KeyCode::Char('G'));
    assert_eq!(copied(&selection), ("answer".into(), CopyFormat::Markdown));
}

#[test]
fn frozen_payload_and_block_identity_survive_projection_replacement_and_reflow() {
    let source = "```rust\nlet very_long_identifier = \"中文😀\";\n```\n\n> long quoted words for wrapping\n";
    let selection = selection(&[(source, false)], 40);
    key(&selection, KeyCode::Up);
    key(&selection, KeyCode::Up);
    let expected = copied(&selection);
    selection.update_layout(
        Rect::new(0, 0, 12, 5),
        0,
        &[crate::terminal_hyperlinks::HyperlinkLine::from(
            "replacement",
        )],
    );
    assert_eq!(copied(&selection), expected);
    let snapshot = selection.snapshot_lines().unwrap();
    assert!(!snapshot
        .iter()
        .any(|line| line.line.to_string().contains("replacement")));
    let scroll = selection.reveal_copy_context().unwrap();
    assert!(scroll <= selection.layout.borrow().as_ref().unwrap().rows.len());
}

#[test]
fn navigation_absorbs_typing_releases_and_modifiers_and_escape_releases_snapshot() {
    let selection = selection(&[("```\ncode\n```", false)], 20);
    let start = copied(&selection);
    for event in [
        KeyEvent::new(KeyCode::Char('x'), KeyModifiers::NONE),
        KeyEvent::new(KeyCode::Up, KeyModifiers::CONTROL),
        KeyEvent::new_with_kind(KeyCode::Up, KeyModifiers::NONE, KeyEventKind::Release),
    ] {
        assert_eq!(
            selection.handle_event(&Event::Key(event)),
            Some(TranscriptSelectionAction::Consumed)
        );
        assert_eq!(copied(&selection), start);
    }
    key(&selection, KeyCode::Esc);
    assert!(!selection.is_active());
    assert!(selection.copy_target_kind().is_none());
}

#[test]
fn block_highlight_fills_blank_and_wrapped_rows_without_selecting_surrounding_context() {
    let selection = selection(
        &[(
            "before\n\n```\nlong code line\n\nafter\n```\n\noutside",
            false,
        )],
        12,
    );
    key(&selection, KeyCode::Up);
    selection.reveal_copy_context();
    let layout = selection.layout.borrow();
    let layout = layout.as_ref().unwrap();
    let mut buffer = Buffer::empty(layout.area);
    selection.render_highlight(&mut buffer);
    let mode = selection.copy_mode.borrow();
    let target = &mode.as_ref().unwrap().targets[mode.as_ref().unwrap().cursor];
    for (index, row) in layout
        .rows
        .iter()
        .enumerate()
        .skip(layout.scroll)
        .take(usize::from(layout.area.height))
    {
        let selected = (target.start.line..=target.end.line).contains(&row.line);
        for column in 0..layout.area.width {
            assert_eq!(
                buffer[(column, (index - layout.scroll) as u16)]
                    .modifier
                    .contains(Modifier::REVERSED),
                selected,
                "row {index}, column {column}"
            );
        }
    }
}

#[test]
fn empty_transcript_has_no_copy_mode_or_frozen_selection() {
    let transcript = TranscriptDisclosure::default().materialize(
        &TranscriptContent::default(),
        Locale::EnUs,
        30,
    );
    let selection = TranscriptSelection::default();
    selection.update_layout(Rect::new(0, 0, 30, 8), 0, &[]);
    assert!(!selection.begin_copy_mode(&transcript));
    assert!(!selection.is_active());
}

#[test]
fn copy_navigation_and_empty_state_cover_all_product_locales() {
    for locale in [
        Locale::ZhCn,
        Locale::ZhTw,
        Locale::EnUs,
        Locale::JaJp,
        Locale::KoKr,
    ] {
        assert!(!locale.transcript_nothing_to_copy().is_empty());
        let hints = [
            CopyTargetKind::WholeResponse,
            CopyTargetKind::UserMessage,
            CopyTargetKind::CodeBlock,
            CopyTargetKind::Blockquote,
        ]
        .map(|kind| locale.transcript_copy_mode_title(kind));
        for hint in &hints {
            assert!(!hint.is_empty());
        }
        assert!(locale.transcript_copy_mode_navigation().contains("enter"));
        assert!(locale.transcript_copy_mode_navigation().contains("esc"));
        assert!(locale.transcript_copy_mode_navigation().contains("g/G"));
        let mut unique = std::collections::HashSet::new();
        for hint in hints {
            assert!(unique.insert(hint));
        }
    }
}
