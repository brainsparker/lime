use super::super::*;
use super::settings_support::{core, resume, run_turn, start_session, SettingsBackend};
use super::tests_support::initialize_processor;
use crate::ProjectionStore;
use serde_json::{json, Value};
use std::sync::Arc;

async fn turn(
    processor: &RequestProcessor,
    backend: &SettingsBackend,
    tier: Option<Value>,
    expected: Option<&str>,
    count: usize,
) {
    let patch = tier.map_or_else(|| json!({}), |value| json!({"serviceTier": value}));
    let request = run_turn(processor, backend, patch, count).await;
    assert_eq!(
        request.service_tier.as_deref(),
        expected,
        "the executing backend must receive the effective tier"
    );
}

#[tokio::test]
async fn turn_tier_patch_reaches_execution_and_persists_across_cold_resume() {
    let temp = tempfile::tempdir().unwrap();
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let backend = Arc::new(SettingsBackend::default());
    let runtime = core(
        store.clone(),
        backend.clone(),
        &temp.path().join("config.yaml"),
    );
    start_session(&runtime);
    let processor = RequestProcessor::new(runtime);
    initialize_processor(&processor).await;
    turn(&processor, &backend, None, Some("priority"), 1).await;
    turn(&processor, &backend, Some(Value::Null), None, 2).await;
    turn(&processor, &backend, None, None, 3).await;
    processor.runtime.shutdown().await.unwrap();
    drop(processor);
    let resumed = RequestProcessor::new(core(
        store.clone(),
        backend.clone(),
        &temp.path().join("config.yaml"),
    ));
    resume(&resumed).await;
    turn(&resumed, &backend, None, None, 4).await;
    turn(&resumed, &backend, Some(json!("flex")), Some("flex"), 5).await;
    turn(&resumed, &backend, None, Some("flex"), 6).await;
    resumed.runtime.shutdown().await.unwrap();
    drop(resumed);
    let reopened = RequestProcessor::new(core(
        store,
        backend.clone(),
        &temp.path().join("config.yaml"),
    ));
    resume(&reopened).await;
    turn(&reopened, &backend, None, Some("flex"), 7).await;
    reopened.runtime.shutdown().await.unwrap();
}

#[tokio::test]
async fn tier_preflight_uses_the_requested_model_and_rejection_preserves_settings() {
    let temp = tempfile::tempdir().unwrap();
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let backend = Arc::new(SettingsBackend::default());
    let processor = RequestProcessor::new(core(
        store,
        backend.clone(),
        &temp.path().join("config.yaml"),
    ));
    start_session(&processor.runtime);
    initialize_processor(&processor).await;
    for params in [
        json!({"threadId":"settings-thread", "input":[{"type":"localImage", "path":""}], "serviceTier":"flex"}),
        json!({"threadId":"settings-thread", "input":[{"type":"text", "text":"continue"}], "model":"new-model", "serviceTier":"unsupported"}),
    ] {
        let messages = processor
            .handle_request(JsonRpcRequest::new(
                RequestId::Integer(1),
                "turn/start",
                Some(params),
            ))
            .await
            .unwrap();
        assert!(
            messages
                .iter()
                .any(|message| matches!(message, JsonRpcMessage::Error(_))),
            "{messages:?}"
        );
    }
    let settings = backend.settings.lock().unwrap().clone();
    assert_eq!(
        settings.len(),
        1,
        "invalid input must fail before settings mutation"
    );
    assert_eq!(settings[0].model, "new-model");
    assert_eq!(settings[0].service_tier.as_deref(), Some("unsupported"));
    assert!(backend.requests.lock().unwrap().is_empty());
    turn(&processor, &backend, None, Some("priority"), 1).await;
    assert_eq!(
        backend.requests.lock().unwrap()[0]
            .model_preference
            .as_deref(),
        Some("model")
    );
    processor.runtime.shutdown().await.unwrap();
}
