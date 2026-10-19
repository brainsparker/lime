use serde_json::{Map, Value};

const CWD_KEYS: [&str; 3] = ["workingDir", "cwd", "working_dir"];
const ROOT_KEYS: [&str; 5] = [
    "runtimeWorkspaceRoots",
    "workspaceRoot",
    "workspace_root",
    "projectRoot",
    "project_root",
];

pub(super) fn migrated_workspace_metadata(metadata: &Value) -> Result<Option<Value>, String> {
    let Some(mut next) = metadata.as_object().cloned() else {
        return Ok(None);
    };
    let cwd = CWD_KEYS
        .iter()
        .filter_map(|key| metadata.get(*key))
        .find(|value| !value.is_null() && !value.as_str().is_some_and(|s| s.trim().is_empty()))
        .map(|value| {
            value
                .as_str()
                .map(|value| Value::String(value.trim().to_string()))
                .ok_or_else(|| "workingDir must be a string".to_string())
        })
        .transpose()?;
    let roots = ROOT_KEYS
        .iter()
        .filter_map(|key| metadata.get(*key).map(|value| (*key, value)))
        .find(|(_, value)| !value.is_null())
        .map(|(key, value)| {
            let roots = if key == "runtimeWorkspaceRoots" {
                value
                    .as_array()
                    .cloned()
                    .ok_or_else(|| "runtimeWorkspaceRoots must be an array".to_string())?
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
                            "workspace roots must contain nonempty string paths".to_string()
                        })
                })
                .collect::<Result<Vec<_>, _>>()
                .map(Value::Array)
        })
        .transpose()?;
    remove_workspace_aliases(&mut next);
    if let Some(cwd) = cwd {
        next.insert("workingDir".into(), cwd);
    }
    if let Some(roots) = roots {
        next.insert("runtimeWorkspaceRoots".into(), roots);
    }
    let next = Value::Object(next);
    Ok((next != *metadata).then_some(next))
}

fn remove_workspace_aliases(metadata: &mut Map<String, Value>) {
    for key in CWD_KEYS.into_iter().chain(ROOT_KEYS) {
        metadata.remove(key);
    }
}

pub(super) fn restore_workspace_metadata(canonical: &Value, projected: &mut Map<String, Value>) {
    remove_workspace_aliases(projected);
    for key in ["workingDir", "runtimeWorkspaceRoots"] {
        if let Some(value) = canonical.get(key) {
            projected.insert(key.to_string(), value.clone());
        }
    }
}

#[cfg(test)]
mod tests;
