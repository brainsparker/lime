use super::*;
use crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::backend::TestBackend;
use ratatui::Terminal;

fn key(code: KeyCode) -> Event {
    Event::Key(KeyEvent::new(code, KeyModifiers::NONE))
}

fn content() -> TranscriptContent {
    let mut content = TranscriptContent::default();
    content.push_copyable_lines(
        "entry:user".into(),
        vec![HyperlinkLine::from("visible prompt")],
        "visible prompt".into(),
        true,
    );
    content.push_copyable_lines(
        "entry:answer".into(),
        vec![HyperlinkLine::from("visible reply")],
        "visible reply".into(),
        false,
    );
    content
}

fn draw(pager: &PagerOverlay, content: &TranscriptContent) {
    Terminal::new(TestBackend::new(60, 12))
        .unwrap()
        .draw(|frame| pager.render_transcript(frame, frame.area(), Locale::EnUs, content))
        .unwrap();
}

#[test]
fn copy_navigation_requests_history_at_the_older_boundary() {
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.set_older_history_available(true);
    pager.begin_copy_mode();
    draw(&pager, &content());
    assert_eq!(pager.handle_event(&key(KeyCode::Up)), PagerAction::Consumed);
    assert_eq!(
        pager.handle_event(&key(KeyCode::Up)),
        PagerAction::LoadOlderHistory
    );
}

#[test]
fn copy_page_up_at_the_top_loads_one_page() {
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.set_older_history_available(true);
    pager.begin_copy_mode();
    draw(&pager, &content());
    assert_eq!(
        pager.handle_event(&key(KeyCode::PageUp)),
        PagerAction::LoadOlderHistory
    );
    assert_eq!(
        pager.history_load_mode(),
        crate::app_event::OlderHistoryLoadMode::OnePage
    );
}

#[test]
fn history_insertion_remaps_a_matching_copy_ticket_without_changing_follow_intent() {
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.begin_copy_mode();
    draw(&pager, &content());
    pager.defer_transcript_copy(7, "visible reply".len());
    pager.prepend_snapshot_history(older(), Locale::EnUs);
    assert_eq!(
        pager.finish_transcript_copy(7, true, &Ok(CopyStatus::Confirmed), true),
        Some(true)
    );
}

fn copy(pager: &mut PagerOverlay) -> (String, crate::clipboard_copy::CopyFormat) {
    let PagerAction::CopyTranscriptSelection {
        text,
        format,
        follow: true,
    } = pager.handle_event(&key(KeyCode::Enter))
    else {
        panic!("copy target must dispatch its original payload")
    };
    (text, format)
}

fn older() -> TranscriptContent {
    let mut content = TranscriptContent::default();
    content.push_copyable_lines(
        "entry:older-user".into(),
        vec![HyperlinkLine::from("old 中文😀 prompt")],
        "old 中文😀 prompt".into(),
        true,
    );
    content
}

#[test]
fn copy_history_uses_one_page_or_beginning_and_retries_without_reentry() {
    use crate::app_event::OlderHistoryLoadMode;
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.set_older_history_available(true);
    pager.begin_copy_mode();
    draw(&pager, &content());
    assert_eq!(
        pager.handle_event(&key(KeyCode::Home)),
        PagerAction::LoadOlderHistory
    );
    assert_eq!(pager.history_load_mode(), OlderHistoryLoadMode::All);
    pager.begin_older_history_load();
    assert_eq!(
        pager.handle_event(&key(KeyCode::Home)),
        PagerAction::Consumed
    );
    assert_eq!(pager.handle_event(&key(KeyCode::Up)), PagerAction::Consumed);
    assert_eq!(copy(&mut pager).0, "visible prompt");
    pager.fail_older_history_load();
    assert_eq!(
        pager.handle_event(&key(KeyCode::Up)),
        PagerAction::LoadOlderHistory
    );
    assert_eq!(pager.history_load_mode(), OlderHistoryLoadMode::OnePage);
    pager.complete_older_history_load();
    pager.set_older_history_available(false);
    assert_eq!(pager.handle_event(&key(KeyCode::Up)), PagerAction::Consumed);
}

#[test]
fn accepted_history_extends_frozen_copy_without_replacing_the_selected_response() {
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.begin_copy_mode();
    draw(&pager, &content());
    let mut live = content();
    live.push_copyable_lines(
        "entry:new-response".into(),
        vec![HyperlinkLine::from("new live reply")],
        "new live reply".into(),
        false,
    );
    draw(&pager, &live);
    pager.prepend_snapshot_history(older(), Locale::EnUs);
    draw(&pager, &live);
    assert_eq!(
        copy(&mut pager),
        (
            "visible reply".into(),
            crate::clipboard_copy::CopyFormat::Markdown
        )
    );
    assert_eq!(
        pager.handle_event(&key(KeyCode::Home)),
        PagerAction::Consumed
    );
    assert_eq!(copy(&mut pager).0, "old 中文😀 prompt");
    pager.handle_event(&key(KeyCode::End));
    assert_eq!(copy(&mut pager).0, "visible reply");
    assert!(!pager
        .transcript_selection
        .snapshot_lines()
        .unwrap()
        .iter()
        .any(|line| line.line.to_string().contains("new live reply")));
}

#[test]
fn overlapping_history_retains_one_header_and_preserves_equal_target_identity() {
    let mut initial = content();
    let mut with_header = TranscriptContent::default();
    with_header.push_keyed_lines(
        "session-header",
        vec![HyperlinkLine::from("original header")],
    );
    with_header.push_keyed_lines("session-body-gap", vec![HyperlinkLine::default()]);
    // Prepend uses canonical keys, so equal text in separate entries remains distinct.
    with_header.prepend_snapshot_history(initial.clone());
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.begin_copy_mode();
    draw(&pager, &with_header);
    pager.handle_event(&key(KeyCode::Up));
    let expected = copy(&mut pager);
    initial.push_copyable_lines(
        "entry:older-user".into(),
        vec![HyperlinkLine::from("visible prompt")],
        "visible prompt".into(),
        true,
    );
    pager.prepend_snapshot_history(initial.clone(), Locale::EnUs);
    let snapshot = pager.transcript_selection.snapshot_lines().unwrap();
    assert_eq!(copy(&mut pager), expected);
    assert_eq!(
        snapshot
            .iter()
            .filter(|line| line.line.to_string() == "original header")
            .count(),
        1
    );
    assert_eq!(
        snapshot
            .iter()
            .filter(|line| line.line.to_string() == "visible prompt")
            .count(),
        2
    );
    pager.prepend_snapshot_history(initial, Locale::EnUs);
    assert_eq!(
        *pager.transcript_selection.snapshot_lines().unwrap(),
        *snapshot
    );
    pager.handle_event(&key(KeyCode::Home));
    let first = pager.transcript_selection.snapshot_lines().unwrap();
    pager.handle_event(&key(KeyCode::Down));
    assert_eq!(copy(&mut pager), expected);
    assert_eq!(
        *pager.transcript_selection.snapshot_lines().unwrap(),
        *first
    );
}

#[test]
fn history_hydration_after_resize_keeps_payload_and_highlight_on_the_same_target() {
    let mut pager = PagerOverlay::transcript(Locale::EnUs);
    pager.begin_copy_mode();
    draw(&pager, &content());
    pager.handle_event(&key(KeyCode::Up));
    let expected = copy(&mut pager);
    let mut terminal = Terminal::new(TestBackend::new(12, 8)).unwrap();
    terminal
        .draw(|frame| pager.render_transcript(frame, frame.area(), Locale::EnUs, &content()))
        .unwrap();
    pager.prepend_snapshot_history(older(), Locale::EnUs);
    terminal
        .draw(|frame| pager.render_transcript(frame, frame.area(), Locale::EnUs, &content()))
        .unwrap();
    assert_eq!(copy(&mut pager), expected);
    assert!(terminal
        .backend()
        .buffer()
        .content
        .iter()
        .any(|cell| cell.modifier.contains(Modifier::REVERSED)));
}
