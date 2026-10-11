use super::unwrap_markdown_fences;
use std::borrow::Cow;

#[test]
fn literal_non_table_and_unclosed_fences_retain_the_exact_source() {
    for source in [
        "plain text",
        "```rust\n| A |\n| --- |\n```",
        "```md\n**code**\n```",
        "```md\n| A |\n| --- |",
        "```md\n| A |\n| - |\n```",
        "```md\n| --- |\n| --- |\n```",
        "```md\n| A |\n\n| --- |\n```",
        "```markdown\n> | A |\n> | --- |\n```",
        "    ```md\n    | A |\n    | --- |\n    ```",
        "````rust\n```md\n| A |\n| --- |\n```\n````",
        "```md\n| A |\n| --- |\n~~~",
    ] {
        assert_eq!(unwrap_markdown_fences(source), source, "{source:?}");
        assert!(matches!(unwrap_markdown_fences(source), Cow::Borrowed(_)));
    }
}

#[test]
fn unwrapping_preserves_surroundings_indentation_and_quote_prefixes() {
    for (source, expected) in [
        (
            "before\n```md\nA | B\n--- | :---:\na | b\n```\nafter",
            "before\nA | B\n--- | :---:\na | b\nafter",
        ),
        (
            "   ~~~~Markdown\n| A |\n| --- |\n  ~~~~~\n",
            "| A |\n| --- |\n",
        ),
        (
            "> ```md\n> | A |\n> | --- |\n> ```\n",
            "> | A |\n> | --- |\n",
        ),
        (
            "```md\r\n| A |\r\n| --- |\r\n```\r\n",
            "| A |\r\n| --- |\r\n",
        ),
        ("```md\n| A | B |\n| --- |\n```", "| A | B |\n| --- |\n"),
    ] {
        assert_eq!(unwrap_markdown_fences(source), expected, "{source:?}");
    }
}
