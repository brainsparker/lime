# Codex CLI / TUI / GUI 共享后端全面对齐计划

状态：active。责任：root。创建：2026-10-16。

2026-10-18 优先级覆盖：按用户要求先对齐核心 Context & Memory、Agent Loop、Tools & Extensions 与 harness，
直接读取 Codex CLI 源码；REA 仅补 Desktop 非公开行为。当前下一刀为真正模型 compaction，
详见 [核心机制复审与实施矩阵](./codex-runtime-gap-alignment-plan.md#当前证据与实施顺序2026-10-18)。
历史四项 runtime 完成、插件/UI/Host 门禁均不代表核心对齐。用户最新“开发期间不考虑兼容/迁移”
覆盖下文旧迁移要求，后续直接替换 current owner，不新增兼容层。全量插件、tar.gz、LimeCore 范围保留。

当前阶段（2026-10-17）：S01/T01、普通 CLI typed cancel、S02 Thread 请求派发/重放/结算、S02-D 动态工具单 Host、R03 service tier 与 R02-A/B/C 审批和旧数据迁移切片已有实际证据，边界见下文。S03-A remote workspace 已通过 8 个 runtime Turn、3 项真 PTY、冷重开和 Host gates。默认门禁前端 131/131 批完成；Rust 修复后阶段续验为 29 批 / 7067 passed / 0 failed / 5 ignored，原父进程 exit 101 保留。S09-A/B/C/D 同一最新固定产物已通过 18 个双连接 Skills Turn、冷重开、stdio/CLI Gate B、Electron current 聚合与 GUI shell。S09-F 已实施 canonical workspace 迁移与旧副本清理，新固定产物通过 25 Turn/6 次冷重开、stdio/CLI/Electron current，GUI 壳门禁待收。S09-E 已完成插件 Skill 来源和监听接线以及 1542 行 catalog 职责拆分，最新整库与实际产物验收进行中。下一刀继续同名 namespace、按路径身份选择和旧禁用配置迁移，再推进真正模型 compaction、R06 resume overrides。三端同实例和跨平台仍未整体验收；68 项包含待核实/排除项，总分母未冻结，不提供整体百分比。

## 目标与工作方式

主目标：以用户指定的 Codex current checkout 为参考，使 Lime CLI/TUI/GUI 共用同一 App Server 协议、RuntimeCore、工具与持久化 owner，并逐项对齐运行语义、Host 生命周期、结构和交付验证。

前轮 [11 项审计](./codex-cli-shared-backend-audit-2026-10-16.md) 是共享实例边界的首轮发现，不是全部差异。本计划按领域建立可持续扩展的任务账本；未核实项保持 `unverified`，有实现但缺真实交互证据记 `aligned-needs-evidence`，不把两者算成已确认缺陷。

用户已授权直接重构和清理。插件最新指令为不迁移、不考虑兼容，覆盖本计划中旧插件迁移要求；按 [插件重构与 LimeCore 联动计划](./codex-plugin-reconstruction.md) 执行。内部入口直接迁移调用方并删除重复实现；涉及已发布的 durable 配置/数据时，先给出旧数据夹具、迁移、幂等重开、失败恢复和迁后清理证据。没有持久化变化的切片不新增迁移或兼容层。

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

| 阶段 | 范围和交付                                                                                       | 主要 owner                                     | 初始状态 / 依赖                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| S00  | 刷新两仓 current 基线、能力矩阵、字段/消费者/测试映射；核销过期缺口                              | 本计划、既有 inventory                         | in-progress；持续随各阶段收敛                                                                         |
| S01  | connection identity、独立 initialize/client context、请求取消隔离、断连清理                      | App Server processor / transport session       | in-progress；首批实现                                                                                 |
| S02  | 按 Thread/Host 路由反向审批、permissions、userInput、MCP、dynamic tool；一次结算与重连接续       | server-request router / Thread subscription    | verified slices；Thread 交互与单 Host 动态工具已过 1904 项整库及真实进程；同实例多 surface 证据归 S16 |
| S03  | CLI/TUI/GUI attach 同一活跃服务；owned/attached shutdown、discovery、认证、remote workspace      | app-server-client / daemon / Electron Host     | known-gap；依赖 S01/S02                                                                               |
| S04  | public method、参数字段、null/omit、capability gating、typed schema/client 一致性                | app-server-protocol / handler / consumers      | partial；逐字段检查，不能只比方法名                                                                   |
| S05  | start/steer/interrupt/queue、admission、reviewer、错误终态、同 Turn 输入和取消                   | agent-runtime / App Server                     | partial                                                                                               |
| S06  | resume/fork/revert/archive/delete/search/paging、snapshot/notification barrier、durable settings | App Server / thread-store                      | partial                                                                                               |
| S07  | compaction、上下文预算、历史摘要、工具状态与媒体引用保留、恢复后继续任务                         | context / agent-runtime / thread-store         | unverified                                                                                            |
| S08  | command/process/file-change 生命周期、输出 drain、后台命令、sandbox/permissions/Guardian         | tool-runtime / execution / App Server          | partial                                                                                               |
| S09  | MCP OAuth、tool snapshot、elicitation、App UI、event stream、Skills/plugins/hooks                | MCP / Skills / plugin owners                   | partial                                                                                               |
| S10  | Multi-Agent spawn/send/wait/close、parent authority、mailbox replay、嵌套恢复和统一投影          | agent-runtime / tool-runtime / App Server      | unverified                                                                                            |
| S11  | CLI 参数/exec JSONL、输出/退出/signal、resume/fork、MCP/plugin/Skill 控制面与 launcher           | cli / packages/cli                             | partial                                                                                               |
| S12  | TUI 输入/composer/selection/render/streaming/history/pager/resize/focus/reconnect、终端恢复      | tui current modules                            | partial；按现有 owner 迁移，逐项核销旧 inventory                                                      |
| S13  | GUI typed request/projection、恢复竞态、长任务路由、交互表单、队列、多 Agent 和错误展示          | GUI gateway/router/reducer/hooks               | partial；避让正在修改的 GUI/设置写集                                                                  |
| S14  | runtime 配置/权限 profile/模型切换/工作区事实、五语言与平台路径                                  | shared config / providers / surface projection | partial                                                                                               |
| S15  | 数据与配置迁移、旧入口/无引用代码/重复 DTO/测试与守卫同步清理                                    | 各领域既有 owner                               | 随切片执行，不另建清理后端                                                                            |
| S16  | 真实 stdio/CLI/PTY/Electron、同服务三端并发、平台包与原生依赖矩阵                                | current fixtures / release package             | aligned-needs-evidence；每批按风险闭环                                                                |

阶段是职责边界，不要求串行等待所有同层任务；跨阶段变更以最小可验收切片推进。S15/S16 与每个实现切片同步，不能留到最后统一补测试或清理。

## 首轮已确认任务

| ID       | 任务                                                   | 状态                             | 来源 / 最小验收                                                                                                          |
| -------- | ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| CON-01   | 取消状态按 connection + request 身份隔离               | in-progress                      | F02；双客户端复用 integer/string ID 时互不污染                                                                           |
| CON-02   | initialize/clientInfo/runtime host context 按连接隔离  | in-progress                      | F06；GUI/TUI 分别保留 client name/version，初始化不互相授权                                                              |
| CON-03   | connection context 在断连/停服时回收，重连不继承旧取消 | in-progress                      | 正常关闭、异常断开、connection id 测试复用                                                                               |
| ROUTE-01 | 消除全局唯一 writer 的交互请求假设                     | verified / audited scope         | F01；Thread typed 交互按订阅路由，动态工具按注册 Host 单发；恢复屏障、断连失败结算和不重放已验收                         |
| ROUTE-02 | 同 Thread 双订阅反向请求 owner 和一次结算              | verified / Thread scope          | 首次派发、first response、late response、零 owner 重连、resume 屏障、response/interrupt 竞态均通过；不包含 Host 能力注册 |
| HOST-01  | GUI/终端明确选择并 attach 同一服务                     | known-gap                        | F03；真实 Electron + PTY 相同 server/Thread/Turn/Item                                                                    |
| HOST-02  | remote 未指定 cwd 时不发送本机路径                     | known-gap                        | F05；异平台路径、显式远端 cwd 与服务端默认 workspace                                                                     |
| GUI-01   | 活跃事件 route 不因固定 30 分钟 TTL 被回收             | known-gap                        | F04；时钟推进回归 + 活跃 Command 到最终终态                                                                              |
| CLI-01   | exec MCP elicitation 显式 cancel                       | in-progress / child evidence gap | F07；CLI unit 110 项及普通 Thread 真实进程通过，真实子 Agent attach 尚未验收                                             |
| CLI-02   | stdio 有界 stderr 诊断                                 | known-gap                        | F09；初始化失败可定位，stdout 保持纯 JSON-RPC                                                                            |
| LIFE-01  | resume 必要配置覆盖与 steer additionalContext          | known-gap                        | F08；复用 current settings/input owner                                                                                   |
| PKG-01   | Linux ARM64/musl、Windows ARM64 可交付性               | known-gap                        | F10；先核原生依赖，再做目标构建和本机包验收                                                                              |
| READ-01  | 多窗口 read-state revision/CAS                         | unverified / optional            | F11；先决定用户旅程，再实现共享 durable owner                                                                            |

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

| 验证                                | 实际结果与证据边界                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新 `shared-client-fixture`          | exit 0；真实 CLI + 两个 WebSocket App Server，backend=unavailable。integer/string 同 ID cancel 隔离、ID 复用、root 写入/删除目标、child Host 覆盖全部通过。日志 `/tmp/lime-shared-backend-shared-client-fixture-retry.log`                                                                                                                                                                                                                                                              |
| 新 `cli-mcp-elicitation-fixture`    | exit 0；runtime backend + loopback Provider + 真实 stdio MCP。Thread `01a14542-09d7-7ee2-8d69-53ec433a495b`、Turn `turn_247759175a344997b06ae4a82895c204`：MCP cancel 恰好一次，继续到 canonical completed Turn。未证明真实子 Agent attach；日志 `/tmp/lime-shared-backend-cli-mcp-fixture.log`                                                                                                                                                                                         |
| `smoke:cli-gate-b` 对应固定产物入口 | exit 0；流式 JSONL 与 cold read、真实 runtime 的 json/human SIGINT exit=130 与子进程回收、reasoning、五语言、resume/fork/review、图片顺序、schema、stdin、输出文件和 Command shutdown 通过。其余生成内容场景 backend=external，不能全部称 live/runtime；human TTY 因 outer-stdin 非 TTY 显式未跑。日志 `/tmp/lime-shared-backend-cli-gate-b.log`                                                                                                                                        |
| stdio smoke                         | client package tsc 通过；npm shell 调用后 loader path 未保留，报 stdin closed。改为直接 Node 运行同一 `stdio-smoke.mjs` 后 exit 0，真实 stdio initialize/protocol 与 unavailable thread fail-closed 通过。日志 `/tmp/lime-shared-backend-stdio-smoke-direct.log`；不把失败 npm 调用写成通过                                                                                                                                                                                             |
| 夹具定向测试                        | Vitest 2 files / 9 tests passed。初次误用 Node test runner 的失败保留，改用既有 Vitest 后通过；日志 `/tmp/lime-shared-backend-fixture-tests-retry.log`                                                                                                                                                                                                                                                                                                                                  |
| App Server Rust library             | 复用 settings 任务本次编译的当前工作树结果：1865 passed / 0 failed / 0 ignored，包含 9 项连接隔离及迁出的 20 项路由测试。来源 `.lime/qc/settings-profile/content-alignment-20261016/rust-changed-retry-2.log:297`、`:2166`。本任务另以同一新鲜测试产物定向执行 client_context：9/9 通过，日志 `/tmp/lime-shared-backend-s01-fresh-test-binary.log`；测试产物 SHA-256 `26417db9b493732f211cbaff07b2ec66dce04e15350021411f8e73f1ff0f7f40`。这验证当前工作树，不代表 settings 变更归本任务 |
| CLI bin Rust                        | 独立 target 重跑 exit 0：110 passed / 0 failed / 0 ignored，0.81s。日志 `/tmp/lime-shared-backend-cli-tests-isolated.log`。此前共享 target 链接 ENOSPC 与后续 extern missing 失败日志保留，未将失败调用写成通过                                                                                                                                                                                                                                                                         |
| GUI smoke / local gate              | renderer、Host、assets 构建通过；sidecar 编译 `lime-agent` 时因 `No space left on device` 退出 101，聚合命令退出 1，未进入真实 Electron smoke。日志 `/tmp/lime-shared-backend-gui-smoke-retry.log`；全量 local/frontend 仍为先前中断状态，未计通过                                                                                                                                                                                                                                      |

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

最终新产物 GUI 门禁已闭环：`npm run verify:gui-smoke` exit 0，日志 `/tmp/lime-shared-backend-s02-resolution-gui-smoke.log`，shell evidence 为 `.lime/qc/project-gates/standalone-shell-01-20261016163023-22288/shell-01-electron-smoke/summary.json`；定向 `approval-request-host-interrupt` exit 0，日志 `/tmp/lime-shared-backend-s02-resolution-approval-interrupt.log`，摘要 `.lime/qc/gui-evidence/claw-chat-current-fixture/shared-backend-s02-response-interrupt-summary.json`。后者经过真实 GUI 待审批→Host interrupt→GUI/同一 read model canceled→reverse request lifecycle；它使用 external fixture backend，不冒充 live/runtime sandbox 证据。验证后 App Server SHA 仍为 `6f3744b0…`。

本地 smart `verify:local` exit 0，但外部提交后只检测到生成物，实际没有选中验证任务，不能据此报告全量通过。显式 `test:resume` 因 `.lime/test/vitest-smart-last-run.json` 及父目录已不存在而 exit 1；历史日志只记录过第 1 批的 1 项测试通过，没有可恢复状态。未伪造续跑文件，按当前源码重新建立 `npm test` 记录，日志 `/tmp/lime-shared-backend-frontend-fresh.log`，结果待收取；后续中断仍从该记录 resume。

### R03 三态协议与执行消费

下一刀分两层验收：先修 wire `omit/null/string`，再证明选路、durable settings 与重开；第一层不能核销整个 R03。只读已确认 ThreadStart/Resume/Fork 与 TurnStart 四处 `Option<Option<String>>` 都缺 double-option serde；ThreadSettingsUpdate 虽正确，但有局部重复 helper。Turn handler 当前仅写 metadata `serviceTier`，`RuntimeRequest.service_tier` 与默认 merge 另有消费缺口；Codex 的 TurnStart 正常 serviceTier 影响当前及后续 Turn，不能当成仅供 UI 展示的 metadata。resume 覆盖目前明确不支持，修 wire 后显式 null 应走既有不支持错误，不能继续静默吞掉；完整覆盖能力仍归 R06。

R03 wire 窄写集：protocol `v2/{thread.rs,turn.rs,thread_control.rs,mod.rs,service_tier_tests.rs}`，复用既有 `serde_helpers`，移除重复的 double-option 函数，不新增第二 DTO/兼容路径。Verification Contract：P1 public contract，五种 DTO 各覆盖省略/null/string round trip 与非法类型；先取得旧实现四红一绿，再修复并运行 protocol library、schema/client 检查和契约门禁。公开字段形状、依赖与持久化格式不变；backend 执行消费和同实例验证在下一层独立落盘。

R03 wire 已取得预期旧红：5 项中 ThreadStart/Resume/Fork、TurnStart 四处 null 丢失，ThreadSettingsUpdate 正向对照通过，日志 `/tmp/lime-shared-backend-r03-wire-red.log`；修复后 protocol 整库 **139 passed / 0 failed / 0 ignored**，3.35s，日志 `/tmp/lime-shared-backend-r03-protocol-tests.log`。三个局部 double-option helper 已删除，现有其他 String/i64 三态字段也机械迁用同一个泛型 helper，字段形状和序列化合同不变。`thread.rs` 从 996→992 行，无继续堆叠业务逻辑。

R03 契约首次运行除 docs boundary 外通过：外部提交后这三份新计划成为 tracked-ignored，触发既有守卫；追加窄写集 `.gitignore`，按同区现有精确文件例外登记三份计划，不修改守卫、不更改其它 internal 目录策略，修复后单独重验文档边界。日志 `/tmp/lime-shared-backend-r03-contracts.log`、`/tmp/lime-shared-backend-r03-docs-boundary.log`。

R03 执行消费追加窄写集：`processor/turn.rs`、新 `processor/turn/settings.rs`、`processor/tests.rs` 与 `processor/tests/service_tier.rs`、`runtime/session_runtime_defaults.rs` 的三态默认合并。用 existing `RuntimeCore.update_thread_settings` 的 actor/preflight/persistence 唯一 owner 实施 durable serviceTier patch；同请求显式 model/effort/collaborationMode 跟随该 settings patch 一起校验，避免用旧模型校验新 tier。当前 Turn 同时携带 dedicated `RuntimeRequest.service_tier`；null 在默认 merge 中必须阻止旧 tier 回填。测试从真实 JSON-RPC handler 进入、捕获 backend 实际请求，并验证后续 Turn 与冷重开；公开 DTO/存储格式不新增，旧数据照常读取。该层仍在取得行为红灯，未写为 verified。

R03 消费层已取得两项独立行为红灯：公开 `turn/start` 显式 null 仍向 backend 发送旧 priority（`/tmp/lime-shared-backend-r03-runtime-red.log`）；即便 settings 在并发期间改变，默认 merge 也会把 priority 回填到 null patch（`/tmp/lime-shared-backend-r03-merge-red.log`）。后者 0 passed / 1 failed，前者 0 passed / 1 failed，均已编译成功后进入断言。

生产修复复用 `RuntimeCore.update_thread_settings`，输入 lowering 成功后才更新 durable tier；同请求的 model/effort/collaborationMode 参加同一次 preflight。`processor/turn/settings.rs` 是既有 settings owner 的调用衔接，不新增 runtime、registry 或存储。dedicated `RuntimeRequest.service_tier` 承载实际执行值，已有 metadata null 表示清除意图，默认 merge 禁止再继承旧 tier。新增回归要求 clear/string 两次真正 cold resume（通过公开 `thread/resume`，不重建 session），并验证无效输入不触发 preflight、被拒绝的新模型/tier 不写入。Architecture impact：minor；owner 与主链不变，责任开发者 root，2026-10-17。

R03 验证追加 test-only 写集：`scripts/app-server/service-tier-fixture.mjs` 与已有 `scripts/lib/openai-compatible-fixture-server.mjs` 的可选 catalog tiers/default。真实 stdio App Server + runtime + loopback Provider 捕获 `service_tier`，覆盖 Thread start 默认/显式清除、fork 清除、resume 覆盖显式拒绝、Turn omit/null/string、错误 tier fail-closed、两次进程冷重开；它不证明 Electron/TUI 交互或 live Provider。新 fixture 必须使用指定固定产物，避免共享 target 被并行构建改写。存储格式、schema 字段和依赖不变；已发布旧数据原样读取，不需要 destructive migration，过去被吞掉的 null 意图无法推断恢复，后续显式 null 按新合同清除。

R03 最新完整 `npm run test:contracts` 已 exit 0（`/tmp/lime-shared-backend-r03-contracts-final.log`），含 schema/client 无漂移、命令/脚本/CLI/文档边界。新增脚本后未放宽守卫。App Server 整库、新进程证据和前端新一轮全量继续收取，未计通过。外部流程新改 `scripts/electron/lib/macos-release-trust*`、`scripts/electron/macos-native-host-gate-b.mjs` 及未知 `local-conversation-page-*.js`，本任务避让；测试结果验证当前工作树，不代表这些变更归属。

R03 第一次消费层整库结果为 1879 passed / 1 failed：冷恢复新测试缺 event log writer，handler 返回 `session not found: tier-session`，不属于新生产断言失败。测试接入真实恢复依赖后，第二次整库 **1880 passed / 0 failed / 0 ignored**，47.44s（`/tmp/lime-shared-backend-r03-app-server-tests-retry.log`）。新前端全量 **131/131 批、1771 files、14165 tests passed**，runner 状态 `passed`，日志 `/tmp/lime-shared-backend-frontend-fresh.log`；不把测试预期错误日志当失败。Provider fixture helper 原回归 17/17 通过。

R03 实际进程进一步发现 catalog 数据缺口：手工声明模型先占位，`append_model` 抛弃同 ID 的 credential-scoped 已发现 metadata；因此 runtime route 看到 tier，但 Thread 默认/GUI catalog 看到空 tier。R03 仅修 wire/Turn 消费的新产物仍确定性红灯（`/tmp/lime-shared-backend-r03-catalog-process-red.log`，loader-prepared SHA `fd0ef44e9201b33e965cd2b49f280f5ce11e34b421ea79ef25c9a27b5af63453`）。早期 `/tmp/lime-shared-backend-r03-process-red*.log` 也停在该默认前置条件，不能称它已经验证 Turn null 行为。

为关闭这一实际阻塞，追加认领 `local_data_source/model_providers.rs` 与新 `model_providers/{catalog.rs,tests.rs}`：原 1615 行文件按 catalog/test 职责机械拆分（主文件 722 行）；模型保持配置中的排序，同 ID 优先使用既有 credential-scoped cache metadata，再退至声明值，最后追加发现的新模型；与 `ModelRegistryService.resolve_provider_model_metadata` 已有优先级一致，不新建 registry 或绕过凭证作用域。新增 HTTP fetch→scoped cache→catalog/runtime metadata 一致性回归，同时保留原模块所有测试。Architecture impact 仍为 minor，业务 owner 与持久化不变；无需存储迁移。新增改动后整库和新产物重新验证中，之前 1880 结果不核销这一追加修复。

R03 本地门禁调度记录：首个 `verify:local` 因默认 origin/main 选中 21 个 Rust 包，并开始向共享 target 生成默认 debug 产物，已仅停止该次本任务 PID 45775 及其 12 个子进程；日志 `/tmp/lime-shared-backend-r03-local.log` 保留，中断不计通过。无清理共享 target、无终止未知任务。后续本地门禁固定独立 target/debug=0/jobs=2，基线改为当前 HEAD，避免把外部提交分支累计差异当成本切片写集；不会改脚本或跳过选中的检查。

R03 catalog 新整库 **1881 passed / 0 failed / 0 ignored**，59.69s，日志 `/tmp/lime-shared-backend-r03-catalog-tests.log`；新增 fetched metadata 一致性回归通过，原 15 项 model provider 测试全部保留。catalog 追加修复后的完整 contracts exit 0（`/tmp/lime-shared-backend-r03-catalog-contracts.log`）；格式检查通过。

R03 新 production build exit 0（`/tmp/lime-shared-backend-r03-catalog-build.log`）；固定索引 `/tmp/lime-shared-backend-r03-binary-snapshot.json`，raw SHA `84bfeacd40150f1bc2a0bd178b37212c68aaeb0882def730e0d780f66ff4b2d2`，loader-prepared SHA `1049ba5cc88fa19721bc4e8b7e5c5ecc0bee521e3b77b7894a88259b97e0cc69`。真实 stdio runtime + loopback Provider **11 个 completed Turn 的 11 个 HTTP 请求全部匹配 tier**，覆盖 catalog 默认、ThreadStart null、fork null、resume null 显式拒绝、Turn clear/inherit/flex、非法 tier 零执行且保留旧设置、清除/覆盖后各一次冷进程重启。日志 `/tmp/lime-shared-backend-r03-process-green-final.log`，摘要 `.lime/qc/shared-backend/r03/service-tier-runtime.json`。首次新 fixture 对非法 tier 错把 structured `reasonCode` 当错误文案，已改为精确检查 `error.response.error.data.reasonCode` 后通过，保留首次失败日志而不修改产品错误合同。

R03 Verification Contract 结果：预算 normal，风险 P1；current owner 为 App Server/RuntimeCore settings、scoped model catalog 与 model-provider lowering。验证链 public JSON-RPC→canonical settings/admission→runtime→HTTP capture→持久化→两次 cold resume；未使用 live Provider，不验证 TUI PTY、Desktop tier 控件或跨平台。default/string/null 的断言全部来自实际执行与持久化，不以 DTO round trip 代替。新增 compat/deprecated=0；deleted 为三个重复 serde helper、原大文件内的 catalog/test 聚合实现，调用方直接使用原 current owner，不留第二套实现。

下一刀 R02 的只读结论：当前 `approvalsReviewer` 在 start/settings/fork 被持久化和投影，但 Turn 没消费，tool orchestration 也未读取。已存在 `--approve-for-me` 会写 `auto_review`；现有 Guardian 执行器由 `strict_auto_review` permission grant 触发且只构造 shell command review，不能把这项 grant 强行复用成 reviewer 模式或声称 MCP/普通工具已对齐。实施应在 current approval owner 传递 reviewer，区分一般自动审批与 strict grant，覆盖首次审批、sandbox/network retry、缓存命中、拒绝/取消与后续 Turn/重开；无法承接的 reviewer/工具组合必须明确失败，禁止成功后继续走 user reviewer。typed 值、已发布 metadata 及 importer 的迁移随同实现核验；不新增第二套审批后端。该只读补充不计 R02 完成。

R03 独立 target 的 `npm run verify:local -- --base HEAD` 已 exit 0，日志 `/tmp/lime-shared-backend-r03-local-isolated.log`；实际完成版本一致性与 21 个受影响 Rust package 的 library 回归，包含 App Server/protocol/client、agent/tool/provider 与 CLI/TUI 消费者。合计 **6103 passed / 0 failed / 5 ignored**；ignored 是原有 live/本地 TCP/GitHub 测试，不能写成全平台/PTY 通过。此入口本轮未选 frontend，前端证明来自上述单独完整 131 批记录；没有伪装门禁选择或跳过被选项。Electron renderer/Host/assets 已重建，`smoke:agent-runtime-current-fixture` 与 `verify:gui-smoke` 均 exit 0，driver `/tmp/lime-shared-backend-r03-gui-gates-driver.log`。聚合为定向测试 + mixed runtime/external Electron 场景，liveProviderUsed=false；壳 evidence `.lime/qc/project-gates/standalone-shell-01-20261016171514-26556/shell-01-electron-smoke/summary.json` 为 24/24 断言、三种视口及 reload/设置通过，production mock fallback=0。两者不证明 tier 控件、三端同实例、TUI PTY、Windows 或 live Provider。运行后固定产物 SHA 仍为 `1049ba5cc88fa19721bc4e8b7e5c5ecc0bee521e3b77b7894a88259b97e0cc69`。R03 按该合同 verified；resume 覆盖保留 R06。

## R02-A reviewer 执行切片

状态：in-progress。预算 normal，风险 P1；责任 root。current owner 仍为 App Server durable settings → typed runtime request/turn context → tool-runtime orchestration → 现有 Guardian provider/event owner。

最小合同：显式 reviewer 经 settings actor 持久化并作用于当前/后续 Turn；shell 需要审批时，auto_review 走真实 Guardian，而非 reverse user request。一般 reviewer 与 strict permission grant 分开；自动审查不复用人工 session approval cache，首次、sandbox/network retry 均保持 reviewer。非 shell 暂不能自动审查的审批必须明确拒绝，不静默走 user。无审批动作不额外调用审查模型。已有 Guardian timeout/invalid/cancel 拒绝语义保持。

窄写集：agent-protocol reviewer enum/turn context；App Server RuntimeRequest 与 defaults/lowering；processor/turn settings 接线及测试；session_operations settings 职责；agent turn-context configuration 与 tool_executor 的 Guardian 接线；tool-runtime orchestration retry owner 和直接回归；protocol generated 消费者按实际变化同步。已脏 R03 文件仅在本任务原补丁上续写。GUI/发布/未知文件继续避让；Codex 只读。

结构先行：session_operations 的 settings functions、tool_executor 的 Guardian 与内联测试按职责迁出，不向超千行文件追加业务逻辑、不保留 re-export 包装。持久化仍使用原 approvalsReviewer string 字段；需要核实已发布别名/非法旧值及 importer，typed public DTO 与完整迁移尚未核销，R02 不因本切片通过标记完成。

验证：先取 reviewer 丢弃/非法值接受的行为红灯；定向 App Server/agent/tool 回归，schema/client/contracts，同一真实 stdio runtime + loopback Provider 捕获审查采样和实际工具执行/零执行；主链改动按质量矩阵补 Electron/current/local 门禁。产品证据不外推 MCP/patch 自动审查、PTY 或跨平台。

R02-A 行为红灯：`/tmp/lime-shared-backend-r02-reviewer-red.log` 为非法 reviewer 被接受并丢弃；`/tmp/lime-shared-backend-r02-retry-red.log` 为非 strict 网络重试从 Guardian 改为 User；均在编译成功后失败。旧 R03 固定产物运行新真实 stdio/runtime/Provider/command 夹具，首个 user session approval 成功，切 auto_review 后 Guardian 调用数仍为零，明确复现人工缓存绕过（`/tmp/lime-shared-backend-r02-process-red.log`，并非 DTO 静态推断）。新 typed current/later/cold-resume 与非法值回归 2/2 通过，`/tmp/lime-shared-backend-r02-reviewer-tests.log`；后续追加 retry scope/cancellation 后整库运行中，前述 2/2 不覆盖追加改动。

R02-A 已按职责拆出 `session_operations/settings.rs`（原文件 1044→807 行），以及 `tool_executor/{guardian.rs,sequential_exec_tests.rs,tests.rs}`（原文件 1148→544 行）。既有测试直接迁移模块，不保留旧实现/re-export wrapper。共享 settings 进程测试提取到 `processor/tests/settings_support.rs`，service tier 与 reviewer 使用同一真实恢复依赖。新增 `scripts/app-server/approval-reviewer-fixture.mjs` 为 test-only，覆盖人工 session cache 后切自动、批准/拒绝/非法模型响应和冷进程恢复；尚待新产物验证。

Architecture impact：minor，扩展已有审批 owner，无第二 runtime/存储/网络边界；同步 `internal/aiprompts/architecture.md` 第 38 节图和取消所有权。责任开发者 root，2026-10-17；已核 current settings actor、typed request/context、tool-runtime retry 与 Guardian sampling/event 的依赖方向。此确认只覆盖本切片设计，运行验收和完整 R02 仍未完成。

R02-A 后续结构收口：人工审批/Browser approval 与 materialization 迁入现有 `tool_executor/approval.rs`，直接更新调用方；`orchestration.rs` 约 566 行，避免继续向 800 行聚合文件追加。Guardian 建连与 stream 采用同一个有界取消/超时范围，专用 handler 自己产生完成事件，tool-runtime 通过 existing approval trait 的 cancellation owner 能力等待其结算。retry review 接收实际 effective sandbox、grant 和 host，不能按第一次旧权限审查第二次执行。

中间整库：App Server 1884/0/0、agent 278/0/0（`/tmp/lime-shared-backend-r02-libraries-final.log`）；此前 protocol 139、agent-protocol 43、tool-runtime 509 项通过。新增畸形 JSON 边界测试在后续本地门禁验证，不能借中间结果计通过。完整 `test:contracts` exit 0（`/tmp/lime-shared-backend-r02-contracts.log`），schema fixtures 与 TS 生成同步 RuntimeRequest typed reviewer；public v2 字段仍保留 R02 后续范围。当前本地门禁按 reverse dependencies 实际选中 29 个 Rust package，未跳过；新固定产物构建等待同一 Cargo target 锁，不终止任何未知任务。

R02-A 当前运行证据：独立 target `verify:local -- --base HEAD` exit 0，**29 suites / 7031 passed / 0 failed / 5 ignored**（`/tmp/lime-shared-backend-r02-local.log`），其中 App Server 1884、agent 279（含畸形 JSON 不 panic/不批准）、tool-runtime 509、protocol 139、agent-protocol 43、CLI lib 8、TUI 1882。5 ignored 为原有环境/live 类测试，不证明平台/PTY。此入口未选前端全量，不能把 R03 旧前端结果冒充新快照。

新 production build exit 0（`/tmp/lime-shared-backend-r02-build.log`）；固定索引 `/tmp/lime-shared-backend-r02-binary-snapshot.json`，raw SHA `48b466065475d1dafc7a5b89d0b8eccbeb44a823f6e08129110ffaeec6abaebc`，loader-prepared SHA `eba17230143e9fa46e8d4e22b67f6d9ccdb9f182db244ec15d0493fb88c57e3e`。真实 stdio/runtime + loopback HTTP Provider **6 Turn、5 Guardian 采样、1 次人工 session approval、3 次真实文件写入**；覆盖从人工 cache 切自动、批准、拒绝、非法 JSON、cold restart 与 Provider 审查中断。拒绝/非法/取消均零新增写入；普通自动模式零人工请求、零 strictReviewRequired；reviewId/targetItemId 一致，inProgress→approved/denied/aborted 结算完整。日志 `/tmp/lime-shared-backend-r02-process-green-final.log`，摘要 `.lime/qc/shared-backend/r02/approval-reviewer-runtime.json`。liveProviderUsed=false，不外推 GUI Guardian DOM、MCP/patch 自动审查或跨平台。

R02-A Electron current 聚合与 GUI smoke 均 exit 0，driver `/tmp/lime-shared-backend-r02-gui-driver.log`；实际使用上述固定副本，避免构建 sidecar 改写被验产物。壳证据 `.lime/qc/project-gates/standalone-shell-01-20261016175651-2201/shell-01-electron-smoke/summary.json`；该聚合为 mixed runtime/external，不证明 live Provider、Guardian GUI DOM 专项或三端同实例。该产物与 7031 项门禁先于以下队列补丁，不能外推为队列修复后的源码证据。普通/strict 投影、内部 typed reviewer/schema/TS 已同步，public v2 DTO typed 化与 metadata/importer 收口仍未完成，R02 总项保持 in-progress。

追加消费者核查：`queued_turn_intent` 的显式白名单会丢新 reviewer，现直接补入 typed snapshot 双向转换，并覆盖真实事件恢复入口的旧 v2 快照（缺 reviewer 仍可读取且重写幂等）和非法 reviewer fail closed；不更改 snapshot 版本、不增加双写或第二恢复路径。首次队列域 83 项通过，旧格式/损坏值两项追加后重新验证中。`cli-gate-b` 的旧 generic metadata 断言同步迁到 typed RuntimeRequest，并守住重复 metadata 字段不回流。队列追加写集仅该模块及已有 CLI fixture；新固定产物、真实 reviewer 进程和 CLI Gate B 待验证。

## R02-B 公开 typed 合同与调用方收口

状态：in-progress。R02-A 队列追加域 **85/85** 通过，固定副本 SHA `e32bf1823e5827e00b9a6d453156abc3d8b40d9642eb2692cfac0376e76f549b`，索引 `/tmp/lime-shared-backend-r02-queue-binary-snapshot.json`。新版 reviewer fixture exit 0，覆盖原 6 Turn 加真实 `lime exec --approve-for-me`：合计 **7 Turn、6 Guardian 采样、1 次人工 session approval、4 次实际文件写入**，CLI 完成后由冷 App Server 读同一 Thread/Turn/command 事实。CLI JSON item id 为 `item_0`，canonical id 为 `item_command-7`，测试明确校验稳定 lifecycle 与投影映射，未伪称 wire id 相同。日志 `/tmp/lime-shared-backend-r02-queue-process.log`；无 live Provider、PTY 或三端同实例证据。初次固定副本未复制 loader libraries 导致启动失败，已通过既有 snapshot helper 补齐 sidecar siblings/dylib 后重验；这不是产品行为红灯。

current owner 不变，输入五类公开 DTO（start/fork/resume/settings/turn）统一复用 `agent-protocol::ApprovalsReviewer`；响应与 settings notification 返回实际 reviewer，缺省为 `user`。Codex 参照为 `app-server-protocol/src/protocol/v2/shared.rs::ApprovalsReviewer`，不新增平行协议枚举或审批实现。非法值应在反序列化时拒绝，不能先创建 Thread 再在下一 Turn 报错。

后续窄写集：v2 三个 DTO 模块与导出、Rust/TS generated schema、processor Thread lifecycle/Turn/settings、fork override、CLI PermissionSettings 和 TUI policy 传递及直接消费者/fixture。`processor/thread.rs` 已达 1256 行，先拆出 start/resume 生命周期和相关测试；`runtime/thread_fork.rs` 1049 行的 override 转换拆到 `thread_fork/settings.rs`。TUI `runtime.rs` 超长，本切片只做 reviewer 类型替换，不追加业务分支；拆分退出条件归 S12/TUI 领域，后续触碰行为前必须落实。验证冻结前不把 R02-A 的旧产物当作本切片证据。

metadata/importer 单列迁移验收：当前 `session_runtime_defaults` 仍双读 camel/snake 和 imported continuation/thread settings；canonical null 还可能挡住有效 nested reviewer。`conversation_import/provenance.rs` 仍复制 reviewer 到多个 generic metadata 层，未 lower 为历史 RuntimeRequest typed 字段。迁移必须在真实加载/恢复入口规范到唯一 canonical 字段，保留原始 `codexMetadata` provenance；重开幂等、失败不局部写、损坏值可定位，清除旧 runtime 双读/多处写入后方可核销。不得直接把旧 durable 字段删掉或默认清空用户会话。

R02-C 实施前约束（只读核查）：`load_context::load_projection_session`、`session_lifecycle::ensure_current_session_hydrated` 与 `thread_fork::hydration` 是恢复消费者；`resume_thread` 先读 canonical Thread 再 hydrate，迁移必须使返回 snapshot 和后续 runtime 看到同一值。仅调用 `ThreadStore::update_thread_metadata` 不足：当前 SQLite 实现只更新 canonical snapshot，未走 rollout metadata append；必须复用 `projection_store/session_settings::persist_session_metadata` 的 durable owner 或先收拢该职责，禁止迁移只写投影后被冷重建覆盖。取值合同为 canonical 非 null > 已发布 snake alias > imported continuation > imported thread settings > user；只对 import kind 读取 imported 层。先计算/校验完整新 metadata，再一次落 durable owner，成功后移除 root snake 与 nested reviewer 副本，保留原始 source provenance；运行默认值只读 canonical 字段。验收旧值/别名/null shadow、原设置修改后重开、archived/损坏输入、重复迁移、rollout 重建与故障重试；未完成前 R02 不核销。

R02-B 已取 public DTO 行为红灯（`/tmp/lime-shared-backend-r02-public-red.log`）：`thread/start` 的非法 reviewer 在 dispatch 前未拒绝。五类 DTO 与 CLI/TUI policy 现直接传同一 enum；字段默认、null/omit、别名归一及非法值覆盖所有入口。新增 processor 回归检查非法输入无执行/设置副作用，以及 start 默认与 fork 别名的 canonical 响应。既有旧 settings event null 夹具保留，投影边界将其转换为 `user`，新 writer 只写 enum。Thread lifecycle/测试直接迁出，主文件 1256→772 行；fork settings/validation 直接迁出，主文件 1049→879 行；无 re-export 旧业务包装。schema/TS 和消费者同步并验证中，不能以 R02-A 产物核销本切片。

Architecture impact：minor，复用同一 enum 和既有 owner，图的依赖方向不变。责任开发者 root，2026-10-17；已确认 protocol → typed surface、processor lifecycle → runtime settings actor、fork settings → canonical store 的边界，同步 architecture 第 38 节与 commands。此确认不替代迁移/运行验收。

R02-B 验证快照：protocol **140 + 1 schema fixture**、TS client build、前端四文件 **58 项**、`typecheck` 与完整 `test:contracts` 已 exit 0。首次 Rust 迁移编译暴露 moved module 相对路径和错误构造函数两处接线错误，已直接修正并重新跑，不能把该编译失败记成行为红灯。后续新 fixed build / Rust / local 门禁仍运行中，最终结论待收集。

本轮复核 Codex HEAD 仍为 `4eb4a65407d98cebc4c83bf13be440b9fbc78a7c`；Lime 最新观察 HEAD 为 `471d0a88f174842e2d77c717f28c49ebb03da62f` 加工作树，本进程未执行提交。`verify:local` 检测到 92 个改动，验证当前混合工作树，不归并他人实现归属。新增避让 `internal/research/codex-desktop-rea/{evidence-index.json,settings-navigation-audit.md,structure-alignment-ledger.md}`、`src/components/settings-v2/sections.tsx` 与既有 settings/release/tsbuildinfo/未跟踪产物；Codex 仓库保持只读。

## 分类与完成度

### R02-C 历史 reviewer 归一化（2026-10-17，本切片已验证）

认领 `runtime/projection_store/session_settings{.rs,/reviewer.rs,/reviewer/tests.rs}`、`projection_store.rs` 初始化接线、`canonical_rollout.rs` metadata append 的归档路径处理及对应测试、`session_runtime_defaults.rs` reviewer 消费、`conversation_import/{provenance,commit}.rs` 和定向恢复/导入测试。继续避让 GUI、设置、发布和研究并行写集。`projection_store.rs` 1718 行，本切片仅增加初始化调用，不堆叠业务逻辑；退出条件为在对应存储治理切片按 read/write/query 职责迁出，不能据此为聚合文件续加逻辑。`canonical_thread_store_tests.rs` 仅追加子模块声明，测试进入新文件。

采用存储初始化完成 rollout rebuild 后的一次归一化，替代在 runtime defaults、resume、fork hydration 三处长期双读。每个 Thread 在 SQLite immediate transaction 内读取最新 canonical metadata，计算并校验完整结果，复用 `session_settings` 的 metadata durable writer，再更新投影；不使用仅写 SQLite 的通用 metadata patch。归档迁移只追加原归档 rollout，不解除归档，不改变排序时间。优先级为 canonical 非 null → root snake 非 null → 已导入会话 continuation → imported settings → user。迁移成功删除 obsolete root/nested reviewer 副本，保留 `codexMetadata`；普通会话不消费 imported reviewer。非法选中值在写入前失败并报告 Thread identity。无 reviewer 的无关 Thread 不写新数据。

新 importer 在删除旧导入/创建会话之前校验 reviewer；历史 Turn 使用 typed RuntimeRequest，Thread 仅写 canonical reviewer，nested/generic metadata 不再复制。运行时只读 canonical reviewer。测试覆盖归档真实初始化、rollout 重建、重复打开、追加成功/SQLite commit 失败后重试、损坏输入不改旧数据，以及 public resume→实际 runtime request→用户修改→冷重开不复活旧值。当前实现尚未收齐验证，不核销 R02-C 或 R02。

R02-C 首轮 App Server library 为 **1894 passed / 3 failed**，日志 `/tmp/lime-shared-backend-r02-migration-rust.log`。两个 goal store 夹具没有 reviewer，迁移不应解码无关的完整 Thread；现先检查 metadata 是否需迁移，只有目标 Thread 才做完整 identity 校验。另一个红灯证明真实的空会话冷恢复缺口：`read_repaired_session` 在没有 EventLog 时清掉已由 canonical rollout 重建的空投影，导致 public resume 报 session not found；独立红灯日志 `/tmp/lime-shared-backend-r02-migration-empty-resume-red.log`。已修为仅在 canonical identity、零 Turn/Item 和零事件共同成立时保留空投影；较短 EventLog 的 watermark 拒绝不变。此修复由同一 public resume 回归覆盖，不靠制造首轮历史绕过。新增窄写集 `runtime/projection_repair.rs`。最终整库 **1897 passed / 0 failed**（`/tmp/lime-shared-backend-r02-migration-rust-final.log`），新 production build exit 0。

R02-C 跨版本真实进程仍为红灯：旧 B 产物 `b9505dba…` 导入的 rollout 被新 C `0287d409…` 拒绝为 `invalid rollout history record`（`/tmp/lime-shared-backend-r02-migration-process.log`）。初步怀疑不同 Cargo feature 集改变 JSON object 顺序，需保留原始记录后验证，不能改为同一 features 构建来掩盖已发布数据合同。追加窄写集 `canonical_rollout` 下 digest/validation 职责及对应回归，fixture 失败保留隔离数据。C current 聚合/GUI 尚未启动，不计通过；B GUI shell smoke 已 exit 0，摘要 `.lime/qc/project-gates/standalone-shell-01-20261016184138-50705/shell-01-electron-smoke/summary.json`。R02 保持实施中。

根因已由旧产物原始 JSONL 验证：原字段顺序重算 SHA 与持久化摘要完全一致；只排序 Item metadata 后即失配。B 构建包含 TUI 的 `preserve_order`，C 独立 App Server 构建未包含该 feature。独立 owner 回归旧实现 **0 passed / 1 failed**，日志 `/tmp/lime-shared-backend-r02-digest-red.log`；夹具从旧真实写入记录脱敏保留字段顺序，追加 v1 metadata 链覆盖。修复拆出 `canonical_rollout/digest`：新 v2 摘要递归排序全部 JSON object；旧 v1 仅在读取边界用 `serde_json/raw_value` 校验已落盘 payload，metadata append 使用 scan 保存的真实前驱摘要，允许 v1/v2 混合继续追加。没有重写旧文件、清库或跳过摘要校验。追加 App Server manifest 的 raw_value feature，锁文件无依赖版本变化；版本/完整 contracts 已 exit 0。架构第 38 节同步，minor 确认 root，2026-10-17。新增固定跨 feature 摘要向量、legacy 扫描/追加、内容及前驱篡改回归，完整复验待收取。

后续验证记录：默认门禁前端 **131/131 批、1772 files** 通过，Rust 首轮为 **1901 passed / 1 failed**，失败是新增脱敏夹具的 header 路径未同步，不是产品摘要/identity 校验失效；夹具已修。独立 App Server 新整库的 5 项 digest 回归全部通过，另一个既有 `json_lines_loop_streams_turn_failed_after_partial_external_backend_events` 在初始化/建 Thread 的通用 1 秒读取上超时（1901/1）。该场景的 backend 和 Turn 事件本已有 10 秒上限，追加窄写集 `lib.rs` 内该测试的两次握手读取，机械迁用同一个 10 秒事件等待 helper，不加 sleep、不放宽 terminal 断言。超千行 lib 不追加生产逻辑；测试 harness 拆分归后续结构清理。默认门禁后续 Rust/GUI 将按原选中项续完，前端 owner 未再变化，不重复 131 批，也不将失败的父进程标成 exit 0。

R02-C 最新独立 App Server 整库 **1902 passed / 0 failed / 0 ignored**，31.25s，日志 `/tmp/lime-shared-backend-r02-migration-digest-driver-retry.log`。该快照包含 corrected legacy fixture、5 项 digest 回归和有界 stdio handshake 修复；新 production build 与固定产物跨版本/GUI 验证继续收取，不能用 library 通过核销进程证据。

新 production build exit 0（同一 retry driver 日志）；固定索引 `/tmp/lime-shared-backend-r02-migration-digest-binary-snapshot.json`，raw SHA `7d90f6d8c3927cf90316cda84444c5232850603148353b0736f4ce245dbe67bc`，loader-prepared SHA `72e5c56b406e9efc6dbc8719ec33722ba3da768ff571f0ba2f7b5032dc9f03e5`。跨版本真实 stdio/runtime 验收已通过：旧 B `b9505dba…` 生成普通和归档会话，新产物迁移、resume、用户修改 reviewer、当前 importer 无副本与两次 cold reopen 均匹配。随后 **7 Turn、6 Guardian、1 人工审批、4 次实际文件写入** 和 CLI/canonical 关联全部通过；拒绝、非法回复、取消零新增执行，`liveProviderUsed=false`。摘要 `.lime/qc/shared-backend/r02/approval-reviewer-runtime-migration.json`，日志 `/tmp/lime-shared-backend-r02-migration-process-final.log`。第一次新进程已通过 migration/resume，后在 settings/update 被既有 experimental capability 拒绝；夹具补显式 capability 后通过，未放宽生产门禁。剩余选中 Rust 包和新固定产物 current/GUI 正继续执行，不能借 B 的 GUI 结果核销 C。

29 包 Rust 续跑再次得到 App Server **1901/1**，唯一失败为 `client_context_websocket_clients_share_threads_but_isolate_cancellation` 在 probe 释放后重绑时报 `AddrInUse`（`/tmp/lime-shared-backend-r02-migration-local-rust-retry.log`）。追加窄写集 `app-server-transport/src/transport/websocket.rs`、`app-server/src/client_context_transport_tests.rs` 和 `lib.rs` 的机械消费：现有 acceptor 返回其实际 bound address 与原 JoinHandle，测试直接绑定 loopback `:0`，删除先探测再释放端口的竞争窗口；transport 自身的同类测试同步迁移。没有新 listener、fixture transport 或协议入口，loopback 校验仍在 bind 前，生产 caller 继续使用原 handle。Rust 内部 API 直接迁移所有消费者，无需数据迁移；架构 owner 不变、minor，root 2026-10-17。验证需重跑 transport/连接测试与选中的 Rust 包，再更新最终产物证据；`72e5c56b…` 的既有数据迁移结果仍保留，但不冒充包含本追加修复。

追加修复的 related **transport 18 + 真实双 WebSocket 1** 全部通过（`/tmp/lime-shared-backend-r02-transport-related.log`）；29 个受影响 library package 最终 **7050 passed / 0 failed / 5 ignored**，含 App Server 1902、TUI 1882（`/tmp/lime-shared-backend-r02-migration-local-rust-final.log`；摘要 `.lime/qc/shared-backend/r02/rust-libraries-final.json`）。5 ignored 仍为原有环境/live 类测试。完整 contracts 再次 exit 0（`/tmp/lime-shared-backend-r02-final-contracts.log`）。

最终固定产物索引 `/tmp/lime-shared-backend-r02-final-binary-snapshot.json`：raw SHA `fe78e137d163304fb966ce8f0438394af4b5d2ace1885148afea23da1e7c45ee`，loader-prepared SHA `c4e561fbafe8ffbb61cac714c71b7585dc7d988d74383743d08ef62f6c7def8c`。它已再次通过旧 B 普通/归档会话迁移、当前导入、两次冷重开、7 Turn/6 Guardian/1 人工/4 实际写文件及 CLI/canonical 关联；摘要 `.lime/qc/shared-backend/r02/approval-reviewer-runtime-migration-final.json`，日志 `/tmp/lime-shared-backend-r02-final-process.log`。标准 stdio smoke 也 exit 0（`/tmp/lime-shared-backend-r02-final-stdio.log`），该标准场景为 `backend=unavailable` 的 fail-closed 握手，真实 v2 runtime/工具执行证明来自前述 reviewer fixture，不混淆证据等级。

最终 Electron current 聚合和 shell smoke 均 **exit 0**，driver `/tmp/lime-shared-backend-r02-final-driver.log`，结束时再次确认固定产物 SHA 未变。current 日志 `/tmp/lime-shared-backend-r02-migration-current-final.log`，实际包含审批、草稿恢复、同 Turn steer、Plan、Skills、MCP、错误重试、内容工厂等配置场景，`liveProviderUsed=false`；聚合为 runtime/external 混合，各场景只证明自身摘要声明的执行层。壳摘要 `.lime/qc/project-gates/standalone-shell-01-20261016193624-63414/shell-01-electron-smoke/summary.json`：24/24 断言、三尺寸布局、38 次 current IPC、零 mock fallback。壳场景不含 provider Turn，不能替代 Guardian GUI DOM 专项。R02-C 的迁移、唯一新写入、旧配置副本清理与冷重开退出条件已满足（本切片 100%）；R02 整体、TUI PTY、同实例三端、Windows 与 live 保持未核销。

下一刀 S02 的事实校准：Codex `app-server/src/bespoke_event_handling.rs` 将 DynamicToolCall 交给 `ThreadScopedOutgoingMessageSender`，`outgoing_message.rs` 按该 Thread 的连接列表发送；单连接 ceremony owner 仅明确用于 user verification。上游没有在此链提供“动态工具注册连接表”的证据。Lime 的 Browser `preflight → approvalToken → approvedExecute` 与 native WebContents route 已由 architecture 第 45 节要求单一 Host 执行，因此注册/重绑归属属于 Lime 共享实例的 Host 合同补全，不能写成上游已有同名 registry。实施前需核清 start/resume 的 frozen binding 与显式 Host 能力声明；禁止把有副作用工具改为 Thread 广播，也不能用 clientInfo 名称推断执行权。

### S02-D 动态工具单 Host 归属（已验证）

责任 root；P1。窄写集为 `thread_state` 的连接生命周期/Host 绑定、`dynamic_tool_server_request`、`processor/thread` 的 start/resume 与动态工具校验、dispatch 的 connection context 接线、`ThreadResumeParams`/生成物、`electron/appServerDynamicToolHost` 和直接测试。Codex 只读，避让 settings/release/research 并行写集。不新增 runtime、transport、通用命令或持久化 owner。

`thread/start.dynamicTools` 声明当前连接为执行 Host。`thread/resume.dynamicTools` 是显式能力声明，只能承接持久化的 frozen namespace/tool/inputSchema，不能修改会话工具；允许 Host 新 catalog 是旧 frozen 集的超集，描述文字不参与执行权判定。未声明的 CLI/TUI resume 仅订阅，不夺取工具执行权。活跃 owner 不被第二 Host 替换；断连清除绑定，只有 idle Thread 可重新绑定，活跃 Turn 不转交 preflight/approvalToken。`item/tool/call` 只发给绑定且仍存活的连接，缺 owner、断连、错误响应均失败关闭，禁止全局唯一 writer fallback 或广播执行。Electron 每次 start/resume 注入自身不可变 catalog，收到成功结果后才建立本地 WebContents binding。

Verification Contract：公开 JSON-RPC 双 Host start/resume/observer/错误 schema/活跃重绑/断连后 idle 重绑；同请求 wrong-owner/late response、断连取消和不重放；受控 provider 实际发动态工具，核对两端接收次数、一次执行与 canonical Item。先定向红绿，再相关 crate、contracts、stdio、Electron current/壳及 Browser 专项。无 live、PTY、Windows 或三端同实例声明。已发布 frozen metadata 保留，新字段为进程内执行能力声明，无数据库变更或旧业务 fallback。

已实施：Host binding 归既有 ThreadStateManager，能力校验迁到 `processor/thread/dynamic_tools.rs`，直接迁移 start/resume 消费者并删除仅过滤 method 的 `thread_resume_context` 包装与旧镜像测试。路由选择和 pending 登记在同一 Thread 状态锁内，断连不能先取消后漏登新请求。Electron 每次 start/resume 注入不可变 catalog，connectionLost 同时清 binding/call phase。Electron 13/13、protocol/client/CLI/TUI 相关消费者 2224 passed / 1 ignored 与 schema fixture 通过；最终 App Server 整库 1904/0/0 覆盖下述断连结算和恢复屏障修复。

真实进程回归 `scripts/app-server/dynamic-tool-host-fixture.mjs` 在旧固定产物 `c4e561fb…` 得到预期红灯：同 Thread 两连接使 canonical DynamicToolCall 因 `2 possible App Server clients` 失败，没有 Host 执行（`/tmp/lime-shared-backend-s02d-process-red.log`）。首个新产物 `dd3011bd…` 已修正该路由，但同一 fixture 暴露第二个真实缺陷：断连的 REQUEST_CANCELLED 被 `finish_server_request` 当作 Turn transition，动态工具 runtime waiter 无失败响应，回合悬挂（`/tmp/lime-shared-backend-s02d-process.log`，隔离数据保留）。追加窄写集 `server_request{.rs,/resolution.rs}` 和 `approval_server_request{.rs,/tests.rs}`：router 明确携带内部 turn_transition，只由 Turn interrupt/delete/停服设置；连接断开和客户端错误保持普通失败。动态 Host wire 回归现直接经过 finish helper，旧“客户端错误码就是 Turn 中断”测试迁到正确的失败合同，原真实 interrupt 竞态回归保留。该问题由下述最终整库与固定产物核销，首个新产物只作中间证据。

`dispatch.rs` 为现有 connection context 的机械接线；rustfmt 将原长 match arm 加括号，既有 fs source guard 随同迁到当前合法格式，仍断言精确 method→handler，不放宽匹配。完整 contracts 已再次 exit 0（`/tmp/lime-shared-backend-s02d-contracts-final.log`）。该文件因 rustfmt 783→827 行，本切片不追加业务分支；S04 后续触碰行为前按 dispatch 领域拆分。

断连结算修复后的中间产物 `40af54ee…` 已通过真实 runtime fixture（4 Turn、3 次 Host 实际写文件、观察端执行 0）、stdio、Electron current 聚合、Browser approval/disconnect 与 GUI shell。原始索引与日志保存在 `/tmp/lime-shared-backend-s02d-40af-evidence/`。它随后暴露恢复合同的剩余缺陷：动态工具直接写连接可先于 resume result 到达，且同 Host pending resume 会重放 `item/tool/call`（真实进程断言 `3 !== 2`）。新增两项 native 回归先得到 2 passed / 2 failed 的预期红灯，日志 `/tmp/lime-shared-backend-s02d-barrier-red.log` 与 `/tmp/lime-shared-backend-s02d-replay-process-red.log`。

追加窄写集 `thread_listener.rs` 与动态 Host 定向测试：首次登记和派发进入既有 Thread listener，复用 resume deferred publish；动态工具保留原单 Host，不 claim/broadcast，发送失败清 route；resume snapshot 只重放随 Thread 订阅者流转的交互表单，不重放执行请求。恢复响应必须先于首次执行请求，同一 Host resume 不重复执行。最终整库与独立固定产物已通过。另复核两仓 `app-server/src/current_time.rs`：`currentTime/read` 均按 Thread 唯一订阅连接选路，拒绝多个订阅者；该限制不是新增缺口，不另造 Host registry。

最终产物：`shared-dynamic-host-barrier-binaries-6laJOh/app-server`，raw SHA-256 `7a146284b2a33c567d726ed852fdf2fcd38b5b3bc94290bc16064827b5a2a284`，按既有 Electron rpath 准备后的固定 SHA-256 `1f999726bec6faec3c7ef335a9dbc5623a5e87811ae0b4016319be25bcdfb4aa`；索引 `/tmp/lime-shared-backend-s02d-barrier-binary-snapshot.json`。`scripts/app-server/dynamic-tool-host-fixture.mjs` 经真实 runtime/受控 loopback Provider 完成 4 Turn、3 次实际 Host 文件写入、1 次断连失败 Item 与 1 次冷重开；观察端执行 0，同 Host pending resume 请求数不增加。它只证明该两 WebSocket Host 合同，不代替 Electron 多窗口或 TUI PTY。

本切片最终验证：App Server **1904 passed / 0 failed / 0 ignored**；`test:contracts`、stdio smoke、Electron current 聚合、Browser Gate B approval/disconnect、`verify:gui-smoke` 全部 exit 0。shell 摘要 `.lime/qc/project-gates/standalone-shell-01-20261016204409-5036/shell-01-electron-smoke/summary.json` 为 **24/24、56 次真实 IPC、零 mock fallback**。完整索引与复制后的场景摘要位于 `.lime/qc/shared-backend/s02d-barrier/verification.json`，日志统一前缀 `/tmp/lime-shared-backend-s02d-barrier-`。本批未重跑无新改动的 131 批前端或 29 包 Rust；相关 Host 测试、消费者、typecheck 与最新 owner 整库补齐增量证据。S02-D 退出条件 **100%**；整体分母仍未冻结，不外推全面完成。

默认本地门禁首轮停在前端 **33/131**，失败为 test-only Rust 示例继承共享 `CARGO_TARGET_DIR` 后被同任务 App Server 编译锁阻塞，两次 120s 超时并阻塞 Vitest worker；不是 reviewer 产品断言失败。已精确将 `scripts/harness/deepswe-desktop-controlled-smoke.test.mjs` 的命令 target 设到该测试临时 workspace（不改进程全局环境），`verify:local` 通过既有 resume 机制续跑失败批次。原日志 `/tmp/lime-shared-backend-r02-public-local.log`，续跑 `/tmp/lime-shared-backend-r02-migration-local-resume.log`；不从第一批重跑。

R02-B 新固定产物 `b9505dba94b6cc55fdd53a201ff5dcfcd928984a90cac10aa2f412e8cd3d96fc` 已通过 reviewer runtime/CLI fixture（7 Turn、6 Guardian、1 人工审批、4 次实际写文件）与完整 `smoke:cli-gate-b`，后者外层非 TTY，不计人工 TTY 证据。日志 `/tmp/lime-shared-backend-r02-public-{process,cli-gate}.log`。App Server `approvals_reviewer` **3 项**、CLI **110 + 2 项**、TUI **1882 项**均 exit 0；`smoke:agent-runtime-current-fixture` 混合聚合 exit 0，`liveProviderUsed=false`。GUI shell smoke 与默认本地门禁仍在收尾；不能用后续 R02-C 工作树冒充 R02-B 固定产物内容。

current：连接 context / message entry、CLI connection / dispatch 和 exec typed consent，仍由既有 App Server、CLI owner 演进。新增的两个进程 fixture 与 loader 环境 helper 属于 test-only。

compat / deprecated：S01/T01 未新增业务兼容入口；R02-C 的 rollout v1 只读格式解码属于已发布数据迁移边界，新 writer 唯一使用 v2。deleted：`initialize_transport`、`allow_existing_process_initialization`、`handle_transport_initialize`，各命令分支复制的 root 参数归并，runtime reviewer 多源双读与 importer reviewer 副本，以及依赖当前 JSON feature 的旧 digest 实现；MCP elicitation 的 METHOD_NOT_FOUND 旧断言已替换。未保留旧入口 re-export 或双业务运行路径。S01/T01 无已发布存储格式变化；R02 的旧 metadata 与 rollout 通过上述迁移合同保留数据、归一化后清理。

本批 S01、T01、CLI-01 三个切片的代码实施为 3/3（100%）；阶段验收仍需上表所述证据，不能据此标记产品对齐完成。68 个领域工作包含待核实和产品排除项，总验收分母尚未冻结，不报告虚构的整体完成百分比。

## S03-A remote workspace（实施合同）

责任 root；P1；承接 HOST-02。Codex 参照 `tui/src/lib.rs::latest_session_cwd_filter`、`app_server_session.rs` 的 remote cwd override：远端未显式指定目录时省略本机 cwd，不用本机目录过滤远端恢复列表。Lime 当前 CLI exec 在 start、fork、Turn 和 resume lookup 中都提前填入本机 cwd，TUI startup/picker 也如此；此外 App Server `thread/start` 当前把缺省 cwd 存成空字符串，需核定服务端默认目录与返回值的一致性。

窄写集：CLI `connection.rs`、`main.rs::tui_options`、`exec.rs`、`exec/thread{.rs,_tests.rs}` 与对应 command tests；TUI `TuiOptions`/连接配置 owner、startup、App Server session thread-start 与 resume picker 的直接消费者及测试。服务端默认 cwd 如需修复，只触碰既有 Thread lifecycle/metadata owner，实施前追加旧空目录语义与迁移判断。Codex 只读，继续避让 GUI/settings/release/research。

预期：本地缺省仍取客户端当前目录；远端缺省在 start/turn/fork/list 边界不发送或筛选本机路径；显式远端 `--cd` 原样送服务端，不在客户端 canonicalize、检测存在或改写 Windows 路径；resume 后权限、Skills、搜索和后续 Turn 使用 canonical Thread 设置。不得新增 workspace registry、后端或 fallback。无 schema/依赖变更；既有发布数据保留，格式或默认值发生语义变化时先补旧数据真实加载回归。

验证：先建立 CLI/TUI 参数与 wire 的预期红灯，覆盖远端 omit、显式 Unix/Windows path、本地缺省与 resume/fork；真实 CLI 与 App Server 从不同 cwd 启动，检查 canonical Thread 与工具实际工作目录，冷重开后继续；TUI 从真实 PTY 验证服务端 cwd 与终端恢复。现有 S02-D 产物结果不能作为本切片验收。大型 `main.rs`/`runtime.rs` 触碰前将连接参数职责迁到既有 connection owner；不在超过 1000 行文件追加新业务分支。

结构准备写集追加：1396 行的 TUI `runtime.rs` 将连接选项/连接创建、Host 初始化、文件搜索、历史加载展示、链接/导出和既有测试分别迁到 `runtime/{connection,startup,file_search,history,actions,tests}.rs`，根文件只保留事件循环和直接接线，目标低于 1000 行；内部调用直接迁移，不保留旧 helper re-export。857 行的 `app_server_session.rs` 将 Thread lifecycle 方法迁到既有 session 的 `thread.rs` 子模块。809 行的 runtime `session_operations.rs` 将 inline 测试直接迁出，目录归一化仍由同一 actor/metadata writer 执行。

服务端语义：新 Thread 缺省 cwd 取服务进程当前目录，相对 cwd 由服务端解析；旧空值/相对路径/`cwd` 别名在 resume 时经已有 session metadata actor 幂等归一为 `workingDir`，明确保存的绝对目录不改写，不推测修正过去误传的本机绝对路径。归档会话不在 resume 时迁移；持久化失败不更新内存，重试仍可迁移。fork 只在新 target metadata 归一目录，源 Thread 保持不变。无新增 DB schema、配置 owner 或持久化双轨。

S03-A 实施追加：CLI remote 缺省 cwd 保持 None，TUI options/startup/picker 直接迁为可选目录；显式路径不在客户端 canonicalize。App Server start/fork 与 Turn 相对覆盖统一在服务端解析 cwd/roots；Turn 权限计算使用实际覆盖或已加载 Thread 目录。旧 cwd/working_dir 别名和相对 roots 通过同一 metadata actor 归一，已发布绝对路径不猜测改写。root cwd 别名迁移后删除，无新 schema/依赖或业务 compat 层。TUI runtime 主文件 1396→999、AppServerSession 857→785、session_operations 809→599，直接迁移调用方，无 re-export wrapper。结构图及确认已同步 architecture §2.1；Architecture impact minor，责任 root，2026-10-17。

当前验证：第一轮目录公共 wire 2/2、CLI lib 8 + bin 112、TUI 1882 项通过；追加 cwd/roots/故障重试/归档/fork 后目录 5/5 通过。完整 contracts exit 0（`/tmp/lime-shared-backend-s03a-contracts.log`）。App Server 首次整库 1906 passed / 3 failed，失败是旧缺 cwd Thread 的权限解析收到空字符串；已统一使用服务端 resolver 处理 legacy empty，整库复验中，不能把首次写成通过。迁移失败测试随后增强为实际 rollout owner，并验证新 SQLite 从 rollout 重建，待收取新结果。

真实进程预期红灯已取得：旧 S02-D server + 旧 CLI 运行新 remote fixture，真实工具执行完成后 canonical cwd 为 client-workspace，预期 server-workspace；日志 `/tmp/lime-shared-backend-s03a-process-red-confirmed.log`。首次 fixture 建目录竞态和 stdin 未关闭的失败属测试接线错误，均已修复，不计产品红灯。新增 `scripts/app-server/remote-workspace-fixture.mjs` 使用既有 TypeScript remote connection，不再实现 request registry；新增 TUI remote PTY 场景只从测试配置文件注入，验证真实键盘、alternate screen、termios 与 canonical 工具结果。新固定产物和进程绿灯未取得，S03-A 保持 in-progress。

S03-A 追加窄写集：processor/turn.rs 的 cwd/roots 与权限 cwd 接线、working_directory metadata owner、processor/tests/working_directory、test-only remote fixture 和 runtime_pty_tests/remote_workspace 模块；不扩展 resume override 合同。显式 TUI resume --cd 当前尚未被 resume 消费，R06 统一处理公开 resume overrides；本切片不冒充该能力已完成。后续仍为 Skills 动态根与真正模型 compaction，不因本切片通过缩小整体目标。

S03-A 固定产物与增量结果：App Server `4c65f31443f9f83334298da9b4905433bd0088d1d817d68ec2fa9315e7be4d21`、CLI `68070d93c52f99bd3442f1ff724a9fc84f10f96bd0488ab295b08acdef0568d4`；索引 `/tmp/lime-shared-backend-s03a-binary-snapshot.json`。最新 App Server 整库 **1909/0/0**，包括实际 rollout 写入失败后 retry、由新 SQLite 从 rollout 重建的目录一致性。remote runtime fixture **8 个 completed Turn / 8 次实际 pwd 文件写入 / 3 项真实 PTY / 1 次 daemon 冷重开** exit 0；PTY 检查键盘提交、alternate screen、mouse mode 与 Unix termios 恢复。CLI default/relative/latest/fork/cold resume 与 TUI default/relative/remote picker 均由 canonical Thread/Turn/command Item 校验。无 live Provider、跨操作系统或 Electron remote 交互声明。

进程夹具前两次 PTY 失败属于测试观测问题：真实 30x140 PTY 被 24x100 parser 观察，以及恢复旧 transcript 的完成 marker 被新 Turn 误匹配；已同步 parser 几何并为每 Turn 使用独立完成 marker。最终 3 项 PTY 均实际执行，未将未运行测试或旧 transcript 算作新回合。stdio smoke 与完整 CLI Gate B 已 exit 0；后者外层不是 TTY，不外推 human TTY。Electron current/GUI 与默认 local gate 收取中。当前证据与源码 SHA 清单 `.lime/qc/shared-backend/s03a/verification.json`；该索引在最终门禁完成前保持 in-progress。

## S09-A Skills 动态根（下一实施合同）

责任 root；P1；承接 R08，R21 的配置通知按相同 owner 一并核查。Codex 参照 `app-server/src/skills_watcher.rs::{register_runtime_extra_roots,register_thread_config}` 与 Thread lifecycle/catalog processor。Lime 现有 watcher 只在启动时捕获 default roots，extra/workspace roots 虽进入 snapshot，却没有注册到文件监听；当前 config/write 只失效缓存，无 typed skills/changed。目标是 runtime extra roots 替换、Thread canonical cwd/roots 及配置变化均经同一个 watcher/notification owner；动态新增、改写、删除 Skill 后两个连接看到通知，下一 Turn 实际使用新 snapshot，禁用后不再消费。

窄写集预告：`skills_watcher.rs` 与其注册/回归子模块；既有 App Server constructor、RequestProcessor skill/Thread lifecycle、ThreadState 的监听注册生命周期；仅在确需复用 roots 计算时触及 skills snapshot 的 root resolver，不新建 catalog、后台扫描后端或第二 cache。watch registration 只管理监听资源，不承接业务配置；Thread unload/delete/shutdown 必须释放，extra roots 替换不得泄漏旧路径。继续避让外部 GUI/settings/release/research 写集。

结构前置：App Server `lib.rs` 4153 行，其中近 2000 行 inline tests；进入 constructor 行为前，将 constructor 移到专属 initialization owner，测试按 lifecycle/event/streaming/transport 迁出；不向超千行 lib 追加业务分支。保留 root 公共类型/API 的正常导出，不创建旧函数 wrapper；current source guard 随实际 owner 更新。剩余 transport/event 大文件后续按边界继续拆分，不能借本次拆分宣称整体结构已完成。

Verification Contract：先用旧固定产物取得动态 extra/workspace 文件变化丢通知的真实红灯；注册生命周期与不存在根创建/原子替换/删除重建/替换旧根的 owner 回归；公开 JSON-RPC 两连接注册与配置通知，受控 Provider 捕获下一 Turn 的真实 Skill snapshot，最后按 current/runtime、stdio、GUI/local 风险矩阵补证据。无协议或 DB schema 变更的预期；extra roots 仍为既有进程期设置，已发布 skill 配置和 locator 不做猜测重写。当前仅完成只读分析与合同，S09-A 未实施、不计完成。

S03-A 收取进展（2026-10-17）：Electron current 混合聚合已 exit 0，GUI shell 仍运行；默认本地门禁首轮前端 25/131 停在 `tui-composer-structure` 仍从旧 AppServerSession 根文件读取 `ThreadHistoryMode::Paginated`。已将该断言迁到 `app_server_session/thread.rs`，通过既有 resume 从失败批次继续，不恢复旧 helper；日志 `/tmp/lime-shared-backend-s03a-local-resume.log`。新增 S09-A 源码期间的后续本地门禁验证当前工作树，不冒充 S03-A 原固定源码快照。S03-A verification 在全部门禁收齐前保持 in-progress。

S09-A 可信红灯：SDK 的 notification observer 本身不维持 read demand，初次观察超时及 `.transport.close` 误用均为测试接线问题，已改为公开 `connection.nextNotification` 与 `sidecar.close`。修正后的旧固定 S03-A 产物在注册通知和初始 catalog 均通过后，修改 extra root Skill 时 15 秒内没有 `skills/changed`；日志 `/tmp/lime-shared-backend-s09a-roots-red-observed.log`，这是本切片的产品 red。

S09-A 实施中：constructor 迁 `initialization.rs`（152 行），近 2000 行 inline tests 按 lifecycle/events/streaming/transport 迁出；原 lib 4153→2036 行，仍有 transport/event 大职责待后续拆分，禁止据此宣称整体结构完成。迁移后的 lifecycle 10/10 通过，日志 `/tmp/lime-shared-backend-s09a-refactor.log`；source guard 已改到实际测试 owner。动态 roots 与 RAII registration 复用唯一 notify watcher，邻近 parent 观察不存在根创建与目录替换；extra roots 替换立即重算资源，Thread registration 只持有 project roots（避免把旧 extra root 锁在 Thread 注册里）。Thread start/resume/fork 注册 canonical cwd/project roots，卸载/删除/shutdown 释放；远程 Environment 路径不注册本机 watcher。`skills/config/write` 与已有 catalog 写操作成功后广播 typed 变化，失败不通知，文件变化先失效 snapshot 再节流通知。

本批追加写集：既有 `skills` snapshot getter/export（只读取唯一 process extra root 设置）、runtime_backend workspace metadata resolver 的复用导出、processor/skill/watcher 与 ThreadState 的注册生命周期、相关 owner tests。无 protocol、DB schema、依赖或已发布 locator 改写。架构 §2.1 同步，minor，root 2026-10-17 确认；尚无新 production binary / 双 Host / Provider snapshot green。Turn 临时 cwd/roots、plugin roots 和同名优先级仍需继续核查，R08/R21 不因本轮代码接入提前核销。

S03-A Host gates 已全部 exit 0：stdio、完整 CLI Gate B、Electron current 混合聚合及 GUI shell。driver `/tmp/lime-shared-backend-s03a-host-gates.log` 最终校验固定 App Server SHA 未变；shell 摘要 `.lime/qc/project-gates/standalone-shell-01-20261016213412-23341/shell-01-electron-smoke/summary.json` 记录 38 次真实 IPC。该 shell 场景不证明 Electron remote workspace 专项。默认本地门禁仍续跑中，不提前写 verified；S09-A 的新增源码不包含在本次固定产物中。

S09-A 结构门禁收口：默认门禁续跑至 63/131 时，发现 `processor/dispatch.rs` 828 行，命中既有 800 行职责护栏；Skills command group 直接迁到 `processor/skill/dispatch.rs`，主分发表 763 行。没有放宽阈值或恢复旧入口。相同门禁还暴露 R02 已删除的 `thread_resume_context.rs` 仍被 `appServerRuntimeBoundary.testSupport` 作为必须存在的旧文件；守卫已迁到 current Thread lifecycle/Skills owner，定向 **25/25** 通过，TUI structure **56/56** 通过。后续默认门禁通过既有 resume 从 63/131 继续；不抹除前轮失败记录。

Watcher 首轮 **8 passed / 1 failed**：新增的“缺失嵌套根创建→原子目录替换→再编辑”暴露 macOS `/var` 与 `/private/var` 路径别名；不存在根此前不能 canonicalize，后续 OS 事件用了 canonical 前缀，过滤丢事件。已将监听资源路径按最近存在祖先归一后拼接后缀，仍保留原 Skills 配置路径，不新增数据迁移或修改用户 locator。追加 App Server/Skills 整库复验中；不得把 8/9 写通过。AppServer 根结构中冗余的 `_skills_watcher` 持有已移除，由 RequestProcessor 持有唯一 watcher；无 root 兼容 getter/wrapper。

S09-A 整库首轮已收取：App Server **1913 passed / 1 failed / 0 ignored**，新增 missing-root/atomic-replacement 回归已通过。唯一失败是既有 `local_data_source::tests::successful_skill_catalog_mutation_emits_typed_invalidation` 仍假设 notification 只出现在请求响应数组；已迁为检查唯一 RPC 响应和真实 outbound broadcast，不恢复重复通知。`lime-skills` 因 Cargo 在 App Server 失败后停止，尚未执行；当前默认门禁将继续验证最新源码。完整 contracts 已 exit 0，领域拆分后的 client contract guard 再次 exit 0，Prettier check 与 scripts governance exit 0。新固定产物正在构建，进程夹具保持待验；所有全绿/完成声明仍未作出。

S09-A 核心进程绿灯：固定 App Server raw `8725063fe811d08a8ec3632ae79525e9d709ef264f0b3993f04d4fd0ce517302`，loader-prepared `2800817931ecb630b2c8545fa908f0dc63dc8fd51ecc11615f9b6c99dca2ecd0`；索引 `/tmp/lime-shared-backend-s09a-binary-snapshot.json`。两个真实 SDK WebSocket 连接各收到 8 次 typed 变化，catalog 使用 `forceReload=false`；6 个 completed runtime Turn 分别捕获初始、extra edit、project edit/recreate 后、禁用 extra、重新启用及移除 extra 后的实际 Provider 当前上下文。摘要 `.lime/qc/shared-backend/s09a/skills-roots-runtime.json`，日志 `/tmp/lime-shared-backend-s09a-process-current-context.log`。原始六回合 fixture 已固定复制到同目录 `skills-roots-fixture-core.mjs`，SHA `32d1247717a1dac828ea95b407e3146c0bcae591bd35a743efe6439075d68106`；后续扩展脚本不能冒充原执行版本。无 live Provider、GUI/PTY Skills 交互或异平台声明。

进程观察层修正：初始 oracle 只检查 system/developer，忽略显式 Skills 正文在当前 user context 上的 wire；extra Skill 也会因 4000 字符 catalog 预算未被广告。现以明确 `$watch-root-proof` / `$workspace-watch-proof` 触发当前 Skill selection，检查当前 system/developer 及当前用户输入之后的 Skill context，排除历史原始 Skill 正文。此前 400 均为 fixture 断言引起，不误报模型网络产品故障；实际 wire role/marker diagnostics 已保留。

## S09-B Skills effective scope / disabled prompt（实施合同）

责任 root；承接 R08/R21 未关闭范围，不影响上述六回合固定证据。下一刀先验证禁用 project Skill（位于 prompt 前部、不会被 catalog 预算隐藏）后，下一 Turn 是否仍广告 disabled metadata；`agent_render` 目前没有 enabled 过滤，新 owner 回归先 red。窄写集为 `skills/src/agent_render.rs` 与现有实际进程夹具扩展；无配置/协议/存储格式变化，无已发布数据迁移。然后补核 Thread settings cwd 更新、Turn 临时 cwd/project root 与 plugin snapshot 的监听资源来源，复用 current workspace/config/snapshot owner，不把 permission roots 猜测当成 Skill root，也不另建 roots 配置副本。每个追加行为先有可信 red 再实施；S09/R08/R21 在这些范围核清前保持 in-progress。

S09-B project-disable 产品 red 已取得：前 6 Turn 成功后，`skills/config/write` 禁用 project Skill，两连接 catalog 均 `enabled=false`，但第 7 Turn 的真实 Provider system message 仍含 `PROJECT_AFTER_WATCH_381`（显式正文已正确不加载）。受控 Provider oracle 因当前 snapshot 仍广告禁用条目而拒绝；日志 `/tmp/lime-shared-backend-s09b-disabled-project-red.log`。这与前述仅遗漏 user context 的观察错误不同，wire 角色/marker 证明这是产品缺陷。已在唯一 `skills::agent_render` 过滤 disabled metadata，并使预算 omitted 计数只统计 enabled Skill；全禁用返回 None，混合 snapshot 保留启用项。catalog 本身继续返回 disabled 状态，配置与数据格式不变，无新迁移层。追加 owner 回归和新产物/第 7 Turn green 待验。

S09-B 进程与领域验证已收取：`lime-skills --lib` **69/0/0**，其中包含禁用提示与 omitted 预算回归；旧 catalog mutation 广播断言迁移后定向 **1/1**。新固定 App Server prepared SHA `838e41a42cd8246e74bca8587df63813f4445ee2145e237a371053a88a823d2d`，索引 `/tmp/lime-shared-backend-s09b-binary-snapshot.json`；禁用 project 场景真实 **7 completed Turn**，双 SDK WebSocket 连接、catalog disabled 与当前 Provider prompt 一致，日志 `/tmp/lime-shared-backend-s09b-process-green.log`、摘要 `.lime/qc/shared-backend/s09b/skills-roots-runtime.json`。尚未用这份产物完成 Host gates，不提前核销 S09。

## S09-C Thread Skills 作用域更新（实施合同）

责任 root；P1；窄写集：`processor/{session_operations,skill/watcher}.rs`、`runtime/session_runtime_defaults.rs`、旧 watcher 专用 workspace helper/导出、对应 owner 回归与既有 Skills roots fixture。Thread settings 的 cwd 更新后，监听注册必须跟随 durable settings；start/resume/fork 的 project root 直接消费 runtime defaults 的同一解析结果，删除 watcher 平行 metadata 解析，包含 `runtimeWorkspaceRoots` 与导入会话的有效优先级。远端 Environment 仍不得注册本机路径。验证合同：先在 S09-B 固定产物分别获取 cwd 更新、启动指定独立 workspace root 后漏通知的真实红灯；新注册释放旧资源的 owner 回归；双连接通知、`forceReload=false` catalog 与下一 Turn 实际 prompt 三者一致。无协议、配置或持久化格式变化，不新增数据迁移层。Turn 临时作用域及 plugin roots 后续单独核查，不由本切片代验。

S09-C red 已收取：`/tmp/lime-shared-backend-s09c-cwd-red.log`、`/tmp/lime-shared-backend-s09c-root-red-observed.log`；设置 cwd 和新 Thread runtimeWorkspaceRoots 的初始真实 Provider snapshot 都已包含对应 Skill，排空 12 秒 setup 延迟通知后编辑，两个连接均未收到 typed 变化。root 首次测试错误地给 settings/update 发送不支持的字段，服务端明确拒绝，属于夹具接线错误，不计产品 red，也不借此扩展公开合同。当前修复已实施、定向测试待验。

S09-C 固定产物进程 green：prepared App Server `7af2e629722e0338cfc37afde5c2dab187113c29a89a24a9787474395a3bb8e5`，索引 `/tmp/lime-shared-backend-s09c-binary-snapshot.json`。cwd 更新、独立 runtime workspace root 两场景各 **3 completed Turn**，最后再跑禁用 project **7 completed Turn**；同一产物共 **13 Turn**、两连接 typed 通知、`forceReload=false` 目录与实际 Provider 当前上下文一致。固定 fixture 和 30 项源码摘要、red/green 日志已保留到 `.lime/qc/shared-backend/s09c/verification.json` 所在目录。contracts、scripts 与 stdio exit 0；CLI/current/GUI Host gates 和选中 Rust 续验仍在执行。

默认门禁续验边界：S03-A 的 `verify:local -- --base HEAD` 在前端 131 批完成后，Rust App Server **1913 passed / 1 failed / 0 ignored**，失败为 `tests::streaming::json_lines_loop_streams_external_backend_events_before_turn_response` 等待输出超时。未修改产品或放宽断言；当前按原选中包集合加 `--test-threads=2` 续验，日志 `/tmp/lime-shared-backend-s09c-local-rust.log`。原父进程 exit 101 保留，不能写成默认命令 exit 0。S09-C 第一次定向编译误用 canonical ThreadReadParams 的导出路径，已改为实际 `agent_protocol::thread`；该失败不计测试通过，新 owner 回归由最新选中包续验覆盖。

## S09-D Turn workspace 的持久语义（下一实施合同）

源码核查纠正：Codex `app-server-protocol/src/protocol/v2/turn.rs` 明确规定 `turn/start.cwd`、`runtimeWorkspaceRoots` 覆盖“当前及后续回合”，不是临时目录。Lime 当前 lower_runtime_options 只为本回合设置 cwd/roots，`apply_turn_settings` 仅处理 tier/reviewer；S03 的 `working_directory_turn_resolves_relative_override_without_rewriting_thread` 测试固化了错误语义，必须迁移，不能以额外临时 watcher 包装掩盖。S09-C 仅证明 Thread settings cwd 与启动 roots，未核销本项。

责任 root；P1；预计窄写集：Turn settings lowering、既有 session metadata actor/working-directory owner、工作目录和 Skills scope fixture/回归。复用同一 durable metadata transaction，将服务端归一后的 cwd/roots 原子写入；成功后替换同一 Thread watcher。先用 S09-C 固定产物取得 Turn 已执行但 canonical workspace 未更新的 red；再验证下一无覆盖 Turn、两个连接、卸载/冷重开和写入失败保旧状态。roots-only 也必须可提交，不能为通过 validation 伪造第二项设置。现有 wire/持久化字段足够，禁止新增根配置或第二 runtime。旧错误预期直接迁移，历史目录不猜测修复；plugin roots 仍另列未完成。当前仅补合同和实际 red 夹具，未实施、未计完成。

S09-D 已取得真实 red（`/tmp/lime-shared-backend-s09d-turn-scope-red.log`）：固定 S09-C 产物已按新 cwd/roots 完成 Turn，第二 SDK 连接读回 canonical cwd/roots 仍为原 workspace。修复已实施：Turn settings 和公开 Thread settings 共用 `update_thread_context` 与原 metadata actor，workspace roots 只进入同一 candidate/persist transaction，roots-only 与 `[]` 明确处理；写入成功后刷新 Thread watch。删除同一权限 profile 的重复解析。旧不持久化测试直接迁为“下一 Turn + 冷重开继承”，追加 roots-only/clear 与真实 SQLite 写失败保旧状态/无 admission/重试回归。无协议/schema/DB 格式变化；历史已完成 Turn 不猜测回写。架构 §2.1 已同步，minor，责任 root 2026-10-17 确认。新产物和定向回归在运行，未写完成。

S09-C Rust 续验记录：原流式测试已通过；新 owner scope 回归前两轮分别暴露 test-only 夹具遗漏 initialized 通知、canonical store（均为 **1914 passed / 1 failed**，日志 `s09c-local-rust{,-2}.log`）。握手、ProjectionStore 与 EventLogWriter 已补齐，不将夹具错误当产品 red，也不隐藏失败父命令。最新源码（含 S09-D）必须重新执行 owner 和选中 Rust 门禁，不能用 C 的固定运行产物核销 D。

S09-D 定向回归已通过 **3/3**：cwd/roots 当前及后续 Turn、冷 resume；roots-only 与清空后继承；SQLite 更新失败保留 canonical/内存目录、无 Turn admission、移除故障后重试。日志 `/tmp/lime-shared-backend-s09d-domain.log`。新产物 prepared SHA `3a4dd63a07fb4d78afb76b1afa29d969d276721c1b9722c54c8472f6523f51c7`，索引 `/tmp/lime-shared-backend-s09d-binary-snapshot.json`；真实双连接/冷重开 fixture 与最新选中 Rust 全部仍在运行。

S09-D 增量收取：同一新产物重新执行 cwd settings、独立 workspace roots、禁用 project 和持久 Turn scope 四场景，合计 **18 completed Turn / 18 次真实受控 Provider 当前上下文捕获 / 1 次 daemon 冷重开**。索引 `.lime/qc/shared-backend/s09d/verification.json`，包括固定 fixture、34 项源码摘要及 red/green 日志。最新 App Server 整库 **1917/0/0**，scope 生命周期、原流式测试和三项持久作用域回归均通过；其余选中 Rust 包仍续验中。contracts、scripts、stdio、完整 CLI Gate B exit 0，新产物 Electron current/GUI 仍在运行。旧 S09-C 产物 stdio/CLI/current/GUI 全部 exit 0（shell summary `.lime/qc/project-gates/standalone-shell-01-20261016221348-51293/shell-01-electron-smoke/summary.json`），不据此核销 D 的桌面门禁。

迁移范围仍需单独验证：导入会话的 `importedContinuation` / `importedThreadSettings` 在 runtime defaults 中先于根 metadata 读取；本次 18 Turn 使用 current Thread，不能外推其新 cwd/roots 覆盖会压过导入 continuation。下一阶段补真实导入/旧数据覆盖 red，必要时在同一 settings/migration owner 移除已被显式覆盖的旧值，禁止增加优先级标志或另一套配置。S09-D 当前只按已验证的 current Thread 范围报告，不把已发布数据迁移完整性写成完成。

S09-E 实施前发现（历史快照，当前状态以下文为准）：`runtime/skills.rs::list_skills` 仅扫描 cwd/default/extra roots；`runtime_backend/agent_skills_context.rs` 则追加 enabled plugin 的 `package_root/skills`，catalog 与实际模型 snapshot 的来源已确认不一致。`processor/plugin.rs` install/uninstall/enabled 成功只广播 app list，尚未进入 Skills mutation/watch；`plugin_catalog::installed_package_root` 仅验证包根边界，不能假设每回合有 digest 校验从而排除本地变化。先以实际本地插件安装/启用的同一包补 catalog/notification/Provider red，再收敛同一 snapshot 和资源注册。`local_data_source/plugin_catalog.rs` 当前 1542 行，触碰前按包安装、清单/库存与路径资源拆分，不继续堆逻辑；本阶段只读，不作运行/安全完整性声明。R08/R21 因插件与同名优先级尚未完成而继续 active。

S09-D 本地续验收取：原选中 Rust 集合 exit 0，**29 个测试批次 / 7067 passed / 0 failed / 5 ignored**，含 App Server 1917、Skills 69、TUI 1883。忽略项为既有 embedding/services 环境测试；原默认父命令 exit 101 和前端 131/131 批通过记录保留，不能改写为默认入口一次全绿。S03-A 的 local 字段同步为当前源码（含后续 S09-D）的阶段续完证据，不冒充原 S03-A 固定二进制的源码快照。日志 `.lime/qc/shared-backend/s09d/local-rust.log`。

## S09-F 导入会话 workspace 迁移（实施合同）

主目标：已发布导入会话更改目录/roots 后，canonical Thread、watcher、下一 Turn 和冷重开使用同一上下文。责任 root；P1；先于插件来源收敛处理。当前 owner 为 `projection_store/session_settings`（durable 迁移）、`session_operations`（显式修改）、`session_runtime_defaults`（消费）和 importer；不新增 schema、配置副本或第二后端。

真实 red：固定 S09-D 产物经公开 `conversationImport/thread/commit` 导入隔离 rollout，随后设置当前 provider/model 并 resume，初始 Turn 正常；`thread/settings/update.cwd` 后下一 Turn 的受控 Provider 请求仍含旧 workspace Skill、缺新目录 Skill，日志 `/tmp/lime-shared-backend-s09f-import-red.log`。临时夹具 `/tmp/lime-imported-workspace-fixture.mjs` 从当前 Skills fixture 与既有真实 importer helper 派生；此 red 证明导入 cwd 覆盖缺陷，不外推其他设置。

窄写集：上述三个 owner 的 workspace 逻辑、import session metadata、既有 Skills roots fixture/定向回归、存储迁移测试和本计划/architecture。初始化迁移选择 canonical workingDir → 根别名 → imported continuation → imported settings；roots 的显式空数组必须覆盖旧 workspaceRoot。复用 metadata durable writer，成功后清除 obsolete workspace 运行副本，保留 `codexMetadata`、source path、历史 Turn；不猜测更正旧历史路径。迁移时不本机 canonicalize 来源路径，现有 resume 服务端路径归一仍归原 actor。

退出条件：旧产物生成/新产物打开的真实导入 fixture；cwd settings、Turn cwd/roots、clear roots、后续 Turn、冷重开；归档/幂等/rollout 重建/损坏输入/SQLite 提交失败重试；同一 canonical 与实际 Provider 上下文。先定向 owner 测试，再 App Server 整库、contracts、stdio/CLI 与 current/GUI 门禁；此前通过的 29 包不无差别重跑。当前仅 red 已完成，实施和新产物验证待做，S09/R08/R21 不核销。

S09-F 实施与当前验收：原 reviewer-only 事务与 repair 抽到 `session_settings/{migration,restore}.rs`，reviewer/workspace 字段归各自小模块，共用同一 durable writer，不增加并行迁移后端。根 workingDir 与显式空 roots 优先；旧导入运行副本迁后删除，runtime 不再从 nested 字段取 workspace，新 importer 仅写 canonical workspace，历史 Turn/来源 rollout 保留。当前 App Server **1924/0/0**（含 7 项 workspace 迁移/repair 回归）、contracts/scripts 已通过。同一新 fixed binary prepared SHA `e3cb3fb273c02a6202f14438116d6e8ad3b126cf1bdfdd0996464cb4cde4427f` 已通过旧产物→新产物 cwd/Turn scope、新 import 和 current Thread 四场景，共 **25 completed Turn / 25 次当前 Provider 捕获 / 6 次 daemon 冷重开**，stdio/CLI Gate B 已过，Electron current/GUI 待收。索引 `.lime/qc/shared-backend/s09f/verification.json`。夹具两次接线失败（重开遗漏 process-scoped extra roots、空 legacy binary 环境变量）已修，原日志与 Host 等待依赖超时均保留，不计产品 red。

## S09-E 插件 Skills 来源收敛（实施合同补充）

真实 red 已取得：同一 S09-F 固定产物本地 `plugin/install` 后，第二个实际 Turn 的 Provider 当前上下文包含该包 Skill，但两个连接的 `skills/list` 都未包含它（第一连接断言即失败）。独立通知 fixture 排空 setup 通知后安装插件，两个连接均未得到 `skills/changed`；对应 `.lime/qc/shared-backend/s09e/plugin-{catalog,notification}-red.log`。源码补核 Codex `ext/skills/src/loader/namespace.rs`：插件 Skill 名为 `plugin:skill`，`host_merge` 按 path 去重，再按 scope/name/native path 排序；不得把简单追加 roots 当成同名身份完整对齐。

责任 root；先完成 unique Skill 来源切片：窄写集为 `local_data_source/plugin_catalog{.rs,/**}` 的职责拆分、`runtime/{skills,plugins,app_data/plugins}.rs`、`runtime_backend/agent_skills_context.rs`、processor 的 plugin/Skills/initialize 及 watcher 注册与对应测试。1542 行 catalog 拆为包安装、库存记录、manifest、资源路径、Apps、runtime components 和 catalog metadata；公开入口直接重导出真实 owner，不保留旧函数包装。catalog、Turn snapshot 与监听从同一 enabled PluginTurnSnapshot 的 skill root 派生；初始化监听已安装插件，install/enable/uninstall 成功刷新同一 RAII 注册并广播 typed Skills 变化，失败不广播。无 wire/schema/installed record 格式变更，不造数据迁移。先实际进程 catalog/通知/文件 edit/disable/enable/uninstall/冷重开与下一 Turn，再 owner/Rust/contracts/Host gates。

同名与 namespace 归紧接 S09-G：补 project/user/app/extra/plugin/orchestrator 冲突 fixture，明确插件 namespace、stable id 与旧禁用配置迁移，关闭 catalog 去重和模型选择分叉后才能核销 R21。S09-E 不以 unique Skill fixture 外推身份对齐。E 实现与验证状态以下段为准；G 尚未实施。

S09-E 实施中：原 1542 行 `plugin_catalog.rs` 拆为根聚合 84 行及 8 个职责模块（各不超过 319 行），公开方法直接 re-export 实际 owner，不保留旧函数 wrapper。`PluginTurnSnapshot::skill_root` 为 catalog、Turn snapshot 和 process watcher 共用；initialize 恢复已安装插件的监听，成功 install/enable/uninstall 刷新同一 RAII registration 并复用 typed catalog mutation 广播，错误路径提前返回。通用 watcher 方法直接迁为 `register_roots`，现有 Thread callers/tests 同步迁移。新增公开协议回归覆盖失败不通知、安装/禁用/启用/卸载与 catalog；真实进程 `--plugins` scenario 共用既有 SDK/Provider harness，验证安装、包内编辑、禁用/启用、冷重开初始化监听、再编辑与卸载。当前代码已实施，最新测试/产物尚未收取；早期拆分编译的 unused imports 已清理，不把旧源码编译结果核销当前实现。无持久化格式改变、无新增 compat/deprecated。architecture 已同步，minor，root 2026-10-17 确认。

## S09-G Skills namespace / 同名身份（下一实施合同）

责任 root；P1；依赖 E 的固定产物验收。Codex current `app-server/src/extensions.rs` 注册 `codex_skills_extension`，其 `ext/skills/src/{selection,extension}.rs` 才是本轮 Turn 选择参照；旧 `skills/src/selection.rs` 的同名歧义策略不能直接冒充 current 主链。插件 root 提供 namespace；catalog 按文件路径保留不同 Skill，再按 scope/name/native path 排序。current extension 以 authority/package 归一选择，显式路径优先并屏蔽同输入中的同名文本回选；文本名称选择排序后的首个 enabled entry。

已确认 Lime 风险：catalog 用 `scope:name` 删除不同路径的条目；selection dedup 和正文 metadata 查找复用该键，可能把实际正文的 capabilities/authority 换成同名另一来源。`agent_selection.rs` 1032 行，触碰前先将 inline 测试迁入独立 owner 测试模块；`agent_snapshot.rs` 726 行，namespace/身份和配置职责分模块，不继续堆叠。

窄写集：Skills 的 snapshot/selection/config 及直接消费者、`PluginTurnSnapshot::skill_root`、runtime catalog 和对应 fixture/文档。先使用同一 E 固定产物运行双插件同叶名称的实际 Provider/catalog red；再在唯一 snapshot owner 实施 namespace、canonical locator 去重与稳定排序，catalog 直接投影同一列表，选择/正文权限必须取同一 locator。保留用于显示或持久引用的旧稳定标签时，不再把它当作跨路径唯一身份。

用户最新裁决（2026-10-17）：插件按 Codex current 整体重构，开发期间不迁移、不考虑兼容。插件 namespace 与配置直接采用新合同，删除旧写入/消费者和旧名 alias；不得继续实施旧禁用配置迁移。完整替换和 LimeCore 联动转入 [插件重构执行计划](./codex-plugin-reconstruction.md)。

退出条件：project/user/app/extra/plugin/orchestrator 的同名、重叠 root、canonical symlink 与排序；显式路径选择、qualified 文本选择、禁用/能力 metadata 对应同一正文；两个实际连接 catalog/通知与当前 Provider 一致；新配置持久化和冷重开；定向 owner、受影响 Rust、contracts、stdio/CLI/current/GUI。未跑 Windows、live Provider 和三端同实例不计通过。当前只有源码核查及隔离探针准备完成，尚无 G 产品 green。
