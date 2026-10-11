use super::*;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEvent, MouseEventKind};
use ratatui::backend::TestBackend;

#[test]
fn ordinary_events_and_frames_reuse_geometry_without_querying() {
    let cached = Size::new(100, 24);
    let mut policy = ScreenSizePolicy::new(cached);
    let now = Instant::now();
    for event in [
        TuiEvent::Key(KeyEvent::new(KeyCode::Char('界'), KeyModifiers::NONE)),
        TuiEvent::Paste("raw paste".into()),
        TuiEvent::Mouse(MouseEvent {
            kind: MouseEventKind::Moved,
            column: 1,
            row: 1,
            modifiers: KeyModifiers::NONE,
        }),
        TuiEvent::FocusLost,
        TuiEvent::FocusGained,
        TuiEvent::Draw,
    ] {
        assert_eq!(
            policy
                .screen_size_for_event(&event, now, || panic!("queried backend for {event:?}"))
                .unwrap(),
            cached
        );
    }
    assert_eq!(
        policy
            .take_event_screen_size(|| panic!("second query"))
            .unwrap(),
        cached
    );
}

#[test]
fn deferred_draw_preserves_reserved_size_until_the_settled_event_replaces_it() {
    let mut policy = ScreenSizePolicy::new(Size::new(100, 24));
    let now = Instant::now();
    let resized = Size::new(70, 18);
    policy
        .screen_size_for_event(&TuiEvent::Resize(resized), now, || unreachable!())
        .unwrap();
    // A paste gate skips drawing, so the size is left reserved through intervening input.
    for event in [
        TuiEvent::Draw,
        TuiEvent::Key(KeyEvent::new(KeyCode::Char('界'), KeyModifiers::NONE)),
        TuiEvent::Paste("burst tail".into()),
        TuiEvent::FocusLost,
        TuiEvent::Draw,
    ] {
        assert_eq!(
            policy
                .screen_size_for_event(&event, now, || panic!("deferred {event:?} queried"))
                .unwrap(),
            resized
        );
        assert_eq!(policy.pending_draw_size, Some(resized));
    }
    let settled = Size::new(80, 20);
    policy
        .screen_size_for_event(&TuiEvent::Draw, now + TRANSCRIPT_REFLOW_DEBOUNCE, || {
            Ok(settled)
        })
        .unwrap();
    policy
        .screen_size_for_event(
            &TuiEvent::FocusLost,
            now + TRANSCRIPT_REFLOW_DEBOUNCE,
            || unreachable!(),
        )
        .unwrap();
    assert_eq!(
        policy
            .take_event_screen_size(|| panic!("deferred size was lost"))
            .unwrap(),
        settled
    );
    assert!(policy.pending_draw_size.is_none());
    assert!(policy.pending_recheck_at.is_none());
}

#[test]
fn resize_reserves_event_size_then_queries_settled_geometry_once() {
    let mut policy = ScreenSizePolicy::new(Size::new(100, 24));
    let now = Instant::now();
    let event_size = Size::new(70, 18);
    let settled = Size::new(80, 20);
    policy
        .screen_size_for_event(&TuiEvent::Resize(event_size), now, || {
            panic!("resize queried")
        })
        .unwrap();
    assert_eq!(
        policy
            .take_event_screen_size(|| panic!("draw queried"))
            .unwrap(),
        event_size
    );
    assert_eq!(
        policy
            .screen_size_for_event(&TuiEvent::Draw, now, || panic!("early query"))
            .unwrap(),
        event_size
    );
    let due = now + TRANSCRIPT_REFLOW_DEBOUNCE;
    assert_eq!(
        policy
            .screen_size_for_event(&TuiEvent::Draw, due, || Ok(settled))
            .unwrap(),
        settled
    );
    assert_eq!(
        policy
            .take_event_screen_size(|| panic!("second settled query"))
            .unwrap(),
        settled
    );
    assert_eq!(
        policy
            .screen_size_for_event(&TuiEvent::Draw, due, || panic!("repeated query"))
            .unwrap(),
        settled
    );
}

#[test]
fn resize_storm_restarts_deadline_and_focus_can_settle_it() {
    let mut policy = ScreenSizePolicy::new(Size::new(100, 24));
    let now = Instant::now();
    policy
        .screen_size_for_event(&TuiEvent::Resize(Size::new(90, 23)), now, || unreachable!())
        .unwrap();
    let later = now + Duration::from_millis(50);
    let last = Size::new(60, 14);
    policy
        .screen_size_for_event(&TuiEvent::Resize(last), later, || unreachable!())
        .unwrap();
    assert_eq!(
        policy
            .screen_size_for_event(
                &TuiEvent::Draw,
                now + TRANSCRIPT_REFLOW_DEBOUNCE,
                || panic!("old deadline sampled")
            )
            .unwrap(),
        last
    );
    let settled = Size::new(62, 15);
    assert_eq!(
        policy
            .screen_size_for_event(
                &TuiEvent::FocusGained,
                later + TRANSCRIPT_REFLOW_DEBOUNCE,
                || Ok(settled)
            )
            .unwrap(),
        settled
    );
}

#[test]
fn resume_refreshes_and_cancels_pending_resize_recheck() {
    let mut policy = ScreenSizePolicy::new(Size::new(100, 24));
    let now = Instant::now();
    policy
        .screen_size_for_event(&TuiEvent::Resize(Size::new(80, 20)), now, || unreachable!())
        .unwrap();
    let resumed = Size::new(120, 40);
    policy
        .screen_size_for_event(&TuiEvent::Resume, now, || Ok(resumed))
        .unwrap();
    assert!(policy.pending_recheck_at.is_none());
    assert_eq!(
        policy
            .take_event_screen_size(|| panic!("resume draw queried"))
            .unwrap(),
        resumed
    );
    assert_eq!(
        policy
            .screen_size_for_event(&TuiEvent::Draw, now + Duration::from_secs(1), || panic!(
                "stale recheck"
            ))
            .unwrap(),
        resumed
    );
}

#[test]
fn failed_query_preserves_cached_geometry_and_recheck() {
    let cached = Size::new(80, 20);
    let mut policy = ScreenSizePolicy::new(cached);
    let now = Instant::now();
    policy
        .screen_size_for_event(&TuiEvent::Resize(cached), now, || unreachable!())
        .unwrap();
    assert!(policy
        .screen_size_for_event(&TuiEvent::Draw, now + TRANSCRIPT_REFLOW_DEBOUNCE, || Err(
            io::Error::other("fixture query failed")
        ))
        .is_err());
    assert_eq!(policy.last_known_size, cached);
    assert!(policy.pending_recheck_at.is_some());
}

#[test]
fn direct_draw_queries_once_and_following_event_frame_uses_that_size() {
    let mut policy = ScreenSizePolicy::new(Size::new(80, 20));
    let fresh = Size::new(90, 30);
    assert_eq!(policy.take_event_screen_size(|| Ok(fresh)).unwrap(), fresh);
    policy
        .screen_size_for_event(&TuiEvent::Draw, Instant::now(), || panic!("ordinary query"))
        .unwrap();
    assert_eq!(
        policy
            .take_event_screen_size(|| panic!("frame query"))
            .unwrap(),
        fresh
    );
}

#[test]
fn ratatui_draw_uses_reserved_geometry_until_explicit_resize() {
    let mut terminal = terminal_with_size(TestBackend::new(20, 4), Size::new(20, 4)).unwrap();
    terminal.backend_mut().resize(40, 8);
    assert_eq!(
        terminal
            .draw(|frame| assert_eq!(frame.area().as_size(), Size::new(20, 4)))
            .unwrap()
            .area
            .as_size(),
        Size::new(20, 4)
    );
    terminal.resize(Size::new(40, 8).into()).unwrap();
    terminal
        .draw(|frame| assert_eq!(frame.area().as_size(), Size::new(40, 8)))
        .unwrap();
}
