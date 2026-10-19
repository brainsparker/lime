use super::consolidation::PROCESSED_NOTES_DIR;
use super::consolidation::REVIEW_NOTES_DIR;
use super::*;

struct FixtureStageOneProvider;

#[async_trait::async_trait]
impl MemoryStageOneProvider for FixtureStageOneProvider {
    async fn sample(
        &self,
        request: MemoryStageOneProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        assert!(request.strict);
        assert_eq!(request.output_schema["additionalProperties"], false);
        assert!(!request.source_content.trim().is_empty());
        Ok(serde_json::json!({
            "raw_memory": "Remember the provider route constraint.",
            "rollout_summary": "The rollout recorded a durable provider route constraint.",
            "rollout_slug": "provider-route-constraint"
        })
        .to_string())
    }
}

struct FixtureStageTwoProvider;

#[async_trait::async_trait]
impl MemoryStageTwoProvider for FixtureStageTwoProvider {
    async fn sample(
        &self,
        request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        assert!(request.strict);
        assert_eq!(request.output_schema["additionalProperties"], false);
        let entries = request
            .inputs
            .into_iter()
            .map(|input| {
                serde_json::json!({
                    "source_path": input.source_path,
                    "decision": "accept",
                    "memory": input.raw_memory.or(input.rollout_summary).unwrap_or_else(|| "durable memory".to_string()),
                    "reason": null
                })
            })
            .collect::<Vec<_>>();
        Ok(serde_json::json!({"entries": entries, "summary": "fixture consolidation"}).to_string())
    }
}

struct ReviewStageOneProvider;

#[async_trait::async_trait]
impl MemoryStageOneProvider for ReviewStageOneProvider {
    async fn sample(
        &self,
        _request: MemoryStageOneProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        Ok(serde_json::json!({
            "rollout_summary": "api_key must remain out of durable memory and requires review.",
            "rollout_slug": "secret-review"
        })
        .to_string())
    }
}

struct ReviewStageTwoProvider;

#[async_trait::async_trait]
impl MemoryStageTwoProvider for ReviewStageTwoProvider {
    async fn sample(
        &self,
        request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        let source_path = request
            .inputs
            .first()
            .map(|input| input.source_path.clone())
            .expect("review input");
        Ok(serde_json::json!({
            "entries": [{
                "source_path": source_path,
                "decision": "review",
                "memory": null,
                "reason": "secret-like content requires review"
            }],
            "summary": "review required"
        })
        .to_string())
    }
}

struct UnknownSourceStageTwoProvider;

#[async_trait::async_trait]
impl MemoryStageTwoProvider for UnknownSourceStageTwoProvider {
    async fn sample(
        &self,
        _request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        Ok(serde_json::json!({
            "entries": [{
                "source_path": "extensions/ad_hoc/notes/unknown.md",
                "decision": "accept",
                "memory": "unknown source must be rejected",
                "reason": null
            }],
            "summary": "unsafe"
        })
        .to_string())
    }
}

struct DuplicateSourceStageTwoProvider;

#[async_trait::async_trait]
impl MemoryStageTwoProvider for DuplicateSourceStageTwoProvider {
    async fn sample(
        &self,
        request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        let source_path = request.inputs[0].source_path.clone();
        Ok(serde_json::json!({
            "entries": [
                {"source_path": source_path.clone(), "decision": "accept", "memory": "first", "reason": null},
                {"source_path": source_path, "decision": "accept", "memory": "duplicate", "reason": null}
            ],
            "summary": "unsafe"
        })
        .to_string())
    }
}

struct MissingSourceStageTwoProvider;

#[async_trait::async_trait]
impl MemoryStageTwoProvider for MissingSourceStageTwoProvider {
    async fn sample(
        &self,
        request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        Ok(serde_json::json!({
            "entries": [{
                "source_path": request.inputs[0].source_path,
                "decision": "accept",
                "memory": "missing source must be rejected",
                "reason": null
            }],
            "summary": "unsafe"
        })
        .to_string())
    }
}

struct OversizedStageTwoProvider;

#[async_trait::async_trait]
impl MemoryStageTwoProvider for OversizedStageTwoProvider {
    async fn sample(
        &self,
        _request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        Ok("x".repeat(128 * 1024 + 1))
    }
}

struct FailingStageTwoProvider;

#[async_trait::async_trait]
impl MemoryStageTwoProvider for FailingStageTwoProvider {
    async fn sample(
        &self,
        _request: MemoryStageTwoProviderRequest,
    ) -> Result<String, RuntimeCoreError> {
        Err(backend_error("fixture provider failed"))
    }
}

fn backend(temp: &tempfile::TempDir) -> LocalMemoryBackend {
    LocalMemoryBackend::new(temp.path().join("data"))
}

fn global_root() -> MemoryStoreRootParams {
    MemoryStoreRootParams {
        scope: MemoryStoreScope::Global,
        workspace_root: None,
    }
}

fn test_route() -> MemoryStageOneRoute {
    MemoryStageOneRoute {
        session_id: "memory-test-session".to_string(),
        thread_id: "memory-test-thread".to_string(),
        provider: "fixture-openai".to_string(),
        model: "fixture-model".to_string(),
        reasoning_effort: None,
        service_tier: None,
        api_version: None,
        route_protocol: ProtocolKind::OpenaiResponses,
        credential_ref: None,
        cwd: None,
    }
}

#[tokio::test]
async fn list_initializes_stable_layout() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);

    let response = backend
        .list(MemoryStoreListParams {
            root: global_root(),
            ..Default::default()
        })
        .await
        .expect("list");

    let paths = response
        .entries
        .iter()
        .map(|entry| entry.path.as_str())
        .collect::<Vec<_>>();
    assert!(paths.contains(&MEMORY_FILE));
    assert!(paths.contains(&SUMMARY_FILE));
    assert!(paths.contains(&"extensions"));
    assert!(paths.contains(&"rollout_summaries"));
    assert!(response
        .entries
        .iter()
        .all(|entry| !entry.path.starts_with('/')));
}

#[tokio::test]
async fn status_reports_codex_memory_readiness_after_rollout_consolidation() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let before = backend
        .status(MemoryStatusParams {
            min_consolidated_threads: Some(1),
        })
        .await
        .expect("status before consolidation");
    assert_eq!(before.v2_consolidated_threads, 0);
    assert!(!before.v2_ready);

    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    fs::write(
        root.join("rollout_summaries/thread-1.md"),
        "# Thread rollout\n\nRemember the deployment constraint.\n",
    )
    .expect("write rollout summary");
    let route = test_route();
    let stage_one = backend
        .run_stage1(
            global_root(),
            MemoryStageOneVersion::V1,
            &route,
            &FixtureStageOneProvider,
        )
        .await
        .expect("stage one rollout summary");
    assert_eq!(stage_one.succeeded, 1);
    let stage_two = backend
        .run_stage2(global_root(), &route, &FixtureStageTwoProvider)
        .await
        .expect("stage two rollout summary");
    assert_eq!(stage_two.succeeded, 1);

    let after = backend
        .status(MemoryStatusParams {
            min_consolidated_threads: Some(1),
        })
        .await
        .expect("status after consolidation");
    assert_eq!(after.v2_consolidated_threads, 1);
    assert!(after.v2_ready);
}

#[tokio::test]
async fn read_rejects_traversal_and_hidden_path() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);

    let traversal = backend
        .read(MemoryStoreReadParams {
            root: global_root(),
            path: "../secret.md".to_string(),
            ..Default::default()
        })
        .await;
    assert!(traversal.is_err());

    let hidden = backend
        .read(MemoryStoreReadParams {
            root: global_root(),
            path: ".hidden/secret.md".to_string(),
            ..Default::default()
        })
        .await;
    assert!(hidden.is_err());
}

#[tokio::test]
async fn add_note_only_writes_ad_hoc_note() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let response = backend
        .add_note(MemoryStoreAddNoteParams {
            root: global_root(),
            title: Some("Remember Context".to_string()),
            slug: Some("Remember Context".to_string()),
            content: "Prefer file-backed memory.".to_string(),
        })
        .await
        .expect("add note");

    assert!(response.path.starts_with("extensions/ad_hoc/notes/"));
    assert!(response.path.ends_with(".md"));
    let read = backend
        .read(MemoryStoreReadParams {
            root: global_root(),
            path: response.path,
            ..Default::default()
        })
        .await
        .expect("read note");
    assert!(read.content.contains("Prefer file-backed memory."));
    assert!(!read.path.starts_with('/'));
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    let summary = fs::read_to_string(root.join(SUMMARY_FILE)).expect("summary");
    assert!(!summary.contains("Prefer file-backed memory."));
}

#[tokio::test]
async fn stage_one_claims_provider_parses_strict_output_and_persists_snapshot() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let note = backend
        .add_note(MemoryStoreAddNoteParams {
            root: global_root(),
            title: Some("Provider route".to_string()),
            slug: Some("provider-route".to_string()),
            content: "Use the selected provider route for memory extraction.".to_string(),
        })
        .await
        .expect("add note");

    let result = backend
        .run_stage1(
            global_root(),
            MemoryStageOneVersion::V1,
            &MemoryStageOneRoute {
                session_id: "memory-test-session".to_string(),
                thread_id: "memory-test-thread".to_string(),
                provider: "fixture-openai".to_string(),
                model: "fixture-model".to_string(),
                reasoning_effort: None,
                service_tier: None,
                api_version: None,
                route_protocol: ProtocolKind::OpenaiResponses,
                credential_ref: None,
                cwd: None,
            },
            &FixtureStageOneProvider,
        )
        .await
        .expect("stage one");
    assert_eq!(result.claimed, 1);
    assert_eq!(result.succeeded, 1);
    assert_eq!(result.no_output, 0);
    assert_eq!(result.failed, 0);

    let scope_key = backend
        .state_scope_key(&temp.path().join("data").join(MEMORY_ROOT_DIR))
        .expect("scope key");
    let conn = backend.state.open().expect("state db");
    let (status, raw_memory, summary) = conn
        .query_row(
            "SELECT status, output_raw_memory, output_rollout_summary FROM memory_rollout_jobs WHERE scope_key = ?1 AND source_path = ?2",
            rusqlite::params![scope_key, note.path],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .expect("stage one snapshot");
    assert_eq!(status, "pending");
    assert_eq!(
        raw_memory.as_deref(),
        Some("Remember the provider route constraint.")
    );
    assert!(summary
        .as_deref()
        .is_some_and(|summary| summary.contains("durable provider route")));
}

#[tokio::test]
async fn stage_two_provider_uses_stage_one_snapshot_and_archives_source() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let note = backend
        .add_note(MemoryStoreAddNoteParams {
            root: global_root(),
            title: Some("Consolidate route".to_string()),
            slug: Some("consolidate-route".to_string()),
            content: "Keep the selected route durable.".to_string(),
        })
        .await
        .expect("add note");
    let route = MemoryStageOneRoute {
        session_id: "memory-stage2-session".to_string(),
        thread_id: "memory-stage2-thread".to_string(),
        provider: "fixture-openai".to_string(),
        model: "fixture-model".to_string(),
        reasoning_effort: None,
        service_tier: None,
        api_version: None,
        route_protocol: ProtocolKind::OpenaiResponses,
        credential_ref: None,
        cwd: None,
    };
    backend
        .run_stage1(
            global_root(),
            MemoryStageOneVersion::V1,
            &route,
            &FixtureStageOneProvider,
        )
        .await
        .expect("stage one");
    let result = backend
        .run_stage2(global_root(), &route, &FixtureStageTwoProvider)
        .await
        .expect("stage two");
    assert_eq!(result.claimed, 1);
    assert_eq!(result.succeeded, 1);
    assert_eq!(result.no_output, 0);
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    assert!(!root.join(&note.path).exists());
    let archived = fs::read_dir(root.join(PROCESSED_NOTES_DIR))
        .expect("processed notes")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .any(|path| path.is_file());
    assert!(archived);
    let memory = fs::read_to_string(root.join(MEMORY_FILE)).expect("memory register");
    assert!(memory.contains("Remember the provider route constraint."));
}

#[tokio::test]
async fn stage_two_review_moves_source_and_marks_durable_review_state() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let note = backend
        .add_note(MemoryStoreAddNoteParams {
            root: global_root(),
            title: Some("Review route".to_string()),
            slug: Some("review-route".to_string()),
            content: "api_key should require human review.".to_string(),
        })
        .await
        .expect("add note");
    let route = test_route();
    backend
        .run_stage1(
            global_root(),
            MemoryStageOneVersion::V2,
            &route,
            &ReviewStageOneProvider,
        )
        .await
        .expect("stage one");
    let result = backend
        .run_stage2(global_root(), &route, &ReviewStageTwoProvider)
        .await
        .expect("stage two");
    assert_eq!(result.succeeded, 0);
    assert_eq!(result.no_output, 1);
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    assert!(!root.join(&note.path).exists());
    let archived_name = Path::new(&note.path).file_name().expect("note file name");
    assert!(root.join(REVIEW_NOTES_DIR).join(archived_name).is_file());
    let scope_key = backend.state_scope_key(&root).expect("scope key");
    let conn = backend.state.open().expect("state db");
    let status = conn
        .query_row(
            "SELECT status FROM memory_rollout_jobs WHERE scope_key = ?1 AND source_path = ?2",
            rusqlite::params![scope_key, note.path],
            |row| row.get::<_, String>(0),
        )
        .expect("review status");
    assert_eq!(status, "review");
}

#[tokio::test]
async fn stage_two_rejects_unsafe_provider_outputs_before_mutating_sources() {
    let cases: Vec<(&str, Box<dyn MemoryStageTwoProvider>)> = vec![
        ("unknown", Box::new(UnknownSourceStageTwoProvider)),
        ("duplicate", Box::new(DuplicateSourceStageTwoProvider)),
        ("oversized", Box::new(OversizedStageTwoProvider)),
        ("provider failure", Box::new(FailingStageTwoProvider)),
    ];
    for (label, provider) in cases {
        let temp = tempfile::tempdir().expect("tempdir");
        let backend = backend(&temp);
        let note = backend
            .add_note(MemoryStoreAddNoteParams {
                root: global_root(),
                title: Some(format!("Unsafe {label}")),
                slug: Some(format!("unsafe-{label}")),
                content: "retain source on failed consolidation".to_string(),
            })
            .await
            .expect("add note");
        let route = test_route();
        backend
            .run_stage1(
                global_root(),
                MemoryStageOneVersion::V1,
                &route,
                &FixtureStageOneProvider,
            )
            .await
            .expect("stage one");
        let result = backend
            .run_stage2(global_root(), &route, provider.as_ref())
            .await;
        assert!(result.is_err(), "{label} output must fail closed");
        let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
        assert!(root.join(&note.path).is_file(), "{label} moved the source");
    }

    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let note = backend
        .add_note(MemoryStoreAddNoteParams {
            root: global_root(),
            title: Some("Missing source".to_string()),
            slug: Some("missing-source".to_string()),
            content: "source removed before consolidation".to_string(),
        })
        .await
        .expect("add note");
    let route = test_route();
    backend
        .run_stage1(
            global_root(),
            MemoryStageOneVersion::V1,
            &route,
            &FixtureStageOneProvider,
        )
        .await
        .expect("stage one");
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    fs::remove_file(root.join(&note.path)).expect("remove source");
    let result = backend
        .run_stage2(global_root(), &route, &MissingSourceStageTwoProvider)
        .await;
    assert!(result.is_err(), "missing source must fail closed");
}

#[tokio::test]
async fn search_skips_non_utf8_files_and_returns_citations() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    backend
        .list(MemoryStoreListParams {
            root: global_root(),
            ..Default::default()
        })
        .await
        .expect("init");
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    fs::write(root.join(MEMORY_FILE), "Alpha memory\nBeta detail\n").expect("write memory");
    fs::write(root.join("binary.bin"), [0xff, 0xfe, 0xfd]).expect("write binary");

    let response = backend
        .search(MemoryStoreSearchParams {
            root: global_root(),
            queries: vec!["beta".to_string()],
            ..Default::default()
        })
        .await
        .expect("search");

    assert_eq!(response.hits.len(), 1);
    assert_eq!(response.hits[0].path, MEMORY_FILE);
    assert_eq!(response.hits[0].match_line_number, 2);
    assert_eq!(response.hits[0].citation.start_line_number, 2);
}

#[tokio::test]
async fn health_initializes_layout_and_reports_store_stats() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);

    let response = backend
        .health(global_root())
        .await
        .expect("memory store health");

    assert_eq!(response.root_scope, MemoryStoreScope::Global);
    assert_eq!(response.root_path, root.to_string_lossy());
    assert!(response.initialized);
    assert!(response.summary_exists);
    assert!(response.memory_exists);
    assert_eq!(response.notes_count, 0);
    assert!(root.join(SUMMARY_FILE).is_file());
    assert!(root.join(MEMORY_FILE).is_file());
    assert!(root.join(NOTES_DIR).is_dir());
    assert!(root.join("audit").is_dir());
}

#[tokio::test]
async fn audit_events_are_file_backed_but_excluded_from_search_and_index_sources() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    backend
        .list(MemoryStoreListParams {
            root: global_root(),
            ..Default::default()
        })
        .await
        .expect("init");
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    fs::write(
        root.join("audit").join("memory_events.jsonl"),
        "{\"operation\":\"consolidate\",\"sentinel\":\"audit-only-memory\"}\n",
    )
    .expect("write audit");
    fs::write(root.join(MEMORY_FILE), "Indexable memory\n").expect("write memory");

    let search = backend
        .search(MemoryStoreSearchParams {
            root: global_root(),
            queries: vec!["audit-only-memory".to_string()],
            ..Default::default()
        })
        .await
        .expect("search skips audit");
    assert!(search.hits.is_empty());

    let rebuilt = backend
        .rebuild_index(global_root())
        .await
        .expect("rebuild index");
    assert_eq!(rebuilt.source_file_count, 2);
}

#[tokio::test]
async fn reset_clears_store_contents_preserves_layout_and_soul_boundary() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    let outside_file = temp.path().join("data").join("memory.soul.json");
    fs::create_dir_all(outside_file.parent().expect("outside parent")).expect("outside parent");
    fs::write(&outside_file, "soul config").expect("outside soul");
    let note = backend
        .add_note(MemoryStoreAddNoteParams {
            root: global_root(),
            title: Some("Reset note".to_string()),
            slug: Some("reset-note".to_string()),
            content: "Remove this note only from the file store.".to_string(),
        })
        .await
        .expect("add note");
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    fs::write(root.join(SUMMARY_FILE), "summary content").expect("summary");
    fs::write(root.join(INDEX_DIR).join("scratch.json"), "{}").expect("index");

    backend.reset().await.expect("reset");

    assert!(outside_file.is_file());
    assert!(root.join(SUMMARY_FILE).is_file());
    assert!(root.join(MEMORY_FILE).is_file());
    assert!(root.join(NOTES_DIR).is_dir());
    assert!(!root.join(note.path).exists());
    assert_eq!(
        fs::read_to_string(root.join(SUMMARY_FILE)).expect("empty summary"),
        ""
    );
}

#[tokio::test]
async fn rebuild_index_writes_deletable_manifest_without_becoming_search_truth() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    backend
        .list(MemoryStoreListParams {
            root: global_root(),
            ..Default::default()
        })
        .await
        .expect("init");
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    fs::write(root.join(MEMORY_FILE), "Indexable memory\n").expect("write memory");

    let response = backend
        .rebuild_index(global_root())
        .await
        .expect("rebuild index");

    assert_eq!(response.root_scope, MemoryStoreScope::Global);
    assert_eq!(response.manifest_path, "index/manifest.json");
    assert_eq!(response.schema_version, "memory-index-manifest/v1");
    assert!(response.source_file_count >= 2);
    assert!(response.source_total_bytes > 0);
    assert!(!response.source_checksum.is_empty());
    assert!(response.rebuilt);
    let manifest = root.join("index/manifest.json");
    assert!(manifest.is_file());
    let manifest_content = fs::read_to_string(&manifest).expect("manifest");
    assert!(manifest_content.contains("memory-index-manifest/v1"));

    fs::remove_file(&manifest).expect("delete manifest");
    let rebuilt = backend
        .rebuild_index(global_root())
        .await
        .expect("rebuild after delete");
    assert_eq!(rebuilt.manifest_path, "index/manifest.json");
    assert!(manifest.is_file());

    fs::write(&manifest, "{not-json").expect("corrupt manifest");
    let search = backend
        .search(MemoryStoreSearchParams {
            root: global_root(),
            queries: vec!["indexable".to_string()],
            ..Default::default()
        })
        .await
        .expect("search falls back to text scan");
    assert_eq!(search.hits.len(), 1);
    assert_eq!(search.hits[0].path, MEMORY_FILE);
}

#[tokio::test]
async fn list_and_search_skip_symlinks() {
    let temp = tempfile::tempdir().expect("tempdir");
    let backend = backend(&temp);
    backend
        .list(MemoryStoreListParams {
            root: global_root(),
            ..Default::default()
        })
        .await
        .expect("init");
    let root = temp.path().join("data").join(MEMORY_ROOT_DIR);
    let target = root.join("target.md");
    fs::write(&target, "target memory").expect("write target");
    let link = root.join("link.md");
    if !create_symlink(&target, &link) {
        return;
    }

    let list = backend
        .list(MemoryStoreListParams {
            root: global_root(),
            ..Default::default()
        })
        .await
        .expect("list");
    assert!(list.entries.iter().any(|entry| entry.path == "target.md"));
    assert!(!list.entries.iter().any(|entry| entry.path == "link.md"));

    let search = backend
        .search(MemoryStoreSearchParams {
            root: global_root(),
            queries: vec!["target".to_string()],
            ..Default::default()
        })
        .await
        .expect("search");
    assert!(search.hits.iter().any(|hit| hit.path == "target.md"));
    assert!(!search.hits.iter().any(|hit| hit.path == "link.md"));
}

#[cfg(unix)]
fn create_symlink(target: &Path, link: &Path) -> bool {
    std::os::unix::fs::symlink(target, link).is_ok()
}

#[cfg(windows)]
fn create_symlink(target: &Path, link: &Path) -> bool {
    std::os::windows::fs::symlink_file(target, link).is_ok()
}
