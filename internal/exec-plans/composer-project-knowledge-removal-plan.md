# Composer 项目资料路径入口删除

状态：前轮删除纵切与定向验证完成；2026-10-20；责任进程：`remove_import_projection`。下文验证与摘要记录该轮历史冻结点，后继[消息/Artifact 知识保存删除](message-artifact-knowledge-removal-plan.md)已合法重开部分写集，不能作为新源码的零漂移证明。

## 目标与证据

服务 Codex Desktop GUI 完整对齐，删除 Composer 文件附件上的“设为项目资料”额外业务动作。参考为匹配 ASAR 的[专项 REA 审计](../research/codex-desktop-rea/composer-project-knowledge-entry-audit-20261020.md)：主 Composer 的附件控件显式消费 open/preview/remove，添加动作的完整返回数组只含本地/远端文件和 capability 控制的 appshot。

证据为 `ev_3cda207946e9a026b3c384c1474759c23fcba1d334fe72da4234b80c84c49eb3` 与 `ev_7976bb1a9501f0ccde909b4a49f16127fadcf257ad5682895abeb557f0c8b7e7`。限定结论只覆盖已确认的附件合同；参考 App 未执行，其他产品面和动态功能保持 unknown。

## 认领与退出条件

- 删除 InputbarCore 按钮、鼠标 handler、专用样式/copy，Inputbar/ComposerSection/EmptyState 的透传。
- 删除 Landing 仅携带该回调的 inputbarScene 参数，并迁移唯一 workspace caller。
- 删除 knowledge runtime 的路径 handler，以及仅供它使用的读取/资格判断/路径导入 helper。
- 删除五语言共 10 个 key，迁移旧正向测试、fixture 和回流护栏。
- 保留普通路径附件的显示/移除/发送。该轮未审计的共享文本导入、消息/Artifact 保存和 KnowledgePage save 分支当时仍有消费者；后继专项已凭独立 REA 证据删除这些入口及 helper，独立知识页普通整理与选择另行对标。
- 避让侧栏、Rust、provider、memory、reasoning 热区；不启动 Electron，不执行全套门禁。既有脏增量以修改前摘要为界保留。

具体写集记录于 `/tmp/lime-composer-knowledge-removal-before-20261020.json`；实现后生成同范围冻结清单与摘要。`internal/aiprompts/architecture.md` 仅补 Composer 附件职责的删除，不改同步问答 3.2.1。

## Verification Contract

预算：`budget:tight`；风险：P2，现有 Renderer 额外动作的删除，不更改 public method、协议、数据或 runtime owner。

Current 主链：Home / Conversation → ComposerController 文档与路径资源 → 既有发送 owner → App Server。附件操作不再触发 `knowledgePack/source/import` 或 `knowledgePack/compile`。该轮共享文本导入尚有消息消费者；后继专项已删除其唯一入口与 helper。两个切片均不改 Electron/preload/read model。

输入与结果：本地文件或目录加入输入后仍显示路径 chip，移除只调用原路径资源回调；发送保留 canonical 路径资源。文本文件不显示资料动作。Home Banner、主题、多模型不受本切片职责变更影响。

失败终态：既有附件/提交 owner 处理；不新增 fallback。静态 REA、组件与 hook 测试仅证明限定合同与 Renderer 接线，不冒充真实 Desktop Gate B。

验证：

- 受影响的 InputbarCore、EmptyState 附件、Landing、InputbarScene、knowledge helper、共享文本保存、边界 guard 与五语言测试。
- affected TS/TSX strict lint、renderer types、五语言 key 一致性和已退役 production 符号检索。
- root 在冻结后统一补 current fixture / GUI smoke / 真实 Electron 附件添加、移除与发送；本进程不抢占 GUI owner。
- 不跑 contracts：public method、protocol/client/gateway 均未改动。不跑 Rust：Rust 无写集。

架构影响：非重大。删除 Renderer presentation 的额外 action 与无其他消费者的专用分支，既有文档、发送、知识能力、持久化和协议 owner 不变；不新增/move crate/package，不变更跨层 owner/read model。架构图无需改动，正文记录附件边界。

## 分类与进度

- current：普通路径附件、ComposerController。共享文本保存 owner 已在后继专项迁为 dead/deleted，不再列为 current。
- dead / deleted / forbidden-to-restore：本切片的路径资料按钮、专用 callback、路径读取/导入 helper、五语文案；实施完成后由 current 行为与负向护栏覆盖。
- compat / deprecated：不新增。
- 已完成：REA 限定路径调查、窄写集盘点、删除纵切、旧测试/fixture/guard 迁移、文档职责回写与源码冻结。
- 本切片实现完成度：100%。真实 Desktop Gate B 归 root 的统一候选，未由本切片验收。

## 当前验证与冻结

| 验证 | 结果 |
| --- | --- |
| 定向 Vitest（`node node_modules/vitest/vitest.mjs run --maxWorkers=2`，下列 16 文件） | 143/143 通过；日志 `/tmp/lime-composer-knowledge-removal-tests-20261020.log` |
| affected ESLint（25 TS/TSX，`--max-warnings 0`） | 通过；日志 `/tmp/lime-composer-knowledge-removal-lint-20261020.log` |
| renderer `tsc --noEmit --project tsconfig.renderer.json` | 通过（exit 0，无诊断）；日志 `/tmp/lime-composer-knowledge-removal-types-20261020.log` |
| 五语言 | 每语言 193 keys，集合一致；10 个已退役 key 均不存在；loader/type 回归通过 |
| diff-check / formatting | 通过；仅未格式化原有同步问答测试的无关区域 |

定向文件：InputbarCore、EmptyStateComposerPanel.references、useWorkspaceConversationLandingSurfaceRuntime、useWorkspaceInputbarSceneRuntime、chatSurfaceProps、knowledgeSourceImport、knowledgeSourceSupport、useWorkspaceKnowledgeRuntime、useWorkspaceKnowledgeRuntime.initialSelection、knowledgeSaveNavigation、Inputbar.selection.component、useInputbarSend、inputbarCoreCopy.unit、AgentChatWorkspace.workspaceBoundaryGuard、i18n loadNamespace/types。它们覆盖文件/目录展示与移除、正文与纯路径发送的 canonical metadata、Landing 接线、共享知识选择/导航、同步问答回归和旧文案回流守卫。

冻结清单为 `/tmp/lime-composer-knowledge-removal-source-freeze-20261020.json`，共 30 个 `src` 文件（含测试/五语言），`sourceTreeDigest=801b51ebad39c9fb284f2654a15633ff9b0bf2a31bc7fbaacc4284f8e92dcf5a`。摘要按有序 `path + NUL + SHA256 + LF` 计算；架构正文只单独摘要本切片新增段，避免冻结其他并行章节。该摘要只证明前轮冻结点；后继消息/Artifact 删除已修改其中部分文件，旧清单保留为历史，不覆盖或冒充当前摘要。

未执行 current fixture / GUI smoke / Electron Gate B：root 明确持有统一构建和 GUI owner，本进程只交冻结源码及定向证据；不得据此宣称整个 GUI 或 live provider 已验收。无新增兼容层、mock fallback、持久化或跨平台路径处理。
