# AI Agent 聊天模块

> 版本: 1.1.0
> 更新: 2026-01-10

## 模块说明

AI Agent 聊天页面，承接新建任务与生成两种入口。当前工作台主题已收口为统一的 `general` 主链，并集成布局过渡、画布工作台与能力面板。

## 文件索引

| 文件                           | 说明                                       |
| ------------------------------ | ------------------------------------------ |
| `index.tsx`                    | AgentChatPage 主组件，集成布局过渡和工作流 |
| `types.ts`                     | 类型定义（Message、Provider 配置等）       |
| `utils/canvasWorkbenchDiff.ts` | 画布工作台的文本 diff 计算工具             |

### components/

| 文件                               | 说明                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `ChatNavbar.tsx`                   | 顶部导航栏（模型选择、设置等）                                           |
| `MessageList.tsx`                  | 消息列表组件                                                             |
| `Inputbar.tsx`                     | 输入栏组件                                                               |
| `EmptyState.tsx`                   | 空状态引导（主题选择、模式选择）                                         |
| `CanvasWorkbenchLayout.tsx`        | 待迁出的文件／Artifact 预览壳；不承载 Summary、Outputs、Recovery 或 Logs |
| `workspace/ThreadSummaryPanel.tsx` | Codex 对齐的 Summary、Sources、Subagents 与后台进程投影                  |

### hooks/

| 文件              | 说明                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `useAgentChat.ts` | 现役 Agent 聊天主 Hook                                               |
| `index.ts`        | `useAgentChatUnified` 统一入口与 Hook 导出，旧 `useAgentChat` 已删除 |

## 核心功能

### 1. 通用对话

- 多轮对话上下文
- 流式响应
- Markdown 渲染
- 代码高亮

### 2. 工作台模式

- 统一 `general` 工作台主题
- 4 种创作模式（引导/快速/混合/框架）
- 布局过渡（对话 ↔ 对话+画布）

### 3. 文件与 Summary

- 右侧面由 `ThreadSidePanelTabs` / `RightSurfaceHost` 统一组织，Files 与 Changes 使用既有文件／审阅 owner。
- Summary 只由页头 `ThreadSummaryToggle` 和 `ThreadSummaryLayout` 展示；Sources、Subagents、后台进程消费同一 canonical 投影。
- `CanvasWorkbenchLayout` 仍有文件／Artifact 预览消费者，继续迁入当前右侧面；不再注入 Summary 面板或维护工具标签。Files 与终端只由当前右侧面 New tab 入口创建，不保留 Canvas 独立工具菜单、编号会话、项目文件面板或目录fallback；目录读取、文件标签与树只在current Files消费。
- 文件读取、保存前导航与异步身份保护由原 owner 承接，清退进度以[当前 GUI 计划](../../../../internal/exec-plans/codex-gui-alignment-current-plan.md)为准。

## 依赖模块

- `@/lib/workspace/workbenchUi` - 工作台共享 UI（布局过渡、步骤引导）
- `@/lib/workspace/workbenchWorkflow` - 工作流状态

## 使用示例

```tsx
import { AgentChatPage } from "@/components/agent/chat";

function App() {
  return <AgentChatPage onNavigate={(page) => console.log(page)} />;
}
```
