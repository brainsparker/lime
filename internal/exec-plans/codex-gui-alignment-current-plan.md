# Codex Desktop 与 Lime GUI 全面对齐

状态：active / partial。更新：2026-10-18。主目标是完整实现，单个切片通过不能关闭整体差距。

## 目标与事实源

使用 REA 对齐可确认的 GUI、交互、目录职责、函数、类型、类与调用链；直接迁移或删除旧代码、文档、测试、fixture、snapshot 和冲突护栏。仅保留主题、多模型、首页 Banner，分别继续由 token/skin、catalog/provider 和 Home presentation 持有。

- 参考 `/Applications/ChatGPT.app` 实际为 Codex Desktop，Bundle ID `com.openai.codex`，版本 `26.1007.30912`、build `20156`；ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- REA 6.4.0，独立 Node 24.21.0。复用匹配 Evidence，不将静态代码写成运行结果，不将压缩变量写成原始源码符号。
- Runtime/协议参考 `/Users/coso/Documents/dev/rust/codex`，已核 HEAD `31434401fa3cd111866acdc1bba2a73b561f53d5`。公开仓库没有 Desktop 前端；附带 CLI `0.162.0-alpha.17.2` 与该 HEAD 的精确构建等价 unknown。
- 唯一业务链为 `Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection`；Desktop 与 CLI/TUI 共享协议、runtime、持久化和工具 owner。

设计和质量规则见 [design-language](../aiprompts/design-language.md)、[quality-workflow](../aiprompts/quality-workflow.md)；研究与命名映射见 [report](../research/codex-desktop-rea/report.md)、[结构账本](../research/codex-desktop-rea/structure-alignment-ledger.md)、[Evidence 索引](../research/codex-desktop-rea/evidence-index.json)。`lime-design-language` 与 `lime-quality-workflow` 已按当前目标更新，规则完成不代表产品完成。

本页只维护活动状态与领域导航。逐轮过程保留在 [早期历史](codex-gui-alignment-history-20261015.md) 和 [2026-10-17 历史快照](codex-gui-alignment-history-20261017.md)，不再并列维护历史“下一刀”。用户曾清理 `.lime/`；缺失原件不能恢复为有效证据，后续冻结件独立绑定来源。

## 当前阶段与写集

用户最新纠偏将**可见 GUI 与排版复刻**置于活动主线：先窗口骨架、主侧栏、首页、会话区与 Composer，再推进其余功能。下文专业文件候选仅为独立待验工作，不再占据当前交付顺序。

本轮窄写集：`App.tsx`、`useAppShellLayout`、`app-sidebar` 布局及其调用点、`EmptyStateLayout/EmptyStateHero/EmptyState` 首页接线、旧首页入口树及专用状态清理、设置布局/导航、`mainWindowOptions`、受影响测试/fixture选择器与布局证据。保护现有 Cloud/account 业务增量；Rust、协议、Plugin 和其他工作台业务 owner 只读。参考实际 `app-initial` App Shell；`sidebar-a9ef58c0cd4b.js` 导出的是 ScheduledSidebar，旧主侧栏模块映射作废。首页以实际 HomeComposerRoute 及其布局函数为准，保留 Banner，移除强制整屏翻页和重复展示。

退出条件：对齐参考中的实际几何、导航密度、内容宽度与滚动结构；迁移冲突测试；取得受影响定向回归、标准 GUI smoke 和真实画面证据。静态证据与产品验证分开记录，未取得时保持 partial。

页头后继写集：新增 `app-shell/AppShell.tsx` 的基础三槽 HeaderAction scope/registry/renderer，迁移 AppSidebar 的侧栏开关及共享测试 mount。依据 [HeaderAction 合同](artifacts/codex-shell-layout-rea-20261018/sidebar/header-action/report.md) 的已确认明文属性；不将压缩符号用于产品命名。此次实现基础三槽，后继窗口已按用户图一迁到 rail＋contextual，不声明 unified/page Header/MainContentLayout 全部完成。窗口拖动层下移至共享动作下方，消除透明拖动区拦截按钮。默认门禁发现的 CodePreview 深导入通过现有 general-chat bridge 收敛，不改预览逻辑。

历史候选、两次外部清理与Office分域验证迁至[2026-10-18历史](codex-gui-alignment-history-20261018.md)。用户已确认清理停止。历史缺失原件不恢复为有效通过；独立候选、当前根与后继63输入分别结算。当前避让Plugin、Cloud/account、Rust、协议/生成客户端与release生产写集；不改变其他进程生命周期。详细Office合同继续由各自领域计划持有。

## 已采用能力与证据边界

| 范围                     | current owner 与状态                                                                                         | 仍开放的范围                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 窗口/主导航/首页         | rail＋contextual/44px共享标题栏/Banner与独立Composer；最终配色GUI6为24/24，visual8十图已复核 | 恢复产品验收已通过；共享页头后继与其余内容/命名差距 |
| 设计/质量 skills         | 已更新保留差异、结构命名和门禁规则                                                                           | 产品全面对齐另验                                            |
| 历史与正文               | threadVirtualizer、VirtualizedTurnList、canonical正文                                                        | 全变体视觉与平台证据                                        |
| 审批与队列               | PendingRequestItemPanel、ApprovalCard、QueuedMessageList                                                     | 自动审查与全部审批变体                                      |
| Files/diff/右侧面        | ReviewThreadSidePanelTab、ChangesPanel、RightSurfaceHost                                                     | 其他 editor/surface 的完整行为                              |
| Composer/草稿/新建       | Controller、NodeView、Coordinator、Host Store/File；前一切片固定身份验收                                     | 完整符号、OS输入和平台证据                                  |
| 设置导航与草稿           | canonical sections/path、统一draft与字段保存；Memory、Search、Provider、Environment、Policy、Profile局部验收 | 其余草稿 owner、整页结构/布局/行为                          |
| 设置内容搜索             | 同一settingsSearchDocuments与导航owner，36目标已有历史验收；Developer/Media新增11目标已实现并定向验证        | 累计47目标的后继真实桌面验收、其余current设置内容与保稿场景 |
| Profile                  | 本地内容/布局与认证入口分离                                                                                  | 公共GET/PATCH、eligibility、username/pins/upload等真实合同  |
| PDF/DOCX/Workbook/Slides | 原字节预览、统一批注/批次、应用scope草稿与回原文分别验收                                                     | DOCX/PDF正文编辑入口待证；PPTX编辑继续实现                  |
| Workbook编辑             | XLSX普通单元格、CSV/TSV保存与重开、冲突、flush有固定候选证据                                                 | 完整Excel编辑/公式/样式/图表等范围                          |
| Thread settings          | scoped EventBus/adapter/既有cache，idle model/cwd局部验收                                                    | active/future Turn执行语义                                  |

## 共同验证合同与退出条件

风险按领域选择；本轮窗口/导航为非live GUI切片。不得放宽正常Main退出15秒期限、freshness、来源/产物摘要、身份和零mock守卫，不skip、不滤错、不手改续跑状态。

1. 参考模块/可确认符号 → 唯一current owner → 状态/输入输出 → 调用者/删除项 → 测试与Evidence必须可追溯。
2. 定向行为覆盖成功、失败保稿、在途/迟到响应、scope/revision/readiness及真实卸载恢复；五语言、键盘/IME和焦点同验。
3. GUI主路径执行标准 `verify:gui-smoke`；Gate B包含真实Electron/preload/IPC、`app_server_handle_json_lines`、current JSON-RPC、同一canonical Thread/Turn/Item和用户可见状态。
4. 最终证据核对声明源、regular产物、prepared sidecar与前后freshness；正常Main code0/signalnull，强制回收只能发生在失败清理且不得算通过。
5. 固定候选与最新根分开结算；真实fixture使用受控external backend时明示绕过production provider，不冒称live、Windows或安装包。
6. 架构/owner变更同步架构图与责任开发者确认；旧实现/文档/正向测试与冲突护栏一起迁移，不能为旧snapshot恢复双轨。

## 分类、未完成范围与下一刀

current：表中唯一owner及本轮窗口/导航/首页布局。compat：仅现存已登记委托，不扩张。deprecated/dead：已被替代的组件、别名、第二份草稿状态及旧正向fixture直接迁出；精确删除清单由领域计划与结构账本持有，新能力不得恢复旧runtime。

下一刀按实际 GUI 主线推进：

1. 当前根按用户最新图一改为 rail＋contextual，保留图标栏的折叠、共享可调宽度与44px窗口标题栏、首页单滚动容器及Composer最大宽度、设置同一导航骨架；完整原件与映射见[布局证据](artifacts/codex-shell-layout-rea-20261018/report.md)。最新首页11文件131项、工作台6文件61项定向测试通过，Renderer/Node类型与strict lint通过；最终配色下标准GUI6为24/24，visual8十图均实际查看并通过首页排版复核；恢复后继已取得restart27、reload33、GUI24及22场景聚合；Coding退出护栏后继另验。旧87/119项仅保留为历史快照。保留全部失败轮次和原5秒测试期限。
2. visual8已取得1440/1024/800、折叠/拖宽、Home/Settings、浅深主题的十张实际画面，Home排版及可读性通过；最终Rust恢复产物的继续发送/停止与终态隔离已完成真实验收；整个GUI仍partial。当前[共享页头后继](codex-shared-page-header-20261018.md)接入Header/MainContentLayout并清退46px页内宿主，产品验证正在进行；账户底部和其余会话/Composer结构继续按REA确认，Settings/Plugin内容不因骨架通过算完成。
3. Worktree退出/粘贴独立候选已完成构建与freshness，完整types、定向87/event-policy3通过；标准wrapper仍not-run，runtime及两代原生场景未启动。该独立候选不代表最新根。交接见[收据](artifacts/composer-worktree-native-20261018/handoff-receipt.json)。
4. Workbook18-v3和设置/Queue45的63输入仅完成后继preflight，未apply、未创建整合候选；Active Queue durable仍在独立安全副本未合根。Office候选6保留partial及30失败/323通过、类型中断事实；不再占据窗口布局主线。
5. 公共Profile认证主链已由[当前审计](artifacts/public-profile-current-audit-20261018/report.md)重新确认；pins同ASAR真实lazy target已补证，但外部业务合同和产品实现仍有缺口。其余unknown由[剩余账本](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md)持有，不造服务、可用flag或未经观察的参考运行分支。

整体仍partial；尚缺完整产品分母，不给伪整体百分比。专业文件预览、某批搜索目标、组件测试或规则全部通过均不等于整个GUI完成。参考运行、OS IME/mic/主题事件、全skin、完整production/live、Windows/安装包及进程重启耐久性只能由各自真实证据关闭。



## 2026-10-18 用户截图纠偏：feature navigation rail

主目标：按用户最新图一替换 legacy 单侧栏。旧图二不是当前基线。用户截图指定 `rail-with-contextual-sidebar`；参考进程内部 flags 仍 unknown，不能据此继续选 legacy。

窄写集：App.tsx、AppSidebar.tsx、app-sidebar 的布局/rail/宽度及定向测试、app-shell 标题栏、capture-layout 与本计划/架构/设计事实源/证据索引。继续避让 Cloud/account、Plugin 业务、Rust 与协议生成增量。默认门禁上一轮进程收据仅对应其源快照。

合同：D2o/Vts rail + iEs contextual navigation；cDs 非 legacy 最小宽 290；keepVisibleWhenCollapsed 保留测得 rail；PageSurface titlebar 44、rail 36px 控件+两侧8px、上下文 Header52。新聊天只在上下文列，其余主 destination 在 rail。沿用 canonical 会话/项目 actions，不建业务状态副本。只对已具备的真实 destination 接线，不补空按钮。

退出条件：真实 Electron 验证展开、折叠保留 rail、Home/插件往返、设置、resize、小窗口 Composer 与浅深主题；零 mock、freshness、源码一致和 Main15秒退出保持不变。迁移旧0宽/无rail测试，历史失败证据保留。全GUI仍 partial。

## 2026-10-18 首页旧入口直接退出

用户明确要求删除原有实现、不留历史包袱。写集扩展至 EmptyState/home 专用组件、hooks、类型与五语言文案、Workspace 对旧首页数据的单向接线、受影响测试和 CDP 选择器。保留 canonical ComposerController/草稿/发送/附件/模型/Skills，不碰 runtime 或协议。依据既有 dLt / HomeAmbientSuggestionsContent REA：Banner 属 presentation；Composer 独立下部布局，宽度上限48rem、panel单侧24px。没有 current ambient 数据端点时删除旧13入口，禁止截取旧任务冒充建议。136px编辑区是用户要求放大的 Lime 显示调整，不标成上游实测值。退出条件为旧树与死接线删除、风险测试迁移、类型/文案/护栏通过、真实 Electron 三尺寸及主题截图。

收尾清理追加：删除永不成立的首页 creation selector 分支及专属五语言文案，删除未消费的 runtimeToolAvailability/runtimeTaskCard/browserAssistLoading/Memory/Channels props；移除仅为这些 dead props 计算任务卡的 useWorkspaceConversationLandingSessionRuntime，调用处直接消费唯一 landingSurface。仅清首页专用接线，不删除会话页的工具、任务卡或记忆领域能力。写集扩展到 ConversationSceneRuntime 对应调用、测试 fixture；仍无新增兼容层。

当前清退：24个精确路径均不存在，生产代码/脚本及current文档/skills没有退休首页符号引用；无新增compat/deprecated或第二runtime。详细分类、摘要、每轮结果由[唯一切片报告](artifacts/codex-shell-layout-rea-20261018/report.md)及其manifest持有，不用历史截图代替最新验收。

已通过home-tests-6的11文件131项、home-tests-8的6文件61项、最终Banner回归3/3及strict lint；五语言8731 keys一致、unused0。Renderer/Node完整类型在verify-local-home-3通过，最后仅Hero配色和Layout回归由home-types-8定向语义检查通过；失败的type7配置检查原件保留。全量导出扫描守卫窄写集为src/lib/governance/agentRuntimeExportBoundary.test.ts：Dirent、预过滤生产源、最多8个并发读取，roots/extensions/production/符号链接/pattern与原5秒全部不变。定向4/4、全量第61批16文件81项通过，扫描4358ms。

首页最终配色的标准GUI6已24/24通过；visual8十张真实截图已全部查看，居中、一次gutter、136px编辑区、Banner间距/可读性及装饰不遮控件通过，Main正常退出、freshness与零错误/mock通过。visual6原15秒退出失败、visual7深色文字及误开菜单的人工拒绝均保留。使用既有skin调色板，无新增主题owner。后台reload25项及multi-running31项通过；完整重启暴露的current恢复投影缺陷独立修正、验证。架构图由责任root确认，保护并行Plugin及协议写集。

默认verify-local-home-3通过版本/文案/unused/全量lint/完整类型和61至77批；78批150项断言通过后worker onTaskUpdate超时，exit1。home-resume-4仍在78批失败：243通过、25失败（23项原5秒超时及2项undefined checked/matches），另有worker RPC超时；后继79..139批未跑，不手改状态、不放宽期限、不覆盖Office owner。独立release测试在隔离candidate运行，不等于当前根证据。current-fixture第二轮的unknown-item及home-hotpath真实场景通过；第三条短问候已完成canonical Turn、GUI回复和正常Main退出，但提交确认1841ms超过原1800ms预算，聚合exit1，其余未运行。失败保存current-fixture-greeting-failure.json；最终fresh构建后单独复核，不提升为全聚合通过。


### 后台重启验收暴露的 current 修复

2026-10-18 后继补证：真实普通持久化会话冷重启后，旧Turn已显示interrupted且GUI空闲，但公共turn/start仍报-32012 `turn already active`；诊断原件见cold-continuation-probe及cold-regular-resume-before.log，公共回归已复现。写集追加开始前clean的`runtime/session_lifecycle.rs`：仅在ensure_current_session_hydrated插入既有StoredSession之前，使用同一load context已归一化的session/turns；事件、输入、runtime options与持久化原件不变，不新建owner或compat。公共回归同时保留普通/fork两种hydration路径、真实新Turn completion及旧orphan不复活。退出条件为受影响Rust回归、新sidecar与真实Electron继续发送/停止，原超时门槛不变。

对应真实回归放在既有scripts/agent-runtime领域的`reopen-turn-continuation.mjs`；原3019行gate仅增加import和restart分支调用，不继续堆叠场景实现。该长文件例外限本次接线，退出条件为继续发送、backend精确新Turn identity、GUI停止、两Turn终态和正常Main退出均通过；不增加命令/后端或第二套gate。原restart不伪取消orphan的断言继续生效，新Turn通过GUI实际停止。

清退规则补漏的窄写集：开始前clean的`internal/aiprompts/playwright-e2e.md`及`lime-playwright-e2e/SKILL.md`，按skill-creator更新旧私有turn/start示例、旧请求字段/退役runtime prompt路径和“补mock”建议；统一current typed input、服务端Turn identity与fixture/生产边界。只修正已证明的冲突，保留现有其他领域手册；技能格式、引用及文档守卫作轻量验证，不为规则更新再跑产品全量。

归档22场景时发现Coding Workbench fixture缺少退出收据，旧finally会吞app.close超时、发SIGTERM后仍成功。写集追加开始前clean的`scripts/electron/code-artifact-workbench-fixture-smoke.mjs`；仅将退出接入既有captureMainProcessExit/settleFixtureResources，成功统一在真实Main15秒code0/signalnull和资源回收之后结算，删除旧退出包装，不改业务脚本/协议。长文件例外仅此生命周期接线；退出条件为既有guard/teardown/driver回归和该真实场景后继正常退出。原22聚合是这一护栏修正之前的快照，不伪装新脚本已全聚合验证。

最终切片验收：24旧路径全部不存在，current生产与文档无退休首页符号，新增compat/deprecated为0；仅保留既有主题/多模型/Banner。普通冷恢复Rust24项通过；fresh真实restart27、multi reload33、标准GUI24通过，完整current聚合22场景全部执行且exit0，28声明源无漂移。Coding退出护栏后继36项与真实41项通过、Main正常退出、29声明源无漂移；初始聚合66原件和后继分别归档。visual8的22布局源继续零漂移；技能与事实源清退通过等价YAML/引用/命令及文档验证，官方Pythonvalidator缺PyYAML的未执行事实保留。清退24/24为100%；整个GUI仍partial、没有完整产品分母，默认本地78批失败与偶发Main超时未知原因继续开放。责任root确认既有owner和依赖方向未变，本后继不是重大架构迁移；没有提交、推送、分支或系统清理。

background reload单会话25项和multi-running31项真实Gate B通过；restart失败于读模型仍active/inProgress。对照公开Codex `request_processors/thread_processor.rs:thread_read_response_inner`与`request_processors/thread_lifecycle.rs:set_thread_status_and_interrupt_stale_turns`，持久化历史不能证明当前执行仍存活。

窄写集：`runtime/thread_read.rs`及其`tests.rs`/`tests/history_visibility.rs`、公共`tests/thread_loaded_list_jsonrpc.rs`；追加开始前clean的`runtime/turn_execution.rs`。后者只给现有RuntimeTurnDriverCompletions增加10行按session查询pending Turn ID的只读方法，不新增状态、编排或actor生命周期；该长文件不再堆叠其他逻辑。保护并行Plugin/Rust其他热区。

首次公共冷恢复before-3已复现active vs idle；actor_loaded尝试的13项unit与contracts4通过，但追加真实新Turn后，before-4在public turn/completed之后仍active，证明仅区分actor存在不足。最终实现删除临时actor_loaded，使用actor active identity与现有driver尚未收敛的具体Turn identity，旧orphan归一化为interrupted；保留terminal convergence和queued语义。不改协议或持久化，不新建owner、fallback或compat。公共回归验证cold read→resume→read/turns/list→新Turn实际完成→旧Turn仍interrupted。

最终pending identity实现的公共JSON-RPC集成3/3、thread_read13/13和实际task终态1/1通过；普通hydration后继进一步取得公共4/4、hydration1/1、read13/13、pending recovery5/5和multimodal queue1/1。恢复关闭迁入现有captureMainProcessExit/settleFixtureResources，真实Main15秒code0/signalnull与零console错误成为通过条件，移除静默吞close错误；三套38项、strict lint/format、contracts通过。新sidecar已准备成功，真实restart继续发送/停止27/27与multi reload隔离33/33通过，声明源码无漂移；最新标准GUI/current聚合见home-continuation-product收据。早先restart在24业务断言全真后Main退出超时，后继通过不证明根因修复。原5秒、180秒、15秒和1800ms不变，所有无效runner/fixture及有效失败原件保留。

## 2026-10-18 共享页面页头后继

当前切片见[共享页头计划](codex-shared-page-header-20261018.md)。按REA已证Header/MainContentLayout直接迁移，会话内容与动作由同一窗口renderer呈现；删除旧46px宿主/inset、App重复主容器样式及侧栏折叠补位。69项、完整types/strict lint、标准GUI24/24和真实thread-header-final-3（rename/fork、七画面、freshness、Main正常退出）通过，只作为接线迁移快照。用户后继要求Codex没有的全清退后，再删除重复导航、常驻状态/目录与专用派生/props；新74项、VM4后继、完整types/strict lint、docs和治理通过，最新GUI与真实场景待最终产物。此前visual8与final-3都不是本清退后继画面证据。

线程标题补证确认当前安装包同时含普通title/rename和有条件隐藏/UnifiedTabStrip分支，不能把所有模式都无标题或固定显示标题写成事实；精确REA来源、三函数scope与未观察flags见[报告](artifacts/codex-shared-page-header-20261018/thread-controls/report.md)。统一工作区已补完整注册器及shell渲染器REA，2575/19005bytes均解析，合同见[unified-workspace](artifacts/codex-shared-page-header-20261018/thread-controls/unified-workspace-contract.md)。下一刀按此合同映射既有right-surface owner，不增加第二份tab业务状态或单独hide-title开关。整个GUI仍partial；历史失败、全量78批失败和未取得参考运行/Windows/live事实继续保留。

清退后标准GUI24/24与真实cleanup-1的canonical重命名/分叉/设置返回、12源摘要及正常Main退出通过；7图人工复核发现提示遮挡/草稿恢复未稳定。后继cleanup-2坚持等待ready，在原120秒失败，暴露页头分叉直接调用raw hydration、绕过workspace草稿scope提交的真实缺陷。仅将该调用迁到已有`handleOpenTaskTopic`，无新增owner、状态或协议；23项导航/页头回归和strict lint通过，完整类型、标准GUI和父子草稿隔离后继正在验证。不能把cleanup-1当完整视觉等价或把后继失败抹去。

## 2026-10-18 Unified工作区直接替换

[专项计划](codex-unified-workspace-20261018.md)继续主目标。先结算上一切片：父路由恢复后继完整types、标准GUI24、真实页头7图/父子草稿隔离及加严Fork Gate B均通过；unavailable backend无Turn/模型。保留原失败和全量78批失败，不能当全GUI等价。

本轮物理删除旧TaskCenterTabStrip/useTaskCenterTabChrome/专用projection与旧正向测试，保留title清洗为threadTitle及canonical fallback导航。共享scope新增UnifiedTabStrip，ThreadWorkspaceHeader转HeaderToolbar presentation，动作进右侧unified-workspace-controls；右侧pane/tab分别由同一projection显式接到内容host/共享标题栏。删除42/84px split/detached和auto-hide补位，复用LayoutTransition的resize/transition与真实焦点。登记的本地展示适配字段不是上游原类型，完整route transition context及全部动作destination仍未覆盖。新构建GUI与Electron后继正在验证；整个GUI仍partial。

## Unified后继：真实目的地与分隔条

唯一[专项计划](codex-unified-workspace-20261018.md)继续持有当前工作。thread/summary动作按REA容器职责进入window/chat/tab-strip；标签与实际pane几何对齐。隔离9462源候选3六步骤全部通过：完整types、renderer、标准GUI24、真实页头/分隔条、右侧面矩阵32与Activity28；键盘10px、Home/End、320px边界、pointer起点/增量、双击恢复及焦点均取得真实Electron证据。候选4加严静止截图并通过，产品字节与候选3相同。候选5删除team/code/Right Surface最小宽度覆盖，94项定向与strict lint、完整types及同一六步骤通过，541产物摘要保留。它是冻结候选，不代表并行根后端已验证；全GUI继续partial。

候选2终态failed和独立BODY焦点探针、317失败产物摘要保留；同一LayoutTransition修复已在候选3/4/5验收。后继候选6补齐已证HeaderToolbar/Actions尺寸、inset、compact/secondary和42rem具名容器合同，迁移旧DOM标识；28项与strict lint通过，精确四输入冻结后重建/真实GUI六步骤通过。该API补齐不证明旧工具分组或窄窗所有动作已等价。REA线程Summary补证确认300px、overlay/shift/gutter与条件sections；后继已物理删除Activity，接独立canonical Summary与同一Host pin。候选7的338项、完整types/Host/Renderer通过，但原生验收依次暴露准备资产、旧Browser-tab计数与240条trace ring覆盖问题，原失败及摘要保留；后继改用既有连续collector，不放宽断言。Files默认250/max容器60%/min200/10px/拖动关闭的REA合同已实现，21项定向与strict lint通过，候选9冻结9470源正在验收。Summary其余sections、工具栏分组仍开放，详见专项合同。参考运行窗口、live、Windows与packaged仍未取得。
