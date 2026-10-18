# Media Services 草稿与导航保护

状态：renderer 实施与定向验证完成，等待 root 集成后的 GUI/真实桥接验证。Owner：`presentation_edit_scope`。日期：2026-10-18。

主目标：完成非专业文件 GUI 剩余切片第 5 项，保留 Media Services 的多模型能力和 blur/commit 保存方式，接入已有设置导航保护。

## 写集与边界

- 认领 `src/components/settings-v2/agent/media-services/index.tsx`、同目录新增 hook 与定向集成测试，以及本计划。
- 已向另外两个并行 Agent 确认无写集重叠；不修改共享 `useSettingsDraft`、根导航、配置 gateway、语言、协议、其他设置或候选。
- 唯一草稿继续由 Media Services owner 持有；持久化仍为现 `updateConfig` 串行字段合并，不增加 store。

## 参考与合同

依据 [剩余切片第 5 项](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md)和既有设置导航 REA 证据。上游 Media 原表单开发符号为 unknown，不编造同名类型。当前调用链为 `MediaServicesSettings -> useSettingsDraft -> SettingsNavigationGuard/useAppNavigation`，配置仍走 `updateConfig -> config/read + config/batchWrite`。

原始 prompt 与图片数输入从 `onChange` 起计入字段级 dirty。未 blur 的输入、空白/未完成图片数均可被现有导航护栏看到。有效 blur/slider commit 提交当前字段；无效图片数保留原稿、不提交默认值。导航按钮引发的真实 blur 先启动保存，再由同一护栏阻止离开；确认框自身的焦点转移不额外提交草稿。即时 enabled/provider/model 只提交各自字段。

每项提交在 await 前登记身份和有效请求数；相同字段连续重复 commit 合并，不丢 A→B→A 的新意图。成功只更新已确认基线，未在途编辑的提交字段才规范化；在途新输入和其他 dirty 字段保持。失败保留原始输入供再次 blur 重试。卸载使当前请求身份失效，迟到响应不更新新页面或提示。

## Verification Contract

预算 `budget:tight`，风险 P1，非重大架构变更（无 owner、协议或跨层数据流变化，架构图无需修改）。本轮仅 renderer/domain integration；测试使用真实页面、真实根导航/确认框、真实配置 gateway 与串行队列，测试边界为显式 AppServerClient request fixture，不代表 App Server 或 Electron 已运行。

先红后绿覆盖：五类外层导航与搜索 target、Keep/Discard、未 blur prompt、无效图片数、blur 在途与不可放弃、失败重试、同步重复 commit、多请求计数、跨字段及同字段新输入、A→B→A、即时偏好不夹带草稿、最新配置保留、成功后导航及重开、卸载成功/失败迟到、五语言无新增 key。

退出条件：局部集成与既有页面测试全绿，窄 lint/格式/类型检查通过，逐文件 SHA 与冻结交付收据写入独立 QC。current 为该页面/hook 与复用护栏；新增 compat/deprecated 为 0；旧 revision-only 保存状态由字段基线/有效请求计数替换。

本轮不启动 Electron、候选或全量测试。标准 GUI smoke 与 `settings-media-services-fixture-smoke.mjs` 真实 save/read/reopen 由 root 串行接续；缺少这些证据时不声称 Gate B 或整体 GUI 完成。

## 实现与验证

页面由 614 行减为 470 行；原始 prompt/图片数、基线、提交身份、请求数与迟到防护统一归同目录 `useMediaServicesDraft`。复用既有 `ServiceModelConfigKey`，移除页面重复类型与 revision-only 保存逻辑。没有新增 locale key、配置 schema、store 或兼容包装。

新增集成保留真实 `useAppNavigation`、确认框、`appConfig` gateway、版本校验、字段 diff 与串行队列，只替换 AppServerClient request transport，隐藏无关媒体子页与模型选择器。没有把 mocked `updateConfig` 当作本轮保存合同的证据。

- 初始旧实现红测记录 24 项中的 21 失败、3 通过，包含六导航入口、无效图片输入、保存中保护等。后续将一条误写的英文失败文案改为真实翻译 key，并扩充最终用例；红测总数不代表最终 30 项集成全部逐项取得红证据。
- 最终定向命令：`node node_modules/vitest/vitest.mjs run src/components/settings-v2/agent/media-services/unsavedNavigation.integration.test.tsx src/components/settings-v2/agent/media-services/index.test.tsx --pool=forks --maxWorkers=1 --minWorkers=1`，2 suites / 37 tests 通过（新增集成 30，既有页面 7）。
- 三份源码/测试使用当前 renderer compiler options 做 strict/noEmit 的定向 semantic 检查，0 诊断；不检查无关文件的函数体，不声称全仓 typecheck。
- 同三份文件 ESLint `--max-warnings 0`、Prettier 和窄 `git diff --check` 通过。
- 已覆盖保存期间改回旧基线、跨字段原稿保留、A→B→A 意图、等价 raw 重复提交、图片失败后原值重试、清空提示词期间新输入、所有在途请求结束前禁止放弃、真实 gateway 读回与页面重开。

精确 SHA、冻结四文件与日志由 `.lime/qc/settings-media-draft-owner-20261018-1/verification.json` 持有。本 renderer/domain 切片完成度 100%；current 为页面/hook/现护栏，test-only 为局部 transport fixture；新增 compat/deprecated 为 0，删除的是原重复类型与 revision-only 保存状态代码，无文件删除。

未运行 Electron、候选、全量、标准 GUI smoke 与真实 settings-media-services fixture，原因是 root 持有串行产品进程与集成写集。此处不是 Desktop Gate B 或整体 GUI 完成声明；下一刀由 root 集成冻结输入后执行相应门禁。
