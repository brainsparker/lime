# P04b13e 目录安装事实

状态：客户端目录切片已验，专项 100%；主目标完整对齐仍 active，真实 Core 完整链未验。
前置：P04b13d 详情已验，本刀关闭客户端目录安装事实差异。

## 对标证据

目标仍为 ChatGPT.app 26.1007.30912/build20156 的同一 ASAR，SHA256
`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
从已保留 app-shared 原字节按 AST 边界提取 7 个函数，记录字节范围与 SHA256，
清单 `/tmp/lime-plugin-list-rea-extraction.json`；没有执行目标代码。

REA parent `ev_526baddba0c4c87c5c6fe559403db2cccf47309e87b0f0e2ee9414a32513c24f`，
ZZr item `ev_904f3e28c6e520e209129c2fd7f692dbe99bbd758c786ef66cf31506d0c4f7f1`。
7/7 JS 解析、零 parse failure；跨函数动态调用和运行时刷新时机仍 unknown。
旧详情切片图按字符串 UZr 的 trace 无匹配，不据此认定能力不存在。
新图 plugin/list 字符串 trace 也无匹配；结论依模块原字节和 AST 范围，不宣称 REA 已追踪
完整跨函数运行路径。可复查观察归 `/tmp/lime-plugin-list-rea-observations.json`。

| 观察 | 依据 | 实施边界 |
| --- | --- | --- |
| 本机目录调用 App Server plugin/list | Desktop z2/bZr | 目录留在共享 App Server，renderer 不直连 Core |
| 托管安装列表完整分页并以服务端行投影 | Desktop ZZr/W2、GZr、H2 | 不以本地物化推断安装；hosted localVersion=null 不套用 native |
| native 目录关联 fresh installed，按 opaque ID 匹配 | CLI core-plugins/remote.rs:811、1240、1801 | version 与 installed release.localVersion 分开 |
| GLOBAL 追加 installed-only；Workspace/User/Vertical 不追加 | 同文件 848、875、1204、1240 | 空集合省略；Shared 继续两桶 |
| fresh enabled 叠加 plugins 配置策略 | CLI request_processors/plugins.rs:2231 | 配置只限制 enabled，不改安装事实 |

Desktop oZr/jJr 缓存呈现与去重为静态观察，未作为 Lime 已对齐结论。
Lime GUI pluginCatalogEntries 直接消费列表，mergePluginShareCatalog 只补缺失项，
不覆盖已有目录安装字段。plugin/installed 与本地 runtime readiness 仍是独立读面。

## 写集与架构确认

窄写集：runtime/plugins/remote.rs、remote/collections.rs、remote/projection.rs；
plugin_remote.rs 仅重导出既有 Installed 类型供上述投影复用；
remote_plugins_jsonrpc 受影响 fixture、新 catalog 回归及 stdio；本计划、主计划、
scripts/electron/remote-plugin-catalog-fixture-smoke.mjs 补真实 IPC 撤销/stdio 恢复读面断言；
architecture §7.2、plugin 合同及 Core 同名计划。避让首页、侧栏、CLI/TUI、发布与未知
脏文件。沿用本进程 P04b13d 改动，不覆盖他人改动。
新增计划被既有 ignore 规则排除，补 `.gitignore` 单文件例外以进入仓库事实源，不暂存/提交。

事实源：同一 authenticated Context 的目录与完整 installed snapshot；一条 list 的所有
collection 复用一次 all-scope snapshot，includeDownloadUrls=false。Core 现有 API 支持
all scope，不新增接口、SDK、schema、迁移或偏好写入 API；Core 本刀仅同步计划。
先验证目录，再完整读取安装快照；任一步失败不发布部分 remote 目录，保持现有 explicit
错误与 implicit local-only 语义。账号末端 fence 保留。

架构影响：重大。root 于 2026-10-18 确认：Shared plugin/list → 同一 Context directories
→ fresh installed snapshot → scope/opaque-ID join → shared plugins policy → typed summaries。
不下载、不物化、不写回本地配置/安装 read model；旧本地 overlay helper 直接删除。

## Verification Contract

责任：root；P1 / budget:normal。输入：现役 plugin/list、当前共享账号与配置。
可见结果：未物化安装、禁用、撤销及版本差异反映在目录；失败显式终态，换号拒绝迟到数据。
退出条件：实现、定向 Rust、public RPC、真实 stdio、contracts、与新 Rust 绑定的真实
Electron 目录流程及两仓文档回写。

回归覆盖：远端偏好与陈旧本地包分离；分页与失败；GLOBAL installed-only；其余集合不补；
Shared 两桶与 canonical identity；Unix 秒；plugins 配置门禁；不索要下载 URL、不写本地
read model/cache。静态 issuer 显式补响应，不用全局空响应 fallback 掩盖未知请求。

新 Rust 必须新编译；cargo 使用 resolveRustyV8CargoEnv。GUI 使用有源码对应关系的冻结
renderer 与新 Rust，记录组合摘要，不冒充共享 dist 最新状态。证据写系统临时目录。
未执行 live Core/MySQL、provider Turn、CLI exec/PTY、Windows 时分别列出，不以本刀核销。

主链补充：GUI PluginCatalogPage → typed plugin gateway → preload/IPC
app_server_handle_json_lines → plugin/list → RuntimeCore remote owner → PluginSummary。
CLI/TUI 消费同一 JSON-RPC；本刀真实 stdio 不冒充 CLI exec/PTY。
Happy path 为账号已登录后读目录、安装、换号/冷启/卸载；测试增加远端撤销/恢复且不触发
reconcile 的 IPC/stdio 读面。纯读请求不产生 Turn、tool call、approval/sandbox 或 runtime
event，不新增 Evidence Pack 字段；这些项本刀不适用，不作为已验。
deterministic-smoke 用公共 RPC/stdio 与 contracts；gui-trace 用 Electron invoke/network/
console 和截图；runtime-transcript 与 release-artifact 不适用，未执行模型回合或打包发布。
原则：详情与列表复用同一 summary_with_installation 投影，一次快照服务多个集合；删除
重复本地 overlay，不新增 registry、第二后端、迁移或兼容分支。

## 进度

- [x] REA 定位 Desktop 实际路径、上游 CLI 关联与策略、Lime 消费者复核。
- [x] 替换目录本地 overlay，保留 ACL、分页、身份隔离和失败边界。
- [x] 公共 RPC / stdio、contracts 与 Electron 真实进程验证。
- [x] 两仓计划、架构、合同同步最终结果与未验范围。

目录缓存/prefer-cache/forceRefetch、偏好编辑、included_files 和整体跨平台/真实后端验收
仍开放；本刀不宣称完整 catalog 或完整产品已对齐。

服务端复核新增明确缺口：Core control_plane_plugin_installation_service.go:49 以
clientPluginReleases 的当前目录 release 构造 installed 行，返回 Enabled:true 与空
DisabledSkillNames；RemotePluginInstallation 目前只有 plugin ID / installedAt，未独立保存
安装版本和偏好。因此 Core 已支持本刀读取 transport/分页，但实际版本与偏好持久化未对齐。
本刀 controlled issuer 的旧版本/禁用回归只证明客户端消费，不冒充真实 Core 已产出。
下一阶段先以 REA 定位写入端点和 release 选择，再修改现役安装 repository/service/合同，
同步内存/MySQL/schema/测试；不自造接口，不增加兼容或迁移，不操作生产数据库。

## 本轮验证结果

| 验证 | 结果 / 证据 |
| --- | --- |
| remote_plugins_jsonrpc | exit 0，59/59，0 ignored，352.15 秒；含新增 5 项与真实 stdio；`/tmp/lime-plugin-list-rpc-test.log` |
| 完整 npm run test:contracts | exit 0；`/tmp/lime-plugin-list-contracts.log` |
| legacy-report / docs boundary / Rust formatting / fixture syntax | exit 0；`/tmp/lime-plugin-list-legacy.json`、`*-legacy.log`、`*-docs.log`；窄写集 diff-check 通过 |
| WORKSPACE Electron | exit 0 / ok=true；`/tmp/lime-plugin-list-electron-v2/summary.json` |
| GLOBAL Electron | exit 0 / ok=true；`/tmp/lime-plugin-list-electron-global/summary.json`；另验 GLOBAL native version / Apps 元数据与卸载移除 |
| 通用 GUI smoke | 同一冻结产物复跑 exit 0、24/24；`/tmp/lime-plugin-list-gui-smoke-v2/summary.json`；三张布局截图已目检 |
| 最终漂移审计 | exit 0 / ok=true；`/tmp/lime-plugin-list-final-audit.json`；4,642 产物、9 源码、33 执行依赖均无漂移 |

Cargo 经 resolveRustyV8CargoEnv，编译 13m42s；没有重复扩大到 workspace 全量。
两组 Electron 经过真实 preload/IPC、app_server_handle_json_lines、共享 JSON-RPC 与 stdio，
安装、换号、重载、冷启动、卸载和注销成功。新增撤销状态经真实 IPC 读取，恢复经 stdio
读取；中间 plugin/installed 仍保持原本地物化快照。此新断言为 RPC 读面，未冒充新增状态
已在 GUI 卡片实时呈现。既有目录/安装截图已目检，console/page/issuer errors 均 0，
renderer API 请求 0；bundle 仅后端无账号凭据 GET。依赖仍为 controlled Core-shaped issuer、
backend unavailable、modelTurn=false，不证明 live Core/MySQL、同包 Turn、连接器认证/执行。

冻结目录 `.../T/lime-plugin-list-validation-DzePYP`：复用 P04b13d 已验证 renderer 原字节，
更新本轮 Rust 与正式 prepareElectronAppServerAssets 产物/manifest，不冒充共享 dist 最新。
App Server SHA256 `240870bb1f80bdd568f2d7bf88336dbae06cfb2d6b246dd3a4b66b80eeaf0632`；
4,642 项清单摘要 `92bfb480df03fea792ea0854ea7326729329cfab6f1e7246f2ee2934aaae383a`，
清单 `/tmp/lime-plugin-list-isolation.json`；新鲜度通过，HTML 原件完整保留。
通用 smoke 经现役 scripts/electron/smoke.mjs 执行；未声称新跑 npm 聚合 renderer 构建。

失败原件保留：首次 Electron 在加载前发现冻结目录缺少 fixture imports，日志
`/tmp/lime-plugin-list-electron.log`；补齐并冻结 33 项执行依赖后 v2 通过，未改应用产物。
首轮通用 smoke 自动数值 24/24，但 1536×960 PNG 为启动页，人工不通过；原件
`/tmp/lime-plugin-list-gui-smoke/` 保留。原产物复跑 v2 三张均为工作台、无越界。
截图时机护栏缺口仍开放，避让 electron/smokeChecks 并行热区，没有放宽断言或覆盖旧证据。

分类：current 为共享远端目录与安装投影；旧本地 overlay helpers 已删除（dead），
无新增 compat/deprecated 或迁移；原有已删除插件体系不恢复。首页/侧栏/CLI/TUI/专业预览/
发布及未确认的 local-conversation-page 产物均未触碰。未跑全仓 verify:local，避免把并行
写集纳入本刀结论；未验 live Core/MySQL/Turn、CLI exec/PTY、Windows 或打包发布。
下一刀仍由当前主线推进：先 REA 定位偏好写入与安装 release 选择，再完成 Core 持久化合同。
