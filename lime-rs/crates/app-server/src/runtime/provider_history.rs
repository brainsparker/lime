//! App Server current event store 到 provider transcript 的投影。
//!
//! Codex 的 history 是有序 response item，而不是 UI 聚合后的消息文本。本模块直接从
//! RuntimeCore 已持久化的 user/message/tool 事件恢复 provider 所需的最小 item 顺序，
//! 避免任何旧 session 或 provider adapter 参与多轮采样。

mod canonical;
mod model_history;

#[cfg(test)]
mod boundary_tests;

#[cfg(test)]
mod continuation_tests;

use super::StoredSession;
use agent_protocol::{AgentInput, ThreadItem};
use agent_runtime::reply_input::{RuntimeReplyInput, RuntimeReplyInputPart};
use app_server_protocol::AgentEvent;
use model_provider::current_client::{
    CurrentProviderContent, CurrentProviderMessage, CurrentProviderRole,
};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProviderRouteIdentity {
    provider: String,
    model: String,
}

#[derive(Debug, Clone, Default)]
pub struct ProviderTurnHistory {
    messages: Vec<CurrentProviderMessage>,
    previous_route: Option<ProviderRouteIdentity>,
}

impl ProviderTurnHistory {
    pub fn messages_for_route(&self, provider: &str, model: &str) -> Vec<CurrentProviderMessage> {
        let mut messages = self.messages.clone();
        let Some(previous) = self.previous_route.as_ref() else {
            return messages;
        };
        let current = ProviderRouteIdentity {
            provider: provider.to_string(),
            model: model.to_string(),
        };
        if previous != &current {
            messages.push(model_switch_message(previous, &current));
        }
        messages
    }

    #[cfg(test)]
    pub(crate) fn into_messages(self) -> Vec<CurrentProviderMessage> {
        self.messages
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }
}

/// Current turn input is supplied separately to the provider. It remains durable and visible in
/// the canonical Item log, but must not be submitted twice in the same provider request.
#[cfg(test)]
pub(in crate::runtime) fn provider_history_excluding_current_turn_input(
    stored: &StoredSession,
    sidecar_store: Option<&super::SidecarStore>,
    turn_id: &str,
) -> Result<Vec<CurrentProviderMessage>, super::RuntimeCoreError> {
    let history =
        provider_turn_history_excluding_current_turn_input(stored, sidecar_store, turn_id)?;
    let Some(current) = current_turn_provider_route(stored, turn_id) else {
        return Ok(history.into_messages());
    };
    Ok(history.messages_for_route(&current.provider, &current.model))
}

pub(in crate::runtime) fn provider_turn_history_excluding_current_turn_input(
    stored: &StoredSession,
    sidecar_store: Option<&super::SidecarStore>,
    turn_id: &str,
) -> Result<ProviderTurnHistory, super::RuntimeCoreError> {
    let effective_events = super::history_replacement::effective_events(&stored.events);
    let (replacement_history, events) = provider_history_source(&effective_events);
    let events = events
        .into_iter()
        .filter(|event| {
            event.turn_id.as_deref() != Some(turn_id)
                || (!super::turn_input_events::is_provider_input_event(event)
                    && event.event_type
                        != super::rollout_budget::ROLLOUT_BUDGET_REMINDER_EVENT_TYPE)
        })
        .collect::<Vec<_>>();
    let mut messages = replacement_history.unwrap_or_default();
    messages.extend(
        messages_from_events_with_provider_input(&events, |input| {
            RuntimeReplyInput::try_from_user_parts(input, |media| {
                super::input_media::resolve_runtime_input_media(
                    media,
                    sidecar_store,
                    &stored.session.session_id,
                )
            })
            .map_err(|error| error.to_string())
        })
        .map_err(super::RuntimeCoreError::Backend)?,
    );
    Ok(ProviderTurnHistory {
        messages,
        previous_route: latest_completed_provider_route(&effective_events, turn_id),
    })
}

fn model_switch_message(
    previous: &ProviderRouteIdentity,
    current: &ProviderRouteIdentity,
) -> CurrentProviderMessage {
    CurrentProviderMessage::developer(vec![CurrentProviderContent::Text(render_model_switch(
        previous, current,
    ))])
}

fn latest_completed_provider_route(
    events: &[AgentEvent],
    current_turn_id: &str,
) -> Option<ProviderRouteIdentity> {
    for terminal in events.iter().rev().filter(|event| {
        event.event_type == "turn.completed" && event.turn_id.as_deref() != Some(current_turn_id)
    }) {
        let Some(turn_id) = terminal.turn_id.as_deref() else {
            continue;
        };
        if let Some(route) = events
            .iter()
            .rev()
            .find(|event| {
                event.event_type == "routing.decision.made"
                    && event.turn_id.as_deref() == Some(turn_id)
                    && event.sequence <= terminal.sequence
            })
            .and_then(provider_route_from_routing_event)
        {
            return Some(route);
        }
    }
    None
}

fn provider_route_from_routing_event(event: &AgentEvent) -> Option<ProviderRouteIdentity> {
    let decision = event
        .payload
        .get("routingDecision")
        .unwrap_or(&event.payload);
    provider_route_from_fields(decision, "selectedProvider", "selectedModel")
}

#[cfg(test)]
fn current_turn_provider_route(
    stored: &StoredSession,
    turn_id: &str,
) -> Option<ProviderRouteIdentity> {
    let route = stored
        .turn_runtime_options
        .get(turn_id)?
        .runtime_metadata()?
        .get("agentControlRoute")?;
    if route.get("schemaVersion").and_then(Value::as_u64) != Some(2) {
        return None;
    }
    provider_route_from_fields(route, "providerPreference", "modelPreference")
}

fn provider_route_from_fields(
    value: &Value,
    provider_key: &str,
    model_key: &str,
) -> Option<ProviderRouteIdentity> {
    let field = |key| {
        value
            .get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    };
    Some(ProviderRouteIdentity {
        provider: field(provider_key)?,
        model: field(model_key)?,
    })
}

fn render_model_switch(
    previous: &ProviderRouteIdentity,
    current: &ProviderRouteIdentity,
) -> String {
    format!(
        "<model_switch>\n\
The user was previously using a different model. Please continue the conversation according to the following instructions:\n\n\
Continue to follow the current system and developer instructions.\n\
<previous_route>\n  <provider>{}</provider>\n  <model>{}</model>\n</previous_route>\n\
<current_route>\n  <provider>{}</provider>\n  <model>{}</model>\n</current_route>\n\
</model_switch>",
        escape_xml_text(&previous.provider),
        escape_xml_text(&previous.model),
        escape_xml_text(&current.provider),
        escape_xml_text(&current.model),
    )
}

fn escape_xml_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn provider_history_source(
    events: &[AgentEvent],
) -> (Option<Vec<CurrentProviderMessage>>, Vec<AgentEvent>) {
    let Some(compaction) = events
        .iter()
        .rev()
        .find(|event| event.event_type == "context.compaction.completed")
    else {
        return (None, events.to_vec());
    };
    let replacement_history = replacement_history_from_compaction(compaction);
    let Ok(covered) = super::context_compaction::boundary::covered_sequence(compaction) else {
        return (None, events.to_vec());
    };
    if super::context_compaction::boundary::validate_snapshot_boundary(events, covered).is_err() {
        return (None, events.to_vec());
    }
    let Some(replacement_history) = replacement_history else {
        // An incomplete checkpoint must never discard durable history.
        return (None, events.to_vec());
    };
    (
        Some(replacement_history),
        events
            .iter()
            .filter(|event| event.sequence > covered)
            .cloned()
            .collect(),
    )
}

fn replacement_history_from_compaction(event: &AgentEvent) -> Option<Vec<CurrentProviderMessage>> {
    let field = |name: &str| {
        event
            .payload
            .get("artifact")
            .filter(|value| value.is_object())
            .and_then(|artifact| artifact.get(name))
            .or_else(|| event.payload.get(name))
    };
    if field("windowNumber").and_then(Value::as_u64).is_none()
        || field("firstWindowId").and_then(Value::as_str).is_none()
        || field("windowId").and_then(Value::as_str).is_none()
    {
        return None;
    }
    let replacement_history = field("replacementHistory")?.as_array()?;
    replacement_history
        .iter()
        .map(provider_message_from_replacement_item)
        .collect()
}

fn provider_message_from_replacement_item(item: &Value) -> Option<CurrentProviderMessage> {
    let role = match item.get("role").and_then(Value::as_str)? {
        "user" => CurrentProviderRole::User,
        "developer" => CurrentProviderRole::Developer,
        "assistant" => CurrentProviderRole::Assistant,
        "tool" => CurrentProviderRole::Tool,
        _ => return None,
    };
    let content = replacement_content(item.get("content")?)?;
    Some(CurrentProviderMessage {
        producer: None,
        role,
        content,
    })
}

fn replacement_content(value: &Value) -> Option<Vec<CurrentProviderContent>> {
    if let Some(text) = value.as_str().filter(|text| !text.is_empty()) {
        return Some(vec![CurrentProviderContent::Text(text.to_string())]);
    }
    let parts = value.as_array()?;
    let mut content = Vec::with_capacity(parts.len());
    for part in parts {
        let text = part
            .as_str()
            .or_else(|| part.get("text").and_then(Value::as_str))
            .filter(|text| !text.is_empty())?;
        content.push(CurrentProviderContent::Text(text.to_string()));
    }
    (!content.is_empty()).then_some(content)
}

#[cfg(test)]
fn messages_from_events(events: &[AgentEvent]) -> Vec<CurrentProviderMessage> {
    messages_from_events_with_provider_input(events, |input| {
        RuntimeReplyInput::try_from_user_parts(input, |media| {
            let (uri, detail) = match media {
                agent_runtime::reply_input::RuntimeReplyInputMedia::Image { uri, detail }
                | agent_runtime::reply_input::RuntimeReplyInputMedia::LocalImage {
                    path: uri,
                    detail,
                } => (uri, detail),
            };
            Ok::<_, String>(agent_runtime::reply_input::RuntimeReplyInputImage {
                uri: uri.clone(),
                media_type: "image/*".to_string(),
                provider_data: uri.starts_with("data:").then(|| uri.clone()),
                detail,
            })
        })
        .map_err(|error| error.to_string())
    })
    .expect("identity provider input projection cannot fail")
}

fn messages_from_events_with_provider_input<G>(
    events: &[AgentEvent],
    mut provider_input: G,
) -> Result<Vec<CurrentProviderMessage>, String>
where
    G: FnMut(Vec<AgentInput>) -> Result<RuntimeReplyInput, String>,
{
    let mut messages = Vec::new();
    let mut assistant_content = Vec::new();
    let mut assistant_text_by_item = HashMap::new();
    let mut tool_results = Vec::new();
    let mut history = model_history::ModelHistoryProjection::from_events(events)?;

    for event in events {
        if let Some(message) = history.take(event) {
            flush_assistant(
                &mut messages,
                &mut assistant_content,
                &mut assistant_text_by_item,
            );
            flush_tool_results(&mut messages, &mut tool_results);
            messages.push(message);
            continue;
        }
        match event.event_type.as_str() {
            "provider.step" => {
                flush_assistant(
                    &mut messages,
                    &mut assistant_content,
                    &mut assistant_text_by_item,
                );
                flush_tool_results(&mut messages, &mut tool_results);
            }
            super::thread_fork::FORK_CANONICAL_ITEM_EVENT_TYPE => {
                let item = serde_json::from_value::<ThreadItem>(
                    event.payload.get("item").cloned().ok_or_else(|| {
                        format!(
                            "fork canonical history event {} omitted item",
                            event.event_id
                        )
                    })?,
                )
                .map_err(|error| {
                    format!(
                        "fork canonical history event {} has invalid item: {error}",
                        event.event_id
                    )
                })?;
                if history.has_fork_item(event, &item) {
                    continue;
                }
                canonical::append_fork_item(
                    &item,
                    &mut messages,
                    &mut assistant_content,
                    &mut assistant_text_by_item,
                    &mut tool_results,
                    &mut provider_input,
                )?;
            }
            super::thread_fork::FORK_INTERRUPTED_MARKER_EVENT_TYPE => {
                flush_assistant(
                    &mut messages,
                    &mut assistant_content,
                    &mut assistant_text_by_item,
                );
                flush_tool_results(&mut messages, &mut tool_results);
                let text = event
                    .payload
                    .get("text")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|text| !text.is_empty())
                    .ok_or_else(|| {
                        format!(
                            "fork interrupted marker {} omitted developer text",
                            event.event_id
                        )
                    })?;
                messages.push(CurrentProviderMessage::developer(vec![
                    CurrentProviderContent::Text(text.to_string()),
                ]));
            }
            super::thread_guardian::GUARDIAN_APPROVAL_EVENT_TYPE => {
                flush_assistant(
                    &mut messages,
                    &mut assistant_content,
                    &mut assistant_text_by_item,
                );
                flush_tool_results(&mut messages, &mut tool_results);
                let text = event
                    .payload
                    .get("text")
                    .and_then(Value::as_str)
                    .filter(|text| !text.trim().is_empty())
                    .ok_or_else(|| {
                        format!(
                            "Guardian approval event {} omitted developer text",
                            event.event_id
                        )
                    })?;
                messages.push(CurrentProviderMessage::developer(vec![
                    CurrentProviderContent::Text(text.to_string()),
                ]));
            }
            super::rollout_budget::ROLLOUT_BUDGET_REMINDER_EVENT_TYPE => {
                flush_assistant(
                    &mut messages,
                    &mut assistant_content,
                    &mut assistant_text_by_item,
                );
                flush_tool_results(&mut messages, &mut tool_results);
                let text = event
                    .payload
                    .get("text")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|text| !text.is_empty())
                    .ok_or_else(|| {
                        format!(
                            "rollout budget reminder event {} omitted developer text",
                            event.event_id
                        )
                    })?;
                messages.push(CurrentProviderMessage::developer(vec![
                    CurrentProviderContent::Text(text.to_string()),
                ]));
            }
            super::thread_inject_items::RESPONSE_ITEM_INJECTED_EVENT_TYPE => {
                flush_assistant(
                    &mut messages,
                    &mut assistant_content,
                    &mut assistant_text_by_item,
                );
                flush_tool_results(&mut messages, &mut tool_results);
                let item = event.payload.get("item").cloned().ok_or_else(|| {
                    format!(
                        "injected response item event {} omitted item",
                        event.event_id
                    )
                })?;
                let parsed = serde_json::from_value::<agent_protocol::ResponseItem>(item.clone())
                    .map_err(|error| {
                    format!(
                        "injected response item event {} is invalid: {error}",
                        event.event_id
                    )
                })?;
                if parsed.contains_remote_image_url() {
                    return Err(format!(
                        "injected response item event {} contains a remote image URL",
                        event.event_id
                    ));
                }
                messages.push(CurrentProviderMessage::raw_response_item(item));
            }
            "message.created" | "thread.goal.continuation" | "review.input" => {
                flush_assistant(
                    &mut messages,
                    &mut assistant_content,
                    &mut assistant_text_by_item,
                );
                flush_tool_results(&mut messages, &mut tool_results);
                if let Some(message) = user_message_from_event(event, &mut provider_input)? {
                    messages.push(message);
                }
            }
            "message.delta" | "message.delta_batch" | "message.batch" => {
                if history.has_completed(event, &message_item_key(event)) {
                    continue;
                }
                flush_tool_results(&mut messages, &mut tool_results);
                if let Some(text) = text_from_payload(&event.payload) {
                    assistant_text_by_item
                        .entry(message_item_key(event))
                        .or_insert_with(String::new)
                        .push_str(&text);
                    assistant_content.push(CurrentProviderContent::Text(text));
                }
            }
            "message.completed" => {
                if history.has_completed(event, &message_item_key(event)) {
                    continue;
                }
                flush_tool_results(&mut messages, &mut tool_results);
                if let Some(snapshot) = text_from_payload(&event.payload) {
                    append_completed_message_snapshot(
                        &mut assistant_content,
                        &mut assistant_text_by_item,
                        message_item_key(event),
                        snapshot,
                    );
                }
            }
            "reasoning.delta" => {
                if history.has_completed(event, &message_item_key(event)) {
                    continue;
                }
                flush_tool_results(&mut messages, &mut tool_results);
                if let Some(text) = text_from_payload(&event.payload) {
                    assistant_content.push(CurrentProviderContent::Reasoning(text));
                }
            }
            "item.started" => {
                if let Some(call) = canonical::tool_call_from_event(event) {
                    if history.has_call(event, &call.id) {
                        continue;
                    }
                    flush_tool_results(&mut messages, &mut tool_results);
                    assistant_content.push(CurrentProviderContent::ToolCall(call));
                }
            }
            "item.completed" => {
                if let Some(result) = canonical::tool_result_from_event(event) {
                    if history.has_output(event, &result.call_id) {
                        continue;
                    }
                    flush_assistant(
                        &mut messages,
                        &mut assistant_content,
                        &mut assistant_text_by_item,
                    );
                    tool_results.push(CurrentProviderContent::ToolResult(result));
                }
            }
            _ => {}
        }
    }

    flush_assistant(
        &mut messages,
        &mut assistant_content,
        &mut assistant_text_by_item,
    );
    flush_tool_results(&mut messages, &mut tool_results);
    Ok(messages)
}

fn flush_assistant(
    messages: &mut Vec<CurrentProviderMessage>,
    assistant_content: &mut Vec<CurrentProviderContent>,
    assistant_text_by_item: &mut HashMap<String, String>,
) {
    if assistant_content.is_empty() {
        assistant_text_by_item.clear();
        return;
    }
    messages.push(CurrentProviderMessage::assistant(std::mem::take(
        assistant_content,
    )));
    assistant_text_by_item.clear();
}

fn append_completed_message_snapshot(
    assistant_content: &mut Vec<CurrentProviderContent>,
    assistant_text_by_item: &mut HashMap<String, String>,
    item_key: String,
    snapshot: String,
) {
    let aggregate = assistant_content
        .iter()
        .filter_map(|content| match content {
            CurrentProviderContent::Text(text) => Some(text.as_str()),
            _ => None,
        })
        .collect::<String>();
    if snapshot == aggregate || aggregate.starts_with(&snapshot) {
        return;
    }
    if !aggregate.is_empty() && snapshot.starts_with(&aggregate) {
        assistant_content.push(CurrentProviderContent::Text(
            snapshot[aggregate.len()..].to_string(),
        ));
        assistant_text_by_item.insert(item_key, snapshot);
        return;
    }

    let accumulated = assistant_text_by_item.entry(item_key).or_default();
    let suffix = if accumulated.is_empty() {
        snapshot.as_str()
    } else if snapshot == *accumulated || accumulated.starts_with(&snapshot) {
        ""
    } else if snapshot.starts_with(accumulated.as_str()) {
        &snapshot[accumulated.len()..]
    } else {
        snapshot.as_str()
    };
    if !suffix.is_empty() {
        assistant_content.push(CurrentProviderContent::Text(suffix.to_string()));
    }
    if accumulated.is_empty() || snapshot.starts_with(accumulated.as_str()) {
        *accumulated = snapshot;
    } else if !accumulated.starts_with(&snapshot) {
        accumulated.push_str(&snapshot);
    }
}

fn message_item_key(event: &AgentEvent) -> String {
    let payload = provider_event_payload(&event.payload);
    ["itemId", "item_id", "messageId", "message_id", "id"]
        .iter()
        .find_map(|key| payload.get(*key).and_then(Value::as_str))
        .or_else(|| event.turn_id.as_deref())
        .unwrap_or(event.event_id.as_str())
        .to_string()
}

fn flush_tool_results(
    messages: &mut Vec<CurrentProviderMessage>,
    tool_results: &mut Vec<CurrentProviderContent>,
) {
    if tool_results.is_empty() {
        return;
    }
    messages.push(CurrentProviderMessage::tool(std::mem::take(tool_results)));
}

fn user_message_from_event<G>(
    event: &AgentEvent,
    provider_input: &mut G,
) -> Result<Option<CurrentProviderMessage>, String>
where
    G: FnMut(Vec<AgentInput>) -> Result<RuntimeReplyInput, String>,
{
    let input = event
        .payload
        .get("input")
        .cloned()
        .and_then(|value| serde_json::from_value::<Vec<AgentInput>>(value).ok())
        .or_else(|| {
            let text = event
                .payload
                .get("content")
                .and_then(|content| content.get("text").or_else(|| content.get("message")))
                .and_then(Value::as_str)
                .or_else(|| event.payload.get("text").and_then(Value::as_str))?
                .to_string();
            Some(vec![AgentInput::text(text)])
        });
    let Some(input) = input else {
        return Ok(None);
    };
    let input = provider_input(input)?;
    Ok(user_message_from_input(&input))
}

fn user_message_from_input(input: &RuntimeReplyInput) -> Option<CurrentProviderMessage> {
    let mut content = Vec::new();
    for part in &input.parts {
        match part {
            RuntimeReplyInputPart::Text { text, .. } if !text.trim().is_empty() => {
                content.push(CurrentProviderContent::Text(text.clone()));
            }
            RuntimeReplyInputPart::Image(image) => {
                content.push(CurrentProviderContent::Image {
                    uri: image.uri.clone(),
                    media_type: image.media_type.clone(),
                    provider_data: image.provider_data.clone(),
                    detail: image.detail,
                });
            }
            RuntimeReplyInputPart::Text { .. }
            | RuntimeReplyInputPart::Skill { .. }
            | RuntimeReplyInputPart::Mention { .. } => {}
        }
    }
    (!content.is_empty()).then(|| CurrentProviderMessage::user(content))
}

fn provider_event_payload(payload: &Value) -> &Value {
    payload.get("runtimeEvent").unwrap_or(payload)
}

fn text_from_payload(payload: &Value) -> Option<String> {
    text_from_message_value(provider_event_payload(payload))
}

fn text_from_message_value(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str().filter(|text| !text.is_empty()) {
        return Some(text.to_string());
    }
    if let Some(text) = [
        "text",
        "delta",
        "content",
        "message",
        "outputText",
        "output_text",
    ]
    .iter()
    .find_map(|key| value.get(*key).and_then(Value::as_str))
    .filter(|text| !text.is_empty())
    {
        return Some(text.to_string());
    }
    if let Some(text) = value
        .get("content")
        .and_then(|content| text_from_message_value(content))
    {
        return Some(text);
    }
    for key in ["deltas", "messages", "items", "parts", "content"] {
        let Some(values) = value.get(key).and_then(Value::as_array) else {
            continue;
        };
        let text = values
            .iter()
            .filter_map(text_from_message_value)
            .collect::<String>();
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

#[cfg(test)]
mod tests;
