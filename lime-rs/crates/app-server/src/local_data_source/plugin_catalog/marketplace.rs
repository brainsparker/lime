use super::*;
use crate::runtime::RuntimeCoreError as Error;
use app_server_protocol::protocol::v2::{
    MarketplaceAddParams, MarketplaceAddResponse, MarketplaceRemoveParams,
    MarketplaceRemoveResponse, MarketplaceUpgradeErrorInfo, MarketplaceUpgradeParams,
    MarketplaceUpgradeResponse,
};
use lime_core::config::{ConfigManager, MarketplaceConfig, MarketplaceSourceType};
use std::collections::BTreeMap;

mod git;
mod refresh;
mod source;
mod transaction;

fn invalid(message: impl Into<String>) -> Error {
    Error::InvalidRequest(message.into())
}
fn internal(error: impl std::fmt::Display) -> Error {
    Error::Backend(error.to_string())
}

fn config(store: &PluginStore) -> Result<BTreeMap<String, MarketplaceConfig>, Error> {
    let _guard = lime_core::config::config_file_lock();
    Ok(ConfigManager::load(&store.config_path)
        .map_err(internal)?
        .config()
        .marketplaces
        .clone())
}

fn install_root(store: &PluginStore) -> Result<PathBuf, Error> {
    let agent_root = store
        .root
        .parent()
        .ok_or_else(|| internal("plugin store has no agent root"))?;
    let root = agent_root.join(".tmp/marketplaces");
    fs::create_dir_all(&root).map_err(internal)?;
    let root = fs::canonicalize(root).map_err(internal)?;
    if !root.starts_with(fs::canonicalize(agent_root).map_err(internal)?) {
        return Err(invalid("marketplace install root escapes agent root"));
    }
    Ok(root)
}

pub(super) fn manifest_path(root: &Path) -> Option<PathBuf> {
    discovery::marketplace_paths_for_root(root).find(|path| path.is_file())
}

fn name(root: &Path) -> Result<String, Error> {
    let path =
        manifest_path(root).ok_or_else(|| invalid("marketplace root has no supported manifest"))?;
    load_marketplace(&path)
        .map(|market| market.name)
        .map_err(invalid)
}

fn configured_root(
    store: &PluginStore,
    name: &str,
    config: &MarketplaceConfig,
) -> Result<PathBuf, Error> {
    PluginId::new("marketplace", name).map_err(invalid)?;
    match config.source_type {
        Some(MarketplaceSourceType::Local) => {
            let path = config
                .source
                .as_deref()
                .filter(|source| !source.is_empty())
                .ok_or_else(|| invalid("configured local marketplace is missing source"))?;
            let path = PathBuf::from(path);
            if !path.is_absolute() {
                return Err(invalid("configured marketplace source must be absolute"));
            }
            Ok(path)
        }
        _ => Ok(store
            .root
            .parent()
            .ok_or_else(|| internal("plugin store has no agent root"))?
            .join(".tmp/marketplaces")
            .join(name)),
    }
}

pub(super) fn configured_paths(store: &PluginStore) -> Result<Vec<PathBuf>, String> {
    config(store)
        .map_err(|e| e.to_string())?
        .iter()
        .map(|(name, config)| {
            let root = configured_root(store, name, config).map_err(|e| e.to_string())?;
            // Missing configured roots remain observable as per-marketplace load errors.
            Ok(manifest_path(&root)
                .unwrap_or_else(|| root.join(".agents/plugins/marketplace.json")))
        })
        .collect()
}

pub(crate) async fn add(
    store: &PluginStore,
    params: MarketplaceAddParams,
) -> Result<MarketplaceAddResponse, Error> {
    let mut next = source::parse(
        &params.source,
        params.ref_name,
        params.sparse_paths.unwrap_or_default(),
        store.home.as_deref(),
    )?;
    let previous = config(store)?;
    for (market, configured) in &previous {
        if source::same_source(configured, &next) {
            let root = configured_root(store, market, configured)?;
            if name(&root).is_ok_and(|found| found == *market) {
                // Recheck after validation so a concurrent config edit cannot be acknowledged.
                if config(store)?.get(market) != Some(configured) {
                    return Err(invalid("marketplace changed during add"));
                }
                return Ok(MarketplaceAddResponse {
                    marketplace_name: market.clone(),
                    installed_root: fs::canonicalize(root).map_err(internal)?,
                    already_added: true,
                });
            }
        }
    }
    if next.source_type == Some(MarketplaceSourceType::Local) {
        let root = PathBuf::from(next.source.as_ref().expect("parsed local source"));
        let marketplace_name = name(&root)?;
        reject_name_conflict(&previous, &marketplace_name)?;
        next.last_updated = Some(chrono::Utc::now().to_rfc3339());
        transaction::commit(
            store,
            &marketplace_name,
            None,
            Some(next),
            transaction::SnapshotEdit::Keep,
        )?;
        return Ok(MarketplaceAddResponse {
            marketplace_name,
            installed_root: root,
            already_added: false,
        });
    }
    let staging = staging(store)?;
    next.last_revision = Some(git::clone(&next, staging.path()).await?);
    let marketplace_name = name(staging.path())?;
    reject_name_conflict(&previous, &marketplace_name)?;
    next.last_updated = Some(chrono::Utc::now().to_rfc3339());
    write_metadata(staging.path(), &next)?;
    transaction::commit(
        store,
        &marketplace_name,
        None,
        Some(next),
        transaction::SnapshotEdit::Replace(staging.path()),
    )?;
    Ok(MarketplaceAddResponse {
        installed_root: install_root(store)?.join(&marketplace_name),
        marketplace_name,
        already_added: false,
    })
}

fn reject_name_conflict(
    config: &BTreeMap<String, MarketplaceConfig>,
    name: &str,
) -> Result<(), Error> {
    if config.keys().any(|key| key.eq_ignore_ascii_case(name)) {
        return Err(invalid(format!(
            "marketplace '{name}' is already added from a different source; remove it first"
        )));
    }
    Ok(())
}

pub(crate) fn remove(
    store: &PluginStore,
    params: MarketplaceRemoveParams,
) -> Result<MarketplaceRemoveResponse, Error> {
    let marketplace_name = params.marketplace_name;
    PluginId::new("marketplace", &marketplace_name).map_err(invalid)?;
    let configured = config(store)?;
    if let Some(key) = configured
        .keys()
        .find(|name| name.eq_ignore_ascii_case(&marketplace_name) && **name != marketplace_name)
    {
        return Err(invalid(format!(
            "marketplace '{marketplace_name}' does not exactly match configured '{key}'"
        )));
    }
    let destination = install_root(store)?.join(&marketplace_name);
    let expected = configured.get(&marketplace_name);
    if expected.is_none() && fs::symlink_metadata(&destination).is_err() {
        return Err(invalid(format!(
            "marketplace '{marketplace_name}' is not configured or installed"
        )));
    }
    let removed = transaction::commit(
        store,
        &marketplace_name,
        expected,
        None,
        transaction::SnapshotEdit::Remove,
    )?;
    Ok(MarketplaceRemoveResponse {
        marketplace_name,
        installed_root: removed.then_some(destination),
    })
}

pub(crate) async fn upgrade(
    store: &PluginStore,
    params: MarketplaceUpgradeParams,
) -> Result<MarketplaceUpgradeResponse, Error> {
    let configured = config(store)?;
    let mut outcome = MarketplaceUpgradeResponse::default();
    for (name, expected) in configured.iter().filter(|(name, entry)| {
        entry.source_type == Some(MarketplaceSourceType::Git)
            && params
                .marketplace_name
                .as_ref()
                .is_none_or(|selected| *name == selected)
    }) {
        outcome.selected_marketplaces.push(name.clone());
        match upgrade_one(store, name, expected).await {
            Ok(Some(root)) => outcome.upgraded_roots.push(root),
            Ok(None) => {}
            Err(error) => outcome.errors.push(MarketplaceUpgradeErrorInfo {
                marketplace_name: name.clone(),
                message: error.to_string(),
            }),
        }
    }
    if let Some(name) = &params.marketplace_name {
        if outcome.selected_marketplaces.is_empty() {
            return Err(invalid(format!(
                "marketplace `{name}` is not configured as a Git marketplace"
            )));
        }
    }
    if !outcome.upgraded_roots.is_empty() {
        match refresh::configured_plugins(store, &outcome.upgraded_roots) {
            Ok(errors) => outcome.errors.extend(errors),
            Err(error) => outcome.errors.push(MarketplaceUpgradeErrorInfo {
                marketplace_name: params
                    .marketplace_name
                    .unwrap_or_else(|| "all configured marketplaces".into()),
                message: format!(
                    "failed to refresh installed plugin cache after marketplace upgrade: {error}"
                ),
            }),
        }
    }
    Ok(outcome)
}

async fn upgrade_one(
    store: &PluginStore,
    marketplace_name: &str,
    expected: &MarketplaceConfig,
) -> Result<Option<PathBuf>, Error> {
    PluginId::new("marketplace", marketplace_name).map_err(invalid)?;
    let source = expected
        .source
        .as_deref()
        .ok_or_else(|| invalid("configured Git marketplace is missing source"))?;
    let mut next = source::parse(
        source,
        expected.ref_name.clone(),
        expected.sparse_paths.clone().unwrap_or_default(),
        store.home.as_deref(),
    )?;
    if next.source_type != Some(MarketplaceSourceType::Git) {
        return Err(invalid("configured Git source resolved to a local path"));
    }
    let revision = git::revision(&next).await?;
    let destination = install_root(store)?.join(marketplace_name);
    let metadata = fs::read(destination.join(".marketplace-install.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<MarketplaceConfig>(&bytes).ok());
    if name(&destination).is_ok_and(|name| name == marketplace_name)
        && metadata.as_ref().is_some_and(|meta| {
            source::same_source(meta, &next) && meta.last_revision.as_ref() == Some(&revision)
        })
    {
        if config(store)?.get(marketplace_name) != Some(expected) {
            return Err(invalid("marketplace changed during upgrade"));
        }
        return Ok(None);
    }
    let staging = staging(store)?;
    next.last_revision = Some(git::clone(&next, staging.path()).await?);
    if name(staging.path())? != marketplace_name {
        return Err(invalid(
            "upgraded marketplace name does not match configured name",
        ));
    }
    next.last_updated = Some(chrono::Utc::now().to_rfc3339());
    write_metadata(staging.path(), &next)?;
    transaction::commit(
        store,
        marketplace_name,
        Some(expected),
        Some(next),
        transaction::SnapshotEdit::Replace(staging.path()),
    )?;
    Ok(Some(destination))
}

fn staging(store: &PluginStore) -> Result<tempfile::TempDir, Error> {
    let root = install_root(store)?.join(".staging");
    fs::create_dir_all(&root).map_err(internal)?;
    tempfile::Builder::new()
        .prefix("marketplace-")
        .tempdir_in(root)
        .map_err(internal)
}

fn write_metadata(root: &Path, config: &MarketplaceConfig) -> Result<(), Error> {
    fs::write(
        root.join(".marketplace-install.json"),
        serde_json::to_vec(config).map_err(internal)?,
    )
    .map_err(internal)
}

#[cfg(test)]
mod tests;
