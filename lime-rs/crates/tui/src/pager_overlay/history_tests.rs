use super::*;
use crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::{backend::TestBackend, Terminal};

fn key(code: KeyCode) -> Event {
    Event::Key(KeyEvent::new(code, KeyModifiers::NONE))
}

fn content() -> TranscriptContent {
    let mut content = TranscriptContent::default();
    content.push_keyed_lines(
        "session-header",
        vec![HyperlinkLine::from("original header")],
    );
    content.push_keyed_lines("session-body-gap", vec![HyperlinkLine::default()]);
    content.push_copyable_lines(
        "entry:original".into(),
        vec![HyperlinkLine::from("original 中文😀 reply")],
        "original 中文😀 reply".into(),
        false,
    );
    content
}

fn older() -> TranscriptContent {
    let mut content = TranscriptContent::default();
    content.push_copyable_lines(
        "entry:older".into(),
        vec![HyperlinkLine::from("older prompt")],
        "older prompt".into(),
        true,
    );
    content
}

fn draw(pager: &PagerOverlay, content: &TranscriptContent, width: u16) {
    Terminal::new(TestBackend::new(width, 8))
        .unwrap()
        .draw(|frame| pager.render_transcript(frame, frame.area(), Locale::EnUs, content))
        .unwrap();
}

fn select_original(pager: &mut PagerOverlay) {
    use crossterm::event::{MouseButton, MouseEvent, MouseEventKind};
    for (kind, column) in [
        (MouseEventKind::Down(MouseButton::Left), 0),
        (MouseEventKind::Drag(MouseButton::Left), 8),
        (MouseEventKind::Up(MouseButton::Left), 8),
    ] {
        pager.handle_event(&Event::Mouse(MouseEvent {
            kind,
            column,
            row: 3,
            modifiers: KeyModifiers::NONE,
        }));
    }
}

fn copy(pager: &mut PagerOverlay) -> String {
    let PagerAction::CopyTranscriptSelection { text, .. } =
        pager.handle_event(&key(KeyCode::Enter))
    else {
        panic!("ordinary selection must remain copyable")
    };
    text
}

#[test]
fn ordinary_selection_loads_one_page_at_the_boundary_and_retries_without_reentry() {
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.set_older_history_available(true);
    draw(&pager, &content(), 60);
    select_original(&mut pager);
    assert_eq!(
        pager.handle_event(&key(KeyCode::PageUp)),
        PagerAction::LoadOlderHistory
    );
    assert_eq!(
        pager.history_load_mode(),
        crate::app_event::OlderHistoryLoadMode::OnePage
    );
    pager.begin_older_history_load();
    assert_eq!(
        pager.handle_event(&key(KeyCode::PageUp)),
        PagerAction::Consumed
    );
    pager.fail_older_history_load();
    assert_eq!(
        pager.handle_event(&key(KeyCode::PageUp)),
        PagerAction::LoadOlderHistory
    );
    pager.set_older_history_available(false);
    assert_eq!(
        pager.handle_event(&key(KeyCode::PageUp)),
        PagerAction::Consumed
    );
}

#[test]
fn ordinary_selection_absorbs_only_accepted_history_before_its_first_selected_draw() {
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    draw(&pager, &content(), 60);
    select_original(&mut pager);
    let expected = copy(&mut pager);
    assert_eq!(expected, "original");
    // A live replacement can arrive between the gesture and the next frame.
    let mut live = TranscriptContent::default();
    live.push_copyable_lines(
        "entry:original".into(),
        vec![HyperlinkLine::from("REPLACED_MUST_STAY_OUT")],
        "REPLACED_MUST_STAY_OUT".into(),
        false,
    );
    live.push_copyable_lines(
        "entry:tail".into(),
        vec![HyperlinkLine::from("LIVE_MUST_STAY_OUT")],
        "LIVE_MUST_STAY_OUT".into(),
        false,
    );
    pager.defer_transcript_copy(7, expected.len());
    pager.prepend_snapshot_history(older(), Locale::EnUs);
    draw(&pager, &live, 12);
    assert_eq!(copy(&mut pager), expected);
    let snapshot = pager.transcript_selection.snapshot_lines().unwrap();
    assert_eq!(
        snapshot
            .iter()
            .map(|line| line.line.to_string())
            .collect::<Vec<_>>(),
        [
            "original header",
            "",
            "older prompt",
            "original 中文😀 reply"
        ]
    );
    pager.prepend_snapshot_history(older(), Locale::EnUs);
    assert_eq!(
        *pager.transcript_selection.snapshot_lines().unwrap(),
        *snapshot
    );
    // Returning to the previous width retains the original pending selection receipt.
    draw(&pager, &live, 60);
    assert_eq!(
        pager.finish_transcript_copy(7, false, &Ok(CopyStatus::Confirmed), true),
        Some(true)
    );
    assert!(!pager.has_transcript_selection());
}

#[test]
fn cancelling_a_paged_selection_keeps_the_displayed_older_source_after_reflow() {
    let lines = |prefix: &str| {
        let mut content = TranscriptContent::default();
        for index in 0..20 {
            content.push_keyed_lines(
                format!("{prefix}:{index}"),
                vec![HyperlinkLine::from(format!(
                    "{prefix}_{index:02} 中文😀 line"
                ))],
            );
        }
        content
    };
    let mut live = lines("recent");
    let older = lines("older");
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    draw(&pager, &live, 60);
    select_original(&mut pager);
    let expected = copy(&mut pager);
    pager.prepend_snapshot_history(older.clone(), Locale::EnUs);
    live.prepend_snapshot_history(older);
    draw(&pager, &live, 12);
    draw(&pager, &live, 60);
    assert_eq!(copy(&mut pager), expected);
    while pager.scroll.get() > 0 {
        pager.handle_event(&key(KeyCode::PageUp));
        draw(&pager, &live, 60);
    }
    assert_eq!(
        pager.handle_event(&key(KeyCode::Esc)),
        PagerAction::Consumed
    );
    draw(&pager, &live, 60);
    assert_eq!(
        pager.scroll.get(),
        0,
        "clearing selection must keep the visible older source"
    );
}
