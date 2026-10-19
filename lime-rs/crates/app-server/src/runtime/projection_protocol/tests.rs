use super::*;
use serde_json::json;

#[test]
fn obsolete_source_metadata_cannot_replace_canonical_session_identity() {
    for metadata in [
        json!({"sourceClient":"codex", "sourceThreadId":"foreign-thread", "sourcePath":"/foreign"}),
        json!({"source_client":"codex", "source_thread_id":"foreign-thread", "source_path":"/foreign"}),
    ] {
        let row = ProjectedSessionRow {
            session_id: "canonical-session".into(),
            thread_id: "canonical-thread".into(),
            status: "completed".into(),
            created_at: Some("2026-10-20T00:00:00Z".into()),
            updated_at: "2026-10-20T00:00:01Z".into(),
            archived_at: None,
            title: Some("Canonical title".into()),
            model: Some("current-model".into()),
            workspace_id: Some("canonical-workspace".into()),
            working_dir: Some("/current".into()),
            execution_strategy: None,
            metadata_json: Some(metadata.to_string()),
            last_event_sequence: 3,
        };
        let session = projected_session_to_protocol(&row, Some("first input".into()));
        assert_eq!(session.session_id, row.session_id);
        assert_eq!(session.thread_id, row.thread_id);
        assert_eq!(session.workspace_id, row.workspace_id);
        let reference = session.business_object_ref.expect("canonical reference");
        assert_eq!(reference.kind, "agent_session_projection");
        assert_eq!(reference.id, row.session_id);
        assert_eq!(reference.title, row.title);
        assert_eq!(reference.uri, None);
        let projected = reference.metadata.expect("current metadata");
        assert_eq!(projected["model"], "current-model");
        assert_eq!(projected["workingDir"], "/current");
        assert_eq!(projected["lastEventSequence"], 3);
    }
}
