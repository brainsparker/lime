use super::*;
use std::time::Duration;

#[test]
fn ready_batch_does_not_age_during_slow_consumption_or_draws() {
    let start = Instant::now();
    let mut clock = InputClock::new(start);
    clock.ready(start);
    clock.ready(start + Duration::from_secs(2));
    assert_eq!(clock.now(start + Duration::from_secs(5)), start);
    clock.pending(start + Duration::from_secs(5));
    assert_eq!(clock.now(start + Duration::from_secs(5)), start);
    assert_eq!(
        clock.now(start + Duration::from_secs(6)),
        start + Duration::from_secs(1)
    );
}

#[test]
fn repeated_pending_polls_preserve_the_actual_idle_window() {
    let start = Instant::now();
    let mut clock = InputClock::new(start);
    clock.ready(start);
    clock.pending(start + Duration::from_secs(1));
    clock.pending(start + Duration::from_secs(2));
    assert_eq!(
        clock.now(start + Duration::from_secs(3)),
        start + Duration::from_secs(2)
    );
    clock.ready(start + Duration::from_secs(3));
    assert_eq!(
        clock.now(start + Duration::from_secs(4)),
        start + Duration::from_secs(2)
    );
}
