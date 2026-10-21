use super::*;
use app_server_protocol::protocol::v2::METHOD_THREAD_SETTINGS_UPDATE;
use ephemeral::{fork_with_started_notification, start_and_complete};

#[tokio::test]
async fn fork_starts_in_default_mode_and_uses_its_selected_model_after_restart() {
    let temp = TempDir::new().unwrap();
    let backend = Arc::new(HistoryCaptureBackend::default());
    let runtime = || {
        RuntimeCore::with_backend(backend.clone())
            .with_projection_store(Arc::new(
                ProjectionStore::initialize_with_agent_root(
                    temp.path().join("projection.sqlite"),
                    temp.path().join("agent"),
                )
                .unwrap(),
            ))
            .with_event_log_writer(Arc::new(
                EventLogWriter::new(temp.path().join("events")).unwrap(),
            ))
    };
    let server = AppServer::with_runtime(runtime());
    initialize(&server, 1).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"cwd":temp.path(),"model":"source-model","modelProvider":"source-provider"}),
    )
    .await;
    let source = required_string(&started, "/result/thread/id");
    let updated = request(
        &server,
        3,
        METHOD_THREAD_SETTINGS_UPDATE,
        json!({
            "threadId":source,"serviceTier":"priority",
            "collaborationMode":{
                "mode":"plan",
                "settings":{
                    "model":"source-model","reasoning_effort":"high",
                    "developer_instructions":"source-only plan instructions"
                }
            }
        }),
    )
    .await;
    assert!(updated.get("error").is_none(), "{updated}");
    start_and_complete(
        &server,
        &source,
        json!([{"type":"text","text":"source plan turn"}]),
    )
    .await;
    {
        let requests = backend.requests.lock().unwrap();
        let source_request = &requests[0];
        assert_eq!(
            source_request.model_preference.as_deref(),
            Some("source-model")
        );
        assert_eq!(
            source_request.collaboration_mode.as_ref().unwrap().mode,
            agent_protocol::ModeKind::Plan
        );
        assert_eq!(source_request.reasoning_effort.as_deref(), Some("high"));
        assert_eq!(source_request.service_tier.as_deref(), Some("priority"));
    }
    let mut durable = Vec::new();
    for (overrides, model, provider, effort, tier) in [
        (
            json!({}),
            "source-model",
            "source-provider",
            Some("high"),
            Some("priority"),
        ),
        (
            json!({"model":"source-model"}),
            "source-model",
            "source-provider",
            Some("high"),
            Some("priority"),
        ),
        (
            json!({"model":"fork-model"}),
            "fork-model",
            "source-provider",
            None,
            None,
        ),
        (
            json!({"modelProvider":"fork-provider"}),
            "source-model",
            "fork-provider",
            None,
            None,
        ),
        (
            json!({"model":"fork-model","modelProvider":"fork-provider","serviceTier":"flex"}),
            "fork-model",
            "fork-provider",
            None,
            Some("flex"),
        ),
        (
            json!({"model":"fork-model","serviceTier":null}),
            "fork-model",
            "source-provider",
            None,
            None,
        ),
    ] {
        for ephemeral in [false, true] {
            let mut params = overrides.clone();
            params["threadId"] = json!(source);
            params["ephemeral"] = json!(ephemeral);
            let fork = fork_with_started_notification(&server, params, None).await;
            let target = required_string(&fork, "/result/thread/id");
            assert_eq!(fork["result"]["model"], model, "{overrides}");
            assert_eq!(fork["result"]["modelProvider"], provider, "{overrides}");
            start_and_complete(
                &server,
                &target,
                json!([{"type":"text","text":"continue fork"}]),
            )
            .await;
            assert_fork_request(&backend, model, provider, effort, tier);
            if !ephemeral {
                durable.push((target, model, provider, effort, tier));
            }
        }
    }
    // Forking cannot rewrite the source's selected Plan mode or model-bound settings.
    start_and_complete(
        &server,
        &source,
        json!([{"type":"text","text":"continue source"}]),
    )
    .await;
    {
        let requests = backend.requests.lock().unwrap();
        let request = requests.last().unwrap();
        assert_eq!(request.model_preference.as_deref(), Some("source-model"));
        assert_eq!(
            request.collaboration_mode.as_ref().unwrap().mode,
            agent_protocol::ModeKind::Plan
        );
        assert_eq!(
            request.system_prompt.as_deref(),
            Some("source-only plan instructions")
        );
    }
    drop(server);
    let server = AppServer::with_runtime(runtime());
    initialize(&server, 1).await;
    for (target, model, provider, effort, tier) in durable {
        let resumed = request(&server, 5, METHOD_THREAD_RESUME, json!({"threadId":target})).await;
        assert!(resumed.get("error").is_none(), "{resumed}");
        start_and_complete(
            &server,
            &target,
            json!([{"type":"text","text":"cold fork"}]),
        )
        .await;
        assert_fork_request(&backend, model, provider, effort, tier);
    }
}

fn assert_fork_request(
    backend: &HistoryCaptureBackend,
    model: &str,
    provider: &str,
    effort: Option<&str>,
    tier: Option<&str>,
) {
    let requests = backend.requests.lock().unwrap();
    let request = requests.last().unwrap();
    assert_eq!(request.model_preference.as_deref(), Some(model));
    assert_eq!(request.provider_preference.as_deref(), Some(provider));
    assert!(request
        .collaboration_mode
        .as_ref()
        .is_none_or(|mode| mode.mode == agent_protocol::ModeKind::Default));
    assert_eq!(request.reasoning_effort.as_deref(), effort);
    assert_eq!(request.service_tier.as_deref(), tier);
    assert!(
        request.system_prompt.is_none(),
        "source Plan instructions leaked: {request:?}"
    );
}
