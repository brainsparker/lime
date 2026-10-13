# v1.156.0 发布执行计划

状态：completed。发布完成度：100%。目标：完成 v1.156.0 的提交、tag、main/tag 推送、多平台发布及结果复核。

最终发布源码：`b7e5ee724ff6f116a9cbf4aaa96d0da4568efdd9`，tree `740cf2194501644e77ecccd661af85cb21c26def`；本地与远端 `v1.156.0` 均指向该提交。正式下载入口：[Lime v1.156.0](https://github.com/limecloud/lime/releases/tag/v1.156.0)。以下过程记录中的阶段状态仅代表当时进度，最终结果见文末。

## 授权与写集

- 用户要求「发布 v1.156.0」「我出去了,你完成发布」，并明确「不要找我确认」；授权本轮必要 release commit、tag、推送和发布收口，不重复请求确认。
- 起始 main/origin/main/v1.155.0：`78cf2598d46873711ba6a603169b1d63487c6a36`；目标 tag 本地和远端均不存在。
- 起始 tracked/untracked 产品、文档、测试、schema 和脚本改动默认全部纳入发布候选。上一版本已发布，Release workflow 已成功。
- 本轮窄写集：root/CLI package version、Cargo workspace/lock version、双语单页 release notes、本文；保留已有 PowerShell grammar 依赖及其它产品改动。
- 本地排除项：`local-conversation-page-a83a1af2c24b.js` 是外部 Codex 页面分析生成物、无仓库消费者；`tsconfig.node.tsbuildinfo` 是 TypeScript 增量构建缓存。二者保留本地，不作为发布源码。
- 通过独立索引固定完整候选 tree 与逐文件 SHA256；验证不覆盖其它产品写集，冻结后新增变化保留工作树差异，不自动混入已验候选。

## 发布内容与领域边界

- 后台 Command 在 GUI、CLI、TUI 共用实际进程 identity、输出、续接与 canonical 投影；恢复后继续消费原通知，保留草稿和最终输出。
- CLI SIGINT、中断、session 卸载和 transport EOF 走共享 runtime 取消、输出排空与进程回收。
- Bash/POSIX 和 PowerShell 权限依实际 shell/argv 与字面量语法解析，普通文本避免危险命令误报，未知动态语法沿既有审批合同处理。
- GUI 对话内容搜索、Skills 启停及设置入口；同步五语言与相关稳定回归。
- current：Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item；provider、tool-runtime、App Server 和 store 继续由既有 owner 演进。
- compat/deprecated：无新增双轨；deleted：重复 helper 和旧全文权限匹配等入口由产品计划记录；test-only：本地 provider、stdio/PTY/Electron fixture。
- 架构依赖方向不改变。已有产品架构及责任 root 确认见 `architecture.md`、全局对齐和 TUI/CLI 计划；本轮发布只更新 metadata，不新增业务 owner。

## 退出条件与验证

1. 所有发布版本为 1.156.0，双语 release notes 只保留目标版本。
2. `verify:app-version`、完整 `typecheck`、`test:contracts`、受影响 frontend/Rust/脚本测试通过。
3. 固定源码新构建，真实 stdio/CLI/TUI、GUI current fixture 与 GUI smoke 按实际边界记录；失败先修复或定位，不冒充全平台通过。
4. 正常 pre-commit 通过，commit/tag/main/tag push 完成；远端 tag 和受测候选身份一致。
5. GitHub Release 多平台构建、签名/公证、下载资产、R2 updater 和 CLI npm 发布复核；触发 workflow 不算完整发布。

## 进度

- 完成初始盘点与 release candidate 分类；具体文件清单、源码、摘要及日志存入忽略目录 `.lime/release/v1.156.0/`。
- 发布版本、release notes 和固定候选准备中；门禁与远端结果随后回填。
- 未运行平台、live provider 和完整 Codex 视觉对齐不由本地 macOS 源码证据替代。

## 固定候选与首轮验证

- 完整候选固定为 315 个改动路径，源码 tree `d6fa139fe55e7044de0dad56a545555874e52086`；独立索引、源码和 SHA256 见 `.lime/release/v1.156.0/`，不会从 rename 新路径清单重建提交。
- 盘点时另一协议生成器正写入 `protocol-types.ts` 的未格式化中间态；逐文件摘要核对发现唯一差异，已恢复与 HEAD 一致的稳定生成结果。完整 `test:contracts` 复验通过，无协议语义变化。
- 完整 `npm run typecheck`（renderer + node）、Electron typecheck、版本一致性、contracts、Cargo fmt --all --check 全部通过。
- 前端相关测试的首个入口受 `.lime` 生成目录排除/related dependency graph 影响，出现 EISDIR；将同一固定源码放到独立临时目录并运行实际受影响测试，54 文件、440 项全部通过。没有修改产品断言。
- 初次脚本/包验证使用了错误 runner 且缺少内部包构建，脚本失败日志保留 `scripts-initial.log`，首次包构建失败由工具记录及 `packages-initial-failure.json` 摘要保存。改用各 package 官方 test 入口并将依赖指向固定候选生成物后通过；Vitest 脚本回归已包含在上述 440 项。
- 内部 contracts/client 与 CLI npm launcher/staging 测试通过；五语言检查 8701 source keys、34804 translations、missing=0、extra=0，覆盖100%。
- 正常 pre-commit 同入口预检查315项通过、0失败；Rust owner、真实产物与交互门禁继续进行，尚未 commit/tag/push。
- 独立 APFS clone Rust target 避免与现有开发进程争用写集；不停止用户或并行 Agent 的进程。冻结之后的工作树变化只记录和保留。

## 发布门禁修正与资源约束

- 本机16 GiB内存；并行编译/Renderer构建使swap接近15 GiB。仅停止本轮独立Renderer构建，保留 `renderer-initial.log`；剩余重型任务串行，后续Cargo jobs=2，不终止其它开发进程。
- 定向ESLint发现旧 action terminal set、review summary残留参数未使用，以及文件面板混合导出纯函数的3项Fast Refresh warning。删除残留、将选择函数直接迁入 `workspaceFiles.ts` 并同步全部消费者；不新增compat re-export。
- 清理同名局部变量时首次删除位置错误，lint/typecheck发现未定义引用；已修正为只删除不再使用的Dialog局部变量。失败结果保留 `frontend-fix-correction.log`；最终测试、完整typecheck与lint重新收取，未绕过门禁。
- `governance:architecture-confirmation` 是PR专用入口，依赖PR body/base与已提交diff；本轮release没有PR event，首次调用明确失败。该检查不作为本地release入口，现有架构责任确认和图已包含在候选文档；最终GitHub push门禁按实际事件处理，不伪造本地PR绿灯。

## 本地静态与 owner 门禁收口

- 最终定向ESLint覆盖151个原候选JS/TS文件及新 `workspaceFiles.ts`，exit0、无warning；最终Workspace相关38项回归和完整 `npm run typecheck` 均exit0。
- 五个Rust library owner全绿：App Server 1821、CLI lib 8、Agent 278、tool-runtime 502、TUI 1882，共4491项；单线程串行，未使用旧版本测试可执行文件。
- 内部包/CLI npm验证共70项（contracts 36、runtime client 25、CLI launcher/staging 9）通过；前端440项及修正子集38项是重叠证据，不重复累计。
- 固定候选逐路径摘要核对无产品漂移。最后lint修正只涉及TS owner与纯模块迁移，没有Rust/runtime协议变化；本轮Rust结果仍适用于受测候选。
- CLI/App Server/code-mode-host locked新构建进行中；其后补CLI bin、public JSON-RPC与真实stdio/PTY/Electron gate。

## 构建空间恢复

- 第一次locked production debug build在编译Agent library时磁盘写入失败（Errno28 / rustc LLVM IO failure），`build-disk-full.log`保留；此环境失败没有使已通过4491项owner结果失效。
- 确认本轮私有target增量锁均未占用后，只清理 `.lime/release/v1.156.0/candidate-target/debug/incremental`；共享 `lime-rs/target`、用户缓存/数据、固定源码、测试二进制和日志全部保留。
- 本轮runner设置 `CARGO_INCREMENTAL=0`、jobs=2后续跑，避免重新累积大体积增量缓存；这些变量只影响本轮子进程，不改系统环境或repository manifest/profile。

## 新二进制与真实 stdio 证据

- locked CLI/App Server/code-mode-host新构建最终exit0；CLI实际 `lime 1.156.0`。冻结副本保留runtime libraries并补标准macOS rpath，元数据为 `reviewed-binaries.json`。
- CLI SHA256 `22075932f9521ade7cbb705babf2f3a4344a3715988b83f5cba5a4721286be0b`；App Server `773f4b8fb759e31c208cf06c2ff9327effe597e7a0798aca010401c1a4bd2bff`；code-mode-host `4960a5fbaca1323eb19c8dc2c42a4c1e349ee754e07ead40c6c7f7e7826d6bfe`。
- actual OS shell + runtime backend + public stdio 7条fixture全部exit0：普通调用、跨回合后台stdin、自主完成、自主exit7、typed decline/cancel、idle/active transport EOF与session shutdown。
- 原Command identity、单次开始/完成、原poll/stdin、尾输出、live/read/page/cold完整对象一致；decline/cancel均declined且未启动OS process，shutdown后真实process退出并冷读terminal。
- 这些是受控本地provider、真实runtime/tool/process的证据，`liveProviderUsed=false`；不提升为live模型或Windows实机结果。
- Renderer/Host正在按修正后的固定源码重建，CLI Gate B继续进行；尚未commit/tag/push。

## CLI Gate B 与桌面准备

- CLI Gate B全套exit0（274.86秒），JSON/human SIGINT均exit130；原turn interrupted、command failed、尾输出与进程回收一致。resume/fork/review/images/schema/stdin/output-file/五语言及shutdown三场景通过。
- 外层stdin不是TTY，human双TTY分支明确输出 `CLI_HUMAN_TTY_NOT_RUN`；此分支未验证，不作为通过证据。
- Renderer、Electron main/preload与桌面静态资产构建exit0。GUI current首轮的静态批次通过，随后因缺少desktop resource manifest触发多余sidecar编译并等待Cargo锁；只停止本轮等待cargo，保留 `gui-current-initial.*`，按标准desktop resource owner补齐manifest后复跑。

## 真实 TUI 与公共 JSON-RPC 门禁

- CLI bin 106项、public Command output/status JSON-RPC集成6项全部exit0；后台raw delta、完成/冷恢复、审批失败/decline/cancel及中断输出一致。
- TUI Gate B全套exit0（751.97秒含独立后台命令fixture），实际PTY/键盘/alternate screen/termios恢复，覆盖完成、中断、审批、草稿、恢复、复制、搜索、编辑器、resize/tmux和多Agent共享投影。后台命令在模型回合后实际退出，原identity与用户可见输出一致。
- desktop resource owner生成1.156.0 manifest后，候选与前端副本全部fresh；sidecar与native resource SHA256均核对一致。
- 用户暂停期间GUI current在工作台recovery等待阶段收到页面关闭，console/page errors为空；保留 `gui-current-interrupted.*`及失败summary。不更改断言，恢复后全套复跑，原工作台recovery已通过；后续场景继续运行。

## Electron Gate B 收口

- 暂停后完整current Electron回归复跑exit0，22个真实桌面场景通过，原工作台recovery失败未复现；包含真实GUI输入、首页、图片、stop/continue、审批、富草稿、same-turn steer、Plan、Skills、MCP、媒体、专家、typed retry及文章编辑闭环。
- 后台Command Electron Gate B streaming/rendererReload两场景通过：真实Electron父进程与preload invoke、reviewed App Server 1.156.0、runtime实际shell、原turn/item/process identity、running与tail output、reload后outputDelta/completed通知消费、草稿保留，mockFallbackCount=0、page/console errors=0。
- `gui-command.json`、running与最终PNG已核验，命令输出区域未显示terminal control sequences，raw canonical仍保留原始输出。
- 这些证据是本机macOS + 受控本地provider，不代替live provider或Windows实机结果；Windows后续以远端原生CI为准。正式 `verify:gui-smoke`正在执行，commit/tag/push尚未发生。

## 提交前本地门禁完成

- 正式 `npm run verify:gui-smoke` exit0（176.84秒），重新构建Renderer/Host/sidecar/native资源，真实Electron启动、reload、Settings memory、三尺寸布局全部通过；24/24断言，46次current App Server IPC，mock/legacy/invoke/page/console/crash/unresponsive均0。
- 发布metadata为root/CLI package、Cargo workspace/lock及双语单页release notes；其它产品/文档/测试全部来自固定候选。本次共316个路径。
- 固定后主工作树额外变化为 `internal/exec-plans/codex-global-alignment-2026-10-12.md`、`scripts/app-server/command-status-fixture.mjs`；候选保留二者已验版本，后续变化保留为提交后的工作树diff。分析产物与tsbuildinfo继续排除。
- 本地必要门禁全部通过，继续正常pre-commit、release commit、tag与推送，之后收取多平台远端结果；尚未把workflow触发视为发布完成。

## 远端发布与全量前端修正

- release commit `36b34a0785ec66798dc79a59b2d0ec73cac3ebc1`，tree `ae83d9d4cca6a56380dbed29e3909e2f50b665cf`；main与v1.156.0已推送且远端逐一核对一致。Release run [38330677045](https://github.com/limecloud/lime/actions/runs/38330677045)，原Quality run [38330672768](https://github.com/limecloud/lime/actions/runs/38330672768)。
- 固定checkout未生成Husky `_` wrappers，第一次常规commit没有触发wrapper；随后显式使用同一pre-commit owner入口 `ai-code-verify.ts --files` 检查完整适用路径315项，exit0。未使用no-verify或禁用验证配置。
- 远端Integrity、Bridge/Contracts、全量lint/typecheck/budget通过。Frontend Full在25/121批次发现唯一旧断言：侧栏搜索empty label仍为“没有匹配的对话标题”，实际正文搜索已统一“没有匹配的对话”，与五语言事实源及新dialog测试一致。
- 窄写集只修正 `AppSidebar.search.test.tsx` 的旧文案断言并新增原结果均清空的断言，11项搜索回归与定向lint通过。此修正不改变发布业务源码；保留已推送tag身份，通过后续main Quality确认全量结果，不重打tag。
- 本地从第25批续跑余下全量测试；桌面多平台打包仍在原release source上运行。

## CI 反馈修复与草稿重新构建

- 原Rust Full发现 transport shutdown把Queued也视为active并取消，导致多模态冷恢复队列为空。修复只复用既有 `agent_turn_blocks_queue_resume` 分类，取消Accepted/Running/WaitingAction，Queued仍持久化；不新增owner或协议。公开JSON-RPC队列5项及shutdown5项全部通过，新增断言保证源backend只执行首轮、恢复后完整保留两条排队输入及顺序。
- 原Windows runtime安全/原生shell阶段通过，timeout fixture使用动态.NET静态调用被新literal权限检查正确拒绝。仅将fixture改成允许的 `Start-Sleep -Seconds 1`，保留20ms timeout与canonical exit code断言；最终Windows原生CI继续复核。
- 完整前端续跑还发现旧process-group测试要求隐藏Command output，与本版running/completed output可见合同冲突；同步行为断言并分别检查两条命令自己的输出。27项定向回归通过，余下测试已续跑至121/121。
- 首次本地全量续跑错误继承release Git变量，临时仓库夹具短暂改写本地ref/config，未推送、未改用户工作树；保存fixture commit/config/index证据后用exact expected-old ref恢复main `a85efcea4`、原author与root。第二个启动过早的续跑进程也已单独停止并恢复；所有全量测试子进程现在清除GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE，不触碰共享仓库。
- 并行工作清理了共享Rust target，使private clone缓存中的绝对native library路径失效；失败链接日志保留，后续只为本轮子进程设置private LIBRARY_PATH/DYLD_LIBRARY_PATH，未恢复共享target。队列/关闭回归最终exit0。
- 为防止已发现的队列回归进入正式产物，已取消本轮Release run38330677045；当时GitHub Release仍draft、assets=[]、publishedAt=null。v1.156.0没有正式发布或更新feed，本轮在修复验证后更新草稿的tag/source并重新构建同一版本。不会保留或复用旧源码安装包。

- 修复后 `verify:app-version`、完整typecheck、Cargo fmt全绿；私有V8编译缓存仍引用已清理的共享gn_out路径，标准 `cargo clean -p v8`只作用于本轮private target后重新构建。全量CI以新main提交重新启动，最终tag将在本地新二进制交互复验后更新。

## 最终候选与重新发布

- 修复提交 `b7e5ee724ff6f116a9cbf4aaa96d0da4568efdd9` 已经正常 pre-commit 并推送 main；最终受测 tree 为 `740cf2194501644e77ecccd661af85cb21c26def`，固定候选逐路径与提交核对一致（排除本地 tsbuildinfo 缓存）。
- 最终 locked CLI/App Server/code-mode-host 构建 exit0；实读 CLI `lime 1.156.0`。新 App Server SHA256 为 `7ce83ad3de8417f332b8345f8bf633f2d0ff4784c933b9796d8887c4fd6cd72c`；CLI 和 code-mode-host hash 与前轮相同，全部按最终 tree 冻结到 `reviewed-binaries.json`。
- 新二进制 stdio 七条路径 exit0；后台 Command Electron streaming/reload Gate B exit0，证据确认新 App Server hash、原 identity、真实进程及 mockFallbackCount=0。最终完整 current Electron 回归 exit0（296.76 秒），22 个真实桌面场景通过。
- GUI smoke 第一次复跑复用了前轮 run ID，launcher 读到了旧 summary；该轮日志保存为 `gui-smoke-reused-id.*`，不计入最终交互证据。改用包含最终 commit 的唯一 run ID 后，正式 `npm run verify:gui-smoke` 重新执行 exit0（78.24 秒），新时间戳、24/24 断言、3 尺寸布局和真实 current bridge 均通过。
- 更新 tag 前核对 Release 仍 draft、assets=[]、publishedAt=null、原 Release run 已 cancelled，远端 main 为修复提交、tag 为旧提交。通过 exact expected-old `update-ref` 和 `--force-with-lease=refs/tags/v1.156.0:36b34a0785ec66798dc79a59b2d0ec73cac3ebc1` 将草稿 tag 更新为最终修复提交；远端复核一致，不复用旧源码安装包。
- 新 Release run [38334407624](https://github.com/limecloud/lime/actions/runs/38334407624) 的 head/tag 为 `b7e5ee724`，Prepare GitHub release 已通过，三平台构建运行中。
- 最终 Quality run [38333328639](https://github.com/limecloud/lime/actions/runs/38333328639) 的全量前端 121/121 批次、GUI Smoke、Integrity、Windows Shell Runtime 已通过；Rust Full 继续运行。Windows 原生 timeout fixture、受限执行安全矩阵、App Server 合同与 Agent Plugin MCP parity 已通过，不用本机 macOS 结果替代 Windows 结果。
- 最终 Quality 已 completed/success：全量前端、Rust Full、Windows Shell Runtime、GUI Smoke、Integrity 和 Quality results 全绿。架构确认是 PR 专属门禁，在本次 push 事件按工作流正常 skipped；没有伪造 PR evidence。
- 上一版实际 updater origin 来自已发布的 macOS RELEASES.json，为公开 R2 origin；三平台 feed 均可读取、当前为 1.155.0。后续从实际 origin 复核 1.156.0，不以未使用的默认 URL 代替发布配置。
- 状态仍 active：须继续复核签名/公证、GitHub 14 项资产、R2 三平台 updater feed，以及 CLI npm 四平台包和 root 包发布。
- 新 Release 的 macOS arm64 与 Windows x64 build 已 completed/success。下载并读取远端 Gate B summary：macOS `candidateSha=b7e5ee724`、Developer ID/Gatekeeper/staple 全部 passed；Windows installed Squirrel、desktop resources、CodeMode 和 native host 的安装 identity/资源根/版本/commit/runId 一致，全部 passed。macOS x64 继续构建，GitHub Release 尚未正式发布。
- macOS x64 build 和 packaged Gate B 已 completed/success；下载的 summary 再次确认最终 candidateSha、Developer ID、Gatekeeper 与 staple 全 passed。三平台 build 全绿，GitHub Release 在 `2026-10-13T02:27:54Z` 正式发布（draft=false、targetCommitish=b7e5ee724），9 项桌面安装包/更新 metadata 均 uploaded、size>0。
- 正式发布的两份 macOS RELEASES.json 均 `currentRelease=1.156.0` 且指向实际 R2 origin；Windows RELEASES 为 `7C61BBBDBD6CCA24E35129463F34F3D5AB43794D lime-1.156.0-full.nupkg 360715586`。R2 上传及四平台 CLI npm runtime 构建仍进行中，不能在此处标记完整发布完成。
- R2 publish job 已 completed/success；从实际公开 R2 origin 读取 darwin-arm64、darwin-x64 和 win32-x64 三份 feed，全部实读为 1.156.0，逐字节与 GitHub Release 的最终 feed 资产一致。上传 owner 还逐对象通过 S3 head-object 核对 ContentLength、SHA256 metadata、ContentType、CacheControl；桌面安装包及 updater 已完整发布，四平台 CLI npm 继续构建。

## 最终发布结果与证据边界

- [最终 Quality](https://github.com/limecloud/lime/actions/runs/38333328639) 和 [最终 Release](https://github.com/limecloud/lime/actions/runs/38334407624) 均 completed/success、headSha 为最终发布提交。Release 的 11 个任务全部 success，包含三平台 Forge 安装包、签名/公证与 packaged Gate B、R2、四平台 CLI 包和 npm trusted publishing。
- GitHub Release 已正式发布、非 prerelease，14 项资产名称/数量完全匹配预期，均 uploaded 且 size>0：两套 macOS DMG/ZIP/feed、Windows Setup/nupkg/feed，以及 root + 四平台 CLI npm tarball。tag 的远端 commit 身份一致，无旧源码产物混入。
- R2 共 18 个 stable/versioned 对象通过上传后 hash/长度/类型/cache 检查；三平台公开 feed 均 1.156.0，SHA256 与 GitHub metadata 一致。macOS feed 目标 ZIP 和 Windows nupkg 均为本轮最终产物。
- npm registry 实读 `@limecloud/lime@1.156.0`、latest=1.156.0，optionalDependencies 精确指向四平台包。平台包按既有打包合同使用 `1.156.0-darwin-arm64`、`1.156.0-darwin-x64`、`1.156.0-win32-x64`、`1.156.0-linux-x64`，各自同名平台 dist-tag 均正确。
- 首次临时 registry 审计错误地将平台包查询为无后缀版本，产生 404/断言失败；依据 `build_npm_package.py` 的唯一版本合同修正审计，没有修改已发布包。Windows 版本首次 encoded 查询仍返回 404，随后直接 scoped version 路径和 fresh 查询均读取到已发布版本；最终统一 scoped 路径后完整审计全部通过。失败审计 JSON 保留，不作通过证据。
- 从实际 npm registry 下载 root 与 darwin-arm64 tarball，SHA512 integrity 全部通过，SHA256 与 GitHub Release asset digest 一致；隔离目录按实际 npm package 布局安装后，运行 root launcher 返回 exit0、`lime 1.156.0`。本机只验证 darwin-arm64 launcher，不冒称运行其它 OS 的 CLI 二进制。
- 本轮版本事实源为 root package、CLI package、Cargo workspace/lock；双语 `RELEASE_NOTES.md` / `RELEASE_NOTES.en.md` 为 1.156.0 单页。当前 owner 和 Product Surface -> App Server -> RuntimeCore 主链保持一致；compat/deprecated 无新增；重复 helper/旧权限匹配删除项见本轮产品计划，未恢复已退役 runtime。
- 工程原则：transport shutdown 复用既有 turn 分类（KISS/DRY），只修正排队输入持久化回归与旧断言；权限 fixture 沿原 literal 合同，不放宽审批；未新增并行 runtime、兼容包装或额外业务 owner（YAGNI/SOLID）。
- 验证限制：live provider 明确关闭；CLI human 双 TTY 分支因本轮外层 stdin 非 TTY 未运行。没有新增 Codex Desktop 像素对齐声明。Homebrew 旧 URL workflow 未执行，文档站无本轮 docs 写集，不声明这些额外交付已完成。
- 发布结果、失败修正和实际边界全部落入本文；忽略目录 `.lime/release/v1.156.0/` 保留固定源码/索引/hash、local/remote logs、Gate B summary、公开 registry/feed metadata、最终 `published-audit.json`（ok=true）和 `published-cli-smoke.json`（ok=true）。发布 evidence 仅做文档提交推送，不再移动已正式发布的 tag。
