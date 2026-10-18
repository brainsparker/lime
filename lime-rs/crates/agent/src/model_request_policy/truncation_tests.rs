use crate::model_request_policy::*;
use serde_json::json;

fn resolved(metadata: Value) -> Option<TruncationPolicy> {
    let context = AgentTurnContext {
        metadata: serde_json::from_value(metadata.clone()).unwrap(),
        ..Default::default()
    };
    let from_context = runtime_reply_model_request_policy_from_turn_context(Some(&context))
        .and_then(|policy| policy.truncation);
    assert_eq!(
        from_context,
        runtime_reply_model_request_policy_from_metadata(&metadata)
            .and_then(|policy| policy.truncation),
    );
    from_context
}

#[test]
fn catalog_budget_does_not_require_a_harness_policy() {
    for (key, field, mode, limit, expected) in [
        (
            "modelRegistry",
            "truncation_policy",
            "tokens",
            32,
            TruncationPolicy::Tokens(32),
        ),
        (
            "model_registry",
            "truncationPolicy",
            "bytes",
            96,
            TruncationPolicy::Bytes(96),
        ),
        (
            "modelRegistry",
            "truncation_policy",
            "bytes",
            0,
            TruncationPolicy::Bytes(0),
        ),
    ] {
        assert_eq!(
            resolved(json!({"config":{key:{"model":{field:{"mode":mode,"limit":limit}}}}})),
            Some(expected)
        );
    }
}

#[test]
fn another_policy_and_stale_renderer_catalog_do_not_mask_current_budget() {
    assert_eq!(
        resolved(json!({
            "runtime_options":{"harness":{"model_request_policy":{"tool_call_policy":{"parallel_tool_calls":false}}}},
            "runtime_request":{"metadata":{"harness":{"model_request_policy":{
                "source":"model_registry","model_id":"previous-model",
                "truncation_policy":{"mode":"tokens","limit":1000}
            }}}},
            "config":{"modelRegistry":{"model":{"id":"current-model","truncation_policy":{"mode":"bytes","limit":80}}}}
        })),
        Some(TruncationPolicy::Bytes(80))
    );
}

#[test]
fn explicit_budget_is_resolved_per_field_across_metadata_sources() {
    for key in REQUEST_METADATA_KEYS {
        assert_eq!(
            resolved(json!({
                "harness":{"model_request_policy":{"tool_call_policy":{"parallel_tool_calls":false}}},
                key:{"metadata":{"harness":{"modelRequestPolicy":{"truncationPolicy":{
                    "truncation_policy":{"mode":"tokens","limit":0}
                }}}}},
                "modelRegistry":{"model":{"truncation_policy":{"mode":"bytes","limit":80}}}
            })),
            Some(TruncationPolicy::Tokens(0))
        );
    }
}

#[test]
fn explicit_runtime_options_override_request_and_catalog_budget() {
    assert_eq!(
        resolved(json!({
            "runtime_options":{"harness":{"model_request_policy":{"truncation_policy":{"mode":"bytes","limit":72}}}},
            "runtime_request":{"harness":{"model_request_policy":{"truncation_policy":{"mode":"tokens","limit":64}}}},
            "config":{"modelRegistry":{"model":{"truncation_policy":{"mode":"bytes","limit":80}}}}
        })),
        Some(TruncationPolicy::Bytes(72))
    );
}

#[test]
fn missing_catalog_budget_never_uses_renderer_or_host_catalog_hints() {
    for registry in [
        json!({"model":null}),
        json!({"model":{"limits":{"context_length":128000,"max_output_tokens":8192}}}),
    ] {
        assert_eq!(
            resolved(json!({
                "runtime_request":{
                    "modelRegistry":{"model":{"truncation_policy":{"mode":"bytes","limit":40}}},
                    "harness":{"model_request_policy":{"source":"model_registry","truncation_policy":{"mode":"tokens","limit":4}}}
                },
                "config":{"modelRegistry":registry}
            })),
            None
        );
    }
}

#[test]
fn direct_config_budget_uses_the_same_policy_owner() {
    assert_eq!(
        resolved(json!({"config":{"modelRegistry":{
            "model":null, "source":"direct_provider_config", "truncation_policy":{"mode":"tokens","limit":128}
        }}})),
        Some(TruncationPolicy::Tokens(128))
    );
}

#[test]
fn catalog_policy_updates_after_each_model_selection_without_retaining_old_budget() {
    let mut metadata = json!({"config":{"modelRegistry":{"model":null}}});
    for budget in [
        Some(json!({"mode":"bytes","limit":12})),
        Some(json!({"mode":"tokens","limit":20})),
        None,
    ] {
        metadata["config"]["modelRegistry"]["model"] = json!({"truncation_policy":budget});
        assert_eq!(
            resolved(metadata.clone()),
            budget.map(|value| serde_json::from_value(value).unwrap())
        );
    }
}
