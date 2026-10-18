# 设置草稿真实桌面验收补齐

目标：在现有 Developer 诊断和 MCP 三进程生命周期入口追加真实草稿导航保护，不改变产品 owner、协议或公共 launcher。

状态：代码与定向检查已完成并冻结；真实 Electron 运行由根任务串行执行，本切片不启动原生进程。

写集仅限 `scripts/electron/settings-{developer,mcp-lifecycle}-fixture-smoke.mjs`、各自 `lib/*-fixture-evidence.mjs` 与测试、新 `lib/settings-draft-navigation-scenario.mjs` 与测试、本计划和独立 QC 收据。其他工作树改动均避让。

退出条件：

- Developer 保留原诊断方法、一次剪贴板 sink 写入、隐私与错误断言；增加 Experimental 非敏感 environment 草稿、内部 Tab 同实例保留、真实 About 导航 Keep/Discard、GUI 保存读回、重开与隔离配置恢复。
- MCP 保留三个真实进程、GUI CRUD 和冷重启恢复/删除断言；增加同一 server identity 草稿、内部 Tab 保留、内部 Cancel 与外层 About 的 Keep/Discard 及未写核验。
- 所有权威读回均校验 Electron/preload、当前 JSON-RPC 方法和 request/response identity；不使用 mock、DOM click 或内部导航替身。
- 两入口局部接既有正常 Main 退出 owner，15 秒期限不放宽，强制回收不计通过；前后 freshness 和声明源摘要相同，新 helper 必须在声明源清单中。
- 不启动 MCP、不访问外部 URL、不上传 crash；实验配置只在隔离 profile 中预置 disabled/空 DSN，仅通过 GUI 编辑非敏感 environment；证据不存配置、值、凭证或 server identity。
- 定向行为/负向证据测试、语法、lint、格式通过后冻结；真实桌面证据保持 pending，交根任务独立候选验收。

架构：仅扩展 test-only fixture 调度和证据，不改变 `GUI -> preload/IPC -> App Server -> current owner`；无业务架构变更。

分类：新场景和现有入口为 current；无新增 compat/deprecated；未删除文件。

验证：4 个文件的 47 项定向测试通过（Developer 17、MCP lifecycle 14、新 helper 12、原 MCP config 4）；8 个脚本严格 ESLint 零警告、Prettier、8 项 Node 语法和 2 项 `--help`、窄写集 diff-check 均通过。Developer 原截图仍在诊断 copied terminal state 采集，旧 23 项诊断断言和原 read 合同保留，写入另加门槛。MCP 原 18 项生命周期断言保留，新增同一 server identity 与草稿断言。共享 launcher 没有改动。

收据：`.lime/qc/settings/draft-native-20261018-1/implementation-receipt.json`；该目录的 `frozen-source/` 保存本切片 8 个脚本与计划。新 helper 声明 21 份实际源码，验收入口记录前后 SHA 并要求相同；候选的完整来源/产物冻结仍归根任务。

实现完成度 100%；本切片真实 Desktop 验收未运行，保持 pending，不计作 Gate B-F 通过。禁止把 47 项脚本/证据测试或此前 MCP44、Experimental36 组件测试冒称真实原生通过。
