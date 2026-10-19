# Codex 消息 phase 合同对齐

状态：regression-complete / product-partial；2026-10-19；负责人 root。归属主计划 L01/C03，整体对齐保持 active。

主目标仍是 Codex CLI 与 Desktop 的共享后端语义。本片只收口消息 phase，不以它核销
无 delta 完成项展示、工具早期 dispatch、Stop、Memory 或插件。公共 red 发现多个原生
消息会因前一 Item 延迟完成而失败，因此同片补齐已有展示 delta 的原生消息提前完成。
grok 仅参考多模型机制，不定义 phase、Loop、Memory 或 harness。

## 事实与写集

- Codex HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`，直接读
  `codex-rs/protocol/src/models.rs:967` 和 `core/src/stream_events_utils.rs:270`：
  phase 可空，包含 commentary、partial_answer、final_answer；未知不能等同显式 final。
- Desktop REA 复用模型历史切片的 `desktop-source-followup.json` 和 Evidence
  `ev_4770091703f576bd5b38adcb3a86fb147be5272f0b7ae1416720daee77e14234`。
  它只证明选定 timeline asset 的 identity/parse，不证明完成时机或 phase 行为。
- current owner 为 `agent-protocol::response_item::MessagePhase`。删除 runtime 与 Agent
  两个重复枚举和转换分支；不加 alias、兼容包装、provider 专用 phase 或新 RPC。
- 认领 `agent-protocol/src/response_item.rs`、`agent-runtime/src/provider_turn.rs` 与
  `provider_turn/{output_lifecycle,model_history}.rs`、`agent/src/{protocol.rs,current_provider_turn.rs}`、
  `app-server/src/runtime_backend/event_mapper.rs` 及其直接测试、独立公共 JSON-RPC
  phase 测试、protocol schema/生成客户端和本计划。前轮模型历史写集只做必要接线。
- GUI、Electron、CLI/TUI 生产源码与其它并行热区只读；前端仅补独立 selector 回归。
  修改前冻结源文件 SHA，出现外部漂移即停止写入。既有大 provider/protocol 根只做
  枚举删除和最小接线，不继续堆叠业务逻辑；生命周期重构作为后续退出条件。

## Verification Contract

- 预算 `budget:normal`，P1。输入为真实 public JSON-RPC/current HTTP/SSE adapter 与
  显式 loopback provider、假密钥和独立临时数据目录，不调用 live provider。
- 主链：GUI/CLI/TUI -> 既有 App Server JSON-RPC -> RuntimeCore -> current provider
  executor -> EventLog -> canonical Thread/Turn/Item -> public notification/thread/read。
  Electron/preload、gateway、catalog method 集不变；没有新增 IPC。
- happy path：四种原生 phase（含缺省）按同一 Item identity 到达 item/completed，
  冷 thread/read 保留值和顺序；普通无 phase provider 不按工具有无伪造 phase。
  原生四个 Item/completed 全部到达后，夹具才放行 response.completed，证明真正的提前完成。
- 失败态：历史 receipt 失败不继续采样；phase 不改变 Turn terminal、工具执行、
  重试、取消或公开正文。空 phase 的最终文本选择沿用 Codex 的 unknown 处理。
- 必跑：独立公共行为 red/green、相关 Rust owner 定向回归、schema fixture 对比、
  generate/check protocol types、test:contracts、前端 phase selector 回归；主链改变后
  运行 Agent aggregate fixture 与 GUI smoke。fresh stdio/CLI 另取产品证据。
- 分级：in-process App Server + loopback 不冒充 stdio、Electron、PTY、Windows 或
  live provider；前轮 green 不计本片新源码验证。失败日志保留，不放宽行为断言。
- 架构影响：重大（共享生命周期完成边界），原 owner/依赖方向不变；architecture.md
  同步 phase 与提前完成合同。责任开发者 root，2026-10-19，已核对目录、数据流、
  依赖方向、协议、既有主链图和门禁，不据此宣布全范围完成或进入 release evidence。

## 退出条件与进度

1. [x] 公共行为 red：第一条原生消息未完成，第二条 message.delta 导致 Turn failed。
2. [x] 单一 enum、可空主链接线和旧重复类型删除；有 delta 的原生 message 提前完成。
3. [x] public live/cold、schema、consumer 和相关回归 green。
4. [ ] 分级产品证据、架构确认和剩余缺口回写。

当前 3/4（75%）。原生四 phase/提前完成、delta-only unknown 与完成后 provider
failure/cancellation 的 public live/cold 回归 **4/4**；相关 Rust 唯一用例覆盖 **1149/1149**，
前端 selector **8/8**。27 份 schema 的审计只包含新增 phase 值和说明；schema fixture、
生成客户端及 `npm run test:contracts` 已通过。契约首轮失败日志保留；并行改动已更新
三 phase 守卫，本进程未夹写该脚本，仅复跑 contracts，其余 Rust green 不重复计数。
fresh stdio、真实 CLI `exec`/独立进程 `resume` 及 GUI shell smoke **24/24** 已通过；
Agent aggregate 在 Workbench 入口失败，本片维持 **3/4（75%）**。
初次裸 cargo 被 V8 预编译包 404 阻塞、执行 0 项；改用现役 resolveRustyV8CargoEnv 后
实际取得 0/1 red（7.43s），原日志均保留。最终 regression 冻结 1172 项源文件与 schema，
contracts 复验前后无漂移。修正的三处旧 phase 预期只将推断值改为空，原 deadline、错误、
identity 与终态断言保留。后续按实际结果更新，不复用模型历史 75% 作为本片完成率。

## 分级产品结果

本轮 `product-summary.json` 已结束，run=`message-phase-1792417052284`，runner exit 1。
固定 App Server SHA 为 `4c7028c994661e9881a1fcabcad3f443e99b957523f3627e281d964e3db2f72a`；
1172 项冻结源码与二进制在产品阶段均无漂移。并行 renderer 更新由既有 freshness/build
入口重新构建；本进程没有修改 GUI/Electron/CLI/TUI 生产代码。

| 边界       | 实际结果与限制                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stdio      | `smoke:app-server-stdio` exit 0；真实 stdio 与 App Server JSON-RPC                                                                                                                                            |
| CLI        | 两个独立 `lime exec` / `exec resume` 进程通过；首次 native final_answer、续聊 delta-only unknown，单消息 identity、完成先于 Turn terminal、usage、原生 history 顺序和冷读均通过；loopback provider，不是 live |
| Agent 聚合 | 369 项 frontend/fixture guard 通过；unknown Item 恢复、首页首发、短问候三个 Desktop controlled fixture 通过；后端为显式 external fixture，不证明原生 phase provider 执行                                      |
| Workbench  | `open-workbench` 报“点击工作台后未出现工作台内容”；发送、Turn terminal 和历史读取已走到；后续聚合场景未执行。已归档失败摘要和截图，尚缺 clicked identity，不能认定根因                                        |
| GUI shell  | `verify:gui-smoke` **24/24**；真实 Electron/preload/IPC、42 次 current bridge、reload、settings 与三尺寸布局，无 legacy/mock fallback；不证明 provider Turn 或 native phase 展示                              |
| 未验证     | full verify:local、Desktop native phase、PTY、Windows、live 和发布包；本片未取得这些范围证据                                                                                                                  |

相关 evidence 在 `artifacts/codex-message-phase-20261019/`：regression/product summary、
CLI wire/cold、三个 controlled Desktop 摘要/截图、Workbench failure 与 GUI shell 摘要均保留。
current 为单一协议 phase 与既有 lifecycle/history/projection；两个重复 phase 枚举、Host
转换分支和旧解析 alias 为 deleted；没有新增 compat/deprecated。精确白名单已使本计划与
模型历史/完成快照计划可进入 Git 审阅，未执行暂存、提交或分支操作。

后续边界：Codex `session/turn.rs:2937` 的 OutputItemAdded 已通过
`event_mapping.rs:164–212` 保留 started phase 和 seeded content；Lime added reducer
仍只保留 identity/call 元数据。本片只证明 completed phase，不核销 started phase、完整
snapshot/无 delta、phase 对 mailbox/preemption 的调度或 plan-mode 特殊分支。
无 delta 与完成正文的权威快照进入[下一片计划](codex-output-snapshot-alignment-plan.md)；
独立 public target 与本片生产 freeze 分开，先取得未改生产的行为 red。
