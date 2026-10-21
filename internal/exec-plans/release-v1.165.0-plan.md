# v1.165.0 发布执行计划

状态：candidate-to-quality；负责人：root；日期：2026-10-21。

## 目标与候选范围

- 发布应用、CLI 与 Rust workspace `1.165.0`，目标标签 `v1.165.0`。
- 起点 `e6176ddcb`（main/origin/main），上一发布标签 `v1.164.0`。
- 用户要求发布，按 release workflow 纳入当前工作树全部产品、协议、脚本、测试、文档和已登记证据。
- 构建缓存 `tsconfig.node.tsbuildinfo` 不进入发布提交，保留工作树；忽略目录中的个人环境和临时产物继续遵循现有规则。
- 用户明确要求“冻结当前全部候选，后续新增留到下一版”。已于 2026-10-21 04:18:37 UTC 冻结 index tree `e5f736891fd729d6c9e5c85071d40c7933812aab`，452 个文件，71620 insertions / 11923 deletions。此后不再自动纳入产品、测试或其他 owner 文档变化；仅补本版发布记录及必要门禁修正。
- 冻结副本 `/tmp/lime-v11650-frozen-e5f736891fd7` 从该 tree 导出，源码均为独立实体；workspace package 链接指向副本，外部 npm 依赖只读复用，本地 Cargo target 通过 APFS clone 独立复制。构建和夹具继续执行原 freshness 守卫，不绕过源码一致性检查。
- 后续原工作树变化保留为 unstaged / untracked，延期下一版；不覆盖其他进程源码。完整冻结清单与内容摘要在 `artifacts/release-v1.165.0/candidate-manifest.json`。

## 本轮写集

- release metadata：`package.json`、`packages/cli/package.json`、`lime-rs/Cargo.toml`、`lime-rs/Cargo.lock`、`RELEASE_NOTES.md`、`RELEASE_NOTES.en.md`。
- 发布记录：本计划、`artifacts/release-v1.165.0/` 下的候选清单、验证摘要与不可变压缩原始日志；`.gitignore` 精确登记上述路径。
- candidate changes：现有工作树的 GUI、异步问答、Memory harness、Hook/插件、portable rollout、线程恢复、多协议历史与相关测试/证据；完整列表在候选清单保存。
- 源码问题仅在门禁提供有效失败后认领窄写集；不主动重构其他 owner。

## 分类与架构

- current：Electron/Forge、App Server JSON-RPC、RuntimeCore、Thread/Turn/Item 与现有领域 owner。
- 本轮发布 metadata 不增加 compat/deprecated 路径；候选已删除的旧 Memory proposal、重复用量转换与旧 rollout reader 保持 deleted，不恢复。
- 重大候选架构以既有 architecture 与 Memory/rollout/fork 责任计划中的确认记录为准；版本发布不核销完整 Codex 或 Memory 路线图。

## 验证与退出条件

1. 版本一致性、完整 `npm run typecheck`、`npm run test:contracts` 通过。
2. 按风险验证当前 Rust/前端 owner、current fixture 与标准 `npm run verify:gui-smoke`，保留失败、未执行与证据等级。
3. 中文/英文发布说明仅保留目标版本；无目标事实源旧版本残留；源码/文档 whitespace 与文档边界检查通过。
4. 生成可审查候选清单、内容摘要、排除清单与门禁结果。用户随后明确授权“全部发布，不要找我确认，我去午休了”，本次 commit/tag/push 和发布跟踪已获得授权，不再重复询问。
5. typecheck 等静态门禁通过后先提交冻结候选并推送 main，启动远端 Quality；本地 Rust/桌面验证继续。待 Quality 与本地验证收口后再创建并推送新标签，复核远端引用；不覆盖既有标签。
6. 跟踪 Quality/Release 终态，检查 GitHub Desktop/CLI/npm 产物、npm registry 与 R2/feed；只报告实际成功渠道。

## 当前验证

- 初始本地及远端 `v1.165.0` 标签不存在；远端 main 与起点一致。
- pnpm lockfile 与 Forge/release manifest 无独立显式应用版本，不强行修改。
- `npm run verify:app-version`、完整 `npm run typecheck`、完整 `npm run test:contracts` 均 exit 0。
- 33 个改动前端测试文件共 590 项：首轮 588 passed / 2 timeout；两个原样隔离文件分别 8/8、9/9 通过，原 5000ms 预算和全部断言保持。保留首次失败，不将首轮改写为绿。
- 7 个改动脚本 Vitest 文件 137 项断言通过；误把 Node test 文件传给 Vitest 导致一个 suite 收集失败，随后 package 原生 runner 288/288 通过，无源码修改。
- AI commit-hook 显式候选预检 349/349 通过；源码及文档 `git diff --check` 通过。
- Memory 四 crate 定向回归最终 93/93，中断 callback 回归 1/1 通过；canonical rollout 后继仍在执行。旧 Memory 冻结清单有来源漂移，不能代替当前候选验证；rollout 40 来源摘要一致，其公共回归 54/54、provider 181/181 为已有 owner 证据，仅在原覆盖范围内引用。
- 其他进程新增 CLI 中断夹具诊断与 owner 记录，纳入最后候选清单；该夹具由原 owner 验证，不覆盖其实现。
- 原始日志位于 `/tmp/lime-v11650-*.log`，结构化结果保存在 `artifacts/release-v1.165.0/verification-summary.json`。
- 尚未 commit/tag/push，尚未对外发布。

## 门禁修正

- 四 crate Memory 回归首轮 exit 101：新增 `session_loop/tests.rs::explicit_interrupt_runs_interrupt_callback_but_replacement_does_not` 对 `submit` 的 Result 再次 `.await`，两处 E0277。核对当前 async handle 后只移除重复 `.await`，不修改生产实现或断言；该文件自候选盘点以来无外部漂移。四 crate 原命令重新执行，结束后补该中断回归的定向运行。
- 标准 GUI smoke 已完成 renderer 与 Electron Host 构建，正在重建版本更新后的 App Server 侧车。current fixture 371 项前置定向/guard 已执行，后续 Electron 子场景仍待侧车，不提前记为聚合通过。
- 后继标准 GUI smoke 真实 `1.165.0` 侧车 24/24、exit 0；收据 `gui-smoke-summary.json`。首轮 Agent 聚合 unknown-item 业务通过但正常退出超时；原样隔离复验完整通过、Main code 0、forced cleanup null。第二轮聚合通过图片/审批等场景，在 rich draft Stop 缺少 backend cancel ledger 失败；原样 rich draft 专项完整通过。原失败与隔离通过均单独保存，第三轮完整聚合继续执行。
- Rust 后继定向暴露测试合同漂移：Review replacement task 未标记 `RuntimeSessionTaskKind::Review`，已补 typed kind，原 Interrupted/Replaced/callback 断言保持。Memory 用量测试中的 unquoted tilde 被既有 word-only parser 拒绝；正向样本按 Codex `memories/read/src/usage_tests.rs` 改为 literal root 的 cat/sed 读取，仍断言两种 artifact。未知工具和 tilde expansion 保持 fail closed。Search 元数据经过 `short_display_path` 已丢失 root，不猜测归因；显式负向断言及此未覆盖边界保留，不声称搜索遥测已实现。
- 修正只涉及上述两份已有候选测试；Memory 用量生产逻辑未改变。最终四 crate Memory、中断 callback、canonical rollout 的顺序回归在 `/tmp/lime-v11650-rust-final-r4.log`。
- 第三轮 Agent 聚合在 renderer 编译时检测到其他进程修改输入，报 `Renderer build inputs changed during compilation`、exit 1，未进入本轮桌面业务验证。保留原始失败，已转移至上述冻结副本重跑聚合、完整 typecheck/contracts、构建输入测试、Desktop config 和 rollout/fork 定向回归。
- 冻结副本 Desktop 配置 3/3、提交钩子候选预检 421/421、Agent 聚合前置定向检查 371 项通过。已停止本轮在原树中启动且被副本替代的 canonical rollout 编译，保留 Memory 93/93 与中断回调 1/1 原始成功，不将取消记为 rollout 通过。只对已核实本任务后代 Cargo/rustc 发送 SIGTERM，未终止其他进程；见 `superseded-rust-cancellation.json`。
- 冻结副本完整 `npm run typecheck` exit 0（1363.29s）。系统约 21 GB swap，已将本轮 Rust 编译短暂停调度 180.84s 后恢复，未暂停测试执行、修改预算或触碰其他任务；见 `compilation-scheduling.json`。
- 本轮错误并行启动 GUI smoke 和 Agent 聚合，它们争用同一 renderer 构建锁。GUI renderer 编译超过既有 20 分钟等待后，聚合 exit 1，371 项前置通过但没有启动业务场景。保留失败；待 GUI 构建完成后串行重跑聚合，不放宽锁预算或设置 build-ready override。
- 冻结候选定向 ESLint 119 文件、0 warning/error、exit 0。contracts 的 protocol/client/command/harness/modality 检查通过，脚本治理因导出副本无 `.git` 中断；用独立 frozen index + 原仓库只读对象上下文补齐后重跑，未更改源码、原树 index 或任何断言。
- 当前提交是进入远端 Quality 的候选检查点，不代表 tag、安装包、npm 或 updater 已发布；这些渠道以收尾 publication receipt 为准。
