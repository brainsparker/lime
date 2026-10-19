use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use app_server::{
    ActionRespondRequest, AppServer, CancelExecutionRequest, EventLogWriter, ExecutionBackend,
    ExecutionRequest, ProjectionStore, ProviderTurnHistory, RuntimeCore, RuntimeCoreError,
    RuntimeEvent, RuntimeEventSink,
};
use app_server_protocol::protocol::v2::METHOD_THREAD_FORK;
use app_server_protocol::{
    AgentEvent, METHOD_INITIALIZE, METHOD_INITIALIZED, METHOD_THREAD_READ, METHOD_THREAD_RESUME,
    METHOD_THREAD_START, METHOD_TURN_START,
};
use async_trait::async_trait;
use model_provider::current_client::{
    CurrentProviderContent, CurrentProviderMessage, CurrentProviderRole,
};
use serde_json::{json, Value};
use tempfile::TempDir;

#[path = "thread_compaction_boundary_jsonrpc/session_checkpoint.rs"]
mod session_checkpoint;

// This backend controls marker placement to exercise durable boundaries. It does not implement
// or stand in for the production automatic compaction loop.
struct BoundaryBackend {
    event_log: Arc<EventLogWriter>,
    calls: AtomicUsize,
    histories: Mutex<Vec<Vec<CurrentProviderMessage>>>,
    with_suffix: bool,
    conflicting_artifact: bool,
}

#[async_trait]
impl ExecutionBackend for BoundaryBackend {
    async fn start_turn(
        &self,
        request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        self.start_turn_with_provider_history(request, ProviderTurnHistory::default(), sink)
            .await
    }

    async fn start_turn_with_provider_history(
        &self,
        request: ExecutionRequest,
        history: ProviderTurnHistory,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        let call = self.calls.fetch_add(1, Ordering::SeqCst);
        self.histories
            .lock()
            .unwrap()
            .push(history.messages_for_route("fixture-provider", "fixture-model"));
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        if call == 0 {
            emit_answer(sink, "covered", "covered assistant")?;
            let covered =
                wait_for_answer(&self.event_log, &request.session.session_id, "covered").await;
            if self.with_suffix {
                emit_answer(sink, "precommit", "arrived during summary")?;
                wait_for_answer(&self.event_log, &request.session.session_id, "precommit").await;
            }
            let window = uuid::Uuid::now_v7().to_string();
            let lineage = json!({
                "schema": "session_context_compaction.v3",
                "compactionId": "same-turn-checkpoint",
                "coveredThroughSequence": covered,
                "replacementHistory": [{"role": "user", "content": "replacement summary"}],
                "windowNumber": 1,
                "firstWindowId": window,
                "previousWindowId": null,
                "windowId": window,
            });
            let mut payload = lineage.clone();
            payload["artifact"] = lineage;
            if self.conflicting_artifact {
                payload["artifact"]["coveredThroughSequence"] = json!(covered + 1);
            }
            sink.emit(RuntimeEvent::new("context.compaction.completed", payload))?;
            if self.with_suffix {
                emit_answer(sink, "postcommit", "final after commit")?;
            }
        } else {
            emit_answer(sink, &format!("continued-{call}"), "continued answer")?;
        }
        sink.emit(RuntimeEvent::new("turn.completed", json!({})))
    }

    async fn cancel_turn(
        &self,
        _request: CancelExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }

    async fn respond_action(
        &self,
        _request: ActionRespondRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
}

#[tokio::test]
async fn same_turn_boundary_recovers_exact_precommit_and_postcommit_suffix_and_forks() {
    assert_boundary_recovers_and_forks(true).await;
}

#[tokio::test]
async fn fully_covered_prefix_recovers_and_forks_without_a_tail_turn() {
    assert_boundary_recovers_and_forks(false).await;
}

#[tokio::test]
async fn fork_rejects_conflicting_source_marker_before_creating_a_child() {
    let temp = TempDir::new().unwrap();
    let event_log = Arc::new(EventLogWriter::new(temp.path().join("event-log")).unwrap());
    let backend = Arc::new(BoundaryBackend {
        event_log: event_log.clone(),
        calls: AtomicUsize::new(0),
        histories: Mutex::new(Vec::new()),
        with_suffix: false,
        conflicting_artifact: true,
    });
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let runtime = RuntimeCore::with_backend(backend)
        .with_event_log_writer(event_log.clone())
        .with_projection_store(store);
    let server = AppServer::with_runtime(runtime);
    initialize(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "cwd": temp.path(), "modelProvider": "fixture-provider", "model": "fixture-model",
        }),
    )
    .await;
    let thread = required_string(&started, "/result/thread/id");
    let session = required_string(&started, "/result/thread/sessionId");
    start_turn(&server, &thread, "covered input").await;
    wait_for_turns(&server, &thread, 1).await;
    let original = durable_events(&event_log, &session);
    let response = raw_request(&server, 3, METHOD_THREAD_FORK, json!({"threadId": thread})).await;
    assert!(
        response["error"]["message"]
            .as_str()
            .unwrap()
            .contains("coveredThroughSequence"),
        "conflicting source marker must be rejected: {response}"
    );
    let listed = request(
        &server,
        4,
        app_server_protocol::METHOD_THREAD_LIST,
        json!({}),
    )
    .await;
    assert_eq!(listed["result"]["data"].as_array().unwrap().len(), 1);
    assert_eq!(durable_events(&event_log, &session), original);
}

async fn assert_boundary_recovers_and_forks(with_suffix: bool) {
    let temp = TempDir::new().unwrap();
    let event_log = Arc::new(EventLogWriter::new(temp.path().join("event-log")).unwrap());
    let backend = Arc::new(BoundaryBackend {
        event_log: event_log.clone(),
        calls: AtomicUsize::new(0),
        histories: Mutex::new(Vec::new()),
        with_suffix,
        conflicting_artifact: false,
    });
    let runtime = || {
        RuntimeCore::with_backend(backend.clone())
            .with_event_log_writer(event_log.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
            ))
    };
    let source_runtime = runtime();
    let server = AppServer::with_runtime(source_runtime);
    initialize(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "cwd": temp.path(), "modelProvider": "fixture-provider", "model": "fixture-model",
        }),
    )
    .await;
    let thread = required_string(&started, "/result/thread/id");
    let session = required_string(&started, "/result/thread/sessionId");
    start_turn(&server, &thread, "covered user input").await;
    let read = wait_for_turns(&server, &thread, 1).await;
    let item = compaction_item(&read);
    let original = durable_events(&event_log, &session);
    let marker = original
        .iter()
        .find(|event| event.event_type == "context.compaction.completed")
        .expect("checkpoint persisted in the original Turn");
    let covered = marker.payload["coveredThroughSequence"].as_u64().unwrap();
    let original_turn = required_string(&read, "/result/thread/turns/0/id");
    assert_eq!(marker.turn_id.as_deref(), Some(original_turn.as_str()));
    assert!(covered < marker.sequence);
    if with_suffix {
        let precommit = original
            .iter()
            .find(|event| {
                event.event_type == "item.completed" && event.payload["itemId"] == "precommit"
            })
            .unwrap();
        assert!(covered < precommit.sequence && precommit.sequence < marker.sequence);
    }
    drop(server);

    let resumed_runtime = runtime();
    let resumed = AppServer::with_runtime(resumed_runtime);
    initialize(&resumed).await;
    request(
        &resumed,
        3,
        METHOD_THREAD_RESUME,
        json!({"threadId": thread}),
    )
    .await;
    assert_eq!(
        durable_events(&event_log, &session),
        original,
        "cold hydration must not rewrite or duplicate the original rollout"
    );
    let forked = request(&resumed, 4, METHOD_THREAD_FORK, json!({"threadId": thread})).await;
    let child_thread = required_string(&forked, "/result/thread/id");
    let child_session = required_string(&forked, "/result/thread/sessionId");
    assert_eq!(compaction_item(&forked), item);
    assert_eq!(durable_events(&event_log, &session), original);
    let child_before_restart = durable_events(&event_log, &child_session);
    drop(resumed);

    let cold_runtime = runtime();
    let cold = AppServer::with_runtime(cold_runtime);
    initialize(&cold).await;
    for thread_id in [&thread, &child_thread] {
        request(
            &cold,
            5,
            METHOD_THREAD_RESUME,
            json!({"threadId": thread_id}),
        )
        .await;
        let read = request(
            &cold,
            6,
            METHOD_THREAD_READ,
            json!({"threadId": thread_id, "includeTurns": true}),
        )
        .await;
        assert_eq!(compaction_item(&read), item);
    }
    assert_eq!(durable_events(&event_log, &session), original);
    assert_eq!(
        durable_events(&event_log, &child_session),
        child_before_restart
    );
    for thread_id in [&thread, &child_thread] {
        start_turn(&cold, thread_id, "next input").await;
        wait_for_turns(&cold, thread_id, 2).await;
    }
    let mut expected = vec![text_message(
        CurrentProviderRole::User,
        "replacement summary",
    )];
    if with_suffix {
        expected.push(CurrentProviderMessage {
            producer: None,
            role: CurrentProviderRole::Assistant,
            content: vec![
                CurrentProviderContent::Text("arrived during summary".to_string()),
                CurrentProviderContent::Text("final after commit".to_string()),
            ],
        });
    }
    let histories = backend.histories.lock().unwrap();
    assert_eq!(histories.len(), 3);
    assert!(histories[0].is_empty());
    assert_eq!(histories[1], expected, "cold source transcript");
    assert_eq!(histories[2], expected, "cold fork transcript");
    assert!(durable_events(&event_log, &session).starts_with(&original));
    assert!(durable_events(&event_log, &child_session).starts_with(&child_before_restart));
}

fn emit_answer(
    sink: &mut dyn RuntimeEventSink,
    id: &str,
    text: &str,
) -> Result<(), RuntimeCoreError> {
    let payload =
        json!({"itemId": id, "text": text, "phase": "final_answer", "status": "completed"});
    sink.emit(RuntimeEvent::new("message.delta", payload.clone()))?;
    sink.emit(RuntimeEvent::new("message.completed", payload))
}

async fn wait_for_answer(log: &EventLogWriter, session: &str, item: &str) -> u64 {
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            if let Some(sequence) = log
                .read_session_events(session)
                .unwrap()
                .iter()
                .find(|record| {
                    record.event.event_type == "item.completed"
                        && record.event.payload["itemId"] == item
                })
                .map(|record| record.event.sequence)
            {
                return sequence;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("answer must reach the real durable log")
}

fn text_message(role: CurrentProviderRole, text: &str) -> CurrentProviderMessage {
    CurrentProviderMessage {
        producer: None,
        role,
        content: vec![CurrentProviderContent::Text(text.to_string())],
    }
}

fn compaction_item(response: &Value) -> Value {
    let item = response
        .pointer("/result/thread/turns")
        .and_then(Value::as_array)
        .unwrap()
        .iter()
        .flat_map(|turn| turn["items"].as_array().unwrap())
        .find(|item| item["type"] == "contextCompaction")
        .expect("public compaction Item");
    assert_eq!(
        item.as_object().unwrap().len(),
        2,
        "private lineage must remain private"
    );
    assert!(item["id"].is_string());
    item.clone()
}

async fn start_turn(server: &AppServer, thread: &str, input: &str) {
    request(
        server,
        10,
        METHOD_TURN_START,
        json!({
            "threadId": thread, "input": [{"type": "text", "text": input}],
            "model": "fixture-model", "approvalPolicy": "never", "sandboxPolicy": "workspace-write",
        }),
    )
    .await;
}

async fn wait_for_turns(server: &AppServer, thread: &str, count: usize) -> Value {
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let read = request(
                server,
                20,
                METHOD_THREAD_READ,
                json!({"threadId": thread, "includeTurns": true}),
            )
            .await;
            let turns = read
                .pointer("/result/thread/turns")
                .and_then(Value::as_array)
                .unwrap();
            if turns.len() == count && turns.iter().all(|turn| turn["status"] == "completed") {
                return read;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("all Turns must complete")
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        METHOD_INITIALIZE,
        json!({
            "clientInfo": {"name": "compaction-boundary-test", "version": "1.0.0"},
        }),
    )
    .await;
    let notifications = server
        .handle_json_line(
            &json!({
                "jsonrpc": "2.0", "method": METHOD_INITIALIZED, "params": {},
            })
            .to_string(),
        )
        .await
        .unwrap();
    assert!(notifications.is_empty());
}

async fn request(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let response = raw_request(server, id, method, params).await;
    assert!(response.get("error").is_none(), "{method}: {response}");
    response
}

async fn raw_request(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let messages = server
        .handle_json_line(
            &json!({
                "jsonrpc": "2.0", "id": id, "method": method, "params": params,
            })
            .to_string(),
        )
        .await
        .unwrap();
    let response = messages
        .iter()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .find(|message| message["id"] == id)
        .unwrap_or_else(|| panic!("missing {method}: {messages:?}"));
    response
}

fn required_string(value: &Value, pointer: &str) -> String {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("missing {pointer}: {value}"))
        .to_string()
}

fn durable_events(log: &EventLogWriter, session: &str) -> Vec<AgentEvent> {
    log.read_session_events(session)
        .expect("read real durable EventLog")
        .into_iter()
        .map(|record| record.event)
        .collect()
}
