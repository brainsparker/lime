# Codex 异步问题的生产、投影与答案提交

状态：只读静态研究完成。调查日期：2026-10-20。
后续实现与验证状态见[后端实施记录](../../exec-plans/artifacts/async-user-input-20261020/backend-implementation.md)。

Codex current 的真实 producer 是 `request_user_input_async`。它把问题作为标准
`AgentMessage.questions` 发出，立即返回 `{"accepted":true}`，模型继续运行。
Desktop 按 canonical item 派生题目身份和表单草稿，答案通过既有消息发送器以
`send-now` 提交。它不是同步 `request_user_input` 的 reverse RPC 回复，也没有独立的
`question/respond` 协议。本报告只记录证据与可实施边界，不代表产品实现或 GUI 验收通过。

## 证据身份与覆盖

安装包为 Codex Desktop `26.1007.30912 / 20156`，ASAR SHA-256：
`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
原件保全根目录为 `/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/`。

| 原件相对路径                                                              | SHA-256                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `composer-editor-evidence/webview/assets/app-primary-6f60e9ac4103.js`     | `7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321` |
| `composer-editor-dependencies/webview/assets/app-initial-6350d04672d0.js` | `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f` |
| `composer-draft-persistence-artifact/app-shared-8bd9d0399038.js`          | `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245` |

Acorn 解析完整原件后按 UTF-16 半开 source span 提取完整函数声明，未执行 bundle。
仓库内保全为 [完整证据归档](../../exec-plans/artifacts/async-user-input-20261020/rea-records.tar.gz)
及 [逐成员完整性记录](../../exec-plans/artifacts/async-user-input-20261020/artifact-integrity.json)。
归档包含两份新 REA 完整记录、manifest、37+9 声明输入、旧 29 声明完整证据与输入，
以及四份完整安装包 JavaScript 原件；不依赖临时目录存续。压缩包 SHA-256 为
`dcc45f56bf2c02488d63aee17363eef78be98881d154674e40e47602c52f1abf`，12,058,884 bytes。
89 个成员全部回读核对 SHA-256；37+9+29 声明的摘要与原件 UTF-16 source span 全部匹配。
原始工作目录为 `/tmp/lime-async-user-input-rea-20261020/`。

| REA Evidence                                                          | 输入摘要                                                           | 解析结果                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `ev_e4e0901acf437ccf3ed6d3ec29a0096f3b9ab1d80ed85001fe349ae806e73f32` | `9a70c045986c0ec3bc7503de2ad15384adb9047ae17906a7cbe51ee59e586615` | `input/`；37 声明、20,918 bytes、7,210 AST nodes        |
| `ev_1a7806e0b5d2303945f372dd300baf8073bc766c6cd3be3277cde9b5307f6ad5` | `13d4b0211e272b04e495fe9831e54d253dbfae4e838992b1e11194be7bd407dc` | `followup-input/`；9 声明、5,664 bytes、1,506 AST nodes |

两次 parse failure 均为 0；application inventory coverage 为 complete，无截断/遗漏；
semantic coverage 为 unknown，关系族 partial，omitted nodes/relations 为 0。
提取输入不保留全部模块闭包，跨模块别名以完整原件 AST 的 import/export 核对；
这不是 REA 自动证明所有动态调用路径。复用原有 29 声明 Evidence
`ev_a908f380896c707334ef1867c231f191790e0fbe29708ec243c6a7cb5306f437`，
原始工作目录为 `/tmp/lime-user-input-rea-20261020/`，归档内为 `questions-29/`。

`targetExecuted=false`：没有启动参考 App 或 Lime，没有 Electron、重启或真实交互证据。
`summary.json` 是一次不适用 CLI 输入的错误输出，未作为证据使用。
公开源码固定为 `/Users/coso/Documents/dev/rust/codex` 的
`8c076942cb70fba8e5c4732c23f1faabc4aed484`。它用于解释 current producer/协议，
不能倒推旧安装包已经启用同一模型能力或实验开关。

## current 工具生产合同

以下路径均相对固定的 Codex 源码仓库。

| 位置                                                              | 源码事实                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `codex-rs/core/src/tools/spec_plan.rs:1316`                       | 同时要求 `experimental_request_user_input_enabled`、root agent，且模型 `experimental_supported_tools` 包含 `request_user_input_async` 或旧 catalog 键 `send_user_message_async`；注册 exposure 为 `DirectModelOnly`。旧键仅用于能力识别，实际工具名仍为 `request_user_input_async`。 |
| `codex-rs/core/src/tools/handlers/request_user_input_async.rs:22` | 工具参数仅 `questions`；`deny_unknown_fields`。schema 至少一题，每题必有 `title`，`options` 可省略；存在 options 时至少一项，不接受额外题目字段。模型 catalog 可覆盖 description/parameters。                                                                                        |
| 同文件 `:105`                                                     | 先验证全部题目，再发送 item。拒绝空 questions、空白 title、空 options 或空白 option。错误不会先发布部分问题。                                                                                                                                                                        |
| 同文件 `:131`                                                     | `AgentMessageItem.id=call_id`，text 为标题与 `- option` 行，题间空行；`phase=FinalAnswer`、`delivery=Async`、`questions=Some(...)`、memory citation 为空。                                                                                                                           |
| 同文件 `:144`                                                     | 顺序发同 item 的 started/completed，然后返回 `{"accepted":true}`，不等待用户输入。                                                                                                                                                                                                   |
| `codex-rs/protocol/src/items.rs:147`                              | `AsyncUserInputQuestion { title: String, options: Option<Vec<String>> }`；没有 question id、request id、isBlocking 或答案状态字段。                                                                                                                                                  |
| `codex-rs/core/tests/suite/request_user_input_async.rs:447`       | 既有测试覆盖 started/completed 同 id 与 questions、下一次模型请求带 accepted 输出、继续完成 turn；不向模型历史伪造含题目的 assistant message。这里只读测试，未运行。                                                                                                                 |

工具说明要求推荐答案放在第一项、不传 `Other`，自由输入由 UI 提供；它也明确预选不等于提交。
旧安装包中首题默认选择的完整运行表现未观察，不能仅由 current 工具说明作视觉验收。

## canonical 事件、通知与恢复

```text
request_user_input_async
  → AgentMessage { id: call_id, delivery: async, questions }
  → ItemStarted / ItemCompleted
  → rollout persistence → App Server item/started / item/completed
  → Desktop 同 turn、同 item.id upsert
  → 派生问题身份、选题和题稿
```

`core/src/session/mod.rs:2441` 的 `send_event` 调用 `send_event_raw`，随后产生同源 legacy events。
`:2653` 的发送实现先按 rollout policy 持久化 EventMsg，再 deliver；这不是 UI 本地虚构消息。
`app-server/src/bespoke_event_handling.rs:1087/:1131` 将生命周期映射为标准通知。
`app-server-protocol/src/protocol/v2/item.rs:254/:891` 的 public AgentMessage 与 core→v2 映射保留 questions。
AgentMessage 不经过同步用户输入的 reverse request 分支。

Desktop shared `Ktn [2821830,2826091)` 消费两类通知，取得 threadId、turnId、item 和时间，
必要时建立 turn，然后经 `qtn [2826091,2826582)`、`rp [287987,288011)`、
`Km [354132,354249)` 更新列表。`qtn` 仅特殊处理 collab/image，AgentMessage 原样通过；
`rp` 为 identity，`Km` 按 item.id 替换或追加，所以 questions 与同 canonical item 一起保留。

恢复必须区分“字段保留”和“身份稳定”。current 的
`app-server-protocol/src/protocol/thread_history.rs:626` 不直接 upsert AgentMessage 生命周期 item；
完成事件通过 `protocol/src/legacy_events.rs:125` 派生 AgentMessageEvent，保留
phase/delivery/questions，随后 `thread_history.rs:526` 恢复。
`:2633` 的既有测试证明这些字段保留；但该恢复 handler 用 `next_item_id`（`:1544`）生成
`item-N`，该分支没有保留 producer 的 call_id。
因此本次未证明“旧安装包重启后的 questionItemId 与先前答案必然一致”，也不把该分支重建 ID
认定为 Lime 应复制的方案。Lime 应在既有 canonical ID owner 保留身份，并以真实恢复证据验收。
Desktop thread/read 分页与首次 hydration 的全部动态分支也未闭合。

## Desktop 派生问题与草稿

下列压缩名仅为原件定位符；上游未压缩 GUI 函数名未知，不应迁入 Lime。

| 原件位置                                               | 已确认行为                                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| shared `qH/Bmn/Vmn [3259321,3259590)`                  | 选择 `type===agentMessage && questions.length>0`，无需额外判断 delivery；按 question index 派生 `{id,sourceItemId,questionIndex,title,options}`，缺省 options 为 `[]`。没有新 canonical Question item。                  |
| shared `F5t [2660569,2660643)`                         | 题目身份唯一编码为 `JSON.stringify(["request_user_input_async", sourceItemId, index])`。                                                                                                                                 |
| shared `V5t [2661130,2661486)`                         | 自动选题候选要求真实 turnId 且 status 为 inProgress；从 questions 减去已被 accepted 用户消息回答的 ids。未接受的 steering 不算回答。                                                                                     |
| initial `pIt/lIt [1323910,1324610)`                    | conversation 未到达时 loading；连接 ready 且 gate enabled 后才跟随 canonical turn/items。排除 startKind/source 为 aeon 或对应运行状态不为 off 的线程。                                                                   |
| shared `iX [3669557,3669604)` / `XJ [3634074,3634528)` | 前者明确比较 startKind/source 的 aeon；后者初始化该状态 GJ 为 off，监听 `aeon-durable-paused-v1:<threadId>`，取值包含 stopped/sleeping。XJ 为完整原件 AST 补读，未收入上述两次提取图。不能把该 gate 改写为任意审批开关。 |
| initial `GS [1328107,1328676)`                         | AppScope family state：按 host/thread/entity 保存 question IDs；再加 itemId 存题稿；按 host→thread 保存 selectedQuestionKey 和 questionIds。                                                                             |
| initial `mIt [1324610,1325657)`                        | canonical questions 与已接受答案同步到 `{turnId,title,draft,draftBaseline,lastSubmission,isSubmitting,isSkipped}`；只有 draft 仍等于旧 baseline 才跟随新答案更新，不覆盖用户编辑。                                       |
| initial `hIt [1325657,1326539)`                        | 注册题目，保留已有 draft；同 turn 已有 selection 时追加问题，否则选首题。                                                                                                                                                |
| initial `_It/vIt/yIt/bIt/xIt/CIt [1326696,1327971)`    | 切题只允许同 entity 已注册 ids；编辑只写对应题稿；关闭清 selection；skip 标记状态；提交批量设置 submitting；清 entity 时移除其题稿和 selection。关闭/skip 不调用 runtime interrupt。                                     |

这是 AppScope 中的派生交互状态；未发现本次路径把未提交草稿写入协议或磁盘的证据。
不能把同 scope 重挂载、切线程、跨窗口与重启草稿恢复混为同一保证。
同步请求的另一套 requestId 草稿合同见
[同步问答报告](request-user-input-draft-audit-20261020.md)，两者不共用请求身份或回复语义。

## 答案提交、反馈和重放

primary `N$e [531976,532291)` 读取选中 question key，渲染 `P$e [532291,536323)`。
后者核对 host/thread/entity、真实 turnId、source AgentMessage、当前题目与 selection；
界面复用逐题表单 `vz`，题目表单具有自己的 draft/controller 生命周期，保持主 Composer 的 owner。
自动布局使用 selectedQuestionKey；它不是同步 pending request 的别名，相关布局证据见
[Composer 执行计划](../../exec-plans/codex-composer-auto-layout-20261020.md)。

1. `x$e [525623,530063)` 提供 Next、Send、Send update、Skip。非最后题只向下一题移动；
   最后一题才汇总 selection 下的答案。空答案不发，全部为空不提交。
2. 每条回复为 `{questionItemId,question,answer}`；question 为原 title，answer 为 trim 后 draft。
   shared `I5t [2660643,2660704)` 将非空回复数组序列化为唯一 envelope：

   ```text
   <send_user_message_question_reply>
   [{"questionItemId":"…","question":"…","answer":"…"}]
   </send_user_message_question_reply>
   ```

3. `P$e` 以 `turnTrigger="send_user_message_async_question"`、空附件/IDE context、
   `agentMode="auto"`、`permissionProfileId=null`、`shouldSendPermissionOverrides=false`
   调用通用发送器，`queueModeOverride="send-now"`。
   该 trigger 是消息上下文，不是新增 RPC 方法。initial `Tta [5261364,5264740)`
   继续使用既有 clientUserMessageId、restoreMessage、prepareContext 和 turn coordinator.sendMessage。
   start/steer/admission 的最终分支由真实线程状态及能力决定，本次未证明恒定某个 wire method。
4. 提交前按题设置 submitting；成功由 `A$e [530666,531351)` 更新 baseline/lastSubmission，
   只从 selection 移除草稿仍等于本次发送值的题目，发送期间新编辑保留。失败 toast，finally
   复位 submitting，未观察到失败清草稿分支。
5. Skip 清当前题 draft；最后题若有之前的非空答案则提交这些答案，否则只关闭。
   用户关闭清 selection，不 interrupt、不伪造同步空 answers 回包。

shared `tV/nV [2660704,2661130)` 严格解析首尾 wrapper 与回复 schema，支持非空数组及旧单对象。
`K5t/q5t [2661767,2662079)` 只从单 text 用户输入读取；
`exr [4937690,4938846)` 仅关联实际存在的 canonical AgentMessage 派生 ids，
消费 userMessage 或 accepted steering，按顺序保留最后答案，并按服务端 id、client id、内容匹配去重。
其输出为 answersByQuestionItemId 和 replyItemIds，用于题稿 baseline 及答案行呈现，
不是第二套答案历史存储。

## Lime 调查起点与最小纵切

下表记录实施前只读调查的缺口，不等于全仓普查结论；后续变化以上述实施记录为准。

| 层                    | 当前缺口                                                                                                                                                                                                                                                                      | 最小实施范围                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| canonical/public item | `agent-protocol/src/thread.rs:322` 的 AgentMessage 无 delivery/questions；public `app-server-protocol/src/protocol/v2/item.rs:65` 有 delivery，无 questions。                                                                                                                 | 对齐公开 `AsyncUserInputQuestion` 与 optional questions；补 canonical payload、public 映射、schema、生成消费者。同 item identity，勿加 requestId/isBlocking/自造 Question item。                                                                                 |
| 工具定义与能力        | `tool-runtime/src/request_user_input.rs` 是同步工具；`agent/src/agent_tools/catalog.rs:213` 和 `current_provider_turn/mcp_step_snapshot.rs:223` 只有同步登记。`model_request_policy.rs:99/:590` 已解析 experimental_supported_tools。                                         | 在 tool-runtime 承担独立 async schema/验证与定义，在既有 sampling surface 按模型能力和 root 条件登记；不得仅凭工具别名默认给全部模型开放。Lime 的实验开关映射需实施时明确，不能假装已有上游同名设置。                                                            |
| producer 与 host 事件 | `agent/src/current_provider_turn/tool_executor.rs:193` 的同步 callback 等待 session response。`CurrentTurnToolLifecycleEmitter` 已持有当前 session/thread、同事件 sender/sequence 与工具生命周期。                                                                            | 复用 current executor/host event owner 发布标准 AgentMessage started/completed，再返 accepted；不走同步 callback。需用显式领域能力/事件承载有效问题，避免 renderer 解析任意工具输出。处理通用 tool row 与问题 item 的身份/可见性，不能平行发出误导的等待问答行。 |
| 持久化与读模型        | `app-server/src/runtime/thread_item_projection/agent_message.rs`、`materializer/lowering.rs:222`、`change_set.rs:303`、`read_model/canonical_items.rs:164` 均会重建 AgentMessage 字段；public projection `processor/thread/projection/item.rs:17` 还从 metadata 读 delivery。 | canonical 字段必须经过 live、merge、持久化、thread/read、items/list、rebuild 和 fork；同 canonical payload 承担问题事实，不再增加 metadata/临时表双轨。异步问题与流式正文并存要验证当前消息生命周期约束。                                                        |
| provider history      | `app-server/src/runtime/provider_history/canonical.rs:32` 可由 AgentMessage 重建 assistant 文本。                                                                                                                                                                             | 验证 async 展示消息不被该 fallback 合成为模型 assistant history；保留实际工具调用与 accepted 输出，随后答案按普通用户输入进入 provider history。                                                                                                                 |
| renderer reader       | `src/lib/api/agentRuntime/appServerCanonicalItemReader.ts:77` 重建 agent_message 时未保留 questions/delivery。                                                                                                                                                                | 同 canonical live/history reader 保留字段，基于 source item 派生稳定题目 key；题稿 scope 为 host/thread/entity/question，独立于同步 requestId 草稿。                                                                                                             |
| Composer 与发送       | 当前 chat/api 窄搜索未见 async question envelope 消费者；普通发送没有 `send-now` 参数，`executeAgentStreamSubmit` 按 canonical active turn 选择 steer/start。队列列表的“立即发送”为 queue/start。                                                                             | 同步/异步共用适用的表单 primitives，异步选择与草稿 owner 独立；通过既有普通发送/steer owner 发送 wrapper，实现 Codex send-now 对应的即时输入语义，保持错误保稿、late-edit 保留、accepted 用户消息去重。不要接 queue/start 或新增问答 RPC、Electron 私有通道。    |

上表 Rust 路径相对 `lime-rs/crates/`。它是实施建议，不是已落地接口设计。
工具执行上下文当前仅有专用 ToolLifecycleEmitter；若需扩展消息发布能力，应落在现有
tool-runtime→agent-runtime/host 边界，并同步其 CodeMode、history budget 等委托者。
不能把通用 `emit` 直接当成已支持任意 AgentMessage 的 API，也不能越过 App Server canonical append。

## 必须验收的合同与未知项

后续产品实现至少需要以下证据，本次没有运行这些测试：

- producer：能力/root/开关矩阵、全部参数先验校验、错误零 item、同 id started/completed、
  accepted 后继续采样、无合成 assistant、无同步 pending request。
- projection：通知到 read/items/list、merge、重启/rebuild、fork 后保留 questions 和 source item
  identity；原有正文流式 item 与即时问题并存不破坏 lifecycle。
- 回答：多题 Next/Skip/Send update、自由输入、失败重试、发送中编辑、切线程重挂载、
  accepted steering 与 canonical user message 去重；未接受消息不能把问题标为已回答。
- GUI：遵循仓库 current fixture 与 `verify:gui-smoke`；真实 Gate B 证明 Electron、preload/IPC、
  App Server、runtime/read model 与用户可见状态，不能用 renderer 注入模拟代替 producer。
  协议改动同时执行 `test:contracts`，可见文案覆盖五语言。

尚未确认：参考安装包实际 gate/模型启用情况；首次 hydration 全部动态路径；原包重启后派生题目
与旧答案的 identity 关联；未提交题稿跨窗口/重启恢复；queue coordinator 最终具体 wire 分支；
Lime current 生命周期对并发异步 AgentMessage 的适配范围。不得把这些写成已实现或已验收。

分类：异步问题为 current 对标合同；同步 request_user_input 继续由其 current owner 演进。
只读研究完成度 100%；Lime 产品实现与验证单独记录，不能用静态研究替代运行验收。
