//! Conservatively unwrap Markdown table fences without changing literal code or partial streams.

use crate::table_detect;
use std::borrow::Cow;

#[derive(Clone, Copy)]
struct Fence {
    marker: char,
    len: usize,
    quoted: bool,
}

fn strip_line_indent(line: &str) -> Option<&str> {
    let line = line.strip_suffix('\n').unwrap_or(line);
    let mut columns = 0;
    let mut bytes = 0;
    for byte in line.bytes() {
        columns += match byte {
            b' ' => 1,
            b'\t' => 4,
            _ => break,
        };
        if columns >= 4 {
            return None;
        }
        bytes += 1;
    }
    Some(&line[bytes..])
}

fn parse_open_fence(line: &str) -> Option<(Fence, bool)> {
    let trimmed = strip_line_indent(line)?;
    let quoted = trimmed.starts_with('>');
    let text = table_detect::strip_blockquote_prefix(trimmed);
    let (marker, len) = table_detect::parse_fence_marker(text)?;
    Some((
        Fence {
            marker,
            len,
            quoted,
        },
        table_detect::is_markdown_fence_info(text, len),
    ))
}

fn is_close_fence(line: &str, fence: Fence) -> bool {
    let Some(trimmed) = strip_line_indent(line) else {
        return false;
    };
    if fence.quoted && !trimmed.starts_with('>') {
        return false;
    }
    let text = if fence.quoted {
        table_detect::strip_blockquote_prefix(trimmed)
    } else {
        trimmed
    };
    table_detect::parse_fence_marker(text).is_some_and(|(marker, len)| {
        marker == fence.marker && len >= fence.len && text[len..].trim().is_empty()
    })
}

fn markdown_fence_contains_table(content: &str, quoted: bool) -> bool {
    let mut previous = None;
    for line in content.lines() {
        let text = if quoted {
            table_detect::strip_blockquote_prefix(line)
        } else {
            line
        }
        .trim();
        if let Some(header) = previous {
            if table_detect::is_table_start(header, text)
                && !table_detect::is_table_delimiter_line(header)
            {
                return true;
            }
        }
        previous = (!text.is_empty()).then_some(text);
    }
    false
}

pub(crate) fn unwrap_markdown_fences(source: &str) -> Cow<'_, str> {
    unwrap_markdown_fences_with_sources(source, &mut Vec::new())
}

pub(crate) fn unwrap_markdown_fences_with_sources<'a>(
    source: &'a str,
    sources: &mut Vec<crate::markdown_copy::SourceBlock>,
) -> Cow<'a, str> {
    if !source.contains("```") && !source.contains("~~~") {
        return Cow::Borrowed(source);
    }
    let mut out = String::with_capacity(source.len());
    let mut active: Option<(Fence, bool, &str, String)> = None;
    for line in source.split_inclusive('\n') {
        if let Some((fence, markdown, opening, mut content)) = active.take() {
            if is_close_fence(line, fence) {
                if markdown && markdown_fence_contains_table(&content, fence.quoted) {
                    let start = out.len();
                    out.push_str(&content);
                    let payload = if fence.quoted {
                        crate::markdown_copy::quote_content(&content)
                    } else {
                        content
                    };
                    sources.push(crate::markdown_copy::SourceBlock {
                        range: start..out.len(),
                        content: payload.into(),
                    });
                } else {
                    out.push_str(opening);
                    out.push_str(&content);
                    out.push_str(line);
                }
            } else {
                content.push_str(line);
                active = Some((fence, markdown, opening, content));
            }
        } else if let Some((fence, markdown)) = parse_open_fence(line) {
            active = Some((fence, markdown, line, String::new()));
        } else {
            out.push_str(line);
        }
    }
    if let Some((_, _, opening, content)) = active {
        out.push_str(opening);
        out.push_str(&content);
    }
    if out == source {
        Cow::Borrowed(source)
    } else {
        Cow::Owned(out)
    }
}

#[cfg(test)]
#[path = "fences_tests.rs"]
mod tests;
