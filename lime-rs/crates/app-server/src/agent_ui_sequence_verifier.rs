use agent_protocol::{ThreadItem, ThreadItemPayload};
use app_server_protocol::AgentEvent;
use serde_json::Value;
use std::collections::HashMap;
use std::collections::HashSet;

#[derive(Default)]
struct TurnState {
    active_tools: HashMap<String, String>,
    active_actions: HashMap<String, String>,
    active_patches: HashMap<String, String>,
    active_commands: HashMap<String, String>,
    active_tests: HashMap<String, String>,
    terminal: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SequenceViolation {
    code: &'static str,
    event_id: String,
    scope_id: Option<String>,
}

#[cfg(test)]
pub(crate) fn validate_agent_event_sequence(
    existing_events: &[AgentEvent],
    candidate: &AgentEvent,
) -> Result<(), String> {
    let mut validator = AgentEventSequenceValidator::from_events(
        existing_events,
        &candidate.session_id,
        candidate.turn_id.as_deref(),
    );
    validator.validate_and_observe(candidate)
}

pub(crate) struct AgentEventSequenceValidator {
    verifier: SequenceVerifier,
}

impl AgentEventSequenceValidator {
    pub(crate) fn from_events(
        existing_events: &[AgentEvent],
        session_id: &str,
        turn_id: Option<&str>,
    ) -> Self {
        let mut verifier = SequenceVerifier::default();
        for event in existing_events
            .iter()
            .filter(|event| event.session_id == session_id && event.turn_id.as_deref() == turn_id)
        {
            verifier.push(event);
        }
        Self { verifier }
    }

    pub(crate) fn observe_existing(&mut self, event: &AgentEvent) {
        self.verifier.push(event);
    }

    pub(crate) fn validate_and_observe(&mut self, candidate: &AgentEvent) -> Result<(), String> {
        let violations = self.verifier.push(candidate);
        sequence_validation_result(&violations)
    }
}

fn sequence_validation_result(violations: &[SequenceViolation]) -> Result<(), String> {
    if violations.is_empty() {
        return Ok(());
    }

    Err(format!(
        "agent runtime event sequence validation failed: {}",
        violations
            .iter()
            .map(format_violation)
            .collect::<Vec<_>>()
            .join("; ")
    ))
}

#[derive(Default)]
struct SequenceVerifier {
    seen_ids: HashSet<String>,
    turns: HashMap<String, TurnState>,
}

impl SequenceVerifier {
    fn push(&mut self, event: &AgentEvent) -> Vec<SequenceViolation> {
        let mut violations = Vec::new();
        if !event.event_id.is_empty() && !self.seen_ids.insert(event.event_id.clone()) {
            violations.push(SequenceViolation {
                code: "duplicate_event_id",
                event_id: event.event_id.clone(),
                scope_id: None,
            });
        }

        let event_class = normalize_event_class(event);
        let turn_key = event
            .turn_id
            .as_deref()
            .unwrap_or("__default_turn__")
            .to_string();
        let turn = self.turns.entry(turn_key).or_default();

        if turn.terminal && is_execution_stream_class(event_class) {
            violations.push(SequenceViolation {
                code: "execution_after_turn_terminal",
                event_id: event.event_id.clone(),
                scope_id: event_scope_id(event),
            });
            return violations;
        }

        match event_class {
            "item.started" => {
                if let Some(tool_call_id) = tool_call_id(event) {
                    if turn.active_tools.contains_key(&tool_call_id) {
                        violations.push(SequenceViolation {
                            code: "tool_item_started_already_active",
                            event_id: event.event_id.clone(),
                            scope_id: Some(tool_call_id),
                        });
                    } else {
                        turn.active_tools
                            .insert(tool_call_id, event.event_id.clone());
                    }
                }
            }
            "item.completed" => {
                if let Some(tool_call_id) = tool_call_id(event) {
                    if turn.active_tools.remove(&tool_call_id).is_none() {
                        violations.push(SequenceViolation {
                            code: "tool_item_completed_without_start",
                            event_id: event.event_id.clone(),
                            scope_id: Some(tool_call_id),
                        });
                    }
                }
            }
            "action.required" => {
                if let Some(action_id) = action_id(event) {
                    if turn.active_actions.contains_key(&action_id) {
                        violations.push(SequenceViolation {
                            code: "action_required_already_active",
                            event_id: event.event_id.clone(),
                            scope_id: Some(action_id),
                        });
                    } else {
                        turn.active_actions
                            .insert(action_id, event.event_id.clone());
                    }
                }
            }
            event_class if is_action_terminal_event_class(event_class) => {
                if let Some(action_id) = action_id(event) {
                    if turn.active_actions.remove(&action_id).is_none() {
                        violations.push(SequenceViolation {
                            code: "action_resolved_without_request",
                            event_id: event.event_id.clone(),
                            scope_id: Some(action_id),
                        });
                    }
                }
            }
            "patch.started" => {
                if let Some(patch_id) = patch_id(event) {
                    if turn.active_patches.contains_key(&patch_id) {
                        violations.push(SequenceViolation {
                            code: "patch_started_already_active",
                            event_id: event.event_id.clone(),
                            scope_id: Some(patch_id),
                        });
                    } else {
                        turn.active_patches.insert(patch_id, event.event_id.clone());
                    }
                }
            }
            "patch.applied" | "patch.failed" | "patch.declined" => {
                if let Some(patch_id) = patch_id(event) {
                    if turn.active_patches.remove(&patch_id).is_none() {
                        violations.push(SequenceViolation {
                            code: match event_class {
                                "patch.applied" => "patch_applied_without_start",
                                "patch.declined" => "patch_declined_without_start",
                                _ => "patch_failed_without_start",
                            },
                            event_id: event.event_id.clone(),
                            scope_id: Some(patch_id),
                        });
                    }
                }
            }
            "command.started" => {
                if let Some(command_id) = command_id(event) {
                    if turn.active_commands.contains_key(&command_id) {
                        violations.push(SequenceViolation {
                            code: "command_started_already_active",
                            event_id: event.event_id.clone(),
                            scope_id: Some(command_id),
                        });
                    } else {
                        turn.active_commands
                            .insert(command_id, event.event_id.clone());
                    }
                }
            }
            "command.output" => {
                if let Some(command_id) = command_id(event) {
                    if !turn.active_commands.contains_key(&command_id) {
                        violations.push(SequenceViolation {
                            code: "command_output_without_start",
                            event_id: event.event_id.clone(),
                            scope_id: Some(command_id),
                        });
                    }
                }
            }
            "command.exited" => {
                if let Some(command_id) = command_id(event) {
                    if turn.active_commands.remove(&command_id).is_none() {
                        violations.push(SequenceViolation {
                            code: "command_exited_without_start",
                            event_id: event.event_id.clone(),
                            scope_id: Some(command_id),
                        });
                    }
                }
            }
            "test.started" => {
                if let Some(test_run_id) = test_run_id(event) {
                    if turn.active_tests.contains_key(&test_run_id) {
                        violations.push(SequenceViolation {
                            code: "test_started_already_active",
                            event_id: event.event_id.clone(),
                            scope_id: Some(test_run_id),
                        });
                    } else {
                        turn.active_tests
                            .insert(test_run_id, event.event_id.clone());
                    }
                }
            }
            "test.completed" => {
                if let Some(test_run_id) = test_run_id(event) {
                    if turn.active_tests.remove(&test_run_id).is_none() {
                        violations.push(SequenceViolation {
                            code: "test_completed_without_start",
                            event_id: event.event_id.clone(),
                            scope_id: Some(test_run_id),
                        });
                    }
                }
            }
            "turn.completed" | "turn.failed" | "turn.canceled" => {
                if turn.terminal {
                    violations.push(SequenceViolation {
                        code: "turn_terminal_repeated",
                        event_id: event.event_id.clone(),
                        scope_id: event.turn_id.clone(),
                    });
                }
                for tool_call_id in turn.active_tools.keys() {
                    violations.push(SequenceViolation {
                        code: "tool_unclosed_at_turn_end",
                        event_id: event.event_id.clone(),
                        scope_id: Some(tool_call_id.clone()),
                    });
                }
                for action_id in turn.active_actions.keys() {
                    violations.push(SequenceViolation {
                        code: "action_unresolved_at_turn_end",
                        event_id: event.event_id.clone(),
                        scope_id: Some(action_id.clone()),
                    });
                }
                if event_class != "turn.canceled" {
                    for patch_id in turn.active_patches.keys() {
                        violations.push(SequenceViolation {
                            code: "patch_unclosed_at_turn_end",
                            event_id: event.event_id.clone(),
                            scope_id: Some(patch_id.clone()),
                        });
                    }
                }
                for command_id in turn.active_commands.keys() {
                    violations.push(SequenceViolation {
                        code: "command_unclosed_at_turn_end",
                        event_id: event.event_id.clone(),
                        scope_id: Some(command_id.clone()),
                    });
                }
                for test_run_id in turn.active_tests.keys() {
                    violations.push(SequenceViolation {
                        code: "test_unclosed_at_turn_end",
                        event_id: event.event_id.clone(),
                        scope_id: Some(test_run_id.clone()),
                    });
                }
                turn.terminal = true;
                turn.active_tools.clear();
                turn.active_actions.clear();
                turn.active_patches.clear();
                turn.active_commands.clear();
                turn.active_tests.clear();
            }
            _ => {}
        }

        violations
    }
}

fn normalize_event_class(event: &AgentEvent) -> &str {
    match event.event_type.as_str() {
        "item.started" if canonical_command_id(event).is_some() => "command.started",
        "item.completed" if canonical_command_id(event).is_some() => "command.exited",
        "message.delta" | "message.delta_batch" | "message.batch" => "model.delta",
        "message" | "message.completed" => "model.completed",
        "item.completed" if canonical_tool_item(event).is_none() => "model.completed",
        "thinking.delta" => "reasoning.delta",
        "artifact.snapshot" => "artifact.changed",
        "runtime.status" => "run.status",
        "turn.canceled" => "turn.canceled",
        value => value,
    }
}

fn is_execution_stream_class(event_class: &str) -> bool {
    event_class.starts_with("tool.")
        || event_class.starts_with("item.")
        || event_class.starts_with("action.")
        || event_class.starts_with("model.")
        || event_class.starts_with("reasoning.")
        || event_class.starts_with("file.")
        || event_class.starts_with("patch.")
        || event_class.starts_with("command.")
        || event_class.starts_with("test.")
        || event_class == "context.resolved"
        || event_class.starts_with("permission.")
        || event_class.starts_with("sandbox.")
}

fn is_action_terminal_event_class(event_class: &str) -> bool {
    matches!(
        event_class,
        "action.resolved" | "action.cancelled" | "action.canceled" | "action.expired"
    )
}

fn tool_call_id(event: &AgentEvent) -> Option<String> {
    if let Some(item) = canonical_tool_item(event) {
        if let ThreadItemPayload::Tool { call_id, .. } = item.payload {
            return Some(call_id);
        }
    }
    string_field(
        &event.payload,
        &["toolCallId", "tool_call_id", "toolId", "tool_id", "id"],
    )
}

fn canonical_tool_item(event: &AgentEvent) -> Option<ThreadItem> {
    let item = canonical_item(event)?;
    matches!(&item.payload, ThreadItemPayload::Tool { .. }).then_some(item)
}

fn canonical_command_id(event: &AgentEvent) -> Option<String> {
    let item = canonical_item(event)?;
    if !matches!(&item.payload, ThreadItemPayload::Command { .. }) {
        return None;
    }
    item.metadata
        .get("exec_command_call_id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            Some(
                item.item_id
                    .as_str()
                    .strip_prefix("item_")
                    .unwrap_or(item.item_id.as_str())
                    .to_owned(),
            )
        })
}

fn canonical_item(event: &AgentEvent) -> Option<ThreadItem> {
    if !matches!(
        event.event_type.as_str(),
        "item.started" | "item.updated" | "item.completed"
    ) {
        return None;
    }
    serde_json::from_value::<ThreadItem>(event.payload.get("item")?.clone()).ok()
}

fn action_id(event: &AgentEvent) -> Option<String> {
    string_field(
        &event.payload,
        &["actionId", "action_id", "requestId", "request_id", "id"],
    )
}

fn event_scope_id(event: &AgentEvent) -> Option<String> {
    tool_call_id(event)
        .or_else(|| action_id(event))
        .or_else(|| patch_id(event))
        .or_else(|| command_id(event))
        .or_else(|| test_run_id(event))
}

fn patch_id(event: &AgentEvent) -> Option<String> {
    string_field(
        &event.payload,
        &["patchId", "patch_id", "toolCallId", "tool_call_id", "id"],
    )
}

fn command_id(event: &AgentEvent) -> Option<String> {
    canonical_command_id(event).or_else(|| {
        string_field(
            &event.payload,
            &[
                "commandId",
                "command_id",
                "toolCallId",
                "tool_call_id",
                "id",
            ],
        )
    })
}

fn test_run_id(event: &AgentEvent) -> Option<String> {
    string_field(
        &event.payload,
        &[
            "testRunId",
            "test_run_id",
            "toolCallId",
            "tool_call_id",
            "id",
        ],
    )
}

fn string_field(value: &Value, keys: &[&str]) -> Option<String> {
    let object = value.as_object()?;
    keys.iter()
        .filter_map(|key| object.get(*key))
        .find_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn format_violation(violation: &SequenceViolation) -> String {
    match violation.scope_id.as_deref() {
        Some(scope_id) => format!(
            "{} event_id={} scope_id={}",
            violation.code, violation.event_id, scope_id
        ),
        None => format!("{} event_id={}", violation.code, violation.event_id),
    }
}

#[cfg(test)]
mod tests;
