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

- [x] 原生模型记录/checkpoint/usage 与 changes 原子落盘，并验证摘要、身份、顺序、幂等与崩溃尾部。
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
归档与恢复继续对照 Codex `thread-store/src/local/{archive_thread,unarchive_thread}.rs`：
直接移动实际物理文件并保留压缩形式；只有真实 history/metadata 写入才物化。

窄写集：`canonical_rollout/{compression,read,history,delete}.rs`、根模块接线、
`canonical_rollout/tests/compression.rs`、公共 fork portable recovery 测试及本计划/架构小节。
ThreadStore 继续保存 plain 逻辑路径，无新 schema、store、兼容 reader 或 provider 分支。

Verification Contract：P1；在全新索引仅放 active/archived `.jsonl.zst`，通过现有
`thread/list/read/resume` 恢复原 identity；`turn/start` 保留历史且可冷启动续聊。
plain 与 compressed 并存只发现一次；损坏压缩/错误身份拒绝并保留源文件；
metadata、archive/unarchive/delete 使用同一物理文件 owner，删除后重建不得复活。
先 owner + 公共 JSON-RPC 定向回归，再补 contracts、current fixture、GUI smoke；
完整 TUI/renderer/全量门禁的既有阻塞继续分账，不将历史固定产物记为新实现验证。

- [x] compressed-only 自动发现、逻辑路径及 plain 优先去重。
- [x] 安全续写、metadata 与 active/archived 物理表示及删除合同通过（mtime/recency 分账）。
- [x] owner 负向与公共 JSON-RPC 冷恢复回归通过。

实现已接线，r19 owner **19/19** 通过；公共 integration 正在执行，产品门禁未核销。
r16 使用全局 debug=0 与复制缓存不匹配，主动取消；r17
在 App Server 编译阶段遭遇明显内存压力，主动取消且未运行测试，不计产品失败/通过。
r19 固定隔离 target `/tmp/lime-rollout-compressed-target-20261021`，保留依赖默认 profile，
只对 app-server 设置 dev/test package debug=0，jobs=1；不清理共享 target、锁或未知进程。
最终写集及 8 个 Codex 源文件摘要见 `compressed-implementation-r19.json`。
contracts、docs boundary、legacy report r16 均 exit 0。
owner r19 经过 37m45s 编译后执行，19 个用例 0.65s 完成；本任务 rustc 的短时采样
证明 LLVM 代码生成阶段约 4GB 内存占用，未等待 Cargo 锁。采样日志已保留。
先前 current-schema 负向夹具的身份/摘要拒绝与源文件不变断言也已通过。

真实 CLI 驱动已准备：只复制标准压缩 rollout，删除整个源目录，两次全新索引恢复并续聊，
同一 canonical Thread 保留三轮输入/终态。使用本轮新二进制与 controlled external backend，
不替代四协议 request capture；尚未执行，不能提前核销 CLI 或完整 TUI/GUI 门禁。

只读补记：Codex `thread-store/src/local/unarchive_thread.rs` 在恢复后调用
`touch_modified_time`；Lime `canonical_thread_store.rs::set_archived_in_tx` 当前仅更新
archived/path，没有对应 recency/touch 提交。本轮只核销物理表示、历史、identity 与删除
合同；恢复排序/时间以及后台自动压缩 worker 另列开放项，不能据此宣称完整生命周期对齐。

#### 公共链回归与补齐（2026-10-21，r22 active）

r19 公共回归执行 compaction 1/1、fork 37 passed / 2 failed；Cargo 在 fork 失败后停止，
metadata/replay targets 尚未执行。两个失败分别是只读发现物化 plain、公共 Git metadata
未写 rollout，不能用 owner 19/19 代替跨层成功。r21 ThreadStore 是旧 libtest 的 47/48：
编译期间外部提交 `c323596f2` 已把队列的手工 sidecar locator 改成真实 PNG data URI，
旧二进制仍含前一版本夹具；当前夹具需重新构建验证，生产媒体完整性校验不变。

扩展窄写集：`canonical_thread_store.rs` 仅移出 metadata 方法并接线，新增
`canonical_thread_store/metadata.rs`。公共 metadata patch 使用既有 rollout metadata
writer，在同一 SQLite 事务提交前持久化，active/archived 共享路径与校验；index-only
字段仍由既有 owner 承接，没有新 schema、协议或兼容入口。上游补读
`thread-store/src/local/update_thread_metadata.rs::{update_thread_metadata,update_rollout_metadata}`。
压缩公共测试增加 rebuild/initialize/list 各阶段的只读断言，定位首次物化而不放宽要求。
上述行为尚在 r22 验证，尚未核销退出条件。

只读物化根因：`thread/start` 当前合法保存 `runtimeWorkspaceRoots: null`；settings
workspace 规范化删除该键后调用 durable metadata writer，触发不必要的压缩物化。
窄写集增加 `projection_store/session_settings/workspace.rs` 及其既有 tests，保留
current 的 null 默认值，并覆盖与显式 `[]` 的区别及 projected settings 恢复。
不删除必要的值校验或为旧格式新增 reader。r23 固定 16 项输入后顺序执行公共
compressed-only、完整相关 JSON-RPC、owner/ThreadStore/workspace tests 和本轮二进制构建。
压缩归档公共测试另验证损坏源的 metadata 更新拒绝、索引回滚和源文件不变，修复后重试
并以第二个空索引确认 Git patch 真正来自 portable rollout。

恢复时间补读结论：上游 `unarchive_thread` 的测试明确要求 `recency_at` 保持原值；
`state/src/runtime/threads.rs::mark_unarchived` 不推升 recency。开放差距是物理 rollout 的
mtime touch/失败回滚，不能把 `touch_modified_time` 猜成 recency 排序提升。之前的
“recency/touch”记录仅作为待核实问题保留，以此源码结论为准。

r22 定位到 rebuild 阶段物化；r23 的固定源码回归已证明该问题修复，归档/metadata
回滚/新索引恢复通过。剩余失败是续聊夹具重发固定 source Item ID，runtime 正确以跨
Turn identity 冲突返回 failed。修正续聊 backend 的 seed-only 分支，不改变生产身份
校验；r24 重新执行完整合同，保留 r22/r23 失败证据。r23 sourceDrift 为空。

r24 压缩公共切片 2/2、四个相关 public JSON-RPC targets **44/44** 通过，固定
16 项输入无漂移。它们包含四协议/跨 provider request capture、compaction、冷 resume
事件顺序、metadata 与损坏压缩回滚。owner/ThreadStore 最新夹具及本轮 CLI 构建继续验证。
contracts/docs/legacy r23 通过。Agent 聚合 r24 的 371 个定向测试与三个真实 Electron
子场景（unknown Item、home hotpath、greeting）通过；在 Coding Workbench 的新建独立
canonical/native 浏览器标签处 exit 1，后续子场景未执行。右侧 Browser/Recents 相关
文件存在并行改动，本片不夹写。已复制实际子场景摘要至同一 evidence 目录，保留失败。

后续后台压缩的源码合同已定位：`rollout/src/compression.rs::worker` 只选 mtime 超过
7 天的 cold 文件，zstd level 3、至多 2 个并行压缩；startup/RPC fire-and-forget，
maintenance lock + run marker 防重入。编码/校验不阻塞 writer，发布前锁定并重查
原文件状态，temp fsync + no-clobber publish 后才删除源。公共入口是上游
`app-server/src/request_processors/rollout.rs::rollout_compress`，只支持 LocalThreadStore。
本轮未新增该 worker 或 `rollout/compress`，不能将 compressed reader 的通过算作它们已实现。

r24 owner/ThreadStore/workspace **72/72** 通过，其中 ThreadStore 48 项完整通过，
包括新编译的真实 PNG 队列夹具；r21 旧二进制的 47/48 失败已由该 fresh 结果核销。
current schema 的身份/摘要、顺序/幂等、crash tail、元数据重试与 SQLite commit 失败
恢复均已验证。16 项实现输入仍无漂移。原 portable rollout 退出条件更新为 **4/5（80%）**；
未关闭的第 5 项是完整产品/聚合门禁，不能表述为整个 Codex 复刻完成。

#### r24 产品结果与 r26 生命周期切片

r24 CLI/App Server/code-mode-host 构建 exit 0（1.165.0），基础 GUI smoke exit 0。
真实 CLI compressed-only 冷恢复通过：两次仅复制 `.jsonl.zst` 到空索引并删除前一个
数据目录，最终保留同一 Thread、三轮 completed、三个输入各提交一次；只读 show 不物化。
该 fixture 使用 controlled external backend，不证明 live provider 或 TUI PTY。
16 项实现输入与 9 项上游源码摘要无漂移，完整汇总见
`artifacts/codex-rollout-context-20261021/compressed-verification-summary-r24.json`。
Agent 聚合的浏览器标签失败仍开放；原 portable rollout 切片保持 4/5（80%）。
上轮命令通道阻塞现已恢复；r25 blocker 文件已实际写入，本轮未覆盖其历史记录。

r26 主目标：按 Codex `thread-store/src/local/{unarchive_thread,helpers}.rs` 与
`state/src/runtime/threads.rs::mark_unarchived`，补物理 mtime touch、索引 updated_at、
recency 不变，以及文件移动/时间与 SQLite 失败回滚。归档保持原 mtime；compressed
物理表示不因 archive/unarchive 物化。metadata writer 必须区分文件时间与记录 revision，
保留身份、摘要和冲突校验，不能仅改 SQLite timestamp 而使后续 metadata 写入失败。

窄写集增加 `canonical_rollout/lifecycle.rs`、`canonical_thread_store/archive.rs`，从根模块
移入现有生命周期实现；定向测试分别落既有 tests 子目录。GUI/浏览器/发布并行写集只读。
不新增 public method、schema、迁移或兼容层，后台 compression worker 独立开放。

Verification Contract（P1）：plain 与 compressed 的归档/恢复均保持字节与压缩形式；
unarchive 后 updated_at 等于物理 mtime、recency 不变；冷索引读取同一时间事实，随后
metadata 更新与续写正常；touch、SQL update、deferred commit 失败恢复原路径和 mtime。
先 owner/ThreadStore/公共恢复测试，再按当前实现构建真实 CLI/stdio；产品聚合失败单独记账。

- [x] 生命周期文件/索引时间合同及失败回滚。
- [x] metadata 冲突校验与空索引恢复。
- [x] 定向回归和真实 CLI/stdio 证据。

r26 首次编译 exit 101：新增 fixture 的 `ThreadMetadataPatch.metadata` 少了一层
ClearableField 包装，尚未运行测试；已按现役类型修正，r27 重跑，失败日志保留。
额外覆盖 recency 为空时的默认排序事实：先将原 updated_at 回退值解析成 recency，
再投影文件 mtime，防止 archive/unarchive 或 cold rebuild 意外改变有效 recency。

r27 owner 为 71/76：默认 recency 在 metadata record 后被重新推导为新时间（有效缺口）；
plain 有效文件的 tail 检查不必要地要求写权限，导致 touch 失败夹具提前返回（有效缺口）；
另外三项旧断言仍固定归档前 updated_at。已将默认 recency 来源固定到初始 header，
有效 tail 使用只读句柄，只有真实修复才打开写句柄；迁移测试改为验证归档后的
updated_at 不被 metadata 规范化推进，完整恢复比较仍验证文件时间与所有历史内容。
扩展窄写集到 `canonical_rollout/{scan,tail_repair}.rs` 及既有 reviewer/workspace tests。
同时复用并行提交已加入的 `persist_rollout_metadata`，删除本片 metadata 模块内重复逻辑。
未改动该并行 helper 的实现。r28 固定新输入后重新验证。

提交失败的锁边界补充：Codex 在文件回滚期间仍持有 lifecycle/writer guard。
本片沿既有 SQLite writer coordination 保留失败的事务对象，在其写锁下完成文件回滚，
随后再由 Transaction Drop 回滚索引；不使用会在错误时先释放锁的 consuming commit。
该修正写入 r28 编译期间，因此 r28 sourceDrift 必须如实记录，最终输入另由 r29 验证。

r29 最终 owner **76/76**、sourceDrift 为空；public compaction 1/1，fork 38/39，失败后
其余 targets 未运行。公共 compressed archived fixture 定位到物理 mtime 与内容 revision
混用：原样恢复损坏压缩源的字节会改变 mtime，旧索引时间不再等于 record 或文件时间，
正常更新被错误拒绝。按 Codex metadata 更新与文件时间分离的边界，现由同一写事务核对
expected metadata 内容，以 scanner 校验后的 latest digest/record timestamp 推进摘要链；
物理 mtime 不充当内容版本。源身份、内容冲突、previous digest、record 单调时间、失败
重试与索引回滚断言保留。公共失败夹具不修改，r30 固定最终输入后重跑。

下一阶段源码审计归档到 `compression-worker-source-audit-r30.json`：startup 受
`local_thread_store_compression` gate 控制且上游默认 false；experimental RPC 的 `{}`
只确认触发，不确认压缩完成。maintenance lock 与 run marker 分工不同；成功后 marker
保留六小时冷却，worker 最长五小时，过期 temp 清理阈值六小时。发布锁需覆盖 detached
recorder 的 writer ownership，不得只检查当前活跃 Turn。后台 worker/public method 未实现。
另确认一项响应语义残差：Codex 对无 archived rollout 的 unarchive 返回 InvalidRequest，
Lime 当前保留幂等 archive/unarchive；本次时间/回滚切片不将该差异标为已对齐。

r30 编译期间隔离 target 目录整体消失，Cargo 写 fingerprint 返回 ENOENT；未运行测试，
本任务没有执行清理。现存仓库 `lime-rs/target` 缓存完整且无 Cargo 进程，r31 改用该
现役 target，仍 jobs=1、仅 app-server package debug=0，不删除目录/锁或停止未知进程。
收尾审阅补齐 recency 的 SQL 索引列接线：默认回退值不能只写 thread JSON；新增同一
列表中 peer 的排序断言，证明取消归档不提升有效 recency。r31 冻结全部最终输入。

r31 最终 owner/ThreadStore/workspace **76/76** 通过，冻结输入无漂移；包括默认 recency
的 SQL 排序、物理时间与 metadata revision 分离、readonly touch 和 deferred COMMIT
失败回滚。scoped rustfmt check exit 0。四个公共 JSON-RPC targets 和产品进程证据继续执行，
在它们实际结束前不核销本片最后的验证退出条件。

r31 四个恢复公共 targets **44/44**、补充线程公共 target **19/19** 通过；后者包含
archive/unarchive 的通知、环境恢复和原路径校验。CLI/App Server/code-mode-host
1.165.0 构建通过。最终重新核对 26 项实现与 13 项 Codex 输入，全部无漂移；
rustfmt、最终 docs boundary 和 scoped diff check 均 exit 0。
真实 CLI 生命周期通过：归档前后比较实际 mtime，保持 zstd 字节；取消归档更新时间
且返回有效、未改变的 recency；两次仅压缩文件的空索引恢复后，同一 Thread 三轮
completed、三个输入各一次，只读不物化、续写才物化。该进程链使用 controlled external
backend，不证明 live 模型或压缩专属 TUI PTY。基础 GUI smoke 通过，归档 Electron 与
Agent 聚合结果分账如下。时间/回滚切片退出条件 **3/3（100%）**，原 portable rollout
切片仍为 **4/5（80%）**，完整 Codex 对齐继续 active / partial。

r31 归档 Electron 聚合 exit 1：`run-electron-thread-read-long-list` 阶段的
`page.waitForFunction` 等待 240000ms 超时；后续设置页归档/恢复与冷重开场景未执行。
失败 summary 的 bridge false / 计数 0 是未采集默认值，不能推断实际未发生 IPC。
不放宽断言或扩大超时；下次用唯一 prefix 与 `--keep-temp` 保存 owner 的原始错误栈、
截图和滚动窗口证据后定位。GUI 相关并行写集保持只读，本片不声称设置页归档 Gate B 通过。
Agent 聚合已独立启动，前序失败不会阻止收取其独立结果。

r31 Agent 聚合 exit 0：**371 项定向测试（31 + 34 + 3 + 303）与 22 个真实 Electron
子场景全部通过**。包括 r24 失败的 Coding Workbench canonical/native 浏览器标签、
右侧面板恢复，以及取消/续聊、审批、steer、Plan/Skills/MCP/media 和文章产物场景。
本片未修改这些 GUI 实现，不据结果推断 r24 的具体修复原因。归档到同目录的
`lifecycle-agent-r31-scenes.json` 逐项记录输出 summary 的 SHA 与运行窗口，避免只引用
可被下一次覆盖的 `.lime/qc` 产物。controlled fixture 不提升为 live provider、Windows
或 packaged 证据。该通过不关闭独立归档长列表失败、完整 TUI 与 `verify:local` 的开放项。

本轮 current 为既有 canonical rollout/ThreadStore 与拆出的 lifecycle/archive 模块，
metadata 持久化复用现役 helper；无新增 compat/deprecated。重复 metadata 实现已移除，
旧 schema 和旧插件继续禁止恢复。源码、脚本、产品边界及最终验证汇总见
`artifacts/codex-rollout-context-20261021/lifecycle-verification-summary-r31.json`。
下一刀继续按已归档 Codex 源码补齐 unarchive InvalidRequest 响应语义与后台压缩的
真实 writer ownership/维护锁；归档 GUI 用保留 owner 证据的定向场景定位后再核销。
Memory/Loop/Tools/Extensions/harness、插件/tar.gz 与 LimeCore 的剩余范围不缩减。

#### r32 / 加速实施：恢复错误语义与后台压缩

主目标保持 Codex 共享后端完整复刻。本片一次实现而后集中验证：取消归档无归档源返回
InvalidRequest，删除 RuntimeCore 预读/changed 双判定；公共成功通知只在 mutation 成功后发出。
从 thread_v2_jsonrpc 根测试拆出 lifecycle/maintenance，避免继续堆叠超长测试文件。

压缩进入现役 canonical_rollout owner，新增 writer_lock、maintenance/compress；
启动 gate 为 experimental.local_thread_store_compression（默认 false），公共
rollout/compress 为 ACK-only，并同步 protocol/envelopes/catalog/schema/client/gateway。
上游事实源仍为 Codex HEAD 8c076942 的 rollout/{compression,writer_lock,maintenance}.rs
和 thread-store/local/unarchive_thread.rs，非 CLI 反编译或自拟产品合同。
Lime 当前每次同步写入都会关闭文件，没有上游持久 recorder actor；writer guard 覆盖
真实文件操作，RolloutMove 持 guard 至 SQLite 提交/文件回滚。不得只以 active Turn 过滤。
保留多模型/四协议路由，本片不修改 provider wire、内容、凭证或预算。

Verification Contract（P1）：无归档源拒绝且无通知/文件时间变化；冷文件压缩保持内容、
权限、mtime、同一 Thread；近期/忙碌/改变/已压缩文件跳过；编码/验证不持发布锁；
发布前 writer probe + 源状态复查 + fsync/no-clobber，冷读不物化、续写才物化；
维护锁防重入、成功 pass 保留六小时 marker、失败清理 marker、只清理六小时旧临时文件。
先 owner + public RPC + protocol/client/schema/contracts，再真实 stdio 验证受影响边界。
r31 聚合已有通过结果不重复冒充 r32 运行证据。Windows/live/packaged/PTY 仍单独开放。
写集避开 GUI/Browser/release 的并行热区；runtime.rs、envelopes 和 client 超长根文件仅做
模块/枚举/方法接线，新业务逻辑全部进入小模块，后续按领域继续拆分。

r33 源码补核：Codex message_processor.rs、v2/rollout_compress_tests.rs 要求
连接 initialize.capabilities.experimentalApi=true；rollout/compress 现在遵守该
connection-local opt-in，无声明返回 -32600 和上游同文错误，且不调度 worker。

r32/r33 最终结果：owner/ThreadStore/queue **84/84**；protocol/client/schema **198/198**；
公共 thread_v2_jsonrpc 最终 **23/23**（含 handshake、startup、非 local 拒绝、取消归档）；
TypeScript client/gateway **148/148**；test:contracts、docs boundary、scoped rustfmt/diff 均通过。
前端 r32 的两项 manifest 比较失败来自未先执行 package build 的旧 dist 缓存；
正常 build 后 r33 全部通过，保留两次日志，不修改断言。
r32 公共 22/22 是补 experimental gate 前的历史结果，最终以 r33 23/23 为准。

真实 sidecar 1.165.0 与 stdio 验证通过：独立 Python/flock 进程持有 thread writer 锁，
ACK 后压缩 pass 不发布/不删源；释放锁并使 cooldown marker 过期后重试，成功生成 zstd，
保持原 mtime；只读历史不物化，未归档取消归档返回上游 -32600；同一线程续写物化，
两轮均 completed。使用 controlled external backend，不声称 live provider 或 CLI/PTY。
script、binary SHA 和完整 JSONL frames 归档为 maintenance-stdio-r32.json /
rollout-maintenance-stdio-r33.driver.log。
基础 Electron GUI smoke r33 exit 0：真实 Host/sidecar 初始化、工作台 reload、
三个 viewport 和 Memory settings 通过；独立归档长列表 Gate B 失败仍未核销。
标准 GUI smoke 入口另建了桌面 sidecar 资源，未修改该并行构建 owner。

34 项实现最终输入无漂移；9 项 Codex 源码及 HEAD 另归档 maintenance-source-r33.json。
本片退出条件：错误语义、writer/worker、公共合同/默认 gate、定向/进程验证 **4/4（100%）**。
原 portable rollout 产品聚合条件仍 **4/5（80%）**，整体复刻 active / partial。
未重复 r31 已通过的 Agent 371 + 22 场景聚合；未跑完整 TUI/压缩 PTY、Windows、
live、packaged。verify:local 的已记录 Node registerHooks/超时基线仍开放，本片不以
定向测试代替其全量通过。

分类：current 为既有 App Server/canonical rollout/ThreadStore 及新增的小职责模块；
无新增 compat/deprecated；旧 unarchive 预读、changed 分支和幂等成功语义已删除。
Thread lifecycle 公共测试从超长根文件搬到子模块，保留唯一实现和唯一业务通道；
未新增插件旧路、迁移、第二 runtime 或模型特例。避让 GUI/Browser/release 并行写集。
本片收口后回到主计划 Memory/Loop/Tools/Extensions/harness 剩余项，不继续以存储维护
小切片代替整体交付；插件/tar.gz、LimeCore 和多模型边界仍按总账推进。
