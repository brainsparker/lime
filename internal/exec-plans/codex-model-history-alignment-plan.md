# Codex 模型历史对齐切片

状态：production-applied / regression-complete / product-partial（3/4）；归属主计划
C02/C03、L01/L02/H01；2026-10-19。负责人 root。

主目标是让 CLI/TUI/GUI 共享 Codex 的模型历史和 Loop 语义。Codex runtime 直接读
`/Users/coso/Documents/dev/rust/codex`；Desktop 使用已有安装包的 REA 静态证据。
grok 仅参考多模型 catalog、路由、能力和 readiness，不定义本切片的历史、Stop 或 harness。

## 当前阶段与前置条件

普通 final 原回归曾因并行 lowering 生产改动发生 SHA 漂移而停止。并行进程已自行
恢复原生产文件并删除 synthetic helper，保留完整 item/纯 delta 的正负向测试；没有
接管或覆盖对方文件。r3 已恢复，import 性能 2/2、工具确认 1/1 实际通过；两项公共
夹具校准通过 2/2 + 8/8。interrupted 八阶段 404/404 通过，fresh 产品链已终态。
GUI smoke 通过、真实 CLI empty final 2/2；stdio 原 5 秒超时保留，隔离 AppData 后
同 sidecar/原预算复验通过。Agent fixture 在工作台入口失败，后续聚合场景未执行；
普通 final/interrupted 仍为 3/4，不核销产品合同。
原失败和漂移日志保留，不改写旧结果。

本片 red 阶段从仓库 `.candidate` 应用两个独立公共 test/helper，冻结 92 项观测源码，
包括当时并行 lowering/helper，取得三个公共 red：**0/3**；该阶段未改生产文件或 final helper。
原候选和 manifest 保留。三个失败分别为 include 缺失、live 和 cold envelope 丢失；
都是完成请求后的行为断言，不是编译或超时失败。产品进程证据仍须单独核验。
三文件 review-only diff/manifest 已过时且未应用；接管协调已由外部修正解决，不再是阻塞。

本片已将现有
有序 ToolHistory/HistoryReceipt owner 直接泛化为模型历史。不得另建 append store、ACK、
runtime、compat alias 或第二套 provider 内容模型。

## Verification Contract

- current owner：`agent-runtime::model_history` 的有序记录与 receipt、App Server 同一
  EventLog/projection、`model-provider` 的协议 reducer/lowering；Thread/Turn/Item owner 不变。
- 输入：public `initialize`、`thread/start`、`turn/start`；loopback Responses provider 发出
  reasoning/message 的 added、delta、done 和 completed。假密钥与独立 app/workspace 路径，
  不调用 live provider，不改全局环境。
- 可见结果：每个普通 final 一次 sampling、一次 canonical Turn terminal；后续请求在新 user
  input 之前按原顺序包含完成的 reasoning/message，summary/content/encrypted_content 和
  message phase 不丢失，delta 与 terminal output 不造成重复；冷恢复不改写已提交 EventLog。
- identity：参考 `client.rs::prepare_response_items_for_request`，测试使用带前缀的 producer
  item ID；不能把 Codex 会移除的无前缀旧 ID 当作必须原样发回的 wire 合同。
- request：按 Codex `client.rs` 请求 `reasoning.encrypted_content`；不能由展示 delta
  伪造已完成的原生 reasoning item。
- 失败终态：真实 history owner 拒绝/丢失 receipt 时不得继续采样；未完成 item 不授权工具；
  不兼容的 opaque state 不跨 provider/协议泄漏。取消、错误、用量仍由原 owner 处理。
- 证据等级：准备的三个测试将验证 public App Server + current runtime + HTTP/SSE adapter；
  不证明 stdio、Electron、PTY、Windows 或 live provider。

## 写集与直接替换

公共 red 阶段写集为本计划、主计划导航、相邻 artifacts 与独立新增的
`app-server/tests/turn_reasoning_history_jsonrpc.rs` 及相邻 provider helper，不改普通 final
已冻结 helper。`context_history.rs` 的并行校准保持只读；GUI/Electron/命令迁移保持只读。

生产实施前，重新盘点并声明窄写集：直接迁移主计划审计中 21 个 Rust 消费者，删除旧
ToolHistory 命名/事件入口；类型、字段、事件与 replay/fork/compaction 消费者一起迁移。
保留现有真实持久化 receipt、工具原参数、输出截断预算和 duplicate suppression 合同。
生产改动应同步 `architecture.md`，由负责人确认 owner、依赖方向和架构图。

已核对并应用 **35 个既有文件、4 个独立 helper** 的候选，完整 diff、applypatch 和
逐文件 before/after SHA 保留于相邻 artifacts；8 个旧模块路径已删除。它泛化既有
记录/receipt、逐项替换对应展示 delta、保留 completed envelope 与 route 来源，并将
Responses ordered lowering 拆出。大 Turn 根只保留接线，新增历史构造逻辑放独立 helper；
lowering 根 759 行。root 已同步并确认 architecture 中原 owner 与依赖图，未改公开 RPC、
schema 或依赖。首轮 owner 已通过，独立公共/consumer 回归正在收尾。

已删除候选的整条路由严格拒绝策略。Codex 在兼容 hash 变化或
降到更小上下文且达到条件时，捕获旧模型 StepContext 压缩旧窗口，再由新模型接管
replacement；不是任意模型变化都压缩。Lime 的跨 provider/协议原生状态还需基于 current
route/capability 处理，不能把拒绝所有 native 历史切换作为多模型最终方案。当前候选
仅以 provider/endpoint/API version/protocol/credential scope 定义 opaque state 边界，
同服务切模型保留原 envelope；跨边界只在请求副本降为已完成 assistant 正文与公开 summary，
不发送原密文、原生 ID/phase 或私有 reasoning content，EventLog 原件不变。此协议转换可
辅助参考 opencode `session/message-v2.ts:245–283,362–377` 的异模型 metadata/正文处理，
不是 Codex 的压缩实现。旧模型原 route 压缩继续开放，不能用本次转换核销；grok 不定义
这里的历史或压缩语义。

生产写集收敛到 candidate manifest 中已冻结的 35 项源文件及 4 项新 helper；重新检查
全部 before SHA 和新目标不存在后才原位替换。root 负责原模型历史主链，避让 GUI、
Electron、CLI/TUI 及未认领的 context compaction operation。旧 ToolHistory 类型/模块/事件
直接改为 ModelHistory，不保留 alias 或双读；公开 JSON-RPC/schema 不变。

应用后补齐当前测试消费者：prefixed ID 夹具与 Responses Lite 完整 include 对象、compaction
boundary 新事件名、提取函数原有可见性；缺省 ID 复用已有 rand，不新增 uuid 依赖。
首次 provider 编译错误和 App Server ItemId 类型错误均已独立保留（执行测试 0 项）；
provider 首次实际 **288/289**，唯一失败为缺 include 的旧完整对象断言，原日志保留。
新增公共回归覆盖 fork、四种目标协议与 cold route switch，另有完成后失败/取消再冷恢复；
均使用真实 public JSON-RPC/current HTTP adapter 和 loopback provider，不算 live/产品进程。
首轮四个完整 owner 实际 **2597/2597**（245 + 1994 + 289 + 69）；公共历史 **6/8**，
原始三个 red 已转绿，fork、跨 Responses 路由及 Gemini 也通过。另两项在新写的 Chat/
Anthropic 夹具解析阶段失败，已按既有有效夹具补齐必填字段，原日志保留。
另补无 delta 完成项的定向 red **0/1**：真实 recorder 接受 completed item 后，错误仍
报告 emitted_any=false。已修 receipt 成功即计已输出；不改 provider failure 类型和重试预算。
resume runner 只重验 Agent Runtime 与剩余公共历史/失败边界、完成/receipt、压缩/fork、
server sampling/media consumer；原四 owner 结果保留为显式旧版本，不重跑无关 green。
每阶段前后核对 104 项冻结源码、明确声明的版本变化与旧路径不可恢复。

恢复链已通过 Agent Runtime **246/246**、公共历史 **8/8**。取消边界首次 **1/2**：
等待 public `item/completed` 在 gated terminal 前超时，原日志保留。直接复读 Codex
`stream_events_utils.rs:315–398` 与 Lime `output_lifecycle.rs`，确认早期完成通知仍为
独立开放差距；不得因为历史恢复 green 而核销。冷恢复用例改为在原 30 秒预算内等待
两个真实 EventLog 提交后取消，完整 envelope/顺序、禁止重采样、单 terminal 和 cold
断言不变，已通过 **2/2**。详见相邻 `boundary-fixture-correction.json`；不改生产代码。
r3 复用前两项 green，仅继续完成/receipt、压缩/fork 和两个 consumer 阶段。
完成/receipt **11/11** 已通过；压缩首轮 **31/35**，四项均失败在旧无前缀 ID 的请求
预期，含真实 stdio 共用 helper。已直接复读 Codex client 的请求副本清理规则，只迁移
两个既有测试文件的 wire 预期；原 EventLog、结构化/opaque 字段、生成 repair ID 和
截断断言保留。r4 只重跑四项及未运行的 fork/boundary、consumer；原失败日志与
明确 test-only revision 见相邻 `injection-fixture-correction.json`，不重跑 31 项独立 green。

完成 reasoning/phase 后再接 Stop 的同 Step snapshot/reporter、有序全部 block fragments、
可信 lifecycle source 与 durable user-role HookPrompt；随后推进同 Turn compaction 和
sampling stream retry。Memory extraction/lease/consolidation 继续主计划 M01，不以本片代替。

Item lifecycle 后续直接按 Codex `stream_events_utils.rs:270–398`：完成项可无 delta，
在 Response terminal 前发出 canonical completed；phase 为可空的 commentary / partial_answer /
final_answer。当前 Lime 两个公开阶段 enum 缺 partial_answer，TextEnd 仍由 response 收尾
推断；原生 envelope 已保存不代表这些展示语义完成。源码身份和最小行为合同见相邻
`item-lifecycle-source-audit.json`，公开 schema、生成客户端和所有 surface 消费者须同步核对并按需修改，
本轮冻结链不夹写这些 owner。

工具调度须在 stream retry 前独立核销：直接读 Codex `tools/parallel.rs` 确认
`handle_tool_call_with_source` 在返回 future 前已 spawn dispatch；仅看 FuturesOrdered
后置 drain 会误判为晚执行。Lime 目前仍在完整 stream 后执行 pending_calls，stream
错误也会绕过输出 drain。提前持久化 call 不是该合同的完成证据，须补 terminal 前的
受控执行、后续断流、取消及串并行/approval/CodeMode 行为测试。

## 多模型和多协议边界

Responses opaque history 只在 producer route/capability 允许时复用；现有非 Responses
拒绝 RawResponseItem 守卫必须保留。协议切换继续保留规范可表达的内容，并明确处理不能
复用的原生状态，不能把 encrypted reasoning 转成明文或发往另一 provider。

Anthropic signature、Gemini thought signature 另补各自完整 wire/cold 回归，不能由本片
Responses 通过推断已对齐。模型预算、认证和工具能力继续来自 Lime current route。

## 退出条件与验证

1. 公共行为 red 真实触达 current backend；分别记录 include、live、cold 的失败位置。
2. 现有 owner 原位泛化、21 个消费者直接迁移，无平行 store/alias/compat；架构确认。
3. 新行为转绿，原 tool history/receipt、四协议、fork、compaction、取消和错误回归通过。
4. fresh stdio、CLI 以及受影响 GUI fixture 按主计划实际执行，分级记录身份和终态。

前三项已核销，本切片 **3/4（75%）**；七阶段恢复链已通过 **314 项**，加上同一
生产源码下保留的 **31 项** 独立 compaction green，共覆盖 **345 项**。原四 owner
2597 项不重复累计；四个旧 ID 请求断言按上游合同迁移并定向转绿，原失败保留。
前后核对 106 项冻结源码和旧模块未恢复。fresh 产品链已终态，仍未满足第四项。原 red 运行
63.30s，前后 92 项观测源码无漂移。
live/cold 实际请求仅剩 reasoning content 和空 summary，encrypted_content 与带前缀的
原 item ID 丢失；message phase 和 item 相对顺序的断言在该失败之后尚未触达，不能推定。
三个测试均证明原 Turn 正常完成且没有额外采样；cold resume 不采样或改写原 EventLog。
移除并行 synthetic helper 只修正错误重建，仍须泛化现有 owner 才能恢复完整完成 envelope。
候选 manifest、上游 SHA 与 REA 补查见相邻 `source-audit.json` 和主计划 artifacts。

fresh 产品链由当前 renderer 与 sidecar 重建，固定 sidecar SHA 为
`a6dda55fab2fe66e66f9030717daa424018ca7fac74934003c04712213e116be`。
stdio 与 GUI smoke 通过；真实 `lime exec` + 独立进程 `exec resume` 已通过，
同 Thread 两次 sampling 的完整原生 envelope/顺序、单 terminal、累计/本轮 usage、
无密文 host 输出与 cold read 不采样均被断言。CLI 最初漏必填 capability，第二次把
CLI 的 Thread 累计 usage 错写为本轮值；直接核对当前协议与 Codex exec 源码后，
只修测试输入/预期并增加 JSON-RPC last 的精确断言，同一 binary 复验通过。
两次原失败及 before/after SHA 均保留，不改生产、预算或放宽字段断言。

Agent 聚合 fixture 仍在 Coding Workbench 的 `open-workbench` 失败，后续聚合场景
未执行；截图、backend ledger 与完整失败 summary 已独立归档。fallback 可误选含
“工作台”的 Thread 标题是静态代码与截图支持的候选原因，缺少实际 clicked identity，
不作已确认根因，也没有把 Sources 面板算成 Workbench 通过。该 fixture 的 external
backend 与一般 GUI smoke 不证明 Desktop 实际执行新原生历史；GUI/Electron/Workbench
并行写集保持只读。完整终态与边界见相邻 `product-recovery.json`；普通 final、
interrupted 和本片均保持 **3/4（75%）**，不得登记 release evidence 或总体完成。

分类：继续演进的 current owner 如上；无新增 compat/deprecated；8 个旧模块路径与
ToolHistory 类型/事件入口已 dead/deleted，冻结 runner 守卫旧路径不可恢复。
总体“完整对齐”保持 active，不以单切片百分比替代整体完成率。

模型历史之后的公开 phase/原生文本提前完成已进入独立
[执行计划](codex-message-phase-alignment-plan.md)。本片旧验证和 3/4 产品结果保留为其
当时版本证据；新源码、错误/取消、协议和产品结果在新切片单独登记，不重复累计。
