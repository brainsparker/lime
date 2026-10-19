use super::*;

#[tokio::test]
async fn reasoning_final_completes_once() {
    let provider = Arc::new(ScriptedProvider::new(vec![vec![
        Ok(CanonicalLlmEvent::ReasoningContentDelta {
            id: "reasoning-1".to_string(),
            text: "I need to think about this first.".to_string(),
            content_index: 0,
        }),
        Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            usage: Some(Usage {
                input_tokens: Some(10),
                output_tokens: Some(4),
                ..Usage::default()
            }),
            needs_follow_up: false,
            response_id: Some("response-1".to_string()),
        }),
    ]]));
    let requests = Arc::clone(&provider.requests);
    let snapshot_source =
        RuntimeToolStepSnapshotSourceHandle::new(Arc::new(SequencedToolStepSnapshotSource {
            snapshots: Mutex::new(VecDeque::from([RuntimeToolStepSnapshot::new(
                Vec::new(),
                RuntimeToolExecutorHandle::new(Arc::new(EchoTool)),
            )])),
        }));

    let mut events = Vec::new();
    let execution = run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session-1")
                .turn_id("turn-1")
                .max_turns(1)
                .build(),
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("hello".to_string()),
            ])],
            tool_step_snapshot_source: snapshot_source,
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
        },
        |event| events.push(event),
    )
    .await
    .expect("normal reasoning-only completion should finish");

    assert!(execution.text_output.is_empty());
    assert_eq!(execution.attempts_summary, "attempts=1");
    let requests = requests.lock().expect("provider requests");
    assert_eq!(requests.len(), 1);

    assert_eq!(
        events
            .iter()
            .filter_map(|event| match event {
                CurrentProviderTurnEvent::ReasoningStart { item_id } => {
                    Some(("start", item_id.as_str()))
                }
                CurrentProviderTurnEvent::ReasoningContentDelta { item_id, .. } => {
                    Some(("delta", item_id.as_str()))
                }
                CurrentProviderTurnEvent::ReasoningEnd { item_id } => {
                    Some(("end", item_id.as_str()))
                }
                _ => None,
            })
            .collect::<Vec<_>>(),
        vec![
            ("start", "provider:turn-1:1:reasoning:reasoning-1"),
            ("delta", "provider:turn-1:1:reasoning:reasoning-1"),
            ("end", "provider:turn-1:1:reasoning:reasoning-1"),
        ]
    );
    assert_eq!(
        events
            .iter()
            .filter_map(|event| match event {
                CurrentProviderTurnEvent::ProviderStep { attempt, .. } => Some(*attempt),
                _ => None,
            })
            .collect::<Vec<_>>(),
        vec![1]
    );
}

#[tokio::test]
async fn empty_final_completes_once() {
    let empty = || {
        vec![Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            usage: None,
            needs_follow_up: false,
            response_id: None,
        })]
    };
    let provider = Arc::new(ScriptedProvider::new(vec![empty()]));
    let requests = Arc::clone(&provider.requests);

    let execution = run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session-1")
                .turn_id("turn-1")
                .max_turns(1)
                .build(),
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("hello".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    Vec::new(),
                    RuntimeToolExecutorHandle::new(Arc::new(EchoTool)),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
        },
        |_| {},
    )
    .await
    .expect("normal empty final should finish");

    assert_eq!(requests.lock().expect("provider requests").len(), 1);
    assert!(execution.text_output.is_empty());
    assert!(!execution.cancelled);
    assert_eq!(execution.attempts_summary, "attempts=1");
}

#[tokio::test]
async fn empty_final_after_tool_result_keeps_history() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![
            Ok(CanonicalLlmEvent::ToolCall {
                id: "call-1".to_string(),
                name: "Read".to_string(),
                input: serde_json::json!({ "path": "README.md" }),
                raw_arguments: None,
                provider_executed: None,
                provider_metadata: Default::default(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::ToolCall,
                usage: None,
                needs_follow_up: false,
                response_id: Some("response-1".to_string()),
            }),
        ],
        vec![Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            usage: None,
            needs_follow_up: false,
            response_id: Some("response-empty".to_string()),
        })],
    ]));
    let requests = Arc::clone(&provider.requests);

    let execution = run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session-1")
                .turn_id("turn-1")
                .max_turns(2)
                .build(),
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("inspect it".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    vec![RuntimeToolDefinition::new(
                        "Read",
                        "read files",
                        serde_json::json!({}),
                    )],
                    RuntimeToolExecutorHandle::new(Arc::new(EchoTool)),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
        },
        |_| {},
    )
    .await
    .expect("normal empty final after a tool call should finish");

    assert!(execution.text_output.is_empty());
    assert_eq!(execution.attempts_summary, "attempts=2");
    assert!(!execution
        .text_output
        .contains(MAX_REPLY_TURNS_REACHED_MESSAGE));

    let requests = requests.lock().expect("provider requests");
    assert_eq!(requests.len(), 2);
    assert!(requests[1].messages.iter().any(|message| {
        message.role == CurrentProviderRole::Tool
            && message.content.iter().any(|part| {
                matches!(part, CurrentProviderContent::ToolResult(result)
                    if result.output == "executed Read")
            })
    }));
    assert!(requests[1]
        .messages
        .iter()
        .all(|message| !(message.role == CurrentProviderRole::Assistant
            && message.content.is_empty())));
}
