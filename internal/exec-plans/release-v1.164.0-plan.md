# v1.164.0 发布执行计划

状态：active / 候选整理与门禁执行中。

## 目标与范围

- 发布应用、CLI 与 Rust workspace `v1.164.0`，创建并推送 `v1.164.0` 标签。
- 候选起点为已发布的 `v1.163.0`；当前工作树中该标签之后的源码、协议、测试、脚本、治理规则、研究证据和执行计划全部纳入本版。
- 已知构建缓存 `tsconfig.node.tsbuildinfo` 不纳入提交；不回退、不覆盖其他工作树改动。
- 继续沿用 Electron -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection 主链；不新增兼容后端或生产 mock fallback。

## 发版事实源

- `package.json`
- `packages/cli/package.json`
- `lime-rs/Cargo.toml`
- `lime-rs/Cargo.lock`
- `RELEASE_NOTES.md`
- `RELEASE_NOTES.en.md`

## 候选内容

- 异步用户输入、线程目标、目标附件、记忆状态与引用投影。
- Composer、文件树、文件菜单、侧栏分组、分页、个人资料、帮助和快捷键入口。
- canonical history、runtime snapshot、消息/推理/工具生命周期、模型历史和跨协议合同。
- Electron 文件 shell、IPC、窗口目标、工作区操作、App Server、Rust owner 与协议 schema。
- 退役对话导入、旧 OEM 引用和重复命令入口清理，以及对应的测试、治理、研究证据和执行计划。

## 验证与退出条件

1. `npm run verify:app-version` 通过，且仓库内无目标事实源的 `1.163.0` 残留。
2. `npm run typecheck` 通过；协议、命令、治理、发布脚本和相关 Rust/前端定向回归按改动风险通过。
3. `npm run verify:gui-smoke` 尽量通过；若环境限制导致失败，保留日志并在收尾明确证据等级和缺口。
4. `git diff --check`、正常提交钩子预检和 staged 摘要通过。
5. 提交 `Release v1.164.0`，创建 `v1.164.0`，推送 `main` 与标签，并复核本地及远端引用指向同一提交。

## 收尾记录

- 完成度、提交/tag/push 状态、验证命令、环境限制和 current/compat/deprecated/dead 分类在最终发布报告中记录。
- GUI/runtime 对齐、live provider、Windows/macOS 打包和公证覆盖只按实际证据报告，不因版本发布自动核销。
