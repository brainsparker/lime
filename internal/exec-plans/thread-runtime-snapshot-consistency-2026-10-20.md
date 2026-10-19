# Thread 读取完成边界一致性

状态：实现与 owner 回归完成；真实 sidecar fixture 由主任务继续验证。
Current owner：App Server `runtime/thread_read`。

## 目标与证据

`approval-reviewer-fixture-uHhhQW` 的首回合命令退出码为 0；runtime event
sequence 31 为 `turn.completed`，projection 与 canonical SQLite 都记录
`completed`。失败发生在 `thread/read` 返回的临时 `interrupted`：读取先取得
canonical `inProgress`，再等待 actor snapshot；期间执行完成并移除 active/pending，
旧 canonical 被误判为孤立 Turn。Fixture 预期保持严格，不修改等待或终态断言。

Codex 参考为本地源码 HEAD `8c076942cb70fba8e5c4732c23f1faabc4aed484`：

- `codex-rs/app-server/src/request_processors/thread_processor.rs`：
  `read_thread_view` 从 live history 与持久化 metadata 构建 thread；
  `thread_turns_list_response_inner` 合并 active Turn；分页路径
  `paginated_thread_turns_list_response` 读取 store 后参考 loaded/live 状态。
- 同文件 `normalize_thread_turns_status` 与
  `request_processors/thread_lifecycle.rs::set_thread_status_and_interrupt_stale_turns`：
  无 live execution 时将遗留 `inProgress` 投影为 `interrupted`。
- Lime 继续由 canonical store 持有 Turn/Item，actor/driver 持有执行归属；
  不引入第二份历史或产品终态。针对 Lime 的跨快照窗口，在判孤立前复核 canonical。

## Verification Contract

输入为公共读取对应的 RuntimeCore thread/read、thread/list、thread/turns/list
及真实 canonical SQLite/actor；用户可见结果为同一 Turn 的真实 terminal、时间戳、
error 和所请求 itemsView。失败终态使用真实 canonical `failed` / `interrupted`，
不合成 completed。真正冷启动孤立 Turn 仍投影 `interrupted`，不改持久化。

确定性 owner 回归使用 actor operation barrier：首次读取取得旧 `inProgress` 后
等待 Snapshot，在 barrier 期间持久化 terminal + final item 并完成 session task，
再释放 actor，覆盖三个读取入口及 full/summary/notLoaded 视图。它属于 domain
integration；真实 stdio approval fixture 和 GUI Gate B 由主任务重建 sidecar 后验证。

## 写集与实现

- `runtime/thread_read.rs`：现有读取入口调用一致性复核。
- `runtime/thread_read/history_visibility.rs`：分页成员与 cursor 保持 store owner。
- `runtime/thread_read/runtime_snapshot.rs`：执行归属采样、canonical terminal
  复核和归一化。由原主文件迁出，以控制文件长度。
- `runtime/thread_read/tests.rs` 及 `tests/runtime_snapshot.rs`：确定性回归。
- 不修改 fixture、provider、memory 或并行持有的 `turn_execution.rs`。

对疑似孤立的在途 Turn 才进行额外 canonical 读取；复制真实 terminal 的全部字段，
保持原页成员、顺序与所请求 itemsView。终态复核后仍未完成且无 owner 才应用既有
孤立归一化；不引入 sleep、宽限计时器或后台 terminal fallback。

## 验证与退出条件

- [x] 新回归先证明旧实现失败：三个入口均将 durable `completed` 返回为
  `interrupted`，原 live snapshot 测试仍通过（2026-10-20，cargo exit 101）。
- [x] 三入口完成边界回归通过：完成/失败/中断与视图共 21 组。
  真实冷 orphan、queued、live、driver-pending 与 shutdown 语义保持通过。
- [x] `cargo test --manifest-path "lime-rs/Cargo.toml" -p app-server --lib
  runtime::thread_read::tests -- --test-threads=1`：16 passed、0 failed（2.14 秒）。
  使用 `resolveRustyV8CargoEnv({ env: process.env })` 复用仓库 V8 产物。
- [x] 受影响文件独立 rustfmt 与 `git diff --check` 通过。
- [ ] 主任务使用新 sidecar 重跑严格 approval fixture，记录公共 JSON-RPC 证据。

本刀不改变架构、public protocol、依赖或 owner。结构只在既有 thread_read 模块内
按采样/归一化职责拆分；current 单轨，未新增 compat/deprecated 路径。

实际生产写集为两个既有读取文件和 `runtime_snapshot.rs`；主文件从 778 行降到
705 行，新 snapshot owner 为 135 行。测试注册与独立回归模块共两个文件。
没有修改 provider、memory、turn_execution、fixture 或并行改动；新生产逻辑未新增
编译警告。现有 memory/import projection 的编译警告不属于本刀写集。

本 owner 切片实现/回归完成度 100%；真实 stdio 与 GUI 验证仍 pending，不将
domain integration 结果提升为公共 JSON-RPC 或 Gate B。
