# Codex 插件重构与 LimeCore 联动

状态：active。责任：root。日期：2026-10-17。

## P03 市场来源管理（当前执行）

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
| P02 | PluginId、store、配置 | `name@marketplace`、Codex cache/version/enablement 语义；删除 v3 installed records 和旧写入；不读取旧状态、不转换旧数据 | in-progress / cache 与共享配置已替换，本地启停/冷启/卸载产品证据已通过；完整 remote/bundle 语义未验 |
| P03 | App Server/CLI/TUI/GUI 协议 | Codex 形状 list/read/install/uninstall/installed/marketplace/config；同步 schema/client/gateway/catalog/fixture；删除旧 DTO/API | in-progress / 自建启停 method、旧 DTO/目录安装已删；五组本地合同正式生成与新产物 Skills/CLI/Electron 通过，完整方法组及嵌套语义仍 pending |
| P04 | LimeCore 包发布与市场 | 包扫描、摘要、发布、HTTP 合同、SDK/类型/后台同步；删除旧 `lime.plugin.package.v1` 及旧 manifest 校验 | in-progress / first cut |
| P05 | 清理和真实产品闭环 | 旧源码/规则/测试/文档入口零生产引用；新标准包在两仓发布到安装到真实 Turn，CLI/PTY/Electron 分别验收 | in-progress / 新合同本地 stdio/CLI/GUI/插件 Electron 闭环通过；两仓发布安装 Turn、exec/PTY、Windows/live 仍 pending |

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
| marketplace/add | 缺失 | source/refName/sparsePaths，安装 root 与 alreadyAdded；CLI/GUI 同一 owner |
| marketplace/remove | 缺失 | marketplaceName，删除配置与本地来源，不误删其他市场 |
| marketplace/upgrade | 缺失 | 单个/全部升级，逐市场错误与 roots |
| plugin/list | 已直接替换；公共合同及新产物本地产品验证通过 | cwds/marketplaceKinds/forceRefetch；marketplaces/errors/featured IDs；旧 query/source/marketplacePaths wire 已删 |
| plugin/search | 部分 | 保留 Codex wire，市场定位、scope、分页与完整 identity；不以进程 cwd 猜测调用方 workspace |
| plugin/installed | 已直接替换；公共合同及新产物本地产品验证通过 | cwds/installSuggestionPluginNames；市场分组与 load errors |
| plugin/reconcile | 缺失 | bundle/enablement/removal diff、失败远端 ID 与 materialization 分类；不伪造 readiness |
| plugin/read | 外层合同及新产物本地验证通过；嵌套语义仍 partial | marketplacePath/remoteMarketplaceName + pluginName；Codex PluginDetail、Skill/App/Hook summaries |
| plugin/skill/read | 缺失 | 远端插件 Skill 读取与同一包/授权边界 |
| plugin/share/save | 缺失 | pluginPath、远端身份、discoverability 与 targets；shareUrl |
| plugin/share/updateTargets | 缺失 | principals/discoverability，权限与租户过滤 |
| plugin/share/list | 缺失 | 远端插件与可用本地 checkout 路径 |
| plugin/share/checkout | 缺失 | materialized identity/root、市场定位与远端版本 |
| plugin/share/delete | 缺失 | 空 response、远端权限与失败不破坏本地状态 |
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
