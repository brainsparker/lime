use super::super::ChatComposer;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

fn key(code: KeyCode) -> KeyEvent {
    KeyEvent::new(code, KeyModifiers::NONE)
}

#[test]
fn disconnected_edit_preserves_draft_and_cancels_history_preview() {
    let mut composer = ChatComposer::default();
    composer.set_cached_history(["history preview".to_string()]);
    composer.insert("original draft");
    composer.handle_key_event(KeyEvent::new(KeyCode::Char('r'), KeyModifiers::CONTROL));
    composer.handle_key_event(key(KeyCode::Char('h')));
    assert_eq!(composer.text(), "history preview");

    composer.handle_restricted_key(key(KeyCode::Char('!')));

    assert_eq!(composer.text(), "original draft!");
    assert!(!composer.history_search_active());
}

#[test]
fn disconnected_enter_and_tab_leave_input_available_for_reconnect() {
    let mut composer = ChatComposer::default();
    composer.insert("unsent");

    composer.handle_restricted_key(key(KeyCode::Enter));
    assert_eq!(composer.text(), "unsent");
    composer.handle_restricted_key(key(KeyCode::Tab));
    assert_eq!(composer.text(), "unsent");
}

#[test]
fn disconnected_editing_preserves_graphemes_and_cursor_boundaries() {
    let mut composer = ChatComposer::default();
    composer.insert("你👍好");

    composer.handle_restricted_key(key(KeyCode::Backspace));
    assert_eq!(composer.text(), "你👍");
    composer.handle_restricted_key(key(KeyCode::Backspace));
    assert_eq!(composer.text(), "你");

    composer.handle_restricted_key(key(KeyCode::Char('a')));
    composer.handle_restricted_key(key(KeyCode::Left));
    composer.handle_restricted_key(key(KeyCode::Char('界')));
    assert_eq!(composer.text(), "你界a");
}

#[test]
fn disconnected_repeat_key_is_editable_but_never_submits() {
    let mut composer = ChatComposer::default();
    composer.insert("draft");
    let mut repeated = key(KeyCode::Char('!'));
    repeated.kind = crossterm::event::KeyEventKind::Repeat;

    composer.handle_restricted_key(repeated);
    composer.handle_restricted_key(key(KeyCode::Enter));

    assert_eq!(composer.text(), "draft!");
}

#[test]
fn disconnected_edit_materializes_held_ascii_before_immediate_unicode() {
    let mut composer = ChatComposer::default();
    composer.handle_key_event_at(key(KeyCode::Char('a')), std::time::Instant::now());
    assert!(composer.text().is_empty());

    composer.handle_restricted_key(key(KeyCode::Char('界')));

    assert_eq!(composer.text(), "a界");
    assert!(!composer.paste_burst_needs_frame());
}

#[test]
fn disconnected_enter_materializes_active_raw_paste_without_submitting() {
    let mut composer = ChatComposer::default();
    let now = std::time::Instant::now();
    for (index, ch) in "raw界🙂".chars().enumerate() {
        composer.handle_key_event_at(
            key(KeyCode::Char(ch)),
            now + std::time::Duration::from_micros(index as u64 * 100),
        );
    }
    assert!(composer.paste_burst_needs_frame());

    composer.handle_restricted_key(key(KeyCode::Enter));

    assert_eq!(composer.text(), "raw界🙂");
    assert!(!composer.paste_burst_needs_frame());
}

#[test]
fn disconnected_backspace_expands_registered_pastes_and_keeps_image_identity() {
    for locale in [
        crate::locale::Locale::ZhCn,
        crate::locale::Locale::ZhTw,
        crate::locale::Locale::EnUs,
        crate::locale::Locale::JaJp,
        crate::locale::Locale::KoKr,
    ] {
        let mut composer = ChatComposer::default();
        composer.set_locale(locale);
        composer.attach_image(std::path::PathBuf::from("offline.png"));
        let images = composer.local_images();
        let image_prefix = composer.text().to_string();
        let body = format!("{}OFFLINE_TAIL界🙂", "界🙂".repeat(501));
        composer.handle_paste(&body);
        composer.insert(" | ");
        composer.handle_paste(&body);
        let expected = format!("{image_prefix}{body} | {}", body.trim_end_matches('🙂'));

        composer.handle_restricted_key(key(KeyCode::Backspace));

        assert_eq!(composer.text(), expected, "{locale:?}");
        assert_eq!(composer.current_text_with_pending(), expected);
        assert!(composer.draft.pending_pastes.is_empty());
        assert_eq!(composer.local_images(), images);
        assert_eq!(composer.textarea().text_elements().len(), 1);
        assert_eq!(composer.cursor(), expected.len());
    }
}
