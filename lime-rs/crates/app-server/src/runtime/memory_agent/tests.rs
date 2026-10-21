use super::*;
use crate::{
    ActionRespondRequest, CancelExecutionRequest, ExecutionBackend, ExecutionRequest,
    RuntimeEventSink,
};
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

struct Backend {
    requests: Mutex<Vec<ExecutionRequest>>,
    closed: Mutex<Vec<String>>,
    fail_close: bool,
    hold: std::sync::atomic::AtomicBool,
    started: tokio::sync::Notify,
    closed_changed: tokio::sync::Notify,
}

#[async_trait]
impl ExecutionBackend for Backend {
    async fn start_turn(
        &self,
        request: ExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        self.requests.lock().unwrap().push(request.clone());
        self.started.notify_one();
        if self.hold.load(std::sync::atomic::Ordering::Relaxed) {
            std::future::pending::<()>().await;
        }
        super::super::backend::MockBackend
            .start_turn(request, sink)
            .await?;
        sink.emit(crate::RuntimeEvent::new(
            "turn.completed",
            json!({ "backend": "recording-test" }),
        ))
    }
    async fn cancel_turn(
        &self,
        request: CancelExecutionRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        super::super::backend::MockBackend
            .cancel_turn(request, sink)
            .await
    }
    async fn respond_action(
        &self,
        request: ActionRespondRequest,
        sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        super::super::backend::MockBackend
            .respond_action(request, sink)
            .await
    }
    async fn close_session(&self, session_id: &str, _: &str) -> Result<(), RuntimeCoreError> {
        self.closed.lock().unwrap().push(session_id.to_string());
        self.closed_changed.notify_one();
        if self.fail_close {
            Err(RuntimeCoreError::Backend("close failed".into()))
        } else {
            Ok(())
        }
    }
}

fn fixture(
    policy: serde_json::Value,
    fail_close: bool,
) -> (
    tempfile::TempDir,
    RuntimeCore,
    Arc<Backend>,
    MemoryAgentRequest,
) {
    let temp = tempfile::tempdir().unwrap();
    let backend = Arc::new(Backend {
        requests: Default::default(),
        closed: Default::default(),
        fail_close,
        hold: Default::default(),
        started: Default::default(),
        closed_changed: Default::default(),
    });
    let runtime = RuntimeCore::with_backend(backend.clone());
    let parent = runtime.start_session(AgentSessionStartParams {
        session_id: None, thread_id: None, app_id: "test".into(), workspace_id: None, locale: None,
        business_object_ref: Some(BusinessObjectRef {
            kind: "thread".into(), id: "parent".into(), title: None, uri: None,
            metadata: Some(json!({ "sandboxPolicy": policy, "workingDir": "/parent-project", "runtimeWorkspaceRoots": ["/parent-project", "/another-project"] })),
        }),
    }).unwrap().session;
    let request = MemoryAgentRequest {
        cancellation: CancellationToken::new(),
        root: temp.path().to_path_buf(),
        prompt: "Consolidate memory".into(),
        route: crate::MemoryStageOneRoute {
            session_id: parent.session_id,
            thread_id: parent.thread_id,
            provider: "multimodel-provider".into(),
            model: "selected-model".into(),
            reasoning_effort: None,
            service_tier: None,
            api_version: None,
            route_protocol: ProtocolKind::AnthropicMessages,
            credential_ref: Some("credential-owner".into()),
            cwd: Some("/parent-project".into()),
        },
    };
    (temp, runtime, backend, request)
}

#[tokio::test]
async fn memory_uses_same_core_and_actor_with_trusted_ephemeral_root_policy() {
    let (temp, runtime, backend, request) = fixture(json!("workspace-write"), false);
    let caller_cancellation = request.cancellation.clone();
    runtime.run(request).await.unwrap();
    assert!(
        !caller_cancellation.is_cancelled(),
        "successful Agent shutdown must not cancel the caller's lease token"
    );
    let requests = backend.requests.lock().unwrap();
    assert_eq!(requests.len(), 1);
    let request = &requests[0];
    let policy = request.internal_agent_policy.as_ref().unwrap();
    assert_eq!(policy.root(), temp.path().canonicalize().unwrap());
    match policy.sandbox() {
        app_server_protocol::protocol::v2::SandboxPolicy::WorkspaceWrite {
            writable_roots,
            network_access,
            exclude_tmpdir_env_var,
            exclude_slash_tmp,
        } => {
            assert_eq!(writable_roots.len(), 1);
            assert_eq!(writable_roots[0].as_ref(), policy.root());
            assert!(!network_access);
            assert!(*exclude_tmpdir_env_var && *exclude_slash_tmp);
        }
        other => panic!("unexpected policy {other:?}"),
    }
    let options = request.runtime_request().unwrap();
    assert_eq!(
        options.provider_preference.as_deref(),
        Some("multimodel-provider")
    );
    assert_eq!(options.model_preference.as_deref(), Some("selected-model"));
    assert_eq!(
        options.workspace_root.as_deref(),
        options.working_dir.as_deref()
    );
    assert_eq!(
        options.project_root.as_deref(),
        options.working_dir.as_deref()
    );
    assert_eq!(options.approval_policy.as_deref(), Some("never"));
    assert!(super::super::session_is_ephemeral(&request.session));
    assert_eq!(
        *backend.closed.lock().unwrap(),
        vec![request.session.session_id.clone()]
    );
    let state = runtime.state.lock().unwrap();
    assert_eq!(
        state.sessions.len(),
        1,
        "only the parent remains in the same core"
    );
    assert!(state.internal_agents.is_empty());
}

#[tokio::test]
async fn explicit_unmanaged_parent_policy_is_preserved() {
    use app_server_protocol::protocol::v2::{NetworkAccess, SandboxPolicy};
    for policy in [
        SandboxPolicy::DangerFullAccess,
        SandboxPolicy::ExternalSandbox {
            network_access: NetworkAccess::Restricted,
        },
    ] {
        let (_temp, runtime, backend, request) =
            fixture(serde_json::to_value(&policy).unwrap(), false);
        runtime.run(request).await.unwrap();
        assert_eq!(
            backend.requests.lock().unwrap()[0]
                .internal_agent_policy
                .as_ref()
                .unwrap()
                .sandbox(),
            &policy
        );
    }
}

#[tokio::test]
async fn failed_shutdown_retains_internal_session_authority_and_reports_failure() {
    let (_temp, runtime, backend, request) = fixture(json!("workspace-write"), true);
    let error = runtime.run(request).await.unwrap_err();
    assert!(!error.shutdown_complete);
    let id = backend.requests.lock().unwrap()[0]
        .session
        .session_id
        .clone();
    let state = runtime.state.lock().unwrap();
    assert!(state.sessions.contains_key(&id));
    assert!(state.internal_agents.contains_key(&id));
}

#[tokio::test]
async fn caller_lease_loss_cancels_and_shuts_down_internal_agent() {
    let (_temp, runtime, backend, request) = fixture(json!("workspace-write"), false);
    backend
        .hold
        .store(true, std::sync::atomic::Ordering::Relaxed);
    let cancellation = request.cancellation.clone();
    let mut execution = Box::pin(runtime.run(request));
    tokio::select! {
        result = &mut execution => panic!("Agent ended before lease loss: {result:?}"),
        _ = backend.started.notified() => {}
    }
    cancellation.cancel();
    let error = execution.await.expect_err("lease loss must stop the Agent");
    assert!(error.shutdown_complete);
    assert!(matches!(error.cause, RuntimeCoreError::RequestCanceled));
    let state = runtime.state.lock().unwrap();
    assert_eq!(state.sessions.len(), 1);
    assert!(state.internal_agents.is_empty());
    assert_eq!(backend.closed.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn dropping_storage_future_cancels_and_shuts_down_owned_runtime_agent() {
    let (_temp, runtime, backend, request) = fixture(json!("workspace-write"), false);
    backend
        .hold
        .store(true, std::sync::atomic::Ordering::Relaxed);
    let mut execution = Box::pin(runtime.run(request));
    tokio::select! {
        result = &mut execution => panic!("Agent ended before cancellation: {result:?}"),
        _ = backend.started.notified() => {}
    }
    drop(execution);
    tokio::time::timeout(
        std::time::Duration::from_secs(5),
        backend.closed_changed.notified(),
    )
    .await
    .unwrap();
    let state = runtime.state.lock().unwrap();
    assert_eq!(
        state.sessions.len(),
        1,
        "only parent survives abandoned storage work"
    );
    assert!(state.internal_agents.is_empty());
}
