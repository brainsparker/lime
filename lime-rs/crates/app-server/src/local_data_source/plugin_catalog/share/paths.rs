use super::super::{install, PluginStore};
use app_server_protocol::protocol::v2::AbsolutePathBuf;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;

const MAX_BYTES: u64 = 4 * 1024 * 1024;
const MAX_PATHS: usize = 10_000;

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Mapping {
    pub local_plugin_paths_by_remote_plugin_id: BTreeMap<String, AbsolutePathBuf>,
}

pub(super) fn load(
    store: &PluginStore,
    identity: &str,
) -> Result<BTreeMap<String, AbsolutePathBuf>, String> {
    let _lock = install::mutation_lock(store)?;
    read(store, identity)
        .map(|mapping| mapping.local_plugin_paths_by_remote_plugin_id)
        .map_err(|error| error.to_string())
}

/// Editing paths are best-effort cache, never the remote plugin registry.
pub(super) fn edit(
    store: &PluginStore,
    identity: &str,
    remote_id: &str,
    path: Option<AbsolutePathBuf>,
) -> Result<(), String> {
    crate::plugin_remote::wire::validate_remote_id(remote_id)
        .map_err(|_| "invalid plugin share id")?;
    let _lock = install::mutation_lock(store)?;
    let mut mapping = read_for_edit(store, identity).map_err(|error| error.to_string())?;
    match path {
        Some(path) => {
            mapping
                .local_plugin_paths_by_remote_plugin_id
                .insert(remote_id.to_string(), path);
        }
        None => {
            mapping
                .local_plugin_paths_by_remote_plugin_id
                .remove(remote_id);
        }
    }
    write(store, identity, &mapping)
}

/// Caller holds the store mutation lock through checkout registration and rollback.
pub(super) fn read_for_edit(store: &PluginStore, identity: &str) -> io::Result<Mapping> {
    Ok(match read(store, identity) {
        Ok(mapping) => mapping,
        Err(error) if error.kind() == io::ErrorKind::InvalidData => {
            tracing::warn!(%error, "discarding malformed plugin share path cache");
            Mapping::default()
        }
        Err(error) => return Err(error),
    })
}

pub(super) fn write(store: &PluginStore, identity: &str, mapping: &Mapping) -> Result<(), String> {
    let path = location(store, identity)?;
    if mapping.local_plugin_paths_by_remote_plugin_id.is_empty() {
        return match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("plugin share path removal failed: {error}")),
        };
    }
    if mapping.local_plugin_paths_by_remote_plugin_id.len() > MAX_PATHS {
        return Err("plugin share paths exceed entry limit".into());
    }
    let bytes =
        serde_json::to_vec(mapping).map_err(|_| "plugin share path serialization failed")?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("plugin share paths exceed size limit".into());
    }
    let parent = path.parent().ok_or("plugin share path has no parent")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("plugin share path directory failed: {error}"))?;
    let mut staging = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("plugin share path staging failed: {error}"))?;
    staging
        .write_all(&bytes)
        .and_then(|_| staging.as_file().sync_all())
        .map_err(|error| format!("plugin share path write failed: {error}"))?;
    staging
        .persist(path)
        .map_err(|_| "plugin share path commit failed")?;
    Ok(())
}

fn read(store: &PluginStore, identity: &str) -> io::Result<Mapping> {
    let path = location(store, identity).map_err(io::Error::other)?;
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Mapping::default()),
        Err(error) => return Err(error),
    };
    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return Err(invalid("invalid plugin share path cache file"));
    }
    let mut bytes = Vec::new();
    fs::File::open(path)?
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err(invalid("plugin share paths exceed size limit"));
    }
    let mapping: Mapping =
        serde_json::from_slice(&bytes).map_err(|_| invalid("invalid plugin share path cache"))?;
    if mapping.local_plugin_paths_by_remote_plugin_id.len() > MAX_PATHS
        || mapping
            .local_plugin_paths_by_remote_plugin_id
            .keys()
            .any(|id| crate::plugin_remote::wire::validate_remote_id(id).is_err())
    {
        return Err(invalid("invalid plugin share path identities"));
    }
    Ok(mapping)
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn location(store: &PluginStore, identity: &str) -> Result<PathBuf, String> {
    if identity.len() != 64 || !identity.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("invalid plugin share account identity".into());
    }
    Ok(store
        .root
        .join("share-paths")
        .join(format!("{identity}.json")))
}

#[cfg(test)]
mod tests;
