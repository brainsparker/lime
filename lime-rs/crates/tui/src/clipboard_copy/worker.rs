//! One session-lived worker serializes blocking clipboard reads and writes.
//!
//! Copy setup has a five-second budget; delivery that has already started must finish.
//! The shared setup decision prevents abandoned initialization from starting a late write.
//! Canceled or timed-out OS calls remain busy until drained. Terminal sequences run on the UI.
//! Native CLIPBOARD and PRIMARY leases stay here; UI completion lifetime cannot release them.
//! Only the latest PRIMARY publication may wait, canceled by its selection scope.

use super::{
    copy_to_clipboard, osc52_copy, osc52_sequence, ClipboardLease, CopyFormat, CopyOutcome,
    CopyStatus,
};
use crate::tui::FrameRequester;
use std::cell::Cell;
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex, Weak};
use std::time::{Duration, Instant};

const SETUP_TIMEOUT: Duration = Duration::from_secs(5);
const SETUP_TIMEOUT_MESSAGE: &str = "clipboard setup timed out; copy abandoned";

enum Setup {
    Pending(Instant),
    Delivering,
    Abandoned,
}

impl Setup {
    fn timed_out(&mut self, now: Instant) -> bool {
        if matches!(self, Self::Pending(deadline) if now >= *deadline) {
            *self = Self::Abandoned;
        }
        matches!(self, Self::Abandoned)
    }
}

/// UI timeout and worker delivery share a short critical section with no OS calls.
struct CopySetup {
    phase: Mutex<Setup>,
    frames: FrameRequester,
    owner: Option<Weak<()>>,
}

impl CopySetup {
    fn begin_delivery(&self) -> Result<(), String> {
        let mut phase = self
            .phase
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if phase.timed_out(Instant::now()) {
            return Err(SETUP_TIMEOUT_MESSAGE.into());
        }
        if matches!(*phase, Setup::Pending(_))
            && self
                .owner
                .as_ref()
                .is_some_and(|owner| owner.strong_count() == 0)
        {
            return Err("selection ended before clipboard delivery".into());
        }
        *phase = Setup::Delivering;
        Ok(())
    }

    fn timed_out(&self, now: Instant) -> bool {
        let mut phase = self
            .phase
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let expired = phase.timed_out(now);
        if let Setup::Pending(deadline) = *phase {
            self.frames
                .schedule_frame_in(deadline.saturating_duration_since(now));
        }
        expired
    }
}

pub(crate) type CopyResult = Result<CopyStatus, String>;
type ReadResult = Result<String, String>;

pub(crate) enum Completion {
    Copy(CopyResult),
    Read(ReadResult),
}

enum PendingOperation {
    Copy(Arc<CopySetup>),
    Read {
        deadline: Instant,
        frames: FrameRequester,
        owner: Weak<()>,
    },
}

impl PendingOperation {
    fn schedule_drain(&self) {
        match self {
            Self::Copy(setup) => setup.frames.schedule_frame(),
            Self::Read { frames, .. } => frames.schedule_frame(),
        }
    }

    fn error(&self, error: impl Into<String>) -> Completion {
        match self {
            Self::Copy(_) => Completion::Copy(Err(error.into())),
            Self::Read { .. } => Completion::Read(Err(error.into())),
        }
    }

    fn timeout_message(&self) -> &'static str {
        match self {
            Self::Copy(_) => SETUP_TIMEOUT_MESSAGE,
            Self::Read { .. } => "clipboard read timed out",
        }
    }

    fn timed_out(&self, now: Instant) -> bool {
        match self {
            Self::Copy(setup) => setup.timed_out(now),
            Self::Read {
                deadline, frames, ..
            } => {
                if now >= *deadline {
                    return true;
                }
                frames.schedule_frame_in(*deadline - now);
                false
            }
        }
    }

    fn canceled(&self) -> bool {
        matches!(self, Self::Read { owner, .. } if owner.strong_count() == 0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PasteSource {
    Clipboard,
    Primary,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CopyDestination {
    Clipboard,
    Primary,
}

enum Operation {
    Copy {
        text: String,
        format: CopyFormat,
        destination: CopyDestination,
        setup: Arc<CopySetup>,
    },
    Read {
        source: PasteSource,
        deadline: Instant,
        owner: Weak<()>,
    },
}

struct Request {
    id: u64,
    operation: Operation,
    frames: FrameRequester,
}
struct Response {
    id: u64,
    completion: Completion,
    terminal_text: Option<String>,
}
struct Pending {
    id: u64,
    operation: PendingOperation,
    expired: bool,
}

/// One native operation at a time; only the latest selection publication may wait.
#[derive(Default)]
pub(crate) struct ClipboardWorker {
    requests: Option<Sender<Request>>,
    responses: Option<Receiver<Response>>,
    in_flight: Option<u64>,
    pending: Option<Pending>,
    next_id: u64,
    primary: Option<(String, Weak<()>)>,
    queued_read: Option<Request>,
    read_result: Option<(u64, Weak<()>, ReadResult)>,
}

impl ClipboardWorker {
    pub(crate) fn is_busy(&self) -> bool {
        self.in_flight.is_some()
    }

    #[cfg(test)]
    pub(crate) fn test_busy() -> Self {
        let mut worker = Self::default();
        worker.in_flight = Some(1);
        worker
    }

    pub(crate) fn copy(
        &mut self,
        text: String,
        format: CopyFormat,
        frames: FrameRequester,
    ) -> CopyResult {
        self.copy_to(text, format, frames, CopyDestination::Clipboard, None)
    }

    /// Only the latest publication may wait; its selection cancels by dropping the scope.
    pub(crate) fn select(&mut self, text: String, frames: FrameRequester) -> Arc<()> {
        let owner = Arc::new(());
        let scope = Arc::downgrade(&owner);
        self.primary = None;
        if self.is_busy() {
            self.primary = Some((text, scope));
        } else {
            let _ = self.copy_to(
                text,
                CopyFormat::PlainText,
                frames,
                CopyDestination::Primary,
                Some(scope),
            );
        }
        owner
    }

    /// Advance only after the UI validates selection owners at an idle draw boundary.
    pub(crate) fn advance(&mut self, frames: FrameRequester) {
        if self.is_busy() {
            return;
        }
        if let Some((text, owner)) = self.primary.take() {
            if owner.strong_count() > 0 {
                let _ = self.copy_to(
                    text,
                    CopyFormat::PlainText,
                    frames,
                    CopyDestination::Primary,
                    Some(owner),
                );
            }
        }
        if !self.is_busy() {
            if let Some(request) = self.queued_read.take() {
                let Operation::Read {
                    deadline, owner, ..
                } = &request.operation
                else {
                    unreachable!("only PRIMARY reads may queue");
                };
                if owner.strong_count() > 0 {
                    let id = request.id;
                    let owner = owner.clone();
                    let frames = request.frames.clone();
                    if Instant::now() >= *deadline {
                        self.read_result =
                            Some((id, owner, Err("clipboard read timed out".into())));
                    } else if let Err(error) = self.send_request(request) {
                        self.read_result = Some((id, owner, Err(error)));
                    }
                    if self.read_result.is_some() {
                        frames.schedule_frame();
                    }
                }
            }
        }
    }

    fn copy_to(
        &mut self,
        text: String,
        format: CopyFormat,
        frames: FrameRequester,
        destination: CopyDestination,
        owner: Option<Weak<()>>,
    ) -> CopyResult {
        if self.is_busy() {
            return Ok(CopyStatus::Busy);
        }
        if text.is_empty() {
            return Err("nothing to copy: the selected content is empty".into());
        }
        let setup = Arc::new(CopySetup {
            phase: Mutex::new(Setup::Pending(Instant::now() + SETUP_TIMEOUT)),
            frames: frames.clone(),
            owner,
        });
        self.ensure_started()?;
        let request = self.next_request(
            Operation::Copy {
                text,
                format,
                destination,
                setup,
            },
            frames,
        );
        let id = request.id;
        self.send_request(request)?;
        Ok(CopyStatus::Pending(id))
    }

    /// PRIMARY may wait behind publication; CLIPBOARD never queues. Retain the read scope.
    pub(crate) fn read_text(
        &mut self,
        source: PasteSource,
        frames: FrameRequester,
    ) -> Result<Option<(u64, Arc<()>)>, String> {
        if self.queued_read.is_some()
            || self
                .pending
                .as_ref()
                .is_some_and(|pending| matches!(pending.operation, PendingOperation::Read { .. }))
            || (source == PasteSource::Clipboard && self.is_busy())
        {
            return Ok(None);
        }
        self.ensure_started()?;
        let owner = Arc::new(());
        let operation = Operation::Read {
            source,
            deadline: Instant::now() + SETUP_TIMEOUT,
            owner: Arc::downgrade(&owner),
        };
        let request = self.next_request(operation, frames.clone());
        let id = request.id;
        if self.is_busy() || (source == PasteSource::Primary && self.primary.is_some()) {
            self.queued_read = Some(request);
        } else {
            self.send_request(request)?;
        }
        frames.schedule_frame_in(SETUP_TIMEOUT);
        Ok(Some((id, owner)))
    }

    fn next_request(&mut self, operation: Operation, frames: FrameRequester) -> Request {
        self.next_id = self.next_id.wrapping_add(1).max(1);
        Request {
            id: self.next_id,
            operation,
            frames,
        }
    }

    fn send_request(&mut self, request: Request) -> Result<(), String> {
        let Request {
            id,
            operation,
            frames,
        } = request;
        let pending = match &operation {
            Operation::Copy { setup, .. } => PendingOperation::Copy(Arc::clone(setup)),
            Operation::Read {
                deadline, owner, ..
            } => PendingOperation::Read {
                deadline: *deadline,
                frames: frames.clone(),
                owner: owner.clone(),
            },
        };
        let sender = self.requests.as_ref().ok_or("clipboard worker stopped")?;
        sender
            .send(Request {
                id,
                operation,
                frames: frames.clone(),
            })
            .map_err(|_| "clipboard worker stopped".to_string())?;
        self.in_flight = Some(id);
        self.pending = Some(Pending {
            id,
            operation: pending,
            expired: false,
        });
        match &self
            .pending
            .as_ref()
            .expect("sent clipboard request")
            .operation
        {
            PendingOperation::Copy(_) => frames.schedule_frame_in(SETUP_TIMEOUT),
            PendingOperation::Read { deadline, .. } => {
                frames.schedule_frame_in(deadline.saturating_duration_since(Instant::now()))
            }
        }
        Ok(())
    }

    pub(crate) fn poll(&mut self) -> Option<(u64, Completion)> {
        self.poll_at(Instant::now())
    }

    fn poll_at(&mut self, now: Instant) -> Option<(u64, Completion)> {
        self.poll_with(now, osc52_copy)
    }

    /// Called only at a UI draw boundary, after any terminal handoff has returned.
    fn poll_with(
        &mut self,
        now: Instant,
        terminal_copy: impl FnOnce(&str) -> Result<(), String>,
    ) -> Option<(u64, Completion)> {
        if let Some((id, owner, result)) = self.read_result.take() {
            if owner.strong_count() > 0 {
                return Some((id, Completion::Read(result)));
            }
        }
        if let Some(request) = self.queued_read.as_ref() {
            let Operation::Read {
                deadline, owner, ..
            } = &request.operation
            else {
                unreachable!("only PRIMARY reads may queue");
            };
            if owner.strong_count() == 0 {
                self.queued_read = None;
            } else if now >= *deadline {
                let id = request.id;
                request.frames.schedule_frame();
                self.queued_read = None;
                return Some((id, Completion::Read(Err("clipboard read timed out".into()))));
            } else {
                request.frames.schedule_frame_in(*deadline - now);
            }
        }
        if let Some(pending) = self.pending.as_mut() {
            pending.expired |= pending.operation.canceled();
            if !pending.expired && pending.operation.timed_out(now) {
                pending.expired = true;
                // Feedback consumes this draw; an already queued response still needs a drain.
                pending.operation.schedule_drain();
                return Some((
                    pending.id,
                    pending.operation.error(pending.operation.timeout_message()),
                ));
            }
        }
        let response = match self.responses.as_ref()?.try_recv() {
            Ok(response) => response,
            Err(TryRecvError::Empty) => return None,
            Err(TryRecvError::Disconnected) => {
                let id = self.in_flight.take()?;
                let pending = self.pending.take();
                self.requests = None;
                self.responses = None;
                return pending
                    .filter(|pending| pending.id == id && !pending.expired)
                    .map(|pending| (id, pending.operation.error("clipboard worker stopped")));
            }
        };
        if self.in_flight == Some(response.id) {
            self.in_flight = None;
        }
        let pending = self
            .pending
            .take()
            .filter(|pending| pending.id == response.id && !pending.expired)?;
        let mut completion = response.completion;
        if let Some(text) = response.terminal_text {
            if let Err(error) = terminal_copy(&text) {
                if let Completion::Copy(copy) = &mut completion {
                    if !matches!(copy, Ok(CopyStatus::Confirmed)) {
                        *copy = Err(error);
                    }
                }
            }
        }
        Some((pending.id, completion))
    }

    fn ensure_started(&mut self) -> Result<(), String> {
        if self.requests.is_some() {
            return Ok(());
        }
        self.start(
            |text, format, setup| {
                let terminal_text = Cell::new(None);
                let result = copy_to_clipboard(
                    text,
                    format,
                    || setup.begin_delivery(),
                    |text| {
                        osc52_sequence(text, super::is_tmux_session())?;
                        terminal_text.set(Some(text.to_owned()));
                        Ok(())
                    },
                );
                (result, terminal_text.into_inner())
            },
            |text, setup| super::primary::copy(text, || setup.begin_delivery()),
            |source, deadline| match source {
                PasteSource::Clipboard => crate::clipboard_paste::text::read(deadline),
                PasteSource::Primary => super::primary::read(deadline),
            },
        )
    }

    fn start(
        &mut self,
        mut copy: impl FnMut(&str, CopyFormat, &CopySetup) -> (Result<CopyOutcome, String>, Option<String>)
            + Send
            + 'static,
        mut primary_copy: impl FnMut(&str, &CopySetup) -> Result<CopyOutcome, String> + Send + 'static,
        mut read: impl FnMut(PasteSource, Instant) -> ReadResult + Send + 'static,
    ) -> Result<(), String> {
        let (request_tx, request_rx) = mpsc::channel::<Request>();
        let (response_tx, response_rx) = mpsc::channel::<Response>();
        std::thread::Builder::new()
            .name("clipboard-copy".into())
            .spawn(move || {
                let mut lease: Option<ClipboardLease> = None;
                let mut primary_lease: Option<ClipboardLease> = None;
                while let Ok(request) = request_rx.recv() {
                    let (completion, terminal_text) = match request.operation {
                        Operation::Copy {
                            text,
                            format,
                            destination,
                            setup,
                        } => {
                            if destination == CopyDestination::Primary {
                                (
                                    Completion::Copy(
                                        primary_copy(&text, &setup)
                                            .map(|outcome| outcome.store(&mut primary_lease)),
                                    ),
                                    None,
                                )
                            } else {
                                let (clipboard, terminal_text) = copy(&text, format, &setup);
                                (
                                    Completion::Copy(
                                        clipboard.map(|outcome| outcome.store(&mut lease)),
                                    ),
                                    terminal_text,
                                )
                            }
                        }
                        Operation::Read {
                            source,
                            deadline,
                            owner,
                        } => {
                            let result = if owner.strong_count() == 0 {
                                Err("clipboard read canceled".into())
                            } else if Instant::now() >= deadline {
                                Err("clipboard read timed out".into())
                            } else {
                                read(source, deadline)
                            };
                            (Completion::Read(result), None)
                        }
                    };
                    let _ = response_tx.send(Response {
                        id: request.id,
                        completion,
                        terminal_text,
                    });
                    request.frames.schedule_frame();
                }
                // Release native owners before disconnecting the UI completion channel.
                #[cfg(any(target_os = "linux", test))]
                drop((lease, primary_lease));
                drop(response_tx);
            })
            .map_err(|error| format!("could not start clipboard worker: {error}"))?;
        self.requests = Some(request_tx);
        self.responses = Some(response_rx);
        Ok(())
    }
}

impl Drop for ClipboardWorker {
    fn drop(&mut self) {
        self.requests.take();
        // Only disconnection follows native lease cleanup; queued feedback is not a handoff.
        // Bound the wait because native calls and even Linux owner cleanup can stall.
        if let Some(responses) = &self.responses {
            let deadline = Instant::now() + Duration::from_millis(250);
            while Instant::now() < deadline
                && responses
                    .recv_timeout(deadline.saturating_duration_since(Instant::now()))
                    .is_ok()
            {}
        }
    }
}

#[cfg(test)]
#[path = "worker_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "worker_selection_tests.rs"]
mod selection_tests;

#[cfg(test)]
#[path = "worker_read_tests.rs"]
mod read_tests;

#[cfg(test)]
#[path = "worker_shutdown_tests.rs"]
mod shutdown_tests;
