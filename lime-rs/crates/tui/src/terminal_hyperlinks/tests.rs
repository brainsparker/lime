use super::*;

#[test]
fn only_safe_web_destinations_receive_osc8() {
    assert!(osc8_hyperlink("https://example.com/a", "a").contains("\x1b]8;;"));
    assert_eq!(osc8_hyperlink("mailto:a@example.com", "a"), "a");
    assert_eq!(osc8_hyperlink("javascript:alert(1)", "a"), "a");
    assert_eq!(
        osc8_hyperlink("https://example.com/\u{1b}]8;;bad\u{7}safe", "a"),
        "\x1b]8;;https://example.com/]8;;badsafe\x07a\x1b]8;;\x07"
    );
}

#[test]
fn display_column_lookup_uses_the_same_safe_destination_boundary() {
    let mut line = HyperlinkLine::new(Line::from("safe bad"));
    line.hyperlinks.push(TerminalHyperlink::web(
        0..4,
        "https://example.com".to_string(),
    ));
    line.hyperlinks.push(TerminalHyperlink::web(
        5..8,
        "javascript:alert(1)".to_string(),
    ));

    assert_eq!(
        line.destination_at_column(2).as_deref(),
        Some("https://example.com")
    );
    assert_eq!(line.destination_at_column(4), None);
    assert_eq!(line.destination_at_column(6), None);
}

#[test]
fn discovers_punctuated_and_balanced_web_urls() {
    let destination = "https://en.wikipedia.org/wiki/Function_(mathematics)";
    assert_eq!(
        web_links_in_text(&format!("See ({destination}).")),
        vec![TerminalHyperlink::web(
            5..5 + display_width(destination),
            destination.to_string(),
        )]
    );
}

#[test]
fn oversized_destinations_remain_plain_text() {
    let prefix = "https://example.com/";
    let destination = format!(
        "{prefix}{}",
        "a".repeat(MAX_HYPERLINK_DESTINATION_BYTES - prefix.len())
    );
    assert_eq!(web_destination(&destination), Some(destination.clone()));
    assert_eq!(web_destination(&format!("{destination}é")), None);
}

#[test]
fn buffer_hyperlinks_follow_scrolled_wrapped_rows() {
    let hidden_destination = "https://example.com/hidden";
    let visible_destination = "https://example.com/visible";
    let mut hidden = HyperlinkLine::new(Line::default());
    hidden.push_span("hidden".into(), Some(hidden_destination));
    let mut visible = HyperlinkLine::new(Line::from("prefix "));
    visible.push_span("visible-link".into(), Some(visible_destination));
    let lines = vec![hidden, visible];
    let area = Rect::new(0, 0, 8, 2);
    let mut buffer = Buffer::empty(area);

    HyperlinkParagraph::new(&lines)
        .scroll(2)
        .render(area, &mut buffer);

    let linked_text = area
        .positions()
        .filter_map(|position| {
            let symbol = buffer[position].symbol();
            symbol
                .contains(&format!("\x1b]8;;{visible_destination}\x07"))
                .then(|| strip_osc8(symbol))
        })
        .collect::<String>();
    assert_eq!(linked_text, "visible-link");
}

#[test]
fn buffer_hyperlinks_follow_word_wrapping() {
    let destination = "https://example.com/path";
    let mut line = HyperlinkLine::new(Line::from(format!("See {destination} now")));
    line.hyperlinks.push(TerminalHyperlink::web(
        /*columns*/ 4..4 + display_width(destination),
        destination.to_string(),
    ));
    let area = Rect::new(0, 0, 18, 4);
    let mut buffer = Buffer::empty(area);

    HyperlinkParagraph::new(&[line]).render(area, &mut buffer);

    let linked_text = area
        .positions()
        .filter_map(|position| {
            let symbol = buffer[position].symbol();
            symbol
                .contains(&format!("\x1b]8;;{destination}\x07"))
                .then(|| strip_osc8(symbol))
        })
        .collect::<String>();
    assert_eq!(linked_text, destination);
}

#[test]
fn buffer_hyperlinks_follow_wrapped_wide_glyphs() {
    let destination = "https://example.com/wide";
    let mut line = HyperlinkLine::new(Line::from("前文 "));
    line.push_span("漢字漢字".into(), Some(destination));
    line.push_span(" 後文".into(), None);
    let area = Rect::new(0, 0, 6, 4);
    let mut buffer = Buffer::empty(area);

    Paragraph::new(Text::from(line.line.clone()))
        .wrap(Wrap { trim: false })
        .render(area, &mut buffer);
    mark_buffer_hyperlinks(&mut buffer, area, &[line], /*scroll_rows*/ 0);

    let linked_text = area
        .positions()
        .filter_map(|position| {
            let symbol = buffer[position].symbol();
            symbol
                .contains(&format!("\x1b]8;;{destination}\x07"))
                .then(|| strip_osc8(symbol))
        })
        .collect::<String>();
    assert_eq!(linked_text, "漢字漢字");
}

#[test]
fn buffer_hyperlinks_follow_wrapped_halfwidth_dakuten() {
    let destination = "https://example.com/dakuten";
    let mut line = HyperlinkLine::new(Line::from("ｶﾞ "));
    line.push_span("ﾊﾟlink".into(), Some(destination));
    line.push_span(" tail".into(), None);
    let area = Rect::new(0, 0, 5, 4);
    let mut buffer = Buffer::empty(area);

    Paragraph::new(Text::from(line.line.clone()))
        .wrap(Wrap { trim: false })
        .render(area, &mut buffer);
    mark_buffer_hyperlinks(&mut buffer, area, &[line], /*scroll_rows*/ 0);

    let linked_text = area
        .positions()
        .filter_map(|position| {
            let symbol = buffer[position].symbol();
            symbol
                .contains(&format!("\x1b]8;;{destination}\x07"))
                .then(|| strip_osc8(symbol))
        })
        .collect::<String>();
    assert_eq!(linked_text, "ﾊﾟlink");
}

#[test]
fn forced_width_hyperlinks_render_wide_and_halfwidth_cells_snapshot() {
    let destination = "https://example.com/rendered";
    let mut line = HyperlinkLine::new(Line::from("prefix "));
    line.push_span("漢字 ｶﾞ".into(), Some(destination));
    line.push_span(" tail".into(), None);
    let wrapped = wrap_hyperlink_line(&line, 14);
    assert!(
        wrapped.iter().any(|line| !line.hyperlinks.is_empty()),
        "source={line:#?} wrapped={wrapped:#?}"
    );
    let area = Rect::new(0, 0, 14, 3);
    let mut buffer = Buffer::empty(area);

    HyperlinkParagraph::new(&[line]).render(area, &mut buffer);

    let linked = area
        .positions()
        .filter_map(|position| {
            let cell = &buffer[position];
            cell.symbol()
                .contains(&format!("\x1b]8;;{destination}\x07"))
                .then(|| {
                    (
                        strip_osc8(cell.symbol()),
                        cell.cell_width(),
                        cell.diff_option,
                    )
                })
        })
        .collect::<Vec<_>>();
    assert_eq!(
        linked
            .iter()
            .map(|(text, _, _)| text.as_str())
            .collect::<String>(),
        "漢字 ｶﾞ",
        "buffer={buffer:#?}"
    );
    assert!(linked.iter().all(|(_, width, option)| {
        matches!(option, CellDiffOption::ForcedWidth(forced) if forced.get() == *width)
    }));
}

#[test]
fn buffer_hyperlinks_preserve_visible_cell_width_for_ratatui_diff() {
    let destination = "https://example.com/dakuten";
    let mut line = HyperlinkLine::new(Line::from("ｶﾞ tail"));
    line.hyperlinks.push(TerminalHyperlink::web(
        /*columns*/ 0..2,
        destination.to_string(),
    ));
    let area = Rect::new(0, 0, 7, 1);
    let previous = Buffer::with_lines(["       "]);
    let mut next = Buffer::empty(area);

    Paragraph::new(Text::from(line.line.clone())).render(area, &mut next);
    mark_buffer_hyperlinks(&mut next, area, &[line], /*scroll_rows*/ 0);

    assert_eq!(next[(0, 0)].cell_width(), 2);
    assert!(matches!(
        next[(0, 0)].diff_option,
        CellDiffOption::ForcedWidth(width) if width.get() == 2
    ));
    assert_eq!(
        previous
            .diff_iter(&next)
            .map(|(x, _, cell)| (x, strip_osc8(cell.symbol())))
            .collect::<Vec<_>>(),
        vec![
            (0, "ｶﾞ".to_string()),
            (3, "t".to_string()),
            (4, "a".to_string()),
            (5, "i".to_string()),
            (6, "l".to_string()),
        ]
    );
}

#[test]
fn wrapping_keeps_explicit_destination_on_every_fragment() {
    let destination = "https://example.com/a/very/long/path";
    let mut source = HyperlinkLine::new(Line::default());
    source.push_span(destination.into(), Some(destination));

    let wrapped = wrap_hyperlink_line(&source, 10);

    assert!(wrapped.len() > 1);
    assert!(wrapped.iter().all(|line| {
        !line.hyperlinks.is_empty()
            && line
                .hyperlinks
                .iter()
                .all(|link| link.destination == destination)
    }));
}

#[test]
fn strips_osc8_without_changing_visible_text() {
    let encoded = osc8_hyperlink("https://example.com", "visible");
    assert_eq!(strip_osc8(&encoded), "visible");
}
