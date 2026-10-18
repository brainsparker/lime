use super::share::MAX_SHARE_BYTES;
use super::{bundle, Context};
use crate::runtime::RuntimeCoreError;
use app_server_protocol::protocol::v2::Account;
use reqwest::Url;
use std::time::Duration;

pub(super) fn validate_url(location: &str, account: &Account) -> Result<Url, RuntimeCoreError> {
    let Account::Cloud { base_url, .. } = account;
    let issuer = Url::parse(base_url).map_err(|_| invalid("invalid plugin issuer URL"))?;
    let loopback_origin =
        (issuer.scheme() == "http" && bundle::is_loopback(&issuer)).then(|| issuer.origin());
    let url = Url::parse(location).map_err(|_| invalid("invalid plugin share URL"))?;
    if !bundle::allowed(&url, loopback_origin.as_ref()) {
        return Err(invalid("unsupported plugin share URL"));
    }
    Ok(url)
}

impl Context<'_> {
    pub(super) async fn upload_share(
        &self,
        location: &str,
        bytes: Vec<u8>,
    ) -> Result<(), RuntimeCoreError> {
        self.ensure_current()?;
        if bytes.is_empty() || bytes.len() > MAX_SHARE_BYTES {
            return Err(invalid("plugin share exceeds archive size limit"));
        }
        let url = validate_url(location, &self.account)?;
        let budget = Duration::from_secs(30);
        let builder = reqwest::Client::builder()
            .timeout(budget)
            .redirect(reqwest::redirect::Policy::none());
        let builder = if bundle::is_loopback(&url) {
            builder.no_proxy()
        } else {
            builder
        };
        let client = builder
            .build()
            .map_err(|_| invalid("plugin share upload client unavailable"))?;
        let response = tokio::time::timeout(
            budget,
            client
                .put(url)
                .header(reqwest::header::CONTENT_TYPE, "application/gzip")
                .header("x-ms-blob-type", "BlockBlob")
                .body(bytes)
                .send(),
        )
        .await
        .map_err(|_| invalid("plugin share upload timed out"))?
        .map_err(|_| invalid("plugin share upload failed"))?;
        self.ensure_current()?;
        if response.status().as_u16() != 200 && response.status().as_u16() != 201 {
            return Err(invalid(&format!(
                "plugin share upload failed (HTTP {})",
                response.status().as_u16()
            )));
        }
        Ok(())
    }
}

fn invalid(message: &str) -> RuntimeCoreError {
    RuntimeCoreError::Backend(message.into())
}
