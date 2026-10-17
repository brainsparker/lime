use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalsReviewer {
    #[default]
    User,
    #[serde(alias = "guardian_subagent")]
    AutoReview,
}

impl JsonSchema for ApprovalsReviewer {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "ApprovalsReviewer".into()
    }

    fn json_schema(_: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({
            "type": "string",
            "enum": ["user", "auto_review", "guardian_subagent"],
            "description": "Routes approval requests to the user or automatic review. The legacy guardian_subagent input is serialized as auto_review."
        })
    }
}

impl ApprovalsReviewer {
    pub fn parse(value: Option<&Value>) -> Result<Option<Self>, String> {
        value
            .filter(|value| !value.is_null())
            .cloned()
            .map(serde_json::from_value)
            .transpose()
            .map_err(|error| format!("invalid approvalsReviewer: {error}"))
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::AutoReview => "auto_review",
        }
    }
}
