# MCP 设置草稿导航保护

状态：implementation complete / awaiting parent GUI integration validation。
日期：2026-10-18。

## 目标与事实源

按 [GUI 剩余缺口清单](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md) 的优先 1，补齐 MCP 编辑草稿保护。当前草稿 owner 仍为 `useMcpPageEditorState`；外层导航委托现有 `useSettingsDraft`，内部服务器、新建、取消复用 `SettingsUnsavedChangesDialog`，不创建第二套草稿或导航 store。

本切片不改变 MCP runtime、App Server、协议、网关和持久化；不修改共享 root 导航、共享对话框、架构文件及其他设置。治理分类：草稿 owner、注册合同及原配置入口为 `current`；不新增 `compat` / `deprecated` 入口。

## 写集

- `src/components/mcp/useMcpPageEditorState.ts`：同一 owner 的原始字段基线、内部 pending action、同步 mutation 锁及 lifetime / owner identity 校验。
- `src/components/mcp/McpPage.tsx`：复用现有未保存对话框。
- `src/components/mcp/McpPageEditor.tsx`：保存或删除中禁用编辑字段。
- `src/components/mcp/McpPanel.tsx`：首次访问后保留唯一配置页实例；离开配置 Tab 时转移隐藏字段焦点。
- `src/components/mcp/McpPanel.test.tsx`、`src/components/mcp/unsavedNavigation.integration.test.tsx`：生命周期及真实导航合同回归。
- 五语言 `settings.json`：各新增一条 MCP 删除失败提示，不显示后端错误值。

## 用户行为与失败终态

1. 外层设置分区、返回、首页、新会话、根页面和搜索结果导航遇到未保存草稿时先确认；Keep editing 保留输入，Discard 执行原目标且不写配置。
2. 内部更换服务器、新建、取消受同一原始草稿 dirty 状态保护。无效 JSON 也构成草稿；重新选择当前服务器和刷新列表不覆盖输入。
3. 保存成功接受实际提交的规范化字段及新基线；失败保留草稿。同步锁阻止同事件循环重复保存、新建和删除，mutation 期间禁止丢稿及编辑。
4. 异步返回按 lifetime 和所捕获的 owner 校验；卸载后的成功或失败不能修改替代 owner 或弹出迟到提示。删除失败显示五语言通用提示，保留草稿。
5. 配置页首次进入时加载；内部 Tab 切换保留同一个配置页，不额外挂载副本，隐藏内容使用原生 `hidden` 并将其中焦点移到目标 Tab。父页面卸载时清理草稿注册。

## 验证合同

预算：`budget:tight`。风险：P2；只改变设置 surface 的本地表单与导航合同。

| 项目 | 合同 |
| --- | --- |
| current 入口 | `McpPanel -> McpPage -> useMcpPageEditorState` |
| 导航 authority | `useAppNavigation.navigationGuard`，通过 `SettingsDraftContext` 注册 |
| 写入 authority | 原 `useMcpServers` CRUD；未增加或变更 wire |
| read model / events | 本切片不改变 MCP inventory 或 runtime event；服务器清单继续由既有 hook 获取 |
| 失败终态 | 草稿保留、解除当前 mutation 锁；卸载后无迟到副作用 |
| 证据等级 | 领域组件及集成测试；业务 hook 使用测试替身，不代表真实 Electron / App Server 证据 |

执行命令由 `.lime/qc/settings/mcp-draft-20261018-1/verify.cjs` 固定：定向 MCP Page、Panel、导航集成测试；严格 TypeScript；ESLint；Prettier。收据同时记录命令、Node 版本、退出码及源文件 SHA。

已复现红例：新增 21 项导航集成在原实现上 20 项失败；新增 2 项 Panel 生命周期测试在卸载配置页实现上失败。最终结果以该目录内的 `implementation-receipt.json` 为准。

未运行 `verify:gui-smoke`、原生 Electron 或全量门禁：父 Agent 独占当前原生候选与集成验收，本切片按分工仅提供可集成的领域实现和定向证据。父 Agent 完成集成后再运行受影响 GUI 门禁；本切片不据此宣称 Desktop Gate B 完成。

## 退出条件与交接

退出条件：以上原始字段、导航、mutation、卸载、隐藏焦点及五语言合同均有通过的定向回归，严格类型、lint、format 通过，独立收据冻结源码摘要。

本切片的本地实现完成度为 100%；产品集成验收由父 Agent 收敛。下一刀是独立认领 Developer / Experimental 手动草稿，不扩大本切片的 current owner。
