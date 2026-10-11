//! The display rows and exact source slices used by wrapping.

use super::*;

pub(crate) struct WrappedLine<'a> {
    pub(crate) line: Line<'a>,
    pub(crate) range: Range<usize>,
    pub(crate) prefix_bytes: usize,
}

pub(crate) fn word_wrap_line_with_source<'a, O>(
    line: &'a Line<'a>,
    width_or_options: O,
) -> Vec<WrappedLine<'a>>
where
    O: Into<RtOptions<'a>>,
{
    let (flat, span_bounds) = flatten_line(line);
    word_wrap_flattened_line(line, &flat, &span_bounds, width_or_options.into())
}

pub(crate) fn adaptive_wrap_line_with_source<'a>(
    line: &'a Line<'a>,
    base: RtOptions<'a>,
) -> Vec<WrappedLine<'a>> {
    let (flat, span_bounds) = flatten_line(line);
    let mut saw_url = false;
    let mut saw_non_url = false;
    for token in flat.split_ascii_whitespace() {
        if is_url_like_token(token) {
            saw_url = true;
        } else if is_substantive_non_url_token(token) {
            saw_non_url = true;
        }
        if saw_url && saw_non_url {
            break;
        }
    }
    if !saw_url {
        word_wrap_flattened_line(line, &flat, &span_bounds, base)
    } else if saw_non_url {
        mixed_url_wrap_line(line, &flat, &span_bounds, base)
    } else {
        word_wrap_flattened_line(line, &flat, &span_bounds, url_preserving_wrap_options(base))
    }
}
