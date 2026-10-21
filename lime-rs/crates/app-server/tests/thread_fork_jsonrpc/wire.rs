use super::*;
use ephemeral::{fork_with_started_notification, start_and_complete};

#[path = "../turn_final_completion_jsonrpc/provider.rs"]
mod provider;
use provider::{Provider, Wire, REASONING};

#[path = "standalone.rs"]
mod standalone;

async fn ephemeral_provider_history(source_wire: Wire, target_wire: Wire) {
    let temp = TempDir::new().unwrap();
    let source_provider = Provider::start(source_wire, true).await;
    let target_provider = Provider::start(target_wire, false).await;
    let runtime = support::runtime_core_with_chat_providers_at(
        &temp,
        &[
            (
                "source-provider",
                "source-model",
                source_wire.provider_type(),
                &source_provider.url,
                "source-fixture-key",
            ),
            (
                "final-provider",
                "final-model",
                target_wire.provider_type(),
                &target_provider.url,
                "final-fixture-key",
            ),
        ],
    )
    .with_event_log_writer(Arc::new(
        EventLogWriter::new(temp.path().join("events")).unwrap(),
    ));
    let server = AppServer::with_runtime(runtime);
    initialize(&server, 1).await;
    let source = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "cwd":temp.path(), "modelProvider":"source-provider", "model":"source-model"
        }),
    )
    .await;
    let source = required_string(&source, "/result/thread/id");
    let updated = request(
        &server,
        3,
        app_server_protocol::protocol::v2::METHOD_THREAD_SETTINGS_UPDATE,
        json!({
            "threadId":source,
            "collaborationMode":{
                "mode":"plan",
                "settings":{
                    "model":"source-model","reasoning_effort":null,
                    "developer_instructions":"source plan instructions"
                }
            }
        }),
    )
    .await;
    assert!(updated.get("error").is_none(), "{updated}");
    start_and_complete(
        &server,
        &source,
        json!([{"type":"text","text":"fork provider source"}]),
    )
    .await;
    assert_eq!(source_provider.requests().len(), 1);
    let fork = fork_with_started_notification(
        &server,
        json!({
            "threadId":source, "ephemeral":true,
            "modelProvider":"final-provider", "model":"final-model"
        }),
        Some(14),
    )
    .await;
    let target = required_string(&fork, "/result/thread/id");
    start_and_complete(
        &server,
        &target,
        json!([{"type":"text","text":"continue provider fork"}]),
    )
    .await;
    let requests = target_provider.requests();
    assert_eq!(requests.len(), 1, "normal empty final must not resample");
    target_wire.assert_route(&requests[0]);
    let history = target_wire.history(&requests[0].body).to_string();
    assert_eq!(
        history.matches("fork provider source").count(),
        1,
        "{source_wire:?} -> {target_wire:?}: {history}"
    );
    assert_eq!(
        history.matches(REASONING).count(),
        usize::from(!matches!(source_wire, Wire::Responses)),
        "{source_wire:?} -> {target_wire:?}: {history}"
    );
    assert!(history.contains("continue provider fork"));
    let read = request(
        &server,
        4,
        METHOD_THREAD_READ,
        json!({"threadId":target,"includeTurns":false}),
    )
    .await;
    assert_eq!(read["result"]["thread"]["forkedFromId"], source);
}

#[tokio::test]
async fn ephemeral_fork_chat_provider_history() {
    ephemeral_provider_history(Wire::Chat, Wire::Chat).await;
}

#[tokio::test]
async fn ephemeral_fork_responses_provider_history() {
    ephemeral_provider_history(Wire::Responses, Wire::Responses).await;
}

#[tokio::test]
async fn ephemeral_fork_anthropic_provider_history() {
    ephemeral_provider_history(Wire::Anthropic, Wire::Anthropic).await;
}

#[tokio::test]
async fn ephemeral_fork_gemini_provider_history() {
    ephemeral_provider_history(Wire::Gemini, Wire::Gemini).await;
}

#[tokio::test]
async fn ephemeral_fork_switches_model_provider_and_protocol() {
    ephemeral_provider_history(Wire::Chat, Wire::Anthropic).await;
}
