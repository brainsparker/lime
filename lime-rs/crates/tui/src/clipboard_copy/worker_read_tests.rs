use super::tests::{controlled_worker, frames, response, start};
use super::*;

#[test]
fn native_reader_receives_the_deadline_created_before_queueing() {
    let (copy_started, started) = mpsc::channel();
    let (release_copy, released) = mpsc::channel();
    let (read_started, read) = mpsc::channel();
    let mut worker = ClipboardWorker::default();
    worker
        .start(
            move |_, _, setup| {
                setup.begin_delivery().unwrap();
                copy_started.send(()).unwrap();
                released.recv_timeout(Duration::from_secs(1)).unwrap();
                (Ok(CopyOutcome::Copied(None)), None)
            },
            |_, _| panic!("this scenario cannot publish PRIMARY"),
            move |source, deadline| {
                read_started.send((source, deadline)).unwrap();
                Ok("queued text".into())
            },
        )
        .unwrap();
    assert!(matches!(
        worker.copy("copy".into(), CopyFormat::PlainText, frames()),
        Ok(CopyStatus::Pending(_))
    ));
    started.recv_timeout(Duration::from_secs(1)).unwrap();
    let (_, _scope) = worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .unwrap();
    let Operation::Read { deadline, .. } = worker.queued_read.as_ref().unwrap().operation else {
        panic!("queued read must retain its deadline");
    };
    release_copy.send(()).unwrap();
    assert!(matches!(
        super::tests::completed(&mut worker),
        Completion::Copy(Ok(_))
    ));
    worker.advance(frames());
    assert_eq!(
        read.recv_timeout(Duration::from_secs(1)).unwrap(),
        (PasteSource::Primary, deadline)
    );
    assert!(
        matches!(super::tests::completed(&mut worker), Completion::Read(Ok(text)) if text == "queued text")
    );
}

#[tokio::test(flavor = "current_thread", start_paused = true)]
async fn queued_timeout_rearms_a_draw_to_drain_an_already_arrived_native_response() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, true);
    let Operation::Copy { setup, .. } = requests.recv().unwrap().operation else {
        panic!("copy");
    };
    setup.begin_delivery().unwrap();
    let (draw_tx, mut draw_rx) = tokio::sync::broadcast::channel(4);
    let requester = FrameRequester::new(draw_tx);
    let (_, _read_scope) = worker
        .read_text(PasteSource::Primary, requester.clone())
        .unwrap()
        .unwrap();
    let Operation::Read { deadline, .. } = worker.queued_read.as_ref().unwrap().operation else {
        panic!("read");
    };
    responses.send(response(first, true)).unwrap();
    assert!(matches!(
        worker.poll_at(deadline),
        Some((_, Completion::Read(Err(_))))
    ));
    tokio::time::timeout(Duration::from_millis(50), draw_rx.recv())
        .await
        .expect("timeout feedback must request another draw to drain native completion")
        .expect("draw scheduler stays connected");
    assert!(matches!(worker.poll_at(deadline), Some((id, Completion::Copy(Ok(_)))) if id == first));
    assert!(!worker.is_busy());
}

#[test]
fn queued_primary_read_runs_after_the_latest_publication_with_its_original_deadline() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, true);
    requests.recv().unwrap();
    let _selection = worker.select("latest selection".into(), frames());
    let (read_id, _read_scope) = worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .unwrap();
    let Operation::Read {
        deadline: original_deadline,
        ..
    } = &worker.queued_read.as_ref().unwrap().operation
    else {
        panic!("queued read");
    };
    let original_deadline = *original_deadline;
    assert!(worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .is_none());
    assert!(worker
        .read_text(PasteSource::Clipboard, frames())
        .unwrap()
        .is_none());
    responses.send(response(first, true)).unwrap();
    worker.poll().unwrap();
    worker.advance(frames());
    let publication = requests.recv().unwrap();
    assert!(
        matches!(publication.operation, Operation::Copy { ref text, destination: CopyDestination::Primary, .. } if text == "latest selection")
    );
    assert!(requests.try_recv().is_err());
    responses.send(response(publication.id, true)).unwrap();
    worker.poll().unwrap();
    worker.advance(frames());
    let read = requests.recv().unwrap();
    assert_eq!(read.id, read_id);
    assert!(
        matches!(read.operation, Operation::Read { source: PasteSource::Primary, deadline, .. } if deadline == original_deadline)
    );
    responses.send(response(read_id, false)).unwrap();
    assert!(
        matches!(worker.poll(), Some((id, Completion::Read(Ok(text)))) if id == read_id && text == "native text")
    );
}

#[test]
fn canceled_queued_read_does_not_cancel_publication_or_start_a_native_read() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, true);
    requests.recv().unwrap();
    let _selection = worker.select("selected text".into(), frames());
    let (_, scope) = worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .unwrap();
    drop(scope);
    responses.send(response(first, true)).unwrap();
    worker.poll().unwrap();
    worker.advance(frames());
    let publication = requests.recv().unwrap();
    assert!(matches!(
        publication.operation,
        Operation::Copy {
            destination: CopyDestination::Primary,
            ..
        }
    ));
    responses.send(response(publication.id, true)).unwrap();
    worker.poll().unwrap();
    worker.advance(frames());
    assert!(requests.try_recv().is_err());
    assert!(!worker.is_busy());
}

#[test]
fn queued_read_budget_includes_waiting_and_reports_only_once() {
    let (mut worker, requests, responses) = controlled_worker();
    let (first, _scope) = start(&mut worker, true);
    requests.recv().unwrap();
    let (read_id, _read_scope) = worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .unwrap();
    let Operation::Read { deadline, .. } = worker.queued_read.as_ref().unwrap().operation else {
        panic!("read");
    };
    assert!(
        matches!(worker.poll_at(deadline), Some((id, Completion::Read(Err(error)))) if id == read_id && error == "clipboard read timed out")
    );
    assert!(worker.queued_read.is_none());
    assert!(
        worker.is_busy(),
        "timeout does not interrupt the native copy"
    );
    responses.send(response(first, true)).unwrap();
    worker.poll();
    worker.poll();
    worker.advance(frames());
    assert!(
        requests.try_recv().is_err(),
        "expired read must never reach the native worker"
    );
}

#[test]
fn canceled_native_read_remains_busy_and_rejects_another_read_until_drained() {
    let (mut worker, requests, responses) = controlled_worker();
    let (id, scope) = worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .unwrap();
    requests.recv().unwrap();
    drop(scope);
    assert!(worker.poll().is_none());
    assert!(worker.is_busy());
    assert!(worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .is_none());
    responses.send(response(id, false)).unwrap();
    assert!(worker.poll().is_none());
    assert!(!worker.is_busy());
    assert!(worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .is_some());
}

#[test]
fn queued_read_receives_worker_disconnect_error_once_without_restarting_native_work() {
    let (mut worker, requests, responses) = controlled_worker();
    start(&mut worker, true);
    requests.recv().unwrap();
    let (id, _scope) = worker
        .read_text(PasteSource::Primary, frames())
        .unwrap()
        .unwrap();
    drop(responses);
    assert!(matches!(worker.poll(), Some((_, Completion::Copy(Err(_))))));
    worker.advance(frames());
    assert!(
        matches!(worker.poll(), Some((read_id, Completion::Read(Err(error)))) if read_id == id && error == "clipboard worker stopped")
    );
    assert!(worker.poll().is_none());
    assert!(worker.requests.is_none());
    assert!(requests.try_recv().is_err());
}
