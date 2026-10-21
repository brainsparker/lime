use super::super::native_history;
use super::*;

#[derive(Debug, Default)]
struct AnthropicStreamState {
    response_id: Option<String>,
    calls: BTreeMap<u32, ToolCallAccumulator>,
    emitted_tool_call: bool,
    usage: Option<Usage>,
    text_ids: HashSet<String>,
    reasoning_ids: HashSet<String>,
    thinking_blocks: BTreeMap<u32, (String, String)>,
    finish_reason: Option<FinishReason>,
}

pub(in super::super) fn anthropic_sse(
    response: Response,
) -> impl Stream<Item = Result<LlmEvent, CurrentProviderError>> + Send {
    try_stream! {
        let mut state = AnthropicStreamState::default();
        let mut frames = Box::pin(sse_frames(response));
        while let Some(frame) = frames.next().await {
            let frame = frame?;
            let event: anthropic::AnthropicStreamEvent = serde_json::from_str(&frame.data)
                .map_err(|error| CurrentProviderError::new(format!("解析 Anthropic SSE event 失败: {error}")))?;
            match event {
                anthropic::AnthropicStreamEvent::MessageStart { message } => {
                    state.response_id = Some(message.id);
                    if let Some(usage) = message.usage {
                        let usage = anthropic_usage(usage);
                        yield LlmEvent::Usage { usage: usage.clone() };
                        state.usage = Some(usage);
                    }
                }
                anthropic::AnthropicStreamEvent::ContentBlockStart { index, content_block } => match content_block {
                    anthropic::AnthropicContentBlock::Text { text } => {
                        let id = format!("text-{index}");
                        state.text_ids.insert(id.clone());
                        yield LlmEvent::TextStart { id: id.clone() };
                        if !text.is_empty() { yield LlmEvent::TextDelta { id, text }; }
                    }
                    anthropic::AnthropicContentBlock::Thinking { thinking, signature } => {
                        state.thinking_blocks.insert(index, (thinking.clone(), signature));
                        let id = format!("reasoning-{index}");
                        state.reasoning_ids.insert(id.clone());
                        yield LlmEvent::ReasoningStart { id: id.clone() };
                        if !thinking.is_empty() {
                            yield LlmEvent::ReasoningContentDelta {
                                id,
                                text: thinking,
                                content_index: 0,
                            };
                        }
                    }
                    anthropic::AnthropicContentBlock::ToolUse { id, name, input } => {
                        let call = state.calls.entry(index).or_default();
                        call.id = Some(id.clone()); call.name = Some(name.clone()); call.started = true;
                        if input != Value::Null && input != json!({}) { call.arguments = serde_json::to_string(&input).unwrap_or_else(|_| "{}".to_string()); }
                        yield LlmEvent::ToolInputStart { id, name };
                    }
                    anthropic::AnthropicContentBlock::ToolResult { .. } | anthropic::AnthropicContentBlock::Image { .. } => {
                        yield LlmEvent::ProviderError { message: "unsupported Anthropic output content block".to_string(), classification: Some(FailureClassification::InvalidRequest), retryable: Some(false) };
                        return;
                    }
                },
                anthropic::AnthropicStreamEvent::ContentBlockDelta { index, delta } => match delta {
                    anthropic::AnthropicDelta::TextDelta { text } => if !text.is_empty() {
                        let id = format!("text-{index}");
                        if state.text_ids.insert(id.clone()) { yield LlmEvent::TextStart { id: id.clone() }; }
                        yield LlmEvent::TextDelta { id, text };
                    },
                    anthropic::AnthropicDelta::ThinkingDelta { thinking } => if !thinking.is_empty() {
                        state.thinking_blocks.entry(index).or_default().0.push_str(&thinking);
                        let id = format!("reasoning-{index}");
                        if state.reasoning_ids.insert(id.clone()) { yield LlmEvent::ReasoningStart { id: id.clone() }; }
                        yield LlmEvent::ReasoningContentDelta {
                            id,
                            text: thinking,
                            content_index: 0,
                        };
                    },
                    anthropic::AnthropicDelta::InputJsonDelta { partial_json } => {
                        let call = state.calls.entry(index).or_default();
                        let Some(name) = call.name.clone() else {
                            yield LlmEvent::ProviderError { message: "Anthropic tool call stream omitted tool name".to_string(), classification: Some(FailureClassification::InvalidRequest), retryable: Some(false) };
                            return;
                        };
                        let id = call.call_id(&format!("tool_{index}"));
                        if !call.started { call.started = true; yield LlmEvent::ToolInputStart { id: id.clone(), name: name.clone() }; }
                        call.arguments.push_str(&partial_json);
                        yield LlmEvent::ToolInputDelta { id, name, text: partial_json };
                    }
                    anthropic::AnthropicDelta::SignatureDelta { signature } => {
                        state.thinking_blocks.entry(index).or_default().1.push_str(&signature);
                    }
                },
                anthropic::AnthropicStreamEvent::ContentBlockStop { index } => {
                    let text_id = format!("text-{index}");
                    if state.text_ids.remove(&text_id) { yield LlmEvent::TextEnd { id: text_id }; }
                    let reasoning_id = format!("reasoning-{index}");
                    if let Some((thinking, signature)) = state.thinking_blocks.remove(&index) {
                        if !signature.is_empty() {
                            yield native_history::completed("anthropic", &reasoning_id,
                                vec![json!({"type":"thinking", "thinking":thinking, "signature":signature})]);
                        }
                    }
                    if state.reasoning_ids.remove(&reasoning_id) { yield LlmEvent::ReasoningEnd { id: reasoning_id }; }
                    if let Some(call) = state
                        .calls
                        .get_mut(&index)
                        .and_then(|call| call.into_call(&format!("tool_{index}")))
                    {
                        state.emitted_tool_call = true;
                        yield LlmEvent::ToolInputEnd { id: call.id.clone(), name: call.name.clone() };
                        yield LlmEvent::ToolCall { id: call.id, name: call.name, input: call.arguments, raw_arguments: Some(call.raw_arguments), provider_executed: None, provider_metadata: Default::default() };
                    }
                }
                anthropic::AnthropicStreamEvent::MessageDelta { delta, usage } => {
                    let usage = anthropic_usage(usage);
                    yield LlmEvent::Usage { usage: usage.clone() };
                    state.usage = Some(usage);
                    state.finish_reason = delta.stop_reason.as_deref().map(anthropic_finish_reason);
                }
                anthropic::AnthropicStreamEvent::MessageStop => {
                    drop(frames);
                    for id in state.text_ids.drain() { yield LlmEvent::TextEnd { id }; }
                    for id in state.reasoning_ids.drain() { yield LlmEvent::ReasoningEnd { id }; }
                    yield LlmEvent::Finish {
                        reason: state.finish_reason.unwrap_or_else(|| {
                            if state.emitted_tool_call { FinishReason::ToolCall } else { FinishReason::Stop }
                        }),
                        usage: state.usage,
                        needs_follow_up: false,
                        response_id: state.response_id,
                    };
                    return;
                }
            }
        }
        for id in state.text_ids.drain() { yield LlmEvent::TextEnd { id }; }
        for id in state.reasoning_ids.drain() { yield LlmEvent::ReasoningEnd { id }; }
        yield truncated_stream_error("Anthropic Messages");
    }
}
