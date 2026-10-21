use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Acknowledges scheduling; does not report completion of the background pass.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct RolloutCompressResponse {}
