use super::*;
use axum::http::HeaderValue;

fn key_headers(name: &'static str, key: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(name, HeaderValue::from_str(key).unwrap());
    headers
}

#[tokio::test]
async fn accepts_the_configured_key_in_both_wire_formats() {
    for headers in [
        key_headers("authorization", "Bearer server-secret"),
        key_headers("x-api-key", "server-secret"),
    ] {
        verify_api_key(&headers, "server-secret").await.unwrap();
        verify_api_key_anthropic(&headers, "server-secret")
            .await
            .unwrap();
    }
}

#[tokio::test]
async fn rejects_retired_plugin_tokens_even_with_a_valid_signature() {
    // 旧签发器生成、有效期至 2100 年的固定测试 token；不保留旧签发逻辑。
    let token = concat!(
        "lime-plugin:v1:content-factory-app:4102444800:nonce-1:model-generation:",
        "258547ced59cb9ccf9dd4d6f57e9ebce0ca444156ec2f234b916471827edd96f"
    );
    for headers in [
        key_headers("authorization", &format!("Bearer {token}")),
        key_headers("x-api-key", token),
    ] {
        assert_eq!(
            verify_api_key(&headers, "server-secret")
                .await
                .unwrap_err()
                .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            verify_api_key_anthropic(&headers, "server-secret")
                .await
                .unwrap_err()
                .0,
            StatusCode::UNAUTHORIZED
        );
    }
}

#[tokio::test]
async fn rejects_missing_or_incorrect_keys() {
    for headers in [
        HeaderMap::new(),
        key_headers("authorization", "Bearer wrong-secret"),
    ] {
        assert_eq!(
            verify_api_key(&headers, "server-secret")
                .await
                .unwrap_err()
                .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            verify_api_key_anthropic(&headers, "server-secret")
                .await
                .unwrap_err()
                .0,
            StatusCode::UNAUTHORIZED
        );
    }
}
