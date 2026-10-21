use super::super::{tool_lifecycle_emitter::CurrentTurnToolLifecycleEmitter, CurrentTurnHostEvent};
use super::*;
use serde_json::json;
use std::sync::Arc;
use tool_runtime::tool_call::ToolCall;
use tool_runtime::tool_executor::{
    RuntimeTool, RuntimeToolExecutionContext, RuntimeToolExecutionContextInput,
    RuntimeToolExecutorHandle,
};
use tool_runtime::tool_extension::RuntimeToolCaller;

#[tokio::test]
async fn async_questions_publish_before_accepted_without_session_response_owner() {
    for (enabled, arguments, expected) in [
        (
            true,
            json!({"questions": [{"title": "Choose", "options": ["First"]}]}),
            true,
        ),
        (
            true,
            json!({"questions": [{"title": "Good"}, {"title": " "}]}),
            false,
        ),
        (false, json!({"questions": [{"title": "Choose"}]}), false),
    ] {
        let (agent_sender, mut agent_events) = tokio::sync::mpsc::unbounded_channel();
        let executor = CurrentTurnToolExecutor {
            internal_agent_policy: None,
            state: AgentRuntimeState::new(),
            policy: crate::request_tool_policy::resolve_request_tool_policy(None),
            event_sender: agent_sender,
            thread_id: ThreadId::new("thread-1"),
            mcp_snapshot: tool_runtime::mcp_connection::McpStepSnapshot::empty(
                RuntimeToolCaller::assistant(),
            ),
            deferred_tools: mcp_step_snapshot::DeferredToolSelections::default(),
            agent_control_gateway: None,
            pending_input: None,
            dynamic_tool_routes: mcp_step_snapshot::DynamicToolRoutes::default(),
            async_user_input_enabled: enabled,
        };
        let (host_sender, mut host_events) = tokio::sync::mpsc::unbounded_channel();
        let emitter = Arc::new(CurrentTurnToolLifecycleEmitter::new(
            host_sender,
            "session-1",
            "thread-1",
        ));
        let tool = RuntimeTool::new(
            tool_runtime::request_user_input_async::request_user_input_async_tool_definition(),
            code_mode_protocol::RuntimeToolExposure::DirectModelOnly,
            RuntimeToolExecutorHandle::new(Arc::new(executor)),
        );
        let call = ToolCall::new(
            "turn-1",
            "question-call",
            "request_user_input_async",
            arguments,
            Vec::new(),
            emitter,
        );
        let context = RuntimeToolExecutionContext::new(RuntimeToolExecutionContextInput {
            working_directory: std::env::current_dir().unwrap(),
            session_id: "session-1".to_string(),
            cancel_token: None,
            workspace_sandbox: None,
        });
        let output = tokio::time::timeout(
            Duration::from_secs(1),
            tool.execute_call(&call, &context, None),
        )
        .await
        .expect("must not await a user reply");
        assert_eq!(output.success, expected);
        if expected {
            assert_eq!(output.text, r#"{"accepted":true}"#);
            assert!(matches!(
                host_events.try_recv(),
                Ok(CurrentTurnHostEvent::ToolLifecycle(
                    AgentEvent::ItemStarted { .. }
                ))
            ));
            assert!(matches!(
                host_events.try_recv(),
                Ok(CurrentTurnHostEvent::ToolLifecycle(
                    AgentEvent::ItemCompleted { .. }
                ))
            ));
        }
        assert!(host_events.try_recv().is_err());
        assert!(
            agent_events.try_recv().is_err(),
            "async questions must not publish ActionRequired"
        );
    }
}
