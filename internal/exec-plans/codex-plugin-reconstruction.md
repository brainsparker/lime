# Codex 插件重构与 LimeCore 联动

状态：active。责任：root。日期：2026-10-18。

当前阶段：[P04b13h Apps账号链接与OAuth](codex-plugin-app-connections.md)，证据定位中，
实现0%。REA已沿原生import定位首次OAuth/重授权请求、宿主callback地址与pending claim；
回调提交full_redirect_url并消费link、核对账号后恢复技能写入已补证；完整链接DTO、
原生URL分发和持久化恢复仍待追清。不得用callable readiness或console OAuth冒充授权。

[P04b13g 逐技能消费链](codex-plugin-skill-preferences.md)已接共享cloud/request、卡片/预览
状态、fresh detail、失败恢复与账号代际。67项定向、35项构建守卫、contracts通过；固定
产物WORKSPACE/GLOBAL Electron＋stdio及shell smoke24/24通过，13输入/36执行依赖/317
产物审计无漂移。首轮Escape失败根因未定；完整npm门禁曾因隔离准备缺脚本失败，不冒充
命令通过。有限验收6/7（86%），完整目标仍active，带Apps启用仍待真实授权owner。

P04b13f合同7/7已验：Core三层包测试/race/vet、网关9项、五语言页面26项、SDK/目录9项、
两仓contracts、WORKSPACE/GLOBAL真实Electron＋stdio与GUI smoke24/24通过；
4,754项冻结产物无漂移。重装已按Codex原生硬校验重新启用；首轮冷启切回的网络失败保留，
v2/Global同产品通过但根因未定。普通技能UI/应用授权、release安装版本、实际Core进程/
MySQL到Turn及CLI/PTY/Windows/packaged仍未核销，详见专项计划，不以切片100%替代完整目标。

完整范围另见 [合理能力复审](codex-method-scope-reassessment.md)：已将46个因缺消费者/实现而
误排除的identity恢复为planned；固定基线现为174 implemented / 56 planned / 15 excluded。
该计数不是产品完成率，本插件计划不能替代实时、配对、导入、配置与账号等其余合理能力。

验收范围：Codex 的合理公开行为全部进入对齐清单，包括协议、配置、组件发现、安装/更新/
卸载、远端授权与共享、同一运行时消费、历史恢复、tar.gz 交付和各产品面的真实验证。
实现顺序不缩减范围；每项差异必须记录源码/REA 依据、current owner、退出条件和证据，
不能用“暂不支持”永久核销。开发期直接替换和删除，不增加旧插件迁移或兼容链。

## 后续完整范围（不按缺实现排除）

| 阶段 | current owner / 下一步 | 退出条件 |
| --- | --- | --- |
| P04b11 目录与分享权限 | Core catalog/release/tenant-policy + 认证用户/租户事实；App Server plugin_remote canonical identity | GLOBAL/USER真实目录、workspace shared/private/unlisted/vertical、creator/targets权限、稳定opaque ID及缓存冲突拒绝；禁止以空目录或品牌改名冒充权限实现 |
| P04b12 分享与tar.gz出站 | 同一Core发布/包owner + App Server插件store | share save/list/updateTargets/delete/checkout、50 MiB上游分享归档合同、无凭据下载/签名上传及失败回收；checkout不另造registry |
| P04b12d2 分享链接解析与导航 | Core现役catalog/ACL + Lime现役详情导航 | 认证share key解析为授权plugin identity，进入真实详情；403/404/撤销后不可用；直接替换API详情地址，不用复制成功核销链接产品路径 |
| P04b13 远端正文与完整DTO | 同一release组件owner + App Server typed projection | plugin/skill/read读取未安装插件的授权正文；完整嵌套release/connector/App template/scheduled task、prefer-cache/forceRefetch语义；保留上游尚未消费per-skill状态的边界 |
| P04b14 同包进入真实Turn | Core实际发布进程 + 共享AccountManager/App Server/RuntimeCore | 同一包经发布、授权、安装、刷新、工具消费、撤回及冷启恢复；真实provider或明确受控provider请求捕获，不能只读目录/卡片 |
| P04b15 三产品面与交付 | Desktop Host / CLI-TUI Host，共享协议/runtime/store | 新产物stdio、Electron/preload/IPC、lime exec、真实PTY输入/alternate screen/终端恢复；Windows/live/packaged独立验证，全部证据原件可复查 |

源码依据：Codex core-plugins/src/remote.rs、remote/share.rs（上传URL/权限/分享50 MiB归档）、
remote/share/checkout.rs、remote/remote_installed_plugin_sync.rs、app-server-protocol/src/protocol/v2/plugin.rs。
Core的creator/scope事实、GLOBAL/USER目录和vertical已由P04b11a补入同一catalog/release owner；
下一刀补workspace真实分享授权，不能仅改客户端flag。旧插件42项删除基线及回流守卫继续保持；
本表不引入迁移、compat或第二套业务后端。完整CLI/TUI/runtime/GUI其它合理行为继续由各自
现役执行计划持有，本插件阶段顺序不缩减原始全量目标。

## P04b13 远端正文与 DTO（共享正文专项已验，完整目标active）

Codex app-server-protocol/v2/plugin.rs:269–280确认plugin/skill/read输入为
remoteMarketplaceName、remotePluginId、skillName，输出contents可空；core-plugins/remote.rs:
1399–1435使用认证GET ps/plugins/{id}/skills/{name}，URL逐segment编码，响应plugin_id与name
必须同时匹配。Lime下一刀在同一App Server插件owner与Core release/package读取合同补齐，
允许未安装的授权正文；不借renderer本地文件、下载URL或第二registry实现。

远端嵌套release字段继续逐项核对，不因当前DTO有同名字段就判已对齐。Codex远端wire接收
app_templates及unavailable_app_templates alias，包含connector/materialized IDs/reason；Lime
已有canonical字段，当前alias修正见P04b13b，服务端完整消费者仍需核定。上游catalog_cache明确标记将退役，
3小时磁盘缓存属于参考实现细节；forceRefetch/prefer-cache的可观察行为、账号/scope隔离与
撤权安全仍必须对齐，不为模仿该内部实现增加第二缓存owner。不得据此核销P04b13。

已从Codex core-plugins/remote.rs:626–658与Lime plugin_remote/wire.rs:140–175核出
三项原始差异（P04b13b已修，公共JSON回归已通过）：

| 输入字段 | Codex当前接受 | Lime原始差异（本轮已修） |
| --- | --- | --- |
| release.app_templates | 接受当前wire别名unavailable_app_templates | 尚无此serde alias |
| release.keywords | 缺字段时默认空数组 | 必需Vec，缺字段会反序列化失败 |
| interface.default_prompts | Option<Vec<String>>，接受显式null | 默认Vec只覆盖缺字段，显式null会失败 |

这些是当前Codex wire接收合同，不是恢复旧Lime兼容入口。Core当前输出keywords且空
default_prompts使用omitempty；既有成功夹具不能据此证明客户端接受上述输入。本刀已补
实际JSON解码/投影回归，结果见P04b13b，不以同名字段或单个Core响应判定完整DTO已对齐。

续查发现第四项独立DTO缺口：Codex core-plugins/remote.rs:1473–1494根据installed的
disabled_skill_names计算逐技能enabled，app-server/request_processors/plugins.rs:2326–2336
原样投影；Lime runtime/plugins/remote/projection.rs的远端元数据统一enabled=false，只有
已物化本地详情覆盖后才有实际值。上游此字段不等于插件安装或runtime readiness，正文预览
不能依其false阻挡未安装技能。逐技能偏好读面与local overlay的一致性仍需在同一installed/
store owner补齐；Core尚未提供偏好编辑时默认空数组不意味着完整偏好已实现。本发现不由
三项wire修正或正文RPC核销，也不为GUI另造启用策略。

### P04b13 Desktop REA 定位补记（只读，2026-10-18）

按用户要求先定位对标实现，再确定补丁。实际安装包仍为26.1007.30912/build20156，
app.asar SHA256 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
从同一ASAR提取四个新模块原字节，REA parent
`ev_3ce04eef802e6a20a4e15356fa068615f1d6f271b01ff3b3aed4ba2ab8c09606`，summary
`ev_d475ac65c8cc04527c1cc9f728cf2f2410568754329a51ca46dc2815ee302362`：
4/4解析、8271字节、110 findings、parse failure 0；语义unknown/557 unknowns。
`plugin-skill-preview-a6e4e2401612.js` 原字节SHA256
`1b79ebde4a70c273dc9944a33391cfc9c8fb125fecc96159d6a5006714126c28`，
其静态代码按pluginId/skillName查询，读取skill_md_contents，分别呈现加载、失败重试、
空正文和Markdown；转交onCloseAutoFocus与shouldBlockExternalEgress，不以错误伪造空正文成功。

继续沿静态import定位`queries-8e44ea13992d.js`，原字节4865B、SHA256
`2edc1a2f784deb95ae741010548e4ffcafb8095fed46bdaf3c70d6af6d755bfa`。REA parent
`ev_aadf397363c4f8638228ad120c4873b7694f1904a7836255326cef3de56a57dd`，summary
`ev_88f898e9a5f62830eb85575d6ddd51062140456ffc3ce1978c5d4f3c14589d75`：
1/1解析、48 findings、parse failure 0；语义unknown/239 unknowns。原字节偏移3124附近的
safeGet为`/ps/plugins/{plugin_id}/skills/{skill_name}`，includeDownloadUrls=false，
403/404为预期错误，传AbortSignal；query key包含账号、插件和技能，账号存在才启用，
staleTime为FIVE_MINUTES，retryOnMount=false。这是Desktop此构建的静态策略；Lime需在
共享App Server owner实现同一授权正文能力，不照搬renderer持凭据HTTP或另造缓存owner。
身份状态另由原字节核对：query导入app-shared的tyt，export为gQ；app-shared SHA256
`607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245`，export偏移8123732、
偏移5421257附近将该状态与accountId比较并抛出账号变化错误，偏移5444266附近还与
r.accountId对照。账号含义依据这些显式消费者推导，未把不明压缩变量名直接猜作账号。

REA literal trace `ev_d8ecf98d0aa51f32135218c634ceae6d4d198f671ba4fc5ca2cbc187617b1791`
为no-match，未恢复safeGet动态包装到网络的图关系；不能据此称接口不存在，也不能把
上述静态原字节核对冒充运行观察。与CLI源码GET合同相互印证，仅确认请求/显示设计，
尚未执行Codex、未观察服务端授权或真实缓存撤权。定位时LimeCore public_client.go仅有
目录/分享/安装路由；后续P04b13a复用clientPluginReleaseByID授权与
verified package owner，不能借用独立Service Skill或本地安装路径绕过授权。
Core现役selectPluginPackageManifest与extractPluginPackageSkills已持有manifest优先级、
声明根目录、递归/去重和frontmatter默认名；后者返回namesByPath映射。正文必须复用这些
发现事实按声明技能名定位，不能猜成固定skills/<name>/SKILL.md或重新维护另一技能索引。
原件、manifest与REA摘要在`/tmp`对应的系统临时目录
`lime-plugin-skill-desktop-fTi7vn/`；original与request分别冻结，不修改已分析字节。
本补记不计实现完成、不修改方法完成计数。

### P04b13a Core 技能正文（本地服务端切片已验，客户端结果见P04b13b）

root，2026-10-18。基于上节同一 REA 请求模块与 CLI 源码，先补 Core API 接入文档和
Verification Contract，再实现认证 `GET client/ps/plugins/:pluginId/skills/:skillName`。
raw 响应使用 `plugin_id/name/skill_md_contents` 及既有 description/interface，未安装可读。
current owner 为同一 catalog/release/ACL、verified upload/store 和 metadata scanner；
技能根选择从原组件摘要流程提为两处共用 helper，正文按 namesByPath 定位，不造第二索引。
普通包及分享包校验状态、hash、manifest、身份和选中 release 后返回原始 UTF-8 SKILL.md。
未知、不可见、撤回和当前策略禁止时拒绝；托管包损坏报500。外部非托管且正文不可得时
显式null，是基于公开nullable合同的本地设计，闭源服务端内部行为仍未知；不拉外部URL。
仅接受省略/单个includeDownloadUrls=false，永不签发下载URL；成功响应no-store。

窄写集在Core现役插件service/model、controller/responder/精确GET授权、定向测试、
OpenAPI source fragments及正式bundle、SDK/types与API文档；Lime生产源码继续冻结。
SDK既有JS的新增方法由已安装TypeScript transpileModule生成后仅插入对应区块，不新增镜像。
大文件仅机械注册，正文业务为独立模块。结构应用KISS/DRY：复用既有授权、包和技能发现，
未引入新的registry、runtime、兼容或迁移。

验证：定向service/controller通过，SDK/安装/目录10项通过，SDK/types严格typecheck通过；
bundle一致性及现役OpenAPI controller门禁通过，全bundle重复键/1148处本地引用及nullable
合同检查通过。首轮漏responder与token route、测试重复创建enablement及SDK夹具缺JSON
Content-Type，已按真实边界修复，失败不计green。仓库级make verify-go exit0，含Go基线、
格式、全部模块vet与tests；make verify-client-contract-sync及Core legacy-report exit0。
证据为/tmp/limecore-plugin-skill-{go-final,sdk-final,typecheck,openapi-parse,contracts}.log。
上述是本地Go HTTP/隔离repository+真实包文件证据，不代表Core部署进程/MySQL、客户端
plugin/skill/read/GUI消费或同包Turn。P04b13整体、三项wire差异及完整目标仍active。
架构图确认：root，2026-10-18，沿现有目录授权与包owner新增只读投影，无第二业务后端。

### P04b13 原生 Desktop 技能卡片与 RPC 预览证据

在同一ASAR继续定位原生插件页面的入口，不能把浏览器来源弹窗等同于全部Desktop路径。
新REA parent `ev_ac8dd0b6c03a9361688acd6194469aa4a6a73e9357aaef2f70da13fce4ba1f61`，
summary `ev_0b180ab96dbe149bdc1a2ebcf53ec03a26242f549fb8ca3bd40b666880715a8d`：
两个原始模块55023B、2/2解析、231findings、parse0，语义unknown/3359unknowns。
`skills-2f34a0e689e2.js` SHA256
`ec2642e82142b7304dfeafb3812abefe43d788b8e013d909349f915fc84f0427`（48935B），
其插件技能卡片传remotePluginSkill、version、skillPath；仅remote source构造
remoteMarketplaceName/remotePluginId/skillName，展示名优先interface.displayName，
其次技能name最后的冒号段。`skill-details-4953fb61389a.js` SHA256
`75b2044d70514768911d7c06a6bdd89c8383e0ebbf0a0349b3a546b57665c765`（6088B）另属
skillData/Showcase权限与文件流，只复用Markdown显示组件；不能由此推断它就是插件正文后端。

沿skills模块的app-initial导出Xi定位Jil（顶层导出；同字母存在其它内层导出，不混用）。
原始`app-initial-6350d04672d0.js` SHA256
`604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`，11440241B。
用现有Acorn只解析Iil/Jil起始表达式边界，冻结原字节函数范围；不是重写/模拟函数。
Iil字节[10949222,10951151)，SHA256
`b5cfaed124991dc805566a063b5f495b7aad501e3ceb5ad02e7aec566655d220`；
Jil字节[10956942,10959075)，SHA256
`72d100303f98f03f6200cd3acbbdf97b7dfeb935b8ae9db61e8273eb0236597f`。
范围REA parent `ev_746b896f0a3a2540fbb74f421ed908221971094d3fbfe7ce5c7736d4073d5f83`，
summary `ev_8d3f1ca679bdf436fa2e0641adc09132c3368281d0932b9edafe444aeb240960`：
4062B、2/2解析、parse0、findings0；语义unknown/297unknowns，外部imports/closures未包含。
原字节明确一条远端分支发送`sendRequest("plugin/skill/read", remotePluginSkill)`；
query key含host/market/plugin/skill，5分钟staleTime。存在本地path时优先read-file，
另有由Pp(hostId)选择Hil的分支，其含义与后端此处未知，不泛化为所有host都只走RPC。
Jil仅在打开且有本地path或远端identity时启用，显示loading/error/empty/Markdown；contents
与preview有不同正文投影，还可展示includedFiles。不得把浏览器预览的retry UI直接套成
原生此分支已有同样重试按钮，也不假定本地路径授权可替代远端读取。

原件、source-range manifest、完整REA摘要在系统临时目录
`lime-plugin-skill-entry-desktop-p0XAqA/`；original与native-preview-functions分别冻结，
readable仅作派生阅读。未执行Codex，未恢复所有动态网络/host分支；这是静态定位，
不记运行成功。下一刀按此证据补共享RPC、账号fence及GUI技能预览，Core不再造第二后端。

host选择分支续查：app-initial导入app-shared的mq为Pp；后者export为U2，原字节UTF-16
偏移5420185为`return e===kM`，偏移1858452附近初始化kM为`durable`。这些是同一hash成员
的静态字面量核对，不能推断初始化或分支已运行，也不能把durable任意解释为全部远端host。
Hil精确原字节赋值范围[10952097,10953041)，944B、SHA256
`ada1a2f7734deb8c335a0ce3f37f06fe7228c10d5b5d5722cb8fa5eea5eecd7f`；REA parent
`ev_fd4bc664d2918ceb4b86a56ab522120281898266d9a9fc07f2e047eb165e2c3d`，summary
`ev_c01f5d2ed06d97c398498fb7d097683ce6b644c280a6998e17e5f6a640fe2b0f`，1/1解析、
parse0、findings0、语义unknown/43unknowns。该分支也是认证GET正文，带AbortSignal、
includeDownloadUrls=false，401/403/404清query cache后继续抛错，retry=false；请求前后
比对两份身份状态，状态具体含义尚未沿外部闭包核定。响应消费skill_md_contents及可选
included_files，后者在展示参考文件时被使用；其服务端选择规则、完整DTO与服务端实现尚未知。
新增P04b13正文参考文件义务，不能以当前Core纯正文接口或CLI仅contents的合同核销，
也不凭包目录猜出included_files返回。函数及manifest/REA摘要在同一临时目录的独立
durable-preview-query中，未修改已分析的其它树。

参考文件与正文投影继续定位：同一app-initial的十段原字节函数（3855B）经REA解析10/10，
parent `ev_2d2bafac2b1d100aeb5db911eff0b3c7c3821ffed039e7c0653c052fc1a9016c`，summary
`ev_c5fba03508b9169a7be49fc4092a1ab8c2aafc44a9396a641c09b05c30775025`；findings0、parse0，
语义unknown/304unknowns，外部闭包未包含，未执行Codex。Yil/Qil只筛选relative_path以
`references/`开头的项，Zil去掉该前缀显示文件名，Xil原文明确列表不能打开文件。
这只确定renderer选择和显示，不证明后端如何生成included_files或完整DTO。
Pil剥离开头frontmatter，Iil先将CRLF转LF；Lil在存在expectedTitle或可解析path时移除
正文开头的一级标题，未观察到与标题文字比对。contents模式则保留原正文。
原件与source-range/hash manifest位于系统临时目录`lime-plugin-skill-reference-u4Prhh/`
的exact-ranges和exact-manifest.json。首次抽取在大小写不敏感文件系统中发生zil/Zil文件名
冲突，已弃用original-ranges证据；现役十段使用数字前缀独立文件并逐字节核验，不改原函数。

### P04b13b 共享正文接线与验证合同（本地切片已验，完整目标active）

P04b12d1分享专项已通过，普通壳门禁的独立首页布局失败见下；现在认领以下窄写集：
protocol插件类型/Method/envelope/schema注册、processor插件入口与accountAuth调度、
RuntimeCore插件remote owner和plugin_remote wire/Context、正式schema/TS生成、typed
app-server-client与renderer gateway、方法catalog/fixture及五语言GUI技能卡片/预览。
新RPC严格采用Codex PluginSkillReadParams/Response；Core raw字段仅在共享Rust边界转为
contents，不让renderer持凭据、直接调Core或从下载URL取正文。remote-only能力不为本地
data source添加空成功实现；不存在的本地skillPath不得用假路径占位。

Verification Contract：root，P1/budget:normal。未安装远端技能卡片 -> typed gateway ->
真实Electron/preload/IPC或stdio -> plugin/skill/read -> 同一账号Context -> Core形状认证HTTP
-> 匹配plugin_id/name -> contents投影。失败终态覆盖错误身份、404/500、null、超时与
换号迟到响应，不能把错误转换为空正文；同一账号切换丢弃旧内容，重新打开定位不串技能。
GUI按原生REA证据呈现loading/error/empty/Markdown，恢复关闭焦点；支持重试的本地设计
需明确验证，不冒称原生Jil已有同款retry按钮。Core真实进程与受控HTTP分别记账。
先Rust领域/公共JSON-RPC、DOM/五语言及typed gateway，正式生成和完整contracts；再真实
Electron及literal verify:gui-smoke。CLI管理和浏览器投影不替代exec/PTY，完整Turn另验。
同轮处理已核出的三项wire解码差异，补实际JSON输入回归；不为当前Codex alias重建旧Lime
兼容层。产物前后摘要和源码冻结检查必须可复核，不使用已删除.lime/qc中的旧binary。

实施记录：共享RPC的nullable DTO、Method/envelope/schema/AccountAuth注册、processor及
RuntimeCore远端读取已接线。业务逻辑独立在remote/skill.rs，不给本地datasource增加空实现；
Context逐段编码并校验双身份，HTTP错误不带issuer正文或签名URL。keywords缺省、
unavailable_app_templates别名与nullable default_prompts三项已修，公共JSON输入回归待收。
GUI以PluginSkillsSection/PluginSkillPreview替换只读span，优先现役fs/readFile，remote-only
使用typed gateway；enabled/installed不作为授权正文开关。五语言、加载/空态/失败/重试、
关闭取消与焦点、账号变化立即隐藏和迟到隔离均有DOM回归。共享Markdown helper按REA收紧
开头frontmatter识别、归一CRLF，并在有expectedTitle时剥离开头一级标题，不比较标题文字。
retry是明确的本地恢复动作，不声称Jil已有该按钮。未新增contents切换/参考文件假数据。

精确写集另冻结于/tmp/lime-plugin-skill-client-before.json；除上表协议/边界注册外，新增
remote/skill.rs、remote_plugins_jsonrpc/skill_reads.rs、PluginSkillsSection/PluginSkillPreview
及其测试、pluginSkillRead.test.ts、现役remote-plugin-catalog-fixture-smoke.mjs的机械接线和
独立plugin-skill-preview-scenario.mjs。near-800 runner仅登记调用，下一刀若继续扩展须拆出
HTTP/生命周期编排，不在原文件堆场景。协议/envelope/dispatch等千行文件仅注册，不加业务。
架构图确认：root，2026-10-18；architecture.md §7.2同步单一owner，无迁移/compat。

当前验证：首次DOM/Markdown/gateway19/19；定向严格TS与client package build exit0。
首次直接cargo test因V8默认上游归档404失败，改用仓库resolveRustyV8CargoEnv校验现有产物
后继续编译，不修改依赖。正式schema生成只同步经审阅的差异；完整Rust/contract/Electron
结果待收。仍有明确差异：五分钟缓存尚未实现（当前每次打开重新授权读取）、included_files
服务端规则未知、逐技能偏好投影未补齐；AccountManager既有路径边界拒绝编码slash/dot等，
未为任意skillName放宽共享安全边界，需按实际包命名/跨仓路由继续核定，不能称完全等价。

2026-10-18续验：复用REA parent `ev_2d2bafac2b1d100aeb5db911eff0b3c7c3821ffed039e7c0653c052fc1a9016c`
的summary复核十段原字节，未重跑整包、未执行Codex。正式schema最终生成exit0，补齐
Method的serde wire名后仅同步已审阅差异，正式TS生成、client package build、完整
`npm run test:contracts`、窄Rustfmt与最终新增测试ESLint均exit0。前端本刀44项按分组
通过，另有共享Markdown现有消费面31/31；不把它们写成单次全仓测试。生产源码与生成
schema/TS摘要冻结于`/tmp/lime-plugin-skill-client-final-source-snapshot.json`，续验未漂移。
公共Rust首轮整组exit101、48/49，五项skill_reads均通过；唯一失败是GLOBAL准备场景的
stdio子进程initialize超过原45秒预算，同组另一个stdio场景通过。最终源码五项skill_reads、
protocol crate及Electron仍在执行/准备。额外直接`target/debug/app-server --help`退出134，
dyld明确报告`libsherpa-onnx-c-api.dylib`及缺少`LC_RPATH`；此裸产物现象不能直接作为
Cargo测试中超时的已确认根因。后续使用正式准备流程的新产物复验stdio，不修改共享
target中的二进制、不放宽业务断言；未将该整组记为通过。

最终源码续验：protocol crate exit0、142/142（含生成fixture树与method/schema合同）；
`remote_plugins_jsonrpc skill_reads::` exit0、5/5，覆盖原文/逐段编码/null/empty、账号fence、
错误身份/404/500/坏类型恢复、三项wire输入和共享15秒超时。正式准备的新App Server与
code-mode-host/运行库6项复制冻结在系统临时目录`lime-plugin-skill-current-runtime-UuakEc/`，
清单`/tmp/lime-plugin-skill-current-runtime.json`；App Server SHA256
`cf6e909073eacf6c7c5c4fa6447ecd84e5bdffa9115e17f06291ff36c7f2357e`。
通过`LIME_TEST_APP_SERVER_BIN`指定该固定产物后，原失败的GLOBAL真实stdio场景exit0、1/1，
未增加timeout或改断言。此为原失败项单独复验通过，不伪写成整组一次49/49，也不把动态库
裸产物现象确认为首次timeout根因。新Electron场景因并行侧栏样式更新触发renderer新鲜度
重建，仍待实际结果；不绕过guard、不修改侧栏写集。

Electron续验先由新鲜度guard阻止旧renderer交互，保留失败目录；新产物启动后又由旧
fixture把`/client/ps/plugins/workspace/created`错误当作详情ID而退出。实际HTTP路径保存在
`/tmp/lime-plugin-skill-client-electron-path-diagnostic/unexpected-plugin-path.json`，归类为夹具
缺少现役目录响应，不猜成正文RPC故障。按上节near-800退出条件，将HTTP issuer从主runner
拆到`scripts/electron/lib/remote-plugin-catalog-issuer.mjs`，主runner降至约620行；技能场景
helper仅保留GUI交互。补created/shared空集合的真实raw分页形状，与已有分享fixture和
Core目录合同一致；未知HTTP请求仍断言失败，异步失败保存诊断并使最终场景失败，保证
外层finally回收进程。此为测试夹具重构，未改变生产接口、目录投影或授权策略。

新产物Electron最终专项exit0：
`REMOTE_PLUGIN_EVIDENCE_DIR=/tmp/lime-plugin-skill-client-electron-verified node scripts/electron/remote-plugin-catalog-fixture-smoke.mjs`。
主链为真实Electron/preload/IPC、`app_server_handle_json_lines`、共享App Server/AccountManager、
受控Core形状HTTP及同一PluginStore；Turn backend为unavailable，modelTurn=false。
未安装技能依次验证404错误、重试null、重开Markdown（去frontmatter/首H1）；关闭恢复同一
卡片焦点。安装后的原始本地SKILL.md经`fs/readFile`展示“Research carefully.”，未增加远端
请求；stdio peer通过同一`plugin/skill/read`读取远端原文。共4次认证skill GET（3次GUI、
1次stdio），均includeDownloadUrls=false且非renderer发起；tar.gz仅下载1次且无账号header。
目录、安装/侧栏、换号隔离、reload、冷启动、原账号已安装返回、共享卸载与注销清空均通过；
issuerErrors/consoleErrors/pageErrors均0。remote/local两张预览截图已目检，未用成功toast
代替RPC、store与内容断言。前轮安装已成功但重入使用旧sidebar locator超时，已按实际
DOM更新为主导航/自定义导航两个现役入口，保留失败目录electron-current，不改产品UI或预算。

App Server仍为上述`cf6e9090…`固定产物；整个dist/dist-electron共3851文件的前后汇总SHA256
均为`839ea99b550cac3c252439a194d7a746cab60e6eb69f5a9c79bebfbf9ce6308b`。
另从实际HTML入口递归解析静态/字面量动态import，182文件、660边、1处动态表达式未知；
`/tmp/lime-plugin-skill-client-entry-graph-verified-{before,after}.json`逐字一致。
实际入口`index-C1Oy1uiz.js` SHA256 `1c77981306b24fae6125e421eca673c532fff7360afec5a5c06f7ea799adea83`；
实际可达`PluginCatalogPage-DLC5BxhS.js` SHA256 `ff6ac1d375fdd6eb1c78d44efa7f744123c88cdf5228ffe5654c16988550d479`。
不从dist残留旧chunk挑选证据，未知动态import不冒称完整静态依赖图。源码/生成物摘要复核
无漂移；HTTP重构三文件语法、ESLint no-undef/unused及scripts治理通过。完整GUI smoke另以
`/tmp/lime-plugin-skill-client-gui-smoke-final`为证据目录执行中，结果未收，不提前写green。

本切片复用Context和Markdown现役owner，移除技能只读span并拆HTTP测试职责，保持单一
数据与授权来源；不新增registry、renderer HTTP、迁移、compat或deprecated。旧插件42项
dead/deleted/forbidden-to-restore基线未恢复。共享正文专项通过不核销五分钟缓存、参考文件
服务端规则、逐技能偏好、分享链接/邀请、真实Core同包Turn、exec/PTY及Windows/live/packaged。

最终普通壳门禁：`LIME_ELECTRON_SMOKE_EVIDENCE_DIR=/tmp/lime-plugin-skill-client-gui-smoke-final npm run verify:gui-smoke`
exit0、24/24，含完整renderer/host/sidecar构建、真实Electron/preload/IPC/App Server初始化、
工作台/reload、设置、1536×960/1280×800/980×680布局；console/page/invoke/preload错误、
legacy/mock命中均0。summary与三视口截图在上述独立目录；本轮未修改首页布局，前轮23/24
的小窗口失败保留为历史，当前共享工作树结果已通过，不认领并行布局修复。此普通壳门禁是
独立重建与场景，不冒称和正文专项的整目录摘要相同；App Server仍为同一`cf6e9090…`。
最终1096项本轮源码/生成物摘要与6项冻结runtime摘要均无漂移；新构建入口引用证据另存
`/tmp/lime-plugin-skill-client-entry-graph-gui-smoke.json`。本地正文读取与展示切片验收完成度
100%（仅本节声明合同），P04b13完整能力与整体对齐仍active，方法基线计数不变。
`verify:local`未全跑：无写集过滤且存在大量并行脏改动；只对上述实际定向与产品证据负责，
不声称全仓green。下一刀先依据REA确认五分钟缓存的失效/账号边界和现役缓存owner，
再补逐技能偏好；included_files服务端规则未知时继续定位，不用包目录猜生成策略。

### P04b13c 预览查询缓存与账号代际（专项已验，通用GUI仍有失败，完整目标active）

先核定Codex原件再实现。沿用ASAR `75e397e2…`、app-initial `604b5d2d…`
及app-shared `607ad086…` 的冻结字节，新抽8段6761B，REA parent
`ev_47dd2e4f647d31e2527bee6cf51513bac33543f82b6905a090dd3b66be2335c5`，
summary `ev_e17269478e19d9a1b50c17d718a203d2d8503af7f9c65fa12cedb2d0bb18b1e9`。
原字节、byte/UTF-16范围manifest与摘要存系统临时目录 `plugin-cache-desktop-ffc2Vc/`。
8/8解析、静态语义unknown345；未执行Codex。yTn账号变化调用Zxn，Xxn注册的已定位
回调只reset space查询；不能据此泛化为清空所有插件缓存。Iil/Hil既有证据明确五分钟
staleTime、路径优先、host/market/plugin/skill键，hosted另带账号/user与请求前后fence。

Lime当前无TanStack Query owner。此刀引入其现成查询生命周期，在plugin model层持有
唯一、可丢弃的正文查询客户端，GUI仍调用fs/readFile或plugin/skill/read，不改共享Rust
授权、持久化或HTTP边界。查询按现役账号identity及单调身份代际隔离；同账号metadata
刷新不失效，A→B→A仍是新代际。账号通知/重读沿cloudAccount，不增加凭据或本地业务后端。
用现成query的五分钟staleTime、取消、并发合并、过期重开重取，删除组件手写请求状态机；
本地Retry沿既有明确设计，不声称Codex原生Jil有同按钮。不添加迁移/compat或旧插件入口。

认领：package.json/pnpm-lock.yaml、src/lib/cloudAccount.ts及测试、plugin model新增
skillPreviewQueries、PluginSkillPreview/PluginSkillsSection及相关测试、已有技能Electron
helper和必要issuer诊断、此计划/architecture §7.2/plugin合同。避让其它未知脏写集。
Verification Contract：root，P1/budget:normal。输入为同一插件技能/账号；首次读取真实
gateway，五分钟内重开不再请求，null也缓存；过期重取，失败不伪造空正文，Retry重取；
本地路径优先，换技能/换账号/注销/关闭取消与迟到隔离，包含A→B→A及会话变化。
追加核定桌面全局默认：qNc经import/export映射构造new QueryClient(Fjn)，Vq设置
refetchOnWindowFocus=false、retry=Bq；Bq上限3次重试，状态408/425/429/5xx可重试，
无numeric status也可重试，其他HTTP状态终止。5段549B新REA parent
`ev_960df40f0fb1653445f88918d79b522082450064c269a30ce1bdb1bbf6e4aee5`，
summary `ev_67f4103836c0d385e44363c82eaf6a1d7b1f4338ad49bc02ee8f4a9d9ecd51d7`，
5/5解析、semantic unknown25；default-query-ranges/manifest归同一临时证据根，未执行Codex。
Lime按此关闭焦点重取并替换首次retry=false草案；本地账号变化错误额外立即终止，
不把HTTP状态从错误文案猜回。当前RPC错误无numeric status时最多3次自动重试，然后
显示失败；Electron错误场景据此预期4次失败GET，再手动retry/null和过期GET各1次。
先account/model/DOM定向与严格TS，再contracts/版本及脚本门禁；真实Electron正文专项
和literal verify:gui-smoke验证current bridge，受控Core HTTP与真实Core进程分账。
无Rust业务改动时复用已冻结runtime，重建renderer并核验实际入口引用；不冒称本轮Rust
重新编译或全仓verify:local通过。完成条件为上述合同及证据回写。

逐技能下一刀已取得双来源：Desktop pQr/H2按installed.disabled_skill_names投影enabled，
未安装默认true；CLI core-plugins/remote.rs 1468–1491同义。但1908注释明确远端禁用状态
尚不投影到skills/list，本地skills.config仍是运行时启停来源。不得把远端偏好直接覆盖本地
runtime，也不得以enabled控制正文授权。Core尚无已确认偏好编辑合同，不猜写入端点。

架构影响：重大（新增renderer查询依赖/投影owner）；architecture §7.2已同步查询图，
责任开发者确认：root，2026-10-18，核对依赖、目录、数据流及验证门禁；验收仍待收取。

实施与中间验证：引入锁定的@tanstack/react-query/query-core 5.104.4，组件手写effect/attempt
状态机删除，原始nullable正文、路径优先和Markdown owner保持原合同。root pnpm入口先因
旧Corepack签名key失败，使用仓库指定pnpm9.15.9后暴露既有agent-runtime-client精确引用
app-server-client@1.71.0在registry不可得（本地package为新版本）的工作区安装阻塞；未改
该并行package。新增两包用隔离临时manifest通过pnpm安装，根lock只合并其真实integrity、
snapshot与importer，自动逐项对比一致，再只拷贝两包到现有node_modules，不替换依赖树。
此不是根工作区完整frozen install通过；干净全仓安装的既有版本引用阻塞仍需持有者处理。

最终相关分组共66项通过：账号6、query/model10、DOM14、目录/分享/gateway消费面36。
首轮DOM旧microtask等待不适配Query通知批处理；只在测试中接notify调度并等待真实焦点
终态，未改产品scheduler或放宽业务断言。最终定向严格TS、全本刀lint、完整test:contracts、
版本、scripts governance及docs boundary均exit0；两仓窄diff --check通过。日志位于
/tmp/lime-plugin-skill-cache-{query-verified,consumers,ts-verified,lint-verified,contracts,version,scripts,docs}.log。
首轮Electron专项exit1：fixture source changed before lock acquisition；源码新鲜度守卫
正确拦截，未进入交互。稳定源码1103项摘要记录在
/tmp/lime-plugin-skill-cache-final-source-snapshot.json；Rust摘要与上一刀一致。
最终literal verify:gui-smoke已收终态exit1、23/24：仅layoutGeometryStable失败，当前首页
980×680的inputbar底部714.54超出680视口；三视口截图与summary保留于
/tmp/lime-plugin-skill-cache-gui-smoke/。真实Electron/preload/IPC/App Server初始化与current
方法、无console/page/invoke错误、零旧命令/mock均通过。已目检小窗口截图；首页/侧栏为
并行避让写集，未改布局或放宽守卫，不能把此结果记为通过。
正文专项已用新目录/tmp/lime-plugin-skill-cache-electron-verified重跑；freshness发现本轮
构建期间出现并行HomeComposerDecorations.tsx，按现役流程再次重建renderer，未绕过。
该轮预览合同已过，随后新rail＋contextual的两个插件按钮使旧联合selector严格匹配失败；
exit1保留，不用first或放宽断言。fixture仅改为精确getByTestId(app-sidebar-nav-plugins)，
node --check通过；1103项快照v2与v1唯一差异是此fixture，产品源码无改动。
最终新目录/tmp/lime-plugin-skill-cache-electron-final专项exit0、ok=true，证明真实Electron/
preload/IPC/current App Server与共享stdio：首次+3自动retry、手动Retry/null、五分钟内
null/Markdown复用、Date受控前进300001ms后的重取、当前path优先、关闭焦点、账号隔离、
重载/冷启复用、同一安装与卸载。受控issuer共7次正文GET，renderer无认证HTTP，bundle
下载无账号header；console/page/issuer errors均0。其dependency为controlled Core-shaped
issuer，backend unavailable、modelTurn=false，不核销真实Core/MySQL/provider/Turn。
artifact前后4418项均为eb0843c89b3ddf928c6c9e73cb831db9a1817c680bb24b10d8c1ab66c84d344f。
正文远端/本地两图及通用壳三视口图均已目检；专项目标通过率100%，通用GUI门禁23/24仍
失败，不能把切片或全产品标为全验收完成。snapshot-v2、entry-during/after与final-audit-v2
归/tmp/lime-plugin-skill-cache-*；首次entry-before为重建前过程记录，不作为最终入口证据。
收尾audit-v2的1103项源码及6项runtime无漂移，但entryGraphUnchanged=false（exit1）：
专项结束后共享dist已被后继并行构建替换，当前4530项不等于已验4418项。该结果不修改
专项区间内before/after一致的事实，也不代表最新dist通过。entry-during属于相同eb0843c8…
产物批次，按其实际HTML引用图保留181/182项原字节至
/tmp/lime-plugin-skill-cache-validated-artifacts/；唯一不可得原件为已被覆盖的dist/index.html，
其SHA和引用图保留，不伪造HTML或从无关旧chunk挑证据。retention-manifest记录缺口。
完整HTML原件与最新dist仍需稳定整合窗口补证，不能宣称整包原件全部留存。
未跑全仓verify:local，原因仍为大量并行改动且无窄写集入口。

下一刀补充定位（只读）：CLI request_processors/plugins.rs:1182–1218直接取remote detail，
remote_plugin_detail_to_info:2326–2336令远端skill.path=None并保留远端enabled；
Desktop同一REA的pQr也明确path:null、hooks:[]，H2的localVersion:null；聚焦模块view为
`ev_4f10705449645752adcbcbc0f3aa223f7ec5f800f272d765374157f5534dbcc2`，
原片段SHA256 `3eff0e721e2d7918d884e402ac639f3579a8b402005ddafc1ea622996b5e6579`。
因此Lime remote.rs:159整组覆盖local.skills不仅丢远端偏好，还会把远端详情切成本地技能名/
path；projection.rs:118的enabled=false是另一独立差异。下一刀必须区分本地插件详情的
文件优先与远端详情的release投影，不能用已安装路径测试把现有偏差锁死。正文缓存本刀
验证的是收到path时的优先规则，不证明远端详情应生成该path。先改合同/受影响fixture，
再补fresh installed偏好读面、未安装默认true及runtime本地配置不变的行为回归。

同一读面另有待实施差异，不能因缓存切片通过而核销：

| 差异 | 已定位上游依据 | Lime当前落点 / 后续合同 |
| --- | --- | --- |
| 远端详情受调用方marketplace限制 | core-plugins/remote.rs:1448起明确说明ID唯一、后端scope为事实源 | remote.rs:86/97按传入scope验证；改为按授权响应canonical scope投影并保留ID校验 |
| 安装时间单位 | Desktop H2使用Date.parse/1000；CLI request_processors/plugins.rs:2244使用timestamp秒 | remote/reconcile.rs的installed_at使用timestamp_millis；需统一公开DTO单位并复验消费者 |
| 远端详情取本地安装摘要 | CLI build_remote_plugin_detail每次取fresh installed；Desktop pQr/H2以servicePlugin投影 | 当前read复用本地摘要；新读面应区分远端安装事实与本地物化/readiness，不能写回runtime偏好 |

以上先记录为planned；上游Apps install_url与本地控制面语义也仍需单独核定，不由本表推断
可直接照搬ChatGPT URL。偏好写入、服务端included_files规则依旧unknown，不猜接口。

### P04b13d 远端详情安装事实与逐技能投影（专项已验，完整目标active）

后续目录切片见 [P04b13e 目录安装事实](codex-plugin-catalog-installed-facts.md)，进度与证据独立记录，完整目标保持 active。

本刀直接实现上节已定位的合同；REA复用pQr聚焦view及其同源H2，CLI以
build_remote_plugin_detail、build_remote_plugin_summary和request_processors/plugins.rs为
native App Server语义依据。pQr的hosted localVersion=null不能覆盖CLI明确的installed
release version；两者均不把本地物化包的skill/path/hooks覆盖到远端release详情。

窄写集：runtime/plugins/remote.rs与projection、plugin_remote/installed、remote/reconcile
时间单位；remote_plugins_jsonrpc受影响fixture与新增details回归；已有Electron issuer/技能
helper、两仓计划、plugin合同及architecture §7.2。只读Core安装DTO/HTTP实现，本刀不发明
偏好写入接口。首页、侧栏、CLI/TUI、发布和其它并行写集避让；无迁移、compat或新业务owner。

消费者复核另认领原本干净的plugin_catalog/share.rs与plugin_share_jsonrpc.rs：share/list同一
PluginSummary.installedAt仍使用毫秒，一并统一秒并更新既有安装/分享行为断言，不加迁移。

Verification Contract：root，P1/budget:normal。plugin/read按授权详情的canonical scope和
opaque ID定位；fresh installed完整分页且includeDownloadUrls=false，不下载/发布本地
安装投影；失败/换号显式拒绝。远端技能名/path=null/MCP/hook按release投影，enabled按
disabled_skill_names（省略默认空、未安装默认true）；summary使用fresh安装与同一共享
plugins配置门禁，onboarding还要求插件可用及技能启用。installedAt统一Unix秒，本地
skills.config仍独立控制skills/list及Turn，不把远端偏好写回runtime。用真实JSON-RPC验证
fresh变化、分页/失败/身份fence、远端与物化版本不同、无物化仍可读、本地配置与远端偏好
独立；先crate定向，再新二进制真实stdio和Electron，当前通用GUI失败另记且不放宽。
完成条件：实现、定向/协议门禁、实际进程证据和两仓文档回写；完整目标仍active。
架构影响重大：详情事实从本地物化覆盖改为同一Context的fresh installed只读投影；
责任开发者root于2026-10-18确认现役owner与数据流，architecture §7.2同步，不新增RPC。

后续已定位但本刀未实现：CLI remote.rs:830/848/875及1224的目录读取关联fresh installed；
Lime collections.rs非Shared分支仍把本地物化summary作为安装overlay，Shared的fresh行又被
local overlay覆盖。目录的fresh事实/缓存与local readiness边界需独立切片验证，不能因
详情本刀完成而核销。Desktop本次REA只支持pQr/H2详情投影，不推断其全部列表刷新时机。
边界复核：CLI remote.rs:1399的skill正文读取仍校验marketplace属于已知集合，Lime skill.rs
保持同一规则；不能把详情忽略调用方marketplace的合同泛化到所有插件RPC。

验证过程与失败记录：完整test:contracts已exit0，日志/tmp/lime-plugin-detail-contracts.log；
首轮直接cargo test未注入仓库rusty-v8 env导致上游archive404，保留
/tmp/lime-plugin-detail-rpc-test.log。第二轮改用resolveRustyV8CargoEnv后编译发现collections
隐式依赖父模块Scope导入，已在本模块显式引入，失败日志保留*-rpc-test-v2.log。
第三轮同一env运行remote_plugins_jsonrpc与plugin_share_jsonrpc、4线程，最终结果见下，不复用
P04b13c旧二进制。renderer使用现役smoke build重建，证据统一/tmp；窄写集22项源码摘要
归/tmp/lime-plugin-detail-source-baseline.json。未跑全仓verify:local，不干扰并行主路径。

Rust最终第三轮exit0：plugin_share_jsonrpc 7/7（124.62秒），remote_plugins_jsonrpc 54/54
（976.84秒），无过滤/忽略，含真实stdio。五项新增详情public RPC回归全过；日志
/tmp/lime-plugin-detail-rpc-test-v3.log。现役smoke renderer构建最终exit0，日志
/tmp/lime-plugin-detail-renderer-build.log。因共享renderer另有排队构建，本次保留新鲜度检查
所需源码与全部桌面产物至系统临时验证目录lime-plugin-detail-validation-5aXwOf，4,642项原字节全部保留
（含HTML），摘要d23d22773ba3332c33c637a4537b30af716be7c4ec9e947acafbee3c889ab0ba；
清单/tmp/lime-plugin-detail-isolation.json，freshness exit0。App Server新摘要
487122a5937fb64c7e68e48194d14b8b055d009b58682005917c07ca1b0678f5，六项runtime原件
另保留于lime-plugin-detail-runtime-QicKSY，清单/tmp/lime-plugin-detail-runtime.json。
源码final相对22项baseline仅Electron fixture新增installed/enabled/MCP断言，无产品源码漂移；
真实Electron专项随后在冻结目录执行，独立验收Desktop Gate B，不以本地RPC结果替代。

WORKSPACE专项最终exit0、ok=true：/tmp/lime-plugin-detail-electron/summary.json及同名.log。
真实Electron/preload/IPC、共享App Server JSON-RPC与stdio通过安装前/后远端预览、真实
bundled Browser本地fs/readFile、逐技能偏好与runtime skills/list独立、Unix秒/原生installed
release版本、共享安装、换号/重载/冷启/切回、卸载和注销。已目检skill-installed-remote.png
与skill-local.png，远端未被本地正文覆盖。前后4,642项及d23d2277…完全一致；HTML原件已
完整留存，不重复P04b13c的HTML缺失。依赖仍为controlled Core-shaped issuer、backend
unavailable、modelTurn=false；不核销真实Core/MySQL/Turn或CLI/PTY/Windows。

GLOBAL专项也最终exit0、ok=true：/tmp/lime-plugin-detail-electron-global/summary.json及
同名.log；前后同一4,642项与d23d2277…摘要。除WORKSPACE全链外，另通过原生manifest
release version覆盖、完整Apps文档保留、共享app/list可见及卸载移除；已目检installed.png。
这证明Apps元数据与安装投影，不证明连接器认证/工具执行。两组console/page/issuer errors
均0、renderer直连API请求0、bundle GET不带账号header且不来自renderer。
本刀current为现役详情/时间投影；旧本地overlay与错误fixture断言已删除（dead），无新增
compat/deprecated或迁移。专项实现及验证完成度100%，完整对齐目标仍active；目录fresh事实、
偏好编辑、included_files与真实Core/MySQL/同包Turn/CLI/PTY/Windows等义务未核销。
同一冻结产物的通用壳smoke经现役scripts/electron/smoke.mjs入口最终exit0、24/24，含真实
Electron/preload/IPC/current bridge、三视口layoutGeometryStable及零错误/旧命令/mock命中。
证据/tmp/lime-plugin-detail-gui-smoke/summary.json及同名.log。本次冻结整合产物的小窗口布局
已过；不改写P04b13c旧轮失败记录，也不把冻结目录结果泛化到随后变化的共享dist。复用
本轮exit0构建与freshness证明，不再次触发共享renderer重建，不声称执行了新的npm聚合构建。

人工截图复核补充：上述首轮1536×960 PNG仍为启动页，尽管summary为24/24，该张视觉证据
不通过，原件保留。未改产物/断言，另跑/tmp/lime-plugin-detail-gui-smoke-v2，最终exit0、
24/24；1536×960、1280×800、980×680三张均已目检为工作台画面，无越界。首张侧栏仍为
异步加载状态，不作为历史/Thread恢复验收。截图前的画面稳定护栏仍需在electron/smokeChecks
owner单独补齐，不用DOM几何成功推断合成器已呈现；该并行热区本刀保持只读。
最终摘要审计/tmp/lime-plugin-detail-final-audit.json exit0、ok=true：全部4,642项冻结产物、
22项final源码与6项冻结runtime均无漂移。本轮未跑全仓verify:local，完整目标保持active。

## P04b12c 共享 App Server 分享主链（四RPC本地合同已验，完整目标active）

P04b12b的Core源码与本地验收已过。继续实现Codex plugin/share/save、list、updateTargets、
delete四个公开RPC，checkout沿同一owner在下一刀闭合；不以四个方法完成替代完整五组目标。
输入是当前共享账号、绝对pluginPath及可选remotePluginId/策略；GUI/CLI/TUI通过同一typed
App Server调用，Product Surface不持有Core token、上传capability或第二套打包后端。

实现：PluginDataSource/PluginStore承接本地manifest读取、50 MiB tar.gz归档和账号隔离的编辑
路径映射；Context复用AccountManager受限tenant client HTTP，明确区分ps/plugins读写与
public/plugins/workspace写路径。上传capability用独立无凭据PUT，30秒、禁止redirect，账号fence
贯穿远端提交与本地映射。create/update都POST；delete204后清本地映射，catalog安装投影仍沿
reconcile事实。list完整分页created目录和installed事实，保留owner分享元数据并关联本地路径。
UNLISTED补workspace reader，owner/editor/publisher权限由Core当前事实最终决定。失败不伪造
远端成功，不把签名URL/账号凭据带入日志或公开RPC。map只是同一store的账号隔离编辑缓存，
不是另一插件registry，不迁移或读取旧插件数据。

窄写集：protocol新plugin_share/absolute_path类型及mod/Method/envelope/schema注册；
App Server新plugin_remote/share与credential-free upload、plugin_catalog/share及archive/path
模块，既有Context、PluginDataSource、LocalAppDataSource、RuntimeCore/processor/dispatch只加
委托；typed client/gateway/method catalog/正式生成物与fixture同步。Core仅本计划；架构§7.2
更新。避让CLI/TUI、专业预览、发布、证据目录与未知并行热区，不新增agent/迁移/compat。

Verification Contract：root，P1/budget:normal。真实current JSON-RPC -> shared account ->
Core形状HTTP -> 无凭据tar.gz PUT -> finalize/ACL/delete -> 同一store映射。验证归档结构、
manifest选择、50 MiB、链接/特殊文件拒绝、跨账号/冷重载、分页/重复cursor/ID、取消/超时、
凭据隔离/跳转拒绝、失败不提交映射和删除后清理。先Rust协议/owner定向与HTTP集成，再正式
schema/TS生成、client build/typecheck、test:contracts及docs；真实Core进程/MySQL/模型Turn/
Electron/CLI/PTY/Windows/live/packaged继续独立待验。未验证前不修改245身份完成计数。
架构影响重大：同一store/account/runtime owner；root于2026-10-18确认，实施时同步图。

补充写集：Desktop Host的appServerRequestTimeout及既有Host测试，current renderer bridge的
commandPolicy/http-client超时测试，既有契约守卫仅更新超时方法清单。share四方法都需覆盖远端
mutation gate及完整多页读取，等待窗口统一150秒；没有新增IPC、preload权限或生产mock。
schema registry/v0 catalog为超过1000行的既有机械注册表，本刀仅注册类型/队列，不追加业务；
新分享业务按archive、paths、HTTP Context、store、processor分开，均保持800行以下。
正式schema及TS生成完成，SDK build、前端/Host五文件78/78及完整test:contracts通过。
首轮schema transparent与serde try_from/into冲突已修；直接cargo未注入仓库V8供给配置下载404，
改用现役resolveRustyV8CargoEnv后check通过。首轮契约只因旧超时守卫锁定method===写法失败，
已更新为现役方法清单，由Host行为测试守等待值；失败日志保留。最终Rust单元18/18、公共
JSON-RPC集成7/7、协议share过滤3/3及绝对路径1/1通过；renderer/node与Electron typecheck通过。
初轮集成4项失败来自fixture漏传必需的params:{}，修fixture后重试全过；未放宽生产协议。
12文件定向lint零错误/警告；request-client.ts的既有3条lint不在此声明中，未禁用规则。
最终literal verify:gui-smoke exit0，SHELL-01真实Electron/preload/IPC/AppServer、三视口/重载/
memory入口24/24、57次IPC、legacy/mock/console/page错误均为0，截图已检查。它是普通壳证据，
不包含share GUI、模型Turn或CLI/PTY。日志分别为/tmp/lime-plugin-share-client-rust-retry.log、
/tmp/lime-plugin-share-client-absolute-path-tests.log和/tmp/lime-plugin-share-client-gui-smoke.log；
GUI原件在/tmp/lime-plugin-share-client-gui-20261018-0335/。未重建受影响的.lime/qc证据目录，
未复用旧产品binary。Core此切片只同步计划，不宣称新增服务端验证。
取消/真实超时、真实Core/MySQL/同包Turn、分享GUI、CLI/PTY、Windows/live/packaged仍未验。
删除最后映射时物理删除账号cache文件，保留用户编辑目录和历史；save/delete缓存失败只warn。

## P04b12c1 tar.gz输入合同收敛（本地与受控Desktop/stdio已验，整体active）

复核发现10000/512条目、manifest 2/1 MiB、全流budget、非零padding、./根目录、路径空白与
目录body的实质差异；已直接收敛到同一现役scanner/extractor/packer，无迁移、双读或兼容入口。
共同合同为：通用入站100 MiB、分享出站50 MiB、普通文件512 MiB、10000文件/目录（不计./根
目录及透明PAX/GNU metadata）、路径256层、读取manifest 2 MiB；全tar流另加32 MiB budget，
仅允许全零尾部。目录body、链接/特殊/稀疏、非UTF-8、反斜杠/冒号、前后空白、越界/重复/冲突、
CRC/截断/额外gzip流均拒绝。Codex上游确认100/50/512 MiB；条目/路径/metadata护栏明确属于
两仓共同资源限制，不把它们伪称为上游原值。Core其他组件metadata保留1 MiB单文件/8 MiB累计。
Core从遍历预读所有manifest改为按Codex优先级惰性读取，未选中超大候选不再阻断有效包；
读取根plugin.json超过限制仍失败，不绕过到native。原始package/selected-manifest字节摘要不变。

窄写集：Lime bundle.rs、bundle/tests与share/archive测试、同包fixtures、architecture§7.2；
Core现役archive/upload/manifest/scan/components及定向测试、testdata；source OpenAPI两片段、
正式bundler生成物、API文档和两仓计划。继续避让CLI/TUI、专业预览、发布与未知写集。
唯一生成器在Lime app-server/tests/fixtures/plugin-archive/generate.py；两仓index与56个tar.gz
逐字节相同，逐包SHA-256固定。覆盖PAX/GNU长名/size、root/native顺序、选中2 MiB/超限、未选中
超限、10000/10001条、32 MiB全流边界、256/257层、恶意类型/路径、CRC/截断/多流/非零尾部。

Verification Contract：root，P1/budget:normal。Rust现役plugin_catalog 47/47及公共分享JSON-RPC
7/7通过；共同56样例在两端均通过，Rust分享打包再回读正向样例保持manifest/文件bytes。
Core完整make verify-go exit0（format/vet/所有Go workspace测试）、正式OpenAPI bundle生成与
make verify-contracts verify-client-contract-sync exit0。日志为/tmp/lime-plugin-archive-client-final.log、
/tmp/lime-plugin-archive-core-verify-go-retry.log与/tmp/lime-plugin-archive-core-contracts.log。
首轮corpus测试因Core现有sha256:前缀和Go tar writer拒绝生成空文件路径的fixture写法失败，
修正测试后通过；首轮全Go发现旧累计metadata夹具依赖manifest常量，已换为实际组件单文件
常量并保留单文件/累计预算断言，完整重试通过。没有放宽8 MiB预算或跳过失败测试。
受影响真实Electron远端包补验exit0：目录详情、GUI确认安装、真实stdio共享安装、换号隔离、
重载、冷启/切回恢复、卸载及注销清理全部通过。命中plugin/list/read/install/installed/reconcile/
uninstall；唯一包下载accountHeaders=false且renderer=false，renderer HTTP为0，console/page错误
均为0。检查安装确认和冷启恢复截图。原件/tmp/lime-plugin-archive-electron-retry-20261018/，
日志/tmp/lime-plugin-archive-electron-retry.log；新源码产物完成build/freshness检查，未复用旧binary。
首轮夹具误将自定义assert当node:assert使用，HTTP断言处TypeError中断；只给该既有脚本导入
node:assert/strict并改5个调用，定向ESLint exit0，保留首轮/tmp/lime-plugin-archive-electron.log。
重跑由现役锁owner检查回收本进程已退出的锁，没有清理其他进程或用户目录；本刀补充写集仅为
该fixture断言，不扩展774行runner业务。该证据是受控Core形状HTTP + unavailable Turn backend，
不代表实际Core/MySQL、同包模型Turn、分享GUI、真实exec/PTY、Windows/live或packaged产品验收。
架构图确认：root，2026-10-18；current包/AccountManager/PluginStore/runtime owner不变。
本切片56/56（100%）仅为共同样例通过率，245 identity计数与整体完成度不据此提升。
未跑全仓verify:local：入口覆盖大量未知并行脏改动且无本写集过滤；以本刀真实门禁单独记账。
分类保持current包/账号/协议/store/runtime；旧插件42项dead/deleted/forbidden-to-restore不恢复，
本刀新增compat/deprecated为0。新增模块保持800行以下，已验证的重复读取流程直接替换。

## P04b12c2 manifest 非普通路径共享样例（2026-10-19，本片完成）

Codex `plugin_bundle_archive::unpack_plugin_bundle_tar` 保留显式与隐式目录，
`plugin_namespace::find_plugin_manifest_path` 拒绝高优先级非普通 manifest 后再选择格式。
Core 的独立目录切片已完成 38 个发布/分享场景，客户端尚缺同包运行证据。本片直接复用唯一
`tests/fixtures/plugin-archive/generate.py`，向两仓共享 corpus 增加 19 包：root/Codex/Claude/Cursor
的显式目录、普通子文件隐式目录、目录子条目隐式目录，三个 native 父路径为普通文件，以及四种
合法格式。15 负向、4 正向；总量 56→75。原 56 包和原有断言保持逐字节不变，两仓 75 包与 index
及逐包 SHA 已核对相同，不另外复制一套 archive builder。

Verification Contract：root；唯一 current owner 仍为客户端 extractor/manifest selector 和 Core
archive/selector/scanner。窄写集仅生成器、两仓 index/19 个新 tar.gz、两侧既有 corpus 测试计数、
计划与证据；没有生产逻辑、RPC/schema、依赖、迁移或 compat。测试目录不在 Electron freshness
源集中，当前 continuation 的 84 项冻结生产核心保持不变，避让 GUI/Electron/runtime。

退出分母 4 项：①新增包与原字节/两仓镜像验证；②Lime 当前 extractor/manifest 跑全 75 包；
③Core 当前 scanner 跑相同 75 包并保留原 38 发布/分享场景；④结果、源码摘要和分类归档。
当前 **4/4（100%）**：Lime 的 1 项真实 Rust corpus 测试已遍历并通过全部 **75 包**；
Core 定向 **75/75** 共享包和原 **38/38** 发布/分享场景通过，标准
`GOMAXPROCS=1 make verify-go-fast` 的 Node baseline、格式和 10 模块 vet 通过；客户端日志与阶段 summary 已归档，并在阶段前后核对两侧各五项源码/index 和全部 75 包摘要，
均无漂移。测试改动未改变 current parser/scanner，也不复用历史 56 包结果。
账本为 `artifacts/codex-plugin-manifest-corpus-20261019/validation.json`。这仍不覆盖真实 Core/MySQL
发布到 Turn、CLI/PTY、Windows/live 或完整插件总目标。

## P04b12d1 分享管理 GUI（实施中，完整目标 active）

本刀责任 root，2026-10-18。接续已验的五 RPC；只认领 PluginCatalogPage 及其拆分组件、
分享状态/视图模型与测试、五语言 agent.json 的 plugin 子树、专项 Electron fixture、两仓计划
及 architecture §7.2。避让 CLI/TUI、专业预览、发布与其他未知写集；不重建 .lime/qc。
目录页先拆出 card/dialog，再接分享，直接迁调用，不保留旧组件 alias。

参考模块：安装包 installed-plugin-actions 与 plugin-share-dialog；前者首次 save 使用 PRIVATE、
同 remotePluginId 更新、分享 promise 去重、账号变化关闭；后者暂存权限、失败保留草稿、保存后
采用服务端 principals。Lime current owner 为独立 PluginShareDialog + share view model，仍仅经
typed pluginShare gateway -> 同一 App Server/PluginStore -> Core catalog/release/ACL。
分享列表关联本地编辑路径；workspace/creator/publisher 只用于显示，Core 是授权最终 authority。
本刀提供首次私密分享、权限现状与已有对象角色/移除、工作区发现策略、复制、同 ID 更新、
checkout/打开目录与撤销。人员/组目录搜索与新增邀请仍属完整目标，未接 current directory
合同前不伪装成裸 ID 输入，不以本切片核销完整分享 GUI。

实现补记：目录页由约780行拆为561行，card/dialog分别独立；分享组件、状态hook与纯投影单独
持有current职责。目录补SharedWithMe与created share读取，按canonical ID去重；分享或额外
远端目录读取失败不抹掉真实本地目录，错误保留可见。账号绑定同时保存在分享目标和异步
请求fence，防换号后旧entry被新账号复用；pending用同步ref去重。
待续缺口还包括组成员editor的服务端可编辑能力投影、非creator checkout映射的冷重开编辑
入口。不能由renderer猜组成员身份，也不能将created-only share/list扩称全体编辑者目录。

专项夹具沿既有plugin-share-checkout-fixture-smoke扩展，不复制HTTP/启动后端；GUI场景拆在
scripts/electron/lib/plugin-share-gui-scenario.mjs。原拟复用专业预览剪贴板工具，但其JSZip依赖
指向已消失的独立目录；已改用无第三方依赖的lib/native-clipboard.mjs，保护原剪贴板并原生
读回/恢复，不改专业预览或依赖写集。该helper仅test-only。插件合同文档同步基础GUI和缺口。
首轮构建因实施期间源码变化被freshness guard拒绝，尚未启动Electron（checks/requests为空），
不是产品流程失败；随后依赖加载失败也在启动前，均不计通过。稳定源码已冻结七个production
文件摘要到/tmp/lime-plugin-share-gui-source-stable.json，重建中；共享版本已由其他写集升到1.161.0。

REA：app.asar SHA256 75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af，
版本26.1007.30912/build20156；parent ev_b8ba68fff49bf2b25c733045a97595dac04dd6ef369a84b8f700e427661fa39d，
summary ev_72637875f6c7bda6beb1c256d541cf6201ae15d733898d66fa2d22f239a1d028。
installed-plugin-actions复用旧parent ev_b115cb93e8d47b40ce326e0d12127ef511b6d4813e253d5cfcac507834525f32；
同ASAR重新取出的原字节SHA256为94cd43d9fa2e5495c3c80f53b8324160cb17401d81eb5cd00ceb2ce9256d1c92，
与旧retained记录一致；没有恢复被删的旧证据目录。
6/6模块解析、88830字节、443 findings；语义 unknown/5206 unknowns，不是完整运行证据。
补集与 manifest 在 /tmp/lime-plugin-share-desktop-MJoV1y；原字节目录冻结，可读副本仅辅助阅读。
全 ASAR webview 有界搜索未发现 checkout 字面量；新公开源码仍是 checkout 目标，不能由此排除。

Verification Contract：root，P1/budget:normal。真实点击 -> current typed gateway -> Electron
preload/IPC -> app_server_handle_json_lines -> 五 RPC -> 受控 Core 形状 HTTP/真实本地 store；
期望同 ID 更新、服务端权限投影、失败草稿保留、账号切换迟到响应隔离、复制内容原生读回，
无 renderer 凭据/下载/HTTP 写入。先定向 DOM/五语言/状态测试与 typecheck/lint，再 contracts、
专项 Electron 及 literal verify:gui-smoke；不将 unavailable Turn backend/受控 HTTP 声称为真实
Core/MySQL、模型 Turn、Windows/live/packaged 或发布验收。证据新建 /tmp。
架构图已登记该组件依赖；root 确认单一 owner 与依赖方向，最终验证后填写结果。

已收取本轮最新门禁：分享Dialog/目录/gateway三文件36/36，最后card pending反馈调整后
目录21/21复验；七个production根文件及传递依赖的定向严格typecheck exit0，九文件ESLint
exit0；native剪贴板保护6/6、三个fixture语法检查与两仓窄写集whitespace通过。
最后完整`npm run test:contracts` exit0（当前1.161.0），`npm run docs:boundary` exit0。
全仓renderer TSC后期因共享机器负载终止exit143，不计当前整仓通过；未无差别重复全仓测试。
专项fixture格式检查曾报一文件，已定向格式化并复验通过。真实Electron专项仍在构建，
literal verify:gui-smoke待专项结束后串行执行，不以单测替代该结果。
构建期间发现native-clipboard及其测试mtime晚于runner启动；ESM已预加载旧模块，因此暂停
尚未进入场景的runner，仅保留其编译子进程完成。产物就绪后以新进程加载当前helper再验，
不能把旧进程结果归到新脚本。helper现以macOS原始pasteboard item/type字节备份与恢复，
只在内存/管道传输，不把HTML规范化后的字符串当作原件；失败保留主错误与恢复错误。
当前四份场景/helper摘要另冻结于/tmp/lime-plugin-share-gui-scenario-stable.json。

真实分享专项已通过（2026-10-18）：新进程完成PRIVATE创建、UNLISTED权限保存、原生
复制读回及原剪贴板恢复、同ID更新、撤销二次确认、目录checkout、关闭焦点恢复、冷重开复用
和真实stdio读取。五个share RPC均由真实Electron/preload/IPC进入同一App Server；HTTP上传/
下载均无账号header，renderer未持凭据或发起Core请求，console/page errors为0。summary及
两张已目检截图在系统临时目录`lime-plugin-checkout-electron-XgiFjO/`；日志
`/tmp/lime-plugin-share-gui-electron-retry.log`，exit0。前一新进程因场景误把保护回调参数当成
clipboard对象而失败，已改为显式app.evaluate使用真实Electron API；原始pasteboard恢复成功，
失败轮不计通过。暂停旧runner在资源准备完成后主动终止137，只清其自有空锁，不计产品失败。
当前实际HTML链为index-DjW68NQ8.js -> PluginCatalogPage-DCIGII5b.js，catalog chunk SHA256
`141b86c3704b9727d7877c7dcd4e274f5fde8de0d2520d1327a4e19228188093`；App Server SHA256
`df3360c006dd890cbdd7c1456f9d1725943a8fe29a5c5877e8e444e13e2e0c70`。
七个production根、四个当前fixture/helper和六个实际引用产物前后摘要均未变，记录于
`/tmp/lime-plugin-share-gui-{source-stable,scenario-reviewed,reviewed-artifacts,postcheck}.json`。
literal `npm run verify:gui-smoke`已收取exit1：23/24项通过，980×680首页输入区bottom742，
超出680视口62px，唯一失败layoutGeometryStable；1536×960与1280×800通过。renderer/host/
App Server构建、真实启动、reload、设置、IPC通过。日志为
`/tmp/lime-plugin-share-gui-smoke-current.log`，summary及已目检截图位于
`/tmp/lime-plugin-share-gui-shell-failed/shell-01-electron-smoke/`。只将本轮自有生成证据完整
移至/tmp并核验字节，共享qc目录和其他证据未动。首页Hero/Layout/Inputbar属未知并行脏热区，
本轮只读登记阻塞，不覆盖、不放宽断言；该失败不阻断独立正文主线，也不计全局门禁通过。
普通smoke重建了dist，前述产物hash只代表分享专项当时。该专项证据为受控Core形状HTTP及
unavailable Turn backend，不核销真实Core/MySQL、模型Turn、lime exec/PTY、Windows或packaged。

### P04b12d2 REA新增明确缺口（未实施）

实际ASAR的`browser-plugin-share-page-9f3f6bdce8d1.js`原字节1825B，SHA256
`48f95ae5601bcc332e6c5fc4b31b65bfafd2f8b112c06c169697b1ab40defa9c`。REA parent
`ev_a6d2396db6d945d4b94604674739df3e8c62a6678f57b2b0afb9a7658663a933`，summary
`ev_636f8c50e6c53cd0b8ec13fa90dc518ffd7b92c91e31c9e25a0480a65788a3e0`：1/1解析、
29 findings、parse failure 0，语义unknown/132 unknowns；同一安装包hash见上。
静态代码读取shareKey，有账号才请求`GET /ps/plugin-shares/{share_key}`，传AbortSignal，
403/404为预期错误、retry=false。成功取得plugin_id后校验并replace跳转现役详情，保留search；
失败或无有效ID使用missing状态。少数内置canonical identity有本地直达分支；不能推断任意key
都是plugin ID，不能据此猜服务端key生成、生命周期或未登录行为。未执行Codex页面。

LimeCore当前share_url仍指向认证API详情，尚缺对应的链接解析/产品导航闭环。这一差异不能
被PRIVATE创建、复制读回或checkout证明完成。退出条件归上表；后续沿同一catalog/ACL及
现役导航接入，不预建第二插件registry或保留旧URL兼容。原件/manifest/REA摘要新建于系统
临时目录`lime-plugin-share-page-desktop-wQfiTd/`，本补记不计实现或产品验收。

## P04b12d checkout已验，GUI分享闭环待实施

源码复核依据为Codex remote/share/checkout.rs：checkout仅接受带share_context的workspace
shared/private/unlisted，显式授权详情请求下载URL；复用同一无凭据下载与tar.gz解包owner，
不走服务端install mutation，不把编辑目录当installed cache。个人市场为home下
.agents/plugins/marketplace.json；新建时默认生态名codex-curated、显示名Personal，已有文件
保留其合法name（Codex update_personal_marketplace读取现有值，并非强制改名）。默认编辑路径
home/plugins/{name}。已映射且存在的编辑目录复用且不覆盖；映射须位于home且可表示为相对路径，
未映射的同名现存目录必须拒绝。
save/delete的编辑路径缓存可以best-effort，checkout注册则必须成功且失败只回收本次创建的
目录，不碰用户已有内容。marketplace文件与mapping的失败/回滚要共用现役锁和原子写边界，
禁止创建第二registry、迁移或兼容入口。

计划写集为同一share owner新增checkout/personal-marketplace子模块、第五组DTO/dispatch/
typed gateway及GUI分享与编辑流程；继续复用AccountAuth队列和PluginStore。验收包括绝对路径
与home约束、同名目录保护、冷重载、多账号、并发、下载拒绝/链接/大小/失败回收、编辑后更新
同一remotePluginId、ACL调整/撤回后现役reconcile与工具新边界、完整五语言及真实Electron入口。
四方法本地验收与普通壳smoke均不能提前核销此阶段。真实Core进程/MySQL、同包Turn和CLI/PTY
继续按P04b14–15独立闭合；tar输入差异由P04b12c1共同字节样例单独核销。

本轮窄写集：share/checkout、share/personal、share/paths；协议第五组DTO及机械method/envelope/
schema/AccountAuth注册；PluginDataSource、LocalAppDataSource、RuntimeCore和processor仅委托；
SDK/typed gateway、Host/current bridge等待清单及公共JSON-RPC测试。Core仅同步本计划；
不新增服务端checkout registry。避让CLI/TUI、专业预览、发布及未知并行写集，不重建.lime/qc。
schema registry/v0 catalog超1000行仅机械注册，业务拆入上述子模块，不扩展中心文件职责。
SDK request-client-methods及接近800行的client注册面同样仅机械接线；退出条件为按领域拆分
注册表或由正式协议生成器接管重复清单，不在这些文件新增业务。checkout/personal为250/193行。

Verification Contract：root，P1/budget:normal。公共JSON-RPC -> AccountManager认证详情 ->
credential-free GET -> 同一bundle extractor -> PluginStore锁内个人市场和账号编辑映射；
不调用服务端install，不写installed cache。验证home边界/现存目录/冷复用用户编辑、同ID再save、
并发与账号fence、损坏包/链接/缺URL/写入失败/回滚；再schema生成、SDK/Host/gateway合同、
typecheck、contracts及真实Electron bridge。两个注册各自原子写、普通失败显式回滚，
不是跨文件断电事务；不宣称crash原子性。GUI分享/编辑入口与五语言仍待实施，不以bridge调用
冒充GUI点击证据。首次单元6/7唯一失败为macOS /var与/private/var测试路径比较，已对测试
发现路径canonicalize；生产路径不因此放宽。新增失败回滚与公共RPC场景后重新验证。
架构影响重大：同一store/account/runtime owner；root于2026-10-18确认，architecture §7.2同步。

最终本地验证：plugin_catalog 57/57（checkout独立场景10/10）、公共checkout JSON-RPC 6/6、
既有分享7/7、协议share过滤3/3、正式schema fixture1/1；SDK build、renderer/node/Electron
typecheck及前端/Host四文件68/68、完整test:contracts通过。13文件定向lint零错误/警告；
Electron文件使用Node globals，未禁用规则。初次lint误用browser globals报既有process/NodeJS
未定义，改用运行环境声明后通过；request-client.ts既有3项lint未夹带修改。正式schema/TS
生成后无漂移；SDK首轮发现v2 REQUEST_METHODS漏登记checkout，已修源表并重生成。
新增回归还覆盖已映射但已删除的目录：在原映射路径重新取包，缺失的home外路径仍拒绝，
不回退默认目录。日志为/tmp/lime-plugin-checkout-rust-retry.log、-ts-tests.log、-contracts.log、
-typecheck.log、-sdk-retry.log和-lint-final.log（相同/tmp/lime-plugin-checkout前缀）。

补充写集scripts/electron/plugin-share-checkout-fixture-smoke.mjs。新源码renderer/Host/sidecar
完成build/freshness及manifest摘要检查；最终真实Electron -> preload/IPC ->
app_server_handle_json_lines -> checkout、个人市场list/read、冷启保留编辑及真实stdio复用通过。
唯一下载accountHeaders=false、renderer=false；远端install/uninstall为0，console/page错误0。
已检查冷启截图；原件/tmp/lime-plugin-checkout-electron-final-20261018/summary.json，日志
/tmp/lime-plugin-checkout-electron-final.log。首轮fixture错误等待无前缀Skill名超时，截图确认
本地namespaced Skill实际可见；第二轮stdio漏合并隔离HOME而被home边界正确拒绝。仅修夹具
后重跑，不放宽产品路径检查。前两轮失败日志/summary保留；没有清用户目录或重建.lime/qc。
此证据的依赖为受控Core形状HTTP、unavailable Turn backend；checkout经bridge触发，GUI仅
点击个人插件详情，不宣称已有分享按钮、真实Core/MySQL、模型Turn、exec/PTY或Windows/live/packaged。
旧插件42/42（100%）维持dead/deleted/forbidden-to-restore；新增compat/deprecated为0。
五分享RPC本地合同5/5（100%）已接通，分享管理GUI0/1；不是P04b12d或整体产品完成率，
245 identity基线不提升。治理报告零边界违规/分类漂移；未跑覆盖未知并行写集的verify:local。
literal npm run verify:gui-smoke最终exit0：SHELL-01真实Electron/preload/IPC/App Server、重载、
三视口与memory入口24/24、43次IPC；console/page/legacy/mock计数均0。检查窄视口截图，
原件/tmp/lime-plugin-checkout-gui-smoke-20261018/summary.json，日志
/tmp/lime-plugin-checkout-gui-smoke.log。此为普通壳证据，分享产品范围只按上一段专项计账。
两仓窄写集whitespace及更新后的docs:boundary通过；全部本轮验证进程已退出，不进入release。

## P04b12b 分享保存与撤回（Core本地合同已验，产品待验）

上一轮 P04b12a 已完成源码、真实文件 IO、snapshot 重载与定向门禁，属于 progress。
本刀沿 Codex remote/share.rs 实现 upload-url、无账号凭据 PUT、POST create/update、
DELETE204；沿现役 created/shares/list/detail/installed，不新增分享 registry 或开发者认证 gate。
分享压缩限额单独为50 MiB，通用包仍100 MiB；显式manifest name优先，仅native name缺失/
空白时依Codex使用filename的.tar.gz stem兜底，standard root仍须name；filename不生成摘要。
扫描owner复用同一tar parser/manifest选择/组件提取，发现身份、版本和实际hash。

Core设计：同一upload record附分享上下文（actor、目标、base release、etag、一次性上传
capability hash及独立下载签名key）；短时随机capability PUT不接收账号凭据，不允许换bytes，
相同bytes重试幂等。每次创建/上传/finalize重新检查当前member及owner/editor；editor仅改包，
owner才能改ACL，LISTED和广泛workspace授权复用现役publisher规则。UNLISTED补workspace
reader。finalize同一仓储锁和MySQL事务提交catalog、release、扫描记录、分享ACL、审计与snapshot，
失败只回滚本次key/file/audit/seq；重复file_id/etag不生成新插件，过时base release不能覆盖新包。
删除在同一owner归档catalog并撤销release；既有installed/read每次重验并清投影，不删除历史。

分享bytes不经过通用公开asset路径。认证详情/installed只有明确includeDownloadUrls时签发
短时HMAC下载URL，绑定file、release、tenant/user和过期；无账号凭据GET仍重新检查当前
权限/策略及当前选中release，撤权、停用、更新或删除后旧链接拒绝。签名key仅内部record。
分享链接返回现役API目录详情入口，GUI链接路由在后续管理入口闭合，不假称已有网页分享页。
相同manifest name映射同一canonical时在写入边界拒绝，避免目录整体报身份冲突。

窄写集：Core新增model/plugin_share_upload、repo/plugin_share_publish与事务模块、
service/plugin_share_upload/download、controller/public_client_plugin_publish及同域测试；
既有record/scan/manifest、directory/installed投影、upload访问边界、Responder/routes与auth接线。
OpenAPI fragments/bundle、SDK TS/正式JS、types与API文档同步。Lime先仅计划及architecture
§7.2；后续App Server share RPC接线另登记具体文件。不碰CLI/TUI、专业预览、发布、证据目录
和未知并行写集；大中心文件只加接口/委托，不堆业务。

Verification Contract：root，P1/budget:normal。真实HTTP+当前auth -> 同一package扫描/
Repository+文件 -> 原子catalog/release -> authorized目录/installed/无凭据下载。覆盖50 MiB、
伪造/过期capability、跨租户/owner/editor/reader、撤权/停用、重复/换包/并发finalize、ACL、
snapshot重载与持久化失败、不绕过通用公开asset。先Go定向/race、SDK真实HTTP与完整Go、
OpenAPI/client-contract-sync、文档/whitespace；新Core进程/MySQL/模型Turn/App Server RPC/
Electron/CLI/PTY/Windows/live/packaged独立待验。无迁移/compat、部署、生产调用或真实数据库变更。
架构影响重大，root于2026-10-18确认同一owner/数据流，Lime architecture §7.2同步。
未验收不能核销完整插件或完整245方法目标；下一刀继续App Server五方法/GUI/checkout。


### P04b12b 本地验收结果（2026-10-18）

Core本切片源码和本地合同验收完成；完整插件/245方法目标仍active，App Server share五方法
尚未据此核销。current为同一package record/file store/scanner、catalog/release/ACL与tenant
policy；新建和更新均POST，upload-url在上传前提供etag，DELETE为204。上传原token不持久化，
仅存hash；下载使用独立key。无新增compat/deprecated或迁移，旧插件42项继续dead/deleted/
forbidden-to-restore，不恢复旧registry/SDK/renderer入口。

实现补充写集：Core middleware/request_context.go只加委托，新plugin_share.go仅为capability
PUT预检放行x-ms-blob-type，不向其它路由扩散、不放行账号凭据；SDK上传helper拆为独立
plugin-share.ts/正式JS并列入包files，不往大index堆传输业务。现役ACL更新复用publisher与
canonical冲突校验。显式空discoverability拒绝，避免默认LISTED越权；同版本base hash变化
也能阻断旧upload。显式tenant选中release策略继续优先；当前选中包替换、撤权、停用或删除后
旧签名URL拒绝。分享URL暂为认证API详情，不宣称公开GUI分享页已完成。

验证全部已收取terminal：

- `GIN_MODE=release make verify-go`最终exit0，现役Go模块fmt/vet/test通过。
- repo/service/controller/middleware分享、workspace与package定向`go test -race`最终exit0；
  覆盖并发/重复finalize、snapshot重载/失败回滚、同版本stale base、owner/editor/reader、
  publisher/空visibility/canonical冲突、跨账号/tenant、上传换bytes/篡改/过期、manifest fallback、
  独立HMAC下载/当前policy/creator/editor停用/ACL撤权/删除，以及公开asset/开发者complete旁路拒绝。
- Controller使用真实loopback HTTP和现役Bearer认证/Service/Repository/文件IO；raw响应、
  无账号凭据PUT/GET、重复上传、保存、下载、撤回204和撤回后拒绝通过；CORS预检为定向中间件测试。
- GORM接真实SQL driver接口探针：catalog/release/audit/snapshot同一次事务，任一表失败触发
  rollback且内存不发布。此为SQL调用边界，未连接真实MySQL，不证明断电/重启恢复。
- `make verify-contracts verify-client-contract-sync`最终exit0；source fragments经正式bundler同步，
  API文档、SDK/types已更新。`make verify-version-sync`通过。
- Node SDK/既有插件守卫14/14；SDK真实HTTP合同证明认证元数据调用与无凭据tar.gz PUT分离。
  工作区已有TypeScript编译器对SDK/types独立strict检查exit0；Core未安装/升级依赖。
  `npm pack --workspace @limecore/api-client --dry-run --json`exit0，正式JS与TS helper均入包。
- 两仓窄写集whitespace与Lime `npm run docs:boundary`通过。架构§7.2已同步数据流，root确认。

排查日志在/tmp/lime-plugin-share-{verify-go-final,race-final,contracts-final,sdk,types-final}.log，
SDK包清单为/tmp/lime-plugin-share-sdk-pack.json；仅作本地排查记录，不充当长期release evidence。
首次SQL探针失败因fixture Result缺LastInsertId，已修复fixture并重跑通过；首次SDK类型入口缺
Core本地tsc，改为已有编译器+独立paths配置后通过，未改变产品依赖。

本地Core切片实现/约定门禁100%；完整对齐不按此百分比核销。未验证：真实MySQL/进程重启/
断电、共享App Server share RPC、同包模型Turn、Desktop/CLI/PTY、Windows/live/packaged。
没有重建受影响证据目录、复用旧binary、提交、推送、部署或操作真实数据库。
下一刀P04b12c：共享App Server的share save/list/updateTargets/delete与50 MiB归档、无凭据PUT、
账号fence、本地编辑路径映射；checkout与GUI管理入口沿同一PluginStore继续闭合。

## P04b12a 包存储前置收口（源码/定向验证已过，产品待验）

本刀服务 P04b12 的 upload-url → 无凭据 PUT → finalize 主链。只读复核确认现役 upload
broker 将 bytes/session/report 全存内存，默认 URL 指向 example 域名且 runtime 没有接线。
先直接替换这一临时实现；分享 API、50 MiB 出站和 GUI/checkout 仍归 P04b12 后续，不据此核销。

设计：会话、内容 hash 和扫描事实进入现役 Repository/snapshot，同一锁内以 revision 做 CAS；
包原字节由同一 package owner 写入配置的私有不可变 hash 文件，原子发布后才持久化 metadata。
不往 snapshot 塞 100 MiB bytes，不新增另一套 registry，不保留内存内容 fallback。可信下载只读
verified 记录，读取时复验 hash/大小；失败写盘/扫描竞态/过期都不能发布 URL。已 verified 包不因
上传 TTL 到期而失效。上传 ID 改用随机值，重启不覆盖旧包。未引用的不可变文件暂不自动删除：
没有 verified 记录引用的对象不可下载，后续 GC 必须按持久化引用清理，不能失败时误删并发引用。

窄写集：Core 新增 model/plugin_package_record、repo/plugin_package_upload、service/
plugin_package_store 与同域测试；现役 upload/scan binding/submission consumers 收回 repository；
configs 三件套、runtime、错误响应和测试 helper、配置/API 文档同步。两个超过 1000 行的 repo
中心文件仅加接口嵌入/字段/初始化/snapshot plumbing；service 大测试文件只接既有 helper，业务和
测试进入新模块，不追加中心业务。退出条件是新模块承接全部上传状态，旧 broker/maps 删除。
Lime 仅本计划与 architecture §7.2。避让 CLI/TUI、专业预览、发布、证据目录和未知并行写集。

Verification Contract：root，P1/budget:normal。输入为既有认证包上传 HTTP；期望同一 tar.gz
经上传/静态扫描/发布绑定/下载，重建 service + snapshot 后 bytes 和扫描事实仍一致；不触发
Agent tool/approval/runtime event。失败停在 storage/repository，HTTP 返回脱敏 500，冲突 409；
覆盖 CAS 竞争、写盘失败回滚、原包不受影响、过期、重复 complete、重启、损坏/链接/越界与
100 MiB 既有预算。必跑定向 Go/race、make verify-go、verify-contracts/client-contract-sync、
包 HTTP/SDK 合同及两仓 docs/whitespace 守卫。新分享 HTTP/App Server RPC、模型 Turn、
Electron/CLI/PTY、MySQL、Windows/live/packaged 暂未验，不计本刀产品完成率。
存储目录为空时包上传 fail-closed；生产须显式配置持久卷和 publicBaseUrl，单实例现有 snapshot
部署边界不因本刀变成多 writer 承诺。配置变更不执行部署或真实数据库操作。
架构影响重大，图同步到 Lime architecture §7.2；root 于 2026-10-18 确认 owner/数据流/边界。
状态保持 active；完成后下一刀实现分享 capability 和原子 finalize。


实施/验证补记（2026-10-18）：旧 package broker、进程内 bytes/session/report maps、
顺序上传 ID 和 example 下载基地址已删除。当前状态只由 Repository 的同锁 revision CAS
持有并写入现役 snapshot；原字节是配置目录中的不可变 hash 文件，不新增元数据 registry。
扫描/发布绑定/审核 consumers 已全部改用同一记录和 hash 复验，schema/SDK DTO 签名不变。
随机 ID 防止 service 重建后与旧对象重号。重复 complete 返回原扫描事实，verified 包不受
上传 TTL 影响；损坏、丢失、链接和越界均 fail-closed。并发同 bytes 只发布一个完整对象；
持久化失败只恢复本记录，不回滚其它领域；上传期间换包的旧扫描不能提交。

配置三件套和 runtime 已接 plugin.packageRootDir / PLUGIN_PACKAGE_ROOT_DIR；默认留空
时上传返回脱敏500，启用后数据库初始化失败会拒绝启动。生产必须显式配置持久卷绝对路径
及 HTTPS publicBaseUrl，未部署或改真实环境。HTTP错误合同补404/409/500，基础设施失败
经发布preflight返回脱敏500，不混成 components 校验失败；OpenAPI source由正式bundler
生成bundle，API/配置文档和SDK失败传播回归同步。未增加客户端字段，所以types/SDK生产签名
无变更；此处不复用上轮TypeScript结果声称本轮重新验证。

验证最终终态：GIN_MODE=release make verify-go exit0，覆盖全部现役Go模块fmt/vet/test；
configs/repo/service插件race通过，controller插件race修正后通过；最终
make verify-contracts verify-client-contract-sync exit0。Node包上传/目录/分享HTTP合同及旧路
回流守卫11/11，syntax、两仓窄写集whitespace与Lime docs:boundary通过。
首轮service编译暴露旧fixture引用已删除example常量，已改为当前配置URL。较宽Plugin race
暴露既有并行HTTP测试重复gin.SetMode写全局变量；移除插件两份测试中六处全局写入，保留
t.Parallel并重跑通过，不以降低并发隐藏业务竞态。一次复跑命令工作目录错误未修改源码，
下一次编译暴露已无消费者的gin import，均已修正；race失败日志保留，不计green。

主要新文件：model/plugin_package_record.go、repo/plugin_package_upload{,_test}.go、
service/plugin_package_store{,_test}.go、configs/plugin_package{,_test}.go、
controller/plugin_package_storage_test.go、scripts/plugin/package-storage-contract.test.mjs。
现役upload/binding/submission/preflight、Repository/snapshot字段、runtime/配置和HTTP错误
处理仅作直接接线；大中心文件未追加业务逻辑。共享Test helper显式配置隔离t.TempDir，
没有读取用户包或重建被删证据目录。Lime只改本计划与architecture §7.2。

临时日志：/tmp/lime-plugin-package-storage-{targeted,race,controller-race-final-pass,verify-go-final,
contracts-final,sdk-all,lime-docs-final}.log；用于本地排查，不冒充长期产品/release证据。
本轮100%只指已声明的源码/定向门禁完成。证据层级为真实文件IO、snapshot持久化替身与重载、
同一Repository重建service、真实loopback HTTP及SDK；未运行实际MySQL重启/断电、完整Core
进程重启、分享协议、App Server RPC、模型Turn、Electron/CLI/PTY或Windows/live/packaged，
这些本轮产品验收为0%，整体完成率不作无证据估算。

分类：Repository/immutable store/config/HTTP均为current扩展；旧内存broker为dead/deleted/
forbidden-to-restore；compat/deprecated新增0，旧插件42项删除基线保持。完整目标active。
下一刀P04b12b在此同一owner实现50 MiB分享upload-url、无账号凭据capability PUT、静态发现
包身份和原子finalize，再接share五方法与GUI/checkout。未提交、推送、建分支或操作生产。

## P04b11b workspace 分享权限（源码/定向验证已过，产品待验）

主目标：全部合理能力沿共享 App Server/runtime 对齐。本刀先落 Core 的授权与 HTTP 合同，
再接 App Server 的 shared/vertical collection、canonical identity 与分享 DTO，不缩减后续
分享 tar.gz 出站及真实产品验收。源码证据：Codex core-plugins/src/remote.rs:729/920/2228、
remote/share.rs:132/213/309/341；普通 WORKSPACE list 只列 LISTED，shared endpoint 是显式
分享 truth；UNLISTED workspace reader 是链接访问，不能自动进入 shared；created 是 WORKSPACE
creator 的分享列表，与 scope=USER 分开。上述是客户端源码事实，不冒充上游服务端实现。

Core 设计选择：catalog.directory 持有 discoverability/targets，creator 不变；group 的 ID 为现役
Organization.ID，授权只查同租户 active Organization + active OrganizationMember + active user，
不拿 role 名当 group，不另建群组或分享 registry。creator-owned WORKSPACE 只在 creator tenant
可读；PRIVATE 需 owner/显式 user/group/workspace target，UNLISTED workspace reader 仅给链接
详情/安装权限；通用目录与 shared/created 视图分别过滤。显式 tenant enablement 永远优先。
owner 才能改 ACL；editor 留给包更新，不赋予 ACL 管理；LISTED/全 workspace 授权需当前租户
级治理管理员授权（现役 tenant role binding）；UNLISTED workspace reader 是允许的链接访问。这是 Core 的可审查权限策略，后续产品证据继续校准。
每次详情、安装和 installed 对账重新求值，换租户/停用/移除成员/撤 target 均不继承旧可见性。

窄写集：Core 新增 model/plugin_share、repo/plugin_workspace_access 与 repo/plugin_share、
service/plugin_workspace 与 controller/public_client_plugin_shares 及同域测试；既有 catalog/
resolver/interface/router/auth 仅接线，深复制沿现役 directory_json/snapshot；OpenAPI source/
bundle、SDK/types 与 API 文档。Lime 本刀先计划与 architecture §7.2；接客户端时补写具体写集。
CLI/TUI、专业预览、发布及未知并行写集避让。已有大文件只增声明/委托，业务进入同域模块。
定向撤权回归发现角色同步遗留 active 租户绑定，追加原先干净的 repo/governance 同步函数
窄补丁：停用被移除的 tenant role，保留独立 organization 绑定。

Verification Contract：root，P1/budget:normal。真实 HTTP -> 当前 auth -> 同一 catalog/release/
policy/组织成员事实 -> list/detail/install/installed 与 shares PUT；覆盖 PRIVATE/UNLISTED/
LISTED、user/group/workspace、跨租户、owner/editor/reader、停用与撤权、分页视图绑定、非法/
重复 target、失败写盘不可见、snapshot 重载与并发 ACL 更新。先定向 Go/race，再 verify-go、
OpenAPI 与 SDK HTTP/types；新 stdio/Electron/CLI/PTY、MySQL/真实 Core 同包 Turn 独立待验。
不操作真实数据库/生产，不新增迁移/兼容；未知 GUI 证据目录协调未答复，继续不重建。

客户端续刀写集：App Server plugin_remote/wire、installed、runtime/plugins/remote 与新增
collections 模块，projection、同一 plugin_catalog/remote 安装及 reconcile 的 canonical 接线；
remote_plugins_jsonrpc 的集合/失败及安装回归。无公共 method/schema 变更，不碰 GUI/CLI/TUI
写集。SharedWithMe 读取显式 shared truth 与 fresh installed 同时分出直接分享/链接安装两桶；
canonical 永远为 workspace-shared-with-me，view 桶名不能成为第二份安装身份。vertical 使用
GLOBAL collection=vertical，limit 对齐200。用公共 JSON-RPC 验证，真实产品进程仍独立待验。

实施补记（2026-10-18）：Core 已落 discoverability/targets、三个主体的真实权限求值、
shared/created/shares HTTP、owner-only ACL 与管理员发布限制；UNLISTED workspace reader
保留链接访问。每次 list/detail/install/installed 重验，group 使用真实组织和成员，停用/移除/
撤 target/换租户都不沿用旧授权。目录深复制与现役 directory_json/snapshot 共用，无新增表或
旧数据迁移。catalog/ACL 写入在同一仓储锁内验证，失败不发布新 ACL/audit，持久化错误对
客户端返回不含存储细节的500。canonical 冲突按 discoverability 的实际安装 namespace 拒绝。
撤权回归暴露旧租户角色同步只增不撤的问题，已在原治理 owner 禁用移除角色的 tenant 绑定，
不把组织角色混成租户权限。首轮新增 repo 测试的状态更新接口名错误已改用现役 management API。

App Server 已接 SharedWithMe/vertical：分页200、显式 shared truth、fresh installed 两桶，
metadata 投影与同一 canonical install/reconcile/store、read view 到 canonical 还原；新增真实
公共 JSON-RPC 用例覆盖 private/unlisted、权限元数据、分页/错误、同一包冷读、discoverability
切换后清旧缓存、撤回。未增加 protocol method/schema，plugin/share 五方法仍 planned；
本刀不凭 HTTP 实现把它们标成 implemented。GUI集合入口、其它集合fresh installed/cache策略
仍需后续闭合，不用当前local投影核销；完整245方法基线不变。

验证：Core 首轮定向 Go JSON 69/69（含子用例）；最终同范围race三包通过，含后补的
canonical共存/冲突回归。完整 GIN_MODE=release make verify-go exit0；OpenAPI bundle、
verify-contracts/client-contract-sync通过。SDK真实HTTP与旧入口负向守卫10/10，SDK/types
使用既有TypeScript及workspace路径映射noEmit通过，syntax与窄写集whitespace通过。
Lime公共JSON-RPC最终42/42通过（47.77秒；2个stdio显式排除）；完整test:contracts通过，
含300项client checks、schema无漂移和commands/modality/scripts/release/CLI/docs守卫。
初次 npm integration helper 发现强加 --tests 扩大目标后主动中止，改用同一既有环境helper
执行精确cargo target，不计中止轮为通过；有效命令为
`cargo test --manifest-path lime-rs/Cargo.toml -p app-server --test remote_plugins_jsonrpc -- --skip stdio --test-threads=4`。
插件store owner最终54/54通过（2.48秒），有效命令为
`cargo test --manifest-path lime-rs/Cargo.toml -p app-server --lib plugin_ -- --test-threads=4`；
上述两条cargo命令均复用现有Rust环境/V8 helper，无依赖安装或配置修改。

架构图/owner/依赖方向由root于2026-10-18确认，见Lime architecture §7.2。临时日志位于
/tmp/lime-plugin-workspace-*，只用于本地排查，不冒充长期产品/release证据。
分类：current扩展；compat/deprecated新增0；旧插件42项删除基线仍dead/deleted/forbidden-to-restore。
已完成定向验证的通过率100%；新stdio/Electron Gate B/CLI exec/PTY、真实Core同包Turn、
MySQL、Windows/live/packaged在本轮的产品验收0%，不据此估计整体百分比。原GUI证据目录
协调未答复，继续不重建受影响目录或复用旧binary。完整目标active；下一刀P04b12分享
save/list/updateTargets/delete/checkout、50 MiB tar.gz出站/签名上传/finalize及GUI管理入口。
未提交、推送、建分支或操作真实数据库/生产。

P04b12只读预备复核：Codex remote/share.rs 使用50 MiB分享归档上限，upload-url请求带
filename/mime_type=application/gzip/size_bytes/可选plugin_id；响应必须先有etag，再向upload_url
无认证PUT，携带x-ms-blob-type=BlockBlob与application/gzip，最后以file_id/etag/权限finalize。
Core现役package upload仍为100 MiB，分享预算需单独限制并复用其包扫描/对象owner，不能把
全局入站/下载预算盲目改为50 MiB。checkout只允许shared canonical，借助同一下载/解包owner
进入个人marketplace与local-path映射；上游在创建目录/市场或映射失败时回收本次新建checkout。
服务端签名能力、过期/一次性上传约束和finalize原子性仍需实施前设计，不把只读事实写成实现。

## P04b11a GLOBAL/USER 目录事实（源码/定向验证已过，产品待验）

主目标不变；本刀给既有 catalog 增加 typed directory（scope、creator租户/用户、collection），
同一 release/tenant-policy resolver 为 list/detail/install/installed 提供授权事实。GLOBAL读取
active catalog的当前ready release，USER仅当前租户的creator可见；已有tenant策略优先，不能
绕过paused/whitelist/gray/license。默认未配置directory仍是现役WORKSPACE发布，不读取旧插件。
vertical仅GLOBAL，分页context绑定collection；同步Codex目录limit=200。canonical缓存key冲突
必须拒绝，opaque ID保持现役catalog身份，不按scope/用户/release生成新ID。

窄写集：Core model/{plugin_catalog,plugin_directory}、新增目录事实service/repo模块、既有
catalog/release preflight及directory resolver接线、catalog snapshot clone/row/schema、相关
service/repo/controller回归、OpenAPI source及bundle、packages/types与SDK合同测试、API文档；
Lime仅两仓计划及architecture §7.2，不碰CLI/TUI、专业预览、发布和未知并行写集。
源码依据Codex remote.rs:697/729/855与collection vertical；不重新执行已有REA安装包分析。

Verification Contract：root，P1/budget:normal。真实HTTP路由 -> 当前认证 -> catalog/release/
tenant policy -> directory/install/installed；覆盖GLOBAL/USER身份、跨租户/换号、策略撤回、
分页collection绑定、版本更新/撤回、canonical冲突、snapshot重载和失败回滚。先定向Go与race，
再make verify-go、contracts、SDK/types。仅本地受控进程，不操作真实数据库/生产，不计模型Turn
或Desktop/CLI/TUI Gate B。workspace private/unlisted/shared targets和group membership仍欠账，
由P04b11下一刀实现，不以本刀核销。

实施/验证补记（2026-10-18）：上述源码已落地，新增typed directory并复用同一resolver；
跨catalog同名插件映射相同canonical key时一致拒绝。catalog create/update提取同一locked
mutation，保存成功前读锁不可见；失败只恢复本次catalog、audit和seq，不全量回滚其他领域。
snapshot深复制/重载、SQL JSON投影和现役初始DDL同步；按开发期指令未加旧数据迁移。
OpenAPI source/bundle、SDK/types与API文档已同步，architecture §7.2图由root确认。

验证：定向Go JSON结果63/63（含子用例，service/repo/controller），同范围race三包通过；
完整 `GIN_MODE=release make verify-go` exit0，含所有现役Go模块fmt/vet/test。
`make verify-contracts verify-client-contract-sync`通过；SDK HTTP合同最终9/9（含新scope/
creator/vertical与旧入口负向守卫）。SDK/types使用现有TypeScript及本地workspace路径映射
noEmit通过；无安装依赖。脚本syntax、窄写集whitespace及Lime docs boundary通过。
首轮曾因夹具错误（whitelist需gray、preflight以Valid=false返回、同一seed用户登录撤销旧
session、SDK envelope缺message）和旧允许canonical冲突断言失败，均修正后复验，不隐去失败。
最初独立tsc命令缺可执行路径/workspace映射，改用现有编译器和路径映射后通过。
原始Go日志：`/tmp/lime-plugin-directory-go-targeted.jsonl`、`/tmp/lime-plugin-directory-go-race.log`、
`/tmp/lime-plugin-directory-verify-go.log`；临时日志不作为长期产品或release证据。

分类：catalog/directory/release/policy/snapshot为current；compat/deprecated新增0，旧插件
仍dead/deleted/forbidden-to-restore。本刀定向验证通过率100%；真实Core发布同包进入Turn、
MySQL、Desktop/CLI/TUI、Windows/live/packaged验收未执行，不以单进程HTTP测试冒充Gate B。
目录协调未答复，继续不重建受影响GUI证据目录或复用旧binary。完整目标active，下一刀
P04b11b补workspace private/unlisted/shared targets、真实group membership与权限撤回，
随后P04b12分享tar.gz出站；本刀百分比不估算整体完成度。未提交、建分支或操作生产/真实数据库。

## P04b10 全量 installed 对账（源码/定向验证已过，产品待验）

目标：同一 App Server 提供 Codex `plugin/reconcile`；全 scope installed 分页完整验证后，
按当前账号发布唯一 PluginStore 安装投影，再物化新版本并清理撤回缓存。投影不保存下载 URL
或凭据；未下载/下载失败与云端已安装分开表达。缓存清理失败也不能让撤回插件继续进入 Turn。
跨进程沿用 remote gate，所有本地写入沿用 store mutation lock，账号在等待后及提交前重验。
显式 install/uninstall 更新同一投影；不建立第二 registry/runtime，不迁移旧插件。

窄写集：新增 plugin_remote/installed.rs、plugin_catalog/remote/{state,reconcile,package}.rs；
既有 PluginStore、catalog、install/mutation 与 RuntimeCore/processor 仅消费接线。
公共 `plugin/reconcile` 的 DTO/method/envelope/schema、package/Desktop clients、gateway/catalog/
current bridge timeout 和 fixture 同步；两仓计划与 architecture §7.2 同步。
未知 CLI/TUI、专业预览、发布写集继续避让。旧范围表的 plugin/share 五方法及 plugin/skill/read
改为 planned，缺少当前实现不得继续作为 excluded 理由；固定上游方法身份清单不变。

Verification Contract：root，P1/budget:normal。公共 JSON-RPC -> AccountManager -> installed
分页 -> 同一 PluginStore 投影/物化 -> installed/Skills/MCP/Hooks 消费。覆盖空快照、分页失败/
重复/循环/非法身份、换号、同版本保留、版本更新、部分物化失败、撤回及清理失败、保留本地
启停 override、与 install/uninstall 并发。先协议/owner/公共 RPC，再 contracts 和 typed clients。
源码/受控 issuer 不计真实 Core/MySQL/stdio/GUI/模型 Turn；产品新产物证据仍待目录协调。
架构责任 root，确认必须随最终实现图落盘；未验证项不计完成。整体目标 active。

实施补记（2026-10-18）：新增shared `plugin/reconcile`，全量分页验证、按账号原子投影、
同版本保留、更新/部分失败、撤回/清理重试与现役tar.gz preparation共用。PluginStore.cached
仅供对账捕获 inactive 包并重试清理，不成为第二个runtime读面；runtime只用installed。
变更类别合并旧/新声明，portable Apps只报告声明变化、不启用组件；物化后直接检查本包，
避免逐包扫描整个store。投影写入fsync+同目录原子替换，显式mutation的配置失败回滚投影。
客户端/GUI/Host/current bridge/schema/typed clients同步完成；无新增依赖、迁移或compat。

已完成验证：P04b10首轮public RPC 37/37（2个stdio跳过）；owner plugin_ 54/54；
前端/Host/范围守卫首轮78/78，追加gateway与顺序断言后API+页面24/24，唯一用例共79个。
完整test:contracts通过（client 300 checks、无schema漂移及全部命令/脚本/发布/CLI/docs守卫）；
Electron、Renderer/Node与package客户端TypeScript noEmit全通过。脚本syntax、定向format/
whitespace通过，更新后的docs boundary通过。最后追加portable声明与激活分离及单包检查后，
最终public RPC复验38/38通过（46.30秒，2个stdio显式跳过），含portable Apps声明/激活分离。
以上验证仅当前工作树的定向边界，不代表并行改动归属。
GUI新产物Gate B、stdio、真实Core/MySQL/模型Turn和Windows/packaged尚未验，原目录协调问题
未答复，不重建受影响证据目录、不复用旧binary。CLI/TUI/专业预览/发布/未知写集继续避让。
源码/定向层分类current；compat/deprecated新增0，旧插件仍dead/forbidden-to-restore。
架构图已由root于2026-10-18确认。本刀定向用例通过率100%，产品验收0%；完整目标active，
不得用本分母估算或核销整体完成度。

## P04b9 App Server 远端 mutation 与事务（源码/定向验证已过，产品待验）

主目标仍为完整对齐。本刀先闭合真实 install/uninstall mutation 与唯一 PluginStore 事务，
随后完成 installed 分页对账；不因先落 mutation 缩减对账、分享或三产品面验收范围。
源码复核更正：Codex core-plugins/src/remote_mutations.rs:154 明确先下载/物化，再 POST install，
避免坏包留下云端安装；P04b8 下一刀描述中的先后顺序不准确。本实现先完成私有 staging
（含GLOBAL准备、manifest/组件/digest校验），再认证mutation，最后唯一cache/config提交。
mutation失败保留旧包/config；远端已成功而本地提交失败通过后续installed对账收敛，不回滚
可能早已存在的云端安装。uninstall先认证远端确认，再在同一store owner删除自身包/config。

窄写集：plugin_remote.rs 与新增plugin_remote/mutation.rs；plugin_catalog/remote.rs、
新增remote/gate.rs与remote/mutation.rs；install.rs仅将既有staging/commit拆成单一事务对象；
Local datasource plugins.rs和RuntimeCore plugins.rs做卸载及组件失效接线；同域公共RPC夹具、
remote-plugin-catalog-fixture-smoke.mjs、两仓计划/插件合同/architecture §7.2。
跨进程remote gate先于store mutation lock，认证在等待后重新捕获，提交时再核对账号。
CLI/TUI、专业预览、发布及未知并行改动继续避让；不修改公共schema或增加兼容入口。

Verification Contract：root，P1/budget:normal。公共JSON-RPC -> AccountManager -> 认证Core形状
POST -> 私有包staging -> 唯一物化事务。验证正确method/query/body、id/enabled响应、HTTP拒绝、
坏包不发mutation、mutation失败保留旧安装、换号不提交、失败/成功卸载、双peer串行。
先owner与in-process公共RPC，contracts同步；新真实stdio/GUI产物与目录协调后补齐，
不复用旧binary或把受控issuer冒充真实Core/MySQL。installed reconciliation未实现前明确欠账。

实施/验证补记（2026-10-18）：App Server mutation、私有 staging 与唯一提交事务已落地。
`npm run test:rust:unit -- -p app-server plugin_` 最终54/54；公共RPC integration
`remote_plugins_jsonrpc --skip stdio --test-threads=4` 25/25通过，2个stdio场景明确排除。
首轮owner为53/54，旧uninstall用例仍只期待前置invalidate；同步成功卸载后的第二次invalidate
断言后通过，不删除失败日志语义。此前完整contracts、脚本syntax/format均通过。
这些结果只证明P04b9源码/owner/in-process边界，后续P04b10已继续修改同域，需独立重验；
新产物stdio/GUI、真实Core/MySQL/模型Turn未验证。current为现役mutation/store，无新增compat/
deprecated；旧插件仍dead/forbidden-to-restore。P04b9用例验证完成54/54+25/25（100%），
P04b9产品验收0%，整体目标active，不据此给出伪整体百分比。

## P04b8 远端安装事实（Core 基础合同已验，两仓联动待接）

主目标保持完整对齐。本刀先交付 Core `GET ps/plugins/installed`、`POST ps/plugins/:id/install`
和 `POST ps/plugins/:id/uninstall`，对齐 Codex core-plugins/src/remote.rs 的 raw snake_case 合同。
全 scope 默认 limit=200、可选单 scope/下载 URL、身份绑定分页；mutation 使用 opaque ID，
可选 install_attempt_id。安装必须通过当前目录授权和安装策略；卸载允许当前用户移除已失去
目录可见性的自身安装事实。重复安装/卸载幂等，安装时间稳定，用户与租户隔离。

窄写集：Core 新增 model/plugin_installation.go、repo/{inmemory,mysql_snapshot}_control_plane_repo_plugin_installation.go、
service/control_plane_plugin_installation_service.go、controller/public_client_plugin_installations.go
及同域测试；既有 repo 中心文件只接 interface/map/snapshot，controller/public_client.go 只接三路由；
OpenAPI client paths/插件 schemas、SDK/types、API 文档、两仓计划和客户端 architecture §7.2；
controller/tenant.go 的 ControlPlaneResponder 只补三个必要方法声明。
service/control_plane_authorization.go 只补三条精确 method/path 的租户 token 授权。
超长中心文件只加声明/机械接线，不追加业务；不触碰未知运行时、专业预览、发布、CLI/TUI。

唯一持久化 owner 沿用 MySQL snapshot 的 remotePluginInstallations 字段，非旧 install-state
telemetry；不另建数据库/迁移/兼容表。保存候选快照成功后才发布内存新状态，失败不全仓回滚。
Apps 授权尚无真实 connector 读面时省略 app_ids_needing_auth（上游 optional），不伪造已授权。
GLOBAL/USER 目录、connector 授权、分享和客户端 reconcile 仍需后续完整实现，不以空列表核销。

Verification Contract：root，P1/budget:normal。真实 controller -> service -> tenant/user repository；
定向 Go 验证安装/卸载/幂等、鉴权、策略拒绝、跨用户租户隔离、当前授权分页、重启快照恢复、
持久化失败/并发。同步 OpenAPI bundle、SDK 请求回归、类型与契约门禁。
当前用户尚未回答验证目录协调问题；不在受影响目录重建 GUI 产物。本刀服务端验证不冒充
实际 MySQL、Electron、模型 Turn 或三产品面 Gate B。客户端 mutation/reconcile 尚未接线。

实施与验证（2026-10-18）：Core 三条基础 installed/mutation API 已落地，同一租户 token
授权边界、ControlPlaneResponder、仓储接口及快照装载/保存均已接线；所有新业务放在小模块，
中心大文件仅机械声明。mutation 不保留旧安装遥测。安装记录只保存 tenant/user/opaque ID/
installed_at，列表的 enabled=true 表示当前用户的安装意图，管理侧禁用由 status/policy 表达；
未接入远端 per-skill 修改合同前 disabled_skill_names 为真实默认空数组，不声称已支持云端偏好编辑。
Apps 授权未知时省略 optional 字段。客户端仍读取本地物化记录，尚未接云端 mutation/reconcile。

实际校验：

- `go test ./internal/repo ./internal/service ./internal/controller -run 'TestRemotePlugin|TestPluginDirectoryHTTPBoundaries|TestPluginInstallTelemetryRouteIsDeleted' -count=1` 通过。
- `GIN_MODE=test go test -race ./internal/repo ./internal/service ./internal/controller -run 'TestRemotePlugin' -count=1` 通过：6 个顶层场景，含20个HTTP边界子场景。
- `make verify-go` 全部模块格式/vet/tests 通过（同时覆盖当前工作树的并行代码，不声明其归属）。
- `make verify-contracts`、`make verify-client-contract-sync` 通过；OpenAPI bundle 由 source fragments 生成。
- `node --test packages/api-client/plugin-installation.test.mjs` 1/1；SDK/types noEmit 检查零诊断。
  Core root 无 TypeScript 模块，检查工具显式使用 Lime 既有 node_modules/typescript；没有安装或修改系统环境。
- 新增 SDK 三方法的 JS 区块由 TypeScript transpile 输出插入，未重写其它区块；JS syntax、定向 diff whitespace 和 Lime docs:boundary 通过。

失败记录：首轮漏接 ControlPlaneResponder 导致编译失败，补齐声明后 owner 通过；HTTP 首轮
被租户 token 权限白名单挡住，补三条精确 method/path 后全部通过。旧 install-state 路由
负向守卫仍通过。未写入受影响的 .lime 验证目录，没有新 Electron/stdio/CLI/PTY/模型 Turn
或真实 MySQL 证据。存储故障和重启由现役 snapshot repository + 受控 store 场景验证。

治理分类：current 为 Core 安装事实和共享 App Server 本地 PluginStore，二者职责不同，
客户端对账尚待建立；本轮无新增 compat/deprecated，无恢复 dead 插件、遥测或凭据入口。
架构图已同步 architecture §7.2，root 于2026-10-18确认。完成度：本刀基础服务端接口代码与
合同验证3/3（100%）；两仓安装闭环和真实产品验收0%，完整目标保持active。

下一刀P04b9：App Server 内部 Context 复用 AccountManager 发送认证 mutation，校验返回
opaque ID/enabled；顺序已由P04b9复核更正为先包校验/私有staging、远端确认后本地提交，
失败对账与卸载先远端确认后移除本地包。installed 全scope分页同步当前账号安装/更新/撤回，串行 gate 覆盖换号/多进程，
失败不删除未经完整分页确认的缓存，组件失效贯穿同一 owner。同步公共RPC/真实双stdio夹具，
待目录协调后重建GUI证据，继续share/prefer-cache/vertical/GLOBAL-USER授权等剩余合理合同。

## P04b7 GLOBAL 包准备与 Apps 原文（实现已落地，证据重建待协调）

目标：对齐 Codex `core-plugins/src/remote_bundle.rs:508` 的 GLOBAL staging 准备，
在唯一 PluginStore 事务之前覆盖原生 manifest release 版本，保留受支持 portable 原文；
Apps 原文保留未知字段，GLOBAL 按有效声明/extension 路径或默认 `.app.json` 写入，省略保留、
显式空覆盖；USER/WORKSPACE 不改包元数据。安装读面复用同一路径规则，默认 Apps 被真实消费。

窄写集：客户端 plugin_catalog/{remote,manifest,apps}.rs、新增 remote/preparation.rs；
plugin_remote/wire.rs、runtime/plugins/remote.rs 的原始 Apps 消费；remote_plugins_jsonrpc
安装夹具和新 preparation 场景，以及两仓计划、architecture §7.2 与插件合同。
既有未知并行变动保持；不触碰 CLI/TUI、专业预览、发布或 Core 业务/API。本刀不新增协议。

Verification Contract：root，P1/budget:normal。public plugin/install -> 认证详情 -> tar.gz ->
私有 staging 准备 -> 现役物化事务 -> public plugin/installed、app/list；失败保持旧包/config。
验证 GLOBAL 原生/portable/inline 与 overlay 路径、缺省/空、未知字段、两类非 GLOBAL、
路径越界不写包外、写入失败与旧安装保留。先 owner/公共 RPC 回归，再 contracts 与文档门禁；
真实新产物 stdio/GUI 尚未验收，不复用 P04b6 binary 冒充本批证据。完整目标仍 active。

源码复核补记：Codex loader 的 Apps 运行时消费仅启用 native/Legacy 格式；portable
GLOBAL 准备仍可写 Apps 原文，但不能据此启用组件。追加 components.rs 单点消费者与原本
干净的 plugin_catalog/tests.rs 对应旧断言；新公共安装场景分开验证原文落盘与 portable Apps
不启用。此前 portable Apps 正向断言属于过期合同，直接替换，不保留双轨。

实施续记：新增真实双 stdio peer 场景，安装/版本/default Apps/卸载共用相同 app-data；
测试 peer 固定产物 helper 由既有 stdio fixture 复用。Apps 输出路径沿用 tar 的跨平台安全
子集（拒绝反斜杠、冒号和 parent/root），避免 Windows drive/UNC/ADS；非法声明回到默认
路径。完整 contracts 已 exit0；Rust owner/公共安装回归仍在构建，未计通过。

验证续记：首轮公共准备回归4/7，源码在编译中更新与共享 target 旧 binary 混用，
保留 public-preparation.log；binary 摘要/缺失当前远端安装标记见 first-run-binary.json。
标准 Rust plugin_ owner 54/54通过。已将 warm target 克隆到本批独立目录，仅 clean 该目录的
app-server 并重建，避免共享产物串包。追加既有远端 Electron fixture 与小 tar helper 窄写集，
支持 GLOBAL/WORKSPACE，验证 GLOBAL 原生版本覆盖、完整 Apps 原文与真实 stdio Apps 消费，
以及 GUI 卸载后的 Apps 消失；使用新隔离快照，旧 P04b6 evidence 保持不动。

验收中断记录（2026-10-18）：GLOBAL 准备、原始 Apps JSON、唯一 Apps 路径/default 读取及
portable Apps 不启用的实现已落地。标准 Rust plugin_ owner 54/54；独立固定产物公共 RPC
最终20/20（4 threads，122.46秒）；GLOBAL/WORKSPACE 两组 Electron+stdio 安装、换号、
reload、冷启切回、卸载均 exit0，截图已人工检查。两组产物2846项摘要一致；GLOBAL 66条、
WORKSPACE 80条成功插件IPC观测包含跨阶段重复，不按独立请求计数。最终 App Server SHA256
为 d7016c3deb80e163b040b4785929f891cf203fdf8d9d08863ad77a60e4073540。
完整 contracts、脚本治理、格式及文档边界通过；旧插件42/42仍不存在，旧内部 wire 亦不存在。
上述为执行期间观察结果，目前不能作为可复查磁盘证据交付。

首轮准备回归4/7涉及编译中源码更新与共享target旧binary；独立产物首轮19/20，新增stdio
等待超时。测试仅将plugin/install消费窗口按现役150秒调整，补method/id/预算诊断；
定向1/1及最终整组20/20通过。该次首轮超时未记录method，不能断言唯一根因。
Electron资产owner按正常流程添加@loader_path，固定六项产物中App Server重新构建，
五项支持产物沿用已核版本；原始build SHA与完成rpath准备后的SHA不同，不混用。

随后独立shell smoke因复制基线缺失CharacterMentionPanel懒加载chunk失败，未形成summary；
准备重新构建桌面资源期间，多个本批临时目录、此前P04b6临时快照、仓库.lime/qc与新建
.lime/validation/plugin-global-1792255311又先后消失。观察到文件删除，未确定执行者或原因。
已停止写入验证目录，并依parallel-agent-collaboration.md请求协调清理范围/固定验收路径。
源码与两仓计划保留；本批及先前引用的.lime/qc证据可用性须重建/逐项复核，不能标记验收
完成或进入release evidence。完成度：源码实现已落地；本刀可复查验收0%（证据待重建），
整体仍active。下一步先重建稳定目录中的产品证据，再继续服务端installed/reconcile/share。

## P04b6 客户端 tar.gz 下载、物化与来源（本切片已验，整体 active）

主目标仍为 CLI/TUI/GUI 同一后端及完整插件对齐。本刀认领 App Server 插件域：从
runtime/plugins/remote 抽出共享 plugin_remote Context/wire（不保留旧转发），新增下载/解包
及来源记录；现役 PluginStore/install/catalog、Local datasource 插件委托/初始化精确接线；
App Server manifest 仅接已存在 workspace tar，锁文件仅同步该依赖；同域公共 RPC 与恶意包
回归、两仓计划、architecture §7.2。既有未知脏增量保留，CLI/TUI、Hooks 具体实现、GUI、
专业预览、发布入口、其它依赖不触碰。原插件删除仍禁止回流，不新增兼容或迁移。

Verification Contract：root；P1/budget:normal。plugin/install(remote opaque ID) -> 共享
AccountManager 认证详情 -> 无账号 header 的服务端 bundle URL 下载 -> 私有暂存安全解包 ->
现役 PluginStore 原子 staging/config 提交。60 秒完整下载、100 MiB 压缩、512 MiB 文件总量；
只接受普通文件/目录，拒绝路径穿越、链接、特殊类型、重复/冲突、gzip 损坏/截断和额外流。
HTTPS 下载及重定向逐跳校验；只有当前 loopback issuer 可使用同源 HTTP，不放宽 cloud/request。
URL/token 不进入 renderer/错误/来源文件。schema_version/opaque ID/账号 fingerprint 与包绑定；
所有 Skills/MCP/Hooks 读取同一 store，换号/注销不可把另一账号包或本地同名缓存算作已安装。
失败保持旧 cache/config，安装中换号拒绝提交。先定向 owner/公共 JSON-RPC/HTTP 回归，再执行
contracts、依赖版本与文档门禁。真实 Electron/CLI/Turn、server installed/reconcile/share、外部
平台内容验证与 Windows/packaged 仍单独欠账，未验证不进入 release evidence。

实现补记：包下载不转发账号 header，使用私有临时文件保留原字节；解包不执行包代码。
cache base 来源记录与账号 fingerprint 同事务暂存，卸载拒绝另一账号包；持久 data 增加
账号 namespace，MCP 和 Hooks 仅作共享 data_root 错误传播接线，同域消费者测试机械同步。
客户端另外保留 10000 entries，并限制 tar metadata/padding 32 MiB overhead，防止仅由
padding/长名元数据构成的 gzip bomb；这些明确为 Lime 安全策略，不冒充 Codex 上游配额。
安装成功后再次失效 MCP，防止下载期间并发 Turn 重建旧快照后被复用；卸载现有时序保持。
全局市场原生版本/App manifest 覆盖、server installed/reconcile/share 等未包含在本刀验收。

验证进行中：生产与 lib tests 分别通过一次隔离 rustc metadata 编译，只证明编译，非运行。
标准裸 cargo check 在 V8 上游预编译 URL 404 失败，保留日志；后续使用仓库现役 rust-layer
V8 artifact resolver 执行 unit 与公共 JSON-RPC integration，不重复裸 cargo 失败入口。
contracts、verify:app-version、docs:boundary、legacy-report 已通过。标准
`npm run test:rust:unit -- -p app-server plugin_` 54/54 通过（1956 中 1902 被筛选），
28 个当前源码路径快照无漂移。公共 RPC 定向仍在构建，未计为通过。
原 integration wrapper 同时附加 --tests，可能扩大编译面；仅停止本进程排队的调用，改为
同一仓库 V8 resolver + cargo --test remote_plugins_jsonrpc，不修改共享 runner 或他人进程。
Electron 20926 已在源码 freshness 检查拒绝并 exit 1，产品场景未启动，不计 Gate B。

实际消费者复核发现 Electron Host 和 current DevBridge 将 plugin/install 按 30 秒读请求
处理，会早于 60 秒下载预算结束。追加窄写集为原本干净的 electron/appServerHost.ts 的
超时常量/函数提取、同域 appServerRequestTimeout.ts；Host 原测试仅加消费者用例；current
DevBridge commandPolicy 的 plugin/install 分类及同域 policy/http-client 回归。不改 renderer
页面、public RPC、preload 或业务 runtime；不在超长 Host 内继续堆业务策略。安装消费窗口
统一为现役 long-running 的 150 秒，容纳详情/60 秒下载与暂存提交；其余插件读面保持 30 秒。
验证补 targeted Vitest、完整 contracts、标准 GUI smoke，真实安装 Gate B 仍单独欠账。

验证续记：Host/current DevBridge 定向 72/72、Electron typecheck、格式检查和完整 contracts
均通过，超时静态守卫已随提取迁到实际 owner；标准 verify:gui-smoke exit0，壳与 bridge
通过，不替代远端安装。公共 RPC 首轮及整组诊断复验均为 12/13：stdio 读取共享 target
二进制得到空目录。固定副本仍复现后，实查共享 target 的产物已变更且缺当前远端目录
字符串；桌面固定产物保留本轮实现，两者摘要不同。夹具仅在测试内消费既有
LIME_TEST_APP_SERVER_BIN，使用带完整动态库的固定产物再复制两个 peer 共用；完整
13/13 通过（77.36 秒），不删两轮失败日志，也不通过放宽断言掩盖错误。
P04b4 远端目录 Electron/真实 stdio 复验 exit0：目录/详情、共享账号、换号、reload、冷启
和注销通过，已检查目录和冷启截图；凭据仅来自 backend，console/page/invoke errors 为零。
证据为 remote-catalog/electron-after-bundle/summary.json。追加写集仅为原现役远端 fixture
与同目录 tar.gz helper，补 GUI 确认安装、stdio 同一安装记录、换号隔离、冷启切回恢复和
GUI 卸载；仍不计为模型 Turn、CLI exec/PTY 或真实 Core 进程闭环。该安装场景运行中。

产品续记（2026-10-18）：安装场景首轮再次被并行 ArtifactToolbar 源码变化拦截，未启动
交互。随后复制源码及固定 sidecar 到隔离验证目录，原有完整目录/安装/账号隔离/冷启切回/
卸载断言全部通过；下载恰好一次，不带账号 header，2735 项产物摘要前后相同。但人工检查
冷启切回截图发现：插件页已安装、侧栏却显示空，原断言漏验侧栏消费者。该 run 只按原有
边界记 pass，不以它核销侧栏一致性。追加原本干净的 AppSidebarCustomization.tsx 与既有
AppSidebar.plugins.test.tsx 窄写集，订阅同一 cloudAccount metadata；换号/项目切换清旧
结果，拒绝迟到响应，读取失败清列表，注销后仍读本地安装。没有新增账号或安装事实源。
插件页/侧栏定向27/27通过，包含账号变化、迟到响应、注销保留本地与失败清理；现役
Electron fixture 已追加侧栏安装记录的出现/消失断言，在新隔离快照复验，不覆盖上轮证据。

最终产品验收（2026-10-18）：加强后的侧栏场景和最终 IPC 场景均 exit0，最终证据为
`client-bundle/electron-install-final/summary.json`。七个可见阶段均断言插件页/侧栏安装状态
一致，独立 stdio 读取同一 installed 记录，换号隐藏旧包，reload/冷启切回恢复，GUI 卸载后
stdio 不再读到包；同一包只下载一次，下载不携带 Authorization/Cookie，也不来自 renderer。
80 条观测均为成功的 electron-ipc -> app_server_handle_json_lines 插件调用（包含跨阶段重复
观测，不是80个独立请求）。2846项 renderer/Host/sidecar 产物摘要前后相同，App Server
SHA256 为 8c62ab23823b63cac382b547b563e814fe52d1b2def226734979453cb8a4feec；最终
安装、冷启切回和卸载截图已检查，侧栏空列表缺陷已关闭，console/page/invoke errors为零。
同批产物的 shell smoke exit0，覆盖真实壳、initialize、工作台/reload、三个视口和memory
shell；该次直接运行 smoke.mjs，不冒充再次执行完整 verify:gui-smoke。标准命令在侧栏
修复前已通过；修复后的真实远端产品场景与壳证据独立保存，不混用产物。

本批退出条件仅为受限下载/安全解包、唯一安装事务/账号来源、Host等待窗口和同一安装记录
的GUI/stdio消费；该边界已验。current为共享AccountManager、plugin_remote、PluginStore、
Host超时策略及GUI消费者，原42条插件路径和旧remote/wire为dead/deleted/forbidden-to-restore；
无新增compat/deprecated或迁移。P00–P05及完整目标保持active，不把本切片通过写成全量
Codex等价。固定产物、源码/删除复核与完整验证索引归 `client-bundle/final.json`。

下一刀P04b7先对齐Codex `core-plugins/src/remote_bundle.rs` 的GLOBAL包准备语义：原生
manifest版本使用release版本，受支持portable manifest保持原结构；App manifest覆盖采用
实际声明路径并区分省略与显式空。USER/WORKSPACE包保持上游规定的原内容。随后推进服务端
installed/install/uninstall/reconcile/share及prefer-cache、vertical/shared-with-me授权；CLI
共享登录、发布同一包到真实Turn、exec/PTY、Windows/live/packaged仍单独验收。受控
Core-shaped issuer不是实际Go服务/对象存储/MySQL，P04b5服务端tar.gz结果也不能替代两仓闭环。

最终静态收取：标准 `npm run typecheck` exit0（renderer与node两个项目）；侧栏/插件页27/27、
Host/Bridge72/72、Rust owner54/54、公共RPC13/13、完整contracts、文档边界、脚本治理与
定向lint/格式通过，各测试批次不相加为唯一总数。原插件删除100%（42/42）；本批七组
验证门禁100%（7/7），分母仅为上述P04b6退出条件，不能当作完整插件或完整产品对齐百分比。
全仓verify:local仍未核销此前专业预览A1/B2:C3失败，当前没有重跑该外部写集；Windows、
live、packaged和真实两仓发布到Turn未验。架构图确认：root，2026-10-18。

架构影响重大：网络读面提取为同一 App Server 内部共享模块，包物化仍属 PluginStore，
账号身份由唯一 AccountManager 实现提供；不新增业务后端、RPC 或凭据 owner。图随实际实现
更新，root 2026-10-17 确认。当前实施与完成验收分开记录。

## P04b5 tar.gz 包合同（服务端切片已验，整体 active）

用户明确 tar.gz 及合理的 Codex 行为均须对齐。本刀直接替换 Core ZIP 扫描与交付，不迁移、
不双读。Codex `core-plugins/remote_bundle.rs`、`plugin_bundle_archive.rs` 为只读事实源：
压缩上限 100 MiB、解包文件总量 512 MiB、只允许普通文件/目录，拒绝链接和越界路径。
60 秒为客户端下载预算，须在后续实际下载 owner 实施，不能用本仓上传扫描冒充已完成。

窄写集：Core plugin_package_upload model/service，scan/components/skills 与新增同域 archive
helper；plugin controller 的下载 MIME；现役 plugin service/controller fixtures，两个 repo
drill/fixture 文件仅替换 URL 后缀；API SDK 两处默认 MIME、types MIME union 与同域合同测试；
OpenAPI 20/30/70 source fragments 与正式 bundle、API/插件操作文档、两仓计划及 architecture
插件包段。既有 dirty 增量保留，Go 大文件只作机械消费者替换，不堆逻辑；
新解包安全职责独立。Codex 只读，CLI/TUI/Hooks/专业预览/发布/依赖不触碰。

Verification Contract：root；P1/budget:normal。公共 HTTP 上传 -> complete -> 同一 package URL
下载原始 tar.gz -> 发布/目录，hash 与原字节绑定，组件提取不丢失。ZIP MIME/字节直接拒绝；
gzip 损坏/截断、tar 路径/链接/特殊类型/冲突/超预算终态拒绝，不执行包代码。临时扫描文件
使用私有目录并在成功/失败后清理，避免 512 MiB 解包内容常驻堆。服务端既有 metadata/entry
发布安全配额需明确列为额外策略，不能冒充上游客户端配额。Go 定向后完整 verify-go，SDK/
OpenAPI 与实际 HTTP response 验证；完整远端下载安装到 Turn 仍须后续独立验收。

已实施：唯一静态扫描 owner 从 ZIP reader 改为 tar.gz；100 MiB 压缩/512 MiB 普通文件总量、
类型/路径/链接/重复/冲突/gzip CRC 与截断均 fail closed。私有临时目录使用受控数字文件，
不以包内路径写宿主、不执行包代码，scan defer 在成功/失败后清理。SDK 默认 gzip，二进制
上传在共享规范化后也以 gzip MIME 下载；对象后缀为 .tar.gz，原字节/hash 不转换。
旧 ZIP 正向 fixture 已替换，仅保留拒绝回归。服务端仍有 512 entries 与 metadata 单文件
1 MiB/累计 8 MiB 发布配额，明确记录为服务端安全策略，不冒充上游客户端限制。

已验：三个 Go package 的当前定向回归、完整 make verify-go、make verify-contracts、SDK 7/7、
SDK/types TypeScript、Core legacy 扫描及本刀 diff check 通过。公共 Go router 证明 ZIP MIME
不改变上传会话，随后二进制上传 -> complete -> gzip 下载保留同一原字节；组件发布/审核/
目录回归使用 tar.gz。SDK 使用独立 Node loopback HTTP，不能合并声称为实际 Go 服务进程到
SDK 的闭环；没有真实对象存储/MySQL 应用或 live 验收。初始两次类型检查入口错误分别为
npx 同名 tsc 包与缺失 workspace alias；最终使用已有 TypeScript 和显式同源 alias 通过，
未修改/安装项目依赖。架构图及私有暂存职责由 root 确认，2026-10-17。
最终文档边界、客户端合同同步与两仓 legacy 扫描通过，34 文件快照无业务源码漂移，生产插件
ZIP 读取/MIME/旧对象后缀扫描零命中，两仓 diff check 通过。原登记删除仍 42/42（100%），
无 compat/deprecated/迁移；旧 ZIP 接收/扫描/正向夹具为 dead/deleted，拒绝回归继续守护。
证据归 `.lime/qc/plugin-reconstruction/tar-gz/final.json`；这是受控上传/交付合同验收，外部
平台 URL 内容验证、客户端 60 秒下载/物化/installed/reconcile/share、真实 Turn 与平台证据
仍未核销。整体目标继续 active，下一刀回到共享 PluginStore 及账号隔离/远端来源事实。

## P04b4 远端目录、详情与后续物化（目录切片已验，整体 active）

上一轮为实际进展：42/42 原插件路径删除、GUI 共享账号/认证 HTTP 的产品链已验。本轮继续
推进完整远端插件目标，先打通已有 plugin/list/read 的真实认证目录和详情读面，再在同一
owner 接包下载物化、installed/reconcile/share 与发布到 Turn；读面通过不能核销其余义务。
当前 Core 实际路径为 `/api/v1/public/tenants/{tenantId}/client/ps/plugins/...`，已在现役
AccountManager 的 client API 限制内。上一节将 `/ps/plugins` 判为不属于 client 路径的推断
不准确，以控制器实际路由为准；无需放宽公共 cloud/request，也不让 renderer 取凭据。

窄写集：runtime/plugins 目录新增远端读面及 wire projection，plugins.rs 仅替换相关委托；
现役 AccountManager 内部受限请求的必要委托；独立公共 JSON-RPC/真实 HTTP/stdio 测试；
PluginCatalogPageViewModel 的 remote opaque ID 接线及同域测试；两仓计划与 architecture/
commands。未知脏文件保留原增量，CLI/TUI、Hooks、预览、发布/依赖继续避让。Codex 源码
与 Core 现役目录/组件 owner 为只读语义参考；若需修改服务端合同，另登记具体窄写集。

Verification Contract：root；P1 / budget:normal。所有 surface -> plugin/list/read -> RuntimeCore
plugin owner -> 共享 AccountManager -> Core raw snake_case directory。响应只投影既有 v2
PluginSummary/Detail；本地市场路径与远端 opaque plugin ID 分开，不能以 canonical name
冒充远端 ID。分页有总预算/数量上限，错误、重复 ID、错 scope 与账号中途变化必须显式失败，
不回退生产 mock，不缓存到另一账号；安装/启用状态只能由共享 PluginStore 的真实事实证明。
未登录时默认列表仍可读本地，显式远端请求返回认证错误；显式本地请求不触网。
远端 release 的 Skills/MCP/Apps/template/task metadata 不静默丢失，包 URL 不回 renderer。
验证包含公共 RPC、受控 HTTP、分页/错误/身份竞态、GUI opaque ID 消费及真实 stdio/Electron。

架构影响重大：现役 plugin 读面开始通过同一共享账号网络边界消费 Core；不新增后端、协议
或兼容层。root 确认目标数据流，2026-10-17，实际图随实现同步，未验证不进入 release evidence。
完整目标退出条件仍包含安全下载/物化、完整组件、远端 installed/reconcile/share、真实 Turn、
CLI 账号入口、平台与对应产品证据，不以本轮基础读面缩减目标。

实施增量：补齐 remote/wire 与 projection，复用 AccountManager 的认证/路径/HTTP 限制；
目录/详情 raw snake_case 转现役 v2 DTO，所有远端项保持真实未安装/未启用。Apps 按共享 owner
分批读取并保留缺 metadata 的声明 ID/分类，模板/Skills/MCP/任务摘要投影，bundle URL 丢弃。
GUI pluginLocation 远端传 opaque service ID，缺失或非法 ID 直接拒绝；错误补齐五语言。
补充发现 GUI 只请求默认 GLOBAL，未消费实际 WORKSPACE，且账号变化不刷新插件页。因此
窄写集追加 PluginCatalogPage 的现役账号 metadata 订阅与工作区/个人目录委托、同域组件回归，
不改账号存储 owner。账号变化清空旧页，目录与详情迟到响应均受 identity/请求序列保护。
独立 Electron fixture 归 scripts/electron/remote-plugin-catalog-fixture-smoke.mjs，沿用现有
构建/进程/锁 helper，不增脚本根目录或生产 mock。

阶段验证：GUI 首轮 20/20；账号订阅、迟到响应和五语言后最终 26/26。远端公共 JSON-RPC/
真实 HTTP/双 stdio 10/10，账号回归 14/14，完整 test:contracts、标准 typecheck、i18n、
定向 lint 与标准 verify:gui-smoke 均通过。分页 cursor 的 `%2F` 曾被账号边界误当成路径编码；
现仅对 URL 的 path 部分检查编码，query 仍受既有字符/同租户/凭据规则约束，公共回归通过。
42/42 登记删除路径仍不存在；加强扫描包含 Core default-skills/public skill-packages，四组
旧插件/账号 owner 搜索均零命中。21 文件源码摘要无漂移，两仓组件 fixture 字节相同。
目录页当前 756 行；下一次增加业务前拆分目录读取/账号订阅与呈现，退出条件为不继续向该页
堆叠远端安装编排。架构图已同步，root 确认 2026-10-17。

失败记录保留：related runner 首轮 Vite EISDIR、裸 cargo 的 V8 制品 404、AppsReadResponse
字段误用、query 编码误拒绝、错误 tsc 配置入口，以及两次 Electron 夹具断言/关闭 API 错误；
均未计为通过。Electron `electron-verified` 在构建后被并行专业预览/typed client 源码漂移
检查拒绝，尚未启动产品场景；失败 summary 保留。此前 dead PID 73806 的遗留锁经现役
owner 检查/回收工具释放，未删除其他活动进程的锁。后续独立 `electron-current`（handle 20926）已 exit 1：
renderer/Host 构建成功，锁前源码 freshness 检查拒绝，未启动产品场景；该结果不计 Desktop
Gate B。新客户端物化切片完成并固定产物后再复验，禁止复用旧二进制核销新实现。
`source-after-tar-gz.json` 是 P04b5 当时的 21 文件快照；P04b6 Context/wire 提取后不再声称
它代表当前源码无漂移。
过程证据归 `.lime/qc/plugin-reconstruction/remote-catalog/`。完整 verify:local 仍有前轮并行
专业预览 `PreviewArtifactRenderer.component.test.tsx:145` 的 A1/B2:C3 失败，未触碰其实现，
未把本刀定向通过表述为全仓绿。本轮不声称完整插件或完整产品对齐完成。

下一刀已确认的合同差距：Codex remote_bundle/plugin_bundle_archive 交付 tar.gz，下载预算
60 秒、压缩 100 MiB、解包 512 MiB；Core 当前上传/扫描仍为 ZIP（64 MiB/256 MiB）。
须直接替换现役上传、扫描与交付合同并同步 HTTP/SDK/OpenAPI/消费者，不保留 ZIP 兼容分支；
再由同一 PluginStore 完成 staging/commit/rollback、账号隔离及真实 remote provenance。
installed/install/uninstall/reconcile/share、prefer-cache、vertical/shared-with-me authority、
CLI 账号入口、完整组件到真实 Turn 和平台证据均未核销。目录可见不等于安装；本地同名包
不得冒充远端已安装记录。原插件清理为 100%（登记路径 42/42），完整目标继续 active。

## P04b3b GUI 共享账号消费与认证 HTTP（产品切片已验，整体 active）

上一刀 P04a6 已清除旧插件 URL 链。本刀仍以完整对齐为目标：将 renderer localStorage、
window token globals、OAuth/邮箱/密码登录、恢复/注销及云端 HTTP 消费整体收敛到 App Server
共享 AccountManager，不迁移旧凭据，不保留第二套登录事实。只迁存储而继续向 renderer 返回
session token 不满足退出条件。完整 OpenAI managed/device/API-key 与 CLI 登录仍单列未完成。

窄写集：App Server account 内部 HTTP transport、对应 public cloud/request 合同/processor/
runtime/client/schema/消费者及集成测试；前端 account/cloud gateway、账号 metadata projection、
OAuth/启动/Sidebar/useOemCloudAccess 及直接认证 HTTP 消费者；两仓计划与 architecture/commands
账号边界。共享脏文件只修改账号接线，不改 Hook、CLI/TUI、预览、发布、依赖和未知写集。
初始摘要归 gui-account/source-baseline.json。
追加窄写集为 current renderer bridge 的 invokeDiagnostics（只处理登录 JSONL 诊断脱敏）、
public runtime 配置和 vite env 的旧 token/插件 flags 声明；无 legacy policy 或 mock 扩展。超过千行的 useOemCloudAccess 必须先按账号恢复/
登录职责提取，skillCatalog/Sidebar 只替换委托，不追加业务。长期退出条件为相应业务迁出。

Verification Contract：root；P1 / budget:normal。Product Surface -> App Server account/cloud RPC
-> RuntimeCore -> AccountManager -> 当前 LimeCore issuer。GUI 只持有 metadata/view，凭据不出
RPC read/notification/request response；cloud/request 不接受外部 URL、headers 或 token，限定
当前账号租户的 client API，相同 auth 序列化队列、禁止 redirect、有限响应/预算、无生产 mock。
公开登录流程产生的临时 token 只用于 import；随后所有认证 HTTP 从共享 owner 取凭据。
登录失败保留旧账号；注销/换号后旧响应不能覆盖新投影；重启和另一 host 共享同一文件事实。
验证覆盖真实 HTTP/公共 JSON-RPC、错误/错租户/越界/redirect/超预算/凭据不回传、消费者契约/
component、真实 Electron 登录/恢复/注销及 shared stdio 读取；仅受控依赖，不算 live。

架构影响重大：账号凭据和认证网络边界从 renderer 收回共享 App Server。责任开发者 root
确认目标数据流，2026-10-17；实际实现同步 architecture，未验证不进入 release evidence。
本阶段退出条件为旧 credential owner/直接 authenticated fetch 删除、所有消费者改走新边界并
经真实产品回归；远端插件物化/安装/分享到 Turn 仍须后续完成，不能以此基础合同核销。

已实施：共享 metadata projection、账号恢复观察 hook、OAuth/邮箱/密码 import、共享 logout，
以及全部已发现的认证 Core HTTP 委托；旧 oemCloudSession 模块/正向测试、window globals、
VITE session token、六条旧插件 env flags 与无消费者的旧远端 logout gateway 已删除。诊断
JSONL 账号导入只记录 id/method/type。独立开发者 access token 不做账号 token 清除。
消费者最终 24 文件 185/185，独立 gateway 组 3/3；早期失败为旧凭据 UI 断言、夹具 mock
导入顺序与跨文件状态污染，均已修正。Rust 最终公共账号 RPC/真实 HTTP/stdio 14/14，协议
140/140、正式 schema 1/1。旧测试把首条 skills/changed 错当 account/updated，已改限时
等待目标通知；原失败保留。正式生成 1061 TS 类型、完整 test:contracts 与最终 typecheck 通过。
标准 GUI smoke 通过；随后清除 refresh callback 的旧 session/runtime 租户兜底，只从共享
账号 metadata 取默认租户，定向 12/12、零警告 lint 通过。复用在最终编辑后启动的共享
renderer 构建，取消本进程尚未获得锁的重复构建；来源记录归 renderer-shared-build-provenance.json。
42/42 旧删除路径仍不存在，生产/现役文档/Core/旧账号 owner 扫描零命中；真实账号
Electron/stdio 最终已验 GUI 密码登录、私有凭证文件、独立 stdio 读取、同租户换号/focus 重读、
reload、双进程冷启与 GUI 注销；12 次认证 HTTP 均来自后端。五阶段 localStorage/
sessionStorage/旧 globals 无凭据，preload 为真实 current bridge，invoke/page/console 错误零。
最终制品直接 shell smoke 亦通过（Gate B-F）。在同一构建锁内验证前后 1900 项 renderer/
Host/typed client/sidecar 制品与本刀产品源摘要无漂移，App Server SHA256 为
`d491fc0d711aeb43d6eec7fec32cec1b7ec868087a5fa974ed325c76700835a7`。
证据为 controlled Core-shaped issuer / unavailable model backend，无模型 Turn，不算 live Core、
完整 CLI 登录、TUI、Windows 或 packaged。首次 Electron 失败为夹具误把 Agent 数据目录当
AppDataRoot，且 bootstrap 缺 providerPreference；已按现役路径/响应合同修正，原失败截图/
summary 和最终通过均保留。默认 verify:local 已过版本、i18n、全仓零警告 lint 与最终
typecheck，前端按旧状态续跑，在 46/133 批被并行专业预览的
PreviewArtifactRenderer.component.test.tsx:145 阻断：新预览请求预期选区 A1，实际 B2:C3。
该批 102 通过/1 失败；未触碰该预览写集，未执行后续全仓阶段，不宣称全仓通过。
账号产品切片已验，原插件登记清理仍 42/42（100%）；current 为共享 AccountManager/
typed gateway/metadata view 与 canonical MCP 插件 owner，无新增 compat/deprecated，无迁移。
root 确认实际接线与 architecture 中账号数据流图一致，2026-10-17，未进入 release evidence。
完整目标继续 active，真实过程归 gui-account/final.json。
可重复真实验收入口：`node scripts/electron/account-fixture-smoke.mjs`，只使用隔离数据目录和
受控 Core-shaped HTTP issuer，实际新 renderer/Host/App Server/stdio 进程，不使用模型后端。

下一刀仍为 CLI 共享账号入口和插件远端认证/物化。源码复核确认 plugin/list 的现役 catalog
只装配 Local，RuntimeCore 委托同一 PluginStore；Codex core-plugins/remote.rs、remote_bundle.rs
与 app-server/request_processors/plugins.rs 为下一刀只读参考。Core 实际路由为 client/ps/plugins，
已在现役 AccountManager 限制内；共享插件 owner 可内部委托，不放宽 renderer URL/headers/token
边界，不新增平行插件后端。目录/安装/下载缓存需按账号身份隔离，
再贯通受限包下载、完整组件、installed/reconcile/share 与真实 Turn；这些仍未实施/验收。

## P04a6 删除旧 URL 插件外壳（本轮已验，整体 active）

用户明确原有插件清理删除，不迁移、不兼容。42 条已登记路径之外，工作台仍将旧
`appSurface` pending metadata 的 entryUrl/embedding/strategy 转成原生浏览器插件外壳；
视觉 fixture 还正向验收 content-factory/Prompt Lab URL。该链已直接删除，唯一 current 为
completed canonical mcpToolCall item -> ui resource identity -> mcpServer/resource/read ->
RuntimeCore/MCP owner -> Electron 受控 HTML host。没有新增插件后端、fallback 或旧请求转译。

实际窄写集：workspacePluginSurfaceModel、WorkspacePluginSurface、pending/coordinator 与
rightSurfaceRuntimeAdapter；同域 model/component/hook/lifecycle 测试；sessionIdentity 的旧
plugin-runtime 前缀；legacy catalog/回流守卫；App Server right_surface 输入校验及公共
JSON-RPC 测试；旧 visual/scenario/smoke fixture、常量、common/not-applicable/runtime-surface
assertions 与 common 行为测试；本计划及 architecture §7.2/commands 的插件边界段。
共享文件仅修改上述边界；CLI、Hooks、文件预览、发布、依赖及未知写集继续避让。

Verification Contract：root；P1 / budget:normal。旧 appSurface pending 必须在任何存储和
通知前返回现有 INVALID_REQUEST；renderer 不再从 pending 生成 Plugin descriptor，或把
插件 URL 传给 mount/navigate。MCP descriptor 的资源身份必填；现役 Apps 的多页签、租约
释放、reload/冷启及卸载后历史由同一 owner 验证。架构影响重大，删除跨层旧输入链；
architecture §7.2 图已同步，责任开发者 root 已确认，日期 2026-10-17。

实施结果：删除三个旧 pending descriptor builder、URL mount/navigation、strategy/embedding
字段、旧会话隐藏前缀及正向测试；清除 12 条旧插件测试白名单，allowedPaths 为空；补上旧
adapters/install 目录及 URL 合同/导航的回流守卫。App Server 公共 JSON-RPC 证明旧请求无
requested 通知、不写入 pending，冷实例仍可读现役 files 请求。42/42 历史删除路径仍不存在；
客户端生产、current docs、LimeCore 生产的旧运行时标识扫描均零，见 residual-review-final.json。

真实面板复验还清除了已删除 ObjectCanvas、空会话 expertInfo、旧浏览器固定 session/profile
的过期正向验收。面板场景不再伪装聊天输出；common 继续验证真实 preload/IPC、App Server
session start/read/list、read model/editor identity、无模型 Turn、invoke/console 错误，Gate B
identity/terminal/mock 合同保持启用。浏览器 metadata 按现役 browser 字段发送，DOM 身份与
Electron browser_tab_list 原生标签及线程/URL/控制权核对。截图先激活目标窗口；失败保留已
完成的 captures。超千行 common/scenario 文件只 dispatch/删旧分支，新增检查归现有
runtime-surface owner；不继续堆叠长条件，后续场景也遵循该边界。

最终验证：消费者首轮 10 文件 165/165，治理组 227/227（与前组有 2 项重叠，不相加），最终
model/component 19/19；追加 fixture/identity/Gate B 行为与守卫 147/147。Rust 公共 JSON-RPC
1/1，完整 test:contracts 通过，独立 typecheck、定向 ESLint/Prettier、scripts/legacy/docs
检查通过；最后文档/证据检查归本节 final.json。标准 verify:gui-smoke exit0，覆盖壳/bridge
Gate B-F，不扩称完整产品验收。

固定新制品的 MCP Apps Electron fixture 为 runtime / Gate B，安装、启停、新会话工具边界、
mention、MCP 表单、资源面板、reload、双进程冷启及卸载后历史全部通过；Provider 请求 2 次、
工具 1 次，恢复/卸载不重执行，错误/旧命令/mock 命中均零。原生视图三阶段 marker、window
ownership、visible/非零 bounds 单独核对；主 renderer 截图不冒充原生子视图内容。
额外 Right Surface Electron 最终 32/32（controlled fixture / backendMode=external），证明
真实 IPC/pending/read model/文件-浏览器-活动面板、同一原生浏览器身份及无模型 Turn；不算
模型运行或 live Provider。固定 sidecar 与桌面构建制品 1496 项摘要复核无漂移，App Server
SHA256 为 `6cc0af7b228e039e69a4742d6dc73171570f1169d9f684a9646508d0d308d0e6`。

保留的失败证据包括过期 ObjectCanvas、截图超时、旧浏览器 identity 断言，以及修正后最终
通过结果。默认 verify:local 本轮 lint/翻译检查已过，随后被并行 presentationDocument.ts 的
`@aiden0z/pptx-renderer` 缺失依赖 TS2307 阻断；此前独立 typecheck 通过不代表当前全仓绿。
没有修改或安装该并行写集的依赖。共享 architecture 后续并行增量保留，固定制品证据不扩称
该增量已验；本刀生产源码相对已实施快照无漂移。

证据：`.lime/qc/plugin-reconstruction/url-shell-cleanup/final.json`（含各组日志、失败复验、
源码/制品摘要和截图）。分类：current 为共享 MCP owner；旧 URL 链为 dead/deleted/禁止恢复；
无新增 compat/deprecated，无迁移。本刀退出条件已满足，登记删除 42/42、旧 URL 输入/投影/
导航及其过期验收均清除，本轮清理 100%。完整插件目标继续 active，下一主线 P04b3b GUI
共享账号消费链，随后远端认证/物化/安装/分享到 Turn；未核销 CLI/TUI、live、Windows 或 packaged。

## P04b3 共享账号 owner（基础切片已验，消费链/整体 active）

上一轮 P04a5 为真实进展：删除、回流守卫和 Electron 验证已完成。本刀开始时源码确认 GUI 云端
会话仍由 renderer localStorage 保存，App Server 尚无共享账号领域，插件 datasource 仅本地。
主目标保持完整对齐；本刀先建立可由各 surface 共用的 account/login/start、account/read、
account/logout 与账号变化通知，随后迁入 GUI 登录并接远端目录/下载/安装，不以基础合同核销
完整登录或远端插件目标。Codex account.rs/remote.rs 为只读语义参考。

窄写集：新增 App Server account 领域与 processor/runtime account 模块及公共 JSON-RPC
集成测试；RuntimeCore/main 只接入由组合根注入的 AppDataRoot；v2 协议/method/envelope/schema
registry 和正式生成物；typed client/request method catalog 及前端 gateway；两仓本计划与
architecture 的账号事实源段。脏共享文件只插入 account 对应段，不改已有 Hooks/插件行为；
避让 CLI、文档/工作簿预览、发布和其他并行写集，认领前摘要归 shared-account/source-baseline.json。

Verification Contract：root；P1/budget:normal。Product Surface -> App Server JSON-RPC ->
RuntimeCore -> AccountManager -> LimeCore 当前 client/session 认证与 AppDataRoot 下私有凭证文件。
LimeCore 外部会话使用明确的 cloudAuthTokens 扩展，不把 Lime 会话伪装成 ChatGPT token；
上游 OpenAI managed/device/API-key 登录仍单列待实现。导入时由 HTTP 验证 tenant/user/session
身份再写入，失败保留旧账号；读取/通知只回 metadata，不返回 token；logout 删除当前凭证。
凭证文件遵循 Codex private file 模式与原子替换，不读旧 localStorage/旧用户目录作迁移；
Electron Cloud WebSocket credential store 仅是不同用途的 transport foundation，不作为账号后端。
验证真实 loopback HTTP + 公共 JSON-RPC、同根双实例/重启读取、换账号/注销/坏凭证失败、token
不进入 response/notification/Debug，以及正式协议生成/typed consumer/契约检查。只报告实际产品
证据；GUI 调用迁移、CLI 登录入口、远端插件 HTTP 消费及整条发布到 Turn 仍须继续实施。

退出条件：共享账号公共入口和真实持久化/HTTP 验证可用、组合根与消费者合同同步、验证落盘；
整体目标不缩减。基础退出条件按下方最终证据达成；GUI/CLI 消费与远端目标继续 active。
架构影响为新增共享领域 owner，重大；
root 已确认上述目标数据流，实际接线随实现同步 architecture，未验前不进入 release evidence。

已实施基础 owner、三请求/metadata 通知、同一 accountAuth 序列化队列、生产组合根注入及
typed package/GUI gateway；logout 使用 Codex 的 omitted/null 无参语义。首轮协议回归
138/140，暴露 method serde 标注误置及通知 schema 快照缺项；已修正。随后编译暴露
schema fixture scope 名称映射遗漏 AccountAuth 分支，已补齐；失败日志全部保留，不计通过。
新增公共 JSON-RPC/真实 loopback HTTP、同根/冷启/失败保留/权限/脱敏、并发登录注销及真实
stdio 双进程验证。正式生成与最终回归结果见本节末尾，不以早期失败或中间结果计通过。
范围矩阵四个 account identity 由整组 excluded 改为 planned，完整上游认证模式/生命周期和
GUI/CLI 实际消费者未验前不核销 parity。本仓文档边界、legacy 报告、定向 lint/格式与矩阵
计数已通过；42/42 历史删除路径复核仍不存在，证据归 shared-account/deletion-recheck.json。

HTTP 首跑失败已定位：macOS 开启系统 HTTP/HTTPS/SOCKS 代理（没有代理环境变量），默认
reqwest client 将 loopback issuer 交给代理并收到 HTTP 502，未到达真实本地 fixture。
账号 owner 显式区分 loopback direct client 与正常 HTTPS proxy-aware client，均保持禁止
redirect/15 秒预算；不更改系统代理。stdio 子进程显式设置不可达测试代理，验证本地认证不
经代理。为 raw RPC 与并发验证进入信号补边界超时，避免失败后悬挂；原运行仅终止自有测试
进程，单场景诊断和失败日志保留，修正后完整回归已通过。
正式 schema writer 与 TypeScript 1058 类型生成/无漂移、完整 contracts、typecheck 和
110 项 typed client/gateway/范围守卫已通过。schema writer 曾复用同一 Cargo 编译的协议库
绕过 artifact 目录锁，来源摘要归 schema-generator-provenance.json；仍以正式 Cargo
schema fixture 测试最终核对，不把直接链接当成测试替代。

最终已验：account_jsonrpc 9/9，包含真实 loopback Core envelope、同根多实例与冷启、
换号失败保留、401/redirect/错身份/过期/超预算拒绝、私有文件权限、无 token 投影/Debug、
登录与注销同队列，以及真实 App Server stdio 双进程经生产组合根共享账号/注销。stdio
子进程设置不可达代理仍通过。协议 lib 140/140、正式 schema fixture 1/1；typed client、
gateway 与范围守卫 110/110；完整 contracts、typecheck、定向 lint/format、legacy 和 docs
检查通过。正式 Cargo writer 也执行成功，生成物最终由 schema fixture 精确核对。

新后端构建后，标准 verify:gui-smoke 与固定产物直接复验均为 24/24，proofLevel Gate B-F：
只证明 Electron 启动/重载、preload/IPC、App Server JSON-RPC、Workbench/Settings 和布局，
不核销 GUI 账号用户流、Provider Turn、CLI/TUI Gate B、live/Windows/packaged。6 项 sidecar
与 8 项桌面构建制品在固定复验前后共 14 项摘要无漂移；App Server 摘要为
`6e4e3879b3518ac77d10d2182e4f5a420f257c682044ccbe657f805d34001a73`。

默认 verify:local 本轮 lint/typecheck 已过，前端续跑在 53/134 批被并行
`src/lib/artifact/fileRevision.test.ts` 两项 WebCrypto ArrayBuffer realm 错误阻断；该文件
属于避让的预览写集，未覆盖或修补，不宣称全仓绿。旧 WorkbookGrid warning 已不再是本轮
阻塞。完整失败、诊断、运行日志和最终证据归 `.lime/qc/plugin-reconstruction/shared-account/final.json`。

分类：本刀 App Server account/typed gateway 为 current；无新增 compat/deprecated 或旧
凭据迁移。42/42 已登记旧插件路径仍为 dead/deleted/forbidden-to-restore。基础切片验证
完成度 100%（仅以上 owner/协议/持久化/HTTP/stdio/壳回归），完整 Codex 对齐百分比不据此
推算，P04b3 消费链及整体继续 active。重大架构 root 已按实际代码确认并更新 architecture。
下一刀继续 P04b3b：整体替换 GUI 私有账号/localStorage/token globals 及 HTTP 消费，接入
CLI 登录/状态/注销；随后远端 Plugin 目录、下载、安装/对账/分享与两仓发布到 Turn。
不恢复旧插件或为未完成消费者增加 fallback/兼容包装。

## P04a5 删除旧 renderer host 孤岛（本轮已验，整体 active）

复核旧插件清理时，发现 Article 的 app-declared renderer host 卡片、模型、授权占位
策略及其正向测试仍在源码树中，但没有产品调用方。真实 Article editor 只借用了其
actions 文案键；current fixture 仍注入 rendererContract 并把元数据保留计作通过。
本刀直接删除这条死链，修正现役编辑器和夹具，不提供迁移或兼容。

窄写集：WorkspaceArticleWorkspaceRendererHost.tsx、workspaceArticleWorkspaceRendererHostModel.ts、
workspaceArticleWorkspaceRendererHostPolicy.ts 及其 unit test；WorkspaceArticleEditorSurface.tsx
的一处文案引用；五语言 workspace.json 的 rendererHost 键；content-factory 的 patches、
article-workspace、assertions、constants、domain-guards 夹具与既有 scenario-assertions 测试；
ArticleEditorRightSurface DOM 回归、pluginFixtureBoundary 守卫；
两仓本计划和 architecture §7.2。文档/工作簿预览、Hooks、CLI、账号认证及发布并行写集避让。
已有文案文件只改上述旧键区块，保留 PDF/Word/Workbook 增量。

Verification Contract：root；budget:normal；P2。唯一主链仍为 Electron/preload ->
app_server_handle_json_lines -> artifact/write、artifact/read、workspaceRightSurface/request
-> canonical Thread/Turn/Item/artifact 投影 -> Article editor。输入是受控 article workspace
与分镜对象；结果是文章可编辑/恢复、分镜内容可读取、动作仍回写 canonical artifact，
且旧 renderer 合同/宿主/授权占位不再成为生产或正向夹具的事实源。失败停在定向门禁
或真实 Electron 场景，不使用生产 mock fallback。

退出条件：4 文件不存在；旧 host 文案与生产/正向夹具引用为零；定向 Article/fixture/
回流守卫、五语言、typecheck、contracts、治理、GUI smoke 与 Article Electron 场景通过。
本刀没有 Rust/协议修改，使用已审查固定 App Server 并明确核对其摘要；Electron/renderer
按新源码构建。超长 article-workspace runner 删除旧观察，将旧合同投影替换为分镜内容
证据，不新增业务分支，后续
领域拆分仍按 P05 既有退出条件执行。架构影响为非重大：删除无调用孤岛，owner/协议/
数据流不变；root 2026-10-17 核对并同步 §7.2。整体对齐不由本刀核销。

真实行内配图回归首跑暴露旧夹具接线：inline-image-article-workspace 仍读取
identity.workerTaskId，而 current Article 场景返回 canonical identity.sourceTaskId。
追加认领该原本干净的 fixture 文件，直接改用 sourceTaskId，并撤销未命中来源身份时
选择第一篇文章的兜底；不得恢复 worker 字段或放宽身份断言。复跑使用同一固定产品产物。
第二次回归已越过身份绑定，暴露同一旧夹具还把文字 fixture-provider/model 当作图片
Provider；改为消费父 runner 已配置并验证的 imageFixtureProvider.providerId/modelId，
不新增硬编码 Provider 或生产 fallback。两次失败均保留原始证据，不计通过。
第三次复跑暴露本刀遗漏的 event/complete 两处引用；已统一三阶段图片 Provider 及 model，
并追加限定浏览器 callback globals 的 no-undef 检查与旧固定 Provider 名称负向守卫。
后续只读 CDP 诊断确认行内 fixture 重载后只打开聊天、没有重新打开文章编辑器；复用现有
Article artifact-frame 点击 helper，按已写入 artifactRef 打开同一文章，再检查图片回填与
持久化。该点击 helper 只增加导出，不恢复旧宿主；行内 runner
接近 800 行，本刀仅修夹具接线，领域 helper 后续拆分沿用 P05 退出条件。
原运行最终错误进一步确认 reload helper 遗漏 threadId，落到主聊天 fixture 的 options.threadId，
因此虽然 UI 已打开目标文章会话，read-model 身份断言仍等待另一线程。已显式传 canonical
identity.threadId；发现原因时下一次隔离复跑已启动，仅终止该 runner 自己的进程树并记录，
然后以修正接线和同一固定产物完整重跑，不改 shared session helper 或降低身份断言。
再次只读诊断确认同一文章画布已经显示图片，但误用的长文章 readiness 要求正文超过
160 字，短正文无法通过。行内场景撤掉该不适用的等待，继续使用自身图片/持久化断言，
并将图片观察限定在可见 Article editor 画布内，避免聊天图片误命中；标准长文章检查不变。
收尾定向检查首次误填不存在的 Vitest 配置，未执行测试；改用仓库实际默认配置完整重跑。
显式 no-undef 扩至标准 Article helper 后补齐其浏览器 Event/HTMLButtonElement globals，
未放宽代码规则；失败与修正日志均保留。
行内图片后续复跑还确认旧夹具与现役自动执行器发生双完成竞争：手工 image/complete 的
固定文件结果会被后台真实任务结果覆盖，且缺失 storyboardSlots 使实际图片使用默认 slot。
直接删除手工 complete 和旧文件 URL 常量，创建时显式绑定同一 storyboard slot，经
mediaTaskArtifact/get 等待真实 loopback Provider 任务终态，再校验同 task/slot 的实际 PNG、
reload 后的 canonical read model 与可见画布；不改生产后端或合成任务终态。追加认领原本
干净的 scenario-assertions.mjs，同步消费者与既有断言测试/回流守卫，固定产物不变。

已验：四文件删除（408 行）；五语言删除 80 个孤立键、5 个动作标题转入现役 editor
命名空间；六文件合计 118 个有效定向用例覆盖（fixture/guard 96 项、React 13 项、action
dispatch 7 项、action history 2 项）；最后 fixture/guard 95 项及新增完成来源/身份/回流守卫
14 项重验通过。typecheck、完整 contracts 最终复验、翻译一致性（missing/extra=0）、
scoped ESLint、no-undef、格式与两仓窄写集 diff 检查通过。新版 renderer/host 与当前后端
构建后，真实 Electron shell 24/24、Article 65/65、行内图片 70/70 全部通过；行内图片
经实际 images_api 执行器调用受控 loopback Provider，以真实任务终态和同一 task/slot
校验 reload 后的 canonical 正文与可见画布，不再手工写完成结果。产物摘要与日志归
`.lime/qc/plugin-reconstruction/renderer-host-cleanup/`；固定后端摘要仍为 a159dd708e7fddaa9ad8e2452806c0f47d50df19153c2cd1da01ede52c997e35。
最终 6 项固定 sidecar、8 项共享 renderer/host/manifest 制品无漂移。本刀产品 editor 源码
相对构建前摘要未变；五语言共享文件与 architecture 有后续并行增量，已保留并复核本刀
旧键仍为零、五个动作标题原值未变，未将固定构建证据扩称后续并行预览/批注改动已验。

默认 `verify:local` 已执行，停在并行 WorkbookGrid.tsx:101 的 useLayoutEffect 缺失
columns/rows 依赖 warning（零 warning 门禁 exit1）。不修改对方写集，不宣称全仓 green。
本刀没有 Rust/协议/服务端业务修改，不重跑无关 Go 全量；Windows/live/packaged/CLI/PTY
没有新证据，受控 Electron 场景也不证明真实 Provider 或两仓发布安装到 Turn。

分类：shared App Server、Article editor/artifact 投影为 current；旧 renderer host、模型、
授权占位及旧正向夹具为 dead/deleted/forbidden-to-restore；本刀无 compat/deprecated。
42/42 累计登记删除路径不存在，限定生产搜索为零；该分母不代表完整对齐完成度。
本清理切片实现与计划内定向/产品验证完成度 100%（本刀新删 4/4、累计登记 42/42），
全仓本地聚合仍受前述并行 warning 阻断。最终证据为
`.lime/qc/plugin-reconstruction/renderer-host-cleanup/final.json`，关联前轮
`authoring-cleanup-final.json`，所有失败、停止、诊断与完整复跑日志保留。
下一刀回 P04b：将当前 renderer localStorage 云会话事实收回共享账号 owner，并贯通
App Server 的远端目录/认证/下载物化，再做 installed/reconcile/share 与跨仓发布到 Turn。
当前 GUI 会话入口为 oemCloudSession.ts，插件 datasource 仍只消费本地 catalog；不能通过
新增 GUI 私有插件 HTTP/token owner 绕过共享主链。整体目标保持 active。

## P04a4 清退旧插件工作流元数据（本轮已验，整体 active）

P04a3 扩大复核发现 generic workflow owner 仍接受 pluginWorkflow/plugin_workflow 与
workerLifecycle/worker_lifecycle 作为 action-response resume 绑定来源，取消/重试仍额外写入
metadata.pluginWorkflow 状态。它们属于已删除插件/worker 的旧接线，不是 Codex 插件能力。
本轮直接撤掉四个旧来源和冗余插件事件字段，不迁移或兼容；现役 workflowResume 与通用
workflow 顶层状态/cancellation/retry 继续归原 owner，不新增业务后端。

写集：原本干净的 App Server runtime/turn_execution.rs、workflow/cancel.rs、workflow/control.rs，
及 queue_resume_audit、turn_lifecycle、event_log 三份既有测试；前轮自有 pluginFixtureBoundary、
两仓执行计划和架构 §7.2。两个超长 production 文件只删除旧分支，不追加业务；大文件拆分
不是本清理刀的前置，退出条件为旧接线无生产引用、测试迁出旧正向夹具且当前取消/重试/恢复不退化。

Verification Contract：P1/budget:normal。Rust owner 定向覆盖 generic workflow 的 cancel/retry、
Turn interrupt 的 audit 收尾、action response canonical 绑定与四个旧容器不能触发恢复、审计
redaction。公共 protocol/method 无新增；执行完整 contracts、两仓治理、真实 stdio/GUI smoke。
Agent 恢复主链另按最低门禁补 `smoke:agent-runtime-current-fixture`；只报告实际成功场景，
external fixture 不计 live provider，也不代替四个旧 metadata 容器的 Rust 负向行为回归。
本轮正在执行的正式 GUI 构建进入 backend 编译前追加该窄写集；最终产物必须包含新源码，
不复用旧固定 App Server 证明新行为。新产物构建和 fixture 结果未收取前不标记通过。

已验：App Server `--lib workflow --locked` 44/44，含四个旧容器不能恢复、canonical 绑定、
cancel/retry processor、Turn interrupt 和审计 redaction。首次直接 Cargo 漏用仓库 V8 制品
解析器而在默认下载地址 404，未执行测试；改用既有 `resolveRustyV8CargoEnv` 后通过，原日志
保留。正式新构建的 Electron shell 24/24 和同摘要 stdio initialize/fail-closed 已通过；
stdio 两次 5 秒超时及 30 秒诊断记录保留，未放宽标准 runner 阈值。Agent current fixture
最终以本轮新编译且摘要固定的 App Server 显式路径重跑整个入口：368 项定向/守卫及
22/22 真实 Electron 子场景全部通过，包含停止、审批、steer、恢复、重试和 Article Editor。
同一固定产物 shell 24/24、标准 stdio 也通过。第一次聚合在隔离 HOME 下逐场景等待 Cargo
metadata，两个场景通过后被显式替换；完整重跑使用既有 APP_SERVER_BIN/build-ready 合同，
不改断言或 timeout。固定产物、18 个认领源码及 8 个共享构建制品最终复核均无漂移。
按各场景记录的 runtime/external fixture 和 proofLevel 归档，未使用 live provider。
本工作流清退实现及计划内验证 100%，完整 Codex 对齐仍 active。

## P04a3 删除旧插件创作与发布样例（本轮已验，整体 active）

分发复核追加同域旧 Connector 专用 `vm-error-recovery`：它读取 QoderWork VM 诊断并调用
`mcp__builtin_qoderwork` 的 VM/feedback 接口，Lime current 主链无对应消费者。认领前该技能
三文件及官网同名三制品原本干净；直接删除这六文件，不改写成替代技能或兼容 Connector。
同一 embedded List/Load、目录删除守卫及无源公开包构建守卫覆盖；追加重跑受影响四个 Go
package、Node 目录/发布模板与官网包校验。本轮删除合计十四文件，累计登记三十八文件。
其他外部业务技能中的第三方路径示例不等于 Lime 旧插件 runtime，不据品牌文本批量删技能。

用户再次要求原有插件清理删除。本轮确认残留的 `plugin-creator` 官方技能仍指导生成
`.qoder-plugin`、写入 `~/.qoderwork/plugins-custom` 并调用旧 `install_from_path`；源码被
Go embed 及官网静态 ZIP/bundle/file-tree 两条分发链消费。平台发布模板同时仍生成
`artifactRenderers`，表单和正向测试仍推荐 `pane.actions` / `lime.skills` / `lime.ui`。
这些创作入口与 Codex current 合同冲突，直接删除或替换，不迁移、不兼容，不读取或清空用户目录。

窄写集：LimeCore `officialskills/default-skills/plugin-creator/` 三文件与官网同名三个产物；
`official_skills_test.go`、`pluginPublishPayload.ts`、插件平台页的精确 placeholder、现有
publish payload/目录测试及官网 `build-skill-packages.mjs`；两仓本计划和直接插件文档。
已确认新增认领源码/产物原本干净；前轮自有 directory-contract 与计划只追加本轮内容。
避让 Hooks/市场升级、GUI 文档预览、CLI/TUI、Railway/release 和其他未知写集；Codex 只读。

Verification Contract：P1/budget:normal。Go embed 列表与直接读取不再分发该旧技能；官网
源码和公开三个制品均不存在，生成器在 build/check 两种模式都拒绝残余公开包，防止删除
源码后仍上线旧 ZIP。模板只生成现役名称/版本/interface 展示元数据，组件摘要继续归包扫描。
执行现有定向 Node/Go、两仓治理、官网制品一致性与 diff 检查；无客户端 runtime/协议变更，
不复用历史 Electron/CLI/PTY 证据，不将本刀清理记为完整 Codex 对齐。

退出条件：十四个登记文件删除、旧正向创作/模板引用清零、真实分发 owner 和构建回流检查通过、
验证与剩余项写入两仓计划。本轮完成度只按该清理切片报告，整体目标保持 active。

追加只读发现：`workspacePluginPaneAction.ts` 只剩 Article Editor 一个生产消费者，仍生成
已无后端读取者的泛用 `plugin.pane_action`；该域同时已有独立的
`plugin.article_workspace_action` 及 App Server read-model 消费。追加认领原本干净的两个
pane helper/测试文件用于删除、Article action metadata builder 和现有两份直接测试；前轮自有
pluginFixtureBoundary 追加删除守卫。由 Article 领域直接生成现役 action metadata，移除重复
pane payload，不变更现役 Article action 存储/读取合同，不增加包 runtime 或兼容层。
Article 追加切片共删两文件；首批八文件加上旧 VM Connector 六文件，本轮共删十四文件。
补 Article builder/submit/负向守卫、typecheck、
contracts 与真实 GUI smoke。后续 P04a4 追加客户端 Rust 删除，产物按新源码重建，不再采用
本节初始的后端未变更前提；不能以 shell smoke 声称完整 Article/远端插件 Turn 已验。

已验：累计删除登记 38/38 不存在；本轮十四文件已移除。扩展后的两个官方技能 List/Load
及四个 Go owner package 全量、Node 22/22、55 个现役官网真实包校验、两仓治理与有界生产
旧接线搜索均通过。Article builder/submit/守卫 23/23、追加工作流守卫 2/2、scoped lint、
完整 contracts 通过。完整 `verify:local` 已过版本/i18n/lint/文案扫描，随后因并行 workbook
写集的 TS2352 中断；该写集更新后完整 typecheck 单独复验通过，未据此声称整个聚合门禁通过。
18 个认领源码的初始摘要已记录；后续只对两个自有服务端守卫作上述 Connector 清退的明确
扩展，其余无漂移。最终 22/22 Electron 产品回归已收取并复制归档；Article Editor 已验证
编辑、领域 action 提交和产物恢复，不再依赖旧 pane helper。两仓窄写集 diff、docs boundary
通过。分类：current 为共享 App Server、通用 workflow、Article action 和服务端扫描/发布/
目录；无新增 compat/deprecated；上述旧源/制品和接线均为 dead/deleted/forbidden-to-restore。
本轮清理及计划内验证完成度 100%（14/14 新删，累计 38/38 不存在），该分母不核销整体
Codex 目标；全量本地聚合因前述中断未全程通过，未补 Windows/live/packaged/新 CLI/PTY。
架构 §7.2 由 root 于 2026-10-17 确认。最终证据为
`.lime/qc/plugin-reconstruction/authoring-cleanup-final.json`，失败日志与复验一并保留。

## P04b2 包内容组件与发布对照（受控包切片已验，整体 active）

主目标仍为 Codex CLI/Desktop 与共享后端完整对齐。旧插件 24 项删除清单及两条旧旁路
保持 dead/deleted/forbidden-to-restore，不新增迁移或兼容。本刀在 current 上传扫描 owner
静态读取 ZIP 内 Skills、MCP、Apps 和 onboarding，绑定同一 package/manifest hash 的组件，
接入开发者审核前及平台受控包发布/更新/preflight；不执行包代码、不解压到工作目录。
任务和 Apps workspace materialization/授权不是已证实的包格式，不从包虚构这两类云端事实。

窄写集：LimeCore 新增同域 package components/skills helper 与测试；scan/upload/submission/
catalog/preflight 的精确接线、scan report model、既有 components 深复制 helper 的共享导出；
SDK/types、source OpenAPI/bundle、对应两仓插件文档及架构 §7.2。scan/upload/manifest 先只读
确认稳定再接线；避让 Railway/release、GUI、客户端 Rust/CLI/TUI 与未知并行修改。

Verification Contract：P1/budget:normal。元数据每文件 1 MiB、累计 8 MiB，保留现役 ZIP
512 项/256 MiB 预算与路径/链接拒绝。验证标准固定资源、原生声明/默认值、extension 优先级、
实际 skill metadata、MCP/Apps 摘要、非法资源/类型/预算、重复 skill 和 onboarding；完整上传
到审核发布/目录，手填不一致在 preflight/存储前拒绝，返回值修改不能污染 broker。SDK/TS、
OpenAPI、Go 定向后完整门禁。外部 URL 平台发布仍须单独补远端下载/内容验证，不能把受控
上传包的对照扩称所有来源已验；实际 DB/对象存储、账号/HTTP/客户端安装到 Turn 仍 pending。

退出条件：扫描事实有内容来源、受控包各发布入口不能绕开组件对照、审核 payloadHash 包含
自动摘要、所有新增合同/消费者同步、定向与完整验证通过并落证据。本节不核销总体完成。

结果：包内 5/5 摘要字段（app_ids/app_manifest/skills/onboarding_skill_name/mcp_servers）
从 ZIP 静态内容提取，标准与原生资源分别处理；云端 app_templates/scheduled_tasks 不从包
虚构。标准 Apps 未启用，onboarding 精确匹配已发现的 SKILL.md，技能隐藏/嵌套/多 roots
与实际 frontmatter/interface 被覆盖。原生技能缺省名来自已发现的目录；包根技能要求显式
name，避免猜测客户端安装目录。发布边界严格拒绝错误声明，不宣称复刻客户端所有 YAML
修复、MCP lowering 与运行时容错。

开发者 preflight/审核 payloadHash 前，以及平台单条创建/更新/bulk/preflight 四个入口均
对照受控包，手填不一致在存储前拒绝；省略自动填充。受控包空 components 只清云端字段，
包内事实保留；同 hash 幂等 bulk/preflight 保留云端任务/模板，换包不继承旧摘要。受控 URL
的 query、host 大小写和编码别名不能绕过扫描。外部 URL 的平台发布仍缺下载/内容验证，
没有将其标成已扫描，也没有为此增加旧插件兼容路径。

扫描报告与同一 release 复用深复制 helper，返回值不能改 broker；审核请求的复制原会将
null 数组改成 []，导致保存前后 hash 不同，现已改为保值复制并隔离两个权限 bool 指针。
新增回归直接重算持久审核 payload hash。扫描期间字节替换、扫描完成时会话过期均拒绝，
旧报告不能使不同包成为公开制品或发布证据。ZIP 增加文件/目录冲突拒绝，metadata 每文件
1 MiB/累计 8 MiB；不执行包代码，不落盘解压。测试文件按上传/审核/组件边界拆分，原路由
测试由 786 行降到 570 行；旧人工受控 URL 夹具改为明确的外部 ZIP 来源。

已验：3 个 Go package 定向、SDK 14/14（含两个 complete HTTP 消费）、SDK/types TypeScript、
OpenAPI bundle、实际 Go HTTP router 上传→审核→目录 response 的 Ajv schema 检查；
客户端 legacy-report 边界违规 0，docs:boundary 本轮已通过。Ajv 8.18.0 关闭 format 验证，
不是完整 OpenAPI semantic validator。正式 bundle 187 paths/502 schemas。
复用前轮从 Codex 原文提取的 10 个响应类型，新 HTTP 目录真实样本反序列化与包内字段
round-trip 通过；首次 harness 比较将省略 Option 与 Serialize 的 null 当成差异，按上游
Option 语义规范化该可选字段后通过，生产响应与 serde 类型未放宽。第一次及最终日志均保留。
完整 make verify-go 最终复验通过（所有 Go 模块 fmt/vet/test）。本切片退出条件 7/7，
完成度 100%；整体对齐保持 active，不能用本分母估算或核销整体完成度。

证据来自 Go httptest router 与独立 Node loopback SDK fixture；未经过实际 Go 服务启动进程
到 SDK 的网络链路、真实对象存储/重启恢复、MySQL、客户端下载安装到 Turn、新 Electron/
CLI/PTY、Windows/live/packaged。旧登记清单 24/24 仍不存在；current 为上传扫描/发布/
目录及共享 App Server，无新增 compat/deprecated。客户端标准 Apps 行为、完整 parser/资源、
外部包验证、账号/HTTP/远端安装/对账/分享、canonical 同名冲突与整体对齐仍 active。
架构 §7.2 图与事实源由 root 于 2026-10-17 确认。证据归客户端
.lime/qc/plugin-reconstruction/package-components-final.json，不复用旧产品证据核销整体目标。

## P04b1 release 组件合同（发布与目录切片已验，整体 active）

主目标完整对齐；当前远端详情只有展示摘要，缺 Codex remote.rs 的 app_ids/app_manifest/
app_templates/skills/onboarding_skill_name/mcp_servers/scheduled_tasks。本刀将类型化 components
纳入同一 release 记录与发布输入，贯通单条/批量发布、深复制、snapshot/SQL row、目录投影、
SDK/types/OpenAPI，嵌套 schedule 保持上游 camelCase tagged union。组件不是本地安装事实，
不从 Skills 路径猜名称，不执行包代码，也不恢复旧 renderer registry。

窄写集：plugin_directory 与同域新 components model/service/repo helper；plugin_catalog 的
request/release 字段与验证接线、inmemory catalog/bulk publish 的机械赋值和现役 SQL row/建表
基线；对应 HTTP/service/repo/SDK 测试、source OpenAPI/正式 bundle、两仓插件文档/架构。
避让并行 package scan/upload、manifest parser、release/Railway/GUI。开发期直接改 current
schema 基线，不新增旧数据迁移或双读；不操作实际数据库。repository 885 行仅做字段接线，
新深复制职责放同域 helper，退出条件为不向原文件追加组件业务逻辑。
复核追加原本干净的 inmemory_control_plane_repo_plugin_release_submission.go 一处复制接线：
审核单与 preflight normalized payload 必须复用同一深复制 helper，防止请求/响应引用修改待审核内容。

Verification Contract：P1/budget:normal；真实公共 HTTP 发布输入 -> 授权 list/detail，组件和
release identity 一致；坏类型/非法任务/敏感字段拒绝，更新/清空和快照恢复不丢失，返回值不
共享可变内存。SDK/TS、Go 定向/完整门禁与 OpenAPI 检查；直接提取 Codex 原响应类型做
反序列化样本验证，不能冒充完整客户端安装。包扫描自动提取、共享认证、HTTP/物化、
canonical 同名冲突与 installed/reconcile/share 继续 pending；本刀不得据此核销。

结果：7/7 组件字段进入同一 release 的 typed components，单条创建/更新、bulk publish、
审核单/preflight 深复制、snapshot 与 SQL row 全部接线；目录在 release 内展开上游字段。
4/4 schedule variant 保持上游 type/camelCase/weekday 枚举。敏感字段、重复 key、坏类型、
非法 schedule 与相对图标在发布前拒绝；不执行包代码，不猜 Skills 名称或授权结果。
省略 components 保留现值，显式空对象清空；空 app_manifest 与 scheduled_tasks 保持空对象/
空数组。包/manifest hash 实际变化且无替代组件时清除旧值，幂等重发和签名引用变化保留。
SQL 只改 current 建表基线的 components_json，未操作实际数据库、未新增旧数据迁移或双读。

验证：3 个 Go package 定向回归与最后完整 make verify-go（各模块 fmt/vet/test）通过；
make verify-contracts、SDK 13/13、SDK/shared types TypeScript、两仓本写集 diff check 通过。
Go public router 使用 httptest，从创建 catalog/release/租户发布到 list/detail，再更新清空；
SDK 是独立受控 Node loopback HTTP，不宣称两者为 Go 实际进程到 SDK 的网络闭环。
同一公共 router response 被提取的 Codex 原 release/技能/模板/任务类型反序列化，7 个字段
round-trip 一致；共提取 10 个原类型，仅移除 TS/JsonSchema 生成属性，保留全部 serde 合同。
Ajv 8.18.0 对实际 response 的定向 schema 校验通过并拒绝 interval_hours；关闭 format 验证，
不能当作完整 OpenAPI 语义 validator。正式 bundle 为 187 paths/502 schemas。

新增换包测试最初误把 manifest hash 当作新 package hash，触发现役验签要求两者分别绑定；
换成独立摘要样本后定向/完整 Go 均通过，验签规则未放宽。current 为既有 release/目录/仓储
owner，无新增 compat/deprecated/registry；原登记旧插件 24/24 继续禁止恢复。
本组件发布/目录合同切片 100%（7/7 字段、4/4 schedule），整体 active。证据归
.lime/qc/plugin-reconstruction/release-components-final.json。架构 §7.2 与图由 root 于
2026-10-17 确认。docs:boundary 仍仅被并行发布计划旧路径阻断，未改该写集。

仍未核销：包组件自动提取/内容对照、真实 MySQL 应用/网络发布到客户端、共享账号 owner、
远端 HTTP/下载物化/installed/reconcile/share、canonical 同名冲突、真实 Turn 与新 Electron/
CLI/PTY/Windows/live/packaged。本刀无客户端业务 Rust/GUI 改动，不复用旧产品证据核销。

## P04b0 修正 Codex 不接受的远端身份（身份切片已验，整体 active）

P04b 认证/安装核对发现前置合同错误：Codex core-plugins/remote.rs 的
is_valid_remote_plugin_id 仅接受 ASCII 字母数字、下划线、连字符和波浪号，当前 P04a
服务端 ID 却为 name@marketplace，会在远端 install/uninstall/share 等入口被拒绝。
先修正这一实际阻断，再推进 release metadata、共享账号认证与远端物化，不缩小整体目标。

远端 ID 改为现役 catalog 完整身份的稳定 SHA-256 标识，不新增 registry 或映射表；解析端
只比较当前已授权条目的 ID，不从客户端 ID 反解租户/用户/授权。name 保持 manifest 名称，
本地 PluginId 仍为 name@canonical marketplace。旧含 @ 的远端 ID 不兼容、不迁移。
写集：LimeCore directory identity/service、registration 目录查询接线、对应 service/HTTP/
pagination/SDK 测试、OpenAPI ID 约束、两仓插件合同/架构/计划。避让并行 package scan/upload、
release/railway/GUI 预览及未知写集；Codex 只读。

验证合同 P1/budget:normal：真实公共 HTTP response -> 同 ID detail、租户授权与分页、
同名不同 catalog market 的远端 ID 不碰撞、变更 release 后 ID 稳定、非法/旧 ID 拒绝；
SDK 回归、Go 定向与完整门禁、OpenAPI 检查；提取当前 Codex 原函数经 rustc 执行相同 ID
fixture，仅证明上游 ID 校验兼容，不冒充完整远端客户端或安装到 Turn。
远端 canonical workspace 同名冲突、release 完整组件 metadata、共享账号 owner 与 HTTP/
物化/installed/reconcile/share 仍未完成，不能用本刀核销。

结果：directory/list/detail/registration 统一稳定 `plg_<sha256>` ID，按现役授权条目查找，
旧 `name@marketplace` 远端 ID 与旧 cursor 直接拒绝。新增真实 service 回归覆盖同名不同
catalog market 的远端 ID 独立、list 到 detail、更新 release/展示名保持 ID、撤回后拒绝；
公共 HTTP 覆盖 list -> registration -> 同 ID detail、非法 Unicode/旧 ID 400 与合法未知 ID 404。
分页回归在已登录用户下验证旧/非法 cursor 及当前可见性，避免不存在用户掩盖输入校验。
OpenAPI source/bundle 与 shared types、API 文档/目标合同/架构同步，远端 ID 不再当成本地 ID。

验证：定向 service/controller、SDK 12/12、SDK/types TypeScript、完整 make verify-go 和
make verify-contracts 通过；最后仅增强 query 负向测试的有效用户前提，定向复验通过。
直接提取 Codex 基线 4eb4a654 的原 is_valid_remote_plugin_id，经 rustc 1.95.0 编译执行，
接受 HTTP golden ID、SDK ID 和合法字符样本，拒绝旧 ID/空串/Unicode/路径/查询等 8 个输入；
OpenAPI pattern 与相同样本一致，bundle 为 187 paths/495 schemas。不是完整上游远端安装证据。
本切片 100%，整体 active；current 为同一 directory/发布授权 owner，旧含 @ 远端 ID 为
dead/deleted，无新增 compat/deprecated/registry/迁移。架构图及身份边界由 root 于
2026-10-17 确认。证据归 .lime/qc/plugin-reconstruction/remote-identity-final.json。
远端同名 canonical cache 冲突、完整组件 metadata、账号 owner/HTTP/物化和到真实 Turn 仍 pending。
最终旧清单复核仍 24/24 不存在；本刀两仓 diff check 通过。docs:boundary 重跑仍仅被并行
release-v1.160.0-plan.md 的旧路径引用阻断，未改发布写集。未新增 Electron/CLI/PTY、Windows、
live 或 packaged 证据；下一刀继续完整 release metadata 和共享认证/远端消费，不恢复旧插件。

## P04a2 删除旧签名配置与安装遥测（清理切片已验，整体 active）

用户再次要求原有插件清理删除。本刀清退未随 P04a 删除的两条旧旁路：renderer
OEM runtime 的插件签名可信根解析（已无安装消费者），以及 LimeCore 客户端自报
install-state 的路由、授权、service、repository、snapshot 字段、审计动作、SDK 和合同。
开发期直接删除，不迁移、不双读、不新增兼容包装；不将自报遥测改名为 Codex installed registry。
服务端 release 的上传校验与当前 directory 授权继续由其领域 owner 承担。
追加认领原本干净的服务端 bootstrap model/service、control_plane_service/runtime 的专用
setter/转换、configs 的 YAML/env/type/校验和旧正向测试，完整清除下发链；releaseSignature
有独立现役消费者，发布校验不借此次清理更改。

窄写集：oemCloudRuntime 及其现有消费者测试、pluginFixtureBoundary；LimeCore 上述
install-state 精确符号所在文件及其旧正向测试、OpenAPI source fragments、SDK/types；
两仓插件计划、架构 §7.2 与受影响 current 文档。超长 repository/type 中只做机械删除，
不追加业务。避让 release/railway/REA/文档预览/并行上传校验和未知改动；Codex 只读。

验证合同：P1，budget:normal。四层删除引用清零；旧 route 显式负向验证、snapshot 序列化
不含旧字段、SDK 暴露检查与回流守卫；定向 Go/TS、make verify-go、verify-contracts、
Lime legacy-report 与 test:contracts。纯删除无新增 Rust/GUI 行为，不借旧 Gate B 核销远端安装。
本刀清理分母为上述两条旁路；P04b 认证/HTTP/下载物化和整体 CLI/Desktop 对齐仍 active。

结果：两条旧旁路 2/2 已删除（本切片 100%）；无新增 compat/deprecated、迁移或兼容包装。
旧遥测 HTTP 未认证/已认证均 404；内存 map、snapshot 读写字段、审计动作及平台/代理后台
筛选标签已删除。snapshot 定向回归证明现役 catalog/release 仍能恢复。bootstrap JSON 不含
旧签名根且 session/user/tenant 身份保留；renderer context 的类型、解析与无消费者 helpers
删除 202 行，同步撤专用 TS/Go 正向测试。SDK TS/正式 JS/shared types 与 source OpenAPI
直接删除，正式 bundle 当前 187 paths/494 schemas。生产链回流守卫覆盖路由、service、
repository、config、SDK、审计页和 source 合同；原登记删除清单仍须保持 24/24 不存在。

验证：客户端 5 文件 55 项通过，定向 lint、renderer/node 完整 typecheck 通过；SDK workspace
与 HTTP/清理守卫合计 12/12，SDK/types TypeScript 通过。4 个受影响 Go package 的 Plugin/
OpenAPI 定向测试、完整 make verify-go（所有 Go 模块 fmt/vet/test）与 make verify-contracts
均通过。首次新增 bootstrap 测试误把 tenant 当顶层字段，按真实 session.tenant 合同修正，
其余校验未放宽；最终定向和全量 Go 通过。客户端 legacy-report 边界违规 0；contracts 在
protocol/client 299 checks、command/harness 及治理全部通过，末尾 docs:boundary 仍仅被并行
release-v1.160.0-plan.md 的旧 docs 路径引用阻断，未触碰发布写集。

平台/代理审计页仅撤无效枚举选项，TSX 语法检查通过；LimeCore 无 node_modules，未执行
完整 Web 应用 typecheck/build。未新增 Rust/GUI runtime 行为，未运行新 Electron/CLI/PTY、
live/Windows/packaged 或跨仓发布到 Turn；不复用历史产品证据核销 P04b。
本刀两仓 diff check 通过，证据归 .lime/qc/plugin-reconstruction/legacy-plugin-cleanup-final.json。
架构 §7.2 与图由 root 于 2026-10-17 确认。current 为共享插件 owner/远端 directory/发布授权；
上述两条旧链为 dead/deleted/forbidden-to-restore。下一刀回到 P04b 共享账号认证、远端 HTTP
与现役 materialize 消费；不新建 renderer 安装器或第二套安装 registry。

## P04a 远端目录合同直接替换（服务端读取切片已验，整体 active）

主目标仍为完整 Codex CLI/Desktop 共享后端。本刀删除 LimeCore 的旧
`plugin-marketplace/v1`、activation/packageRef 投影及 SDK 方法，按上游
`core-plugins/src/remote.rs` 的 directory/list/detail 合同重建唯一远端读取 owner。
范围为租户认证 base URL 下 `/ps/plugins/list` 与 `/ps/plugins/{id}`；raw snake_case JSON，
`plugins + pagination.next_page_token`，可见性先裁剪再分页。当前租户发布映射 WORKSPACE/LISTED；
GLOBAL/USER 无数据，不伪造跨租户目录。下载 URL 仅详情显式请求且当前授权允许时返回。

窄写集：LimeCore 插件 directory model/service/controller、原 marketplace 文件删除、
registration/install-state 现有控制面消费者从旧 DTO 解耦、授权路由、OpenAPI source fragments、
SDK/types、定向测试、官网/API/治理文档和两仓计划。原 plugin_catalog_service 接近 800 行，
将客户端相关职责拆到同域 owner；public_client 只撤接线，handler 放同域文件。
Codex 只读，避让 release/railway/settings/REA/文档预览及未知写集。

Verification Contract：P1，budget:normal；唯一事实源仍为现有 catalog/release/tenant enablement，
不新增云端安装 registry、runtime、兼容层或迁移。逐次检查租户/用户可见性、ready release、
许可证/注册码策略；无效 scope/limit/cursor 明确拒绝，cursor 不能绕过重新授权。
退出条件：旧生产 DTO/路由/SDK 引用清零并有回流守卫；service/controller/SDK 定向回归、
完整 OpenAPI 解析和正式 bundle 一致性、Go/TS 贴边界验证通过。修复完整合同中已知重复 GET
必须保持 audits 与 runtime 各自路径。架构 §7.2 同步，由 root 验证后确认。
本刀不核销远端 installed/install/uninstall/reconcile/share、客户端 HTTP/认证与下载物化、
真实跨仓发布到 Turn、Desktop 市场、Windows/live/packaged 或整体完成度。

实施结果：删除旧 marketplace model/service/正向测试文件，现役 directory owner 直接读取
catalog/release/tenant enablement。list 使用 raw plugins/pagination，详情显式下载选项与当前
授权共用同一 resolver；隐藏/撤回/跨租户拒绝，分页期间重新授权，cursor 绑定租户/用户/scope。
旧 query/category/sort、未知/重复/空参数、坏 cursor 明确拒绝。相对包图片路径不冒充公开 URL。
SDK/type/source OpenAPI/官网/API 与治理说明同步，旧读取方法无 alias。商业注册码/安装遥测
拆出同域 service，不从 directory DTO 反推安装事实；删除 2 个零调用 metadata helper。
catalog service 从 844 降到 726 行；public_client 从 921 降到 859 行，只撤旧接线，
目录与现有插件 handler 收回 121 行的同域 controller。

进一步删除旧 activation/Right Surface 验收器、测试、schema 和模板；它们与已删除客户端
owner 不符。新增路径/DTO/SDK 回流守卫。登记清单客户端 17 + 服务端 7 = 24/24 不存在，
仅该清单清理 100%；current 为共享插件 owner 与新云端目录，无新增 compat/deprecated 或迁移。

完整合同首次解析揭示 source fragments 10/60/90 缩进使路径/模型落到根层，以及 audits 下
重复 GET 覆盖 runtime GET。已修正层级与路径，并按实际 Go model 补齐 4 个悬空引用涉及的
10 个具体模型定义。正式生成器更新 bundle，现为 188 paths/500 schemas。
make verify-contracts 现额外运行 Go YAML/根层级/全部本地引用/关键路由与旧 schema 负向检查；
这不是完整 OpenAPI 语义校验器，未将文本生成一致性等同于全规范验证。

验证：37 个顶层插件/合同 Go 测试（含子场景）、make verify-go-fast 与全量 make verify-go
均通过；make verify-contracts 通过（最后 guard 放宽合法 OpenAPI 根字段后定向复验通过）。
SDK workspace 9/9、新真实 loopback HTTP/删除守卫 2/2、SDK/shared types TypeScript 检查通过。
LimeCore 无 node_modules，workspace 测试用临时 resolver 指向本仓正式 JS 入口；TS 编译器复用
Lime 安装的 5.9.3，临时配置仅把 @limecore/types 定位到实际源码，不新增依赖或生产 fallback。
Go router 是 httptest、SDK HTTP 是独立受控 Node fixture；未声称两者构成真实 Go 进程到 SDK 闭环。
客户端旧路守卫 2/2、legacy-report 边界违规 0。Lime contracts 的 protocol/client 299 checks/
command/harness/治理均通过，最终仍被并行 release-v1.160.0-plan.md 的旧 docs 路径引用阻断；
未修改发布写集。两仓本写集 diff check 通过。

证据：.lime/qc/plugin-reconstruction/remote-directory-{cleanup,final}.json。31 项关键源码摘要
收尾复核；初始快照后仅 OpenAPI guard 的合法根字段放宽发生已登记变化。架构 §7.2 与两仓计划
由 root 于 2026-10-17 确认。P04a 已定义的服务端读取切片 100%，整体仍 active。
extended release 的 Skills/MCP/Apps/定时任务及公开资源 metadata、远端安装/对账/分享、
客户端 HTTP/认证/下载物化与跨仓真实 Turn 仍 pending；本轮没有新的 Rust/GUI 产品改动，
不以之前 Hooks/Electron 证据核销这些远端缺口。

## P03 typed 插件 Hooks 来源（本地切片已验，整体 active）

上一轮为progress：旧入口删除、升级cache刷新及固定产物四阶段验收已完成。本轮直接补
`hooks/list`与当前provider step始终传空插件来源的缺口。上游依据为core-plugins loader的
`load_plugin_hooks`、HooksOnly加载及hooks discovery。特别注意：当前Codex明确跳过标准
Agent Plugins格式的Hooks，不能因为extension声明存在而额外启用；仅原生生态格式按上游解析。

写集：tool-runtime的hook discovery/config/source与command reporter；App Server plugin_catalog
同域Hooks loader及components声明投影、PluginDataSource、runtime/hooks；runtime_backend只加
接线并把动态来源职责放同域helper；agent-runtime session config与agent hook snapshot接线；
对应owner/public JSON-RPC和真实stdio fixture；本计划、architecture §7.2与LimeCore联动计划。
追加认领原本干净的agent-runtime/provider_turn.rs及同域hook_snapshot helper和独立测试模块：
把快照校验从超长主循环提取，无效快照必须在sampling/工具执行前失败，不允许静默绕过Hooks。
避让settings/release/REA/文档预览及未知写集，Codex只读。hook_discovery已822行，先将配置类型和
测试拆回同域模块后再增加行为；runtime_backend接近800行，仅允许接线，来源业务放helper。

Verification Contract：P1、budget:normal。唯一来源为App Server PluginStore的已启用安装记录；
解析原生默认文件、显式路径/路径数组、inline对象/对象数组，保留完整ID/相对来源稳定key与
源文件；缺失/坏组件告警隔离，不回退已声明的默认文件。内部typed source经session config传递，
不从renderer metadata读取包目录。每次provider step重新加载，按上游HooksOnly读取全部启用插件，
不因Mention选择关闭其他插件的Hooks。停用/卸载/
升级对后续step生效，已捕获step保持不变；hooks/list消费同一loader。执行注入PLUGIN_ROOT/DATA及
上游生态环境变量，信任hash/启停仍由既有discovery决定，不能借插件安装绕过信任。
失败终态为source load error或可定位组件warning，不能恢复activation或平行registry。

退出条件：定向loader/discovery/执行器/动态来源、公共JSON-RPC和真实stdio回合证明同一身份与
PreToolUse/PostToolUse执行、停用/升级/冷启/卸载生效；contracts、旧路守卫与受影响GUI验证。
本刀不核销MCP hook handler、executor/builtin清理allowlist、其他生命周期事件admission与完整
managed config/layers；它们仍须对照上游补齐，不能把typed来源接线记为完整Hooks对齐。
架构影响major，目标图为catalog -> typed source -> shared hook owner -> canonical通知；
architecture §7.2已更新，root于2026-10-17确认实际实现与本地产品证据，不新增公开method/后端/迁移或兼容层。

实施记录：新增typed source后删除原HookPluginSource目录猜测，config与测试从discovery拆出，
discovery降至493行。来源provider每个step委托同一PluginDataSource，不新增cache或registry。
再次核对上游loader的HooksOnly入口后，撤销新增的Mention过滤：Hooks只受启用配置与既有信任控制。
provider_turn原有if-let-Ok快照校验会静默绕过全部Hook，现提取同域helper并将错误返回主循环；
补充非法key、重复key、相对路径和来源失败在sampling前终止的回归。测试shell按实际cmd/PowerShell/
POSIX命令选项选择，不假定Windows只有cmd。

已收取loader定向5/5、tool-runtime Hooks33/33、provider Turn59/59、Agent接线43/43与公共JSON-RPC3/3，
共143项Rust通过；前端网关/旧路守卫6/6及legacy扫描（边界违规0）通过。
原登记旧路径再次核实17/17不存在，证据plugin-hooks-cleanup.json；不新增compat/deprecated。
contracts在protocol/client/command/harness/各治理项均通过，最终docs:boundary仍因并行发布计划
release-v1.160.0-plan.md的外仓文档引用exit1，最终单独复核仍为同一阻塞，避让发布写集。

新产品build通过。固定目录`/tmp/lime-plugin-hooks-artifacts-wrhmp6ka`含9项产物和25项本刀源码摘要。
初始App Server为`24bae18d846d68355fd493155704395d1b1b5e5c824dc021000125bf5d349636`；
Electron现役启动准备会调用ensureMacBinaryRpath补写@executable_path，之后为
`1dbefd74f17e920eeb64389adcdfdb639e429491bc3713df11cc8ee7ddf845cb`。首次收尾摘要校验据实
发现这一变化，未覆盖初始记录；保留prepared-artifacts的前后差异，并在已准备产物上复跑stdio。
prepare再次调用返回already-present/未修改；最后9项产物和25项源码与prepared记录一致。

真实stdio两次独立运行均通过；每次4个Turn、7次exec_command、8次实际Hook子进程和16条成对成功
通知。证明未信任不执行、信任后Pre/Post执行、采样期间停用/升级只影响后续声明快照、Mention另一插件
不关闭当前Hooks、PLUGIN_ROOT/DATA及生态别名、持久data、冷启恢复与卸载不重执行。
canonical命令均completed/exit0，Thread/Turn/Item与Hook输入/通知身份一致。Provider为loopback夹具。
literal verify:gui-smoke exit0；真实Electron初始化、reload、三尺寸与Memory Settings通过。
插件Electron exit0，两次独立main PID覆盖安装/启停、完整mention、Skill/MCP、reload、冷启及卸载后历史；
console errors、missing methods、legacy MCP与production mock均0。冷启与卸载截图已检查，原生子视图内容
由WebContents marker、window owner、visible和非零bounds证明，不能以主renderer截图留白代替内容证据。

证据归`.lime/qc/plugin-reconstruction/plugin-hooks-{loader,rust,artifacts,prepared-artifacts,product,
stdio,prepared-stdio,cleanup,final}.json`、plugin-hooks-gui-smoke与plugin-hooks-electron；初始结果保留。
最终状态product-pass-with-unrelated-doc-blocker。current为共享catalog/typed source与既有Hook执行owner；
旧清单17/17为dead/deleted/forbidden-to-restore（仅清单100%），无新增compat/deprecated。
保持整体active：其他Hook生命周期、MCP handler、executor/builtin清理allowlist、managed config/layers、
Desktop市场入口、插件Git/npm/remote物化/reconcile/share及LimeCore远端合同仍pending。
新CLI exec/PTY、Windows/live/packaged、全仓verify:local和跨仓发布下载到Turn未验证，不由本刀核销。

## P03 升级缓存刷新与旧 activation 删除（本切片已验收）

主目标仍为 Codex 插件合同和共享后端；本刀修复市场升级后已配置插件仍停留在旧 cache 的缺口，
并删除 tool-runtime 中零调用的旧 activation JSON 转换入口，不兼容旧数据。
上游依据为 `core-plugins/src/manager.rs::upgrade_configured_marketplaces_for_config_with_mode`、
`loader.rs::refresh_non_curated_plugin_cache_force_reinstall_detailed` 和
`app-server/src/request_processors/marketplace_processor.rs`。显式指定非 Git/未知市场必须报错；
有新市场快照才强制刷新配置键对应插件（包括 disabled 和同版本内容变化），逐插件隔离错误。
`openai-curated` / `openai-api-curated` 按上游排除，归后续 remote reconcile，不以本地刷新替代。

窄写集：plugin_catalog/install.rs、marketplace.rs 及其 refresh 模块；runtime/plugins.rs、
processor/plugin.rs 与生命周期/marketplace JSON-RPC 测试；tool-runtime/hook_discovery.rs 中
无消费者旧函数及对应回流守卫；CLI surface fixture；本计划和 architecture §7.2。
沿用上一轮已认领写集，避让 settings/release/REA/未知源码；Codex 只读。
追加认领原本干净的 v0/tests/fixtures.rs 四处旧插件事件示例，替换为既有 automation.turn；
check-command-contracts.mjs 仅修正两条回流守卫文案，不增加业务逻辑。收尾追加认领 commands.md
插件段，将已删除的目录安装/旧 DTO/启停 method 从“待删除”改为禁止恢复。负向拒绝旧 metadata 的
测试保留，不能为了关键词清零删掉实际防护。

Verification Contract：budget:normal，P1。current owner 为共享 App Server plugin_catalog；
输入为配置 Git 市场的新快照，输出为原子替换后的插件 cache、保留的启停配置和最新 Skills/MCP。
失败在 materialization 层保留该插件旧 cache，其他插件继续；no-op/市场快照全部失败不发送
变更通知。已有 upgraded roots 时即使某插件刷新失败仍更新 catalog，不能隐瞒已提交的市场变化。
调用链为 CLI/typed gateway -> marketplace/upgrade -> RuntimeCore -> 同域 materialize ->
MCP invalidate、Skills watcher/cache/changed；read model 为 plugin/installed 与 skills/list。
本刀不改变 Turn/Item wire、approval 或 sandbox；Hooks 插件来源尚未接线，明确 pending，
不能以删除 activation 函数声称 Hooks 完整对齐。退出条件为上述行为的公共 JSON-RPC、
生命周期、旧路守卫和真实 CLI/双连接 runtime 验证通过；GUI smoke 按主路径影响补验。
验证写集追加 `skills-roots-fixture.mjs` 的新场景接线与同域 marketplace-upgrade-scenario helper，
复用既有 provider capture、SDK、Turn 和冷启 owner，不新增生产后端。
Evidence Layers：deterministic/public JSON-RPC=yes；真实 stdio/CLI=yes；GUI smoke=yes；
live、Windows、packaged、跨仓发布到 Turn=no，本刀不核销这些未完成项。
命令：定向 app-server/tool-runtime 测试、test:contracts、governance:legacy-report、
受影响 fixture/GUI smoke；新产物独立摘要，不复用上轮产物宣称本刀通过。
架构影响：major（组件刷新数据流）；architecture §7.2 同步后由 root 确认；整体目标保持 active。

阶段记录：公共测试先在旧实现上复现 3 项失败；修复后曾因测试只检查请求返回值、未订阅
App Server 出站广播而剩 1 项失败，改为真实 broadcast 接收后 5/5 通过。
覆盖版本变化和同版本内容更新、disabled 保留、未配置插件不安装、未选择市场不动、
逐插件失败保留旧 cache/继续其他插件、no-op 不广播、显式非 Git/未知市场错误。
完整 contracts、legacy-report（边界违规 0）、scripts governance、docs boundary 与
插件删除守卫2/2、Skills边界10/10通过。CLI fixture旧字符串断言锁定换行，已改为忽略
格式空白且2/2通过；初次Vitest指定不存在的独立配置、初次CLI夹具误用node:test均未执行
业务测试，正确runner的结果单独记录。最终 Rust、新固定产物和产品层结果见下。

后续 Rust：插件过滤 owner39/39、tool-runtime hook_discovery5/5、最终公共市场5/5、
Apps/Config/MCP/Search8/8、协议及schema fixtures13/13均通过。Hook删除仅移除零调用转换，
既有信任/async/typed source路径保留。以上 Rust 不重复计算重跑共70项通过；
前端/守卫共14项通过。定向lint、Prettier、Rustfmt、docs boundary和两仓写集diff检查通过。
新真实Git场景已放入既有 scripts/app-server 领域helper；Skills聚合runner复用场景参数接线，
812行不继续承接场景业务，后续新增场景继续拆同域helper，不向聚合文件堆叠。

新固定产物 `/tmp/lime-marketplace-refresh-artifacts-RKtSOY` 的9项摘要及9项关键源码摘要最终复核未变。
App Server SHA-256为 `38ff1e66e98d5ae55d0186f427664356dbcb970e8368567ede4b5a5d61dac3c1`，
CLI为 `2897d3df0f943d450c410e90b0bb546dd4ccf211899c56761897eeddbfcb4ac5`；CLI源码未变，
字节与上轮相同不作为新后端的证据。三入口product build通过，同固定产物四阶段均exit0：

- 真实stdio runtime：两个SDK连接、5个Turn/5次Provider capture、两次Git升级（版本变化及同版本内容变化）、
  一次冷启；当前模型请求实际包含升级后的Skill。Provider为本地可控夹具，不是live。
- 真实CLI surface：插件/市场管理全链及显式本地/未知市场升级错误通过；不替代`lime exec`/PTY证明。
- literal `npm run verify:gui-smoke`：真实Electron/preload/IPC、JSON-RPC初始化、reload、三尺寸和Memory Settings通过；
  本场景不证明Turn、live、packaged或Codex像素一致。
- 插件Electron Gate B：两个独立主进程、preload/IPC、`app_server_handle_json_lines`、runtime和canonical
  Thread/Turn/Item身份一致；安装/启停、完整mention、Skill context、MCP表单/原生面板、reload/冷启与卸载后历史通过。
  卸载后Provider/tool不重执行、MCP不重启；console errors、missing methods、legacy MCP命令和mock fallback均为0。
  已检查冷启与卸载截图；原生面板内容由WebContents marker、窗口归属、visible和非零bounds补证，
  不能用主renderer截图中的原生子视图留白证明内容。该结果不是packaged/live/Windows证据。

证据归 `.lime/qc/plugin-reconstruction/marketplace-refresh-{artifacts,rust,product,checks,final}.json`、
`marketplace-refresh-skills-runtime.json`、`marketplace-refresh-gui-smoke/summary.json`、
`marketplace-refresh-package-electron/plugin-package-electron-gate-b-{summary,raw}.json` 和同目录
`native-view-verification.json`。旧批证据保留，不由新结果覆盖。

分类：共享App Server catalog/materialize、Skills/MCP和LimeCore scanner/release owner为current；
无新增compat/deprecated。原登记两仓旧路径17/17仍不存在（该清单100%），旧activation转换和v0旧事件示例已清；
旧DTO/schema、目录安装、token/mock/worker等禁止恢复。复用唯一materialize事务减少重复，删除零调用适配，
不新增迁移或兼容抽象。整体Codex对齐保持active；typed插件Hooks接线、远端物化/reconcile/share、
Desktop市场入口、LimeCore远端合同及两仓发布下载到Turn仍pending。Windows/live/packaged、新exec/PTY与
全仓verify:local未跑，不以本刀验证核销。下一刀先接typed插件快照到Hooks，再推进LimeCore远端owner。
架构图确认：root，2026-10-17；architecture §7.2已同步实际刷新数据流与未完成边界。

最终文档复核补充：先前`docs:boundary`为exit0，收尾重跑exit1，唯一命中为并行修改的
`internal/exec-plans/release-v1.160.0-plan.md`中LimeCore外仓文档链接；保持避让发布写集。
本轮插件文档未被报错，两仓认领写集diff检查exit0。最终摘要标记
`product-pass-with-unrelated-doc-blocker`，不把全仓文档检查写为全绿；该阻塞不核销或否定
已完成的四阶段产品证据。

## P03 市场来源管理（本地来源切片已验收）

上一轮为有效进展：四组本地合同、旧面删除与新固定产物验收已落库。当前推进
`marketplace/add/remove/upgrade`、共享配置和配置驱动发现，随后继续插件Git/npm/remote物化及LimeCore闭环。

写集：新增v2 marketplace协议及其正式生成物，既有method/envelope/schema注册；core/config插件领域的
MarketplaceConfig及Config字段；App Server plugin_catalog市场来源/快照管理与discovery、datasource/runtime/
processor接线；CLI plugin marketplace子命令；两层typed client、plugin gateway与对应fixture/测试；
本计划和architecture插件段。LimeCore先核对现役HTTP与包控制面，再按真实远端消费缺口认领；不凭本地
市场方法新增云端安装事实。避让settings/release/REA/未知源码与tsbuildinfo，不提交、不创建分支。

Verification Contract：current owner为共享App Server plugin_catalog和core配置。输入为本地市场目录或
Git来源及ref/sparsePaths；结果为配置驱动的同一catalog与Codex响应。重复添加同一来源幂等；同名不同来源
拒绝；本地源不复制/删除；Git快照在暂存区验证后提交，配置/提交失败恢复原状态；upgrade逐市场返回错误，
进行中配置变化不能被覆盖；remove不删除已安装插件cache。先定向owner与公共JSON-RPC测试，再生成器、
contracts/types、真实CLI/stdio及受影响GUI门禁。尚未验证的远端/配置层级/平台语义保持明确缺口。

架构影响：major；复用现有主链，目标图由root于2026-10-17确认。三个方法不能因DTO同名或local测试通过
标为完整Codex等价，Git、失败回滚、并发修改与用户可见消费分别验收。

当前静态与协议结果：正式 Rust schema/TS 生成器、SDK build、仓库 typecheck、完整
`test:contracts` 和受影响 TS lint 均 exit0；前端四文件328/328通过，新增私有目录扫描回流
断言另行定向复跑通过。CLI 插件解析4/4、市场解析1/1通过。

Rust owner 首次因模块注释前插入 import 的 E0753 编译失败，已纠正 import 位置；重试
`--lib --test marketplace_jsonrpc marketplace` exit0，owner/filter14/14、公共 JSON-RPC3/3。
三项公共测试覆盖本地引用/幂等/config/read/list/remove、真实 HTTP Git clone/ref/sparse/升级/安装/
失败保留、两个市场前一失败后继续升级后一。另行公共 Apps/Config/MCP/Search 回归8/8通过。
这些管理测试使用显式 MockBackend，不证明模型 Turn。schema fixture1/1、`--locked`三入口
product build通过；新固定目录 `/tmp/lime-marketplace-artifacts-jZTQjW` 含9项摘要，
App Server `d5c704b7d586d69e0ce0f176012ef07c6083147beaef6b1717905253e4f7846e`，
CLI `2897d3df0f943d450c410e90b0bb546dd4ccf211899c56761897eeddbfcb4ac5`。
同产物Skills通过8个真实runtime Turn、两个SDK连接和一次冷启，CLI surface验证市场
add/list/upgrade/remove以及插件完整管理链通过。literal `npm run verify:gui-smoke`、Apps Electron
和完整插件Electron均exit0。标准GUI入口会忽略APP_SERVER_BIN重新准备资源，实际smoke仍显式
使用本轮固定产物；固定目录9项摘要最终复核未变，不用共享target中的新文件核销固定目录。

证据为 `.lime/qc/plugin-reconstruction/marketplace-{artifacts,rust-validation,product-validation,
final-verification}.json`、`marketplace-skills-stdio.json`、`marketplace-gui-smoke/summary.json`、
`marketplace-apps-electron/apps-catalog-gate-b-summary.json` 与
`marketplace-package-electron/plugin-package-electron-gate-b-summary.json`。完整插件场景经两次
真实Electron主进程、preload/IPC、`app_server_handle_json_lines`与runtime，安装/启停、完整mention、
Skill context、MCP表单、canonical Thread/Turn/Item、原生面板、reload/冷启和卸载后历史均通过。
卸载后Provider/tool不重执行、MCP不重启；console errors、missing methods、legacy MCP命令与
mock fallback均为0。已检查冷启与卸载历史截图；原生子视图的窗口归属、visible与非零bounds由
raw证据证明，摘录为`marketplace-package-electron/native-view-verification.json`，不以主renderer
截图中的原生子视图留白替代内容断言。

Apps场景backendMode=unavailable且callable=false，只证明本地catalog/通知与pending/disabled，
不证明hosted授权可调用；runtime Turn使用本地Provider夹具，不是live。CLI只证明管理路径，
本轮无新的exec/PTY、Windows或packaged证据，也未跑全仓`verify:local`。

保留差异：配置锁目前为进程内共享锁，managed policy、完整配置层级与跨进程一致性未补齐；
绝对路径继续使用既有 PathBuf 加入口校验，未证明上游 AbsolutePathBuf 的全部跨平台归一化。
内部快照 sidecar 为 `.marketplace-install.json`，不是独立 registry；未对齐上游内部文件名。
缺失的配置来源目前显式返回 marketplaceLoadErrors，上游 installed roots 的静默过滤语义与
损坏配置隔离仍须在配置层级切片核对。上游 `marketplace_processor.rs` 在确有升级roots后清理
plugin/Skills cache、invalidate MCP并刷新Hooks；本地升级后的配置插件cache刷新与Skills/MCP失效
已由上述新产物切片验收，Hooks仍须随组件owner补接线和回归，不能记为runtime全面等价。Desktop 市场管理页面与
全部远端插件物化继续 pending。

LimeCore追加窄修复：原本干净的 `70-schemas-service-skills.yaml` 中插件SourceKind枚举与
InstallationPolicy定义粘连，实际解析产生两处DUPLICATE_KEY。已直接分离定义并由正式生成器
更新bundle；插件分片解析/enum断言和`make verify-contracts`通过，没有改HTTP字段或路由。
完整bundle解析仍被未认领的tenant-internal App Server audits重复GET阻塞，保留
`/tmp/limecore-marketplace-openapi-parse.json`，不宣称全量OpenAPI有效。远端合同替换和
解析/引用门禁继续归P04；其它签名发布schemaVersion为current，不能关键词误删。

## P03 四组本地合同直接替换（已验收）

认领写集：v2/plugin 协议、schema registry/envelopes/正式生成物；v0 Skills detail metadata、自动化任务类型的重名消除及直接消费者；App Server plugin_catalog、PluginDataSource/runtime/dispatch 与对应公共测试；CLI plugin command；两层 TS client、plugin gateway、PluginCatalogPage/VM/detail/apps、sidebar 与 workspace mention 直接消费者；这些入口的现有测试和真实 stdio/Electron 插件夹具。收尾只更新本计划、architecture.md 的插件段和本地证据账本；LimeCore 只同步对应执行计划。其他 settings、release、未知未跟踪 JS、tsbuildinfo 和 REA 研究写集继续避让；Codex 只读。远端市场控制面在 P04 继续。

目标：list/installed 返回 Codex marketplaces/errors，read/install 使用市场定位加 pluginName，安装返回 authPolicy/appsNeedingAuth；删除全部 PluginCatalog DTO、sourcePath/expectedDigest wire、目录直装 GUI/CLI 入口、旧 sourceUri/count 字段消费者与过期正向夹具。列表保留 workspace cwd 边界、逐市场错误、同名市场身份，安装失败保持原状态。不得用旧形状 adapter 或伪造计数维持 UI。

退出条件：正式 schema/TS 生成器无冲突；Rust owner/public JSON-RPC、CLI/GUI 消费者、types/contracts/retired guard通过；新固定产物 stdio/CLI、runtime Skills 与 Electron 安装到 Turn/冷启/卸载闭环通过。未接入远端能力明确失败，不伪造远端 readiness；P03/P04 整体保持 active。

当前结果：上述本地四组合同切换已满足退出条件；正式生成、定向测试、完整 contracts、真实 Skills/CLI、literal `verify:gui-smoke`、Apps 与插件 Electron 均通过。旧安装 DTO、目录直装与旧 summary 字段已删除，无迁移或兼容层。完整 P03 仍欠市场管理、reconcile/share、远端与嵌套语义，详见方法表及本计划末尾的本批证据，不将本地验收提升为整体完成。

用户裁决：插件直接按 Codex current 重构，删除 Lime 原有插件机制；开发期间不迁移、不考虑旧格式兼容。此裁决覆盖共享后端计划 S09-E/G 和旧 Plugin v3 路线中冲突的目标。已完成的 workspace 导入迁移属于另一切片，不作为插件迁移要求。

## 事实源和目标

- Codex CLI 源码：`/Users/coso/Documents/dev/rust/codex`，当前已核 HEAD `4eb4a65407d98cebc4c83bf13be440b9fbc78a7c`。
- 桌面安装包：`/Applications/ChatGPT.app`，bundle ID `com.openai.codex`，版本 `26.1007.30912` / build `20156`；资源为 `Contents/Resources/app.asar`，内置 CLI 为 `0.162.0-alpha.17.2`。安装包构建提交与源码 HEAD 的对应关系未知，逐条保留证据差异。
- LimeCore：`/Users/coso/Documents/dev/ai/limecloud/limecore`；云端控制面、包发布与租户 transport 同步修改。
- 源码决定公开协议和 runtime；REA 决定指定桌面安装包的可确认行为与结构。静态证据不提升为运行证据，未观察的远端私有实现不编造。

Codex current 同时加载标准根 `plugin.json` 与 `.codex-plugin/plugin.json` 等被其 loader 支持的生态格式；标准格式不是 Lime 私有格式，不能误删。需要删除的是 Lime 自建 v3 包仓库、以裸名称为 ID 的安装状态、`sourcePath` 安装合同、固定目录假设及其消费者。

## 唯一主链

```text
CLI / TUI / Electron GUI
  -> App Server JSON-RPC
  -> plugin catalog / store / config
  -> immutable plugin component snapshot
  -> Skills / MCP / Hooks current owners
  -> RuntimeCore -> canonical Thread / Turn / Item

LimeCore control plane -> marketplace / bundle / policies
LimeCore gateway -> tenant-owned Rust App Server transport
```

Go 服务不复制 Agent loop。客户端不重建云端 marketplace 事实；两仓使用相同 plugin identity、manifest 和包合同。

## 逐步实施与删除账本

| 切片 | 内容 | 退出条件 | 状态 |
| --- | --- | --- | --- |
| P00 | REA 安装包证据、两仓调用链和合同盘点 | 包摘要、Evidence ID、current owner/消费者/删除清单入库 | in-progress |
| P01 | manifest、组件资源和 namespace | 支持 Codex current 格式/优先级、声明 roots 与 MCP、同名/路径选择；删除独立猜路径 | in-progress / Hooks、Apps 等仍待补齐 |
| P02 | PluginId、store、配置 | `name@marketplace`、Codex cache/version/enablement 语义；删除 v3 installed records 和旧写入；不读取旧状态、不转换旧数据 | in-progress / cache/配置、本地启停与远端tar.gz安全物化、账号来源及GUI/stdio冷启卸载已验；GLOBAL元数据和server安装authority仍pending |
| P03 | App Server/CLI/TUI/GUI 协议 | Codex 形状 list/read/install/uninstall/installed/marketplace/config；同步 schema/client/gateway/catalog/fixture；删除旧 DTO/API | in-progress / 自建启停 method、旧 DTO/目录安装已删；五组本地合同正式生成与新产物 Skills/CLI/Electron 通过，完整方法组及嵌套语义仍 pending |
| P04 | LimeCore 包发布与市场 | 包扫描、摘要、发布、HTTP 合同、SDK/类型/后台同步；删除旧 `lime.plugin.package.v1` 及旧 manifest 校验 | in-progress / release组件、受控tar.gz上传扫描交付、目录HTTP/SDK已验；server安装状态/共享与外部平台内容验证仍pending |
| P05 | 清理和真实产品闭环 | 旧源码/规则/测试/文档入口零生产引用；新标准包在两仓发布到安装到真实 Turn，CLI/PTY/Electron 分别验收 | in-progress / 登记清理42/42、本地Turn及受控远端安装的GUI/stdio闭环通过；实际两仓发布到Turn、exec/PTY、Windows/live/packaged仍pending |

首个云端缺口已修复：原 upload scanner 只查找根 `plugin.json`、依赖旧 `schemaVersion` 且缺字段检查失效；现已按 Codex 选择 manifest、删除旧校验并替换正向夹具，scanner red-green、定向 Go 与 contracts 通过。后续仍需完成市场/下载/授权到客户端 Turn，扫描成功不核销该闭环。

## 写集与验证合同

Lime：既有 App Server plugin 领域、Skills/MCP 直接消费者与测试、协议生成物/CLI/TUI/GUI 对应 gateway 与场景；架构/命令/插件路线及本计划。Codex 只读，避让 settings、release 和其他进程的 Desktop REA 研究写集。

LimeCore 首刀：`control_plane_plugin_package_upload_service.go` 的扫描/manifest 职责迁出、同目录专用测试和旧正向包夹具，以及两仓执行计划。后续协议切片再认领 OpenAPI source fragments、SDK/类型、后台消费者，不手改 bundle。

输入为同一 Codex 插件包；云端实际扫描选中正确 manifest，客户端从公共 App Server 安装后，两个连接 catalog/通知、模型当前请求和 canonical Item 使用同一身份。失败必须保留原状态且可定位，不 fallback 旧包、旧 registry 或 mock。

验证先 owner integration / Go public service，再 contracts 与受影响 Rust/TS；实际同一固定产物依次通过 stdio、CLI Gate B、真实 PTY、Electron current/GUI 和新插件专项。旧 S09-E 的标准包验证仅保留为替换前基线，不核销新合同。跨平台/live/私有远端未实跑保持未验证。无 commit、push、部署或真实用户目录清空。

架构影响：major。目标主链确认：root，2026-10-17；当前实现尚未切完，不能标完成。

## 2026-10-17 首刀执行记录

- LimeCore：已移除 upload service 中的旧 scanner/`schemaVersion` 校验；新增同域 scanner/manifest owner。原生与标准 manifest 按 Codex loader 优先级选择，unsupported 标准版本不 fallback；12 处正向 fixture 已替换，旧格式仅保留负向测试。ZIP 增加重复路径拒绝、展开预算溢出检查。实际 scanner red 已保留 `/tmp/limecore-codex-plugin-scan-red.log`；定向 service/controller green 已通过。
- Lime：已删除 `plugin_catalog/inventory.rs` 及其 v3 records 读写，改由 typed PluginStore 从 cache 枚举安装、共享配置记录 `name@marketplace` 启停；同版本原子替换。manifest/Skills/MCP 及所有本地 datasource 消费者正在验证。公共协议尚未切换，不标 P02/P03 完成。
- REA：整包默认策略报 unpacked permissions.node 摘要矛盾；record-and-continue 调用在300秒 MCP deadline超时。同连接 evidence ledger 未留下记录。该调用无可引用 Evidence ID，不能声称已分析整包；转包内插件模块定向静态证据。
- 前轮结果：S09-F 固定产物 stdio、CLI Gate B、current fixture、GUI smoke 均通过；S09-E 整库1923通过、2个timeout失败，product build因共享 target 中间产物消失失败。保留原日志，这些结果不核销新插件合同。

## 旧插件清理继续记录

- 已删除 `internal/roadmap/plugin/v3/` 全部 7 份文件；导航、Writing/Soul/Agent roadmap、FEATURE-MAP、commands 和架构改指向 `codex-contract.md`。原执行计划只保留历史状态，不再约束实现。文档守卫改为禁止旧路线恢复。
- 已删除 `plugin/enabled/set` 的 Rust DTO、method/dispatch、datasource/runtime handler、schema 注册、两层 client method 与 catalog 正向声明。GUI gateway `setPluginEnabled` 和 CLI 改走 `config/batchWrite`；旧 method 仅允许负向测试/回流守卫。其余 `sourcePath` 与旧 catalog DTO 仍待下一刀直接替换。
- 插件安装、Skills 配置与 App Server config 读改写统一使用 core 配置锁；config 从 RuntimeCore 注入的路径读取，LocalAppDataSource 提供同路径注入。插件配置成功修改后失效 MCP、刷新 Skills watch 并广播 Apps/Skills；失败不广播。
- 原生 manifest 缺省名称通过显式安装身份贯穿 staging、cache、read 与快照，不把版本目录名当作插件名称，不修改源包。真实 Skills metadata 保留完整 package identity，插件名字不能由裸 Skill leaf 误选；选择测试拆到独立模块，避免继续堆叠千行文件。
- REA 五模块成功证据与限制见 [桌面静态证据](./codex-plugin-desktop-evidence.md)。不把整包失败或局部静态结果当作运行证据。
- 首轮 owner 测试 28/28 通过；补原生缺省名称后 29/29 通过（`/tmp/lime-codex-plugin-owner-final.log`）。这两轮在启停 method 删除前执行，后续 Rust/contract/consumer 验证单独记录。首次 consumer 291 项中 290 通过、1 项失败为 rustfmt 换行导致的 storage guard 字符串断言，已改为不依赖换行的边界断言并定向重跑。

架构图确认：root，2026-10-17；`architecture.md` §7.2 已同步实际 owner、两仓主链与明确未完成协议。整体目标仍 active，不以本切片完成度代替全面对齐。

## 本轮验证修复写集（2026-10-17）

- 继续认领 plugin_catalog/install.rs、tests.rs、local_data_source.rs 配置注入签名，以及 Electron 插件专项、Apps catalog fixture 和对应测试；Codex 只读，避让 settings/release/他人 REA 研究文件。
- Electron 专项原先仍按裸插件名、`plugin__...` MCP 名称与裸 Skill 名称验收。已迁为完整 `name@marketplace`、raw MCP server ID、`plugin:skill`；从超长主 runner 提取 `scripts/electron/lib/plugin-package-fixture.mjs` 管理包构建与生命周期交互。主 runner 剩余跨场景编排仍超过 1000 行，本轮仅减量/接线修正，不在其中增加业务分支；退出条件为 P05 前将其 provider、history、elicitation 观察拆回既有领域 helper。
- 配置失败的卸载改为先暂存 cache，配置清理失败恢复原 cache。补同名不同市场卸载仅删除对应配置、保留另一市场与持久 data，以及安装/卸载失败保持原 cache 的回归。底层 ConfigManager 仍直接 fs::write，写盘中断时的完整配置原子性尚未证明，继续作为 P02 缺口。
- Skills 选择定向测试 17/17、前端 typecheck 通过；Electron 夹具静态/生命周期守卫 9/9。Rust 首轮发现配置路径注入 `PathBuf` 未导入，已改显式类型并重跑，未以旧 29/29 核销。
- 全仓 diff --check 遇到他人 REA 研究文件末尾空行，保持避让；本写集另行校验。尚未执行的真实产品门禁不能记为通过。

- P02 原子配置写入追加：认领原本干净的 core/config/yaml.rs 持久化调用点，写入职责迁入同域 persistence.rs，ConfigManager/YamlService 四处直接写入统一委托；不在千行 yaml.rs 继续添加业务逻辑。同目录临时文件写全并 sync 后 persist，保留现有符号链接目标和文件权限；有旧配置时提交失败不截断旧文件。新增替换/失败清理/符号链接权限回归。上段 fs::write 缺口已有代码修复，最新 Rust 验证完成前不核销。

## P03 公开合同替换清单

按上游 `app-server-protocol/src/protocol/common.rs` 当前 16 个插件/市场 method 核查，不能只对齐现有 6 个同名 method。以下是退出条件，不代表已实现：

| Method | 当前状态 | 必须完成的替换 |
| --- | --- | --- |
| marketplace/add | 本地/Git owner、公共 JSON-RPC 与新产物CLI通过；完整语义partial | source/refName/sparsePaths，安装 root 与 alreadyAdded；CLI 与 typed GUI gateway 共用 owner，Desktop 管理入口待补 |
| marketplace/remove | owner、公共 JSON-RPC 与新产物CLI通过；完整配置语义partial | marketplaceName，删除配置与受管快照；保留本地源、已安装插件 cache 和持久数据 |
| marketplace/upgrade | 真实 Git公共JSON-RPC、新产物CLI/runtime与插件Electron通过；完整语义partial | 配置插件cache刷新与Skills/MCP失效已验；Hooks、managed policy/config layers仍待补 |
| plugin/list | 已直接替换；公共合同及新产物本地产品验证通过 | cwds/marketplaceKinds/forceRefetch；marketplaces/errors/featured IDs；旧 query/source/marketplacePaths wire 已删 |
| plugin/search | 部分 | 保留 Codex wire，市场定位、scope、分页与完整 identity；不以进程 cwd 猜测调用方 workspace |
| plugin/installed | 已直接替换；公共合同及新产物本地产品验证通过 | cwds/installSuggestionPluginNames；市场分组与 load errors |
| plugin/reconcile | P04b10共享owner与受控Desktop/stdio已验；完整Core/Turn待验 | bundle/enablement/removal diff、失败远端 ID 与 materialization 分类；不伪造 readiness |
| plugin/read | 外层合同及新产物本地验证通过；嵌套语义仍 partial | marketplacePath/remoteMarketplaceName + pluginName；Codex PluginDetail、Skill/App/Hook summaries |
| plugin/skill/read | P04b13a Core本地已验；P04b13b客户端公共JSON-RPC/受控Electron与stdio已验 | 远端插件 Skill 读取与同一包/授权边界；完整缓存/参考文件另验 |
| plugin/share/save | P04b12b/c本地合同、P04b12d1受控Electron创建/同ID更新已验 | pluginPath、远端身份、discoverability 与 targets；shareUrl |
| plugin/share/updateTargets | P04b12a/c本地合同、P04b12d1受控Electron权限草稿/服务端投影已验 | principals/discoverability，权限与租户过滤 |
| plugin/share/list | P04b12c本地分页/冷映射、P04b12d1受控Electron目录消费已验 | 远端插件与可用本地 checkout 路径 |
| plugin/share/checkout | P04b12d/d1本地及受控Electron点击/stdio可见与冷复用已验 | materialized identity/root、市场定位与远端版本 |
| plugin/share/delete | P04b12b/c本地合同、P04b12d1受控Electron确认撤销已验；实际Core产品流待验 | 空 response、远端权限与失败不破坏本地状态 |
| plugin/install | 已直接替换；公共合同及新产物本地产品验证通过 | 按市场定位 + pluginName，installAttemptId；authPolicy/appsNeedingAuth；旧 sourcePath/expectedDigest wire 已删 |
| plugin/uninstall | 本地 Codex DTO 已替换，公共协议/CLI/Electron 通过 | 完整 pluginId、空 response；旧 bool 与 Catalog 卸载命名已删，远端 ID 语义仍待 P04 |

依赖顺序：先 list/installed/read/install/uninstall 与生成类型、CLI、GUI、mention、真实 fixture 同批切换；再补市场管理和远端能力，LimeCore 发布/下载/授权同批消费。旧类型一经替换即删除，不增加 alias 或 adapter 保留旧调用。`SkillSummary` 现有 v0 与目标 v2 的 schema 名冲突必须在 exporter/消费者中明确消除，不能用不带 schema 的未知对象绕开类型检查。

CLI surface fixture 已清理裸 ID，支持统一 `LIME_CLI_BIN` 固定产物。search 公共回归按显式 workspace market 查询并验证无 marketplace 的 workspace 不泄露其他已安装项；配置路径显式注入 temp，两仓真实用户配置不参与该测试。旧安装 DTO 已在本批删除，本地新产物验证通过；完整 P03 继续按上表验收。

## 用户再次裁决后的旧链路删除（2026-10-17）

用户再次明确“原有插件清理删除”。继续按已授权删除处理，不迁移、不兼容、不清空真实用户插件目录。

- 认领：`core/src/plugin_runtime_token.rs` 及唯一生产验签调用 `server/src/handlers/api.rs`、core manifest/锁文件；`desktop-host/core.ts` 的空 mock 导入及三份 pluginMocks 文件；旧 `scripts/plugin/` 三个入口、六个 Connector helper/test；package scripts、脚本冻结基线、直接文档和既有插件回流守卫。
- 旧 UI runtime 已删除，没有生产签发者；其自建 `lime-plugin:v1` token 仍让模型生成端点绕开统一静态 API key。删除签发/验签模块与模型生成专用认证，所有代理端点继续使用既有统一认证；保留旧签名 token 被拒绝的负向回归，不保留旧生成器。
- 空插件 mock 的导入、声明和仅断言空对象的旧测试直接删除；不为已删除机制保留空模块。回流约束迁到既有 `pluginFixtureBoundary`，同时检查目录、入口、调用链。
- Connector preflight/delivery/webhook 只服务旧 Plugin v3 Host/CI 交付证明，没有 Codex 插件 current consumer，删除全部九份源码/测试及 npm 入口；撤销 `scripts/plugin` 允许目录，后续市场/授权能力只能在 current App Server/LimeCore owner 建立。
- 超长 `server/handlers/api.rs` 本轮只删除业务分支、替换两处认证调用并将原 auth tests 拆出，不向其增加业务逻辑。其余 provider 职责拆分不在本切片内。
- 本轮已收取：公开 Apps/Config/MCP JSON-RPC 5/5，core/App Server/MCP 配置147/147，插件生命周期/App Server/Core/MCP43/43。search、新产物、token删除回归与真实产品门禁仍待本轮后续结果。

架构图确认：root，2026-10-17。旧独立授权与交付链不进入目标图，唯一主链保持本计划所列 current owners；P00–P05 总体仍 active。

- 文档补充写集：旧 `docs/content/08.open-platform/3.plugin-development.md` 的 script/binary/native、独立 UI、文件/URL 安装承诺直接替换为 Codex 包合同和真实开发状态；CLI README 撤销“远程市场不属于目标”的旧裁决；App Server frontend matrix 删除旧 Plugin UI/task/installed facade 正向行，P3 旧证据明确标历史。
- 最新结果：search 公共 JSON-RPC 1/1、统一认证3/3、Desktop Host21/21、插件回流守卫2/2、四份 fixture guard11/11、typecheck/contracts/docs/version/scripts/legacy report 均通过。误用 Node test runner 启动 Vitest 夹具造成 harness 错误，随后使用正确 Vitest 命令11/11通过；不记为产品失败或跳过验证。
- 固定产物准备期间主动停止了本进程提前启动、未指定固定产物的 GUI smoke，exit143，不记通过；只清理其 PID75055 留下、已确认 owner 不存活的 renderer lock。没有停止其他进程、清理共享 Cargo target 或删除真实用户数据。renderer build 与更新后的 Rust product build 重新执行。
- 清理分类：本轮13份旧文件与5个core直接依赖为 `dead / deleted / forbidden-to-restore`；当前 App Server store/共享 config/Skills/MCP 为 `current`；不新增 `compat` 或 `deprecated`。本轮删除清单13/13（100%）仅指此窄写集，公开旧DTO/sourcePath与市场/授权仍未完成，不能据此给整体对齐100%。

## 固定产物产品验证（2026-10-17）

计划与 REA 证据文档原被 `internal/exec-plans/*` 忽略；已只为本计划和 `codex-plugin-desktop-evidence.md` 增加两个精确例外，保留 `.gitignore` 其他并行修改，确保两份文档进入可审阅写集。

本轮 `--locked` 构建的 App Server、CLI、code-mode-host 和动态库复制到
`/tmp/lime-plugin-cleanup-artifacts-mxkwCn`，先补 macOS rpath 再计算摘要。记录位于
`.lime/qc/plugin-reconstruction/cleanup-artifacts.json`。App Server SHA-256 为
`e5302149872081c631473d4629a38f343a882ba60d03cc5aa4b0456b2abd7267`；CLI 为
`6182c755847e599a34669cf6d6132cc21de85d0f46c854086c23b122e938b0f0`。
后续共享 target 的测试编译不改变该固定产物。

| 边界 | 实际结果 | 范围与限制 |
| --- | --- | --- |
| `skills-roots-fixture.mjs --plugins` | 通过，8个真实Turn、1次冷重启、两个SDK连接 | 真实 RuntimeCore + 本地 Provider 请求捕获；安装/编辑/启停/冷启/卸载，非 live、非 GUI/PTY |
| `cli-surface-gate-b.mjs` | 通过 | 插件 add/list/read/search/enable/disable/remove 经真实 stdio；仍是 P03 待替换的安装 DTO，不核销最终协议 |
| `cli-gate-b.mjs` | 通过 | 真实 exec、JSONL、恢复/fork/review、stdin/image/outputSchema、失败/中断与冷读；human TTY 分支因外层 stdin 非 TTY 明确未跑，不能冒充 PTY |
| `scripts/electron/smoke.mjs` | 通过 | 真实 Electron/preload/IPC、App Server initialize、工作台/重载/三视口/memory shell；分步 renderer/host/assets 构建与固定产物运行，不把被停止的 `verify:gui-smoke` 记为 exit0 |
| Apps catalog Electron | 通过 | `cleanup-apps-catalog-retry/apps-catalog-gate-b-summary.json`；7 methods、安装通知/停用后 fresh read、错误/mock/legacy 命中为零；非 hosted readiness/live |
| 插件 Electron package | 续跑中 | 已修两处 helper 导入遗漏、侧栏重复定位与 GUI mention 重复市场名；旧脚本强等隐藏的单面板 tab 导致冷启超时，已按实际 active surface 修正；完整新产物闭环待收取 |
| TUI skills PTY | 通过 | 固定 cleanup 产物、真实 PTY/alternate screen/键盘/Skills mention/focus/resize/tmux/reconnect/终端恢复；此结果早于 P03 卸载 DTO 替换，不核销新卸载协议 |

首轮 Skills 产品夹具使用旧 `$selected-watch-proof` 裸名称导致 provider capture 正确拒绝，Turn failed；已让共享 turn helper 接收显式 Skill 名称，插件场景使用 `$watch-plugin:selected-watch-proof`，重跑上述8个Turn通过。没有给 production 加裸名 fallback。共享 fixture 已796行，后续新增场景先继续向既有 scenario helper 拆分，不再向主 runner 堆叠。

最新 `npm run test:contracts` exit0（含 docs/scripts/release/CLI guards），Desktop Host21/21、插件回流2/2、fixture guards11/11、认证3/3、typecheck、版本和治理检查通过。本写集 diff --check 通过；不修改其他进程 REA 文档的 EOF 问题。

默认本地门禁 `verify:local` 未完整运行：smart planner覆盖当前319个脏文件，会触发并行 settings/release 等全部前端、Rust、i18n与Bridge任务，入口没有path过滤；本轮采用上述认领边界的定向验证与真实产品门禁。规划证据在 `.lime/qc/plugin-reconstruction/cleanup-local-verification-scope.json`。不将空 staged 集合或分步门禁写成全仓 green。Windows、live Provider、远端市场授权和两仓发布到真实 Turn 的完整链路仍未验证。

## 清理续刀：身份与卸载合同（2026-10-17）

- 真实 Electron package 暴露 GUI suggestion 将完整 ID 二次拼接为 `name@marketplace@marketplace`；修正为直接使用 App Server identity，更新 suggestion/hook 夹具并覆盖同名不同市场。五文件 no-undef 检查发现第二处拆分 helper 漏导出/导入，已补齐；后续以真实 Electron 重跑结果核销。
- `agent-runtime-projection/pluginCapabilityRuntime` 仅由根 re-export 与自身测试消费，无生产调用；删除源文件、正向测试和导出，由既有 retired guard 防回流，不为未使用的独立 capability catalog 续命。
- P03 先完成可独立闭环的 `plugin/uninstall`：按 Codex `PluginUninstallParams` / 空 `PluginUninstallResponse` 替换旧 DTO、Rust dispatch/runtime/datasource、CLI、两层 TS client/gateway 与 GUI 消费；删除 `uninstalled` bool 分支和旧 Catalog 命名，不保留 alias。list/read/install/installed 仍作为下一组合同替换，不能以卸载单方法完成核销整组。
- 写集只包含上述 plugin 直接消费者、schema 生成物、公共 JSON-RPC 回归与本计划/架构记录；Codex 只读，避让 settings、release 和其他 REA 研究写集。退出条件：公共卸载返回严格 `{}`、重复卸载与失败恢复保持正确、CLI/GUI 不依赖已删除字段、contracts/定向测试及受影响真实场景通过。

架构图确认：root，2026-10-17；唯一 App Server owner 不变，不新增迁移或兼容链。当前产品验证运行中，整体目标仍 active。

- 已收取：projection package 288/288；本轮 GUI/gateway/identity/fixture/retired guard 18/18；六个执行 fixture 的 ESLint no-undef 为零，冷启 fixture guard 3/3。卸载 schema 已由 Rust 正式生成器重建，旧两个 schema 文件已删除，新 `PluginUninstall*` 进入生成 TS；client build、typecheck 与完整 `test:contracts` 均 exit0。
- 公共 JSON-RPC 最新 `apps_jsonrpc` 2/2 通过（`/tmp/lime-plugin-uninstall-jsonrpc.log`）：严格空卸载响应、重复卸载、Apps 通知、其他插件保留、裸 ID 拒绝与原状态保持。测试 backend 仅承接未调用的 Turn 执行，真实 local datasource/store/config 经公共请求进入；不将此记为 CLI/Electron Gate B。最终产品产物与真实场景仍待收取。
- 新 renderer、Electron main/preload/desktop assets 已构建；最终 Rust product build 正在执行。原 cleanup 固定产物七项摘要再次核对无变动，新卸载合同产物另存，不覆盖旧证据。
- 本轮与前轮列明的 17 个旧源码/脚本/正向测试/云端文档路径已逐一检查全部不存在；清单在 `.lime/qc/plugin-reconstruction/cleanup-deleted-surfaces.json`，删除完成度17/17（100%），分母仅为该清单。
- LimeCore 删除旧实施计划与旧跨仓 E2E 文档两份，路线图收回当前 Codex 合同，官网链接与直接导航同步。保留 current 云端发布/租户/审计 owner；其余市场授权重构仍 pending。云端治理零违规、五个新路线图链接均存在、链接模块独立类型检查通过；官网全量 typecheck 因未安装 `next`（exit127）未运行成功，不安装无关依赖或伪称全站 green。
- 删除分类新增两份 projection 源码/正向测试与两份云端旧文档，均为 `dead / deleted / forbidden-to-restore`。本清理续刀不新增 compat/deprecated；公开 list/read/install/installed 旧 DTO 仍清楚列为待替换，不能宣称原插件协议已全部清完。
- 直接证据消费者补充写集：clawstream `scenario-registry.json`、`scenario-ledger.md` 与现有 registry 计数测试。撤销已删除独立 projection 的覆盖声明，插件场景从 `partial+guard` 回到 `partial`，仅记录 current owner 实际证据和未完成项；不修改其他场景状态。
- 证据消费者 registry 回归6/6通过（`/tmp/lime-plugin-cleanup-scenario-registry.log`），本补丁 diff --check 通过。新 `--locked` Rust 联合 product build exit0（29分55秒）；卸载合同固定产物为 `/tmp/lime-plugin-uninstall-artifacts-ttvTLg`，App Server SHA-256 `d7937d9437ce5a09146501b31bb3a8f160178475cae518176c4c128e36e12a28`，CLI SHA-256 `3cdd746642ce480e8505b7a7ede0ed89fccbdc1efb1a268fc8138f2c29af2285`。独立记录于 `.lime/qc/plugin-reconstruction/uninstall-artifacts.json`，不覆盖 cleanup 产物；真实 CLI/Electron 场景正在核验。

## 新卸载合同产品验收（2026-10-17）

上述 uninstall 固定产物已通过真实 `cli-surface-gate-b.mjs`（`/tmp/lime-plugin-uninstall-cli-surface.log`）：插件安装、列表、读取、搜索、配置启停和卸载均经 stdio App Server；`remove --json` 为严格 `{}`，重复 remove 的 human 输出保留完整 ID。此处证明插件 CLI 管理路径，不替代 exec/PTY 或远端市场验收。

`plugin-package-electron-gate-b.mjs` exit0，证据为 `.lime/qc/plugin-reconstruction/uninstall-electron-package/plugin-package-electron-gate-b-summary.json`。真实 runtime backend、本地 Provider fixture、两个独立 Electron 主进程、preload/IPC 与 `app_server_handle_json_lines` 均已核验：

- GUI 安装、启停、停用后新线程不可选择且 Provider 不含工具、重新启用后新边界恢复。
- 正确完整 mention `plugin://mcp-elicitation-plugin@local`，真实 Skill context、MCP 表单提交、canonical Thread/Turn/Item 与 MCP App surface identity 一致。
- 页面重载和冷启动后恢复历史与面板。单面板使用已恢复的 active surface（`coldRestoreSurfaceOpenMode=restored`），不强求不存在的多面板 tab；资源读取与 HTML load 一一对应、MCP 进程确实重启、Provider 和 tool 均不重执行。
- GUI 卸载清空 installed projection；历史仍可读，面板明确显示已卸载，MCP runtime/Provider/tool 均不重启或重执行。控制台 errors、missing methods、legacy MCP commands 和 production mock fallback 均为零。

已检查冷启与卸载后截图。截图取自主 renderer，独立 WebContentsView 内容由真实 webContents title/DOM marker 和 IPC resource/HTML trace 证明；不以主 renderer 截图中的原生子视图区域替代内容断言。当前停留证据为对话工作台及卸载历史面板，隔离测试进程已回收；没有接管用户浏览器会话。

同一产物 `scripts/electron/smoke.mjs` exit0（`/tmp/lime-plugin-uninstall-gui-smoke.log`），真实壳、App Server initialize、工作台/重载、三视口和 memory shell 通过；摘要为 `.lime/qc/project-gates/standalone-shell-01-20261017031933-29452/shell-01-electron-smoke/summary.json`。renderer/host/assets 已分步构建，因此不把该结果写成 literal `verify:gui-smoke` 命令 exit0。

本切片产品闭环已完成。7项固定产物摘要再次核对全部未变、17个删除路径全部不存在，记录于 `.lime/qc/plugin-reconstruction/uninstall-artifacts-final-verification.json`；两仓本写集 diff --check 和客户端文档边界检查通过。App Server owner 与 CLI 单测最终分别30/30、3/3通过；完整插件重构仍 active，下一刀统一替换 list/read/install/installed 四组旧 DTO、sourcePath/expectedDigest wire 及所有直接消费者，再推进 marketplace/share 与 LimeCore 同一包的发布到安装到真实 Turn。P03 和 P05 不因本地 uninstall 通过而整体完成。

原生面板证据追加写集：此前干净的 `scripts/electron/plugin-mcp-app-gate-b.mjs`。主 renderer 截图不包含原生子视图，因此在现有 webContents marker 观察中补窗口 contentView 归属、原生 getVisible 与非零 bounds 断言，避免只证明后台 HTML 加载。没有生产改动；使用同一固定产物在独立 evidence 目录重跑完整 Electron 插件场景，保留上轮通过证据。

- 加强后首轮原生视图初次加载和 reload 均通过，真实 native bounds 为 `{x:1004,y:104,width:424,height:884}`、visible=true 且归属于窗口。完整场景 exit1 停在旧“全程恰好两个 MCP PID”断言；失败 evidence 保留于 `uninstall-electron-native-view`。失败 ledger 明确为初次 tool/资源 PID59008、reload 资源 PID59770、冷启资源 PID60667，三个连接都声明相同 elicitation capability，没有第二次 tool call。该固定总数不能证明冷启边界，改为比较冷启前后 PID：必须恰好新增一个进程、冷启资源全部由新 PID 读取，Provider/tool 总数仍保持不变。将 cold ledger/native view/process boundary 在断言前保存，避免失败后丢失阶段证据；复跑另存目录。
- App Server owner `--lib plugin` 已收取 exit0，30/30（`/tmp/lime-plugin-uninstall-owner-tests.log`）；原生视图 fixture guard3/3、声明浏览器回调 globals 的 no-undef 检查零错误。首个 lint 命令漏声明 window/document/setTimeout 导致22条 harness 报错，修正命令后通过，不修改生产全局或加入源码忽略。
- 加强后的完整 Electron 插件复跑 exit0，最终 evidence 目录 `uninstall-electron-native-view-final`。初次打开/reload/冷启三个阶段均证明真实 WebContentsView 挂到窗口、visible=true、bounds为424×884且具有实际内容 marker；冷启前PID72570、冷启后新增PID74082，只有新进程读取冷启资源，卸载后不再新增进程或重执行 Provider/tool。控制台错误和 mock fallback 为零，机器可读摘录为同目录 `native-view-verification.json`。失败证据仍保留，不覆盖；上一轮固定总数断言的失败归类为测试缺口。fixture guard复跑3/3，最终 Node+browser globals 的两文件 ESLint no-undef 为0（`/tmp/lime-plugin-cleanup-native-boundary-lint-final.log`）。追加检查 main fixture 时先前手工 globals 漏了 sessionStorage，最终改用项目既有 `globals` 包声明完整运行环境，不修改源码或屏蔽规则。
- 最终 CLI `plugin_cmd` 测试 exit0，3/3（`/tmp/lime-plugin-uninstall-cli-tests.log`）；同命令其他 targets 因过滤运行0项，不计入分母。收口分类：App Server/store/config/Skills/MCP 为 current；本清单17条旧路径为 dead/deleted/forbidden-to-restore；无新增 compat/deprecated。清单删除完成度17/17（100%），本地卸载切片单测、公共协议和产品门禁已通过；完整 Codex 插件对齐仍未完成。`verify:local`、Windows、live 与两仓发布安装 Turn 的未验证限制沿用前节，不能提升为全仓或全平台 green。

## P03 接线与删除续记（2026-10-17）

- 已直接替换四组协议与 local owner：markets/errors、唯一市场定位、typed Skill/App/Hook detail、安装 authPolicy/appsNeedingAuth。删除旧扁平 summary 的 sourceUri/digest/count 与通用 capability/UI DTO，不保留 alias。
- CLI 安装改为 PLUGIN@MARKETPLACE 或 PLUGIN --marketplace；删除目录直装、--source/--expected-digest/--marketplace-path。列表的市场筛选与 --available/--json 走同一 App Server。
- GUI 删除目录对话框及多包目录 review，市场候选驱动安装；安装/卸载后 fresh read，sidebar/mention 消费 grouped installed。PluginCatalogDetailPanel 文件改为实际导出的 PluginDetailPanel；不保留旧 re-export。
- 新市场发现由 host 注入 home/bundled 根，显式 cwds 表达 workspace；测试禁用真实 home/bundled 根，不读取真实用户插件。
- 正式 schema 生成首先暴露旧 v0 与 Codex v2 的 ScheduledTaskSummary/Schedule/Weekday 重名。除已处理 SkillDetailMetadata 外，将 v0 三种自动化类型直接重命名为 AutomationTaskSummary/AutomationTaskSchedule/AutomationTaskWeekday，同步唯一 Rust owner、TS gateway 及直接类型消费者；wire 字段与自动化行为不变。该机械写集属于消除生成类型歧义，需追加既有 scheduled tasks 验证。
- 该批 Rust 首轮 check 已报告接线遗漏与 Path/Option 比较错误，均已修复，不能记 green。正式生成器首轮因重复 schema 定义失败，重试排队中；owner tests 正在编译。GUI/mention/gateway 首轮32/33，唯一 fixture 预期误替换已修；后续8/8 guards通过，其余新改动待收取。新真实产品验证尚未运行。
- 追加架构确认：root，2026-10-17。无 compat/deprecated 新增；P03、P04 与完整目标仍 active，不以源码替换核销产品验收。

- 续接窄写集：插件页与原有测试、侧栏/mention 格式整理、`mcp_exact_jsonrpc.rs` 的安装夹具、`http-client.test.ts` 的插件超时夹具、`tool-surface-page-smoke.mjs` 的 installed 空响应；补齐自动化类型改名的两个 Rust 测试消费者。避让 settings/release、未认领源码、tsbuildinfo 与 Desktop REA 研究热区。
- 插件页刷新增加请求序号与 effect 清理；切换项目清空旧市场和安装/卸载确认，旧项目迟到响应不能覆盖新项目结果。真实 project root 经 `cwds` 传入同一 App Server，不使用服务端进程 cwd 猜测。
- 受影响前端 7 文件63/63通过，包括五语言市场文案、项目切换竞态、插件页/侧栏/mention、HTTP超时与自动化页面。首轮 App Server owner 编译 exit101，原因是协议改名期间旧依赖快照及两个未改名测试消费者；修复后排队重试，尚无新 Rust green。正式 schema 生成仍在执行，不手改生成物。

- 正式 Rust schema 与 TS 生成成功，旧 `PluginCatalog*` 生成物已由生成器删除；SDK build、仓库 typecheck 和完整 contracts exit0。contracts 首次因旧自动化类型断言、同时要求并禁止 `uninstallPlugin` 的矛盾守卫失败，已同步 current 名称并改为禁止旧 DTO，完整复跑通过。追加消费者/自动化 view model/旧面回流守卫8文件266/266通过。
- CLI search 同样使用共享 `-C`，删除私有 `--plugin-cwd` 和 README 的目录直装示例；list/read/search/install 均发送显式 workspace。新 CLI 实际产物待验。
- 生成 schema 与 Codex 对比结果保存 `.lime/qc/plugin-reconstruction/p03-schema-comparison.json`。初步差异包含 draft-07/2020-12 表达差异，不能直接作为语义失败计数；已确认的剩余边界包括 Hooks 缺少 Interrupt/McpTool、PluginInterface 的 Vec 必填约束，以及上游 AbsolutePathBuf 的归一化保证。当前四组外层合同替换不等于所有嵌套 DTO/runtime 行为完全一致，这些仍归 P01/P03 后续切片。

- App Server 插件 owner33/33、自动化28/28、协议自动化4/4、正式 schema fixture1/1、CLI插件4/4通过。公共 JSON-RPC 首轮6/7通过，唯一失败为搜索夹具先声明两个插件、却在第二个包目录建立前就加载整个市场；改为先创建全部包再安装，完整复跑7/7通过。保留首轮失败日志。
- 全仓 legacy report 首轮误将 `AutomationTaskSummary` 当作已删除 Automation 页面入口；将该路由守卫收窄为旧页面/Settings标识与完整路由词，补旧路由/i18n/Settings均被拒绝、现役类型被允许的回归。守卫225/225与完整 report零违规通过；不放开旧页面路径、不添加 allowedPaths。该规则文件追加为窄写集。
- 最终插件页12/12、TypeScript typecheck与脚本no-undef（6文件0错误）通过；清除目录候选数组残留，使用单个安装目标。manifest 无名读取便利函数限定为 test-only。正式新产物联合构建中，尚不记产品验收通过。

## P03 四组合同新产物验收（2026-10-17）

本节为本批最终状态，前面的编译中、待验证和失败记录保留为历史。`--locked` 联合 product build
exit0；App Server、CLI、code-mode-host 与动态库共7项固定在
`/tmp/lime-plugin-contract-artifacts-8ilwIm`，补 macOS rpath 后计算摘要。
清单为 `.lime/qc/plugin-reconstruction/contract-artifacts.json`；App Server SHA-256
`24cf6eaac5dc826517a6207e51e82f498a347b117056822d3c16300664108978`，CLI SHA-256
`07ede840924c6b037755399ca5715e75bf62e4dfe8970c73c6a60cf25b5cd521`。
全部产品场景显式使用该固定产物，后续共享 target 构建不覆盖它。

| 验证 | 最终结果 | 证据与边界 |
| --- | --- | --- |
| Rust owner/协议/CLI | App Server 插件33/33、自动化28/28、协议自动化4/4、schema fixture1/1、公共 Apps/Search/MCP7/7、CLI插件4/4 | `p03-rust-validation.json` 及 `/tmp/lime-plugin-contract-owner-retry.log`；不以过滤掉的测试计数 |
| 前端与生成物 | 7文件63/63、追加8文件266/266、最终插件页12/12；SDK build、typecheck、Electron typecheck通过 | 批次可能重叠，不相加声称唯一测试总数；正式生成器删除旧 schema/TS 类型 |
| 边界与清理守卫 | 完整 `test:contracts` exit0，legacy report零违规，路由守卫225/225；受影响TS与6个脚本lint零error | `/tmp/lime-plugin-contract-contracts-final.log`、`/tmp/lime-plugin-contract-legacy-report-retry.log`；旧 Automation 路由仍被拒绝 |
| Skills 真实 App Server | 8个Turn、两个SDK连接、一次冷重启，安装/编辑/启停/卸载均通过 | `contract-skills-stdio.json`；真实 runtime + 本地 Provider fixture，未使用 live provider |
| 真实 CLI 管理 | `cli-surface-gate-b.mjs` exit0 | `/tmp/lime-plugin-contract-cli-surface-retry.log`；统一 `-C` 隔离工作区，经 stdio 管理插件；不替代 exec/PTY |
| 正式 GUI smoke | literal `npm run verify:gui-smoke` exit0 | `contract-gui-smoke/summary.json`；真实壳、preload/IPC/App Server、重载、三视口与 memory shell，不证明模型Turn或像素等价 |
| Apps Electron | pass，通知后fresh read，pending/disabled正确；所有error/mock/legacy计数为0 | `contract-apps-electron/apps-catalog-gate-b-summary.json`；backendMode=unavailable，本地callable=false，不证明hosted授权或模型执行 |
| 插件完整 Electron | pass，安装/启停/新边界工具生效、mention、MCP表单/原生面板、reload/冷启、卸载后历史保留均通过 | `contract-package-electron/plugin-package-electron-gate-b-summary.json`；backendMode=runtime，本地Provider夹具，真实canonical Thread/Turn/Item |

表中相对JSON路径均位于 `.lime/qc/plugin-reconstruction/`。产品执行账本为
`p03-product-validation.json`，保留首轮失败和最终通过记录。CLI首轮未显式传 `-C`，
runner cwd为仓库根，服务端正确拒绝发现隔离市场；全部插件操作改用同一 `-C` 后通过，
没有回退进程cwd。其他已修失败包括改名中途的Rust快照/消费者、市场夹具建包顺序、
旧contract断言和Automation路由子串误报，见前节；失败日志不删除。

完整插件场景使用完整身份 `plugin://mcp-elicitation-plugin@local`。Electron主进程为44749和45506；
原生 WebContentsView 在首次打开、reload、冷启三个阶段均归属窗口、visible=true，实际宽度分别
410、421、233，高度均884。冷启前MCP进程45237，冷启后新增45769且冷启资源由新进程读取。
全程Provider请求2次、工具调用1次；冷启和卸载后不重执行。卸载后installed为空，历史仍可读，
面板明确显示已卸载，MCP ledger无新增；console errors、missing methods、mock fallback均为0。
原生证据摘录为 `contract-package-electron/native-view-verification.json`，不将主renderer截图
未捕获原生子视图的区域当作白屏。已检查安装确认、Apps待接入与卸载后历史三张截图。

最终复核：7项固定产物摘要未变，清单17条旧路径全部不存在，旧 `PluginCatalog*` schema和
旧详情组件路径均不存在。结果为 `p03-final-verification.json`。该17/17（100%）仅针对已枚举
删除清单；旧wire/目录安装也已直接删除。当前App Server/store/config/Skills/MCP为 `current`；
旧runtime/token/mock/独立Connector交付链及旧DTO为 `dead / deleted / forbidden-to-restore`，
无新增 `compat` 或 `deprecated`。没有迁移、真实用户目录清空、提交、推送或部署。

架构图确认：root，2026-10-17；`architecture.md` §7.2和§36同步本地验收边界，唯一共享后端不变。
LimeCore本批仅同步执行计划，前轮scanner的Go/contracts结果不充当新的两仓闭环。

剩余主链：marketplace add/remove/upgrade与registry/config；Git/npm/remote materialization；
reconcile、plugin/skill/read和share全组；完整Hooks/onboarding/Skill metadata/scheduled tasks；
嵌套schema中Interrupt/McpTool、Vec必填与AbsolutePathBuf保证；LimeCore发布/下载/授权到客户端真实Turn。
新批exec/PTY、Windows、live与packaged均未验证。`verify:local`未全跑：大量并行脏改动且入口
无写集过滤，当前只对实际定向与产品结果负责，不声称全仓green。完整目标、P03–P05仍active；
下一刀回到市场来源管理与物化，并同步LimeCore控制面及公共消费者。

### 旧 Lime 插件清理复核（2026-10-20）

- `npm run governance:legacy-report` 已扫描 2361 个源码文件、1608 个测试文件：0 个 dead-candidate、0 个分类漂移、0 个边界违规。
- 旧 Tauri/DevBridge plugin center、旧 `plugin-ui`、旧 marketplace 页面以及旧 provider/plugin 示例已物理删除；不保留 Lime 原有插件标准、ZIP 双轨、compat wrapper 或第二 registry。
- current owner 仅保留 Codex 方向的 `src/features/plugin`、App Server `plugin_catalog`/`plugin_remote`、MCP Agent Plugin parser 与 LimeCore control-plane release/package。`lime-rs/crates/core/src/plugin` 为空目录且无编译入口，不作为 current owner。
- 本复核不删除现役 owner，也不新增迁移层。后续只继续补 marketplace/reconcile/share、嵌套 Hooks schema、tar.gz 全量边界和 LimeCore 发布到客户端 Turn 的真实证据。

### tar.gz 跨仓状态复核（2026-10-20）

- Lime Rust extractor/packer 与 LimeCore 当前 archive owner 均以 Codex tar.gz 为唯一生产格式：`application/gzip`、100 MiB 压缩输入、512 MiB 展开预算、10,000 entries、路径/链接/特殊文件/重复路径/gzip trailer/多成员流 fail closed；ZIP 仅保留拒绝回归，不进入兼容分支。
- LimeCore 定向 `control-plane-svc/internal/service` archive/scan/components 测试通过；Lime 侧共享 75 包 corpus 与 Core 38 个 manifest directory 场景已有计划证据。真实 Core/MySQL、远端下载/授权和发布到客户端 Turn 仍是未完成退出条件，不能把定向测试写成跨仓端到端 green。
