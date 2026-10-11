use super::*;
use std::sync::mpsc;

// Each OS query is held at a barrier so invalidation races are deterministic.
fn monitor() -> (
    SizeMonitor,
    broadcast::Receiver<()>,
    mpsc::Receiver<()>,
    mpsc::Sender<io::Result<Size>>,
) {
    let (draw_tx, draw_rx) = broadcast::channel(8);
    let (started_tx, started_rx) = mpsc::channel();
    let (result_tx, result_rx) = mpsc::channel();
    let monitor = SizeMonitor::spawn(Size::new(80, 24), draw_tx, move || {
        started_tx.send(()).unwrap();
        result_rx.recv().unwrap()
    })
    .unwrap();
    (monitor, draw_rx, started_rx, result_tx)
}

fn begin_query(monitor: &SizeMonitor, started: &mpsc::Receiver<()>) {
    monitor.worker.thread().unpark();
    started
        .recv_timeout(Duration::from_secs(2))
        .expect("worker did not query");
}

fn stop_worker(mut monitor: SizeMonitor) -> thread::JoinHandle<()> {
    let worker = std::mem::replace(&mut monitor.worker, thread::spawn(|| {}));
    drop(monitor);
    worker
}

#[tokio::test]
async fn changed_sample_emits_one_resize_and_observe_discards_queued_sample() {
    let (monitor, mut draw_rx, started, result) = monitor();
    begin_query(&monitor, &started);
    let size = Size::new(100, 30);
    result.send(Ok(size)).unwrap();
    tokio::time::timeout(Duration::from_secs(2), draw_rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(monitor.take_resize(), Some(size));
    assert_eq!(monitor.take_resize(), None);
    begin_query(&monitor, &started);
    result.send(Ok(Size::new(110, 35))).unwrap();
    tokio::time::timeout(Duration::from_secs(2), draw_rx.recv())
        .await
        .unwrap()
        .unwrap();
    monitor.observe(Size::new(120, 40));
    assert_eq!(monitor.take_resize(), None);
    stop_worker(monitor).join().unwrap();
}

#[test]
fn pause_and_observe_do_not_wait_for_blocked_query_and_invalidate_it() {
    for pause in [false, true] {
        let (monitor, mut draw_rx, started, result) = monitor();
        begin_query(&monitor, &started);
        if pause {
            monitor.set_active(false);
        } else {
            monitor.observe(Size::new(120, 40));
        }
        result.send(Ok(Size::new(100, 30))).unwrap();
        // The next query proves the previous result passed its generation check.
        if pause {
            monitor.set_active(true);
        }
        begin_query(&monitor, &started);
        assert!(draw_rx.try_recv().is_err());
        assert_eq!(monitor.take_resize(), None);
        let worker = stop_worker(monitor);
        result.send(Ok(Size::new(100, 30))).unwrap();
        worker.join().unwrap();
        assert!(draw_rx.try_recv().is_err());
    }
}

#[test]
fn failed_zero_and_unchanged_samples_never_emit_resize() {
    let (monitor, mut draw_rx, started, result) = monitor();
    for sample in [
        Err(io::Error::other("query failed")),
        Ok(Size::new(0, 24)),
        Ok(Size::new(80, 0)),
        Ok(Size::new(80, 24)),
    ] {
        begin_query(&monitor, &started);
        result.send(sample).unwrap();
    }
    begin_query(&monitor, &started);
    assert_eq!(monitor.take_resize(), None);
    assert!(draw_rx.try_recv().is_err());
    let worker = stop_worker(monitor);
    result.send(Ok(Size::new(100, 30))).unwrap();
    worker.join().unwrap();
    assert!(draw_rx.try_recv().is_err());
}

#[test]
fn dropping_monitor_does_not_join_or_publish_blocked_query() {
    let (monitor, mut draw_rx, started, result) = monitor();
    begin_query(&monitor, &started);
    let worker = stop_worker(monitor);
    result.send(Ok(Size::new(100, 30))).unwrap();
    worker.join().unwrap();
    assert!(draw_rx.try_recv().is_err());
}
