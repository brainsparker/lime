//! Paste timing advances while the input source waits, rather than while queued keys drain.
//!
//! Crossterm exposes readiness, not per-key arrival timestamps. Treat a continuous ready
//! sequence as one batch: host scheduling and rendering must not split already queued input.
//! Other presentation and request timers keep the wall clock.

use std::time::{Duration, Instant};

pub(super) struct InputClock {
    time: Instant,
    idle_since: Option<Instant>,
}

impl InputClock {
    pub(super) fn new(now: Instant) -> Self {
        Self {
            time: now,
            idle_since: Some(now),
        }
    }

    pub(super) fn ready(&mut self, now: Instant) {
        if let Some(idle_since) = self.idle_since.take() {
            self.time += now.saturating_duration_since(idle_since);
        }
    }

    pub(super) fn pending(&mut self, now: Instant) {
        self.idle_since.get_or_insert(now);
    }

    pub(super) fn now(&self, now: Instant) -> Instant {
        self.time
            + self.idle_since.map_or(Duration::ZERO, |idle_since| {
                now.saturating_duration_since(idle_since)
            })
    }
}

#[cfg(test)]
#[path = "input_clock_tests.rs"]
mod tests;
