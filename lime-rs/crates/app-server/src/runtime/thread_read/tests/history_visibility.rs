use super::*;
use agent_protocol::SortDirection;

fn history_turn(thread: &Thread, index: u64, queued: bool) -> Turn {
    let turn_id = TurnId::new(format!("turn-{index}"));
    Turn {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        turn_id: turn_id.clone(),
        status: if queued {
            TurnStatus::InProgress
        } else {
            TurnStatus::Completed
        },
        admission: TurnAdmissionState::Accepted,
        queue: if queued {
            TurnQueueState::Queued {
                position: Some(index as u32),
            }
        } else {
            TurnQueueState::Running
        },
        approval: TurnApprovalState::NotRequired,
        items: vec![ThreadItem {
            session_id: thread.session_id.clone(),
            thread_id: thread.thread_id.clone(),
            turn_id,
            item_id: ItemId::new(format!("user-{index}")),
            kind: ItemKind::UserMessage,
            status: ItemStatus::Completed,
            payload: ThreadItemPayload::UserMessage {
                content: vec![agent_protocol::AgentInput::text(format!("input-{index}"))],
                client_id: Some(format!("client-{index}")),
            },
            sequence: index,
            ordinal: index,
            created_at_ms: index as i64,
            updated_at_ms: index as i64,
            completed_at_ms: Some(index as i64),
            metadata: json!({}),
        }],
        items_view: TurnItemsView::Full,
        error: None,
        created_at_ms: index as i64,
        updated_at_ms: index as i64,
        started_at_ms: (!queued).then_some(index as i64),
        completed_at_ms: (!queued).then_some(index as i64),
        duration_ms: None,
    }
}

async fn seed_history(store: &ProjectionStore, all_queued: bool) -> Thread {
    let thread = make_thread("history-visible", 1);
    store
        .create_thread(CreateThreadParams {
            thread: thread.clone(),
        })
        .await
        .unwrap();
    let turns = (1..=13)
        .map(|index| {
            history_turn(
                &thread,
                index,
                all_queued || ![2, 6, 10, 12].contains(&index),
            )
        })
        .collect::<Vec<_>>();
    store
        .apply_history(ApplyThreadHistoryParams {
            session_id: thread.session_id.clone(),
            thread_id: thread.thread_id.clone(),
            changes: ThreadHistoryChangeSet {
                sequence: 13,
                changed_items: turns.iter().flat_map(|turn| turn.items.clone()).collect(),
                changed_turns: turns,
                ..Default::default()
            },
        })
        .await
        .unwrap();
    thread
}

#[test]
fn queued_snapshot_never_becomes_orphaned_or_active() {
    for loaded in [false, true] {
        let mut thread = make_thread("pending-status", 1);
        thread.status = ThreadStatus::Active {
            active_flags: Vec::new(),
        };
        thread.turns = vec![history_turn(&thread, 1, true)];
        let execution = ThreadExecutionState {
            loaded,
            active_turn_id: None,
        };
        normalize_thread_runtime_snapshot(&mut thread, &execution);
        normalize_turn_runtime_snapshots(&mut thread.turns, &execution);
        assert_eq!(thread.turns[0].status, TurnStatus::InProgress);
        assert!(matches!(
            thread.turns[0].queue,
            TurnQueueState::Queued { .. }
        ));
        assert_eq!(
            thread.status,
            if loaded {
                ThreadStatus::Idle
            } else {
                ThreadStatus::NotLoaded
            }
        );
    }
    let mut thread = make_thread("real-active", 1);
    let mut active = history_turn(&thread, 2, false);
    active.status = TurnStatus::InProgress;
    thread.turns = vec![active, history_turn(&thread, 3, true)];
    normalize_thread_runtime_snapshot(
        &mut thread,
        &ThreadExecutionState {
            loaded: true,
            active_turn_id: Some("turn-2".to_string()),
        },
    );
    assert!(matches!(thread.status, ThreadStatus::Active { .. }));
    assert_eq!(thread.turns[0].status, TurnStatus::InProgress);
    assert_eq!(thread.turns[1].status, TurnStatus::InProgress);
}

#[tokio::test]
async fn mixed_history_fills_pages_in_both_directions_without_exposing_pending_items() {
    let temp = tempfile::tempdir().unwrap();
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let thread = seed_history(&store, false).await;
    let runtime = RuntimeCore::default().with_projection_store(store.clone());
    let read = runtime
        .read_thread(ThreadReadParams {
            thread_id: thread.thread_id.clone(),
            turns_view: ThreadTurnsView::Full,
        })
        .await
        .unwrap();
    assert_eq!(
        read.thread
            .turns
            .iter()
            .map(|turn| turn.turn_id.as_str())
            .collect::<Vec<_>>(),
        ["turn-2", "turn-6", "turn-10", "turn-12"]
    );
    for direction in [SortDirection::Asc, SortDirection::Desc] {
        let mut cursor = None;
        let mut turn_ids = Vec::new();
        let mut item_ids = Vec::new();
        loop {
            let turns = runtime
                .list_thread_turns(ThreadTurnsListParams {
                    thread_id: thread.thread_id.clone(),
                    page: PageCursor {
                        cursor: cursor.clone(),
                        limit: Some(2),
                        sort_direction: direction,
                    },
                    items_view: TurnItemsView::Full,
                })
                .await
                .unwrap();
            assert_eq!(turns.data.len(), 2, "visible turn page must be filled");
            assert!(turns.data.iter().all(|turn| !is_queued_turn(turn)));
            turn_ids.extend(turns.data.into_iter().map(|turn| turn.turn_id.to_string()));
            cursor = turns.next_cursor;
            if cursor.is_none() {
                break;
            }
        }
        cursor = None;
        loop {
            let items = runtime
                .list_thread_items(ThreadItemsListParams {
                    thread_id: thread.thread_id.clone(),
                    turn_id: None,
                    page: PageCursor {
                        cursor: cursor.clone(),
                        limit: Some(2),
                        sort_direction: direction,
                    },
                })
                .await
                .unwrap();
            assert_eq!(items.data.len(), 2, "visible item page must be filled");
            item_ids.extend(items.data.into_iter().map(|item| item.turn_id.to_string()));
            cursor = items.next_cursor;
            if cursor.is_none() {
                break;
            }
        }
        let expected = if direction == SortDirection::Asc {
            ["turn-2", "turn-6", "turn-10", "turn-12"]
        } else {
            ["turn-12", "turn-10", "turn-6", "turn-2"]
        };
        assert_eq!(turn_ids, expected);
        assert_eq!(item_ids, expected);
    }
    let hidden = runtime
        .list_thread_items(ThreadItemsListParams {
            thread_id: thread.thread_id.clone(),
            turn_id: Some(TurnId::new("turn-13")),
            page: page(),
        })
        .await
        .unwrap();
    assert!(hidden.data.is_empty());
    assert_eq!(hidden.next_cursor, None);
    assert_eq!(hidden.backwards_cursor, None);
    let (turn_cursor, item_cursor) = runtime
        .paginated_resume_backwards_cursors(thread.thread_id.clone())
        .await
        .unwrap();
    let resumed_turns = runtime
        .list_thread_turns(ThreadTurnsListParams {
            thread_id: thread.thread_id.clone(),
            page: PageCursor {
                cursor: turn_cursor,
                limit: Some(1),
                sort_direction: SortDirection::Desc,
            },
            items_view: TurnItemsView::Full,
        })
        .await
        .unwrap();
    let resumed_items = runtime
        .list_thread_items(ThreadItemsListParams {
            thread_id: thread.thread_id.clone(),
            turn_id: None,
            page: PageCursor {
                cursor: item_cursor,
                limit: Some(1),
                sort_direction: SortDirection::Desc,
            },
        })
        .await
        .unwrap();
    assert_eq!(resumed_turns.data[0].turn_id.as_str(), "turn-12");
    assert_eq!(resumed_items.data[0].turn_id.as_str(), "turn-12");
    let raw = store
        .read_thread(ReadThreadParams {
            thread_id: thread.thread_id,
            include_archived: true,
            turns_view: ThreadTurnsView::Full,
        })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        raw.turns.len(),
        13,
        "internal queue history must remain durable"
    );
    assert!(raw
        .turns
        .iter()
        .filter(|turn| is_queued_turn(turn))
        .all(|turn| turn.status == TurnStatus::InProgress));
}

#[tokio::test]
async fn all_pending_history_is_empty_after_reopen_and_admission_restores_visibility() {
    for split in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let roots =
            crate::StorageRoots::initialize(temp.path(), temp.path().join("agent-root")).unwrap();
        let reopen = || {
            if split {
                ProjectionStore::initialize_with_storage_paths(
                    &roots.projection_db_path,
                    &roots.state_db_path,
                    &roots.thread_history_db_path,
                    &roots.data_root,
                )
                .unwrap()
            } else {
                ProjectionStore::initialize(temp.path().join("single.sqlite")).unwrap()
            }
        };
        let store = reopen();
        let thread = seed_history(&store, true).await;
        drop(store);
        let store = Arc::new(reopen());
        let runtime = RuntimeCore::default().with_projection_store(store.clone());
        let turns = runtime
            .list_thread_turns(ThreadTurnsListParams {
                thread_id: thread.thread_id.clone(),
                page: page(),
                items_view: TurnItemsView::Full,
            })
            .await
            .unwrap();
        let items = runtime
            .list_thread_items(ThreadItemsListParams {
                thread_id: thread.thread_id.clone(),
                turn_id: None,
                page: page(),
            })
            .await
            .unwrap();
        assert!(turns.data.is_empty());
        assert_eq!((turns.next_cursor, turns.backwards_cursor), (None, None));
        assert!(items.data.is_empty());
        assert_eq!((items.next_cursor, items.backwards_cursor), (None, None));
        assert_eq!(
            runtime
                .paginated_resume_backwards_cursors(thread.thread_id.clone())
                .await
                .unwrap(),
            (None, None)
        );
        let mut admitted = history_turn(&thread, 13, false);
        admitted.status = TurnStatus::InProgress;
        store
            .apply_history(ApplyThreadHistoryParams {
                session_id: thread.session_id.clone(),
                thread_id: thread.thread_id.clone(),
                changes: ThreadHistoryChangeSet {
                    sequence: 14,
                    changed_turns: vec![admitted],
                    ..Default::default()
                },
            })
            .await
            .unwrap();
        let visible = runtime
            .read_thread(ThreadReadParams {
                thread_id: thread.thread_id.clone(),
                turns_view: ThreadTurnsView::Full,
            })
            .await
            .unwrap();
        assert_eq!(visible.thread.turns.len(), 1);
        assert_eq!(visible.thread.turns[0].turn_id.as_str(), "turn-13");
        assert_eq!(
            visible.thread.turns[0].items[0].item_id.as_str(),
            "item_user-13"
        );
        let raw = store
            .read_thread(ReadThreadParams {
                thread_id: thread.thread_id,
                include_archived: true,
                turns_view: ThreadTurnsView::Full,
            })
            .await
            .unwrap()
            .unwrap();
        assert_eq!(raw.turns.len(), 13);
        assert_eq!(
            raw.turns.iter().filter(|turn| is_queued_turn(turn)).count(),
            12
        );
    }
}
