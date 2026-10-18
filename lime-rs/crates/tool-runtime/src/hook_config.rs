//! Shared Hook declarations used by config and plugin component loading.

use crate::turn_snapshot::RuntimeHookEventName;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HooksFile {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub hooks: HookEventsConfig,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
pub struct HookEventsConfig {
    #[serde(rename = "PreToolUse", default)]
    pre_tool_use: Vec<MatcherGroup>,
    #[serde(rename = "PermissionRequest", default)]
    permission_request: Vec<MatcherGroup>,
    #[serde(rename = "PostToolUse", default)]
    post_tool_use: Vec<MatcherGroup>,
    #[serde(rename = "PreCompact", default)]
    pre_compact: Vec<MatcherGroup>,
    #[serde(rename = "PostCompact", default)]
    post_compact: Vec<MatcherGroup>,
    #[serde(rename = "SessionStart", default)]
    session_start: Vec<MatcherGroup>,
    #[serde(rename = "SessionEnd", default)]
    session_end: Vec<MatcherGroup>,
    #[serde(rename = "UserPromptSubmit", default)]
    user_prompt_submit: Vec<MatcherGroup>,
    #[serde(rename = "SubagentStart", default)]
    subagent_start: Vec<MatcherGroup>,
    #[serde(rename = "SubagentStop", default)]
    subagent_stop: Vec<MatcherGroup>,
    #[serde(rename = "Stop", default)]
    stop: Vec<MatcherGroup>,
}

impl HookEventsConfig {
    pub fn is_empty(&self) -> bool {
        self.clone()
            .into_groups()
            .iter()
            .all(|(_, groups)| groups.is_empty())
    }

    pub(crate) fn into_groups(self) -> [(RuntimeHookEventName, Vec<MatcherGroup>); 11] {
        [
            (RuntimeHookEventName::PreToolUse, self.pre_tool_use),
            (
                RuntimeHookEventName::PermissionRequest,
                self.permission_request,
            ),
            (RuntimeHookEventName::PostToolUse, self.post_tool_use),
            (RuntimeHookEventName::PreCompact, self.pre_compact),
            (RuntimeHookEventName::PostCompact, self.post_compact),
            (RuntimeHookEventName::SessionStart, self.session_start),
            (RuntimeHookEventName::SessionEnd, self.session_end),
            (
                RuntimeHookEventName::UserPromptSubmit,
                self.user_prompt_submit,
            ),
            (RuntimeHookEventName::SubagentStart, self.subagent_start),
            (RuntimeHookEventName::SubagentStop, self.subagent_stop),
            (RuntimeHookEventName::Stop, self.stop),
        ]
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct MatcherGroup {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) matcher: Option<String>,
    #[serde(default)]
    pub(crate) hooks: Vec<HookHandlerConfig>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum HookHandlerConfig {
    #[serde(rename = "command")]
    Command {
        command: String,
        #[serde(
            default,
            rename = "commandWindows",
            alias = "command_windows",
            skip_serializing_if = "Option::is_none"
        )]
        command_windows: Option<String>,
        #[serde(
            default,
            rename = "timeout",
            alias = "timeout_sec",
            skip_serializing_if = "Option::is_none"
        )]
        timeout_sec: Option<u64>,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        r#async: bool,
        #[serde(
            default,
            rename = "statusMessage",
            alias = "status_message",
            skip_serializing_if = "Option::is_none"
        )]
        status_message: Option<String>,
        #[serde(
            default,
            rename = "additionalContextLimit",
            alias = "additional_context_limit",
            skip_serializing_if = "Option::is_none"
        )]
        additional_context_limit: Option<usize>,
    },
    #[serde(rename = "prompt")]
    Prompt {},
    #[serde(rename = "agent")]
    Agent {},
}
