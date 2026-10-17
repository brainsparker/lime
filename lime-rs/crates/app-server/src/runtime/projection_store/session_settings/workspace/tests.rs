use super::*;
use serde_json::json;

#[test]
fn imported_workspace_prefers_current_settings_and_removes_only_runtime_copies() {
    let metadata = json!({
        "sourceClient":"codex", "sourceThreadId":"original", "workingDir":"/current",
        "cwd":"/stale", "runtimeWorkspaceRoots":[], "workspaceRoot":"/old-root",
        "importedContinuation":{"cwd":"/old", "workspaceRoot":"/nested-root", "model":"keep"},
        "imported_thread_settings":{"working_dir":"/older", "projectRoot":"/older-root"},
        "codexMetadata":{"cwd":"/original", "workspaceRoot":"/original-root"}
    });
    let migrated = migrated_workspace_metadata(&metadata).unwrap().unwrap();
    assert_eq!(
        migrated,
        json!({
            "sourceClient":"codex", "sourceThreadId":"original", "workingDir":"/current",
            "runtimeWorkspaceRoots":[], "importedContinuation":{"model":"keep"},
            "imported_thread_settings":{},
            "codexMetadata":{"cwd":"/original", "workspaceRoot":"/original-root"}
        })
    );
    assert!(migrated_workspace_metadata(&migrated).unwrap().is_none());
}

#[test]
fn imported_workspace_migrates_published_aliases_without_resolving_source_paths() {
    for (fields, cwd, roots) in [
        (
            json!({"cwd":"relative/source"}),
            Some("relative/source"),
            None,
        ),
        (
            json!({"workingDir":null,"working_dir":"C:\\source"}),
            Some("C:\\source"),
            None,
        ),
        (
            json!({"importedContinuation":{"cwd":"/continuation"}, "importedThreadSettings":{"cwd":"/settings"}}),
            Some("/continuation"),
            None,
        ),
        (
            json!({"importedThreadSettings":{"cwd":"/settings", "projectRoot":"/root"}}),
            Some("/settings"),
            Some(json!(["/root"])),
        ),
        (
            json!({"runtimeWorkspaceRoots":[], "importedContinuation":{"workspaceRoot":"/stale"}}),
            None,
            Some(json!([])),
        ),
    ] {
        let mut original = json!({"sourceClient":"codex", "sourceThreadId":"original"});
        original
            .as_object_mut()
            .unwrap()
            .extend(fields.as_object().unwrap().clone());
        let migrated = migrated_workspace_metadata(&original)
            .unwrap()
            .unwrap_or(original);
        assert_eq!(migrated.get("workingDir").and_then(Value::as_str), cwd);
        assert_eq!(migrated.get("runtimeWorkspaceRoots"), roots.as_ref());
    }
    assert!(
        migrated_workspace_metadata(&json!({"importedContinuation":{"cwd":"/foreign"}}))
            .unwrap()
            .is_none()
    );
}

#[test]
fn imported_workspace_rejects_invalid_selected_values_and_ignores_overridden_history() {
    for fields in [
        json!({"workingDir":false}),
        json!({"runtimeWorkspaceRoots":"/bad"}),
        json!({"runtimeWorkspaceRoots":[false]}),
        json!({"runtimeWorkspaceRoots":[""]}),
    ] {
        let mut metadata = json!({"sourceClient":"codex", "sourceThreadId":"original"});
        metadata
            .as_object_mut()
            .unwrap()
            .extend(fields.as_object().unwrap().clone());
        assert!(
            migrated_workspace_metadata(&metadata).is_err(),
            "{metadata}"
        );
    }
    let metadata = json!({"sourceClient":"codex", "sourceThreadId":"original", "workingDir":"/current", "runtimeWorkspaceRoots":[], "importedContinuation":{"cwd":false,"workspaceRoot":false}});
    let migrated = migrated_workspace_metadata(&metadata).unwrap().unwrap();
    assert_eq!(migrated["workingDir"], "/current");
    assert_eq!(migrated["runtimeWorkspaceRoots"], json!([]));
}
