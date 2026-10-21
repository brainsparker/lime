# Codex thread/fork 实现对齐

> 状态：active / partial；2026-10-21。属于 `codex-runtime-gap-alignment-plan.md` 的恢复主链切片，不代表完整 Codex 复刻完成。

## 目标和事实源

CLI/TUI/GUI 共用 `thread/fork -> RuntimeCore -> canonical Thread/Turn/Item`。直接读取 Codex
`codex-rs/app-server/src/request_processors/thread_processor.rs::{thread_fork_inner,read_stored_thread_for_resume}`、
`codex-rs/thread-store/src/local/read_thread.rs::{read_thread_by_rollout_path,resolve_requested_rollout_path}`。
Desktop 沿用主计划的 REA 安装包证据，本片无新增 Desktop 行为结论。grok 不裁决 fork 语义。

## Verification Contract

- 负责人 root；`budget:tight`；风险 P1。
- 写集：`app-server/runtime/thread_fork*`、`runtime/ephemeral.rs`、`runtime/input_media.rs`、
  `runtime/canonical_rollout*`、`runtime/canonical_thread_store*`、公共 `tests/thread_fork_jsonrpc*`；
  `turn_execution.rs` 仅补来源查询的 loaded ephemeral 分支；
  `thread_usage.rs` 及拆出的 `thread_usage/tests.rs` 修复未知 context window 时的完整计数恢复；
  `session_operations.rs` 仅 re-export 现有 patch helper，`session_operations/settings.rs` 仅调整
  helper 可见性，让 fork 复用模型绑定设置 owner；计划、限定 `.gitignore` 例外和架构记录。
  保护既有 GUI、Memory、Hook、插件与外部仓库改动。
- Current 主链：现有 JSON-RPC handler -> RuntimeCore fork -> 同一 session/event/history owner；
  durable 写同一 projection/rollout，ephemeral 只保留内存历史；无新 Host 命令、runtime 或 store。
- 输入：持久源 threadId 或 rollout path、turn boundary、ephemeral、excludeTurns、模型/provider override。
- 可见结果：返回原 Turn/Item identity 的分支；临时分支可继续执行，metadata-only read 保留来源；
  不出现在持久列表，不生成目标 rollout/event log/sidecar，重启后不可恢复。
- 失败终态：非法参数、归档源、不存在/目录/非法 rollout、分页临时分支加载 turns 均为 InvalidRequest；
  不创建半成品。媒体读取失败明确报错，不丢失图片。
- 验证：Rust owner unit + 公共 JSON-RPC integration（测试 backend，仅替代 provider 执行层）；
  `test:contracts`、current fixture、GUI smoke 按质量门禁补充。无 live provider、Desktop Gate B、
  CLI/TUI PTY 或发布包完成声明。既有 JSON-RPC 方法未改 schema。
- 架构影响：非重大，复用现有 owner；历史组装复用 `thread-store::ThreadHistoryBuilder`，
  rollout 读取复用既有 schema/digest 校验，不建立另一套历史事实源。架构说明同步更新。

## 待闭合项

- [x] 临时 fork response 的 turns 包含完整 items，而非仅 turn 壳。
- [x] metadata-only read 保留 forkedFromId；归档源和分页 ephemeral 约束。
- [x] path 优先于 threadId，实际校验文件；相对/绝对/外部有效 rollout 与非法路径回归。
- [x] indexed 源的 canonical user 图片与 seed 使用同一来源；其权威 model history/compaction lineage 保留，无临时目标磁盘产物。
- [x] 公共续聊、excludeTurns、多模型 override、cold recovery 拒绝和 durable 回归。
- [x] 普通 fork 不继承当前 Plan 模式；显式模型/provider 覆盖和模型绑定设置清理在 cold resume 后仍有效。
- [x] 记录验证终态与未验证边界；整体计划维持 active。

## 已有验证

- `npm run test:rust:unit -- -p app-server thread_fork`：7/7（加入后续路径回归前）。
- `npm run test:rust:unit -- -p app-server rollout_path_lookup`：1/1。
- 原生 Cargo 因 Rusty V8 artifact 默认下载地址 404 无法构建；使用仓库 runner 的 artifact 环境。
  这些旧结果不充当后续修改的验证。

## 本轮实现与验证进度

- 当前实现已补齐归档/分页 ephemeral 约束、metadata-only 来源、执行请求 fork/root 身份、
  返回历史 Items、图片内联、无目标持久化分流和路径实际读取。新增逻辑拆入 source/media、
  rollout/read、store/rollout 与 store/session；公共测试 backend 从超长根测试文件迁出，
  原有四项持久分支场景迁入 durable 子模块，根集成文件从 1086 行降至 358 行，新场景单独成模块。
  既有超长 store 根文件不再增加业务处理；后续退出条件是按领域继续迁出，
  不以允许少量接线为继续堆叠许可。
- `ModelHistoryRecord` 当前 user schema 仅允许文本，图片由 canonical UserMessage 持有；
  删除实现过程中暂加的不可达图片 model-record 分支，不扩展 schema 猜测能力。
- 源码 HEAD 与文件 SHA 见 `artifacts/codex-thread-fork-20261021/source-evidence.json`，
  涵盖 handler、store reader、fork 测试与压缩 reader，均核对 HEAD。安装包 REA 证据继续复用主计划，没有新增静态/运行覆盖声明。
- `npm run test:contracts` exit 0；`npm run docs:boundary` exit 0。
- 共享 `lime-rs/target` 的 unit/integration 两次因 fingerprint 目录写入 ENOENT 而 exit 101；
  不计业务验证。改为 `/tmp/lime-thread-fork-target-20261021` 独立 target、debug=0、
  incremental=0，沿仓库 `resolveRustyV8CargoEnv` 配置重编译。
- 在途：指定 `--test thread_fork_jsonrpc` 的真实 JSON-RPC integration、四协议 HTTP capture
  及 Chat→Anthropic 模型/provider 切换；仅 loopback fixture，无 live provider。
  日志 `/tmp/lime-thread-fork-isolated.log`。未有终态之前不得勾选完成。
- 继续直接读取 Codex `rollout/src/{compression,seekable_reader}.rs`：普通文件优先、
  `.jsonl.zst` sibling 与显式压缩路径复用同一流式 record/digest scanner，保留已打开文件，
  解析期间不展开写盘。新增公共压缩/损坏压缩回归；仓库已有 zstd 依赖，无 manifest 改动。
- 开放范围：standalone rollout 缺失的权威 model receipt、session checkpoint/媒体来源，
  完整非文本 assistant/collab 历史复刻仍需上游对照，不能宣称完整 fork 对齐。
- 首轮新公共 integration 为 6/16：4 项 fixture 缺少显式模型选择，1 项 ItemsView 未置 Full，
  5 项四协议 wire 因未知 context window 丢弃完整 token usage。前两类已修；usage 对照 Codex
  `app-server-protocol/src/protocol/v2/thread.rs::ThreadTokenUsage` 的 `Option<i64>` 修复，
  未知窗口保留 None，不推定固定容量，完整性/非负计数校验不变。owner 测试迁出至子模块，
  避免 881 行实现文件继续膨胀。首次 owner unit 因本轮 helper 缺失编译失败，已恢复，待重跑。
- 第二轮公共 integration 为 15/16：四协议 wire（Chat/Responses/Anthropic/Gemini）及
  Chat→Anthropic 切换全部通过。新增旧 rollout 副本模型切换场景 red：实际 fixture-model，
  预期 updated-model。直接对照 Codex `local/read_thread.rs::read_thread_by_rollout_path` 的
  SQLite model/reasoning overlay 后补齐；Lime 将 provider route、model-bound collaboration/
  effort/service-tier 设置保持一致，不能在当前 provider 下重放过期模型。standalone 无索引副本
  继续使用文件自身模型。修复后公共测试与 owner/冷恢复回归在途。
- `smoke:agent-runtime-current-fixture` exit 1：unknown Item Electron 场景所有业务断言通过，
  但 Main 正常退出超时，失败回收使用 SIGKILL，不能记 Gate B 通过；后续聚合场景未执行。
  受控 external backend，无 live provider。失败摘要与原日志已归档到本片 artifacts。
- `.gitignore` 增加本计划及限定 evidence 文件的例外，避免新记录只保留在忽略目录中。
- 最终公共回归：fork 16/16、JSONL 冷恢复与用量/Goal 顺序 2/2、compaction replacement +
  surviving tail 冷恢复 1/1、执行中 fork + interrupted marker 1/1，合计 20/20。
  测试拆分曾挂错 path attribute，导致入口编译失败；已纠正并由上述 20 项最终回归覆盖，
  不将中间编译失败算通过。owner unit 继续在独立 target 验证。
- `npm run verify:gui-smoke` exit 0，真实 Electron 壳层 24/24；它没有执行 fork/模型 Turn，
  不替代 fork Gate B。`smoke:thread-fork-electron-gate-b` 在共享构建锁处等待；实查锁由活跃
  GUI 进程 11973 持有。本进程只停止自己的等待任务，未删除锁或干扰对方，产品场景未启动，
  此项记录 blocked / not-executed，不计失败产品行为或 Gate B 通过。

## 继续实施：fork 配置与历史配置分离

- 直接核对上游 `core/src/session/mod.rs:860`：只有 `InitialHistory::Resumed` 恢复保存的
  collaboration mode；`Forked` 从 Default mode 开始。`thread_manager.rs::fork_thread_with_initial_history`
  把 fork 历史送入同一 session；previous turn settings 属于 reference/history，不是当前模式。
- 新公共 JSON-RPC 回归已实际 red：源线程设置 Plan 后 fork 续聊仍为 Plan。原逻辑还会让旧
  collaboration mode 的 model 覆盖显式 fork model。修复删除 fork 的当前 `collaborationMode`，
  并复用 `session_operations::apply_thread_settings_patch` 处理模型/provider/tier 覆盖；
  模型 identity 变更时不保留旧 effort、tier 和 agent route，不建立第二套模型切换规则。
- 新回归覆盖继承、同模型、换模型、只换 provider、显式 tier 与清空 tier，分别执行
  ephemeral/durable；durable 再 cold resume，源 Plan 保持不变。四协议 wire 场景也改为从
  Plan 源发起，验证实际选中的目标模型/provider。这里仍是受控 loopback provider。
- 最终 owner `--lib thread_fork` 编译在内存严重换页下超过 20 分钟仍无终态；仅中断本轮
  Cargo PID 94800，runner exit 1，后续 lib suites 未执行。不能将早期 7/7 用作本轮 fresh unit
  通过；保留日志并改用更贴 public boundary 的 integration 覆盖。新一轮 integration 在途。
- 首次阻塞的 Electron fixture lock 已释放，重试 fork Gate B；本次进入 renderer build 后等待
  另一活跃 renderer build lock，未删除共享锁或停止其他进程。终态待收取。

## 本轮最终结果（取代前面的在途状态）

- 公共 JSON-RPC 回归 **26/26**：fork 17、resume replay 2、compaction 1、midturn 1、thread control 5；
  新 Plan/default-mode 回归实际 red 后 green，含 12 次 ephemeral/durable fork 与 6 次 cold 续聊。
  四协议 wire 也从 Plan 源发起，Chat→Anthropic 目标路由正确。均为隔离本地 fixture，无 live provider。
- `test:contracts`、`docs:boundary` 和定向 diff 检查 exit 0；既有治理报告 exit 0。
  没有新增 public schema/Host 命令、compat 或 deprecated；模型/provider/tier 的重复 patch 逻辑
  已从 fork 删除，直接复用 current 设置 owner。
- 真实 Electron fork Gate B **r4 exit 0**：菜单操作、父/子 identity、`forkedFromId`、read/resume、
  侧栏激活、成功提示、可编辑草稿均通过，preload/IPC 命中 `app_server_handle_json_lines`，
  mock fallback 0，Main 正常退出 0，无强制回收。它使用 unavailable backend，未执行 Turn，
  不替代模型续聊、CLI/TUI 或 live provider 验收。
- r2 因默认脚本会接受已有 App Server binary 而停止；停止前 renderer 锁刚释放并已开始本轮
  构建，实际记录为 interrupted-before-product-launch。只清理了停止后确认 PID 35571 不存在的
  本轮 renderer lock。r3 的 asset preparer 会丢弃 `APP_SERVER_BIN` 强制构建，误选共享 target；
  只停止本轮 Cargo 71834。r4 改用同一隔离 target、profile 和 Rusty V8 环境，保留全部中间日志。
- r4 使用本轮公共测试构建的 App Server，SHA-256
  `8b3ebb4311a82f439acd727d7d18c193cd589c11c40cfc3852b6a167e62b2c45`，运行后摘要未变；
  `final-source-freeze.json` 的 26 个认领源码文件无漂移。9 个 Codex 源文件均与上游 HEAD 一致。
- 原聚合 current fixture 为 exit 1（unknown Item 场景业务断言通过、Main 退出超时），后续聚合
  场景未运行。同一新产物的 unknown Item 定向重试 **exit 0**，真实 Electron/IPC/JSON-RPC/
  runtime/read model/UI 断言通过，Main 正常退出 0，无强制回收；原退出超时本轮未复现，
  不据此编造根因或宣称整套聚合通过。`--lib` owner 构建已中断，未计通过；公共 integration 覆盖该边界。
- 本片四项交付合同为“实现、公共回归、contracts/文档/治理、必需产品聚合门禁”，目前 **3/4，75%**；
  fork 与 unknown Item 专项 Gate B 已通过，整套聚合入口未完整续跑。此百分比不衡量完整 fork 或整个 Codex。
  `verify:local`、CLI/TUI/PTY、Windows、live、packaged 未执行。下节完整恢复退出条件仍开放。
- 架构确认：root，2026-10-21。复用 current session/settings/history/store owner，未新增平行
  runtime、模型切换 owner、业务存储或兼容路径；架构说明同步更新。

## 完整恢复仍需实施的退出条件

以下均属于用户要求的完整实现范围，未被本片的公共测试核销：

- [ ] rollout 自身持有完整的模型记录、session checkpoint 与必要媒体引用；脱离源数据库和
  EventLog 后，仍可恢复同样的模型上下文，不能只从 GUI Items 逆推模型输入。
- [ ] standalone 普通/压缩 rollout 复制后，四协议原生 receipt、同/跨 provider 续聊、
  session compaction surviving tail、完整用量恢复都经过公共 JSON-RPC 与捕获请求验证。
- [ ] assistant 媒体、协作工具调用参数与未知扩展按上游类型无损表达；当前明确拒绝的分支
  不能以 fail closed 代替最终能力交付。
- [ ] 真实 Electron fork/续聊、真实 CLI stdio 和 TUI PTY 恢复分别验收；壳层 smoke 不能替代。
- [ ] Context/Memory/Loop/Tools/Extensions/harness、插件/tar.gz/LimeCore 的其余项仍按主计划
  逐项落地，不把此恢复切片当成完整 Codex 复刻。
