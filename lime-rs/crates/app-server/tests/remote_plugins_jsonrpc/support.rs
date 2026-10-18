use app_server::{AppServer, LocalAppDataSource, MockBackend, RuntimeCore};
use lime_core::database::schema::create_tables;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::task::JoinHandle;

pub const TOKEN: &str = "remote-plugin-account-secret-never-in-projection";
pub const BUNDLE: &str = "https://download.invalid/private-bundle?signature=never-in-projection";
static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

pub async fn server(root: &Path) -> AppServer {
    server_with_home(root, None).await
}

pub async fn server_with_home(root: &Path, home: Option<std::path::PathBuf>) -> AppServer {
    let db = Connection::open_in_memory().unwrap();
    create_tables(&db).unwrap();
    let data = LocalAppDataSource::initialize_with_roots(
        Arc::new(Mutex::new(db)),
        root,
        root.join("agent"),
    )
    .await
    .unwrap()
    .with_app_config_path(root.join("config.yaml"))
    .with_plugin_discovery_roots(home, None);
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend))
            .with_account_store_root(root)
            .with_app_config_path(root.join("config.yaml"))
            .with_app_data_source(Arc::new(data)),
    );
    rpc(
        &server,
        "initialize",
        Some(json!({"clientInfo":{"name":"remote-plugin-test","version":"1"}})),
    )
    .await;
    server
        .handle_json_line(r#"{"jsonrpc":"2.0","method":"initialized"}"#)
        .await
        .unwrap();
    server
}

pub async fn raw(server: &AppServer, method: &str, params: Option<Value>) -> Value {
    let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
    let mut request = json!({"jsonrpc":"2.0","id":id,"method":method});
    if let Some(params) = params {
        request["params"] = params;
    }
    let lines = tokio::time::timeout(
        Duration::from_secs(40),
        server.handle_json_line(&request.to_string()),
    )
    .await
    .expect("bounded public RPC")
    .unwrap();
    for line in &lines {
        assert!(!line.contains(TOKEN));
        assert!(!line.contains(BUNDLE));
    }
    lines
        .iter()
        .map(|line| serde_json::from_str::<Value>(line).unwrap())
        .find(|message| message["id"] == id)
        .expect("response")
}

pub async fn rpc(server: &AppServer, method: &str, params: Option<Value>) -> Value {
    let response = raw(server, method, params).await;
    assert!(response.get("error").is_none(), "{method}: {response}");
    response["result"].clone()
}

pub fn session(user: &str) -> Value {
    json!({"code":200,"data":{
        "tenant":{"id":"tenant-one"},
        "user":{"id":user,"email":"test@example.test","displayName":"Fixture"},
        "session":{"id":format!("session-{user}"),"tenantId":"tenant-one",
            "userId":user,"expiresAt":"2099-01-01T00:00:00Z"}
    }})
}

pub fn login(url: &str) -> Value {
    json!({"type":"cloudAuthTokens","baseUrl":url,"tenantId":"tenant-one","accessToken":TOKEN})
}

pub async fn issuer(responses: Vec<(u16, Value, String)>) -> (String, JoinHandle<Vec<String>>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for (status, body, headers) in responses {
            let (mut socket, _) = listener.accept().await.unwrap();
            requests.push(receive(&mut socket).await);
            let body = body.to_string();
            let response = format!("HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{headers}\r\n{body}", body.len());
            let _ = socket.write_all(response.as_bytes()).await;
        }
        requests
    });
    (url, task)
}

pub async fn receive(socket: &mut tokio::net::TcpStream) -> String {
    let mut request = Vec::new();
    let mut buffer = [0; 4096];
    while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
        let count = socket.read(&mut buffer).await.unwrap();
        assert!(count > 0 && request.len() < 128 * 1024);
        request.extend_from_slice(&buffer[..count]);
    }
    let header_end = request
        .windows(4)
        .position(|bytes| bytes == b"\r\n\r\n")
        .unwrap()
        + 4;
    let headers = String::from_utf8(request[..header_end].to_vec()).unwrap();
    let content_length = headers
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().unwrap())
        })
        .unwrap_or(0);
    assert!(content_length < 128 * 1024);
    while request.len() < header_end + content_length {
        let count = socket.read(&mut buffer).await.unwrap();
        assert!(count > 0);
        request.extend_from_slice(&buffer[..count]);
    }
    String::from_utf8(request).unwrap()
}

pub async fn respond(socket: &mut tokio::net::TcpStream, body: Value) {
    let body = body.to_string();
    socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
}

pub fn ok(body: Value) -> (u16, Value, String) {
    (200, body, String::new())
}

pub async fn finish(task: JoinHandle<Vec<String>>) -> Vec<String> {
    let requests = tokio::time::timeout(Duration::from_secs(10), task)
        .await
        .unwrap()
        .unwrap();
    for request in &requests {
        assert!(request
            .to_lowercase()
            .contains(&format!("authorization: bearer {TOKEN}")));
        assert!(!request.lines().next().unwrap().contains(TOKEN));
    }
    requests
}

pub fn item(id: &str, name: &str) -> Value {
    json!({"id":id,"name":name,"scope":"WORKSPACE","discoverability":"LISTED",
    "installation_policy":"AVAILABLE","installation_policy_source":"WORKSPACE_SETTING",
    "authentication_policy":"ON_USE","status":"AVAILABLE",
    "release":{"version":"1.2.3","display_name":format!("Display {name}"),
        "description":"Remote description","keywords":["research"],"bundle_download_url":BUNDLE,
        "interface":{"short_description":"Short","long_description":"Long",
            "developer_name":"Developer","category":"Productivity","capabilities":["research"],
            "website_url":"https://example.test","privacy_policy_url":"https://example.test/privacy",
            "terms_of_service_url":"https://example.test/terms","brand_color":"#123456",
            "default_prompt":"Fallback","default_prompts":[" One ","", "Two", "Three", "Four"],
            "composer_icon_url":"https://example.test/icon.svg","logo_url":"https://example.test/logo.png",
            "logo_url_dark":"https://example.test/dark.png","screenshot_urls":["https://example.test/screen.png"]},
        "app_ids":["app-1","app-1"],"app_manifest":{"apps":{"Research":{"id":"app-1","category":"Research"}}},
        "skills":[{"name":"research","description":"Research","interface":{
            "display_name":"Researcher","short_description":"Skill summary","brand_color":"#abcdef",
            "default_prompt":"Research this","icon_small_url":"https://example.test/small.svg",
            "icon_large_url":"https://example.test/large.svg"}}],
        "onboarding_skill_name":"research","mcp_servers":[{"key":"search"}],
        "app_templates":[{"template_id":"template-1","name":"Template","description":"App template",
            "category":"Research","canonical_connector_id":"app-1","logo_url":"https://example.test/app.png",
            "logo_url_dark":"https://example.test/app-dark.png","materialized_app_ids":["app-1"],
            "reason":"NOT_CONFIGURED_FOR_WORKSPACE"}],
        "scheduled_tasks":[{"key":"daily","name":"Daily","prompt":"Research news",
            "schedule":{"type":"hourly","intervalHours":2,"days":["MO","WE"]}}]
    }})
}

pub fn page(items: Vec<Value>, cursor: Option<&str>) -> Value {
    json!({"plugins":items,"pagination":{"next_page_token":cursor}})
}

pub fn workspace() -> Option<Value> {
    Some(json!({"marketplaceKinds":["workspace-directory"]}))
}

pub fn detail(id: &str) -> Option<Value> {
    Some(json!({"remoteMarketplaceName":"workspace-directory","pluginName":id}))
}
