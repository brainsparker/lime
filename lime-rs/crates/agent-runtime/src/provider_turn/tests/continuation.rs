use super::*;

fn step(text: &str, needs_follow_up: bool) -> Vec<Result<CanonicalLlmEvent, CurrentProviderError>> {
    vec![
        Ok(CanonicalLlmEvent::TextDelta {
            id: "answer".into(),
            text: text.into(),
        }),
        Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            needs_follow_up,
            usage: None,
            response_id: None,
        }),
    ]
}

fn input(
    provider: Arc<dyn CurrentProvider>,
    executor: Arc<dyn RuntimeToolExecutor>,
) -> CurrentProviderTurnInput {
    CurrentProviderTurnInput {
        provider,
        provider_trace_metadata: None,
        session_config: crate::session_config::SessionConfigBuilder::new("session-continuation")
            .turn_id("turn-continuation")
            .max_turns(4)
            .build(),
        initial_messages: vec![CurrentProviderMessage::user(vec![
            CurrentProviderContent::Text("initial".into()),
        ])],
        tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
            RuntimeToolStepSnapshot::new(
                vec![RuntimeToolDefinition::new(
                    "read_file",
                    "read",
                    serde_json::json!({"type":"object"}),
                )],
                RuntimeToolExecutorHandle::new(executor),
            ),
        ),
        hook_snapshot_source: None,
        model_request_policy: None,
        tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
        working_directory: PathBuf::from("."),
        cancel_token: None,
        pending_input: None,
        mid_turn_compaction: None,
    }
}

#[tokio::test]
async fn explicit_continuation_keeps_partial_history_until_the_final_response() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        step("partial", true),
        step("final", false),
    ]));
    let mut events = Vec::new();
    let result = run_current_provider_turn(input(provider.clone(), Arc::new(EchoTool)), |event| {
        events.push(event)
    })
    .await
    .unwrap();
    assert_eq!(result.text_output, "partialfinal");
    assert!(!result.cancelled);
    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    let mut expected = requests[0].messages.clone();
    expected.push(CurrentProviderMessage::assistant(vec![
        CurrentProviderContent::Text("partial".into()),
    ]));
    assert_eq!(requests[1].messages, expected);
    assert_eq!(
        requests[1]
            .messages
            .iter()
            .filter(|m| m.role == CurrentProviderRole::Assistant)
            .cloned()
            .collect::<Vec<_>>(),
        vec![CurrentProviderMessage::assistant(vec![
            CurrentProviderContent::Text("partial".into())
        ])]
    );
    assert_eq!(
        events
            .into_iter()
            .filter_map(|event| match event {
                CurrentProviderTurnEvent::ProviderStep {
                    attempt, completed, ..
                } => Some((attempt, completed)),
                _ => None,
            })
            .collect::<Vec<_>>(),
        vec![(1, true), (2, true)]
    );
}

#[tokio::test]
async fn explicit_reasoning_continuation_retains_history_instead_of_retrying_the_same_request() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![
            Ok(CanonicalLlmEvent::ReasoningContentDelta {
                id: "thought".into(),
                text: "retain this".into(),
                content_index: 0,
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::Stop,
                needs_follow_up: true,
                usage: None,
                response_id: None,
            }),
        ],
        step("done", false),
    ]));
    let result = run_current_provider_turn(input(provider.clone(), Arc::new(EchoTool)), |_| {})
        .await
        .unwrap();
    assert_eq!(result.text_output, "done");
    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(
        requests[1]
            .messages
            .iter()
            .filter(|m| m.role == CurrentProviderRole::Assistant)
            .cloned()
            .collect::<Vec<_>>(),
        vec![CurrentProviderMessage::assistant(vec![
            CurrentProviderContent::Reasoning("retain this".into())
        ])]
    );
}

#[tokio::test]
async fn explicit_continuation_after_a_tool_does_not_reexecute_it() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![
            Ok(CanonicalLlmEvent::ToolCall {
                id: "read-once".into(),
                name: "read_file".into(),
                input: serde_json::json!({}),
                raw_arguments: None,
                provider_executed: None,
                provider_metadata: Default::default(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::ToolCall,
                needs_follow_up: false,
                usage: None,
                response_id: None,
            }),
        ],
        step("partial", true),
        step("done", false),
    ]));
    let executor = Arc::new(CountingTool::default());
    let result = run_current_provider_turn(input(provider.clone(), executor.clone()), |_| {})
        .await
        .unwrap();
    assert_eq!(result.text_output, "partialdone");
    assert_eq!(executor.calls.load(Ordering::SeqCst), 1);
    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 3);
    for request in &requests[1..] {
        let outputs = request
            .messages
            .iter()
            .flat_map(|m| &m.content)
            .filter_map(|c| match c {
                CurrentProviderContent::ToolResult(r) => Some(r),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(outputs.len(), 1);
        assert_eq!(outputs[0].call_id, "read-once");
        assert_eq!(outputs[0].output, "executed read_file");
    }
}

#[tokio::test]
async fn cancellation_after_explicit_continuation_prevents_the_next_sampling_request() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        step("partial", true),
        step("must not run", false),
    ]));
    let token = CancellationToken::new();
    let mut turn = input(provider.clone(), Arc::new(EchoTool));
    turn.cancel_token = Some(token.clone());
    let result = run_current_provider_turn(turn, |event| {
        if matches!(
            event,
            CurrentProviderTurnEvent::ProviderStep {
                completed: true,
                ..
            }
        ) {
            token.cancel();
        }
    })
    .await
    .unwrap();
    assert!(result.cancelled);
    assert_eq!(result.text_output, "partial");
    assert_eq!(provider.requests.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn explicit_continuation_respects_the_provider_token_budget() {
    let mut first = step("partial", true);
    first[1] = Ok(CanonicalLlmEvent::Finish {
        reason: FinishReason::Stop,
        needs_follow_up: true,
        usage: Some(Usage {
            input_tokens: Some(2),
            output_tokens: Some(1),
            ..Usage::default()
        }),
        response_id: None,
    });
    let provider = Arc::new(ScriptedProvider::new(vec![
        first,
        step("must not run", false),
    ]));
    let mut turn = input(provider.clone(), Arc::new(EchoTool));
    turn.session_config.provider_token_budget = Some(3);
    let result = run_current_provider_turn(turn, |_| {}).await.unwrap();
    assert!(result.cancelled);
    assert_eq!(result.text_output, "partial");
    assert_eq!(
        result.event_errors,
        vec!["Provider token budget exhausted after attempt 1: used=3 limit=3"]
    );
    assert_eq!(provider.requests.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn provider_error_after_explicit_continuation_does_not_allow_route_replay() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        step("partial", true),
        vec![Err(CurrentProviderError {
            message: "second response failed".into(),
            status: None,
            classification: Some(FailureClassification::Transport),
            retryable: true,
            retry_after: None,
        })],
    ]));
    let error = run_current_provider_turn(input(provider.clone(), Arc::new(EchoTool)), |_| {})
        .await
        .unwrap_err();
    assert!(error.emitted_any);
    assert!(!error.is_reroutable_provider_failure());
    assert_eq!(provider.requests.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn explicit_continuation_admits_pending_mailbox_in_the_current_turn() {
    let registry = RuntimeSessionRegistry::default();
    let session = registry
        .get_or_create("session-continuation", "thread-continuation")
        .await
        .unwrap();
    let provider = Arc::new(ScriptedProvider::new(vec![
        step("partial", true),
        step("final", false),
    ]));
    let running = provider.clone();
    let mailbox = Arc::new(Mutex::new(vec![RuntimeSessionInput::Developer(
        "mailbox evidence".into(),
    )]));
    let task = RuntimeSessionClosureTask::new(
        "turn-continuation",
        Vec::new(),
        move |context, _, cancel| {
            let mut turn = input(running.clone(), Arc::new(EchoTool));
            turn.pending_input = Some(context.input_handle());
            turn.cancel_token = Some(cancel);
            Box::pin(async move {
                let execution = run_current_provider_turn(turn, |_| {}).await.unwrap();
                assert_eq!(execution.text_output, "partialfinal");
                Ok(())
            })
        },
    )
    .with_mailbox_loader(move || {
        let messages = std::mem::take(&mut *mailbox.lock().unwrap());
        Box::pin(async move { Ok(messages) })
    });
    let submitted = session.submit(Arc::new(task), false).await.unwrap();
    assert_eq!(
        submitted.completion.await.unwrap(),
        Ok(crate::session_loop::RuntimeSessionTaskOutcome::Completed)
    );
    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(
        requests[1]
            .messages
            .iter()
            .filter(|m| m.role == CurrentProviderRole::Developer
                && m.content == vec![CurrentProviderContent::Text("mailbox evidence".into())])
            .count(),
        1
    );
    drop(requests);
    registry.shutdown("session-continuation").await.unwrap();
}
