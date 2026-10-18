# V1-01 Codex Method 产品范围矩阵

> status: `inventory-current / implementation-open`
> owner: `app-server-protocol` + 对应 current domain owner
> fixture: `internal/refactor/v1/fixtures/codex-method-product-scope.v0.1.json`
> upstream: `/Users/coso/Documents/dev/rust/codex@99660ab3c7b861c916e467581fa9b8723504d66b`

## 目标与口径

Codex 的合理能力全部进入对齐范围。缺少现有消费者、GUI入口或领域实现是待实施缺口，
不能作为排除依据。开发期直接替换冲突实现，不恢复旧插件、退役runtime或兼容包装。
GUI、CLI/TUI 共用 App Server、runtime、Thread/Turn/Item、工具和持久化owner。

矩阵按方向覆盖 `clientRequest`、`serverRequest`、`serverNotification` 和
`clientNotification`。每个方向化identity只能属于以下状态：

- `implemented`：generated manifest已有同方向、同名合同，且存在owner/evidence；仅为合同分类，
  不代表字段、行为、恢复、产品消费者或Gate B完整通过。
- `planned`：能力应对齐，但exact method、shape、lifecycle或证据仍欠账。
- `product-scope-excluded`：过时协议、显式test-only方法或依赖上游专属服务authority且不能
  合理复刻的合同；不得伪造结果或恢复兼容层。所有排除必须写具体依据。

## 当前盘点

| 状态                   | 数量 | 含义                                          |
| ---------------------- | ---: | --------------------------------------------- |
| implemented            |  174 | 已有同名合同及owner，产品完成度仍需独立验证   |
| planned                |   56 | 按现役owner实施，不能由缺实现再次改成excluded |
| product-scope-excluded |   15 | 仅以下明确类别                                |
| total                  |  245 | 冻结方向化identity，无遗漏或重复              |

方向计数保持：155 clientRequest、11 serverRequest、78 serverNotification、1 clientNotification。
identity排序SHA-256保持 `cfebd0e98216f2a0f2e97d3999cf63457f8882c0d7f336336503f96caa0c4c95`。
它是固定上游方法基线；新增方法（如本轮 `plugin/reconcile`）、tar.gz格式、组件发现、工具
生命周期和桌面交互不包含在245分母内。不得把174/245当整体对齐完成率。

## 2026-10-18 合理能力复审

从原excluded重新纳入46项；原有account基础合同4项、plugin/share五项和plugin/skill/read
一项保持planned。详细owner、顺序、退出条件及证据见
[合理范围复审计划](../../exec-plans/codex-method-scope-reassessment.md)。

| planned能力                                                 | 数量 | 现役owner                                                  |
| ----------------------------------------------------------- | ---: | ---------------------------------------------------------- |
| 进程诊断                                                    |    1 | App Server诊断                                             |
| 配置requirements                                            |    1 | core config + App Server权限                               |
| MCP配置重载                                                 |    1 | 同一config + tool-runtime MCP                              |
| 外部配置/历史导入及通知                                     |    6 | App Server导入 + thread-store                              |
| 模糊搜索session及通知                                       |    5 | App Server文件搜索                                         |
| 实时Thread音频/语音/文本及通知                              |   14 | Thread/Turn + model-provider + voice-core/media-runtime    |
| 完整account基础、控制、Bedrock、usage/limits、通知及refresh |   13 | AccountManager + model-provider + LimeCore认证控制面       |
| 反馈                                                        |    1 | App Server诊断/反馈                                        |
| 远程控制配对/撤销/状态及通知                                |    8 | app-server-client认证transport + LimeCore runtime registry |
| 插件分享与未安装Skill正文                                   |    6 | 同一Plugin owner + LimeCore发布/授权                       |

Bedrock setup的源码实际发现AWS profile/环境凭据存在性、验证区域并配置当前provider，
此前“只是Codex专属账号服务”的排除理由不成立；不得把已有Bedrock provider route当成已完成
同名account合同。实时能力、导入、搜索session和远程配对同样不能因暂无消费者而禁止。
这些是范围纠正，没有增加空handler、fake manifest或第二业务后端。

account/read、login/start、logout和updated虽已有cloudAuthTokens基础实现，仍缺上游全部
认证模式及消费者，保持planned。LimeCore凭据不伪装成ChatGPT token；多模型控制面与provider
readiness继续归Grok-aligned model-provider。

## 保留的15项排除

- legacy/deprecated请求和通知9项：旧v1鉴权/会话/审批、thread/rollback、旧fileChange与
  compaction通知及deprecationNotice。现役typed审批、ContextCompaction等不受此排除影响。
- test-only `mock/experimentalMethod` 一项。
- 上游专属计费操作两项：`account/rateLimitResetCredit/consume` 与
  `account/sendAddCreditsNudgeEmail`；不伪造OpenAI credits或发送结果。通用usage/limits已在planned。
- 上游专属 `attestation/generate` 一项；不伪造服务证明。
- 绕过canonical投影的内部 `rawResponse/completed`、`rawResponseItem/completed` 两项。

实现时发现上游状态或服务authority变化，应基于源码/REA重新裁决并记录；禁止只改hash或
计数掩盖identity漂移。旧插件及退役runtime的删除守卫保持有效。

## 守卫与下一步

`src/lib/governance/codexMethodProductScopeBoundary.test.ts` 验证完整identity/hash、状态计数、
owner/evidence、implemented的同名manifest，以及本轮合理能力保持待实施状态。
它不再禁止合理的TUI、搜索session、实时或导入能力。planned未实施前不登记fake manifest。

Plugin marketplace三方法、Environment、Queue、Project、Revert、Strict Review与MCP event
stream已有current合同；具体生命周期、权限和跨host产品证据继续归各执行计划，不能从
method计数推导完成。当前插件主线继续见 [插件重构](../../exec-plans/codex-plugin-reconstruction.md)，
按P04b11–15完成workspace权限、分享tar.gz、远端正文、真实Turn与三host验收。
其余合理能力按范围复审计划实施；Windows/live/packaged证据独立，不用macOS结果替代。
