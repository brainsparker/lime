# 消息与 Artifact 知识保存入口专项核实

日期：2026-10-20。状态：REA 研究与删除实现完成；定向验证通过，真实 GUI 验收待 root 统一执行。范围：当前指定 Codex Desktop 安装包的本地消息动作、输出文件卡片和 Artifact 文件菜单，与 Lime「保存到项目资料」纵切比较。

## 结论与适用边界

已读取 Codex 的实际动作列表及其调用者、扩展槽和 consumer。已核实的本地助手消息动作和文件动作没有与 Lime「消息/文件文本 → 项目知识保存页，或导入并编译知识包」同语义的路径。因此，已按[独立执行计划](../../exec-plans/message-artifact-knowledge-removal-plan.md)删除消息和 Artifact 的知识保存纵切；Codex 的 Download、Save as、Library 收藏或 savedContentResponse 不构成保留该额外业务的依据。

这是限定动作链的静态结论，不是「Codex 全应用没有知识、Library 或内容保存能力」。Artifact 专业编辑器的动态编辑动作、云端业务、其他产品面及实际点击结果未做全覆盖。本文不把证据不足的能力列为 Lime 保留特色；当前用户指定的差异仍只有主题、多模型与首页 Banner。

原始只读调查之后，root 已显式打开窄源码写窗，实施者完成消息/Artifact 入口、专用 helper、saveDraft、测试、文案与护栏迁移。前轮 Composer 冻结清单保持为历史；本轮重开写集另行验证，不冒充旧冻结点零漂移。未构建或启动 Electron，真实产物和 GUI 验收由 root 统一执行。

## 原件与 REA 证据

目标版本：Codex Desktop `26.1007.30912 / 20156`。原件：`/Applications/ChatGPT.app/Contents/Resources/app.asar`。ASAR SHA-256：`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。本轮重新核对的摘要与既有保全一致，没有执行目标应用。

使用 REA CLI `6.4.0` 的 `analyze-javascript-application` 静态分析。当前 CLI 未提供 `detail`，完整 JSON 输出写入本地后提取有界摘要。分析输入为从同一 ASAR 原始成员按 Acorn AST 范围提取的完整函数声明，不是拼接的伪代码。原件成员摘要、原始 UTF-16 半开范围、提取文本摘要和阅读副本分别保全；跨 chunk 的 import/export 映射人工读取原始 AST，不能理解成 REA 已自动解析所有外部引用。

| 证据 | 输入 | 静态覆盖与限制 |
| --- | --- | --- |
| `ev_5d90cd5b2a2786d2880ac9d452cf326f7664eeb7ac84ec16a5294c84587e3449` | 消息/文件/Artifact 21 个完整声明，160455 bytes；目录摘要 `390f99ad8daca9bf812f08e4da12b1d2d0279f33cce3102ec755b3cc6898ddbb` | 21/21 parsed，parse failure 0。graph partial；semantic partial/truncated，omitted 数量 unknown；32592 nodes、31154 relations、9436 unknowns。`turn-Sl.js`、`turn-as.js` 的语义图遇到父结果预算，原始语法与模块事实保留。 |
| `ev_a37943cc58f940a21e4f0455bb0d079629d48196eee6f2139bd88286ad76b6a7` | Save as、savedContent、Library favorite、Google Workspace consumer 共 10 个完整声明，20472 bytes；目录摘要 `b3baea1fa92687de6ade5b4326eccd4a995ab095ef2b818f5db41a17056704ef` | 10/10 parsed，parse failure 0。artifact graph complete；semantic status unknown，truncated false，omitted nodes/relations 0；1322 unknowns。 |
| `ev_061767f0321a26b09881a8a7698d4ae9fd1107c81911e5efb91c5aa5c8aaa397` | canonical history wrapper `bO`，以及前一组预算受限的 `Sl`、`as`，共 3 个完整声明，17324 bytes；目录摘要 `098c66da4259b1aecee82c45128686123bc004f4a96f9727a53f03649f537208` | 3/3 parsed，parse failure 0。artifact graph complete；semantic status unknown，truncated false，omitted nodes/relations 0；1103 unknowns。 |

后两组是不同 consumer 和剩余分支的聚焦输入；没有重复分析相同目录。全部 `targetExecuted=false`。semantic 的 unresolved receiver、dynamic call、dynamic property 与缺少外部定义仍为 unknown；零 parse failure 和完整输入 inventory 不等于完整语义覆盖。

保全目录：`/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/message-knowledge-entry-20261020/`。其中 `artifact-manifest.json` 记录 13 个完整 raw 成员的 ASAR byte offset、大小和摘要；`manifest.json` 与三个分组 manifest 记录完整声明范围和摘要；`raw/`、`readable/` 与三个输入目录保留原始和阅读证据。三个 `*-evidence.json.gz` 是完整 CLI Evidence 的压缩载体，`evidence-carriers.json` 同时记录原始 JSON 与 gzip 摘要，均已解压回读校验。临时工作目录为 `/tmp/lime-message-knowledge-audit-20261020/`。

`app-primary` 和 `app-initial` 复用同一版本已保全完整成员，SHA-256 分别为 `7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321`、`604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`；它们没有作为大包整体重新分析。

## 消息动作的正向调用链

原始成员：`local-conversation-thread-c8c5e92ea89e.js` → `local-conversation-turn-632904a8790c.js` → `sites-end-resource-78b98c374310.js`。

1. `thread.$k` 构造 `children(messageActions, messageHeader)`，普通本地路径最终调用 `o()`，未注入 messageActions。Aeon reply 分支交给 `thread.dD`，该完整声明调用 `children(null, userQuoteHeader)`；Reply/quote 和 reactions wrapper 没有注入知识保存动作。
2. `thread.tA` 把 messageActions 交给导入 `Sy`；其实际导出是 turn 的 `t → xl`。`xl` 定义在完整 `turn.Sl` 初始化声明内，是 memo 包裹的组件，并把同一参数传给 `turn.Lc`。
3. `turn.Lc → turn.as` 的助手分支把原有 additional/persistent actions 交给 `sites.vO`（导出 `w`，turn 本地导入 `Ua`）。Lc 的 `trailingAssistantMessageActions` 来自局部 `Qr`，该值赋为 `void 0`；它与同名 import 不是同一绑定。
4. `sites.vO` 普通分支调用 `nO`；有 canonical history identity 时调用 `bO → nO`。`bO` 从 read model 更新 item/content/completed/copyText，`...s` 原样携带动作属性，没有新增保存动作。
5. `nO → xx → Ax`：nO 直接透传 additional、persistent、trailing。xx 仅在相应 completed/shareSource/feature 条件下追加 `Bb` 单条 response 分享和 `Jy` native read aloud。`Bb` 调 response share dialog；`Jy` 使用 native-read-aloud key 和语音合成 owner。

`sites.Ax` 的完整动作清单为 copy、additional、persistent additional、rating、fork、auto review stats、hook stats、completed goal、memory citations、overflow、trailing。copy 把 response 文本/HTML 写入 clipboard；fork 调传入的 onFork。该本地 consumer 没有给 Ax 传入另外的 overflow/endAction；其扩展槽的实际 producer 已按上述链闭合。

压缩局部符号只用于精确定位；`Ax`、`xx`、`dD` 等不能作为上游开发源码的组件命名事实。

| 原件定位 | 完整声明 UTF-16 半开范围 |
| --- | --- |
| thread `$k` / `tA` / `dD` | `259415..262317` / `262384..267845` / `189813..192585` |
| turn `Sl` / `Lc` / `as` | `86396..92236` / `58160..83387` / `15806..23255` |
| sites `vO` / `bO` / `nO` | `325545..327090` / `327323..331353` / `296758..323118` |
| sites `xx` / `Ax` / `Bb` / `Jy` | `103393..119550` / `123787..128402` / `91363..92290` / `77703..78327` |

## 输出文件与 Artifact 的实际动作

`turn.sc`（`33681..43132`）包含完整输出文件卡片。主点击打开既有预览。菜单依次组织 Codex 预览、可用外部程序、程序加载状态、Google Workspace export、Reveal in Finder/Explorer/file manager、Download a copy。Download 调 `workspaceFiles.downloadCopy({conversationId, hostId, path})`，成功提示为 `Saved a copy to Downloads`，失败提示 `Could not download a copy`。

Google Workspace 动作的实际导出 `drive.r → dt` 继续到 `mt`。mt 在 upload、installPlugin、enablePlugin、connectApp、openPluginDetail 间选择；upload 读取本地文件或给定文件内容，通过 Google Workspace 导出，取得链接后打开链接并附加一次 context 通知。它不是 Lime 的 source/import、compile 或知识包选择。

Artifact preview 的 `artifact.xo`（`73342..106822`）构造文件菜单、下载控件、Library breadcrumb 与 favorite action。`artifactHeader.Ze` 的完整菜单包括可用外部程序、Google Workspace、Open in folder、条件 Open in GitHub 和 Download/Save as；`et` 的完整声明通过项目 origin/root/branch/path 形成 GitHub URL，再打开该 URL。`onDownload` 先消费传入回调，未传入时回到 `workspaceFiles.saveCopy({hostId,path})`。`artifactHeader.tt → nt` 同样消费 onDownload 或 saveCopy，并只围绕复制结果 path 记录成功、取消和错误。用户文案明确为保存到用户选择的位置。

`menuItems.oe` 包装的是 File info、Open in Library/Space、favorite、version history、分隔线和既有 children；`menuItems.V` 打开 file-info，`menuItems.K` 导航 `/library/file/:id` 或 `/space/file/:id`。`header.l` 选择直接渲染同一 header consumer，或经 wrapper 额外注入 versionHistory；actions 均原样透传。其实际 consumer 为 initial 导出 `n_ → uTc`，完整声明按 title/status/navigation/editing/history/primary/review/zoom/restore/download/share/supplemental/window-controls 组装 toolbar；Download/Share/restore 只调用相应传入 callback，编辑与补充动作来自 controls。另核实的 `libraryChrome.St → Ct` 也只把相同 actions、download/share/primary controls 交给该 header，不生成新的知识入口。本文没有据此推断所有专业编辑器动态动作均已分析。

### 普通 Save as、Library 与 savedContent 的区别

| 名称 | 已确认 producer → consumer | 与知识编译的差别 |
| --- | --- | --- |
| Markdown `Save as…` | initial `gsa` 构造 `workspace-file-save-as`，条件为非 workspace 来源且 saveCopy 可用；onSelect 调 `workspaceFiles.saveCopy({hostId,path})` | 普通文件复制。本文没有继续审计 Electron native save dialog 的更深实现；不声称运行观察到磁盘结果。 |
| Library favorite | artifact `xo → Bn`，实际 initial 导出 `kv → Mxc → Txc → Oxc → gxc` | gxc 添加时只 POST `/files/library/favorites`，body 为已有 `library_file_id` 的 `target_ref`；取消时 DELETE favorite_id，并更新 favorite/read queries。没有在该链导入消息文本或编译知识包。 |
| Open in Library/Space | menuItems `K` → 已有 library/space file route | 已有文件定位，不是新建项目知识来源。 |
| `savedContentResponseId` | xx 只在相应 `/ca/` route 形成 `{conversationId,responseId,savedContentBackend:APP_SERVER}` 并交 Markdown renderer；链接 consumer initial `w3c → D4c` | D4c 为链接展示/点击记录 `WORK_SAVED_CONTENT_LINK_RENDERED/LINK_CLICKED`，携带 savedContent identity。此对象不代表一个“保存为知识”动作。 |

## Lime 实际删除与 current 边界

调查时的业务链为：`MessageActionButtons / MessageArtifactCards / AgentThreadTimelineArtifactCard → 消息列表与时间线 → useAgentChatWorkspaceSceneRuntime → useWorkspaceMessageKnowledgeSaveRuntime`。它优先导航 KnowledgePage 的 saveDraft 分支，不能导航时经 `onImportTextAsKnowledge → importKnowledgeTextSource → importKnowledgeSource → compileKnowledgePack` 写入并整理知识包。

已直接删除该纵切，不保留 alias、compat 或 fallback：

1. 消息/Artifact 的知识保存按钮、可保存 badge、知识专用高亮、资格/source 计算与 callback 透传；失去唯一用途的 message source identity 透传及 persistent action 样式一并删除。
2. `useWorkspaceMessageKnowledgeSaveRuntime.ts`、`knowledgeSaveNavigation.ts`、`messageListKnowledgeSource.ts`、`knowledgeSourceImport.ts`、`knowledgeSourceSupport.ts`，以及三个只测试这些 helper 的文件，共 8 个文件。
3. `KnowledgePageParams.saveDraft`、save view/tab、专属初始化/effect/ref/目标选择/完成状态及 UI。实施后 ESLint 证实 `runImportSource` 也失去唯一消费者，已与专属 sourceFileName、直接 importKnowledgeSource import 一并删除；初步只读报告将其视作普通 import view 的共享函数，该判断已由实际调用检查更正。
4. 五语各 26 个专属 key（消息动作 3、save 页面 21、saveToMaterials 和 conversationResult 各 1），迁移旧正向测试/fixture/i18n 类型用例，并以文件打开和回流守卫替代。

[MessageArtifactCards.tsx](../../../src/components/agent/chat/components/MessageArtifactCards.tsx) 的普通文档展示与打开、[AgentThreadTimelineArtifactCard.tsx](../../../src/components/agent/chat/components/AgentThreadTimelineArtifactCard.tsx) 的文件打开/预览仍由既有 owner 处理。Markdown 文件测试保留同一 path/content，canonical timeline 测试验证 callback 透传；既有复制/引用动作不受知识删除资格影响。

[KnowledgePage.tsx](../../../src/features/knowledge/KnowledgePage.tsx) 的独立 route、目录/状态查询、普通 import view、资料选择与 Agent 导航仍有实际消费者。普通整理的真实 owner 是 `handleContinueKnowledgeOrganizeInAgent`，消费 sourceText 并带 knowledge_builder metadata 导航 Agent。底层知识 typed API、App Server 方法和协议没有在本切片删除。以上只是 current 调用事实，完整知识产品面仍待独立对标，不构成用户三项特色之外的额外保留项。

[边界护栏](../../../src/components/agent/chat/AgentChatWorkspace.workspaceBoundaryGuard.test.ts) 已迁移为专用 owner 不存在、保存字段/回调/saveDraft 不回流；原有 Harness guard 不再依赖已删除 runtime 定位调用范围。五语 loader 同时守住专属 key 不回流，documentBadge 与普通文档保存 copy 继续由独立消费者使用。

架构与前轮 Composer 报告/计划已同步当前边界。旧冻结与原始 REA 证据仍保留历史；主对齐计划/index/侧栏/Electron/Rust/协议由 root 及其它责任进程持有，本切片不夹写。

## 本轮验证、分类与未决项

- 原件成员完整 SHA、声明 UTF-16 范围和提取文本 SHA 已校验；31 个首批不同声明与新增 bO 共 32 个独立声明进入 REA，Sl/as 的聚焦补充覆盖单独记录，未把重复声明计成新 owner。另手工读取 et（`12946..13916`）和 uTc（`9975055..9984441`）的完整 AST 声明核实 GitHub 动作与 toolbar consumer，未声称这两个声明单独进入 REA。
- REA 三组输入合计 parse failure 0；语义覆盖限制如上。手工调用链引用来自完整声明及原始 import/export，而非仅字符串负搜。
- 定向 Vitest 首轮 13 文件 133 项中 132 通过，唯一旧 guard 定位失败已修正；受本轮修正影响的 3 文件 41 项复跑全部通过。strict ESLint 通过；renderer types 首轮通过，最终复跑结果由执行计划记录。日志在 `/tmp/lime-message-knowledge-removal-20261020/`。未构建或启动 Electron，root 持有整体验收。
- current：Codex 消息复制/分享/朗读与文件复制/Library favorite；Lime 现存独立知识页、选择与 API 仍活跃，是否最终保留尚未对标。
- dead / deleted / forbidden-to-restore：消息/Artifact 项目知识保存纵切、专用文本/导航 helper、saveDraft 与孤立 runImportSource。8 个文件已删除；负向护栏与 current 文件打开测试覆盖回流风险。
- compat/deprecated：本建议不新增。
- 本专项研究及删除实现完成度 100%；受影响定向行为与结构清理已验证。真实 GUI 验收仍待 root，不能据此宣称整体 Codex GUI 对齐完成。

未决：真实点击行为、平台保存对话框更深 consumer、专业编辑器动态菜单、其他产品面和知识系统整体去留。不得把这些 unknown 写为已对齐或全应用不存在。
