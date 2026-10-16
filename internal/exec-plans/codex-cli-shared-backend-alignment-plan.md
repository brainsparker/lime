# Codex CLI / TUI / GUI 共享后端全面对齐计划

状态：active。责任：root。创建：2026-10-16。

## 目标与工作方式

主目标：以用户指定的 Codex current checkout 为参考，使 Lime CLI/TUI/GUI 共用同一 App Server 协议、RuntimeCore、工具与持久化 owner，并逐项对齐运行语义、Host 生命周期、结构和交付验证。

前轮 [11 项审计](./codex-cli-shared-backend-audit-2026-10-16.md) 是共享实例边界的首轮发现，不是全部差异。本计划按领域建立可持续扩展的任务账本；未核实项保持 `unverified`，有实现但缺真实交互证据记 `aligned-needs-evidence`，不把两者算成已确认缺陷。

用户已授权直接重构和清理。内部入口直接迁移调用方并删除重复实现；涉及已发布的 durable 配置/数据时，先给出旧数据夹具、迁移、幂等重开、失败恢复和迁后清理证据。没有持久化变化的切片不新增迁移或兼容层。

已发布行为的迁移随所属工作包交付：登记源版本/旧格式和唯一新 owner，旧数据夹具通过真实加载入口迁入 current 格式，之后仅写新格式；验证重复打开、迁移中断、损坏数据和回退错误可定位，再移除旧写入、双读 fallback、旧消费者、旧测试与扫描白名单。不得以直接清空用户数据代替迁移，也不长期保留两套运行路径。本批 S01/T01 仅改变进程内状态和参数归并，不改变已发布的存储格式。

基线：Codex HEAD `4eb4a65407d98cebc4c83bf13be440b9fbc78a7c`；Lime HEAD `d6dc866ea8f636dd4367eff86e84aa383a26016c` 加当前工作树。执行期间其他进程正在修改 GUI/设置/版本发布，不能把 HEAD 当作全部源码快照，也不覆盖并行改动。

唯一主链：

```text
CLI / TUI / Electron GUI
  -> current App Server client / Host transport
  -> App Server JSON-RPC
  -> RuntimeCore / model-provider / tool-runtime
  -> canonical Thread / Turn / Item / ThreadStore
  -> 各 surface 的展示投影
```

不复制 Codex 私有账号、产品遥测、daemon/state DB、rollout DB 或退役 runtime。能力补在 Lime 既有 owner；产品排除项必须有明确理由，不能用“产品差异”掩盖共享协议的错误实现。

## 状态与完成口径

- `known-gap`：已有 current 源码或行为证据确认不等价。
- `unverified`：仍需沿输入、状态变化、持久化与最终展示核查。
- `aligned-needs-evidence`：已有实现，尚缺本次要求的进程/平台/交互证据。
- `product-excluded`：确认不属于 Lime 当前产品范围，不建立空实现。
- `in-progress` / `verified`：分别表示正在修改 / 当前切片退出条件全部通过。

每项同时记录行为、结构/命名、清理、产品验证四条线。整体完成度以实际冻结的验收条目为分母；盘点阶段不提供虚构总百分比。已通过切片可单独报告比例。

## 分阶段路线

| 阶段 | 范围和交付 | 主要 owner | 初始状态 / 依赖 |
| --- | --- | --- | --- |
| S00 | 刷新两仓 current 基线、能力矩阵、字段/消费者/测试映射；核销过期缺口 | 本计划、既有 inventory | in-progress；持续随各阶段收敛 |
| S01 | connection identity、独立 initialize/client context、请求取消隔离、断连清理 | App Server processor / transport session | in-progress；首批实现 |
| S02 | 按 Thread/Host 路由反向审批、permissions、userInput、MCP、dynamic tool；一次结算与重连接续 | server-request router / Thread subscription | in-progress；Thread 路由真实进程通过、响应竞态 1877 项整库通过，动态工具 Host 注册归属仍缺 |
| S03 | CLI/TUI/GUI attach 同一活跃服务；owned/attached shutdown、discovery、认证、remote workspace | app-server-client / daemon / Electron Host | known-gap；依赖 S01/S02 |
| S04 | public method、参数字段、null/omit、capability gating、typed schema/client 一致性 | app-server-protocol / handler / consumers | partial；逐字段检查，不能只比方法名 |
| S05 | start/steer/interrupt/queue、admission、reviewer、错误终态、同 Turn 输入和取消 | agent-runtime / App Server | partial |
| S06 | resume/fork/revert/archive/delete/search/paging、snapshot/notification barrier、durable settings | App Server / thread-store | partial |
| S07 | compaction、上下文预算、历史摘要、工具状态与媒体引用保留、恢复后继续任务 | context / agent-runtime / thread-store | unverified |
| S08 | command/process/file-change 生命周期、输出 drain、后台命令、sandbox/permissions/Guardian | tool-runtime / execution / App Server | partial |
| S09 | MCP OAuth、tool snapshot、elicitation、App UI、event stream、Skills/plugins/hooks | MCP / Skills / plugin owners | partial |
| S10 | Multi-Agent spawn/send/wait/close、parent authority、mailbox replay、嵌套恢复和统一投影 | agent-runtime / tool-runtime / App Server | unverified |
| S11 | CLI 参数/exec JSONL、输出/退出/signal、resume/fork、MCP/plugin/Skill 控制面与 launcher | cli / packages/cli | partial |
| S12 | TUI 输入/composer/selection/render/streaming/history/pager/resize/focus/reconnect、终端恢复 | tui current modules | partial；按现有 owner 迁移，逐项核销旧 inventory |
| S13 | GUI typed request/projection、恢复竞态、长任务路由、交互表单、队列、多 Agent 和错误展示 | GUI gateway/router/reducer/hooks | partial；避让正在修改的 GUI/设置写集 |
| S14 | runtime 配置/权限 profile/模型切换/工作区事实、五语言与平台路径 | shared config / providers / surface projection | partial |
| S15 | 数据与配置迁移、旧入口/无引用代码/重复 DTO/测试与守卫同步清理 | 各领域既有 owner | 随切片执行，不另建清理后端 |
| S16 | 真实 stdio/CLI/PTY/Electron、同服务三端并发、平台包与原生依赖矩阵 | current fixtures / release package | aligned-needs-evidence；每批按风险闭环 |

阶段是职责边界，不要求串行等待所有同层任务；跨阶段变更以最小可验收切片推进。S15/S16 与每个实现切片同步，不能留到最后统一补测试或清理。

## 首轮已确认任务

| ID | 任务 | 状态 | 来源 / 最小验收 |
| --- | --- | --- | --- |
| CON-01 | 取消状态按 connection + request 身份隔离 | in-progress | F02；双客户端复用 integer/string ID 时互不污染 |
| CON-02 | initialize/clientInfo/runtime host context 按连接隔离 | in-progress | F06；GUI/TUI 分别保留 client name/version，初始化不互相授权 |
| CON-03 | connection context 在断连/停服时回收，重连不继承旧取消 | in-progress | 正常关闭、异常断开、connection id 测试复用 |
| ROUTE-01 | 消除全局唯一 writer 的交互请求假设 | in-progress | F01；Thread typed 交互已改路由，待新产物进程验收；Host 能力仍须独立 owner |
| ROUTE-02 | 同 Thread 双订阅反向请求 owner 和一次结算 | in-progress | 首次派发、first response、late response、断连 claim 已实施，待验证 |
| HOST-01 | GUI/终端明确选择并 attach 同一服务 | known-gap | F03；真实 Electron + PTY 相同 server/Thread/Turn/Item |
| HOST-02 | remote 未指定 cwd 时不发送本机路径 | known-gap | F05；异平台路径、显式远端 cwd 与服务端默认 workspace |
| GUI-01 | 活跃事件 route 不因固定 30 分钟 TTL 被回收 | known-gap | F04；时钟推进回归 + 活跃 Command 到最终终态 |
| CLI-01 | exec MCP elicitation 显式 cancel | in-progress / child evidence gap | F07；CLI unit 110 项及普通 Thread 真实进程通过，真实子 Agent attach 尚未验收 |
| CLI-02 | stdio 有界 stderr 诊断 | known-gap | F09；初始化失败可定位，stdout 保持纯 JSON-RPC |
| LIFE-01 | resume 必要配置覆盖与 steer additionalContext | known-gap | F08；复用 current settings/input owner |
| PKG-01 | Linux ARM64/musl、Windows ARM64 可交付性 | known-gap | F10；先核原生依赖，再做目标构建和本机包验收 |
| READ-01 | 多窗口 read-state revision/CAS | unverified / optional | F11；先决定用户旅程，再实现共享 durable owner |

扩展盘点已落为 [68 个领域工作包](./codex-cli-shared-backend-work-packages.md)：CLI/TUI 24、runtime/协议 25、GUI/恢复证据 19。工作包含已实现待证、范围裁决和跨领域关联，不是 68 个独立缺陷。逐项记录 current owner、源码证据、验收与清理；禁止把全部方法的数量差当成待实现清单。

S01 之后优先顺序：S02 reverse-request owner → T01 全子命令连接参数 → R02/R03 已声明字段的正确消费 → HOST-02 remote workspace → R08/R21 Skills 动态变化 → R01 真正上下文摘要。各批同步对应三端/真实进程证据，不先堆 UI。

## 首批 S01 的写集与重构边界

认领：

- `lime-rs/crates/app-server/src/processor/mod.rs`、连接上下文职责模块及直接测试。
- `lime-rs/crates/app-server/src/processor/config_warning.rs`、`processor/dispatch.rs` 的 initialize 直接消费者。
- `processor/tests/{tests_support,capability,mcp,artifact,usage_stats,project_git}.rs` 的协议类型显式 import，随职责迁出同步迁移测试消费者。
- `lime-rs/crates/app-server/src/lib.rs` 的消息入口/连接清理接线，以及从中拆出的消息处理职责模块和对应行为测试。
- 本计划与前轮审计状态的必要更新。

只读/避让：GUI、设置、release notes、workspace/package manifests/锁文件、当前脏 `architecture.md`、既有 GUI 对齐计划和 REA 报告。Codex 源码只读。不提交、不推送、不创建分支。

实施前 `lib.rs` 为 4315 行，`processor/mod.rs` 为 785 行，`server_request.rs` 为 1502 行。S01 已先将触碰的连接状态/消息入口按职责迁出，root/processor 分别为 4183/613 行；S02 结构准备将 server-request 测试迁出后 production 文件为 630 行。剩余大型 root/dispatcher 的拆分进入对应阶段，退出条件是按协议/状态/传输职责拆分并直接迁移消费者，稳定行为回归保持，旧聚合入口不加 re-export 包装。

S01 是进程内状态归属修复，不改变 durable schema、公开 JSON-RPC 字段、依赖方向或三端业务主链，无数据库迁移。后续连接 attach/owner 变更进入架构确认；当前脏架构文档不夹写。

## S01 Agent Verification Contract

- 责任：root；预算 `budget:normal`；风险 P1。
- 输入：两个已初始化 transport 使用相同 request ID；各自发送初始化、业务请求和 `$/cancelRequest`；一端断开/重连。
- current 主链：CLI/TUI/GUI JSON-RPC -> App Server transport -> scoped processor -> 同一 RuntimeCore/read model。无新增 IPC/method/schema。
- 预期：A 的初始化、clientInfo、取消和关闭只影响 A；B 的同 ID 请求和 host context 保持正确；同一客户端既有取消返回/媒体读取消保持。
- 失败终态：仅正确客户端获得 REQUEST_CANCELLED 或 NOT_INITIALIZED；不改变另一客户端 Thread/Turn/Item。
- 不增加 provider/tool 调用；不得以测试侧改 terminal 或生产 mock fallback 验收。
- deterministic：先新增跨连接公共消息边界回归，保留红灯，再修 owner 并跑 processor/transport 受影响集。
- runtime-transcript：真实 stdio fixture 覆盖握手/请求/关闭；双客户端公共 transport 回归覆盖连接身份。
- GUI trace：本批没有 GUI/IPC/DOM 代码变化，壳行为由现有 smoke 复验；不把该结果当三端同时在线验收。
- release-artifact：本批不改发布产物/版本/依赖，不运行发布。
- 结构退出：连接状态与消息接线有唯一 owner，删除允许后续 transport 复用首客户端状态的旧 initialize 分支；没有第二份取消表或兼容委托。

必跑入口以实际脚本为准：

```bash
cargo test --manifest-path "lime-rs/Cargo.toml" -p app-server --lib client_context -- --test-threads=1
npm run test:rust:related -- lime-rs/crates/app-server/src/processor/mod.rs
npm run test:contracts
npm run smoke:app-server-stdio
npm run verify:gui-smoke
npm run verify:local
```

测试/构建使用当前工作树，不能把并行修改归为本批。全量门禁如被他端改动阻塞，应定位并保留失败，不覆盖他端代码、不把定向绿灯写成全仓通过。

Agent QC 映射：P1=shared session isolation / initialized / cancellation / reconnect；不调用 live Provider，不启用 LLM judge。验收由身份、响应和状态转换的确定性断言完成。

## 第二批 T01 的写集与验证

在 S01 等待并行 Cargo build lock 期间推进独立的 CLI 参数修复，状态 `in-progress`。认领 `cli/src/main.rs` 的 connection/options、dispatch 与对应测试职责，及 `queue_cmd.rs`、`mcp_cmd.rs`、`plugin_cmd.rs`、`review_cmd.rs` 的连接参数选择；`exec.rs`、`exec/cli.rs`、`exec/cli_tests.rs`、`exec/thread.rs`、`sandbox_setup.rs` 直接迁移到新 connection owner。同步 `scripts/governance/cli-boundary.mjs` 原有 remote contract 守卫的源码位置，守卫要求保持。GUI/设置/发布写集继续只读。

- current owner：CLI 参数解析/继承 → `app-server-client` session → 同一 App Server；不建新 transport 或配置后端。
- 输入：`lime --remote <A> --cd <root> … <subcommand> …`，以及子命令显式 `<B>` / cwd / permission 覆盖；Queue 还覆盖两层命令参数。
- 预期：全部 server-backed 命令继承 root 连接与运行参数；子参数优先且 permission group 保持原子覆盖，不因继承扩大权限；本地-only 命令继续由本机 owner 执行。
- 失败终态：无效 endpoint/auth/permission 显式失败，不转本地；selected Host 不可用时不改另一个 Host 数据。
- 结构/清理：connection 定义/策略与 dispatch 从近 2000 行 main 迁出，直接迁移 import；删除分支各自复制的继承代码，不增加 wrapper；review 保持同一 exec lowering。
- 验证：全命令 parse+normalized state 回归、permission 既有测试、CLI crate tests；两个真实受控 App Server 的读写目标验收，另补 stdio/CLI Gate B。禁止用 parser 单测冒充远端写入验收。
- 可重复进程入口：`node scripts/app-server/shared-client-fixture.mjs`。它通过既有 binary builder/snapshot 启动两个隔离 App Server 和真实 CLI，覆盖 integer/string 同 ID 取消、ID 复用、root 读写目标、child Host 覆盖及删除隔离。backend 明确为 unavailable，不冒充 provider/PTY/Electron Gate B。写集追加此 fixture 与执行计划 README 的导航链接；未修改并行 `scripts/README.md` 或 package manifest。
- 进程夹具 runtime libraries 继续复用 `terminal-gate-binaries.mjs` 的快照；追加该 helper 的纯子进程环境函数，使 macOS/Linux 从快照相邻目录加载实际动态库。只调整本任务子进程的 loader path，不改系统环境、可执行文件或共享 target；Windows 继续使用 executable 相邻库规则。
- 持久化/public schema/依赖无变化，无数据迁移；架构 owner 与依赖方向不变，非重大架构。

## S02 已收敛的实施约束

结构准备已认领 `app-server/src/server_request.rs` 与新 `server_request/tests.rs`：将原有 20 项测试机械迁出，保留 `server_request::tests::*` 模块路径和既有断言；已比较迁出前后 rustfmt 结果，内容完全一致。production 文件从 1502 行降到 630 行；related App Server library 回归继续覆盖原测试。本步仅解除超过 1000 行文件的实施约束，不核销 ROUTE-01/02。

只读追证发现 `ServerRequestRouter::PendingRoute` 已有多 owner、Thread resume claim/replay 和持锁 first-response-wins 结算；缺口主要在首次 `begin_server_request` 仍调用全局唯一 writer 选择。不能为修首次派发再造 pending registry，也不能把已有多 owner 当完全缺失。

测试职责拆分已完成，下一批把 typed approval/userInput/permissions/MCP 的 Thread identity 用于初始候选集，复用原 router 一次结算和 thread listener resolved 广播。首次登记/发送与 resume claim 必须考虑交错，不能因改为逐连接循环而产生重复首次派发或遗漏新订阅者。动态工具还需核对注册 Host ownership：`electron/appServerDynamicToolHost.ts` 的 `#bindingsByThread` 是 Host 本地 frozen binding，并不是 App Server 的连接执行权事实；不得仅凭 Thread 订阅将同一次有副作用工具派发到两个 Host。无 Thread 的通用 `send_server_request` 保持显式目标/歧义失败合同，禁止选择 HashMap 首项。

验收必须从首次真实请求触发，覆盖：无关第二连接、同 Thread 多订阅、first response/late response、wrong owner、首个发送失败、断开一个 owner、零在线 owner 后 resume claim、Turn interrupt 与 resolved 顺序。已有手工注册 pending 的重连测试不能替代首次派发。

结算投影已进一步区分：approval 的 `PublishNotification` 经现有 Thread listener 扇出所有订阅者，并补 origin；不能误报为仅通知一个 owner。MCP 的 `notify_resolved` 则直接调用 `send_server_notification_to_owner`，仍需随多 owner 首次派发迁至同一 Thread listener 通知合同，避免另一个表单一直 pending。

S02 本批窄写集：`server_request.rs` 及其职责模块/测试、`thread_listener.rs`、`thread_state.rs`、`approval_server_request.rs`、`permission_server_request.rs`、`mcp_elicitation.rs` 和直接测试；`lib.rs` 仅增加既有 router 的 bridge 引用并删除 listener 外的 resume claim/snapshot。动态工具仍走单目标 Host 路由，不广播执行。将首次请求登记/发送与 resume 的认领/重放串行放入既有 Thread listener，并复用现有 pending 表和 first-response-wins。架构 owner、依赖方向、公开协议和存储格式不变；架构文档当前为其它任务脏写集，只读，本批不得声称 S02 全部完成（Host ownership 另待落实）。

S02 Verification Contract：P1，current owner 为 App Server server-request router + Thread listener；输入为同 Thread 两订阅者、无关客户端、断开/重连和 resume barrier 交错。预期同一 request ID 只接受候选 owner 的首次响应，所有相关表单收到一次 resolved；一个 owner 发送失败或断开不取消其它 owner，零 owner 后可由 resume 接续。失败必须 fail closed，不回退本机、不增加工具执行。先补首次派发/重放/终态回归，再跑 App Server 定向和真实进程 fixture；现有单目标 Host 歧义失败回归保留。CLI/GUI 的既有证据不冒充新路由证据。

## CLI-01 非交互 elicitation

认领 `cli/src/exec/server_requests.rs` 与 `server_requests_tests.rs`，直接将 MCP elicitation 从 wildcard METHOD_NOT_FOUND 迁到现有 typed cancel response。普通 Thread 和已 attach 子 Agent 都经同一 `AppServerEvent::ServerRequest` 分支，不复制处理器；原断言协议不支持的测试同步替换为 cancel 合同。精确保留整数/字符串 request ID，不返回 content，也不回显请求 `_meta`。无持久化/协议/依赖变化，无迁移层。CLI bin 回归覆盖新行为；真实 MCP 工具到 exec 的进程证据由新增 `scripts/app-server/cli-mcp-elicitation-fixture.mjs` 承接（追加本批写集）：runtime backend + 复用 loopback Provider/MCP fixtures，验证 CLI 经 stdio 返回恰好一次 cancel、继续到同一 canonical completed Turn。实际子 Agent attach 证据仍独立记录，不能用两个不同 threadId 的纯 response helper 测试冒充。

## 进度与证据

- 2026-10-16：用户明确要求完整计划、逐步实施，并授权不合理实现直接重构和清理。建立本计划；S00 扩展领域盘点与 S01 实施并行。
- S01：当前先建立跨连接失败回归，再拆分连接 context owner。验证结果随后回写。
- 已在真实 App Server 子进程 + 两个 WebSocket 客户端复现 CON-01：A cancel(7)，经 A list(8) response 屏障后，B list(7) 错误得到 `-32800`，A list(7) 反而成功。旧产物 SHA-256 `13fb1a5518f8b00f38d0f881ed8325e563ecc53658072855ec056254a4bbbc2a`，backend=`unavailable`；该证据只证明 transport/processor 状态串扰，不证明 provider 执行。
- 实施：客户端握手/identity/cancel 归 `processor/client_context.rs`，根 processor 只选择连接 context；消息入口迁到 `message.rs`；删除 `initialize_transport`、`allow_existing_process_initialization` 和 `handle_transport_initialize`。RuntimeCore/工具/存储继续共享，断连/停服回收连接 context；ThreadGoal 延迟继续执行也按 origin connection 取 host identity。
- 当前 `npm run test:contracts` 已通过；Rust library 回归、产物重建和本地门禁仍在执行，尚未标记 S01 verified。裸 Cargo 初次因缺 sandbox V8 资产 URL 404 失败，已改用仓库 `resolveRustyV8CargoEnv` 校验过的成对资产，未修改环境配置/依赖或关闭 sandbox。
- T01：共享参数归并迁到 `dispatch::inherit_root_options`，各命令选择实际 connection；Queue 复用同一归并规则处理 root→queue→list。显式子 transport 替换 root transport，换远端不继承另一 Host 的 token env。`main.rs` 从 1973 降到 957 行；connection、dispatch、原有 command tests 直接迁出，无 re-export/compat wrapper。新增全 server-backed 命令矩阵、目标/权限覆盖及 Queue 两层回归。
- T01 复核补齐本地 Host 切换：子命令换为另一个 `--app-server` 可执行文件时，不继承根命令的 `--app-server-arg`（例如另一 Host 的 data-dir）；同一可执行文件仍继承未覆盖参数。覆盖矩阵同时断言两种行为，防止 transport 切换后误写旧 Host 数据。
- T01 最新完整 `npm run test:contracts` 通过（App Server client contract 299 checks），CLI boundary 定向测试 1/1 通过。`verify:local` 已过一致性、i18n、lint、typecheck；因包含其他进程 GUI 写集而扩为 131 批前端测试，本轮主动中断于第 2 批并保留 resume 状态，以先完成 Rust/CLI 定向验证；不计全仓通过，也不把中断记为产品缺陷。GUI smoke 与 Rust/产物构建仍在等待或执行。
- 验证资源调度：并行 settings 任务的 workspace Cargo 占用同一 target 锁，且其链接日志出现 `libicrate`/`libv8` 构建产物缺失；本轮未删除共享 target，也不终止未知任务。为避免两个 renderer build 同时写构建目录，已仅停止本轮 `verify:gui-smoke` 进程树，待锁与并行 renderer build 释放后再验；中断不计通过。
- 首次修复后 Rust 验证尚未进入本批断言：related 因 V8 binding 源文件在等待期间缺失失败，binary build 因 native static library 缺失失败。已重新经仓库 resolver 校验 archive/binding，并复制到任务专用 `/tmp/lime-shared-backend-v8` 缓存；成对 SHA-256 分别为 `00adbb48798848c77550441c68673a5e8529b8e1b73eabcdee232cb39b40f4a1`、`ca5adf0cf89c9a70ad460ae73648b2fe89b74aa113b3cb7f757b6a02b758394f`。仅给子进程传缓存位置，不改全局环境、依赖或 sandbox；related 重试与真实进程 fixture 已排队。

## 当前验证快照（2026-10-16）

新产物构建已通过。首次快照运行因 raw Cargo binary 没有 macOS dylib rpath 而未进入协议断言；现由快照相邻动态库的子进程 loader path 解决。构建中暴露的 `encode_message` import 仅用于测试，已收缩至 `cfg(test)`。

用于以下进程验收的固定产物 SHA-256：App Server `372f0048d3149b587e251c2a2edc94359a35e30398ab6ad450a370916c37f1d3`；CLI `ee18626c64f5ee0d522164a275169eb84747daf7bad021fe041b087a1104d27f`。快照隔离了后续并行 Cargo 对共享 target 的改写。

| 验证 | 实际结果与证据边界 |
| --- | --- |
| 新 `shared-client-fixture` | exit 0；真实 CLI + 两个 WebSocket App Server，backend=unavailable。integer/string 同 ID cancel 隔离、ID 复用、root 写入/删除目标、child Host 覆盖全部通过。日志 `/tmp/lime-shared-backend-shared-client-fixture-retry.log` |
| 新 `cli-mcp-elicitation-fixture` | exit 0；runtime backend + loopback Provider + 真实 stdio MCP。Thread `01a14542-09d7-7ee2-8d69-53ec433a495b`、Turn `turn_247759175a344997b06ae4a82895c204`：MCP cancel 恰好一次，继续到 canonical completed Turn。未证明真实子 Agent attach；日志 `/tmp/lime-shared-backend-cli-mcp-fixture.log` |
| `smoke:cli-gate-b` 对应固定产物入口 | exit 0；流式 JSONL 与 cold read、真实 runtime 的 json/human SIGINT exit=130 与子进程回收、reasoning、五语言、resume/fork/review、图片顺序、schema、stdin、输出文件和 Command shutdown 通过。其余生成内容场景 backend=external，不能全部称 live/runtime；human TTY 因 outer-stdin 非 TTY 显式未跑。日志 `/tmp/lime-shared-backend-cli-gate-b.log` |
| stdio smoke | client package tsc 通过；npm shell 调用后 loader path 未保留，报 stdin closed。改为直接 Node 运行同一 `stdio-smoke.mjs` 后 exit 0，真实 stdio initialize/protocol 与 unavailable thread fail-closed 通过。日志 `/tmp/lime-shared-backend-stdio-smoke-direct.log`；不把失败 npm 调用写成通过 |
| 夹具定向测试 | Vitest 2 files / 9 tests passed。初次误用 Node test runner 的失败保留，改用既有 Vitest 后通过；日志 `/tmp/lime-shared-backend-fixture-tests-retry.log` |
| App Server Rust library | 复用 settings 任务本次编译的当前工作树结果：1865 passed / 0 failed / 0 ignored，包含 9 项连接隔离及迁出的 20 项路由测试。来源 `.lime/qc/settings-profile/content-alignment-20261016/rust-changed-retry-2.log:297`、`:2166`。本任务另以同一新鲜测试产物定向执行 client_context：9/9 通过，日志 `/tmp/lime-shared-backend-s01-fresh-test-binary.log`；测试产物 SHA-256 `26417db9b493732f211cbaff07b2ec66dce04e15350021411f8e73f1ff0f7f40`。这验证当前工作树，不代表 settings 变更归本任务 |
| CLI bin Rust | 独立 target 重跑 exit 0：110 passed / 0 failed / 0 ignored，0.81s。日志 `/tmp/lime-shared-backend-cli-tests-isolated.log`。此前共享 target 链接 ENOSPC 与后续 extern missing 失败日志保留，未将失败调用写成通过 |
| GUI smoke / local gate | renderer、Host、assets 构建通过；sidecar 编译 `lime-agent` 时因 `No space left on device` 退出 101，聚合命令退出 1，未进入真实 Electron smoke。日志 `/tmp/lime-shared-backend-gui-smoke-retry.log`；全量 local/frontend 仍为先前中断状态，未计通过 |

`test:contracts` 最新完整重跑 exit 0（`/tmp/lime-shared-backend-contracts-final.log`）；脚本治理最新重跑、141 个计划本地链接、Rust 定向格式检查均通过。

上述进程、CLI unit 和 App Server 既有 library 结果支持前三个切片；GUI 门禁尚未闭环。S02 本轮已继续实现首次路由/重放/结算，新增行为需以下新测试和新产物独立验收，不能沿用旧 SHA 或旧 library 绿灯核销。

资源阻塞处置：两项失败均为磁盘空间不足，未出现本批新断言失败。先确认无活动 Cargo/rustc，再仅清理本任务已完成构建的四个 incremental 目录（`app_server-15hgj4nkrdeza`、`app_server-2fnixjpzgzeyt`、`lime-365qxtmej3klp`、`lime-3edo954p3fdwx`），清理前记录文件清单与大小；固定产物、V8 校验资产、验证日志和其它共享 target 内容保留。不清空 target，不停止他人进程。

后续实际结果：上述四个目录已按 inode/mtime/size 清单校验并清理，manifest 为 `/tmp/lime-shared-backend-cache-cleanup-manifest.json`，可用空间恢复至 2.7 GiB。共享 target 重试时，新生成的 `libproc_macro2` 在下一编译步骤已消失，App Server 测试产物也被外部移除，出现 extern location missing；不能把伴随的 serde 派生错误当作产品类型缺陷。未终止外部清理或构建，改用本任务独立 `/tmp/lime-shared-backend-target`，仅对子进程设置 debug=0、incremental=0。独立 CLI bin 回归已通过：**110 passed / 0 failed / 0 ignored**，0.81s，日志 `/tmp/lime-shared-backend-cli-tests-isolated.log`。T01 参数矩阵和 exec MCP cancel 的 unit 已闭环；GUI 和 S02 的新证据仍待完成。

S02 已实施待验证：首次 typed 交互进入 `BeginServerRequest`，在既有 Thread listener 登记同一 pending 表；resume claim/snapshot 从 transport task 迁入 `CompleteResume`，与首次派发串行。屏障内先登记、延后派发；重放已认领的 owner 不再重复发送，中断已移除的 route 不会延后复活。发送失败移除该请求的 owner 并清 stale subscription，其他 owner 或后续 resume 可继续。`item/tool/call` 与 `currentTime/read` 不随新订阅者重放，原 Host 断开即取消；首次 Host 选择仍为明确单目标/歧义失败，完整动态工具注册 Host 归属尚未落实。

结算统一到原有 Thread listener 通知：删除 approval 复制的 resolved publisher 和 MCP 单 owner 的 notification sender；MCP 保留 `resolved_before_transition`，避免 interrupt 已通知后再次 resolved。`mcp_elicitation.rs` 测试迁至 `mcp_elicitation/tests.rs`，production 从 822 降到 316 行。新 `server_request/thread_tests.rs` 覆盖首次双订阅、无关/迟到响应、发送失败、全部断开后 resume、屏障重放/去重、屏障内中断、scope fail-closed 和 Host 禁止转交；MCP adapter 补两订阅者正常/中断结算回归。

真实进程入口追加 [shared-request-fixture.mjs](../../scripts/app-server/shared-request-fixture.mjs)：复用 current typed client、loopback Provider 与 stdio MCP peer，使用同一 App Server 的多个 WebSocket 客户端，验证首次派发、错误 owner、迟到响应、零 owner 后原 ID 重放及 resolved 先于 interrupted Turn。尚未运行，不作为通过证据；该 fixture 不证明 Electron/PTY。新增脚本的语法和脚本治理已通过；App Server 整库新编译和契约门禁在执行。

S02 进程红灯：同一新夹具运行修复前固定 App Server SHA `372f0048…`，实际得到 `requestCounts:[0,0]`、MCP `{action:"cancel"}`，Turn 在没有任何客户端表单响应时完成。日志 `/tmp/lime-shared-backend-s02-old-binary-red-final.log`，exit 1；这不是新实现回归失败。先前夹具调用遗漏 paginated resume 的 `excludeTurns:true`，已按 current 合同修正，该次失败不计产品证据。最终 oracle 同时检查反向请求送达和原 peer 结算，不能仅以 MCP cancel + completed 判断客户端实际响应。

CLI-01 的既有进程证据口径因此收窄：它直接观测真实 exec、MCP peer 的一次 cancel 和 canonical Turn 完成；typed `{action:"cancel"}` 的精确响应由 CLI unit 验证，尚没有独立 wire trace 排除 App Server 失败处理也生成 cancel 的可能。后续与真实 child attach 同批补被动 stdio transcript，不能据此声称全部 Host consent 证据闭环。S02 新 WebSocket 夹具直接观察并显式回答实际反向请求，不存在此 oracle 缺口。

S02 新契约门禁 `npm run test:contracts` 已 exit 0，client 299 checks、schema 无漂移及领域守卫通过，日志 `/tmp/lime-shared-backend-s02-contracts.log`；脚本治理 exit 0，日志 `/tmp/lime-shared-backend-s02-scripts.log`；计划 142 个本地链接通过。

S02 后续退出条件仍包含两个独立问题：动态工具的注册 Host ownership（当前只保证歧义失败和断连不转交）；response 与 interrupt 同时发生的可控竞态。后者目前只能从源码推断风险：router `resolve` 先移除 route 并唤醒 waiter，resolved 再由 waiter 异步发布；interrupt 在这两步之间可能看不到 route。新 fixture 验证的是表单仍 pending 时的 interrupt，不能外推到此交错。需先构造确定性红灯，再决定是否将 response 结算及其通知也串行到同一 listener，禁止用 grace timer 补时序。

### 2026-10-17 S02 新产物验证与响应结算切片

App Server library 本轮已通过 **1874 passed / 0 failed / 0 ignored**（65.78s），日志 `/tmp/lime-shared-backend-s02-app-server-tests.log`。独立 production build 通过；固定产物索引 `/tmp/lime-shared-backend-s02-binary-snapshot.json`，App Server SHA-256 `44e73da58cd4d7d8011725ce3d036048f84c243d89251a86f2ea13ab5c8cc72e`。该 SHA 含首次 Thread 请求路由与 resume 排序修复，不含随后响应结算重构。

`shared-request-fixture.mjs` 对此产物 exit 0，日志 `/tmp/lime-shared-backend-s02-shared-request-green.log`。真实 runtime + loopback Provider + WebSocket + stdio MCP 证明：同 Thread 双客户端首次同 ID、无关响应拒绝、迟到响应无效、peer 每 Turn 一次结算、零 owner 后 resume 原 ID、pending 表单中断时 resolved 先于 canonical interrupted Turn。与旧产物的缺请求红灯形成对照。证据范围为真实 App Server clients，不外推为 Electron、CLI 或 PTY 交互验收。

Electron current fixture 首次运行完成 31 + 34 + 3 + 300 项定向断言，随后在隔离 HOME 的 `cargo metadata` 触发 rustup 下载，未进入 unknown-item 产品断言。已停止本任务的该次夹具进程，未触碰外部进程或全局 Rust 配置；重跑显式固定上述 App Server 及真实 Rustup/Cargo 目录，日志 `/tmp/lime-shared-backend-s02-current-fixture-pinned.log`，结果待收取。

响应结算切片新增窄写集：`server_request/resolution.rs`、`server_request/resolution_tests.rs`、`message.rs` 响应分支与 current-time/MCP 的直接调用测试；原 `lib.rs` 同步响应方法直接迁出。先建立不 poll waiter 的 response→interrupt→terminal 确定性回归；修复将 Thread response 的取出、resolved 发布和 waiter 唤醒串行到现有 listener，仍复用原 pending 表。resume 屏障期间须先从 snapshot 移除已回答请求，再按 FIFO 发布 resolved/terminal，不能靠延迟计时或第二 registry。currentTime Host 读取不新增交互 resolved 合同。无公开 schema、依赖或持久化变化，无需迁移。

确定性红灯已获得：`response_resolution_precedes_transition_without_polling_waiter` 在修复前得到 `test/turnTerminal` 先于 `serverRequest/resolved`，0 passed / 1 failed；日志 `/tmp/lime-shared-backend-s02-race-red-valid.log`。首次测试代码使用了不存在的 helper/错误常量，编译问题已修正；早先编译失败不计行为红灯。listener 结算重构已实施，新增 response/error 先到、interrupt 先到及 resume 屏障内响应回归，绿灯待收取。

响应结算新整库结果：**1877 passed / 0 failed / 0 ignored**，61.04s，日志 `/tmp/lime-shared-backend-s02-resolution-tests.log`；上述三项确定性回归均通过。状态名直接迁为 `resolved_in_listener`，MCP/typed finisher 复用它跳过重复 resolved；`lib.rs` 的两条同步 transport response 入口已删除，生产入口唯一落在 `server_request/resolution.rs`。编译暴露原 `resolve_transport_error` 已无消费者，同轮删除该 test-only helper，不保留 dead 包装。最终 production build 与新 SHA 的进程/GUI 验证待收取。新 `npm run test:contracts` exit 0，日志 `/tmp/lime-shared-backend-s02-resolution-contracts.log`；passive recorder 加入后脚本治理 exit 0，日志 `/tmp/lime-shared-backend-s02-wire-scripts.log`。

固定 S02 loader-prepared 产物的 `smoke:agent-runtime-current-fixture` 聚合最终 **exit 0**，日志 `/tmp/lime-shared-backend-s02-current-fixture-pinned.log`；前四组实际执行 31 + 34 + 3 + 300 项定向断言，后续已配置 Electron 场景全部执行通过，`liveProviderUsed=false`。该聚合是 mixed fixture：例如 approval-request-resume 的 `backendMode=external`，Skills 等场景另有 runtime backend；只证明每个实际摘要记录的 Electron/preload/IPC/current App Server/read model/可见投影边界，不外推 live Provider、全 runtime tool/sandbox、全平台或同服务三端并发。它不含随后 response 结算重构；最终新产物另跑 shell smoke 与对应审批中断场景。

CLI-01 追加测试脚本写集：已有 `mcp-elicitation-stdio-relay.mjs` 增加 passive 模式，保持 TUI 默认 driver 行为；`cli-mcp-elicitation-fixture.mjs` 复用该模式被动记录真实 stdio，不注入请求，并强制断言真实 reverse request、相同 ID 的唯一 client `{action:"cancel"}`、一次 resolved、MCP peer 一次 cancel 与 cold canonical completed。macOS 本次 exit 0，`wireTypedCancelVerified:true`，日志 `/tmp/lime-shared-backend-s02-cli-mcp-wire.log`；真实 child attach 仍未核销。Windows 保持原真实 CLI/peer 验证，并显式记录 wire proof 为 false，native transcript launcher 后续纳入平台矩阵，不能冒充跨平台通过。

同一被动 recorder 在 S01/T01/CLI-01 固定产物上也 exit 0，wire typed cancel 精确通过（App Server `372f0048…`、CLI `ee18626c…`），对照日志 `/tmp/lime-shared-backend-cli-mcp-wire-s01-control.log`。这是单客户端正向对照，不能当作旧共享请求缺陷的负向验证；旧共享缺陷仍以双客户端 `shared-request-fixture` 的请求缺失红灯为准。

产物身份补充：Electron 的 `resolveElectronAppServerRuntimeEnv` 会对显式二进制调用已有 `ensureMacBinaryRpath`，所以本轮旧索引路径在 GUI 准备后从 SHA `44e73da5…` 变为 `add6a69d6001ff951304443f72d5efcf71387fc3d6a4edbaa64095a4bf4c4acf`；后者是上述 CLI wire 验证和该轮 Electron 实际使用的 loader-prepared S02 产物。前者保留为先前 shared-request 运行时身份。后续响应结算产物在固定与计算 SHA 前先执行同一 loader preparation，并核对验证前后摘要，防止将 loader 补丁误当源码变更。

最终响应结算 production build 已 exit 0，日志 `/tmp/lime-shared-backend-s02-resolution-build.log`。固定索引 `/tmp/lime-shared-backend-s02-resolution-binary-snapshot.json`，raw App Server SHA `0fd40348b8cd1797e66211f9ce352495249f627c093e05590100ccb416e05aac`，loader-prepared SHA `6f3744b07e00531cbf62eeedbe7a21549c4bbe8dc66db7920e58f073a6ef6446`，CLI SHA 保持 `ee18626c…`。对此最终产物，shared-request 与 CLI passive wire fixture 均 exit 0，日志分别为 `/tmp/lime-shared-backend-s02-resolution-shared-request.log`、`/tmp/lime-shared-backend-s02-resolution-cli-wire.log`；前者重验首次派发/多 owner/零 owner resume/interrupt，后者直接证明 CLI typed cancel、一次 resolved 与同一 cold canonical completed。最终 shell GUI smoke 与 approval host interrupt 定向证据继续收取。

并行工作区基线变化：验证期间 HEAD 由外部流程更新至 `8fffa6b9d202c82d94fe45babafad6e4f2babf3e`（包含共享 App Server 工作），本任务没有执行 commit/push/reset/分支操作；本批认领源码与该 HEAD 一致，继续保留不可互换的各阶段产物 SHA 和运行日志，不用新 HEAD 覆盖历史验证身份。

## 分类与完成度

current：连接 context / message entry、CLI connection / dispatch 和 exec typed consent，仍由既有 App Server、CLI owner 演进。新增的两个进程 fixture 与 loader 环境 helper 属于 test-only。

compat / deprecated：本轮新增均为 0。deleted：`initialize_transport`、`allow_existing_process_initialization`、`handle_transport_initialize`，以及各命令分支复制的 root 参数归并；MCP elicitation 的 METHOD_NOT_FOUND 旧断言已替换。未保留旧入口 re-export 或双运行路径。进程内状态与 CLI 参数不涉及已发布存储格式，故本批无需数据迁移；后续 durable 变更继续按迁移合同处理。

本批 S01、T01、CLI-01 三个切片的代码实施为 3/3（100%）；阶段验收仍需上表所述证据，不能据此标记产品对齐完成。68 个领域工作包含待核实和产品排除项，总验收分母尚未冻结，不报告虚构的整体完成百分比。
