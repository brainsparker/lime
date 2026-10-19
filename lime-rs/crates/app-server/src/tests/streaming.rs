use super::*;

#[tokio::test]
async fn json_lines_loop_writes_external_outbound_notification() {
    let (_temp, server) = server_with_projection_store();
    let (mut input_client, input_server) = tokio::io::duplex(4096);
    let (output_server, output_client) = tokio::io::duplex(4096);
    let runner_server = server.clone();
    let runner =
        tokio::spawn(
            async move { run_json_lines(runner_server, input_server, output_server).await },
        );
    let mut output_lines = BufReader::new(output_client).lines();

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(1),
            METHOD_INITIALIZE,
            Some(
                serde_json::to_value(InitializeParams {
                    client_info: ClientInfo {
                        name: "json-lines-test".to_string(),
                        title: None,
                        version: None,
                    },
                    capabilities: ClientCapabilities::default(),
                })
                .expect("initialize params"),
            ),
        )),
    )
    .await;
    assert_response_id(
        next_json_message(&mut output_lines).await,
        RequestId::Integer(1),
    );

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Notification(JsonRpcNotification::new(
            METHOD_INITIALIZED,
            Some(json!({})),
        )),
    )
    .await;
    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(2),
            METHOD_THREAD_START,
            Some(json!({
                "model": "fixture-model",
                "modelProvider": "fixture-provider"
            })),
        )),
    )
    .await;
    let thread_start = next_json_message(&mut output_lines).await;
    let (thread_id, session_id) = match thread_start {
        JsonRpcMessage::Response(response) => (
            response.result["thread"]["id"]
                .as_str()
                .expect("thread id")
                .to_string(),
            response.result["thread"]["sessionId"]
                .as_str()
                .expect("session id")
                .to_string(),
        ),
        other => panic!("expected thread response, got {other:?}"),
    };

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(3),
            METHOD_TURN_START,
            Some(json!({
                "threadId": thread_id,
                "input": [{"type": "text", "text": "draft"}]
            })),
        )),
    )
    .await;
    let turn_result = next_json_response_result(&mut output_lines, RequestId::Integer(3)).await;
    let turn_id = turn_result["turn"]["id"]
        .as_str()
        .expect("turn id")
        .to_string();

    server
        .append_external_runtime_events(
            &session_id,
            Some(&turn_id),
            vec![RuntimeEvent::new(
                "message.delta",
                json!({ "text": "stdio async delta" }),
            )],
        )
        .await
        .expect("append external event");

    assert_next_direct_delta_notification(
        &mut output_lines,
        &thread_id,
        &turn_id,
        "stdio async delta",
    )
    .await;

    drop(input_client);
    runner.await.expect("runner join").expect("runner result");
}

#[tokio::test]
async fn json_lines_loop_streams_external_backend_events_before_turn_response() {
    let Some(node) = node_binary() else {
        return;
    };
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let script_path = temp_dir.path().join("external-backend-stream.mjs");
    std::fs::write(
        &script_path,
        r#"
          import { setTimeout as delay } from 'node:timers/promises';
          for await (const chunk of process.stdin) {}
          console.log(JSON.stringify({
            type: 'message.delta',
            payload: { chunk: 1, text: 'hello' }
          }));
          await delay(10);
          console.log(JSON.stringify({
            type: 'message.delta',
            payload: { chunk: 2, text: 'world' }
          }));
        "#,
    )
    .expect("write backend script");

    let runtime = AppServerRuntimeFactory::external_runtime_core(
        ExternalBackendConfig::new(node)
            .with_args([script_path.to_string_lossy().to_string()])
            .with_timeout_ms(10_000),
    )
    .with_projection_store(Arc::new(
        ProjectionStore::initialize(temp_dir.path().join("projection.sqlite"))
            .expect("projection store"),
    ));
    let server = AppServer::with_runtime(runtime);
    let (mut input_client, input_server) = tokio::io::duplex(4096);
    let (output_server, output_client) = tokio::io::duplex(4096);
    let runner =
        tokio::spawn(async move { run_json_lines(server, input_server, output_server).await });
    let mut output_lines = BufReader::new(output_client).lines();

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(1),
            METHOD_INITIALIZE,
            Some(
                serde_json::to_value(InitializeParams {
                    client_info: ClientInfo {
                        name: "content-studio".to_string(),
                        title: None,
                        version: Some("0.1.0".to_string()),
                    },
                    capabilities: ClientCapabilities::default(),
                })
                .expect("initialize params"),
            ),
        )),
    )
    .await;
    assert_response_id(
        next_json_message(&mut output_lines).await,
        RequestId::Integer(1),
    );

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Notification(JsonRpcNotification::new(
            METHOD_INITIALIZED,
            Some(json!({})),
        )),
    )
    .await;
    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(2),
            METHOD_THREAD_START,
            Some(json!({
                "model": "fixture-model",
                "modelProvider": "fixture-provider"
            })),
        )),
    )
    .await;
    let thread_id = match next_json_message(&mut output_lines).await {
        JsonRpcMessage::Response(response) => response.result["thread"]["id"]
            .as_str()
            .expect("thread id")
            .to_string(),
        other => panic!("expected thread response, got {other:?}"),
    };

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(3),
            METHOD_TURN_START,
            Some(json!({
                "threadId": thread_id,
                "input": [{"type": "text", "text": "draft"}]
            })),
        )),
    )
    .await;

    let turn_result = next_json_response_result(&mut output_lines, RequestId::Integer(3)).await;
    assert_eq!(turn_result["turn"]["status"], "inProgress");
    let turn_id = turn_result["turn"]["id"]
        .as_str()
        .expect("turn id")
        .to_string();
    assert_next_direct_delta_notification(&mut output_lines, &thread_id, &turn_id, "hello").await;
    assert_next_direct_delta_notification(&mut output_lines, &thread_id, &turn_id, "world").await;

    drop(input_client);
    runner.await.expect("runner join").expect("runner result");
}

#[tokio::test]
async fn json_lines_loop_lists_sessions_while_external_turn_is_waiting_for_first_output() {
    let Some(node) = node_binary() else {
        return;
    };
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let script_path = temp_dir
        .path()
        .join("external-backend-waits-before-output.mjs");
    let trigger_path = temp_dir.path().join("release-backend-output");
    std::fs::write(
        &script_path,
        r#"
          import { access } from 'node:fs/promises';
          import { setTimeout as delay } from 'node:timers/promises';
          const triggerPath = process.argv[2];
          for (;;) {
            try {
              await access(triggerPath);
              break;
            } catch {
              await delay(10);
            }
          }
          console.log(JSON.stringify({
            type: 'message.delta',
            payload: { text: 'late first output' }
          }));
        "#,
    )
    .expect("write backend script");

    let runtime = AppServerRuntimeFactory::external_runtime_core(
        ExternalBackendConfig::new(node)
            .with_args([
                script_path.to_string_lossy().to_string(),
                trigger_path.to_string_lossy().to_string(),
            ])
            .with_timeout_ms(10_000),
    )
    .with_projection_store(Arc::new(
        ProjectionStore::initialize(temp_dir.path().join("projection.sqlite"))
            .expect("projection store"),
    ));
    let server = AppServer::with_runtime(runtime);
    let (mut input_client, input_server) = tokio::io::duplex(4096);
    let (output_server, output_client) = tokio::io::duplex(4096);
    let runner =
        tokio::spawn(async move { run_json_lines(server, input_server, output_server).await });
    let mut output_lines = BufReader::new(output_client).lines();

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(1),
            METHOD_INITIALIZE,
            Some(
                serde_json::to_value(InitializeParams {
                    client_info: ClientInfo {
                        name: "content-studio".to_string(),
                        title: None,
                        version: Some("0.1.0".to_string()),
                    },
                    capabilities: ClientCapabilities::default(),
                })
                .expect("initialize params"),
            ),
        )),
    )
    .await;
    assert_response_id(
        next_json_message(&mut output_lines).await,
        RequestId::Integer(1),
    );

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Notification(JsonRpcNotification::new(
            METHOD_INITIALIZED,
            Some(json!({})),
        )),
    )
    .await;
    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(2),
            METHOD_THREAD_START,
            Some(json!({
                "model": "fixture-model",
                "modelProvider": "fixture-provider"
            })),
        )),
    )
    .await;
    let thread_id = match next_json_message(&mut output_lines).await {
        JsonRpcMessage::Response(response) => response.result["thread"]["id"]
            .as_str()
            .expect("thread id")
            .to_string(),
        other => panic!("expected thread response, got {other:?}"),
    };

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(3),
            METHOD_TURN_START,
            Some(json!({
                "threadId": thread_id,
                "input": [{"type": "text", "text": "draft"}]
            })),
        )),
    )
    .await;

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(4),
            METHOD_THREAD_LIST,
            Some(json!({ "limit": 10 })),
        )),
    )
    .await;
    let mut turn_id = None;
    let list_response = loop {
        let message = next_json_message_with_timeout(
            &mut output_lines,
            std::time::Duration::from_millis(500),
        )
        .await;
        match message {
            JsonRpcMessage::Response(response) if response.id == RequestId::Integer(3) => {
                turn_id = Some(
                    response.result["turn"]["id"]
                        .as_str()
                        .expect("turn id")
                        .to_string(),
                );
            }
            JsonRpcMessage::Response(response) if response.id == RequestId::Integer(4) => {
                break response;
            }
            _ => {}
        }
    };
    let turn_id = match turn_id {
        Some(turn_id) => turn_id,
        None => next_json_response_result(&mut output_lines, RequestId::Integer(3)).await["turn"]
            ["id"]
            .as_str()
            .expect("turn id")
            .to_string(),
    };
    let sessions = list_response.result["data"]
        .as_array()
        .expect("thread data array");
    assert!(
        sessions.iter().any(|thread| thread["id"] == thread_id),
        "running thread should be listed while backend waits"
    );

    std::fs::write(&trigger_path, b"continue").expect("release backend output");

    assert_next_direct_delta_notification(
        &mut output_lines,
        &thread_id,
        &turn_id,
        "late first output",
    )
    .await;

    drop(input_client);
    runner.await.expect("runner join").expect("runner result");
}

#[tokio::test]
async fn json_lines_loop_streams_turn_failed_after_partial_external_backend_events() {
    let Some(node) = node_binary() else {
        return;
    };
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let script_path = temp_dir.path().join("external-backend-stream-fails.mjs");
    std::fs::write(
        &script_path,
        r#"
          for await (const chunk of process.stdin) {}
          console.log(JSON.stringify({
            type: 'message.delta',
            payload: { chunk: 1, text: 'partial' }
          }));
          console.error('external backend crashed after partial output');
          process.exitCode = 7;
        "#,
    )
    .expect("write backend script");

    let runtime = AppServerRuntimeFactory::external_runtime_core(
        ExternalBackendConfig::new(node)
            .with_args([script_path.to_string_lossy().to_string()])
            .with_timeout_ms(10_000),
    )
    .with_projection_store(Arc::new(
        ProjectionStore::initialize(temp_dir.path().join("projection.sqlite"))
            .expect("projection store"),
    ));
    let server = AppServer::with_runtime(runtime);
    let (mut input_client, input_server) = tokio::io::duplex(4096);
    let (output_server, output_client) = tokio::io::duplex(4096);
    let runner =
        tokio::spawn(async move { run_json_lines(server, input_server, output_server).await });
    let mut output_lines = BufReader::new(output_client).lines();

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(1),
            METHOD_INITIALIZE,
            Some(
                serde_json::to_value(InitializeParams {
                    client_info: ClientInfo {
                        name: "content-studio".to_string(),
                        title: None,
                        version: Some("0.1.0".to_string()),
                    },
                    capabilities: ClientCapabilities::default(),
                })
                .expect("initialize params"),
            ),
        )),
    )
    .await;
    assert_response_id(
        next_json_message_with_timeout(&mut output_lines, std::time::Duration::from_secs(10)).await,
        RequestId::Integer(1),
    );

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Notification(JsonRpcNotification::new(
            METHOD_INITIALIZED,
            Some(json!({})),
        )),
    )
    .await;
    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(2),
            METHOD_THREAD_START,
            Some(json!({
                "model": "fixture-model",
                "modelProvider": "fixture-provider"
            })),
        )),
    )
    .await;
    let thread_id =
        match next_json_message_with_timeout(&mut output_lines, std::time::Duration::from_secs(10))
            .await
        {
            JsonRpcMessage::Response(response) => response.result["thread"]["id"]
                .as_str()
                .expect("thread id")
                .to_string(),
            other => panic!("expected thread response, got {other:?}"),
        };

    write_json_message(
        &mut input_client,
        JsonRpcMessage::Request(JsonRpcRequest::new(
            RequestId::Integer(3),
            METHOD_TURN_START,
            Some(json!({
                "threadId": thread_id,
                "input": [{"type": "text", "text": "draft"}]
            })),
        )),
    )
    .await;

    let turn_result = next_json_response_result(&mut output_lines, RequestId::Integer(3)).await;
    let turn_id = turn_result["turn"]["id"]
        .as_str()
        .expect("turn id")
        .to_string();
    assert_next_direct_delta_notification(&mut output_lines, &thread_id, &turn_id, "partial").await;
    loop {
        let message =
            next_json_message_with_timeout(&mut output_lines, std::time::Duration::from_secs(10))
                .await;
        let JsonRpcMessage::Notification(notification) = message else {
            continue;
        };
        if notification.method != "turn/completed" {
            continue;
        }
        let params = notification.params.as_ref().expect("params");
        if params["threadId"] != thread_id || params["turn"]["id"] != turn_id {
            continue;
        }
        assert_eq!(params["turn"]["status"], "failed");
        break;
    }

    drop(input_client);
    runner.await.expect("runner join").expect("runner result");
}
