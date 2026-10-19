# Files 本地菜单纵切

## 后继：真实 Open in 目标纵切（2026-10-20，生产冻结待 root 验收）

- 目标：按 REA `file-target-closure-20261020` 的同一 target query、detect/icon/open、普通选择不写偏好合同，扩展唯一 FileShellHost，接树、标签与已证面包屑按钮。
- 窄写集：`electron/fileShellHost*`、新 `fileTargets`/`fileTargetPreferences`；`hostCommands.ts` 仅初始化和委托，`ipcChannels.ts`；`src/lib/api/openIn*`、`agentCommandCatalog.json` 的 fileBrowserCommands、现 command guard 集；Files 菜单/action/query 与 FileSourceBreadcrumb、五语 workspace 新 keys、相关测试；本计划/研究报告与 architecture Files 段。避让 main/preload、generated App Server types、Rust、消息/Artifact 删除热区、主计划和 evidence-index。
- 原生事实：复用同一 SystemUtilityHost native client 的 `launchServices.urlHandlers` / `launchServices.bundleIdentifier`。Windows helper 无文件关联发现入口，只能提供已证系统默认/文件管理器；不把内建 catalog 当完整关联集合。无 native 重建、未知 helper 执行或引擎安装。
- 超长文件例外：`hostCommands.ts` 与现 `check-command-contracts.mjs` 只追加机械委托/集合项，领域逻辑全部在小模块；退出条件为不在超长文件增加发现、偏好、打开或校验业务逻辑。
- 退出条件：Host 原生发现/显式目标拒绝/真实 launch 退出结果、Host 原子偏好、typed gateway、共享一分钟 query/prefetch、菜单和面包屑路径/openMode及迟到保护完成；Node24 定向测试、scoped lint、renderer/Electron types/contracts收据保存。root 独立构建与 Desktop Gate B，不能以本轮静态测试宣称 GUI 完全对齐。
- 历史冻结保持原值，本轮建立新后继冻结；原 local-only 完成结论不扩张为完整 target/平台完成。

### 当前实现与清理

- 五个明文方法全部归 FileShellHost；同一 SystemUtilityHost 注入已交付 macOS native client，读取真实文件关联与默认应用，图标归现 app.getFileIcon，显式选择打开前再次复验，macOS 使用已证 open 参数数组和真实退出结果，Windows 只暴露已证 shell 入口。发现、支持入口与 readiness 分开；不把不可用 helper、缺失应用或未知 remote 路径伪造为 ready。
- global/perPath 归统一 appDataRoot 一个 Host 偏好值，串行原子保存；普通菜单选择不写，明确 preference path 成功后才写 global+perPath，全局设置只改 global。共享 query 保留 cwd/hostId/path/deferEnrichment，一分钟 staleTime，真实预取、detect/icon 与 abort 保护均使用同一缓存；图标失败不影响应用可用性。
- 树 file 行、原文件标签和已证面包屑按钮共用 wrapper、builder/action/query。树显示 disabled Open in，标签/内容等待 query；实际打开组后才放分隔线；面包屑正确区分 workspace/file，内容/标签 Reveal 继续同一 fileManager。原保存/flush、scope/tab身份与焦点恢复保留唯一 owner，未包整块编辑面。
- current：上述文件壳、typed gateway、共享 query 和既有文件读写/保存链。新增 compat/deprecated 为0。dead/deleted：旧 open_with_default_app IPC/Host方法/catalog/重复默认打开算法；现 openPathWithDefaultApp 直接委托唯一 openIn.open，旧命令只留负向测试与退役守卫。原 reveal/icon/HTML preview 仍有 current 消费者，未误删。
- architecture Files 图已更新，新增方向是 menu/query/gateway → 现 preload/IPC → FileShellHost → 同一 native client / Host偏好 / 真实launch，无 Agent新后端；当前等待 root 逐项确认，不先标记结构完成。

### 后继验证收据

- Node `v24.21.0`；基线 [24套242项](artifacts/file-targets-20261020/tests.log) 通过，含 Host/preload/gateway、偏好、实际参数与失败/迟到、原保存/标签/搜索/编辑器回归。最后 [受影响6套47项](artifacts/file-targets-20261020/final-consumers-r3.log) 全过，覆盖新增 loading/wait-before-open、条件分隔线和面包屑 Reveal；测试的 native/query 是显式 fixture，不计真实 OS 发现或 launch。
- [命令契约](artifacts/file-targets-20261020/contracts.log)、scoped lint、Renderer/Electron/Node types、docs boundary 均 exit0。初次 Renderer 类型失败仅来自并行发送链 shouldSendPermissionOverrides 漂移，原 owner 修复后复验通过；原错误日志保留。中间两项仍期望同步打开的测试已按真实 query 通知生命周期迁移，失败原件保留。
- 初次 format 只告警 hostCommands 的新增委托折行；root 授权纯格式后继后，[最终格式](artifacts/file-targets-20261020/format-r2.log) exit0。业务源码初始 [23文件冻结](artifacts/file-targets-20261020/source-freeze.json) 保留，纯格式差异精确只有 hostCommands 一项；当前 [后继冻结](artifacts/file-targets-20261020/source-freeze-r2.json) SHA256 `7b75c415c4b6e2453e6eef02e2691e49331fc22c95b60f777139092ecd94e299`，[源码漂移](artifacts/file-targets-20261020/source-drift-check.json) 0/23。完整日志 SHA/退出码见 [validation.json](artifacts/file-targets-20261020/validation.json)。
- 本 Agent 未构建、未启动 Electron、未重建 helper、未执行 Codex 原件、未改 Rust/schema/generated types。root 的 right-surface-visual-matrix 经 thread-side-panel-new-tab-scenario 消费 workspace-file-menu-fixture；其旧 exact 两项断言/收据需迁移为真实 primary/Open with + 条件分隔线 + 原保存/复制，标签另含真实 fileManager Reveal；迁移点已交 root，本 Agent 未改 fixture。
- 该纵切实现与定向/契约验证100%；结构确认、真实 Electron/preload/IPC/native/runtime 用户可见链与标准 GUI smoke 待 root独立结算。完整 Files/GUI 对齐仍未完成：editor/custom target、Windows关联集合、remote transport、平台 localized displayName、Copy contents、GitHub/library/Add to chat 和其它已证内容消费者保持明确缺口，不以本地 marker或截图代替。

以下为前驱历史冻结状态：本地实现与定向验证完成；真实 Desktop Gate B 由 root 统一结算。前驱搜索树8套54项与source-freeze保持原记录，不覆盖。后继目标实现以本文开头及后续验证收据为准。

## Verification Contract

- 参考：REA58树/正常搜索消费者与wrapper、REA59实际菜单builder；精确入口与剩余限制见 file-tree-interactions-audit-20261020 研究报告。
- 主链：唯一FileTree native composedPath file-only / 既有file tab实例 → 共享本地action owner → Copy path，或同一FileTabLifecycle.saveUntilClean / 既有文档flush → 现save dialog → current App Server copyFile。无新后端、协议、文件store。
- 可见结果：本地Copy path；有真实native save能力时Save as。无目录菜单、rename、多选、假Open in/GitHub/library/AddToChat/整块content菜单。
- 时序：tab实例替换、root/query变化、菜单换目标、关闭卸载及保存/对话框迟到均拒绝后续外部动作；菜单关闭本身不能取消用户刚选中的保存动作。
- 写集：FileTree、RightSurfaceTabStrip；新增菜单wrapper、items与action hook；现FileTabLifecycle context/provider/closeGuard与TextFileEditor/HostRuntime最小接线；五语workspace.json；定向测试与本计划/研究/新artifacts；architecture仅既有Files段，交root复核。
- 静态菜单无真实异步query，因此不造prefetch空函数；明文getWorkspaceFileTabContextMenuItems为唯一标签builder，target-query及其prefetch继续gap。
- 先冻结生产源码并告知root可构建窗口，再独立补行为测试/文档与静态验证；本Agent不构建、不跑Electron、不碰root fixture、主计划或evidence-index。
- 必验：真实DOM右键/Shift+F10/ContextMenu、目录拒绝、键盘激活、真实path、五语、capability、剪贴板/保存失败、flush先于对话框、tab与scope迟到、既有目录/搜索/viewport/tab/编辑lifecycle回归；Renderer tsc、scoped lint/format/docs/diff。

产品进程验收由root统一执行；本切片不能宣称完整Files菜单/GUI对齐。

## 实现与清理

- `FileTree` 与真实文件标签委托唯一 `WorkspaceFileContextMenu`；树只接受 native composedPath 的 file 行，保留原键盘、viewport、sticky 与 preview owner；目录/空白不开放文件菜单。
- `getWorkspaceFileTabContextMenuItems` 与树 builder 共用 `useWorkspaceFileActions`。原生保存能力可用时依次 Save as、Copy path；浏览器仅 Copy path，文案覆盖五语言。原生 target query 未实现，不创建空 prefetch 或固定 app 菜单。
- 现 `FileTabLifecycle` 从单一 register 值迁为同一 lifecycle 对象，现消费者全部直接迁移，tabStrip 与内容共享实例。Save as 顺序为同一文本 saveUntilClean、现文档 controller flush、现 save dialog、同一 App Server copyFile；原 dirty close guard 和内容身份保持唯一 owner。
- root/query、菜单目标、同路径标签新实例及卸载拒绝迟到动作；同一 handler 在保存期间被替换时旧保存结果失效。保存失败保留编辑，取消不复制，剪贴板/保存错误使用现五语公共错误出口。
- current：上述唯一菜单、tree/tab/lifecycle、现保存与复制 owner。新增 compat/deprecated 0；本轮无可删的旧 Files 菜单模块，不为清理虚构 dead 文件。前驱平面搜索列表与重复 renderer 已删除，历史冻结保留独立归属。
- architecture.md 的 Files 本地菜单图与共享保存身份已由 root 逐项读取并确认；没有新协议、后端、网络或业务 store。

## 验证与证据

- [生产冻结](artifacts/file-menus-20261020/source-freeze.json)：15 文件，SHA256 `242379e949b71fdd57c71068557104564c5b72add37a7e8f89b79f67dc8cf5d6`；冻结后仅新增测试/文档/收据。最终 [source drift](artifacts/file-menus-20261020/source-drift-check.json) 为 0/15。
- 初始既有接线 4 套 29 项通过。新增菜单 DOM、共享动作和生命周期 3 套 33 项通过；Radix 关闭后 focus scope 下一任务恢复焦点，测试等待该实际生命周期，无需变更生产代码。
- 最终 [16 套 127 项](artifacts/file-menus-20261020/final-tests.log) 全部通过，含前驱54项、五语/原生能力、真实路径与标签菜单、键盘与焦点、保存顺序/失败/取消/迟到、原编辑草稿/preview/tab/close、usePublicFileAction/saveFileCopy；零 act warning 和 unhandled。
- scoped ESLint、Prettier、docs boundary、legacy report、diff check 通过；legacy report 的零引用、分类漂移、边界违规均为0。完整收据见 [validation.json](artifacts/file-menus-20261020/validation.json)。
- 本 Agent 初次 Renderer tsc 仅失败于他人热区 useInputbarSend.ts:429/433 的 triggerSource widened string；已通知 root，原 owner 修正。现原 owner 修复后，root 完整 Renderer/Node 类型检查 exit 0，日志 root-types-final-r12.log 已保全；原初次失败保留，未改写。
- root 标准 `npm run verify:gui-smoke` exit 0，run_id `standalone-shell-01-20261019205845-49442`，日志 root-gui-smoke-final-r11.log 已保全；该 shell/init/reload/responsive/memory 验收不能代替 Files 专项菜单矩阵。
- root 已接线 `scripts/electron/lib/workspace-file-menu-fixture.mjs`：目录右键拒绝、文件右键与 Shift+F10、真实 path data、exact Save as/Copy path 顺序、系统剪贴板 readback 与同文件标签右键合同。当前该场景为 **not-run / 未结算**，脚本接线与127项均不是 Gate B；原生 Save dialog、完整 target/Open with、OS/remote 不在该脚本已证范围。

本地实现与 unit/component 验证完成度100%；Desktop 运行验收待 root 独立结算。完整 Files 菜单/结构与 GUI 全面对齐仍未完成：target/readiness/preference/query/prefetch、标签 Copy contents、内容 wrapper 实际挂载、GitHub、library、Add to chat 与 remote/OS 观察保持 gap。
