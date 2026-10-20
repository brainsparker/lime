use super::*;
use tokio_util::sync::CancellationToken;

const PHASE2_LEASE_SECONDS: i64 = 300;
const PHASE2_HEARTBEAT_SECONDS: u64 = 30;
const STAGE2_MAX_INPUTS: usize = 20;
const STAGE2_MAX_OUTPUT_BYTES: usize = 128 * 1024;
const STAGE2_MAX_MEMORY_CHARS: usize = 9_000;
const STAGE2_SYSTEM_PROMPT: &str = "You are a Codex memory consolidation agent. You receive immutable stage-1 memory snapshots. Return only the strict JSON artifact. Accept only durable user decisions and workflow facts, redact secrets, and send uncertain or conflicting entries to review. Do not request tools, MCP, plugins, or additional context.";
pub(super) const PROCESSED_NOTES_DIR: &str = "extensions/ad_hoc/processed";
pub(super) const PROCESSED_ROLLOUT_SUMMARIES_DIR: &str = "rollout_summaries/processed";
pub(super) const REVIEW_NOTES_DIR: &str = "extensions/ad_hoc/review";

/// Runs the current phase-2 artifact pipeline. The model proposes only typed artifacts;
/// this module validates source identity and performs every filesystem/state mutation.
pub(super) async fn run_stage2(
    backend: &LocalMemoryBackend,
    params: MemoryStoreRootParams,
    route: &MemoryStageOneRoute,
    provider: &dyn MemoryStageTwoProvider,
) -> Result<MemoryStageOneRunResult, RuntimeCoreError> {
    run_stage2_with_heartbeat(
        backend,
        params,
        route,
        provider,
        Duration::from_secs(PHASE2_HEARTBEAT_SECONDS),
    )
    .await
}

async fn run_stage2_with_heartbeat(
    backend: &LocalMemoryBackend,
    params: MemoryStoreRootParams,
    route: &MemoryStageOneRoute,
    provider: &dyn MemoryStageTwoProvider,
    heartbeat_interval: Duration,
) -> Result<MemoryStageOneRunResult, RuntimeCoreError> {
    let root = backend.resolve_root(&params)?;
    backend.ensure_layout(&root)?;
    let scope_key = backend.state_scope_key(&root)?;
    let owner = uuid::Uuid::new_v4().to_string();
    if !backend
        .state
        .try_claim_phase2(&scope_key, &owner, PHASE2_LEASE_SECONDS)
        .map_err(backend_error)?
    {
        return Err(backend_error(
            "memory consolidation is already running for this scope",
        ));
    }

    let heartbeat_cancel = CancellationToken::new();
    let heartbeat_lost = CancellationToken::new();
    let heartbeat_task = {
        let state = backend.state.clone();
        let scope_key = scope_key.clone();
        let owner = owner.clone();
        let cancel = heartbeat_cancel.clone();
        let heartbeat_lost = heartbeat_lost.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(heartbeat_interval);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                tokio::select! {
                    _ = cancel.cancelled() => break,
                    _ = interval.tick() => {
                        match state.heartbeat_phase2(&scope_key, &owner, PHASE2_LEASE_SECONDS) {
                            Ok(true) => {}
                            Ok(false) | Err(_) => {
                                heartbeat_lost.cancel();
                                break;
                            }
                        }
                    }
                }
            }
        })
    };

    // Dropping this future must not leave a detached task renewing the lease forever.
    let _heartbeat_guard = heartbeat_cancel.clone().drop_guard();
    let _execution_guard = heartbeat_lost.clone().drop_guard();
    let result = run_stage2_inner(
        backend,
        params,
        route,
        provider,
        &root,
        &scope_key,
        &owner,
        &heartbeat_lost,
    )
    .await;
    heartbeat_cancel.cancel();
    let _ = heartbeat_task.await;
    if heartbeat_lost.is_cancelled() {
        backend
            .state
            .finish_phase2(
                &scope_key,
                &owner,
                false,
                Some("memory consolidation lease heartbeat was lost"),
            )
            .map_err(backend_error)?;
        return Err(backend_error(
            "memory consolidation lease heartbeat was lost",
        ));
    }
    match result {
        Ok((result, selected_sources)) => {
            if !backend
                .state
                .commit_phase2_snapshot(
                    &scope_key,
                    &owner,
                    Utc::now().timestamp(),
                    &selected_sources,
                )
                .map_err(backend_error)?
            {
                return Err(backend_error(
                    "memory consolidation lease expired before snapshot commit",
                ));
            }
            Ok(result)
        }
        Err(error) => {
            backend
                .state
                .finish_phase2(&scope_key, &owner, false, Some(&error.to_string()))
                .map_err(backend_error)?;
            Err(error)
        }
    }
}

async fn run_stage2_inner(
    backend: &LocalMemoryBackend,
    params: MemoryStoreRootParams,
    route: &MemoryStageOneRoute,
    provider: &dyn MemoryStageTwoProvider,
    root: &Path,
    scope_key: &str,
    owner: &str,
    cancellation: &CancellationToken,
) -> Result<(MemoryStageOneRunResult, Vec<state::StageTwoInput>), RuntimeCoreError> {
    let inputs = backend
        .state
        .stage2_candidates(scope_key, STAGE2_MAX_INPUTS)
        .map_err(backend_error)?;
    if inputs.is_empty() {
        return Ok((MemoryStageOneRunResult::default(), Vec::new()));
    }
    let provider_inputs = inputs
        .iter()
        .map(|input| MemoryStageTwoInput {
            source_path: input.source_path.clone(),
            raw_memory: input.raw_memory.clone(),
            rollout_summary: input.rollout_summary.clone(),
            rollout_slug: input.rollout_slug.clone(),
        })
        .collect::<Vec<_>>();
    let prompt = serde_json::to_string(
        &provider_inputs
            .iter()
            .map(|input| {
                serde_json::json!({
                    "source_path": input.source_path,
                    "raw_memory": input.raw_memory,
                    "rollout_summary": input.rollout_summary,
                    "rollout_slug": input.rollout_slug,
                })
            })
            .collect::<Vec<_>>(),
    )
    .map_err(|error| backend_error(format!("serialize memory stage-2 inputs: {error}")))?;
    let output = provider
        .sample(MemoryStageTwoProviderRequest {
            cancellation: cancellation.clone(),
            session_id: route.session_id.clone(),
            thread_id: route.thread_id.clone(),
            turn_id: "memory-stage2-consolidation".to_string(),
            provider: route.provider.clone(),
            model: route.model.clone(),
            reasoning_effort: route.reasoning_effort.clone(),
            service_tier: route.service_tier.clone(),
            api_version: route.api_version.clone(),
            route_protocol: route.route_protocol.clone(),
            credential_ref: route.credential_ref.clone(),
            cwd: route.cwd.clone().or_else(|| Some(root.to_path_buf())),
            root_path: root.to_path_buf(),
            inputs: provider_inputs,
            system_prompt: STAGE2_SYSTEM_PROMPT.to_string(),
            user_prompt: format!(
                "Consolidate these stage-1 snapshots into a durable artifact:\n{prompt}"
            ),
            output_schema: stage_two_output::output_schema(),
            strict: true,
        })
        .await?;
    // The worker may have lost its lease while the model was running. Confirm ownership
    // before parsing/applying the proposal, rather than discovering the loss after writes.
    if cancellation.is_cancelled()
        || !backend
            .state
            .heartbeat_phase2(scope_key, owner, PHASE2_LEASE_SECONDS)
            .map_err(backend_error)?
    {
        return Err(backend_error(
            "memory consolidation lease was lost before artifact validation",
        ));
    }
    if output.len() > STAGE2_MAX_OUTPUT_BYTES {
        return Err(backend_error("memory stage-2 output exceeds size limit"));
    }
    let output = stage_two_output::parse(&output).map_err(backend_error)?;
    let allowed = inputs
        .iter()
        .map(|input| input.source_path.as_str())
        .collect::<std::collections::HashSet<_>>();
    let mut seen = std::collections::HashSet::new();
    // Validate the complete model proposal before moving or writing anything. A malformed
    // second entry must not leave the first accepted source half-archived.
    for entry in &output.entries {
        let source_relative = validate_relative_path(&entry.source_path)
            .map_err(|_| backend_error("memory stage-2 source path is invalid"))?;
        if source_relative.is_absolute()
            || source_relative.components().any(|component| {
                matches!(
                    component,
                    Component::ParentDir | Component::RootDir | Component::Prefix(_)
                )
            })
            || !allowed.contains(entry.source_path.as_str())
            || !seen.insert(entry.source_path.clone())
        {
            return Err(backend_error(
                "memory stage-2 output referenced an unknown or duplicate source",
            ));
        }
        let source = root.join(&source_relative);
        if !source.is_file() || is_symlink(&source)? {
            return Err(backend_error(match entry.decision {
                stage_two_output::Decision::Accept => {
                    "memory stage-2 source is missing or symlinked"
                }
                stage_two_output::Decision::Review => {
                    "memory stage-2 review source is missing or symlinked"
                }
            }));
        }
        let snapshot = inputs
            .iter()
            .find(|input| input.source_path == entry.source_path)
            .expect("validated stage-2 source snapshot");
        // This artifact pipeline still archives source files. A newer version must remain
        // untouched for a later run rather than being moved by an older model proposal.
        if !backend
            .state
            .stage2_snapshot_is_current(scope_key, snapshot)
            .map_err(backend_error)?
            || state::hash_content(&fs::read_to_string(&source).map_err(io_error)?)
                != snapshot.content_hash
        {
            return Err(backend_error("memory stage-2 source snapshot changed"));
        }
        if entry.decision == stage_two_output::Decision::Accept
            && entry
                .memory
                .as_ref()
                .is_some_and(|memory| memory.chars().count() > STAGE2_MAX_MEMORY_CHARS)
        {
            return Err(backend_error(
                "memory stage-2 memory artifact exceeds size limit",
            ));
        }
    }
    if cancellation.is_cancelled()
        || !backend
            .state
            .heartbeat_phase2(scope_key, owner, PHASE2_LEASE_SECONDS)
            .map_err(backend_error)?
    {
        return Err(backend_error(
            "memory consolidation lease was lost before artifact writes",
        ));
    }
    let processed_dir = root.join(PROCESSED_NOTES_DIR);
    let processed_rollout_dir = root.join(PROCESSED_ROLLOUT_SUMMARIES_DIR);
    let review_dir = root.join(REVIEW_NOTES_DIR);
    fs::create_dir_all(&processed_dir).map_err(io_error)?;
    fs::create_dir_all(&processed_rollout_dir).map_err(io_error)?;
    fs::create_dir_all(&review_dir).map_err(io_error)?;
    reject_symlink_chain(root, &processed_dir)?;
    reject_symlink_chain(root, &processed_rollout_dir)?;
    reject_symlink_chain(root, &review_dir)?;
    let mut accepted = Vec::new();
    let mut selected_sources = Vec::new();
    let mut warnings = Vec::new();
    let mut skipped_notes = 0;
    let mut archived_notes = 0;
    for entry in output.entries {
        let snapshot = inputs
            .iter()
            .find(|input| input.source_path == entry.source_path)
            .expect("validated stage-2 source snapshot");
        let source_relative = validate_relative_path(&entry.source_path)
            .map_err(|_| backend_error("memory stage-2 source path is invalid"))?;
        match entry.decision {
            stage_two_output::Decision::Accept => {
                let source = root.join(&source_relative);
                let target_dir = if entry.source_path.starts_with("rollout_summaries/") {
                    &processed_rollout_dir
                } else {
                    &processed_dir
                };
                let archived_path = move_note(root, &source, target_dir)?;
                let archived_relative = backend.relative_path(root, &archived_path)?;
                let memory = entry.memory.expect("validated accepted memory artifact");
                accepted.push(format!("- {} (source: {archived_relative})", memory.trim()));
                selected_sources.push(snapshot.clone());
                archived_notes += 1;
            }
            stage_two_output::Decision::Review => {
                let source = root.join(&source_relative);
                move_note(root, &source, &review_dir)?;
                backend
                    .state
                    .mark_stage2_review(scope_key, snapshot)
                    .map_err(backend_error)?;
                skipped_notes += 1;
                warnings.push(format!(
                    "{}: {}",
                    entry.source_path,
                    entry.reason.unwrap_or_default()
                ));
            }
        }
    }
    if !accepted.is_empty() {
        append_memory_register(root, &accepted)?;
        rewrite_summary(root, &accepted)?;
    }
    audit::append_audit_event(
        root,
        &audit::MemoryAuditEvent::consolidate(
            params.scope,
            accepted.len(),
            skipped_notes,
            archived_notes,
            &warnings,
            !accepted.is_empty(),
        ),
    )?;
    Ok((
        MemoryStageOneRunResult {
            claimed: inputs.len(),
            succeeded: accepted.len(),
            no_output: skipped_notes,
            failed: 0,
        },
        selected_sources,
    ))
}

pub(super) fn accepted_note_line(content: &str, relative_path: &str) -> String {
    let mut lines = content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with("---"));
    let summary = lines.next().unwrap_or("Memory note");
    let (summary, _) = truncate_chars(summary, 180);
    format!("- {summary} (source: {relative_path})")
}

pub(super) fn append_memory_register(
    root: &Path,
    accepted: &[String],
) -> Result<(), RuntimeCoreError> {
    let memory_path = root.join(MEMORY_FILE);
    reject_symlink_chain(root, &memory_path)?;
    let mut existing = fs::read_to_string(&memory_path).unwrap_or_default();
    if !existing.trim().is_empty() && !existing.ends_with('\n') {
        existing.push('\n');
    }
    if !existing.contains("## Consolidated notes") {
        if !existing.trim().is_empty() {
            existing.push('\n');
        }
        existing.push_str("## Consolidated notes\n\n");
    }
    for line in accepted {
        existing.push_str(line);
        existing.push('\n');
    }
    fs::write(memory_path, existing).map_err(io_error)
}

pub(super) fn rewrite_summary(root: &Path, accepted: &[String]) -> Result<(), RuntimeCoreError> {
    let summary_path = root.join(SUMMARY_FILE);
    reject_symlink_chain(root, &summary_path)?;
    let mut existing = fs::read_to_string(&summary_path).unwrap_or_default();
    if !super::is_valid_memory_summary(&existing) {
        existing = "v1\n\n## User Profile\n\n## User preferences\n\n## General Tips\n\n## What's in Memory\n\n".to_string();
    }
    if !existing.trim().is_empty() && !existing.ends_with('\n') {
        existing.push('\n');
    }
    if !existing.contains("## Consolidated memory") {
        if !existing.trim().is_empty() {
            existing.push('\n');
        }
        existing.push_str("## Consolidated memory\n\n");
    }
    for line in accepted {
        existing.push_str(line);
        existing.push('\n');
    }
    fs::write(summary_path, existing).map_err(io_error)
}

pub(super) fn move_note(
    root: &Path,
    source: &Path,
    target_dir: &Path,
) -> Result<PathBuf, RuntimeCoreError> {
    reject_symlink_chain(root, source)?;
    reject_symlink_chain(root, target_dir)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| backend_error("memory note path has no file name"))?;
    let mut target = target_dir.join(file_name);
    if target.exists() {
        let stem = source
            .file_stem()
            .and_then(OsStr::to_str)
            .unwrap_or("note")
            .to_string();
        let extension = source.extension().and_then(OsStr::to_str).unwrap_or("md");
        let mut resolved = None;
        for index in 2..1000 {
            let candidate = target_dir.join(format!("{stem}-{index}.{extension}"));
            if !candidate.exists() {
                resolved = Some(candidate);
                break;
            }
        }
        target =
            resolved.ok_or_else(|| backend_error("memory note archive target already exists"))?;
    }
    reject_outside_root(root, &target)?;
    fs::rename(source, &target).map_err(io_error)?;
    Ok(target)
}

#[cfg(test)]
mod tests;
