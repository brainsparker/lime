use super::*;

pub(in crate::runtime) fn canonical_thread_from_stored_session(stored: &StoredSession) -> Thread {
    let session = &stored.session;
    let title = session
        .business_object_ref
        .as_ref()
        .and_then(|reference| reference.title.clone());
    let metadata = session
        .business_object_ref
        .as_ref()
        .and_then(|reference| reference.metadata.clone())
        .unwrap_or(serde_json::Value::Null);
    let model_provider = metadata
        .get("providerName")
        .or_else(|| metadata.get("provider_name"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_string();
    Thread {
        session_id: agent_protocol::SessionId::new(session.session_id.clone()),
        thread_id: ThreadId::new(session.thread_id.clone()),
        status: match session.status {
            AgentSessionStatus::Running => ThreadStatus::Active {
                active_flags: Vec::new(),
            },
            AgentSessionStatus::WaitingAction => ThreadStatus::Active {
                active_flags: vec![ThreadActiveFlag::WaitingOnApproval],
            },
            AgentSessionStatus::Failed => ThreadStatus::SystemError,
            AgentSessionStatus::Idle
            | AgentSessionStatus::Completed
            | AgentSessionStatus::Canceled => ThreadStatus::Idle,
        },
        created_at_ms: timestamp_millis(&session.created_at),
        updated_at_ms: timestamp_millis(&session.updated_at),
        archived: false,
        recency_at_ms: Some(timestamp_millis(&session.updated_at)),
        parent_thread_id: None,
        agent_path: None,
        agent_nickname: None,
        agent_role: None,
        last_task_message: None,
        agent_state: None,
        forked_from_id: metadata
            .get("forkedFromId")
            .and_then(serde_json::Value::as_str)
            .map(ThreadId::new),
        preview: title.clone().unwrap_or_default(),
        model_provider,
        product: (!session.app_id.trim().is_empty()).then(|| session.app_id.clone()),
        name: title,
        metadata,
        turns: Vec::new(),
        turns_view: ThreadTurnsView::NotLoaded,
    }
}

fn timestamp_millis(value: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|timestamp| timestamp.timestamp_millis())
        .unwrap_or_default()
}
