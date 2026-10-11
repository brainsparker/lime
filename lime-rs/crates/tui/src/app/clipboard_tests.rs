use super::*;
use crate::tui::TuiEvent;
use app_server_protocol::protocol::v2::{AgentMessageDeltaNotification, ServerNotification};
use crossterm::event::{Event, MouseButton, MouseEvent, MouseEventKind};
use ratatui::backend::TestBackend;
use ratatui::Terminal;

fn confirmed() -> crate::clipboard_copy::worker::CopyResult {
    Ok(crate::clipboard_copy::CopyStatus::Confirmed)
}

#[test]
fn main_mouse_release_dispatches_silent_primary_and_explicit_copy_keeps_its_own_action() {
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
    let mut app = App::default();
    app.transcript_view.selection.update_layout(
        ratatui::layout::Rect::new(0, 0, 20, 2),
        0,
        &[crate::terminal_hyperlinks::HyperlinkLine::from(
            "selected text",
        )],
    );
    app.projection.set_status("existing status");
    for (kind, column) in [
        (MouseEventKind::Down(MouseButton::Left), 0),
        (MouseEventKind::Drag(MouseButton::Left), 8),
        (MouseEventKind::Up(MouseButton::Left), 8),
    ] {
        let action = app.handle_tui_event(
            TuiEvent::Mouse(MouseEvent {
                kind,
                column,
                row: 0,
                modifiers: KeyModifiers::NONE,
            }),
            true,
        );
        assert_eq!(
            action,
            if kind == MouseEventKind::Up(MouseButton::Left) {
                crate::app::AppAction::PublishPrimarySelection {
                    target: TranscriptSelectionTarget::MainTranscript,
                }
            } else {
                crate::app::AppAction::None
            }
        );
    }
    assert!(app.transcript_view.selection.is_active());
    assert_eq!(
        app.handle_tui_event(
            TuiEvent::Key(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL)),
            true
        ),
        crate::app::AppAction::CopyTranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "selected".into(),
            follow: false,
            target: TranscriptSelectionTarget::MainTranscript
        }
    );
    assert_eq!(app.projection.status(), "existing status");
}

fn finish_copy(
    app: &mut App,
    context: PendingCopyContext,
    result: crate::clipboard_copy::worker::CopyResult,
) {
    app.defer_copy(7, context);
    app.finish_clipboard_copy(7, result);
}

#[test]
fn submission_statuses_preserve_the_ticket_and_selection_until_delivery_completes() {
    let mut app = app_with_main_transcript_selection();
    app.projection.set_status("waiting for copy");
    app.defer_copy(
        7,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: false,
            target: TranscriptSelectionTarget::MainTranscript,
        },
    );
    for status in [CopyStatus::Pending(7), CopyStatus::Busy] {
        app.finish_clipboard_copy(7, Ok(status));
        assert_eq!(
            app.pending_clipboard_copy.as_ref().unwrap().id,
            7,
            "{status:?}"
        );
        assert!(app.transcript_view.selection.is_active(), "{status:?}");
        assert_eq!(app.projection.status(), "waiting for copy", "{status:?}");
    }
    app.finish_clipboard_copy(7, confirmed());
    assert!(app.pending_clipboard_copy.is_none());
    assert!(!app.transcript_view.selection.is_active());
    assert_eq!(app.projection.status(), "copy confirmed: 5");
}

#[test]
fn unrelated_and_duplicate_completions_do_not_consume_current_feedback() {
    let mut app = app_with_main_transcript_selection();
    app.projection.set_status("waiting for copy");
    app.defer_copy(
        7,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: false,
            target: TranscriptSelectionTarget::MainTranscript,
        },
    );
    app.finish_clipboard_copy(6, confirmed());
    assert_eq!(app.pending_clipboard_copy.as_ref().unwrap().id, 7);
    assert_eq!(app.projection.status(), "waiting for copy");
    assert!(app.transcript_view.selection.is_active());
    app.finish_clipboard_copy(7, confirmed());
    assert!(app.pending_clipboard_copy.is_none());
    assert!(!app.transcript_view.selection.is_active());
    assert_eq!(app.transcript_view.scroll, 4);
    assert_eq!(app.projection.status(), "copy confirmed: 5");
    app.finish_clipboard_copy(7, Err("late failure".into()));
    assert_eq!(app.projection.status(), "copy confirmed: 5");
}

#[test]
fn old_thread_completion_does_not_touch_new_selection() {
    let mut app = app_with_main_transcript_selection();
    let scroll_before_completion = app.transcript_view.scroll;
    app.thread_id = Some("old-thread".into());
    app.defer_copy(
        7,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainTranscript,
        },
    );
    app.thread_id = Some("new-thread".into());
    app.projection.set_status("new thread ready");
    app.finish_clipboard_copy(7, confirmed());
    assert!(app.pending_clipboard_copy.is_none());
    assert_eq!(app.projection.status(), "new thread ready");
    assert!(app.transcript_view.selection.is_active());
    assert_eq!(app.transcript_view.scroll, scroll_before_completion);
}

#[test]
fn closed_pager_completion_does_not_apply_feedback_to_another_surface() {
    let mut app = app_with_transcript_selection();
    app.defer_copy(
        7,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainPager,
        },
    );
    app.chat_widget.pager_overlay = None;
    app.projection.set_status("composer ready");
    app.finish_clipboard_copy(7, confirmed());
    assert!(app.pending_clipboard_copy.is_none());
    assert_eq!(app.projection.status(), "composer ready");
}

#[test]
fn same_thread_completion_cannot_finish_a_replaced_or_moved_main_selection() {
    for change in [
        "replace",
        "move",
        "navigate",
        "scroll",
        "hide",
        "presentation",
    ] {
        let mut app = app_with_main_transcript_selection();
        app.defer_copy(
            7,
            PendingCopyContext::TranscriptSelection {
                format: crate::clipboard_copy::CopyFormat::PlainText,
                text: "alpha".into(),
                follow: true,
                target: TranscriptSelectionTarget::MainTranscript,
            },
        );
        match change {
            "replace" => {
                app.transcript_view.selection.clear();
                select_main_transcript(&app);
            }
            "move" => {
                app.transcript_view.selection.handle_event(&Event::Key(
                    crossterm::event::KeyEvent::new(
                        crossterm::event::KeyCode::Left,
                        crossterm::event::KeyModifiers::NONE,
                    ),
                ));
            }
            "navigate" => app.transcript_view.scroll = 9,
            "scroll" => {
                app.transcript_view.selection.update_layout(
                    ratatui::layout::Rect::new(0, 0, 40, 1),
                    0,
                    &[crate::terminal_hyperlinks::HyperlinkLine::from(
                        "ignored live update",
                    )],
                );
                // The selected frozen source must have another wrapped row to navigate to.
                app.transcript_view.selection.update_layout(
                    ratatui::layout::Rect::new(0, 0, 5, 1),
                    0,
                    &[],
                );
                assert!(app.transcript_view.selection.scroll_rows(1));
            }
            "hide" => {
                app.chat_widget.pager_overlay =
                    app_with_transcript_selection().chat_widget.pager_overlay
            }
            "presentation" => {
                app.toggle_raw_output_mode();
            }
            _ => unreachable!(),
        }
        let scroll_before = app.transcript_view.scroll;
        app.finish_clipboard_copy(7, confirmed());
        assert_eq!(
            app.transcript_view.selection.is_active(),
            change != "presentation",
            "{change}"
        );
        assert_eq!(app.transcript_view.scroll, scroll_before, "{change}");
        if change != "hide" {
            assert_eq!(app.projection.status(), "copy confirmed: 5", "{change}");
        }
        let mut terminal = Terminal::new(TestBackend::new(40, 1)).unwrap();
        terminal
            .draw(|frame| {
                app.transcript_view.composer_gap.render(
                    frame,
                    Some(frame.area()),
                    crate::locale::Locale::EnUs,
                );
            })
            .unwrap();
        assert!(
            terminal
                .backend()
                .buffer()
                .content
                .iter()
                .map(|cell| cell.symbol())
                .collect::<String>()
                .contains("Copied 5 chars"),
            "{change}"
        );
    }
}

#[test]
fn visible_pager_above_resume_picker_finishes_its_original_copy() {
    let mut app = app_with_transcript_selection();
    app.chat_widget.set_locale(crate::locale::Locale::EnUs);
    app.defer_copy(
        7,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainPager,
        },
    );
    app.chat_widget
        .set_resume_picker(crate::resume_picker::PickerState::new(
            Vec::new(),
            crate::resume_picker::SessionPickerAction::Resume,
            crate::resume_picker::SessionStatus::Active,
            None,
            true,
        ));
    app.projection.set_status("picker ready");
    app.finish_clipboard_copy(7, confirmed());
    assert_eq!(app.projection.status(), "copy confirmed: 5");
    let pager = app.chat_widget.pager_overlay.as_ref().unwrap();
    assert!(!pager.has_transcript_selection());
    let mut terminal = Terminal::new(TestBackend::new(40, 8)).unwrap();
    terminal
        .draw(|frame| crate::view::render(frame, &app))
        .unwrap();
    assert!(terminal
        .backend()
        .buffer()
        .content
        .iter()
        .map(|cell| cell.symbol())
        .collect::<String>()
        .contains("Copied 5 chars"));
}

#[test]
fn reopened_pager_does_not_consume_old_copy_completion() {
    let mut app = app_with_transcript_selection();
    app.defer_copy(
        7,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainPager,
        },
    );
    app.chat_widget.pager_overlay = app_with_transcript_selection().chat_widget.pager_overlay;
    app.projection.set_status("new pager ready");
    app.finish_clipboard_copy(7, confirmed());
    assert!(app
        .chat_widget
        .pager_overlay
        .as_ref()
        .unwrap()
        .has_transcript_selection());
    assert_eq!(app.projection.status(), "new pager ready");
}

fn select_composer(app: &mut App) {
    let area = ratatui::layout::Rect::new(0, 0, 40, 3);
    let mut buffer = ratatui::buffer::Buffer::empty(area);
    app.chat_widget
        .bottom_pane
        .render_composer_textarea(area, &mut buffer);
    for (kind, column) in [
        (MouseEventKind::Down(MouseButton::Left), 1),
        (MouseEventKind::Drag(MouseButton::Left), 5),
        (MouseEventKind::Up(MouseButton::Left), 5),
    ] {
        assert!(app.chat_widget.bottom_pane.handle_mouse(MouseEvent {
            kind,
            column,
            row: 0,
            modifiers: crossterm::event::KeyModifiers::NONE,
        }));
    }
}

#[test]
fn keyboard_copy_only_clears_the_original_visible_composer_selection() {
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
    for change in ["none", "replace", "edit", "hide", "disable"] {
        let mut app = App::default();
        app.chat_widget.bottom_pane.insert_str("hello world");
        select_composer(&mut app);
        let copy = TuiEvent::Key(KeyEvent::new(
            KeyCode::Char('c'),
            KeyModifiers::CONTROL | KeyModifiers::SHIFT,
        ));
        assert_eq!(
            app.handle_tui_event_runtime(copy.clone(), true, std::time::Instant::now()),
            crate::app::AppAction::CopyComposerSelection {
                text: "ello".into()
            }
        );
        app.defer_copy(7, PendingCopyContext::ComposerSelection);
        match change {
            "replace" => {
                app.chat_widget
                    .bottom_pane
                    .set_composer_text("hello world".into());
                select_composer(&mut app);
            }
            "edit" => app.chat_widget.bottom_pane.insert_str("!"),
            "hide" => {
                app.chat_widget.pager_overlay =
                    app_with_transcript_selection().chat_widget.pager_overlay
            }
            "disable" => app
                .chat_widget
                .bottom_pane
                .set_composer_input_enabled(false, None),
            _ => {}
        }
        let draft = app.chat_widget.bottom_pane.composer_text().to_string();
        app.projection.set_status("current surface ready");
        app.finish_clipboard_copy(7, confirmed());
        assert_eq!(
            app.chat_widget.bottom_pane.composer_text(),
            draft,
            "{change}"
        );
        assert_eq!(
            app.projection.status(),
            if change == "none" {
                "copy confirmed"
            } else {
                "current surface ready"
            },
            "{change}"
        );
        if change == "hide" {
            app.chat_widget.pager_overlay = None;
        }
        if change == "disable" {
            app.chat_widget
                .bottom_pane
                .set_composer_input_enabled(true, None);
        }
        assert_eq!(
            app.chat_widget
                .bottom_pane
                .copy_selection_request(&copy)
                .is_some(),
            matches!(change, "replace" | "hide" | "disable"),
            "{change}"
        );
    }
}

fn app_with_transcript_selection() -> App {
    let mut pager = crate::pager_overlay::PagerOverlay::transcript(crate::locale::Locale::EnUs);
    let lines = vec![crate::terminal_hyperlinks::HyperlinkLine::from(
        "alpha beta",
    )];
    let mut terminal = Terminal::new(TestBackend::new(40, 8)).expect("terminal");
    terminal
        .draw(|frame| {
            pager.render(frame, frame.area(), crate::locale::Locale::EnUs, &lines);
        })
        .expect("draw");
    for (kind, column) in [
        (MouseEventKind::Down(MouseButton::Left), 0),
        (MouseEventKind::Drag(MouseButton::Left), 5),
        (MouseEventKind::Up(MouseButton::Left), 5),
    ] {
        assert_eq!(
            pager.handle_event(&Event::Mouse(MouseEvent {
                kind,
                column,
                row: 1,
                modifiers: crossterm::event::KeyModifiers::NONE,
            })),
            if kind == MouseEventKind::Up(MouseButton::Left) {
                crate::pager_overlay::PagerAction::PublishPrimarySelection
            } else {
                crate::pager_overlay::PagerAction::Consumed
            }
        );
    }
    assert!(pager.has_transcript_selection());
    let mut app = App::default();
    app.chat_widget.set_pager_overlay(pager);
    app
}

fn app_with_main_transcript_selection() -> App {
    let app = App::default();
    let lines = vec![crate::terminal_hyperlinks::HyperlinkLine::from(
        "alpha beta",
    )];
    app.transcript_view
        .selection
        .update_layout(ratatui::layout::Rect::new(0, 0, 40, 3), 0, &lines);
    select_main_transcript(&app);
    app
}

fn select_main_transcript(app: &App) {
    assert_eq!(
        app.transcript_view
            .selection
            .handle_event(&Event::Key(crossterm::event::KeyEvent::new(
                crossterm::event::KeyCode::Char(' '),
                crossterm::event::KeyModifiers::CONTROL,
            ),)),
        Some(crate::transcript_view::TranscriptSelectionAction::Consumed)
    );
    for _ in 0..5 {
        app.transcript_view
            .selection
            .handle_event(&Event::Key(crossterm::event::KeyEvent::new(
                crossterm::event::KeyCode::Right,
                crossterm::event::KeyModifiers::NONE,
            )));
    }
    app.transcript_view
        .selection
        .note_resume_distance_from_bottom(4);
}

#[test]
fn copy_uses_last_canonical_agent_markdown_and_reports_outcome() {
    let mut app = App::default();
    app.projection.apply(ServerNotification::AgentMessageDelta(
        AgentMessageDeltaNotification {
            thread_id: "thread-1".to_string(),
            turn_id: "turn-1".to_string(),
            item_id: "message-1".to_string(),
            delta: "**answer** with `code` :codex-followup[continue]{prompt=\"private\"}"
                .to_string(),
        },
    ));
    assert_eq!(
        app.last_response_to_copy().as_deref(),
        Some("**answer** with `code` continue")
    );
    finish_copy(&mut app, PendingCopyContext::LastResponse, confirmed());
    assert_eq!(app.projection.status(), "copied last response");

    let mut empty = App::default();
    assert!(empty.last_response_to_copy().is_none());
    assert_eq!(empty.projection.status(), "no agent response to copy");
}

#[test]
fn composer_copy_clears_selection_only_after_confirmation() {
    use crossterm::event::{
        KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEvent, MouseEventKind,
    };
    use ratatui::buffer::Buffer;
    use ratatui::layout::Rect;

    let mut app = App::default();
    app.chat_widget.bottom_pane.insert_str("hello world");
    let area = Rect::new(0, 0, 20, 1);
    let mut buffer = Buffer::empty(area);
    app.chat_widget
        .bottom_pane
        .render_composer_textarea(area, &mut buffer);
    for (kind, column) in [
        (MouseEventKind::Down(MouseButton::Left), 1),
        (MouseEventKind::Drag(MouseButton::Left), 5),
        (MouseEventKind::Up(MouseButton::Left), 5),
    ] {
        assert!(app.chat_widget.bottom_pane.handle_mouse(MouseEvent {
            kind,
            column,
            row: 0,
            modifiers: KeyModifiers::NONE,
        }));
    }

    finish_copy(
        &mut app,
        PendingCopyContext::ComposerSelection,
        Ok(crate::clipboard_copy::CopyStatus::Unconfirmed),
    );
    assert_eq!(app.projection.status(), "copy unconfirmed");
    assert!(app
        .chat_widget
        .bottom_pane
        .copy_selection_request(&TuiEvent::Key(KeyEvent::new(
            KeyCode::Char('c'),
            KeyModifiers::CONTROL | KeyModifiers::SHIFT,
        )))
        .is_some());

    finish_copy(&mut app, PendingCopyContext::ComposerSelection, confirmed());
    assert_eq!(app.projection.status(), "copy confirmed");
    assert!(app
        .chat_widget
        .bottom_pane
        .copy_selection_request(&TuiEvent::Key(KeyEvent::new(
            KeyCode::Char('c'),
            KeyModifiers::CONTROL | KeyModifiers::SHIFT,
        )))
        .is_none());
}

#[test]
fn transcript_copy_clears_selection_only_after_success() {
    let mut app = app_with_transcript_selection();
    finish_copy(
        &mut app,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: false,
            target: TranscriptSelectionTarget::MainPager,
        },
        Ok(crate::clipboard_copy::CopyStatus::Confirmed),
    );
    assert_eq!(app.projection.status(), "copy confirmed: 5");
    assert!(!app
        .chat_widget
        .pager_overlay
        .as_ref()
        .expect("pager")
        .has_transcript_selection());

    let mut failed = app_with_transcript_selection();
    finish_copy(
        &mut failed,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainPager,
        },
        Err("offline".to_string()),
    );
    assert_eq!(failed.projection.status(), "copy failed: offline");
    assert!(failed
        .chat_widget
        .pager_overlay
        .as_ref()
        .expect("pager")
        .has_transcript_selection());

    let mut unconfirmed = app_with_transcript_selection();
    finish_copy(
        &mut unconfirmed,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainPager,
        },
        Ok(crate::clipboard_copy::CopyStatus::Unconfirmed),
    );
    assert_eq!(unconfirmed.projection.status(), "copy unconfirmed");
    let pager = unconfirmed
        .chat_widget
        .pager_overlay
        .as_ref()
        .expect("pager");
    assert!(pager.has_transcript_selection());
}

#[test]
fn main_transcript_copy_preserves_reading_position_unless_enter_follows() {
    let mut confirmed = app_with_main_transcript_selection();
    finish_copy(
        &mut confirmed,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: false,
            target: TranscriptSelectionTarget::MainTranscript,
        },
        Ok(crate::clipboard_copy::CopyStatus::Confirmed),
    );
    assert!(!confirmed.transcript_view.selection.is_active());
    assert_eq!(confirmed.transcript_view.scroll, 4);

    let mut failed = app_with_main_transcript_selection();
    finish_copy(
        &mut failed,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: false,
            target: TranscriptSelectionTarget::MainTranscript,
        },
        Err("offline".to_string()),
    );
    assert!(failed.transcript_view.selection.is_active());

    let mut unconfirmed = app_with_main_transcript_selection();
    finish_copy(
        &mut unconfirmed,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainTranscript,
        },
        Ok(crate::clipboard_copy::CopyStatus::Unconfirmed),
    );
    assert!(unconfirmed.transcript_view.selection.is_active());

    let mut follow = app_with_main_transcript_selection();
    follow.transcript_view.scroll = 9;
    finish_copy(
        &mut follow,
        PendingCopyContext::TranscriptSelection {
            format: crate::clipboard_copy::CopyFormat::PlainText,
            text: "alpha".into(),
            follow: true,
            target: TranscriptSelectionTarget::MainTranscript,
        },
        Ok(crate::clipboard_copy::CopyStatus::Confirmed),
    );
    assert!(!follow.transcript_view.selection.is_active());
    assert_eq!(follow.transcript_view.scroll, 0);
}
