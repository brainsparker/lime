# GUI 对齐执行历史：2026-10-15 至 2026-10-17

状态：historical / superseded。以下为 current 计划整理前的完整快照，只保留当时事实、失败与证据身份；其中“下一刀”“当前”“待验”均不再作为执行指令。实际进度只读 [current 计划](codex-gui-alignment-current-plan.md) 及其领域计划。原快照 SHA-256：`ad126ab3bfe4d35349ff224cbff1205c652633ce0fc3facb1f7da90a5aa5f0a7`。

---

# Codex Desktop 与 Lime GUI 全面对齐

状态：active / partial。校准日期：2026-10-17。

## 目标与事实源

使用 REA 对齐可确认的 GUI、交互、目录职责、函数、类型、类与调用链，同时直接迁移或删除旧代码、文档、测试、fixture、snapshot 和冲突护栏。仅保留 Lime 主题、多模型支持、首页 Banner，分别继续走 token/skin、catalog/provider 和 Home presentation owner。

- 参考安装包：`/Applications/ChatGPT.app`，实际为 Codex Desktop，Bundle ID `com.openai.codex`，版本 `26.1007.30912`，build `20156`。
- ASAR SHA-256：`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- REA：6.4.0，独立 Node 24.21.0；当前安装、注册与 Evidence 身份见[索引](../research/codex-desktop-rea/evidence-index.json)。
- 公开 runtime 源码：`/Users/coso/Documents/dev/rust/codex`，最近已核 HEAD `31434401fa3cd111866acdc1bba2a73b561f53d5`；安装包附带 CLI 为 `0.162.0-alpha.17.2`，精确构建等价 unknown。公开仓库不含 Desktop 前端。
- 唯一业务链：`Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection`。GUI、CLI/TUI 共享协议、runtime、工具和持久化 owner。
- 研究入口：[差距报告](../research/codex-desktop-rea/report.md)、[结构与命名账本](../research/codex-desktop-rea/structure-alignment-ledger.md)、[证据索引](../research/codex-desktop-rea/evidence-index.json)。

本页仅维护当前进度、写集、退出条件与下一刀。已执行合同、每轮失败和原身份保存在[历史快照](codex-gui-alignment-history-20261015.md)及领域审计/收据，历史清单不再作为 current 指令。2026-10-14 用户删除旧 `.lime/` 后缺失的证据不能恢复为有效原件；本轮重新建立的 freeze/packet 独立记录。

## 当前阶段与写集

主目标仍为全面对齐。专业文件的PDF/DOCX/Workbook/Slides预览、统一批注及应用scope草稿已取得各自固定候选原生证据；1.160.0候选的XLSX普通单元格保存、外部冲突、Workspace重开保稿和提交前flush已验收。CSV/TSV真实保存/重读已在同源prepared sidecar候选6验收，当前补默认门禁，具体失败及重验由[工作簿计划](codex-workbook-alignment.md)持有。Slides正文/对象编辑与导出保存、其余GUI/结构符号和平台证据继续开放；通用flush入口不证明DOCX/PDF正文编辑器存在。共享格式合同与证据范围见[专业文件计划](codex-professional-files-alignment.md)。根Plugin/Cloud仍有并行改动，固定候选通过不推广为最新根通过。

前一切片产品行为沿用已采用的 current owner：非 Composer accepted 回执进入既有可见 topic commit；Agent 文案复用 createI18n 五语言表。epoch、scope、binding.ready、revision、CAS、accepted 消费和新编辑保护保持有效。没有新增业务 runtime、read model、cache authority 或 compat。

前一已关闭切片测试写集：

- current fixture 退出护栏：`claw-chat-current-fixture-smoke.mjs` 仅接入独立 teardown helper 与相邻行为测试，`current-fixture-regression-smoke.mjs` 纳入该回归，复用既有 `captureMainProcessExit/quitMainProcessNormally` owner。只有真实 Main code0/signalnull 和全部资源释放后打印 pass；15秒正常退出期限不放宽，强制回收只允许失败后且永不计入正常退出。巨型 smoke 入口仅替换 finally 接线，不继续堆叠收尾业务；后续仍须拆分原入口职责。
- `useAgentRuntimeSyncEffects.test.tsx`：旧 turn/start 回执迁 `turn.id/inProgress`，hook 与通知共享 canonical thread identity。
- `useWorkspaceSendStructured.unit.test.tsx`：boolean/void 夹具迁完整 typed accepted/rejected，保 dispatch lock、富稿与新编辑保护。
- `useWorkspaceResetRuntime.unit.test.tsx`、`newConversationPublicNavigation.integration.test.tsx`：覆盖根导航委托及编辑后的富稿保存/恢复；重复 `workspaceComposerReset.integration.test.tsx` 删除。
- `Inputbar/index.test.tsx`：六个成功、一个拒绝和一个延迟接受夹具迁 typed result，原 recent usage/恢复/元数据断言保留。既有大测试文件只做夹具窄改；不再增加业务分支，职责拆分另刀。
- 本计划、历史快照、研究报告/审计/索引及 `.gitignore` 精确文档准入。

沿用此前认领的翻译键清理、CommandWiring 与文案资源修复；不覆盖未知 release plan、`local-conversation-page-a83a1af2c24b.js`、`tsconfig.node.tsbuildinfo` 或媒体设置实现。没有提交、推送、重置或创建分支。

## 已采用切片与证据边界

| 范围              | current owner / 迁移                                              | 已取得证据与剩余范围                                                                                                         |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 设计/质量规则     | 两个 Lime skill 与领域事实源                                      | 已按三项保留差异、结构命名和风险门禁更新；不代表产品全面完成                                                                 |
| 长历史/用户正文   | threadVirtualizer、VirtualizedTurnList、共享正文显示              | 原身份真实滚动、动态测量、冷恢复和长正文 Gate 已过；不是完整视觉等价                                                         |
| 审批/Queue        | PendingRequestItemPanel、ApprovalCard、QueuedMessageList          | 同一 server request/decision/queue authority；pending、history/paging/search、图片真实读取有对应证据；自动审查及全部变体待核 |
| Files/diff/右侧面 | ReviewThreadSidePanelTab、ChangesPanel、RightSurfaceHost          | 四文件 diff/定位与 Browser 双 tab/关闭不复活已验收；其他 editor/surface 完整行为待核                                         |
| Composer/NodeView | ComposerController、EditorView、NodeView registry/toolbar/plugins | 单一正文、结构化输入、语言/高亮与 rich Gate 已采用；原类名未知的项目不搬压缩名                                               |
| 持久草稿/新建导航 | Coordinator、Host persisted atom Store/File、useAppNavigation     | packet21 三入口首发、rich Stop、Home 冷恢复、三工作区两正常冷恢复四合同通过，均绑定原源码/产物                               |
| Skills accepted   | CommandWiring -> existing visible topic commit                    | packet22 三路径及 current22通过；最终新构建结果另记                                                                          |
| 设置章节/导航     | 单一 sections、SettingsPage、useAppNavigation                     | 第一切片15章节/24首屏通过；canonical章节/返回第14轮4/4、223原生IPC及正常Main退出通过；内容搜索/其余草稿owner待交付           |
| Thread settings   | scoped EventBus/adapter/既有 cache                                | idle model/cwd 已验收；不推导 active/future Turn 执行                                                                        |

完整映射、调用者、删除项与 Evidence ID 由结构账本和领域审计持有；上表不按同名文件数计算完成度。

## 前一切片已关闭的验证状态

| 验证                       | 结果                             | 身份或限制                                                                                                                                                          |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packet21 四项产品合同      | 4/4通过                          | first-send8、rich Stop、Home7、local17；7885源/2093产物零漂移；旧正常退出超时根因仍unknown                                                                          |
| packet22 current 聚合第4轮 | 22/22通过                        | 定向31/34/3/294，7885源/2198产物零漂移；不能覆盖后续修改                                                                                                            |
| 五语言废弃设置键清理       | 42/42通过                        | 只删无消费者键，loader/type tests迁current键                                                                                                                        |
| CommandWiring稳定函数引用  | 61/61、严格lint通过              | 原窄lint曾exit0带warning，纠正收据保留；后续标准全src lint零warning                                                                                                 |
| 文案资源热路径             | 81/81通过                        | 先3过1行为红；复用既有资源；historyWindow原14项和5秒期限未改，默认89批147/147通过                                                                                   |
| 本轮旧夹具迁移             | 60/60、24/24、16/16、113/113通过 | 分别为通知、Workspace发送、导航覆盖归并、Inputbar；原默认失败日志保留                                                                                               |
| 默认前置检查               | 通过                             | 第4轮版本、五语言结构/unused、全src零warning lint、112源文案扫描、标准typecheck                                                                                     |
| 前端默认续跑               | 132/132批通过                    | 1761历史登记路径，现存1756、已删5；原passed批保留，修改的早期owner另跑定向；不是所有批都在本轮重新执行                                                              |
| contracts / legacy         | 通过                             | 标准test:contracts、legacy report；无边界违规                                                                                                                       |
| 新标准GUI构建/smoke        | 24/24通过、标准wrapper exit0     | run codex-composer-final-shell-20261015-1；freshness全ready，2303目录产物                                                                                           |
| 退出护栏与原审批隔离       | 110/110、66/66通过               | 6项新行为回归；Main34547正常code0/signalnull，327ms，未强制回收。仅fixture变化，不能推导原挂起根因                                                                  |
| 新产物完整current22        | 第7轮22/22、入口exit0            | 四组31/34/3/300；21个Claw正常Main回执、强制回收0；Coding仅保留既有子进程证据。7886源/2303产物和产物路径集零漂移；67份本轮证据独立冻结，旧性能/退出失败根因仍unknown |

默认验证绑定 freeze30 的7884路径，SHA `727cc715a2b6af374ec59d991f8ac436927df53465cf40be48203f4c3be038bd`；退出护栏另建 freeze31，共7886路径，仅4项fixture变化（2修改、2新增），产品与2303产物不变、freshness全ready，无需重建。新聚合第7轮已exit0、22/22通过；packet31位于 `.lime/qc/composer-persistence/gui-verification-packet-navigation-readiness-31.json`，SHA `8dcf4bddbb89e8b6d57f8502f6ec06e18718a14dfc00e8b317fa349fd660e57e`。新测试由定向及聚合执行，不冒充已进入旧续跑状态。默认组合最终收据：`.lime/qc/composer-persistence/default-combined-current-20261015/final-receipt.json`；前置收据：`.lime/qc/composer-persistence/default-combined-current-20261015/pre-gui-receipt.json`。

默认按已过前置检查 + 原生test:resume + contracts + 标准GUI关闭组合步骤；原verify:local wrappers均保留exit1，不改写成单次wrapper绿。续跑不按源码摘要作全量缓存，修改过的owner已单独回归。fixture是受控backend，不能冒充live provider、Windows、系统IME/mic或安装包等价。

## 本切片 Verification Contract 与退出条件

负责人root。风险P1，非live。入口为Home/Inputbar/Skills试用/根新建动作，经真实Electron、preload/IPC、`app_server_handle_json_lines`、current JSON-RPC、runtime/read model到同一canonical thread/turn/item与可见状态。草稿UI保存只走Controller -> Coordinator -> Host Store/File，业务历史仍归App Server。

- Happy path：非Composer接受提交后切到实际可见会话，编辑器恢复可编辑；富输入、资源字节、hidden paste、selection和接受消费可追溯；Home/local冷恢复隔离。
- 失败终态：拒绝保稿、接受后的新编辑不被消费、迟到旧turn不能夺取新scope、pending discard通知不能重绑旧稿；严格身份/readiness/CAS守卫不放宽。
- 测试/护栏：按current方法迁fixture与过期断言；无超时放宽、skip、生产mock fallback或手改续跑状态。旧实现只在负向guard/历史Evidence出现。
- 最终构建后重核全部声明源码、dist、dist-electron和client dist的regular非symlink产物；保留旧chunk的目录manifest不声称全部被加载。
- 标准GUI及新current22均已退出成功，前后源码/产物零漂移。第7轮manifest位于 `.lime/qc/composer-persistence/current-aggregate-7-complete/manifest.json`，SHA `69340c52a05833c450ad6f0d8667add345fa61d262b0aec3a6d8485674c9973c`；summary及其显式ledger/截图和log共67份独立冻结，排除旧前缀遗留失败截图，旧manifest不覆盖。
- 更新索引/报告/本计划，格式、文档边界、脚本治理与diff检查通过，才关闭本验证切片。

架构：持久草稿/新建导航/设置单一章节的重大图变更已由root于2026-10-14/15确认，见[architecture 4.3/4.4/4.5](../aiprompts/architecture.md)。本轮仅既有owner接线、资源复用和测试/文档整理，非重大；不新增authority或依赖方向。

## 设置 canonical 章节与返回：当前切片

负责人 root，P1、非 live、budget:normal；独立收口，不新增 Agent 或提交。主目标仍为全面对齐，本刀只交付章节路由和返回语义。参考复用既有 REA 七 member，Evidence 与精确失败史见[设置审计](../research/codex-desktop-rea/settings-navigation-audit.md)。

写集：`useAppNavigation`、App/AppPageContent 与 PageParams 接线、SettingsPage/SettingsNavigation、既有 workspace surface 的位置回调、五语言返回文案、AppSidebarRail 及对应回归；settings-about/project-gate-settings-a/tool-surface 消费者迁新返回语义。续验追加 `useWorkspaceTaskCenterNavigationRuntime`、会话恢复 integration、pending/reset owner、serviceSkillA2ui 回归、公共 testFixtures 的旧 intent 清理；新增真实导航 fixture 与精确 external backend 护栏登记。release、媒体设置业务实现、未跟踪参考 chunk 和 tsbuildinfo 继续避让。

Verification Contract：唯一导航链 `SettingsPage -> useAppNavigation -> AppPageContent` 持有 canonical 章节/焦点和进入设置的最小上下文；现有 workspace surface 只投影实际 session/workspace，不新增 history、runtime 或业务 read model。requestId 拒绝迟到投影；返回剔除发送、新建、技能启动等一次性 intent。页头返回恢复原可见会话/工作区，rail Home 进入首页。直达无来处、非 Agent 来处及快速导航由 owner/component 回归覆盖。

实现已直接删除 initial-props/local-selection 双轨、隐藏 Home 测试按钮及旧 backHome 文案键；providerView/providerFocus/executionPolicyFocus 和 Experimental 委托保持既有语义，离开章节不重放旧焦点。真实验收暴露的恢复竞态由既有解析器等待 Composer owner 建立解决，generation/scope/epoch/readiness 守卫保持。默认第11批暴露 incoming service-skill 被 route reset 误取消；现仅新建 route reset 保留本次请求，普通 topic reset 取消旧请求，空任务清除旧 intent，目录迟到不能复活旧表单。复用原 handled/dismissed refs，无新 authority；目录加载策略试验已撤回。

| 验证             | 结果与边界                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 导航定向         | 8 suite 108/108；位置测试单独1/1无警告通过，与前者重叠不累加；targeted-final receipt登记17源、8 suite与日志。                                                                          |
| 会话恢复红绿     | 持久workspace场景先2/2红，后5 suite 46/46绿，覆盖已有sidebar请求、编辑与单次hydrate。                                                                                                  |
| 技能 route reset | 真实Home builder/无会话场景仍红后修复，3 suite 11/11绿，含新建清理与迟到目录；backend护栏2/2。                                                                                         |
| freshness        | testFixtures误判有红例，修后32/32；真实源码仍使产物失效；新增testSupport触发第13轮前置失败后正常重建，不放宽规则。                                                                     |
| 默认前置         | 版本/五语言结构与unused、全src零warning lint、文案扫描、标准renderer/node typecheck通过；新增fixture/护栏严格lint/格式通过。                                                           |
| contracts        | 标准test:contracts exit0；不与原生验收并行重写协议源码。                                                                                                                               |
| 标准GUI          | 第4轮wrapper exit0、24/24，所有错误计数为0；护栏登记后renderer另行重建exit0。                                                                                                          |
| Desktop Gate B   | 第14轮整轮exit0、4/4，Home首发返回/已有会话返回/rail Home/技能表单进入后New chat清除；223原生IPC，同一Thread/Turn/Item/workspace，backend turnStart始终1，console/page/trace/mock为0。 |
| 正常退出与身份   | Main79440原15秒内code0/signalnull、约5.593秒、无强制回收；35声明源码、2828目录产物与sidecar前后零漂移，freshness前后ready；目录包括遗留chunk，不表示全部被加载。                       |
| 前端默认续跑     | 原130批从第11/61批失败处修后续跑，最终130/130、exit0，1759个登记文件均存在；未改状态/skip/放宽期限。                                                                                   |
| 最终文档检查     | 格式、docs boundary、scripts governance、本地链接与diff结果由最终组合收据记录。                                                                                                        |

原生1–13轮失败全部保留，不以其中业务断言通过替代整轮成功；第8/9轮无有效sample，第12/14轮被动sample成功但Main正常退出，旧退出超时根因仍unknown。正常退出owner、15秒期限与失败回收规则均未改，无私有Playwright字段或app.exit绕过。第14轮summary SHA `9626c25423ba7780708816dc548d7c01695bc4f6fb41286440d5ffc6c8c6b67b`，独立冻结13份证据见 `.lime/qc/settings-sections/navigation-final-20261015-1/native-evidence-manifest.json`。实际sidecar SHA `d0780858f959f44a170ca11f803e20bfe9f5853d6d5b5a6c772ebd2621d0a2d0`。

证据边界：受控external backend绕过生产RuntimeBackend/provider执行；Host open-url事件不证明OS URL dispatcher；未跑参考实时观察、live、Windows、dirty/search或完整表单。原verify:local wrappers保留exit1；已过前置+原生test:resume+contracts+标准GUI组成最终验证，不改写成单次wrapper全绿。

架构：导航位置投影与incoming route reset语义已同步architecture 4.4，由root于2026-10-15确认；既有owner与业务边界不变。KISS/DRY通过唯一canonical参数消除重复状态；YAGNI不复制未知registry/原压缩名；有效风险由current行为回归守住，旧正向断言直接迁移。

## 设置未保存保护：Memory 配置与 SOUL 首批切片

### 已关闭：配置草稿的统一导航保护

负责人 root；P1、非 live、budget:normal。先交付一个真实表单的纵向合同，不把首批接入写成全设置覆盖。写集为 useAppNavigation、App/AppPageContent、SettingsPage、新的设置草稿报告/确认对话框、Memory 编辑 hook 与配置规范化模块、对应测试、五语言 settings 资源、既有 settings-navigation Electron fixture 及本计划/架构/设置审计。既有导航脏改动由上一刀继承；媒体设置、发布文件、未知参考 chunk 与 tsbuildinfo 避让。其他设置 owner 只读。

参考复用七 member REA full `ev_4bf8bfc7ccb14fb058096dd32864ae7f9ab83a8f0ad9acb46cfd79b5379ab36c`。本次定向读取 settings-page 和 settings-unsaved-changes-dialog：requestNavigation 在 dirty 时保存 pending continuation；对话框只有 Keep editing / Discard changes，关闭清空 pending，discard 先清空再执行。没有保存按钮。外部 dirty registry 仍 unknown，不猜原名。Lime 使用既有导航 owner 保留目标，表单只报告自身 dirty/saving，不复制配置或构建另一 history。

Verification Contract：章节、返回、rail Home、根导航/新建与直达均经过 useAppNavigation；blocked 请求不得改变 canonical page/params、requestId、返回来处或会话恢复存储；继续编辑/Escape 只取消 pending；放弃只提交最后一次目标且不保存草稿。saving 时禁止放弃，取消 pending 后保存完成不得迟到导航。Memory 继续由 getConfig 与既有 updateConfig -> saveConfig 持久化；失败留稿，成功只确认本次提交的 snapshot，不覆盖在途新编辑；卸载后旧结果不得污染新 owner。SOUL 导入预览文本也视为本地未提交输入，不把未应用文本自动保存到 memory。

拆分先行：把规范化与 Memory 编辑/保存生命周期从原 1010 行组件移出，删除原内联实现；页面只消费 hook，不保留双轨。对话框沿用现有 Radix 依赖和主题 token，支持焦点约束/安全初始焦点/恢复、Escape 与五语言。架构数据流在 4.4 同步并由 root 确认后才关闭。

验证：先用真实导航 hook + 实际 Memory 的 component/integration 红绿覆盖上述合同及失败/在途/迟到；再定向 layout/AppPageContent/导航/Memory、五语言、严格 lint/typecheck、标准 verify:gui-smoke、既有原生导航 fixture 新场景和默认 verify:local。真实 Electron 证据复用 current bridge/App Server 与隔离配置，必须记录 IPC/同一 identity/错误和正常 Main 退出；external backend 不冒充 production RuntimeBackend/live provider。协议未改不新增 JSON-RPC 或 mock。证据计划目录 `.lime/qc/settings-unsaved/`；原生失败与默认中断均保留，续跑不改状态/期限。内容搜索与其他表单在后续切片交付。

复核追加：旧整份 config 快照会覆盖表单加载后发生的其他配置修改；新增 language 保留回归先1红3绿。现复用既有串行 updateConfig，只把提交的 Memory 合并到最新配置，删除 hook 的整份 config 状态。新增/迁移测试夹具到该 current mutation owner；7 suite 最终113/113通过。首轮112/112与原8项全红均保留，不当作最终源码绑定。补跑严格 lint/typecheck 与真实 config API 串行/CAS边界；默认前端最终130/130批通过，组合验证见下表。

SOUL 预览跟进：新增回归先1红13绿，确认修改原文后旧预览仍可应用；现在原文编辑立即使预览失效，重新预览后才能应用并消费当前输入。最终7 suite 114/114通过。28份声明文件的初版freeze保留；仅Memory页面与integration测试这2项因该补丁改变，该产品补丁freeze为 `.lime/qc/settings-unsaved/declared-source-before-2.json`，其后仅原生fixture修正形成before-3，不覆盖初版。其余原生/default验收绑定最终源码。默认第62批的既有 agentRuntimeExportBoundary 全仓扫描在原5秒超时，原wrapper exit1与log保留；未修改guard/期限，单独复核4/4通过（tests约3.27秒），标准 test:resume 从第62批继续。该次耗时根因仍unknown。声明文件格式通过；宽目录格式检查命中3份未改动旧文件，已保留失败log并缩窄到28份声明文件，不夹写旧文件。

本切片已关闭：新增6项原生合同6/6（100%，仅配置与SOUL范围），原有4项导航合同4/4；不是整个Memory页面或全设置覆盖。最终组合收据 `.lime/qc/settings-unsaved/final-20261015-1/receipt.json`，独立冻结56份验证/截图/失败证据，以及28份声明文件、43份原生声明源码和2934份目录产物清单。目录包含遗留chunk，不表示全部被加载。

| 验证                | 最终结果与边界                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 定向 / 配置边界     | 7 suite 114/114；另2 suite 21/21验证既有配置串行/CAS owner。初始8项、配置覆盖1项、预览1项红例均保留。                                                                                   |
| 默认前置            | 五语言结构/unused、全src零warning lint、13源文案扫描；最终产品补丁后renderer/node typecheck再次通过。                                                                                   |
| 默认前端            | 130/130批、1761个登记文件均存在；原wrapper第62批5秒扫描超时exit1，未改guard/期限；单独4/4后标准test:resume exit0。                                                                      |
| Contracts / 标准GUI | test:contracts exit0；标准verify:gui-smoke wrapper exit0、24/24、所有错误与mock计数0。                                                                                                  |
| Desktop Gate B      | 第3轮整轮exit0：四路继续编辑/放弃、实际保存/重读/原值恢复、SOUL输入保留/Cancel；原会话/工作区及Turn/Item identity不变，backend turnStart始终1。440原生IPC，console/page/trace/mock均0。 |
| 退出与身份          | Main54663原15秒期限内正常code0/signalnull，630ms，无强制回收。43原生源码/2934目录产物/sidecar前后零漂移，freshness前后ready；冻结前另核28份声明文件和全部产物。                         |

原生第1轮停于rustup shim的cargo metadata代理连接，尚未启动Electron，终止自有进程后记录exit143与abort receipt；具体rustup网络操作仍unknown。第2轮配置放弃已进入已安排任务，但fixture错误地在任务列表寻找会话行，120秒超时；Main42993正常退出。现fixture经可见Home再打开原会话，只有该helper变化，before-3保留前两版freeze；生产源码/构建不变，因此不重复构建或全量前端。第2/3轮显式使用标准构建刚生成的APP_SERVER_BIN，SHA `d0780858f959f44a170ca11f803e20bfe9f5853d6d5b5a6c772ebd2621d0a2d0`，未修改工具链或生产fallback。

默认按前置+标准续跑+contracts+标准GUI组合关闭；原verify:local保留exit1，不写成单次wrapper全绿。参考静态代码、组件回归与原生证据分别成立：保存失败/在途编辑/迟到/五语言由组件证明；原生只证明实际执行的配置/SOUL路径，external backend仍绕过production RuntimeBackend/provider。未覆盖live、Windows、参考实时效果、OS URL dispatcher、窗口关闭、页内修正笔记等其他表单或内容搜索。

架构判定为非重大：既有renderer owner内拆分与dirty/saving显示投影接线，无crate/package、协议或业务authority变化；architecture 4.4已同步并由root于2026-10-15确认。KISS/DRY以单一导航和单一编辑hook消除内联副本；SOLID分开规范化、表单生命周期和导航确认；YAGNI只迁已确认行为，不复制未知registry/原压缩名。current为新hook/纯模块/guard/dialog及既有配置owner；compat仅原Experimental委托，新增0；deprecated新增0；dead/deleted为原内联加载/保存/取消、整份过期config状态和失效预览可继续应用的旧行为。

### 已关闭：页内修正笔记草稿

负责人 root；P1、非 live。本刀复用上述 REA 确认的导航合同，不声称参考端存在同名笔记组件。窄写集：MemoryStoreStatusPanel、独立 MemoryNoteEditor、实际 Memory 页面的导航/保存回归、既有 settings-navigation 原生 fixture 的笔记子场景，以及本计划/架构/设置审计/账本/索引。原配置与 SOUL 实现只读；其他设置、release、未知 chunk 与 tsbuildinfo 避让，不新增 Agent 或提交。

Verification Contract：笔记输入与 Memory 配置分别向同一 useAppNavigation 报告 dirty/saving。章节、返回、Home、根导航与新建须保留输入直到显式放弃；确认不得调用 addNote。保存仅走既有 memoryStore/addNote，捕获输入版本并只消费该版本，失败留稿、拒绝重复提交、在途新编辑保留；卸载后的结果不得清理新 owner、刷新或通知。保存期间禁止放弃，取消 pending 后成功不得迟到导航。配置保存/取消不能清除笔记保护，反向也成立。

先以实际 Memory 页面复现导航与在途清稿缺陷，再抽离原内联笔记表单和保存职责，不保留双轨。复用五语言文案与主题 token，补可访问名称。审阅、重建、整理、重置均为即时 canonical 命令而非本地草稿；本刀只读其边界，不宣称完成它们的在途/迟到验收。验证为定向红绿、严格 lint/typecheck、默认 verify:local、标准 GUI smoke、真实 Electron 笔记保存/读取及同一 Thread/Turn/Item，保留失败与原超时。证据独立落在 `.lime/qc/settings-note/`，不得覆盖上一切片冻结目录；退出条件是声明合同与证据通过且文档同步。此为既有 renderer 内职责拆分，非重大架构，完成前同步 architecture 4.4 并确认。

实现与定向复核：实际 Memory 页面初始10/10红，确认五路离开缺保护、同一事件重复写入和卸载后刷新/日志；另追加页签回归3红16绿，确认局部页签卸载会丢稿。已拆出 MemoryNoteEditor，输入版本与同步保存锁直接替换旧内联逻辑；日常面板保持唯一实例并由 hidden 控制可见性。写集因此窄增 index.tsx 的挂载接线与 index.test.tsx 的可见控件选择器，配置/SOUL业务逻辑不改。旧测试对隐藏控件的模糊 Save 匹配和“所有 textarea 必须删除”断言迁为实际可见控件，保存数据断言保持；原定向6失败日志保留。最终9 suite 126/126（含新20项）及严格lint通过。architecture 4.4 已同步，由root确认非重大。KISS/DRY复用导航注册与现有addNote，不新增通用草稿store或compat；current为独立笔记组件/既有导航与持久化，dead为原内联表单、无条件清稿与卸载后迟到刷新路径，compat/deprecated新增0。

本切片声明的原生合同6/6（100%，仅修正笔记范围）已通过：四类离开动作继续编辑/放弃均不写入；配置Cancel与两个局部页签保留同一草稿；显式保存仅新增一份文件，经真实preload/App Server的memoryStore/read逐字核对完整Markdown，干净离开后重新打开为空。最终独立收据 `.lime/qc/settings-note/final-20261015-1/receipt.json`；前一配置/SOUL收据不变。默认门禁后的变更只有两份原生fixture：修正笔记目录与恢复真实工作区选择/记录几何；产品源码未改，不重复已通过的全量前端或构建。

| 验证           | 最终结果与边界                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 定向           | 9 suite 126/126，新笔记integration 20项；初始红例、局部页签红例与旧选择器6失败均保留。失败、重复提交、在途编辑、卸载迟到和五语言由组件回归证明。                   |
| 默认门禁       | 标准verify:local整轮exit0；版本、五语言结构/unused、全src零warning lint、15源文案扫描、renderer/node typecheck、contracts与标准GUI均通过。                         |
| 默认前端       | 130/130批、1762登记文件均存在，新测试在默认集合；未续跑、未改状态/skip/期限。冻结状态SHA `549def83ac0931088e706f6371edbb945ddc42107f1e99a371097e563fa6df98`。      |
| 标准GUI        | `standalone-shell-01-20261015153011-90852` wrapper exit0、24/24，所有错误/mock计数0。                                                                              |
| Desktop Gate B | 原生第5轮整轮exit0，新增笔记6/6；原配置/SOUL6项与导航4项继续通过；653原生IPC，console/page/trace/mock均0，同一Thread/Turn/Item/workspace，backend turnStart始终1。 |
| 退出与身份     | Main22858原15秒内正常code0/signalnull，698ms，无强制回收；46原生声明源码、3039目录产物与sidecar前后零漂移，freshness前后ready。目录含遗留chunk，不表示全部被加载。 |

原生前三轮失败保留：第1轮helper误用`notes`目录，按既有Rust owner改为`extensions/ad_hoc/notes`；第2轮工作区候选项在视口外，120秒原期限失败；第3轮误把配置绑定视为UI已选择，实际Home workspace为null，断言阻止发送。第4轮恢复真实选择，先正常scrollIntoViewIfNeeded，记录触发器/菜单/候选项几何与截图后正常click，workspace断言保持；该轮菜单完整在视口内。第4轮已整轮通过；收尾格式检查仅将截图语句折行，最终格式的第5轮再次整轮exit0并作为最终身份。未用force/JS click、未修改产品菜单、未降低合同；第2轮越界的底层原因仍unknown，不能称其产品缺陷已修。前三轮Main均正常退出，失败流程不计Gate B通过。

第5轮summary SHA `0f4060df21e91812c75d3a2d1aa063e071346fa13f4d01e2d09c7f6c50d4a7a6`；sidecar SHA沿用本轮标准构建的`d0780858f959f44a170ca11f803e20bfe9f5853d6d5b5a6c772ebd2621d0a2d0`。独立收据冻结验证、前三轮失败、原生截图及声明/原生/产物/文档清单。受控external backend仍绕过production RuntimeBackend/provider；参考实时效果、live、Windows、窗口关闭、其他表单与内容搜索未验证，整体GUI仍partial。参考笔记原符号与dirty registry类型仍unknown，Lime组件名称不冒充上游恢复名。原生截图还显示保存按钮在该宽度下折行，作为后续布局修复项保留，本切片只关闭声明的草稿/保存行为合同。

### 已关闭：Web Search 草稿 owner（2026-10-16）

负责人 root；P1、非 live。本刀继续复用匹配版本 REA `settings-page` / `settings-unsaved-changes-dialog` 的 requestNavigation、pendingNavigation、继续编辑/放弃合同；不声称恢复参考端同名 Web Search 表单、字段 registry 或原始类型。窄写集：`system/web-search/` 的页面、独立配置投影/合并与编辑生命周期、页签组件和实际表单回归；MemoryNoteEditor 只修已观察到的按钮压缩换行；既有设置原生 fixture 增加 Web Search 子场景与按钮几何检查；本计划/架构/设置审计/结构账本/索引/报告及 scripts README。其他设置、协议、release、未知chunk和tsbuildinfo避让，不新增Agent或提交。

Verification Contract：Web Search 的全部编辑输入（含尚不合法的数字、列表和自定义模板）由同一表单owner保存，局部页签只切可见区域；章节/返回/Home/根导航/新建经既有useSettingsDraft到唯一useAppNavigation保护。继续编辑保留原输入，放弃不写配置；保存时拒绝重复提交/取消/放弃，失败留稿，成功只确认提交的版本，不能覆盖在途新编辑或在取消pending后迟到导航；卸载后的加载/保存结果不通知新owner。只通过既有串行updateConfig将Web Search拥有的字段合并到最新配置，保留语言/Memory、image_gen其他字段、MSE既有引擎与未被编辑的配置；不保有整份config快照。加载失败不能启用保存，reload仅重试初始加载，不能在保存失败后覆盖草稿。数值归一化继续既有边界，不把非法输入的归一化误判成干净稿。

先对实际表单补红例，拆分原超过1000行的owner后运行定向行为/配置边界、严格lint/typecheck、默认verify:local与标准GUI，最后跑真实Electron配置保存/重读/恢复和同一Thread/Turn/Item。原生使用隔离配置与current bridge，外部backend不证明live provider；不会把密钥或完整配置落到证据。新增证据独立在`.lime/qc/settings-web-search/`，不覆盖已冻结的笔记收据。退出条件为本合同通过、旧副本删除、文档和架构4.4同步确认；新hook/组件是职责名，不冒充未知上游符号。整体GUI继续partial，其他表单与内容搜索后续交付。

实现阶段：实际表单新增13项先11红2绿，保留`.lime/qc/settings-web-search/red-1.log`。现拆分约200行页面、独立草稿hook/纯配置模块、四个页签及展示原语；原内联加载/保存/current字段副本与定时器删除。保存以字段差异合并最新配置，MSE只更新当前代表的一条自定义引擎，保留其他条目和enabled值；同名冲突拒绝写入。保存期间按字段版本接纳未再编辑的响应，不能因另一个字段编辑而把旧的未编辑值重新标成待保存。旧13项页面用例只迁updateConfig夹具，完整提交断言保持；一次新增在途用例因夹具未反映已保存配置而失败，已让夹具模拟canonical保存后读回，产品不为夹具恢复整份覆盖。最终定向5 suite 80/80（Web Search新integration24、纯合并5项）及严格lint通过。用户错误消息统一五语言且不输出后端配置值；新展示代码直接使用既有主题token，笔记按钮加shrink-0/nowrap。architecture4.4由root于2026-10-16确认非重大。默认及本切片原生验收已通过，结果和边界如下。

本切片声明的Web Search原生合同6/6（100%，仅此表单范围）已通过；另完成笔记Save按钮单行布局检查。独立收据`.lime/qc/settings-web-search/final-20261016-1/receipt.json`，前两轮冻结收据保持原摘要。源码清理、定向、默认和原生分别闭环，不能推广到全设置或整体GUI；全产品分母仍未穷尽。

| 验证           | 结果与边界                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 定向           | 5 suite 80/80；Web Search integration 24、纯合并5、旧页面13；初始11红2绿及两次测试夹具失败日志保留。                                                                        |
| 默认门禁       | 标准verify:local整轮exit0，版本、五语言结构/unused、全src零warning lint、25源文案扫描、renderer/node typecheck与contracts通过。                                             |
| 默认前端       | 新一轮130/130批、1764登记文件均存在，新2测试文件已执行；无resume、skip或期限放宽；状态SHA `e598c23cd9212b423dc9b1c79aac9e759320451d5b7533eff088fdab198f6565`。              |
| 标准GUI        | `standalone-shell-01-20261015175218-53702`整轮exit0、24/24，错误和mock计数0。                                                                                               |
| Desktop Gate B | `settings-web-search-native-20261016-1`首轮整轮exit0；四类离开不落盘、三个局部页签/Cancel保稿、GUI保存/读回/重开/恢复共6/6；原导航4项与Memory配置/SOUL、笔记各6项继续通过。 |
| 身份与退出     | 849原生IPC，console/page/trace/mock均0；同一Thread/Turn/Item/workspace，backend turnStart始终1；Main54930原15秒内正常code0/signalnull、358ms、无强制回收。                  |
| 防漂移         | 22声明源码、57原生源码、3145目录产物和sidecar零漂移，freshness前后ready；目录含遗留chunk，不表示全部加载。                                                                  |
| 笔记布局       | Save为72×32，文本高16/行高16，scrollWidth/clientWidth均72，nowrap/shrink0；截图人工复核通过，仅证明此次窗口宽度。                                                           |

summary SHA `bfb14dfc8ee496bfee84bac7c298c4a949e657069231c5342c544187b179e0d6`；sidecar SHA `d0780858f959f44a170ca11f803e20bfe9f5853d6d5b5a6c772ebd2621d0a2d0`。默认期间仅原生fixture的一条scope说明澄清，产品无改动；最终fixture严格lint、格式和本次完整原生运行均通过。Web Search保存走连续renderer trace的config/batchWrite；精确config/read由既有helper经真实preload/IPC执行，不能要求该直接helper追加renderer trace。配置只在内存比较，不落凭证值。

current为独立草稿/投影/展示与既有导航、配置authority；dead/deleted为旧内联生命周期、整份Config快照保存和成功定时器；compat/deprecated新增0。KISS/DRY复用既有导航与串行updateConfig，SOLID拆分页面/生命周期/纯配置，YAGNI不复制未知registry或新后端。受控external backend仍绕过production RuntimeBackend/provider；失败、重复、在途、迟到、凭证和五语言属于组件证据；live搜索、Windows、其他表单、窗口关闭、完整主题和参考实时/像素等价均未验。原工作区菜单越界根因仍unknown。原生最终停在新会话Home后正常退出，URL为`file:///index.html?nativeStartup`，无新增bridge/mock缺口。

### 后续：其他草稿 owner 与内容搜索

Memory配置/SOUL、修正笔记、Web Search 和 ProviderSetting 的草稿生命周期已分别交付，不能以配置验收代替独立表单。Environment、Execution Policy 已分别验收；当前按真实消费者继续核实 Profile 行内编辑、MCP 本地 editor、Developer crashConfig、Skills 仓库与 Scaffold 表单。

Execution Policy迁移前只读发现（2026-10-16）：原`system/execution-policy/index.tsx`约1215行，持有fullConfig并以加载时整份配置保存agent；loadConfig依赖t的effect会重新读取，保存只有React saving状态且未接useSettingsDraft。此记录为迁移前风险快照，当前实现与验收见下方独立切片；network rule focus、规则编辑/删除和权限默认值继续覆盖。

Media Services 自定义 prompt/数量在 blur/commit 才保存；Appearance 立即保存并失败回滚；认证输入单列且不采集凭证。Skills 安装在途、媒体子设置、模型添加/导入等弹窗、完整 autosave 与内容搜索仍待单独验收，清单尚未穷尽。每个 owner 先确认真实编辑/保存语义，再接同一 requestNavigation/pendingNavigation，不复制未知 registry、原始符号或隐藏功能。

## 已关闭：ProviderSetting 草稿与切换

负责人 root，P1、非 live、budget:normal。目标是让 Provider 设置表单与 Codex Desktop 的编辑生命周期一致：同一 Provider 的投影刷新不得清空本地草稿，保存结果不得覆盖保存期间的新编辑，Provider 内部切换与设置根导航必须经过统一的未保存变更护栏。

Verification Contract：

- 同一 Provider 的 `models`、`api_host` 或 API Key 投影变化，只同步未被用户编辑的字段；Provider ID 真正改变时才重置表单。
- API Host/API Key 保存采用字段 revision 与 mounted/provider identity 守卫；旧请求完成时不能清除新编辑，失败时保留输入，卸载后不再写入新 Provider 状态。
- 模型输入草稿、API Host 草稿、API Key 草稿和图片命令草稿进入 `useSettingsDraft` 的 dirty/saving projection；导航离开设置时继续复用既有 `SettingsUnsavedChangesDialog`，不记录真实凭证。
- Provider 列表内部切换在存在草稿或保存中时先展示继续编辑/放弃确认，放弃后才调用 canonical `selectProvider`；不使用浏览器原生 `window.confirm`。
- 先补红例再实现：ProviderSetting rerender 保稿、deferred save 新编辑保护、保存失败保稿、卸载/切换隔离、设置导航 dirty/saving。定向测试通过后再运行 contracts、GUI smoke 与 verify:local。

写集：`src/components/api-key-provider/ProviderSetting.tsx`、新建 `useProviderSettingDraft.ts`、`ApiKeyProviderSection.tsx` 及对应 UI 测试/fixture；不修改 Provider API、Runtime、未跟踪产物和上一切片退出护栏。

2026-10-16 本刀已完成：`useProviderSettingDraft` 按 Provider ID 保持 Host/Key 草稿并以 revision、mounted/provider identity 防止迟到结果覆盖；ProviderSetting 同步未编辑的 props，模型提交增加 saving/revision 回滚；Provider 列表内部切换复用既有未保存对话框，模型输入与图片命令草稿也纳入 dirty/saving；五语言新增模型保存失败文案。定向 UI 47/47、Provider/设置回归 77/77、typecheck、窄 lint、i18n 100%、contracts、真实 Electron `verify:gui-smoke` 与默认 `verify:local`（130/130 批）均通过。最新 GUI smoke summary 为 `.lime/qc/project-gates/standalone-shell-01-20261016001247-8539/shell-01-electron-smoke/summary.json`（SHA256 `5fdfe1deeca33eafeb5738c3c16ed0c784fcbc07ce568e6b8ed0f7789c1a4276`）。历史收据：`.lime/qc/provider-setting/final-20261016-1/receipt.json`，SHA256 `27916bf3116bc4fad207d52a16c0e8727f7fcba027864f2502a6fa3989a1e0d3`（本地原件已被外部清理，仅保留历史身份）。本刀未使用真实凭证或 live provider；Windows、安装包和完整设置搜索仍未验证，整体 GUI 保持 `partial`。

## 已关闭：Environment 草稿与保存 owner

负责人 root；P1、非 live、budget:normal。复用匹配版本 REA `settings-page` 的 requestNavigation / pendingNavigation 与 `settings-unsaved-changes-dialog` 的继续编辑/放弃合同（full Evidence `ev_4bf8bfc7ccb14fb058096dd32864ae7f9ab83a8f0ad9acb46cfd79b5379ab36c`）。本轮重核安装包版本、两份保留 member 的 SHA 与原字节锚点，无重复分析或参考应用执行。Environment 表单/dirty registry 的上游原始符号仍 unknown；新名字表达 Lime 职责，不伪装恢复名。

写集：`system/environment/` 的页面、编辑生命周期、纯配置投影/合并、预览与展示原语及回归；既有 settings-navigation fixture 仅新增独立 Environment 子场景、调用与身份登记；本计划、架构4.4、设置审计、结构账本、研究报告/索引与 scripts README。其他设置/协议/release/未知 chunk/tsbuildinfo 继续避让。不提交或创建分支。

Verification Contract：实际输入经同一 useSettingsDraft 注册 dirty/saving，章节/返回/Home/根导航/新建均先保护输入；继续编辑和放弃不写入配置。保存只通过串行 updateConfig 合并用户编辑的 Environment 字段，开关与超时分别判定，未编辑配置不得覆盖；变量列表是同一原子字段。保存有同步拒重锁，失败留稿，成功只接受本次提交后未再次编辑的字段，保存期间拒绝放弃，取消 pending 后不得迟到导航。加载/保存/预览卸载迟到不得通知新 owner；预览请求由版本拒绝旧结果。空/越界超时原文保留到保存时按既有数值边界归一化；语言切换不能重新加载输入；敏感值默认遮罩、错误不输出后端值。变量名编辑保持输入节点与焦点。

实现：原1015行页面的整份Config副本、内联加载/保存和重新加载覆盖路径已删除。`useEnvironmentSettingsDraft` 独立管理草稿/基线、字段版本、保存锁和预览生命周期；`environmentConfig` 只投影和合并 owned fields；预览/展示组件分离，页面约600行。固定浅色样式迁现有语义token，按钮保单行；不新增runtime、缓存authority或持久化。KISS/DRY复用导航与updateConfig，SOLID按编辑/纯转换/展示拆分，YAGNI不实现未知参考registry。架构影响非重大，沿用architecture4.4既有图，root于2026-10-16确认owner/依赖/数据流。

定向4 suite 51/51与严格lint通过；上一首刀11/11及其typecheck只覆盖当时源码，不代替最终默认门禁。扩展测试首轮两项因英文预览断言写成不存在的 `Imported: n` 失败，已改用实际五语言资源，保留失败事实；纯展示与组件混导出的Fast Refresh警告通过按职责拆文件消除，未disable护栏。实现阶段随后进入默认与fresh产物的真实Electron验收；原五路原生预期经实际壳入口核实后校准为四路，New仍保留组件回归。最终核对同一Thread/Turn/Item、单次turnStart、trace零错误/mock、原15秒内正常Main退出与源码/产物无漂移；结果见下方最终收据，不把壳smoke当作Environment写入验收。

默认门禁第80/131批失败：前79批通过，`CanvasWorkbenchLayout.coding.test.tsx`三项与`ChatModelSelector.integration.test.tsx`两项触发原5000ms超时，wrapper exit1。失败日志与smart状态冻结在`.lime/qc/settings-environment/validation-20261016/verify-local-failed.log`及`verify-local-failed-smart-state.json`；先按原期限复验两文件，再由默认入口续跑，不能手改状态或重跑前79批。只读观察发现同期CPU与内存竞争，尚不能归因为唯一根因；没有关闭用户应用或更改系统设置。

验收证据生命周期（2026-10-16 09:31）：运行中发现整个`.lime/qc`被外部清理；上述日志、首刀收据和更早切片的本地收据/截图现已丢失，历史通过记录不能冒充仍保留的可复核产物。首次定向复验12项中10通过、2项仍超时；因重复lint长期运行曾停止该次owned ESLint，随后停止写入已删除日志的owned wrapper，不触碰用户其他进程。`.lime/test/vitest-smart-last-run.json`保留原79 passed/1 failed/51 pending，SHA仍为`3e161bf0db88e9732ab0c30ba1906768c9b5cbf82b6e94356f81273b5061fb23`；16份声明源码摘要全部匹配。状态/源码清单/清理观察已备份，新的验证在`.lime/qc/settings-environment/recovery-20261016/`重建，并同步副本到系统临时目录。默认门禁重新收集前置证据并自动续跑未完成批次；不恢复或改写原状态，不重新运行前79批，不把丢失的日志写成保留成功。

恢复轮已通过版本、五语言结构/unused、全src零warning lint、34源文案扫描与renderer/node typecheck；原第80批两文件12项在原5000ms期限下通过。第104批另有Profile的locale统计一项超时，wrapper exit1，Environment三文件37项均通过；新失败日志及状态已双份保存。Profile随后按标准单worker配置定向7/7通过，原失败项639ms，无产品或测试修改。继续使用`npm run test:resume`保留前103批，不再重复已通过的前置；最终必须以组合验证记录，不能写成单次wrapper全绿。

原生入口校准：第1轮在设置页定位不存在的会话侧栏New按钮失败，Main正常退出；第2轮误复用同样已卸载的AppSidebar搜索快捷键失败，且Main在原15秒内未退出，强制回收仅清理资源、不计通过。`useAppShellLayout`在settings卸载AppSidebar，SettingsNavigation只提供四路可见离开入口。已删除错误fixture操作，原生合同校准为四路导航加保存/重开/恢复共5项，New继续保留组件集成证据并明确原生未验，不能写成五路真实导航。第3轮使用原超时和同一退出合同重新执行；产品源码无变化，只有独立fixture修正。原生两轮失败均保留；第2轮退出超时根因unknown。

最终验收（2026-10-16）：独立收据`.lime/qc/settings-environment/final-20261016-3/receipt.json`。本切片可见入口的原生合同5/5（100%，四路导航加保存/重开/恢复），主题投影4/4单列；New仅组件证据，不属于这5项。最终页面598行，旧1015行页面的整份Config副本、内联保存/重读、无条件覆盖草稿与名称key重挂载均为dead/deleted；current为独立草稿、纯配置、展示/预览与原导航/配置authority，compat/deprecated新增0。结构职责已迁移，但参考表单原符号仍unknown；不声称源码或像素等价。

| 验证           | 最终结果与边界                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 定向           | 恢复后4 suite 51/51通过；Environment页面8、纯合并7、实际表单integration22，另含导航14。五路canonical导航、失败/重复/在途/迟到、预览、焦点和五语言由组件证明。              |
| 默认组合       | 恢复轮前置通过；前端续跑131/131批、1766登记文件均存在，新测试均执行；contracts通过；标准GUI24/24、错误/mock均0。原wrapper exit1与停止轮143保留为历史记录，不能称单次全绿。 |
| 默认状态       | SHA `7763fb80182ae0e0d499a0341cd93f54c34fd8c257e85ce2834782ad644d75d7`；前79批使用清理后幸存的原状态，原日志丢失；80–131批有恢复日志，104批超时与7/7定向复验保留。         |
| 标准GUI        | `standalone-shell-01-20261016024423-71774`，wrapper exit0，summary SHA `402c0fbbdbc33a4ee3c522331ce5c13b1554837e02a2d1f98ff9b27d1b2f3b44`。                                |
| Desktop Gate B | `settings-environment-native-20261016-5`整轮exit0；1058原生IPC，console/page/trace/mock均0，同一Thread/Turn/Item/workspace且backend turnStart始终1。                       |
| 身份与退出     | 64原生源码、3566目录产物和sidecar前后零漂移，freshness前后ready；Main40864原15秒内正常code0/signalnull，918ms，无强制回收。                                                |
| 主题           | 浅色、深色、system+模拟light/dark共4项，当前皮肤/1440×1000截图人工复核可读、无横向溢出；不证明OS主题事件或全skin/宽度。                                                    |

最终summary SHA `66302537bee3c066ee790eafddac53c5f0aa55c99d0355e0038c015b9f085fd3`；sidecar SHA `d0780858f959f44a170ca11f803e20bfe9f5853d6d5b5a6c772ebd2621d0a2d0`。产品源码自默认门禁前未变；唯一后续写入为独立fixture修正，最终严格lint/格式及完整第5轮重新通过。原生第3轮错误地将Rust省略默认environment与显式默认字段判为差异；改按core config的默认值投影并使用对象语义比较，其余字段仍完整核对。第5轮记录initialPresent=false/savedPresent=true证实省略规则。第4轮主题/语言的“跟随系统”同名导致严格定位失败，改为完整主题可访问名称。前三个fixture问题均未改变产品实现或降低字段断言，四轮失败summary/log/截图保留；第2轮Main退出超时根因仍unknown，强制回收不计通过。

本轮QA删除只涉及被替换实现及过期保存fixture；旧风险由current行为回归承接。更早QC产物丢失已同步研究索引，不伪造恢复。受控external backend绕过production RuntimeBackend/provider；live Shell导入、Windows、安装包、全皮肤、设置内容搜索与其他表单未验，整体GUI保持partial且全产品分母未枚举。后续Execution Policy实施与验收见下方独立切片。

## Execution Policy 草稿与字段保存（已验收）

负责人root，P1、budget:normal、非live。参考复用同版本REA settings-page的requestNavigation/pendingNavigation与继续编辑/放弃合同；版本、ASAR及member摘要沿用上述冻结原字节。Execution Policy表单与dirty registry的原始符号仍unknown，不把新职责名当作恢复名。

写集限于`system/execution-policy/`的页面、草稿生命周期、纯配置投影/合并、规则/来源展示和回归；原生导航fixture只登记独立子场景及源码身份；本计划、architecture4.4、研究审计/账本/报告/索引和scripts README。其他连续任务改动、未知chunk、tsbuildinfo和外部仓库避让，不提交或建分支。

Verification Contract（实现前）：

- current主链：ExecutionPolicySettings -> appConfig.updateConfig -> config/batchWrite -> 真实preload/IPC/app_server_handle_json_lines -> App Server配置owner；config/read返回canonical设置。RuntimeCore与Thread/Turn/Item不修改，原生场景继续核对同一identity及单次turnStart；本刀不执行shell/network工具或live provider。
- 实际表单的dirty/saving进入既有useSettingsDraft；章节/返回/Home/根导航/新建经过同一导航owner。继续编辑、放弃不落盘；保存中拒绝放弃，取消pending后保存完成不导航。
- 草稿仅持有本页编辑字段，沙箱三个开关分别合并，update_plan与bash warning独立，命令/网络列表各为原子字段。串行updateConfig合并latest，保留未编辑配置、agent模型参数、其他tool overrides和未编辑规则；仅编辑bash策略时在latest上归一化Bash/bash，不写入默认模型字段。
- 同步拒重锁、字段revision和mounted守卫保护失败、在途新编辑及卸载迟到；语言切换只翻译，不重新加载。初始失败禁用编辑/保存并允许重试；dirty/saving禁止reload覆盖；pristine保存禁用。错误使用五语言既有消息，不显示后端配置值。
- 保留规则增删改、诊断定位/高亮/建议规则、来源层级和Windows readiness。固定浅色样式迁语义token，验证light/dark/system投影。页面拆到800行以下，不新增配置authority、导航registry或runtime。
- 先实际表单红例，再定向unit/integration和严格lint/typecheck；默认verify:local、contracts、fresh GUI smoke及真实Electron四路导航+保存/读回/重开/恢复+规则定位分别收据。New只组件证据，设置原生无该入口。证据写`.lime/qc/settings-execution-policy/`并备份到系统临时目录；不记录配置值/凭证。release/Windows/live不适用，本刀不宣称其验收。

架构影响非重大：仅既有renderer表单职责拆分，沿用architecture4.4图及配置/导航owner，root于2026-10-16确认目录、数据流、依赖和门禁。退出条件为上述合同分别验证与文档/旧保存fixture迁移完成；整体GUI仍partial，分母未穷尽。

旧资产同步迁移：发现既有`settings-execution-policy-fixture-smoke.mjs`仍要求原始EISDIR文案、旧data-active选择器与dirty Reload丢稿；同一写集扩展至该fixture及其evidence scope说明，改为aria-current、安全错误、失败保稿和Save重试，保留隔离真实IO失败与三次冷启动读回。evidence同步改为method-scoped配置写入请求、GUI保存确认、冷启动读回及独立同边界RPC IO核验；不能由IPC success推断RPC成功，所有transport error均拒绝；不恢复旧UI迁就fixture。

验证阶段发现并回写（2026-10-16）：首轮默认verify:local整轮exit0，131/131批、1768登记文件、contracts和标准GUI24/24通过；原生导航首轮整轮exit0，四路导航加保存/读回/恢复5/5、规则CRUD与四主题边界检查通过，1269 IPC、错误/mock零、Main17316正常611ms退出，75源码/3672目录产物/sidecar无漂移。该轮只证明当时源码；截图人工复核发现深色删除文字对比不足，已将本域删除/错误前景迁至主题foreground，新增四主题规则控件4.5:1对比度护栏，最终默认与原生需重新通过。第一轮Cargo metadata路径发现闲置超过3分钟，仅终止owned查询；既有fallback选择经摘要验证的同一current binary，没有改runtime/门禁，原因unknown，观察记录保留。

冷启动fixture首轮exit1，失败为旧fixture等待transport error，实际配置IO错误在JSON-RPC response内、IPC本身成功。不能继续用error ring判断RPC错误，也不能把所有成功IPC计为成功保存；已迁移上述合同，补9项evidence回归（含缺少保存确认/IO证明和非正常退出拒绝）。实际GUI失败保稿与独立真实RPC IO probe分别记录，不把probe冒充GUI响应捕获。旧fixture的catch在finally前写summary还会漏掉末次退出，现统一在finally后保存最终结果；正常退出仍走原15秒owner，forced cleanup不计通过。首轮失败收据/截图保留，产品仅三处主题前景变化后重新验收，最终结果见下表。

第二轮默认第112/131批失败，前111批通过，该批269项通过、真实EditorView的富输入Stop恢复一项触发原5000ms超时（观察6081ms），wrapper exit1。原日志与failed状态双份冻结，状态SHA `baefb5f2e94ecb730f81241f8a746d11e09cd72355e1cdacff9327e875d2ab02`；原因unknown，先按标准单worker配置复验原文件，再由test:resume保留已过批次。没有修改产品、测试期限或续跑状态；后续以已过前置+续跑+contracts+标准GUI组合收据记录，不把原wrapper写绿。

等待默认门禁期间，冷启动fixture仅澄清请求观察变量命名、删除恒为空/零且无消费者的Host统计，改为分别记录GUI保存确认数与配置写入请求数。三份fixture文件独立冻结为`source-final-reviewed.json`，产品14份摘要与默认启动时一致；9项证据回归、严格lint与格式复验通过，最终真实冷启动须覆盖这些fixture改动。scripts README合并重复合同并清除原始EISDIR/Reload丢稿旧说明；脚本治理通过。

最终验收（2026-10-16）：独立收据`.lime/qc/settings-execution-policy/final-20261016-1/receipt.json`。本刀可见原生合同5/5（100%，四路导航加保存/读回/重开/恢复），四主题4/4另列；冷启动32项断言不与这5项相加。current为独立草稿、字段合并、规则/来源展示及既有导航和配置authority；dead/deleted为整份Config/agent副本、内联保存重读、语言触发加载、固定浅色样式及旧fixture错误判断/退出吞错/空Host统计，compat/deprecated新增0。

| 验证     | 最终结果与身份                                                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 定向     | 5 suite 51/51；证据护栏复验9/9，严格fixture lint与格式通过。                                                                                                                                                                                                                                                                                                              |
| 默认组合 | 第二轮已过版本、五语言/unused、全src零warning lint与renderer/node typecheck；原wrapper在第112批exit1保留，原文件复验3/3（超时项1525ms），test:resume exit0、131/131批、1768文件存在，状态SHA `3a9fce61593bbfa06c3b50e0499fe3538a820e2cdb56e3e67128f07e33932a99`。contracts另行exit0；没有放宽期限、跳过或手改状态。                                                       |
| 标准GUI  | `standalone-shell-01-20261016064019-92706`，wrapper exit0、24/24，错误/mock均0；summary SHA `1db217969afe77a5f7a70d99d04e81dff10b906a4ad804a73b65b142c93a8a97`。                                                                                                                                                                                                          |
| 原生导航 | `settings-execution-policy-native-20261016-2`，整轮exit0，5/5、规则CRUD与完整配置保持通过；1291 IPC，console/page/trace/mock均0，同一Thread/Turn/Item且turnStart始终1。75源码/3777目录产物/sidecar无漂移，freshness前后ready；Main589正常1050ms退出，强制回收0。summary SHA `53f22640268414c536e9bbc6fe6aecc7666c36d511ee1d96185955ef5870fa61`。                          |
| 主题     | light/dark/system-light/system-dark截图均人工复核；无控件或文档横向溢出，规则控件文字最低对比度分别11.1087/13.3466/11.1087/13.3466，原4.5:1护栏通过。仅当前皮肤、1440×1000与媒体模拟system；不证明placeholder/disabled/hover或全皮肤。                                                                                                                                    |
| 冷启动   | `settings-execution-policy-cold-20261016-2`，exit0、32/32；76 IPC、3次GUI保存确认、4次写入请求，独立IO probe返回-32000且原因核验通过。GUI安全错误、保稿、Reload禁用、Save重试、冷读回和恢复通过；Main13301/13665/13996正常793/303/445ms退出，错误/mock与强制回收均0，freshness前后ready。summary SHA `b987eead63afa51647ed957806c65fbe4c20cc8929574dc756ffb226efc60da7`。 |

第一轮默认/导航不覆盖主题修正后的产品，冷启动第一轮及第二轮默认的失败原件均保留；最终两组原生使用显式单进程APP_SERVER_BIN，未改变系统环境。New与诊断focus/建议为组件证据；external backend绕过production RuntimeBackend/provider，冷启动只验配置/Host链，不执行shell/network工具。原始表单符号、参考实时、live、Windows、安装包、全皮肤及完整GUI仍未验，整体partial且分母未枚举。

下一刀只读预查（2026-10-16）：`account/profile/index.tsx:359`的saveProfileEntry仍用加载时完整Config和profile覆盖保存；handleSaveEdit在Promise结束前立即清空editingField/editValue，handleAddTag同样提前清newTag，缺少saving/revision/mounted保护。失败消息插入String(error)，可能泄漏后端值。本轮未修改Profile或据静态路径宣称实际丢稿；后续先补实际行内/Tag表单失败与导航红例，再迁移唯一配置/导航owner。

Profile后续验证范围预查：现有7项页面测试以完整saveConfig和成功路径为主，尚无失败保稿、在途编辑/重复保存、卸载迟到与未编辑配置保持的行为证据；`settings-profile-fixture-smoke.mjs`仍以旧data-active判断章节，且沿用旧closeElectronFixture。下一刀应同步迁移current选择器与正常退出收据，先核实实际失败，不将此静态发现写成运行缺陷复现。本轮Profile源码、测试及fixture均只读。

## Profile 草稿切片（2026-10-16，已验收）

Execution Policy 收据冻结进程 exit0；receipt SHA `d5c77a393e37e93a685548f41867fe66996db3a04dc4d6310a7db2572a718526`，229份证据、82份源码、7份文档与独立备份通过。收据不受后续源码/文档变化追写。

窄写集：`account/profile/**`、五语言 settings 文案、`i18n/__tests__/{loadNamespace,types}.test.ts`的退役键断言、Profile Electron fixture/evidence/测试、既有设置导航fixture的Profile接线，以及本计划、架构4.4与研究账本。其余工作树改动沿用此前结果，未知JS/tsbuildinfo、认证owner与媒体设置避让。单Agent，不提交或切分支。

参考映射：已确认 SettingsPage 的 requestNavigation/pendingNavigation 与 SettingsUnsavedChangesDialog；对应Lime既有useSettingsDraft/useAppNavigation。REA旧会话引用已失效，重新分析已校验原字节的两个设置member用于恢复当前证据；它们不含Profile内容owner，原Profile组件/函数名称和资料功能对应仍unknown，不能把本轮安全迁移写成Profile视觉/功能完全等价，也不增列永久保留差异。

Verification Contract：budget:normal，P1配置丢更新/草稿丢失风险。GUI Profile -> 既有appConfig.updateConfig串行事务 -> preload/IPC/app_server_handle_json_lines -> config/read、config/batchWrite -> App Server配置owner；业务runtime/工具/Thread状态不改。草稿由单一Profile hook持有，纯合并只更新提交字段，导航继续复用现有gateway。先以实际DOM失败/在途/未编辑配置保持红例定位，再替换旧完整Config快照与提前清输入路径。失败保稿且仅显示本地化安全文案；成功仅清除同revision提交稿；saving同步拒重、阻止破坏性切换、卸载迟到无副作用。Tag增删合并最新列表，未提交Tag文本也参与dirty。

退出条件：行内/Tag失败重试、在途新输入、语言切换、加载失败、取消、五路组件导航（章节/Back/Home/根/New）与真实可见导航/保存/冷启动读回/恢复通过；源码拆分并清除假头像上传和固定浅色样式，旧正向fixture选择器与吞退出错误一并迁移。定向测试、lint/typecheck/五语言、默认门禁、标准GUI与隔离原生fixture分别记录；真实凭证/provider、Windows/安装包、参考实时、完整Profile内容对齐不在本轮证据范围。仅本草稿安全合同的最终验收见下文；完整Profile内容与布局仍partial。

实施与组件证据：旧DOM经有效持久化stub复现5个红例（6项中1项既有行为通过），日志`draft-red-2.log`；新owner定向4suite56/56（页面7、草稿18、导航18、证据护栏13），strict lint通过。页面892→381行，字段卡/只读摘要/纯合并/草稿分离；所有写入进入既有updateConfig，未增加第二配置authority。删除8个退役翻译键并同步旧i18n正向断言。默认启动后核查发现原native移除Tag选择器与中文可访问名称间多余空格，已在原生运行前修正；仅fixture选择器/范围描述与两个翻译护栏变化，产品摘要未变，追加定向验证，不将默认启动时19文件manifest冒充最终22文件manifest。

原生fixture再审：Rust可选资料字段在默认配置中为null；不能将GUI清空后的空字符串/空列表冒充原始null逐字节恢复。新增共享test-only `settings-profile-fixture-driver.mjs`，先经公开config/read、config/batchWrite建立明确的隔离nickname/Tag基线，再读取initial做完整配置保持/恢复比较。生产schema/归一化不改，最终声明写集22文件；fixture变化均在首次原生运行前完成，追加strict lint通过。两个i18n护栏定向11/11通过。

默认进度：新一轮前置版本/五语言/unused/full-src lint/typecheck通过；全量前端131/131批通过，1770文件存在且六个本轮相关测试均登记，state SHA `70b568f07362eaa1cdff9b6ead12fd07b68328c5448b209eb7c4b3269a171716`。没有失败、续跑、期限修改或手改状态。contracts通过，verify:local wrapper整轮exit0；标准GUI `standalone-shell-01-20261016081318-60155` 24/24、错误/mock0，summary SHA `63d37adaa98fa91c826212b3df1408ae04404782665a69bd07c3e29fadfa1e43`。产品源码在默认启动后未变，fixture最终修正由独立lint、证据护栏及真实原生重跑覆盖。

REA重建引用：当前parent `ev_16cc1294703da24c38a94863d74b8b09119ecb6e48111b4b59d619c37e7f7629`，summary `ev_be5bd1c682e080b7f579fde1d79814f1a100b24f4df16be6399bc8abf8a443c3`。两member共50481 bytes/15035 AST节点、233 findings、0 parse failures，仅该子集application complete；3122 semantic unknowns，未执行参考应用。完整当前REA bundle与summary保存于`.lime/qc/settings-profile/validation-20261016/`；旧七member引用丢失不影响原始字节身份，也不伪造恢复旧会话。

等待默认验证期间补齐Profile参考：ASAR重算仍为75e397e2…，选择性提取成员均核对包内integrity SHA。四个入口member的REA parent `ev_8a9fee92c25f04892deb551fb8c4511164400434dc7c9835f02b20b43d6b882b`（23610 bytes、6796 AST、0 parse failures），可确认公开导出ProfileSettings/ProfilePage及CmeProfileSettings/CmeAccountSettings。ProfileSettings经两组feature flag/loading gating后委托共享Profile模块与Layout；不能仅以同名判断Lime页面已等价。另三member（Profile core/eligibility/use-visible）的REA parent `ev_2b4e6d08d1d979e0dcd2e6defa733fa149bd45f5b4d48b4ba05fb4f7938526fa`，302034 bytes/78992 AST/0 parse failures，semantic因100000节点上限partial/truncated，15294 unknowns，未重跑或执行参考应用。use-visible包内profile属codex capability、还受isProfileVisible/loading限制；core可见displayName/bio编辑、username与profile_details、编辑pane和页面身份。Lime本地Tag与完成度卡片的上游对应尚无证据，不能增列保留差异。本轮只关闭草稿/持久化安全合同；下一刀优先Profile内容/布局/数据入口与可见性映射，先完整追踪其owner再删本地额外功能，不先转向无关治理。原始成员、manifest、有界marker观察与完整8记录REA bundle均已保存。

Profile最终验收：原生导航 `settings-profile-native-20261016-1` 整轮exit0，行内/Tag×章节/Back/Home/根导航8项加保存/读回/重开/完整配置保持与恢复1项，共9/9（100%仅本刀可见合同）。四主题4/4另列，当前皮肤1440×1000截图均人工复核，无横向溢出，system仅媒体模拟；不证明参考视觉等价。1635 IPC、console/page/trace/mock均0，同一Thread/Turn/Item且turnStart始终1；Main62813正常code0/signalnull退出，teardown阶段1410ms，无强制回收。83源码/3883目录产物/sidecar前后摘要无漂移，freshness ready；summary SHA `0ed6f23843fd52bd512d7be5d78758223277e1c388c8c7ffe439f8c46e35a142`。

冷启动首轮exit1：三次Main均正常退出，实际保存/失败保稿/重试/恢复与冷读回已走完，但组装normalMainExits漏传forcedCleanup，证据护栏拒绝通过。保留首轮summary/log/截图，不把其写绿。最终直接从真实teardown派生forcedCleanup；JSON-RPC reader也已迁移为解析实际请求行.method，删除无用commands集合。没有放宽120秒等待、15秒正常退出或修改护栏。最终fixture13/13与strict lint/format复验通过；fixture改动后的冷启动第2轮 `settings-profile-cold-20261016-2` 整轮exit0、32/32，171 IPC、错误/mock0，Main76338/76666/77107正常退出，teardown阶段720/224/338ms，强制回收0。真实隔离IO独立RPC probe、安全GUI错误/行内与Tag保稿/重试、两次冷重启读回和完整配置恢复分别通过；IO probe不冒充GUI响应捕获。summary SHA `1c5fabaa7df05690f16bbd0a56e260fddc67760403ac4291b788d0d154ccbd1a`，freshness前后ready，两张安全错误截图人工复核。

current为useProfileDraft、profileConfig、字段/摘要presentation与既有配置/导航authority；dead/deleted为完整Config快照、全profile覆盖、提前清稿、原始错误插值、消息timer、无实现头像上传/8文案/旧正向测试，以及旧reader/退出证据组装。compat/deprecated新增0。KISS/DRY复用串行配置与导航，SOLID拆开生命周期、纯合并和展示，YAGNI删除空功能，不预建账号后端或新runtime。独立收据 `.lime/qc/settings-profile/final-20261016-1/receipt.json` 冻结本刀验证、原生/失败原件、参考字节、源码/文档与产物身份，并由系统临时目录独立备份重算；收据排除自身避免摘要循环。

只关闭草稿/持久化安全合同；导航external绕过production RuntimeBackend/provider，冷启动unavailable只证明配置/Host链。New仅组件证据，参考运行、真实账号、工具执行/live、Windows、安装包、全皮肤、Profile内容/布局与全GUI仍未验。下一刀继续Profile共享core/Layout、displayName/bio数据入口及eligibility，不转向无关Developer治理，不将Tag/完成度/email增列永久特色。

## Profile 内容数据合同追踪（2026-10-16，只读完成，产品迁移待办）

已冻结的草稿收据SHA为`f4d27e877aa2eb0a8b352a0d085a8a90ce4565909b510a773bcb079abe37c1ef`，209证据/91源码/7文档与独立备份重算通过；后续只修改current文档，不追写该收据。写集限于本计划、研究审计/账本/报告/索引与`.lime/qc/settings-profile/content-trace-20261016/`，本子阶段不改产品/协议/依赖。

复用REA core parent的source-module view `ev_e0a17e7831cc4351f87bf767347b9893a83db7de0859017b3f6dca92c54731fb`，沿core的fr/Fyt、sa/xyt import/export追到包内`app-initial-6350d04672d0.js`。该member11440241 bytes，SHA `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`，包内integrity通过。只提取5个精确顶层定义，保存byte与UTF16范围并逐段验证原字节一致；压缩名不是上游原源码名。2340-byte子集REA parent `ev_87b1f8de96c9b10e16b7303b0c59c6cac67506416c13e29c22a9dde803e5bbef`，756 AST、0 parse failure、141 semantic unknowns；依赖未包含，不以该子集声称完整网络owner语义。新完整13-record bundle已保存，未重跑11MB shared模块或执行参考代码/HTTP。

已确认静态合同：page query按user/account/username/personal构造identity；GET `/profiles/me/page`或`/profiles/{username}/page`，使用ChatGPT-Account-ID与AbortSignal，后者预期403/404。编辑mutation V2 PATCH `/profiles/me`，将displayName/bio映射为display_name/description；旧feature分支PATCH `/wham/profiles/me`。成功只更新is_self profile page缓存并失效profile identity；不能将Lime config/batchWrite冒充该合同。core还检查account/user就绪、preview/is_self/can_edit，名称上限64、bio上限140且归一化换行。具体HTTP client/资产上传和完整username流程仍unknown。

Lime只读消费者复核：user_profile仅在Config/Rust类型、App Server配置允许键和本地Profile页面/测试消费；未发现agent prompt/runtime业务消费者。现有OEM session真实持有id/displayName/username/avatarUrl；bootstrap.profileEditable只控制打开既有User Center，当前typed gateway没有profile page/bio/pins读取或资料mutation方法。该有界查找不证明仓库外账号服务没有实现，不调用生产接口补证。

下一刀实施边界：先从既有认证/能力owner建立Profile可见性和唯一数据入口，迁移共享content/Layout与displayName/bio字段合同，再删除本地Tag/完成度/email卡片及过期fixture/测试/文档；这些不是第四项特色。缺少的远端合同只记录gap，不新增假可用flag、mock fallback、本地配置冒充公共身份、空ProfilePage/CME或平行账号后端。涉及实际协议/schema/Rust字段迁移时先补Verification Contract并同步所有消费者。本阶段只有静态与source-only证据，产品尚未迁移，不重新宣称Gate B或整体完成度。

## Profile 内容与字段结构切片（2026-10-16，本地字段合同验收，完整Profile partial）

主目标：基于已冻结 REA 证据，先替换已确认的字段与 presentation，再补远端身份合同。调整上一阶段“先远端再布局”的顺序，是因为当前没有可消费的远端 Profile 合同；不能因此继续保留无上游对应的 Tag、完成度和用途卡片。公共身份、eligibility、preview、is_self/can_edit、username/pins/上传仍为 gap。

Verification Contract：负责人 Codex；budget:normal；P1。窄写集为 account/profile、TS/Rust UserProfile、五语言 Profile 键与两份 i18n 回归、Profile 原生导航/冷启动 fixture 及 evidence 护栏、现有 sourcePaths、七份对齐文档。未知 local-conversation 文件与其他连续切片不写；旧冻结收据不追写。验证目录为 `.lime/qc/settings-profile/content-alignment-20261016/`。

- 参考映射：公开 ProfileSettings → 薄 wrapper；共享 core/Layout → Lime 职责名 ProfileContent/ProfileLayout；字段编辑 → ProfileFieldEditor；displayName/bio → 显式映射现有 nickname/bio 配置。内部组件原名 unknown，不宣称恢复上游符号。参考 ev_2b4e6d08d1d979e0dcd2e6defa733fa149bd45f5b4d48b4ba05fb4f7938526fa 与 ev_87b1f8de96c9b10e16b7303b0c59c6cac67506416c13e29c22a9dde803e5bbef，semantic partial 限制继续保留。
- current 链：ProfileSettings → useProfileDraft → appConfig.updateConfig → current Desktop IPC/app_server_handle_json_lines → config/read、config/batchWrite → 既有配置 owner。read model 是 Config；不是远端公共 Profile。无新增 runtime event/tool/approval。导航 fixture 仍核同一 Thread/Turn/Item 与 turnStart=1。
- Happy Path：名称非空 trim、最多64；bio 最多140、换行转空格并 trim；实际 DOM 限制与保存防御同时验证。失败保稿/重试、拒重、在途新 revision、语言切换、卸载迟到、dirty 导航不回退。只变更提交字段并保留最新未编辑配置。
- 删除：Tag/完成度/头像/只读 email/用途与提示卡、旧 summary/card/presentation、无消费者的 TS/Rust avatar_url/email/tags、旧正向测试/翻译/原生选择器；无 compat。Settings 壳已有滚动，Profile 不增加嵌套滚动。
- Evidence Layers：定向组件/导航/证据护栏、Rust related、contracts、typecheck/lint、verify:local；真实 Electron 导航与三次冷启动，截图/IPC/RPC/trace/完整配置恢复/正常 Main 退出。无 live、生产凭证、provider/tool 执行、参考运行、Windows 或安装包验证。
- 完成条件：定向/默认门禁通过，真实双字段导航/保存/读回/失败保稿/重试/恢复通过；文档、sourcePaths、清理守卫同步；独立新收据与备份重算通过。整体 GUI 和完整 Profile 仍 partial，不给未枚举分母的百分比。
- 架构影响：非重大；仅既有 Profile presentation 重组及未消费配置字段收缩，不改跨层 owner/协议方法/read model/Host/交付门禁。architecture 4.4 同步职责图；不新增账号后端。Supervisor/LLM judge 不需要；P1 为本地配置资料编辑，其他 runtime P0 无变更。

验证进度：旧 DOM 红例6项中5失败/1既有通过；新定向6suite63/63，typecheck、strict lint通过。Rust初轮128/128通过，但新序列化回归误放在未编译的config/tests.rs；已撤回该文件本轮修改并迁入编译的types::unit_tests，第二轮129/129且日志确认新测试执行。默认启动后仅此测试位置/格式与editor类型导入格式修正，无产品行为变更，差异保存于after-default-source-review.json。当前25份声明源码manifest已冻结待后验核对。sidecar依据最终Rust源码重建，renderer重新构建；默认门禁与真实原生导航进行中。legacy扫描零引用/分类漂移/边界违规均0；六份Markdown104条本地链接有效，文档解析通过。三个历史冻结receipt重新计算SHA均未改变。

原生验证已通过：`settings-profile-content-native-20261016-1` exit0，displayName/bio×四路导航与保存/读回/重开/完整配置保持恢复共9/9；四主题4/4另列，732px、嵌套滚动0、横向溢出0、64/140实际DOM属性通过。1634 IPC、console/page/trace/mock均0，canonical Thread/Turn/Item保持且turnStart=1；Main39961正常code0/signalnull退出，正常退出阶段441ms，强制回收0。83源码与321目录产物声明，sidecar SHA f1bedcf46495710f877a9921468d0a2732950e7ec3254570535e9e0685349769前后相同，freshness前后ready。冷启动`settings-profile-content-cold-20261016-1` exit0、32/32，98 IPC、错误/mock0；名称/简介各自真实IO失败时安全保稿并重试，独立RPC probe仅核IO原因，不冒充GUI响应；两次冷读回和完整配置恢复通过。Main43762/44198/44464均正常退出，退出阶段344/183/181ms，强制回收0。四主题、dirty简介弹窗、双字段安全错误共7张截图已人工复核；账号session卡仍属独立未对齐范围。默认门禁继续执行，尚不关闭整刀验收。

默认首轮exit1：第35/131批既有windows-packaged-evidence真实CLI帮助/缺失参数测试6570ms超出原5000ms；保留完整log及failed smart state（34passed/1failed/96pending）。未改其源码、期限或状态；单文件原8/8复验通过，该用例3607ms。重新运行verify:local，由既有runner自动续跑，不能把定向通过替代全量失败或把本机该测试当成Windows原生证据。

并行变更：续跑期间发现其他写集将package/Cargo/CLI版本由1.158.0提升至1.159.0并更新发布说明/锁文件。本轮25声明源码、83原生源码、321原生产物仍无漂移；这些旧原生证据归1.158构建，不能冒充最终1.159候选。避让所有版本/锁/发布文件，不覆盖他人改动；等待默认门禁按最终版本构建，再串行重跑导航与冷启动。版本上下文将以只读摘要纳入新收据。

续跑已通过原35批。考虑版本变化发生在前34批之后，按已通过的229文件中直接引用manifest/版本的有界扫描，补验18文件202/202，覆盖appVersion、Forge、Rust runner、Desktop entrypoints等；名单与选择原因保存于version-sensitive-passed-tests.json。没有改智能状态或将这组测试计作Windows/发布产物原生验收。

续跑第61批exit1：codexModelNativeToolPolicyOrigin旧正向断言锁定StableEnvironmentTools/advertise_environment_tools。指定公开参考spec_plan当前无这些条件，模型apply_patch_tool_type存在即注册ApplyPatchHandler，environment mode Multiple只控制environment_id。参考文件clean，最后涉及commit为0c5720ea0fd2af84d7b6743a6686750fb8570ab7；原文件SHA919bf85acf44810892f6d1adc6701253c92a71678cbf74c877d718d0aaf9db9f保存。Lime现有buildModelNativeToolPolicy已是模型类型门控，无生产实现差异。窄写集扩展一份干净护栏测试src/lib/governance/codexModelNativeToolPolicyOrigin.test.ts，迁移参考断言并补freeform启用、缺失/null/unknown拒绝行为，禁止旧feature gate回流；不改外部Codex或Lime工具/runtime。失败日志/60passed+1failed状态保留，声明写集增加为26。该项属于用户授权的过期测试/护栏清理，不增加产品owner或发布范围。

配置合同最终校准：Rust Option默认经JSON返回null，既有normalizeConfig不转换user_profile，TS两保留字段现显式声明string|null。新增实际DOM回归验证空资料占位、空名称禁存、编辑名称时未编辑bio:null精确保留。仅类型与测试补齐，无运行逻辑变化；默认启动后的两份文件变化单独记录并重跑本轮六suite和全typecheck，不依赖已通过批次作为新摘要缓存。

默认第三轮：前端自动续跑131/131批通过，原始passed state SHA `4b948dcc7b553f97fb24ac931804499a55b0117714413ce9182638ca9167ca94`已复制留证，未手改状态。wrapper随后在App Server client契约检查exit1：并行App Server重构将handle_message_streaming移入message.rs，原guard扫描列表未同步。只在原先干净的scripts/check-app-server-client-contract.mjs增加这一current源文件，原snippets全部保留；不修改并行lib.rs/message.rs/processor或client_context_tests。原护栏备份与contract-source-split-review.json保留，声明写集27份；新增护栏strict lint/format通过。最终不重复已通过全量前端，按默认剩余顺序独立执行contracts、test:rust:changed和verify:gui-smoke，并记录组合验收，不能宣称第三轮wrapper exit0。最终定向6suite64/64、nullable后的完整typecheck和strict lint均通过。

剩余门禁进度：完整contracts已独立exit0。test:rust:changed受并行manifest变更扩大为workspace --lib，首轮在运行测试前因icrate/v8的rlib缺失链接失败，lime-mcp与tool-runtime均命中；V8元数据仍在，尚无证据确认缺失原因。保存原日志、缺失产物清单与remaining-results.json；已知失败后只向本任务cargo及其剩余编译子进程发送SIGINT，其他应用、终端和并行构建不动。首轮最终exit1，未伪造测试失败或通过。随后由Cargo重建缺失依赖，以子进程CARGO_BUILD_JOBS=2重试同一test:rust:changed，记录到remaining-results-final.json；未修改测试、期限、skip或共享目录。当前等待其他App Server验证持有的构建锁，最终1.159标准GUI和原生导航/冷启动仍未验收。

后续调度：首次jobs2重试仍在等待锁时仅停止本任务等待进程，保存原记录后将同一Rust命令与GUI构建分别排队。renderer/host已构建；此前将sidecar当成独立release profile的判断不准确，实际开发sidecar与Rust测试共享debug锁，已在scheduling-correction.json明确纠正，不据此放宽freshness。当前结果读取remaining-results-parallel.json；导航/冷启动只在标准GUI通过后串行执行，最终收据仍要求全部结果。icrate/v8两个缺失rlib已观测恢复，大小与摘要单独留证，不声称是本轮产品代码修复。

证据丢失与恢复：已观察到Rust workspace --lib exit0（39组7121通过、0失败、5项HEAD既有ignored）与标准GUI `standalone-shell-01-20261016151944-92156` exit0、24/24、错误/mock0，两份资源清单均为1.159.0。原生第2轮尚未形成目录，runner写结果时ENOSPC。只清理了持有Cargo锁时确认未使用的旧增量缓存及无硬链接旧codegen object，不删源码、rlib、可执行文件或证据。随后外部移除了整个`.lime/`，上述本轮成功/失败原始日志、smart state、source清单及脚本均丢失；这些计数和SHA现在只能列历史观察，不能伪造原件或在新收据宣称原始日志齐全。三份旧冻结Profile草稿、Profile数据追踪和Execution Policy收据由系统临时目录独立备份恢复且SHA不变。产品源码与dist仍在。

恢复写集限于原有27份声明源码、现有对齐文档与新`.lime/qc/settings-profile/recovery-20261016/`；源码不为恢复而修改。恢复脚本将新日志同时写仓库和独立系统临时目录，先重新验证7suite定向（含工具护栏）、contracts、完整typecheck，再构建标准GUI并串行原生导航和冷启动；新原生runId使用recovery，不覆盖丢失的历史名。原始全量前端131批/1770文件与workspace7121通过属于已观察但原件丢失，最终交付必须明确这一限制，不把新定向当成重新执行全量。全GUI与公共Profile仍partial。

恢复后最终验收：恢复后重新执行的定向7suite67/67、Rust配置129/129（含实际编译的退役字段JSON/YAML回归）、完整contracts、typecheck和strict lint均通过。

最终1.159.0标准GUI `standalone-shell-01-20261016160123-87137` 24/24；真实原生导航 `settings-profile-content-recovery-20261016-3` exit0，名称/简介×四路导航加保存/读回/重开/完整配置保持恢复共9/9（100%仅本地字段合同），四主题4/4另列。732px、嵌套滚动0、横向溢出0与DOM64/140检查通过；1627 IPC、console/page/trace/mock0，同一Thread/Turn/Item且turnStart=1，Main正常退出。冷启动 `settings-profile-content-recovery-cold-20261016-1` exit0、32/32，165 IPC、错误/mock0；双字段分别真实IO失败保稿/重试、两次冷读回、完整配置保持恢复和三次Main正常退出通过，独立RPC probe不冒充GUI响应。27声明源码/83原生源码/531目录产物和只读版本上下文后验无漂移，两份资源清单与实际sidecar SHA一致且均为1.159.0，freshness前后ready。7张最终截图人工复核，仅当前皮肤1440×1000；system为媒体模拟。新日志即时双份保存。

删除前已观察到默认前置检查、全量前端自动续跑131/131批（1770文件）、workspace --lib39组7121通过/0失败/5项既有ignored，以及标准GUI24/24通过；三个verify:local wrapper的exit1分别来自原5秒CLI超时、旧Codex feature正向护栏和并行message.rs拆分后的扫描名单遗漏，后两处护栏已按current语义迁移。随后外部整体删除.lime，使本轮这些成功/失败日志、smart state、早期原生原件和清理记录丢失；该部分只能作为历史观察，不伪造原件、不声称新定向等于全量重跑或wrapper exit0。三份旧冻结Profile草稿、Profile数据追踪与Execution Policy收据由独立备份恢复，SHA未变。

current为ProfileSettings、ProfileContent、ProfileLayout、ProfileFieldEditor、useProfileDraft/profileConfig及既有Config/导航authority；compat/deprecated新增0。dead/deleted为Tag/完成度/头像/email/用途卡、旧三份presentation、无消费者TS/Rust配置字段和旧翻译/正向测试/fixture选择器。KISS/DRY复用已有配置和导航；SOLID分离展示、生命周期和纯字段映射；YAGNI删除无依据的附加功能，不预建账号API。

仅本地字段内容与安全持久化合同关闭；本地Config不是公共Profile服务。单独账号会话卡、远端GET/PATCH、eligibility/preview/is_self/can_edit、username/pins/upload仍gap；New仅组件证据，external/unavailable backend不证明live/provider/tool。参考运行、Windows、安装包和全GUI未验，整体partial且分母未完整枚举。 新收据 `.lime/qc/settings-profile/content-final-20261016-recovery-1/receipt.json` 独立冻结恢复后的证据并备份重算，保留原始记录缺失声明；不追写旧冻结件。下一刀沿既有认证/能力owner继续公共Profile合同，不造API或本地身份fallback。

## Profile 本地与认证入口隔离（2026-10-17，已验收）

主目标：继续关闭 Profile 入口差距，移除本地资料页上无云服务可用时仍挂载的账户摘要和登录 owner。公共 Profile 的查询、写入与 eligibility 合同尚不存在；不为此复制参考服务地址、增加假能力标志或以本地资料降级公共身份。

Verification Contract：负责人 Codex；budget:normal；P1。产品写集限 `sections.tsx`；回归限 `_layout/index.test.tsx`、`scripts/electron/lib/settings-profile-navigation-scenario.mjs`；文档限本计划、设置审计、结构账本与 evidence-index。协议、App Server、runtime、CLI、版本/发布及脏 architecture/commands 只读避让，不追写旧冻结证据。

- 参考：复用 `ev_2b4e6d08d1d979e0dcd2e6defa733fa149bd45f5b4d48b4ba05fb4f7938526fa` 及 ProfileSettings 原成员；公开 wrapper 委托共享内容并受 loading/feature 控制。REA source-module view `ev_d842243733886bd9ced33ce5cf6ea8094fd0b7ada2ed54fa4f16aba9a8a10fdf` 确认 eligibility 源成员身份，parent semantic 仍 partial；不把 OEM runtime 判定写成上游 eligibility 等价。
- current owner：唯一 settingsSections 按既有 `resolveOemCloudRuntimeContext` 选择本地 ProfileSettings 或 OEM UserCenterSessionSettings，预加载与渲染沿同一条件。后者继续委托现有认证 hook；前者继续使用 Config owner。无新增状态、类型、函数 alias、协议或第二账号后端；架构为既有章节 presentation 接线修正，非重大 owner 变更。
- 用户结果：无 OEM 时只有本地名称/简介与一份页头，不出现不可用账户卡，也不挂载账户认证组件；有 OEM 时只走既有账户组件，不挂载本地资料编辑器。五语言分支回归、当前本地资料保存与离开保护继续有效。
- 验证：先取得旧实现的未挂载断言红例，再定向 layout/Profile/导航/章节回归、lint/typecheck、标准 GUI 与真实原生导航。原生检查唯一 Profile 页头、账户页头/Google 登录入口缺席，并保留四主题、失败/草稿和 canonical identity 断言；不执行真实认证、生产请求或参考应用。
- 退出条件：本地/OEM 互斥挂载、定向与原生回归通过；新源码/产物后验摘要、截图人工复核、文档与独立备份齐全。默认门禁依据实际工作树记录，不能把并行 P0 改动规划或历史收据算成本切片通过；公共 Profile/整体 GUI 仍 partial。

证据目录 `.lime/qc/settings-profile/entry-20261017/`，即时双份日志与独立备份地址见 `context.json`。KISS/DRY 复用章节和 runtime 判定；YAGNI 删除不可用展示与不必要挂载；SOLID 保持认证和本地配置各自 owner。

验证选择：`verify:tasks` 的当前工作树规划包含并行审批/协议/服务等级/队列等 P0 Rust 改动；依质量事实源，此规划不作为本轮窄写集要求。此次仅修改章节 presentation 接线，无新增命令、schema、配置或 Rust 逻辑；不重跑全量 `verify:local`、workspace 或冷启动保存状态机。定向 107/107、完整 typecheck、严格 lint、标准 `verify:gui-smoke` 与扩展原生导航分别记录，不宣称默认整轮/远端认证通过。下一刀转入设置内容搜索与定位，公共 Profile 缺口继续由真实认证/服务 owner 承接。

定向7 suite107/107、完整typecheck、严格lint/format通过；更新构建后的标准GUI `standalone-shell-01-20261016182210-58995` 24/24，错误/mock均0。真实Electron `settings-profile-entry-20261017-2` 整轮exit0：本地/OEM入口2/2仅指组件分支合同，本地入口额外观察9次、唯一页头1、账户/登录/Google入口0；原本地导航9/9、主题4/4继续通过。1640 IPC，console/page/trace错误及production mock均0，同一Thread/Turn/Item且turnStart始终1，Main正常code0/signalnull退出、强制回收0；83份声明源码/741份目录产物和sidecar前后零漂移，freshness两端ready。5张新截图人工复核通过，仅当前皮肤1440×1000，system为媒体模拟。

原生第1轮保留exit1：启动前Cargo metadata等待自行恢复，未中断进程或修改期限；场景完成后，最终freshness守卫因并行协议源码及生成产物变化拒绝验收。第2轮按标准入口更新构建，并通过已有APP_SERVER_BIN接口显式选择已校验manifest/SHA的sidecar；不放宽守卫、不改生产helper、不覆盖失败证据。

独立冻结收据 `.lime/qc/settings-profile/entry-final-20261017-1/receipt.json` 绑定本轮源码、文档与双份证据；仅关闭入口隔离切片。无新增compat/deprecated，删除旧双展示/双预加载路径及过期正向断言，无物理文件删除。OEM真实认证与账户内容、公共Profile query/mutation/eligibility、参考运行、live、Windows、安装包及完整GUI仍partial。

## 设置内容搜索补证（2026-10-17，静态审计已完成，实施待开始）

沿相同安装包摘要选择性提取 `_virtual_settings-search-documents-ea4141d234e9.js`，525711 bytes、SHA `f63906f31750633a6fb252894dfa84247883f5a79a1e0dfd008bb56919283fca`，包内integrity已核。REA parent `ev_c1fe1285584791d68b3fd0c52bf430325bb5da1758aefd3090feb75ba337e4b2`，source-module view `ev_34efb5366f4d9b0617273007cb751bc8764c71383e46d983b157745ce735b1a0` 确认唯一公开导出 `settingsSearchDocuments`。单成员解析47288 AST、0 parse failure；semantic达到100000节点上限，partial/truncated、5 unknowns，未解析rolldown依赖，未执行bootstrap。

纯AST字面量读取确认50个section key、5234条id/defaultMessage消息；此为包内索引覆盖，不代表50项当前可见设置。复用原settings-page证据：搜索合并本地化panel/terms/messageTextGroups，结果含section/path/scrollText并经既有导航gateway选择。内部压缩函数名不映射为原源码符号。Lime仍只有侧栏标题过滤，内容搜索、精确行定位、键盘选择及dirty路由接线尚未实施或验收。

下一刀在既有settingsSections、SettingsSidebar、SettingsPage和canonical导航owner建立可翻译的内容文档与稳定目标，仅登记current可用页/字段；不复制隐藏章节、另建history/dirty authority或使用账户数据填索引。实施前收窄实际写集和Verification Contract，再同步迁移旧标题过滤测试/fixture，验证五语言、键盘/焦点、导航保稿与真实Electron。静态补证及双份摘要收据 `.lime/qc/settings-content-search/audit-20261017/audit-receipt.json`，不计产品完成度；公共Profile缺口继续开放。

## 设置内容搜索首批目标（2026-10-17，已验收）

Verification Contract：Codex，budget:normal，P1。复用上述REA文档/导航证据，公开导出名对齐`settingsSearchDocuments`；内部匹配函数、组件和焦点hook使用Lime职责名，不冒充上游压缩符号。当前15个章节标题仍从settingsSections投影；首批内容为本地Profile名称/简介2项、Environment shell导入开关/超时/变量覆盖3项、Execution Policy工作区/计划/命令/网络4项，共9项。完整设置内容覆盖仍partial。

写集：新增settingsSearchDocuments/settingsSearch及unit、SettingsSearch组件与component test、useSettingsSearchTarget与integration、既有scripts/electron/lib内搜索场景；窄改SettingsSidebar/SettingsNavigation/SettingsPage、PageParams、上述3页定位属性、原生fixture接线及本计划/审计/账本/索引。现有文件修改前摘要与独立备份见`.lime/qc/settings-content-search/implementation-20261017/context.json`。并行Rust/App Server/协议/CLI/发布、脏architecture/commands及未知产物只读避让。

Current链：翻译消息与current章节→纯搜索投影→唯一canonical导航与既有dirty gateway→lazy页面→稳定target滚动/焦点/高亮。searchFocus仅为Renderer定位请求，不含配置值、凭证或用户资料，不创建业务authority。既有Config写入和Thread/Turn/Item不变；RuntimeCore/tool/approval无新增操作。架构为既有presentation/导航内的细分职责，非重大；上图已有settings page/navigation足以表达，root于2026-10-17核对owner/依赖/边界。

Happy path：五语言标签/说明可检索，多词必须属于同一目标；标题优先，内容结果携带章节与稳定target。键盘上下/Enter/Escape、IME确认、清空与无结果、窄屏入口均覆盖。只有已提交canonical目标可定位；懒加载完成后聚焦，旧请求在换页/卸载后失效；重复选择可重新定位。已有草稿时先显示原对话框，继续编辑不导航，放弃只提交最后目标且不写配置。OEM模式不索引本地Profile字段，无隐藏功能/用户值索引。

验证：先定向pure/component/integration取得有效红例，再lint/typecheck/format；`verify:gui-smoke`及扩展真实Electron导航保留current IPC、同一identity、零production mock/错误、Main正常退出与前后摘要守卫。默认verify:local依据当前工作树规划，记录并行P0范围；无协议/config/Rust变更，不重跑workspace、冷启动或live。Deterministic与GUI trace必需，runtime transcript沿原导航fixture同一identity；release artifact/参考runtime/Windows不适用。退出条件为上述首批搜索合同、实际目标到达/草稿保护、主题/窄屏观察与双份冻结证据；不把9项当完整设置或全GUI完成。

清理：删除原Sidebar内联标题过滤及对应重复搜索样式/事件路径；有效章节导航、prefetch、折叠和既有dirty护栏继续测试。current为单一搜索文档/纯selector/SettingsSearch与既有导航，compat/deprecated新增0。失败回写最近的selector、DOM或导航integration/原生场景，禁止加sleep、skip、mock fallback或放宽退出期限。

集成红例补充：原对话框在放弃后无条件恢复搜索框焦点，覆盖已提交目标。写集增加SettingsUnsavedChangesDialog的关闭焦点策略；继续编辑仍恢复原焦点，确认放弃由目标页面接管。窄屏pending状态由既有navigationGuard透传，阻止对话框交互意外关闭搜索面板；不建立新dirty状态。已提交searchFocus的requestKey作为内容子树key，确保同页明确放弃后旧草稿卸载；仅canonical提交可触发。

实现检查点：9项静态文档、NFKC/多词匹配、标题优先/同section最佳结果、可访问combobox键盘/IME与双视图共用查询已接线；canonical提交清查询/浮动面板，取消保持。稳定target+MutationObserver负责异步DOM，跨页/卸载清理。16suite198/198通过；旧无依赖红例失败与有效五语言5红、discard焦点红例均原样保留。严格lint初次类型/转义问题已修正，React18 RefObject类型修正后的完整typecheck与最终搜索3suite27/27、strict lint、脚本治理、Desktop参考边界和docs边界通过；标准GUI和原生场景继续验收。

原生第1轮保留exit1：首目标焦点/定位已到达，但计算outline为3px而非2px。源码确认--ring在current全局token未定义，新outline声明失效，截图缺少搜索高亮；改为既有--lime-brand及primary fallback，不放宽夹具2px断言。首轮Main正常退出、console/page错误0。该视觉修正后重建并复验标准GUI与原生整轮。

原生第2轮保留exit1：9项搜索、说明/重复、桌面与600px窄屏保稿/同页放弃、四主题场景均执行，但最终freshness因并行app-server/src/processor/dispatch.rs晚于sidecar而拒绝，不能列为整轮通过。按既有标准入口更新sidecar；不夹写并行文件、不放宽守卫。截图人工观察发现native search cancel与组件按钮重复，隐藏浏览器自带按钮、保留有名称的唯一清除入口；最终renderer和原生仍待重新核对。

原生第3轮保留exit1：首轮视觉修正后的renderer与sidecar已更新，标准smoke24/24通过；原生启动前发现并行electron/appServerDynamicToolHost.ts晚于Host产物，守卫拒绝，未启动场景。按既有electron:build:host更新Host并继续，协议/工具Host只读避让。

原生第4轮保留exit1：搜索场景再次执行，最终freshness因并行app-server/src/thread_state.rs更新拒绝。后续验证改用构建完成后立即独立复制的临时快照：APFS copy-on-write保留源码/产物原时间戳，不改守卫、不伪造freshness；独立workspace packages，稳定第三方node_modules store只读复用。快照须先通过原freshness检查，再运行同一标准smoke/完整导航fixture，前后核对源码/产物/sidecar；本轮产品源SHA另与原工作树核对。验收只绑定该快照，不声明最新并行runtime或混合原工作树全量通过。此为验证隔离，非新业务owner或compat。

最终验收：定向16suite198/198、最终搜索3suite27/27、完整Renderer/Node typecheck与strict lint通过；脚本治理、Desktop参考边界、docs边界通过。两次完整verify:gui-smoke exit0；最后同一隔离快照标准smoke `standalone-shell-01-20261016200249-26100` 24/24、错误/mock0。没有产品业务修改后无理由重跑全量前端/Rust；默认verify:local未跑，task selector含并行P0协议/Rust任务，全仓file-size既有失败原件保留、不改基线。

真实Electron第5轮 `settings-content-search-native-20261017-5` 整轮exit0，仅绑定记录的隔离源码/产物快照；本轮18份产品/测试/fixture源与原工作树后验SHA一致。9目标9/9（100%仅首批内容目标）、说明/重复选择、桌面保稿/同页明确放弃、600×900窄屏入口/保稿/目标接管与四主题4/4通过。1740 IPC，console/page/trace/production mock0，同一Thread/Turn/Item/workspace、turnStart始终1；Main26718正常code0/signalnull退出，强制回收0。91份声明源码/1161份产物和sidecar前后零漂移，freshness两端ready，8张截图人工复核；主题仅current skin/system媒体模拟，不覆盖OS系统主题事件。

结构/命名：公开settingsSearchDocuments直接对齐；searchSettings/SettingsSearch/useSettingsSearchTarget为Lime职责名，原压缩内部符号unknown。current为单一文档/纯匹配/输入/定位与既有settingsSections/useAppNavigation/Config owner；compat/deprecated新增0。dead/deleted为原Sidebar内联标题过滤、重复搜索样式/事件和对话框放弃后抢回焦点的旧路径，无物理文件删除。本轮最多613行产品文件；KISS/DRY复用现有导航/翻译/草稿，SOLID分离职责，YAGNI不复制隐藏设置或另造业务后端。

新独立冻结收据 `.lime/qc/settings-content-search/final-20261017-1/receipt.json` 保存本轮成功/失败原件、源码、审计、截图与后验检查；旧冻结件未追写。只关闭9项搜索切片，完整设置内容搜索、公共Profile/eligibility/认证、参考运行、production RuntimeBackend/provider/live、Windows/安装包/全皮肤及整体GUI仍partial；全产品分母未完整枚举，不提供伪完成百分比。下一刀沿同一索引/导航owner覆盖其余current设置内容与对应保稿场景，协议/Runtime并行热区继续避让。

## 设置内容搜索第二批：联网搜索（2026-10-17，已验收）

Verification Contract：Codex，budget:normal，P1。主目标仍为REA驱动的GUI、行为与结构对齐；本阶段沿首批唯一settingsSearchDocuments/searchSettings/canonical navigation扩展15项联网搜索字段。参考沿用首批REA包/摘要/Evidence，不重新推断压缩符号或复制隐藏章节。参考结果的path/scrollText职责由静态path和稳定target表达；属于Lime明确实现决策，不声称与参考内部算法相同。

窄写集：settingsSearchDocuments/settingsSearch及unit、sections/SettingsPage内容接线、WebSearchSettings/WebSearchFields、搜索integration、既有Electron lib内联网搜索子场景及主导航fixture最小接线、本计划/审计/账本/索引。14份修改前摘要与备份见`.lime/qc/settings-content-search/web-search-20261017/context.json`。Rust/App Server/协议/CLI/Electron Host、脏architecture/commands和未知产物只读避让。新增文件仅上述既有领域内；无分支/提交。

Current链：current静态翻译→searchSettings→原onNavigate/dirty guard→已提交searchFocus→索引白名单解析path→WebSearch局部页签默认值→现有lazy DOM定位hook。仅canonical提交才卸载被明确放弃的草稿并打开目标；不在输入/待确认阶段切页签，不另造history、配置或dirty authority。Provider值与密钥不进入索引或证据。Config保存、Electron IPC、App Server method、RuntimeCore、runtime events和Thread/Turn/Item owner未变；GUI场景沿原真实bridge/read model证明identity与零附加turn，不声称live provider行为。

Happy path分母：search链3字段、providers4字段、mse6字段、images2字段，共15目标/4页签。五语言用现有label/hint；每章最佳结果规则可能存在翻译标签相等/包含，需要用实际可区分标签或说明组合验证，不能放松匹配合同。跨章/同章内部页签搜索、重复目标、隐藏目标异步挂载、继续编辑保稿、放弃不写、旧请求取消/卸载与非白名单输入必须覆盖。焦点只落非编辑字段外层，不能自动展开密钥或修改配置。

Evidence：deterministic与gui-trace必需；runtime-transcript复用完整Electron导航fixture同一canonical identity/turnStart=1；release-artifact不适用，未触及交付边界。命令先有效红例→定向搜索/layout/sections/WebSearch回归→strict lint/typecheck/format/docs/diff/node语法→verify:gui-smoke→完整真实导航fixture含本批场景。优先使用通过原freshness守卫的一致独立COW快照，不touch时间、不改skip/timeout或mock fallback。默认verify:local先核对task selector，若仍包含并行P0则记录实际未跑边界；无协议/Rust变更不重复workspace/冷启动/live。Supervisor/LLM judge不需要。

失败回写最近selector、实际页面integration或Electron子场景；退出条件为15/15目标、4/4内部页签和草稿保护验证、前后摘要零漂移/正常退出/截图复核/双份新冻结收据。新增current为原索引中的path与WebSearch定位接线，compat/deprecated新增0；直接替换WebSearch固定search默认入口，不保留双轨。架构影响非重大：既有presentation/导航owner内参数传递，无package/crate/协议/业务owner变化，原图仍适用；Codex于2026-10-17核对目录/依赖/边界，不写并行architecture热区。本批完成度只以这15项为分母，整体设置/公共Profile/全GUI仍partial。

本批验证进展：有效红例22失败/1通过已保留；首次绿例15项仍落在lazy fallback，根因为新测试没有等待真实模块预取，并非产品目标失败；测试改为先await原section.preload，保留配置异步加载/取消场景。随后搜索33/33、扩大8suite133/133、strict lint通过。原工作树verify:gui-smoke已启动，正等待其它进程的renderer锁，不中断对方。隔离验收以首批已验收快照为基线，只覆盖本批声明源码；10份相关修改前SHA与基线全部相同，随后重建renderer/Host并保留既有匹配source/sidecar。此选择避开持续变化的并行Rust/协议热区与其未验收代码；只证明该明确组合，不声明最新后端工作树已通过。仍执行原freshness/摘要/正常退出守卫，不伪造时间或放宽合同。

本批原生准备失败记录：首轮Host编译通过，标准资源复制因基线快照缺少lime-rs/icons失败；7份图标源SHA与基线已验收打包资源一致，补齐原文件/时间戳后复制通过。首次隔离标准smoke为23/24，layoutGeometryStable失败；原始summary分类product保持原样。人工截图出现无utility样式控件，进一步确认引用CSS仍含@tailwind指令，根因为本进程重建快照时遗漏原PostCSS/Tailwind配置，非搜索产品回归。补齐未修改的原配置/时间戳，记录输入SHA后按原renderer构建重跑；不改页面布局、期限或断言。原始截图/日志/CSS双份保留于web-search-20261017/failed-standard-1，后续实际结果另记。

最终结算：定向8suite133/133、完整当前工作树Renderer/Node typecheck、strict lint、脚本治理/参考边界/docs边界与语法检查通过。修正快照准备输入后，同一隔离组合标准SHELL-01 `standalone-shell-01-20261017012129-19113` 24/24；原生 `settings-web-search-targets-native-20261017-1` 首轮整轮exit0，累计24目标24/24，本批15/15（100%仅该15字段）及4/4内部页签；说明/重复、隐藏页签保稿/明确放弃、保持密钥遮罩、四主题4/4、600×900窄屏通过。1683 IPC，console/page/trace/production mock均0；同一Thread/Turn/Item/workspace且turnStart始终1，Main20958正常code0/signalnull退出、强制回收0。91声明源/1376目录产物/sidecar前后零漂移，freshness两端ready。10份本批覆盖源码与原工作树后验SHA相同；另核对原图标与样式构建配置输入，11张最终截图人工复核（10张搜索+1张标准980px）。

原工作树完整verify:gui-smoke保留exit1：等待并行Rust锁后v8绑定缓存缺失，尚未进入smoke场景；仓库既有rusty-v8-artifacts脚本已恢复并校验配套150.4.0缓存，退出0，无依赖/系统配置改动。本轮不重编并行Rust热区或重跑整个混合工作树，不能宣称该wrapper或默认verify:local通过。整轮通过仅绑定上述明确源码/产物组合；首轮快照资源缺失、标准23/24失败与原工作树构建失败均独立保留，不覆盖旧冻结件。没有新增产品业务修改，不重跑全量前端/workspace/冷启动/live。当前产品改动均远低于800行，超线的既有主fixture只改范围文字，未堆新业务或变更file-size基线。

Current为单一静态索引/path解析、原settingsSections/SettingsPage/局部Tabs/定位hook与原dirty/config owner。compat/deprecated新增0；dead/deleted为固定search默认入口的旧路径，无物理文件删除。KISS/DRY复用既有消息、路由、草稿和字段id，SOLID将路径解析留在纯selector，YAGNI不另造导航/历史/业务authority。主题、多模型、首页Banner继续由原owner保留。

新双份冻结收据`.lime/qc/settings-content-search/web-search-final-20261017-1/receipt.json`关闭本批15项，首批9项保留原收据。完整设置内容、公共Profile/eligibility/认证、参考运行、production RuntimeBackend/provider/live/search、OS主题事件、全皮肤、Windows/安装包与整体GUI仍partial；未完整枚举产品分母，不报伪整体百分比。下一刀由当前GUI写集继续Memory三页签与Appearance内容；两个页面分别871/993行，先收敛presentation再扩展目标，沿同一path/dirty owner，不触及并行runtime。最新工作树Rust/完整门禁由其owner在缓存恢复后重新验收。

## 设置内容搜索第三批：Memory / Appearance（2026-10-17，已验收）

Verification Contract：Codex，budget:normal，P1。继续REA确认的静态settingsSearchDocuments → 搜索结果section/path/定位 → canonical导航合同。复用匹配ASAR与首批Evidence；本批新增presentation名称是Lime职责名，参考内部原名仍unknown，不能将现有Soul内容等同于已复刻参考Memory。

窄写集：MemorySettings及其新Soul/Advanced展示组件、AppearanceSettings及新Appearance展示组件；settingsSearchDocuments、settingsSections中的Memory searchPath接线、新memoryAppearanceTargets.integration测试；既有Electron搜索子场景和主fixture声明；本计划/审计/账本/索引。修改前备份与摘要见`.lime/qc/settings-content-search/memory-appearance-20261017/context.json`。其他Rust/协议/Host/CLI/架构热区与未知产物只读避让；不提交、不建分支。

Current主链：现有翻译静态索引 → searchSettings → onNavigate/dirty guard → canonical searchFocus/requestKey → 现有sections白名单path → Memory初始局部页签 → lazy DOM定位。保留MemorySettings的SOUL导入文本/预览和useMemorySettingsDraft；MemoryStoreStatusPanel及笔记编辑器维持原挂载策略。Appearance配置/主题/皮肤/语言持久化仍由原owner执行，展示组件仅接收值与回调。配置网关/IPC/App Server/RuntimeCore/read model/runtime event不变。真实场景沿既有bridge/read model证明同一Thread/Turn/Item且turnStart=1，不新增业务authority。

Happy path分母：Memory开关、文件记忆、交互口吻、个性模板、嵌入来源、SOUL导出/导入共7目标，memory/soul/advanced三页签；Appearance主题、皮肤、界面语言、回复语言、推荐选区共5目标。本批12，累计36。五语言复用现有标签/说明；索引不含用户值、笔记、导入文本、凭证。目标只聚焦非编辑外层。待确认搜索不切局部页签/不卸载草稿；继续编辑保留，明确放弃才重建，重复/异步加载/旧请求取消/伪造目标均覆盖。页面拆分保留原动作与API；不新增参考保留差异。

Evidence Layers：deterministic及gui-trace必需；runtime-transcript使用完整真实Electron导航fixture；release-artifact不适用，未改交付边界。先有效红例→定向搜索/Memory/Appearance/草稿测试→strict lint/typecheck/format/docs/diff/node语法→标准GUI与原生本批场景。继续使用已验收基线的独立COW快照，只覆盖明确源码并标准重建Renderer/Host，保留相同基线sidecar；原freshness及前后摘要守卫不变。结果仅绑定该组合，不声明最新并行Rust或默认verify:local通过；无协议改动不运行重复workspace/live。Supervisor不需要。

失败回写至最近selector/页面integration/原生搜索场景，不skip、不放宽断言或期限、不修改测试状态。退出条件：12/12目标、3/3页签、原草稿/保存动作、正常退出/零mock/前后摘要稳定/截图复核与双份新收据；旧冻结件不追写。架构影响非重大：原组件域内presentation提取，无package/crate/协议/owner/交付门禁变更。Codex于2026-10-17核对architecture目录/依赖/数据流，原图适用。Current为单一搜索/导航/草稿/配置owner；compat/deprecated新增0，直接替换过长内联展示。整体GUI仍partial。

最终结算：有效红例19失败/1通过保留；首次绿例50通过/1失败是Provider标签匹配标题优先章节，测试改用原字段说明后通过，未更改算法/断言。最终定向8suite105/105、附加证据护栏2suite8/8、完整当前工作树Renderer/Node typecheck、strict lint、格式/脚本治理/参考/docs边界与语法检查通过。Node测试runner误用于Vitest文件的失败原件已保留，随后以真实Vitest入口8/8通过；只读freshness摘要打印将segments对象当数组的错误亦保留记录，原守卫ready JSON有效，不修改产品/守卫。JSON索引格式初次检查失败后按Prettier修正。两页原保存动作/导入/模板/主题/语言/推荐以及隐藏笔记生命周期均继续回归。

独立快照标准SHELL-01 `settings-memory-appearance-standard-20261017-1` 24/24，原生`settings-memory-appearance-native-20261017-1`首轮整轮exit0。累计36/36，本批12/12（100%仅本批目标）、Memory三页签3/3，导入预览跨页签保留、待确认不切换、继续编辑保稿、明确放弃不写、重复打开、四主题4/4及600×900跨章节保稿/目标接管通过。1757真实IPC，console/page/trace/production mock均0，同一Thread/Turn/Item/workspace、turnStart始终1；Main30708正常code0/signalnull退出，强制回收0。95声明源/1481产物及sidecar前后零漂移，freshness两端ready。本批10份覆盖源码与原工作树后验SHA相同。8张搜索截图与2张标准截图人工复核；仅current skin与system媒体模拟。默认verify:local/完整verify:gui-smoke wrapper不重跑：task selector含并行Rust/协议/Host改动；同一已验收基线sidecar未改，不宣称最新混合后端、production RuntimeBackend/provider/live或Windows通过。

结构/命名结算：Memory入口871→566行，拆出SoulSettingsPanel204/AdvancedMemorySettings200；Appearance入口993→418行，展示681行，复用单一LanguageOption。新内部名称均为Lime职责名，未恢复的参考压缩符号仍unknown。Current是原搜索/导航/草稿/笔记/配置与新presentation；compat/deprecated新增0。Dead/deleted为旧过长内联展示、重复ResponseLanguageOption与固定memory初始入口，无物理文件删除、同名alias或第二业务authority。KISS/DRY复用现有标签、导航和状态，SOLID分离展示，YAGNI不扩建配置/runtime。主题、多模型与首页Banner仍归原owner。

新双份收据`.lime/qc/settings-content-search/memory-appearance-final-20261017-1/receipt.json`保存本批源码、测试、文档、成功与失败证据；旧冻结件不变。本批内容搜索/展示拆分关闭；整页Memory/Appearance布局/业务、完整设置内容、公共Profile/eligibility/认证、其他GUI/符号、参考运行、OS主题事件/全skin、production/live、最新并行后端及Windows/安装包仍partial。全产品分母未枚举，不给伪整体百分比。下一刀由当前GUI owner按REA current设置页内容逐章继续剩余静态目标与草稿保护；整页结构/符号未知项另取匹配证据，不以本次拆分消除gap。

## 分类、完成度与未验证范围

上一设置导航切片：声明的真实产品合同4/4（100%）、默认前端130/130批（100%仅该1759文件登记集合）通过；导航108/108、恢复46/46、技能11/11、freshness32/32与external护栏2/2分别记录，不把重叠测试相加。最终组合收据 `.lime/qc/settings-sections/navigation-final-20261015-1/receipt.json`，绑定49份源码/测试、35份原生声明源码与2828份原生目录产物，独立冻结原生和验证证据，保留13轮原生失败及两次原verify:local的失败日志。仅本切片关闭，整体GUI仍partial。

- current：表中既有owner、当前协议fixture与新build验证链。
- compat：仅已存在的Experimental -> Developer设置委托；本轮新增0。
- deprecated：本轮没有新增延期双轨。
- dead/deleted：旧组件/名单/V2 aliases、general草稿事件双轨、布尔接受夹具、重复reset integration、finally前打印pass及吞掉资源退出失败的旧fixture路径；有效风险由current语义回归承接，禁止恢复旧实现迁就测试。

前一切片前端续跑为132/132批（100%仅该历史测试发现集合），新增退出回归单独及聚合通过；默认组合、新current22、后验摘要及最终文档检查已关闭（本验证合同100%，不代表产品对齐100%）；最终收据 `.lime/qc/composer-persistence/fixture-teardown-final-20261015/receipt.json`。整体GUI仍partial：设置search及其他dirty表单、专业文件排版与批注、原生应用操作、remote产品入口、完整符号覆盖、OS输入及Windows未完成；全产品分母尚未完整枚举，不给伪百分比。

参考应用Computer Use曾被客户端拒绝，不绕过；参考实时效果仍not-run。REA静态结构、公开源码与Lime运行证据分别报告，不能互相替代。


## 专业文件接续（2026-10-17）

主线从已冻结的 Memory/Appearance 搜索切片转入[专业文件计划](codex-professional-files-alignment.md)。PDF 真实页面的实现、文件树二进制分发迁移、五语言与定向测试已落地；Renderer/Host 及固定 PDF 资源已构建。PDF 预览与点批注第一阶段已分别通过独立原生候选并冻结收据；截图/文字区域/文件变化恢复及canonical展示已分别原生通过并冻结。DOCX 版式、分页/缩放/修订和双入口已通过独立原生候选；两种格式已共享 DocumentAnnotation 草稿/编辑卡与提交 owner；DOCX 单条批注第13轮、跨两页批量第4轮均已独立原生通过。主 Composer 新增按文件审阅/取消/整组发送入口；DOCX 第5轮完整通过。PDF 第5轮通过原页码/编辑卡合同，但人工截图发现视口仍在第1页，已新增真实几何断言并修正提交后滚动，最终原生待验。工作表只读 WorkbookPanel 已实现且定向70项通过，完整类型/标准构建/原生验收中；范围反馈、幻灯片、进程重启耐久性与 Office 原文件编辑仍开放。当前验证候选基于上一已验收快照，仅覆盖本批 GUI 和 PDF 依赖；不代表最新并行 Rust/Plugin/协议/发布工作树全部通过。整体 GUI 仍 partial，不以局部测试或同名组件替代全产品完成度。


## 专业文件源路径与批注接续

固定1.159.0候选的标准GUI smoke24/24及导入6→Workbook7→PDF9→DOCX7四个串行原生场景均通过，94声明源/1688产物零漂移、Main正常退出、console/page错误0。组合收据 `.lime/qc/professional-files/import-source-path-final-20261017-1/receipt.json`，SHA `eb75b61c6484339c7d6c86bf5cc692d2b9da7f54176666154bf921a0fe1ad473`。已清除canonical操作路径显示裁剪、Office历史抽取文本错误Markdown分发、拆分fixture词法缺口及旧白底正向测试；保留完整源身份、真实原字节/位置/发送接受断言。Office的PPTX当前system_open仍是产品能力缺口。

随后应用scope批注迁移复用既有Jotai与annotations Store，4项失败回归先红后61项通过，并补真实Composer会话隔离/重挂载测试33项通过。独立应用scope隔离，进程重启耐久性unknown；完整wrapper及Workspace设置往返原生另行冻结，不能追加到上一收据。下一刀仍由本专业文件写集推进Slides，Rust/协议/账户/Plugin/release继续只读。


应用 scope 批注已独立冻结：标准 wrapper24/24，Workbook 原生第8轮真实设置导航卸载原 Workspace（原 Composer DOM isConnected=false），返回后两条正文、位置、源文件变化错误及主草稿保留；显式重定位后整批仅新增1个Turn。Main code0/signalnull、forcedCleanup null、console/page错误0、freshness前后ready，94源/1688产物无漂移。收据 `.lime/qc/professional-files/annotation-scope-final-20261017-1/receipt.json`，SHA `f40cbab2cbaf82af4696797e4dc5d89c48e8173725c4aa452bb723b7f779b5a4`，设置返回截图已人工复核。该收据不包含后续 Slides 变更；进程重启耐久性仍 unknown。


Slides最终验收（2026-10-17）：PresentationPanel、源slideId/点位置与跨slide反馈已沿统一artifact/annotations/Composer实现。Slides4、导入9、DOCX10、PDF12、Workbook11五原生及wrapper3的24/24通过；106声明源/2133 regular产物零漂移（更正此前2022）、错误0、Main正常退出、freshness前后ready。双份收据 .lime/qc/professional-files/presentation-final-20261017-1/receipt.json，SHA b58c5f2371fd49bd338e1a8fb028d4eea8697a43370e20dd8169aa41e57197f3。失败及人工发现的旧toast均保留并修复，完整说明见专业文件计划末节。旧不完整PPTX构造器、DOCX共享驱动名和PPTX系统打开正向分发已替换，无compat/deprecated新增。候选后端1.159.0，根1.160.0默认9因并行Cloud生成类型缺account而失败；不声明最新根通过。Office编辑/flush/save/冲突/roundtrip、其余GUI/符号和平台证据仍开放。


### 工作簿保存与共享回归接续

XLSX普通单元格编辑、原包保存/重开、冲突保稿、Workspace卸载后重开恢复、提交前flush与旧SHA批注重新定位已在固定1.160.0候选验收；同候选DOCX/PDF/Slides三轮共享回归通过，标准wrapper24/24。79份冻结证据见 `.lime/qc/professional-files/workbook-edit-final-20261017-2/receipt.json`，SHA `176685cd012fb03445b17a66d3506030950f1002ca0745d3917989ace05860e7`。

当前继续补CSV/TSV原生保存与全仓门禁。根Plugin并行变化使current fixture聚合在sidecar编译失败；local11暴露ImageGen未隔离真实账户轮询，组件fixture修复后11项通过，local12沿原状态续跑；CSV候选3旧请求键断言失败，候选4改验旧DOM卸载/原文件SHA/新真实IPC读取，重验中。具体失败、命名映射、分类和退出条件由[工作簿计划](codex-workbook-alignment.md)持有；该局部验收不关闭完整GUI。
