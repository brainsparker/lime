//! Strict artifact contract for the Codex memory consolidation harness.

use serde::Deserialize;
use serde_json::{json, Value};

const MAX_SUMMARY_CHARS: usize = 9_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Output {
    pub(super) entries: Vec<Entry>,
    pub(super) summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Entry {
    pub(super) source_path: String,
    pub(super) decision: Decision,
    pub(super) memory: Option<String>,
    pub(super) reason: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Decision {
    Accept,
    Review,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawOutput {
    entries: Vec<RawEntry>,
    summary: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawEntry {
    source_path: String,
    decision: String,
    #[serde(default)]
    memory: Option<String>,
    #[serde(default)]
    reason: Option<String>,
}

pub(super) fn parse(source: &str) -> Result<Output, String> {
    let raw: RawOutput = serde_json::from_str(source)
        .map_err(|error| format!("invalid memory stage-2 output: {error}"))?;
    let mut entries = Vec::with_capacity(raw.entries.len());
    for entry in raw.entries {
        let decision = match entry.decision.trim() {
            "accept" => Decision::Accept,
            "review" => Decision::Review,
            other => return Err(format!("invalid memory stage-2 decision: {other}")),
        };
        let source_path = entry.source_path.trim();
        if source_path.is_empty() {
            return Err("memory stage-2 source_path must be non-empty".to_string());
        }
        let memory = entry
            .memory
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let reason = entry
            .reason
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        if decision == Decision::Accept && memory.is_none() {
            return Err(format!(
                "memory stage-2 accepted entry {source_path} has no memory artifact"
            ));
        }
        if decision == Decision::Review && reason.is_none() {
            return Err(format!(
                "memory stage-2 review entry {source_path} has no reason"
            ));
        }
        entries.push(Entry {
            source_path: source_path.to_string(),
            decision,
            memory,
            reason,
        });
    }
    Ok(Output {
        entries,
        summary: {
            let summary = raw.summary.trim();
            if summary.chars().count() > MAX_SUMMARY_CHARS {
                return Err("memory stage-2 summary exceeds size limit".to_string());
            }
            summary.to_string()
        },
    })
}

pub(super) fn output_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source_path": {"type": "string"},
                        "decision": {"type": "string", "enum": ["accept", "review"]},
                        "memory": {"type": ["string", "null"]},
                        "reason": {"type": ["string", "null"]}
                    },
                    "required": ["source_path", "decision", "memory", "reason"],
                    "additionalProperties": false
                }
            },
            "summary": {"type": "string"}
        },
        "required": ["entries", "summary"],
        "additionalProperties": false
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parser_requires_artifact_for_accept_and_reason_for_review() {
        let output = parse(
            r#"{"entries":[{"source_path":"notes/a.md","decision":"accept","memory":"Keep this","reason":null}],"summary":"updated"}"#,
        )
        .expect("strict stage-2 output");
        assert_eq!(output.entries.len(), 1);
        assert!(parse(
            r#"{"entries":[{"source_path":"notes/a.md","decision":"accept","memory":null,"reason":null}],"summary":""}"#,
        )
        .is_err());
        assert!(parse(
            r#"{"entries":[{"source_path":"notes/a.md","decision":"review","memory":null,"reason":null}],"summary":""}"#,
        )
        .is_err());
    }

    #[test]
    fn schema_is_strict() {
        assert_eq!(output_schema()["additionalProperties"], false);
    }
}
