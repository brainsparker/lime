use crate::runtime::projection_store::ProjectionReadWindow;
use crate::runtime::turn_start::TurnStartRequest;
use crate::runtime::{
    EventLogWriter, MockBackend, ProjectionStore, RuntimeCore, RuntimeHostContext, SidecarStore,
    StorageRoots,
};
use crate::AppServer;
use agent_protocol::{AgentInput, ImageDetail, ThreadId, ThreadItemPayload, ThreadTurnsView};
use app_server_protocol::protocol::v2::{
    METHOD_THREAD_QUEUE_LIST, METHOD_THREAD_QUEUE_START, METHOD_THREAD_SEARCH,
    METHOD_THREAD_SEARCH_OCCURRENCES,
};
use app_server_protocol::{
    AgentSessionStartParams, AgentSessionTurnCancelParams, AgentTurnStatus, BusinessObjectRef,
    METHOD_INITIALIZE, METHOD_INITIALIZED, METHOD_THREAD_ITEMS_LIST, METHOD_THREAD_READ,
    METHOD_THREAD_RESUME, METHOD_THREAD_TURNS_LIST,
};
use serde_json::{json, Value};
use std::sync::Arc;
use thread_store::{ReadThreadParams, ThreadStore};

const SESSION_ID: &str = "queue-rollout-rebuild";
const THREAD_ID: &str = "cd678d01-1401-4bf0-a9d7-9604466a0804";
const PNG_BASE64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M/wHwAEAQH/cetH5QAAAABJRU5ErkJggg==";

fn open_store(roots: &StorageRoots, label: &str, split: bool) -> ProjectionStore {
    let database_root = roots.runtime_root.join(label);
    if split {
        ProjectionStore::initialize_with_storage_paths(
            database_root.join("projection.sqlite"),
            database_root.join("state.sqlite"),
            database_root.join("history.sqlite"),
            &roots.data_root,
        )
        .unwrap()
    } else {
        ProjectionStore::initialize_with_agent_root(
            database_root.join("single.sqlite"),
            &roots.data_root,
        )
        .unwrap()
    }
}

fn open_core(roots: &StorageRoots, store: Arc<ProjectionStore>) -> RuntimeCore {
    RuntimeCore::with_backend(Arc::new(MockBackend))
        .with_event_log_writer(Arc::new(
            EventLogWriter::new(&roots.event_log_root).unwrap(),
        ))
        .with_projection_store(store)
        .with_sidecar_store(Arc::new(SidecarStore::new(&roots.sidecar_root).unwrap()))
}

fn start_session(core: &RuntimeCore) {
    core.start_session(AgentSessionStartParams {
        session_id: Some(SESSION_ID.to_string()),
        thread_id: Some(THREAD_ID.to_string()),
        app_id: "agent-chat".to_string(),
        workspace_id: None,
        business_object_ref: Some(BusinessObjectRef {
            kind: "agent.thread".to_string(),
            id: THREAD_ID.to_string(),
            title: None,
            uri: None,
            metadata: Some(
                json!({"modelName": "fixture-model", "modelProvider": "fixture-provider"}),
            ),
        }),
        locale: None,
    })
    .unwrap();
}

async fn rpc(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let lines = server
        .handle_json_line(
            &json!({
                "jsonrpc": "2.0", "id": id, "method": method, "params": params,
            })
            .to_string(),
        )
        .await
        .unwrap();
    let response = lines
        .iter()
        .map(|line| serde_json::from_str::<Value>(line).unwrap())
        .find(|value| value["id"] == id)
        .expect("RPC response");
    assert!(response.get("error").is_none(), "{method}: {response}");
    response["result"].clone()
}

async fn initialize(server: &AppServer) {
    rpc(
        server,
        1,
        METHOD_INITIALIZE,
        json!({
            "clientInfo": {"name": "queue-rollout-rebuild", "version": "test"},
            "capabilities": {"experimentalApi": true},
        }),
    )
    .await;
    server
        .handle_json_line(&json!({"jsonrpc": "2.0", "method": METHOD_INITIALIZED}).to_string())
        .await
        .unwrap();
}

async fn assert_public_pending_excluded(server: &AppServer, executed_count: usize) {
    let read = rpc(
        server,
        2,
        METHOD_THREAD_READ,
        json!({"threadId": THREAD_ID, "includeTurns": true}),
    )
    .await;
    assert_eq!(
        read["thread"]["turns"].as_array().unwrap().len(),
        executed_count
    );
    assert!(!read.to_string().contains("pending-rollout-only"));
    let turns = rpc(
        server,
        3,
        METHOD_THREAD_TURNS_LIST,
        json!({"threadId": THREAD_ID, "limit": 1, "itemsView": "full"}),
    )
    .await;
    assert_eq!(turns["data"].as_array().unwrap().len(), executed_count);
    assert_eq!(turns["nextCursor"], Value::Null);
    let items = rpc(
        server,
        4,
        METHOD_THREAD_ITEMS_LIST,
        json!({"threadId": THREAD_ID}),
    )
    .await;
    assert!(!items.to_string().contains("pending-rollout-only"));
    let search = rpc(
        server,
        5,
        METHOD_THREAD_SEARCH,
        json!({"searchTerm": "pending-rollout-only", "sourceKinds": ["appServer"]}),
    )
    .await;
    assert_eq!(search["data"], json!([]));
    let occurrences = rpc(
        server,
        6,
        METHOD_THREAD_SEARCH_OCCURRENCES,
        json!({"threadId": THREAD_ID, "searchTerm": "pending-rollout-only"}),
    )
    .await;
    assert_eq!(occurrences, json!({"data": [], "nextCursor": null}));
}

#[tokio::test]
async fn real_rollout_rebuild_preserves_pending_queue_after_cold_hydration() {
    for split in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let roots = StorageRoots::initialize(temp.path(), temp.path().join("agent-root")).unwrap();
        let source = Arc::new(open_store(&roots, "source", split));
        let core = open_core(&roots, source.clone());
        start_session(&core);
        let queued = core
            .add_thread_queue_submission(
                THREAD_ID,
                vec![
                    AgentInput::text(format!("pending-rollout-only {}", "完整输入".repeat(200))),
                    AgentInput::Image {
                        uri: format!("data:image/png;base64,{PNG_BASE64}"),
                        detail: Some(ImageDetail::Original),
                    },
                ],
                "stable-client".to_string(),
            )
            .await
            .unwrap();
        let raw_before = source
            .read_thread(ReadThreadParams {
                thread_id: ThreadId::new(THREAD_ID),
                include_archived: true,
                turns_view: ThreadTurnsView::Full,
            })
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            core.list_thread_queue_submissions(THREAD_ID)
                .await
                .unwrap()
                .len(),
            1
        );
        drop(core);
        drop(source);

        assert!(!roots.runtime_root.join("rebuilt").exists());
        let rebuilt = Arc::new(open_store(&roots, "rebuilt", split));
        let raw_after = rebuilt
            .read_thread(ReadThreadParams {
                thread_id: ThreadId::new(THREAD_ID),
                include_archived: true,
                turns_view: ThreadTurnsView::Full,
            })
            .await
            .unwrap()
            .unwrap();
        assert_eq!(raw_after, raw_before);
        let projection = rebuilt
            .read_session_projection(SESSION_ID, ProjectionReadWindow::default())
            .unwrap()
            .unwrap();
        assert_eq!(projection.turns[0].status, AgentTurnStatus::Queued);
        let canonical_item = &raw_after.turns[0].items[0];
        let summary = rebuilt
            .read_item_summary_for_test(&format!("canonical:{}", canonical_item.item_id))
            .unwrap()
            .unwrap();
        let summary: Value = serde_json::from_str(&summary).unwrap();
        assert_eq!(
            summary["canonical"]["itemId"],
            canonical_item.item_id.as_str()
        );
        assert_eq!(summary["clientId"], "stable-client");
        assert_eq!(
            summary["input"],
            serde_json::to_value(&queued.input).unwrap()
        );
        assert!(summary["text"].as_str().unwrap().len() < 1000);
        let expected_watermark = rebuilt
            .read_watermark(SESSION_ID)
            .unwrap()
            .unwrap()
            .last_sequence;
        let cold = open_core(&roots, rebuilt.clone());
        let recovered = cold.list_thread_queue_submissions(THREAD_ID).await.unwrap();
        println!(
            "split={split} reconstructed_status={:?} queue_count={} expected_id={}",
            projection.turns[0].status,
            recovered.len(),
            queued.id
        );
        assert_eq!(
            recovered.len(),
            1,
            "pending queue must survive a real rollout rebuild"
        );
        assert_eq!(recovered[0].id, queued.id);
        assert_eq!(recovered[0].input, queued.input);
        assert_eq!(
            recovered[0].client_user_message_id,
            queued.client_user_message_id
        );
        assert_eq!(
            rebuilt
                .read_watermark(SESSION_ID)
                .unwrap()
                .unwrap()
                .last_sequence,
            expected_watermark
        );
        let server = AppServer::with_runtime(cold);
        initialize(&server).await;
        assert_public_pending_excluded(&server, 0).await;
        let queue = rpc(
            &server,
            7,
            METHOD_THREAD_QUEUE_LIST,
            json!({"threadId": THREAD_ID}),
        )
        .await;
        assert_eq!(queue["data"][0]["id"], queued.id);
    }
}

#[tokio::test]
async fn mixed_rollout_rebuild_preserves_interrupted_history_and_admits_same_pending_item() {
    for split in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let roots = StorageRoots::initialize(temp.path(), temp.path().join("agent-root")).unwrap();
        let source = Arc::new(open_store(&roots, "source", split));
        let core = open_core(&roots, source.clone());
        start_session(&core);
        core.start_turn(
            TurnStartRequest {
                session_id: SESSION_ID.to_string(),
                turn_id: Some("executed-turn".to_string()),
                input: vec![AgentInput::text("executed-baseline")],
                runtime_options: None,
                queue_if_busy: false,
                skip_pre_submit_resume: false,
            },
            RuntimeHostContext::default(),
        )
        .await
        .unwrap();
        core.cancel_turn(
            AgentSessionTurnCancelParams {
                session_id: SESSION_ID.to_string(),
                turn_id: "executed-turn".to_string(),
            },
            RuntimeHostContext::default(),
        )
        .await
        .unwrap();
        let queued = core
            .add_thread_queue_submission(
                THREAD_ID,
                vec![
                    AgentInput::text("pending-rollout-only"),
                    AgentInput::Image {
                        uri: format!("data:image/png;base64,{PNG_BASE64}"),
                        detail: Some(ImageDetail::Original),
                    },
                ],
                "mixed-stable-client".to_string(),
            )
            .await
            .unwrap();
        let before = source
            .read_thread(ReadThreadParams {
                thread_id: ThreadId::new(THREAD_ID),
                include_archived: true,
                turns_view: ThreadTurnsView::Full,
            })
            .await
            .unwrap()
            .unwrap();
        let pending_item = before
            .turns
            .iter()
            .find(|turn| turn.turn_id.as_str() == queued.id)
            .unwrap()
            .items[0]
            .clone();
        drop(core);
        drop(source);
        let rebuilt = Arc::new(open_store(&roots, "rebuilt", split));
        let projection = rebuilt
            .read_session_projection(SESSION_ID, ProjectionReadWindow::default())
            .unwrap()
            .unwrap();
        assert_eq!(
            projection
                .turns
                .iter()
                .map(|turn| turn.status)
                .collect::<Vec<_>>(),
            vec![AgentTurnStatus::Canceled, AgentTurnStatus::Queued]
        );
        let cold = open_core(&roots, rebuilt.clone());
        let server = AppServer::with_runtime(cold.clone());
        initialize(&server).await;
        assert_public_pending_excluded(&server, 1).await;
        let resume = rpc(
            &server,
            7,
            METHOD_THREAD_RESUME,
            json!({"threadId": THREAD_ID}),
        )
        .await;
        assert_eq!(resume["thread"]["turns"].as_array().unwrap().len(), 1);
        assert_eq!(resume["thread"]["status"]["type"], "idle");
        let queue = rpc(
            &server,
            8,
            METHOD_THREAD_QUEUE_LIST,
            json!({"threadId": THREAD_ID}),
        )
        .await;
        assert_eq!(queue["data"].as_array().unwrap().len(), 1);
        assert_eq!(
            queue["data"][0]["clientUserMessageId"],
            "mixed-stable-client"
        );
        let AgentInput::Image { uri, .. } = &queued.input[1] else {
            panic!("queued image missing")
        };
        let media = rpc(
            &server,
            9,
            "media/read",
            json!({"threadId": THREAD_ID, "uri": uri}),
        )
        .await;
        assert_eq!(media["contentBase64"], PNG_BASE64);
        let started = rpc(
            &server,
            10,
            METHOD_THREAD_QUEUE_START,
            json!({"threadId": THREAD_ID, "queuedSubmissionId": queued.id}),
        )
        .await;
        assert_eq!(started["turn"]["id"], queued.id);
        let read = rpc(
            &server,
            11,
            METHOD_THREAD_READ,
            json!({"threadId": THREAD_ID, "includeTurns": true}),
        )
        .await;
        assert_eq!(read["thread"]["turns"].as_array().unwrap().len(), 2);
        let raw = rebuilt
            .read_thread(ReadThreadParams {
                thread_id: ThreadId::new(THREAD_ID),
                include_archived: true,
                turns_view: ThreadTurnsView::Full,
            })
            .await
            .unwrap()
            .unwrap();
        let admitted = raw
            .turns
            .iter()
            .find(|turn| turn.turn_id.as_str() == queued.id)
            .unwrap();
        let users = admitted
            .items
            .iter()
            .filter(|item| matches!(item.payload, ThreadItemPayload::UserMessage { .. }))
            .collect::<Vec<_>>();
        assert_eq!(users.len(), 1);
        assert_eq!(users[0].item_id, pending_item.item_id);
        assert_eq!(users[0].payload, pending_item.payload);
        let search = rpc(
            &server,
            12,
            METHOD_THREAD_SEARCH,
            json!({"searchTerm": "pending-rollout-only", "sourceKinds": ["appServer"]}),
        )
        .await;
        assert_eq!(search["data"].as_array().unwrap().len(), 1);
        let occurrences = rpc(
            &server,
            13,
            METHOD_THREAD_SEARCH_OCCURRENCES,
            json!({"threadId": THREAD_ID, "searchTerm": "pending-rollout-only"}),
        )
        .await;
        assert_eq!(
            occurrences["data"][0]["itemId"],
            pending_item.item_id.as_str()
        );
        assert_eq!(occurrences["data"][0]["turnId"], queued.id);
        let media = rpc(
            &server,
            14,
            "media/read",
            json!({"threadId": THREAD_ID, "uri": uri}),
        )
        .await;
        assert_eq!(media["contentBase64"], PNG_BASE64);
        cold.shutdown().await.unwrap();
    }
}
