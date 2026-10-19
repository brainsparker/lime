# Codex Desktop 与 Lime GUI 全面对齐

状态：active / partial。更新：2026-10-19。主目标仍是完整实现；局部回归通过不关闭整体差距。

## 目标与事实源

对齐GUI、排版、交互、目录职责、可确认的函数/类型/类与调用链，同时迁移或删除旧代码、文档、测试、fixture、snapshot及冲突护栏。只保留Lime主题、多模型/多协议、首页Banner，分别由现有token/skin、catalog/provider与Home presentation持有，不建立平行runtime。

- Desktop参考：`/Applications/ChatGPT.app`，Bundle ID `com.openai.codex`，26.1007.30912/build20156；ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- 使用REA6.4.0及独立Node24.21.0，复用认证原件。静态代码不证明参考运行；压缩符号、chunk hash不作为原始源码命名。
- 协议/runtime参考`/Users/coso/Documents/dev/rust/codex`。公开Rust源码不包含Desktop前端，不能从TUI推断GUI；包内CLI与公开HEAD的精确构建等价未确认。
- 唯一业务链：`Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection`。Desktop与CLI/TUI共用协议、runtime、工具、持久化及read model。

规则与映射：[设计](../aiprompts/design-language.md)、[质量](../aiprompts/quality-workflow.md)、[结构账本](../research/codex-desktop-rea/structure-alignment-ledger.md)、[Evidence索引](../research/codex-desktop-rea/evidence-index.json)。两个Lime设计/质量skills已经按当前目标更新，规则更新不代表产品完成。

## 当前主线

主顺序为窗口骨架/侧栏/首页/会话/Composer，再推进其余产品能力。当前窗口采用用户最新截图指定的rail＋contextual，保留折叠后的图标导航、44px共享标题栏、统一内容宽度和首页Banner；不回退legacy单侧栏或页内重复宿主。

当前切片由[Composer上下文计划](codex-composer-context-suggestions-20261019.md)持有：

| 切片 | 已落地 | 当前验证与限制 |
| --- | --- | --- |
| 92 canonical Skill/inline mention | 删除installed_skill额外slash调度、宽松匹配/假Skill fallback、重复初始化状态及旧route徽标；导航解析唯一runtime Skill；默认glyph和inline-flow样式来自REA | 74套1341项、完整预检、新Renderer、标准GUI及真实rich/Sources/Plan/Goal/Skills通过；矩阵因PM textBetween漏叶节点失败。325产物与原失败已冻结，sourceDrift空 |
| 93 canonical用户消息 | 删除resolveUserMessageLabels、UserInstalledSkillMessageContent及额外sidecar徽标循环；迁移旧正向标签测试 | 根6套71项通过；独立10输入候选已通过8套102项、lint/types/contracts/i18n/治理并构建新Renderer，真实标准GUI/rich及54项观察、48张截图全通过；sourceDrift空、Main正常退出，325产物冻结。矩阵使用既有canonical DOM reader |
| 94 mention可见文档文本 | 按REA89 sJr补齐leafText，让PM普通文本读取包含displayName；canonical输入仍使用label/path/typed identity | 原真实EditorView回归已复现1失败/14通过；修复后6套112项及strict lint通过，独立新字节产品证据尚待 |

92的Goal通过真实GUI暂停后验证同一线程目标paused、首轮completed、输入框可用与stop消失；没有关闭自动续跑或放宽身份/期限。92 Skills覆盖自动、显式和工作区手动启用；受控fixture证据不等于live provider。

## 写集与并行边界

93代码写集仅ConversationTurnTimeline.tsx、MessageListUserContent.tsx及directTimeline/userCollapse两份测试；修改前与冻结92字节一致。94仅composerSchema.ts与既有ComposerEditor.test.tsx。执行计划、正文/Composer审计、结构账本和Evidence索引随切片更新。

Rust、协议/生成客户端、发布、Cloud/account及未知工作树增量只读；不覆盖、不提交、不推送、不建分支，不清空间或停止其他进程。候选从认证父候选叠加精确输入，不能复制整个脏根。固定候选、根源码、运行中的用户窗口和安装包分别结算。

## 各领域唯一owner与后续范围

| 领域 | current实现与事实源 | 尚未关闭 |
| --- | --- | --- |
| Shell/侧栏/首页 | rail＋contextual、AppShell/Header/MainContentLayout；[布局证据](artifacts/codex-shell-layout-rea-20261018/report.md)、[页头计划](codex-shared-page-header-20261018.md) | 全部内容、菜单、交互及结构命名的逐项验收 |
| Composer/草稿/附件 | 单一Controller/PM文档、typed提交、共享attachment generation、Host持久化；[排版](codex-composer-layout-20261019.md)、[Sources](codex-composer-sources-20261019.md) | 完整mention serializer/consumer、custom icon、file/plugin引用、所有来源/MCP/commands与Plugin绑定 |
| 用户正文/时间线 | canonical Thread/Turn/Item、虚拟列表、整条用户正文折叠和全文复制；[正文审计](../research/codex-desktop-rea/user-message-collapse-audit.md) | 内联引用分类/唯一目录解析/条件打开、复制回贴身份、全变体与平台证据 |
| Files/diff/右侧面/Terminal | ThreadSidePanelTabs、openWorkspaceFile、RightSurfaceHost、FileEditorController、既有diff和Terminal owner；[Unified计划](codex-unified-workspace-20261018.md)、[文件标签](codex-file-preview-tabs-20261019.md) | 完整目标发现、toolbar/context菜单、多选、后台session buffer/interruptedItemIds及平台分支 |
| 审批/Queue/线程设置 | PendingRequestItemPanel、ApprovalCard、QueuedMessageList、scoped设置authority | 自动审查及全部审批变体、durable active steer/paused/outcome-unknown、active/future Turn设置语义 |
| Side chats/Worktree/remote | 复用current App Server、scoped submission和现有workspace owner；[Worktree收据](artifacts/composer-worktree-native-20261018/handoff-receipt.json) | Side chats、完整创建/恢复/退出证据、remote/environment及错误恢复 |
| Settings/Profile | canonical sections/path、统一draft与字段保存；[公共Profile审计](artifacts/public-profile-current-audit-20261018/report.md) | 累计搜索目标/全部草稿的后继桌面验收、完整布局、远端eligibility/username/pins/upload及认证合同 |
| Office/专业文件 | 原字节预览、批注、已有Workbook/PPTX编辑owner | 见各领域计划；局部单元格/元素修改不代表完整Excel/PowerPoint，DOCX/PDF正文编辑入口证据仍不完整 |
| 输入与平台 | 当前macOS Electron/IPC及受控fixture | 原生IME、microphone/voice、auto、Windows与packaged完整矩阵；synthetic DOM事件不冒充原生输入 |

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

整体仍partial；没有完整验收分母，不编造总完成百分比。分别报告行为、结构/命名、清理和产品验证。下一步验证94最终字节，再沿正文内联引用与完整来源主链推进。

本页只保留当前状态与导航，逐轮细节由专项计划及不可变收据持有。旧历史入口：[2026-10-15](codex-gui-alignment-history-20261015.md)、[2026-10-17](codex-gui-alignment-history-20261017.md)、[2026-10-18](codex-gui-alignment-history-20261018.md)。外部清理造成的缺失证据只作历史观察，不恢复成有效通过。
