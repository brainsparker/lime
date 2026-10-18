use super::{cloud, store, AccountManager};
use app_server_protocol::protocol::v2::{
    Account, CloudRequestMethod, CloudRequestParams, CloudRequestResponse,
};
use futures::StreamExt;

const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;

impl AccountManager {
    pub(crate) async fn request(
        &self,
        params: CloudRequestParams,
    ) -> Result<CloudRequestResponse, String> {
        let credential = store::load(&self.path)?.ok_or("cloud account is not logged in")?;
        let Account::Cloud {
            base_url,
            tenant_id,
            expires_at,
            ..
        } = &credential.account;
        if let Some(expires_at) = expires_at {
            let expires = chrono::DateTime::parse_from_rfc3339(expires_at)
                .map_err(|_| "cloud account expiresAt is invalid")?;
            if expires <= chrono::Utc::now() {
                return Err("cloud account has expired".to_string());
            }
        }
        let (mut base, loopback) = cloud::validated_base_url(base_url)?;
        let base_path = base.path().trim_end_matches('/').to_string();
        base.path_segments_mut()
            .map_err(|_| "cloud account URL cannot be a base")?
            .pop_if_empty()
            .extend(["api", "v1", "public", "tenants", tenant_id, "client", ""]);
        let prefix = base.path().to_string();
        // Encoded separators in an opaque query cursor do not alter the URL path.
        let lowered = params
            .path
            .split('?')
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        if !params.path.starts_with('/')
            || params.path.starts_with("//")
            || params.path.contains(['\\', '#'])
            || params.path.chars().any(char::is_control)
            || ["%2f", "%5c", "%2e"]
                .iter()
                .any(|part| lowered.contains(part))
        {
            return Err("cloud request path is invalid".to_string());
        }
        let url = reqwest::Url::parse(&format!("{base_url}/api{}", params.path))
            .map_err(|_| "cloud request URL is invalid")?;
        if url.origin() != base.origin()
            || !url.path().starts_with(&prefix)
            || !url.path().starts_with(&format!("{base_path}/api/"))
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err(
                "cloud request must target the current account tenant client API".to_string(),
            );
        }
        let method = match params.method {
            CloudRequestMethod::Get => reqwest::Method::GET,
            CloudRequestMethod::Post => reqwest::Method::POST,
            CloudRequestMethod::Put => reqwest::Method::PUT,
            CloudRequestMethod::Delete => reqwest::Method::DELETE,
        };
        if method == reqwest::Method::GET && params.body.is_some() {
            return Err("cloud GET request cannot include a body".to_string());
        }
        let client = if loopback {
            &self.loopback_client
        } else {
            &self.client
        };
        let mut request = client
            .request(method, url.clone())
            .header(reqwest::header::ACCEPT, "application/json")
            .bearer_auth(&credential.access_token);
        if let Some(body) = params.body {
            let bytes = serde_json::to_vec(&body).map_err(|_| "cloud request body is invalid")?;
            if bytes.len() > MAX_BODY_BYTES {
                return Err("cloud request body exceeds size limit".to_string());
            }
            request = request
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(bytes);
        }
        let response = request.send().await.map_err(|_| "cloud request failed")?;
        let status = response.status().as_u16();
        if response.status().is_redirection() {
            return Err("cloud request redirects are not allowed".to_string());
        }
        let mut bytes = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|_| "failed to read cloud response")?;
            if bytes.len().saturating_add(chunk.len()) > MAX_BODY_BYTES {
                return Err("cloud response exceeds size limit".to_string());
            }
            bytes.extend_from_slice(&chunk);
        }
        let mut body: serde_json::Value = if bytes.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&bytes).map_err(|_| "cloud response is not JSON")?
        };
        // Session/bootstrap metadata may include the issuer's login token. It stays in this owner.
        if matches!(url.path().rsplit('/').next(), Some("session" | "bootstrap")) {
            if let Some(data) = body.get_mut("data") {
                if let Some(session) = data
                    .get_mut("session")
                    .and_then(|value| value.as_object_mut())
                {
                    session.remove("token");
                }
                if let Some(data) = data.as_object_mut() {
                    data.remove("token");
                    data.remove("sessionToken");
                }
            }
        }
        if contains_credential(&body, &credential.access_token) {
            return Err("cloud response contains an account credential".to_string());
        }
        Ok(CloudRequestResponse {
            account: credential.account,
            status,
            body,
        })
    }
}

fn contains_credential(value: &serde_json::Value, credential: &str) -> bool {
    match value {
        serde_json::Value::String(text) => text.contains(credential),
        serde_json::Value::Array(values) => values
            .iter()
            .any(|value| contains_credential(value, credential)),
        serde_json::Value::Object(values) => values
            .iter()
            .any(|(key, value)| key.contains(credential) || contains_credential(value, credential)),
        _ => false,
    }
}
