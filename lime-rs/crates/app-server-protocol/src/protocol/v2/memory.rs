use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// 查询后台记忆 consolidation 是否已经达到可选用的门槛。
///
/// 该接口只暴露 readiness 合同，不暴露记忆数据库或文件布局。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatusParams {
    /// 所需的不同已 consolidation thread 数量。默认 20，支持 1..=4096。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_consolidated_threads: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatusResponse {
    pub v2_consolidated_threads: u32,
    pub v2_ready: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MemoryResetResponse {}
