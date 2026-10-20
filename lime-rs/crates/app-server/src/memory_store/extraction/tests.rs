use super::*;
use tokio::sync::{mpsc, oneshot};

fn root_params() -> MemoryStoreRootParams {
    MemoryStoreRootParams {
        scope: MemoryStoreScope::Global,
        workspace_root: None,
    }
}

fn route() -> MemoryStageOneRoute {
    MemoryStageOneRoute {
        session_id: "extraction-parent".into(),
        thread_id: "extraction-parent-thread".into(),
        provider: "fixture-provider".into(),
        model: "fixture-model".into(),
        reasoning_effort: None,
        service_tier: None,
        api_version: None,
        route_protocol: ProtocolKind::OpenaiResponses,
        credential_ref: None,
        cwd: None,
    }
}

async fn seed(backend: &LocalMemoryBackend) -> (PathBuf, String, String) {
    let note = backend
        .add_note(MemoryStoreAddNoteParams {
            root: root_params(),
            title: Some("Versioned source".into()),
            slug: Some("versioned".into()),
            content: "Original source.".into(),
        })
        .await
        .unwrap();
    let root = backend.resolve_root(&root_params()).unwrap();
    let scope = backend.state_scope_key(&root).unwrap();
    (root, scope, note.path)
}

type SampleResult = Result<String, RuntimeCoreError>;

struct HoldingExtraction(
    mpsc::UnboundedSender<(MemoryStageOneProviderRequest, oneshot::Sender<SampleResult>)>,
);

#[async_trait]
impl MemoryStageOneProvider for HoldingExtraction {
    async fn sample(&self, request: MemoryStageOneProviderRequest) -> SampleResult {
        let (sender, receiver) = oneshot::channel();
        self.0.send((request, sender)).unwrap();
        receiver.await.unwrap()
    }
}

fn artifact(content: &str) -> String {
    serde_json::json!({
        "raw_memory": content,
        "rollout_summary": format!("Extracted: {content}"),
        "rollout_slug": "versioned"
    })
    .to_string()
}

struct UnexpectedExtraction;

#[async_trait]
impl MemoryStageOneProvider for UnexpectedExtraction {
    async fn sample(&self, _: MemoryStageOneProviderRequest) -> SampleResult {
        panic!("a concurrent reader must not claim an identical source owned by another worker")
    }
}

#[tokio::test]
async fn concurrent_startup_cannot_reuse_another_extractions_ownership_token() {
    let temp = tempfile::tempdir().unwrap();
    let backend = LocalMemoryBackend::new(temp.path().join("data"));
    let (_, scope, _) = seed(&backend).await;
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let provider = HoldingExtraction(sender);
    let route = route();
    let mut first =
        Box::pin(backend.run_stage1(root_params(), MemoryStageOneVersion::V1, &route, &provider));
    let (request, response) = tokio::select! {
        result = &mut first => panic!("first extraction returned early: {result:?}"),
        request = receiver.recv() => request.unwrap(),
    };
    let second = backend
        .run_stage1(
            root_params(),
            MemoryStageOneVersion::V1,
            &route,
            &UnexpectedExtraction,
        )
        .await
        .unwrap();
    assert_eq!(second.claimed, 0);
    response
        .send(Ok(artifact(&request.source_content)))
        .unwrap();
    assert_eq!(first.await.unwrap().succeeded, 1);
    assert_eq!(
        backend.state.stage2_candidates(&scope, 20).unwrap().len(),
        1
    );
}

#[tokio::test]
async fn stale_extraction_terminals_cannot_replace_a_new_source_snapshot() {
    for terminal in ["success", "no_output", "invalid", "failed"] {
        let temp = tempfile::tempdir().unwrap();
        let backend = LocalMemoryBackend::new(temp.path().join("data"));
        let (root, scope, source) = seed(&backend).await;
        let (sender, mut receiver) = mpsc::unbounded_channel();
        let provider = HoldingExtraction(sender);
        let route = route();
        let mut first = Box::pin(backend.run_stage1(
            root_params(),
            MemoryStageOneVersion::V1,
            &route,
            &provider,
        ));
        let (request, response) = tokio::select! {
            result = &mut first => panic!("first extraction returned early: {result:?}"),
            request = receiver.recv() => request.unwrap(),
        };
        let old_owner: String = backend.state.open().unwrap().query_row(
            "SELECT lease_owner FROM memory_rollout_jobs WHERE scope_key = ?1 AND source_path = ?2",
            rusqlite::params![scope, source], |row| row.get(0),
        ).unwrap();
        fs::write(root.join(&source), "Updated source.").unwrap();
        let mut second = Box::pin(backend.run_stage1(
            root_params(),
            MemoryStageOneVersion::V1,
            &route,
            &provider,
        ));
        let (new_request, new_response) = tokio::select! {
            result = &mut second => panic!("second extraction returned early: {result:?}"),
            request = receiver.recv() => request.unwrap(),
        };
        let new_owner: String = backend.state.open().unwrap().query_row(
            "SELECT lease_owner FROM memory_rollout_jobs WHERE scope_key = ?1 AND source_path = ?2",
            rusqlite::params![scope, source], |row| row.get(0),
        ).unwrap();
        assert_ne!(
            old_owner, new_owner,
            "each extraction needs an independent ownership token"
        );
        let output = match terminal {
            "success" => Ok(artifact(&request.source_content)),
            "no_output" => Ok(serde_json::json!({
                "raw_memory": "", "rollout_summary": "", "rollout_slug": null
            })
            .to_string()),
            "invalid" => Ok("invalid JSON".to_string()),
            "failed" => Err(backend_error("old extraction failed")),
            _ => unreachable!(),
        };
        response.send(output).unwrap();
        let stale_result = first.await.unwrap();
        assert_eq!(stale_result.failed, 1, "{terminal}");
        assert_eq!(
            stale_result.succeeded + stale_result.no_output,
            0,
            "{terminal}"
        );
        let (status, owner, has_output): (String, String, bool) = backend.state.open().unwrap().query_row(
            "SELECT status, lease_owner, output_raw_memory IS NOT NULL OR output_rollout_summary IS NOT NULL FROM memory_rollout_jobs WHERE scope_key = ?1 AND source_path = ?2",
            rusqlite::params![scope, source], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap();
        assert_eq!(
            (status.as_str(), owner.as_str(), has_output),
            ("leased", new_owner.as_str(), false),
            "{terminal}"
        );
        new_response
            .send(Ok(artifact(&new_request.source_content)))
            .unwrap();
        assert_eq!(second.await.unwrap().succeeded, 1);
        let selected = backend.state.stage2_candidates(&scope, 20).unwrap();
        assert_eq!(selected[0].raw_memory.as_deref(), Some("Updated source."));
        assert!(root.join(source).is_file());
    }
}

#[test]
fn new_source_version_can_retry_after_the_previous_version_exhausted_its_budget() {
    let temp = tempfile::tempdir().unwrap();
    let state = MemoryStateStore::new(temp.path());
    state
        .register_rollout("scope", "same.md", "original", "1")
        .unwrap();
    for _ in 0..3 {
        assert!(state
            .try_claim_stage1("scope", "same.md", "worker", 60, 8)
            .unwrap());
        assert!(state
            .mark_stage1_failed("scope", "same.md", "worker", 0, "failed")
            .unwrap());
        // Advance the persisted retry clock without sleeping in the test.
        state
            .open()
            .unwrap()
            .execute("UPDATE memory_rollout_jobs SET retry_at = 0", [])
            .unwrap();
    }
    assert!(!state
        .try_claim_stage1("scope", "same.md", "worker", 60, 8)
        .unwrap());
    state
        .register_rollout("scope", "same.md", "updated", "2")
        .unwrap();
    assert!(state
        .try_claim_stage1("scope", "same.md", "new-worker", 60, 8)
        .unwrap());
}
