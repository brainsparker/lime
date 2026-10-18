use super::RuntimeCoreError;
use app_server_protocol::protocol::v2::{
    AppTemplateUnavailableReason, PluginAuthPolicy, PluginAvailability, PluginDisabledReason,
    PluginInstallPolicy, PluginInstallPolicySource, PluginShareDiscoverability,
    PluginSharePrincipalRole, PluginSharePrincipalType, ScheduledTaskSchedule,
};
use serde::Deserialize;

#[derive(Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum Scope {
    Global,
    User,
    Workspace,
}

impl Scope {
    pub(crate) fn api_value(self) -> &'static str {
        match self {
            Self::Global => "GLOBAL",
            Self::User => "USER",
            Self::Workspace => "WORKSPACE",
        }
    }

    pub(crate) fn marketplace(self) -> &'static str {
        match self {
            Self::Global => "openai-curated-remote",
            Self::User => "created-by-me-remote",
            Self::Workspace => "workspace-directory",
        }
    }

    pub(crate) fn display_name(self) -> &'static str {
        match self {
            Self::Global => "OpenAI Curated Remote",
            Self::User => "Created by me",
            Self::Workspace => "Workspace Directory",
        }
    }

    pub(crate) fn from_marketplace(name: &str) -> Result<Self, RuntimeCoreError> {
        match name {
            "openai-curated-remote" => Ok(Self::Global),
            "created-by-me-remote" => Ok(Self::User),
            "workspace-directory"
            | "workspace-shared-with-me"
            | "workspace-shared-with-me-private"
            | "workspace-shared-with-me-unlisted" => Ok(Self::Workspace),
            _ => Err(RuntimeCoreError::InvalidRequest(
                "unknown remote plugin marketplace".into(),
            )),
        }
    }
}

#[derive(Deserialize)]
pub(crate) struct Directory {
    pub plugins: Vec<Item>,
    pub pagination: Pagination,
}

#[derive(Deserialize)]
pub(crate) struct Pagination {
    pub next_page_token: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct Item {
    pub id: String,
    pub name: String,
    pub scope: Scope,
    pub discoverability: PluginShareDiscoverability,
    pub creator_account_user_id: Option<String>,
    pub creator_name: Option<String>,
    pub share_url: Option<String>,
    pub share_principals: Option<Vec<SharePrincipal>>,
    pub can_publish_to_workspace: Option<bool>,
    pub installation_policy: PluginInstallPolicy,
    pub installation_policy_source: Option<PluginInstallPolicySource>,
    pub authentication_policy: PluginAuthPolicy,
    pub status: PluginAvailability,
    pub disabled_reason: Option<PluginDisabledReason>,
    pub release: Release,
}

impl Item {
    pub(crate) fn marketplace(&self) -> &'static str {
        if self.scope == Scope::Workspace
            && self.discoverability != PluginShareDiscoverability::Listed
        {
            "workspace-shared-with-me"
        } else {
            self.scope.marketplace()
        }
    }

    pub(crate) fn validate(&self, expected: Option<Scope>) -> Result<(), RuntimeCoreError> {
        let valid_name = !self.name.is_empty()
            && !self.name.starts_with('.')
            && !self.name.ends_with('.')
            && !self.name.contains("..")
            && self
                .name
                .bytes()
                .all(|ch| ch.is_ascii_alphanumeric() || b"-_.".contains(&ch));
        if validate_remote_id(&self.id).is_err()
            || !valid_name
            || expected.is_some_and(|scope| scope != self.scope)
        {
            return Err(RuntimeCoreError::Backend(
                "invalid remote plugin directory identity".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Deserialize)]
pub(crate) struct SharePrincipal {
    pub principal_type: PluginSharePrincipalType,
    pub principal_id: String,
    pub role: PluginSharePrincipalRole,
    pub name: String,
}

pub(crate) fn validate_remote_id(id: &str) -> Result<(), RuntimeCoreError> {
    if id.is_empty()
        || !id
            .bytes()
            .all(|ch| ch.is_ascii_alphanumeric() || b"_-~".contains(&ch))
    {
        return Err(RuntimeCoreError::InvalidRequest(
            "invalid remote plugin id".into(),
        ));
    }
    Ok(())
}

#[derive(Deserialize)]
pub(crate) struct Release {
    pub version: Option<String>,
    pub bundle_download_url: Option<String>,
    pub display_name: String,
    pub description: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    pub interface: Interface,
    #[serde(default)]
    pub app_ids: Vec<String>,
    pub app_manifest: Option<serde_json::Value>,
    #[serde(default, alias = "unavailable_app_templates")]
    pub app_templates: Vec<AppTemplate>,
    #[serde(default)]
    pub skills: Vec<Skill>,
    pub onboarding_skill_name: Option<String>,
    #[serde(default)]
    pub mcp_servers: Vec<McpServer>,
    pub scheduled_tasks: Option<Vec<Task>>,
}

#[derive(Deserialize)]
pub(crate) struct Interface {
    pub short_description: Option<String>,
    pub long_description: Option<String>,
    pub developer_name: Option<String>,
    pub category: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub website_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
    pub brand_color: Option<String>,
    pub default_prompt: Option<String>,
    pub default_prompts: Option<Vec<String>>,
    pub composer_icon_url: Option<String>,
    pub logo_url: Option<String>,
    pub logo_url_dark: Option<String>,
    #[serde(default)]
    pub screenshot_urls: Vec<String>,
}

#[derive(Deserialize)]
pub(crate) struct Skill {
    pub name: String,
    pub description: String,
    pub interface: Option<SkillInterface>,
}

#[derive(Deserialize)]
pub(crate) struct SkillInterface {
    pub display_name: Option<String>,
    pub short_description: Option<String>,
    pub brand_color: Option<String>,
    pub default_prompt: Option<String>,
    pub icon_small_url: Option<String>,
    pub icon_large_url: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct McpServer {
    pub key: String,
}

#[derive(Deserialize)]
pub(crate) struct AppTemplate {
    pub template_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub canonical_connector_id: Option<String>,
    pub logo_url: Option<String>,
    pub logo_url_dark: Option<String>,
    #[serde(default)]
    pub materialized_app_ids: Vec<String>,
    pub reason: Option<AppTemplateUnavailableReason>,
}

#[derive(Deserialize)]
pub(crate) struct Task {
    pub key: String,
    pub name: String,
    pub prompt: String,
    pub schedule: ScheduledTaskSchedule,
}
