use super::*;

#[tokio::test]
async fn append_external_runtime_events_returns_json_rpc_notifications() {
    let (_temp, server) = server_with_projection_store();
    initialize(&server).await;
    let thread_response = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model": "gpt-4.1-mini",
            "modelProvider": "openai"
        }),
    )
    .await;
    let thread_id = thread_response["thread"]["id"].as_str().expect("thread id");
    let turn_response = request(
        &server,
        3,
        METHOD_TURN_START,
        json!({
            "threadId": thread_id,
            "input": [{"type": "text", "text": "draft"}]
        }),
    )
    .await;
    let turn_id = turn_response["turn"]["id"].as_str().expect("turn id");

    let notifications = server
        .append_external_runtime_events(
            thread_response["thread"]["sessionId"]
                .as_str()
                .expect("session id"),
            Some(turn_id),
            vec![RuntimeEvent::new(
                "message.delta",
                json!({ "text": "delta" }),
            )],
        )
        .await
        .expect("notifications");

    assert_eq!(notifications.len(), 2);
    match &notifications[0] {
        JsonRpcMessage::Notification(notification) => {
            assert_eq!(notification.method, "item/started");
            let params = notification.params.as_ref().expect("params");
            assert_eq!(params["threadId"], thread_id);
            assert_eq!(params["turnId"], turn_id);
            assert_eq!(params["item"]["type"], "agentMessage");
        }
        other => panic!("expected notification, got {other:?}"),
    }
    match &notifications[1] {
        JsonRpcMessage::Notification(notification) => {
            assert_eq!(notification.method, "item/agentMessage/delta");
            let params = notification.params.as_ref().expect("params");
            assert_eq!(params["threadId"], thread_id);
            assert_eq!(params["turnId"], turn_id);
            assert_eq!(params["delta"], "delta");
        }
        other => panic!("expected notification, got {other:?}"),
    }
}

#[tokio::test]
async fn append_external_runtime_events_publishes_outbound_notification() {
    let (_temp, server) = server_with_projection_store();
    initialize(&server).await;
    let thread_response = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model": "gpt-4.1-mini",
            "modelProvider": "openai"
        }),
    )
    .await;
    let thread_id = thread_response["thread"]["id"].as_str().expect("thread id");
    let turn_response = request(
        &server,
        3,
        METHOD_TURN_START,
        json!({
            "threadId": thread_id,
            "input": [{"type": "text", "text": "draft"}]
        }),
    )
    .await;
    let turn_id = turn_response["turn"]["id"].as_str().expect("turn id");
    let mut outbound_messages = server.subscribe_outbound_messages();

    server
        .append_external_runtime_events(
            thread_response["thread"]["sessionId"]
                .as_str()
                .expect("session id"),
            Some(turn_id),
            vec![RuntimeEvent::new(
                "message.delta",
                json!({ "text": "async delta" }),
            )],
        )
        .await
        .expect("notifications");

    let lifecycle_message =
        tokio::time::timeout(std::time::Duration::from_secs(1), outbound_messages.recv())
            .await
            .expect("outbound lifecycle message")
            .expect("broadcast lifecycle message");
    match lifecycle_message {
        JsonRpcMessage::Notification(notification) => {
            assert_eq!(notification.method, "item/started");
            let params = notification.params.as_ref().expect("params");
            assert_eq!(params["threadId"], thread_id);
            assert_eq!(params["turnId"], turn_id);
            assert_eq!(params["item"]["type"], "agentMessage");
        }
        other => panic!("expected outbound lifecycle notification, got {other:?}"),
    }
    let delta_message = tokio::time::timeout(std::time::Duration::from_secs(1), async {
        loop {
            let message = outbound_messages
                .recv()
                .await
                .expect("broadcast delta message");
            if matches!(
                &message,
                JsonRpcMessage::Notification(notification)
                    if notification.method == "item/agentMessage/delta"
            ) {
                break message;
            }
        }
    })
    .await
    .expect("outbound delta message");
    match delta_message {
        JsonRpcMessage::Notification(notification) => {
            assert_eq!(notification.method, "item/agentMessage/delta");
            let params = notification.params.as_ref().expect("params");
            assert_eq!(params["threadId"], thread_id);
            assert_eq!(params["turnId"], turn_id);
            assert_eq!(params["delta"], "async delta");
        }
        other => panic!("expected outbound notification, got {other:?}"),
    }
}

#[tokio::test]
async fn thread_listener_orders_resume_replay_before_scoped_live_event() {
    let server = AppServer::new();
    let subscribed_connection = ConnectionId(201);
    let unrelated_connection = ConnectionId(202);
    let (subscribed_writer, mut subscribed_messages) = mpsc::channel(8);
    let (unrelated_writer, mut unrelated_messages) = mpsc::channel(8);

    server.register_transport_writer(subscribed_connection, subscribed_writer, None);
    server.register_transport_writer(unrelated_connection, unrelated_writer, None);
    server.mark_transport_initialized(subscribed_connection);
    server.mark_transport_initialized(unrelated_connection);
    server
        .thread_states
        .connection_initialized(subscribed_connection)
        .await;
    server
        .thread_states
        .connection_initialized(unrelated_connection)
        .await;

    let thread_id = agent_protocol::ThreadId::new("thread-ordered");
    let response = JsonRpcMessage::Response(app_server_protocol::JsonRpcResponse {
        id: RequestId::String("resume-1".to_string()),
        result: json!({ "thread": { "id": thread_id.as_str() } }),
    });
    let pending_request = JsonRpcMessage::Request(JsonRpcRequest::new(
        RequestId::String("pending-1".to_string()),
        "item/tool/requestUserInput",
        Some(json!({ "threadId": thread_id.as_str() })),
    ));
    let usage = JsonRpcMessage::Notification(thread_token_usage_notification(
        thread_id.as_str(),
        runtime::thread_usage::ThreadTokenUsageSnapshot {
            turn_id: "turn-usage".to_string(),
            total_token_usage: runtime::thread_usage::TokenUsageSnapshot {
                input_tokens: 90,
                cached_input_tokens: 30,
                cache_write_input_tokens: 12,
                output_tokens: 30,
                reasoning_output_tokens: 10,
                total_tokens: 120,
            },
            last_token_usage: runtime::thread_usage::TokenUsageSnapshot {
                input_tokens: 45,
                cached_input_tokens: 15,
                cache_write_input_tokens: 6,
                output_tokens: 15,
                reasoning_output_tokens: 5,
                total_tokens: 60,
            },
            model_context_window: Some(128_000),
            source_sequence: 7,
        },
    ));
    let goal = JsonRpcMessage::Notification(
        app_server_protocol::protocol::v2::ServerNotification::ThreadGoalUpdated(
            app_server_protocol::protocol::v2::ThreadGoalUpdatedNotification {
                thread_id: thread_id.as_str().to_string(),
                turn_id: None,
                goal: app_server_protocol::protocol::v2::ThreadGoal {
                    thread_id: thread_id.as_str().to_string(),
                    objective: "finish ordered resume".to_string(),
                    status: app_server_protocol::protocol::v2::ThreadGoalStatus::Active,
                    token_budget: Some(1_000),
                    tokens_used: 120,
                    time_used_seconds: 3,
                    created_at: 1,
                    updated_at: 2,
                },
            },
        )
        .into(),
    );
    let bridge = server.event_bridge();
    let barrier = thread_state::ThreadResumeBarrier::new(
        subscribed_connection,
        RequestId::String("resume-1".to_string()),
    );
    bridge
        .prepare_thread_resume(thread_id.clone(), barrier.clone())
        .await
        .expect("prepare resume barrier");

    bridge
        .send_thread_command(
            thread_id.clone(),
            thread_state::ThreadListenerCommand::PublishRuntimeEvent {
                event: AgentEvent {
                    event_id: "event-live-1".to_string(),
                    sequence: 1,
                    session_id: "session-ordered".to_string(),
                    thread_id: Some(thread_id.as_str().to_string()),
                    turn_id: Some("turn-1".to_string()),
                    event_type: "provider.request.started".to_string(),
                    timestamp: "2026-07-19T00:00:00Z".to_string(),
                    payload: json!({ "phase": "streaming" }),
                },
                completion_tx: None,
            },
        )
        .await
        .expect("queue live event behind resume barrier");

    let (completion_tx, completion_rx) = oneshot::channel();
    bridge
        .send_thread_command(
            thread_id.clone(),
            thread_state::ThreadListenerCommand::CompleteResume {
                barrier,
                connection_id: subscribed_connection,
                messages: vec![
                    response.clone(),
                    usage.clone(),
                    goal.clone(),
                    pending_request.clone(),
                ],
                subscribe: true,
                completion_tx,
            },
        )
        .await
        .expect("complete resume barrier");
    completion_rx
        .await
        .expect("listener completion")
        .expect("send resume response and live event");

    let first = subscribed_messages
        .recv()
        .await
        .expect("resume response")
        .message
        .into_json_rpc_message();
    let second = subscribed_messages
        .recv()
        .await
        .expect("token usage replay")
        .message
        .into_json_rpc_message();
    let third = subscribed_messages
        .recv()
        .await
        .expect("goal snapshot")
        .message
        .into_json_rpc_message();
    let fourth = tokio::time::timeout(
        std::time::Duration::from_secs(1),
        subscribed_messages.recv(),
    )
    .await
    .expect("pending replay timeout")
    .expect("pending replay")
    .message
    .into_json_rpc_message();
    let fifth = tokio::time::timeout(
        std::time::Duration::from_secs(1),
        subscribed_messages.recv(),
    )
    .await
    .expect("live event timeout")
    .expect("live event")
    .message
    .into_json_rpc_message();

    assert_eq!(first, response);
    assert_eq!(second, usage);
    let replayed_usage = serde_json::to_value(&second).expect("serialize usage replay");
    assert_eq!(
        replayed_usage.pointer("/params/tokenUsage/total/cacheWriteInputTokens"),
        Some(&json!(12))
    );
    assert_eq!(
        replayed_usage.pointer("/params/tokenUsage/last/cacheWriteInputTokens"),
        Some(&json!(6))
    );
    assert_eq!(third, goal);
    assert_eq!(fourth, pending_request);
    assert!(matches!(fifth, JsonRpcMessage::Notification(_)));
    assert!(matches!(
        unrelated_messages.try_recv(),
        Err(mpsc::error::TryRecvError::Empty)
    ));
}
