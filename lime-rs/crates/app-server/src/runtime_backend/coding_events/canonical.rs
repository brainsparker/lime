use super::*;
use agent_protocol::{ItemId, ItemStatus, ThreadItem, ThreadItemPayload, ToolArgument, ToolOutput};

pub(super) fn terminal_interaction_event(item: &ThreadItem) -> Option<RuntimeEvent> {
    let metadata = item.metadata.as_object()?;
    let interaction = metadata
        .get("terminalInteractions")?
        .as_array()?
        .last()?
        .as_object()?;
    let process_id = interaction.get("processId")?.as_str()?;
    let stdin = interaction
        .get("stdin")?
        .as_str()
        .filter(|value| terminal_interaction_summary_is_safe(value))?;
    let command_id = match &item.payload {
        ThreadItemPayload::Command { .. } => command_item_id(item),
        ThreadItemPayload::Tool { .. } => {
            ItemId::new(metadata.get("exec_command_call_id")?.as_str()?.to_string())
                .as_str()
                .to_string()
        }
        _ => return None,
    };
    let mut payload = json!({
        "commandId": command_id,
        "processId": process_id,
        "stdin": stdin,
        "source": "unified_exec",
    });
    if let ThreadItemPayload::Tool { call_id, .. } = &item.payload {
        payload["toolCallId"] = Value::String(call_id.clone());
    }
    Some(RuntimeEvent::new("command.interaction", payload))
}

pub(super) fn terminal_interaction_summary_is_safe(value: &str) -> bool {
    if matches!(value, "(poll)" | "(interrupt)") {
        return true;
    }
    value
        .strip_prefix("sent ")
        .and_then(|value| value.strip_suffix(" chars"))
        .is_some_and(|count| !count.is_empty() && count.bytes().all(|byte| byte.is_ascii_digit()))
}

pub(super) struct CanonicalToolItem<'a> {
    pub(super) call_id: &'a str,
    pub(super) name: &'a str,
    pub(super) arguments: &'a [ToolArgument],
    pub(super) output: Option<&'a ToolOutput>,
}

#[derive(Clone, Copy)]
pub(super) struct CanonicalCommandItem<'a> {
    command: &'a str,
    cwd: Option<&'a str>,
    output: Option<&'a str>,
    exit_code: Option<i32>,
}

pub(super) fn canonical_tool_item(item: &ThreadItem) -> Option<CanonicalToolItem<'_>> {
    let ThreadItemPayload::Tool {
        call_id,
        name,
        arguments,
        output,
    } = &item.payload
    else {
        return None;
    };
    Some(CanonicalToolItem {
        call_id,
        name,
        arguments,
        output: output.as_ref(),
    })
}

pub(super) fn canonical_command_item(item: &ThreadItem) -> Option<CanonicalCommandItem<'_>> {
    let ThreadItemPayload::Command {
        command,
        cwd,
        output,
        exit_code,
    } = &item.payload
    else {
        return None;
    };
    Some(CanonicalCommandItem {
        command,
        cwd: cwd.as_deref(),
        output: output.as_deref(),
        exit_code: *exit_code,
    })
}

pub(super) fn command_item_id(item: &ThreadItem) -> String {
    item.metadata
        .as_object()
        .and_then(|metadata| metadata.get("exec_command_call_id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            item.item_id
                .as_str()
                .strip_prefix("item_")
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| item.item_id.as_str().to_string())
}

pub(super) fn command_item_arguments(command: CanonicalCommandItem<'_>) -> Value {
    let mut arguments = serde_json::Map::new();
    arguments.insert(
        "cmd".to_string(),
        Value::String(command.command.to_string()),
    );
    if let Some(cwd) = command.cwd {
        arguments.insert("workdir".to_string(), Value::String(cwd.to_string()));
    }
    Value::Object(arguments)
}

pub(super) fn command_item_metadata(item: &ThreadItem) -> Option<HashMap<String, Value>> {
    item.metadata.as_object().map(|metadata| {
        metadata
            .iter()
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect()
    })
}

pub(super) fn command_item_result(
    item: &ThreadItem,
    command: CanonicalCommandItem<'_>,
) -> AgentToolResult {
    let mut metadata = command_item_metadata(item).unwrap_or_default();
    metadata
        .entry("command".to_string())
        .or_insert_with(|| Value::String(command.command.to_string()));
    if let Some(cwd) = command.cwd {
        metadata
            .entry("cwd".to_string())
            .or_insert_with(|| Value::String(cwd.to_string()));
    }
    if let Some(exit_code) = command.exit_code {
        metadata
            .entry("exit_code".to_string())
            .or_insert_with(|| Value::from(exit_code));
    }
    if matches!(item.status, ItemStatus::Cancelled | ItemStatus::Interrupted) {
        metadata
            .entry("itemStatus".to_string())
            .or_insert_with(|| Value::String("canceled".to_string()));
        metadata
            .entry("executionProcessStatus".to_string())
            .or_insert_with(|| Value::String("terminated".to_string()));
    }
    AgentToolResult {
        success: item.status == ItemStatus::Completed,
        output: command.output.unwrap_or_default().to_string(),
        error: None,
        structured_content: None,
        images: None,
        metadata: (!metadata.is_empty()).then_some(metadata),
    }
}

pub(super) fn canonical_arguments_value(arguments: &[ToolArgument]) -> Option<Value> {
    if arguments.is_empty() {
        return None;
    }
    if let [argument] = arguments {
        if argument.name == "value" {
            return Some(
                serde_json::from_str(&argument.value)
                    .unwrap_or_else(|_| Value::String(argument.value.clone())),
            );
        }
    }
    Some(Value::Object(
        arguments
            .iter()
            .map(|argument| {
                let value = serde_json::from_str(&argument.value)
                    .unwrap_or_else(|_| Value::String(argument.value.clone()));
                (argument.name.clone(), value)
            })
            .collect(),
    ))
}

pub(super) fn canonical_agent_tool_result(
    item: &ThreadItem,
    output: &ToolOutput,
) -> AgentToolResult {
    let mut metadata = item
        .metadata
        .as_object()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .collect::<HashMap<_, _>>();
    if let Some(duration_ms) = output.duration_ms {
        metadata
            .entry("duration_ms".to_string())
            .or_insert(Value::from(duration_ms));
    }
    if output.truncated {
        metadata
            .entry("truncated".to_string())
            .or_insert(Value::Bool(true));
    }
    if let Some(output_ref) = output.output_ref.as_ref() {
        metadata
            .entry("output_ref".to_string())
            .or_insert_with(|| Value::String(output_ref.clone()));
    }
    AgentToolResult {
        success: item.status == ItemStatus::Completed,
        output: output.text.clone().unwrap_or_default(),
        error: output.error.clone(),
        structured_content: output.structured_content.clone(),
        images: None,
        metadata: (!metadata.is_empty()).then_some(metadata),
    }
}

impl CodingEventMirror {
    pub(super) fn handle_command_start(
        &mut self,
        item: &ThreadItem,
        command: CanonicalCommandItem<'_>,
    ) -> Vec<RuntimeEvent> {
        let command_id = command_item_id(item);
        let arguments = command_item_arguments(command);
        let command_facts = command_facts_from_text(command.command);
        let (mut events, test_run_id) = self.shell_start_events(
            &command_id,
            "exec_command",
            Some(&arguments),
            command_facts.as_ref(),
            "runtime_unified_exec",
        );
        // The canonical item owns lifecycle; the mirror only adds output/test facts.
        events.retain(|event| event.event_type != "command.started");
        self.tools.insert(
            command_id,
            TrackedTool {
                name: "exec_command".to_string(),
                arguments: Some(arguments),
                command_facts,
                test_run_id,
                patch_id: None,
                emitted_output: false,
            },
        );
        events
    }

    pub(super) fn handle_command_update(
        &mut self,
        item: &ThreadItem,
        command: CanonicalCommandItem<'_>,
    ) -> Vec<RuntimeEvent> {
        let command_id = command_item_id(item);
        if !self.tools.contains_key(&command_id) {
            let mut events = self.handle_command_start(item, command);
            events.extend(self.handle_command_output(item, command));
            return events;
        }
        self.handle_command_output(item, command)
    }

    pub(super) fn handle_command_output(
        &mut self,
        item: &ThreadItem,
        command: CanonicalCommandItem<'_>,
    ) -> Vec<RuntimeEvent> {
        let command_id = command_item_id(item);
        let metadata = command_item_metadata(item);
        let output_kind = metadata
            .as_ref()
            .and_then(|metadata| metadata_string(metadata, &["outputKind", "output_kind"]));
        self.handle_tool_output_delta(
            &command_id,
            command.output.unwrap_or_default(),
            output_kind.as_deref(),
            metadata.as_ref(),
        )
    }

    pub(super) fn handle_command_completed(
        &mut self,
        item: &ThreadItem,
        command: CanonicalCommandItem<'_>,
    ) -> CodingMirrorEvents {
        let command_id = command_item_id(item);
        let streamed_output = self
            .tools
            .get(&command_id)
            .is_some_and(|tool| tool.emitted_output);
        let mut final_output = if streamed_output || command.output.is_none_or(str::is_empty) {
            Vec::new()
        } else if self.tools.contains_key(&command_id) {
            self.handle_command_output(item, command)
        } else {
            let mut events = self.handle_command_start(item, command);
            events.extend(self.handle_command_output(item, command));
            events
        };
        let result = command_item_result(item, command);
        let terminal = self.handle_tool_end(&command_id, &result);
        let (output, mut after_raw): (Vec<_>, Vec<_>) = final_output
            .drain(..)
            .partition(|event| event.event_type == "command.output");
        let mut before_raw = output;
        before_raw.extend(terminal.before_raw);
        before_raw.retain(|event| event.event_type != "command.exited");
        after_raw.extend(terminal.after_raw);
        after_raw.retain(|event| event.event_type != "command.exited");
        CodingMirrorEvents {
            before_raw,
            after_raw,
        }
    }
}
