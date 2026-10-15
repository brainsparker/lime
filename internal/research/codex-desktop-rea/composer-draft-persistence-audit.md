# Composer 草稿保存补证

最新修复（2026-10-15）：current 聚合第15场发现 Skills 试用完成但 Composer 仍禁用，程序化初始发送未提交真实新 session 绑定。既有 CommandWiring 现将 canonical accepted 回执交回可见 topic commit；真实集成先红后修，61/61、标准 typecheck/lint/格式通过。新产物的原 Skills 场景三条路径及 Electron 壳均通过，完整 current 聚合22/22及4组定向全部通过，默认门禁正按原失败批次续跑。源码/产物身份见 packet22；不能以 packet21 四合同覆盖新修复。定向与构建收据分别为 `.lime/qc/composer-persistence/imperative-session-scope-repair-directed-receipt.json`、`imperative-session-build-recovery-receipt.json`。

状态：current / Host、同源索引、Coordinator、Controller、typed acceptance 与公开新建导航已采用。packet21 的三入口完整富输入首发、rich Stop、Home 冷零写、三工作区两次正常冷恢复均通过；后续 packet22 接线修复按上段单独验收。旧 general 随机 draftTab/discovery 已删除，参考应用是否有全草稿 picker 仍 unknown。整体 GUI 为 partial。下文迁移前缺口和逐轮失败保留为历史证据，不作为当前待办。状态校准日期：2026-10-15。

沿用 [证据索引](evidence-index.json) 的 Codex Desktop 版本、ASAR 摘要及已提取 primary/initial/main 成员。本次仅从同一 ASAR 提取 `app-shared-8bd9d0399038.js`，SHA-256 为 `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245`；没有运行参考应用或 bootstrap。

REA focused Evidence：`ev_6ac3324c94242434149d9b820ee6cecdc0165021adadac0bdca91254ab787c29`。37 个 inert 声明、20,685 bytes、structural complete、semantic unknown、parse failures 0。以下函数调用与字段是同摘要原文件的普通 AST 观察，不将其提升为 REA 语义或运行证据。所有区间是原文件 UTF16 半开区间。

## 保存合同

| 观察             | 字段/职责                                                                                                              | 原成员与锚点                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| retained key     | `composer-retained-documents-v1`                                                                                       | initial `[3766414,3766450)`                                                           |
| prompt key       | `composer-prompt-drafts-v2`；legacy 为 `composer-prompt-drafts-v1`                                                     | initial `[3766451,3766533)`                                                           |
| retained 形状    | `record[scopeKey] = {document: PM JSON, plainTextMode, prompt: serialized string}`                                     | initial `pYr [3757567,3757889)`                                                       |
| prompt 形状      | `record[key] = {prompt: string 或 {document, plainTextMode}, pullRequestChecks, ...}`；包含其他 PR/worktree 选项       | initial `hYr [3758005,3758132)`、`BYr [3763797,3764333)`                              |
| local scope      | 有 conversationId 时使用 `local:${conversationId}`                                                                     | initial `mYr [3757889,3758005)`；shared `uY [3643081,3643120)`                        |
| client scope     | local 按 clientThreadId 读取；更新同时写 client key 与 canonical key                                                   | shared `C0r [5479715,5480220)`；initial `BYr`                                         |
| 其他 scope       | home 为 `new-conversation`、panel 为 `panel-new-conversation`、cloud 为 `cloud:${taskId}`                              | shared `tY [3638952,3639069)`、`C0r`                                                  |
| JSON 校验        | `schema.nodeFromJSON()` 异常捕获后返回 undefined                                                                       | initial `XYr [3765734,3765819)`                                                       |
| 文档更新         | document-change 写 prompt；250 ms 合并发布，删除立即发布                                                               | primary `[1421755,1421828)`；initial `Kfn [1958913,1959380)`、`Jfn [1959388,1959454)` |
| dispose          | prompt 非空且未被 retention 遮蔽时写 retained                                                                          | primary `[1421916,1421986)`                                                           |
| provider cleanup | layout-effect cleanup 调 `I(o.view.state.doc)`，随后延迟 destroy；外部注入 Controller 路径跳过此本地 provider 生命周期 | initial `Rhl [11201687,11205921)`；调用 `[11204990,11205009)`                         |

底层是 renderer persisted atom，经 `persisted-atom-update` 交给 Electron main 的 `globalState["electron-persisted-atom-state"]`，再同步窗口。main 复用 Evidence `ev_7e96cf795451f834a7bddc70daacbc950320070656781f6347f1cf9c759e4299`：`sendPersistedAtomState [2109810,2110244)`、`updatePersistedAtomState [2110244,2110842)`、`broadcastPersistedAtomUpdate [2110842,2111121)`。两个 composer key 不命中 browser-tabs 主窗口过滤和 avatar 排除集合；key 本身无 workspace 或 execution host 组成部分，账户隔离范围未知。

main 原成员 `.vite/build/main-CqEoQDOU.js` 的 SHA-256 为 `09d19386e1f23cf4ccbc950fc40d85a1e8a064a08be588b2a4be6a89f6ada9e6`。同摘要有界 AST/文本补证确认 record update 分支；以下压缩符号只用作原成员锚点，不是上游原始函数名，也不是新增 REA 语义结果：

| 锚点                                         | 可观察合同                                                                                                                                        | 限制                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `hR [1442853,1443856)`                       | 按 entry 校验 `expectedValue` 深相等；支持 delete/createOnly/updateOnly；timestampField 拒绝较旧值；支持 maxEntries/maxBytes/minNumericValue 限制 | 条件更新在 main 当前记录上执行，不证明磁盘事务或强杀耐久    |
| `pR [1442392,1442853)`                       | 仅对 `cloud-aeon-sidebar-cache-v1` 做 account/user/host/revision 与刷新时间冲突判断                                                               | 普通 composer key 直接通过，不能称为通用 CAS                |
| `updatePersistedAtomState [2110244,2110842)` | record update 或整值更新后调用 `globalState.set`，随后 broadcast；拒绝特定冲突时广播当前值                                                        | main 的写入/窗口同步顺序已确认，底层 store 落盘实现仍未追到 |

主退出路径存在 flush/flushOrThrow 调用。继续沿 bootstrap/require 补证后，最终文件与原子替换静态实现已确认，异常退出耐久仍 unknown；退出路径字符串不能提升为跨重启运行证据。

### Main 落盘 owner 补证

同一 ASAR 新提取 bootstrap 与 startup-requirements，成员 integrity SHA 均匹配。REA Evidence `ev_6b726d05b1186a46c3e78398b4559cddd089b886382b8619d60fb2d509426d15` 读取2个文件577112 bytes，parse failures 0；semantic worker heap exhaustion 导致 graph incomplete。下表链路由完整原成员的普通 Acorn AST 和有界文本确认，不冒充 REA semantic 或运行证据。

| 成员身份与原 UTF16 锚点                                                                                                                               | 静态观察                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bootstrap SHA `d1ab6d0bb5aabf4d56a3cb39d979dc1145e41b47be6821b967cba3802af3fbf0`；`cT [392401,392430)`、`uT [392448,392496)`；初始化调用位置393416    | Codex Home 下的 `.codex-global-state.json` 交给 startup-requirements 的 export `D`；返回值持有同一个 globalState。临时 Windows framework gate 的另一构造调用不作为 Composer owner |
| startup-requirements SHA `73f93b81152bff48cd27bcebcf27c430fb763e5c7418c67824950f4092ba933d`；export `D [108859,108935)`→压缩 class `Vr [78657,81594)` | class 持有状态Map、变更监听器、串行persistQueued和各类保存调度；constructor读取同一filePath。`D`与`Vr`只标识安装包，不是上游开发源码类名                                          |
| `Or [75305,75311)`、constructor `[78886,79081)`、persistForKey `[80853,81391)`                                                                        | `electron-persisted-atom-state` 经500ms debounce进入main保存队列；renderer先前250ms合并和main debounce是两个阶段，broadcast不等于已落盘                                           |
| flushWith `[80611,80853)`、queueGlobalStatePersistence `[81391,81593)`、`qr [82452,82580)`、`Jr [82580,82652)`                                        | flush取消待执行debounce并排队保存；普通保存记录错误，flushOrThrow传播错误；JSON状态依次写主文件与 `.bak`                                                                          |
| `Yr [82652,82766)`、`Xr [82766,82897)`、`Zr [82897,83254)`；`Ar [75346,75362)`                                                                        | 同目录UUID临时文件写完后rename；失败清临时文件。异步Windows rename遇EPERM/EACCES/EBUSY按100/200/400ms重试。此有界实现未见fsync，不证明断电耐久                                    |
| `Wr [81655,81860)`、`Gr [81860,82355)`                                                                                                                | 主文件存在但无效时尝试 `.bak`；主文件缺失直接空Map。解析与已知key schema校验失败记录日志，无效已知key丢弃                                                                         |

原成员、REA全量Evidence、AST observations与member manifest仍只在本机分析目录。这里关闭文件/类/保存与恢复算法的静态未知，不关闭真实退出、重启、强杀、账户隔离或附件持久化验收。

页面隐藏、pagehide、显式 reload 有刷新待发布项的静态调用：initial `[10209700,10209817)`、`[10209818,10209920)`、`x9c [10809241,10809368)`；shared `VRt [2137967,2138016)`。这不证明强杀或系统崩溃的耐久性。

## 提交保护

主模块 Evidence `ev_18100ea823ab540f529ba756499161870e17f824267ed48a0665d3fb48cd0bb4` 的 `Put [1278163,1292894)` 先遮蔽匹配旧草稿。`locallyAccepted || requestDispatched`、queued acceptance 等分支调用 `finish(true)`；失败/finally 调 `finish(false)`。恢复还检查 marker identity、草稿相等和新资源；delivery outcome-unknown 的特殊分支也可能消费 retention。不能概括为所有失败都恢复，也不直接替换 Lime 已有的明确接受结果与 revision 保护。

这两个 key 未直接写图片数组、路径资源数组或完整 attachment view state。相关资源有独立的 `DXr/NV/TXr` 等 owner，未追踪其完整保存链；不能据此宣称 Codex 附件不能持久化。

## 迁移前缺口与接点（历史基线）

本节保留迁移前问题与接点，不能作为当前缺失清单；正式采用状态见文末。

研究初始 workspace 内唯一 Controller 由 `useAgentChatWorkspaceLocalDisplayState` 创建，跨 Home/Inputbar 共享，但无 scope key、keyed draft map 或持久保存。导航通常复用同一 workspace mount；离开 Agent 页和重启会销毁实例。`TaskCenterDraftTab` 仅有 ID、标题、时间和状态，是导航 metadata。`agentSessionScopedStorage` 存 transcript/read model，`promptHistory` 存已提交正文；两者均不能充当未发草稿 owner。

迁移前首发转绑定曾有两条路径；materialization已删除，以下仅为历史基线：

- 预热/显式 materialization：`useTaskCenterDraftMaterializationRuntime` 记录 draftTabId→newSessionId，`useTaskCenterDraftSendDispatchRuntime` 在 dispatch 前提交导航转换；有 acceptance callback 时 preserveInput 延续 revision。
- 直接首发：`useTaskCenterDraftSendRuntime` 将 sourceDraftTabId 与正式 session 交给 `useWorkspaceTaskCenterSendRuntime.handleNonMaterializedSessionReady`；无 draft tab 的首页分支也必须覆盖 home→session。

sessionId 与 canonical threadId 必须分别处理。`appServerSessionClient` 的 `thread/start` 返回 sessionId，`useAgentSession` 从 read model 建立 thread_id 映射。首发持久 scope 转绑定不能调用 restoreDraft 改动尚待 acceptance 的 revision。

最小现有 JSON 封装为 `agentChatStorage.loadPersisted/savePersisted`；Chromium sessionData 根由 `electron/appDataPaths.resolveHostSessionData` 统一处理 macOS/Windows。研究初始没有通用 DesktopHost JSON KV 合同；本轮已采用 PersistedAtomHost/Store/File、纯 JSON protocol 与唯一 persistedAtoms gateway，以下是迁移前选型约束：如对齐 main persisted store，应扩展既有 Host 边界并同步 IPC/preload/gateway/catalog/tests，不能借用 model-provider 的 UI state 或建立第二业务 runtime。`savePersisted` 当前在 try 外 stringify、无成功结果且 quota 失败会删除旧值重试，不能直接用作已保存证明。若选用该封装，最小合同应为 try 内序列化、拒绝 undefined、单次 setItem 返回成功状态、写入失败保留旧值；草稿 owner 必须消费返回值。`isStorageQuotaError` 仍服务 transient storage，不能随此迁移删除。

候选清理：scope 导航的 reset+setInput 改为唯一 owner 的保存旧 scope、切绑定、恢复新 scope；显式 clear 和 acceptance 后条件 commit 仍须分别处理，避免无条件写空覆盖旧 scope。具体实施必须先登记 Verification Contract 与架构图。

接受结果还需要按发送时 scope/version 消费已接受的旧草稿：导航后 `Controller.commit` 因 revision 或 scope 变化返回 false 时，不能让已发草稿在下次启动复活。首发 scope promotion 仅转绑定，不推进等待接受的 receipt revision；现有Home/搜索新建/项目新建均沿唯一发送链分别回归。session identity 与 canonical Thread identity 分开记录，不用已有 provider UI state 承接草稿。

## Renderer 接线设计（2026-10-14）

本节是 Lime 的实施合同与 current 源码审查，未声称参考应用运行行为或 GUI 已完成。迁移前只读映射覆盖55个源码文件、134个锚点，全部摘要零漂移；43个验收场景。隔离设计manifest为 `7085719e0e5982acf7dfe25385cb307de06ed9d8ab3b137bcc660568b5addcc4`。Host13文件121项、gateway/fixture4文件70项、Main/IPC/诊断接线16文件80项属于迁前隔离验证记录，不覆盖后续正式源码身份。Host、索引、typed acceptance、coordinator 与 root 导航现已正式采用，后续验证见文末。

保存 owner 固定为 Main 同一 `composer-drafts-v1` atom；renderer coordinator只持有投影、绑定generation和待发mutation队列，唯一可编辑文档仍归Controller。renderer250ms、Main500ms分别合并；发送不await保存、无checkpoint或Quit握手。Main广播仅metadata，update应用成功与savedRevision覆盖必须分开。

### 冷启动的同源索引

2026-10-15 公开入口复核：以下索引能发现草稿 metadata，但目前唯一选择 handler 经 TaskCenterTabStrip，general Workspace 的 ThreadHeader/utility toolbar 条件排除该 strip；Home/new-task 与侧栏新建也不保留 strip 条件。因此“索引接线”不等于用户可以选择重启后的草稿。原 cold fixture 的 Home → +tab 路线不可达，不采用、不恢复旧 strip；下一刀依据同版本 REA 确定公开恢复导航。三首发改用 Home、搜索新建和项目侧栏新建，通过同 atom index 与 scope read 唯一关联实际 identity，单独验收逻辑草稿发送，不声称冷选择或标签 UI。

同版本新增 REA `ev_8109ba0f2d675fb08989285ee7408e675b5a2d4953513f757c11e959c4934ab5`（5 member / 51,330 bytes）及 `ev_5872c498b099311cff8f5d0c5d7ca8b99dae35efcceb3f42eeabd3eb526e9c47`（27 inert declarations / 14,506 bytes）均 parse failures 0、structural complete、semantic unknown。可确认导出名 `startNewConversation`，主侧栏 New chat 调用该领域动作；`draft-thread-identities-v1` 仅 home/panel 当前 client identity，`client-thread-bindings-v1` 绑定 canonical 后清掉匹配旧 identity。恢复 gate 来自主窗口 persistence owner，不能扩展成所有窗口无条件恢复。所有历史未发送草稿的侧栏 picker 仍 unknown，不据此新增 Drafts 列表。

下一步产品迁移应统一公开 `startNewConversation` 入口并清理隐藏随机 draftTabs 双轨；当前最小真实验收复用既有稳定 home scope、Main/Coordinator/Controller，验证正常重启后公开 Home 恢复完整当前草稿。此方案与未发送多草稿 picker 的缺口分开记录，不能仅凭索引测试关闭后者。

迁移前草稿标签仅 `useState([])`，重启后不知道旧draftTabId；按已知scope单读不足以完成冷恢复。当前 `useWorkspaceComposerDraftIndex` 已消费同一 atom 的 workspace-index query，发现 metadata 并投影草稿标签。read 合同已直接迁移为判别 query/data，不保留 scope-only 兼容入口：

- `{key, query:{kind:"scope",scope}}` 返回 `{outcome:"ready",data:{queryKind:"scope",view},...metadata}`。
- `{key, query:{kind:"workspace-index",workspaceId}}` 返回 `{outcome:"ready",data:{queryKind:"workspace-index",workspaceId,items},...metadata}`。
- item只有 `scope/identity/updatedAt/sessionId?/threadId?`；无正文、附件或标题摘要。invalid/unavailable返回data:null，不能解释为空存储。
- Main按workspace精确匹配（含null）、当前binding指向state=draft过滤，排除consumed/tombstone/孤儿。确定性排序，沿10,000记录/绑定预算返回完整metadata集合，不静默截断。
- 索引读取不改storeRevision或updatedAt，不做CAS或占record预算；它只用于发现。选中后再读scope并复核identity/version，后续put/promote/consume仍执行原CAS。
- 唯一React持久hook投影draft标签，标题使用五语言默认文案；活动选择与关闭收起状态不被迟到索引强制覆盖。不另建localStorage标签索引。

### 明确接受结果与导航

| 迁移前缺口                                                                                              | 最小迁移合同                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| threadClient丢弃startTurn真实response，adapter/stream/chat多层Promise<void>，Workspace将await包装为true | API保留真实response，在小execution边界投影typed runtime acceptance，透传实际captured sessionId/threadId/turnId |
| queue已有QueuedSubmission，InputbarScene丢弃后返回true                                                  | 保留真实queuedSubmissionId/clientUserMessageId及session/thread身份，不伪造turnId                               |
| steer响应已接受，后续refresh失败仍整体报发送失败                                                        | receipt在post-processing前结算，projection错误独立上报，不撤销接受事实                                         |
| slash review/diff/init发送prompt后丢receipt；本地help/confirmation/shell也以true/void表示               | prompt分支透传真receipt，本地handled独立分类；true、void、unknown、仅dispatched不能消费草稿                    |
| Dispatch卸载先settle false，真实sendPromise之后仍可能accepted                                           | 请求closure中的onRuntimeAccepted先通知存活coordinator，UI卸载只解绑可见更新；callback/return重复结算幂等       |
| direct/home迟到回调重读activeSessionIdRef                                                               | promotion使用请求捕获source和response实际目标，不使用当前global ref                                            |
| TopicNavigation/ResetRuntime/Materialization/DraftState导航前无条件reset                                | before只capture/enqueue旧scope，导航实际committed后bind/restore；blocked/deferred/error保留旧binding           |
| interrupted restore仅WeakMap防重复，缺scope和编辑guard                                                  | UI恢复envelope携带captured logical identity/scope，核实当前编辑后恢复，不放进AppServer wire                    |

上表左列是迁移前快照；typed acceptance、opaque restore token 和导航 owner 已直接采用，不能继续列为当前源码缺失。existing local和稳定Home正常冷恢复已通过，公开三首发仍pending。发送同步捕获logical draftId/version、scope、Controller receipt和未发布payload；后台队列固定captured put在consume之前，业务请求立即继续。明确accepted后跨导航消费旧identity，即使当前Controller.commit因新scope/revision返回false；当前UI仅同logical binding与receipt匹配时清理。promotion只移动绑定，不改draftId/version或receipt revision。materialized、direct draft、无draftTab的Home三条分别验收。

hydrate/navigation restore、accepted commit及clear导致的Controller通知不生成普通put，避免程序清空又创建空草稿。明确用户clear写tombstone，关闭标签只收起导航；消费记录不自动驱逐，迟到put不能在absent恢复旧draftId。容量、无效codec或IO失败整次拒绝保旧，不阻塞业务发送；只有实际savedRevision覆盖后才宣称已接受版本不会在冷启动复活。

实施顺序为Host基础接线与正常重启 → 同atom索引与typed acceptance → coordinator/codec及导航 → 发送三路径与冷恢复GUI Gate。typed acceptance core与surface已正式迁入；coordinator、codec、导航及发送restore token也已正式采用。root React与项目导航组合owner已正式接线；existing local与稳定Home正常冷恢复已通过，公开三首发仍在验证，不新增void-compatible结果双轨。

## 未知与边界

- Codex 真实退出/重启效果、main500ms与renderer250ms待保存窗口的强杀耐久、账户切换清理未验证。globalState文件及静态原子替换链已补证。
- 两个 key 的静态形状不能证明跨重启图片、外部路径和完整附件恢复。
- Lime existing local与稳定Home正常冷恢复已取得独立Desktop Gate B，local含发送消费；公开三首发、最新产物Stop和默认门禁仍待验。
- 原始 Evidence、切片 manifest 和 AST observations 留在本机 REA 分析目录；仓库只保存身份、合同、映射和限制，不纳入参考应用源码。

## 基础 Host 正式迁入（2026-10-14）

37源已直接迁入：`PersistedAtomHost/Store/File`、纯JSON protocol/types、唯一`persistedAtoms` gateway、Main/IPC/preload/event policy、safeInvoke/HTTP诊断、catalog/ESLint/contract guard与公开fixture/driver。参考100/200/400ms rename retry和独立test-root两个overlay一并采用，迁前后before/final SHA全部一致。原隔离包保留冻结，正式证据单独记录。架构与命令事实源同批更新，由root确认Host UI保存与canonical业务链分离；Main只组装/委托/dispose，无新增CAS或落盘业务。

基础迁入阶段曾使用 scope-only read；后续同源索引已直接替换为 query/data，旧 wire 删除。基础 Host 与索引的正式回归、公开IPC及 saved 后正常新PID重启已通过，详情见下一节。coordinator、codec、typed acceptance、metadata冷标签与root导航现已正式采用；这些基础或领域回归不能计为 GUI 冷恢复产品验收。不存在生产mock、第二runtime或compat包装；dispose不等待flush，pending立即退出与强杀仍未验证。

## 基础 Host 真实验证与索引直接替换

基础正式定向组合307项、contracts/typecheck/窄lint/格式通过，标准Electron GUI smoke exit0。公开IPC修后真实15场景通过，36次调用/7原生metadata通知，revision7；PID96100和96356分别正常code0/signalnull退出，新PID读回scope/identity/version/正文摘要一致，tombstone跨重启防复活。fixture起初遗漏parseEnvelope required limits，实际parser回归先红后绿后修复，旧失败证据保留。最终receipt `.lime/qc/composer-persistence/foundation-final-receipt.json` SHA `ef8ed5e08e98557448897860736088a55da3b7afb32ca680715855836ac9f268`。本场为unavailable backend，不证明AppServer业务/runtime accepted或GUI hydrate；保存完成后退出，不证明pending立即退出、强杀、Windows或断电。

随后索引与消费者23源已成套直接迁入；旧scope-only/top-level view删除，read现在仅query/data。File retry、自有test-root与真实parser driver修复保留；正式索引20文件439/439、contracts/typecheck/lint/格式、标准Electron smoke均通过；新query/data公开IPC21场景/46调用/10原生事件、revision10，PID24613与25004均正常退出。current/other/null三个workspace的index快照在保存前后与正常重启后同revision/同items摘要，consumed不回流。receipt SHA `411ba2f4f4d59805b635780f9f2ba89ee177f8a8bd9e070766da21f3c48ef941`。索引只读metadata、预算完整10,000回归通过；底层通过仍不等于GUI冷标签恢复。

## GUI current owner 与本轮验证

`ComposerDraftCoordinator` / codec / `useWorkspaceComposerDraftRuntime` / metadata index / `ComposerDraftStatus` 已进入正式源码。原 boolean/void 接受链直接迁移为 typed result，post-processing、slash、本地处理与queue分开；原capture及opaque恢复令牌透传至ActiveStream/stop恢复。TaskCenter send-driven materialization与迟到ready守卫已完成正式接线和分批定向验证。原导航无条件clear直接替换为prepare旧scope与实际committed目标bind；`useWorkspaceComposerDraftNavigation` 组合项目 picker 与待切topic，区分合法 topic-switch 和显式目标，并在真实session/workspace匹配后才清activation。唯一bind留在root runtime，不新增兼容入口。

正式owner组合48/48、root导航/reset组合45/45、TopicSwitch来源组合45/45通过，各自收据不相加为唯一case总数。草稿保存文案覆盖五语言并只根据实际savedRevision显示。root发现并修复参数层级丢coordinator、旧topic完成清新draft、初始化new-task误清、同scope误取消请求与layout前迟到promotion反抢目标；回归复用真实Controller/Store。真实Electron完整富JSON/资源、冷标签、三路径accepted与正常重启及默认门禁仍pending，基础Host与静态REA均不替代产品证据。

新增项目导航领域组合6/6通过：真实ProjectSelection、TopicSwitch、DraftState、Controller、gateway/parser/Store与React root runtime覆盖跨workspace合法切题、匹配前保留activation、旧epoch失效、picker保存旧scope/恢复新home，以及同事件显式draft目标；renderer strict两入口708解析文件零诊断。该结果与前述组合重叠，不累计为唯一case总数，也不构成Electron或重启Gate。

命名边界：`ComposerDraftCoordinator`、`useWorkspaceComposerDraftRuntime/Navigation/Index` 和 `ComposerDraftStatus` 是Lime current owner命名；参考安装包只确认atom key、成员身份、字段/方法属性与有界调用锚点。`pYr/hYr/BYr/Put/Vr`等压缩局部名不是上游原开发名称，REA semantic仍unknown，无source map或参考实时运行证据。合同对齐不等于恢复了上游完整源码命名或全GUI实现。

本轮 TaskCenter 73 项不同测试分批通过，send/flow 283、页面消费者 41、owner 守卫 15、pending 新编辑 runtime 9 项分别通过，组合不相加为唯一case。新标准 GUI smoke 通过，仅证明真实 Electron 壳/bridge/重载/三尺寸；本轮 rich/current/default 验收运行中。真实富草稿 fixture 首两轮失败均正常退出，修正 opaque 字符串版本、消费解绑与 installed skill 执行 key 的测试合同，Node evidence 24/24；保留失败收据，不以静态 fixture tests 计产品 Gate。

正式第二轮 Stop 生命周期修复：自动 refresh 空投影从 restoreDraft({}) 改为 replaceDocument({})，保留同一空正文 revision；人工 restore/history 与严格 scope/generation/identity/revision 令牌不变。真实 Workspace local/home/draft 回归先3失败/14通过→17/17；正式组合269通过/1trace超时，原5秒上限独立69/69通过。fixture 先验完整 GUI Stop，再通过公开资源移除/Skill clear/键盘清空独立验 history，不能把用户 history 编辑后的旧token拒绝误写为产品缺陷。

侧栏第二 opened project 真实失败已由产品回归确认并修复：查询与过滤统一 conversationDisplayProjects，实际两个返回会话及第二 row 点击先红后71/71。首发四叶与Home cold三叶正式采用，Node84/84/lint通过；前者验完整canonical User Item与media/read字节，后者仅稳定home当前scope，不证明随机多草稿picker。正式发送结算helper遗留临时软链接已按采用收据同SHA落成普通文件，源码行为未变；renderer-only build 与新标准 GUI smoke exit0，仅证明标准壳/bridge 场景。

### 当前真实失败与验证身份（2026-10-15）

`composer-stop-lifecycle-20261015-1` 原 rich 场景 exit1：session/thread `01a13bb8-ca6e-7b72-b943-c789f3847033`、turn `turn_65b39477aea54ce3b0d70cba4de012b0` 经真实 runtime accepted、Stop interrupt 与 canonical canceled。GUI 正文/path/image/skill 全空、无 assistant 输出、编辑器可编辑。日志有 inputRestorePlan、dispatch 与 Workspace received，没有 Inputbar apply；token 现场完整性与具体拒绝原因尚 unknown，不能以 hook integration 通过推断此 Gate 通过。

local 第七轮已点击第二项目会话并出现同 session Composer，随后 code picker 准备超时。只增强 fixture 的同 session/唯一 editor/可编辑 ready 前提，不改产品或恢复 oracle；Node evidence24/24、lint exit0。第八轮三个项目的rich编辑保存与拒绝保稿检查后，在Undo的键盘选区oracle失败，未达冷重启；正常quit收据失败，之后只读确认Main75321已不存在，不计正常重启证据。freeze3 包含 7,885 source / 1,358 artifact 摘要，packet SHA `6a530f8b5b0188a6bcfdb10bb68d4f3d1e825f12eadc252a3983da95c8f482fd`；launch 前后独立核摘要零漂移。它不证明全部模块执行，保留旧 chunk 可能存在。

默认第87/131批两次分别211通过/1首例5秒超时，超时位置由 references 改到 EmptyState slogan；references 原5秒隔离9/9。未改 timeout、skip 或 resume 状态，资源压力只作为观察，不代替缺陷判断。默认门禁与持久化产品 Gate 继续 pending；公开新建会话的下一迁移见 [导航审计](./new-conversation-navigation-audit.md)。

Stop拒绝诊断已正式采用，仅在既有AgentDebug开关下console记录revision/generation/owner/scope是否匹配和失败原因，无正文或资源路径；guard谓词未变。诊断renderer构建exit0，rich2仍exit1；freeze4前后7,885 source / 1,463 artifact零漂移。完整context确认token、Controller、Coordinator、revision22、generation1和scope均匹配，唯消费后identity由null变为存在，原因为binding_changed。

领域回归复现消费前在途refresh读到消费后的absent并误建空identity：两时序先1失败/1通过，#retire递增read使旧读失效后，五文件94/94通过。保留严格恢复守卫与原富输入oracle；新renderer及真实rich复验结果见下文。发送全链候选两叶已独立核冻结并正式采用，受控transport的3项含真实EditorView，正式3/3、四叶lint/格式通过；不证明Electron Gate已关闭。

随后标准typecheck、新renderer构建均exit0；原rich场景第三轮 `composer-stop-retire-read-20261015-3` exit0，common34/34、scenario21/21，actionable console/page errors均0。同一canonical session/thread `01a13cd5-0f79-7c32-9150-1fefd750b006` 的接受、Stop取消、可见富草稿/资源/marks、history召回及长正文折叠通过。freeze5的7,887 source / 1,568 artifact前后独立核零漂移，packet SHA `989a12818eb5ad891700089721657fd2baad2d038bab1056b94a4ba0420078f9`。收据 `.lime/qc/composer-persistence/retire-read-rich-final-receipt.json`；这是受控backend的Desktop Gate B，不含live、冷重启、Windows或隐藏paste source的DOM召回证明。local9未达冷恢复，后续定位见下段。

local10在导航后已严格验证原rich JSON和DOM；拒绝前后entry精确相同，无canonical Turn。trusted Undo后的payload/document/hidden paste/资源摘要与原baseline一致、selection恢复[143,146]。随后fixture额外的Meta+End及三次ShiftLeft使最终selection为[143,143]，正文与marks仍在；未观察逐键默认行为，不能归因为产品Undo破坏。Main74494正常code0/signalnull退出，freeze6前后零漂移。fixture删除Undo后marker补写与重选，直接要求clean.draft与入口baseline.draft深相等，再验rich，Node24/24、lint/格式通过；scopeVersion不参与原稿比较。local11使用freeze7（仅该fixture变化、产品/产物零delta），packet SHA `4fa24dfa20c8d849cac836d85c0d80fad086cc56200e4f96da40830512403c41`，第三workspace代码picker trigger超时，截图编辑器为空，未达Undo/cold；Main82377正常退出，前后零漂移。尚需定位hydrate/后续清空时序。

local14（freeze11）已通过完整 native request trace 和正常退出：Main48987 code0/signalnull后启动新Main52369，首次进入完整GUI冷恢复。A恢复后原revision27变28、installed_skill route被删除，未打开B/C的route保留；正文长度按JS UTF16比较，不能把Python Unicode计数差异算作丢字。Inputbar在Skills catalog尚空时将fallback执行key与namespaced mention id直接比较，误清路由；真实Inputbar回归20项中18通过/2纯行为失败。修复复用能力身份owner的namespace/execution匹配，完整富JSON/资源/选区/identity和零额外写入要求不变；新产品Gate待重建与独立冻结后复跑。本次产品缺陷不计参考应用行为或全GUI完成。

local15修后首次cold严格恢复三个workspaces的完整JSON/DOM/资源/选区/identity，同revision32无额外mutation；后段合法无capability新稿在完整相等通过后，test-only摘要hash(undefined)失败。nullable摘要两叶修复，先27通过/1行为失败→组合78/78，rich route必需及完整相等不变。freeze13只两fixture delta、产品产物零漂移。local16已exit0：三rich、拒绝保稿、原选区Undo、接受consume/new-edit、异workspace interrupt及两次正常cold全部通过；Main34272/38556/40802均code0/signalnull。summary位于 `.lime/qc/composer-persistence/gui-navigation-readiness-evidence/composer-navigation-readiness-local16/composer-draft-gui-persistence.json`。这是受控backend Desktop Gate B，仅关闭existing local conversations，不含Home/首发/live/Windows。

Home6已在新Home callback构建上exit0，Main17922/18120均正常code0/signalnull。公开Home编辑完整富稿、同atom metadata索引、磁盘原字节与revision在退出和cold后不变，第二进程恢复完整JSON/DOM/资源/原选区/identity，无canonical Thread/Turn，冷trace零atom mutation。Home3/4首次正常quit期限失败保留；Home5误要求直接preload workspace helper出现在GUI safeInvoke记录，fixture最小迁移回归先红后Node62/62及collector69/69，未放宽禁止input/原生完整采集/冷零写。packet16仅两fixture变化、产品产物不变，后验7884source/1883artifact零漂移；收据 `.lime/qc/composer-persistence/home-cold-final-receipt.json`。这是受控backend、saved后正常退出的稳定null Home切片，不证明多草稿picker/live/Windows/强杀耐久。

packet19已验证Home完整首发/资源/consume/new-edit与正常退出；三入口整体仍失败于search-new富稿保存冲突。真实Coordinator/Store回归复现queued clear前序put通知恢复已退休identity；current修复只增加discard在途read保护和完成时read失效，Store CAS、retired identity及Stop exact token不放宽。非Stop定向通过，Stop原5秒timeout尚未关闭；新产物与当前验证进度以执行计划/证据索引为准，不把旧local16/Home6升级为新产物通过。

新修复标准typecheck/renderer/freshness/桌面壳均exit0；packet20 first6 Home与search-new完整富输入/资源/consume/new-edit及正常退出通过，证明原搜索保存冲突已在真实路径消失。项目按钮fixture补真实header hover后Node53/53/lint/格式通过，packet21 first7三个入口业务断言全部通过，但第三Main退出超过原15秒期限；随后正常teardown不计整轮pass。first8被动记录退出计时，失败时仅采样自有Main；原Stop测试5秒timeout、current/default仍未关闭。

packet21 新产物的四项真实合同均已通过：first8 三入口完整canonical富输入/资源字节/consume/new-edit与三次原15秒内正常退出；rich Stop原场景恢复/历史/marks且零console/page errors；Home7完整富稿/原选区/identity与cold零写、两正常Main；local17三工作区拒绝保稿/Undo/消费新稿/隔离与两正常cold、三Main正常退出。first8只加被动生命周期计时，旧退出超时根因仍unknown且失败保留。此4/4（100%）仅指四项合同，整体GUI仍partial；原Stop文件在原5秒期限单次20/20已通过，前次timeout仍保留；async-tabs已迁canonical筛选、current侧栏路径与完整计数，3+11通过；current聚合guard293/294、collector隔离68/69的原5秒超时保留。仅优化测试采集器重复工作后69/69、溢出用例1571ms，原断言/timeout与独立oracle不变；聚合第3轮及default续跑待关闭。

## 最终验证收尾护栏（2026-10-15）

默认验证已按实际前置检查、原生132批续跑、contracts、legacy与标准GUI24/24的组合关闭，原verify:local失败不改写为单次wrapper绿。续跑1761为历史登记路径，1756现存、5项已删除；修改过的早期owner单独回归，新增退出测试不冒充进入原状态。最新产品与2303目录产物来自freeze30；第5轮current短问候接受1978ms超过原1800ms预算，原场景隔离78/78、921ms及第6轮973ms通过，但超预算根因仍unknown。

第6轮前7场子进程正常结束，第8场审批完成所有业务断言后卡在finally。诊断明确pending BrowserContext.close、Node连接已关闭、无Node待响应调用、renderer/helper已退，仅Main存活；原生sample符号不完整，底层根因unknown。该轮已独立冻结并中断，SIGTERM清理不算正常退出。新fixture复用既有正常退出owner，仍限15秒，只有Main实际code0/signalnull及全部资源释放后才写最终ok并打印pass；失败后强制回收不会修复Gate结果。独立teardown行为回归6项、组合110/110通过；原审批隔离66/66、Main34547正常退出且无强制回收。freeze31仅4项fixture变化，产品产物不变，完整第7轮聚合已exit0、22/22通过，四组31/34/3/300，21个Claw正常Main回执且强制回收0；Coding仅保留既有子进程证据，不虚构Main回执。7886源/2303产物及产物路径集后验零漂移，当前summary/显式ledger/截图与log共67份独立冻结。旧第4轮manifest包含的遗留Skills失败截图保持历史原件，不混入新轮证据；最终格式、docs边界、脚本治理、62本地链接与diff检查均通过，本验证切片已关闭，整体GUI仍partial。收据与失败身份见evidence-index的current_gui_verification_20261015。
