// Adapted from OpenAI Codex protocol/parse_command.rs at
// 4aaee872e31abefe0d32e91faab23b09b6968824 (Apache-2.0).
// License/notice: tool-runtime/src/parse_command/{LICENSE,NOTICE}.

use schemars::JsonSchema;
use serde::Deserialize;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ParsedCommand {
    Read {
        cmd: String,
        name: String,
        /// (Best effort) Path to the file being read by the command. When
        /// possible, this is an absolute path, though when relative, it should
        /// be resolved against the `cwd` that will be used to run the command
        /// to derive the absolute path.
        path: PathBuf,
    },
    ListFiles {
        cmd: String,
        path: Option<String>,
    },
    Search {
        cmd: String,
        query: Option<String>,
        path: Option<String>,
    },
    Unknown {
        cmd: String,
    },
}
