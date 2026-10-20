# Codex Memory consolidation Agent harness 对齐

状态：active；完整对齐目标继续 active。负责人 root，2026-10-20。

## 主目标与来源

延续 [runtime 主计划](./codex-runtime-gap-alignment-plan.md) 与 [HookPrompt receipt 切片](./codex-hook-prompt-receipt-alignment.md)：把 Memory phase-2 从直接文本采样替换为现役共享 Agent runtime 的受限内部会话。Codex 决定 runtime/harness；grok 仅参考多模型 route/readiness，不能定义 Memory 业务语义。

已直接阅读的上游事实：

1. `memories/write/src/phase2.rs:82/161` 建立受限 config 后 spawn consolidation agent。
2. 同文件 `agent::get_config`：ephemeral、关闭 memory generation/use/notify/apps instructions，MCP 空、approval never，关闭 collab/memory tool/apps/plugins/skill dependency install；managed sandbox 仅写 memory root 且禁网，父级显式 Disabled/External policy 按源码保留。
3. `memories/write/src/runtime.rs::spawn_consolidation_agent`：经现役 thread manager 建 thread，typed `SessionSource::Internal(MemoryConsolidation)` 与 `ThreadSource::MemoryConsolidation`，start_turn_if_idle；不是另建 Memory provider loop。
4. `phase2.rs::agent::handle`：等待真实 agent 终态，shutdown 后校验 artifacts，再确认 lease ownership 和 workspace baseline，最后提交 selected-output watermark。shutdown 失败保留 lease，不释放给下一个 worker。
5. Codex `core/src/session/turn.rs` 的 managed Stop block/stop 都拒绝无人值守 Memory 续跑；Lime 已有 typed target 与该错误分支回归，生产 Memory 接线尚未承接。

Lime current：`RuntimeCore::spawn_memory_stage1_startup` 已在 eligible root thread start 自动触发 phase1→phase2。`run_memory_stage2_for_session` 通过现有 backend route admission 选模型，`memory_store/consolidation.rs` 的 `MemoryStageTwoProvider::sample` 最终复用 `sample_memory_stage` → `run_direct_text_generation_with_db`。本轮 bounded search 中 `memory_consolidation` 仅有 session-source 识别，没有 Memory agent spawn 生产接线。strict JSON artifact/lease 不是完整 Agent harness；旧记录中的“provider consolidation”只表示已实现直接抽样，不能标记 M01 完成。

## 分步写集与退出条件

- 第一步只定位 shared internal thread/turn admission、工具 snapshot、sandbox、终态与 shutdown 的 current owner，并补能复现生产 phase-2 未进入 Agent Loop 的回归。已有脏文件逐函数确认归属；不覆盖 request_user_input、GUI 或未知改动。
- 第二步在既有 App Server/agent-runtime owner 接内部 Memory thread/turn；typed source 随启动流入 Stop，不接受用户文本推断 source。ephemeral、不反哺 phase1，不新增公开 Memory RPC、平行 loop、数据库或第二 backend。
- 第三步把 Codex 限制落实到实际 snapshot/工具执行权限；可用本地工具只在 memory root 权限内操作。禁用 MCP/plugin/apps/recursive delegation/skill dependency install，approval never、memory use/generate off；不能仅依赖 prompt 约定。
- 第四步对齐 lease heartbeat、取消、终态、shutdown、artifact validation、ownership recheck 与 watermark 提交顺序；失败不可假成功，也不提前推进 selection。逐项按上游源码验证，不凭文件名推断契约。
- 第五步保留 Lime 当前多模型 route、model switch、capability/readiness、credential/protocol lowering。模型不具备实际所需能力时进入可观测失败/重试，不能退回 direct sampling 冒充 Agent Loop。Codex 的默认模型与 reasoning effort 只作为能力适配输入，不能硬编码为所有 provider 的前提。
- 第六步迁移所有 current consumers，删除 phase-2 的旧 direct-sampling owner/测试正向断言；phase-1 的直接抽取链单独依据 Codex 保留。没有兼容、迁移或双轨。

## Verification Contract

budget:normal；P1。输入为已 claim 的 durable stage1 selection + root session current route；结果为同一共享 runtime 的受限 internal Thread/Turn/Item 与真实终态，验证 artifacts 和 ownership 后才推进 watermark。

先 owner/integration 证明 source/Stop、工具范围、零 MCP/plugin/递归、模型切换、取消与 lease 丢失、shutdown failure、无效 artifact；再公共 JSON-RPC/startup 生命周期和冷重开，补真实 RuntimeBackend 的四协议 loopback capture。JSON-RPC integration、stdio、Electron、CLI/PTY 和 live 各自记账。产品门禁沿现役 fixture/GUI/local gate；不得降低工作台等既有失败断言。

修改前按目标窄写集登记；重大实现同片同步 architecture 并由 root 确认；协议/配置/依赖若改变，同步 schema/消费者/锁文件与 contracts。当前 lease 子步骤已有生产修改，验证结果在下方记录；共享 Agent 的其余退出条件仍未满足，不能用本计划替代实现。

## 2026-10-20 执行写集

先关闭 phase-2 lease 的实际写入窗口，再迁入共享 Agent：认领 `app-server/src/memory_store/{consolidation.rs,state.rs}`、`memory_store.rs`、新增 `memory_store/consolidation/tests.rs`、`runtime_backend/execution_backend.rs` 的 phase-2 cancellation 接线。只读 Codex `phase2.rs`/`runtime.rs`。已有架构文档与主计划脏改动按前轮 root 的写集保留；不修改 `tsconfig.node.tsbuildinfo`。

本步退出条件：heartbeat/commit 需要 leased/running + 当前 ownership token；按 Codex 状态库，过期但尚未被接管的同一 token 允许续租。运行期间 lease 丢失使执行收到取消；执行返回后先确认 ownership，再处理 artifact/归档/Memory 写入；失败不推进 watermark/selection。测试必须真实更换或过期后接管 SQLite lease，并观察源文件和 Memory artifact，没有仅断言 SQL 文本的测试。此步通过不代表已完成共享 Agent harness。

### 已定位的共享 Agent 接入前提

| 合同 | current owner / 事实 | 下一步必须改动 |
| --- | --- | --- |
| 同一 Thread/Turn manager | `runtime/session_lifecycle.rs::start_session`、`turn_execution.rs::start_turn`、`session_shutdown.rs::shutdown_session_runtime` 共用 `RuntimeCore.state`、session registry、backend | consolidation runner 复用这些 owner；不能新建独立 runtime/actor registry |
| 真正 ephemeral | `thread_fork/settings.rs` 明确拒绝未实现的 ephemeral storage；`start_session` 仍写 canonical thread | 不能只加 metadata 标志冒充 ephemeral；须让内部会话的实际 projection/EventLog/rollout 生命周期与 shutdown 成对，且不反哺 phase1 |
| 扩展隔离 | `runtime_backend.rs::handle_turn_start_with_provider_history` 当前读取 plugin snapshots、初始化 MCP、discover orchestrator skills；`request_context/session_config.rs` 合并 AGENTS/Skills/Memory/Soul | typed internal source 必须在读取、发现、prompt、hook 与执行边界都生效；单纯空 snapshot/prompt 禁止词不够 |
| 工具隔离 | `agent/current_provider_turn/mcp_step_snapshot.rs` 每 step 重捕获本地/MCP/dynamic tools；`tool_executor.rs` 承接真实执行 | 限制必须同时约束 snapshot 与执行，避免全局 gateway registry/工具检索重新暴露被禁能力 |
| 仅 memory root 写权限 | `tool-runtime/sandbox/command.rs` 的默认 Seatbelt profile 允许 `/tmp`、`/private/tmp`、`/var/tmp`、`/private/var/tmp` | Codex managed Memory config 排除临时目录；复用现有 sandbox owner 补内部限制，不能把普通 workspace-write 当成已对齐。父级 Disabled/External 的处理仍按 Codex 源码 |
| 真实终态与关闭 | `start_turn` 等 session task 完成；`unload_thread_if_idle` 经同一 close owner 释放资源 | 需证明 Completed/Failed/Cancelled、Stop 拒绝、取消后 drain、shutdown 失败保留 lease，再核销共享 harness；本片取消直接采样不提供该证明 |
| 精确 snapshot selection | Codex `state/runtime/memories.rs::mark_global_phase2_job_succeeded` 使用 `thread_id + source_updated_at`；Lime 当前按 `source_path` 更新 selection | 共享 Agent/产物替换时同时绑定选中 stage1 的版本，避免把采样期间新抽取的同路径 snapshot 误标记为已合并 |

上述是直接源码事实与实施约束，不是已完成能力。REA Desktop timeline 证据只复用其静态 UI 观察范围；不用于证明后端 ownership、关闭顺序或真实产品执行。
