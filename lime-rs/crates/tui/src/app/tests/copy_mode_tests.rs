use super::*;
use crate::app::AppAction;
use crate::locale::Locale;
use crate::tui::TuiEvent;
use app_server_protocol::protocol::v2::{AgentMessageDeltaNotification, ServerNotification};
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::backend::TestBackend;
use ratatui::Terminal;

fn app() -> App {
    let mut app = App::default();
    app.chat_widget.set_locale(Locale::EnUs);
    app.projection.apply(ServerNotification::AgentMessageDelta(AgentMessageDeltaNotification {
        thread_id: "thread-1".into(),
        turn_id: "turn-1".into(),
        item_id: "message-1".into(),
        delta: "**answer**\n\n```rust\nlet 中文 = 1;\n```\n\n> quoted\n\n:codex-followup[continue]{prompt=\"private\"}".into(),
    }));
    app.chat_widget.bottom_pane.insert_str("draft 😀");
    app.select_transcript_copy();
    draw(&app, 60);
    app
}

fn draw(app: &App, width: u16) -> String {
    let mut terminal = Terminal::new(TestBackend::new(width, 12)).unwrap();
    terminal
        .draw(|frame| crate::view::render(frame, app))
        .unwrap();
    terminal
        .backend()
        .buffer()
        .content
        .iter()
        .map(|cell| cell.symbol())
        .collect()
}

fn key(app: &mut App, code: KeyCode) -> AppAction {
    app.handle_tui_event_runtime(
        TuiEvent::Key(KeyEvent::new(code, KeyModifiers::NONE)),
        true,
        std::time::Instant::now(),
    )
}

fn defer(app: &mut App, id: u64) {
    let AppAction::CopyTranscriptSelection {
        text,
        format,
        follow,
        target,
    } = key(app, KeyCode::Enter)
    else {
        panic!("copy mode must use the canonical clipboard action")
    };
    assert!(follow);
    assert_eq!(target, TranscriptSelectionTarget::MainPager);
    app.defer_copy(
        id,
        PendingCopyContext::TranscriptSelection {
            text,
            format,
            follow,
            target,
        },
    );
}

fn finish(app: &mut App, id: u64, status: CopyResult) {
    app.finish_clipboard_copy(id, status);
}

#[test]
fn copy_mode_uses_the_real_pager_and_clipboard_dispatch_without_submitting_the_draft() {
    let mut app = app();
    let screen = draw(&app, 60);
    assert!(screen.contains("Copy whole response"));
    assert!(!screen.contains("private"));
    let AppAction::CopyTranscriptSelection {
        text,
        format,
        follow,
        target,
    } = key(&mut app, KeyCode::Enter)
    else {
        panic!("whole response action")
    };
    assert!(follow);
    assert_eq!(target, TranscriptSelectionTarget::MainPager);
    assert_eq!(format, CopyFormat::Markdown);
    assert!(text.ends_with("continue"));
    assert!(!text.contains("private"));
    assert_eq!(app.chat_widget.bottom_pane.composer_text(), "draft 😀");
    key(&mut app, KeyCode::Up);
    let AppAction::CopyTranscriptSelection { text, format, .. } = key(&mut app, KeyCode::Enter)
    else {
        panic!("quote action")
    };
    assert_eq!(text, "quoted\n");
    assert_eq!(format, CopyFormat::PlainText);
    key(&mut app, KeyCode::Up);
    let AppAction::CopyTranscriptSelection { text, format, .. } = key(&mut app, KeyCode::Enter)
    else {
        panic!("code action")
    };
    assert_eq!(text, "let 中文 = 1;\n");
    assert_eq!(format, CopyFormat::PlainText);
    assert_eq!(key(&mut app, KeyCode::Esc), AppAction::None);
    assert!(app.chat_widget.pager_overlay.is_none());
    assert_eq!(app.chat_widget.bottom_pane.composer_text(), "draft 😀");
}

#[test]
fn only_confirmed_matching_copy_returns_to_the_composer() {
    for result in [
        Ok(CopyStatus::Unconfirmed),
        Err("clipboard unavailable".into()),
        Ok(CopyStatus::Confirmed),
    ] {
        let mut app = app();
        defer(&mut app, 7);
        let confirmed = matches!(result, Ok(CopyStatus::Confirmed));
        finish(&mut app, 7, result);
        assert_eq!(app.chat_widget.pager_overlay.is_none(), confirmed);
        assert_eq!(app.chat_widget.bottom_pane.composer_text(), "draft 😀");
    }
}

#[test]
fn modified_global_raw_toggle_is_owned_by_the_frozen_copy_mode() {
    let mut app = app();
    let raw_before = app.chat_widget.is_raw_output_mode();
    app.handle_tui_event_runtime(
        TuiEvent::Key(KeyEvent::new(KeyCode::Char('r'), KeyModifiers::ALT)),
        true,
        std::time::Instant::now(),
    );
    assert_eq!(app.chat_widget.is_raw_output_mode(), raw_before);
    assert!(app
        .chat_widget
        .pager_overlay
        .as_ref()
        .unwrap()
        .is_copy_mode());
    assert_eq!(app.chat_widget.bottom_pane.composer_text(), "draft 😀");
}

#[test]
fn navigating_after_submission_preserves_the_new_copy_target_on_old_completion() {
    let mut app = app();
    defer(&mut app, 7);
    key(&mut app, KeyCode::Up);
    finish(&mut app, 7, Ok(CopyStatus::Confirmed));
    assert!(app
        .chat_widget
        .pager_overlay
        .as_ref()
        .unwrap()
        .is_copy_mode());
    let AppAction::CopyTranscriptSelection { text, .. } = key(&mut app, KeyCode::Enter) else {
        panic!("new selection must survive old ticket")
    };
    assert_eq!(text, "quoted\n");
}

#[test]
fn reopening_copy_mode_does_not_accept_an_old_page_ticket() {
    let mut app = app();
    defer(&mut app, 7);
    key(&mut app, KeyCode::Esc);
    app.select_transcript_copy();
    draw(&app, 40);
    finish(&mut app, 7, Ok(CopyStatus::Confirmed));
    assert!(app
        .chat_widget
        .pager_overlay
        .as_ref()
        .unwrap()
        .is_copy_mode());
    assert!(draw(&app, 40).contains("Copy whole response"));
}

#[test]
fn cancelled_copy_request_does_not_reappear_in_the_ordinary_transcript() {
    let mut app = app();
    app.select_transcript_copy();
    key(&mut app, KeyCode::Esc);
    app.open_transcript_pager();
    assert!(!app
        .chat_widget
        .pager_overlay
        .as_ref()
        .unwrap()
        .is_copy_mode());
    assert!(!draw(&app, 60).contains("Copy whole response"));
}

#[test]
fn empty_copy_reports_a_localized_state_without_opening_an_empty_modal() {
    for locale in [
        Locale::ZhCn,
        Locale::ZhTw,
        Locale::EnUs,
        Locale::JaJp,
        Locale::KoKr,
    ] {
        let mut app = App::default();
        app.chat_widget.set_locale(locale);
        app.select_transcript_copy();
        assert!(app.chat_widget.pager_overlay.is_none());
        assert_eq!(app.projection.status(), locale.transcript_nothing_to_copy());
    }
}

#[test]
fn copy_footer_separates_target_and_navigation_in_the_actual_pager() {
    let app = app();
    for width in [100, 24, 12] {
        let mut terminal = Terminal::new(TestBackend::new(width, 12)).unwrap();
        terminal
            .draw(|frame| crate::view::render(frame, &app))
            .unwrap();
        let buffer = terminal.backend().buffer();
        let row = |y| {
            (0..width)
                .map(|x| buffer[(x, y)].symbol())
                .collect::<String>()
        };
        let title = row(10);
        let navigation = row(11);
        assert!(
            title.starts_with("Copy "),
            "target title at width {width}: {title}"
        );
        assert!(
            navigation.contains("enter") && navigation.contains("esc"),
            "complete copy/cancel shortcuts at width {width}: {navigation}"
        );
        assert!(buffer[(0, 10)]
            .modifier
            .contains(ratatui::style::Modifier::BOLD));
    }
}
