//! Command facts in the public v2 item contract.

use agent_protocol::parse_command::ParsedCommand;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum CommandAction {
    Read {
        command: String,
        name: String,
        path: String,
    },
    ListFiles {
        command: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        path: Option<String>,
    },
    Search {
        command: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        query: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        path: Option<String>,
    },
    Unknown {
        command: String,
    },
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum CommandExecutionSource {
    #[default]
    Agent,
    UserShell,
    UnifiedExecStartup,
    UnifiedExecInteraction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum CommandExecutionStatus {
    InProgress,
    Completed,
    Failed,
    Declined,
}

impl CommandAction {
    /// Resolve file reads against the canonical item's working directory.
    pub fn from_core_with_cwd(value: ParsedCommand, cwd: &Path) -> Self {
        match value {
            ParsedCommand::Read { cmd, name, path } => Self::Read {
                command: cmd,
                name,
                path: resolve_read_path(cwd, &path).to_string_lossy().into_owned(),
            },
            ParsedCommand::ListFiles { cmd, path } => Self::ListFiles { command: cmd, path },
            ParsedCommand::Search { cmd, query, path } => Self::Search {
                command: cmd,
                query,
                path,
            },
            ParsedCommand::Unknown { cmd } => Self::Unknown { command: cmd },
        }
    }
}

// Normalize lexically: display projection must neither access the filesystem nor use process cwd.
fn resolve_read_path(cwd: &Path, path: &Path) -> PathBuf {
    let joined = cwd.join(path);
    let mut resolved = PathBuf::new();
    for component in joined.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir if resolved.file_name().is_some_and(|name| name != "..") => {
                resolved.pop();
            }
            Component::ParentDir if resolved.has_root() => {}
            component => resolved.push(component.as_os_str()),
        }
    }
    resolved
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_paths_resolve_cd_parent_segments_without_touching_the_filesystem() {
        for (cwd, path, expected) in [
            (
                "/workspace/project",
                "../docs/./guide.md",
                "/workspace/docs/guide.md",
            ),
            ("/workspace", "../../guide.md", "/guide.md"),
            ("/workspace", "/other/guide.md", "/other/guide.md"),
            ("", "../docs/guide.md", "../docs/guide.md"),
        ] {
            let action = CommandAction::from_core_with_cwd(
                ParsedCommand::Read {
                    cmd: "cat guide.md".to_owned(),
                    name: "guide.md".to_owned(),
                    path: PathBuf::from(path),
                },
                Path::new(cwd),
            );
            let CommandAction::Read { path, .. } = action else {
                panic!("read action");
            };
            assert_eq!(PathBuf::from(path), PathBuf::from(expected));
        }
    }
}
