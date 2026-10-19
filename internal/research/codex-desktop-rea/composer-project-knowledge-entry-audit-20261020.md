# Composer 路径附件的项目资料入口核对

状态：只读调查于 2026-10-20 完成；调查阶段仅新增本报告，未修改产品或冻结写集。附件删除实现与验证由[专项执行计划](../../exec-plans/composer-project-knowledge-removal-plan.md)记录。消息/Artifact 的独立 REA 研究与后继删除见[后继报告](message-artifact-knowledge-entry-audit-20261020.md)和[执行计划](../../exec-plans/message-artifact-knowledge-removal-plan.md)：消息保存、文本导入 helper 与 saveDraft 分支已删除。下文的源码调用、行号及“仍有消费者/保留”判断只属于调查时快照，不再是 current 保留指令。

## 结论与适用范围

Lime 的“设为项目资料”是额外的持久化业务动作：读取路径文件、导入知识来源、编译知识包、刷新选择并提示成功。它不是普通路径上下文附件，也不是 Codex 文件打开或缩略图导入的同义命名。

已沿匹配安装包的主 Composer、添加菜单、附件 adapter、文件分支和三种文件控件逐层核对实际 callback。该已确认路径的文件动作是打开/预览、移除；添加动作是选择本地文件、远端文件和应用截图。没有在这些明确的 action inventory 和 consumer 合同中发现“把路径文件编译为项目知识包”的同语义入口。因此，按用户仅保留主题、多模型、首页 Banner 的目标，Lime Composer 的这条额外路径入口可作为独立删除纵切。

这不是全包字符串未命中的结论，也不证明整个 Codex、其他菜单、远端功能或未来版本不存在知识/资料能力。参考 App 未运行，动态 feature flags、服务端功能、预览打开之后的全部编辑器菜单均 unknown。Lime 消息/Artifact 保存仍是实际消费者，不能用本附件结论顺带删除它们的共享 owner；这些入口是否也应对齐删除，需要自己的证据，不能新增为用户未授权的保留特色。

## 参考身份与 REA

目标：Codex Desktop `26.1007.30912 / 20156`；ASAR SHA-256：
`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
原件根为 `/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/`。

| 原件 | SHA-256 |
| --- | --- |
| `composer-editor-evidence/webview/assets/app-primary-6f60e9ac4103.js` | `7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321` |
| `composer-editor-dependencies/webview/assets/app-initial-6350d04672d0.js` | `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f` |

本次复算两个原件摘要；Acorn 解析完整原件、定位完整函数声明，再按原始 UTF-16 半开区间精确提取，不执行 bundle。主入口 `LocalConversationPage.uc → primary.xc/$X → rpt → Qft` 复用[主 Composer 审计](main-composer-audit.md)的已保全同版本证据；没有重跑完整大包分析。

| 新 Evidence | 输入与结果 |
| --- | --- |
| `ev_3cda207946e9a026b3c384c1474759c23fcba1d334fe72da4234b80c84c49eb3` | 16 完整声明，96,207 bytes，27,381 AST nodes，parse failure 0；输入目录 SHA `ac5c4c1274944a20251a9d74f36cffe9a3095da1e2302b6b807900990ae60125` |
| `ev_7976bb1a9501f0ccde909b4a49f16127fadcf257ad5682895abeb557f0c8b7e7` | 文件打开/移除联动补充 2 完整声明，843 bytes，293 AST nodes，parse failure 0；输入目录 SHA `198e535451fb1259466bf5ec6acdfa76547a2de29dfa85bd9e8a06c1c43832e2` |

两个 application inventory 均 complete、无截断/遗漏，semantic coverage 均 unknown、各关系族 partial、omitted nodes/relations 0；分别存在 5,017 / 55 条 semantic unknown。输入是声明子集，没有复制原件 import/bootstrap 闭包；跨成员别名通过原件 AST import/export 精确配对，不能宣称 REA 自动闭合了整个应用的语义图。`targetExecuted=false`。

完整产物：`/tmp/lime-composer-knowledge-audit-20261020/`，包括 `final-manifest.json`、两个输入目录、`evidence.json`、`open-evidence.json`、有界 `summary.json/open-summary.json`、只读格式化副本和 Lime 源码摘要快照。18 个 source span 与输入字节均在收尾重新核对一致。参考源码不纳入仓库。

## 主 Composer 附件的正向调用证据

下列压缩名只用于原件定位，不作为可还原的上游函数命名。

| 原件符号 / UTF-16 span | 确认的职责、输入与动作 |
| --- | --- |
| primary `Qft` `1364761..1409306` | 主 Composer 组合；`viewProps.attachments` 创建 `U2e`，显式传 local/uploaded/added files 与 open/remove callbacks；草稿 overlay 的 spread 来自 `v1e`。 |
| primary `v1e` `554561..555648` | 旧草稿上下文到附件 props 的显式投影，只返回附件、评论、选择文本、来源会话等数据；没有向文件控件添加知识包动作。 |
| primary `U2e` `641383..646731` | 把主 Composer 的附件类型与操作映射到 `x2e`；文件路径只提供打开、移除和预览设置；上传文件也分别提供 open/remove。 |
| primary `x2e` `621339..636413` | 本地文件、added file、pending/uploaded file、粘贴文本分别渲染；本地/added 文件传 `gy` 的 `onClick: N(file,hostId)`、`onRemove`；pending 只移除，粘贴文本另可恢复输入正文。 |
| initial `qxn` `2154543..2159500` | primary `gy` 精确导入 initial `ITn`，其 export local 为 `qxn`。解构已知文件 props，按 `tile/card/pill` 分支把 open/remove 传给 `Exn/yxn/Cxn`，无知识资料 action slot。 |
| initial `Exn` `2145102..2147042` | tile：文件预览/标签、覆盖按钮调用传入 open、独立 remove 控件；无额外业务动作。 |
| initial `yxn` `2140445..2141317` | card：标题/副标题、传入 open、可选 remove。 |
| initial `Cxn` `2141397..2145026` | pill：传入 open、可选 remove（含 Enter/Space）；其余是 icon、正文与 DOM 属性。 |
| initial `Jxn` `2159500..2160195` | 文件夹 hover/focus 查询数量并显示 tooltip，不是上下文菜单或知识导入。 |
| initial `Pxn` `2148185..2149219` | thumbnail source 为上传文件或 host/path，`importKind` 是缩略图/预览文件格式；不能因为名称含 import 推断资料持久化。 |
| initial `Cqc` `10464999..10465391` | `Qft.Ks → primary.dpe → initial.Gd → Cqc`；把路径/行号/host 和附件预览 origin 交给既有 `JG` 打开合同；目录指定 `fileManager`，合适文件可侧面预览。 |
| primary `eV` `639568..640017` | 移除文件后，仅在没有剩余同文件附件且 tab 确认为 Composer attachment preview 时关闭对应 tab；不是知识库写入。 |
| initial `Fdl` `11098843..11104845` | 接收主视图 attachments 并置于既有 `$S.Attachments` 槽位，负责可见/hidden/spacing。 |

添加路径另为 `Qft → kdt → Ddt/PX`：

| 原件符号 / span | 确认合同 |
| --- | --- |
| primary `kdt` `1324174..1328566` | 组装文件选择器、图片、远端文件与 appshot；注册主 Composer 添加动作；只向 `Ddt` 注入对应标签和 callbacks。 |
| primary `Ddt` `1323172..1323841` | 明确构造 `pick-local-files`，按 capability 加 `capture-appshot`，非 local 且有 picker 时加 `pick-remote-files`；这是完整返回数组。 |
| primary `PX` `1323841..1324129` | 捕获附件 generation，等待 file picker，身份仍有效时调 `addPickedFiles`；失败走 picker 错误反馈。 |
| primary `Cst` `1186681..1187246` | 模板 asset 下载为附件文件，generation/cancel 校验后进入 fileAttachments；过期则清本次附件。不能等同知识资料编译。 |
| primary `Cft` `1349448..1354542` | 文件/粘贴文本附件的移除、撤销与恢复输入正文；大文本写本地附件或 cloud upload；属于当前输入素材生命周期。 |

已检查的附件动作列表与 Lime `importKnowledgePathSource → importKnowledgeTextSource → compileKnowledgePack` 的作用不同。未知的 `JG` 更深打开行为和其他产品面的菜单不借此推断为全应用无知识能力。

## Lime 当前调用链

源码在调查时只读取摘要快照，未冻结其他 Agent 的并行 Home/Files 写集；行号用于该次工作树定位。

1. `InputbarCore.tsx:552` 仅在 callback 存在且 `isKnowledgeTextSourceCandidate(reference)` 时渲染 `PathReferenceKnowledgeButton`；`:281..299` 的鼠标事件阻止默认/冒泡后，调用 `onImportPathReferenceAsKnowledge(reference)`。
2. 会话链为 `InputbarCore ← InputbarComposerSection:369 ← Inputbar/index:330 ← useWorkspaceInputbarSceneRuntime:473`。最终 callback 来自 `knowledgeRuntime.onImportPathReferenceAsKnowledge`。
3. Home 链为 `InputbarCore ← EmptyStateComposerPanel:400 ← EmptyState ← buildWorkspaceEmptyStateProps ← useWorkspaceConversationLandingSurfaceRuntime`。Landing 的 `inputbarScene` Pick 只含该字段；删除后这个单字段参数与搬运层可整体去掉，避免留下空壳。
4. `useWorkspaceKnowledgeRuntime.ts:472` 的 handler 先要求 workingDir、拒绝目录、检查文本类型，接着调 `importKnowledgePathSource`。成功复用 `handleKnowledgeImportSuccess` 刷新 pack list，禁用选择并 toast；失败显示错误。
5. `knowledgeSourceImport.ts:185` 读取路径（`:119`，上限 512 KiB），构造文本来源，再调 `importKnowledgeTextSource:144`；后者先 `importKnowledgeSource`，再 `compileKnowledgePack`。
6. 真实 public method 在 `packages/app-server-client/src/generated/protocol-types.ts:154/158` 为 **`knowledgePack/compile`**、**`knowledgePack/source/import`**。`src/lib/api/knowledge.ts:481/504` 经现有 typed App Server gateway 调用；没有第二套业务 backend。

删除 UI 入口不等于删除 Knowledge capability。需从调用边界剥离 path import 分支，保留本切片未审计的实际消费者，之后各自对标。

## 可删除的最小纵切

| 层 | 同一变更中应清理 |
| --- | --- |
| 可见按钮 | `InputbarCore.tsx` 的 callback prop/解构、两个 import 鼠标 handler、资格判断和按钮、相关 imports；`Inputbar/styles.ts` 唯一 `PathReferenceKnowledgeButton`。普通路径 chip、移除、Controller 文档与发送保持 current。 |
| 透传 | `Inputbar/components/InputbarComposerSection.tsx`、`Inputbar/index.tsx`、`EmptyStateComposerPanel.tsx`、`EmptyState.types.ts`、`EmptyState.tsx`、`workspace/chatSurfaceProps.ts` 的该字段；`useWorkspaceInputbarSceneRuntime.tsx` 内会话/返回两处；Landing 的单字段 Pick、inputbarScene 参数/解构/useMemo 与其实际调用者。 |
| 业务分支 | `useWorkspaceKnowledgeRuntime.ts` 的该 result 字段、`MessagePathReference` 类型 import、`handleImportPathReferenceAsKnowledge`、`importKnowledgePathSource/getKnowledgeUnsupportedSourceMessage` imports。共享 `handleKnowledgeImportSuccess` 仍有文本导入调用，不能删。 |
| 路径专用 helper | 无其他 production consumer 的 `importKnowledgePathSource`、`readKnowledgeTextSourceFromPath`、`KNOWLEDGE_TEXT_IMPORT_MAX_BYTES` 与 `readFilePreview` import；`KnowledgeSourceCandidate` 和 `isKnowledgeTextSourceCandidate` 的再导出。 |
| 支持判断 | `knowledgeSourceSupport.ts` 的扩展集合、candidate type、`getKnowledgeSourceDisplayName/isKnowledgeTextSourceCandidate/getKnowledgeUnsupportedSourceMessage` 随唯一 consumer 删除；**不能删整个文件**，`getKnowledgeSourceExtension/normalizeKnowledgeSourceTitle` 仍被文本 draft 使用。 |
| 文案 | `inputbarCoreCopy.ts` 的对应 key union、path 类型与构造字段；五语言 `agentInputbar.json` 的 `core.path.importAsKnowledge/importAction`。 |

后继应删除或改写过期正向测试及 mock：

- `InputbarCore.test.tsx:580/608` 的“支持设为资料/非文本不支持”旧要求；迁为普通文件上下文仍能展示、移除、提交，且附件动作不触发资料业务。
- `EmptyStateComposerPanel.references.test.tsx:42` 的旧正向动作；保留本地路径显示和移除的有效回归。
- `useWorkspaceConversationLandingSurfaceRuntime.test.tsx:148` 的旧 callback 透传、scene/index testFixtures 的该 mock；只删对应字段，不能重写其他 owner。
- `knowledgeSourceImport.test.ts` 的路径读取测试和 `knowledgeSourceSupport.test.ts` 的候选分类测试随已删 helper 迁出；文本清洗、draft 构造与 import/compile 的有效测试继续由对应 owner 覆盖。
- 五语言 `i18n/__tests__/loadNamespace.test.ts`、`types.test.ts` 的已删 key 与旧 callback 结构守卫同步迁移，避免护栏要求恢复旧入口。

这些写集会触及本轮已冻结的 `useWorkspaceInputbarSceneRuntime.tsx`、其测试和两份 i18n 测试；必须由 root 在下一候选统一更新源摘要/构建，不在当前冻结构建中夹写。没有修改 public method，独立按钮删除不应顺带清 App Server/Rust 协议；若后续审计决定删除整个知识能力，则另开跨消费者迁移并执行 contracts。

## 仍有效的其他消费者与剩余问题

`useAgentChatWorkspaceSceneRuntime.tsx:175` 真实调用 `useWorkspaceMessageKnowledgeSaveRuntime`，把 `inputbarScene.onImportTextAsKnowledge` 和 knowledge selection 的 workingDir/packName 交入；`:495` 再传到消息列表。`MessageActionButtons:114`、`MessageArtifactCards:127`、文件 Artifact consumer 的保存操作会调用该 owner。owner 优先导航 `knowledge` 保存页，无法导航时才调用同一文本导入。这个 fallback 仍有实际调用入口，不能把文本 helper 一并判 dead。

`features/knowledge/KnowledgePage.tsx:706` 还会以 `initialKnowledgePackSelection` 导航到 Agent，经 `AppPageContent` 与 workspace contract 到 runtime。这是另一个实际消费者，不是 Composer 文件按钮本身。

另发现 7 项 knowledge 配置/整理返回字段只在 scene return 和 `useWorkspaceConversationSceneRuntime` 的 `Pick` 中出现，后者函数体只读 `inputbarNode/generalWorkbenchDialog`：`knowledgePackOptions`、toggle/select/companion/needed/organize/manage。它们在本次有界 production 引用盘点中未见渲染调用，可作为后继 owner 收敛候选；删除范围、知识页启动意图和消息保存语义需要继续核实，不能借此全删 runtime。

分类：本路径按钮与路径专用业务分支为明确的待删除额外 surface；普通路径附件为 current；文本保存/KnowledgePage 为仍有实际 consumer、待独立对标，未批准成为保留差异；没有新增 compat/deprecated 包装。参考未运行、消息保存是否有同语义 Codex 入口、全应用/跨平台行为保持 unknown。

## 验证与退出

本切片只读源码与安装包声明，运行 REA 静态分析、原件/source-span 摘要核验和报告链接检查；没有运行产品测试、GUI smoke 或 Electron Gate B。修改产品后的最小验证应为受影响 Composer/Home/path helper/i18n 定向回归、renderer types、strict lint，再由 root 统一执行 current fixture、GUI smoke 和真实附件添加/移除/提交。不能将此报告或静态 action inventory 写成已删除或产品已验收。
