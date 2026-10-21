use super::*;
use agent_protocol::{AgentInput, ThreadItem, ThreadItemPayload};

/// Prepare a portable copy without changing the live projection or its sidecar ownership.
pub(super) fn portable_history(
    changes: &ThreadHistoryChangeSet,
    events: &[AgentEvent],
    sidecar_store: Option<&super::super::SidecarStore>,
    session_id: &str,
) -> Result<(ThreadHistoryChangeSet, Vec<AgentEvent>), String> {
    let mut changes = changes.clone();
    for item in &mut changes.changed_items {
        inline_item(item, sidecar_store, session_id)?;
    }
    let mut events = events.to_vec();
    for event in &mut events {
        if super::super::turn_input_events::is_provider_input_event(event)
            || super::super::turn_input_events::is_turn_input_event(event)
        {
            if let Some(input) = event.payload.get_mut("input") {
                let mut parts: Vec<AgentInput> = serde_json::from_value(input.clone())
                    .map_err(|error| format!("invalid rollout input: {error}"))?;
                inline_input(&mut parts, sidecar_store, session_id)?;
                *input = serde_json::to_value(parts).map_err(|error| error.to_string())?;
            }
        }
        if let Some(value) = event.payload.get_mut("item") {
            if let Ok(mut item) = serde_json::from_value::<ThreadItem>(value.clone()) {
                inline_item(&mut item, sidecar_store, session_id)?;
                *value = serde_json::to_value(item).map_err(|error| error.to_string())?;
            }
        }
    }
    Ok((changes, events))
}

fn inline_item(
    item: &mut ThreadItem,
    store: Option<&super::super::SidecarStore>,
    session_id: &str,
) -> Result<(), String> {
    if let ThreadItemPayload::UserMessage { content, .. } = &mut item.payload {
        inline_input(content, store, session_id)?;
    }
    Ok(())
}

fn inline_input(
    input: &mut [AgentInput],
    store: Option<&super::super::SidecarStore>,
    session_id: &str,
) -> Result<(), String> {
    super::super::input_media::inline_canonical_input_media(input, store, session_id)
}
