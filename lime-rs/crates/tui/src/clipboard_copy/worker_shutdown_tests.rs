use super::tests::{controlled_worker, frames, response};
use super::*;

#[test]
fn shutdown_waits_for_bounded_handoff_while_a_native_read_is_blocked() {
    let (started, start_rx) = mpsc::channel();
    let (release, release_rx) = mpsc::channel();
    let (finished, finish_rx) = mpsc::channel();
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            |_, _, _| panic!("read cannot copy"),
            |_, _| panic!("read cannot publish"),
            move |_, _| {
                started.send(()).unwrap();
                release_rx.recv().unwrap();
                finished.send(()).unwrap();
                Ok("native text".into())
            },
        )
        .unwrap();
    let (_, _scope) = worker
        .read_text(PasteSource::Clipboard, frames())
        .unwrap()
        .unwrap();
    start_rx.recv_timeout(Duration::from_secs(1)).unwrap();
    let at = Instant::now();
    drop(worker);
    let elapsed = at.elapsed();
    release.send(()).unwrap();
    finish_rx.recv_timeout(Duration::from_secs(1)).unwrap();
    assert!(
        elapsed >= Duration::from_millis(200),
        "shutdown returned without the handoff budget: {elapsed:?}"
    );
    assert!(
        elapsed < Duration::from_secs(1),
        "shutdown exceeded its bounded handoff: {elapsed:?}"
    );
}

#[test]
fn unpolled_native_copy_releases_its_lease_before_worker_drop_returns() {
    let owner = Arc::new(());
    let lifetime = Arc::downgrade(&owner);
    let mut lease = Some(ClipboardLease::test_with_owner(owner));
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            move |_, _, setup| {
                (
                    setup
                        .begin_delivery()
                        .map(|()| CopyOutcome::Copied(lease.take())),
                    None,
                )
            },
            |_, _| panic!("explicit copy cannot publish PRIMARY"),
            |_, _| panic!("copy cannot read"),
        )
        .unwrap();
    assert!(matches!(
        worker.copy("unpolled copy".into(), CopyFormat::PlainText, frames()),
        Ok(CopyStatus::Pending(_))
    ));
    drop(worker);
    assert_eq!(
        lifetime.strong_count(),
        0,
        "Drop must wait for worker-owned native cleanup"
    );
}

#[test]
fn queued_copy_response_does_not_end_handoff_before_channel_disconnect() {
    let (worker, _requests, responses) = controlled_worker();
    responses.send(response(1, true)).unwrap();
    let at = Instant::now();
    drop(worker);
    let elapsed = at.elapsed();
    drop(responses);
    assert!(
        elapsed >= Duration::from_millis(200),
        "queued feedback ended handoff before cleanup: {elapsed:?}"
    );
    assert!(
        elapsed < Duration::from_secs(1),
        "handoff wait is bounded: {elapsed:?}"
    );
}
