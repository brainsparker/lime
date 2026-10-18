use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::fmt;

/// External LimeCore sessions share the account boundary used by every surface.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LoginAccountParams {
    #[serde(rename = "cloudAuthTokens", rename_all = "camelCase")]
    CloudAuthTokens {
        base_url: String,
        tenant_id: String,
        access_token: String,
    },
}

impl fmt::Debug for LoginAccountParams {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("LoginAccountParams::CloudAuthTokens { [REDACTED] }")
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LoginAccountResponse {
    CloudAuthTokens {},
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Account {
    #[serde(rename_all = "camelCase")]
    Cloud {
        base_url: String,
        tenant_id: String,
        user_id: String,
        session_id: String,
        email: Option<String>,
        display_name: Option<String>,
        expires_at: Option<String>,
    },
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetAccountParams {
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub refresh_token: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetAccountResponse {
    pub account: Option<Account>,
    pub requires_openai_auth: bool,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct LogoutAccountResponse {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccountUpdatedNotification {
    pub auth_mode: Option<String>,
    pub plan_type: Option<String>,
}
