# Codex 侧栏分组与密度

状态：active / product-verification-pending。责任开发者：sidebar alignment worker。日期：2026-10-20。

## Verification Contract

- 目标：在现有侧栏 read model 内对齐分组、独立分页、折叠、排序和基础行尺寸；主题、多模型、首页 Banner 保留。
- 参考：`/Applications/ChatGPT.app`，实际 Bundle ID `com.openai.codex`，26.1007.30912。2026-10-20 重新计算整包 ASAR SHA256，结果 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af` 与保留 REA 一致。
- current owner：`useAppSidebarSessions` 获取 canonical 会话；`AppSidebarConversationShelf` 分组后分页；`AppSidebarProjectConversationGroups` 限制项目数量并保留当前项目；`AppSidebarSection` 和 `useSidebarSections` 只拥有显示折叠、拖放/键盘排序与本地偏好，不存储 Thread membership 或业务事实。
- 输入与结果：Projects 首屏最多 5 个项目；Recents 首屏最多 10 条独立会话；Pinned/项目数据不消耗 Recents 显示预算。当前项目/会话超出窗口时保留可见。更多操作继续沿现有 catalog 查询和 canonical 导航 owner。
- 风险：全局分页先截断使 Pinned/项目/Recents 互相挤占；大量项目响应阻止继续读取 global catalog；折叠、排序重建 thread identity；过期测试把项目会话当作 Recents。
- 失败终态：失效/不可用的偏好存储不隐藏 canonical 数据；拖放未知 section key 不改变分组；加载失败继续沿既有 owner 处理，不新增 mock/fallback 后端。
- 验证：定向 component/hook/分组回归、对应旧分页测试迁移、strict lint、受影响 types；真实 Electron GUI smoke 与多尺寸画面由 root 统一执行，未取得新字节证据前不称 GUI 完成。

## REA 合同与限制

1. `sidebar/inert-subset/initial-nSs.js`：Projects/Pinned/Recents 使用 `g2` 的 collapsed/onCollapsedChange、titleActionsOnHover 和 sectionReorderDnd；Projects 的 `maxItems:5` 限制项目列表，Recents `maxItems:10` 独立分页。custom sections 是实际 `Vys` 分支，继续保留。
2. `sidebar/exact-fragments/navigation-metrics.css`：基础行 30px、radius 10px、水平 padding 8px。36px 来自有条件的 ConversationSidebar override，本切片不猜测其 runtime flag。
3. 以上 parent REA 为 `ev_0d32cbac7d5e943a3dc16c798513bb3eaede212d475bb2d3978f4242182128ce`；Rail/contextual 补证为 `ev_ae91adc4fca524b34a183b550a9641a0be0794f621774d96b8c68457934fc090`。精确原件范围、SHA 和完整 Evidence 见 `artifacts/codex-shell-layout-rea-20261018/sidebar/`。
4. 新增本地组件/hook 名称是职责命名，未冒称恢复了上游压缩函数的 TypeScript 原名。原生拖放与 Alt+ArrowUp/Down 是现有包内分组排序合同的本地 surface 适配；没有恢复上游 DnD 库的完整传感器/动画合同。
5. 偏好键 `sidebar-section-preferences` 是 Lime 显示适配键，未冒称参考持久化键。默认按 Projects、Pinned/custom、Recents 展示；用户排序后保留其选择。参考 runtime 的实际分组顺序、所有权限/flag、项目展开子列表和 Windows 运行情况仍未知。

## 写集与分类

写集仅 `app-sidebar/AppSidebarConversationShelf.tsx`、`AppSidebarConversationShelf.styles.ts`、`AppSidebarConversationRow.tsx`、`AppSidebarProjectConversationGroups.tsx`、`useAppSidebarSessions.ts` 的分组分页部分、`sidebarSessions.ts` 的 dead 聚合截断函数，以及两个新增 presentation owner 和对应定向测试。`AppSidebar.conversations.test.tsx` 只迁移“最近分页”测试段。

不触碰 root 持有的 `AppSidebar.tsx`、`AppSidebar.styles.ts`、`AppSidebar.constants.ts`、共享 testFixtures、conversationImport 协议/Rust/资源清理。没有 commit、push、分支或外部仓库写入。

- current：canonical catalog/read model；分组后独立分页；统一 section presentation。
- compat/deprecated：新增 0。
- dead/deleted：分组前合计截断；`splitSidebarSessionResult`；项目会话冒充 Recents 的旧正向断言；常驻分组操作显示。
- pending：真实 Electron 产品证据由 root 统一验证。整个 GUI 仍 partial。

## 本切片验证结果

- 定向回归：8 文件、70 项全部通过，覆盖独立预算、当前项目/会话保留、折叠/排序持久化、拖放未知源、global catalog 下一页和原有侧栏搜索/项目行为。
- Strict ESLint：本切片 10 个源码/新增测试文件通过。
- `git diff --check`：本切片 tracked 写集通过；Prettier 对源码/新增测试检查通过。
- Renderer `tsc --noEmit --project tsconfig.renderer.json`：首次退出 2，仅报 root 写集 `AppSidebar.tsx:480` 的多余参数；root 已告知修复，将统一重跑类型检查。本切片未修改该热区。
- 原有 `AppSidebarConversationRow.test.tsx` 存在 React act 环境 warning，两项测试通过；新增测试已声明 act 环境。
- 真实 Electron、preload/IPC、App Server JSON-RPC、runtime/read model 与用户可见状态尚未在本切片重跑，不以 component fixture 声明 Gate B 完成。

实现退出条件已满足；产品验收继续归 root。需核对新 renderer 下 5 个项目/10 条 Recents、折叠后数据恢复、排序和 hover actions，并确认多尺寸侧栏布局。

## 真实 Electron 侧栏补证

状态：fixture-implemented / waiting-for-current-artifacts。root 授权新增窄脚本，不触碰 renderer 或共享 launcher。

- 写集：`scripts/electron/sidebar-layout-fixture-smoke.mjs`、`scripts/electron/lib/sidebar-layout-fixture-evidence.mjs`、对应 smoke 测试和本计划。
- 真实链：隔离 Electron userdata -> preload/contextBridge -> `electron-ipc` -> `app_server_handle_json_lines` -> typed current `workspace/ensure`、canonical `thread/start`、`thread/name/set`、`thread/list`、`thread/read`、`thread/section/move`、`threadSection/create/list`。
- 数据：当前 API 创建 7 个项目、7 个项目会话、14 条独立 Recents、1 条 Pinned 与 1 条自定义分组会话；不直接写 DB，不启动 Turn，不调用 provider，不读取用户凭证，不设置 renderer 或生产 mock。
- 用户闭环：Projects 5/Recents 10 各自计数与 canonical membership -> 分组折叠 -> 键盘排序 -> reload 恢复 -> 展开恢复 -> hover actions -> 960/1280/1440 三宽、浅深主题 -> 52px rail -> footer 账号菜单真实 right/end 几何 -> 设置导航 -> canonical readback。
- 身份：保存源码 SHA、dist/dist-electron/client 产物树 SHA、实际 sidecar SHA、RPC request/response identity、Thread/Section identity 与尺寸；不写完整 config、token、prompt、路径或完整 trace。仅使用隔离 fixture 截图。
- 生命周期：仅控制本脚本创建的 Electron 和临时目录，正常退出使用既有 `settleFixtureResources`，保持 15 秒上限；失败清理由既有 owner 处理，仅可回收自身进程。不会 attach 用户窗口、停止其他进程或重复构建。
- 离线验证：12 项 fixture oracle 测试、strict ESLint、`node --check`、`--help` 和 Prettier 通过。最终脚本小改动后定向复跑。
- 运行命令：`node scripts/electron/sidebar-layout-fixture-smoke.mjs --run-id codex-sidebar-20261020-r1`。产物默认 `.lime/qc/gui-evidence/sidebar-layout/<run-id>/summary.json` 和 8 张截图。
- 门禁：启动前/后只 inspect 真实构建 freshness，不调用 ensure/build，不使用旧产物。root 的 renderer/host/sidecar 构建完成通知前不运行。尚无本次 Electron 成功证据，不能以脚本实现或离线结果关闭 Gate B。
