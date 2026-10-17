use agent_protocol::ThreadHistoryChangeSet;
use serde::{Deserialize, Serialize};
use serde_json::{value::RawValue, Value};
use sha2::{Digest, Sha256};

pub(super) const CURRENT_SCHEMA_VERSION: u32 = 2;

pub(super) fn supported_schema_version(version: u32) -> bool {
    matches!(version, 1 | CURRENT_SCHEMA_VERSION)
}

pub(super) fn history_content_digest(
    session_id: &str,
    thread_id: &str,
    changes: &ThreadHistoryChangeSet,
) -> Result<String, String> {
    stable_digest(&(session_id, thread_id, changes))
}

pub(super) fn metadata_content_digest(
    session_id: &str,
    thread_id: &str,
    updated_at_ms: i64,
    metadata: &Value,
) -> Result<String, String> {
    stable_digest(&(session_id, thread_id, updated_at_ms, metadata))
}

pub(super) fn history_digest_matches(
    version: u32,
    line: &[u8],
    session_id: &str,
    thread_id: &str,
    changes: &ThreadHistoryChangeSet,
    expected: &str,
) -> Result<bool, String> {
    let actual = if version == 1 {
        let payload: HistoryPayload<'_> = legacy_payload(line)?;
        encoded_digest(&(session_id, thread_id, payload.changes))?
    } else {
        history_content_digest(session_id, thread_id, changes)?
    };
    Ok(actual == expected)
}

pub(super) fn metadata_digest_for_record(
    version: u32,
    line: &[u8],
    session_id: &str,
    thread_id: &str,
    updated_at_ms: i64,
    metadata: &Value,
) -> Result<String, String> {
    if version == 1 {
        let payload: MetadataPayload<'_> = legacy_payload(line)?;
        encoded_digest(&(session_id, thread_id, updated_at_ms, payload.metadata))
    } else {
        metadata_content_digest(session_id, thread_id, updated_at_ms, metadata)
    }
}

pub(super) fn initial_metadata_digest(
    version: u32,
    line: &[u8],
    session_id: &str,
    thread_id: &str,
    updated_at_ms: i64,
    metadata: &Value,
) -> Result<String, String> {
    if version == 1 {
        let payload: HeaderPayload<'_> = legacy_payload(line)?;
        encoded_digest(&(
            session_id,
            thread_id,
            updated_at_ms,
            payload.thread.metadata,
        ))
    } else {
        metadata_content_digest(session_id, thread_id, updated_at_ms, metadata)
    }
}

fn stable_digest(payload: &impl Serialize) -> Result<String, String> {
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

// Version 1 hashed the writer's serialized payload. Read those exact bytes,
// preserving object order and numbers even when this build uses different features.
#[derive(Deserialize)]
struct HistoryPayload<'a> {
    #[serde(borrow)]
    changes: &'a RawValue,
}

#[derive(Deserialize)]
struct MetadataPayload<'a> {
    #[serde(borrow)]
    metadata: &'a RawValue,
}

#[derive(Deserialize)]
struct HeaderPayload<'a> {
    #[serde(borrow)]
    thread: MetadataPayload<'a>,
}

fn legacy_payload<'a, T: Deserialize<'a>>(line: &'a [u8]) -> Result<T, String> {
    serde_json::from_slice(line)
        .map_err(|error| format!("failed to read legacy rollout digest payload: {error}"))
}
