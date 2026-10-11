use crossterm::event::{Event, KeyModifiers, MouseButton, MouseEvent, MouseEventKind};
use ratatui::layout::Rect;
use ratatui::style::Style;

use crate::clipboard_copy::CopyFormat;
use crate::markdown_render::render_markdown_lines_with_width;
use crate::terminal_hyperlinks::HyperlinkLine;
use crate::transcript_view::TranscriptSelection;

fn mouse(kind: MouseEventKind, x: u16, y: u16) -> Event {
    Event::Mouse(MouseEvent {
        kind,
        column: x,
        row: y,
        modifiers: KeyModifiers::NONE,
    })
}

fn copy(lines: &[HyperlinkLine], start: (u16, u16), end: (u16, u16)) -> (String, CopyFormat) {
    let selection = TranscriptSelection::default();
    selection.update_layout(Rect::new(0, 0, 200, lines.len() as u16 + 1), 0, lines);
    selection.handle_event(&mouse(
        MouseEventKind::Down(MouseButton::Left),
        start.0,
        start.1,
    ));
    selection.handle_event(&mouse(
        MouseEventKind::Drag(MouseButton::Left),
        end.0,
        end.1,
    ));
    selection.handle_event(&mouse(MouseEventKind::Up(MouseButton::Left), end.0, end.1));
    selection.copy_selected_text().expect("nonempty selection")
}

fn whole(input: &str, width: Option<usize>) -> (String, CopyFormat) {
    let lines = render_markdown_lines_with_width(input, Style::default(), width);
    copy(&lines, (0, 0), (199, lines.len() as u16 - 1))
}

fn markdown(format: CopyFormat) -> String {
    let CopyFormat::MarkdownSelection(markdown) = format else {
        panic!("expected semantic Markdown, got {format:?}");
    };
    markdown.to_string()
}

#[test]
fn partial_strong_selection_balances_markup_without_hidden_words() {
    let lines = render_markdown_lines_with_width("**Hello** world", Style::default(), None);
    let (text, format) = copy(&lines, (1, 0), (4, 0));
    assert_eq!(text, "ell");
    assert_eq!(markdown(format), "**ell**");
}

#[test]
fn nested_inline_styles_and_unicode_keep_the_selected_literal_text() {
    let (text, format) = whole("**粗体 _强调_** 与 ~~删除~~", None);
    assert_eq!(text, "粗体 强调 与 删除");
    let html = crate::clipboard_html::render_markdown(&markdown(format));
    assert!(
        html.contains("<strong>粗体 <em>强调</em></strong>"),
        "{html}"
    );
    assert!(html.contains("<del>删除</del>"), "{html}");
}

#[test]
fn partial_web_link_uses_authoritative_destination() {
    let lines =
        render_markdown_lines_with_width("[Guide](https://example.test/a)", Style::default(), None);
    let (text, format) = copy(&lines, (1, 0), (4, 0));
    assert_eq!(text, "uid");
    assert_eq!(markdown(format), "[uid](<https://example.test/a>)");
}

#[test]
fn inline_code_only_remains_plain_and_mixed_code_uses_a_balanced_fence() {
    let lines = render_markdown_lines_with_width("`a*b` and **bold**", Style::default(), None);
    assert_eq!(
        copy(&lines, (0, 0), (3, 0)),
        ("a*b".into(), CopyFormat::PlainText)
    );
    let (text, format) = whole("`a*b` and **bold**", None);
    assert_eq!(text, "a*b and bold");
    assert_eq!(markdown(format), "`a*b` and **bold**");
}

#[test]
fn quote_only_copy_omits_quote_gutters_from_source_metadata() {
    let lines = render_markdown_lines_with_width("> **quoted**\n> next", Style::default(), None);
    let mut lines_without_color = lines.clone();
    for line in &mut lines_without_color {
        for span in &mut line.line.spans {
            span.style = Style::default();
        }
    }
    assert_eq!(
        copy(&lines_without_color, (0, 0), (199, 1)),
        ("quoted\nnext".into(), CopyFormat::PlainText)
    );
    assert_eq!(whole("\\> literal", None).0, "> literal");
}

#[test]
fn code_only_copy_removes_synthetic_indent_but_retains_literal_whitespace() {
    let (text, format) = whole("```rust\n  let x = 1;\n\tlet y = 2;\n```", None);
    assert_eq!(text, "  let x = 1;\n\tlet y = 2;");
    assert_eq!(format, CopyFormat::PlainText);
}

#[test]
fn mixed_prose_and_code_do_not_interpret_tool_output_as_markdown() {
    let (text, format) = whole("**intro**\n\n```\n*literal*\n```", None);
    assert_eq!(text, "intro\n\n*literal*");
    assert_eq!(markdown(format), "**intro**\n\n```\n*literal*\n```");
}

#[test]
fn headings_lists_and_task_markers_keep_semantics_without_terminal_styles() {
    for input in [
        "# Heading\n\n- **one**\n- two",
        "- [x] **done**\n- [ ] next",
    ] {
        let (text, format) = whole(input, None);
        assert!(!text.contains("**"), "{text}");
        let serialized = markdown(format);
        let html = crate::clipboard_html::render_markdown(&serialized);
        if input.starts_with('#') {
            assert!(html.contains("<h1>Heading</h1>"), "{html}");
        } else {
            assert!(serialized.contains("[x] "), "{serialized}");
            assert!(serialized.contains("[ ] "), "{serialized}");
        }
        assert!(html.contains("<strong>"), "{html}");
    }
}

#[test]
fn table_grid_copy_removes_padding_and_preserves_cell_styles() {
    let (text, format) = whole("| A | B |\n| --- | ---: |\n| **one** | two |", Some(40));
    assert_eq!(text, "| A | B |\n|---|---:|\n| one | two |");
    let serialized = markdown(format);
    assert_eq!(serialized, "| A | B |\n|---|---:|\n| **one** | two |");
}

#[test]
fn partial_table_cell_does_not_pull_unselected_headers_or_cells() {
    let lines = render_markdown_lines_with_width(
        "| A | B |\n| --- | --- |\n| **one** | hidden |",
        Style::default(),
        Some(40),
    );
    let (text, format) = copy(&lines, (1, 2), (4, 2));
    assert_eq!(text, "one");
    assert_eq!(markdown(format), "**one**");
}

#[test]
fn wrapped_table_fragments_share_identity_and_restore_whitespace() {
    let input = "| Field | Description |\n| --- | --- |\n| X | alpha beta gamma delta epsilon |";
    let (text, format) = whole(input, Some(27));
    assert!(!text.contains('━'), "{text}");
    let serialized = markdown(format);
    assert!(
        serialized.contains("alpha beta gamma delta epsilon"),
        "{serialized}"
    );
    assert_eq!(serialized.matches("alpha").count(), 1, "{serialized}");
}

#[test]
fn quoted_table_preserves_cells_without_quote_markers_or_hidden_text() {
    let (text, format) = whole(
        "> | A | B |\n> | --- | --- |\n> | **one** | two |",
        Some(40),
    );
    assert_eq!(text, "| A | B |\n|---|---|\n| one | two |");
    assert_eq!(markdown(format), "| A | B |\n|---|---|\n| **one** | two |");
}

#[test]
fn local_file_target_stays_literal_in_plain_and_mixed_copy() {
    let (text, format) = whole("[a[b]*.rs](./a%5Bb%5D*.rs)", None);
    assert_eq!(text, "./a[b]*.rs");
    assert_eq!(format, CopyFormat::PlainText);
    let (text, format) = whole("[**source**](./a%5Bb%5D*.rs) and **bold**", None);
    assert_eq!(text, "source (./a[b]*.rs) and bold");
    let serialized = markdown(format);
    assert!(serialized.contains("**source**"), "{serialized}");
    assert!(serialized.contains("./a\\[b\\]\\*.rs"), "{serialized}");
    assert!(crate::clipboard_html::render_markdown(&serialized).contains("./a[b]*.rs"));
}

#[test]
fn literal_user_text_is_escaped_as_prose_when_copied_with_assistant_markdown() {
    use crate::history_cell::{AgentMessageCell, HistoryCell, UserHistoryCell};
    let mut lines = UserHistoryCell::new("*user*\nnext").display_hyperlink_lines(200);
    lines.extend(AgentMessageCell::new("**answer**", false).display_hyperlink_lines(200));
    let (text, format) = copy(&lines, (0, 0), (199, lines.len() as u16 - 1));
    assert_eq!(text, "*user*\nnext\nanswer");
    assert_eq!(markdown(format), "\\*user\\*  \nnext  \n**answer**");
}

#[test]
fn selection_freezes_semantic_metadata_across_streaming_replacement_and_resize() {
    let original = render_markdown_lines_with_width("**original**", Style::default(), None);
    let selection = TranscriptSelection::default();
    selection.update_layout(Rect::new(0, 0, 20, 3), 0, &original);
    selection.handle_event(&mouse(MouseEventKind::Down(MouseButton::Left), 0, 0));
    selection.handle_event(&mouse(MouseEventKind::Drag(MouseButton::Left), 8, 0));
    selection.handle_event(&mouse(MouseEventKind::Up(MouseButton::Left), 8, 0));
    let updated = render_markdown_lines_with_width("_replacement_", Style::default(), None);
    selection.update_layout(Rect::new(0, 0, 5, 3), 0, &updated);
    let (text, format) = selection.copy_selected_text().unwrap();
    assert_eq!(text, "original");
    assert_eq!(markdown(format), "**original**");
}

#[test]
fn excluded_wrapped_rows_cannot_reenter_through_shared_logical_origin() {
    let source = render_markdown_lines_with_width("**alpha secret omega**", Style::default(), None);
    let wrapped = crate::terminal_hyperlinks::wrap_hyperlink_line(&source[0], 6);
    assert_eq!(wrapped.len(), 3);
    let selection = TranscriptSelection::default();
    selection.update_layout_with_exclusions(
        Rect::new(0, 0, 200, 4),
        0,
        &wrapped,
        &std::collections::HashSet::from([1]),
    );
    selection.handle_event(&mouse(MouseEventKind::Down(MouseButton::Left), 0, 0));
    selection.handle_event(&mouse(MouseEventKind::Drag(MouseButton::Left), 199, 2));
    selection.handle_event(&mouse(MouseEventKind::Up(MouseButton::Left), 199, 2));
    let (text, format) = selection.copy_selected_text().unwrap();
    assert_eq!(text, "alpha\nomega");
    assert_eq!(markdown(format), "**alpha**\n**omega**");
}
