use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceAddParams {
    pub source: String,
    pub ref_name: Option<String>,
    pub sparse_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceAddResponse {
    pub marketplace_name: String,
    pub installed_root: PathBuf,
    pub already_added: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceRemoveParams {
    pub marketplace_name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceRemoveResponse {
    pub marketplace_name: String,
    pub installed_root: Option<PathBuf>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceUpgradeParams {
    pub marketplace_name: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceUpgradeResponse {
    pub selected_marketplaces: Vec<String>,
    pub upgraded_roots: Vec<PathBuf>,
    pub errors: Vec<MarketplaceUpgradeErrorInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceUpgradeErrorInfo {
    pub marketplace_name: String,
    pub message: String,
}
