use super::tests::{completed, controlled_worker, deadline, frames, response, start};
use super::*;

#[test]
fn one_primary_read_waits_for_publication_instead_of_being_rejected_as_busy() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, true);
    requests.recv().unwrap();
    let _selection = worker.select("selected text".into(), frames());
    assert!(
        worker
            .read_text(PasteSource::Primary, frames())
            .unwrap()
            .is_some(),
        "PRIMARY read must wait behind selection publication"
    );
    assert!(requests.try_recv().is_err());
    responses.send(response(first, true)).unwrap();
}

#[test]
fn transcript_owner_cancels_queued_publication_on_replacement_navigation_and_handoff() {
    use crate::transcript_view::{TranscriptSelection, TranscriptSelectionAction};
    use crossterm::event::{
        Event, KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEvent, MouseEventKind,
    };
    let mouse = |kind, column| {
        Event::Mouse(MouseEvent {
            kind,
            column,
            row: 0,
            modifiers: KeyModifiers::NONE,
        })
    };
    for cancel in [
        "clear", "reset", "replace", "move", "focus", "resume", "hidden",
    ] {
        let (mut worker, requests, responses) = controlled_worker();
        let (first, _scope) = start(&mut worker, true);
        requests.recv().unwrap();
        let selection = TranscriptSelection::default();
        selection.update_layout(
            ratatui::layout::Rect::new(0, 0, 20, 2),
            0,
            &[crate::terminal_hyperlinks::HyperlinkLine::from(
                "selected text",
            )],
        );
        selection.handle_event(&mouse(MouseEventKind::Down(MouseButton::Left), 0));
        selection.handle_event(&mouse(MouseEventKind::Drag(MouseButton::Left), 8));
        assert_eq!(
            selection.handle_event(&mouse(MouseEventKind::Up(MouseButton::Left), 8)),
            Some(TranscriptSelectionAction::PublishPrimary)
        );
        selection.publish_primary(&mut worker, frames());
        assert!(worker.primary.as_ref().unwrap().1.strong_count() > 0);
        match cancel {
            "clear" => selection.clear(),
            "reset" => selection.reset(),
            "replace" => {
                selection.handle_event(&mouse(MouseEventKind::Down(MouseButton::Left), 4));
            }
            "move" => {
                selection.handle_event(&Event::Key(KeyEvent::new(
                    KeyCode::Right,
                    KeyModifiers::NONE,
                )));
            }
            "focus" => {
                selection.handle_event(&Event::FocusLost);
            }
            "resume" => selection.end_drag(),
            "hidden" => selection.cancel_primary(),
            _ => unreachable!(),
        }
        responses.send(response(first, true)).unwrap();
        worker.poll().unwrap();
        worker.advance(frames());
        assert!(
            requests.try_recv().is_err(),
            "{cancel} must cancel pending publication"
        );
        if matches!(cancel, "focus" | "resume" | "hidden") {
            assert!(
                selection.is_active(),
                "{cancel} retains selection independently of PRIMARY"
            );
        }
    }
}

#[test]
fn busy_publications_keep_only_the_latest_live_scope_and_never_defer_explicit_copy() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, true);
    requests.recv().unwrap();
    let _old = worker.select("old selection".into(), frames());
    let _latest = worker.select("latest selection".into(), frames());
    assert_eq!(
        worker.copy("explicit".into(), CopyFormat::PlainText, frames()),
        Ok(CopyStatus::Busy)
    );
    assert!(requests.try_recv().is_err());
    responses.send(response(first, true)).unwrap();
    worker.poll().unwrap();
    assert!(
        requests.try_recv().is_err(),
        "poll must not preempt input with automatic work"
    );
    worker.advance(frames());
    let publication = requests.recv().unwrap();
    let Operation::Copy {
        text, destination, ..
    } = publication.operation
    else {
        panic!("selection publication expected");
    };
    assert_eq!(text, "latest selection");
    assert!(destination == CopyDestination::Primary);
    responses.send(response(publication.id, true)).unwrap();
    worker.poll().unwrap();
    worker.advance(frames());
    assert!(
        requests.try_recv().is_err(),
        "old publication and rejected explicit copy cannot return"
    );
}

#[test]
fn canceled_queued_scope_is_discarded_before_delivery() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, true);
    requests.recv().unwrap();
    drop(worker.select("ended selection".into(), frames()));
    responses.send(response(first, true)).unwrap();
    worker.poll().unwrap();
    worker.advance(frames());
    assert!(requests.try_recv().is_err());
    assert!(!worker.is_busy());
}

#[test]
fn canceled_native_setup_cannot_publish_after_initialization_returns() {
    let (initialized, initialization) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            |_, _, _| panic!("PRIMARY publication cannot write CLIPBOARD"),
            move |_, setup| {
                initialized.send(()).unwrap();
                released.recv().unwrap();
                setup.begin_delivery().map(|()| CopyOutcome::Copied(None))
            },
            |_, _| panic!("PRIMARY publication cannot read"),
        )
        .unwrap();
    let scope = worker.select("selected text".into(), frames());
    initialization.recv_timeout(Duration::from_secs(1)).unwrap();
    drop(scope);
    release.send(()).unwrap();
    assert!(
        matches!(completed(&mut worker), Completion::Copy(Err(error)) if error == "selection ended before clipboard delivery")
    );
    assert!(!worker.is_busy());
}

#[test]
fn delivered_selection_survives_scope_end_and_late_ui_poll() {
    let (mut worker, requests, responses) = controlled_worker();
    let scope = worker.select("selected text".into(), frames());
    let expires = deadline(&worker);
    let request = requests.recv().unwrap();
    let Operation::Copy { setup, .. } = request.operation else {
        panic!("publication");
    };
    setup.begin_delivery().unwrap();
    drop(scope);
    setup.begin_delivery().unwrap();
    responses.send(response(request.id, true)).unwrap();
    assert!(matches!(
        worker.poll_at(expires),
        Some((_, Completion::Copy(Ok(_))))
    ));
}

#[test]
fn expired_native_operation_must_drain_before_queued_primary_can_advance() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, false);
    requests.recv().unwrap();
    let _scope = worker.select("selected text".into(), frames());
    assert!(worker.poll_at(deadline(&worker)).is_some());
    worker.advance(frames());
    assert!(requests.try_recv().is_err());
    responses.send(response(first, false)).unwrap();
    assert!(worker.poll().is_none());
    worker.advance(frames());
    assert!(matches!(
        requests.recv().unwrap().operation,
        Operation::Copy {
            destination: CopyDestination::Primary,
            ..
        }
    ));
}
