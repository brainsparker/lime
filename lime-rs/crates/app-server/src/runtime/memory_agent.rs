//! Memory consolidation is an ephemeral session of this RuntimeCore, not a second harness.

use super::{RuntimeCore, RuntimeCoreError, RuntimeHostContext};
use crate::{MemoryAgent, MemoryAgentError, MemoryAgentRequest};
use app_server_protocol::*;
use async_trait::async_trait;
use serde_json::json;
use std::time::Duration;
use tool_runtime::internal_agent::InternalAgentPolicy;

#[async_trait]
impl MemoryAgent for RuntimeCore {
    async fn run(&self, mut request: MemoryAgentRequest) -> Result<(), MemoryAgentError> {
        let cancellation = request.cancellation.child_token();
        request.cancellation = cancellation.clone();
        let _cancel_on_drop = cancellation.drop_guard();
        let runtime = self.clone();
        tokio::spawn(async move { runtime.run_memory_agent(request).await })
            .await
            .map_err(|e| MemoryAgentError {
                cause: RuntimeCoreError::Backend(format!("memory agent task failed: {e}")),
                shutdown_complete: false,
            })?
    }
}

impl RuntimeCore {
    async fn run_memory_agent(&self, request: MemoryAgentRequest) -> Result<(), MemoryAgentError> {
        let parent = self.session_snapshot(&request.route.session_id)?.0;
        let metadata = parent
            .business_object_ref
            .as_ref()
            .and_then(|r| r.metadata.as_ref());
        // The parent's admitted permission profile is retained only for explicit unmanaged modes.
        let value =
            metadata.and_then(|m| m.get("sandboxPolicy").or_else(|| m.get("sandbox_policy")));
        let parent_policy = match value {
            Some(serde_json::Value::Object(_)) => serde_json::from_value(value.unwrap().clone())
                .map_err(|e| {
                    RuntimeCoreError::Backend(format!("invalid parent sandbox policy: {e}"))
                })?,
            _ => tool_runtime::sandbox::sandbox_policy_from_label(
                value.and_then(serde_json::Value::as_str),
            )
            .map_err(|e| RuntimeCoreError::Backend(e.to_string()))?,
        };
        let route_snapshot = metadata.and_then(|m| m.get("agentControlRoute")).cloned();
        let root = std::fs::canonicalize(&request.root)
            .map_err(|e| RuntimeCoreError::Backend(e.to_string()))?;
        let policy = InternalAgentPolicy::memory(root.clone(), parent_policy);
        let session = self.start_session(AgentSessionStartParams {
            session_id: None, thread_id: None, app_id: parent.app_id,
            workspace_id: None, locale: None,
            business_object_ref: Some(BusinessObjectRef {
                kind: "internal".to_string(), id: "memory".to_string(), title: None, uri: None,
                metadata: Some(json!({
                    "ephemeral": true, "hiddenFromUserRecents": true, "memoryMode": "disabled",
                    "threadSource": "memory_consolidation", "workingDir": root,
                    "providerSelector": request.route.provider, "modelName": request.route.model,
                })),
            }),
        })?.session;
        self.state
            .lock()
            .expect("runtime state")
            .internal_agents
            .insert(session.session_id.clone(), policy.clone());
        let mut options = RuntimeOptions::default();
        let runtime = options.runtime_request_mut();
        runtime.provider_preference = Some(request.route.provider);
        runtime.model_preference = Some(request.route.model);
        runtime.reasoning_effort = request.route.reasoning_effort;
        runtime.service_tier = request.route.service_tier;
        runtime.approval_policy = Some("never".to_string());
        runtime.sandbox_policy = Some(policy.process_label().to_string());
        runtime.working_dir = Some(root.to_string_lossy().into_owned());
        runtime.workspace_root = runtime.working_dir.clone();
        runtime.project_root = runtime.working_dir.clone();
        runtime.web_search = Some(false);
        runtime.metadata =
            Some(json!({ "memoryMode": "disabled", "agentControlRoute": route_snapshot }));
        let params = AgentSessionTurnStartParams {
            session_id: session.session_id.clone(),
            turn_id: None,
            input: AgentInput {
                text: request.prompt,
                attachments: Vec::new(),
            },
            runtime_options: Some(options),
            queue_if_busy: false,
            skip_pre_submit_resume: false,
        };
        let execution = self.start_turn_inner(
            params.into(),
            RuntimeHostContext::default(),
            None,
            false,
            false,
            super::turn_start::TurnStartInputKind::User,
        );
        let result = tokio::select! {
            biased;
            _ = request.cancellation.cancelled() => Err(RuntimeCoreError::RequestCanceled),
            result = execution => result.and_then(|output| {
                if output.response.turn.status == AgentTurnStatus::Completed { Ok(()) }
                else { Err(RuntimeCoreError::Backend(format!("memory agent terminal status: {:?}", output.response.turn.status))) }
            }),
        };
        // Shutdown owns cancellation, process drains, session actor and provider teardown.
        match tokio::time::timeout(
            Duration::from_secs(10),
            self.shutdown_internal_session(&session.session_id),
        )
        .await
        {
            Ok(Ok(())) => result.map_err(Into::into),
            Ok(Err(cause)) => Err(MemoryAgentError {
                cause,
                shutdown_complete: false,
            }),
            Err(_) => Err(MemoryAgentError {
                cause: RuntimeCoreError::Backend("memory agent shutdown timed out".to_string()),
                shutdown_complete: false,
            }),
        }
    }
}

#[cfg(test)]
mod tests;
