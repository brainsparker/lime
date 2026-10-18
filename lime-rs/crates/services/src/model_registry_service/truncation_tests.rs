use super::*;

fn service() -> ModelRegistryService {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )
    .unwrap();
    ModelRegistryService::new(Arc::new(std::sync::Mutex::new(conn)))
}

fn catalogs(budget: Option<TruncationPolicy>) -> Vec<Vec<ApiModelResponse>> {
    let policy = serde_json::to_value(budget).unwrap();
    vec![
        ModelRegistryService::parse_openai_models_response(
            &serde_json::json!({
                "data":[{"id":"provider-model","truncation_policy":policy}]
            })
            .to_string(),
        )
        .unwrap(),
        ModelRegistryService::parse_anthropic_models_response(
            &serde_json::json!({
                "data":[{"id":"provider-model","truncationPolicy":policy}]
            })
            .to_string(),
        )
        .unwrap()
        .models,
        ModelRegistryService::parse_gemini_models_response(
            &serde_json::json!({
                "models":[{"name":"models/provider-model","truncationPolicy":policy}]
            })
            .to_string(),
        )
        .unwrap()
        .models,
        ModelRegistryService::parse_ollama_models_response(
            &serde_json::json!({
                "models":[{"name":"provider-model","truncation_policy":policy}]
            })
            .to_string(),
        )
        .unwrap(),
    ]
}

#[test]
fn catalog_truncation_survives_all_native_parsers_and_serialization() {
    let service = service();
    for budget in [
        Some(TruncationPolicy::Bytes(512)),
        Some(TruncationPolicy::Tokens(64)),
        Some(TruncationPolicy::Tokens(0)),
        None,
    ] {
        for catalog in catalogs(budget) {
            let model =
                service.convert_api_model(catalog.into_iter().next().unwrap(), "fixture", 0);
            let restored: EnhancedModelMetadata =
                serde_json::from_value(serde_json::to_value(&model).unwrap()).unwrap();
            assert_eq!(restored.truncation_policy, budget);
            assert_eq!(restored.id, "provider-model");
        }
    }
}

#[test]
fn catalog_truncation_is_independent_of_context_and_output_limits() {
    let service = service();
    let parsed = ModelRegistryService::parse_openai_models_response(
        r#"{"data":[{"id":"provider-model","context_window":128000,"output_token_limit":8192}]}"#,
    )
    .unwrap();
    let model = service.convert_api_model(parsed.into_iter().next().unwrap(), "fixture", 0);
    assert_eq!(model.truncation_policy, None);
}

#[test]
fn catalog_truncation_cache_keeps_endpoint_and_credential_scope() {
    let service = service();
    let parsed = catalogs(Some(TruncationPolicy::Tokens(16)))
        .remove(0)
        .remove(0);
    let model = service.convert_api_model(parsed, "fixture", 0);
    let provider_type = Some(ApiProviderType::Openai);
    let now = chrono::Utc::now().timestamp();
    let fingerprint = ModelRegistryService::credential_cache_fingerprint("fixture-key");
    service
        .save_provider_models_cache_scoped(
            "fixture",
            "http://localhost:18080/v1",
            provider_type,
            &[model],
            None,
            now,
            fingerprint.as_deref(),
        )
        .unwrap();
    let cache = service
        .get_cached_provider_models_scoped(
            "fixture",
            "http://localhost:18080/v1",
            provider_type,
            fingerprint.as_deref(),
        )
        .unwrap()
        .unwrap();
    assert_eq!(
        cache.models[0].truncation_policy,
        Some(TruncationPolicy::Tokens(16))
    );
    for (host, key) in [
        ("http://localhost:18081/v1", "fixture-key"),
        ("http://localhost:18080/v1", "other-key"),
    ] {
        let fingerprint = ModelRegistryService::credential_cache_fingerprint(key);
        assert!(service
            .get_cached_provider_models_scoped(
                "fixture",
                host,
                provider_type,
                fingerprint.as_deref()
            )
            .unwrap()
            .is_none());
    }
}

#[test]
fn responses_sampling_protocol_does_not_disable_standard_catalog_discovery() {
    assert_eq!(
        ModelRegistryService::resolve_model_fetch_protocol(
            "responses",
            "https://api.example/v1",
            Some(ApiProviderType::OpenaiResponse)
        ),
        ModelFetchProtocol::OpenAiCompatible
    );
    for host in [
        "https://api.example/v1/responses",
        "https://api.example/codex",
    ] {
        assert_eq!(
            ModelRegistryService::resolve_model_fetch_protocol(
                "responses",
                host,
                Some(ApiProviderType::OpenaiResponse)
            ),
            ModelFetchProtocol::ResponsesCompatible
        );
    }
}

#[tokio::test]
async fn responses_standard_catalog_uses_http_instead_of_declared_image_models() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let host = format!("http://{}/v1", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            request.push(stream.read_u8().await.unwrap());
        }
        let body =
            r#"{"data":[{"id":"catalog-model","truncation_policy":{"mode":"tokens","limit":24}}]}"#;
        let response = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        stream.write_all(response.as_bytes()).await.unwrap();
        String::from_utf8(request).unwrap()
    });
    let result = service()
        .fetch_models_from_api_with_hints(
            "fixture",
            &host,
            "fixture-key",
            Some(ApiProviderType::OpenaiResponse),
            &[ProviderModelConfig::hint("gpt-images-2")],
        )
        .await
        .unwrap();
    assert_eq!(result.source, ModelFetchSource::Api);
    assert_eq!(result.models.len(), 1);
    assert_eq!(result.models[0].id, "catalog-model");
    assert_eq!(
        result.models[0].truncation_policy,
        Some(TruncationPolicy::Tokens(24))
    );
    let capture = tokio::time::timeout(std::time::Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap();
    assert!(capture.starts_with("GET /v1/models "));
    assert!(capture
        .to_ascii_lowercase()
        .contains("authorization: bearer fixture-key\r\n"));
}
