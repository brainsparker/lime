use serde_json::Value;
use std::collections::HashMap;

/// Responses item events and argument deltas name the same call with different IDs.
#[derive(Debug, Default)]
pub(super) struct ResponseCallIdentity {
    aliases: HashMap<String, String>,
}

impl ResponseCallIdentity {
    pub(super) fn observe_item(&mut self, event: &Value) {
        let Some(item) = event.get("item") else {
            return;
        };
        if !matches!(
            item["type"].as_str(),
            Some("function_call" | "custom_tool_call")
        ) {
            return;
        }
        let mut aliases = aliases(item);
        aliases.extend(alias(event, "output_index", "index"));
        self.register(aliases);
    }

    pub(super) fn resolve(&mut self, payload: &Value) -> String {
        self.register(aliases(payload))
    }

    fn register(&mut self, aliases: Vec<(String, String)>) -> String {
        let key = aliases
            .iter()
            .find_map(|(alias, _)| self.aliases.get(alias).cloned())
            .or_else(|| aliases.first().map(|(_, value)| value.clone()))
            .unwrap_or_else(|| "response_call".to_string());
        for (alias, _) in aliases {
            self.aliases.insert(alias, key.clone());
        }
        key
    }
}

fn aliases(payload: &Value) -> Vec<(String, String)> {
    [
        ("item_id", "item"),
        ("id", "item"),
        ("call_id", "call"),
        ("output_index", "index"),
    ]
    .into_iter()
    .filter_map(|(field, kind)| alias(payload, field, kind))
    .collect()
}

fn alias(payload: &Value, field: &str, kind: &str) -> Option<(String, String)> {
    let value = payload.get(field)?;
    let value = match value {
        Value::String(value) if !value.is_empty() => value.clone(),
        Value::Number(value) => value.to_string(),
        _ => return None,
    };
    Some((format!("{kind}:{value}"), value))
}

#[cfg(test)]
mod tests;
