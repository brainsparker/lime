//! Provider-neutral tool output budgets; token limits use Codex's four-byte approximation.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Harness-owned item metadata; never a provider option or model-visible field.
pub const HISTORY_TOKEN_LIMIT_KEY: &str = "history_token_limit";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "mode", content = "limit", rename_all = "snake_case")]
pub enum TruncationPolicy {
    Bytes(usize),
    Tokens(usize),
}

impl Default for TruncationPolicy {
    fn default() -> Self {
        Self::Bytes(10_000)
    }
}

impl TruncationPolicy {
    pub fn token_budget(self) -> usize {
        match self {
            Self::Bytes(limit) => limit.div_ceil(4),
            Self::Tokens(limit) => limit,
        }
    }

    pub fn byte_budget(self) -> usize {
        match self {
            Self::Bytes(limit) => limit,
            Self::Tokens(limit) => limit.saturating_mul(4),
        }
    }

    pub fn with_serialization_allowance(self) -> Self {
        let allowance = |limit: usize| limit.saturating_add(limit.div_ceil(5));
        match self {
            Self::Bytes(limit) => Self::Bytes(allowance(limit)),
            Self::Tokens(limit) => Self::Tokens(allowance(limit)),
        }
    }
}
