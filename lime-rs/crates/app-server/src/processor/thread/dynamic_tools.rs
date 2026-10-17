use super::*;
use app_server_protocol::protocol::v2::{DynamicToolNamespaceTool, DynamicToolSpec};
use std::collections::{HashMap, HashSet};

pub(super) fn host_connection(
    tools: Option<&[DynamicToolSpec]>,
    request: Option<&ConnectionRequestId>,
) -> Result<Option<app_server_transport::ConnectionId>, JsonRpcError> {
    if tools.is_none_or(|tools| tools.is_empty()) {
        return Ok(None);
    }
    request
        .map(|request| Some(request.connection_id))
        .ok_or_else(|| invalid_request("dynamic tools require a transport host connection"))
}

impl RequestProcessor {
    pub(super) async fn bind_dynamic_tools(
        &self,
        thread_id: &str,
        connection_id: app_server_transport::ConnectionId,
        frozen: &[DynamicToolSpec],
        declared: &[DynamicToolSpec],
        active_turn: bool,
    ) -> Result<(), JsonRpcError> {
        validate_dynamic_tools(Some(frozen))?;
        validate_dynamic_tools(Some(declared))?;
        let frozen = tool_schemas(frozen);
        let declared = tool_schemas(declared);
        if frozen
            .iter()
            .any(|(name, schema)| declared.get(name) != Some(schema))
        {
            return Err(invalid_params(
                "dynamic tool host capabilities do not match the thread's frozen tools",
            ));
        }
        if frozen.is_empty() {
            return Ok(());
        }
        self.thread_states
            .bind_dynamic_tool_host(
                agent_protocol::ThreadId::new(thread_id),
                connection_id,
                frozen.into_keys().collect(),
                active_turn,
            )
            .await
            .map_err(invalid_request)
    }
}

fn tool_schemas(tools: &[DynamicToolSpec]) -> HashMap<(Option<String>, String), serde_json::Value> {
    let mut schemas = HashMap::new();
    for spec in tools {
        match spec {
            DynamicToolSpec::Function(tool) => {
                schemas.insert((None, tool.name.clone()), tool.input_schema.clone());
            }
            DynamicToolSpec::Namespace(namespace) => {
                for DynamicToolNamespaceTool::Function(tool) in &namespace.tools {
                    schemas.insert(
                        (Some(namespace.name.clone()), tool.name.clone()),
                        tool.input_schema.clone(),
                    );
                }
            }
        }
    }
    schemas
}

pub(super) fn validate_dynamic_tools(
    tools: Option<&[DynamicToolSpec]>,
) -> Result<(), JsonRpcError> {
    let Some(tools) = tools else {
        return Ok(());
    };
    let mut names = HashSet::new();
    for spec in tools {
        match spec {
            DynamicToolSpec::Function(tool) => {
                validate_dynamic_tool_function(None, tool, &mut names)?;
            }
            DynamicToolSpec::Namespace(namespace) => {
                let namespace_name = required_dynamic_tool_text(&namespace.name, "namespace name")?;
                required_dynamic_tool_text(&namespace.description, "namespace description")?;
                if namespace.tools.is_empty() {
                    return Err(invalid_params(format!(
                        "dynamic tool namespace '{namespace_name}' must contain at least one tool"
                    )));
                }
                for tool in &namespace.tools {
                    match tool {
                        DynamicToolNamespaceTool::Function(tool) => {
                            validate_dynamic_tool_function(Some(namespace_name), tool, &mut names)?;
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

fn validate_dynamic_tool_function(
    namespace: Option<&str>,
    tool: &app_server_protocol::protocol::v2::DynamicToolFunctionSpec,
    names: &mut HashSet<String>,
) -> Result<(), JsonRpcError> {
    let tool_name = required_dynamic_tool_text(&tool.name, "tool name")?;
    required_dynamic_tool_text(&tool.description, "tool description")?;
    if tool.defer_loading {
        return Err(invalid_params(format!(
            "dynamic tool '{}' uses unsupported deferLoading",
            dynamic_runtime_tool_name(namespace, tool_name)
        )));
    }
    if !tool.input_schema.is_object() {
        return Err(invalid_params(format!(
            "dynamic tool '{}' inputSchema must be an object",
            dynamic_runtime_tool_name(namespace, tool_name)
        )));
    }
    let runtime_name = dynamic_runtime_tool_name(namespace, tool_name);
    if !names.insert(runtime_name.to_ascii_lowercase()) {
        return Err(invalid_params(format!(
            "dynamic tool runtime name '{runtime_name}' is duplicated"
        )));
    }
    Ok(())
}

fn required_dynamic_tool_text<'a>(value: &'a str, field: &str) -> Result<&'a str, JsonRpcError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(invalid_params(format!(
            "dynamic tool {field} must not be empty"
        )));
    }
    if value.contains("__") {
        return Err(invalid_params(format!(
            "dynamic tool {field} must not contain the reserved '__' separator"
        )));
    }
    Ok(value)
}

fn dynamic_runtime_tool_name(namespace: Option<&str>, tool: &str) -> String {
    match namespace {
        Some(namespace) => format!("{namespace}__{tool}"),
        None => tool.to_string(),
    }
}
