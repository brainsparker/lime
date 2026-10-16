# v1.159.0 发布执行计划

状态：publishing。用户已明确回复「确认」，授权固定122路径候选的commit、tag、main/tag推送与GitHub/R2/npm端到端发布；冻结后并行变化保留下一版。发布准备100%；整体发布70%；release commit/tag/main已推送，Quality成功；Release因Apple CloudKit网络失败，修复与原作业重试中。

## 当前可审阅结果

- 固定候选122路径：7个release metadata，115个产品/测试/脚本/文档路径；完整清单 `.lime/release/v1.159.0/candidate-review.md`、补丁 `frozen-candidate.patch`。显式路径暂存，当前暂存区为空；不使用宽泛 `git add -A` 纳入本地链接或并行变化。
- 本地版本一致性、完整typecheck、contracts、474+3项定向前端/发布回归、Rust配置43项、CLI npm 9项均通过；current静态368项和22条真实Electron场景按固定源码收据通过，审批首次退出超时已保留并精确复验。标准GUI smoke exit0，真实App Server版本1.159.0、reload、3视口及memory settings通过。
- 标准GUI收据 `gui-smoke-summary.json`；current场景收据 `gate-b-receipts.json`。不声称原失败的聚合wrapper通过，不把并行原工作区的全量结果算作固定候选验证；本版本完整Quality与三平台packaged结果待远端实读。
- 本地外部分析产物和增量缓存2项排除；冻结后36个新增路径、3个重叠路径的后续版本保留原工作区，完整清单 `post-freeze-exclusions.json`。用户最终明确确认固定候选与排除范围，授权已取得。
- 收到明确确认后，正常hook提交 `Release v1.159.0`、创建v1.159.0、推送main和tag，随后跟踪Quality/Release并审计GitHub资产、签名公证、R2和npm；不覆盖既有tag。对原工作区只在保护索引与工作区文件的前提下同步已发布基线，后续改动保留。

## 目标、范围与授权

- 用户要求「发布 v1.159.0」。版本规范化为 1.159.0，标签 v1.159.0；危险 Git 写操作待完成候选验证后统一明确确认。
- 起点 main/origin/main 为 `d6dc866ea8f636dd4367eff86e84aa383a26016c`，v1.158.0 为上一发布标签；初查远端 v1.159.0 不存在。
- 任务开始时工作区全部产品、测试、脚本、文档改动纳入候选；沿用已有事实源排除外部分析产物 `local-conversation-page-a83a1af2c24b.js` 和增量缓存 `tsconfig.node.tsbuildinfo`，保留本地。冻结之后的新增及重叠版本差异单列，待最终发布确认。
- 直接写集：package.json、packages/cli/package.json、lime-rs/Cargo.toml、lime-rs/Cargo.lock、RELEASE_NOTES.md、RELEASE_NOTES.en.md、本文。现有产品源码只读验证，必要修复另记精确写集。
- pnpm lockfile 不包含 root release version；Forge 与 App Server manifest 继承版本，无新增版本事实源或依赖变动。
- 另一进程正在运行 verify:local，不终止、不覆盖其测试状态；本轮日志、候选摘要与验证收据置于忽略目录 `.lime/release/v1.159.0/`，源码漂移后不沿用失效证据。

## 发布内容与边界

- 设置章节与返回导航收敛到既有 useAppNavigation，返回实际会话并清理一次性启动意图。
- Memory、Web Search、Environment、Execution Policy、Profile 等表单接入未保存保护，保存仅合并实际编辑字段，失败和在途编辑保留草稿。
- Profile 拆分 displayName/bio 展示、编辑与配置映射，删除无消费者的头像、邮箱、标签字段与旧展示逻辑；仍是本地配置，不冒充远端公共身份合同。
- 修复返回会话时 Composer 初始化与初始技能表单恢复，迁移 Electron 导航、保存、冷启动和正常退出证据。
- current：既有 renderer/config/navigation 与 Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item 主链。新增 compat/deprecated 为零；被替代的局部状态、完整配置快照及旧正向 fixture 为 deleted。
- 架构图沿用 architecture 4.4 和 current GUI 计划中的责任确认；本轮发布 metadata 不改变业务 authority。整体 GUI 对齐与远端 Profile 合同仍 partial。
- KISS/DRY：复用版本与发布入口；SOLID：保持配置、草稿、展示职责边界；YAGNI：不新增兼容层或平行后端。

## 验证合同与退出条件

负责人 Codex，P1，非 live。本地配置经既有 config/read、config/batchWrite 与 Desktop bridge；会话恢复复用 canonical Thread/Turn/Item。受控 fixture 不证明 live provider 或其他平台。

1. 版本事实源统一 1.159.0，双语单页发布说明；verify:app-version 与完整 npm run typecheck 通过。
2. contracts、发布 guard、受影响前端与 Rust 配置回归通过，保留失败原件及精确重试结果。
3. Agent current fixture 先于标准 verify:gui-smoke；版本变化后核验真实 Electron/sidecar 构建新鲜度。
4. 复核完整候选与源码漂移，明确 metadata/candidate/excluded 清单和验证结果后请求一次 commit/tag/push 确认。
5. 授权后正常 pre-commit，连续执行 release commit、tag、main/tag push，实读远端引用；继续审计 GitHub Quality/Release、平台产物、updater 与 CLI npm，不以触发 workflow 代替发布完成。

## 验证记录

- `npm run verify:app-version` exit0；桌面、CLI、Rust workspace 均为 1.159.0，Cargo.lock 的 36 个无 registry source 的 workspace package 同步；未改外部依赖。
- 完整 `npm run typecheck` exit0，Renderer 与 Node 两部分均执行；收据 `typecheck.log`。
- `npm run test:contracts` exit0，1036 protocol types 无漂移，命令/Harness/多模态/脚本/发布/CLI/文档边界通过；收据 `contracts.log`。
- 34 个改动相关与发布护栏测试文件、474 项全部通过，单 worker 执行；收据 `targeted-tests.log` 和 `targeted-test-paths.json`。
- `cargo test --offline --locked --manifest-path lime-rs/Cargo.toml -p lime-core --lib config::types::unit_tests` exit0，43 项通过，含新增 profile_roundtrip_drops_retired_fields；收据 `rust-core-config.log`。最初 related 入口扩展反向依赖且 metadata 下载所有平台依赖，已仅停止本轮自有 cargo metadata，原入口 exit1 保留 `rust-related.log`，改由受影响 owner 定向测试收口，不声称 related 聚合通过。
- CLI npm launcher/staging 9/9，通过；五份发布 JSON/Markdown 文件 Prettier 检查通过；`git diff --check` 通过。
- 并行 verify:local 第 35 批的 Windows packaged evidence 失败后，原负责人已独立复验 8/8 并启动续跑；不改测试、不放宽断言或时限，本轮不把未完成全量状态计为通过。
- Agent current fixture 的静态四组分别 31、34、3、300 项执行通过；Renderer、Electron Host 与资源重建成功。首次聚合在 sidecar 构建前的 V8 23,542,428-byte 依赖下载处因每轮 120 秒重启受阻，仅停止本轮 curl，原聚合 exit1 保留 `current-fixture.log`。随后通过官方 GitHub Release 下载同一资产，归档与绑定大小和官方 SHA-256 均 2/2 通过，填入既有标准缓存；收据 `v8-asset-verification.json`。未改测试或时限，重跑 `current-fixture-retry.log` 正在编译新版本 sidecar。标准 GUI smoke 待该入口完成。
- 并行全量第 61 批出现本地 Codex 参考源码漂移，原负责人已更新 `src/lib/governance/codexModelNativeToolPolicyOrigin.test.ts`，清理过期 StableEnvironmentTools 形状断言并保留 current apply_patch 行为与边界回归。本轮只读审阅，新增该测试路径进入候选，独立复验 3/3 通过，收据 `model-tool-origin-regression.log`；原失败日志不覆盖。该文件被 Renderer typecheck 明确排除，产品类型检查输入未变。
- 文档仍有并行记录更新，产品实现源码截至本轮定向/类型验证结束未漂移，最终提交前重新固定完整清单。候选审阅清单为 `.lime/release/v1.159.0/candidate-review.md`，此前 121 路径，新增的参考护栏测试随最终清单更新。

## 未验证与剩余工作

未验证 Windows 本地交互、live provider、系统输入设备、长期稳定性和整体 GUI 对齐。平台安装包与公网更新源须由本版本远端发布结果单列，不沿用上一版本证据。

## 并行变化与独立候选

- 原工作区在 sidecar 编译期间新增 App Server 连接上下文、请求分发与测试改动，范围持续扩大；Profile 两文件新增 Rust nullability 类型对齐和回归。它们尚未由本轮发布门禁验证，不能把前段结果视为覆盖新源码。
- 已通过异步问题请用户选择范围；等待答复期间，先按最初已验证候选准备可审阅的独立版本，保留原工作区全部后续变化，最终发布确认须明列候选与排除项。
- 122 路径 overlay 已保存 `frozen-overlay/` 与 `frozen-overlay-sha256.json`，其余源码精确取起点 d6dc866ea。两个变化文件从当前内容恢复到最初已验证版本，SHA-256 与原记录逐字节匹配；不回写原工作区。新增的 model tool policy origin 测试已 3/3 复验后纳入。
- detached checkout 为 `lime-release-v1.159.0-source-e5umkzon`，完整路径在 `frozen-source-path.txt`；未创建分支、commit、tag 或推送。APFS clone 复用构建缓存字节，独立 target/dist 承接后续写入；原索引与源码不覆盖。
- 原 current retry 的四组静态回归及 unknown-item 单场景通过，发现源码变化后暂停本轮聚合父进程，等待当前子场景正常退出后仅终止该自有父进程，exit143；不算 22 场景聚合通过，不终止其他进程。原件 `current-fixture-retry.log` 保留。
- 独立候选版本检查、完整 `npm run typecheck`、`npm run test:contracts` 均 exit0，收据 `frozen-typecheck.log` / `frozen-contracts.log`；独立 `git diff --check` 通过。为降低与原工作区重型编译的资源竞争，临时暂停仅本轮聚合父进程，当前 Vitest 子组正常完成；类型检查通过后已 SIGCONT 恢复，不改变参数或时限，无本轮父进程仍挂起。
- 完整 current fixture、标准 GUI smoke 与最终候选审阅以该固定来源为准；既有 474+3、Rust 43 和 CLI 9 结果只按原 SHA lineage 复用。
- 固定 Renderer 构建成功，7,112 modules、31m42s；Host 类型检查、主进程/preload 构建及资源复制通过。随后 sidecar 因复制的 Cargo V8 build-script 输出保留原工作区绝对 link-search 路径而 exit101，聚合 exit1；独立静态库实际存在，原失败日志保留 `frozen-current-fixture.log`。
- 仅复制已校验的官方 V8 归档、binding 和 checksum 到本轮私有缓存，三个文件与标准缓存逐字节 SHA 一致；通过既有 `LIME_RUSTY_V8_CACHE_DIR` 入口让 build script 重新生成当前 target 的路径。未修改产品代码、依赖、校验、断言或超时。重试 `frozen-current-fixture-retry.log`，仅本轮 Cargo 并发限制为 2，避免继续挤占本机内存。
- 远端预检 main 仍为起点，v1.159.0 tag/Release 不存在；五个 npm 目标版本均返回 404，尚无同版本占用。固定候选 122 路径、7 metadata 与115产品/测试/脚本/文档；审阅补丁已排除缓存，暂存区仍为空。
- 私有缓存重试后 sidecar 构建成功，6m44s，V8 link-search 已指向独立 target；macOS 原生宿主资源也成功生成。fixture 隔离 HOME 后 Rustup metadata 重新联网查找工具链，已保留首个完整通过的 unknown Item 收据，随后仅终止本轮尚未进入 Electron 的后续调用及聚合（exit143），不计聚合通过；通过本轮进程级 RUSTUP_HOME/CARGO_HOME 指定既有工具链，应用数据仍隔离，不修改全局环境或产品配置。
- 工具链环境明确后四组静态368项再次通过，首七个 Electron 场景完整通过；第八个 approval resume 的业务、协议生命周期均通过，但 Main 正常退出超过既有15秒，聚合 exit1。原收据保留 `approval-resume-initial-failure.json`，不把业务通过写成完整场景通过。
- 从固定源码聚合入口抽取第八至第二十二个场景的原始调用，保留 build owner、全部参数、断言和时限，作为忽略证据目录的临时续跑 runner；未加入产品构建图。15项续跑 exit0，approval resume 正常退出精确复验通过，合并首七项形成22/22实际场景覆盖，不声称原失败wrapper整体通过。来源与摘要为 `current-continuation-lineage.json`、`frozen-current-continuation.log`、`gate-b-receipts.json`，22份最终summary逐一 ok=true。21份Claw收据另有业务断言、teardown及Main exit0/no-signal结构化证明；Coding Workbench入口无同等结构化退出字段，其业务与清理日志单列，不把它算作第22份正常退出证明。
- 已在同一固定源码启动标准 `npm run verify:gui-smoke`，日志 `frozen-gui-smoke.log`；沿用既有构建入口，等待最终结果。未放宽任何性能预算、退出时限或断言。
- 标准 `npm run verify:gui-smoke` 最终exit0；真实Electron/preload/IPC/App Server版本1.159.0、workbench shell、reload、3视口、memory settings通过。run_id `standalone-shell-01-20261016150616-6327`，完整收据复制为 `gui-smoke-summary.json`，原日志保留。

## 确认后收口记录

- 用户明确回复「确认」；本轮继续执行固定122路径候选及全部GitHub/R2/npm发布，不再次请求同范围授权。远端main复核仍为d6dc866ea8f636dd4367eff86e84aa383a26016c，v1.159.0标签不存在。
- 确认后发现原工作区`.lime/release/v1.159.0/`及其中历史日志已缺失，原因未知，本轮未执行删除。候选独立worktree与源码完整，两份关键产品文件SHA-256与冻结记录一致；从该worktree重建122路径显式manifest，未采用原工作区后续版本。
- 独立worktree仍保存22份ok=true的Electron业务场景summary与标准GUI smoke原始summary，已复制备份并重建收据索引。历史typecheck/contracts/定向/Rust/CLI原始日志及首次退出失败原件无法恢复；上文结果仅作为当时工具执行记录，不伪造日志或为恢复日志重复重型验证。

## 2026-10-17 CI 修复与全部递交

- 用户明确要求修复 [Release 38924633266](https://github.com/limecloud/lime/actions/runs/38924633266) 并「递交所有」，授权全部当前产品/测试/文档改动与修复的正常commit/push；既有外部分析文件、tsbuildinfo缓存仍排除，不移动已推v1.159.0标签。
- 已推发布源码`6fbb8c1b5deb5ae9b618150851e8c0395b61fb65`，122路径与manifest逐字节一致，正常pre-commit 120项通过。main/tag远端实读一致；原工作区索引及main无损同步，所有工作区字节保持。
- [Quality 38924620058](https://github.com/limecloud/lime/actions/runs/38924620058) 整体success。Release的Windows与macOS arm64构建及packaged门禁success；macOS x64三次Forge package均在stapler失败，底层`api.apple-cloudkit.com`连接丢失（NSURLErrorDomain -1005），code68。无证据表明源码编译或公证拒绝。失败原日志保存在`.lime/release/v1.159.0/ci-repair/release-failed.log`。
- 已请求原Release失败作业重试，保持原标签与源码；此重试不包含随后main的新产品改动，后者进入下一候选。
- 窄修复写集：Forge、既有release guard/Forge测试、新macOS notarization helper及回归、package/pnpm lock和本计划。将官方`@electron/notarize@2.5.0`显式声明为既有精确版本依赖，由Forge postPackage在签名后、maker之前调用。仅已Accepted之后的CloudKit/staple68故障在同一签名bundle最多五次递增退避重试，永不重签或重新提交；每次最多60秒，最终stapler validate仍阻断，签名/凭证/拒绝/无效票据均fail closed。品牌修改仍在签名前。
- current：Forge官方packager/makers与官方notarize；新增compat/deprecated为零；deleted为packager内无法复用已接受票据的公证调用接线，不恢复旧发布器。KISS/DRY复用官方签名公证；SOLID将票据恢复隔离；不新增账号、运行时或业务authority。
- 当前工作区App Server/CLI共享请求重构仍有外部验证进程，本轮不覆盖其源码或停止进程；全部递交前读取最新测试收据与源码摘要，按实际结果记录。
- 本轮完整`npm run typecheck`与`npm run test:contracts`均exit0；版本、脚本治理和严格lint通过。定向四suite68项通过，新增native stderr形状回归后notarization九项全部通过，合计69个独立用例。精确pnpm9.15.9在隔离manifest目录以offline/frozen-lockfile/ignore-scripts校验exit0，未触碰共享node_modules。日志均位于上述ci-repair目录。

- 全部递交候选67路径（不含既有外部分析文件与tsbuildinfo缓存），暂存diff 6527增/3058删。App Server整库新结果1877 passed/0 failed/0 ignored，包含三项response/interrupt/resume竞态回归；日志`/tmp/lime-shared-backend-s02-resolution-tests.log`。CLI bin既有110项与shared-client/stdio/MCP fixtures按共享后端计划的源码lineage记录。
- 并行current fixture原wrapper完整通过，368静态及22真实Electron场景；日志`/tmp/lime-shared-backend-s02-current-fixture-pinned.log`。其固定App Server SHA为44e73da58cd4d7d8011725ce3d036048f84c243d89251a86f2ea13ab5c8cc72e，早于最新response结算重构，不能冒充最终源码GUI证据；最终main的GUI/全量Quality待远端实读。

- 修复与全部67路径已正常hook提交`8fffa6b9d202c82d94fe45babafad6e4f2babf3e`，67项hook通过、manifest全部匹配，已push main并实读远端SHA。标签仍精确指向6fbb8c1b5，未覆盖。新Quality 38932033381执行中；Integrity、lint、typecheck已通过，其余按最终结果记录。
- 发现共享后端三份当前计划/领域账本/审计文件被既有私有计划忽略规则排除，但已被本次README导航引用；按用户「全部递交」授权显式补交这三份必要事实源，不批量纳入其他忽略的历史计划或证据。142条本地链接有效。
