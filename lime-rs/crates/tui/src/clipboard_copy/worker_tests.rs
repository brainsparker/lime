use super::*;

fn no_primary(_: &str, _: &CopySetup) -> Result<CopyOutcome, String> {
    panic!("ordinary copy cannot publish PRIMARY")
}

#[test]
fn native_worker_preserves_each_request_format_and_its_original_text() {
    let (sent, received) = mpsc::channel();
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            move |text, format, setup| {
                let result = setup.begin_delivery().and_then(|()| {
                    super::super::copy_to_clipboard_with(
                        text,
                        format,
                        super::super::CopyEnvironment {
                            ssh_session: false,
                            tmux_session: false,
                            wsl_session: false,
                        },
                        |_| panic!("native copy cannot forward to tmux"),
                        |_| panic!("native copy cannot forward to terminal"),
                        |text, html| {
                            sent.send((text.to_owned(), html.map(str::to_owned)))
                                .unwrap();
                            Ok(None)
                        },
                        |_| panic!("native copy cannot fall back to WSL"),
                    )
                });
                (result, None)
            },
            no_primary,
            |_, _| panic!("copy cannot read"),
        )
        .unwrap();
    for (text, format, expected) in [
        (
            "**hello**",
            CopyFormat::Markdown,
            Some("<p><strong>hello</strong></p>\n".into()),
        ),
        ("**hello**", CopyFormat::PlainText, None),
        (
            "hello",
            CopyFormat::MarkdownSelection("**hello**".into()),
            Some("<p><strong>hello</strong></p>\n".into()),
        ),
    ] {
        assert!(matches!(
            worker.copy(text.into(), format, frames()),
            Ok(CopyStatus::Pending(_))
        ));
        assert_eq!(
            received.recv_timeout(Duration::from_secs(1)).unwrap(),
            (text.into(), expected)
        );
        assert!(matches!(
            completed(&mut worker),
            Completion::Copy(Ok(CopyStatus::Confirmed))
        ));
    }
}

#[test]
fn worker_preserves_separate_native_leases_until_their_next_confirmed_write() {
    let clipboard = Arc::new(());
    let clipboard_lifetime = Arc::downgrade(&clipboard);
    let next = Arc::new(());
    let next_lifetime = Arc::downgrade(&next);
    let primary = Arc::new(());
    let primary_lifetime = Arc::downgrade(&primary);
    let mut copies = std::collections::VecDeque::from([
        Ok(CopyOutcome::Copied(Some(
            super::super::ClipboardLease::test_with_owner(clipboard),
        ))),
        Ok(CopyOutcome::Requested),
        Err("copy unavailable".into()),
        Ok(CopyOutcome::Copied(Some(
            super::super::ClipboardLease::test_with_owner(next),
        ))),
    ]);
    let mut primary = Some(super::super::ClipboardLease::test_with_owner(primary));
    let primary_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let calls = Arc::clone(&primary_calls);
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            move |_, _, setup| {
                setup.begin_delivery().unwrap();
                (copies.pop_front().unwrap(), None)
            },
            move |_, setup| {
                setup.begin_delivery().unwrap();
                calls.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                primary
                    .take()
                    .map(|lease| CopyOutcome::Copied(Some(lease)))
                    .ok_or("primary unavailable".into())
            },
            |_, _| panic!("copy cannot read"),
        )
        .unwrap();
    let scope = worker.select("selection".into(), frames());
    assert!(matches!(completed(&mut worker), Completion::Copy(Ok(_))));
    drop(scope);
    assert_eq!(primary_lifetime.strong_count(), 1);
    for index in 0..4 {
        assert!(matches!(
            worker.copy("selection".into(), CopyFormat::PlainText, frames()),
            Ok(CopyStatus::Pending(_))
        ));
        let Completion::Copy(result) = completed(&mut worker) else {
            panic!("copy expected");
        };
        match index {
            1 => assert_eq!(result, Ok(CopyStatus::Unconfirmed)),
            2 => assert_eq!(result, Err("copy unavailable".into())),
            _ => assert_eq!(result, Ok(CopyStatus::Confirmed)),
        }
        assert_eq!(clipboard_lifetime.strong_count(), usize::from(index < 3));
        assert_eq!(
            primary_lifetime.strong_count(),
            1,
            "CLIPBOARD request {index} must preserve PRIMARY"
        );
    }
    assert_eq!(next_lifetime.strong_count(), 1);
    assert_eq!(primary_calls.load(std::sync::atomic::Ordering::Relaxed), 1);
    let responses = worker.responses.take().unwrap();
    drop(worker);
    assert!(matches!(
        responses.recv_timeout(Duration::from_secs(1)),
        Err(mpsc::RecvTimeoutError::Disconnected)
    ));
    assert_eq!(next_lifetime.strong_count(), 0);
    assert_eq!(primary_lifetime.strong_count(), 0);
}

#[test]
fn primary_failure_cannot_change_the_next_clipboard_confirmation() {
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            |_, _, setup| {
                (
                    setup.begin_delivery().map(|()| CopyOutcome::Copied(None)),
                    None,
                )
            },
            |_, setup| {
                setup
                    .begin_delivery()
                    .and(Err("primary unavailable".into()))
            },
            |_, _| panic!("copy cannot read"),
        )
        .unwrap();
    let _scope = worker.select("selection".into(), frames());
    assert!(matches!(completed(&mut worker), Completion::Copy(Err(_))));
    assert!(matches!(
        worker.copy("explicit copy".into(), CopyFormat::PlainText, frames()),
        Ok(CopyStatus::Pending(_))
    ));
    assert!(matches!(
        completed(&mut worker),
        Completion::Copy(Ok(CopyStatus::Confirmed))
    ));
}

pub(super) fn completed(worker: &mut ClipboardWorker) -> Completion {
    let limit = Instant::now() + Duration::from_secs(1);
    loop {
        if let Some((_, result)) = worker.poll_with(Instant::now(), |_| Ok(())) {
            return result;
        }
        assert!(
            Instant::now() < limit,
            "clipboard worker failed to complete"
        );
        std::thread::sleep(Duration::from_millis(1));
    }
}

#[test]
fn native_lease_survives_discarded_ui_completion_until_worker_shutdown() {
    let owner = Arc::new(());
    let lifetime = Arc::downgrade(&owner);
    let mut lease = Some(super::super::ClipboardLease::test_with_owner(owner));
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            move |_, _, setup| {
                setup.begin_delivery().unwrap();
                (Ok(CopyOutcome::Copied(lease.take())), None)
            },
            no_primary,
            |_, _| panic!("copy cannot read"),
        )
        .unwrap();
    start(&mut worker, true);
    drop(completed(&mut worker));
    assert_eq!(
        lifetime.strong_count(),
        1,
        "discarding UI feedback must not relinquish native ownership"
    );
    let responses = worker.responses.take().unwrap();
    drop(worker);
    assert!(matches!(
        responses.recv_timeout(Duration::from_secs(1)),
        Err(mpsc::RecvTimeoutError::Disconnected)
    ));
    assert_eq!(
        lifetime.strong_count(),
        0,
        "worker shutdown must release its native owner"
    );
}

pub(super) fn frames() -> FrameRequester {
    FrameRequester::test_dummy()
}

pub(super) fn deadline(worker: &ClipboardWorker) -> Instant {
    match &worker.pending.as_ref().unwrap().operation {
        PendingOperation::Read { deadline, .. } => *deadline,
        PendingOperation::Copy(setup) => match *setup.phase.lock().unwrap() {
            Setup::Pending(deadline) => deadline,
            _ => panic!("test must observe pending setup before delivery"),
        },
    }
}

pub(super) fn controlled_worker() -> (ClipboardWorker, Receiver<Request>, Sender<Response>) {
    let (requests, request_rx) = mpsc::channel();
    let (response_tx, responses) = mpsc::channel();
    let mut worker = ClipboardWorker::default();
    worker.requests = Some(requests);
    worker.responses = Some(responses);
    (worker, request_rx, response_tx)
}

pub(super) fn start(worker: &mut ClipboardWorker, copy: bool) -> (u64, Option<Arc<()>>) {
    if copy {
        let CopyStatus::Pending(id) = worker
            .copy("copy".into(), CopyFormat::PlainText, frames())
            .unwrap()
        else {
            panic!("copy must start pending");
        };
        (id, None)
    } else {
        let (id, scope) = worker
            .read_text(PasteSource::Clipboard, frames())
            .unwrap()
            .unwrap();
        (id, Some(scope))
    }
}

pub(super) fn response(id: u64, copy: bool) -> Response {
    Response {
        id,
        terminal_text: None,
        completion: if copy {
            Completion::Copy(Ok(crate::clipboard_copy::CopyStatus::Unconfirmed))
        } else {
            Completion::Read(Ok("native text".into()))
        },
    }
}

#[test]
fn empty_copy_is_rejected_before_starting_worker() {
    let mut worker = ClipboardWorker::default();
    assert!(worker
        .copy(String::new(), CopyFormat::PlainText, frames())
        .unwrap_err()
        .contains("nothing to copy"));
    assert!(worker.requests.is_none());
    assert!(!worker.is_busy());
}

#[test]
fn reads_and_copies_share_one_busy_lifetime_and_request_sequence() {
    for copy in [false, true] {
        let (mut worker, requests, responses) = controlled_worker();
        let (first, _scope) = start(&mut worker, copy);
        assert_eq!(requests.try_recv().unwrap().id, first);
        assert!(worker.is_busy());
        assert_eq!(
            worker.copy("second".into(), CopyFormat::PlainText, frames()),
            Ok(CopyStatus::Busy)
        );
        assert_eq!(worker.pending.as_ref().unwrap().id, first);
        assert_eq!(
            worker.next_id, first,
            "busy copy cannot allocate another ticket"
        );
        let primary = worker.read_text(PasteSource::Primary, frames()).unwrap();
        assert_eq!(primary.is_some(), copy);
        drop(primary);
        assert!(requests.try_recv().is_err());
        responses.send(response(first, copy)).unwrap();
        let (id, result) = worker.poll().unwrap();
        assert_eq!(id, first);
        assert_eq!(matches!(result, Completion::Copy(_)), copy);
        assert!(!worker.is_busy());
        let (next, _scope) = start(&mut worker, !copy);
        assert_ne!(next, first);
        assert_eq!(requests.try_recv().unwrap().id, next);
    }
}

#[test]
fn canceled_read_stays_busy_until_its_native_result_is_drained() {
    let (mut worker, requests, responses) = controlled_worker();
    let (id, _scope) = start(&mut worker, false);
    assert_eq!(requests.try_recv().unwrap().id, id);
    assert!(worker.pending.is_some());
    drop(_scope);
    assert!(worker.poll().is_none());
    assert!(worker.pending.as_ref().unwrap().expired);
    assert!(worker.is_busy());
    assert_eq!(
        worker.copy("must wait".into(), CopyFormat::PlainText, frames()),
        Ok(CopyStatus::Busy)
    );
    responses.send(response(id, false)).unwrap();
    assert!(worker.poll().is_none());
    assert!(!worker.is_busy());
    assert!(matches!(
        worker.copy("after drain".into(), CopyFormat::PlainText, frames()),
        Ok(CopyStatus::Pending(_))
    ));
}

#[test]
fn canceling_a_draft_cannot_cancel_a_copy() {
    let (mut worker, requests, responses) = controlled_worker();
    let (id, _scope) = start(&mut worker, true);
    let (_, scope) = worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .unwrap();
    drop(scope);
    assert!(worker.poll().is_none());
    assert_eq!(worker.pending.as_ref().unwrap().id, id);
    assert_eq!(requests.try_recv().unwrap().id, id);
    responses.send(response(id, true)).unwrap();
    assert!(matches!(worker.poll(), Some((_, Completion::Copy(_)))));
}

#[test]
fn expired_read_and_copy_report_once_and_drain_without_reaching_a_new_owner() {
    for copy in [false, true] {
        let (mut worker, requests, responses) = controlled_worker();
        let (id, _scope) = start(&mut worker, copy);
        let deadline = deadline(&worker);
        let (completed_id, completion) = worker.poll_at(deadline).unwrap();
        assert_eq!(completed_id, id);
        match completion {
            Completion::Read(result) => assert_eq!(result.unwrap_err(), "clipboard read timed out"),
            Completion::Copy(result) => assert_eq!(
                result.err().unwrap(),
                "clipboard setup timed out; copy abandoned"
            ),
        }
        assert!(worker.is_busy());
        assert!(worker.poll_at(deadline).is_none());
        assert!(worker
            .read_text(PasteSource::Clipboard, frames())
            .unwrap()
            .is_none());
        responses.send(response(id, copy)).unwrap();
        assert!(worker.poll().is_none());
        assert!(!worker.is_busy());
        let (next, _scope) = start(&mut worker, false);
        assert_eq!(requests.try_recv().unwrap().id, id);
        assert_eq!(requests.try_recv().unwrap().id, next);
        responses.send(response(next, false)).unwrap();
        assert!(
            matches!(worker.poll(), Some((completed_id, Completion::Read(Ok(text)))) if completed_id == next && text == "native text")
        );
    }
}

#[test]
fn disconnected_worker_releases_busy_state_and_reports_the_matching_operation() {
    for copy in [false, true] {
        let (mut worker, requests, responses) = controlled_worker();
        let (id, _scope) = start(&mut worker, copy);
        assert_eq!(requests.try_recv().unwrap().id, id);
        drop(responses);
        let (completed_id, completion) = worker.poll().unwrap();
        assert_eq!(completed_id, id);
        assert_eq!(matches!(completion, Completion::Copy(_)), copy);
        assert!(!worker.is_busy());
        assert!(worker.requests.is_none());
        assert!(worker.pending.is_none());
        assert!(worker.poll().is_none());
    }
}

#[test]
fn native_operations_run_off_thread_through_the_shared_worker() {
    fn copy(
        _: &str,
        _: CopyFormat,
        setup: &CopySetup,
    ) -> (Result<CopyOutcome, String>, Option<String>) {
        (
            setup.begin_delivery().map(|()| CopyOutcome::Requested),
            None,
        )
    }
    fn read(_: PasteSource, _: Instant) -> ReadResult {
        Ok("native text".into())
    }
    let mut worker = ClipboardWorker::default();
    worker.start(copy, no_primary, read).unwrap();
    for copy in [false, true] {
        let (id, _scope) = start(&mut worker, copy);
        let deadline = Instant::now() + Duration::from_secs(1);
        loop {
            if let Some((completed_id, completion)) = worker.poll() {
                assert_eq!(completed_id, id);
                match completion {
                    Completion::Read(result) => assert_eq!(result.unwrap(), "native text"),
                    Completion::Copy(result) => {
                        assert!(matches!(result, Ok(CopyStatus::Unconfirmed)))
                    }
                }
                break;
            }
            assert!(
                Instant::now() < deadline,
                "native clipboard worker did not respond"
            );
            std::thread::yield_now();
        }
    }
}

#[test]
fn delivered_copy_survives_ui_poll_after_the_setup_deadline() {
    fn copy(
        _: &str,
        _: CopyFormat,
        setup: &CopySetup,
    ) -> (Result<CopyOutcome, String>, Option<String>) {
        (
            setup.begin_delivery().map(|()| CopyOutcome::Requested),
            None,
        )
    }
    fn read(_: PasteSource, _: Instant) -> ReadResult {
        panic!("copy must not invoke a text read")
    }
    let (initialized, initialization) = mpsc::channel();
    let (deliver, delivery) = mpsc::channel();
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            move |text, format, setup| {
                initialized.send(()).unwrap();
                delivery.recv().unwrap();
                copy(text, format, setup)
            },
            no_primary,
            read,
        )
        .unwrap();
    let (id, _scope) = start(&mut worker, true);
    initialization.recv_timeout(Duration::from_secs(1)).unwrap();
    let deadline = deadline(&worker);
    deliver.send(()).unwrap();
    // Receive the real worker's completed delivery, then hold it until a later UI draw.
    let delivered = worker
        .responses
        .as_ref()
        .unwrap()
        .recv_timeout(Duration::from_secs(1))
        .unwrap();
    let (responses, receiver) = mpsc::channel();
    worker.responses = Some(receiver);
    responses.send(delivered).unwrap();
    let (completed_id, completion) = worker.poll_at(deadline).unwrap();
    assert_eq!(completed_id, id);
    assert!(
        matches!(
            completion,
            Completion::Copy(Ok(crate::clipboard_copy::CopyStatus::Unconfirmed))
        ),
        "a completed delivery must not become a setup timeout on a late draw"
    );
    assert!(!worker.is_busy());
}

#[test]
fn abandoned_initialization_cannot_write_or_forward_after_it_returns() {
    for native_available in [false, true] {
        let writes = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let native_writes = Arc::clone(&writes);
        let (initialized, initialization) = mpsc::channel();
        let (resume, resumed) = mpsc::channel();
        let mut worker = ClipboardWorker::default();
        worker
            .start(
                move |text, format, setup| {
                    initialized.send(()).unwrap();
                    resumed.recv().unwrap();
                    let native_setup: Result<Option<super::super::ClipboardLease>, String> =
                        if native_available {
                            Ok(None)
                        } else {
                            Err("broker unavailable".into())
                        };
                    let result = setup.begin_delivery().and_then(|()| {
                        super::super::copy_to_clipboard_with(
                            text,
                            format,
                            super::super::CopyEnvironment {
                                ssh_session: true,
                                tmux_session: true,
                                wsl_session: true,
                            },
                            |_| panic!("abandoned setup must not write tmux"),
                            |_| panic!("abandoned setup must not request terminal output"),
                            |_, _| {
                                native_writes.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                                native_setup
                            },
                            |_| panic!("abandoned setup must not write the WSL clipboard"),
                        )
                    });
                    (result, None)
                },
                no_primary,
                |_, _| panic!("copy cannot read clipboard text"),
            )
            .unwrap();
        let (id, _scope) = start(&mut worker, true);
        initialization.recv_timeout(Duration::from_secs(1)).unwrap();
        let (_, completion) = worker.poll_at(deadline(&worker)).unwrap();
        assert!(matches!(completion, Completion::Copy(Err(_))));
        assert!(worker.is_busy());
        resume.send(()).unwrap();
        let late = worker
            .responses
            .as_ref()
            .unwrap()
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        assert_eq!(late.id, id);
        assert_eq!(writes.load(std::sync::atomic::Ordering::SeqCst), 0);
        assert!(
            matches!(&late.completion, Completion::Copy(Err(error)) if error == SETUP_TIMEOUT_MESSAGE)
        );
        let (responses, receiver) = mpsc::channel();
        worker.responses = Some(receiver);
        responses.send(late).unwrap();
        assert!(worker
            .poll_with(Instant::now(), |_| panic!(
                "abandoned response cannot write the terminal"
            ))
            .is_none());
        assert!(!worker.is_busy());
    }
}

#[test]
fn expired_setup_is_abandoned_without_requiring_a_ui_poll() {
    let setup = CopySetup {
        phase: Mutex::new(Setup::Pending(Instant::now() - Duration::from_secs(1))),
        frames: frames(),
        owner: None,
    };
    assert_eq!(setup.begin_delivery(), Err(SETUP_TIMEOUT_MESSAGE.into()));
    assert!(matches!(*setup.phase.lock().unwrap(), Setup::Abandoned));
    assert_eq!(setup.begin_delivery(), Err(SETUP_TIMEOUT_MESSAGE.into()));
}

#[test]
fn terminal_output_runs_once_on_the_polling_ui_thread() {
    let ui_thread = std::thread::current().id();
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            move |_, _, setup| {
                assert_ne!(std::thread::current().id(), ui_thread);
                (
                    setup.begin_delivery().map(|()| CopyOutcome::Requested),
                    Some("界🙂 copied".into()),
                )
            },
            no_primary,
            |_, _| panic!("copy cannot read clipboard text"),
        )
        .unwrap();
    let (id, _scope) = start(&mut worker, true);
    // The worker finishes during the handoff; terminal output waits for the UI to return.
    let delivered = worker
        .responses
        .as_ref()
        .unwrap()
        .recv_timeout(Duration::from_secs(1))
        .unwrap();
    let (responses, receiver) = mpsc::channel();
    worker.responses = Some(receiver);
    responses.send(delivered).unwrap();
    let calls = Cell::new(0);
    let (_, completion) = worker
        .poll_with(Instant::now(), |text| {
            assert_eq!(std::thread::current().id(), ui_thread);
            assert_eq!(text, "界🙂 copied");
            calls.set(calls.get() + 1);
            Ok(())
        })
        .unwrap();
    assert!(matches!(
        completion,
        Completion::Copy(Ok(crate::clipboard_copy::CopyStatus::Unconfirmed))
    ));
    assert_eq!(calls.get(), 1);
    let mut duplicate = response(id, true);
    duplicate.terminal_text = Some("must not send twice".into());
    responses.send(duplicate).unwrap();
    assert!(worker
        .poll_with(Instant::now(), |_| panic!("duplicate cannot emit OSC 52"))
        .is_none());
}

#[test]
fn terminal_send_failure_preserves_native_confirmation_only() {
    for native in [false, true] {
        let (mut worker, requests, responses) = controlled_worker();
        let (id, _scope) = start(&mut worker, true);
        let Operation::Copy { setup, .. } = requests.recv().unwrap().operation else {
            panic!("copy requested")
        };
        setup.begin_delivery().unwrap();
        let mut delivered = response(id, true);
        if native {
            delivered.completion =
                Completion::Copy(Ok(crate::clipboard_copy::CopyStatus::Confirmed));
        }
        delivered.terminal_text = Some("copy".into());
        responses.send(delivered).unwrap();
        let (_, Completion::Copy(result)) = worker
            .poll_with(Instant::now(), |_| Err("terminal write failed".into()))
            .unwrap()
        else {
            panic!("copy completion")
        };
        if native {
            assert!(matches!(result, Ok(CopyStatus::Confirmed)));
        } else {
            assert!(matches!(result, Err(error) if error == "terminal write failed"));
        }
    }
}

#[test]
fn late_terminal_payload_is_drained_without_sending() {
    let (mut worker, requests, responses) = controlled_worker();
    let (id, _scope) = start(&mut worker, true);
    requests.recv().unwrap();
    assert!(worker.poll_at(deadline(&worker)).is_some());
    let mut late = response(id, true);
    late.terminal_text = Some("expired request".into());
    responses.send(late).unwrap();
    assert!(worker
        .poll_with(Instant::now(), |_| panic!(
            "late payload cannot emit OSC 52"
        ))
        .is_none());
    assert!(!worker.is_busy());
}

#[test]
fn delivering_copy_stays_busy_without_a_setup_timeout() {
    let (mut worker, requests, responses) = controlled_worker();
    let (id, _scope) = start(&mut worker, true);
    let setup_deadline = deadline(&worker);
    let Operation::Copy { setup, .. } = requests.recv().unwrap().operation else {
        panic!("copy requested")
    };
    setup.begin_delivery().unwrap();
    assert!(worker
        .poll_at(setup_deadline + Duration::from_secs(1))
        .is_none());
    assert!(worker.is_busy());
    assert!(worker
        .read_text(PasteSource::Clipboard, frames())
        .unwrap()
        .is_none());
    responses.send(response(id, true)).unwrap();
    assert!(matches!(
        worker.poll_at(setup_deadline + Duration::from_secs(1)),
        Some((_, Completion::Copy(Ok(_))))
    ));
    assert!(!worker.is_busy());
}
