use super::*;
use crate::model_history::{HistoryReceipt, ModelHistoryRecord, ModelHistoryRecorder};

const ORIGINAL_ARGUMENTS: &str =
    r#"{ "file_path": " README.md ", "start_line": "2", "end_line": "3" }"#;

#[tokio::test]
async fn repaired_tool_call_keeps_original_model_history_and_executed_projection() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![
            Ok(CanonicalLlmEvent::ToolCall {
                id: "call-repaired".to_string(),
                name: "read_file".to_string(),
                input: serde_json::json!({
                    "file_path": " README.md ",
                    "start_line": "2",
                    "end_line": "3"
                }),
                raw_arguments: Some(ORIGINAL_ARGUMENTS.to_string()),
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
        vec![
            Ok(CanonicalLlmEvent::TextDelta {
                id: "text-final".to_string(),
                text: "done".to_string(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::Stop,
                usage: None,
                needs_follow_up: false,
                response_id: Some("response-2".to_string()),
            }),
        ],
    ]));
    let requests = Arc::clone(&provider.requests);
    let step_executor = Arc::new(CountingTool::default());
    let lifecycle_emitter = Arc::new(RecordingLifecycleEmitter::default());
    let records = Arc::new(Mutex::new(Vec::<ModelHistoryRecord>::new()));
    let persisted = records.clone();
    let mut config = crate::session_config::SessionConfigBuilder::new("session-1")
        .turn_id("turn-1")
        .max_turns(3)
        .build();
    config.model_history_recorder = Some(ModelHistoryRecorder::new(move |record| {
        let sequence = {
            let mut records = persisted.lock().unwrap();
            records.push(record);
            records.len() as u64
        };
        Box::pin(async move { HistoryReceipt::new(format!("history-{sequence}"), sequence) })
    }));

    run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: config,
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("read it".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    vec![RuntimeToolDefinition::new(
                        "Read",
                        "visible tool",
                        serde_json::json!({
                            "type": "object",
                            "properties": {
                                "path": { "type": "string" },
                                "start_line": { "type": "integer", "minimum": 1 },
                                "end_line": { "type": "integer", "minimum": 1 }
                            },
                            "required": ["path"]
                        }),
                    )],
                    RuntimeToolExecutorHandle::new(step_executor.clone()),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: lifecycle_emitter.clone(),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
            mid_turn_compaction: None,
        },
        |_| {},
    )
    .await
    .expect("repaired tool call should complete");

    assert_eq!(step_executor.calls.load(Ordering::SeqCst), 1);
    let lifecycle_events = lifecycle_emitter.events();
    assert_eq!(lifecycle_events.len(), 2);
    for event in &lifecycle_events {
        assert_eq!(event.tool_name, "Read");
        assert_eq!(event.arguments["path"], "README.md");
        assert_eq!(event.arguments["start_line"], 2);
        assert_eq!(event.arguments["end_line"], 3);
        assert_eq!(
            event.provider_metadata[TOOL_CALL_REPAIR_METADATA_KEY]["status"],
            "ready"
        );
    }

    let requests = requests.lock().expect("recorded requests");
    let repaired_call = requests[1]
        .messages
        .iter()
        .find_map(|message| {
            message.content.iter().find_map(|content| match content {
                CurrentProviderContent::ToolCall(call) => Some(call),
                _ => None,
            })
        })
        .expect("repaired assistant tool call");
    assert_eq!(repaired_call.name, "read_file");
    assert_eq!(repaired_call.arguments["file_path"], " README.md ");
    assert_eq!(repaired_call.arguments["start_line"], "2");
    assert_eq!(repaired_call.raw_arguments, ORIGINAL_ARGUMENTS);
    assert!(!repaired_call
        .provider_metadata
        .contains_key(TOOL_CALL_REPAIR_METADATA_KEY));
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 2);
    let model_call = records[0].clone().into_message().unwrap();
    assert!(
        matches!(&model_call.content[0], CurrentProviderContent::ToolCall(call)
        if call == repaired_call)
    );
    let model_result = records[1].clone().into_message().unwrap();
    assert!(
        matches!(&model_result.content[0], CurrentProviderContent::ToolResult(result)
        if result.call_id == "call-repaired" && result.name == "read_file" && result.success)
    );
    assert!(matches!(
        requests[1].messages.last(),
        Some(CurrentProviderMessage {
            producer: None, role: CurrentProviderRole::Tool,
            content,
        }) if matches!(content.as_slice(), [CurrentProviderContent::ToolResult(result)]
            if result.name == "read_file" && result.success)
    ));
}

#[tokio::test]
async fn repaired_tool_call_cancel_wins_over_late_handler_completion() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![
            Ok(CanonicalLlmEvent::ToolCall {
                id: "call-cancel-repaired".to_string(),
                name: "read_file".to_string(),
                input: serde_json::json!({
                    "file_path": " README.md ",
                    "start_line": "2"
                }),
                raw_arguments: Some(r#"{"file_path":" README.md ","start_line":"2"}"#.to_string()),
                provider_executed: None,
                provider_metadata: Default::default(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::ToolCall,
                usage: None,
                needs_follow_up: false,
                response_id: Some("response-tool".to_string()),
            }),
        ],
        vec![Ok(CanonicalLlmEvent::Finish {
            reason: FinishReason::Stop,
            usage: None,
            needs_follow_up: false,
            response_id: Some("response-after-tool".to_string()),
        })],
    ]));
    let requests = Arc::clone(&provider.requests);
    let (started_sender, started_receiver) = oneshot::channel();
    let (release_sender, release_receiver) = oneshot::channel();
    let (late_completed_sender, late_completed_receiver) = oneshot::channel();
    let tool = Arc::new(LateCompletingTool {
        calls: AtomicUsize::new(0),
        started: Mutex::new(Some(started_sender)),
        release_after_cancel: Mutex::new(Some(release_receiver)),
        late_completed: Mutex::new(Some(late_completed_sender)),
    });
    let lifecycle_emitter = Arc::new(RecordingLifecycleEmitter::default());
    let turn_lifecycle_emitter = lifecycle_emitter.clone();
    let turn_tool = tool.clone();
    let cancel_token = CancellationToken::new();
    let turn_cancel_token = cancel_token.clone();

    let turn = tokio::spawn(async move {
        run_current_provider_turn(
            CurrentProviderTurnInput {
                provider,
                provider_trace_metadata: None,
                session_config: crate::session_config::SessionConfigBuilder::new("session-cancel")
                    .turn_id("turn-cancel")
                    .max_turns(3)
                    .build(),
                initial_messages: vec![CurrentProviderMessage::user(vec![
                    CurrentProviderContent::Text("read it".to_string()),
                ])],
                tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                    RuntimeToolStepSnapshot::new(
                        vec![RuntimeToolDefinition::new(
                            "Read",
                            "visible tool",
                            serde_json::json!({
                                "type": "object",
                                "properties": {
                                    "path": { "type": "string" },
                                    "start_line": { "type": "integer", "minimum": 1 }
                                },
                                "required": ["path"]
                            }),
                        )],
                        RuntimeToolExecutorHandle::new(turn_tool),
                    ),
                ),
                hook_snapshot_source: None,
                model_request_policy: None,
                tool_lifecycle_emitter: turn_lifecycle_emitter,
                working_directory: PathBuf::from("."),
                cancel_token: Some(turn_cancel_token),
                pending_input: None,
                mid_turn_compaction: None,
            },
            |_| {},
        )
        .await
    });

    started_receiver
        .await
        .expect("repaired handler should start");
    cancel_token.cancel();
    let execution = tokio::time::timeout(Duration::from_secs(5), turn)
        .await
        .expect("cancel should release the repaired tool call")
        .expect("turn task should complete")
        .expect("cancel should be a normal terminal result");

    assert!(execution.cancelled);
    assert_eq!(execution.attempts_summary, "attempts=1");
    assert_eq!(tool.calls.load(Ordering::SeqCst), 1);
    assert_eq!(requests.lock().expect("provider requests").len(), 1);
    let lifecycle_events = lifecycle_emitter.events();
    assert_eq!(lifecycle_events.len(), 2);
    assert_eq!(lifecycle_events[0].phase, ToolLifecyclePhase::Started);
    assert_eq!(lifecycle_events[1].phase, ToolLifecyclePhase::Completed);
    for event in &lifecycle_events {
        assert_eq!(event.tool_name, "Read");
        assert_eq!(event.arguments["path"], "README.md");
        assert_eq!(event.arguments["start_line"], 2);
        assert_eq!(
            event.provider_metadata[TOOL_CALL_REPAIR_METADATA_KEY]["status"],
            "ready"
        );
    }
    assert_eq!(
        lifecycle_events[1]
            .output
            .as_ref()
            .and_then(|output| output.metadata.get("tool_outcome"))
            .and_then(serde_json::Value::as_str),
        Some("aborted")
    );

    release_sender
        .send(())
        .expect("release late handler completion");
    tokio::time::timeout(Duration::from_secs(5), late_completed_receiver)
        .await
        .expect("late handler should finish")
        .expect("late handler completion signal");
    assert_eq!(lifecycle_emitter.events(), lifecycle_events);
    assert_eq!(requests.lock().expect("provider requests").len(), 1);
}

#[tokio::test]
async fn repaired_tool_call_is_not_replayed_when_next_provider_step_times_out() {
    let provider = Arc::new(ToolCallThenHangingProvider {
        attempt: AtomicUsize::new(0),
        requests: Mutex::new(Vec::new()),
    });
    let retained_provider = provider.clone();
    let tool = Arc::new(CountingTool::default());
    let lifecycle_emitter = Arc::new(RecordingLifecycleEmitter::default());
    let mut turn_context = agent_protocol::turn_context::TurnContextOverride::default();
    turn_context.metadata.insert(
        "runtime_request".to_string(),
        serde_json::json!({
            "harness": {
                "generation": {
                    "first_visible_output_timeout_ms": 1_000,
                    "provider_step_timeout_ms": 20
                }
            }
        }),
    );

    let error = tokio::time::timeout(
        Duration::from_secs(5),
        run_current_provider_turn(
            CurrentProviderTurnInput {
                provider,
                provider_trace_metadata: None,
                session_config: crate::session_config::SessionConfigBuilder::new("session-timeout")
                    .turn_id("turn-timeout")
                    .turn_context(turn_context)
                    .max_turns(3)
                    .build(),
                initial_messages: vec![CurrentProviderMessage::user(vec![
                    CurrentProviderContent::Text("read it".to_string()),
                ])],
                tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                    RuntimeToolStepSnapshot::new(
                        vec![RuntimeToolDefinition::new(
                            "Read",
                            "visible tool",
                            serde_json::json!({
                                "type": "object",
                                "properties": {
                                    "path": { "type": "string" },
                                    "start_line": { "type": "integer", "minimum": 1 }
                                },
                                "required": ["path"]
                            }),
                        )],
                        RuntimeToolExecutorHandle::new(tool.clone()),
                    ),
                ),
                hook_snapshot_source: None,
                model_request_policy: None,
                tool_lifecycle_emitter: lifecycle_emitter.clone(),
                working_directory: PathBuf::from("."),
                cancel_token: None,
                pending_input: None,
                mid_turn_compaction: None,
            },
            |_| {},
        ),
    )
    .await
    .expect("provider timeout should beat the outer test timeout")
    .expect_err("second provider step should hit its absolute deadline");

    assert_eq!(
        error.message,
        "Provider step exceeded the absolute deadline of 20ms"
    );
    assert_eq!(tool.calls.load(Ordering::SeqCst), 1);
    let lifecycle_events = lifecycle_emitter.events();
    assert_eq!(lifecycle_events.len(), 2);
    assert_eq!(lifecycle_events[0].phase, ToolLifecyclePhase::Started);
    assert_eq!(lifecycle_events[1].phase, ToolLifecyclePhase::Completed);
    assert!(lifecycle_events[1]
        .output
        .as_ref()
        .is_some_and(|output| output.success));

    let requests = retained_provider
        .requests
        .lock()
        .expect("provider requests");
    assert_eq!(requests.len(), 2);
    let repaired_call = requests[1]
        .messages
        .iter()
        .flat_map(|message| message.content.iter())
        .find_map(|content| match content {
            CurrentProviderContent::ToolCall(call) => Some(call),
            _ => None,
        })
        .expect("repaired assistant tool call");
    assert_eq!(repaired_call.name, "read_file");
    assert_eq!(repaired_call.arguments["file_path"], " README.md ");
    assert_eq!(repaired_call.arguments["start_line"], "2");
    assert!(matches!(
        requests[1].messages.last(),
        Some(CurrentProviderMessage {
            producer: None, role: CurrentProviderRole::Tool,
            content,
        }) if matches!(content.as_slice(), [CurrentProviderContent::ToolResult(result)]
            if result.name == "read_file" && result.success)
    ));
}

#[tokio::test]
async fn malformed_unknown_and_schema_mismatched_calls_fail_without_reaching_step_executor() {
    let provider = Arc::new(ScriptedProvider::new(vec![
        vec![
            Ok(CanonicalLlmEvent::ToolCall {
                id: "call-malformed".to_string(),
                name: "Read".to_string(),
                input: serde_json::json!("{not-json"),
                raw_arguments: Some("{not-json".to_string()),
                provider_executed: None,
                provider_metadata: Default::default(),
            }),
            Ok(CanonicalLlmEvent::ToolCall {
                id: "call-mcp".to_string(),
                name: "mcp__hidden__unknown".to_string(),
                input: serde_json::json!({}),
                raw_arguments: None,
                provider_executed: None,
                provider_metadata: Default::default(),
            }),
            Ok(CanonicalLlmEvent::ToolCall {
                id: "call-schema".to_string(),
                name: "Read".to_string(),
                input: serde_json::json!({ "path": 42 }),
                raw_arguments: Some(r#"{"path":42}"#.to_string()),
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
        vec![
            Ok(CanonicalLlmEvent::TextDelta {
                id: "text-final".to_string(),
                text: "done".to_string(),
            }),
            Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::Stop,
                usage: None,
                needs_follow_up: false,
                response_id: Some("response-2".to_string()),
            }),
        ],
    ]));
    let requests = Arc::clone(&provider.requests);
    let step_executor = Arc::new(CountingTool::default());
    let lifecycle_emitter = Arc::new(RecordingLifecycleEmitter::default());

    run_current_provider_turn(
        CurrentProviderTurnInput {
            provider,
            provider_trace_metadata: None,
            session_config: crate::session_config::SessionConfigBuilder::new("session-1")
                .turn_id("turn-1")
                .max_turns(3)
                .build(),
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("guess hidden tools".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    vec![RuntimeToolDefinition::new(
                        "Read",
                        "visible tool",
                        serde_json::json!({
                            "type": "object",
                            "properties": {
                                "path": { "type": "string" }
                            },
                            "required": ["path"],
                            "additionalProperties": false
                        }),
                    )],
                    RuntimeToolExecutorHandle::new(step_executor.clone()),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: lifecycle_emitter.clone(),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
            mid_turn_compaction: None,
        },
        |_| {},
    )
    .await
    .expect("invalid tool calls should become failed tool results");

    assert_eq!(step_executor.calls.load(Ordering::SeqCst), 0);
    let lifecycle_events = lifecycle_emitter.events();
    assert_eq!(lifecycle_events.len(), 6);
    assert!(lifecycle_events
        .iter()
        .all(|event| event.tool_name == INVALID_TOOL_CALL_NAME));
    let errors = lifecycle_events
        .iter()
        .filter(|event| event.phase == ToolLifecyclePhase::Completed)
        .filter_map(|event| event.output.as_ref())
        .filter_map(|output| output.error.as_deref())
        .collect::<Vec<_>>();
    assert!(errors
        .iter()
        .any(|error| error.contains("malformed JSON arguments")));
    assert!(errors.iter().any(|error| error.contains("not advertised")));
    assert!(errors
        .iter()
        .any(|error| error.contains("did not match the advertised input schema")));
    for completed in lifecycle_events
        .iter()
        .filter(|event| event.phase == ToolLifecyclePhase::Completed)
    {
        let output = completed.output.as_ref().expect("completed output");
        assert!(!output.success);
        assert_eq!(
            output
                .metadata
                .get(tool_runtime::tool_result_projection::TOOL_HANDLER_EXECUTED_METADATA_KEY),
            Some(&serde_json::Value::Bool(false))
        );
    }

    let requests = requests.lock().expect("recorded requests");
    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0].tools.len(), 1);
    assert_eq!(requests[0].tools[0].name(), "Read");
    let schema_invalid_call = requests[1]
        .messages
        .iter()
        .flat_map(|message| message.content.iter())
        .find_map(|content| match content {
            CurrentProviderContent::ToolCall(call) if call.id == "call-schema" => Some(call),
            _ => None,
        })
        .expect("schema-invalid assistant tool call");
    assert_eq!(schema_invalid_call.name, "Read");
    assert_eq!(schema_invalid_call.raw_arguments, r#"{"path":42}"#);
    assert_eq!(schema_invalid_call.arguments["path"], 42);
    assert!(matches!(
        requests[1].messages.last(),
        Some(CurrentProviderMessage {
            producer: None, role: CurrentProviderRole::Tool,
            content,
        }) if content.len() == 3 && content.iter().all(|part| matches!(
            part,
            CurrentProviderContent::ToolResult(result)
                if !result.success
                    && match result.call_id.as_str() {
                        "call-malformed" | "call-schema" => result.name == "Read",
                        "call-mcp" => result.name == "mcp__hidden__unknown",
                        _ => false,
                    }
        ))
    ));
}
