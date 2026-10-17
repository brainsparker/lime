use super::*;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};

fn assert_service_tier_wire<T: DeserializeOwned + Serialize>(base: Value) {
    for value in [None, Some(Value::Null), Some(json!("priority"))] {
        let mut wire = base.clone();
        if let Some(value) = value.as_ref() {
            wire["serviceTier"] = value.clone();
        }
        let params: T = serde_json::from_value(wire).expect("valid serviceTier patch");
        let encoded = serde_json::to_value(params).expect("encoded serviceTier patch");
        assert_eq!(
            encoded.get("serviceTier"),
            value.as_ref(),
            "{} must preserve omitted/null/value",
            std::any::type_name::<T>()
        );
    }
    for value in [json!(true), json!(1), json!([]), json!({})] {
        let mut wire = base.clone();
        wire["serviceTier"] = value;
        assert!(
            serde_json::from_value::<T>(wire).is_err(),
            "serviceTier accepts only a string or null"
        );
    }
}

#[test]
fn thread_start_service_tier_preserves_patch_wire() {
    assert_service_tier_wire::<ThreadStartParams>(json!({}));
}

#[test]
fn thread_resume_service_tier_preserves_patch_wire() {
    assert_service_tier_wire::<ThreadResumeParams>(json!({"threadId":"thread-1"}));
}

#[test]
fn thread_fork_service_tier_preserves_patch_wire() {
    assert_service_tier_wire::<ThreadForkParams>(json!({"threadId":"thread-1"}));
}

#[test]
fn turn_start_service_tier_preserves_patch_wire() {
    assert_service_tier_wire::<TurnStartParams>(json!({"threadId":"thread-1","input":[]}));
}

#[test]
fn thread_settings_service_tier_preserves_patch_wire() {
    assert_service_tier_wire::<ThreadSettingsUpdateParams>(json!({"threadId":"thread-1"}));
}
