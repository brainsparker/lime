# v1.162.0 发布执行计划

状态：active；发布提交 `e74400284f534a8d0f7614eff9fbdbce5930e027` 已推送 main，完整 Quality 与本地 Rust/GUI 后验运行中；尚未创建或推送 v1.162.0 tag。

## 目标与候选范围

- 用户要求发布 v1.162.0；基线为 main/origin/main `2a0ad389da30be96e12b157ef09024a94ba34b8f`（v1.161.0）。首次检查本地与远端均无 v1.162.0 标签，上版 Release 与 Quality 均已 success。
- 当前工作树约 290 项改动，默认候选包含产品、测试、脚本、研究与执行文档；已询问是否沿用上版排除 `local-conversation-page-a83a1af2c24b.js` 和 `tsconfig.node.tsbuildinfo`，范围答复待收取。
- 直接写集：`package.json`、`packages/cli/package.json`、`lime-rs/Cargo.toml`、`lime-rs/Cargo.lock`、双语 `RELEASE_NOTES`、本计划和执行计划 README 发布指针。既有业务脏改动只读审阅；必要门禁修复另行登记。
- 不创建分支或 worktree，不覆盖其他进程改动，不终止用户进程；候选固定后记录清单与内容摘要，再以同一候选验证和发布。
- 本轮证据目录：`.lime/release/v1.162.0/`。历史计划结果只作风险判断，不作为本版通过证据。
- 独立候选：`/Users/coso/Documents/dev/ai/aiclientproxy/lime-release-v1.162.0-candidate`，含独立 Git 数据、依赖与 Cargo target 的文件系统副本；未创建分支/worktree。冻结 10,052 条源码记录，首次原工作区摘要复核零漂移。候选内同路径证据目录保存实际测试日志与临时 index 预览，原工作区 index 不变。

## 发布内容与分类

- current：统一窗口页头与工作区标签、canonical 会话摘要和固定偏好；远端插件目录/安装事实与插件/逐技能账号偏好；模型上下文摘要、工具历史预算和 Responses 调用身份修正。
- release metadata：应用、CLI 和 Rust workspace 统一为 1.162.0；Cargo lock 同步本地包版本。pnpm lock 无 root 发布版本，Forge 与 App Server release manifest 继承 package version。
- compat/deprecated：不新增；dead/deleted：候选已删除旧任务中心标签、Activity 面板及首页无消费接线，精确清单以固定候选记录为准。
- 架构确认：既有产品改动的图和责任确认归 `architecture.md` 与各领域计划；metadata 不改变 authority。完整 GUI 对齐、Apps 授权和其他仍 active 的 runtime 缺口继续保留，不因本版发布核销。
- 原则：KISS/DRY 复用现有版本与发布入口；SOLID 保持现役领域 owner；YAGNI 不新增发布器、兼容层或平行 runtime。

## 验证与退出条件

1. 必须执行并记录 `npm run verify:app-version`、完整 `npm run typecheck` 和 `npm run test:contracts`。
2. 按候选风险执行受影响前端/Rust 测试；Agent current fixture 先于标准 `npm run verify:gui-smoke`，按实际触达边界报告。
3. 仅记录本候选实际执行结果；本机 macOS、controlled provider、Gate A/B 与打包/Windows/live 分别说明，不混用证据等级。
4. 发布前复核候选漂移、排除清单与暂存摘要。用户最新明确授权“完成发布,我去睡觉了,不要让我确认”，覆盖本次 commit/tag/push 与公开发布链，不再次请求确认；候选仍须先形成可审阅结果并完成必要门禁。
5. 确认后连续执行提交、标签、main/tag 推送及远端引用复核；跟踪本版 Quality、Release、GitHub/npm/updater 资产，失败先定位，不覆盖已发布标签。

## 执行记录

- 完成初始只读盘点；本地 Node 默认 v23.4.0，另有运行时 Node v24.19.0 可供依赖新 Node API 的验证使用，不修改全局环境。
- `verify:app-version` exit0；应用、CLI、workspace 和 36 个 Cargo lock 本地包统一版本，保留原有依赖增量。Forge/manifest 继承同一 package version，pnpm lock 无需改写。
- 原工作区完整 `npm run typecheck` exit0；冻结候选完整 `npm run typecheck` 亦 exit0，包含 renderer 和 node，不以局部检查替代。
- 原工作区 `npm run test:contracts` 全链 exit0，协议生成零漂移、客户端 300 检查以及命令、harness、模态、脚本、发布、Desktop reference、CLI、清理报告和 docs 边界全部通过。首次冻结摘要证明其产品输入与候选一致。
- CLI npm 包 9 项通过；候选五语言键覆盖 100%，missing=0、extra=0；metadata Prettier 通过。
- 定向首轮 43 文件 601 项中 599 通过、2 失败：Radix 关闭后焦点恢复为异步，新增偏好测试立即断言；新版装饰 CQ 使 jsdom 整张文本样式表失效。第一轮仅恢复 target 隔离后仍复现 CSS 失败，全部日志保留，不计通过。
- 候选额外窄写集为 `PluginSkillsSection.preferences.component.test.tsx`、`EmptyStateComposerPanel.testFixtures.tsx`、`AppSidebar.testFixtures.tsx` 与新 `src/test/createTestStyleSheet.ts`。等待实际焦点条件；夹具各自持有逐条 CSSOM 注入的 sheet，阻止未知 CQ 污染其他规则。该 helper 仅测试使用 styled-components 暴露的 `__PRIVATE__.StyleSheet`，不改变生产 CSS、原期望或期限；四文件 ESLint 零警告。真实 CQ 几何仍须 Electron 证据。
- 相邻持久化/技能预览 7 文件 174 项通过。CSSOM 后验整组 43 文件 601 项全部通过，合计 50 文件 775 项（不重复计前验）；9 个 Rust owner unit 和 Agent current fixture 正在执行，尚未完成不得记通过。
- 追加夹具消费者首轮 10 文件中 9 文件通过、侧栏 2 项失败：本轮新增样式包装使测试直接 `root.render` 时重建侧栏。夹具已在每次 render 保留同一包装，生产代码和刷新次数断言未改；最终全部消费者 13 文件 159 项通过，失败日志保留。去重后前端当前共 60 文件 893 项通过，不重复计 13 文件中的 3 个既有文件。
- Rust 首轮编译在 agent-runtime unit 报 E0583：`context_history/output/tests.rs` 被通用 `output/` 忽略，原工作区存在但不在 Git 候选中。已在候选 `.gitignore` 添加该源码目录及测试的窄例外，并原字节补入现有测试（SHA256 `8f6f7a1013a8330019cca0031884113175b49962361ab79d093eecee647514bd`）；扫描整个 crates 未发现其他被忽略的 Rust 源文件。未削弱 `mod tests` 或断言，9 owner 后验重跑已排队，首轮未记通过。
- 独立 renderer 与 Electron Host 构建完成；6 个受影响公共 JSON-RPC target 和 App Server sidecar 构建等待同一独立 Cargo target 锁，未占用原工作区 target。后验 source freshness 仍须最终核对。
- `rustfmt --check --edition 2021 --config skip_children=true` 对本版 124 个变动 Rust 文件 exit0。额外的 workspace 全量 fmt 检查 exit1，仅 6 个未变动的 App Server 基线文件有格式差异；已逐字比对 HEAD（`rustfmt-baseline.json`），不将该全量检查记通过，也不混入无关格式重写。
- 临时 index 的首轮预览为 310 路径（232 修改、68 新增、10 已删除），16,121 新增/7,956 删除行，cached diff check exit0；后继测试 helper 和本计划更新后需刷新最终预览。
- 首轮冻结后检测到原工作区 4 路径继续变化；后续复核扩至 43 个既有路径增量与 10 个新增路径（不含本轮持续更新的发布计划），涉及持久偏好、右侧面板、文件树和五语言资源等。完整清单为 `.lime/release/v1.162.0/excluded-after-freeze.txt`，内容摘要在 `drift-latest.json`。这些冻结后新增量保留在原工作区，未静默合入候选，也未覆盖其内容；最终发布确认必须明确包含该排除范围。
- Rust 9 owner 后验在 App Server 停止：agent-protocol 46/46、agent-runtime 228/228 通过；App Server 1,968 通过、5 失败。串行复现确认 4 项重启测试仍使用失去执行者的旧 Turn，与候选 normalized hydration / 架构中 cold resume 不得伪造 active actor 的合同冲突。候选窄修复增加旧 Turn canceled 断言，改由新父 Turn 验证按需 child hydration 和 durable result recovery；审批类型不匹配断言移至重启前，冷恢复明确拒绝旧审批且不得写 action.resolved。涉及 `runtime/tests/agent_control/restart.rs`、`runtime/tests/agent_terminal_activity.rs`、`runtime_backend/initialization_tests.rs`，生产逻辑未随本轮修改，后验进行中。
- 第 5 项 `skills_watcher::tests::lifecycle::missing_nested_extra_root_creation_and_atomic_replacement_are_observed` 在 macOS 原生监听整组执行中超时，单独两次通过；相关实现和测试与 HEAD 相同。保留全部失败日志，标为基线不稳定项；后验 9 owner 命令显式 `--skip` 此项，不得将该分组称为无排除全通过。未为发布重写无关监听逻辑或放宽期限。
- 首次 Agent current fixture 在隔离 HOME 的 `cargo metadata` 探测中触发 rustup 下载，尚未取得成功场景；仅停止本轮候选进程树，未触碰原工作区或用户进程。已指定本机既有 Rust toolchain、RUSTUP_HOME 与 CARGO_HOME 重跑，原始与中断收据保留。副本正常 freshness 检测触发 sidecar 增量重建，不跳过构建时效检查。
- Agent current fixture 后验已取得 unknown-item、home-hotpath、home-hotpath-greeting 三场景成功，各自 summary 全部断言为 true、console/page error 均为 0，已实际查看 unknown-item 截图。证据为真实 Electron/preload/IPC/App Server/read model 的 Gate B controlled fixture；external backend 绕过生产 provider loop，不能声称 live 或完整 runtime provider 验收。其余聚合场景仍在运行，整体尚未记通过。
- Coding Workbench 在 Browser 已真实打开后，旧夹具仍限定 tabs 必须位于 pane 内，因统一页头迁移而超时。候选 `scripts/electron/lib/right-surface-lifecycle-gate-b.mjs` 改用共享 tabs，追加选中态与 ARIA controls 对应 pane 校验，保留 native view identity、切换和关闭断言；29 项 oracle 与 ESLint 通过，完整 current fixture 后验已越过该场景并通过图片命令、普通画图意图和停止后继续，后继场景继续执行。
- Rust 重启回归进一步确认新父 Turn 会在提交时消费恢复邮件，因此改为断言该新 Turn 只持久化一个带 child sourceTurnId 的 canonical Result Item，保留内容、终态、重复 wait 不再消费及 durable delivered 断言；冷 child 被归为 canceled 后 `interrupt_agent.previous_status` 对应 completed，不再期望 pending_init。审批冷恢复和 live 类型校验后验已通过，其余修订后验中。
- 公共 RPC 的 plugin_share 7/7、remote_plugins 59/59 通过（后者含真实 stdio peers）；thread_compact 组暴露 `turn/interrupt` 对 Compact actor 错误要求外部 driver completion，Anthropic 单独稳定复现。生产修复仅在候选 `runtime/turn_execution.rs::cancel_turn`：actor interrupt 已等待任务结束后，只有具备独立事件 driver 的聊天 Turn 继续等待 driver 排空；Compact 直接在 actor 内持久化，不伪造 driver。审批取消的原有 live driver 检查保留。已有超 1,000 行文件本轮不扩展业务职责，退出条件为仅替换此等待分支并通过既有压缩取消/失败保留/冷恢复与普通停止回归；后验和 sidecar freshness 必须重建后记录，不将旧二进制结果当作该修复证据。
- Agent current fixture 修正后整组 exit0，共 22 个 Electron 场景通过，包括 typed error retry success/failure 和内容工厂文章产物。已实际查看 Coding Workbench 成功截图；native identity、共享 tabs/tabpanel、切换关闭断言通过，console/page errors 均为 0，production mock fallback 为 0。该聚合 sidecar 构建早于压缩取消修复，不能作为该后端修复证据。
- 压缩取消修复后的构建曾读到恢复测试修正前的 `Thread.items`，报 E0609；现源码已改为 canonical `Thread.turns[].items`。该轮编译自然以 101 结束，未终止任何进程，不计后验通过。修正后的 App Server unit 和剩余 3 个公共 thread target 以单构建任务重跑；压缩组四协议 lifecycle 使用已重建的对应 integration binary 重点复测，保留未受取消分支影响的历史/预算/截断前验，避免重复完整长组。
- 标准字面入口 `npm run verify:gui-smoke` 已启动，正常重建 sidecar，不绕过 freshness。候选 `npm run prepare` exit0，正常初始化 Husky；后续提交不绕过 hook。
- 本轮必要修复共 11 路径，收据与原工作区逐文件补丁为 `.lime/release/v1.162.0/release-fixes.json`、`release-fixes.diff`。其中生命周期夹具原工作区也有冻结后增量，确认后必须按补丁合并，不得整文件覆盖。
- 最新漂移扫描为 61 个既有路径增量与 14 个新增路径（排除本发布计划），共 75 路径；随并行开发继续变化，最终确认前还须刷新。完整清单保持在 `.lime/release/v1.162.0/excluded-after-freeze.txt`，候选范围仍不静默扩大。
- 待完成：最后验回归、公共 JSON-RPC 与真实 GUI 门禁、候选与排除增量复核、commit/tag/push 明确确认及实际发布；公开资产均未发布。

## 2026-10-19 目录异常阻塞

- 标准 GUI build 期间，候选 `node_modules/tsx`、`.pnpm` 和 `lime-rs/crates/app-server` 等原本存在的路径先后消失，随后 Git 检测到数千个 tracked 源码删除；原工作区 `.lime` 亦消失。本轮没有执行删除命令，尚不能确定造成目录变化的进程。按并行协作规则停止候选写入，并已询问用户是否存在外部目录清理；不终止未知进程。
- 将候选尚存的 `.git`、发布补丁、临时 index、候选 diff、日志及 GUI 证据复制到系统临时目录 `/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-v1.162.0-evidence-rescue-ruf8gt__`，复制完成；该备份没有修改候选内容。原工作区版本 metadata 与本计划仍存在。冻结摘要与最新漂移清单原放 `.lime`，现已丢失，恢复时需以救援副本和 Git 对象重新核对，不能沿用旧清单直接发布。
- 最新独立压缩 lifecycle 后验：4/4 失败，均已越过原取消错误，转为 `model.rs:221` 的公开投影断言失败，实际 `contextCompaction` Item 为仅 id/type 的投影。须依据 current 协议重新核对断言，不能宣称修复已全部通过。该日志为救援副本 `evidence/compaction-cancel-corrected.log`。
- 六个剩余 Rust owner 与修正后 App Server 最终命令均 exit101；GUI smoke exit127；预提交预览 exit1。其间文件和依赖被删除，均不记为通过。旧六 target 聚合 exit101；其中已完成的 plugin 7/59 与压缩历史子项证据仍可单独审阅，不把失败聚合称为通过。
- 没有成功执行本轮自有进程中止：对过期编译的防护检查拒绝发出信号，该编译随后自然 exit101。后继命令均已自然结束，未终止用户或未知进程。
- 恢复退出条件：用户确认清理停止；从已保全 Git 对象/补丁重建独立冻结候选并核对写集；修复公开投影回归；完成剩余 Rust、fresh sidecar、标准 GUI 和插件 Electron 验证；重建可审阅清单并取得 commit/tag/push 明确确认。公开发布仍为 0，不能创建 v1.162.0 tag。

## 恢复后的发布收口

- 用户再次明确要求“发布”；继续原版本与冻结产品范围，使用新独立目录 `/Users/coso/Documents/dev/ai/aiclientproxy/lime-release-v1.162.0-recovered` 恢复，不覆盖原工作区或旧候选，不创建分支/worktree。磁盘可用空间已恢复约 97 GiB，目录稳定性复核无新删除。
- 先对保全的基线 index 在临时 index 应用旧候选完整 diff，再用救援 preview 中的 11 项最新修复 blob 替换，逐一核对 `release-fixes.json` 的 SHA256。恢复 10,045 路径，全部内容摘要复核零漂移；10 项既有删除保留在候选映射中。恢复前 preview 混入的额外删除未带入新候选。
- 必要写集追加 `lime-rs/crates/app-server/tests/thread_compact_jsonrpc/model.rs`：公开 canonical Item ID 为 `compaction-{turnId}`，旧断言直接用原始 compactionId 导致四协议一致失败。修正精确 ID 关联并要求每个 Turn 恰好一个匹配 Item；取消终态、失败摘要不替换历史、冷恢复和 provider request capture 断言保留。此前“仅 id/type”的日志是投影形状描述，身份前缀才是本次断言失败原因。
- 当前后验命令覆盖 9 个变动 Rust owner unit 与 6 个公共 JSON-RPC target，显式排除先前已确认的 1 项 macOS watcher 基线不稳定测试。完整 typecheck、版本与 contracts 重新执行；不把目录异常期间的失败命令改写为通过。
- 后继顺序：fresh sidecar 的标准 GUI smoke、插件 Electron/stdio 场景、最终临时 index/hook 和排除清单，再执行已准备好的发布操作确认与发布闭环。
- 恢复候选的 `verify:app-version`、完整 `typecheck`、`test:contracts` 已全链 exit0；Vitest component unit-migration budget 为 38/38，exit0。正常 Husky 初始化 exit0；临时 index AI 预提交检查 303 文件通过、0 失败、平均 97 分，真实 index 仍为空。新增压缩身份断言 rustfmt exit0。
- 当前临时 index 预览 316 路径，16,393 新增/7,983 删除行，其中 release metadata 8 路径、candidate 308 路径；完整清单、摘要与 diff 位于恢复候选 `.lime/release/v1.162.0/`。原工作区后续增量扫描为 94 路径（其中 22 个新增），最终发布前继续核对；不会将这些增量静默合入冻结候选。
- `governance:architecture-confirmation` 的本地无参数调用 exit1，因为该脚本要求 PR event/body，直接 main 发布不适用，不作为通过证据；各领域既有架构责任确认保留，未伪造 PR body。
- 恢复后的标准 `npm run verify:gui-smoke` 已启动，使用正常 renderer/Host/sidecar 构建，不跳过 freshness；Rust 9 owner 与公共 RPC 后验仍在执行。
- 最新发布授权：用户明确目标为“完成发布,我去睡觉了,不要让我确认”。此指令优先于早先 AGENTS/skill 的重复确认流程；继续自动完成本次发布提交、main 推送、Quality、tag 推送、Release/npm/updater 验证，不再要求用户确认。冻结后产品增量继续保留在原工作区，按清单披露；不得覆盖已有远端 tag 或并行源码。
- 为避免串行等待两套完整门禁，静态检查和候选预览完成后先提交/推送冻结候选到 main，让远端完整 Quality 与本地 Rust/GUI 后验并行。仅在该最终 SHA 的 Quality 与必要本地后验均成功后创建/推送 v1.162.0 tag；如后验发现问题，tag 前修复并重新验证相关范围，不覆盖已发布引用。
- 已执行 `git commit -m "Release v1.162.0"` 与 `git push origin main`，均 exit0；真实 Husky 303 文件通过、0 失败、平均 97 分，未绕过 hook。提交为 `e74400284f534a8d0f7614eff9fbdbce5930e027`，提交 tree `ee4a4430e402c13b2fdfd4ad73c1b1ada10d5a2f` 与审阅 preview 完全一致。发布提交 316 路径；两个本地缓存/实验产物保持排除，原工作区源码、HEAD 和 index 尚未改写。
- 远端 Quality：[39151743083](https://github.com/limecloud/lime/actions/runs/39151743083)，head SHA 为上述发布提交，当前 in_progress。GUI renderer/Host 已完成，sidecar 正常等待同一候选 Cargo 锁；Rust owner/公共 RPC 后验仍在编译。GitHub Release、npm 与 updater 尚未发布，不提前计为成功。

- Quality 39151743083 的 Integrity、Bridge & Contracts 已成功；Frontend Full 在第 3/138 批发现 Agent chat 三处旧首页 toolbar host 断言。当前窄修复为 index.testFixtures.tsx、index.test.tsx、index.workbench01.test.tsx：共享夹具挂载真实 AppShell/AppShellHeader，并在 LayoutTransition 边界传递 mainToolbar 到 current UnifiedTabStrip；五处旧布局断言迁至共享页头实际工具区。会话清空、项目、草稿隔离断言全部保留，三文件定向 ESLint exit0，行为后验执行中。

- 首轮 Quality 39151743083 已结束：Integrity、Bridge & Contracts、GUI Smoke、Windows Shell Runtime 成功；Frontend Full 和 Rust Full 失败。Frontend 已按 current 共享页头修复，完整批次续验目前前 12 批通过；Agent chat index 16 项已全过。首次直接两文件后验为 29/31，通过页头后又暴露两处过宽 navbar 缺席断言，现约束为正文内不重复 navbar，保留共享页头。
- Rust Full 在 thread_compact_jsonrpc 的四协议生命周期断言失败，其余该 target 26 项通过。前次只为内部 compactionId 加前缀仍错误：current materializer 的 ContextCompaction fallback ID 使用 turnId，而 operation 另生成 compact_item 身份。已改为精确 compaction-{turnId}，继续断言恰好一项；关联 Turn、取消终态和失败摘要不替换断言未减少。仅测试修正，rustfmt 与 diff-check exit0，真实后验仍待完成。
- 本地恢复副本无 full smart 状态，因远端完整前端门禁失败新建一次 138 批全量状态；后续统一使用 test:resume。不将基线 stderr 警告或仍运行的批次计为通过。为提前发现后部 CI 阻断，在定向静态检查和完整 typecheck 后推送本组测试修正，tag 仍等待最终 SHA 的 Quality 及必要本地后验。

- 本组修正后的完整 npm run typecheck exit0（renderer + node）；五处首页 toolbar 断言和第 15 批 navbar 断言均已迁至 current shell。Agent chat index16、workbench01 15、taskTabs02 8 项全部通过；四个前端文件 ESLint 与 Prettier exit0。前端 smart 当前已通过前 17 批，后验仍继续。追加窄写集 index.taskTabs02.test.tsx，不引入生产 DOM 或兼容入口。
- 提交前已审阅四个前端文件、一个 Rust 测试和本计划；tsconfig.node.tsbuildinfo 与本地 conversation dump 继续排除。本轮修复推送仅用于取得最终 SHA 的完整 Quality，尚未打 tag，公开发布完成度仍待后继产物验收。
