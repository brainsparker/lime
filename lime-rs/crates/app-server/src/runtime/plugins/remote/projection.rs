use crate::plugin_remote::wire::{Item, Scope};
use app_server_protocol::protocol::v2::{
    AppSummary, AppTemplateSummary, PluginDetail, PluginInterface, PluginShareContext,
    PluginSharePrincipal, PluginSource, PluginSummary, ScheduledTaskSummary, SkillInterface,
    SkillSummary,
};

impl Item {
    pub(super) fn summary_with_installation(
        &self,
        installed: Option<&crate::plugin_remote::Installed>,
    ) -> PluginSummary {
        let mut summary = self.summary();
        if let Some(installed) = installed {
            summary.installed = true;
            summary.installed_at = installed.installed_at.map(|time| time.timestamp());
            summary.enabled = installed.enabled;
            summary.local_version = installed.plugin.release.version.clone();
        }
        summary
    }

    pub(crate) fn summary(&self) -> PluginSummary {
        let interface = &self.release.interface;
        let mut prompts = interface
            .default_prompts
            .iter()
            .flatten()
            .filter_map(|prompt| normalized_prompt(prompt))
            .take(3)
            .collect::<Vec<_>>();
        if prompts.is_empty() {
            prompts.extend(
                interface
                    .default_prompt
                    .as_deref()
                    .and_then(normalized_prompt),
            );
        }
        PluginSummary {
            id: format!("{}@{}", self.name, self.marketplace()),
            remote_plugin_id: Some(self.id.clone()),
            version: self.release.version.clone(),
            local_version: None,
            name: self.name.clone(),
            share_context: (self.scope == Scope::Workspace).then(|| PluginShareContext {
                remote_plugin_id: self.id.clone(),
                remote_version: self.release.version.clone(),
                discoverability: Some(self.discoverability),
                share_url: self.share_url.clone(),
                creator_account_user_id: self.creator_account_user_id.clone(),
                creator_name: self.creator_name.clone(),
                share_principals: self.share_principals.as_ref().map(|principals| {
                    principals
                        .iter()
                        .map(|principal| PluginSharePrincipal {
                            principal_type: principal.principal_type,
                            principal_id: principal.principal_id.clone(),
                            role: principal.role,
                            name: principal.name.clone(),
                        })
                        .collect()
                }),
                can_publish_to_workspace: self.can_publish_to_workspace,
            }),
            source: PluginSource::Remote,
            // Directory visibility is not an installation or enablement fact.
            installed: false,
            installed_at: None,
            enabled: false,
            install_policy: self.installation_policy,
            install_policy_source: self.installation_policy_source,
            must_show_installation_interstitial: None,
            auth_policy: self.authentication_policy,
            availability: self.status,
            disabled_reason: self.disabled_reason,
            eligible_plan_types: None,
            interface: Some(PluginInterface {
                display_name: non_empty(&self.release.display_name),
                short_description: interface.short_description.clone(),
                long_description: interface.long_description.clone(),
                developer_name: interface.developer_name.clone(),
                category: interface.category.clone(),
                capabilities: interface.capabilities.clone(),
                website_url: interface.website_url.clone(),
                privacy_policy_url: interface.privacy_policy_url.clone(),
                terms_of_service_url: interface.terms_of_service_url.clone(),
                default_prompt: (!prompts.is_empty()).then_some(prompts),
                brand_color: interface.brand_color.clone(),
                composer_icon: None,
                composer_icon_url: interface.composer_icon_url.clone(),
                logo: None,
                logo_dark: None,
                logo_url: interface.logo_url.clone(),
                logo_url_dark: interface.logo_url_dark.clone(),
                screenshots: Vec::new(),
                screenshot_urls: interface.screenshot_urls.clone(),
            }),
            keywords: self.release.keywords.clone(),
        }
    }

    pub(super) fn detail(
        self,
        apps: Vec<AppSummary>,
        disabled_skills: Option<&std::collections::BTreeSet<String>>,
    ) -> PluginDetail {
        let summary = self.summary();
        let marketplace_name = self.marketplace().to_string();
        let skills = self
            .release
            .skills
            .into_iter()
            .map(|skill| {
                let interface = skill.interface.map(|interface| SkillInterface {
                    display_name: interface.display_name,
                    short_description: interface.short_description,
                    icon_small: None,
                    icon_large: None,
                    icon_small_url: interface.icon_small_url,
                    icon_large_url: interface.icon_large_url,
                    brand_color: interface.brand_color,
                    default_prompt: interface.default_prompt,
                });
                SkillSummary {
                    enabled: !disabled_skills
                        .is_some_and(|disabled| disabled.contains(&skill.name)),
                    name: skill.name,
                    description: skill.description,
                    short_description: interface
                        .as_ref()
                        .and_then(|interface| interface.short_description.clone()),
                    interface,
                    path: None,
                }
            })
            .collect::<Vec<_>>();
        PluginDetail {
            marketplace_name,
            marketplace_path: None,
            summary,
            share_url: self.share_url,
            description: non_empty(&self.release.description),
            skills,
            onboarding_skill: None,
            hooks: Vec::new(),
            apps,
            app_templates: self
                .release
                .app_templates
                .into_iter()
                .map(|template| AppTemplateSummary {
                    template_id: template.template_id,
                    name: template.name,
                    description: template.description,
                    category: template.category,
                    canonical_connector_id: template.canonical_connector_id,
                    logo_url: template.logo_url,
                    logo_url_dark: template.logo_url_dark,
                    materialized_app_ids: template.materialized_app_ids,
                    reason: template.reason,
                })
                .collect(),
            mcp_servers: self
                .release
                .mcp_servers
                .into_iter()
                .map(|server| server.key)
                .collect(),
            scheduled_tasks: self.release.scheduled_tasks.map(|tasks| {
                tasks
                    .into_iter()
                    .map(|task| ScheduledTaskSummary {
                        key: task.key,
                        name: task.name,
                        prompt: task.prompt,
                        schedule: task.schedule,
                    })
                    .collect()
            }),
        }
    }
}

fn non_empty(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_string())
}

fn normalized_prompt(value: &str) -> Option<String> {
    non_empty(value).filter(|prompt| prompt.chars().count() <= 128)
}
