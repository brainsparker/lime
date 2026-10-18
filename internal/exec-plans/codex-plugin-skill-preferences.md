# Codex 插件逐技能消费链（P04b13g）

状态：implemented / bounded validation；完整 CLI/Desktop、共享后端与 LimeCore 对齐仍 active。
后继：[Apps 账号链接与 OAuth](codex-plugin-app-connections.md)。
负责人：root，2026-10-18。前置：[账号偏好](codex-plugin-account-preferences.md)。

## 证据与差异

REA 对象沿用 ChatGPT.app 26.1007.30912/build20156，ASAR SHA256
75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af。
普通消费者 wa 的来源、原字节和摘要见前置计划；本轮重新读取 retained item：
ev_acb68f70148c6233ba0aea36b25239f112af17c61ce9562fbe78e65a1dde0e06。
wa 不是可恢复的上游源码名称，不能照搬压缩名。

新增 REA parent ev_cae426695b62cf3b8da08cdc83e078614843b7ef3250fa0050e6156694ebc161，
summary ev_73782ca53039257c39c96f5e3d28895b3d1414c6e8feca4101c598ca311b882d；
提取清单 /tmp/lime-plugin-skill-authority-extraction.json。6/6解析、零失败，313 semantic
unknown。仅静态 AST，无上游运行证据。

| 上游原成员/绑定 | 已观察行为 | Lime owner / 差异 |
| --- | --- | --- |
| routes-2879a4fdfb21.js wa / app-initial Ybn→uAn | 无 body POST skills/{raw name}/enable或disable，已安装才显示开关 | pluginCatalog gateway；Core四端点已在P04b13f实现，GUI尚缺 |
| queries-8e44ea13992d.js export i→R，routes import br | invalidate插件、Apps list/link、plugin-settings-sync、系统提示和mounted-capabilities | fresh plugin/read，不写本地skills.config；Apps相关query owner仍缺 |
| routes Ea/Da/Ta、app-initial C8→M6a | system link或任一非REAUTH_REQUIRED账号即已连接；优先重授权连接；隐藏和implicit link归system | 当前app/installed callable不是授权，不可替代 |
| app-initial w8→k6a | app_ids与materialized_app_ids合并；未materialize模板不作为app ID | GUI门禁必须包含已materialize模板 |
| routes wa onConnected | 连接完成重新核对账号，然后才enable；管理员停用、pending和读取失败限制操作 | 当前无Apps连接消费链，启用需fail-closed，不能伪造完成 |

queries成员SHA256 2edc1a2f784deb95ae741010548e4ffcafb8095fed46bdaf3c70d6af6d755bfa。
其他原成员摘要、函数字节位置和提取摘要均在清单中；不执行目标bundle。
Codex源码core-plugins/src/remote.rs:1468从disabled_skill_names生成detail.skills.enabled；
1908明确暂不投影到skills/list，本轮不能将远端偏好写入本地skills.config。
源码HEAD实读：4eb4a65407d98cebc4c83bf13be440b9fbc78a7c。

后继Apps连接补证：routes cr→use-app-connect-flow-9f978ed1c732.js export n→R；
ar→app-connect-modal-f3759f423cb1.js export t→h。两份完整原成员提取清单
/tmp/lime-plugin-app-connect-extraction.json，REA parent
ev_2b881400a9c7698733c8e19b36b20f858c893c67e95a59a0c61a87fbee28cf6f，
summary ev_ba4fa5c3b35732c4cf803e629aeefc4cd539791045b341657b1ee5e96a64d7b2；
2/2解析、零失败、724 semantic unknown，无运行证据。
R持有connectingApp/options和pending OAuth resume上下文，forceInApp强制走连接表单；
连接前读取connector metadata并区分OAuth/MFA/表单；h按需加载真实连接弹窗。
OAuth创建/回调与lazy连接表单的全部网络合同尚未追全，不能照通用console OAuth猜实现。
连接查询进一步追到app-initial hHn→OGt及DGt：静态原字节是POST
/aip/connectors/links/list_accessible，body为principals:[]、link_refresh_strategy:"BLOCKING"；
账号与用户同时存在才启用，账号/用户/productSku/刷新策略进入query key，retry=false、缓存5分钟。
提取清单/tmp/lime-plugin-app-link-query-extraction.json；REA parent
ev_f1aaac42507a412b4c5e7d1e28593dbf54009fe1141db2bfdbbf139fd63954a5，2/2解析、
零失败、22 semantic unknown。该压缩safePost alias未被request matcher恢复，不将0条request
relation写成“没有请求”，也不将原字节静态调用写成网络执行证据。
已沿h的lazy import读到app-connect-queries-3a37097a03da.js和真实连接内容
app-connect-modal-content-a49dbdf77e00.js。提取清单
/tmp/lime-plugin-app-connect-queries-extraction.json；REA parent
ev_6a167e547d534968e4ddf215f20fc10514a14c3a5c321013e85dd197c1d9f169，2/2解析、
零失败、5191 semantic unknown。静态调用含connector tos、mfa_requirement、siwc、link及
github/has_installations；完整OAuth创建/恢复合同仍未追全，不按字符串猜DTO或服务端实现。

Lime/Core有界搜索：src/lib/api/apps.ts、插件UI、App Server apps/remote plugins和Core
model/controller/service；现役app/list/read/installed仅目录/可调用投影，未找到Apps link/OAuth
授权owner。Core console OAuth和hosted Dify/n8n connector不属于该能力。

## 写集与架构确认

窄写集：新remotePluginPreferences gateway及测试；pluginCatalog.ts仅提取已存在账号fence，
保留前轮实现；PluginSkillsSection.tsx、PluginSkillPreview.tsx、新技能偏好hook/control及回归；
五语言agent.json仅新增文案键；必要的现役Electron插件fixture及本计划。
追加scripts/lib/electron-fixture-build.mjs与测试：将PostCSS/Tailwind配置纳入renderer输入检测；
场景加入开关实际尺寸和弹窗fixed定位断言，防止缺样式产物只凭DOM交互过关。
只读Core（逐技能端点已实现）、Rust runtime、首页、CLI/TUI、发布与未知脏文件。
新增UI使用既有主题token，不改变主题、多模型和首页Banner的owner。

```text
PluginSkillsSection / PluginSkillPreview -> shared skill preference state
  -> typed gateway -> existing preload/IPC app_server_handle_json_lines
  -> cloud/request -> shared AccountManager -> Core preference service/repository
  -> plugin/read -> installed preference projection -> both switches
Apps links / OAuth -> gap (no callable/readiness substitution)
CLI/TUI -> same App Server / account / store (direct write entry still planned)
```

架构影响：非重大；复用P04b13f架构和公共协议，无新增跨层owner或协议。
架构图已更新：本计划细化既有消费链；architecture §7.2无owner变更。
责任开发者确认：root，2026-10-18，已核对目录、数据流、依赖和门禁。

## Verification Contract

budget:normal，P1。输入：已安装远端插件、raw技能名、enable/disable。
结果：成功后fresh detail更新卡片与预览同一偏好；pending期间不能重复写；失败保留状态；
刷新失败单独重试读取，不重复提交已成功mutation；换号含A→B→A丢弃迟到成功/错误。
管理员禁用不能操作；未安装仍可预览；插件整体停用不覆盖逐技能偏好。
带Apps的关闭仍允许；启用在真实Apps授权读取/连接owner落地前保持禁用。
该阶段限制是未完成项，不是上游行为或保留差异。

主链：GUI -> typed gateway -> Electron preload/IPC -> App Server cloud/request -> Core snapshot；
read model是plugin/read。无新Turn/tool/approval/event，不以偏好证明模型工具生效。
失败停于gateway/account/Core或fresh read，生产路径无mock fallback。

验证：gateway账号/HTTP/raw name回归；组件共享状态、fresh read/refresh失败、pending、管理员、
Apps门禁、账号/焦点/缓存/未安装预览与五语言；renderer typecheck、lint、完整test:contracts；
新隔离renderer构建后真实Electron插件场景和GUI smoke。
不以旧产物通过证明本轮UI；不以controlled issuer证明真实Core/MySQL/OAuth、Turn、exec/PTY、
Windows或packaged。默认verify:local按最终写集和并行状态记录实际执行或未跑原因。

退出条件：上述无Apps偏好消费链及回归有实际结果；Apps授权、CLI/TUI直接写入口、安装release
身份持久化和真实Core同包Turn继续在完整目标下推进。产品验证未跑或失败不能标verified。

## 实施与验证

代码已接通。已取得gateway/页面/预览/技能偏好5文件67项通过，完整test:contracts通过，
受影响TS lint及3份fixture no-undef零错误。Renderer typecheck、隔离构建与产品门禁执行中。
源码/构建/fixture清单归/tmp/lime-plugin-skill-preferences-*.json；证据不写回仓库.lime。
Renderer typecheck已exit0；最终TS lint、legacy report（边界违规0）通过。
默认verify:local尚未全跑：planner实际命中88个脏文件及未知并行Rust/首页写集，包含全前端与
Rust任务；无路径过滤，不能以空staged集合冒充全仓通过。范围证据
/tmp/lime-plugin-skill-preferences-local-scope.json；本轮使用认领边界验证和隔离产品门禁。

首轮新组件测试因vi.resetAllMocks重置共享账号fixture的readAccount mock而失败；改为仅重置
本文件的三个mock，随后13项通过，再扩展详情切换/刷新网络失败后与其余4文件合计67项通过。
首轮隔离构建缺少scripts/app-version.mjs，配置阶段失败；补齐后v2因对齐上游footer布局
主动终止（code=null，不计成功），随后构建v3，后继纠偏见下节。原日志均保留。
手工ESLint主fixture globals首轮漏sessionStorage/Event；最终使用既有globals包完整node/browser
环境，3文件零错误。没有放宽no-undef或修改产品逻辑。

### 产品验证纠偏

v3构建exit0、8m19s，WORKSPACE/GLOBAL功能场景均exit0/ok=true，但目检两张技能启停截图
发现隔离副本漏带PostCSS/Tailwind配置，页面utility样式缺失。两份summary不改写；新增
各自visual-review.json明确fail，不作为GUI视觉通过。本问题是验证副本准备错误，未修改产品
CSS以掩盖。原副本/tmp/lime-plugin-skill-preferences-isolation.json保持不动。

已新建独立styled副本，补齐postcss.config.js/tailwind.config.js并冻结其摘要；v4构建exit0、
1m49s，freshness全部通过。新的source清单13项、执行依赖36项、产物317项，清单为
/tmp/lime-plugin-skill-preferences-styled-isolation.json、-styled-harness.json。
旧副本不覆写，不把317项与前轮累计4,754项的旧目录内容混算。
输入检测新增2项回归，受影响build helper整文件35项通过；scripts governance通过。
新产品场景执行中，退出前须收取summary并目检新截图。

v4带样式WORKSPACE场景exit0/ok=true，包含新增实际尺寸/fixed断言；两张技能截图已目检，
utility样式恢复。目检另发现header三个直接flex子项令开关居中，最终将开关/关闭归为右侧动作组；
截图使用animations:"disabled"，避免捕获过渡中间态。产品仅调整既有headerActions接线，
预览/偏好两文件29项最终复跑通过。新建v5独立最终副本，不覆写v4产物或已用source/harness。
最终副本清单/tmp/lime-plugin-skill-preferences-final-isolation.json，待收最终产品结果。

### 最终固定产物验证（2026-10-18）

v5 最终构建 exit0、4m12s，freshness 通过。首轮 WORKSPACE 的正文预览在 error→retry→
empty 后按 Escape，120秒内未 detached；未进入本刀技能偏好场景。原 summary/failure.png
保留在 `/tmp/lime-plugin-skill-preferences-final-electron-workspace`，不计通过。
没有将关闭改为 click、自动重试或延长 timeout，也没有修改产品代码猜测修复。

新建诊断副本，产品13项与317产物完全相同，仅测试 helper 增加键盘 capture。
WORKSPACE/GLOBAL 均 exit0/ok=true；观察到 trusted Escape，未 preventDefault，dialog 关闭。
记录为各目录 `skill-preview-keyboard.jsonl`。此结果不能确定首轮根因。
随后清除仓库临时诊断，并移除它留下的 closePreview 包装，恢复与 v5 清单相同的 helper；
未改变原一次按键与 detached 断言。原始无诊断 v5 再跑 WORKSPACE exit0/ok=true，
证据 `/tmp/lime-plugin-skill-preferences-final-uninstrumented-workspace/summary.json`。
首轮 Escape 失败仍是未定位可靠性风险，不宣称已修复。

最终诊断两组证据：
`/tmp/lime-plugin-skill-preferences-diagnostic-electron-{workspace,global}/summary.json`。
WORKSPACE 验卡片/预览同值、实际启停、失败保留、stdio fresh read 与焦点；
GLOBAL 验真实 bridge 下的 Apps 启用门禁；均含账号隔离、reload、cold start、卸载。
两张最终启停截图已实际目检：右侧动作组位置、switch 终态与样式正确。
这是 controlled Core-shaped issuer、backendMode=unavailable、modelTurn=false；
不是实际 Core/MySQL、Apps OAuth、模型工具 Turn、exec/PTY、Windows 或 packaged 证据。

固定产品执行 `LIME_ELECTRON_SMOKE_EVIDENCE_DIR=... node scripts/electron/smoke.mjs`
exit0，summary `/tmp/lime-plugin-skill-preferences-final-gui-smoke/summary.json`，
24/24 通过。覆盖真实 Electron、reload、preload/IPC、App Server 初始化、Settings 与
1536×960/1280×800/980×680 几何检查；三张截图已目检，无必需节点越界。
不计作 Codex 像素一致；1536截图的首页 Banner 未显示，不能由 shell 几何成功核销首页
视觉和加载稳定性，该区域不在本刀写集。

完整 `npm run verify:gui-smoke` 曾在独立副本尝试，因缺少
scripts/check-app-version-consistency.mjs 在构建准备阶段 exit1，日志
`/tmp/lime-plugin-skill-preferences-final-gui-smoke.log`。缺失依赖已补到该独立副本，
但未将未执行的后继完整重建写成 green；固定317产物的直接 smoke 与此失败分开报告。
全仓 verify:local 未跑原因沿用上文并行脏写集，无新增产品逻辑或 Rust 变更。

最终审计 `/tmp/lime-plugin-skill-preferences-final-audit.json`：13输入与工作区一致，
v5 36项执行依赖与工作区一致，v5/诊断各317产物逐项零漂移；诊断副本的 helper 差异
为唯一已记录测试诊断，未回写仓库。App Server SHA256
240870bb1f80bdd568f2d7bf88336dbae06cfb2d6b246dd3a4b66b80eeaf0632。
本轮补证见后继 Apps 计划，不把 static AST 的 OAuth 请求体当作服务端已实现。

### 分类与完成度

current：共享 remotePluginPreferences、已安装无Apps技能偏好消费链与五语言控制；
compat/deprecated：本刀新增0；dead/deleted：临时按键诊断已清理，原插件删除基线维持。
Apps授权仍 planned gap，保持 fail-closed 不是最终对齐行为。
有限实现完成；验收按7项计：gateway raw/身份、fresh read/失败、pending/代际、
五语言/管理员/未安装、Apps限制可见、两scope Electron/stdio 六项已验；
完整默认门禁与首轮可靠性问题未关闭，6/7（86%）。该百分比只用于本刀验收，
不代表 CLI/Desktop/Core 全量目标；Apps实现为0%，真实Core同包Turn、release安装身份、
CLI/TUI直接偏好入口、tar.gz完整交付与平台/打包验收继续由总计划持有。
