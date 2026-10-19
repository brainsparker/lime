# 消息与 Artifact 知识保存纵切删除

状态：删除实现与定向验证完成；root 真实 GUI 验收待执行。日期：2026-10-20。负责人：Codex / remove_import_projection。

## 目标与参考

以 [匹配安装包 REA 研究](../research/codex-desktop-rea/message-artifact-knowledge-entry-audit-20261020.md) 为依据，删除本地消息/Artifact 额外的项目资料保存业务入口、专用 helper 与 KnowledgePage 的 saveDraft 子分支。普通文件打开/预览/复制、独立知识页导入和底层知识 API 保持 current；它们不是本切片确认的保留特色，整体产品去留仍由独立对标决定。

上游对应：本地消息完整 action slots 与文件菜单没有知识导入编译动作；Download/Save as 消费文件复制，Library 消费既有文件收藏。Lime 删除 owner：`useWorkspaceMessageKnowledgeSaveRuntime → knowledgeSaveNavigation / onImportTextAsKnowledge → knowledgeSourceImport`。

用户已授权清理旧入口；root 在本轮显式打开源码写窗。前一轮 Composer 的冻结快照保留为历史，本轮不覆盖其摘要、不将变更后的工作树冒充零漂移。

## 写集与避让

写集：消息动作、Artifact 卡片、canonical 时间线及 MessageList 的保存回调/投影；WorkspaceScene、InputbarScene、KnowledgeRuntime 的专用接线；知识保存 runtime/navigation/import helper 及专用测试；KnowledgePage 的 saveDraft/save-only 状态/UI/参数/测试；专用样式；五语 agentMessageList/agent 文案；相关 fixture、正向护栏和 i18n 测试；本计划、architecture 的资料职责段与两份知识审计状态段。

完整实际文件列表和摘要输出到 `/tmp/lime-message-knowledge-removal-20261020/`。工作树其它改动保留。避让：侧栏与快捷键 fixture、主对齐计划、index、`.gitignore`、Electron/Rust/协议及普通文件动作。root 负责统一 GUI 产物验收。

## Verification Contract

预算：`budget:tight`。风险：P1，GUI 入口与只属于该入口的代码删除。

Current 主链：Renderer 消费现有 Thread/Turn/Item projection，消息复制与文件打开继续由原 owner 承接。独立 KnowledgePage 经 typed gateway 调用既有知识 App Server 方法；本次不修改 Electron、JSON-RPC、runtime、持久化或 read model authority。

Happy path：助手结果和 Markdown 文件显示现有内容/文件动作，不出现项目知识保存；普通文件打开仍携带相同 path/content/canonical identity。KnowledgePage 的普通导入、已有资料选择与 Agent 导航继续工作。无新工具、审批或业务事件；删除入口不能制造 fallback 写入。

Evidence layers：定向 unit/component 与结构回流守卫需要；GUI trace、runtime transcript 与真实 Electron Gate B 由 root 在新源码稳定后统一取得。release artifact 不适用。本轮不构建、不启动 Electron、不访问 live provider。

拟运行：独立 Node24 下的受影响 Vitest、strict lint、renderer typecheck、五语集合/退役 key 检查、diff-check。纯 GUI 删除不改协议，contracts 不因本切片新增变更。默认本地门禁、current runtime fixture、GUI smoke 与 Gate B 在 root 统一验收中按实际执行报告，不能用本切片静态/组件结果替代。

P0/P1 场景：消息动作、历史/当前 Artifact 文件打开、独立知识导入。无需 LLM judge 或 supervisor。发现回流时在最近 current owner 的测试/负向护栏回写。

架构影响：非重大。本切片删除额外 GUI 写入入口与孤立 helper，不改变跨层 owner、协议、read model 或领域 authority。architecture 只同步入口/消费者事实，不另建 runtime 或兼容层；独立知识 owner 的整体调整不在本切片。

## 退出条件

- [x] 保存按钮、badge、高亮资格、回调透传和专用 owner 全部删除。
- [x] 失去消费者的文本导入 helper 与 saveDraft 页面分支删除。
- [x] 五语、过期正向测试/fixture/guard 与文档事实同步迁移。
- [x] 普通文件动作与独立知识页行为定向验证通过。
- [x] strict lint、renderer types、五语、diff-check 通过，新源码摘要冻结并交 root。
- [ ] root 完成受影响真实 GUI 验收；在此之前不宣称整体验收完成。

## 验证与状态

本切片删除实现与定向验证完成度 100%；退出条件 5/6（83%），余项为 root 的真实 GUI 验收。此百分比不代表整体 GUI 对齐进度。

- current：普通消息复制/引用、文档与 canonical 文件打开/预览；独立 KnowledgePage 的目录/状态、资料选择和普通整理。普通整理由 `handleContinueKnowledgeOrganizeInAgent` 带 sourceText/knowledge_builder metadata 导航 Agent，原 `runImportSource` 只服务 save 页，随失去唯一消费者一起删除。
- dead / deleted / forbidden-to-restore：消息/Artifact 知识保存按钮、badge、资格/高亮、回调、persistent 专用样式，专用 runtime/navigation/source/import/support helper、saveDraft/save view/tab、孤立直接导入函数及专属文案。共删除 8 个文件；五语各删除 26 个 key。
- compat / deprecated：不新增；独立知识 API、protocol、runtime、read model 与持久化 owner 未改，完整知识产品面仍待独立对标。

| 验证 | 结果 |
| --- | --- |
| 首轮 Vitest（13 文件） | 132/133 通过；旧 Harness guard 仍用已删除 runtime 作为范围终点，已迁到 current canvas 调用边界 |
| 修正后定向 Vitest（MessageList.messageActions、KnowledgePage、workspaceBoundaryGuard，3 文件） | 41/41 通过；与首轮未受后续修改影响的 92 项合计 133 个独立测试通过 |
| affected ESLint（37 TS/TSX，`--max-warnings 0`） | 最终 exit 0；清理 messageId、toast、i18n 和孤立 runImportSource 后通过 |
| renderer `tsc --noEmit --project tsconfig.renderer.json --pretty false` | 首轮和最终均 exit 0，无诊断；验证各执行时的工作树，不覆盖后来 root 的 async 接线 |
| 五语、结构与格式 | loader/types 回归通过；已退役 production 符号零引用；窄写集 TS parse 无诊断、Prettier 与 diff-check 通过 |
| `npm run governance:legacy-report` | 扫描摘要：零引用候选 0、分类漂移候选 0、边界违规 0 |

上述命令使用独立 Node `24.21.0`。日志为 `/tmp/lime-message-knowledge-removal-20261020/{vitest-initial,vitest-final,eslint-initial,eslint-final,tsc-initial,tsc-final,legacy-report}.log`。定向范围包含 MessageList.messageActions、AgentThreadTimelineArtifactCard、AgentThreadTimeline、messageListItemProjection.artifacts/canonical、useWorkspaceConversationMessageListRuntime、useWorkspaceInputbarSceneRuntime、KnowledgePage、useWorkspaceKnowledgeRuntime/initialSelection、workspaceBoundaryGuard、i18n loadNamespace/types。

交付摘要 `/tmp/lime-message-knowledge-removal-20261020/source-freeze.json` 包含 55 个源码/测试/i18n 文件（47 现存、8 删除），`deliveredSourceTreeDigest=ca3f5a838631223dbca9469096731eadcac53a5087b489e57b96b031e59c5e1e`。按有序 path + NUL + delivered SHA（删除为 deleted）+ LF 计算。13 个文件已显式释放 root 接后继 async 工作：SceneRuntime、InputbarScene、ConversationTurnTimeline 和五语 agent/agentMessageList；交付摘要与 root 后继观察摘要分别记录，其余文件无并发漂移。该记录不覆盖前轮 Composer 历史 freeze，也不声称后继 root 变更零漂移。

未执行构建、current runtime fixture、GUI smoke、Electron Gate B 或默认本地门禁：root 明确持有统一产物与真实 GUI owner，本进程按授权只提供窄写集与定向验证。该限制不是产品已验收的证据，root 必须在新候选按实际结果闭环。未使用 mock fallback、未改协议，故本切片没有独立新增 contracts/Rust 验证范围。
