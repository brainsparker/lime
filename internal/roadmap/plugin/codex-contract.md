# Codex 插件目标合同

更新时间：2026-10-17。实现状态见[执行计划](../../exec-plans/codex-plugin-reconstruction.md)。本文件描述目标，未通过对应验证的条目不能宣称完成。

## 事实源

Codex 源码 `/Users/coso/Documents/dev/rust/codex`，基线 `4eb4a65407d98cebc4c83bf13be440b9fbc78a7c`。manifest/store/marketplace 参考 `codex-rs/core-plugins`，公开协议参考 `codex-rs/app-server-protocol/src/protocol/v2/plugin.rs`，技能选择参考 `codex-rs/ext/skills/src/selection.rs`。

桌面安装包 `/Applications/ChatGPT.app`，bundle ID `com.openai.codex`，版本 `26.1007.30912` / build `20156`。REA 的五个插件模块静态分析只覆盖所提取成员，不代表完整应用或运行验证。成员路径、摘要与完整内联结果保存在 `.lime/qc/plugin-reconstruction/desktop-static/member-manifest.json` 和 `.lime/qc/plugin-reconstruction/desktop-focused-rea.json`；Evidence ID 与限制见执行计划。

## 包与资源

manifest 查找优先级为：声明 Agent Plugins schema 的根 `plugin.json`，随后 `.codex-plugin/plugin.json`、`.claude-plugin/plugin.json`、`.cursor-plugin/plugin.json`。无关根 JSON 不抢占原生 manifest；已声明但不支持的标准版本必须报错，不能回退原生格式。

标准 schema 为 `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`，使用固定 `skills/` 直接子目录和 `mcp.json`；其 Codex 扩展优先取 `extensions.com.openai`，其次 Codex 元数据文件。原生格式按声明的 Skills roots、MCP、Apps、Hooks 等资源加载，不猜测单一固定目录。资源解析、路径约束、默认值与错误隔离应与 Codex 对齐。

标准包缺省版本为 `1.0.0`；原生包缺省版本为 `local`。安装前后与云端发布必须使用同一有效名称和版本。技能名称使用 `plugin:skill`，内部身份包含完整插件身份；选择以结构化路径和启用状态为事实源，不在 renderer 重建激活状态。

## 身份、缓存与配置

插件 ID 为 `name@marketplace`。安装缓存为 `<AgentRoot>/plugins/cache/<marketplace>/<plugin>/<version>`，从缓存枚举安装状态，共享配置 `plugins.<pluginId>.enabled` 决定启停，`plugins._default.enabled` 提供默认值。同名不同市场独立安装、启停和卸载。

同版本重装原子替换，失败恢复原缓存和配置。卸载删除插件缓存，持久数据遵循 Codex store 语义。标准包数据为 `plugins/data/agent-plugins/<identity hash>`；原生包数据为 `plugins/data/<plugin>-<marketplace>`。不读取、转换或清空真实用户的旧安装目录。

## 公开协议与消费者

- `plugin/list`：`cwds`、`marketplaceKinds`、`forceRefetch`；返回 `marketplaces`、`marketplaceLoadErrors`、`featuredPluginIds`。
- `plugin/installed`：`cwds`、`installSuggestionPluginNames`；返回 `marketplaces`、`marketplaceLoadErrors`。
- `plugin/read`：`marketplacePath` 或 `remoteMarketplaceName` 与 `pluginName`；返回 `plugin` 详情。
- `plugin/install`：市场定位、`pluginName` 与可选 `installAttemptId`；返回 `authPolicy`、`appsNeedingAuth`。
- `plugin/uninstall`：完整 `pluginId`；返回空对象。启停走共享 `config/batchWrite`。
- marketplace、share、remote plugin 与授权能力按 Codex current 补齐，不再以旧产品范围裁决排除。

CLI 使用 `PLUGIN@MARKETPLACE` 或 `PLUGIN --marketplace MARKETPLACE`。GUI 与 TUI 消费同一 typed client；生成 schema、TS 类型、gateway、catalog、fixture 和守卫同时更新。禁止保留 `sourcePath` 安装、独立 enabled method 或旧返回对象作为兼容层。上述协议切换尚由 P03 跟踪，存储替换不等于协议完成。

## 唯一执行链与云端

```text
CLI / TUI / GUI -> App Server JSON-RPC
  -> plugin catalog / store / shared config
  -> immutable component snapshot -> Skills / MCP / Hooks
  -> RuntimeCore -> Thread / Turn / Item

LimeCore 发布与市场 -> 同一包和身份合同 -> 客户端 App Server
LimeCore gateway -> tenant-owned Rust App Server transport
```

LimeCore 负责发布、市场、租户与鉴权控制面，不复制 Agent loop。上传扫描验证选中的原始 manifest 字节并计算其摘要，不能把根同名文件或重序列化 JSON 当成选中 manifest。OpenAPI 修改 source fragments 后生成 bundle。

旧私有包 schema、独立 worker/runtime、renderer registry、v3 installed records 与旧规则为 `dead / deleted / forbidden-to-restore`。历史资料从 Git history 追溯。完成验收必须覆盖两仓包发布/下载、安装、真实 Turn 和三端消费；unit、stdio、CLI、PTY、Electron 与 Windows 证据分别报告。
