use super::*;
use serde_json::json;

// Preserve signed provider blocks inside the existing completed-item envelope.
// Only the request copy is lowered; the durable envelope remains unchanged.
pub(super) fn completed(protocol: &str, source_id: &str, parts: Vec<Value>) -> CanonicalLlmEvent {
    let reasoning = source_id.starts_with("reasoning-");
    let text = parts
        .iter()
        .filter_map(|part| {
            part.get(if protocol == "anthropic" {
                "thinking"
            } else {
                "text"
            })
            .and_then(Value::as_str)
        })
        .collect::<String>();
    let mut item = if reasoning {
        json!({"type":"reasoning", "id":source_id, "summary":[],
            "content":[{"type":"reasoning_text", "text":text}]})
    } else {
        json!({"type":"message", "id":source_id, "role":"assistant",
            "content":[{"type":"output_text", "text":text}]})
    };
    item["native"] = json!({"protocol":protocol, "parts":parts});
    CanonicalLlmEvent::ResponseItemDone {
        source_id: source_id.to_string(),
        item,
        producer: None,
    }
}

pub(super) fn parts<'a>(
    item: &'a Value,
    protocol: &str,
) -> Result<&'a [Value], CurrentProviderError> {
    let native = item.get("native").ok_or_else(invalid)?;
    if native.get("protocol").and_then(Value::as_str) != Some(protocol) {
        return Err(invalid());
    }
    let parts = native
        .get("parts")
        .and_then(Value::as_array)
        .ok_or_else(invalid)?;
    let reasoning = item.get("type").and_then(Value::as_str) == Some("reasoning");
    let valid = !parts.is_empty()
        && parts.iter().all(|part| match protocol {
            "anthropic" => {
                reasoning
                    && part.get("type").and_then(Value::as_str) == Some("thinking")
                    && part.get("thinking").is_some_and(Value::is_string)
                    && part
                        .get("signature")
                        .and_then(Value::as_str)
                        .is_some_and(|s| !s.is_empty())
            }
            "gemini" => {
                part.get("text").is_some_and(Value::is_string)
                    && (part.get("thought").and_then(Value::as_bool) == Some(true)) == reasoning
                    && part.get("functionCall").is_none()
            }
            _ => false,
        });
    if !valid {
        return Err(invalid());
    }
    Ok(parts)
}

pub(super) fn validate_route(
    item: &Value,
    config: &RuntimeProviderConfig,
) -> Result<(), CurrentProviderError> {
    let protocol = match config.protocol {
        Some(RuntimeProviderProtocol::AnthropicMessages) => "anthropic",
        Some(
            RuntimeProviderProtocol::GeminiGenerateContent | RuntimeProviderProtocol::VertexGemini,
        ) => "gemini",
        _ => return Err(invalid()),
    };
    parts(item, protocol).map(|_| ())
}

pub(super) fn portable(item: &Value) -> Result<Vec<CurrentProviderContent>, CurrentProviderError> {
    let protocol = item
        .pointer("/native/protocol")
        .and_then(Value::as_str)
        .ok_or_else(invalid)?;
    let parts = parts(item, protocol)?;
    let text = parts
        .iter()
        .filter_map(|part| {
            part.get(if protocol == "anthropic" {
                "thinking"
            } else {
                "text"
            })
            .and_then(Value::as_str)
        })
        .collect::<String>();
    Ok(if text.is_empty() {
        Vec::new()
    } else if item["type"] == "reasoning" {
        vec![CurrentProviderContent::Reasoning(text)]
    } else {
        vec![CurrentProviderContent::Text(text)]
    })
}

fn invalid() -> CurrentProviderError {
    CurrentProviderError::invalid_request("invalid signed provider history or route")
}

#[cfg(test)]
#[path = "native_history/tests.rs"]
mod tests;
