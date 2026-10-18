mod cloud;
mod request;
mod store;

use app_server_protocol::protocol::v2::{
    GetAccountParams, GetAccountResponse, LoginAccountParams, LoginAccountResponse,
    LogoutAccountResponse,
};
use std::path::{Path, PathBuf};

/// Shared external-account owner. Credentials never leave this domain in RPC results.
#[derive(Debug)]
pub(crate) struct AccountManager {
    path: PathBuf,
    client: reqwest::Client,
    loopback_client: reqwest::Client,
}

impl AccountManager {
    pub(crate) fn new(app_data_root: &Path) -> Self {
        Self {
            path: app_data_root.join("credentials").join("account.json"),
            client: session_client(false),
            loopback_client: session_client(true),
        }
    }

    pub(crate) async fn login(
        &self,
        params: LoginAccountParams,
    ) -> Result<LoginAccountResponse, String> {
        match params {
            LoginAccountParams::CloudAuthTokens {
                base_url,
                tenant_id,
                access_token,
            } => {
                let credential = cloud::verify(
                    &self.client,
                    &self.loopback_client,
                    base_url,
                    tenant_id,
                    access_token,
                )
                .await?;
                store::save(&self.path, &credential)?;
                Ok(LoginAccountResponse::CloudAuthTokens {})
            }
        }
    }

    pub(crate) fn read(&self, _params: GetAccountParams) -> Result<GetAccountResponse, String> {
        // External tokens are refreshed by their issuer and reimported by the client.
        // Read from the shared file each time so other processes observe login/logout.
        Ok(GetAccountResponse {
            account: store::load(&self.path)?.map(|credential| credential.account),
            requires_openai_auth: false,
        })
    }

    pub(crate) fn logout(&self) -> Result<LogoutAccountResponse, String> {
        store::delete(&self.path)?;
        Ok(LogoutAccountResponse {})
    }

    /// Stable package provenance excludes tokens, session rotation and profile fields.
    pub(crate) fn plugin_identity(&self) -> Result<Option<String>, String> {
        let Some(account) = self.read(GetAccountParams::default())?.account else {
            return Ok(None);
        };
        let app_server_protocol::protocol::v2::Account::Cloud { expires_at, .. } = &account;
        if let Some(expires_at) = expires_at {
            let expires = chrono::DateTime::parse_from_rfc3339(expires_at)
                .map_err(|_| "cloud account expiresAt is invalid")?;
            if expires <= chrono::Utc::now() {
                return Ok(None);
            }
        }
        Ok(Some(Self::plugin_identity_for(&account)))
    }

    pub(crate) fn plugin_identity_for(
        account: &app_server_protocol::protocol::v2::Account,
    ) -> String {
        use sha2::{Digest, Sha256};
        let app_server_protocol::protocol::v2::Account::Cloud {
            base_url,
            tenant_id,
            user_id,
            ..
        } = account;
        let mut hash = Sha256::new();
        for part in [base_url, tenant_id, user_id] {
            hash.update((part.len() as u64).to_be_bytes());
            hash.update(part.as_bytes());
        }
        hex::encode(hash.finalize())
    }
}

fn session_client(loopback: bool) -> reqwest::Client {
    let builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(15));
    // A local issuer must stay local even when the OS configures a system proxy.
    let builder = if loopback {
        builder.no_proxy()
    } else {
        builder
    };
    builder.build().expect("account HTTP client configuration")
}
