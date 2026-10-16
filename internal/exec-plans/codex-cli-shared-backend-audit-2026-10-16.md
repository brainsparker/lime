# Codex CLI 与 Lime 共享后端对齐审计

状态：本轮源码审计完成；产品对齐 partial。日期：2026-10-16。责任：root。

后续实施以 [全面对齐计划](./codex-cli-shared-backend-alignment-plan.md) 和 [领域工作包](./codex-cli-shared-backend-work-packages.md) 为准。下方 F02/F06 记录修复前基线，现已进入连接隔离 S01；F07 已迁到 typed cancel。上述代码已修改、验证尚未闭环；不能把原始观察当作当前实现仍未修改，也不能提前将其标为 verified。

目标：对照用户指定的 Codex 源码，核查 Lime CLI/TUI/GUI 是否共用 App Server、runtime、工具与持久化 owner；找出仍未对齐的行为与交付证据。

写集仅本文件。Codex 与 Lime 产品源码、既有执行计划、已有脏改动全部只读；不提交、不创建分支、不调用 live provider。

基线：

- Codex：`/Users/coso/Documents/dev/rust/codex`，HEAD `4eb4a65407d98cebc4c83bf13be440b9fbc78a7c`，开始审计时工作树 clean。
- Lime：HEAD `d6dc866ea8f636dd4367eff86e84aa383a26016c` 加本地工作树。存在大量并行 GUI/设置改动，结论绑定所读源码，不把 HEAD 当作全部受审内容。
- 旧 [TUI/CLI 差异报告](./codex-lime-tui-cli-difference-report.md) 基于 Codex `c4017a87`；其文件、符号、snapshot 数量及未接线判断必须重新核实，不能直接用作本次 current 缺陷。

方法：使用 REA skill 的观察、推断、未知与证据账本流程。该 skill 明确要求完整源码架构分析使用普通仓库工具，因此本轮不启动 REA 引擎、不生成反编译 Evidence ID。独立问题按 skill 的 broader investigation 要求拆为只读审计：Host/transport、runtime/protocol、GUI 恢复；root 核查配置、存储与交付证据。

退出条件：

1. 确认两仓真实调用链，并区分“共享实现”和“共享同一运行实例”。
2. 对主链差距提供 current 源码与准确位置，核销已过期缺口。
3. 给出按优先级排列的下一刀、owner 与验收合同，产品专属差异另行说明。
4. 记录本轮轻量文档验证和未运行的产品验证边界。

## 问题账本

| 问题 | 当前状态 | 证据要求 |
| --- | --- | --- |
| CLI/TUI/GUI 是否复用同一业务后端 | answered：是 | 三端均进入 current App Server；见下方调用链 |
| 同时打开三端能否共享运行中的 Thread/Turn/Item | answered：默认未接通，server 也有多连接缺陷 | F01、F02、F03、F06 |
| resume、恢复、取消、后台 Command 是否等价 | partial | 已核销过时恢复/drain 缺口；F02、F04、F08 仍有差异，故障及实机矩阵未运行 |
| 配置与数据目录是否跨端统一 | answered：共享解析合同和存储 owner，未证明并发进程等价 | config/read、StorageRoots、平台目录入口 |
| 跨平台与打包证据是否足够 | answered：未齐 | launcher 缺目标平台；当前运行与三端并发证据不可由旧计划代替 |

## 主结论与实际调用链

Lime 已共享一套后端业务实现，不需要新建 CLI runtime。当前最重要的缺口是多客户端身份、反向请求路由和 Host 接入；这些决定 GUI/TUI 能否同时操作一个活跃 runtime。

```text
Codex CLI exec -> InProcessAppServerClient -> App Server in-process -> core
Codex TUI      -> Embedded / LocalDaemon / Remote -> 同一 App Server 边界

Lime CLI exec -> Rust ClientSession --stdio / ws(s)--\
Lime TUI      -> Rust ClientSession --stdio / ws(s)--> App Server -> RuntimeCore
Lime GUI      -> Electron Host ------stdio---------/               -> canonical Thread/Turn/Item
```

这里的三条 Lime 箭头表示共享代码边界；默认 CLI、TUI、Electron 分别启动自己的 stdio 子进程。它们不因此成为同一个运行实例。Codex exec 当前同样使用独立 embedded server，不能把“所有 Codex surface 必然共用一个 OS 进程”当作上游事实。用户指定的 Codex 仓库不包含私有 Desktop GUI 源码，本轮不对其 GUI 内部实现作推断。

入口证据：

- Codex：[exec/lib.rs:1017](/Users/coso/Documents/dev/rust/codex/codex-rs/exec/src/lib.rs:1017)、[TUI target:17](/Users/coso/Documents/dev/rust/codex/codex-rs/tui/src/app_server_connection.rs:17)。
- Lime：[exec.rs:141](../../lime-rs/crates/cli/src/exec.rs:141)、[TUI connect:1239](../../lime-rs/crates/tui/src/runtime.rs:1239)、[Electron launch:1092](../../electron/appServerHost.ts:1092)、[renderer transport:23](../../src/lib/api/appServerTransport.ts:23)。
- 同一个 Lime server 的 RuntimeCore/state/session registry 是共享对象：[AppServer::with_runtime:319](../../lime-rs/crates/app-server/src/lib.rs:319)、[RuntimeCore:314](../../lime-rs/crates/app-server/src/runtime.rs:314)。Thread 订阅和已有 session 的 resume 均已存在，不是每个连接再建业务后端。
- 存储由 App Server 的 [StorageRoots:47](../../lime-rs/crates/app-server/src/runtime/storage_roots.rs:47) 和 [initialize_database:272](../../lime-rs/crates/app-server/src/main.rs:272) 组合；[Electron roots:109](../../electron/appDataPaths.ts:109) 显式下发 AgentRoot/AppDataRoot，Rust 使用 [app_paths:24](../../lime-rs/crates/core/src/app_paths.rs:24) 的同一目录合同。CLI exec 从 [config/read:149](../../lime-rs/crates/cli/src/exec.rs:149) 获取配置。共享目录/SQLite 不能证明多个独立进程具有同一内存 driver 或通知订阅。

## 未对齐项

优先级针对“共享活跃后端”的目标排序。以下行为结论来自源码；除明确列出的 21 项测试外，没有新运行验证。

### F01 / P1：反向请求仍假设全局只有一个客户端

观察：[server_request_client:1018](../../lime-rs/crates/app-server/src/lib.rs:1018) 统计全部 transport writer，连接数不为 1 就返回 `ClientAmbiguous`。[begin_server_request:568](../../lime-rs/crates/app-server/src/server_request.rs:568) 没有利用 Thread 的订阅连接或请求发起端来选路。

实际受影响的初始派发包括 Command/File approval、`request_user_input`、permission approval、dynamic tool、MCP elicitation，分别见 [approval:31](../../lime-rs/crates/app-server/src/approval_server_request.rs:31)、[permission:22](../../lime-rs/crates/app-server/src/permission_server_request.rs:22)、[dynamic tool:20](../../lime-rs/crates/app-server/src/dynamic_tool_server_request.rs:20)、[MCP:113](../../lime-rs/crates/app-server/src/mcp_elicitation.rs:113)。它们会按已有错误分支进入拒绝、空回答、空权限或失败，即使第二连接只观察无关 Thread。

Codex 的 [ThreadScopedOutgoingMessageSender:172](/Users/coso/Documents/dev/rust/codex/codex-rs/app-server/src/outgoing_message.rs:172) 按 Thread 的 `connection_ids` 派发并管理结算，不要求全进程只有一个 transport。

现有 MCP 两连接恢复测试 [mcp_elicitation:657](../../lime-rs/crates/app-server/src/mcp_elicitation.rs:657) 直接注册 pending owner，绕过首次派发；它不能覆盖此缺陷。`currentTime` 则已按 Thread subscriber 选路，其单订阅者限制与 Codex 一致，不计为新缺口。

下一刀 owner：App Server server-request router / Thread subscription。先定义响应 owner、断连接续与只结算一次的合同，再复用所有反向请求消费者。

### F02 / P1：取消请求未按连接隔离

观察：transport 收到 `$/cancelRequest` 时，[lib.rs:786](../../lime-rs/crates/app-server/src/lib.rs:786) 丢掉 `connection_id`；[ProcessorState:138](../../lime-rs/crates/app-server/src/processor/mod.rs:138) 只保存 `HashSet<RequestId>`，[handle_notification:310](../../lime-rs/crates/app-server/src/processor/mod.rs:310) 插入裸 ID，[dispatch:61](../../lime-rs/crates/app-server/src/processor/dispatch.rs:61) 按裸 ID 检查、清理。

推断：两个连接均使用合法的 `id=7` 时，一端取消可能使另一端请求返回 canceled；一端完成也可能清除另一端同 ID 的取消状态。已有 `ConnectionRequestId` 可直接承接该合同，不应新增平行取消状态机。

下一刀 owner：`app-server::processor`，贯通 connection + request ID 的 notification、检查与清理。需覆盖同 ID、未知 ID、断连和迟到取消；本轮未做双 socket 故障注入。

### F03 / P1（共享运行实例目标）：GUI/默认终端 Host 尚未统一 attach

观察：[Electron launch:1092](../../electron/appServerHost.ts:1092) 始终解析本地 binary 并启动 stdio sidecar；[TUI connect:1239](../../lime-rs/crates/tui/src/runtime.rs:1239) 与 [CLI exec:141](../../lime-rs/crates/cli/src/exec.rs:141) 默认同样 spawn，只有终端显式 remote 才连接远端。Rust [RemoteTransport:90](../../lime-rs/crates/app-server-client/src/remote.rs:90) 接受 ws/wss，尚无 Codex TUI 的本地 socket daemon discovery/attach 路径。

影响：GUI 里的运行中 Turn/审批/后台进程不能靠“终端打开相同存储目录”自动接续；GUI 也没有选择已有 ws daemon 的生产入口。若目标仅为共享业务代码，本项属于增强；若要求三端同时操作同一活跃 Thread，则是必要交付。

下一刀 owner：既有 `app-server-client` / `app-server-daemon` / Electron Host 的连接生命周期。复用 current RuntimeCore 和存储，增加明确的 attach/owned shutdown 语义；不得复制 Codex daemon/state DB 或另建 runtime。

### F04 / P1：GUI 活跃事件路由在 30 分钟后硬过期

观察：[TTL:30](../../src/lib/api/agentRuntime/appServerEventStreamRouting.ts:30) 固定为 30 分钟；[register:103](../../src/lib/api/agentRuntime/appServerEventStreamRouting.ts:103) 只设置一次 `expiresAt`；每轮 drain [先清理:222](../../src/lib/api/agentRuntime/appServerEventStreamRouting.ts:222)，到时 [直接删除并可能退订:427](../../src/lib/api/agentRuntime/appServerEventStreamRouting.ts:427)。持续输出、completed Turn 的 active Command、恢复已有 route 都不续期。

高置信静态推断：没有新注册/重载时，超过 30 分钟的活跃回合或后台 Command 会失去该 route 的通知投影，后端仍可运行。read polling 可能补终态，但不等于持续通知语义。未运行 30 分钟实机场景。

下一刀 owner：GUI event router。以 canonical Turn/Command 生命周期控制活动路由回收；过期策略仅用于确定失活的资源。先补时钟推进的行为回归，再验真实长任务与终态回收。

### F05 / P1：remote 模式把本机 cwd 发往服务器

观察：Lime [TUI options:712](../../lime-rs/crates/cli/src/main.rs:712) 和 [exec cwd:154](../../lime-rs/crates/cli/src/exec.rs:154) 在缺省 `--cd` 时使用本机 `current_dir`，随后强制写入 [thread/start:230](../../lime-rs/crates/tui/src/app_server_session.rs:230) / [turn/start:198](../../lime-rs/crates/cli/src/exec.rs:198) 的 cwd/workspace roots。Codex [remote workspace:917](/Users/coso/Documents/dev/rust/codex/codex-rs/tui/src/lib.rs:917) 会省略本机 cwd，并按远端工作区处理。

影响推断：macOS 客户端连接 Linux/Windows 服务时可能发送不存在或含义不同的 `/Users/...` 路径。模糊文件搜索的本机 canonicalize 也需按 transport 检查。本轮未接真实异平台远端。

下一刀 owner：CLI/TUI session options 与 current App Server workspace facts。区分未指定远端 cwd、显式远端 cwd、本地 cwd，不在 Host 抢先解析远端文件系统。

### F06 / P2：客户端上下文被首个 initialize 固定

观察：[processor initialize:593](../../lime-rs/crates/app-server/src/processor/mod.rs:593) 只保存首个 `client_info`；请求 trace 和 `runtime_host_context` 读取这份全局信息。Codex [message_processor:1084](/Users/coso/Documents/dev/rust/codex/codex-rs/app-server/src/message_processor.rs:1084) 从当前 connection/session 获取来源。

影响：后连接 TUI 的调用可能被标成首个 GUI，调用来源与诊断失真。没有证据证明由此产生权限绕过。应与 F02 一起把连接上下文收敛到既有 owner。

### F07 / P2：非交互 MCP elicitation 被当成不支持的协议请求

观察：Lime [exec server requests:75](../../lime-rs/crates/cli/src/exec/server_requests.rs:75) 对 MCP elicitation 走 `METHOD_NOT_FOUND`；Codex [exec elicitation:2080](/Users/coso/Documents/dev/rust/codex/codex-rs/exec/src/lib.rs:2080) 明确返回 cancel，并要求 attached subagent 保持该语义。

下一刀 owner：CLI exec 的 server-request projection。显式返回 MCP cancel，补普通/子 Agent 场景，保持无交互 consent 的边界。

### F08 / P2：公开参数形状存在，但 resume/steer 能力尚未全部实现

观察：[resume validation:982](../../lime-rs/crates/app-server/src/processor/thread.rs:982) 显式拒绝 history/path 及 model/provider/cwd/workspace/approval/permissions/config/instructions 等覆盖；[steer:448](../../lime-rs/crates/app-server/src/processor/turn.rs:448) 拒绝 `additionalContext` 和 `responsesapiClientMetadata`。Codex [resume:3905](/Users/coso/Documents/dev/rust/codex/codex-rs/app-server/src/request_processors/thread_processor.rs:3905) / [steer:1083](/Users/coso/Documents/dev/rust/codex/codex-rs/app-server/src/request_processors/turn_processor.rs:1083) 已处理对应来源与上下文。

这是明确的能力裁剪，不是 handler 缺失。Lime 已可在 resume 后通过 `thread/settings/update` 修改部分设置，但不等价于 resume 请求的整体覆盖语义。应先补 current Thread 的必要配置/输入合同；Codex history/path 如需支持，应 lowering 到 Lime canonical owner，不恢复上游私有数据库。

### F09 / P2：Rust stdio transport 丢弃后端 stderr

观察：[StdioTransport:64](../../lime-rs/crates/app-server-client/src/transport.rs:64) 使用 `Stdio::null()`；Electron [sidecar exit:666](../../electron/appServerHost.ts:666) 已携带 stderr 尾部。初始化前的配置、动态库、数据库失败会缺少直接诊断。

下一刀 owner：Rust `app-server-client::transport`，保留有界 stderr 尾部并纳入异常退出错误，避免无界日志或混入 JSON-RPC stdout。

### F10 / P2：CLI 分发目标少于 Codex

观察：Lime [launcher targets:15](../../packages/cli/bin/lime.js:15) 仅 Linux x64 GNU、macOS x64/arm64、Windows x64；Codex [targets:16](/Users/coso/Documents/dev/rust/codex/codex-cli/bin/codex.js:16) 还覆盖 Linux ARM64/musl、Windows ARM64。Lime [npm Gate B:113](../../scripts/app-server/cli-npm-gate-b.mjs:113) 的宿主范围也仅前四种。

缺少目标是源码可确认事实；GNU 与 musl 的选择还取决于 Lime 原生依赖，不能机械替换。分发范围、二进制/动态库成组构建和各 OS 实跑证据应同时规划。本轮没有检查注册表发布状态或运行任何安装包。

### F11 / P2（可选上游能力）：服务端 read-state 同步未对齐

Codex 当前新增 experimental [ThreadReadState:2045](/Users/coso/Documents/dev/rust/codex/codex-rs/app-server-protocol/src/protocol/v2/thread.rs:2045)，以 `firstUnread + revision` 和 `expectedRevision` 防止窗口间读状态覆盖。Lime [ThreadReadResponse:278](../../lime-rs/crates/app-server-protocol/src/protocol/v2/thread.rs:278) 没有该合同，GUI [topic projection:176](../../src/components/agent/chat/hooks/agentSessionTopicViewModel.ts:176) 仍保留本地 unread 状态。

有界负向搜索：`app-server-protocol`、`app-server`、`src/lib/api` 未找到 `thread/readState`、`ThreadReadState` 或对应响应字段。可确认未实现上游这项协议，不据此声称 Lime 没有任何 unread UI。它影响多窗口一致性，但不是共享 runtime 的前置条件，是否纳入取决于产品范围。

## 已对齐与旧结论核销

| 旧说法 | 本轮 current 源码裁决 |
| --- | --- |
| 没有共享后端 / 需要另建 CLI runtime | 错。三端已共用 App Server、RuntimeCore、protocol、tool 与 canonical storage owner |
| 没有 remote / 反向审批通道 | 错。ws/wss ClientSession、server requests、TUI thread routing 均存在；问题在多连接初始派发 |
| TUI 没有重连和终端恢复 | 错。[reconnect:33](../../lime-rs/crates/tui/src/app/reconnect.rs:33)、terminal restore/panic hook 均已存在；本轮未重跑真实 PTY |
| GUI resume 没有 route/sequence 恢复 | 过时。[threadClient:288](../../src/lib/api/agentRuntime/threadClient.ts:288)、[sequence gate:63](../../src/lib/api/agentRuntime/eventSequenceGate.ts:63)、[commandResume:108](../../src/components/agent/chat/hooks/commandResume.ts:108) 已接通快照、scope、监听与缓冲；最新 Desktop 证据仍需单独闭合 |
| 后台 Command 仅看 status，不等输出 drain | 过时。[async_watcher:20](../../lime-rs/crates/tool-runtime/src/unified_exec/async_watcher.rs:20) 在 terminal 后 `wait_for_exit`，本地 [terminal:8](../../lime-rs/crates/app-server/src/execution_process/terminal.rs:8) 等待 final snapshot；观察错误、取消与平台故障仍需专项验证 |
| Command Desktop fixture 仍绕过 runtime | 过时。[fixture:128](../../scripts/agent-runtime/command-continuation-electron-gate-b.mjs:128) 是 runtime backend + loopback provider fixture，并要求真实通知；不是 live provider |

## 下一刀与验收合同

建议顺序：F01/F02/F06 先收敛 connection identity 与 reverse routing；再 F03 统一 Host attach；F04/F05 可按 GUI/终端 owner 独立修复。F07/F09 是较小补齐，F08/F10/F11 按产品范围推进。

1. 同一 App Server 两个已初始化连接，不同 Thread 分别触发 Command/File/permission/userInput/dynamic/MCP 请求；无关连接不能导致拒绝，响应不能越权到另一 Thread。
2. 两连接都用 `id=7`，取消、完成、迟到响应互不污染。连接 client name/version/context 分别正确。
3. 同 Thread 双订阅继续观察相同 Thread/Turn/Item；审批按明确 owner 合同只结算一次。断开一端后另一端活跃 Turn 继续，pending 按合同恢复。
4. 真实 Electron 与真实 PTY TUI 同时连接同一 server，记录相同 server PID、Thread/Turn/Item、实际审批输入、输出/取消/终态；分别验证客户端退出与 server 退出。再补 CLI 第三连接观察/操作场景。
5. GUI 用时钟推进回归覆盖 30 分钟后仍活跃的 Turn/Command，最终终态仍正确回收；真实长任务作为单独 Gate B 证据。
6. remote cwd 覆盖未指定、显式服务器路径、异平台路径、resume 和 fuzzy search，确认服务端 workspace facts 是唯一事实源。

恢复证据需区分：Renderer reload、App Server/整个 Electron 重启、活跃 OS Command 跨重启、三端同时在线。第129 [reload:237](../../scripts/agent-runtime/command-continuation-electron-gate-b.mjs:237) 特意保持同一个 sidecar PID；[notifications:354](../../scripts/agent-runtime/command-continuation-electron-gate-b.mjs:354) 断言 outputDelta、一次 item/completed 与原 scope。脚本设计不能代替运行产物，本轮未确认最新真实 Desktop 运行结果，也不能把它外推为服务重启恢复。

## 验证记录

- 初始只读检查：两仓 HEAD、工作树状态、相关源码与计划入口。
- 当前恢复定向验证：以下命令 exit 0，4 files / 21 tests passed，22.88s。由只读 GUI 审计 agent 执行，输出保存在工具会话（session 25142 / chunk acb90d），没有单独落盘日志。测试 transport/通知源为夹具，证据等级是 unit/component/integration，不是 Gate B。

```bash
npx vitest run \
  "src/lib/api/agentRuntime/appServerEventStreamRouting.background.unit.test.ts" \
  "src/components/agent/chat/hooks/commandResume.integration.test.ts" \
  "src/components/agent/chat/hooks/useCommandResume.component.test.tsx" \
  "src/lib/api/agentRuntime/eventSequenceGate.test.ts"
```

- 文档检查全部 exit 0：`npx prettier --check "internal/exec-plans/codex-cli-shared-backend-audit-2026-10-16.md"`、`git diff --check -- "internal/exec-plans/codex-cli-shared-backend-audit-2026-10-16.md"`、`npm run docs:boundary`。额外检查 64 个文件链接/行号与 11 份源码 SHA-256，零缺失、零漂移、零尾随空格。
- 未运行 Cargo、Electron、PTY、30 分钟长任务、双连接故障注入或 live provider：没有产品代码变更，不为源码审计运行全量构建；上述行为推断不能写作实机复现。

## 关键源码快照

以下 SHA-256 用于识别本地工作树证据，不是发布产物摘要。

| Lime 文件 | SHA-256 |
| --- | --- |
| `lime-rs/crates/app-server/src/lib.rs` | `b919414387277b717b4f86ae888aeb310c0e114ce9ff38a3116e51f68ebff58f` |
| `lime-rs/crates/app-server/src/server_request.rs` | `bb7868580b11a22a4ff94d91c4f22f33ca206ba6c518c8833266adbea0f642e4` |
| `lime-rs/crates/app-server/src/processor/mod.rs` | `309df52de96979bdb75d2f80460d3efb8f857dac6adcfd04e1e0dc911ab48452` |
| `lime-rs/crates/app-server/src/processor/dispatch.rs` | `63eadd090cc44bc12d87fb1eafbddfc749074ec87a877c7aa8a3e1e4eafa704f` |
| `electron/appServerHost.ts` | `afbd09e9c3782f61fd9d0e14db5b0771f4f39a98f3418541077a4068401ffdb4` |
| `src/lib/api/agentRuntime/appServerEventStreamRouting.ts` | `0269120788dbb564824cb2382ac97dce074554f026d28e937d22ce81b64ac131` |
| `src/lib/api/agentRuntime/threadClient.ts` | `dd66fa2ce283c5a80ce836001c93119ede2f0bc53c3ea3fba8c9cc210265f00f` |
| `lime-rs/crates/cli/src/exec.rs` | `b72ce5d1998937e91d5629a02b2f66d28126c3400970ba7b2fd1559a88a86ce7` |
| `lime-rs/crates/cli/src/exec/server_requests.rs` | `7fbb2fad3085f8a9d60272fa9d9db2edd41617e3b6470868af9b981e255887c2` |
| `lime-rs/crates/tool-runtime/src/unified_exec/async_watcher.rs` | `eb1d0e8acb4600904b5a26670084221d748c46e2c44ac660fa0545dfb34d02b6` |
| `packages/cli/bin/lime.js` | `4f8f8a76087e6de9ce4e8a3f249e01c74fad86bf6aecb634a7c2b5157fa5e639` |

## 完成度与分类

本轮审计退出条件 4/4 完成（100%，仅本轮有界源码审计）；产品对齐仍 partial，没有可信整体分母，不能从审计比例推导整体实现百分比。源码推断、未执行场景与可选上游能力均保留上述范围限制。

- current：既有 App Server、RuntimeCore、Thread/Turn/Item、GUI 恢复、TUI/CLI Host；本轮只读取。
- compat/deprecated：本轮未新增；未对全仓残留作完整分类审计。
- dead/deleted：本轮没有删除产品代码，也没有恢复禁用的 runtime/数据库/包装入口。
- test-only：21 个既有恢复回归；本轮没有新增测试。
- 本轮认领写集：仅本文件。避让写集：全部既有 GUI/设置/architecture/REA 报告脏改动及未跟踪源码。未知改动保持只读。
- 原则应用：按既有 owner 修复、复用连接身份与 canonical 状态，保持 KISS/DRY；不为对齐新建 runtime、状态库或无消费者包装。
