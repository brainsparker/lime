use app_server_protocol::protocol::v2::{
    MarketplaceAddParams, MarketplaceAddResponse,
    MarketplaceRemoveParams, MarketplaceRemoveResponse,
    MarketplaceUpgradeParams, MarketplaceUpgradeResponse
};
use super::RuntimeCore;
use super::RuntimeCoreError;
use app_server_protocol::protocol::v2::{
    AppsInstalledParams, AppsInstalledResponse, AppsListParams, AppsListResponse, AppsReadParams,
    AppsReadResponse, PluginInstallParams, PluginInstallResponse, PluginInstalledParams,
    PluginInstalledResponse, PluginListParams, PluginListResponse, PluginReadParams,
    PluginReadResponse, PluginSearchParams, PluginSearchResponse, PluginUninstallParams,
    PluginUninstallResponse,
};

impl RuntimeCore {
    pub async fn add_marketplace(&self, params: MarketplaceAddParams) -> Result<MarketplaceAddResponse, RuntimeCoreError> {
        self.app_data_source.add_marketplace(params).await
    }

    pub async fn remove_marketplace(&self, params: MarketplaceRemoveParams) -> Result<MarketplaceRemoveResponse, RuntimeCoreError> {
        self.app_data_source.remove_marketplace(params).await
    }

    pub async fn upgrade_marketplace(&self, params: MarketplaceUpgradeParams) -> Result<MarketplaceUpgradeResponse, RuntimeCoreError> {
        self.app_data_source.upgrade_marketplace(params).await
    }

    pub(crate) async fn invalidate_plugin_components(&self) {
        self.backend.invalidate_mcp_runtimes().await;
    }

    pub(crate) async fn plugin_skill_roots(
        &self,
    ) -> Result<Vec<lime_skills::AgentSkillRoot>, RuntimeCoreError> {
        Ok(self
            .app_data_source
            .list_enabled_plugin_turn_snapshots()
            .await?
            .iter()
            .flat_map(super::PluginTurnSnapshot::skill_roots)
            .collect())
    }

    pub async fn list_apps(
        &self,
        params: AppsListParams,
    ) -> Result<AppsListResponse, RuntimeCoreError> {
        self.ensure_optional_apps_thread_loaded(params.thread_id.as_deref())?;
        self.app_data_source.list_apps(params).await
    }

    pub async fn read_apps(
        &self,
        params: AppsReadParams,
    ) -> Result<AppsReadResponse, RuntimeCoreError> {
        self.app_data_source.read_apps(params).await
    }

    pub async fn list_installed_apps(
        &self,
        params: AppsInstalledParams,
    ) -> Result<AppsInstalledResponse, RuntimeCoreError> {
        self.ensure_optional_apps_thread_loaded(params.thread_id.as_deref())?;
        self.app_data_source.list_installed_apps(params).await
    }

    fn ensure_optional_apps_thread_loaded(
        &self,
        thread_id: Option<&str>,
    ) -> Result<(), RuntimeCoreError> {
        let Some(thread_id) = thread_id else {
            return Ok(());
        };
        let thread_id = thread_id.trim();
        if thread_id.is_empty() || self.loaded_session_id_for_thread(thread_id).is_none() {
            return Err(RuntimeCoreError::SessionNotFound(thread_id.to_string()));
        }
        Ok(())
    }

    pub async fn list_plugins(
        &self,
        params: PluginListParams,
    ) -> Result<PluginListResponse, RuntimeCoreError> {
        self.app_data_source.list_plugins(params).await
    }

    pub async fn search_plugins(
        &self,
        params: PluginSearchParams,
    ) -> Result<PluginSearchResponse, RuntimeCoreError> {
        self.app_data_source.search_plugins(params).await
    }

    pub async fn read_plugin(
        &self,
        params: PluginReadParams,
    ) -> Result<PluginReadResponse, RuntimeCoreError> {
        self.app_data_source.read_plugin(params).await
    }

    pub async fn install_plugin(
        &self,
        params: PluginInstallParams,
    ) -> Result<PluginInstallResponse, RuntimeCoreError> {
        self.backend.invalidate_mcp_runtimes().await;
        self.app_data_source.install_plugin(params).await
    }

    pub async fn uninstall_plugin(
        &self,
        params: PluginUninstallParams,
    ) -> Result<PluginUninstallResponse, RuntimeCoreError> {
        self.backend.invalidate_mcp_runtimes().await;
        self.app_data_source.uninstall_plugin(params).await
    }

    pub async fn list_installed_plugins(
        &self,
        params: PluginInstalledParams,
    ) -> Result<PluginInstalledResponse, RuntimeCoreError> {
        self.app_data_source.list_installed_plugins(params).await
    }
}
