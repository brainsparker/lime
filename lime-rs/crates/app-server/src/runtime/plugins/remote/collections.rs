use super::*;
use app_server_protocol::protocol::v2::{
    MarketplaceInterface, PluginShareDiscoverability, PluginSummary,
};
use std::collections::BTreeMap;
use wire::Directory;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Collection {
    Global,
    User,
    Workspace,
    Vertical,
    Shared,
}

impl Collection {
    fn scope(self) -> Scope {
        match self {
            Self::Global | Self::Vertical => Scope::Global,
            Self::User => Scope::User,
            Self::Workspace | Self::Shared => Scope::Workspace,
        }
    }

    fn suffix(self) -> String {
        match self {
            Self::Shared => "workspace/shared?limit=200".to_string(),
            Self::Vertical => "list?scope=GLOBAL&limit=200&collection=vertical".to_string(),
            _ => format!("list?scope={}&limit=200", self.scope().api_value()),
        }
    }

    pub(super) async fn load(
        self,
        context: &Context<'_>,
        local: &BTreeMap<String, PluginSummary>,
    ) -> Result<Vec<PluginMarketplaceEntry>, RuntimeCoreError> {
        let items = context.directory(self).await?;
        if self != Self::Shared {
            let plugins = items
                .into_iter()
                .map(|item| {
                    let mut summary = item.summary();
                    apply_installation(&mut summary, local);
                    summary
                })
                .collect();
            return Ok(vec![marketplace(
                self.scope().marketplace(),
                self.scope().display_name(),
                plugins,
            )]);
        }

        // A fresh installed snapshot distinguishes explicit sharing from link installations.
        let mut installed = BTreeMap::new();
        for row in context.installed().await? {
            if row.plugin.scope != Scope::Workspace {
                continue;
            }
            let mut summary = row.plugin.summary();
            summary.installed = true;
            summary.enabled = row.enabled;
            summary.installed_at = row.installed_at.map(|time| time.timestamp_millis());
            apply_installation(&mut summary, local);
            installed.insert(row.plugin.id, summary);
        }
        let shared_ids = items
            .iter()
            .map(|item| item.id.clone())
            .collect::<BTreeSet<_>>();
        let directly_shared = items
            .into_iter()
            .filter(|item| item.discoverability != PluginShareDiscoverability::Listed)
            .map(|item| {
                let mut summary = item.summary();
                if let Some(installed) = installed.get(&item.id) {
                    if installed.id == summary.id {
                        summary.installed = true;
                        summary.enabled = installed.enabled;
                        summary.installed_at = installed.installed_at;
                        summary.local_version = installed.local_version.clone();
                    }
                }
                summary
            })
            .collect::<Vec<_>>();
        let link_installed = installed
            .into_iter()
            .filter(|(id, summary)| {
                !shared_ids.contains(id)
                    && summary
                        .share_context
                        .as_ref()
                        .and_then(|context| context.discoverability)
                        == Some(PluginShareDiscoverability::Unlisted)
            })
            .map(|(_, summary)| summary)
            .collect::<Vec<_>>();
        let mut entries = Vec::new();
        if !directly_shared.is_empty() {
            entries.push(marketplace(
                "workspace-shared-with-me-private",
                "Shared with me",
                directly_shared,
            ));
        }
        if !link_installed.is_empty() {
            entries.push(marketplace(
                "workspace-shared-with-me-unlisted",
                "Shared with me (unlisted)",
                link_installed,
            ));
        }
        Ok(entries)
    }
}

impl Context<'_> {
    async fn directory(&self, collection: Collection) -> Result<Vec<Item>, RuntimeCoreError> {
        let mut items = Vec::new();
        let mut ids = BTreeSet::new();
        let mut keys = BTreeSet::new();
        let mut cursors = BTreeSet::new();
        let mut cursor: Option<String> = None;
        for _ in 0..100 {
            let mut suffix = collection.suffix();
            if let Some(cursor) = &cursor {
                suffix.push_str("&pageToken=");
                suffix.push_str(&urlencoding::encode(cursor));
            }
            let page: Directory = self.get(&suffix).await?;
            for item in page.plugins {
                item.validate(Some(collection.scope()))?;
                if collection == Collection::Workspace
                    && item.discoverability != PluginShareDiscoverability::Listed
                {
                    return Err(RuntimeCoreError::Backend(
                        "workspace directory returned an unlisted or private plugin".into(),
                    ));
                }
                if !ids.insert(item.id.clone())
                    || !keys.insert((item.marketplace(), item.name.clone()))
                {
                    return Err(RuntimeCoreError::Backend(
                        "duplicate remote plugin identity".into(),
                    ));
                }
                items.push(item);
                if items.len() > 10_000 {
                    return Err(RuntimeCoreError::Backend(
                        "remote plugin directory exceeds item limit".into(),
                    ));
                }
            }
            cursor = page.pagination.next_page_token;
            let Some(next) = &cursor else {
                return Ok(items);
            };
            if next.is_empty() || next.len() > 2048 || !cursors.insert(next.clone()) {
                return Err(RuntimeCoreError::Backend(
                    "invalid remote plugin pagination cursor".into(),
                ));
            }
        }
        Err(RuntimeCoreError::Backend(
            "remote plugin directory exceeds page limit".into(),
        ))
    }
}

fn marketplace(
    name: &str,
    display_name: &str,
    mut plugins: Vec<PluginSummary>,
) -> PluginMarketplaceEntry {
    plugins.sort_by(|left, right| {
        let display = |plugin: &PluginSummary| {
            plugin
                .interface
                .as_ref()
                .and_then(|interface| interface.display_name.clone())
                .unwrap_or_else(|| plugin.name.clone())
        };
        let left_name = display(left);
        let right_name = display(right);
        left_name
            .to_ascii_lowercase()
            .cmp(&right_name.to_ascii_lowercase())
            .then_with(|| left_name.cmp(&right_name))
            .then_with(|| left.id.cmp(&right.id))
    });
    PluginMarketplaceEntry {
        name: name.to_string(),
        path: None,
        interface: Some(MarketplaceInterface {
            display_name: Some(display_name.to_string()),
        }),
        plugins,
    }
}
