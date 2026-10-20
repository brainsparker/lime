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
