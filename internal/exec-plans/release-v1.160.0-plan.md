# v1.160.0 发布执行计划

状态：active，本地准备 100%，所有选定本地门禁通过；尚未 commit / tag / push，等待用户一次明确确认后继续远端发布。

## 目标与固定候选

- 用户要求「发布 v1.160.0」。目标为版本 1.160.0、标签 v1.160.0，完成本地验证、发布提交、main/tag 推送和远端发布结果核验。
- 起点 main/origin/main：471d0a88f174842e2d77c717f28c49ebb03da62f；上一标签 v1.159.0。远端目标 tag 和 GitHub Release 不存在。
- 原工作区存在持续并行开发；源码冻结在独立副本 `/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-release-v1.160.0-crhz68kf`。源码、构建输出、Cargo target、Git index 和 hooks 隔离，第三方依赖只读复用。原工作区 index 未改，不终止其他进程。
- 最终候选 465 个物理路径，Git rename 统计 452 项：7 个 metadata 路径、458 个产品/测试/文档路径。复制生成的 6 个临时依赖链接（root helper 及 5 个 package 链接）全部移出暂存，保留原依赖；最终清单禁止 node_modules、.lime 和构建产物。
- 全路径清单、补丁、staged 统计、摘要和日志在 `.lime/release/v1.160.0/`；完整审阅入口 `candidate-review.md`，canonical manifest 为 `candidate-paths.json`，固定源码哈希为 `candidate-source-hashes.json`。
- 沿用上一发布计划，排除本地分析文件 `local-conversation-page-a83a1af2c24b.js` 和增量缓存 `tsconfig.node.tsbuildinfo`。冻结后并行改动与新文件另列 `post-freeze-exclusions.json`，本版仅发布已经验证的冻结内容；原工作区后续内容保留，确认时明确批准排除范围。

## 直接写集与发布内容

- Metadata 写集：`package.json`、`packages/cli/package.json`、`lime-rs/Cargo.toml`、`lime-rs/Cargo.lock`、双语 `RELEASE_NOTES*.md` 和本文。36 个 workspace package 版本同步；pnpm lock 无 root release version，Forge/App Server manifest 继承 package version，不修改 registry 依赖版本。
- 夹具修复写集：`scripts/app-server/approval-reviewer-fixture.mjs` 等待同一 Turn 的公开终态通知、失败保留 transcript；`scripts/electron/lib/plugin-package-fixture.mjs` 仅移除末尾多余空行。写入前逐字核对与冻结内容一致，未覆盖并行修改。
- 产品候选包含插件市场协议/共享配置/安装身份与 GUI、CLI 消费者替换；App Server/CLI/TUI 共享后端；工作目录、审批审核者、服务档位、动态工具宿主恢复和 Skills 监听；设置内容搜索、草稿保护及 Memory/Appearance 拆分；五语言消费者同步。
- 包含上一 tag 后 main 已落地的 macOS 公证票据恢复与发布诊断修复。双语发布说明只保留 v1.160.0，完整变更范围 v1.159.0 -> v1.160.0。
- 完整远端插件市场和整体 GUI 对齐继续按原 owner 计划保持 partial，不借本次发版核销。

## 架构、分类与原则

- current 唯一主链仍为 Product Surface -> App Server JSON-RPC -> RuntimeCore -> canonical Thread/Turn/Item；Forge 官方 makers、签名公证和内置 autoUpdater 为唯一发布链。
- 新增 compat/deprecated 为零；候选删除旧插件 DTO/mock、重复入口和过期文档，不增加包装与平行实现。
- 架构图确认沿用 `internal/aiprompts/architecture.md` 和插件重构、共享后端、GUI owner 执行计划中的责任确认。本轮 metadata 和 test-only 时序修复不改变业务 authority。
- KISS/DRY 复用既有版本和发布入口；SOLID 保持已有领域职责；YAGNI 不新增发布器或兼容层。夹具仅等待公开合同终态，不放宽审核断言。

## 本地验证结果

| 门禁 | 结果与范围 |
| --- | --- |
| `npm run verify:app-version` | exit0，1.160.0；标准 GUI 构建再次通过 |
| `npm run typecheck` | exit0，完整 renderer + node；Electron Host 再次类型检查通过 |
| `npm run test:contracts` | exit0，协议/client/command/harness/modality/scripts/release/desktop/CLI/docs guards |
| 改动相关 Vitest | 30 文件、614 项通过 |
| 发布/更新/公证 guards | 3 文件、64 项通过 |
| CLI npm tests | 9 项通过 |
| canonical src 定向 ESLint | 71 个改动 TS/TSX 文件通过 |
| Rust 12 个受影响 crate lib | 5765 passed / 0 failed / 0 ignored，exit0；含 App Server 1939、TUI 1883 项 |
| Rust CLI bin | 114 passed / 0 failed / 0 ignored，exit0 |
| `governance:legacy-report` | exit0，边界违规与分类漂移均为 0 |
| Agent current fixture 聚合 | exit0，真实 Electron 子场景全部执行；liveProviderUsed=false |
| `npm run verify:gui-smoke` | exit0，App Server/应用 1.160.0；24/24 断言、39 次真实 IPC、3 个视口、mock fallback 0 |
| `npm run smoke:cli-gate-b` | exit0，JSONL 实时性/中断/推理展示/五语言/恢复/分叉/review/图片/schema/stdin/output file/关闭；按各子场景声明 runtime 或 external backend |
| stdio unavailable smoke | exit0，仅证明 unavailable backend fail-closed |
| 服务档位 runtime fixture | 11 Turn，通过 priority/null/flex 和冷恢复 |
| 动态工具宿主 fixture | 4 Turn，通过断连/恢复/冷重开；observer execution 0 |
| Skills 插件 fixture | 8 Turn，通过安装/编辑/启停/冷 watcher 编辑/卸载 |
| 审批审核者 fixture | 6 runtime Turn + 1 真实 CLI Turn 通过，含批准/拒绝/无效/中断/冷恢复 |
| 远程工作目录 fixture | 8 runtime Turn、3 真实 TUI PTY 场景、冷重开，通过默认/相对 cwd、恢复和分叉及终端恢复 |
| 插件 Electron Gate B | exit0，安装/启停/new-thread boundary/MCP App/重载/冷重开/卸载后历史 |
| 设置导航/搜索 Electron fixture | exit0，36 个内容目标、草稿保护、4 种主题/系统投影、窄窗口；1770 次真实 IPC、错误/mock 0，正常主进程 exit0 |
| staged `git diff --cached --check` | 已修复新增夹具 EOF 多空行，最终 exit0 |
| 正常预提交验证 | 最终 407 passed / 0 failed；commit 时继续执行正常 hooks |

Rust 定向命令：`cargo test --offline --locked --manifest-path lime-rs/Cargo.toml --lib -p lime-agent -p agent-protocol -p app-server -p app-server-protocol -p app-server-transport -p cli -p lime-core -p lime-mcp -p lime-server -p lime-skills -p tool-runtime -p tui -- --test-threads=2`；CLI bin 另跑 `-p cli --bin lime`。未运行裸 npm test、全量 cargo test 或裸 lint。

## 失败定位与证据限制

- 审批夹具首次失败 actual review notifications 0/expected 2。原始 runtime events 已含 review started/completed，诊断 transcript 证明持久化 terminal 先于异步 wire 到达。改为有期限等待同一 `turn/completed` 后保留原始 lifecycle、reviewer、拒绝/取消执行数断言；最终 6 Turn + CLI 重跑 exit0。原始失败日志与诊断保留，不将首次失败写成通过。
- 扩展到 packages 的 ESLint 存在 request-client.ts 3 项既有 class/interface declaration merging 错误；对起点 HEAD 原文执行同一规则逐项复现。它在 canonical `eslint src` 范围外，不宣称扩展检查通过。
- PR 专用 architecture-confirmation 本地因缺真实 PR event/body 在检查前 exit1；push CI 按既有规则跳过，未伪造 PR 确认。
- 未提供旧版 App Server artifact，审批夹具旧二进制迁移子场景返回 null，未执行；相关 unit migration 测试包含在 App Server 测试中。
- CLI human color 的 outer-stdin-tty 分支未执行；远程工作目录另有 3 个真实 TUI PTY 场景，不能互相冒充覆盖。
- 本地为 macOS arm64，未运行 Windows/Linux、签名安装产物、OS URL dispatch 或 live provider；设置导航采用明确 external backend，插件/服务档位等 provider 为 loopback fixture。各 evidence 自述边界，不扩大到生产 provider、完整远端市场或整体 GUI 对齐。
- 固定 App Server SHA256 `47f5683bedd916803f40bbef3ff9a5df310371baa55867bd0a367243c8c9fc55`；CodeMode Host SHA256 `56ff73e983c228e66df3fc9493c15d123e258fb74818e62fc41e91ba73130f5d`；CLI SHA256 `b30dec7c260ee3d49ceab6de7411e9a9847da3da16d497c8fd9dda31b0d77f8c`。

## 退出条件与剩余动作

1. 已收齐全部本地退出收据；更新最终清单/源码哈希、暂存摘要、完整补丁与验证 JSON，固定副本除声明写集外无意外漂移。
2. 刷新原工作区冻结后差异与远端 main/tag/Release 状态。汇总 metadata、全部 candidate 和排除清单，按 AGENTS.md 与 release skill 请求一次明确 commit/tag/push 确认。
3. 确认后在独立副本正常 hook 提交 `Release v1.160.0`，创建新 tag，显式推送 main 和 v1.160.0；不覆盖既有 tag，不绕过 hooks。
4. 复核远端 SHA，跟踪 Quality/Release 及 GitHub、npm、R2 实际资产和安装版本；失败先定位和修复，不将「已触发」标记为完整发布。
5. 原工作区保留冻结后改动；任何本地 ref/index 同步前重新检查，避免覆盖他人暂存和源码。本计划在远端发布收据齐备前保持 active。

- 最终排除复核（2026-10-17T05:34:11.631342+00:00）：冻结后 24 个既有路径出现后续差异、6 个新文件，另排除上述 2 个本地文件。完整路径列于 candidate-review.md 和 post-freeze-exclusions.json；用户确认应包含该排除范围。
- 设置夹具首次直接调用在产品启动前因证据父目录不存在退出；仅创建父目录后以 fresh run ID 重跑，完整最终场景 exit0，保留原始启动日志。
