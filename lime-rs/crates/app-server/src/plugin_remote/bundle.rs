use app_server_protocol::protocol::v2::Account;
use futures::StreamExt;
use reqwest::Url;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

pub(crate) const MAX_COMPRESSED_BYTES: u64 = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(60);

/// Signed bundle locations are internal inputs, never diagnostics or RPC results.
pub(crate) async fn download(
    location: &str,
    account: &Account,
) -> Result<tempfile::NamedTempFile, String> {
    download_with_limit(location, account, MAX_COMPRESSED_BYTES, DOWNLOAD_TIMEOUT).await
}

async fn download_with_limit(
    location: &str,
    account: &Account,
    max_bytes: u64,
    budget: Duration,
) -> Result<tempfile::NamedTempFile, String> {
    let Account::Cloud { base_url, .. } = account;
    let issuer = Url::parse(base_url).map_err(|_| "invalid plugin issuer URL")?;
    let loopback_origin =
        (issuer.scheme() == "http" && is_loopback(&issuer)).then(|| issuer.origin());
    let url = Url::parse(location).map_err(|_| "invalid plugin bundle URL")?;
    if !allowed(&url, loopback_origin.as_ref()) {
        return Err("unsupported plugin bundle URL".into());
    }
    let redirects_origin = loopback_origin.clone();
    // Do not let reqwest transparently decode an HTTP content encoding: the byte
    // budget and gzip CRC apply to the original archive, including on redirects.
    let builder = reqwest::Client::builder()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .timeout(budget)
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() >= 10 || !allowed(attempt.url(), redirects_origin.as_ref())
            {
                attempt.error("unsupported plugin bundle redirect")
            } else {
                attempt.follow()
            }
        }));
    let builder = if is_loopback(&url) {
        builder.no_proxy()
    } else {
        builder
    };
    let client = builder
        .build()
        .map_err(|_| "plugin bundle client unavailable")?;
    tokio::time::timeout(budget, async {
        // A bundle may be on a separate CDN. Account credentials never go there.
        let response = client
            .get(url)
            .header(reqwest::header::ACCEPT_ENCODING, "identity")
            .send()
            .await
            .map_err(|_| "plugin bundle download failed")?;
        if !response.status().is_success() {
            return Err(format!(
                "plugin bundle download failed (HTTP {})",
                response.status().as_u16()
            ));
        }
        if response
            .content_length()
            .is_some_and(|size| size > max_bytes)
        {
            return Err("plugin bundle exceeds compressed size limit".into());
        }
        let temporary = tempfile::NamedTempFile::new()
            .map_err(|_| "failed to create private plugin download")?;
        let mut file = tokio::fs::File::from_std(
            temporary
                .reopen()
                .map_err(|_| "failed to open private plugin download")?,
        );
        let mut bytes = 0u64;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|_| "failed to read plugin bundle")?;
            bytes = bytes
                .checked_add(chunk.len() as u64)
                .ok_or("plugin bundle exceeds compressed size limit")?;
            if bytes > max_bytes {
                return Err("plugin bundle exceeds compressed size limit".into());
            }
            file.write_all(&chunk)
                .await
                .map_err(|_| "failed to stage plugin bundle")?;
        }
        file.flush()
            .await
            .map_err(|_| "failed to finish private plugin download")?;
        Ok(temporary)
    })
    .await
    .map_err(|_| "plugin bundle download timed out".to_string())?
}

pub(super) fn allowed(url: &Url, loopback_origin: Option<&url::Origin>) -> bool {
    url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && (url.scheme() == "https"
            || (url.scheme() == "http"
                && loopback_origin == Some(&url.origin())
                && is_loopback(url)))
}

pub(super) fn is_loopback(url: &Url) -> bool {
    match url.host() {
        Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
        Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
        Some(url::Host::Domain(host)) => host == "localhost",
        None => false,
    }
}

#[cfg(test)]
mod tests;
