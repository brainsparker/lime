# Composer 布局消费者核对与 IME 回归

## Home / threadless Inputbar 新线程目标纵切（2026-10-20，源码已冻结）

负责人：`/root/remove_import_client_contract`。参考为独立报告 [Home goal 顺序与 canonical owner](../research/codex-desktop-rea/goal-new-thread-canonical-20261020.md)，同 ASAR REA50 与同摘要 AST 补证据。当前产品冻结窗口结束后，根任务授权本切片实施；本进程不构建，不修改根 fixture、主计划、architecture、Rust/protocol 或线程创建 owner。

Verification Contract：budget:normal，风险 P1。前端入口为 `EmptyState.handleSend -> 同一 Controller/coordinator receipt -> prepareThreadGoalDraft -> materializeThreadGoal -> workspace send -> thread/start/turn/start -> accepted receipt -> thread/goal/set`；typed fs、Desktop preload/IPC、App Server JSON-RPC、RuntimeCore 与 canonical projection 均复用 current owner。只新增本地 session-ready observer 信号表示真实 ensureSession 已返回，以决定已创建线程引用的附件保留；该信号不进入 wire。goal updated 通知仍为 thread metadata，不生成假 Turn/Item。无新增跨层 owner/协议/read-model，无重大架构变更。

输入为纯正文、paste/image、超长目标及空命令；Home 与 threadless Inputbar 共用 `submitNewThreadGoal`、`buildNewThreadGoalSendPayload` 与唯一 `formatThreadGoalPrompt` 序列化 owner，输出为同源 `/goal <materialized objective>` 乐观/首轮正文，首轮 accepted 后才 set。Home 物化/创建前失败回收，真实 session-ready、accepted、unknown 时保留，created 后首轮拒绝保留重试素材；set 失败复用五语言可见失败提示并保留 accepted Turn。删除 threadless raw goal fallback；旧 activeTurn set → steer 路径直接替换为目标首轮碰 activeTurn 时在 set/steer/乐观清理前拒绝，普通无 goal steer 保留。失败保留完整草稿；异步准备校验原 capture binding，旧 receipt 不清新 revision。禁止恢复 null-turn 本地行到 canonical 历史；durable user origin 留独立协议/runtime 后继。

窄写集：`EmptyState.tsx` goal 分支与目标回归；新 `newThreadGoalSubmission.ts` / test；`useInputbarSend.ts` / tests、`useInputbarController.ts` 与 Inputbar selection 目标断言迁移；`agentChatShared.ts` observer、`agentStreamSend.ts` / test、`agentStreamSubmitExecution.ts` / test；`useWorkspaceSendActions.ts` goal 最小谓词、`workspaceSendHelpers.ts` / test 与 workspace goal 测试；本计划与上述报告。五语言复用现有 keys，无新增文案或 schema。两个 workspace 大文件只修改谓词/早返回，不增加新编排逻辑；退出条件为 goal 逻辑落在独立 helper 与既有 owner，后续大文件拆分仍由根任务治理。

验证：C0 定向 strict lint、renderer types、窄写集 whitespace；C1 Home component、ownership helper、workspace routing/text、send observer 与 accepted-after-set-failure 回归。C2 contracts/current fixture/GUI smoke/真实 Electron Gate B 由根任务统一执行，本进程不启动构建或 GUI。当前不能进入 release evidence。

本轮执行记录：

- 第一轮 7 文件 213 项：212 通过，新增 Home 测试的 materializeFailed 文案字面误写已修正；workspace routing/text、send session observer、accepted → set 顺序与五语言 set 失败保持接受回归通过。
- 删除 threadless fallback 后，7 文件 97 项全部通过：shared ownership helper、Home paste/image/empty/stale/unmount、threadless Inputbar、普通 Inputbar、已有线程独立 goal hook、Inputbar 菜单接线。修正后的 Home 失败提示通过；两轮共享测试不能直接相加。
- 删除 active goal → steer 残留后，`agentStreamSubmitExecution.test.ts` 13 项全部通过：普通 steer、goal 碰 activeTurn 零副作用拒绝、accepted 后保存及五语言失败反馈。对应源码/测试 strict lint 通过。
- C0：第一轮 14 TS 文件 strict lint 与完整 renderer types 通过；threadless 扩展 8 TS 文件 strict lint 通过。扩展 tsc 发现提取 payload 后 triggerSource 字面量被 widen，已显式标注 `InputbarSendPayload`，最终 `npx tsc --noEmit --project tsconfig.renderer.json` 复验 exit 0；补注解后的 send owner strict lint 再次通过。19 个受影响 TS 文件均按最后相关修改轮次完成 strict lint；源码已冻结。
- 根进程持有后继 fixture：新目标完整 `/goal <objective>` 的 turn/start 与 canonical thread/read 同一 userTurn/userMessage 正文；已有线程 4400+ codepoint 目标经真实 AgentRoot/attachments/UUIDv4/goal-objective.md，验证 canonical 引用≤4000、完整 UTF8 文件字节及 fs/createDirectory/writeFile + goal/set IPC。尚未运行，保留 Gate B 待跑，不提前计通过。
- 本轮没有新增五语言键或修改冻结附件 owner、Rust/protocol、线程创建 owner、根 fixture、architecture。current 为唯一 draft/materializer/shared new-thread send 与独立 goal/set；raw fallback、raw 首轮旧断言和 active goal → steer 正向路径已删除；无新增 compat/deprecated 包装。trusted durable user origin、provider history 与 retained authorization 仍为后继 gap；canonical 可见目标编辑历史经 current 源码复核从待造能力中移除。
- 原则：同一 receipt 与素材 owner 符合 DRY；两个 surface 只保留交互/生命周期接线，typed lowering 与 ownership 在 helper，符合单一职责；不为目标另建 backend、read model 或 compat，符合 KISS/YAGNI。

状态：消费者核对、IME 回归和已有线程目标 Composer 及附件闭环源码已冻结，定向回归通过；本进程最终整树 renderer types 已通过，根任务统一结算其当前候选门禁。异步问答 / compact 与 trusted durable goal origin/provider history/retained authorization 仍为 gap；新线程目标源码与定向验证见本节，根产品门禁尚待结算。负责人：`/root/remove_import_client_contract`。本计划从 [Composer 主计划](codex-composer-layout-20261019.md) 拆出 REA50/55 消费者核对；整体 GUI 仍未完成，根任务统一构建与真实桌面验收。

## 后继目标来源合同复核（2026-10-20，只读落仓）

本次只改本计划与 [目标研究报告](../research/codex-desktop-rea/goal-new-thread-canonical-20261020.md#current-公开源码的-durable-origin-缺口)，不改主计划、index、architecture、生产、Rust 或生成协议；不启动测试、构建或 Electron。根任务持有统一候选的 build/types/contracts，本次没有新增运行证据。只读复核与记录完成度 100%，下述产品纵切未实施。

current 源码固定到 `/Users/coso/Documents/dev/rust/codex` HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`；旧 Desktop 仍使用本文记录的 REA50 同 ASAR 与 targetExecuted=false 限制，不倒推其已有新 origin 字段。

- **修正交付范围**：`app-server-protocol/src/protocol/thread_history.rs:481` 仅将 user ResponseItem 中可解析的 hook prompt 投影成 HookPrompt；目标来源不生成 UserMessage。`core/src/session/mod.rs:4431` 发的是 raw response notification。canonical 可见目标编辑历史不是待补能力；保留最新 goal metadata，真正 gap 为 trusted durable origin、provider history 与 retained authorization。
- **来源与失败顺序**：`app-server-protocol/src/protocol/v2/thread.rs:858` 定义 optional `ThreadGoalMutationOrigin::{User,Automatic}`；`app-server/src/request_processors/thread_goal_processor.rs:198` 只为 user objective/status patch 记录，budget-only 不记录。`ext/goal/src/api.rs:144/297` 明确校验 → 可信来源记录 → goal DB 写入，mutation permit 横跨准备/记录/提交。记录失败不改 goal；记录成功后 DB 失败仍保留意图。user clear 无 row 也记录，不能误写成来源日志与 goal row 同事务回滚。
- **来源完整性**：`core/src/context/user_goal.rs:68/92` 对 objective JSON 编码后的 UTF-8 字节计数，含引号/转义，超过 700 bytes 整段省略并标 `user.goal.omitted`；GUI 4000 codepoint 是另一界限。`core/src/session/retained_context.rs:84` 不添加 pending input、不重开 active turn、不初始化模型步骤；`core/src/context_manager/history_user_authorization.rs:141` 依赖 host kinds 与 completeness，wrapper 文本本身不授信。
- **Lime 最小纵切**：既有 protocol set/clear origin + schema/生成 TS/client；threadGoalClient 透传，已有线程 Composer/Panel 与新线程 accepted 后 set 显式 user；processor resolve loaded/unloaded thread；runtime 对齐 `UserGoalUpdate` / `record_user_goal_update` 职责，走同一 durable event identity/sequence；provider history/compaction/fork/rollback 消费同一记录；canonical reader 零新增 Turn/UserMessage；retained authorization 单列实现与验收。不能在通用 client 默认补 user，或把 automatic continuation 标成用户授权。
- **Rust 锁热区**：`runtime/thread_goal.rs:31` 持 state mutex，普通 appender 重锁；`canonical_thread_store/goal.rs:50` 持 idle permit 与 SQLite Immediate tx，普通 appender 又 canonical projection/goal accounting 并开 DB 写连接。禁止直接塞回调；需拆准备/记录/提交，在同一 mutation/idle admission 边界保持顺序。`event_store.rs:371` 已有 EventLog → projection → live state，`event_store/recovery.rs:8` 负责 durable tail 恢复，不能内存先确认或失败盲重写日志。
- **历史热区**：`thread_inject_items.rs:78` 会 steer active actor，不直接复用；`agent-protocol/response_item.rs:41` 缺 `content_item_kinds`，新 host 标注要和任意 raw 注入隔离；`agent-runtime/model_history.rs:103` 不接受 user goal。`model-provider/current_client.rs:825` 拒绝非 Responses raw history，provider consumer 应沿现有 user/text 多协议 lowering，保留 host 完整性供授权 consumer。`provider_history.rs:219` 的 coveredThroughSequence + tail 必须保留 compaction 期间新编辑；`thread_fork/model_history.rs:9` 只复制有 turn 的 model history，需显式处理选定 prefix 的无 turn 来源及继承语义；不造 turn 绕过，rollback 沿 sequence lineage。
- **授权消费者缺口**：Lime `agent/src/current_provider_turn/tool_executor/guardian.rs:63` 仅传当轮 `user_visible_input_text`，没有 Codex retained authorization consumer。仅加 origin/provider history 不能宣布 Guardian 完全对齐；不从最新 goal row 或 renderer 文案推授权。
- **后继退出条件**：loaded/unloaded/restart set→replace→status→clear 顺序；automatic/missing/budget-only 零来源；无 row clear；来源失败/DB 失败意图保留；host marker 伪造与 700-byte completeness；compaction 并发 tail、fork/rollback；canonical 零伪 Turn/UserMessage/计费/额外步骤。协议 contracts 与真实 Desktop/CLI 主链证据由后继实现统一执行，不能用本次只读结果计为通过。

分类：现有 Composer/draft/materializer、goal API/store/accounting 为 current；可信来源/模型历史/授权消费者为 current owner 内的未实施 gap；canonical 可见目标编辑历史为本轮移除的错误待办；无新增 compat/deprecated 或平行 backend。下一刀由根任务在 Rust/protocol 热区释放后选定纵切，本进程不接管该写集。

## 事实与写集

- 参考：Codex Desktop `26.1007.30912 / 20156`，同一 ASAR。REA50 parent `ev_e74e1af289bfe4b44f9d691f18aa79ec95a893d4a5777f632a16322c35804154`、summary `ev_04da4a8b16295f0fa2a5d06062af9a3b852833803de24b39df85350ed5053e61`。
- REA55 parent `ev_b7fca04b25e3ad1c0bd9ba80ea1778bad6c0db9d5ceff125c2648ca3edb183d2`、summary `ev_3622c0d554ad650788ace385751e01f0c8e4872c247c4fe18467b70dcd18760d`。源码成员 `app-initial-6350d04672d0.js` SHA-256 `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`。
- 完整 Evidence、提取声明和摘要复用 `artifacts/codex-shared-page-header-20261018/composer-mode-*50*`、`composer-overflow-*55*`；源码位于 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/{composer-mode-50,composer-overflow-55}/input/`。
- `rhl/ihl/chl/uHc` 是压缩定位符，不能成为产品函数名；仅对齐确认的字段名、返回合同和实际行为。
- 初始布局核对写集仅 `Inputbar/components/ComposerLayout.component.test.tsx` 和本计划。经根 Agent 确认，该阶段不新增无消费者的 auto 选项或 overflow API；后续已有线程目标纵切写集见本文后段，不覆盖并行改动。

## Verification Contract

预算 `budget:normal`；风险 P2（布局切换、IME、草稿/焦点）。

current 主链：`InputbarCore -> useComposerLayout -> ComposerLayout.AdaptiveFooter -> 同一 ComposerEditor / ComposerController`。App Server、Electron IPC、runtime、read model 和 runtime events 不适用：本切片只投影输入布局，不发送命令或改变 Thread/Turn/Item 身份。

本轮回归输入：附件、Controller 的真实 ProseMirror 文档、听写投影、DOM 溢出与 composition 生命周期。输出：单行/多行布局、附件主体布局、同一输入与控制槽位。普通输入保持 `multiline`，不由空稿推断开启单行。

参考合同（其中 auto 相关行为仍未移植）：

1. `auto-single-line` 受可见附件、多顶层块/换行、voice、实际 overflow 与 layout lock 约束。
2. 非空草稿一旦单行溢出就保持多行，避免布局来回抖动；空稿重置，空白草稿在容器宽度变化时可重新尝试单行。
3. 组合输入从开始到结束锁定当时布局；普通模式、附件/听写投影变化不会中途替换 EditorView。
4. 单行、非听写、已连接且可见的 root 才反馈实际 editor 纵向或 textblock 横向溢出。root 的 `data-overflowing` 继续反映自身纵向滚动。
5. ResizeObserver、字体完成、Controller 事务触发重测；卸载清理订阅和监听。预测投影不是正文，当前无 prediction owner 时只读真实文档，不虚构预测内容。

失败应停在 surface：不删除草稿、不重建 Controller、不抢用户已切离的焦点。

## 实际消费者与未覆盖边界

- REA47 完整 `Qft` 声明的真实选择条件为 `Br.active || Ni || Dn || We != null ? "auto-single-line" : E`；`rpt` 中 E 默认 `multiline`。该声明 SHA-256 `82208174f5dd50c546f0084c809dfb7db70f561dfa8ad9862c8f3af951b7bdac`，`rpt` 为 `a8c3a8934dd9479d65b91660ce6f9f67031c8fac6390ceac3b3ac897d6d01ca3`，本轮与保全 manifest 逐一核对一致。
- `Br` 来自 image markup 的活动文档；`Ni` 来自 Aeon 模式/线程；`We` 来自 `quickChatComposerPresentation`。它们均不是普通首页/会话空稿的替代判断。
- `Dn` 经 `wz -> bO -> app-initial` 导出的 `kIt`，读取 `OIt.selectedQuestionKey`。故 pending interaction 不等于 selected question；不能把任意审批/问答存在直接映射为单行 Composer。`Tr` 经初始包导出的 `PXr` 读取 `NV.pendingThreadGoalObjective`；existing goal 不等于 pending objective，不能使用 `threadGoal != null` 或 objective 工具开关替代。
- `FIt` 为默认值 `default` 的 Composer context，compact 分支只针对该上下文。以上 imported producer 是同摘要保全源码的 AST 只读跟进，不增加 REA50/55 的语义覆盖率，也不证明运行时 flag。
- 普通消费者：`EmptyStateComposerPanel.tsx` 与 `InputbarComposerSection.tsx` 传入 `InputbarCore`，没有 auto mode 的现成业务状态；继续默认多行。
- 迁移前 `ThreadGoalPanel.tsx` 创建/编辑目标使用独立 Textarea。本文后段已将已有线程的目标编辑迁入共享 Composer；现有新线程 objective 开关仍不等于参考 goal-edit 模式。
- 等待问答/审批由独立 pending request / A2UI 表面处理，当前未有可确认的 `isAwaitingInput` Composer 布局消费者。
- `workspace-compact` 是外壳密度，不能映射为参考 Composer compact context。
- 本计划未新增 auto 能力。已有线程目标编辑已在后段接线；进一步核对确认目标模式抑制普通 single-line 选择，不能将其当作开启 auto 的入口。compact、awaited 和 prediction 仍须各自的 REA 消费合同与定向验收。

## 验证与退出

- deterministic：真实 ComposerController/ComposerEditor 组件测试，覆盖默认多行、auto 溢出滞后恢复、换行/附件、宽度、IME、不变的编辑器/草稿/选择区、observer/font/subscription cleanup。
- C0：受影响文件 strict lint、`git diff --check`。
- C1：受影响组件测试与输入生命周期测试；必要时 renderer types。
- C2：`npm run verify:gui-smoke` 由根 Agent 在本切片合入工作树后串行结算。根运行中的 `verify:local` 若读取本轮新字节，必须重做受影响验证。
- REA50/55 均静态分析、targetExecuted=false，不能证明参考运行模式或桌面几何。组件测试不替代 Gate A/真实 Electron Gate B。本切片不宣称 live、Windows 或 packaged。
- 无新增文案，不改五语言资源；主题、多模型和首页 Banner 保留现有 owner。
- 分类：current 继续为唯一布局 hook/同一 EditorView；无新增 compat/deprecated；没有为研究中的 auto 分支添加产品代码或包装层。

## 执行记录

- 已复核 REA50 的 3 个完整声明和 REA55 的 3 个完整声明；父计划中完整覆盖限制继续适用。
- 扩充真实 IME 回归：组合中 Controller 多段文档事务、选择区更新与 resize 重测保持当前布局锁，同一 EditorView，转为听写正文后完整草稿/选择区不丢失。
- 增加无 ResizeObserver 回归：Controller 事务仍触发真实 root 溢出测量，空稿保持多行，卸载后停止更新。
- 4 文件 44 项定向测试全通过：ComposerLayout、InputbarCore、InputbarCore.dictation、ComposerEditor；受影响测试 strict lint 与 diff check 通过。浏览器数据版本提示不影响测试通过；未修改依赖。
- 本轮核对与回归写集完成 100%；不将该分母扩展为 auto 策略或 GUI 产品完成度。根门禁和新真实桌面几何另行结算。

## 异步问答边界（后继纵切已接线）

同摘要 Qft 继续追踪到的 `selectedQuestionKey` 属于异步 mid-turn 问答，不是同步 `request_user_input` 或任意 pending interaction。答题 UI 使用独立 Controller，按 question item identity 发送带 `send_user_message_question_reply` 包装的普通 follow-up；不替换主 Composer。后继[异步问答纵切](async-user-input-alignment-20261020.md)已实现 public AgentMessage questions、独立题稿、每题时间线与答案投影，并将已选问题且无附件接入同一布局 hook。真实 producer 的可信配置接线、fork 过滤及 Gate B 仍开放；compact/prediction 也未实施。不得将这些已接 Renderer 的部分继续写成整体未实施，亦不得将其扩大为真实生产启用。

## 已有线程目标 Composer 纵切（2026-10-20，已冻结）

目标：已有线程的目标设置/编辑进入主 Composer；保存目标只调用 `thread/goal/set`，不额外发送普通 turn/start/steer。删除 ThreadGoalPanel 的独立目标 Textarea 和编辑弹窗；保留替换确认、失败草稿和当前 Controller/coordinator。

窄写集：ThreadGoalPanel 及其测试；Inputbar index、ComposerSection、Controller/send 必要接线；新增目标 hook/定向测试；五语言 agentRuntime 的目标文案小节；本计划。避让并行 InputbarCore、ComposerLayout、styles 和 selection 测试。架构影响：非重大，未改变跨层 owner、协议、包或 read model；复用既有 threadGoalClient、ComposerController 与 ComposerDraftCoordinator。

证据复用：REA50 parent `ev_e74e1af289bfe4b44f9d691f18aa79ec95a893d4a5777f632a16322c35804154`，Codex Desktop `26.1007.30912 / 20156` 同 ASAR，targetExecuted=false。本轮对同摘要保全源码补读，不扩大原 REA semantic coverage。primary 的 `Lft` source span 1357321..1359400 经 Nft、initial U9n (2801128..2801583)、shared Q6t (2623349..2624029) 发送 `{threadId,objective,status:"active"}`，Put 在目标专用提交后结束普通发送。Qft 进入模式只设置 `pendingThreadGoalObjective=""` 并 focus，不覆盖主文档。替换取消只关确认。shared SHA-256 `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245`。压缩符号不是原始源码名称。

Verification Contract（前一纯文本切片）：budget:normal，风险 P1。主链为 `Inputbar -> threadGoalClient -> App Server thread/goal/set -> RuntimeCore thread_goal -> thread/goal/updated -> useAgentSessionThreadGoal`；该阶段 Electron/IPC/runtime 未修改。目标变更后的 idle 启动已有 lib.rs 的 maybe_start_thread_goal_for_thread_if_idle。目标保存不是 Turn acceptance，不能伪造 acceptance receipt。成功只清匹配 thread/session/controller/binding/revision 的草稿；失败、替换取消、线程切换和保存期间编辑均保留输入。纯文本阶段曾显式拒绝附加内容；该临时限制已由下节目标附件闭环替换，不是 current 产品合同。

退出条件：目标入口和编辑入口复用主 Composer；旧 Textarea/Modal 正向测试删除；定向覆盖目标专用分支、替换取消/确认、失败留稿、重复提交、身份/revision 漂移和 coordinator CAS。C0 为 strict lint、renderer types、diff check；C1 为定向 hook/component 测试。根 Agent 冻结工作树后统一构建、verify:gui-smoke 和真实 Electron 验收；本进程不构建、不宣称 Gate B、live 或 packaged。新线程目标创建已由开头纵切实现；trusted durable goal origin/provider history/retained authorization 为后继边界，canonical 可见目标编辑历史已从待造能力移除；附件已进入下节 current 实施。

### 实现与清理

- current：`useThreadGoalComposer` 持有按 surface identity 隔离的 `pendingThreadGoalObjective`、替换确认和目标提交；`useInputbarSend` 在普通 start/steer settlement 前调用确认的 property 合同 `prepareThreadGoalSubmit`。进入模式只聚焦，不预填旧目标或覆盖主文档。
- 保存仅调用既有 `setThreadGoal({threadId,objective,status:"active"})`；沿真实通知更新 canonical goal。成功使用现有 Controller revision 或 coordinator binding/generation + CAS 清当前稿；不伪造 runtime acceptance 或 canonical transcript。API 已成功后的历史观察者/CAS 清理异常分别诊断，不误报请求 rejected。
- deleted：ThreadGoalPanel 的独立目标 Textarea、Modal、表单状态、旧 `handleSave` / `editedGoalStatus`、6 个无消费者五语言文案及过期正向测试。目标状态 pause/resume/complete/clear 仍归现有 canonical API owner。
- current/test-only：Inputbar 实际接线测试沿共享菜单与面板编辑回调进入同一真实 EditorView；共享 fixture 仅增加 onEdit 测试按钮。Plugin send 旧裸 @ 期望迁为 REA 确认的 URI Markdown，保留 typed inputMentions；mention 不再伪装为 opaque textElement。未新增 compat/deprecated 双轨。

### 验证结果与剩余差距

- C1：ThreadGoalPanel 11/11、目标 hook 18/18、send 21/21、Inputbar 目标接线 6/6，共 56/56 通过；真实 Controller/coordinator CAS 覆盖失败、取消、重复保存、编辑与线程切换迟到结果。
- C1 扩展：共享 fixture 受影响的 Inputbar controls/draft/selection/workflow/goal 与 send 共 6 文件 68/68 通过。并集为 8 文件 97 项，避免将重复执行计为新增覆盖。五语言目标替换标题、确认、说明及附加内容拒绝覆盖通过。
- C0：12 个受影响 TS/TSX strict lint、renderer types、窄写集 diff check 通过。日志：`/tmp/lime-goal-composer-tests-20261020.log`、`/tmp/lime-goal-composer-inputbar-regression-20261020.log`、`/tmp/lime-goal-composer-lint-20261020.log`、`/tmp/lime-goal-composer-renderer-types-20261020.log`。浏览器数据库版本提示未引起失败，不修改依赖。
- 附件前置事实：`buildTurnInput` 的图片/typed mention lowering 产物是 Turn input；`threadGoalClient` 仅接受 objective/status/tokenBudget，不能把 Turn input 当作目标保存。下节已将目标专用物化接入 `thread/goal/set`；旧附件拒绝文案/测试一并迁移。独立 pathReferences 与 capability route 没有目标消费者证据，继续显式拒绝并留稿；内联 file/skill 引用沿同一文档 serializer 保留。
- 新线程目标已在本文开头 Home / threadless 纵切复用同一 draft/materializer，按 accepted 后保存目标；源码及定向验证完成，真实产品门禁交根任务。后继 gap 为 trusted durable origin/provider history/retained authorization；不将参考本地 `turnId:null/status:completed` 行拼入 canonical reader，也不为它制造可见历史。compact、异步问答均未在本切片接线；目标不是 auto 开启条件。
- 完成度：本轮限定的已有线程纯文本目标编辑/提交/清理切片实现与 C0/C1 为 100%；整体 GUI 和 Desktop Gate B 不在此分母。根任务统一构建、GUI smoke 与真实 Electron 同 identity 验收待执行；冻结后由根任务接续剩余 gap。

## 已有线程目标附件闭环（2026-10-20）

目标与写集：在同一主 Composer 保存图片、粘贴文本和超过 4000 Unicode codepoints 的目标；删除临时的文本限制。新增 `threadGoalAttachments.ts` / test 为唯一物化 owner；新增同 hook 目录 `threadGoalDraft.ts` / test 只投影同一 receipt 文档；修改目标 hook / test；新增 Electron `agentRoot.ts` / test、Main 两处 additionalArguments 机械接线、preload / test 和 `electron-host.ts` 只读类型；五语言 agentRuntime 目标文案；本计划。继续避让 InputbarCore、ComposerLayout、styles、protocol/generated、AppShell 和并行治理写集。不依赖已移除的知识库导入链。

Verification Contract：budget:normal，风险 P1。素材走 `Composer receipt -> 目标物化 owner -> typed fs/readFile/createDirectory/writeFile/remove -> 既有 App Server fs owner`；保存仍走 `thread/goal/set` 的 canonical 主链。Electron 仅传输 `resolveCurrentDesktopStorageRoots` 已解析的 agentRoot；override 原样保留，E2E 强制隔离根，不新增业务 IPC、不从 renderer 拼默认数据目录。Main 已超过 1000 行，本轮仅 import 和两处 webPreferences 元数据接线，所有解析/校验放到新 helper；该文件领域拆分由根任务另行治理，本切片不加业务逻辑。无重大架构/领域 owner 变化。

### 同摘要 REA 合同

继续复用 REA50 parent，不重复分析、不扩大 semantic coverage，`targetExecuted=false`。ASAR SHA-256 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。原件：primary SHA-256 `7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321`；initial SHA-256 `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`；shared SHA-256 `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245`。位置为 UTF16 code-unit 半开区间：

- shared 的 `w9t` 初始化 `[2750836,2752083)` 中压缩类 C9t，只拥有自己建立的 `<home>/attachments/<UUIDv4>` 目录；确认方法名 `createDirectory/write/remove/assertOwnedDirectory`，原类名 unknown。Lime 对应 `ThreadGoalAttachmentStore`，不将压缩名放入产品。
- initial `Y9n` `[2802899,2804961)`：先预读 pasted/image，懒建单一目录；固定 `pasted-text-N.txt`、`image-N.<ext>`；URL 不下载，图片编号保持原列表位置。`aer/oer/ser/cer` `[2806282,2807013)` 提供图片 bytes、扩展名、URL、分节合同。正文/贴文/图片全空才拒绝，允许仅附件。
- 正文与引用合并后最多 4000 个 Unicode codepoints，超过则写 `goal-objective.md`，保存原文案 `Read the Codex goal objective file at <path> before continuing.`；文件引用自身也受同一上限。准备失败和 API 保存失败清本次目录，保存成功保留。primary `Nft` `[1355943,1356575)` 外层 cleanup 明确由 API 成功移交所有权。
- primary `Fft` `[1356630,1357271)` 与 `Lft` `[1357321,1359400)`：目标文档从 promptRaw 准备，Plugin/App URI 链接降为 label；任意 paste/image 都使已有目标替换需要确认，取消前无物化副作用。label 解码经 primary shared import `fQ as cp` → shared `qVr`（UTF16 5269015），只还原反斜杠、方括号、圆括号转义。Put 的 promptRaw 来自 `controller.getText()`（primary 1278163 附近），initial `getText` 在 10303823 附近进入 `yJr` 文档 serializer。Lime paste 已在内存的 PM atom 内，由唯一文档删去 paste 节点后复用现有 serializer，并将原文单独物化；不伪造临时源文件或重复展开。源图始终保留。
- goal 布局：Qft 的 Tr 来自 pending objective，未加入 Uo 的 auto 条件。initial `chl` 从 UTF16 11184415 开始，`m = isAwaitingInput && !hasVisibleAttachments || !isGoalMode && (compact || shouldUseSingleLineComposer)`；听写与 composition lock 可覆盖。故目标模式通常多行，不能为了复刻给它新增 auto 入口。

### 实现、清理与验证口径

- current：目标附件在唯一 typed fs 网关读写；UUIDv4 ownership Set、固定根精确比对、文件名 basename/sanitize、失败 best-effort force+recursive cleanup。无 Main root 时需要文件的目标 fail closed；纯文本 ≤4000 和仅 HTTP(S) URL 无需根目录/文件副作用。支持 data URI base64/URI 正文、本地/file URI 与 Windows 路径。
- current：异步准备每次文件 await 前后校验 surface + coordinator generation/scope/draftId；合法持久化 scopeVersion 推进不算换草稿。保存后使用 receipt revision 与 coordinator 当前 CAS 清理；新 revision / 切换线程不清稿。成功 API 后观察者/CAS 异常仍保留已移交的附件，避免误删目标引用。
- deleted：五语言 `composer.textOnly` 及拒绝图片/paste 的过期正向测试。replacement 确认覆盖仅附件；新增 `unsupportedContext` 只用于尚无目标合同的独立文件托盘/能力路由；物化错误使用五语言 `materializeFailed` 并保留富草稿。无新增 compat/deprecated 包装。
- C1：主轮 6 文件 83/83 通过，label 精确解码后 draft+hook 2 文件 36/36 通过，长目标引用先验后写的顺序收敛后 materializer+hook+Inputbar 3 文件 54/54 通过；并集 **6 文件 84 项**。覆盖 Unicode 4000/4001、仅附件/URL、编号、编码/扩展名、预读顺序、部分写入失败、原错保留、owned/foreign 目录、Main override/E2E metadata、同一 typed fs 参数、取消/失败留稿、迟到线程/binding、合法持久版本推进与 coordinator CAS。
- C0：12 文件 strict lint 与后续 delta lint、Electron types、含 untracked 文件的窄写集 whitespace check 全通过。renderer 首轮通过，最终轮仅报并行 `workspace/right-surface/FileTree.tsx:149/206` 的联合类型收窄错误，本写集无报错；已交根任务/对应 owner，不越界修改。
- 日志：`/tmp/lime-goal-attachments-tests-final-20261020.log`、`/tmp/lime-goal-attachments-draft-hook-final-20261020.log`、`/tmp/lime-goal-attachments-materializer-hook-final-20261020.log`；lint、renderer/Electron types 同前缀 `*-final-20261020.log`。首轮固定 UUID 测试 stub 曾污染 coordinator 草稿身份，改为只固定首个 UUID 后全部回归通过，未为该测试恢复旧实现。
- 完成度：此窄写集实现/结构与 C1 100%；附件阶段曾有并行 renderer 阻塞，开头新线程纵切最终已复验通过。contracts/build/GUI smoke/真实 Electron Gate B 由根任务统一结算。本进程不构建、不宣称 Gate B/Windows 实机/live/packaged；未触碰 protocol/generated 和并行 InputbarCore/布局/AppShell。当前独立 file tray/capability goal mapping 与 trusted durable origin/provider history/retained authorization 不在此分母；新线程纵切见开头，canonical 可见编辑历史不是待造能力。
