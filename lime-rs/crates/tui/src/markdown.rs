//! Markdown normalization and rendering exports.

mod fences;
#[cfg(test)]
use crate::markdown_render::renderer::{render, render_with_cwd};
pub(crate) use fences::{unwrap_markdown_fences, unwrap_markdown_fences_with_sources};

#[cfg(test)]
use crate::terminal_hyperlinks::HyperlinkLine;
#[cfg(test)]
use ratatui::style::{Color, Modifier, Style};
#[cfg(test)]
use std::path::Path;

#[cfg(test)]
mod tests {
    use super::*;

    fn plain(lines: &[HyperlinkLine]) -> Vec<String> {
        lines
            .iter()
            .map(|line| {
                line.line
                    .spans
                    .iter()
                    .map(|span| span.content.clone())
                    .collect()
            })
            .collect()
    }

    fn render_unconstrained(input: &str, style: Style) -> Vec<HyperlinkLine> {
        render(input, style, None)
    }

    fn render_at_cwd(input: &str, cwd: &str) -> Vec<HyperlinkLine> {
        render_with_cwd(input, Style::default(), None, Some(Path::new(cwd)))
    }

    #[test]
    fn renders_headings_emphasis_code_lists_quotes_and_links() {
        let lines = render_unconstrained(
            "# Title\n\n**strong** *emphasis* `inline` [link](https://example.com)\n\n```rust\nlet x = 1;\n```\n\n- one\n- two\n\n> quote",
            Style::default(),
        );
        let text = plain(&lines).join("\n");
        assert!(text.contains("# Title"));
        assert!(text.contains("strong emphasis inline link"));
        assert!(text.contains("let x = 1;"));
        assert!(text.contains("- one"));
        assert!(text.contains("> quote"));
        assert!(lines.iter().any(|line| {
            line.line
                .spans
                .iter()
                .any(|span| span.style.add_modifier.contains(Modifier::BOLD))
        }));
        assert!(lines.iter().any(|line| {
            line.line
                .spans
                .iter()
                .any(|span| span.style.fg == Some(Color::Cyan))
        }));
    }

    #[test]
    fn fenced_code_uses_the_first_info_token_for_syntax_highlighting() {
        let lines = render_unconstrained(
            "```rust,no_run title=demo\nfn main() { let answer = 42; }\n```",
            Style::default(),
        );
        let code = lines
            .iter()
            .find(|line| plain(std::slice::from_ref(line))[0].contains("fn main"))
            .expect("rendered Rust code line");

        assert!(code.line.spans.len() > 2);
        assert!(code.line.spans.iter().any(|span| {
            span.content.contains("fn")
                && (span.style.fg.is_some() || !span.style.add_modifier.is_empty())
        }));
    }

    #[test]
    fn unknown_fenced_language_preserves_plain_code() {
        let lines = render_unconstrained("```unknown-language\nalpha\nbeta\n```", Style::default());

        assert_eq!(plain(&lines), vec!["    alpha", "    beta"]);
    }

    #[test]
    fn preserves_multiline_and_empty_input() {
        assert!(render_unconstrained("", Style::default()).is_empty());
        let lines = render_unconstrained("first\nsecond", Style::default());
        assert_eq!(plain(&lines), vec!["first", "second"]);
    }

    #[test]
    fn keeps_link_destinations_visible_and_underlined() {
        let lines = render_unconstrained(
            "Read [the guide](https://example.com/guide).",
            Style::default(),
        );

        assert_eq!(
            plain(&lines),
            vec!["Read the guide (https://example.com/guide)."]
        );
        let destination = lines[0]
            .line
            .spans
            .iter()
            .find(|span| span.content == "https://example.com/guide")
            .expect("visible link destination");
        assert_eq!(destination.style.fg, Some(Color::Cyan));
        assert!(destination
            .style
            .add_modifier
            .contains(Modifier::UNDERLINED));
        assert_eq!(lines[0].hyperlinks.len(), 2);
        assert!(lines[0]
            .hyperlinks
            .iter()
            .all(|link| link.destination == "https://example.com/guide"));
    }

    #[test]
    fn bare_urls_are_linked_but_code_and_unsafe_schemes_are_not() {
        let lines = render_unconstrained(
            "See https://example.com/a~b. `https://code.example` [mail](mailto:a@example.com) [bad](javascript:alert(1))",
            Style::default(),
        );
        let links = lines
            .iter()
            .flat_map(|line| &line.hyperlinks)
            .collect::<Vec<_>>();

        assert_eq!(links.len(), 1);
        assert_eq!(links[0].destination, "https://example.com/a~b");
    }

    #[test]
    fn local_file_links_collapse_matching_labels_and_keep_descriptions() {
        let lines = render_unconstrained(
            "[src/lib.rs](./src/lib.rs) and [open generated source](file:///tmp/My%20File.rs#L12C3)",
            Style::default(),
        );

        assert_eq!(
            plain(&lines),
            vec!["./src/lib.rs and open generated source (/tmp/My File.rs:12:3)"]
        );
        assert!(lines.iter().all(|line| line.hyperlinks.is_empty()));
    }

    #[test]
    fn local_file_links_preserve_tilde_unc_and_invalid_percent_spelling() {
        let lines = render_unconstrained(
            "[notes](~/notes) [share](file://server/share/My%20File.rs) [bad](/tmp/bad%FF.rs)",
            Style::default(),
        );
        let text = plain(&lines).join("\n");

        assert!(text.contains("~/notes"));
        assert!(text.contains("share (//server/share/My File.rs)"));
        assert!(text.contains("bad (/tmp/bad%FF.rs)"));
    }

    #[test]
    fn renders_tables_as_aligned_terminal_columns() {
        let lines = render_unconstrained(
            "| Name | Count |\n| :--- | ---: |\n| Lime | 2 |",
            Style::default(),
        );

        assert_eq!(
            plain(&lines),
            vec![" Name    Count ", "━━━━━━  ━━━━━━━", " Lime        2 "]
        );
        assert!(lines[0]
            .line
            .spans
            .iter()
            .any(|span| span.style.add_modifier.contains(Modifier::BOLD)));
    }

    #[test]
    fn constrained_tables_wrap_without_exceeding_available_width() {
        let lines = render(
            "| Name | Description |\n| --- | --- |\n| Lime | terminal interface with readable wrapped content |",
            Style::default(),
            Some(24),
        );

        assert!(lines.len() > 3);
        assert!(lines.iter().all(|line| line.width() <= 24));
        let text = plain(&lines).join("\n");
        assert!(text.contains("Name"));
        assert!(text.contains("terminal"));
        assert!(text.contains("content"));
    }

    #[test]
    fn constrained_halfwidth_table_keeps_display_width_bounded() {
        let lines = render(
            "| Kana | Value |\n| --- | --- |\n| ｶﾞﾊﾟ | ｶﾞﾊﾟtail |",
            Style::default(),
            Some(18),
        );

        assert!(lines.iter().all(|line| line.width() <= 18));
        assert!(plain(&lines).join("\n").contains("ｶﾞﾊﾟ"));
    }

    #[test]
    fn systemic_compact_fragmentation_uses_stacked_records() {
        let lines = render(
            "| c1 | c2 | c3 | c4 |\n| --- | --- | --- | --- |\n| alpha-long-token | beta-long-token | gamma-long-token | delta-long-token |",
            Style::default(),
            Some(16),
        );
        let text = plain(&lines);
        let compact = text.concat().replace(char::is_whitespace, "");

        assert!(lines.iter().all(|line| line.width() <= 16));
        assert!(text.iter().any(|line| line.trim() == "c1"));
        assert!(compact.contains("alpha-long-token"));
        assert!(!text.iter().any(|line| line.contains('━')));
    }

    #[test]
    fn nested_lists_keep_a_scannable_hierarchy() {
        let lines = render_unconstrained("- outer\n    - inner", Style::default());

        assert_eq!(plain(&lines), vec!["- outer", "    - inner"]);
    }

    #[test]
    fn ordered_list_markers_use_terminal_palette() {
        let lines = render_unconstrained("1. first\n2. second", Style::default());

        assert_eq!(plain(&lines), vec!["1. first", "2. second"]);
        for (line, expected_marker) in lines.iter().zip(["1. ", "2. "]) {
            let marker = line.line.spans.first().expect("ordered marker span");
            assert_eq!(marker.content, expected_marker);
            assert_eq!(marker.style.fg, Some(Color::LightBlue));
        }
    }

    #[test]
    fn label_only_and_fallback_presentations_snapshot() {
        let lines = render_unconstrained(
            "[docs](https://example.com/docs) [mail](mailto:a@example.com)",
            Style::default(),
        );
        let text = plain(&lines).join("\n");
        assert!(text.contains("docs (https://example.com/docs)"));
        assert!(text.contains("mail"));
        assert!(lines.iter().flat_map(|line| &line.hyperlinks).count() >= 1);
    }

    #[test]
    fn bare_url_with_tilde_keeps_complete_hyperlink() {
        let lines = render_unconstrained("See https://example.com/a~b.", Style::default());
        assert_eq!(
            lines[0].hyperlinks[0].destination,
            "https://example.com/a~b"
        );
    }

    #[test]
    fn file_link_compares_path_spellings_without_changing_display() {
        let lines = render_unconstrained("[src/lib.rs](./src/lib.rs)", Style::default());
        assert_eq!(plain(&lines), vec!["./src/lib.rs"]);
        assert!(lines[0].hyperlinks.is_empty());
    }

    #[test]
    fn file_link_ignores_trailing_separators_when_comparing_paths() {
        let lines = render_unconstrained("[src/lib.rs](./src/lib.rs/)", Style::default());
        assert!(plain(&lines)[0].contains("src/lib.rs"));
        assert!(lines[0].hyperlinks.is_empty());
    }

    #[test]
    fn file_link_keeps_descriptive_label_and_target() {
        let lines = render_unconstrained(
            "[open generated source](file:///tmp/My%20File.rs#L12C3)",
            Style::default(),
        );
        assert_eq!(
            plain(&lines),
            vec!["open generated source (/tmp/My File.rs:12:3)"]
        );
    }

    #[test]
    fn file_link_keeps_unrelated_relative_label_with_matching_suffix() {
        let lines = render_unconstrained("[other/lib.rs](./src/lib.rs)", Style::default());
        assert!(plain(&lines)[0].contains("other/lib.rs (./src/lib.rs)"));
    }

    #[test]
    fn file_link_preserves_labels_with_invalid_percent_encoding() {
        let lines = render_unconstrained("[bad](/tmp/bad%FF.rs)", Style::default());
        assert!(plain(&lines)[0].contains("bad (/tmp/bad%FF.rs)"));
    }

    #[test]
    fn file_link_preserves_tilde_and_absolute_destinations() {
        let lines = render_unconstrained(
            "[notes](~/notes) [share](file://server/share/My%20File.rs)",
            Style::default(),
        );
        let text = plain(&lines).join("\n");
        assert!(text.contains("~/notes"));
        assert!(text.contains("//server/share/My File.rs"));
    }

    #[test]
    fn file_links_shorten_targets_to_cwd_and_keep_location_ranges() {
        let lines = render_at_cwd(
            "[source](/repo/src/lib.rs#L12C3)\n\n[range](/repo/src/main.rs:74:3-76:9)",
            "/repo",
        );
        assert_eq!(
            plain(&lines),
            vec![
                "source (src/lib.rs:12:3)",
                "",
                "range (src/main.rs:74:3-76:9)"
            ]
        );
    }

    #[test]
    fn file_links_keep_foreign_windows_targets_and_decode_urls_once() {
        assert_eq!(
            plain(&render_at_cwd(
                "[report](file:///C:/repo/Quarterly%20Report.xlsx#L4C2)",
                "C:/repo",
            )),
            vec!["report (Quarterly Report.xlsx:4:2)"]
        );
        assert_eq!(
            plain(&render_at_cwd(
                "[percent%20.rs](/repo/percent%2520.rs)",
                "/repo"
            )),
            vec!["percent%20.rs"]
        );
    }

    #[test]
    fn local_file_link_soft_break_stays_inline_with_following_list_text() {
        let lines = render_at_cwd(
            "- [binary](/repo/README.md:93)\n  : core is the agent runtime.",
            "/repo",
        );
        assert_eq!(
            plain(&lines),
            vec!["- binary (README.md:93): core is the agent runtime."]
        );
    }

    #[test]
    fn multiline_local_file_link_labels_collapse_without_detaching_styled_prefixes() {
        let lines = render_at_cwd("**bold** plain [foo\nbar](/repo/src/lib.rs#L74C3)", "/repo");
        assert_eq!(
            plain(&lines),
            vec!["bold plain foo bar (src/lib.rs:74:3)".to_string()]
        );
    }

    #[test]
    fn list_item_after_code_block_keeps_blank_separator() {
        let lines = render_unconstrained("```text\ncode\n```\n\n- item", Style::default());
        let text = plain(&lines);
        assert!(text.iter().any(|line| line.contains("code")));
        assert!(text.iter().any(|line| line.contains("- item")));
        assert!(text.windows(2).any(|pair| pair[0].is_empty()));
    }

    #[test]
    fn markdown_render_complex_snapshot() {
        let lines = render_unconstrained(
            "# Heading\n\n**bold** *emphasis* `code`\n\n> quote\n\n- one\n- two",
            Style::default(),
        );
        let text = plain(&lines).join("\n");
        for fragment in ["Heading", "bold", "emphasis", "code", "quote", "- one"] {
            assert!(text.contains(fragment), "missing {fragment} in {text:?}");
        }
    }

    #[test]
    fn markdown_render_file_link_snapshot() {
        let lines = render_unconstrained("[source](./src/main.rs)", Style::default());
        assert_eq!(plain(&lines), vec!["source (./src/main.rs)"]);
    }

    #[test]
    fn mixed_url_markdown_wraps_prose_without_splitting_words_snapshot() {
        let lines = render(
            "Read https://example.com/a/very/long/path for more details",
            Style::default(),
            Some(18),
        );
        assert!(lines
            .iter()
            .filter(|line| line.hyperlinks.is_empty())
            .all(|line| line.width() <= 18));
        assert!(lines.iter().any(|line| !line.hyperlinks.is_empty()));
        assert!(lines
            .iter()
            .flat_map(|line| &line.hyperlinks)
            .all(|link| { link.destination == "https://example.com/a/very/long/path" }));
    }

    #[test]
    fn multiline_finding_items_are_separated_snapshot() {
        let lines =
            render_unconstrained("- first line\n  second line\n- next item", Style::default());
        let text = plain(&lines);
        assert!(text.iter().any(|line| line.contains("first line")));
        assert!(text.iter().any(|line| line.contains("second line")));
        assert!(text.iter().any(|line| line.contains("next item")));
    }

    #[test]
    fn table_keeps_grid_when_only_one_compact_record_fragments_snapshot() {
        let lines = render(
            "| Name | Value |\n| --- | --- |\n| alpha | beta |",
            Style::default(),
            Some(18),
        );
        assert!(lines.iter().all(|line| line.width() <= 18));
        assert!(plain(&lines).iter().any(|line| line.contains("Name")));
    }

    #[test]
    fn table_renders_halfwidth_sound_marks_at_constrained_width_snapshot() {
        let lines = render(
            "| Kana | Value |\n| --- | --- |\n| ｶﾞﾊﾟ | ｶﾞﾊﾟtail |",
            Style::default(),
            Some(18),
        );
        assert!(lines.iter().all(|line| line.width() <= 18));
        assert!(plain(&lines).join("\n").contains("ｶﾞﾊﾟ"));
    }

    #[test]
    fn table_renders_key_value_records_when_compact_fragmentation_is_systemic_snapshot() {
        let lines = render(
            "| c1 | c2 | c3 | c4 |\n| --- | --- | --- | --- |\n| alpha-long-token | beta-long-token | gamma-long-token | delta-long-token |",
            Style::default(),
            Some(16),
        );
        assert!(lines.iter().all(|line| line.width() <= 16));
        assert!(plain(&lines).join("\n").contains("alpha"));
    }

    #[test]
    fn table_renders_records_when_multiple_prose_columns_are_starved_snapshot() {
        let lines = render(
            "| Path | Summary | Notes |\n| --- | --- | --- |\n| src/main.rs | a long summary | more details |",
            Style::default(),
            Some(20),
        );
        assert!(lines.len() > 3);
        assert!(lines.iter().all(|line| line.width() <= 20));
    }

    #[test]
    fn table_renders_stacked_key_value_records_when_path_column_becomes_too_narrow_snapshot() {
        let lines = render(
            "| Path | Description |\n| --- | --- |\n| src/very_long_file_name.rs | details |",
            Style::default(),
            Some(14),
        );
        assert!(lines.iter().all(|line| line.width() <= 14));
        assert!(plain(&lines).join("\n").contains("src/"));
    }

    #[test]
    fn table_wraps_file_paths_before_collapsing_narrative_columns_snapshot() {
        let lines = render(
            "| File | Description |\n| --- | --- |\n| src/very/long/path/to/file.rs | readable details |",
            Style::default(),
            Some(24),
        );
        assert!(lines.iter().all(|line| line.width() <= 24));
        assert!(plain(&lines).join("\n").contains("file.rs"));
    }

    #[test]
    fn web_link_labels_have_a_visible_underline_snapshot() {
        let lines = render_unconstrained("[guide](https://example.com/guide)", Style::default());
        assert!(lines[0].line.spans.iter().any(|span| {
            span.content.contains("https://example.com/guide")
                && span.style.add_modifier.contains(Modifier::UNDERLINED)
        }));
    }
}
