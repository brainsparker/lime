# 清理公开 Item 导入元数据

## 目标与事实源

目标：从 current App Server v2 Item 合同删除仅服务已退役历史导入功能的公开 metadata，不保留空结构或兼容包装。

Codex 源码事实源：`/Users/coso/Documents/dev/rust/codex/codex-rs/app-server-protocol/src/protocol/v2/item.rs` 的 `ThreadItem`。上游公开 UserMessage、AgentMessage、Reasoning、工具等 Item 不包含导入 provenance metadata。此切片只对齐公开导入残留，不扩大为其他 Item 差异的完成声明。

主链：`Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection`。

## 写集与并行边界

- current owner：`app-server-protocol` 的公开 Item、`app-server` 的 thread projection。
- 删除 `ThreadItemMetadata`、`ThreadItemSourceProvenance`、所有公开 Item 上对应 optional metadata 字段、唯一导入 provenance producer 及旧正向断言。
- 迁移 Rust public Item 构造、TypeScript 消费者与 schema/type 生成物。
- 只保留 canonical metadata 的有效消费者，包括 memory citation、reasoning、工具生命周期、图像和 MCP 映射；保留并行 memory 协议变更。
- root 持有 session defaults/read model/request context；其他 Agent 持有 canonical store/event/item，均不在此切片内。

## 验证合同与退出条件

输入：canonical Thread/Turn/Item。结果：公开 v2 Item 不再声明或输出导入 metadata，当前 memory/工具/文本映射保持有效。失败终态：真实投影错误仍按原错误返回，不降级 mock。

- [x] 删除公开类型、字段、producer 和旧正向断言。
- [x] 迁移构造及 TS 消费者，生成 Rust schema 与 TS types。
- [x] 本进程 protocol/TUI/TS、schema 一致性与 client 合同定向检查通过。
- [x] 记录当前工作树验证范围、剩余问题与清理分类。
- [ ] root 统一完成 App Server projection related 与完整 contracts。

## 当前状态

源码、schema/type 生成物和本进程验证已完成并冻结，根进程继续统一整合门禁。公开合同与 canonical 内部 metadata 独立；本切片不删除仍有真实消费者的 canonical 字段。

实际删除：19 个公开 optional metadata 字段、两个 DTO、唯一 `projection/metadata.rs` producer；TUI public 构造中的字段作机械迁移。前端 public reader 删除泛透传、plan 任意覆盖和 `fileChange -> file_artifact` 的导入判定，runtime tool metadata 与按 typed identity 推导的 plan/agent metadata 保留。

现有 retired-import 合同护栏增加 v2 Item 源文件和 schema bundle，并禁止两个已退役 DTO 回流；复用原扫描，不新增目录扫描或 catalog。

已完成验证：

- `cargo test --manifest-path "lime-rs/Cargo.toml" -p app-server-protocol --lib --no-fail-fast`：143 项通过，含并行 memory status/reset 合同。
- `npx vitest run src/lib/api/agentRuntime/appServerCanonicalItemReader.test.ts src/lib/api/agentRuntime/appServerCanonicalItemProjection.test.ts --silent=passed-only --disableConsoleIntercept`：2 文件 45 项通过。边界表测试给各 typed Item 注入任意 metadata，确认不被透传；plan identity 防止任意 metadata 覆盖。
- strict ESLint、Prettier、受影响 Rustfmt、`git diff --check`、合同脚本语法检查通过。
- `cargo test -p app-server-protocol --test schema_fixtures --offline`（上述独立小目标，dev/test debug=0）：1 项通过，所有生成 fixture 与 Rust 合同一致。
- `npm run generate:protocol-types` / `npm run check:protocol-types`：1057 个 current 协议类型生成成功、无漂移；memory status/reset 合法增量保留，两个导入 DTO 在 source/schema/generated TS 中均为零引用。
- `npm run build --prefix packages/app-server-client`：TypeScript package 构建通过。
- `node scripts/check-app-server-client-contract.mjs`：296 项合同检查通过。
- `npx vitest run packages/app-server-client/tests/client.test.mjs --silent=passed-only --disableConsoleIntercept`：97 项通过。
- `cargo test --manifest-path "lime-rs/Cargo.toml" -p tui --lib --quiet`：1884 项通过。TUI 迁移精确为 25 文件、107 行失效构造字段删除，无新增行和交互逻辑改动。

App Server related 和全量 contracts 由 root 在整合后统一运行；本切片不重复启动。schema exporter 因共享 artifact lock 改为 `/tmp/lime-protocol-schema-20261020` 的仅 protocol offline/debug=0 目标，不复制整个 runtime target。

## 分类、范围与剩余验证

- current：typed v2 Item、有效 canonical metadata、memory citation、reasoning 与工具投影，以及由明确 identity 推导的 renderer metadata。
- compat/deprecated：本切片未保留兼容字段、空 DTO、wrapper 或 fallback。
- dead/deleted：导入公开 metadata DTO/字段/producer、前端导入 fileChange 特判、对应旧正向测试；旧标记只允许负向边界输入和 retired guard。
- 本进程改动实现完成 100%；整体验收仍须根完成 `processor::thread::projection`（含 `canonical_item_metadata_does_not_cross_the_v2_boundary`）与统一完整合同门禁。
- 这些结果属于协议 Unit/domain 与 TS client 边界证据，不新增 Electron/CLI/TUI Gate B 或 live provider 完成声明。
- `.gitignore` 仅新增三份专项计划的精确例外：本计划、Composer 布局消费者/IME 计划，以及 root 的 runtime snapshot consistency 计划，确保验证事实可审阅。
