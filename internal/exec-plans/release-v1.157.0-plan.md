# v1.157.0 发布执行计划

状态：active。发布完成度：80%。目标：准备并发布 v1.157.0，复核 main/tag、GitHub Release、多平台资产、updater 与 CLI npm 结果。

## 授权、范围与写集

- 用户要求「发布 v1.157.0」，随后明确「全部发布」「完成发布,不要让我确认」。已授权本轮完整候选、必要修复、release commit、tag、main/tag push 与发布复核，不再请求确认。
- 起始 main/origin/main 为 `9304ff81c8904615a9452a5eafc313f3122f5914`；本地和远端目标 tag 均不存在。
- 初始工作树 529 项：345 modified、17 deleted、167 untracked（目录展开前）。已有产品、文档、测试、脚本和研究证据默认属于发布候选。
- 继续排除上一版已判定的 `local-conversation-page-a83a1af2c24b.js`（外部分析产物，无产品消费者）与 `tsconfig.node.tsbuildinfo`（增量缓存），保留本地，不删除。
- 本轮窄写集：`package.json`、`packages/cli/package.json`、`lime-rs/Cargo.toml`、`lime-rs/Cargo.lock`、两份 release notes、本文。其它脏文件先只读检查及验证，必要修复先记录精确补丁。
- pnpm lock 无 root release version；Forge 和 App Server release manifest 从版本事实源生成，不写第二份显式版本。
- 受测路径清单、逐文件摘要和门禁日志进入忽略目录 `.lime/release/v1.157.0/`；不把隔离 marks/dictation 实验自动混入候选。

## 发布内容与边界

- 结构化 Composer、技能/能力引用、提交和输入恢复；统一项目/分支/运行位置工具栏。
- Queue preview/mutation 与公共 pending history、搜索、分页和冷恢复；审批呈现复用现有响应 authority。
- Turn viewport virtualization、长用户消息折叠/复制/滚动位置与页头紧凑布局。
- Files/diff 共用投影、右侧面生命周期、Browser tab 恢复、Thread settings scoped 通知。
- current：Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item，沿既有业务 owner 演进。
- compat/deprecated：不新增；deleted：旧 Inputbar approval/context/plugin 组件、ThreadQueueStatus、固定消息窗口、WorkspaceFilesSurface、旧媒体权限模块及其被替代测试；test-only：受控 provider、Electron 和脚本 fixture。
- 架构与责任确认已在现有 `architecture.md` 及 `codex-gui-alignment-current-plan.md` 更新；本轮 metadata 不改变业务 owner。GUI 全面对齐仍 partial，不以发布完成替代功能路线图完成。
- KISS/DRY：版本沿唯一事实源；YAGNI/SOLID：不新增发布入口、兼容层或业务后端。

## 退出条件与验证

1. 版本统一 1.157.0，双语单页 notes；`verify:app-version` 与完整 `typecheck` 通过。
2. contracts、相关 frontend/Rust owner、公有 Queue integration 与脚本回归按风险通过；默认全量门禁已有当日证据时记录 lineage，不无差别重跑。
3. 先 current Agent fixture，再 GUI smoke；真实 Electron 证据绑定本轮源码/产物，live provider、Windows 和未运行交互明确区分。
4. 候选无未解释漂移，正常提交门禁通过；沿用户授权连续完成 release commit、tag、main/tag push 和远端身份检查。
5. GitHub Quality/Release、签名/公证、三平台 installer/updater、四平台 CLI 与 npm registry 实读复核；仅触发 workflow 不算发布完成。

## 进度与证据

- 初始盘点完成；版本事实源和双语 release notes 已更新。
- 已有当日默认门禁记录：127/127 前端批次、7 Rust crate 3179/3179、contracts 与 GUI smoke 通过，见 GUI current plan；本轮将重新收取版本/typecheck/contracts 和风险匹配 current fixture，不把旧版本 sidecar 当新版本产物。
- 尚未 commit/tag/push；按用户完整授权继续验证与发布，不再请求确认。

## 并行写集变化与验证边界

- 首轮版本检查、完整 renderer/node typecheck、contracts、发布护栏 Vitest 4 文件 63 项、CLI npm 9 项和本轮 metadata 格式检查均通过。
- 首次发布护栏误用 Node test runner，因 Vitest/TS import 装配失败；原日志保留 `release-guards.log`，随后使用正确 Vitest 入口 63/63 通过，未改断言。
- 在 fixed source 复制期间检测到并行 Link/code 实施：Controller、types、Editor/test、keymap、schema、serialization 共 7 个原候选路径发生变化，新增 4 个 composerMarks tests/helpers。初始 manifest 仅记录摘要，复制结果不匹配，不能称已固定或已验候选。
- 首轮 Agent current fixture 的静态批次已通过，随后进入 Renderer/Host/sidecar 构建；因源码并行变化只停止本轮自有进程树，日志保留 `agent-current-fixture.log`，该尝试不计 Gate B 或聚合通过。
- 已异步询问用户是否等待并纳入新切片或排除该批开发内容；在回答前不覆盖并行源码、不提交变动候选。首轮 typecheck 只适用于变化前源码，最终候选必须重新验证。
- 用户随后明确「全部发布」：新增 Link/code 及本轮后续落入实际产品写集的改动全部纳入发布候选；此前外部分析产物与增量缓存仍属于本地非产品项。新候选按源码稳定后的清单重建，继续完整验证和发布收口。
- 用户进一步明确「完成发布,不要让我确认」；发布操作已整体授权，继续完成，不再提出 commit/tag/push 确认。

## 扩展候选与定向验证

- 使用独立 `GIT_INDEX_FILE` 固定候选 tree `03d379abd4adef2f96f87b1bb6c77c3f465439a2`，553 个改动路径、9228 个源码路径，通过 `git archive` 导出独立临时源码目录。保留真实工作树和原索引，不覆盖并行改动；最终候选还需纳入冻结后的 16 个产品/fixture/文档变化。
- 该候选输入框和听写 owner 10 文件155项通过；此前81项与74项为重叠过程证据，不累计。五语言检查8709 source keys、34836 translations、issues为空。
- 直接 Cargo 首次未接仓库 V8 artifact owner，下载返回404；改用 current resolver。integration layer 自动追加 `--tests` 会扩大 target，所以只停止本轮宽 target 进程，最终通过同一 V8 resolver 精确运行 public Queue/Search 两个 integration target。所有失败/中断日志保留，不计通过。
- 冻结候选正在执行完整 typecheck、Renderer 构建和精确 Rust integration；新增 Controller annotation helper、听写入口和对应fixture将补定向与真实 Electron 回归。
- 首个冻结候选完整 typecheck、Renderer、Host 和资源构建已 exit0；精确 public JSON-RPC Queue 7/Search 2，共9项通过。App Server/code-mode-host 与两 Windows helper stub 的 v1.157.0 dev 构建 exit0，Rust源码逐文件摘要与冻结候选一致；打包到独立桌面 fixture 的 manifest version=1.157.0。
- 冻结之后共29路径继续变化，涉及 annotation helper、听写UI/生命周期与五语言、marks真实fixture及研究/执行记录；全部纳入下一候选并补受影响回归。初次155项和首个Renderer不替代这些新增变更的验证。

## 最终产品与真实桌面收口

- 扩展候选15文件376项通过；最后听写 fail-closed 清理的4文件102项通过（与376项重叠）。最终 Renderer 和完整 renderer/node typecheck exit0。App Server/Host/native资源版本与来源摘要固定，未恢复任何生产mock fallback。
- rich Gate首轮装配未显式指定独立源码的已构建App Server，触发额外构建；仅停止本轮自有进程后使用固定打包sidecar。第一次真实Gate在macOS `ControlOrMeta+End`导航末段超时；改为真实locator click，选区和code Enter断言保留。
- 后续Gate提交、取消、canonical四类input、媒体和原生剪贴板均正确，失败只来自旧collapse fixture把Markdown源码当渲染全文。新增独立、有序的正文材料预期，精确原文copy与canonical保持不变；6项DOM回归拒绝丢失、乱序、空预期，原plain-text合同保留。相关3文件165项、四文件ESLint/格式通过。
- 新rich真实Electron Gate B exit0、73/73 assertions，console/page errors=0；同一Thread/Turn/client/item、链接/代码/图片/路径/技能、IME、history/cancel恢复和实际clipboard通过。backend=external，liveProviderUsed=false，不声称live provider或系统麦克风/真实ASR通过。
- 独立索引pre-commit同入口531文件通过、0失败；最终普通git commit仍执行正常hook。完整Agent current聚合与官方 `verify:gui-smoke` 正在执行，随后沿授权commit/tag/push并审计远端发布。
- 本轮追加窄修复写集为4个已有fixture文件（composer-marks、user-message-collapse及test、inputbar-rich-restore）；不新增产品owner、协议或并行后端。

## 最终本地门禁收口

- 完整 Agent current fixture 聚合 exit0，全部 Electron 子场景通过，liveProviderUsed=false；日志 `agent-current-fixture-final.log`。
- CI 预算预检查发现组件迁移候选40，超过固定预算38；把collapse纯证据99项移入独立unit文件，保留DOM/clipboard组件12项，rich跨模块受控fixture9项明确归integration，并同步聚合消费者。预算仍为38，复验38/38通过；四文件140项、ESLint与脚本目录治理均exit0。只调整test-only归属，不删断言、不提高预算。
- 官方GUI smoke的Renderer/Host/资源构建通过，App Server装配与并行构建竞争共享产物：重复rpath注入及sidecar可用性检查失败，尚未进入GUI交互，不计通过。保留 `gui-smoke.log`，待共享构建退出后用同一官方入口重试。

- 共享构建退出后同一官方 `npm run verify:gui-smoke` 重试exit0；唯一runId `release-v1.157.0-final-20261014T090800Z`，真实Electron/preload/IPC/App Server 1.157.0、Workbench/reload、Settings与3尺寸响应式通过。shell证据不扩大为provider/packaged/像素对齐声明；35项sidecar/rpath并发护栏通过。
- 发布前版本复核、完整typecheck、contracts、受影响owner、current聚合、GUI smoke、测试分层与脚本治理均通过。准备正常提交完整556路径候选，继续远端发布及审计。

- 正常pre-commit验证532文件、0失败；暂存diff检查发现两个新TS文件EOF多余空行，调度未因该检查失败阻止commit。提交仍未tag/推送；已精确删除两个EOF空行、补格式复核并正常hook更新未发布提交，不改产品行为。

## 远端发布进行中

- 最终提交 `73ccc7f484ae6dd4b823305cdfa74df2a7291240`、tree `05687b6f8628e3d4766957ec1e17719000d5d9e8`；正常hook通过，完整提交diff check通过。格式补丁已按TypeScript AST确认无语义变化，Prettier通过。
- main/tag连续推送成功；`git ls-remote`实读main与 `v1.157.0`均为最终commit。工作树仅保留原排除的tsbuildinfo和外部分析文件。
- [Quality 38540947776](https://github.com/limecloud/lime/actions/runs/38540947776)、[Release 38540964858](https://github.com/limecloud/lime/actions/runs/38540964858)已启动，headSha均匹配；待远端全量、签名/公证、installed/packaged Gate B、14资产、R2 updater与npm发布复核，不以触发CI视为完成。

- tag推送后并行会话继续新增test-only路径 `AgentChatWorkspace.inputRestoreGuard.test.ts` 和 `claw-chat-current-fixture-composer-marks-renderer.test.mjs`，以及GUI执行记录；属于tag固定后的后续工作，保留工作树。远端release只验并发布 `73ccc7f48`，最终证据提交只认领本文，不移动tag或夹入后续未验产品/测试。
- 远端Integrity与Bridge/Contracts已success；Frontend lint/typecheck/38项预算通过，Rust全量已进入cache收尾。GitHub draft实读source为最终commit、assets为空、publishedAt=null。by-tag REST在draft阶段返回404，改用 `gh release view`确认草稿，不把该读API差异判成发布失败。

## CI全量护栏修正与草稿重新发布

- 首轮Frontend Full在批次70/126仅一项失败：旧inputRestore guard把听写session取消回滚 `.restoreDraft`误判为中断恢复请求第二owner。当前产品的听写事务与InterruptedInputRestoreRequest不同，实际共享中断helper无重复；用户可见rich/听写回归已通过。
- 用户授权必要修复与完整发布；取消Release 38540964858，取消时草稿 `assets=[]`、`publishedAt=null`、target为73ccc7f48。没有正式发布或更新feed，不沿用旧源码产物。
- 并行已有针对该失败的测试修正：护栏只检查携带 `inputRestoreRequest` / `InterruptedInputRestoreRequest` 的直接writer，补听写独立事务与真实越界负向回归；纳入并复验。另新增marks fixture对实际MarkdownRenderer回归，纳入验证与候选，前述tag后留工作树说明被本次明确修复范围覆盖。只变test-only和文档，产品源码/协议/Rust不变。
- 第一份草稿by-tag REST读404、gh run view等待整个run结束才可读logs；改用release GraphQL view和completed job logs REST，未伪造质量通过。所有失败和取消日志保留。

- 精确fix回归39项与dictation draft纯逻辑10项通过；完整typecheck、ESLint、Prettier、38项预算通过。独立固定源码按 `--from-batch 70` 续跑到82/127无失败（运行中），后续全量Quality再次验证新source。准备正常提交测试修正和最新并行文档、推送main；旧tag仅在旧Release已取消、草稿未发布条件下按expected-old lease更新，重新生成所有产物。
