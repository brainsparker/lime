use super::*;
use crate::model_history::ModelHistoryRecorder;

#[tokio::test]
async fn native_snapshot_updates_reply_and_step_stats_without_synthetic_deltas() {
    for text in ["complete", "", "完成🙂", "tail"] {
        for delta in [None, Some("partial streamed body")] {
            let (execution, events, provider) = run(text, delta, false).await;
            let execution = execution.unwrap();
            assert_eq!(execution.text_output, format!("{text}tail"));
            assert_eq!(provider.requests.lock().unwrap().len(), 1);
            assert_eq!(
                events
                    .iter()
                    .filter(|event| matches!(event, CurrentProviderTurnEvent::TextDelta { .. }))
                    .count(),
                usize::from(delta.is_some()),
                "a completed snapshot is not a synthetic text delta",
            );
            let completed = events
                .iter()
                .filter_map(|event| match event {
                    CurrentProviderTurnEvent::TextCompleted {
                        item_id,
                        text,
                        phase,
                    } => Some((item_id, text, phase)),
                    _ => None,
                })
                .collect::<Vec<_>>();
            assert_eq!(completed.len(), 2);
            assert_ne!(completed[0].0, completed[1].0);
            assert_eq!(completed[0].1, text);
            assert_eq!(*completed[0].2, Some(MessagePhase::FinalAnswer));
            assert_eq!(completed[1].1, "tail");
            assert_eq!(*completed[1].2, None);
            assert!(events.iter().any(|event| matches!(event,
                CurrentProviderTurnEvent::ProviderStep { text_output_chars, .. }
                if *text_output_chars == (text.chars().count() + 4) as u64
            )));
        }
    }
}

#[tokio::test]
async fn failed_native_history_receipt_never_publishes_the_completed_snapshot() {
    let (result, events, provider) = run("complete", None, true).await;
    let error = result.unwrap_err();
    assert_eq!(error.message, "snapshot history rejected");
    assert!(!error.is_reroutable_provider_failure());
    assert!(!events
        .iter()
        .any(|event| matches!(event, CurrentProviderTurnEvent::TextCompleted { .. })));
    assert_eq!(provider.requests.lock().unwrap().len(), 1);
}

async fn run(
    text: &str,
    delta: Option<&str>,
    fail_receipt: bool,
) -> (
    Result<RuntimeReplyExecution, RuntimeReplyAttemptError>,
    Vec<CurrentProviderTurnEvent>,
    Arc<ScriptedProvider>,
) {
    let mut events = Vec::new();
    if let Some(text) = delta {
        events.push(Ok(CanonicalLlmEvent::TextDelta {
            id: "text-native".to_string(),
            text: text.to_string(),
        }));
    }
    for (source, text, phase) in [
        ("native", text, Some("final_answer")),
        ("tail", "tail", None),
    ] {
        events.push(Ok(CanonicalLlmEvent::ResponseItemDone {
            source_id: format!("text-{source}"),
            item: serde_json::json!({"type":"message","id":source,"role":"assistant",
                "phase":phase,"content":[{"type":"output_text","text":text}]}),
            producer: Some("snapshot-fixture".to_string()),
        }));
    }
    events.push(Ok(CanonicalLlmEvent::Finish {
        reason: FinishReason::Stop,
        usage: None,
        needs_follow_up: false,
        response_id: None,
    }));
    let provider = Arc::new(ScriptedProvider::new(vec![events]));
    let mut config = crate::session_config::SessionConfigBuilder::new("snapshot-session")
        .turn_id("snapshot-turn")
        .build();
    if fail_receipt {
        config.model_history_recorder = Some(ModelHistoryRecorder::new(|_| {
            Box::pin(async { Err("snapshot history rejected".to_string()) })
        }));
    }
    let mut events = Vec::new();
    let result = run_current_provider_turn(
        CurrentProviderTurnInput {
            provider: provider.clone(),
            provider_trace_metadata: None,
            session_config: config,
            initial_messages: vec![CurrentProviderMessage::user(vec![
                CurrentProviderContent::Text("show snapshot".to_string()),
            ])],
            tool_step_snapshot_source: RuntimeToolStepSnapshotSourceHandle::fixed(
                RuntimeToolStepSnapshot::new(
                    Vec::new(),
                    RuntimeToolExecutorHandle::new(Arc::new(CountingTool::default())),
                ),
            ),
            hook_snapshot_source: None,
            model_request_policy: None,
            tool_lifecycle_emitter: Arc::new(RecordingLifecycleEmitter::default()),
            working_directory: PathBuf::from("."),
            cancel_token: None,
            pending_input: None,
            mid_turn_compaction: None,
        },
        |event| events.push(event),
    )
    .await;
    (result, events, provider)
}
