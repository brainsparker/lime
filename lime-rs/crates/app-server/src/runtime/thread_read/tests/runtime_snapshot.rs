use super::*;
use agent_runtime::session_loop::{
    RuntimeSessionClosureTask, RuntimeSessionHandler, RuntimeSessionOperation,
    RuntimeSessionOperationSubmission, RuntimeSessionTaskOutcome,
};
use tokio::sync::Notify;

#[derive(Clone, Copy, Debug)]
enum ReadPath {
    Thread,
    Threads,
    Turns,
}

impl ReadPath {
    async fn read(
        self,
        runtime: &RuntimeCore,
        thread_id: ThreadId,
        items_view: TurnItemsView,
    ) -> Turn {
        let turns_view = if items_view == TurnItemsView::Full {
            ThreadTurnsView::Full
        } else {
            ThreadTurnsView::Summary
        };
        let mut turns = match self {
            Self::Thread => {
                let response = runtime
                    .read_thread(ThreadReadParams {
                        thread_id,
                        turns_view,
                    })
                    .await
                    .expect("read thread across turn completion");
                assert_eq!(response.thread.status, ThreadStatus::Idle);
                response.thread.turns
            }
            Self::Threads => {
                let response = runtime
                    .list_threads(ThreadListParams {
                        page: page(),
                        include_archived: false,
                        turns_view,
                        section: None,
                        project: None,
                        sort_by_section_position: false,
                    })
                    .await
                    .expect("list threads across turn completion");
                let thread = response.data.into_iter().next().expect("listed thread");
                assert_eq!(thread.thread_id, thread_id);
                assert_eq!(thread.status, ThreadStatus::Idle);
                thread.turns
            }
            Self::Turns => {
                runtime
                    .list_thread_turns(ThreadTurnsListParams {
                        thread_id,
                        page: page(),
                        items_view,
                    })
                    .await
                    .expect("list turns across turn completion")
                    .data
            }
        };
        assert_eq!(turns.len(), 1, "{self:?}: preserve the history membership");
        turns.remove(0)
    }
}

async fn completion_during_execution_snapshot(
    path: ReadPath,
    status: TurnStatus,
    items_view: TurnItemsView,
) {
    let temp = tempfile::tempdir().expect("snapshot fixture tempdir");
    let store = Arc::new(
        ProjectionStore::initialize(temp.path().join("projection.sqlite")).expect("snapshot store"),
    );
    let runtime = RuntimeCore::default().with_projection_store(Arc::clone(&store));
    let thread_id = ThreadId::new("thread-snapshot");
    let session_id = SessionId::new("session-snapshot");
    runtime
        .start_session(AgentSessionStartParams {
            session_id: Some(session_id.to_string()),
            thread_id: Some(thread_id.to_string()),
            app_id: "test".to_string(),
            workspace_id: None,
            business_object_ref: None,
            locale: None,
        })
        .expect("start snapshot session");
    let mut terminal = Turn {
        session_id: session_id.clone(),
        thread_id: thread_id.clone(),
        turn_id: TurnId::new("turn-snapshot"),
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
            session_id: session_id.clone(),
            thread_id: thread_id.clone(),
            changes: ThreadHistoryChangeSet {
                sequence: 1,
                changed_turns: vec![terminal.clone()],
                ..Default::default()
            },
        })
        .await
        .expect("persist in-progress snapshot");

    let handle = runtime
        .session_loops
        .get_or_create(session_id.as_str(), thread_id.as_str())
        .await
        .expect("snapshot session actor");
    let finish_task = Arc::new(Notify::new());
    let task_finished = Arc::new(Notify::new());
    let submission = handle
        .submit(
            Arc::new(RuntimeSessionClosureTask::new(
                terminal.turn_id.to_string(),
                Vec::new(),
                {
                    let finish_task = Arc::clone(&finish_task);
                    let task_finished = Arc::clone(&task_finished);
                    move |_, _, _| {
                        let finish_task = Arc::clone(&finish_task);
                        let task_finished = Arc::clone(&task_finished);
                        Box::pin(async move {
                            finish_task.notified().await;
                            task_finished.notify_one();
                            Ok(())
                        })
                    }
                },
            )),
            false,
        )
        .await
        .expect("submit live snapshot task");

    // Hold the actor so the public read can capture InProgress before it samples
    // execution ownership. The task will finish before the actor answers Snapshot.
    let actor_held = Arc::new(Notify::new());
    let release_actor = Arc::new(Notify::new());
    let blocker = tokio::spawn({
        let handle = handle.clone();
        let actor_held = Arc::clone(&actor_held);
        let release_actor = Arc::clone(&release_actor);
        async move {
            handle
                .dispatch(RuntimeSessionOperationSubmission::new(
                    RuntimeSessionOperation::ThreadSettings {
                        handler: RuntimeSessionHandler::new(move |_| {
                            let actor_held = Arc::clone(&actor_held);
                            let release_actor = Arc::clone(&release_actor);
                            Box::pin(async move {
                                actor_held.notify_one();
                                release_actor.notified().await;
                                Ok(())
                            })
                        }),
                    },
                ))
                .await
        }
    });
    actor_held.notified().await;
    let read = path.read(&runtime, thread_id.clone(), items_view);
    tokio::pin!(read);
    assert!(
        futures::poll!(&mut read).is_pending(),
        "{path:?}: history read must wait for the held execution snapshot"
    );

    terminal.status = status;
    terminal.updated_at_ms = 20;
    terminal.completed_at_ms = Some(20);
    terminal.duration_ms = Some(10);
    terminal.error = (status == TurnStatus::Failed).then(|| agent_protocol::TurnError {
        message: "snapshot failure".to_string(),
        code: Some("snapshot-test".to_string()),
        details: None,
    });
    let final_item = ThreadItem {
        session_id: session_id.clone(),
        thread_id: thread_id.clone(),
        turn_id: terminal.turn_id.clone(),
        item_id: ItemId::new("item_snapshot-final"),
        sequence: 2,
        ordinal: 0,
        created_at_ms: 19,
        updated_at_ms: 20,
        completed_at_ms: Some(20),
        kind: ItemKind::AgentMessage,
        status: ItemStatus::Completed,
        payload: ThreadItemPayload::AgentMessage {
            text: "SNAPSHOT_TURN_DONE".to_string(),
            phase: None,
            content_parts: Vec::new(),
            delivery: None,
            questions: None,
        },
        metadata: json!({}),
    };
    store
        .apply_history(ApplyThreadHistoryParams {
            session_id,
            thread_id,
            changes: ThreadHistoryChangeSet {
                sequence: 2,
                changed_turns: vec![terminal.clone()],
                changed_items: vec![final_item.clone()],
                ..Default::default()
            },
        })
        .await
        .expect("persist terminal after the first history snapshot");
    finish_task.notify_one();
    task_finished.notified().await;
    release_actor.notify_one();
    blocker
        .await
        .expect("actor blocker join")
        .expect("release actor");
    assert_eq!(
        submission
            .completion
            .await
            .expect("task completion channel"),
        Ok(RuntimeSessionTaskOutcome::Completed)
    );

    terminal.items_view = items_view;
    if items_view == TurnItemsView::Full {
        terminal.items = vec![final_item];
    }
    let actual = read.await;
    assert_eq!(
        actual, terminal,
        "{path:?}/{items_view:?}: prefer durable {status:?} over the old InProgress snapshot"
    );
}

#[tokio::test]
async fn thread_read_rechecks_terminal_after_execution_finishes() {
    for status in [
        TurnStatus::Completed,
        TurnStatus::Failed,
        TurnStatus::Interrupted,
    ] {
        for view in [TurnItemsView::NotLoaded, TurnItemsView::Full] {
            completion_during_execution_snapshot(ReadPath::Thread, status, view).await;
        }
    }
}

#[tokio::test]
async fn thread_list_rechecks_terminal_after_execution_finishes() {
    for status in [
        TurnStatus::Completed,
        TurnStatus::Failed,
        TurnStatus::Interrupted,
    ] {
        for view in [TurnItemsView::NotLoaded, TurnItemsView::Full] {
            completion_during_execution_snapshot(ReadPath::Threads, status, view).await;
        }
    }
}

#[tokio::test]
async fn thread_turns_list_rechecks_terminal_after_execution_finishes() {
    for status in [
        TurnStatus::Completed,
        TurnStatus::Failed,
        TurnStatus::Interrupted,
    ] {
        for view in [
            TurnItemsView::NotLoaded,
            TurnItemsView::Summary,
            TurnItemsView::Full,
        ] {
            completion_during_execution_snapshot(ReadPath::Turns, status, view).await;
        }
    }
}
