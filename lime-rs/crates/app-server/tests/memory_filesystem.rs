//! Real native helper + shared OS sandbox, independent of model fixtures.

use app_server_protocol::protocol::v2::SandboxPolicy;
use serde_json::json;
use std::path::Path;
use tool_runtime::execution_process::{
    start_local_execution_process, LocalExecutionRequest, LocalExecutionSandbox,
};
use tool_runtime::sandbox::SandboxBackend;

async fn patch(root: &Path, patch: &str, unrestricted: bool) -> bool {
    let root = root.canonicalize().unwrap();
    let backend = match std::env::consts::OS {
        "macos" => SandboxBackend::Seatbelt,
        "linux" => SandboxBackend::LinuxSandbox,
        "windows" => SandboxBackend::RestrictedToken,
        _ => panic!("unsupported test platform"),
    };
    let mut request = LocalExecutionRequest::new(
        "native-memory",
        "patch",
        "apply_patch",
        vec![
            env!("CARGO_BIN_EXE_app-server").to_string(),
            tool_runtime::filesystem_helper::FILESYSTEM_HELPER_ARG.to_string(),
        ],
    );
    request.cwd = Some(root.clone());
    request.sandbox = Some(LocalExecutionSandbox {
        backend,
        policy: SandboxPolicy::WorkspaceWrite {
            writable_roots: vec![root.clone().try_into().unwrap()],
            network_access: false,
            exclude_tmpdir_env_var: true,
            exclude_slash_tmp: true,
        },
        granted_permissions: None,
        windows_mode: None,
    });
    let mut process = start_local_execution_process(request).unwrap();
    process
        .write_stdin(
            serde_json::to_vec(
                &json!({ "patch": patch, "cwd": root, "unrestricted": unrestricted }),
            )
            .unwrap(),
        )
        .unwrap();
    process.close_stdin().unwrap();
    let output = tokio::time::timeout(std::time::Duration::from_secs(20), process.wait())
        .await
        .unwrap()
        .unwrap();
    if output.exit_code == Some(0) {
        let response: serde_json::Value =
            serde_json::from_str(&output.retained_output).expect("typed helper response");
        assert!(response["metadata"]["paths"].is_array());
        assert!(response["metadata"]["file_changes"].is_object());
        true
    } else {
        let message = output.retained_output.to_ascii_lowercase();
        assert!(
            message.contains("permission denied") || message.contains("operation not permitted"),
            "native helper must fail at the filesystem permission boundary: {:?}: {}",
            output.exit_code,
            output.retained_output
        );
        false
    }
}

#[tokio::test]
async fn native_helper_add_update_move_delete_stay_inside_memory_root() {
    let temp = tempfile::tempdir().unwrap();
    assert!(
        patch(
            temp.path(),
            "*** Begin Patch\n*** Add File: note.md\n+before\n*** End Patch",
            false
        )
        .await
    );
    assert!(patch(temp.path(), "*** Begin Patch\n*** Update File: note.md\n*** Move to: moved.md\n@@\n-before\n+after\n*** End Patch", false).await);
    assert!(!temp.path().join("note.md").exists());
    assert_eq!(
        std::fs::read_to_string(temp.path().join("moved.md")).unwrap(),
        "after\n"
    );
    assert!(
        patch(
            temp.path(),
            "*** Begin Patch\n*** Delete File: moved.md\n*** End Patch",
            false
        )
        .await
    );
    assert!(!temp.path().join("moved.md").exists());
}

#[tokio::test]
async fn native_helper_os_policy_protects_baseline_and_outside_paths_even_with_unrestricted_parser()
{
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("memory");
    std::fs::create_dir_all(root.join(".git")).unwrap();
    std::fs::write(root.join(".git/HEAD"), "baseline\n").unwrap();
    let outside = temp.path().join("outside.md");
    std::fs::write(&outside, "outside\n").unwrap();
    for patch_text in [
        "*** Begin Patch\n*** Update File: .git/HEAD\n@@\n-baseline\n+corrupted\n*** End Patch"
            .to_string(),
        format!(
            "*** Begin Patch\n*** Update File: {}\n@@\n-outside\n+corrupted\n*** End Patch",
            outside.display()
        ),
        format!(
            "*** Begin Patch\n*** Add File: {}\n+new\n*** End Patch",
            temp.path().join("escaped.md").display()
        ),
        format!(
            "*** Begin Patch\n*** Delete File: {}\n*** End Patch",
            outside.display()
        ),
    ] {
        assert!(!patch(&root, &patch_text, true).await, "{patch_text}");
    }
    std::fs::write(root.join("inside.md"), "before\n").unwrap();
    assert!(!patch(&root, &format!("*** Begin Patch\n*** Update File: inside.md\n*** Move to: {}\n@@\n-before\n+after\n*** End Patch", temp.path().join("escaped-move.md").display()), true).await);
    assert_eq!(
        std::fs::read_to_string(root.join(".git/HEAD")).unwrap(),
        "baseline\n"
    );
    assert_eq!(std::fs::read_to_string(&outside).unwrap(), "outside\n");
    assert!(!temp.path().join("escaped.md").exists());
    assert!(!temp.path().join("escaped-move.md").exists());
}

#[cfg(unix)]
#[tokio::test]
async fn native_helper_cannot_follow_a_symlink_outside_memory_workspace() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("memory");
    std::fs::create_dir(&root).unwrap();
    let outside = temp.path().join("outside");
    std::fs::create_dir(&outside).unwrap();
    std::os::unix::fs::symlink(&outside, root.join("link")).unwrap();
    assert!(
        !patch(
            &root,
            "*** Begin Patch\n*** Add File: link/escaped.md\n+escaped\n*** End Patch",
            true
        )
        .await
    );
    assert!(!outside.join("escaped.md").exists());
}
