use super::RuntimeCore;
use app_server_protocol::AgentEvent;
use serde_json::{json, Value};
use std::collections::HashMap;

/// Codex-compatible token counters for one usage sample.
///
/// The values are deliberately typed here instead of retaining the provider payload. A snapshot
/// is only emitted when every counter is present and non-negative, so callers cannot accidentally
/// replay a partial provider usage object as canonical state.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct TokenUsageSnapshot {
    pub input_tokens: i64,
    pub cached_input_tokens: i64,
    pub cache_write_input_tokens: i64,
    pub output_tokens: i64,
    pub reasoning_output_tokens: i64,
    pub total_tokens: i64,
}

impl TokenUsageSnapshot {
    fn saturating_add(&self, other: &Self) -> Self {
        Self {
            input_tokens: self.input_tokens.saturating_add(other.input_tokens),
            cached_input_tokens: self
                .cached_input_tokens
                .saturating_add(other.cached_input_tokens),
            cache_write_input_tokens: self
                .cache_write_input_tokens
                .saturating_add(other.cache_write_input_tokens),
            output_tokens: self.output_tokens.saturating_add(other.output_tokens),
            reasoning_output_tokens: self
                .reasoning_output_tokens
                .saturating_add(other.reasoning_output_tokens),
            total_tokens: self.total_tokens.saturating_add(other.total_tokens),
        }
    }
}

/// The latest complete thread usage snapshot available from the canonical event chain.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ThreadTokenUsageSnapshot {
    pub turn_id: String,
    pub total_token_usage: TokenUsageSnapshot,
    pub last_token_usage: TokenUsageSnapshot,
    pub model_context_window: Option<i64>,
    pub source_sequence: u64,
}

impl RuntimeCore {
    /// Read the latest complete token usage snapshot for a hydrated thread.
    ///
    /// `resume_thread` hydrates `StoredSession.events` from the canonical EventLog/Projection
    /// chain before callers reach this method. Missing or partial usage fails closed as `None`;
    /// this method never synthesizes totals from input/output counters.
    pub(crate) fn thread_token_usage_snapshot(
        &self,
        thread_id: &str,
    ) -> Option<ThreadTokenUsageSnapshot> {
        let thread_id = thread_id.trim();
        if thread_id.is_empty() {
            return None;
        }

        let state = self
            .state
            .lock()
            .expect("runtime core state mutex poisoned");
        state
            .sessions
            .values()
            .find(|stored| stored.session.thread_id == thread_id)
            .and_then(|stored| thread_token_usage_snapshot_from_events(&stored.events))
    }
}

/// Extract the latest complete usage snapshot from one contiguous canonical event slice.
pub(crate) fn thread_token_usage_snapshot_from_events(
    events: &[AgentEvent],
) -> Option<ThreadTokenUsageSnapshot> {
    let candidate = events
        .iter()
        .filter(|event| is_usage_event(event))
        .filter(|event| usage_container(event).is_some_and(Value::is_object))
        .max_by_key(|event| event.sequence)?;
    parse_usage_event(candidate, events)
}

/// Enrich one trusted runtime usage event with the cumulative Codex usage shape.
///
/// Provider counters remain available at their original flat keys for existing read-model
/// consumers. Only the main runtime backend is eligible for lowering; external/partial payloads
/// remain untouched and therefore continue to fail closed in the strict snapshot reader.
pub(crate) fn canonicalize_runtime_usage_event(
    event: &mut AgentEvent,
    previous_events: &[AgentEvent],
    pending_events: &[AgentEvent],
) {
    if !matches!(
        event.event_type.as_str(),
        "turn.completed" | "provider.usage"
    ) || event.payload.get("backend").and_then(Value::as_str) != Some("runtime")
        || strict_usage_parts(event).is_some()
    {
        return;
    }
    let Some(turn_id) = event
        .turn_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return;
    };
    let Some(sample) = usage_container(event).and_then(parse_flat_runtime_usage) else {
        return;
    };
    let model_context_window = event_context_window(event)
        .or_else(|| latest_context_window_across(previous_events, pending_events, turn_id));
    let (last, total) = if event.event_type == "turn.completed" {
        let total = latest_complete_total_before_turn(previous_events, pending_events, turn_id)
            .unwrap_or_default()
            .saturating_add(&sample);
        (sample, total)
    } else {
        let Some(attempt) = provider_usage_attempt(event) else {
            return;
        };
        let last = latest_turn_attempt_usage(
            previous_events,
            pending_events,
            turn_id,
            (event.sequence, attempt, sample),
        );
        let total = latest_complete_total_before_turn(previous_events, pending_events, turn_id)
            .unwrap_or_default()
            .saturating_add(&last);
        (last, total)
    };
    let Some(usage) = event
        .payload
        .get_mut("usage")
        .and_then(Value::as_object_mut)
    else {
        return;
    };
    usage.insert("total_token_usage".to_string(), usage_json(&total));
    usage.insert("last_token_usage".to_string(), usage_json(&last));
    if let Some(model_context_window) = model_context_window {
        usage.insert(
            "model_context_window".to_string(),
            json!(model_context_window),
        );
    }
}

pub(crate) fn goal_token_delta_since(
    last: &TokenUsageSnapshot,
    current: &TokenUsageSnapshot,
) -> i64 {
    let input_delta = current.input_tokens.saturating_sub(last.input_tokens);
    let cached_input_delta = current
        .cached_input_tokens
        .saturating_sub(last.cached_input_tokens);
    let output_delta = current.output_tokens.saturating_sub(last.output_tokens);
    input_delta
        .saturating_sub(cached_input_delta)
        .saturating_add(output_delta)
}

fn is_usage_event(event: &AgentEvent) -> bool {
    matches!(
        event.event_type.as_str(),
        "turn.completed"
            | "provider.usage"
            | "token.count"
            | "token_count"
            | "thread.token_usage"
            | "thread.token_usage.updated"
            | "usage.updated"
    )
}

fn usage_container(event: &AgentEvent) -> Option<&Value> {
    if event.event_type == "turn.completed" {
        return event.payload.get("usage");
    }
    event
        .payload
        .get("token_usage")
        .or_else(|| event.payload.get("tokenUsage"))
        .or_else(|| event.payload.get("usage"))
        .or_else(|| Some(&event.payload))
}

fn parse_usage_event(
    event: &AgentEvent,
    events: &[AgentEvent],
) -> Option<ThreadTokenUsageSnapshot> {
    let turn_id = event
        .turn_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_string();
    let container = usage_container(event)?.as_object()?;
    let total_token_usage = object_value(
        container,
        &["total_token_usage", "totalTokenUsage", "total"],
    )
    .and_then(parse_token_usage)?;
    let last_token_usage = object_value(container, &["last_token_usage", "lastTokenUsage", "last"])
        .and_then(parse_token_usage)?;
    let model_context_window = object_i64(
        container,
        &[
            "model_context_window",
            "modelContextWindow",
            "context_window",
            "contextWindow",
        ],
    )
    .or_else(|| {
        event.payload.as_object().and_then(|payload| {
            object_i64(payload, &["model_context_window", "modelContextWindow"])
        })
    })
    .or_else(|| latest_context_window(events, &turn_id));

    Some(ThreadTokenUsageSnapshot {
        turn_id,
        total_token_usage,
        last_token_usage,
        model_context_window,
        source_sequence: event.sequence,
    })
}

fn strict_usage_parts(event: &AgentEvent) -> Option<(TokenUsageSnapshot, TokenUsageSnapshot)> {
    let container = usage_container(event)?.as_object()?;
    let total = object_value(
        container,
        &["total_token_usage", "totalTokenUsage", "total"],
    )
    .and_then(parse_token_usage)?;
    let last = object_value(container, &["last_token_usage", "lastTokenUsage", "last"])
        .and_then(parse_token_usage)?;
    Some((total, last))
}

fn parse_flat_runtime_usage(value: &Value) -> Option<TokenUsageSnapshot> {
    let object = value.as_object()?;
    let input_tokens = object_i64(object, &["input_tokens", "inputTokens"])?;
    let output_tokens = object_i64(object, &["output_tokens", "outputTokens"])?;
    let cached_input_tokens =
        object_i64(object, &["cached_input_tokens", "cachedInputTokens"]).unwrap_or_default();
    let cache_write_input_tokens = object_i64(
        object,
        &[
            "cache_write_input_tokens",
            "cacheWriteInputTokens",
            "cache_creation_input_tokens",
            "cacheCreationInputTokens",
        ],
    )
    .unwrap_or_default();
    let reasoning_output_tokens = object_i64(
        object,
        &[
            "reasoning_output_tokens",
            "reasoningOutputTokens",
            "reasoning_tokens",
            "reasoningTokens",
        ],
    )
    .unwrap_or_default();
    Some(TokenUsageSnapshot {
        input_tokens,
        cached_input_tokens,
        cache_write_input_tokens,
        output_tokens,
        reasoning_output_tokens,
        total_tokens: input_tokens.saturating_add(output_tokens),
    })
}

fn latest_complete_total_before_turn(
    previous_events: &[AgentEvent],
    pending_events: &[AgentEvent],
    turn_id: &str,
) -> Option<TokenUsageSnapshot> {
    previous_events
        .iter()
        .chain(pending_events)
        .filter(|event| event.turn_id.as_deref() != Some(turn_id))
        .filter_map(|event| strict_usage_parts(event).map(|(total, _)| (event.sequence, total)))
        .max_by_key(|(sequence, _)| *sequence)
        .map(|(_, total)| total)
}

fn latest_turn_attempt_usage(
    previous_events: &[AgentEvent],
    pending_events: &[AgentEvent],
    turn_id: &str,
    current: (u64, u32, TokenUsageSnapshot),
) -> TokenUsageSnapshot {
    let mut latest = HashMap::<u32, (u64, TokenUsageSnapshot)>::new();
    for event in previous_events
        .iter()
        .chain(pending_events)
        .filter(|event| event.event_type == "provider.usage")
        .filter(|event| event.turn_id.as_deref() == Some(turn_id))
        .filter(|event| event.payload.get("backend").and_then(Value::as_str) == Some("runtime"))
    {
        let Some(attempt) = provider_usage_attempt(event) else {
            continue;
        };
        let Some(usage) = usage_container(event).and_then(parse_flat_runtime_usage) else {
            continue;
        };
        replace_attempt_snapshot(&mut latest, event.sequence, attempt, usage);
    }
    replace_attempt_snapshot(&mut latest, current.0, current.1, current.2);
    latest
        .into_values()
        .fold(TokenUsageSnapshot::default(), |total, (_, usage)| {
            total.saturating_add(&usage)
        })
}

fn replace_attempt_snapshot(
    latest: &mut HashMap<u32, (u64, TokenUsageSnapshot)>,
    sequence: u64,
    attempt: u32,
    usage: TokenUsageSnapshot,
) {
    if latest
        .get(&attempt)
        .is_some_and(|(existing_sequence, _)| *existing_sequence > sequence)
    {
        return;
    }
    latest.insert(attempt, (sequence, usage));
}

fn provider_usage_attempt(event: &AgentEvent) -> Option<u32> {
    event
        .payload
        .get("attempt")
        .and_then(Value::as_u64)
        .and_then(|attempt| u32::try_from(attempt).ok())
}

fn usage_json(usage: &TokenUsageSnapshot) -> Value {
    json!({
        "input_tokens": usage.input_tokens,
        "cached_input_tokens": usage.cached_input_tokens,
        "cache_write_input_tokens": usage.cache_write_input_tokens,
        "output_tokens": usage.output_tokens,
        "reasoning_output_tokens": usage.reasoning_output_tokens,
        "total_tokens": usage.total_tokens,
    })
}

fn parse_token_usage(value: &Value) -> Option<TokenUsageSnapshot> {
    let object = value.as_object()?;
    Some(TokenUsageSnapshot {
        input_tokens: object_i64(object, &["input_tokens", "inputTokens"])?,
        cached_input_tokens: object_i64(object, &["cached_input_tokens", "cachedInputTokens"])?,
        output_tokens: object_i64(object, &["output_tokens", "outputTokens"])?,
        cache_write_input_tokens: object_i64(
            object,
            &["cache_write_input_tokens", "cacheWriteInputTokens"],
        )
        .unwrap_or_default(),
        reasoning_output_tokens: object_i64(
            object,
            &[
                "reasoning_output_tokens",
                "reasoningOutputTokens",
                "reasoning_tokens",
                "reasoningTokens",
            ],
        )?,
        total_tokens: object_i64(object, &["total_tokens", "totalTokens"])?,
    })
}

fn latest_context_window(events: &[AgentEvent], turn_id: &str) -> Option<i64> {
    events
        .iter()
        .filter(|event| event.event_type == "turn.context")
        .filter(|event| event.turn_id.as_deref() == Some(turn_id))
        .max_by_key(|event| event.sequence)
        .and_then(|event| {
            event
                .payload
                .as_object()
                .and_then(|payload| {
                    object_i64(payload, &["model_context_window", "modelContextWindow"])
                })
                .or_else(|| {
                    event
                        .payload
                        .get("runtime")
                        .and_then(Value::as_object)
                        .and_then(|runtime| {
                            object_i64(runtime, &["model_context_window", "modelContextWindow"])
                        })
                })
                .or_else(|| {
                    event
                        .payload
                        .get("context_policy")
                        .and_then(Value::as_object)
                        .and_then(|policy| {
                            object_i64(policy, &["model_context_window", "modelContextWindow"])
                        })
                })
        })
}

fn latest_context_window_across(
    previous_events: &[AgentEvent],
    pending_events: &[AgentEvent],
    turn_id: &str,
) -> Option<i64> {
    previous_events
        .iter()
        .chain(pending_events)
        .filter(|event| event.event_type == "turn.context")
        .filter(|event| event.turn_id.as_deref() == Some(turn_id))
        .max_by_key(|event| event.sequence)
        .and_then(context_window_from_context_event)
}

fn event_context_window(event: &AgentEvent) -> Option<i64> {
    event
        .payload
        .as_object()
        .and_then(|payload| object_i64(payload, &["model_context_window", "modelContextWindow"]))
        .or_else(|| {
            usage_container(event)
                .and_then(Value::as_object)
                .and_then(|usage| {
                    object_i64(usage, &["model_context_window", "modelContextWindow"])
                })
        })
}

fn context_window_from_context_event(event: &AgentEvent) -> Option<i64> {
    event
        .payload
        .as_object()
        .and_then(|payload| object_i64(payload, &["model_context_window", "modelContextWindow"]))
        .or_else(|| {
            event
                .payload
                .get("runtime")
                .and_then(Value::as_object)
                .and_then(|runtime| {
                    object_i64(runtime, &["model_context_window", "modelContextWindow"])
                })
        })
        .or_else(|| {
            event
                .payload
                .get("context_policy")
                .and_then(Value::as_object)
                .and_then(|policy| {
                    object_i64(policy, &["model_context_window", "modelContextWindow"])
                })
        })
        .or_else(|| {
            event
                .payload
                .pointer("/context_summary/memory_budget/max_tokens")
                .or_else(|| {
                    event
                        .payload
                        .pointer("/contextSummary/memoryBudget/maxTokens")
                })
                .and_then(Value::as_i64)
                .filter(|value| *value > 0)
        })
}

fn object_value<'a>(
    object: &'a serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<&'a Value> {
    keys.iter().find_map(|key| object.get(*key))
}

fn object_i64(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<i64> {
    object_value(object, keys)
        .and_then(Value::as_i64)
        .filter(|value| *value >= 0)
}

#[cfg(test)]
mod tests;
