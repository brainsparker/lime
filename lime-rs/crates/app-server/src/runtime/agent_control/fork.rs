use super::*;

impl RuntimeCore {
    pub(super) fn fork_agent_control_history(
        &self,
        child: &AgentSession,
        forked_turns: Vec<ForkedAgentControlTurn>,
        compaction_seed: Option<ForkCompactionSeed>,
    ) -> Result<(), RuntimeCoreError> {
        let source_coverage = compaction_seed
            .as_ref()
            .map(|seed| seed.covered_through_sequence);
        let mut child_coverage = 0;
        for forked in forked_turns {
            let turn_id = forked_agent_control_turn_id(child, &forked);
            let input_covered =
                source_coverage.is_some_and(|covered| forked.input_sequence <= covered);
            {
                let mut state = self
                    .state
                    .lock()
                    .expect("runtime core state mutex poisoned");
                let stored = state
                    .sessions
                    .get_mut(&child.session_id)
                    .ok_or_else(|| RuntimeCoreError::SessionNotFound(child.session_id.clone()))?;
                stored.session.status = AgentSessionStatus::Running;
                stored.session.updated_at = timestamp();
                stored.turn_inputs.insert(turn_id.clone(), forked.input);
                stored.turns.push(AgentTurn {
                    turn_id: turn_id.clone(),
                    session_id: child.session_id.clone(),
                    thread_id: child.thread_id.clone(),
                    status: AgentTurnStatus::Running,
                    started_at: None,
                    completed_at: None,
                });
            }

            let mut events = Vec::with_capacity(forked.assistant_messages.len() * 2 + 2);
            let mut covered_messages = std::collections::HashSet::new();
            events.push(RuntimeEvent::new(
                "turn.started",
                json!({
                    "forked": true,
                    "forkedFromThreadId": forked.source_thread_id,
                    "forkedFromTurnId": forked.source_turn_id,
                }),
            ));
            for message in forked.assistant_messages {
                let item_id = agent_protocol::ItemId::new(format!(
                    "fork-{}",
                    stable_agent_control_digest(&[
                        child.thread_id.as_str(),
                        message.source_item_id.as_str(),
                    ])
                ))
                .to_string();
                if source_coverage.is_some_and(|covered| message.source_sequence <= covered) {
                    covered_messages.insert(item_id.clone());
                }
                let payload = json!({
                    "itemId": item_id,
                    "phase": "final_answer",
                    "text": message.text,
                    "contentParts": message.content_parts,
                    "metadata": {
                        "forkedFromThreadId": message.source_thread_id,
                        "forkedFromTurnId": message.source_turn_id,
                        "forkedFromItemId": message.source_item_id,
                    },
                });
                events.push(RuntimeEvent::new("message.delta", payload.clone()));
                events.push(RuntimeEvent::new(
                    "message.completed",
                    with_completed_message_status(payload),
                ));
            }
            events.push(RuntimeEvent::new(
                "turn.completed",
                json!({ "forked": true }),
            ));
            let appended = self.append_runtime_events(
                &child.session_id,
                &child.thread_id,
                Some(&turn_id),
                events,
            )?;
            for event in appended {
                let covered = if event.event_type == "item.completed" {
                    event
                        .payload
                        .get("item")
                        .and_then(|value| {
                            serde_json::from_value::<agent_protocol::ThreadItem>(value.clone()).ok()
                        })
                        .is_some_and(|item| match item.payload {
                            ThreadItemPayload::UserMessage { .. } => input_covered,
                            ThreadItemPayload::AgentMessage { .. } => {
                                covered_messages.contains(item.item_id.as_str())
                            }
                            _ => false,
                        })
                } else {
                    false
                };
                if covered {
                    child_coverage = child_coverage.max(event.sequence);
                }
            }
        }
        if let Some(seed) = compaction_seed {
            let payload = rewrite_fork_compaction_payload(seed.payload, child, child_coverage);
            self.append_runtime_events(
                &child.session_id,
                &child.thread_id,
                None,
                vec![RuntimeEvent::new("context.compaction.completed", payload)],
            )?;
        }
        Ok(())
    }
}

fn forked_agent_control_turn_id(child: &AgentSession, forked: &ForkedAgentControlTurn) -> String {
    format!(
        "fork-{}",
        stable_agent_control_digest(&[
            child.thread_id.as_str(),
            forked.source_thread_id.as_str(),
            forked.source_turn_id.as_str(),
        ])
    )
}

fn rewrite_fork_compaction_payload(
    mut payload: serde_json::Value,
    child: &AgentSession,
    covered_through_sequence: u64,
) -> serde_json::Value {
    if let Some(object) = payload.as_object_mut() {
        let source_compaction_id = object
            .get("compactionId")
            .and_then(serde_json::Value::as_str)
            .map(ToString::to_string)
            .unwrap_or_else(|| "compaction".to_string());
        let child_compaction_id = format!("{}_{}", child.session_id, source_compaction_id);
        object.insert("compactionId".to_string(), json!(child_compaction_id));
        object.insert("sessionId".to_string(), json!(child.session_id));
        object.insert("threadId".to_string(), json!(child.thread_id));
        object.insert(
            "coveredThroughSequence".to_string(),
            json!(covered_through_sequence),
        );
        if let Some(artifact) = object
            .get_mut("artifact")
            .and_then(|value| value.as_object_mut())
        {
            artifact.insert(
                "compactionId".to_string(),
                json!(format!("{}_{}", child.session_id, source_compaction_id)),
            );
            artifact.insert("sessionId".to_string(), json!(child.session_id));
            artifact.insert("threadId".to_string(), json!(child.thread_id));
            artifact.insert(
                "coveredThroughSequence".to_string(),
                json!(covered_through_sequence),
            );
        }
    }
    payload
}

#[derive(Debug, Clone)]
pub(super) struct ForkedAgentControlTurn {
    source_thread_id: String,
    source_turn_id: String,
    input_sequence: u64,
    input: Vec<AgentInput>,
    assistant_messages: Vec<ForkedAgentControlMessage>,
}

#[derive(Debug, Clone)]
struct ForkedAgentControlMessage {
    source_thread_id: String,
    source_turn_id: String,
    source_item_id: String,
    source_sequence: u64,
    text: String,
    content_parts: Vec<agent_protocol::MessageContentPart>,
}

pub(super) fn selected_agent_control_fork_history(
    parent: &StoredSession,
    canonical_turns: &[agent_protocol::Turn],
    fork_mode: SpawnAgentForkMode,
) -> Result<(Vec<ForkedAgentControlTurn>, Option<ForkCompactionSeed>), RuntimeCoreError> {
    if fork_mode == SpawnAgentForkMode::None {
        return Ok((Vec::new(), None));
    }
    let compaction_seed = if fork_mode == SpawnAgentForkMode::FullHistory {
        super::super::context_compaction::latest_fork_compaction_seed(&parent.events)?
    } else {
        None
    };
    let mut source_turns = canonical_turns
        .iter()
        .filter(|turn| !matches!(turn.queue, TurnQueueState::Queued { .. }))
        .filter_map(|turn| {
            let mut canonical_inputs = turn.items.iter().filter_map(|item| {
                if item.status != ItemStatus::Completed {
                    return None;
                }
                match &item.payload {
                    ThreadItemPayload::UserMessage { .. } => Some(item.sequence),
                    _ => None,
                }
            });
            let canonical_sequence = canonical_inputs.next()?;
            // A user input's provider record precedes its completed UI Item. Canonical fork
            // seeds contain only the Item, so use that seed's own sequence when no raw input exists.
            let input_sequence = parent
                .events
                .iter()
                .find(|event| {
                    event.turn_id.as_deref() == Some(turn.turn_id.as_str())
                        && super::super::turn_input_events::is_provider_input_event(event)
                })
                .map_or(canonical_sequence, |event| event.sequence);
            Some((turn, input_sequence, canonical_inputs.next().is_some()))
        })
        .collect::<Vec<_>>();
    if let SpawnAgentForkMode::LastNTurns(limit) = &fork_mode {
        source_turns = source_turns.split_off(source_turns.len().saturating_sub(*limit));
    }
    let turns = source_turns
        .into_iter()
        .map(|(turn, input_sequence, has_duplicate_input)| {
            if has_duplicate_input {
                return Err(RuntimeCoreError::Backend(format!(
                    "canonical fork source Turn {} contains multiple user inputs",
                    turn.turn_id
                )));
            }
            let input = parent
                .turn_inputs
                .get(turn.turn_id.as_str())
                .cloned()
                .ok_or_else(|| {
                    RuntimeCoreError::Backend(format!(
                        "canonical fork source Turn {} is missing durable input",
                        turn.turn_id
                    ))
                })?;
            ensure_agent_control_fork_input_is_lossless(turn, &input)?;
            validate_agent_control_fork_items(turn)?;
            let assistant_messages = if turn.status == TurnStatus::Completed {
                turn.items
                    .iter()
                    .filter(|item| item.status == ItemStatus::Completed)
                    .filter_map(|item| match &item.payload {
                        ThreadItemPayload::AgentMessage {
                            text,
                            phase,
                            content_parts,
                        } if matches!(
                            phase,
                            Some(agent_protocol::response_item::MessagePhase::FinalAnswer)
                        ) =>
                        {
                            Some(ForkedAgentControlMessage {
                                source_thread_id: turn.thread_id.as_str().to_string(),
                                source_turn_id: turn.turn_id.as_str().to_string(),
                                source_item_id: item.item_id.as_str().to_string(),
                                source_sequence: item.sequence,
                                text: text.clone(),
                                content_parts: content_parts.clone(),
                            })
                        }
                        _ => None,
                    })
                    .collect()
            } else {
                Vec::new()
            };
            Ok(ForkedAgentControlTurn {
                source_thread_id: turn.thread_id.as_str().to_string(),
                source_turn_id: turn.turn_id.as_str().to_string(),
                input_sequence,
                input,
                assistant_messages,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    if fork_mode == SpawnAgentForkMode::FullHistory {
        let compaction_marker = parent
            .events
            .iter()
            .find(|event| event.event_type == "context.compaction.completed");
        if let Some(marker) = compaction_marker.filter(|_| compaction_seed.is_none()) {
            let turn_id = marker.turn_id.as_deref().unwrap_or("unknown");
            return Err(RuntimeCoreError::Backend(format!(
                "canonical AgentControl full-history fork source Turn {turn_id} contains compaction without replacement history"
            )));
        }
        if let Some(seed) = compaction_seed.as_ref() {
            super::super::context_compaction::boundary::validate_snapshot_boundary(
                &parent.events,
                seed.covered_through_sequence,
            )?;
        }
    }
    Ok((turns, compaction_seed))
}

fn ensure_agent_control_fork_input_is_lossless(
    turn: &agent_protocol::Turn,
    input: &[AgentInput],
) -> Result<(), RuntimeCoreError> {
    let text_only = matches!(
        input,
        [AgentInput::Text {
            text_elements,
            ..
        }] if text_elements.is_empty()
    );
    if text_only {
        return Ok(());
    }
    Err(RuntimeCoreError::Backend(format!(
        "canonical AgentControl fork source Turn {} contains user input that cannot be copied without loss",
        turn.turn_id
    )))
}

fn validate_agent_control_fork_items(turn: &agent_protocol::Turn) -> Result<(), RuntimeCoreError> {
    for item in &turn.items {
        match &item.payload {
            ThreadItemPayload::UserMessage { .. } if item.status == ItemStatus::Completed => {}
            ThreadItemPayload::UserMessage { .. } => {
                return Err(unsupported_agent_control_fork_item(turn, item));
            }
            ThreadItemPayload::Reasoning { .. }
            | ThreadItemPayload::Tool { .. }
            | ThreadItemPayload::DynamicToolCall { .. }
            | ThreadItemPayload::McpToolCall { .. }
            | ThreadItemPayload::CollabAgentToolCall { .. }
            | ThreadItemPayload::Plan { .. }
            | ThreadItemPayload::Approval { .. }
            | ThreadItemPayload::Command { .. }
            | ThreadItemPayload::File { .. }
            | ThreadItemPayload::Media { .. }
            | ThreadItemPayload::SubAgent { .. } => {}
            ThreadItemPayload::AgentMessage {
                phase,
                content_parts,
                ..
            } if matches!(
                phase,
                Some(agent_protocol::response_item::MessagePhase::FinalAnswer)
            ) =>
            {
                if item.status != ItemStatus::Completed
                    || content_parts.iter().any(|part| {
                        matches!(part, agent_protocol::MessageContentPart::Media { .. })
                    })
                {
                    return Err(unsupported_agent_control_fork_item(turn, item));
                }
            }
            ThreadItemPayload::AgentMessage { .. } => {}
            ThreadItemPayload::ContextCompaction { .. }
            | ThreadItemPayload::Unknown { .. }
            | ThreadItemPayload::Extension { .. } => {}
        }
    }
    Ok(())
}

fn unsupported_agent_control_fork_item(
    turn: &agent_protocol::Turn,
    item: &agent_protocol::ThreadItem,
) -> RuntimeCoreError {
    RuntimeCoreError::Backend(format!(
        "canonical AgentControl fork source Turn {} contains {:?} Item {} that cannot be copied without loss",
        turn.turn_id, item.kind, item.item_id
    ))
}

fn with_completed_message_status(mut payload: serde_json::Value) -> serde_json::Value {
    if let Some(payload) = payload.as_object_mut() {
        payload.insert("status".to_string(), json!("completed"));
    }
    payload
}
