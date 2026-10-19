use super::*;

/// Resolve the one authoritative prefix boundary; never combine conflicting marker copies.
pub(crate) fn covered_sequence(event: &AgentEvent) -> Result<u64, RuntimeCoreError> {
    let artifact = event
        .payload
        .get("artifact")
        .filter(|value| value.is_object());
    let top = event.payload.get("coveredThroughSequence");
    let nested = artifact.and_then(|value| value.get("coveredThroughSequence"));
    let value = match (top, nested) {
        (Some(top), Some(nested)) if top == nested => top,
        (Some(top), None) if artifact.is_none() => top,
        (None, Some(nested)) => nested,
        _ => {
            return Err(invalid_compaction_lineage(
                event,
                "missing or conflicting coveredThroughSequence",
            ))
        }
    };
    let covered = value.as_u64().ok_or_else(|| {
        invalid_compaction_lineage(
            event,
            "coveredThroughSequence must be a non-negative integer",
        )
    })?;
    if covered >= event.sequence {
        return Err(invalid_compaction_lineage(
            event,
            "coveredThroughSequence must precede its marker",
        ));
    }
    Ok(covered)
}

pub(in crate::runtime) fn validate_snapshot_boundary(
    events: &[AgentEvent],
    covered: u64,
) -> Result<(), RuntimeCoreError> {
    if covered != 0 && !events.iter().any(|event| event.sequence == covered) {
        return Err(RuntimeCoreError::Backend(
            "compaction prefix boundary is missing from its history snapshot".to_string(),
        ));
    }
    Ok(())
}

/// Manual compaction keeps the existing bounded tail policy, expressed as an event boundary.
pub(super) fn retained_tail_coverage(
    turns: &[AgentTurn],
    events: &[AgentEvent],
) -> Result<u64, RuntimeCoreError> {
    let completed = turns
        .iter()
        .filter(|turn| matches!(turn.status, app_server_protocol::AgentTurnStatus::Completed))
        .collect::<Vec<_>>();
    let Some(tail) = completed.get(completed.len().saturating_sub(MAX_TAIL_TURNS)) else {
        return Ok(events.last().map_or(0, |event| event.sequence));
    };
    let start = events
        .iter()
        .position(|event| event.turn_id.as_deref() == Some(tail.turn_id.as_str()))
        .ok_or_else(|| {
            RuntimeCoreError::Backend(
                "compaction retained tail is missing from its history snapshot".to_string(),
            )
        })?;
    Ok(start
        .checked_sub(1)
        .map_or(0, |index| events[index].sequence))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(sequence: u64, turn: Option<&str>) -> AgentEvent {
        AgentEvent {
            event_id: format!("boundary-{sequence}"),
            sequence,
            session_id: "session".to_string(),
            thread_id: Some("thread".to_string()),
            turn_id: turn.map(str::to_string),
            event_type: "fixture.event".to_string(),
            timestamp: "now".to_string(),
            payload: Value::Null,
        }
    }

    #[test]
    fn manual_policy_keeps_last_four_completed_turns_and_newer_events() {
        let turns = (1..=6)
            .map(|index| AgentTurn {
                turn_id: format!("turn-{index}"),
                session_id: "session".to_string(),
                thread_id: "thread".to_string(),
                status: app_server_protocol::AgentTurnStatus::Completed,
                started_at: None,
                completed_at: None,
            })
            .collect::<Vec<_>>();
        let events = vec![
            event(1, None),
            event(2, Some("turn-1")),
            event(3, Some("turn-2")),
            event(4, Some("turn-3")),
            event(5, Some("turn-4")),
            event(6, Some("turn-5")),
            event(7, Some("turn-6")),
            event(8, None),
        ];
        assert_eq!(retained_tail_coverage(&turns, &events).unwrap(), 3);
        assert!(retained_tail_coverage(&turns, &events[..3]).is_err());
        assert_eq!(retained_tail_coverage(&[], &events).unwrap(), 8);
        assert_eq!(retained_tail_coverage(&[], &[]).unwrap(), 0);
    }

    #[test]
    fn snapshot_rejects_a_missing_prefix_boundary() {
        let events = vec![event(1, None), event(3, None)];
        assert!(validate_snapshot_boundary(&events, 0).is_ok());
        assert!(validate_snapshot_boundary(&events, 1).is_ok());
        assert!(validate_snapshot_boundary(&events, 2).is_err());
        assert!(validate_snapshot_boundary(&events, 4).is_err());
    }
}
