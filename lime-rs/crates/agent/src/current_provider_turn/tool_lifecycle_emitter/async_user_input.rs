use super::*;
use agent_protocol::response_item::MessagePhase;
use agent_protocol::{AgentMessageDelivery, ItemStatus, TurnId};
use tool_runtime::request_user_input_async::{parse_request_user_input_async_args, question_text};

impl CurrentTurnToolLifecycleEmitter {
    pub(super) fn project_async_user_input(&self, event: ToolLifecycleEvent) -> Vec<AgentEvent> {
        // Dispatch precedes validation. Only a successful terminal invocation may
        // publish questions, so rejected or cancelled calls cannot leave ghost items.
        if !matches!(event.phase, ToolLifecyclePhase::Completed)
            || !event.output.as_ref().is_some_and(|output| output.success)
        {
            return Vec::new();
        }
        let Ok(args) = parse_request_user_input_async_args(&event.arguments) else {
            return Vec::new();
        };
        let now = chrono::Utc::now().timestamp_millis();
        let sequence = self.next_sequence.fetch_add(2, Ordering::Relaxed) + 1;
        let ordinal = self.next_ordinal.fetch_add(1, Ordering::Relaxed) + 1;
        let mut item = ThreadItem::new(
            self.session_id.clone(),
            self.thread_id.clone(),
            TurnId::new(event.turn_id),
            sequence,
            ordinal,
            ThreadItemPayload::AgentMessage {
                text: question_text(&args.questions),
                phase: Some(MessagePhase::FinalAnswer),
                content_parts: Vec::new(),
                delivery: Some(AgentMessageDelivery::Async),
                questions: Some(args.questions),
            },
        );
        item.item_id = ItemId::from_source(event.call_id);
        item.created_at_ms = now;
        item.updated_at_ms = now;
        item.status = ItemStatus::InProgress;
        let started = AgentEvent::ItemStarted { item: item.clone() };
        item.sequence = sequence + 1;
        item.status = ItemStatus::Completed;
        item.completed_at_ms = Some(now);
        vec![started, AgentEvent::ItemCompleted { item }]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tool_runtime::tool_executor::{RuntimeToolExecutionOutcome, RuntimeToolExecutionResult};
    use tool_runtime::tool_result_projection::NormalizedToolOutput;

    fn event(arguments: serde_json::Value, success: bool) -> ToolLifecycleEvent {
        ToolLifecycleEvent {
            turn_id: "turn-1".to_string(),
            call_id: "call-question".to_string(),
            tool_name: "request_user_input_async".to_string(),
            arguments,
            provider_metadata: serde_json::Value::Null,
            environments: Vec::new(),
            phase: ToolLifecyclePhase::Completed,
            output: Some(NormalizedToolOutput::from_execution_outcome(
                RuntimeToolExecutionOutcome::Result(Box::new(RuntimeToolExecutionResult::new(
                    success,
                    "{\"accepted\":true}".to_string(),
                    None,
                    HashMap::new(),
                ))),
                0,
            )),
        }
    }

    #[test]
    fn publishes_one_canonical_identity_only_after_complete_validation() {
        let (sender, _) = tokio::sync::mpsc::unbounded_channel();
        let emitter = CurrentTurnToolLifecycleEmitter::new(sender, "session-1", "thread-1");
        let valid = event(
            json!({"questions": [{"title": "Choose", "options": ["First", "Second"]}]}),
            true,
        );
        let mut started = valid.clone();
        started.phase = ToolLifecyclePhase::Started;
        started.output = None;
        assert!(emitter.project_all(started).is_empty());
        assert!(emitter
            .project_all(event(
                json!({"questions": [{"title": "valid"}, {"title": " "}]}),
                true
            ))
            .is_empty());
        assert!(emitter
            .project_all(event(valid.arguments.clone(), false))
            .is_empty());
        let items = emitter.project_all(valid);
        let [AgentEvent::ItemStarted { item: started }, AgentEvent::ItemCompleted { item: completed }] =
            items.as_slice()
        else {
            panic!("expected question lifecycle")
        };
        assert_eq!(started.item_id.as_str(), "call-question");
        assert_eq!(started.item_id, completed.item_id);
        assert_eq!(completed.sequence, started.sequence + 1);
        assert_eq!(completed.ordinal, started.ordinal);
        assert!(
            matches!(&completed.payload, ThreadItemPayload::AgentMessage {
            phase: Some(MessagePhase::FinalAnswer), delivery: Some(AgentMessageDelivery::Async), questions: Some(questions), ..
        } if questions.len() == 1)
        );
    }
}
