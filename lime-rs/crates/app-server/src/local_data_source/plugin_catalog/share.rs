use super::{remote, PluginStore};
use crate::plugin_remote::Context;
use crate::runtime::RuntimeCoreError;
use app_server_protocol::protocol::v2::{
    PluginShareDeleteParams, PluginShareDeleteResponse, PluginShareListItem,
    PluginShareListResponse, PluginShareSaveParams, PluginShareSaveResponse,
    PluginShareUpdateTargetsParams, PluginShareUpdateTargetsResponse,
};
use std::collections::BTreeMap;

mod archive;
mod checkout;
mod paths;
mod personal;
pub(crate) use checkout::checkout;

pub(crate) async fn save(
    store: &PluginStore,
    params: PluginShareSaveParams,
) -> Result<PluginShareSaveResponse, RuntimeCoreError> {
    let _gate = remote::gate::acquire(store).await.map_err(error)?;
    let context = authenticated(store)?;
    let path = params.plugin_path.clone();
    let (filename, bytes) = tokio::task::spawn_blocking(move || archive::pack(path.as_ref()))
        .await
        .map_err(|_| error("plugin share archive task failed"))?
        .map_err(error)?;
    context.ensure_current()?;
    let response = context
        .save_share(
            filename,
            bytes,
            params.remote_plugin_id.as_deref(),
            params.discoverability,
            params.share_targets,
        )
        .await?;
    update_path(
        store,
        &context,
        &response.remote_plugin_id,
        Some(params.plugin_path),
    )
    .await?;
    Ok(response)
}

pub(crate) async fn list(store: &PluginStore) -> Result<PluginShareListResponse, RuntimeCoreError> {
    let context = authenticated(store)?;
    let created = context.created_shares().await?;
    if created.is_empty() {
        return Ok(PluginShareListResponse { data: Vec::new() });
    }
    let installed = context
        .installed_snapshot(false)
        .await?
        .into_iter()
        .map(|row| (row.plugin.id.clone(), row))
        .collect::<BTreeMap<_, _>>();
    let identity = crate::account::AccountManager::plugin_identity_for(&context.account);
    let path_store = store.clone();
    let paths = tokio::task::spawn_blocking(move || paths::load(&path_store, &identity))
        .await
        .map_err(|_| error("plugin share path task failed"))?
        .map_err(error)?;
    context.ensure_current()?;
    let data = created
        .into_iter()
        .map(|item| {
            let mut summary = item.summary();
            if let Some(row) = installed.get(&item.id) {
                if row.plugin.name != item.name || row.plugin.marketplace() != item.marketplace() {
                    return Err(error("plugin share installation identity mismatch"));
                }
                summary.installed = true;
                summary.enabled = row.enabled;
                summary.installed_at = row.installed_at.map(|time| time.timestamp());
                summary.local_version = row.plugin.release.version.clone();
            }
            Ok(PluginShareListItem {
                plugin: summary,
                local_plugin_path: paths.get(&item.id).cloned(),
            })
        })
        .collect::<Result<Vec<_>, RuntimeCoreError>>()?;
    Ok(PluginShareListResponse { data })
}

pub(crate) async fn update(
    store: &PluginStore,
    params: PluginShareUpdateTargetsParams,
) -> Result<PluginShareUpdateTargetsResponse, RuntimeCoreError> {
    let _gate = remote::gate::acquire(store).await.map_err(error)?;
    authenticated(store)?.update_share(params).await
}

pub(crate) async fn delete(
    store: &PluginStore,
    params: PluginShareDeleteParams,
) -> Result<PluginShareDeleteResponse, RuntimeCoreError> {
    let _gate = remote::gate::acquire(store).await.map_err(error)?;
    let context = authenticated(store)?;
    context.delete_share(&params.remote_plugin_id).await?;
    update_path(store, &context, &params.remote_plugin_id, None).await?;
    Ok(PluginShareDeleteResponse {})
}

fn authenticated(store: &PluginStore) -> Result<Context<'_>, RuntimeCoreError> {
    Context::current(store.account.as_deref())?
        .ok_or_else(|| error("authentication required for plugin share"))
}

async fn update_path(
    store: &PluginStore,
    context: &Context<'_>,
    remote_id: &str,
    path: Option<app_server_protocol::protocol::v2::AbsolutePathBuf>,
) -> Result<(), RuntimeCoreError> {
    context.ensure_current()?;
    let identity = crate::account::AccountManager::plugin_identity_for(&context.account);
    let store = store.clone();
    let remote_id = remote_id.to_string();
    // Remote success is authoritative; a cache write failure must not trigger duplicate creates.
    match tokio::task::spawn_blocking(move || paths::edit(&store, &identity, &remote_id, path))
        .await
    {
        Ok(Ok(())) => {}
        Ok(Err(error)) => tracing::warn!(%error, "plugin share path cache update failed"),
        Err(_) => tracing::warn!("plugin share path cache update task failed"),
    }
    context.ensure_current()
}

fn error(message: impl Into<String>) -> RuntimeCoreError {
    RuntimeCoreError::Backend(message.into())
}
