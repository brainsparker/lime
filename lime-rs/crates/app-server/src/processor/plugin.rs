//! plugin domain handlers for the App Server processor.

use super::{dispatch_result, parse_params, to_jsonrpc_error, RequestProcessor, RpcDispatch};
use app_server_protocol::protocol::v2::{
    MarketplaceAddParams, MarketplaceRemoveParams, MarketplaceUpgradeParams,
};
use app_server_protocol::protocol::v2::{
    PluginInstallParams, PluginInstalledParams, PluginListParams, PluginReadParams,
    PluginSearchParams, PluginUninstallParams,
};
use app_server_protocol::JsonRpcError;

impl RequestProcessor {
    pub(super) async fn handle_plugin_reconcile_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let response = self
            .runtime
            .reconcile_plugins(parse_params(params)?)
            .await
            .map_err(to_jsonrpc_error)?;
        let changed = !response.changed_plugins.is_empty();
        if changed {
            self.refresh_plugin_skill_watch().await;
            self.publish_app_list_updated().await;
        }
        self.dispatch_skill_catalog_mutation(response, changed)
            .await
    }

    pub(super) async fn handle_marketplace_add_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: MarketplaceAddParams = parse_params(params)?;
        let response = self
            .runtime
            .add_marketplace(params)
            .await
            .map_err(to_jsonrpc_error)?;
        let changed = !response.already_added;
        if changed {
            self.runtime.invalidate_plugin_components().await;
            self.refresh_plugin_skill_watch().await;
            self.publish_app_list_updated().await;
        }
        self.dispatch_skill_catalog_mutation(response, changed)
            .await
    }

    pub(super) async fn handle_marketplace_remove_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: MarketplaceRemoveParams = parse_params(params)?;
        let response = self
            .runtime
            .remove_marketplace(params)
            .await
            .map_err(to_jsonrpc_error)?;
        let changed = response.installed_root.is_some();
        if changed {
            self.runtime.invalidate_plugin_components().await;
            self.refresh_plugin_skill_watch().await;
            self.publish_app_list_updated().await;
        }
        self.dispatch_skill_catalog_mutation(response, changed)
            .await
    }

    pub(super) async fn handle_marketplace_upgrade_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: MarketplaceUpgradeParams = parse_params(params)?;
        let response = self
            .runtime
            .upgrade_marketplace(params)
            .await
            .map_err(to_jsonrpc_error)?;
        let changed = !response.upgraded_roots.is_empty();
        if changed {
            self.refresh_plugin_skill_watch().await;
            self.publish_app_list_updated().await;
        }
        self.dispatch_skill_catalog_mutation(response, changed)
            .await
    }

    pub(super) async fn handle_plugin_list_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: PluginListParams = parse_params(params)?;
        let response = self
            .runtime
            .list_plugins(params)
            .await
            .map_err(to_jsonrpc_error)?;
        dispatch_result(response)
    }

    pub(super) async fn handle_plugin_search_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: PluginSearchParams = parse_params(params)?;
        let response = self
            .runtime
            .search_plugins(params)
            .await
            .map_err(to_jsonrpc_error)?;
        dispatch_result(response)
    }

    pub(super) async fn handle_plugin_skill_read_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let response = self
            .runtime
            .read_plugin_skill(parse_params(params)?)
            .await
            .map_err(to_jsonrpc_error)?;
        dispatch_result(response)
    }

    pub(super) async fn handle_plugin_read_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: PluginReadParams = parse_params(params)?;
        let response = self
            .runtime
            .read_plugin(params)
            .await
            .map_err(to_jsonrpc_error)?;
        dispatch_result(response)
    }

    pub(super) async fn handle_plugin_install_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: PluginInstallParams = parse_params(params)?;
        let response = self
            .runtime
            .install_plugin(params)
            .await
            .map_err(to_jsonrpc_error)?;
        self.refresh_plugin_skill_watch().await;
        self.publish_app_list_updated().await;
        self.dispatch_skill_catalog_mutation(response, true).await
    }

    pub(super) async fn handle_plugin_uninstall_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: PluginUninstallParams = parse_params(params)?;
        let response = self
            .runtime
            .uninstall_plugin(params)
            .await
            .map_err(to_jsonrpc_error)?;
        self.refresh_plugin_skill_watch().await;
        self.publish_app_list_updated().await;
        self.dispatch_skill_catalog_mutation(response, true).await
    }

    pub(super) async fn handle_plugin_installed_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: PluginInstalledParams = parse_params(params)?;
        let response = self
            .runtime
            .list_installed_plugins(params)
            .await
            .map_err(to_jsonrpc_error)?;
        dispatch_result(response)
    }
}
