//! 插件启用状态，以 `name@marketplace` 为键；安装事实来自插件 cache。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// 所有产品面共享的市场来源；Git快照不构成第二份安装状态。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MarketplaceConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_type: Option<MarketplaceSourceType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, rename = "ref", skip_serializing_if = "Option::is_none")]
    pub ref_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sparse_paths: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_revision: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketplaceSourceType {
    Git,
    Local,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct PluginsConfig {
    #[serde(default, rename = "_default", skip_serializing_if = "Option::is_none")]
    pub default: Option<PluginsDefaultConfig>,
    #[serde(default, flatten)]
    pub plugins: BTreeMap<String, PluginConfig>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PluginsDefaultConfig {
    pub enabled: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct PluginConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
}

impl PluginsConfig {
    pub fn is_empty(&self) -> bool {
        self.default.is_none() && self.plugins.is_empty()
    }

    pub fn enabled(&self, id: &str) -> bool {
        self.plugins
            .get(id)
            .and_then(|plugin| plugin.enabled)
            .or_else(|| self.default.as_ref().map(|default| default.enabled))
            .unwrap_or(true)
    }
}
