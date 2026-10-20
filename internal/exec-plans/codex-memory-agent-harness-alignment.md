# Codex Memory consolidation Agent harness 对齐

状态：active；完整对齐目标继续 active。负责人 root，2026-10-20。

当前进度（续接汇总）：

- 已验收：精确 snapshot / extraction ownership **39/39**；共享 ephemeral 核心合同 **4/4（100%，仅此前提）**；真实 stdio provider/model/key 切换保留工具历史。
- 正在验证：完整 typed `SandboxPolicy` -> 现有 OS runner，关闭临时目录越权写入；schema/TypeScript 已生成，client **139/139** 与 contracts 已通过，真实 OS/stdio 和定向 Rust 结果待收齐。
- 已修复门禁问题：Windows evidence CLI 的纯参数入口提前加载 Playwright，改为实际 CDP 连接前加载；原断言/超时下相关 **39/39** 通过。
- 默认门禁：独立续跑已通过批次 29..37；最新第 38 批协议生成器三项超过原 5000ms，完整门禁未通过；原样单跑 **6/6** 不替代聚合结果。
- 下一刀：同一 RuntimeCore 的可信 typed Memory admission、snapshot/executor 扩展隔离、workspace artifact/baseline、真实终态/shutdown 后精确提交；删除 phase-2 direct sampling。上述 Agent 接线尚未实施，M01 继续 active。

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

| 合同                     | current owner / 事实                                                                                                                                                                                  | 下一步必须改动                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同一 Thread/Turn manager | `runtime/session_lifecycle.rs::start_session`、`turn_execution.rs::start_turn`、`session_shutdown.rs::shutdown_session_runtime` 共用 `RuntimeCore.state`、session registry、backend                   | consolidation runner 复用这些 owner；不能新建独立 runtime/actor registry                                                                                                                                              |
| 真正 ephemeral           | `processor/thread/lifecycle.rs` 的 public `thread/start` 已接收 ephemeral 并写 metadata，但 `start_session` 仍写 canonical thread；`thread_fork/settings.rs` 则明确拒绝未实现的 ephemeral storage     | Codex `core/src/session/session.rs:1041/1159` 在 ephemeral 时同时跳过 thread persistence 和 state DB。Lime 必须让实际 projection/EventLog/rollout 生命周期与 shutdown 成对，且不反哺 phase1；只存 metadata 不满足合同 |
| 扩展隔离                 | `runtime_backend.rs::handle_turn_start_with_provider_history` 当前读取 plugin snapshots、初始化 MCP、discover orchestrator skills；`request_context/session_config.rs` 合并 AGENTS/Skills/Memory/Soul | typed internal source 必须在读取、发现、prompt、hook 与执行边界都生效；单纯空 snapshot/prompt 禁止词不够                                                                                                              |
| 工具隔离                 | `agent/current_provider_turn/mcp_step_snapshot.rs` 每 step 重捕获本地/MCP/dynamic tools；`tool_executor.rs` 承接真实执行                                                                              | 限制必须同时约束 snapshot 与执行，避免全局 gateway registry/工具检索重新暴露被禁能力                                                                                                                                  |
| 仅 memory root 写权限    | `tool-runtime/sandbox/command.rs` 的默认 Seatbelt profile 允许 `/tmp`、`/private/tmp`、`/var/tmp`、`/private/var/tmp`                                                                                 | Codex managed Memory config 排除临时目录；复用现有 sandbox owner 补内部限制，不能把普通 workspace-write 当成已对齐。父级 Disabled/External 的处理仍按 Codex 源码                                                      |
| 真实终态与关闭           | `start_turn` 等 session task 完成；`unload_thread_if_idle` 经同一 close owner 释放资源                                                                                                                | 需证明 Completed/Failed/Cancelled、Stop 拒绝、取消后 drain、shutdown 失败保留 lease，再核销共享 harness；本片取消直接采样不提供该证明                                                                                 |
| 精确 snapshot selection  | Codex `state/runtime/memories.rs::mark_global_phase2_job_succeeded` 使用 `thread_id + source_updated_at`；本轮 Lime 提交/Review 已携带 `source_path + source_updated_at + content_hash`，定向验证中   | 共享 Agent 继续传递该实际选中版本，不能降回按路径提交；当前来源文件检查不提供跨数据库/文件系统的原子事务                                                                                                              |

上述是直接源码事实与实施约束，不是已完成能力。REA Desktop timeline 证据只复用其静态 UI 观察范围；不用于证明后端 ownership、关闭顺序或真实产品执行。

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

最新独立 resume 第 38 批 **132 passed / 3 failed**，失败均为生成器原 5000ms 超时；完整本地门禁继续 failed，未调整预算或断言。主机采样时 load 约 100、swap 约 23GiB，仅记录构建资源状态，不将其认定为全部失败的根因。等待现有 Rust 队列排空后再续跑，避免并行追加完整 gate。
