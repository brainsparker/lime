use crate::runtime::*;
use agent_protocol::{PageCursor, ThreadId, ThreadTurnsView, TurnItemsView};
use app_server_protocol::AgentInput;
use app_server_protocol::*;
use serde_json::json;
use std::sync::Arc;

const SESSION: &str = "ephemeral-session";
const THREAD: &str = "ephemeral-thread";
const PNG: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

fn fixture() -> (tempfile::TempDir, RuntimeCore) {
    let temp = tempfile::tempdir().unwrap();
    let runtime = RuntimeCore::with_backend(Arc::new(MockBackend))
        .with_projection_store(Arc::new(
            ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
        ))
        .with_event_log_writer(Arc::new(
            EventLogWriter::new(temp.path().join("events")).unwrap(),
        ))
        .with_trace_event_writer(Arc::new(
            TraceEventWriter::new(temp.path().join("traces")).unwrap(),
        ))
        .with_sidecar_store(Arc::new(
            SidecarStore::new(temp.path().join("sidecars")).unwrap(),
        ))
        .with_file_checkpoint_snapshot_store(Arc::new(
            crate::file_checkpoint_snapshot::FilesystemFileCheckpointSnapshotStore::with_base_dir(
                temp.path().join("checkpoints"),
            ),
        ))
        .with_output_snapshot_store(Arc::new(
            output_refs::FilesystemOutputSnapshotStore::with_base_dir(temp.path().join("outputs")),
        ));
    runtime
        .start_session(AgentSessionStartParams {
            session_id: Some(SESSION.to_string()),
            thread_id: Some(THREAD.to_string()),
            app_id: "test".to_string(),
            workspace_id: None,
            business_object_ref: Some(BusinessObjectRef {
                kind: "agent.thread".to_string(),
                id: THREAD.to_string(),
                title: Some("Ephemeral".to_string()),
                uri: None,
                metadata: Some(json!({"ephemeral": true})),
            }),
            locale: None,
        })
        .unwrap();
    (temp, runtime)
}

fn read_params(view: ThreadTurnsView) -> ThreadReadParams {
    ThreadReadParams {
        thread_id: ThreadId::new(THREAD),
        turns_view: view,
    }
}

fn files(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut result = Vec::new();
    for entry in std::fs::read_dir(root).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            result.extend(files(&path));
        } else {
            result.push(path);
        }
    }
    result
}

#[tokio::test]
async fn ephemeral_read_is_live_metadata_and_history_requests_are_rejected() {
    let (_temp, runtime) = fixture();
    let thread = runtime
        .read_thread(read_params(ThreadTurnsView::NotLoaded))
        .await
        .unwrap()
        .thread;
    assert_eq!(thread.thread_id.as_str(), THREAD);
    assert_eq!(thread.metadata["ephemeral"], true);
    assert!(thread.turns.is_empty());
    assert!(runtime.can_accept_direct_input(THREAD).await.unwrap());
    assert_eq!(
        runtime
            .list_loaded_threads(Default::default())
            .unwrap()
            .data,
        vec![THREAD]
    );
    assert!(runtime
        .list_threads(ThreadListParams {
            page: PageCursor::default(),
            include_archived: false,
            turns_view: ThreadTurnsView::NotLoaded,
            section: None,
            project: None,
            sort_by_section_position: false,
        })
        .await
        .unwrap()
        .data
        .is_empty());
    for view in [ThreadTurnsView::Summary, ThreadTurnsView::Full] {
        assert!(matches!(runtime.read_thread(read_params(view)).await,
            Err(RuntimeCoreError::InvalidRequest(message)) if message.contains("includeTurns")));
    }
    assert!(matches!(runtime.list_thread_turns(ThreadTurnsListParams {
        thread_id: ThreadId::new(THREAD), page: PageCursor::default(), items_view: TurnItemsView::Full,
    }).await, Err(RuntimeCoreError::InvalidRequest(message)) if message.contains("thread/turns/list")));
    assert!(matches!(runtime.list_thread_items(ThreadItemsListParams {
        thread_id: ThreadId::new(THREAD), turn_id: None, page: PageCursor::default(),
    }).await, Err(RuntimeCoreError::InvalidRequest(message)) if message.contains("thread/items/list")));
}

#[tokio::test]
async fn ephemeral_turn_external_appender_and_shutdown_never_write_session_artifacts() {
    let (temp, runtime) = fixture();
    let turn = runtime
        .start_turn(
            AgentSessionTurnStartParams {
                session_id: SESSION.to_string(),
                turn_id: None,
                input: AgentInput {
                    text: "ephemeral input".to_string(),
                    attachments: Vec::new(),
                },
                runtime_options: None,
                queue_if_busy: false,
                skip_pre_submit_resume: false,
            },
            RuntimeHostContext::default(),
        )
        .await
        .unwrap()
        .response
        .turn;
    runtime
        .event_appender()
        .append_external_runtime_events(
            SESSION,
            Some(&turn.turn_id),
            vec![
                RuntimeEvent::new(
                    "file.changed",
                    json!({
                        "path":"memory.md", "artifactId":"memory", "checkpointRef":"before",
                        "change":{"previousContent":"private previous content"}
                    }),
                ),
                RuntimeEvent::new(
                    "artifact.snapshot",
                    json!({
                        "artifactId":"memory", "content":"private artifact content"
                    }),
                ),
                RuntimeEvent::new("workflow.started", json!({"workflowId":"internal"})),
            ],
        )
        .unwrap();
    let large_output = "private output".repeat(1_000);
    let output_events = [false, true].map(|terminal| {
        RuntimeEvent::new(
            if terminal {
                "item.completed"
            } else {
                "item.started"
            },
            json!({"item": {
                "sessionId":SESSION,"threadId":THREAD,"turnId":turn.turn_id,"itemId":"item-large",
                "sequence":1,"ordinal":1,"createdAtMs":1,"updatedAtMs":if terminal {2} else {1},
                "completedAtMs":terminal.then_some(2),"kind":"tool",
                "status":if terminal {"completed"} else {"inProgress"},
                "payload":{"type":"tool","call_id":"large","name":"Read","arguments":[],
                    "output":terminal.then(|| json!({"text":large_output}))},"metadata":{}
            }}),
        )
    });
    runtime
        .append_external_runtime_events(SESSION, Some(&turn.turn_id), output_events.to_vec())
        .unwrap();
    {
        let state = runtime.state.lock().unwrap();
        let outputs = &state.sessions[SESSION].output_blobs;
        assert_eq!(outputs.len(), 1);
        let output = outputs.values().next().unwrap();
        assert_eq!(output.content.as_deref(), Some(large_output.as_str()));
        assert!(output.sidecar_ref.is_none());
        assert!(output.snapshot_file.is_none());
    }
    let context = runtime
        .load_session_current(AgentSessionReadParams {
            session_id: SESSION.to_string(),
            history_limit: None,
            history_offset: None,
            history_before_message_id: None,
        })
        .await
        .unwrap();
    assert!(context
        .stored
        .events
        .iter()
        .any(|event| event.event_type == "artifact.snapshot"));
    assert!(runtime
        .event_log_writer
        .as_ref()
        .unwrap()
        .read_session_events(SESSION)
        .unwrap()
        .is_empty());
    runtime.shutdown().await.unwrap();
    assert!(runtime.loaded_session_id_for_thread(THREAD).is_none());
    assert!(runtime
        .read_thread(read_params(ThreadTurnsView::NotLoaded))
        .await
        .is_err());
    for name in ["events", "traces", "sidecars", "checkpoints", "outputs"] {
        assert!(
            files(&temp.path().join(name)).is_empty(),
            "unexpected {name} persistence"
        );
    }
    let cold = RuntimeCore::with_backend(Arc::new(MockBackend)).with_projection_store(Arc::new(
        ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
    ));
    assert!(cold
        .read_thread(read_params(ThreadTurnsView::NotLoaded))
        .await
        .is_err());
}

#[test]
fn ephemeral_images_keep_validated_provider_data_without_sidecar_writes() {
    let (temp, runtime) = fixture();
    let session = runtime.session_snapshot(SESSION).unwrap().0;
    let input = runtime
        .prepare_session_input(
            &session,
            vec![agent_protocol::AgentInput::Image {
                uri: PNG.to_string(),
                detail: Some(agent_protocol::ImageDetail::High),
            }],
        )
        .unwrap();
    assert_eq!(
        input
            .provider
            .images()
            .next()
            .unwrap()
            .provider_data
            .as_deref(),
        Some(PNG)
    );
    assert!(matches!(&input.durable[0], agent_protocol::AgentInput::Image {uri, ..} if uri == PNG));
    let mut stored = runtime.state.lock().unwrap().sessions[SESSION].clone();
    let event =
        super::super::turn_input_events::runtime_event_for_turn_input(&input.durable).unwrap();
    stored.events.push(AgentEvent {
        event_id: "image-input".to_string(),
        sequence: 1,
        session_id: SESSION.to_string(),
        thread_id: Some(THREAD.to_string()),
        turn_id: Some("earlier-turn".to_string()),
        event_type: event.event_type,
        timestamp: super::super::timestamp(),
        payload: event.payload,
    });
    let history =
        super::super::provider_history::provider_turn_history_excluding_current_turn_input(
            &stored,
            runtime.sidecar_store.as_deref(),
            "next-turn",
        )
        .unwrap();
    assert!(!history.is_empty());
    let local_path = temp.path().join("local.png");
    use base64::Engine;
    std::fs::write(
        &local_path,
        base64::engine::general_purpose::STANDARD
            .decode(PNG.split_once(',').unwrap().1)
            .unwrap(),
    )
    .unwrap();
    let local = runtime
        .prepare_session_input(
            &session,
            vec![agent_protocol::AgentInput::LocalImage {
                path: local_path.to_string_lossy().into_owned(),
                detail: None,
            }],
        )
        .unwrap();
    assert_eq!(
        local
            .provider
            .images()
            .next()
            .unwrap()
            .provider_data
            .as_deref(),
        Some(PNG)
    );
    assert!(files(&temp.path().join("sidecars")).is_empty());
    assert!(runtime
        .prepare_session_input(
            &session,
            vec![agent_protocol::AgentInput::Image {
                uri: "data:image/png;base64,bm90LWltYWdl".to_string(),
                detail: None,
            }]
        )
        .is_err());
}

#[test]
fn ephemeral_compaction_preserves_the_memory_window_without_writing_an_artifact() {
    let (temp, runtime) = fixture();
    let session = runtime.session_snapshot(SESSION).unwrap().0;
    let compacted = super::super::context_compaction::build_session_context_compaction(
        &session,
        &[],
        &[],
        0,
        "ephemeral-compaction",
        "model summary",
        runtime.sidecar_store.as_deref(),
    )
    .unwrap();
    assert_eq!(compacted.summary, "model summary");
    assert!(!compacted.window.replacement_history.is_empty());
    assert!(compacted.sidecar_ref.is_none());
    assert!(files(&temp.path().join("sidecars")).is_empty());
}
