# 导航、页头、Composer 与队列核对

核对日期：2026-10-14。状态：静态参考与实施映射；产品验证以 [current 执行计划](../../exec-plans/codex-gui-alignment-current-plan.md) 为准。

`QueuedMessageList` 和 `ComposerUtilityBar` 已直接替换旧 owner。线程/请求隔离、富输入保真、Header 编辑身份、公共 pending 历史/搜索隔离已完成定向验证；Composer 的真实项目/Git/冷重启 Gate B 已通过。pending Queue 的新版真实 Gate、Browser 完整 tab 恢复及默认门禁正在收敛。剩余差距包含 active-turn Steer、暂停/交付状态、拖拽排序、完整 Composer 与 staged worktree/remote；不能由名称迁移推导全面等价。

## 证据与边界

- 目标：`/Applications/ChatGPT.app`，bundle ID `com.openai.codex`，版本 `26.1007.30912`，build `20156`。
- ASAR SHA-256：`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- 复用 REA application Evidence：`ev_7e96cf795451f834a7bddc70daacbc950320070656781f6347f1cf9c759e4299`。
- 复用 surfaces Evidence：`ev_4d5f0a6abe02d9b92d4a6ecf6517984bef62ef39e8da072bdac0bf7950c22c7a`。
- 已选模块的 readable copy 位于 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/readable-artifact/`；来源清单为同目录上一级的 `selected-artifact-manifest.json`。
- 本次另按既有 `asar-inventory.json` 中的 offset/size，只读读取少量 ASAR 成员到内存，并核对各成员 SHA-256 与 ASAR integrity。随后仅把 Queue 单个 chunk 的原始字节提取到用户级分析目录，补一轮 focused REA；未运行目标代码或写入源包。
- Queue 的新 REA Evidence 见下节。其他三个新读取成员仍仅有手动静态证据；不能冒充既有 REA 已分析这些成员。原始字符串位置是从已核对 SHA 的 chunk 直接读取的手工锚点。
- 未操作 Codex GUI；此前对 `com.openai.codex` 的 Computer Use 拒绝继续有效。Lime Electron 的实施证据单独记录在 current 计划，不反推参考应用运行效果。

新增只读成员中与结论直接相关的记录：

| ASAR 成员（均在 `webview/assets/`）           | SHA-256                                                            | 可确认导出                                                      |
| --------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `queued-message-list-77acfdcb3f8a.js`         | `f4a09693e66fc208014ac2fb5d0c00c1a3949375d0b410348b56db569729d9dc` | `QueuedMessageList`                                             |
| `thread-app-shell-chrome-c6e5ce470743.js`     | `ffa2fa681999de4bc2331a51647906ab3b817906e3ea24ac24d4bb3e9f16d26f` | 只有 `a/c/d/f/i/l/n/o/p/r/s/t/u` 等压缩别名；原始组件名 unknown |
| `thread-panel-header-actions-74e32e537b3b.js` | `3094cdd566a70f06e506982eeef5d419f62127e344fae59b8e83d2338f3d7ce0` | 只有压缩别名；原始名称 unknown                                  |
| `thread-overflow-menu-95b62ccc8390.js`        | `e838629b682913c714355f054ed1dc13cacfe711041197a199679d89ff116ef2` | 只有压缩别名；原始名称 unknown                                  |

`QueuedMessageList` 原始源码 UTF-16 字符串锚点（从 0 起，可用 Node `indexOf` 复核）：

| 位置    | 原始短片段                                                 | 支持的观察                                                         |
| ------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `3806`  | `onEditMessage:d`                                          | 列表接收编辑 callback，与删除、排序、立即应用一起由外部 owner 提供 |
| `6849`  | `clientUserMessageId??e.id`                                | 行 key 优先使用 client message identity                            |
| `8519`  | `status===\`pending\``                                     | pending/sending 参与提交状态呈现                                   |
| `8613`  | `outcome-unknown`                                          | 送达未知状态有独立呈现                                             |
| `12167` | `tabIndex:0`                                               | 完整消息预览内容可通过键盘进入并读取/复制                          |
| `13058` | `role:\`group\`,tabIndex:0`                                | 折叠预览可获焦点，accessible label 包含队列位置和最多 80 字符摘要  |
| `14848` | `defaultMessage:\`Submit without interrupting the model\`` | 立即应用的产品语义是不中断当前运行的 steering                      |
| `18663` | `onDragEnd:c`                                              | 重排具有拖拽处理路径；不能只凭文案断言拖拽                         |
| `21611` | `defaultMessage:\`Steer\``                                 | 立即应用按钮显示 Steer，而不是启动另一个空闲回合                   |

### Queue 单 chunk 的 REA 补证

2026-10-14 先检索已有 `application-evidence.json`、`surfaces-evidence.json`、`timeline-evidence.json`、`approval-analysis-evidence.json`，没有这个 chunk 的模块或字符串记录；既有 44 文件提取 manifest 也不含该成员。因此仅新增一次单 chunk 分析，没有重复全包。

```bash
rea analyze-javascript-application "/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/queue-evidence" --artifact-format directory --max-heap-mb 512 --analysis-timeout-ms 60000 --format json
```

- CLI：REA `6.4.0`；既有 `rea` wrapper 使用隔离 Node `24.21.0`，不改变系统 Node/PATH 配置。
- 原始成员：`webview/assets/queued-message-list-77acfdcb3f8a.js`，21,874 bytes；ASAR 绝对数据 offset `411863310`。SHA-256 `f4a09693e66fc208014ac2fb5d0c00c1a3949375d0b410348b56db569729d9dc` 与 integrity 一致。
- parent Evidence：`ev_b2f93fdf5156589566b6f36f922085b8f76f3a1b99f02997f3b0c74188fd3578`。
- summary view Evidence：`ev_93e7d0675e7778b002f38024a737c3415a7ef1436d6d5a296c0b243f36a001e1`，其 parent 指向上述记录。
- 一文件目录摘要：`f5edc666c03ec3517bf6f5db90e7fb4dc80da33261d38663df17ce73fe264711`；这是抽取目录的 identity，不能当作安装包 ASAR 摘要。
- source-module node：`jag_node_29270366c35f93b06976427f1e9fe8c2c105867682271ef230185bf77263cd92`。
- `QueuedMessageList` module-export node：`jag_node_6fc6257518a551914483061b1cfc0410777aced3e311871d6a4a6dcca863f802`；导出名由 REA 与原始 `export{ze as QueuedMessageList}` 双重核对。
- 结构 coverage `complete`、`truncated=false`、`omitted_count=0`；仅指这个一文件容器。解析 1 个 JS、21,874 bytes、5,246 AST nodes、92 findings，parse failures=0、invalid UTF-8=0。
- semantic coverage `unknown`、`truncated=false`，保留 3,062 nodes、3,133 relations、1,005 unknowns；call-flow/data-flow/object-flow 分别有 191/261/553 个 unknown，其他 families 也只标 partial。不能把结构 complete 写成语义完整。
- 导入依赖与引用 source map 没有抽取，跨 chunk callback owner、网络/IPC、实际 queue 消费事务及运行 reachability 未验证。REA 仅解析 inert syntax，未执行 bootstrap/目标 JS；动态属性与跨函数 mutation 仍 unknown。
- 原始 Evidence、summary、进度和 extraction manifest 均留在 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/`：`queue-analysis-evidence.json`、`queue-evidence-summary.json`、`queue-analysis.progress.jsonl`、`queue-member-manifest.json`。仓库只记录结论与 identity，不纳入应用源码或完整 Evidence。

## 当前映射与清理

| 上游参考                                 | Lime current owner                                                                                                                                                                                                                          | 行为与验证边界                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QueuedMessageList` confirmed export     | [QueuedMessageList](../../../src/components/agent/chat/components/QueuedMessageList.tsx)、既有 scoped reader / typed actions                                                                                                                | 默认计数，展开全文与第一图，编辑/重排/删除；同步整队 mutation 锁、thread/request 身份和 A→B→A 防护。完整 rich input / client identity 不丢失；新版 pending Gate B 已通过；active Steer 另立合同 |
| `ComposerUtilityBar` confirmed export    | [ComposerUtilityBar](../../../src/components/agent/chat/components/Inputbar/components/ComposerUtilityBar.tsx)、[useComposerUtilityActions](../../../src/components/agent/chat/components/Inputbar/components/useComposerUtilityActions.ts) | home/navbar 复用，project ID + rootPath/request 隔离，Git loading/error/retry、五语言和主题 token；343 项定向回归及真实项目/Git/冷重启 Gate B 通过                                              |
| Header actions / overflow / shell chrome | [ThreadWorkspaceHeader](../../../src/components/agent/chat/workspace/ThreadWorkspaceHeader.tsx)、既有 workspace shell                                                                                                                       | 旧编辑绑定开始时 session；切换取消，旧 blur/Enter 不提交新线程，重复提交与焦点有回归。上游原始组件/函数名仍 unknown                                                                             |
| 主导航                                   | `src/components/app-sidebar/`                                                                                                                                                                                                               | 已有项目分组、搜索、分页、置顶、归档；已读领域 sidebar 与 icon chunk 不能当作主导航源码，整体原始名称和逐项等价仍待核对                                                                         |
| 主 editor / model / permission / send    | 既有 Inputbar section/core、input-kit 与 current runtime gateway                                                                                                                                                                            | 不属于已确认 UtilityBar callable；主路径 focused Evidence 已取得；附件/IME 已进入验证，完整富文本 editor 仍待替换                                                                               |

旧 `ThreadQueueStatus`、`InputbarProjectContextBar` 组件及旧正向测试为 **dead / deleted / forbidden-to-restore**。已迁调用者、类型、fixture、selector 与 physical-delete 回流守卫；没有新增 compat/deprecated 或 alias。Inputbar 未消费的 context props 与 workspace 透传已删除；home/navbar 的 current project 输入继续使用同一 owner。

`queuedMessageInput` 是唯一文本编辑转换：未修改时保留原 blocks / text_elements；修改时在首段位置写一段文本，保留非文本相对顺序并清除失效字节范围。中文/emoji、多文本、非文本、无修改保存与迟到 success/error/finally 有确定性回归。Header 与 Queue 的作用域回归不由单次截图代替。

Gate 接线沿 `queued-message-list[data-thread-id]`、`queued-message-action-list`、`queued-message-item[data-submission-id]` 与 `data-queue-action`。旧 `thread-queue-items` 不得恢复。真实 Gate 必须证明 GUI mutation、typed request、canonical readback、同 Thread identity、零 mock/error；验证命令与实际结果由 current 计划维护，不复制第二份过期 VerificationContract。

## 未关闭合同

| 合同                                 | 已知事实                                                                                  | 后续约束                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Queue → active-turn Steer            | 安装包按钮为 Steer，tooltip 明确不中断模型；Lime `thread/queue/start` 仅 idle admission   | 复用既有 runtime steer owner，绑定 expectedTurnId/client message identity；不能先 renderer delete 再 steer 制造丢消息窗口 |
| 暂停与交付状态                       | 包内含 paused/retry/resume、sending/outcome-unknown；现有 public queue DTO 未提供同等投影 | 从唯一 canonical owner 暴露状态，不能用 renderer 本地枚举伪造已送达或暂停持久化                                           |
| 拖拽排序                             | 包内有 onDragEnd；当前 GUI 上下移动有确定性回归                                           | 迁现有 reorder authority，键盘与拖拽共享顺序合同                                                                          |
| staged worktree                      | 上游可确认 draft mode；Lime 当前点击立即创建并导航                                        | 单独定义 draft / submit handoff，不能用改名或 Local 文案掩盖                                                              |
| remote / environment / full composer | UtilityBar 有 readiness、existing workspace、read-only 和 execution target 字段           | 继续从 current transport/environment/workspace owner 接入；无证据处 unknown                                               |

主导航和窗口视觉仍需补证；主 Composer 已取得独立 focused Evidence，adapter/controller/editor 映射、附件 generation 与 IME 见 [主输入审计](./main-composer-audit.md)，完整富文本结构仍待实施。`sidebar-actions` 实为 entity/place details，`sidebar-CVOwfery` 是 panel-left 图标，`SectionNavigation` 是分节会话；不能机械迁成全局导航 owner。`BrowserSkillsComposer` / `submitWithBrowserSkills` 是浏览器技能提交，`createSketchComposerState` / `SketchComposerHost` 是 Sketch，不是主 Composer。

## ComposerUtilityBar focused 证据

本节保留单模块 REA Evidence、原始 props 和 callable 锚点。只证明指定安装包的静态职责；当前本地类型/动作 hook 名是领域设计，不能冒充已恢复的上游类型名。

### Evidence 与覆盖

既有 application Evidence 对该成员的 `static_analysis` 已完成，但 `semantic_module_analysis` 为 null，记录原因包括累计 parent result 容量、`semantic_result_budget_bytes=0` 与 expanded projection 超预算。因此只把已经提取的原始成员复制到一文件容器补一次分析；没有重跑全 ASAR，也没有执行目标代码。

```bash
rea analyze-javascript-application "/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/composer-utility-evidence" --artifact-format directory --max-heap-mb 512 --analysis-timeout-ms 60000 --format json
```

| 记录                | identity / coverage                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 原始成员            | `webview/assets/composer-utility-bar-7738f1184086.js`；138,849 bytes；SHA-256 `c2ad85c7ba23ec86fdfc3ddda0b223cb70e09862f66e92f26cdc5616f5044c0e`                                           |
| 一文件容器          | SHA-256 `4d3f1dd014d6d1af57543ffe5db5a1432ea689e31d568bd794b0217ea9768b18`；只标识抽取目录，不是 ASAR 摘要                                                                                 |
| focused parent      | `ev_a12d13494c92f390f31b4493b08cc34bd42867413b8d6fcfbe597601fad22a18`                                                                                                                      |
| module page view    | `ev_1be4765462236c8e509f27b623edeabe32c1152c01773c383cdc339d66544be2`；modules offset 0 / limit 16；examined 16 / total 27 / next_offset 16；这页不是完整模块清单                          |
| source-module node  | `jag_node_5b6c5c9da21484632e9ddf16ebaafbf25e719bb70fcceff8d35d469fd09f824b`                                                                                                                |
| export-binding node | `jag_node_cc542a9dd5982e6be4b20cfdce000f1e80bd467164153a377693c784ec63aebd`                                                                                                                |
| export item view    | `ev_d226fcac113fff14952965ae9465453d279c1f1431cdef57be2026d60b9e06d9`；同 parent；`complete-within-view`，只选一项，不代表 parent semantic 完整                                            |
| 结构分析            | `complete`，`truncated=false`，`omitted_count=0`；1 JS，46,368 AST nodes，425 findings；parse failures=0，invalid UTF-8=0                                                                  |
| 语义图              | `partial`，`truncated=true`；保留 20,000 nodes / 23,008 relations / 9,204 unknowns；raw limit 为 `semantic_graph_node_ceiling=100000`，omitted nodes/relations 为 null，不能自行推算缺失量 |
| export 观察         | `ComposerUtilityBar` 是 exact observed 导出名；local `Zl` 是压缩名；callable `callable:function:123138:138208`；export source range line 1 column 138728–138752                            |
| return shape        | 3 个 direct return sites 均保留，`projection_complete=true`；三个 value 全为 `unknown`，原因 `Unsupported SequenceExpression value.`；站点 complete 不等于返回值或行为完整                 |

原始 Evidence、view、输入与进度在 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/` 的 `composer-utility-analysis-evidence.json`、`composer-utility-module-page.json`、`composer-utility-export-view.json` 和 `composer-utility-analysis.progress.jsonl`。跨 chunk 依赖和 source map 没有纳入这次单文件补证；真实 handler 执行、网络/IPC 和 runtime reachability 仍 unknown。下节是结合已核对 hash 的原始/可读文本作的手动静态观察，不声称 REA return-shape 已恢复 React 输出。

### 原始字段、handler 与界面职责

`function Zl(e)` 直接 destructure 的 23 个字段如下；这些是可确认原始拼写的 props，不把压缩变量名当作上游 API：

```text
asyncThreadStartingState, variant, isHidden, composerMode,
worktreePromptContext, setComposerMode, isResponseInProgress,
isWorktreeAvailable, worktreeEnvironmentHostId,
worktreeEnvironmentWorkspaceRoot, codexHome, homeAuxiliaryControl,
showRuntimeControls, hideRunLocationDropdown, showWorkspaceDropdown,
gitRootForStartingState, startingStateRepositoryKey,
showUtilityBarBranchWhen, freeUpsellButton, remoteConfig,
activeProjectIdOverride, onProjectChange, localRemoteExecutionTarget,
existingWorkspace
```

| 职责                     | 静态观察                                                                                                                                                                       | 推导与限制                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------- |
| Project/workspace picker | 注册 `composer.openProjectPicker`，传入 enabled predicate；选择时有外部 `onProjectChange(e)`，无 callback 时写当前 store；host 条件影响 local/remote projects/actions 是否允许 | 它选择新任务 workspace/project；不是更改已有 thread 的项目归属。shortcut 代码存在不等于已观察实际键盘响应 |
| Run location             | `composerMode` 分支为 local/worktree/cloud；传 `setComposerMode`、execution target、remote selection、handoff 等给子控件                                                       | 完整执行 target 合同跨 chunk unknown；仅可确认这是运行上下文控件                                          |
| 新任务 worktree          | local/worktree toggle 调 `setComposerMode`；带 `composer.toggleWorktreeMode` shortcut 和 worktree slash-command handler；父分支传 `allowWorktree:!z&&!c`，菜单 `disabled:!f    |                                                                                                           | c`  | 可观察到 draft mode 选择路径及 response/readiness gate，不能据此断言点击当场创建 worktree。相关 helper 原始名称和实际副作用未恢复 |
| Existing workspace       | 有 existing workspace/worktree label、source task tooltip 和 workspaceRoot；branch 子控件传 `isReadOnly:A!=null`                                                               | 已有上下文与新任务 mode 选择分开；不能把 existing workspace 一律当可改的 draft                            |
| Branch / environment     | branch 传 hostConfig/cwd/gitRoot/localConversationId/isLoading/isReadOnly；worktree environment 使用传入 hostId/workspaceRoot，区分 loading/error/config repair/settings 路径  | readiness 是数据与可操作性合同，不是只加一段 Local 文案；跨 chunk service 行为 unknown                    |
| Home / default layout    | home 返回 `Qa`/受限分支 `ps`；default 经 `Ii` 包装 left controls 与 trailing controls；cloud follow-up、Create git repository、upsell 有各自条件                               | `Qa` / `Ii` / `Ul` / `Kl` / `Vc` 等仅压缩 local/export 别名，原始组件名 unknown；不机械迁这些名字         |

在 `Zl` 完整 callable 范围内，没有 model/reasoning/permissions/attachment/send props 或这些控件的直接 JSX。这个负搜索只限定该 callable，不能证明全 app 没有这些能力；也不能把 Lime 整个 bottom bar 改名为 UtilityBar。主 editor 的草稿、IME、附件和发送仍是独立调查范围。

原始字符串的 UTF-16 index（从 0 起）：锚点限定在 exported callable `Zl` 的范围；同名 props 可在前面的 helper 重复出现，不能使用全文件的首次匹配替代本表位置。

| index  | 原始锚点                                                |
| ------ | ------------------------------------------------------- |
| 123138 | `function Zl(e)`                                        |
| 123174 | `asyncThreadStartingState:n`                            |
| 123222 | `composerMode:a`                                        |
| 123261 | `setComposerMode:s`                                     |
| 123422 | `showRuntimeControls:y`                                 |
| 123683 | `existingWorkspace:A`                                   |
| 126367 | ``operationSource:`composer_content` ``                 |
| 129730 | `isReadOnly:A!=null`                                    |
| 131720 | `allowWorktree:!z&&!c`                                  |
| 132471 | ``Tr(`composer.openProjectPicker` ``                    |
| 133057 | `onProjectSelected:e=>{uo(M),O==null?Gr(M,Fr(e)):O(e)}` |
| 136972 | ``presentation:`menu` ``                                |
| 138145 | `children:[Or,Dr]`                                      |
| 138721 | `export{Zl as ComposerUtilityBar}`                      |

readable 副本 `function Zl` 从 7433 行起；7193 行附近 `Kl` 是 local/worktree mode 与 shortcut/slash handler。readable 行号仅辅助阅读，member hash 与原始 UTF-16 range 才是本次 identity。

## 2026-10-14 public pending 与缩略校准

公开Codex `ext/queue` 将pending存于独立queued_items；admission成功后才启动执行Turn。Lime保留现有内部durable materializer/User Item与媒体，publicread/list/resume和Turn/Itempaging排除pending；不新增v2Turn queue字段。证据索引记录current源码revision、源文件SHA和边界。sidebarresume会唤醒idleQueue，因此真实Gate先启动并中断一个current external基线回合，再添加pending，验证同loadedruntime暂停、idle与pending排除；不声称跨unload/restart暂停持久化。

同一REAQueuechunk的UTF16offset11048含size-6的img，来源为submissioncontext第一张图片preview。当前`queuedMessageInput.getQueuedMessageImage`通过既有`MessageImageAttachments`thumbnail和`media/read`读取第一图；collapse卸载并取消请求，五语言alt/unavailable复用既有文案。新 public projection / Queue / media 等 9 文件 76 tests 通过；公共搜索新增 store 6 + JSONL 11 tests 通过，正向执行基线与 sourceKinds=appServer 防止负向空跑。新版真实 pending Gate 已通过富输入 mutation、public history/paging/search 排除及首图 media 读取；旧 transcript 正向 Gate 不再适用。
