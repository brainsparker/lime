use super::super::{input_media, SidecarStore};
use super::*;

pub(super) fn inline_ephemeral_fork_media(
    history: &mut ForkHistory,
    stored: &mut StoredSession,
    sidecar_store: Option<&SidecarStore>,
    source_session_id: &str,
) -> Result<(), RuntimeCoreError> {
    for item in history
        .changes
        .iter_mut()
        .flat_map(|changes| &mut changes.changed_items)
    {
        let ThreadItemPayload::UserMessage { content, .. } = &mut item.payload else {
            continue;
        };
        input_media::inline_canonical_input_media(content, sidecar_store, source_session_id)
            .map_err(RuntimeCoreError::Backend)?;
    }
    for input in stored.turn_inputs.values_mut() {
        input_media::inline_canonical_input_media(input, sidecar_store, source_session_id)
            .map_err(RuntimeCoreError::Backend)?;
    }
    for event in &mut stored.events {
        if event.event_type == FORK_CANONICAL_ITEM_EVENT_TYPE {
            if let Some(item) = history
                .changes
                .iter()
                .flat_map(|changes| &changes.changed_items)
                .find(|item| item.sequence == event.sequence)
            {
                event.payload["item"] =
                    serde_json::to_value(item).map_err(|error| invalid(error.to_string()))?;
            }
        } else if event.event_type == agent_runtime::model_history::MODEL_HISTORY_EVENT_TYPE {
            let record: agent_runtime::model_history::ModelHistoryRecord =
                serde_json::from_value(event.payload.clone())
                    .map_err(|error| invalid(error.to_string()))?;
            // The current schema admits text-only user records. Images are owned by
            // canonical UserMessage input, never by an invented model-record variant.
            record.into_message().map_err(invalid)?;
        }
    }
    Ok(())
}

pub(super) fn copy_fork_input_media(
    history: &ForkHistory,
    sidecar_store: Option<&SidecarStore>,
    source_session_id: &str,
    target_session_id: &str,
) -> Result<(), RuntimeCoreError> {
    for item in history
        .changes
        .iter()
        .flat_map(|changes| changes.changed_items.iter())
    {
        let ThreadItemPayload::UserMessage { content, .. } = &item.payload else {
            continue;
        };
        input_media::copy_canonical_input_media_for_fork(
            content,
            sidecar_store,
            source_session_id,
            target_session_id,
        )
        .map_err(RuntimeCoreError::Backend)?;
    }
    Ok(())
}

pub(super) fn clear_fork_sidecar(sidecar_store: Option<&SidecarStore>, target_session_id: &str) {
    if let Some(store) = sidecar_store {
        let _ = store.clear_session(target_session_id);
    }
}
