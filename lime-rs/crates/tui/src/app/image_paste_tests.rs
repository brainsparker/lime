use super::*;
use crate::app::AppAction;
use crate::clipboard_copy::worker::ClipboardWorker;
use crate::clipboard_paste::{PasteImageError, PastedImageInfo};
use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use std::time::{Duration, Instant};

fn paste(modifiers: KeyModifiers) -> KeyEvent {
    KeyEvent::new(KeyCode::Char('v'), modifiers)
}

#[test]
fn image_paste_repeat_window_slides_with_each_suppressed_press() {
    for modifiers in [KeyModifiers::CONTROL, KeyModifiers::ALT] {
        let mut app = App::default();
        let start = Instant::now();
        assert_eq!(
            app.handle_key_event_at(paste(modifiers), start, start),
            AppAction::PasteImage
        );
        for millis in [200, 300, 549] {
            assert_eq!(
                app.handle_key_event_at(
                    paste(modifiers),
                    start + Duration::from_millis(millis),
                    start
                ),
                AppAction::None,
                "{modifiers:?}, {millis}"
            );
        }
        assert_eq!(
            app.handle_key_event_at(paste(modifiers), start + Duration::from_millis(799), start),
            AppAction::PasteImage
        );
    }
}

#[test]
fn ordinary_press_or_release_resets_suppression_but_repeat_does_not_read_again() {
    for other in [
        KeyEvent::new(KeyCode::PageUp, KeyModifiers::NONE),
        KeyEvent::new(KeyCode::Char('x'), KeyModifiers::NONE),
        KeyEvent::new_with_kind(
            KeyCode::Char('v'),
            KeyModifiers::CONTROL,
            KeyEventKind::Release,
        ),
    ] {
        let mut app = App::default();
        let now = Instant::now();
        assert_eq!(
            app.handle_key_event_at(paste(KeyModifiers::CONTROL), now, now),
            AppAction::PasteImage
        );
        let repeat = KeyEvent::new_with_kind(
            KeyCode::Char('v'),
            KeyModifiers::CONTROL,
            KeyEventKind::Repeat,
        );
        assert_ne!(
            app.handle_key_event_at(repeat, now, now),
            AppAction::PasteImage
        );
        assert_eq!(
            app.handle_key_event_at(paste(KeyModifiers::CONTROL), now, now),
            AppAction::None
        );
        app.handle_key_event_at(other, now, now);
        assert_eq!(
            app.handle_key_event_at(paste(KeyModifiers::CONTROL), now, now),
            AppAction::PasteImage,
            "{other:?}"
        );
    }
}

#[test]
fn successful_and_failed_native_attempts_extend_suppression_from_completion() {
    for success in [false, true] {
        let mut app = App::default();
        let now = Instant::now();
        app.handle_key_event_at(paste(KeyModifiers::CONTROL), now, now);
        let completed_at = now + Duration::from_secs(1);
        let result = if success {
            Ok((
                std::path::PathBuf::from("/tmp/clipboard-fixture.png"),
                PastedImageInfo {
                    width: 2,
                    height: 3,
                },
            ))
        } else {
            Err(PasteImageError::NoImage("fixture failure".into()))
        };
        app.finish_image_paste(result, completed_at);
        assert_eq!(
            app.chat_widget.bottom_pane.composer_has_pending_images(),
            success
        );
        assert_eq!(
            app.handle_key_event_at(
                paste(KeyModifiers::CONTROL),
                completed_at + Duration::from_millis(249),
                now,
            ),
            AppAction::None
        );
        assert_eq!(
            app.handle_key_event_at(
                paste(KeyModifiers::CONTROL),
                completed_at + Duration::from_millis(499),
                now,
            ),
            AppAction::PasteImage
        );
    }
}

#[test]
fn busy_worker_refuses_image_read_without_modifying_the_draft() {
    let mut app = App::default();
    app.chat_widget.bottom_pane.insert_str("keep draft");
    app.paste_image_with_reader(&ClipboardWorker::test_busy(), || {
        panic!("busy clipboard must not call the native image reader")
    });
    assert_eq!(app.chat_widget.bottom_pane.composer_text(), "keep draft");
    assert!(!app.chat_widget.bottom_pane.composer_has_pending_images());
    assert_eq!(
        app.projection.status(),
        app.chat_widget.locale.status("clipboard is busy")
    );
}

#[test]
fn early_control_c_and_d_do_not_reset_the_image_repeat_window() {
    for code in ['c', 'd'] {
        let mut app = App::default();
        let now = Instant::now();
        assert_eq!(
            app.handle_key_event_at(paste(KeyModifiers::CONTROL), now, now),
            AppAction::PasteImage
        );
        app.handle_key_event_at(
            KeyEvent::new(KeyCode::Char(code), KeyModifiers::CONTROL),
            now,
            now,
        );
        assert_eq!(
            app.handle_key_event_at(paste(KeyModifiers::CONTROL), now, now),
            AppAction::None
        );
    }
}
