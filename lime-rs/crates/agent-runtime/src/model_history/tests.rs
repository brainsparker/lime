use super::*;
use model_provider::current_client::{CurrentProviderToolCall, CurrentProviderToolResult};

#[test]
fn history_receipt_requires_a_real_record_identity_and_sequence() {
    for (event_id, sequence) in [("", 1), ("  ", 1), ("event", 0)] {
        assert!(HistoryReceipt::new(event_id, sequence).is_err());
    }
}

#[test]
fn raw_arguments_and_zero_budget_survive_persistence_without_wire_metadata() {
    let call = CurrentProviderContent::ToolCall(CurrentProviderToolCall::from_raw(
        "call-1".to_string(),
        "exec_command".to_string(),
        "{ \"cmd\": \"pwd\" }".to_string(),
    ));
    let record = ModelHistoryRecord::calls(&[call.clone()]).unwrap();
    let encoded = serde_json::to_value(record).unwrap();
    let decoded: ModelHistoryRecord = serde_json::from_value(encoded).unwrap();
    assert_eq!(decoded.into_message().unwrap().content, vec![call]);
    let output = CurrentProviderContent::ToolResult(CurrentProviderToolResult {
        history_token_limit: Some(0),
        call_id: "call-1".to_string(),
        name: "exec_command".to_string(),
        success: true,
        output: "original durable output".to_string(),
        error: None,
    });
    let record = ModelHistoryRecord::outputs(&[output.clone()]);
    assert_eq!(record.metadata.output_token_limits["call-1"], 0);
    assert!(
        matches!(&record.message.content[0], CurrentProviderContent::ToolResult(result) if result.history_token_limit.is_none())
    );
    let decoded: ModelHistoryRecord =
        serde_json::from_value(serde_json::to_value(record).unwrap()).unwrap();
    assert_eq!(decoded.into_message().unwrap().content, vec![output]);
}

#[test]
fn history_record_rejects_non_tool_content_and_unmatched_budgets() {
    let record = ModelHistoryRecord {
        message: CurrentProviderMessage::user(vec![CurrentProviderContent::Text(
            "not a tool".to_string(),
        )]),
        metadata: ModelHistoryMetadata::default(),
    };
    assert!(record.into_message().is_err());
    let mut record = ModelHistoryRecord::calls(&[CurrentProviderContent::ToolCall(
        CurrentProviderToolCall::new("call-1", "Read", serde_json::json!({})),
    )])
    .unwrap();
    record
        .metadata
        .output_token_limits
        .insert("other-call".to_string(), 0);
    assert!(record.into_message().is_err());
}

#[test]
fn invalid_model_names_are_preserved_but_missing_call_ids_are_rejected() {
    let call = CurrentProviderContent::ToolCall(CurrentProviderToolCall::from_raw(
        "invalid-name-call".to_string(),
        String::new(),
        "{not-json".to_string(),
    ));
    let record = ModelHistoryRecord::calls(&[call.clone()]).unwrap();
    assert_eq!(record.into_message().unwrap().content, vec![call]);
    let output = CurrentProviderContent::ToolResult(CurrentProviderToolResult {
        history_token_limit: Some(0),
        call_id: "invalid-name-call".to_string(),
        name: String::new(),
        success: false,
        output: "unknown tool".to_string(),
        error: Some("unknown tool".to_string()),
    });
    assert_eq!(
        ModelHistoryRecord::outputs(&[output.clone()])
            .into_message()
            .unwrap()
            .content,
        vec![output],
    );
    let unidentified = CurrentProviderContent::ToolCall(CurrentProviderToolCall::new(
        "",
        "Read",
        serde_json::json!({}),
    ));
    assert!(ModelHistoryRecord::calls(&[unidentified])
        .unwrap()
        .into_message()
        .is_err());
}
