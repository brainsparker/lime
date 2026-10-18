use super::{
    AbsolutePathBuf, PluginShareDiscoverability, PluginSharePrincipal, PluginSharePrincipalType,
    PluginSummary,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareTarget {
    pub principal_type: PluginSharePrincipalType,
    pub principal_id: String,
    pub role: PluginShareTargetRole,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum PluginShareTargetRole {
    Reader,
    Editor,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareSaveParams {
    pub plugin_path: AbsolutePathBuf,
    pub remote_plugin_id: Option<String>,
    pub discoverability: Option<PluginShareDiscoverability>,
    pub share_targets: Option<Vec<PluginShareTarget>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareSaveResponse {
    pub remote_plugin_id: String,
    pub share_url: String,
    #[serde(default)]
    pub can_publish_to_workspace: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareUpdateTargetsParams {
    pub remote_plugin_id: String,
    pub discoverability: PluginShareUpdateDiscoverability,
    pub share_targets: Vec<PluginShareTarget>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareUpdateTargetsResponse {
    pub principals: Vec<PluginSharePrincipal>,
    pub discoverability: PluginShareDiscoverability,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq, JsonSchema)]
pub struct PluginShareListParams {}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
pub struct PluginShareListResponse {
    pub data: Vec<PluginShareListItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareDeleteParams {
    pub remote_plugin_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq, JsonSchema)]
pub struct PluginShareDeleteResponse {}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareCheckoutParams {
    pub remote_plugin_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareCheckoutResponse {
    pub remote_plugin_id: String,
    pub plugin_id: String,
    pub plugin_name: String,
    pub plugin_path: AbsolutePathBuf,
    pub marketplace_name: String,
    pub marketplace_path: AbsolutePathBuf,
    pub remote_version: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareListItem {
    pub plugin: PluginSummary,
    pub local_plugin_path: Option<AbsolutePathBuf>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, JsonSchema)]
pub enum PluginShareUpdateDiscoverability {
    #[serde(rename = "UNLISTED")]
    Unlisted,
    #[serde(rename = "PRIVATE")]
    Private,
    #[serde(rename = "LISTED")]
    Listed,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::v2::{ClientRequest, Method};
    use serde_json::json;

    #[test]
    fn share_protocol_roundtrips_all_five_methods_and_rejects_owner_targets() {
        for (method, params) in [
            (
                Method::PluginShareSave,
                json!({"pluginPath":std::env::current_dir().unwrap(),"discoverability":"PRIVATE"}),
            ),
            (Method::PluginShareList, json!({})),
            (
                Method::PluginShareUpdateTargets,
                json!({"remotePluginId":"opaque~1","discoverability":"UNLISTED","shareTargets":[{"principalType":"workspace","principalId":"tenant","role":"reader"}]}),
            ),
            (
                Method::PluginShareDelete,
                json!({"remotePluginId":"opaque~1"}),
            ),
            (
                Method::PluginShareCheckout,
                json!({"remotePluginId":"opaque~1"}),
            ),
        ] {
            let request: ClientRequest =
                serde_json::from_value(json!({"id":1,"method":method.as_str(),"params":params}))
                    .unwrap();
            assert_eq!(request.method(), method);
            let encoded = serde_json::to_value(&request).unwrap();
            assert_eq!(encoded["method"], method.as_str());
            assert_eq!(
                serde_json::from_value::<ClientRequest>(encoded)
                    .unwrap()
                    .method(),
                method
            );
        }
        assert!(serde_json::from_value::<PluginShareTarget>(
            json!({"principalType":"user","principalId":"one","role":"owner"})
        )
        .is_err());
        assert!(
            serde_json::from_value::<PluginShareSaveParams>(json!({"pluginPath":"relative"}))
                .is_err()
        );
    }
}
