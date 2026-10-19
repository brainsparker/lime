//! Ordered model records; presentation remains a separate projection.

use futures::future::BoxFuture;
use model_provider::current_client::{
    CurrentProviderContent, CurrentProviderMessage, CurrentProviderRole,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;

pub const MODEL_HISTORY_EVENT_TYPE: &str = "provider.model_history";

/// Identity of the record accepted by the history owner, not a model-prefix boundary.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HistoryReceipt {
    event_id: String,
    sequence: u64,
}

impl HistoryReceipt {
    pub fn new(event_id: impl Into<String>, sequence: u64) -> Result<Self, String> {
        let event_id = event_id.into();
        if event_id.trim().is_empty() || sequence == 0 {
            return Err("model history receipt omitted durable record identity".to_string());
        }
        Ok(Self { event_id, sequence })
    }

    pub fn event_id(&self) -> &str {
        &self.event_id
    }

    pub fn sequence(&self) -> u64 {
        self.sequence
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelHistoryRecord {
    pub message: CurrentProviderMessage,
    pub metadata: ModelHistoryMetadata,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelHistoryMetadata {
    // Host budgets are persisted separately and restored only into request copies.
    pub output_token_limits: BTreeMap<String, usize>,
    /// Canonical presentation identity replaced by this completed item.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_item_id: Option<String>,
}

impl ModelHistoryRecord {
    pub fn completed(
        message: CurrentProviderMessage,
        source_item_id: String,
    ) -> Result<Self, String> {
        let record = Self {
            message,
            metadata: ModelHistoryMetadata {
                source_item_id: Some(source_item_id),
                ..Default::default()
            },
        };
        record.clone().into_message()?;
        Ok(record)
    }

    pub fn calls(content: &[CurrentProviderContent]) -> Option<Self> {
        let content = content
            .iter()
            .filter(|part| {
                matches!(
                    part,
                    CurrentProviderContent::ToolCall(_) | CurrentProviderContent::CustomToolCall(_)
                )
            })
            .cloned()
            .collect::<Vec<_>>();
        (!content.is_empty()).then(|| Self {
            message: CurrentProviderMessage::assistant(content),
            metadata: ModelHistoryMetadata::default(),
        })
    }

    pub fn outputs(content: &[CurrentProviderContent]) -> Self {
        let mut message = CurrentProviderMessage::tool(content.to_vec());
        let mut metadata = ModelHistoryMetadata::default();
        for part in &mut message.content {
            if let CurrentProviderContent::ToolResult(result)
            | CurrentProviderContent::CustomToolResult(result) = part
            {
                if let Some(limit) = result.history_token_limit.take() {
                    metadata
                        .output_token_limits
                        .insert(result.call_id.clone(), limit);
                }
            }
        }
        Self { message, metadata }
    }

    pub fn into_message(mut self) -> Result<CurrentProviderMessage, String> {
        if self.message.content.is_empty() {
            return Err("model tool history record has no content".to_string());
        }
        if let Some(source) = &self.metadata.source_item_id {
            if source.is_empty()
                || self.message.role != CurrentProviderRole::Assistant
                || self
                    .message
                    .producer
                    .as_ref()
                    .is_none_or(|origin| origin.is_empty())
                || !self.metadata.output_token_limits.is_empty()
                || !matches!(self.message.content.as_slice(), [CurrentProviderContent::RawResponseItem(item)]
                    if matches!(item.get("type").and_then(serde_json::Value::as_str), Some("message" | "reasoning")))
            {
                return Err(
                    "invalid completed model history identity, source or content".to_string(),
                );
            }
            return Ok(self.message);
        }
        if self.message.producer.is_some() {
            return Err("native model history omitted its presentation identity".to_string());
        }
        for part in &mut self.message.content {
            let id = match part {
                CurrentProviderContent::ToolCall(call)
                    if self.message.role == CurrentProviderRole::Assistant =>
                {
                    &call.id
                }
                CurrentProviderContent::CustomToolCall(call)
                    if self.message.role == CurrentProviderRole::Assistant =>
                {
                    &call.id
                }
                CurrentProviderContent::ToolResult(result)
                | CurrentProviderContent::CustomToolResult(result)
                    if self.message.role == CurrentProviderRole::Tool =>
                {
                    result.history_token_limit =
                        self.metadata.output_token_limits.remove(&result.call_id);
                    &result.call_id
                }
                _ => {
                    return Err(
                        "model tool history contains a non-tool item or invalid role".to_string(),
                    )
                }
            };
            // Invalid names remain model history and receive a failed result.
            // Only the call ID is required to associate the original response.
            if id.trim().is_empty() {
                return Err("model tool history omitted call identity".to_string());
            }
        }
        if !self.metadata.output_token_limits.is_empty() {
            return Err("model tool history budget has no matching output".to_string());
        }
        Ok(self.message)
    }
}

pub(crate) async fn record_calls(
    recorder: Option<&ModelHistoryRecorder>,
    content: &[CurrentProviderContent],
) -> Result<(), crate::reply_execution::RuntimeReplyAttemptError> {
    if let (Some(recorder), Some(record)) = (recorder, ModelHistoryRecord::calls(content)) {
        recorder.record(record).await.map_err(history_error)?;
    }
    Ok(())
}

pub(crate) async fn record_outputs(
    recorder: Option<&ModelHistoryRecorder>,
    content: &[CurrentProviderContent],
) -> Result<(), crate::reply_execution::RuntimeReplyAttemptError> {
    if let Some(recorder) = recorder {
        recorder
            .record(ModelHistoryRecord::outputs(content))
            .await
            .map_err(history_error)?;
    }
    Ok(())
}

pub(crate) fn history_error(message: String) -> crate::reply_execution::RuntimeReplyAttemptError {
    crate::reply_execution::RuntimeReplyAttemptError::new(message, true).suppress_reroute()
}

type Record =
    dyn Fn(ModelHistoryRecord) -> BoxFuture<'static, Result<HistoryReceipt, String>> + Send + Sync;

#[derive(Clone)]
pub struct ModelHistoryRecorder(Arc<Record>);

impl ModelHistoryRecorder {
    pub fn new(
        record: impl Fn(ModelHistoryRecord) -> BoxFuture<'static, Result<HistoryReceipt, String>>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        Self(Arc::new(record))
    }

    pub async fn record(&self, record: ModelHistoryRecord) -> Result<HistoryReceipt, String> {
        (self.0)(record).await
    }
}

impl std::fmt::Debug for ModelHistoryRecorder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ModelHistoryRecorder(..)")
    }
}

#[cfg(test)]
mod tests;
