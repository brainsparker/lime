use super::*;
use crate::request_tool_policy::{resolve_request_tool_policy_with_mode, RequestToolPolicyMode};
use serde_json::json;
use std::collections::HashMap;
use tool_runtime::turn_tool_surface::{
    RUNTIME_METADATA_KEY, RUNTIME_TOOL_SURFACE_KEY, TURN_TOOL_SURFACE_COMPACT_TOOLS,
    TURN_TOOL_SURFACE_DIRECT_ANSWER,
};

#[tokio::test]
async fn memory_agent_filters_every_snapshot_and_rejects_direct_extension_calls() {
    let state = AgentRuntimeState::new();
    state
        .register_tool_search_tools(Arc::new(EmptyToolSearchGateway))
        .await
        .unwrap();
    let root = tempfile::tempdir().unwrap();
    let policy = tool_runtime::internal_agent::InternalAgentPolicy::memory(
        root.path().to_path_buf(),
        tool_runtime::sandbox::sandbox_policy_from_label(None).unwrap(),
    );
    let (event_sender, _events) = tokio::sync::mpsc::unbounded_channel();
    let source = CurrentTurnToolStepSnapshotSource {
        state,
        policy: crate::request_tool_policy::resolve_request_tool_policy(None),
        turn_context: None,
        event_sender,
        thread_id: ThreadId::new("memory-thread"),
        session_id: "memory-session".into(),
        agent_control_gateway: None,
        pending_input: None,
        deferred_tools: Default::default(),
        mcp_tool_routes: Default::default(),
        dynamic_tool_routes: Default::default(),
        tool_mode: code_mode::RuntimeToolMode::Direct,
        supports_custom_tools: false,
        async_user_input_policy: AsyncUserInputPolicy::default(),
        internal_agent_policy: Some(policy.clone()),
    };
    for _step in 0..2 {
        let snapshot = source.capture(None).await.unwrap();
        assert!(snapshot.definitions.iter().any(|d| d.name == "apply_patch"));
        assert!(snapshot
            .definitions
            .iter()
            .any(|d| d.name == "exec_command"));
        assert!(snapshot
            .definitions
            .iter()
            .all(|d| policy.allows_tool(&d.name)));
        let context = tool_runtime::tool_executor::RuntimeToolExecutionContext::new(
            tool_runtime::tool_executor::RuntimeToolExecutionContextInput {
                working_directory: root.path().to_path_buf(),
                session_id: "memory-session".into(),
                cancel_token: None,
                workspace_sandbox: None,
            },
        );
        for name in [
            "tool_search",
            "spawn_agent",
            "memory_store",
            "request_permissions",
            "request_user_input",
            "request_user_input_async",
            "mcp__host__write",
            "apps__send",
            "plugin__execute",
        ] {
            let error = snapshot
                .executor
                .execute(tool_runtime::tool_executor::RuntimeToolExecutionRequest {
                    tool_name: name,
                    params: &serde_json::json!({}),
                    context: &context,
                    turn_context: None,
                })
                .await
                .unwrap_err();
            assert!(!error.handler_executed(), "{name}");
            assert!(
                error.message().contains("internal memory agent"),
                "{name}: {}",
                error.message()
            );
        }
    }
}

fn turn_context_with_tool_surface(
    surface: &str,
) -> agent_protocol::turn_context::TurnContextOverride {
    agent_protocol::turn_context::TurnContextOverride {
        metadata: HashMap::from([(
            RUNTIME_METADATA_KEY.to_string(),
            json!({ RUNTIME_TOOL_SURFACE_KEY: surface }),
        )]),
        ..Default::default()
    }
}

#[test]
fn context_window_tools_follow_the_model_context_policy_and_auto_compact_gate() {
    let state = AgentRuntimeState::new();
    let policy = resolve_request_tool_policy_with_mode(None, Some(RequestToolPolicyMode::Auto));
    let snapshot =
        tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant());
    let mut context = agent_protocol::turn_context::TurnContextOverride::default();
    context.metadata.insert(
        "lime_runtime".to_string(),
        json!({"context_policy": {"model_context_window": 128000}}),
    );
    let definitions = tool_definitions(
        &state,
        &policy,
        Some(&context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("context tools enabled")
    .0;
    assert!(definitions
        .iter()
        .any(|definition| definition.name == GET_CONTEXT_REMAINING_TOOL_NAME));
    assert!(definitions
        .iter()
        .any(|definition| definition.name == NEW_CONTEXT_WINDOW_TOOL_NAME));

    context.metadata.insert(
        "lime_runtime".to_string(),
        json!({
            "context_policy": {"model_context_window": 128000},
            "auto_compact": false
        }),
    );
    let definitions = tool_definitions(
        &state,
        &policy,
        Some(&context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("context tools disabled")
    .0;
    assert!(!definitions
        .iter()
        .any(|definition| definition.name == GET_CONTEXT_REMAINING_TOOL_NAME));
    assert!(!definitions
        .iter()
        .any(|definition| definition.name == NEW_CONTEXT_WINDOW_TOOL_NAME));
}

#[tokio::test]
async fn provider_step_applies_structured_turn_tool_surface() {
    let state = AgentRuntimeState::new();
    state
        .register_tool_search_tools(Arc::new(EmptyToolSearchGateway))
        .await
        .expect("tool search registration");
    let policy = resolve_request_tool_policy_with_mode(None, Some(RequestToolPolicyMode::Auto));
    let snapshot =
        tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant());
    let full = tool_definitions(
        &state,
        &policy,
        None,
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("full definitions")
    .0;
    let compact_context = turn_context_with_tool_surface(TURN_TOOL_SURFACE_COMPACT_TOOLS);
    let compact = tool_definitions(
        &state,
        &policy,
        Some(&compact_context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("compact definitions")
    .0;
    let direct_context = turn_context_with_tool_surface(TURN_TOOL_SURFACE_DIRECT_ANSWER);
    let direct = tool_definitions(
        &state,
        &policy,
        Some(&direct_context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("direct definitions")
    .0;

    assert!(compact.len() < full.len());
    assert!(!full.iter().any(|tool| tool.name == "update_plan"));
    assert!(compact.iter().any(|tool| tool.name == "WebSearch"));
    assert!(compact.iter().any(|tool| tool.name == "tool_search"));
    assert!(compact.iter().any(|tool| tool.name == "exec_command"));
    assert!(compact.iter().any(|tool| tool.name == "write_stdin"));
    assert!(compact.iter().any(|tool| tool.name == "apply_patch"));
    assert!(compact.iter().any(|tool| tool.name == "request_user_input"));
    assert!(!compact.iter().any(|tool| tool.name == "update_plan"));
    assert!(direct.is_empty());

    let mut enabled_context = agent_protocol::turn_context::TurnContextOverride::default();
    enabled_context.metadata.insert(
        "config".to_string(),
        json!({
            "agent": {
                "toolExecution": { "update_plan_enabled": true }
            }
        }),
    );
    let enabled = tool_definitions(
        &state,
        &policy,
        Some(&enabled_context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("enabled definitions")
    .0;
    assert!(enabled.iter().any(|tool| tool.name == "update_plan"));
}

#[test]
fn primary_environment_defaults_native_tools_without_overriding_mcp_provenance() {
    let definitions = vec![
        RuntimeToolDefinition::new("exec_command", "Execute", json!({})),
        RuntimeToolDefinition::new("docs__search", "Search docs", json!({})),
    ];
    let environment_ids = resolved_tool_environment_ids(
        &definitions,
        HashMap::from([("docs__search".to_string(), "local".to_string())]),
        Some("remote-primary"),
    );

    assert_eq!(
        environment_ids.get("exec_command").map(String::as_str),
        Some("remote-primary")
    );
    assert_eq!(
        environment_ids.get("docs__search").map(String::as_str),
        Some("local")
    );
}

#[test]
fn compact_surface_defers_agent_control_unless_explicitly_allowed() {
    let state = AgentRuntimeState::new();
    let policy = resolve_request_tool_policy_with_mode(None, Some(RequestToolPolicyMode::Auto));
    let snapshot =
        tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant());
    let compact_context = turn_context_with_tool_surface(TURN_TOOL_SURFACE_COMPACT_TOOLS);

    let without_gateway = tool_definitions(
        &state,
        &policy,
        Some(&compact_context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("definitions")
    .0;
    assert!(!without_gateway
        .iter()
        .any(|tool| { tool_runtime::agent_control::is_agent_control_tool_name(&tool.name) }));

    let gateway = tool_runtime::agent_control::AgentControlGatewayHandle::new(Arc::new(
        RejectingAgentControlGateway,
    ));
    let with_gateway = tool_definitions(
        &state,
        &policy,
        Some(&compact_context),
        &snapshot,
        Some(&gateway),
        AsyncUserInputPolicy::default(),
    )
    .expect("definitions")
    .0;
    assert!(!with_gateway
        .iter()
        .any(|tool| tool_runtime::agent_control::is_agent_control_tool_name(&tool.name)));

    let mut explicitly_allowed_context = compact_context;
    explicitly_allowed_context.metadata.insert(
        "tool_scope".to_string(),
        json!({ "allowed_tools": ["spawn_agent", "list_agents"] }),
    );
    let explicitly_allowed = tool_definitions(
        &state,
        &policy,
        Some(&explicitly_allowed_context),
        &snapshot,
        Some(&gateway),
        AsyncUserInputPolicy::default(),
    )
    .expect("definitions")
    .0;
    let names = explicitly_allowed
        .iter()
        .filter(|tool| tool_runtime::agent_control::is_agent_control_tool_name(&tool.name))
        .map(|tool| tool.name.as_str())
        .collect::<Vec<_>>();
    assert_eq!(names, vec!["list_agents", "spawn_agent"]);

    let full = tool_definitions(
        &state,
        &policy,
        None,
        &snapshot,
        Some(&gateway),
        AsyncUserInputPolicy::default(),
    )
    .expect("definitions")
    .0;
    assert_eq!(
        full.iter()
            .filter(|tool| tool_runtime::agent_control::is_agent_control_tool_name(&tool.name))
            .count(),
        tool_runtime::agent_control::agent_control_tool_definitions().len()
    );
}

struct RejectingAgentControlGateway;

struct EmptyToolSearchGateway;

#[async_trait::async_trait]
impl tool_runtime::tool_search::ToolSearchGateway for EmptyToolSearchGateway {
    async fn search_tools(
        &self,
        _params: app_server_protocol::McpToolSearchParams,
    ) -> Result<app_server_protocol::McpToolListResponse, String> {
        Ok(app_server_protocol::McpToolListResponse { tools: Vec::new() })
    }
}

#[async_trait::async_trait]
impl tool_runtime::agent_control::AgentControlGateway for RejectingAgentControlGateway {
    async fn execute(
        &self,
        _request: tool_runtime::agent_control::AgentControlGatewayRequest,
    ) -> Result<
        tool_runtime::agent_control::AgentControlGatewayResult,
        tool_runtime::agent_control::AgentControlGatewayError,
    > {
        Err(tool_runtime::agent_control::AgentControlGatewayError::new(
            "test gateway must not execute",
        ))
    }
}

#[tokio::test]
async fn deferred_tool_selections_are_turn_local_and_report_real_updates() {
    let first_turn = DeferredToolSelections::default();
    let second_turn = DeferredToolSelections::default();
    let mut result = CallToolResult::success(Vec::new());
    result.structured_content = Some(serde_json::json!({
        "matches": ["docs__query", "docs__query", "  "],
        "tool_surface_updated": false
    }));

    assert!(
        first_turn
            .activate_from_tool_search_result(&mut result)
            .await
    );
    assert_eq!(
        result
            .structured_content
            .as_ref()
            .and_then(|value| value.get("tool_surface_updated")),
        Some(&Value::Bool(true))
    );
    assert_eq!(
        first_turn.snapshot().await,
        HashSet::from(["docs__query".to_string()])
    );
    assert!(second_turn.snapshot().await.is_empty());

    assert!(
        !first_turn
            .activate_from_tool_search_result(&mut result)
            .await
    );
    assert_eq!(
        result
            .structured_content
            .as_ref()
            .and_then(|value| value.get("tool_surface_updated")),
        Some(&Value::Bool(false))
    );
}

#[test]
fn trusted_dynamic_tools_freeze_exact_namespace_route_and_reject_collisions() {
    let state = AgentRuntimeState::new();
    let policy = resolve_request_tool_policy_with_mode(None, Some(RequestToolPolicyMode::Auto));
    let snapshot =
        tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant());
    let context = agent_protocol::turn_context::TurnContextOverride {
        metadata: HashMap::from([(
            "runtime_request".to_string(),
            json!({
                "dynamicTools": [{
                    "type": "namespace",
                    "name": "desktop",
                    "description": "Desktop host",
                    "tools": [{
                        "type": "function",
                        "name": "appInfo",
                        "description": "Read app information",
                        "inputSchema": {"type": "object", "properties": {}}
                    }]
                }]
            }),
        )]),
        ..Default::default()
    };
    let (definitions, routes) = tool_definitions(
        &state,
        &policy,
        Some(&context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .expect("dynamic definitions");
    assert!(definitions
        .iter()
        .any(|definition| definition.name == "desktop__appInfo"));
    assert_eq!(
        routes,
        vec![DynamicToolRoute {
            runtime_tool_name: "desktop__appInfo".to_string(),
            namespace: Some("desktop".to_string()),
            tool: "appInfo".to_string(),
        }]
    );

    let collision = agent_protocol::turn_context::TurnContextOverride {
        metadata: HashMap::from([(
            "runtime_request".to_string(),
            json!({
                "dynamicTools": [{
                    "type": "function",
                    "name": "exec_command",
                    "description": "Collision",
                    "inputSchema": {"type": "object"}
                }]
            }),
        )]),
        ..Default::default()
    };
    assert!(tool_definitions(
        &state,
        &policy,
        Some(&collision),
        &snapshot,
        None,
        AsyncUserInputPolicy::default()
    )
    .is_err());
}

#[test]
fn code_mode_step_requires_model_capability_and_executable_session() {
    let tools = vec![RuntimeToolSnapshot::new(
        RuntimeToolIdentity::plain("read"),
        RuntimeToolDefinition::new("read", "Read a file", json!({})),
        RuntimeToolExposure::Direct,
        false,
        true,
    )];

    let direct = code_mode_step_plan(&tools, code_mode::RuntimeToolMode::Direct, true, true)
        .expect("direct mode");
    assert_eq!(
        direct.tool_plan.resolution.effective,
        code_mode::RuntimeToolMode::Direct
    );
    assert!(!direct.attach_session);

    let missing_capability =
        code_mode_step_plan(&tools, code_mode::RuntimeToolMode::CodeMode, false, true)
            .expect("regular CodeMode falls back to direct");
    assert_eq!(
        missing_capability.tool_plan.resolution.effective,
        code_mode::RuntimeToolMode::Direct
    );
    assert!(!missing_capability.attach_session);

    let executable = code_mode_step_plan(&tools, code_mode::RuntimeToolMode::CodeMode, true, true)
        .expect("executable CodeMode");
    assert_eq!(
        executable.tool_plan.resolution.effective,
        code_mode::RuntimeToolMode::CodeMode
    );
    assert!(executable.attach_session);
    assert_eq!(executable.tool_plan.nested_tools[0].global_name, "read");

    assert!(code_mode_step_plan(
        &tools,
        code_mode::RuntimeToolMode::CodeModeOnly,
        true,
        false,
    )
    .is_err());
}
