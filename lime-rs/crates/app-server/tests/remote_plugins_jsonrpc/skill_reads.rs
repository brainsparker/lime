use super::support::*;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;

fn params(name: &str) -> Option<Value> {
    Some(json!({
        "remoteMarketplaceName":"workspace-directory",
        "remotePluginId":"opaque~1",
        "skillName":name
    }))
}

#[tokio::test]
async fn reads_uninstalled_skill_without_normalizing_raw_contents_and_encodes_segments() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let name = "research + 中文";
    let contents = "---\r\nname: research\r\n---\r\n# Research\r\n\r\nRaw body.\r\n";
    let (url, task) = issuer(vec![
        ok(session("one")),
        ok(json!({"plugin_id":"opaque~1","name":name,"skill_md_contents":contents})),
        ok(json!({"plugin_id":"opaque~1","name":name,"skill_md_contents":null})),
        ok(json!({"plugin_id":"opaque~1","name":name,"skill_md_contents":""})),
    ])
    .await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    for contents in [json!(contents), Value::Null, json!("")] {
        assert_eq!(
            rpc(&server, "plugin/skill/read", params(name)).await,
            json!({"contents":contents})
        );
    }
    assert!(
        rpc(&server, "plugin/installed", Some(json!({}))).await["marketplaces"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let requests = finish(task).await;
    assert_eq!(
        requests.len(),
        4,
        "skill reads must not install, list, or download the package"
    );
    for request in &requests[1..] {
        assert!(request.starts_with("GET /api/v1/public/tenants/tenant-one/client/ps/plugins/opaque~1/skills/research%20%2B%20%E4%B8%AD%E6%96%87?includeDownloadUrls=false HTTP/1.1"), "{request}");
    }
}

#[tokio::test]
async fn rejects_missing_auth_invalid_identity_http_and_malformed_service_responses() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    assert!(
        raw(&server, "plugin/skill/read", params("research")).await["error"]["message"]
            .as_str()
            .unwrap()
            .contains("authentication required")
    );
    for field in ["remoteMarketplaceName", "remotePluginId", "skillName"] {
        let mut request = params("research").unwrap();
        request[field] = json!("");
        assert!(
            raw(&server, "plugin/skill/read", Some(request))
                .await
                .get("error")
                .is_some(),
            "invalid {field}"
        );
    }
    let (url, task) = issuer(vec![
        ok(session("one")),
        (404, json!({"message":BUNDLE}), String::new()),
        (500, json!({"message":BUNDLE}), String::new()),
        ok(json!({"plugin_id":"other","name":"research","skill_md_contents":"wrong-plugin-body"})),
        ok(json!({"plugin_id":"opaque~1","name":"other","skill_md_contents":"wrong-skill-body"})),
        ok(json!({"plugin_id":"opaque~1","name":"research","skill_md_contents":42})),
        ok(json!({"plugin_id":"opaque~1","name":"research","skill_md_contents":"recovered"})),
    ])
    .await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    for expected in [
        "HTTP 404",
        "HTTP 500",
        "identity",
        "identity",
        "invalid remote plugin service response",
    ] {
        let response = raw(&server, "plugin/skill/read", params("research")).await;
        assert!(
            response["error"]["message"]
                .as_str()
                .unwrap()
                .contains(expected),
            "{response}"
        );
        assert!(!response.to_string().contains("wrong-plugin-body"));
        assert!(!response.to_string().contains("wrong-skill-body"));
    }
    assert_eq!(
        rpc(&server, "plugin/skill/read", params("research")).await,
        json!({"contents":"recovered"})
    );
    finish(task).await;
}

#[tokio::test]
async fn peer_logout_or_switch_rejects_late_skill_contents() {
    for switch in [false, true] {
        let temp = TempDir::new().unwrap();
        let first = Arc::new(server(temp.path()).await);
        let peer = server(temp.path()).await;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let (entered, request_entered) = tokio::sync::oneshot::channel();
        let (release, released) = tokio::sync::oneshot::channel();
        let http = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            receive(&mut socket).await;
            respond(&mut socket, session("old")).await;
            let (mut socket, _) = listener.accept().await.unwrap();
            let request = receive(&mut socket).await;
            assert!(request.contains("/skills/research?"));
            entered.send(()).unwrap();
            released.await.unwrap();
            respond(&mut socket, json!({"plugin_id":"opaque~1","name":"research","skill_md_contents":"stale-private-contents"})).await;
        });
        rpc(&first, "account/login/start", Some(login(&url))).await;
        let querying = first.clone();
        let pending =
            tokio::spawn(
                async move { raw(&querying, "plugin/skill/read", params("research")).await },
            );
        tokio::time::timeout(Duration::from_secs(10), request_entered)
            .await
            .unwrap()
            .unwrap();
        if switch {
            let (url, task) = issuer(vec![ok(session("new"))]).await;
            rpc(&peer, "account/login/start", Some(login(&url))).await;
            finish(task).await;
        } else {
            rpc(&peer, "account/logout", None).await;
        }
        release.send(()).unwrap();
        let response = pending.await.unwrap();
        assert!(response.get("error").is_some(), "{response}");
        assert!(!response.to_string().contains("stale-private-contents"));
        http.await.unwrap();
    }
}

#[tokio::test]
async fn current_codex_release_fields_accept_missing_keywords_alias_and_null_prompts() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let mut plugin = item("opaque~1", "research");
    let release = plugin["release"].as_object_mut().unwrap();
    release.remove("keywords");
    let templates = release.remove("app_templates").unwrap();
    release.insert("unavailable_app_templates".into(), templates);
    release.get_mut("interface").unwrap()["default_prompts"] = Value::Null;
    let (url, task) = issuer(vec![ok(session("one")), ok(plugin), ok(page(vec![], None))]).await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    let response = rpc(&server, "plugin/read", detail("opaque~1")).await;
    assert_eq!(response["plugin"]["summary"]["keywords"], json!([]));
    assert_eq!(
        response["plugin"]["summary"]["interface"]["defaultPrompt"],
        json!(["Fallback"])
    );
    assert_eq!(
        response["plugin"]["appTemplates"][0]["templateId"],
        "template-1"
    );
    finish(task).await;
}

#[tokio::test]
async fn unresponsive_skill_service_terminates_with_error_instead_of_empty_success() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let (release, released) = tokio::sync::oneshot::channel();
    let http = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        receive(&mut socket).await;
        respond(&mut socket, session("one")).await;
        let (mut socket, _) = listener.accept().await.unwrap();
        assert!(receive(&mut socket).await.contains("/skills/research?"));
        released.await.unwrap();
    });
    rpc(&server, "account/login/start", Some(login(&url))).await;
    let response = tokio::time::timeout(
        Duration::from_secs(20),
        raw(&server, "plugin/skill/read", params("research")),
    )
    .await
    .expect("shared HTTP timeout must terminate the skill RPC");
    assert!(
        response["error"]["message"]
            .as_str()
            .unwrap()
            .contains("cloud request failed"),
        "{response}"
    );
    assert!(response.get("result").is_none());
    release.send(()).unwrap();
    http.await.unwrap();
}
