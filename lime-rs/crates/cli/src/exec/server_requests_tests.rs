use super::*;
use serde_json::json;

#[test]
fn typed_interactions_never_grant_consent_or_invent_user_answers() {
    let scope = json!({"threadId":"thread", "turnId":"turn", "itemId":"item", "startedAtMs":1});
    for (method, extra, expected) in [
        (
            "item/commandExecution/requestApproval",
            json!({}),
            json!({"decision":"cancel"}),
        ),
        (
            "item/fileChange/requestApproval",
            json!({}),
            json!({"decision":"cancel"}),
        ),
        (
            "item/permissions/requestApproval",
            json!({"cwd":"/workspace", "permissions":{}}),
            json!({"permissions":{}, "scope":"turn"}),
        ),
        (
            "item/tool/requestUserInput",
            json!({"questions":[], "isBlocking":true}),
            json!({"answers":{}}),
        ),
    ] {
        let mut params = scope.clone();
        params
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        let request =
            serde_json::from_value(json!({"method":method, "id":"exact-request", "params":params}))
                .unwrap();
        let ServerResponse::Reply { id, result } = response_for(request).unwrap() else {
            panic!("expected typed response for {method}")
        };
        assert_eq!(id, RequestId::String("exact-request".into()));
        assert_eq!(result, expected, "method={method}");
    }
}

#[test]
fn mcp_elicitation_is_canceled_for_parent_and_attached_child_threads() {
    for (thread, request_id) in [
        ("parent-thread", RequestId::Integer(7)),
        ("child-thread", RequestId::String("child-request".into())),
    ] {
        let request = serde_json::from_value(json!({
            "method": "mcpServer/elicitation/request", "id": request_id,
            "params": {
                "threadId": thread, "serverName": "server", "mode": "form",
                "message": "input", "requestedSchema": {"type": "object"},
                "_meta": {"fixture": "request-only"}
            }
        }))
        .unwrap();
        let ServerResponse::Reply { id, result } = response_for(request).unwrap() else {
            panic!("non-interactive client must cancel elicitation for {thread}")
        };
        assert_eq!(id, request_id);
        assert_eq!(result, json!({"action": "cancel"}));
        serde_json::from_value::<McpServerElicitationRequestResponse>(result)
            .unwrap()
            .validate()
            .unwrap();
    }
}
