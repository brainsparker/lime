use super::*;

struct FileState {
    len: u64,
    modified: SystemTime,
    permissions: fs::Permissions,
}

impl FileState {
    fn read(path: &Path) -> io::Result<Option<Self>> {
        let metadata = match fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Ok(None);
        }
        Ok(Some(Self {
            len: metadata.len(),
            modified: metadata.modified()?,
            permissions: metadata.permissions(),
        }))
    }

    fn matches(&self, path: &Path) -> io::Result<bool> {
        Ok(Self::read(path)?.is_some_and(|current| {
            current.len == self.len
                && current.modified == self.modified
                && current.permissions == self.permissions
        }))
    }
}

pub(super) struct PreparedCompression {
    root: PathBuf,
    source: PathBuf,
    destination: PathBuf,
    thread_id: String,
    before: FileState,
    temp: tempfile::NamedTempFile,
}

impl PreparedCompression {
    pub(super) fn prepare(root: &Path, source: &Path) -> io::Result<Option<Self>> {
        let Some(before) = FileState::read(source)? else {
            return Ok(None);
        };
        if SystemTime::now()
            .duration_since(before.modified)
            .unwrap_or_default()
            < MIN_AGE
        {
            return Ok(None);
        }
        let destination = compression::compressed_path(source);
        if destination.try_exists()? {
            return Ok(None);
        }
        let thread_id = thread_id(source)?;
        let parent = source
            .parent()
            .ok_or_else(|| io::Error::other("rollout has no parent"))?;
        let mut temp = tempfile::Builder::new()
            .prefix("rollout-compress-")
            .suffix(".tmp")
            .tempfile_in(parent)?;
        let mut input = File::open(source)?;
        let mut encoder = zstd::stream::write::Encoder::new(temp.as_file_mut(), 3)?;
        encoder.set_pledged_src_size(Some(input.metadata()?.len()))?;
        io::copy(&mut input, &mut encoder)?;
        encoder.finish()?;
        temp.flush()?;
        let decoder = zstd::stream::read::Decoder::new(File::open(temp.path())?)?;
        let scan =
            scan_rollout_reader(BufReader::new(decoder), source).map_err(io::Error::other)?;
        let relative = source.strip_prefix(root).map_err(io::Error::other)?;
        let active = if relative.starts_with(ARCHIVED_SESSIONS_DIR_NAME) {
            active_path_from_archived(relative).map_err(io::Error::other)?
        } else {
            relative.to_path_buf()
        };
        validate_scan_identity(&scan, &active, &scan.session_id, &thread_id, source)
            .map_err(io::Error::other)?;
        if !before.matches(source)? {
            return Ok(None);
        }
        temp.as_file()
            .set_times(fs::FileTimes::new().set_modified(before.modified))?;
        temp.as_file().set_permissions(before.permissions.clone())?;
        temp.as_file().sync_all()?;
        Ok(Some(Self {
            root: root.to_path_buf(),
            source: source.to_path_buf(),
            destination,
            thread_id,
            before,
            temp,
        }))
    }

    pub(super) fn publish(self) -> io::Result<bool> {
        let Some(_publication) = writer_lock::try_publication(&self.root, &self.thread_id)? else {
            return Ok(false);
        };
        if !self.before.matches(&self.source)? {
            return Ok(false);
        }
        match self.temp.persist_noclobber(&self.destination) {
            Ok(_) => {}
            Err(error) if error.error.kind() == io::ErrorKind::AlreadyExists => return Ok(false),
            Err(error) => return Err(error.error),
        }
        if !self.before.matches(&self.source)? {
            fs::remove_file(&self.destination)?;
            return Ok(false);
        }
        compression::sync_directory(self.source.parent().unwrap()).map_err(io::Error::other)?;
        fs::remove_file(&self.source)?;
        compression::sync_directory(self.source.parent().unwrap()).map_err(io::Error::other)?;
        Ok(true)
    }
}

pub(super) fn compress(root: &Path, source: &Path) -> io::Result<bool> {
    match PreparedCompression::prepare(root, source)? {
        Some(prepared) => prepared.publish(),
        None => Ok(false),
    }
}
