# Codex rollout 模型上下文对齐

状态：实施中；负责人：root；日期：2026-10-21。

## 主目标与当前切片

完整复刻 Codex 的共享 runtime；本片补齐只复制 rollout 到全新 App Server 后的模型上下文恢复。
不依赖源数据库、EventLog 或界面 Items 反推 provider receipt；保留多模型、多协议。
总账见 [主计划](codex-runtime-gap-alignment-plan.md)，前片见 [fork 计划](codex-thread-fork-alignment.md)。

## 源码证据

上游 `/Users/coso/Documents/dev/rust/codex`，HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`：

- `codex-rs/history/src/lib.rs::RolloutItem` 保存 ResponseItem、Compacted、TurnContext、TokenUsageRecord 和 EventMsg。
- 同文件 `CompactedItem` 保存 replacement_history、window lineage、latest_token_usage_record 和 resume_metadata。
- `core/src/session/rollout_reconstruction.rs::reconstruct_history_from_rollout` 选择有效 checkpoint，恢复 replacement，再重放 suffix。
- `rollout/src/recorder.rs::record_canonical_items/persist/flush` 在同一 writer 中写入并确认；写入失败保留 pending items 供重试。
- `core/src/session/mod.rs` 安装重建历史前准备媒体；不回写或改变源 rollout。

CLI/runtime 使用完整源码，无反编译推断；本片没有新增 Desktop REA 行为结论。

## 写集与方案

current owner：`runtime/canonical_rollout/**`、`canonical_thread_store/{history,event_batch,rollout}.rs`、
`thread_fork/{source,hydration,history}.rs` 及必要根模块接线；公共 JSON-RPC fork/compaction 测试。
文档只追加本计划、主计划进度和架构说明；避让 GUI、Memory、Hook、插件和构建脚本。

原始 runtime records 与 canonical changes 放入同一 rollout history 批次，共用内容摘要、
序列校验和 fsync ACK；不增加 store、runtime 或旁路文件。
路径 fork 的历史来自指定 rollout，索引只覆盖当前模型设置；目标 durable fork 也必须保存完整 seed。
源记录的 producer identity 交给既有 provider lowering 决定可重放范围，禁止跨 provider 泄漏 opaque 数据。
过长根模块拆分；开发期直接替换不完整的旧 rollout schema，不增加迁移或双读路径。

## Verification Contract

- 预算：budget:normal；风险：P1，历史/压缩/多协议恢复。
- 主链：GUI/CLI/TUI -> `thread/fork`、`thread/resume`、`turn/start` -> RuntimeCore ->
  canonical ThreadStore/rollout -> provider history -> 当前 provider 请求；不新增 public method/schema。
- Happy path：完成源 Turn，只复制普通/zstd rollout，使用全新数据库和 agent root fork，
  同/跨 provider 继续，模型请求保留适用的 receipt、压缩 replacement/surviving suffix 和用量。
- 失败终态：缺字段、摘要不符、身份/序列冲突在文件读取或持久化边界报错，不创建可续聊的半成品目标。
- Evidence：公共 JSON-RPC integration + loopback HTTP request capture；受控 provider 不冒充 live。
- 必跑：fork/resume/compaction/midturn/control integration；rollout 摘要/幂等/repair 定向验证；
  `test:contracts`、`docs:boundary`、`governance:legacy-report`；Agent 聚合、GUI smoke 按主链质量规则补验。
- CLI/TUI/PTY、Windows、live 和 packaged 独立记录，未执行不能核销；不把本片计作全 Codex 完成。
- 不使用 LLM judge / Supervisor；失败回写公共回归和持久化负向测试。

## 退出条件

- [ ] 原生模型记录/checkpoint/usage 与 changes 原子落盘，并验证摘要、身份、顺序、幂等与崩溃尾部。
- [x] 脱离源存储的 plain/zstd，四协议同 provider 和跨 provider 请求捕获通过。
- [x] durable fork 的 cold/nested fork、session compaction suffix 和用量通过。
- [x] 单一 current schema、过期分支清理、根模块拆分和架构确认。
- [ ] 必需聚合/产品验证通过，明确证据边界并回写未验证事项。

## 实施记录

已接入 schema 3 history batch：canonical changes、runtime events、模型 receipt、checkpoint、
usage 和必要输入图片随同一记录落盘并校验摘要；ThreadStore commit 后才返回 ACK。
文件 fork 固定读取所选文件，cold resume 可从 rollout 重建，目标 fork 保存完整 seed。
旧 schema 1/2 reader、RawValue 顺序适配与 legacy-order 正向夹具已删除；旧 schema 明确拒绝。
根模块拆至 rollout 705 行、thread store 970 行、fork 743 行，没有新增平行 store/runtime。

验证过程必须保留的事实：

- 初次 Anthropic 签名断言使用了不同 loopback endpoint；后核对
  `model-provider/current_client/health.rs::history_producer`，它包含 endpoint/credential scope，
  因此该断言本身不成立，不能算有效 red。夹具已改为同路由复用同 endpoint。
- 中间构建在源码继续变化期间完成，21/24：图片脱离 sidecar 失败是有效缺口；
  checkpoint 使用非 UUIDv7 的 fixture 是测试错误；签名断言仍是前述路由错误。
  该产物不代表最终实现；完整日志保留为 `intermediate-integration.log`。
- 下一次构建发现 mailbox terminal recovery 的调用漏接媒体参数，已修正；该次 exit 101。
- 最终写集正在重新编译/验证；没有将历史或中间结果算作本片 fresh pass。
- 只读门禁：`docs:boundary`、`governance:legacy-report` exit 0；后者边界违规 0、分类漂移 0。

架构影响：major；架构图已更新：`internal/aiprompts/architecture.md` 的 portable rollout 小节。
责任开发者确认：root，2026-10-21；已核对目录归属、数据流、依赖方向、协议边界和验证门禁。

### r3 回归与签名缺口

r3 公共回归 exit 101：control 5/5、compaction 1/1、fork 22/27；Cargo 在 fork 失败后未执行其余 target。
失败定位：Anthropic SignatureDelta 被丢弃；Gemini 非工具 thoughtSignature 被丢弃，是有效实现缺口。
Responses 缺少 output_item.done、integrity 缺少显式 fixture model 是夹具错误；不降低签名断言。
本轮扩展窄写集到 model-provider/current_client/{stream,gemini,lowering,history,native_history}.rs
及 current_client.rs 必要接线、对应定向测试；避让 health、GUI、Memory、Hook、插件和构建脚本。
仍复用既有 ResponseItemDone -> model_history recorder -> rollout，不新增 store。

签名实现已接入既有 completed-item recorder；Gemini signed text/thought 分段身份与顺序均保留，
Anthropic 多段 signature_delta 合并。Responses 夹具新增真实 output_item.done，
四协议矩阵扩大为 4 个同协议与 12 个跨协议，每项覆盖 plain ephemeral、zstd durable cold resume
和源 Thread 的全新索引重建。provider owner current_client 测试 181/181 通过。
首轮 provider 回归发现 signature-only 分支错误截获 signed functionCall，已限制为无 functionCall 的 part；
完整原生工具生命周期回归随后通过。最终 integration r5 编译中，尚未核销公共恢复退出条件。

### r6 公共恢复结果

六个公共 JSON-RPC target 共 54/54 通过，含四协议 16 种组合、同路由原生签名与
Gemini signed text、跨路由签名清除、plain ephemeral/zstd durable、源线程新索引恢复、
运行中线程冷恢复后继续输入、session-only compaction replacement/suffix、用量与输入图片。
来源目录在续聊前已删除；测试不是 live provider 或 Desktop/CLI/PTY 证据。
Responses 的历史规则沿用 current completed-item-only 合同：不从展示 delta 合成新的 reasoning；
跨协议到 Responses 会忽略这种 reasoning，普通可见回答仍精确保留一次，持久化源 envelope 不变。
r5 扩展测试对此使用了错误预期，r6 新增所有协议可见回答与 Gemini signed text 捕获后通过；
未通过更改生产 lowering 来迎合测试。真实 stdio unavailable backend fail-closed 通过；
owner lib、Electron/GUI 与终端验证仍在途。

### r8–r12 终端与聚合验证

本片 40 个 Rust 文件与 5 个 Codex 事实源文件摘要均无漂移。终端 crate 2089 passed、
1 ignored；contracts、真实 stdio 和基础 GUI smoke 已通过，证据各自保留边界。
rollout owner r6 的唯一失败来自仍使用 schema 1 的语义损坏夹具，已换 current schema，
保留错误身份/摘要及不修改原文件的断言；r7 缺少 scoped 常量导入已修，r8 等待最终结果。

CLI Gate B r8 的实时输出、稳定 identity、冷恢复、usage 与真实 SIGINT 状态通过，
请求总数断言失败。r11 捕获证明第 2 个请求属于独立 Memory consolidation 线程，
不是用户 Turn 续跑。对照 Codex `memories/write/src/phase2.rs`：workspace 无变更且
摘要有效时跳过，否则可以启动独立 consolidation Agent。未修改并行 Memory 实现。
窄写集扩展到 `scripts/app-server/cli-interrupt-gate-b.mjs`：所有失败也保存不含鉴权头的
夹具请求体与阶段计数，按 canonical thread identity 严格断言用户请求恰好一次，
同时拒绝用户输入被转发到其他线程。保留总请求数与各线程 identity 供审阅。
在实际并行构建负载下，两次诊断的 20 秒超时分别发生在启动前、SIGINT 后；
该等待预算调为 60 秒，未放宽退出码、终态、进程回收或请求次数要求。
r12 的 JSON/human 中断子场景通过，完整 CLI 入口仍在执行。

本任务先前误启动了冗余 CLI build，TUI runner 也遗漏共享 target/profile 而重编；
确认父子 PID 和日志归属后仅取消这些本任务构建，保留取消结果，不计为产品失败或通过。
后续 TUI 必须复用本片 target/profile；不得终止未知进程或删除 Cargo/renderer 锁。
Agent 聚合 r8 的 31+34+3+303=371 个定向测试通过，随后 renderer 锁等待超时 exit 1，
尚未执行其 Electron 子场景，不能标记整个入口通过。`verify:local` 仍在途。

`verify:local` 已通过 i18n、lint 与 typecheck，并从已有前端账本第 46/144 批续跑。
随后并行的 presentation table format 场景出现 `registerHooks is not a function`：
当前 Node v23.4.0，而该夹具直接调用较新 Node 的 `node:module.registerHooks`；
另有 5 秒超时。该文件不属于本片写集，保留失败证据，不覆盖其并行修改。
同一时间根版本被并行更新为 1.165.0；本片固定终端产物为 1.164.0，
只对其清单与本片未漂移的 40 个 Rust 文件负责，不声明已验证最新混合工作树产物。

### 本轮结算（2026-10-21，partial / active）

- **已通过**：provider owner 181/181；6 个公共 JSON-RPC target 54/54；终端 crate
  2089 passed、1 ignored；contracts、docs boundary、legacy report、scripts governance；
  真实 stdio 与基础 Electron GUI smoke。各入口和边界见 artifacts 的
  `verification-summary.json`，批次有重叠时不累计为唯一测试总数。
- **CLI Gate B r14 exit 0**：JSON stream、真实 runtime SIGINT（JSON/human）、reasoning、
  五语言、resume/fork/review、图片、output schema、stdin/output file，以及三种真实
  Command shutdown。外部 controlled backend 与 runtime loopback 场景分别标记；
  无外层 TTY 的 human TTY 子场景明确跳过，不冒充 live/provider/platform 验证。
- **关闭夹具修正**：认领新增窄写集 `scripts/app-server/command-shutdown-fixture.mjs`。
  r12 失败请求记录证明 Memory 请求消耗全局 scripted index，导致 thread 0 执行
  thread 1 的工具；改为依用户输入与该 call 的回执选择回复，逐 canonical thread
  断言 shutdown 后没有续采样，未改 production Memory/runtime。三种定向 r13 均过，
  随后完整 CLI r14 通过。保留 r12 失败和 r13/r14 成功证据。
- **定向真实 PTY r15 exit 0**：固定 CLI/App Server、真实 PTY、一次键盘提交、可见最终
  回答、alternate-screen 进出、termios 标志位精确恢复和 cold Thread/Turn identity
  全部通过。使用 external controlled backend，只是基础 TUI Gate B 切片；
  完整 TUI 聚合入口未通过。临时 driver 与原始 transcript 作为 `.log` 归档。
  r14 driver 在 session 已脱离后读取 slave termios 导致 ENOTTY，改为保留的 master 后
  r15 通过；失败和修正分账，不记 production bug。
- **未通过/阻塞**：owner r8 在运行测试前因 rmeta 临时目录 ENOENT exit 101；随后观察到
  同名 target 目录和依赖产物被重新创建，未推断操作者。仅取消本任务 TUI 重编进程，
  未清理 target/锁或终止未知进程。renderer build receipt 为 invalid，未绕过 readiness，
  未执行新一轮 Electron fork。Agent 聚合 r8 在 371 项定向通过后 renderer 锁超时；
  `verify:local` 第 46 批 153 passed/11 failed（Node registerHooks 与超时），后续未执行。
- **最终摘要核验**：40 个本片 Rust 文件、6 个 Codex 源文件、7 个固定产物、2 个验证脚本
  全部与清单一致，见 `final-digest-verification.json`。固定产物 1.164.0，当前混合树
  1.165.0；不将前者写成后者完整候选验证。

退出条件 **3/5（60%）**，仅指本 portable rollout 切片。owner current-schema 负向回归和
聚合产品门禁未核销，完整 Codex 对齐继续 active。current 是共享 RuntimeCore / canonical
rollout / ThreadStore / provider completed-item history；无 compat/deprecated；本片 deleted
是 schema 1/2 reader、顺序兼容分支与旧正向夹具。旧插件不得恢复。

下一刀：在稳定且未被替换的 build target 重跑 owner 和完整 TUI；恢复有效 renderer/host
收据后补 Electron fork/Agent 聚合。随后依据 Codex `rollout/src/list_files.rs` 与
`compression` owner 补仅 `.jsonl.zst` 原线程自动发现、plain sibling 优先与可续写恢复，
目前只承诺显式 zstd fork/cold target 已通过。assistant media/collab/unknown extension、
其余 Memory/Tools/Extensions/harness、插件/tar.gz 与 LimeCore 真实闭环仍开放。

### compressed-only 原线程恢复（本轮实施中）

事实源：Codex `rollout/src/compression.rs::{RolloutFile::from_path,
materialize_rollout_for_append_blocking}`、`compression/path_metadata.rs`、
`list_files.rs::thread_candidate` 与 `compression_tests.rs`。plain 优先、压缩副本去重；
读取保持流式，追加先在同目录临时文件解压、刷盘、无覆盖发布，再清除压缩源。

窄写集：`canonical_rollout/{compression,read,history,delete}.rs`、根模块接线、
`canonical_rollout/tests/compression.rs`、公共 fork portable recovery 测试及本计划/架构小节。
ThreadStore 继续保存 plain 逻辑路径，无新 schema、store、兼容 reader 或 provider 分支。

Verification Contract：P1；在全新索引仅放 active/archived `.jsonl.zst`，通过现有
`thread/list/read/resume` 恢复原 identity；`turn/start` 保留历史且可冷启动续聊。
plain 与 compressed 并存只发现一次；损坏压缩/错误身份拒绝并保留源文件；
metadata、archive/unarchive/delete 使用同一物理文件 owner，删除后重建不得复活。
先 owner + 公共 JSON-RPC 定向回归，再补 contracts、current fixture、GUI smoke；
完整 TUI/renderer/全量门禁的既有阻塞继续分账，不将历史固定产物记为新实现验证。

- [ ] compressed-only 自动发现、逻辑路径及 plain 优先去重。
- [ ] 安全续写、metadata 与 active/archived 生命周期完整。
- [ ] owner 负向与公共 JSON-RPC 冷恢复回归通过。
