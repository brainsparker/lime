use super::*;
use agent_runtime::model_history::{
    HistoryReceipt, ModelHistoryRecord, ModelHistoryRecorder, MODEL_HISTORY_EVENT_TYPE,
};

pub(super) struct HistoryAppend {
    record: ModelHistoryRecord,
    receipt: oneshot::Sender<Result<HistoryReceipt, String>>,
}

impl HistoryAppend {
    pub(super) fn persist(self, sink: &mut dyn RuntimeEventSink) -> Result<(), RuntimeCoreError> {
        let result = sink.persist_model_history(self.record);
        let _ = self
            .receipt
            .send(result.as_ref().cloned().map_err(ToString::to_string));
        result.map(|_| ())
    }
}

impl ChannelRuntimeEventSink {
    pub(super) fn history_recorder(&self) -> ModelHistoryRecorder {
        let sender = self.sender.clone();
        ModelHistoryRecorder::new(move |record| {
            let sender = sender.clone();
            Box::pin(async move {
                let (receipt, persisted) = oneshot::channel();
                sender
                    .send(SessionLoopEvent::ModelHistory(HistoryAppend {
                        record,
                        receipt,
                    }))
                    .map_err(|_| "runtime session event receiver closed".to_string())?;
                persisted
                    .await
                    .map_err(|_| "model tool history persistence receipt closed".to_string())?
            })
        })
    }
}

impl AppendingRuntimeEventSink<'_> {
    pub(super) fn append_model_history(
        &mut self,
        record: ModelHistoryRecord,
    ) -> Result<HistoryReceipt, RuntimeCoreError> {
        let ephemeral = self.is_ephemeral()?;
        if !ephemeral && self.event_log_writer.is_none() {
            return Err(RuntimeCoreError::Backend(
                "model tool history requires an EventLog writer".to_string(),
            ));
        }
        record
            .clone()
            .into_message()
            .map_err(RuntimeCoreError::Backend)?;
        let payload = serde_json::to_value(record)
            .map_err(|error| RuntimeCoreError::Backend(error.to_string()))?;
        // Use the same EventLog/projection transaction and identity. Internal
        // history is neither a public notification nor a presentation Item.
        let events = append_runtime_events_to_state(
            &self.state,
            self.file_checkpoint_snapshot_store.as_ref(),
            self.output_snapshot_store.as_ref(),
            self.sidecar_store.as_deref(),
            self.event_log_writer.as_deref(),
            self.trace_event_writer.as_deref(),
            self.projection_store.as_deref(),
            Some(&self.session_loops),
            &self.session_id,
            &self.thread_id,
            Some(&self.turn_id),
            vec![RuntimeEvent::new(MODEL_HISTORY_EVENT_TYPE, payload)],
        )?;
        let [event] = events.as_slice() else {
            return Err(RuntimeCoreError::Backend(
                "model tool history append did not commit exactly one record".to_string(),
            ));
        };
        let receipt = if ephemeral {
            HistoryReceipt::in_memory
        } else {
            HistoryReceipt::new
        };
        receipt(event.event_id.clone(), event.sequence).map_err(RuntimeCoreError::Backend)
    }
}

#[cfg(test)]
#[path = "model_history/tests.rs"]
mod tests;
