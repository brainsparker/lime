use super::*;
use crate::transcript_view::CopyPosition;
use crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::layout::Rect;

#[test]
fn accepted_history_keeps_distance_copy_tickets_and_paired_metadata_with_or_without_a_header() {
    for header in [false, true] {
        let view = TranscriptView::default();
        let mut lines = Vec::new();
        let mut source = PromptHeaderSource::default();
        if header {
            lines.push(HyperlinkLine::from("retained session header"));
            source.record_other("session-header", 0..1);
        }
        let start = lines.len();
        lines.extend(["selected original", "original tail"].map(HyperlinkLine::from));
        source.record_other("entry:original", start..lines.len());
        view.prompt_header.source(&source, false);
        view.selection
            .update_layout(Rect::new(0, 0, 40, 1), start, &lines);
        view.selection.handle_event(&Event::Key(KeyEvent::new(
            KeyCode::Char(' '),
            KeyModifiers::CONTROL,
        )));
        for _ in 0..8 {
            view.selection.handle_event(&Event::Key(KeyEvent::new(
                KeyCode::Right,
                KeyModifiers::NONE,
            )));
        }
        assert_eq!(view.selection.selected_text().as_deref(), Some("selected"));
        let position = CopyPosition::DistanceFromBottom(37);
        view.selection.defer_copy(7, position);
        let older_lines = vec![HyperlinkLine::from("accepted old page")];
        let mut older = PromptHeaderSource::default();
        older.record_other("entry:older", 0..1);
        assert!(view.prepend_snapshot_history(older_lines.clone(), older.clone()));
        assert_eq!(view.selection.selected_text().as_deref(), Some("selected"));
        let after = view.selection.snapshot_lines().unwrap();
        assert_eq!(after[start].line.to_string(), "accepted old page");
        assert_eq!(&after[start + 1..], &lines[start..]);
        assert!(view.selection.finish_copy(7, true, position));
        let metadata = view.prompt_header.snapshot_source().unwrap();
        assert!(!view.prepend_snapshot_history(older_lines, older));
        assert_eq!(view.selection.snapshot_lines().unwrap(), after);
        assert_eq!(view.prompt_header.snapshot_source().unwrap(), metadata);
    }
}
