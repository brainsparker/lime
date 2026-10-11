//! Event stream plumbing for the TUI.
//!
//! - [`EventBroker`] holds the shared crossterm stream so multiple callers reuse the same
//!   input source and can drop/recreate it on pause/resume without rebuilding consumers.
//! - [`TuiEventStream`] wraps a draw event subscription plus the shared [`EventBroker`] and maps crossterm
//!   events into [`TuiEvent`].
//! - [`EventSource`] abstracts the underlying event producer; the real implementation is
//!   [`CrosstermEventSource`] and tests can swap in [`FakeEventSource`].
//!
//! The motivation for dropping/recreating the crossterm event stream is to enable the TUI to fully relinquish stdin.
//! If the stream is not dropped, it will continue to read from stdin even if it is not actively being polled
//! (due to how crossterm's EventStream is implemented), potentially stealing input from other processes reading stdin,
//! like terminal text editors. This race can cause missed input or capturing terminal query responses (for example, OSC palette/size queries)
//! that the other process expects to read. Stopping polling, instead of dropping the stream, is only sufficient when the
//! pause happens before the stream enters a pending state; otherwise the crossterm reader thread may keep reading
//! from stdin, so the safer approach is to drop and recreate the event stream when we need to hand off the terminal.
//!
//! See https://ratatui.rs/recipes/apps/spawn-vim/ and https://www.reddit.com/r/rust/comments/1f3o33u/myterious_crossterm_input_after_running_vim for more details.

use std::pin::Pin;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::sync::Mutex;
use std::task::Context;
use std::task::Poll;
use std::time::Instant;

use crossterm::event::Event;
use tokio::sync::broadcast;
use tokio::sync::watch;
use tokio_stream::wrappers::errors::BroadcastStreamRecvError;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::wrappers::WatchStream;
use tokio_stream::Stream;

use super::TuiEvent;

/// Result type produced by an event source.
pub type EventResult = std::io::Result<Event>;

/// Abstraction over a source of terminal events. Allows swapping in a fake for tests.
/// Value in production is [`CrosstermEventSource`].
pub trait EventSource: Send + 'static {
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<EventResult>>;
}

/// Shared crossterm input state for all [`TuiEventStream`] instances. A single crossterm EventStream
/// is reused so all streams still see the same input source.
///
/// This intermediate layer enables dropping/recreating the underlying EventStream (pause/resume) without rebuilding consumers.
pub struct EventBroker<S: EventSource = CrosstermEventSource> {
    state: Mutex<EventBrokerState<S>>,
    resume_events_tx: watch::Sender<()>,
    size_monitor: Option<super::size_monitor::SizeMonitor>,
}

/// Tracks state of underlying [`EventSource`].
enum EventBrokerState<S: EventSource> {
    Paused,     // Underlying event source (i.e., crossterm EventStream) dropped
    Start,      // A new event source will be created on next poll
    Running(S), // Event source is currently running
}

impl<S: EventSource + Default> EventBrokerState<S> {
    /// Return the running event source, starting it if needed; None when paused.
    fn active_event_source_mut(&mut self) -> Option<&mut S> {
        match self {
            EventBrokerState::Paused => None,
            EventBrokerState::Start => {
                *self = EventBrokerState::Running(S::default());
                match self {
                    EventBrokerState::Running(events) => Some(events),
                    EventBrokerState::Paused | EventBrokerState::Start => unreachable!(),
                }
            }
            EventBrokerState::Running(events) => Some(events),
        }
    }
}

impl<S: EventSource + Default> EventBroker<S> {
    pub fn new() -> Self {
        let (resume_events_tx, _resume_events_rx) = watch::channel(());
        Self {
            state: Mutex::new(EventBrokerState::Start),
            resume_events_tx,
            size_monitor: None,
        }
    }

    pub(super) fn with_size_monitor(
        size: ratatui::layout::Size,
        draw_tx: broadcast::Sender<()>,
    ) -> Self {
        Self {
            size_monitor: super::size_monitor::SizeMonitor::start(size, draw_tx),
            ..Self::new()
        }
    }

    pub(super) fn observe_size(&self, size: ratatui::layout::Size) {
        if let Some(monitor) = &self.size_monitor {
            monitor.observe(size);
        }
    }

    /// Drop the underlying event source
    pub fn pause_events(&self) {
        if let Some(monitor) = &self.size_monitor {
            monitor.set_active(false);
        }
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        *state = EventBrokerState::Paused;
    }

    /// Create a new instance of the underlying event source
    pub fn resume_events(&self) {
        if let Some(monitor) = &self.size_monitor {
            monitor.set_active(true);
        }
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        *state = EventBrokerState::Start;
        let _ = self.resume_events_tx.send(());
    }

    /// Subscribe to a notification that fires whenever [`Self::resume_events`] is called.
    ///
    /// This is used to wake `poll_crossterm_event` when it is paused and waiting for the
    /// underlying crossterm stream to be recreated.
    pub fn resume_events_rx(&self) -> watch::Receiver<()> {
        self.resume_events_tx.subscribe()
    }
}

/// Real crossterm-backed event source.
pub struct CrosstermEventSource {
    #[cfg(not(windows))]
    events: crossterm::event::EventStream,
    #[cfg(windows)]
    events: super::windows_key_sequence::WindowsKeySequence<crossterm::event::EventStream>,
}

impl Default for CrosstermEventSource {
    fn default() -> Self {
        let events = crossterm::event::EventStream::new();
        Self {
            #[cfg(not(windows))]
            events,
            #[cfg(windows)]
            events: super::windows_key_sequence::WindowsKeySequence::new(events),
        }
    }
}

impl EventSource for CrosstermEventSource {
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<EventResult>> {
        // External console clients can restore VT input, which turns navigation into bytes.
        #[cfg(windows)]
        let _ = super::windows_console::ensure_input_record_mode();

        let result = Pin::new(&mut self.get_mut().events).poll_next(cx);

        // The blocking crossterm reader starts before Pending; reassert its input mode after it.
        #[cfg(windows)]
        if result.is_pending() {
            let _ = super::windows_console::ensure_input_record_mode();
        }

        result
    }
}

/// TuiEventStream is a struct for reading TUI events (draws and user input).
/// Each instance has its own draw subscription (the draw channel is broadcast, so
/// multiple receivers are fine), while crossterm input is funneled through a
/// single shared [`EventBroker`] because crossterm uses a global stdin reader and
/// does not support fan-out. Multiple TuiEventStream instances can exist during the app lifetime
/// (for nested or sequential screens), but only one should be polled at a time,
/// otherwise one instance can consume ("steal") input events and the other will miss them.
pub struct TuiEventStream<S: EventSource + Default + Unpin = CrosstermEventSource> {
    broker: Arc<EventBroker<S>>,
    draw_stream: BroadcastStream<()>,
    resume_stream: WatchStream<()>,
    terminal_focused: Arc<AtomicBool>,
    poll_draw_first: bool,
    input_clock: super::input_clock::InputClock,
}

impl<S: EventSource + Default + Unpin> TuiEventStream<S> {
    pub fn new(
        broker: Arc<EventBroker<S>>,
        draw_rx: broadcast::Receiver<()>,
        terminal_focused: Arc<AtomicBool>,
    ) -> Self {
        let resume_stream = WatchStream::from_changes(broker.resume_events_rx());
        Self {
            broker,
            draw_stream: BroadcastStream::new(draw_rx),
            resume_stream,
            terminal_focused,
            poll_draw_first: false,
            input_clock: super::input_clock::InputClock::new(Instant::now()),
        }
    }

    /// Shared paste clock for key consumption and idle draw ticks; wall timers stay separate.
    pub(crate) fn input_time(&self) -> Instant {
        self.input_clock.now(Instant::now())
    }

    /// Poll the shared crossterm stream for the next mapped `TuiEvent`.
    ///
    /// This skips events we don't use and keeps polling until it yields
    /// a mapped event, hits `Pending`, or sees EOF/error. When the broker is paused, it drops
    /// the underlying stream and returns `Pending` to fully release stdin.
    pub fn poll_crossterm_event(&mut self, cx: &mut Context<'_>) -> Poll<Option<TuiEvent>> {
        // Some crossterm events may map to None; loop so we keep polling
        // until we return a mapped event, hit Pending, or see EOF/error.
        loop {
            let poll_result = {
                let mut state = self
                    .broker
                    .state
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                let events = match state.active_event_source_mut() {
                    Some(events) => events,
                    None => {
                        drop(state);
                        // Poll resume_stream so resume_events wakes a stream paused here
                        match Pin::new(&mut self.resume_stream).poll_next(cx) {
                            Poll::Ready(Some(())) => continue,
                            Poll::Ready(None) => return Poll::Ready(None),
                            Poll::Pending => return Poll::Pending,
                        }
                    }
                };
                match Pin::new(events).poll_next(cx) {
                    Poll::Ready(Some(Ok(event))) => {
                        self.input_clock.ready(Instant::now());
                        Some(event)
                    }
                    Poll::Ready(Some(Err(_))) | Poll::Ready(None) => {
                        *state = EventBrokerState::Start;
                        return Poll::Ready(None);
                    }
                    Poll::Pending => {
                        self.input_clock.pending(Instant::now());
                        drop(state);
                        // Poll resume_stream so resume_events can wake us even while waiting on stdin
                        match Pin::new(&mut self.resume_stream).poll_next(cx) {
                            Poll::Ready(Some(())) => continue,
                            Poll::Ready(None) => return Poll::Ready(None),
                            Poll::Pending => return Poll::Pending,
                        }
                    }
                }
            };

            if let Some(mapped) = poll_result.and_then(|event| self.map_crossterm_event(event)) {
                return Poll::Ready(Some(mapped));
            }
        }
    }

    /// Poll the draw broadcast stream for the next draw event. Draw events are used to trigger a redraw of the TUI.
    pub fn poll_draw_event(&mut self, cx: &mut Context<'_>) -> Poll<Option<TuiEvent>> {
        match Pin::new(&mut self.draw_stream).poll_next(cx) {
            Poll::Ready(Some(Ok(()) | Err(BroadcastStreamRecvError::Lagged(_)))) => {
                let resize = self
                    .broker
                    .size_monitor
                    .as_ref()
                    .and_then(super::size_monitor::SizeMonitor::take_resize);
                Poll::Ready(Some(resize.map_or(TuiEvent::Draw, TuiEvent::Resize)))
            }
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }

    /// Map a crossterm event to a [`TuiEvent`], skipping events we don't use (mouse events, etc.).
    fn map_crossterm_event(&mut self, event: Event) -> Option<TuiEvent> {
        match event {
            Event::Key(key_event) => Some(TuiEvent::Key(key_event)),
            Event::Resize(width, height) => {
                self.broker
                    .observe_size(ratatui::layout::Size { width, height });
                Some(TuiEvent::Resize(ratatui::layout::Size { width, height }))
            }
            Event::Paste(pasted) => Some(TuiEvent::Paste(pasted)),
            Event::Mouse(mouse) => Some(TuiEvent::Mouse(mouse)),
            Event::FocusGained => {
                self.terminal_focused.store(true, Ordering::Relaxed);
                // Keep the startup-cached palette: querying terminal colors here blocks the
                // input loop, and a direct probe would discard keys typed during the refresh.
                Some(TuiEvent::FocusGained)
            }
            Event::FocusLost => {
                self.terminal_focused.store(false, Ordering::Relaxed);
                Some(TuiEvent::FocusLost)
            }
        }
    }
}

impl<S: EventSource + Default + Unpin> Unpin for TuiEventStream<S> {}

impl<S: EventSource + Default + Unpin> Stream for TuiEventStream<S> {
    type Item = TuiEvent;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        // approximate fairness + no starvation via round-robin.
        let draw_first = self.poll_draw_first;
        self.poll_draw_first = !self.poll_draw_first;

        if draw_first {
            if let Poll::Ready(event) = self.poll_draw_event(cx) {
                return Poll::Ready(event);
            }
            if let Poll::Ready(event) = self.poll_crossterm_event(cx) {
                return Poll::Ready(event);
            }
        } else {
            if let Poll::Ready(event) = self.poll_crossterm_event(cx) {
                return Poll::Ready(event);
            }
            if let Poll::Ready(event) = self.poll_draw_event(cx) {
                return Poll::Ready(event);
            }
        }

        Poll::Pending
    }
}

#[cfg(test)]
#[path = "event_stream_tests.rs"]
mod tests;
