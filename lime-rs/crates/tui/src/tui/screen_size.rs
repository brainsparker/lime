//! Event geometry is resolved once and reused by the next frame.

use std::io;
use std::time::{Duration, Instant};

use ratatui::backend::Backend;
use ratatui::layout::Size;
use ratatui::{Terminal as RatatuiTerminal, TerminalOptions, Viewport};

use super::{Tui, TuiEvent};
use crate::transcript_reflow::TRANSCRIPT_REFLOW_DEBOUNCE;

pub(super) struct ScreenSizePolicy {
    last_known_size: Size,
    pending_recheck_at: Option<Instant>,
    pending_draw_size: Option<Size>,
}

impl ScreenSizePolicy {
    pub(super) fn new(size: Size) -> Self {
        Self {
            last_known_size: size,
            pending_recheck_at: None,
            pending_draw_size: None,
        }
    }

    fn screen_size_for_event(
        &mut self,
        event: &TuiEvent,
        now: Instant,
        query: impl FnOnce() -> io::Result<Size>,
    ) -> io::Result<Size> {
        let size = match event {
            TuiEvent::Resize(size) => {
                self.pending_recheck_at = Some(now + TRANSCRIPT_REFLOW_DEBOUNCE);
                *size
            }
            TuiEvent::Resume => {
                let size = query()?;
                self.pending_recheck_at = None;
                size
            }
            TuiEvent::Draw | TuiEvent::FocusGained
                if self
                    .pending_recheck_at
                    .is_some_and(|deadline| now >= deadline) =>
            {
                let size = query()?;
                self.pending_recheck_at = None;
                size
            }
            _ => self.last_known_size,
        };
        if !matches!(
            event,
            TuiEvent::Key(_) | TuiEvent::Mouse(_) | TuiEvent::Paste(_) | TuiEvent::FocusLost
        ) {
            self.last_known_size = size;
            self.pending_draw_size = Some(size);
        }
        Ok(size)
    }

    fn take_event_screen_size(
        &mut self,
        query: impl FnOnce() -> io::Result<Size>,
    ) -> io::Result<Size> {
        if let Some(size) = self.pending_draw_size.take() {
            return Ok(size);
        }
        let size = query()?;
        self.last_known_size = size;
        self.pending_recheck_at = None;
        Ok(size)
    }
}

pub(super) fn terminal_with_size<B: Backend>(
    backend: B,
    size: Size,
) -> Result<RatatuiTerminal<B>, B::Error> {
    RatatuiTerminal::with_options(
        backend,
        TerminalOptions {
            viewport: Viewport::Fixed(size.into()),
        },
    )
}

impl Tui {
    pub(crate) fn screen_size_for_event(&mut self, event: &TuiEvent) -> io::Result<Size> {
        let now = Instant::now();
        let recheck_due = matches!(event, TuiEvent::Draw | TuiEvent::FocusGained)
            && self
                .screen_size
                .pending_recheck_at
                .is_some_and(|deadline| now >= deadline);
        let size = self
            .screen_size
            .screen_size_for_event(event, now, || self.terminal.size())?;
        if let Some(deadline) = self.screen_size.pending_recheck_at {
            self.frame_requester
                .schedule_frame_in(deadline.saturating_duration_since(now));
        }
        if matches!(event, TuiEvent::Resize(_) | TuiEvent::Resume) || recheck_due {
            self.event_broker.observe_size(size);
        }
        self.update_viewport(size, size.height);
        Ok(size)
    }

    pub(crate) fn screen_size(&self) -> Size {
        self.screen_size.last_known_size
    }

    pub(super) fn take_event_screen_size(&mut self) -> io::Result<Size> {
        let query_needed = self.screen_size.pending_draw_size.is_none();
        let size = self
            .screen_size
            .take_event_screen_size(|| self.terminal.size())?;
        if query_needed {
            self.event_broker.observe_size(size);
        }
        self.update_viewport(size, size.height);
        if self.terminal.get_frame().area().as_size() != size {
            self.terminal.resize(size.into())?;
        }
        Ok(size)
    }

    pub(super) fn reset_screen_size(&mut self, size: Size) {
        self.screen_size = ScreenSizePolicy::new(size);
        self.screen_size.pending_draw_size = Some(size);
        self.event_broker.observe_size(size);
    }

    pub(super) fn schedule_screen_size_recheck(&mut self, delay: Duration) {
        self.screen_size.pending_recheck_at = Some(Instant::now() + delay);
        self.frame_requester.schedule_frame_in(delay);
    }
}

#[cfg(test)]
#[path = "screen_size_tests.rs"]
mod tests;
