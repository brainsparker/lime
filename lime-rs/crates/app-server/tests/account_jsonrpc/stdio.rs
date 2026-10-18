use super::{http, login, session, TOKEN};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

struct Peer {
    child: Child,
    stdin: Option<ChildStdin>,
    lines: Lines<BufReader<ChildStdout>>,
    stderr: PathBuf,
    next_id: u64,
}

impl Peer {
    async fn start(root: &Path, name: &str) -> Self {
        let stderr = root.join(format!("{name}.stderr.log"));
        let mut child = Command::new(env!("CARGO_BIN_EXE_app-server"))
            .args(["--stdio", "--backend", "unavailable", "--app-data-dir"])
            .arg(root.join("app"))
            .arg("--data-dir")
            .arg(root.join("agent"))
            .env("HTTP_PROXY", "http://127.0.0.1:1")
            .env("HTTPS_PROXY", "http://127.0.0.1:1")
            .env("ALL_PROXY", "http://127.0.0.1:1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(std::fs::File::create(&stderr).unwrap())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let stdin = child.stdin.take().unwrap();
        let lines = BufReader::new(child.stdout.take().unwrap()).lines();
        let mut peer = Self {
            child,
            stdin: Some(stdin),
            lines,
            stderr,
            next_id: 1,
        };
        peer.rpc(
            "initialize",
            Some(json!({"clientInfo":{"name":"account-stdio-test","version":"1"}})),
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

    async fn rpc(&mut self, method: &str, params: Option<Value>) -> Value {
        let id = self.next_id;
        self.next_id += 1;
        let mut request = json!({"jsonrpc":"2.0","id":id,"method":method});
        if let Some(params) = params {
            request["params"] = params;
        }
        self.send(request).await;
        tokio::time::timeout(Duration::from_secs(60), async {
            loop {
                let line = self
                    .lines
                    .next_line()
                    .await
                    .unwrap()
                    .expect("App Server JSONL output");
                assert!(
                    !line.contains(TOKEN),
                    "credentials must not appear in stdio projections"
                );
                let message: Value =
                    serde_json::from_str(&line).expect("stdout must contain JSONL only");
                if message["id"] == id {
                    assert!(message.get("error").is_none(), "{method}: {message}");
                    return message["result"].clone();
                }
            }
        })
        .await
        .expect("account stdio response")
    }

    async fn close(mut self) {
        drop(self.stdin.take());
        let status = tokio::time::timeout(Duration::from_secs(60), self.child.wait())
            .await
            .expect("App Server must stop after stdin closes")
            .unwrap();
        let stderr = std::fs::read_to_string(self.stderr).unwrap();
        assert!(!stderr.contains(TOKEN));
        assert!(
            status.success(),
            "App Server did not stop cleanly: {stderr}"
        );
    }
}

#[tokio::test]
async fn account_real_stdio_processes_share_import_and_logout_via_the_production_root() {
    let temp = TempDir::new().unwrap();
    let mut first = Peer::start(temp.path(), "first").await;
    let (url, request) = http("200 OK", session("stdio").to_string(), "").await;
    assert_eq!(
        first.rpc("account/login/start", Some(login(&url))).await,
        json!({"type":"cloudAuthTokens"})
    );
    request.await.unwrap();
    assert!(temp.path().join("app/credentials/account.json").is_file());
    let mut second = Peer::start(temp.path(), "second").await;
    assert_eq!(
        second.rpc("account/read", Some(json!({}))).await["account"]["userId"],
        "stdio"
    );
    second.rpc("account/logout", None).await;
    assert_eq!(
        first.rpc("account/read", Some(json!({}))).await["account"],
        Value::Null
    );
    second.close().await;
    first.close().await;
}
