//! Codex 原生插件的文件及内联 MCP 声明。

use crate::agent_plugin_config::{
    AgentPluginMcpConfigParseOutcome, AgentPluginMcpServerParseError,
};
use crate::McpServerConfig;
use serde_json::Value;
use std::path::Path;

pub fn parse_plugin_mcp_config(
    plugin_root: &Path,
    contents: &str,
) -> Result<AgentPluginMcpConfigParseOutcome, String> {
    let value: Value = serde_json::from_str(contents)
        .map_err(|error| format!("解析 Plugin MCP 配置失败: {error}"))?;
    let servers = value
        .get("mcpServers")
        .unwrap_or(&value)
        .as_object()
        .ok_or_else(|| "Plugin MCP 配置必须是 object。".to_string())?;
    let mut outcome = AgentPluginMcpConfigParseOutcome::default();
    for (name, value) in servers {
        let parsed = (|| {
            let mut object = value
                .as_object()
                .cloned()
                .ok_or_else(|| "Plugin MCP server 必须是 object。".to_string())?;
            object.remove("type");
            if let Some(Value::String(cwd)) = object.get("cwd") {
                if !Path::new(cwd).is_absolute() {
                    object.insert(
                        "cwd".to_string(),
                        Value::String(plugin_root.join(cwd).to_string_lossy().into_owned()),
                    );
                }
            }
            if let Some(Value::Object(oauth)) = object.get_mut("oauth") {
                if let Some(client_id) = oauth.remove("clientId") {
                    oauth.entry("client_id".to_string()).or_insert(client_id);
                }
            }
            McpServerConfig::from_value(Value::Object(object))
        })();
        match parsed {
            Ok(config) => {
                outcome.servers.insert(name.clone(), config);
            }
            Err(message) => outcome.errors.push(AgentPluginMcpServerParseError {
                name: name.clone(),
                message,
            }),
        }
    }
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_native_inline_map_and_file_wrapper_and_isolates_invalid_sibling() {
        let root = tempfile::tempdir().unwrap();
        let servers = serde_json::json!({
            "local": {"command":"node", "cwd":"scripts"},
            "remote": {"type":"http", "url":"https://example.com/mcp"},
            "invalid": 1,
        });
        for value in [servers.clone(), serde_json::json!({"mcpServers":servers})] {
            let outcome = parse_plugin_mcp_config(root.path(), &value.to_string()).unwrap();
            assert_eq!(outcome.servers.len(), 2);
            assert_eq!(outcome.errors.len(), 1);
            assert_eq!(
                outcome.servers["local"].sanitized_cwd(),
                Some(root.path().join("scripts"))
            );
        }
    }
}
