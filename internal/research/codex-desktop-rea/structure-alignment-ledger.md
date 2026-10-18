# GUI 结构与命名对齐账本

当前证据有效性以[缺失声明](validation-evidence-lifecycle-20261018.json)为准：旧`.lime/`整个目录消失，本账本旧收据/冻结结果只保留历史观察，不作为当前验收。新表格合同与测试独立补证，新原生结果须由新候选重建。

状态：current / partial。校准日期：2026-10-17。本页归并已有 REA 审计与正式实现映射，不新增参考应用运行结论，也不是全量符号清单。

参考为 Codex Desktop `26.1007.30912` / build `20156`，Bundle ID `com.openai.codex`，ASAR SHA-256 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。版本、Evidence ID、原成员摘要和锚点分别由链接的领域审计及[证据索引](evidence-index.json)持有。公开 Rust checkout 只用于共享协议/runtime；不能补出 Desktop 前端原文件名。

## 已确认名称与 current owner

2026-10-17：已确认公开导出 `PdfPreviewPanel`、`DocxPreviewPanel`、`WorkbookPanel`、`PresentationPanel`，Lime同名组件由唯一 `ArtifactRenderer -> PreviewArtifactRenderer` 与文件树消费；四种预览和位置反馈均有固定候选原生证据。共享批注唯一owner为`artifact/annotations/`，各格式持有自己的位置适配器；内部拆分名未冒称上游原名。XLSX普通单元格编辑/保存与共享flush已验收；CSV/TSV原生重验因Main正常退出尚未关闭。Presentation对象/正文编辑与导出保存、DOCX/PDF具体编辑入口、进程重启耐久性和全量类/函数映射继续开放。详见[专业文件审计](professional-files-audit.md)与[工作簿实施计划](../../exec-plans/codex-workbook-alignment.md)。

| 参考名称及证据性质                                                                | Lime current owner / 调用者                                                                                                                          | 已迁移内容与边界                                                                                                                                                                     | 待办                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QueuedMessageList`，确认公开导出                                                 | [QueuedMessageList](../../../src/components/agent/chat/components/QueuedMessageList.tsx)，Workspace queue projection / actions                       | 直接替换旧 `ThreadQueueStatus`；列表呈现与同一 App Server queue authority 分工；见[导航审计](navigation-composer-audit.md)及[Steer 审计](queue-steer-audit.md)                       | 暂停、送达未知、拖拽与完整交互须逐合同验收，不能以同名认定全部等价                                                                                                                     |
| `ComposerUtilityBar`，确认公开导出                                                | [ComposerUtilityBar](../../../src/components/agent/chat/components/Inputbar/components/ComposerUtilityBar.tsx)，Home/Inputbar 共享消费               | 项目、分支与运行位置组合；既有 workspace/Git owner 继续执行；旧项目上下文组件删除，见[导航审计](navigation-composer-audit.md)                                                        | staged worktree / remote                                                                                                                                                               |
| `ReviewThreadSidePanelTab`，确认公开导出                                          | [ReviewThreadSidePanelTab](../../../src/components/agent/chat/workspace/ReviewThreadSidePanelTab.tsx)，RightSurface → 同次 changeView → ChangesPanel | 删除 path-only surface，复用既有 diff/review/file-preview owner；映射及身份见[执行计划](../../exec-plans/codex-gui-alignment-current-plan.md)                                        | 完整 diff/editor 与视觉逐项核对                                                                                                                                                        |
| `SettingsPage`，确认公开导出                                                      | [SettingsPage](../../../src/components/settings-v2/_layout/index.tsx)，AppPageContent 唯一产品消费者                                                 | `SettingsPageV2`/`SettingsLayoutV2` 别名删除；[sections](../../../src/components/settings-v2/sections.tsx)统一登记、导航、preload/render，见[设置审计](settings-navigation-audit.md) | canonical章节/返回经既有导航owner，原生第14轮4/4通过；默认130/130批及组合验收通过；Memory配置/SOUL新原生6/6已验收，其他表单/内容搜索待交付；目录仍为 `settings-v2`，未声称目录名已对齐 |
| `VisibleSettingsCommandMenuSectionItems`、`SettingsExternalSection`，确认公开导出 | 目前没有登记为同义 owner 的 Lime 对应符号                                                                                                            | [设置审计](settings-navigation-audit.md)仅证明参考模块职责与导出，未据字符串建立空壳或 alias                                                                                         | 现有命令菜单/外部设置消费者需按实际能力映射                                                                                                                                            |
| `startNewConversation`，确认公开导出                                              | [useAppNavigation](../../../src/hooks/useAppNavigation.ts) → App/Sidebar → Workspace root navigation                                                 | 唯一动作、committed request、稳定 Home scope 与 fresh CAS；删除随机草稿事件、预热/materialized 双轨和 dead general tab owner，见[新建导航审计](new-conversation-navigation-audit.md) | 普通 Codex 侧栏的运行时 fresh 行为、完整冷草稿 picker 仍 unknown                                                                                                                       |

## 窗口与首页排版重定位（2026-10-18）

实际主Shell为app-initial，sidebar-a9ef58c0cd4b.js是ScheduledSidebar，旧主侧栏映射作废。用户最新截图指定 rail-with-contextual-sidebar，已直接替换上一轮误选的legacy。AppNavigationRail为本地职责名，采用已证36px控件/两侧8px；上下文可折叠，保留52px rail。AppSidebar和SettingsNavigation共用useSidebarWidth/SidebarResizeHandle。参考HeaderAction三槽scope/注册/排序/身份清理迁入app-shell/AppShell，侧栏开关left/order1经唯一renderer呈现，44px共享标题栏。后继已接入Header页面注册、metadata及MainContentLayout两级优先级；ThreadWorkspaceHeader迁入共享renderer，删除工作区46px页头宿主/inset及折叠补位。后继清退其重复导航、常驻状态/目录及专用派生；普通线程title/rename由同包pc/mc/ac确认存在，隐藏identity和NS非空分支仍待实际布局合同，见[补证](../../exec-plans/artifacts/codex-shared-page-header-20261018/thread-controls/report.md)。实现/验证见[共享页头计划](../../exec-plans/codex-shared-page-header-20261018.md)。完整fade/统一工作区其他槽/过渡context及原线程开发名称仍unknown；不以本地AppShellContent职责名称冒充参考原导出。

首页只保留Banner presentation与统一Composer；删除伪装为ambient建议的旧13入口、HomeAmbientSuggestionsContent、HomeSuggestionList、Guide/Drawer/Manager、专用hooks与类型，以及旧恢复卡、项目会话目录和推荐callback接线。上游存在同名export不意味着Lime在缺数据端点时应留空壳。独立Composer布局最大48rem，仅一次panel留白；编辑区136px为用户要求放大的显示选择。useWorkspaceBackgroundSessionRuntime保留侧栏所需canonical状态，删除Home恢复专用状态/导航，不建第二后端。永不显示的creation selector、无人消费的运行卡/Memory/Channels props及为其计算数据的LandingSessionRuntime均已删除，当前ConversationScene直接消费landingSurface。current ambient生产数据能力仍为gap。SettingsPage已删除双栏、多余Title和窄浮层。

当前验证、精确原件和未完成的Home内容/内部命名/账户位置差距由[本轮报告](../../exec-plans/artifacts/codex-shell-layout-rea-20261018/report.md)持有；组件测试通过不冒充实际GUI或全结构对齐。

后台恢复清退的后继验证：当前侧栏承接单会话/双会话reload，真实Gate B已通过。restart暴露RuntimeCore把历史loaded误判为执行仍存活；对照公开Codex thread_read_response_inner/set_thread_status_and_interrupt_stale_turns，以actor active Turn及现有RuntimeTurnDriverCompletions中尚未完成收敛的具体identity派生执行事实，删除仅区分actor存在的临时actor_loaded。具体pending Turn读取是Lime对既有终态投影约束的内部适配，不冒称上游原字段；不合成terminal、不改持久化或新增owner。公共JSON-RPC冷恢复回归已复现，修正及后继验收由同一布局计划/manifest持有。

普通持久化会话的后继公共turn/start另复现“界面空闲但旧Turn仍active”：ensure_current_session_hydrated直接插入raw历史状态。现改用同一SessionLoadContext已归一化的session/turns，其余StoredSession数据不变；这属于既有owner接纳状态修正，不是新增read model或恢复API。普通/fork公共4、hydration1、read13、pending recovery5及multimodal queue1共24项通过；真实GUI restart继续发送/停止27、双会话reload隔离33项通过，原Main15秒/零mock/freshness不变。标准GUI/current聚合及历史退出超时的unknown边界统一见布局报告，不把此修正冒称上游原函数结构。

## 已确认结构与方法，原类名未知

| 参考职责 / 可确认成员                                                                                                                                     | Lime current owner                                                                                                                                                                                                                   | 对齐合同与限制                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 主 Composer provider / Controller / EditorView；原类与 hook 名 unknown                                                                                    | [ComposerController](../../../src/components/input-kit/ComposerController.ts)、[ComposerEditor](../../../src/components/input-kit/ComposerEditor.tsx)、`useComposerController`，Workspace 共享给 Home/Inputbar                       | 唯一 EditorState、Transaction、revision 与 typed submission，见[主输入审计](main-composer-audit.md)。`RichTextInput`/`CodexComposerAdapter` 仅为样式或诊断名，不据此迁名              |
| registry：`createNodeView`、`getSnapshot`、`subscribe`、`unregisterNodeView`、`publishNodeViewUpdate`                                                     | [CodeBlockNodeViewRegistry](../../../src/components/input-kit/CodeBlockNodeViewRegistry.ts)                                                                                                                                          | Controller 生命周期持有，稳定 snapshot/listeners，Portal 只消费同一 registry。类名为 Lime 实现命名，方法名可按原成员核对                                                              |
| NodeView：`destroy`、`ignoreMutation`、`stopEvent`、`update`、`selectLanguage`、`getAutoDetectLanguage`、`updateCodeElement`、`focusEditor`、`getContent` | [CodeBlockNodeView](../../../src/components/input-kit/CodeBlockNodeView.ts)、[CodeBlockToolbar](../../../src/components/input-kit/CodeBlockToolbar.tsx)                                                                              | 保留 PM contentDOM，toolbar 与正文事件分工、语言事务保 attrs/selection；见[NodeView 审计](composer-code-nodeview-audit.md)。类名与 React 组件名不是已恢复的上游原名                   |
| highlight / Auto detection 两个 PM plugin；原开发名称 unknown                                                                                             | [composerCodeBlockHighlight](../../../src/components/input-kit/composerCodeBlockHighlight.ts)、[composerCodeBlockAutoDetect](../../../src/components/input-kit/composerCodeBlockAutoDetect.ts)，同一 Controller/View 下的独立 plugin | 位置/节点 cache、UTF16 Decoration、异步失效与销毁保护；见[高亮审计](composer-code-highlight-audit.md)，不能把 NodeView CSS class 当作高亮实现                                         |
| retained/prompt documents → renderer persisted atom → Main file store；原类名 unknown                                                                     | [ComposerDraftCoordinator](../../../src/components/input-kit/ComposerDraftCoordinator.ts) → `persistedAtomHost` / `persistedAtomStore` / `persistedAtomFile`                                                                         | 唯一 keyed 草稿 owner，Home/local promotion、CAS、scope/generation/revision/token 与正常退出；见[保存审计](composer-draft-persistence-audit.md)。不搬压缩类名，不建第二 history store |
| `thread-virtualizer` / `virtualized-turn-list` 是包模块名，公开符号多为压缩 alias                                                                         | [threadVirtualizer](../../../src/components/agent/chat/projection/threadVirtualizer.ts)、[VirtualizedTurnList](../../../src/components/agent/chat/components/VirtualizedTurnList.tsx)                                                | 纯几何与 React 消费分工；canonical paging 与 viewport DOM range 分离。删除旧渐进尾窗/全量展开，不声称原目录或类名已恢复                                                               |
| pending request card / panel 组合；完整原命名未在本账本确认                                                                                               | [PendingRequestItemPanel](../../../src/components/agent/chat/components/PendingRequestItemPanel.tsx) → [ApprovalCard](../../../src/components/agent/chat/components/ApprovalCard.tsx)                                                | same server request/decision authority，替换单行审批提示；实现与验证见[执行计划](../../exec-plans/codex-gui-alignment-current-plan.md)，不由组件形状推断所有自动审查变体已完成        |
| browser/artifact/terminal/subagent 右侧 surface 组合；完整原目录和 registry 名 unknown                                                                    | [RightSurfaceHost](../../../src/components/agent/chat/workspace/right-surface/RightSurfaceHost.tsx)、既有 registry、BrowserTabHost                                                                                                   | 单一 host/scoped display state，既有原生 owner；Browser 生命周期已有相应 Gate，不能扩大到全部 surface                                                                                 |

设置未保存保护补充映射：参考 `settings-page` 的 requestNavigation / pendingNavigation 数据流 → [useAppNavigation](../../../src/hooks/useAppNavigation.ts) 唯一导航 owner；参考 `settings-unsaved-changes-dialog` 的继续编辑/放弃 → [SettingsUnsavedChangesDialog](../../../src/components/settings-v2/_layout/SettingsUnsavedChangesDialog.tsx)。对话框名称按成员职责命名，不声称恢复了原开发符号；外部 registry 原类型仍 unknown。Memory 在 [useMemorySettingsDraft](../../../src/components/settings-v2/general/memory/useMemorySettingsDraft.ts) 保有 draft/snapshot/保存，规范化迁至 [memoryConfig](../../../src/components/settings-v2/general/memory/memoryConfig.ts)，页面内联副本直接删除；[useSettingsDraft](../../../src/components/settings-v2/_layout/useSettingsDraft.ts) 只报告 dirty/saving。配置/SOUL首批 owner 的原生6/6与组合验收已通过。页内笔记已拆至 [MemoryNoteEditor](../../../src/components/settings-v2/general/memory/MemoryNoteEditor.tsx)，同步迁输入版本/保存锁、独立登记与局部页签挂载，删除内联副本；新20项、定向126/126、标准verify:local整轮exit0及原生第5轮笔记6/6通过，收据见 `.lime/qc/settings-note/final-20261015-1/receipt.json`。不冒充上游同名符号或完整设置保护。

Web Search 沿用同一导航合同，草稿与保存归 [useWebSearchDraft](../../../src/components/settings-v2/system/web-search/useWebSearchDraft.ts)，配置投影/字段合并归 [webSearchConfig](../../../src/components/settings-v2/system/web-search/webSearchConfig.ts)。四个局部页签只消费同一草稿，原巨型页面的整份Config快照、保存和定时器副本已删除；保存经既有串行updateConfig合并最新配置，只修改用户编辑的字段，保留其他owner和未编辑引擎。定向5 suite 80/80、严格lint/typecheck、默认verify:local整轮exit0（130批/1764文件、contracts、标准GUI24/24）及原生首轮Web Search 6/6通过；849 IPC，57源码/3145产物/sidecar零漂移，Main正常退出。收据`.lime/qc/settings-web-search/final-20261016-1/receipt.json`；不能推广为全部设置或live搜索。以上新职责名没有同名上游符号证据。

Environment 同样沿用 REA requestNavigation/pendingNavigation 合同，编辑/保存归 [useEnvironmentSettingsDraft](../../../src/components/settings-v2/system/environment/useEnvironmentSettingsDraft.ts)，纯投影/字段合并归 [environmentConfig](../../../src/components/settings-v2/system/environment/environmentConfig.ts)，预览遮罩归 [EnvironmentPreviewPanel](../../../src/components/settings-v2/system/environment/EnvironmentPreviewPanel.tsx)，展示原语归 [EnvironmentFields](../../../src/components/settings-v2/system/environment/EnvironmentFields.tsx)。删除原页面整份Config、内联保存/重读和随变量名称改变的React key；开关/超时各自合并、变量列表保持原子字段，迟到响应不能清除新编辑。命名为Lime职责名，原始表单符号仍unknown。最终定向4suite51/51、默认前置/前端续跑131批/contracts/标准GUI24项组合与原生第5轮通过。可见四路导航加保存读回5/5、主题投影4/4；New仅组件证据（设置壳卸载AppSidebar）。原生四轮失败与QC清理事实保留；收据`.lime/qc/settings-environment/final-20261016-3/receipt.json`。原符号、全皮肤/Windows与完整GUI仍未验。

以上命名 unknown 不妨碍对齐已观察的职责、调用关系和数据合同；获得新可确认导出或 source map 后再直接迁移调用者。不要以压缩局部名、chunk hash、概念同义或同名文件数量推导源码等价。

## 仍需映射或实现的范围

- 设置导航/返回的四项真实合同与默认130/130批组合验收已通过；Memory配置/SOUL、独立笔记和Web Search纵向合同已分别通过原生验收，其余内容target与其他表单仍待交付。不能复制未知registry、隐藏功能或建立第二history。
- 完整 thread shell/header/overflow 与命令菜单消费；现有各局部审计不是全包清单。
- Office/PDF 的真实排版、批注与版本 owner；见[专业文件审计](professional-files-audit.md)。目前文本抽取不能替代排版预览。
- 原生应用工具、授权/执行/反馈，以及环境连接/remote 的产品入口；共享 App Server 边界继续有效，不能另造 runtime。
- 目录、函数、类型、类与所有调用者的完整可追溯覆盖。当前分母未完整枚举，不给出全产品命名或结构百分比。

current 为表中的既有 owner；compat 只保留设置 `Experimental → Developer` 的现存委托；未完成能力按 gap/unknown 登记。已替换的别名、随机 general 草稿 owner 和旧组件属于 dead/deleted，禁止为旧测试恢复。单个切片的行为、结构、清理和进程验证分别由执行计划记录。

Lime 保留主题、多模型与首页 Banner，分别走原 token/skin、catalog/provider 和 Home presentation；三项均不扩展为布局、导航或状态机的额外保留例外。

Execution Policy沿用同一导航合同；[useExecutionPolicyDraft](../../../src/components/settings-v2/system/execution-policy/useExecutionPolicyDraft.ts)拥有编辑生命周期，[executionPolicyConfig](../../../src/components/settings-v2/system/execution-policy/executionPolicyConfig.ts)负责可编辑投影/字段合并，[ExecutionPolicyFields](../../../src/components/settings-v2/system/execution-policy/ExecutionPolicyFields.tsx)与[PolicySourceLayerPanel](../../../src/components/settings-v2/system/execution-policy/PolicySourceLayerPanel.tsx)分别编辑/展示。原1215行页面缩为420行，fullConfig/完整agent副本、内联保存/重载和固定浅色样式已删除；统一useSettingsDraft/updateConfig，新增compat/deprecated为0。新名字仅表达职责，参考表单原符号unknown。最终定向5suite51/51、证据护栏9/9、默认前置/续跑131批/contracts/标准GUI24项组合及两组真实Electron通过；原wrapper超时exit1保留。导航可见合同5/5、四主题4/4、规则CRUD与完整配置保持；冷启动32/32含失败保稿/Save重试及三次正常Main退出。旧原始错误、dirty Reload丢稿、IPC成功冒充写入成功及空Host统计fixture同步删除，收据`.lime/qc/settings-execution-policy/final-20261016-1/receipt.json`。New/诊断定位为组件证据；全皮肤/工具执行/live/Windows/参考实时仍未验，整体GUI partial。

历史草稿切片：ProfileSettings公开导出已由匹配安装包确认，Lime `account/profile/index.tsx`同名，但目前是本地配置编辑，语义等价仍partial。内部新useProfileDraft/profileConfig/ProfileFieldCard/ProfileSummary是职责名，不声称恢复上游符号。页面892→381行；完整Config快照、全profile覆盖、提前清稿、timer/原始错误、无实现头像上传及8键/旧正向测试删除，复用唯一updateConfig与useSettingsDraft/useAppNavigation，compat/deprecated新增0。定向4suite56/56、翻译2suite11/11、默认verify:local整轮exit0（131批1770文件）、contracts与标准GUI24/24通过；真实导航9/9、四主题4/4另列、冷启动第2轮32/32与三次正常Main退出通过。fixture的旧方法名比较/退出字段组装同步迁移，首轮失败原件保留。收据`.lime/qc/settings-profile/final-20261016-1/receipt.json`只关闭草稿安全合同。

参考ProfileSettings经feature flags/loading委托共享core/Layout，单一data-profile-scroll，displayName/bio与公共username/pins/identity并非Lime本地Tag/完成度/email卡片。字段与布局已先行迁移；公共数据入口与可见性继续登记gap；只保留主题、多模型、首页Banner，不新增第四项例外。core REA语义partial/truncated，内部原名与参考实时仍unknown，不为猜测建立alias、空ProfilePage/CME或平行账号后端。

Profile数据追踪新增：core source-module view `ev_e0a17e7831cc4351f87bf767347b9893a83db7de0859017b3f6dca92c54731fb`与5个精确依赖定义的REA parent `ev_87b1f8de96c9b10e16b7303b0c59c6cac67506416c13e29c22a9dde803e5bbef`连接账号query identity、GET profile page、V2 PATCH资料与is_self缓存更新。Fyt/xyt等为压缩alias，不恢复成业务原名。Lime本地Config与OEM session目前没有同义profile page/bio/pins mutation合同；本地字段/布局已替换，公共内容可见性待办，不用config/read或同名ProfileSettings消除语义gap。具体范围及字节摘要见[设置审计](settings-navigation-audit.md)。

当前本地字段内容切片（已验收）：ProfileSettings保留确认的公开名并委托ProfileContent/ProfileLayout/ProfileFieldEditor；useProfileDraft/profileConfig继续为既有草稿/纯映射owner。新内部名称仅表达职责。displayName→nickname映射显式，bio归一化、64/140、名称非空trim均已接实际DOM和保存入口。旧ProfileFieldCard/ProfileSummary/profilePresentation、Tag/完成度/头像/email/用途卡、TS/Rust退役字段和对应旧测试/翻译/原生选择器删除。新增compat/deprecated为0；远端身份/eligibility/pins/upload仍partial。恢复后定向67/67、Rust配置129/129、contracts/typecheck/strict lint、新GUI24/24、最终1.159原生导航9/9与冷启动32/32、四主题4/4通过。全量前端131批和workspace7121通过曾被观察，原始日志被外部删除，只列历史；独立旧收据已恢复。新收据与限制见current计划，不覆盖历史冻结件。

2026-10-17 入口隔离（已验收）：settingsSections 使用既有 OEM runtime 条件互斥预加载/渲染 UserCenterSessionSettings 与本地 ProfileSettings，删除本地页不可用账户卡和双挂载断言，不新增 wrapper、flag 或认证 owner。五语言 5 红例后定向 7suite107/107、typecheck/lint/format 通过。REA eligibility source-module view `ev_d842243733886bd9ced33ce5cf6ea8094fd0b7ada2ed54fa4f16aba9a8a10fdf` 仅为静态身份补证；Lime runtime 条件不等价于参考公共 eligibility，OEM 内容、远端合同和完整 GUI 仍 partial。本地入口9次/原导航9项/四主题均通过真实Electron，OEM分支仅组件证据；最终收据`.lime/qc/settings-profile/entry-final-20261017-1/receipt.json`。原生第1轮保留exit1：启动前Cargo metadata等待自行恢复，未中断进程或修改期限；场景完成后，最终freshness守卫因并行协议源码及生成产物变化拒绝验收。第2轮按标准入口更新构建，并通过已有APP_SERVER_BIN接口显式选择已校验manifest/SHA的sidecar；不放宽守卫、不改生产helper、不覆盖失败证据。

本地字段切片原生结算：导航 `settings-profile-content-native-20261016-1` exit0、9/9，四主题4/4另列，732px/嵌套滚动0/溢出0；1634 IPC、错误/mock0，Main39961正常退出。冷启动 `settings-profile-content-cold-20261016-1` exit0、32/32，98 IPC、错误/mock0，三次Main正常退出与完整配置恢复通过。七张截图人工复核。25声明源码/83原生源码/321产物后验无漂移；Rust实际编译配置129/129（新退役字段回归在内），默认门禁尚在运行。单独的账号session卡、远端公共身份/可见性仍partial。

设置内容搜索的公开文档导出`settingsSearchDocuments`已由REA source-module view `ev_34efb5366f4d9b0617273007cb751bc8764c71383e46d983b157745ce735b1a0`确认；索引结构与内部压缩函数分开处理，不引入5234条参考消息或50组隐藏功能。Lime首批9个内容目标和15个current章节标题已进入单一搜索owner，静态证据与实施合同见current计划；原生验收另记，不扩大为完整设置搜索。

设置搜索实施映射：公开`settingsSearchDocuments` → [settingsSearchDocuments](../../../src/components/settings-v2/settingsSearchDocuments.ts)；翻译匹配 → [searchSettings](../../../src/components/settings-v2/settingsSearch.ts)；输入/键盘 → [SettingsSearch](../../../src/components/settings-v2/_layout/SettingsSearch.tsx)；已提交目标 → [useSettingsSearchTarget](../../../src/components/settings-v2/_layout/useSettingsSearchTarget.ts)。后三者是Lime职责名，参考内部函数压缩名仍unknown。唯一settingsSections派生标题，本地Profile2/Environment3/ExecutionPolicy4静态目标共9项；OEM不索引本地资料，旧侧栏内联过滤/搜索样式直接替换，无第二history、dirty或业务authority。requestKey只属于Renderer定位，确认放弃后重建内容子树；静态target替代参考scrollText文本扫描是Lime实现选择，非原算法逐字等价。16suite198/198与后续验证见current计划，首批9项已通过隔离快照真实Electron验收，完整内容覆盖仍partial。

搜索最终结算：9/9稳定目标、四主题4/4、说明/重复、桌面和600px窄屏草稿/焦点通过；原生第5轮exit0、1740IPC、错误/mock0，91源/1161产物/sidecar零漂移、Main正常退出。前四轮失败均保留（视觉token1次、并行freshness3次）；最终验收绑定独立验证快照，本轮18份源SHA与原工作树一致，不声明最新并行runtime通过。定向198/198+最终搜索27/27、typecheck/lint与标准GUI24/24通过；全仓file-size既有失败及默认整轮未跑分别记录。收据`.lime/qc/settings-content-search/final-20261017-1/receipt.json`；只完成此切片100%，整体GUI partial。

联网搜索15目标扩展（已验收）：沿同一settingsSearchDocuments增加path，getSettingsSearchDocument白名单解析→SettingsPage→唯一settingsSections→WebSearchSettings.initialTab→原Tabs与FieldBlock→原useSettingsSearchTarget。getSettingsSearchDocument/initialTab是Lime职责名；参考只有settingsSearchDocuments公开名及path/scrollText职责已确认。不存在新路由/历史/草稿/配置owner；待确认搜索不切内部页签，放弃后依原requestKey重建。固定search默认入口直接替换，compat/deprecated新增0。定向8suite133/133、完整typecheck/lint/脚本/参考/docs边界通过；同一隔离组合标准24/24、原生累计24/24（新增15/15、4页签）、主题4/4及600px窄屏通过。1683IPC、错误/mock0，91源/1376产物/sidecar零漂移、Main正常退出。本批10份覆盖源码与原工作树相同，11张截图人工复核；快照准备失败与原工作树V8缓存缺失导致的wrapper exit1均保留，缓存已由现有脚本恢复并校验，未声称最新并行Rust/default通过。收据`.lime/qc/settings-content-search/web-search-final-20261017-1/receipt.json`只关闭本批100%，整体设置/GUI仍partial。
Memory / Appearance搜索结构（2026-10-17，已验收）：沿原静态索引/path/sections/canonical requestKey链新增7+5目标，累计36。MemorySettings → SoulSettingsPanel / AdvancedMemorySettings，页面保留导入文本/预览和useMemorySettingsDraft，MemoryStoreStatusPanel保持挂载；AppearanceSettings → AppearanceSettingsView，原appearance与Config owner不变，语言选项复用同一LanguageOption。新组件/类型名仅为Lime职责名，上游原名unknown。旧过长内联展示、重复ResponseLanguageOption与Memory固定memory初始入口直接替换；无compat/deprecated、第二草稿或路由authority。入口871→566与993→418行，其余新展示最大681行。8suite105/105与strict lint通过；进程/产品证据结算另记，不能将本批搜索或拆分等同于整页/整体GUI完成。参考主题差异仍由原skin owner保留，多模型与首页Banner未受影响。

本批最终验收：原生36/36累计、12/12新增目标与Memory3页签、四主题/窄屏/导入草稿保护均通过，标准24/24、定向105/105、证据护栏8/8、typecheck/lint和相关边界通过。1757IPC、错误/mock0、同一canonical identity/turnStart=1，Main正常退出；95源/1481产物/sidecar无漂移，10覆盖源与原工作树SHA相同，10张截图复核。完整默认/最新并行Rust未重跑；整页布局/业务及内部上游原名仍partial。辅助命令失败原件与最终成功记录分别保留；新双份收据`.lime/qc/settings-content-search/memory-appearance-final-20261017-1/receipt.json`不覆盖旧冻结证据。

专业文件当前映射（2026-10-17）：REA 确认的 `PdfPreviewPanel` / `DocxPreviewPanel` → 同一 `artifact/document/` current 组件；`previewArtifact -> PreviewArtifactRenderer` 统一格式分发，文件树与会话 artifact 共用，原字节仅走既有 `readFileBytes -> fs/readFile`。PDF 页面、文字选区、截图与 DOCX 版式、位置分别适配，共用 `ArtifactAnnotationDraftStore` / `ArtifactAnnotationCommentEditor` / `documentAnnotation`、`useDocumentAnnotations` / `ArtifactAnnotations`。PDF 旧共享路径/导出已直接迁移，无 alias。公开组件名来自安装包；内部名为 Lime 职责名，参考压缩符号与原 npm 版本仍 unknown。

DOCX 单条第13轮、跨两页批量第4轮已独立原生通过；来源 Turn 来自 canonical thread_turns，typed start/queue settlement 仍为唯一提交 owner。`artifactAnnotationSubmission` 为浮层和 `ArtifactAnnotationComposerAccessory` 共用批量捕获/发送/revision-safe cleanup。fixture 从父文档读取 iframe DOM，以 CDP Input 操作真实鼠标，sandbox 未开放脚本。Main 正常退出、零错误/mock/freshness 与摘要稳定仅绑定候选1.159.0，不代表根1.160.0并行后端。

主 Composer 回原文的旧文本构造、`document_pages` 误选 Canvas 的两处逻辑及旧正向 selection 断言已替换；现统一 `openFilePreviewArtifact -> openArtifactInWorkbench`。回跳第2轮 DOCX/第1轮 PDF 正确打开 ready 面板但丢失编辑卡，已改为等待读取完成再发布聚焦，导航/卸载/后续请求使旧请求失效，最新原生仍待验收。新增 compat/deprecated 为0；文本 Canvas 仍服务文本，不整文件误删。Store 仍为内存；跨 Workspace/进程耐久性、幻灯片、Office 原文件编辑保存和 Workbook 范围反馈为 gap。WorkbookPanel 已按公开导出实现只读 XLSX/CSV/TSV，同一 gateway 的 Worker 原字节解析、snapshot、虚拟网格、页签/A1/键盘与缓存公式；70项定向通过，原生产品验收中。内部类/函数仍为 Lime 职责名，不将压缩符号猜测成原名。

主 Composer 最新合同：DOCX 第5轮和标准 wrapper5 的24项通过；PDF 第5轮原合同通过后，人工截图发现实际视口仍在第1页。最终导航请求延迟至页面总高度 DOM 提交后滚动，原生新增页码/编辑卡/实际页顶部几何联合检查，尚不声明最终定位通过。专业时间线旧二进制提前拒绝入口已统一委托原文件打开，与 PDF 导航23项定向通过。旧失败/较弱合同成功保留于 composer-review-20261017-1 收据；没有过滤错误、改期限或删失败断言。

2026-10-17 范围反馈接续：PDF 原生第7轮真实视口几何及人工截图通过；工作表只读第7轮完整通过并人工复核原字节网格、样式及 canonical 文件变更打开。artifact/write 的公开投影为 fileChange；fixture 改为真实变更入口并严格保留原 item、只增加本次唯一 event item，不制造 read marker。Main 均正常退出，失败轮次保留。

新增工作表范围反馈已使用 sheetName/sheetId/address、sourceFormat 与源 SHA；范围输入、Shift/拖选和原工作表定位复用同一 WorkbookPanel。共享草稿/编辑卡/Composer accessory/批次 settlement 已直接迁移至 `artifact/annotations/`，页面坐标保留为 document 适配器，无兼容别名。18 suite / 176 定向项、完整类型与 strict lint 通过；共享最终原生、标准 wrapper 和默认门禁仍待结算。REA asset item `ev_7c1eedad628984e0df7802a217280a8697af1f32afcd8352a29c71892d4f8890` 只绑定原成员摘要；addCommentThread 与导航范围语义来自同摘要原字节有界阅读，不冒称完整静态分析或参考运行。Office 编辑保存/roundtrip、幻灯片、重启耐久性及整体 GUI 继续开放。


专业文件最新结算：导入6、Workbook7、PDF9、DOCX7完整原生与标准wrapper24/24通过，绑定94源/1688产物无漂移；收据`import-source-path-final-20261017-1`只关闭源路径、分发及共享批注回归。旧“最终共享原生待验”属历史状态。canonical reader保留原path/move_path，显示裁剪不再污染操作identity；无用document_text分支直接删除，未新增compat/deprecated。

应用scope批注接续：`artifactAnnotationDraftsAtom -> ArtifactAnnotationDraftStore -> ComposerController`复用既有Jotai应用Store，Workspace卸载不重建正文/位置/pending；submit仍由Workspace委托原typed acceptance，跨会话过滤和revision-safe结算不变。上游只确认app-shared scoped signal与jX导出，Lime atom/类名为职责名，不冒称压缩符号的原名。4项红后61项绿、实际Composer隔离33项通过；新原生与wrapper待独立结算。进程重启、Slides、Office编辑保存及整体GUI继续开放。


应用 scope 批注已独立冻结：标准 wrapper24/24，Workbook 原生第8轮真实设置导航卸载原 Workspace（原 Composer DOM isConnected=false），返回后两条正文、位置、源文件变化错误及主草稿保留；显式重定位后整批仅新增1个Turn。Main code0/signalnull、forcedCleanup null、console/page错误0、freshness前后ready，94源/1688产物无漂移。收据 `.lime/qc/professional-files/annotation-scope-final-20261017-1/receipt.json`，SHA `f40cbab2cbaf82af4696797e4dc5d89c48e8173725c4aa452bb723b7f779b5a4`，设置返回截图已人工复核。该收据不包含后续 Slides 变更；进程重启耐久性仍 unknown。


Slides最终验收（2026-10-17）：PresentationPanel、源slideId/点位置与跨slide反馈已沿统一artifact/annotations/Composer实现。Slides4、导入9、DOCX10、PDF12、Workbook11五原生及wrapper3的24/24通过；106声明源/2133 regular产物零漂移（更正此前2022）、错误0、Main正常退出、freshness前后ready。双份收据 .lime/qc/professional-files/presentation-final-20261017-1/receipt.json，SHA b58c5f2371fd49bd338e1a8fb028d4eea8697a43370e20dd8169aa41e57197f3。失败及人工发现的旧toast均保留并修复，完整说明见专业文件计划末节。旧不完整PPTX构造器、DOCX共享驱动名和PPTX系统打开正向分发已替换，无compat/deprecated新增。候选后端1.159.0，根1.160.0默认9因并行Cloud生成类型缺account而失败；不声明最新根通过。Office编辑/flush/save/冲突/roundtrip、其余GUI/符号和平台证据仍开放。


## Workbook 原文件编辑与保存接续（2026-10-17）

复用工作簿 REA parent `ev_e43b4b7ce0e35465a48ce864b3da1b7c8d892cb8955c0fc33431e3d2195215dd` 与实现摘要 `fff4db5c2d594b7bcaec3569f6ab335d2fd0b982a891109c5a053210ef30a6e9`；新保留原字节上下文确认 `openCellEditor`、`commitCellEdit`、`cancelCellEdit`、`updateFormulaInput`、`setActiveSheetName`、`setSelectionRect`。`WorkbookController`、原包编辑 helper 与内存 registry 是 Lime 职责名，不将压缩类名 unknown 改写成已恢复。参考 CRDT 的 `flushCrdtUpdates` 不冒名套用到本地 XLSX 包保存。

current 链为 Grid/公式栏→应用 scope Controller→flushEdits→原文件两次SHA核验→原包定点修改/统一CSV词法→既有 `writeFileBytes / fs/writeFile`。Workspace批注先验证结构，再flush文件，再核原批注SHA，旧版本需显式重新定位。删除重复CSV parser、只读文案及sheetIndex authority，compat/deprecated新增0。XLSX非目标payload保留、公式缓存清理/外部重算；受保护表和分组公式保存明确失败，不声明完整Excel编辑、CAS或重启耐久性。

定向7suite91项和末次原包/词法/Controller24项通过；完整Renderer/Node类型、strict lint与命令合同通过。根1.160.0完整标准wrapper `standalone-shell-01-20261017133528-59598` 24/24通过，console/page/trace/mock错误0。8591份wrapper前声明源中锁文件和两份fixture有变化，原前后清单保留，不能报告该前置集合零漂移。独立持久候选 `.lime/validation/workbook-edit-1.160.0-20261017-1` 复制时8660声明源/1899regular产物与根逐份核验无差异、freshness ready；真实原生编辑/保存/冲突/flush/范围反馈正在该候选运行，尚未验收。根默认门禁另行运行，不扩大旧1.159.0只读收据。


### 工作簿编辑结构与命名结算

| 参考确认项 | Lime current owner | 行为与清理 |
| --- | --- | --- |
| openCellEditor / commitCellEdit / cancelCellEdit / updateFormulaInput | WorkbookController | 同一编辑文档、IME/提交/取消、应用scope恢复；原压缩类名unknown |
| setActiveSheetName / setSelectionRect | WorkbookController / WorkbookGrid | 迁移重复sheetIndex authority，重开保留文件选区；旧A1重置测试直接迁移并隔离Jotai scope |
| 通用flushEdits / flushPublicFile gate | Controller / Workspace提交owner / 原fileBrowser gateway | 原包保存、两次SHA检查、失败保稿、旧批注重新定位；无CRDT同名伪装，无新增协议/业务后端 |
| CSV/TSV读取与写回 | delimitedWorkbook | 删除重复parser；原词法/编码/换行单一owner |

Current新增上述职责，compat/deprecated新增0；dead/deleted为重复parser、只读文案和重复页签authority。固定1.160.0候选XLSX与三格式共享原生回归、标准24/24已冻结，收据 `.lime/qc/professional-files/workbook-edit-final-20261017-2/receipt.json`（SHA `176685cd012fb03445b17a66d3506030950f1002ca0745d3917989ace05860e7`）。候选应用scope内存不证明重启持久化或完整Excel编辑。根并行Plugin变化/默认门禁及CSV/TSV原生接续见[工作簿计划](../../exec-plans/codex-workbook-alignment.md)。

## Presentation 本地编辑结构与命名（2026-10-17，原生验证中）

| 参考可确认符号/合同 | Lime current owner | 结构与语义边界 |
| --- | --- | --- |
| PresentationPanel / source slideId、elementId | PresentationPanel / PresentationSlideView | 沿原文件预览owner扩展，无第二个编辑页面或runtime |
| setSelectedSlideIdx、setSelectedElementId、setEditingEnabled、textActivateBlockEnd、textHandleInput/CompositionEnd | PresentationController | 应用scope唯一稿件/选区；原始类名unknown，Lime类名为职责名 |
| nudgeSelectedElements、updateSelectedElementFrame/Style、deleteSelectedElement、undo/redo | 同一Controller与受限iframe父文档overlay | 顶层对象原ID、原尺寸坐标；方向键重绘保焦点、IME取消不落盘 |
| 本地编辑导出→500ms串行保存、ETag/ifMatch | presentationPackage + 既有fs/readFile/fs/writeFile | 第一切片为原包定点修改/手动保存/两次SHA检查，不能冒称Walnut导出、CRDT或原子CAS等价 |
| 批注前flush / 保存后文件版本校验 | useWorkspaceArtifactCommentSubmission | 复用current文件网关与typed start/queue；旧SHA拒绝、明确重定位后再发送 |

旧只读限定与缺写入网关的测试fixture随实现迁移；新增compat/deprecated为0。包编辑66、Controller8、Panel9、Workspace提交38项分别通过；原生编辑/冲突/应用scope保稿与flush待候选最终收据，不能引用旧只读PPTX收据冒充。完整分组/表格文字、幻灯片增删排序、自动保存/关闭flush、CRDT和平台证据仍gap。原caller来源、40段有界上下文及unknown见[审计](professional-files-audit.md)，唯一实施状态见[Presentation计划](../../exec-plans/codex-presentation-alignment.md)。

后续current接线：addSlide / duplicateSelectedSlide / moveSlide / deleteSlide已沿同一Controller落地，有序`presentationEdits`统一对象与页结构的undo/redo/保存；原包结构codec94/94、Controller13/13。真实layoutId使用本地OPC路径，不冒称上游proto identity。500ms自动保存timer委托同一flush，活动文字/IME不自动commit、失败不轮询重试，hook3/3。真实指针修复使用screen坐标避免工具栏移动iframe产生假拖动，Panel10/10；候选wrapper4与基础编辑原生继续验收。Toolbar原始字节下载/系统打开前flush由`usePublicFileAction`委托现有Controller，删除复制的文件名/Blob算法；33项worker定向通过，新Workbench导航与新候选证据仍待结算。以上名称只对REA确认的公开方法作上游映射，新helper为Lime职责名；不将本段实现写成完整Desktop完成。


### 表格单元格接线（2026-10-18）

确认的公开`tableEditing.{subscribe,getSnapshot,interact,edit}`沿同一PresentationController实现；单元格选区与对象选区分开，文字、基础样式、clear-cells仍按原序进入同一`presentationEdits`和原包codec。逻辑row/column为Lime OPC适配，未冒名cellId。`presentationTableSelection`与`usePresentationTableOverlay`是职责名；受限iframe只由父文档安装控件/监听器，不执行文件脚本。基础cell新候选1已通过集成59项、types/contracts/标准GUI及原生table1、结构导航批注2；11210源/382产物零漂移，IPC70/175、错误/mock0、两个Main正常退出。新收据`presentation-table-final-20261018-1/receipt.json`的SHA为`2ff9a27cec2c30878fd90b6caa43d2b28a4a8e21e94d9f1b9efddd6736d3e681`；旧原件仍missing。

原包结构延伸以`presentationTableGrid`共用矩阵，`presentationTableStructurePackage`实现五种insert/delete/resize动作；纯`presentationTableInteraction`只返回导航/追加意图，末格Tab复用同一历史追加，numeric选区clamp。控件按已绑定panel-structure-menu改为Portal菜单，保留键盘打开/Escape回焦与禁删尽轨；不是上游内部原类名恢复。新结构codec47、既有cell46、Controller14与overlay9通过；独立11219源候选2已通过292项集成、types/contracts、标准GUI与13阶段native；605产物零漂移、IPC124、Main正常退出，收据 `presentation-table-structure-final-20261018-1/receipt.json` SHA `a84586f7cd192f202653592da5c04fa1ee6d4bb5b3cc52fb363926e928211d34`，不扩大候选1。高级8动作和track接线另建验收。 整格rich text、其余表格动作、group及完整GUI仍开放，新增compat/deprecated为0。


### 表格格式、对象集合与canonical文本接续（2026-10-18）

高级表格已由候选3独立冻结26阶段原生验收。custom格式及theme覆盖由候选4冻结16阶段、124 IPC、源码/产物零漂移，收据 `presentation-table-format-final-20261018-1/receipt.json` SHA `dc1ff140edcff54136ae5136cc20ffe68ca27c7ef6620b1b028777a87c03788b`。`presentationTableStyle`/`presentationTableTheme`/`presentationTableBuiltinStyle`继续同一原包与派生renderer职责，不保存renderer fallback定义到文件。device pixel量化由真实Electron证明，声明与显示宽度独立核验，旧失败保持可追溯。

对象状态直接使用已确认的`selectedElementIds`/`primarySelectedElementId`，删除单选state alias；交互预览/提交归`presentationElementController`，原始spTree层级修改归`presentationPackage`。Lime职责型模块名不冒称压缩前类名；SAT框选是明确本地策略，group/ungroup producer保持unknown。候选5独立绑定对象/builtin冻结字节，790项、types/contracts与标准GUI已通过，原生交互仍待终态。

文本方法保留`textActivateBlockEnd`、`textHandleInput`、`textHandleCompositionEnd`并由唯一Controller委托文本协调模块；canonical范围为block/para/run/char，`presentationTextDocument`只登记原始XML/关系，`presentationTextRange`/`Selection`/`Style`/`Html`负责转换，`presentationTextEditor`只处理受限iframe的父DOM事件。旧textarea生产入口已替换，8份原生场景及组件测试迁current DOM，返回字段改为activeTextEditor，旧名字仅留负向回流检查或历史证据。草稿undo/redo与提交后的全局历史分层，但最终只提交同一text action/原包事务；新公开内部类型按职责命名，未声称恢复参考原类名。富文本仍待独立candidate Gate B与最终根门禁。


### 设置草稿与Queue拖拽（2026-10-18，renderer已实现）

MCP `useMcpPageEditorState`、Experimental `useExperimentalSettingsState`、Media `useMediaServicesDraft` 均委托同一 `useSettingsDraft -> SettingsDraftContext -> useAppNavigation`，保留唯一字段草稿与既有配置/CRUD gateway。内部server/tab切换不绕过保护；dirty原始输入、同步在途锁、失败保稿与卸载迟到分别定向验证44/35/37项。Experimental折叠非编辑搜索锚点补充后36项通过，不自动展开凭证。上述hook名为Lime职责名，参考内部表单符号unknown；原页面重复状态/保存与不受控timer直接替换，不新增兼容层、store、协议或业务authority。

Queue公开`onDragEnd`行为由原生handle/drop接入现`QueuedMessageList`；按ID变换`queuedMessageReorder`为Lime职责名。按钮/方向键/拖拽统一进入`runAction -> reorderThreadQueue`并重读canonical投影；实例/thread/完整ID序/数组引用/mutation epoch校验，取消/失效/失败不本地假提交。65项局部回归、窄类型/lint/format通过；不扩active Steer或durable handoff语义。收据见Evidence索引。三个设置与Queue的真实Electron证据仍待候选，整体GUI继续partial。


候选5最终冻结（2026-10-18）：11289份声明源/1384份regular产物及prepared sidecar终态零漂移；35套790项、焦点56项、helper18项、types/contracts/标准GUI通过。builtin9的14阶段/118 IPC与objects3的17阶段/90 IPC均错误/mock0、Main正常code0/signalnull、无强制清理，两张重开截图已人工复核。双份收据 `.lime/qc/professional-files/presentation-elements-final-20261018-1/receipt.json` SHA `b814cf3479dd6e6e3ba1db70a91d002358082e707b07a5c6d7486636dd05ebb0`。旧失败全部保留，builtin7退出超时未定位原因，不据新通过声称修复；富文本及后继字节不属于本冻结候选。


Developer/Media静态内容搜索（2026-10-18，renderer已实现）：原`settingsSearchDocuments`由36扩为47目标，Developer仅静态折叠组外壳，Media9常驻卡与图片数10目标；同一白名单/path/sections/定位requestKey，无新路由或索引authority。原字符串、配置值与凭证不索引，不自动打开或聚焦秘密输入。139项局部回归含五语言55次真实lazy页面定位与跨target草稿保护，strict类型/lint/格式通过；真实Electron后继候选待验。原内部名称仍unknown，不把单批索引数量当完整GUI分母。收据见Evidence索引。

### 粘贴参数与Main退出顺序补证（2026-10-18）

同摘要panel/worker片段确认`textHandlePaste`输入为clipboard对象，根已迁为
`{plainText,html}`并一次更新DOM及回归调用，不留旧签名包装。
`PresentationTextClipboard`是本地职责型类型名；REA跨worker语义trace未匹配，
不宣称恢复了完整原始类型或调用图，详见[补证](presentation-clipboard-followup-20261018.md)。

Main `eZe`/`u7`的prepare→drain→恢复quit顺序映射到
`electron/appQuitLifecycle`→既有`AppServerHost.stop`；原fire-and-forget stop接线
直接替换，无compat。重复请求共享同一drain是明确本地实现选择；上游flush集合、
context dispose界限与资源树不冒称同义。26项定向回归、严格lint、Electron类型通过；
新固定产物原生验证待做，历史偶发超时根因unknown，原15秒门禁不变。

### 共享页头清退与unified合同后继（2026-10-18）

同一AppShell registry的Header/MainContentLayout已接管普通会话页头；独立46px宿主、侧栏补位、重复导航、常驻状态/目录及专用派生/props直接删除，没有新增compat/deprecated owner。清退74项、VM4、完整types/lint、标准GUI24/24和canonical动作后继通过；settled画面检查另暴露分叉raw hydration绕过workspace草稿导航，原120秒失败保留。调用迁到唯一`handleOpenTaskTopic`后，真实后继再次暴露initialScope恒等门槛；修正同一CommandWiring的初始路由恢复生命周期，red/green37、完整types、标准GUI24、真实7图/父子与设置返回草稿隔离及加严Fork Gate B均通过。unavailable backend，无Turn/模型；历史失败保留。

`HeaderToolbar`/`.Actions`/`UnifiedTabStrip`是安装包明文属性；其注册器与shell完整渲染器REA parent分别为`ev_510ea23eb3f657aa91ec654e613ce44f636c57a47ec021f837f1199a098c876e`和`ev_63dece790eea4393d8906f204f9c38dd80da7d3600c7f1f19bcd5c28d4b2d31c`。各自2575/19005bytes解析不代表完整语义或运行证明；full/split/chat、tabpanel/inert/focus及六槽动作应映射既有shell/right-surface owner，产品迁移仍开放。普通及unified内部均存在条件标题；不从rail外观推断flag，不增加独立隐藏开关。精确合同、范围和限制见[unified合同](../../exec-plans/artifacts/codex-shared-page-header-20261018/thread-controls/unified-workspace-contract.md)。

### Unified产品迁移（2026-10-18，active）

唯一[专项计划](../../exec-plans/codex-unified-workspace-20261018.md)持有后继验证。HeaderToolbar/Actions/UnifiedTabStrip采用已证名称；同scope注册只持展示对象，右侧面tab与pane从既有projection显式分流，不新增业务store。Thread动作按REA容器合同进入window/chat/tab-strip，summary按split进入chat，其余留window；More始终保留窗口右槽。稳定DOM容器避免重建工具组件。旧TaskCenterTabStrip/hook/projection与旧42/84px补位、auto-hide栏物理删除；title清洗保留threadTitle，fallback导航保留canonical语义。LayoutTransition继续实际resize/transition、双击full/split/chat、aria/inert和焦点owner。mainPaneEnd/sidePanelActive是本地展示适配，不冒充上游原字段；完整route transition context及content/divider/new-tab/context-menu仍gap。架构图已由root确认依赖方向。标准GUI与真实Electron已由候选3/5结算；工具栏后继候选6另验，不把局部通过写成整体100%。

分隔条后继复用LayoutTransition尺寸owner；参照新REA parent `ev_52abf6e068fc01327c50e66fda539aa7fa2fdabf8c2fea6d1b10c0ff0e249e8d`补10px键盘步进、内容Home/End、separator尺寸aria、主键/pointer身份、起点增量与双击默认宽度，清退360/420和右侧面560px旧下限为320px。28项定向及候选3/5真实后继通过。该项不关闭divider action slot、菜单、route transition或整体GUI。

候选2原生页头在full→chat→split后焦点落BODY；独立真实探针与normal Main退出保留。LayoutTransition仍是唯一focus owner，同一effect观察隐藏与布局形态。候选3完整六步骤通过，9462源码零漂移/429产物摘要；候选4只加严静止截图，同产品字节再次通过。候选5删除chatPanelMinWidth/layoutTransitionChatPanelMinWidth及team/code/Right Surface三个min常量，CSS、keyboard/pointer/aria统一320；94项、strict lint、完整types和原生六步骤通过，9462源码零漂移/541产物。失败317产物摘要独立保留。

线程summary的REA parent `ev_83011e06d28ca110820a1e0688adad13ed10e33e02d79255c483c7bd7f71c632`覆盖6精确输入16949bytes、1393 semantic unknown。完整layout与sections父证据分别为 `ev_e457dea934ddb45739ab0ef92d51716a575f57c193c1567b5e2b99fdad9e4068` / `ev_2da75de405e3fc5e7a9ae8b81d33f98e878609083d0c54db939ba7838e11fa8b`。组件producer `ev_e608e8136665557de99468feb67bb21aa3dd3ccab5b0bb0e2fbfacb24c089809`解析完整30591字节、保留1939 semantic unknown。它们为静态证据，参考运行flags仍unknown。

后继产品已直接替换Activity：`useThreadSummaryPanel`、`ThreadSummaryLayout` 和 `ThreadSummaryPanel` 为本地职责名，消费既有canonical items/children与artifact/thread/URL动作；压缩fc/tE/sE不作原始开发名称。主pane实际宽度驱动300px overlay/shift/gutter，shift同步浮动Composer；Main pin默认true，复用persistedAtoms typed gateway及同一Host file。旧Activity文件、registry、toggle与正向fixture同步删除，不新增compat。当前只覆盖plan、file_artifact输出、children和实际web_search来源；Subscriptions/Created tasks/Side chats/PR/Chrome/Computer Use、深层output identity、projectless空Sources仍partial。226项风险回归、strict lint与contracts已通过；新候选原生验收尚待运行，不能继承候选6的成功。

布局与分组补证分别为 `ev_e457dea934ddb45739ab0ef92d51716a575f57c193c1567b5e2b99fdad9e4068`（完整611bytes/19 semantic unknown）和`ev_2da75de405e3fc5e7a9ae8b81d33f98e878609083d0c54db939ba7838e11fa8b`（14完整函数18040bytes/1191 unknown）。阈值基于主内容目标宽度，不是window宽度；sections随canonical数据/能力显示。Main pin当前typed协议尚无该key，实施需迁移真实Host合同，不能伪造renderer持久化。portable bundle与完整122记录导出均经完整JSON解析和gzip解压SHA验证，保留原unknown。

HeaderToolbar后继按原注册producer与integrity核对CSS补齐boolean inset、8px默认/8+6px tab-strip、40px pane、compact/secondary、42rem具名容器与原明文DOM属性；不新增alias。28项与strict lint通过；候选6只迁四份冻结输入后重建/原生六步骤全部通过。次级动作能力与当前工具分组分开验，不凭组件API补齐声称窄窗排版完整对齐。
