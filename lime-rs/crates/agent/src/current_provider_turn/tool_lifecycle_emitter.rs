use super::{
    mcp_step_snapshot::{DynamicToolRoute, DynamicToolRoutes, McpToolRoutes},
    CurrentTurnHostEvent,
};
use crate::protocol::{
    apply_command_start, canonical_command_start_item, canonical_tool_item_event, AgentEvent,
    CanonicalSubAgentActivity, ToolItemLifecycleContext,
};
use agent_protocol::{
    DynamicToolCallContentItem, ItemId, SessionId, ThreadId, ThreadItem, ThreadItemPayload,
};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tokio::sync::mpsc::UnboundedSender;
use tool_runtime::tool_lifecycle::{
    CodeCellTraceEvent, CommandStartEvent, ToolLifecycleEmissionFuture, ToolLifecycleEmitter,
    ToolLifecycleEvent, ToolLifecyclePhase, ToolOutputDeltaEvent,
};

mod async_user_input;

#[cfg(test)]
#[path = "tool_lifecycle_emitter/command_tests.rs"]
mod command_tests;

pub(super) struct CurrentTurnToolLifecycleEmitter {
    event_sender: UnboundedSender<CurrentTurnHostEvent>,
    session_id: SessionId,
    thread_id: ThreadId,
    next_sequence: AtomicU64,
    next_ordinal: AtomicU64,
    items: Mutex<HashMap<String, ToolItemLifecycleState>>,
    owned_commands: Mutex<HashSet<String>>,
    mcp_tool_routes: McpToolRoutes,
    dynamic_tool_routes: DynamicToolRoutes,
    pub(super) command_publisher: Option<super::CommandEventPublisher>,
}

#[derive(Clone)]
struct ToolItemLifecycleState {
    ordinal: u64,
    created_at_ms: i64,
    command_start: Option<CommandStartEvent>,
}

impl CurrentTurnToolLifecycleEmitter {
    #[cfg(test)]
    pub(super) fn new(
        event_sender: UnboundedSender<CurrentTurnHostEvent>,
        session_id: impl Into<String>,
        thread_id: impl Into<String>,
    ) -> Self {
        Self::with_tool_routes(
            event_sender,
            session_id,
            thread_id,
            McpToolRoutes::default(),
            DynamicToolRoutes::default(),
        )
    }

    pub(super) fn with_tool_routes(
        event_sender: UnboundedSender<CurrentTurnHostEvent>,
        session_id: impl Into<String>,
        thread_id: impl Into<String>,
        mcp_tool_routes: McpToolRoutes,
        dynamic_tool_routes: DynamicToolRoutes,
    ) -> Self {
        Self {
            event_sender,
            session_id: SessionId::new(session_id),
            thread_id: ThreadId::new(thread_id),
            next_sequence: AtomicU64::new(0),
            next_ordinal: AtomicU64::new(0),
            items: Mutex::new(HashMap::new()),
            owned_commands: Mutex::new(HashSet::new()),
            mcp_tool_routes,
            dynamic_tool_routes,
            command_publisher: None,
        }
    }

    #[cfg(test)]
    pub(super) fn project(&self, event: ToolLifecycleEvent) -> Option<AgentEvent> {
        self.project_all(event).into_iter().next()
    }

    pub(super) fn project_all(&self, event: ToolLifecycleEvent) -> Vec<AgentEvent> {
        if event.tool_name
            == tool_runtime::request_user_input_async::REQUEST_USER_INPUT_ASYNC_TOOL_NAME
        {
            return self.project_async_user_input(event);
        }
        let lifecycle_completed = matches!(event.phase, ToolLifecyclePhase::Completed);
        if lifecycle_completed && event.output.is_none() {
            return Vec::new();
        }
        if tool_runtime::unified_exec::is_unified_exec_tool_name(&event.tool_name)
            && matches!(event.phase, ToolLifecyclePhase::Started)
        {
            // Only the prepared invocation starts a command; dispatch is not execution.
            return Vec::new();
        }

        let subagent_activity = CanonicalSubAgentActivity::from_tool_event(&event);
        let mcp_route = self.mcp_tool_routes.get(&event.tool_name);
        let dynamic_tool_route = self.dynamic_tool_routes.get(&event.tool_name);
        let dynamic_tool_arguments = dynamic_tool_route.as_ref().map(|_| event.arguments.clone());
        let now = chrono::Utc::now().timestamp_millis();
        let lifecycle_call_id = event
            .output
            .as_ref()
            .and_then(|output| output.metadata.get("exec_command_call_id"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or(&event.call_id);
        let key = format!("{}\0{}", event.turn_id, lifecycle_call_id);
        let (state, needs_preparation_start) = {
            let mut items = self
                .items
                .lock()
                .expect("tool item lifecycle mutex poisoned");
            let needs_start = !items.contains_key(&key)
                && lifecycle_completed
                && event.tool_name == tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME;
            let state = items
                .entry(key.clone())
                .or_insert_with(|| ToolItemLifecycleState {
                    ordinal: self.next_ordinal.fetch_add(1, Ordering::Relaxed) + 1,
                    created_at_ms: now,
                    command_start: None,
                });
            (state.clone(), needs_start)
        };
        let event_count =
            1 + u64::from(subagent_activity.is_some()) + u64::from(needs_preparation_start);
        let first_sequence = self.next_sequence.fetch_add(event_count, Ordering::Relaxed) + 1;
        let mut projected = Vec::with_capacity(event_count as usize);
        if needs_preparation_start {
            // A rejected invocation still needs a lifecycle, with no claimed process facts.
            let mut pending = event.clone();
            pending.phase = ToolLifecyclePhase::Started;
            pending.output = None;
            if let Some(start) = canonical_tool_item_event(
                pending,
                ToolItemLifecycleContext {
                    session_id: self.session_id.clone(),
                    thread_id: self.thread_id.clone(),
                    sequence: first_sequence,
                    ordinal: state.ordinal,
                    created_at_ms: state.created_at_ms,
                    updated_at_ms: now,
                },
            ) {
                projected.push(start);
            }
        }
        let tool_sequence = first_sequence + u64::from(needs_preparation_start);
        if let Some(event) = canonical_tool_item_event(
            event,
            ToolItemLifecycleContext {
                session_id: self.session_id.clone(),
                thread_id: self.thread_id.clone(),
                sequence: tool_sequence,
                ordinal: state.ordinal,
                created_at_ms: state.created_at_ms,
                updated_at_ms: now,
            },
        ) {
            let event = match state.command_start.as_ref() {
                Some(start) => apply_command_start(event, start),
                None => event,
            };
            if matches!(&event, AgentEvent::ItemCompleted { .. }) {
                self.items
                    .lock()
                    .expect("tool item lifecycle mutex poisoned")
                    .remove(&key);
            }
            let event = project_dynamic_tool_event(
                event,
                dynamic_tool_route.as_ref(),
                dynamic_tool_arguments.as_ref(),
            );
            projected.push(project_mcp_tool_event(event, mcp_route.as_ref()));
        }
        if let Some(activity) = subagent_activity {
            projected.push(activity.into_event(ToolItemLifecycleContext {
                session_id: self.session_id.clone(),
                thread_id: self.thread_id.clone(),
                sequence: tool_sequence + 1,
                ordinal: self.next_ordinal.fetch_add(1, Ordering::Relaxed) + 1,
                created_at_ms: now,
                updated_at_ms: now,
            }));
        }
        projected
    }

    fn send_command_event(&self, event: AgentEvent) {
        if let Some(publisher) = self.command_publisher.as_ref() {
            publisher.publish(&event);
        } else {
            let _ = self
                .event_sender
                .send(CurrentTurnHostEvent::ToolLifecycle(event));
        }
    }
}

fn project_dynamic_tool_event(
    event: AgentEvent,
    route: Option<&DynamicToolRoute>,
    arguments: Option<&serde_json::Value>,
) -> AgentEvent {
    let Some(route) = route else {
        return event;
    };
    match event {
        AgentEvent::ItemStarted { item } => AgentEvent::ItemStarted {
            item: project_dynamic_tool_item(item, route, arguments),
        },
        AgentEvent::ItemUpdated { item } => AgentEvent::ItemUpdated {
            item: project_dynamic_tool_item(item, route, arguments),
        },
        AgentEvent::ItemCompleted { item } => AgentEvent::ItemCompleted {
            item: project_dynamic_tool_item(item, route, arguments),
        },
        event => event,
    }
}

fn project_dynamic_tool_item(
    mut item: ThreadItem,
    route: &DynamicToolRoute,
    arguments: Option<&serde_json::Value>,
) -> ThreadItem {
    let mut metadata = item.metadata.as_object().cloned().unwrap_or_default();
    let content_items = metadata
        .remove("dynamic_tool_content_items")
        .and_then(|value| serde_json::from_value::<Vec<DynamicToolCallContentItem>>(value).ok())
        .unwrap_or_default();
    let success = metadata.remove("success").and_then(|value| value.as_bool());
    metadata.remove("dynamic_tool");
    metadata.remove("duration_ms");
    item.payload = match item.payload {
        ThreadItemPayload::Tool {
            call_id, output, ..
        } => ThreadItemPayload::DynamicToolCall {
            call_id,
            namespace: route.namespace.clone(),
            tool: route.tool.clone(),
            arguments: arguments.cloned().unwrap_or(serde_json::Value::Null),
            content_items,
            success,
            duration_ms: output.and_then(|output| output.duration_ms),
        },
        payload => payload,
    };
    item.kind = item.payload.kind();
    item.metadata = serde_json::Value::Object(metadata);
    item
}

fn project_mcp_tool_event(
    event: AgentEvent,
    route: Option<&tool_runtime::mcp_connection::McpStepRouteIdentity>,
) -> AgentEvent {
    let Some(route) = route else {
        return event;
    };
    match event {
        AgentEvent::ItemStarted { item } => AgentEvent::ItemStarted {
            item: project_mcp_tool_item(item, route),
        },
        AgentEvent::ItemUpdated { item } => AgentEvent::ItemUpdated {
            item: project_mcp_tool_item(item, route),
        },
        AgentEvent::ItemCompleted { item } => AgentEvent::ItemCompleted {
            item: project_mcp_tool_item(item, route),
        },
        event => event,
    }
}

fn project_mcp_tool_item(
    mut item: ThreadItem,
    route: &tool_runtime::mcp_connection::McpStepRouteIdentity,
) -> ThreadItem {
    item.payload = match item.payload {
        ThreadItemPayload::Tool {
            call_id,
            arguments,
            output,
            ..
        } => ThreadItemPayload::McpToolCall {
            call_id,
            server_name: route.server_name.clone(),
            tool_name: route.tool_name.clone(),
            app_context: route.app_context.clone().map(|context| {
                agent_protocol::McpToolCallAppContext {
                    connector_id: context.connector_id,
                    link_id: context.link_id,
                    resource_uri: context.resource_uri,
                    app_name: context.app_name,
                    action_name: context.action_name,
                }
            }),
            mcp_app_resource_uri: route.mcp_app_resource_uri.clone(),
            plugin_id: route.plugin_id.clone(),
            arguments,
            output,
        },
        payload => payload,
    };
    item.kind = item.payload.kind();
    item
}

impl ToolLifecycleEmitter for CurrentTurnToolLifecycleEmitter {
    fn emit_command_start<'a>(
        &'a self,
        start: CommandStartEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        Box::pin(async move {
            let now = chrono::Utc::now().timestamp_millis();
            self.owned_commands
                .lock()
                .expect("owned commands mutex poisoned")
                .insert(start.call_id.clone());
            let key = format!("{}\0{}", start.turn_id, start.call_id);
            let (state, already_started) = {
                let mut items = self
                    .items
                    .lock()
                    .expect("tool item lifecycle mutex poisoned");
                let already_started = items.contains_key(&key);
                let state = items.entry(key).or_insert_with(|| ToolItemLifecycleState {
                    ordinal: self.next_ordinal.fetch_add(1, Ordering::Relaxed) + 1,
                    created_at_ms: now,
                    command_start: None,
                });
                state.command_start = Some(start.clone());
                (state.clone(), already_started)
            };
            let item = canonical_command_start_item(
                &start,
                ToolItemLifecycleContext {
                    session_id: self.session_id.clone(),
                    thread_id: self.thread_id.clone(),
                    sequence: self.next_sequence.fetch_add(1, Ordering::Relaxed) + 1,
                    ordinal: state.ordinal,
                    created_at_ms: state.created_at_ms,
                    updated_at_ms: now,
                },
            );
            let event = if already_started {
                AgentEvent::ItemUpdated { item }
            } else {
                AgentEvent::ItemStarted { item }
            };
            self.send_command_event(event);
        })
    }

    fn emit<'a>(&'a self, event: ToolLifecycleEvent) -> ToolLifecycleEmissionFuture<'a> {
        Box::pin(async move {
            if event.tool_name == tool_runtime::unified_exec::WRITE_STDIN_TOOL_NAME
                || (event.tool_name == tool_runtime::unified_exec::EXEC_COMMAND_TOOL_NAME
                    && self
                        .owned_commands
                        .lock()
                        .expect("owned commands mutex poisoned")
                        .contains(&event.call_id))
            {
                return;
            }
            if event.output.as_ref().is_some_and(|output| {
                output
                    .metadata
                    .get("command_lifecycle_owned")
                    .and_then(serde_json::Value::as_bool)
                    == Some(true)
            }) {
                return;
            }
            for trace_event in code_cell_trace_events_for_lifecycle(&event) {
                let _ = self.event_sender.send(CurrentTurnHostEvent::ToolLifecycle(
                    AgentEvent::CodeCellTrace { event: trace_event },
                ));
            }
            for event in self.project_all(event) {
                let _ = self
                    .event_sender
                    .send(CurrentTurnHostEvent::ToolLifecycle(event));
            }
        })
    }

    fn emit_command_result<'a>(
        &'a self,
        event: ToolLifecycleEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        Box::pin(async move {
            for event in self.project_all(event) {
                self.send_command_event(event);
            }
        })
    }

    fn command_error(&self) -> Option<String> {
        self.command_publisher
            .as_ref()
            .and_then(super::CommandEventPublisher::error)
    }

    fn emit_code_cell_trace<'a>(
        &'a self,
        event: CodeCellTraceEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        Box::pin(async move {
            let _ = self.event_sender.send(CurrentTurnHostEvent::ToolLifecycle(
                AgentEvent::CodeCellTrace { event },
            ));
        })
    }

    fn emit_output_delta<'a>(
        &'a self,
        event: ToolOutputDeltaEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        Box::pin(async move {
            if event.delta.is_empty() {
                return;
            }
            let mut metadata = event.metadata;
            metadata
                .entry("turn_id".to_string())
                .or_insert_with(|| serde_json::Value::String(event.turn_id));
            metadata
                .entry("tool_name".to_string())
                .or_insert_with(|| serde_json::Value::String(event.tool_name));
            let event = AgentEvent::ToolOutputDelta {
                tool_id: event.call_id,
                delta: event.delta,
                output_kind: event.output_kind,
                metadata: Some(metadata),
            };
            if event_metadata_is_unified_command(&event) {
                self.send_command_event(event);
            } else {
                let _ = self
                    .event_sender
                    .send(CurrentTurnHostEvent::ToolLifecycle(event));
            }
        })
    }
}

fn event_metadata_is_unified_command(event: &AgentEvent) -> bool {
    matches!(event, AgentEvent::ToolOutputDelta { metadata: Some(metadata), .. }
        if metadata.get("executionSurface").and_then(serde_json::Value::as_str) == Some("unified_exec"))
}

fn code_cell_trace_events_for_lifecycle(event: &ToolLifecycleEvent) -> Vec<CodeCellTraceEvent> {
    let mut traces = Vec::new();
    if event.tool_name == code_mode::CODE_MODE_EXEC_TOOL_NAME
        && matches!(event.phase, ToolLifecyclePhase::Started)
    {
        traces.push(CodeCellTraceEvent::SourceItemObserved {
            turn_id: event.turn_id.clone(),
            model_visible_call_id: event.call_id.clone(),
            source_item_id: ItemId::new(event.call_id.clone()).to_string(),
        });
    }
    if event.tool_name == code_mode::CODE_MODE_EXEC_TOOL_NAME
        && matches!(event.phase, ToolLifecyclePhase::Completed)
    {
        let runtime_cell_id = event
            .output
            .as_ref()
            .and_then(|output| output.metadata.get("code_mode_cell_id"))
            .and_then(serde_json::Value::as_str);
        if let Some(runtime_cell_id) = runtime_cell_id {
            traces.push(CodeCellTraceEvent::OutputItemObserved {
                turn_id: event.turn_id.clone(),
                runtime_cell_id: runtime_cell_id.to_string(),
                output_item_id: ItemId::new(event.call_id.clone()).to_string(),
            });
        }
    }
    traces
}

#[cfg(test)]
#[path = "tool_lifecycle_emitter/tests.rs"]
mod tests;
