use super::{is_web_tool, tool_executor::CurrentTurnToolExecutor};
use crate::model_request_policy::{
    native_tool_policy_disallowed_tool_names, native_tool_policy_from_turn_context,
};
use crate::protocol::AgentEvent;
use crate::request_tool_policy::{is_same_tool, RequestToolPolicy};
use crate::runtime_state::AgentRuntimeState;
use agent_protocol::ThreadId;
use agent_runtime::provider_turn::{
    RuntimeToolStepSnapshot, RuntimeToolStepSnapshotFuture, RuntimeToolStepSnapshotSource,
    RuntimeToolStepSnapshotSourceHandle,
};
use agent_runtime::session_loop::RuntimeSessionInputHandle;
use app_server_protocol::protocol::v2::{
    DynamicToolFunctionSpec, DynamicToolNamespaceTool, DynamicToolSpec,
};
use code_mode_protocol::RuntimeToolDefinition;
use code_mode_protocol::RuntimeToolExposure;
use code_mode_protocol::{RuntimeToolIdentity, RuntimeToolSnapshot};
use rmcp::model::CallToolResult;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::{mpsc::UnboundedSender, Mutex};
use tool_runtime::tool_executor::RuntimeToolExecutorHandle;
use tool_runtime::tool_extension::RuntimeToolCaller;
use tool_runtime::turn_tool_surface::{
    runtime_turn_tool_scope_from_metadata, runtime_turn_tool_surface_allows_tool_name,
    runtime_turn_tool_surface_mode_from_metadata,
};

const MCP_TOOL_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(2);
const DYNAMIC_TOOLS_METADATA_KEY: &str = "dynamicTools";
pub(super) const GET_CONTEXT_REMAINING_TOOL_NAME: &str = "get_context_remaining";
pub(super) const NEW_CONTEXT_WINDOW_TOOL_NAME: &str = "new_context";

#[cfg(test)]
#[path = "mcp_step_snapshot/async_user_input_tests.rs"]
mod async_user_input_tests;

/// Trusted App Server configuration and canonical Thread identity.
#[derive(Clone, Copy, Debug, Default)]
pub(super) struct AsyncUserInputPolicy {
    pub(super) is_root_agent: bool,
    pub(super) experimental_request_user_input_enabled: bool,
}

impl AsyncUserInputPolicy {
    fn allows(
        self,
        native_policy: Option<&crate::model_request_policy::ModelNativeToolPolicySnapshot>,
    ) -> bool {
        self.is_root_agent
            && self.experimental_request_user_input_enabled
            && native_policy.is_some_and(|policy| {
                policy.experimental_supported_tools.iter().any(|name| {
                    matches!(
                        name.as_str(),
                        "request_user_input_async" | "send_user_message_async"
                    )
                })
            })
    }
}

fn tool_exposure(name: &str) -> RuntimeToolExposure {
    if name == tool_runtime::request_user_input_async::REQUEST_USER_INPUT_ASYNC_TOOL_NAME {
        RuntimeToolExposure::DirectModelOnly
    } else {
        RuntimeToolExposure::Direct
    }
}

#[derive(Clone, Default)]
pub(super) struct DeferredToolSelections(Arc<Mutex<HashSet<String>>>);

#[derive(Clone, Default)]
pub(super) struct McpToolRoutes(
    Arc<RwLock<HashMap<String, tool_runtime::mcp_connection::McpStepRouteIdentity>>>,
);

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct DynamicToolRoute {
    pub(super) runtime_tool_name: String,
    pub(super) namespace: Option<String>,
    pub(super) tool: String,
}

#[derive(Clone, Default)]
pub(super) struct DynamicToolRoutes(Arc<RwLock<HashMap<String, DynamicToolRoute>>>);

impl DynamicToolRoutes {
    fn replace(&self, routes: Vec<DynamicToolRoute>) {
        *self.0.write().expect("dynamic tool routes lock poisoned") = routes
            .into_iter()
            .map(|route| (route.runtime_tool_name.clone(), route))
            .collect();
    }

    pub(super) fn get(&self, runtime_tool_name: &str) -> Option<DynamicToolRoute> {
        self.0
            .read()
            .expect("dynamic tool routes lock poisoned")
            .get(runtime_tool_name)
            .cloned()
    }

    #[cfg(test)]
    pub(super) fn replace_for_test(&self, routes: impl IntoIterator<Item = DynamicToolRoute>) {
        self.replace(routes.into_iter().collect());
    }
}

impl McpToolRoutes {
    fn replace_from_snapshot(&self, snapshot: &tool_runtime::mcp_connection::McpStepSnapshot) {
        let routes = snapshot
            .tools()
            .iter()
            .filter_map(|tool| snapshot.route_identity(tool.name.as_ref()))
            .map(|route| (route.runtime_tool_name.clone(), route))
            .collect();
        *self.0.write().expect("MCP tool routes lock poisoned") = routes;
    }

    pub(super) fn get(
        &self,
        runtime_tool_name: &str,
    ) -> Option<tool_runtime::mcp_connection::McpStepRouteIdentity> {
        self.0
            .read()
            .expect("MCP tool routes lock poisoned")
            .get(runtime_tool_name)
            .cloned()
    }

    #[cfg(test)]
    pub(super) fn replace_for_test(
        &self,
        routes: impl IntoIterator<Item = tool_runtime::mcp_connection::McpStepRouteIdentity>,
    ) {
        *self.0.write().expect("MCP tool routes lock poisoned") = routes
            .into_iter()
            .map(|route| (route.runtime_tool_name.clone(), route))
            .collect();
    }
}

impl DeferredToolSelections {
    async fn snapshot(&self) -> HashSet<String> {
        self.0.lock().await.clone()
    }

    pub(super) async fn activate_from_tool_search_result(
        &self,
        result: &mut CallToolResult,
    ) -> bool {
        let Some(structured_content) = result.structured_content.as_mut() else {
            return false;
        };
        let matches = structured_content
            .get("matches")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        let mut selected = self.0.lock().await;
        let updated = matches
            .into_iter()
            .fold(false, |updated, name| selected.insert(name) || updated);
        if let Some(object) = structured_content.as_object_mut() {
            object.insert("tool_surface_updated".to_string(), Value::Bool(updated));
        }
        updated
    }
}

pub(super) fn current_tool_step_snapshot_source(
    state: AgentRuntimeState,
    policy: RequestToolPolicy,
    turn_context: Option<agent_protocol::turn_context::TurnContextOverride>,
    event_sender: UnboundedSender<AgentEvent>,
    session_id: String,
    thread_id: ThreadId,
    agent_control_gateway: Option<tool_runtime::agent_control::AgentControlGatewayHandle>,
    pending_input: Option<RuntimeSessionInputHandle>,
    mcp_tool_routes: McpToolRoutes,
    dynamic_tool_routes: DynamicToolRoutes,
    tool_mode: code_mode::RuntimeToolMode,
    supports_custom_tools: bool,
    async_user_input_policy: AsyncUserInputPolicy,
    internal_agent_policy: Option<tool_runtime::internal_agent::InternalAgentPolicy>,
) -> RuntimeToolStepSnapshotSourceHandle {
    let deferred_tools = DeferredToolSelections::default();
    RuntimeToolStepSnapshotSourceHandle::new(Arc::new(CurrentTurnToolStepSnapshotSource {
        state,
        policy,
        turn_context,
        event_sender,
        session_id,
        thread_id,
        agent_control_gateway,
        pending_input,
        deferred_tools,
        mcp_tool_routes,
        dynamic_tool_routes,
        tool_mode,
        supports_custom_tools,
        async_user_input_policy,
        internal_agent_policy,
    }))
}

pub(super) async fn mcp_step_snapshot(
    state: &AgentRuntimeState,
    session_id: &str,
    thread_id: &ThreadId,
    timeout_duration: Duration,
    deferred_tools: &DeferredToolSelections,
) -> tool_runtime::mcp_connection::McpStepSnapshot {
    let Ok(runtime) = state.mcp_runtime(session_id, thread_id.as_str()).await else {
        return tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant());
    };
    runtime
        .connections()
        .step_snapshot(
            None,
            RuntimeToolCaller::assistant(),
            deferred_tools.snapshot().await,
            timeout_duration,
        )
        .await
}

fn tool_definitions(
    state: &AgentRuntimeState,
    policy: &RequestToolPolicy,
    turn_context: Option<&agent_protocol::turn_context::TurnContextOverride>,
    mcp_snapshot: &tool_runtime::mcp_connection::McpStepSnapshot,
    agent_control_gateway: Option<&tool_runtime::agent_control::AgentControlGatewayHandle>,
    async_user_input_policy: AsyncUserInputPolicy,
) -> Result<(Vec<RuntimeToolDefinition>, Vec<DynamicToolRoute>), String> {
    let native_policy = native_tool_policy_from_turn_context(turn_context);
    let async_user_input_enabled = async_user_input_policy.allows(native_policy.as_ref());
    let update_plan_enabled = turn_context
        .map(|context| {
            let metadata = Value::Object(context.metadata.clone().into_iter().collect());
            tool_runtime::update_plan::update_plan_enabled_from_metadata(Some(&metadata))
        })
        .unwrap_or(false);
    let tool_surface_mode = turn_context
        .and_then(|context| runtime_turn_tool_surface_mode_from_metadata(&context.metadata));
    let tool_scope = turn_context
        .map(|context| runtime_turn_tool_scope_from_metadata(&context.metadata))
        .unwrap_or_default();
    let blocked_by_model = native_tool_policy_disallowed_tool_names(native_policy.as_ref())
        .into_iter()
        .map(str::to_string)
        .collect::<HashSet<_>>();
    let native_dispatch = tool_runtime::native_dispatch::runtime_native_dispatch();
    let mut definitions = native_dispatch.definitions();
    if context_window_tools_enabled(turn_context) {
        definitions.extend([
            RuntimeToolDefinition::new(
                GET_CONTEXT_REMAINING_TOOL_NAME,
                "Get the remaining tokens in the current context window.",
                serde_json::json!({
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }),
            ),
            RuntimeToolDefinition::new(
                NEW_CONTEXT_WINDOW_TOOL_NAME,
                "Start a new context window without summarizing conversation history.",
                serde_json::json!({
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }),
            ),
        ]);
    }
    definitions.extend(tool_runtime::unified_exec::unified_exec_tool_definitions());
    definitions.push(tool_runtime::request_permissions::request_permissions_tool_definition());
    definitions.push(tool_runtime::request_user_input::request_user_input_tool_definition());
    if async_user_input_enabled {
        definitions.push(
            tool_runtime::request_user_input_async::request_user_input_async_tool_definition(),
        );
    }
    if let Some(gateway) = agent_control_gateway {
        definitions.extend(gateway.tool_definitions());
    }
    definitions.extend(state.gateway_tools().definitions());
    definitions.extend(mcp_tool_definitions(mcp_snapshot));
    let (dynamic_definitions, dynamic_routes) = dynamic_tool_definitions(turn_context)?;
    let mut existing_names = definitions
        .iter()
        .map(|definition| definition.name.to_ascii_lowercase())
        .collect::<HashSet<_>>();
    existing_names.insert(
        tool_runtime::request_user_input_async::REQUEST_USER_INPUT_ASYNC_TOOL_NAME.to_string(),
    );
    if let Some(collision) = dynamic_definitions
        .iter()
        .find(|definition| existing_names.contains(&definition.name.to_ascii_lowercase()))
    {
        return Err(format!(
            "dynamic tool '{}' collides with an existing runtime tool",
            collision.name
        ));
    }
    definitions.extend(dynamic_definitions);
    let canonical_name = |name: &str| {
        native_dispatch
            .canonical_name(name)
            .map(ToOwned::to_owned)
            .or_else(|| state.gateway_tools().canonical_name(name))
    };

    let mut seen = HashSet::new();
    definitions.retain(|definition| {
        let key = definition.name.to_ascii_lowercase();
        seen.insert(key)
            && (definition.name
                != tool_runtime::request_user_input_async::REQUEST_USER_INPUT_ASYNC_TOOL_NAME
                || async_user_input_enabled)
            && !blocked_by_model
                .iter()
                .any(|name| is_same_tool(name, &definition.name))
            && !policy.matches_any_disallowed_tool(&definition.name)
            && (definition.name != tool_runtime::update_plan::UPDATE_PLAN_NAME
                || update_plan_enabled)
            && (policy.allows_web_search() || !is_web_tool(&definition.name))
            && runtime_turn_tool_surface_allows_tool_name(
                &definition.name,
                tool_surface_mode.as_ref(),
                &tool_scope.allowed_tools,
                &canonical_name,
            )
    });
    definitions.sort_by(|left, right| left.name.cmp(&right.name));
    Ok((definitions, dynamic_routes))
}

fn context_window_tools_enabled(
    turn_context: Option<&agent_protocol::turn_context::TurnContextOverride>,
) -> bool {
    let Some(context) = turn_context else {
        return false;
    };
    let metadata = &context.metadata;
    let has_context_policy = metadata
        .get("lime_runtime")
        .and_then(|runtime| runtime.get("context_policy"))
        .is_some_and(Value::is_object);
    has_context_policy
        && metadata
            .get("lime_runtime")
            .and_then(|runtime| runtime.get("auto_compact"))
            .and_then(Value::as_bool)
            != Some(false)
}

fn dynamic_tool_definitions(
    turn_context: Option<&agent_protocol::turn_context::TurnContextOverride>,
) -> Result<(Vec<RuntimeToolDefinition>, Vec<DynamicToolRoute>), String> {
    let Some(specs) = turn_context
        .and_then(|context| context.metadata.get("runtime_request"))
        .and_then(|metadata| metadata.get(DYNAMIC_TOOLS_METADATA_KEY))
    else {
        return Ok((Vec::new(), Vec::new()));
    };
    let specs = serde_json::from_value::<Vec<DynamicToolSpec>>(specs.clone())
        .map_err(|error| format!("invalid trusted dynamicTools metadata: {error}"))?;
    let mut definitions = Vec::new();
    let mut routes = Vec::new();
    let mut names = HashSet::new();
    for spec in specs {
        match spec {
            DynamicToolSpec::Function(tool) => {
                push_dynamic_tool(None, tool, &mut names, &mut definitions, &mut routes)?;
            }
            DynamicToolSpec::Namespace(namespace) => {
                let namespace_name = dynamic_tool_text(&namespace.name, "namespace name")?;
                dynamic_tool_text(&namespace.description, "namespace description")?;
                for tool in namespace.tools {
                    match tool {
                        DynamicToolNamespaceTool::Function(tool) => {
                            push_dynamic_tool(
                                Some(namespace_name.clone()),
                                tool,
                                &mut names,
                                &mut definitions,
                                &mut routes,
                            )?;
                        }
                    }
                }
            }
        }
    }
    Ok((definitions, routes))
}

fn push_dynamic_tool(
    namespace: Option<String>,
    tool: DynamicToolFunctionSpec,
    names: &mut HashSet<String>,
    definitions: &mut Vec<RuntimeToolDefinition>,
    routes: &mut Vec<DynamicToolRoute>,
) -> Result<(), String> {
    let tool_name = dynamic_tool_text(&tool.name, "tool name")?;
    let description = dynamic_tool_text(&tool.description, "tool description")?;
    if tool.defer_loading {
        return Err(
            "dynamic tool deferLoading is not supported by the current runtime".to_string(),
        );
    }
    if !tool.input_schema.is_object() {
        return Err("dynamic tool inputSchema must be an object".to_string());
    }
    let runtime_tool_name = match namespace.as_deref() {
        Some(namespace) => format!("{namespace}__{tool_name}"),
        None => tool_name.clone(),
    };
    if !names.insert(runtime_tool_name.to_ascii_lowercase()) {
        return Err(format!(
            "dynamic tool runtime name '{runtime_tool_name}' is duplicated"
        ));
    }
    definitions.push(RuntimeToolDefinition {
        name: runtime_tool_name.clone(),
        description,
        input_schema: tool.input_schema,
    });
    routes.push(DynamicToolRoute {
        runtime_tool_name,
        namespace,
        tool: tool_name,
    });
    Ok(())
}

fn dynamic_tool_text(value: &str, field: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.contains("__") {
        return Err(format!("dynamic tool {field} is invalid"));
    }
    Ok(value.to_string())
}

fn mcp_tool_definitions(
    snapshot: &tool_runtime::mcp_connection::McpStepSnapshot,
) -> Vec<RuntimeToolDefinition> {
    snapshot
        .tools()
        .iter()
        .map(|tool| RuntimeToolDefinition {
            name: tool.name.to_string(),
            description: tool
                .description
                .clone()
                .map(|value| value.to_string())
                .unwrap_or_default(),
            input_schema: Value::Object((*tool.input_schema).clone()),
        })
        .collect()
}

fn resolved_tool_environment_ids(
    definitions: &[RuntimeToolDefinition],
    mut explicit_environment_ids: HashMap<String, String>,
    default_environment_id: Option<&str>,
) -> HashMap<String, String> {
    if let Some(environment_id) = default_environment_id {
        for definition in definitions {
            explicit_environment_ids
                .entry(definition.name.clone())
                .or_insert_with(|| environment_id.to_string());
        }
    }
    explicit_environment_ids
}

#[derive(Clone)]
struct CurrentTurnToolStepSnapshotSource {
    internal_agent_policy: Option<tool_runtime::internal_agent::InternalAgentPolicy>,
    state: AgentRuntimeState,
    policy: RequestToolPolicy,
    turn_context: Option<agent_protocol::turn_context::TurnContextOverride>,
    event_sender: UnboundedSender<AgentEvent>,
    thread_id: ThreadId,
    session_id: String,
    agent_control_gateway: Option<tool_runtime::agent_control::AgentControlGatewayHandle>,
    pending_input: Option<RuntimeSessionInputHandle>,
    deferred_tools: DeferredToolSelections,
    mcp_tool_routes: McpToolRoutes,
    dynamic_tool_routes: DynamicToolRoutes,
    tool_mode: code_mode::RuntimeToolMode,
    supports_custom_tools: bool,
    async_user_input_policy: AsyncUserInputPolicy,
}

struct CodeModeStepPlan {
    tool_plan: code_mode::RuntimeCodeModeToolPlan,
    attach_session: bool,
}

fn code_mode_step_plan(
    runtime_tools: &[RuntimeToolSnapshot],
    requested: code_mode::RuntimeToolMode,
    supports_custom_tools: bool,
    has_session: bool,
) -> Result<CodeModeStepPlan, String> {
    let code_mode_available = supports_custom_tools && has_session;
    let tool_plan = code_mode::plan_runtime_code_mode_tools(
        runtime_tools,
        requested,
        code_mode_available,
        false,
    )
    .map_err(|error| error.to_string())?;
    let attach_session =
        code_mode_available && tool_plan.resolution.effective != code_mode::RuntimeToolMode::Direct;
    Ok(CodeModeStepPlan {
        tool_plan,
        attach_session,
    })
}

impl RuntimeToolStepSnapshotSource for CurrentTurnToolStepSnapshotSource {
    fn capture(
        &self,
        step_context: Option<&agent_runtime::session_loop::RuntimeSessionStepContext>,
    ) -> RuntimeToolStepSnapshotFuture<'_> {
        let step_context = step_context.cloned();
        Box::pin(async move {
            let mcp_snapshot = if self.internal_agent_policy.is_some() {
                tool_runtime::mcp_connection::McpStepSnapshot::empty(RuntimeToolCaller::assistant())
            } else {
                mcp_step_snapshot(
                    &self.state,
                    &self.session_id,
                    &self.thread_id,
                    MCP_TOOL_DISCOVERY_TIMEOUT,
                    &self.deferred_tools,
                )
                .await
            };
            let mcp_snapshot = if orchestrator_mcp_enabled(self.turn_context.as_ref()) {
                mcp_snapshot
            } else {
                mcp_snapshot.without_server(lime_skills::APPS_MCP_SERVER_NAME)
            };
            self.mcp_tool_routes.replace_from_snapshot(&mcp_snapshot);
            let (mut definitions, mut dynamic_routes) = tool_definitions(
                &self.state,
                &self.policy,
                self.turn_context.as_ref(),
                &mcp_snapshot,
                self.agent_control_gateway.as_ref(),
                self.async_user_input_policy,
            )?;
            if let Some(policy) = self.internal_agent_policy.as_ref() {
                definitions.retain(|definition| policy.allows_tool(&definition.name));
                dynamic_routes.clear();
            }
            self.dynamic_tool_routes.replace(dynamic_routes);
            let serial_mcp_tool_names = mcp_snapshot
                .tools()
                .iter()
                .filter(|tool| !mcp_snapshot.supports_parallel_tool_calls(tool.name.as_ref()))
                .map(|tool| tool.name.to_string())
                .collect::<Vec<_>>();
            let mcp_tool_environment_ids =
                mcp_snapshot
                    .tools()
                    .iter()
                    .map(|tool| {
                        let tool_name = tool.name.to_string();
                        let environment_id = mcp_snapshot.environment_id(&tool_name).ok_or_else(|| {
                        format!("MCP tool '{tool_name}' is missing captured environment provenance")
                    })?;
                        Ok((tool_name, environment_id.to_string()))
                    })
                    .collect::<Result<HashMap<_, _>, String>>()?;
            let default_environment_id =
                super::environment::primary_environment_id(self.turn_context.as_ref());
            let executor = RuntimeToolExecutorHandle::new(Arc::new(CurrentTurnToolExecutor {
                internal_agent_policy: self.internal_agent_policy.clone(),
                state: self.state.clone(),
                policy: self.policy.clone(),
                event_sender: self.event_sender.clone(),
                thread_id: self.thread_id.clone(),
                mcp_snapshot,
                deferred_tools: self.deferred_tools.clone(),
                agent_control_gateway: self.agent_control_gateway.clone(),
                pending_input: self.pending_input.clone(),
                dynamic_tool_routes: self.dynamic_tool_routes.clone(),
                async_user_input_enabled: self.async_user_input_policy.allows(native_tool_policy_from_turn_context(self.turn_context.as_ref()).as_ref())
                    && definitions.iter().any(|definition| definition.name == tool_runtime::request_user_input_async::REQUEST_USER_INPUT_ASYNC_TOOL_NAME),
            }));
            let runtime_tools = definitions
                .iter()
                .cloned()
                .map(|definition| {
                    let supports_parallel = !serial_mcp_tool_names.contains(&definition.name);
                    let exposure = tool_exposure(&definition.name);
                    RuntimeToolSnapshot::new(
                        RuntimeToolIdentity::plain(definition.name.clone()),
                        definition,
                        exposure,
                        supports_parallel,
                        true,
                    )
                })
                .collect::<Vec<_>>();
            let code_mode_session = self
                .pending_input
                .as_ref()
                .and_then(RuntimeSessionInputHandle::code_mode_session);
            let CodeModeStepPlan {
                tool_plan,
                attach_session,
            } = code_mode_step_plan(
                &runtime_tools,
                self.tool_mode,
                self.supports_custom_tools,
                code_mode_session.is_some(),
            )?;
            let definitions: Vec<RuntimeToolDefinition> = tool_plan
                .model_visible_tools
                .into_iter()
                .map(|tool| tool.definition)
                .collect();
            let nested_tools = tool_plan.nested_tools;
            let tool_environment_ids = resolved_tool_environment_ids(
                &definitions,
                mcp_tool_environment_ids,
                default_environment_id.as_deref(),
            );
            let snapshot = RuntimeToolStepSnapshot::with_tool_metadata(
                definitions,
                executor,
                serial_mcp_tool_names,
                tool_environment_ids,
            );
            let snapshot = match self.state.filesystem_gateway() {
                Some(gateway) => snapshot.with_filesystem_gateway(gateway),
                None => snapshot,
            };
            let snapshot = step_context.map_or(snapshot.clone(), |context| {
                snapshot.with_step_context(context)
            });
            if !attach_session {
                return Ok(snapshot);
            }
            let session = code_mode_session
                .ok_or_else(|| "CodeMode plan requires an executable session".to_string())?;
            Ok(snapshot.with_code_mode_session(session, nested_tools))
        })
    }
}

fn orchestrator_mcp_enabled(
    turn_context: Option<&agent_protocol::turn_context::TurnContextOverride>,
) -> bool {
    let Some(config) = turn_context.and_then(|context| context.metadata.get("config")) else {
        return true;
    };
    if config.pointer("/orchestrator/loadError").is_some() {
        return false;
    }
    config
        .pointer("/orchestrator/mcp/enabled")
        .and_then(Value::as_bool)
        .unwrap_or(true)
}

#[cfg(test)]
mod tests;
