use super::*;
use serde_json::json;

#[test]
fn message_phases_preserve_partial_answer_and_unknown() {
    for phase in ["commentary", "partial_answer", "final_answer"] {
        let item = json!({"type":"message","role":"assistant","content":[],"phase":phase});
        let parsed: ResponseItem = serde_json::from_value(item.clone()).unwrap();
        assert_eq!(serde_json::to_value(parsed).unwrap(), item);
        assert_eq!(MessagePhase::from_wire(phase).unwrap().as_str(), phase);
    }
    for phase in [None, Some(Value::Null)] {
        let mut item = json!({"type":"message","role":"assistant","content":[]});
        if let Some(phase) = phase {
            item["phase"] = phase;
        }
        let parsed: ResponseItem = serde_json::from_value(item).unwrap();
        assert!(matches!(parsed, ResponseItem::Message { phase: None, .. }));
    }
    for invalid in ["final", "finalAnswer", "analysis", " final_answer "] {
        assert_eq!(MessagePhase::from_wire(invalid), None);
    }
}

#[test]
fn external_function_results_accept_absent_and_null_call_ids() {
    for call_id in [None, Some(Value::Null)] {
        let mut item = json!({
            "type": "function_call_output",
            "name": "external_event",
            "namespace": "notifications",
            "output": [{"type": "input_text", "text": "external context"}]
        });
        if let Some(call_id) = call_id {
            item["call_id"] = call_id;
        }
        let parsed: ResponseItem = serde_json::from_value(item).unwrap();
        assert!(matches!(&parsed, ResponseItem::FunctionCallOutput {
            call_id: None,
            name: Some(name),
            namespace: Some(namespace),
            output: FunctionCallOutputBody::ContentItems(items),
            ..
        } if name == "external_event" && namespace == "notifications" && items.len() == 1));
        assert!(!parsed.contains_remote_image_url());
    }
}

#[test]
fn linked_function_results_retain_identity_and_routing_fields() {
    let item = json!({
        "type": "function_call_output",
        "id": "result-1",
        "call_id": "call-1",
        "name": "read_file",
        "namespace": "workspace",
        "output": "contents",
        "internal_chat_message_metadata_passthrough": {"turn_id": "turn-1"}
    });
    let parsed: ResponseItem = serde_json::from_value(item.clone()).unwrap();
    assert_eq!(serde_json::to_value(parsed).unwrap(), item);

    let unnamed = json!({"type":"function_call_output","output":"external context"});
    let parsed: ResponseItem = serde_json::from_value(unnamed.clone()).unwrap();
    assert_eq!(serde_json::to_value(parsed).unwrap(), unnamed);
}

#[test]
fn external_function_results_keep_output_validation_and_remote_image_guard() {
    let valid = json!({
        "type": "function_call_output",
        "name": "external_event",
        "namespace": "notifications",
        "output": "context"
    });
    for (field, value) in [
        ("call_id", json!(7)),
        ("name", json!({"invalid":true})),
        ("namespace", json!(["invalid"])),
        ("output", Value::Null),
        ("output", json!([{"type":"input_image"}])),
    ] {
        let mut item = valid.clone();
        item[field] = value;
        assert!(
            serde_json::from_value::<ResponseItem>(item).is_err(),
            "{field}"
        );
    }
    let mut missing_output = valid.clone();
    missing_output.as_object_mut().unwrap().remove("output");
    assert!(serde_json::from_value::<ResponseItem>(missing_output).is_err());

    for (image_url, blocked) in [
        ("https://example.com/image.png", true),
        ("HTTP://example.com/image.png", true),
        ("data:image/png;base64,AA==", false),
    ] {
        let mut item = valid.clone();
        item["output"] = json!([{"type":"input_image","image_url":image_url}]);
        let parsed: ResponseItem = serde_json::from_value(item).unwrap();
        assert_eq!(parsed.contains_remote_image_url(), blocked);
    }
}
