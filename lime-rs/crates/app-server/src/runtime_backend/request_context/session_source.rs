use crate::ExecutionRequest;
use lime_agent::AgentSessionSource;
use serde_json::Value;
use std::path::PathBuf;

/// Resolve the canonical typed session source persisted at ThreadSpawn admission.
///
/// `forked_from_thread_id` is deliberately ignored: Codex treats a normal fork as a
/// root `Stop` session, while only a typed ThreadSpawn receives `SubagentStop`.
pub(in crate::runtime_backend) fn session_source_from_request(
    request: &ExecutionRequest,
) -> AgentSessionSource {
    if request.internal_agent_policy.is_some() {
        return AgentSessionSource::MemoryConsolidation;
    }
    let metadata = request
        .session
        .business_object_ref
        .as_ref()
        .and_then(|reference| reference.metadata.as_ref())
        .and_then(Value::as_object)
        .and_then(|metadata| metadata.get("agentControlSource"))
        .and_then(Value::as_object);
    let Some(metadata) = metadata else {
        return AgentSessionSource::Root;
    };
    let kind = metadata
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match kind {
        "thread_spawn" => metadata
            .get("parentThreadId")
            .or_else(|| metadata.get("parent_thread_id"))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(|parent_thread_id| AgentSessionSource::ThreadSpawn {
                parent_thread_id: parent_thread_id.to_string(),
                agent_role: metadata
                    .get("agentRole")
                    .or_else(|| metadata.get("agent_role"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                parent_transcript_path: metadata
                    .get("parentTranscriptPath")
                    .or_else(|| metadata.get("parent_transcript_path"))
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .map(PathBuf::from),
                agent_transcript_path: metadata
                    .get("agentTranscriptPath")
                    .or_else(|| metadata.get("agent_transcript_path"))
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .map(PathBuf::from),
            })
            .unwrap_or_default(),
        "synthetic_subagent" => AgentSessionSource::SyntheticSubagent,

        _ => AgentSessionSource::Root,
    }
}
