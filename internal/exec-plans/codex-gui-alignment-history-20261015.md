# Codex GUI 对齐历史快照（截至2026-10-15）

状态：archived / historical。本文仅保留截至2026-10-15的过程、合同与旧证据身份，不作为执行清单；唯一当前计划见 [current计划](codex-gui-alignment-current-plan.md)。旧 pending/失败/完成措辞均归原记录时间。

## 本机证据保留状态（2026-10-14 空间清理后）

用户为释放空间删除了整个 `.lime/`，并明确要求继续。下文涉及该目录的旧 manifest、候选副本、renderer/Host freeze、截图与测试状态均为历史记录，原件现已缺失；历史摘要不能用来证明新文件身份。`/tmp/lime-composer-marks-dictation-current-fixture.log` 和默认门禁日志仍保留，但不能替代被删除的完整 artifact 集。用户级 REA 原始提取目录按实际文件复核复用，不重建整个缓存目录。

本轮仅恢复必要候选到 `/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-code-nodeview-recovery-oulq764w`。候选来自各责任 Agent 自己的结构化工具写入记录；重新记录 baseline、摘要并重跑验证。恢复版结果独立于旧候选结果，正式 `src`、fixture 和根依赖在原默认门禁关闭前继续冻结。旧默认门禁已exit0，前端127/127批和标准GUI smoke通过；NodeView正式源码迁入后另起新的默认与真实富输入验证，证据独立。

## 主目标与参考

使用 REA 分析指定 Codex Desktop 安装包，直接对齐可确认的 UI、交互、代码结构、目录职责、函数、类型和类；同时迁移或删除被替代的代码、文档、测试、fixture、snapshot、护栏和白名单。只保留 Lime 主题、多模型支持、首页 Banner 三项差异，不为旧规则、旧测试或未知实现新增保留项。

- GUI 参考：`/Applications/ChatGPT.app`，Bundle ID `com.openai.codex`，版本 `26.1007.30912`，build `20156`。
- ASAR SHA-256：`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- REA 安装：`~/.local/bin/rea` 6.4.0；独立 Node 24.21.0。原始 Evidence 与提取包位于 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/`。
- 共享业务语义：`/Users/coso/Documents/dev/rust/codex` current 源码，已核对 revision `a9b0815167c27ab13719dd12d13b63e02b70d221`；下次实现前复核。
- 2026-10-14 复核公开仓库 HEAD 已为 `31434401fa3cd111866acdc1bba2a73b561f53d5`。安装包 CLI manifest 为 `0.162.0-alpha.17.2`；Desktop Host 与公开 TUI 均有 App Server 路径，精确构建等价仍 unknown，不能将最新 checkout 当作已安装二进制源码。
- [研究报告](../research/codex-desktop-rea/report.md) 与 [证据索引](../research/codex-desktop-rea/evidence-index.json) 供复用，不能当作 Lime 产品已实现证据。

## 当前阶段与写集

当前阶段：Composer/NodeView、持久化Host/索引/Coordinator、typed acceptance、新建会话78项/9旧文件删除、单一SettingsPage章节与visible-ready均已采用。local16完整富稿/三工作区/两正常cold和Home6稳定空会话冷恢复分别通过；15设置首屏导航通过。旧证据按原产物保留。三首发发现展示正文覆盖canonical富文本，Stop前置导航发现业务workspace覆盖可见scope；正文与可见scope修复已通过定向/构建/壳；新首发Home接受与正常退出通过，search-new暴露queued discard后旧通知重绑。Coordinator修复的标准typecheck/新renderer/壳通过；packet21 first8三入口首发、rich Stop、Home7与local17两正常cold四项真实场景均通过，原失败独立保留。原Stop5秒文件单次20/20已过；async-tabs迁current筛选与coverage计数3+11已过；current聚合前三组通过，guard组293/294、collector隔离68/69因原5秒超时失败；测试采集器去除已验证相邻窗口的重复序列化/散列后69/69（溢出用例1.57秒），不改产品、断言或timeout。聚合第3轮定向31/34/3/294全过、桌面前14场过，第15场Skills试用完成但Composer仍禁用；原失败已冻结。root窄认领CommandWiring及其navigation.integration.test，非Composer真实accepted复用既有可见topic commit，保epoch/ready/CAS；合同：Skills试用GUI→既有sendMessage→Electron/preload/IPC→app_server_handle_json_lines→App Server/runtime canonical accepted→当前可见session/topic→同Coordinator；非接受/迟到保稿，普通Composer不双消费，无协议变更。真实集成先红1fail/2pass，修后四suite36/36，最终六suite61/61含原Stop20和visible-ready5；标准typecheck/lint/格式过，renderer/Host/sidecar构建与同一标准末端壳通过（初次wrapper缓存失败保留）；packet22原Skills三路径通过，current第4轮四组定向31/34/3/294及22个真实Electron场景全部通过、7885source/2198artifact前后零漂移；default首次在i18n:unused发现dead settings.layout.placeholder.notFound，未进入前端；本刀窄写集为五语言settings.json及既有loader/type两测试，删除无消费者键并将旧正向合同迁为current loading.skills，不碰媒体实现，42/42定向通过；default第二次在全src零警告lint命中新Wiring依赖警告。原窄lint实际有warning且exit0，不能报零警告通过；窄修提取sendRuntimeMessage/getComposerDraftNavigationEpoch稳定引用并保留原deps语义，原61/61及--max-warnings0通过，Prettier依赖数组仅格式且TS结构AST相同，freeze25留痕。default第3轮全src lint/112源文案扫描/标准typecheck过，原87/88批过，89/132在historyWindow两用例原5秒超时，隔离12pass/2同超时；CPU诊断显示loadNamespaceResource自耗43.67秒，栈经resolveRequiredAgentChatCopy→工具叙述→runtime status；每次文案查找重复合并整agent namespace。窄写集调整为src/i18n/agentChatCopy.ts和既有utils/agentChatCopy.test.ts，优先复用createI18n已持有的五语言静态资源表、保实时locale/插值/fallback，真实资源热路径先3pass/1fail（12重复load）后六suite81/81含未改historyWindow14/14，严格lint过，freeze26仅该两源delta；default第4轮从原89/132续；history源码/用例不改。该新产品叶需定向/lint/typecheck与新build/current证据，不将此归因为全部历史timeout；原状态从89续，再执行contracts/标准GUI及最终产物完整current22（包含Skills），避免用旧22身份覆盖新共用资源修复。架构4.3既有owner接线由root确认，非major。参考普通侧栏fresh和冷多草稿picker仍unknown，整体partial。

规则写集：两个 skill、设计 skill UI metadata、skill 索引、`design-language.md`、`quality-workflow.md`、Verification Contract 的 current method 示例、`.gitignore` 精确白名单与本计划。设计 skill 原先被忽略，加入版本控制准入，避免规则仅保存在本机。

后续产品写集在每个切片实现前登记。避让已有 App Server/agent/tool-runtime、命令 catalog/executor、五语言 `agent.json` 与未知未跟踪改动；不提交、推送、重置或创建分支。

规则更新不改变实际 owner、依赖方向或门禁实现；架构影响为非重大。后续若改变目录/owner/协议或数据流，必须同步 `architecture.md` 并填写责任开发者确认，不能沿用本次非重大判断。

## 对齐账本

| 能力                                                | 参考                                                         | Lime current owner / 待办                                                          | 清理与验证状态                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 设计与质量规则                                      | 用户三项差异、current 架构与 package scripts                 | 两个 skill 与领域事实源                                                            | 完成；validator、引用、脚本与文档守卫通过                                                                                        |
| 长历史与流式时间线                                  | `virtualized-turn-list`、`thread-virtualizer` 包模块         | `threadVirtualizer` / `VirtualizedTurnList`；canonical paging 与 DOM range 分开    | 已直接替换；29 文件 / 318 tests；真实滚动与冷恢复 Gate B 通过                                                                    |
| 待处理审批                                          | pending approval 包组件及 Codex server request/decision 合同 | `PendingRequestItemPanel` → `ApprovalCard`，复用现有 approval authority            | 已替换；146 首轮 tests +追加回归通过，Gate B 待聚合                                                                              |
| Files → diff                                        | review tree、file-diff 与 side panel 包模块                  | `ReviewThreadSidePanelTab` → 同一 changeView / ChangesPanel / RightSurface         | 已替换；真实四文件 diff/选择/定位 Gate B 通过，整体视觉仍待核对                                                                  |
| 导航、页头、Composer、队列                          | 对应 Desktop 模块与 shared Thread/Turn/Item                  | 已有 sidebar/header/composer/queue owner                                           | 已有能力须重新核对行为与命名，不能仅按旧计划判完成                                                                               |
| Queue mutation / Header identity                    | `QueuedMessageList` confirmed export、Thread scoped actions  | 旧 ThreadQueueStatus 已迁净；public pending visibility 与既有 typed queue/store    | 内部Item/媒体/动作回归通过；public history/paging74、搜索17、rollout恢复23；新版真实pending Gate B通过，旧 transcript Gate已失效 |
| ComposerUtilityBar                                  | REA confirmed export、project/run-location/branch 分工       | 共享 utility + keyed mutation actions，删除旧组件/未消费透传                       | 12文件343 tests；真实两项目选择、branch create/checkout、冷重启与Git readback Gate B通过；staged worktree/remote待办             |
| 结构化主 Composer                                   | REA 主模块、initial Controller/keymap/View                   | 唯一 EditorState + EditorView；原始 draft / typed submission；共享 workspace scope | NodeView与既有default/current已关闭；persistent已正式接线，新GUI冷恢复/首发/current/default待验；系统voice仍待办                 |
| 长用户正文折叠                                      | REA collapsible-user-message-content、20行自然高度合同       | 两入口共享正文显示组件；现有Markdown、row测量与滚动owner                           | 已验收；guard39/39、默认127/127批、rich69/69、long-list/冷启动、live-tail65/65及resize66/66通过；证据分版本                      |
| Thread 设置通知消费                                 | shared `thread/settings/updated` canonical settings          | EventBus → scoped adapter → 现有 preference/threadRead cache → model/header        | 120 定向 tests + production consumer 8；idle model/cwd Gate B 通过，已迁 known_projected；不声明 active/future Turn 执行         |
| 右侧面、Browser、terminal、artifact、subagent       | 已提取 side-panel 与 surface 模块                            | 单一 RightSurfaceHost/registry、scoped local state与既有native owner               | scoped生命周期73、完整tab恢复82、actual sender41项测试通过；双tab/primary关闭不复活的真实Gate B通过；其他surface继续核对         |
| 设置、Skills、MCP、插件、自动化                     | 对应包模块与公开协议 owner                                   | 既有设置与 App Server current owner                                                | 待完整清单与行为/结构核对                                                                                                        |
| diff/editor、Office/专业文件、原生操作、环境/remote | 对应包与平台证据                                             | 既有 artifact、document-preview、Desktop Host、environment、transport owner        | 待查证/实现；不自动排除，不复制业务后端                                                                                          |

已取证范围集中到[结构与命名账本](../research/codex-desktop-rea/structure-alignment-ledger.md)，本轮文档窄写集包含该账本及研究索引。每行继续拆成“上游符号 → current 符号 → 调用者 → 行为 → 删除项 → 测试/护栏 → 证据”；完整符号覆盖仍partial，压缩局部变量与无source map的原名记unknown。

## 验证合同

规则更新：`budget:tight`，仅格式、链接、命令存在性、相关文档守卫与 diff 检查。无产品代码变化时不启动 Electron 或全量 Rust，也不形成产品/release evidence。

产品切片：实现前按模板补齐入口、网关、IPC、public method、domain owner、read model、事件、GUI、happy path、失败终态与测试资产。仍沿唯一 `Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection` 主链。

默认顺序：定向行为测试 → 受影响 current fixture → 对应 Electron fixture/Gate B → GUI smoke → 默认本地门禁。协议/bridge 变更追加 contracts；Windows 未实跑不写 Platform 通过。外部 fixture 绕过的 provider/runtime 层要明确。

## 完成标准与限制

每个切片必须同时关闭行为、结构/命名、调用者迁移、旧资产清理和风险匹配验证。全面对齐要逐项关闭完整账本，不能用三个切片或同名文件数量替代。

已知限制：此前 Computer Use 拒绝操作 `com.openai.codex`；不绕过限制。可继续静态 REA 与 Lime 真实 GUI 验证，Codex 实时窗口效果记 not-run。REA 三文件 timeline 与六文件 surfaces 的结构覆盖完整，但语义仍有 unknown，不宣称全包完整分析。

下一刀：current第4轮22/22已关闭，继续默认前端第87/131批续跑；随后由既有useAppNavigation统一设置canonical章节参数与返回上下文。搜索/dirty需实际owner证据。专业文件、原生工具和remote仍留账本，不能由局部门禁推导全面完成。

## 首刀：审批卡 Verification Contract

- 名称：Pending Request Item Panel / Approval Card 对齐。负责人：root，2026-10-13。
- 预算：`budget:normal`；风险 P1；不调用 live Provider。
- 参考：包内 `pending-request-item-panel-770855267df2.js`，SHA-256 `65c883ee4c9b507b6fe86e9edd73ac0eb2e085730dfbb1f72d0761ccde22be69`；通用卡位于 `app-initial-6350d04672d0.js`。module-derived 文件名与原始压缩符号分别记录，不能声称已恢复开发源码名称。
- 写集：新 `components/ApprovalCard.tsx`、`PendingRequestItemPanel.tsx` 与对应测试/纯投影；删除 `Inputbar/components/InputbarApprovalPrompt` 源码与测试；迁移 PendingInteractionLayer、Workspace inputbar、相关 DOM 定位器；补五语言 `agentInputbar.json`；迁移审批 GUI fixture/断言/脚本测试；更新旧审批 PRD 与执行记录。public request 的 cwd/grantRoot 只补到现有 pending projection，不改 schema 或业务 authority。
- 避让：已脏 Rust approval/runtime 与 `agent.json`，不接管其实现。
- 前端入口：PendingInteractionLayer / Workspace Composer accessory → PendingRequestItemPanel → ApprovalCard。
- 网关与 Host：既有 pending interaction controller → AppServer server request dispatcher → Electron preload/IPC → `app_server_handle_json_lines`。
- App Server：`item/commandExecution/requestApproval`、`item/fileChange/requestApproval` reverse request 与同 id response；不调用已退役私有 action method。
- Owner：审批 authority 仍归 App Server / tool-runtime；卡片只展示请求并提交现有 decision。
- Read model / event：同一 thread/turn/item pending interaction，response 后清除；terminal 使用 current `turn/completed` 与 canonical read model。
- Happy path：显示完整原因、命令预览、目录与已知网络/授权范围；长命令可展开；仅显示服务端允许的决定；提交期间禁止重复响应，失败可重试；响应成功后恢复现有运行状态。
- 失败边界：没有 submit owner 或请求已提交时按钮禁用；未知授权能力不生成“Always allow”或“Allow similar commands”假动作。
- 证据：component/unit 与五语言回归、current fixture、对应 approval Electron fixture、GUI smoke 与默认本地门禁；GUI evidence 需同 identity 的 IPC/request/response/read model/可见状态，不能只看卡片截图。
- 必跑：定向组件/投影/fixture tests；`npm run test:contracts`；`npm run smoke:agent-runtime-current-fixture`；`npm run verify:gui-smoke`；`npm run verify:local`。失败按 owner 修复或明确记录外部脏写集阻塞，不恢复旧断言。
- 架构影响：非重大；既有 projection/response owner、协议与依赖方向保持一致，拆分仅为 Renderer presentation；架构图无需改变。
- 退出条件：旧 compact-only 规则、源文件和测试不再作为 current 入口；新卡行为与支持的决定完成定向验证。file diff 与 canonical item_id 接线、policy/network amendment 和自动审查专用详情仍是呈现缺口；协议已有字段不能被记成协议缺失。不宣称整个审批域完全对齐。

## Files/diff Verification Contract

- 负责人：lime_gui_comparison；记录：root，2026-10-14。预算 `budget:normal`，P1，不调用 live Provider。
- 参考：REA `ev_7e96cf795451f834a7bddc70daacbc950320070656781f6347f1cf9c759e4299`；经 ASAR SHA 校验的 review tree/side pane 补证。`ReviewThreadSidePanelTab` 是确认导出；压缩局部名不作开发源码事实。
- 写集：Files renderer、workspaceFiles、既有 ChangesPanel/DiffList/ReviewState、右侧 composition 所需接线及对应测试；文档、架构、fixture 门禁归 root。避让 Rust、命令目录、审批和 agent.json。
- 入口与事实源：统一 RightSurfaceHost 的 Files → 同一 canonical coding changeView → 既有 CanvasWorkbenchChangesPanel；Git/read/full-file 仍走 existing frontend gateway → Electron IPC → App Server current methods，不新建 diff 或文件读取 owner。
- 接线：会话 coding projection 只计算一次，分别供 Canvas 与 Files 消费。若使用 Context，只传只读 projection，不增加业务状态或 runtime。
- Happy path：打开 Files 显示真实 patch/diff；点击文件选择并定位相应 diff；再次点击仍定位；打开原文件是显式动作；已有 inline/split、baseline、full-file 复用。
- 失败边界：Git/full-file 失败可重试；线程/目录切换清空局部缓存；迟到异步结果不得写回新 identity；无协议能力不伪装 comparison base。
- 旧资产：删除 patch→path-only 列表与解析 helper；迁移旧“选择会启动外部应用”测试；保留唯一 RightSurface owner 守卫并同步接线。
- 验证：定向行为测试、typecheck、current fixture、`smoke:code-artifact-workbench-electron-fixture -- --scenario gui-coding-input` 加 Files→diff 断言、GUI smoke、verify:local。
- 架构影响：共享 renderer projection 新增消费者，更新 architecture 图。责任开发者图确认：root，2026-10-14；已复核 Scene 只读 Context 直接传同次 changeView / root / loadFilePreview，Canvas 与 Files 共用 review owner，无第二数据 store。

## 长历史 Verification Contract

- 负责人：lime_desktop_capabilities；记录：root，2026-10-14。预算 `budget:normal`，P1，不调用 live Provider。
- 参考：既有 timeline REA 与 `thread-virtualizer` / `virtualized-turn-list` 包内纯几何、viewport range、高度测量、锚点和导航；导出为压缩 alias，语义命名与原始绑定分开记录。
- 写集：MessageList、旧 RenderWindow owner、scroll controller、timeline/telemetry/historical chrome/constants、相关纯 projection 与测试/样式；不修改 Files 或 conversation composition。
- 入口与事实源：App Server thread/read 与 canonical paging → 同一 Thread/Turn/Item projection → viewport turn list。保留后端分页 owner，不增加 history store。
- Happy path：离屏 turn 真正卸载；稳定 key 与动态高度；窗口按 viewport/overscan 改变；prepend/流式高度变化保持阅读锚点；用户在底部时尾随；focused/current item 导航先挂载目标再定位。
- 失败边界：迟到测量不污染新线程；ResizeObserver/RAF/事件清理；键盘、触摸、滚轮与滚动条操作能停止尾随；离屏数量不等于未加载历史或 hydration pending。
- 旧资产：删除 idle 渐进挂载与 Expand All 全量 DOM 路径；保留 canonical Load More；同步迁移初始窗口固定 10/36 的测试与性能 fixture，不保留双裁剪 owner。
- 验证：纯几何与 component/hook 行为、长历史真实 Electron fixture、current fixture、GUI smoke、verify:local。实际性能数字只有跑过才落库。
- 架构影响：renderer window owner 直接替换，更新 architecture 历史窗口段落及图；责任开发者图确认：root，2026-10-14。MessageList 传全部已加载 canonical entries，唯一 virtualizer 持有 DOM/测量，后端 paging 保持独立。

## 验证记录

- 规则：两个 skill validator、链接/脚本存在性、docs boundary、12 个 current-docs guard 通过。
- 首轮审批定向验证：6 文件 / 146 tests 通过；contracts 与 typecheck 通过。
- 追加：file grantRoot request/response 回归与 dead surface 物理恢复守卫通过；键盘菜单 Escape 焦点回归已修复并通过，PendingRequestItemPanel 13 tests 通过。
- Files：9 文件 / 92 tests、package projection 42 tests，移除无消费者菜单后 3 文件 / 26 tests；typecheck、lint 通过。真实 Electron `gui-coding-input` 四个 canonical 文件的 diff 方向、选中与头部可见全部通过；删除项禁用外部打开，rename 仍按 source path 选择、显式打开 destination。选择导致 external open 为 0，console/page errors 为 0。证据：`.lime/qc/gui-evidence/code-artifact-workbench-electron-fixture/codex-gui-alignment-files-final-summary.json`。
- 长历史：29 文件 / 318 tests、typecheck、lint 通过。真实 Gate B 与冷重启恢复通过，fixture seed 240 Turn / 720 Item；实际已加载 14 entries，首帧挂载 3 Turn / 9 Item，滚到已加载页首挂载 8 Turn 并卸载原尾部行，然后返回尾部。首帧文本 2,068 字；first paint 38ms / cold 97ms，compute max 0ms / cold 1ms。预算仍为 ≤12 Turn / ≤36 Item、paint ≤8,000ms、compute ≤500ms；不把 seed 总数当成全量加载性能。证据：`.lime/qc/gui-evidence/agent-session-history-electron-fixture/codex-gui-alignment-history-final-summary.json`，console/page errors 为 0。
- Gate 迁移：Files helper 8 tests + smoke guard 8 tests；viewport oracle 9 tests；current-rules 与 viewport 合计 20 tests；五语言 loader 10 tests。旧 current-rules 的 skill 重复模板断言迁为权威引用/主链/证据要求；旧全历史文案断言迁为分页文案。没有降低 DOM/性能预算或移除权限/mock 护栏。
- 默认本地门禁已通过五语言完整性/unused、lint、硬编码扫描与 typecheck，Vitest 续跑到批次 91/121；contentParts final body case 在全量负载下5秒超时，独立case与整文件14tests均通过，未扩大timeout或更改产品逻辑掩盖。待写集冻结后resume。current-rules、loader与Codex async源码anchor等过期断言已迁移，保留有效权限/mock/Reasoning护栏。本轮新改动后current fixture、GUI smoke与受影响Rust门禁待收敛。
- 写集例外：仅精确移除五语言 `agent.json` 中六个孤立旧 Files/菜单键，保留其他并行编辑；`agentMessageList.json` 删除三个旧尾窗键。新增 loader test 与 current-rules test 用于迁移过期护栏。
- 真实桌面发现 `thread/settings/updated` 原先只有 typed guard / package oracle。完成生产 consumer、现有 cache 接线和真实 Electron Gate B 后，迁为 `known_projected`；不通过静默白名单掩盖缺口。
- REA 审批：1 文件、23,095 AST nodes、199 findings、0 parse failures；结构 complete、语义 unknown。Wakaru source recovery 因 Linux x64 引擎不适用于当前 host 而未执行；不影响静态分析，不声称恢复完整源码。

规则更新完成度 100%；全面 GUI 对齐仍为 partial，不从三项首批切片推导全产品百分比。

## 下一批：队列呈现与动作隔离 Verification Contract

- 负责人：lime_gui_comparison；root 记录，2026-10-14。`budget:normal`，P1，不调用 live Provider。
- 参考：[导航/Composer 审计](../research/codex-desktop-rea/navigation-composer-audit.md)；已确认 shipped export `QueuedMessageList`。只迁移同义列表职责，不把压缩 alias 作为函数名。
- 写集：`ThreadQueueStatus` 直接迁为 `QueuedMessageList`、纯输入编辑 helper、既有 queue action UI 与 tests、Scene import/callsite、`queuedTurnCurrentBoundary` 的 current path 和 dead 回流守卫；独立修复 `ThreadWorkspaceHeader` 重命名 session identity 及测试。root 拥有执行计划、架构、五语言文案和 Electron mutation gate。
- 既有主链：QueuedMessageList → current threadQueueActions → typed client → Electron preload/IPC → `app_server_handle_json_lines` → `thread/queue/update|delete|reorder` → 既有 App Server queue/store → scoped notification/read hook → 同一 canonical queue projection。禁止新建 queue store 或在 renderer 删除后再 steer。
- 行为：线程切换清空旧编辑与错误；旧 action 的 then/catch/finally 不影响新 identity；重复提交 fail closed；互斥队列变更不会被另一个请求提前解锁；保存失败保留草稿。多 text block 编辑无重复，非文本与 client message identity 保留；未改文本保留原始 textElements，修改后不沿用失效 ranges。
- Header：编辑绑定开始编辑时的 session；切换取消旧草稿，旧 blur/key handler 不能调用新会话 rename。
- 暂停/sending/outcome-unknown 尚无 canonical DTO，保持显式 gap，不伪造状态。当前 `thread/queue/start` 只支持 idle，不把它改文案冒充 active-turn Steer；该协议/事务切片另立合同。
- 验证：跨线程迟到成功/失败、重复与并发、富输入保存和失败恢复、键盘 preview、header session 切换；scoped reader 和 boundary guard；真实 Electron mutation 需覆盖 update/reorder/delete 的 typed request、canonical queue refresh、正文唯一，单独报告，不冒充 live runtime。
- 架构：业务 owner/协议不变，仅同义 renderer 直接迁移；同步图和当前入口，不保留 alias/compat。退出条件是旧组件与其正向测试删除、调用者/护栏迁移、定向与对应 Gate B 通过。

## 下一批：设置通知消费 Verification Contract

- 负责人：lime_desktop_capabilities；root 记录，2026-10-14。`budget:normal`，P1，不调用 live Provider。
- 已确认缺口：typed client 已解析 `thread/settings/updated`，projection 中现有 oracle 没有生产 consumer；`agentRuntimeAdapter` 丢弃 RPC response.notifications，`useAgentContext` 以 ACK 后的请求选择更新 UI。warning 间接触发 detail refresh 不算通知消费。
- 写集：既有 settings adapter、EventBus/typed notification route、session/read-cache 与 useAgentContext 的最小接线和回归；不改 Rust、协议、Files、MessageList、queue、命令 catalog 或外部脏 owner。先复核生产订阅/identity 设计，再实现；root 拥有 Electron settings oracle、执行计划和架构。
- 主链：既有 settings RPC → App Server canonical settings → typed `thread/settings/updated`（response 与后续 drain）→ 现有 event/同步 owner → 同一 thread/session read cache → useAgentContext/header/model/cwd projection。ACK 仅结束提交，不以请求值替代服务端有效值；没有第二设置 store。
- 回归：服务端 canonical model/provider/effort/serviceTier/cwd、inactive thread cache、切换迟到隔离、响应与 drain 重复幂等、失败恢复、active turn 不变而 future turn 使用新设置、通知不写 transcript/Item。对于当前不支持显示的字段不合成 UI 行为。
- 门禁：真实 production consumer 定向测试、既有 settings live-update oracle/typed contracts、真实 Electron model/cwd/header 证据；通过后才能把 method 从 known_unprojected 移到 PROJECTED。不可先加白名单消警告。退出条件按实际可消费字段逐项确认，不把 oracle 导出数当接线。

## 第二批实施与桌面验收（2026-10-14）

- Queue/Header：旧组件与正向测试物理删除，无 alias/compat。thread-keyed 实例、mounted/request token、同步整队 mutation 锁隔离 A→B→A 迟到 success/error/finally；保存失败保留草稿。纯输入 helper 保留未改 blocks/ranges，修改后合为一段 text，保留非文本顺序，清除失效 ranges。Header 绑定编辑开始的 session/token/callback。6 文件 / 36 tests、renderer typecheck、窄写集 lint 通过。
- Queue Gate B：真实 GUI 保存、上移、删除和 preview 焦点均经 current IPC，canonical list 同一 identity 读回。seed 内联图片入库后成为 `sidecar://media/input-<sha256>.png`，oracle 先校验 seed bytes 的哈希基线，再精确比较 update/read-back 全部非文本输入；附件丢失、替换和空基线均 fail closed。原 raw dataURI 比较是过期验收基线，未为通过而移除附件要求。GUI list 可见先于 trace 完成，采证改为等待生产同线程 list，未补 fake request。证据 `.lime/qc/gui-evidence/thread-queue-electron-gate-b/codex-gui-alignment-queue-final-summary.json`：零 invoke/console/page/mock error；不启动 Turn，不证明 active Steer、拖拽或发送状态。
- Settings：EventBus 消耗 response/drain 成对镜像且保留 A→B→A，scoped adapter/cache/context/header 接线不建第二 store。ACK 不替代 canonical 设置，串行选择和 future-send wait 有定向回归；`useAgentContext` 已拆至 765 行。10 文件 / 120 tests、既有 oracle 8、最后 production consumer 8、renderer typecheck/lint 通过。真实 Gate B 后迁 `known_projected`，新增 drift/privacy/typed passthrough 回归。
- Settings Gate B：真实 GUI model selection 与同线程 raw cwd RPC，旁路观察原 Host IPC handler 输出，不额外 drain、不注入 consumer。当前 stdio ACK 与 notification 分离，原要求 response.decoded 含通知是 oracle 错误；验收依据生产 drain 中 canonical model/provider/cwd 通知与可见 header，以及 `thread/resume|read` 读回。证据 `.lime/qc/gui-evidence/thread-settings-electron-gate-b/codex-gui-alignment-settings-final-summary.json`：零新 Turn、transcript 通知和 invoke/console/page error。只证明 idle model/cwd，不声明 active/future Turn 执行、live Provider、Windows 或 packaged。
- 架构图：Queue/Header 与 settings 数据流已更新；责任开发者 root，2026-10-14 confirmed。业务 owner、协议和依赖方向未新增双轨。实际 App Server sidecar 使用显式 binary override，SHA 记录到最终 Gate summary；未建立与当前外部脏 Rust 树的精确构建等价，不用 mtime 冒充编译证明。
- 分类：新增/迁移 presentation、通知 consumer、fixture/oracle 为 current；旧审批、Files、尾窗与 ThreadQueueStatus owner 为 dead/deleted/forbidden-to-restore；本批没有 compat/deprecated。现有队列 store、runtime、thread paging/read model 是 current，不因删除 UI 旧入口而删除业务 owner。
- 完成度：规则更新100%；Queue/Header的mutation list/identity/结构/清理已通过既有验收，设置idle model/cwd切片通过。随后补齐内部canonical Item/媒体一致性，并由公开源码纠正“pending进入主时间线”的错误验收合同；旧timeline-final summary不再作为最终pending证据。完整产品仍partial，全面账本未穷举到稳定分母，不给无依据的全产品百分比。
- current fixture 聚合已通过：22 个真实 Electron 子场景，涵盖审批 allow/decline/cancel/full-access、首页热路径、Files/coding recovery、图片意图、停止续聊、富草稿恢复、active steer、Plan/Skills/MCP/media/Expert/文章产物；绕过模型的 external/unavailable fixture 不是 live provider。日志 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/lime-gui-alignment-current-fixture-final.log`，各场景 summary 位于 `.lime/qc/gui-evidence/` 对应目录。不能用聚合通过覆盖上述新发现或完整视觉等价。
- 前批contracts、规则/dead surface/queue/settings Gate guard、窄写集ESLint与legacy report通过；零引用、分类漂移、边界违规均为0。本轮新增public history/native tab合同后需重验受影响边界，旧75批记录已由上方91批进度取代。

## Queue canonical Item 与主时间线一致性 Verification Contract

- 触发：真实 mutation 截图显示旧 rich 文本与已删除 sentinel。`queue.added` 自动注入 message.created 生成 canonical User Item，`queue.updated` 没有更新该 Item；reorder 的 removed/added 事务会移除后重建 Turn，却不重建 Item。renderer queue.changed 只刷新 list，普通 read-model merge 保留删除项。PNG fixture 的 IDAT CRC 无效已替换，并在浏览器 Image.decode 验证 seed。
- 负责人：Rust materializer 与独立回归由 lime_desktop_capabilities，root 拥有 renderer read refresh、Gate、计划与架构；P1，`budget:normal`，无 live Provider。
- 窄写集：`runtime/thread_item_projection/materializer.rs`、`materializer/lowering.rs`、`materializer/lifecycle.rs` 与该领域新独立 Queue regression module/必要 test module 注册；root 的现有 session refresh/projection/helper 与 scoped queue.changed hook、既有 SyncEffects 一处接入、对应定向测试；既有 Queue Gate 增强。避让外部脏 approval/runtime/backend owner，不修改 public v2 schema 或新建 queue/history store。
- 主链：Queue typed mutation → App Server 既有 queue events → 唯一 materializer → 既有 ThreadStore canonical User Item → queue.changed → scoped existing session read refresh → 同一 canonical Thread/Turn/Item 主线。编辑使用稳定 user item/client identity、完整 typed input（含 sidecar）覆盖快照，不重新 append message.created 或完成生命周期。
- 行为：add/edit/reorder 保留一份准确 User Item；delete 清 Turn/Item；重启和 thread/read 一致。frontend 自动读回更新文本/顺序和删除，不直接从queue list patch历史；读取为完整 read model才允许replace，分页detail不能伪装完整快照，保留 active streaming/未确认 optimistic 边界。
- 失败与竞争：读取失败不伪造删除成功；订阅session/thread/workspace generation、A→B→A和迟到read隔离；连续通知串行且末次不能丢失。v2 Turn 未携带内部queue状态是既有协议gap，不依靠当前不可命中的isQueuedTurn判断；另立协议合同，不随本刀扩schema。
- 验证：独立 materializer + canonical store add→edit→reorder→delete/restart 回归、受影响Rust crate、frontend scoped read/projection/hook 回归、contracts、增强真实Electron Gate B（raw thread/read正文/Items + GUI更新/删项 + canonical image decode）、默认本地门禁。退出条件是上述同一identity证据通过；原queue list Gate通过不关闭新问题。
- 架构影响：恢复既有唯一projection owner的一致性，不新建业务owner；更新architecture现有Queue/read flow并由root复核图。canonical内部queue状态与v2传输的完整对齐仍待独立关闭。
- 测试迁移：`ChatModelSelector.integration.test.tsx` 补canonical设置通知和隔离catalog，保留跨session恢复的模型与thread/settings cache断言，4 tests通过；不会恢复ACK请求值提交逻辑。

## ComposerUtilityBar 结构与动作隔离 Verification Contract

- 负责人：lime_gui_comparison；root 记录，2026-10-14。P1，`budget:normal`，无 live Provider。
- 参考：focused REA `ev_a12d13494c92f390f31b4493b08cc34bd42867413b8d6fcfbe597601fad22a18` / exact export view `ev_d226fcac113fff14952965ae9465453d279c1f1431cdef57be2026d60b9e06d9`；证据限制见 navigation-composer-audit。只迁 project/run-location/branch/local context 职责，不迁整个 model/permissions/editor。
- 窄写集：`InputbarProjectContextBar` 源文件/独立动作hook/对应测试，直接迁 `ComposerUtilityBar` 与首页、ChatNavbar、EmptyState类型、Inputbar.index、既有workspace透传的必要引用；仅清理实际未消费的props。root 拥有docs、架构、dead surface catalog/guard和Electron验收。避让Queue/read model、审批、Rust、共享command owner和不相关脏修改。
- 合同：现有project/Git gateway → current Electron IPC/App Server与domain owner不变；所有mutation绑定projectId/rootPath/workspace generation/request identity。同步互斥，A→B→A旧success/error/finally不能改新视图或导航；失败可重试，正确当前项目动作仍刷新/导航；单一owner同时服务home与navbar。
- 清理：旧组件、copy/project类型与测试路径直接迁；不建alias/compat。动作职责拆成hook，renderer文件保持小于800行；主题使用既有token。不合成cloud/remote/environment能力、不以Local文案冒充readiness，现有worktree立即创建与上游staged mode差异另立跨层合同。
- 验证：既有home/navbar/Inputbar/Git及workspace调用者测试、mutation隔离/同步重复/失败恢复/键盘与主题回归，renderer typecheck/lint、受影响Electron场景、GUI smoke、本地续跑；必要文案同步五语言。结构迁移不等于完整worktree/run target行为等价。
- 架构影响：非重大，沿用唯一project/Git owner及composer controller；root 最终复核引用图。退出条件按结构、命名、调用者、已确认动作语义、清理与对应测试分别记录，未知能力仍在全面账本。
- 巨型既有session hook例外：本轮仅接入已拆分的Queue read helper，新增业务保持在独立helper/hook；不向`useAgentSession`继续堆叠状态机。退出条件是该helper测试/接线证据通过并冻结最小接线，后续迁移另立owner拆分合同。

## Queue 输入图片真实读取补充合同

- 触发：增强Gate已观察主时间线正文更新，但图片仍显示unavailable；合法seed已由浏览器decode通过。输入writer生成既有`outputRefs`对象，`session_media_refs`只识别嵌套`sidecarRef`，需查明同一canonical input URI的真实`media/read`结果。
- 负责人：lime_desktop_capabilities窄写`runtime/session_media_refs.rs`及`session_media_reader.rs`该领域独立回归/必要注册；root拥有Gate和docs。避让外部脏runtime/backend、协议与input writer；先真实RPC或Rust集成复现，再修复已经存在的reference lowering，禁止绕过session ownership/sha/bytes/range/cancel校验或读取任意路径。
- 合同：typed input media writer → 既有outputRefs → media/read唯一reference owner → sidecar verified bytes → MessageImageAttachments。不新增media metadata key、平行store或renderer raw文件读取；保留跨Thread拒绝、篡改哈希/大小失败、未知URI失败和请求取消。
- 验证：真实queue/add与合法inlinePNG后的media/read，在edit/reorder及冷恢复后保留同一URI/bytes；负向scope/sha/read保护、受影响AppServer tests和新binary SHA、增强Electron image.decode、contracts与本地门禁。此发现继续阻止Queue完整验收，原列表和正文通过不覆盖图片。

## ComposerUtilityBar Electron 验收补充合同

- root 窄写集：既有 `scripts/electron/lib/` 内独立 utility Gate 与 oracle、scripts 导航、legacy catalog、执行计划和架构。生产组件及动作 hook 由既有 worker 冻结后再构建。
- 使用隔离 app data、两个真实 Project 与临时 Git 仓库；初始对象用 Git plumbing 生成测试基线，不提交或切换 Lime 源码仓库。setup 可从 current IPC 建 Project/写本地选择基线，但成功证据必须来自 GUI 项目选择、分支创建/切换、真实 IPC 与 Git/readback 同一 root。
- 验证 home UtilityBar project/root identity、分支菜单/搜索/create/checkout、reload 后恢复；全部 Git mutation 必须匹配当前 workspace root，禁用 mock fallback。错误/重试和 A→B→A 由组件回归覆盖，不用受控成功场景冒充故障恢复实跑。
- 不启动 Turn、不调用模型；不把立即创建 worktree 证明为上游 staged composerMode 等价，不包含 cloud/remote/environment。
- 实跑补充：首页把 `useWorkspaceOpenedProjectsRuntime.enabled` 永久绑定到 auxiliary deferral，导致已打开项目虽存在于侧栏/存储，UtilityBar picker 始终为空。root 窄写补 `useAgentChatWorkspaceEntryRuntime` 的这一处接线；只恢复现有 opened IDs 的 workspace/read，不开放 memory/model 等其他 auxiliary owner。真实 Gate 使用 workspace/ensure 基线，项目必须经 GUI 选择，不能拿 Project 目录实体替代 Workspace 实体。

## 未消费 Queue 的 public history 与运行状态合同

- 触发：增强 Gate 的正文/附件一致性已通过，但截图发现没有启动的 Queue 仍被显示为运行中。公开 Codex `ext/queue` 的 enqueue 只写独立 queued_items；start/admission 后才创建执行 Turn。public v2 Turn 不携带 queue 状态，不新增猜测 enum 或 renderer 私有 wire 字段。
- 保留 Lime 内部 current durable queue materializer、稳定 User Item、媒体与冷恢复 owner；尚未消费的内部 Queued Turn 不属于 public transcript，Queue 列表继续由 `thread/queue/list` 唯一供给。内部有事实不等于可向 public history 投影。
- 窄写集：既有 RuntimeCore thread read/turns/items/history pagination owner 与独立 regression module、必要 public projection 过滤及 processor tests；不修改 schema、agent loop、queue scheduler、shared runtime/approval/backend 外部热区。root 接管 frontend 公共 projection 中不可命中的私有 queue 字段假设、Electron oracle、docs/架构。
- 失败边界：queued 不能触发 orphan interruption、terminal-projection-pending 或 active 状态；真实 active/terminal/drain 语义保持。过滤必须覆盖 read/list/resume、turn/item paging 与指定 queued Turn read，不泄漏 Item；不能在截断后的单页简单丢条目。使用既有 opaque cursor，补足可见 page 或明确 EOF，重复 cursor fail closed。
- 验证：混合 queue/history、全 queued 页、反向 paging、同库/生产分库冷恢复、queue admission 后可见、真实 active 仍 active；pending Gate 改断言 public history 未含 queued正文、header/Composer idle、队列 edit/reorder/delete 保真。图片由真实 media/read 解码验证，不能为通过测试保留错误的未启动 transcript。
- REA 精确缩略补证：同一 Queue chunk UTF16 offset 11048 有真实 `img`，src 来自 submission context 第一张 image preview，size-6；不是完整 gallery。root 窄写 `QueuedMessageList`、`queuedMessageInput` 的首图转换、既有 `MessageImageAttachments` 的 thumbnail presentation 及定向回归；复用同一 media/read/abort owner，不建第二图片读取链。Queue Gate 改在真实 row 解码缩略，公共历史必须为空。

## Right Surface 切换与关闭合同

- 触发：同线程 Browser → Files 仅切换选中项，却使 Browser 从 openSurfaces 消失。select 与 close 必须分别表达；不从 active pane 卸载猜测 native Browser 已销毁。
- 参考：已保留 REA surfaces 模块及确认导出 `LocalConversationBackgroundTerminalTab`、`LocalConversationSubagentsPanelTab`、`ReviewThreadSidePanelTab`；通用 host/artifact 压缩局部名仍 unknown，不凭猜测迁名。
- 窄写集：既有 `useWorkspaceRightSurfaceLocalStateRuntime`、`useWorkspaceRightSurfaceProjectionRuntime`、`useWorkspaceRightSurfaceCoordinatorRuntime`、`useWorkspaceRightSurfaceActionRuntime` 与相邻独立 projection/action 回归；不修改 queue、Composer、runtime、native/browser host 或 shared registry 协议。worker 避让并保留前轮 Files/diff 修改。
- 同线程显式打开 surface 集合属于局部显示 owner；select 不删除其他 tab，close 才删除；thread/workspace epoch 切换必须隔离旧集合与迟到动作。resource availability 仍由现有 registry/definitions 判断，不新增 browser/artifact/subagent store。
- 验证：open Browser → Files → Browser、close 选中/非选中 tab、无资源 surface、线程 A→B→A；定向测试与真实 Electron 相同 thread tab/资源 identity，禁止 mock fallback。Gate 证明 tab 生命周期，不冒充 native Browser 进程跨线程持久化。

## Pending Queue 搜索可见性合同

- 触发：只读追踪确认 canonical User Item 已进入 `thread/search` 的 snippet 与 `thread/searchOccurrences` 的 occurrence/turn cursor；搜索还透传 raw Active 状态。pending Queue 属于独立列表，搜索执行历史不能把它返回为 transcript 结果。
- 负责人：lime_gui_comparison；root 记录，2026-10-14。窄写集为既有 thread-store canonical search owner 与相邻独立 regression module/注册、RuntimeCore public search 包装的最小有效状态投影及必要 processor/JSONL 回归。保留 external 脏写集、现有 visibility 与 opaque cursor，不改 schema、queue scheduler、export、rollout rebuild 或全局 active helper。
- 合同：已执行 transcript 匹配、排序、分页与已有 title/path 搜索继续由当前 owner；仅 pending 文本不能命中 snippet/occurrence。Thread overview 状态取同一 execution state 规范化。queue admission 后该 input 成为正常可搜索历史；同库/分库冷恢复保持语义，不合成游标或由 renderer 二次过滤。
- 验证：interrupt 基线 + 唯一 pending 字符串负向、混合执行/queue 同词、分页 EOF/双向、admission 后正向、真实 JSONL 与 thread-store 定向。不把诊断 export 中显式 pending/queued 字段定义为泄漏；其 transcript 与队列区分另立合同。rollout rebuild 与 idle unload 为待复现风险，未更改。
- 真实 pending Queue Gate 前置条件校准：sidebar `thread/resume` 会唤醒 idle queue，直接 add 到全新 Thread 的旧 fixture 会 admission 第一条。改用 current external 阻塞 backend 启动唯一基线 Turn，再真实 interrupt 确认终态，随后添加 pending Queue；只含已执行基线历史且 idle，pending 不出现在 transcript。该 fixture 仍绕过 live Provider，不证明跨 unload/restart 暂停持久化。
- 大文件例外：code-artifact fixture 只接入独立 lifecycle helper 的 import/call，业务与 oracle 位于 `scripts/electron/lib/`，不继续向原巨型入口堆叠；退出条件为相同 Thread Gate 完成并冻结接线。

## Browser live tab 恢复合同

- 触发：同线程 Browser→Files→Browser 卸载/重建 BrowserWorkspace，仅 mount primary，丢失完整 native tabs 的投影；primary存在时第二tab无法恢复可见性，primary已关闭时会复活primary。BrowserTabHost是既有live tabs/selected/URL/native view唯一authority；App Server继续只分配canonical browser session/thread identity。
- 负责人：lime_desktop_capabilities；root记录，2026-10-14。生产窄写集为BrowserTabHost、ipcChannels、browserTab typed API、BrowserWorkspace及必要独立hydration helper；相邻host/API/component/IPC合同tests。根治理catalog与既有mock/fixture若当前native命令已纳入必须同步，不建生产fallback。
- 新增host-only只读`browser_tab_list`：从实际IPC sender派生window，按window/ownerWebContents/browserSession/thread返回完整live snapshot；已知跨scope资源拒绝，不将身份不符伪装empty。沿既有preload白名单及main native dispatch，不增加Rust业务runtime或猜测上游符号；名称为本地领域命名，未声称REA确认上游导出。
- renderer在同一canonical identity下hydrate，非空恢复host selected与既有setBounds，只在确认真正empty时创建primary。snapshot失败、scope混入、无selected中间态不能bootstrap；event/snapshot/selected/close交错不让旧快照覆盖新事实；origin+单调generation隔离ABA与迟到bounds。
- 验证：双idle tab选第二→切换保持列表/URL/view/webContents；关闭primary→切换不得复活；跨window/session/thread/伪造owner/mixed/duplicate snapshot拒绝；empty、失败、late event/snapshot/bounds和ABA；定向host/API/renderer、`test:contracts`、真实Electron双tabGate、GUI smoke与本地门禁。
- 大文件处理：BrowserTabHost既有超过1000行，新增snapshot参数解析/校验/列表拼装进入该领域独立模块，主类仅注册和窄委托；记录既有文件拆分风险，退出条件为不向主类继续追加业务算法。BrowserWorkspace接近800行，hydration逻辑拆独立hook/helper，并直接替换旧bootstrap effect，不保留双轨。
- 不证明native跨线程或重启持久化，不推导Codex运行等价；本刀修复已确认本地生命周期缺口。root最终复核并更新架构图；command/bridge变更不通过时不能进入产品证据。

## 本轮冻结与证据记录（2026-10-14）

- pending public read/list/resume/paging：11文件，74/74 tests、rustfmt与窄diff通过。定向JSONL含queue6、v2 thread19、resume replay2。日志`.lime/qc/validation/codex-queue-public-history/`。分页读取Summary pending IDs的长历史成本尚未benchmark。
- pending搜索：7文件，store6 + JSONL11 = 17/17 tests、rustfmt与窄diff通过。fixture显式`sourceKinds:["appServer"]`，先正向证明已执行内容可命中，再断言pending词不命中，避免默认CLI/VSCode scope导致负向空跑；默认产品scope不变。日志`.lime/qc/validation/codex-queue-search/`；最终build SHA`1188f12c7150afbe6a0c666eb57c3e109ed9c8682b698aa23667a2faa26778a3`，Gate prepare后需重新记录实际binary。
- Right Surface局部标签：6生产 + 2新增tests + 1迁移guard，73/73 tests、renderer typecheck、窄lint/diff通过。日志`/tmp/lime-right-surface-tests-final.log`。旧availability自动造open tabs与plugin-only epoch reset删除，未猜测unknown上游名称。
- Browser live tab：8生产文件与相邻测试/fixture写集冻结，11文件82/82 tests；renderer/Electron typecheck、20文件窄lint/diff及`test:contracts`通过。BrowserWorkspace从802降为689行；原primary-only恢复effect删除，无compat。新增snapshot/selection算法进入独立helper；主Host只注册/委托与修正visibility。日志`/tmp/lime-browser-hydration-{tests-final,renderer-tsc-final,electron-tsc-final,lint-final,contracts}.log`；当时 native 双tab Gate 待 Rust 冻结；随后通过，见下方最终 Browser / Right Surface Gate B。
- root Gate oracle：4文件56/56 tests通过，日志`/tmp/lime-pending-and-surface-oracle-final.log`；标准`npm run typecheck`通过，日志`/tmp/lime-codex-alignment-standard-typecheck-final.log`。首次误用Node test runner被Vitest拒绝，改用实际Vitest入口重验，未修改产品或放宽断言。
- Composer真实Gate B通过：`.lime/qc/gui-evidence/composer-utility-electron-gate-b/codex-gui-alignment-composer-summary.json`。两项目A→B→A GUI选择、branch create/checkout、Electron/AppServer冷重启后GUI恢复与Git readback；真实IPC4次、mock/invoke/console/page error为0，实际binary SHA`1c10f38b5d4927d32c01d4c92032fd7c95b09aa8325b96606e6bfad12fe1bcbf`。跨重启分别采集真实trace后合并，未补fake request。
- Gate失败已修原因：pending旧fixture等待marker正文，sidebarresume实际admission第一条，已迁interrupt基线；RightSurface初版request只填session，但GUI按workspace ID/root查询，已补同workspace scope。当时两项均待最终冻结后重跑；随后新版最终 Gate 已通过，失败结果不计成功证据。一次Gate freshness发现搜索半写集并开始prepare，已中止exit130，无剩余prepare/cargo进程，不将其产物作为最终证据。
- 新oracle：真实host/身份/资源/EOF/图片读/选择关闭负向回归通过；Browser Gate已增强双tab与关闭primary后恢复，必须出现真实native snapshot IPC，不把单primary保持等同完整tab恢复。
- 分类：以上新增owner/helper/client/fixtures为current；旧入口直接dead/deleted/forbidden-to-restore；无新增compat/deprecated。规则100%，Composer本合同100%，public pending与RightSurface本合同的真实Gate/默认门禁尚未关闭；全产品仍partial。

## Queue rollout 重建恢复合同

- 触发：projection_rebuild按TurnStatus将pending Queued/InProgress写成running。真实runtime queue/add写rollout，保留原DB/event log，并以同一rollout root初始化全新同库DB：canonical完整快照相等，但projected Turn.status=Running、冷queue/list由1变0。复现日志`.lime/qc/validation/codex-queue-rollout-rebuild/reproduction.log`；修复限定现有重建owner，不改变watermark或全局状态机。
- 负责人：lime_gui_comparison，root记录，2026-10-14。先用临时数据与既有真实rollout写入/空DB重建路径复现pending queue/list/read/resume；避免删除用户DB。窄写集为现有canonical_thread_store/projection_rebuild及该领域独立queue regression与必要注册；若没有复现，不增加生产补丁并记录证据。禁止改scheduler/unload/export/schema/普通admitted与terminal恢复语义。
- 若复现：重建必须保留canonical Turn.queue事实、稳定User Item/client/input/媒体与pending projection；唯一当前owner直接修复，不恢复第二journal/store。验证同库/分库、pending+executed混合、admission后可见、public history/search排除pending及既有completed/active/repair回归。
- 退出条件为实际复现分类与定向测试通过，冻结新binary后再跑最终Gate；诊断export与idle unload仍独立待核对。本合同不扩大为全workspace测试。

## 完整 Composer 只读补证

- 负责人：lime_desktop_capabilities；与root Gate收敛独立。无生产、测试、fixture写集，不触发build freshness。
- 先复用指定ASAR与现有REA Evidence，定位主editor而非UtilityBar/BrowserSkills/Sketch；仅当明确seed未被分析时补focused REA，不重跑全包、不执行Codex或绕过Computer Use拒绝。
- 返回真实模块/可确认导出、草稿/IME/附件/提交数据流与Lime input-kit/Inputbar调用链，记录Evidence ID、SHA/UTF16 anchor、观察/推断/unknown及最小可实施缺口。root随后落入本账本，不由静态补证标记产品完成。

## Browser actual sender dispatch 复核

- root 复核发现 `main.ts` 的 `currentWindow(event)` 会在未知 sender 时 fallback 到 mainWindow，Host 仅看到 window 而失去实际 sender。窄写集为 snapshot 领域 sender resolver / 相邻真实 Host 测试，以及 main browser-tab dispatch 的委托接线；不改 hydration 或其他 Host 命令。
- BrowserTab 命令只能使用 `BrowserWindow.fromWebContents(actualSender)` 且 `window.webContents.id == actualSender.id`；未知或 child WebContents 直接拒绝，不返回 empty、不回退 mainWindow。主文件超过1000行的例外仅限 import / 委托接线，算法位于已有领域独立模块。
- 定向验证 exact sender、unknown sender、child sender 经真实Host list的成功/拒绝；Electron typecheck、窄lint、contracts，再进入新版双tabGate。

## rollout 与 sender 最终冻结

- rollout：生产只在现有 projection_rebuild 的 Turn.queue 分支保留 queued；独立 queue regression/注册在同领域。新增及既有状态3 + repair/rebuild13 + queue JSONL7 = 23/23通过，rustfmt/diff通过。worker 当时 rebuild binary SHA `1d93af0f9d52a9e7ae2add71d5556fe42c44aa17148254c270d603e44fae4478`（不作为实际 Gate prepare 后摘要）；日志 `.lime/qc/validation/codex-queue-rollout-rebuild/`，原失败仍保留。worker domain测试显式MockBackend，真实Electron Gate另用external fixture，不冒充live Provider。
- sender：root新增 actual sender 接线3项回归；受影响5文件41tests、Electron typecheck、root窄lint与最终contracts全部通过。日志 `/tmp/lime-browser-sender-tests-final.log`、`/tmp/lime-browser-sender-electron-typecheck-final.log`、`/tmp/lime-codex-alignment-root-lint-final.log`、`/tmp/lime-codex-alignment-contracts-final.log`。
- 所有产品与测试写集已冻结，root顺序跑新版pending Queue与双tab Right Surface Gate。两个worker只做完整Composer/Queue activeSteer只读补证，不影响build freshness。
- Queue activeSteer只读补证由lime_gui_comparison负责：追踪同ASAR Steer callback的外部owner、消费与steer事务/失败顺序、expectedTurnId/client identity及交付状态；对照Codex current ext/queue与Lime既有steer/session actor，不用renderer delete→steer，不写产品/测试/文档。返回sources/Evidence/unknown与最小正确后续合同。

## 最终 pending Queue Gate B

- `.lime/qc/gui-evidence/thread-queue-electron-gate-b/codex-gui-alignment-queue-pending-final-summary.json` 的 `ok=true`：rich input/client identity、update/reorder/delete、独立preview/首图真实decode、public read/paging/search pending排除、idle与正向执行搜索基线全部通过，mock/invoke/console/page error均0。
- 实际postprepare App Server SHA `a2f19d3740d0c1a934a0415ae4b2f7e9f51e3e395cd9a692c48ea34961bf6e45`。初始worker build SHA与prepare后binary不同，最终证据按实际值记录；不推导未知脏树的精确源码等价。
- 首次新Gate的search数据全部符合合同，但直接preload读取并不生成safeInvoke trace，oracle错误要求该trace。诊断证明baseline=1/idle、pending=0/EOF、occurrence=0/EOF；已将直接调用取证迁到真实发送params及匹配request/response ID的`ipcObservation`，不制造trace、不补fake request、不放宽搜索断言。
- 共享观察predicate位于现有mcp-config-fixture-evidence；直接call在真实preload返回成功后记录observation。Queue/RightSurface分别校验准确method、identity与输入，同步负向unknown/mismatched response/mock回归。4文件61tests通过，日志`/tmp/lime-preload-proof-tests-final.log`；最后统一门禁继续验证。

## 最终 Browser / Right Surface Gate B

- `.lime/qc/gui-evidence/code-artifact-workbench-electron-fixture/codex-gui-alignment-surface-final-summary.json` 的 `ok=true`：真实GUI新建/选择第二tab，Browser→Files→Browser恢复完整tabs/selected/session/tab/webContents及真实native URL；关闭primary后再次切换不复活，最后分别关闭Browser/Files。canonical请求、native mount/list均为真实preload/IPC观察；mock/invoke error0。
- 同场景保留原四文件Files diff/选择/定位回归，external file open为0；不把native跨线程、Electron重启或Codex实时GUI列为已验证。
- 直接preload的workspaceRightSurface/request与Queue search复用同一实际发送/响应观察predicate；native mount/list继续要求safeInvoke真实IPC trace，不能拿测试构造trace补证。当前fixture22聚合进行中。
- 后续只读Queue activeSteer报告已落 `internal/research/codex-desktop-rea/queue-steer-audit.md` 与证据索引；前端实际steer成功后delete、unknown对账、有限TTL锁已确认，持久幂等未知。Lime日志失败/终态竞争风险仍为待复现，不按静态风险直接扩大生产写集。

## Composer 附件异步隔离 Verification Contract

- 负责人：lime_desktop_capabilities；root 登记，2026-10-14。预算 `budget:normal`，风险 P1；上一批 current fixture 22 场景通过且退出码 0 后开启本切片。
- 参考：REA 主 Composer `ev_18100ea823ab540f529ba756499161870e17f824267ed48a0665d3fb48cd0bb4`，原成员 SHA 与 UTF16 anchors 见 main-composer-audit。上游文件附件捕获 generation 并在完成时检查；只支持生命周期隔离原则，不声称与本地图片 hook 精确同义。
- 窄写集：`Inputbar/hooks/useImageAttachments.ts` 与相邻测试、`components/useEmptyStateAttachments.ts` 与新相邻行为测试，以及 `components/useAttachmentGeneration.ts` 小型共享 lifecycle helper。不迁附件状态 owner、不修改 runtime/store/协议/五语言文案；不夹写 root 的 BaseComposer、文档与 Gate。
- Current 主链：首页/会话读取附件 → 当前草稿 owner → 既有 submit → preload/IPC → App Server `turn/start` 或 queue method → canonical Item/media readback。generation 只隔离本地读取；不建立第二套业务后端。
- Happy path：同代读取正常接收并遵守既有容量、格式、路径与文案合同；clear/replace/unmount 后旧 success/error 均不改变新草稿或发旧 toast；下一代仍正常读取。先以 deferred FileReader 复现旧行为，再修复；不从 hook 测试推导跨线程 scope 或跨重启附件持久化已完成。
- Evidence：确定性 hook/DOM 回归必需；GUI 使用受影响真实输入 fixture 验证发送与 Item/media 消费；不跑 live Provider，不形成 packaged/Windows 证据。失败在本地草稿 owner 停止，既有发送失败保留草稿规则仍有效。
- 必跑：两个 hook 及输入消费者定向测试、renderer typecheck、窄 lint；冻结后受影响 Electron 输入 fixture、`verify:gui-smoke`、`verify:local`（Vitest resume）。无 public boundary 变化，不为该切片重复 contracts。
- 场景：P1 首页/会话 rich input 与发送恢复。Supervisor/LLM judge 不适用；回写 deferred lifecycle tests，关闭条件为迟到 success/error 不回流且同代正向接收。
- 架构：非重大，现有附件 owner 内提取共享生命周期原语，目录职责/协议/read model/依赖方向不变；全面 Composer 编辑器结构仍待对齐。

## Composer IME 候选确认 Verification Contract

- 负责人：root，2026-10-14。预算 `budget:normal`，风险 P1。
- 参考：REA initial 六声明 `ev_38693c282fb15af95ea4b8f1caa292ed199fee587ea26d709b126123c3fb8153`；原 initial SHA `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`，cBc UTF16 10282434 检查 event/view composing/keyCode229，uHc 10371337 的 compositionEnd 只更新编辑状态。
- 窄写集：`input-kit/BaseComposer.tsx` 与相邻测试、`Inputbar/inputbarSendPayload.ts` 与发送测试的 trigger union、既有 Electron 输入 fixture 中独立 IME oracle、研究/规则/执行文档。附件由既有 worker 独占；避让外部 Rust/command/approval 脏写集与未知根 JS。
- Current 主链：BaseComposer DOM 编辑 → 既有 InputbarSend → current gateway/preload/IPC → App Server `turn/start` → canonical projection。候选确认不得发出 submit 请求；另一次普通 Enter 或显式按钮仍走既有主链。
- Happy path：compositionstart 内部状态、native isComposing、Process、keyCode229 均保护编辑；compositionend 不安排发送；普通 Enter、Shift+Enter、button/stop 与历史回放保持各自合同。删除 pendingImeSendRef、旧 composition-send 和 ime trigger 类型，不保留 compat；将旧自动发送正向测试迁为负向及随后显式提交正向。
- Evidence：DOM 确定性回归证明下一次 Enter 和显式按钮正常提交；真实 Electron rich-input fixture 以合成 composition/keydown 事件验证无提交请求及 canonical 空历史，随后真实按钮提交并读回同 Thread 的 Item/完整富输入。合成事件不冒充系统 IME 候选窗口或 Codex 实时 GUI 证据；不跑 live Provider。
- 必跑：BaseComposer、ComposerController、InputbarSend/输入消费者定向测试；renderer typecheck、窄 lint；冻结后受影响输入 fixture、GUI smoke、默认本地门禁续跑。P1 多语言输入/意外提交；Supervisor 不适用，失败回写 owner tests 与 Gate oracle。
- 架构：非重大，现有编辑事件与 metadata 合同内收敛，无 public protocol/read model/业务 owner 变化。完整富文本编辑器与 scoped persistent draft 仍单独待办。

## Composer 附件与 IME 冻结记录（2026-10-14）

- 附件：3生产/2测试文件，deferred FileReader 在旧实现中复现12项生命周期失败，修复后两个hook21/21通过；5个输入消费者172/172通过。只隔离回调，不中止FileReader；卸载采用layout cleanup同步失效。日志 `/tmp/lime-attachment-generation-{repro,hooks,consumers,lint}.log`。
- IME：旧pendingImeSendRef、compositionEnd RAF submit、ime trigger类型及旧正向断言已删除；BaseComposer/Controller/InputbarSend 3文件41/41、IME与受影响oracle 6文件157/157通过。未将重叠的InputbarSend用例重复合计。
- 标准typecheck、root窄lint、12项current/dead回流守卫通过；legacy report的零引用/分类漂移/边界违规均为0。新两个研究报告原被research全局ignore覆盖，已加入精确白名单；不纳入原始应用源码或Evidence大包。
- 真实输入Gate：`.lime/qc/gui-evidence/claw-chat-current-fixture/codex-gui-alignment-composer-ime-final-summary.json` 的ok=true、exit0；四类IME信号无submit请求/无canonical Turn，随后真实按钮提交，backend富输入/取消、GUI文字/图片/路径/Skill恢复及read model interrupted均通过。mock/legacy/console/page error为0；合成DOM事件不证明系统候选窗口或Codex实时GUI。
- 实际App Server路径为`lime-rs/target/debug/app-server`，SHA `a2f19d3740d0c1a934a0415ae4b2f7e9f51e3e395cd9a692c48ea34961bf6e45`；pendingQueue/Browser最终Gate也使用prepare后的此摘要。worker此前重建摘要不替代实际Gate摘要，不推导脏树精确源码构建等价。
- 默认门禁 `verify:local` 已退出0：五语言/unused、lint、硬编码扫描、标准typecheck、Vitest 91→121的31批3553项续跑（状态121/121 passed）、contracts、7个受影响Rust crate的3179项测试以及真实Electron GUI smoke全部通过。shell evidence为`.lime/qc/project-gates/standalone-shell-01-20261013203631-5833/shell-01-electron-smoke/summary.json`，含冷reload、3个窗口尺寸、memory设置和真实App Server初始化。日志 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/lime-composer-local-final.log`。
- 本切片current，无新增compat/deprecated；被替代IME行为为dead/deleted/forbidden-to-restore。完整富文本结构、text_elements发送/恢复、持久草稿与全面账本仍未关闭。
- 两项风险切片完成度100%；该百分比仅指上述合同，不作为全面GUI百分比或release/Windows证据。

## 结构化 Composer / EditorView Verification Contract

- 负责人：root协调，lime_gui_comparison负责input-kit文档/状态/serializer/view，lime_desktop_capabilities负责typed submission传输；GUI消费者与测试/fixture分属窄写集，在接口冻结后开启。预算`budget:normal`，风险P1。前一冻结写集的默认门禁已全部通过，不复用为本切片产品证据。
- 参考：main-composer-audit的REA/ASAR identity；观察到ProseMirror EditorView、controller、serializer、keymap、submit-ready、destroy职责。开发源码类名unknown，不妨碍领域结构直接迁移；只确认style/诊断的名称不冒称export。
- Current主链：同一首页/会话ComposerEditor → ComposerController唯一EditorState/document → 同次submit receipt → typed ComposerSubmission → start/steer/queue gateway → preload/IPC → App Server现有UserInput/text_elements → canonical Thread/Turn/Item；恢复只读receipt.draft，发送只读receipt.submission。
- 冻结内部接口：ComposerDocument.editorDocument为严格JSON；display text/selection/mention/textElements/pending paste从唯一PM文档派生。ComposerSubmission为展开paste的text、typed TextElement（最终文本UTF8 byteRange）、typed skill/mention、attachments/path/capability。receipt保留revision与原始完整draft，新增submission；不以展开文本覆盖折叠JSON。SendMessageOptions显式传composerDraft/composerSubmission，不从metadata反推。
- 文档owner：Controller持有EditorState，View只引用该state并回交Transaction；applyTransaction消费全部appended transaction后原子更新revision/snapshot。PM positions、display UTF16和最终UTF8分别映射；不建第二React/TipTap document store。已有`tiptap/pm`足够，不安装/升级依赖，不新增Rust/JSON-RPC字段。
- 窄写集A：input-kit的Controller/types/hook/exports；新schema/serialization/positions/keymap/ComposerEditor及相邻行为tests。避让BaseComposer、产品adapters、wire与fixtures。
- 窄写集B：InputbarSend及snapshot→HandleSendOptions/SendMessageOptions→preparation/execution→buildTurnInput的明确透传、queue的统一serializer与stream恢复draft构造；相邻typed/fixture tests。避让input-kit、BaseComposer、InputbarController/EmptyState/CharacterMention与外部Rust/command脏写集。
- root写集：BaseComposer、InputbarCore/ComposerSection/index/styles、首页/EmptyStateComposerPanel、useInputbarController/HintRoutes/Dictation、CharacterMention及相邻tests/必要领域helper。主textarea/textareaRef/textareaProps/value/selectionStart/setSelectionRange直接迁移为ComposerEditorHandle，不模拟HTMLTextAreaElement。CharacterMention已超过1000行，只拆领域接线，不继续堆业务。
- fixture写集在独立worker登记：仅主输入选择器迁`[data-testid="composer-editor"][role="textbox"]`，普通设置表单textarea保留；40余脚本的value setter/selection/disabled/读取与shared helper同步，DOM操作走真实EditorView事务，不调用测试侧第二业务API或生产mock。
- Happy path：输入、mention/file/skill/plugin atom、长paste折叠/展开、selection、换行/撤销、图片/路径和完整history/draft恢复；start/steer/queue消费同一submission且保留typed ranges。确定失败保留完整draft，旧receipt与旧附件读取不覆盖新代。先复现text_elements/restore丢失，再迁移对应旧正向测试与护栏。
- 键盘合同：IME guard先于mention/hint，检查event/View composing、Process/229；compositionEnd只编辑。hint消费后才history/submit；Shift+Enter换行，普通Enter/button按原canSend/defer/pointer去重/stop合同。paste图片/路径owner先消费，否则统一CRLF/CR→LF、大pasteatom；不允许HTML绕过schema。
- 必跑：Controller/serialization/positions/View事务行为，输入消费者、mention/dictation、typed wire、queue/restore与fixture oracle定向测试；typecheck/lint/i18n；冻结后真实rich-input/IME/active-steer/home输入Gate、current fixture、contracts、GUI smoke与默认本地门禁。source-string或synthetic事件不冒充系统IME/Windows、跨重启或live Provider。
- Evidence：deterministic与GUI trace/canonical readback必需，release-artifact与live/eval不需要；P1输入/错误恢复，Supervisor不适用。故障回写最近owner及产品Gate，禁止为旧selector恢复textarea。完整marks/code-block/链接编辑、voice、跨线程/跨重启persistent rich draft与Queue durable active handoff继续独立登记。
- 架构影响：重大，Renderer document/transaction owner与typed输入数据流收敛；实施同刀更新architecture中的Composer图，root在冻结时核对state、snapshot、wire、恢复与测试门禁并确认。未确认/未取得新Gate不标记本切片完成。

## 结构化 Composer 实施与迁移记录（2026-10-14）

- A：schema/serializer/positions/keymap/Controller/View 的 5 文件48/48；7个消费者149/149；第二批 helper/五语言主输入命名7文件68/68（新增helper18）。各窄lint/diff通过。以上测试集有重叠，不合计成唯一总数。
- B：typed submission→start/steer/queue 显式传输，完整 restoreDraft 深拷，精确 textElements remap、真实接受结果透传与失败重抛；20文件316/316及31文件窄lint通过。旧失败复现4/4保留；不以传输单测代替跨 surface 验收。
- root：BaseComposer、首页/会话/mention/dictation迁至真实Editor；CharacterMention 1408行拆为主组件、选择hook、types和纯helper。root上一聚合3文件104/104通过，之后追加 shared owner/history 接线需 fresh 验证。IME guard先于hint/mention，compositionEnd只编辑；View卸载销毁，不创建textarea适配器。
- fixture：首批72文件迁移，71 mjs语法检查、smokeChecks窄lint、14文件220/220与current-entrypoints16/16。追加完整typed input/same client User Item/media字节/active Steer/独立IME/唯一可见editor oracle：4文件84/84、受影响smoke9/9；未重复220基线。history Gate在同rich场景追加，冻结结果待记。
- dead/deleted：`InputbarPluginBadge.tsx`、`SkillBadge.tsx`及3个旧Plugin文本helpers；catalog为retired-composer-reference-sidecars禁止回流，调用者/tests直接迁。旧主textarea领域名称、styles/ref/props及五语言core.textarea key均直接替换，无新增compat/deprecated。普通设置表单textarea不属于被退役主输入。
- root文档写集：architecture Composer state/transaction/receipt/wire/restoration图、main-composer-audit、design-language、scripts README与本计划。重大架构确认：root，2026-10-14；已核对目录归属、数据流、依赖方向、既有协议边界与验证门禁；实际Gate尚待新冻结产物。
- 1000行例外：EmptyState约1130行，本次仅注入共享Controller与既有资源/历史接线，不继续堆业务算法。能力route UI派生已拆独立hook；退出条件是后续首页能力/推荐逻辑改动先拆领域owner，当前不为行数引入第二store或接口包装。

## 首页/会话共享草稿与接受锁 Verification Contract

- 负责人：B负责既有workspace local display owner/scene与transport；root负责surface props、能力route与资源消费者；A负责Controller hook注入和附件generation。风险P1，budget:normal；沿用上节唯一业务主链，不新增JSON-RPC/Rust字段/依赖。
- 实际缺口：request发布即切首页→聊天，局部Controller和图片丢失；failure只保留string。`return executeSendPlan` 未await导致finally提前释放prepare锁；迟到success能清新surface draft，queue可重复add。先失败复现：6项新断言均失败，日志`/tmp/lime-composer-scope-repro.log`。
- 最小修复：用workspace Controller snapshot替换原input string store，同实例注入Home与Inputbar；materialization preserveInput延续scope，显式导航/new-chat/back-home完整reset并同步清canonical路径。附件直接消费Controller resources，不建空挂载镜像；能力canonical route在同owner，UI候选详情不是第二事实源。
- 接受前同scope互斥；start/steer/queue与local confirmation等待真实返回后finally释放。确定false/reject完整草稿保留，success只有相同revision可commit；外部编辑/restore/reset或surface remount的旧receipt不清新输入，结束后正常重试/下一条仍可发送。
- 必跑：shared hook mount/unmount与严格JSON/资源、deferred true/false/reject、新revision、explicit scope reset与same-scope hydration、materializer preserveInput、queue重复/失败重试；输入消费者history ArrowUp/Down回归；typecheck/lint，冻结后同新版Gate与默认门禁。
- Evidence边界：Gate键盘history检查真实可见token/附件/path/capability与无额外input；hidden paste payload恢复由Controller行为test证明，初始wire另证明完整展开正文。不复制paste原文到DOM attribute以伪造可观察性，不把分层证据提升成不存在的history payload readback。

### 共享草稿补充护栏与新冻结

- A第三批9文件：external Controller不建shadow；两个附件hook直接canonical派生；generation对精确own写入豁免、外部同步重入/reset失效。clear/restore每次force新state/revision，普通同值setText/replaceDocument仍no-op。修前6红/38绿，修后6文件72/72与窄lint/diff通过。
- B第三批19文件：shared workspace owner、显式scope reset、首页materialization preserveInput、await acceptance与统一start/steer/queue pending锁；9文件89/89、追加Reset2/2、19文件lint通过。
- B第四批7文件：usePathReferences删除useState，同步canonical写与snapshot派生；空scope使用clear；useInputbarSend提交瞬间capture canonical资源/route，不回灌旧React props。path/scope旧行为3 fail、send旧closure3 fail；修后3文件26/26及7文件lint/diff通过。
- root移除两surface路径与附件镜像；历史/中断恢复不再clear/add同owner资源，UI直接canonical派生。能力初始化signature与恢复requestId按Controller identity一次消费，避免重挂载回放旧预选/恢复覆盖用户编辑。Home发送同样读取当前文档，restoreDraft严格保留receipt原始route，不从fallback候选重建。
- 新root失败归因：force restore后非稳定effect重复执行导致maximum-depth，已在同Controller恢复request owner加once消费；builtin fallback候选不能改原receipt route，恢复源回到完整原稿。失败日志`/tmp/lime-composer-root-canonical-tests.log`保留，不列成功证据。
- history fixture追加5文件：真实accepted/clear→ArrowUp富草稿→ArrowDown空草稿；可信键盘事件、同session焦点、DOM结构/token identity/PNG字节/path identity/已挂载Skill、canonical与submit trace无新增。77/77新oracle、既有rich合同1/1与syntax/diff通过。真实Gate仍待统一build。

### 结构化 Composer 冻结后验证（持续更新）

- root五核心文件212/212、新增恢复请求重放回归后的Inputbar 92/92通过；标准renderer/node typecheck与窄lint通过。guards273/273、contracts、legacy report通过，后者零候选/分类漂移/违规。测试集有重叠，不合计为唯一总数。
- 删除SkillBadge后唯一unused的`skills.inputBadge.remove`已从五语言`agentSkills.json`清理；i18n完整性与unused检查均exit0。第一次`verify:local`在该unused键失败，尚未形成新编辑器默认门禁成功证据。
- GUI续测事实源移除旧主textarea选择器，改为唯一可见同session的ComposerEditor与真实EditorView编辑；普通表单与TUI textarea不在清理范围。
- 首次新版rich Gate exit1，证据`.lime/qc/composer-alignment-review/rich/rich-summary.json`：prompt、大paste atom与Skill已插入，无console/page/invoke错误；expected `/var/.../SKILL.md`与App Server canonical `/private/var/.../SKILL.md`别名导致严格身份断言失败。夹具将解析实际文件realpath作为同一expected identity，保留错文件/错身份失败，不放宽为suffix检查。该失败不记成功；五语言清理后重新prepare并冻结再取产品证据。
- 追加Skill identity：公开机器name是目录名`capability-report`，frontmatter `Capability Report`是display name；夹具明确机器name/token id/label，DOM/wire/canonical/history共用真实文件identity。同文件别名通过，同名同内容其他文件/missing/wrong identity失败。8脚本冻结，102/102新定向、既有rich合同1/1、syntax/format/diff通过；失败predicate回放保留。生产和App Server未改。
- 新build/prepare exit0，实际二进制与Desktop复制品SHA均为`a2f19d3740d0c1a934a0415ae4b2f7e9f51e3e395cd9a692c48ea34961bf6e45`。新版active Steer、home-hotpath、home-hotpath-greeting均exit0（`.lime/qc/composer-alignment-review/{steer,home,greeting}`）；Steer为runtime+本地provider fixture，typed request/client User Item/同Turn终态保真且无新turn/start或queue；home为external backend，绕过provider执行层。零console/page错误，不冒充live。
- `verify:local`第二次在`InputbarCore.test`迁移后未使用的两个editor工具import处失败，已精确删除并清理旧textarea局部名/描述。后续默认门禁停在22/125：模型设置fixture缺少canonical通知、失败发送测试仍期待resolve，以及Node24原生fetch与jsdom AbortSignal混用。已分别修正合法空ACK/显式canonical通知、reject断言、Host测试的Node环境；完整useAgentChat 187/187、Host 49/49及窄lint通过。生产行为和真实HTTP/PNG缓存断言未放宽，下一次从失败批次resume。
- 图片上传fixture已从错误Core祖先查找迁为实际添加图片按钮→filechooser，并严格核对chooser input属于同session唯一Editor所在Surface。53/53定向及rich合同1/1通过，媒体字节和identity oracle保持严格。
- rich真实历史恢复暴露P1产品问题：CharacterMention将恢复的不可编辑atom标签解析为新提及，捕获方向键后阻断ArrowDown。只读诊断确认Controller历史游标和PM/display文末选区正确，诊断结果不作成功Gate。最小修复只从现有PM文档投影解析候选，并拒绝候选范围与atom重叠，不建第二状态owner、不改serialization或paste源文。
- 新增五类atom的真实EditorView ArrowUp/Down组件回归与atom后新输入`@`/`/`正向；修前4项失败（text_element另改实际展示内容后覆盖），修后7/7，相关21文件162/162。renderer typecheck与四文件lint通过。修前/修后日志分别为`/tmp/lime-composer-history-atom-{repro,fixed}.log`；聚合为`/tmp/lime-composer-history-related.log`。
- 键盘Gate observer修正capture+queueMicrotask提前读取问题，改同Editor后注册的bubble listener同步记录defaultPrevented。55/55脚本定向含6项事件时序回归，trusted/focused/session/严格消费与canonical不变；日志`/tmp/lime-composer-history-keyboard-tests.log`。夹具修复不能替代真实产品Gate。
- 新增跨atom且含emoji的查询边界回归，history组件8/8；全部提及选择动作同样使用atom-aware解析，renderer typecheck与五文件lint通过。fresh rich第一次已证明history键消费、完整可见原稿/资源及返回空稿，但发送接受证据predicate仍失败，`.lime/qc/composer-alignment-review/rich-final/rich-summary.json`保留exit1，不计成功。
- 修复真实质量缺口：Vitest resume只加载旧files会遗漏新增回归，并重跑失败批次之后已passed的批次。既有runner现复用同一collect/live过滤/buildBatches，追加新pending，保留旧批次/开始时间/失败起点并跳过passed。7项真实CLI+fake Vitest行为回归，runner19/19、相关30/30通过；只读preview原125批保留，新增126包含图片上传和CharacterMention.history测试，未修改默认状态。日志`/tmp/lime-vitest-resume-discovery-{baseline,targeted,related,preview}.log`。默认门禁现重新resume，新测试将实际进入执行。
- 该次resume从22运行到34/126，在过期Skills静态guard失败：同session选择器已迁入真实shared helper，但guard的源集合未包含它。仅补`composer-editor-dom.mjs`进入真实依赖集合，原断言保留；完整guard82/82、窄lint通过。日志`/tmp/lime-composer-fixture-selector-guard-fixed.log`。生产mock/唯一owner/identity护栏未放宽。
- 独立review发现P2：send preparation在结构化原稿分支以dispatch备用route覆盖receipt.draft原始route，造成失败恢复丢选择。仅保留原稿route，发送仍用当前dispatch route，非结构化fallback不变。新增3红复现（缺备用、冲突、原稿无route）后preparation8/8及相关14/14通过，原稿JSON/paste与发送/恢复route分开断言；日志`/tmp/lime-composer-receipt-route-{repro,related}.log`。此生产补丁重新开启冻结，需fresh renderer及产品Gate。
- fresh rich发现发送接受oracle混淆原稿与最终dispatch文本：当前installed_skill route在正文前加已确认的`/capability-report `；真实wire/backend完整正文相同，client/canonical/keyboard均通过。期望现在由fixture机器名与展开原稿独立生成，wrong/missing/double前缀、尾缀、截断、status/client、多文本/多request均失败，最终wire的UTF8范围精确匹配；history/rich115/115及窄检查通过。正式rich已执行历史与cancel闭环，但common旧断言仍期待纯PROMPT，正在迁到完整prepared原稿精确恢复；该次exit1不记整体成功。
- 默认门禁第二次续跑至43/126，旧Agent API fixture仍期待不存在的零queue count并把pending queue伪造成canonical Turn。测试迁为真实thread/read合同，独立queue owner保留；不恢复renderer排队历史过滤，不合成零值。Agent API与canonical projection42/42、lint通过；日志`/tmp/lime-canonical-session-fixture-fixed.log`。下一次从43续跑。
- 旧textarea回流护栏的扫描范围遗漏新owner，现只迁该条catalog至完整input-kit与Home EmptyState，普通表单/TUI继续合法。隔离源树真实CLI复现4项漏检后，Editor/Controller/adapter/Home恢复旧路均exit1，真实current/普通表单/TUI源码exit0。相关core/summary/catalog234/234、真实全仓report零违规、lint/JSON/diff通过；日志`/tmp/lime-composer-legacy-guard-{repro,related,lint}.log`。其他catalog并行改动原样保留，无新增compat。
- 生产写集再次冻结，重新prepare后取fresh rich/IME/history、active Steer/home、current fixture、GUI smoke与默认门禁证据。未修改依赖、锁文件、Rust或公共JSON-RPC字段；完整marks/link/code-block、persistent draft与voice仍独立待办。前轮成功不覆盖本次atom-aware trigger改动。

- 最终fresh rich Gate exit0：`.lime/qc/composer-alignment-review/rich-complete-final/rich-summary.json`，68/68，history11项与发送接受14项全部通过。历史导航前后完整输入request各1，无额外start/steer/queue；DOM原稿、Skill/paste identity、图片字节、路径及能力选择保真，ArrowDown回空稿；typed/full canonical/media readback13项通过。same-session唯一可见可用Editor、send-ready、cancel后无正文；console/page/invoke/actionable errors与mock fallback均0。App Server与Desktop复制品SHA均为`a2f19d3740d0c1a934a0415ae4b2f7e9f51e3e395cd9a692c48ea34961bf6e45`。external controlled fixture绕过live provider/runtime prompt lowering；键盘真实，IME/paste为synthetic DOM事件，hidden paste源文恢复由Controller tests证明。脚本134/134与场景合同1/1通过；`/tmp/lime-composer-rich-complete-final.log`为实际进程日志。
- 默认门禁第三次续跑至52/126，external controlled pending Queue Gate未登记进后端边界精确白名单。只在`appServerRuntimeBoundary.testSupport.ts`追加既有`thread-queue-gate-b.mjs`及相邻测试两条精确路径，未放宽生产默认runtime或目录范围。backend boundary与Queue Gate tests7/7、窄lint通过；日志`/tmp/lime-external-fixture-registration-{fixed,lint}.log`。新版默认门禁继续从失败批次resume。

- 默认门禁第四次续跑至72/126，inputRestoreGuard漏登记统一`composerDraftRestore`，且旧UI直写字符串扫描已无实际命中。迁为两UI只能委托同一helper、Controller.restoreDraft只能在helper写入的非空owner断言；仅增加helper精确路径，不扩大目录。guard与首页/会话恢复行为157/157、窄lint通过，日志`/tmp/lime-composer-restore-owner-guard-{fixed,lint}.log`。产品写集保持冻结，继续resume。

- 默认门禁第五次续跑至73/126，workspaceBoundaryGuard仍强制旧input useState。迁为共享Controller hook、snapshot派生、canonical setText/clear合同，并用regex禁止旧独立input store回流；不改变布局/Banner或runtime truth边界。guard与共享hook/显式reset19/19、窄lint通过；日志`/tmp/lime-composer-workspace-owner-guard-{fixed,lint}.log`。

- 剩余未通过批次中的Composer source/contract护栏完成只读复扫；风险相关5文件16/16，未发现其他旧textarea/badge或独立生产input/resources正向要求，日志`/tmp/lime-composer-remaining-source-guards.log`。行为夹具的useState不是生产owner回流，不误删。旧codex-app GUI文档与执行计划导航已明确迁为历史基线，current实施入口唯一；未接管global/CLI/TUI并行进度。

- 默认门禁第六次续跑已通过前端126/126批（包含resume追加的新回归文件）与contracts；当前继续执行工作树受影响的7个Rust crate和GUI smoke。日志`/tmp/lime-composer-local-resume-final-6.log`尚未退出，不记完整默认门禁成功。

- 默认门禁第六次exit101：agent-runtime211/211，App Server1855通过/1失败，`json_lines_loop_streams_turn_failed_after_partial_external_backend_events`等待JSONL输出超时。未改产品终态、超时或断言；正在从仓库Rust测试入口定向复现并区分调度/fixture与runtime缺陷。首次直接cargo遗漏仓库V8 resolver，下载404，日志`/tmp/lime-app-server-partial-failure-targeted.log`不作该测试结果；已改用`test:rust:unit`，GUI smoke尚未执行。

- 正规单项Rust入口1/1通过，日志`/tmp/lime-app-server-partial-failure-owned-targeted.log`；整包超时原因仍未知，不以单项替代整包。一次直接test artifact诊断缺少Cargo dylib环境而dyld退出，`/tmp/lime-app-server-partial-failure-built-artifact.log`仅为setup失败。新版聚合首次在首场景初始化前因raw target/debug/app-server不存在而exit1，`/tmp/lime-composer-current-fixture-final.log`与unknown-item失败summary留存，不计产品通过。Desktop冻结复制品仍存在且SHA仍为`a2f19d3740d0c1a934a0415ae4b2f7e9f51e3e395cd9a692c48ea34961bf6e45`，后续以它作为明确APP_SERVER_BIN，不重建或伪造raw路径。默认门禁第七次启用明确Node24与backtrace继续验证；产品/超时/断言未变。

- 默认门禁第七次fresh前端125/125、contracts与7个Rust crate共3179/3179通过：agent-runtime211、App Server1856、lime-agent278、lime-mcp174、lime-scheduler36、lime-server119、tool-runtime505。前次partial external JSONL失败项本轮整包通过，原一次等待超时原因仍unknown；未提高timeout或修改assert。GUI smoke开始合法重建sidecar，最终需要重新记录实际产物SHA与exitcode。
- raw binary只读bounded调查未找到明确删除consumer：fixture仅清lock、assets清dist目的且禁止source/dest相同、V8/sherpa清下载缓存与临时解压、Rust destructive调用所读48文件只清测试资源；本地Rust入口为cargo test --lib且没有cargo clean。无系统调用或进程追踪，Cargo/并行进程归因unknown，不按mtime推断。本轮没有保留该调查的产品或文档改动。

- 完整默认门禁第七次exit0，日志`/tmp/lime-composer-local-resume-final-7.log`。fresh前端125批共12220个通过test instances、1671个报告通过文件；与前次resume的126批分母不同，不混用。contracts与Rust3179通过后GUI smoke24/24，证据`.lime/qc/project-gates/standalone-shell-01-20261013234813-36535/shell-01-electron-smoke/summary.json`：真实Electron/preload/IPC/current App Server、reload与3个viewport通过，所有console/page/invoke/preload/renderer/trace/legacy/mock错误计数0。GUI smoke合法重建raw与Desktop复制品后，两者实际SHA均为`4d213628b3dc459ec1bfafe4ec08ec1b2c2db933bb2e55dd8836194124e4603a`；这不是前轮rich的旧SHA，后续场景必须记录自己的产物。新版聚合以明确Desktop `APP_SERVER_BIN`串行执行，日志`/tmp/lime-composer-current-fixture-final-2.log`，目前未退出，不提前记22场景通过。

### 下一刀补证：scoped persistent draft

- 独立只读REA与Lime存储/导航调查完成，无产品实施；[保存审计](../research/codex-desktop-rea/composer-draft-persistence-audit.md)与Evidence索引记录`ev_6ac3324c94242434149d9b820ee6cecdc0165021adadac0bdca91254ab787c29`，37 inert声明、structural complete/semantic unknown、parse失败0。
- 上游两个key保存PM JSON/prompt/plainTextMode；document change合并发布、删除立即发布、dispose retained、pagehide/reload flush及main persisted atom同步有静态anchors。client/canonical local双写与home/cloud scope明确；真实重启/耐久性/完整资源保存unknown。
- Lime目前没有keyed Controller草稿或持久store；TaskCenterDraftTab仅导航metadata，transcript cache与promptHistory不是未发草稿owner。两条首发materialization和无draft首页分支都需转绑定；sessionId和canonical threadId须显式区分，不可用restore改变待接受receipt revision。
- 候选实施必须先登记新Verification Contract、唯一scope/I-O owner与架构图；不借用provider UI state、不预建runtime、不在现行Editor Gate期间夹入产品变更。已有存储封装quota删除重试与无成功结果需先修合同，跨重启附件不得用预览图或内存结果冒充。

### 下一刀补证：整条 UserMessage 折叠

- [用户消息补证](../research/codex-desktop-rea/user-message-collapse-audit.md)与索引已落仓；两个 parent Evidence 均为选定范围 structural complete / semantic unknown、parse failures 0，不运行目标。普通正文消费完整text字段，默认20行实测高度折叠，不能据此制造逐paste chip。
- 名称只确认member stem `collapsible-user-message-content`、压缩绑定`v as t`与exports n/t；候选`CollapsibleUserMessageContent`是同职责领域命名，不声称恢复原开发符号。
- current canonical用户正文在`ConversationTurnTimeline`直接走Markdown，`MessageUserBody`承接message_group另一入口；实现必须覆盖两者。复用MarkdownRenderer、VirtualizedTurnList的现有ResizeObserver与scrollController.holdViewport；不新增高度cache、消息store、协议或runtime。
- 候选最窄写集为新折叠组件/相邻tests、两正文入口、MessageList/MessageListItem的callback透传与五语言agentMessageList.json；实现前另填Verification Contract。复制/编辑继续使用完整原文，图片/Skill标签留在正文折叠之外。代码块裁剪、隐藏交互焦点、内容/宽度重测与find reveal按可确认合同逐项验收，不能以字符数估计高度替代。
- 当前只读准备完成，产品尚未实施；需在结构化Composer新版聚合/默认门禁关闭之后开启。参考窗口表现及未穷尽producer/Markdown分支继续unknown。

### 正常 UserMessage inline 引用追加补证

- 同摘要成员的普通exact AST闭合正常Markdown link token→Skill/plugin/app专用consumer链；新REA只核对primary Hd身份项1/1963，返回形状仍unknown，不能当完整模块语义。审计与索引保存4个成员SHA、12 exports、10 imports、30声明范围与37 anchors。
- Skill按规范化href/path或无href时名称唯一匹配catalog才绑定身份；保留label/href/copy属性与条件侧栏导航。plugin/app有独立URI/host/metadata consumer。裸$skill、producer→wire→history、复制回贴与真实点击仍未闭合。
- 旧“正文下层Skill/mention未知”已由这条静态consumer补证局部推进；原typed sidecar不直接进入字符串的观察仍成立。Lime已有Composer atom、typed wire和单个route标签，不足以证明正文内联身份回放已对齐；产品迁移继续独立待办，不改wire或伪装任意label。

## 长 UserMessage 折叠 Verification Contract

- 负责人：root；登记：2026-10-14。预算 `budget:normal`，风险 P1。开启条件已满足：结构化 Composer 的新版 current fixture 聚合与完整默认门禁均 exit0；当前切片已开启。
- 参考：[整条用户消息审计](../research/codex-desktop-rea/user-message-collapse-audit.md)的两个 REA parent 与同摘要精确 AST。确认 member stem、20 行实测阈值和整条正文折叠；原开发 export、精确裁剪样式与目标应用真实交互仍 unknown。`CollapsibleUserMessageContent` 为本地职责命名，不写成 confirmed upstream export。
- 产品窄写集：新正文折叠组件及相邻行为测试；`ConversationTurnTimeline` 与 `MessageUserBody` 两条正文入口；`MessageList`/`MessageListItem` 只透传既有 `scrollController.holdViewport` 与 focused Item/reveal token；五语言 `agentMessageList.json`。如 installed Skill 分支正文需拆分，只改 `MessageListUserContent` 中同一正文接点，标签和图片留在折叠外。不修改 Markdown wire、Composer、runtime、store、协议、未知 Rust/approval/command 改动。
- Current 主链：既有 typed submit 或历史读取 → Electron preload/IPC `app_server_handle_json_lines` → App Server `turn/start`、`turn/interrupt`、`thread/read` → 同一 canonical Thread/Turn/Item → `canonical_turn` 或 `message_group` → 现有 Markdown/纯正文 renderer → 显示折叠。折叠只拥有局部显示与焦点状态；没有新的 gateway、runtime event、tool、approval 或 artifact。
- Happy path：全量正文布局高度严格超过 `20 * lineHeight + 1px` 才显示初始收起和切换按钮；短正文无按钮。正文/字体/宽度变化重测并尊重用户展开选择。折叠不裁掉源字符串，不改变 typed ranges/媒体/引用身份；复制与现有编辑仍传全文。
- 焦点与列表：按钮支持真实 Tab、Enter、Space 与准确 `aria-expanded`；被遮挡的互动元素不可聚焦，可见互动元素保留可达。收起时若焦点即将被隐藏则回到切换按钮。使用现有 virtual row ResizeObserver/anchor 算法，切换前 holdViewport；不加第二高度 cache。现有指定 Item 导航与浏览器 find reveal 的支持范围需由实现和证据明确，不能默认宣称全部覆盖。
- 定向回归：严格阈值上下 1px、软换行、代码块跨边界、正文/宽度重测、展开偏好、内容身份更新、observer 清理、隐藏/可见链接焦点、全文复制/编辑、两个入口与五语言。护栏验证两入口共享单一正文 owner，不保留字符数截断或平行用户正文实现。
- Electron 窄写集：rich 场景只接独立 collapse helper；launcher/scenario-flow 仅传测试侧 clipboard reader；相邻 oracle/tests；session-history long-list fixture/oracle/runner补非尾部 canonical 长正文、冷启动、焦点与相邻锚点。全新 helper 进入既有 `scripts/agent-runtime/` 或 `scripts/electron/lib/`，不得新建脚本领域或产品 IPC。
- Gate B：每条可见 bubble 要关联 ancestor `data-render-entry-kind`、exact Turn/Item、唯一 user bubble；canonical 另核 `data-direct-segment-kind=message`。rich 历史68/68未采该入口，且 itemId 为 null，不能据旧 readback推断其 renderer。真实点击/键盘后采 ARIA、实际几何与尾部；两状态用 Electron clipboard精确比对全文，仅落长度/hash/布尔证据。若 rich 实际走纯正文，只证明该入口；链接焦点由 canonical long-list补证。
- 锚点与业务不变：真实 wheel进入距底大于64px旧历史，切换前后比较 surviving first-visible Turn key与viewport-relative top，后继row offset跟随实际高度且不重叠。完整trace禁止新增 `turn/start`、`turn/steer`、`thread/queue/add/update/start`；再次thread/read核正文/content parts/text elements/client/Item/Turn一致。缺trace、错入口/Item、只改ARIA、截断copy、隐藏链接可聚焦、锚点漂移或相邻重叠均失败。
- 必跑：受影响 component/projection/oracle tests、renderer typecheck、窄lint/i18n、legacy report；冻结后rich与long-list真实Electron场景、current fixture、GUI smoke与默认本地门禁。未改public boundary时不重复contracts；无live Provider、Windows/packaged或参考应用实时证据。
- 架构影响：非重大，renderer在两条既有正文路径复用单一局部显示组件，原投影/持久化/测量/滚动owner与依赖方向不变。实施结束复核实际调用图，若引入跨层owner改变则重新登记并更新architecture图。
- 退出条件：两个入口与所有调用者迁移、有效旧测试/fixture/护栏同步、定向和真实证据通过。Skill/plugin/app专用inline consumer、persistent draft、marks/voice与其他全面账本不在本切片完成分母。当前产品/新Gate完成度0%。

### Composer 切片关闭与长正文实施记录

- 新版聚合exit0，22/22实际Electron场景成功，所有声明assertions为true；证据快照`.lime/qc/composer-alignment-review/current-fixture-complete-final/aggregate-summary.json`及各场景summary，日志`/tmp/lime-composer-current-fixture-final-2.log`。实际backend SHA仍为`4d213628b3dc459ec1bfafe4ec08ec1b2c2db933bb2e55dd8836194124e4603a`；21个Claw场景明确mock/legacy计数0，Coding场景缺独立mock计数字段，不伪填0。全部console/page errors0、noInvokeErrors true；runtime场景使用本地provider fixture，其余external绕过执行层，liveProviderUsed=false。聚合通过不扩大各子场景合同。
- 结构化Composer当前实施合同（唯一Controller/EditorView、typed submit、共享surface草稿、接受锁、atom历史与receipt恢复）100%关闭；marks/link/code-block、跨重启scoped草稿、voice及任意正文inline引用consumer仍在待办。全产品不提供无明确分母的百分比。
- root认领两正文入口、tagged正文、MessageList/Item回调/准确identity接线、五locale及相邻integration/纯identity回归。组件归lime_gui_comparison，rich归composer_fixture_migration，long-list归lime_desktop_capabilities；产品开启前草稿只在/tmp，未夹写冻结产物。
- 新共享组件从自然full root读取实际lineHeight；内层RO、同高度异步descendant变化MO、隐藏互动inert/原值恢复、焦点preventScroll、递增reveal去重。MO缺口先红复现后修复；组件11/11与窄lint通过。用户展开选择只在当前实例保留，虚拟卸载后重挂与冷重启默认重置；尚未声称跨卸载选择持久化。
- 两入口的复制/编辑保留现有完整字符串，tag/image在折叠外。用户bubble identity纯转换移入`messageItemIdentity`，精确Item/client匹配并去重；同Turn多User未匹配或重复client时fail closed，不取第一项。根写集78/78（含组件11、identity6、integration11和既有消费者50）与标准typecheck通过，日志`/tmp/lime-user-message-collapse-{related,typecheck-final,root-lint}.log`。首次误用不存在的Vitest配置为setup失败；首次integration两用例被canonical投影吞并，改为纯identity测试与合法local正文reveal，不恢复错误renderer路径。
- 新脚本治理通过：`/tmp/lime-user-message-collapse-scripts.log`；未新增根脚本或一级领域目录。rich 首命令因误传 `--output-dir` 在参数解析阶段退出，未启动 Electron，不算产品失败；改为 `--evidence-dir` 后真实 Electron 已启动，但共享 trace oracle 错误要求所有 current request 显式携带 `jsonrpc: "2.0"`，合法 sender 的缺省版本被拒绝。日志 `/tmp/lime-user-message-collapse-rich-gate-2.log`；失败证据 `.lime/qc/user-message-collapse/rich-final/user-message-collapse-rich-final-summary.json`。仅修复 oracle 对合法协议形状的识别，保留错误显式版本、截断/饱和、解析遗漏和输入 mutation 的负向门禁；真实 rich 与 long-list 尚未通过。
- 缺省版本修复已冻结，current envelope 与既有 oracle/parser 合计243/243通过；实际 schema fixture 明确 `sendsJsonRpcVersionField=false`。历史 rich trace 达240条，不能凭过滤后的 request 数绕过完整性要求；增加仅测试侧的连续 append 观察，保留原 native Storage 调用语义，并以同一 observer run identity 校验 baseline/final 完整前缀；原 ring 模式饱和仍失败。长历史首跑的原滚动/分页 oracle通过，但新 probe224不在实际已加载227–240区间，故退出1；改为已加载非尾部 probe并保留前后邻居、真实 wheel 与冷启动合同，不能延长 timeout 或模拟滚动/历史请求。日志 `/tmp/lime-user-message-collapse-long-list-gate-1.log`；失败目录 `.lime/qc/user-message-collapse/long-list-final/`。

- 连续 collector/rich 写集于 `2026-10-14T00:44:42Z` 冻结，6套286/286通过；manifest `/tmp/lime-user-message-collapse-rich/continuous-collector-write-set.json`。collector仅测试侧连续观察 native Storage，独立重算每次 append 的前后 ring/hash，seed不算accepted input，hook丢失/非法写入/reset/restore失败拒绝通过；raw ledger只驻内存，证据仅留模式/run identity/count/hash及实际 `nativeRestored`。
- long-list 写集已冻结，5套本体186/186与共享collector69/69（初次teardown错误修复后复跑）通过；9文件lint/格式通过。probe统一232，实际检查末页声明和mounted canonical tail，再以真实wheel验证231/232/233；正文UTF16 9682、UTF8 17673，SHA-256 `2d26958c2e7f9e8fad508f835b9e4f145b2580ff4e5f525339afaec0590002a1`。runner最小消费pure白名单失败extractor，不落正文。产品15文件摘要存 `.lime/qc/user-message-collapse/product-write-set.json`，raw与Desktop App Server仍同SHA `4d213628b3dc459ec1bfafe4ec08ec1b2c2db933bb2e55dd8836194124e4603a`。新的真实Gate正在重跑，不能将以上unit/integration计作Electron通过。

- 新rich真实运行仍exit1：连续collector32733次append、`complete=true/nativeRestored=true`，但初始collapsed几何未达合同；console/page errors为0。日志 `/tmp/lime-user-message-collapse-rich-gate-3.log`；证据 `.lime/qc/user-message-collapse/rich-continuous-final-1/`。新增safe失败extractor21项与既有测试合计277/277通过，只补取证，不放宽identity/几何/timeout。
- 新long-list真实运行exit1：进入已加载probe时工作区触发React #185更新循环，frame消失，故报wheel scope不匹配。safe诊断记录进入前准确session、14-entry末页、canonical tail240与连续trace无mutation/错误、native恢复；不能将scope消失误记夹具通过。证据 `.lime/qc/user-message-collapse/long-list-continuous-final-1/`；开发构建 `.lime/qc/user-message-collapse/long-list-debug-1/` 复现Maximum update depth exceeded。当前定位虚拟行重挂时full→collapsed高度与同步range/anchor的反馈，需完整堆栈与先红回归确认，尚未修产品。default/current-fixture/GUI smoke本切片均未开启。

- 开发构建第二次复现的完整stack `.lime/qc/user-message-collapse/long-list-debug-2/` 指向 `CollapsibleUserMessageContent.measure` 的 `setMeasurement` 与同步layout effect。组件owner认领原两文件，候选最小修为dispatch前同值ref guard、同步测量不依赖每次父render的新children对象；真实DOM变更继续由RO/MO重测，inert/reveal/20行合同保持。定向先红回归需区分重复测量触发路径与真正#185复现，真实dev及fresh packaged Gate负责关闭bug；不提前写已修复。

### 长正文动态测量反馈修复（2026-10-14，进行中）

- 组件最小修已冻结：dispatch 前使用 measurement ref 拒绝同值，同步 effect 不再依赖父层新建的 children JSX；真实子树变化仍由 MO/RO 测量。组件与现有列表/接线 31/31，通过不代表真实更新循环已修，dev Electron 仍失败。
- 新父层回归 `VirtualizedTurnList.measurement.component.test.tsx` 已直接先红复现 Maximum update depth exceeded：阅读锚点 turn-10 顶部 -40px，上方 overscan 中 turn-8 实际行高从 1200px 降至 224px，经父 RO 测量后 mounts=18/unmounts=18。真实 React、现有折叠组件和虚拟列表，仅为 jsdom 注入几何/RO；断言 DOM identity、锚点与挂载次数，不复制保锚算法。root 复跑失败日志 `/tmp/lime-user-message-collapse-parent-red-root.log`。
- 测试侧被动 native-full-rect-call 采样已冻结，三文件窄写集：long-list input helper、geometry 白名单、新相邻 input test；4套78/78和 lint/格式/语法通过。最多300条、WeakMap mountId、错误时同步冻结、退出恢复 native；计数仅针对有界窗口，completeHistoryClaim=false，不宣称所有调用均由组件 measure 发起。
- root 下一生产窄写集为既有 `VirtualizedTurnList.tsx` 的 render range 接点及上述相邻回归；不改共享协议、runtime、scroll owner 或增加高度 store。候选为 layout 变化时先复用 preserveThreadAnchor 求与新 layout 一致的 range top，既有 layout effect 继续提交实际滚动；等待 dev 被动采样再实施。所有 frontend/test 写入在真实运行期间冻结，避免 Vite reload 污染证据。
- 本轮未关闭项仍为 fresh rich、long-list/cold restart、current fixture、GUI smoke 与 verify:local。旧 15 文件源码摘要已因组件修复失效，收口时重新生成。
- 原生 dev 采样失败证据 `.lime/qc/user-message-collapse/long-list-native-debug-1/`：176次调用、172个mount、10个identity重挂，dimensionChangedMountCount=0/oscillatingMountCount=0；probe232反复新mount且自然正文8301.109375px保持不变。采样窗口不证明完整运行历史，摘要samples另受安全白名单有界输出限制；native已恢复，错误明确为Maximum update depth exceeded。
- root最小修已落在原range接点，仅对pending layout使用既有preserveThreadAnchor或新tail top选窗口，不在render更新旧基准或滚动。先红1项修后通过，相关列表/几何/组件24/24、两个consumer/identity17/17及四文件lint通过。dev真实复跑进行中，仍未声明产品bug关闭。
- 修后dev `.lime/qc/user-message-collapse/long-list-native-fixed-1/` 到达collapsed-copy：console/page errors均0；29次native调用、12个mount、remountedIdentityCount=0。因测试用无用户手势navigator.clipboard.writeText设置sentinel被权限拒绝而exit1，不能算完整Gate通过，也尚未证明产品copy成功。标准typecheck exit0；下一步把测试sentinel与finally恢复接到Electron main clipboard，真实按钮与全文readback仍为产品oracle，不修改权限或增加renderer fallback。
- 新pending导航竞态回归已冻结：同一probe收缩期间目标DOM/位置稳定；真实owner的RAF提交后target top=10px且请求完成，后续用户滚75px旧请求不回拉，第二次导航仍对齐。5文件36/36、相邻lint/格式通过，无sleep或timeout放宽；测试与先前结果重叠，不相加为唯一总数。fresh packaged renderer已开始构建。
- 同步更正GUI E2E规则中强制显式jsonrpc版本的过期断言，按生成schema与current sender接受缺省或显式2.0，仍拒绝错误版本；不改变协议、客户端或production authority。
- fresh renderer构建exit0（33.98s），复用已新鲜的Host/sidecar；源码17文件与三个宿主产物摘要 `.lime/qc/user-message-collapse/product-write-set-after-anchor-fix.json`，renderer全文件摘要 `renderer-artifact-after-anchor-fix.json`。snapshot复核无漂移，raw/Desktop sidecar仍同SHA。legacy report零候选/分类漂移/违规、脚本治理、父接点格式、文档护栏12/12均通过。
- long-list main clipboard接线三文件已冻结，14/14定向与lint/格式/语法通过；writer只设置sentinel和恢复，真实产品按钮产生正文，shared main readback继续核完整hash/length。该定向是controlled callback接线证据，不计实际OS/Electron复制成功。
- rich/shared七文件于2026-10-14T02:20:41.624357Z冻结，6套319/319与lint/格式/语法通过，manifest `/tmp/lime-user-message-collapse-rich/host-clipboard-write-set.json`；缺回调、读失败/nontext、sentinel未交付、截断、按钮失败、恢复抛错/读失败/不匹配和双重异常都拒绝成功。旧helper page参数与renderer写剪贴板已删除；finally写回后另从main验证恢复。root核对manifest无漂移，fresh packaged long-list已启动。
- fresh packaged long-list第二轮exit1，`.lime/qc/user-message-collapse/long-list-packaged-2/`：准确collapsed几何与邻居挂载通过，console/page errors0，随后真实产品按钮copy未满足全文hash/length。main sentinel准备已成功，不能把该失败再归为fixture写入权限；具体是clipboard rejection、错误正文还是交互反馈尚待安全观察确认。末尾scope仍正确，用户wheel引发的有界重挂不等于之前同步#185。新fresh rich正串行执行；所有product/scripts写集在运行期间冻结。
- fresh rich第二轮exit1，`.lime/qc/user-message-collapse/rich-packaged-2/`：同一canonical Item/client同时出现canonical_turn正文（collapsed/root1）与message_group空壳（root0/26×14px）；严格唯一identity拒绝通过，不能放宽matcher只取正文。源码确认canonical已经消费同一user image；纯projection复现为inputCapabilityRoute单独保留导致残留空bubble，并非图片未消费。capabilities认领projection与相邻ownership/userCollapse三文件，只迁移canonical已拥有user的route残留，不动其他richsurface或无canonical本地消息；media_reference重复候选单独登记。
- Clipboard原生观察收敛为测试侧sharedhelper及相邻observation、long-list安全失败字段，不新增Host callback/权限/reader API。原promise/this/args/同步异常保持，侧链记录安全错误enum且清理恢复；观察引入rejection handler的微任务边界要注明。实际write错误确认前不改产品权限。
- route残留三文件已冻结：projection只在exact canonical user-owned residual清inputCapabilityRoute，其他富surface与无canonical local消息保持；先红3fail，修后ownership/projection/userCollapse/directTimeline四文件53/53、三文件lint/格式/diff通过。新集成证明同client/Item只有1bubble/1正文/1图片/1copy，两个typed标签与完整copy/图片preview身份不丢。未改directTimeline既有脏补丁。此前17文件源码快照已因projection与userCollapse变化失效，后续重新取新的摘要和renderer构建。
- 同边界独立待办：collectCanonicalMediaKeys未覆盖user image parts，可能产生同引用residual media_reference；尚未修改，不由route修复计作关闭。Clipboard补证已记录于user-message-collapse-audit：main存在readText/writeText宿主服务，但普通UserMessage完整caller链unknown，不把sandbox的权限策略移植到主窗口。
- route修复后的renderer构建与标准typecheck均exit0，日志分别为`/tmp/lime-user-message-collapse-renderer-after-route-build.log`和`/tmp/lime-user-message-collapse-typecheck-after-route.log`。测试侧原生clipboard observer正在最终冻结：保持native this/全部参数/同步throw/原Promise，安全proof区分实际仍为sentinel、全文不匹配及权限/焦点错误；观察侧链会增加rejection handler和微任务，不冒称完全无影响。待真实错误证明后再决定产品权限或fixture焦点的最小修复，当前未修改主窗口permission owner。
- clipboard观察11文件已最终冻结，8套258/258、lint/格式/11项Node语法与窄diff通过；manifest `/tmp/lime-user-message-collapse-rich/passive-clipboard-write-set.json`，SHA-256 `2082c12413842eacd391acaad8654454f3b243e0a549d0e65d1abeaee61761ed`，root复核全部11项无漂移。rich聚合oracle失败时未带成功返回phase proof是已登记的诊断限制，不影响long-list本次取证。fresh源码19文件与renderer3190文件快照分别为`.lime/qc/user-message-collapse/product-write-set-after-route-fix.json`、`renderer-artifact-after-route-fix.json`；旧快照保留，不覆盖。真实long-list第三轮已启动，目录`long-list-packaged-3`，未预判结果。
- long-list第三轮exit1，真实native proof为唯一writeText调用、全文9682字符且expectedTextEqual=true、原receiver、focused/visible/userActivationActive全部成立，但NotAllowedError rejected，实际main read仍为sentinel。observer intervalComplete/nativeRestored=true，console/page errors0。errorKind未知，不擅自重写成已捕获permission-denied；结合生产permission policy明确拒绝clipboard-sanitized-write，进入最小权限修复并由fresh成功验证因果。
- 权限修复窄写集：comparison worker仅迁移`electron/mainWindowMediaPermissions.ts`及相邻测试为`mainWindowPermissions.ts`/`.test.ts`，唯一策略同时承接request/check；root仅迁移`main.ts` import与安装两处，保留原browserTabOwner脏补丁。主window主frame允许sanitized-write，读/其他window/null/child/unknown拒绝，媒体保持原能力并区分request数组/check单值，不改embedded browser独立session，不加clipboard IPC/fallback。非重大架构变更，仍由既有Desktop Host permission owner管理；退出条件为先红回归、定向/Host typecheck、fresh Host、真实全文copy及对应门禁，无Windows实跑声明。
- 权限模块迁移已冻结：旧策略27项中7项先红，迁移后permission27 + windowOptions7 + loadErrors3合计37/37；两文件lint/格式、完整Electron typecheck均通过。模块SHA `b98655e57bd66ee3b5388f327096feb0ac50a91e2b01b066c310a755f158e6d0`，测试SHA `a5eca6f91b68de7163346f5fae8ce21952f6eb6dd50c35f8fffd866621150643`；旧文件/符号在Electron中无残留，无alias。root增加测试侧native query helper和相邻oracle测试，session-history入口只接import/call；query主/child secure context与读写状态，不读剪贴板内容、不替换handler，finally移除iframe。17/17和root窄lint/格式通过，真实query与copy待fresh Gate；另window只由策略/handler回归覆盖，不把query结果扩大为实测。
- tests/guard只读审计未发现产品旧文件名锁定，当前DOM字段服务真实几何和identity。generic collapse oracle合法支持两正文入口，继续保留其message_group正向；rich accepted canonical wrapper需额外明确canonical_turn，避免canonical退回local仍过验收。fixture worker认领shared helper/evidence与相邻rich行为回归，同时修复聚合失败遗漏安全clipboard phase proof；不改产品或long-list已冻结写集，不以源码字符串guard代替实际helper行为。
- 同user裸图片media_reference的只读probe已定位独立缺口：相同exact Item/client与直接image URI应由canonical接管，当前仍留下空residual；caption、audio kind、不同URI、refId读取owner、assistant同图说明均需保留。该候选尚未产品实施，不无条件扩全Turn URI集合，不将sidecar缩略图成功当作点击预览职责等价。
- 同Item裸图片去重补刀已认领原projection/ownership/UserCollapse三文件，写窗口与Electron permission互不相交。合同只覆盖exact canonical user owner的同一直接图片裸引用；caption/title、refId/sidecarRef/sha256/byteSize、不同previewUrl、MIME/定位冲突、unknown kind以及assistant同图语义保留。先红空残留与保护变体后最小修，不增加第二投影owner、不扩全Turn媒体集合、不碰directTimeline旧脏补丁；定向集成需继续锁一bubble/图片/copy与原preview identity。其他typed媒体职责不在本补刀完成分母。
- 同Item裸图片三文件已冻结：先红3fail后projection/ownership/UserCollapse/directTimeline四文件77/77；自有三文件lint/格式/diff通过。projection SHA `740b58aa3a880dd86f00a695a6560057ddd165f1dc43f089345c50e58ea28c1f`，ownership `15014d8ee3f41dcca92741480195423d0ee22f83af333638a54e29c7d730fe65`，UserCollapse `dfd53221e27e78982b31c3d7564eba7c5d83dd7705dfc0a80c95604f43fb7f48`。匹配仅直接URI，额外已定义字段/未知字段与sidecar保留，不扩大媒体职责。
- rich测试侧owner合同与安全phase补证已冻结：7项先红6失败、generic message_group1通过，最终5套184/184与lint/格式/3项语法/diff通过。manifest `/tmp/lime-user-message-collapse-rich/rich-canonical-phase-proof-write-set.json`，root核对3文件无漂移。generic两入口正向继续有效；rich wrapper要求canonical_turn，aggregate与native复制失败只保留安全clipboardPhases。前一passive manifest的shared helper摘要已被此新manifest取代，不覆盖历史快照。
- fresh Host/renderer均exit0，main新SHA `9401e36c299c48f1032061406a561b1a27d7e60240953ee5ddb646d0df108003`；raw/Desktop App Server仍同SHA `4d213628b3dc459ec1bfafe4ec08ec1b2c2db933bb2e55dd8836194124e4603a`。新immutable源码22文件与renderer3287文件快照为`product-write-set-after-permission-fix.json`/`renderer-artifact-after-permission-fix.json`，query窄写集另存`permission-query-write-set.json`。root当前rules/docs guards23/23、脚本治理均通过。
- fresh long-list第四轮exit1，目录`.lime/qc/user-message-collapse/long-list-packaged-4/`。主window query write=granted/read=denied，child write/read=denied且均secure、iframe已移除；query只证明check。collapsed/expanded两个严格全文copy阶段均通过，最后原生write fulfilled、全文9682/hash一致、nativeRestored=true；权限修复已有真实因果补证。随后collapse-anchor失败：收起前first-visible successor233 relativeTop=-8.03125px/scrollTop9714.5，收起后first227/scrollTop0；console/page errors0。冷启动尚未执行，不算Gate通过。
- 新锚点修复写集：comparison worker仅在`VirtualizedTurnList.measurement.component.test.tsx`模拟浏览器随DOM总高收缩clamp scrollTop，保留真实React/现有virtualizer与折叠组件；0/非零prefix两变体先红，不复制保锚算法。root生产只认领原`VirtualizedTurnList.tsx` layout effect，候选直接提交`currentOffset + nextTop`以免在已clamp位置重复扣高度delta，并移出无用offset ref。现阶段为候选，不先写已修复；真实successor/cold Gate负责关闭。

- clamp回归先红完成：14条、prefix0/160两变体均被合法layout clamp780px，anchor DOM保持但top从-40变740；原30条overscan与pending导航均绿。root在原effect直接提交currentOffset+nextTop，删除无用previousOffsetRef；修后5文件40/40、生产/测试窄lint和格式通过。新增测试初始化已有一次probe卸载，绝对unmount=0误断言改为折叠前后无增量，DOM/top/clamp/mount其余oracle保持。测试SHA `4716403682585300138c0d1922968c193a679fb4055cd1c41d714661762e3a68`。单位回归已关闭clamp缺陷，fresh真实Gate仍待验证；renderer重新构建与标准typecheck正在执行。

- fresh renderer与标准typecheck均exit0，源码/宿主与renderer快照分别保存为`product-write-set-after-clamp-fix.json`和`renderer-artifact-after-clamp-fix.json`，未覆盖旧证据。真实long-list第五轮exit0，`.lime/qc/user-message-collapse/long-list-packaged-5/user-message-collapse-long-list-packaged-5-summary.json`：interactive/cold restart均ok；collapsed/expanded/cold copy完整9682字符，SHA `2d26958c2e7f9e8fad508f835b9e4f145b2580ff4e5f525339afaec0590002a1`，native fulfilled/observer恢复、可信鼠标键盘均通过。后继233相对top从-8.03125到-8.234375px，漂移-0.203125px，无重叠；旧PID退出且新进程启动，之前expanded的实例冷恢复默认collapsed。canonical正文/content parts/text elements/User Items/Turns不变，连续trace完整、禁止mutation0，console/page errors0。只证明surviving successor锚点，不声明消失正文内部offset保持；实际macOS Electron+编译fixture，不等于Forge安装包或Windows/live Provider。
- fresh rich第三轮exit1，`.lime/qc/user-message-collapse/rich-packaged-3/user-message-collapse-rich-packaged-3-summary.json`：同Item/client唯一canonical_turn气泡/正文成立，旧空泡已消失。copy-collapsed真实click遭同一user bubble/.space-y-2截获，sentinelObserved=true/buttonClicked=false/native calls0，observer完整并恢复，console/page errors0；这是可点击性失败，不能归为复制权限失败。现有安全快照缺footer/button实际rect及hit-test，fixture worker认领独立安全诊断及相邻测试，不存正文/URL/raw error，不force/dispatch/放宽timeout。root读取styles发现footer由MessageWrapper:hover或focus-within显示；generic wheel仅准备viewport，而long-list references探测经过Tab、rich无此准备。测试漏真实hover为候选，需前后几何和可信hover证据确认，未改产品样式。当前切片保持partial，旧Composer聚合/本地成功不得关闭本轮门禁。
- 本轮contracts入口exit0，日志`/tmp/lime-user-message-collapse-contracts-final.log`，包含protocol/client/commands、脚本/发布/desktop reference/CLI边界与docs检查；更新后的current-rules/current-docs两套23/23，日志`/tmp/lime-user-message-collapse-docs-guards-final.log`。capabilities只读覆盖核验未发现产品/测试/脚本恢复旧权限名或锁死旧DOM的guard；当前主frame写与读/子frame/other/null/unknown拒绝、媒体request数组/check单值、唯一canonical rich正文、route/直接图片保护、bounded虚拟挂载/锚点消失/clamp/pending导航均保留行为回归。没有为了绿结果删除有效风险断言，未重跑已经通过且未变的定向集。
- copy准备窄修已冻结：独立安全geometry与prepare helper，shared gate/evidence/rich行为回归合计5文件，manifest `/tmp/lime-user-message-collapse-rich/rich-copy-action-write-set.json`，root核对5/5摘要一致。geometry14/14、接线先红7/8、修后6套199/199；lint/格式/5项语法/窄diff通过。准确target真实hover→既有wheel→copy真实hover→原click，不force/dispatch/改timeout，产品样式、权限、runtime与long-list均未修改。`copyActionPhases`保留beforeHover/afterBubbleHover/ready及失败几何，只存有限CSS枚举/rect/结构关系，hover仅声明Playwright API完成，不伪称捕获可信hover事件。fresh rich第四轮已启动；contracts的protocol生成检查触发生成文件mtime更新，fixture按既有freshness要求重新构建renderer/Host，不绕过新鲜度检查，后续另存新产物摘要。

- fresh rich第四轮exit0：`.lime/qc/user-message-collapse/rich-packaged-4/user-message-collapse-rich-packaged-4-summary.json`，全部69项scenario assertions为true，UserMessage Gate全部19项布尔合同成立，五次真实collapsed/expanded/keyboard切换、两状态1705字符完整copy、同一canonical user/parts/Turns与continuous trace完整/无额外input均通过，console/page errors0。before-hover footerheight0/maxHeight0/pointer-events:none/opacity0、button中心命中bubble；ready height24/opacity1/pointer-events:auto并命中copy后代，关闭测试漏真实hover原因。afterBubbleHover采样落在transition起点仍height0/opacity0，不把它当settled；最终ready与真实click/readback负责验收。hover只声明API动作完成，没有event isTrusted采样。新renderer3384项及22项产品写集与clamp快照逐项均无digest漂移，main/sidecar也保持原SHA，因此long-list第五轮仍匹配同产品产物，无需重复。另存`product-write-set-after-rich-hover-gate.json`与`renderer-artifact-after-rich-hover-gate.json`。本轮current fixture已开始；聚合不含session-history独立Gate，long-list/cold证据分别报告。
- 额外只读核验确认permission旧owner缺回流守卫：现有legacy-report仅扫描src，imports entry对“已恢复但零引用”的文件只列候选，不让门禁失败；current-entrypoints虽扫描electron却未禁旧权限owner。当前无残留结论仍成立，但不等于forbidden-to-restore已落实。聚合结束后认领最小catalog dead entry与Electron permission owner AST guard/相邻behavior tests，由既有current-entrypoints接入；禁止空旧源/旧测试文件、改名旧符号、第二注册owner与重复installer，保留独立embedded session current路径。复用同一检测函数对真实目录/临时fixture验收，不扩大整个legacy扫描根，不碰产品权限决策；在default门禁前完成。
- 冻结窄例外：packaged聚合的产品产物、fixture加载链与构建输入继续冻结；capabilities可提前在未进入该加载链/构建输入的`permission-owner-guard.mjs`、相邻behavior test与`current-entrypoints.test.mjs`实施独立治理回归。root持有catalog entry，等聚合结束后写入并运行真实目录接线测试；不以测试侧临时mock catalog让current通过。该例外不改变正在运行的renderer/Host/sidecar或scene脚本。
- 本切片聚合exit0，22个实际Electron场景全部ok且无false assertion、console/page errors；首末summary时间为2026-10-14T04:43:56.536Z / 05:01:32.373Z。日志`/tmp/lime-user-message-collapse-current-fixture-final.log`，root逐项读回并在`.lime/qc/user-message-collapse/current-fixture-final/aggregate-summary.json`冻结22份summary与摘要，不覆盖上一Composer聚合。该入口仍是controlled fixture而非live Provider；它不含独立长列表/冷启动Gate，不能互相替代。root已登记旧权限两文件dead entry；待AST guard真实接线冻结后运行`verify:local`，其内部`verify:gui-smoke`成功即计本轮GUI门禁，不为相同写集另重复一次。

### 下一批只读准备：marks 与 dictation

- [marks/voice审计](../research/codex-desktop-rea/marks-voice-audit.md)已完成，复用三项Composer REA Evidence与两个同摘要原成员，无重复分析；13个UTF16锚点、11个本地链接及格式验证通过。root仅新增精确研究文档白名单，未改产品。
- 基础schema确认link/code_block，rich PMU schema分支和provider默认选项另行记录，完整marks清单仍unknown。最小后续合同在唯一input-kit owner收敛schema/types、display/draft/submission序列化、UTF8 ranges、PM位置与实际View编辑；不能只加样式或推测bold/italic工具栏。
- current录音/分段ASR/润色、Controller revision保护及现有API/权限/五语言/dead回流守卫保留。permission等待的starting、cancel、旧reject与不同Controller同revision迟到结果是待先红问题；未复现前不写已确认故障，不恢复已删除的global shortcut/device UI或另建音频后端。真实系统麦克风/权限/识别质量仍独立not-run。
- 本范围研究映射100%；产品与对应Desktop Gate均0%，不计入长正文完成分母。长正文门禁关闭前不开新产品写窗口。

### 下一切片只读准备：scoped persistent draft

状态：设计候选 / 未开启产品写入。长 UserMessage 的真实 Gate 和门禁收口后，再填写实施合同并认领写集。复用已有 REA 保存补证，不重跑相同分析。

- 唯一活动文档继续归 `ComposerController`；scope owner 管理保存记录与绑定，不创建平行可编辑 Controller。实际导航保存旧 scope 后恢复目标；blocked/missing/deferred/error 的 before callback 只能 flush，不提前绑定。
- 首发覆盖 materialized、direct、有/无 draft tab 的 home→session；promotion 仅迁移稳定 entry 身份，不 restore/clear、不推进 pending receipt revision。sessionId 与 canonical threadId 分别使用真实映射，不能按字符串假定等价。
- 两处 accepted 消费（Inputbar 与 EmptyState）需要同时结算源 scope/version 与当前 Controller revision。离开 source 后旧 commit 返回 false 只保护新草稿，不会自动消费已发送的旧记录；若忽略此接点，冷恢复会让已提交正文复活。新增编辑、reject/failure 与迟到 interrupted restore 均需专门回归。
- 导航用 reset+setInput 路径直接迁出；显式编辑全文路径保留。draft tab 冷启动需由同一草稿索引投影 metadata，关闭 tab 与显式丢弃必须分别定义；不在3100行的 `useWorkspaceSendActions` 中堆逻辑。
- 持久层实施前明确与 Codex main persisted atom 的结构映射。现有 `agentChatStorage.savePersisted` 序列化在 try 外、quota 失败先删旧值且不返回保存结果，不能充当已保存证据；持久 blob URL、跨窗口协调、附件容量与失败保旧需闭合合同。若扩展 Host store，同步既有IPC/preload/gateway/catalog/schema/测试及架构，不借用 provider UI state。
- 验证必须包含 A↔B/home 富文档、Unicode/paste/mention/resource、真实退出重启、首发promotion、跨scope接受后消费、清除不复活与失败保旧；现有rich/history Gate不证明persistent draft。Codex附件耐久性、账户隔离与强杀窗口继续unknown，不制造上游保证。
- storage只读补证：savePersisted唯一owner可把序列化纳入try、拒绝undefined序列化结果、单次setItem并返回boolean，失败保持旧值；删除quota remove+retry，不能连带删仍被saveTransient使用的quota判断。AST35处调用均不消费返回值；新draft owner必须消费结果。现有测试缺savePersisted合同，可补circular/BigInt/toJSON/undefined、quota/security/general失败保旧和后续成功；transcript大状态丢弃、可重建resource-manager quota清理仍是有效测试。snapshot索引和迁移marker忽略保存失败是另域既有缺口，本草稿切片不顺手扩写。仅只读结论，未实施。

### 权限唯一 owner 护栏 Verification Contract

- 负责人：lime_desktop_capabilities 实施 AST 检测与恢复反例，root 持有 catalog、计划、报告与统一门禁；2026-10-14。风险 P1，`budget:normal`。
- 写集：`scripts/electron/lib/permission-owner-guard.mjs`、相邻 `permission-owner-guard.behavior.test.mjs`、`current-entrypoints.test.mjs` 窄接线及 `legacySurfaceCatalog.json` 单项登记。不是产品权限策略修改，不重构 runtime 或扩大 legacy-report 扫描根。
- 合同：同一 TypeScript AST 检测器消费真实目录和临时恢复 fixture；旧源/旧测试即使为空也失败，改名引用旧符号或旧模块失败。主窗口 request/check 注册归 `mainWindowPermissions.ts`，嵌入浏览器独立 session 归 `embeddedBrowserPermissions.ts`；第二注册 owner、重复/缺失主窗口安装失败，合法 import alias 与 namespace import 保持有效。
- 验证：先红恢复反例，再真实 current 目录与反例绿；定向 lint/format/语法，catalog/治理和默认门禁。AST 守卫只证明覆盖的静态构造，既有权限行为回归及真实原生复制 Gate 分别证明决策与运行链，不能互相替代。
- 研究文档校准：差距矩阵已迁到 current 状态，删除“仍缺虚拟列表/审批入口/Files 导航”的旧判断。rules/docs 回归23/23；legacy-report候选、分类漂移和边界违规均0。产品22项与renderer3384项快照复核无digest漂移，main及raw/Desktop sidecar均仍匹配前述真实Gate摘要。
- link/code block 补证已冻结：`marks-voice-audit.md` SHA `a7da8a2cee7a246ff3af3447e5e292cad983f6a4e2740f50b0425ce73b73ca35`；3个原成员摘要、41个UTF16锚点、bounded AST与11个本地链接通过。普通mark协议、基础fence/语言/转义已确认，rich完整选项、PMU与真实roundtrip仍unknown；未扩产品写集。

### 默认门禁发现：贴底转手动阅读的视口竞争

- 权限 guard 已冻结，behavior22 + entrypoints17 = 39/39，lint/format/语法/diff通过。root逐项确认3文件SHA并保存 `permission-owner-guard-write-set.json`；worker先红为17 failed/5 passed，证据来自工具输出。新默认门禁实际执行了22/22及17/17，并非只引用旧结果。
- 首次本轮 `verify:local` exit1，日志 `/tmp/lime-user-message-collapse-local-final.log`；五语言、lint、硬编码扫描与标准typecheck通过，前端103/126批通过，104批的MessageList两项键盘离底/取消已排队贴底帧回归失败。旧数值护栏未删除或放宽。
- 实际问题：scroll controller先停跟随，原生scroll事件尚未更新virtualizer的viewport；布局变化直接写入了上次程序贴底的位置。root窄认领 `VirtualizedTurnList.tsx` 与相邻test，沿同一viewport owner在keydown/wheel/touchmove的capture阶段同步实际视口；不改变键盘业务策略、跟随判定、clamp绝对锚点提交或runtime。
- 新独立反例3/3先红：三输入均从29200跳回291680，正确prepend位置应29492。修后五文件63/63，包含原两项失败、三输入竞争、DOM shrink clamp、prefix offset、后继锚点、bounded挂载、copy与折叠保护；两文件lint通过。日志 `/tmp/lime-user-message-collapse-user-input-scroll-{repro,final,lint}.log`。
- 该生产补丁重新开启冻结。22场景聚合与rich4/long-list5仍是前一摘要基线，不能充当新renderer证明；续跑默认门禁后，针对本次GUI视口变化补fresh rich、long-list/cold、live-tail及resize/reflow真实场景。Host、sidecar、wire与fixture owner未改；不因这项局部GUI修复无差别重跑已通过的全部runtime场景。

### 视口竞争修复后的门禁与补验

- `verify:local` 续跑exit0，日志 `/tmp/lime-user-message-collapse-local-resume-final.log`：前端126/126批、1689个唯一测试文件；首轮103批与续跑104–126批合计12693 passed instances，失败104批的重复结果不计入。contracts、7个Rust crate3179/3179及真实Electron GUI smoke均通过；新增VirtualizedTurnList测试在106批实际通过。
- GUI smoke：`.lime/qc/project-gates/standalone-shell-01-20261014055122-75182/shell-01-electron-smoke/summary.json` 为pass，覆盖真实Electron启动/reload/preload/IPC/App Server初始化、设置及三窗尺寸，不单独证明模型Turn或Codex像素一致。
- 新冻结：产品22项只漂移`VirtualizedTurnList.tsx`这一预期补丁；renderer3481项重新快照。`product-write-set-after-user-input-scroll-fix.json` / `renderer-artifact-after-user-input-scroll-fix.json`保存于`.lime/qc/user-message-collapse/`。main与raw/Desktop sidecar摘要均保持原值。
- fresh long-list第六轮exit0：9682字符三状态native复制完整、真实PID退出/新进程及默认collapsed恢复、后继锚点漂移-0.203125px、同canonical正文/parts/text elements/Items/Turns不变、完整trace和额外input为0；console/page errors均0。summary在`long-list-packaged-6/`。
- fresh rich第五轮exit0：69/69 scenario assertions、UserMessage Gate19项布尔合同均true；唯一canonical_turn、1705字符两状态复制、可信键鼠与引用/原稿/接受/历史合同保持；console/page errors均0。summary在`rich-packaged-5/`。fresh live-tail65/65、exit0，GUI首次输出、canonical完成与终态repair通过，无console/page error；是external fixture，非live Provider。
- resize/reflow首次补验exit1：wide窗口正文、表格、终态及Files面板已就绪，但activeThreadHeaderStable=false。日志 `/tmp/lime-user-message-collapse-resize-final.log` 与`resize-final/`失败summary/截图保留。error在统一sanitizer中截至2000字，关键header谓词未完整留下；不可据此判定已通过或直接修改布局。
- fixture worker窄认领resize-reflow入口的import/call、独立安全header诊断helper与行为test；只把安全谓词/必要几何放入error前部，保留timeout、等待、header/compact-mode/no-overlap断言，禁止正文、URL/raw HTML。原入口近900行，新增逻辑进入独立helper。新产品写窗口保持关闭，取得具体失败项后再确定最近owner修复。

- 安全诊断3文件已冻结：入口仅import/timeout throw接线，独立helper将12个headerChecks及失败项置前，18/18反例与安全截断测试、既有resize接线1/1、lint/format/语法/scripts治理通过。manifest `/tmp/lime-user-message-collapse-rich/resize-reflow-diagnostics-write-set.json`；真实diagnostic-2正在执行，等待/超时/断言未变。

### Resize/reflow 页头修复 Verification Contract

- diagnostic-2真实Electron exit1：唯一失败谓词childrenContained。wide页头y8..54、高46；toolbar/actions y-1..63、高64，确认为换行越界。context旧firstElementChild实际选导航，不能继续冒充标题组。
- root窄写集：TaskCenterUtilityToolbar.tsx仅workbench-header布局分支，ThreadWorkspaceHeader.tsx标题组稳定context testid；task-strip继续按既有行布局。固定页头内工具栏单行，超宽仍归既有header actions横向滚动owner，不增加另一工具栏/业务owner。
- fixture worker窄写集：resize-reflow入口及独立geometry helper/test；显式current context定位、可见几何消费overflow祖先裁剪。保留header/context/actions可见、contained、no-overlap与compact-mode-bar位置语义；不改timeout、等待、终态或表格/消息/input断言。
- 验证：旧64/46高度反例继续拒绝；合法横向滚动与真实纵向越界分开覆盖；现有Toolbar/Header定向动作/identity回归、lint/typecheck、fresh renderer三尺寸真实resize Gate、GUI smoke及风险匹配默认门禁。无协议/Host/runtime改动，不扩Rust写集或无差别重跑旧22场景。
- 架构影响非重大：既有header presentation、overflow与测量owner不变；诊断和几何helper均test-only。当前切片仍partial，fresh Gate通过前不标完成。

- root产品最小修复已实施：workbench-header root与group均单行且不收缩；task-strip继续wrap，沿现有actions overflow-x-auto访问超宽操作。标题组增加稳定context定位。现有Toolbar/Header三文件36/36、两产品文件ESLint/格式/diff通过；fresh renderer构建exit0。产品快照24项包含原22项无漂移与两页头文件；renderer本次174项，Host/sidecar三摘要实读匹配。快照为`product-write-set-after-header-layout-fix.json`及`renderer-artifact-after-header-layout-fix.json`，与之前3481项快照区分，不混用文件计数。

- geometry测试侧已冻结：旧测量12failed/5passed先红，新几何22/22+诊断18/18、原resize接线1/1与lint/format/语法/scripts治理通过。入口886→715行；唯一helper闭包自足直接evaluate，等待/readiness/timeout逐字保持。完整context与toolbar paint不允许旧回退；额外校验toolbar/actions raw纵向span，裁剪不能掩盖旧64/46错位。manifest `/tmp/lime-user-message-collapse-rich/resize-reflow-geometry-write-set.json`。
- fixed-3启动exit1未进入resize：root误用浏览器build生成`/assets/...`绝对module路径，Electron file页面停在startup，两资源缺失、无业务invoke。该renderer174项快照只保留失败溯源，不能作有效Desktop产品证据。已使用`build:renderer:electron`成功重建为相对`./assets/...`；新快照`renderer-electron-artifact-after-header-layout-fix.json`，fresh fixed-4在跑，生产页头未因此回退。
- 新护栏写集：fixture worker仅`electron-fixture-build.mjs`及相邻test，按实际HTML module/stylesheet的file资源路径检查renderer可复用性；独立于mtime与其他segment，不改显式override边界，禁止把browser构建或missing module artifact当fresh packaged资源。仅测试装配合同，无runtime/协议改动。

- fixed-4真实exit1继续仅childrenContained：完整context定位现正确，但toolbar仍64px；定位上层consumer仍按layoutMode聊天分支传task-strip，未随已经迁入header的位置更新。root追加认领WorkspaceConversationScene.tsx及既有consumer test的最小迁移；placement从同一shouldRenderThreadHeader派生，chat/canvas两种布局挂入header均使用workbench-header，非header使用task-strip，不新增owner或同义helper。
- consumer先红：chat分支失败、canvas通过（1failed/1passed/19skipped），日志`/tmp/lime-user-message-collapse-header-placement-red.log`；修后Scene/Header/Toolbar四文件57/57，追加非header分支task-strip保持验证。页头横向溢出从起点排列，避免flex-end形成无法滚回的负方向内容；沿原overflow-x-auto，不加新交互。相关四文件ESLint通过，fresh Electron renderer重建中。真实fixed-4保持失败证据，不把helper裁剪后的部分可见当contained通过。

- fresh fixed-5真实exit0，三尺寸wide1280×820/compact880×720/restored1280×820，66/66 assertions，console/page errors0。页头46px、actions/toolbar32px（y15..47）；完整context、paint containment、重叠、compact栏、table/message/input/right surface与canonical terminal均通过。wide/compact截图已人工检查，通知toast存在但未见toolbar越界或message/input重叠；不从DOM几何推出Codex像素一致或所有水平隐藏操作的键盘可达性。
- 新源码26项基于原22项零漂移，包含Toolbar/Header/Scene及Scene consumer test；新Electron renderer174项与Host/sidecar三实读摘要匹配。快照`product-write-set-after-header-placement-fix.json`及`renderer-electron-artifact-after-header-placement-fix.json`；标准typecheck、四产品/测试文件格式与diff通过。此前rich5/long-list6/live-tail-final来自视口修复基线，页头补丁不改变其产品owner；fixed-5补验页头和消息/input/table布局，证据分版本保存。
- 构建复用guard已冻结：旧实现14failed/10passed先红，最终28/28及相关source接线2/2通过；两文件lint/format/语法/scripts治理/diff通过。真实HTML按baseURI解析module/stylesheet现存file，空或无module/root-absolute/non-file/非法/missing/directory均使renderer segment stale；不执行脚本或取网络，finally关闭JSDOM。三segment构建、mtime、appUrl/build-ready显式override保持，依赖图不扫描。manifest `/tmp/lime-user-message-collapse-rich/electron-fixture-build-assets-write-set.json`。
- 最新`verify:local`已启动，日志`/tmp/lime-user-message-collapse-header-layout-local-final.log`；当前生产与fixture写集冻结到门禁结束，不用前轮126批成功替代本次页头consumer/装配guard结果。

### 默认门禁发现：复制反馈生命周期

- 新默认门禁 exit1，停在85/126批。该批16文件178项断言均通过，但环境销毁后 `MessageList.tsx` 的两秒复制反馈定时器仍执行 `setCopiedId`，产生 `window is not defined`；失败不能按断言全绿忽略。
- root窄例外写集：`MessageList.tsx` 复制反馈及独立 `MessageList.copyLifecycle.component.test.tsx`。连续复制从最新成功计时；卸载/切换会话取消旧反馈；迟到clipboard成功/失败不覆盖新会话或新复制。平台clipboard调用不伪称可撤回。其他产品与fixture继续冻结，隔离marks/dictation候选不进入src。
- 验证：先运行现行产品的生命周期反例，再修复同一显示owner、定向消息回归/lint/typecheck并从85批续跑；不放宽timeout、关闭unhandled error检查或删旧断言。追加真实copy Gate按新的renderer摘要单独记录。架构owner与协议未变。
- 原产品生命周期反例8failed/2passed；卸载计时器初始计数含jsdom Storage零延时事件，精确stack确认后仅drain 0ms，不推进两秒反馈计时器。修后10/10，含既有消息五文件合计69/69；产品/测试lint与标准typecheck通过，格式已统一。旧fixture选择器错误与诊断日志保留且不算业务先红证据。
- 新快照 `product-write-set-after-copy-lifecycle-fix.json` 27项，只漂移此前26项中的MessageList.tsx并增加独立回归。新default续跑发现新增测试，追加127批，保留之前passed记录；日志 `/tmp/lime-message-copy-lifecycle-local-resume.log`。旧rich/long-list/resize证据仍按各自renderer版本引用，复制新生命周期尚未取得fresh Electron证据。
- 最新default续跑exit0：127/127批、1692文件执行、12764 passed instances（首轮失败85批的178项不重复计），unhandled errors0；contracts、7 Rust crate3179/3179和真实Electron GUI smoke通过。smoke summary为 `standalone-shell-01-20261014075111-89042/shell-01-electron-smoke/summary.json`；批次与证据lineage记录到 `default-header-copy-lineage.json`。
- 复制生命周期fresh rich Gate exit0，`.lime/qc/user-message-collapse/copy-lifecycle-rich/message-copy-lifecycle-rich-summary.json`：69/69 assertions，正文19项布尔合同均true，两个显示状态1705字符原生复制一致（SHA `3b5ab254cf9c0e7f9d2d7ffcb3e3829910c83fe8114afd88a2f04e050c3debcd`），唯一canonical_turn、真实键鼠、无额外input、console/page errors0。异步晚到与卸载由独立10项组件回归证明，本Gate不冒称验证clipboard延迟失败或live Provider。
- 新Electron renderer271项及Host/sidecar三项保存为 `renderer-electron-artifact-after-copy-lifecycle-fix.json`；产品27项及274项产物逐项复核零漂移，Host/sidecar摘要保持此前值。此前long-list6/cold、live-tail-final、resize-fixed5分别保留其产物摘要，当前复制Gate补验新MessageList反馈，不混称同一renderer。长UserMessage合同（两入口/测量/锚点/复制/恢复/有效回流守卫）100%关闭；全面产品仍partial，marks/voice/persistent等不计入该分母。

### Link/code 与 dictation 生命周期 Verification Contract

- 负责人：root负责input-kit迁移、计划、架构与统一门禁；lime_desktop_capabilities负责dictation hook/session、Core消费者与五语言。fixture worker先提交只读接线设计，产品冻结后再认领精确fixture。预算 `budget:normal`，风险P1。
- 参考：复用 `marks-voice-audit.md` 冻结REA及普通AST锚点。基础link attrs、code_block与序列化采用已确认合同；完整PMU、主动打开/编辑dialog和Codex真实录音表现仍unknown，不把候选变量当原始源码名称。
- root写集：唯一input-kit的schema/types/Controller/Editor/keymap/serialization、link helper及相邻行为测试；positions若无语义差异保持现状。Plain display UTF16与Markdown submission UTF8分开，annotation迁移保留富PM文档，禁第二Controller/renderer业务后端。
- dictation写集：现有hook/draft/unit test、新独立session helper/lifecycle test，Core最小消费、独立Core听写回归、copy owner与五语言agentInputbar资源。独立starting/cancel动作；permission/RPC晚到按同session generation、Controller实例及revision保护；卸载/会话切换清资源。
- IME接线：PM公开handleDOMEvents早于默认compositionend，`isComposing=false`不能证明事务已结算。首版采用有边界的fail-closed：composition相交即无回滚地失效整个voice session，保留编辑文档，拒绝后续ASR/润色；已有组合时不启动录音。不使用私有PM属性、盲timer或跨revision范围映射。明确取消才按当前revision恢复provisional草稿；这不宣称ASR与IME并行合并已实现。
- 清理：替换旧hook重复refs/异步reset路径；旧纯文本paste fixture改为MIME-aware而保留原text/plain断言；旧positive shape不能阻碍current link/code语义。无新增compat/deprecated、无新依赖/协议/Rust变更。
- 验证：候选先红/绿只作预验证，应用前逐文件检查baseline；实际src定向先红/绿、Controller/Editor/receipt/IME/纯文本/五语言回归，真实Electron link/code→Send→canonical→history/restore Gate，已有voice current权限/API合同与生命周期测试、GUI smoke/default。系统麦克风/真实ASR和Windows若未执行单列not-run，不能以mocked录音生命周期测试替代。
- 架构影响：沿既有唯一input-kit、Desktop录音surface与ASR API owner；未新增跨层owner/协议，非重大。实现后同步architecture输入文档与取消生命周期描述。persistent draft/专业文件/原生操作/remote继续在整体待办。

### Dictation 实际源码与单路径收敛

- 原14文件actual写集冻结；最终manifest `.lime/qc/dictation-product/actual-manifest.json` SHA `3f009ce3725c04dab322650102b90f30797985cd89a43af1e4442be1e3e67d90`，root逐项复核14文件零漂移。既有Core/copy/五语言脏改动按baseline保留，仅接本合同。
- 实际hook先红25 failed/14 passed，Core真实hook/PM接线先红7 failed/1 passed；补音频decode取消竞态先红1项。候选pending接口在Core fail-closed策略下没有生产消费者，删除状态/type/session字段、hasPendingFinal与flush/drop整轨；迁移current行为后先红5 failed/26 passed，最终5文件72/72通过。
- 同Controller+sessionId+generation隔离所有异步结果；组合输入开始时整session无回滚discard，结果应用时发现composing同样终止。明确cancel才按最后provisional revision恢复。已发RPC只能隔离结果；音频decode context立即close，迟到decode不再发ASR。starting/独立cancel/输入法中断反馈覆盖五语言；系统mic/ASR质量与Windows仍not-run。
- 全仓非候选对旧pending符号扫描0，类型检查含测试、窄lint、Prettier与diff检查通过。hook719行/session196行，lifecycle测试796行，后续新增场景必须独立测试文件，不继续堆叠。无新API/协议/依赖、无compat/deprecated。
- root正在冻结构建与标准typecheck；新Electron link/code Gate、current fixture、GUI smoke/default尚未关闭，72项只计组件/生命周期证据。architecture已同步scope/cancel/discard与显式发送边界。

### Link/code 实际源码迁移

- 应用前逐文件核对12目标 baseline/candidate SHA，issues为空；冻结候选 manifest SHA 为 `7bd36954f2d5071239c23854e5e0e6ff16d43b54cca0c7b0fd1c3bc11db5d359`，patch 为 `ed0bd38d66719e645760be9526b45cc2a9c6d0ecc7424593d4dd195e15f047c9`。候选摘要不作为实际应用摘要，实际身份见 `.lime/qc/composer-marks-actual/applied-manifest.json`。
- 先只迁入独立测试，在实际 src 复现22 failed/8 passed（2文件30项），随后迁入生产实现；20文件224/224通过，覆盖input-kit与typed submission、receipt、restore、workspace消费者。日志分别为 `/tmp/lime-composer-marks-product-red.log` 与 `/tmp/lime-composer-marks-product-green.log`，副本落在上述actual证据目录。
- link安全协议、合法literal重放、UTF16 display/UTF8 Markdown范围、code fence/原始空白、PM annotation事务与实际EditorView paste/键盘均在current owner回归。旧clipboard getter只迁为MIME-aware，原CRLF/large-paste合同保留；`composerPositions.ts`无生产改动。
- Prettier后三个test describe去掉candidate措辞；Controller达到803行，annotation事务构造拆入纯 `composerAnnotations.ts`，不增加文档owner或compat wrapper；直接调用者与既有行为回归5文件92/92通过，Controller762行/helper59行，窄lint通过。实际写集扩为13文件，actual manifest已刷新。
- architecture的schema、Markdown submission、原始draft与range分工已同步。真实Electron HTML→code Enter/ShiftEnter→Send→canonical→history/restore、新default与系统voice仍分别pending/not-run；224项与旧127批不能替代这些门禁。

### Marks fixture 冻结

- 实际11文件写集与SHA见 `.lime/qc/composer-marks-gate-plan/actual-fixture-write-set.json`；7文件312/312通过，lint/Prettier/node syntax/scripts治理均通过。先红7 failed/127 passed，其中6项为业务断言、1项为测试DOM清理串扰，已明确区分。
- 独立字面Markdown oracle固定五个反引号fence、最终4361 UTF8 bytes，paste `[197,4337)`、Skill `[4338,4361)`；不消费产品serializer、DOM/wire/canonical反推期望。code按真实locator.press记录trusted/focused/defaultPrevented/insideCode，DOM Selection单列programmatic，HTML paste单列synthetic。
- history/cancel核对href/title/language/body与独立期望；最终canonical Turn/client/item、media、typed四类input、总input request恰1与终态均进入场景pass/fail。新4项marks断言复用原 `inputbar-rich-restore` 场景，没有新增协议或第二Controller。
- 删除无调用的 `richInputExpandedText`/`richInputInstalledSkillText`；`isRichInputDraftRestored`仍有common caller，保留原current导出并验证19/19。真实Electron、新renderer/default尚未执行，312绿只计Unit/wiring。

### 草稿落盘补证

- 同一ASAR的bootstrap/startup-requirements成员integrity匹配，REA新增Evidence `ev_6b726d05b1186a46c3e78398b4559cddd089b886382b8619d60fb2d509426d15`：2文件577112 bytes、parse failures0；semantic heap exhaustion导致graph incomplete。类/文件/算法结论来自完整原成员的普通AST，不能冒充REA semantic或运行证据。
- 已追到Codex Home `.codex-global-state.json`、export D→class的身份、main500ms debounce、串行保存、主/备份文件、同目录临时文件rename及Windows三档重试。renderer250ms发布与main500ms保存分开，broadcast不能充当落盘确认。原始成员与AST只留本机分析目录，合同/摘要/限制写入 `composer-draft-persistence-audit.md`。
- 实际退出/重启、强杀耐久、账户隔离与完整附件持久化仍unknown；Lime scoped persistent draft仍未实施。未扩展Host协议或调用者写集。

### 本批门禁失败与 fixture 版本边界

- 首轮 rich Gate exit1，失败阶段为 UserMessage aggregate oracle；marks/cancel/history、canonical四类input和总input恰1通过，两次原生clipboard全文1779 UTF16字符（4361 UTF8 bytes）匹配，console/page errors0。`renderedFullTextPresent=false`，不能以复制成功替代整个Gate成功。
- 初次prepare期间两个fixture于08:49:41Z变化，旧11文件manifest未同步；当前源含独立`renderedTextParts`与rich调用接线。原冻结和失败证据保留，修改者/精确旧进程完整模块SHA不可从现有记录还原，不声称该失败对应当前完整fixture身份。54项产品源码仍逐项零漂移。
- root新增独立真实MarkdownRenderer消费者回归：确认安全link href/title、code原始空白/正文反引号和全部ordered可见片段；同一rendered DOM拒绝raw Markdown全文显示假设。该harness替换syntax-highlighter与原生资源依赖，仅计组件/fixture证据。首次新增case因测试包围DOM缺失失败，修正测试装配后6文件189/189；不计业务先红。窄lint和格式通过。
- 当前冻结为 `.lime/qc/composer-marks-dictation/product-fixture-source-freeze-rendered-body.json`（54产品/14fixture）；不覆写旧manifest。fresh进程rich Gate已启动，标准入口因源mtime判定重建Electron renderer；构建完成后重新记录实际Host/sidecar/renderer摘要。
- 新`verify:local`在69/126批exit1：中断恢复拓扑guard把`inputbarDictationSession.cancel`的受控恢复算作非法writer。worker只认领guard及反例，不改生产dictation、不给voice伪造中断请求。保留两个UI消费者与request pass-through约束，更新扫描边界后定向验证并resume。旧127批绿不替代本次结果。
- 首轮sidecar prepare出现`install_name_tool` rename竞态报错，既有helper允许missing-after-race或already-present-after-race后继续装配；具体分支未记录。当前桌面code-mode-host存在且具有`@executable_path` RPATH，但本富输入Gate不验证CodeMode运行能力。不修改未知Rust产物owner或绕过prepare。
- fresh进程rich Gate exit0：73/73 assertions、UserMessage正文19项合同全true、两个显示状态全文1779字符原生copy、同一canonical Turn/Item/client和typed四类input、input总数恰1、marks取消恢复与历史键盘召回均通过，console/page errors0。新Electron smoke renderer271项和Host/sidecar实读摘要保存在`renderer-host-artifacts-rich-rendered-success.json`；raw与桌面App Server均为`df27ddb9…`，不混用旧`4d213628…`。54产品/14fixture逐项无漂移；截图已人工检查。HTML paste/IME仍为synthetic，code键与history/toggle为trusted真实按键，不宣称OS输入法或系统录音已验收。
- 中断恢复guard已冻结：只改`AgentChatWorkspace.inputRestoreGuard.test.ts`，旧guard实际1failed/2passed；相关6文件66/66、UI消费者与透传5/5、lint/严格tsc/格式通过。按request类型/字段约束直接writer，保留原两个UI owner和pass-through清单，正向区分听写回滚、反例拒绝跨域直接恢复中断请求。guard SHA`8eef1609…`，manifest `.lime/qc/input-restore-guard/manifest.json`；dictation14项零漂移。root复核后重启`verify:local`，入口自动resume，不从第1批重跑。
- default续跑在94/127批exit1：`MessageList.historyWindow.test.tsx`两条同步render case超过既有5秒上限；单独完整文件仍2failed/12passed，但失败case变化；聚焦同三条case在原上限分别通过（两项3032/3223ms，另一项989ms），不据此关闭全文件。只读诊断test harness计时/locale/无布局测量，未扩大timeout、跳过断言或修改生产。新current fixture聚合已启动，产品与fixture仍冻结；默认完整结果仍pending。
- 独立诊断显式Node18.20.2：同步render5469.29ms，getComputedStyle一次60.15ms，仅1.10%；15项源码零漂移，不能据此将数秒超时归因无布局测量。第一次诊断导出装配错误与第二次原5秒timeout分别保存。原default进程未记录runtime，不追溯假定为Node18或Node24。root改用独立Node24.21.0运行未修改完整原文件，14/14在原5秒限制内通过，最长2939ms；支持runtime下完整default仍待resume，不从此结果推导原超时唯一根因。
- 新测试命令显式以REA独立Node24目录前置PATH，不改变用户全局Node。旧已通过的93批仍是原进程证据，不能将最终续跑描述成全部Node24重跑。当前HEAD已包含外部release/guard提交；root未执行commit、push或分支操作。后续default使用明确基线，避免外部提交使smart检测只剩文档而漏掉本批验证。
- current聚合已exit0：22个真实Electron子场景均通过，包含新rich73/73、审批四类、停止继续、同Turn steer、Plan历史、Skills/MCP、媒体引用、Expert入口和Article Editor。54产品/14fixture仍零漂移；逐场景summary摘要与进程证据等级保存于`current-aggregate-success.json`，结束后实际renderer/Host/sidecar逐文件复核单列artifact freeze。此聚合为unit与真实Electron混合入口，external/provider fixture不冒充live，系统录音/OS IME/Windows未跑。
- 显式Node24 default以`--base 73ccc7f48`续跑，94批通过，在95/127批失败：ShellBackgroundTerminalList两条中文断言观察到英文，2failed/162passed。测试依赖继承locale的根因按窄写集处理，不改生产文案或降低断言；修后继续从失败批次，不重跑已passed批次。contracts全入口Node24 exit0，current-rules guard11/11；完整default与GUI smoke仍pending。

### Code NodeView 下一刀 Verification Contract

- 主目标：把主富Composer的基础schema视图迁为Controller下的registry/NodeView/Portal语言选择器，连同测试和DOM护栏直接迁移。基础link/code发送Gate不计此切片；主题、多模型、首页Banner仍是三项保留差异。
- 证据：[NodeView仓库合同](../research/codex-desktop-rea/composer-code-nodeview-audit.md)，本机审计manifest SHA`4900789d…`、86个原成员UTF16锚点；REA新增`ev_bf209739…`仅三inert slices的structural证据，semantic unknown。[高亮/Auto补证](../research/codex-desktop-rea/composer-code-highlight-audit.md)静态链已闭合，新增81锚点、5成员integrity、15产物SHA均匹配；REA `ev_32f87b5f…`依旧semantic unknown，不证明运行准确率。
- owner/写集候选：唯一`input-kit::ComposerController`增加registry持有/公开只读snapshot，`ComposerEditor`接NodeView/Portal；同目录Registry/NodeView/Toolbar、语言catalog与独立行为测试；样式继续existing Inputbar owner或迁为唯一共享View样式；五语言agentInputbar keys；marks fixture/observer及相邻tests迁新DOM。若高亮接入，单列stateFrom/plugin装配与Decorator/parser owner。开始前实际冻结精确SHA写集，避让Rust/命令热区。
- 结构：code是PM contentDOM，toolbar是不可编辑DOM，React只portal toolbar。语言动作由当前getPos和node重新核验后setNodeMarkup，保留正文/其他attrs/资源；Auto=null+auto true，Plain=plaintext+auto false，显式语言+auto false。源可确认方法名按合同迁；新增descriptive类名是Lime命名，不冒充压缩符号原开发名称。
- 失败边界：stale/foreign/destroyed位置、disabled、composition进行中拒绝改变；同值不生成无效revision/history；View销毁注销entry/listeners/Portal，迟到parser结果不dispatch；Toolbar mutation/events与代码编辑隔离。用户代码text nodes不能innerHTML/TextContent替换，不加第二document或runtime。
- 验证：registry多实例/稳定snapshot、actual EditorView two blocks/update/remove、语言及undo/redo/selection/resources、IME/paste/Enter、五语言label/search/keyboard/disabled、无旧DOM正向回退；真实Electron新DOM→语言改变→继续编辑→Send→canonical→history/cancel，源码/renderer/Host摘要与input恰1。高亮单独验证PM Decoration范围/mapping/async generation/无history刷新和实际token spans；Auto结果/发送属性不得只靠label。系统IME/Windows/reference live仍独立not-run。
- 清理：主编辑DOM旧pre/data-language观察直接替换；schema toDOM仍用于serialization，独立测试不保留双轨UI。缺主路径证据的wrap/copy/preview不作为迁移范围。架构图在实际实施同批更新，由root确认，不用本合同当产品已完成。
- 当前状态：等待本批default与current聚合关闭；设计/有界研究完成，NodeView产品实施0%、新产品Gate0%。不把本批基础schema73/73或研究100%计为全面GUI完成。
- 等待期间仅在`.lime/qc/composer-code-product-candidate/`准备独立候选：NodeView/Registry/Toolbar与language/highlight/Auto按窄写集分工，src/fixture/根依赖/renderer保持冻结。候选测试不计产品先红或Gate。现有lowlight1.20/highlight.js10.7为传递依赖，正式迁入计划声明直接lowlight3.3.0，候选在独立package验证现代parser，不改根node_modules。TSRX等grammar差异明确列gap，不伪造regex高亮或扩Picker。正式接线前登记精确写集、依赖/锁文件、架构确认与新的产品证据身份。
- root独立集成反例直接导入未修改的src Controller/Editor：7/7失败，覆盖主DOM/语言事务资源/纯meta revision与receipt/旧receipt保护/切Controller注销/disabled/实际token spans。测试暂在candidate，精确正文与日志保存；首次config callback装配失败单列，不计业务红。plugins/NodeView候选的stub红也不计正式产品先红。现代按需grammar适配需要直接`highlight.js11.11.1`与`lowlight3.3.0`两个依赖，根package尚未改变。
- 第95批语言隔离已修：只改`ShellBackgroundTerminalList.test.tsx`，真实前序`await changeLimeLocale("en-US")`下先复现2failed/1passed；beforeEach显式await zh-CN，卸载后afterEach await en-US。保留原中文断言，同前序3/3与原95批16文件164/164通过，lint/格式通过；其余22个保护文件零漂移。final-manifest SHA`0c174dbf2d53a3d81317d349ce199186903ea07be9184672526eb14750c442ee`。default显式Node24以原base续跑，lint/typecheck已过，当前从95/127继续；不改变生产文案、超时或断言。
- current22聚合结束后的renderer/Host/sidecar共277文件逐项无漂移，见`renderer-host-artifacts-current-aggregate-success.json`，与本批fresh rich产物一致。此身份仍属于基础marks/dictation，不能覆盖下一刀NodeView。
- 隔离候选复核发现parser与detector永久共享失败Promise会丢失参考detector重试合同；正式接线前分离失败恢复责任并补加载失败后恢复回归。JSONC严格接受comments、拒绝trailing comma，TSRX为独立现代grammar扩展；二者仍仅候选证据。新增直接依赖计划为`lowlight3.3.0`、`highlight.js11.11.1`、`jsonc-parser3.3.1`，根manifest/lock尚未修改。
- 原default前端已完成127/127批，标准Electron smoke正在build/执行，入口最终exit尚pending。正式接线overlay19/19（原独立7项+12项能力/生命周期）通过，未应用src；独立实际五语言主Editor反例5/5失败，原因均为正式主Editor没有NodeView toolbar，非假i18n资源。等待插件/fixture最终冻结及原default exit0后正式迁入。
- 高亮scope补查：raw parser完整53 grammar/5 alias组与主GUI的BVr41过滤分开；不由53注册扩展Picker或GUI输入。参考PM只投影HAST root scope，迁掉候选递归nested Decoration差异。原成员gRc/BVr/dRc/SRc与范围写入仓库高亮audit，原15项证据manifest保持历史冻结；产品候选的补测和最终manifest分别登记。

### Code NodeView 正式迁移（空间清理后的新证据）

- 原 marks/dictation default 已 exit0：前端127/127批、lint/typecheck与标准真实 Electron smoke通过；清理后 sidecar重新编译23m35s。smoke身份为 `standalone-shell-01-20261014114136-18147`，真实主界面、reload、三尺寸、memory settings全部通过。本结果关闭原切片，不能覆盖随后新NodeView源码。
- 恢复候选重新验证：插件3文件105/105；NodeView/Registry/Toolbar33/33；实际Controller/Editor overlay19/19（root7+own12）；fixture6文件189/189。严格TS、lint、格式、补丁检查及源摘要复核均通过。新manifest分别为插件`0378f2d3…`、NodeView`3713a1f0…`、接线`7e7ba459…`、fixture`43d94186…`；原历史manifest不计覆盖。
- 正式窄写集43路径：40个input-kit源/测试、fixture/helper及五语言资源，加根package.json、唯一依赖锁pnpm-lock.yaml与architecture。迁入前所有源码baseline零漂移，详见 recovery/evidence/formal-before-manifest.json；已迁40路径，直接依赖安装与正式验证进行中。原清单误登记不存在的package-lock.json，安装前已核对packageManager为pnpm@9.15.9并补真实锁文件baseline，未创建第二锁。npm Arborist安装失败且未改manifest；旧Corepack签名校验失败，使用临时获取的同版本pnpm与独立Node24，不修改全局工具。测试只将外置绝对路径变为仓库相对路径、移除candidate标签，原行为断言保留；实际parser案例mount后等待真实loader完成，不放宽timeout、不预加载、不stub。静态语言reference fixture独立于生产catalog。
- current：Controller→Registry→NodeView/contentDOM→Portal语言选择器；独立highlight/Auto插件；types与composerState单一职责拆分。dead/replaced：主编辑DOM的schema直接视图、旧pre/data-language正向observer与历史投影、Controller旧type export。schema toDOM仍是current serialization/clipboard，未增加compat/deprecated轨道。主题token继续承接配色，多模型和首页Banner仍走既有owner。
- 同批更新architecture的Composer图、依赖、revision/receipt与View/plugin生命周期；责任开发者root于2026-10-14确认。新源码定向测试、五语言、contracts、标准Electron构建和语言选择/发送/cancel/history Gate尚pending，不写此切片验收完成。

- 正式验证首轮发现五语言5/5失败：Toolbar误将资源分片agentInputbar当作运行命名空间。现已改为current agent namespace，独立Toolbar fixture同步；保留真实五语言原断言，修后5/5通过。原input-kit首轮20文件348项通过，失败不计完成；fixture6文件189/189、app-version与contracts通过。其余定向/默认与新Gate继续执行。
- 根依赖由独立pnpm9解析三项exact版本，合并后语义校验其余importer/package/snapshot不变；正式pnpm --filter lime install --frozen-lockfile --ignore-scripts成功，仅新增4包，实际加载版本11.11.1/3.3.1/3.3.0。existing agent-runtime-client声明1.71.0、local app-server-client1.83.0的版本不一致使直接add解析失败，未改该外部owner。清理同一风险的构建护栏窄扩写集2文件：electron-fixture-build.mjs/test，移除不存在的npm锁输入、追踪真实pnpm-lock与workspace文件；2项先红，修后待回归，不把锁变化误判为fresh artifact。

- NodeView正式45路径（包含依赖锁与两项构建护栏）已冻结：`.lime/qc/composer-code-nodeview/formal-source-before-gate.json`，SHA `d954ae8a…`。五语言及Toolbar/实际Editor4文件41/41；相邻消费者6文件141/141；fixture6文件189/189；pnpm构建护栏先红2项后30/30；新source标准typecheck由默认门禁重跑。首次typecheck读取修复前namespace后exit2，不能计绿。新rich Gate与verify:local均已启动，无预判通过。

### Persistent draft 下一刀的实施合同

- 主目标：同一Controller按workspace/home/draft/session scope保留未发富草稿；Main persisted atom为唯一桌面UI保存owner，不进入canonical transcript。最小Host候选先隔离准备，NodeView正式身份与本轮门禁不变。参考静态250ms发布/Main500ms合并与原子文件替换见保存audit；CAS/promotion/明确accepted保护为Lime实施合同，不冒充参考实测。
- proposed current：PersistedAtomStore/Host→固定AppDataRoot/host-state.json；只允许composer-drafts-v1，read/update两Host命令与typed gateway。更新为put/promote/consume/clear；draftId+opaque scopeVersion CAS，promotion不改变版本或receipt，consume保留无正文tombstone；不自动驱逐或以absent重建旧ID。失败、unknown、仅dispatched不消费。
- renderer协调者独立于Controller：250ms合并后台写；捕获发送token固定pending put，后台保证captured put先于consume；发送不await保存、不增加durable checkpoint或Quit握手。accepted跨导航也消费旧存储；当前UI只在相同逻辑binding且receipt匹配时commit，保留新稿。materialized/direct/home三种promotion必须覆盖，sessionId与threadId分开。
- Host候选窄写集只在recovery/persistence-host-candidate；正式接线再更新architecture并确认图。主文件/backup失败保旧，保存revision与pending/error分开，Windows rename有限重试；loaded失败保持unavailable，不能写空覆盖。当前附件为20张、base64合计100MiB；本轮固定draft128MiB/总文件256MiB、10,000records/bindings保护预算，UTF8 JSON计费、整次拒绝，不截断或影响发送。
- 验证合同：先CAS/late put/tombstone/promotion冲突/幂等、文件失败与保存竞态定向；同步Host/preload/gateway/catalog与领域guard，保留诊断trace但不写完整草稿，Main通知禁止renderer spoof。真实IPC与正常退出重启证明Host基础能力；随后GUI导航、三种首发、failed/newer draft与current AppServer Gate。Host单刀不计用户草稿已交付，Windows真实进程/强杀/断电另列not-run。

- 新rich-1真实macOS Electron Gate已exit0：74/74 assertions，console/page errors0，legacy/mock hits0；session/thread `01a13a48-fea9-7841-8b7c-bbd8634f2370`，canonical User Item `user-turn_d0cb04df803547f6afa24610073a61b1`。实际Picker搜索Auto→Plain→TypeScript、可信click/Escape、query清空、owned Portal、回焦点与真实const高亮均通过；body/资源/selection/history/cancel同identity，input请求前后均1。receipt `.lime/qc/composer-code-nodeview/rich-1-receipt.json` SHA `16dfd944…`；464项renderer/Host/preload/resource/sidecar摘要见`renderer-host-artifacts-rich-1.json`，正式45源零漂移。controlled external backend不是live Provider，HTML/paste/IME边界仍synthetic；Windows/Forge安装包/OS IME未跑。current聚合与新default尚pending，未计此切片全部门禁关闭。

### Persistent Host 接线候选（正式源码未迁入）

- root隔离写集为recovery/persistence-wiring-candidate：Main仅生命周期、路径注入与两个Host方法委托；IPC白名单、preload、catalog与current safeInvoke诊断同步准备。Main原大文件不堆保存或CAS业务；renderer event注册抽到独立纯Host policy，默认退出不增加落盘等待、checkpoint或Quit握手。正式NodeView的45项源摘要仍零漂移，架构正式接线待本轮门禁关闭后登记。
- 桥接诊断先红8/8：富草稿正文、base64、scope和任意identity经现有sanitizeValue进入trace/error缓冲，错误message也可回显正文；保存通知原生订阅失败被safeListen吞成空取消函数。候选抽出唯一invokeDiagnostics owner，两个buffer recorder仅保留固定key/op、command/transport/status，不检查任意错误正文；其他命令保留既有诊断行为。原错误仍返回调用者，不伪造保存成功。先红/绿日志分别为`/tmp/lime-persisted-atom-bridge-diagnostics-red.log`与`/tmp/lime-persisted-atom-bridge-diagnostics-green.log`，修后2文件25/25。
- Main IPC与preload共用rendererEventPolicy：真实handler拒绝renderer广播persisted-atom-update，预加载emit/send同步拒绝；Main owner主动通知仍可原生listen和反注册。独立policy及实际preload/bridge消费者4文件38/38，日志`/tmp/lime-persisted-atom-wiring-candidate-tests.log`。这只是隔离预验证，不能算新Host真实IPC或草稿正常重启已验收；source guard、严格TS/lint和候选最终摘要待冻结。
- Host与gateway共享纯JSON transport types/parser及单源预算，避免Main引入PM/React或复制response/event schema。Host候选继续补消费tombstone开销预留、IO读取预算与无效UTF8拒绝；renderer只读接线审查限定recovery/persistence-renderer-design，核实三条promotion和accepted/false/throw/仅dispatched，未扩正式GUI写集。

### NodeView 默认门禁续跑与旧测试清理

- 新默认门禁exit1，停在29/127批：16文件279项中277通过，唯一失败文件为composer-marks-renderer.test.mjs的两个旧独立literal。当前fixture已迁为`const value`正文与typescript语言，旧断言仍期待只含中😀的正文和ts fence；真实新rich与聚合rich均通过，不能为旧test恢复旧fixture或产品实现。
- root窄例外写集只含该MarkdownRenderer消费者test：更新独立字面正文及五反引号typescript fence，保留原空白、可见片段、链接、clipboard/raw Markdown与canonical边界断言，不读取产品serializer或DOM反推期望。正式45项产品/fixture源不变；新增test后记录46项freeze lineage，定向回归后从29批resume，前28批不重跑。日志`/tmp/lime-code-nodeview-verify-local-node24.log`保留原失败，下一轮使用独立resume日志。
- Persistent Host候选13文件已冻结121/121；gateway/fixture候选4文件已冻结70/70。它们仍只在recovery目录。renderer审查发现await Promise<void>与丢弃QueuedSubmission被包装为true、steer接受后refresh失败、卸载preview先settle false后真实发送仍accepted、迟到首发重读activeSessionIdRef，以及冷启动不知旧draftTabId的轻量index缺口。GUI正式接入前必须沿existing AppServer owner透传typed receipt、captured identity并补同一atom workspace index，不能将Host基础read成功当作草稿产品已交付。

- 旧MarkdownRenderer独立literal迁移后2文件54/54通过，窄ESLint通过；原45源SHA全部零漂移。新的46项lineage为 `.lime/qc/composer-code-nodeview/formal-source-before-resume.json`，SHA `f12f4accfe6b35f4b230bf524f77cb5aadce3152a37e00e63f44b28dc8b27e45`。Node24默认续跑已启动，日志 `/tmp/lime-code-nodeview-verify-local-node24-resume.log`；current聚合仍运行，不预判22场通过。
- Persistent隔离接线新增HTTP诊断边界：原HTTP入口直接console打印cmd/args与error，3项回归首次2红1绿；现复用invokeDiagnostics，草稿仅记录固定key/op，调用者仍收到原错误、wire仍含完整请求，其他命令原console参数保留。新HTTP3项及旧HTTP30项已绿；综合候选80项出现source guard正则误报与实际ESLint测试在并发负载下5秒超时，未修改产品或扩大timeout。已修正guard只匹配直接raw error参数，独立9项复测进行中；最终冻结尚pending，正式源码未迁入。

- root接线候选最终16文件（9改7新）已冻结：manifest SHA `566d986f91640f8b52b3912e52180ce3d82a47ddedf17d3b88b539278928e622`，7文件80/80；strict TS、窄ESLint、Prettier和patch-check通过。source guard收窄到HTTP invoke直接raw error，ESLint配置在module初始化加载一次，断言仍用真实lintText，原5秒timeout不变。driver packet SHA `1322a3280a23f56cf4d2c6089fe12c5868628374ea0d7b41a815ac960ff0de19` 含3项真实policy passed receipt；正式源未迁入，driver必须继续fail closed且不build/launch。
- renderer只读设计已冻结55源/134锚点零漂移、43场景，manifest SHA `7085719e0e5982acf7dfe25385cb307de06ed9d8ab3b137bcc660568b5addcc4`。同atom冷启动索引、准确accepted透传、后处理/卸载/迟到identity与导航reset合同已落入保存audit。下一窄候选由原renderer worker负责acceptance core到useAgentStream与typed observer，外层slash/Workspace/TaskCenter/coordinator不进入本刀；正式源码保持46项freeze。

- root复核同SHA参考的Windows rename backoff，发现原Host候选25/50/75ms不必要偏离100/200/400ms。原Host候选保持冻结；独立File二路径overlay已18/18通过，严格TS/lint/格式通过，重试次数、错误分类、目的文件保留与partial backup语义不变。真实Windows未跑，不将注入platform的测试写成Windows产品证据。
- Persistent基础正式迁移包仍37源（9改28新），仅两File路径采用上述overlay；其余源逐项匹配四个冻结manifest。combined source patch SHA `dd5be3da6548d5dbf9ea41a50f67beede21a28abba1a1d144fee174e41256f7b` 已git apply --check通过，尚未apply；NodeView默认/current门禁关闭后再迁。

- current聚合入口现已exit0，通用smoke日志记录22/22场真实Electron成功（包括独立coding workbench入口）。聚合receipt和464项产物最终摘要复核正在收尾，不把顶层初始session当作后续场景canonical身份。
- 第二次Node24默认入口exit1：29批279/279通过；30批397绿/1红，唯一旧code-space反例仍替换已不存在的`  中😀`，实际为no-op。root只改该rich-input-evidence.test.mjs：独立literal改为`  const value`，并为六种Markdown漂移共同断言输入确实变化。3文件126/126及窄lint通过，原46源零漂移，登记47项lineage。两次verify:local失败日志保留。
- 按quality-workflow事实源继续`npm run test:resume`，从30批续跑；已通过的app-version、五语言结构/unused、全src lint、hardcoded与标准typecheck在产品源码SHA不变下复用，随后显式执行原计划剩余的标准`verify:gui-smoke`。这是默认步骤的组合收尾，不能改写此前wrapper为exit0，也不重复无新风险的前置门禁。暂不迁入Persistent正式源码。

- current聚合最终receipt SHA `a678fc058cc0fa4cc9e2aa57c35ed7ebfe5693004afcca5339211c999d67e86b`：22场/1476项assertions，47源与464产物完整SHA校验零漂移；21场使用自身gateBContract identity/outcome，coding使用独立accepted/recovery合同，不合成其未提供的legacy/mock计数。47项lineage SHA `f1a4c8cf4c9484519aae998881c5d0e21c65c07b350d5bf17414ba40afa5353d`。23项current-docs/rules与格式、diff检查通过。
- workspace-index候选已冻结：manifest SHA `3fb82df155014550121fd896a2aacf3edb0c9e77d9f2df9df60b61b15e1db784`，191/191、strict/lint/格式/apply-check通过；只11路径替换原Host read合同，File和update/CAS/IO原算法不变。acceptance core候选25路径、12测试文件113项最终通过，manifest SHA `af0789c288f170584f67bd11860fdcad5f7e452972ea8fa557b7a59cd8048a6e`；strict25入口、lint23文件零warning，2份tracked d.ts按官方忽略，生成owner仍unknown。两者正式采用0%。
- 独立下一候选分工：desktop worker仅在recovery/index-consumers迁gateway/公开IPC fixture/driver及相关read fixture；renderer worker仅在recovery/acceptance-surface迁真实start/steer/queue结果到外层send/slash/Workspace/TaskCenter；fixture worker仅在recovery/codec准备完整富草稿JSON边界。原冻结包和正式源码不夹写。队列结果只能由真实QueuedSubmission和请求前捕获的canonical context构造独立queue-accepted，不能从true/void推导Turn接受。Workspace3107行owner只保留小模块委托，业务判别迁小模块为本刀退出条件。

- 前端续跑30–77批通过，78批16文件92项均绿但有未捕获异常：image-gen页的3秒timer在环境卸载后更新React state，入口exit1。root窄扩写集：image-gen源/test、将voice/useAutoDismissMessage迁为shared唯一owner、voice仅import机械迁移，以及video-gen/media-services两处完全相同的timer重复消费者。新增3项真实页面回归先红，修后image+voice19/19通过：卸载取消、第二提示完整计时、保存晚到不建timer。不吞Vitest错误、不扩大timeout、不通过测试清timer遮蔽产品缺陷。voice1246行文件本刀只迁import，无新增业务；整页拆分不在本缺陷写集，退出条件为无业务追加、共享helper替代旧timer入口。本变更需要新typecheck/定向回归/renderer构建身份，原NodeView47源仍冻结，随后新lineage登记新增/删除路径。

- 生命周期修复后video/media10项通过，四页面合计29项；窄lint/格式和标准typecheck已exit0。新53源/1删除lineage SHA `6036d717607e29936d3e1e65bd0ab74ea6e38b889e5aa6f84efe2a1c2e888b60`。标准`verify:gui-smoke`已exit0，run `standalone-nodeview-timer-20261014-2130`，summary在`.lime/qc/composer-code-nodeview/gui-smoke-timer/summary.json`，真实startup/reload/preload IPC/App Server/三尺寸/memory settings通过；无provider turn，不拿壳smoke替代74项富输入或22场current证据。
- 续跑78–81批通过，82批8个CharacterMention套件collection失败：新Toolbar导入Popover时触发旧hoisted mock的顶层React初始化顺序。root仅迁同一个testFixtures文件的Popover/Command mock工厂，改为各自await import React，不改产品或行为断言；8文件80/80通过。54源/1删除lineage SHA `e6a7d7f65395ca778b995a6f1afc4c26fab1df1f77c36b7800b962e3f7660381`，从82批再次resume；53产品源仍零漂移，不为test-only改动重build。
- 基础Host37源新增独立Driver test-root overlay，移除2份test的REC绝对常驻路径，使用os.tmpdir/mkdtemp并afterEach仅清自己目录，沿35/35回归通过。原冻结Driver包未改；新正式combined patch SHA `d60359b76a609ebec3258dd4a82de1c76cfcb732a1f765b5874b0a8da4547f2c`，migration manifest SHA `c897066cd966bca4c817031b0909a06ec743dca75213a625ef780f3a6a9098a5`，apply-check通过，尚未apply。
- Codec候选两新文件、38/38、strict/lint/格式/apply-check通过，manifest SHA `608e62bd0e8c0cfdc3f8bc0bd0c23329eff77bab9b6fe384fb790a85324eb1bb`。真实Controller/schema/原preview helper验证完整富JSON→submission往返；剔previewUrl暂态但保data，plainTextMode为显式参数，当前Controller无模式getter且restore不改变immutable options，GUI模式生命周期仍须接线。正式采用0%。

### NodeView 默认组合收尾关闭与 Host 正式迁入

- 前端最后续跑exit0，状态passed，127/127批、1713测试文件完成；原两次verify:local exit1保留，随后timer与hoisted fixture续跑失败也保留。按质量事实源复用已过前置步骤、修后标准typecheck、test:resume和显式标准GUI smoke，组合默认步骤关闭，不捏造新wrapper exit0。最终receipt `.lime/qc/composer-code-nodeview/default-combined-final-receipt.json` SHA `7078735e6eeb6550608256d965113ed7271ef63c9fc092bdac63d73f19e8228b`；54源/1删除、最新464产物逐项零漂移。rich74/74与current22/22仍关联各自原build，不能说它们与后续shell build逐字节相同。
- NodeView切片行为、结构、旧fixture/护栏迁移和本地验收100%；整体GUI仍partial，参考运行/live provider/Windows/OS IME/mic/Forge未验。current为Controller/Registry/NodeView/Portal及两个plugin；旧主DOM观察路径直接替换，旧voice timer helper已删除并由shared唯一owner承接，新增compat为0。
- foundation独立只读审查未发现确定缺陷/迁移阻塞；64冻结entries/40有效源与consumer beforeSHA链一致。审查SHA：MD `1a554160c8fded926da92d468eb052fd13eccaad00279e1fda9d882660922422`，JSON `8ede73ff6f55e194ddf0124007b99c6bb24ee8edf21f68c08e545fa6bf9be104`。dispose为best effort，真实fixture先等saved再正常quit，不证明pending即退出。
- root下一窄正式写集为latest combined基础37源（含File100/200/400ms与Driver test-root overlay）、architecture/commands、保存audit/report/index/本计划；避让release plan、未知local-conversation产物和其他外部改动。迁前重新核before/final SHA，再迁为唯一current Host保存链。基础Host真实公开IPC/正常新PID重启关闭后才迁index及消费者；GUI coordinator/codec/acceptance继续独立交付。

- latest37正式迁入完成，所有before/final SHA一致；architecture 4.3与commands同批同步。架构影响major，责任root于2026-10-14确认图：唯一Host UI保存owner与AppServer canonical事实分离，Main只组装/委托/dispose。Main超过1000行，本刀新增行为限小owner，退出条件为不向Main追加CAS/IO/parser业务、两个IPC仅委托，拆分Host自身实现已完成。正式验证pending，不能计Host或GUI验收已过。

- 正式Host首轮17文件233绿/58红、1suite collection失败；58项均被夹具new URL(.test-data, import.meta.url)在默认jsdom下转换为非file URL阻断，未执行产品断言。两个test root改为node:os.tmpdir()+mkdtemp，仍仅清自有根；standalone是Node动态加载/编译orchestration，默认jsdom的Vite浏览器转换报Expected ident，显式Node诊断15/15已通过，文件增加node环境pragma使默认入口使用真实运行环境。不改产品/断言/timeout。原失败JSON保留foundation-tests-first-failed.json，正式复测独立输出；冻结候选包不改，后续index patch的File不覆盖本test-root修复，test-support也须保留。

- 同一root问题第三消费者Host.test也已改为os.tmpdir自有根；修后剩余Host9/9通过。正式定向结果为17suites/306项（第二轮16suites297绿 + 独立Host9绿），不是声称单次全量绿；所有产品断言不变。contracts与标准typecheck均exit0，窄lint已过；格式首轮仅evidence-index未格式化，已按Prettier格式同步。下一步标准Electron build/smoke与正式policy三项JSON构造packet、公开IPC重启。

- 基础标准GUI smoke已exit0，run standalone-persistence-foundation-20261014-2157；真实Host/preload/AppServer/startup/reload/三尺寸/settings通过。REA注册丢失已scoped setup恢复及显式Node24修复，当前非REA配置原样保留，doctor三项healthy、真实stdio170tools；备份记录 `.lime/qc/composer-persistence/rea-registration-recovery.json`。
- 正式基础Host公开IPC首轮失败，进程已正常code0/signalnull退出，无残留；实际文件revision7表明前面CAS/promotion/tombstone与保存已执行，但driver.inspectFiles调用current parseEnvelope漏required limits，不能产生有效文件receipt或重启通过。新增真实parser+实际有效envelope回归，修driver而不绕过parseEnvelope/降低校验。原失败证据保留；静态review0缺陷是历史结论，不覆盖此运行发现。

- 基础Host公开IPC修后exit0，15场景/36调用/7原生metadata事件、revision7；Main PID96100与96356均正常code0/signalnull退出，无残留。真实parser回归先1红/20绿，修required limits后21/21与standalone15/15；定向组合307项。基础receipt SHA `ef8ed5e08e98557448897860736088a55da3b7afb32ca680715855836ac9f268`，39源/674完整产物（含构建目录旧chunk，非宣称全被加载）。saved-before-quit边界保留，GUI/Agent恢复不计。
- foundation Gate关闭后root直接迁index+consumers23源（20改3新），正式before/final SHA全部一致；manifest SHA `4488863763d3eb060862b375e2d72693d2153bd45abe2d0eb7eaa39702da29db`。File retry/test-root、正式driver limits修复两源完全保留。旧scope-only read/top-level view直接替换为query/data，gateway/preload/fixture/standalone/guard同步，无双轨。architecture/commands图由root确认：索引只读metadata，不改业务/runtime/CAS。隔离388项不算正式产品；新正式定向/contracts/typecheck/build/IPC索引重启pending。

- index正式20文件439/439、contracts/typecheck/lint/格式与新标准GUI smoke均exit0；公开IPC新query/data21场景/46调用/10事件，revision10。PID24613/25004正常退出，current/other/null索引在保存前后及新PID恢复同revision与itemsSHA，consumed排除；receipt `.lime/qc/composer-persistence/index-final-receipt.json` SHA `411ba2f4f4d59805b635780f9f2ba89ee177f8a8bd9e070766da21f3c48ef941`。42源逐项零漂移，779当前目录产物摘要（含保留旧chunk，非全部加载声明）。基础Host+同源index实现/定向/真实Host验收100%，GUI富草稿仍0%；无compat，旧read合同已删除。
- 下一刀沿同一AppServer事实透传真实start/steer/queue accepted到GUI发送；core+surface合成在recovery准备，coordinator独立候选负责250ms队列/CAS/跨导航消费，root后续接scope导航、冷标签与GUI真实恢复。新默认门禁将在最终产品切片关闭时执行，前轮NodeView127批不覆盖新保存/接受源码。

- root正式窄迁codec两新文件，manifest SHA `608e62bd0e8c0cfdc3f8bc0bd0c23329eff77bab9b6fe384fb790a85324eb1bb`，before absent/final SHA完全匹配。它复用当前schema/serializer/selection/resources和JSON预算，剔previewUrl临时项、保data与路径引用，plainTextMode显式保存/解码，不复制schema或store。正式38项回归、lint验证进行中，未GUI接线；模式生命周期由下一React owner解决，不能称冷恢复已交付。

- root正式codec定向38/38、窄lint exit0；不代表GUI冷恢复。
- root核冻结acceptance合成manifest `889bed96b9c74e54c517a6114a5afcec62404802ffbf34fc377babc0fe5dfa58`、patch `f108518990d9835586f2b5951b5e8557580998e01426ac4cbabfa5da1a2b43fa`，62源迁前/迁后SHA逐项一致。正式27文件定向、typecheck/contracts执行中。候选485/485只作采用审查证据，不能替代正式验证。唯一wire与AppServer事实未改变；local-handled/rejected/unknown不当作接受，queue-accepted保持独立QueuedSubmission事实。
- 下一GUI写集分工：root认领Workspace React保存hook、CommandWiring/cold index与场景props/i18n/状态展示；navigation worker仅recovery候选的topic switch/draft open-select/materialization和组合props；send worker仅recovery候选Inputbar/EmptyState与opaque settlement helper；coordinator worker冻结后仅recovery候选的restore-token类型透传/ActiveStream/fallback/stop。所有冻结包只读，不覆盖未知release计划或local-conversation脚本。
- Workspace current Controller采用固定rich模式（plainTextMode:false），没有GUI动态模式切换入口；后续coordinator必须显式用同一模式，遇到保存的plain模式拒绝恢复并显示异常状态，保正文，不做静默转换。其他surface配置不变。

- acceptance正式27文件485/485和contracts exit0；标准typecheck exit2指出5外围boolean消费者。root认领CanvasWorkflow、ImageCommandAction、ArticleDispatch、CodingViews/RecoveryPanel及sceneGate send适配与对应tests，直接迁typed返回；sceneGate只把明确isRuntimeSubmissionAccepted投影为本地表单关闭boolean。原失败log `/tmp/lime-acceptance-formal-typecheck.log`保留。
- coordinator四新源正式迁入，before absent/finalSHA核一致；codec+coor正式82/82。root新增React runtime6、cold index3均绿，后续props/真实GUIpending。Workspace固定rich mode显式fail-closed保存plain-mode mismatch，不静默转换。
- root正式先红证明同步Controller.commit subscriber新edit留UI但Store无entry：`coordinator-reentrant-first-red.json`1failed/30skip。修后退休accepted identity，再observe新revision形成新draft，正式coor31+binding14+React6共51/51。正式Coordinator已偏离冻结候选ce4f1b...，当前SHA d7eeaab37199b931f8350a1d3ff80c538d56b231eea4bc2b9d459e305fad50a3；冻结包不改，send候选须登记依赖delta。
- restore-token worker构造shadow时误让11路径经symlink写正式，已停并按独立expected-after CAS恢复8owner beforeSHA、3新test absent，零漂移。证据 `persistence-restore-token-candidate/evidence/unintended-formal-write/restore-receipt.json`；首轮shadow验证作废。重建owned以lstat普通文件+resolve在recovery校验，不纳误写进正式证据。

### GUI 富草稿正式接线（2026-10-14，进行中）

- root 已采用发送协调11源（manifest `52cc76430d92fd4cdf486c1a8bd7fe62428d6be71e4bdd2331124ac1bfd600aa`）、restore-token11源（`fd3094e61b80d530712e446203aabcdb5d5821918c229ad7dd620aec9b5308d0`）、导航11源（`53594dff7c16ea23f1117ebd41fb1067b55c5179657b1c2d0f3ebda95d009cdd`）；迁前/迁后SHA一致，helper原已按同SHA存在，仅该源排除重复apply。冻结候选只读，正式收据落 `.lime/qc/composer-persistence/`。
- 正式 owner/codec/status/index/opaque恢复7文件48/48；root目标scope/迟到promotion/reset/恢复门禁4文件45/45；导航source守卫4文件45/45、strict775文件零诊断。各组合有重复测试，不相加为唯一场景总数。五语言保存状态已修为实际agent flat key，保存仅以savedRevision覆盖当前storeRevision成立。
- root 修 Shell 共享props层级，after等待真实session/workspace与启动epoch；TopicSwitch在project解析/原请求完成/deferred resume均核启动source，不把旧完成清新draft。React owner同scope不递增epoch，promotion在layout前也复核同步intended target；实际workspace变化发布旧稿并提交home。初始化coordinator之前不处理new-task清空；返回home/new-task只导航保存，不discard。
- root 窄写集为Workspace draft runtime/index/status、CommandWiring/Shell/Scene/props/Reset、五语言与相应tests及事实源；TaskCenter send worker持四个send/request owner与tests，fixture worker只在recovery准备真实Electron候选。避让未知release计划、local-conversation脚本与tsbuildinfo。结构超限退出条件：EmptyState本轮只委托外置settlement owner，不继续增加接受/存储业务；后续拆分其presentation与资源动作。InputbarController接近800行，新增生命周期复用外置helper，不新增第二正文owner。
- 架构major，由root确认architecture 4.3新增图：Controller唯一正文，Coordinator唯一renderer保存协调，Host唯一CAS/文件；业务链仍App Server canonical。当前GUI切片未完成，TaskCenter三发送路径、真实冷标签/完整富JSON/accepted/新编辑/正常restart、current fixture/标准GUI/default门禁pending。旧NodeView127批和Host索引receipt不覆盖此新切片。

### GUI 发送竞态与真实验收准备（2026-10-15）

- TaskCenter 正式四生产 owner 已停写；73 项不同测试分批通过（48 + 15 + 10），最终真实 Coordinator/gateway integration 10/10、窄 lint/格式/diff 通过。它们不是单次 73 项全量运行，也不是 Electron Gate B。`useTaskCenterDraftSendRuntime.ts` 828 行，本刀退出条件为发送身份判断委托现有 settlement owner、不再追加持久化业务；后续拆分参数组装与 presentation actions。
- root 新增同 lane 回归：captured home 提交后，250ms 队列内新编辑先保持旧存储版本；接受后 promotion 同步 root target 和实际 binding，新版本保存到 local，旧 consume CAS 冲突，不清新正文/revision，重复 target 不递增 epoch。正式 runtime 9/9。第一次 oracle 错用 entry.payload，改为 current entry.draft.document；保留失败 JSON，不将该失败称产品缺陷。
- root 前一标准 typecheck、追加 owner guard 后 contracts、窄 lint、格式均 exit0。原阶段 GUI build 因产品源变化主动 SIGTERM，wrapper exit1，不能作最终证据；已确认自有旧 build 无残留并启动新标准 GUI smoke。
- 三工作区既有 local 富草稿 fixture 五源正式采用；manifest `c170647d76df454e4d0e93c09512f8bd695af862d71dd659f2110742f98a54ab`、patch `f21034acd0b75c86f00b49fff666e39b94a159e592fc6e575e73d226eb155adb`，迁前 absent、迁后与 17 依赖 SHA 一致。正式 Node evidence tests 20/20、lint/格式/脚本治理通过。误用 Vitest 运行 node:test 文件产生 collection failure 的日志保留，随后使用真实 Node test runner；不改 runner/断言隐藏错误。
- 新 GUI production source freeze 与 verification packet 在 `.lime/qc/composer-persistence/`，覆盖 renderer/desktop 输入及 fixture owner，仅为源码身份，不声称每个模块均加载。正常 quit 前必须等 savedRevision；三 local fixture 的真实冷恢复、失败保留、accepted/new-edit/跨 scope interrupt 仍待本轮构建后运行，不能冒用 Host receipt。
- 默认 `verify:local` 已启动。冷 draftTab 发现与 Home/direct/materialized 三首发分别在独立 recovery candidate 准备，不 seed atom，不以三个 existing local workspace 冒充三首发。current fixture、真实 GUI 和默认门禁尚未关闭；整体 GUI 继续 partial。

- 本轮新标准 GUI smoke exit0，run `standalone-composer-draft-gui-20261015-final-1`，receipt SHA `77b6ac42c17732027cf03002c391e97f9bcca5c60e70183bf651d31bbeb35011`；2,606 production inputs / 989 目录产物（含保留旧chunk）零源码漂移，非全部模块加载声明。真实 local fixture 首两轮失败，PID99745/13174 均公开正常quit/code0/signalnull；测试oracle修正字符串版本、consume后null binding与disk exact tombstone、skill执行key和mention id分工。Node证据24/24，版本合同真实先红；skill-route intended-red命令在读取源前已修正，实际24绿，不能当先红证据。所有旧log保留。第三run、受影响rich current fixture和新默认130批仍进行中。

- 真实 current rich fixture 首轮揭示产品阻塞：无可见输出的 GUI Stop 后 input/path/image/skill 未恢复；日志证明恢复计划与 Workspace request 已到达，初步根因是 Stop 自己的 Controller.submit(interrupt) 递增 revision 使严格 token 过期。保留原恢复正向合同，独立跨 owner 回归/最小修复候选准备中，不能标记恢复通过。
- local 第三/四轮都卡在第二工作区 sidebar：fixture 同名 workspace/session 触发 broad fallback 误点项目 header，第四轮分阶段/截图证据确认后改为真实 header 展开和 exact data-session-id row，并区分 workspaceName。PID19701/29741 公开正常退出。第五轮 freshness fail closed、未启动 Electron（typed page fixture 更新时间被当前 inspector 视为 renderer 输入）；下一次统一真实产品修复后重建，不跳过 freshness。
- 新 verify:local 在第4/130批 exit1，三个初始意图测试仍以 Promise<void> mock 发送接受。只迁共享 index.testFixtures 的默认结果到 current typed accepted，原产品断言不变；index+autoGuide 27/27通过，窄lint通过。该 >1000行旧fixture本刀仅两行 import/return 合同迁移，不添加业务或测试抽象；后续拆分独立 mock owner。按质量事实源从第4批 test:resume，先前 app-version/五语言结构和unused/87源硬编码扫描/全src lint/标准typecheck已绿，但新 Stop 产品修复后须新 typecheck/定向/构建证据。

- 续跑第16/130批暴露另一处旧接受夹具：workbench01 明确以 undefined 表示派发完成。只迁默认接受结果与 pending Promise 类型到 typed acceptance，原可见预览断言保持不变；正式定向15/15、窄lint/格式通过，再从第16批续跑。旧 wrapper/两次失败日志保留，不能写 verify:local 单次全绿。
- +tab 真实组件回归确认 React SyntheticBaseEvent 泄漏到零参数 onCreateTask，随后被 optional requestedProjectId 误解释。候选旧实现10通过/1失败，零实参适配后11/11；核before/after及8依赖后正式采用，定向11/11、lint/格式通过。related 曾因 Vite EISDIR 读 electron 目录失败，原log保留。后续公开入口审查确认 general GUI strip 不可达，组件修复不算真实 +tab 用户路线通过。
- Stop 正式采用两源最小修复及跨owner回归：删除无用途 interrupt submit，仅调 onStop；候选同一测试4失败/6通过→10/10，正式4 suites121/121、标准typecheck和窄lint通过。严格opaque token/revision/scope/generation守卫不变。新标准GUI smoke `standalone-composer-stop-tab-20261015-1` 通过，仅证明shell/preload/IPC/AppServer/reload/三尺寸/settings；current-rich真实复验独立进行。
- 当前root窄写集为上述产品修复、typed acceptance旧fixture迁移、一个Electron护栏、shared四源及本计划/研究索引。shared/guard正式receipt见 `.lime/qc/composer-persistence/shared-and-guard-formal-adoption.json`：81/81 Vitest、24/24 Node、lint/格式通过；误混runner的collection失败保留。Electron护栏精确分类test-support，并新增生产→测试层六类import风险回归；候选10失败/17通过→27/27，默认从26/131批续跑。未知release计划、local-conversation脚本及tsbuildinfo继续避让。
- 冷draftTab真实缺口：同atom索引可发现metadata，但general Workspace的ThreadHeader/utility toolbar排除唯一TaskCenterTabStrip选择consumer，Home/侧栏新建也无可达标签。原cold四源不采用，shared四源独立采用；当前按REA确认公开恢复导航。三首发改Home/搜索新建/项目新建，用实际index+scope read唯一绑定logical identity，不猜UUID、不seed atom，也不证明冷选择或标签UI。完整输入freeze将按freshness声明目录记录superset，避免旧2,606子集冒称完整构建图。

- 2026-10-15 root 本轮窄写集：Coordinator refresh 一行、Inputbar Stop integration、rich/history 两 fixture、AppSidebar 与 regression、三个过期 current 护栏，以及 first-send 四叶/Home cold 三叶。第二 Stop 回归真实 Workspace local/home/draft 先3失败/14通过→17/17；自动空投影用 replaceDocument({})，不推进同一空正文 revision，人工 restore/history 和严格 token 保持。正式8 suites269通过/1trace超时；原5秒上限单独69/69复跑通过，不隐藏首轮失败。标准typecheck exit0。
- Sidebar 真实第6轮卡第二项目：显示全部 opened projects，却按 active project 过滤查询。统一三处 conversationDisplayProjects，真实两返回会话/点击第二 row 回归先红后71/71；生产 AppSidebar 格式按现有 Prettier 规范，无其他逻辑。受控共享driver精确登记，默认旧promptHistory、restore叶分类、捕获workspace与DTO委托护栏迁 current；默认已续过75/131，继续原状态，不重头且不写 wrapper 单次全绿。
- 首发资源增强四叶与Home冷恢复三叶 frozen SHA、before absent及全部依赖复核零漂移，正式采用收据 `.lime/qc/composer-persistence/first-send-home-cold-formal-adoption.json`；Node84/84、lint通过。首发必须同一 User Item完整ordered input和实际thread-scoped media/read字节；Home仅稳定 current scope，两正常Main进程/不materialize/文件与revision不变。均待真实Gate，不证明顶部tab/全草稿picker/pending精确竞态/live provider。
- REA 设置7member/20 byte anchors收尾，source-only映射与next-slice冻结在 recovery/settings-navigation-audit-candidate。原worker仅独立准备单section owner、SettingsPage命名及消费者/tests清理候选；canonical路由/返回/search/dirty后置，正式采用与GUI验收0%。原freeze、失败log与未知release/local-conversation/tsbuildinfo继续避让。
- root 全量复核src/electron/scripts/packages，仅composerSubmissionSettlement.ts遗留指向recovery候选的symlink；按正式send收据SHA `173a9c...` 原样落成普通文件。新 renderer-only build、标准 GUI smoke 均exit0，47/47结算/Stop/TaskCenter定向绿；只证明对应范围，完整富输入仍待实证。
- 原rich1/诊断rich2均exit1；诊断确认token/Controller/Coordinator/revision/generation/scope全匹配，消费后identity重建触发binding_changed。两旧读时序先1失败/1通过，#retire递增read后五文件94/94、标准typecheck通过，strict guard/oracle不变。新renderer build exit0(6m7s)；原rich3 `composer-stop-retire-read-20261015-3` exit0，common34/34、scenario21/21，Stop资源/marks、canonical input、history和折叠均过，console/page errors为0。freeze5前后7887source/1568artifact零漂移，packetSHA `989a1281…`；收据 `.lime/qc/composer-persistence/retire-read-rich-final-receipt.json`。受控backend，非live/冷恢复/Windows；local后续结果见下条。
- local7卡code picker，fixture补same-session editable前提；local8拒绝保稿后Undo选区失败且正常quit收据失败。local9三rich准备后通过选区，却在Undo后code/mark断言失败，磁盘仅marker+image/path；Main59037正常code0/signalnull退出，freeze5前后零漂移。reject前后deepEqual未证明原稿基线仍在，fixture改为先用原JSON/DOM验证导航后的完整rich基线，并记录reject/Undo只读摘要；原恢复/marks/资源断言不变，Node24/24。local10原rich基线、reject前后精确保留、Undo恢复原payload/selection均证实；随后fixture重选变为collapsed，正文/marks未坏。Main74494正常退出，freeze6前后零漂移。fixture删除Undo后补marker与重选，改直接deepEqual baseline.draft与clean.draft，Node24/24/lint/格式过；local11用freeze7仅一fixture delta、产品/产物不变；第三workspace code picker trigger超时，截图空编辑器、未达Undo。Main82377正常退出，前后零漂移，静态确认visible B/bound A可编辑窗口，但缺时间线不能断言本轮命中；readiness候选以真实binding.ready和exact visible scope禁编辑，5个真实EditorView用例已正式test-first：旧实现5/5因contenteditable错误为true而红，无API缺字段失败；修复须等new-conversation采用。未达cold，Home/首发仍未执行。
- 默认resume13/14在87/131批各211pass/1原5秒首例timeout，失败分别references与EmptyState slogan；references隔离9/9。不改timeout/skip/state，不写wrapper单次全绿。自有重负载结束后再续原状态；资源压力不是产品无缺陷证明。
- 设置九源已正式采用（formal-adoption.json），单一sections/SettingsPage、重复名单与dead定义清理；架构4.4由root确认。正式六suite78/78、九源lint/格式通过；current15key验收脚本core/states10/10，真实broad smoke待验；canonical route/返回/search/dirty后置。Home冷恢复oracle三叶同步公开null scope与default业务workspace分离，Node33/33/lint/格式通过，JSON/selection/bytes/revision严格断言保持。
- 新建会话冻结manifest d581ea83…/adoption patch b56508ba…、4986 before/3补充依赖/78变更/35suite最新收据已root复核；三capture omissions如实保留。正式78源采用、9删除，AppPageContent及其新测试按hunk组合SettingsPage，16旁路owner原字节保留，收据 .lime/qc/new-conversation/formal-adoption.json（a82be2c8…）。唯一startNewConversation/committed request/fresh CAS直接替换random/event/prewarm/materialized/general strip；架构4.3/4.5由root于2026-10-15确认。候选逐文件438/438、strict3187零诊断、53 Node/15 contract/lint/语法通过；最终因果red混含API缺失，不冒称纯行为证明。正式最新逐文件46suite540/540（非单次全绿），初轮538通过/2失败为Stop夹具缺visible local提交，修oracle后17/17+EditorView5/5，原log保留；lint/格式通过，标准GUI新构建进行中。
- readiness 已正式采用：唯一 binding.ready + exact visible scope；正式最新逐文件46suite540/540，初轮538通过/2夹具失败保留。Stop fixture迁真实visible local提交，17/17+EditorView5/5通过，恢复守卫未放宽。标准typecheck/contracts/lint/格式/legacy/docs与GUI smoke（codex-navigation-readiness-20261015-1）通过。freeze8为7884输入/1673目录产物零漂移，不代表全部执行。local12三rich/拒绝/Undo/隔离/磁盘通过，旧oracle误要求jsonrpc字段；迁正确current omitted-version envelope，26通过/1行为失败→27/27。local13 trace通过，但直接evaluate(app.quit)缺Node debugger释放而等待超时；原Main/helper已退出，失败保留。公共Application.close生命周期回归21通过/1行为失败→22/22，不增加timeout或kill fallback。
- local14使用freeze11：Main48987/52369均正常退出，首次进入冷恢复但A的route被删、revision27变28。根因是catalog空时fallback执行key与namespaced mention id比较；真实Inputbar先18通过/2行为失败，复用能力身份owner修复后四suite40/40，标准typecheck/lint/docs与新GUI smoke24/24（codex-skill-cold-20261015-1）通过。freeze12为7884输入/1778产物，packet76445a7e…；只有认领三源变化。
- local15第一次cold三workspace完整JSON/DOM/资源/选区/identity与revision32一致；后段完整相等已通过，但test-only合法无capability摘要hash(undefined)而失败。nullable摘要先27通过/1失败→78/78；rich必需route/完整相等保持。freeze13仅两fixture delta、产物零漂移，packet651b552b…。local16全部exit0：三rich、拒绝保稿、原选区Undo、接受consume/new-edit/异workspace interrupt与两正常cold均过；Main34272/38556/40802均code0/signalnull，后验7884source/1778artifact零漂移。
- Home1语言准备漏项已迁真实picker；Home2发现目录autoLoad=false而Home漏传onSkillSuggestionsNeeded，已贯通既有shared bindings/EmptyState/landing/scene回调，无新owner。两回归16通过/2行为失败→最新逐文件5suite140/140；组合138/140和首次隔离68/70的原5秒timeout均保留，最后隔离70/70，未增timeout/skip。标准typecheck、lint、renderer新构建和壳smoke24/24（codex-home-skill-demand-20261015-1）exit0；final-directed-receipt独立记录，不改冻结原收据。Home3/4完整rich已保存但首次正常quit15秒超时，Home4 teardown捕获code0仍不计pass；Home5正常退出，失败为oracle误要求直接preload helper出现在GUI safeInvoke trace。移除仅此错误要求，新回归先红后Node62/62、collector Vitest69/69，输入禁令/原生完整采集/冷零写不变；一次误用Node跑Vitest的失败log保留。freeze16仅两fixture delta、1883产物不变，packet41cf5bfb…。Home6已exit0：完整rich/资源/原选区/identity、两正常Main17922/18120、cold零写/无canonical会话回合、原文件bytes/revision不变；freeze16后验7884source/1883artifact零漂移；settings首轮freshness启动前拦截；最新15key/24首屏状态、157原生read、零console/page/trace error及Main22039正常退出已通过。首发1/2/3 Home失败：真实thread已建但无Turn，directDispatch rejected且null Composer恢复中；第3诊断确认displayContent覆盖canonical Markdown/hidden paste，使UTF8 atom remap正确拒绝。root窄写集为inputCapabilityRouting及test，正文优先原source、display仅回放/无正文fallback；真实回归旧实现2通过/1行为失败，保持remap守卫，五suite165/165、最终窄lint/格式通过，标准typecheck进行中；最新Stop在default会话侧栏恢复前因只读失败；root真实Wiring+Coordinator回归确认业务workspace与可见workspace不一致时两场均留home，2行为失败后composition改为把当前可见workspace传给既有commit handler，epoch/ready守卫保持。窄写集Wiring与新integration；root2/2/public11/11/navigation7/7通过，visible-ready4/5遇原5秒timeout待隔离重跑；最终root2/2、visible-ready隔离5/5与typecheck/lint/格式/renderer+Host构建/contracts/legacy/shell全exit0，原timeout保留。freeze19为7885source/1988artifact，较16仅三改一新增认领文件；packet5d23f655…，pre-GUI零漂移。first-send4 Home完整canonical富输入/资源/consume/new-edit全过，但Main85269正常quit15秒超时，失败保留且显式清理不计normal；first-send5 Home完整接受/消费/新稿及Main96352正常通过，search-new富稿保存冲突超时、Main96982正常teardown；旧probe tombstone存在、新rich未存。Coordinator真实connect/queued put/延迟clear回归110ms纯行为红，窄修pending discard期间禁止旧read重绑、完成失效在途read，Store CAS与retired守卫不改；认领Coordinator及binding test，七suite93项92过/1原5秒Home Stop timeout，隔离Stop20项14过/6原5秒timeout，均无新值/identity断言失败；binding15/15、Coordinator31/31、fresh7/7、navigation7/7、visible-ready5/5、send8/8、lint/格式通过。保留失败，Stop稳定性未关闭；标准typecheck/新renderer20m10s/全segment freshness/壳codex-queued-discard-20261015-1均exit0，收据queued-discard-directed-final-receipt.json。freeze20为7885source/2093artifact，较19仅Coordinator源/test两改，packet c060c3dd…。first6 Home与search全部富输入/资源/消费/新稿及Main85420/85963正常通过；项目click超时，原phase错误显示launch，实际已启动且Main86752正常teardown。fixture只补project header真实hover和source phase，Node53/53/lint/格式通过；freeze21仅该fixture delta、产物不变，packet86b048bc…。first7三入口完整业务断言均过，Home/Main93044与search/Main93526正常，project/Main94143初次quit原15秒超时后teardown正常，整轮fail。first8仅加被动退出计时/失败时自有Main采样，原期限/断言不改，三入口完整Gate exit0，Main99739/655/1318均正常，12.282/1.026/12.636秒；旧退出超时原因仍unknown，不写已修复。rich Stop原场景exit0，零console/page errors；Home7两Main6249/6729正常、完整富稿/选区/资源/identity与cold零写通过。local17三工作区拒绝保稿/原选区Undo/消费新稿/隔离与两正常cold全通过，Main7882/10853/11390均code0/signalnull。packet21前后7885source/2093artifact零漂移，产品收据queued-discard-product-final-receipt.json（2cafe26c…）；原Stop文件在原5秒限制单次20/20（29.02秒/最长816ms）；前两次timeout保留且不推断根因，async-tabs原筛选0/187被guard正确拒绝，进一步清已删ChatSidebar路径/旧标签筛选，迁canonical queue3+current侧栏/专用工作台11，强制完整计数，原入口14/14、lint/格式通过。仅test-only脚本变化，无产品/产物变化；current聚合前三组31/34/3过，guard293/294和collector隔离68/69原5秒超时保留；root仅认领scripts/lib/invoke-trace-collector.mjs及证据/文档，复用已比较相等窗口的摘要、独立oracle逐项重算不变，69/69、溢出用例1571ms；聚合第3轮第15场Skills完成后Composer禁用失败，前14场通过；非Composer接受回执已接既有可见topic commit，最终61/61与typecheck/lint/格式过；新renderer/Host完成，标准wrapper在V8缓存直连超时前未启壳，已用系统现有代理的子进程环境补齐锁定缓存并核官方SHA，sidecar准备及同一标准末端壳smoke均exit0；freshness全ready，freeze22为7885source/2198artifact、零源码漂移。分段恢复不冒称初次wrapper通过；packet22原Skills三路径及全部断言通过，收据imperative-session-skills-product-receipt.json；current第4轮exit0：四组定向31/34/3/294和22实际Electron场景均过，68份固定前缀产物/日志冻结到current-aggregate-4-complete、前后7885source/2198artifact零漂移；default第1轮删除五语言dead placeholder及迁loader/type夹具，42/42；第2轮严格lint揭示Wiring依赖warning，改捕获稳定函数，61/61及零warning；第3轮89批historyWindow原5秒2超时，隔离复现，CPU定位每文案重复合并namespace，改复用既有limeI18nResources，先3过1行为红→六suite81/81，原historyWindow14/14且用例/timeout未改。第4轮全src零warning lint/五语言/typecheck通过，89批147/147后通过至111批；112批122过1旧turn/start夹具失败，迁canonical id/inProgress及同thread identity，定向60/60与严格lint过，freeze27仅该测试delta；resume112通过至122批，123批90过2旧boolean/void夹具失败；复用既有typed accepted fixture并断言完整结果，原dispatch锁/富稿/新编辑/finalize覆盖保留，三suite24/24及严格lint过，freeze28仅该测试delta；resume123至124批通过，125批旧reset integration缺root callback且混同fresh/Home，删除重复旧文件并迁风险至现有root导航/Reset unit；本地富稿编辑保存/完整恢复及null/project返回委托16/16、lint/格式过；freeze29两测试改一删除、7884源；resume125—126通过，127批189过1旧curated usage fixture失败；Inputbar六success/一reject/一pending布尔夹具迁typed，完整Inputbar92+send hook21合计113/113及严格lint过，freeze30仅该测试delta，resume127待验。既有5231行测试仅做fixture窄改、不加业务分支，职责拆分另刀。contracts/legacy已exit0，新标准GUI构建及新产物current22待验。旧wrapper失败保留，按组合门禁记录；packet22旧current22不覆盖后续15源变化与1删除。packet19保留旧身份；整体partial，避让release/local-conversation/tsbuildinfo及媒体热区。
