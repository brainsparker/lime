# Codex 推理完成快照对齐

状态：core-green / product-partial；2026-10-19；负责人 root；归属 L01/C03；整体 active。

## 目标和事实源

主对标为 `/Users/coso/Documents/dev/rust/codex` 的
`core/src/event_mapping.rs::parse_turn_item` 与
`core/src/stream_events_utils.rs::handle_output_item_done`。Codex 将完成 Reasoning 的
summary/content 作为完整数组投影为同 identity 的 TurnItem，忽略 encrypted_content；
没有先前 active Item 时补 started，随后 completed。源码 SHA 进入本片 source-audit。
Desktop 仅复用完成正文切片已检查的 REA 静态证据，不扩大为运行结论。grok 只参考多模型。

Lime 当前 `provider_turn/model_history.rs::complete` 已持久化原始 reasoning envelope，
但只为 Text 返回完成展示载体；ReasoningEventState.end 只结束 delta 累积。公开展示
不能从 raw history 旁路补造，而应在原 receipt 后沿共享事件链提交完成快照。

## 写集与 Verification Contract

- `budget:normal`；P1；root。先只认领本计划、独立公共测试
  `app-server/tests/turn_reasoning_snapshot_jsonrpc.rs` 和本片 artifacts。生产修改前重新
  核对摘要及窄写集，不覆盖上一片源码冻结结果、GUI/Electron/CLI/TUI 并行写集。
- 输入：public JSON-RPC、真实 RuntimeCore/current HTTP/SSE adapter、loopback Responses、
  fake key、真实 native output_item.done。模型 response terminal 由 Notify gate 阻塞。
- 用户结果：不依赖 delta 也能取得完整安全 reasoning；部分 summary/content 被同 identity
  完成数组替换；公开 completed 必须早于 response terminal，live/cold 一致、无重复 Item
  或额外采样。encrypted_content/producer 不进入公开展示。
- 失败边界：receipt 失败不发布；后续 failure/cancel 不撤销已完成 Item；重复 end 不发布。
  没有 native completed item 的其它协议维持实际 delta 合同，不伪造 Responses envelope。
- current owner：agent-runtime provider_turn → Agent protocol → App Server
  ReasoningEventState → canonical Thread/Turn/Item → thread-store。没有第二 runtime/store。
- 先取得公共 red，再改生产；完成后验证受影响 owner、public live/cold、文本/phase/history
  回归及 contracts；产品门禁逐项计数。前片 Workbench 夹具迁移阻塞单独保留。
- 共享完成边界变更同步 architecture.md，由 root 确认 owner/依赖方向，不作 release evidence。

## 退出条件

1. [x] 未改生产取得 gated public reasoning 行为 red。
2. [x] 既有 owner 应用完成快照，receipt/identity/安全字段和取消边界正确。
3. [x] 受影响 owner、public live/cold/失败/取消及文本/phase/history 回归通过。
4. [x] 架构确认、产品分级结果、治理分类和未验范围归档。

当前 **4/4（核心切片完成）**，产品验收为 partial。不替代 L01、Memory 或整体百分比。

## 执行记录

未改生产时公共测试编译成功，**0 passed / 2 failed**。无 delta 在 response terminal gate
仍关闭时等不到公开 completed；partial 用例收到旧 summary，未通过权威数组断言。
运行 62.16 秒，1185 项冻结文件前后无漂移；未触达的 live/cold 断言不计完成。
日志、summary、精确原测试见 `artifacts/codex-reasoning-snapshot-20261019/public-red*`。

实施窄写集见 `production-write-set.json`：仅既有 runtime output lifecycle/model history、
Agent 事件、App Server ReasoningEventState/mapper、typed/durable merge。原长 root
只加 enum/call 接线，解析和完成逻辑留在职责模块；无新 RPC/schema/依赖/第二 store。
超长 provider_turn root 的结构退出条件仍为沿 streaming/loop/tool 职责拆分，不继续增加
独立业务分支。本片完成载体与解析留在已有 model_history/output_lifecycle owner。
ReasoningCompleted 只携带安全文本数组，receipt 后才发布；原生 completed 后 adapter
ReasoningEnd 按相同 identity 抑制。runtime reasoning 字符数按 identity 以快照替换。

typed materializer 从完成事件和显式 summary/content 数组推导 reasoning_is_snapshot；
canonical 与 thread-store 消费该标记，使空数组也能清掉旧 summary/content。body-less
事件仍保留既有内容，标记不进入公开 v2 Reasoning。生产方案不能仅通过非空数组用例
核销，后续须补空/空白/失败/取消/receipt 回归。

首个 green 尝试等待共享 Cargo 锁 8 分钟，尚未编译/执行时由本进程取消，仅终止自己的
排队子进程；`public-green-initial-summary.json` 为 SIGTERM、tests=[]，不计失败行为或
green，不覆盖原 red，也未停止其它进程。随后注册独立 runtime/projection/thread-store
单元模块，并将公共用例扩至十项。追加的 ReasoningEventState 原不在文本切片冻结清单，
其修改前 SHA 已随写集保存，green 排队期间另存 supplemental source；最终验证冻结
**1190 项**，不把补充清单倒写成最初的 1185 项全覆盖。

`npm run test:contracts` 已通过，日志/SHA 见 contracts-initial-summary.json；之后仅改测试
注册/用例，无新增 public method/schema。六个现有 TS 投影/通知/恢复测试 **123/123**
通过，108 项源码前后无漂移（frontend-summary.json）；仅为只读单元回归，不是 Desktop
Gate B。独立 CLI reasoning fixture 已准备并语法通过，尚未执行，不计产品完成。

等待构建期间复核发现 canonical_item_from_event 的嵌套 typed Item 绕过普通载荷解析，
因此该分支也必须像 Message 一样自行推导 snapshot authority，拒绝缺失/旧 metadata
覆盖完成语义。追加一项 nested empty-array 回归，source revision/SHA 见
nested-snapshot-source-revision.json；r2 manifest/runner 已独立准备。初轮仍排队于
thread-store（它无 App Server 反向依赖），其终态后全局源码检查应拒绝旧 manifest，
不能把这次修正倒写成 initial 全程无漂移。完整受影响 owner/public 需按 r2 结算。

初轮实际终态：thread-store 编译失败，直接调用私有 merge_payload 的既有测试漏传新增
布尔参数，**0 项测试执行**；随后 runner 按预期拒绝上述两项 App Server 源码漂移。
补齐 false 参数，原 MCP 断言未变（test-call-correction.json），纳入 r2 独立 manifest
后重新启动完整 owner/public 回归。初轮日志未覆盖，不计行为 red 或 green。

2026-10-19 当前执行环境有其它 App Server 构建持有共享 Cargo 锁，本进程未停止它们、
未新建 target cache，也未放宽测试 timeout。当前未取得 Rust 修复后 green，不以静态
检查或前端/contract green 代替。current 为原 runtime/canonical/durable owner，
compat/deprecated/deleted 本片无新增；整体仍 active，完整产品/Windows/PTY/live 未验。

最终 r2b 回归已完成：thread-store 41、agent-runtime 250、lime-agent 290、runtime-backend
347、item-projection 73、canonical-message-lifecycle 10、public-snapshot 7、
public-reasoning-snapshot 10、public-phase 4、public-model-history 10，合计 **1042/1042**。
六个前端投影/通知/恢复测试文件 **123/123**，`npm run test:contracts`、rustfmt、diff-check
和 docs boundary 均通过；完整证据见 `artifacts/codex-reasoning-snapshot-20261019/
regression-final-summary.json`。两组真实 `lime exec`/`exec resume` reasoning fixture（no-delta、
partial）均通过，包含独立 stdio App Server、cold `thread/read` 和同一固定二进制 SHA，
证据见 `cli-no-delta/` 与 `cli-partial/`。

本片完成范围是共享 runtime、canonical/thread-store、public current HTTP/SSE 与 CLI
reasoning snapshot；REA 只提供 Desktop 静态 timeline 证据，不能据此声明 Desktop
reasoning Gate B。TUI PTY、Windows、live provider，以及完整 Plan/Stop/Memory/工具输出
drain、同 Turn compaction 仍未验证；Workbench 旧夹具失败继续单独记录。current owner
不新增 compat/deprecated；整体 Codex 对齐计划继续 active。
