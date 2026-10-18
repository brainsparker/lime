use super::support::*;
use serde_json::{json, Value};
use tempfile::TempDir;

fn shared(id: &str, name: &str, discoverability: &str) -> Value {
    let mut plugin = item(id, name);
    plugin["discoverability"] = json!(discoverability);
    plugin["creator_account_user_id"] = json!("creator");
    plugin["creator_name"] = json!("Creator");
    plugin["share_url"] = json!("https://example.test/plugin-share");
    plugin["can_publish_to_workspace"] = json!(false);
    plugin["share_principals"] = json!([
        {"principal_type":"user","principal_id":"creator","role":"owner","name":"Creator"},
        {"principal_type":"group","principal_id":"organization-one","role":"editor","name":"Authors"}
    ]);
    plugin
}

#[tokio::test]
async fn shared_collection_distinguishes_explicit_shares_from_link_installs_and_projects_context() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let private = shared("private~one", "private", "PRIVATE");
    let unlisted = shared("unlisted~one", "unlisted", "UNLISTED");
    let link = shared("link~one", "link", "UNLISTED");
    let listed = item("listed~one", "listed");
    let mut installed = unlisted.clone();
    installed["enabled"] = json!(false);
    installed["installed_at"] = json!("2026-10-18T00:00:00Z");
    installed["release"]["version"] = json!("0.9.0");
    let mut link_installed = link.clone();
    link_installed["enabled"] = json!(true);
    let installed_rows = vec![installed.clone(), link_installed.clone()];
    let (url, task) = issuer(vec![
        ok(session("one")),
        ok(page(vec![private.clone(), listed], Some("shared+/="))),
        ok(page(vec![unlisted], None)),
        ok(page(vec![installed], Some("installed+/="))),
        ok(page(vec![link_installed], None)),
        ok(private),
        ok(page(installed_rows.clone(), None)),
        ok(link),
        ok(page(installed_rows, None)),
    ])
    .await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    let response = rpc(
        &server,
        "plugin/list",
        Some(json!({"marketplaceKinds":["shared-with-me","shared-with-me"]})),
    )
    .await;
    let markets = response["marketplaces"].as_array().unwrap();
    assert_eq!(markets.len(), 2);
    assert_eq!(markets[0]["name"], "workspace-shared-with-me-private");
    assert_eq!(markets[1]["name"], "workspace-shared-with-me-unlisted");
    let direct = markets[0]["plugins"].as_array().unwrap();
    assert_eq!(direct.len(), 2);
    assert_eq!(direct[0]["id"], "private@workspace-shared-with-me");
    assert_eq!(direct[1]["id"], "unlisted@workspace-shared-with-me");
    assert_eq!(direct[1]["installed"], true);
    assert_eq!(direct[1]["enabled"], false);
    assert_eq!(direct[1]["installedAt"], 1792281600_i64);
    assert_eq!(direct[1]["version"], "1.2.3");
    assert_eq!(direct[1]["localVersion"], "0.9.0");
    assert_eq!(
        markets[1]["plugins"][0]["id"],
        "link@workspace-shared-with-me"
    );
    assert_eq!(markets[1]["plugins"][0]["installed"], true);
    let context = &direct[0]["shareContext"];
    assert_eq!(context["creatorAccountUserId"], "creator");
    assert_eq!(context["creatorName"], "Creator");
    assert_eq!(context["canPublishToWorkspace"], false);
    assert_eq!(
        context["sharePrincipals"][1],
        json!({"principalType":"group","principalId":"organization-one","role":"editor","name":"Authors"})
    );
    for (id, bucket) in [
        ("private~one", "workspace-shared-with-me-private"),
        ("link~one", "workspace-shared-with-me-unlisted"),
    ] {
        let read = rpc(
            &server,
            "plugin/read",
            Some(json!({"remoteMarketplaceName":bucket,"pluginName":id})),
        )
        .await;
        assert_eq!(
            read["plugin"]["marketplaceName"],
            "workspace-shared-with-me"
        );
        assert_eq!(
            read["plugin"]["shareUrl"],
            "https://example.test/plugin-share"
        );
    }
    let requests = finish(task).await;
    assert!(requests[1].starts_with("GET /api/v1/public/tenants/tenant-one/client/ps/plugins/workspace/shared?limit=200 HTTP/1.1"));
    assert!(requests[2]
        .lines()
        .next()
        .unwrap()
        .contains("pageToken=shared%2B%2F%3D"));
    assert!(requests[3]
        .lines()
        .next()
        .unwrap()
        .contains("installed?limit=200&includeDownloadUrls=false"));
    assert!(requests[4]
        .lines()
        .next()
        .unwrap()
        .contains("pageToken=installed%2B%2F%3D"));
}

#[tokio::test]
async fn vertical_collection_preserves_the_global_canonical_identity_and_pagination() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let mut one = item("vertical~one", "one");
    one["scope"] = json!("GLOBAL");
    let mut two = one.clone();
    two["id"] = json!("vertical~two");
    two["name"] = json!("two");
    let (url, task) = issuer(vec![
        ok(session("one")),
        ok(page(vec![one], Some("vertical+/="))),
        ok(page(vec![two], None)),
        ok(page(vec![], None)),
    ])
    .await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    let response = rpc(
        &server,
        "plugin/list",
        Some(json!({"marketplaceKinds":["vertical"]})),
    )
    .await;
    let market = &response["marketplaces"][0];
    assert_eq!(market["name"], "openai-curated-remote");
    assert_eq!(market["plugins"].as_array().unwrap().len(), 2);
    assert_eq!(market["plugins"][0]["id"], "one@openai-curated-remote");
    let requests = finish(task).await;
    assert!(requests[1]
        .lines()
        .next()
        .unwrap()
        .contains("list?scope=GLOBAL&limit=200&collection=vertical"));
    assert!(requests[2]
        .lines()
        .next()
        .unwrap()
        .contains("collection=vertical&pageToken=vertical%2B%2F%3D"));
}

#[tokio::test]
async fn shared_collection_fails_closed_on_conflicts_or_incomplete_installed_authority() {
    let one = shared("one", "same", "PRIVATE");
    let two = shared("two", "same", "UNLISTED");
    for pages in [
        vec![ok(page(vec![one.clone(), two], None))],
        vec![
            ok(page(vec![one.clone()], None)),
            (403, json!({"message":"revoked"}), String::new()),
        ],
    ] {
        let temp = TempDir::new().unwrap();
        let server = server(temp.path()).await;
        let mut responses = vec![ok(session("one"))];
        responses.extend(pages);
        let (url, task) = issuer(responses).await;
        rpc(&server, "account/login/start", Some(login(&url))).await;
        assert!(raw(
            &server,
            "plugin/list",
            Some(json!({"marketplaceKinds":["shared-with-me"]}))
        )
        .await
        .get("error")
        .is_some());
        finish(task).await;
    }
}

#[tokio::test]
async fn private_install_reconcile_cold_read_and_visibility_change_use_one_canonical_store() {
    let temp = TempDir::new().unwrap();
    let issuer = super::install::issuer().await;
    issuer.plugin.lock().unwrap()["discoverability"] = json!("PRIVATE");
    let app = server(temp.path()).await;
    rpc(&app, "account/login/start", Some(login(&issuer.url))).await;
    let params = Some(
        json!({"remoteMarketplaceName":"workspace-shared-with-me-private","pluginName":"opaque~install"}),
    );
    rpc(&app, "plugin/install", params.clone()).await;
    rpc(&app, "plugin/reconcile", Some(json!({}))).await;
    let read = rpc(&app, "plugin/read", params.clone()).await;
    assert_eq!(
        read["plugin"]["summary"]["id"],
        "research@workspace-shared-with-me"
    );
    assert_eq!(read["plugin"]["skills"][0]["path"], Value::Null);
    let cold = server(temp.path()).await;
    assert_eq!(
        rpc(&cold, "plugin/read", params).await["plugin"]["summary"]["localVersion"],
        "1.2.3"
    );
    issuer.plugin.lock().unwrap()["discoverability"] = json!("LISTED");
    let result = rpc(&cold, "plugin/reconcile", Some(json!({}))).await;
    assert_eq!(result["changedPlugins"].as_array().unwrap().len(), 2);
    assert!(!temp
        .path()
        .join("agent/plugins/cache/workspace-shared-with-me/research")
        .exists());
    let installed = rpc(&cold, "plugin/installed", Some(json!({}))).await;
    assert_eq!(
        installed["marketplaces"][0]["plugins"][0]["id"],
        "research@workspace-directory"
    );
    *issuer.remotely_installed.lock().unwrap() = false;
    rpc(&cold, "plugin/reconcile", Some(json!({}))).await;
    assert_eq!(
        rpc(&cold, "plugin/installed", Some(json!({}))).await["marketplaces"],
        json!([])
    );
}
