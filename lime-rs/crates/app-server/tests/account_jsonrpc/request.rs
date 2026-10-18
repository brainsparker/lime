use super::*;

async fn issuer(responses: Vec<(u16, Value, Option<String>)>) -> (String, JoinHandle<Vec<String>>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for (status, body, redirect) in responses {
            let (mut socket, _) =
                tokio::time::timeout(std::time::Duration::from_secs(30), listener.accept())
                    .await
                    .unwrap()
                    .unwrap();
            let mut bytes = Vec::new();
            let mut buffer = [0; 4096];
            loop {
                let count = socket.read(&mut buffer).await.unwrap();
                assert!(count > 0 && bytes.len() < 256 * 1024);
                bytes.extend_from_slice(&buffer[..count]);
                if let Some(end) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
                    let header = String::from_utf8_lossy(&bytes[..end]).to_ascii_lowercase();
                    let length: usize = header
                        .lines()
                        .find_map(|line| line.strip_prefix("content-length:").map(str::trim))
                        .unwrap_or("0")
                        .parse()
                        .unwrap();
                    if bytes.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            requests.push(String::from_utf8(bytes).unwrap());
            let body = body.to_string();
            let location = redirect
                .map(|url| format!("Location: {url}\r\n"))
                .unwrap_or_default();
            let _ = socket.write_all(format!("HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{location}\r\n{body}",body.len()).as_bytes()).await;
        }
        requests
    });
    (url, task)
}

async fn login(server: &AppServer, base_url: &str) {
    rpc(
        server,
        "account/login/start",
        Some(json!({
            "type":"cloudAuthTokens","baseUrl":base_url,"tenantId":"tenant-one","accessToken":TOKEN
        })),
    )
    .await;
}

#[tokio::test]
async fn cloud_http_uses_shared_credential_without_returning_it() {
    let (base_url, requests) = issuer(vec![
        (200, session("one"), None),
        (200, json!({"code":200,"data":{"session":{"token":TOKEN,"user":{"id":"one"}},"token":TOKEN,"catalog":["current"]}}), None),
        (200, json!({"code":200,"data":{"updated":true}}), None),
    ]).await;
    let root = TempDir::new().unwrap();
    let first = server(root.path()).await;
    login(&first, &base_url).await;
    let second = server(root.path()).await;
    let result = rpc(
        &second,
        "cloud/request",
        Some(json!({"path":"/v1/public/tenants/tenant-one/client/bootstrap","method":"GET"})),
    )
    .await;
    assert_eq!(result["status"], 200);
    assert_eq!(result["body"]["data"]["catalog"], json!(["current"]));
    assert!(result["body"]["data"]["session"].get("token").is_none());
    assert!(result["body"]["data"].get("token").is_none());
    rpc(&second,"cloud/request",Some(json!({"path":"/v1/public/tenants/tenant-one/client/provider-preferences","method":"PUT","body":{"providerKey":"current"}}))).await;
    let observed = requests.await.unwrap();
    assert_eq!(observed.len(), 3);
    assert!(
        observed[1].starts_with("GET /api/v1/public/tenants/tenant-one/client/bootstrap HTTP/1.1")
    );
    assert!(observed[2]
        .starts_with("PUT /api/v1/public/tenants/tenant-one/client/provider-preferences HTTP/1.1"));
    for request in &observed {
        assert!(request
            .to_ascii_lowercase()
            .contains(&format!("authorization: bearer {TOKEN}")));
    }
    assert!(observed[2].ends_with(r#"{"providerKey":"current"}"#));
    rpc(&first, "account/logout", None).await;
    let rejected = raw(
        &second,
        "cloud/request",
        Some(json!({"path":"/v1/public/tenants/tenant-one/client/bootstrap","method":"GET"})),
    )
    .await;
    assert!(rejected.get("error").is_some());
}

#[tokio::test]
async fn cloud_http_rejects_external_urls_tenant_escape_and_caller_credentials() {
    let (base_url, requests) = issuer(vec![(200, session("one"), None)]).await;
    let root = TempDir::new().unwrap();
    let server = server(root.path()).await;
    login(&server, &base_url).await;
    requests.await.unwrap();
    for path in [
        "https://other.example/api/v1/public/tenants/tenant-one/client/bootstrap",
        "//other.example/client/bootstrap",
        "/v1/public/tenants/other/client/bootstrap",
        "/v1/public/tenants/tenant-one/client/../../auth/password/login",
        "/v1/public/tenants/tenant-one/client/%2e%2e/other",
        "/v1/public/tenants/tenant-one/client/%2fother",
        "/v1/public/tenants/tenant-one/client/\\other",
        "/v1/public/tenants/tenant-one/client/bootstrap#fragment",
        "/v1/public/tenants/tenant-one/clientish/bootstrap",
    ] {
        let result = raw(
            &server,
            "cloud/request",
            Some(json!({"path":path,"method":"GET"})),
        )
        .await;
        assert!(result.get("error").is_some(), "{path}: {result}");
        assert!(
            !result.to_string().contains("cloud request failed"),
            "must reject before network"
        );
    }
    for extra in ["headers", "url", "accessToken"] {
        let mut params =
            json!({"path":"/v1/public/tenants/tenant-one/client/bootstrap","method":"GET"});
        params[extra] = json!("caller-owned-value");
        assert!(raw(&server, "cloud/request", Some(params))
            .await
            .get("error")
            .is_some());
    }
}

#[tokio::test]
async fn cloud_http_preserves_status_rejects_redirect_and_credential_echo() {
    let (base_url, requests) = issuer(vec![
        (200, session("one"), None),
        (401, json!({"code":401,"message":"session expired"}), None),
        (
            302,
            json!({}),
            Some("https://other.example/steal".to_string()),
        ),
        (200, json!({"code":200,"data":{"echo":TOKEN}}), None),
    ])
    .await;
    let root = TempDir::new().unwrap();
    let server = server(root.path()).await;
    login(&server, &base_url).await;
    let params = json!({"path":"/v1/public/tenants/tenant-one/client/bootstrap","method":"GET"});
    let unauthorized = rpc(&server, "cloud/request", Some(params.clone())).await;
    assert_eq!(unauthorized["status"], 401);
    let redirect = raw(&server, "cloud/request", Some(params.clone())).await;
    assert!(redirect["error"]["message"]
        .as_str()
        .unwrap()
        .contains("redirects are not allowed"));
    let echo = raw(&server, "cloud/request", Some(params)).await;
    assert!(echo["error"]["message"]
        .as_str()
        .unwrap()
        .contains("contains an account credential"));
    assert_eq!(requests.await.unwrap().len(), 4);
}

#[tokio::test]
async fn cloud_http_enforces_body_limit_and_expired_account() {
    let oversized = "x".repeat(4 * 1024 * 1024 + 1);
    let (base_url, requests) = issuer(vec![
        (200, session("one"), None),
        (200, json!({"data":oversized}), None),
    ])
    .await;
    let root = TempDir::new().unwrap();
    let server = server(root.path()).await;
    login(&server, &base_url).await;
    let params = json!({"path":"/v1/public/tenants/tenant-one/client/bootstrap","method":"GET"});
    let result = raw(&server, "cloud/request", Some(params.clone())).await;
    assert!(result["error"]["message"]
        .as_str()
        .unwrap()
        .contains("exceeds size limit"));
    requests.await.unwrap();
    let credential_path = root.path().join("credentials/account.json");
    let mut credential: Value =
        serde_json::from_slice(&std::fs::read(&credential_path).unwrap()).unwrap();
    credential["account"]["expiresAt"] = json!("2000-01-01T00:00:00Z");
    std::fs::write(&credential_path, serde_json::to_vec(&credential).unwrap()).unwrap();
    let expired = raw(&server, "cloud/request", Some(params)).await;
    assert!(expired["error"]["message"]
        .as_str()
        .unwrap()
        .contains("has expired"));
}

#[tokio::test]
async fn cloud_http_keeps_developer_tokens_and_rejects_escaped_account_credentials() {
    let credential = "fixture-account-\"quoted";
    let (base_url, requests) = issuer(vec![
        (200, session("one"), None),
        (
            200,
            json!({"code":200,"data":{"token":"developer-access-token"}}),
            None,
        ),
        (
            200,
            json!({"code":200,"data":{"nested":[credential]}}),
            None,
        ),
    ])
    .await;
    let root = TempDir::new().unwrap();
    let server = server(root.path()).await;
    rpc(&server, "account/login/start", Some(json!({
        "type":"cloudAuthTokens", "baseUrl":base_url, "tenantId":"tenant-one", "accessToken":credential
    }))).await;
    let params =
        json!({"path":"/v1/public/tenants/tenant-one/client/access-tokens", "method":"POST"});
    let response = rpc(&server, "cloud/request", Some(params.clone())).await;
    assert_eq!(response["body"]["data"]["token"], "developer-access-token");
    assert_eq!(response["account"]["userId"], "one");
    let response = raw(&server, "cloud/request", Some(params)).await;
    assert!(response["error"]["message"]
        .as_str()
        .unwrap()
        .contains("contains an account credential"));
    assert_eq!(requests.await.unwrap().len(), 3);
}
