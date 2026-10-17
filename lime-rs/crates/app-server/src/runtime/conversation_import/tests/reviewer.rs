use super::*;
use agent_protocol::ApprovalsReviewer;
use serde_json::json;

fn source(path: &std::path::Path, reviewer: &str) {
    fs::write(
        path,
        [
            json!({"timestamp":"2026-06-16T00:00:00Z", "type":"session_meta", "payload":{
                "id":"import-reviewer", "timestamp":"2026-06-16T00:00:00Z", "cwd":"/imported",
                "source":"cli", "model_provider":"openai", "approvals_reviewer":reviewer
            }})
            .to_string(),
            json!({"timestamp":"2026-06-16T00:00:01Z", "type":"event_msg", "payload":{
                "type":"user_message", "message":"original task"
            }})
            .to_string(),
        ]
        .join("\n"),
    )
    .unwrap();
}

#[tokio::test]
async fn approvals_reviewer_import_writes_one_canonical_setting_and_typed_turn_policy() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("rollout-reviewer.jsonl");
    source(&path, "guardian_subagent");
    let store = Arc::new(
        crate::ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
    );
    let backend = Arc::new(RecordingBackend::default());
    let core = RuntimeCore::with_backend(backend.clone()).with_projection_store(store);
    let imported = commit::commit_conversation_import_thread(
        &core,
        ConversationImportThreadCommitParams {
            source_root: Some(temp.path().to_string_lossy().into_owned()),
            source_path: Some(path.to_string_lossy().into_owned()),
            confirmed: true,
            ..Default::default()
        },
    )
    .unwrap();
    let session_id = imported.session.session_id;
    {
        let state = core.state.lock().unwrap();
        let stored = state.sessions.get(&session_id).unwrap();
        let metadata = stored
            .session
            .business_object_ref
            .as_ref()
            .unwrap()
            .metadata
            .as_ref()
            .unwrap();
        assert_eq!(metadata["approvalsReviewer"], "auto_review");
        assert_eq!(
            metadata["codexMetadata"]["approvalsReviewer"],
            "guardian_subagent"
        );
        for key in ["importedContinuation", "importedThreadSettings"] {
            assert!(
                metadata[key].get("approvalsReviewer").is_none(),
                "{key}: {metadata}"
            );
        }
        let request = stored
            .turn_runtime_options
            .values()
            .next()
            .unwrap()
            .runtime_request
            .as_ref()
            .unwrap();
        assert_eq!(
            request.approvals_reviewer,
            Some(ApprovalsReviewer::AutoReview)
        );
        assert!(request
            .metadata
            .as_ref()
            .unwrap()
            .get("approvalsReviewer")
            .is_none());
    }
    core.start_turn(
        AgentSessionTurnStartParams {
            session_id,
            turn_id: Some("continued-reviewer".into()),
            input: AgentInput {
                text: "continue".into(),
                attachments: vec![],
            },
            runtime_options: None,
            queue_if_busy: false,
            skip_pre_submit_resume: false,
        },
        RuntimeHostContext::default(),
    )
    .await
    .unwrap();
    assert_eq!(
        backend
            .requests
            .lock()
            .unwrap()
            .last()
            .unwrap()
            .runtime_options
            .as_ref()
            .unwrap()
            .runtime_request
            .as_ref()
            .unwrap()
            .approvals_reviewer,
        Some(ApprovalsReviewer::AutoReview)
    );
    core.shutdown().await.unwrap();
}

#[test]
fn approvals_reviewer_invalid_import_does_not_replace_existing_history() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("rollout-reviewer.jsonl");
    source(&path, "user");
    let core = RuntimeCore::default().with_projection_store(Arc::new(
        crate::ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap(),
    ));
    let params = ConversationImportThreadCommitParams {
        source_root: Some(temp.path().to_string_lossy().into_owned()),
        source_path: Some(path.to_string_lossy().into_owned()),
        confirmed: true,
        replace_existing: Some(true),
        ..Default::default()
    };
    let imported = commit::commit_conversation_import_thread(&core, params.clone()).unwrap();
    source(&path, "invalid");
    let error = commit::commit_conversation_import_thread(&core, params).unwrap_err();
    assert!(
        error.to_string().contains("import-reviewer") && error.to_string().contains("invalid"),
        "{error}"
    );
    let state = core.state.lock().unwrap();
    let stored = state
        .sessions
        .get(&imported.session.session_id)
        .expect("original session remains");
    assert_eq!(stored.turns.len(), 1);
    assert_eq!(
        stored
            .session
            .business_object_ref
            .as_ref()
            .unwrap()
            .metadata
            .as_ref()
            .unwrap()["approvalsReviewer"],
        "user"
    );
}
