# Codex 全维度对齐：GUI / TUI / CLI

状态：active / partial。日期：2026-10-13。责任：root。

## 目标与裁决

用户明确要求从全局视角复刻，包括行为语义、函数命名、目录结构、职责边界、代码
风格、交互与验证方式。不能以几个功能通过或文件同名率代替全面对齐。

GUI 的多模态、多模型、主题、Banner / Hero 是明确保留的产品能力。它们不构成
平行业务后端：模型控制与媒体 lowering 继续归 model-provider；主题 / Banner 归
GUI presentation；GUI / TUI / CLI 共享 App Server、runtime、权限、工具和持久化。

```text
Electron Host -> GUI ─┐
CLI Host -> exec ─────┼-> App Server JSON-RPC -> RuntimeCore -> Thread / Turn / Item
CLI Host -> TUI ──────┘                         -> shared tool / provider / store
```

主链依赖方向不改变，无新 crate、协议或配置；PowerShell 权限切片新增与 Codex
一致的固定 `tree-sitter-powershell =0.26.4`，由既有 tool-runtime 消费。重大 owner 调整继续按
architecture.md 的确认门槛执行。本计划作为全局验收索引，既有细分计划保留其
历史证据与当前 owner；不新增第二份实现或第二套进度事实。

## 参考事实与证据边界

- 本地公开源码：`/Users/coso/Documents/dev/rust/codex`，本轮读取 HEAD
  `a9b0815167c27ab13719dd12d13b63e02b70d221`。以当前源码为准，不沿用旧 revision。
- 本机 Desktop：`/Applications/ChatGPT.app`，bundle id `com.openai.codex`，版本
  `26.1007.30912` / build `20156`。这里只证明安装包 metadata。
- 用户已明确授权只读分析本机 Desktop；电脑操作工具仍返回
  `Computer Use is not allowed to use the app 'com.openai.codex' for safety reasons.`。
  本轮真实 Desktop 观察为 not-run；授权缺失不是原因。不用包名、源码或 Lime
  screenshot 代替 Codex Desktop 实际界面，不绕过工具限制。
- TUI / CLI 结构账本：`tui-structure-inventory.json`、`cli-structure-inventory.json`；
  snapshot / test 账本仅用于发现差异，生成时间与 revision 须独立核对。

## 全局验收矩阵

| 维度                 | Codex 事实源                                       | Lime current owner / 验收                                                                     | 当前结论                                                                               |
| -------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 主链与职责           | app-server、core、protocol、exec、tui              | App Server -> runtime -> canonical projection；GUI / TUI / CLI 共享                           | current；共享主链有证据，不等于所有能力全面一致                                        |
| 目录与命名           | exec/src、tui/src、公开共享领域                    | cli/src/exec、tui/src/chatwidget / bottom_pane / app / projection；沿 existing owner 直接迁移 | partial；逐职责映射，不搬 account 等产品专属目录或制造空壳                             |
| 函数与代码风格       | 当前生产函数及其测试                               | 同责函数优先同名；小模块、独立测试、Rust fmt / Clippy、TS projection / hooks 分层             | partial；共享工具19项lint已关闭，重复helper与MCP测试结构已收敛；全仓逐职责映射继续进行 |
| Thread / Turn / Item | app-server-protocol、app-server                    | 共享 lifecycle、read model、store、resume、fork、archive、revert                              | current / partial；细分证据见既有完整对齐计划                                          |
| 工具与后台 Command   | core unified_exec、公开 Command item               | tool-runtime / agent / App Server；两种 GUI / TUI 投影消费同一 scope                          | 取消、observer / drain、正常后台 Command 的 session 卸载与 transport EOF 已专项验收    |
| 恢复与事件顺序       | app-server resume / notifications、tui replay      | 当前 canonical snapshot、router、sequence gate、reducer                                       | partial；第129批 GUI route / sequence 恢复正在其他写集中推进                           |
| CLI 非交互与退出     | exec/src/lib.rs、event*processor*\*                | cli/src/exec.rs、共享 app-server-client                                                       | 本轮处理 Ctrl+C -> turn/interrupt -> 服务端 terminal -> thread/unsubscribe -> shutdown |
| TUI 输入、历史、阅读 | tui/src/chatwidget、bottom_pane、transcript、pager | 同名 surface owner、真实 PTY / terminal restore                                               | partial；ordinary held reading、owned inline、dispatcher / snapshots 见终端计划        |
| GUI 工作区与交互     | 本机 Desktop 实际 UI（本轮不可访问）               | ThreadWorkspace / Composer / timeline / context；真实 Electron Gate B                         | 既有链路证据有效；本轮无法判定 Desktop 实时视觉一致                                    |
| 模型与多模态         | Codex runtime 语义；grok-build 模型控制事实源      | model-provider、共享 catalog / route / capabilities / canonical content                       | 保留扩展；多模型和多模态不得成为 GUI 私有 backend                                      |
| 主题、Banner、Hero   | 用户明确保留的 Lime 产品裁决                       | GUI theme / skin / presentation                                                               | product-extension；保留并受五语言、布局与交互回归约束                                  |
| 权限、平台与发布     | 公开 sandbox / approval；实际平台运行              | 共享 tool-runtime / App Server；Windows / packaged 独立证据                                   | partial；macOS 绿灯不能覆盖 Windows、packaged 或 live provider                         |
| 验证方式             | Codex 单元 / 集成 / snapshot；真实产品入口         | related -> contract -> stdio / PTY / Electron Gate B                                          | 每条结论标 proof level；全量测试不能替代对应交互证据                                   |

## 当前切片：CLI 中断与卸载

窄写集：`lime-rs/crates/cli/src/exec.rs`、
`scripts/app-server/cli-interrupt-gate-b.mjs`、`scripts/app-server/cli-gate-b.mjs`、本计划。
初始避让已有脏的 Rust runtime / tool；取消根因确实跨 owner 后，仅接管下述
具体补丁点。TUI Command projection、GUI hooks / client / verifier、architecture
和 release 计划继续只读。Codex 源码只读。无子 Agent、提交或分支。

对照：Codex `exec/src/lib.rs` 的 signal select、`TurnInterruptParams`、
`request_shutdown`。终端信号为 host 入口；业务取消、终态和 session-owned 资源
释放全部走既有 App Server owner，不在 CLI 构建另一套取消或进程状态机。

退出条件：

1. 真实 CLI 收到 SIGINT 后通过共享 `turn/interrupt` 取消原 Turn；human / JSON
   均等待 canonical interrupted，退出130，不打印伪造成功或覆盖最后回复文件。
2. 正常和中断退出都通过 `thread/unsubscribe` 与 transport shutdown 回收自身
   subscription / sidecar；测试检查原 identity、冷读终态及实际子进程退出。
3. CLI 定向 / crate 验证、真实 CLI Gate B、contracts 与脚本 / 文档守卫通过。
4. 回写结果、失败证据、治理分类与未验证边界；不把该切片百分比作为总体比例。

### Agent Verification Contract

- 责任：root；预算：`budget:normal`；风险：P0 工具取消与进程生命周期。
- Current 主链：CLI signal / TUI input / GUI stop -> `turn/interrupt` ->
  RuntimeCore -> runtime backend / tool-runtime -> supervisor final snapshot ->
  canonical Command / Turn -> `thread/read` 与三端投影。CLI 退出再走
  `thread/unsubscribe` / transport shutdown；GUI bridge 为既有 preload / IPC /
  `app_server_handle_json_lines`，前端 gateway 与协议不新增入口。
- Happy Path：真实 shell 启动后中断，先 terminate、排空输出并闭合原 Command，
  再发布原 Turn 的单一 interrupted；CLI 退出130、回复文件保留且 sidecar 回收。
  后台自然完成场景验证最后无换行输出、可编辑草稿与 renderer reload 后冷读一致。
  工具权限 / sandbox 仍由既有共享 owner 判定，fixture 仅使用本地临时目录。
- Evidence Layers：deterministic-smoke 与 runtime-transcript 必须；GUI trace
  必须来自真实 Electron / preload / IPC，记录 identity、状态、摘要与错误计数；
  release-artifact 不适用，本轮为 macOS source-tree debug artifact 验收。
- C0：contracts、脚本治理、lint / typecheck / fmt；C1：定向与共享 Rust unit、
  current fixture、真实 CLI stdio / TUI PTY；C2：GUI smoke 和 native Desktop
  command continuation。实际结果与路径见下方验证记录。
- 场景映射：P0 stop / continue、原工具 terminal 与进程回收；P1 后台 Command
  自然完成、恢复与草稿保留。不运行其它无关 P0、qcloop 或 LLM judge；断言由
  deterministic verifier 和实际 OS / protocol / UI 证据完成。
- C3 / C4、live provider、Windows、packaged installer 均未跑；本地 provider
  fixture 不能证明其行为。进入对应平台或发布范围时另补证据，本轮不能进入
  packaged release evidence；Codex Desktop 实际 UI 受前述工具限制仍为 not-run。
- 失败回写：取消 / drain 的 Rust regression、CLI 原 SIGINT fixture 和此计划。
  关闭条件为上述四项退出条件均有最终源码证据，失败与未验证范围仍保留。
- 架构影响：内部资源排空合同；无新增 / 删除 / move crate 或 package，不改变
  跨层 owner、public protocol、read model、provider / tool 归属及交付门禁。
  架构图更新不适用：依赖与数据流仍为本计划顶部及 architecture.md 既有主链。

实施顺序：先真实 signal 红灯，再最小 current 接线，复测同一 predicate；检查
目录 / 函数 / 风格映射。GUI 与 TUI 的已有证据仅作为前序基线，本轮没有修改它们
时不宣称新验收；全局完成度没有可信分母，保持 partial。

### 取消缺陷的 owner 接管

用户明确“完全授权”，本轮继续处理同一 shared backend 缺陷。协议隔离日志证明
`turn/interrupt` 请求与成功 response 均已发生，但没有 Command / Turn terminal。
通用 RuntimeTool 与 attempt runner 都在 token 取消时直接 drop 执行 future；这会
跳过 unified_exec 自己的 terminate / drain / canonical completion。

追加窄写集：tool-runtime 的 `tool_executor.rs`、`execution_orchestrator.rs` 及独立
测试模块；agent 的 `tool_executor/orchestration.rs` 只抽出 attempt runner 并声明
unified_exec 取消 owner；App Server `execution_process.rs` 只增加 terminal 子模块
导航，真实 supervisor 完成等待归该子模块与 existing live gateway。

既有脏文件 `tool-runtime/src/unified_exec/collect.rs` 仅接管 terminal 分支的等待点：
以 supervisor 的已完成 snapshot 替换固定100ms等待，不重写它已有的 lifecycle / output
改动。原 diff 保存 `/tmp/lime-global-collect-before.patch`，写前核对当前内容；无已知
其他进程持有此补丁点。其余 runtime / GUI / TUI 脏热区继续避让。
本轮不增加 RPC、配置、依赖或 owner；两个近1000行模块先把既有 inline tests
迁入同名子目录，attempt runner 从超1000行模块抽出。取消回归先记录红灯再修复，
并复跑同一真实 runtime / shell / stdio SIGINT 验收。

真实复测暴露第二个边界：task grace 到期会强制 drop tool future，driver 的 terminal
随后被仍未闭合的 foreground Command 拒绝；仅改包装层不足以处理强制 abort。
偶发一次真实进程 / canonical interrupted / exit130 已通过，不能计为稳定通过。
继续按用户完整授权接管 `RuntimeCore::cancel_turn` 的 driver 完成后补丁点：先调用
existing backend cancel owner，等待目标 Turn 的真实进程排空、Command terminal；
如果 driver 尚未写出 canonical terminal，再由同一 RuntimeCore append 并返回通知。
不改 grace 预算，不更改 verifier，不取消别的 Turn / Thread 的后台进程。
原 runtime diff 保存 `/tmp/lime-global-runtime-turn-before.patch`；existing unified_exec
只增加 cancellation 子模块导航，registry 仅增加按 Thread / Turn 读取，原 diff 保存
`/tmp/lime-global-unified-exec-before.patch`。取消实现、测试进入既有 owner 的独立小模块。

完整 App Server unit 回归发现：既有 backend `cancel_turn` 可以永久 pending，
直接 await 会破坏快速中断合同。失败与中止日志保留
`/tmp/lime-global-app-server-unit.log`。本轮将资源排空明确为 existing
`ExecutionBackend::drain_turn` 内部合同：默认没有本地资源，runtime backend 等待
原 Turn 的 terminate / supervisor / output / Command completion；backend cancel
hook 继续异步通知。`finish_turn_interrupt` 先排空，再检查同一 canonical terminal。
独立测试用 Notify 控制排空，证明排空前无 terminal、排空后不等待 hanging cancel；
不放宽既有 timeout。追加写集为 `runtime/execution_backend.rs` 与
`runtime/turn_execution/cancellation/{tests.rs}`，不增加 public RPC。

完整本轮写集还包括 `runtime_state/execution.rs`、
`runtime_backend/execution_backend.rs`、`execution_process/terminal.rs` 与测试、
`tool-runtime/execution_process/live.rs`、`unified_exec/cancellation.rs`、
`unified_exec/session.rs` 和 `unified_exec/tests/cancellation.rs`；对应 trait
implementation 与模块导航同步，保留已有 diff。

同时接管 `unified_exec/async_watcher.rs` 的 terminal 等待点（原文件保存
`/tmp/lime-global-async-watcher-before.patch`）：后台 observer 与前台 collect
都等待同一 supervisor 的最终 snapshot，删除该补丁点固定 output grace。
测试用可控 supervisor barrier 证明终态观察尚不能发布 Command completed，
最后无换行输出排空后才发布且只发布一次。保留原 observer 的其余接线。

命名 / 目录 / 风格映射：CLI `request_shutdown` 与 Codex exec 同责同名；signal
只归 host，业务取消归 RuntimeCore；Codex process manager 的 terminate / output
closure 由既有 App Server process supervisor 和 tool-runtime unified_exec 承接。
`wait_for_exit` 复用本地 process owner 的语义，不复制 provider 或 UI state。
attempt runner、测试与取消逻辑进入各 owner 同名子目录；production 文件保留
小型模块导航。GUI 的 Banner / Hero / 主题和模型 / 附件入口保持产品扩展裁决。
TUI `runtime_pty_tests.rs` 仅按 rustfmt 重排两个 existing 模块导航，未接管其业务测试。

广域 strict Clippy 初次因未使用既有 V8 环境封装而请求不存在的预编译包（404）
失败；使用 `resolveRustyV8CargoEnv` 重跑后，定位 tool-runtime 既有19项 strict
lint 缺口，包括 MCP / Skills 参数与错误尺寸、tool outcome enum 尺寸及若干迭代
风格。日志分别保留 `/tmp/lime-global-shared-clippy-final.log` 和
`/tmp/lime-global-shared-clippy-reviewed-env.log`。这些不属于本刀取消实现新诊断；
本轮不增加 blanket allow、不扩散修改十五个不相关模块来制造全局绿灯。
广域 strict gate 记为 failed；CLI strict 独立复验，整体代码风格继续 partial。

`verify:local` 前端第20批发现5项旧 resume mock 精确参数断言失败：current
`resumeThread` 的 optional replay callback 作为第二参数传入，hydrate 为 undefined，
stream binding 为函数。生产接线正确，窄写集追加 `useAgentChat.test/` 下
`homeSession.case.tsx`、`taskSnapshots.case.tsx`、`queueHydration.case.tsx` 与
`preferencesSessionRestore.case.tsx`，同步 hydrate 的精确无回调合同；保留既有
runtime / canonical read model / queued count / 绑定状态断言。从失败批次续跑，
不重跑已通过前19批，不修改生产接口来迎合旧 fixture。

前端第58批还发现本地 Codex source-origin guard 读取的 tool_config 已不再拥有
shell policy。追加窄写集 `src/lib/governance/codexModelNativeToolPolicyOrigin.test.ts`：
删除已不存在的 `shell_type_for_model_and_features` / `UnifiedExecShellMode` owner
假设，直接读取当前 `ModelInfo` enum 与 `core/tools/spec_plan.rs::add_shell_tools`，
验证 disabled gate、ExecCommand / WriteStdin 注册及无 ShellCommandHandler。
仍保留 ModelInfo native fields 与 apply_patch / experimental tool origin 断言。
这仅修正 reference guard，不宣称本地 preferred_shell_surface metadata 的 legacy
alias 已 canonical 化；当前该字段仅随 model request metadata 投影，实际工具执行
统一走 shared unified_exec。alias metadata 收敛作为下阶段差异记录，不能靠本 guard
通过冒充全部模型 policy 一致。待运行中的全量门禁收取完成后，继续下述 policy
收敛切片；不在进行中的编译内夹写生产代码。

## 续接切片：canonical shell policy

追加窄写集（写前均干净）：`src/lib/model/modelNativeToolPolicy.ts` 与测试、
`lime-rs/crates/agent/src/model_request_policy.rs` 与同名目录测试；来源守卫
`src/lib/governance/codexModelNativeToolPolicyOrigin.test.ts` 与本计划。
追加原干净 `agent_tools/native_tool_policy_gate.rs` 的独立回归，直接验证真实
catalog entry 的 exec_command / write_stdin gate，而不是只断言 metadata snapshot。
不接管 model-provider、registry、protocol 或 settings 的其它写集。

Codex 当前 `ConfigShellToolType` 仅有 UnifiedExec / Disabled，三个历史 token 为
UnifiedExec 的 serde input aliases。前端只输出两种 canonical shell_type 与
unified_exec surface；共享 Rust backend 同样解析别名并派生 surface。旧
preferred_shell_surface 不再作为独立决策源，disabled / unknown 即使附带旧
shell_tool_enabled=true 也必须关闭 exec_command / write_stdin；有效 unified_exec
仍保留显式 false 的工具 opt-out。

风险为 P1 模型工具 gate，沿用上述 budget:normal 合同与共享主链；不改变权限 /
sandbox owner，不新增 GUI 私有 backend。退出条件：别名的双端 canonical 输出、
disabled / unknown 的 fail-closed、显式 opt-out 的回归均通过；同步 source-origin、
registry / request metadata / protocol boundary 测试；当前 fixture 与 contracts
验证既有 GUI / shared runtime 接线。先记录原实现红灯再修，不放宽 disabled 断言。

红灯：前端3项 alias 回归失败，日志 `/tmp/lime-global-native-shell-frontend-red.log`；
Rust20项中3项失败，包括旧派生字段覆盖 disabled，日志
`/tmp/lime-global-native-shell-rust-red.log`。修正后前端6文件43项通过，日志
`/tmp/lime-global-native-shell-frontend-formatted-final.log`；完整 agent crate278项通过，
包含真实 catalog gate 回归，日志 `/tmp/lime-global-native-shell-rust-gate-final.log`。
contracts、定向 ESLint、全前端 typecheck、Prettier 均 exit0，日志分别为
`/tmp/lime-global-native-shell-contracts-final.log`、`/tmp/lime-global-native-shell-eslint.log`、
`/tmp/lime-global-native-shell-typecheck.log`、`/tmp/lime-global-native-shell-format-final.log`。
共享协议的字段 / schema / generated TS 不变，仅 canonical 化现有 string metadata；
protocol boundary 测试覆盖同步合同，无依赖或锁文件变化。

policy 续接的 Electron fixture 首次已由标准资源构建生成最新 sidecar 并通过 unknown
Item 的真实 GUI / recovery，但下一 home-hotpath 的临时 HOME 触发完整 Cargo
冷编译。仅对本轮 fixture 的 Cargo 子进程29594发送 SIGINT 后聚合 exit1；这是
主动中止的重复准备，未进入该场景的用户操作断言。日志
`/tmp/lime-global-native-shell-current-fixture.log` 保留。
复验使用夹具已有的 APP_SERVER_BIN 入口指定同一标准构建生成的 resource
artifact，未修改 fixture / freshness / assertion：
`dist-electron/app-server/darwin-arm64/app-server`，SHA256
`f8642f099ae35546eb025086ebb552c28db139f730fb9bb9e5a475a558df5094`，与
`dist-electron/app-server.release.json` 一致，生成时间18:46:20晚于本切片生产改动。
code-mode sibling 与 loader resources 均来自该资源构建；本产物区别于取消切片
之前的 frozen artifact，不能用之前的摘要声明 policy 续接源码已覆盖。
复验聚合 exit0，日志 `/tmp/lime-global-native-shell-current-fixture-reviewed.log`。
真实 Electron / preload / IPC / App Server controlled external backend 覆盖图片任务、
cancel-then-continue、approval、rich draft、steer、Plan、Skills、MCP、media reference
与 typed retry；liveProviderUsed=false。cancel-then-continue、rich restore、MCP 三个
summary 的 ok 均 true、consoleErrors / pageErrors 均为空。证据位于
`.lime/qc/gui-evidence/claw-chat-current-fixture/`。它证明最新 GUI / bridge 接线，
shared native gate 行为由前述真实 catalog entry 回归证明，不能冒充 live provider。
Rust workspace fmt 使用 virtual workspace 所需 `--all` 后 exit0，日志
`/tmp/lime-global-native-shell-rust-format-all-final.log`；首个缺少该参数的命令没有
找到 targets，诊断保留 `/tmp/lime-global-native-shell-rust-format-final.log`。

policy 续接的 `verify:gui-smoke` 完整命令 exit0，包含 Renderer / Host / sidecar
标准重建与真实 Electron 启动；日志 `/tmp/lime-global-native-shell-gui-smoke-final.log`。
summary 为
`.lime/qc/project-gates/standalone-shell-01-20261012110525-25089/shell-01-electron-smoke/summary.json`，
result=pass、24/24 assertions；真实 preload / IPC / App Server JSON-RPC、reload、
三个 viewport、settings 均通过，无 console / page / invoke / preload errors、
renderer crash 或 mock fallback。其 Gate B-F scope 是桌面壳与 bridge；没有 provider
Turn、live provider、packaged installer 或 Codex Desktop pixel parity 声明。
该命令标准重建后的 resource App Server SHA256 为
`e916ac28e3a0a1851cccc65a07662f6a8509485f8046126bb3f98a36037ba3a5`，
code-mode sibling 为 `44082583b77a6f64a55bdec785651ba4cc6a803ceaea91d4aa870d8fb9ef75a0`。
前述 GUI current fixture 使用 f864 产物，本次壳 smoke 使用 e916 产物；二者均来自
此切片生产源码，各自 scope 独立，不宣称相同 artifact bytes。

本轮裁决：CLI 中断 / 共享取消切片与 canonical shell policy 切片的各自退出条件
均已满足，切片完成度分别为100%；全局仍 active / partial。前者真实 CLI / PTY /
native Desktop 证据与后者最新 unit / catalog / Electron fixture / shell smoke
各按上述源码阶段与 artifact 记账。广域 strict lint 与下一节未验证边界仍开放，
没有新增兼容后端，没有 release readiness 或“全方位复刻完成”声明。

## 验证记录

2026-10-12 最终基础门禁收取：`npm run test:resume` exit0，状态文件记录121/121
批 passed，最终完成时间 `2026-10-12T10:37:30.127Z`；第58批之后续跑日志
`/tmp/lime-global-frontend-resume-58.log`，前20批 / 第58批失败与各次续跑日志保留。
`npm run test:rust:changed` exit0，共5006项：agent-runtime211、App Server1813、
CLI8、agent274、MCP174、scheduler36、server119、tool-runtime489、TUI1882。
日志 `/tmp/lime-global-rust-changed-final.log`。以上结果属于 policy 续接切片之前的
源码基线；该切片变更后补定向验证，不把旧全量当最终代码的全部证据。

`verify:local` 两次聚合分别在旧测试精确参数断言与旧 Codex 来源守卫停下；其
lint、typecheck、五语言 / 文案扫描已通过，前端使用既有 resume 完成，Rust changed
单独补齐剩余任务。没有最终聚合 exit0 记录，不能将分层续跑写成该命令 exit0。
全仓 docs boundary 与 diff check 通过；本计划已补精确 .gitignore exception 及
exec-plans 导航，成为可 version 的执行证据，无 git add / commit / push。

取消 / drain 切片（policy 续接之前）的共享 Rust 回归：
`npm run test:rust:unit -- -p tool-runtime -p lime-agent -p app-server -p cli --bins --locked --jobs 1`
exit0，App Server 1813 library +27 binary、CLI 8 library +106 binary、agent274、
tool-runtime489，共2717项通过。日志 `/tmp/lime-global-shared-final-unit.log`。
编译时发现本轮 test 的 `AgentInput` glob 歧义，已改 explicit import；不改变行为。

CLI strict 最新复验 exit0：`/tmp/lime-global-cli-clippy-final.log`，使用仓库现有
`resolveRustyV8CargoEnv`。contracts exit0：`/tmp/lime-global-contracts-final.log`。
scripts governance、定向 ESLint / Prettier、全 workspace Rust fmt 和 diff check
通过。GUI retained surface / Command projection 定向11项通过，日志
`/tmp/lime-global-gui-preserved-smoke-unit.log`；属于 Unit/component，不能冒充
真实多模型或多模态后端验收。普通 related runner 曾在依赖图遍历 node Electron
目录时报 EISDIR，原日志 `/tmp/lime-global-gui-preserved-related.log` 保留；使用
既有 smoke runner 直接运行实际测试，没有生产 mock fallback。

最终完整 CLI Gate B：`LIME_KEEP_CLI_GATE_B_TMP=1 npm run smoke:cli-gate-b`
exit0，日志 `/tmp/lime-global-cli-gate-final.log`。实际重新构建 CLI / App Server，
native SIGINT human / JSON 都验证 interrupted、declined、原 identity、cold read、
exit130、最后回复文件保留、shell 与 App Server 退出；reasoning、五语言、color、
resume / fork / review、图片 / schema / stdin / output-file 聚合也通过。
冻结目录 `/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/cli-gate-b-Y7A0Sv/binaries`，
CLI SHA256 `8bced06039d0c2dfe2468ebbfdd16874f85eb43c70d3430058b24b0c8ffc0a2d`，
App Server SHA256 `a77f75e627654cd2873d8f101a1ffb10edfeabeba1034e46ae7fd8cac7031bee`。
CLI human 外层 stdin 不是 TTY，专属 color/TTY case 明确 not-run；真实 PTY 由
下述 TUI Gate B 单独补证据。这份产物属于 loader 准备前；三端最终产物与最终
Gate B 结果见下一节，不能混用摘要。

### 取消切片三端产物与实际入口

既有 Electron `prepareRuntimeBinary` 为 macOS loader 补齐 rpath，会改变 Mach-O
digest。首次终端冻结包的 App Server 摘要属于 loader 准备前，不能把它混入之后
Electron 的相同字节声明。完成既有 loader 准备后，再使用 existing
`snapshotTerminalGateBinaries` 保存最终 reviewed artifact：

- 目录：`/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-global-reviewed-SK6zNE`
- CLI：`8bced06039d0c2dfe2468ebbfdd16874f85eb43c70d3430058b24b0c8ffc0a2d`
- App Server：`c1d9447f4e0aee65ccfa0a5d407fb6473422d3a70e07cb0000bc8186178f6181`
- 本地 `evidence.json` 保存路径与摘要；包含同一 loader libraries 和 runtime sibling。

在该产物上完整 CLI Gate B、完整 TUI Gate B 均再次 exit0；日志分别为
`/tmp/lime-global-cli-gate-loader-final.log` 与
`/tmp/lime-global-tui-gate-loader-final.log`。最终 TUI evidence 目录为
`/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/tui-gate-b-VBuwqZ`。

另外只读使用前序 current `command-invocation-fixture.mjs --autonomous --tui`
与 `command-continuation-electron-gate-b.mjs`，不认领其既有实现：

- Native TUI：exit0，真实 runtime、provider fixture、OS shell、PTY、键盘、
  alternate screen 与 termios 恢复；模型 Turn 完成后 Command 继续运行，输入仍
  可编辑，原 Command 后续 completed 并冷读一致。日志
  `/tmp/lime-global-tui-native-command-final.log`。
- Native Desktop：串行复跑 exit0，真实 Electron/preload/IPC/current JSON-RPC /
  runtime backend；live UI 与 renderer reload 两场景的原 Command / process
  后续 completed、outputVisible、draftPreserved 均 true，console/page errors
  都为0。证据 `.lime/qc/gui-evidence/codex-global-alignment/command-continuation-summary.json`，
  `binarySha256` 与上述最终 App Server 相同。日志
  `/tmp/lime-global-native-electron-command-serial.log`。页面为
  `file:///Users/coso/Documents/dev/ai/aiclientproxy/lime/dist/index.html?nativeStartup=1`。
- 首次 Native Desktop 与 TUI 同时使用相同 binary path，夹具的全局 `ps` 唯一
  App Server 断言在业务场景前失败；日志
  `/tmp/lime-global-native-electron-command.log` 与
  `command-continuation-parallel-failure.json` 保留。停止夹具并发后使用同一断言，
  不放宽 cardinality、不合成 provider 或工具事件。

`smoke:agent-runtime-current-fixture` 聚合 exit0，日志
`/tmp/lime-global-gui-current-fixture.log`；覆盖真实 Electron 的取消后继续、
rich draft text/image/path/skill 恢复、图片 task、approval、steer、Plan / Skills /
MCP / read model 投影。其 controlled external backend 证明 bridge/GUI，不冒充
native tool cleanup；native tool 证据来自上面的 runtime 案例。

`verify:gui-smoke` exit0，日志 `/tmp/lime-global-gui-smoke-final.log`，当前壳、
reload、三个 viewport 与 settings 均通过。summary 为
`.lime/qc/project-gates/standalone-shell-01-20261012102315-46202/shell-01-electron-smoke/summary.json`。
同时发现工作树另有 settings layout 与五语言资源更新，本轮未写这些热区；
GUI builder 按现有 freshness gate 重建。证据按具体构建与 scope 记账，不宣称
覆盖其他写集之后的全部变更。

以下为前序 / 诊断证据，不能覆盖上述最终边界：

CLI unit/bin：`npm run test:rust:unit -- -p cli --bins --locked --jobs 1`
exit0，8 library +106 binary tests 全部通过，日志 `/tmp/lime-global-cli-unit.log`。
CLI strict：`npm run lint:rust -- -p cli --all-targets --no-deps -- -D warnings`
exit0，日志 `/tmp/lime-global-cli-clippy.log`。
`npm run test:contracts` exit0，日志 `/tmp/lime-global-contracts.log`。
定向 ESLint、Node syntax、Rust fmt 与 diff check 通过。

真实 SIGINT 红灯：旧 CLI 在可见 Command start 后直接被 SIGINT 终止，未返回
canonical exit130；日志 `/tmp/lime-global-cli-interrupt-behavior-red.log`。初始两轮
夹具 CLI 参数错误分别保留，不计作行为红灯。

新 CLI + 已有 target App Server 的 signal / exit130 / 最后回复文件 / 进程退出
通过，但 external fixture 的 synthetic Command 缺少独立 current publisher，取消
结果晚于 Turn terminal，不能作为真实 Command 取消证据。两轮失败保留，不靠改
CLI 输出或降低 terminal 断言通过；当前 fixture 直接改用 runtime backend、本地
Provider fixture、实际 `/bin/sh` 与 PTY process。

首轮 native 将取消误判为 failed；已核对共享 `project_command_status`，Cancelled /
Interrupted 的精确 canonical 状态是 declined。它不是命令退出失败，不改变投影
合同。修正为精确 declined 后，signal、原 Thread / Turn / Command、进程回收通过，
processId 仍缺失。所用 `target/debug/app-server` SHA256
`74059c7c9b4732c48603b6057f6ad2f381df034a334b6ad0680cd5741a5ab257` 与第128
已验收包不同；上述只算诊断，不冒充最新 current runtime 验收。

此前完整 CLI Gate B 已通过，日志
`/tmp/lime-global-cli-cancellation-final-rerun.log`，冻结产物位于
`/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/cli-gate-b-WCr7wb/binaries`。
该绿灯发生在最终 Aborted 投影与 `drain_turn` 合同修正前，仅作为诊断基线；
最终源码已重建并复跑相同 native predicates，结果见三端最终产物记录。

tool-runtime 最新完整 unit 已通过488项，日志
`/tmp/lime-global-tool-cancellation-final-unit.log`；真实 supervisor terminal tests
通过2项，日志 `/tmp/lime-global-process-terminal-tests.log`。后续最终证据另行记录。
正常 completed Turn 的后台 Command 在 session 卸载 / CLI 退出时的资源清理
仍需单独验收；上面三端证据覆盖自然完成与 foreground SIGINT，不能替代该场景。
Codex Desktop 实际 UI 观察受工具应用限制，记录为 not-run；Lime 三端最终
产物复验已完成。全局状态保持 active / partial。

## 未关闭差异与下一刀归属

1. Session-owned 后台 Command 的卸载 / 退出资源清理已由下方续接切片关闭。
   同责同名的 `shutdown_session_runtime` / `terminate_all_processes` 落在共享
   App Server / tool-runtime owner；stored session 保留到 terminal 落盘。真实
   stdio / CLI、关闭失败重试与 admission 竞态都有独立证据，非三端私有清理。
2. tool-runtime 的19项 strict lint 基线已在下方风格切片的 targeted lib gate 关闭，
   没有 blanket allow；这不等于整个 workspace 的所有 target 都通过 strict lint。
3. 目录 / 函数一一映射、TUI ordinary held reading / owned inline / dispatcher 与
   GUI route / sequence 的其它写集保持各自细分计划，不能因三端切片通过而关闭。
4. Codex Desktop 实际视觉、Windows、live provider、packaged installer 未验证。
   本机应用只读授权充分，Computer Use 的应用限制仍阻止真实 Desktop 观察；
   该限制不阻止公开源码与 Lime 主链继续实现，不能由本地源码或安装 metadata
   推导视觉一致。
5. 共享 shell policy 的子串误报：`shell_permission::check_bash_command_permission`
   对完整命令执行 lower-case contains，`printf 'SHUTDOWN_PARTIAL'` 因字符串
   literal包含shutdown被拒绝。现有fixture用CLOSE_PARTIAL才进入真实执行；
   Bash/POSIX后续切片已在共享tool-runtime owner关闭，详细结果见
   [Shell权限解析计划](shell-permission-alignment-2026-10-12.md)：2311项Rust unit、
   strict lib Clippy、CLI/TUI Gate B、GUI Command literal/reload、GUI current和
   GUI smoke全绿；真正危险调用、fork bomb、device redirect继续拒绝。
   PowerShell解析已由2026-10-13共享权限切片关闭；Windows实机仍待单独验收。
6. Command取消状态仍需按类别对照：当前aborted投影为declined；Codex
   `core/src/tools/events.rs`区分Failure::Message -> Failed与Rejected -> Declined，
   并说明部分runtime rejection也暂时报告Declined。用户拒绝、真实中断和setup
   failure尚未逐类比较，不把当前fixture的精确declined断言当成全面语义一致，
   也不未经对应Codex取消路径取证就宣布该映射一定是bug。后续归共享工具事件 /
   canonical projection owner；GUI / TUI只消费结论。

治理分类：current 为共享 App Server / runtime / tools / canonical projection 与
canonical shell policy；本地 provider / controlled external backend 仅 test-only。
无新增 compat 或 deprecated 后端；Codex 输入别名由同一 current parser 归一，
没有独立演进的别名执行路径。已删除该切片的固定 output grace、过期来源追踪假设、
shell_command 的派生决策及其旧 helper；没有恢复 retired runtime。

本轮切片完成度单独按退出条件记账，全局保持 active / partial，无可信全局分母，
不以文件同名率或测试数量制造整体百分比。设置、五语言资源、GUI 恢复与 TUI
projection 的其它并行写集未接管；验证覆盖运行时所见工作树，不代表其改动归属。

## 已完成：session-owned Command shutdown

责任 root；budget:normal；风险 P0 进程生命周期 / canonical 终态持久化。
Codex 对照：core/session/handlers.rs::shutdown_session_runtime（停止 admission、
abort tasks、terminate_all_processes）；共享 owner 不改变，不新增协议或依赖。

窄写集：tool-runtime/unified_exec 的 cancellation、session 和测试；agent 的
runtime_state/execution；App Server 的 runtime/session_shutdown 新模块、runtime
字段、turn admission 检查、thread_read 卸载 / 测试拆分、RuntimeBackend close_session
与 transport finish 接线；scripts/app-server 的真实关闭 fixture；本计划。已有补丁
备份 /tmp/lime-session-shutdown-before.patch 与 /tmp/lime-session-shutdown-before/。
GUI / TUI projection、settings、i18n、architecture 等并行写集只读；无子 Agent。

已确认根因：close_session 未回收 completed Turn 的后台 unified_exec；idle unload
先 remove StoredSession，使最终 Command publisher 丢失持久化目标；stdio EOF 只
关闭 transport/listener，提前退出绕过 delayed unload。

退出条件：

1. 关闭 Thread 时清理其所有 Turn 的后台进程，其他 Thread 保持运行；重复清理
   不重复 terminal；terminate -> wait -> drain -> persist 使用现有单一路径。
2. 关闭期间停止新 Turn admission / resume，保留 stored session 到最终事件落盘；
   close 失败保留最新状态、解除 closing，重试不生成第二 loop 或丢事件。
3. stdio EOF / CLI 正常退出执行同一共享 shutdown；真实 OS process 不残留，
   Command identity / output / terminal 冷读一致，不改变已完成 Turn 的状态。
4. 定向 Rust、相关 crates、真实 stdio / CLI、contracts、current GUI fixture 与
   GUI smoke；前端 121 批此前已通过，本轮不无理由重跑。

thread_read.rs 已超 1000 行：实施前迁出 inline tests 与卸载实现，父文件回到
800 行附近；不继续在该大文件堆业务逻辑。Windows / live provider / packaged /
Codex Desktop 像素一致不在本切片证据范围；全局仍 active / partial。

实现裁决：RuntimeCore 的 closing / shutting_down 标记与 durable turn admission 共用
state 锁；stored session 保留到 cleanup 成功，RAII marker 在失败或任务取消时释放。
正常卸载与 transport EOF 共用 shutdown_session_runtime；active Turn 继续调用已有
cancel_turn，避免重建 terminal 状态机。准备输入创建 actor 后再次检查 admission，
若遇 shutdown 则关闭该 actor。shutdown 等待已经开始的 idle cleanup，并逐 session
执行，单个错误不跳过其它 session。工具 owner 的 terminate_all_processes 按 thread
汇总所有 Turn，复用既有 cancellation pipeline；失败仍继续尝试其它 Command。

新增写集补点：runtime/session_lifecycle.rs、thread_fork/hydration.rs 的 admission
检查与 runtime/execution_backend.rs::close_session 注释。没有新协议 / crate / schema /
依赖；线程范围资源合同不改变 architecture.md 的 owner 图。

红灯与夹具纠正：

- 直接 Cargo 请求 rusty_v8 未发布 archive 404；改用仓库 test:rust 入口解决，
  没改依赖。日志 /tmp/lime-session-shutdown-red.log。
- 合同完整的旧卸载回归三个均红：SessionNotFound、关闭失败增量丢失、竞态
  创建 / 恢复。/tmp/lime-session-shutdown-red-reviewed-env-final.log。
- 旧 e916 App Server 的真实 shell archive 后仍 alive；断言未放宽，夹具只回收
  自身 PID。/tmp/lime-session-shutdown-stdio-red-final.log。
- 初版测试夹具缺 ordinal / background item.updated / outputRef、错把 user item 当
  Command、遗漏 event log；按真实 current 合同补齐，不改生产验证器 / projection。
- 首版 OS marker 包含 SHUTDOWN，被现有危险子串规则拦截；改成 CLOSE_PARTIAL
  才进入真实进程链。该规则误报另列后续对齐候选，未放宽生产安全策略。

定向反馈目前四条绿；失败重试测试仅缺 outputRef，已经补齐，扩大共享 owner unit
继续验收。新增取消中途释放 marker、transport 等待已有 cleanup、拒绝新 session
与过期 admission actor 的测试；thread_read 父文件已从1390行降为843行，原 tests
迁入同名目录。本切片尚未标完成，下一步是最终 Rust、真实 stdio / CLI / active EOF
及 current GUI 门禁。

验证补记：

- 最终 shared owner unit：App Server1818、tool-runtime490 全绿，共2308项。
  /tmp/lime-session-shutdown-owner-unit.log。五条 shutdown 新回归全部通过。
- contracts、fmt、Prettier、docs boundary、scripts governance / diff check 已绿。
- integration wrapper 会无条件追加 --tests，实际扩大编译所有 target；仅停止
  自有 Cargo16051（SIGINT），原日志 /tmp/lime-session-shutdown-jsonrpc.log 保留。
  用同一 resolveRustTestEnv + resolveRustyV8CargoEnv 直接指定四个 --test 续跑，
  /tmp/lime-session-shutdown-jsonrpc-exact.log；没有修改 runner 或降低断言。
- CLI Gate B 入口同步接入 standalone Command shutdown fixture 的 stdio、active
  EOF、CLI三种模式。TS sidecar.close 默认发送 SIGTERM，因此新夹具显式结束stdin
  并等进程正常 exit0，才能证明 App Server 的 EOF drain；finally 的 signal 只用于
  测试清理。Unix-only模式在 Windows 未执行，不能伪称该平台通过。
- 源码/协议边界仍为 current shared backend。真正 OS / GUI 验收仍待新产物。

真实关闭反馈与证据：

- 旧产物 active stdio EOF 后 Command 冷读仍 inProgress，
  /tmp/lime-session-shutdown-active-eof-red-final.log。
- 最终CLI / agent / TUI unit分别8、278、1882全绿；加 shared owner 共4476项。
  /tmp/lime-session-shutdown-consumer-unit.log。
- 四个精准JSON-RPC target共8项全绿，/tmp/lime-session-shutdown-jsonrpc-exact.log。
- 当前资源的 canceled Command 按既有 typed aborted -> declined 投影；初版夹具
  错假设 failed，按实际 current 合同改为精确 declined，不新增 accepted-status 集合。
  CLI JSON 使用 Codex 风格 item_N 的稳定别名，不能冒充canonical item_id；夹具
  分别证明CLI别名稳定、Thread一致、command一致、OS PID实际退出及原canonical
  Command冷读终态。生产投影 / protocol / CLI命名没有为夹具改动。
- 完整CLI Gate B exit0，含 stdio archive隔离 / active EOF / CLI正常退出三场景，
  /tmp/lime-session-shutdown-cli-gate-b-reviewed-final.log；前三次测试断言 / env错误
  日志保留，不作为产品回归。新场景分别证实 provider请求数4 / 1 / 2且清理不
  再sampling。源 binary冻结元数据 /tmp/lime-session-shutdown-reviewed.json。
- 初次完整TUI Gate B在tmux初始化失败：该宿主丢弃 DYLD_LIBRARY_PATH，直接
  frozen Mach-O尚未补 @executable_path rpath；其他真实PTY入口已绿。复用既有
  prepareLocalAppServerBinary 在新的loader副本上补齐；不修改TUI代码 / tmux测试
  或降低断言，继续复验。该Mach-O digest与首次frozen artifact分别记账。
- GUI current fixture使用另一个副本避开host的binary path cardinality，初次副本
  metadata未写完时启动入口失败；等拷贝完成后实际聚合继续，日志final独立。
  Electron资源准备也会改Mach-O digest，结束时重新记录实际hash，不能沿用copy前
  metadata中的值。当前 GUI / TUI 验收仍pending，全局计划不关闭。

### shutdown 切片最终裁决

- 完整 GUI current fixture exit0：
  `/tmp/lime-session-shutdown-gui-current-fixture-final.log`。真实 Electron / preload /
  IPC / App Server current bridge 覆盖图片、停止后继续、审批、rich draft、steer、
  Plan、Skills、MCP、media、typed retry 和文章工作区；external backend 为显式
  test-only，`liveProviderUsed=false`。结构化摘要在
  `.lime/qc/gui-evidence/claw-chat-current-fixture/`。
- `npm run verify:gui-smoke` exit0：
  `/tmp/lime-session-shutdown-gui-smoke-final.log`。证据
  `.lime/qc/project-gates/standalone-shell-01-20261012120840-28153/shell-01-electron-smoke/summary.json`
  为 pass，覆盖真实 Electron 启动 / reload / preload / IPC / App Server initialize、
  Settings 和1536×960、1280×800、980×680布局；没有 provider Turn，不以它替代
  上述 GUI current runtime 证据。
- loader 副本的第一次完整 TUI 在 queue-edit 等待 `queued (1)` 时失败，日志
  `/tmp/lime-session-shutdown-tui-gate-b-loader-final.log`。同一产物串行缩小到
  `LIME_TUI_GATE_B_SCENARIOS=queue-edit` 后 exit0，日志
  `/tmp/lime-session-shutdown-tui-queue-edit-serial.log`；随后默认完整
  `npm run smoke:tui-gate-b` exit0，日志
  `/tmp/lime-session-shutdown-tui-gate-b-serial-final.log`。真实 PTY / queue / approval /
  interrupt / reconnect / images / Skills / alternate screen / tmux resize / editor /
  terminal restore 均通过；没有改 TUI 代码、放宽断言或延长 timeout。前次未稳定
  复现的失败保留为测试稳定性观察，尚不能归因于负载或认定产品修复。
- 在最终 loader 字节上串行复验 standalone 关闭 fixture 的 stdio archive隔离、
  active EOF、CLI正常退出三个模式，全部 exit0：
  `/tmp/lime-session-shutdown-cli-loader-closure-final.log`。OS进程退出、原
  canonical Command 的 output / terminal 冷读和 Thread隔离均成立。

最终产物按实际文件分别计算 SHA-256，记录
`/tmp/lime-session-shutdown-gui-actual-hashes.json`，而非沿用拷贝前 metadata：

| 验收入口                        | CLI SHA-256                                                        | App Server SHA-256                                                 |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 首次完整 CLI Gate B             | `8ff2c7c0d53df63569890517c5804ada84ebdf57fe90692f439684a8a706ed55` | `fd505223dc1ad2231d2ea71f699d11eeba4530b7d731eea1c113a5e68823f1a6` |
| 完整 TUI / 最终关闭 fixture     | 同上                                                               | `13256438dbfbdb980364eb54915aaebbfbb9359299814744752811ceead10ae1` |
| GUI current fixture / GUI smoke | 不适用                                                             | `13256438dbfbdb980364eb54915aaebbfbb9359299814744752811ceead10ae1` |

GUI smoke 的 code-mode-host 摘要为
`dc2b6d8500a6d916542b4029b11261ec3885c70eeda9b65eabc492aebb10f3c9`，与当次
`dist-electron/app-server.release.json` 一致。首次 CLI 与后续 loader 字节不同；
后续 TUI / GUI / 关闭复验的 App Server 实际字节相同。

本切片四项退出条件完成，完成度100%。current 为共享 runtime shutdown / tools /
store；新增 fixture 仅 test-only。无新增 compat / deprecated，直接替换并删除
remove-before-drain 卸载逻辑；测试迁入同名模块，thread_read.rs 从1390行降至843行。
4476项 owner / consumer unit、8项JSON-RPC、contracts、fmt、Prettier、docs边界、
脚本治理与三端实际入口均通过。前端121批为前序证据，本轮不重跑；`verify:local`
聚合和广域 strict Clippy 未取得最终全绿，不伪称整个仓库全绿。
Windows、live provider、packaged 与 Codex Desktop 视觉仍未验证，全局保持
active / partial，不把此100%推广为全局百分比。

## 已完成：共享工具 owner 的风格与结构

目标：关闭已有19项 tool-runtime strict Clippy 差异，并按职责收敛重复 helper 和
过大的测试模块。Codex `core/src/tools/context.rs::boxed_tool_output` 与
`registry.rs::AnyToolResult` 使用 boxed tool output；本轮沿既有 typed outcome
缩小大 variant，不引入动态工具接口。公开 RPC / schema / 依赖 / owner 图不变。

窄写集（全部归 tool-runtime/src）：apply_patch、command_semantics、
execution_approval、file_read_execution、mcp_connection/step_snapshot 与新 tests
子模块、mcp_notification、mcp_resource、memory_store/executor、path_guard、path_uri、
skill_gate、skill_runtime_contract、tool_executor、tool_io、tool_result；boxed outcome
的两个既有 constructor 接线在 unified_exec/lifecycle 与 agent_control 的现有测试。
本计划同步结果。除本进程已持有的 tool_executor / lifecycle 外，上述文件在开始
盘点时均为 clean；既有脏补丁先保存，不回退。GUI / TUI / settings / i18n 和其它
runtime 热区只读，不创建 Agent / 分支或提交。

实现原则：共享 Unicode 字符截断归 existing tool_io，删除 MCP notification /
tool result 的重复实现；MCP discovery 用一个局部 context 收拢 sampling step
参数，inline tests 直接迁入同名子目录；skill preflight 的大 metadata 和 tool
result variant 使用 Box，保留现有投影 / 错误文案 / permissions / multimodal。
其它改动为显式条件、标准 iterator 与借用，不新增 blanket allow。

退出条件：当前源码 targeted strict Clippy 红灯确认19项；修改后 lib strict绿灯、
tool-runtime 全部 unit通过、shared consumers 编译通过，必要时补现有MCP /
Skills / Command真实fixture。新产物独立验证，不把shutdown旧字节用于新风格
代码的最终运行声明。若全仓其它crate仍有诊断，明确保留全局风格 partial。

风格切片验证进度：

- 当前 targeted lib red 确认19项诊断，
  `/tmp/lime-tool-style-clippy-red.log`；实施后
  `cargo clippy --manifest-path lime-rs/Cargo.toml -p tool-runtime --lib --no-deps -- -D warnings`
  exit0，日志 `/tmp/lime-tool-style-rust-final.log`。未用 allow 压制诊断。
- 上述连续命令中的 consumer package 首次误写为目录名 agent；manifest 声明为
  lime-agent。该入口错误发生在测试启动前，校正后独立续跑，不算产品失败。
- 首次把五个 package 合并为一个测试 graph 时，TUI / agent / App Server编译
  因 `No space left on device` 失败，可用空间仅254 MiB；日志
  `/tmp/lime-tool-style-rust-tests-build-final.log`。清理只覆盖该次失败测试日志
  birthtime之后新建的5640个deps缓存文件和27个incremental目录，先确认没有
  active Cargo锁，清单 `/tmp/lime-tool-style-failed-build-cleanup.json`。源码、
  既有缓存、用户数据、源备份、历史验收摘要与二进制快照均保留；清理后可用7.8 GiB。
- 改用此前已验证的 app-server / tool-runtime 与 lime-agent / cli / tui 两组
  `npm run test:rust:unit`，`-j 2`限制构建并发，全部exit0：
  `/tmp/lime-tool-style-rust-scoped-final.log`。1818 + 490 + 278 + 8 + 1882，
  共4476项；没有因此改 profile、依赖、断言或源代码。
- MCP生产模块由1199行降至396行；tests.rs为682行，共享fixture为148行，
  此次拆分后的生产与测试文件均未继续超过800行。原15个snapshot回归保持名称与
  断言，迁出共享夹具后定向15/15通过，日志
  `/tmp/lime-tool-style-snapshot-build-final.log`。tests/fixtures只归该领域测试，
  不新增production facade。
- 源备份 `/tmp/lime-tool-style-before/` 保留17个初始文件与摘要；额外仅新建
  MCP同名tests.rs和tests/fixtures.rs。fmt、Prettier、docs边界、scripts治理、
  diff check已通过。production代码的最终三端新产物验收仍待收取。

### 风格切片最终裁决

三端新产物顺序验收全部exit0，汇总
`/tmp/lime-tool-style-product-results.json`；不并行争用真实PTY / Electron：

| 入口                                          | 结果与证据                                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run smoke:cli-gate-b`                    | exit0；`/tmp/lime-tool-style-smoke-cli-gate-b-final.log`，含SIGINT、三种Command shutdown、reasoning、resume / fork、images、schema与stdin / output-file  |
| `npm run smoke:tui-gate-b`                    | exit0；`/tmp/lime-tool-style-smoke-tui-gate-b-final.log`，含queue-edit、approval、interrupt、reconnect、images / Skills、真实PTY、tmux与terminal restore |
| `npm run smoke:agent-runtime-current-fixture` | exit0；`/tmp/lime-tool-style-smoke-agent-runtime-current-fixture-final.log`，真实Electron current bridge；`liveProviderUsed=false`                       |
| `npm run verify:gui-smoke`                    | exit0；`/tmp/lime-tool-style-verify-gui-smoke-final.log`；真实Electron shell / reload / Settings与三种窗口尺寸                                           |

GUI smoke结构化证据：
`.lime/qc/project-gates/standalone-shell-01-20261012125308-58859/shell-01-electron-smoke/summary.json`，
result=pass。GUI current fixture继续覆盖图片、自然语言媒体、停止后继续、审批、
rich draft、steer、Plan、Skills、MCP、typed retry、文章工作区等；保留GUI多模型 /
多模态 / 主题 / Banner / Hero，未新增私有后端或production mock fallback。
最新GUI摘要使用既有目录；历史run identity与阶段结果以各自log为准。

构建与loader准备后分别冻结terminal / GUI副本，元数据
`/tmp/lime-tool-style-reviewed.json`；验收结束后重新核算实际文件，记录
`/tmp/lime-tool-style-artifact-actual.json`，digest与原冻结值无漂移：

| 实际产物                              | SHA-256                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| terminal CLI                          | `8ff2c7c0d53df63569890517c5804ada84ebdf57fe90692f439684a8a706ed55` |
| terminal / GUI current App Server     | `9413d2be027a126e205209d7eb3dc59de021e71cb0dce44a7be4c782382d2665` |
| terminal / GUI current code-mode-host | `5c5713905a8f00fc374848e8d5288051d082e6d1f54a0ad737989126e7cf0533` |
| 标准GUI smoke App Server resource     | `8285c09832e1dba026d9246f54e415b24f004f9d23a7b6604c5d7ee96eafad0d` |
| 标准GUI smoke code-mode-host resource | `dc2b6d8500a6d916542b4029b11261ec3885c70eeda9b65eabc492aebb10f3c9` |

标准GUI smoke使用自己的资源构建入口，摘要与当次app-server.release.json一致；
其字节区别于terminal / GUI current副本，不以一个digest冒充全部入口。
最终19个源码文件摘要 `/tmp/lime-tool-style-source-final-hashes.json` 在Gate结束后
核对无额外变化；验证覆盖当时工作树，不代表其它并行写集归属。

contracts在新源码上exit0（App Server client299项、protocol drift=0、mock priority=0），
fmt、Prettier、docs边界、scripts治理与diff check均通过。4476项Rust unit与15项
定向snapshot回归的结果保留；只迁出已有测试，不新增重复定义断言。
本切片退出条件完成，完成度100%；共享shutdown切片仍为100%。

治理分类：current为原tool-runtime / App Server / runtime / store owner与共享
projection；MCP / Command fixture为test-only；无新增compat / deprecated。
直接删除两份重复truncate_chars和旧remove-before-drain逻辑，不保留包装入口。
KISS体现在标准iterator / 显式条件，DRY体现在共享I/O helper，单一职责体现在
shutdown / discovery context / 独立tests与fixture；无新增crate、协议或依赖。
GUI / TUI projection、settings、i18n等避让写集未接管；没有git提交、推送或分支。

全局对齐仍active / partial：目录 / 函数逐职责映射、其它owner风格、终态分类与
PowerShell policy与取消终态继续按前方未关闭差异推进。Windows、live provider、packaged与
Codex Desktop真实视觉未验证；`verify:local`聚合与全workspace strict矩阵未取得
最终全绿。本轮是macOS source-tree可复查切片，不能升级为全面复刻或release
readiness；全局百分比仍没有可信分母。

## 共享 PowerShell 权限与实际 shell 路由（2026-10-13，切片100%）

本刀将PowerShell权限解析与实际shell路由收敛到既有tool-runtime/App Server，
三端仍消费同一Thread/Turn/Item，不新增GUI私有后端。按真实argv识别shell，支持
绝对路径与POSIX -lc；pwsh跨平台使用-Command并按login控制profile。Codex固定
0.26.4 grammar的受限CST/literal lowering替换PowerShell全文危险/警告regex，
普通Restart-Computer/危险删除等quoted data不再误拒绝，动态/复杂语法审批，真实
字面量危险操作、encoded/IEX/跨shell嵌套、默认mutation aliases与路径护栏有回归。
源代码保留Apache-2.0/LICENSE/NOTICE，领域模块与独立tests均小于800行。

最后alias补丁后501+1819=2320项Rust unit、68条AST corpus、tool-runtime lib
--no-deps strict Clippy、contracts/version/fmt/Prettier/docs/scripts checks均通过。
最终新产物7项产品gate全exit0：PowerShell stdio/CLI/Desktop、完整CLI/TUI、GUI
current聚合与GUI smoke。真实portable PowerShell7.6.6在隔离临时目录，官方完整
归档摘要验证，无全局安装。Desktop原文字面量输出、renderer reload、原进程/回合
identity、notification、草稿、真实preload/IPC、parent=Electron、mock=0有证据。
GUI多模态、多模型、主题/Banner/Hero保留（Unit/Component与GUI current各按自身
proof level记账）；所有场景liveProviderUsed=false，不能当live模型测试。

详见[shell-permission-alignment-2026-10-12.md](./shell-permission-alignment-2026-10-12.md)。
仓库证据.lime/qc/gui-evidence/powershell-permission-2026-10-13/validation.json与
command-continuation.json/PNG、powershell-stdio.json、powershell-cli.json；最终
源码/hash无漂移。current归既有tool/runtime/path/store，fixture为test-only；已
删除全文regex与dead字符串风险入口，无compat/deprecated包装。没有接管GUI/TUI
projection、settings、i18n或其它未知热区，没有commit/push/branch/Agent。
主链图与owner未改变，本刀不构成新增后端或重大架构owner迁移。

下一刀：真实截图确认ToolCallDisplay的running result panel隐藏，PowerShell PTY
private CSI序列[?1h在文字里残留；原fixture只在摘要找marker的弱断言已改为
completed后展开真实result panel。先追踪共享output与presentation事实源，再
处理运行中Command可见输出；取消终态分类和全局目录/命名/风格矩阵继续active。
Windows、packaged、live provider与Codex Desktop真实视觉未验证；verify:local全仓
聚合及workspace all-target strict未取得本轮全绿。全局仍partial，没有可信百分比。

## Command 运行中输出与终端序列展示（2026-10-13，切片100%）

主目标：三端共用 canonical Command 执行、输出与恢复；本刀修正 GUI 两种工具
卡的运行中输出披露，保留多模型、多模态、主题、Banner/Hero。
Codex 参考 `tui/src/exec_cell/render.rs` 的 `ansi_escape_line(raw)` 与
`ansi-escape/src/lib.rs`：终端控制序列在 presentation owner 解释，不改写执行数据。

窄写集：ToolCallDisplay.tsx、ToolCallDisplayViewModel.ts、其 unit 测试、
InlineToolProcessStep.tsx、独立 command output component 回归、共用
utils/terminalOutputText.ts 及 unit 回归、现有 command-continuation Electron
fixture 和本计划。既有源码起点备份 `/tmp/lime-command-output-before-2026-10-13/`。
只读 backend / protocol / store / CLI / TUI；避让其它 GUI、settings、i18n 与未知
脏写集。本刀不改命令合同、依赖或架构主链，不需要新后端或兼容入口。

退出条件：运行中实际输出可展开，增量和终态维持用户披露状态，renderer reload
恢复同一 process/thread/turn/item；PowerShell private CSI、ESC keypad、OSC 等
控制序列不泄漏为文字；拆分的序列按累计原始输出重新投影，canonical 原文保留。
纯转换用 unit 回归，披露/增长/终态用 component 回归，最终实际 Electron Gate B
证明释放 OS process 前全文可见，完成后原 identity、draft、notification 保持。

验证顺序：定向测试与静态检查 → agent runtime current fixture → GUI smoke →
PowerShell 与 POSIX Command Desktop Gate B。产品 gate 串行，构建成功后才使用
冻结产物；记录源码和实际二进制摘要。Windows、packaged、live provider 与
Codex Desktop 真实视觉不由本刀证据替代。状态与验证结果在收尾更新。

中间验证：初始red为22失败/10通过；修复后8文件88项通过，再补强运行中与失败
终态的真实样式转换回归，该文件11项通过（当前切片89项不同case，重跑不重复计数）。
类型检查、定向ESLint、Prettier、docs边界和scripts治理通过。新renderer/host
构建已收取exit0；App Server复用前刀冻结产物，Rust源码与命令合同未修改。
测试文件受控补强后更新源码摘要，production source与renderer/host摘要无漂移。

`verify:local`实际exit1，版本、五语言资源及unused检查先通过，随后全仓lint阻塞：
其它脏写集WorkspaceHarnessDialogs.tsx:173未使用hasRuntimeWorkbenchSignals；
WorkspaceFilesSurface.tsx:32/42/48三项react-refresh导出warning。未夹写这两处文件，
不宣称全仓门禁通过。日志 `/tmp/lime-command-output-verify-local.log`。
两种大型工具组件只接线到共用纯展示helper；本刀无新增协议、i18n文案、依赖或后端。

真实PowerShell Gate B首轮失败：canonical running aggregatedOutput只剩最后一段
Restart-Computer，前面的private CSI与ready行消失。失败JSON/PNG保留为本目录
first-powershell-command.\*；原始durable event log的outputSequence1/2/3完整存在。
根因是App Server materializer将每个command.output delta的preview按snapshot替换。
扩展窄写集仅接管原本干净的thread_item_projection/change_set.rs、其command_tests.rs、
materializer.rs与materializer/lowering.rs；同目录原始起点已补备份。输出delta逐段
追加原始文本，typed lifecycle仍完整快照替换，不使用内容去重、不修改原始事件。
补delta分块/重复内容/回放/快照回归后，重建冻结共享产物并重新验证三端与桌面。
这是既有canonical投影owner的缺陷修复，未迁移架构owner、协议、runtime或数据库。

续接公开JSON-RPC回归：夹具command.output起初缺少schema必需的outputRef，修正
夹具后首段可读，第二段仍覆盖首段，确认持久化按单批materialize而通知按历史
materialize的接线差异。追加原干净canonical_thread_store.rs的apply_canonical_events
方法：只将该方法抽入同名目录event_batch.rs，不向1457行父模块继续堆逻辑。
父模块本轮净缩减；其余领域拆分退出条件为后续目录/职责映射切片，未在本刀扩散。
有Command delta的批次复用同一materializer及stored事件上下文，仅将该批变更的
Command替换为累计快照；其它Item与store的snapshot合同保持。thread-store不增加
第二套delta解析。新增tests/command_output_jsonrpc.rs按public initialize/thread/start/
turn/start/thread/read逐段验证，重复文本、空白、终态和cold公开读取均有强断言。
2026-10-13公开回归exit0，完整App Server unit与新共享产物验证继续运行；旧产品
gate结果不能替代本后端补丁的验收。追加写集起点备份同前目录；避让原脏event_store、
appender、turn_execution、GUI workspace/settings/i18n，不提交、推送或创建分支。

当前共享验证：公开JSON-RPC回归1项、完整App Server unit1820项、新共享build与
Electron fixture resources build均exit0；最终前端定向6文件68项复验exit0（先前
89项不同case证据保留，重复执行不重复计数）。17个源码摘要无漂移，冻结后端与
Electron resources分别记录，不能用digest不同推断构建图一致或不一致。
额外App Server lib --no-deps strict Clippy实际exit101，121条诊断涉及74文件；
清单见.lime/qc/gui-evidence/command-output-2026-10-13/app-server-clippy.json。
本刀新增分支/方法没有诊断；materializer.rs:365 consecutive replace为HEAD与
起点备份已有行。其它runtime、import、MCP、verifier等写集未接管，不加allow，
不宣称App Server strict通过。全仓风格差异仍active，优先按owner及文件尺寸
逐块处理，不能在产品门禁运行中改生产源码或延长交互预算来制造绿灯。

第二轮真实PowerShell仍失败（second-powershell-command JSON/PNG保留），原始事件
seq16/17、29/30、31/32成对为tool.output.delta/command.output。前者按普通Tool
lowering覆盖同id的Command，导致后者追加时前缀已丢。公开夹具原先只有command
事件，没覆盖此真实镜像形状。已补纯投影及公开JSON-RPC的成对事件，新增强断言
先记录red：native output mirror must preserve the canonical Command owner。
修复仍在既有lowering owner：executionSurface=unified_exec的原始Tool输出属于
Command；它只携带现有Command快照，delta仅由command.output追加一次。普通Tool
与MCP流仍沿自己的owner。未改原始event log或放宽fixture预算；新共享测试与产物
重跑，第二轮current聚合/GUI smoke绿灯作为中间证据，不算最后native镜像补丁验收。
先复测最小真实PowerShell/POSIX失败predicate，再跑最终current聚合与GUI smoke，
最后串行CLI/TUI Gate B；持续记录原失败与所有未验证范围。

### 最终验收与范围

最终17个认领源码/fixture摘要无漂移；514个renderer、host、resource文件与冻结
CLI/App Server/code-mode-host摘要复查无漂移。最终冻结目录command-output-final-xMd3d7，
App Server SHA256 f04e9edc73012f8d6af40975321f177e8164d2b19a241f86dcdf591feda0bad5。
GUI resources属独立构建图，SHA256 089c89daad27168689ddf62c283711561d22e662b562bac9b39b65c9be7e8a5b，
源码与产物对应关系、原始log及每个Electron场景摘要均保存在
.lime/qc/gui-evidence/command-output-2026-10-13/validation.json及logs/。
first/second-powershell-command.\*失败证据保留，未放宽超时、原文、行数或identity断言。

最后native镜像补丁后的结果：公开JSON-RPC 1项与App Server unit1820项exit0，
含incremental/cold projection、分块控制序列、重复行、空白、同事件回放与snapshot
边界。前端定向68项最终复验exit0，先前89项不同case有独立证据；没有重复计数。
contracts最终exit0；fmt、定向ESLint、Prettier、版本、docs/scripts守卫均通过。
六个最终产品gate全部exit0：PowerShell/POSIX Desktop、current聚合、GUI smoke、
完整CLI stdio及TUI真实PTY。current聚合实际173项fixture guard及22个Electron
场景；liveProviderUsed=false，provider为受控fixture，生产mockFallback=0。

PowerShell/POSIX在真实OS process仍运行且尚未写release时展开全文，所有实际输出
行恰好一次；raw aggregatedOutput保留private CSI/ESC，visible transcript去除它们。
自然完成及renderer reload维持同process/thread/turn/item、completed通知、exit0、
草稿、可用composer；共享权限解析未将quoted Restart-Computer当成系统操作。
两张PowerShell running截图已目视确认输出、无控制残留、主题及模型/权限/附件入口。
GUI多模态/多模型/主题/Banner/Hero保留按各自Unit/Component/current证据分级，
没有新增GUI私有后端。CLI/TUI恢复、中断、shutdown、typed输入、图片、工具、
权限及终端恢复按现有完整Gate的实际场景验收；CLI human TTY分支因outer stdin
不是TTY记not-run，TUI真实PTY证据不替代该分支。

认领写集为本节GUI组件/展示helper与回归、command Electron fixture、共享
thread_item_projection四文件、canonical_thread_store父模块/独立event_batch模块、
公开JSON-RPC regression及本计划。避让GUI workspace/settings/i18n、其它CLI/TUI、
runtime event_store/appender/turn_execution等既有未知脏写集；验证覆盖当前工作树，
不代表它们的改动归属。架构owner/主链/公共协议/依赖/schema未迁移，无重大架构
图变更；本刀仍为既有owner内部缺陷修复。没有commit、push、branch或子Agent。

治理分类：current是共享App Server canonical materializer/store边界与GUI纯展示
owner；fixture为test-only。已替换delta按preview覆盖、raw镜像降为普通Tool以及
运行中隐藏Command全文的旧逻辑；无compat/deprecated或retired回流。DRY复用单一
materializer与终端展示helper；KISS/SOLID体现为纯转换、typed事件和独立批次模块，
不增加协议包装、数据库或runtime。本切片退出条件全部满足，完成度100%。

全局仍active/partial：verify:local在其它脏Workspace文件lint处exit1；App Server
strict Clippy最终仍exit101（121条/74文件，无本刀新增诊断），已保存逐位置清单。
因此不宣称全仓绿灯或release readiness。Windows、packaged release、live provider、
本机Codex Desktop真实视觉未验；其未访问限制仍沿用本计划前文，不能用本地截图
冒充Codex Desktop一致。全局没有可信分母，不给虚构百分比。
下一刀继续取消终态分类与目录/函数/代码风格逐职责映射；Clippy优先按既有owner
拆分大型模块后关闭诊断，避免扩散到正在被其它写集持有的runtime热区。

## Command 拒绝与运行后中断的终态分类（2026-10-13，投影已验收 / 稳定性跟进 active）

主目标仍为 CLI/TUI/GUI 共用 App Server、RuntimeCore 与 canonical Thread/Turn/Item。
本刀对照 Codex core/tools/events.rs 与 app-server-protocol/v2/item.rs：保留四态合同，
执行前的类型化拒绝为 declined，进程运行后取消/中断为 failed，Turn 保留 interrupted。
Codex 对 ToolError::Rejected 的现存宽分类 TODO 不复制为文本猜测或运行后拒绝。

窄写集：原干净 tool-runtime/tool_result_projection.rs、App Server
processor/thread/projection/{command.rs,item.rs}、独立 command 投影测试与公共
command_status_jsonrpc 集成目标、新增 scripts/app-server/command-status-fixture.mjs；
已有本任务 CLI interrupt 与 command shutdown
夹具仅替换终态断言。起点备份 /tmp/lime-command-status-before-2026-10-13/。
GUI、TUI、agent producer、其它 runtime/store、settings/i18n 与未知脏写集只读。
无新增 enum、协议 method、schema、依赖或架构 owner，三端继续共享同一投影。

退出条件：类型化审批拒绝与取消不运行 handler，公共读为 declined；审批等待/执行
失败保持 failed；实际进程中断保持输出、process/item/turn identity，读为 failed，
Turn 为 interrupted；live notification 与 cold read 一致，不靠错误文本判断。
定向 Rust red/green、公开 JSON-RPC、contracts 后构建并冻结产物，再串行 current
fixture/GUI smoke、真实 CLI stdio/SIGINT、TUI PTY 与进程 shutdown fixture。
Windows、packaged、live provider、Codex Desktop 实际视觉仍单独记为未验证。

本轮只读新增差异：approval_server_request.rs 的 failed_approval_decision 将真实
server-request 失败降为 Decline；Codex 将 client/deserialize/channel failure 降为
Failed。该入口不在本刀写集，先记录为下一刀 approval transport failure owner
收口；本刀“审批等待失败”回归只证明 executor 已产生 ExecutionFailed 时的投影，
不能替代真实 reverse-request 失败分类。实际审批 Cancel 走 Turn interrupt 分支，
已补真实 stdio fixture 分别验证 decline/cancel，结果收取后再决定根因补丁。

真实 stdio 首轮 decline 已正确为 declined，夹具错误地要求可选 processId/exitCode
必须是 null，typed client 实际省略空字段；仅修正无值断言，保留 first-approval-status
失败 evidence。第二轮 decline 通过，cancel 实际为 failed，second-approval-status
保留原失败与 canonical/notification。durable item.completed 为 cancelled、
tool_outcome=aborted、commandArgv=[]、unifiedExecStartup，无 processId，Turn interrupted。
canonical producer 用显式空 argv 记录 preparation；真实 execution start 必须替换为
prepared argv/process identity。本刀只扩展共享投影：上述完整 preparation 事实
允许 cancelled -> declined；实际 process、非空 argv、未知 cancellation 仍 failed。
无 agent/runtime 热区补丁，不通过仅缺少 processId 或错误文本猜测。新增 public
approval-cancel 与强负向 unit 回归，最后补丁后重建、冻结并重新验证。

构建期间其它写集将仓库版本 1.155.0 -> 1.156.0；认领 9 个源码/fixture 摘要
未漂移，7005 个 Rust/GUI/Electron 与 manifest 构建输入在新版本下未漂移。
新版本一致性检查通过，未接管或撤销版本、依赖或其它 owner 写集。额外 App Server
全量 unit 重编译与另一组 Rust 构建争用 16GB 机器的内存，738383ms 后仅主动
SIGINT 本任务 compiler(pid=27697,parent cargo=22918)，结果 exit101；原始 log
及未完成结果保留 validation-before-resource-adjustment.json，不算通过。
最近完整 App Server unit1821 属 1.155.0、最后 preparation 取消补丁前的中间证据；
最终定向 projection30/public5 已覆盖最后补丁，但前者在版本同步前运行，不能
冒充 1.156.0 全量 unit。最终按新版本 shared build、public JSON-RPC、CLI exec
定向、tool-runtime strict、冻结产物与真实产品 gate 收口；scope 不升级为全仓绿灯。

续测恢复：首次 strict 因本机 V8 artifact cache 消失而失败，日志留存为
validation-missing-v8-cache.json；通过仓库既有 resolver 恢复官方 150.4.0 artifact
并核对 SHA，没有变更依赖或清理其它进程。最终 tool-runtime strict Clippy exit0。
1.156.0 public JSON-RPC5、CLI exec54 与 shared build 已 exit0，Electron renderer /
host / sidecar / native resources 正在按 current 构建图重建，产品 gate 尚未验收。

交接后原 /tmp 的7005项 build-input manifest 已缺失；9个认领源码摘要仍可核对且
无漂移。重新留存7373项 current Rust/GUI/Electron/package/public/plugin输入基线，
记录 build-input-baseline.json 的时间与范围；它不能证明旧快照的连续性。为此追加
共享二进制构建确认，再冻结新产物，并要求产品 gate 前后新基线及产物摘要无漂移。

最终真实审批 decline/cancel 已 exit0：Command declined、无 process/exit、未创建
执行副作用，单一 terminal notification 与 cold read 一致；cancel 的 Turn interrupted
且不追加 provider sampling。stdio archive 隔离、active EOF、CLI正常退出三个
shutdown 模式已 exit0，原 Command 现在 failed 并保留输出和进程身份。
临时验收 runner 误传夹具明确禁止的 --cli --active 组合，exit1，失败日志留存
product-results-invalid-invocation.json；修正 runner 的调用组合，没有放宽夹具。
CLI活跃命令中断由完整 CLI Gate B 内的真实 SIGINT JSON/human 场景验收。

完整 CLI Gate B 首次 direct artifact 运行在真实 Command 启动后 SIGINT 超时，
exit1，日志保留 cli-gate-b-first-timeout-result.json / logs/cli-gate-b-first-timeout.log。
没有改 timeout、生产状态机或错误分类。通过临时透明 stdio 记录代理诊断，原
冻结 backend 的 JSON/human 中断均正常 exit130，Turn interrupted、Command failed、
OS子进程已回收；turn/interrupt response 分别1009ms/725ms。诊断完整入口 exit0，
wire、timing 与结果已归档，但代理运行不替代 direct Gate B，首次超时根因未证实。
再次 direct 运行保留临时目录以便失败时读取 durable events；TUI/GUI仍待收取。

### 本刀最终验证与范围

证据入口：`.lime/qc/gui-evidence/command-status-2026-10-13/validation.json`。
当前版本1.156.0。最终定向 public JSON-RPC5、CLI exec54、tool-runtime strict Clippy、
shared build、输入基线确认后的 shared build 和 Electron fixture build 共6项 exit0；
contracts、版本一致性、此前 fmt / Prettier / scripts / docs 守卫均已通过。
旧 App Server1821、TUI1882等完整 unit 仍是中间版本证据，不作为新版本完整 unit。

最终产品门禁8/8 exit0，门禁完成率100%，不是全局对齐百分比：

- 真实 stdio 审批 decline/cancel；原 Command identity、无进程、无执行副作用、
  单终态通知与 cold read 一致，cancel 的 Turn interrupted。
- stdio archive隔离、active EOF、CLI正常退出三种 shutdown，真实进程退出、
  Command failed、输出和原 identity 保留，provider请求数不因清理增加。
- 完整 direct CLI Gate B，包括 JSON/human SIGINT exit130、原回复文件保留、
  canonical interrupted / failed 与 OS进程退出。两类中断的 result/canonical JSON
  已复制到本轮 `cli-interrupt-final/`，首次超时与代理诊断仍单独保留。
- TUI Gate B，包括真实 PTY、alternate screen、键盘交互、tmux resize/editor、
  replay / cold read 与 terminal restore；不能用它替代 CLI outer human TTY分支。
- current fixture聚合，实际解析并归档22个真实 Electron受控场景摘要；其中审批等
  场景是 external test backend，经真实 current bridge / RuntimeCore / read model。
  这些场景不能代替 live provider 或所有 shared tool-runtime行为的原生GUI验收。
- GUI smoke真实 Electron启动、preload/IPC、App Server JSON-RPC初始化1.156.0、
  工作区/reload、设置路由与三种窗口尺寸。该 smoke没有 provider Turn，详细
  claimBoundary 见 `gui-smoke-final/summary.json`，不宣称 Codex Desktop像素一致。

9个认领源码/fixture摘要无漂移。7373项宽输入基线中，只有未知并行写集的
`src/components/AppSidebar.search.test.tsx`变化：Vitest测试、无生产导入，且被
既有 Electron fixture生产构建扫描明确排除。保留原/新SHA与test-only分类到
`concurrent-test-inputs.json`，没有更新旧基线或覆盖该文件；生产输入无漂移。
这是宽扫描包含测试产生的变化，不隐去为“所有输入无漂移”。

冻结 CLI/App Server/code-mode-host与库继续独立记账。current fixture前772项
artifact快照保留；GUI smoke按自身入口重建后869项快照另存，97项新增资产、
`dist/index.html`变更，旧772项的其它摘要保持一致。两次构建图不强求字节相同，
差异与owner记入 `artifact-graph-transition.json`。最终artifact无后续漂移只表示
GUI smoke后快照到证据收取的一致性，不冒充两个构建期间的连续冻结。

治理分类：新行为为 current shared tool-runtime / App Server projection；独立 Rust
回归与stdio夹具为 test-only；本刀没有compat / deprecated迁移或dead目录操作。
GUI多模型、多模态、主题、Banner/Hero继续按product-extension保留。函数与测试
进入既有短领域模块，无新品牌前缀、协议enum/method、依赖或架构owner。

全局保持active / partial，没有可信总分母，不虚构总体完成率。首次 direct CLI
SIGINT超时的根因仍未证实，后续直接入口复测成功不等于已修复稳定性缺口。
下一刀优先审批reverse-request真实失败 -> Failed的owner收口，并继续CLI超时
取证及目录/函数/代码风格逐职责映射。当前全仓lint / App Server strict Clippy
遗留未关闭，新版本App Server完整unit未取得；Windows、packaged、live provider、
CLI outer human TTY与本机Codex Desktop真实视觉仍未验，不宣称release readiness。

## 审批请求失败与用户拒绝分流（2026-10-13，complete / shared-backend）

主目标仍为 GUI/CLI/TUI 共用 App Server -> RuntimeCore -> canonical
Thread/Turn/Item；GUI 多模态、多模型、主题、Banner/Hero 继续由产品层持有。
对照本地 Codex a9b0815167c27ab13719dd12d13b63e02b70d221 的
bespoke_event_handling.rs：用户 decline 为 Command declined；client error、
deserialize error、channel failure 同样阻止执行，但 completion 为 failed。
REQUEST_CANCELLED 属于已发生的 Turn transition，不补发普通拒绝响应。

认领写集：App Server approval_server_request.rs 及独立 tests.rs；runtime.rs
仅注册模块，turn_execution.rs 仅移出 live action response 分发，新建
runtime/action_response.rs；tool-runtime execution_approval.rs 仅注册类型模块，
新增 execution_approval/response.rs；runtime_backend/action_response.rs 保留
审批失败来源，契约守卫仅补迁出模块输入；agent 当前工具 orchestration.rs 仅消费
类型化审批响应；既有 command-status-fixture.mjs 与本计划。
起点备份 /tmp/lime-approval-failure-before-2026-10-13/manifest.json。
避让未知 tsconfig.node.tsbuildinfo、local-conversation-page-a83a1af2c24b.js；
GUI/TUI/CLI 源码、其它 runtime/store 与配置只读，不提交或创建分支。

方案：复用现有 action/respond metadata 传递服务端审批请求失败事实；共享
tool-runtime 内部响应类型明确区分 confirmed 与 requestFailed，失败优先且不
允许缓存授权。公共 JSON-RPC method/审批枚举/schema/依赖/owner 不变；无文本
猜测、无 mock fallback。审批测试从 936 行父模块移出；live response 分发从
超大 turn_execution.rs 移出，原文件不增加业务分支。其余回合编排拆分不在本刀，
退出条件为本刀职责独立后保持原行为与定向回归，剩余大模块治理继续 active。

退出条件：真实 stdio invalid response、client rejection 显示 Command failed，
无 processId/exitCode/文件副作用，provider 可继续；显式 decline/cancel 的已有
语义不变；请求只 resolved 一次，item 只 completed 一次且 live/cold 一致；
channel/client unavailable 与 REQUEST_CANCELLED 分流有定向 Rust 证据。
先 red/green stdio 和定向 Rust，再 contracts、current fixture/GUI smoke；共享
构建后冻结可执行文件、记录源码与产物 SHA。无 schema 变化不重新生成协议。
Windows、packaged、live provider、本机 Codex Desktop 视觉按实际限制单独记账。

### 实现与收尾验证

共享审批 owner 已区分“用户拒绝”与“审批请求失败”：App Server 复用现有
metadata 传递 `approvalRequestFailed`；RuntimeCore 仅使用已验证的 decision /
confirmed 分发工具授权，userData 不能覆盖权限；tool-runtime 的内部
`ExecutionApprovalResponse` 将请求失败映射为 before-handler ExecutionFailed，
用户 decline 仍为 PermissionDenied。Agent 先校验类型化响应与授权，再缓存
session 许可；runtime action.resolved 保留失败来源。没有新增公共协议枚举、
method、schema、依赖或架构 owner，不改变 architecture.md 的主链。

结构和风格按职责拆分：approval_server_request.rs 从936行降到630行，406行
测试迁入同目录 tests.rs；live action response 分发进入151行
runtime/action_response.rs；内部授权响应进入134行
execution_approval/response.rs。旧失败 -> 普通拒绝 helper 已直接替换，没有
compat 包装；契约守卫同步读取迁出模块。turn_execution.rs 仍3037行，超大模块
退出条件是继续逐职责迁出且保持回归，本刀只移出响应分发，不追加编排业务。

最终 App Server 审批12项、响应分发9项、tool-runtime审批7项、公共JSON-RPC6项、
contracts、版本1.156.0、Electron typecheck、共享App Server/CLI构建均已通过。
真实stdio五场景通过：decline / cancel / invalid-response / client-error /
host-interrupt；用户拒绝为declined，请求失败为failed，全部无进程与文件执行
副作用、resolved和completed各一次、live与cold一致。启动前公共Command没有
aggregatedOutput，失败反馈从provider工具响应取证，不放宽为猜测输出。

完整CLI Gate B最终exit0，覆盖native JSON/human SIGINT exit130、cold read、
子进程回收、reasoning、五语言、颜色、resume/fork/review、图片、schema、stdin、
输出文件与三种shutdown；shutdown JSON证据另存cli-shutdown/。首次入口出现
transport closed，根因仍未证实；直接入口复测通过不能作为稳定性缺口已修复。
outer human TTY因本任务outer stdin非TTY仍not-run。

current fixture聚合exit0，22个真实Electron场景摘要已归档；审批等external test
backend场景经真实current bridge/runtime/read model，不替代原生工具或live
provider验收。直接真实GUI smoke与标准`npm run verify:gui-smoke`均exit0；
标准入口重建renderer/client/host/App Server资源，真实Electron/preload/IPC、
初始化1.156.0、reload、settings、三种窗口尺寸24/24断言通过，mock fallback与
legacy命中为零。shell smoke没有provider Turn，也不证明Desktop像素一致。

收尾环境问题单独记账：独立Code Mode Host初次构建StorageFull失败，早期产品
fixture复用前轮1.156.0冻结Host，71个owner输入SHA一致；标准GUI入口随后成功
重新构建并准备Host资源，但shell smoke未调用Code Mode工具。tool-runtime最终
复测曾触发V8归档rustc ICE；只读检查确认target展开归档截断，官方缓存gzip的
SHA和完整1816成员结构正确。持有Cargo artifact锁后精确备份、恢复这一份
归档，最终7项复测exit0；没有清target、下载依赖或修改源码，截断起因未证实。
原始失败、备份路径及恢复摘要均保留。

TUI前两次未完成：一次构建期间StorageFull，另一次已通过键盘/editor/notes/IME
场景后因等待标准GUI构建的Cargo锁超时。保持原夹具timeout、源码和断言，标准
GUI完成后串行重新运行完整TUI Gate B，最终exit0：真实PTY/alternate screen、
keyboard/editor/notes/IME、tmux resize、canonical/cold resume与terminal restore
通过。reconnect等个别投影场景明确使用websocket fixture，不冒充stdio。
本次保留受控TUI临时目录，并归档canonical/runtime JSONL、ledger与终端ANSI；
索引为tui-final-summary.json。

证据入口：`.lime/qc/gui-evidence/approval-failure-2026-10-13/validation.json`。
本刀共享后端与已记录构建图的退出条件完成率100%；全局仍partial。11个认领
源码/夹具与冻结CLI/App Server/Host及库SHA无漂移。GUI构建图1039 -> 1136项，
97项新增、5项变更：index.html、重新编译的两项sidecar及其两个manifest；
逐项原/新SHA记录在artifact-graph-transition.json。最终1136项产物摘要无漂移，
不能将这写成两个构建图字节一致。

收取最终证据时，7366项宽输入基线检测到另一GUI审批卡写集变化：旧
InputbarApprovalPrompt源码与测试删除，PendingInteractionLayer、Workspace
inputbar调用者、pending controller与五语言agentInputbar迁移；已观察12项
变化（9项production、3项test-only），新增ApprovalCard、PendingRequestItemPanel、
其测试与纯投影4项（3项production、1项test-only）。保留原基线和检测结果到
concurrent-gui-inputs.json；只读核对它们归属并行GUI计划，不覆盖、不将production
变化排除为测试文件。所有上述Electron/current fixture证据覆盖此前记录的GUI
构建图，不能认证这些最新源码；它们的current fixture/Electron验收归
`internal/exec-plans/codex-gui-alignment-current-plan.md`。当前工作树产品就绪仍false，
共享后端证据有效，不重建尚在移动的并行GUI写集。

治理分类：共享审批响应和分发为current，Rust回归/受控产品夹具为test-only；
旧failed_approval_decision helper已删除替换，无compat或deprecated新路径。
GUI多模态、多模型、主题、Banner/Hero为product-extension。避让写集新增上述
GUI审批卡、调用者、controller与agentInputbar五语言，不接管其它执行计划。
下一刀由当前进程继续3037行turn_execution逐职责拆分，并核对现有
handle_command_approval_request同时处理Command/FileChange/UserInput的入口命名；
GUI卡片结构/命名与最新真实交互证据由其已登记owner继续，CLI首次transport
closed仍保留为需要取证的稳定性缺口。

verify:local的lint/typecheck/i18n已通过；全量Vitest因并行前端写集进入121批，
本任务第6批主动中断，exit130记录保留，不重跑无关全量，也不称全仓绿灯。
上述检查早于收尾新增GUI审批卡写集，不作为最新GUI源码的全仓门禁结果。
旧App Server strict Clippy、Windows、packaged、live provider与本机Codex Desktop
真实视觉仍未关闭。全局active / partial，无可信总分母，不虚构全局完成百分比。
