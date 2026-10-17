use serde_json::{Map, Value};

const IMPORTED_SETTINGS: [&str; 4] = [
    "importedContinuation",
    "imported_continuation",
    "importedThreadSettings",
    "imported_thread_settings",
];
const CWD_KEYS: [&str; 3] = ["workingDir", "cwd", "working_dir"];
const ROOT_KEYS: [&str; 5] = [
    "runtimeWorkspaceRoots",
    "workspaceRoot",
    "workspace_root",
    "projectRoot",
    "project_root",
];

pub(super) fn migrated_workspace_metadata(metadata: &Value) -> Result<Option<Value>, String> {
    if !super::is_imported(metadata) {
        return Ok(None);
    }
    let mut next = metadata
        .as_object()
        .cloned()
        .ok_or("import metadata must be an object")?;
    let sources = std::iter::once(metadata)
        .chain(
            IMPORTED_SETTINGS
                .iter()
                .filter_map(|key| metadata.get(*key)),
        )
        .collect::<Vec<_>>();
    let cwd = sources
        .iter()
        .flat_map(|source| CWD_KEYS.iter().filter_map(|key| source.get(*key)))
        .find(|value| !value.is_null() && !value.as_str().is_some_and(|s| s.trim().is_empty()))
        .map(|value| {
            value
                .as_str()
                .map(|value| Value::String(value.trim().to_string()))
                .ok_or_else(|| "imported workingDir must be a string".to_string())
        })
        .transpose()?;
    let roots = sources
        .iter()
        .flat_map(|source| {
            ROOT_KEYS
                .iter()
                .filter_map(|key| source.get(*key).map(|value| (*key, value)))
        })
        .find(|(_, value)| !value.is_null())
        .map(|(key, value)| {
            let roots = if key == "runtimeWorkspaceRoots" {
                value
                    .as_array()
                    .cloned()
                    .ok_or_else(|| "imported runtimeWorkspaceRoots must be an array".to_string())?
            } else {
                vec![value.clone()]
            };
            roots
                .into_iter()
                .map(|root| {
                    root.as_str()
                        .map(str::trim)
                        .filter(|root| !root.is_empty())
                        .map(|root| Value::String(root.to_string()))
                        .ok_or_else(|| {
                            "imported workspace roots must contain nonempty string paths"
                                .to_string()
                        })
                })
                .collect::<Result<Vec<_>, _>>()
                .map(Value::Array)
        })
        .transpose()?;
    remove_workspace_copies(&mut next);
    if let Some(cwd) = cwd {
        next.insert("workingDir".into(), cwd);
    }
    if let Some(roots) = roots {
        next.insert("runtimeWorkspaceRoots".into(), roots);
    }
    let next = Value::Object(next);
    Ok((next != *metadata).then_some(next))
}

fn remove_workspace_copies(metadata: &mut Map<String, Value>) {
    for key in CWD_KEYS.into_iter().chain(ROOT_KEYS) {
        metadata.remove(key);
    }
    for key in IMPORTED_SETTINGS {
        if let Some(settings) = metadata.get_mut(key).and_then(Value::as_object_mut) {
            for key in CWD_KEYS.into_iter().chain(ROOT_KEYS) {
                settings.remove(key);
            }
        }
    }
}

pub(super) fn restore_workspace_metadata(
    canonical: &Value,
    projected: &mut Map<String, Value>,
) -> bool {
    if !super::is_imported(canonical) {
        return false;
    }
    remove_workspace_copies(projected);
    for key in ["workingDir", "runtimeWorkspaceRoots"] {
        if let Some(value) = canonical.get(key) {
            projected.insert(key.to_string(), value.clone());
        }
    }
    true
}

#[cfg(test)]
mod tests;
