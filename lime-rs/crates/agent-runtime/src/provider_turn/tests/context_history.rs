use super::*;
use serde_json::json;

struct LargeOutput(String, Option<usize>);

impl RuntimeToolExecutor for LargeOutput {
    fn execute<'a>(&'a self, _: RuntimeToolExecutionRequest<'a>) -> RuntimeToolExecutionFuture<'a> {
        Box::pin(async move {
            let mut result =
                RuntimeToolExecutionResult::new(true, self.0.clone(), None, Default::default());
            result.history_token_limit = self.1;
            Ok(result)
        })
    }
}

#[tokio::test]
async fn live_tool_output_is_bounded_on_continuation_and_retry_but_lifecycle_keeps_original() {
    use agent_protocol::truncation::TruncationPolicy;
    for (policy, default_limit) in [
        (TruncationPolicy::Tokens(100), 120),
        (TruncationPolicy::Bytes(96), 29),
        (TruncationPolicy::Tokens(0), 0),
    ] {
        for tool_limit in [None, Some(0), Some(7)] {
            live_output(policy, tool_limit, tool_limit.unwrap_or(default_limit)).await;
        }
    }
}

async fn live_output(
    policy: agent_protocol::truncation::TruncationPolicy,
    tool_limit: Option<usize>,
    expected_limit: usize,
) {
    use agent_protocol::truncation::TruncationPolicy;
    let original = format!("HEAD{}TAIL", "中间".repeat(10_000));
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![
            Ok(CanonicalLlmEvent::ToolCall {
                id: "large".into(),
                name: "read_file".into(),
                input: json!({}),
                raw_arguments: None,
                provider_executed: None,
                provider_metadata: Default::default(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::ToolCall,
                usage: None,
                response_id: None,
            }),
        ],
        vec![Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            usage: None,
            response_id: None,
        })],
        vec![
            Ok(CanonicalLlmEvent::TextDelta {
                id: "answer".into(),
                text: "done".into(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::Stop,
                usage: None,
                response_id: None,
            }),
        ],
    ]));
    let requests = provider.requests.clone();
    let lifecycle = Arc::new(RecordingLifecycleEmitter::default());
    run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session")
                .turn_id("turn")
                .max_turns(4)
                .build(),
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("inspect".into()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    vec![RuntimeToolDefinition::new(
                        "read_file",
                        "read",
                        json!({"type":"object"}),
                    )],
                    RuntimeToolExecutorHandle::new(Arc::new(LargeOutput(
                        original.clone(),
                        tool_limit,
                    ))),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: RuntimeReplyModelRequestPolicy::new(
                None,
                None,
                None,
                Some(policy),
            ),
            tool_lifecycle_emitter: lifecycle.clone(),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
        },
        |_| {},
    )
    .await
    .unwrap();
    let requests = requests.lock().unwrap();
    assert_eq!(requests.len(), 3);
    let expected = tool_runtime::tool_io::truncate_tool_output(
        &original,
        TruncationPolicy::Tokens(expected_limit),
    );
    for request in &requests[1..] {
        let results = request
            .messages
            .iter()
            .flat_map(|message| &message.content)
            .filter_map(|part| match part {
                CurrentProviderContent::ToolResult(result) => Some(result),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].call_id, "large");
        assert_eq!(results[0].output, expected);
        assert!(results[0].success);
        assert_eq!(results[0].history_token_limit, Some(expected_limit));
    }
    assert!(lifecycle
        .events()
        .iter()
        .any(|event| event.call_id == "large"
            && event.phase == ToolLifecyclePhase::Completed
            && event
                .output
                .as_ref()
                .is_some_and(|output| output.text == original
                    && output.history_token_limit == Some(expected_limit))));
}

#[tokio::test]
async fn sampling_and_empty_retry_normalize_history_without_executing_inherited_calls() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            usage: None,
            response_id: Some("empty".to_string()),
        })],
        vec![
            Ok(CanonicalLlmEvent::TextDelta {
                id: "answer".to_string(),
                text: "done".to_string(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::Stop,
                usage: None,
                response_id: Some("complete".to_string()),
            }),
        ],
    ]));
    let requests = Arc::clone(&provider.requests);
    let lifecycle = Arc::new(RecordingLifecycleEmitter::default());
    let initial_messages = vec![
        CurrentProviderMessage::raw_response_item(json!({
            "type":"function_call","id":"item-original","call_id":"unfinished",
            "name":"exec_command","arguments":"{}","opaque":{"keep":true}
        })),
        CurrentProviderMessage::raw_response_item(json!({
            "type":"function_call_output","call_id":"orphan","output":"remove orphan"
        })),
        CurrentProviderMessage::user(vec![CurrentProviderContent::Text("continue".to_string())]),
    ];

    run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session")
                .turn_id("turn")
                .build(),
            initial_messages,
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    Vec::new(),
                    RuntimeToolExecutorHandle::new(Arc::new(EchoTool)),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: lifecycle.clone(),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
        },
        |_| {},
    )
    .await
    .expect("sampling should repair incomplete history on both attempts");

    let requests = requests.lock().unwrap();
    assert_eq!(requests.len(), 2, "must observe the empty-response retry");
    for request in requests.iter() {
        let raw = request
            .messages
            .iter()
            .flat_map(|message| &message.content)
            .filter_map(|part| match part {
                CurrentProviderContent::RawResponseItem(item) => Some(item),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(raw.len(), 2, "orphan output must not reach sampling");
        assert_eq!(raw[0]["opaque"], json!({"keep":true}));
        assert_eq!(
            raw[1],
            &json!({
                "type":"function_call_output","call_id":"unfinished","output":"aborted",
                "id":"fco_45933e0f-2a6a-53e2-9e75-c50fdd98fab1"
            })
        );
    }
    assert!(
        lifecycle.events().is_empty(),
        "prompt repair must never execute a tool"
    );
}
