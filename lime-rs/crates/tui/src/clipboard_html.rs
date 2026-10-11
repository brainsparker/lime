//! Portable HTML for copying Markdown into rich-text applications.
//! Raw HTML remains literal, local destinations remain visible, and images emit only alt text.

use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};

pub(crate) fn render_markdown(markdown: &str) -> String {
    let normalized = crate::markdown::unwrap_markdown_fences(markdown);
    let mut link_destinations = Vec::new();
    let events = Parser::new_ext(
        &normalized,
        Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TABLES,
    )
    .filter_map(|event| {
        Some(match event {
            Event::Html(text) | Event::InlineHtml(text) => Event::Text(text),
            Event::Start(Tag::Image { .. }) | Event::End(TagEnd::Image) => return None,
            Event::Start(mut tag) => {
                if let Tag::Link { dest_url, .. } = &mut tag {
                    if let Some(destination) = crate::terminal_hyperlinks::web_destination(dest_url)
                    {
                        *dest_url = destination.into();
                        link_destinations.push(None);
                    } else {
                        link_destinations.push(Some(dest_url.clone()));
                        return None;
                    }
                }
                Event::Start(tag)
            }
            Event::End(TagEnd::Link) => match link_destinations.pop().flatten() {
                Some(destination) => Event::Text(format!(" ({destination})").into()),
                None => Event::End(TagEnd::Link),
            },
            event => event,
        })
    });
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, events);
    html
}

#[cfg(test)]
#[path = "clipboard_html_tests.rs"]
mod tests;
