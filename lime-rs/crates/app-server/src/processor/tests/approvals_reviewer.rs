use super::super::*;
use super::settings_support::{core, resume, run_turn, start_session, SettingsBackend};
use super::tests_support::initialize_processor;
use crate::ProjectionStore;
use agent_protocol::ApprovalsReviewer;
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
async fn approvals_reviewer_invalid_public_input_does_not_mutate_runtime() {
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
    for (index, method) in [
        "thread/start",
        "thread/fork",
        "thread/resume",
        "thread/settings/update",
        "turn/start",
    ]
    .into_iter()
    .enumerate()
    {
        let messages = processor.handle_request(JsonRpcRequest::new(
            RequestId::Integer(200 + index as i64), method,
            Some(json!({"threadId":"settings-thread", "input":[], "approvalsReviewer":"unknown"})),
        )).await.unwrap();
        let [JsonRpcMessage::Error(error)] = messages.as_slice() else {
            panic!("invalid reviewer was accepted by {method}: {messages:?}");
        };
        assert_eq!(
            error.error.code,
            app_server_protocol::error_codes::INVALID_PARAMS,
            "{method}"
        );
    }
    assert!(backend.requests.lock().unwrap().is_empty());
    assert!(backend.settings.lock().unwrap().is_empty());
    let read = processor
        .runtime
        .read_session(app_server_protocol::AgentSessionReadParams {
            session_id: "settings-session".into(),
            history_limit: None,
            history_offset: None,
            history_before_message_id: None,
        })
        .unwrap();
    assert!(read.turns.is_empty());
    assert!(read
        .session
        .business_object_ref
        .unwrap()
        .metadata
        .unwrap()
        .get("approvalsReviewer")
        .is_none());
    processor.runtime.shutdown().await.unwrap();
}

#[tokio::test]
async fn approvals_reviewer_default_and_legacy_input_have_canonical_public_responses() {
    let temp = tempfile::tempdir().unwrap();
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let backend = Arc::new(SettingsBackend::default());
    let processor = RequestProcessor::new(core(store, backend, &temp.path().join("config.yaml")));
    initialize_processor(&processor).await;
    let mut thread_id = String::new();
    for (index, reviewer) in [None, Some(serde_json::Value::Null)]
        .into_iter()
        .enumerate()
    {
        let mut params = json!({"model":"model", "modelProvider":"fixture", "cwd":temp.path()});
        if let Some(reviewer) = reviewer {
            params["approvalsReviewer"] = reviewer;
        }
        let messages = processor
            .handle_request(JsonRpcRequest::new(
                RequestId::Integer(210 + index as i64),
                "thread/start",
                Some(params),
            ))
            .await
            .unwrap();
        let result = messages
            .iter()
            .find_map(|message| match message {
                JsonRpcMessage::Response(response) => Some(&response.result),
                _ => None,
            })
            .unwrap_or_else(|| panic!("thread/start failed: {messages:?}"));
        assert_eq!(result["approvalsReviewer"], "user");
        assert_eq!(result["thread"]["extra"]["approvalsReviewer"], "user");
        thread_id = result["thread"]["id"].as_str().unwrap().into();
    }
    let messages = processor
        .handle_request(JsonRpcRequest::new(
            RequestId::Integer(212),
            "thread/fork",
            Some(json!({"threadId":thread_id, "approvalsReviewer":"guardian_subagent"})),
        ))
        .await
        .unwrap();
    let result = messages
        .iter()
        .find_map(|message| match message {
            JsonRpcMessage::Response(response) => Some(&response.result),
            _ => None,
        })
        .unwrap_or_else(|| panic!("thread/fork failed: {messages:?}"));
    assert_eq!(result["approvalsReviewer"], "auto_review");
    assert_eq!(
        result["thread"]["extra"]["approvalsReviewer"],
        "auto_review"
    );
    processor.runtime.shutdown().await.unwrap();
}

#[tokio::test]
async fn approvals_reviewer_reaches_current_and_later_turns_after_cold_resume() {
    let temp = tempfile::tempdir().unwrap();
    let store =
        Arc::new(ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap());
    let backend = Arc::new(SettingsBackend::default());
    let config = temp.path().join("config.yaml");
    let processor = RequestProcessor::new(core(store.clone(), backend.clone(), &config));
    start_session(&processor.runtime);
    initialize_processor(&processor).await;
    for (index, patch) in [json!({"approvalsReviewer":"auto_review"}), json!({})]
        .into_iter()
        .enumerate()
    {
        let request = run_turn(&processor, &backend, patch, index + 1).await;
        assert_eq!(
            request.approvals_reviewer,
            Some(ApprovalsReviewer::AutoReview)
        );
    }
    processor.runtime.shutdown().await.unwrap();
    drop(processor);
    let resumed = RequestProcessor::new(core(store, backend.clone(), &config));
    resume(&resumed).await;
    assert_eq!(
        run_turn(&resumed, &backend, json!({}), 3)
            .await
            .approvals_reviewer,
        Some(ApprovalsReviewer::AutoReview)
    );
    assert_eq!(
        run_turn(&resumed, &backend, json!({"approvalsReviewer":"user"}), 4)
            .await
            .approvals_reviewer,
        Some(ApprovalsReviewer::User)
    );
    assert_eq!(
        run_turn(&resumed, &backend, json!({}), 5)
            .await
            .approvals_reviewer,
        Some(ApprovalsReviewer::User)
    );
    resumed.runtime.shutdown().await.unwrap();
}

#[tokio::test]
async fn approvals_reviewer_published_metadata_migrates_before_public_resume_and_stays_updated() {
    let temp = tempfile::tempdir().unwrap();
    let config = temp.path().join("config.yaml");
    let database = temp.path().join("projection.sqlite");
    let agent_root = temp.path().join("agent-root");
    let store =
        Arc::new(ProjectionStore::initialize_with_agent_root(&database, &agent_root).unwrap());
    let backend = Arc::new(SettingsBackend::default());
    let old = core(store, backend.clone(), &config);
    old.start_session(app_server_protocol::AgentSessionStartParams {
        session_id: Some("settings-session".into()),
        thread_id: Some("settings-thread".into()),
        app_id: "agent-chat".into(),
        workspace_id: None,
        locale: None,
        business_object_ref: Some(app_server_protocol::BusinessObjectRef {
            kind: "conversation.import".into(),
            id: "original".into(),
            title: None,
            uri: None,
            metadata: Some(json!({
                "providerSelector":"fixture", "modelName":"model",
                "sourceClient":"codex", "sourceThreadId":"original",
                "approvalsReviewer":null,
                "importedContinuation":{"approvals_reviewer":"guardian_subagent"},
                "codexMetadata":{"approvalsReviewer":"guardian_subagent"}
            })),
        }),
    })
    .unwrap();
    old.shutdown().await.unwrap();
    drop(old);
    let open =
        || Arc::new(ProjectionStore::initialize_with_agent_root(&database, &agent_root).unwrap());
    let processor = RequestProcessor::new(core(open(), backend.clone(), &config));
    initialize_processor(&processor).await;
    let messages = processor
        .handle_request(JsonRpcRequest::new(
            RequestId::Integer(300),
            "thread/resume",
            Some(json!({"threadId":"settings-thread"})),
        ))
        .await
        .unwrap();
    let result = messages
        .iter()
        .find_map(|message| match message {
            JsonRpcMessage::Response(response) => Some(&response.result),
            _ => None,
        })
        .unwrap_or_else(|| panic!("migrated public resume failed: {messages:?}"));
    assert_eq!(result["approvalsReviewer"], "auto_review");
    assert_eq!(
        result["thread"]["extra"]["approvalsReviewer"],
        "auto_review"
    );
    assert!(result["thread"]["extra"]["importedContinuation"]
        .get("approvals_reviewer")
        .is_none());
    assert_eq!(
        run_turn(&processor, &backend, json!({}), 1)
            .await
            .approvals_reviewer,
        Some(ApprovalsReviewer::AutoReview)
    );
    assert_eq!(
        run_turn(&processor, &backend, json!({"approvalsReviewer":"user"}), 2)
            .await
            .approvals_reviewer,
        Some(ApprovalsReviewer::User)
    );
    processor.runtime.shutdown().await.unwrap();
    drop(processor);
    let store = open();
    store.clear_session("settings-session").unwrap();
    let processor = RequestProcessor::new(core(store, backend.clone(), &config));
    resume(&processor).await;
    assert_eq!(
        run_turn(&processor, &backend, json!({}), 3)
            .await
            .approvals_reviewer,
        Some(ApprovalsReviewer::User),
        "old import metadata must not resurrect automatic review"
    );
    processor.runtime.shutdown().await.unwrap();
}
