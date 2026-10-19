# Codex 完成消息快照对齐

状态：core-green / product-blocked；2026-10-19；负责人 root；归属 L01/C03。整体对齐保持 active。

## 目标与来源

Codex `core/src/stream_events_utils.rs:315–393` 将 `output_item.done` 解析为完整
TurnItem，再发 started/completed；`event_mapping.rs:164–241` 从完成项提取正文、phase
和推理 summary/content。完整完成项是事实源，delta 不是唯一正文来源。grok 只参考多模型。
具体 SHA 与观测见上一片 `artifacts/codex-message-phase-20261019/next-lifecycle-source-audit.json`。
Desktop 仍只复用已注明边界的 REA 证据，不把源码分析写成 Desktop 运行观察。

Lime 已完成原生 message 的历史 receipt、phase 和提前完成；但返回展示链的完成载体只有
identity/phase。App Server 只结束已有 delta parser，无 delta 时没有公开正文，部分 delta
与完成项不一致时也未应用权威快照。必须在既有 owner 修正，不通过 raw history 补造 Item。

## 写集与 Verification Contract

- 准备阶段仅认领本计划与新 `app-server/tests/turn_output_snapshot_jsonrpc.rs`。
  不改上一片冻结源码，不覆盖 GUI/Electron/CLI/TUI 并行写集。
- 生产切片后续认领前再核对漂移：既有 provider_turn/output lifecycle、Agent 事件接线、
  App Server parser 与 canonical completion owner。根文件超过 1000 行的部分只做接线，
  新处理留在职责模块；不创建第二 runtime/store，不直接公开 encrypted_content/producer。
- `budget:normal`；P1。测试输入为 public JSON-RPC、真实 RuntimeCore/current HTTP/SSE
  adapter、loopback Responses 和假密钥；不访问 live provider。
- 用户结果：无 delta 完成项仍能显示完整正文；部分流式正文被同 identity 的完成正文替换，
  live/cold 一致，无重复 Item、额外采样或 terminal output array 重复回填。
- response terminal 由 gate 阻塞，必须先收到真实 completed Item；不能用 sleep 合成完成。
- 首片公共用例只覆盖文本；推理无 delta、started phase/seeded content、plan-mode 和
  后续错误/取消必须独立补证，不因文本用例通过而核销。
- 先取得真实 red，再改生产；随后 owner/公共回归、contracts 与 fresh 分级产品证据。
  in-process public fixture 不能代替 CLI、Electron、PTY、Windows 或 live。
- 生产实现涉及共享完成内容边界，实施时同步 architecture.md 并由责任开发者确认。

实施写集已核对：provider_turn 及其 model_history/output_lifecycle、Agent protocol/host、
App Server event mapper、proposed_plan_parser 及新 snapshot 子模块、canonical_message_lifecycle、
typed materializer/change_set 和直接测试。修改前冻结 1176 项；没有接管 GUI/Electron/CLI/TUI。
provider_turn 根只增加事件/调用接线，后续退出条件仍为按 streaming/loop/tool 职责拆分。
新 TextCompleted 是共享后端内部展示事件；App Server 消费后走既有 canonical Item，不新增
JSON-RPC method、schema/存储/依赖或第二 runtime。模型历史原件及 receipt 顺序保留。

完成正文也按同一 identity 更新 runtime reply 与 step 可见性/字符数，避免 Skill/harness
消费者继续取得旧的 delta 正文。canonical merge 的 text_is_snapshot 由 owner 从 lifecycle
事件类型与显式 text 字段推导，空字符串可覆盖；body-less completion 继续保留已有正文。
该标记只控制 typed materialization，不承载原始内容，也不进入 v2 AgentMessage。

2026-10-19 首轮公共 green 尝试暴露 durable owner 的第二处合并，追加窄写集
`thread-store/src/history_merge.rs` 和其独立 snapshot 测试模块；该文件修改前无脏改动。
materializer 已解析的权威正文必须由 durable builder 按同一标记保留，不能再次拼接。
不重建 store、不变更磁盘格式，不改 content_parts 合并合同。验证冻结扩为 1184 项，
详见 `source-verification.json`；生产和测试以各自冻结清单审计，不覆盖初轮证据。

## 退出条件

1. [x] 未改生产下取得公共行为 red。
2. [x] 完成快照由既有 owner 应用，无重复正文/Item，保持 history receipt 与取消边界。
3. [x] public live/cold、parser、既有 reasoning/plan 边界与受影响回归通过；完整 reasoning/plan 对齐另行补证。
4. [ ] 架构确认、分级产品结果及剩余缺口归档。

当前 3/4（75%），产品聚合未通过，结果见下文。最初在消息 phase 的 fresh 产品 runner 退出后执行独立 target：编译通过，
**0 passed / 2 failed**，不是构建故障，不计 green。1172 项既有源码在运行前后无漂移。

- 无 delta：response terminal 被 gate 阻塞期间没有公开 completed 正文，30 秒行为超时。
- 部分正文：公开 completed 仍为 `partial streamed text`，期待为 `authoritative completed answer`。
- 日志与 SHA：`artifacts/codex-output-snapshot-20261019/public-red{.log,-summary.json}`。

生产已按上文应用。首轮公共回归编译通过，**1 passed / 1 failed**：无 delta 完成消息通过；
部分正文的公开 completed 通知正确，但紧随其后的 `thread/read` 将旧正文与完成正文拼接。
失败精确位于 live read 断言，尚未进入该用例的 cold read，不能把这一失败写成恢复成功。
完整日志和 SHA 保留在 `public-green-initial{.log,-summary.json}`。当前已修复
`thread-store::history_merge` 的重复流式合并，新增 runtime reply/receipt、空正文/缺正文、
typed nested metadata、连续 delta 与 public failure/cancel 回归，随后执行新的 owner/public
回归；首轮失败没有通过放宽公开断言处理，最终结果见下文核心验证终态。

第二轮 owner 已通过 thread-store **40/40**、agent-runtime **248/248**、lime-agent
**290/290**、App Server runtime backend **347/347**。投影 **69/70**，失败为新增的
空白正文保真断言：generic `message_text` 提取丢弃纯空白字符串。窄写集再增加
`materializer/lowering.rs` 的 AgentMessage text 提取；该文件与初轮冻结 SHA 完全相同，
修改前工作树 clean。显式 string text 直接保留，包括空串和空白；其它类型/字段仍走原
提取。原测试没有更改；`lowering-correction.json` 和 `source-verification-initial.json`
保留修复前证据。随后按新源码重跑 backend/projection/canonical/public/contracts；
仅复用不依赖 App Server lowering 的三个上游 owner green，不重复累计同一用例。

架构图已同步，root 确认共享完成正文沿原 runtime、canonical 与 durable owner 流转。
产品验收尚未完成；reasoning snapshot、started phase/seeded content、完整 plan-mode
（含未闭合 plan）继续开放，不因本片文本通过而核销。current 为既有共享 owner；
本片没有 compat/deprecated 或删除项。

## 核心验证终态

`regression-final-summary.json` 汇总 **1026/1026** 个 Rust 唯一用例：thread-store 40、
agent-runtime 248、lime-agent 290、runtime backend 347、typed projection 70、canonical
message lifecycle 10、public snapshot 7、public phase 4、public model history 10。
重跑的 backend 347 不重复累计；三个上游 owner 复用的是本片 initial run 的 green，
不是上一片 1149 的结果。仅 App Server lowering 的修正无反向依赖影响，SHA 差异已核对。

七项 snapshot 公共用例均证明 gated response terminal 之前完成公开 Item；无/部分 delta、
空串/空白、后续 provider failure/cancel 的 completed/live/cold 一致，identity 唯一、
无额外采样。phase、模型历史顺序/route switch/fork/冷恢复均通过，不能由此核销完整
reasoning snapshot 或非 Responses 原生签名。

`frontend-projection-summary.json`：既有五个通知/顺序门控/reducer/replay 测试文件
**78/78**；108 项相关 TS source/test 前后无漂移，仅为只读单元回归，不是 Desktop Gate B。
`npm run test:contracts` 通过；本片没有 public method/schema/dependency 变更。
原始 red 测试已保存为 `public-red-test.rs`，与 pre-implementation SHA 逐字节匹配。
source audit 的四份 Codex 文件与 HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`
一致；Desktop REA 的证据边界保持不变。

## 产品验证与独立复核

fresh renderer、Electron typecheck/build、App Server 构建及版本检查通过。
`product-summary.json` 的五阶段均已终态，runner exit 1；固定 sidecar SHA
`3bd706cd889f1349d669452effe3914a6e75ac25598d661639068a58cfe73c1a`。

- stdio 初次 5 秒等待超时，原日志不覆盖。相同固定 binary、原脚本、相同预算的独立复跑
  exit 0，证明 initialize 和 unavailable thread/start fail-closed 可通过；源码和 binary
  前后摘要一致。见 `stdio-retry-r1-summary.json`。首次失败没有 stack，不能判定具体阶段或
  宣称根因已修复。源码复核发现 AppServerConnection constructor 不启动 read pump，
  排除仅靠构造实例就产生双 reader 的猜测。
- 真实 CLI **2/2**：无 delta 和 partial 两组 `lime exec` 加独立 `exec resume`，检查权威正文、
  phase、usage、native history 顺序与 cold read。证据在 `cli-no-delta/`、`cli-partial/`；
  不代表 TUI PTY、Windows、非 Responses 原生完成或 live。
- Agent 聚合：定向 **369 passed / 61 skipped**，unknown-item、home-hotpath、greeting 三项
  controlled Electron 场景通过；Coding Workbench 在 open-workbench 失败，后续聚合未执行。
  原 summary/截图及精确父 stage 关联已归档，不依赖可覆盖的 `.lime/qc`。
- GUI shell smoke **24/24**，真实 Electron/preload、57 次 App Server IPC、current methods、
  重载/设置/三尺寸布局通过，console/page/invoke/crash/legacy/mock fallback 均为 0。
  `desktop-0-summary.json` 仅证明 shell Gate B-F，不能证明 native snapshot GUI 展示。

Workbench 诊断副本保留原选择器、点击、180 秒预算和全部断言，仅打印所选元素。
`workbench-diagnostic.log` 直接记录误点的是会话标题按钮（text 为“代码产物工作台 Electron
fixture”，无 data-testid/aria-label），因此此前截图中的标题编辑态已有直接目标证据。
current UI 已迁入 ThreadSidePanelLauncher/WorkspaceRightSurfaceHost 与 timeline artifact
入口；修复不能只把旧 toggle 替换为侧面板按钮，再把“面板已展开”算成产物/文件验收。
原 fixture 与 GUI 生产文件本轮保持只读；完整 current 路径夹具迁移仍是产品门禁阻塞。

REA CLI 复核已有 timeline 证据：`rea-timeline-summary.json`，新 view
`ev_b212d26b5571deaba6f011086e90ef84b98d4239d755e3dac731e8e23c629300`，parent
`ev_d6c035921bbb148358056a3c5cc17f583a20225bfdead1f8459b5403258be4a1`；3 个 JS
asset、0 parse failure，semantic 仍 partial/unknown。这是已保存静态证据的视图，不能
扩成完成快照或工作台的 Desktop 运行结论。MCP 当前缺 registration，本轮直接用已安装
REA CLI，无配置写入。grok 没有参与本片完成语义。

current：共享 runtime/canonical/durable 完成 owner；compat/deprecated/deleted 无新增。
全仓 verify:local、PTY、Windows、live 与安装包未验；本片定向/contract/fresh 产品证据不能
替代它们。完成度维持 **3/4（75%）**，整体 active，分母未冻结不报整体百分比。

## 下一片移交（已取得行为 red，生产接线待验）

Codex `event_mapping.rs::parse_turn_item` 对 completed Reasoning 直接使用完整
summary/content 数组，忽略 encrypted 内容。修正前 Lime `provider_turn/model_history.rs::complete`
仅对 Text 返回完成载体；`runtime_backend/reasoning_events.rs::end` 只结束从 delta 累积的
状态，`started=false` 时不发布任何事件。因而下一片要验证无 delta 的 safe reasoning
正文，以及部分 summary/content 被完整完成项替换的公开通知、live/cold 与取消边界。
定位时这些只是源码观察；模型历史里的原生 reasoning 已通过上一片验证，
不等于其公开投影已经对齐。

后续[推理快照计划](codex-reasoning-snapshot-alignment-plan.md) 已从独立 gated public
JSON-RPC fixture 取得 **0/2 行为 red**，并在原 owner 接线；owner/public 验证另行结算。
继续走原 runtime/Agent/
ReasoningEventState/canonical/durable owner；不得从 raw history 侧补造公开 Item，
不得展示 encrypted_content 或 producer。无 native complete 的协议保留实际 delta
生命周期，不为 Anthropic/Gemini/Chat 伪造 Responses 事件。grok 不参与此语义定义。
