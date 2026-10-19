use super::*;
use agent_runtime::model_history::{ModelHistoryRecord, MODEL_HISTORY_EVENT_TYPE};
use std::collections::HashSet;

pub(super) struct ModelHistoryProjection {
    records: HashMap<String, CurrentProviderMessage>,
    calls: HashSet<(Option<String>, String)>,
    outputs: HashSet<(Option<String>, String)>,
    completed: HashSet<(Option<String>, String)>,
}

impl ModelHistoryProjection {
    pub(super) fn from_events(events: &[AgentEvent]) -> Result<Self, String> {
        let mut projection = Self {
            records: HashMap::new(),
            calls: HashSet::new(),
            outputs: HashSet::new(),
            completed: HashSet::new(),
        };
        for event in events
            .iter()
            .filter(|event| event.event_type == MODEL_HISTORY_EVENT_TYPE)
        {
            let record = serde_json::from_value::<ModelHistoryRecord>(event.payload.clone())
                .map_err(|error| {
                    format!("invalid model tool history {}: {error}", event.event_id)
                })?;
            if let Some(source) = record.metadata.source_item_id.as_ref() {
                projection
                    .completed
                    .insert((event.turn_id.clone(), source.clone()));
            }
            let message = record.into_message()?;
            for content in &message.content {
                match content {
                    CurrentProviderContent::ToolCall(call) => {
                        projection
                            .calls
                            .insert((event.turn_id.clone(), call.id.clone()));
                    }
                    CurrentProviderContent::CustomToolCall(call) => {
                        projection
                            .calls
                            .insert((event.turn_id.clone(), call.id.clone()));
                    }
                    CurrentProviderContent::ToolResult(result)
                    | CurrentProviderContent::CustomToolResult(result) => {
                        projection
                            .outputs
                            .insert((event.turn_id.clone(), result.call_id.clone()));
                    }
                    _ => {}
                }
            }
            projection.records.insert(event.event_id.clone(), message);
        }
        Ok(projection)
    }

    pub(super) fn take(&mut self, event: &AgentEvent) -> Option<CurrentProviderMessage> {
        self.records.remove(&event.event_id)
    }

    pub(super) fn has_completed(&self, event: &AgentEvent, item_id: &str) -> bool {
        self.completed
            .contains(&(event.turn_id.clone(), item_id.to_string()))
    }

    pub(super) fn has_call(&self, event: &AgentEvent, call_id: &str) -> bool {
        self.calls
            .contains(&(event.turn_id.clone(), call_id.to_string()))
    }

    pub(super) fn has_fork_item(&self, event: &AgentEvent, item: &ThreadItem) -> bool {
        self.has_completed(event, item.item_id.as_str())
            || canonical::tool_call_from_event(&AgentEvent {
                event_type: "item.started".to_string(),
                payload: serde_json::json!({"item": item}),
                ..event.clone()
            })
            .is_some_and(|call| self.has_call(event, &call.id))
    }

    pub(super) fn has_output(&self, event: &AgentEvent, call_id: &str) -> bool {
        self.outputs
            .contains(&(event.turn_id.clone(), call_id.to_string()))
    }
}
