use super::{
    provider_retry_after, server_disallows_retry, CurrentProviderError, FailureClassification,
};
use reqwest::Response;

const MAX_ERROR_BYTES: usize = 16 * 1024;

pub(super) async fn ensure_success_response(
    mut response: Response,
) -> Result<Response, CurrentProviderError> {
    if response.status().is_success() {
        return Ok(response);
    }
    let status = response.status();
    let mut error = CurrentProviderError::with_status(
        status,
        format!("Provider 请求失败 ({status})"),
        provider_retry_after(response.headers()),
    );
    if server_disallows_retry(response.headers()) {
        error.retryable = false;
    }
    if !matches!(status.as_u16(), 400 | 404 | 503) {
        return Err(error);
    }

    // 仅识别允许的错误码，响应正文可能含凭证或用户输入，不进入日志或错误消息。
    let model_not_found = tokio::time::timeout(std::time::Duration::from_secs(1), async {
        let mut body = Vec::new();
        while let Ok(Some(chunk)) = response.chunk().await {
            if body.len().saturating_add(chunk.len()) > MAX_ERROR_BYTES {
                return false;
            }
            body.extend_from_slice(&chunk);
        }
        serde_json::from_slice::<serde_json::Value>(&body)
            .ok()
            .is_some_and(|value| {
                value
                    .pointer("/error/code")
                    .and_then(serde_json::Value::as_str)
                    == Some("model_not_found")
            })
    })
    .await
    .unwrap_or(false);
    if model_not_found {
        error.message.push_str(": model_not_found");
        error.classification = Some(FailureClassification::InvalidRequest);
        error.retryable = false;
    }
    Err(error)
}

#[cfg(test)]
mod tests {
    use super::super::tests::{config, fixture_response, spawn_http_fixture, stream_error};
    use super::super::{CurrentProviderClient, RuntimeProviderProtocol};
    use super::*;
    use reqwest::{Client, StatusCode};
    use std::sync::atomic::Ordering;

    #[tokio::test]
    async fn unavailable_model_does_not_retry_or_open_provider_circuit() {
        let (base_url, requests, server) = spawn_http_fixture(vec![
            fixture_response(
                "503 Service Unavailable",
                "Retry-After: 0\r\n",
                r#"{"error":{"code":"model_not_found","message":"private request sk-secret"}}"#,
            ),
            fixture_response(
                "503 Service Unavailable",
                "X-Should-Retry: false\r\n",
                "other model remains reachable",
            ),
        ])
        .await;
        let mut runtime_config = config(Some(RuntimeProviderProtocol::ChatCompletions));
        runtime_config.base_url = Some(base_url);
        let client = CurrentProviderClient::with_client(
            runtime_config,
            Client::builder().no_proxy().build().unwrap(),
        );

        let error = stream_error(&client, "unavailable model").await;
        assert_eq!(error.status, Some(StatusCode::SERVICE_UNAVAILABLE.as_u16()));
        assert_eq!(
            error.classification,
            Some(FailureClassification::InvalidRequest)
        );
        assert!(!error.retryable);
        assert_eq!(
            error.message,
            "Provider 请求失败 (503 Service Unavailable): model_not_found"
        );
        assert!(!super::super::request_error_is_health_failure(&error));
        assert_eq!(requests.load(Ordering::SeqCst), 1);
        let second = stream_error(&client, "next request reaches provider").await;
        assert_eq!(
            second.status,
            Some(StatusCode::SERVICE_UNAVAILABLE.as_u16())
        );
        server.await.unwrap();
        assert_eq!(requests.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn unrecognized_or_oversized_errors_keep_generic_status_and_private_body_hidden() {
        for body in [
            r#"{"error":{"code":"private-code","message":"sk-secret"}}"#.to_string(),
            format!(
                r#"{{"error":{{"code":"model_not_found","message":"{}"}}}}"#,
                "x".repeat(MAX_ERROR_BYTES)
            ),
            "model_not_found sk-secret".to_string(),
        ] {
            let (base_url, _, server) =
                spawn_http_fixture(vec![fixture_response("503 Service Unavailable", "", &body)])
                    .await;
            let response = Client::new().get(base_url).send().await.unwrap();
            let error = ensure_success_response(response).await.unwrap_err();
            assert_eq!(error.message, "Provider 请求失败 (503 Service Unavailable)");
            assert!(error.retryable);
            assert_eq!(
                error.classification,
                Some(FailureClassification::ProviderInternal)
            );
            server.await.unwrap();
        }
    }

    #[tokio::test]
    async fn model_error_code_does_not_override_authentication_failure() {
        let (base_url, _, server) = spawn_http_fixture(vec![fixture_response(
            "401 Unauthorized",
            "",
            r#"{"error":{"code":"model_not_found","message":"sk-secret"}}"#,
        )])
        .await;
        let response = Client::new().get(base_url).send().await.unwrap();
        let error = ensure_success_response(response).await.unwrap_err();
        assert_eq!(
            error.classification,
            Some(FailureClassification::Authentication)
        );
        assert_eq!(error.message, "Provider 请求失败 (401 Unauthorized)");
        assert!(!error.retryable);
        server.await.unwrap();
    }
}
