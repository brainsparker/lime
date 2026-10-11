use super::render_markdown;
use pretty_assertions::assert_eq;

#[test]
fn markdown_clipboard_preserves_rich_formatting() {
    let markdown = "# Findings\n\n[Source](https://example.com/?a=1&b=2)\n\n- **Bold**, *italic*, ~~removed~~, and `inline <code>`\n\n> Quote\n\n```rust\n<hello>\n```\n\n| Item | Result |\n| --- | --- |\n| Copy | Rich |\n";
    assert_eq!(render_markdown(markdown), concat!(
        "<h1>Findings</h1>\n",
        "<p><a href=\"https://example.com/?a=1&amp;b=2\">Source</a></p>\n",
        "<ul>\n<li><strong>Bold</strong>, <em>italic</em>, <del>removed</del>, and <code>inline &lt;code&gt;</code></li>\n</ul>\n",
        "<blockquote>\n<p>Quote</p>\n</blockquote>\n",
        "<pre><code class=\"language-rust\">&lt;hello&gt;\n</code></pre>\n",
        "<table><thead><tr><th>Item</th><th>Result</th></tr></thead><tbody>\n<tr><td>Copy</td><td>Rich</td></tr>\n</tbody></table>\n",
    ));
}

#[test]
fn markdown_clipboard_preserves_local_link_destinations() {
    for (source, expected) in [
        (
            "[parser](/repo/src/parser.rs:42)",
            "<p>parser (/repo/src/parser.rs:42)</p>\n",
        ),
        (
            r"[**Windows parser**](C:\repo\src\parser.rs:42:7)",
            r"<p><strong>Windows parser</strong> (C:\repo\src\parser.rs:42:7)</p>",
        ),
        (
            "[`relative`](../src/lib.rs#L42)",
            "<p><code>relative</code> (../src/lib.rs#L42)</p>\n",
        ),
        (
            "[escaped](/repo/a&amp;b/&lt;parser&gt;.rs:42)",
            "<p>escaped (/repo/a&amp;b/&lt;parser&gt;.rs:42)</p>\n",
        ),
        (
            "[Unicode](</repo/my project/解析.rs:42>)",
            "<p>Unicode (/repo/my project/解析.rs:42)</p>\n",
        ),
    ] {
        assert_eq!(
            render_markdown(source).trim_end(),
            expected.trim_end(),
            "{source}"
        );
    }
}

#[test]
fn markdown_clipboard_images_are_inert() {
    assert_eq!(render_markdown("![tracking pixel](https://example.com/pixel)\n\n[![**Preview** & details](https://example.com/image.png)](https://example.com/page)"),
        "<p>tracking pixel</p>\n<p><a href=\"https://example.com/page\"><strong>Preview</strong> &amp; details</a></p>\n");
}

#[test]
fn markdown_clipboard_escapes_raw_html_and_rejects_unsafe_destinations() {
    assert_eq!(
        render_markdown("<script>alert(1)</script>\n\nHello <img src=x onerror=alert(1)>!"),
        "&lt;script&gt;alert(1)&lt;/script&gt;\n<p>Hello &lt;img src=x onerror=alert(1)&gt;!</p>\n"
    );
    for (destination, visible) in [
        ("javascript:alert(1)", "javascript:alert(1)"),
        ("JaVaScRiPt:alert(1)", "JaVaScRiPt:alert(1)"),
        ("jav&#x61;script:alert(1)", "javascript:alert(1)"),
        ("data:text/html,unsafe", "data:text/html,unsafe"),
        (
            "javascript:alert(&quot;&lt;&gt;&amp;&quot;)",
            "javascript:alert(\"&lt;&gt;&amp;\")",
        ),
    ] {
        assert_eq!(
            render_markdown(&format!("[link]({destination}) ![image]({destination})")),
            format!("<p>link ({visible}) image</p>\n")
        );
    }
}

#[test]
fn markdown_clipboard_unwraps_table_fences_without_altering_non_table_code() {
    let table = "| Item | Result |\n| --- | --- |\n| Copy | Rich |\n";
    for (open, close) in [
        ("```markdown", "```"),
        ("~~~MD extra", "~~~"),
        ("````md", "`````"),
        ("   ```markdown", "   ```"),
    ] {
        assert_eq!(
            render_markdown(&format!("{open}\n{table}{close}")),
            render_markdown(table),
            "{open}"
        );
    }
    assert_eq!(
        render_markdown("```markdown\n**literal**\n```"),
        "<pre><code class=\"language-markdown\">**literal**\n</code></pre>\n"
    );
    let quoted = "> | Item | Result |\n> | --- | --- |\n> | Copy | Rich |\n";
    assert_eq!(
        render_markdown(&format!("> ```md\n{quoted}> ```")),
        render_markdown(quoted)
    );
}
