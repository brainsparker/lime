# Experimental 手动草稿保护

状态：implementation complete / awaiting parent GUI integration validation。
日期：2026-10-18。

## 目标与唯一 owner

接续 [GUI 缺口清单](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md) 优先 2。将 Experimental 页面内原有配置状态、加载和 mutation 直接移到 `useExperimentalSettingsState`，由该 hook 继续独占本页配置状态；页面保留诊断动作与展示，不保留第二套草稿。原 953 行页面缩到 740 行。

草稿护栏复用现有 `useSettingsDraft -> SettingsDraftContext -> useAppNavigation.navigationGuard`。配置写入复用现有 `updateConfig` 序列化 owner，合并最新配置；不改变 App Server、IPC、协议、runtime、read model 或存储结构。

## 写集与边界

- `system/experimental/index.tsx`：改为消费唯一状态 hook，原始字段展示、关联 label / input、稳定测试标识、状态消息。移除页面中复制的加载和持久化代码及无人清理的消息定时器。
- `system/experimental/useExperimentalSettingsState.ts`：原始手动草稿与基线、最新字段合并、共享同步 mutation 锁、加载和生命周期令牌、错误终态、统一状态提示定时器。
- `system/experimental/index.test.tsx`：既有业务 fixture 同步 `updateConfig` 合同，保留原行为回归。
- `system/experimental/unsavedNavigation.integration.test.tsx`：真实导航及 Experimental / DeveloperLab 组合验证。
- `system/developer-lab/index.tsx`、`index.test.tsx`：首次访问后保留唯一实验页子树；支持 `initialTab` 参数变化及隐藏焦点转移。

避让共享 root 导航、导航护栏、对话框、语言资源、`settingsSearchDocuments`、`sections`、架构与其他设置目录。静态搜索属于下一独立切片，不在本收据内。

## 行为与失败终态

1. 未保存的 DSN、环境、采样率和 PII 字段向共享导航护栏报告 dirty。空值及中间输入保持原样，只有保存时规范化；切语言不会重新加载或覆盖草稿。
2. 设置分区、返回、首页、根页面、新会话和搜索结果导航都先确认；Keep editing 保稿，Discard 执行原目的地，均不会隐式保存。
3. 实验页首次访问时加载；DeveloperLab 切 Tab 或改变 `initialTab` 后保留同一已访问实验页，以原生 `hidden` 隐藏并移走其中焦点。隐藏草稿继续注册外层护栏；卸载时清理。
4. 保存通过 `updateConfig` 只覆盖手动编辑字段，同时接受最新的未编辑字段。启用开关仅提交 `enabled`，保留其他未保存输入；Tool Calling / WebMCP 即时开关不会携带 crash 草稿。
5. 三类 mutation 共享一个同步锁，防止双击保存及同事件循环的竞争开关；保存中禁用字段，外层 Discard 同样受阻。
6. 持久化成功就接受新基线；runtime apply 失败显示可重试状态，Save 可再次应用。持久化失败继续保留 dirty 草稿，不显示后端错误值。
7. 初始加载失败显示现有通用错误和重试，不开放默认配置写入。StrictMode 双挂载及旧初始加载不能回写新 owner。卸载后的 read / persist / apply 返回不继续写入或应用。
8. 统一管理成功消息定时器，较早成功不会清掉较新错误；卸载清理定时器。全部提示复用现有五语言 key，无新文案。

## 验证合同

预算 `budget:tight`，风险 P2。current 主链保持原页面配置 gateway；本切片不新增业务事件或 MCP inventory 行为。

| 边界 | 证据 |
| --- | --- |
| 页面表单与真实 root 导航 | `useAppNavigation + SettingsNavigationGuard + DeveloperLabSettings + ExperimentalSettings` 组合，业务 API 明确使用测试替身 |
| 最新配置合并与串行 owner | 消费实际 `updateConfig` API 合同；fixture 以相同 updater 语义验证提交字段，未冒充真实 bridge |
| 原始草稿、失败及迟到 | 领域集成验证空字符串、五语言、不重载、错误重试、read / persist / apply 三阶段卸载 |
| 生命周期 | 首次访问、hidden、焦点、`initialTab`、StrictMode 和定时器清理 |

验证入口 `.lime/qc/settings/experimental-draft-20261018-1/verify.cjs` 固定定向测试、严格 TypeScript、ESLint 与 Prettier，最终以 `implementation-receipt.json` 的退出码及源码 SHA 为准。新增领域集成在仅接入可访问标签和稳定选择器的旧行为上为 21 / 22 失败，红例日志保存在独立 QC 目录。

未运行 Electron、原生候选、`verify:gui-smoke` 或全量门禁：父 Agent 独占原生候选与产品集成验证。本切片只能声明领域组件 / 集成证据，不声明 Desktop Gate B 或所有 GUI 对齐完成。

## 退出条件与分类

退出条件：原始草稿、外层导航、单实例 Tab 生命周期、最新字段合并、同步 mutation 锁、失败 / 迟到和五语言回归通过；严格类型、lint、format 通过；独立收据冻结源码 SHA。

分类：页面状态 hook、原有配置 gateway 和共享导航合同为 `current`；原页面重复状态与异步 mutation 实现已直接替换，不留 `compat` / `deprecated` 包装。领域实现完成度 100%，GUI 集成验证由父 Agent 统一收敛。
