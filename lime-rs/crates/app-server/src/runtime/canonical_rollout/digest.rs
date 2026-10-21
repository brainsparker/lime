use agent_protocol::ThreadHistoryChangeSet;
use app_server_protocol::AgentEvent;
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

pub(super) const CURRENT_SCHEMA_VERSION: u32 = 3;

pub(super) fn supported_schema_version(version: u32) -> bool {
    version == CURRENT_SCHEMA_VERSION
}

pub(super) fn history_content_digest(
    session_id: &str,
    thread_id: &str,
    changes: &ThreadHistoryChangeSet,
    runtime_events: &[AgentEvent],
) -> Result<String, String> {
    stable_digest(&(session_id, thread_id, changes, runtime_events))
}

pub(super) fn metadata_content_digest(
    session_id: &str,
    thread_id: &str,
    updated_at_ms: i64,
    metadata: &Value,
) -> Result<String, String> {
    stable_digest(&(session_id, thread_id, updated_at_ms, metadata))
}

pub(super) fn stable_digest(payload: &impl Serialize) -> Result<String, String> {
    let mut value = serde_json::to_value(payload)
        .map_err(|error| format!("failed to normalize rollout digest: {error}"))?;
    // Object order must not depend on Cargo's serde_json feature unification.
    value.sort_all_objects();
    encoded_digest(&value)
}

fn encoded_digest(payload: &impl Serialize) -> Result<String, String> {
    let bytes = serde_json::to_vec(payload)
        .map_err(|error| format!("failed to encode rollout digest: {error}"))?;
    Ok(hex::encode(Sha256::digest(bytes)))
}
