use super::*;
use crate::app::AppAction;
use crate::locale::Locale;
use crate::projection::{EntryKind, TranscriptEntry};
use crate::resume_picker::{PickerState, SessionPickerAction, SessionStatus};
use crate::tui::TuiEvent;
use app_server_protocol::protocol::v2::{
    CommandExecutionRequestApprovalParams, ServerRequest, SessionSource, Thread, ThreadHistoryMode,
    ThreadStatus,
};
use app_server_protocol::RequestId;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEvent, MouseEventKind};
use ratatui::backend::TestBackend;
use ratatui::Terminal;

fn selected_picker() -> App {
    let thread = Thread {
        id: "one".into(),
        extra: None,
        session_id: "session-one".into(),
        forked_from_id: None,
        parent_thread_id: None,
        preview: "preview".into(),
        ephemeral: false,
        section: None,
        section_entered_at: None,
        project_id: None,
        history_mode: ThreadHistoryMode::default(),
        model_provider: "fixture".into(),
        created_at: 1,
        updated_at: 1,
        recency_at: None,
        status: ThreadStatus::Idle,
        path: None,
        cwd: "/workspace".into(),
        cli_version: "test".into(),
        source: SessionSource::Cli,
        can_accept_direct_input: Some(true),
        thread_source: None,
        agent_nickname: None,
        agent_role: None,
        git_info: None,
        name: None,
        turns: Vec::new(),
    };
    let mut picker = PickerState::new(
        vec![thread],
        SessionPickerAction::Resume,
        SessionStatus::Active,
        None,
        true,
    );
    picker.set_transcript(
        "one".into(),
        Ok(vec![TranscriptEntry {
            id: "entry-1".into(),
            kind: EntryKind::Assistant,
            text: "alpha beta".into(),
            streaming: false,
            status: None,
            summary: Vec::new(),
            activity_group: None,
            activity_detail: None,
        }]),
    );
    assert_eq!(picker.open_transcript_pager(Locale::EnUs), None);
    let mut app = App::default();
    app.chat_widget.set_locale(Locale::EnUs);
    app.chat_widget.set_resume_picker(picker);
    let mut terminal = Terminal::new(TestBackend::new(60, 12)).unwrap();
    terminal
        .draw(|frame| crate::view::render(frame, &app))
        .unwrap();
    for (kind, column) in [
        (MouseEventKind::Down(MouseButton::Left), 0),
        (MouseEventKind::Drag(MouseButton::Left), 4),
        (MouseEventKind::Up(MouseButton::Left), 4),
    ] {
        app.handle_tui_event_runtime(
            TuiEvent::Mouse(MouseEvent {
                kind,
                column,
                row: 1,
                modifiers: KeyModifiers::NONE,
            }),
            true,
            std::time::Instant::now(),
        );
    }
    app
}

#[test]
fn hidden_picker_finishes_local_copy_feedback_without_finishing_its_selection() {
    for front in ["pager", "approval", "status", "title"] {
        let mut app = selected_picker();
        app.chat_widget
            .bottom_pane
            .insert_str("keep composer draft");
        let copy_key = TuiEvent::Key(KeyEvent::new(
            KeyCode::Char('c'),
            KeyModifiers::CONTROL | KeyModifiers::SHIFT,
        ));
        let AppAction::CopyTranscriptSelection {
            text,
            format,
            follow,
            target,
        } = app.handle_tui_event_runtime(copy_key.clone(), true, std::time::Instant::now())
        else {
            panic!("picker must own the selected copy before {front}");
        };
        assert_eq!(target, TranscriptSelectionTarget::ResumePicker);
        app.defer_copy(
            7,
            PendingCopyContext::TranscriptSelection {
                format: format.clone(),
                text: text.clone(),
                follow,
                target,
            },
        );
        match front {
            "pager" => app
                .chat_widget
                .set_pager_overlay(crate::pager_overlay::PagerOverlay::new(
                    "FRONT_PAGER".into(),
                    Vec::new(),
                )),
            "status" => app.chat_widget.show_status_line_setup(),
            "title" => app.chat_widget.show_terminal_title_setup(),
            "approval" => app
                .chat_widget
                .bottom_pane
                .enqueue(ServerRequest::ItemCommandExecutionRequestApproval {
                    id: RequestId::Integer(107),
                    params: CommandExecutionRequestApprovalParams {
                        thread_id: "thread-1".into(),
                        turn_id: "turn-1".into(),
                        item_id: "item-1".into(),
                        started_at_ms: 1,
                        approval_id: None,
                        network_approval_context: None,
                        command: Some("VISIBLE_APPROVAL_OWNER".into()),
                        cwd: Some("/workspace".into()),
                        reason: None,
                        available_decisions: None,
                    },
                })
                .unwrap(),
            _ => unreachable!(),
        }
        assert_ne!(
            app.fullscreen_surface(),
            Some(FullscreenSurface::ResumePicker)
        );
        app.projection.set_status("foreground ready");
        app.finish_clipboard_copy(7, Ok(crate::clipboard_copy::CopyStatus::Confirmed));
        assert_eq!(app.projection.status(), "foreground ready", "{front}");
        assert_eq!(
            app.chat_widget.bottom_pane.composer_text(),
            "keep composer draft",
            "{front}"
        );
        if front == "approval" {
            assert!(matches!(
                app.handle_tui_event_runtime(
                    TuiEvent::Key(KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE)),
                    true,
                    std::time::Instant::now(),
                ),
                AppAction::Respond(_)
            ));
        }
        app.chat_widget.pager_overlay = None;
        app.chat_widget.status_line_setup = None;
        app.chat_widget.terminal_title_setup = None;
        let mut terminal = Terminal::new(TestBackend::new(60, 12)).unwrap();
        terminal
            .draw(|frame| crate::view::render(frame, &app))
            .unwrap();
        let rendered = terminal
            .backend()
            .buffer()
            .content
            .iter()
            .map(|cell| cell.symbol())
            .collect::<String>();
        assert!(rendered.contains("Copied "), "{front}: {rendered}");
        assert_eq!(
            app.handle_tui_event_runtime(copy_key, true, std::time::Instant::now()),
            AppAction::CopyTranscriptSelection {
                text,
                format,
                follow,
                target
            },
            "{front}"
        );
    }
}
