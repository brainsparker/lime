use super::CurrentProviderTurnEvent;
use crate::reply_execution::RuntimeReplyAttemptError;
use agent_protocol::response_item::MessagePhase;
use std::collections::HashMap;

#[derive(Default)]
pub(super) struct TextOutput {
    parts: Vec<String>,
    indices: HashMap<String, usize>,
}

impl TextOutput {
    fn part(&mut self, item_id: &str) -> &mut String {
        let index = *self.indices.entry(item_id.to_string()).or_insert_with(|| {
            self.parts.push(String::new());
            self.parts.len() - 1
        });
        &mut self.parts[index]
    }

    pub fn append(&mut self, item_id: &str, text: &str) {
        self.part(item_id).push_str(text);
    }

    pub fn complete(&mut self, item_id: &str, text: &str) {
        *self.part(item_id) = text.to_string();
    }

    pub fn text(&self) -> String {
        self.parts.concat()
    }

    pub fn visible(&self) -> bool {
        self.parts.iter().any(|text| !text.trim().is_empty())
    }

    pub fn chars(&self) -> u64 {
        self.parts
            .iter()
            .map(|text| text.chars().count() as u64)
            .sum()
    }
}

#[derive(Debug)]
pub(super) struct CompletedMessage {
    pub item_id: String,
    pub text: String,
    pub phase: Option<MessagePhase>,
}

#[derive(Debug)]
pub(super) struct CompletedReasoning {
    pub item_id: String,
    pub summary: Vec<String>,
    pub content: Vec<String>,
}

#[derive(Debug)]
pub(super) enum CompletedOutput {
    Message(CompletedMessage),
    Reasoning(CompletedReasoning),
}

#[derive(Default)]
pub(super) struct ReasoningOutput {
    sizes: HashMap<String, u64>,
}

impl ReasoningOutput {
    pub fn append(&mut self, item_id: &str, text: &str) {
        let size = self.sizes.entry(item_id.to_string()).or_default();
        *size = size.saturating_add(text.chars().count() as u64);
    }

    pub fn complete(&mut self, item: &CompletedReasoning) {
        let size = item
            .summary
            .iter()
            .chain(&item.content)
            .map(|text| text.chars().count() as u64)
            .sum();
        self.sizes.insert(item.item_id.clone(), size);
    }

    pub fn chars(&self) -> u64 {
        self.sizes.values().copied().sum()
    }
}

pub(super) fn complete_reasoning_output_item<F>(
    active_item_id: &mut Option<String>,
    item: CompletedReasoning,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    start_output_item(
        active_item_id,
        item.item_id.clone(),
        ProviderOutputFamily::Reasoning,
        on_event,
        emitted_any,
    )?;
    active_item_id.take();
    on_event(CurrentProviderTurnEvent::ReasoningCompleted {
        item_id: item.item_id,
        summary: item.summary,
        content: item.content,
    });
    Ok(())
}

pub(super) fn complete_text_output_item<F>(
    active_item_id: &mut Option<String>,
    pending_item_ids: &mut Vec<String>,
    message: CompletedMessage,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    defer_text_output_item_end(
        active_item_id,
        pending_item_ids,
        message.item_id.clone(),
        on_event,
        emitted_any,
    )?;
    pending_item_ids.retain(|item_id| item_id != &message.item_id);
    on_event(CurrentProviderTurnEvent::TextCompleted {
        item_id: message.item_id,
        text: message.text,
        phase: message.phase,
    });
    Ok(())
}

#[derive(Clone, Copy)]
pub(super) enum ProviderOutputFamily {
    Text,
    Reasoning,
}

impl ProviderOutputFamily {
    fn label(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Reasoning => "reasoning",
        }
    }

    fn started_event(self, item_id: String) -> CurrentProviderTurnEvent {
        match self {
            Self::Text => CurrentProviderTurnEvent::TextStart { item_id },
            Self::Reasoning => CurrentProviderTurnEvent::ReasoningStart { item_id },
        }
    }
}

pub(super) fn provider_output_item_id(
    turn_id: &str,
    attempt: u32,
    family: ProviderOutputFamily,
    source_item_id: &str,
) -> String {
    format!(
        "provider:{turn_id}:{attempt}:{}:{source_item_id}",
        family.label()
    )
}

pub(super) fn start_output_item<F>(
    active_item_id: &mut Option<String>,
    item_id: String,
    family: ProviderOutputFamily,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    match active_item_id.as_deref() {
        Some(active) if active == item_id => Ok(()),
        Some(active) => Err(RuntimeReplyAttemptError::new(
            format!(
                "Provider {} Item {} started while {} is still active",
                family.label(),
                item_id,
                active
            ),
            emitted_any,
        )),
        None => {
            *active_item_id = Some(item_id.clone());
            on_event(family.started_event(item_id));
            Ok(())
        }
    }
}

pub(super) fn end_reasoning_output_item<F>(
    active_item_id: &mut Option<String>,
    item_id: String,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    if active_item_id.is_none() {
        start_output_item(
            active_item_id,
            item_id.clone(),
            ProviderOutputFamily::Reasoning,
            on_event,
            emitted_any,
        )?;
    }
    match active_item_id.as_deref() {
        Some(active) if active == item_id => {
            active_item_id.take();
            on_event(CurrentProviderTurnEvent::ReasoningEnd { item_id });
            Ok(())
        }
        Some(active) => Err(RuntimeReplyAttemptError::new(
            format!(
                "Provider {} Item {} ended while {} is still active",
                ProviderOutputFamily::Reasoning.label(),
                item_id,
                active
            ),
            emitted_any,
        )),
        None => unreachable!("output item was started above"),
    }
}

pub(super) fn defer_text_output_item_end<F>(
    active_item_id: &mut Option<String>,
    pending_item_ids: &mut Vec<String>,
    item_id: String,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    if active_item_id.is_none() {
        start_output_item(
            active_item_id,
            item_id.clone(),
            ProviderOutputFamily::Text,
            on_event,
            emitted_any,
        )?;
    }
    match active_item_id.as_deref() {
        Some(active) if active == item_id => {
            active_item_id.take();
            pending_item_ids.push(item_id);
            Ok(())
        }
        Some(active) => Err(RuntimeReplyAttemptError::new(
            format!(
                "Provider text Item {} ended while {} is still active",
                item_id, active
            ),
            emitted_any,
        )),
        None => unreachable!("output item was started above"),
    }
}

pub(super) fn finish_active_output_items<F>(
    active_reasoning_item_id: &mut Option<String>,
    active_text_item_id: &mut Option<String>,
    pending_text_item_ids: &mut Vec<String>,
    on_event: &mut F,
) where
    F: FnMut(CurrentProviderTurnEvent),
{
    if let Some(item_id) = active_reasoning_item_id.take() {
        on_event(CurrentProviderTurnEvent::ReasoningEnd { item_id });
    }
    if let Some(item_id) = active_text_item_id.take() {
        pending_text_item_ids.push(item_id);
    }
}
