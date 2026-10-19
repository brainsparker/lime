use super::*;
use crate::model_history::{HistoryReceipt, ModelHistoryRecorder};

#[tokio::test]
async fn native_reasoning_snapshot_replaces_step_stats_and_ends_only_once() {
    for (summary, content) in [
        (vec!["summary", "second"], vec!["safe content", "完成🙂"]),
        (vec![], vec![]),
        (vec!["", "  "], vec!["\n"]),
    ] {
        for partial in [false, true] {
            let (execution, events, provider, receipts) =
                run(&summary, &content, partial, false).await;
            assert!(execution.unwrap().text_output.is_empty());
            assert_eq!(provider.requests.lock().unwrap().len(), 1);
            assert_eq!(receipts, 2);
            let completed = events
                .iter()
                .filter_map(|event| match event {
                    CurrentProviderTurnEvent::ReasoningCompleted {
                        item_id,
                        summary,
                        content,
                    } => Some((item_id, summary, content)),
                    _ => None,
                })
                .collect::<Vec<_>>();
            assert_eq!(completed.len(), 2);
            assert_ne!(completed[0].0, completed[1].0);
            assert_eq!(*completed[0].1, summary);
            assert_eq!(*completed[0].2, content);
            assert_eq!(*completed[1].1, vec!["tail"]);
            assert!(!events
                .iter()
                .any(|event| matches!(event, CurrentProviderTurnEvent::ReasoningEnd { .. })));
            assert_eq!(
                events
                    .iter()
                    .filter(|event| matches!(
                        event,
                        CurrentProviderTurnEvent::ReasoningSummaryDelta { .. }
                            | CurrentProviderTurnEvent::ReasoningContentDelta { .. }
                    ))
                    .count(),
                if partial { 2 } else { 0 },
                "snapshots must not synthesize deltas"
            );
            let expected = summary
                .iter()
                .chain(&content)
                .map(|text| text.chars().count() as u64)
                .sum::<u64>()
                + 4;
            assert!(events.iter().any(|event| matches!(event,
                CurrentProviderTurnEvent::ProviderStep { reasoning_output_chars, .. }
                    if *reasoning_output_chars == expected)));
        }
    }
}

#[tokio::test]
async fn failed_reasoning_receipt_does_not_publish_a_snapshot_or_resample() {
    let (result, events, provider, receipts) = run(&["summary"], &["content"], false, true).await;
    assert_eq!(
        result.unwrap_err().message,
        "reasoning snapshot history rejected"
    );
    assert_eq!(receipts, 1);
    assert_eq!(provider.requests.lock().unwrap().len(), 1);
    assert!(!events
        .iter()
        .any(|event| matches!(event, CurrentProviderTurnEvent::ReasoningCompleted { .. })));
}

async fn run(
    summary: &[&str],
    content: &[&str],
    partial: bool,
    fail_receipt: bool,
) -> (
    Result<RuntimeReplyExecution, RuntimeReplyAttemptError>,
    Vec<CurrentProviderTurnEvent>,
    Arc<ScriptedProvider>,
    usize,
) {
    let mut script = Vec::new();
    if partial {
        script.extend([
            Ok(CanonicalLlmEvent::ReasoningSummaryDelta {
                id: "reasoning-native".to_string(),
                text: "partial summary".to_string(),
                summary_index: 0,
            }),
            Ok(CanonicalLlmEvent::ReasoningContentDelta {
                id: "reasoning-native".to_string(),
                text: "partial content".to_string(),
                content_index: 0,
            }),
        ]);
    }
    for (source, summary, content) in [
        ("native", summary, content),
        ("tail", &["tail"][..], &[][..]),
    ] {
        script.push(Ok(CanonicalLlmEvent::ResponseItemDone {
            source_id: format!("reasoning-{source}"),
            item: serde_json::json!({"type":"reasoning","id":source,
                "summary":summary.iter().map(|text|serde_json::json!({"type":"summary_text","text":text})).collect::<Vec<_>>(),
                "content":content.iter().map(|text|serde_json::json!({"type":"reasoning_text","text":text})).collect::<Vec<_>>(),
                "encrypted_content":"opaque-fixture-content"}),
            producer: Some("snapshot-fixture".to_string()),
        }));
        script.push(Ok(CanonicalLlmEvent::ReasoningEnd {
            id: format!("reasoning-{source}"),
        }));
    }
    script.push(Ok(CanonicalLlmEvent::Finish {
        reason: FinishReason::Stop,
        usage: None,
        needs_follow_up: false,
        response_id: None,
    }));
    let provider = Arc::new(ScriptedProvider::new(vec![script]));
    let receipts = Arc::new(AtomicUsize::new(0));
    let recorded = receipts.clone();
    let mut config = crate::session_config::SessionConfigBuilder::new("snapshot-session")
        .turn_id("snapshot-turn")
        .build();
    config.model_history_recorder = Some(ModelHistoryRecorder::new(move |_| {
        let sequence = recorded.fetch_add(1, Ordering::SeqCst) as u64 + 1;
        Box::pin(async move {
            if fail_receipt {
                Err("reasoning snapshot history rejected".to_string())
            } else {
                HistoryReceipt::new(format!("snapshot-{sequence}"), sequence)
            }
        })
    }));
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
        },
        |event| {
            if matches!(event, CurrentProviderTurnEvent::ReasoningCompleted { .. }) {
                let completed = events
                    .iter()
                    .filter(|event| {
                        matches!(event, CurrentProviderTurnEvent::ReasoningCompleted { .. })
                    })
                    .count();
                assert_eq!(
                    receipts.load(Ordering::SeqCst),
                    completed + 1,
                    "receipt precedes display"
                );
            }
            events.push(event);
        },
    )
    .await;
    (result, events, provider, receipts.load(Ordering::SeqCst))
}
