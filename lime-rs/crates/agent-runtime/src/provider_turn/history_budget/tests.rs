use super::*;
use serde_json::Value;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tool_runtime::{
    tool_executor::RuntimeToolExecutionOutcome, tool_lifecycle::ToolLifecyclePhase,
    tool_result_projection::NormalizedToolOutput,
};

#[derive(Default)]
struct Recorder(Mutex<Vec<(&'static str, Option<usize>)>>);

impl Recorder {
    fn record(&self, channel: &'static str, limit: Option<usize>) {
        self.0.lock().unwrap().push((channel, limit));
    }
}

impl ToolLifecycleEmitter for Recorder {
    fn emit<'a>(&'a self, event: ToolLifecycleEvent) -> ToolLifecycleEmissionFuture<'a> {
        self.record(
            "tool",
            event.output.and_then(|output| output.history_token_limit),
        );
        Box::pin(async {})
    }
    fn emit_command_result<'a>(
        &'a self,
        event: ToolLifecycleEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        self.record(
            "command",
            event.output.and_then(|output| output.history_token_limit),
        );
        Box::pin(async {})
    }
    fn command_error(&self) -> Option<String> {
        Some("durable failure".into())
    }
    fn emit_command_start<'a>(&'a self, _: CommandStartEvent) -> ToolLifecycleEmissionFuture<'a> {
        self.record("start", None);
        Box::pin(async {})
    }
    fn emit_code_cell_trace<'a>(
        &'a self,
        _: CodeCellTraceEvent,
    ) -> ToolLifecycleEmissionFuture<'a> {
        self.record("trace", None);
        Box::pin(async {})
    }
    fn emit_output_delta<'a>(&'a self, _: ToolOutputDeltaEvent) -> ToolLifecycleEmissionFuture<'a> {
        self.record("delta", None);
        Box::pin(async {})
    }
}

fn event(limit: Option<usize>) -> ToolLifecycleEvent {
    let mut output =
        NormalizedToolOutput::from_execution_outcome(RuntimeToolExecutionOutcome::Aborted, 1);
    output.history_token_limit = limit;
    ToolLifecycleEvent {
        turn_id: "turn".into(),
        call_id: "call".into(),
        tool_name: "exec_command".into(),
        arguments: Value::Null,
        provider_metadata: Value::Null,
        environments: Vec::new(),
        phase: ToolLifecyclePhase::Completed,
        output: Some(output),
    }
}

#[tokio::test]
async fn budget_emitter_preserves_tool_override_and_command_ack_channels() {
    let recorder = Arc::new(Recorder::default());
    let emitter = emitter(recorder.clone(), Some(120));
    emitter.emit(event(None)).await;
    emitter.emit(event(Some(0))).await;
    emitter.emit_command_result(event(Some(7))).await;
    assert_eq!(emitter.command_error().as_deref(), Some("durable failure"));
    emitter
        .emit_command_start(CommandStartEvent {
            turn_id: "turn".into(),
            call_id: "call".into(),
            command: "pwd".into(),
            argv: vec!["pwd".into()],
            cwd: PathBuf::from("."),
            process_id: "process".into(),
        })
        .await;
    emitter
        .emit_code_cell_trace(CodeCellTraceEvent::SourceItemObserved {
            turn_id: "turn".into(),
            model_visible_call_id: "call".into(),
            source_item_id: "item".into(),
        })
        .await;
    emitter
        .emit_output_delta(ToolOutputDeltaEvent {
            turn_id: "turn".into(),
            call_id: "call".into(),
            tool_name: "exec_command".into(),
            delta: "output".into(),
            output_kind: None,
            metadata: HashMap::new(),
        })
        .await;
    assert_eq!(
        *recorder.0.lock().unwrap(),
        vec![
            ("tool", Some(120)),
            ("tool", Some(0)),
            ("command", Some(7)),
            ("start", None),
            ("trace", None),
            ("delta", None),
        ]
    );
}
