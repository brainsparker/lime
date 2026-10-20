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

struct LosingWorker {
    state: MemoryStateStore,
    scope: String,
    expire: bool,
    wait_for_cancellation: bool,
}

#[async_trait]
impl MemoryStageTwoProvider for LosingWorker {
    async fn sample(
        &self,
        request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        let sql = if self.expire {
            "UPDATE memory_phase2_jobs SET lease_expires_at = 0 WHERE scope_key = ?1"
        } else {
            "UPDATE memory_phase2_jobs SET lease_owner = 'other-worker' WHERE scope_key = ?1"
        };
        assert_eq!(
            self.state
                .open()
                .unwrap()
                .execute(sql, params![self.scope])
                .unwrap(),
            1
        );
        if self.expire {
            assert!(self
                .state
                .try_claim_phase2(&self.scope, "other-worker", 300)
                .unwrap());
        }
        if self.wait_for_cancellation {
            request.cancellation.cancelled().await;
            return Err(RuntimeCoreError::RequestCanceled);
        }
        Ok(serde_json::json!({
            "entries": [{ "source_path": request.inputs[0].source_path,
                "decision": "accept", "memory": "Must never be written by the old worker.",
                "reason": null }],
            "summary": "lost lease"
        })
        .to_string())
    }
}

#[tokio::test]
async fn phase2_lease_loss_before_model_return_preserves_sources_artifacts_and_watermark() {
    for expire in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let backend = LocalMemoryBackend::new(temp.path().join("data"));
        let (root, scope, source) = seed(&backend).await;
        let memory_before = fs::read(root.join(MEMORY_FILE)).unwrap();
        let summary_before = fs::read(root.join(SUMMARY_FILE)).unwrap();
        let worker = LosingWorker {
            state: backend.state.clone(),
            scope: scope.clone(),
            expire,
            wait_for_cancellation: false,
        };
        let error = run_stage2(&backend, root_params(), &route(), &worker)
            .await
            .unwrap_err();
        assert!(
            error.to_string().contains("lease"),
            "expire={expire}: {error}"
        );
        assert!(
            root.join(&source).is_file(),
            "expire={expire}: source moved"
        );
        assert_eq!(fs::read(root.join(MEMORY_FILE)).unwrap(), memory_before);
        assert_eq!(fs::read(root.join(SUMMARY_FILE)).unwrap(), summary_before);
        let (watermark, selected): (i64, i64) = backend.state.open().unwrap().query_row(
            "SELECT completed_watermark, (SELECT COUNT(*) FROM memory_rollout_jobs WHERE scope_key = ?1 AND selected_for_phase2 = 1) FROM memory_phase2_jobs WHERE scope_key = ?1",
            params![scope], |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();
        assert_eq!((watermark, selected), (0, 0), "expire={expire}");
    }
}

#[tokio::test]
async fn phase2_heartbeat_loss_cancels_running_execution_before_failure_is_released() {
    let temp = tempfile::tempdir().unwrap();
    let backend = LocalMemoryBackend::new(temp.path().join("data"));
    let (root, scope, source) = seed(&backend).await;
    let worker = LosingWorker {
        state: backend.state.clone(),
        scope: scope.clone(),
        expire: false,
        wait_for_cancellation: true,
    };
    let error = tokio::time::timeout(
        Duration::from_secs(3),
        run_stage2_with_heartbeat(
            &backend,
            root_params(),
            &route(),
            &worker,
            Duration::from_millis(1),
        ),
    )
    .await
    .expect("running execution must observe lease cancellation")
    .unwrap_err();
    assert!(error.to_string().contains("heartbeat"), "{error}");
    assert!(root.join(source).is_file());
    let (owner, watermark): (String, i64) = backend
        .state
        .open()
        .unwrap()
        .query_row(
            "SELECT lease_owner, completed_watermark FROM memory_phase2_jobs WHERE scope_key = ?1",
            params![scope],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(
        owner, "other-worker",
        "failed worker must not release another worker's lease"
    );
    assert_eq!(watermark, 0);
}

struct HoldingWorker(mpsc::UnboundedSender<CancellationToken>);

#[async_trait]
impl MemoryStageTwoProvider for HoldingWorker {
    async fn sample(
        &self,
        request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        self.0.send(request.cancellation).unwrap();
        std::future::pending().await
    }
}

#[tokio::test]
async fn dropped_phase2_cancels_execution_and_keeps_lease_until_expiry() {
    let temp = tempfile::tempdir().unwrap();
    let backend = LocalMemoryBackend::new(temp.path().join("data"));
    let (root, scope, source) = seed(&backend).await;
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let worker = HoldingWorker(sender);
    let route = route();
    let mut execution = Box::pin(run_stage2(&backend, root_params(), &route, &worker));
    let cancellation = tokio::select! {
        result = &mut execution => panic!("worker ended before cancellation: {result:?}"),
        token = receiver.recv() => token.expect("worker cancellation token"),
    };
    assert!(!cancellation.is_cancelled());
    drop(execution);
    assert!(
        cancellation.is_cancelled(),
        "abandoned execution must be cancelled"
    );
    assert!(!backend
        .state
        .try_claim_phase2(&scope, "racing-worker", 300)
        .unwrap());
    assert!(root.join(source).is_file());
}

struct ChangingSource {
    state: MemoryStateStore,
    scope: String,
    register_new_version: bool,
    review: bool,
}

#[async_trait]
impl MemoryStageTwoProvider for ChangingSource {
    async fn sample(
        &self,
        request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        let source = &request.inputs[0].source_path;
        let path = request.root_path.join(source);
        if self.register_new_version {
            // A new extraction at the same path must not inherit the old decision, even
            // when the underlying text is unchanged and only the source version advances.
            let content = fs::read_to_string(&path).unwrap();
            self.state
                .register_rollout(&self.scope, source, &content, "new-source-version")
                .unwrap();
            assert!(self
                .state
                .try_claim_stage1(&self.scope, source, "new-extraction", 60, 8)
                .unwrap());
            assert!(self
                .state
                .save_stage1_output(
                    &self.scope,
                    source,
                    "new-extraction",
                    state::StageOneOutputSnapshot {
                        source_path: source.clone(),
                        content_hash: state::hash_content(&content),
                        source_updated_at: "new-source-version".into(),
                        raw_memory: Some("New snapshot must remain pending.".into()),
                        rollout_summary: "A new extraction arrived during phase-2.".into(),
                        rollout_slug: None,
                    },
                )
                .unwrap());
        } else {
            // External file edits need protection before an older proposal archives them.
            fs::write(path, "New source contents that have not been extracted.").unwrap();
        }
        Ok(serde_json::json!({
            "entries": [{
                "source_path": source,
                "decision": if self.review { "review" } else { "accept" },
                "memory": if self.review { None } else { Some("An old decision.") },
                "reason": if self.review { Some("An old review decision.") } else { None }
            }],
            "summary": "old snapshot"
        })
        .to_string())
    }
}

#[tokio::test]
async fn changed_source_version_during_phase2_preserves_new_source_and_artifacts() {
    for register_new_version in [false, true] {
        for review in [false, true] {
            let temp = tempfile::tempdir().unwrap();
            let backend = LocalMemoryBackend::new(temp.path().join("data"));
            let (root, scope, source) = seed(&backend).await;
            let memory_before = fs::read(root.join(MEMORY_FILE)).unwrap();
            let summary_before = fs::read(root.join(SUMMARY_FILE)).unwrap();
            let worker = ChangingSource {
                state: backend.state.clone(),
                scope: scope.clone(),
                register_new_version,
                review,
            };
            let error = run_stage2(&backend, root_params(), &route(), &worker)
                .await
                .unwrap_err();
            assert!(
                error.to_string().contains("source snapshot changed"),
                "{error}"
            );
            assert!(
                root.join(&source).is_file(),
                "new source must not be archived"
            );
            assert_eq!(fs::read(root.join(MEMORY_FILE)).unwrap(), memory_before);
            assert_eq!(fs::read(root.join(SUMMARY_FILE)).unwrap(), summary_before);
            let snapshots = backend.state.stage2_candidates(&scope, 20).unwrap();
            assert_eq!(snapshots.len(), 1);
            if register_new_version {
                assert_eq!(snapshots[0].source_updated_at, "new-source-version");
                assert_eq!(
                    snapshots[0].raw_memory.as_deref(),
                    Some("New snapshot must remain pending.")
                );
            } else {
                assert_eq!(
                    fs::read_to_string(root.join(&source)).unwrap(),
                    "New source contents that have not been extracted."
                );
            }
            let (watermark, selected): (i64, bool) = backend.state.open().unwrap().query_row(
                "SELECT completed_watermark, (SELECT selected_for_phase2 FROM memory_rollout_jobs WHERE scope_key = ?1 AND source_path = ?2) FROM memory_phase2_jobs WHERE scope_key = ?1",
                params![scope, source], |row| Ok((row.get(0)?, row.get(1)?)),
            ).unwrap();
            assert_eq!((watermark, selected), (0, false));
        }
    }
}
