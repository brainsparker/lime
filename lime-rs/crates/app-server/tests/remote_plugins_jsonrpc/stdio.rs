use super::support::*;
use serde_json::{json, Value};
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

pub(super) struct Peer {
    child: Child,
    stdin: Option<ChildStdin>,
    lines: Lines<BufReader<ChildStdout>>,
    next_id: u64,
}

impl Peer {
    pub(super) async fn start(root: &Path, binary: &Path) -> Self {
        let mut child = Command::new(binary)
            .args(["--stdio", "--backend", "unavailable", "--app-data-dir"])
            .arg(root.join("app"))
            .arg("--data-dir")
            .arg(root.join("agent"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let stdin = child.stdin.take();
        let lines = BufReader::new(child.stdout.take().unwrap()).lines();
        let mut peer = Self {
            child,
            stdin,
            lines,
            next_id: 1,
        };
        peer.rpc(
            "initialize",
            Some(json!({"clientInfo":{"name":"remote-plugin-stdio","version":"1"}})),
        )
        .await;
        peer.send(json!({"jsonrpc":"2.0","method":"initialized"}))
            .await;
        peer
    }

    async fn send(&mut self, message: Value) {
        self.stdin
            .as_mut()
            .unwrap()
            .write_all(format!("{message}\n").as_bytes())
            .await
            .unwrap();
    }

    async fn raw(&mut self, method: &str, params: Option<Value>) -> Value {
        let id = self.next_id;
        self.next_id += 1;
        let mut message = json!({"jsonrpc":"2.0","id":id,"method":method});
        if let Some(params) = params {
            message["params"] = params;
        }
        self.send(message).await;
        let timeout = Duration::from_secs(if method == "plugin/install" { 150 } else { 45 });
        tokio::time::timeout(timeout, async {
            loop {
                let line = self
                    .lines
                    .next_line()
                    .await
                    .unwrap()
                    .expect("JSONL response");
                assert!(!line.contains(TOKEN));
                assert!(!line.contains(BUNDLE));
                let message: Value = serde_json::from_str(&line).unwrap();
                if message["id"] == id {
                    return message;
                }
            }
        })
        .await
        .unwrap_or_else(|error| {
            panic!("bounded stdio response: method={method} id={id} timeout={timeout:?}: {error}")
        })
    }

    pub(super) async fn rpc(&mut self, method: &str, params: Option<Value>) -> Value {
        let response = self.raw(method, params).await;
        assert!(response.get("error").is_none(), "{method}: {response}");
        response["result"].clone()
    }

    pub(super) async fn close(mut self) {
        drop(self.stdin.take());
        assert!(
            tokio::time::timeout(Duration::from_secs(45), self.child.wait())
                .await
                .unwrap()
                .unwrap()
                .success()
        );
    }
}

pub(super) fn fixed_binary() -> tempfile::TempPath {
    // Cargo targets can be shared with another checkout's build. Keep both peers
    // on one immutable executable, beside its runtime libraries on every host.
    let source = std::env::var_os("LIME_TEST_APP_SERVER_BIN")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_BIN_EXE_app-server")).to_path_buf());
    let file = tempfile::Builder::new()
        .prefix("remote-catalog-")
        .suffix(std::env::consts::EXE_SUFFIX)
        .tempfile_in(source.parent().unwrap())
        .unwrap();
    std::fs::copy(&source, file.path()).unwrap();
    file.into_temp_path()
}

#[tokio::test]
async fn remote_plugins_real_stdio_processes_use_shared_account_for_directory_and_details() {
    let temp = TempDir::new().unwrap();
    let binary = fixed_binary();
    let mut first = Peer::start(temp.path(), &binary).await;
    let plugin = item("stdio~1", "research");
    let mut installed = plugin.clone();
    installed["enabled"] = json!(true);
    installed["release"]["version"] = json!("0.9.0");
    installed["installed_at"] = json!("2026-01-01T00:00:00Z");
    let (url, task) = issuer(vec![
        ok(session("stdio")),
        ok(page(vec![plugin.clone()], None)),
        ok(page(vec![installed.clone()], None)),
        ok(plugin),
        ok(page(vec![installed], None)),
    ])
    .await;
    first.rpc("account/login/start", Some(login(&url))).await;
    let mut peer = Peer::start(temp.path(), &binary).await;
    assert_eq!(
        peer.rpc("account/read", None).await["account"]["userId"],
        "stdio"
    );
    let list = peer.rpc("plugin/list", workspace()).await;
    assert_eq!(
        list["marketplaces"][0]["plugins"][0]["remotePluginId"], "stdio~1",
        "remote stdio directory: {list}"
    );
    let read = first.rpc("plugin/read", detail("stdio~1")).await;
    assert_eq!(list["marketplaces"][0]["plugins"][0]["installed"], true);
    assert_eq!(
        list["marketplaces"][0]["plugins"][0]["localVersion"],
        "0.9.0"
    );
    assert_eq!(
        list["marketplaces"][0]["plugins"][0]["installedAt"],
        1767225600_i64
    );
    assert_eq!(
        peer.rpc("plugin/installed", Some(json!({}))).await["marketplaces"],
        json!([])
    );
    assert_eq!(
        read["plugin"]["summary"],
        list["marketplaces"][0]["plugins"][0]
    );
    peer.rpc("account/logout", None).await;
    assert!(first
        .raw("plugin/list", workspace())
        .await
        .get("error")
        .is_some());
    assert_eq!(read["plugin"]["skills"][0]["path"], Value::Null);
    assert_eq!(read["plugin"]["skills"][0]["enabled"], true);
    let requests = finish(task).await;
    assert_eq!(requests.len(), 5);
    assert!(requests[2].contains("/installed?limit=200&includeDownloadUrls=false "));
    assert!(!requests
        .iter()
        .any(|request| request.contains("includeDownloadUrls=true")));
    peer.close().await;
    first.close().await;
}
