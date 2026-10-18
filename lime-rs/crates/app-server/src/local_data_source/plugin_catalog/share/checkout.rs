use super::super::{
    bundle, copy_package_tree, install, manifest, manifest_name, remote, store, PluginStore,
};
use super::{authenticated, error, paths, personal};
use crate::plugin_remote::wire::{validate_remote_id, Item, Scope};
use crate::runtime::RuntimeCoreError;
use app_server_protocol::protocol::v2::{
    AbsolutePathBuf, PluginShareCheckoutParams, PluginShareCheckoutResponse,
    PluginShareDiscoverability,
};
use std::fs;
use std::path::PathBuf;

pub(crate) async fn checkout(
    store: &PluginStore,
    params: PluginShareCheckoutParams,
) -> Result<PluginShareCheckoutResponse, RuntimeCoreError> {
    let _gate = remote::gate::acquire(store).await.map_err(error)?;
    let context = authenticated(store)?;
    validate_remote_id(&params.remote_plugin_id)?;
    let item: Item = context
        .get(&format!(
            "{}?includeDownloadUrls=true",
            params.remote_plugin_id
        ))
        .await?;
    item.validate(Some(Scope::Workspace))?;
    if item.id != params.remote_plugin_id
        || item.discoverability == PluginShareDiscoverability::Listed
        || item
            .creator_account_user_id
            .as_ref()
            .is_none_or(|id| id.is_empty())
        || item.share_principals.is_none()
    {
        return Err(error(
            "plugin share checkout is not available for this plugin",
        ));
    }
    let identity = crate::account::AccountManager::plugin_identity_for(&context.account);
    let selection_store = store.clone();
    let selection_identity = identity.clone();
    let remote_id = item.id.clone();
    let name = item.name.clone();
    let target = tokio::task::spawn_blocking(move || {
        let _lock = install::mutation_lock(&selection_store)?;
        select(&selection_store, &selection_identity, &remote_id, &name)
    })
    .await
    .map_err(|_| error("plugin checkout selection task failed"))?
    .map_err(error)?;
    context.ensure_current()?;
    let download = if target.existing {
        None
    } else {
        if !item
            .release
            .version
            .as_deref()
            .is_some_and(store::valid_version)
        {
            return Err(error("plugin share has no safe release version"));
        }
        let url = item
            .release
            .bundle_download_url
            .as_deref()
            .filter(|value| !value.is_empty())
            .ok_or_else(|| error("plugin share bundle URL is missing"))?;
        Some(
            crate::plugin_remote::bundle::download(url, &context.account)
                .await
                .map_err(error)?,
        )
    };
    context.ensure_current()?;
    let account = context.account.clone();
    let store = store.clone();
    tokio::task::spawn_blocking(move || {
        let extracted = download
            .map(|file| bundle::extract(file.path()))
            .transpose()?;
        if let Some(root) = &extracted {
            let value = manifest::read_manifest_with_name(root.path(), Some(&item.name))?;
            if manifest_name(&value)? != item.name {
                return Err("plugin checkout bundle name differs from remote identity".into());
            }
        }
        register(
            &store,
            &identity,
            &item,
            &target,
            extracted.as_ref().map(|root| root.path()),
            || remote::ensure_account(&store, &account),
        )
    })
    .await
    .map_err(|_| error("plugin checkout registration task failed"))?
    .map_err(error)
}

#[derive(Debug, PartialEq, Eq)]
struct Target {
    home: PathBuf,
    path: PathBuf,
    existing: bool,
}

fn select(
    store: &PluginStore,
    identity: &str,
    remote_id: &str,
    name: &str,
) -> Result<Target, String> {
    let home = personal::home(store)?;
    let mapping = paths::read_for_edit(store, identity).map_err(|error| error.to_string())?;
    let path = if let Some(mapped) = mapping
        .local_plugin_paths_by_remote_plugin_id
        .get(remote_id)
    {
        let mapped: &std::path::Path = mapped.as_ref();
        match fs::symlink_metadata(mapped) {
            Ok(_) => {
                let path = fs::canonicalize(mapped).map_err(|error| error.to_string())?;
                if !path.is_dir() || path == home || !path.starts_with(&home) {
                    return Err("mapped plugin checkout must be a directory inside home".into());
                }
                return Ok(Target {
                    home,
                    path,
                    existing: true,
                });
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
        let relative = mapped
            .strip_prefix(&home)
            .or_else(|_| mapped.strip_prefix(store.home.as_deref().unwrap_or(&home)))
            .map_err(|_| "mapped plugin checkout must stay inside home")?;
        if relative.as_os_str().is_empty() {
            return Err("mapped plugin checkout must not replace home".into());
        }
        personal::within_home(&home, relative)?
    } else {
        personal::within_home(&home, &PathBuf::from("plugins").join(name))?
    };
    match fs::symlink_metadata(&path) {
        Ok(_) => {
            return Err(
                "plugin checkout path already exists without a matching share mapping".into(),
            )
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }
    Ok(Target {
        home,
        path,
        existing: false,
    })
}

fn register(
    store: &PluginStore,
    identity: &str,
    item: &Item,
    target: &Target,
    extracted: Option<&std::path::Path>,
    ensure_current: impl Fn() -> Result<(), String>,
) -> Result<PluginShareCheckoutResponse, String> {
    let _lock = install::mutation_lock(store)?;
    ensure_current()?;
    if select(store, identity, &item.id, &item.name)? != *target {
        return Err("plugin checkout destination changed during download".into());
    }
    let update = personal::prepare(&target.home, &target.path, item)?;
    let response = PluginShareCheckoutResponse {
        remote_plugin_id: item.id.clone(),
        plugin_id: store::PluginId::new(&item.name, &update.name)?.key(),
        plugin_name: item.name.clone(),
        plugin_path: AbsolutePathBuf::try_from(target.path.clone())
            .map_err(|error| error.to_string())?,
        marketplace_name: update.name.clone(),
        marketplace_path: AbsolutePathBuf::try_from(update.path.clone())
            .map_err(|error| error.to_string())?,
        remote_version: item.release.version.clone(),
    };
    let previous = paths::read_for_edit(store, identity).map_err(|error| error.to_string())?;
    let mut next = previous.clone();
    next.local_plugin_paths_by_remote_plugin_id
        .insert(item.id.clone(), response.plugin_path.clone());
    let mut created = false;
    let result = (|| {
        if !target.existing {
            let source = extracted.ok_or("plugin checkout archive is missing")?;
            let parent = target
                .path
                .parent()
                .ok_or("plugin checkout has no parent")?;
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            personal::within_home(
                &target.home,
                target
                    .path
                    .strip_prefix(&target.home)
                    .map_err(|_| "plugin checkout escapes home")?,
            )?;
            fs::create_dir(&target.path).map_err(|error| error.to_string())?;
            created = true;
            copy_package_tree(source, &target.path)?;
        }
        ensure_current()?;
        paths::write(store, identity, &next)?;
        if let Err(error) = update.commit() {
            return Err(with_rollback(
                error,
                paths::write(store, identity, &previous),
            ));
        }
        if let Err(error) = ensure_current() {
            let error = with_rollback(error, update.rollback());
            return Err(with_rollback(
                error,
                paths::write(store, identity, &previous),
            ));
        }
        Ok(response)
    })();
    if created && result.is_err() {
        if let Err(cleanup) = fs::remove_dir_all(&target.path) {
            return Err(format!(
                "{}; checkout cleanup failed: {cleanup}",
                result.unwrap_err()
            ));
        }
    }
    result
}

fn with_rollback(error: String, rollback: Result<(), String>) -> String {
    match rollback {
        Ok(()) => error,
        Err(rollback) => format!("{error}; checkout rollback failed: {rollback}"),
    }
}

#[cfg(test)]
mod tests;
