# Codex Memory consolidation Agent harness 对齐

状态：active；完整对齐目标继续 active。负责人 root，2026-10-20。

当前进度（续接汇总）：

- 已验收：精确 snapshot / extraction ownership **39/39**；共享 ephemeral 核心合同 **4/4（100%，仅此前提）**；真实 stdio provider/model/key 切换保留工具历史。
- 沙箱执行前提已验证：完整 typed `SandboxPolicy` -> 现有 OS runner，执行合同 **4/4**；client **139/139**、protocol **145/145**、command_exec **16/16**、sandbox **13/13**、进程回归 **52/52**、真实 stdio/PTY **2/2** 与 contracts 通过。新产物共享 runtime 回归和 GUI smoke **24/24** 通过；完整默认门禁仍未通过。
- 已修复门禁问题：Windows evidence CLI 的纯参数入口提前加载 Playwright，改为实际 CDP 连接前加载；原断言/超时下相关 **39/39** 通过。
- 默认门禁：历史续跑停在第 46/142 批 PPTX Worker 失败，Node25 定向仍有原 5000ms 超时；完整门禁未通过，不扩大修改无关 PPTX owner。
- 当前实施：同一 RuntimeCore 的可信 typed Memory admission、snapshot/executor 隔离、原生 patch OS helper、workspace artifact/baseline 与关闭后精确提交已写入生产代码；phase-2 direct sampling/proposal 已删除。最新生产源码与新增回归正在编译验证，尚未验收；M01 继续 active。

## 主目标与来源

延续 [runtime 主计划](./codex-runtime-gap-alignment-plan.md) 与 [HookPrompt receipt 切片](./codex-hook-prompt-receipt-alignment.md)：把 Memory phase-2 从直接文本采样替换为现役共享 Agent runtime 的受限内部会话。Codex 决定 runtime/harness；grok 仅参考多模型 route/readiness，不能定义 Memory 业务语义。

已直接阅读的上游事实：

1. `memories/write/src/phase2.rs:82/161` 建立受限 config 后 spawn consolidation agent。
2. 同文件 `agent::get_config`：ephemeral、关闭 memory generation/use/notify/apps instructions，MCP 空、approval never，关闭 collab/memory tool/apps/plugins/skill dependency install；managed sandbox 仅写 memory root 且禁网，父级显式 Disabled/External policy 按源码保留。
3. `memories/write/src/runtime.rs::spawn_consolidation_agent`：经现役 thread manager 建 thread，typed `SessionSource::Internal(MemoryConsolidation)` 与 `ThreadSource::MemoryConsolidation`，start_turn_if_idle；不是另建 Memory provider loop。
4. `phase2.rs::agent::handle`：等待真实 agent 终态，shutdown 后校验 artifacts，再确认 lease ownership 和 workspace baseline，最后提交 selected-output watermark。shutdown 失败保留 lease，不释放给下一个 worker。
5. Codex `core/src/session/turn.rs` 的 managed Stop block/stop 都拒绝无人值守 Memory 续跑；Lime 已有 typed target 与该错误分支回归，现已接入内部 Memory admission，真实全链仍待验收。

Lime current：`RuntimeCore::spawn_memory_stage1_startup` 在 eligible root thread start 自动触发 phase1→phase2。phase1 保留 structured extraction，phase2 的 `MemoryAgent` 由同一 RuntimeCore 实现，经内部 session、原 session actor、正常 RuntimeBackend 和工具 continuation 执行。可信 policy 不接受 wire/metadata 自授权；旧 `MemoryStageTwoProvider` 与 proposal parser 已删除。旧记录中的“provider consolidation”仅表示当时的直接抽样；本轮实现必须取得新产物与新源码的证据后才能验收。

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

| 合同                     | current owner / 事实                                                                                                                                                                                  | 下一步必须改动                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同一 Thread/Turn manager | `runtime/session_lifecycle.rs::start_session`、`turn_execution.rs::start_turn`、`session_shutdown.rs::shutdown_session_runtime` 共用 `RuntimeCore.state`、session registry、backend                   | consolidation runner 复用这些 owner；不能新建独立 runtime/actor registry                                                                                                                                              |
| 真正 ephemeral | `RuntimeCore.state` 与原 session actor 共用会话级 storage policy；loaded metadata、多轮内存历史和关闭后冷恢复拒绝已取得共享 ephemeral 前提证据 | Memory 内部 admission 需可信地设置 ephemeral、memory use/generate off，并直接接入原 manager；不能用 metadata 自授权限或引入第二 registry |
| 扩展隔离                 | `runtime_backend.rs::handle_turn_start_with_provider_history` 当前读取 plugin snapshots、初始化 MCP、discover orchestrator skills；`request_context/session_config.rs` 合并 AGENTS/Skills/Memory/Soul | typed internal source 必须在读取、发现、prompt、hook 与执行边界都生效；单纯空 snapshot/prompt 禁止词不够                                                                                                              |
| 工具隔离                 | `agent/current_provider_turn/mcp_step_snapshot.rs` 每 step 重捕获本地/MCP/dynamic tools；`tool_executor.rs` 承接真实执行                                                                              | 限制必须同时约束 snapshot 与执行，避免全局 gateway registry/工具检索重新暴露被禁能力                                                                                                                                  |
| 仅 memory root 写权限 | 完整 typed `SandboxPolicy` 已传到现有 OS runner；删除无条件 `/var/tmp` 和 read-only 临时写权限；实际 OS/stdio 验证中 | Memory runner 必须同时把 cwd/workspace_roots 限为 Memory root，并排除 TMPDIR 与 `/tmp`；父级 Disabled/External 按 Codex 原样保留。完整 policy 前提不等于 Memory 已接线 |
| 真实终态与关闭           | `start_turn` 等 session task 完成；`unload_thread_if_idle` 经同一 close owner 释放资源                                                                                                                | 需证明 Completed/Failed/Cancelled、Stop 拒绝、取消后 drain、shutdown 失败保留 lease，再核销共享 harness；本片取消直接采样不提供该证明                                                                                 |
| 精确 snapshot selection | Codex `state/runtime/memories.rs::mark_global_phase2_job_succeeded` 使用 `thread_id + source_updated_at`；Lime `scope_key + source_path + source_updated_at + content_hash` 的定向 **39/39** 已通过 | 共享 Agent 继续携带实际选中版本；不能降回按路径提交。来源文件检查仍不提供跨数据库/文件系统的原子事务 |

表内已完成的前提单独验收；其余为直接源码事实与实施约束，不能核销完整 Memory Agent。REA Desktop timeline 证据只复用其静态 UI 观察范围；不用于证明后端 ownership、关闭顺序或真实产品执行。

### 续接：精确快照提交

当前窄写集：`memory_store/state.rs`、其独立测试模块、`memory_store/consolidation.rs` 与同目录测试；本计划和验证账本。Codex `state/src/runtime/memories.rs::mark_global_phase2_job_succeeded` 的选中更新需要 `thread_id + source_updated_at`；Lime 对应来源身份为 `scope_key + source_path`，并携带来源更新时间和内容摘要。替换按路径提交，保证等待 Agent 时同路径产生的新快照不被旧执行标为 consolidated，review 决策也不能覆盖新版。无公开协议、schema、配置或依赖变更。该并发正确性子步骤不能核销共享 Agent harness。

本轮 `verify:local` 已在 typecheck 后进入前端批次，确认另一独立 local-ci 同时写共享 Vitest resume 状态，停止本轮持有的 PID 58261 及其子进程。实际 exit 143，未执行完默认门禁；version/i18n/lint/typecheck 通过，前端前三批共 21 项通过，第四批中断。保留其他进程；不得把该结果写成通过，后续只复用其独立生成的终态证据。

实际实现：phase-2 candidate 带来源版本，事务内按精确版本推进 selection；review 不覆盖更新的提取结果。同版本 register 是 no-op，保留已有提取/选中标记/运行 lease；新版本清除旧提取产物与选中标记。旧模型 proposal 在文件归档前验证实际选中版本和文件摘要，发现更新则拒绝整份 proposal。删除已无生产调用的按路径 `mark_rollout_processed`、`RolloutStatus` 及其旧正向测试；状态测试迁入 `memory_store/state/tests.rs`，降低生产模块大小。没有引入 compat/deprecated 包装。

该步骤对齐的是 snapshot selection 合同，不表示当前 note→archive artifact 机制已等同 Codex Memory workspace，也不承诺 SQLite 与文件系统之间的并发原子性。仍须在共享 Agent 片删除 phase-2 direct sampling 和旧 artifact proposal 接口。

顺链核对发现 phase-1 实际所有任务共用固定 `memory-stage1` owner，且在返回后才读取来源 mtime。追加窄写集：`memory_store.rs` 的 phase-1 方法迁入新 `memory_store/extraction.rs`、上述状态 owner 与定向测试。直接对照 Codex `try_claim_stage1_job` 的独立 `ownership_token` 与更新输入版本后重新允许 retry 的条件，改为每次 claim 独立 token，提交绑定采样开始时的来源版本；旧提取者的 heartbeat、空输出、失败和成功不得覆盖新 token。该追加修复是精确快照成立的生产前提，仍不代替 phase-2 Agent harness。

### 本轮验证边界

- 第一轮快照回归 **37/37** 通过，原始结果保留 `memory-snapshot-initial-tests.log`；之后删除旧按路径处理入口并追加 phase-1 独立 token 修复，最终源码必须重新验证，不能用此结果覆盖后续变更。
- `verify:gui-smoke` 真实 Electron 壳、preload/IPC、App Server JSON-RPC、reload、Memory 设置入口与三尺寸布局 **24/24** 通过。Main 和 npm 已退出，但 NetworkService utility 孤立后持有日志管道，导致 tee 不结束；通过测试专属 user-data 目录和 pipe identity 确认 PID 35961，仅对该 helper 发 SIGTERM 后命令 exit 0。原始 summary 保留，不改断言或 timeout；记为 **business pass / teardown residue**，不记 clean lifecycle pass，也不证明 Memory provider turn。
- 较早两次 unknown-item current fixture 仍是业务断言通过、Main 正常退出超时，聚合后续场景未执行。不能用上述 shell smoke 消除此失败。
- 同时存在独立 local-ci，已停止本轮持有的默认门禁，完整 `verify:local` 不通过/未完成；不用并行测试状态冒充本轮覆盖。

源码摘要、直接 Codex 引用和 Lime 来源身份适配边界见 `snapshot-source-freeze.json`。Lime 现阶段来源仍是 filesystem `scope_key + source_path`，以 source_updated_at 和 content_hash 限定版本；完整 Codex Thread 来源生命周期、workspace baseline 和共享 Agent 都继续开放。窄切片四项退出条件是精确选中提交、来源登记与 retry、独立提取 ownership、旧入口清理；最终定向验证终态收齐后才核销。

下一刀的存储拦截点必须覆盖 `event_store::append_runtime_events_to_stored_session` 与 `RuntimeCoreEventAppender`：它们还会被 command publisher、cancel/shutdown 和外部事件入口调用。不能仅在 Memory 的 start-turn 调用处关闭 writer，或克隆一个移除 projection store 的 Core 视图，就宣称会话无持久化；原 Core 的关闭入口仍可能写入。此为沿当前调用链的源码限制，尚未实现或取得 ephemeral 运行证据。

### 续接：共享 ephemeral 生命周期

前一步最终定向测试已经结束，`memory-snapshot-final-tests.log` 为 **39/39 通过**；仅核销精确快照子步骤。

本轮 root 认领 `runtime.rs`、`runtime/{session_lifecycle,event_store,load_context,thread_read,canonical_thread_store,turn_execution}.rs` 中 ephemeral 补丁点、其相关子模块和独立回归，以及本计划、architecture 和验证账本。避让前端、Electron fixture、model-provider 和 async-user-input 计划中的并行改动；不格式化整个 workspace。

Codex `app-server/src/request_processors/thread_processor.rs::load_live_thread_view` 在 loaded ephemeral 上允许 metadata read，拒绝 includeTurns；`thread_turns_list_history_items` 拒绝 ephemeral 历史分页；loaded/list 读取实际 thread manager。Lime 复用原 RuntimeCore state 和 canonical metadata builder，不创建第二存储或降级 backend。退出条件是 public thread/start/read 可用、turn 仍经过共享 runtime、事件/trace/sidecar/checkpoint/output/history 均不落盘、关闭后无法恢复。该前提通过后才继续接受限 Memory Agent，不能以 ephemeral 单项宣称 phase-2 已替换。

沿真实调用追加的同一写集：`runtime/input_media.rs`、`provider_history.rs`、`thread_queue.rs`、`projection_store/session_settings.rs`、`canonical_thread_store/event_batch.rs`、`turn_execution/{input_commit,model_history,persistence}.rs`、独立测试及 `tests/tool_history_receipt_jsonrpc.rs`；`agent-runtime/src/model_history.rs` 只区分真实内存回执与 durable 回执。start、steer、queue 和后续历史恢复共同使用会话级媒体策略，防止首轮不写、第二轮重建 provider history 时又写 sidecar。model switch 仍走原 session metadata actor + provider preflight，只在唯一 metadata store owner 跳过 ephemeral 的持久提交。没有新增 RPC、schema、配置或依赖。

最终 IO 复核补到 `context_compaction.rs` 与 `memory_prompt.rs`：同回合自动 compact 的 artifact 和 Memory summary prompt sidecar 在事件提交之前写入，不能靠 central event guard 阻止。这两个现役 owner 已按真实 session 标记保留内存上下文而跳过 sidecar，补对应回归。独立生命周期测试位于 `runtime/ephemeral/tests/mod.rs`，不新增治理白名单。

`turn_execution.rs` 已超过 1000 行，本轮只替换接线；CodeCell trace 的独立持久化判定迁入 `turn_execution/persistence.rs`，不继续在主文件堆叠业务。退出条件是本轮 diff 净减主文件逻辑，后续 Memory runner 放独立模块。直接 phase-2 sampling 尚未删除，工具/扩展/sandbox 隔离尚未接入；全目标继续 active。

### ephemeral 验证续接

- 最终源码冻结 `ephemeral-source-freeze.json`：23 个 Lime 源码/测试文件及 4 个 Codex 来源；续接时逐项校验 SHA256，无漂移。构建期间保持该写集不变。
- 公共 App Server JSON-RPC 集成 **2/2 通过**（`ephemeral-jsonrpc-tests.log`，exit 0）：普通会话的 durable history receipt 与冷恢复；ephemeral 的公共 start/read、loaded list、多轮执行、模型切换、内存历史、历史分页拒绝和冷恢复失败。使用 external test backend，不是 live provider、stdio 或 Electron 执行证据。
- `test:contracts` 与最终治理扫描均 exit 0；后者违规 0。源码、执行计划与架构文档的 diff 格式检查通过。
- current fixture 的定向 history/cache、streaming/terminal、UI 与 fixture guards 合计 **369 项通过**。Electron 前等待构建锁时发现另一活跃 owner 接近 helper 的 stale 阈值，主动终止本轮已核实持有的等待进程，聚合 exit 143；没有动对方锁或进程。不能记为完整聚合通过。
- 锁已释放，最终源码后的 `verify:gui-smoke` 正在标准 renderer→host→App Server assets 构建链。仅在构建真实完成后复用该产物续跑 Electron 子场景，不能用 build-ready 标记绕过未完成构建。
- RuntimeCore 与 agent-runtime 定向回归、默认本地门禁仍待终态；此前已通过的单项不重复执行。当前只核销已有通过证据，ephemeral 存储前提仍为 validating，phase-2 共享 Agent 为未实施。

默认本地门禁随后 **exit 1**：version、i18n、lint、changed-copy、typecheck 通过；resume 在第 9/141 批 `index.noVideo.test.tsx` 的唯一测试超过既有 5000ms 超时，未取得完整前端结果。检查时主机 load 超过 130，Rust 编译与其他任务仍运行；资源争用只是待隔离复核的假设，不能直接认定环境噪声。保留原日志与 `ephemeral-host-load.log`，不改测试超时或断言，待构建压力下降后单独复核再 resume。追加的 stdio 验证按质量矩阵补 app-server-client 定向回归，沿用原 Cargo 队列，不启动第二套构建目录。

原样单独复跑的前端失败用例 **1/1 通过**（测试耗时 1.66s），随后单独启动 `test:resume` 续跑；不抹去首次门禁失败。续接期间另一进程修改 `runtime/input_media.rs` 的 inline 测试，使其先创建有效本地 PNG，再断言缺少 sidecar；生产逻辑无变化，本轮保持该文件只读并保留修改。旧源码冻结与差异分别保留为 `ephemeral-source-freeze.json` / `ephemeral-source-drift.json`，已启动的旧编译不算覆盖该夹具修正，最终必须补验证。

### phase-2 接线顺序（直接源码复核）

ephemeral 进程验证追加窄写集：`scripts/app-server/ephemeral-fixture.mjs`、`scripts/README.md` 和本计划/账本。复用现有 stdio client、provider provisioning 与 loopback server，不新增测试 transport 或第二 runtime。固定最终 sidecar 后验证实际工具 continuation、多轮 provider history、正常 EOF 关闭，以及隔离 data/app 文件中不存在合成的 thread/turn/input/tool/output marker；普通线程作为 durable 对照。此为真实 stdio + RuntimeBackend + loopback provider 证据，不是 live、多协议全矩阵、GUI 或 CLI/PTY。

Codex `memories/write/src/runtime.rs::spawn_consolidation_agent` 在同一 ThreadManager 以 typed `Internal(MemoryConsolidation)` / `ThreadSource::MemoryConsolidation` 建线程，`start_turn_if_idle` 接受输入；关闭经 `shutdown_and_wait`，10 秒超时成功后才 remove。`phase2.rs::agent::get_config` 对 managed permission 使用 memory-root-only workspace-write，排除 TMPDIR 与 slash-tmp；显式 Disabled/External 父级选择保留。`agent::handle` 的顺序是终态→关闭→artifact 校验→ownership heartbeat→workspace baseline→精确 selection/watermark；关闭失败保留 lease 到过期。

Lime 下一实现从 `runtime/memory.rs` 发起共享内部会话，限制必须逐层传到 `runtime_backend.rs` 的扩展发现/配置、provider-step snapshot 和真实工具 executor。当前 metadata 中的 `memory_consolidation` 识别仅影响 Stop target，不能当成可信 admission 或隔离能力；公共 metadata 不能授权内部工具策略。下一片需以内部 typed admission 传递限制，不增加公开 RPC 或第二 registry。多模型仍走原 `resolve_turn_route` 和 model-provider；phase-1 独立采样保留，phase-2 的 `MemoryStageTwoProvider::sample`、JSON proposal 与旧正向测试随真实接线一并删除。

### 续接：真实 stdio 存储验收

追加窄写集 `scripts/run-rust-layer.mjs` 与现有 unit test：修复 buffered stdout/stderr 在 `process.exit` 时未 drain 导致的大日志截断。保持 Cargo exit code 与零测试 fail-closed 合同，以真实子进程管道覆盖 >64KiB 双流及通过/失败状态；先保留失败回归，再修复并补完整 RuntimeCore summary。该修复直接服务本轮 harness 证据完整性，不扩大为脚本治理项目。

`scripts/app-server/ephemeral-fixture.mjs` 最终 **exit 0**，日志 `ephemeral-stdio-runtime-complete.log`。同一固定 sidecar 的真实 stdio + RuntimeBackend + OpenAI-compatible loopback provider 执行真实 `exec_command`，3 次采样覆盖工具 continuation 和第二轮内存历史；公开 metadata/loaded list 正常，历史读取明确拒绝，两个进程都经 EOF 正常退出。隔离 data/app 目录未发现合成 thread/turn/input/tool/output marker；冷 read/resume 拒绝，普通线程冷读/list 仍可用。此为本地受控 provider 证据，不是 live、四协议、Windows、GUI、CLI 或 PTY 验收。

前置失败全部保留：最初 fixture 只注册 observer、未继续读 stdio；随后缺少 experimentalApi 握手；再后直接扫描 runtime 没有创建的 app-data 目录。最终使用现有 `nextServerMessage` 读取并拒绝意外 reverse request，声明实验能力并预建隔离目录。未修改生产 runtime、原成功断言或超时预算；失败诊断只输出事件身份/终态与 provider 请求类型，不额外复制 provider prompt。更新最终冻结中的 fixture 摘要；23 个 Lime 与 4 个 Codex 源码摘要仍一致。

Agent Runtime **266/266**、App Server Client **50/50** 通过；最终 GUI smoke **24/24、exit 0、正常退出**，完整 summary 见 `ephemeral-gui-smoke-summary.json`。标准 stdio fail-closed smoke 同样 exit 0。RuntimeCore 最终串行回归和重建后的 Electron 场景尚待终态；ephemeral 前提继续 validating。完整默认本地门禁尚未通过；不把并行 runner 的共享续跑状态混入本轮结论。Memory phase-2 仍是 direct sampling，受限共享 Agent 尚未接入。

### 续接：ephemeral 核心合同验收

最终 RuntimeCore **885/885、exit 0**，完整 summary 为 `ephemeral-runtime-drained-final.log`：0 failed/ignored，1091 filtered，81.32s。原串行回归也 exit 0，但因 runner 写入 buffered 双流后立即 `process.exit`，原日志在第 600 行附近截断，不能仅凭该日志宣称计数。新增真实 Node 子进程管道回归，用大于管道容量的 stdout/stderr 分别验证 status 0 和 101，旧代码两例均只收到约 8KiB stdout；最终改用 `process.exitCode` 等待 drain，原有 Cargo 状态与零测试保护保留。相关 runner/classifier **23/23 通过**，原失败与 fixture 环境错误均单独保留，没有修改产品测试断言或预算。

同一 runner 入口用 `pathToFileURL` 比较当前模块与 argv 路径，保留空 argv/import 的保护，覆盖 Windows 路径和带空格路径的 URL 编码语义；最终相关回归仍 **23/23**（`rust-output-final.log`）。本机只执行 macOS，不能标记 Windows 运行通过。

重建后的 Electron `unknown-item`、`home-hotpath`、`home-hotpath-greeting` 分别 exit 0，均 business assertions passed，Main code 0/signal null、无 forced cleanup。只有第一个场景实际重建 renderer；其余由既有 freshness 检查确认后复用产物，没有使用 build-ready override。原聚合未继续执行的其它场景仍未验证，三个定向场景不等于聚合全通过。

ephemeral 核心退出条件 **4/4，100%**：公共 metadata/loaded 读取、多轮共享 runtime 与模型历史、集中持久化和 sidecar 旁路隔离、关闭后不可冷恢复（包含普通 durable 对照）。证据仅覆盖已记录的本地平台/受控 backend；完整项目交付门禁和受限 Memory Agent 不在这个百分比中。默认门禁仍未通过；本轮复制现有续跑状态到独立 `.lime/test/vitest-smart-memory-ephemeral-20261020.json` 再启动 `verify:local`，保留原共享状态和失败记录，等待该轮终态。

后继接线需保留以下直接源码细节：`phase2_workspace_roots_tests.rs` 同时断言 cwd 和 workspace_roots 只有 Memory root，不能仅换 cwd 后继续继承父项目写根；`phase2_sandbox_tests.rs` 断言 Disabled/External 原样保留。`agent::get_config` 只关闭 `SkillMcpDependencyInstall`，没有全面禁用 Skills，不能把 Apps/Plugin/MCP 的限制扩大为删除全部本地 Skill 和 AGENTS 指令。实际工具面、hook 与依赖安装分别依据上游配置和 current executor 落地。

同一窄 fixture 追加多模型真实路由验收已 **exit 0**（`ephemeral-stdio-route-switch.log`）：第一 provider 完成工具 continuation，调用公开 `thread/settings/update` 切到另一 provider/model/key；第二 provider 收到真实第二轮请求和原工具历史，旧 provider 不再收到采样，请求计数 `[2,1]`。两个进程 EOF 正常退出，持久化隔离与冷恢复拒绝均通过。继续使用 OpenAI-compatible loopback 协议，不把两 provider 误记成四协议矩阵。最终摘要同步到冻结与账本，原单 provider 通过记录保留。

下一实现保持业务责任分离：RuntimeCore 承接同一会话/回合的内部 admission、终态和 shutdown；LocalMemoryBackend 保留 root、lease、精确来源、workspace artifact/baseline 与提交；model-provider 保留实际路由/readiness/协议 lowering。替换 `ExecutionBackend` 的 phase-2 直接采样委托，注入受限共享 Agent 执行能力；不得保留当前 JSON proposal 返回协议作为 fallback。尚未开始该接线，M01 与总目标继续 active。

### 续接：Memory 写根限制的真实执行前提

直接源码复核发现现有 `command/exec` 的 `sandbox_policy_label` 丢弃所有结构化限制；`tool-runtime/sandbox/command.rs` 无条件允许 `/tmp`、`/var/tmp`，read-only 同样可写临时目录。这会使后继 Memory managed 配置在实际进程层失效。本轮先闭合该执行前提，再回到 phase-2 共享 Agent 接线；不核销 Memory Agent。

窄写集：protocol v2 `command_exec.rs`、其 schema/type 生成物和回归；App Server `command_exec` 的 sandbox lowering、测试及现有 `execution_process` 构造接线；tool-runtime `sandbox/command`、`execution_process` 的 typed policy 接线与 Windows ACL 对应分支、其定向测试。读取 Codex `app-server-protocol/.../permissions.rs::SandboxPolicy`、`request_processors/command_exec_processor.rs`、`protocol.rs::get_writable_roots_with_cwd` 和 phase2 `get_config`，不是推测权限语义。替换 `command/exec` 的任意 JSON/string policy 为 canonical tagged enum，不增加兼容分支；原 turn/runtime 的字符串配置继续在其现有边界转换，不能作为公开 command wire。退出条件：typed wire/消费者与 schema 同步、读写/网络/临时根实传、真实进程拒绝越界且允许明确根、定向回归和 contracts 通过。多模型路由不参与 OS sandbox lowering。

默认门禁独立续跑在第 29/142 批 exit 1：`windows-packaged-evidence.test.mjs` 的真实 CLI 帮助与缺参两次子进程超过原 5000ms。原样单独复跑同样失败（5690ms），不能归零或仅归因主机负载。直接依赖定位：`windows-packaged-evidence` -> `windows-squirrel-rc-smoke` -> `windows-squirrel-n-minus-one` 顶层引入 Playwright，仅复用版本规范化也要加载浏览器栈。追加窄写集只改后者的导入时机，移到实际 CDP 连接前；保留全部断言与原超时，定向覆盖两份原测试。该修复只服务现有门禁，不新增发布流程。

`tool-runtime/execution_process.rs` 与 App Server 同名文件均已超过 1000 行，本片只替换 typed policy 接线；新根解析和网络合并逻辑放 `sandbox/policy.rs`，不在超长进程 owner 继续堆业务逻辑。原有 workspace/permission profile 的字符串转换保留在其既有配置边界，`command/exec` 的任意 JSON/string 入口直接删除。Windows ACL 同步接 typed roots 与临时目录排除；本机不能证明 Windows 实际权限执行。

### 沙箱验证续接

canonical schema 与 TypeScript 已生成：1060 个协议类型，零生成失败；公开 `command/exec.sandboxPolicy` 已由 unknown 收为 tagged `SandboxPolicy | null`。现有 TypeScript client **139/139** 和完整 `test:contracts` 均 exit 0。命令 gateway 原定向 **6/6** 通过。没有修改 Electron IPC/preload 方法或添加第二 transport；CLI debug 仍传 permission profile，由同一 processor 转换 typed policy。

tool-runtime 首轮 **12/13**，唯一失败是测试固定 `/tmp/workspace` 在本机存在后被 canonicalize 为 `/private/tmp/workspace`，与旧硬编码路径断言不同；已将夹具换为唯一 tempdir，保留 metadata 保护与命令透传断言，最终重跑待终态。生产实现未因此修改。该已知测试差异和生成物 SHA256 已登记 `sandbox-source-freeze.json`，其余 19 个 Lime 来源和 4 个 Codex 来源逐项校验无漂移。

最终 tool-runtime sandbox **13/13、exit 0**，修正后的 unique tempfile/canonical path 断言已覆盖。Linux bubblewrap lowering 仅验证命令数据，未在 Linux 运行；Windows ACL 仍无本机运行证据。canonical Rust protocol **145/145** 与 renderer/Node typecheck 也已通过。32 项冻结来源（含新增记录的进程边界夹具）检查无漂移。

最新独立 resume 第 38 批 **132 passed / 3 failed**，失败均为生成器原 5000ms 超时；完整本地门禁继续 failed，未调整预算或断言。主机采样时 load 约 100、swap 约 23GiB，仅记录构建资源状态，不将其认定为全部失败的根因。等待现有 Rust 队列排空后再续跑，避免并行追加完整 gate。

构建恢复：共享 `lime-rs/target/debug/.cargo-lock` 在任务运行中由 inode `917503761` 变为 `920906273`。旧 App Server unit 编译先发生 incremental object ENOENT，尚未执行测试，exit 101；随后用 `lsof` 确认两套 Cargo 分别持有旧/新 inode。只 SIGTERM 本轮已确认的旧锁任务树（stdio integration / tool-runtime sandbox，均 exit 143），保留新锁上的 protocol / process regression；未删除任何共享 cache/target，未触碰外部进程。记录 `sandbox-target-recreation.json`；原因确定为 target 已重建，执行者未知。冻结源码无漂移，后续 Rust 通过结果必须来自新锁下重建后的产物。

后继 Memory 接线的本地文件边界已进一步定位（只读，不混入本片 OS runner 完成度）：Codex `tools/handlers/apply_patch.rs` 在 verify 时传 selected Environment sandbox，`tools/runtimes/apply_patch.rs` 在 apply 时再次传 `FileSystemSandboxContext`（cwd、workspace roots、permissions）。Lime 的 `tool-runtime/apply_patch.rs` 本地分支直接 `spawn_blocking -> patch_apply`，不会经过 Seatbelt；attempt check 认可 cwd 内写入，`patch-apply/apply.rs` 负责 existing-prefix canonicalization 和 workdir escape 拒绝，但本次检查的这两个 owner 没有 `.git/.codex/.agents` 元数据保护规则。下一片必须把可信 Memory policy 传到本地 add/update/delete/move 实际执行，尤其保护 baseline 元数据；不能用本片 shell 保护证明全部工具已受限。来源 SHA 和有界观察见 `memory-native-filesystem-source-map.json`；尚未复现工具级越权，不作全工具漏洞或运行通过声明。

Memory hook 接线还需区分插件 hook 与用户配置的全局 hook：Codex phase2 `get_config` 克隆父 config 后关闭 Plugins，但未清空全局 hooks；typed `MemoryConsolidation` 的 Stop block/abort 仍应走现有明确失败分支。后继实现不能以“禁用插件”为由全面关闭 Stop，使该终态约束失效；与本地 Skills/AGENTS 保留、仅关闭 dependency install 的限制一起验证。此为源码配置复核，未新增 Memory 运行通过声明。

进程回归首轮 App Server **24 passed / 1 failed，exit 101**，原日志 `sandbox-process-regression-tests.log` 保留；Cargo 在此停止，不能据此计入 tool-runtime 同过滤器的结果。失败夹具原用 `tempfile::tempdir()`，其 sibling 位于默认 workspace-write 明确允许的 TMPDIR 内；与 Codex `get_writable_roots_with_cwd` 的默认临时写根合同冲突。并行进程在 `d32e7054c` 已把该唯一 denial 夹具移至 home 下的独立临时目录，保留 inside 可写、outside 不存在及伪造 metadata grant 不生效的原断言；本任务没有重复修改或提交。该修改仅修正测试前提，尚待新产物回归终态。

重建后的 App Server `command_exec` **16/16、exit 0**：包括真实 macOS 进程的只读拒写、Memory 临时根排除/显式写根/元数据保护与 loopback 网络开关。该二进制来自新锁下最终生产源码；不等于真实 stdio/PTY 或 Memory phase-2 Agent 通过。原生文件路径继续沿上游追到 `exec-server::LocalFileSystem::file_system_for_writes -> SandboxedFileSystem -> FileSystemSandboxRunner -> SandboxManager`：managed 操作使用 typed filesystem helper 和同一 OS sandbox；缺 runtime paths 时明确失败。后继不得以路径预检查替代该执行边界，或声称解决 symlink race。来源摘要补入 `memory-native-filesystem-source-map.json`，没有据此提前修改/启用 Memory Agent。

真实 `command_exec_jsonrpc` **2/2、exit 0**：stdio App Server 执行完整 policy、拒绝旧字符串、允许 Memory cwd、拒绝被排除的 `/tmp` sibling，PTY 输入/resize/退出及正常 EOF 均通过。修正夹具后的 `execution_process::` App Server **25/25**、tool-runtime **27/27**，同轮 exit 0，包含原失败的边界断言。

默认门禁续跑第 38 批 **135/135**，原生成器断言和 5000ms 预算未变；第 39–42 批也通过。第 43 批 **129 passed / 1 failed**：`ProviderSetting.ui.test.tsx` 的 402 业务错误固定断言中英文，但 `resolveAgentChatCopy` 优先读取残留的 `document.documentElement.lang=ko-KR`。追加窄写集只在该测试 beforeEach 保存并固定 `zh-CN`，afterEach 恢复，不改业务文案、错误分类或原断言；目标文件此前 clean，未触碰其它 Provider owner。该修正服务门禁确定性，不计入 Memory 行为完成度。原失败日志 `sandbox-local-resume-final.log` 保留，验证修正后继续独立 resume。

新固定 App Server SHA256 `170238d1633ce4de7675c77dc76da3ddbfb1359609efc39dd09425e45ff4d6d3`，清单 `sandbox-fixed-sidecar.json`；旧 red 产物保持原样。最终共享 runtime stdio loopback 回归 exit 0：工具 continuation、多轮内存历史、无私有记录落盘、冷恢复拒绝、普通 durable 对照、公开 provider/model/凭证切换均通过，请求计数 `[2,1]`、正常退出 2 次。该证据仅为 OpenAI-compatible loopback。`verify:gui-smoke` 重建 renderer/host/sidecar 后 **24/24、exit 0**，summary 为 `sandbox-gui-smoke/summary.json`，证明真实 Electron/preload/IPC/current App Server 与壳/Memory 设置，未执行 Memory provider Turn。

语言夹具定向 **26/26**、原第 43 批 **130/130** 通过，第 44–45 批也通过。第 46 批 **156 passed / 8 failed**，两个 PPTX Worker 夹具依赖 `node:module.registerHooks`，默认 Node `v23.4.0` 中该 API 为 undefined；本机另有已安装 Node `v25.0.0`，先用其定向验证再继续原独立状态。未改系统 Node 配置、package engines、PPTX owner、原断言或超时；原失败日志 `sandbox-local-resume-after-locale.log` 保留。完整默认门禁继续 failed，沙箱执行前提 **4/4、100%** 只指 typed wire、真实 macOS 完整 policy、共享进程回归、真实 stdio/PTY 四项合同，不能替代 Memory phase-2 或未运行平台验收。

Node 25 定向终态 **10 passed / 4 failed、exit 1**：builtin **8/8**，format **2/6**，后者四项超过原 5000ms；缺失 `registerHooks` 的报错已不再出现，但不能据此宣称整个运行环境问题已解决。原日志 `sandbox-node25-presentation-fixtures.log` 保留，本轮没有再扩大到无关 PPTX 实现或修改其测试预算。完整门禁仍停在第 46/142 批；所有本轮启动的测试与 GUI 命令均已取得终态。

本片收尾：`current` 为 typed wire、完整 policy 与现有 OS runner；无新增 compat/deprecated；已删除丢字段 policy label lowering、任意 JSON/string command policy、无条件 `/var/tmp` 和 read-only 临时写权限。test-only 为两处沙箱夹具修正及 Provider 文档语言保存/恢复。root 本次只追加 Provider 测试四行、主计划和本目录证据；既有沙箱源码与并行提交保持不变，32 个冻结摘要均匹配。避让 `.gitignore`、发布计划、async-user-input、GUI/Artifact 及其它并行写集。本片执行合同 **4/4**；M01 和整体对齐继续 active，下一刀仍归共享 RuntimeCore / tool-runtime / memory_store 的受限 Memory Agent，不由默认门禁的无关失败替代主线。

### 2026-10-20：完整 phase-2 实施（active）

按用户“复刻 Codex 的实现，完整实现”继续生产接线。窄写集为 memory_store/consolidation/workspace、RuntimeCore 内部 admission/shutdown、ExecutionRequest、Agent session config 和工具 snapshot/executor，以及 tool-runtime 的 native filesystem helper/typed attempt；对应测试与本计划/architecture 同步。避让 GUI、发布和 async-user-input 脏写集。

直接源码合同：memories/write/phase2.rs::agent::{get_config,handle,loop_agent}，workspace.rs 的准备/diff/validation/reset，core/tools 和 exec-server 的 OS filesystem helper。完成次序是共享内部 Agent → 真实终态 → shutdown(10s) → artifacts validation → ownership heartbeat → baseline reset → exact selection/watermark。shutdown 失败不释放租约。phase1 采样保留，phase2 direct sampling 与 JSON proposal 删除。保留本地 Skills、AGENTS 和全局 hooks；隔离插件 hooks、MCP、Apps、递归 Agent 与依赖安装。多模型路径继续使用原 route/readiness/provider owner。

退出条件：可信 typed policy 在 snapshot 和实际 executor 同时生效；managed cwd/workspace root 唯一 Memory root、禁网/临时根排除；native patch add/update/delete/move 经过同一 OS runner；取消/lease loss/Stop block/abort/shutdown failure/无效产物不提交；exact source version 与 baseline 回归；真实共享 runtime 工具 continuation。未满足前保持 active，不以旧前提验证百分比代替交付。

实现结构：新增业务放 memory_store/workspace、runtime/memory_agent 和 tool-runtime/filesystem_helper；mcp_step_snapshot 的原内嵌测试整体迁到同名 tests 模块，生产 owner 回到 800 行以内。超长 turn_execution/execution_process/memory_store 仅作可信 capability 和既有合同接线，不在其中继续扩展新的 harness；本片退出条件是所有新增编排、helper、workspace 行为留在独立领域模块并通过定向及真实边界验证。旧 stage-two proposal review/identity-check helper 与只验证该旧行为的测试删除，精确版本提交回归保留并扩大到 Agent 执行期间新提取版本的场景。

### 续接验证：v2 workspace 与真实 harness（进行中）

直接复核 `memories/write/src/workspace.rs::validate_consolidation_artifacts_for_version` 后修正：v2 只要求合法 `memory_summary.md`，不强制或重建 v1 的 `MEMORY.md`。列表、health、reset 的旧正向夹具同步更新；新增 summary-only 连续两次整合、不重复采样、来源删除和空 selection 回归。diff 现在包含新增提取文件的内容；失败且关闭完成后清理符号链接，Windows 使用 symlink directory 的 file-type 信息处理 dangling directory link，避免追随目标判断。

新增 `scripts/app-server/memory-agent-fixture.mjs`，使用隔离 stdio App Server、真实 RuntimeBackend 和 loopback provider。phase1 返回严格 JSON；phase2 返回 shell → 原生 patch → final，检查同一 canonical Thread/Turn metadata、公开 ephemeral metadata、AGENTS、工具面、关闭、数据库 selection/watermark 与无内部历史落盘。另有隔离用户 Hook 配置的 block/abort 模式，使用公开 `hooks/list` 的 key/hash 显式信任 fixture hook；不会修改真实用户配置。内部回合走静默同步 sink，不为测试添加面向用户的 completion notification。该 fixture 尚未执行，不能记为通过。

首轮单测编译失败于新增夹具的 `AbsolutePathBuf.as_path` 和 `NetworkAccess::Disabled`，已按真实类型改为 `AsRef<Path>` / `Restricted`；原错误日志保留。修正轮仍在编译，此间新增的生产/回归改动必须再以最终源码执行。未清共享 target，未停止外部构建或改测试断言/预算。

`governance:scripts` exit 0。`test:contracts` 首轮遇到旧 Memory 委托字符串及并行 GUI fixture 两项旧 `openWorkbench/workbenchOpened` 断言；只迁移本任务 Memory 委托守卫，后续 client guard 仍因后两项 exit 1。其余 command、harness、modality、release、Desktop reference、CLI、cleanup、docs 边界八项全部 exit 0，见 `memory-agent-contracts-remainder.log`；这不是聚合 contracts 通过。避让 GUI owner 与其业务测试，没有删除阻塞断言。

源码冻结 `memory-agent-source-freeze.json` 是直接源码证据，后续最终摘要需重算，不当运行证据。workspace baseline 当前复用 git 可执行程序，Codex 使用 gix；本机 Git 命令、Linux/Windows 与打包后 Git 可用性仍待验证，不把相同产物结构写成逐实现完全相同。

baseline 实现细节补查：Codex `git-utils/src/baseline.rs` 用 gix 写对象和单提交，但 `write_index_from_head` 仍调用 `run_git_for_status(..., ["read-tree", "--reset", "HEAD"])`；不能把它描述成完全不依赖 Git 可执行程序。本实现复用现有 Git 进程，尚须用最终产物验证新增/修改/删除内容、单 baseline 和清理历史；Linux/Windows/打包环境的可用性仍单独开放。

### 取消与关闭的补充修正（验证中）

直接读取 Codex `core/src/tasks/mod.rs::handle_task_abort`，确认上游也先给 100ms graceful cancellation，再 abort task。Lime 的既有 actor 合同相同，因此 native filesystem 不能只依赖调用 future 的 Drop 发送 terminate。现有 LocalExecutionProcessHandle::wait 原先在等待前取走 oneshot；被 select 取消后无法再次等待真实退出，已改为借用 receiver、收到终态后再取走。新增真实子进程回归通过 stdin 唤醒，检查取消等待后可继续等待且完整输出保留。

可信 InternalAgentPolicy 现在持有原生文件工具的 TaskTracker 与关闭 token；helper 使用同一个现有 OS process supervisor，会话 actor 退出后由同一 shutdown_session_runtime 取消并等待这些任务。调用 future 丢弃会取消 helper，owned helper 继续 terminate + wait；关闭未完成继续受外层 10s timeout 与保留 lease 约束。没有创建第二套进程执行器或业务 runtime。另补 shutdown 必须等原生写任务 drain 的确定性回归。stage2_candidates 仅供测试，标记 cfg(test)，生产不保留 dead helper。

86/86 单测来自上述补充之前的源码，仅保留其覆盖范围。本轮旧 filesystem/stdio integration 编译任务（本轮 Cargo PID 62217 / rustc 80592）因源码已变化而终止，exit 1；未执行测试、不计通过。未清 target 或停止外部任务。修正后的定向单测、Memory 单测和真实 filesystem/stdio 已重新排队，只有最终源码产物可用于后续 fixture。

### 2026-10-21：真实边界发现与单次采样修正

取消/drain 修正后的 Memory 定向回归 **87/87、exit 0**（agent-runtime 1、app-server 72、lime-agent 6、tool-runtime 8），含 shutdown 等待原生写任务回归；进程取消后重新 wait 的真实子进程回归此前 **1/1**。这轮早于后述 phase1 修正，不当作其最终通过证据。

原生 filesystem/stdio 首轮 stdio/PTY **2/2**，filesystem **2 passed / 1 failed**；失败根因是 Seatbelt 清除 DYLD 环境后 App Server helper 缺内建 rpath，无法加载同目录动态库。此前负向两项也可能因 loader 失败误过，因此明确不能接受为权限证明。App Server build.rs 现于 macOS 链接时写入 `@executable_path`；现有打包 owner 本就将 dylib 放在 sidecar 同目录。拒绝断言强化为真正 Permission denied/Operation not permitted，禁止启动失败算沙箱成功。修复后 integration 正在重新构建。

真实 loopback 请求诊断确认 phase1 意外携带 11 个本地工具。Codex `memories/write/src/phase1.rs::job::sample` 使用空 tools 的 Prompt、strict output_schema 与单次 stream，而 Lime 旧 direct_text_generation 委托完整 Agent reply loop；RequestToolPolicyMode::Disabled 只关闭 web tools，无法提供此隔离。窄写集扩至 direct_text_generation 及独立 tests、request_tool_policy 的两个无用配置包装；复用 agent-runtime/provider_turn 的 generation controls 和既有 model-provider client，不建立第二 provider/router。保留原 credential/readiness/model policy、identity 与 strict schema；不执行工具、不跑 hooks/Agent loop、不读写会话 usage 作为采样结果。仅明确 Stop 且无需 follow-up 的 Finish 成功，工具事件、错误/截断/过滤/EOF 返回失败。新增请求捕获合同、终态/usage、意外工具/截断/EOF/transport 回归，真实 phase1 fixture 保留零工具并新增 strict schema 断言。

fixture 曾误用 Chat 的不存在 canonical metadata、错误 public providerType；现使用公开 `openai-response` 配置和真实 Responses `client_metadata` 验证身份，原失败证据保留，不修改 Chat wire 迎合测试。Responses 只证明该协议，普通 Chat 继续由共享 ephemeral fixture 验证，四协议矩阵仍开放。生产代码和测试最终冻结、最终 binary 与 allow/block/abort 验收尚在进行。


成功路径复核另发现 `MemoryAgent::run` 的 drop guard 直接持有上层 heartbeat-lost token；正常返回也会 cancel，令关闭后 ownership 检查误报 lease 丢失。现改用 child_token：父 lease loss 仍传播到 Agent，caller future Drop 只取消内部子任务，正常完成不改变父 token。既有同核/actor 成功回归增加父 token 未取消断言，既有丢弃 future 关闭回归继续保留。该修正尚须新源码回归与真实提交 fixture，不以此前 87/87 核销。


补查 Codex `memories/write/src/runtime.rs::stream_stage_one_prompt`：无 delta 时从完成 Message 取文本，已有 delta 时不重复拼接。单次采样同步复用 canonical ResponseItem/ContentItem 解析并补完成项/去重回归；没有新协议分支。最终 standalone sampler 回归共 6 项；Memory 最终轮另加入父 lease cancellation 传播回归，仍待编译终态。

rpath 修正后的真实 integration **5/5、exit 0**（stdio/PTY 2、native filesystem 3），强化的权限错误断言与 root 内 add/update/move/delete 均通过。该产物仍早于单次采样和父 token 修正，只闭合本地 helper/进程边界；最终源码 integration、Memory 单测及真实 harness fixture继续运行。新 source-freeze 62 个 Lime 来源与 12 个 Codex 来源，只刷新已声明改动，没有吸收未知漂移。

### 2026-10-21：真实 Memory harness 终态与 Stop hook 语义收口

使用固定 App Server 产物 `5aa081fd9aa00fffbbaa993061392f980fd1d711bc463561765725e86390ce44` 重跑真实 stdio fixture：`allow`、`block`、`abort` 三种模式均 **1/1、exit 0**。三次都观察到 phase-1 单次严格零工具抽取、同一 RuntimeCore 内部 Thread/Turn、`exec_command` continuation、原生 `apply_patch`、ephemeral shutdown、exact selection/watermark 和无内部历史落盘。

本轮追加的生产修复与证据：workspace `memory_summary.md` 缺失或为空时，`runtime/memory_prompt.rs` 回退到 global `memory_summary.md`，保留 workspace 优先级，避免普通 Turn 在工作区 Memory 尚未建立时丢失全局上下文；`memory_prompt` 定向回归 **6/6**，`memory_store` 定向回归 **40/40**。`session_data_source` 增加 Memory read 响应序列支持，真实 `memory-agent-fixture.mjs` 以两个独立 rollout source 验证 phase-1 多来源提取、phase-2 同一 RuntimeCore 内部 ephemeral Agent、真实工具 continuation、native `apply_patch`、普通 Turn citation、citation usage 持久化及下一轮 selection 将已引用 source 排首位；多次内部 Agent 的 ephemeral history 不落盘。`allow`、`block`、`abort` 三种 Stop hook 模式均观察到内部 Agent 正常完成、用户 Stop hook 被忽略且正常关闭；block/abort 只证明普通用户 hook 的过滤合同，managed/System hook 仍由 stop receipt 单测覆盖。

这轮结果仍是本地受控 Responses provider 的真实 stdio 证据，不等于 live、四协议、Windows/Linux/packaged、CLI/TUI 或 GUI 完整验收。provider readiness 失败后的可观测 retry/recovery、disabled scope、thread delete/fork/cold reopen、四协议 capture 与 phase-2 selection 的跨进程冷启动持久化仍未核销；整体状态保持 **active / partial**。

`block`/`abort` fixture 使用的是普通 User hook，结果按 Codex `core/src/hook_runtime.rs` 与 Lime `agent-runtime/src/provider_turn/stop_hooks.rs` 的同一过滤合同完成提交；它证明 User/Project hook 不会被 `MemoryConsolidation` 当作受管 Stop hook。managed/System hook 的 block/abort 失败语义继续由 `stop_receipt` 单测覆盖，不能用普通用户配置 fixture 冒充 managed hook 证据，也不能为通过 fixture 放宽生产过滤。

本次只修正测试证据与执行计划，生产实现未为 fixture 增加分支。`memory-agent-source-freeze.json` 已刷新 fixture 摘要，`verification-summary.json` 已登记三次真实进程结果。当前 Memory harness 在本地受控 Responses provider 上完成实现验证；四协议、live、CLI/TUI、GUI fresh rebuild、Windows/Linux/packaged 与 LimeCore 端到端仍保持开放。
