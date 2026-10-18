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

本轮窄写集：`App.tsx`、`useAppShellLayout`、`app-sidebar` 布局及其调用点、`EmptyStateLayout/EmptyStateHero/EmptyState` 首页接线、`HomeAmbientSuggestionsContent/HomeSuggestionList`、设置布局/导航、`mainWindowOptions`、受影响测试/fixture选择器与布局证据。保护现有 Cloud/account 业务增量；Rust、协议、Plugin 和其他工作台业务 owner 只读。参考实际 `app-initial` App Shell；`sidebar-a9ef58c0cd4b.js` 导出的是 ScheduledSidebar，旧主侧栏模块映射作废。首页以实际 HomeComposerRoute 及其布局函数为准，保留 Banner，移除强制整屏翻页和重复展示。

退出条件：对齐参考中的实际几何、导航密度、内容宽度与滚动结构；迁移冲突测试；取得受影响定向回归、标准 GUI smoke 和真实画面证据。静态证据与产品验证分开记录，未取得时保持 partial。

历史候选、两次外部清理与Office分域验证迁至[2026-10-18历史](codex-gui-alignment-history-20261018.md)。用户已确认清理停止。历史缺失原件不恢复为有效通过；独立候选、当前根与后继63输入分别结算。当前避让Plugin、Cloud/account、Rust、协议/生成客户端与release生产写集；不改变其他进程生命周期。详细Office合同继续由各自领域计划持有。

## 已采用能力与证据边界

| 范围                     | current owner 与状态                                                                                         | 仍开放的范围                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 窗口/主导航/首页         | 单侧栏/共享宽度/46px toolbar/HomeAmbientSuggestionsContent；239项定向回归通过 | 标准GUI、真实截图、HeaderAction与其他内容/命名差距 |
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

1. 当前根完成单侧栏、共享可调宽度与收起、窗口46px工具栏、首页单滚动容器及Composer最大宽度、建议列表、设置同一导航骨架；完整原件与映射见[布局证据](artifacts/codex-shell-layout-rea-20261018/report.md)。导航87项、首页/排版119项定向测试已通过；标准GUI与真实Electron截图正在执行，尚未结算。保留全部失败轮次和原5秒测试期限。
2. 依据当前源码与产物取得1440/1024/800窗口、折叠/拖宽、Home/Settings、浅深主题的实际画面；比较计算尺寸、溢出、焦点与滚动。HeaderAction registry、账户底部位置、旧Home恢复/方法/Guide内容和其余会话/Composer像素与结构仍需继续按REA确认，不能因骨架通过宣称全GUI完成。
3. Worktree退出/粘贴独立候选已完成构建与freshness，完整types、定向87/event-policy3通过；标准wrapper仍not-run，runtime及两代原生场景未启动。该独立候选不代表最新根。交接见[收据](artifacts/composer-worktree-native-20261018/handoff-receipt.json)。
4. Workbook18-v3和设置/Queue45的63输入仅完成后继preflight，未apply、未创建整合候选；Active Queue durable仍在独立安全副本未合根。Office候选6保留partial及30失败/323通过、类型中断事实；不再占据窗口布局主线。
5. 公共Profile认证主链已由[当前审计](artifacts/public-profile-current-audit-20261018/report.md)重新确认；pins同ASAR真实lazy target已补证，但外部业务合同和产品实现仍有缺口。其余unknown由[剩余账本](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md)持有，不造服务、可用flag或未经观察的参考运行分支。

整体仍partial；尚缺完整产品分母，不给伪整体百分比。专业文件预览、某批搜索目标、组件测试或规则全部通过均不等于整个GUI完成。参考运行、OS IME/mic/主题事件、全skin、完整production/live、Windows/安装包及进程重启耐久性只能由各自真实证据关闭。
