use super::{
    RuntimeCore, RuntimeCoreError, SessionMetadataMutation, SessionMetadataMutationResult,
};
use serde_json::{Map, Value};
use std::path::Path;

impl RuntimeCore {
    pub(crate) fn resolve_workspace_roots(
        roots: Option<&[String]>,
    ) -> Result<Option<Vec<String>>, RuntimeCoreError> {
        roots
            .map(|roots| {
                roots
                    .iter()
                    .map(|root| {
                        if root.trim().is_empty() {
                            return Err(RuntimeCoreError::InvalidRequest(
                                "runtimeWorkspaceRoots must not contain empty paths".into(),
                            ));
                        }
                        Self::resolve_working_directory(Some(root))
                    })
                    .collect()
            })
            .transpose()
    }

    pub(crate) fn resolve_working_directory(cwd: Option<&str>) -> Result<String, RuntimeCoreError> {
        let cwd = cwd.map(str::trim).filter(|cwd| !cwd.is_empty());
        if let Some(cwd) = cwd.filter(|cwd| Path::new(cwd).is_absolute()) {
            return Ok(cwd.to_string());
        }
        let base = std::env::current_dir().map_err(|error| {
            RuntimeCoreError::Backend(format!(
                "cannot resolve App Server working directory: {error}"
            ))
        })?;
        Ok(cwd
            .map_or(base.clone(), |cwd| base.join(cwd))
            .to_string_lossy()
            .into_owned())
    }

    pub(in crate::runtime) fn normalize_thread_working_directory_metadata(
        metadata: &mut Map<String, Value>,
    ) -> Result<bool, RuntimeCoreError> {
        let current = ["workingDir", "cwd", "working_dir"]
            .into_iter()
            .find_map(|key| {
                metadata
                    .get(key)
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|cwd| !cwd.is_empty())
            });
        let cwd = Self::resolve_working_directory(current)?;
        let mut changed = metadata.get("workingDir").and_then(Value::as_str) != Some(cwd.as_str())
            || metadata.contains_key("cwd")
            || metadata.contains_key("working_dir");
        if changed {
            metadata.insert("workingDir".into(), Value::String(cwd));
            metadata.remove("cwd");
            metadata.remove("working_dir");
        }
        if let Some(roots) = metadata
            .get("runtimeWorkspaceRoots")
            .and_then(Value::as_array)
        {
            let roots = roots
                .iter()
                .map(|root| {
                    root.as_str().map(str::to_owned).ok_or_else(|| {
                        RuntimeCoreError::InvalidRequest(
                            "runtimeWorkspaceRoots must contain string paths".into(),
                        )
                    })
                })
                .collect::<Result<Vec<_>, _>>()?;
            let normalized = serde_json::json!(Self::resolve_workspace_roots(Some(&roots))?);
            if metadata.get("runtimeWorkspaceRoots") != Some(&normalized) {
                metadata.insert("runtimeWorkspaceRoots".into(), normalized);
                changed = true;
            }
        }
        Ok(changed)
    }

    pub(in crate::runtime) async fn resolve_legacy_thread_working_directory(
        &self,
        thread: &agent_protocol::Thread,
    ) -> Result<bool, RuntimeCoreError> {
        if thread.archived {
            return Ok(false);
        }
        let Some(mut metadata) = thread.metadata.as_object().cloned() else {
            return Ok(false);
        };
        if !Self::normalize_thread_working_directory_metadata(&mut metadata)? {
            return Ok(false);
        }
        // Re-read and apply inside the existing actor so a concurrent settings update wins.
        let result = self
            .dispatch_session_metadata_mutation(
                thread.thread_id.as_str(),
                SessionMetadataMutation::WorkingDirectory,
            )
            .await?;
        match result {
            SessionMetadataMutationResult::WorkingDirectory => Ok(true),
            _ => Err(RuntimeCoreError::Backend(
                "working directory operation returned an invalid result".into(),
            )),
        }
    }
}
