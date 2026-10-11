use super::*;
use app_server_protocol::protocol::v2::{
    ServerRequest, ToolRequestUserInputParams, ToolRequestUserInputQuestion,
};
use app_server_protocol::RequestId;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use serde_json::json;
use std::time::Duration;

use crate::bottom_pane::{AppServerResponse, ChatWidgetAction, InputResult};

fn raw_input(app: &mut App, text: &str, now: Instant) {
    for ch in text.chars() {
        let code = match ch {
            '\n' => KeyCode::Enter,
            '\t' => KeyCode::Tab,
            ch => KeyCode::Char(ch),
        };
        let action = app
            .chat_widget
            .bottom_pane
            .handle_key_event_at(KeyEvent::new(code, KeyModifiers::NONE), now);
        assert!(matches!(
            action,
            ChatWidgetAction::Input(InputResult::None | InputResult::Changed)
        ));
    }
}

fn settle(app: &mut App, now: Instant) {
    let (frames, mut scheduled) = FrameRequester::test_channel();
    assert!(
        prepare_draw(app, true, &frames, now, now).is_none(),
        "capturing burst must defer"
    );
    assert!(
        scheduled.try_recv().is_ok(),
        "deferred capture must schedule a frame"
    );
    let due = now + Duration::from_secs(1);
    assert!(
        prepare_draw(app, true, &frames, due, due).is_none(),
        "newly flushed input must defer"
    );
    assert!(
        scheduled.try_recv().is_ok(),
        "deferred flush must schedule a frame"
    );
    assert_eq!(
        prepare_draw(app, true, &frames, due, due),
        Some(AppAction::None)
    );
    assert!(
        scheduled.try_recv().is_err(),
        "settled input must stop requesting paste frames"
    );
    let mut terminal = ratatui::Terminal::new(ratatui::backend::TestBackend::new(80, 24)).unwrap();
    terminal.draw(|frame| view::render(frame, app)).unwrap();
    assert!(terminal
        .backend()
        .buffer()
        .content()
        .iter()
        .map(|cell| cell.symbol())
        .collect::<String>()
        .contains("TAIL"));
}

#[test]
fn main_composer_defers_capture_and_flush_then_submits_complete_input_once() {
    let mut app = App::default();
    let now = Instant::now();
    let text = "ab\t界🙂\nTAIL";
    raw_input(&mut app, text, now);
    settle(&mut app, now);
    assert_eq!(app.chat_widget.bottom_pane.composer_text(), text);
    let action = app.chat_widget.bottom_pane.handle_key_event_at(
        KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE),
        now + Duration::from_secs(1),
    );
    assert!(
        matches!(action, ChatWidgetAction::Input(InputResult::Submitted { text: ref body, .. }) if body == text)
    );
    assert!(app.chat_widget.bottom_pane.composer_is_empty());
    let repeat = app.chat_widget.bottom_pane.handle_key_event_at(
        KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE),
        now + Duration::from_secs(1),
    );
    assert!(!matches!(
        repeat,
        ChatWidgetAction::Input(InputResult::Submitted { .. })
    ));
}

#[test]
fn notes_defer_flush_then_respond_with_the_entire_note_once() {
    let mut app = App::default();
    app.chat_widget
        .bottom_pane
        .enqueue(ServerRequest::ItemToolRequestUserInput {
            id: RequestId::Integer(103),
            params: ToolRequestUserInputParams {
                thread_id: "thread".into(),
                turn_id: "turn".into(),
                item_id: "question".into(),
                questions: vec![ToolRequestUserInputQuestion {
                    id: "note".into(),
                    header: "Note".into(),
                    question: "Add notes".into(),
                    is_other: false,
                    is_secret: false,
                    options: None,
                }],
                is_blocking: true,
                auto_resolution_ms: None,
            },
        })
        .unwrap();
    let now = Instant::now();
    let text = "ab\t界🙂\nTAIL";
    raw_input(&mut app, text, now);
    settle(&mut app, now);
    let action = app.chat_widget.bottom_pane.handle_key_event_at(
        KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE),
        now + Duration::from_secs(1),
    );
    let ChatWidgetAction::Respond(AppServerResponse::UserInput { id, response }) = action else {
        panic!("settled notes must produce one response: {action:?}");
    };
    assert_eq!(id, RequestId::Integer(103));
    assert_eq!(
        serde_json::to_value(response).unwrap(),
        json!({
            "answers": {"note": {"answers": [format!("user_note: {text}")]}}
        })
    );
    assert!(!app.chat_widget.bottom_pane.is_active());
    let repeat = app.chat_widget.bottom_pane.handle_key_event_at(
        KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE),
        now + Duration::from_secs(1),
    );
    assert!(!matches!(repeat, ChatWidgetAction::Respond(_)));
}

#[test]
fn mcp_field_defers_flush_then_responds_with_the_entire_field_once() {
    let mut app = App::default();
    app.chat_widget.bottom_pane.enqueue(serde_json::from_value(json!({
        "method": "mcpServer/elicitation/request", "id": 104,
        "params": {
            "threadId": "thread", "turnId": "turn", "serverName": "form-server",
            "mode": "form", "message": "Add notes", "requestedSchema": {
                "type": "object", "properties": {"note": {"type": "string"}}, "required": ["note"]
            }
        }
    })).unwrap()).unwrap();
    let now = Instant::now();
    let text = "ab\t界🙂\nTAIL";
    raw_input(&mut app, text, now);
    settle(&mut app, now);
    let action = app.chat_widget.bottom_pane.handle_key_event_at(
        KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE),
        now + Duration::from_secs(1),
    );
    let ChatWidgetAction::Respond(AppServerResponse::McpElicitation { id, response }) = action
    else {
        panic!("settled MCP field must produce one response: {action:?}");
    };
    assert_eq!(id, RequestId::Integer(104));
    assert_eq!(
        serde_json::to_value(response).unwrap(),
        json!({"action": "accept", "content": {"note": text}})
    );
    assert!(!app.chat_widget.bottom_pane.is_active());
    let repeat = app.chat_widget.bottom_pane.handle_key_event_at(
        KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE),
        now + Duration::from_secs(1),
    );
    assert!(!matches!(repeat, ChatWidgetAction::Respond(_)));
}

#[test]
fn disconnected_held_input_still_defers_without_processing_interaction_timers() {
    let mut app = App::default();
    let now = Instant::now();
    raw_input(&mut app, "a", now);
    let frames = FrameRequester::test_dummy();
    assert!(prepare_draw(&mut app, false, &frames, now, now).is_none());
    let due = now + Duration::from_secs(1);
    assert!(prepare_draw(&mut app, false, &frames, due, due).is_none());
    assert_eq!(
        prepare_draw(&mut app, false, &frames, due, due),
        Some(AppAction::None)
    );
    assert_eq!(app.chat_widget.bottom_pane.composer_text(), "a");
}

#[test]
fn request_deadlines_advance_on_wall_time_when_the_input_clock_is_frozen() {
    let mut app = App::default();
    app.chat_widget
        .bottom_pane
        .enqueue(ServerRequest::ItemToolRequestUserInput {
            id: RequestId::Integer(109),
            params: ToolRequestUserInputParams {
                thread_id: "thread".into(),
                turn_id: "turn".into(),
                item_id: "question".into(),
                questions: vec![ToolRequestUserInputQuestion {
                    id: "note".into(),
                    header: "Note".into(),
                    question: "Add notes".into(),
                    is_other: false,
                    is_secret: false,
                    options: None,
                }],
                is_blocking: false,
                auto_resolution_ms: None,
            },
        })
        .unwrap();
    let start = Instant::now();
    let due = start + Duration::from_secs(121);
    let frames = FrameRequester::test_dummy();
    let Some(AppAction::Respond(AppServerResponse::UserInput { id, response })) =
        prepare_draw(&mut app, true, &frames, due, start)
    else {
        panic!("request deadline must use the wall clock");
    };
    assert_eq!(id, RequestId::Integer(109));
    assert!(response.answers.is_empty());
    assert_eq!(
        prepare_draw(&mut app, true, &frames, due, start),
        Some(AppAction::None)
    );
}

#[test]
fn bounded_search_restarted_by_render_continues_without_another_input_event() {
    use crate::terminal_hyperlinks::HyperlinkLine;
    use crossterm::event::Event;
    let mut app = App::default();
    app.transcript_view.search.begin(0, false);
    app.transcript_view
        .search
        .handle_event(&Event::Paste("needle".into()), false);
    let lines = (0..40)
        .map(|index| HyperlinkLine::from(format!("line {index}")))
        .collect::<Vec<_>>();
    let (frames, mut requested) = FrameRequester::test_channel();
    assert!(!app.transcript_search_needs_frame());
    // A new projection first appears inside render, after pre_draw_tick has returned None.
    app.transcript_view
        .search
        .prepare(&lines, 80, &Default::default(), false);
    finish_draw(&app, &frames);
    assert!(requested.try_recv().is_ok());
    while app.transcript_view.search.needs_frame() {
        app.transcript_view
            .search
            .prepare(&lines, 80, &Default::default(), false);
        finish_draw(&app, &frames);
    }
    assert!(app.transcript_view.search.matches_valid());
    while requested.try_recv().is_ok() {}
    finish_draw(&app, &frames);
    assert!(
        requested.try_recv().is_err(),
        "settled search must stop drawing"
    );
    app.chat_widget.set_scrollback_has_older_history(true);
    finish_draw(&app, &frames);
    assert!(
        requested.try_recv().is_ok(),
        "a completed scan requesting history needs a host frame"
    );
    let now = Instant::now();
    assert_eq!(
        prepare_draw(&mut app, true, &frames, now, now),
        Some(AppAction::LoadOlderHistory)
    );
}
