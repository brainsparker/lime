use super::*;
use thread_store::{ListTurnsParams, PageRequest, SearchThreadOccurrencesParams};

fn open_store(root: &std::path::Path, split: bool) -> ProjectionStore {
    if split {
        let roots = crate::StorageRoots::initialize(root, root.join("agent-root")).unwrap();
        ProjectionStore::initialize_with_storage_paths(
            &roots.projection_db_path,
            &roots.state_db_path,
            &roots.thread_history_db_path,
            &roots.data_root,
        )
        .unwrap()
    } else {
        ProjectionStore::initialize(root.join("single.sqlite")).unwrap()
    }
}

fn add_turn(
    store: &ProjectionStore,
    thread: &Thread,
    index: u64,
    pending: bool,
    text: &str,
) -> Turn {
    let mut turn = canonical_turn(thread);
    turn.turn_id = TurnId::new(format!("turn-{index}"));
    turn.queue = if pending {
        TurnQueueState::Queued { position: None }
    } else {
        TurnQueueState::Running
    };
    if pending {
        turn.status = TurnStatus::InProgress;
        turn.started_at_ms = None;
        turn.completed_at_ms = None;
    }
    let mut item = user_message(thread, text);
    item.turn_id = turn.turn_id.clone();
    item.item_id = ItemId::new(format!("user-{index}"));
    item.sequence = index;
    item.ordinal = index;
    block_on(store.apply_history(ApplyThreadHistoryParams {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        changes: ThreadHistoryChangeSet {
            sequence: index,
            changed_turns: vec![turn.clone()],
            changed_items: vec![item],
            ..Default::default()
        },
    }))
    .unwrap();
    turn
}

fn occurrences(
    store: &ProjectionStore,
    thread: &Thread,
    cursor: Option<thread_store::StoreCursor>,
    page_size: usize,
) -> thread_store::ThreadOccurrenceSearchPage {
    block_on(
        store.search_thread_occurrences(SearchThreadOccurrencesParams {
            thread_id: thread.thread_id.clone(),
            search_term: "needle".to_string(),
            cursor,
            page_size,
        }),
    )
    .unwrap()
}

#[test]
fn pending_only_text_is_searchable_only_after_admission_and_cold_reopen() {
    for split in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let reopen = || open_store(temp.path(), split);
        let store = reopen();
        let thread = canonical_thread(1);
        block_on(store.create_thread(CreateThreadParams {
            thread: thread.clone(),
        }))
        .unwrap();
        let mut turn = add_turn(&store, &thread, 1, true, "pending needle needle");
        drop(store);
        let store = reopen();
        let hidden =
            block_on(store.search_threads(search_params(None, 1, SortDirection::Desc))).unwrap();
        assert!(hidden.data.is_empty());
        assert_eq!((hidden.next_cursor, hidden.backwards_cursor), (None, None));
        let hidden = occurrences(&store, &thread, None, 1);
        assert!(hidden.data.is_empty());
        assert_eq!(hidden.next_cursor, None);

        turn.queue = TurnQueueState::Running;
        block_on(store.apply_history(ApplyThreadHistoryParams {
            session_id: thread.session_id.clone(),
            thread_id: thread.thread_id.clone(),
            changes: ThreadHistoryChangeSet {
                sequence: 2,
                changed_turns: vec![turn],
                ..Default::default()
            },
        }))
        .unwrap();
        drop(store);
        let store = reopen();
        let found =
            block_on(store.search_threads(search_params(None, 1, SortDirection::Desc))).unwrap();
        assert_eq!(found.data.len(), 1);
        assert_eq!(found.data[0].snippet, "pending needle needle");
        let found = occurrences(&store, &thread, None, 10);
        assert_eq!(found.data.len(), 2);
        assert!(found
            .data
            .iter()
            .all(|hit| hit.item_id.as_str() == "item_user-1" && hit.turn_id.as_str() == "turn-1"));
        assert_eq!(found.next_cursor, None);
    }
}

#[test]
fn occurrence_pages_fill_from_execution_history_and_cursors_anchor_visible_turns() {
    for split in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let store = open_store(temp.path(), split);
        let thread = canonical_thread(1);
        block_on(store.create_thread(CreateThreadParams {
            thread: thread.clone(),
        }))
        .unwrap();
        for index in 1..=5 {
            add_turn(
                &store,
                &thread,
                index,
                index % 2 == 1,
                &format!(
                    "{}-{index} needle needle",
                    if index % 2 == 1 {
                        "pending"
                    } else {
                        "executed"
                    }
                ),
            );
        }
        drop(store);
        let store = open_store(temp.path(), split);
        let search =
            block_on(store.search_threads(search_params(None, 1, SortDirection::Desc))).unwrap();
        assert_eq!(search.data[0].snippet, "executed-2 needle needle");
        let first = occurrences(&store, &thread, None, 3);
        assert_eq!(first.data.len(), 3);
        assert_eq!(
            first
                .data
                .iter()
                .map(|hit| hit.item_id.as_str())
                .collect::<Vec<_>>(),
            vec!["item_user-2", "item_user-2", "item_user-4"]
        );
        let second = occurrences(&store, &thread, first.next_cursor, 3);
        assert_eq!(second.data.len(), 1);
        assert_eq!(second.data[0].item_id.as_str(), "item_user-4");
        assert_eq!(second.next_cursor, None);
        for hit in first.data.iter().chain(second.data.iter()) {
            assert!(!hit.snippet.contains("pending"));
            let page = block_on(store.list_turns(ListTurnsParams {
                thread_id: thread.thread_id.clone(),
                include_archived: true,
                page: PageRequest {
                    cursor: Some(hit.turn_cursor.clone()),
                    limit: 1,
                    sort_direction: SortDirection::Asc,
                },
                items_view: TurnItemsView::NotLoaded,
            }))
            .unwrap();
            assert_eq!(page.data[0].turn_id, hit.turn_id);
        }
    }
}

#[test]
fn thread_search_pages_skip_pending_only_threads_in_both_directions() {
    let temp = tempfile::tempdir().unwrap();
    let store = ProjectionStore::initialize(temp.path().join("history.sqlite")).unwrap();
    for index in 1..=9 {
        let thread = canonical_thread(index);
        block_on(store.create_thread(CreateThreadParams {
            thread: thread.clone(),
        }))
        .unwrap();
        add_turn(&store, &thread, 1, true, "pending needle");
        if [2, 6, 8].contains(&index) {
            add_turn(&store, &thread, 2, false, "executed needle");
        }
    }
    for (direction, expected) in [
        (
            SortDirection::Desc,
            vec!["thread-8", "thread-6", "thread-2"],
        ),
        (SortDirection::Asc, vec!["thread-2", "thread-6", "thread-8"]),
    ] {
        let first = block_on(store.search_threads(search_params(None, 2, direction))).unwrap();
        assert_eq!(first.data.len(), 2);
        let second =
            block_on(store.search_threads(search_params(first.next_cursor.clone(), 2, direction)))
                .unwrap();
        assert_eq!(second.data.len(), 1);
        assert_eq!(second.next_cursor, None);
        assert_eq!(
            first
                .data
                .iter()
                .chain(second.data.iter())
                .map(|result| result.thread.thread_id.as_str())
                .collect::<Vec<_>>(),
            expected
        );
        assert!(first
            .data
            .iter()
            .chain(second.data.iter())
            .all(|result| result.snippet == "executed needle"));
        let reverse = match direction {
            SortDirection::Asc => SortDirection::Desc,
            SortDirection::Desc => SortDirection::Asc,
        };
        let backwards =
            block_on(store.search_threads(search_params(second.backwards_cursor, 2, reverse)))
                .unwrap();
        assert_eq!(
            backwards
                .data
                .iter()
                .map(|result| result.thread.thread_id.as_str())
                .collect::<Vec<_>>(),
            expected[..2].iter().rev().copied().collect::<Vec<_>>()
        );
        assert_eq!(backwards.next_cursor, None);
    }
}

#[test]
fn occurrence_cursor_survives_its_anchor_becoming_pending() {
    let temp = tempfile::tempdir().unwrap();
    let store = ProjectionStore::initialize(temp.path().join("history.sqlite")).unwrap();
    let thread = canonical_thread(1);
    block_on(store.create_thread(CreateThreadParams {
        thread: thread.clone(),
    }))
    .unwrap();
    add_turn(&store, &thread, 1, false, "needle");
    let mut tail = add_turn(&store, &thread, 2, false, "needle");
    let first = occurrences(&store, &thread, None, 1);
    tail.queue = TurnQueueState::Queued { position: None };
    block_on(store.apply_history(ApplyThreadHistoryParams {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        changes: ThreadHistoryChangeSet {
            sequence: 3,
            changed_turns: vec![tail],
            ..Default::default()
        },
    }))
    .unwrap();
    let next = occurrences(&store, &thread, first.next_cursor, 1);
    assert!(next.data.is_empty());
    assert_eq!(next.next_cursor, None);
}
