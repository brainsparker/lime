//! Compose and route the App-owned main transcript above the composer.

use super::App;
use crate::terminal_hyperlinks::HyperlinkParagraph;
use ratatui::{layout::Rect, widgets::Paragraph, Frame};

impl App {
    pub(crate) fn scroll_owned_transcript(&mut self, rows: isize) -> bool {
        let Some(width) = self.transcript_view.held_reading_width() else {
            return false;
        };
        let current = crate::app::history_ui::render_main_transcript_content(self, width, false);
        self.transcript_view
            .scroll_held_reading(rows, &current.lines, &current.prompt_header)
    }

    pub(crate) fn reset_for_hydrated_thread(&mut self) {
        self.chat_widget.reset_for_hydrated_thread();
        self.transcript_view.reset();
    }

    pub(crate) fn end_interaction_drag(&mut self) {
        self.transcript_view.selection.end_drag();
        if let Some(pager) = self.chat_widget.pager_overlay.as_ref() {
            pager.end_transcript_drag();
        }
        if let Some(picker) = self.chat_widget.resume_picker.as_ref() {
            picker.end_transcript_drag();
        }
    }

    pub(crate) fn render_owned_transcript(&self, frame: &mut Frame<'_>, area: Rect) {
        let app = self;
        let current =
            crate::app::history_ui::render_main_transcript_content(app, area.width, false);
        let current_lines = &current.lines;
        app.transcript_view
            .hold_live_reading(current_lines, &current.prompt_header);
        let snapshot = app.transcript_view.snapshot_lines();
        app.transcript_view.search.prepare(
            current_lines,
            area.width,
            &std::collections::HashSet::new(),
            app.transcript_view.selection.is_active(),
        );
        let search_lines = (app.transcript_view.search.is_active() && snapshot.is_none())
            .then(|| app.transcript_view.search.highlighted_lines(current_lines));
        let lines = snapshot
            .as_ref()
            .map(|lines| lines.as_slice())
            .or(search_lines.as_deref())
            .unwrap_or(current_lines);
        let prompt_source = app
            .transcript_view
            .snapshot_prompt_source(&current.prompt_header);
        let initial_scroll = snapshot.as_ref().map_or_else(
            || {
                if app.transcript_view.search.is_active() {
                    return app.transcript_view.search.resolve_main_scroll(
                        current_lines,
                        area.width,
                        area.height,
                    );
                }
                usize::from(app.transcript_view.viewport.preview(
                    current_lines,
                    area,
                    app.transcript_view.scroll,
                ))
            },
            |_| app.transcript_view.snapshot_scroll(area, 0),
        );
        let reserved_body = Rect::new(
            area.x,
            area.y.saturating_add(1),
            area.width,
            area.height.saturating_sub(1),
        );
        let reserved_scroll = snapshot.as_ref().map_or_else(
            || {
                if app.transcript_view.search.is_active() {
                    return app.transcript_view.search.resolve_main_scroll(
                        current_lines,
                        reserved_body.width,
                        reserved_body.height,
                    );
                }
                usize::from(app.transcript_view.viewport.preview(
                    current_lines,
                    reserved_body,
                    app.transcript_view.scroll,
                ))
            },
            |_| {
                app.transcript_view
                    .snapshot_scroll(reserved_body, initial_scroll)
            },
        );
        let header = app.transcript_view.prompt_header.layout(
            &prompt_source,
            lines,
            area,
            initial_scroll,
            reserved_scroll,
        );
        if let Some(line) = header.line {
            frame.render_widget(
                Paragraph::new(line),
                Rect::new(area.x, area.y, area.width, /*height*/ 1),
            );
        }
        let body = header.body;
        let frozen_scroll = header.scroll;
        let current_height = HyperlinkParagraph::new(current_lines).line_count(area.width);
        let current_max_scroll = current_height.saturating_sub(usize::from(body.height));
        let scroll = if snapshot.is_some() {
            let canonical_scroll = app.transcript_view.viewport.resolve_frozen_anchor(
                current_lines,
                body,
                frozen_scroll,
                (!app.transcript_view.selection.is_active()).then_some(lines),
            );
            app.transcript_view
                .selection
                .note_resume_distance_from_bottom(
                    current_max_scroll.saturating_sub(usize::from(canonical_scroll)),
                );
            frozen_scroll
        } else if app.transcript_view.search.is_active() {
            app.transcript_view
                .search
                .resolve_main_scroll(current_lines, body.width, body.height)
        } else {
            usize::from(app.transcript_view.viewport.resolve(
                current_lines,
                body,
                app.transcript_view.scroll,
            ))
        };
        let paragraph = HyperlinkParagraph::new(lines);
        frame.render_widget(
            paragraph.scroll(u16::try_from(scroll).unwrap_or(u16::MAX)),
            body,
        );
        app.transcript_view
            .selection
            .update_layout(body, scroll, lines);
        app.transcript_view.update_snapshot_layout(body, scroll);
        app.transcript_view
            .selection
            .render_highlight(frame.buffer_mut());
    }
}
