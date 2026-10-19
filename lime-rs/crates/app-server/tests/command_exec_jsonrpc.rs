use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::{process::Stdio, time::Duration};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

#[tokio::test]
async fn interactive_terminal_uses_real_stdio_rpc_and_pty_output() {
    let temp = tempfile::tempdir().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_app-server"))
        .args(["--stdio", "--backend", "unavailable", "--app-data-dir"])
        .arg(temp.path().join("app"))
        .arg("--data-dir")
        .arg(temp.path().join("agent"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    let mut lines = BufReader::new(child.stdout.take().unwrap()).lines();
    let mut output = String::new();
    let process_id = "interactive-terminal";

    macro_rules! send {
        ($value:expr) => {
            input
                .write_all(format!("{}\n", $value).as_bytes())
                .await
                .unwrap()
        };
    }
    macro_rules! receive_until {
        ($predicate:expr) => {
            tokio::time::timeout(Duration::from_secs(15), async {
                loop {
                    let line = lines.next_line().await.unwrap().expect("stdio message");
                    let message: Value = serde_json::from_str(&line).unwrap();
                    assert!(message.get("error").is_none(), "RPC failed: {message}");
                    if message["method"] == "command/exec/outputDelta" {
                        assert_eq!(message["params"]["processId"], process_id);
                        let bytes = STANDARD
                            .decode(message["params"]["deltaBase64"].as_str().unwrap())
                            .unwrap();
                        output.push_str(&String::from_utf8_lossy(&bytes));
                    }
                    if ($predicate)(&message, &output) {
                        break message;
                    }
                }
            })
            .await
            .expect("bounded terminal RPC/output wait")
        };
    }

    send!(
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "clientInfo":{"name":"terminal-stdio-regression","version":"1"}
        }})
    );
    receive_until!(|message: &Value, _: &String| message["id"] == 1);
    send!(json!({"jsonrpc":"2.0","method":"initialized"}));
    let shell = if cfg!(windows) {
        vec!["cmd.exe", "/d"]
    } else {
        vec!["/bin/sh", "-i"]
    };
    send!(
        json!({"jsonrpc":"2.0","id":2,"method":"command/exec","params":{
            "command":shell,"processId":process_id,"tty":true,
            "streamStdin":true,"streamStdoutStderr":true,
            "disableTimeout":true,"disableOutputCap":true,
            "cwd":temp.path(),"size":{"rows":24,"cols":80}
        }})
    );
    receive_until!(|message: &Value, _: &String| message["method"] == "command/exec/outputDelta");

    for (id, suffix) in [(3, "FIRST"), (4, "SECOND")] {
        let marker = format!("LIME_RPC_{suffix}");
        let script = if cfg!(windows) {
            format!("echo {marker}\r")
        } else {
            format!("printf 'LIME_RPC_%s\\n' '{suffix}'\r")
        };
        send!(
            json!({"jsonrpc":"2.0","id":id,"method":"command/exec/write","params":{
                "processId":process_id,"deltaBase64":STANDARD.encode(script)
            }})
        );
        let mut write_succeeded = false;
        receive_until!(|message: &Value, text: &String| {
            if message["id"] == id {
                assert_eq!(message["result"], json!({}));
                write_succeeded = true;
            }
            write_succeeded && text.lines().any(|line| line.trim() == marker)
        });
    }
    send!(
        json!({"jsonrpc":"2.0","id":5,"method":"command/exec/resize","params":{
            "processId":process_id,"size":{"rows":32,"cols":100}
        }})
    );
    let resized = receive_until!(|message: &Value, _: &String| message["id"] == 5);
    assert_eq!(resized["result"], json!({}));
    send!(
        json!({"jsonrpc":"2.0","id":6,"method":"command/exec/write","params":{
            "processId":process_id,"deltaBase64":STANDARD.encode("exit\r")
        }})
    );
    let exited = receive_until!(|message: &Value, _: &String| message["id"] == 2);
    assert_eq!(
        exited["result"],
        json!({"exitCode":0,"stdout":"","stderr":""})
    );
    drop(input);
    assert!(tokio::time::timeout(Duration::from_secs(15), child.wait())
        .await
        .unwrap()
        .unwrap()
        .success());
}
