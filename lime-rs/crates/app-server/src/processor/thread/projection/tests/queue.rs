use super::*;

#[test]
fn queued_submissions_do_not_project_as_public_turns_or_user_items() {
    let mut thread = canonical_thread(false);
    let mut queued = thread.turns[0].clone();
    queued.turn_id = canonical::TurnId::new("queued-1");
    queued.status = canonical::TurnStatus::InProgress;
    queued.queue = canonical::TurnQueueState::Queued { position: Some(1) };
    queued.items[0].turn_id = queued.turn_id.clone();
    queued.items[0].item_id = canonical::ItemId::new("queued-user-1");
    thread.turns.push(queued.clone());

    let projected = project_thread(thread.clone()).expect("public thread projection");
    assert_eq!(projected.turns.len(), 1);
    assert_eq!(projected.turns[0].id, "turn-1");
    assert_eq!(projected.turns[0].items.len(), 1);
    let turns = project_thread_turns_list_response(canonical::ThreadTurnsListResponse {
        data: thread.turns,
        next_cursor: None,
        backwards_cursor: None,
    })
    .expect("public turns projection");
    assert_eq!(turns.data.len(), 1);
    assert_eq!(turns.data[0].id, "turn-1");
    assert!(
        project_turn(queued).is_err(),
        "pending input cannot bypass history visibility"
    );
}

#[test]
fn admitted_queue_turn_projects_with_its_existing_user_identity() {
    let mut thread = canonical_thread(false);
    thread.turns[0].status = canonical::TurnStatus::InProgress;
    thread.turns[0].queue = canonical::TurnQueueState::Running;
    let projected = project_thread(thread).expect("admitted public turn");
    assert_eq!(projected.turns[0].id, "turn-1");
    assert_eq!(projected.turns[0].status, v2::TurnStatus::InProgress);
    assert!(matches!(&projected.turns[0].items[0],
        v2::ThreadItem::UserMessage { id, client_id, .. }
        if id == "item_message-1" && client_id.as_deref() == Some("client-1")
    ));
}
