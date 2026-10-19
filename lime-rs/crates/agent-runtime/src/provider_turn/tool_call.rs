use super::{
    CurrentProviderContent, CurrentProviderToolCall, ProviderMetadata, RuntimeToolStepSnapshot,
    INVALID_TOOL_CALL_NAME, TOOL_CALL_REPAIR_METADATA_KEY,
};
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
