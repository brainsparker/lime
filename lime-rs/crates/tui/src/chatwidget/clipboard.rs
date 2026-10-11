//! Widget-local image paste suppression, reset by ordinary keyboard activity.

use super::ChatWidget;
use std::time::{Duration, Instant};

const IMAGE_PASTE_REPEAT_WINDOW: Duration = Duration::from_millis(250);

impl ChatWidget {
    pub(crate) fn suppress_repeated_image_paste(&mut self, now: Instant) -> bool {
        let suppressed = self
            .suppress_image_paste_until
            .is_some_and(|until| now < until);
        self.note_image_paste_finished(now);
        suppressed
    }

    /// Both successful and failed native attempts start a fresh repeat window.
    pub(crate) fn note_image_paste_finished(&mut self, now: Instant) {
        self.suppress_image_paste_until = Some(now + IMAGE_PASTE_REPEAT_WINDOW);
    }

    pub(crate) fn reset_image_paste_suppression(&mut self) {
        self.suppress_image_paste_until = None;
    }
}
