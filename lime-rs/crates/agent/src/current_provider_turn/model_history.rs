use super::CurrentTurnHostEvent;
use agent_runtime::model_history::{HistoryReceipt, ModelHistoryRecord, ModelHistoryRecorder};
use tokio::sync::{mpsc, oneshot};

pub(super) struct HistoryAppend {
    record: ModelHistoryRecord,
    recorder: ModelHistoryRecorder,
    receipt: oneshot::Sender<Result<HistoryReceipt, String>>,
}

impl HistoryAppend {
    pub(super) async fn persist(self) {
        let result = self.recorder.record(self.record).await;
        let _ = self.receipt.send(result);
    }

    pub(super) fn reject(self) {
        let _ = self.receipt.send(Err(
            "provider turn closed before model history append".to_string()
        ));
    }
}

// Preserve the existing host-event order before crossing the session driver's
// durable boundary. A successful channel send is not a persistence receipt.
pub(super) fn ordered_recorder(
    recorder: ModelHistoryRecorder,
    sender: mpsc::UnboundedSender<CurrentTurnHostEvent>,
) -> ModelHistoryRecorder {
    ModelHistoryRecorder::new(move |record| {
        let sender = sender.clone();
        let recorder = recorder.clone();
        Box::pin(async move {
            let (receipt, persisted) = oneshot::channel();
            sender
                .send(CurrentTurnHostEvent::ModelHistory(HistoryAppend {
                    record,
                    recorder,
                    receipt,
                }))
                .map_err(|_| "provider host event receiver closed".to_string())?;
            persisted
                .await
                .map_err(|_| "model history receipt channel closed".to_string())?
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use model_provider::current_client::{CurrentProviderContent, CurrentProviderToolCall};
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    #[tokio::test]
    async fn host_history_send_waits_for_the_persistence_result() {
        let calls = Arc::new(AtomicUsize::new(0));
        let persisted = calls.clone();
        let source = ModelHistoryRecorder::new(move |_| {
            persisted.fetch_add(1, Ordering::SeqCst);
            Box::pin(async { Err("disk rejected append".to_string()) })
        });
        let (sender, mut receiver) = mpsc::unbounded_channel();
        let recorder = ordered_recorder(source, sender);
        let record = ModelHistoryRecord::calls(&[CurrentProviderContent::ToolCall(
            CurrentProviderToolCall::new("call-1", "Read", serde_json::json!({})),
        )])
        .unwrap();
        let task = tokio::spawn(async move { recorder.record(record).await });
        let Some(CurrentTurnHostEvent::ModelHistory(append)) = receiver.recv().await else {
            panic!("history append event");
        };
        assert_eq!(calls.load(Ordering::SeqCst), 0);
        assert!(!task.is_finished(), "enqueuing is not a durable receipt");
        append.persist().await;
        assert_eq!(task.await.unwrap(), Err("disk rejected append".to_string()));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn host_history_preserves_the_durable_owners_receipt() {
        let expected = HistoryReceipt::new("durable-history-event", 41).unwrap();
        let persisted = expected.clone();
        let source = ModelHistoryRecorder::new(move |_| {
            let persisted = persisted.clone();
            Box::pin(async move { Ok(persisted) })
        });
        let (sender, mut receiver) = mpsc::unbounded_channel();
        let recorder = ordered_recorder(source, sender);
        let record = ModelHistoryRecord::calls(&[CurrentProviderContent::ToolCall(
            CurrentProviderToolCall::new("call-1", "Read", serde_json::json!({})),
        )])
        .unwrap();
        let task = tokio::spawn(async move { recorder.record(record).await });
        let Some(CurrentTurnHostEvent::ModelHistory(append)) = receiver.recv().await else {
            panic!("history append event");
        };
        assert!(!task.is_finished(), "host enqueue cannot invent a receipt");
        append.persist().await;
        assert_eq!(task.await.unwrap().unwrap(), expected);
    }
}
