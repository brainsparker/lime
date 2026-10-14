# Composer 草稿保存补证

状态：current / 静态结构已查证，Lime 产品迁移未实施。日期：2026-10-14。

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

## Lime 缺口与接点

当前 workspace 内唯一 Controller 由 `useAgentChatWorkspaceLocalDisplayState` 创建，跨 Home/Inputbar 共享，但无 scope key、keyed draft map 或持久保存。导航通常复用同一 workspace mount；离开 Agent 页和重启会销毁实例。`TaskCenterDraftTab` 仅有 ID、标题、时间和状态，是导航 metadata。`agentSessionScopedStorage` 存 transcript/read model，`promptHistory` 存已提交正文；两者均不能充当未发草稿 owner。

首发转绑定有两条 current 路径：

- 预热/显式 materialization：`useTaskCenterDraftMaterializationRuntime` 记录 draftTabId→newSessionId，`useTaskCenterDraftSendDispatchRuntime` 在 dispatch 前提交导航转换；有 acceptance callback 时 preserveInput 延续 revision。
- 直接首发：`useTaskCenterDraftSendRuntime` 将 sourceDraftTabId 与正式 session 交给 `useWorkspaceTaskCenterSendRuntime.handleNonMaterializedSessionReady`；无 draft tab 的首页分支也必须覆盖 home→session。

sessionId 与 canonical threadId 必须分别处理。`appServerSessionClient` 的 `thread/start` 返回 sessionId，`useAgentSession` 从 read model 建立 thread_id 映射。首发持久 scope 转绑定不能调用 restoreDraft 改动尚待 acceptance 的 revision。

最小现有 JSON 封装为 `agentChatStorage.loadPersisted/savePersisted`；Chromium sessionData 根由 `electron/appDataPaths.resolveHostSessionData` 统一处理 macOS/Windows。当前没有通用 DesktopHost JSON KV 合同；如对齐 main persisted store，应扩展既有 Host 边界并同步 IPC/preload/gateway/catalog/tests，不能借用 model-provider 的 UI state 或建立第二业务 runtime。`savePersisted` 当前在 try 外 stringify、无成功结果且 quota 失败会删除旧值重试，不能直接用作已保存证明。若选用该封装，最小合同应为 try 内序列化、拒绝 undefined、单次 setItem 返回成功状态、写入失败保留旧值；草稿 owner 必须消费返回值。`isStorageQuotaError` 仍服务 transient storage，不能随此迁移删除。

候选清理：scope 导航的 reset+setInput 改为唯一 owner 的保存旧 scope、切绑定、恢复新 scope；显式 clear 和 acceptance 后条件 commit 仍须分别处理，避免无条件写空覆盖旧 scope。具体实施必须先登记 Verification Contract 与架构图。

接受结果还需要按发送时 scope/version 消费已接受的旧草稿：导航后 `Controller.commit` 因 revision 或 scope 变化返回 false 时，不能让已发草稿在下次启动复活。首发 scope promotion 仅转绑定，不推进等待接受的 receipt revision；materialized/direct/home 无 draft tab 三条消费者路径分别回归。session identity 与 canonical Thread identity 分开记录，不用已有 provider UI state 承接草稿。

## 未知与边界

- Codex 真实退出/重启效果、main500ms与renderer250ms待保存窗口的强杀耐久、账户切换清理未验证。globalState文件及静态原子替换链已补证。
- 两个 key 的静态形状不能证明跨重启图片、外部路径和完整附件恢复。
- Lime 尚未实施 scoped persistent draft；现有内存共享与 history Gate 不关闭这个缺口。
- 原始 Evidence、切片 manifest 和 AST observations 留在本机 REA 分析目录；仓库只保存身份、合同、映射和限制，不纳入参考应用源码。
