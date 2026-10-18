# Codex 远端插件账号偏好（P04b13f）

状态：active；完整 Codex CLI/Desktop、共享后端及 LimeCore 对齐继续 active。
负责人：root。2026-10-18。前置：[目录与安装事实](codex-plugin-catalog-installed-facts.md)。

## 目标与上游证据

让远端插件启停落在当前账号服务端安装事实，本地插件继续 config/batchWrite。补齐逐技能 enable/disable 服务端合同；普通技能开关的产品入口待取得上游消费者证据后实施。
不做兼容、数据迁移、生产数据库、提交或发布。

REA 对象：ChatGPT.app 26.1007.30912/build20156，app.asar SHA256
75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af。
成员 webview/assets/app-initial-6350d04672d0.js SHA256
604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f。
Tkn 原字节2296600–2299761，uAn 2319364–2319628。提取记录
/tmp/lime-plugin-preferences-rea-extraction.json；REA 原始观察
/tmp/lime-plugin-preferences-rea-observations.json。
REA parent ev_67d1d8c38227c038a9168797e21ed1a2cb38d23832e94c3503273222b66471b6；
模块 item ev_99b09376879a4c13f3ba8071966da6c575b7365cf8a30bdd847f8c5bb26b374b、
ev_f45e8821c2e3f2e6ffe899d1640c29bc7f28bcb06ff39b0ecf80b7661c4b635f。
3/3 JS 解析；静态 AST，无执行证据，842 semantic unknown 不核销。

刷新链补证：同一成员的 Rkn/Skn/zkn 原字节另存
/tmp/lime-plugin-preference-refresh-rea-extraction.json；REA parent
ev_c03d43145f1d1f30fc40b41378db93c56c811ee06a7e03b7a11ae17150cf84d0，
root SHA256 507dcfa2860a5b8761f5f40ceed44f4df969b3414fa81300165a84c31aad3291。
3/3解析、94 semantic unknown；观察JSON为
/tmp/lime-plugin-preference-refresh-rea-observations.json。
Skn枚举已有cwd查询，local先browserPluginConfig.syncAfterPluginChange，再forceReload技能；
Rkn捕获刷新失败并提供独立warning/retry；zkn令插件、技能等查询失效。该源码调用链
支持区分写入成功与后续刷新失败，不是实际运行时机证据。Lime当前reconcile/fresh read
沿同一已存在owner；逐技能运行时生效仍遵循Codex remote.rs:1908，不由这组函数自行推定。

已证实：远端插件 POST /ps/plugins/{plugin_id}/enable|disable；逐技能
POST /ps/plugins/{plugin_id}/skills/{skill_name}/enable|disable；无 body。
Tkn 本地分支为 config/batchWrite，远端成功后刷新。uAn 在 OAuth plugin-skill resume
成功后被调用，随后 invalidate plugins。普通技能开关消费者后续已补证，见下节；写入响应正文尚未证明。
Core 的 mutation 响应使用既有 PluginMutationResponse，是本地合同选择，不冒充上游响应观测。
installed.disabled_skill_names 读取及本地 cache 不写逐技能状态另见 Codex core-plugins/src/remote.rs:1468、1908。

## 窄写集与架构确认

后续技能UI证据已补定位：同ASAR的webview/assets/routes-2879a4fdfb21.js，
成员SHA256 620c0ac288b3db33f2f4856f56dfd8d368591bff9f47283821c58d4ba7610042。
wa原字节55052–60610，SHA256 e6b5d5a101683804b985cb7b206a0973fc2a1f41f6c968a13c424de1a8f6218d，
经Ybn导出绑定uAn。REA parent
ev_4dd302718b26064dd30c2f2184e12536cbfb3053d1bc5f7fa9a0fc6d1ee0a13b，
1/1解析、零失败；提取/观察为/tmp/lime-plugin-skill-toggle-consumer-extraction.json、
/tmp/lime-plugin-skill-toggle-consumer-rea.json。
wa的mutation调用逐技能启停后br(queryClient)刷新；开关在pending、管理员停用、应用授权
未就绪等情况下禁用；应用需要连接时先走授权，成功后才enable。isError显示saveFailed。
普通开关消费者已定位，后续应继续定位br及相关应用判断，不能把纯技能的开关简化为完整Apps
授权实现。本切片不新增技能UI，仍属planned；初始“待取得消费者证据”已由此补证替代。

Lime：src/lib/api/pluginCatalog.ts 与测试；PluginCatalogPage.tsx 与测试；
既有远端 Electron fixture/issuer 的偏好场景（如需要）；本计划、总计划、architecture §7.2、
plugin/codex-contract。Core：plugin_installation model、两种安装仓储、repository interface、
安装 service、独立 preference controller/service/test；public_client 路由、tenant service interface
仅添加声明；OpenAPI client fragments、bundle、types、SDK、docs 和计划。
不覆盖首页/侧栏/CLI/TUI/预览/发布或未认领改动；既有跨轮插件脏改动保留。
大文件仅增路由/interface 声明；新业务落独立文件，退出条件为本切片收口。

```text
PluginCatalogPage -> typed plugin gateway
  local -> config/batchWrite
  remote -> cloud/request -> AccountManager authenticated tenant API
    -> Core preference controller -> service authorization
    -> current installation snapshot repository (save then publish)
  -> plugin/reconcile -> installed/list/read -> canonical plugin/skill projection
CLI/TUI -> same App Server + account + installed projection
```

架构图确认：root，2026-10-18；没有第二套 runtime、配置 owner 或数据库表。

## Verification Contract

budget:normal；风险P1。输入：认证账号、opaque plugin ID、raw skill name、enable/disable。
用户结果：成功后 fresh read 恢复偏好；失败/持久化失败/换号不发布成功事件。
Core 当前可见授权不得被个人偏好绕过；无安装不得凭偏好创建安装；
逐技能名字须来自授权 release 的声明，按完整原文匹配。
安装合同复核：Codex core-plugins/src/remote.rs:1642明确拒绝安装响应enabled=false，
Lime plugin_remote/mutation.rs也遵守该合同。最初拟定的“重装保留停用”策略与此冲突，
已纠正为重装重新启用插件，保留installedAt；逐技能偏好保留是Core明确选择，未声称
已证明上游内部重装实现。首次安装enabled=true、disabled_skill_names=[]。

主链：GUI gateway -> preload/IPC app_server_handle_json_lines -> cloud/request
-> account owner -> Core installation snapshot；read model 为 plugin/list/read/reconcile。
本轮不改 Thread/Turn/Item 或工具生命周期，因此无新增 runtime event/tool/approval。
预期错误停于 gateway/account/Core；无生产 mock fallback。

证据层：Core service/repo/controller 与 SDK、Lime gateway/component/contract；
Electron 需证明当前壳、IPC、云请求与刷新后的可见卡片；GUI smoke。
不以 Electron 无 backend fixture 证明真实模型 Turn、live Core/MySQL、exec/PTY、Windows 或打包。

执行顺序：
1. 已完成 REA 定位和 current owner 盘点。
2. Core 持久偏好和四个无 body 端点；同步安装列表、SDK/OpenAPI。
3. Lime 远端开关切至共享账号 HTTP，保留本地 config；账号 fence 与失败回归。
4. 定向 Go、SDK、前端、完整 contracts；按实际写集补 GUI 证据并冻结。
5. 回写结果/失败原件/未验限制；不得标完整目标完成。

退出条件：上述1–4均有实际结果，文档可审阅。未满足项保持active。
完成度按已验行为项统计，不能沿用174/56/15作为产品完成率。

## 实施与验证结果（2026-10-18）

本切片状态：implemented / verified；下表7项合同7/7通过（100%），仅计算本计划明确写集。
完整对齐目标仍active，不将174/56/15或本切片百分比作为整体产品完成率。

| 合同 | 结果 |
| --- | --- |
| 远端插件启停无body POST，本地仍config/batchWrite | gateway、页面、真实Electron与请求捕获通过 |
| 逐技能端点、raw name、权限/已有安装校验 | Core service/HTTP通过；含Unicode和空格原文、未知技能与跨身份拒绝 |
| 偏好持久化、冷恢复、并发及保存失败不发布 | snapshot测试及race通过；读取深拷贝，不泄漏slice别名 |
| GUI成功fresh read，失败保留状态 | WORKSPACE/GLOBAL两组Electron通过；500失败不改卡片与安装事实 |
| 账号identity/epoch fence | gateway回归拒绝账号不符、注销及切走再切回的迟到结果 |
| OpenAPI/SDK/五语言同步 | fragments生成bundle、SDK/类型与文档同步；SDK和26项页面回归通过 |
| 真实壳、共享stdio和冻结审计 | 两组插件完整场景、GUI smoke24/24及逐文件audit通过 |

实现：Core安装模型新增enabled/disabledSkillNames，两种repository复用copy-on-write
和save-before-publish；新增独立preference service/controller。个人偏好不能创建安装、
越过租户策略或改写其他用户。安装列表读取真实字段。逐技能开关不改变插件enabled；
远端disabled_skill_names仍不写本地skills.config。
GUI source=remote使用opaque ID与既有cloud/request，失败不发catalog changed或写本地配置；
local保留原config/batchWrite。新增类型未增加RPC/IPC/数据库表/迁移/兼容层。

遵循单一owner与DRY：安装和偏好共享一个snapshot提交入口；锁内保留其他领域数据，
不新增独立偏好表或runtime。解码/授权在边界校验，组件不直接发送认证HTTP。
大文件public_client/tenant/repository interface只加路由或声明，新业务落独立领域文件；
SDK只补既有公开方法，后续不继续向中心文件追加业务。

### 实际验证

- Core最终全量3个受影响包（repo/service/controller）exit0：
  /tmp/lime-plugin-preferences-core-reinstall.log。不是整个Go workspace全量测试。
- Core仓储race、最终受影响3包vet、HTTP Unicode回归均exit0：
  /tmp/lime-plugin-preferences-race-final.log、
  /tmp/lime-plugin-preferences-core-vet-final.log、
  /tmp/lime-plugin-preferences-http-unicode.log。
  make verify-go-fast已exit0，最终改动另补上述vet/test。
- make verify-contracts最终exit0、client-contract-sync通过：
  /tmp/lime-plugin-preferences-core-contracts-reinstall.log、
  /tmp/lime-plugin-preferences-core-sync.log。
- gateway两文件9项及最终页面26项通过：
  /tmp/lime-plugin-preferences-frontend.log、
  /tmp/lime-plugin-preferences-page-five-locales.log。
  同一页面早期21/22项批次不重复相加。
- SDK与目录合同9/9通过：/tmp/lime-plugin-preferences-sdk.log；
  TypeScript renderer检查、受影响TS lint与3份fixture no-undef零错误。
- 完整npm run test:contracts、legacy report零违规、scripts治理、docs boundary通过，
  证据前缀/tmp/lime-plugin-preferences-；两仓本写集diff --check通过。
- WORKSPACE最终完整Electron exit0/ok=true：
  /tmp/lime-plugin-preferences-electron-v2/summary.json。
- GLOBAL完整Electron exit0/ok=true：
  /tmp/lime-plugin-preferences-electron-global/summary.json。
  两组console/page/issuer errors=0、renderer API requests=0；停用/启用、失败不提交、
  同账号共享stdio fresh read、换号、reload、冷启、卸载、注销均通过。
  GLOBAL另证明Apps原文、native version与卸载投影，不证明Apps认证或工具执行。
- 同一产物GUI smoke exit0/result=pass、24/24：
  /tmp/lime-plugin-preferences-gui-smoke/summary.json。三视口截图与两张插件启停截图已目检。
  使用隔离outDir的正式Vite renderer构建（13m39s）加既有scripts/electron/smoke.mjs，
  未声称literal npm run verify:gui-smoke命令执行过。没有重建共享dist。
- 本轮无Rust源码改动，复用P04b13e固定App Server及Host原字节；实际Electron/stdio
  均使用摘要240870bb1f80bdd568f2d7bf88336dbae06cfb2d6b246dd3a4b66b80eeaf0632。
  不以旧Rust测试核销任何新Rust代码。

### 失败与证据边界

首轮完整WORKSPACE exit1，原件/tmp/lime-plugin-preferences-electron/summary.json、
failure.png保留：冷启切回账号后页面显示cloud request failed，卡片等待120s超时。
此轮新增偏好场景、冷启账号1已通过，console/page/issuer无错误；没有取得失败请求根因。
仅补请求method/accountIndex/time/status/aborted与失败时账号/catalog RPC诊断，
未放宽断言、改产品、添加自动重试或屏蔽错误。同一产品原字节v2及GLOBAL随后完整通过。
首轮网络失败仍按未定根因记录，不宣称已修复所有跨进程网络可靠性问题。

中途安装策略复核纠正了“重装保留停用”的初始设计；Codex原生安装硬校验enabled=true，
Core现为重新启用插件并保留installedAt。最终服务/仓储/HTTP与契约已按此复跑。
安装release身份/版本持久化仍未完成，不将该修正说成已对齐升级/版本固定。

测试依赖为controlled Core-shaped issuer，backendMode=unavailable、modelTurn=false。
Core Go测试与Electron分别证明自身边界，尚未连接真实Core进程/MySQL完成同包Turn。
普通技能开关UI/应用OAuth条件、CLI/TUI直接偏好写入、live、exec/PTY、Windows、
packaged与完整verify:local均未核销。后者因大量并行写集未全跑；本轮无跨仓发布/提交/数据库操作。

### 冻结与分类

产品目录：
- /var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-plugin-preferences-validation-ypLItp
- /var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-plugin-preferences-global-ixqos5

每组保存4,754项产物（含HTML）；7项客户端源码、34项执行依赖及16项Core源码摘要
最终全部无漂移，/tmp/lime-plugin-preferences-final-audit.json为exit0/ok=true。
隔离清单/tmp/lime-plugin-preferences-isolation.json及-global-isolation.json，
执行依赖-harness-v2.json/-harness-global.json分别对应两组；未改写前组冻结目录。
fixture摘要6dc9a6926abba4597fa3a401c3afd0042fcb126feb8258d70614ab703125f230；
独立清单排序算法不同，逐文件audit为最终依据，不混用两种摘要。

current：AccountManager/cloud/request、Core installation snapshot、插件投影与本地配置各司其职。
deleted：远端插件开关错误写本地config的分支已直接替换，回归禁止恢复。
无新增compat/deprecated；原插件体系继续dead/deleted/forbidden-to-restore。

下一刀：依已取得的wa/uAn及应用授权证据，定位br刷新与各门禁的current owner，
实施普通技能启停UI；随后完成安装release事实、同包Core真实进程到Turn及CLI/PTY义务。
