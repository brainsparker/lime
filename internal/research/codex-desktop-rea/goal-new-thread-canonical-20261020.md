# Home 新线程目标：REA 顺序与 canonical owner 核对

日期：2026-10-20。状态：REA 调查、Home / threadless Inputbar 目标纵切与定向回归完成，源码已冻结；根进程产品门禁待执行。责任进程：`/root/remove_import_client_contract`。

本报告记录新线程目标的创建、首轮接受、附件所有权、实际实现与显示/持久化边界。本轮复用已冻结的目标附件 owner，修改 GUI 提交与既有 typed send 接线；没有修改协议、Rust、线程创建 owner、根 fixture、主计划或架构。整体 GUI 对齐仍未完成；REA 静态证据与组件回归不代表真实 Desktop 验收。

## 已确认结论

1. 参考安装包的 Home 新目标先成为 `threadGoalDraft`，物化后以 `/goal <objective>` 作为首轮输入。创建线程和首轮提交由既有 conversation/turn admission 服务完成；只有 `firstTurn.status === "accepted"` 后才另行 `thread/goal/set`，并显式 `appendTranscriptItem: false`。
2. Lime 保留“接受首轮后保存目标”的大顺序。本轮已补齐 Home 与 threadless Inputbar 对同一 draft/materializer 的复用、`/goal` 首轮正文及同源乐观投影、目标保存失败五语言反馈、created/accepted/unknown 的素材保留，并删除 threadless raw goal fallback。
3. 已有线程的目标编辑走独立 `thread/goal/set`，不再发普通用户 Turn。参考 renderer 会追加一个 `turnId: null/status: completed/items: []` 的本地显示容器；它没有服务端 Turn 身份，不能拼进 Lime canonical Turn/Item 历史。
4. 当前公开 Codex 源码另有 `origin: user` 的 durable 用户目标来源合同，保存的是带 host provenance 的 ResponseItem，不启动模型步骤、不重开 active turn。canonical thread history 不把这类来源重建为 UserMessage；不存在本轮应补造的“canonical 可见目标编辑历史”。Lime 的实际缺口是 trusted durable origin、provider history 与 retained authorization 消费，不能用目标状态通知或 renderer 假 Turn 代替。

## 证据身份与限制

参考安装包：Codex Desktop `26.1007.30912 / 20156`，ASAR SHA-256 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。

复用 REA50 portable bundle：`/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/composer-mode-50/session-evidence.json`。

- parent：`ev_e74e1af289bfe4b44f9d691f18aa79ec95a893d4a5777f632a16322c35804154`，`analyze_javascript_application`，保留记录完整，5 项限制。
- summary：`ev_04da4a8b16295f0fa2a5d06062af9a3b852833803de24b39df85350ed5053e61`，`inspect_analysis_view`，16 项限制。
- 该 REA 分析的直接 subject 是 scoped `composer-mode-50/input` 目录，目录摘要 `ea6a9831c2abf8454ad4ef83f0f14958309e935b62c802722c5e6ab8a4f41ef5`，并非 ASAR 摘要。CLI 本轮 `inspect-evidence-bundle {detail:summary}` 返回 2 条匹配记录；不重复整包分析。

同摘要保全成员本轮逐一重新计算 SHA-256：

| 代号    | 保全成员（相对分析根）                                                    | SHA-256                                                            |
| ------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| primary | `composer-editor-evidence/webview/assets/app-primary-6f60e9ac4103.js`     | `7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321` |
| initial | `composer-editor-dependencies/webview/assets/app-initial-6350d04672d0.js` | `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f` |
| shared  | `composer-draft-persistence-artifact/app-shared-8bd9d0399038.js`          | `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245` |

分析根：`/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/`。下表位置均为原始成员的 UTF16 code-unit 半开区间。本轮 Babel AST 补读保全源码，不扩大原 REA semantic coverage；压缩符号仅用于定位，原始源码名称 unknown。`targetExecuted=false`，未运行参考应用，不证明动态 flag、实际点击或真实网络结果。

公开源码另固定到 `/Users/coso/Documents/dev/rust/codex` HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`。它回答 current 协议/runtime 问题，不能倒推上述安装包具有后来新增的 origin 合同。

## 安装包中的完整顺序

| 成员/定位符                                 | 原始范围                                  | 已确认职责                                                          |
| ------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| primary `Lft`                               | `[1357321,1359400)`                       | 目标准备与有/无线程分流                                             |
| primary `Put`                               | `[1278157,1292894)`                       | 同一 Composer 提交协调，传入目标 draft                              |
| primary `Qft`                               | `[1364761,1409306)`                       | `buildLocalContextForPrompt` 构造 context，保留 `threadGoalDraft`   |
| primary `_9e`                               | `[891455,912377)`                         | local 创建/跟进服务；物化、首轮 settlement 与后置 set               |
| primary `TJe`                               | `[355441,356080)`                         | `startConversationWithPrimaryRuntimeForFirstTurn` 所传调用器        |
| shared `zln`                                | `[3018429,3023957)`                       | 创建 conversation，然后执行真实首轮 admission                       |
| shared `createConversation` 方法            | `[3107328,3114339)`                       | 复用 prewarm 或请求 prepared thread start，接收真实 thread identity |
| shared `Uun`                                | `[3045822,3056066)`                       | turn admission，处理真实服务端 turn id 与 unknown delivery          |
| shared `ENt`（primary import `V2t as uu`）  | `[2016810,2016845)`                       | 唯一包装：`return \`/goal ${e}\``                                   |
| initial `U9n`（primary import `Xdn as SS`） | `[2801128,2801583)`                       | 调 manager.setThreadGoal；失败显示 toast，返回 false                |
| shared `Q6t`                                | `[2623349,2624029)`                       | manager 的真实 `thread/goal/set` 调用                               |
| shared `e8t` / `t8t`                        | `[2624363,2624856)` / `[2624856,2625481)` | 已有线程本地目标显示容器与去重                                      |
| shared `X4t`                                | `[2555674,2556062)`                       | 将本地容器放入 live tail / turns 数组                               |

### Home 无 conversationId

1. `Lft` 从同一 Composer 的 promptRaw、paste/image 等准备 draft；空目标只开启 `pendingThreadGoalObjective=""`。存在目标内容且 `Ih(scope) == null` 时返回 `{status:"continue", draft}`，此处不调 set。
2. `Put` 将目标包装为 `/goal <draft.objective>`，写 prompt history，并可建立 `createPendingThreadStart` 本地 creating 状态。该 pending 状态没有 durable thread 身份。
3. `Qft` 的 context builder 将 draft 放入 `threadGoalDraft`，交给同一 local submit 服务。
4. `_9e.I` 调已核对的 materializer。非 durable host 使用物化后的 objective 重新包装首轮 prompt，并清空已物化的 `pastedTextAttachments`，避免贴文再展开；durable host 保留原 draft.objective 与 paste 列表。然后去掉 context 中的 `threadGoalDraft`，将 `{draft, materialized}` 作为本次提交持有的目标素材。
5. `_9e.R` 调 `startConversationWithPrimaryRuntimeForFirstTurn`。`zln` 先通过 `threadCreation.createConversation` 获得真实 conversationId，再 `executeTurnStart`，将真实响应 turn.id 放入 `firstTurn: {status:"accepted", turnId}`。首轮的 text 来自真实输入 `d`；renderer 为 admission 准备 restoreMessage，不能将该乐观对象当持久化 producer。
6. admission 的 `Uun` 有 `turn/start` 和显式能力控制的 `turn/addUserMessage` extension 分支，取决于 useUserMessageAdmission / thread source 等条件；本轮静态证据不声称用户实际命中了哪条动态分支。两者均需要真实服务端接受及 turn id，不是 goal set 本身生成用户 Turn。
7. `_9e.he` 仅在 `creation.firstTurn.status === "accepted"` 时执行 `me(conversationId)`；后者调用 `F()`，实际为 `SS({appendTranscriptItem:false, objective:materialized.objective})`，最终 `Q6t` 发 `thread/goal/set {threadId,objective,status:"active"}`。该新线程分支不再追加额外的 null-turn 目标行。

### 两类保存的失败与素材所有权

| 情况                                                    | 安装包证据                                                                                                                | 后继实现必须保留的语义                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Home 物化或线程创建在未移交时失败                       | `_9e` 的 `ce()` 清理目标物化目录，catch 按 `ee` / stale settlement 判断是否调用                                           | 失败留可恢复富草稿，回收确属未移交的目录；不能仅凭没有 turnId 判定                                                |
| Home 已 created，但 firstTurn 为 not-started / rejected | `_9e.he` 保留真实 conversationId 与 worktreeRecovery，清计时回调后仍设 `ee/te=true`；正常分支未调用 `me`，也未立即 `ce()` | 不保存 active goal；保留创建/重试身份。附件回收不能简化为“不是 accepted 就删”，应按真实创建/重试 owner 的引用决定 |
| Home 首轮已 accepted，随后 set 失败                     | `U9n` toast `Failed to set goal` 后返回 false；`F()` 不传播 false，已接受创建结果继续成立                                 | 提示 set 失败；不能把首轮报告为失败、不能重复首轮、不能删除已被首轮引用的附件                                     |
| Home delivery outcome-unknown                           | `_9e` 保留 requestId 与 unknown 状态，后续 onSettled 再判定                                                               | 没有拒绝事实前不能当失败清理或盲重试；真实接受与拒绝需要既有 submission settlement owner 判定                     |
| 已有线程独立目标 set 成功                               | primary `Nft [1355943,1356575)` 将 materialized 置 null                                                                   | 保存成功移交附件，再以 revision/binding CAS 清当前草稿                                                            |
| 已有线程独立目标 set 失败                               | `Nft` finally 清本次 materialized；正文不被成功清理                                                                       | 回收本次 owned 目录，保留草稿，不产生普通 turn/start 或 steer                                                     |

Home 与已有线程的移交点不同：Home 是首轮已经接受，已有线程独立编辑是 goal set 成功。不能直接把冻结 hook 的 `saved` 布尔条件复制为 Home 清理条件。

## Renderer 本地行与 durable 事实

`Q6t` 完成 RPC 后，`appendTranscriptItem:false` 仅更新 `conversation.threadGoal`；默认分支调用 `t8t`：

```js
{
  params: {threadId, input: [{type: "text", text: `/goal ${goal.objective}`, text_elements: []}], /* settings */},
  turnId: null,
  turnStartedAtMs: goal.updatedAt * 1000,
  status: "completed",
  items: []
}
```

`t8t` 按 updatedAt、相同输入、null turnId、completed 与空 items 去重；`oB -> X4t` 只放入 renderer live-tail island 或 turns 数组。shared `updateConversationState [2697834,2698875)` 通过同一 threadStore 更新/通知/向 follower 广播 patches；manager wrapper `[3215145,3215535)` 另外只检查 searchMcpContext / unread 的存储变化。本条调用链没有请求服务端创建 Turn/Item，不能据此推定普通 canonical 历史持久化。

| 事实                                            | owner                                        | durable / UI 边界                                                                  |
| ----------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Home pending objective、pending creating thread | Composer / renderer surface                  | 本地显示与草稿；不是 durable Thread                                                |
| Home 首轮用户输入与 turn.id                     | App Server turn admission / runtime          | 真实接受的 Thread/Turn/Item 链，正常恢复同一 identity                              |
| ThreadGoal objective/status/usage               | goal API / goal store                        | 独立 thread metadata；updated 通知 turnId 可为 null                                |
| 已有线程 null-turn completed 行                 | renderer history live tail                   | 本地显示容器；没有 durable Turn 身份                                               |
| current 公开源码的 `user.goal`                  | App Server → core retained context → rollout | durable ResponseItem provenance；不初始化模型步骤；不是上述本地显示容器的 producer |

current 公开源码已确认 canonical 展示边界：`codex-rs/app-server-protocol/src/protocol/thread_history.rs:481` 的 `handle_response_item` 只将可解析的 user hook prompt 追加为 HookPrompt，其他 ResponseItem 不生成 UserMessage；`:5256` 的 `ignores_plain_user_response_items_in_rollout_replay` 回归守住该行为。`user.goal` 不是 hook prompt，不能作为待新增的 canonical 可见编辑历史。当前 ThreadGoal 快照继续只呈现最新状态；目标来源按持久化模型历史/授权合同恢复。不得按 updatedAt 伪造历史 Turn、为它新增 ThreadItem variant，亦不得把普通首轮 `/goal` 用户输入重复追加一次。

`core/src/session/mod.rs:4431` 的 `send_raw_response_items` 经 `app-server/src/bespoke_event_handling.rs:1177` 发出 `RawResponseItemCompleted`，不是 canonical `item/completed` UserMessage。原始响应通知、本地显示容器、goal 最新状态和持久化来源必须保持各自身份。

## Lime current 调用链和差距

Home 当前接线：

`WorkspaceConversationScene -> useWorkspaceConversationLandingSurfaceRuntime -> EmptyState.handleSend -> receipt / prepareThreadGoalDraft -> submitNewThreadGoal -> buildNewThreadGoalSendPayload -> workspace send -> sendAgentStreamMessage -> prepareAgentStreamUserInputSend -> executeAgentStreamSubmit`。

Threadless Inputbar 从 `useInputbarController -> useInputbarSend` 使用同一 receipt、draft、materializer 和新线程提交 helper；已有线程继续由 `useThreadGoalComposer` 独立保存目标，不进入首轮创建分支。

- `newThreadGoalSubmission.ts::formatThreadGoalPrompt` 是 `/goal` 文本包装 owner。原始 prompt history 使用未物化 objective；乐观/首轮输入使用物化 objective。`buildNewThreadGoalSendPayload` 清除已经物化的图片、paste text elements 和 typed mentions，保留完整原始富草稿用于恢复；两个入口不再各自生成不同的首轮正文。
- `submitNewThreadGoal` 在物化完成且原 binding 仍有效后才提交。创建前拒绝/抛错回收；真实 session-ready、accepted、unknown 保留素材。`agentStreamSend` 在 ensureSession 返回后、模型同步及乐观准备前通知本地 `onSessionReady`，它不进入 App Server wire。
- `useWorkspaceSendActions` 对目标跳过 active context 准备、命令 prewarm / routing；`buildWorkspaceSendText` 保持物化正文原样，避免上下文或角色前缀改写首轮。没有新增线程创建 wrapper。
- 两入口均有物化中重复提交防护、空 `/goal` 本地处理、unsupported tray/capability 可见拒绝、stale binding 检查与既有 settlement revision/CAS。旧 receipt 不清新 revision；物化失败保留完整富草稿。
- `executeAgentStreamSubmit::setAcceptedThreadGoal` 保持首轮 accepted 后调用真实 goal API；set 失败显示五语言 `agentChat.threadGoal.toast.failed`，不把已接受 Turn 伪装成提交失败。
- 确认所有 goal input 生产者已收敛到新线程 helper 后，删除 activeTurn 旧 goal set → steer 路径：新目标首轮撞上 activeTurn 时，在 goal/set、steer 或乐观状态清理前显式拒绝并保留草稿。旧正向回归拆为普通 steer 正向和 goal 碰 activeTurn 的零副作用负向，不恢复 existing-thread 双轨。

### 可直接复用的唯一 owner

| 能力                             | Lime current owner                                                                                                 | 后继方向                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 同一 Editor receipt → 目标 draft | `Inputbar/hooks/threadGoalDraft.ts::prepareThreadGoalDraft`                                                        | Home 复用；不从 displayContent/raw override 再建平行解析                       |
| 目标附件/长文本物化              | `src/lib/api/agentRuntime/threadGoalAttachments.ts::materializeThreadGoal` / `ThreadGoalAttachmentStore`           | 同一 helper，提交者持有 ownership；保留现有 typed fs / agentRoot               |
| 线程创建与 canonical identity    | `useAgentSession::createFreshSession` → `appServerSessionClient::createAgentRuntimeSession`                        | 保留同一 owner；先物化再创建/提交，而非新增 backend                            |
| 首轮接受/unknown/拒绝            | `agentStreamSubmitLifecycleController`、`agentSendResult`、Composer submission settlement                          | 首轮 receipt 决定移交；使用现有接受与恢复控制，不能以普通 Promise resolve 代替 |
| goal set/get/clear               | `threadGoalClient.ts` → `processor/thread_goal.rs` → `runtime/thread_goal.rs` / canonical goal store               | 单一 goal owner；补失败反馈不引入第二份目标状态                                |
| 目标续跑                         | `runtime/thread_goal_continuation.rs`                                                                              | 既有 idle scheduler，不能由 GUI 再普通发送一轮                                 |
| 普通用户输入 canonical producer  | `runtime/turn_input_events.rs` → `thread_item_projection` → `canonical_thread_store/event_batch.rs` → thread-store | 只消费真实 runtime 事件，保持已有 Turn/Item identity                           |

`app-server/src/lib.rs:1818` 在 mutation 响应/ordered notification 后调用 `maybe_start_thread_goal_for_thread_if_idle`。continuation 通过真实 `start_turn_inner` 与 `TurnStartInputKind::GoalContinuation` 进入 runtime，产生 `thread.goal.continuation`、`visibility:agent_only`，不产生普通用户消息。`canonical_thread_store/goal_projection.rs` 从真实 turn.accepted/terminal/tool 事件做计费与 outbox；它不是用户目标编辑 transcript producer。

## Current 公开源码的 durable origin 缺口

以下源码相对 `/Users/coso/Documents/dev/rust/codex`，固定 HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`。这些是公开 current 合同，不倒推旧 Desktop 安装包已具有同一实现。

参考源码入口：

- `codex-rs/app-server-protocol/src/protocol/v2/thread.rs:858`：`ThreadGoalMutationOrigin::{User,Automatic}`，set/clear params 携带 optional origin；缺少来源不提供用户授权。
- `app-server/src/request_processors/thread_goal_processor.rs:133`：origin=User 的显式 objective/status 变化，在 goal service 的 mutation 回调记录用户目标来源，再保存 goal/rollout、发送响应与 ordered notification、执行 runtime effects。
- `app-server/src/request_processors/thread_goal_user_context.rs:10`：loaded thread 委托 core；unloaded thread 使用同一 rollout recorder，flush 后才确认。
- `core/src/session/retained_context.rs:84`：持久化 host 标注的 ResponseItem、user_input_order 与 settings checkpoint，成功后更新 retained history；代码明确不初始化模型步骤、不重开 active turn。
- `core/src/context/user_goal.rs`：`user.goal` / `user.goal.omitted` host annotation；objective JSON 超过 700 bytes 时整体省略其 provenance 正文，保留状态；不能把普通文本 wrapper 当作同等来源。该限制不同于 GUI objective 的 4000 codepoint 物化限制。
- `ext/goal/src/api.rs:144` / `:297`：目标 mutation permit 覆盖准备、来源记录和状态写入。`record_user_instruction` 在有效性检查后、goal DB 写入前执行；记录失败时 goal 不变，记录成功后 DB 写失败时已记录用户意图仍有效并保留。user clear 即使无 goal row 也先记录，用于撤销失败 set 遗留的授权。不是来源日志与 goal row 同事务回滚。
- `core/src/context_manager/history_user_authorization.rs:141`：host 标注的 `user.goal` 可作为授权来源；`user.goal.omitted` 不完整，另受 `retained_source.complete` 与截断结果约束。仅复制 wrapper 文本、`origin` 字段或最新 goal row 均不等于 retained authorization 已实现。

Lime `app-server-protocol/src/protocol/v2/thread.rs:785` 的 set params 和 clear params 没有 origin。`processor/thread_goal.rs:12` 仅 resolve thread、set goal、发 updated 通知；clear 目前未像 set 一样 resolve persisted thread。`turn_id:None` 是通知字段，不是 durable transcript identity。现有 goal state/store/accounting 可继续复用，但没有与 UserGoalUpdate 同义的可信持久化来源 producer。

`packages/agent-runtime-projection/src/goalLifecycleHydrate.ts` 是验证/投影提取器，不能生产事件。`:422` 通过 type/method 含 goal 检查泄漏，`:640` 禁止把 lifecycle 塞进普通 transcript/read model。该守卫仍可保护“lifecycle 不是普通 assistant item”；它不能证明用户目标 provenance 已实现。后继若新增真实 provenance，需精确区分 host 来源记录与 lifecycle，不能直接删除整个守卫来放行假 Turn。

### 最小垂直切片与唯一 owner

1. **协议与显式用户入口**：set/clear 加 optional `ThreadGoalMutationOrigin`，同步 JSON schema、生成 TS、client 和 contract fixture。`threadGoalClient.ts` 透传来源；`useThreadGoalComposer`、ThreadGoalPanel 的 pause/resume/complete/clear、新线程 accepted 后 set 显式传 `user`。不能在通用 client 默认补 user；automatic/missing origin 不提供授权，user 的 objective/status 显式 patch 才记录，单独 budget patch 不记录。CLI/TUI/App Server client 范围的窄搜索未发现生产 goal mutation 调用，不据此强造消费者。
2. **受信来源生产与顺序**：在既有 App Server runtime owner 对齐 `UserGoalUpdate` / `record_user_goal_update` 的职责与命名，禁止从工具输出、自动续跑或任意 renderer raw wrapper 构造。沿既有 durable event ID/sequence 记录同一份来源；loaded/unloaded/restart 均成功持久化后才确认。准备/校验 → 来源记录 → goal 状态写入 → response/ordered notification/runtime effects。clear 无 row 也记录；来源失败不改 goal，DB 写失败不撤销已成功来源。
3. **正文与完整性**：遵守上游 `UserGoalUpdate::content_kind/body/message_text`。检查的是 objective **JSON 编码后的 UTF-8 字节数**，包含引号与转义；超过 700 bytes 整段省略并标为 `user.goal.omitted`，不能截断限制条件后保留授权。role=user、恰好一个 InputText 和匹配的 host `content_item_kinds` 才是来源；marker 文本本身不授信。GUI 4000 codepoint 和此 700-byte evidence 限制分别验收。
4. **同一历史的 consumer**：provider history 消费来源记录，compaction/rollback/fork 沿原有 lineage 和顺序保留/裁剪；canonical thread reader 对该记录保持零新增 Turn/UserMessage。provider 可见正文与授权完整性是不同投影，不新建来源数据库或第二套 backend。
5. **retained authorization**：Lime `agent/src/current_provider_turn/tool_executor/guardian.rs:63` 仅把当轮 `user_visible_input_text` 传给 `guardian_review.rs`；当前无 Codex retained-context/user-goal 授权消费者。只完成 origin 与 provider history，不能宣称 Guardian/retained authorization 已对齐。后继须由 current runtime/agent owner 消费可信来源及完整性，不能从最新 goal 快照或渲染文本推授权。

### Rust 热区与不可直接复用的路径

| owner / 文件                                                                      | 当前事实与后继约束                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-server/src/runtime/thread_goal.rs:31`                                        | set/clear 持有 runtime state mutex；普通 `append_runtime_events` 会再次锁 state，不能在现有锁内直接调用。                                                                                                                                                                           |
| `runtime/canonical_thread_store/goal.rs:50`、`goal_idle.rs:58`                    | goal mutation 持有 idle permit 和 SQLite Immediate transaction。普通事件 append 会再次 canonical projection/goal accounting 并打开 DB 连接；不能把它直接塞入当前事务。应拆开准备、来源记录、状态提交，保持 mutation permit 横跨全段并与 idle admission 协调，避免旧 goal 抢先续跑。 |
| `runtime/event_store.rs:371`、`event_store/recovery.rs:8`                         | 既有顺序是 EventLog append → canonical projection → live `stored.events`，存在 durable append 后下游失败的恢复入口。来源记录需保持同样身份/顺序和失败后恢复；不能仅在内存成功就确认，也不能失败后盲目重写日志。                                                                     |
| `runtime/thread_inject_items.rs:78`                                               | 公开注入会向 active actor `steer_for_turn_id`；目标来源不得添加 pending input、重开 active turn 或初始化模型步骤，不能直接调用此 API。可抽取纯持久化能力，但 host trust 必须与任意 raw 注入分开。                                                                                   |
| `agent-protocol/src/response_item.rs:41`                                          | typed metadata 目前只有 `turn_id`，没有 `content_item_kinds`。如补 host annotation，需同步 typed 序列化与受信边界；不能让任意注入自称 `user.goal` 获得授权。                                                                                                                        |
| `agent-runtime/src/model_history.rs:103`                                          | `ModelHistoryRecord::into_message` 仅收工具项，或有 source identity 的 assistant 完成项。不能把 user goal 直接塞入该记录类型或伪装成助手完成消息。                                                                                                                                  |
| `runtime/provider_history.rs:329/450`、`model-provider/src/current_client.rs:825` | 当前 raw 注入通过 RawResponseItem；非 Responses route 会显式拒绝 raw history。来源可持久化为 host ResponseItem，但 provider 消费应提取 user/text 后走现有多协议 lowering，host 完整性另供授权 consumer；不得破坏 Lime 多模型/多协议能力。                                           |
| `runtime/provider_history.rs:219`、`context_compaction/operation.rs:232`          | 已有 `coveredThroughSequence` checkpoint + tail。需证明 compaction 输入快照之后接受的目标编辑保留一次且顺序不变；上游 `core/src/session/mod.rs:4307/4821` 用稳定 response item ID 与输入快照集合保留并发编辑，不能只按 compaction 完成时刻截断。                                    |
| `runtime/thread_fork/model_history.rs:9`、`history_replacement.rs:18`             | fork 当前只复制有入选 turn 的 MODEL_HISTORY_EVENT_TYPE，会遗漏无 turn 的可信来源。应按选定 prefix 和明确继承语义保留来源；rollback 沿同一 sequence lineage 裁剪。不得造假 Turn 绕过筛选，亦不把继承来源无条件提升成新用户授权。                                                     |

上游 `app-server/tests/suite/v2/guardian_goal_tests.rs` 的 `user_goal_updates_survive_resume_and_clear` 检查 loaded/unloaded 后 provider 请求包含目标替换、状态和 clear 的顺序，不是 GUI 可见历史断言。最小验收矩阵应覆盖该链、automatic/missing/budget-only 零来源、无 row clear、来源失败、DB 失败后来源保留、host marker 伪造、700 JSON UTF-8 byte 完整性、compaction 并发 tail、fork/rollback，以及 canonical reader 零伪 Turn/UserMessage/计费/额外步骤。协议纵切还需 contracts；真实 Desktop/CLI 证据仍按各自主链执行，源码分析不替代运行验证。

## 实施落点与后继

| 参考职责                                       | Lime current owner                                        | 本轮结果                                                         |
| ---------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `Lft` / `Put` 的 receipt → draft / raw history | `prepareThreadGoalDraft`、`EmptyState`、`useInputbarSend` | 两入口复用同一 draft；空命令只进入目标模式                       |
| `_9e.I` 素材物化与新线程所有权                 | 冻结 `materializeThreadGoal` + `submitNewThreadGoal`      | 一次物化；创建/接受/unknown 保留、创建前失败回收                 |
| shared `ENt` 的 `/goal` 包装                   | `formatThreadGoalPrompt`                                  | 首轮与乐观投影同源，原始 history 正文独立使用同一包装规则        |
| `zln` / `Uun` 的真实创建与首轮 admission       | 既有 workspace / agent stream / session client            | 没有新增后台或线程创建 owner；目标不走 workspace command prewarm |
| `_9e.he` accepted 后 goal set，`U9n` 失败反馈  | `agentStreamSubmitExecution`、`threadGoalClient`          | 保留 accepted → set，五语言反馈不改变 accepted 事实              |
| 已有线程独立目标保存                           | 冻结 `useThreadGoalComposer`                              | 定向测试证明既有线程不发普通 Turn；未改冻结附件逻辑              |

已迁移旧 `useInputbarSend` objective_mode 原始文本 fallback 和 Home/Inputbar 的 raw 首轮正向断言。新职责用领域名命名；安装包只有压缩定位符，未假冒恢复其原始开发符号。

后继 trusted durable user goal provenance 仍由协议/runtime owner 负责：protocol set/clear origin、schema/TS client、threadGoalClient、processor/thread_goal、runtime goal mutation 与来源持久化、恢复/provider history/compaction/fork 消费、retained authorization，以及 App Server public integration/contract/CLI 共用验证。落点必须在既有 App Server/runtime/thread-store/agent owner；不以 renderer 本地行或自动 continuation 冒充用户来源，不新增平行 backend。canonical 可见目标编辑历史从待实施能力中移除，守住上游“不新增 UserMessage/Turn”的展示边界。

## 本轮验证与交付边界

- REA：复用 portable bundle summary、三成员 SHA-256、Babel AST 声明/方法定位和调用链静态核对；Codex HEAD 已记录。targetExecuted=false，未运行参考 Electron。
- C1 第一轮：7 文件 213 项中 212 项通过，唯一失败为新增测试对现有 materializeFailed 文案的字面误写，已修正；其余 workspace routing/text、send observer、accepted → set 顺序及五语言 set 失败保持接受回归通过。
- C1 最终扩展轮：7 文件 97 项全部通过，覆盖 shared ownership helper、Home paste/image/empty/stale/unmount、新线程 Inputbar、原有普通 Inputbar、已有线程 goal hook 与菜单接线。修正后的 Home 失败提示在此轮通过。各轮有共享文件，不能直接相加作为不重复项数。
- C0：第一轮 14 个受影响 TS 文件 strict lint 和完整 renderer types 通过；threadless 扩展后 8 文件 strict lint 通过。扩展 tsc 的 payload triggerSource widen 已用显式 `InputbarSendPayload` 修正；最终完整 `npx tsc --noEmit --project tsconfig.renderer.json` exit 0，补注解后的 send owner strict lint 再次通过；19 个受影响 TS 文件按最后相关修改轮次完成 strict lint。
- activeTurn 清理后的定向回归：`agentStreamSubmitExecution.test.ts` 13 项全部通过，对应源码/测试 strict lint 通过；普通 steer 保留，目标首轮遇 activeTurn 无 set/steer/乐观清理/接受回调副作用。
- 未做：构建、contracts、current fixture、GUI smoke、真实 Electron Gate B、live、Windows/packaged；根进程统一持有构建和真实产品验证，本进程不并行启动。
- 根 fixture 后继待跑：目标首轮完整 `/goal <objective>` 及 canonical thread/read 的同一 userTurn/userMessage 精确正文；已有线程 4400+ codepoint 目标从真实 AgentRoot/attachments/UUIDv4/goal-objective.md 物化，验证引用≤4000、完整 UTF8 字节及 fs/createDirectory/writeFile + goal/set IPC。尚未运行，不能写 Gate B 通过。
- 本轮实际源码写集：`EmptyState`、`newThreadGoalSubmission`、`useInputbarSend`、`useInputbarController`、`agentChatShared`、`agentStreamSend`、`agentStreamSubmitExecution`、`workspaceSendHelpers`、`useWorkspaceSendActions` 及对应回归；文档为本报告与 auto-layout 计划。避让冻结附件实现、根 fixture、主计划、architecture、protocol/generated、Rust、线程创建 owner 与并行 sidebar/FileTree/read-model。
- 分类：draft/materializer、新线程 shared helper、typed send、独立 goal client/runtime/store 为 current；threadless raw goal fallback / raw 首轮旧断言已删除；activeTurn set → steer 旧分支及旧正向断言已删除；未新增 compat/deprecated 包装。renderer null-turn 行不是 canonical producer，durable user origin 仍为 gap。
- 后继只读复核：固定上述 current HEAD，核对 origin、record→DB、700 JSON UTF-8 bytes、canonical 不投影、provider/retained authorization 与锁/compaction/fork 边界；本次仅更新本报告及 auto-layout 计划，未修改产品、Rust、协议或架构，未新增测试/构建/Electron 运行证据。
- 完成度：REA 顺序/ownership/owner 调查与后继只读边界复核 100%；Home / threadless 新线程源码与本进程定向验证 100%，产品 Gate B 未结算。trusted durable origin、provider history 与 retained authorization 仍为未实施 gap；canonical 可见目标编辑历史不作为待造能力，整体 GUI 对齐百分比由根任务统一结算。
