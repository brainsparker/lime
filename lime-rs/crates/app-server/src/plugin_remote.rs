use crate::runtime::RuntimeCoreError;
use app_server_protocol::protocol::v2::{
    Account, CloudRequestMethod, CloudRequestParams, GetAccountParams,
};
use serde::de::DeserializeOwned;

pub(crate) mod bundle;
mod installed;
pub(crate) use installed::Installed;
mod mutation;
pub(crate) mod share;
mod upload;
pub(crate) mod wire;

pub(crate) struct Context<'a> {
    manager: &'a crate::account::AccountManager,
    pub(crate) account: Account,
}

impl<'a> Context<'a> {
    pub(crate) fn current(
        manager: Option<&'a crate::account::AccountManager>,
    ) -> Result<Option<Self>, RuntimeCoreError> {
        let Some(manager) = manager else {
            return Ok(None);
        };
        Ok(manager
            .read(GetAccountParams::default())
            .map_err(RuntimeCoreError::Backend)?
            .account
            .map(|account| Self { manager, account }))
    }

    pub(crate) fn ensure_current(&self) -> Result<(), RuntimeCoreError> {
        let current = self
            .manager
            .read(GetAccountParams::default())
            .map_err(RuntimeCoreError::Backend)?;
        if current.account.as_ref() != Some(&self.account) {
            return Err(RuntimeCoreError::InvalidRequest(
                "account changed while fetching remote plugins".to_string(),
            ));
        }
        Ok(())
    }

    pub(crate) async fn get<T: DeserializeOwned>(
        &self,
        suffix: &str,
    ) -> Result<T, RuntimeCoreError> {
        self.request(suffix, CloudRequestMethod::Get, None).await
    }

    async fn request<T: DeserializeOwned>(
        &self,
        suffix: &str,
        method: CloudRequestMethod,
        body: Option<serde_json::Value>,
    ) -> Result<T, RuntimeCoreError> {
        self.client_request(&format!("ps/plugins/{suffix}"), method, body)
            .await
    }

    async fn client_request<T: DeserializeOwned>(
        &self,
        client_path: &str,
        method: CloudRequestMethod,
        body: Option<serde_json::Value>,
    ) -> Result<T, RuntimeCoreError> {
        let response = self.client_response(client_path, method, body).await?;
        serde_json::from_value(response.body).map_err(|_| {
            RuntimeCoreError::Backend("invalid remote plugin service response".to_string())
        })
    }

    async fn client_response(
        &self,
        client_path: &str,
        method: CloudRequestMethod,
        body: Option<serde_json::Value>,
    ) -> Result<app_server_protocol::protocol::v2::CloudRequestResponse, RuntimeCoreError> {
        self.ensure_current()?;
        let Account::Cloud { tenant_id, .. } = &self.account;
        let response = self
            .manager
            .request(CloudRequestParams {
                path: format!(
                    "/v1/public/tenants/{}/client/{client_path}",
                    urlencoding::encode(tenant_id)
                ),
                method,
                body,
            })
            .await
            .map_err(RuntimeCoreError::Backend)?;
        self.ensure_current()?;
        if response.account != self.account {
            return Err(RuntimeCoreError::InvalidRequest(
                "remote plugin response belongs to another account".to_string(),
            ));
        }
        if !(200..300).contains(&response.status) {
            // Issuer error bodies and signed bundle URLs do not belong in RPC diagnostics.
            return Err(RuntimeCoreError::Backend(format!(
                "remote plugin request failed (HTTP {})",
                response.status
            )));
        }
        Ok(response)
    }
}
