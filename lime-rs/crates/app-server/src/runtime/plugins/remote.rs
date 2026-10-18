use super::{RuntimeCore, RuntimeCoreError};
use app_server_protocol::protocol::v2::{
    PluginListMarketplaceKind, PluginListParams, PluginMarketplaceEntry, PluginReadParams,
    PluginReadResponse,
};
use std::collections::BTreeSet;
use std::time::Duration;

mod projection;
mod skill;
use crate::plugin_remote::{wire, Context};
pub(super) use skill::read as read_skill;

use wire::Item;

mod collections;
use collections::Collection;

const CATALOG_BUDGET: Duration = Duration::from_secs(30);

pub(super) async fn list(
    runtime: &RuntimeCore,
    params: &PluginListParams,
) -> Result<Vec<PluginMarketplaceEntry>, RuntimeCoreError> {
    let explicit = params.marketplace_kinds.is_some();
    let mut collections = Vec::new();
    match &params.marketplace_kinds {
        None => collections.push(Collection::Global),
        Some(kinds) => {
            for kind in kinds {
                let collection = match kind {
                    PluginListMarketplaceKind::Local => continue,
                    PluginListMarketplaceKind::WorkspaceDirectory => Collection::Workspace,
                    PluginListMarketplaceKind::CreatedByMeRemote => Collection::User,
                    PluginListMarketplaceKind::Vertical => Collection::Vertical,
                    PluginListMarketplaceKind::SharedWithMe => Collection::Shared,
                };
                if !collections.contains(&collection) {
                    collections.push(collection);
                }
            }
        }
    }
    if collections.is_empty() {
        return Ok(Vec::new());
    }
    let Some(context) = Context::current(runtime.account_manager.as_deref())? else {
        return if explicit {
            Err(RuntimeCoreError::InvalidRequest(
                "authentication required for remote plugin catalog".to_string(),
            ))
        } else {
            Ok(Vec::new())
        };
    };
    let result = tokio::time::timeout(CATALOG_BUDGET, async {
        let mut directories = Vec::new();
        for collection in collections {
            directories.push((collection, context.directory(collection).await?));
        }
        let installed = context.installed_snapshot(false).await?;
        let mut marketplaces = Vec::new();
        for (collection, items) in directories {
            marketplaces.extend(collection.project(items, &installed));
        }
        {
            let _guard = lime_core::config::config_file_lock();
            let config = lime_core::config::ConfigManager::load(&runtime.app_config_path).map_err(
                |error| {
                    RuntimeCoreError::Backend(format!("failed to load plugin settings: {error}"))
                },
            )?;
            for summary in marketplaces
                .iter_mut()
                .flat_map(|market| &mut market.plugins)
            {
                summary.enabled &= config.config().plugins.enabled(&summary.id);
            }
        }
        context.ensure_current()?;
        Ok(marketplaces)
    })
    .await
    .map_err(|_| RuntimeCoreError::Backend("remote plugin catalog timed out".to_string()))
    .and_then(|result| result);
    match result {
        Err(error) if !explicit => {
            // Codex keeps real local marketplaces available when its implicit remote catalog fails.
            tracing::warn!(%error, "implicit remote plugin catalog unavailable");
            Ok(Vec::new())
        }
        result => result,
    }
}

pub(super) async fn read(
    runtime: &RuntimeCore,
    params: PluginReadParams,
) -> Result<PluginReadResponse, RuntimeCoreError> {
    wire::validate_remote_id(&params.plugin_name)?;
    let context = Context::current(runtime.account_manager.as_deref())?.ok_or_else(|| {
        RuntimeCoreError::InvalidRequest("authentication required for remote plugin details".into())
    })?;
    let item: Item = context
        .get(&format!("{}?includeDownloadUrls=false", params.plugin_name))
        .await?;
    // Remote IDs are unique; the authorized detail determines its canonical marketplace.
    item.validate(None)?;
    if item.id != params.plugin_name {
        return Err(RuntimeCoreError::Backend(
            "remote plugin detail identity does not match request".to_string(),
        ));
    }
    let installed = context.installed_snapshot(false).await?;
    let installed = installed.iter().find(|row| row.plugin.id == item.id);
    let disabled_skills = installed.map(|row| &row.disabled_skill_names);
    let mut app_ids = BTreeSet::new();
    let app_ids = item
        .release
        .app_ids
        .iter()
        .filter(|id| app_ids.insert((*id).clone()))
        .cloned()
        .collect::<Vec<_>>();
    let mut metadata = std::collections::BTreeMap::new();
    for ids in app_ids.chunks(100) {
        let response = runtime
            .app_data_source
            .read_apps(app_server_protocol::protocol::v2::AppsReadParams {
                app_ids: ids.to_vec(),
                include_tools: false,
            })
            .await?;
        metadata.extend(response.apps.into_iter().map(|app| (app.id.clone(), app)));
    }
    let apps = app_ids
        .into_iter()
        .map(|id| {
            let app = metadata.remove(&id);
            let category = item
                .release
                .app_manifest
                .as_ref()
                .and_then(|manifest| manifest.get("apps"))
                .and_then(serde_json::Value::as_object)
                .and_then(|apps| {
                    apps.values()
                        .find(|app| app.get("id").and_then(serde_json::Value::as_str) == Some(&id))
                })
                .and_then(|app| app.get("category"))
                .and_then(serde_json::Value::as_str)
                .map(str::to_string);
            app_server_protocol::protocol::v2::AppSummary {
                name: app
                    .as_ref()
                    .map_or_else(|| id.clone(), |app| app.name.clone()),
                description: app.as_ref().and_then(|app| app.description.clone()),
                install_url: app.and_then(|app| app.install_url),
                category,
                id,
            }
        })
        .collect();
    let onboarding_name = item.release.onboarding_skill_name.clone();
    let summary = item.summary_with_installation(installed);
    let mut plugin = item.detail(apps, disabled_skills);
    plugin.summary = summary;
    {
        let _guard = lime_core::config::config_file_lock();
        let config =
            lime_core::config::ConfigManager::load(&runtime.app_config_path).map_err(|error| {
                RuntimeCoreError::Backend(format!("failed to load plugin settings: {error}"))
            })?;
        plugin.summary.enabled &= config.config().plugins.enabled(&plugin.summary.id);
    }
    if plugin.summary.enabled
        && plugin.summary.availability
            == app_server_protocol::protocol::v2::PluginAvailability::Available
    {
        plugin.onboarding_skill = onboarding_name.and_then(|name| {
            plugin
                .skills
                .iter()
                .find(|skill| skill.enabled && skill.name == name)
                .cloned()
        });
    }
    context.ensure_current()?;
    Ok(PluginReadResponse { plugin })
}
