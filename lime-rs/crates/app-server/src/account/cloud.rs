use super::store::Credential;
use app_server_protocol::protocol::v2::Account;
use futures::StreamExt;
use serde::Deserialize;

const MAX_RESPONSE_BYTES: usize = 1024 * 1024;

#[derive(Deserialize)]
struct Envelope {
    code: i64,
    data: Session,
}

#[derive(Deserialize)]
struct Session {
    tenant: Tenant,
    user: User,
    session: UserSession,
}

#[derive(Deserialize)]
struct Tenant {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct User {
    id: String,
    email: Option<String>,
    display_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserSession {
    id: String,
    tenant_id: String,
    user_id: String,
    expires_at: Option<String>,
}

pub(super) async fn verify(
    client: &reqwest::Client,
    loopback_client: &reqwest::Client,
    base_url: String,
    tenant_id: String,
    access_token: String,
) -> Result<Credential, String> {
    let (mut base, loopback) = validated_base_url(&base_url)?;
    let tenant_id = tenant_id.trim();
    let access_token = access_token.trim();
    if tenant_id.is_empty()
        || tenant_id.len() > 256
        || tenant_id.chars().any(char::is_control)
        || access_token.is_empty()
        || access_token.len() > 64 * 1024
        || access_token.chars().any(char::is_control)
    {
        return Err("account tenantId or accessToken is invalid".to_string());
    }
    let base_path = base.path().trim_end_matches('/').to_string();
    base.set_path(&base_path);
    let normalized_base = base.as_str().trim_end_matches('/').to_string();
    base.path_segments_mut()
        .map_err(|_| "account baseUrl cannot be a base URL")?
        .pop_if_empty()
        .extend([
            "api", "v1", "public", "tenants", tenant_id, "client", "session",
        ]);
    let client = if loopback { loopback_client } else { client };
    let response = client
        .get(base)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| "account session verification request failed")?;
    if !response.status().is_success() {
        return Err(format!(
            "account session verification returned HTTP {}",
            response.status().as_u16()
        ));
    }
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "failed to read account session response")?;
        if bytes.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err("account session response exceeds size limit".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    let envelope: Envelope =
        serde_json::from_slice(&bytes).map_err(|_| "account session response is invalid")?;
    if envelope.code != 200 {
        return Err("account session verification was rejected".to_string());
    }
    let Session {
        tenant,
        user,
        session,
    } = envelope.data;
    if tenant.id != tenant_id
        || session.tenant_id != tenant_id
        || user.id.is_empty()
        || session.user_id != user.id
        || session.id.is_empty()
    {
        return Err(
            "account session identity does not match the requested tenant/user".to_string(),
        );
    }
    if let Some(expires_at) = &session.expires_at {
        let expires = chrono::DateTime::parse_from_rfc3339(expires_at)
            .map_err(|_| "account session expiresAt is invalid")?;
        if expires <= chrono::Utc::now() {
            return Err("account session has expired".to_string());
        }
    }
    Ok(Credential {
        account: Account::Cloud {
            base_url: normalized_base,
            tenant_id: tenant.id,
            user_id: user.id,
            session_id: session.id,
            email: user.email,
            display_name: user.display_name,
            expires_at: session.expires_at,
        },
        access_token: access_token.to_string(),
    })
}

pub(super) fn validated_base_url(value: &str) -> Result<(reqwest::Url, bool), String> {
    let base = reqwest::Url::parse(value.trim()).map_err(|_| "account baseUrl is invalid")?;
    let loopback = base.host_str().is_some_and(|host| {
        host.eq_ignore_ascii_case("localhost")
            || host
                .trim_matches(['[', ']'])
                .parse::<std::net::IpAddr>()
                .is_ok_and(|address| address.is_loopback())
    });
    if !(base.scheme() == "https" || base.scheme() == "http" && loopback)
        || base.host_str().is_none()
        || !base.username().is_empty()
        || base.password().is_some()
        || base.query().is_some()
        || base.fragment().is_some()
    {
        return Err("account baseUrl requires HTTPS or loopback HTTP without credentials, query or fragment".to_string());
    }
    Ok((base, loopback))
}
