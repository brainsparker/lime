# Agent Chat 组件

Agent 聊天界面的 UI 组件集合。

## 文件索引

| 文件                             | 说明                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `ChatNavbar.tsx`                 | 聊天顶部导航栏                                                                |
| `CanvasWorkbenchLayout.tsx`      | 画布顶部标签壳，统一承载结果、文件、Subagents 进展与动态文件标签              |
| `EmptyState.tsx`                 | 空状态占位组件                                                                |
| `MarkdownRenderer.tsx`           | Markdown 渲染组件                                                             |
| `MessageList.tsx`                | 消息列表组件                                                                  |
| `StreamingRenderer.tsx`          | 流式消息渲染（支持思考内容、工具调用）                                        |
| `TokenUsageDisplay.tsx`          | Token 使用量显示                                                              |
| `ToolCallDisplay.tsx`            | 工具调用显示（状态、参数、日志、结果）                                        |

## 核心组件

### CanvasWorkbenchLayout

- 只负责单画布壳、头部标签、文件标签与顶部操作，不直接依赖具体 slash / skill 业务
- 顶部收敛为紧凑标签栏 + 文件操作区，去掉大块摘要头，避免与正文和对话信息重复
- 当存在默认主稿时，默认焦点落在结果预览；只有存在待处理事项或正在生成时才显示进展入口
- `workspaceView` 可以由运行时显式注入顶部标签文案和面板文案，工作区文件区是画布里真实文件的唯一事实源
- 文件目录读取与缓存统一归 `useCanvasWorkbenchFileTreeState`；文件树和路径面包屑菜单共享该 owner，显示真实目录及隐藏文件，不按 Lime 内部产物名称排除入口。
- `panelCopy` 允许运行时覆盖 workspace / Subagents 面板里的引导文案、空态文案与目录区标题，避免布局壳继续承载场景描述
- Subagents 进展由运行时显式注入插槽定义，布局只消费定义，不在本地重建协作语义
- 通过 `sessionView` 等插槽注入不同运行时面板，保持未来场景扩展时的边界稳定
### ToolCallDisplay

参考 agent UI 设计，提供完整的工具调用可视化：

- **状态指示器**：pending/running/completed/failed 四种状态
- **工具描述**：根据工具类型和参数生成人性化描述
- **可展开面板**：参数、日志、输出结果分层展示
- **执行时间**：显示工具执行耗时

### StreamingRenderer

流式消息渲染组件，支持：

- **思考内容**：解析 `<think>` 或 `<thinking>` 标签，折叠显示
- **工具调用**：集成 ToolCallList 显示工具执行状态
- **实时 Markdown**：流式渲染 Markdown 格式
- **流式光标**：显示正在输入的视觉反馈

## 依赖关系

```
MessageList
  └── StreamingRenderer
        ├── ThinkingBlock (思考内容)
        ├── ToolCallList
        │     └── ToolCallDisplay
        │           ├── ToolCallStatusIndicator
        │           ├── ToolCallArguments
        │           ├── ToolLogsView
        │           └── ToolResultView
        └── MarkdownRenderer
```
