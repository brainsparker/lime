use super::*;

pub(crate) async fn uninstall(
    store: &PluginStore,
    params: PluginUninstallParams,
) -> Result<PluginUninstallResponse, String> {
    let id = PluginId::parse(&params.plugin_id)?;
    if !is_marketplace(&id.marketplace) {
        return install::uninstall(store, params);
    }
    let _gate = gate::acquire(store).await?;
    let context = Context::current(store.account.as_deref())
        .map_err(|error| error.to_string())?
        .ok_or("authentication required for remote plugin uninstall")?;
    let metadata = metadata(&store.base_root(&id))?.ok_or("remote plugin provenance missing")?;
    if metadata.account_id != crate::account::AccountManager::plugin_identity_for(&context.account)
    {
        return Err("不能卸载另一账号的 Remote Plugin。".into());
    }
    context
        .uninstall(&metadata.remote_plugin_id)
        .await
        .map_err(|error| error.to_string())?;
    let account = context.account.clone();
    let store = store.clone();
    tokio::task::spawn_blocking(move || {
        install::remove(&store, &id, || ensure_account(&store, &account))
    })
    .await
    .map_err(|_| "remote plugin removal task failed".to_string())?
}
