use std::sync::{Arc, Mutex};

use app_server::{AppServer, LocalAppDataSource, MockBackend, RuntimeCore};
use app_server_protocol::error_codes;
use lime_core::database::schema::create_tables;
use rusqlite::Connection;
use serde_json::{json, Value};
use tempfile::TempDir;

#[tokio::test]
async fn retired_plugin_url_request_never_enters_pending_storage_or_notifications() {
    let temp = TempDir::new().unwrap();
    let first_server = server(&temp).await;
    initialize(&first_server).await;
    let existing = request(
        &first_server,
        2,
        "workspaceRightSurface/request",
        json!({
            "workspaceId": "workspace-test",
            "surfaceKind": "files",
            "origin": "runtime",
            "candidateId": "report.md"
        }),
    )
    .await;
    let existing_id = existing["result"]["requestId"].as_str().unwrap();

    let rejected = first_server
        .handle_json_line(
            &json!({
                "id": 3,
                "method": "workspaceRightSurface/request",
                "params": {
                    "workspaceId": "workspace-test",
                    "surfaceKind": " appSurface ",
                    "origin": "runtime",
                    "metadata": {
                        "appId": "retired-plugin",
                        "surface": {"entryUrl": "https://example.com/retired-plugin"}
                    }
                }
            })
            .to_string(),
        )
        .await
        .unwrap();
    let messages: Vec<Value> = rejected
        .iter()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(
        messages.len(),
        1,
        "retired request emitted notifications: {messages:#?}"
    );
    assert_eq!(messages[0]["id"], 3);
    assert_eq!(messages[0]["error"]["code"], error_codes::INVALID_REQUEST);
    assert_eq!(
        messages[0]["error"]["message"],
        "MCP Apps must open from completed canonical MCP tool items"
    );

    let restored_server = server(&temp).await;
    initialize(&restored_server).await;
    for server in [&first_server, &restored_server] {
        let listed = request(
            server,
            4,
            "workspaceRightSurface/pending/list",
            json!({"workspaceId": "workspace-test"}),
        )
        .await;
        let pending = listed["result"]["pending"].as_array().unwrap();
        assert_eq!(pending.len(), 1, "retired URL persisted: {listed:#}");
        assert_eq!(pending[0]["requestId"], existing_id);
        assert_eq!(pending[0]["surfaceKind"], "files");
    }
}

async fn server(temp: &TempDir) -> AppServer {
    let connection = Connection::open(temp.path().join("test.db")).unwrap();
    create_tables(&connection).unwrap();
    let source = LocalAppDataSource::initialize_with_roots(
        Arc::new(Mutex::new(connection)),
        temp.path(),
        temp.path().join("agent-root"),
    )
    .await
    .unwrap()
    .with_app_config_path(temp.path().join("config.yaml"))
    .with_plugin_discovery_roots(None, None);
    AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend))
            .with_app_config_path(temp.path().join("config.yaml"))
            .with_app_data_source(Arc::new(source)),
    )
}

async fn initialize(server: &AppServer) {
    request(
        server,
        1,
        "initialize",
        json!({"clientInfo":{"name":"right-surface-test","version":"1"}}),
    )
    .await;
    server
        .handle_json_line(r#"{"method":"initialized"}"#)
        .await
        .unwrap();
}

async fn request(server: &AppServer, id: i64, method: &str, params: Value) -> Value {
    let response = server
        .handle_json_line(&json!({"id":id,"method":method,"params":params}).to_string())
        .await
        .unwrap()
        .iter()
        .map(|line| serde_json::from_str::<Value>(line).unwrap())
        .find(|message| message["id"] == id)
        .unwrap();
    assert!(response.get("error").is_none(), "{method}: {response:#}");
    response
}
