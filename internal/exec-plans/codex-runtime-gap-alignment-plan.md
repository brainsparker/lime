# Codex Runtime 缺口对齐实施计划

> 当前状态：active；2026-10-18 重新打开核心机制对齐，以下历史四项完成不代表整个 runtime 已对齐。
> 主目标：CLI/TUI/GUI 经同一 App Server 和 RuntimeCore，具有 Codex 的 Context、Memory、Agent Loop、Tools、Extensions 与 harness 行为。

## 当前证据与实施顺序（2026-10-18）

CLI 唯一上游事实源是 `/Users/coso/Documents/dev/rust/codex`，本轮复核 HEAD
`8c076942cb70fba8e5c4732c23f1faabc4aed484`（原记录为 `4eb4a65407d98cebc4c83bf13be440b9fbc78a7c`）。
直接读实现、消费者和测试，不反编译 CLI。已核对 `compact.rs`、`session/turn.rs`、
`context_manager/{history,normalize}.rs`：工作树均与新 HEAD 一致；前后版本的压缩核心实现
与 rollover 行为未变，有变更的两处差异为 typed text 转换。文件 SHA 与对照记录保存在
`/tmp/lime-codex-context-source-evidence-20261018.json`，不将源码检查表述为运行证据。
REA 仅用于公开源码未覆盖的 Desktop 安装包行为；已有 ASAR SHA
`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`，
静态图 parent `ev_9c3ce94f6ea6e0a65d3db7e2745c6e11eb7874d3f2e6140a0c387bb8d5ee1656`。
本轮 summary view 超出 REA transport 预算，不能当作已完整阅读的行为证据。
未进行 CLI 反编译。源码证据、安装包静态证据与真实进程证据分别记账。

用户已明确开发期间不考虑兼容和迁移，覆盖本计划及共享后端旧文档中的兼容要求。
直接替换 current 消费者并清理旧实现。插件、tar.gz 与 LimeCore 全范围继续保留，
执行优先级先转向下列核心机制；不以 UI 或插件切片完成替代核心完成。

### 多模型、多协议约束（2026-10-18 用户补充）

对齐 Codex 的 Context/Memory/Loop/工具生命周期时，必须继续通过 Lime 的规范内容和
共享模型路由执行。不得把 OpenAI Responses、OpenAI 模型名称、固定 context window、
tokenizer、reasoning effort、服务档位或 remote compaction 可用性设成所有模型的前提。
model catalog、默认选择、model switch、capability/readiness 与 retry/circuit breaker
继续归 `model-provider` 控制面；wire/auth/媒体 lowering 继续归各协议 adapter。
参考分工服从仓库架构：Codex runtime 源码、grok-build model control、OpenCode wire。
用户再次明确：**主对标始终是 Codex（CLI/runtime 源码、Desktop REA）；grok-build
仅参考多模型/多协议处理，不以其 Loop、harness、插件或产品限制替代 Codex。**

每个核心切片的退出条件必须覆盖：

- 四种当前协议族（Chat Completions、Responses、Anthropic Messages、Gemini）的
  规范请求与终态；Azure/Vertex 等认证、部署变体单独记账，不能据四族测试宣称已验证。
- 同一会话 model/provider 切换前后的历史、工具 call/result、摘要与冷重开；不能复用
  上一 provider 的 response ID、连接、凭证或预算。
- 当前选中模型的 context/output budget、generation/reasoning 能力、工具和媒体支持；
  不支持的能力明确拒绝或走有实现的规范转换，不静默丢内容、不伪造成功。
- provider-specific opaque state（含 encrypted reasoning/remote compact）仅在能力和
  路由匹配时消费；可移植模型摘要是共享窗口路径，不能把私有 state 写成跨模型 truth。

本轮 C01 追加四协议 HTTP request capture 和 provider 切换验证；这是可控 provider
集成证据，不能替代真实云模型、Azure/Vertex、Windows 或 Desktop/CLI/TUI host 验收。

grok-build 只读参考基线：`2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8`，下表源路径相对
`/Users/coso/Documents/dev/rust/grok-build/crates/`；本轮抽取的 10 个文件均与该 HEAD 相同，
摘要在 `/tmp/lime-grok-multimodel-source-evidence.json`。源码检查不是运行验证。

| 可借鉴机制 | grok-build 源码证据 | Lime 承接与实施决定 |
| --- | --- | --- |
| 模型切换是完整 sampling 配置变更 | `codegen/xai-grok-shell/src/session/acp_session_impl/model_switch.rs:handle_set_session_model` 同步 endpoint/backend、凭证、context/output budget、能力与压缩阈值，并 invalidate auth memo | 保持 Codex step snapshot/Turn 模型；在既有 route/settings owner 校准，禁止只改 model 字符串。C01 增加四协议切换请求/凭证捕获；C02 继续核对新预算 |
| 复用 client 必须验证完整路由 | `codegen/xai-grok-shell/src/agent/remote_config/manager/mod.rs:model_shares_route` 检查 endpoint、backend 和 own credentials；`compaction_config.rs:AsyncCompactionCache` 绑定 model_slug/prefix fingerprint | Lime 已有精确 provider/model/endpoint/protocol/credential 的 health key；Responses session 继续由 `model-provider` 管理。不要另建全局缓存；C03/H01 核对 opaque state 失效 |
| reasoning 是模型能力 | `codegen/xai-grok-shell/src/agent/mvp_agent/reasoning_effort.rs:apply_supported_effort` 被创建/切换/summary 共用；manager 支持 effort 对应 wire model | Lime 已有 `model_capability`、`model_route_contract::provider_reasoning_effort`，C01 复用；effort→model 变体是否需要仍待 catalog 消费链复核，不新增名称猜测 |
| provider 默认值与模型覆盖统一解析 | `codegen/xai-grok-shell/src/agent/model_providers.rs:ConfigModelOverride::with_provider_defaults` 集中处理 backend、context、header/query 与认证优先级 | 参考其优先级显式化；保留 Lime DB/catalog/auth 事实源，不复制 TOML 配置体系或另一套 provider registry |
| token 与请求体字节双预算 | `codegen/xai-grok-sampler/src/config.rs:SamplerConfig` 分开 context_window/max_request_bytes；`session/helpers/prepared_compaction_history.rs` 将图片预算转换只做一次，并保留精确采样历史 | C02/C03 后续应由 current canonical/media lowering owner 处理真实 payload、工具预算和图片；不得照搬供应商固定 30/50MB，也不能静默删用户媒体 |
| 错误分类决定重试和恢复 | `codegen/xai-grok-sampler/src/retry.rs:classify_error` 区分 auth、rate limit、token overflow、payload；`session/compaction_config.rs` 区分 turn/sticky/auth/credit 的 suppression | Lime 已有 provider transport/health/stream error；C01 失败不替换，后续重试应消费其类型，禁止通用无限重试。grok 的 image-strip/额度策略不直接照搬 |
| catalog 有来源和就绪状态 | `codegen/xai-grok-shell/src/remote/model_source/oai.rs:cache_origin`、`agent/remote_config/manager/mod.rs` 的 catalog progress；`task_model_policy.rs` 将 provisional 与 complete 分开 | Lime `model_registry_service` 已有 provider/endpoint/credential scoped cache。继续核对 readiness/default/subagent 选择，不把未加载当成无模型；不采用 xAI family 的产品限制 |

跨模型迁移历史、family-switch compact 和 harness 兼容性最终仍按 Codex 语义和 Lime 真实
能力验证；grok 中“压缩失败也切换”“零 Turn 重建特定 Agent”“首方模型默认继承”等行为
不构成 Lime 的自动需求。Gemini/Vertex 不在该 grok `ApiBackend` 三协议枚举中，继续由
Lime 现有 adapter 负责并独立验证。

| ID | 机制与上游源码 | Lime current 链与已确认边界 | 状态 / 退出条件 |
| --- | --- | --- | --- |
| C01 | `core/src/compact.rs:run_compact_task_inner_impl` 克隆有效历史、追加摘要指令、请求模型，成功后才 replace；空/不完整响应不应提交窗口 | 原 `context_compaction.rs:build_summary` 的事件摘录已删除；current 为 `context_compaction/operation.rs` → `RuntimeBackend::summarize_context` → `agent::run_context_compaction_with_db` → `agent-runtime::context_compaction::summarize_context` | **in-progress P0**：执行器 3/3、App Server unit 31/31、四协议切换/真实 stdio/fork 已过；公共取消暴露 driver completion 缺口，等待共享文件最小补丁合并窗口；retry/overflow/remote compact 等尚未完成 |
| C02 | `core/src/session/turn.rs` 的 pre-sampling、continuation/工具后预算检查及 `run_auto_compact`；`compact_remote*.rs` 为 provider 能力分支 | `context_auto_compaction.rs` 仅在新 Turn 前按 completed usage 判定；`agent-runtime/src/provider_turn.rs` 采样循环尚无 compaction 消费 | **known-gap P0**：同一 Turn 长工具循环能压缩后继续，模型切换后按当前预算判定；摘要实现依赖 C01 |
| C03 | `core/src/context_manager/{history,normalize,updates}.rs` 管理模型可见上下文、工具 call/output 完整性和 world-state 重注入 | `agent-runtime/context_history` 为普通采样/摘要共用的配对与文本预算 owner；`runtime/provider_history{,/canonical}.rs` 和 `context_packet.rs` 保留规范历史/替换投影 | **partial P0**：工具配对与命名结果前片已验证；显式文本预算、恢复投影和 Desktop controlled fixture 已过；当前模型 catalog 预算四协议 HTTP/冷重开/切换 5/5、历史预算 HTTP 5/5 与 fresh sidecar GUI smoke 24/24 已过；产生时的逐项预算/provenance、媒体、世界状态重注入与完整 fork/rollback 尚未完成 |
| M01 | `memories/write/src/start.rs` root/ephemeral/feature gate 后后台 Phase 1→2；`phase1.rs` 提取与 DB claim；`phase2.rs` 全局 lease、模型整合、heartbeat | `app-server/src/memory_store/consolidation.rs` 当前本地整合是 note 分类、移动和拼接；不是上游模型流水线，不能以相同文件布局算对齐 | **known-gap P0**：追完现有 memory owner 后在其内建立模型提取/整合和可恢复任务协调；避免与 context compaction 混用 |
| M02 | `memories/read/src/lib.rs`、`citations.rs`、`usage.rs` 的指令注入、引用和使用计数 | `runtime/memory_prompt.rs`、`memory_store`、`agent/durable_memory_fs.rs` 已有读取/注入；配置页、笔记 CRUD 不证明记忆闭环 | **unverified P1**：检索→引用→使用反馈→整合选择、禁用/删除/作用域和冷重开一致 |
| L01 | `core/src/session/turn.rs` 每次 sampling 的 pending input、工具 continuation、终止、错误、预算和 stop hooks | `agent-runtime/provider_turn.rs` 已有 sampling/tool 循环、step snapshot、usage、pending input 与取消；不能判定完全缺 Agent Loop | **partial P0**：逐退出分支核对，覆盖 stop-hook 要求继续、steer/queue、部分 stream 后重试、取消中工具终态与恢复 |
| L02 | `core/src/session/turn.rs:720` 在 `needs_follow_up=false` 时执行 Stop hook；block+continuation fragments 会继续同一 Turn，内部 Memory 整合拒绝递归续跑 | `tool-runtime/hook_runtime/stop` 已补 Stop/SubagentStop 执行合同；`agent-runtime/provider_turn.rs` 最终响应分支仍未消费 Stop | **partial executor / known-gap loop P0**：完整 tool-runtime 522/522、消费者 check 与 contracts 已过；仍须实现实际 Loop 阻止/续跑/终止、持久 HookPrompt、来源识别、取消与防递归，不能据 parser/配置存在标完成 |
| T01 | `core/src/tools/{router,registry,parallel,orchestrator}.rs` 及 `runtimes/` 的路由、并发、审批与 sandbox 重试 | `tool-runtime`、provider step snapshot、App Server reverse requests 已存在；R15–R20 仍有实际平台证据义务 | **partial P0**：工具规范及真正执行/输出回填/权限拒绝/进程 drain，不能按工具数宣称等价 |
| T02 | `core/src/tools/handlers/{get_context_remaining,new_context_window}.rs`，由 `tools/spec_plan.rs` 条件注册；前者返回真实预算（unknown 保留），后者请求无摘要新窗口并尊重禁用 | current Rust crate 搜索未找到对应工具实现，只有测试函数名匹配；尚需按上游注册 gate 确认 Lime 应开放的模式 | **known-gap / gated P1**：在对应模式贯通预算 owner、新窗口持久化和工具回填；不得暴露永远 unknown 或仅改 UI 百分比的空工具 |
| E01 | `core/src/hook_runtime.rs` 的 SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Stop/PreCompact/PostCompact；skills/MCP/plugin 为 runtime 输入 | `provider_turn/hook_snapshot.rs` 已把工具执行接 hook gate；C01 已实现压缩模型请求，Pre/PostCompact 生命周期 gate 仍缺 | **partial P1**：按每个 hook 的阻止/继续/上下文语义核对；Skills/MCP/plugin roots、优先级及 reload 继续挂 S09 |
| H01 | runtime harness：`core/src/session/{turn_context,step_context}.rs` 的 Turn grants 与每次 sampling 的不可变 settings/model/environment/MCP/tool/AGENTS snapshot；`ext/extension-api/src/registry.rs` 的 prompt/input/tool/lifecycle contributors | `runtime_backend/request_context` 组装配置、指令和预算；`agent-runtime` step snapshot、`tool-runtime` 权限/Hook 已有，但未完成每次请求的一致性与优先级对账 | **unverified P0**：同一次请求的模型、指令、环境、工具、MCP 和授权来自同一 snapshot；配置热更只影响后续 step，旧执行不能借新授权；harness 不仅指测试脚本 |
| H02 | verification harness：`core/tests/suite`、`app-server/tests/suite/v2` 的可控 provider、结构化请求捕获、故障与重启验证 | current fixture 与 GUI smoke 已有，但之前通过的其他切片不证明 C01/M01/C02 | **in-progress P0**：每项缺口绑定可复现 request/event/history 断言，追加真实 stdio；GUI/CLI/TUI 分别证明 host，不以单元测试数量替代 |

### 分阶段交付与本轮写集

1. **K0 / 事实校准**：完成六轴矩阵，逐项区分 confirmed gap / partial / unknown；旧排除不能自动沿用。
2. **K1 / Context（当前）**：先 C01 模型摘要与持久窗口，再 C02 同 Turn 压缩和 C03 规范历史、世界状态；删除事件摘录“摘要”生产路径。
3. **K2 / Memory**：M01 模型提取和整合、任务 lease/backoff，再 M02 引用/使用反馈；与会话上下文窗口分离。
4. **K3 / Loop 与 Tools**：L01/T01 逐退出、重试、权限、并发、输出和恢复分支核对与补齐。
5. **K4 / Extensions 与 harness**：E01/H01/H02 贯通所有 core 行为；继续原插件清理和 LimeCore 合同，不创建第二 runtime。

本轮窄写集：`agent-runtime` 摘要执行模块、`agent` provider 接线、App Server
`context_compaction`/`session_control`/`ExecutionBackend` 对应实现、定向测试及本计划。
`runtime/session_lifecycle.rs`、`thread_read.rs`、`turn_execution.rs`、GUI、插件与
`internal/aiprompts/architecture.md` 已有并行修改，本轮保持只读。
现有 owner/依赖方向不变，摘要不引入平行 backend、不新增 public JSON-RPC 方法；
若后续 K2 改变 owner 或持久化架构，必须取得该架构文档的合并窗口并同步图。

K1 首片验收：规范 provider 历史含前窗口和工具结果 → 当前模型生成非空且完整摘要 →
唯一 durable compaction marker → 下一 Turn 和冷重开都消费同一 replacement history。
失败、取消、EOF、空输出不得提交 replacement；工具声明为空且不执行模型返回的工具调用。
验证从 owner integration / public JSON-RPC 起，随后固定产物真实 stdio 和 current fixture。
未实际执行的 Desktop/PTY/Windows/live 不算通过。整体分母仍未冻结，不报告虚构整体百分比。

当前 K1 Verification Contract：

- current owner/输入：App Server 操作队列、规范 provider history、当前 thread settings、共享
  route/capability/精确凭证；摘要执行沿现有 `app-server -> agent -> agent-runtime -> model-provider`。
- 用户结果：`thread/compact/start` 异步产生同一 Turn 的 contextCompaction Item 与终态；
  成功摘要推进唯一窗口并供下一 Turn/冷重开消费。EOF、length、filter、provider error、工具调用、
  空输出和取消不写成功 marker，Item/Turn 必须终结。
- 多模型合同：压缩/后续 sampling 与当前选择的 endpoint/protocol/model/credential 一致；
  跨协议只共享规范历史和文本摘要，不共享旧 `previous_response_id`。
- evidence：执行器 unit；public JSON-RPC + 四种 HTTP SSE adapter 的 lifecycle；同会话
  四协议切换；同一固定 binary 的真实 stdio 重启。Desktop、CLI/PTY 与 live 分别另验。
- 分类：模型摘要/共享路由为 `current`；原启发式摘要为 `dead/deleted`；MockBackend 和
  loopback HTTP provider 仅为显式 `test-only`；本片没有新增 `compat/deprecated` 或迁移。
- 结构：拆分 compaction operation/artifact/tests，各模块继续由既有 owner 持有；未引入
  public RPC、平行 runtime、provider registry 或 DB owner。architecture impact 为 minor，
  本轮未写入有并行改动的全局架构文件；不能据此声明重大架构改动已获确认。

### 本轮记录

- 2026-10-18：K0 首轮完成，C01/C02/M01 已定位；C03/M02/T01/E01/L01 的剩余分支继续核查。
- K1 首片：已接入规范 provider 历史→共享 route/精确凭证→无工具模型摘要→durable window；压缩任务开始消费取消令牌，并新增失败/取消的 Item 终态。原事件摘录摘要已删除，产物、调度、测试已拆分，最大文件 508 行。尚在编译和行为验证，不标完成。
- 原始直接 `cargo test` 未使用仓库 V8 配套环境，依赖构建因 denoland V8 150.4.0 archive 404 失败；已改用 `test:rust:unit` / `test:rust:integration` 的仓库 artifact resolver 重跑。失败日志保留于 `/tmp/lime-core-context-{runtime,app-server}-tests.log`，不计产品失败或通过。
- C01 首片仍不包含 Codex remote compact V2、stream retry/overflow 降窗、Pre/PostCompact hooks、usage attribution、同 Turn compaction 与完整尾窗口策略，分别继续挂 C01/C02/C03/E01；不能用模型请求接通宣称整个 Context 已对齐。
- `agent-runtime` 摘要执行器 3/3 通过（包含预取消不得新发请求、pending stream 取消、完整非空响应和不完整输出拒绝）；首次定向运行发现预取消仍构造 provider request，已在入口检查 token 后回归通过。日志 `/tmp/lime-core-context-runtime-tests-final.log`。
- `test:contracts` 已 exit 0，日志 `/tmp/lime-core-context-contracts.log`。集成 runner 的 `--tests` 会扩大编译范围，已停止本轮该进程，改用同一 V8 artifact resolver 的精确 Cargo `--test` target；不是通过。随后修复新测试模块 path 与 v2 常量导入的编译问题，当前集成仍待终态。
- 压缩 Item identity 修复：原 ID 依赖成功窗口编号，失败后再次尝试会覆盖前一 Item；现改为每次尝试独立 ID，started/failed/interrupted/completed 和 artifact 共用该 ID，成功窗口编号仍只在成功后推进。四协议 lifecycle 补充失败/取消 Item 各留在原 Turn 的断言；输入历史组装失败也进入受控终态。
- 首次 App Server 定向 unit 为 29/31：两处旧断言仍要求启发式事件摘录，已改为显式测试 backend 的模型摘要合同并重跑，不能把首次结果算通过。`docs:boundary` 已通过。最终 unit、四协议 integration、真实 stdio 及 current fixture 仍待终态。
- REA 复用同一 Desktop parent 的 4-module page 再次遇到 transport 预算限制，返回 view `ev_ae40de94208672a34b9bf0a69049fccf63a74f0df212b0de2abcdf386ae6a91f`；不把未读 payload 算证据。随后导出请求在 300 秒超时，未取得 `/tmp/lime-codex-context-rea-evidence-20261018.json` 成功产物；本轮没有新增 Desktop 运行行为结论。
- C02 下一刀的源码触发点已复核：`session/turn.rs:659` 的 `should_roll_over` 要求还有 continuation，工具结果回填后检查预算，再由 `run_auto_compact` 成功替换历史并继续同一 Turn。Lime 对应点为 `agent-runtime/provider_turn.rs` 的工具结果加入 `initial_messages` 后、下一 sampling 前；后续必须把替换历史与 durable window 接回 App Server owner，不能仅在 loop 局部改消息而使冷重开恢复旧窗口，也不能调用会取消当前 Turn 的手动 compaction operation。
- 最终源码的 App Server 定向 unit **31/31 通过**，日志 `/tmp/lime-core-context-app-server-unit-final.log`。首次四协议 integration 为 3/9：Chat/Anthropic SSE fixture 缺少真实协议必填字段，已按 current protocol 修正；stdio 后台 catalog GET 探测原使采样 fixture panic，现明确返回 404，保持手动模型配置为测试前提，不伪造 catalog 成功。
- 四协议测试还定位生产阻塞：compaction task 未登记共享 `RuntimeTurnDriverCompletions`，公共 `turn/interrupt` 返回 `active runtime turn is missing its driver completion`。最小可见性补丁已写 `/tmp/lime-compaction-driver-visibility-proposal.patch`；因 `turn_execution.rs` 处于其他改动写集，依并行协作规则已请求合并窗口，尚未应用。取消场景不能标通过；先重跑不依赖该补丁的切换/stdio/fork 场景。
- current fixture 聚合首次在已有 trace collector 的 5000ms 超时处失败，真实 Electron 子场景尚未执行；此前历史 31、流式终态 34、消息终态 3 项通过，guard 299 通过/1 超时。该 guard 单独复核 **69/69 通过**（`/tmp/lime-core-context-trace-guard-recheck.log`），未改超时或断言，聚合已重跑。首次日志 `/tmp/lime-core-context-current-fixture.log`，不能算 Desktop Gate B。
- SSE/catalog fixture 修复后，精确 `thread_compact_jsonrpc` 重跑 **5/5 通过**，其中包括同一 Thread 的四协议切换、固定二进制真实 stdio 进程退出/重启和持久历史恢复；本次明确过滤 4 个待 driver 修复的取消 lifecycle，不能记为 9/9。固定 App Server SHA256 `0b07966b237a9c8501d80e58aa0a6636a31a29ba03972a4a9c99f001c750bd94`，日志 `/tmp/lime-core-context-app-server-tests-wire-recheck.log`；上游 HTTP 为 loopback 可控 SSE fixture，不是 live provider。该证据不含 `lime exec`、PTY、Electron 或 Windows。
- 同一精确 Cargo 命令中的 `thread_fork_compaction_jsonrpc` **1/1 通过**，证明压缩 replacement + surviving tail 的 fork/冷重开；该命令最终 exit 0。current fixture 聚合重跑的全部四组前置测试通过（31+34+3+300），并通过版本一致性 1.161.0；其下游默认 evidenceDir 仍是 `.lime/qc`，为遵守本轮只写 `/tmp` 的证据边界，已在真实 Electron 子场景开始前停止本轮聚合进程（exit 130）。未修改 runner 或放宽断言，没有恢复 `.lime/qc`；完整聚合、GUI smoke 和 Desktop Gate B 均未通过/未取得，不能用前置测试替代。
- 本轮收尾分类：current 为模型摘要和共享 route/窗口链；原启发式生产摘要为 dead/deleted；HTTP SSE 与 MockBackend 摘要仅为 test-only；没有新增 compat/deprecated 或迁移。关键剩余项为 C01 公共取消接线及其 4 个 lifecycle 回归、C02 同 Turn 压缩和 C03 完整历史策略。整体验收分母尚未冻结，不填虚构总体百分比；本轮未执行 `verify:local`、完整 GUI/CLI/TUI/Windows/live，当前状态仍为 active。

### C03 / 工具历史规范化（2026-10-18，当前切片）

- 上轮归类：progress，完成 31 项 App Server unit、四协议切换/真实 stdio/fork 证据并定位取消阻塞。C01 driver 可见性补丁仍待共享文件合并窗口，不将自动 goal continuation 视为该确认。
- Codex `context_manager/normalize.rs:ensure_call_outputs_present/remove_orphan_outputs` 在每次 `History::for_prompt` 前执行：保留调用、为缺失结果合成 prompt-only `aborted`，移除无调用的结果；raw function/custom/tool-search/local-shell 按各自 family 匹配。合成 raw Item ID 由固定 namespace + 源 Item ID 的 UUID v5 派生，避免重试/恢复时破坏缓存前缀。server tool-search output 可独立存在。
- 已确认 Lime gap：`provider_history` 直接拼接 canonical call/result；`model-provider/safety.rs` 的旧 projection normalizer 只有自身测试引用、无生产消费者，且其丢弃无结果调用的语义不等于 Codex。活动 `thread/inject_items` 又可在 loop 中进入，故规范化唯一 owner 放在既有 `agent-runtime`，普通 sampling 和 context summary 在请求边界共同消费。
- 窄写集：`agent-runtime/src/context_history{.rs,/}`、`lib.rs`、`provider_turn.rs` 的调用点及测试声明、`context_compaction.rs` 的调用点及测试；其 crate manifest 的 UUID v5 feature 和 Rust lock；无消费者旧 normalizer 的 `model-provider/safety{.rs,/tests.rs}`；App Server 定向 request-capture fixture 与本计划。`turn_execution.rs`、`thread_read.rs`、GUI、插件、全局 architecture 继续只读。
- Verification Contract：输入为规范 provider messages（含 raw response items）；输出保留有效 call/result 和媒体/扩展 payload，为缺失输出补 aborted，移除 orphan，重复规范化不增生；原消息和 durable canonical log 不被改写。每次 sampling（含活动注入、empty-response retry）和模型摘要都必须走同一 helper；HTTP request capture/冷重开证明真实生产消费者，不用单测代替 stdio/GUI。
- 文件规模退出条件：`provider_turn.rs` 已超过 1000 行，本切片只加 helper 调用，所有规范化业务逻辑和新行为测试拆到独立模块；不继续堆叠 loop 业务。依赖不更新版本，仅在 `agent-runtime` 启用现有 UUID crate 的 v5 feature并同步 lock，验证 app-version。owner/依赖方向沿原 `agent-runtime -> model-provider`，没有新增 backend、持久化 owner、RPC 或迁移；架构影响为 minor。
- 退出条件：定向 unit + loop/summary 接线验证通过，公开 JSON-RPC 触发的真实 HTTP 捕获能证明规范化及冷重开；旧 helper/测试正向语义删除；contracts、app-version、docs 与 diff 检查通过。媒体 capability stripping、预算/裁剪、world-state 重注入和完整 Context 仍另行核对，不能用本片标 C03 全部完成。
- 实施中：新增 `context_history{.rs,/raw.rs}`，普通 sampling（包括 retry/活动注入）与模型摘要共同消费；按 function/custom/search family 配对，raw local shell 复用 function 输出，保留 server search 与有效媒体/扩展。UUID v5 feature 同步引入锁文件 `sha1_smol`，无版本升级。旧 safety projection normalizer 与 5 项过期正向测试已删除，未新增兼容包装。
- 验证夹具：`provider_turn/tests/context_history.rs` 捕获 empty-response retry 的两次请求且要求工具执行事件为零；`context_compaction/tests.rs` 捕获摘要请求；`thread_compact_jsonrpc/{history,history_protocols}.rs` 从公共 RPC 进入真实 HTTP SSE，覆盖 raw 注入/冷重开/摘要、活动同 Turn 注入，以及四协议 canonical 恢复；持久化断言要求只保留原始记录，不能写虚假工具完成。夹具不是 live provider、stdio、CLI/TUI 或 Electron 证据。
- REA 后续：同一 parent 的 modules page 从 4 缩为 1 仍超 transport（至少 10,555,768 bytes），保留 view `ev_e022fccda2cf66f13832c7665e4fc23c0ad1a37467094abe5018f71bb23323c0`；未取得新增可读 Desktop 行为，不重复相同失败调用。当前工具历史语义仍由 Codex 源码证明。
- 静态门禁结果：`test:contracts`、`verify:app-version`、`governance:legacy-report`、本片 rustfmt 与 diff check 均 exit 0。测试与 source checkpoint 均写 `/tmp`，未恢复 `.lime/qc`。
- 首片定位的校验缺口：Codex `protocol/src/models.rs::ResponseItem::FunctionCallOutput` 的 `call_id` 可空，并可携带 `name`/`namespace`；当时 Lime 的 union 仍要求字符串 `call_id`，normalizer 单测不代表公共注入已支持。该缺口已由下文命名外部工具结果切片直接修正，并补公共入口/持久化/真实 provider 请求回归。
- 定向首轮结果：`agent-runtime --lib context_` 15/15 通过（其中新 normalizer 5 项、loop 接线 1 项、摘要 4 项），随后完整 `agent-runtime` 223/223、`model-provider` 263/263 均通过。`test:contracts` 已 exit 0；新 stdio fixture 从同一构建二进制拷贝固定产物，经 initialize/initialized、注入、sampling、进程退出/重启与摘要，不提升为 CLI/TUI 或 Electron 验收。
- C02 下一刀校准：`session_loop/input_queue.rs::request_context_rollover/capture_step_context` 仅设置请求标记并推进 step 的 `context_epoch`，现有 unit 不证明已执行 compaction。Codex `session/turn.rs:should_roll_over` 在工具/后续采样前运行 `run_auto_compact(MidTurn)`。Lime 必须把模型摘要成功后的 durable replacement 接回同一 Turn，并使失败/取消不提前推进窗口；不能借用会中断 active Turn 的手动 `thread/compact/start`，也不能以 `context_epoch` unit 宣称 C02 完成。

### C03 / 工具配对切片验收记录

- 当前行为与结构：每次 sampling/summary 从同一 `context_history` owner 生成模型可见副本；工具调用保留，缺结果补 prompt-only aborted；function/custom/search 分 family，server search 独立输出保留；raw 合成输出使用既有 raw-item 通道，避免 Responses tool-role lowering 过滤。没有新增后端、RPC、迁移、兼容包装或第二套 provider 规则。
- 清理分类：上述规范化模块为 `current`；`model-provider/safety.rs` 无消费者旧 projection normalizer、5 个 projection 类型、5 项过期正向测试为 `dead/deleted`；HTTP SSE、canonical 不完整历史和 stdio provisioning 为 `test-only`；无新增 `compat/deprecated`。
- 验证：`cargo test --manifest-path "lime-rs/Cargo.toml" -p agent-runtime -p model-provider --lib --no-fail-fast` exit 0，分别 223/223、263/263；`cargo test --manifest-path "lime-rs/Cargo.toml" -p app-server --test thread_compact_jsonrpc history --no-fail-fast` exit 0，8/8。两命令均经 `resolveRustyV8CargoEnv` 注入仓库既有 V8 artifact，未变更全局环境。
- 证据：`/tmp/lime-context-history-unit{,-full}.log`、`/tmp/lime-context-history-jsonrpc.log`、`/tmp/lime-context-history-{contracts,version,governance}.log`、`/tmp/lime-context-history-source-checkpoint.json`。本次 App Server binary SHA-256 为 `8205e45c5ea38cbe88bad6d8ff39070eed7101a6b2920612584f1cceb48ec9d5`；stdio 先复制同一二进制，再执行真实 initialize/initialized、采样、关闭/重启与摘要。没有使用 stale binary override。
- 边界：四协议 canonical fixture、Responses raw 冷重开/活动注入/摘要共 6 个 public RPC + HTTP 场景；另 2 个为真实 stdio 进程边界。媒体原样保留只在独立 normalizer unit 验证，HTTP fixture 使用声明支持的文本和结构化文本结果，未以 text-only 模型承诺图片能力；Azure/Vertex、live provider、Windows、CLI 和 PTY 仍未验证。
- Desktop current fixture：`cancel-then-continue` exit 0，证据 `/tmp/lime-context-history-gui-evidence/context-history-summary.json`，run=`standalone-context-history`，`Gate B controlled fixture`。真实 Electron/preload、115 次 `app_server_handle_json_lines`、当前 `turn/start`/`turn/interrupt`/`thread/read`、同 session 的取消/继续、read model 和可见状态均通过；legacy/mock fallback、页面错误/崩溃均为 0，正常退出与临时环境清理通过。backend 为显式 external/test-only，绕过生产 provider/tool executor，不证明 GUI 实际执行了本片 normalizer；其生产模型消费由前述 HTTP/stdio 证明。首次 fixture 卡在启动前 cargo metadata，已仅终止自己的进程（143）；随后通过 `APP_SERVER_BIN` 指向刚构建并核验的二进制重跑通过，未手动设置 build-ready 跳过前端校验。日志 `/tmp/lime-context-history-gui-fixture{,-fixed-bin}.log`。 Desktop 启动沿既有 `ensureElectronAppServerRuntimeBinary -> ensureMacBinaryRpath` 准备 macOS 产物；准备后 SHA-256 为 `74ed3a272977bcf22ab393b27a6af84e8c9e52023e80e36ed90423a0e5e12b11`，与 stdio 测试前的原始产物摘要分别记录，不混称相同 digest。
- 本片行为/结构/清理完成度：100%（仅限本节工具配对合同）；声明的 Rust/App Server/stdio 验证为 8/8 + 486/486，定向 Desktop controlled fixture 为 1/1。整体 C03 仍为 partial；整个核心对齐分母未冻结，不填总体百分比。聚合 `smoke:agent-runtime-current-fixture` 无证据目录参数，本轮未整体重跑；默认 `verify:gui-smoke`、`verify:local`、完整 CLI/TUI/Windows/live 未执行。本轮验证 current 工作树但不接管其他 GUI/插件改动，也不声明全仓发布门禁完成。
- 避让写集：`turn_execution.rs`、`thread_read.rs`、`session_lifecycle.rs`、GUI、插件、全局 `architecture.md` 及相邻未知未跟踪产物保持只读。架构影响 minor，现有 owner 和依赖方向不变；root 已核对，无重大架构图变更。
- 下一刀继续 Codex 主线：C01 取消 driver 的共享文件合并窗口；C02 同 Turn 压缩；C03 外部命名结果/媒体/预算/world-state；M01 模型记忆流水线与 L02 Stop hook 仍未关闭。插件、tar.gz、LimeCore 范围没有取消，grok 仍仅参考多模型。

### C03 命名外部工具结果合同（2026-10-18，本片完成）

- 主对标仍为 Codex。已直接读取 `protocol/src/models.rs:1173` 的 `ResponseItem::FunctionCallOutput`：`call_id`、`name`、`namespace` 均为可选字段。`ResponseInputItem::FunctionCallOutput` 的必填 ID 不适用于 history-only `thread/inject_items`。缺 ID 的结果不参与 call/result 配对；不生成假调用或假完成。
- 写集限定 `agent-protocol/src/response_item.rs` 和新 `response_item/tests.rs`、本进程既有 `thread_compact_jsonrpc/history.rs`、原来干净的 `thread_inject_items_jsonrpc.rs` 及本计划。直接修正唯一校验 union；App Server 继续校验后持久化原始 JSON，普通采样和模型摘要共用 C03 normalizer。
- `ThreadInjectItemsParams.items` 在 Rust schema、typed clients 和 Host 通道一直为 JSON values；本片不改变 envelope、方法或 JSON schema，不新建平行 DTO/转换层。退出条件为命名结果通过公共入口、原始字段/缺失/null 状态在 durable log 与 Responses 请求中保持、冷重开与同 Turn 注入/摘要不丢失；非法字段和远程图片仍拒绝。
- 多模型边界保持：原始 Responses item 仅在支持它的路由消费，不将 provider opaque state 盲转为四协议共享内容。四协议 canonical 工具历史测试继续作为独立回归；不据 Responses 命名结果宣称跨协议转换已实现。
- C02 只读接线结论：`provider_turn` 的工具回填后需异步获得 App Server durable window 提交 ACK，再替换活动 history 并推进 epoch；`AgentEvent` 同步回调/host channel 不能充当持久化确认。现有手动 `compact_session_now` 会取消活动 Turn 并新建压缩 Turn，不可复用为同 Turn 行为。所需共享写点为 `turn_execution.rs` 的 `ExecutionRequest`/sink 装配以及既有 `AgentSessionConfig` 承载；继续避让其它进程的 Turn/恢复/GUI/插件/architecture 热区，不把本片标成 C02 完成。
- 验证：新增 `response_item` 定向 unit 3/3 通过；同一编译产物的完整协议库测试 46/46 通过（3 项已包含，不能重复相加）。`thread_compact_jsonrpc history` 8/8、`thread_inject_items_jsonrpc` 2/2 均 exit 0；前者包含四协议 canonical 历史，以及 Responses 原始命名结果的活动注入/冷重开/模型摘要和真实 stdio 进程重启。后者补非法 namespace、缺 output 和命名远程图片的公共入口拒绝。`test:contracts`、定向 rustfmt、diff check 均 exit 0，生成类型无漂移；7 个本片与 Codex 源文件摘要在验收时无漂移。
- 证据：`/tmp/lime-context-external-result-{unit,protocol-full,jsonrpc-history,contracts}.log`、`/tmp/lime-context-external-result-source-checkpoint.json`。首次集成命令误选整个 compact target，已在等待构建锁时只停止自己的 Cargo（exit 1），随后以 `history` 过滤重跑；首次不计通过，已知 C01 取消 driver 场景没有被本片关闭。
- Desktop REA：原整包 parent 的 `modules` page offset 16/limit 1 仍超 10 MiB，保留 view `ev_f1653eba2a9b26848b7e1795c5c7f148b9f7ca4ba8ea6c7dc855571a8ec6c119`，不重复同输入。改为从同一 ASAR 提取两份原始模块（共 172656 bytes），ASAR SHA 仍为 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`；提取清单与模块 SHA 在 `/tmp/lime-context-external-result-rea-extraction.json`。REA parent `ev_a2581e7d24c79624652e0f10e031d873253f5ee5ff21788e160bf709fa046079` 成功解析 2 文件、零 parse failure，但 semantic graph 触及 100000 节点上限，为 partial。再收窄到原始 `.vite/build/conversation-turn-mutations-szl89rld.js`，SHA `116870fb4aa77e0d56a9c1aef70b7c6b21a7ea30ef5b601a6d2a7cb7b719c3ec`；parent `ev_83540c1cd6213bb97133356f8dfe9fab0b18e0b2133d8484a545de841ca35a13` 无节点裁剪，语义仍有 2990 unknown。两次 `contextCompaction` 语义 trace 为 partial/零匹配（后次 `ev_ebc991fe411687425e9b74a9bc3099e4f40311a9aac3ff357435afbedafd97d8`），不能据此判定能力缺失或完整行为。完整返回的 summary/trace 保留 `/tmp/lime-context-external-result-rea-{summary,mutations-summary,mutations-trace}.json`；本片不新增 Desktop 运行结论，工具结果语义仍由 Codex CLI 源码和 Lime HTTP/stdio 证明。
- 分类与完成度：校验 union/既有注入、历史、摘要主链为 `current`；新增夹具为 `test-only`；无新增 compat/deprecated、迁移、双读写或新后端，本片无需删除其它实现。命名外部结果行为/结构合同完成度 100%，整体 C03 仍 partial，核心总分母未冻结，不填虚构总体百分比。没有 GUI/Host 代码变化，未重复上一片 Desktop controlled fixture；本片不声明 GUI、`lime exec`、PTY、Windows、live、Azure/Vertex 或 `verify:local` 全仓验收通过。
- 架构影响 minor：owner 与依赖方向不变，root 已核对，无重大架构图变更。避让写集仍为 Turn/恢复/GUI/插件/architecture 热区；下一刀由本进程继续 C03 媒体/预算核对及 C02 共享入口接线，插件、tar.gz、LimeCore 范围保持；整体核心对齐仍 active。

### L02 / Stop 输入、裁决与管道执行（2026-10-18，首片已验证，Loop 未完成）

- 主目标不变：Codex CLI/runtime 直接读源码，Desktop 复用 REA 安装包证据；grok 仅参考多模型。C01/C02 的共享 Turn 装配文件仍待合并窗口，本片先补 L02 执行器，不将配置枚举或 parser 通过当作 Loop 对齐完成。
- 窄写集：`tool-runtime/src/hook_lifecycle{.rs,/stop.rs}`、`hook_gated_executor.rs` 的 context literal、`hook_runtime{.rs,/stop.rs,/stop/tests.rs,/tests.rs}` 和本计划。Turn/恢复/GUI/插件/architecture 热区继续只读；没有新 public RPC、crate、持久化 owner 或迁移。
- Codex 事实源：`hooks/src/schema.rs` 的 Stop/SubagentStop 输入与输出；`events/stop.rs:parse_completed`、`engine/mod.rs:ConfiguredHandler::can_apply_control_effects`、`engine/dispatcher.rs:select_handlers_for_matcher_inputs`；`core/src/session/turn.rs:720`、`core/src/hook_runtime.rs:run_turn_stop_hooks`。
- Verification Contract：current owner 是既有 CommandHookReporter。输入必须含 canonical thread/turn、当前模型/权限、nullable transcript/last message、stop_hook_active；SubagentStop 另有 agent ID/type/transcript，不夹带工具字段。失败缺上下文不启动命令；真实命令 stdin、report、Started/Completed 和裁决 ID 关联同一 invocation。
- 裁决：只有同步 Hook 能 block/stop；exit 2 必须有非空 stderr，JSON block 必须有非空 reason；`continue:false` 优先且缺 stopReason 不造默认文案；执行/JSON 失败是 Failed，不变成续跑反馈。Stop 不消费工具 additionalContext/updatedInput；systemMessage 记录 Warning。根 Stop 忽略 matcher，SubagentStop 按 agent_type 匹配。
- Lime 适配：`processor/v2_notifications/hook.rs` 按 `run.id` 去重 Started/Completed，故重复 Stop 必须保留每次 invocation 的独立后缀；执行器与 evaluation 共用同一 ID 算法，避免重复续跑被通知层吞掉。不是复制 Codex minified 名称，也不新增平行 lifecycle owner。
- 结构：Stop 专用输入/输出拆成小模块；既有 270 行内联测试机械迁至 `hook_runtime/tests.rs`，避免继续扩大原 773 行执行器。owner/依赖方向不变，架构影响 minor；root 已确认，无重大架构图变更。
- 本片退出条件：执行器真实命令/生命周期集成、裁决边界回归和受影响 owner 测试通过；定向格式与文档检查通过。实际 Loop Stop 消费、canonical root/child/internal 来源、持久 HookPrompt、取消与防递归后续仍须贯通，L02 保持未完成。
- 首次 Hook 领域定向 `cargo test -p tool-runtime --lib hook_` **41/41 通过**，包含 9 项新增 Stop 单元/真实子进程与生命周期场景；日志 `/tmp/lime-stop-hooks-domain.log`。`test:rust:related` 继续编译 7 个 owner/反向依赖，`test:contracts` 已确认生成协议无漂移，终态待记录；不提前计为通过。
- 后续直接读取 Codex `engine/command_runner.rs:276` 与 `command_runner_tests.rs:263/297`，确认 Lime 另有真实执行缺口：stdin 在 timeout 外串行写入，写满 pipe 时无法超时，也无法同时 drain stdout/stderr；提前退出的 Hook BrokenPipe 会丢失有效输出。已将 stdin/write 和 wait/output 放在同一 deadline 下 `try_join`，BrokenPipe 不覆盖真实退出结果。为验证最终代码，停止了本进程原 related Cargo（尚处 App Server 编译阶段、exit 1，无测试通过结论）；最终改用完整 owner 测试与消费者编译验证，不冒充 7 crate related 全过。
- 同轮对齐 `NullableString::from_path` 的 display string 与 `output_parser::parse_json` 的 JSON object→wire 两阶段校验。新增 1 MiB 不读 stdin 的快速退出、双输出 pipe drain/输入阻塞超时、非 UTF-8 路径三项回归；后两项是 Unix/macOS 范围，Windows 真实进程证据仍须独立取得。进程树取消清理与 Started 的取消终态没有被本片关闭，继续归 L02 后续。
- 最终完整 `tool-runtime --lib` **522/522 通过**（包含 12 项 Stop 输入/裁决/真实命令与生命周期测试），日志 `/tmp/lime-stop-hooks-owner-final.log`。`test:contracts` 已 exit 0（`/tmp/lime-stop-hooks-contracts.log`）；9 个 Codex 源文件和 Desktop ASAR SHA 均复核未漂移。消费者 `cargo check -p agent-runtime -p lime-agent -p app-server` 正在执行；最终文档/格式/摘要复核待记录。
- 最终消费者 `cargo check -p agent-runtime -p lime-agent -p app-server` **exit 0**，日志 `/tmp/lime-stop-hooks-consumers-check.log`；定向 rustfmt、scoped diff 与 docs boundary 通过。收尾再核对 `events/common.rs:matches_matcher` 与 `engine/matcher.rs:HookMatcher`，确认沿用的 exact/alternation/regex matcher 合同一致；参考源摘要清单扩至 11 文件，记录 `/tmp/lime-stop-hooks-source-checkpoint.json`。不重新执行已经通过的 contracts 或扩大到全仓测试。
- 分类与完成度：既有 `tool-runtime` 为唯一 `current` owner，Stop 借用工具输入/通用裁决的路径已直接替换；无新增 compat/deprecated、迁移或后端。输入、裁决、同步管道 I/O 这 3 项本片合同 **3/3，100%**；这不是 L02 整体完成度。现有 controlled GUI fixture 绕过生产 Hook 执行器，故本片不将其作为 Stop 证据；没有新增 public RPC、Host、GUI 或 Loop 接线，未跑 GUI/CLI/PTY/Windows/live、Azure/Vertex 或 `verify:local`。不进入全仓 release evidence。
- 下一刀仍是生产 Loop：保留同一不可变 step Hook snapshot，按 AgentGraph 识别 root/ThreadSpawn/internal 来源；将 XML-escaped、user-role HookPrompt 通过 canonical owner 持久提交后再同 Turn 续跑，补取消终态与 Memory 防递归。不得把 `forked_from_thread_id` 当 ThreadSpawn，也不得使用 developer-only 队列代替 HookPrompt 的 durable ACK。所需 Turn/协议/恢复/GUI 热区继续依共享写集规则协调，本进程不夹写。插件、tar.gz、LimeCore 范围不取消。
- Desktop REA 补查：复用原两模块 parent 的 `hookPrompt` literal trace（`ev_c3aba915577df7b23486eca48bfabb10e523925d9159aa8d30f900b73570e939`）与 semantic trace（`ev_d57a859ea6415db8a75411fe4d1b352d352c2fa445505d454b8483e87322a2f5`）均零匹配，后者 partial，不能作为缺失证据。随后只分析同一 ASAR 原始 `execution-fde3a4937b6a.js`（119857 bytes、SHA `5c300497b7331bfa317231251e1097385405b70f2746b1fe8959c74e56735811`），parent `ev_961bb054a031f73fa6c600cc84e98e6a6c41ddee0adc1c2bdbbb02701e54689c` 零 parse failure，semantic 仍触及 100000 节点上限。
- 为明确覆盖边界，从该原始模块按 AST 提取 `[79517,81522)` 的 2005-byte 原字节函数片段（SHA `855a473ada87be2263e3e7411027e4fafae07889f8ade9faa56cbb1d6b84937e`），含 `hookPrompt`→`type/id/fragmentCount` 的静态返回分支。片段 REA parent `ev_f84c800b746671dee842fa2d067bff922ddb081b8f5f0181b6f848e143ff3d6f` 无裁剪/parse failure，但有 108 unknown；`hookPrompt` semantic seed 仍零匹配/partial（`ev_84f4d5391dff4ea5e786b423f5daa2c2c489b00d0192cf01e5aa45391793bfce`）。不把人工读到原字节的分支包装成 REA 已证明运行链路，也不把 minified 函数名当上游源符号。清单、summary/trace 均保留 `/tmp/lime-stop-hooks-rea-*.json`；没有新增 Desktop 运行行为结论。

### C03 工具文本历史裁剪（2026-10-18，本片完成；C03 整体 partial）

- 主对标是 Codex `context_manager/history.rs:record_item_with_metadata`、`utils/output-truncation`、`utils/string/truncate.rs` 和 `protocol::TruncationPolicy`；grok 不参与该行为裁决。
- 已确认断链：`ModelRequestPolicySnapshot.truncation_policy` 未进入 `RuntimeReplyModelRequestPolicy`；恢复投影固定 10KB，活动 Turn 直接回填完整工具结果。新模型的预算因此不能统一影响普通采样、重试和模型摘要。
- 窄写集：`agent-protocol/src/{lib.rs,truncation.rs}`；`model-provider/src/provider_stream{.rs,/tests.rs}`；`agent/src/model_request_policy{.rs,/tests.rs}`；`tool-runtime/src/tool_io{.rs,/tests.rs}` 和 `unified_exec/output.rs` 的类型引用；本进程已有 `agent-runtime/context_history`、`context_compaction`、`provider_turn` 及其定向测试；原先干净的 `app-server/runtime/provider_history{.rs,/canonical.rs}`；已有 `thread_compact_jsonrpc` 测试模块与本计划。避让 Turn 持久化、恢复投影、GUI、插件、全局 architecture 共享热区。
- Verification Contract：唯一内容预算类型归 `agent-protocol`；当前模型策略沿现有 harness→model request policy 传给普通采样和摘要。共享历史处理仅裁剪请求副本，保留完整 durable log、call/result identity、success/error 与媒体/opaque 字段。文本使用 Codex UTF-8 首尾保留和 20% serialization allowance；Tokens 是明确的 byte heuristic，不假定所有模型共享 OpenAI tokenizer。删除旧固定 10KB 投影裁剪与退役类型，无兼容包装。
- 本片退出条件：显式模型预算传递和不同策略的采样/摘要、同 Turn 工具后续采样/空回复重试、原始与结构化文本输出、四协议 HTTP capture 的冷恢复与摘要验证；相关 owner 测试、contracts、格式和文档检查通过。媒体/audio 的完整成本策略、每项持久 provenance 预算与 world-state 重注入仍属 C03 后续，不能将本片写为完整 Context 对齐。
- 架构影响 minor：复用协议、model policy、工具 I/O 与历史 owner，无新 crate、RPC、后端或存储。大文件只作最小接线/删除旧逻辑，新增处理与测试落独立模块；本轮 root 确认依赖方向不变，不宣称共享架构图的重大变更已确认。
- 验证预算 `budget:tight`，负责人 root，风险 P0。公开入口复用 `thread/start`、`thread/resume`、`turn/start`、`thread/inject_items` 和 `thread/compact/start`；结果消费由既有 provider request 和 canonical lifecycle 持有。没有新 Host 命令或 GUI 投影，新增行为的证据等级为 domain + App Server integration，通用 current fixture 只作为额外回归，不能代替 provider 采样证据。
- 源码摘要 `/tmp/lime-history-truncation-source-checkpoint.json` 记录本片 6 个 Codex 文件和后续 catalog/工具预算核对的 2 个文件；8 文件在收尾检查时均与 HEAD 一致，前 6 文件相对实施基线也无漂移。CLI 直接读源码；本片没有新增 Desktop 行为结论，不重复先前零匹配的 REA trace。
- 进一步定位到 catalog 边界：`ModelLimits` 尚无工具输出预算字段，`model_request_policy_value` 不将 `modelRegistry` 自动变成该策略；因此显式 harness 策略传递、默认裁剪、catalog per-model 配置与真实 model/provider 切换须分别记账。本片不凭独立策略测试宣称后两项已完成；后续应在既有 model catalog owner 内贯通，不能用 OpenAI 模型名猜预算或套用 context/output 总预算。
- 首次消费者 check 在编译第三方依赖时遇到缓存中的 `memchr` rmeta 缺失，exit 101；日志 `/tmp/lime-history-truncation-check.log`，不作为实现失败或通过证据。定向 owner 测试正在重新编译依赖；`test:contracts` 已 exit 0，日志 `/tmp/lime-history-truncation-contracts.log`。其余终态待记录。
- 工具 I/O 定向 14/14 通过；随后使用同一已编译测试产物复核完整 `tool-runtime`，**523/523 通过**，包含 unified exec、生命周期、权限、Hook 与新裁剪回归；14 项已包含，不重复累计。日志 `/tmp/lime-history-truncation-tool-owner-full.log`。runtime/agent 的定向测试与 current fixture 继续执行，尚不记整体通过。
- runtime 测试构建发现 5 处遗漏的构造器调用，均在原来干净的 `reply_backend/tests.rs` 与 `reply_session.rs` 测试块；本轮追加认领并仅补 `truncation: None` 对应参数。首次 owner 测试 exit 101，不计通过；修正后重跑日志 `/tmp/lime-history-truncation-runtime-final.log`。生产 App Server 构建已通过；这不替代 domain/API 测试。
- 修正后 `agent-runtime context_history` **9/9**、`context_compaction` **5/5**、`lime-agent model_request_policy` **21/21** 全部通过；前两组互不重叠。覆盖同 Turn 真实工具执行后的 continuation/空回复重试、不同显式 Bytes/Tokens 预算的摘要请求，以及只有裁剪策略时不激活 Responses 专属设置。日志 `/tmp/lime-history-truncation-runtime-final.log`，进程 exit 0。
- 公共 JSON-RPC + HTTP capture **5/5** 通过：Chat、Responses、Anthropic、Gemini 的 canonical 冷恢复/采样/摘要各一场景；Responses 原始命名结果从 `thread/inject_items` 进入、冷恢复、采样与摘要一场景。均断言 durable 原文不因裁剪而改变；四协议使用默认预算，原始 opaque/envelope 只覆盖 Responses，不能扩称跨协议 opaque 转换或真实 provider/model 切换。日志 `/tmp/lime-history-truncation-integration-tests.log`；该 runner 连同后续两组定向回归最终 exit 0。
- 聚合 `smoke:agent-runtime-current-fixture` 已完成前置 frontend fixture guards 和生产 sidecar 构建，但在第一个 unknown-item GUI 场景启动前卡在 `cargo metadata --no-deps`；仅停止本进程所属 npm/fixture/metadata，exit 143，不计聚合通过，也不沿用目录内早先的同名 summary。本轮新证据改存 `/tmp/lime-history-truncation-gui-evidence`，通过既有 `APP_SERVER_BIN` 使用刚构建的 packaged sidecar，重跑 unknown-item 与 cancel-then-continue；不手动设置 build-ready、不覆盖并行 GUI/fixture 源码。日志 `/tmp/lime-history-truncation-{current-fixture,gui-fixed-bin}.log`。
- 后续 catalog/预算合同按 Codex `session/step_settings_tests.rs:model_resolution_preserves_startup_overrides_and_instruction_provenance`、`tools/context.rs:ExecCommandToolOutput::model_output_policy` 校准：当前模型 catalog 与显式设置合成同一 step snapshot，工具请求上限取不超过模型预算的值；每项已含 allowance 的持久 override 不再重复放大。Lime 需在既有 `core/models/model_registry.rs:ModelLimits`、`runtime_backend/request_context` 与 model policy owner 补齐，单独验证同会话 provider/model 切换和冷重开；不能把总 context/output budget 当作工具预算。
- App Server `provider_history` 定向回归 **29/29** 通过，包含投影保留完整 inline 输出、历史 call/result 顺序和媒体恢复；它不替代前述真实 HTTP sampling 断言。独立 `model-provider provider_stream::tests` **60/60** 通过，包含 policy、wire support 和 trace 消费；runner exit 0。
- 定向 Desktop controlled fixture **2/2** 通过，进程 exit 0：unknown-item 与 cancel-then-continue 的 summary 分别为 `/tmp/lime-history-truncation-gui-evidence/history-truncation-{unknown-item,cancel-then-continue}-summary.json`；run ID 分别为 `standalone-history-truncation-unknown-item` / `standalone-history-truncation-cancel-then-continue`。真实 Electron/preload/current JSON-RPC/用户可见状态/read model 与正常退出均通过，`app_server_handle_json_lines` 命中分别为 64/105，legacy/mock fallback、page error/crash 均为 0。backend 为显式 external/test-only，绕过生产 provider/tool executor，不能据此宣称 GUI 实际执行了新裁剪，也不证明完整 harness snapshot。初次 packaged binary SHA 为 `9a858eb8d05759298cb60a8368e08cba6299708259ff2c02f9034fc437f64f71`；此次按 source freshness 重新构建 renderer/sidecar 后再跑，最终 SHA 为 `6960628697a6dfb051af06ca90516390753d48ea6ed07126db851beb97751343`，标准 GUI smoke 后复核相同，不混称初次 digest。
- `npm run verify:gui-smoke` **exit 0，24/24 断言通过**，run ID `history-truncation-20261018-gui`；日志 `/tmp/lime-history-truncation-gui-smoke.log`、summary `/tmp/lime-history-truncation-gui-smoke/summary.json`。证据等级 `Gate B-F`：真实 Electron 启动/renderer reload、preload/IPC、App Server JSON-RPC、Workbench、Memory 设置路由和三种尺寸布局；不证明 provider turn、Memory 模型流水线、打包发布产物或 Codex Desktop 像素一致。该命令已重新构建 renderer、Host 和 sidecar，并通过版本一致性检查。
- 结构与清理验收：唯一预算类型、模型 policy 和 `context_history` 请求视图为 `current`；原 `ToolOutputTruncationPolicy`、无用 token 二分 helper / `drain_max_bytes` 与固定恢复投影裁剪为 `dead/deleted`，源码/消费者/领域文档扫描无剩余引用。loopback HTTP 与 external backend 仅为 `test-only`；无新增 compat/deprecated、迁移或第二后端。采样/摘要共用裁剪，避免重复制定规则；owner 与依赖方向不变，架构影响 minor，root 已确认。
- 本片合同完成度 **4/4，100%**：显式策略进入 runtime、Codex UTF-8/allowance 文本预算、采样副本与 durable 原文分离、普通采样/重试/摘要共用处理；四协议 HTTP 与上述 Host 回归分别满足各自证据范围。22 个 scoped Rust 文件摘要在 `/tmp/lime-history-truncation-implementation-checkpoint.json`，包含未跟踪新文件的 whitespace 检查；本片格式、diff 与 docs boundary 最终结果见 `/tmp/lime-history-truncation-validation-summary.json`。整个 C03 仍 partial，核心对齐整体分母未冻结，不填虚构总体百分比；`verify:local`、CLI/TUI/PTY、Windows、live、Azure/Vertex 未运行，本片没有这些 host/platform/认证路径改动或证据，不作为全仓 release evidence。
- 下一刀：C03 catalog 预算与逐项 provenance、媒体成本；C01 公共取消 driver 与 C02 同 Turn durable ACK 继续等待既有共享 Turn 装配写集的合并窗口。Stop 生产 Loop、Memory 模型流水线、插件/tar.gz/LimeCore 范围继续保留。Turn/恢复/GUI/插件/全局 architecture 热区和相邻未知未跟踪产物保持避让；本片只认领上述明确文件与测试，不覆盖并行工作。

### C03 当前模型 catalog 工具预算（2026-10-18，本片已验证，C03 未完成）

- 主目标：Codex 为 runtime/harness 的唯一主对标；CLI 直接读取源码，Desktop 行为才使用 REA。grok 只参考多模型控制面，不决定本片预算语义。
- Codex 事实源：`models-manager/src/model_info.rs:with_config_overrides`、`core/src/session/step_settings.rs:resolve_model_info`、`protocol/src/openai_models.rs:ModelInfo`。工具预算是模型顶层字段，独立于 context/output 总量；每次按当前模型解析，显式配置覆盖 catalog，缺失使用 Bytes(10_000)。现有 Lime harness 的 typed mode/limit override 保留；Codex token-only 配置的完整配置入口不在本片伪称已对齐。
- 已确认缺口：后端 `EnhancedModelMetadata`、API/native catalog parser 丢失预算；策略先命中其他字段后遮住 catalog；renderer 的 `source:model_registry` 派生快照可能滞后于真实路由。
- 窄写集：`core/src/models/model_registry.rs` 的字段和初始化；`services/src/model_registry_service.rs` 的 DTO/转换接线与新 `model_registry_service/truncation_tests.rs`；既有 `agent/src/model_request_policy{.rs,/tests.rs}` 与新 `model_request_policy/truncation{.rs,_tests.rs}`；`app-server/src/runtime_backend/model_registry_metadata.rs` 的 direct config 字段接线；本进程持有的 `thread_compact_jsonrpc/{model.rs,model_fixture.rs}` 和新 catalog 预算测试；`src/lib/model/modelTruncationPolicy{.ts,.test.ts}` 的零预算修正；本计划。大文件只加必要字段/初始化/模块声明，新增算法和测试落小模块；本片退出条件是不向现有超限文件增加业务算法。
- 优先级合同：逐字段读取显式 harness 预算，再读取服务端当前 `config.modelRegistry` / `config.model_registry`（standalone metadata 可为顶层 registry）；`source:model_registry` 的客户端派生预算不作为 override。其他策略字段不能遮住预算。无声明不按模型名、协议、context/output 限额猜测；零预算有效。direct config 只提取 typed 预算，不复制凭证或任意 capabilities。
- Verification Contract（root，budget:normal，P0）：真实公共 `modelProvider/fetchModels` → 协议相应 catalog HTTP → credential/endpoint scoped cache → 当前 route → 同一 model policy → sampling/summary。验证同一会话四协议/model/provider 切换、不同 Bytes/Tokens/零预算、冷重开、durable 原文；单测覆盖 override、过期派生提示、字段合成和缺省。catalog HTTP 属 test-only，不访问 live provider。
- 架构影响 minor：沿既有 catalog/model policy/runtime owner，无新 crate、RPC、依赖或存储 owner；无需改公共 picker DTO。避让 GUI、插件、Turn/恢复持久化和全局 architecture 共享热区，不运行协作消息、不启动子 Agent。没有兼容层或迁移。
- 退出条件：受影响 catalog/策略 owner 单测、四协议公共 JSON-RPC + HTTP 集成、前端预算定向回归、contracts、格式与文档边界检查通过；Host 回归按实际变更选择。逐项持久 provenance、工具请求上限、媒体成本、C01/C02/Stop/Memory 和插件/tar.gz/LimeCore 总范围继续开放。
- 结构补充：认领 `core/src/models/model_registry/tests.rs`，仅机械移出既有两项测试，使 catalog 类型文件保持 1000 行以内；认领原 `history_truncation.rs` 的既有 canonical log seed helper 提取，供新测试复用，不复制事件构造规则。
- 真实入口首次验证暴露能力合成断链：catalog 只有推断提示时遮住同模型显式能力，`thread/start` 报 `capability_snapshot_missing`。追加认领原本干净的 `services/src/model_registry_service/runtime_metadata.rs`，复用既有 ProviderModelConfig capability 应用规则；只在缓存为 InferredHint 时补能力，不替换 catalog 预算，也不覆盖显式/canonical catalog 能力。规则的唯一 helper 供声明模型构造与解析共用，避免第二套判断。Gemini 测试修正为该已配置 `/v1` base 的实际 `/v1/models`，不改生产 URL 规则。
- 普通 `OpenaiResponse` 的标准 base 接入既有 OpenAI catalog parser；显式 `/responses`、`/codex` 和 Codex provider 的专用发现策略保持独立。依据 Codex `codex-api/src/endpoint/models.rs` 的独立 ModelsClient 和 `models-manager/src/manager.rs`，不将采样协议等同于 catalog 不可用。旧“普通 Responses 只用手填图片模型”测试已直接替换为 loopback HTTP 场景。缓存 taxonomy version 提升为 4，旧解析结果必须重新取 catalog；无数据迁移或兼容层。
- 验证进度：最终 `lime-agent model_request_policy` **28/28**、`lime-services model_registry_service` **84/84** 通过（含 native parser、cache scope、普通 Responses HTTP、能力合成 9 组合）；日志 `/tmp/lime-catalog-truncation-rust-final.log`。首次 service run 的旧图片模型断言失败与首次 HTTP 集成 **0/5** 已保留在 `/tmp/lime-catalog-truncation-{domain,integration}.log`，不计为通过；修正后的完整 App Server compaction fixture、direct metadata 和 core 测试终态待记录。
- 前端定向 **15/15**、`npm run test:contracts` **exit 0**；日志 `/tmp/lime-catalog-truncation-{frontend,contracts}.log`。源码参考清单 `/tmp/lime-catalog-truncation-source-checkpoint.json` 的 7 个 Codex 文件均匹配参考 HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`。本片无新增 Desktop 行为结论，不把普通源仓分析替换成反编译，也不将旧 REA trace 零匹配视为缺失证据。
- `npm run verify:gui-smoke` **exit 0，24/24**；run=`catalog-truncation-20261018-gui`，summary `/tmp/lime-catalog-truncation-gui-smoke/summary.json`，日志 `/tmp/lime-catalog-truncation-gui-smoke.log`。真实 Electron/preload/IPC/App Server JSON-RPC、reload、Workbench、Memory 设置路由与三尺寸布局为 Gate B-F；没有 provider Turn 或新预算执行证据，预算行为以真实 HTTP 集成为准。该 run 标准构建路径生成的 app-server 产物 SHA 为 `4cd391241dfce7745e602c409b1b1cb561a3919d069ccaa32036f6885a7ea448`，不等同打包发布或 Codex Desktop 像素一致。
- 第二次完整 compaction fixture 运行暴露两个独立缺口：原有取消场景命中 C01（`active runtime turn is missing its driver completion`）；新增预算场景在 `turn/start` 的 current model catalog 选择阶段再次被 InferredHint 遮住，报 `model_catalog_has_no_executable_selection`。追加认领原本干净的 `app-server/src/local_data_source/model_providers/catalog.rs` 一行接线，catalog picker 与 route metadata 共同消费 services 的同一 `merge_declared_capabilities`，不写第二套规则。完整 fixture 不记通过，预算场景修正后必须独立重跑；C01 属共享 Turn/取消热区，维持已记录未完成状态，不修改测试来掩盖失败。
- 最新定向预算 run 首次为 **4/5**，Responses 只有最终目录请求数断言失败；真实 sampling/summary 预算、路由和冷 resume 断言均已通过。定位到夹具把全部非 POST 当目录请求，也为 `/v1/responses` WebSocket 握手返回目录 JSON。已限定 `GET /v1/models`（允许 query），其它请求返回原 404；未放宽缓存断言、未修改生产缓存或 transport。依据 current client 的 `responses_websocket_url` / `send_responses_websocket` 复核该路径，最终重跑日志 `/tmp/lime-catalog-truncation-rust-final-v3.log`。
- 原完整 26 项 fixture 已 exit 101：**17 pass / 9 fail**，其中 5 项是修正前的 catalog 入口、4 项是 C01 公共取消 driver；不是最终预算实现的通过记录。第二次完整 GUI build 停止于 renderer 构建，exit 143，不计通过；最后仅 Rust 接线有变化，最终验证复用首轮已验证的 renderer，经标准 app-server asset 构建 fresh sidecar 后直接运行真实 Electron smoke，不设置 build-ready 或绕过 freshness。
- 最终 Rust run **exit 0**：catalog 四协议冷重开/同会话切换 **5/5**、history truncation **5/5**、runtime metadata **4/4**、route resolver **12/12**、provider catalog **16/16**、services registry **84/84**，合计 **126**；日志 `/tmp/lime-catalog-truncation-rust-final-v3.log`。加上此前最终策略 **28/28** 与 core 类型 **2/2**（对应源码摘要未漂移），本片受影响验证共 **156 项**，不重复累计旧 run。前端 15/15、contracts exit 0 保持有效，本片后续未改变这些边界。
- 最终 Host 回归：`npm run electron:build:app-server-assets` **exit 0**；随后 `LIME_GATE_RUN_ID=catalog-truncation-20261018-gui-final LIME_ELECTRON_SMOKE_EVIDENCE_DIR=/tmp/lime-catalog-truncation-gui-smoke-final node scripts/electron/smoke.mjs` **exit 0，24/24**。日志 `/tmp/lime-catalog-truncation-{sidecar-final,gui-smoke-final}.log`，summary `/tmp/lime-catalog-truncation-gui-smoke-final/summary.json`；最终 sidecar SHA `5be9b8252a9dce6e89eb623a629f6ba0737a7c26f00336f6a9aa98f79667ef52` 与 resource manifest 相同。renderer 复用首轮产物；证据仅为 Gate B-F 启动/重载/preload/IPC/JSON-RPC/Workbench/设置路由/三尺寸布局，不证明 GUI 执行新预算、provider Turn、完整 Memory、发布包或 Desktop 像素一致。
- 源码与结构检查：7 个 Codex 参考文件仍匹配记录 HEAD；17 个实现文件（15 Rust）摘要无漂移，定向 rustfmt、scoped diff、新文件 whitespace 已通过，清单 `/tmp/lime-catalog-truncation-implementation-checkpoint.json`。最终检查与证据汇总 `/tmp/lime-catalog-truncation-validation-summary.json`。TS `EnhancedModelMetadata.truncation_policy` 已有 typed consumer，本片补后端缺失字段；无新增 RPC、依赖、schema 方法或凭证透传。
- 分类与完成度：catalog、当前模型 policy、共享 capability merge 为唯一 `current`；HTTP 夹具为 `test-only`。普通 Responses 的目录禁用假设及旧“仅手填图片模型”断言已直接替换；无新增 compat/deprecated、迁移或平行后端，未恢复已删除 runtime。本片 **4/4 合同、100%**：native catalog/cache 保留独立预算、显式配置与当前路由逐字段优先级、picker/route 共用能力规则、四协议真实请求及 durable 原文验证。逐项产生时预算尚未对齐；整个 C03、C01/C02/Stop/Memory 和完整目标仍 active，不填写虚构总体百分比。
- 未验证边界：本片未修复或重新验收 C01 公共取消 driver；不把先前完整 fixture 的 4 项失败关闭。未跑全仓 `verify:local`、本片预算的真实 stdio/`lime exec`/PTY、Windows、live provider、Azure/Vertex；本片没有这些 Host/平台/认证入口改动，不能进入全仓 release evidence。避让 Turn/恢复/GUI/插件/全局 architecture 热区；下一刀归当前进程的 C03 逐项预算/provenance 校准与合并窗口内接线，插件/tar.gz/LimeCore 总范围继续保留。owner/依赖方向未变，架构影响 minor，root 已核对；DRY 由统一预算类型和同一个 capability merge 规则保证。

### C03 逐项预算来源与恢复（2026-10-18，实施中）

- 直接读取 Codex `core/src/session/mod.rs:record_prepared_conversation_items`：工具结果持久化前捕获产生时的模型预算，保留已有工具专用 override。`tools/registry.rs:AnyToolResult::into_response` 把工具预算放入 history-only envelope；`history/src/lib.rs:CodexHarnessMetadata` 将元数据与原始模型 item 分开保存。`context_manager/history.rs:record_item_with_metadata` 恢复该 token 预算，它已包含 serialization allowance，不能重复增加。
- 已确认 Lime 缺口：`CurrentProviderMessage` / `CurrentProviderToolResult` 没有对应 host-only 逐项预算，`context_history::normalize_tool_history` 统一使用当前采样预算；canonical 恢复仅重建结果正文。上片同一会话切换模型的测试验证的是未标注历史按当前 budget 处理，不能证明已保存的工具结果在换模型后仍保留产生时预算。不得据 catalog 切片通过关闭此项。
- 下一刀沿 current canonical 工具回填、ThreadItem metadata、provider history 与 sampling/summary 贯通，不把 harness 元数据塞入 provider opaque metadata 或发到模型 wire，也不新增平行持久化 owner。需改共享 Turn/投影/恢复写点时仍遵守已有热区避让；当前只读校准不认领这些文件。
- 退出合同：① 工具 override 优先，缺省捕获产生时模型预算，零预算合法，allowance 恰好一次；② durable 原文与独立预算冷重开/模型切换/fork 后一致；③ 普通采样、continuation 和摘要共用逐项规则，四协议 wire 不泄漏 host-only 字段；④ 内容来源独立于 role/权限，用户文本不能伪造 harness 来源。媒体成本与 retained-source revision 另列未完成，不随此片顺带宣称完成。
- 证据 `/tmp/lime-history-provenance-source-audit.json`：6 个 Codex 文件、4 个 Lime current 文件的只读摘要；不是 runtime 验证。grok 不参与定义该合同；Desktop 没有新行为结论，不以 REA partial/零匹配推断能力缺失。
- 本轮已复核 `provider_turn.rs`、`provider_history.rs` / `canonical.rs` 与本进程前片摘要一致；其工作树差异均为本进程历史预算改动，不再据“文件已脏”推定被其它进程持有。共享 `turn_execution` 的取消/driver 与 GUI/插件/全局 architecture 继续避让。已确认 canonical 工具事件会保存 typed output metadata，无需进入共享取消文件。
- 认领内部类型与接线：`agent-protocol/truncation.rs`；`tool-runtime/{tool_executor,tool_result_projection}.rs`；`model-provider/current_client.rs` 的工具结果字段；`agent-runtime/context_history{.rs,/output.rs}`、既有 `provider_turn.rs` / `code_mode.rs` 与新 `provider_turn/history_budget.rs`；`agent/protocol/tool_lifecycle.rs`；`app-server/runtime/provider_history/canonical.rs`。对应 DTO 构造点仅机械补 `None`，范围为 model-provider 的五组请求 capture/协议测试、agent-runtime context/history/compaction 测试、agent 的 current provider/protocol/lifecycle 测试、`server/handlers/provider_calls.rs`，清单 `/tmp/lime-origin-budget-mechanical-files.json`。所有新增算法落小模块，超限主文件只加字段与接线，不增加平行 state owner。
- 内部预算沿执行上下文与 typed tool result / normalized output 传递；工具专用 typed override 优先，零值不丢失。canonical 生成器清理普通 metadata 中伪造的保留字段，只从 typed host 字段写入 `ThreadItem.metadata.history_token_limit`。恢复读同一字段；模型 wire 不序列化它。CodeMode emitter 必须透传 command result ACK/error、start、trace 与 delta，不能只转发普通 emit。普通工具 immediate result 和 durable event 使用同一捕获值。
- 本轮先贯通普通/custom/MCP canonical 工具结果；raw Responses item 的独立 envelope 和完整内容 provenance 仍必须继续实施，不能把内部 DTO 已补字段当作整片退出。当前尚未取得最终编译/运行证据，完整对齐保持 active。
- 验证写集追加本进程既有 `thread_compact_jsonrpc/{model,model_fixture,catalog_truncation}.rs` 与新 `model_tool_reply.rs` / `origin_budget.rs`：四协议 HTTP 首次 response 触发真实 `Read`，经 current executor / canonical log 捕获预算和原文，冷重开后切换四协议/provider、fork、模型摘要，wire 不得带 host 字段。unit 追加 typed 专用上限（含零）、预算只增加一次 allowance、伪造 metadata 清理，以及 emitter 的 command ACK/error/start/trace/delta 透传；`provider_turn/history_budget/tests.rs` 与旧测试 helper 共用，避免复制执行器。
- 初次 `cargo check --tests`（model-provider/tool-runtime/agent-runtime/lime-agent/app-server/lime-server）exit 0；contracts exit 0。执行测试正在跑，最终终态另记。已直接核对 9 个 Codex 文件均匹配参考 HEAD，`/tmp/lime-origin-budget-source-checkpoint.json`；未新增 Desktop REA 行为结论。
- 额外只读边界：canonical `append_fork_item` 当前忽略 `Command`，`tool_result_from_item` 只处理 Tool/DynamicToolCall/McpToolCall；普通工具测试不能覆盖 unified exec 的每次 call/result 与 `write_stdin` 聚合。需继续追溯其它 provider/raw 事件和 fork truth 后补真实命令回归，不能只凭此分支推断 shell 整体缺失。step emitter 已统一转发命令完成通道，仍不据此关闭完整 shell 历史合同。
- 首轮领域测试 **965/965**（tool-runtime 523、agent-runtime 228、model-provider current_client 147、agent protocol 24、agent current_provider_turn 43）通过；新增真实 Read 集成首轮 **0/4**，runner exit 101，不记完成。阶段诊断证明三协议先通过 continuation、冷重开和四协议切换，再于 fork 丢失工具历史；Responses 首轮夹具遗漏 `response.output_item.done`，补全原生完整终态后同样到达 fork。诊断阶段增加的投影断言最初误用 snake_case item ID，已按 canonical camelCase 修正，该次诊断失败不计产品回归。
- fork 根因已用真实执行与 canonical store 对照确认：`runtime_backend/coding_events` 的后置 `file.read` 使用相同工具 ID，被 `item_family` 的泛 `file.*` 分支降为 File，覆盖完整 Tool；fork 按 canonical truth 继承时失去调用、输出和预算。追加认领原本干净的 `thread_item_projection/materializer/lowering.rs`，只将读取诊断排除出文件变更投影；原始 event log 保留，current Tool 是调用/结果的唯一 owner。`typed_tests.rs` 仅注册新 `typed_tests/read_tool.rs`，验证合批与分批事件均不得覆盖工具原文/预算。导入的显式 `file.changed` 合同未扩展为本轮清理范围。
- Responses 同时暴露真实解析缺口：added 的 `call_id` 和参数事件的 `item_id` 被当成两个调用，产生额外的 invalid tool。直接核对 Codex `codex-api/src/sse/responses.rs` 的 OutputItemAdded/Done 与参数事件处理；追加认领原本干净的 `model-provider/current_client/stream.rs`，新增小模块 `stream/call_identity.rs` 统一关联 item/call/index 标识，删除旧无关联 key helper。stream 大文件仅接线，不继续堆叠算法；退出条件为此次接线结束后不再在该文件增加标识逻辑。新测试覆盖 function/custom 完整 SSE、终态去重、所有输入事件 identity 和并发调用分离；当前 stream 定向 **27/27** 通过（含 2 个新增测试），日志 `/tmp/lime-origin-budget-stream-identity.log`。
- 当前重新运行 origin 四协议、catalog、历史裁剪、provider_history 与 typed projection 定向组，日志 `/tmp/lime-origin-budget-final-domain.log`；最终结果、fresh sidecar/current fixture/GUI 证据及 docs boundary 后续补记。runtime 取消/driver、GUI、插件与全局 architecture 热区仍避让；无新增 RPC、crate、依赖、迁移或兼容层。原工具预算片、C03 和“完整对齐”均保持 active，grok 仅参考多模型。
- 投影修复后的第二轮 origin 为 **0/4**：公共通知层仍把 `file.read` 要求为 Item，触发 `canonical materializer produced no item`，没有放宽原文/预算/fork 断言。追加认领原本干净的 `event_store/canonical_notifications.rs`，将该已识别诊断加入非 Item 事件分类，增加原始通知 payload 保留测试；未知 hook/item 仍须严格失败。当前 runner `/tmp/lime-origin-budget-final-domain-v2.log` 先验收通知/投影，再跑 origin/catalog/history/provider_history。
- `verify:gui-smoke` 的本进程构建发现已有另一个 renderer build 并行写相同产物，已仅停止自身 PID 15369 的后代构建树，exit 143，不计通过，也未停止已有 builder 或覆盖其源码。现有 freshness 检查判 renderer/host/sidecar 均需刷新，后续通过正式分段构建继续；不设置 build-ready、不绕过 freshness，不把上片 sidecar 当本片证据。
- 后续核对到 renderer 锁已转由被本进程停止的 PID 16162 持有；以 owner 的 PID/createdAt 精确匹配、进程已退出、目录仅含 owner.json 为条件，清除本进程遗留的两项锁产物。未删除未知锁/证据，正式 fixture builder 随后继续 renderer/host/sidecar freshness 流程。聚合 current fixture 的先行定向组 **368/368 executed** 通过（31 history + 34 streaming + 3 terminal UI + 300 guards；另 61 项过滤跳过不计 executed），尚不代表 Electron 场景通过。
- 直接对照同一 Codex Responses 源码，将参数 `done` 仅作累积更新，工具分发以完整 OutputItemDone 为准（无 item 终态的既有 completed 收口仍在同一 reducer）；不在参数 done 时提前锁定调用。新增 function/custom 回归：参数完成不触发执行、最终 item 参数生效、completed 不重复分发。当前重新运行全部 current_client 定向测试 `/tmp/lime-origin-budget-stream-final.log`；该轮之前的 27 项不能代替最后修改的验收。参考摘要扩至 **10 个 Codex 文件**，全部匹配记录 HEAD；无新增 Desktop REA 行为结论。

## 历史切片（2026-08-17，以下完成结论仅限原四项）

> 状态：实施完成；四项 runtime 主线、全仓 release evidence 与真实 Electron GUI smoke 均已通过
> 更新时间：2026-08-17
> 目标：只补齐 Codex 中 Lime 已确认缺失且属于 Lime 产品范围的 runtime 语义，不引入远端 exec-server、账号、marketplace 或第二套业务后端。

## 1. 范围与 owner

本次只处理四项：

1. Responses WebSocket 的 Turn-scoped 增量请求复用、`previous_response_id`、严格前缀校验、完整请求回退和 Responses prompt cache key。
2. MCP 工具级 `annotations.read_only_hint` 并发判定。
3. Codex 标准 `AGENTS.md` / `AGENTS.override.md` 项目规则发现兼容。
4. Async Hook 的 active/idle 结果归属、additional context 注入和生命周期隔离。

owner 固定为：

```text
Responses wire/session  -> lime-rs/crates/model-provider
Turn/session orchestration -> lime-rs/crates/agent-runtime / current provider adapter
MCP tool definition/execution -> lime-rs/crates/tool-runtime
AGENTS discovery/prompt assembly -> lime-rs/crates/agent + scheduler
Hook execution lifecycle -> lime-rs/crates/tool-runtime + agent runtime session owner
```

不做：

- Codex 远端 `exec-server`、`environment/*`、remote control、账号/计费和 marketplace。
- 用 mock 替代生产 bridge、provider 或 App Server。
- 恢复已退役 runtime、compat crate 或第二业务后端。
- 将 provider-specific remote compaction 替换 Lime 当前 durable provider-neutral compaction。

## 2. Agent Verification Contract

```text
改动名称：Codex Runtime 缺口对齐
执行计划文件：internal/exec-plans/codex-runtime-gap-alignment-plan.md
负责人：root
预算标签：budget:normal
风险等级：P0/P1
影响模块：model-provider、agent-runtime、tool-runtime、agent prompt/scheduler
不做范围：GUI 视觉、Electron IPC 新命令、远端 exec-server、live Provider
```

### Current 主链

```text
thread/turn start
  -> App Server runtime
  -> agent-runtime provider_turn / session actor
  -> model-provider current client / Responses wire
  -> tool-runtime MCP/Hook owner
  -> Thread/Turn/Item projection
```

本次不新增 App Server JSON-RPC 方法，不改变 Electron Desktop Host 边界；WebSocket 请求复用只在 provider 网络 owner 内生效。

### Happy Path

```text
同一 Turn 的第二次 Responses 请求历史是第一次请求的严格前缀
  -> 发送 previous_response_id + 新增 input
  -> 服务端返回 response.completed
  -> 保存 response id / output baseline

MCP 工具声明 read_only_hint=true
  -> step snapshot 将其标记为可并发
  -> provider_turn 与其它可并发工具并行执行

工作目录存在标准 AGENTS.md
  -> 从项目根到 cwd 按顺序加载
  -> 同层 AGENTS.override.md 优先
  -> 有界合并到 runtime prompt

Async Hook 在 active Turn 完成
  -> 不阻塞当前 sampling
  -> 结果在下一次 active sampling 注入

Async Hook 在 idle 完成
  -> 缓存在 session actor
  -> 下一次用户 Turn 开始前注入
```

### Evidence Layers

| Layer | 是否需要 | 证据 |
| --- | --- | --- |
| deterministic-smoke | 是 | Rust unit/integration tests、provider request capture |
| runtime-transcript | 是 | provider turn、MCP、Hook lifecycle 事件断言 |
| gui-trace | 否 | 本次不改 GUI owner |
| release-artifact | 否 | 本次不改版本、Forge 或依赖 |

### 必跑命令

```bash
npm run test:rust:related -- lime-rs/crates/model-provider lime-rs/crates/tool-runtime lime-rs/crates/agent-runtime lime-rs/crates/agent
npm run verify:local
```

按实际影响补充：

```bash
npm run test:contracts
npm run smoke:agent-runtime-current-fixture
```

未跑命令必须在完成记录中说明原因。由于本次不改 GUI、Electron IPC 或 App Server schema，`verify:gui-smoke` 不是最低门槛；若实际改动穿透这些边界，立即扩大验证范围。

## 3. 阶段与退出条件

### 阶段 A：Responses WebSocket 增量请求

- [x] 增加可测试的请求属性比较和 response item 前缀比较。
- [x] 为 Responses 请求引入 Turn-scoped session 状态，禁止跨 Thread/Turn 共享历史。
- [x] 记录 `response_id`、服务端新增 output items 和 `prompt_cache_key`。
- [x] 前缀不匹配、模型/工具/指令/路由/压缩变化时发送完整请求。
- [x] 连接失败或 HTTP fallback 使用完整逻辑请求，不把压缩 delta 当作 replay truth。
- [x] 添加连续请求、前缀失败、属性变化、空 delta、模型切换和压缩边界测试。

退出条件：provider capture 能证明增量请求和完整回退均符合预期，且不同 Turn 不共享 continuation state。

### 阶段 B：MCP 工具级并发

- [x] 在 `McpStepSnapshot` 捕获 route 时合并 server opt-in 与 `read_only_hint`。
- [x] 保持 hint 缺失/false 默认串行。
- [x] 补工具级 snapshot 单测和 provider_turn 执行测试。

退出条件：只读 hint 工具可与安全工具并发，未声明工具仍被串行护栏保护。

### 阶段 C：标准 AGENTS 发现

- [x] 兼容标准全局 `AGENTS.md` 与项目层 `AGENTS.md` / `AGENTS.override.md`。
- [x] 保留项目根到 cwd 的顺序、项目根边界、去重和总预算。
- [x] 明确 `.lime/AGENTS.md` 是否作为 Lime 专属 fallback；不得无记录改变优先级。
- [x] 补 global/project/nested/override/budget/symlink 回归。

退出条件：标准 Codex 项目规则可被 Lime runtime 读取，并且现有 `.lime` 规则行为没有未记录的回归。

### 阶段 D：Async Hooks

- [x] 保留 Hook snapshot 不可变和 trust/fail-closed 边界。
- [x] 将 async handler 从同步裁决路径分离，结果通过 session-owned channel 回传。
- [x] active Turn 结果注入下一次 sampling，idle 结果在下一 Turn 前消费。
- [x] session close、turn cancel、重复结果和 warning/context 生命周期有测试。

退出条件：async hook 不阻塞当前 sampling，结果不会注入错误 Turn，也不会在 session 关闭后产生副作用。

## 4. 进度记录

- 2026-08-16：完成 Codex/Lime 静态对比，确认四项范围；已有上下文 fragment、compaction、model switch、tool cancellation、MCP immutable snapshot、Multi-Agent 和 App Server transport 不重复建设。
- 2026-08-16：建立本计划，开始阶段 A。
- 2026-08-16：完成阶段 A：Responses WebSocket Turn-scoped session、严格前缀增量、`previous_response_id`、完整回退和 Responses prompt cache key；补充真实 WebSocket capture 与 lowering 回归。
- 2026-08-16：完成阶段 B：MCP 工具级 `annotations.read_only_hint=true` 并发；缺失/false 继续串行；补充 snapshot 与 provider-turn 回归。
- 2026-08-16：完成阶段 C：标准全局/项目 `AGENTS.md`、`AGENTS.override.md` 发现，并保留 `.lime` fallback、根边界、顺序、去重、预算和 symlink 语义；补充标准路径与 fallback 回归。
- 2026-08-16：完成阶段 D：Async Hook discovery、后台 command、生命周期 Started/Completed、active steer、idle mailbox、warning/context 投影和 cancellation 隔离；补充 discovery、runtime、session-loop 回归。
- 2026-08-16：修复 `lime-skills` 对编码本地 `skill://%2F.../SKILL.md` 的 URI 判定，避免把本地路径误当远程 authority；标准 `skill://server/...` 行为保持不变，3 个 URI 选择回归通过。
- 2026-08-16：清理五个 locale 中无源码引用的 7 个旧 Harness / Registered Skills key，`i18n:unused` 恢复为 `unused=0`，保留同文件其它既有文案改动。
- 2026-08-16：同步当前 Codex 参考源漂移：Codex 已从 `ModelInfo` 移除 `supports_parallel_tool_calls` 并在 Prompt 固定为 `true`；治理测试同时接受历史字段转发和当前固定值形态，不改变 Lime runtime 策略。
- 2026-08-16：完成不间断 `npm run verify:local` 复验：i18n、lint、typecheck、120 个 Vitest 批次和 contracts 全部通过；Rust changed selector 对并行工作树中的 `lime-rs/resources/default-skills/transcription_generate/SKILL.md` 按 fail-closed 退出，随后以 workspace unit/integration 扩大覆盖。
- 2026-08-16：workspace Rust unit 全部通过；workspace integration 在执行到 `app-server/tests/media_task_jsonrpc.rs` 时仅 `image_task_complete_rejects_wrong_task_type` 因独立媒体夹具缺少 `media_model_ref` 失败。本计划四个 owner 的定向、反向依赖和 current fixture 回归仍全部通过，未越界修改媒体链。
- 2026-08-16：重新执行真实 Electron GUI smoke、workspace rustfmt 与 diff 检查，均通过；旧 `audio.rs` 格式阻塞已消除。
- 2026-08-17：修复 Skills JSON-RPC 测试对进程级 `LIME_CONFIG_PATH` 的并行竞争；`RuntimeCore` 注入 `app_config_path`，生产路径与测试均改为显式配置文件，`skills_jsonrpc` 4/4 通过并以 4 线程重复 30 次无失败。
- 2026-08-17：修复 Rust 1.95 Clippy `never_loop` blocker；`LocalExecutionProcessHandle::next_event` 移除语义上不会重复的外层循环，保留 `try_recv`、`final_rx` 与 biased `select` 行为；`tool-runtime` 356/356、带 Rusty V8 artifact 的 Clippy 和全量 rustfmt 均通过。
- 2026-08-17：恢复媒体 fixture 后完成第二次 `npm run verify:local:full`；版本/i18n/lint/typecheck、120 个 Vitest 批次、contracts、workspace Rust unit/integration、Clippy 与真实 Electron GUI smoke 全部通过，退出码 0。最新 GUI evidence 为 `standalone-shell-01-20260817001202-86438`，result=`pass`。

## 5. 完成记录

```text
主线目标是否完成：是；四项 Codex runtime 缺口均已在 Lime current owner 内实现并有回归覆盖。
实现完成度：100%（阶段 A/B/C/D 全部完成）。
已跑验证：
  - `cargo test --manifest-path "lime-rs/Cargo.toml" -p model-provider --no-fail-fast`：258 passed。
  - `cargo test --manifest-path "lime-rs/Cargo.toml" -p tool-runtime --no-fail-fast`：356 passed。
  - `cargo test --manifest-path "lime-rs/Cargo.toml" -p agent-runtime --no-fail-fast`：210 passed。
  - `cargo test --manifest-path "lime-rs/Cargo.toml" -p lime-agent prompt::runtime_agents --no-fail-fast`：14 passed。
  - `cargo test --manifest-path "lime-rs/Cargo.toml" -p lime-core app_paths --no-fail-fast`：18 passed。
  - `cargo check --manifest-path "lime-rs/Cargo.toml" -p lime-agent`：通过。
  - `npm run test:rust:related -- lime-rs/crates/model-provider lime-rs/crates/tool-runtime lime-rs/crates/agent-runtime lime-rs/crates/agent`：通过；覆盖 owner 及反向依赖 `agent-runtime`、`app-server`、`lime-agent`、`lime-cli`、`lime-embedding`、`lime-mcp`、`lime-media-runtime`、`lime-processor`、`lime-scheduler`、`lime-server`、`lime-services`、`lime-skills`、`model-provider`、`tool-runtime`。
  - `npm run test:contracts`：通过（app-server-client 299 checks，其他 contracts/governance/docs 检查通过）。
  - `npm run smoke:agent-runtime-current-fixture`：通过；真实 Electron、preload、App Server sidecar、GUI fixture 全链路通过。
  - `npm run verify:local`：通过；i18n、lint、typecheck、完整 120 个 Vitest 批次和下游 contracts 均通过。
  - `npm run verify:local:full`：通过（退出码 0）；覆盖版本/i18n/lint/typecheck、Vitest、contracts、workspace Rust unit/integration、Clippy 与真实 Electron GUI smoke。
  - `npm run test:rust:unit -- --workspace`：通过；workspace 所有 Rust lib unit tests 无失败。
  - `npm run test:rust:integration -- --workspace`：通过；workspace integration 全部测试通过，媒体任务 fixture 已恢复。
  - `npm run verify:gui-smoke`：通过；最新证据 `standalone-shell-01-20260817001202-86438` result=`pass`，真实 Electron renderer、preload、App Server sidecar、工作台重载和 memory settings smoke 全链路通过。
  - `cargo test -p lime-skills agent_selection::tests::selects_skill_from`：3 passed。
  - `npm run i18n:unused -- --check`：通过，`unused=0`。
  - `npm test -- --run src/lib/governance/codexModelToolCallPolicyOrigin.test.ts src/lib/governance/codexModelExecutionPolicyOrigin.test.ts`：5 passed。
  - `cargo fmt --manifest-path "lime-rs/Cargo.toml" --all -- --check`：通过。
  - `git diff --check`：通过；计划文件无尾随空白。
未跑或未通过验证及原因：无。第二次 `npm run verify:local:full` 已取得零退出码，覆盖完整 Rust workspace、Clippy、contracts、Vitest 和真实 Electron GUI smoke。
环境依赖：Rust V8 测试需先运行 `node "scripts/lib/rusty-v8-artifacts.mjs"`，将其输出的 `RUSTY_V8_ARCHIVE` 与 `RUSTY_V8_SRC_BINDING_PATH` 作为 Cargo 命令级环境变量；本次已使用临时 artifact 完成验证。
残余风险：Async Hook 结果依赖 `pending_input` 注入；无该上下文的直接 provider 调用路径只保证执行与生命周期投影，不会追加 provider 上下文。失败/阻断/中止结果当前通过 `AgentEvent::Warning` 投影，尚无专用 warning protocol。
是否达到 Lime 本次实现门槛：是；current owner、定向测试、related 反向依赖、workspace 全量 Rust、Clippy、contracts、完整 Vitest 和真实 Electron GUI smoke 均通过。
是否可进入全仓 release evidence：是；`npm run verify:local:full` 已通过，媒体 fixture 与本机磁盘 blocker 均已消除。
治理分类：`current` 为 model-provider、tool-runtime、agent-runtime 与标准 AGENTS prompt owner；`compat` 仅保留 `.lime/AGENTS.md` fallback 且不承接新语义；`deprecated` 无新增；`dead`/已删除 runtime 未恢复，无第二套后端或生产 mock fallback。
下一刀：本计划无剩余 runtime 实现任务；后续按发布负责人节奏消费本次 release evidence，不需要恢复任何旧 runtime 或 compat 入口。
```

## 6. 架构确认

```text
架构影响：非重大。保持 provider 网络、tool-runtime、agent-runtime 和 prompt owner 不变；不新增 crate、协议方法或跨层事实源。
架构图已更新：不适用；本次只在既有 owner 内补齐行为和测试。
责任开发者确认：root，2026-08-17
确认内容：已核对目录归属、数据流、依赖方向、协议边界和验证门禁。
```
