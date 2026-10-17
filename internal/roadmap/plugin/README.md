# 插件重构

更新时间：2026-10-17。状态：实施中。

插件按 Codex current 重构。Lime 原有包格式、安装记录、私有执行器与公开安装合同直接删除；开发期间不迁移旧数据，不提供兼容入口。

- [目标合同](./codex-contract.md)：manifest、资源、身份、缓存、协议和边界。
- [执行计划](../../exec-plans/codex-plugin-reconstruction.md)：两仓写集、分步退出条件、删除账本和验证结果。
- [架构](../../aiprompts/architecture.md)：共享 App Server、RuntimeCore 与组件 owner。

CLI、TUI 与 GUI 共用 App Server 插件领域。标准 Agent Plugins 包和 Codex loader 支持的原生生态包均属于目标格式；不能把 `.codex-plugin/plugin.json` 限制为标准包的附属文件。具体实现状态以执行计划为准，旧插件验证不核销新合同。
