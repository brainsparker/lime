use super::invocation::Invocation;
use super::unified_exec_error;
use crate::tool_executor::RuntimeToolExecutionError;
use std::collections::HashMap;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Debug)]
pub(super) struct UnifiedExecSession {
    pub(super) thread_id: String,
    pub(super) turn_id: String,
    pub(super) process_id: String,
    pub(super) call_id: String,
    pub(super) invocation: Invocation,
    pub(super) after_sequence: Option<u64>,
    pub(super) empty_poll_count: u64,
}

#[derive(Default)]
struct UnifiedExecSessionRegistry {
    sessions: HashMap<i32, UnifiedExecSessionRegistration>,
}

struct UnifiedExecSessionRegistration {
    process_id: String,
    session: Arc<tokio::sync::Mutex<UnifiedExecSession>>,
}

pub(super) async fn session_facts(
    session: &tokio::sync::Mutex<UnifiedExecSession>,
) -> UnifiedExecSession {
    let session = session.lock().await;
    UnifiedExecSession {
        thread_id: session.thread_id.clone(),
        turn_id: session.turn_id.clone(),
        process_id: session.process_id.clone(),
        call_id: session.call_id.clone(),
        invocation: session.invocation.clone(),
        after_sequence: session.after_sequence,
        empty_poll_count: session.empty_poll_count,
    }
}

fn session_registry() -> &'static Mutex<UnifiedExecSessionRegistry> {
    static REGISTRY: OnceLock<Mutex<UnifiedExecSessionRegistry>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(UnifiedExecSessionRegistry::default()))
}

pub(super) fn next_session_id() -> i32 {
    static NEXT_SESSION_ID: AtomicI32 = AtomicI32::new(1_000);
    NEXT_SESSION_ID.fetch_add(1, Ordering::Relaxed)
}

pub(super) fn register_session(
    session_id: i32,
    process_id: String,
    session: Arc<tokio::sync::Mutex<UnifiedExecSession>>,
) -> Result<(), RuntimeToolExecutionError> {
    let mut registry = session_registry()
        .lock()
        .map_err(|_| unified_exec_error("unified exec session registry is unavailable"))?;
    registry.sessions.insert(
        session_id,
        UnifiedExecSessionRegistration {
            process_id,
            session,
        },
    );
    Ok(())
}

pub(super) fn find_session(
    session_id: i32,
) -> Result<Arc<tokio::sync::Mutex<UnifiedExecSession>>, RuntimeToolExecutionError> {
    session_registry()
        .lock()
        .map_err(|_| unified_exec_error("unified exec session registry is unavailable"))?
        .sessions
        .get(&session_id)
        .map(|registration| Arc::clone(&registration.session))
        .ok_or_else(|| unified_exec_error(format!("unified exec session not found: {session_id}")))
}

pub(super) fn remove_session(session_id: i32) {
    if let Ok(mut registry) = session_registry().lock() {
        registry.sessions.remove(&session_id);
    }
}

pub fn forget_process_session(process_id: &str) {
    if let Ok(mut registry) = session_registry().lock() {
        registry
            .sessions
            .retain(|_, registration| registration.process_id != process_id);
    }
}
