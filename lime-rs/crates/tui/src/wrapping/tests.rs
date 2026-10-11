use super::*;
use ratatui::style::Stylize;
use ratatui::style::{Color, Style};

fn concat_line(line: &Line<'_>) -> String {
    line.spans
        .iter()
        .map(|span| span.content.as_ref())
        .collect()
}

fn rendered(lines: &[Line<'_>]) -> String {
    lines
        .iter()
        .map(|line| {
            line.spans
                .iter()
                .map(|span| span.content.as_ref())
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn word_wrap_preserves_styled_spans_and_indent() {
    let line = Line::from(vec![
        Span::styled("hello ", Style::default().fg(Color::Red)),
        Span::styled("world", Style::default().fg(Color::Green)),
    ]);
    let wrapped = word_wrap_line(&line, RtOptions::new(8).subsequent_indent(Line::from("  ")));
    assert_eq!(rendered(&wrapped), "hello\n  world");
    assert_eq!(wrapped[0].spans[0].style.fg, Some(Color::Red));
    assert_eq!(
        wrapped[1].spans.last().unwrap().style.fg,
        Some(Color::Green)
    );
}

#[test]
fn adaptive_wrap_keeps_url_token_intact() {
    let line = Line::from("see https://example.com/a-long/path now");
    let wrapped = adaptive_wrap_line(&line, RtOptions::new(18));
    let text = rendered(&wrapped);
    assert!(text.contains("https://example.com/a-long/path"));
    assert!(line_contains_url_like(&line));
}

#[test]
fn url_detection_rejects_file_paths() {
    assert!(text_contains_url_like("open https://example.com")
        .then_some(())
        .is_some());
    assert!(!text_contains_url_like("src/main.rs foo/bar"));
}

#[test]
fn wrap_ranges_are_utf8_safe() {
    let text = "你好 世界";
    let ranges = wrap_ranges_trim(text, Options::new(5));
    assert_eq!(
        ranges
            .iter()
            .map(|range| &text[range.clone()])
            .collect::<Vec<_>>(),
        vec!["你好", "世界"]
    );
    assert!(wrap_ranges(text, Options::new(5))
        .iter()
        .all(|range| range.end <= text.len() + 1));
}

#[test]
fn multiline_wrap_returns_owned_lines() {
    let lines = word_wrap_lines(["one two", "three"], 5usize);
    assert_eq!(rendered(&lines), "one\ntwo\nthree");
    assert!(lines.iter().all(|line| {
        line.spans
            .iter()
            .all(|span| matches!(span.content, Cow::Owned(_)))
    }));
}

#[test]
fn trivial_unstyled_no_indents_wide_width() {
    let line = Line::from("hello");
    let out = word_wrap_line(&line, 10);
    assert_eq!(out.len(), 1);
    assert_eq!(concat_line(&out[0]), "hello");
}

#[test]
fn simple_unstyled_wrap_narrow_width() {
    let line = Line::from("hello world");
    let out = word_wrap_line(&line, 5);
    assert_eq!(out.len(), 2);
    assert_eq!(concat_line(&out[0]), "hello");
    assert_eq!(concat_line(&out[1]), "world");
}

#[test]
fn simple_styled_wrap_preserves_styles() {
    let line = Line::from(vec!["hello ".red(), "world".into()]);
    let out = word_wrap_line(&line, 6);
    assert_eq!(out.len(), 2);
    assert_eq!(concat_line(&out[0]), "hello");
    assert_eq!(out[0].spans.len(), 1);
    assert_eq!(out[0].spans[0].style.fg, Some(Color::Red));
    assert_eq!(concat_line(&out[1]), "world");
    assert_eq!(out[1].spans.len(), 1);
    assert_eq!(out[1].spans[0].style.fg, None);
}

#[test]
fn with_initial_and_subsequent_indents() {
    let opts = RtOptions::new(8)
        .initial_indent(Line::from("- "))
        .subsequent_indent(Line::from("  "));
    let line = Line::from("hello world foo");
    let out = word_wrap_line(&line, opts);
    assert_eq!(concat_line(&out[0]), "- hello");
    assert_eq!(concat_line(&out[1]), "  world");
    assert_eq!(concat_line(&out[2]), "  foo");
}

#[test]
fn empty_initial_indent_subsequent_spaces() {
    let opts = RtOptions::new(8)
        .initial_indent(Line::from(""))
        .subsequent_indent(Line::from("    "));
    let line = Line::from("hello world foobar");
    let out = word_wrap_line(&line, opts);
    assert!(concat_line(&out[0]).starts_with("hello"));
    for line in &out[1..] {
        assert!(concat_line(line).starts_with("    "));
    }
}

#[test]
fn empty_input_yields_single_empty_line() {
    let line = Line::from("");
    let out = word_wrap_line(&line, 10);
    assert_eq!(out.len(), 1);
    assert_eq!(concat_line(&out[0]), "");
}

#[test]
fn leading_spaces_preserved_on_first_line() {
    let line = Line::from("   hello");
    let out = word_wrap_line(&line, 8);
    assert_eq!(out.len(), 1);
    assert_eq!(concat_line(&out[0]), "   hello");
}

#[test]
fn multiple_spaces_between_words_dont_start_next_line_with_spaces() {
    let line = Line::from("hello   world");
    let out = word_wrap_line(&line, 8);
    assert_eq!(out.len(), 2);
    assert_eq!(concat_line(&out[0]), "hello");
    assert_eq!(concat_line(&out[1]), "world");
}

#[test]
fn break_words_false_allows_overflow_for_long_word() {
    let opts = RtOptions::new(5).break_words(false);
    let line = Line::from("supercalifragilistic");
    let out = word_wrap_line(&line, opts);
    assert_eq!(out.len(), 1);
    assert_eq!(concat_line(&out[0]), "supercalifragilistic");
}

#[test]
fn hyphen_splitter_breaks_at_hyphen() {
    let line = Line::from("hello-world");
    let out = word_wrap_line(&line, 7);
    assert_eq!(out.len(), 2);
    assert_eq!(concat_line(&out[0]), "hello-");
    assert_eq!(concat_line(&out[1]), "world");
}

#[test]
fn indent_consumes_width_leaving_one_char_space() {
    let opts = RtOptions::new(4)
        .initial_indent(Line::from(">>>>"))
        .subsequent_indent(Line::from("--"));
    let line = Line::from("hello");
    let out = word_wrap_line(&line, opts);
    assert_eq!(out.len(), 3);
    assert_eq!(concat_line(&out[0]), ">>>>h");
    assert_eq!(concat_line(&out[1]), "--el");
    assert_eq!(concat_line(&out[2]), "--lo");
}

#[test]
fn wide_unicode_wraps_by_display_width() {
    let line = Line::from("😀😀😀");
    let out = word_wrap_line(&line, 4);
    assert_eq!(out.len(), 2);
    assert_eq!(concat_line(&out[0]), "😀😀");
    assert_eq!(concat_line(&out[1]), "😀");
}

#[test]
fn styled_split_within_span_preserves_style() {
    let line = Line::from(vec!["abcd".red()]);
    let out = word_wrap_line(&line, 2);
    assert_eq!(out.len(), 2);
    assert_eq!(out[0].spans.len(), 1);
    assert_eq!(out[1].spans.len(), 1);
    assert_eq!(out[0].spans[0].style.fg, Some(Color::Red));
    assert_eq!(out[1].spans[0].style.fg, Some(Color::Red));
    assert_eq!(concat_line(&out[0]), "ab");
    assert_eq!(concat_line(&out[1]), "cd");
}

#[test]
fn wrap_lines_applies_initial_indent_only_once() {
    let opts = RtOptions::new(8)
        .initial_indent(Line::from("- "))
        .subsequent_indent(Line::from("  "));
    let lines = vec![Line::from("hello world"), Line::from("foo bar baz")];
    let out = word_wrap_lines(lines, opts);
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert!(rendered[0].starts_with("- "));
    for row in rendered.iter().skip(1) {
        assert!(row.starts_with("  "));
    }
}

#[test]
fn wrap_lines_without_indents_is_concat_of_single_wraps() {
    let lines = vec![Line::from("hello"), Line::from("world!")];
    let out = word_wrap_lines(lines, 10);
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert_eq!(rendered, vec!["hello", "world!"]);
}

#[test]
fn wrap_lines_accepts_borrowed_iterators() {
    let lines = [Line::from("hello world"), Line::from("foo bar baz")];
    let out = word_wrap_lines(lines, 10);
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert_eq!(rendered, vec!["hello", "world", "foo bar", "baz"]);
}

#[test]
fn wrap_lines_accepts_str_slices() {
    let lines = ["hello world", "goodnight moon"];
    let out = word_wrap_lines(lines, 12);
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert_eq!(rendered, vec!["hello world", "goodnight", "moon"]);
}

#[test]
fn line_height_counts_double_width_emoji() {
    let line = Line::from("😀😀😀");
    assert_eq!(word_wrap_line(&line, 4).len(), 2);
    assert_eq!(word_wrap_line(&line, 2).len(), 3);
    assert_eq!(word_wrap_line(&line, 6).len(), 1);
}

#[test]
fn word_wrap_does_not_split_words_simple_english() {
    let sample = "Years passed, and Willowmere thrived in peace and friendship. Mira’s herb garden flourished with both ordinary and enchanted plants, and travelers spoke of the kindness of the woman who tended them.";
    let lines = [Line::from(sample)];
    let wrapped = word_wrap_lines(&lines, 40);
    let joined = wrapped
        .iter()
        .map(concat_line)
        .collect::<Vec<_>>()
        .join("\n");
    assert_eq!(
        joined,
        "Years passed, and Willowmere thrived in\npeace and friendship. Mira’s herb garden\nflourished with both ordinary and\nenchanted plants, and travelers spoke of\nthe kindness of the woman who tended\nthem."
    );
}

#[test]
fn ascii_space_separator_with_no_hyphenation_keeps_url_intact() {
    let line = Line::from(
        "http://example.com/long-url-with-dashes-wider-than-terminal-window/blah-blah-blah-text/more-gibberish-text",
    );
    let opts = RtOptions::new(24)
        .word_separator(WordSeparator::AsciiSpace)
        .word_splitter(WordSplitter::NoHyphenation)
        .break_words(false);
    let out = word_wrap_line(&line, opts);
    assert_eq!(out.len(), 1);
    assert_eq!(concat_line(&out[0]), concat_line(&line));
}

#[test]
fn text_contains_url_like_matches_expected_tokens() {
    for text in [
        "https://example.com/a/b",
        "ftp://host/path",
        "www.example.com/path?x=1",
        "example.test/path#frag",
        "localhost:3000/api",
        "127.0.0.1:8080/health",
        "(https://example.com/wrapped-in-parens)",
    ] {
        assert!(
            text_contains_url_like(text),
            "expected URL-like match for {text:?}"
        );
    }
}

#[test]
fn text_contains_url_like_rejects_non_urls() {
    for text in [
        "src/main.rs",
        "foo/bar",
        "key:value",
        "just-some-text-with-dashes",
        "hello.world",
    ] {
        assert!(
            !text_contains_url_like(text),
            "did not expect URL-like match for {text:?}"
        );
    }
}

#[test]
fn line_contains_url_like_checks_across_spans() {
    let line = Line::from(vec![
        "see ".into(),
        "https://example.com/a/very/long/path".cyan(),
        " for details".into(),
    ]);
    assert!(line_contains_url_like(&line));
}

#[test]
fn line_has_mixed_url_and_non_url_tokens_detects_prose_plus_url() {
    let line = Line::from("see https://example.com/path for details");
    assert!(line_has_mixed_url_and_non_url_tokens(&line));
}

#[test]
fn line_has_mixed_url_and_non_url_tokens_ignores_pipe_prefix() {
    let line = Line::from(vec!["  │ ".into(), "https://example.com/path".into()]);
    assert!(!line_has_mixed_url_and_non_url_tokens(&line));
}

#[test]
fn line_has_mixed_url_and_non_url_tokens_ignores_ordered_list_marker() {
    let line = Line::from("1. https://example.com/path");
    assert!(!line_has_mixed_url_and_non_url_tokens(&line));
}

#[test]
fn text_contains_url_like_accepts_custom_scheme_with_separator() {
    assert!(text_contains_url_like("myapp://open/some/path"));
}

#[test]
fn text_contains_url_like_rejects_invalid_ports() {
    assert!(!text_contains_url_like("localhost:99999/path"));
    assert!(!text_contains_url_like("example.com:abc/path"));
}

#[test]
fn adaptive_wrap_line_keeps_long_url_like_token_intact() {
    let line = Line::from("example.test/a-very-long-path-with-many-segments-and-query?x=1&y=2");
    let out = adaptive_wrap_line(&line, RtOptions::new(20));
    assert_eq!(out.len(), 1);
    assert_eq!(concat_line(&out[0]), concat_line(&line));
}

#[test]
fn adaptive_wrap_line_preserves_default_behavior_for_non_url_tokens() {
    let line = Line::from("a_very_long_token_without_spaces_to_force_wrapping");
    let out = adaptive_wrap_line(&line, RtOptions::new(20));
    assert!(out.len() > 1);
}

#[test]
fn adaptive_wrap_line_mixed_line_keeps_regular_words_intact() {
    let line = Line::from(
        "see https://example.com/path and keep strikethrough intact while wrapping prose",
    );
    let out = adaptive_wrap_line(&line, RtOptions::new(36));
    let joined = out.iter().map(concat_line).collect::<Vec<_>>().join("\n");
    assert_eq!(
        joined,
        "see https://example.com/path and\nkeep strikethrough intact while\nwrapping prose"
    );
}

#[test]
fn adaptive_wrap_line_keeps_url_split_across_styled_spans_intact() {
    let line = Line::from(vec![
        "see ".red(),
        "https://exa".cyan(),
        "mple.com/path".magenta(),
        " now".green(),
    ]);
    let out = adaptive_wrap_line(&line, RtOptions::new(10));
    assert_eq!(
        out,
        vec![
            Line::from("see".red()),
            Line::from(vec!["https://exa".cyan(), "mple.com/path".magenta()]),
            Line::from("now".green()),
        ]
    );
}

#[test]
fn adaptive_wrap_line_mixed_line_wraps_long_non_url_token() {
    let long_non_url = "a_very_long_token_without_spaces_to_force_wrapping";
    let line = Line::from(format!("see https://ex.com {long_non_url}"));
    let out = adaptive_wrap_line(&line, RtOptions::new(24));
    assert!(out
        .iter()
        .any(|line| concat_line(line).contains("https://ex.com")));
    assert!(!out
        .iter()
        .any(|line| concat_line(line).contains(long_non_url)));
}

#[test]
fn adaptive_wrap_line_mixed_line_counts_leading_spaces_before_first_word() {
    let line = Line::from("      abcdefgh https://x.co");
    let out = adaptive_wrap_line(&line, RtOptions::new(10).subsequent_indent("      ".into()));
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert_eq!(
        rendered[..2],
        ["      abcd".to_string(), "      efgh".to_string()]
    );
}

#[test]
fn adaptive_wrap_line_mixed_line_resplits_long_token_for_continuation_width() {
    let line = Line::from("abcdefghijklmnopqrst https://x.co");
    let out = adaptive_wrap_line(&line, RtOptions::new(10).subsequent_indent("    ".into()));
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert_eq!(
        rendered[..3],
        [
            "abcdefghij".to_string(),
            "    klmnop".to_string(),
            "    qrst".to_string(),
        ]
    );
}

#[test]
fn adaptive_wrap_line_mixed_url_counts_halfwidth_sound_marks() {
    let line = Line::from("ｶﾞﾊﾟtail https://x.co");
    let out = adaptive_wrap_line(&line, RtOptions::new(4));
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert_eq!(rendered, ["ｶﾞﾊﾟ", "tail", "https://x.co"]);
}

#[test]
fn adaptive_wrap_line_mixed_url_makes_progress_for_an_indivisible_grapheme() {
    let line = Line::from("ｶﾞ https://x.co");
    let out = adaptive_wrap_line(&line, RtOptions::new(1));
    let rendered: Vec<String> = out.iter().map(concat_line).collect();
    assert_eq!(rendered, ["ｶﾞ", "https://x.co"]);
}

#[test]
fn map_owned_wrapped_line_to_range_recovers_on_non_prefix_mismatch() {
    let range = map_owned_wrapped_line_to_range("hello world", 0, "helloX", "");
    assert_eq!(range, 0..5);
}

#[test]
fn borrowed_slice_range_rejects_slices_outside_source_text() {
    let text = "test message";
    let external = String::from("test");
    assert_eq!(borrowed_slice_range(text, &external), None);
    assert_eq!(
        map_owned_wrapped_line_to_range(text, 0, &external, ""),
        0..4
    );
}

#[test]
fn map_owned_wrapped_line_to_range_indent_coincides_with_source() {
    let text = "- item one and some more words";
    let range = map_owned_wrapped_line_to_range(text, 0, "- - item one", "- ");
    assert_eq!(range, 0..10);
}

#[test]
fn wrap_ranges_indent_prefix_coincides_with_source_char() {
    let text = "- first item is long enough to wrap around";
    let opts = || {
        textwrap::Options::new(16)
            .initial_indent("- ")
            .subsequent_indent("- ")
    };
    let ranges = wrap_ranges(text, opts());
    assert!(!ranges.is_empty());

    let mut rebuilt = String::new();
    let mut cursor = 0usize;
    for range in ranges {
        let start = range.start.max(cursor).min(text.len());
        let end = range.end.min(text.len());
        if start < end {
            rebuilt.push_str(&text[start..end]);
        }
        cursor = cursor.max(end);
    }
    assert_eq!(rebuilt, text);
}

#[test]
fn wrap_ranges_count_halfwidth_sound_marks_without_changing_byte_offsets() {
    for (text, width, expected) in [
        ("abｶﾞc", 4, vec!["abｶﾞ", "c"]),
        ("abｶﾞc", 3, vec!["ab", "ｶﾞc"]),
        ("ﾞab", 2, vec!["ﾞa", "b"]),
        ("a ﾞb", 2, vec!["a", "ﾞb"]),
        ("a ﾟb", 2, vec!["a", "ﾟb"]),
        ("ｶﾞﾞx", 3, vec!["ｶﾞﾞ", "x"]),
        ("界ﾞx", 3, vec!["界ﾞ", "x"]),
        ("ｶﾞﾞab", 2, vec!["ｶﾞﾞ", "ab"]),
        ("界ﾞab", 2, vec!["界ﾞ", "ab"]),
        ("abｶﾞﾞcd", 2, vec!["ab", "ｶﾞﾞ", "cd"]),
        ("ab界ﾞcd", 2, vec!["ab", "界ﾞ", "cd"]),
    ] {
        let ranges = wrap_ranges_trim(text, Options::new(width));
        let wrapped: Vec<&str> = ranges.iter().map(|range| &text[range.clone()]).collect();
        assert_eq!(wrapped, expected, "text={text:?}, width={width}");
    }

    for (text, emoji, sound_mark) in [("a👨‍👩 ﾞ", "👨‍👩", "ﾞ"), ("a👍🏻 ﾟ", "👍🏻", "ﾟ")]
    {
        for options in [
            Options::new(2),
            Options::new(2).word_separator(WordSeparator::AsciiSpace),
        ] {
            let ranges = wrap_ranges_trim(text, options);
            let wrapped: Vec<&str> = ranges.iter().map(|range| &text[range.clone()]).collect();
            assert_eq!(wrapped, ["a", emoji, sound_mark]);
        }
    }

    for grapheme in ["ｶﾞﾞ", "界ﾞ"] {
        for width in [1, 2] {
            let ranges = wrap_ranges(grapheme, Options::new(width));
            assert_eq!(
                ranges,
                std::iter::once(0..grapheme.len() + 1).collect::<Vec<_>>()
            );
        }
    }
}

#[test]
fn wrap_ranges_preserve_crlf_source_boundaries_without_splitting_graphemes() {
    for prefix in ["ｶﾞ", "ﾊﾟ"] {
        let text = format!("{prefix}\r\nnext");
        for word_separator in [
            WordSeparator::UnicodeBreakProperties,
            WordSeparator::AsciiSpace,
        ] {
            for line_ending in [textwrap::LineEnding::LF, textwrap::LineEnding::CRLF] {
                let options = Options::new(4)
                    .line_ending(line_ending)
                    .word_separator(word_separator)
                    .wrap_algorithm(textwrap::WrapAlgorithm::FirstFit);
                let first_end = prefix.len() + usize::from(line_ending == textwrap::LineEnding::LF);
                let second_start = prefix.len() + "\r\n".len();
                let ranges = wrap_ranges(&text, options.clone());
                assert_eq!(ranges, [0..first_end + 1, second_start..text.len() + 1]);
                for range in &ranges {
                    assert!(text.get(range.start..range.end - 1).is_some());
                }
                let trimmed = wrap_ranges_trim(&text, options);
                assert_eq!(trimmed, [0..first_end, second_start..text.len()]);
            }
        }
    }
}

#[test]
fn map_owned_wrapped_line_to_range_repro_overconsumes_repeated_prefix_patterns() {
    let text = "- - foo";
    let opts = Options::new(3)
        .initial_indent("- ")
        .subsequent_indent("- ")
        .word_separator(WordSeparator::AsciiSpace)
        .break_words(false);
    let wrapped = textwrap::wrap(text, opts);
    let Some(line) = wrapped.first() else {
        panic!("expected at least one wrapped line");
    };
    let mapped = map_owned_wrapped_line_to_range(text, 0, line.as_ref(), "- ");
    let expected_len = line
        .as_ref()
        .strip_prefix("- ")
        .unwrap_or(line.as_ref())
        .len();
    assert!(mapped.end.saturating_sub(mapped.start) <= expected_len);
}

#[test]
fn wrap_ranges_recovers_with_non_space_indents() {
    let text = "The quick brown fox jumps over the lazy dog";
    let wrapped = textwrap::wrap(
        text,
        Options::new(12)
            .initial_indent("* ")
            .subsequent_indent("  "),
    );
    assert!(wrapped.iter().any(|line| matches!(line, Cow::Owned(_))));
    let ranges = wrap_ranges(
        text,
        Options::new(12)
            .initial_indent("* ")
            .subsequent_indent("  "),
    );
    assert!(!ranges.is_empty());
    let mut rebuilt = String::new();
    let mut cursor = 0usize;
    for range in ranges {
        let start = range.start.max(cursor).min(text.len());
        let end = range.end.min(text.len());
        if start < end {
            rebuilt.push_str(&text[start..end]);
        }
        cursor = cursor.max(end);
    }
    assert_eq!(rebuilt, text);
}

#[test]
fn wrap_ranges_trim_handles_owned_lines_with_penalty_char() {
    fn split_every_char(word: &str) -> Vec<usize> {
        word.char_indices().skip(1).map(|(idx, _)| idx).collect()
    }

    let text = "a_very_long_token_without_spaces";
    let opts = Options::new(8)
        .word_separator(WordSeparator::AsciiSpace)
        .word_splitter(WordSplitter::Custom(split_every_char))
        .break_words(false);
    let ranges = wrap_ranges_trim(text, opts);
    let rebuilt = ranges
        .iter()
        .map(|range| &text[range.clone()])
        .collect::<String>();
    assert_eq!(rebuilt, text);
    assert!(ranges.len() > 1);
}
