use super::*;
use serde_json::json;

#[test]
fn canonical_reviewer_wins_over_its_top_level_alias() {
    let input = json!({"approvalsReviewer":"user", "approvals_reviewer":"guardian_subagent", "unrelated":42});
    let migrated = migrated_reviewer_metadata(&input).unwrap().unwrap();
    assert_eq!(
        migrated,
        json!({"approvalsReviewer":"user", "unrelated":42})
    );
    assert_eq!(migrated_reviewer_metadata(&migrated).unwrap(), None);
}

#[test]
fn current_reviewer_ignores_null_and_rejects_invalid_selected_values() {
    for (extra, expected) in [
        (
            json!({"approvals_reviewer":"guardian_subagent"}),
            "auto_review",
        ),
        (json!({"approvals_reviewer":"user"}), "user"),
        (json!({}), "user"),
    ] {
        let mut input = json!({"approvalsReviewer":null});
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
fn obsolete_nested_metadata_cannot_supply_reviewer_settings() {
    for key in [
        "importedContinuation",
        "imported_continuation",
        "importedThreadSettings",
        "imported_thread_settings",
    ] {
        for reviewer_key in ["approvalsReviewer", "approvals_reviewer"] {
            let input = json!({"sourceClient":"codex", "sourceThreadId":"foreign", key:{reviewer_key:"auto_review"}});
            assert_eq!(migrated_reviewer_metadata(&input).unwrap(), None, "{input}");
            let mut current = input;
            current["approvalsReviewer"] = json!("user");
            assert_eq!(
                migrated_reviewer_metadata(&current).unwrap(),
                None,
                "{current}"
            );
        }
    }
}
