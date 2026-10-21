//! Cross-process writer ownership and short publication coordination, following Codex rollout.
use super::*;
use fs2::FileExt;
use std::io;

#[derive(Debug)]
pub(super) struct WriterGuard {
    root: PathBuf,
    path: PathBuf,
    file: Option<File>,
}

pub(super) fn acquire(root: &Path, thread_id: &str) -> Result<WriterGuard, String> {
    validate_thread_id_for_file(thread_id)?;
    let _coordination = coordinate(root).map_err(|error| error.to_string())?;
    let path = root
        .join("thread-writer-locks")
        .join(format!("{thread_id}.lock"));
    let file = open_lock(&path).map_err(|error| error.to_string())?;
    FileExt::try_lock_exclusive(&file)
        .map_err(|error| format!("thread {thread_id} writer is unavailable: {error}"))?;
    Ok(WriterGuard {
        root: root.to_path_buf(),
        path,
        file: Some(file),
    })
}

/// Keep coordination through publication so no writer can start after the idle probe.
pub(super) fn try_publication(root: &Path, thread_id: &str) -> io::Result<Option<File>> {
    validate_thread_id_for_file(thread_id).map_err(io::Error::other)?;
    let coordination = coordinate(root)?;
    let path = root
        .join("thread-writer-locks")
        .join(format!("{thread_id}.lock"));
    reject_symlink(&path).map_err(io::Error::other)?;
    match OpenOptions::new().read(true).write(true).open(path) {
        Ok(file) => match FileExt::try_lock_exclusive(&file) {
            Ok(()) => Ok(Some(coordination)),
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => Ok(None),
            Err(error) => Err(error),
        },
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Some(coordination)),
        Err(error) => Err(error),
    }
}

fn coordinate(root: &Path) -> io::Result<File> {
    let directory = root.join("thread-writer-locks");
    reject_symlink(root).map_err(io::Error::other)?;
    reject_symlink(&directory).map_err(io::Error::other)?;
    fs::create_dir_all(&directory)?;
    let file = open_lock(&directory.join(".coordination.lock"))?;
    FileExt::lock_exclusive(&file)?;
    Ok(file)
}

pub(super) fn open_lock(path: &Path) -> io::Result<File> {
    reject_symlink(path).map_err(io::Error::other)?;
    OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
}

impl Drop for WriterGuard {
    fn drop(&mut self) {
        let Ok(_coordination) = coordinate(&self.root) else {
            return;
        };
        // Windows requires closing the handle before unlinking the lock file.
        drop(self.file.take());
        if let Err(error) = fs::remove_file(&self.path) {
            if error.kind() != io::ErrorKind::NotFound {
                tracing::warn!(%error, path = %self.path.display(), "writer lock cleanup failed");
            }
        }
    }
}

impl RolloutStore {
    pub(super) fn acquire_writer(&self, thread_id: &str) -> Result<WriterGuard, String> {
        acquire(&self.agent_root, thread_id)
    }
}
