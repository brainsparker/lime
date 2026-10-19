use super::*;
use model_provider::current_client::{CurrentProviderContent, CurrentProviderToolCall};

fn call_record() -> ModelHistoryRecord {
    ModelHistoryRecord::calls(&[CurrentProviderContent::ToolCall(
        CurrentProviderToolCall::new("call-1", "Read", json!({})),
    )])
    .unwrap()
}

fn fixture(status: AgentTurnStatus) -> (tempfile::TempDir, AppendingRuntimeEventSink<'static>) {
    let temp = tempfile::tempdir().unwrap();
    let runtime = RuntimeCore::default().with_event_log_writer(Arc::new(
        EventLogWriter::new(temp.path().join("events")).unwrap(),
    ));
    runtime
        .start_session(AgentSessionStartParams {
            session_id: Some("history-session".to_string()),
            thread_id: Some("history-thread".to_string()),
            app_id: "test".to_string(),
            workspace_id: None,
            business_object_ref: None,
            locale: None,
        })
        .unwrap();
    runtime
        .state
        .lock()
        .unwrap()
        .sessions
        .get_mut("history-session")
        .unwrap()
        .turns
        .push(AgentTurn {
            turn_id: "history-turn".to_string(),
            session_id: "history-session".to_string(),
            thread_id: "history-thread".to_string(),
            status,
            started_at: None,
            completed_at: None,
        });
    let sink = AppendingRuntimeEventSink::with_hub(
        runtime.state.clone(),
        runtime.file_checkpoint_snapshot_store.clone(),
        runtime.output_snapshot_store.clone(),
        runtime.sidecar_store.clone(),
        runtime.event_log_writer.clone(),
        runtime.trace_event_writer.clone(),
        runtime.projection_store.clone(),
        runtime.session_loops.clone(),
        runtime.rollout_budget.clone(),
        "history-session".to_string(),
        "history-thread".to_string(),
        "history-turn".to_string(),
        runtime.event_hub.clone(),
    );
    (temp, sink)
}

#[test]
fn terminal_turn_cannot_acknowledge_a_discarded_model_history_append() {
    for status in [
        AgentTurnStatus::Completed,
        AgentTurnStatus::Failed,
        AgentTurnStatus::Canceled,
    ] {
        let (_temp, mut sink) = fixture(status);
        let writer = sink.event_log_writer.clone().unwrap();
        let before = writer.read_session_events("history-session").unwrap();
        let result = sink.persist_model_history(call_record());
        assert_eq!(
            writer.read_session_events("history-session").unwrap(),
            before
        );
        assert!(
            result.is_err(),
            "{status:?} discarded append was acknowledged: {result:?}"
        );
    }
}

#[tokio::test]
async fn session_history_receipt_reports_a_missing_durable_owner() {
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let sink = ChannelRuntimeEventSink { sender };
    let recorder = sink.history_recorder();
    let task = tokio::spawn(async move { recorder.record(call_record()).await });
    let Some(SessionLoopEvent::ModelHistory(append)) = receiver.recv().await else {
        panic!("history append event");
    };
    assert!(
        !task.is_finished(),
        "enqueuing is not a persistence receipt"
    );
    let mut sink = CollectingRuntimeEventSink::default();
    assert!(append.persist(&mut sink).is_err());
    assert!(task
        .await
        .unwrap()
        .unwrap_err()
        .contains("no durable model tool history owner"));
}

#[test]
fn history_append_without_event_log_cannot_return_a_durable_receipt() {
    let (_temp, mut sink) = fixture(AgentTurnStatus::Running);
    sink.event_log_writer = None;
    let before = sink.state.lock().unwrap().sessions["history-session"]
        .events
        .clone();
    assert!(sink.persist_model_history(call_record()).is_err());
    assert_eq!(
        sink.state.lock().unwrap().sessions["history-session"].events,
        before
    );
}

#[tokio::test]
async fn session_history_receipt_preserves_each_exact_event_log_identity() {
    let (_temp, mut sink) = fixture(AgentTurnStatus::Running);
    let writer = sink.event_log_writer.clone().unwrap();
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let recorder = ChannelRuntimeEventSink { sender }.history_recorder();
    let mut receipts = Vec::new();
    for _ in 0..2 {
        let recorder = recorder.clone();
        let task = tokio::spawn(async move { recorder.record(call_record()).await });
        let Some(SessionLoopEvent::ModelHistory(append)) = receiver.recv().await else {
            panic!("history append event");
        };
        assert!(
            !task.is_finished(),
            "enqueuing cannot acknowledge persistence"
        );
        append.persist(&mut sink).unwrap();
        let receipt = task.await.unwrap().unwrap();
        let records = writer.read_session_events("history-session").unwrap();
        let event = &records.last().unwrap().event;
        assert_eq!(receipt.event_id(), event.event_id);
        assert_eq!(receipt.sequence(), event.sequence);
        assert_eq!(event.event_type, MODEL_HISTORY_EVENT_TYPE);
        assert_eq!(event.turn_id.as_deref(), Some("history-turn"));
        assert_eq!(
            serde_json::from_value::<ModelHistoryRecord>(event.payload.clone()).unwrap(),
            call_record()
        );
        receipts.push(receipt);
    }
    assert_ne!(receipts[0].event_id(), receipts[1].event_id());
    assert!(receipts[0].sequence() < receipts[1].sequence());
}

#[tokio::test]
async fn failed_event_log_append_rejects_the_session_history_receipt() {
    let (temp, mut sink) = fixture(AgentTurnStatus::Running);
    sink.persist_model_history(call_record()).unwrap();
    let writer = sink.event_log_writer.clone().unwrap();
    let before = writer.read_session_events("history-session").unwrap();
    let before_state = sink.state.lock().unwrap().sessions["history-session"]
        .events
        .clone();
    let sessions = temp.path().join("events/sessions");
    let saved = temp.path().join("saved-sessions");
    std::fs::rename(&sessions, &saved).unwrap();
    std::fs::write(&sessions, "block durable append").unwrap();
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let recorder = ChannelRuntimeEventSink { sender }.history_recorder();
    let task = tokio::spawn(async move { recorder.record(call_record()).await });
    let Some(SessionLoopEvent::ModelHistory(append)) = receiver.recv().await else {
        panic!("history append event");
    };
    assert!(append.persist(&mut sink).is_err());
    assert!(
        task.await.unwrap().is_err(),
        "failed disk write cannot return a receipt"
    );
    std::fs::rename(&sessions, temp.path().join("blocked-sessions")).unwrap();
    std::fs::rename(&saved, &sessions).unwrap();
    assert_eq!(
        writer.read_session_events("history-session").unwrap(),
        before
    );
    assert_eq!(
        sink.state.lock().unwrap().sessions["history-session"].events,
        before_state
    );
}
