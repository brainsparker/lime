use super::{event, materialize_events};
use crate::runtime::thread_item_projection::IncrementalMaterializer;
use agent_protocol::{AgentInput, ImageDetail, ItemId, ItemStatus, TextElement, ThreadItemPayload};
use app_server_protocol::AgentEvent;
use serde_json::json;

fn rich_input(text: &str) -> Vec<AgentInput> {
    vec![
        AgentInput::Text {
            text: text.to_string(),
            text_elements: vec![TextElement::new(0..4, Some("read".to_string()))],
        },
        AgentInput::Image {
            uri: "sidecar://media/input-image.png".to_string(),
            detail: Some(ImageDetail::Original),
        },
        AgentInput::text("then review"),
        AgentInput::Skill {
            name: "review".to_string(),
            path: "/skills/review/SKILL.md".to_string(),
        },
        AgentInput::Mention {
            name: "docs".to_string(),
            path: "app://docs".to_string(),
        },
    ]
}

fn queued_input(sequence: u64, kind: &str, input: &[AgentInput]) -> AgentEvent {
    event(
        &format!("queue-{sequence}"),
        sequence,
        kind,
        "wrong-outer-turn",
        json!({
            "queuedTurnId": "turn-queued",
            "queuedSubmissionId": "turn-queued",
            "id": "submission-id-is-not-item-id",
            "clientId": "client-queued",
            "input": input,
        }),
    )
}

#[test]
fn queue_user_item_uses_queued_identity_and_preserves_complete_input() {
    let input = rich_input("read first");
    let changes = materialize_events(
        &[queued_input(1, "queue.added", &input)],
        "session-1",
        "thread-1",
    )
    .expect("materialize queued input");

    assert_eq!(changes.changed_turns.len(), 1);
    assert_eq!(changes.changed_turns[0].turn_id.as_str(), "turn-queued");
    assert_eq!(changes.changed_items.len(), 1);
    let item = &changes.changed_items[0];
    assert_eq!(item.turn_id.as_str(), "turn-queued");
    assert_eq!(item.item_id, ItemId::new("user-turn-queued"));
    assert_eq!(item.status, ItemStatus::Completed);
    assert_eq!(
        item.payload,
        ThreadItemPayload::UserMessage {
            content: input,
            client_id: Some("client-queued".to_string()),
        }
    );
}

#[test]
fn queue_user_item_update_replaces_completed_input_without_duplicate_or_identity_loss() {
    let initial = rich_input("read first");
    let edited = rich_input("read edited");
    let initial_message = event(
        "initial-user",
        1,
        "message.created",
        "turn-queued",
        json!({"input": initial, "clientId": "client-queued"}),
    );
    let before = materialize_events(
        std::slice::from_ref(&initial_message),
        "session-1",
        "thread-1",
    )
    .expect("initial user item");
    let mut update = queued_input(3, "queue.updated", &edited);
    update.payload.as_object_mut().unwrap().remove("clientId");
    let changes = materialize_events(
        &[
            initial_message,
            queued_input(2, "queue.added", &initial),
            update,
        ],
        "session-1",
        "thread-1",
    )
    .expect("materialize queue edit");

    assert_eq!(changes.changed_items.len(), 1);
    let item = &changes.changed_items[0];
    assert_eq!(item.item_id, before.changed_items[0].item_id);
    assert_eq!(item.ordinal, before.changed_items[0].ordinal);
    assert_eq!(item.created_at_ms, before.changed_items[0].created_at_ms);
    assert_eq!(item.status, ItemStatus::Completed);
    assert_eq!(item.sequence, 3);
    assert_eq!(
        item.payload,
        ThreadItemPayload::UserMessage {
            content: edited,
            client_id: Some("client-queued".to_string()),
        }
    );
}

#[test]
fn queue_user_item_reorder_rebuilds_same_item_without_outer_turn() {
    let input = rich_input("read edited");
    let initial = queued_input(1, "queue.added", &input);
    let mut remove = event(
        "queue-remove",
        2,
        "queue.removed",
        "wrong-outer-turn",
        json!({"queuedTurnId": "turn-queued"}),
    );
    remove.turn_id = None;
    let mut added = queued_input(3, "queue.added", &input);
    added.turn_id = None;
    let changes = materialize_events(
        &[initial.clone(), remove.clone(), added.clone()],
        "session-1",
        "thread-1",
    )
    .expect("materialize queue reorder");

    assert_eq!(changes.removed_turn_ids[0].as_str(), "turn-queued");
    assert_eq!(changes.changed_turns.len(), 1);
    assert_eq!(changes.changed_items.len(), 1);
    assert_eq!(
        changes.changed_items[0].item_id,
        ItemId::new("user-turn-queued")
    );
    assert_eq!(
        changes.changed_items[0].payload,
        ThreadItemPayload::UserMessage {
            content: input,
            client_id: Some("client-queued".to_string()),
        }
    );

    let mut incremental = IncrementalMaterializer::from_events(&[initial], "session-1", "thread-1")
        .expect("incremental queue materializer");
    incremental.apply(&remove).expect("remove queued turn");
    assert!(incremental.items_for_turn("turn-queued").is_empty());
    let restored = incremental.apply(&added).expect("restore queued turn");
    assert_eq!(restored.item.unwrap(), changes.changed_items[0]);
    assert_eq!(incremental.items_for_turn("turn-queued").len(), 1);
}

#[test]
fn queue_user_item_rejects_invalid_or_missing_typed_input() {
    let mut missing = queued_input(1, "queue.added", &[]);
    missing.payload.as_object_mut().unwrap().remove("input");
    let invalid = queued_input(
        2,
        "queue.updated",
        &[AgentInput::Image {
            uri: String::new(),
            detail: None,
        }],
    );
    let changes = materialize_events(&[missing, invalid], "session-1", "thread-1")
        .expect("invalid queue input does not break durable event reads");
    assert!(changes.changed_items.is_empty());
}
