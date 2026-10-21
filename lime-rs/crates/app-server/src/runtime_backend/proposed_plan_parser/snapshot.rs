use super::{
    message_key, segments_to_runtime_events, FinishedMessage, MessageParser, ProposedPlanParser,
    ProposedPlanSegment,
};

/// Reparse the authoritative body with the same per-message plan identities.
/// Text is a complete snapshot; it must never be replayed as another delta.
pub(super) fn finish(
    parser: &mut ProposedPlanParser,
    item_id: &str,
    text: &str,
) -> Result<FinishedMessage, String> {
    let key = message_key(Some(item_id));
    let previous = parser.messages.remove(&key).ok_or_else(|| {
        format!("provider Message Item {item_id} completed without a matching start or delta")
    })?;
    parser.message_order.retain(|candidate| candidate != &key);
    let mut completed = MessageParser {
        plan_revision_ids: previous.plan_revision_ids,
        ..MessageParser::default()
    };
    let mut segments = completed.push_text(text, &mut parser.plan_revision_index);
    segments.extend(completed.finish());
    let has_plan = completed.plan_revision_cursor > 0;
    let mut visible_text = String::new();
    let mut plans = Vec::new();
    let closed = &completed.finished_plans;
    for segment in segments {
        match segment {
            ProposedPlanSegment::MessageDelta(text) => visible_text.push_str(&text),
            ProposedPlanSegment::PlanDelta {
                ref revision_id, ..
            } if closed.contains_key(revision_id) => {}
            ProposedPlanSegment::PlanFinal {
                ref revision_id,
                ref text,
            } if previous.finished_plans.get(revision_id) == Some(text) => {}
            segment => plans.push(segment),
        }
    }
    if !has_plan {
        // Whitespace-only ordinary messages remain authoritative, too.
        let mut citation_parser = super::CitationParser::default();
        visible_text = citation_parser.push_str(text);
        visible_text.push_str(&citation_parser.finish());
    }
    let has_message_output =
        !has_plan || completed.message_output_emitted || previous.message_output_emitted;
    let memory_citation = completed.memory_citation();
    parser.message_output_emitted |= has_message_output;
    Ok(FinishedMessage {
        events: segments_to_runtime_events(plans, Some(item_id), &previous.source_payload),
        item_id: Some(item_id.to_string()),
        has_message_output,
        text: Some(visible_text),
        needs_start: !previous.message_output_emitted,
        memory_citation,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime_backend::proposed_plan_parser::split_runtime_event;
    use crate::RuntimeEvent;
    use serde_json::json;

    #[test]
    fn completion_replaces_body_without_replaying_message_deltas() {
        let mut parser = ProposedPlanParser::default();
        split_runtime_event(
            RuntimeEvent::new(
                "message.delta",
                json!({"itemId":"message", "text":"partial"}),
            ),
            &mut parser,
        );
        let message = finish(&mut parser, "message", "complete").unwrap();
        assert_eq!(message.text.as_deref(), Some("complete"));
        assert!(!message.needs_start);
        assert!(message.events.is_empty());
        assert!(parser.messages.is_empty());
    }

    #[test]
    fn completion_keeps_plan_identity_and_authoritative_visible_body() {
        let mut parser = ProposedPlanParser::default();
        let streamed = split_runtime_event(
            RuntimeEvent::new(
                "message.delta",
                json!({"itemId":"message", "text":"old<proposed_plan>- partial"}),
            ),
            &mut parser,
        );
        let plan_id = streamed[1].payload["revisionId"].clone();
        let message = finish(
            &mut parser,
            "message",
            "before<proposed_plan>- complete</proposed_plan>after",
        )
        .unwrap();
        assert_eq!(message.text.as_deref(), Some("beforeafter"));
        assert_eq!(message.events.len(), 1);
        assert_eq!(message.events[0].event_type, "plan.final");
        assert_eq!(message.events[0].payload["revisionId"], plan_id);
        assert_eq!(message.events[0].payload["text"], "- complete");
        assert_eq!(parser.plan_revision_index, 1);
    }

    #[test]
    fn identical_completed_plan_does_not_repeat_plan_completion() {
        let mut parser = ProposedPlanParser::default();
        let text = "<proposed_plan>- complete</proposed_plan>";
        split_runtime_event(
            RuntimeEvent::new("message.delta", json!({"itemId":"message", "text":text})),
            &mut parser,
        );
        let message = finish(&mut parser, "message", text).unwrap();
        assert!(!message.has_message_output);
        assert!(message.events.is_empty());
        assert_eq!(parser.plan_revision_index, 1);
    }

    #[test]
    fn no_delta_and_empty_snapshots_keep_explicit_message_lifecycle() {
        for text in ["complete", "", "  "] {
            let mut parser = ProposedPlanParser::default();
            parser.observe_message_start("message");
            let message = finish(&mut parser, "message", text).unwrap();
            assert_eq!(message.text.as_deref(), Some(text));
            assert!(message.has_message_output);
            assert!(message.needs_start);
        }
    }
}
