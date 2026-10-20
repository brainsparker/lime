use std::path::PathBuf;

/// Stop 输入来自当前 sampling step，不能从工具参数或 assistant 文本推断。
#[derive(Debug, Clone)]
pub struct RuntimeStopHookContext {
    pub invocation_id: String,
    pub model: String,
    pub permission_mode: String,
    pub transcript_path: Option<PathBuf>,
    pub stop_hook_active: bool,
    pub last_assistant_message: Option<String>,
    pub target: RuntimeStopHookTarget,
}

#[derive(Debug, Clone)]
pub enum RuntimeStopHookTarget {
    Stop,
    /// Internal memory work uses the Stop event but has a distinct target so
    /// the runtime can terminate on rejection instead of recursively
    /// continuing the consolidation loop.
    MemoryConsolidation,
    /// Synthetic/internal subagents do not dispatch user lifecycle hooks.
    Disabled,
    SubagentStop {
        agent_id: String,
        agent_type: String,
        agent_transcript_path: Option<PathBuf>,
    },
}
