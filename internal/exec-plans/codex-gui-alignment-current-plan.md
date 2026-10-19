# Codex Desktop 与 Lime GUI 全面对齐

状态：active / partial。更新：2026-10-20。主目标仍是完整实现；局部回归通过不关闭整体差距。

## 目标与事实源

对齐GUI、排版、交互、目录职责、可确认的函数/类型/类与调用链，同时迁移或删除旧代码、文档、测试、fixture、snapshot及冲突护栏。只保留Lime主题、多模型/多协议、首页Banner，分别由现有token/skin、catalog/provider与Home presentation持有，不建立平行runtime。

- Desktop参考：`/Applications/ChatGPT.app`，Bundle ID `com.openai.codex`，26.1007.30912/build20156；ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- 使用REA6.4.0及独立Node24.21.0，复用认证原件。静态代码不证明参考运行；压缩符号、chunk hash不作为原始源码命名。
- 协议/runtime参考`/Users/coso/Documents/dev/rust/codex`。公开Rust源码不包含Desktop前端，不能从TUI推断GUI；包内CLI与公开HEAD的精确构建等价未确认。
- 唯一业务链：`Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection`。Desktop与CLI/TUI共用协议、runtime、工具、持久化及read model。

规则与映射：[设计](../aiprompts/design-language.md)、[质量](../aiprompts/quality-workflow.md)、[结构账本](../research/codex-desktop-rea/structure-alignment-ledger.md)、[Evidence索引](../research/codex-desktop-rea/evidence-index.json)。两个Lime设计/质量skills已经按当前目标更新，规则更新不代表产品完成。

## 当前主线

主顺序为窗口骨架/侧栏/首页/会话/Composer，再推进其余产品能力。当前窗口采用用户最新截图指定的rail＋contextual，保留折叠后的图标导航、44px共享标题栏、统一内容宽度和首页Banner；不回退legacy单侧栏或页内重复宿主。

当前切片由[侧栏及退役链计划](codex-sidebar-cleanup-20261020.md)与[分组计划](codex-sidebar-sections-20261020.md)持有：展开最小290、紧凑账号footer、独立项目/Recents分页、折叠/排序、hover动作和Composer听写/IME；同步删除跨产品导入与旧referral全链、旧账号卡片孤岛及过期正向测试/护栏。公开导出ProfileDropdownItems已映射唯一当前组件；其余本地职责名不冒称上游原名。新产物真实Electron和默认门禁在本轮计划结算，不借用旧候选通过。

最新REA进一步确认主窗初始1280×820、最小480×600；已直接替换旧1440×920/980×680限制，fixture不再修改minimum。Host重建r14及真实标准shell/reload/三宽/Settings smoke通过；格式化冻结后的Host r15曾捕获并行记忆模块缺少trait import，原进程已修正，r16重建通过。侧栏r6—r11失败原件保留；r11在真实focus与键盘诊断下复现Escape失败，Main正常退出。后继确定性回归确认刚获焦窗口，已在同一Dialog补齐关闭且12项通过；新REA仅确认参考关闭链，不宣称其运行时序。新产物r12真实侧栏通过三宽、浅深主题、Profile/Help、键盘重开关闭及canonical回读；10张截图全部查看，源/产物身份稳定、零console/page错误、Main正常code0/signalnull。该证据不涵盖provider、参考运行、Windows、packaged或整体GUI等价。

此前Composer上下文切片证据继续由[Composer上下文计划](codex-composer-context-suggestions-20261019.md)持有：

| 切片 | 已落地 | 当前验证与限制 |
| --- | --- | --- |
| 92 canonical Skill/inline mention | 删除installed_skill额外slash调度、宽松匹配/假Skill fallback、重复初始化状态及旧route徽标；导航解析唯一runtime Skill；默认glyph和inline-flow样式来自REA | 74套1341项、完整预检、新Renderer、标准GUI及真实rich/Sources/Plan/Goal/Skills通过；矩阵因PM textBetween漏叶节点失败。325产物与原失败已冻结，sourceDrift空 |
| 93 canonical用户消息 | 删除resolveUserMessageLabels、UserInstalledSkillMessageContent及额外sidecar徽标循环；迁移旧正向标签测试 | 根6套71项通过；独立10输入候选已通过8套102项、lint/types/contracts/i18n/治理并构建新Renderer，真实标准GUI/rich及54项观察、48张截图全通过；sourceDrift空、Main正常退出，325产物冻结。矩阵使用既有canonical DOM reader |
| 94 mention可见文档文本 | 按REA89 sJr补齐leafText，让PM普通文本读取包含displayName；canonical输入仍使用label/path/typed identity | 原真实EditorView回归已复现1失败/14通过；独立11套150项、完整预检、新Renderer/标准GUI/rich与54观察48截图通过，sourceDrift空；325产物冻结 |

92的Goal通过真实GUI暂停后验证同一线程目标paused、首轮completed、输入框可用与stop消失；没有关闭自动续跑或放宽身份/期限。92 Skills覆盖自动、显式和工作区手动启用；受控fixture证据不等于live provider。

## 写集与并行边界

当前根进程负责侧栏/Composer接线、canonical默认设置与请求配置、旧前端断言迁移、真实桌面fixture及主证据。导入projection/settings、事件与Item投影、public v2 import-only metadata及生成消费者已迁移；后继独立切片为目标附件物化、同步问答与AppShell快捷键Host。快捷键Host、目标附件与同步问答均已完成定向验证并冻结，Files搜索已迁入共享树；最终统一构建，不能用生成前结果结算。具体写集和日志由本轮专项计划持有。

避让并行provider、reasoning、memory、发布及未知Cloud增量，不覆盖、不提交、不推送、不建分支，不清空间或停止其他进程。共享生成物保留已有合法变更。固定候选、当前根源码、运行中的用户窗口和参考安装包分别结算。

## 各领域唯一owner与后续范围

| 领域 | current实现与事实源 | 尚未关闭 |
| --- | --- | --- |
| Shell/侧栏/首页 | rail＋contextual、AppShell/Header/MainContentLayout；[布局证据](artifacts/codex-shell-layout-rea-20261018/report.md)、[页头计划](codex-shared-page-header-20261018.md) | 全部内容、菜单、交互及结构命名的逐项验收 |
| Composer/草稿/附件 | 单一Controller/PM文档、typed提交、共享attachment generation、Host持久化；[排版](codex-composer-layout-20261019.md)、[Sources](codex-composer-sources-20261019.md) | 资源atom→Markdown serializer已在102实现；custom icon、全部file/plugin/MCP/commands消费者、复制恢复与新产物完整验收继续开放 |
| 用户正文/时间线 | canonical Thread/Turn/Item、虚拟列表、整条用户正文折叠和全文复制；[正文审计](../research/codex-desktop-rea/user-message-collapse-audit.md) | 内联引用分类/唯一目录解析/条件打开、复制回贴身份、全变体与平台证据 |
| Files/diff/右侧面/Terminal | ThreadSidePanelTabs、openWorkspaceFile、RightSurfaceHost、FileEditorController、既有diff和Terminal owner；[Unified计划](codex-unified-workspace-20261018.md)、[文件标签](codex-file-preview-tabs-20261019.md) | 完整目标发现、toolbar/context菜单、多选、后台session buffer/interruptedItemIds及平台分支 |
| 审批/Queue/线程设置 | PendingRequestItemPanel、ApprovalCard、QueuedMessageList、scoped设置authority | 自动审查及全部审批变体、durable active steer/paused/outcome-unknown、active/future Turn设置语义 |
| Side chats/Worktree/remote | 复用current App Server、scoped submission和现有workspace owner；[Worktree收据](artifacts/composer-worktree-native-20261018/handoff-receipt.json) | Side chats、完整创建/恢复/退出证据、remote/environment及错误恢复 |
| Settings/Profile | canonical sections/path、统一draft与字段保存；[公共Profile审计](artifacts/public-profile-current-audit-20261018/report.md) | 累计搜索目标/全部草稿的后继桌面验收、完整布局、远端eligibility/username/pins/upload及认证合同 |
| Office/专业文件 | 原字节预览、批注、已有Workbook/PPTX编辑owner | 见各领域计划；局部单元格/元素修改不代表完整Excel/PowerPoint，DOCX/PDF正文编辑入口证据仍不完整 |
| 输入与平台 | 当前macOS Electron/IPC及受控fixture；已有线程目标复用主Composer，AppShell唯一快捷键Host | 目标附件84项、同步问答102项及共享题稿57项、新线程目标97项与执行层13项已定向验证，真实进程待验；异步选中问题、compact/awaited、原生IME、microphone/voice、Windows与packaged完整矩阵仍开放，不能将任意pending状态猜为auto模式 |

异步问题的[完整静态调查](../research/codex-desktop-rea/async-user-input-audit-20261020.md)已转入[current纵切](async-user-input-alignment-20261020.md)：工具/canonical/public projection与Renderer表单、每题时间线、标准答案消息已实施；204项Rust回归和111项前端回归并集取得通过。六个可信root/config接点仍待写窗，真实producer默认关闭，agent-control fork过滤与真实Gate B尚未闭合；不得借同步reverse request或queue/start替代。消息/Artifact额外资料保存入口及其专用runtime、导航、资格、五语26key/语言和孤立helper已删除，133项独立定向通过，见[删除计划](message-artifact-knowledge-removal-plan.md)。普通Knowledge页面/底层API仍有消费者，后续独立对标，不列为额外保留特色。

其余跨owner合同见[剩余实施账本](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md)。缺少外部服务合同或参考运行flag时记录unknown，不造API或可用能力。

## 验证与退出条件

1. 参考模块/符号→唯一owner→输入输出/状态→调用者迁移与删除项→测试/Evidence可追溯；不能只比画面。
2. 成功、失败保稿、在途/迟到、scope/revision/readiness、卸载恢复、五语言、键盘/焦点按影响验证。
3. GUI主路径执行新Renderer、标准GUI及受影响真实Electron场景；Gate B关联preload/IPC、current JSON-RPC、同一canonical identity与用户可见状态。external backend/local provider fixture与live分开报告。
4. 保留Main原15秒正常code0/signalnull要求、freshness、源/产物摘要、身份和零mock护栏；不skip、不滤错、不手改通过状态。原失败86—92及其冻结件不可覆盖。
5. 默认门禁为verify:local；历史失败、缺失原件与未执行项保持开放，定向全绿不能替代全量或平台通过。新字节只按自己的执行收据结算。
6. 重大owner/架构变化同步architecture图与责任确认。当前93/94沿现有owner，不是第二套后端或新架构。

## 治理与完成口径

current：表中唯一owner、canonical输入与消息投影。已删除：旧slash Skill调度/fallback、重复状态、旧route及sidecar徽标；完整删除清单归专项计划和结构账本。本次新增compat/deprecated均为0，既有委托不扩张。

整体仍partial；没有完整验收分母，不编造总完成百分比。分别报告行为、结构/命名、清理和产品验证。当前阶段是新产物的真实Electron验收：侧栏、Help、同步问答跨线程恢复、目标首轮和长目标附件、共享文件树与本地菜单。Files本地原生目标已接唯一FileShellHost与共享query，24套242项基线及后继6套47项通过（不相加重叠）；fixture已迁移动态本机目标与真实clipboard，尚待Electron执行。Windows完整关联、editor/custom target、remote及其余内容消费者继续开放。

本页只保留当前状态与导航，逐轮细节由专项计划及不可变收据持有。旧历史入口：[2026-10-15](codex-gui-alignment-history-20261015.md)、[2026-10-17](codex-gui-alignment-history-20261017.md)、[2026-10-18](codex-gui-alignment-history-20261018.md)。外部清理造成的缺失证据只作历史观察，不恢复成有效通过。

## 当前证据与未关闭失败

- 侧栏 r5 已实际暴露“总列表 11 条含 Pinned/custom，Recents 只余 9 条”的读取缺陷。新 `listRecentThreads` 保留 canonical page 的服务端游标，`loadSidebarSessions` 按本地 scope 推进至独立预算；7 文件 63 项通过，旧平面请求与临时 prefix/长度猜测方案删除。Codex 真实 catalog 按 pageScope/host 维护 cursor/exhausted（新 REA 补证），其 sidebar 请求没有 sectionId，Lime 的协议适配不冒称参考 RPC 拆分。新命名复验与真实桌面待结算。
- Composer 文件附件的“设为项目资料”额外入口已按[REA 审计](../research/codex-desktop-rea/composer-project-knowledge-entry-audit-20261020.md)直接删除：按钮、透传、路径 handler/helper、五语 10 key 与过期正向断言一起清理；16 文件 143 项通过。普通文件上下文继续由原文档/附件 owner 持有；消息/Artifact 共享文本导入与 KnowledgePage 有实际消费者，留待独立对标，未列为新增保留特色。见[删除计划](composer-project-knowledge-removal-plan.md)。

- 引用：99 recovery1已完成Files引用打开及60项引用矩阵；102已实现atom→Markdown提交，19套336项与标准GUI通过。102及recovery1完成60项观察后均在原15秒Main正常退出门禁失败；原件保留，97/102退出根因仍open。不能再次列serializer为源码未实现，也不能把业务观察通过改写成整轮通过。
- 文件树：104已按REA103 recovery1的dzt/DC/ozt/wn合同实现默认关闭、共享开关与临时宽度，Host7套193项、消费者6套44项通过。真实桌面主题/多宽度、重载及Files/Changes共享仍由[计划](codex-file-tree-visibility-20261019.md)验收。
- 本轮侧栏：新聊天current ID统一为new-chat，侧栏/导航5文件80项通过；分组70、账号4、resize3。Composer实际听写/IME4文件44项通过，普通默认multiline。五语言760条死文案删除，完整率100%、unused0；没有保留重复UI。
- 深层退役：旧导入identity/query、nested设置、特殊事件合并/时间戳、Item投影及public import-only metadata已移除；全量前端逐批迁移过期fixture与断言，不恢复导入metadata、旧知识包/服务技能入口或裸mention提交。顶层canonical设置、工具当前metadata、审批authority保留。退役标记只用于负向守卫，不能继续演进。
- 读取竞态：旧inProgress采样跨越真实terminal时，thread/read、list与分页曾误报interrupted。现于判孤立前复核canonical terminal，保持页成员、游标与itemsView；16项确定性回归（含21组terminal/view组合）通过，真正cold orphan仍interrupted。canonical重验273/273，Skills watcher顺序12/12。新sidecar严格public JSON-RPC reviewer六回合、三次真实命令执行及terminal read一致已通过；最新二进制SHA `91331a9169a4ab6f49d63fc69b2ca2a47971f0ef592549c5dd84b86788463941`，本地受控provider、live=false，日志`/tmp/lime-codex-reviewer-fixture-r5.log`。
- Help/快捷键：ProfileDropdownItems的Help子菜单按parent bottom定位；AppShell唯一KeyboardShortcutsDialogHost跨Sidebar/Settings保留同一Mod+/注册，Dialog消费真实registry。旧两套文档快捷键源码及测试共4份删除，定向10套58项、renderer types、strict lint和文档守卫通过。静态参考不等于参考运行；新renderer及真实Electron待统一验收，见[审计](../research/codex-desktop-rea/profile-help-shortcuts-audit-20261020.md)。
- 已有线程目标：旧独立Textarea/Modal已删除，主Composer专用提交使用thread/goal/set，替换取消/失败/迟到保稿及CAS并集8文件97项通过。附件物化已在唯一AgentRoot和UUID目录实现，6文件84项并集通过；Home与threadless Inputbar共用新线程提交owner，97项与执行层13项通过，raw fallback和active-goal先set再steer路径已删除。trusted durable user origin、provider history 与 retained authorization 仍开放；Codex 不为目标修改新增 canonical 聊天回合，不制造目标编辑伪消息。参考目标模式不进入auto，抑制普通compact/single-line选择，不能把旧“目标auto待接”当作正确需求。
- 默认门禁：r6的lint、五语言、完整类型检查通过；前端全量r16已完成147/147批（日志`/tmp/lime-codex-frontend-resume-node24-r16.log`），完成后改变的owner分别补定向回归，不重新从第一批启动。r7因实施中问答面板未使用类型import在lint阶段退出，责任代理已修正，待冻结后复验。续跑会发现新增测试；已通过owner发生变化需另跑定向回归。contracts r7已通过（`/tmp/lime-codex-contracts-final-r7.log`）；当前新产物真实Electron及聚合current fixture仍待结算。

未关闭的其他完整GUI合同继续见上表和[剩余实施账本](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md)。Help/快捷键的新产物验收、完整命令迁移、账号远端合同、异步选中问题、新线程目标真实验收及 trusted origin、Files完整菜单/多选、durable active steer、原生输入与Windows不能记为完成。

- 2026-10-20后继冻结：Files 8套54项、同步问答102项、目标附件84项；Files冻结版renderer types与scoped lint通过。root已核对并确认architecture 3.2.1、Files共享树及目标附件职责。r8统一构建与真实Desktop场景执行中。

- 冻结后门禁：完整 Renderer/Node types r12、全局lint r11（后继goal窄改另有scoped lint）、五语言完整率100%/unused0、contracts r10通过。标准 `npm run verify:gui-smoke` r11通过，真实shell run `standalone-shell-01-20261019205845-49442`；新Renderer/Host/sidecar均已构建，专项Desktop场景与聚合current fixture待结算。类型r11在冻结前捕获payload literal widen两错，已由current owner显式类型修正，原失败日志保留。
