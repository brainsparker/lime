use super::*;
use rusqlite::params;
use tokio::sync::mpsc;

struct Extraction;

#[async_trait]
impl MemoryStageOneProvider for Extraction {
    async fn sample(&self, _: MemoryStageOneProviderRequest) -> Result<String, RuntimeCoreError> {
        Ok(serde_json::json!({
            "raw_memory": "Keep the selected model route.",
            "rollout_summary": "User selected a durable model route.",
            "rollout_slug": "route"
        })
        .to_string())
    }
}

fn root_params() -> MemoryStoreRootParams {
    MemoryStoreRootParams {
        scope: MemoryStoreScope::Global,
        workspace_root: None,
    }
}

fn route() -> MemoryStageOneRoute {
    MemoryStageOneRoute {
        session_id: "lease-parent".into(),
        thread_id: "lease-parent-thread".into(),
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
            title: Some("Model route".into()),
            slug: Some("route".into()),
            content: "Keep the selected model route.".into(),
        })
        .await
        .expect("add memory source");
    backend
        .run_stage1(
            root_params(),
            MemoryStageOneVersion::V1,
            &route(),
            &Extraction,
        )
        .await
        .expect("extract memory source");
    let root = backend.resolve_root(&root_params()).expect("memory root");
    let scope = backend.state_scope_key(&root).expect("scope");
    (root, scope, note.path)
}

#[test]
fn phase2_lease_requires_running_ownership_token_for_heartbeat_and_commit() {
    let temp = tempfile::tempdir().expect("tempdir");
    let state = MemoryStateStore::new(temp.path());
    assert!(state.try_claim_phase2("scope", "old-worker", 300).unwrap());
    state
        .open()
        .unwrap()
        .execute(
            "UPDATE memory_phase2_jobs SET lease_expires_at = 0 WHERE scope_key = ?1",
            params!["scope"],
        )
        .unwrap();
    // Codex permits renewal after expiry if no worker has replaced the token.
    assert!(state.heartbeat_phase2("scope", "old-worker", 300).unwrap());
    state
        .open()
        .unwrap()
        .execute(
            "UPDATE memory_phase2_jobs SET lease_expires_at = 0 WHERE scope_key = ?1",
            params!["scope"],
        )
        .unwrap();
    assert!(state.try_claim_phase2("scope", "new-worker", 300).unwrap());
    assert!(!state.heartbeat_phase2("scope", "old-worker", 300).unwrap());
    assert!(!state
        .commit_phase2_snapshot("scope", "old-worker", 42, &[])
        .unwrap());
    assert!(state
        .commit_phase2_snapshot("scope", "new-worker", 7, &[])
        .unwrap());
    assert!(!state
        .commit_phase2_snapshot("scope", "new-worker", 42, &[])
        .unwrap());
    let watermark: i64 = state
        .open()
        .unwrap()
        .query_row(
            "SELECT completed_watermark FROM memory_phase2_jobs WHERE scope_key = ?1",
            params!["scope"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(watermark, 7);
}

const VALID_SUMMARY: &str = "v1\n\n## User Profile\n\n## User preferences\n\n## General Tips\n\n## What's in Memory\n\nKeep the selected model route.\n";

struct Worker {
    mode: &'static str,
    state: MemoryStateStore,
    scope: String,
    source: String,
    baseline: std::sync::Mutex<Option<String>>,
}

#[async_trait]
impl MemoryAgent for Worker {
    async fn run(&self, request: MemoryAgentRequest) -> Result<(), MemoryAgentError> {
        assert_eq!(request.route.provider, "fixture-provider");
        assert_eq!(request.route.model, "fixture-model");
        assert!(request
            .prompt
            .contains("Consolidate the supplied rollout summaries"));
        let raw = fs::read_to_string(request.root.join("raw_memories.md")).unwrap();
        if self.mode == "source-deleted" {
            assert!(!raw.contains(&self.source));
            assert!(
                fs::read_to_string(request.root.join("phase2_workspace_diff.md"))
                    .unwrap()
                    .contains("deleted")
            );
        } else {
            assert!(raw.contains("Keep the selected model route."));
            assert!(raw.contains(&self.source));
            assert!(
                fs::read_to_string(request.root.join("phase2_workspace_diff.md"))
                    .unwrap()
                    .contains("+Keep the selected model route.")
            );
        }
        *self.baseline.lock().unwrap() = Some(
            fs::read_to_string(
                request.root.join(".git/refs/heads").join(
                    fs::read_to_string(request.root.join(".git/HEAD"))
                        .unwrap()
                        .trim()
                        .strip_prefix("ref: refs/heads/")
                        .unwrap(),
                ),
            )
            .unwrap(),
        );
        match self.mode {
            "failed" | "failed-symlink" | "shutdown" => {
                #[cfg(unix)]
                if self.mode == "failed-symlink" {
                    std::os::unix::fs::symlink(
                        request.root.join(MEMORY_FILE),
                        request.root.join("unsafe-link"),
                    )
                    .unwrap();
                }
                return Err(MemoryAgentError {
                    cause: backend_error("fixture agent failed"),
                    shutdown_complete: self.mode != "shutdown",
                });
            }
            "lease-loss" => {
                self.state.open().unwrap().execute(
                    "UPDATE memory_phase2_jobs SET lease_owner = 'replacement' WHERE scope_key = ?1", params![self.scope],
                ).unwrap();
                request.cancellation.cancelled().await;
                return Err(RuntimeCoreError::RequestCanceled.into());
            }
            "new-version" => {
                let content = fs::read_to_string(request.root.join(&self.source)).unwrap();
                self.state
                    .register_rollout(&self.scope, &self.source, &content, "9999999999")
                    .unwrap();
                assert!(self
                    .state
                    .try_claim_stage1(&self.scope, &self.source, "new-extraction", 60, 8)
                    .unwrap());
                self.state
                    .save_stage1_output(
                        &self.scope,
                        &self.source,
                        "new-extraction",
                        state::StageOneOutputSnapshot {
                            source_path: self.source.clone(),
                            content_hash: state::hash_content(&content),
                            source_updated_at: "9999999999".into(),
                            raw_memory: Some("New snapshot".into()),
                            rollout_summary: "New version".into(),
                            rollout_slug: None,
                        },
                    )
                    .unwrap();
            }
            _ => {}
        }
        fs::write(
            request.root.join(MEMORY_FILE),
            "Keep the selected model route.\n",
        )
        .unwrap();
        fs::write(request.root.join(SUMMARY_FILE), if self.mode == "source-deleted" {
            "v1\n\n## User Profile\n\n## User preferences\n\n## General Tips\n\n## What's in Memory\n"
        } else { VALID_SUMMARY }).unwrap();
        match self.mode {
            "summary-only" => fs::remove_file(request.root.join(MEMORY_FILE)).unwrap(),
            "missing" => fs::remove_file(request.root.join(SUMMARY_FILE)).unwrap(),
            "invalid" => fs::write(request.root.join(SUMMARY_FILE), "v1\nnot a summary").unwrap(),
            "oversized" => fs::write(
                request.root.join(SUMMARY_FILE),
                format!("{VALID_SUMMARY}{}", "x".repeat(10_000)),
            )
            .unwrap(),
            #[cfg(unix)]
            "symlink" => std::os::unix::fs::symlink(
                request.root.join(MEMORY_FILE),
                request.root.join("unsafe-link"),
            )
            .unwrap(),
            _ => {}
        }
        Ok(())
    }
}

async fn fixture(mode: &'static str) -> (tempfile::TempDir, LocalMemoryBackend, PathBuf, Worker) {
    let temp = tempfile::tempdir().unwrap();
    let backend = LocalMemoryBackend::new(temp.path().join("data"));
    let (root, scope, source) = seed(&backend).await;
    let worker = Worker {
        mode,
        state: backend.state.clone(),
        scope,
        source,
        baseline: Default::default(),
    };
    (temp, backend, root, worker)
}

fn job(worker: &Worker) -> (String, Option<String>, i64) {
    worker.state.open().unwrap().query_row(
        "SELECT status, lease_owner, completed_watermark FROM memory_phase2_jobs WHERE scope_key = ?1",
        params![worker.scope], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).unwrap()
}

#[tokio::test]
async fn agent_success_resets_baseline_and_commits_exact_inputs_without_archiving_sources() {
    let (_temp, backend, root, worker) = fixture("success").await;
    let result = run_stage2(&backend, root_params(), &route(), &worker)
        .await
        .unwrap();
    assert_eq!(result.succeeded, 1);
    assert!(root.join(&worker.source).is_file());
    assert!(!root.join("phase2_workspace_diff.md").exists());
    assert_eq!(
        workspace::git(&root, &["rev-list", "--all", "--count"])
            .unwrap()
            .trim(),
        "1"
    );
    assert!(workspace::git(&root, &["status", "--porcelain"])
        .unwrap()
        .is_empty());
    assert_eq!(job(&worker).0, "succeeded");
    assert!(job(&worker).2 > 0);
    assert!(backend
        .state
        .stage2_candidates(&worker.scope, 20)
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn v2_summary_only_is_valid_without_v1_memory_artifact() {
    let (_temp, backend, root, worker) = fixture("summary-only").await;
    run_stage2(&backend, root_params(), &route(), &worker)
        .await
        .unwrap();
    assert!(!root.join(MEMORY_FILE).exists());
    run_stage2(&backend, root_params(), &route(), &UnexpectedWorker)
        .await
        .unwrap();
    assert!(
        !root.join(MEMORY_FILE).exists(),
        "v2 reads must not recreate the retired v1 artifact"
    );
    assert_eq!(
        fs::read_to_string(root.join(SUMMARY_FILE)).unwrap(),
        VALID_SUMMARY
    );
    assert_eq!(job(&worker).0, "succeeded");
}

struct UnexpectedWorker;
#[async_trait]
impl MemoryAgent for UnexpectedWorker {
    async fn run(&self, _: MemoryAgentRequest) -> Result<(), MemoryAgentError> {
        panic!("unchanged valid workspace must not run the Agent again")
    }
}

#[tokio::test]
async fn unchanged_inputs_keep_previous_selection_without_resampling() {
    let (_temp, backend, root, worker) = fixture("success").await;
    run_stage2(&backend, root_params(), &route(), &worker)
        .await
        .unwrap();
    run_stage2(&backend, root_params(), &route(), &UnexpectedWorker)
        .await
        .unwrap();
    assert_eq!(
        backend
            .state
            .phase2_inputs(&worker.scope, 20)
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        fs::read_to_string(root.join(SUMMARY_FILE)).unwrap(),
        VALID_SUMMARY
    );
}

#[tokio::test]
async fn deleted_source_is_removed_from_workspace_and_exact_selection() {
    let (_temp, backend, root, mut worker) = fixture("success").await;
    run_stage2(&backend, root_params(), &route(), &worker)
        .await
        .unwrap();
    fs::remove_file(root.join(&worker.source)).unwrap();
    worker.mode = "source-deleted";
    run_stage2(&backend, root_params(), &route(), &worker)
        .await
        .unwrap();
    assert!(backend
        .state
        .phase2_inputs(&worker.scope, 20)
        .unwrap()
        .is_empty());
    assert!(!fs::read_to_string(root.join(SUMMARY_FILE))
        .unwrap()
        .contains("Keep the selected model route."));
    assert_eq!(
        fs::read_dir(root.join("rollout_summaries/phase2"))
            .unwrap()
            .count(),
        0
    );
}

#[tokio::test]
async fn terminal_failure_releases_job_but_shutdown_failure_retains_lease() {
    for mode in ["failed", "failed-symlink", "shutdown"] {
        let (_temp, backend, root, worker) = fixture(mode).await;
        assert!(run_stage2(&backend, root_params(), &route(), &worker)
            .await
            .is_err());
        let (status, owner, watermark) = job(&worker);
        assert_eq!(watermark, 0);
        assert_eq!(
            status,
            if mode == "shutdown" {
                "leased"
            } else {
                "failed"
            }
        );
        assert_eq!(owner.is_some(), mode == "shutdown");
        assert!(root.join(&worker.source).is_file());
        assert!(!root.join("unsafe-link").symlink_metadata().is_ok());
        if mode == "shutdown" {
            assert!(!worker
                .state
                .try_claim_phase2(&worker.scope, "racing-worker", 300)
                .unwrap());
        }
    }
}

#[tokio::test]
async fn invalid_artifacts_never_reset_baseline_or_commit_watermark() {
    for mode in ["missing", "invalid", "oversized", "symlink"] {
        let (_temp, backend, root, worker) = fixture(mode).await;
        #[cfg(not(unix))]
        if mode == "symlink" {
            continue;
        }
        assert!(
            run_stage2(&backend, root_params(), &route(), &worker)
                .await
                .is_err(),
            "{mode}"
        );
        assert_eq!(
            workspace::git(&root, &["rev-parse", "HEAD"]).unwrap(),
            worker.baseline.lock().unwrap().clone().unwrap()
        );
        assert_eq!(job(&worker).2, 0);
        assert!(root.join(&worker.source).is_file());
        assert!(!root.join("unsafe-link").exists());
    }
}

#[tokio::test]
async fn lease_loss_cancels_agent_and_cannot_reset_replacement_baseline() {
    let (_temp, backend, root, worker) = fixture("lease-loss").await;
    tokio::time::timeout(
        Duration::from_secs(5),
        run_stage2_with_heartbeat(
            &backend,
            root_params(),
            &route(),
            &worker,
            Duration::from_millis(5),
        ),
    )
    .await
    .unwrap()
    .unwrap_err();
    assert_eq!(
        job(&worker),
        ("leased".to_string(), Some("replacement".to_string()), 0)
    );
    assert_eq!(
        workspace::git(&root, &["rev-parse", "HEAD"]).unwrap(),
        worker.baseline.lock().unwrap().clone().unwrap()
    );
}

#[tokio::test]
async fn newer_extraction_during_agent_run_is_left_pending_for_next_job() {
    let (_temp, backend, root, worker) = fixture("new-version").await;
    run_stage2(&backend, root_params(), &route(), &worker)
        .await
        .unwrap();
    let pending = backend.state.stage2_candidates(&worker.scope, 20).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].source_updated_at, "9999999999");
    assert_eq!(pending[0].raw_memory.as_deref(), Some("New snapshot"));
    assert!(root.join(&worker.source).is_file());
    assert!(job(&worker).2 < 9_999_999_999);
}

struct HoldingWorker(mpsc::UnboundedSender<CancellationToken>);
#[async_trait]
impl MemoryAgent for HoldingWorker {
    async fn run(&self, request: MemoryAgentRequest) -> Result<(), MemoryAgentError> {
        self.0.send(request.cancellation).unwrap();
        std::future::pending().await
    }
}

#[tokio::test]
async fn abandoned_job_cancels_agent_and_does_not_release_its_lease() {
    let (_temp, backend, _root, worker) = fixture("success").await;
    let (tx, mut rx) = mpsc::unbounded_channel();
    let holding = HoldingWorker(tx);
    let route = route();
    let mut execution = Box::pin(run_stage2(&backend, root_params(), &route, &holding));
    let cancel = tokio::select! { result = &mut execution => panic!("unexpected result: {result:?}"), token = rx.recv() => token.unwrap() };
    drop(execution);
    assert!(cancel.is_cancelled());
    assert_eq!(job(&worker).0, "leased");
}
