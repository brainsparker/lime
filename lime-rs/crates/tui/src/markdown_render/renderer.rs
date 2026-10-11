use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;
use std::path::{Path, PathBuf};

use crate::markdown_copy::{CopyLine, Inline};
use crate::render::highlight::highlight_code_to_lines;
use crate::terminal_hyperlinks::HyperlinkLine;
use crate::terminal_hyperlinks::LogicalLineSource;
use std::sync::Arc;

use super::table::TableState;
use super::{local_links, table};

const LIST_INDENT: &str = "    ";

#[derive(Clone, Copy, Debug)]
enum ListKind {
    Unordered,
    Ordered(u64),
}

struct LinkState {
    destination: String,
    image: bool,
    local_label: Option<Vec<(Span<'static>, Vec<Inline>)>>,
}

struct Renderer {
    lines: Vec<HyperlinkLine>,
    current: HyperlinkLine,
    base_style: Style,
    width: Option<usize>,
    styles: Vec<Style>,
    blockquote_depth: usize,
    lists: Vec<ListKind>,
    list_markers: Vec<String>,
    copy_inline: Vec<Inline>,
    copy_line: CopyLine,
    prefix_bytes: usize,
    item_marker: Option<String>,
    item_marker_style: Option<Style>,
    heading_marker: Option<String>,
    code_block: bool,
    code_block_lang: Option<String>,
    code_block_buffer: String,
    code_block_source: String,
    code_block_start: usize,
    code_sources: Vec<crate::markdown_copy::SourceBlock>,
    transformed_code_source: Option<Arc<str>>,
    quote_sources: Vec<Arc<str>>,
    link: Option<LinkState>,
    table: Option<TableState>,
    cwd: Option<PathBuf>,
    line_ends_with_local_link_target: bool,
    pending_local_link_soft_break: bool,
}

impl Renderer {
    fn new(base_style: Style, width: Option<usize>, cwd: Option<&Path>) -> Self {
        Self {
            lines: Vec::new(),
            current: HyperlinkLine::default(),
            base_style,
            width,
            styles: vec![base_style],
            blockquote_depth: 0,
            lists: Vec::new(),
            list_markers: Vec::new(),
            copy_inline: Vec::new(),
            copy_line: CopyLine::default(),
            prefix_bytes: 0,
            item_marker: None,
            item_marker_style: None,
            heading_marker: None,
            code_block: false,
            code_block_lang: None,
            code_block_buffer: String::new(),
            code_block_source: String::new(),
            code_block_start: 0,
            code_sources: Vec::new(),
            transformed_code_source: None,
            quote_sources: Vec::new(),
            link: None,
            table: None,
            cwd: cwd.map(Path::to_path_buf),
            line_ends_with_local_link_target: false,
            pending_local_link_soft_break: false,
        }
    }

    fn style(&self) -> Style {
        self.styles.last().copied().unwrap_or(self.base_style)
    }

    fn push_style(&mut self, style: Style) {
        self.styles.push(self.style().patch(style));
    }

    fn pop_style(&mut self) {
        if self.styles.len() > 1 {
            self.styles.pop();
        }
    }

    fn ensure_prefix(&mut self) {
        if !self.current.line.spans.is_empty() {
            return;
        }

        let mut prefix = "> ".repeat(self.blockquote_depth);
        let heading_marker = self.heading_marker.take();
        let item_marker = self.item_marker.take();
        if heading_marker.is_none() && item_marker.is_none() && !self.lists.is_empty() {
            prefix.push_str(&LIST_INDENT.repeat(self.lists.len()));
        } else if item_marker.is_some() {
            prefix.push_str(&LIST_INDENT.repeat(self.lists.len().saturating_sub(1)));
        }
        self.copy_line.prefix = format!("{prefix}{}", item_marker.as_deref().unwrap_or(""));
        self.copy_line.continuation = format!(
            "{}{}",
            "> ".repeat(self.blockquote_depth),
            LIST_INDENT.repeat(self.lists.len())
        );
        self.copy_line.item_prefix = self.list_markers.last().map_or_else(
            || self.copy_line.prefix.clone(),
            |marker| {
                format!(
                    "{}{}{marker}",
                    "> ".repeat(self.blockquote_depth),
                    LIST_INDENT.repeat(self.lists.len().saturating_sub(1))
                )
            },
        );
        self.copy_line.code = self.code_block;
        self.copy_line.code_source = self.transformed_code_source.clone();
        self.copy_line.quote_source = self.quote_sources.first().cloned();
        self.prefix_bytes = prefix.len()
            + item_marker.as_ref().map_or(0, String::len)
            + usize::from(self.code_block) * 4;
        let prefix_style = if self.blockquote_depth > 0 {
            Style::default().fg(Color::Green)
        } else {
            Style::default()
        };
        if let Some(marker) = heading_marker {
            self.copy_line.heading = marker.len();
            self.copy_line.push(marker.len(), &[]);
            prefix.push_str(&marker);
        }
        if !prefix.is_empty() {
            self.current
                .push_span(Span::styled(prefix, prefix_style), None);
        }
        if let Some(marker) = item_marker {
            let marker_style = if self.blockquote_depth > 0 {
                prefix_style
            } else {
                self.item_marker_style.take().unwrap_or_default()
            };
            self.current
                .push_span(Span::styled(marker, marker_style), None);
        } else {
            self.item_marker_style = None;
        }
        if self.code_block {
            self.current
                .push_span(Span::styled("    ", prefix_style), None);
        }
    }

    fn push_text(&mut self, text: &str, style: Style) {
        self.push_text_with_link_detection(text, style, true);
    }

    fn push_text_with_link_detection(&mut self, text: &str, style: Style, detect_bare_links: bool) {
        if let Some(label) = self
            .link
            .as_mut()
            .and_then(|link| link.local_label.as_mut())
        {
            let text = text.replace('\n', " ");
            if !text.is_empty() {
                label.push((Span::styled(text, style), self.copy_inline.clone()));
            }
            return;
        }
        self.line_ends_with_local_link_target = false;
        let destination = self
            .link
            .as_ref()
            .filter(|link| !link.image)
            .map(|link| link.destination.clone());
        let detect_bare_links = detect_bare_links && destination.is_none() && !self.code_block;
        if let Some(table) = self.table.as_mut() {
            table.push_text(
                text,
                style,
                destination.as_deref(),
                detect_bare_links,
                &self.copy_inline,
            );
            return;
        }
        for part in text.split_inclusive('\n') {
            let has_newline = part.ends_with('\n');
            let content = part.strip_suffix('\n').unwrap_or(part);
            if !content.is_empty() {
                self.ensure_prefix();
                self.copy_line.push(content.len(), &self.copy_inline);
                let style = if self.blockquote_depth > 0 {
                    self.style().patch(Style::default().fg(Color::Green))
                } else {
                    style
                };
                let span = Span::styled(content.to_string(), style);
                if destination.is_some() {
                    self.current.push_span(span, destination.as_deref());
                } else if detect_bare_links {
                    self.current.push_auto_link_span(span);
                } else {
                    self.current.push_span(span, None);
                }
            }
            if has_newline {
                self.finish_line();
            }
        }
    }

    fn finish_line(&mut self) {
        let mut line = std::mem::take(&mut self.current);
        let text: String = line
            .line
            .spans
            .iter()
            .map(|span| span.content.as_ref())
            .collect();
        let mut source = LogicalLineSource::new(text[self.prefix_bytes..].to_owned());
        source.prefix_bytes = std::mem::take(&mut self.prefix_bytes);
        source.copy = Some(Arc::new(std::mem::take(&mut self.copy_line)));
        line.source = Some(source);
        self.lines.push(line);
        self.line_ends_with_local_link_target = false;
    }

    fn blank_line(&mut self) {
        if !self
            .lines
            .last()
            .is_some_and(|line| line.line.spans.is_empty())
        {
            let mut line = HyperlinkLine::default();
            if self.blockquote_depth > 0 || self.transformed_code_source.is_some() {
                let mut source = LogicalLineSource::new(String::new());
                let mut copy = CopyLine::default();
                copy.prefix = "> ".repeat(self.blockquote_depth);
                copy.code_source = self.transformed_code_source.clone();
                copy.quote_source = self.quote_sources.first().cloned();
                source.copy = Some(Arc::new(copy));
                line.source = Some(source);
            }
            self.lines.push(line);
        }
    }

    fn finish_block(&mut self) {
        if !self.current.line.spans.is_empty() {
            self.finish_line();
        }
        if self.blockquote_depth == 0 && self.lists.is_empty() {
            self.blank_line();
        }
    }

    fn render(mut self, input: &str) -> Vec<HyperlinkLine> {
        let mut options =
            Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TABLES | Options::ENABLE_TASKLISTS;
        options.insert(Options::ENABLE_FOOTNOTES);

        for (event, range) in Parser::new_ext(input, options).into_offset_iter() {
            self.transformed_code_source = self
                .code_sources
                .iter()
                .find(|source| source.range.contains(&range.start))
                .map(|source| Arc::clone(&source.content));
            let inline = Inline::from_event(&event);
            let close_inline = inline.is_some() && matches!(event, Event::Code(_))
                || matches!(
                    event,
                    Event::End(
                        TagEnd::Emphasis | TagEnd::Strong | TagEnd::Strikethrough | TagEnd::Link
                    )
                );
            if let Some(inline) = inline {
                self.copy_inline.push(inline);
            }
            if self.pending_local_link_soft_break {
                let keep_inline =
                    matches!(&event, Event::Text(text) if text.trim_start().starts_with(':'));
                self.pending_local_link_soft_break = false;
                if !keep_inline {
                    self.finish_line();
                }
            }
            match event {
                Event::Start(tag) => self.start(tag, &input[range]),
                Event::End(tag) => self.end(tag),
                Event::Text(text) => {
                    if self.code_block {
                        self.code_block_source.push_str(&text);
                    }
                    if self.code_block && self.code_block_lang.is_some() {
                        self.code_block_buffer.push_str(&text);
                    } else {
                        self.push_text(&text, self.style());
                    }
                }
                Event::Code(code) => {
                    self.push_text_with_link_detection(&code, self.style().fg(Color::Cyan), false);
                }
                Event::Html(html) | Event::InlineHtml(html) => {
                    self.push_text(&html, self.style());
                }
                Event::SoftBreak => {
                    let style = self.style();
                    if self.collecting_local_link_label() {
                        self.push_local_link_label_break(style);
                    } else if let Some(table) = self.table.as_mut() {
                        table.push_text(" ", style, None, false, &self.copy_inline);
                    } else if self.line_ends_with_local_link_target && !self.lists.is_empty() {
                        self.pending_local_link_soft_break = true;
                        self.line_ends_with_local_link_target = false;
                    } else {
                        self.finish_line();
                    }
                }
                Event::HardBreak => {
                    self.copy_line.hard_break = true;
                    let style = self.style();
                    if self.collecting_local_link_label() {
                        self.push_local_link_label_break(style);
                    } else {
                        self.finish_line();
                    }
                }
                Event::Rule => {
                    self.copy_line.rule = true;
                    self.push_text("────────", Style::default().fg(Color::DarkGray));
                    self.finish_line();
                }
                Event::TaskListMarker(checked) => {
                    let marker = if checked { "[x] " } else { "[ ] " };
                    if let Some(item) = self.list_markers.last_mut() {
                        item.push_str(marker);
                    }
                    self.ensure_prefix();
                    self.current.push_span(
                        Span::styled(marker, Style::default().fg(Color::DarkGray)),
                        None,
                    );
                    self.prefix_bytes += marker.len();
                    self.copy_line.prefix.push_str(marker);
                    self.copy_line.item_prefix = self.copy_line.prefix.clone();
                }
                Event::FootnoteReference(label) => {
                    self.push_text(&format!("[^{label}]"), self.style());
                }
            }
            if close_inline {
                self.copy_inline.pop();
            }
        }

        if !self.current.line.spans.is_empty() {
            self.finish_line();
        }
        while self
            .lines
            .last()
            .is_some_and(|line| line.line.spans.is_empty())
        {
            self.lines.pop();
        }
        self.lines
    }

    fn start(&mut self, tag: Tag<'_>, source: &str) {
        match tag {
            Tag::Paragraph => {}
            Tag::Heading { level, .. } => {
                self.heading_marker = Some(format!("{} ", "#".repeat(level as usize)));
                let style = match level {
                    HeadingLevel::H1 => {
                        Style::default().add_modifier(Modifier::BOLD | Modifier::UNDERLINED)
                    }
                    HeadingLevel::H2 => Style::default().add_modifier(Modifier::BOLD),
                    HeadingLevel::H3 => {
                        Style::default().add_modifier(Modifier::BOLD | Modifier::ITALIC)
                    }
                    _ => Style::default().add_modifier(Modifier::ITALIC),
                };
                self.push_style(style);
            }
            Tag::BlockQuote => {
                let payload = self
                    .quote_sources
                    .first()
                    .cloned()
                    .unwrap_or_else(|| crate::markdown_copy::quote_content(source).into());
                self.quote_sources.push(payload);
                self.blockquote_depth += 1;
            }
            Tag::CodeBlock(kind) => {
                self.code_block = true;
                self.push_style(Style::default().fg(Color::Cyan));
                self.code_block_lang = match kind {
                    CodeBlockKind::Fenced(info) => info
                        .split([',', ' ', '\t'])
                        .next()
                        .filter(|language| !language.is_empty())
                        .map(str::to_string),
                    CodeBlockKind::Indented => None,
                };
                self.code_block_buffer.clear();
                self.code_block_source.clear();
                self.code_block_start = self.lines.len();
            }
            Tag::List(start) => {
                if !self.lists.is_empty() {
                    self.finish_line_if_needed();
                }
                self.lists
                    .push(start.map_or(ListKind::Unordered, ListKind::Ordered));
                self.list_markers.push(String::new());
            }
            Tag::Item => {
                self.item_marker = self.lists.last_mut().map(|list| match list {
                    ListKind::Unordered => {
                        self.item_marker_style = Some(Style::default());
                        "- ".to_string()
                    }
                    ListKind::Ordered(next) => {
                        let marker = format!("{next}. ");
                        *next += 1;
                        self.item_marker_style = Some(Style::default().fg(Color::LightBlue));
                        marker
                    }
                });
                if let Some(marker) = self.list_markers.last_mut() {
                    *marker = self.item_marker.clone().unwrap_or_default();
                }
            }
            Tag::Emphasis => self.push_style(Style::default().add_modifier(Modifier::ITALIC)),
            Tag::Strong => self.push_style(Style::default().add_modifier(Modifier::BOLD)),
            Tag::Strikethrough => {
                self.push_style(Style::default().add_modifier(Modifier::CROSSED_OUT))
            }
            Tag::Link { dest_url, .. } => {
                let destination = dest_url.into_string();
                self.link = Some(LinkState {
                    local_label: local_links::is_local_path_like_link(&destination).then(Vec::new),
                    destination,
                    image: false,
                });
                self.push_style(
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::UNDERLINED),
                );
            }
            Tag::Image { dest_url, .. } => {
                self.link = Some(LinkState {
                    destination: dest_url.into_string(),
                    image: true,
                    local_label: None,
                });
                self.push_style(Style::default().fg(Color::Cyan));
            }
            Tag::Table(alignments) => {
                self.finish_line_if_needed();
                self.table = Some(TableState::new(alignments));
            }
            Tag::TableHead => {
                if let Some(table) = self.table.as_mut() {
                    table.in_header = true;
                }
            }
            Tag::TableRow => {}
            Tag::TableCell => {}
            Tag::FootnoteDefinition(_) | Tag::MetadataBlock(_) | Tag::HtmlBlock => {}
        }
    }

    fn end(&mut self, tag: TagEnd) {
        match tag {
            TagEnd::Paragraph => self.finish_block(),
            TagEnd::Heading(_) => {
                self.finish_block();
                self.pop_style();
            }
            TagEnd::BlockQuote => {
                self.finish_line_if_needed();
                self.blockquote_depth = self.blockquote_depth.saturating_sub(1);
                self.quote_sources.pop();
                if self.blockquote_depth == 0 {
                    self.blank_line();
                }
            }
            TagEnd::CodeBlock => {
                self.finish_highlighted_code_block();
                self.finish_line_if_needed();
                let source: Arc<str> = std::mem::take(&mut self.code_block_source).into();
                for line in &mut self.lines[self.code_block_start..] {
                    if let Some(copy) = line.source.as_mut().and_then(|source| source.copy.as_mut())
                    {
                        Arc::make_mut(copy).code_source = Some(Arc::clone(&source));
                    }
                }
                self.code_block = false;
                self.pop_style();
                self.blank_line();
            }
            TagEnd::List(_) => {
                self.finish_line_if_needed();
                self.lists.pop();
                self.list_markers.pop();
                if self.lists.is_empty() {
                    self.blank_line();
                }
            }
            TagEnd::Item => self.finish_line_if_needed(),
            TagEnd::Emphasis | TagEnd::Strong | TagEnd::Strikethrough => {
                self.pop_style();
            }
            TagEnd::Link | TagEnd::Image => {
                self.pop_style();
                self.finish_link();
            }
            TagEnd::Table => self.finish_table(),
            TagEnd::TableHead => {
                if let Some(table) = self.table.as_mut() {
                    if !table.current_row.cells.is_empty() {
                        table.finish_row();
                    }
                    table.in_header = false;
                }
            }
            TagEnd::TableRow => {
                if let Some(table) = self.table.as_mut() {
                    table.finish_row();
                }
            }
            TagEnd::TableCell => {
                if let Some(table) = self.table.as_mut() {
                    table.finish_cell();
                }
            }
            TagEnd::FootnoteDefinition | TagEnd::MetadataBlock(_) | TagEnd::HtmlBlock => {}
        }
    }

    fn finish_line_if_needed(&mut self) {
        if !self.current.line.spans.is_empty() {
            self.finish_line();
        }
    }

    fn finish_highlighted_code_block(&mut self) {
        let Some(language) = self.code_block_lang.take() else {
            return;
        };
        let code = std::mem::take(&mut self.code_block_buffer);
        if code.is_empty() {
            return;
        }
        for line in highlight_code_to_lines(&code, &language) {
            self.ensure_prefix();
            for span in line.spans {
                let style = self.style().patch(span.style);
                self.copy_line.push(span.content.len(), &[]);
                self.current
                    .push_span(Span::styled(span.content.into_owned(), style), None);
            }
            self.finish_line();
        }
    }

    fn collecting_local_link_label(&self) -> bool {
        self.link
            .as_ref()
            .is_some_and(|link| link.local_label.is_some())
    }

    fn push_local_link_label_break(&mut self, style: Style) {
        let needs_space = self
            .link
            .as_ref()
            .and_then(|link| link.local_label.as_ref())
            .and_then(|label| label.last())
            .and_then(|(span, _)| span.content.chars().last())
            .is_some_and(|character| !character.is_whitespace());
        if needs_space {
            self.push_text_with_link_detection(" ", style, false);
        }
    }

    fn finish_link(&mut self) {
        let Some(link) = self.link.take() else {
            return;
        };
        if link.image || link.destination.is_empty() {
            return;
        }
        if let Some(label) = link.local_label {
            let Some(target) =
                local_links::render_local_link_target(&link.destination, self.cwd.as_deref())
            else {
                return;
            };
            let label_text = label
                .iter()
                .map(|(span, _)| span.content.as_ref())
                .collect::<String>();
            if local_links::should_render_local_link_label(&label_text, &link.destination) {
                for (span, inline) in label {
                    let previous = std::mem::replace(&mut self.copy_inline, inline);
                    self.push_text_with_link_detection(&span.content, span.style, false);
                    self.copy_inline = previous;
                }
                let previous = std::mem::replace(&mut self.copy_inline, vec![Inline::Literal]);
                self.push_text_with_link_detection(" (", self.base_style, false);
                self.push_text_with_link_detection(
                    &target,
                    self.base_style
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::UNDERLINED),
                    false,
                );
                self.push_text_with_link_detection(")", self.base_style, false);
                self.copy_inline = previous;
            } else {
                let previous = std::mem::replace(&mut self.copy_inline, vec![Inline::Literal]);
                self.push_text_with_link_detection(
                    &target,
                    self.base_style
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::UNDERLINED),
                    false,
                );
                self.copy_inline = previous;
            }
            if self.table.is_none() {
                self.line_ends_with_local_link_target = true;
            }
            return;
        }
        let previous = std::mem::replace(&mut self.copy_inline, vec![Inline::Literal]);
        self.push_text_with_link_detection(" (", self.base_style, false);
        self.link = Some(LinkState {
            destination: link.destination.clone(),
            image: false,
            local_label: None,
        });
        self.push_text_with_link_detection(
            &link.destination,
            self.base_style
                .fg(Color::Cyan)
                .add_modifier(Modifier::UNDERLINED),
            false,
        );
        self.link = None;
        self.push_text_with_link_detection(")", self.base_style, false);
        self.copy_inline = previous;
    }

    fn finish_table(&mut self) {
        let Some(table) = self.table.take() else {
            return;
        };
        self.ensure_prefix();
        let prefix = std::mem::take(&mut self.current).line.to_string();
        let container = std::mem::take(&mut self.copy_line);
        self.prefix_bytes = 0;
        let mut rendered = table::render(table, self.width);
        for (index, line) in rendered.iter_mut().enumerate() {
            if let Some(copy) = line.source.as_mut().and_then(|source| source.copy.as_mut()) {
                let copy = Arc::make_mut(copy);
                copy.prefix = if index == 0 {
                    container.prefix.clone()
                } else {
                    container.continuation.clone()
                };
                copy.continuation = container.continuation.clone();
                copy.item_prefix = container.item_prefix.clone();
                copy.code_source = container.code_source.clone();
                copy.quote_source = container.quote_source.clone();
            }
        }
        let prefix_style = if self.blockquote_depth > 0 {
            Style::default().fg(Color::Green)
        } else {
            Style::default()
        };
        self.lines
            .extend(crate::terminal_hyperlinks::prefix_hyperlink_lines(
                rendered,
                Span::styled(prefix, prefix_style),
                Span::styled(container.continuation, prefix_style),
            ));
        self.blank_line();
    }
}

pub(crate) fn render(input: &str, base_style: Style, width: Option<usize>) -> Vec<HyperlinkLine> {
    render_with_cwd(input, base_style, width, None)
}

pub(crate) fn render_with_cwd(
    input: &str,
    base_style: Style,
    width: Option<usize>,
    cwd: Option<&Path>,
) -> Vec<HyperlinkLine> {
    let input = super::followup_labels(input);
    let mut sources = Vec::new();
    let input = crate::markdown::unwrap_markdown_fences_with_sources(&input, &mut sources);
    let mut renderer = Renderer::new(base_style, width, cwd);
    renderer.code_sources = sources;
    renderer.render(&input)
}
