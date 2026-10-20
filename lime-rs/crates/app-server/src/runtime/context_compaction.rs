use super::sidecar_store::{
    session_scoped_relative_path, SidecarRef, SidecarStore, SidecarWriteRequest,
};
use super::RuntimeCoreError;
use app_server_protocol::{AgentEvent, AgentSession, AgentTurn};
use chrono::{SecondsFormat, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

pub(crate) mod boundary;

const COMPACTION_ARTIFACT_SCHEMA: &str = "session_context_compaction.v3";
const MAX_USER_BOUNDARY_CHARS: usize = 12_000;
const MAX_TAIL_TURNS: usize = 4;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct SessionContextCompaction {
    pub(crate) compaction_id: String,
    pub(crate) context_epoch: u64,
    pub(crate) covered_through_sequence: u64,
    pub(crate) window: CompactionWindow,
    pub(crate) summary: String,
    pub(crate) artifact: Value,
    pub(crate) sidecar_ref: Option<SidecarRef>,
}

/// Durable context-window lineage for provider-visible history replacement.
///
/// `replacement_history` is the model-visible replacement for the compacted prefix. The raw
/// event history remains durable; only provider history uses this bounded replacement plus the
/// surviving tail.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct CompactionWindow {
    pub(crate) replacement_history: Vec<Value>,
    pub(crate) window_number: u64,
    pub(crate) first_window_id: String,
    pub(crate) previous_window_id: Option<String>,
    pub(crate) window_id: String,
}

/// Validated compaction lineage used when rebuilding an AgentControl child history.
///
/// The marker remains a session-level event. The fork owner rewrites only the session/thread
/// identity and the covered prefix sequence; replacement and window lineage stay intact.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ForkCompactionSeed {
    pub(crate) covered_through_sequence: u64,
    pub(crate) payload: Value,
}

pub(crate) fn latest_fork_compaction_seed(
    events: &[AgentEvent],
) -> Result<Option<ForkCompactionSeed>, RuntimeCoreError> {
    let Some(event) = events
        .iter()
        .rev()
        .find(|event| event.event_type == "context.compaction.completed")
    else {
        return Ok(None);
    };
    let Some(window) = latest_compaction_window(events)? else {
        return Ok(None);
    };
    validate_replacement_history(&window.replacement_history, event)?;
    let covered_through_sequence = boundary::covered_sequence(event)?;
    let artifact = event
        .payload
        .get("artifact")
        .filter(|value| value.is_object())
        .and_then(Value::as_object);
    if let Some(artifact) = artifact {
        for field in [
            "coveredThroughSequence",
            "replacementHistory",
            "windowNumber",
            "firstWindowId",
            "previousWindowId",
            "windowId",
        ] {
            let top_level = event.payload.get(field);
            let nested = artifact.get(field);
            if top_level != nested {
                return Err(invalid_compaction_lineage(
                    event,
                    format!("top-level and artifact {field} disagree or are incomplete"),
                ));
            }
        }
    }
    let replacement_value = Value::Array(window.replacement_history.clone());
    let window_number_value = Value::from(window.window_number);
    let first_window_id_value = Value::from(window.first_window_id.clone());
    let window_id_value = Value::from(window.window_id.clone());
    for (field, expected) in [
        ("replacementHistory", &replacement_value),
        ("windowNumber", &window_number_value),
        ("firstWindowId", &first_window_id_value),
        ("windowId", &window_id_value),
    ] {
        if let Some(top_level) = event.payload.get(field) {
            if top_level != expected {
                return Err(invalid_compaction_lineage(
                    event,
                    format!("top-level {field} disagrees with validated lineage"),
                ));
            }
        }
    }
    Ok(Some(ForkCompactionSeed {
        covered_through_sequence,
        payload: event.payload.clone(),
    }))
}

fn validate_replacement_history(
    replacement_history: &[Value],
    event: &AgentEvent,
) -> Result<(), RuntimeCoreError> {
    for (index, item) in replacement_history.iter().enumerate() {
        item.get("role")
            .and_then(Value::as_str)
            .filter(|role| matches!(*role, "user" | "assistant" | "tool"))
            .ok_or_else(|| {
                invalid_compaction_lineage(
                    event,
                    format!("replacementHistory[{index}] has unsupported role"),
                )
            })?;
        let content = item.get("content").ok_or_else(|| {
            invalid_compaction_lineage(
                event,
                format!("replacementHistory[{index}] is missing content"),
            )
        })?;
        let valid_content = content.as_str().is_some_and(|text| !text.is_empty())
            || content.as_array().is_some_and(|parts| {
                !parts.is_empty()
                    && parts.iter().all(|part| {
                        part.as_str().is_some_and(|text| !text.is_empty())
                            || part
                                .get("text")
                                .and_then(Value::as_str)
                                .is_some_and(|text| !text.is_empty())
                    })
            });
        if !valid_content {
            return Err(invalid_compaction_lineage(
                event,
                format!("replacementHistory[{index}] has unsupported content"),
            ));
        }
    }
    Ok(())
}

pub(crate) fn build_session_context_compaction(
    session: &AgentSession,
    turns: &[AgentTurn],
    events: &[AgentEvent],
    covered_through_sequence: u64,
    compaction_id: &str,
    summary: &str,
    sidecar_store: Option<&SidecarStore>,
) -> Result<SessionContextCompaction, RuntimeCoreError> {
    let previous_window = latest_compaction_window(events)?;
    let context_epoch = next_compaction_window_number(events, previous_window.as_ref());
    let compaction_id = compaction_id.to_string();
    boundary::validate_snapshot_boundary(events, covered_through_sequence)?;
    if summary.trim().is_empty() {
        return Err(RuntimeCoreError::Backend(
            "context compaction requires a model summary".to_string(),
        ));
    }
    let summary = summary.to_string();
    let window = build_compaction_window(
        context_epoch,
        &summary,
        events,
        covered_through_sequence,
        previous_window,
    );
    let artifact = json!({
        "schema": COMPACTION_ARTIFACT_SCHEMA,
        "compactionId": compaction_id,
        "sessionId": session.session_id,
        "threadId": session.thread_id,
        "contextEpoch": context_epoch,
        "coveredThroughSequence": covered_through_sequence,
        "replacementHistory": window.replacement_history,
        "windowNumber": window.window_number,
        "firstWindowId": window.first_window_id,
        "previousWindowId": window.previous_window_id,
        "windowId": window.window_id,
        "turnCount": turns.len(),
        "eventCount": events.len(),
        "createdAt": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "summary": summary,
        "policy": {
            "durableHistoryRewrite": false,
            "providerHistoryRewrite": true,
            "providerTailMode": "after_covered_sequence",
            "longTermMemoryWrite": false,
            "artifactScope": "session"
        }
    });
    let sidecar_ref = if let Some(sidecar_store) =
        sidecar_store.filter(|_| !super::session_is_ephemeral(session))
    {
        let content = serde_json::to_string_pretty(&artifact).map_err(|error| {
            RuntimeCoreError::Backend(format!("failed to encode compaction artifact: {error}"))
        })?;
        Some(
            sidecar_store
                .write_text(&SidecarWriteRequest {
                    session_id: session.session_id.clone(),
                    kind: "context_compaction".to_string(),
                    logical_id: compaction_id.clone(),
                    relative_path: session_scoped_relative_path(
                        &session.session_id,
                        &format!("context-compaction/{compaction_id}.json"),
                    ),
                    content,
                })
                .map_err(RuntimeCoreError::Backend)?,
        )
    } else {
        None
    };

    Ok(SessionContextCompaction {
        compaction_id,
        context_epoch,
        covered_through_sequence,
        window,
        summary,
        artifact,
        sidecar_ref,
    })
}

fn build_compaction_window(
    window_number: u64,
    summary: &str,
    events: &[AgentEvent],
    covered_through_sequence: u64,
    previous: Option<CompactionWindow>,
) -> CompactionWindow {
    let window_id = Uuid::now_v7().to_string();
    let first_window_id = previous
        .as_ref()
        .map(|window| window.first_window_id.clone())
        .unwrap_or_else(|| window_id.clone());
    let previous_window_id = previous.map(|window| window.window_id);

    CompactionWindow {
        replacement_history: build_replacement_history(summary, events, covered_through_sequence),
        window_number,
        first_window_id,
        previous_window_id,
        window_id,
    }
}

fn latest_compaction_window(
    events: &[AgentEvent],
) -> Result<Option<CompactionWindow>, RuntimeCoreError> {
    let Some(event) = events
        .iter()
        .rev()
        .find(|event| event.event_type == "context.compaction.completed")
    else {
        return Ok(None);
    };
    let field = |name: &str| {
        event
            .payload
            .get("artifact")
            .filter(|value| value.is_object())
            .and_then(|artifact| artifact.get(name))
            .or_else(|| event.payload.get(name))
    };
    let lineage_fields = [
        "replacementHistory",
        "windowNumber",
        "firstWindowId",
        "previousWindowId",
        "windowId",
    ];
    if !lineage_fields.iter().any(|name| field(name).is_some()) {
        return Ok(None);
    }

    let required = |name: &str| {
        field(name).ok_or_else(|| invalid_compaction_lineage(event, format!("missing {name}")))
    };
    let window_number = required("windowNumber")?
        .as_u64()
        .filter(|number| *number > 0)
        .ok_or_else(|| {
            invalid_compaction_lineage(event, "windowNumber must be a positive integer")
        })?;
    let first_window_id = parse_window_id(event, "firstWindowId", required("firstWindowId")?)?;
    let window_id = parse_window_id(event, "windowId", required("windowId")?)?;
    let previous_window_id = field("previousWindowId")
        .filter(|value| !value.is_null())
        .map(|value| parse_window_id(event, "previousWindowId", value))
        .transpose()?;
    let replacement_history = required("replacementHistory")?
        .as_array()
        .cloned()
        .ok_or_else(|| invalid_compaction_lineage(event, "replacementHistory must be an array"))?;

    Ok(Some(CompactionWindow {
        replacement_history,
        window_number,
        first_window_id,
        previous_window_id,
        window_id,
    }))
}

fn parse_window_id(
    event: &AgentEvent,
    field: &str,
    value: &Value,
) -> Result<String, RuntimeCoreError> {
    let value = value
        .as_str()
        .ok_or_else(|| invalid_compaction_lineage(event, format!("{field} must be a string")))?;
    let id = Uuid::parse_str(value)
        .map_err(|_| invalid_compaction_lineage(event, format!("{field} must be a UUIDv7")))?;
    if id.get_version_num() != 7 {
        return Err(invalid_compaction_lineage(
            event,
            format!("{field} must be a UUIDv7"),
        ));
    }
    Ok(id.to_string())
}

fn invalid_compaction_lineage(
    event: &AgentEvent,
    message: impl std::fmt::Display,
) -> RuntimeCoreError {
    RuntimeCoreError::Backend(format!(
        "invalid compaction lineage in event {}: {message}",
        event.event_id
    ))
}

fn build_replacement_history(
    summary: &str,
    events: &[AgentEvent],
    covered_through_sequence: u64,
) -> Vec<Value> {
    // Keep the most recent user boundaries within the budget, then append the summary. The
    // durable event log remains unchanged.
    let mut selected = Vec::new();
    let mut remaining_chars = MAX_USER_BOUNDARY_CHARS;
    for event in events.iter().rev().filter(|event| {
        event.sequence <= covered_through_sequence && event.event_type == "message.created"
    }) {
        let Some(text) = payload_text(&event.payload) else {
            continue;
        };
        if remaining_chars == 0 {
            break;
        }
        let text = truncate_chars(&text, remaining_chars);
        remaining_chars = remaining_chars.saturating_sub(text.chars().count());
        let mut item = json!({
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": text}],
        });
        if let Some(turn_id) = event.turn_id.as_deref() {
            item["turnId"] = json!(turn_id);
        }
        selected.push(item);
    }
    selected.reverse();
    let mut history = selected;
    history.push(json!({
        "type": "message",
        "role": "user",
        "content": [{
            "type": "input_text",
            "text": summary
        }],
    }));
    history
}

fn next_compaction_window_number(
    events: &[AgentEvent],
    previous_window: Option<&CompactionWindow>,
) -> u64 {
    previous_window
        .map(|window| window.window_number.saturating_add(1))
        .unwrap_or_else(|| existing_compaction_count(events).saturating_add(1))
}

fn existing_compaction_count(events: &[AgentEvent]) -> u64 {
    events
        .iter()
        .filter(|event| event.event_type == "context.compaction.completed")
        .count() as u64
}

fn payload_text(payload: &Value) -> Option<String> {
    payload_string(payload, &["text"])
        .or_else(|| {
            payload
                .get("content")
                .and_then(|content| payload_string(content, &["text", "message"]))
        })
        .or_else(|| {
            payload
                .get("input")
                .and_then(|input| payload_string(input, &["text"]))
        })
        .map(str::to_string)
}

fn payload_string<'a>(payload: &'a Value, keys: &[&str]) -> Option<&'a str> {
    keys.iter()
        .filter_map(|key| payload.get(*key))
        .find_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut output = value.chars().take(max_chars).collect::<String>();
    if value.chars().count() > max_chars {
        output.push_str("\n[truncated]");
    }
    output
}

mod operation;

#[cfg(test)]
mod tests;
