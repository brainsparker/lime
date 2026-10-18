use super::super::{
    bundle, canonical_package_root, manifest, MAX_PACKAGE_BYTES, MAX_PACKAGE_FILES,
};
use crate::plugin_remote::share::MAX_SHARE_BYTES;
use flate2::{write::GzEncoder, Compression};
use std::fs;
use std::io::{self, Write};
use std::path::Path;

/// Preserve the package's relative tree, including dotfiles and executable modes.
pub(super) fn pack(path: &Path) -> Result<(String, Vec<u8>), String> {
    pack_with_limit(path, MAX_SHARE_BYTES)
}

fn pack_with_limit(path: &Path, limit: usize) -> Result<(String, Vec<u8>), String> {
    let root = canonical_package_root(path)?;
    manifest::read_manifest_with_name(&root, None)?;
    let name = root
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Plugin share directory name must be UTF-8")?;
    let encoder = GzEncoder::new(
        LimitedBuffer {
            bytes: Vec::new(),
            limit,
        },
        Compression::default(),
    );
    let mut archive = tar::Builder::new(encoder);
    archive.follow_symlinks(false);
    let mut budget = Budget::default();
    append_tree(&mut archive, &root, &root, 0, &mut budget)
        .map_err(|error| format!("Plugin share archive failed: {error}"))?;
    let encoder = archive
        .into_inner()
        .map_err(|error| format!("Plugin share archive failed: {error}"))?;
    let bytes = encoder
        .finish()
        .map_err(|error| format!("Plugin share archive failed: {error}"))?
        .bytes;
    Ok((format!("{name}.tar.gz"), bytes))
}

#[derive(Default)]
struct Budget {
    entries: usize,
    bytes: u64,
}

fn append_tree<W: Write>(
    archive: &mut tar::Builder<W>,
    root: &Path,
    current: &Path,
    depth: usize,
    budget: &mut Budget,
) -> io::Result<()> {
    if depth > 256 {
        return Err(io::Error::other(
            "Plugin share directory depth exceeds limit",
        ));
    }
    let mut entries = fs::read_dir(current)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(fs::DirEntry::file_name);
    for entry in entries {
        let path = entry.path();
        let relative = bundle::checked_path(path.strip_prefix(root).map_err(io::Error::other)?)
            .map_err(io::Error::other)?;
        budget.entries += 1;
        if budget.entries > MAX_PACKAGE_FILES {
            return Err(io::Error::other("Plugin share entry count exceeds limit"));
        }
        let kind = entry.file_type()?;
        if kind.is_dir() {
            archive.append_dir(&relative, &path)?;
            append_tree(archive, root, &path, depth + 1, budget)?;
        } else if kind.is_file() {
            let mut file = fs::File::open(&path)?;
            let metadata = file.metadata()?;
            if !metadata.is_file() || fs::symlink_metadata(&path)?.file_type().is_symlink() {
                return Err(io::Error::other(
                    "Plugin share forbids links and special files",
                ));
            }
            budget.bytes = budget
                .bytes
                .checked_add(metadata.len())
                .ok_or_else(|| io::Error::other("Plugin share size overflow"))?;
            if budget.bytes > MAX_PACKAGE_BYTES {
                return Err(io::Error::other("Plugin share expanded size exceeds limit"));
            }
            let mut header = tar::Header::new_gnu();
            header.set_metadata(&metadata);
            archive.append_data(&mut header, &relative, &mut file)?;
        } else {
            return Err(io::Error::other(
                "Plugin share forbids links and special files",
            ));
        }
    }
    Ok(())
}

struct LimitedBuffer {
    bytes: Vec<u8>,
    limit: usize,
}
impl Write for LimitedBuffer {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > self.limit.saturating_sub(self.bytes.len()) {
            return Err(io::Error::other(
                "Plugin share compressed size exceeds limit",
            ));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests;
