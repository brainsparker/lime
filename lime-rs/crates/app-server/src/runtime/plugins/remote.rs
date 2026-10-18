use super::{RuntimeCore, RuntimeCoreError};
use app_server_protocol::protocol::v2::{
    PluginListMarketplaceKind, PluginListParams, PluginMarketplaceEntry, PluginReadParams,
    PluginReadResponse,
};
use std::collections::BTreeSet;
use std::time::Duration;

mod projection;
use crate::plugin_remote::{wire, Context};

use wire::{Item, Scope};

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
        let installed = installed(runtime).await?;
        let mut marketplaces = Vec::new();
        for collection in collections {
            marketplaces.extend(collection.load(&context, &installed).await?);
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
    mut params: PluginReadParams,
) -> Result<PluginReadResponse, RuntimeCoreError> {
    let scope = Scope::from_marketplace(params.remote_marketplace_name.as_deref().unwrap_or(""))?;
    wire::validate_remote_id(&params.plugin_name)?;
    let context = Context::current(runtime.account_manager.as_deref())?.ok_or_else(|| {
        RuntimeCoreError::InvalidRequest("authentication required for remote plugin details".into())
    })?;
    let item: Item = context
        .get(&format!("{}?includeDownloadUrls=false", params.plugin_name))
        .await?;
    item.validate(Some(scope))?;
    if item.id != params.plugin_name {
        return Err(RuntimeCoreError::Backend(
            "remote plugin detail identity does not match request".to_string(),
        ));
    }
    let installed = installed(runtime).await?;
    let local = if installed.values().any(|summary| {
        summary.local_version.is_some()
            && summary.remote_plugin_id.as_deref() == Some(&item.id)
            && summary.id == format!("{}@{}", item.name, item.marketplace())
    }) {
        params.remote_marketplace_name = Some(item.marketplace().to_string());
        Some(runtime.app_data_source.read_plugin(params).await?.plugin)
    } else {
        None
    };
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
    context.ensure_current()?;
    let onboarding_name = item.release.onboarding_skill_name.clone();
    let mut plugin = item.detail(apps);
    apply_installation(&mut plugin.summary, &installed);
    if let Some(local) = local {
        plugin.skills = local.skills;
        plugin.hooks = local.hooks;
        plugin.mcp_servers = local.mcp_servers;
    }
    if plugin.summary.enabled {
        plugin.onboarding_skill = onboarding_name.and_then(|name| {
            let qualified = format!("{}:{name}", plugin.summary.name);
            plugin
                .skills
                .iter()
                .find(|skill| skill.enabled && (skill.name == name || skill.name == qualified))
                .cloned()
        });
    }
    Ok(PluginReadResponse { plugin })
}

async fn installed(
    runtime: &RuntimeCore,
) -> Result<
    std::collections::BTreeMap<String, app_server_protocol::protocol::v2::PluginSummary>,
    RuntimeCoreError,
> {
    Ok(runtime
        .app_data_source
        .list_installed_plugins(Default::default())
        .await?
        .marketplaces
        .into_iter()
        .flat_map(|market| market.plugins)
        .filter(|plugin| plugin.installed && plugin.remote_plugin_id.is_some())
        .map(|plugin| (plugin.id.clone(), plugin))
        .collect())
}

fn apply_installation(
    summary: &mut app_server_protocol::protocol::v2::PluginSummary,
    installed: &std::collections::BTreeMap<
        String,
        app_server_protocol::protocol::v2::PluginSummary,
    >,
) {
    if let Some(local) = installed
        .get(&summary.id)
        .filter(|local| local.remote_plugin_id == summary.remote_plugin_id)
    {
        summary.installed_at = local.installed_at;
        summary.installed = local.installed;
        summary.enabled = local.enabled;
        summary.local_version = local.local_version.clone();
    }
}
