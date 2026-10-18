//! 模型摘要只消费规范历史，不进入工具执行循环；只有完整响应可以提交上下文窗口。

use futures::StreamExt;
use model_provider::current_client::{
    CanonicalLlmEvent, CurrentProvider, CurrentProviderError, CurrentProviderRequest, FinishReason,
};
use tokio_util::sync::CancellationToken;

pub async fn summarize_context(
    provider: &dyn CurrentProvider,
    mut request: CurrentProviderRequest,
    cancellation: CancellationToken,
) -> Result<String, CurrentProviderError> {
    if cancellation.is_cancelled() {
        return Err(cancelled());
    }
    request.tools.clear();
    request.messages = crate::context_history::normalize_tool_history(
        &request.messages,
        request
            .model_request_policy
            .as_ref()
            .and_then(|policy| policy.truncation),
    );
    let mut stream = tokio::select! {
        biased;
        _ = cancellation.cancelled() => return Err(cancelled()),
        result = provider.stream(request) => result?,
    };
    let mut summary = String::new();
    loop {
        let event = tokio::select! {
            biased;
            _ = cancellation.cancelled() => return Err(cancelled()),
            event = stream.next() => event,
        };
        match event {
            Some(Ok(CanonicalLlmEvent::TextDelta { text, .. })) => summary.push_str(&text),
            Some(Ok(CanonicalLlmEvent::Finish {
                reason: FinishReason::Stop,
                ..
            })) => {
                if summary.trim().is_empty() {
                    return Err(CurrentProviderError::new(
                        "Context compaction completed without an assistant summary",
                    ));
                }
                return Ok(summary);
            }
            Some(Ok(CanonicalLlmEvent::Finish { reason, .. })) => {
                return Err(CurrentProviderError::new(format!(
                    "Context compaction did not complete: {reason:?}"
                )));
            }
            Some(Ok(
                CanonicalLlmEvent::ToolCall { .. } | CanonicalLlmEvent::CustomToolCall { .. },
            )) => {
                return Err(CurrentProviderError::new(
                    "Context compaction cannot execute tool calls",
                ));
            }
            Some(Ok(CanonicalLlmEvent::ProviderError { message, .. })) => {
                return Err(CurrentProviderError::new(message));
            }
            Some(Err(error)) => return Err(error),
            Some(Ok(_)) => {}
            None => {
                return Err(CurrentProviderError::new(
                    "Context compaction stream ended before completion",
                ));
            }
        }
    }
}

fn cancelled() -> CurrentProviderError {
    CurrentProviderError::new("Context compaction cancelled")
}

#[cfg(test)]
mod tests;
