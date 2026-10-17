use super::*;
use serde_json::json;

#[test]
fn canonical_reviewer_wins_and_all_obsolete_copies_are_removed() {
    let input = json!({
        "sourceClient":"codex", "sourceThreadId":"source", "approvalsReviewer":"user",
        "approvals_reviewer":"guardian_subagent",
        "importedContinuation":{"approvalsReviewer":"invalid", "cwd":"/keep"},
        "imported_continuation":{"approvals_reviewer":"auto_review"},
        "importedThreadSettings":{"approvalsReviewer":"auto_review"},
        "imported_thread_settings":{"approvals_reviewer":"auto_review"},
        "codexMetadata":{"approvalsReviewer":"guardian_subagent"}
    });
    let migrated = migrated_reviewer_metadata(&input).unwrap().unwrap();
    assert_eq!(
        migrated,
        json!({
            "sourceClient":"codex", "sourceThreadId":"source", "approvalsReviewer":"user",
            "importedContinuation":{"cwd":"/keep"}, "imported_continuation":{},
            "importedThreadSettings":{}, "imported_thread_settings":{},
            "codexMetadata":{"approvalsReviewer":"guardian_subagent"}
        })
    );
    assert_eq!(migrated_reviewer_metadata(&migrated).unwrap(), None);
}

#[test]
fn published_reviewer_precedence_ignores_null_but_rejects_invalid_selected_values() {
    for (extra, expected) in [
        (
            json!({"approvals_reviewer":"guardian_subagent"}),
            "auto_review",
        ),
        (
            json!({"importedContinuation":{"approvalsReviewer":null},
            "importedThreadSettings":{"approvals_reviewer":"guardian_subagent"}}),
            "auto_review",
        ),
        (
            json!({"approvals_reviewer":"user", "importedContinuation":{"approvalsReviewer":"auto_review"}}),
            "user",
        ),
        (json!({}), "user"),
    ] {
        let mut input =
            json!({"sourceClient":"codex", "sourceThreadId":"source", "approvalsReviewer":null});
        input
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        assert_eq!(
            migrated_reviewer_metadata(&input).unwrap().unwrap()["approvalsReviewer"],
            expected,
            "{input}"
        );
    }
    for value in [json!("invalid"), json!({}), json!(false)] {
        assert!(migrated_reviewer_metadata(&json!({"approvalsReviewer":value})).is_err());
    }
}

#[test]
fn ordinary_threads_do_not_inherit_import_only_reviewer_settings() {
    assert_eq!(
        migrated_reviewer_metadata(&json!({
            "importedContinuation":{"approvalsReviewer":"auto_review"}, "unrelated":42
        }))
        .unwrap(),
        Some(json!({"approvalsReviewer":"user", "importedContinuation":{}, "unrelated":42}))
    );
    assert_eq!(
        migrated_reviewer_metadata(&json!({"unrelated":42})).unwrap(),
        None
    );
}
