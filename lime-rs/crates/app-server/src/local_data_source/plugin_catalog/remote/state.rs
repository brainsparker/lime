use super::*;
use std::collections::BTreeMap;

const MAX_STATE_BYTES: u64 = 16 * 1024 * 1024;

/// Authenticated installed-state projection; package provenance remains in each cache base.
#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct Snapshot {
    pub schema_version: u32,
    pub plugins: BTreeMap<String, PluginSummary>,
}

pub(crate) fn read(store: &PluginStore, identity: &str) -> Result<Option<Snapshot>, String> {
    let path = path(store, identity)?;
    let file = match fs::File::open(&path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("remote installed state unavailable: {error}")),
    };
    if !fs::symlink_metadata(&path)
        .map_err(io_error("读取 remote installed state 元数据失败"))?
        .is_file()
    {
        return Err("remote installed state must be a regular file".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_STATE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(io_error("读取 remote installed state 失败"))?;
    if bytes.len() as u64 > MAX_STATE_BYTES {
        return Err("remote installed state exceeds limit".into());
    }
    let snapshot: Snapshot =
        serde_json::from_slice(&bytes).map_err(|_| "invalid remote installed state")?;
    if snapshot.schema_version != 1 || snapshot.plugins.len() > 10_000 {
        return Err("invalid remote installed state version or size".into());
    }
    for (key, plugin) in &snapshot.plugins {
        let id = PluginId::parse(key)?;
        if plugin.id != *key
            || plugin.name != id.name
            || !is_marketplace(&id.marketplace)
            || plugin.source != PluginSource::Remote
            || !plugin.installed
        {
            return Err("invalid remote installed state identity".into());
        }
        crate::plugin_remote::wire::validate_remote_id(
            plugin
                .remote_plugin_id
                .as_deref()
                .ok_or("remote installed state id missing")?,
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(Some(snapshot))
}

pub(crate) fn write(
    store: &PluginStore,
    identity: &str,
    snapshot: &Snapshot,
) -> Result<(), String> {
    if snapshot.plugins.len() > 10_000 {
        return Err("remote installed state exceeds item limit".into());
    }
    let bytes = serde_json::to_vec(snapshot).map_err(|_| "invalid remote installed state")?;
    if bytes.len() as u64 > MAX_STATE_BYTES {
        return Err("remote installed state exceeds limit".into());
    }
    let path = path(store, identity)?;
    let parent = path.parent().expect("remote installed state parent");
    fs::create_dir_all(parent).map_err(io_error("创建 remote installed state 失败"))?;
    let mut staging = tempfile::NamedTempFile::new_in(parent)
        .map_err(io_error("创建 remote installed state staging 失败"))?;
    std::io::Write::write_all(&mut staging, &bytes)
        .map_err(io_error("写入 remote installed state 失败"))?;
    staging
        .as_file()
        .sync_all()
        .map_err(io_error("持久化 remote installed state 失败"))?;
    staging
        .persist(path)
        .map_err(|_| "remote installed state commit failed")?;
    Ok(())
}

/// Called under the store mutation lock; a config failure restores the prior projection.
pub(crate) fn edit(
    store: &PluginStore,
    identity: &str,
    id: &PluginId,
    summary: Option<PluginSummary>,
    commit_config: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    // Before the first complete fetch there is no authoritative snapshot to amend.
    let Some(previous) = read(store, identity)? else {
        return commit_config();
    };
    let mut next = previous.clone();
    match summary {
        Some(summary) => {
            next.plugins.insert(id.key(), summary);
        }
        None => {
            next.plugins.remove(&id.key());
        }
    }
    write(store, identity, &next)?;
    if let Err(error) = commit_config() {
        write(store, identity, &previous)
            .map_err(|rollback| format!("{error}; installed state rollback failed: {rollback}"))?;
        return Err(error);
    }
    Ok(())
}

fn path(store: &PluginStore, identity: &str) -> Result<PathBuf, String> {
    if identity.len() != 64 || !identity.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("invalid remote installed state account identity".into());
    }
    Ok(store
        .root
        .join("remote-state")
        .join(format!("{identity}.json")))
}
