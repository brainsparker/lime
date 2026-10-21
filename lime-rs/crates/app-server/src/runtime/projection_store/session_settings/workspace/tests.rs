use super::*;
use serde_json::json;

#[test]
fn inherited_and_explicit_empty_roots_do_not_rewrite_current_metadata() {
    for roots in [Value::Null, json!([])] {
        let metadata = json!({"workingDir":"/current", "runtimeWorkspaceRoots":roots});
        assert_eq!(
            migrated_workspace_metadata(&metadata).unwrap(),
            None,
            "{metadata}"
        );
        let mut projected = json!({"cwd":"/stale", "workspaceRoot":"/stale-root"})
            .as_object()
            .unwrap()
            .clone();
        restore_workspace_metadata(&metadata, &mut projected);
        assert_eq!(Value::Object(projected), metadata);
    }
}

#[test]
fn canonical_workspace_wins_and_normalizes_top_level_aliases() {
    let metadata = json!({"workingDir":"/current", "cwd":"/stale", "runtimeWorkspaceRoots":[], "workspaceRoot":"/stale-root", "unrelated":42});
    let migrated = migrated_workspace_metadata(&metadata).unwrap().unwrap();
    assert_eq!(
        migrated,
        json!({"workingDir":"/current", "runtimeWorkspaceRoots":[], "unrelated":42})
    );
    assert!(migrated_workspace_metadata(&migrated).unwrap().is_none());
}

#[test]
fn current_workspace_aliases_preserve_path_and_empty_root_semantics() {
    for (fields, cwd, roots) in [
        (
            json!({"cwd":"relative/current"}),
            Some("relative/current"),
            None,
        ),
        (
            json!({"workingDir":null,"working_dir":r"C:\current"}),
            Some(r"C:\current"),
            None,
        ),
        (
            json!({"workingDir":"/current", "projectRoot":"/root"}),
            Some("/current"),
            Some(json!(["/root"])),
        ),
        (
            json!({"runtimeWorkspaceRoots":[], "workspaceRoot":"/stale"}),
            None,
            Some(json!([])),
        ),
    ] {
        let migrated = migrated_workspace_metadata(&fields)
            .unwrap()
            .unwrap_or(fields);
        assert_eq!(migrated.get("workingDir").and_then(Value::as_str), cwd);
        assert_eq!(migrated.get("runtimeWorkspaceRoots"), roots.as_ref());
    }
}

#[test]
fn current_workspace_rejects_invalid_selected_values() {
    for metadata in [
        json!({"workingDir":false}),
        json!({"runtimeWorkspaceRoots":"/bad"}),
        json!({"runtimeWorkspaceRoots":[false]}),
        json!({"runtimeWorkspaceRoots":[""]}),
    ] {
        assert!(
            migrated_workspace_metadata(&metadata).is_err(),
            "{metadata}"
        );
    }
}

#[test]
fn obsolete_nested_metadata_cannot_supply_workspace_settings() {
    for key in [
        "importedContinuation",
        "imported_continuation",
        "importedThreadSettings",
        "imported_thread_settings",
    ] {
        let input = json!({"sourceClient":"codex", "sourceThreadId":"foreign", key:{"cwd":false,"workspaceRoot":false}});
        assert_eq!(
            migrated_workspace_metadata(&input).unwrap(),
            None,
            "{input}"
        );
        let mut current = input;
        current["workingDir"] = json!("/current");
        current["runtimeWorkspaceRoots"] = json!([]);
        assert_eq!(
            migrated_workspace_metadata(&current).unwrap(),
            None,
            "{current}"
        );
        let mut projected =
            json!({"workingDir":"/stale", "cwd":"/stale", "runtimeWorkspaceRoots":["/stale"]})
                .as_object()
                .unwrap()
                .clone();
        restore_workspace_metadata(&current, &mut projected);
        assert_eq!(
            Value::Object(projected),
            json!({"workingDir":"/current", "runtimeWorkspaceRoots":[]})
        );
    }
}
