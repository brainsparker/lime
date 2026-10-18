# v1.161.0 发布执行计划

状态：active，候选已冻结；本地必要静态/前端门禁通过，准备提交 main 启动该 SHA 的远端 Quality；标签须等待远端质量与本地桌面冒烟结果。

## 目标、候选与写集

- 用户要求发布 v1.161.0，包含当前工作区全部产品、测试和文档改动；基线为 main/origin/main `ece78016447ec973108e606e30993baa84933430`（v1.160.0）。远端目标 tag/Release 均不存在。
- 冻结源码副本：`/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-release-v1.161.0-hnxezgpo`。独立 Git 数据、index、构建输出和 Cargo target；起初只读复用第三方依赖；发现断链后已按冻结 pnpm lock 在副本独立安装，workspace package 链接指向冻结副本，不创建 worktree 或开发分支，不终止用户进程。
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
