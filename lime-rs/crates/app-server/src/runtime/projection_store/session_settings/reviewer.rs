use agent_protocol::ApprovalsReviewer;
use serde_json::Value;

const IMPORTED_SETTINGS: [&str; 4] = [
    "importedContinuation",
    "imported_continuation",
    "importedThreadSettings",
    "imported_thread_settings",
];

pub(super) fn migrated_reviewer_metadata(metadata: &Value) -> Result<Option<Value>, String> {
    let Some(object) = metadata.as_object() else {
        return Ok(None);
    };
    let has_reviewer = |value: &Value| {
        value.get("approvalsReviewer").is_some() || value.get("approvals_reviewer").is_some()
    };
    if !has_reviewer(metadata)
        && !IMPORTED_SETTINGS
            .iter()
            .filter_map(|key| metadata.get(*key))
            .any(has_reviewer)
    {
        return Ok(None);
    }
    let imported = super::is_imported(metadata);
    let non_null = |value: &Value| {
        ["approvalsReviewer", "approvals_reviewer"]
            .into_iter()
            .find_map(|key| value.get(key).filter(|value| !value.is_null()))
            .cloned()
    };
    let selected = non_null(metadata).or_else(|| {
        imported
            .then(|| {
                IMPORTED_SETTINGS
                    .iter()
                    .filter_map(|key| metadata.get(*key))
                    .find_map(non_null)
            })
            .flatten()
    });
    let reviewer = ApprovalsReviewer::parse(selected.as_ref())?.unwrap_or_default();
    let mut next = object.clone();
    next.insert(
        "approvalsReviewer".to_string(),
        Value::String(reviewer.as_str().to_string()),
    );
    remove_reviewer_copies(&mut next);
    let next = Value::Object(next);
    Ok((next != *metadata).then_some(next))
}

pub(super) fn remove_reviewer_copies(next: &mut serde_json::Map<String, Value>) {
    next.remove("approvals_reviewer");
    for key in IMPORTED_SETTINGS {
        if let Some(settings) = next.get_mut(key).and_then(Value::as_object_mut) {
            settings.remove("approvalsReviewer");
            settings.remove("approvals_reviewer");
        }
    }
}

#[cfg(test)]
mod tests;
