use super::{
    direct_model_request_policy_value, looks_like_policy_value, nested_metadata_value,
    object_field, string_field, truncation_policy_from_value, ModelTruncationPolicySnapshot,
    REQUEST_METADATA_KEYS,
};
use serde_json::Value;

pub(super) fn resolve(metadata: &Value) -> Option<ModelTruncationPolicySnapshot> {
    explicit_policy(metadata).or_else(|| {
        // The server resolves config against the selected endpoint and credential on every step.
        let registry = metadata
            .get("config")
            .and_then(registry)
            .or_else(|| registry(metadata))?;
        let model = registry.get("model").filter(|value| value.is_object());
        model
            .and_then(budget)
            .or_else(|| budget(registry))
            .map(truncation_policy_from_value)
    })
}

fn registry(metadata: &Value) -> Option<&Value> {
    object_field(metadata, &["modelRegistry", "model_registry"])
}

fn budget(policy: &Value) -> Option<&Value> {
    object_field(policy, &["truncation_policy", "truncationPolicy"])
}

fn explicit_policy(metadata: &Value) -> Option<ModelTruncationPolicySnapshot> {
    REQUEST_METADATA_KEYS
        .into_iter()
        .filter_map(|key| metadata.get(key))
        .find_map(explicit_policy)
        .or_else(|| {
            direct_model_request_policy_value(metadata)
                .or_else(|| looks_like_policy_value(metadata).then_some(metadata))
                .filter(|policy| {
                    // Renderer catalog projections are hints, never user overrides.
                    string_field(policy, &["source"]).as_deref() != Some("model_registry")
                })
                .and_then(budget)
                .map(truncation_policy_from_value)
        })
        .or_else(|| nested_metadata_value(metadata).and_then(explicit_policy))
}

#[cfg(test)]
#[path = "truncation_tests.rs"]
mod tests;
