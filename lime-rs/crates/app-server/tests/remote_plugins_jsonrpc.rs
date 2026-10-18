use serde_json::{json, Value};
use tempfile::TempDir;

#[path = "remote_plugins_jsonrpc/collections.rs"]
mod collections;
#[path = "remote_plugins_jsonrpc/failures.rs"]
mod failures;
#[path = "remote_plugins_jsonrpc/identity.rs"]
mod identity;
#[path = "remote_plugins_jsonrpc/install.rs"]
mod install;
#[path = "remote_plugins_jsonrpc/mutation.rs"]
mod mutation;
#[path = "remote_plugins_jsonrpc/preparation.rs"]
mod preparation;
#[path = "remote_plugins_jsonrpc/reconcile.rs"]
mod reconcile;
#[path = "remote_plugins_jsonrpc/stdio.rs"]
mod stdio;
#[path = "remote_plugins_jsonrpc/support.rs"]
mod support;
use support::*;

#[tokio::test]
async fn remote_plugins_require_auth_and_local_catalog_never_needs_it() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    assert!(rpc(
        &server,
        "plugin/list",
        Some(json!({"marketplaceKinds":["local"]}))
    )
    .await["marketplaces"]
        .is_array());
    assert!(rpc(&server, "plugin/list", Some(json!({}))).await["marketplaces"].is_array());
    for (method, params) in [
        ("plugin/list", workspace()),
        ("plugin/read", detail("opaque~1")),
    ] {
        let response = raw(&server, method, params).await;
        assert!(response["error"]["message"]
            .as_str()
            .unwrap()
            .contains("authentication required"));
    }
}

#[tokio::test]
async fn remote_plugins_public_rpc_pages_and_projects_raw_directory_and_details() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let plugin = item("opaque~1", "research");
    let (url, task) = issuer(vec![
        ok(session("one")),
        ok(page(vec![plugin.clone()], Some("next+/="))),
        ok(page(vec![item("opaque_2", "writer")], None)),
        ok(plugin),
    ])
    .await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    // If local listing touched HTTP, the first remote page would consume the wrong response.
    rpc(
        &server,
        "plugin/list",
        Some(json!({"marketplaceKinds":["local"]})),
    )
    .await;
    let response = rpc(&server, "plugin/list", workspace()).await;
    let market = &response["marketplaces"][0];
    assert_eq!(market["name"], "workspace-directory");
    assert_eq!(market["path"], Value::Null);
    let plugins = market["plugins"].as_array().unwrap();
    assert_eq!(plugins.len(), 2);
    let summary = &plugins[0];
    assert_eq!(summary["id"], "research@workspace-directory");
    assert_eq!(summary["remotePluginId"], "opaque~1");
    assert_eq!(summary["source"], json!({"type":"remote"}));
    assert_eq!(summary["installed"], false);
    assert_eq!(summary["enabled"], false);
    assert_eq!(summary["localVersion"], Value::Null);
    assert_eq!(summary["installPolicySource"], "WORKSPACE_SETTING");
    assert_eq!(summary["shareContext"]["discoverability"], "LISTED");
    let interface = &summary["interface"];
    assert_eq!(interface["displayName"], "Display research");
    assert_eq!(interface["defaultPrompt"], json!(["One", "Two", "Three"]));
    for field in [
        "shortDescription",
        "longDescription",
        "developerName",
        "category",
        "capabilities",
        "websiteUrl",
        "privacyPolicyUrl",
        "termsOfServiceUrl",
        "brandColor",
        "composerIconUrl",
        "logoUrl",
        "logoUrlDark",
        "screenshotUrls",
    ] {
        assert!(!interface[field].is_null(), "missing interface {field}");
    }
    assert_eq!(interface["logo"], Value::Null);
    let response = rpc(&server, "plugin/read", detail("opaque~1")).await;
    let plugin = &response["plugin"];
    assert_eq!(plugin["summary"], *summary);
    assert_eq!(plugin["description"], "Remote description");
    assert_eq!(plugin["mcpServers"], json!(["search"]));
    assert_eq!(plugin["skills"][0]["path"], Value::Null);
    assert_eq!(plugin["skills"][0]["enabled"], false);
    assert_eq!(
        plugin["skills"][0]["interface"]["iconSmallUrl"],
        "https://example.test/small.svg"
    );
    assert_eq!(plugin["onboardingSkill"], Value::Null);
    assert_eq!(plugin["apps"].as_array().unwrap().len(), 1);
    assert_eq!(plugin["apps"][0]["id"], "app-1");
    assert_eq!(plugin["apps"][0]["category"], "Research");
    assert_eq!(plugin["apps"][0]["installUrl"], Value::Null);
    assert_eq!(plugin["appTemplates"][0]["canonicalConnectorId"], "app-1");
    assert_eq!(
        plugin["appTemplates"][0]["materializedAppIds"],
        json!(["app-1"])
    );
    assert_eq!(
        plugin["appTemplates"][0]["reason"],
        "NOT_CONFIGURED_FOR_WORKSPACE"
    );
    assert_eq!(
        plugin["scheduledTasks"][0]["schedule"],
        json!({"type":"hourly","intervalHours":2,"days":["MO","WE"]})
    );
    let requests = finish(task).await;
    assert!(requests[1].starts_with("GET /api/v1/public/tenants/tenant-one/client/ps/plugins/list?scope=WORKSPACE&limit=200 HTTP/1.1"));
    assert!(requests[2]
        .lines()
        .next()
        .unwrap()
        .ends_with("&pageToken=next%2B%2F%3D HTTP/1.1"));
    assert!(requests[3].starts_with("GET /api/v1/public/tenants/tenant-one/client/ps/plugins/opaque~1?includeDownloadUrls=false HTTP/1.1"));
}

#[tokio::test]
async fn remote_plugins_explicit_http_errors_fail_but_implicit_catalog_keeps_local_data() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let local = temp.path().join("local");
    std::fs::create_dir_all(local.join(".agents/plugins")).unwrap();
    std::fs::write(
        local.join(".agents/plugins/marketplace.json"),
        json!({"name":"local","plugins":[]}).to_string(),
    )
    .unwrap();
    rpc(&server, "marketplace/add", Some(json!({"source":local}))).await;
    let (url, task) = issuer(vec![
        ok(session("one")),
        (403, json!({"message":BUNDLE}), String::new()),
        (
            503,
            json!({"message":"issuer internal diagnostic"}),
            String::new(),
        ),
    ])
    .await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    let error = raw(&server, "plugin/list", workspace()).await;
    assert!(error["error"]["message"]
        .as_str()
        .unwrap()
        .contains("HTTP 403"));
    let default = rpc(&server, "plugin/list", Some(json!({}))).await;
    assert!(default["marketplaces"].is_array());
    assert_eq!(default["marketplaces"][0]["name"], "local");
    assert_eq!(
        default["marketplaces"][0]["path"],
        serde_json::to_value(
            std::fs::canonicalize(local.join(".agents/plugins/marketplace.json")).unwrap()
        )
        .unwrap()
    );
    assert!(!default.to_string().contains("issuer internal"));
    finish(task).await;
}

#[tokio::test]
async fn remote_plugins_consume_the_published_limecore_component_fixture() {
    // Byte-identical snapshot of LimeCore's controller-tested plugin-directory-components.json.
    let fixture: Value =
        serde_json::from_str(include_str!("remote_plugins_jsonrpc/core-directory.json")).unwrap();
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let (url, task) = issuer(vec![ok(session("one")), ok(fixture.clone())]).await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    let response = rpc(
        &server,
        "plugin/read",
        detail(fixture["id"].as_str().unwrap()),
    )
    .await;
    let plugin = &response["plugin"];
    assert_eq!(
        plugin["summary"]["id"],
        "native-private@workspace-directory"
    );
    assert_eq!(plugin["apps"][0]["id"], "conn-research");
    assert_eq!(plugin["apps"][0]["category"], "research");
    assert_eq!(plugin["skills"][0]["shortDescription"], "Research topics");
    assert_eq!(
        plugin["appTemplates"][0]["materializedAppIds"],
        json!(["conn-research-copy"])
    );
    assert_eq!(plugin["scheduledTasks"].as_array().unwrap().len(), 4);
    for (task, expected) in plugin["scheduledTasks"]
        .as_array()
        .unwrap()
        .iter()
        .zip(fixture["release"]["scheduled_tasks"].as_array().unwrap())
    {
        assert_eq!(task["schedule"], expected["schedule"]);
    }
    finish(task).await;
}
