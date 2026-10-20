use super::*;
use crate::model_history::{history_error, ModelHistoryRecord};

pub(super) async fn continuation(
    hook_step: &RuntimeHookStepSnapshot,
    session_config: &AgentSessionConfig,
    turn_id: &str,
    working_directory: &Path,
    stop_hook_active: bool,
    last_assistant_message: String,
    index: u64,
) -> Result<Option<(CurrentProviderMessage, ThreadItem)>, RuntimeReplyAttemptError> {
    let evaluation = evaluate_stop_hooks(
        hook_step,
        session_config,
        turn_id,
        working_directory,
        stop_hook_active,
        last_assistant_message,
    )
    .await;
    if matches!(
        session_config.stop_hook_target,
        RuntimeStopHookTarget::MemoryConsolidation
    ) && (evaluation.should_stop || evaluation.block_reason.is_some())
    {
        return Err(history_error(
            "Memory consolidation was rejected by a Stop hook".to_string(),
        ));
    }
    if evaluation.should_stop {
        return Ok(None);
    }
    let Some(reason) = evaluation.block_reason else {
        return Ok(None);
    };
    let fragments = if evaluation.continuation_fragments.is_empty() {
        vec![HookPromptFragment {
            text: reason,
            hook_run_id: format!("{turn_id}:stop"),
        }]
    } else {
        evaluation.continuation_fragments
    };
    let message = hook_prompt_provider_message(&fragments)
        .ok_or_else(|| history_error("Stop hook returned an invalid prompt".to_string()))?;
    let item = hook_prompt_item(session_config, turn_id, index, fragments)?;
    let record = ModelHistoryRecord::input(message.clone(), item.item_id.to_string())
        .map_err(history_error)?;
    let recorder = session_config
        .model_history_recorder
        .as_ref()
        .ok_or_else(|| {
            history_error("Stop continuation requires a durable history recorder".to_string())
        })?;
    // The host returns only after the existing EventLog owner committed this record.
    // Enqueueing an event cannot authorize Item publication or another sampling step.
    recorder.record(record).await.map_err(history_error)?;
    Ok(Some((message, item)))
}

pub(super) struct StopHookEvaluation {
    pub should_stop: bool,
    pub block_reason: Option<String>,
    pub continuation_fragments: Vec<HookPromptFragment>,
}

pub(super) async fn evaluate_stop_hooks(
    hook_step: &RuntimeHookStepSnapshot,
    session_config: &AgentSessionConfig,
    turn_id: &str,
    working_directory: &Path,
    stop_hook_active: bool,
    last_assistant_message: String,
) -> StopHookEvaluation {
    let (event_name, target) = match &session_config.stop_hook_target {
        RuntimeStopHookTarget::Stop => (RuntimeHookEventName::Stop, RuntimeStopHookTarget::Stop),
        RuntimeStopHookTarget::MemoryConsolidation => (
            RuntimeHookEventName::Stop,
            RuntimeStopHookTarget::MemoryConsolidation,
        ),
        RuntimeStopHookTarget::Disabled => {
            return StopHookEvaluation {
                should_stop: false,
                block_reason: None,
                continuation_fragments: Vec::new(),
            }
        }
        RuntimeStopHookTarget::SubagentStop {
            agent_id,
            agent_type,
            agent_transcript_path,
        } => (
            RuntimeHookEventName::SubagentStop,
            RuntimeStopHookTarget::SubagentStop {
                agent_id: agent_id.clone(),
                agent_type: agent_type.clone(),
                agent_transcript_path: agent_transcript_path.clone(),
            },
        ),
    };
    let hooks = match &session_config.stop_hook_target {
        RuntimeStopHookTarget::MemoryConsolidation => hook_step
            .hooks
            .iter()
            .filter(|hook| {
                matches!(
                    hook.source,
                    agent_protocol::hook::HookSource::System
                        | agent_protocol::hook::HookSource::Mdm
                        | agent_protocol::hook::HookSource::CloudRequirements
                        | agent_protocol::hook::HookSource::CloudManagedConfig
                        | agent_protocol::hook::HookSource::LegacyManagedConfigFile
                        | agent_protocol::hook::HookSource::LegacyManagedConfigMdm
                        | agent_protocol::hook::HookSource::Unknown
                )
            })
            .cloned()
            .collect::<Vec<_>>(),
        _ => hook_step.hooks.clone(),
    };
    if !hooks.iter().any(|hook| hook.event_name == event_name) {
        return StopHookEvaluation {
            should_stop: false,
            block_reason: None,
            continuation_fragments: Vec::new(),
        };
    }
    let snapshot = match RuntimeTurnSnapshot::try_new(Vec::new(), hooks) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            return StopHookEvaluation {
                should_stop: false,
                block_reason: Some(format!("Stop hook snapshot is invalid: {error:?}")),
                continuation_fragments: Vec::new(),
            }
        }
    };
    let context = RuntimeHookEventContext {
        session_id: Some(session_config.id.clone()),
        turn_id: Some(turn_id.to_string()),
        working_directory: working_directory.to_path_buf(),
        stop: Some(RuntimeStopHookContext {
            invocation_id: format!("{turn_id}:stop"),
            model: session_config
                .turn_context
                .as_ref()
                .and_then(|context| context.model.clone())
                .unwrap_or_else(|| "unknown".to_string()),
            permission_mode: session_config
                .turn_context
                .as_ref()
                .and_then(|context| context.approval_policy.clone())
                .unwrap_or_else(|| "default".to_string()),
            transcript_path: session_config.stop_hook_transcript_path.clone(),
            stop_hook_active,
            last_assistant_message: (!last_assistant_message.trim().is_empty())
                .then_some(last_assistant_message),
            target,
        }),
        ..RuntimeHookEventContext::default()
    };
    let evaluation =
        evaluate_hook_event_async(&snapshot, event_name, &context, hook_step.reporter.as_ref())
            .await;
    StopHookEvaluation {
        should_stop: evaluation.is_aborted(),
        block_reason: if evaluation.is_aborted() {
            None
        } else {
            evaluation.blocking_reason()
        },
        continuation_fragments: evaluation
            .decisions
            .iter()
            .filter_map(|decision| {
                let text = match &decision.outcome {
                    tool_runtime::hook_lifecycle::RuntimeHookOutcome::Block { reason } => {
                        reason.clone()
                    }
                    tool_runtime::hook_lifecycle::RuntimeHookOutcome::Failed { reason } => {
                        format!("hook {} fail closed: {reason:?}", decision.key)
                    }
                    _ => return None,
                };
                Some(HookPromptFragment {
                    text,
                    hook_run_id: decision.run_id.clone(),
                })
            })
            .collect(),
    }
}

pub(super) fn hook_prompt_provider_message(
    fragments: &[HookPromptFragment],
) -> Option<CurrentProviderMessage> {
    let content = fragments
        .iter()
        .map(HookPromptFragment::provider_text)
        .collect::<Option<Vec<_>>>()?
        .into_iter()
        .map(CurrentProviderContent::Text)
        .collect::<Vec<_>>();
    (!content.is_empty()).then(|| CurrentProviderMessage::user(content))
}

fn hook_prompt_item(
    session_config: &AgentSessionConfig,
    turn_id: &str,
    index: u64,
    fragments: Vec<HookPromptFragment>,
) -> Result<ThreadItem, RuntimeReplyAttemptError> {
    let thread_id = session_config
        .thread_id
        .as_deref()
        .filter(|thread_id| !thread_id.trim().is_empty())
        .ok_or_else(|| {
            RuntimeReplyAttemptError::new("Hook prompt requires a canonical thread_id", false)
        })?;
    let mut item = ThreadItem::new(
        SessionId::new(session_config.id.clone()),
        ThreadId::new(thread_id),
        agent_protocol::TurnId::new(turn_id),
        0,
        0,
        ThreadItemPayload::HookPrompt { fragments },
    );
    item.item_id = ItemId::new(format!("hook-prompt-{turn_id}-{index}"));
    item.status = ItemStatus::Completed;
    Ok(item)
}
