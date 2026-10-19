use agent_runtime::session_loop::RuntimeSessionInputHandle;
use app_server::{
    ActionRespondRequest, AppServer, CancelExecutionRequest, EventLogWriter, ExecutionBackend,
    ExecutionRequest, ProjectionStore, ProviderTurnHistory, RuntimeCore, RuntimeCoreError,
    RuntimeEvent, RuntimeEventSink,
};
use async_trait::async_trait;
use model_provider::current_client::{CurrentProviderContent, CurrentProviderMessage};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

struct InputBackend {
    started: mpsc::UnboundedSender<(RuntimeSessionInputHandle, Vec<CurrentProviderMessage>)>,
}

#[async_trait]
impl ExecutionBackend for InputBackend {
    async fn start_turn(
        &self,
        _: ExecutionRequest,
        _: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        panic!("fixture requires the current session input boundary")
    }

    async fn start_turn_with_provider_history_and_session_input(
        &self,
        _: ExecutionRequest,
        history: ProviderTurnHistory,
        input: Option<RuntimeSessionInputHandle>,
        cancellation: Option<CancellationToken>,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        sink.emit(RuntimeEvent::new("turn.started", json!({})))?;
        self.started
            .send((
                input.expect("session input"),
                history.messages_for_route("fixture", "model"),
            ))
            .unwrap();
        cancellation.expect("task cancellation").cancelled().await;
        Ok(())
    }

    async fn cancel_turn(
        &self,
        _: CancelExecutionRequest,
        _: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
    async fn respond_action(
        &self,
        _: ActionRespondRequest,
        _: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
}

#[tokio::test]
async fn public_steer_rejects_failed_commit_and_restores_each_accepted_input_after_restart() {
    let temp = tempfile::tempdir().unwrap();
    let log_root = temp.path().join("event-log");
    let writer = Arc::new(EventLogWriter::new(&log_root).unwrap());
    let (started, mut receiver) = mpsc::unbounded_channel();
    let backend = Arc::new(InputBackend { started });
    let runtime = || {
        RuntimeCore::with_backend(backend.clone())
            .with_event_log_writer(writer.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
            ))
    };
    let server = AppServer::with_runtime(runtime());
    initialize(&server).await;
    let thread = ok(
        &server,
        2,
        "thread/start",
        json!({"cwd":temp.path(), "modelProvider":"fixture", "model":"model"}),
    )
    .await;
    let thread_id = thread["result"]["thread"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let session_id = thread["result"]["thread"]["sessionId"]
        .as_str()
        .unwrap()
        .to_string();
    let turn = ok(
        &server,
        3,
        "turn/start",
        json!({"threadId":thread_id,"input":[{"type":"text","text":"initial"}]}),
    )
    .await;
    let turn_id = turn["result"]["turn"]["id"].as_str().unwrap().to_string();
    let (input, _) = tokio::time::timeout(Duration::from_secs(3), receiver.recv())
        .await
        .unwrap()
        .unwrap();
    let original = writer.read_session_events(&session_id).unwrap();
    let steer = |target: &str, client: &str| json!({"threadId":thread_id,"expectedTurnId":target,"input":[{"type":"text","text":"equal text"}],"clientUserMessageId":client});
    let wrong = call(&server, 4, "turn/steer", steer("wrong-turn", "rejected")).await;
    assert!(wrong.get("error").is_some(), "{wrong}");
    assert!(!input.has_pending_input(false).await);
    assert_eq!(writer.read_session_events(&session_id).unwrap(), original);

    let sessions = log_root.join("sessions");
    let saved = temp.path().join("saved-sessions");
    std::fs::rename(&sessions, &saved).unwrap();
    std::fs::write(&sessions, "block append").unwrap();
    let rejected = call(&server, 5, "turn/steer", steer(&turn_id, "failed-client")).await;
    std::fs::rename(&sessions, temp.path().join("blocked-sessions")).unwrap();
    std::fs::rename(&saved, &sessions).unwrap();
    assert!(rejected.get("error").is_some(), "{rejected}");
    assert!(
        !input.has_pending_input(false).await,
        "failed RPC must not expose input to the model loop"
    );
    assert_eq!(writer.read_session_events(&session_id).unwrap(), original);

    for (id, client) in [(6, "first-client"), (7, "second-client")] {
        let accepted = ok(&server, id, "turn/steer", steer(&turn_id, client)).await;
        assert_eq!(accepted["result"]["turnId"], turn_id);
    }
    let pending = input.try_take_pending_input(false).await.unwrap();
    assert_eq!(
        pending.len(),
        2,
        "equal text from two accepted inputs must not be deduplicated"
    );
    for message in pending {
        let agent_runtime::session_loop::RuntimeSessionInput::User(message) = message else {
            panic!("expected user input")
        };
        assert_eq!(message.concat_text(), "equal text");
    }
    let events = writer.read_session_events(&session_id).unwrap();
    let accepted = events
        .iter()
        .filter(|record| {
            record.event.event_type == "message.created"
                && record.event.payload["source"] == "turn/steer"
        })
        .collect::<Vec<_>>();
    assert_eq!(accepted.len(), 2);
    for (record, client) in accepted.iter().zip(["first-client", "second-client"]) {
        assert_eq!(record.event.turn_id.as_deref(), Some(turn_id.as_str()));
        assert_eq!(record.event.payload["clientId"], client);
    }
    let visible = ok(
        &server,
        8,
        "thread/read",
        json!({"threadId":thread_id,"includeTurns":true}),
    )
    .await;
    let visible = visible["result"]["thread"]["turns"][0]["items"]
        .as_array()
        .unwrap();
    for client in ["first-client", "second-client"] {
        assert!(
            visible.iter().any(|item| item["clientId"] == client
                && item["type"] == "userMessage"
                && item["content"] == json!([{"type":"text","text":"equal text"}])
                && item["id"].as_str().is_some_and(|id| !id.is_empty())),
            "canonical input Item missing: {visible:?}"
        );
    }
    ok(
        &server,
        9,
        "turn/interrupt",
        json!({"threadId":thread_id,"turnId":turn_id}),
    )
    .await;
    let durable = writer.read_session_events(&session_id).unwrap();
    drop(input);
    drop(server);

    let cold = AppServer::with_runtime(runtime());
    initialize(&cold).await;
    ok(&cold, 10, "thread/resume", json!({"threadId":thread_id})).await;
    assert_eq!(
        writer.read_session_events(&session_id).unwrap(),
        durable,
        "cold recovery must not rewrite accepted input history"
    );
    let next = ok(
        &cold,
        11,
        "turn/start",
        json!({"threadId":thread_id,"input":[{"type":"text","text":"next"}]}),
    )
    .await;
    let (_, history) = tokio::time::timeout(Duration::from_secs(3), receiver.recv())
        .await
        .unwrap()
        .unwrap();
    let text = history
        .iter()
        .flat_map(|message| &message.content)
        .filter_map(|content| match content {
            CurrentProviderContent::Text(text) => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>();
    assert_eq!(
        text,
        vec!["initial", "equal text", "equal text"],
        "cold provider history must keep each accepted input exactly once"
    );
    ok(
        &cold,
        12,
        "turn/interrupt",
        json!({"threadId":thread_id,"turnId":next["result"]["turn"]["id"]}),
    )
    .await;
}

async fn initialize(server: &AppServer) {
    ok(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"input-admission-test","version":"1"}}),
    )
    .await;
    server
        .handle_json_line(&json!({"jsonrpc":"2.0","method":"initialized","params":{}}).to_string())
        .await
        .unwrap();
}

async fn ok(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let result = call(server, id, method, params).await;
    assert!(result.get("error").is_none(), "{method}: {result}");
    result
}

async fn call(server: &AppServer, id: u64, method: &str, params: Value) -> Value {
    let messages = server
        .handle_json_line(
            &json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}).to_string(),
        )
        .await
        .unwrap();
    messages
        .iter()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .find(|value| value["id"] == id)
        .unwrap_or_else(|| panic!("missing {method}: {messages:?}"))
}
