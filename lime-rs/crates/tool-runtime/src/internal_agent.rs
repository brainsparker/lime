//! Trusted internal-agent capabilities. These types deliberately have no wire deserializer.

use app_server_protocol::protocol::v2::SandboxPolicy;
use std::path::PathBuf;
use tokio_util::{sync::CancellationToken, task::TaskTracker};

#[derive(Debug, Clone)]
pub struct InternalAgentPolicy {
    root: PathBuf,
    sandbox: SandboxPolicy,
    pub(crate) filesystem_tasks: TaskTracker,
    pub(crate) filesystem_shutdown: CancellationToken,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn memory_shutdown_waits_for_native_write_tasks() {
        let root = tempfile::tempdir().unwrap();
        let policy =
            InternalAgentPolicy::memory(root.path().to_path_buf(), SandboxPolicy::DangerFullAccess);
        let shutdown = policy.filesystem_shutdown.clone();
        let (cancelled_tx, cancelled_rx) = tokio::sync::oneshot::channel();
        let (drained_tx, drained_rx) = tokio::sync::oneshot::channel();
        policy.filesystem_tasks.spawn(async move {
            shutdown.cancelled().await;
            cancelled_tx.send(()).unwrap();
            drained_rx.await.unwrap();
        });
        let close = policy.shutdown_filesystem();
        tokio::pin!(close);
        assert!(futures::poll!(close.as_mut()).is_pending());
        cancelled_rx.await.unwrap();
        assert!(futures::poll!(close.as_mut()).is_pending());
        drained_tx.send(()).unwrap();
        close.await;
    }
}

impl InternalAgentPolicy {
    pub fn memory(root: PathBuf, parent: SandboxPolicy) -> Self {
        let sandbox = match parent {
            SandboxPolicy::DangerFullAccess | SandboxPolicy::ExternalSandbox { .. } => parent,
            _ => SandboxPolicy::WorkspaceWrite {
                writable_roots: vec![root.clone().try_into().expect("absolute memory root")],
                network_access: false,
                exclude_tmpdir_env_var: true,
                exclude_slash_tmp: true,
            },
        };
        Self {
            root,
            sandbox,
            filesystem_tasks: TaskTracker::new(),
            filesystem_shutdown: CancellationToken::new(),
        }
    }

    pub fn root(&self) -> &std::path::Path {
        &self.root
    }
    pub fn sandbox(&self) -> &SandboxPolicy {
        &self.sandbox
    }

    /// The session owner waits for native writes after its actor has stopped.
    /// An aborted tool future must not leave a writer racing the next lease.
    pub async fn shutdown_filesystem(&self) {
        self.filesystem_shutdown.cancel();
        self.filesystem_tasks.close();
        self.filesystem_tasks.wait().await;
    }

    /// Legacy turn labels cannot express an external sandbox. Its typed policy
    /// stays on the execution attempt; the local runner must not add a sandbox.
    pub fn process_label(&self) -> &'static str {
        match self.sandbox() {
            SandboxPolicy::ExternalSandbox { .. } => "danger-full-access",
            policy => crate::sandbox::sandbox_policy_label(policy),
        }
    }

    pub fn allows_tool(&self, name: &str) -> bool {
        matches!(
            name,
            "exec_command"
                | "write_stdin"
                | "apply_patch"
                | "read_file"
                | "list_dir"
                | "grep_files"
                | "view_image"
                | "update_plan"
        )
    }
}
