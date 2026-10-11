//! Project annotations using the authoritative slices produced by wrapping.

use super::{line_text, HyperlinkLine, LogicalLineSource};
use crate::render::line_utils::line_to_static;
use crate::width::display_width;

pub(crate) fn remap_source_wrapped_line(
    source: &HyperlinkLine,
    wrapped: Vec<crate::wrapping::WrappedLine<'_>>,
) -> Vec<HyperlinkLine> {
    let text = line_text(&source.line);
    let logical = source
        .source
        .clone()
        .unwrap_or_else(|| LogicalLineSource::from_line(&source.line));
    let mut source_byte = 0;
    let mut source_column = 0;
    wrapped
        .into_iter()
        .map(|wrapped| {
            let line = line_to_static(&wrapped.line);
            let displayed = line_text(&line);
            let prefix_columns = display_width(&displayed[..wrapped.prefix_bytes]);
            source_column += display_width(&text[source_byte..wrapped.range.start]);
            let start = source_column;
            let end = start + display_width(&text[wrapped.range.clone()]);
            source_byte = wrapped.range.end;
            source_column = end;
            let hyperlinks = source
                .hyperlinks
                .iter()
                .filter_map(|link| {
                    let first = link.columns.start.max(start);
                    let last = link.columns.end.min(end);
                    (first < last).then(|| {
                        link.with_columns(
                            prefix_columns + first - start..prefix_columns + last - start,
                        )
                    })
                })
                .collect();
            HyperlinkLine {
                line,
                hyperlinks,
                source: Some(logical.wrapped(wrapped.range, wrapped.prefix_bytes)),
            }
        })
        .collect()
}
