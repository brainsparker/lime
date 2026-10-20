use super::super::request_context::session_config_from_request;
use super::*;

#[test]
fn async_user_input_config_uses_admitted_root_and_resolved_config_only() {
    for is_root in [false, true] {
        for enabled in [None, Some(false), Some(true)] {
            let mut request = request_for_test(
                "continue",
                Some(app_server_protocol::RuntimeRequest {
                    provider_preference: Some("openai".to_string()),
                    model_preference: Some("gpt-5.4".to_string()),
                    ..Default::default()
                }),
                Some(json!({
                    "is_root_agent": !is_root,
                    "tools": {"experimental_request_user_input": {"enabled": true}},
                    "config": {"tools": {"experimental_request_user_input": {"enabled": true}}}
                })),
            );
            request.is_root_agent = is_root;
            // A normal fork can be a root; fork lineage is not subagent authority.
            request.forked_from_thread_id = Some("source-thread".to_string());
            let host = runtime_request_from_request(&request);
            let scope = session_scope_from_request(&request).unwrap();
            let selection = selection_from_explicit_preferences(&request).unwrap();
            let policy = request_tool_policy_from_request(host.as_ref());
            let config = session_config_from_request(
                &request,
                host.as_ref(),
                &scope,
                &selection,
                &policy,
                enabled.map(|enabled| {
                    json!({
                        "tools": {"experimental_request_user_input": {"enabled": enabled}}
                    })
                }),
            );
            assert_eq!(config.is_root_agent, is_root);
            assert_eq!(
                config.experimental_request_user_input_enabled,
                enabled.unwrap_or(false)
            );
        }
    }
}

#[test]
fn history_ingestion_requires_an_explicit_request_for_every_session_kind() {
    for kind in ["agent.thread", "conversation.import"] {
        for (metadata, expected) in [
            (None, false),
            (Some(json!({ "historyIngestRequested": true })), true),
            (Some(json!({ "history_ingest_requested": false })), false),
            (
                Some(json!({ "harness": { "history_ingest_requested": true } })),
                true,
            ),
            (
                Some(json!({ "harness": { "historyIngestRequested": false } })),
                false,
            ),
        ] {
            let mut request = request_for_test(
                "continue",
                Some(app_server_protocol::RuntimeRequest {
                    provider_preference: Some("openai".to_string()),
                    model_preference: Some("gpt-5.4".to_string()),
                    ..Default::default()
                }),
                metadata,
            );
            request.session.business_object_ref = Some(BusinessObjectRef {
                kind: kind.to_string(),
                id: "thread-1".to_string(),
                title: None,
                uri: None,
                metadata: Some(json!({
                    "importedContinuation": { "historyIngestRequested": true },
                    "historyIngestRequested": true
                })),
            });
            let host = runtime_request_from_request(&request);
            let scope = session_scope_from_request(&request).expect("scope");
            let selection = selection_from_explicit_preferences(&request).expect("selection");
            let policy = request_tool_policy_from_request(host.as_ref());
            let config = session_config_from_request(
                &request,
                host.as_ref(),
                &scope,
                &selection,
                &policy,
                None,
            );

            assert_eq!(config.history_ingest_requested, expected, "{kind}");
        }
    }
}
