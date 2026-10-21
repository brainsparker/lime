use std::collections::{BTreeMap, HashSet};

use agent_protocol::{
    ItemStatus, SessionId, Thread, ThreadHistoryChangeSet, ThreadId, ThreadItem, ThreadItemPayload,
    ThreadStatus, ThreadTurnsView, ToolOutput, Turn, TurnApprovalState, TurnQueueState, TurnStatus,
};
use app_server_protocol::protocol::v2::ThreadForkParams;
use app_server_protocol::{
    AgentEvent, AgentSession, AgentSessionStatus, AgentTurn, AgentTurnStatus, BusinessObjectRef,
};
use chrono::TimeZone;
use serde_json::{Map, Value};
use thread_store::{ApplyThreadHistoryParams, CreateThreadParams, ReadThreadParams, ThreadStore};
use uuid::Uuid;

use super::{RuntimeCore, RuntimeCoreError, StoredSession};

mod compaction;
mod history;
mod hydration;
use history::{fork_compaction_payload, merge_fork_history_seed};
pub(in crate::runtime) use history::{fork_history_seed_events, merge_fork_history_events};
mod media;
mod model_history;
mod settings;
mod source;

use media::{clear_fork_sidecar, copy_fork_input_media, inline_ephemeral_fork_media};
use settings::{fork_thread_snapshot, validate_fork_params};

#[cfg(test)]
mod tests;

pub(in crate::runtime) const FORK_CANONICAL_ITEM_EVENT_TYPE: &str = "thread.fork.canonical_item";
pub(in crate::runtime) const FORK_INTERRUPTED_MARKER_EVENT_TYPE: &str =
    "thread.fork.interrupted_marker";
const INTERRUPTED_DEVELOPER_GUIDANCE: &str = "The previous turn was interrupted on purpose. Any running unified exec processes may still be running in the background. If any tools/commands were aborted, they may have partially executed.";

struct ForkHistory {
    turn_ids: HashSet<String>,
    changes: Option<ThreadHistoryChangeSet>,
    interrupted_turn_id: Option<String>,
}

impl RuntimeCore {
    pub(crate) async fn fork_thread(
        &self,
        params: ThreadForkParams,
    ) -> Result<Thread, RuntimeCoreError> {
        validate_fork_params(&params)?;
        let store = self.projection_store.as_deref().ok_or_else(|| {
            RuntimeCoreError::Backend("canonical thread store is unavailable".to_string())
        })?;
        let (source, source_history) = self.read_fork_source(&params).await?;
        let source_thread_id = source.thread_id.clone();
        if source.archived {
            return Err(invalid(format!(
                "thread/fork cannot fork archived thread {source_thread_id}"
            )));
        }
        if params.ephemeral
            && !params.exclude_turns
            && source
                .metadata
                .get("historyMode")
                .or_else(|| source.metadata.get("history_mode"))
                .and_then(Value::as_str)
                == Some("paginated")
        {
            return Err(invalid(
                "ephemeral paginated thread/fork requires excludeTurns: true",
            ));
        }
        let source_session_id = source.session_id.as_str().to_string();
        let source_stored = self
            .load_fork_source_session(&source, source_history)
            .await?;
        let target_thread_id = Uuid::now_v7().to_string();
        let target_session_id = target_thread_id.clone();
        let mut history = fork_history(&source, &params, &target_session_id, &target_thread_id)?;
        validate_fork_provider_history(&history)?;
        compaction::validate_source(&source_stored.events, &history)?;
        let checkpoints =
            compaction::selected_session_checkpoints(&source_stored.events, &source, &history)?;
        if let Some(marker) = checkpoints.last() {
            let changes = history.changes.get_or_insert_with(Default::default);
            changes.sequence = changes.sequence.max(marker.sequence);
        }
        let history_sequence = history
            .changes
            .as_ref()
            .map(|changes| changes.sequence)
            .unwrap_or_default();
        let interrupted_boundaries = fork_interrupted_boundary_events(
            &source_stored.events,
            &history.turn_ids,
            history.interrupted_turn_id.as_deref(),
            &target_session_id,
            &target_thread_id,
            history_sequence,
        )?;
        let durable_sequence = interrupted_boundaries
            .last()
            .map(|event| event.sequence)
            .unwrap_or(history_sequence)
            .max(history_sequence);
        let token_usage_event = fork_token_usage_event(
            &source_stored.events,
            &history.turn_ids,
            &target_session_id,
            &target_thread_id,
            durable_sequence,
        )?;
        let now_ms = chrono::Utc::now().timestamp_millis();
        let target = fork_thread_snapshot(
            source,
            &target_session_id,
            &target_thread_id,
            now_ms,
            &ThreadForkParams {
                thread_id: source_thread_id.as_str().to_string(),
                ..params.clone()
            },
            history_sequence,
        )?;
        let mut target_stored = fork_stored_session(
            source_stored,
            &target_session_id,
            &target_thread_id,
            &target.metadata,
            &history.turn_ids,
            history
                .changes
                .as_ref()
                .map(|changes| changes.changed_turns.as_slice())
                .unwrap_or_default(),
            history
                .changes
                .as_ref()
                .map(|changes| changes.changed_items.as_slice())
                .unwrap_or_default(),
            history_sequence,
        )?;
        compaction::copy_session_checkpoints(&mut target_stored, checkpoints)?;
        let mut durable_events = interrupted_boundaries;
        durable_events.extend(token_usage_event);
        target_stored.events = merge_fork_history_events(target_stored.events, durable_events)?;

        // Codex ephemeral forks share the same in-memory thread/runtime owner but do not create
        // a projection, rollout, event-log, or sidecar record.  Keep the canonical history seed
        // in the loaded session so the first turn sees the exact forked model context.
        if params.ephemeral {
            inline_ephemeral_fork_media(
                &mut history,
                &mut target_stored,
                self.sidecar_store.as_deref(),
                &source_session_id,
            )?;
            let mut target = target;
            if params.exclude_turns {
                target.turns.clear();
                target.turns_view = ThreadTurnsView::NotLoaded;
            } else if let Some(changes) = history.changes.as_ref() {
                let mut builder = thread_store::ThreadHistoryBuilder::for_thread(
                    target.session_id.clone(),
                    target.thread_id.clone(),
                );
                builder
                    .apply_change_set(changes.clone())
                    .map_err(|error| invalid(error.to_string()))?;
                target.turns = builder.turns().to_vec();
                for turn in &mut target.turns {
                    turn.items_view = agent_protocol::TurnItemsView::Full;
                }
                target.turns_view = ThreadTurnsView::Full;
            }
            self.state
                .lock()
                .expect("runtime core state mutex poisoned")
                .sessions
                .insert(target_session_id, target_stored);
            return Ok(target);
        }

        let copy_media_result = copy_fork_input_media(
            &history,
            self.sidecar_store.as_deref(),
            &source_session_id,
            &target_session_id,
        );
        if let Err(error) = copy_media_result {
            clear_fork_sidecar(self.sidecar_store.as_deref(), &target_session_id);
            return Err(error);
        }

        if let Err(error) = store
            .create_thread(CreateThreadParams {
                thread: target.clone(),
            })
            .await
            .map_err(store_error)
        {
            clear_fork_sidecar(self.sidecar_store.as_deref(), &target_session_id);
            return Err(error);
        }
        let persist_result = async {
            if let Some(mut changes) = history.changes.clone() {
                changes.sequence = changes.sequence.max(
                    target_stored
                        .events
                        .last()
                        .map_or(0, |event| event.sequence),
                );
                store
                    .apply_history_with_runtime_sync(
                        ApplyThreadHistoryParams {
                            session_id: SessionId::new(target_session_id.clone()),
                            thread_id: ThreadId::new(target_thread_id.clone()),
                            changes,
                        },
                        &target_stored.events,
                        self.sidecar_store.as_deref(),
                    )
                    .map_err(store_error)?;
            }
            if params.defer_goal_continuation {
                store
                    .inherit_thread_goal_for_fork_sync(source_thread_id.as_str(), &target_thread_id)
                    .map_err(|error| RuntimeCoreError::Backend(error.to_string()))?;
            }
            if let Some(writer) = self.event_log_writer.as_ref() {
                writer
                    .append_events(&target_stored.events)
                    .map_err(RuntimeCoreError::Backend)?;
            }
            Ok::<(), RuntimeCoreError>(())
        }
        .await;
        if let Err(error) = persist_result {
            let _ = store.delete_session_data(&target_session_id);
            clear_fork_sidecar(self.sidecar_store.as_deref(), &target_session_id);
            return Err(error);
        }

        self.state
            .lock()
            .expect("runtime core state mutex poisoned")
            .sessions
            .insert(target_session_id.clone(), target_stored);

        store
            .read_thread(ReadThreadParams {
                thread_id: ThreadId::new(target_thread_id.clone()),
                include_archived: false,
                turns_view: if params.exclude_turns {
                    ThreadTurnsView::NotLoaded
                } else {
                    ThreadTurnsView::Full
                },
            })
            .await
            .map_err(store_error)?
            .ok_or_else(|| {
                RuntimeCoreError::Backend(format!(
                    "forked thread disappeared after creation: {target_thread_id}"
                ))
            })
    }
}

fn fork_token_usage_event(
    source_events: &[AgentEvent],
    turn_ids: &HashSet<String>,
    target_session_id: &str,
    target_thread_id: &str,
    durable_sequence: u64,
) -> Result<Option<AgentEvent>, RuntimeCoreError> {
    let included_events = source_events
        .iter()
        .filter(|event| {
            event
                .turn_id
                .as_deref()
                .is_some_and(|turn_id| turn_ids.contains(turn_id))
        })
        .cloned()
        .collect::<Vec<_>>();
    let Some(snapshot) =
        super::thread_usage::thread_token_usage_snapshot_from_events(&included_events)
    else {
        return Ok(None);
    };
    let sequence = durable_sequence
        .checked_add(1)
        .ok_or_else(|| invalid("thread/fork token usage sequence overflow"))?;
    let timestamp = included_events
        .iter()
        .find(|event| event.sequence == snapshot.source_sequence)
        .map(|event| event.timestamp.clone())
        .unwrap_or_else(super::value_fields::timestamp);
    let usage = |value: &super::thread_usage::TokenUsageSnapshot| {
        serde_json::json!({
            "total_tokens": value.total_tokens,
            "input_tokens": value.input_tokens,
            "cached_input_tokens": value.cached_input_tokens,
            "cache_write_input_tokens": value.cache_write_input_tokens,
            "output_tokens": value.output_tokens,
            "reasoning_output_tokens": value.reasoning_output_tokens,
        })
    };
    Ok(Some(AgentEvent {
        event_id: format!("evt-thread-fork-token-usage-{target_session_id}"),
        sequence,
        session_id: target_session_id.to_string(),
        thread_id: Some(target_thread_id.to_string()),
        turn_id: Some(snapshot.turn_id),
        event_type: "thread.token_usage".to_string(),
        timestamp,
        payload: serde_json::json!({
            "token_usage": {
                "total_token_usage": usage(&snapshot.total_token_usage),
                "last_token_usage": usage(&snapshot.last_token_usage),
                "model_context_window": snapshot.model_context_window,
            }
        }),
    }))
}

fn fork_interrupted_boundary_events(
    source_events: &[AgentEvent],
    turn_ids: &HashSet<String>,
    interrupted_turn_id: Option<&str>,
    target_session_id: &str,
    target_thread_id: &str,
    history_sequence: u64,
) -> Result<Vec<AgentEvent>, RuntimeCoreError> {
    let mut boundaries = source_events
        .iter()
        .filter(|event| {
            (event.event_type == FORK_INTERRUPTED_MARKER_EVENT_TYPE
                || (event.event_type == "turn.canceled"
                    && event.payload.get("forkSnapshot").and_then(Value::as_bool) == Some(true)))
                && event
                    .turn_id
                    .as_deref()
                    .is_some_and(|turn_id| turn_ids.contains(turn_id))
        })
        .cloned()
        .collect::<Vec<_>>();
    boundaries.sort_by_key(|event| event.sequence);
    let mut seen_sequences = HashSet::new();
    for event in &mut boundaries {
        if event.sequence == 0 || !seen_sequences.insert(event.sequence) {
            return Err(invalid(
                "thread/fork interrupted boundaries must have unique positive sequences",
            ));
        }
        event.event_id = format!(
            "evt-thread-fork-interrupted-{}-{}-{}",
            target_session_id,
            event.sequence,
            event.event_type.replace('.', "-")
        );
        event.session_id = target_session_id.to_string();
        event.thread_id = Some(target_thread_id.to_string());
    }
    if let Some(turn_id) = interrupted_turn_id {
        let marker_sequence = history_sequence
            .checked_add(1)
            .ok_or_else(|| invalid("thread/fork interrupted marker sequence overflow"))?;
        let boundary_sequence = marker_sequence
            .checked_add(1)
            .ok_or_else(|| invalid("thread/fork interrupted boundary sequence overflow"))?;
        if boundaries
            .iter()
            .any(|event| matches!(event.sequence, sequence if sequence == marker_sequence || sequence == boundary_sequence))
        {
            return Err(invalid(
                "thread/fork interrupted boundary collides with inherited history",
            ));
        }
        let timestamp = source_events
            .iter()
            .rev()
            .find(|event| event.turn_id.as_deref() == Some(turn_id))
            .map(|event| event.timestamp.clone())
            .unwrap_or_else(super::value_fields::timestamp);
        boundaries.push(AgentEvent {
            event_id: format!(
                "evt-thread-fork-interrupted-{target_session_id}-{marker_sequence}-marker"
            ),
            sequence: marker_sequence,
            session_id: target_session_id.to_string(),
            thread_id: Some(target_thread_id.to_string()),
            turn_id: Some(turn_id.to_string()),
            event_type: FORK_INTERRUPTED_MARKER_EVENT_TYPE.to_string(),
            timestamp,
            payload: serde_json::json!({
                "reason": "interrupted",
                "role": "developer",
                "text": INTERRUPTED_DEVELOPER_GUIDANCE,
                "forkSnapshot": true,
            }),
        });
        boundaries.push(AgentEvent {
            event_id: format!(
                "evt-thread-fork-interrupted-{target_session_id}-{boundary_sequence}-boundary"
            ),
            sequence: boundary_sequence,
            session_id: target_session_id.to_string(),
            thread_id: Some(target_thread_id.to_string()),
            turn_id: Some(turn_id.to_string()),
            event_type: "turn.canceled".to_string(),
            timestamp: super::value_fields::timestamp(),
            payload: serde_json::json!({
                "reason": "interrupted",
                "forkSnapshot": true,
            }),
        });
    }
    boundaries.sort_by_key(|event| event.sequence);
    Ok(boundaries)
}

fn validate_fork_provider_history(history: &ForkHistory) -> Result<(), RuntimeCoreError> {
    for item in history
        .changes
        .iter()
        .flat_map(|changes| changes.changed_items.iter())
    {
        validate_fork_canonical_item(item)?;
    }
    Ok(())
}

fn validate_fork_canonical_item(item: &ThreadItem) -> Result<(), RuntimeCoreError> {
    match &item.payload {
        ThreadItemPayload::UserMessage { .. }
        | ThreadItemPayload::AgentMessage { .. }
        | ThreadItemPayload::Reasoning { .. }
        | ThreadItemPayload::Tool { .. }
        | ThreadItemPayload::McpToolCall { .. }
            if !item.status.is_terminal() =>
        {
            return Err(invalid(format!(
                "thread/fork cannot preserve non-terminal canonical item {}",
                item.item_id
            )));
        }
        ThreadItemPayload::AgentMessage { content_parts, .. }
            if content_parts
                .iter()
                .any(|part| matches!(part, agent_protocol::MessageContentPart::Media { .. })) =>
        {
            return Err(invalid(
                "thread/fork cannot preserve assistant media content from canonical history",
            ));
        }
        ThreadItemPayload::Tool { output, .. } | ThreadItemPayload::McpToolCall { output, .. }
            if output.is_none() =>
        {
            return Err(invalid(format!(
                "thread/fork cannot preserve tool item {} without a canonical result",
                item.item_id
            )));
        }
        ThreadItemPayload::CollabAgentToolCall { .. } => {
            return Err(invalid(
                "thread/fork cannot preserve collab tool arguments from canonical history",
            ));
        }
        ThreadItemPayload::Media { .. } => {
            return Err(invalid(
                "thread/fork cannot preserve media content from canonical history",
            ));
        }
        ThreadItemPayload::ContextCompaction {
            replacement_history,
            ..
        } => {
            if replacement_history.is_empty() {
                return Err(invalid(
                    "thread/fork cannot preserve compacted provider history without complete canonical lineage",
                ));
            }
            let event = AgentEvent {
                event_id: format!("evt-thread-fork-validate-{}", item.item_id),
                sequence: item.sequence,
                session_id: item.session_id.as_str().to_string(),
                thread_id: Some(item.thread_id.as_str().to_string()),
                turn_id: Some(item.turn_id.as_str().to_string()),
                event_type: "context.compaction.completed".to_string(),
                timestamp: super::value_fields::timestamp(),
                payload: fork_compaction_payload(item)
                    .expect("context compaction payload was matched"),
            };
            super::context_compaction::latest_fork_compaction_seed(&[event])
                .map_err(|error| {
                    invalid(format!(
                        "thread/fork cannot preserve compacted provider history without complete canonical lineage: {error}"
                    ))
                })?
                .ok_or_else(|| {
                    invalid(
                        "thread/fork cannot preserve compacted provider history without complete canonical lineage",
                    )
                })?;
        }
        ThreadItemPayload::Unknown { .. } => {
            return Err(invalid(
                "thread/fork cannot preserve unknown or extension provider history from canonical history",
            ));
        }
        ThreadItemPayload::Extension { name, data }
            if matches!(name.as_str(), "enteredReviewMode" | "exitedReviewMode") =>
        {
            if data.get("review").and_then(Value::as_str).is_none() {
                return Err(invalid(format!(
                    "thread/fork cannot preserve review extension {} without review text",
                    item.item_id
                )));
            }
        }
        ThreadItemPayload::Extension { .. } => {
            return Err(invalid(
                "thread/fork cannot preserve unknown or extension provider history from canonical history",
            ));
        }
        _ => {}
    }
    Ok(())
}

fn fork_history(
    source: &Thread,
    params: &ThreadForkParams,
    target_session_id: &str,
    target_thread_id: &str,
) -> Result<ForkHistory, RuntimeCoreError> {
    let interrupted_snapshot = params.last_turn_id.is_none() && params.before_turn_id.is_none();
    let end = if let Some(last_turn_id) = params.last_turn_id.as_deref() {
        source
            .turns
            .iter()
            .position(|turn| turn.turn_id.as_str() == last_turn_id.trim())
            .map(|index| index + 1)
            .ok_or_else(|| invalid(format!("turn not found: {}", last_turn_id.trim())))?
    } else if let Some(before_turn_id) = params.before_turn_id.as_deref() {
        source
            .turns
            .iter()
            .position(|turn| turn.turn_id.as_str() == before_turn_id.trim())
            .ok_or_else(|| invalid(format!("turn not found: {}", before_turn_id.trim())))?
    } else {
        source.turns.len()
    };
    let selected = &source.turns[..end];
    let non_terminal = selected
        .iter()
        .enumerate()
        .filter(|(_, turn)| !turn.is_terminal())
        .collect::<Vec<_>>();
    if !non_terminal.is_empty()
        && (!interrupted_snapshot
            || non_terminal.len() != 1
            || non_terminal[0].0 + 1 != selected.len())
    {
        return Err(invalid(format!(
            "cannot fork through in-progress turn: {}",
            non_terminal[0].1.turn_id
        )));
    }
    let interrupted_turn_id = non_terminal
        .first()
        .map(|(_, turn)| turn.turn_id.as_str().to_string());
    let turn_ids = selected
        .iter()
        .map(|turn| turn.turn_id.as_str().to_string())
        .collect::<HashSet<_>>();
    if selected.is_empty() {
        return Ok(ForkHistory {
            turn_ids,
            changes: None,
            interrupted_turn_id: None,
        });
    }

    let target_session_id = SessionId::new(target_session_id);
    let target_thread_id = ThreadId::new(target_thread_id);
    let mut changed_turns = Vec::with_capacity(selected.len());
    let mut changed_items = Vec::new();
    let mut sequence = 1;
    for source_turn in selected {
        let mut turn = source_turn.clone();
        if interrupted_turn_id.as_deref() == Some(turn.turn_id.as_str()) {
            interrupt_fork_turn(&mut turn);
        }
        turn.session_id = target_session_id.clone();
        turn.thread_id = target_thread_id.clone();
        for source_item in std::mem::take(&mut turn.items) {
            let mut item = source_item;
            item.session_id = target_session_id.clone();
            item.thread_id = target_thread_id.clone();
            sequence = sequence.max(item.sequence);
            changed_items.push(item);
        }
        changed_turns.push(turn);
    }
    Ok(ForkHistory {
        turn_ids,
        changes: Some(ThreadHistoryChangeSet {
            sequence,
            changed_turns,
            changed_items,
            ..Default::default()
        }),
        interrupted_turn_id,
    })
}

fn interrupt_fork_turn(turn: &mut Turn) {
    turn.status = TurnStatus::Interrupted;
    turn.queue = TurnQueueState::NotQueued;
    if turn.approval == TurnApprovalState::Pending {
        turn.approval = TurnApprovalState::Cancelled;
    }
    turn.error = None;
    turn.completed_at_ms = None;
    turn.duration_ms = None;
    for item in &mut turn.items {
        if !item.status.is_terminal() {
            item.status = ItemStatus::Interrupted;
            item.completed_at_ms = None;
        }
        match &mut item.payload {
            ThreadItemPayload::Tool { output, .. }
            | ThreadItemPayload::McpToolCall { output, .. }
                if output.is_none() =>
            {
                *output = Some(ToolOutput {
                    error: Some("turn interrupted before tool completed".to_string()),
                    ..ToolOutput::default()
                });
            }
            _ => {}
        }
    }
}

fn fork_stored_session(
    mut source: StoredSession,
    target_session_id: &str,
    target_thread_id: &str,
    metadata: &Value,
    turn_ids: &HashSet<String>,
    canonical_turns: &[Turn],
    canonical_items: &[ThreadItem],
    history_sequence: u64,
) -> Result<StoredSession, RuntimeCoreError> {
    source.session.session_id = target_session_id.to_string();
    source.session.thread_id = target_thread_id.to_string();
    source.session.status = AgentSessionStatus::Idle;
    source.session.created_at = super::value_fields::timestamp();
    source.session.updated_at = source.session.created_at.clone();
    let reference = source
        .session
        .business_object_ref
        .get_or_insert_with(|| BusinessObjectRef {
            kind: "agent.thread".to_string(),
            id: target_thread_id.to_string(),
            title: None,
            uri: None,
            metadata: None,
        });
    reference.id = target_thread_id.to_string();
    reference.metadata = Some(metadata.clone());
    source.turns.retain(|turn| turn_ids.contains(&turn.turn_id));
    for turn in &mut source.turns {
        turn.session_id = target_session_id.to_string();
        turn.thread_id = target_thread_id.to_string();
        if let Some(canonical) = canonical_turns
            .iter()
            .find(|canonical| canonical.turn_id.as_str() == turn.turn_id)
        {
            turn.status = turn_status(canonical.status);
            turn.started_at = canonical.started_at_ms.map(|millis| {
                chrono::Utc
                    .timestamp_millis_opt(millis)
                    .single()
                    .map(|value| value.to_rfc3339())
                    .unwrap_or_else(super::value_fields::timestamp)
            });
            turn.completed_at = canonical.completed_at_ms.map(|millis| {
                chrono::Utc
                    .timestamp_millis_opt(millis)
                    .single()
                    .map(|value| value.to_rfc3339())
                    .unwrap_or_else(super::value_fields::timestamp)
            });
        }
    }
    source
        .turn_inputs
        .retain(|turn_id, _| turn_ids.contains(turn_id));
    source
        .turn_runtime_options
        .retain(|turn_id, _| turn_ids.contains(turn_id));
    let model_history = std::mem::take(&mut source.events);
    source.events = fork_history_seed_events(
        &source.session,
        canonical_turns,
        canonical_items,
        history_sequence,
    )?;
    model_history::copy_model_records(&mut source, model_history, turn_ids, history_sequence)?;
    source.output_blobs.clear();
    Ok(source)
}

fn session_status(status: &ThreadStatus) -> AgentSessionStatus {
    match status {
        ThreadStatus::Active { .. } => AgentSessionStatus::Running,
        ThreadStatus::SystemError => AgentSessionStatus::Failed,
        ThreadStatus::NotLoaded | ThreadStatus::Idle => AgentSessionStatus::Idle,
    }
}

fn turn_status(status: agent_protocol::TurnStatus) -> AgentTurnStatus {
    match status {
        agent_protocol::TurnStatus::InProgress => AgentTurnStatus::Running,
        agent_protocol::TurnStatus::Completed => AgentTurnStatus::Completed,
        agent_protocol::TurnStatus::Interrupted => AgentTurnStatus::Canceled,
        agent_protocol::TurnStatus::Failed => AgentTurnStatus::Failed,
    }
}

fn invalid(message: impl Into<String>) -> RuntimeCoreError {
    RuntimeCoreError::InvalidRequest(message.into())
}

fn store_error(error: impl std::fmt::Display) -> RuntimeCoreError {
    RuntimeCoreError::Backend(error.to_string())
}
