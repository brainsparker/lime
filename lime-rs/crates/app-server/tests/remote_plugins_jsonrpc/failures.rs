use super::support::*;
use serde_json::json;
use tempfile::TempDir;

#[tokio::test]
async fn remote_plugins_reject_wrong_scope_malformed_pages_and_cross_page_duplicates() {
    let plugin = item("opaque~1", "research");
    let mut wrong_scope = plugin.clone();
    wrong_scope["scope"] = json!("GLOBAL");
    let mut invalid_identity = plugin.clone();
    invalid_identity["name"] = json!("../research");
    let mut unlisted = plugin.clone();
    unlisted["discoverability"] = json!("UNLISTED");
    let mut wrong_policy = plugin.clone();
    wrong_policy["installation_policy"] = json!("UNKNOWN_POLICY");
    let cases = vec![
        vec![page(vec![wrong_scope], None)],
        vec![page(vec![invalid_identity], None)],
        vec![page(vec![unlisted], None)],
        vec![page(vec![wrong_policy], None)],
        vec![json!({"success":true,"data":{"plugins":[]}})],
        vec![page(vec![plugin.clone()], Some(""))],
        vec![
            page(vec![plugin.clone()], Some("repeat")),
            page(vec![], Some("repeat")),
        ],
        vec![
            page(vec![plugin.clone()], Some("next")),
            page(vec![plugin], None),
        ],
        vec![
            page(vec![item("first", "same-name")], Some("next")),
            page(vec![item("second", "same-name")], None),
        ],
    ];
    for pages in cases {
        let temp = TempDir::new().unwrap();
        let server = server(temp.path()).await;
        let mut responses = vec![ok(session("one"))];
        responses.extend(pages.into_iter().map(ok));
        let (url, task) = issuer(responses).await;
        rpc(&server, "account/login/start", Some(login(&url))).await;
        assert!(raw(&server, "plugin/list", workspace())
            .await
            .get("error")
            .is_some());
        finish(task).await;
    }
}

#[tokio::test]
async fn remote_plugin_details_validate_requested_identity_and_never_follow_redirects() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let (url, task) = issuer(vec![
        ok(session("one")),
        ok(item("other", "research")),
        (
            302,
            json!({}),
            "Location: http://127.0.0.1:1/private\r\n".into(),
        ),
    ])
    .await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    for id in ["", "../name", "canonical@workspace-directory", "query?x=y"] {
        assert!(raw(&server, "plugin/read", detail(id))
            .await
            .get("error")
            .is_some());
    }
    for _ in 0..2 {
        assert!(raw(&server, "plugin/read", detail("expected"))
            .await
            .get("error")
            .is_some());
    }
    let requests = finish(task).await;
    assert_eq!(requests.len(), 3);
    for request in &requests[1..] {
        assert!(request.starts_with("GET /api/v1/public/tenants/tenant-one/client/ps/plugins/expected?includeDownloadUrls=false HTTP/1.1"));
    }
}

#[tokio::test]
async fn remote_plugins_do_not_return_credentials_echoed_by_the_issuer() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let mut plugin = item("expected", "research");
    plugin["release"]["description"] = json!(format!("credential {TOKEN}"));
    let (url, task) = issuer(vec![ok(session("one")), ok(plugin)]).await;
    rpc(&server, "account/login/start", Some(login(&url))).await;
    assert!(raw(&server, "plugin/read", detail("expected"))
        .await
        .get("error")
        .is_some());
    finish(task).await;
}

#[tokio::test]
async fn remote_plugin_collections_require_the_shared_account() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    for kind in ["vertical", "shared-with-me"] {
        let response = raw(
            &server,
            "plugin/list",
            Some(json!({"marketplaceKinds":[kind]})),
        )
        .await;
        assert!(response["error"]["message"]
            .as_str()
            .unwrap()
            .contains("authentication required"));
    }
}
