# v1.166.0 发布执行计划

状态：候选已冻结，门禁执行中；负责人：root；日期：2026-10-21。

## 目标与范围

- 用户确认目标为 `v1.166.0`，沿用端到端发布授权，完成版本、候选、门禁、commit/tag/push 与公开渠道核验。
- 基底 `85dcb9930a1a0b7f75a1666d94225558caae2501`；上一标签 `v1.165.0`。冻结 tree `29e1ab860dc77bab85a12fd4ac9a10792ca0ec29`，共 337 个候选路径。后续新增留待下一版；生成缓存 `tsconfig.node.tsbuildinfo` 排除。
- 候选包含 GUI 侧面板/链接/浏览器偏好、Electron IPC、线程生命周期与实验后台压缩、协议 schema/client、测试和原 owner 记录，完整路径与 SHA 在 `artifacts/release-v1.166.0/candidate-manifest.json`。
- 独立源码副本 `.lime/release-v11660/source`，独立 Git index/admin；外部 npm 依赖只读链接，workspace package 指向副本。原树并行热区不覆盖；门禁修正先在冻结副本认领窄写集。

## 写集与架构

- 发布事实源：`package.json`、`packages/cli/package.json`、`lime-rs/Cargo.toml`、`lime-rs/Cargo.lock`、两份 `RELEASE_NOTES*.md`。
- 发布记录：本计划、`artifacts/release-v1.166.0/` 与 `.gitignore` 的精确放行；产品候选来自冻结 tree，不自动追入后续改动。
- current：Electron/Forge -> App Server JSON-RPC -> RuntimeCore -> canonical Thread/Turn/Item。writer/maintenance、archive/metadata 仍归既有 canonical rollout/ThreadStore owner；实验压缩默认 false。候选架构已在 architecture 与原 owner 计划确认，发版不改变领域方向。
- compat/deprecated 不新增；已删除的重复 Workbench 面板、标签与旧 metadata/unarchive 分支保持 deleted。DevBridge 候选仅同步现役 policy/catalog 合同，不恢复 mock fallback。

## Verification Contract 与退出条件

1. 版本一致性、完整 `npm run typecheck`、`npm run test:contracts`、改动前端/脚本定向与相关 Rust owner/public JSON-RPC 回归。
2. GUI 先定向，再串行真实 Agent current fixture 与标准 GUI smoke；记录场景、identity、controlled backend 和正常退出边界。
3. 上一版公开 npm 的 `thread/archive` 后台命令失败必须在本候选复验；如重现，保留原证据并在唯一 canonical rollout owner 定位，不能放宽摘要/进程/线程隔离断言。
4. 沿用标准 freshness、writer ownership、timeout、协议与版本合同；冻结副本与被验证源码保持摘要一致。
5. release commit/tag/push 后，跟踪同 SHA 的 Quality 和 Release 终态；验证 GitHub stable、14 类预期资产、四平台 CLI/npm 与三个 updater feeds/downloads。
6. 不将 Gate A、standard smoke 或历史 r31/r33 通过计作本次任意 GUI、TUI PTY、live 或跨平台 packaged 证据。完整 Codex/Memory 对齐不因本次发布核销。

## 初始证据

- 当前版本 1.165.0；远端 main 与基底一致；远端无 v1.166.0 tag。
- 全候选冻结完成；仅缓存排除，其他未跟踪产品、schema、测试与 owner 文档均纳入。尚未 commit/tag/push。
- 原工作树存在其他进程持续改动；本轮验证在副本执行。版本与 release notes 六份文件修改前均干净。

## 门禁进展

- 版本一致性、完整 `npm run typecheck` 与完整 `npm run test:contracts` 均 exit 0。副本首次 package build 缺四条 workspace 链接，补齐同一副本内链接后正常重跑；原环境失败单独保留。
- 31 个改动前端测试文件 312 项通过；2 个脚本文件误用 Node test runner，已原样改用其 Vitest runner，17 项通过。合计 33 files / 329 tests，无源码、超时或断言改动。
- 额外对全部改动 TS/JS 执行 ESLint，SDK request-client.ts 的既有 class/interface 合并触发 3 条错误；精确 HEAD 源码 stdin 复核同样失败，标准 npm lint 仅覆盖 src。其余改动路径定向 lint 通过；不修改既有 SDK owner 或关闭规则，原失败单独记账。
- Rust 首次目录名误当 package `core`，命令立即 exit 101，无测试执行；已核对 manifest 使用 `lime-core`，正常环境 helper 与独立 CARGO_TARGET_DIR 下运行 owner/public 回归，不把命令错误计作产品失败。
- 本机原 Rust target 已不存在，当前为独立全新编译；GUI renderer 与此编译分别推进，两个 Electron 聚合不并行争用同一构建锁。上一版背景命令归档故障的只读摘要诊断同步进行。

## 归档浮点摘要门禁修复

- 读取上一版公开 npm 的真实失败 rollout 后，直接调用现役 serde_json + SHA-256 可精确复现：最后一批 `wall_time_seconds=2.5593350839999998` 被默认 JSON parser 读取为 `2.559335084`，内容摘要不再匹配；原 JSON、身份、sequence 与 fingerprint 均未损坏。
- 独立最小 Cargo 复验：未开启 float_roundtrip 的原始记录 1 批摘要失败，开启后两条原始 rollout 全部摘要一致。只开启 workspace 既有 serde_json 的 float_roundtrip 特性，不升级版本、新增依赖或改变 schema/digest 格式，不吞掉完整性错误。
- 追加窄写集 `lime-rs/Cargo.toml` 与既有 `canonical_rollout/tests/digest.rs`：同一精确浮点值经过 runtime event 持久化、严格冷读、尾部续写、物理归档与再次冷读。原树该测试与基底 hash 一致后才同步，其他 rollout/GUI 生产热区保持冻结快照。
- 对本任务旧输入的 Rust/GUI 构建后代发送 SIGTERM 并保存 process 收据；这些任务记 superseded、不记通过。原 lime-core config 定向已通过；特性修复后的 canonical/public 协议/客户端与真实 sidecar 重建继续，随后串行执行 CLI、GUI 和 Agent 聚合。
- 原 owner 日志中的尾部空格/空行是原始终端输出；保持字节与来源摘要，不为了 whitespace 抹改不可变证据。源码/文档 whitespace 单独核验。两份 release notes 已补该归档修复，只有后继实际通过证据才可关闭该项。
- 此次静态及定向测试通过后的提交为远端 Quality 候选检查点；不代表 tag、GitHub stable、npm 或 updater 已发布，发布依实际后继终态收口。
