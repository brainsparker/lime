# Codex 合理能力范围复审与实施

状态：active。责任：root。日期：2026-10-18。主目标：完整对齐。

用户要求合理能力全部对齐；当前缺少GUI消费者、领域实现或产品入口，属于实现欠账，不能据此
永久排除。开发期直接替换旧实现，不迁移旧插件、不恢复已删除runtime、不建立兼容包装。
当前插件实施顺序仍见 [插件重构](codex-plugin-reconstruction.md)，本计划补全其外的协议范围。

## 本轮窄写集与事实源

只认领本计划、method scope fixture、对应范围矩阵和范围守卫；为消除同一裁决的矛盾引用，
同步commands/architecture中的对应范围段落、v1导航/第三轮审计与projection守卫的分类口径。
LimeCore仅同步其插件计划的
范围引用。复用已有Codex源码与REA证据，不重新提取安装包、不触碰CLI/TUI、专业预览、发布、
runtime/protocol代码或未知并行写集。冻结的245个方向化identity、上游revision与hash均不变。

上游源码：`codex-rs/app-server-protocol/src/protocol/common.rs`、`protocol/v2/` 与对应
`app-server/src/request_processors/`。Bedrock的具体证据为
`account_processor/bedrock_setup.rs:25`：实际发现AWS profiles、区域和环境凭据的存在性，
并通过当前config设置provider；并非仅有OpenAI内部账号服务，因此此前整组排除理由不成立。
源码只证明合同和静态行为；不冒充Desktop运行证据或Lime已实现。

## 范围更正

本轮把46个identity从excluded改为planned；原有10个planned保留，结果为174 implemented /
56 planned / 15 excluded。implemented只说明已有同名manifest及owner，不等于行为、字段、
恢复、GUI/CLI/TUI和真实产品证据已完成。此245项是冻结方法基线，不涵盖其后的新方法、
tar.gz格式、工具/组件生命周期或全部桌面交互，不能把174/245当整体完成率。

| 合理能力 | 本轮重开identity | 现役owner与退出条件 |
| --- | ---: | --- |
| 无内容进程诊断 | 1 | App Server诊断；三host读取同一进程事实，脱敏、有界、不泄漏凭据/对话 |
| 配置requirements | 1 | core config + App Server权限；相同策略层参与admission/readiness，GUI/CLI均可读 |
| MCP外部配置重载 | 1 | 现役config + tool-runtime MCP；重读同一配置并失效同一连接，无第二配置库 |
| 外部Agent配置与历史导入 | 6 | App Server导入 + thread-store；detect/import/history/progress/completed同一事务与canonical投影，不恢复旧插件迁移 |
| 模糊文件搜索session | 5 | App Server文件搜索；session取消/完成/迟到响应及host消费，复用现役扫描owner |
| 实时Thread音频/语音/文本 | 14 | App Server Thread/Turn + model-provider + voice-core/media-runtime；输入输出、transcript、取消、错误与恢复均有真实transport证据 |
| 账号控制、Bedrock、usage/limits及通知/refresh | 9 | AccountManager + model-provider + LimeCore认证控制面；取消登录/通知、AWS profile与环境发现、refresh失败及限额来源明确，不伪装ChatGPT token |
| 反馈提交 | 1 | App Server诊断/反馈；用户显式触发，预览/脱敏/失败终态，当前任务不发送反馈 |
| 远程控制配对与撤销 | 8 | app-server-client认证transport + LimeCore runtime registry；配对/状态/撤销与租户隔离，共用同一runtime |

另外10个planned为完整account基础合同4项、plugin/share五项及plugin/skill/read一项，继续由
插件重构计划承接。上述owner是实现归属，不是新增平行服务的许可。

保留excluded的15项：deprecated/legacy通知与请求9项、test-only mock一项、上游专属计费
操作两项、专属attestation一项、绕过canonical投影的内部raw response通知两项。实现具体
能力时仍须复核上游状态；不能以改名冒充同一合同，也不能因本地缺失扩大这份排除清单。

## 实施顺序与验收

1. S01 范围纠正：更新fixture、重算状态计数、删除旧禁止合理能力的守卫和矛盾文档；保留
   identity/hash/已有current合同守卫。只做分类，不添加空handler或fake manifest。
2. S02 依赖与证据：每个planned能力继续追到当前Codex handler/状态/持久化事实，必要时复用
   或补REA包/运行证据；给现役owner写Verification Contract及失败终态。先插件P04b11–15，
   然后账号/配置/MCP/导入，再搜索session、实时与远程控制；诊断/反馈随其依赖落地。
3. S03 垂直实现：协议、同一owner、全部消费者、schema、config及两仓契约一同修改；重构或
   删除冲突旧路径。只有exact shape/lifecycle与定向回归完成，才从planned改implemented。
4. S04 产品验收：共享App Server的真实stdio、Electron/preload/IPC、lime exec和PTY；按能力
   补授权/工具/真实Turn与冷启恢复。Windows/live/packaged单独验收；无原件不记通过。

Verification Contract：root，P1/budget:normal。本轮为范围与规则纠正，验证完整245项identity
唯一性/hash、状态计数、evidence路径、current manifest一致性与合理能力不得因缺消费者而
再被排除；执行范围守卫、docs boundary与窄写集format/whitespace。没有runtime产品代码
变化，不重复全量Rust或Electron。新增能力均为planned；不把规则修订计为产品完成。

S01结果（2026-10-18）：fixture重开46项，计数174/56/15；冻结245项identity/hash不变。
范围守卫14/14及projection守卫5/5合计19/19通过，含固定上游schema与inventory复核；
docs boundary、定向Prettier和窄写集diff检查通过。同步删除commands/architecture/v1导航和
第三轮审计中的矛盾范围描述；projection守卫将尚无接线与永久排除分开，不改生产projector。
当前规则分类为current，无新增compat/deprecated，旧插件与退役runtime保持dead/deleted/
forbidden-to-restore。S01计划内验证完成100%；新重开46项的本轮产品实现0%，均为planned，
整体active。此规则变更不重复Rust/Electron，也不核销既有产品证据缺口；继续S02/S03。
