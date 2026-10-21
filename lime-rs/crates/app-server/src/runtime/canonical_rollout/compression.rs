use super::*;

pub(super) fn plain_path(path: &Path) -> PathBuf {
    if path.extension().is_some_and(|extension| extension == "zst")
        && path
            .with_extension("")
            .extension()
            .is_some_and(|extension| extension == "jsonl")
    {
        path.with_extension("")
    } else {
        path.to_path_buf()
    }
}

pub(super) fn compressed_path(path: &Path) -> PathBuf {
    let mut name = plain_path(path).into_os_string();
    name.push(".zst");
    PathBuf::from(name)
}

pub(super) fn existing_path(path: &Path) -> Result<Option<PathBuf>, String> {
    for candidate in [plain_path(path), compressed_path(path)] {
        reject_symlink(&candidate)?;
        match fs::metadata(&candidate) {
            Ok(metadata) if metadata.is_file() => return Ok(Some(candidate)),
            Ok(_) => {
                return Err(format!(
                    "rollout path is not a file: {}",
                    candidate.display()
                ))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "failed to inspect rollout {}: {error}",
                    candidate.display()
                ))
            }
        }
    }
    Ok(None)
}

pub(super) fn remove_compressed(path: &Path) -> Result<bool, String> {
    let compressed = compressed_path(path);
    reject_symlink(&compressed)?;
    match fs::remove_file(&compressed) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!(
            "failed to delete rollout {}: {error}",
            compressed.display()
        )),
    }
}

impl RolloutStore {
    /// Reads never materialize. Writers publish a complete, validated plain file before
    /// removing its compressed source, following Codex's append materialization boundary.
    pub(super) fn materialize_for_append(&self, path: &Path) -> Result<(), String> {
        let Some(source) = existing_path(path)? else {
            return Ok(());
        };
        let plain = plain_path(path);
        if source == plain {
            return Ok(());
        }
        let parent = plain
            .parent()
            .ok_or_else(|| "rollout path has no parent".to_string())?;
        let result = (|| -> Result<(), String> {
            let input = File::open(&source).map_err(|error| error.to_string())?;
            let metadata = input.metadata().map_err(|error| error.to_string())?;
            let mut decoder =
                zstd::stream::read::Decoder::new(input).map_err(|error| error.to_string())?;
            let mut temp = tempfile::Builder::new()
                .prefix(".rollout-")
                .suffix(".decompress")
                .tempfile_in(parent)
                .map_err(|error| error.to_string())?;
            temp.as_file()
                .set_permissions(metadata.permissions())
                .map_err(|error| error.to_string())?;
            std::io::copy(&mut decoder, &mut temp).map_err(|error| error.to_string())?;
            temp.flush().map_err(|error| error.to_string())?;
            // Compressed files are immutable completed representations. Never repair a
            // malformed decoded tail or publish a file with a conflicting identity.
            let scan = scan_rollout(temp.path())?;
            let relative = plain
                .strip_prefix(&self.agent_root)
                .map_err(|error| error.to_string())?;
            let active = if relative.starts_with(ARCHIVED_SESSIONS_DIR_NAME) {
                active_path_from_archived(relative)?
            } else {
                relative.to_path_buf()
            };
            validate_scan_identity(
                &scan,
                &active,
                scan.initial_thread.session_id.as_str(),
                scan.initial_thread.thread_id.as_str(),
                &source,
            )?;
            temp.as_file()
                .set_times(
                    std::fs::FileTimes::new()
                        .set_modified(metadata.modified().map_err(|error| error.to_string())?),
                )
                .map_err(|error| error.to_string())?;
            temp.as_file()
                .sync_all()
                .map_err(|error| error.to_string())?;
            match temp.persist_noclobber(&plain) {
                Ok(_) => {}
                Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                    // A concurrently published plain file wins; do not overwrite it.
                    reject_symlink(&plain)?;
                    let winner = scan_rollout(&plain)?;
                    validate_scan_identity(
                        &winner,
                        &active,
                        scan.session_id.as_str(),
                        scan.thread_id.as_str(),
                        &plain,
                    )?;
                }
                Err(error) => return Err(error.error.to_string()),
            }
            sync_directory(parent)?;
            remove_compressed(&plain)?;
            sync_directory(parent)
        })();
        result.map_err(|error| {
            format!(
                "failed to materialize rollout {}: {error}",
                source.display()
            )
        })
    }
}

fn sync_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    File::open(path)
        .and_then(|file| file.sync_all())
        .map_err(|error| {
            format!(
                "failed to sync rollout directory {}: {error}",
                path.display()
            )
        })?;
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}
