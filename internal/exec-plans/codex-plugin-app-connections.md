# Codex 插件 Apps 账号链接与 OAuth（P04b13h）

状态：active / evidence；实现 0%。负责人 root，2026-10-18。
完整 CLI/Desktop、共享后端与 LimeCore 对齐仍 active。
前置：[逐技能消费链](codex-plugin-skill-preferences.md)。

## 目标与当前缺口

将插件所需 Apps 的账号授权读取、首次连接、重授权、回调恢复与技能启用接通。
当前 `src/lib/api/apps.ts`、App Server `local_data_source/plugin_catalog/apps.rs`
提供目录和运行时可调用投影；它们不是账号链接事实。
LimeCore `services/control-plane-svc/internal` 有 console OAuth 和 hosted connector，
本轮对该目录搜索 `aip/connectors`、`list_accessible`、`REAUTH_REQUIRED`、`oauth/reauth`
无匹配，不能据此扩大为全仓所有 OAuth 都不存在。
现役 OEM 账号登录桥的 payload 是 token/deviceCode 等，不能作为 Apps 链接回调复用。

本阶段先追清对标调用链，再修改 current owner。缺少源端证据的 DTO、回调交换和持久化
策略不得凭端点名称补齐；上游闭源服务端内部实现与本地设计选择分别标记。
本计划不新增 compat、旧插件迁移、独立 registry 或平行 runtime。

## REA 事实

目标：`/Applications/ChatGPT.app/Contents/Resources/app.asar`，
26.1007.30912/build20156，SHA256
`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
全部为原字节静态分析，未运行目标、请求上游服务或执行 bundle bootstrap。
压缩局部名称只用于定位，不作为 Lime 新命名。

前置证据：

| 原始链 | 已观察合同 | REA parent |
| --- | --- | --- |
| routes wa / Ea / Da / Ta、app-initial M6a | system link 或任一非 REAUTH_REQUIRED 账号视为已连接；M6a 先选显式 link ID，再选非需重授权账号，最后首账号；连接后核对账号才启用技能 | ev_cae426695b62cf3b8da08cdc83e078614843b7ef3250fa0050e6156694ebc161 |
| app-initial hHn→OGt/DGt | POST `/aip/connectors/links/list_accessible`；body 为 `principals:[]`、`link_refresh_strategy:"BLOCKING"`；query 含 account/user/productSku/策略，retry=false、staleTime=5分钟 | ev_f1aaac42507a412b4c5e7d1e28593dbf54009fe1141db2bfdbbf139fd63954a5 |
| use-app-connect-flow export n→R / lazy modal | connectingApp/options、forceInApp、pending OAuth resume；连接表单进一步分流 OAuth/MFA/API key/no-auth | ev_2b881400a9c7698733c8e19b36b20f858c893c67e95a59a0c61a87fbee28cf6f |
| app-connect-queries / modal-content | tos、mfa_requirement、siwc、link、GitHub installations 查询；不能把 GET link 当作创建 OAuth | ev_6a167e547d534968e4ddf215f20fc10514a14c3a5c321013e85dd197c1d9f169 |

技能门禁还需保留 wa 的实际组合语义：将 app_ids/materialized_app_ids 投影为 H 后，
`H.length>0 && !H.some(Ea)` 才进入连接流程，即存在任一已连接 App 可满足该消费者，
不是推测的 every/all 授权。连接目标选择是 `H.find(Ta) ?? H[0]`，优先选所选链接需
重授权的 App，随后取首 App；这与 M6a 在单个 App 内优先选正常账号是两层不同选择。
P04b13g 当前“有Apps即禁止启用”仍是暂时 fail-closed 缺口，不能当作此上游组合语义。

本轮沿 modal-content 的精确 import `app-shared aY→zqr / iY→Rqr` 恢复创建请求。
app-shared SHA256 `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245`。
原字节范围（UTF-8，右端不含）：Rqr `[5373964,5378390)`，
zqr `[5378390,5380346)`，Zqr `[5382392,5382484)`。
10 份函数原文提取与范围/摘要清单：
`/tmp/lime-plugin-app-oauth-start-complete-extraction.json`；REA parent
`ev_2b16a9e8fb1b940c1d4e5a75639f1f28848853e05a24abbf04ec77b9cda6bb4d`，
summary `ev_500dd8e99df53fd583ab3c5191ba3b1b2935076ccaf5c628f50a62918a506431`。
10/10 解析、7635 字节、parse failure 0、282 semantic unknown。

| 实际调用 | 请求体与约束 |
| --- | --- |
| POST `/aip/connectors/links/oauth` | connector_id/name/action_names/requested_scopes/callback_url/post_auth_url/link_params；扩展 install_attempt_id、条件 slack_team_id、requested_companion_connector_ids、siwc_login；传 expectedIdentity、AbortSignal 和产品头 |
| POST `/aip/connectors/links/oauth/reauth` | callback_url/link_id/post_auth_url/requested_scopes；missing_link 分支委托首次连接；link_id trim 后不能为空 |
| POST `/aip/connectors/links/oauth/callback` | `full_redirect_url` 为 trim 后完整重定向 URL；产品头由当前恢复上下文选择；响应消费 `link`、可选 `suggested_account_name` |
| POST `/aip/connectors/links/api_key` | connector_id/name/action_names/key/link_params/install_attempt_id；要求 expectedIdentity，retry=never；取消或缺 key 不提交 |
| POST `/aip/connectors/links/noauth` | connector_id/name/action_names:[]/install_attempt_id；保留 expectedIdentity |

同一函数另有 service_accounts 分支；不能把这些已观察分支永久排除在合理能力之外。
OAuth 响应消费 `redirect_url`，trim 后缺失则失败；onOAuthStarted 可 preventNavigation，
否则通过宿主打开。管理员停用、unsupported、缺少表单与取消有不同终态。
上述原字节确认调用意图；safePost alias 的 request relation 未恢复，0 relation 不等于无请求。

Zqr 通过 `app-connect-oauth-callback-url` 宿主请求取得 callbackUrl。
main `.vite/build/main-CqEoQDOU.js`，SHA256
`09d19386e1f23cf4ccbc950fc40d85a1e8a064a08be588b2a4be6a89f6ada9e6`，
原字节 `[1401234,1401312)` 的 handler 返回由 packaged 状态选择的 scheme，
路径为 `://connector/oauth_callback`。尚未核定 scheme 选择函数和完整 URL 分发链。

use-app-connect-flow 的 Wbn import 对应 app-initial pAn；其原成员 SHA256
`604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`，
pAn 原字节 `[2319885,2326019)`。它维护 OAuth state、callbackOwnerId、claimed/completed、
hostId、resumeTarget、插件/技能身份和 returnTo；拒绝无 state、未知 state、重复 claim 或
owner 不符。apps-tab 的 addAccountAttempt 分支另检查 account/user 与 expiresAt；不能将
该条件概括为所有 resumeTarget 都具有同一个账号/TTL 校验。plugin-skill 的恢复身份匹配
同时包含 pluginId 与 skillName。缓存持久化 owner 和跨进程恢复仍需追清。
本轮提取 4 个 pending 函数及 1 个宿主 handler，清单
`/tmp/lime-plugin-app-oauth-resume-extraction.json`；REA parent
`ev_10d68531d597c6abf8a1bc51011b566a4cc1a5a00c734d0aeb7a203f546d6d1a`，
5/5 解析、6479 字节、parse failure 0、468 semantic unknown。
主机 `.vite/build/*.js` 仅有界检查 callback 字符串，不据此称所有分发代码均已检查。

继续沿 pAn 的 `claimAppConnectOAuthCallback` 消费者定位 app-initial xAn，
原字节 `[2327015,2339832)`，提取摘要
`ea8253bc872b3b7f7014fd1682ea40eb16cf82a36014e419ea799dba903cdb77`（含文件尾换行）。
其调用上表 callback 端点，随后按 link.id 替换或追加 list_accessible 缓存，刷新 Apps/
插件 availability 等查询。只有 `success`、无 GitHub repository access 后续步骤、
持有 callback claim 且 resumeTarget=plugin-skill 时，才在再次核对账号后调用 uAn enabled=true；
技能写失败返回 request-failed，不把 OAuth 成功当作技能已启用。
管理员、未知/重复 state、账号变化、取消、scope mismatch、被后续操作覆盖等终态各有分支。
GitHub installation、companion connectors、service-account 与 elicitation 恢复另有逻辑，
不能由普通 plugin-skill 分支代替。查询失效不等同于已经观测到一次真实网络刷新。

同轮 QAn 的原始初始化明确注册 `app-connect-oauth-plugin-install-resume-by-state-v1`，
一个当前内存 atom 和一个 Fu(...) atom；Fu 底层存储机制仍未知。
OAn→RAn 以 URL.searchParams.get("state").trim() 取 state；这不是全 URL allowlist 校验。
提取清单 `/tmp/lime-plugin-app-oauth-complete-extraction.json`；REA parent
`ev_73addd7f27044c199ed4864f7787db9d4e76261d41b51a29a11191a3c3345def`，
summary `ev_729143acf3c22b02ed0bfe1d61f76042999d6423d5f8006d85aafe31859c33c5`；
6/6 解析、16277 字节、parse failure 0、894 semantic unknown。
仍未证明闭源服务端 token 交换、完整链接 DTO、原生 URL 分发或跨进程持久化行为。

准备纠偏：首次提取用 zqr.js/Zqr.js，在 macOS 不区分大小写的文件系统发生覆盖，
REA 只解析 9/10；该轮 parent ev_14c69696d06f01cdead25a68515ad3eabc24b763f385b0eff97cb999d73bd2a0
不用于完整证据。改为带序号的新目录，原件和失败说明保留，未篡改旧结果。

Codex 源码 HEAD 沿用本轮实读 4eb4a65407d98cebc4c83bf13be440b9fbc78a7c。
core-plugins remote.rs:1468/1908 分别确认 detail.skills.enabled 投影和暂不投影至 skills/list；
core/src/connectors.rs 的可调用工具发现不能代替上述 Apps 账号链接合同。

## 分步实施与退出条件

| 阶段 | current owner / 写集 | 退出条件 |
| --- | --- | --- |
| H1 补完证据 | 只读 ASAR；本计划 | 精确恢复 links DTO、metadata/auth 策略、宿主 callback 分发、state 交换/错误、链接刷新与 skill resume；每项有原字节和 REA ID |
| H2 Core 账号链接 | 既有 control-plane-svc controller/service/repo/model；OpenAPI fragments、SDK/types/API 文档 | tenant/user/connector 的唯一授权事实；创建/重授权/撤权/失败不污染状态；持久化成功才发布；响应、身份与包声明一致；闭源内部实现未知处明确写本地选择 |
| H3 共享消费边界 | 既有 App Server、cloud/request、共享 AccountManager；协议/client/gateway/catalog/fixture | CLI/TUI/GUI 共享账号、请求与投影；renderer 不持凭据；禁止以 callable 替代链接；远端技能偏好不写本地 config |
| H4 宿主与 GUI | Electron/preload/IPC 的原生 callback/open owner；插件 shared hook/control；五语言 | 连接、取消、错误、重授权、同一 state 的一次恢复；换号/退出/超时/重复 callback 拒绝迟到结果；重新读取授权后才启用原技能 |
| H5 产品与清理 | 定向测试和隔离产品门禁、两仓计划/架构 | 真实 Core→同一 App Server→Electron/stdio；后续 exec/PTY 独立；撤权、冷启、同包工具 Turn 和 tar.gz 安装独立证据；直接删除旧入口，无迁移或兼容 |

Verification Contract：P1/budget:normal。用户输入是插件/技能与所需 App identity，
结果是当前账号已授权且原技能成功启用；授权创建、浏览器跳转或 callback 到达均不单独
视为完成。失败必须有可见终态；无生产 mock fallback。不重用 console 登录 token 作为链接。
重大架构改变实施前同步 architecture §7.2 和本计划责任人确认；当前仅补证，无新 owner。

本轮分类：current 偏好链保持；Apps 链接/OAuth 是 planned gap；新增 compat/deprecated=0；
原插件 dead/deleted/forbidden-to-restore 基线保持。本阶段实现 0%，不能计作 OAuth 已支持。
