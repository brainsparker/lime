use app_server::{AppServer, MockBackend, RuntimeCore};
use app_server_protocol::protocol::v2::{ClientRequest, LoginAccountParams};
use serde_json::{json, Value};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::task::JoinHandle;

#[path = "account_jsonrpc/request.rs"]
mod request;
#[path = "account_jsonrpc/stdio.rs"]
mod stdio;

const TOKEN: &str = "account-test-secret-never-in-projection";
static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

async fn raw(server: &AppServer, method: &str, params: Option<Value>) -> Value {
    let id = NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed);
    let mut request = json!({"jsonrpc":"2.0","id":id,"method":method});
    if let Some(params) = params {
        request["params"] = params;
    }
    let lines = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        server.handle_json_line(&request.to_string()),
    )
    .await
    .expect("bounded account RPC")
    .unwrap();
    let response = lines
        .iter()
        .map(|line| serde_json::from_str::<Value>(line).unwrap())
        .find(|message| message["id"] == id)
        .expect("account response");
    assert!(!response.to_string().contains(TOKEN));
    response
}

async fn rpc(server: &AppServer, method: &str, params: Option<Value>) -> Value {
    let response = raw(server, method, params).await;
    assert!(response.get("error").is_none(), "{method}: {response}");
    response["result"].clone()
}

fn uninitialized(root: Option<&Path>) -> AppServer {
    let runtime = RuntimeCore::with_backend(Arc::new(MockBackend));
    AppServer::with_runtime(match root {
        Some(root) => runtime.with_account_store_root(root),
        None => runtime,
    })
}

async fn initialize(server: &AppServer) {
    rpc(
        server,
        "initialize",
        Some(json!({"clientInfo":{"name":"account-jsonrpc-test","version":"1"}})),
    )
    .await;
    server
        .handle_json_line(r#"{"jsonrpc":"2.0","method":"initialized"}"#)
        .await
        .unwrap();
}

async fn server(root: &Path) -> AppServer {
    let server = uninitialized(Some(root));
    initialize(&server).await;
    server
}

fn session(user: &str) -> Value {
    json!({"code":200,"data":{
        "tenant":{"id":"tenant-one"},
        "user":{"id":user,"email":"test@example.test","displayName":"Fixture"},
        "session":{"id":format!("session-{user}"),"tenantId":"tenant-one",
            "userId":user,"expiresAt":"2099-01-01T00:00:00Z"}
    }})
}

async fn http(status: &str, body: String, headers: &str) -> (String, JoinHandle<String>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n{headers}\r\n{body}",
        body.len()
    );
    let task = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let mut buffer = [0; 4096];
        while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
            let count = socket.read(&mut buffer).await.unwrap();
            assert!(count > 0 && request.len() < 128 * 1024);
            request.extend_from_slice(&buffer[..count]);
        }
        // A rejected/oversized response may be closed before every byte is sent.
        let _ = socket.write_all(response.as_bytes()).await;
        String::from_utf8(request).unwrap()
    });
    (url, task)
}

fn login(base_url: &str) -> Value {
    json!({"type":"cloudAuthTokens","baseUrl":base_url,"tenantId":"tenant-one","accessToken":TOKEN})
}

async fn import(server: &AppServer, user: &str) -> String {
    let (url, task) = http("200 OK", session(user).to_string(), "").await;
    assert_eq!(
        rpc(server, "account/login/start", Some(login(&url))).await,
        json!({"type":"cloudAuthTokens"})
    );
    let request = task.await.unwrap();
    assert!(
        request.starts_with("GET /api/v1/public/tenants/tenant-one/client/session HTTP/1.1\r\n")
    );
    assert!(request
        .to_lowercase()
        .contains(&format!("authorization: bearer {TOKEN}")));
    url
}

#[tokio::test]
async fn account_import_switch_cold_read_and_logout_share_one_private_store() {
    let temp = TempDir::new().unwrap();
    let first = server(temp.path()).await;
    let second = server(temp.path()).await;
    assert_eq!(
        rpc(&first, "account/read", Some(json!({}))).await,
        json!({"account":null,"requiresOpenaiAuth":false})
    );
    let mut notifications = first.subscribe_outbound_messages();
    let url = import(&first, "one").await;
    let notification = tokio::time::timeout(std::time::Duration::from_secs(30), async {
        loop {
            let message = serde_json::to_value(notifications.recv().await.unwrap()).unwrap();
            assert!(!message.to_string().contains(TOKEN));
            if message["method"] == "account/updated" {
                break message;
            }
        }
    })
    .await
    .expect("account updated after import");
    assert_eq!(notification["method"], "account/updated");
    assert_eq!(
        notification["params"],
        json!({"authMode":"cloudAuthTokens","planType":null})
    );
    assert!(!notification.to_string().contains(TOKEN));
    let read = rpc(&second, "account/read", Some(json!({"refreshToken":true}))).await;
    assert_eq!(
        read["account"],
        json!({"type":"cloud","baseUrl":url,"tenantId":"tenant-one",
        "userId":"one","sessionId":"session-one","email":"test@example.test",
        "displayName":"Fixture","expiresAt":"2099-01-01T00:00:00Z"})
    );
    import(&first, "two").await;
    let cold = server(temp.path()).await;
    assert_eq!(
        rpc(&cold, "account/read", None).await["account"]["userId"],
        "two"
    );
    let mut logout_notifications = second.subscribe_outbound_messages();
    assert_eq!(rpc(&second, "account/logout", None).await, json!({}));
    let notification = tokio::time::timeout(std::time::Duration::from_secs(30), async {
        loop {
            let message = serde_json::to_value(logout_notifications.recv().await.unwrap()).unwrap();
            assert!(!message.to_string().contains(TOKEN));
            if message["method"] == "account/updated" {
                break message;
            }
        }
    })
    .await
    .expect("account updated after logout");
    assert_eq!(notification["method"], "account/updated");
    assert_eq!(
        notification["params"],
        json!({"authMode":null,"planType":null})
    );
    assert!(!notification.to_string().contains(TOKEN));
    assert_eq!(
        rpc(&first, "account/read", None).await["account"],
        Value::Null
    );
    assert!(!temp.path().join("credentials/account.json").exists());
    // Codex's no-parameter logout also accepts an explicit JSON null.
    assert_eq!(
        rpc(&second, "account/logout", Some(Value::Null)).await,
        json!({})
    );
}

#[tokio::test]
async fn account_rejects_unverified_sessions_without_replacing_the_previous_account() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    import(&server, "original").await;
    let path = temp.path().join("credentials/account.json");
    let previous = std::fs::read(&path).unwrap();
    let mut wrong_tenant = session("other");
    wrong_tenant["data"]["tenant"]["id"] = json!("different");
    let mut wrong_user = session("other");
    wrong_user["data"]["session"]["userId"] = json!("different");
    let mut wrong_session_tenant = session("other");
    wrong_session_tenant["data"]["session"]["tenantId"] = json!("different");
    let mut expired = session("other");
    expired["data"]["session"]["expiresAt"] = json!("2000-01-01T00:00:00Z");
    let mut wrong_code = session("other");
    wrong_code["code"] = json!(0);
    for (status, body, headers) in [
        ("401 Unauthorized", TOKEN.to_string(), ""),
        (
            "302 Found",
            TOKEN.to_string(),
            "Location: https://example.test/token-leak\r\n",
        ),
        ("200 OK", wrong_tenant.to_string(), ""),
        ("200 OK", wrong_session_tenant.to_string(), ""),
        ("200 OK", wrong_user.to_string(), ""),
        ("200 OK", expired.to_string(), ""),
        ("200 OK", wrong_code.to_string(), ""),
        ("200 OK", TOKEN.to_string(), ""),
        ("200 OK", "x".repeat(1024 * 1024 + 1), ""),
    ] {
        let (url, task) = http(status, body, headers).await;
        let response = raw(&server, "account/login/start", Some(login(&url))).await;
        assert!(response.get("error").is_some(), "{status}: {response}");
        task.await.unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), previous);
        assert_eq!(
            rpc(&server, "account/read", None).await["account"]["userId"],
            "original"
        );
    }
}

#[tokio::test]
async fn account_validates_endpoint_and_preserves_a_gateway_path_prefix() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    for url in [
        "http://example.test",
        "file:///tmp/token",
        "https://user:pass@example.test",
        "https://example.test?token=secret",
        "https://example.test#secret",
    ] {
        let response = raw(&server, "account/login/start", Some(login(url))).await;
        assert!(response.get("error").is_some());
    }
    let (url, task) = http("200 OK", session("prefix").to_string(), "").await;
    let base = format!("{url}/gateway/");
    rpc(&server, "account/login/start", Some(login(&base))).await;
    assert!(task
        .await
        .unwrap()
        .starts_with("GET /gateway/api/v1/public/tenants/tenant-one/client/session "));
    assert_eq!(
        rpc(&server, "account/read", None).await["account"]["baseUrl"],
        format!("{url}/gateway")
    );
}

#[tokio::test]
async fn account_requires_initialization_storage_and_well_formed_params() {
    let temp = TempDir::new().unwrap();
    let uninitialized = uninitialized(Some(temp.path()));
    for (method, params) in [
        ("account/read", None),
        ("account/logout", None),
        ("account/login/start", Some(login("http://127.0.0.1:1"))),
    ] {
        let response = raw(&uninitialized, method, params).await;
        assert!(response.get("error").is_some());
    }
    let unconfigured = self::uninitialized(None);
    initialize(&unconfigured).await;
    let response = raw(&unconfigured, "account/read", None).await;
    assert!(response["error"]["message"]
        .as_str()
        .unwrap()
        .contains("not configured"));
    let server = server(temp.path()).await;
    for (method, params) in [
        ("account/logout", json!({"token":TOKEN})),
        ("account/login/start", json!({"type":"cloudAuthTokens"})),
        ("account/read", json!({"refreshToken":"invalid"})),
    ] {
        assert!(raw(&server, method, Some(params))
            .await
            .get("error")
            .is_some());
    }
}

#[tokio::test]
async fn account_corrupt_and_oversized_credentials_fail_closed_and_logout_clears_them() {
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    let path = temp.path().join("credentials/account.json");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    for bytes in [TOKEN.to_string(), "x".repeat(256 * 1024 + 1)] {
        std::fs::write(&path, bytes).unwrap();
        assert!(raw(&server, "account/read", None)
            .await
            .get("error")
            .is_some());
        rpc(&server, "account/logout", None).await;
        assert!(!path.exists());
    }
}

#[cfg(unix)]
#[tokio::test]
async fn account_credentials_have_private_permissions_after_replacement() {
    use std::os::unix::fs::PermissionsExt;
    let temp = TempDir::new().unwrap();
    let server = server(temp.path()).await;
    for user in ["first", "replacement"] {
        import(&server, user).await;
        let directory = temp.path().join("credentials");
        assert_eq!(
            std::fs::metadata(&directory).unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            std::fs::metadata(directory.join("account.json"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 1);
    }
}

#[test]
fn account_debug_redacts_tokens_in_typed_requests_and_logout_omits_params() {
    let params: LoginAccountParams = serde_json::from_value(login("https://example.test")).unwrap();
    assert!(!format!("{params:?}").contains(TOKEN));
    let request: ClientRequest = serde_json::from_value(json!({"method":"account/login/start",
        "id":1,"params":login("https://example.test")}))
    .unwrap();
    assert!(!format!("{request:?}").contains(TOKEN));
    let logout: ClientRequest =
        serde_json::from_value(json!({"method":"account/logout","id":1})).unwrap();
    assert_eq!(
        serde_json::to_value(logout).unwrap(),
        json!({"method":"account/logout","id":1})
    );
}

#[tokio::test]
async fn account_logout_waits_for_inflight_login_in_the_shared_request_queue() {
    let temp = TempDir::new().unwrap();
    let server = Arc::new(server(temp.path()).await);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let (entered, verification_started) = tokio::sync::oneshot::channel();
    let (release, released) = tokio::sync::oneshot::channel();
    let http = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let mut buffer = [0; 4096];
        while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
            let count = socket.read(&mut buffer).await.unwrap();
            assert!(count > 0 && request.len() < 128 * 1024);
            request.extend_from_slice(&buffer[..count]);
        }
        entered.send(()).unwrap();
        released.await.unwrap();
        let body = session("queued").to_string();
        socket
            .write_all(
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .as_bytes(),
            )
            .await
            .unwrap();
    });
    let login_server = server.clone();
    let importing =
        tokio::spawn(
            async move { rpc(&login_server, "account/login/start", Some(login(&url))).await },
        );
    tokio::time::timeout(std::time::Duration::from_secs(20), verification_started)
        .await
        .expect("verification must reach the local issuer")
        .unwrap();
    let logout_server = server.clone();
    let mut logout = tokio::spawn(async move { rpc(&logout_server, "account/logout", None).await });
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(100), &mut logout)
            .await
            .is_err(),
        "logout cannot overtake verification and leave a newly imported account after logout"
    );
    release.send(()).unwrap();
    importing.await.unwrap();
    logout.await.unwrap();
    http.await.unwrap();
    assert_eq!(
        rpc(&server, "account/read", None).await["account"],
        Value::Null
    );
}
