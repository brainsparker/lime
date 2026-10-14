# Rea / Codex Desktop GUI 分析计划

日期：2026-10-13。状态：安装与有边界的静态对照完成；实时交互受限。

后续实现：用户已授权全面对齐和旧资产清理；current 任务入口为 [Codex GUI 对齐计划](./codex-gui-alignment-current-plan.md)。本文件只保留安装与研究阶段的事实和限制，不作为产品实施进度。

## 目标与写集

安装用户指定的 `morluto/rea` 已发布软件，分析本机 Codex Desktop 的 GUI 信息架构、交互、渲染与 Electron/App Server 边界，提供可复核证据。用户追加目标：比较 Lime 与当前 ChatGPT Desktop 的实际差距。

- 仓库写集仅限本计划、`internal/research/codex-desktop-rea/` 新增报告/精简证据，以及 `.gitignore` 对这三个文件的精确白名单。
- 目标应用只读：`/Applications/ChatGPT.app`，Bundle ID `com.openai.codex`，版本 `26.1007.30912`，build `20156`。
- 用户级 Rea CLI、独立兼容 Node 运行时和 Codex MCP/skill 注册属于本次安装范围；先审阅 setup 计划，保留无关配置。
- 现有脏文件与未跟踪源码只读，不覆盖、删除、提交或创建分支。
- 大体积原始 Evidence 留在用户级分析目录，不把应用代码和完整 ASAR 纳入仓库。

## 步骤与退出条件

1. 确认发布版本、运行时要求和目标身份。
2. 安装 CLI，审阅 Codex setup 计划，验证版本和 scoped doctor。
3. 使用 Rea 对真实 ASAR 建立静态证据；记录源选择、覆盖率、缺失关系和限制。
4. 分析页面/导航、Thread/Turn/Item、composer、审批、侧面板、环境、历史虚拟化及桥接路径。
5. 报告区分静态观察、推断与实时验证，附文件、摘要、关键定位和 Lime 参考建议。

## 当前发现与阻塞

- npm 最新发布为 Rea `6.4.0`；支持 Node `^22.19.0 || ^24.11.0 || >=26.0.0`，当前默认 `23.4.0` 不满足要求。
- 目标 ASAR 为 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，567,757,587 字节；产品显示名已是 ChatGPT，不能把旧版文案当成本机事实。
- Computer Use 对 `com.openai.codex` 返回安全限制拒绝访问；不以其他桌面控制方式绕过。实时窗口、截图与点击验证暂不能取得，继续安装包静态分析。
- 官方说明核对入口：<https://learn.chatgpt.com/docs/app>；官方当前描述 ChatGPT desktop workspace 中可选 ChatGPT/Codex。

## 验证

- Rea `6.4.0` + 独立 Node `24.21.0` 安装完成，CLI 可运行；Codex MCP 和配套 skill 已配置，原配置备份保留，无关配置结构比较一致。
- `doctor --client codex --skill` 三项通过；真实 stdio MCP initialize/tools/list 返回 `rea/6.4.0` 和 170 个工具。
- ASAR SHA-256：`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`；44 个选定文件按原 ASAR integrity 摘要校验，来源清单已落盘。
- 发布版未支持 main 文档中的 source_paths，改为带完整来源清单的提取子集；主分析受内存/语义限制，不能称全应用完整分析。
- 主 Evidence `ev_7e96cf795451f834a7bddc70daacbc950320070656781f6347f1cf9c759e4299` 及两个缩小范围的 timeline/surfaces Evidence 已生成；后两者选定子集 structural complete，semantic unknown 已保留。
- 实施了 Rea skill 指示的独立并行只读调查：GUI 流程与 desktop/file/remote 能力两块；无 Agent 改动现有源码。
- 交付：[对照报告](../research/codex-desktop-rea/report.md)、[精简证据](../research/codex-desktop-rea/evidence-index.json)。
- 安装 100%，有边界的静态对照 100%，实时交互 0%；不计算 Lime 全产品对齐比例。Windows、双方性能与模型质量不在本轮已验证范围。
- 研究建议已进入 current 实施计划：审批详情、Files 到既有 diff 的导航与 MessageList 视口虚拟化。后续产品写集与真实验证由 current 计划维护。
