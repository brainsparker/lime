# Agnes 模型使用恢复

状态：active；纳入 v1.164.0 全部候选。

## 目标与写集

用户从真实 Lime 选择 Agnes 文本模型发送消息，收到完成回复；图片工作流可选择 Agnes Image 并显示实际生成图片。模型不可用时恢复输入并给出可操作提示。

本轮写集限定 model-provider canonical 数据与 HTTP 错误处理、services 模型缓存版本及能力回归、GUI 模型主题筛选与错误展示、对应测试和发布记录。Memory、问答与全局事件订阅由已有并行任务持有，只读并纳入最终候选，不夹写。

## Verification Contract

- 唯一主链：Electron GUI → preload/IPC → App Server JSON-RPC → RuntimeCore → model-provider / media task → canonical Thread/Turn/Item / task projection → GUI。
- 入口与输入：现有 Agnes provider；仅发送不含用户数据的固定聊天和图片提示。凭证只在内存中使用，不记录密钥、完整请求或用户历史。
- 成功：模型选择保留，聊天实际有文本且 completed，图片实际下载/显示；同 identity 读模型与 GUI 对应。
- 失败：不可用模型不得吞掉输入或无限重试；明确失败终态并恢复 Composer。
- 验证层级：定向单测、current capability/route integration、typecheck/contracts/GUI smoke、真实 Electron live；直接上游请求只作为诊断，不替代产品通过。

## 已证事实

- 安装版通过 computer use 使用 agnes-2.5-pro 发送失败；session `01a1579d-bd22-76f3-91d7-976f603fe75c`、turn `turn_e19a0b57a00f4ea69a9a1791c07976e5`，provider 在 3752ms 返回 503，GUI 失败终态且输入恢复。
- 同一凭证的官方 `/v1/models` 已不包含 agnes-2.5-pro；最小请求返回 `503 / model_not_found`。仍尊重显式配置模型，不硬编码迁移用户选择，不把单一凭证的模型目录当全局下架证明。
- 2026-10-20 直接流式请求：3.0 Flash、3.0 Pro、2.5 Flash、2.5 Pro Alpha、2.5 Pro Beta 均 HTTP200、有文本及 `[DONE]`。该结果仅证明当前账户上游可用。
- 安装版新对话能选择 3.0 Flash，但发送前回退到草稿且没有新 canonical session；尚未达到产品通过。
- 安装版 2.5 Flash 经 computer use 从 GUI 发送固定测试消息，用户可见回复 `OK.` 且输入恢复；session `01a157a6-e239-7862-80bb-f8647a658bcf`、turn `turn_a27ceada4b354773a27b0e56239555a9` 在 `2026-10-20T04:52:05.283Z` 有 canonical turn.completed。
- 官方图片 2.5/2.1 均 HTTP200，分别 10.78s/14.21s 取得并下载真实 PNG；2.5 图已人工查看为白底青柠。仅属上游诊断，不是 GUI 图片完成证据。无密钥或响应正文入库。
- 已实现 canonical 能力、taxonomy cache v5、媒体候选筛选、允许的 model_not_found 码提取/非重试分类及五语提示。前端两套24项与现有图片 smoke guard 5项通过；scoped lint 通过。Rust、完整 types/contracts 和新 Electron live 继续等待终态。
- 官方能力资料：`https://wiki.agnes-ai.com/zh-Hans/docs/agnes-30-flash.md`、`agnes-30-pro.md`、`agnes-25-pro-beta.md`、`agnes-image-25-flash.md`。3.0 Pro 文档仍标 coming soon，当前可用性另由上述实时请求证明；未公布 context 的模型以 0 表示未知，不虚构 token 限额。
- 当前 canonical 缺少 3.0、Beta 与 Agnes Image 能力，裸 `/models` 又不返回 capability；这些模型仍为 inferred_hint，runtime/media fail-closed 拒绝执行。

## 退出条件

1. 官方 endpoint 下新模型得到 canonical capability；非官方 host 不获得授权。
2. 旧缓存不继续覆盖能力修复；图像/视频生成模型不混入通用文本对话候选。
3. HTTP 错误只提取允许的结构化错误码，不泄露响应正文；model_not_found 不重试、不污染服务熔断，并显示切换/检查模型提示。
4. 完成定向回归与真实 GUI 聊天/图片验证，记录失败原件与 proof boundary。
5. 与其他全部候选共同完成发布门禁和实际发布。

分类：current owner 扩展；无新增 compat/deprecated 或生产 mock 路径。current_client 超大 facade 本刀只抽出既有 HTTP error helper 到子模块，退出条件为不增加 facade 业务逻辑且所有调用直接迁移，不保留重复 helper。

## 2026-10-20 追加：服务商设置布局与发布复验

- 用户截图中整个双栏工作区受设置页共用 48rem 宽度上限约束，固定 320px 模型列进一步压缩详情；头部不可收缩的操作区使 Host 接近逐字符折行。仅 Providers 设置页使用可用宽度，模型列随父容器在 220–320px 间分配，详情允许收缩；头部按内容换行，保留标题/地址的可读宽度，模型刷新按钮不参与压缩。
- 追加窄写集：`settings-v2/_layout/index.tsx`、`api-key-provider/{ApiKeyProviderSection,ModelProviderList,ProviderSetting}.tsx`。保持原设置/模型配置 owner，不新增文案或业务状态。
- `current_client` 本地 HTTP 错误测试首次 175/177，两个 fixture 请求受环境代理影响被返回 502；只对 loopback fixture 使用 `.no_proxy()`，原认证、重试与隐私断言不变。后继全组 177/177，通过；Agnes registry 8/8，通过。
- 设置布局与构建中断相关 5 文件 128 项通过；完整 `npm run typecheck` 和 Renderer production build exit0。页面宽窄视觉证据仍需在最终源码继续验收，不用组件测试替代。
- 隔离真实 Electron/runtime 通过 GUI 输入固定消息，3.0 Flash 显示 `OK`；随后 `@配图` 得到 Agnes Image 2.5 Flash 的实际 1024×1024 图片。该轮已见业务结果，但临时 launcher 正常关闭未收敛，后续仅终止自己启动的测试进程，不记 clean lifecycle pass；完整同 identity 的审计与正式 live smoke 继续补齐。
- Beta 官方未公布准确价格，canonical pricing 记未知，避免把模板中的零价当成免费承诺。
- `90bb735978dedc3c85fca9901c5ea6c4c2638ad7` 的 Quality `39373078331` 全部完成：Frontend Full、Rust Full、Integrity、GUI Smoke、Windows Shell Runtime 与聚合均 success。该结果仅覆盖该提交，后继布局与并行新增源码另行验证后重建候选。

## 2026-10-20 真实 Electron 后继收据

- 通过隔离真实 Electron 的源码 Renderer（`http://127.0.0.1:1439/?nativeStartup=1`）发送固定聊天，3.0 Flash 显示 `OK`。线程 `01a15880-f62f-79c0-abaf-44fe3d8e40e0`，回合 `turn_7fdb42e697e34b49b885331f575804b0` 的 `thread/read(includeTurns=true)` 为 completed；输入恢复。
- 同一 GUI 发送 `@配图`，回合 `turn_4a1843b748c64736b43887a0ff5a2707`、任务 `c035e4bd-72a2-4af1-bd70-7b8c67c7b989`。实际 1024×1024 图片、正文与 854 Tokens 可见；canonical completed，workflow completed 且 task ID 相同，五个 workflow steps、六条任务审计事件含 task_succeeded，敏感字段检查通过。
- 原 live helper 先因旧“思考”文本检测超时，又发现 thread/read 还使用 sessionId/historyLimit。迁移到 current 折叠 timeline 的实际可访问思路计数及 threadId/includeTurns；不将 JSON-RPC request ID 误认 Turn ID，并追加真实 media Turn completed 断言。原失败不覆盖，复用同一实际提交和任务做完整现有断言复核，全部通过。新增协议/身份回归与原 guard 7/7 通过；ModelProviderList 3/3 通过。
- 设置页真实 1024/1440/2048 宽度测量无横向溢出；标题、Host 和操作区正常，窄窗徽标单行。1024 最终截图和其余两尺寸截图已人工查看，数据见同名 JSON 收据。单行 Host 编辑框自身可水平滚动不等于页面溢出。
- 本轮原 Main 正常退出 15s 期限再次失败，仅失败后回收本 fixture PID 13178，SIGKILL 不记通过；业务/audit pass 与 clean lifecycle fail 分开记录，正在用无 Provider 的隔离实例观察退出阶段。
- 完整 typecheck、contracts 与版本一致性后继已 exit0。runtime 全组 877/878，唯一 active_wait 延迟恢复夹具在并发删除 identity 窗口失败；同一构建的单项隔离不改预算通过，保留两份原件，尚不能把全组写成通过。
- 证据摘要：`agnes-model-recovery-20261020.json`。current owner 保持不变；新增 compat/deprecated 为零；没有恢复旧命令或 mock。

- 后继退出诊断：同一现有 Host 的 before-quit、window closed、will-quit、quit 均在约200ms内执行，Playwright 仍等待实际 Main 退出；另一次原生快捷键触发后出现等待 debugger disconnect。独立无 inspector/CDP 的真实 Electron 使用相同隔离启动和 backend unavailable，经 computer use 原生快捷键退出，PID 3870 返回 code0/signalnull。该结果证明此启动条件的正常退出，不核销此前 Playwright 15s Gate，也不冒充 live 业务场景的 clean lifecycle。只回收本人测试进程，没有改生产退出逻辑、预算或依赖。
