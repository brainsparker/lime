use super::support::*;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;

#[tokio::test]
async fn remote_detail_uses_authorized_scope_and_defaults_uninstalled_skills_to_enabled() {
    for (scope, marketplace) in [
        ("WORKSPACE", "workspace-directory"),
        ("GLOBAL", "openai-curated-remote"),
        ("USER", "created-by-me-remote"),
    ] {
        let temp = TempDir::new().unwrap();
        let app = server(temp.path()).await;
        let mut plugin = item("opaque~detail", "research");
        plugin["scope"] = json!(scope);
        let (url, task) =
            issuer(vec![ok(session("one")), ok(plugin), ok(page(vec![], None))]).await;
        rpc(&app, "account/login/start", Some(login(&url))).await;
        let detail = rpc(
            &app,
            "plugin/read",
            Some(json!({
                "remoteMarketplaceName":"caller-label-is-not-authoritative",
                "pluginName":"opaque~detail"
            })),
        )
        .await;
        let plugin = &detail["plugin"];
        assert_eq!(plugin["marketplaceName"], marketplace);
        assert_eq!(plugin["summary"]["installed"], false);
        assert_eq!(plugin["skills"][0]["name"], "research");
        assert_eq!(plugin["skills"][0]["path"], Value::Null);
        assert_eq!(plugin["skills"][0]["enabled"], true);
        assert_eq!(plugin["onboardingSkill"], Value::Null);
        assert!(!temp.path().join("agent/plugins/cache").exists());
        let requests = finish(task).await;
        assert!(requests[2].starts_with("GET /api/v1/public/tenants/tenant-one/client/ps/plugins/installed?limit=200&includeDownloadUrls=false "));
    }
}

#[tokio::test]
async fn remote_detail_pages_fresh_preferences_and_installation_without_materializing_or_publishing(
) {
    let temp = TempDir::new().unwrap();
    let app = server(temp.path()).await;
    let mut plugin = item("opaque~detail", "research");
    plugin["release"]["skills"]
        .as_array_mut()
        .unwrap()
        .push(json!({"name":"writer","description":"Write"}));
    let mut installed = plugin.clone();
    installed["release"]["version"] = json!("0.9.0");
    installed["enabled"] = json!(true);
    installed["installed_at"] = json!("2026-01-01T00:00:00Z");
    installed["disabled_skill_names"] = json!(["research"]);
    let mut changed = installed.clone();
    changed["disabled_skill_names"] = json!(["writer"]);
    let (url, task) = issuer(vec![
        ok(session("one")),
        ok(plugin.clone()),
        ok(page(vec![], Some("next+/="))),
        ok(page(vec![installed], None)),
        ok(plugin),
        ok(page(vec![changed], None)),
    ])
    .await;
    rpc(&app, "account/login/start", Some(login(&url))).await;
    let first = rpc(&app, "plugin/read", detail("opaque~detail")).await;
    let p = &first["plugin"];
    assert_eq!(p["summary"]["installed"], true);
    assert_eq!(p["summary"]["version"], "1.2.3");
    assert_eq!(p["summary"]["localVersion"], "0.9.0");
    assert_eq!(p["summary"]["installedAt"], 1767225600_i64);
    assert_eq!(p["skills"][0]["enabled"], false);
    assert_eq!(p["skills"][1]["enabled"], true);
    assert_eq!(p["onboardingSkill"], Value::Null);
    let second = rpc(&app, "plugin/read", detail("opaque~detail")).await;
    assert_eq!(second["plugin"]["skills"][0]["enabled"], true);
    assert_eq!(second["plugin"]["skills"][1]["enabled"], false);
    assert_eq!(second["plugin"]["onboardingSkill"]["name"], "research");
    assert_eq!(
        rpc(&app, "plugin/installed", Some(json!({}))).await["marketplaces"],
        json!([])
    );
    assert!(!temp.path().join("agent/plugins/cache").exists());
    assert!(!temp.path().join("agent/plugins/remote-state").exists());
    let requests = finish(task).await;
    assert!(requests[3].contains("pageToken=next%2B%2F%3D"));
    assert!(requests
        .iter()
        .all(|request| !request.contains("includeDownloadUrls=true")));
}

#[tokio::test]
async fn remote_preferences_never_replace_local_runtime_skill_config_or_release_components() {
    let temp = TempDir::new().unwrap();
    let issuer = super::install::issuer().await;
    let app = server(temp.path()).await;
    rpc(&app, "account/login/start", Some(login(&issuer.url))).await;
    rpc(&app, "plugin/install", detail("opaque~install")).await;
    let mut row = issuer.plugin.lock().unwrap().clone();
    row["enabled"] = json!(true);
    row["disabled_skill_names"] = json!(["research"]);
    issuer
        .installed_replies
        .lock()
        .unwrap()
        .push_back((200, page(vec![row], None)));
    let remote = rpc(&app, "plugin/read", detail("opaque~install")).await;
    assert_eq!(remote["plugin"]["skills"][0]["enabled"], false);
    assert_eq!(remote["plugin"]["skills"][0]["path"], Value::Null);
    assert_eq!(remote["plugin"]["hooks"], json!([]));
    let params = Some(json!({"cwds":[temp.path()],"forceReload":true}));
    let local = rpc(&app, "skills/list", params.clone()).await;
    let skill = local["data"][0]["skills"]
        .as_array()
        .unwrap()
        .iter()
        .find(|skill| skill["name"] == "research:research")
        .unwrap();
    assert_eq!(skill["enabled"], true);
    rpc(
        &app,
        "skills/config/write",
        Some(json!({"path":skill["path"],"enabled":false})),
    )
    .await;
    let remote = rpc(&app, "plugin/read", detail("opaque~install")).await;
    assert_eq!(remote["plugin"]["skills"][0]["enabled"], true);
    let local = rpc(&app, "skills/list", params).await;
    let skill = local["data"][0]["skills"]
        .as_array()
        .unwrap()
        .iter()
        .find(|skill| skill["name"] == "research:research")
        .unwrap();
    assert_eq!(skill["enabled"], false);
    issuer.plugin.lock().unwrap()["release"]["skills"] =
        json!([{"name":"new-release-skill","description":"New release"}]);
    issuer.plugin.lock().unwrap()["release"]["mcp_servers"] = json!([{"key":"new-release-server"}]);
    let remote = rpc(&app, "plugin/read", detail("opaque~install")).await;
    assert_eq!(remote["plugin"]["skills"][0]["name"], "new-release-skill");
    assert_eq!(
        remote["plugin"]["mcpServers"],
        json!(["new-release-server"])
    );
    assert_eq!(remote["plugin"]["hooks"], json!([]));
}

#[tokio::test]
async fn remote_detail_rejects_unavailable_or_malformed_installed_preferences() {
    for response in [
        (503, json!({}), String::new()),
        ok(json!({"plugins":[],"pagination":{"next_page_token":""}})),
        {
            let mut row = item("opaque~detail", "research");
            row["enabled"] = json!(true);
            row["disabled_skill_names"] = Value::Null;
            ok(page(vec![row], None))
        },
    ] {
        let temp = TempDir::new().unwrap();
        let app = server(temp.path()).await;
        let (url, task) = issuer(vec![
            ok(session("one")),
            ok(item("opaque~detail", "research")),
            response,
        ])
        .await;
        rpc(&app, "account/login/start", Some(login(&url))).await;
        assert!(raw(&app, "plugin/read", detail("opaque~detail"))
            .await
            .get("error")
            .is_some());
        finish(task).await;
    }
}

#[tokio::test]
async fn remote_detail_discards_fresh_installed_reply_after_peer_logout_or_switch() {
    for switch in [false, true] {
        let temp = TempDir::new().unwrap();
        let issuer = super::install::issuer().await;
        let app = Arc::new(server(temp.path()).await);
        let peer = server(temp.path()).await;
        rpc(&app, "account/login/start", Some(login(&issuer.url))).await;
        let (started, entered) = tokio::sync::oneshot::channel();
        let (release, released) = tokio::sync::oneshot::channel();
        *issuer.installed_gate.lock().unwrap() = Some((started, released));
        let querying = app.clone();
        let pending =
            tokio::spawn(
                async move { raw(&querying, "plugin/read", detail("opaque~install")).await },
            );
        tokio::time::timeout(Duration::from_secs(10), entered)
            .await
            .unwrap()
            .unwrap();
        if switch {
            let (url, task) = super::support::issuer(vec![ok(session("other"))]).await;
            rpc(&peer, "account/login/start", Some(login(&url))).await;
            finish(task).await;
        } else {
            rpc(&peer, "account/logout", None).await;
        }
        release.send(()).unwrap();
        let response = pending.await.unwrap();
        assert!(response.get("error").is_some(), "{response}");
        assert!(!response.to_string().contains("Remote description"));
    }
}
