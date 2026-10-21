use super::*;
use tokio_util::sync::CancellationToken;

const PHASE2_LEASE_SECONDS: i64 = 300;
const PHASE2_HEARTBEAT_SECONDS: u64 = 30;
const STAGE2_MAX_INPUTS: usize = 20;
const MAX_UNUSED_DAYS: i64 = 30;
pub(super) const PROCESSED_NOTES_DIR: &str = "extensions/ad_hoc/processed";
pub(super) const REVIEW_NOTES_DIR: &str = "extensions/ad_hoc/review";

pub(super) async fn run_stage2(
    backend: &LocalMemoryBackend,
    params: MemoryStoreRootParams,
    route: &MemoryStageOneRoute,
    agent: &dyn MemoryAgent,
) -> Result<MemoryStageOneRunResult, RuntimeCoreError> {
    run_stage2_with_heartbeat(
        backend,
        params,
        route,
        agent,
        Duration::from_secs(PHASE2_HEARTBEAT_SECONDS),
    )
    .await
}

async fn run_stage2_with_heartbeat(
    backend: &LocalMemoryBackend,
    params: MemoryStoreRootParams,
    route: &MemoryStageOneRoute,
    agent: &dyn MemoryAgent,
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
                        if !matches!(state.heartbeat_phase2(&scope_key, &owner, PHASE2_LEASE_SECONDS), Ok(true)) {
                            heartbeat_lost.cancel();
                            break;
                        }
                    }
                }
            }
        })
    };
    let _heartbeat_guard = heartbeat_cancel.clone().drop_guard();
    let _execution_guard = heartbeat_lost.clone().drop_guard();
    let result = run_stage2_inner(
        backend,
        params.scope,
        route,
        agent,
        &root,
        &scope_key,
        &owner,
        &heartbeat_lost,
    )
    .await;
    heartbeat_cancel.cancel();
    let _ = heartbeat_task.await;
    match result {
        Ok((result, selected)) => {
            let watermark = selected
                .iter()
                .filter_map(|s| {
                    s.source_updated_at.parse::<i64>().ok().or_else(|| {
                        chrono::DateTime::parse_from_rfc3339(&s.source_updated_at)
                            .ok()
                            .map(|d| d.timestamp())
                    })
                })
                .max()
                .unwrap_or(0);
            if !backend
                .state
                .commit_phase2_snapshot(&scope_key, &owner, watermark, &selected)
                .map_err(backend_error)?
            {
                return Err(backend_error(
                    "memory consolidation lease expired before snapshot commit",
                ));
            }
            Ok(result)
        }
        Err(error) => {
            // A worker that has not shut down can still mutate its workspace. Do not
            // release its lease and admit another writer while that worker is alive.
            if error.shutdown_complete {
                if let Err(cleanup) = workspace::remove_symlinks(&root) {
                    tracing::warn!(%cleanup, "failed removing memory workspace symbolic links");
                }
                backend
                    .state
                    .finish_phase2(&scope_key, &owner, false, Some(&error.cause.to_string()))
                    .map_err(backend_error)?;
            }
            Err(error.cause)
        }
    }
}

async fn run_stage2_inner(
    backend: &LocalMemoryBackend,
    scope: MemoryStoreScope,
    route: &MemoryStageOneRoute,
    agent: &dyn MemoryAgent,
    root: &Path,
    scope_key: &str,
    owner: &str,
    cancellation: &CancellationToken,
) -> Result<(MemoryStageOneRunResult, Vec<state::StageTwoInput>), MemoryAgentError> {
    let mut inputs = backend
        .state
        .phase2_inputs_for_consolidation(scope_key, STAGE2_MAX_INPUTS, MAX_UNUSED_DAYS)
        .map_err(backend_error)?;
    inputs.retain(|input| root.join(&input.source_path).is_file());
    workspace::prepare(root).await?;
    workspace::sync_inputs(root, &inputs)?;
    let changed = workspace::write_diff(root).await?;
    if changed || workspace::validate(root).is_err() {
        agent
            .run(MemoryAgentRequest {
                cancellation: cancellation.clone(),
                route: route.clone(),
                root: root.to_path_buf(),
                prompt: workspace::prompt(root),
            })
            .await?;
    }
    // The Agent contract includes successful shutdown, not just a provider response.
    workspace::validate(root)?;
    if cancellation.is_cancelled()
        || !backend
            .state
            .heartbeat_phase2(scope_key, owner, PHASE2_LEASE_SECONDS)
            .map_err(backend_error)?
    {
        return Err(backend_error("memory consolidation lease lost before baseline reset").into());
    }
    audit::append_audit_event(
        root,
        &audit::MemoryAuditEvent::consolidate(scope, inputs.len(), 0, 0, &[], changed),
    )?;
    workspace::reset_baseline(root).await?;
    Ok((
        MemoryStageOneRunResult {
            claimed: inputs.len(),
            succeeded: inputs.len(),
            no_output: 0,
            failed: 0,
        },
        inputs,
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
