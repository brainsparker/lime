# Profile Help 与 KeyboardShortcutsDialog 审计

状态：current。日期：2026-10-20。目标为 Codex Desktop 26.1007.30912，安装位置 `/Applications/ChatGPT.app`，Bundle ID `com.openai.codex`。本报告区分安装包静态事实、Lime 源码事实及后续实施要求；静态分析没有执行应用 bootstrap，也不证明当前账号实际显示或触发全部分支。

## 目标与证据身份

ASAR：`/Applications/ChatGPT.app/Contents/Resources/app.asar`，SHA256 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。本轮再次读取安装包核对摘要。

| 证据 | 范围与原件 |
| --- | --- |
| `ev_06897fd3c273c7d856bbe452f07615486591d2ce1bdceac0a1cac5cd1101f28d` | 账号原分析，4 输入、57716 bytes、18972 AST、parse failures 0；[完整原件](../../exec-plans/artifacts/codex-sidebar-20261020/account/rea-evidence.json)、[来源清单](../../exec-plans/artifacts/codex-sidebar-20261020/account/source-manifest.json) |
| `ev_2794bc48b6aad502831f640f28243e0e73581e496848799785dbed0e32ea8b60` | 同一原分析的只读 summary projection，无新产品行为证据 |
| `ev_239bec2aefd37970eb55084dcc0bc983997b19ea6dc17efef692017787a7f1fb` | Help/Dialog 聚焦 REA，25 输入、21330 bytes、6234 AST、114 findings、parse failures 0；[完整无截断 JSON 的 gzip](../../exec-plans/artifacts/codex-sidebar-20261020/account/help/rea-evidence.json.gz)、[完整性清单](../../exec-plans/artifacts/codex-sidebar-20261020/account/help/evidence-manifest.json) |

聚焦证据 semantic coverage 为 `unknown`，1277 个 semantic unknown；`truncated=false`，omitted nodes/relations 均为 0。未压缩 JSON 为 7854129 bytes，SHA256 `bda03c529d3d7a0bba591cdfb8af9eefcb63a3573d3f00710dca61f08d2145a8`；gzip 为 1306905 bytes，SHA256 `bbee59ccf7d6bec9e09731f07e877364c4e5ad5321bb91c95a7cc340336958c0`。完整证据已保全，不能用 REA 的成功解析替代未解析语义或运行观察。

| ASAR 原成员 | bytes | SHA256 |
| --- | ---: | --- |
| `webview/assets/profile-dropdown-items-d842ad78cd70.js` | 46587 | `a9a1c931a669cd467ca739c191be192d35be131fb8f1cefd212e150818f19758` |
| `webview/assets/app-initial-6350d04672d0.js` | 11440241 | `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f` |
| `webview/assets/keyboard-shortcuts-dialog-a55e88bf0464.js` | 9349 | `7fd3612c2b050f1b7559498618ddf0dfcc417881a3eb2c467225fa22feae8fe2` |
| `webview/assets/keyboard-shortcut-command-order-5bd6c0ca8f64.js` | 2772 | `d89594758faaf94f01ee63010bd59d0ad1fc22dfcfae6e09ac800e92263b9ae0` |

精确声明、carrier SHA、UTF-16 与 byte 范围、15 个实际 export alias 见 [source-manifest.json](../../exec-plans/artifacts/codex-sidebar-20261020/account/help/source-manifest.json)；原 profile/dialog 函数范围见 [symbol-ranges.json](../../exec-plans/artifacts/codex-sidebar-20261020/account/help/symbol-ranges.json)。所有范围均为原成员上的半开区间；byte 与 UTF-16 不混用。提取 JS 不得格式化。

## Help 菜单的已证调用链

`Yi` 的实际导出名为 `ProfileDropdownItems`。footer 分支经 `Yi → Wi → Pi → Fi → ki`，Settings 后插入分隔线和 Help。`ki` 使用 `FlyoutSubmenuItem`，`alignToParentBottom=true`、opaque surface、menu width。三个基础入口为 What's new、User guide、Keyboard shortcuts，不依赖账号认证 gate。Chrome extension 入口依赖 gate `410065390`；mobile/remote 入口依赖 ChatGPT auth、visibility/loading/setupCompleted。后两项没有 Lime current capability，不能仿造空入口。

What's new 经 `ki → wi`。非英文或 locale 尚未加载时是普通菜单项；`Hws → uq` 仅允许已加载且规范化为 `en` / `en-*` 的 locale 进入最近更新子菜单。英文路径最多展示前三条及 Full changelog，单条通过 `Rws` lazy 打开实际导出 `ChangelogModal`；完整更新记录仍调用 `Ii`。feed 为 `https://learn.chatgpt.com/docs/changelog/codex-app.json`，credentials omit、校验 response origin、schema parse、5 分钟 stale/refetch、retry 2；last-seen key 为 `electron:last-seen-changelog-release-family`。这些是 OpenAI 服务合同，不能直接复制为 Lime 服务。

`Ii → Dn` 打开 `https://developers.openai.com/codex/changelog`；User guide 经 `Li → Dn` 打开 `https://learn.chatgpt.com/docs/quickstart`。`Dn` 实际 import 为 `PEn`，initial 真实 export 为 `ZO as PEn`，调用继续 `ZO → Oyn → QO → Ho.dispatchMessage("open-in-browser", {url, …})`。调用处没有显式 `openTarget: external-browser`，且 `Oyn` 包含处理器拦截、modified click 与 openTarget policy；仅据该静态链不能断言最终必定是系统浏览器。

Keyboard shortcuts 的正确链为 `ki → Ai → Zt("showKeyboardShortcuts", "sidebar_help_menu")`。profile 的 `Zt` 实际 import 为 `BBn`，initial 真实 export 为 `Mw as BBn`。`Mw → Lqt` 逆序查 active normal/fallback handlers，再查 base map；`q9s` 用 `Pw("showKeyboardShortcuts", handler)` 注册 toggle state，state 为真经 `$9s` lazy import `KeyboardShortcutsDialog`。菜单与默认 `CmdOrCtrl+/` 属于同一 command。

`q9s` 是持有自己 React state 的独立组件，原件见 [initial-q9s.js](../../exec-plans/artifacts/codex-sidebar-20261020/account/help/input/initial-q9s.js)；它不属于 Profile/Footer 生命周期。因此 Lime 的全局注册不能绑定 Footer 挂载。这里确认的是静态组件边界，不将压缩名 `q9s` 作为原始开发组件名。

前一轮“Help shortcuts fallback 打开 `/settings/keyboard-shortcuts`”的推断已纠正：该设置路由的 `Xqt` 属于另一条 `keyboardShortcuts` command；base map 不含 `showKeyboardShortcuts`。当前实施只以独立 Dialog 的链路为准，不保留相矛盾的设置页要求。

## Dialog 的数据与生命周期

实际模块导出为 `Ae as KeyboardShortcutsDialog`。`Ae` 在 product mode `work` 时 lazy 转到 `ChatGptKeyboardShortcutsDialog`；该分支尚未进一步分析，标记 unknown。其他模式进入 `je`。

`je → De` 从 `bP` 合成的 webview、vscode-only、electron-only catalogs 生成条目，经 `v6n` 去除 vscode-only 与不可配置命令，再按能力、gate、platform、access、modeSwitch handler 等条件过滤。`Z6n` 的 keymapState 未加载时展示 loading。`K6n → D6n → O6n` 优先采用当前 keymap bindings；`null` 表示解绑，否则取 catalog 默认并处理平台、冲突和 number target。webview 命令若 base handler 不存在且注册 metadata 数量为 0，则不显示。

base owner 为 `Iqt → uJt.has`；active registration metadata 为 `Nqt`，`Pw → Pqt` 随 mount/unmount 维护 dJt handlers 与 metadata。keymap query owner 为 `TP` 的 `codex-command-keymap-state`，stale 为 1 分钟。Host keymap 的实际实现、OS 注册成功及当前账号有效键位不在本轮已证范围。

分组为 thread、navigation、panels、workspace、skills、configure、app、general，显示文案为 Chat / Navigation / Panels / Project / Skills / Configure / App / General。顺序由 `P6n` 与 command-order comparator 决定，组内有 newTask、temporaryChat、archiveThread、newProjectlessTask、openSideChat 优先项，其余按 ID。`Oe` 搜索 id/title/description，隐藏 personalitySettings，空组不显示。界面为宽弹窗、较高滚动正文、自动聚焦搜索、compact rows 和 shortcut label，区分 loading / empty / noMatches；不应落成固定说明列表。

| 原成员 | 符号 | byte 范围 | 已证职责 |
| --- | --- | --- | --- |
| profile | `wi` | `[10193,14061)` | What's new 普通/最近更新分支 |
| profile | `ki` / `Ai` | `[14249,17719)` / `[17719,17781)` | Help 子菜单 / showKeyboardShortcuts dispatch |
| profile | `Pi` / `Fi` | `[17991,18330)` / `[18330,19064)` | capability gate / callback 接线 |
| profile | `Ii` / `Li` | `[19064,19136)` / `[19136,19208)` | changelog / guide URL |
| profile | `Wi` / `Yi` | `[19470,24142)` / `[25602,43805)` | footer 分支 / ProfileDropdownItems |
| initial | `Mw` / `Lqt` | `[1498075,1498119)` / `[1498211,1498439)` | command dispatch / handler 查找 |
| initial | `Pqt` / `Pw` | `[1497826,1498075)` / `[1501107,1501954)` | handler 与 React registration lifecycle |
| initial | `q9s` / `$9s` | `[9490057,9490318)` / `[9490363,9490725)` | Dialog state handler / lazy import |
| initial | `TP` / `K6n` | `[2753087,2753915)` / `[2752348,2752612)` | keymap query / binding selector |
| initial | `D6n` / `O6n` | `[2747260,2747700)` / `[2747700,2748746)` | 默认及当前 binding 解析 |
| initial | `ZO` / `Oyn` / `QO` | `[2094508,2094545)` / `[2094575,2095519)` / `[2095519,2096057)` | URL policy 与 Host message |
| dialog | `De` / `Oe` | `[1624,1914)` / `[1958,2198)` | 当前命令条目 / 搜索 |
| dialog | `Ae` / `je` | `[2371,2564)` / `[2564,4510)` | KeyboardShortcutsDialog / 非 work Dialog |
| dialog | `Pe` / `Le` | `[4597,6383)` / `[6746,8769)` | command 分组过滤 / Dialog 视图 |

只有 `ProfileDropdownItems`、`KeyboardShortcutsDialog`、`ChangelogModal` 等实际 export 可作为上游名称；其余压缩符号不冒充原 TypeScript 函数或类名。新 registry/helper 使用简短 Lime 职责名。

## Lime current owner 与最小迁移

审计时账号入口在 `ProfileDropdownItems.tsx` 与 `SidebarProfileFooter.tsx`，尚无 Help 子菜单。外链复用唯一 current 链 `openExternalUrlWithSystemBrowser → safeInvoke("open_external_url") → SystemUtilityHost.openExternalUrl → shell.openExternal(normalizeExternalUrl(url))`；无需新增 Host/IPC/JSON-RPC。

| Help 项 | Lime URL / owner | 最小接线 |
| --- | --- | --- |
| What's new | `https://github.com/limecloud/lime/releases`，现 AboutSection fallback | 收敛到共享 product links；About 与 Help 共用，不为点击触发 update check，不假造 feed/ChangelogModal |
| User guide | `https://limecloud.github.io/lime/`，docs/nuxt.config.ts 与 docs/app.config.ts 声明的站点根 | 使用站点根；没有证据支持猜造 quickstart route。部署可用性未联网验证 |
| Keyboard shortcuts | active command registration/keymap owner | 独立 KeyboardShortcutsDialog；Menu 与 Mod+/ 调用同一 showKeyboardShortcuts；只显示注册、绑定且当前可用项 |

下表是**真实生产消费者的源码审计**，本轮没有在 GUI 执行这些快捷键：

| 生产注册 owner | 当前处理 | 迁移要求 |
| --- | --- | --- |
| `AppSidebar.tsx` window keydown | Mod+K 打开共享侧栏搜索 | 挂载/卸载与 handler 同一注册，迁走旧 listener，避免双处理 |
| `SettingsSidebar.tsx` document keydown | Mod+F focus/select 搜索；navigationPending 时不可用 | 可用条件与原输入 ref 同一 owner |
| `ComposerEditor.tsx` / `composerKeymap.ts` ProseMirror | IME、external hook、Enter/Shift+Enter、undo/redo、历史方向键、可选 Escape | 保留 PM/focus/sendOnEnter/composition 路径；本轮由 Composer owner 单独承接，禁止新 window listener 截断 |
| `NotionEditor.tsx` editor DOM capture | Mod+S flush/save，Escape 在 slash 未开时取消 | 维持 DOM target、capture、slash 条件与卸载 |
| `DocumentCanvas.tsx` window keydown | Mod+Z / Shift+Mod+Z undo/redo | 沿真实历史 owner 注册，按可撤销/重做状态显示；原代码无 focus gate，不能冒称已有条件 |

`src/lib/hotkeys/types.ts` 和 `platform.ts` 可复用。`WORKBENCH_SIDEBAR_TOGGLE_HOTKEY`、`resolveWorkbenchHotkeyAction` 仅定义而无生产消费者，不能注册假 Cmd+B。`DOCUMENT_EDITOR_HOTKEYS` / `DOCUMENT_CANVAS_HOTKEYS` 数组也无生产消费者；迁移以各自 resolver 的真实注册 owner 为准，不能从 metadata 常量制造 active 状态。局部 popup Escape / suggestion keydown 不自动变为全局命令。

实施顺序：现账号菜单加入 Help；收敛 product links；建立唯一 UI command registry，与真实 handler 共同注册/卸载并保留 binding/availability；Dialog 消费相同快照并提供搜索/分组/平台键位；迁走受影响的旧 listener 与死 metadata；补冲突、IME、取消/卸载、Menu 与键盘同路、五语言回归。不得新增第二业务后端或平行 keymap authority。

## 分类与验收边界

- current：匹配安装包的完整 REA Evidence、实际 export 映射、上述 Lime 生产 handler 与统一外链 owner。
- compat/deprecated：本切片不新增。已纠正的设置 fallback 推断退出 active 要求。
- dead：无消费者的快捷键 metadata 不得回流为假 active 列表；是否删除由实施调用图结算。
- unknown：Codex 当前账号/feature flags 的实际菜单与快捷键列表、work Dialog 分支、Host keymap/OS 注册、最终 URL policy、Lime docs 部署可达性、跨平台真实键盘及焦点表现。

## 本轮 Renderer 实施结算

`ProfileDropdownItems` 已加入 Help 的三个真实动作；Lime links 收敛到 `src/lib/productLinks.ts`，About 复用同一 releases URL。Help submenu 根据实际 parent menu、trigger、submenu 几何计算底部偏移，通过 ResizeObserver 与 resize 更新；Radix 的 `sticky="always"` 解除默认 limitShift 将 submenu 限制在单行 trigger 内的问题，仍保留 viewport collision 处理。

`src/lib/commands/registry.ts` 与 `useCommand` 负责同一 registration 的 handler、keydown target/capture、bindings、enabled 和卸载。Dialog 消费同一快照，不再另造 catalog；只列已挂载、有绑定且 enabled 的命令。CommandOrControl 与现 platform formatter 同源，mac 只接收 Meta，Windows/other 只接收 Ctrl；IME、defaultPrevented、多余 modifiers、背景 input/dialog 路径有确定性回归。

`AppShell` 唯一挂载 `KeyboardShortcutsDialogHost`，由 Host 注册 `showKeyboardShortcuts`、持有显示与返回焦点状态并 lazy 加载实际同名导出的 Dialog；Footer 只派发同一 command。Sidebar 与 Settings 切换保留全局 Mod+/，Footer 卸载不撤销命令，AppShell 卸载才撤销。Dialog 支持搜索、分组、平台键位、空状态与五语言；关闭恢复仍连接的原控件，原控件因导航卸载则返回当前 `AppShellContent`。旧菜单/弹窗的延迟 onCloseAutoFocus 不再夺走新显示层焦点，既有账号失败重试回归保持有效。`KeyboardShortcutsDialogHost` 是 Lime 的职责名；安装包未确认该 Host 的原始开发名称。

实际 handler 迁移包括根 Agent 持有的 AppSidebar Mod+K，以及本切片的 SettingsSidebar Mod+F、NotionEditor save/cancel、DocumentCanvas undo/redo。文档编辑保持真实 editor DOM capture 与 slash/readOnly 条件，画布 enabled 来自真实 undo/redo 历史状态。Composer 由其 owner 单独推进，没有注册未实现的 Composer 快捷键，也没有新增 window handler 截断 ProseMirror。

已删除四个 current 旧文件：documentCanvasHotkeys.ts、documentEditorHotkeys.ts 及各自 resolver 测试；有效风险迁入 registry、真实 Tiptap 和真实 DocumentCanvas 历史 owner 回归。无消费者的 Cmd+B 没有进入 registry。compat/deprecated 新增 0。

完整 Evidence gzip 与 25 个 input carrier、15 个 export binding 的完整性已校验。研究、实现及定向验证日志见[执行计划](../../exec-plans/profile-help-shortcuts-20261020.md)。本轮没有构建 Electron 资产；真实 GUI、跨平台和最终候选验证由根 Agent 接续，不将静态 REA 或组件测试提升为 Gate B，也不代表完整 GUI 对齐完成。

全局 Host 最终定向为 10 套 58 项通过，Renderer tsc、scoped strict lint、Prettier、docs boundary、legacy report 与 diff 检查通过。0 React act warning，0 Vitest unhandled；AppShell 既有工具栏组件产生 4 条 jsdom 22 不支持 CSS `@container` 的 parser error，未屏蔽，也不据 jsdom 结果宣称真实布局已验证。最终源码冻结和日志使用 `artifacts/profile-help-shortcuts-20261020/global-host-*`，此前 44 项记录保留为迁移前阶段证据。

## Escape 时序复核

真实 Electron 侧栏 r11 再次打开快捷键弹窗后，搜索 input 已获焦，但 Escape 未关闭弹窗；原失败保留。定向组件回归在第二次搜索获焦时立即派发 Escape，稳定复现旧实现仍显示 Dialog。该回归是本地故障证据，不是参考应用运行证据。

为确认参考的关闭 owner，REA 聚焦读取同一安装包 shared 成员的八个完整声明，Evidence `ev_183b9a095496351b7966b48f651c42155e2d244b13385b21e11d4b8fb2e01db3`。原成员 SHA `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245`；精确 UTF-16/byte 范围、未格式化声明和完整 Evidence 已打包至 [rea-records.tar.gz](../../exec-plans/artifacts/keyboard-escape-20261020/rea-records.tar.gz)，[完整性清单](../../exec-plans/artifacts/keyboard-escape-20261020/integrity.json)逐成员回读通过。8 输入、17526 bytes、5425 AST、parse failures 0，semantic coverage unknown、964 unknown，truncated false；未运行 bootstrap。

参考 `KeyboardShortcutsDialog → IT` 的 shared alias 实际是 `XMi`；经 `tNi → EDe.Content → BDe → VDe/HDe → UDe → N_` 进入 DismissableLayer。`UDe` 的 onDismiss 调用同一 Root 的 onOpenChange(false)。`N_` 仅在最高层安装 document capture keydown；Escape 先调用 onEscapeKeyDown，未 preventDefault 时再 preventDefault 并 onDismiss。层登记及 Escape listener 都使用 effect。全局 `q9s` 同样条件挂载 Dialog，不能据此改称参考采用永久挂载。压缩符号只作证据定位，不能用作源码命名事实。

本地 Radix 1.1.11 亦依赖 effect 登记 layer；搜索获焦与最高层登记刷新之间存在可确定性复现的关闭缺口。修复在现有 Dialog.Content 内处理尚未被消费的 Escape，调用同一 onOpenChange(false)；已由 Radix 处理的事件不重复关闭，没有新增 document listener、注册表或状态 owner。此处是 Lime 对现有组件库时序的修复，不声称参考有相同局部 handler 或已证明其运行时不会遇到该时序。2 文件 12 项回归通过，strict lint 通过；新产物真实 Electron 仍须单独验收。首轮修复测试先于第一次延迟焦点恢复就重开，导致返回焦点断言失败；测试已明确等原焦点恢复后再重开，保留原失败日志，不以延时或重试绕过关闭断言。

后继真实 Electron `codex-sidebar-20261020-r12` 已通过：三宽、浅深主题、Profile/Help、菜单打开后关闭、Mod+/重开与搜索获焦、Escape关闭及Settings返回路径、canonical回读和IPC断言。10张截图逐张查看，源/产物在运行内稳定、console/page错误均0、Main正常code0/signalnull。证据为macOS源码构建的受控read-model fixture，不涵盖provider执行、参考运行、Windows、packaged或整体GUI等价；后继并行Rust新字节须重新构建，不继承该候选的产品通过。
