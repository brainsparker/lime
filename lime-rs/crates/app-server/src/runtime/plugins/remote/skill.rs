use super::{wire, Context, RuntimeCore, RuntimeCoreError};
use app_server_protocol::protocol::v2::{PluginSkillReadParams, PluginSkillReadResponse};
use serde::Deserialize;

#[derive(Deserialize)]
struct SkillDetail {
    plugin_id: String,
    name: String,
    skill_md_contents: Option<String>,
}

pub(crate) async fn read(
    runtime: &RuntimeCore,
    params: PluginSkillReadParams,
) -> Result<PluginSkillReadResponse, RuntimeCoreError> {
    wire::Scope::from_marketplace(&params.remote_marketplace_name)?;
    wire::validate_remote_id(&params.remote_plugin_id)?;
    if params.skill_name.is_empty() {
        return Err(RuntimeCoreError::InvalidRequest(
            "skill name must not be empty".into(),
        ));
    }
    let context = Context::current(runtime.account_manager.as_deref())?.ok_or_else(|| {
        RuntimeCoreError::InvalidRequest("authentication required for remote plugin skills".into())
    })?;
    let response: SkillDetail = context
        .get(&format!(
            "{}/skills/{}?includeDownloadUrls=false",
            urlencoding::encode(&params.remote_plugin_id),
            urlencoding::encode(&params.skill_name),
        ))
        .await?;
    if response.plugin_id != params.remote_plugin_id || response.name != params.skill_name {
        return Err(RuntimeCoreError::Backend(
            "remote plugin skill identity does not match request".into(),
        ));
    }
    Ok(PluginSkillReadResponse {
        contents: response.skill_md_contents,
    })
}
