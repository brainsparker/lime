use super::*;

pub(super) fn validate_fork_params(params: &ThreadForkParams) -> Result<(), RuntimeCoreError> {
    if params.thread_id.trim().is_empty() {
        return Err(invalid("thread/fork requires a non-empty threadId"));
    }
    if params.last_turn_id.is_some() && params.before_turn_id.is_some() {
        return Err(invalid(
            "thread/fork beforeTurnId cannot be combined with lastTurnId",
        ));
    }
    if params.permissions.is_some() && params.sandbox.is_some() {
        return Err(invalid(
            "thread/fork permissions cannot be combined with sandbox",
        ));
    }
    if params
        .path
        .as_deref()
        .is_some_and(|path| !path.trim().is_empty())
    {
        return Err(invalid(
            "thread/fork path is not implemented by the current runtime boundary",
        ));
    }
    if params.ephemeral && params.defer_goal_continuation {
        return Err(invalid(
            "thread/fork deferGoalContinuation cannot be combined with ephemeral",
        ));
    }
    if params.ephemeral {
        return Err(invalid(
            "thread/fork ephemeral storage is not implemented by the current runtime boundary",
        ));
    }
    for (name, value) in [
        ("lastTurnId", params.last_turn_id.as_deref()),
        ("beforeTurnId", params.before_turn_id.as_deref()),
    ] {
        if value.is_some_and(|value| value.trim().is_empty()) {
            return Err(invalid(format!("thread/fork {name} must not be empty")));
        }
    }
    Ok(())
}

pub(super) fn fork_thread_snapshot(
    mut source: Thread,
    target_session_id: &str,
    target_thread_id: &str,
    now_ms: i64,
    params: &ThreadForkParams,
    history_sequence: u64,
) -> Result<Thread, RuntimeCoreError> {
    source.session_id = SessionId::new(target_session_id);
    source.thread_id = ThreadId::new(target_thread_id);
    source.status = ThreadStatus::Idle;
    source.created_at_ms = now_ms;
    source.updated_at_ms = now_ms;
    source.recency_at_ms = Some(now_ms);
    source.archived = false;
    source.parent_thread_id = None;
    source.agent_path = None;
    source.agent_nickname = None;
    source.agent_role = None;
    source.last_task_message = None;
    source.agent_state = None;
    source.forked_from_id = Some(ThreadId::new(params.thread_id.trim()));
    source.turns.clear();
    source.turns_view = ThreadTurnsView::NotLoaded;

    // Canonical Threads without optional session settings use null metadata.
    if source.metadata.is_null() {
        source.metadata = Value::Object(Map::new());
    }
    let metadata = source
        .metadata
        .as_object_mut()
        .ok_or_else(|| invalid("thread/fork source metadata must be a JSON object"))?;
    apply_fork_overrides(metadata, params);
    RuntimeCore::normalize_thread_working_directory_metadata(metadata)?;
    metadata.insert("forkSequence".to_string(), Value::from(history_sequence));
    if let Some(model_provider) = params.model_provider.as_deref() {
        source.model_provider = model_provider.to_string();
    }
    Ok(source)
}

fn apply_fork_overrides(metadata: &mut Map<String, Value>, params: &ThreadForkParams) {
    for (key, value) in [
        (
            "modelName",
            params
                .model
                .as_ref()
                .map(|value| Value::String(value.clone())),
        ),
        (
            "providerSelector",
            params
                .model_provider
                .as_ref()
                .map(|value| Value::String(value.clone())),
        ),
        (
            "providerName",
            params
                .model_provider
                .as_ref()
                .map(|value| Value::String(value.clone())),
        ),
        (
            "workingDir",
            params
                .cwd
                .as_ref()
                .map(|value| Value::String(value.clone())),
        ),
        (
            "runtimeWorkspaceRoots",
            params
                .runtime_workspace_roots
                .as_ref()
                .and_then(|value| serde_json::to_value(value).ok()),
        ),
        ("approvalPolicy", params.approval_policy.clone()),
        (
            "approvalsReviewer",
            params
                .approvals_reviewer
                .map(|reviewer| Value::String(reviewer.as_str().into())),
        ),
        ("sandbox", params.sandbox.clone()),
        (
            "permissions",
            params
                .permissions
                .as_ref()
                .map(|value| Value::String(value.clone())),
        ),
        (
            "config",
            params
                .config
                .as_ref()
                .and_then(|value| serde_json::to_value(value).ok()),
        ),
        (
            "baseInstructions",
            params
                .base_instructions
                .as_ref()
                .map(|value| Value::String(value.clone())),
        ),
        (
            "developerInstructions",
            params
                .developer_instructions
                .as_ref()
                .map(|value| Value::String(value.clone())),
        ),
        (
            "threadSource",
            params
                .thread_source
                .as_ref()
                .and_then(|value| serde_json::to_value(value).ok()),
        ),
    ] {
        if let Some(value) = value {
            metadata.insert(key.to_string(), value);
        }
    }
    if let Some(service_tier) = params.service_tier.as_ref() {
        metadata.insert(
            "serviceTier".to_string(),
            service_tier
                .as_ref()
                .map(|value| Value::String(value.clone()))
                .unwrap_or(Value::Null),
        );
    }
    metadata.insert("ephemeral".to_string(), Value::Bool(false));
}
