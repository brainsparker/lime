use super::model_fixture::{ModelFixture, Wire};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

#[path = "history_stdio.rs"]
mod history;

struct Peer {
    child: Child,
    stdin: Option<ChildStdin>,
    lines: Lines<BufReader<ChildStdout>>,
    notifications: Vec<Value>,
    next_id: u64,
}

impl Peer {
    async fn start(root: &Path, binary: &Path) -> Self {
        let mut child = Command::new(binary)
            .args(["--stdio", "--backend", "runtime", "--app-data-dir"])
            .arg(root.join("app"))
            .arg("--data-dir")
            .arg(root.join("agent"))
            .current_dir(root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::from(
                std::fs::File::create(root.join("stderr.log")).unwrap(),
            ))
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let mut peer = Self {
            stdin: child.stdin.take(),
            lines: BufReader::new(child.stdout.take().unwrap()).lines(),
            child,
            notifications: Vec::new(),
            next_id: 1,
        };
        peer.rpc(
            "initialize",
            json!({
                "clientInfo":{"name":"context-compaction-stdio","version":"1"},
                "capabilities":{"experimentalApi":true},
            }),
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

    async fn read(&mut self) -> Value {
        let line = tokio::time::timeout(Duration::from_secs(30), self.lines.next_line())
            .await
            .expect("bounded stdio message")
            .unwrap()
            .expect("App Server JSONL");
        serde_json::from_str(&line).expect("valid JSONL")
    }

    async fn rpc(&mut self, method: &str, params: Value) -> Value {
        let id = self.next_id;
        self.next_id += 1;
        self.send(json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}))
            .await;
        loop {
            let message = self.read().await;
            if message["id"] == id {
                assert!(message.get("error").is_none(), "{method}: {message}");
                return message["result"].clone();
            }
            assert!(
                message.get("id").is_none(),
                "unexpected server request: {message}"
            );
            self.notifications.push(message);
        }
    }

    async fn completed(&mut self) -> Value {
        loop {
            if let Some(index) = self
                .notifications
                .iter()
                .position(|n| n["method"] == "turn/completed")
            {
                let message = self.notifications.remove(index);
                assert_eq!(
                    message["params"]["turn"]["status"], "completed",
                    "{message}"
                );
                return message["params"]["turn"].clone();
            }
            let message = self.read().await;
            self.notifications.push(message);
        }
    }

    async fn close(mut self) {
        drop(self.stdin.take());
        assert!(
            tokio::time::timeout(Duration::from_secs(30), self.child.wait())
                .await
                .unwrap()
                .unwrap()
                .success()
        );
    }

    async fn provision(&mut self, fixture: &ModelFixture) -> String {
        let provider = self.rpc("modelProvider/create", json!({
            "name": fixture.wire.model(), "providerType": fixture.wire.provider_type().to_string(),
            "apiHost": fixture.url,
        })).await;
        let id = provider["provider"]["id"].as_str().unwrap();
        self.rpc("modelProvider/update", json!({
            "providerId":id,"enabled":true,"models":[{
                "id":fixture.wire.model(),"capability":{
                    "taskFamilies":["chat"],"inputModalities":["text"],"outputModalities":["text"],
                    "runtimeFeatures":["streaming","tool_calling"],
                    "capabilities":{"vision":false,"tools":true,"streaming":true,"jsonMode":false,
                        "functionCalling":true,"reasoning":false},
                },
            }],
        })).await;
        self.rpc(
            "modelProviderKey/create",
            json!({
                "providerId":id,"apiKey":fixture.wire.credential(),"replaceExisting":true,
            }),
        )
        .await;
        id.to_string()
    }
}

fn fixed_binary() -> tempfile::TempPath {
    let source = std::env::var_os("LIME_TEST_APP_SERVER_BIN")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_BIN_EXE_app-server")).to_path_buf());
    let file = tempfile::Builder::new()
        .prefix("context-compaction-")
        .suffix(std::env::consts::EXE_SUFFIX)
        .tempfile_in(source.parent().unwrap())
        .unwrap();
    std::fs::copy(&source, file.path()).unwrap();
    let mut source = std::fs::File::open(file.path()).unwrap();
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = source.read(&mut buffer).unwrap();
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    eprintln!(
        "context compaction stdio artifact sha256={:x}",
        digest.finalize()
    );
    file.into_temp_path()
}

#[tokio::test]
async fn real_stdio_compaction_and_restart_keep_portable_history_across_four_protocols() {
    let temp = TempDir::new().unwrap();
    let binary = fixed_binary();
    let fixtures = [
        ModelFixture::start(Wire::Chat).await,
        ModelFixture::start(Wire::Responses).await,
        ModelFixture::start(Wire::Anthropic).await,
        ModelFixture::start(Wire::Gemini).await,
    ];
    let mut peer = Peer::start(temp.path(), &binary).await;
    let mut providers = Vec::new();
    for fixture in &fixtures {
        providers.push(peer.provision(fixture).await);
    }
    let thread = peer
        .rpc(
            "thread/start",
            json!({
                "cwd":temp.path(),"model":Wire::Chat.model(),"modelProvider":providers[0],
            }),
        )
        .await;
    let id = thread["thread"]["id"].as_str().unwrap();
    peer.rpc(
        "turn/start",
        json!({"threadId":id,"input":[{"type":"text","text":"stdio-user-constraint"}]}),
    )
    .await;
    peer.completed().await;
    let mut previous_summary = String::new();
    for (fixture, provider) in fixtures.iter().zip(&providers) {
        peer.rpc(
            "thread/settings/update",
            json!({
                "threadId":id,"model":fixture.wire.model(),"modelProvider":provider,
            }),
        )
        .await;
        peer.rpc("thread/compact/start", json!({"threadId":id}))
            .await;
        let turn = peer.completed().await;
        assert!(turn["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item["type"] == "contextCompaction"));
        let capture = fixture.last_request();
        capture.assert_route(fixture.wire);
        let history = capture.history().to_string();
        assert!(history.contains("stdio-user-constraint"), "{history}");
        assert!(history.contains(&previous_summary), "{history}");
        previous_summary = format!("MODEL-SUMMARY-1: {:?}", fixture.wire);
    }
    peer.close().await;
    let mut reopened = Peer::start(temp.path(), &binary).await;
    reopened.rpc("thread/resume", json!({"threadId":id})).await;
    reopened.rpc("turn/start", json!({"threadId":id,"input":[{"type":"text","text":"continue after process restart"}]})).await;
    reopened.completed().await;
    let capture = fixtures.last().unwrap().last_request();
    capture.assert_route(Wire::Gemini);
    assert!(capture.history().to_string().contains(&previous_summary));
    let read = reopened
        .rpc("thread/read", json!({"threadId":id,"includeTurns":true}))
        .await;
    let turns = read["thread"]["turns"].as_array().unwrap();
    assert_eq!(
        turns
            .iter()
            .flat_map(|turn| turn["items"].as_array().unwrap())
            .filter(|item| item["type"] == "contextCompaction")
            .count(),
        4
    );
    reopened.close().await;
}
