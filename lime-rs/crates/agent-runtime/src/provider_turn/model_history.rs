use super::*;
use crate::model_history::{history_error, ModelHistoryRecord, ModelHistoryRecorder};

/// Step-local request construction; durable records still belong to the existing
/// host recorder. Presentation is replaced only by its own completed identity.
#[derive(Default)]
pub(super) struct AssistantHistory {
    pub content: Vec<CurrentProviderContent>,
    displays: HashMap<String, Vec<usize>>,
    suppressed: HashSet<usize>,
    producers: HashMap<usize, String>,
    text_phases: HashMap<String, Option<MessagePhase>>,
}

impl AssistantHistory {
    pub fn text_phase(&self, item_id: &str) -> Option<MessagePhase> {
        self.text_phases.get(item_id).copied().flatten()
    }

    pub fn has_completed_text(&self, item_id: &str) -> bool {
        self.text_phases.contains_key(item_id)
    }

    pub fn push(&mut self, content: CurrentProviderContent) {
        self.content.push(content);
    }

    pub fn display(&mut self, item_id: String, content: CurrentProviderContent) {
        self.displays
            .entry(item_id)
            .or_default()
            .push(self.content.len());
        self.content.push(content);
    }

    pub async fn complete(
        &mut self,
        turn_id: &str,
        attempt: u32,
        source_id: String,
        item: serde_json::Value,
        producer: Option<String>,
        recorder: Option<&ModelHistoryRecorder>,
    ) -> Result<Option<output_lifecycle::CompletedMessage>, RuntimeReplyAttemptError> {
        let family = match item.get("type").and_then(serde_json::Value::as_str) {
            Some("message") => ProviderOutputFamily::Text,
            Some("reasoning") => ProviderOutputFamily::Reasoning,
            _ => {
                return Err(history_error(
                    "unsupported completed model item".to_string(),
                ))
            }
        };
        let item_id = provider_output_item_id(turn_id, attempt, family, &source_id);
        let completed_message = matches!(family, ProviderOutputFamily::Text).then(|| {
            output_lifecycle::CompletedMessage {
                item_id: item_id.clone(),
                phase: item
                    .get("phase")
                    .and_then(serde_json::Value::as_str)
                    .and_then(MessagePhase::from_wire),
            }
        });
        let mut message = CurrentProviderMessage::raw_response_item(item);
        message.producer = producer;
        let record = ModelHistoryRecord::completed(message.clone(), item_id.clone())
            .map_err(history_error)?;
        if let Some(recorder) = recorder {
            recorder.record(record).await.map_err(history_error)?;
        }
        if let Some(message) = completed_message.as_ref() {
            self.text_phases.insert(item_id.clone(), message.phase);
        }
        if let Some(indices) = self.displays.remove(&item_id) {
            self.suppressed.extend(indices);
        }
        self.producers.insert(
            self.content.len(),
            message.producer.expect("validated producer"),
        );
        self.content.extend(message.content);
        Ok(completed_message)
    }

    pub fn into_messages(self) -> Vec<CurrentProviderMessage> {
        let mut messages = Vec::new();
        let mut pending = Vec::new();
        for (index, part) in self.content.into_iter().enumerate() {
            if self.suppressed.contains(&index) {
                continue;
            }
            if let Some(producer) = self.producers.get(&index) {
                if !pending.is_empty() {
                    messages.push(CurrentProviderMessage::assistant(std::mem::take(
                        &mut pending,
                    )));
                }
                let mut message = CurrentProviderMessage::assistant(vec![part]);
                message.producer = Some(producer.clone());
                messages.push(message);
            } else {
                pending.push(part);
            }
        }
        if !pending.is_empty() {
            messages.push(CurrentProviderMessage::assistant(pending));
        }
        messages
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn completed() -> serde_json::Value {
        serde_json::json!({"type":"reasoning","id":"rs_history",
            "summary":[{"type":"summary_text","text":"summary"}],
            "encrypted_content":"fixture-ciphertext"})
    }

    #[tokio::test]
    async fn completion_replaces_only_the_matching_display_identity() {
        let mut history = AssistantHistory::default();
        let source = provider_output_item_id(
            "turn",
            1,
            ProviderOutputFamily::Reasoning,
            "reasoning-rs_history",
        );
        history.display(
            source,
            CurrentProviderContent::Reasoning("same text".to_string()),
        );
        history.display(
            "another item".to_string(),
            CurrentProviderContent::Text("same text".to_string()),
        );
        history
            .complete(
                "turn",
                1,
                "reasoning-rs_history".to_string(),
                completed(),
                Some("fixture-producer".to_string()),
                None,
            )
            .await
            .unwrap();
        let messages = history.into_messages();
        assert_eq!(messages.len(), 2);
        assert_eq!(
            messages[0],
            CurrentProviderMessage::assistant(vec![CurrentProviderContent::Text(
                "same text".to_string()
            )])
        );
        assert_eq!(
            messages[1].content,
            vec![CurrentProviderContent::RawResponseItem(completed())]
        );
        assert_eq!(messages[1].producer.as_deref(), Some("fixture-producer"));
    }

    #[tokio::test]
    async fn failed_completion_receipt_does_not_replace_the_display() {
        let recorder = ModelHistoryRecorder::new(|record| {
            Box::pin(async move {
                assert_eq!(
                    record.message.content,
                    vec![CurrentProviderContent::RawResponseItem(completed())]
                );
                Err("disk rejected completed item".to_string())
            })
        });
        let mut history = AssistantHistory::default();
        let source = provider_output_item_id(
            "turn",
            1,
            ProviderOutputFamily::Reasoning,
            "reasoning-rs_history",
        );
        history.display(
            source,
            CurrentProviderContent::Reasoning("visible".to_string()),
        );
        let error = history
            .complete(
                "turn",
                1,
                "reasoning-rs_history".to_string(),
                completed(),
                Some("fixture-producer".to_string()),
                Some(&recorder),
            )
            .await
            .unwrap_err();
        assert_eq!(error.message, "disk rejected completed item");
        assert_eq!(
            history.into_messages(),
            vec![CurrentProviderMessage::assistant(vec![
                CurrentProviderContent::Reasoning("visible".to_string())
            ])]
        );
    }
}
