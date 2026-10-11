use super::*;

pub(super) fn metadata_string(metadata: &HashMap<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| metadata.get(*key))
        .and_then(value_string)
}

pub(super) fn metadata_i64(metadata: &HashMap<String, Value>, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| metadata.get(*key))
        .and_then(value_i64)
}

pub(super) fn metadata_u64(metadata: &HashMap<String, Value>, keys: &[&str]) -> Option<u64> {
    keys.iter()
        .find_map(|key| metadata.get(*key))
        .and_then(value_u64)
}

pub(super) fn metadata_bool(metadata: &HashMap<String, Value>, keys: &[&str]) -> Option<bool> {
    keys.iter()
        .find_map(|key| metadata.get(*key))
        .and_then(value_bool)
}

pub(super) fn metadata_string_array(
    metadata: &HashMap<String, Value>,
    keys: &[&str],
) -> Vec<String> {
    keys.iter()
        .filter_map(|key| metadata.get(*key))
        .flat_map(value_string_vec)
        .collect()
}

pub(super) fn metadata_paths(metadata: &HashMap<String, Value>, key: &str) -> Option<Vec<String>> {
    let values = metadata.get(key)?.as_array()?;
    let paths = values.iter().filter_map(value_string).collect::<Vec<_>>();
    (!paths.is_empty()).then_some(paths)
}

pub(super) fn value_string_from_object(value: &Value, keys: &[&str]) -> Option<String> {
    let object = value.as_object()?;
    keys.iter()
        .find_map(|key| object.get(*key))
        .and_then(value_string)
}

pub(super) fn value_number_from_object(value: Option<&Value>, keys: &[&str]) -> Option<u64> {
    let object = value?.as_object()?;
    keys.iter()
        .find_map(|key| object.get(*key))
        .and_then(value_u64)
}

pub(super) fn value_string(value: &Value) -> Option<String> {
    value.as_str().and_then(non_empty_string)
}

pub(super) fn value_string_vec(value: &Value) -> Vec<String> {
    if let Some(values) = value.as_array() {
        return values.iter().filter_map(value_string).collect();
    }
    value_string(value).into_iter().collect()
}

pub(super) fn non_empty_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

pub(super) fn value_i64(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|value| i64::try_from(value).ok()))
        .or_else(|| value.as_str()?.trim().parse::<i64>().ok())
}

pub(super) fn value_u64(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_i64().and_then(|value| u64::try_from(value).ok()))
        .or_else(|| value.as_str()?.trim().parse::<u64>().ok())
}

pub(super) fn value_bool(value: &Value) -> Option<bool> {
    value.as_bool().or_else(|| match value.as_str()?.trim() {
        "true" | "TRUE" | "True" | "1" => Some(true),
        "false" | "FALSE" | "False" | "0" => Some(false),
        _ => None,
    })
}

pub(super) fn dedupe_non_empty(values: Vec<String>) -> Option<Vec<String>> {
    let mut deduped = Vec::new();
    for value in values {
        let Some(value) = non_empty_string(&value) else {
            continue;
        };
        if !deduped.contains(&value) {
            deduped.push(value);
        }
    }
    (!deduped.is_empty()).then_some(deduped)
}

pub(super) fn stable_scope_id(prefix: &str, value: &str) -> String {
    format!("{prefix}:{:016x}", stable_hash(value))
}

pub(super) fn stable_hash(value: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub(super) fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut output = String::new();
    for (index, character) in value.chars().enumerate() {
        if index >= max_chars {
            output.push('…');
            break;
        }
        output.push(character);
    }
    output
}

pub(super) fn merge_object_fields(mut value: Value, fields: &Value) -> Value {
    let (Some(object), Some(fields)) = (value.as_object_mut(), fields.as_object()) else {
        return value;
    };
    for (key, value) in fields {
        object.insert(key.clone(), value.clone());
    }
    value
}

pub(super) fn compact_object(value: Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .into_iter()
                .filter_map(|(key, value)| {
                    let compacted = compact_object(value);
                    if compacted.is_null() {
                        None
                    } else {
                        Some((key, compacted))
                    }
                })
                .collect(),
        ),
        Value::Array(values) => Value::Array(values.into_iter().map(compact_object).collect()),
        other => other,
    }
}
