use super::{wire, Context, RuntimeCoreError};
use app_server_protocol::protocol::v2::CloudRequestMethod;
use serde::Deserialize;

#[derive(Deserialize)]
struct Mutation {
    id: String,
    enabled: bool,
    app_ids_needing_auth: Option<Vec<String>>,
}

impl Context<'_> {
    pub(crate) async fn install(
        &self,
        plugin_id: &str,
        attempt: Option<&str>,
    ) -> Result<Option<Vec<String>>, RuntimeCoreError> {
        self.mutate(plugin_id, true, attempt).await
    }

    pub(crate) async fn uninstall(&self, plugin_id: &str) -> Result<(), RuntimeCoreError> {
        self.mutate(plugin_id, false, None).await.map(|_| ())
    }

    async fn mutate(
        &self,
        plugin_id: &str,
        enabled: bool,
        attempt: Option<&str>,
    ) -> Result<Option<Vec<String>>, RuntimeCoreError> {
        wire::validate_remote_id(plugin_id)?;
        let suffix = if enabled {
            format!("{plugin_id}/install?includeAppsNeedingAuth=true")
        } else {
            format!("{plugin_id}/uninstall")
        };
        let body = attempt.map(|attempt| serde_json::json!({"install_attempt_id": attempt}));
        let response: Mutation = self
            .request(&suffix, CloudRequestMethod::Post, body)
            .await?;
        if response.id != plugin_id || response.enabled != enabled {
            return Err(RuntimeCoreError::Backend(
                "remote plugin mutation identity or enabled state does not match request".into(),
            ));
        }
        Ok(response.app_ids_needing_auth)
    }
}
