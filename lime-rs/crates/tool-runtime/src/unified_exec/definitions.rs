use super::{EXEC_COMMAND_TOOL_NAME, WRITE_STDIN_TOOL_NAME};
use crate::tool_definition::RuntimeToolDefinition;
use serde_json::json;

pub fn unified_exec_tool_definitions() -> Vec<RuntimeToolDefinition> {
    vec![
        exec_command_tool_definition(),
        write_stdin_tool_definition(),
    ]
}

pub fn exec_command_tool_definition() -> RuntimeToolDefinition {
    RuntimeToolDefinition::new(
        EXEC_COMMAND_TOOL_NAME,
        "Runs a command, returning output or a session ID for ongoing interaction.",
        json!({
            "type": "object",
            "properties": {
                "cmd": {
                    "type": "string",
                    "description": "Shell command to execute."
                },
                "workdir": {
                    "type": "string",
                    "description": "Working directory for the command. Defaults to the turn cwd."
                },
                "shell": {
                    "type": "string",
                    "description": "Shell binary to launch. Defaults to the user's default shell."
                },
                "login": {
                    "type": "boolean",
                    "description": "True runs the shell with login semantics; false disables them. Defaults to true."
                },
                "tty": {
                    "type": "boolean",
                    "description": "True requests a PTY; false or omitted uses plain pipes."
                },
                "yield_time_ms": {
                    "type": "number",
                    "description": "Wait before yielding output. Defaults to 10000 ms; effective range is 250-30000 ms."
                },
                "max_output_tokens": {
                    "type": "number",
                    "description": "Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy."
                },
                "sandbox_permissions": {
                    "type": "string",
                    "enum": ["use_default", "require_escalated"],
                    "description": "Per-command sandbox override. Defaults to use_default."
                },
                "justification": {
                    "type": "string",
                    "description": "User-facing approval question for require_escalated; omit otherwise."
                },
                "prefix_rule": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "Reusable approval prefix for cmd, only with require_escalated."
                }
            },
            "required": ["cmd"],
            "additionalProperties": false
        }),
    )
}

pub fn write_stdin_tool_definition() -> RuntimeToolDefinition {
    RuntimeToolDefinition::new(
        WRITE_STDIN_TOOL_NAME,
        "Writes characters to an existing exec session and returns recent output.",
        json!({
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "number",
                    "description": "Identifier of the running exec session."
                },
                "chars": {
                    "type": "string",
                    "description": "Bytes to write to stdin. Defaults to empty, which polls without writing."
                },
                "yield_time_ms": {
                    "type": "number",
                    "description": "Wait before yielding output. Non-empty writes default to 250 ms; empty polls default to 5000 ms."
                },
                "max_output_tokens": {
                    "type": "number",
                    "description": "Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy."
                }
            },
            "required": ["session_id"],
            "additionalProperties": false
        }),
    )
}
