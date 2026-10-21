use super::*;
use app_server_protocol::protocol::v2::METHOD_ROLLOUT_COMPRESS;

async fn initialize_experimental(server: &AppServer) {
    request(
        server,
        1,
        METHOD_INITIALIZE,
        json!({
            "clientInfo": {"name": "rollout-maintenance-test", "version": "1.0.0"},
            "capabilities": {"experimentalApi": true}
        }),
    )
    .await;
    server
        .handle_json_line(&json!({"method": METHOD_INITIALIZED}).to_string())
        .await
        .unwrap();
}

#[tokio::test]
async fn rollout_compress_ack_schedules_a_local_pass_without_changing_thread_identity() {
    let (temp, server) = test_server();
    initialize_experimental(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"model": "gpt-5.4", "modelProvider": "openai"}),
    )
    .await;
    let thread_id = started
        .pointer("/result/thread/id")
        .unwrap()
        .as_str()
        .unwrap();
    let root = temp.path().join("agent-root");
    let path = rollout_files(&root.join("sessions")).pop().unwrap();
    let bytes = fs::read(&path).unwrap();
    fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .unwrap()
        .set_times(
            fs::FileTimes::new()
                .set_modified(std::time::SystemTime::now() - Duration::from_secs(8 * 24 * 60 * 60)),
        )
        .unwrap();
    for params in [json!({"force": true}), json!([]), json!(false)] {
        let lines = request_lines(&server, 3, METHOD_ROLLOUT_COMPRESS, params).await;
        assert_eq!(lines.len(), 1);
        assert_eq!(
            lines[0].pointer("/error/code"),
            Some(&json!(error_codes::INVALID_PARAMS))
        );
    }
    assert!(!root.join(".tmp/rollout-compression.lock").exists());
    let ack = request_lines(&server, 4, METHOD_ROLLOUT_COMPRESS, Value::Null).await;
    assert_eq!(ack.len(), 1);
    assert_eq!(ack[0].get("result"), Some(&json!({})));
    let mut name = path.as_os_str().to_owned();
    name.push(".zst");
    let compressed = PathBuf::from(name);
    timeout(Duration::from_secs(5), async {
        while path.exists() || !compressed.exists() {
            sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("background compression must finish");
    assert_eq!(
        zstd::stream::decode_all(fs::File::open(&compressed).unwrap()).unwrap(),
        bytes
    );
    let read = request(
        &server,
        5,
        METHOD_THREAD_READ,
        json!({"threadId": thread_id}),
    )
    .await;
    assert_eq!(read.pointer("/result/thread/id"), Some(&json!(thread_id)));
    assert!(!path.exists(), "public read must not materialize");
    let repeated = request(&server, 6, METHOD_ROLLOUT_COMPRESS, json!({})).await;
    assert_eq!(repeated.get("result"), Some(&json!({})));
}

#[tokio::test]
async fn rollout_compress_requires_a_local_rollout_owner() {
    let server = AppServer::with_runtime(RuntimeCore::with_backend(Arc::new(MockBackend)));
    initialize_experimental(&server).await;
    let lines = request_lines(&server, 2, METHOD_ROLLOUT_COMPRESS, Value::Null).await;
    assert_eq!(lines.len(), 1);
    assert_eq!(
        lines[0].pointer("/error/code"),
        Some(&json!(error_codes::METHOD_NOT_FOUND))
    );
    assert!(lines[0].get("result").is_none());
}

#[tokio::test]
async fn rollout_compress_requires_connection_experimental_opt_in() {
    let (temp, server) = test_server();
    initialize_server(&server).await;
    let lines = request_lines(&server, 2, METHOD_ROLLOUT_COMPRESS, Value::Null).await;
    assert_eq!(lines.len(), 1);
    assert_eq!(
        lines[0].pointer("/error/code"),
        Some(&json!(error_codes::INVALID_REQUEST))
    );
    assert_eq!(
        lines[0].pointer("/error/message"),
        Some(&json!(
            "rollout/compress requires experimentalApi capability"
        ))
    );
    assert!(!temp.path().join("agent-root/.tmp").exists());
}

#[tokio::test]
async fn startup_compression_uses_the_shared_config_gate_and_defaults_off() {
    for enabled in [false, true] {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("agent-root");
        let projection = Arc::new(
            ProjectionStore::initialize_with_agent_root(
                root.join("runtime/projection.sqlite"),
                &root,
            )
            .unwrap(),
        );
        let config_path = temp.path().join("config.yaml");
        fs::write(
            &config_path,
            if enabled {
                "experimental:\n  local_thread_store_compression: true\n"
            } else {
                "{}\n"
            },
        )
        .unwrap();
        let runtime = RuntimeCore::with_backend(Arc::new(MockBackend))
            .with_app_config_path(config_path)
            .with_projection_store(projection);
        let _server = AppServer::with_runtime(runtime);
        let marker = root.join(".tmp/rollout-compression.lock");
        if enabled {
            timeout(Duration::from_secs(5), async {
                while !marker.exists() {
                    sleep(Duration::from_millis(10)).await;
                }
            })
            .await
            .expect("enabled startup must claim the worker marker");
        } else {
            tokio::task::yield_now().await;
            assert!(
                !root.join(".tmp").exists(),
                "default startup must not schedule maintenance"
            );
        }
    }
}
