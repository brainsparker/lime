use super::*;
use agent_protocol::{ItemStatus, SessionId, ThreadId, ThreadItemPayload};
use std::collections::HashMap;
use tool_runtime::tool_lifecycle::{ToolLifecycleEvent, ToolLifecyclePhase};
use tool_runtime::tool_result_projection::NormalizedToolOutput;

fn tool_item_context() -> ToolItemLifecycleContext {
    ToolItemLifecycleContext {
        session_id: SessionId::new("session-1"),
        thread_id: ThreadId::new("thread-1"),
        sequence: 1,
        ordinal: 1,
        created_at_ms: 1,
        updated_at_ms: 2,
    }
}

fn unified_exec_output(running: bool) -> NormalizedToolOutput {
    let mut metadata = HashMap::from([
        (
            "exec_command_call_id".to_string(),
            serde_json::json!("exec-call"),
        ),
        ("command".to_string(), serde_json::json!("printf done")),
        ("cwd".to_string(), serde_json::json!("/tmp/project")),
        (
            "command_output".to_string(),
            serde_json::json!(if running { "" } else { "done" }),
        ),
        (
            "exit_code".to_string(),
            if running {
                Value::Null
            } else {
                serde_json::json!(0)
            },
        ),
    ]);
    if running {
        metadata.insert("session_id".to_string(), serde_json::json!(1001));
    }
    NormalizedToolOutput {
        history_token_limit: None,
        success: true,
        text: "{}".to_string(),
        structured_content: None,
        error: None,
        duration_ms: 10,
        truncation: None,
        sidecar_reference: None,
        metadata,
        agent_control_projection_facts: Vec::new(),
        agent_control_state_facts: Vec::new(),
    }
}

#[test]
fn canonical_history_budget_uses_only_typed_host_value_and_preserves_zero() {
    use agent_protocol::truncation::HISTORY_TOKEN_LIMIT_KEY;
    for limit in [None, Some(0), Some(17)] {
        let mut output = unified_exec_output(false);
        output.history_token_limit = limit;
        output
            .metadata
            .insert(HISTORY_TOKEN_LIMIT_KEY.into(), serde_json::json!(99999));
        let event = canonical_tool_item_event(
            ToolLifecycleEvent {
                turn_id: "turn-history".into(),
                call_id: "call-history".into(),
                tool_name: "Read".into(),
                arguments: serde_json::json!({}),
                provider_metadata: Value::Null,
                environments: Vec::new(),
                phase: ToolLifecyclePhase::Completed,
                output: Some(output),
            },
            tool_item_context(),
        )
        .unwrap();
        let AgentEvent::ItemCompleted { item } = event else {
            panic!("completed tool")
        };
        assert_eq!(
            item.metadata.get(HISTORY_TOKEN_LIMIT_KEY),
            limit.map(Value::from).as_ref()
        );
    }
}

#[test]
fn aborted_tool_output_projects_cancelled_item_status() {
    let event = canonical_tool_item_event(
        ToolLifecycleEvent {
            turn_id: "turn-aborted".to_string(),
            call_id: "call-aborted".to_string(),
            tool_name: "sleep".to_string(),
            arguments: serde_json::json!({}),
            provider_metadata: Value::Null,
            environments: Vec::new(),
            phase: ToolLifecyclePhase::Completed,
            output: Some(NormalizedToolOutput {
                history_token_limit: None,
                success: false,
                text: "Tool execution aborted".to_string(),
                structured_content: None,
                error: None,
                duration_ms: 1,
                truncation: None,
                sidecar_reference: None,
                metadata: HashMap::from([(
                    tool_runtime::tool_result_projection::TOOL_OUTCOME_METADATA_KEY.to_string(),
                    Value::String(
                        tool_runtime::tool_result_projection::TOOL_OUTCOME_ABORTED.to_string(),
                    ),
                )]),
                agent_control_projection_facts: Vec::new(),
                agent_control_state_facts: Vec::new(),
            }),
        },
        tool_item_context(),
    )
    .expect("aborted tool lifecycle event");

    let AgentEvent::ItemCompleted { item } = event else {
        panic!("aborted tool should produce one terminal item");
    };
    assert_eq!(item.status, ItemStatus::Cancelled);
}

#[test]
fn exec_command_projects_canonical_command_lifecycle() {
    let started = canonical_tool_item_event(
        ToolLifecycleEvent {
            turn_id: "turn-1".to_string(),
            call_id: "exec-call".to_string(),
            tool_name: "exec_command".to_string(),
            arguments: serde_json::json!({ "cmd": "printf done" }),
            provider_metadata: Value::Null,
            environments: Vec::new(),
            phase: ToolLifecyclePhase::Started,
            output: None,
        },
        tool_item_context(),
    )
    .expect("command started event");
    let AgentEvent::ItemStarted { item } = started else {
        panic!("expected item started");
    };
    assert!(matches!(item.payload, ThreadItemPayload::Command { .. }));

    let updated = canonical_tool_item_event(
        ToolLifecycleEvent {
            turn_id: "turn-1".to_string(),
            call_id: "exec-call".to_string(),
            tool_name: "exec_command".to_string(),
            arguments: serde_json::json!({ "cmd": "printf done" }),
            provider_metadata: Value::Null,
            environments: Vec::new(),
            phase: ToolLifecyclePhase::Completed,
            output: Some(unified_exec_output(true)),
        },
        tool_item_context(),
    )
    .expect("running command update");
    let AgentEvent::ItemUpdated { item } = updated else {
        panic!("expected item updated");
    };
    assert_eq!(item.item_id.as_str(), "item_exec-call");
    assert_eq!(item.status, ItemStatus::InProgress);
}

#[test]
fn write_stdin_completes_original_command_item_without_second_started_item() {
    let started = canonical_tool_item_event(
        ToolLifecycleEvent {
            turn_id: "turn-1".to_string(),
            call_id: "write-call".to_string(),
            tool_name: "write_stdin".to_string(),
            arguments: serde_json::json!({ "session_id": 1001, "chars": "" }),
            provider_metadata: Value::Null,
            environments: Vec::new(),
            phase: ToolLifecyclePhase::Started,
            output: None,
        },
        tool_item_context(),
    );
    assert!(started.is_none());

    let completed = canonical_tool_item_event(
        ToolLifecycleEvent {
            turn_id: "turn-1".to_string(),
            call_id: "write-call".to_string(),
            tool_name: "write_stdin".to_string(),
            arguments: serde_json::json!({ "session_id": 1001, "chars": "" }),
            provider_metadata: Value::Null,
            environments: Vec::new(),
            phase: ToolLifecyclePhase::Completed,
            output: Some(unified_exec_output(false)),
        },
        tool_item_context(),
    )
    .expect("original command completion");
    let AgentEvent::ItemCompleted { item } = completed else {
        panic!("expected item completed");
    };
    assert_eq!(item.item_id.as_str(), "item_exec-call");
    assert!(matches!(
        item.payload,
        ThreadItemPayload::Command {
            output: Some(ref output),
            exit_code: Some(0),
            ..
        } if output == "done"
    ));
}

#[test]
fn agent_op_user_input_serializes_with_protocol_tag() {
    let value = serde_json::to_value(AgentOp::UserInput(AgentUserInputOp {
        text: "继续处理当前任务".to_string(),
        images: vec![AgentImageAttachment {
            data: "aGVsbG8=".to_string(),
            media_type: "image/png".to_string(),
        }],
        preferences: AgentUserPreferences {
            provider_preference: Some("openai".to_string()),
            model_preference: Some("gpt-5.4".to_string()),
            thinking: Some(true),
            web_search: Some(false),
            search_mode: Some("disabled".to_string()),
            execution_strategy: Some("react".to_string()),
            task: Some(false),
            subagent: Some(false),
            theme: Some("general".to_string()),
            auto_continue: Some(serde_json::json!({
                "enabled": true,
                "continuation_length": 3
            })),
        },
        session_id: "session-1".to_string(),
        workspace_id: "workspace-1".to_string(),
        event_name: "agent_stream_session-1".to_string(),
        turn_id: Some("turn-1".to_string()),
        system_prompt: Some("保持简洁".to_string()),
        metadata: Some(Map::from_iter([(
            "theme".to_string(),
            Value::String("general".to_string()),
        )])),
        queue_if_busy: Some(true),
        queued_turn_id: Some("queued-1".to_string()),
    }))
    .expect("serialize agent op");

    assert_eq!(value["type"], "user_input");
    assert_eq!(value["preferences"]["provider_preference"], "openai");
    assert_eq!(value["session_id"], "session-1");
    assert_eq!(value["queue_if_busy"], true);
}

#[test]
fn agent_op_interrupt_deserializes_from_snake_case_tag() {
    let op: AgentOp = serde_json::from_value(serde_json::json!({
        "type": "interrupt",
        "session_id": "session-2",
        "turn_id": "turn-2"
    }))
    .expect("deserialize interrupt op");

    assert_eq!(
        op,
        AgentOp::Interrupt {
            session_id: "session-2".to_string(),
            turn_id: Some("turn-2".to_string()),
        }
    );
}

#[test]
fn agent_image_attachment_deserializes_media_type_alias() {
    let attachment: AgentImageAttachment = serde_json::from_value(serde_json::json!({
        "data": "aGVsbG8=",
        "mediaType": "image/png"
    }))
    .expect("deserialize image attachment");

    assert_eq!(attachment.media_type, "image/png");
}

#[test]
fn agent_event_runtime_status_serializes_with_protocol_tag() {
    let value = serde_json::to_value(AgentEvent::RuntimeStatus {
        status: AgentRuntimeStatus {
            phase: "routing".to_string(),
            title: "等待执行窗口".to_string(),
            detail: "系统正在安排执行窗口".to_string(),
            checkpoints: vec!["并发预算 1/2".to_string()],
            metadata: None,
        },
    })
    .expect("serialize runtime status");

    assert_eq!(value["type"], "runtime_status");
    assert_eq!(value["status"]["phase"], "routing");
}

#[test]
fn agent_event_provider_stream_event_serializes_current_payload() {
    let event = model_provider::provider_stream::RuntimeReplyProviderStreamEvent::SafetyBuffering(
        model_provider::safety::ProviderSafetyBufferingRuntimeEventPayload {
            kind: model_provider::safety::SAFETY_BUFFERING_RUNTIME_EVENT_KIND,
            provider: Some("openai".to_string()),
            model: Some("gpt-5-codex".to_string()),
            use_cases: vec!["policy".to_string()],
            reasons: vec!["buffering".to_string()],
            show_buffering_ui: true,
            retry_model: Some("gpt-5-mini".to_string()),
            fallback_header_model: None,
            source:
                model_provider::safety::ProviderSafetyBufferingRetryModelSource::PayloadRetryModel,
        },
    );
    let value = serde_json::to_value(AgentEvent::ProviderStreamEvent {
        runtime_event_kind: event.runtime_event_kind().to_string(),
        payload: event.payload_json_value(),
    })
    .expect("serialize provider stream event");

    assert_eq!(value["type"], "provider_stream_event");
    assert_eq!(value["runtime_event_kind"], "provider_safety_buffering");
    assert_eq!(value["payload"]["retryModel"], "gpt-5-mini");
    assert_eq!(value["payload"]["source"], "payload_retry_model");
    assert!(value["payload"].get("retry_model").is_none());
    assert!(value["payload"].get("fasterModel").is_none());
}

#[test]
fn agent_event_serializes_provider_neutral_model_facts() {
    let server_model = serde_json::to_value(AgentEvent::ServerModel {
        model: "gpt-5-codex".to_string(),
    })
    .expect("serialize server model");
    assert_eq!(server_model["type"], "server_model");
    assert_eq!(server_model["model"], "gpt-5-codex");

    let reroute = serde_json::to_value(AgentEvent::ModelReroute {
        from_model: "gpt-5-codex".to_string(),
        to_model: "gpt-5.1-codex".to_string(),
        reason: ModelRerouteReason::HighRiskCyberActivity,
    })
    .expect("serialize model reroute");
    assert_eq!(reroute["type"], "model_reroute");
    assert_eq!(reroute["from_model"], "gpt-5-codex");
    assert_eq!(reroute["to_model"], "gpt-5.1-codex");
    assert_eq!(reroute["reason"], "high_risk_cyber_activity");

    let verification = serde_json::to_value(AgentEvent::ModelVerification {
        verifications: vec![ModelVerification::TrustedAccessForCyber],
    })
    .expect("serialize model verification");
    assert_eq!(verification["type"], "model_verification");
    assert_eq!(
        verification["verifications"],
        serde_json::json!(["trusted_access_for_cyber"])
    );

    let moderation = serde_json::to_value(AgentEvent::TurnModerationMetadata {
        metadata: serde_json::json!({ "presentation": "inline" }),
    })
    .expect("serialize turn moderation metadata");
    assert_eq!(moderation["type"], "turn_moderation_metadata");
    assert_eq!(
        moderation["metadata"],
        serde_json::json!({ "presentation": "inline" })
    );
}

#[test]
fn diagnostics_runtime_status_metadata_marks_runtime_status_as_transient() {
    let metadata = build_diagnostics_runtime_status_metadata();

    assert_eq!(
        metadata.get("sourceType").and_then(Value::as_str),
        Some("runtime_status")
    );
    assert_eq!(
        metadata.get("visibility").and_then(Value::as_str),
        Some("diagnostics")
    );
    assert_eq!(
        metadata.get("persistence").and_then(Value::as_str),
        Some("transient")
    );
    assert_eq!(
        metadata
            .get("agentui")
            .and_then(|value| value.get("eventClass"))
            .and_then(Value::as_str),
        Some("run.status")
    );
}

#[test]
fn agent_event_text_delta_batch_serializes_with_protocol_tag() {
    let value = serde_json::to_value(AgentEvent::TextDeltaBatch {
        text: "第一段\n".to_string(),
        chunks: vec!["第一段".to_string(), "\n".to_string()],
        boundary: TextDeltaBatchBoundary::Newline,
    })
    .expect("serialize text delta batch");

    assert_eq!(value["type"], "text_delta_batch");
    assert_eq!(value["text"], "第一段\n");
    assert_eq!(value["chunks"][0], "第一段");
    assert_eq!(value["boundary"], "newline");
}

#[test]
fn agent_output_lifecycle_serializes_required_item_identity() {
    let events = [
        AgentEvent::TextStart {
            item_id: "message-1".to_string(),
        },
        AgentEvent::TextDelta {
            item_id: "message-1".to_string(),
            text: "answer".to_string(),
        },
        AgentEvent::TextEnd {
            item_id: "message-1".to_string(),
            phase: AgentMessagePhase::FinalAnswer,
        },
        AgentEvent::ReasoningSummaryDelta {
            item_id: "reasoning-1".to_string(),
            text: "inspect".to_string(),
            summary_index: 0,
        },
        AgentEvent::ReasoningSummaryPartAdded {
            item_id: "reasoning-1".to_string(),
            summary_index: 1,
        },
        AgentEvent::ReasoningContentDelta {
            item_id: "reasoning-1".to_string(),
            text: "raw".to_string(),
            content_index: 0,
        },
    ];
    let values = events
        .into_iter()
        .map(|event| serde_json::to_value(event).expect("serialize output lifecycle"))
        .collect::<Vec<_>>();

    assert_eq!(values[0]["type"], "text_start");
    assert_eq!(values[0]["itemId"], "message-1");
    assert_eq!(values[1]["type"], "text_delta");
    assert_eq!(values[1]["itemId"], "message-1");
    assert_eq!(values[2]["phase"], "final_answer");
    assert_eq!(values[2]["type"], "text_end");
    assert_eq!(values[2]["itemId"], "message-1");
    assert_eq!(values[3]["type"], "reasoning_summary_delta");
    assert_eq!(values[3]["itemId"], "reasoning-1");
    assert_eq!(values[3]["summaryIndex"], 0);
    assert_eq!(values[4]["type"], "reasoning_summary_part_added");
    assert_eq!(values[4]["itemId"], "reasoning-1");
    assert_eq!(values[4]["summaryIndex"], 1);
    assert_eq!(values[5]["type"], "reasoning_content_delta");
    assert_eq!(values[5]["itemId"], "reasoning-1");
    assert_eq!(values[5]["contentIndex"], 0);
}
