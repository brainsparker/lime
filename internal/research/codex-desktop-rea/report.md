# Lime 与 Codex Desktop 的差距：REA 对照与实施

研究基线：2026-10-13；实施状态校准：2026-10-16。对照对象：本机 `/Applications/ChatGPT.app`，实际为 Codex Desktop `26.1007.30912` / build `20156`，Bundle ID `com.openai.codex`。下表记录当前差距，详细迁移和验证以 [对齐执行计划](../../exec-plans/codex-gui-alignment-current-plan.md) 为准。

证据保留校准（2026-10-16 09:31）：整个`.lime/qc`在Environment验收运行中被外部清理，本文更早引用的本地日志、收据及截图现已丢失；历史结果只保留为当时执行记录，不能宣称其产物仍可复核。源码及Vitest续跑状态保留，新Environment证据从`recovery-20261016`重新收集；保留的REA原字节位于独立系统临时目录，不属于这次QC清理。现存证据与限制以索引的`local_evidence_lifecycle`及本轮新收据为准，不伪造恢复历史产物。

Lime 已采用长历史虚拟列表、ApprovalCard、Files/diff、单一结构化 Composer/NodeView、持久草稿、typed acceptance、新建会话和单一 SettingsPage 章节 owner。packet21 的三入口首发、rich Stop、Home 冷恢复及三工作区两次正常冷恢复四项合同均通过；设置15章节/24首屏读取也有独立真实 Electron 证据。它们各自绑定原源码和产物，不能覆盖后续改动。

本轮修复了两项问题：Skills 工作台试用完成后 Composer 仍绑定 Home 而不可编辑；工具状态文案每次查询都重新合并整份 Agent 翻译资源。前者由既有 CommandWiring 将非 Composer 的真实 accepted 回执交回可见 topic commit，继续保留 epoch/ready/scope 与草稿消费 authority；后者直接复用 createI18n 已加载的五语言表，保留实时语言选择、插值与缺失键处理。两项均复用 current owner。

前一验证切片已关闭：前端默认续跑132/132批、contracts/legacy、标准GUI壳24/24和current聚合第7轮22/22通过；默认结果由组合步骤组成，原wrapper失败保留。freeze31为7886源码/2303目录产物，后验零漂移；67份本轮summary显式引用的证据已独立冻结，完整身份见[索引](evidence-index.json)与[当前计划](../../exec-plans/codex-gui-alignment-current-plan.md)。1761是历史测试登记路径，其中1756现存、5已删，不是1761当前文件均执行。短问候预算超时与审批Main挂起的底层根因仍unknown；fixture已修复提前打印pass/吞退出失败的问题，强制回收永不计正常退出。

设置 canonical 章节与返回切片已关闭：SettingsPage 直接消费参数，useAppNavigation 投影实际 session/workspace，页头返回剔除一次性 intent，rail Home 使用首页动作。原生第14轮4/4与正常Main退出、标准GUI24/24及默认前端130/130批已通过，最终组合收据见本文末段。Memory 未保存保护已交付：复用 REA 已确认的继续编辑/放弃语义，接入唯一导航 owner，拆分表单编辑/保存并保留在途新输入；最终定向7 suite 114/114、配置边界21/21、默认前端130/130批、标准GUI24/24与新原生6/6通过组合验收；原verify:local扫描超时exit1保留。

页内修正笔记切片已关闭：独立组件、输入版本保存与同一导航保护替换旧内联实现，局部页签保留同一草稿。定向9 suite 126/126、标准verify:local整轮exit0（前端130/130批、1762登记文件）、标准GUI24/24与原生第5轮新增6/6通过。独立收据 `.lime/qc/settings-note/final-20261015-1/receipt.json` 保留前三轮失败及原生身份。仍有明确缺口：其他设置表单保护与内容搜索；专业文件的排版与批注；原生应用操作与远端执行产品入口；结构/命名的完整符号覆盖、OS输入与Windows验收。保留差异仅主题、多模型、首页Banner。整体状态为 partial，没有足够分母计算全GUI对齐百分比。下文带日期的实现记录为阶段证据；当前身份和待办以执行计划及索引最新条目为准。

[结构与命名账本](structure-alignment-ledger.md)集中列出确认导出、方法属性、Lime current owner、删除项和待办；上游原类名/目录未恢复的项目明确保留 unknown。它是已取证范围的映射，完整符号覆盖仍待继续。

参考应用未取得实时截图或点击证据。本报告以安装包REA、公开源码与已引用官方材料区分静态事实；Lime真实Electron验证独立记录，不反推参考应用的流畅度、成功率或模型质量。已完成的历史默认门禁只覆盖各自切片，不代表当前新产品修复已验收。

2026-10-14 实施校准：`ComposerUtilityBar` 已直接替换旧项目上下文组件，343 项定向回归及真实项目/Git/冷重启 Gate 通过。公共 pending Queue 的历史/分页隔离完成 74 项 Rust/JSONL 回归，搜索排除完成 17 项回归；真实 pending Gate 已通过历史/分页/搜索排除、富输入 mutation 与首图 media 读回。Right Surface 的 73 项生命周期回归、Browser 完整 live tab 恢复的 82 项回归及双 tab/关闭 primary 不复活的真实 Gate 已通过。rollout 空库重建缺陷已修复，23 项回归通过。

结构化EditorView、唯一Controller、typed submission和共享surface草稿已实施，历史atom提及抢方向键及receipt恢复route缺陷已修。历史主输入切片的rich Electron Gate68/68、新版22场景聚合和该切片完整默认门禁均通过，既有Composer实施合同关闭；external backend绕过live provider/runtime prompt lowering，IME/paste为synthetic DOM事件，本地runtime场景使用provider fixture，不是live。长UserMessage两入口折叠、精确canonical去重、主窗口原生复制权限和虚拟列表动态测量已实施；真实macOS长列表与冷启动通过，全文9682字符复制一致，后继阅读锚点漂移0.203125px。权限owner回流守卫39/39通过。视口竞争修复后的rich第五轮69/69、long-list第六轮/冷启动及live-tail65/65通过；页头consumer placement与横向滚动已修复，resize-fixed5三尺寸66/66通过。新默认门禁发现并修复复制反馈卸载泄漏，生命周期10/10、消息回归69/69、默认127/127批及fresh复制Gate69/69通过，1705/9682字符全文复制一致。各场景按其renderer摘要分别记录；较早22/22聚合仍属修复前基线。见[主输入审计](./main-composer-audit.md)、[用户正文审计](./user-message-collapse-audit.md)及[保存补证](./composer-draft-persistence-audit.md)。测试、fixture、文档和dead回流守卫随owner迁移；全产品仍partial。

本批link/code依据[迁移前marks/voice补证](./marks-voice-audit.md)实施到唯一input-kit：实际src先22红/8绿，迁移后20文件224/224通过；annotation事务拆分后5文件92/92通过，Controller由803行降为762行。Markdown submission与display UTF16、typed UTF8范围分离，安全link/code属性、原文草稿和编辑生命周期同步回归。听写hook与Core单路径接线72/72、fixture312/312、最终标准typecheck和renderer构建通过。新增实际MarkdownRenderer与fixture回归6文件189/189，fresh Electron富输入Gate73/73；新current聚合22个真实Electron子场景通过，54项产品、14项fixture及277项renderer/Host/sidecar逐项零漂移。首轮fixture版本问题及默认69批中断恢复guard失败单独登记。默认续跑94批出现同步render超时，未修改生产或扩大原5秒上限，显式Node24完整文件14/14通过；95批发现测试继承英文locale，只修测试语言隔离，原批16文件164/164通过，本批完整默认已exit0，真实标准Electron smoke通过。旧127批绿不覆盖随后NodeView源码，旧进程runtime未记录，不声称全部续跑批次都由Node24执行。[样式补证](./composer-marks-css-audit.md)区分基础schema与完整NodeView/toolbar合同。[Code NodeView补证](./composer-code-nodeview-audit.md)与[高亮/Auto补证](./composer-code-highlight-audit.md)已闭合静态合同，Controller下的registry、PM contentDOM、Portal语言选择与两个plugin已正式接线；新rich Gate74/74，实际Auto→Plain→TypeScript、正文高亮、单次发送、cancel/history与canonical富输入均通过。新current聚合22/22、前端127/127批与标准GUI smoke已通过；默认按续跑组合步骤关闭，未改写原wrapper失败。完整rich PMU、主动链接导航/编辑、系统mic/ASR、persistent draft的三首发与最新产物Stop产品Gate、专业文件、原生操作和remote分别保留unknown或待办。

## 1. 已完成安装

- CLI：Rea `6.4.0`，启动器 `~/.local/bin/rea`。
- 运行时：独立 Node `24.21.0`，位于 `~/.local/share/rea/runtime/`。用户截图中的 Node `20.19.3`、`23.4.0`、`25.0.0` 均不满足 Rea 的 engines 条件；既有默认 Node 未修改。
- Codex MCP：已注册到 `~/.codex/config.toml`，原配置备份为 `~/.codex/config.toml.rea.backup`；新条目显式使用独立 Node，避免桌面进程使用 Node 23。
- 安装后的配置解析验证：移除新增 Rea 条目后，配置与安装前保持相等。
- 配套技能：`~/.agents/skills/reverse-engineer-anything/`，skill version `37`。
- `rea doctor --client codex --skill --json`：`healthy=true`，Node、Codex 注册、skill identity 三项通过。
- 实际 MCP stdio 初始化和 `tools/list`：返回服务器 `rea/6.4.0`、170 个工具。
- 本轮已通过 CLI 使用 Rea；当前 Agent 会话的 MCP 工具表不会因注册自动刷新，后续会话加载注册需要重启客户端。
- 2026-10-14 晚间复核发现注册条目缺失，已重新按 scoped setup 备份并恢复，显式使用独立 Node24；当前非REA配置语义保持相同。doctor Node/注册/skill 三项healthy，真实stdio初始化与tools/list再次返回rea/6.4.0和170工具。本Agent工具表仍未刷新，继续使用已安装CLI。

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

2026-10-14 用户为释放空间删除仓库 `.lime/`。该目录中后续 Composer focused audit 的本机 manifest、候选与产品截图现为缺失的历史原件；仓库 audit 文字和 Evidence ID 仍保留，不能将旧摘要用于恢复版身份或运行验收。用户级 REA 原始成员按实际存留情况复用；必要候选已迁至独立临时目录并重新验证，详见 current 执行计划。此清理不改变静态观察的证据等级，也不代表新候选已经产品验收。

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

[设置导航审计](./settings-navigation-audit.md) 已校准七 member 与20原字节锚点。第一切片九源单一章节owner、公开SettingsPage与调用者已正式采用，重复名单/dead定义直接删除；六suite78/78与设置oracle10/10、lint/格式通过，真实Electron15key/24可见页面状态、157原生read和Main22039正常退出通过。其后canonical导航/返回已进入第二切片，最新结果见本页末段；内容搜索/dirty继续待交付。

[公开新建会话审计](./new-conversation-navigation-audit.md) 已采用唯一 `startNewConversation`、committed route、稳定 Home scope 和既有 Coordinator 的 fresh CAS，删除随机草稿事件、预热/materialized 双轨及 dead general tab owner。Home 恢复、New chat 新空稿是明确的 Lime 决策，参考普通侧栏的运行时 fresh 行为仍 unknown；不据 Lime 测试反推参考实现。

Composer 富输入、持久草稿、新建导航与 Skills 接线的前一验证切片已关闭：packet21 的三入口首发、rich Stop、Home 冷恢复和三工作区恢复4/4通过；新产物 current 聚合第7轮22/22、默认前端132/132批与组合门禁通过，正常 Main 回执、源码/产物防漂移和独立冻结证据见[当前计划](../../exec-plans/codex-gui-alignment-current-plan.md)。原失败、各packet身份及逐轮过程保留在[历史快照](../../exec-plans/codex-gui-alignment-history-20261015.md)与证据索引；旧退出超时根因仍unknown，历史通过不能覆盖后续源码。保留唯一owner及scope/generation/revision/readiness/CAS守卫，不以无兼容需求恢复旧测试专用实现。

设置 canonical 导航/返回已通过原生第14轮四项合同：Home首发/已有会话返回、rail Home、技能表单进入后新建清理；223原生IPC、零console/page/trace/mock，Main79440原15秒内正常退出，35源码/2828目录产物与sidecar前后零漂移。已修Composer owner建立与会话恢复竞态（红2/2后绿46/46），以及新路由误取消incoming service-skill（11/11）。标准GUI第4轮24/24、wrapper exit0；默认前端130/130批、exit0，1759个登记文件通过组合验收；原verify:local失败wrapper保留，最终收据 `.lime/qc/settings-sections/navigation-final-20261015-1/receipt.json`。本切片4/4（100%），整体GUI仍partial。1–13轮失败保留，旧退出超时根因仍unknown；搜索/dirty、完整结构覆盖、参考实时效果/live/Windows继续待办。详见[设置审计](./settings-navigation-audit.md)。

Memory配置与SOUL切片已关闭：第3轮新增6/6与原4/4、440 IPC、零console/page/trace/mock，Main54663正常630ms退出；43声明源码、2934目录产物与sidecar零漂移。28份声明文件及56份运行/验证/失败证据冻结于 `.lime/qc/settings-unsaved/final-20261015-1/receipt.json`。此前两轮分别为启动前rustup元数据等待终止与fixture在任务列表错误寻找会话行，均保留；产品源码未因fixture修正变化。整体GUI仍partial，修正笔记等独立表单未包含在首批保护中。

后续修正笔记独立验收已通过：最终原生第5轮四类离开不落盘、两个局部页签/配置Cancel保稿、单次显式addNote与public read完整Markdown读回，共6/6；653原生IPC与零console/page/trace/mock，同一Thread/Turn/Item且turnStart始终1。Main22858正常698ms退出，46原生源码/3039目录产物/sidecar零漂移。前三轮分别因目录路径、工作区菜单越界、错误的预绑定假设失败并保留；最后恢复正常选择与显式滚动，未修改产品菜单，第2轮越界根因仍unknown。默认整轮exit0，和上一切片的组合续跑明确区分。external backend不证明live/provider，原生未覆盖的失败/重复/在途/迟到由组件回归承接；完整设置与参考实时行为仍未交付。

Web Search 草稿保护进入独立切片（2026-10-16）：复用已确认的requestNavigation/pendingNavigation与继续编辑/放弃合同，拆分页面、编辑生命周期、配置投影/合并及四个展示页签，删除内联整份Config保存副本。只合并用户编辑字段，覆盖原始不完整输入保稿、在途字段版本、失败/重复/迟到和五语言；定向5 suite 80/80、严格lint与typecheck通过，默认verify:local整轮exit0，130/130批、1764文件、contracts和标准GUI24/24通过；真实Electron首轮整轮exit0，Web Search 6/6、849 IPC、错误/mock均0，同一Thread/Turn/Item且turnStart始终1，Main54930正常358ms退出。57原生源码/3145目录产物/sidecar零漂移，freshness ready；收据`.lime/qc/settings-web-search/final-20261016-1/receipt.json`。尚未确认参考同名Web Search原符号，不把这些职责名写成恢复名，也不宣称live搜索或全设置覆盖。笔记Save按钮的压缩换行在本轮修复，原生几何72×32、内容高16等于行高且无水平裁切，截图复核通过；只证明此窗口宽度。此切片100%，整体GUI仍partial，其他表单与内容搜索继续待办。

Environment 草稿与保存切片已验收（2026-10-16）：沿用匹配REA设置导航合同，拆出编辑生命周期、纯字段合并、预览和展示owner，页面1015→598行，旧整份Config副本/内联保存重读/名称key已删除。定向4suite51/51、默认前置+前端续跑131/131批（1766文件）+contracts+标准GUI24/24组合通过，原wrapper失败保留。原生第5轮整轮exit0，四路可见导航与保存/重开/恢复5/5，主题投影4/4；1058 IPC、错误/mock均0，同一Thread/Turn/Item且turnStart始终1，Main40864正常918ms退出，64源码/3566目录产物/sidecar零漂移。收据`.lime/qc/settings-environment/final-20261016-3/receipt.json`保存原生四轮失败与新验证；更早QC产物已清理丢失，不能冒充仍保留。New只具组件证据（设置壳无当前入口），system使用媒体模拟，仅当前皮肤/窗口；原表单符号、live Shell导入、Windows、安装包和完整设置仍未验，整体GUI保持partial。Execution Policy后续实现与验收独立记录。

Execution Policy已验收（2026-10-16）：页面1215→420行，草稿、纯字段合并、规则编辑和来源展示分离；删除整份Config/agent副本、内联保存重载和固定浅色样式，接共享导航/配置authority。只合并用户编辑字段，失败、语言切换和在途新编辑不清稿。定向5suite51/51、证据护栏9/9、默认前置+前端续跑131批（1768文件）+contracts+新标准GUI24/24组合通过；第112批原5秒超时及wrapper exit1保留，原文件3/3复验、续跑通过，未改期限/状态。原生导航第2轮exit0，5/5、规则CRUD/完整配置保持与四主题4/4通过；1291 IPC、错误/mock0，同一Thread/Turn/Item且turnStart始终1，Main589正常1050ms退出，75源码/3777目录产物/sidecar零漂移。规则控件文字最低对比度11.1087，四张截图复核通过。冷启动第2轮exit0、32/32，真实IO独立probe、安全GUI错误/保稿/Save重试和两次冷重启读回，Main793/303/445ms正常退出；76 IPC、3次GUI保存确认、4次写入请求，错误/mock与强制回收0。旧fixture及重复/冲突文档随同清理，收据`.lime/qc/settings-execution-policy/final-20261016-1/receipt.json`保留失败原件。原表单符号unknown；New/诊断仅组件证据，system为媒体模拟且仅当前皮肤/窗口，工具执行/live/Windows/安装包/参考实时与完整GUI仍未验，整体partial。Profile后续验收独立记录。

Profile草稿与持久化安全合同已验收（2026-10-16）：页面892→381行，独立生命周期/纯字段合并/展示owner复用既有updateConfig与useSettingsDraft；失败、在途新输入、语言切换和迟到响应不丢稿。删除完整Config覆盖、提前清稿、原始错误插值、消息timer和无实现头像上传及8文案/旧正向测试。有效DOM红例5失败/1通过；定向4suite56/56、翻译2suite11/11、strict lint通过，默认verify:local整轮exit0、131/131批（1770文件）、contracts与新标准GUI24/24通过。原生导航9/9（行内/Tag四路加保存/重开/恢复）、四主题4/4单列，1635 IPC、错误/mock0；同一Thread/Turn/Item、turnStart始终1，Main62813正常退出，83源码/3883产物/sidecar零漂移。冷启动第2轮exit0、32/32，171 IPC、错误/mock0，真实IO独立probe、GUI安全错误/两类保稿/重试和两次冷重启读回通过，三次Main正常退出且强制回收0。首轮缺少forcedCleanup组装字段的失败原件保留；最终从真实teardown派生，没有修改护栏或期限。收据`.lime/qc/settings-profile/final-20261016-1/receipt.json`。

REA补证已确认公开ProfileSettings/ProfilePage及CME导出、共享core/Layout委托、displayName/bio与profile_details/username、codex capability/visibility/eligibility gating。7个Profile成员完整性已核，core语义受100000节点上限partial/truncated；静态分析不证明运行。Lime Tag/完成度/email的保留依据未建立，仅保留主题、多模型、首页Banner三项例外；下一刀优先Profile内容/布局/数据入口与可见性。导航external backend与冷启动unavailable backend分别报告；New仅组件证据，current皮肤1440×1000、system媒体模拟，参考实时/live/账号/Windows/安装包/全GUI仍partial，分母未枚举。

Profile内容下一阶段已完成只读数据追踪：包内core的两个依赖导出指向账号scope的profile page query与资料mutation；经11MB member完整性校验、5个精确字节段与REA子集补证，确认GET自己/username page、V2 PATCH display_name/description与is_self缓存更新，core另外门控账号身份、preview/can_edit及字段长度。没有执行参考代码或生产HTTP，子集141 semantic unknowns/共享HTTP与上传依赖未闭合。Lime当前local config与OEM session缺少同义page/bio/pins读写合同；下刀应先收敛真实能力/认证入口再迁共享布局与字段，删除无保留依据的本地卡片，不能靠同名或新flag宣称等价。该只读阶段未改产品；随后本地字段迁移见下，草稿安全收据保持冻结。

Profile本地内容合同已验收：ProfileSettings → ProfileContent → ProfileLayout / ProfileFieldEditor；内部名称为Lime职责名，不冒充上游未恢复符号。displayName/bio显式映射本地nickname/bio，非空名称trim、64/140与bio换行归一化同时由DOM和保存入口守住。旧Tag/完成度/头像/email/用途卡及三份presentation、TS/Rust退役字段、五语言旧键/正向测试/fixture选择器已删除，compat/deprecated新增0。

恢复后重新执行的定向7suite67/67、Rust配置129/129（含实际编译的退役字段JSON/YAML回归）、完整contracts、typecheck和strict lint均通过。

最终1.159.0标准GUI `standalone-shell-01-20261016160123-87137` 24/24；真实原生导航 `settings-profile-content-recovery-20261016-3` exit0，名称/简介×四路导航加保存/读回/重开/完整配置保持恢复共9/9（100%仅本地字段合同），四主题4/4另列。732px、嵌套滚动0、横向溢出0与DOM64/140检查通过；1627 IPC、console/page/trace/mock0，同一Thread/Turn/Item且turnStart=1，Main正常退出。冷启动 `settings-profile-content-recovery-cold-20261016-1` exit0、32/32，165 IPC、错误/mock0；双字段分别真实IO失败保稿/重试、两次冷读回、完整配置保持恢复和三次Main正常退出通过，独立RPC probe不冒充GUI响应。27声明源码/83原生源码/531目录产物和只读版本上下文后验无漂移，两份资源清单与实际sidecar SHA一致且均为1.159.0，freshness前后ready。7张最终截图人工复核，仅当前皮肤1440×1000；system为媒体模拟。新日志即时双份保存。

删除前已观察到默认前置检查、全量前端自动续跑131/131批（1770文件）、workspace --lib39组7121通过/0失败/5项既有ignored，以及标准GUI24/24通过；三个verify:local wrapper的exit1分别来自原5秒CLI超时、旧Codex feature正向护栏和并行message.rs拆分后的扫描名单遗漏，后两处护栏已按current语义迁移。随后外部整体删除.lime，使本轮这些成功/失败日志、smart state、早期原生原件和清理记录丢失；该部分只能作为历史观察，不伪造原件、不声称新定向等于全量重跑或wrapper exit0。三份旧冻结Profile草稿、Profile数据追踪与Execution Policy收据由独立备份恢复，SHA未变。

仅本地字段内容与安全持久化合同关闭；本地Config不是公共Profile服务。单独账号会话卡、远端GET/PATCH、eligibility/preview/is_self/can_edit、username/pins/upload仍gap；New仅组件证据，external/unavailable backend不证明live/provider/tool。参考运行、Windows、安装包和全GUI未验，整体partial且分母未完整枚举。 新收据 `.lime/qc/settings-profile/content-final-20261016-recovery-1/receipt.json`。
