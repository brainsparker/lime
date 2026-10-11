use super::*;
use crate::keymap::RuntimeKeymap;
use crate::status::StatusFacts;
use crossterm::event::KeyEvent;
use unicode_segmentation::UnicodeSegmentation;

fn widget(locale: Locale, cwd: &str) -> ChatWidget {
    let mut widget = ChatWidget::default();
    widget.set_locale(locale);
    widget.open_status_pager(StatusFacts {
        thread_id: Some("thread-copy-1"),
        thread_name: Some("讨论 👩‍💻"),
        model: Some("fixture-model"),
        provider: Some("fixture-provider"),
        effort: Some("high"),
        permissions: Some(":workspace"),
        cwd,
        status: "ready",
        token_usage: None,
    });
    assert!(widget.show_copy_picker());
    widget
}

fn key(code: KeyCode) -> Event {
    Event::Key(KeyEvent::new(code, KeyModifiers::NONE))
}

#[test]
fn status_preview_is_bounded_and_original_unicode_payload_is_not_truncated() {
    let cwd = format!("/workspace/{}", "界👩‍💻".repeat(60));
    for locale in [
        Locale::ZhCn,
        Locale::ZhTw,
        Locale::EnUs,
        Locale::JaJp,
        Locale::KoKr,
    ] {
        let mut widget = widget(locale, &cwd);
        let picker = widget.copy_picker.as_ref().unwrap();
        let view = picker.view(locale);
        assert_eq!(view.title, locale.copy_picker_title());
        assert_eq!(view.entries.len(), 5);
        let preview = view.entries[2].description.as_ref().unwrap();
        assert_eq!(preview.graphemes(true).count(), 72);
        assert!(preview.ends_with("..."));
        assert_eq!(
            widget.handle_copy_picker_event(&key(KeyCode::Char('3'))),
            Some(CopyPickerAction::Copy {
                text: cwd.clone(),
                label: locale.copy_directory_label().to_owned(),
            }),
        );
        assert!(widget.copy_picker.is_none());
    }
}

#[test]
fn unknown_status_facts_do_not_become_copyable_placeholder_values() {
    let mut widget = ChatWidget::default();
    widget.open_status_pager(StatusFacts {
        thread_id: None,
        thread_name: None,
        model: None,
        provider: None,
        effort: None,
        permissions: None,
        cwd: "/workspace",
        status: "",
        token_usage: None,
    });
    assert!(widget.show_copy_picker());
    let choices = &widget.copy_picker.as_ref().unwrap().choices;
    assert_eq!(choices.len(), 2);
    assert_eq!(&*choices[1].text, "/workspace");
}

#[test]
fn navigation_wraps_but_repeat_release_and_modified_numbers_never_copy() {
    let mut widget = widget(Locale::EnUs, "/workspace");
    for event in [
        Event::Key(KeyEvent::new_with_kind(
            KeyCode::Enter,
            KeyModifiers::NONE,
            KeyEventKind::Repeat,
        )),
        Event::Key(KeyEvent::new_with_kind(
            KeyCode::Enter,
            KeyModifiers::NONE,
            KeyEventKind::Release,
        )),
        Event::Key(KeyEvent::new(KeyCode::Char('3'), KeyModifiers::ALT)),
        Event::Paste("/model SHOULD_NOT_SUBMIT".into()),
    ] {
        assert_eq!(
            widget.handle_copy_picker_event(&event),
            Some(CopyPickerAction::None)
        );
    }
    widget.handle_copy_picker_event(&key(KeyCode::Up));
    assert_eq!(widget.copy_picker.as_ref().unwrap().selected, 4);
    widget.handle_copy_picker_event(&key(KeyCode::Down));
    assert_eq!(widget.copy_picker.as_ref().unwrap().selected, 0);
    assert_eq!(
        widget.handle_copy_picker_event(&key(KeyCode::Esc)),
        Some(CopyPickerAction::Cancel)
    );
}

#[test]
fn configured_chords_and_page_navigation_use_the_shared_list_bindings() {
    let mut widget = widget(Locale::EnUs, "/workspace");
    let config = serde_json::from_value(serde_json::json!({
        "list": { "accept": "ctrl-x enter", "move_down": "alt-d" }
    }))
    .unwrap();
    widget.set_runtime_keymap(RuntimeKeymap::from_config(&config).unwrap());
    widget.show_copy_picker();
    let picker = widget.copy_picker.as_mut().unwrap();
    picker.page_rows.set(2);
    assert_eq!(
        picker.handle_event(&key(KeyCode::PageDown)),
        CopyPickerAction::None
    );
    assert_eq!(picker.selected, 2);
    picker.handle_event(&Event::Key(KeyEvent::new(
        KeyCode::Char('d'),
        KeyModifiers::ALT,
    )));
    assert_eq!(picker.selected, 3);
    assert_eq!(
        picker.handle_event(&key(KeyCode::Enter)),
        CopyPickerAction::None
    );
    assert_eq!(
        picker.handle_event(&Event::Key(KeyEvent::new(
            KeyCode::Char('x'),
            KeyModifiers::CONTROL
        ))),
        CopyPickerAction::None
    );
    assert_eq!(
        picker.handle_event(&key(KeyCode::Enter)),
        CopyPickerAction::Copy {
            text: "讨论 👩‍💻".to_owned(),
            label: "Thread name".to_owned(),
        }
    );
}

#[test]
fn configured_cancel_chord_owns_exit_instead_of_an_unbound_escape() {
    let mut widget = widget(Locale::EnUs, "/workspace");
    let config = serde_json::from_value(serde_json::json!({
        "list": { "accept": "f9", "cancel": "ctrl-x q" }
    }))
    .unwrap();
    widget.set_runtime_keymap(RuntimeKeymap::from_config(&config).unwrap());
    widget.show_copy_picker();
    for event in [
        key(KeyCode::Esc),
        Event::Key(KeyEvent::new(KeyCode::Char('x'), KeyModifiers::CONTROL)),
    ] {
        assert_eq!(
            widget.handle_copy_picker_event(&event),
            Some(CopyPickerAction::None)
        );
        assert!(widget.copy_picker.is_some());
    }
    assert_eq!(
        widget.handle_copy_picker_event(&key(KeyCode::Char('q'))),
        Some(CopyPickerAction::Cancel)
    );
    assert!(widget.copy_picker.is_none());
}
