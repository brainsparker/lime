//! Cold rollout compression. Constants and publication order follow Codex's rollout worker.
use super::*;
use fs2::FileExt;
use std::io;
use std::time::{Duration, Instant, SystemTime};
use tokio::task::JoinSet;

mod compress;
#[cfg(test)]
mod tests;

const MIN_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const COOLDOWN: Duration = Duration::from_secs(6 * 60 * 60);
const MAX_RUNTIME: Duration = Duration::from_secs(5 * 60 * 60);
const MAX_JOBS: usize = 2;

#[derive(Debug, Default)]
pub(in crate::runtime) struct CompressionStats {
    pub compressed: usize,
    pub skipped: usize,
    pub failed: usize,
}

impl RolloutStore {
    pub(in crate::runtime) fn spawn_compression(&self) {
        let store = self.clone();
        tokio::spawn(async move {
            if let Err(error) = run(store).await {
                tracing::warn!(%error, "rollout compression failed");
            }
        });
    }
}

struct RunMarker {
    path: PathBuf,
    persist: bool,
}

impl RunMarker {
    fn claim(directory: &Path) -> io::Result<Option<Self>> {
        let path = directory.join("rollout-compression.lock");
        reject_symlink(&path).map_err(io::Error::other)?;
        if path.try_exists()? {
            if !old_enough(&fs::symlink_metadata(&path)?, COOLDOWN)? {
                return Ok(None);
            }
            fs::remove_file(&path)?;
        }
        let mut file = match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => return Ok(None),
            Err(error) => return Err(error),
        };
        let marker = Self {
            path,
            persist: false,
        };
        writeln!(
            file,
            "pid={} started_at={:?}",
            std::process::id(),
            SystemTime::now()
        )?;
        Ok(Some(marker))
    }
}

impl Drop for RunMarker {
    fn drop(&mut self) {
        if !self.persist {
            let _ = fs::remove_file(&self.path);
        }
    }
}

fn maintenance_lock(root: &Path) -> io::Result<Option<(File, PathBuf)>> {
    let directory = root.join(".tmp");
    reject_symlink(root).map_err(io::Error::other)?;
    reject_symlink(&directory).map_err(io::Error::other)?;
    fs::create_dir_all(&directory)?;
    let file = writer_lock::open_lock(&directory.join("rollout-maintenance.lock"))?;
    match FileExt::try_lock_exclusive(&file) {
        Ok(()) => Ok(Some((file, directory))),
        Err(error) if error.kind() == io::ErrorKind::WouldBlock => Ok(None),
        Err(error) => Err(error),
    }
}

pub(in crate::runtime) async fn run(store: RolloutStore) -> io::Result<CompressionStats> {
    let Some((_maintenance, directory)) = maintenance_lock(&store.agent_root)? else {
        return Ok(CompressionStats::default());
    };
    let Some(mut marker) = RunMarker::claim(&directory)? else {
        return Ok(CompressionStats::default());
    };
    let started = Instant::now();
    let mut stats = CompressionStats::default();
    let mut jobs = JoinSet::new();
    for scope in [ARCHIVED_SESSIONS_DIR_NAME, SESSIONS_DIR_NAME] {
        let mut directories = vec![store.agent_root.join(scope)];
        while let Some(directory) = directories.pop() {
            if started.elapsed() >= MAX_RUNTIME {
                break;
            }
            match tokio::fs::symlink_metadata(&directory).await {
                Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
                Ok(_) => continue,
                Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
                Err(error) => {
                    stats.failed += 1;
                    tracing::warn!(%error, "rollout directory metadata failed");
                    continue;
                }
            }
            let mut entries = match tokio::fs::read_dir(&directory).await {
                Ok(entries) => entries,
                Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
                Err(error) => {
                    stats.failed += 1;
                    tracing::warn!(%error, path = %directory.display(), "rollout scan failed");
                    continue;
                }
            };
            loop {
                let entry = match entries.next_entry().await {
                    Ok(Some(entry)) => entry,
                    Ok(None) => break,
                    Err(error) => {
                        stats.failed += 1;
                        tracing::warn!(%error, "rollout directory entry failed");
                        break;
                    }
                };
                if started.elapsed() >= MAX_RUNTIME {
                    break;
                }
                let kind = match entry.file_type().await {
                    Ok(kind) => kind,
                    Err(error) => {
                        stats.failed += 1;
                        tracing::warn!(%error, "rollout entry metadata failed");
                        continue;
                    }
                };
                if kind.is_symlink() {
                    continue;
                }
                if kind.is_dir() {
                    directories.push(entry.path());
                    continue;
                }
                if !kind.is_file() {
                    continue;
                }
                let name = entry.file_name();
                let Some(name) = name.to_str() else {
                    continue;
                };
                if name.starts_with("rollout-compress-") && name.ends_with(".tmp") {
                    match entry
                        .metadata()
                        .await
                        .and_then(|metadata| old_enough(&metadata, COOLDOWN))
                    {
                        Ok(true) => {
                            if let Err(error) = tokio::fs::remove_file(entry.path()).await {
                                stats.failed += 1;
                                tracing::warn!(%error, "rollout temp cleanup failed");
                            }
                        }
                        Ok(false) => {}
                        Err(error) => {
                            stats.failed += 1;
                            tracing::warn!(%error, "rollout temp metadata failed");
                        }
                    }
                    continue;
                }
                if !name.starts_with("rollout-") || !name.ends_with(".jsonl") {
                    continue;
                }
                while jobs.len() >= MAX_JOBS {
                    collect_job(&mut jobs, &mut stats).await;
                }
                let root = store.agent_root.clone();
                let path = entry.path();
                jobs.spawn_blocking(move || compress::compress(&root, &path));
            }
        }
    }
    while !jobs.is_empty() {
        collect_job(&mut jobs, &mut stats).await;
    }
    // A finished pass retains the six-hour marker even when individual files failed.
    marker.persist = true;
    tracing::info!(?stats, "rollout compression completed");
    Ok(stats)
}

async fn collect_job(jobs: &mut JoinSet<io::Result<bool>>, stats: &mut CompressionStats) {
    match jobs.join_next().await {
        Some(Ok(Ok(true))) => stats.compressed += 1,
        Some(Ok(Ok(false))) => stats.skipped += 1,
        Some(result) => {
            stats.failed += 1;
            tracing::warn!(?result, "rollout compression job failed");
        }
        None => {}
    }
}

fn old_enough(metadata: &fs::Metadata, minimum: Duration) -> io::Result<bool> {
    Ok(SystemTime::now()
        .duration_since(metadata.modified()?)
        .unwrap_or_default()
        >= minimum)
}

pub(super) fn thread_id(path: &Path) -> io::Result<String> {
    let (_, mut reader) = read::open_rollout_reader(path).map_err(io::Error::other)?;
    let mut line = String::new();
    reader.read_line(&mut line)?;
    match serde_json::from_str::<RolloutRecord>(&line)? {
        RolloutRecord::SessionMeta { thread_id, .. } => {
            validate_thread_id_for_file(&thread_id).map_err(io::Error::other)?;
            Ok(thread_id)
        }
        _ => Err(io::Error::other(
            "rollout first record must be session metadata",
        )),
    }
}
