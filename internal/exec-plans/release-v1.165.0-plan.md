# v1.165.0 发布执行计划

状态：candidate-to-quality；负责人：root；日期：2026-10-21。

## 目标与候选范围

- 发布应用、CLI 与 Rust workspace `1.165.0`，目标标签 `v1.165.0`。
- 起点 `e6176ddcb`（main/origin/main），上一发布标签 `v1.164.0`。
- 用户要求发布，按 release workflow 纳入当前工作树全部产品、协议、脚本、测试、文档和已登记证据。
- 构建缓存 `tsconfig.node.tsbuildinfo` 不进入发布提交，保留工作树；忽略目录中的个人环境和临时产物继续遵循现有规则。
- 用户明确要求“冻结当前全部候选，后续新增留到下一版”。已于 2026-10-21 04:18:37 UTC 冻结 index tree `e5f736891fd729d6c9e5c85071d40c7933812aab`，452 个文件，71620 insertions / 11923 deletions。此后不再自动纳入产品、测试或其他 owner 文档变化；仅补本版发布记录及必要门禁修正。
- 冻结副本 `/tmp/lime-v11650-frozen-e5f736891fd7` 从该 tree 导出，源码均为独立实体；workspace package 链接指向副本，外部 npm 依赖只读复用，本地 Cargo target 通过 APFS clone 独立复制。构建和夹具继续执行原 freshness 守卫，不绕过源码一致性检查。
- 后续原工作树变化保留为 unstaged / untracked，延期下一版；不覆盖其他进程源码。完整冻结清单与内容摘要在 `artifacts/release-v1.165.0/candidate-manifest.json`。

## 本轮写集

- release metadata：`package.json`、`packages/cli/package.json`、`lime-rs/Cargo.toml`、`lime-rs/Cargo.lock`、`RELEASE_NOTES.md`、`RELEASE_NOTES.en.md`。
- 发布记录：本计划、`artifacts/release-v1.165.0/` 下的候选清单、验证摘要与不可变压缩原始日志；`.gitignore` 精确登记上述路径。
- candidate changes：现有工作树的 GUI、异步问答、Memory harness、Hook/插件、portable rollout、线程恢复、多协议历史与相关测试/证据；完整列表在候选清单保存。
- 源码问题仅在门禁提供有效失败后认领窄写集；不主动重构其他 owner。

## 分类与架构

- current：Electron/Forge、App Server JSON-RPC、RuntimeCore、Thread/Turn/Item 与现有领域 owner。
- 本轮发布 metadata 不增加 compat/deprecated 路径；候选已删除的旧 Memory proposal、重复用量转换与旧 rollout reader 保持 deleted，不恢复。
- 重大候选架构以既有 architecture 与 Memory/rollout/fork 责任计划中的确认记录为准；版本发布不核销完整 Codex 或 Memory 路线图。

## 验证与退出条件

1. 版本一致性、完整 `npm run typecheck`、`npm run test:contracts` 通过。
2. 按风险验证当前 Rust/前端 owner、current fixture 与标准 `npm run verify:gui-smoke`，保留失败、未执行与证据等级。
3. 中文/英文发布说明仅保留目标版本；无目标事实源旧版本残留；源码/文档 whitespace 与文档边界检查通过。
4. 生成可审查候选清单、内容摘要、排除清单与门禁结果。用户随后明确授权“全部发布，不要找我确认，我去午休了”，本次 commit/tag/push 和发布跟踪已获得授权，不再重复询问。
5. typecheck 等静态门禁通过后先提交冻结候选并推送 main，启动远端 Quality；本地 Rust/桌面验证继续。待 Quality 与本地验证收口后再创建并推送新标签，复核远端引用；不覆盖既有标签。
6. 跟踪 Quality/Release 终态，检查 GitHub Desktop/CLI/npm 产物、npm registry 与 R2/feed；只报告实际成功渠道。

## 当前验证

- 初始本地及远端 `v1.165.0` 标签不存在；远端 main 与起点一致。
- pnpm lockfile 与 Forge/release manifest 无独立显式应用版本，不强行修改。
- `npm run verify:app-version`、完整 `npm run typecheck`、完整 `npm run test:contracts` 均 exit 0。
- 33 个改动前端测试文件共 590 项：首轮 588 passed / 2 timeout；两个原样隔离文件分别 8/8、9/9 通过，原 5000ms 预算和全部断言保持。保留首次失败，不将首轮改写为绿。
- 7 个改动脚本 Vitest 文件 137 项断言通过；误把 Node test 文件传给 Vitest 导致一个 suite 收集失败，随后 package 原生 runner 288/288 通过，无源码修改。
- AI commit-hook 显式候选预检 349/349 通过；源码及文档 `git diff --check` 通过。
- Memory 四 crate 定向回归最终 93/93，中断 callback 回归 1/1 通过；canonical rollout 后继仍在执行。旧 Memory 冻结清单有来源漂移，不能代替当前候选验证；rollout 40 来源摘要一致，其公共回归 54/54、provider 181/181 为已有 owner 证据，仅在原覆盖范围内引用。
- 其他进程新增 CLI 中断夹具诊断与 owner 记录，纳入最后候选清单；该夹具由原 owner 验证，不覆盖其实现。
- 原始日志位于 `/tmp/lime-v11650-*.log`，结构化结果保存在 `artifacts/release-v1.165.0/verification-summary.json`。
- 尚未 commit/tag/push，尚未对外发布。

## 门禁修正

- 四 crate Memory 回归首轮 exit 101：新增 `session_loop/tests.rs::explicit_interrupt_runs_interrupt_callback_but_replacement_does_not` 对 `submit` 的 Result 再次 `.await`，两处 E0277。核对当前 async handle 后只移除重复 `.await`，不修改生产实现或断言；该文件自候选盘点以来无外部漂移。四 crate 原命令重新执行，结束后补该中断回归的定向运行。
- 标准 GUI smoke 已完成 renderer 与 Electron Host 构建，正在重建版本更新后的 App Server 侧车。current fixture 371 项前置定向/guard 已执行，后续 Electron 子场景仍待侧车，不提前记为聚合通过。
- 后继标准 GUI smoke 真实 `1.165.0` 侧车 24/24、exit 0；收据 `gui-smoke-summary.json`。首轮 Agent 聚合 unknown-item 业务通过但正常退出超时；原样隔离复验完整通过、Main code 0、forced cleanup null。第二轮聚合通过图片/审批等场景，在 rich draft Stop 缺少 backend cancel ledger 失败；原样 rich draft 专项完整通过。原失败与隔离通过均单独保存，第三轮完整聚合继续执行。
- Rust 后继定向暴露测试合同漂移：Review replacement task 未标记 `RuntimeSessionTaskKind::Review`，已补 typed kind，原 Interrupted/Replaced/callback 断言保持。Memory 用量测试中的 unquoted tilde 被既有 word-only parser 拒绝；正向样本按 Codex `memories/read/src/usage_tests.rs` 改为 literal root 的 cat/sed 读取，仍断言两种 artifact。未知工具和 tilde expansion 保持 fail closed。Search 元数据经过 `short_display_path` 已丢失 root，不猜测归因；显式负向断言及此未覆盖边界保留，不声称搜索遥测已实现。
- 修正只涉及上述两份已有候选测试；Memory 用量生产逻辑未改变。最终四 crate Memory、中断 callback、canonical rollout 的顺序回归在 `/tmp/lime-v11650-rust-final-r4.log`。
- 第三轮 Agent 聚合在 renderer 编译时检测到其他进程修改输入，报 `Renderer build inputs changed during compilation`、exit 1，未进入本轮桌面业务验证。保留原始失败，已转移至上述冻结副本重跑聚合、完整 typecheck/contracts、构建输入测试、Desktop config 和 rollout/fork 定向回归。
- 冻结副本 Desktop 配置 3/3、提交钩子候选预检 421/421、Agent 聚合前置定向检查 371 项通过。已停止本轮在原树中启动且被副本替代的 canonical rollout 编译，保留 Memory 93/93 与中断回调 1/1 原始成功，不将取消记为 rollout 通过。只对已核实本任务后代 Cargo/rustc 发送 SIGTERM，未终止其他进程；见 `superseded-rust-cancellation.json`。
- 冻结副本完整 `npm run typecheck` exit 0（1363.29s）。系统约 21 GB swap，已将本轮 Rust 编译短暂停调度 180.84s 后恢复，未暂停测试执行、修改预算或触碰其他任务；见 `compilation-scheduling.json`。
- 本轮错误并行启动 GUI smoke 和 Agent 聚合，它们争用同一 renderer 构建锁。GUI renderer 编译超过既有 20 分钟等待后，聚合 exit 1，371 项前置通过但没有启动业务场景。保留失败；待 GUI 构建完成后串行重跑聚合，不放宽锁预算或设置 build-ready override。
- 冻结候选定向 ESLint 119 文件、0 warning/error、exit 0。contracts 的 protocol/client/command/harness/modality 检查通过，脚本治理因导出副本无 `.git` 中断；用独立 frozen index + 原仓库只读对象上下文补齐后重跑，未更改源码、原树 index 或任何断言。
- 当前提交是进入远端 Quality 的候选检查点，不代表 tag、安装包、npm 或 updater 已发布；这些渠道以收尾 publication receipt 为准。
- 候选提交 `76dad3c4ad61aac12bc3a40f5981c2c96f5f1076` 已推送 main；实际 commit hook 454/454。Quality run `39546387685` 的 Rust Full 在 App Server 1998 项中 1995 passed / 3 failed：旧队列夹具使用未落盘的 sidecar 地址，另两个重建测试仍把 live sidecar URI 与 portable 内联图片要求为同一字符串。
- 门禁修正仅认领原树无外部变化的 `canonical_thread_store_tests/queue.rs` 与 `projection_rebuild/queue_tests.rs`：存储夹具改为有效自包含 PNG；portable 重建对比完整预期 Thread / UserMessage（精确文本、PNG bytes/detail、clientId），保留 live sidecar 输入、Item identity、队列顺序、冷恢复、search 与 media/read 断言。不改生产逻辑、不引入后续功能；rustfmt 解析通过，定向 Rust 与远端完整复验继续。
- 上述测试修正以 `c323596f2534d5135f6c8635fd2ef013209d6448` 推送；Quality `39547702548` 复验。首轮远端 GUI Smoke 成功（run-id `standalone-shell-01-20261021050306-15782`）。本地冻结 canonical rollout 21/21 通过，后继 config/fork 继续；该编译在测试夹具修正前开始，不冒充修正后队列回归。
- 首轮 Frontend Full 在 38/141 批发现 Settings Gate A 清单缺失冻结候选已有的 `browser-use`、`keyboard-shortcuts`。只补 `scripts/lib/project-gate-settings-a-core.mjs` 两项，保留覆盖全部 current section 的严格相等断言与完整 viewport/state 矩阵；原测试 7/7 通过。
- 冻结副本标准 GUI smoke exit 0，真实 Electron 24/24；摘要 `frozen-gui-smoke-summary.json`。Agent 聚合现已串行复跑，复用正常 freshness 校验后的真实产物。Settings Gate A 修正 7/7，原 Frontend Full 失败及 GUI 原日志均归档，不纳入任何冻结后产品新增。
- 冻结 App Server lib 完整执行 1998 项：1997 passed / 1 failed。剩余失败是冷运行态队列应精确比对原 durable 输入，而非 raw rollout 的 portable 表示；只修正这一处断言，重建队列两项复验 2/2。存储队列两项也已 2/2。原 `--tests` 选择包含 lib，故不能把它声称为 config/fork integration 通过；已改用精确 `--test` 加 current Rust/V8 环境 helper 顺序执行。一次直接 Cargo 漏带 V8 环境的失败保留。

## 冻结候选后继阻断修复写集

- 五语言已有 browser/keyboard 文案补齐（19 个已有 UI key/语言），只修改冻结副本资源；定向 search/Gate A 23/23。
- 两项压缩历史公共 JSON-RPC 回归 37/39 后阻断；隔离原二进制重现 0/2。只认领 `canonical_rollout.rs` 的 ensure/metadata timestamp guard、`canonical_thread_store.rs` 的 metadata 调用及既有 `canonical_thread_store/rollout.rs` 持久化 helper，和两份既有 compression 回归。目标为读取不解压、metadata 在 SQLite 提交前写入唯一 rollout owner、损坏输入不提交 metadata；不纳入原树其他压缩功能或生命周期变更。
- 原树存在其他 owner 改动，优先只写冻结副本；对原树只允许可证明无重叠的窄块同步，禁止整文件覆盖脏区。`canonical_thread_store.rs` 接近 1000 行，本轮只增加既有 owner 的委托，helper 落在现有 rollout 模块；退出条件为原两项公共回归、canonical 定向和全量 Quality 通过，不继续堆叠业务。

- 调用栈诊断确认初始化提前解压来自 `migrate_session_settings -> persist_thread_metadata -> append_metadata`，并非历史重放。`thread/start` 写入未设置的 `runtimeWorkspaceRoots:null`，启动迁移移除该字段，触发实际写入。认领冻结副本 `processor/thread/lifecycle.rs` 的单一 metadata 构造点：仅在 roots 显式存在时落盘，保留显式空数组。公共压缩回归的 seed 增加落盘断言；旧数据迁移与校验保持。临时 backtrace 已移除，不纳入候选，不修改 history append 路径。
- 后继冻结 Agent 聚合 exit 0：371 项前置与 22 个真实 Electron 子场景通过；原始场景摘要已归档，`liveProviderUsed=false`，不冒充 live provider。五语言资源补齐 23/23 通过。本轮 storage/thread-start 修复的精确压缩、canonical 与完整 fork 集成复验继续，随后标准 GUI smoke。

- thread/start 修复后两项公共压缩回归中，初始化/读取不解压已通过；继续执行到恢复后的 turn，暴露共享 `HistoryCaptureBackend` 为不同回合重复使用固定 Item ID。只认领冻结副本 `tests/thread_fork_jsonrpc/backend.rs`：tool/message Item ID 加入真实 turn identity，不修改 provider 文本、call/result 语义或恢复断言。
- 第四轮 Quality 完整 Rust 到达 Hooks 公共回归：`HookMetadata` current `Command { async: false }` 已替换旧 executionMode 字段，旧测试仍断言 sync。只认领冻结副本 `tests/hooks_jsonrpc.rs`，断言 async=false 且 executionMode 不存在；保留其余 metadata、trust 与 plugin 回归，不恢复旧字段。旧 run 的 Rust/Frontend 失败日志均保留。
