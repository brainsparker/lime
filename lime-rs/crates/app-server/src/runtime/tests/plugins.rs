use super::*;
use app_server_protocol::protocol::v2::{PluginUninstallParams, PluginUninstallResponse};
use async_trait::async_trait;
use std::sync::Mutex as StdMutex;

#[derive(Clone)]
struct PluginLifecycleBackend {
    events: Arc<StdMutex<Vec<&'static str>>>,
}

#[async_trait]
impl ExecutionBackend for PluginLifecycleBackend {
    async fn start_turn(
        &self,
        _request: ExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }

    async fn cancel_turn(
        &self,
        _request: CancelExecutionRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }

    async fn invalidate_mcp_runtimes(&self) {
        self.events
            .lock()
            .expect("plugin lifecycle events mutex poisoned")
            .push("invalidate");
    }

    async fn respond_action(
        &self,
        _request: ActionRespondRequest,
        _sink: &mut dyn RuntimeEventSink,
    ) -> Result<(), RuntimeCoreError> {
        Ok(())
    }
}

struct PluginLifecycleDataSource {
    events: Arc<StdMutex<Vec<&'static str>>>,
}

impl SessionAppDataSource for PluginLifecycleDataSource {}
impl WorkspaceAppDataSource for PluginLifecycleDataSource {}
impl SkillAppDataSource for PluginLifecycleDataSource {}
impl WorkspaceSkillBindingAppDataSource for PluginLifecycleDataSource {}
impl GatewayAppDataSource for PluginLifecycleDataSource {}
impl MediaAppDataSource for PluginLifecycleDataSource {}
impl VoiceAppDataSource for PluginLifecycleDataSource {}

#[async_trait]
impl PluginDataSource for PluginLifecycleDataSource {
    async fn uninstall_plugin(
        &self,
        _params: PluginUninstallParams,
    ) -> Result<PluginUninstallResponse, RuntimeCoreError> {
        self.events
            .lock()
            .expect("plugin lifecycle events mutex poisoned")
            .push("uninstall");
        Ok(PluginUninstallResponse {})
    }
}

impl KnowledgeAppDataSource for PluginLifecycleDataSource {}
impl AutomationOverviewAppDataSource for PluginLifecycleDataSource {}
impl McpAppDataSource for PluginLifecycleDataSource {}
impl AutomationManagementAppDataSource for PluginLifecycleDataSource {}
impl MemoryAppDataSource for PluginLifecycleDataSource {}
impl DiagnosticsAppDataSource for PluginLifecycleDataSource {}
impl UsageStatsAppDataSource for PluginLifecycleDataSource {}
impl ModelProviderAppDataSource for PluginLifecycleDataSource {}
impl ConnectAppDataSource for PluginLifecycleDataSource {}
impl RightSurfaceAppDataSource for PluginLifecycleDataSource {}

#[tokio::test]
async fn plugin_uninstall_invalidates_mcp_runtimes_before_removing_package() {
    let events = Arc::new(StdMutex::new(Vec::new()));
    let core = RuntimeCore::with_backend(Arc::new(PluginLifecycleBackend {
        events: Arc::clone(&events),
    }))
    .with_app_data_source(Arc::new(PluginLifecycleDataSource {
        events: Arc::clone(&events),
    }));

    let response = core
        .uninstall_plugin(PluginUninstallParams {
            plugin_id: "mcp-elicitation-plugin@local".to_string(),
        })
        .await
        .expect("plugin uninstall");

    assert_eq!(
        serde_json::to_value(response).unwrap(),
        serde_json::json!({})
    );
    assert_eq!(
        *events
            .lock()
            .expect("plugin lifecycle events mutex poisoned"),
        vec!["invalidate", "uninstall"]
    );
}
