# Lime 与 Codex Desktop 的差距：REA 对照与实施

研究基线：2026-10-13；实施状态校准：2026-10-14。对照对象：本机 `/Applications/ChatGPT.app`，实际为 Codex Desktop `26.1007.30912` / build `20156`，Bundle ID `com.openai.codex`。下表记录当前差距，详细迁移和验证以 [对齐执行计划](../../exec-plans/codex-gui-alignment-current-plan.md) 为准。

Lime 已迁移长历史虚拟列表、审批详情、Files/diff 导航、结构化主输入和 Browser tab 恢复。基础 link/code 已实施并通过实际源码定向测试，真实桌面门禁待关闭；听写生命周期正在接线。持久富草稿、专业文件的排版与批注、原生应用操作，以及远端执行的产品入口仍有明确差距。

本报告依据真实安装包的静态代码、Lime 源码和官方功能文档。没有取得 Codex 实时截图与点击证据，因此不评价两者实际流畅度、成功率和模型质量，不给整体“对齐百分比”。Lime 后续真实 Electron 验证独立记录在执行计划，不反推参考应用的运行表现。

2026-10-14 实施校准：`ComposerUtilityBar` 已直接替换旧项目上下文组件，343 项定向回归及真实项目/Git/冷重启 Gate 通过。公共 pending Queue 的历史/分页隔离完成 74 项 Rust/JSONL 回归，搜索排除完成 17 项回归；真实 pending Gate 已通过历史/分页/搜索排除、富输入 mutation 与首图 media 读回。Right Surface 的 73 项生命周期回归、Browser 完整 live tab 恢复的 82 项回归及双 tab/关闭 primary 不复活的真实 Gate 已通过。rollout 空库重建缺陷已修复，23 项回归通过。

结构化EditorView、唯一Controller、typed submission和共享surface草稿已实施，历史atom提及抢方向键及receipt恢复route缺陷已修。rich Electron Gate68/68、新版22场景聚合和完整默认门禁均通过，既有Composer实施合同关闭；external backend绕过live provider/runtime prompt lowering，IME/paste为synthetic DOM事件，本地runtime场景使用provider fixture，不是live。长UserMessage两入口折叠、精确canonical去重、主窗口原生复制权限和虚拟列表动态测量已实施；真实macOS长列表与冷启动通过，全文9682字符复制一致，后继阅读锚点漂移0.203125px。权限owner回流守卫39/39通过。视口竞争修复后的rich第五轮69/69、long-list第六轮/冷启动及live-tail65/65通过；页头consumer placement与横向滚动已修复，resize-fixed5三尺寸66/66通过。新默认门禁发现并修复复制反馈卸载泄漏，生命周期10/10、消息回归69/69、默认127/127批及fresh复制Gate69/69通过，1705/9682字符全文复制一致。各场景按其renderer摘要分别记录；较早22/22聚合仍属修复前基线。见[主输入审计](./main-composer-audit.md)、[用户正文审计](./user-message-collapse-audit.md)及[保存补证](./composer-draft-persistence-audit.md)。测试、fixture、文档和dead回流守卫随owner迁移；全产品仍partial。

本批link/code依据[迁移前marks/voice补证](./marks-voice-audit.md)实施到唯一input-kit：实际src先22红/8绿，迁移后20文件224/224通过；annotation事务拆分后5文件92/92通过，Controller由803行降为762行。Markdown submission与display UTF16、typed UTF8范围分离，安全link/code属性、原文草稿和编辑生命周期同步回归。听写hook与Core单路径接线72/72、fixture312/312、最终标准typecheck和renderer构建通过；新的Electron富输入Gate与默认门禁运行中，旧127批绿不能覆盖本批新源码。[样式补证](./composer-marks-css-audit.md)区分基础schema与完整NodeView/toolbar合同。完整rich PMU、主动链接导航/编辑、系统mic/ASR、persistent draft、专业文件、原生操作和remote分别保留unknown或待办。

## 1. 已完成安装

- CLI：Rea `6.4.0`，启动器 `~/.local/bin/rea`。
- 运行时：独立 Node `24.21.0`，位于 `~/.local/share/rea/runtime/`。用户截图中的 Node `20.19.3`、`23.4.0`、`25.0.0` 均不满足 Rea 的 engines 条件；既有默认 Node 未修改。
- Codex MCP：已注册到 `~/.codex/config.toml`，原配置备份为 `~/.codex/config.toml.rea.backup`；新条目显式使用独立 Node，避免桌面进程使用 Node 23。
- 安装后的配置解析验证：移除新增 Rea 条目后，配置与安装前保持相等。
- 配套技能：`~/.agents/skills/reverse-engineer-anything/`，skill version `37`。
- `rea doctor --client codex --skill --json`：`healthy=true`，Node、Codex 注册、skill identity 三项通过。
- 实际 MCP stdio 初始化和 `tools/list`：返回服务器 `rea/6.4.0`、170 个工具。
- 本轮已通过 CLI 使用 Rea；当前 Agent 会话的 MCP 工具表不会因注册自动刷新，后续会话加载注册需要重启客户端。

## 2. 差距矩阵

专业文件的格式加载、面板、条件保存、批注提交与Host文件版本边界见[专业文件补证](./professional-files-audit.md)。这是有边界的安装包静态合同；真实排版、编辑、roundtrip与Lime产品迁移尚未验证。

[用户消息补证](./user-message-collapse-audit.md)确认普通本地正文消费完整text字段，折叠整条用户消息，默认阈值20行。取证时Lime缺该高度折叠，现在两正文入口共用显示组件，本切片真实产品验收已关闭；不能把大paste显示全文本身判为差距，或由text_elements推断应逐paste显示chip。追加exact AST已确认正常Markdown链接的Skill/plugin/app分类、唯一catalog身份解析与专用内联consumer；裸引用、producer→wire→history、复制回贴与真实点击仍unknown。

用户提出的共享 `codex-rs` 方向有静态证据支持：安装包附带 `codex-cli/bin/codex`，manifest 版本为 `0.162.0-alpha.17.2`；Host 代码含 Codex `app-server` 启动参数和 App Server 请求消费。公开源码的 CLI 分别调度 `codex_app_server` 与 `codex_tui`，TUI 使用同一 AppServerClient 抽象及 in-process/remote transport。共享的是协议、runtime 和领域 owner，GUI 与 TUI 分别实现自己的 presentation。

本地 checkout 在研究初始为 `a9b0815167c27ab13719dd12d13b63e02b70d221`，2026-10-14 复核为 `31434401fa3cd111866acdc1bba2a73b561f53d5`。不能由目录名或同属 Codex 推导安装包与 checkout 的精确构建等价；原生二进制的 build commit 仍为 unknown。摘要和来源保存于证据索引。

| 范围                  | Codex Desktop 的证据                                                                                                                                         | Lime current                                                                                                                        | 差距与判断                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 专业文件              | DOCX/PPTX/XLSX 分别解码为 Document/Presentation/Workbook proto；实际加载 WorkbookPanel，并有批注提交代码。官方说明支持文档、幻灯片、表格、PDF 预览和批注修改 | Office/PDF 经 `document-preview` 抽取文本，GUI 选择 `document_text` 或系统打开；可编辑类型限定 Markdown/text/code/HTML              | **明确功能差距，影响较大**：产物可在聊天旁按真实排版检查、选区域反馈的闭环未形成；不等于 Agent 不能生成这些文件                |
| 长会话                | `virtualized-turn-list` 按计算的范围 slice 后渲染，使用 ResizeObserver 测量高度，保存 anchorKey 和窗口范围                                                   | `VirtualizedTurnList` / `threadVirtualizer` 已替换尾窗；canonical 分页和 viewport DOM window 分开                                   | **已迁移**：真实滚动、动态高度、后继锚点与冷恢复证据已取得；双方性能和完整视觉等价未测                                         |
| 原生应用操作          | 官方 Computer Use 插件支持 macOS/Windows 的看屏、点击、输入及应用授权                                                                                        | 已有 macOS 截图/窗口/控件树 helper、Windows 只读 helper；内建 desktop dynamic tool 仅 `desktop.appInfo`，其他操作工具集中于 browser | **明确 current 工具面差距**：原生 GUI 操作没有形成 Agent 工具、授权、执行、可见反馈的完整闭环；不能把 Browser 当成整个电脑控制 |
| 本地/云端与跨设备     | Composer 有 local/cloud 选择动作、就绪/禁用状态、跨设备说明；能否使用受账户、workspace 和 feature gate 影响                                                  | RemoteTransport、远端 exec-server 与协议测试存在；GUI “添加环境”按钮 disabled，Desktop Host 默认本地 stdio sidecar                  | **底层部分实现，产品入口未完成**：用户不能经该界面完成添加、连接、选择和恢复；不能判为完全没有远端 runtime                     |
| 审批可理解性          | pending request panel 与通用 ApprovalCard；自动审查详情属于另一种状态                                                                                        | `PendingRequestItemPanel` / `ApprovalCard` 已替换旧单行提示，复用同一 server request/decision authority                             | **已迁移待处理请求切片**：allow/decline/cancel/full-access 进入真实聚合；自动审查和所有请求变体仍需逐项核对                    |
| 变更审查入口          | Thread review panel 持有选中文件路径，并提供上一文件/下一文件动作                                                                                            | `ReviewThreadSidePanelTab` 接到既有 ChangesPanel/diff owner，旧 path-only surface 已删除                                            | **入口已接通**：真实四文件 diff/选择/定位 Gate 通过；完整 diff/editor 行为与视觉仍待核对                                       |
| Thread / queue / 导航 | local-conversation 页面组合 Thread、summary、侧面板和 composer；当前官方产品含 ChatGPT/Codex 模式                                                            | 项目分组、搜索、置顶、归档、Thread 页头、fork、停止、运行时输入、queue 编辑/重排/立即执行均存在                                     | **已有同类骨架**：重点验收窄窗、状态可见性和入口一致性；本轮没有足够视觉证据判定排版优劣                                       |
| Browser / 右侧工作区  | 安装包含浏览器、artifact、sources、subagent、terminal 相关 surface                                                                                           | 单一 RightSurfaceHost/registry；BrowserTabHost snapshot/selection 恢复全部 live tabs，select 与 close 分开                          | **Browser 生命周期已验收**：真实双 tab/关闭 primary 不复活 Gate 通过；其他 surface 的编辑状态、滚动和恢复继续核对              |

## 3. Lime 源码定位

### 3.1 专业文件

- [预览路由](../../../src/lib/artifact/previewArtifact.ts#L241)：document 类型选择文本预览或系统打开。
- [编辑资格](../../../src/lib/artifact/previewArtifact.ts#L327)：只开放 Markdown、文本、代码和 HTML。
- [文档文本抽取](../../../lime-rs/crates/document-preview/src/lib.rs#L61)：支持 DOCX/XLSX/PPTX/PDF，不是排版渲染器。
- [Word 导出](../../../src/components/workspace/document/utils/exportDocument.ts#L24)：HTML 包装的 `.doc`，不能当成原生 DOCX 排版生成。
- [已有产物工作台](../../../src/components/agent/chat/workspace/ArtifactWorkbenchShell.tsx#L125) 与 [DesignCanvas](../../../src/components/workspace/design/DesignCanvas.tsx#L3) 已支持内容编辑或设计操作，不能把所有文件/图像能力都列作缺失。

建议优先做真实 PDF 页面和 DOCX 排版预览，保留来源路径、版本与所属 Turn；随后复用同一批注/反馈 owner 接入表格和幻灯片。Agent 的 Shell/Skill 生成能力与 GUI 检查能力分别验收。

### 3.2 历史渲染

- [canonical 消息列表](../../../src/components/agent/chat/components/MessageList.tsx#L477) 已有 Turn 投影。
- 初始基线使用渐进尾窗和展开全历史路径；该 owner 已删除，由 [VirtualizedTurnList](../../../src/components/agent/chat/components/VirtualizedTurnList.tsx) 与 [threadVirtualizer](../../../src/components/agent/chat/projection/threadVirtualizer.ts) 直接接管 viewport range、测量与锚点。
- `content-visibility` 是浏览器跳过离屏布局的优化，不等于把离屏 React 条目从渲染集合卸载。

当前实现继续消费同一 canonical projection 和历史分页，不另建历史 store。验收需证明离屏卸载、流式高度变化、向上阅读时锚点稳定及恢复后定位；未执行的规模和平台测试不能从纯几何回归推导通过。

### 3.3 审批与变更

- 研究初始基线的审批只显示单行摘要；该入口已由 [PendingRequestItemPanel](../../../src/components/agent/chat/components/PendingRequestItemPanel.tsx) 替换，当前迁移与验证状态见 [执行计划](../../exec-plans/codex-gui-alignment-current-plan.md)。
- [已有 diff](../../../src/components/agent/chat/components/canvas-workbench/changes/CanvasWorkbenchChangesPanel.tsx#L64) 包含 inline/split 和 review。
- 初始 Files path-only 列表已删除，由 [ReviewThreadSidePanelTab](../../../src/components/agent/chat/workspace/ReviewThreadSidePanelTab.tsx) 消费同一 changeView 并接到已有 diff owner；实际 Gate B 状态见执行计划。

这两项适合集中改呈现和导航，遵循 KISS/DRY：调用已有审批和 diff owner，不建立新审批状态机或第二套审查工作区。

### 3.4 环境与桌面能力

- [添加环境按钮](../../../src/components/agent/chat/components/TaskCenterEnvironmentPanel.tsx#L100) 明确禁用。
- [Rust remote transport](../../../lime-rs/crates/app-server-client/src/remote.rs)、[TypeScript remote transport](../../../packages/app-server-client/src/remote.ts#L265)、[环境连接](../../../lime-rs/crates/app-server/src/processor/environment.rs#L233) 均存在。
- [Electron 本地 sidecar](../../../electron/appServerHost.ts#L1358) 是 Desktop current 默认路径。
- [Agent 浏览器工具](../../../electron/appServerDynamicToolHost.ts#L70) 与 [CDP 实现](../../../electron/browserTabHost.ts#L400) 已有；desktop 工具注册边界见前者 `206` 行。
- [macOS native helper](../../../electron/native/macos/macos-native-host.swift#L594) 有截图、窗口控制、控件树与权限方法。
- [Windows native helper](../../../electron/native/windows/windows-native-host.cpp#L562) 声明只读能力。

远端补齐应沿同一 App Server 认证 transport 和 Environment owner；原生操作补齐应沿 Desktop Host 的工具/授权合同。第三方 MCP 可以提供额外能力，但不能作为自带 current 闭环已完成的证据。

### 3.5 已有工作区能力与验证缺口

- [Thread header](../../../src/components/agent/chat/workspace/ThreadWorkspaceHeader.tsx#L299)：标题、状态、cwd、归档、fork；主场景接入见 [WorkspaceConversationScene](../../../src/components/agent/chat/workspace/WorkspaceConversationScene.tsx#L571)。
- [QueuedMessageList](../../../src/components/agent/chat/components/QueuedMessageList.tsx)：已有编辑、重排、删除和 idle 启动，现已直接迁移同义 renderer 并补 action identity 与富输入保真；active-turn Steer 仍是合同差距。[导航/Composer 审计](./navigation-composer-audit.md) 记录新增 REA 单模块证据、命名边界和剩余项。
- [RightSurfaceHost](../../../src/components/agent/chat/workspace/right-surface/RightSurfaceHost.tsx#L135)：只渲染 active pane。切换后是否保留编辑状态需实测，不能仅凭挂载方式断言丢状态。
- [ComposerUtilityBar](../../../src/components/agent/chat/components/Inputbar/components/ComposerUtilityBar.tsx) 已替换原项目上下文组件，动作归 `useComposerUtilityActions`，20 项新竞争/失败回归及消费者共 343 项通过。真实项目/Git mutation 证据见 current 执行计划；staged worktree、cloud/remote/environment 和完整 Composer 仍有缺口。
- 当前文件规模：AppSidebar `1506` 行，TaskCenterUtilityToolbar `898` 行，ComposerUtilityBar `666` 行、动作 hook `268` 行，WorkspaceConversationScene `712` 行。仅用作职责复杂度信号，不作为对方产品更好的证据，也不因此另开全仓重构。

## 4. Rea 证据与边界

原始包：`/Applications/ChatGPT.app/Contents/Resources/app.asar`，567,757,587 字节。

SHA-256：`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。

ASAR 目录含 21,089 个文件、15,208 个 JavaScript/TypeScript 路径。选取 44 个 GUI/桥接文件，5,471,583 字节，逐个对照 ASAR 声明的 SHA-256 校验后复制到独立用户级目录。没有执行提取的应用代码。

发布版 Rea `6.4.0` 的实际 CLI/MCP schema 没有仓库 main 文档中的 `source_paths` 参数，因此分析对象是**带来源清单的提取子集目录**，不是整个 ASAR 的完整分析。

| Evidence                                                              | 范围                                           | 覆盖限制                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ev_7e96cf795451f834a7bddc70daacbc950320070656781f6347f1cf9c759e4299` | 44 个选定文件；39 个 JS 解析，parse failures=0 | structural partial；主进程大文件的语义分析耗尽 worker heap，部分展开关系触及 parent budget；静态事实仍保留 |
| `ev_d6c035921bbb148358056a3c5cc17f583a20225bfdead1f8459b5403258be4a1` | 3 个 timeline/virtualizer 文件，51,158 字节    | 选定子集 structural complete；semantic status=unknown，调用/对象流等保留显式不确定性                       |
| `ev_4d5f0a6abe02d9b92d4a6ecf6517984bef62ef39e8da072bdac0bf7950c22c7a` | 6 个环境/摘要/审查 surface 文件，77,532 字节   | 选定子集 structural complete；semantic status=unknown，不能当作运行时因果证明                              |

“complete”只指选定目录的结构覆盖，不指整个应用、其缺失依赖或全部运行行为。没有 source map 文件，不能恢复开发时完整源码身份。动态 IPC 无法自动配对时保持 unknown；不把 Rea 中的零计数解释为功能不存在。

[精简证据索引](./evidence-index.json) 保存安装验证、44 文件的来源/摘要、15 个原始 UTF-16 定位、完整 Evidence ID 和限制。大体积 Evidence、提取代码及格式化阅读副本留在 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/`，不纳入源码仓库。

关键安装包观察：

- `virtualized-turn-list-6a3bab50898c.js`：`slice(J.startIndex,J.endIndex)`、ResizeObserver、anchorKey 恢复。
- `artifact-preview-loaders.electron-9d76e08ff512.js`：`ExtractDocxProto`、`ExtractSlidesProto`、`ExtractXlsxProto` 的实际解码调用。
- `artifact-tab-content.electron-68a541ab97f2.js`：WorkbookPanel lazy import、`artifact-annotation-direct-submit`。
- `composer-action-bar-run-location-dropdown-aca85d363914.js`：local/cloud 动作、workspace 禁用和启动中状态。
- `automatic-approval-review-details-88737b1457aa.js`：展开状态与详情内容。
- `.vite/build/preload.js`：`electronBridge` 和 `sendMessageFromView -> ipcRenderer.invoke`。
- `.vite/build/main-CqEoQDOU.js`：App Server 请求消费；这里只证明静态 Host 路径，未反编译 native runtime。

## 5. 建议实施顺序

1. **长历史视口虚拟化**：写集限定 MessageList/现有渲染窗口与对应测试。先改善持续任务中的阅读、流式输出和恢复体验。
2. **审批详情 + 文件列表进入 diff**：复用现有 owner，完成两个明确的交互断点。
3. **专业文件查看/批注**：先形成 PDF/DOCX 的真实排版检查闭环，再扩展到 XLSX/PPTX；不默认承诺完整 Office 编辑套件。
4. **远端环境 GUI**：连接、选择、失败恢复与认证 transport，明确账户/平台 readiness。
5. **原生应用操作**：在具体用户旅程需要时补 native tool、输入执行、授权和跨平台证据，避免把所有系统媒体能力一次性纳入范围。

上述顺序来自研究阶段。审批、Files/diff 与长历史已进入首批实现；其余仍需逐项取证、实现与验收，不代表全面对齐完成。

## 6. 官方来源、验证与完成度

- [ChatGPT desktop app](https://learn.chatgpt.com/docs/app)：当前产品范围、ChatGPT/Codex 选择与项目工作区。
- [Work with files](https://learn.chatgpt.com/docs/artifacts-viewer)：文件预览、批注、HTML/LaTeX 等工作流；可用性依赖 surface。
- [Computer Use](https://learn.chatgpt.com/docs/computer-use)：插件、macOS/Windows 支持、应用批准和 OS 权限；明确不能自动操作 ChatGPT 自身及终端应用。
- [Rea 安装](https://github.com/morluto/rea/blob/main/docs/installation.md)：安装和 scoped doctor；发布版 schema 以实际工具为准。

验证已完成：Node 官方归档摘要、Rea 版本与 doctor、真实 MCP 握手、选定文件完整性、三份静态 Evidence、两份 Rea summary view，以及文档/JSON/本地链接检查。

未验证：Codex 实时界面与点击、双方性能和模型质量、Windows 安装运行。Computer Use 对 `com.openai.codex` 返回安全限制拒绝访问；官方也明确禁止控制 ChatGPT 自身，本轮没有绕过。Lime 实施后的定向测试与真实 Electron 验证见 current 执行计划。

完成度按本轮范围记录：安装 **100%**；上述有边界的静态对照 **100%**；实时交互对照 **0%**。不能据此宣称全产品能力已穷尽或 Lime 对齐完成。

治理分类：研究阶段只增加本报告、精简证据和计划。后续实现复用 `current` 业务 owner，已替代的 compact approval、path-only Files 和旧尾窗进入 `dead / deleted / forbidden-to-restore`，不保留 compat 包装；删除清单、护栏与验证结果统一维护在 current 执行计划。已有 App Server/agent/tool-runtime/命令及未知未跟踪改动继续避让。
