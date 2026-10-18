use super::*;
use app_server_protocol::protocol::v2::{PluginReconcileChangedPlugin, PluginReconcileResponse};
use std::collections::BTreeMap;
use std::time::Duration;

pub(crate) async fn reconcile(store: &PluginStore) -> Result<PluginReconcileResponse, String> {
    let _gate = gate::acquire(store).await?;
    let Some(context) =
        Context::current(store.account.as_deref()).map_err(|error| error.to_string())?
    else {
        return Ok(Default::default());
    };
    let deadline = tokio::time::Instant::now() + Duration::from_secs(100);
    let rows = context
        .installed()
        .await
        .map_err(|error| error.to_string())?;
    // Canonicalize every row before publication, download or cleanup. Absence means uninstall.
    let rows = rows
        .into_iter()
        .map(|row| {
            let id = PluginId::new(&row.plugin.name, row.plugin.marketplace())?;
            Ok((row, id))
        })
        .collect::<Result<Vec<_>, String>>()?;
    let snapshot = state::Snapshot {
        schema_version: 1,
        plugins: rows
            .iter()
            .map(|(row, id)| {
                let mut summary = row.plugin.summary();
                summary.installed = true;
                summary.enabled = row.enabled;
                summary.installed_at = row.installed_at.map(|time| time.timestamp());
                (id.key(), summary)
            })
            .collect(),
    };
    let previous = store.cached()?;
    let identity = crate::account::AccountManager::plugin_identity_for(&context.account);
    let previous_state = state::read(store, &identity)?;
    let target = store.clone();
    let account = context.account.clone();
    let publication = snapshot.clone();
    tokio::task::spawn_blocking(move || {
        let _lock = install::mutation_lock(&target)?;
        ensure_account(&target, &account)?;
        state::write(
            &target,
            &crate::account::AccountManager::plugin_identity_for(&account),
            &publication,
        )
    })
    .await
    .map_err(|_| "remote installed state publication task failed".to_string())??;

    let mut changed = BTreeMap::new();
    let mut response = PluginReconcileResponse::default();
    for (row, id) in rows {
        context
            .ensure_current()
            .map_err(|error| error.to_string())?;
        let old = previous.get(&id.key());
        let same_bundle = old.is_some_and(|old| {
            old.remote
                .as_ref()
                .is_some_and(|metadata| metadata.remote_plugin_id == row.plugin.id)
                && row.plugin.release.version.as_deref().map(str::trim) == Some(&old.version)
        });
        let old_state = previous_state
            .as_ref()
            .and_then(|state| state.plugins.get(&id.key()));
        let state_changed = old_state.map_or_else(
            || {
                old.is_some_and(|old| {
                    old.enabled != row.enabled || row.plugin.status != PluginAvailability::Available
                })
            },
            |old| {
                old.enabled != row.enabled
                    || old.availability != row.plugin.status
                    || old.remote_plugin_id.as_deref() != Some(&row.plugin.id)
            },
        );
        if same_bundle {
            if state_changed {
                if let Some(old) = old {
                    include_change(store, &old.id, &old.root, &mut changed);
                }
            }
            continue;
        }
        if let Some(old) = old {
            include_change(store, &old.id, &old.root, &mut changed);
        }
        let remote_id = row.plugin.id.clone();
        let version = row
            .plugin
            .release
            .version
            .as_deref()
            .map(str::trim)
            .map(str::to_string);
        let prepared =
            tokio::time::timeout_at(deadline, package::prepare(store, &context, row.plugin, &id))
                .await;
        let result = match prepared {
            Ok(Ok(prepared)) => {
                let target = store.clone();
                let account = context.account.clone();
                tokio::task::spawn_blocking(move || {
                    prepared
                        .commit(|| ensure_account(&target, &account))
                        .map(|_| ())
                })
                .await
                .map_err(|_| "remote plugin reconcile commit task failed".to_string())?
            }
            Ok(Err(error)) => Err(error),
            Err(_) => Err("remote plugin reconciliation materialization budget exceeded".into()),
        };
        context
            .ensure_current()
            .map_err(|error| error.to_string())?;
        match result {
            Ok(()) => {
                if let Some(version) = version {
                    include_change(
                        store,
                        &id,
                        &store.base_root(&id).join(version),
                        &mut changed,
                    );
                }
            }
            Err(error) => {
                tracing::warn!(%remote_id, %error, "remote installed plugin materialization failed");
                response.failed_remote_plugin_ids.push(remote_id.clone());
                response
                    .failed_materialization_remote_plugin_ids
                    .push(remote_id);
                // A failed update did not change the cached bundle. State changes still count.
                if !state_changed {
                    changed.remove(&id.key());
                }
            }
        }
    }
    for record in previous.values().filter(|record| record.remote.is_some()) {
        if snapshot.plugins.contains_key(&record.id.key()) {
            continue;
        }
        context
            .ensure_current()
            .map_err(|error| error.to_string())?;
        // The projection already removed this identity, even if filesystem cleanup fails.
        include_change(store, &record.id, &record.root, &mut changed);
        let target = store.clone();
        let account = context.account.clone();
        let id = record.id.clone();
        let result = tokio::task::spawn_blocking(move || {
            install::remove(&target, &id, || ensure_account(&target, &account))
        })
        .await
        .map_err(|_| "remote stale plugin cleanup task failed".to_string())?;
        if let Err(error) = result {
            tracing::warn!(plugin_id = %record.id.key(), %error, "remote stale plugin cache cleanup failed");
        }
    }
    context
        .ensure_current()
        .map_err(|error| error.to_string())?;
    response.changed_plugins = changed.into_values().collect();
    response.failed_remote_plugin_ids.sort();
    response.failed_materialization_remote_plugin_ids.sort();
    Ok(response)
}

fn include_change(
    store: &PluginStore,
    id: &PluginId,
    root: &Path,
    changes: &mut BTreeMap<String, PluginReconcileChangedPlugin>,
) {
    let change = changes
        .entry(id.key())
        .or_insert_with(|| PluginReconcileChangedPlugin {
            id: id.key(),
            ..Default::default()
        });
    let Ok(manifest) = manifest::read_manifest_with_name(root, Some(&id.name)) else {
        return;
    };
    change.has_skills |=
        manifest::skill_paths(root, &manifest).is_ok_and(|paths| !paths.is_empty());
    change.has_hooks |= !hooks::declarations(store, root, id, &manifest).is_empty();
    if let Ok(detail) = build_capability_detail(root, &manifest) {
        change.has_mcps |= !detail.mcp_servers.is_empty();
    }
    change.has_apps |=
        apps::declared_app_capabilities(root, &manifest).is_ok_and(|apps| !apps.is_empty());
}
