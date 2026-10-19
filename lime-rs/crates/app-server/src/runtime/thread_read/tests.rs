use super::*;
use crate::ProjectionStore;
use agent_protocol::{
    ItemId, ItemKind, ItemStatus, SessionId, Thread, ThreadHistoryChangeSet, ThreadId, ThreadItem,
    ThreadItemPayload, ThreadStatus, ThreadTurnsView, Turn, TurnAdmissionState, TurnApprovalState,
    TurnId, TurnItemsView, TurnQueueState, TurnStatus,
};
use app_server_protocol::{AgentEvent, AgentSessionStartParams, AgentTurn, AgentTurnStatus};
use serde_json::json;
use std::sync::Arc;
use thread_store::{
    ApplyThreadHistoryParams, ArchiveThreadParams, CreateThreadParams, ThreadStore,
};

mod history_visibility;
mod runtime_snapshot;
mod shutdown;

#[tokio::test]
async fn idle_unload_refuses_active_turn_then_removes_loaded_session() {
    let runtime = RuntimeCore::default();
    runtime
        .start_session(AgentSessionStartParams {
            session_id: Some("session-unload".to_string()),
            thread_id: Some("thread-unload".to_string()),
            app_id: "test".to_string(),
            workspace_id: None,
            business_object_ref: None,
            locale: None,
        })
        .expect("start unload test session");
    {
        let mut state = runtime
            .state
            .lock()
            .expect("runtime core state mutex poisoned");
        state
            .sessions
            .get_mut("session-unload")
            .expect("unload test session")
            .turns
            .push(AgentTurn {
                turn_id: "turn-unload".to_string(),
                session_id: "session-unload".to_string(),
                thread_id: "thread-unload".to_string(),
                status: AgentTurnStatus::Running,
                started_at: None,
                completed_at: None,
            });
    }

    assert_eq!(
        runtime
            .unload_thread_if_idle("thread-unload")
            .await
            .expect("active unload check"),
        ThreadUnloadResult::Active
    );
    assert_eq!(
        runtime.loaded_session_id_for_thread("thread-unload"),
        Some("session-unload".to_string())
    );

    runtime
        .state
        .lock()
        .expect("runtime core state mutex poisoned")
        .sessions
        .get_mut("session-unload")
        .expect("unload test session")
        .turns[0]
        .status = AgentTurnStatus::Completed;
    assert_eq!(
        runtime
            .unload_thread_if_idle("thread-unload")
            .await
            .expect("idle unload"),
        ThreadUnloadResult::Unloaded
    );
    assert_eq!(runtime.loaded_session_id_for_thread("thread-unload"), None);
}

#[tokio::test]
async fn canonical_thread_reads_use_the_projection_store_without_session_fallback() {
    let temp = tempfile::tempdir().expect("tempdir");
    let store = Arc::new(
        ProjectionStore::initialize(temp.path().join("projection.sqlite")).expect("store"),
    );
    let thread = make_thread("thread-current", 10);
    store
        .create_thread(CreateThreadParams {
            thread: thread.clone(),
        })
        .await
        .expect("create current thread");
    let archived = make_thread("thread-archived", 20);
    store
        .create_thread(CreateThreadParams {
            thread: archived.clone(),
        })
        .await
        .expect("create archived thread");
    store
        .archive_thread(ArchiveThreadParams {
            thread_id: archived.thread_id.clone(),
        })
        .await
        .expect("archive thread");

    let turn = Turn {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        turn_id: TurnId::new("turn-current"),
        status: TurnStatus::Completed,
        admission: TurnAdmissionState::Accepted,
        queue: TurnQueueState::Running,
        approval: TurnApprovalState::NotRequired,
        items: Vec::new(),
        items_view: TurnItemsView::NotLoaded,
        error: None,
        created_at_ms: 10,
        updated_at_ms: 12,
        started_at_ms: Some(10),
        completed_at_ms: Some(12),
        duration_ms: Some(2),
    };
    let item = ThreadItem {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        turn_id: turn.turn_id.clone(),
        item_id: ItemId::new("item-current"),
        sequence: 1,
        ordinal: 1,
        created_at_ms: 11,
        updated_at_ms: 12,
        completed_at_ms: Some(12),
        kind: ItemKind::AgentMessage,
        status: ItemStatus::Completed,
        payload: ThreadItemPayload::AgentMessage {
            text: "canonical".to_string(),
            phase: None,
            content_parts: Vec::new(),
            delivery: None,
            questions: None,
        },
        metadata: json!({}),
    };
    store
        .apply_history(ApplyThreadHistoryParams {
            session_id: thread.session_id.clone(),
            thread_id: thread.thread_id.clone(),
            changes: ThreadHistoryChangeSet {
                sequence: 1,
                changed_turns: vec![turn],
                changed_items: vec![item],
                ..Default::default()
            },
        })
        .await
        .expect("apply history");
    store
        .apply_event(&AgentEvent {
            event_id: "artifact-current".to_string(),
            sequence: 1,
            session_id: thread.session_id.to_string(),
            thread_id: Some(thread.thread_id.to_string()),
            turn_id: None,
            event_type: "artifact.snapshot".to_string(),
            timestamp: "2026-07-21T00:00:00Z".to_string(),
            payload: json!({
                "session": {
                    "createdAt": "2026-07-21T00:00:00Z",
                    "updatedAt": "2026-07-21T00:00:00Z",
                    "workspaceId": "workspace-current"
                },
                "artifact": {
                    "artifactId": "workspace-patch-current",
                    "kind": "workspace_patch",
                    "metadata": {
                        "workspacePatch": {
                            "schemaVersion": "article-workspace.v1",
                            "appId": "content-factory-app",
                            "sessionId": thread.session_id,
                            "workspaceId": "workspace-current",
                            "objects": [{
                                "ref": {
                                    "appId": "content-factory-app",
                                    "kind": "articleDraft",
                                    "id": "article-current",
                                    "sessionId": thread.session_id,
                                    "artifactIds": ["artifact-current"]
                                },
                                "title": "Current article",
                                "status": "ready",
                                "previewArtifactId": "artifact-current",
                                "source": {"markdown": "# Current article"}
                            }]
                        }
                    }
                }
            }),
        })
        .expect("apply product projection");

    let runtime = RuntimeCore::default().with_projection_store(store);
    let visible = runtime
        .list_threads(ThreadListParams {
            page: page(),
            include_archived: false,
            turns_view: ThreadTurnsView::NotLoaded,
            section: None,
            project: None,
            sort_by_section_position: false,
        })
        .await
        .expect("list visible");
    assert_eq!(visible.data.len(), 1);
    assert_eq!(visible.data[0].thread_id.as_str(), "thread-current");

    let all = runtime
        .list_threads(ThreadListParams {
            page: page(),
            include_archived: true,
            turns_view: ThreadTurnsView::Full,
            section: None,
            project: None,
            sort_by_section_position: false,
        })
        .await
        .expect("list all");
    assert_eq!(all.data.len(), 2);
    assert_eq!(
        all.data
            .iter()
            .find(|item| item.thread_id.as_str() == "thread-current")
            .expect("current thread")
            .turns
            .len(),
        1
    );

    let read = runtime
        .read_thread(ThreadReadParams {
            thread_id: thread.thread_id.clone(),
            turns_view: ThreadTurnsView::Full,
        })
        .await
        .expect("read thread");
    assert_eq!(
        read.thread.turns[0].items[0].item_id.as_str(),
        "item_item-current"
    );
    assert_eq!(
        read.thread.metadata["articleWorkspace"]["objects"][0]["ref"]["id"],
        "article-current"
    );
    assert!(read.thread.metadata["artifacts"]
        .as_array()
        .expect("thread artifacts")
        .iter()
        .any(|artifact| artifact["artifactRef"] == "artifact-current"));

    let turns = runtime
        .list_thread_turns(ThreadTurnsListParams {
            thread_id: thread.thread_id.clone(),
            page: page(),
            items_view: TurnItemsView::Full,
        })
        .await
        .expect("list turns");
    assert_eq!(turns.data[0].items[0].item_id.as_str(), "item_item-current");

    let items = runtime
        .list_thread_items(ThreadItemsListParams {
            thread_id: thread.thread_id,
            turn_id: None,
            page: page(),
        })
        .await
        .expect("list items");
    assert_eq!(items.data[0].item_id.as_str(), "item_item-current");
}

#[tokio::test]
async fn cold_runtime_interrupts_orphan_in_progress_turns_without_mutating_history() {
    let temp = tempfile::tempdir().expect("tempdir");
    let store = Arc::new(
        ProjectionStore::initialize(temp.path().join("projection.sqlite")).expect("store"),
    );
    let mut thread = make_thread("thread-orphan", 10);
    thread.status = ThreadStatus::Active {
        active_flags: Vec::new(),
    };
    store
        .create_thread(CreateThreadParams {
            thread: thread.clone(),
        })
        .await
        .expect("create orphan thread");
    let turn = Turn {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        turn_id: TurnId::new("turn-orphan"),
        status: TurnStatus::InProgress,
        admission: TurnAdmissionState::Accepted,
        queue: TurnQueueState::Running,
        approval: TurnApprovalState::NotRequired,
        items: Vec::new(),
        items_view: TurnItemsView::NotLoaded,
        error: None,
        created_at_ms: 10,
        updated_at_ms: 11,
        started_at_ms: Some(10),
        completed_at_ms: None,
        duration_ms: None,
    };
    store
        .apply_history(ApplyThreadHistoryParams {
            session_id: thread.session_id.clone(),
            thread_id: thread.thread_id.clone(),
            changes: ThreadHistoryChangeSet {
                sequence: 1,
                changed_turns: vec![turn],
                ..Default::default()
            },
        })
        .await
        .expect("apply orphan turn");

    let restarted = RuntimeCore::default().with_projection_store(store.clone());
    let read = restarted
        .read_thread(ThreadReadParams {
            thread_id: thread.thread_id.clone(),
            turns_view: ThreadTurnsView::Full,
        })
        .await
        .expect("read orphan thread");
    assert_eq!(read.thread.status, ThreadStatus::NotLoaded);
    assert_eq!(read.thread.turns[0].status, TurnStatus::Interrupted);

    let listed = restarted
        .list_threads(ThreadListParams {
            page: page(),
            include_archived: false,
            turns_view: ThreadTurnsView::Full,
            section: None,
            project: None,
            sort_by_section_position: false,
        })
        .await
        .expect("list orphan thread");
    assert_eq!(listed.data[0].status, ThreadStatus::NotLoaded);
    assert_eq!(listed.data[0].turns[0].status, TurnStatus::Interrupted);

    let turns = restarted
        .list_thread_turns(ThreadTurnsListParams {
            thread_id: thread.thread_id.clone(),
            page: page(),
            items_view: TurnItemsView::NotLoaded,
        })
        .await
        .expect("list orphan turns");
    assert_eq!(turns.data[0].status, TurnStatus::Interrupted);

    let persisted = store
        .read_thread(ReadThreadParams {
            thread_id: thread.thread_id,
            include_archived: false,
            turns_view: ThreadTurnsView::Full,
        })
        .await
        .expect("read persisted orphan thread")
        .expect("persisted orphan thread");
    assert_eq!(
        persisted.status,
        ThreadStatus::Active {
            active_flags: Vec::new(),
        }
    );
    assert_eq!(persisted.turns[0].status, TurnStatus::InProgress);
}

#[test]
fn runtime_snapshot_keeps_only_the_live_turn_in_progress() {
    let mut thread = make_thread("thread-live", 10);
    thread.status = ThreadStatus::Idle;
    let orphan = Turn {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        turn_id: TurnId::new("turn-orphan"),
        status: TurnStatus::InProgress,
        admission: TurnAdmissionState::Accepted,
        queue: TurnQueueState::Running,
        approval: TurnApprovalState::NotRequired,
        items: Vec::new(),
        items_view: TurnItemsView::NotLoaded,
        error: None,
        created_at_ms: 10,
        updated_at_ms: 11,
        started_at_ms: Some(10),
        completed_at_ms: None,
        duration_ms: None,
    };
    let live = Turn {
        turn_id: TurnId::new("turn-live"),
        created_at_ms: 12,
        updated_at_ms: 13,
        started_at_ms: Some(12),
        ..orphan.clone()
    };
    thread.turns = vec![orphan, live];

    normalize_thread_runtime_snapshot(
        &mut thread,
        &ThreadExecutionState {
            loaded: true,
            active_turn_id: Some("turn-live".to_string()),
            pending_turn_ids: Vec::new(),
        },
    );

    assert!(matches!(thread.status, ThreadStatus::Active { .. }));
    assert_eq!(thread.turns[0].status, TurnStatus::Interrupted);
    assert_eq!(thread.turns[1].status, TurnStatus::InProgress);
}

#[test]
fn loaded_runtime_preserves_turn_until_terminal_projection_converges() {
    let mut thread = make_thread("thread-converging", 10);
    thread.status = ThreadStatus::Idle;
    thread.turns = vec![Turn {
        session_id: thread.session_id.clone(),
        thread_id: thread.thread_id.clone(),
        turn_id: TurnId::new("turn-converging"),
        status: TurnStatus::InProgress,
        admission: TurnAdmissionState::Accepted,
        queue: TurnQueueState::Running,
        approval: TurnApprovalState::NotRequired,
        items: Vec::new(),
        items_view: TurnItemsView::NotLoaded,
        error: None,
        created_at_ms: 10,
        updated_at_ms: 11,
        started_at_ms: Some(10),
        completed_at_ms: None,
        duration_ms: None,
    }];
    let execution = ThreadExecutionState {
        loaded: true,
        active_turn_id: None,
        pending_turn_ids: vec!["turn-converging".to_string()],
    };
    thread.turns.push(Turn {
        turn_id: TurnId::new("turn-orphan"),
        ..thread.turns[0].clone()
    });

    normalize_thread_runtime_snapshot(&mut thread, &execution);

    assert!(matches!(thread.status, ThreadStatus::Active { .. }));
    assert_eq!(thread.turns[0].status, TurnStatus::InProgress);
    assert_eq!(thread.turns[1].status, TurnStatus::Interrupted);

    normalize_turn_runtime_snapshots(&mut thread.turns, &execution);
    assert_eq!(thread.turns[0].status, TurnStatus::InProgress);
    assert_eq!(thread.turns[1].status, TurnStatus::Interrupted);
}

fn make_thread(thread_id: &str, timestamp: i64) -> Thread {
    Thread {
        session_id: SessionId::new(format!("session-{thread_id}")),
        thread_id: ThreadId::new(thread_id),
        status: ThreadStatus::Idle,
        created_at_ms: timestamp,
        updated_at_ms: timestamp,
        archived: false,
        recency_at_ms: Some(timestamp),
        parent_thread_id: None,
        agent_path: None,
        agent_nickname: None,
        agent_role: None,
        last_task_message: None,
        agent_state: None,
        forked_from_id: None,
        preview: String::new(),
        model_provider: "test".to_string(),
        product: None,
        name: None,
        metadata: json!({}),
        turns: Vec::new(),
        turns_view: ThreadTurnsView::NotLoaded,
    }
}

fn page() -> PageCursor {
    PageCursor {
        cursor: None,
        limit: Some(20),
        sort_direction: agent_protocol::SortDirection::Asc,
    }
}
