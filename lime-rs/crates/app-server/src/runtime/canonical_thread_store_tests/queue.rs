use super::*;

fn stored() -> StoredSession {
    StoredSession {
        session: AgentSession {
            session_id: "session-queue-item".to_string(),
            thread_id: "thread-queue-item".to_string(),
            app_id: "agent-chat".to_string(),
            workspace_id: None,
            business_object_ref: None,
            status: AgentSessionStatus::Idle,
            created_at: "2026-07-12T00:00:00Z".to_string(),
            updated_at: "2026-07-12T00:00:01Z".to_string(),
        },
        turns: Vec::new(),
        turn_inputs: HashMap::new(),
        turn_runtime_options: HashMap::new(),
        events: Vec::new(),
        output_blobs: HashMap::new(),
    }
}

fn input(text: &str) -> Vec<AgentInput> {
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
    ]
}

fn queue_event(sequence: u64, kind: &str, turn_id: &str, input: &[AgentInput]) -> AgentEvent {
    AgentEvent {
        event_id: format!("queue-item-{sequence}"),
        sequence,
        session_id: "session-queue-item".to_string(),
        thread_id: Some("thread-queue-item".to_string()),
        turn_id: None,
        event_type: kind.to_string(),
        timestamp: format!("2026-07-12T00:00:{sequence:02}Z"),
        payload: json!({
            "queuedTurnId": turn_id,
            "queuedSubmissionId": turn_id,
            "clientId": format!("client-{turn_id}"),
            "input": input,
        }),
    }
}

fn read(store: &ProjectionStore) -> Thread {
    block_on(store.read_thread(ReadThreadParams {
        thread_id: ThreadId::new("thread-queue-item"),
        include_archived: false,
        turns_view: ThreadTurnsView::Full,
    }))
    .expect("read queued canonical thread")
    .expect("queued canonical thread exists")
}

fn assert_user(turn: &Turn, content: Vec<AgentInput>) {
    assert!(matches!(turn.queue, TurnQueueState::Queued { .. }));
    assert_eq!(turn.items.len(), 1);
    assert_eq!(
        turn.items[0].item_id,
        ItemId::new(format!("user-{}", turn.turn_id))
    );
    assert_eq!(turn.items[0].status, ItemStatus::Completed);
    assert_eq!(
        turn.items[0].payload,
        ThreadItemPayload::UserMessage {
            content,
            client_id: Some(format!("client-{}", turn.turn_id)),
        }
    );
}

fn verify_lifecycle(store: ProjectionStore, reopen: impl Fn() -> ProjectionStore) {
    let stored = stored();
    let initial = input("read initial");
    let edited = input("read edited");
    let other = vec![AgentInput::text("delete sentinel")];
    store
        .apply_canonical_events(
            &stored,
            &[
                queue_event(1, "queue.added", "rich", &initial),
                queue_event(2, "queue.added", "delete", &other),
            ],
        )
        .expect("persist queued user items");
    let before = read(&store);
    assert_eq!(before.turns.len(), 2);
    assert_user(&before.turns[0], initial);
    let original_item = before.turns[0].items[0].clone();

    store
        .apply_canonical_events(&stored, &[queue_event(3, "queue.updated", "rich", &edited)])
        .expect("edit existing queued user item");
    let updated = read(&store);
    assert_user(&updated.turns[0], edited.clone());
    assert_eq!(updated.turns[0].items[0].item_id, original_item.item_id);
    assert_eq!(updated.turns[0].items[0].ordinal, original_item.ordinal);
    assert_eq!(
        updated.turns[0].items[0].created_at_ms,
        original_item.created_at_ms
    );
    drop(store);

    let reopened = reopen();
    assert_user(&read(&reopened).turns[0], edited.clone());
    reopened
        .apply_canonical_events(
            &stored,
            &[
                queue_event(4, "queue.removed", "delete", &[]),
                queue_event(5, "queue.removed", "rich", &[]),
                queue_event(6, "queue.added", "delete", &other),
                queue_event(7, "queue.added", "rich", &edited),
            ],
        )
        .expect("reorder queued turns and rebuild their user items");
    let reordered = read(&reopened);
    assert_eq!(reordered.turns.len(), 2);
    assert_eq!(reordered.turns[0].turn_id.as_str(), "delete");
    assert_eq!(reordered.turns[1].turn_id.as_str(), "rich");
    assert_user(&reordered.turns[0], other);
    assert_user(&reordered.turns[1], edited.clone());
    drop(reopened);

    let reopened = reopen();
    assert_user(&read(&reopened).turns[1], edited.clone());
    reopened
        .apply_canonical_events(&stored, &[queue_event(8, "queue.removed", "delete", &[])])
        .expect("delete queued turn with canonical user item");
    drop(reopened);

    let reopened = reopen();
    let remaining = read(&reopened);
    assert_eq!(remaining.turns.len(), 1);
    assert_eq!(remaining.turns[0].turn_id.as_str(), "rich");
    assert_user(&remaining.turns[0], edited);
    let page = block_on(reopened.list_items(ListItemsParams {
        thread_id: ThreadId::new("thread-queue-item"),
        turn_id: None,
        include_archived: false,
        page: super::page(SortDirection::Asc, 10),
    }))
    .expect("read remaining canonical items");
    assert_eq!(page.data.len(), 1);
    assert_eq!(page.data[0].item_id, ItemId::new("user-rich"));
}

#[test]
fn queue_user_item_store_edit_reorder_delete_survive_restart() {
    let (temp, store) = store();
    verify_lifecycle(store, || {
        ProjectionStore::initialize(temp.path().join("projection.sqlite"))
            .expect("restart queue canonical store")
    });
}

#[test]
fn queue_user_item_split_store_edit_reorder_delete_survive_restart() {
    let temp = tempfile::tempdir().expect("tempdir");
    let roots = StorageRoots::initialize(temp.path(), temp.path().join("agent-root"))
        .expect("split storage roots");
    let reopen = || {
        ProjectionStore::initialize_with_storage_paths(
            &roots.projection_db_path,
            &roots.state_db_path,
            &roots.thread_history_db_path,
            &roots.data_root,
        )
        .expect("open split queue canonical store")
    };
    verify_lifecycle(reopen(), reopen);
}
