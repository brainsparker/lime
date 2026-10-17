# 插件桌面包静态证据

日期：2026-10-17。服务于 [Codex 插件重构](./codex-plugin-reconstruction.md)。

目标 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，bundle ID `com.openai.codex`，版本
`26.1007.30912` / build `20156`，内置 CLI `0.162.0-alpha.17.2`。与参考源码 HEAD 的构建对应关系未知。

整包默认分析遇到 unpacked `permissions.node` 摘要矛盾：声明
`5f2f66c4fe19493bba7ca2e0c322ed256e39f66d4a58865875431c2ddd4d58a1`，实际
`6096151ba2644b594b0e0f3098e898c6a564b57371658f9fd80327bfa641d313`。
允许记录矛盾后继续的调用在 300 秒 MCP deadline 超时，ledger 未留存该次分析，不能宣称整包完成。

改用原 ASAR 的 `extractFile` 提取五个插件成员原始字节，未改写、执行目标代码。路径、字节数和
SHA-256 见 `.lime/qc/plugin-reconstruction/desktop-static/member-manifest.json`：

| ASAR 成员（均在 webview/assets） | SHA-256 |
| --- | --- |
| use-plugin-installation-87c99376599f.js | 3f6aa83f2b8c85ed774add4fad393fb9b743cd41192f998196bd0f57b3e35964 |
| installed-plugin-actions-1370e147e829.js | 94cd43d9fa2e5495c3c80f53b8324160cb17401d81eb5cd00ceb2ce9256d1c92 |
| plugins-query-68dc7ce3bcaf.js | 0e5fe78cdac718b3ef2c54b14d16a0ad581a75dca4ed8d1bdad49bff5908c56a |
| plugin-marketplace-context-1122e5ca6d5e.js | 12a319f33e0125d4bf1d3f7e91de93c90a341ff84e3c2b933cf28dd1e18b88c4 |
| plugin-detail-settings-enabled-f310414c3b63.js | 6f1025f7daf7f63998eca7d750093ba3d4a956473c65a76827a0e7b968812d9f |

REA `analyze_javascript_application` 对该目录成功：5 个文件全部解析，20,943 字节，235 findings。
subset artifact SHA-256 `3261f92753fe043ae5431498e5d378adbcb097ab0c077921c8de119e12e2383a`。
summary Evidence `ev_31f23d1bda7d29bd0cec199b986c240e7838fadbb34129b7f6733dba654ae7a3`，
parent `ev_b115cb93e8d47b40ce326e0d12127ef511b6d4813e253d5cfcac507834525f32`。
完整内联结果已保存 `.lime/qc/plugin-reconstruction/desktop-focused-rea.json`。

该边界内可确认详情/分享查询携带 `marketplacePath`、`pluginName`、`remoteMarketplaceName`，并消费
返回的 `shareUrl`。这支持按市场和名称定位详情的桌面合同，不能支持原有 `sourcePath` 安装 API。
其余导入多数不在提取集合内；REA 报告 1,206 semantic unknowns、语义覆盖 unknown。不能从这五个
模块推断完整安装 transport、私有服务端实现、运行时 readiness 或三端行为已等价。

公开 wire 与 runtime 语义继续以 Codex 源码为准；产品闭环另需真实 stdio、CLI、PTY、Electron 证据。
