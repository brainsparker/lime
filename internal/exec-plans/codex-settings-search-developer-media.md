# Developer / Media 静态设置搜索

日期：2026-10-18。状态：renderer 有限切片完成，定向测试、owned 严格类型、lint、format 与 diff 均通过；独立 QC 交付 root 整合。主计划由 `codex-gui-alignment-current-plan.md` 持有；本切片只完成剩余 GUI 清单第 4 刀，不作为完整 GUI 分母。

## 目标、证据与写集

复用 `internal/research/codex-desktop-rea/settings-navigation-audit.md` 的设置内容搜索证据 `ev_34efb5366f4d9b0617273007cb751bc8764c71383e46d983b157745ce735b1a0`，不重新分析参考应用。唯一索引继续归 `settingsSearchDocuments`，唯一定位白名单继续归 `getSettingsSearchDocument`，导航继续经过 root guard。

本次写集：`settingsSearchDocuments.ts`、`settingsSearch.unit.test.ts`、`sections.tsx`、`_layout/developerMediaTargets.integration.test.tsx`、`agent/media-services/index.tsx`、本计划与独立 QC 收据。Experimental 锚点由该页 owner 独立交付，不覆盖其草稿修改。共享 guard、协议、架构账本与专业文件不在写集。

## 有限交付合同

- 新增 11 个静态 target：Developer 的 crash reporting 折叠外壳 1 个（白名单 path `experimental`），Media 常驻服务卡 9 个及图片数量行 1 个。
- 只使用已有五语言 label / 说明；不收集实际配置、DSN、用户 prompt、模型名称、JSON 或密钥。DSN placeholder 不进入索引。
- 搜索定位非编辑外壳，不自动展开 crash details，不聚焦凭证、模型选择器或输入，不打开 prompt 编辑器。
- 继续编辑保留当前 owner、原值、选区和局部 tab；放弃后才切换目标；同章节跨 target 同样经过现有导航保护。
- 重复搜索使用既有 requestKey；异步目标由既有 MutationObserver 定位，取消后不得恢复失效焦点；伪造 path / target / cross-section 不能绕过白名单。

## 退出条件与验证

独立五语言 × 11 target 期望矩阵；真实 SettingsPage / Sidebar / lazy 页面 / 导航 guard 集成；定向索引、Media/Experimental 草稿测试；owned 文件严格 TypeScript、ESLint、Prettier、diff 检查。配置测试仅替换 App Server transport，保留真实 gateway / 字段 diff / 串行 owner。外部页面副作用采用显式测试 fixture。

本 Agent 不启动 Electron，不声明 Desktop Gate B；真实 GUI smoke 和候选整合交 root 串行执行。没有全仓测试或跨平台实机证据时明确保留限制。

## 进度与分类

实施前已核对共享脏工作树，父 Agent 批准上述窄写集；Experimental owner 已独立交付默认折叠锚点，`index.tsx` SHA `2c4a0532e90bc51b0d78abe74f3687238003189f3b0f4ed4b1413e5b4d812e76`。外部依赖收据为 `.lime/qc/settings/experimental-search-target-20261018-1/implementation-receipt.json`，SHA `b4b881d094df8486a1cbeecc900914aa3fcac11c487c2329a78249f2e8cc988e`。

实现结果：原索引 36 个 target 增为 47 个，本刀新增 11 个；没有扩充隐藏功能。Developer route 只消费已由原白名单解析的 `experimental` path。Media 锚点位于常驻卡 / 图片数量外壳，保留原主题、多模型选择和原有保存 owner。

最终定向测试 `4 files / 139 passed`：搜索集成 68（其中五语言 × 11 真实页面定位为 55）、索引 16、未修改的 Media 草稿集成 30、外部 Experimental 草稿集成 25。覆盖隐藏局部 tab 保稿、选区、同章节 target 切换、重复 requestKey、异步等待与取消、冲突 path、伪造 / cross-section target、不展开凭证 / prompt 编辑器，以及零未授权写。四个文件都为 renderer DOM / 显式 transport fixture；不证明 Electron / preload / App Server 真实进程。

旧实现首轮 `25 failed / 14 passed`：23 个缺索引 / 定位相关失败，另 2 个为测试错误使用 mousedown 切 tab，已修正为页面实际 click。后续五语言页面矩阵、说明检索和冲突 path 用例追加，因此不声称最终 139 项全部逐项经历红测。首次严格检查的 2 个 requestKey 可选类型诊断已通过显式类型收窄修复。

QC 目录：`.lime/qc/settings/developer-media-search-20261018-1/`。最终严格类型、lint、format、diff 及源文件 SHA / 冻结副本由 `implementation-receipt.json` 记录。root 尚需整合本切片和两页草稿 owner，串行运行标准 GUI smoke 与真实 Developer / Media fixture。

current：现有索引、路由、guard 及两个页面；compat/deprecated：不新增；dead：不恢复。未删除文件、未提交或创建分支。KISS/DRY：复用唯一索引、路由、observer 与草稿保护，不新增注册中心、配置 store 或路径包装层。该 renderer 有限切片完成度 100%；完整 GUI 与真实 Desktop 验收不由该百分比表示。
