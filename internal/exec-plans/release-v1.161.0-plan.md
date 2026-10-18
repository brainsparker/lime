# v1.161.0 发布执行计划

状态：active，候选已冻结并已推送main；正在修复远端门禁发现的问题。标签须等待最终候选SHA的Quality与真实GUI冒烟通过。

## 目标、候选与写集

- 用户要求发布 v1.161.0，包含当前工作区全部产品、测试和文档改动；基线为 main/origin/main `ece78016447ec973108e606e30993baa84933430`（v1.160.0）。远端目标 tag/Release 均不存在。
- 当前固定候选：`/Users/coso/Documents/dev/ai/aiclientproxy/lime-release-v1.161.0-candidate`（首次临时冻结目录与迁移记录见本计划及本地freeze收据）。独立 Git 数据、index、构建输出和 Cargo target；起初只读复用第三方依赖；发现断链后已按冻结 pnpm lock 在副本独立安装，workspace package 链接指向冻结副本，不创建 worktree 或开发分支，不终止用户进程。
- 本轮直接写集：package.json、packages/cli/package.json、lime-rs/Cargo.toml、lime-rs/Cargo.lock、双语 RELEASE_NOTES、执行计划与 README 当前发布指针。业务代码只读纳入候选；失败后的必要修复另登记。
- 排除沿用上版的 `local-conversation-page-a83a1af2c24b.js` 与 `tsconfig.node.tsbuildinfo`；冻结后的并行变化单独列出，不覆盖或无验证合入。
- 用户说明旧 `.lime` 为主动清理。本版重新生成验证收据；历史计划的通过结果不作为本次候选通过证据。
- 证据目录：原工作区与候选内的 `.lime/release/v1.161.0/`，保存冻结清单、哈希、候选补丁、验证日志和排除清单。执行结束前核对身份与候选漂移。

## 发布内容与分类

- current：专业文件预览/批注与已实现编辑保存、插件市场/远程获取/共享、账号与云端 App Server 合同、设置草稿和队列重排；唯一主链保持 Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item。
- release metadata：版本统一为 1.161.0；双语说明只保留本版。pnpm lock 无 root 发布版本，Forge 和 App Server release manifest 继承 package version。
- compat/deprecated：本轮不新增；dead/deleted：候选中的旧工作区预览与重复账号会话路径直接替换，具体删除清单由 Git 候选记录提供。
- 架构图确认沿用 architecture.md 和各领域责任计划已有确认；本轮 metadata 更新不改变业务 authority。尚未验收的完整插件远端闭环和整体 GUI 对齐不核销。
- KISS/DRY 复用现有发版入口；SOLID 保持领域 owner；YAGNI 不新增发布器、兼容层或平行后端。

## 验证与退出条件

1. `verify:app-version`、完整 `typecheck`、`test:contracts`；受影响前端/Rust 定向及公共 JSON-RPC 测试。
2. Agent current fixture 先于标准 `verify:gui-smoke`，补受影响账号、插件、专业文件、设置和队列真实 Electron 场景；CLI/TUI 依据候选风险补对应证据。
3. 只报告实际执行成功的证据；macOS 本地不代表 Windows、安装包或 live provider。失败定位、修复并定向重验，不绕过 hooks 或降低合同。
4. 汇总候选、排除项、暂存预览和门禁后，依用户最新明确授权直接连续提交、打 tag、推送并核对远端，不再请求确认。
5. 跟踪远端 Quality/Release 和 GitHub/npm/updater 资产；仅触发 workflow 不算完整发布。当前完成度：准备中，待补验证收据。

## 验证执行记录

- `npm run verify:app-version` exit0，版本 1.161.0；`npm run test:contracts` exit0，协议生成无漂移，命令、harness、模态、脚本、发布、Desktop reference、CLI 和 docs 边界全部通过。
- 原工作区 6 个专业文件依赖是指向已清理 `.lime/dependencies` 的断链；副本使用固定 pnpm 9.15.9、`--frozen-lockfile --ignore-scripts` 独立恢复全部依赖，无 lock 漂移，不修改原工作区依赖。默认 corepack 遇旧签名 keyid 错误，改用 npx 固定版本执行，没有更改全局工具。
- 独立 Electron 安装已完成，二进制存在；首次测试与安装并行引发导入失败，安装完成后整批重跑。首次共享依赖测试与两个同步文件/生成器进程测试遇宿主负载超时；只对这两个进程测试文件设置 CLI 30秒预算，内部断言、20秒子进程期限与产品场景期限保持原值。
- Node 专业文件 3 文件29项、CLI npm 9项均 exit0。完整 TypeScript、168个受影响 Vitest、8个Rust crate及公共协议验证进行中，未完成项不记通过。

- 候选已暂存于独立副本：746路径，106076新增/8249删除行；staged diff check exit0，正常预提交守卫 exit0（平均99/100），原工作区index保持未改。
- 前端最终批1：12文件268项通过。批2：11文件通过，1文件13项中的首项因默认5秒宿主期限超时（10.7秒），其余127项通过；无业务断言差异。失败与首轮Electron安装竞态均保留日志，后续仅补失败文件及剩余批次。
- 2026-10-18 10:39本机16GB内存约15GB使用、6.7GB压缩、CPU idle0.71%、load38.49；为避免增加换页，已结束本任务Rust与Vite构建，保留已完成编译缓存；不计通过也不计软件断言失败，待类型检查后按相同命令续跑。其它开发进程没有终止。

- 完整 `npm run typecheck` 已于本轮独立依赖候选 exit0（renderer + node）；不依赖初次共享依赖或单独Electron检查。168个受影响Vitest已通过23文件，其余按既有结果续跑；只补批2失败文件，宿主级unit测试CLI预算30秒，产品内部期限不改。

- 实际阻塞修复：能力矩阵引用的 `codex-method-scope-reassessment.md` 原文存在但被gitignore排除，冻结复制遗漏。已窄补 `.gitignore` 例外并纳入该原文（SHA256 334ccaf624130f429161a5f1d920a7cd425129d196e63f450d7d85edc2ad9ca6），不改矩阵/证据断言或业务源码；候选新增1文档，共747路径。其余所有矩阵evidence路径均存在。补相关治理回归。

- 字节摘要修复窄写集：`src/lib/artifact/fileRevision.ts` 与既有测试。Node VM最小复现证明跨realm的ArrayBuffer被WebCrypto拒绝、Uint8Array视图可接受；保留slice防御复制后直接传view，不增加转换器/兼容分支。补跨realm原字节子范围回归，既有detach/非UTF8/空文件/缺失crypto断言保留。将补文件摘要、PDF/工作簿/幻灯片/批注相关回归和完整typecheck；之前同owner通过结果不冒充修复后证据。

- 后验前端续跑：工作簿/账号/云端/设置23文件271项通过，PDF/DOCX/幻灯片前批24文件通过；74种内置表格样式150项已通过。两个批次因Vitest worker `onTaskUpdate` 通信超时中止，仅保留实际执行通过的文件，未执行文件拆小批补验，不将整个失败批次记为通过。
- 夹具生成测试的 `registerHooks is not a function` 来自本机shell Node23.4缺少较新Node API，CI使用当前Node22；补验将使用本机已安装Node24，不修改业务断言或全局Node配置。
- 2026-10-18 11:26宿主load72、CPU idle0、15GB内存使用、6.5GB压缩；本轮重型类型检查/Rust/renderer构建保持串行，不结束其它开发进程。完整typecheck在摘要修复后重跑，前次结果不代替后验结果。

- 夹具补验窄修复：`presentation-table-builtin-scenario.test.mjs` 的suite预算从20秒调整为120秒。当前Node24已支持registerHooks，原20秒在满载宿主下连续截断真实Worker/ZIP/DOM测试；只调整unit宿主预算，所有保存、20格内容、主题、ZIP与逐格renderer断言不变，生产与Electron场景期限不变。格式测试通过CLI同样使用120秒宿主预算。仍需在同一候选完整补验，超时记录保留。

- 已核对基线Quality run39007422009：Frontend Full仅能力范围旧断言失败（本版scope14项已通过）；Rust Full的media_task_jsonrpc有2项因`turn/start`合法通知导致lines.len=2而非1失败，其余6项通过。原日志保留在候选`previous-quality-failures.log`。
- 因实际CI失败追加窄写集`lime-rs/crates/app-server/tests/media_task_jsonrpc.rs`：Turn helper复用现有允许通知的请求路径，按ID选响应并加强“匹配ID恰好一个”的断言；保留任务写入/拒绝、dynamic tool终态和同identity的turn/completed断言，不修改生产行为。候选747→748路径，待完整8项public JSON-RPC复验。

- 摘要修复后的完整`npm run typecheck`已exit0，renderer和node两部分全部通过（Node24.21.0，`typecheck-final.log`）。满载宿主约25分钟完成，采样显示2.8GB占用及实际执行/GC，未替换为局部类型检查。
- 已执行通过的受影响Vitest去重166文件2964项；剩2个表格夹具文件以Node24、单worker及120秒unit预算补验。已通过的74种样式150项与其余文件不无差别重跑。

- 受影响前端验证完成：168文件2978项全部通过。剩余2个夹具文件Node24完整14项exit0（`fixture-node24-final.log`），不再将之前宿主/API失败记为未关闭；原失败日志保留。
- 副本最新暂存覆盖748/748候选路径，无遗漏或意外路径；预提交验证737通过/0失败、平均99分，格式差异检查通过。原工作区index未操作。
- 用户追加明确授权：“你不要找我确认,全部发布”。该最新指令覆盖此前AGENTS/skill确认要求，后续commit/tag/push及既有发布流程直接执行，不再请求确认；禁止覆盖已有远端tag的保护仍保留。取得最终门禁结果后连续发布并核验真实产物。

- 2026-10-18 12:43宿主CPU idle0.19%、15GB内存使用、6990MB压缩，Rust编译阶段已受明显资源限制，尚无单测执行结果。仅终止本任务cargo/rustc，保留日志和缓存；未终止其它开发进程。剩余8 owner单测/公共JSON-RPC/CLI单测交由发布候选SHA的远端Quality验证，不记本地通过。先提交并推送main以启动Quality，本地继续构建当前产品二进制及Electron场景；仅在结果通过后创建并推送tag。完整typecheck、2978项受影响前端测试与合同门禁已通过，无降级。

## 按用户当前工作区补齐发布候选

- 用户指出原工作区仍显示892个改动；核对该数字相对旧本地HEAD，实际与已推送e2a8d7006的内容差异为210路径。先备份原index，再以mixed方式同步到已推送main，仅更新HEAD/index，不检出或覆盖工作文件。
- 用户此前已授权“全部发布”，因此将当前全部产品差异再次冻结为补充候选，不再沿用首次快照排除后续产品变更的范围；补充冻结清单/哈希见`.lime/release/v1.161.0/freeze-supplement.json`。本次捕获210路径，保留排除两个本地生成文件；7个旧首页/侧栏文件删除，采用现有current owner。后续变化继续保留原工作区。
- 补充包含桌面退出异步清理、窗口样式、首页/侧栏/设置导航、工作树提交和执行范围交接、插件技能预览、真实剪贴板场景及协议/五语言/测试同步。共享后端authority与owner不变；架构和责任计划随产品写集纳入，无新增compat/deprecated。
- e2a8d7006的本地2978项测试、完整typecheck和远端Quality结果仅证明首轮候选；不冒充补充候选验证。因宿主资源限制，补充候选的完整typecheck、前端、Rust、Bridge、GUI和Windows均以新提交SHA的Quality为发布标签前门禁；本地补定向轻量测试。未创建或推送v1.161.0标签。

- 完整候选相对v1.160.0为887路径；补充后的三组Node剪贴板/工作簿/富文本场景测试exit0，版本一致性exit0。候选临时目录发生9个未改动受控文件与依赖丢失，已移到`/Users/coso/Documents/dev/ai/aiclientproxy/lime-release-v1.161.0-candidate`并去除证据目录symlink；仅恢复缺失受控文件，固定pnpm9.15.9按原锁文件独立恢复依赖，无锁漂移。210项补充源码哈希核对无差异，计划末尾仅清除多余空行。

- 补充候选7f0da44的Quality run39099269268完整typecheck/Lint/合同/Integrity通过，Frontend Full在批3因共享页面fixture缺少`ensureProjectWorkspace`导出导致index16项初始化失败。窄修复index.testFixtures.tsx：显式提供当前API mock，默认拒绝未配置worktree创建，并在既有页面测试断言普通会话不创建workspace；不改生产逻辑。index/sidebar/workbench三个文件38项定向复验exit0，后续以修复提交SHA重新执行完整Quality。

- 8939efe的Quality run39099827907真实GUI smoke在记忆设置导航处失败：设置/插件/已安排任务均被NavButton的展开态隐藏规则设为display:none，任务中心还移除了对应test ID。窄修复AppSidebar与现有样式owner，删除隐藏规则和条件定位标识；补首页/任务中心中三入口的可见性与实际跳转回归。仅恢复已有入口，不纳入原工作区冻结后的新rail布局；原并行工作文件不覆盖。此修复需定向测试、完整typecheck和新SHA的Quality/GUI门禁。
- 同一run前端全量至批41发现preferences中5项失败；其中项目会话插件入口由上述定位标识修复覆盖，其余4项仍查找旧全局导航按钮。按现有AppSidebarCustomization迁移到对应子页入口与当前激活语义，保留实际点击回到插件Tab的行为断言，不恢复旧侧栏实现。
- 导航修复后本地全部侧栏9文件107项exit0（含新增首页/任务中心可见性与跳转回归）；完整`npm run typecheck`（renderer+node）exit0，4个变动TS文件定向ESLint exit0。无新增文案、协议或后端owner；等待修复提交SHA的远端全量门禁。
- run39099827907的Rust Full在apps_jsonrpc两项失败：夹具仍用portable标准包声明Apps，而current合同与既有负向单测明确标准包仅保存Apps元数据、不启用组件。将该Apps公共JSON-RPC夹具改为native `.codex-plugin/plugin.json`，保留所有分页、安装/卸载、通知、禁用与不可访问断言；不修改生产行为。此项另补定向Rust验证，并以最终SHA远端全量为准。

## 用户追加最新更新

- 用户再次明确“还有最新的更新也要一起递交啊”。在87c70d0基础捕获109路径，包含持久图标rail/AppShell、首页旧推荐链删除、后台会话恢复、插件技能预览查询缓存、五语言与相关测试/文档；精确快照和逐文件哈希落在`.lime/release/v1.161.0/freeze-latest.json`。继续排除两个本地生成文件，冻结后的变动保留原工作区。
- 前一轮39100767112已证明记忆设置恢复可点击；Frontend Full到批66因Plugin方法清单漏`plugin/skill/read`失败，225项定向治理回归补齐后通过。GUI已完成真实导航和记忆操作，但layoutGeometryStable失败，不能记作GUI通过；新候选需重新验证最新布局，并补失败几何数据日志及CI artifact保留，断言不降级。
- 独立候选按新增依赖锁文件恢复环境，原工作区依赖不改；先定向验证最新侧栏/首页/插件与完整typecheck，再推送最终SHA运行Quality。不得用87c70d0之前结果代替最新写集。

- 最新候选本地定向回归30文件568项全部exit0（单worker，原测试期限；`latest-tests.log`与`latest-test-results.json`）；版本一致性exit0。相对v1.160.0完整候选938路径（含删除），暂存清单/逐文件哈希审计无非预期漂移；本次相对87c70d0为114路径。完整`npm run typecheck`（renderer+node）exit0（`latest-typecheck.log`）；远端Quality/GUI及Release产物未完成，不记作发布成功。

- 最新产品提交3290a2519通过正常预提交守卫（91通过/0失败，平均99分）。前轮39100767112的Rust Full已证明Apps两项、media八项与远程插件49项通过，随后skills_jsonrpc一项仍断言响应内联通知而失败。窄修复该测试：请求前订阅真实outbound，按skills/changed事件等待并断言空params，保留替换/清空/无效根目录及技能投影断言，不修改生产逻辑；与既有marketplace/apps公共JSON-RPC通知合同一致。定向Rust验证及最终SHA远端门禁仍需完成。

- run39102645544的GUI几何证据明确：980×680时inputbar-core底部713.05，超出680窗口约33px；1536/1280其余必需节点通过、Composer高度差40px通过，不能降低withinViewport断言。窄写集EmptyStateLayout/EmptyStateHero，采用原工作区该owner的后续grid修正（两文件独立快照`freeze-layout-followup.json`），按剩余高度分配Hero、底部Composer并收紧短Hero排版；无API、文案、协议变动。此前临时四条CSS补丁未提交，已留差异并由current布局直接替换。独立候选本机标准GUI与定向复验进行中。

- 本机prepared V8环境下skills_jsonrpc完整4项exit0；grid首页3文件49项和两生产文件ESLint exit0，工作区护栏/执行范围/后台恢复5文件51项exit0。设置未保存导航夹具将Home/Root移到真实全局navigation hook，SettingsNavigation mock只保留current Section/Back合同；14项全部exit0，保留失败保存、异步编辑、取消/丢弃和未应用SOUL保稿断言。
- 本机标准`verify:gui-smoke` exit0（`standalone-shell-01-20261018063042-921`，真实Electron/App Server、reload、memory、原三尺寸均通过；980×680 core bottom=602，composer高度差40）。截图复核发现grid迁移后宽屏Composer需补justify-self:center，已窄补，待最终SHA远端三尺寸再次验证；不把该一行前的截图提升为最终像素布局证据。
- 远端1ff0e34的Rust Full与Windows Shell Runtime已全量success。前端到76/137仅两个过期工作区字符串断言，已迁到executionScope优先和已删除首页恢复链的负向守卫；其余15文件130项通过。候选旧node_modules.shared依赖备份导致本机发现额外492个第三方测试，已只迁入候选.lime忽略目录，恢复与CI相同137批清单，不改产品、发现器或断言。按owned清单从76续跑；静态扫描一次5秒宿主超时保留，原期限重试76/132项通过。

- 本机137批清单续跑到77批：14文件82项通过；两个演示文稿文件共3项遇5秒宿主超时，尚未算通过。后续补验启动前发现候选依赖再次缺失（tinyrainbow与Node类型），78批在pretest类型依赖检查即退出，未执行产品测试。已从候选HEAD仅恢复9个缺失受控配置文件，并按原锁文件修复独立候选依赖；不修改原工作区、不改变锁文件或全量CI测试期限。最终发布仍以新SHA完整Quality为硬门禁。

- 7362a4720的Quality run39105120132：版本、Lint、完整renderer+node类型检查和真实GUI smoke通过；三尺寸几何全部通过（980×680 core bottom602），1280/980截图复核输入区完整、宽度居中，1536截图为启动过渡帧，仅声明该尺寸几何通过，不作为完整像素验收。Rust仍执行中。前端前96/137批通过，97批仅EmptyStateComposerPanel的Plan/Goal隐藏标识opacity断言失败，其余15文件205项通过；根因为jsdom22不支持@container，前一EmptyState文件生成的全局styled样式污染后续文件。窄修复测试fixture：每次挂载使用独立StyleSheetManager target并随root清理，保留原opacity=0和真实关闭事件断言，不改生产CSS、期限或全局测试配置。待同批复验及新SHA全量CI。
- 本地续跑的表格样式、结构、主题和HTML边界测试出现宿主5秒/RPC超时，远端run39105120132已在原期限完整通过相应文件，故本机失败日志保留为资源限制，不作为业务失败或全量通过。新建状态的文件排序漂移已发现，后续只按固定持久清单或精确文件集合续跑，不混用不同清单的批次编号。

- 样式隔离修复后首页与输入区两文件65项全部exit0（含原Plan/Goal opacity与独立关闭断言），fixture的Prettier/ESLint均exit0；原CI失败保留为前验，使用CI第97批精确16文件清单追加整批复验，避免重新收集后批次顺序漂移。

- CI第97批精确16文件复验exit0：206项全部通过，保留所有原断言与原测试期限（home-style-isolation-batch97.log）。候选增加必要测试fixture路径，共942路径；发布前仍等待修复SHA的完整Quality，未创建v1.161.0 tag。
