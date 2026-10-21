use super::{
    CurrentProviderContent, CurrentProviderToolCall, ProviderMetadata, RuntimeToolStepSnapshot,
    INVALID_TOOL_CALL_NAME, TOOL_CALL_REPAIR_METADATA_KEY,
};
use crate::session_loop::RuntimeSessionStepContext;
use std::collections::BTreeMap;
use tool_runtime::tool_call_surface::{
    repair_tool_call, runtime_tool_call_canonical_name, ToolCallRepairOutcome,
};

pub(super) fn model_call(
    id: String,
    name: String,
    input: serde_json::Value,
    raw_arguments: Option<String>,
    provider_metadata: ProviderMetadata,
) -> CurrentProviderToolCall {
    let raw_arguments = raw_arguments
        .unwrap_or_else(|| serde_json::to_string(&input).unwrap_or_else(|_| "{}".to_string()));
    CurrentProviderToolCall::from_raw(id, name, raw_arguments)
        .with_provider_metadata(provider_metadata)
}

pub(super) fn prepare_provider_tool_call(
    tool_step_snapshot: &RuntimeToolStepSnapshot,
    model_call: &CurrentProviderToolCall,
) -> CurrentProviderToolCall {
    let mut provider_metadata = model_call.provider_metadata.clone();
    let outcome = repair_tool_call(
        &tool_step_snapshot.definitions,
        &model_call.name,
        &model_call.raw_arguments,
        &runtime_tool_call_canonical_name,
    );

    match outcome {
        ToolCallRepairOutcome::Ready(repair) => {
            if repair.requested_name != repair.resolved_name || !repair.argument_changes.is_empty()
            {
                provider_metadata.insert(
                    TOOL_CALL_REPAIR_METADATA_KEY.to_string(),
                    serde_json::to_value(ToolCallRepairOutcome::Ready(repair.clone()))
                        .expect("tool call repair outcome must serialize"),
                );
            }
            let call = if repair.argument_changes.is_empty() {
                // 无参数修正时保留上游原文，避免模型历史被无意义地重新编码。
                CurrentProviderToolCall::from_raw(
                    model_call.id.clone(),
                    repair.resolved_name,
                    model_call.raw_arguments.clone(),
                )
            } else {
                CurrentProviderToolCall::new(
                    model_call.id.clone(),
                    repair.resolved_name,
                    serde_json::Value::Object(repair.arguments),
                )
            };
            call.with_provider_metadata(provider_metadata)
        }
        ToolCallRepairOutcome::Invalid(failure) => {
            provider_metadata.insert(
                TOOL_CALL_REPAIR_METADATA_KEY.to_string(),
                serde_json::to_value(ToolCallRepairOutcome::Invalid(failure.clone()))
                    .expect("tool call repair failure must serialize"),
            );
            CurrentProviderToolCall::new(
                model_call.id.clone(),
                INVALID_TOOL_CALL_NAME,
                serde_json::Value::Object(failure.model_arguments()),
            )
            .with_provider_metadata(provider_metadata)
        }
    }
}

/// Carries the immutable sampling identity into the tool lifecycle.
///
/// The provider wire must remain protocol-specific, so this metadata is attached only to the
/// local execution call after model history has been recorded. Tool, MCP and lifecycle consumers
/// can therefore audit the exact step that authorized the call without leaking Lime-only fields
/// into the provider request.
pub(super) fn annotate_step_context(
    mut call: CurrentProviderToolCall,
    context: Option<&RuntimeSessionStepContext>,
) -> CurrentProviderToolCall {
    let Some(metadata) = runtime_step_context_metadata(context) else {
        return call;
    };
    call.provider_metadata
        .insert("runtime_step_context".to_string(), metadata);
    call
}

pub(super) fn annotate_custom_step_context(
    mut call: model_provider::current_client::CurrentProviderCustomToolCall,
    context: Option<&RuntimeSessionStepContext>,
) -> model_provider::current_client::CurrentProviderCustomToolCall {
    let Some(metadata) = runtime_step_context_metadata(context) else {
        return call;
    };
    call.provider_metadata
        .insert("runtime_step_context".to_string(), metadata);
    call
}

fn runtime_step_context_metadata(
    context: Option<&RuntimeSessionStepContext>,
) -> Option<serde_json::Value> {
    let context = context?;
    Some(serde_json::json!({
        "session_id": context.session_id,
        "turn_id": context.turn_id,
        "step_index": context.step_index,
        "context_epoch": context.context_epoch,
        "mailbox_delivery_phase": format!("{:?}", context.mailbox_delivery_phase),
    }))
}

pub(super) fn model_call_names(content: &[CurrentProviderContent]) -> BTreeMap<String, String> {
    content
        .iter()
        .filter_map(|part| match part {
            CurrentProviderContent::ToolCall(call) => Some((call.id.clone(), call.name.clone())),
            CurrentProviderContent::CustomToolCall(call) => {
                Some((call.id.clone(), call.name.clone()))
            }
            _ => None,
        })
        .collect()
}

pub(super) fn restore_result_names(
    outputs: &mut [CurrentProviderContent],
    model_names: &BTreeMap<String, String>,
) {
    for part in outputs {
        if let CurrentProviderContent::ToolResult(result)
        | CurrentProviderContent::CustomToolResult(result) = part
        {
            if let Some(name) = model_names.get(&result.call_id) {
                result.name.clone_from(name);
            }
        }
    }
}
