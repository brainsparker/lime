# Codex Desktop 与 Lime GUI 全面对齐

状态：active / partial。校准日期：2026-10-15。

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

主目标仍为全面对齐。Composer 富输入、草稿恢复、新建导航和 Skills 接线的产品验证已关闭；最终格式、docs边界、脚本治理、62本地链接与diff检查均通过，本验证切片已关闭；下一刀为设置 canonical 路由与返回，设置产品源码尚未改动。

本轮产品行为沿用已采用的 current owner：非 Composer accepted 回执进入既有可见 topic commit；Agent 文案复用 createI18n 五语言表。epoch、scope、binding.ready、revision、CAS、accepted 消费和新编辑保护保持有效。没有新增业务 runtime、read model、cache authority 或 compat。

本轮测试写集：

- current fixture 退出护栏：`claw-chat-current-fixture-smoke.mjs` 仅接入独立 teardown helper 与相邻行为测试，`current-fixture-regression-smoke.mjs` 纳入该回归，复用既有 `captureMainProcessExit/quitMainProcessNormally` owner。只有真实 Main code0/signalnull 和全部资源释放后打印 pass；15秒正常退出期限不放宽，强制回收只允许失败后且永不计入正常退出。巨型 smoke 入口仅替换 finally 接线，不继续堆叠收尾业务；后续仍须拆分原入口职责。
- `useAgentRuntimeSyncEffects.test.tsx`：旧 turn/start 回执迁 `turn.id/inProgress`，hook 与通知共享 canonical thread identity。
- `useWorkspaceSendStructured.unit.test.tsx`：boolean/void 夹具迁完整 typed accepted/rejected，保 dispatch lock、富稿与新编辑保护。
- `useWorkspaceResetRuntime.unit.test.tsx`、`newConversationPublicNavigation.integration.test.tsx`：覆盖根导航委托及编辑后的富稿保存/恢复；重复 `workspaceComposerReset.integration.test.tsx` 删除。
- `Inputbar/index.test.tsx`：六个成功、一个拒绝和一个延迟接受夹具迁 typed result，原 recent usage/恢复/元数据断言保留。既有大测试文件只做夹具窄改；不再增加业务分支，职责拆分另刀。
- 本计划、历史快照、研究报告/审计/索引及 `.gitignore` 精确文档准入。

沿用此前认领的翻译键清理、CommandWiring 与文案资源修复；不覆盖未知 release plan、`local-conversation-page-a83a1af2c24b.js`、`tsconfig.node.tsbuildinfo` 或媒体设置实现。没有提交、推送、重置或创建分支。

## 已采用切片与证据边界

| 范围              | current owner / 迁移                                              | 已取得证据与剩余范围                                                                                                               |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 设计/质量规则     | 两个 Lime skill 与领域事实源                                      | 已按三项保留差异、结构命名和风险门禁更新；不代表产品全面完成                                                                       |
| 长历史/用户正文   | threadVirtualizer、VirtualizedTurnList、共享正文显示              | 原身份真实滚动、动态测量、冷恢复和长正文 Gate 已过；不是完整视觉等价                                                               |
| 审批/Queue        | PendingRequestItemPanel、ApprovalCard、QueuedMessageList          | 同一 server request/decision/queue authority；pending、history/paging/search、图片真实读取有对应证据；自动审查及全部变体待核       |
| Files/diff/右侧面 | ReviewThreadSidePanelTab、ChangesPanel、RightSurfaceHost          | 四文件 diff/定位与 Browser 双 tab/关闭不复活已验收；其他 editor/surface 完整行为待核                                               |
| Composer/NodeView | ComposerController、EditorView、NodeView registry/toolbar/plugins | 单一正文、结构化输入、语言/高亮与 rich Gate 已采用；原类名未知的项目不搬压缩名                                                     |
| 持久草稿/新建导航 | Coordinator、Host persisted atom Store/File、useAppNavigation     | packet21 三入口首发、rich Stop、Home 冷恢复、三工作区两正常冷恢复四合同通过，均绑定原源码/产物                                     |
| Skills accepted   | CommandWiring -> existing visible topic commit                    | packet22 三路径及 current22通过；最终新构建结果另记                                                                                |
| 设置第一切片      | 单一 sections、公开 SettingsPage                                  | 九源正式采用，重复名单/SETTINGS_GROUPS/ExecutionTracker/V2 aliases 删除；15章节/24首屏/157原生读通过，路由/返回/search/dirty待交付 |
| Thread settings   | scoped EventBus/adapter/既有 cache                                | idle model/cwd 已验收；不推导 active/future Turn 执行                                                                              |

完整映射、调用者、删除项与 Evidence ID 由结构账本和领域审计持有；上表不按同名文件数计算完成度。

## 当前验证状态

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

## 下一刀：设置canonical章节与返回

前一验证切片已关闭；设置第二切片现进入实施，详见[设置审计](../research/codex-desktop-rea/settings-navigation-audit.md)。

本刀认领：`useAppNavigation`及相邻测试、`types/page.ts`、App/AppPageContent及接线测试、AgentChatPage/contract/既有workspace surface回调、SettingsPage/SettingsNavigation及测试、五语言settings资源与类型/加载回归、settings-about/project-gate-settings-a/tool-surface导航消费者、对应文档。现有脏内容只作窄增量，不回退他人修改；release plan、媒体设置实现、参考解包chunk与tsbuildinfo继续避让。

Verification Contract：root，budget:normal，P1。`SettingsPage -> useAppNavigation -> AppPageContent`是唯一导航owner链；实际会话位置仅沿现有workspace surface投影发布session/workspace，由导航requestId拒绝迟到报告，不新建runtime/read model/history。返回只保存最小可恢复Agent参数，去除发送、新建、启动等一次性intent。章节选择直接消费/回写canonical SettingsPageParams，删除initial-props/local-selection双轨；页头返回与rail Home分开。真实Electron合同为Home首发生成会话后进入设置切章返回、已有会话切章返回；要求preload/IPC、current thread读取、同一session/workspace、可见会话与零重复发送/production mock。直达无来处、非Agent来处及快速导航以owner/component回归补足。先定向与五语言/type/lint，再标准GUI smoke及真实Electron场景；新产品变化开启本刀默认本地验证，历史通过结果不冒充新源码缓存。无live/Windows/参考实时观察；dirty/search后置。不需要LLM judge或release artifact。

架构影响：既有导航owner内增加返回位置与显示投影接线，跨层业务边界不变；同步architecture 4.4的数据流，由root于2026-10-15确认后记录实际验证，不提前宣称完成。

- Owner：useAppNavigation既有requested/committed/requestId持有设置参数与进入上下文；SettingsPage消费canonical章节，内部点击回写同一PageParams；不新增第二history。
- 入口接线：App/AppPageContent -> SettingsPage/SettingsNavigation；providerView/providerFocus/executionPolicyFocus与Experimental委托语义保真，离开章节不重放旧焦点。
- 返回与Home分开：页头返回恢复进入设置前实际可见会话/workspace，rail Home仍进入首页。不能仅保存旧根params，因为Home首发后params可能尚无真实会话，并可能含一次性发送/newConversationRequest。
- 先沿既有onSessionChange投影携带真实workspace/session；它仅是导航显示位置，不建立新业务read model。剔除初始发送、fresh与其他一次性intent。
- 窄写集：useAppNavigation、App/AppPageContent、既有session投影回调、SettingsPage/SettingsNavigation、PageParams及定向测试；五语言返回文案；settings-about/project-gate-settings-a/tool-surface消费者按新返回语义迁移。实施前核对各文件最新脏写集。
- 必须覆盖Home首发后进入设置再返回同一会话、已有会话切章再返回、直达设置fallback Home、快速导航/迟到投影不夺取返回目标。
- 验证：owner/component接线回归、五语言稳定断言、contracts按边界触发、标准GUI及真实Electron两条返回路径；同一identity的bridge/read model/可见状态和零production mock。
- Memory/Web Search dirty owner已只读确认；其他表单与内容搜索继续查实际owner，不能复制未提取registry/隐藏章节或新造全局dirty业务状态。

## 分类、完成度与未验证范围

- current：表中既有owner、当前协议fixture与新build验证链。
- compat：仅已存在的Experimental -> Developer设置委托；本轮新增0。
- deprecated：本轮没有新增延期双轨。
- dead/deleted：旧组件/名单/V2 aliases、general草稿事件双轨、布尔接受夹具、重复reset integration、finally前打印pass及吞掉资源退出失败的旧fixture路径；有效风险由current语义回归承接，禁止恢复旧实现迁就测试。

前端续跑为132/132批（100%仅该历史测试发现集合），新增退出回归单独及聚合通过；默认组合、新current22、后验摘要及最终文档检查已关闭（本验证合同100%，不代表产品对齐100%）；最终收据 `.lime/qc/composer-persistence/fixture-teardown-final-20261015/receipt.json`。整体GUI仍partial：设置完整路由/返回/search/dirty、专业文件排版与批注、原生应用操作、remote产品入口、完整符号覆盖、OS输入及Windows未完成；全产品分母尚未完整枚举，不给伪百分比。

参考应用Computer Use曾被客户端拒绝，不绕过；参考实时效果仍not-run。REA静态结构、公开源码与Lime运行证据分别报告，不能互相替代。
