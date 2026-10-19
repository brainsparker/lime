use super::*;
use crate::model_request_policy::ModelNativeToolPolicySnapshot;
use crate::request_tool_policy::{resolve_request_tool_policy_with_mode, RequestToolPolicyMode};
use serde_json::json;

#[test]
fn async_questions_require_trusted_root_config_and_model_capability() {
    for is_root_agent in [false, true] {
        for enabled in [false, true] {
            for supported in [
                None,
                Some("request_user_input_async"),
                Some("send_user_message_async"),
                Some("other"),
            ] {
                let policy = AsyncUserInputPolicy {
                    is_root_agent,
                    experimental_request_user_input_enabled: enabled,
                };
                let model = supported.map(|name| ModelNativeToolPolicySnapshot {
                    shell_type: None,
                    shell_tool_enabled: true,
                    preferred_shell_surface: None,
                    apply_patch_tool_type: None,
                    apply_patch_tool_enabled: true,
                    experimental_supported_tools: vec![name.to_string()],
                });
                assert_eq!(
                    policy.allows(model.as_ref()),
                    is_root_agent
                        && enabled
                        && matches!(
                            supported,
                            Some("request_user_input_async" | "send_user_message_async")
                        )
                );
            }
        }
    }
    assert!(!AsyncUserInputPolicy::default().allows(None));
    let exposure = tool_exposure("request_user_input_async");
    assert!(exposure.is_direct());
    assert!(!exposure.is_available_in_code_mode());
}

#[test]
fn async_questions_are_not_registered_from_renderer_metadata() {
    let context = agent_protocol::turn_context::TurnContextOverride {
        metadata: HashMap::from([(
            "runtime_request".to_string(),
            json!({
                "is_root_agent": true,
                "experimental_request_user_input_enabled": true,
                "experimental_supported_tools": ["request_user_input_async"]
            }),
        )]),
        ..Default::default()
    };
    let snapshot =
        tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant());
    let policy = resolve_request_tool_policy_with_mode(None, Some(RequestToolPolicyMode::Auto));
    let (definitions, _) = tool_definitions(
        &AgentRuntimeState::new(),
        &policy,
        Some(&context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default(),
    )
    .unwrap();
    assert!(!definitions
        .iter()
        .any(|definition| definition.name == "request_user_input_async"
            || definition.name == "send_user_message_async"));
}

#[test]
fn model_capability_registers_only_current_name_and_cannot_be_spoofed_by_dynamic_tools() {
    let mut context = agent_protocol::turn_context::TurnContextOverride {
        metadata: HashMap::from([(
            "model_request_policy".to_string(),
            json!({
                "native_tool_policy": {"experimental_supported_tools": ["send_user_message_async"]}
            }),
        )]),
        ..Default::default()
    };
    let state = AgentRuntimeState::new();
    let snapshot =
        tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant());
    let policy = resolve_request_tool_policy_with_mode(None, Some(RequestToolPolicyMode::Auto));
    let trusted = AsyncUserInputPolicy {
        is_root_agent: true,
        experimental_request_user_input_enabled: true,
    };
    let (definitions, _) =
        tool_definitions(&state, &policy, Some(&context), &snapshot, None, trusted).unwrap();
    assert!(definitions
        .iter()
        .any(|definition| definition.name == "request_user_input_async"));
    assert!(!definitions
        .iter()
        .any(|definition| definition.name == "send_user_message_async"));
    context.metadata.insert("runtime_request".to_string(), json!({"dynamicTools": [{
        "type": "function", "name": "request_user_input_async", "description": "Cannot bypass root authority", "inputSchema": {"type": "object"}
    }]}));
    assert!(tool_definitions(
        &state,
        &policy,
        Some(&context),
        &snapshot,
        None,
        AsyncUserInputPolicy::default()
    )
    .is_err());
}
