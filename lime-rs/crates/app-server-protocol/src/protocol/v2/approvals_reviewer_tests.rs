use super::{
    ThreadForkParams, ThreadResumeParams, ThreadSettingsUpdateParams, ThreadStartParams,
    TurnStartParams,
};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};

fn check_entry<T: DeserializeOwned + Serialize>(params: Value) {
    for reviewer in [json!("unknown"), json!(true), json!({"mode":"auto_review"})] {
        let mut invalid = params.clone();
        invalid["approvalsReviewer"] = reviewer;
        assert!(
            serde_json::from_value::<T>(invalid).is_err(),
            "{} must reject invalid reviewer before dispatch",
            std::any::type_name::<T>(),
        );
    }

    for reviewer in ["user", "auto_review", "guardian_subagent"] {
        let mut input = params.clone();
        input["approvalsReviewer"] = json!(reviewer);
        let parsed: T = serde_json::from_value(input).expect("supported reviewer");
        let serialized = serde_json::to_value(parsed).expect("serialize reviewer");
        assert_eq!(
            serialized["approvalsReviewer"],
            if reviewer == "user" {
                "user"
            } else {
                "auto_review"
            },
            "{} must only emit canonical reviewer values",
            std::any::type_name::<T>(),
        );
    }

    for reviewer in [None, Some(Value::Null)] {
        let mut input = params.clone();
        if let Some(reviewer) = reviewer {
            input["approvalsReviewer"] = reviewer;
        }
        let parsed: T = serde_json::from_value(input).expect("inherited reviewer");
        let serialized = serde_json::to_value(parsed).expect("serialize inherited reviewer");
        assert!(!serialized
            .as_object()
            .unwrap()
            .contains_key("approvalsReviewer"));
    }
}

#[test]
fn reviewer_is_validated_and_canonicalized_at_every_public_entry() {
    check_entry::<ThreadStartParams>(json!({}));
    check_entry::<ThreadForkParams>(json!({"threadId":"thread-1"}));
    check_entry::<ThreadResumeParams>(json!({"threadId":"thread-1"}));
    check_entry::<ThreadSettingsUpdateParams>(json!({"threadId":"thread-1"}));
    check_entry::<TurnStartParams>(json!({"threadId":"thread-1","input":[]}));
}
