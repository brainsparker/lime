# v1.164.0 发布执行计划

状态：completed / 本次 v1.164.0 全渠道交付100%；最终候选、Quality、Release、Desktop、R2、四平台 CLI/npm 与正式 CLI 启动已验证，标签固定，收尾提交仅包含发布记录与收据。

## 当前发布状态（74e18a467）

- 目标：完成 v1.164.0 的 Desktop、R2 更新源、四平台 CLI 与五个 npm 包实际分发。用户已明确授权全部已完成候选、正常 commit/main push、同版本标签重定位与完整发布，沿用授权，不重复询问。
- 最终标签固定为 `74e18a467aa975924bef95548df20ff1ce1cbd79`，正常提交 hooks **94/94**；main 与 tag 已推送复核。标签推送起始 UTC 为 `2026-10-20T12:15:27Z`。产品源码冻结于 a692；d32 修复两处测试夹具，74e18 仅追加语言隔离测试和证据，不改产品。后继收尾仅提交本计划、精确白名单和发布收据，不再移动标签。
- 最终全渠道审计 **11/11通过**：公开 GitHub 14个产物的 target/size/SHA256/更新时间、npm 五包的版本/SRI/dist tags/根包依赖、R2 stable/versioned 六份feed逐字节一致、18对象SHA256/size与GitHub逐项一致且公开HEAD大小正确。完整收据 `release-audit.json`；105份证据的摘要与发布边界见 `evidence-manifest.json`。发布链接：https://github.com/limecloud/lime/releases/tag/v1.164.0 。
- 最终完整 [Quality 39420828765](https://github.com/limecloud/lime/actions/runs/39420828765) **success**，Frontend Full、Rust Full、GUI Smoke、Integrity 全部通过。该轮 Windows 质量矩阵按变更检测未重复运行，父候选 d32 的 [39416681327](https://github.com/limecloud/lime/actions/runs/39416681327) 已整组 success；最终 Release 内 Windows 真实安装、CodeMode 与 native-host Gate B 也通过。提交前完整 `npm run typecheck` exit0，不以局部验证替代。
- [Release 39420905140](https://github.com/limecloud/lime/actions/runs/39420905140) 的 macOS arm64、macOS x64、Windows x64 与 Desktop publish 全部 **success**。签名/公证、package resources 与 native host 通过；Windows Squirrel 安装 smoke 通过。公开 Release 的九个 Desktop assets 已逐项复核最终 target、非 draft、正数 size、SHA256 digest 和标签推送后的更新时间。
- 原 R2 job `118647579095` 在 `2026-10-20T13:17:20Z` 上传 versioned macOS x64 zip 时，`CompleteMultipartUpload` 返回 `NoSuchUpload`，当轮仅六个 payload 验证，未发布最终 feed。原始失败完整保留于 `r2-first-failed.log.gz`；整轮仍运行时，GitHub 拒绝单 job rerun，未取消其余构建。
- 随后复用既有 `publish-updater.yml`，基于同一标签启动 [恢复 39429918814](https://github.com/limecloud/lime/actions/runs/39429918814)，该轮 **success**。原始提交与四项 Desktop gates 全部核对后，复用原 staged assets，18个对象全部验证，最后发布六份 feed。独立公开审计已通过：18个对象的 SHA256/size 与 GitHub artifacts 逐项一致、公开 HEAD size 一致；stable/versioned 六份 feed 与 GitHub 逐字节一致。成功原始日志 `r2-publish.log.gz`，恢复 JSON `updater-recovery-run.json`。
- 最终 Release 已在仅重跑原 R2 job 后整体 **success / 11个job全部成功**，首轮失败收据 `release-first-run.json` 与最终收据 `release-run.json` 分别保存；原 R2 重跑再次验证18对象，完整日志 `r2-retry-success.log.gz`。四平台 CLI build/package/upload、npm platform-first/root-last 均成功，公开 GitHub 共14个产物。
- npm正式运行证据：从公开 registry 隔离下载根包与macOS arm64包，校验registry SHA512与GitHub SHA256；三个原生程序的Mach-O arm64头均正确，真实根launcher执行 `--version` 输出 `lime 1.164.0`、exit0。只覆盖macOS arm64版本启动，不冒充其他平台原生运行或CLI完整Agent Gate B。初次查询时另三平台仍被npm服务器处理并返回404，现均已可用。首次审计失败 `release-audit-first.json` 保留；审计脚本SRI前缀误写已改为标准 `sha512-`，不是产品完整性失败，未重发不可变版本。
- npm 后继状态：Windows、macOS x64、Linux 已先后变为公开HTTP200；五包版本、SRI、dist tags 和根包依赖已在最终审计全部通过。处理等待的全部观察保留在 `npm-availability.json`，未重发不可变版本或移动标签。
- 最终审计发现并恢复的公开feed缺口：stable `darwin-x64/RELEASES.json` 一度404，版本化feed仍200/SHA256正确；原R2 retry在14:01:50Z曾验证该stable对象，cleanup明确跳过。原因尚未确认，原失败 `release-audit-r2-missing.json` 与HTTP观察 `r2-stable-feed-observation.json` 保留。仅重跑既有恢复39429918814（attempt2/job118679057198，无cleanup），复用同一候选与staged assets成功；stable公开读取恢复200且SHA256正确，最终18对象/六feed全通过。最终日志 `r2-final-publish.log.gz`、任务收据 `updater-recovery-final-run.json`；恢复成功不等于已根治该公开端点的短暂不可用原因。
- Agnes 3.0 Flash 文字和 Image 2.5 Flash 图片已在真实 Electron 同一 canonical Thread 上验收；设置页 1024/1440/2048 三宽度无横向溢出。旧2.5 Pro仅对当前账户证实上游503/model_not_found，不声明全球退役。原 live fixture 的15秒正常退出失败保留，独立无 inspector 正常退出不抵消该失败。详情见 [Agnes 恢复计划](agnes-model-recovery-20261020.md)。
- 最终问答 `release-v11640-question-final-r2` 整轮 Desktop Gate B **pass**：真实侧车、Electron/preload/IPC、App Server/runtime、同步/异步回答、跨线程题稿、最终正文/Stop隐藏、Escape精确interrupt通过；告警、invoke/console/page错误与mock命中均0。运行前后 source/artifact 稳定；Main PID87727 在0.562秒内正常 code0/signalnull、forcedCleanup null，三张截图已查看。限定 macOS source-build/受控provider，不扩大为 live 或 Windows/packaged 问答证据。
- 问答 r1 的15秒正常退出失败原样保留。两轮被测 source、dist-electron/client 一致，但中间外部 `dist/index.html` 摘要变化，各轮内部均稳定。r2只增加Playwright调试日志；不能声称整个 artifact 树相同或退出不稳定已根治。
- typed sandbox 的 current owner、schema/generated client、真实 stdio/PTY 与精确 Seatbelt 用例已通过；本地部分完整门禁历史失败仍保留，不宣称默认本地门禁全绿。Memory phase-2 shared Agent 尚未实现，保留 active，不因本版发布标100%。
- 窄写集：本计划、`.gitignore` 精确证据白名单、`artifacts/release-v1.164.0/` 最终收据。冻结后的其他会话测试迁移、GUI源码、计划与 `tsconfig.node.tsbuildinfo` 不纳入本版，不覆盖、不stage。已提交证据清单中的 `thread-status-read/manifest.json` 正由原owner继续更新，本版沿用标签快照，其原 SHA256 与清单一致。
- 分类：current 为 Forge/Electron、同一 App Server/runtime、typed sandbox 与canonical read owner；本轮无新增compat/deprecated路径，queue-only旧入口已删除。采用既有 owner 和恢复入口，不新增发布后端或生产mock。
- 本次替换同一版本号的先前产物；已有旧v1.164.0安装包的用户应从Release重新下载安装，不能依赖版本号变化触发升级。

## 候选收口历史（2026-10-20，终态以顶部为准）

- 当前 main 为 `bc3f3672c6c88bdf54736aad85ed6680b825a169`；Quality `39399106645` 的 Integrity、GUI Smoke、Windows Shell Runtime 已 success，Frontend Full 与 Rust Full 尚在执行。v1.164.0 仍指向 `7462c764aaf2197f7a4383119db590fad5e98575`，尚未覆盖公开旧产物；npm 根包 1.164.0 尚未发布。
- 该轮 Rust workspace 后继结果为 app-server 1975/1976，通过以外唯一失败是 `typed_media_rejects_local_leaks_and_mismatched_payloads`：不存在的硬编码路径先触发文件读取错误，未到原 sidecar 断言。发布 root 仅认领该既有测试体，把输入换成隔离临时目录中的有效 PNG；生产逻辑、错误顺序和全部原断言不变。原日志 `/tmp/lime-v11640-bc3f-rust-job.log` 保留；这是后于 ephemeral freeze 的测试夹具修正，旧摘要不覆盖该变更，后继候选仍须重新验证。
- 后继问答 r42 只修复等待标志仍保有 canonical active Turn 时的活动判断，77/77 定向回归通过，真实桌面新字节验证进行中；r41 同步最终正文未显示的失败保留，不能用单测核销。后继完整 typecheck 正在执行。
- 后继完整 `npm run typecheck` 已 exit0（`/tmp/lime-v11640-question-final-typecheck.log`）。bc3f 的 Frontend Full 最终 success；该轮 Quality 仅 Rust Full 的上述媒体夹具失败。修正夹具仍须后继完整矩阵验证，不把 1975 项通过写成全组通过。
- 独立无 inspector/CDP 的同一 Electron Host 已通过原生退出，Main exitCode 0、signal null，无强制回收；收据 `/tmp/lime-quit-uninstrumented.json`。该条件证据不抵消 Playwright fixture 的原 15s 正常退出失败。
- 后继调试连接诊断 `/tmp/lime-quit-detached-probe.json`：先释放 Node inspector，再正常 app.quit，同一真实 Electron/preload/App Server 条件下 Main 在 2.4s 内 exitCode 0/signal null，forcedCleanup null。发布 root 追加窄写集为 `persisted-atom-fixture-driver.mjs` 及其既有测试、`claw-chat-current-fixture-teardown.test.mjs`：把断开测试调试连接放入正常退出请求，保留原 15s 预算、真实 child receipt 与失败后单独回收规则；无生产退出逻辑变更。首次回归暴露下游 fake 仍只实现 app.close，迁移其 quit-request fixture 后重新验证；独立真实 helper 复验进行中。
- 真实 helper 的第一轮复验仍失败：只断 Node inspector 未释放 Playwright browser transport，虽收到 quit 事件仍未在 15s 内收到 Main child exit；保留 `/tmp/lime-quit-current-helper-probe.{json,log}`，未把回收记为通过。后继补回 Playwright public close，完整调试连接释放与正常退出同时执行；28/28 回归通过，真实进程终态待结算。最终 contracts、scoped script lint、版本一致性均 exit0；只提交当前候选以重跑质量矩阵，标签仍等待产品证据。
- 上述 helper 后继真实复验 `/tmp/lime-quit-current-helper-final.{json,log}` 仍为 15s 超时，业务 quit 事件不能替代 child exit。已精确撤回本轮三个 helper/test 文件补丁，恢复当前 main 的退出合同；单次断调试连接诊断与 28 项临时回归不作为最终修复通过。未改动生产退出实现或增加预算，原失败与无 inspector 条件成功均保留。
- 后继候选 `467259cb392dbd03eda649c289c14aeb0be5e373` 已正常提交并推送 main，提交钩子 21/21 通过。完整 Quality 为 [39403455902](https://github.com/limecloud/lime/actions/runs/39403455902)，仍待终态。源码/文档 diff whitespace 通过；原始 JSON-RPC 测试日志保留尾部空行，未改写原始证据。提交后的问答 helper 迁入既有 threadReadActivity owner 的结构调整仍由原 owner 收口，最终标签尚未移动。
- 当前收据新增：临时线程真实 stdio/runtime/loopback provider 与工具 continuation 通过，3 次采样、两个进程 EOF 正常退出、私密 marker 未落盘及冷恢复拒绝；Agent Runtime 266/266、App Server Client 50/50。标准 GUI smoke `standalone-shell-01-20261020095127-70083` 24/24。unknown Item Electron 场景 `memory-ephemeral-unknown-item-final-20261020` 业务与 teardown 全部通过，Main PID 99939 在 0.75s 内 exitCode 0/signal null、forcedCleanup null；这是当前原 helper 的新成功证据，不抵消此前不同 run 的退出失败，也不替代尚待完成的问答专项。
- 问答专项 r44 已真实 Electron 全部通过，最终正文/终态与 Esc scoped Stop 验收正常；Main PID 19270 在 4.31s 内正常退出（exitCode 0、signal null、forcedCleanup null）。原始 summary `.lime/qc/gui-evidence/request-user-input/codex-question-20261020-r44/summary.json`，由原 owner 收齐最终仓库证据。
- Quality 39403455902 的 Frontend Full 在第93/141批发现五条中文期望实际返回韩文；发布 root 认领唯一污染源 `agentStreamSubmitExecution.test.ts` 的语言 fixture 清理。按 producer→两 consumer 固定顺序与原 singleFork 条件复现 5失败/25通过（`/tmp/lime-v11640-locale-ordered-red-2.log`）；首次 CLI sequencer 参数使用不正确、未执行测试的日志单独保留。修复按每项测试捕获并恢复进入时的真实 locale，保留五语言覆盖和全部原行为断言。该既有测试文件已超1000行，本刀只补生命周期清理，不堆业务用例；退出条件为原跨文件失败消失，后续按职责拆分独立处理。
- 语言隔离最终按 product copy 的 document→已初始化 i18n→fallback 顺序只读捕获有效 locale，同时恢复原文档 lang/dir。中间使用会初始化 i18n 的 getter 导致英文默认值，5条仍失败，诊断原件保留；最终固定顺序 **30/30 通过**（`/tmp/lime-v11640-locale-ordered-final.log`），临时调试输出已移除。未修改语言资源、生产分支或放宽期望；后继候选须重新覆盖完整前端矩阵。
- r44 人工截图发现合法 `thread/status/changed` 仍有“尚未接入”toast，原 owner r45 在既有 read-model refresh owner 处理状态失效并消除此告警，66/66 定向回归通过，最终桌面重验待结算。该现存产品缺口属于本版；Memory phase-2 新实现仍排除在本版完成声明外。RuntimeCore 最终 885/885、runner 管道输出23/23通过，完整日志入库；旧截断与失败日志保留。发布候选在这些已实现修复处冻结，接下来只接受当前门禁失败所需修正和验证收据。
- 本轮发布写集限定为 release notes、当前计划及 Agnes 退出收据；问答和 Memory 生产实现仍由其既有 owner 修改。本版在当前修复与其最终验证收齐后冻结候选，Memory phase-2 共享 Agent 等尚未实施的路线图保留 active，不作为本版全面完成声明。
- `90bb735978dedc3c85fca9901c5ea6c4c2638ad7` 的 Quality `39373078331` 六项全部 success。后继设置布局、Agnes live helper、问答跨 Turn 绑定与 Memory ephemeral 生命周期进入新候选，不能沿用该旧提交的完整通过声明。
- 设置页截图问题已在原 owner 修复并在真实 Electron 三宽度复验；Agnes 3.0 Flash 聊天与 2.5 Flash 图片在同一 canonical Thread/Turn 上完成，任务/workflow/JSONL 审计通过，收据见 Agnes 计划和同名 JSON。Main 15s 正常退出仍 fail，保留独立 lifecycle 缺口。
- 新候选完整 typecheck、contracts、版本检查 exit0；provider current_client 177/177、Agnes registry 8/8、设置与构建回归 128项通过；live helper 7/7、模型列表3/3。runtime 全组 877/878，单个并发身份删除夹具隔离通过；完整聚合不能记绿。后继 Memory 字节还须取其定向终态。
- Git 忽略规则按现有精确白名单登记 Agnes 计划/收据及问答原始红绿记录，不绕过 docs boundary。只排除构建缓存；产品、测试、脚本与记录继续全部纳入。


- `249a9c878a63151e01faa10dba0d1bca0069cc6b` 已推送 main；Quality `39367836958` 的 Integrity、GUI Smoke 与 Windows Shell Runtime 通过。Frontend Full 失败追加定位到 WindowsSandboxReadinessStatus 测试将 navigator 恢复为写死的 Mac，污染 NotionEditor Ctrl+S；已改为恢复原始属性，固定顺序 4 文件 14/14 通过。Rust Full 失败为 Memory read 相对路径 `MEMORY.md` 未产生引用 metadata；在 tool-runtime 路径分类 owner 修复，定向验证等待共享 Cargo 锁。
- 用户追加要求 Agnes 模型选择、聊天、图片全部跑通，允许 computer use。安装版 Agnes 2.5 Pro 返回 503，最小请求证实该账户为 model_not_found；2.5 Flash 真实 GUI 已回复 OK 且 canonical turn.completed。3.0 与图片缺权威 capability，修复和完整 live 验证在 [Agnes 恢复计划](agnes-model-recovery-20261020.md) 跟踪，直接接口成功不冒充 GUI 完成。
- 后继 Memory 精确快照/token、事件 drain 当前订阅与 restored-turn presentation listener 修复全部纳入；不覆盖其并行写集，最终发布以最后验证候选为准。
- Agnes 候选完整 `npm run typecheck`、`npm run test:contracts` 与 `npm run verify:app-version` 已 exit0（`/tmp/lime-v11640-agnes-{typecheck,contracts,version}.log`）。先递交 main 触发远端完整质量矩阵；Rust 与最新 live 产品证据在本地继续，所有门禁收齐前保持旧 tag 不动。
- `a5a42c27febe1b1e774d7bcb02801988307f3b29` 已提交并推送 main，包含当时全部候选；标签仍为 `7462c764aaf2197f7a4383119db590fad5e98575`，等待最终修复候选。以下恢复记录中的旧排除清单均已被用户“全部发布”覆盖。
- Quality `39363308128`：Integrity、GUI Smoke、Windows Shell Runtime 通过；Frontend Full 与 Rust Full 失败。Rust 失败是客户端 consolidate fixture 已发送必填 `sessionId`、expected JSON 却遗漏，已同步 current 合同；前端失败已通过固定顺序复现为 experimental 测试改写 navigator.userAgent 后没有恢复，污染 NotionEditor Ctrl+S。修复实验设置与剪贴板平台 fixture 的原始属性恢复；固定顺序 3 文件 10/10 通过，保存/IME/卸载原断言保持。失败原件 `/tmp/lime-v11640-notion-ordered-2.log`，通过原件 `/tmp/lime-v11640-notion-ordered-green.log`。
- 后继新增 Memory phase-2 lease/cancellation 与 GUI 同步问答单 owner 改动全部进入候选。Memory 新增 3/3 lease 回归通过；其 shared Agent harness 的完整对齐仍 active，不以本版发布核销。GUI 单 owner 8 文件 71/71 通过，后继真实组合 Electron 仍待终态。
- current fixture 聚合此前因 Main 正常退出 15s 超时没有完成；独立标准预算诊断正常退出 11.2s 通过，另一次临时扩大 cleanup budget 的诊断实际退出 0.58s。后者仅诊断，不算标准聚合通过；不提高仓库超时，不把强制回收记成成功。
- 本轮实际写集：客户端 fixture、实验设置/剪贴板测试、发布说明和本计划；用户授权纳入其他进程的全部新增候选，不覆盖其实现。无新增 compat/deprecated/dead 运行路径；旧 action_request 到 A2UI 的重复提交路径在 existing owner 中直接迁出，历史只读回显保留。
- 后继收口：`npm run typecheck` exit0（`/tmp/lime-v11640-candidate-final-typecheck.log`），Rust app-server-client 50/50 通过，版本一致性 1.164.0、完整 contracts、受影响两文件 lint 和 diff whitespace 通过。Memory 模型选择 36/36 通过。Renderer 已构建成功，最新侧车及组合 Electron 仍运行，不能提前记为 Gate B 通过。

## 2026-10-20 发布恢复

- 最新范围指令：“新的也要一起发布，全部发布”。此前排除的新增 runtime、协议、GUI、研究、执行计划、测试与未跟踪源码全部纳入；只排除 `tsconfig.node.tsbuildinfo` 等构建缓存和忽略目录中的临时运行产物。旧的窄写集排除记录仅为当时状态。
- 新增候选涵盖 Stop Hook durable receipt/typed source/canonical HookPrompt/history fork、异步问答 root/config/工具终态、GUI 题稿与测试 fixture 修复。architecture 已记录各唯一 owner、依赖方向与责任 root 的图确认；未完成的 live/产品全场景对齐仍保留在各执行计划，不作为本版完成声明。
- 用户已明确确认继续同版本发布；沿用本轮 commit、main/tag 推送和标签重定位授权。
- 首次发布提交 `f5ba4d71c`；第一轮门禁修复 `094d1dbc2`；当前候选 `7462c764aaf2197f7a4383119db590fad5e98575`。远端 main、v1.164.0 与草稿 Release target 均已复核为当前候选。
- 后续新增的 runtime/request-user-input 并行未提交改动不纳入本轮恢复候选，保留原工作树；构建缓存继续排除。恢复直接写集为下列修复涉及的依赖、Electron smoke、TUI/搜索测试、Item inventory 与 runtime backend owner。
- `094d1dbc2`：补齐 Markdown 直接类型依赖及锁文件、迁移 Electron console-message 事件参数、补齐 TUI AgentMessage questions fixture。typecheck、版本、contracts、GUI smoke 和 TUI crate 回归已通过。
- `7462c764a`：补齐搜索测试 AgentMessage 的 delivery/questions 与 Item inventory 的 questions；将 Memory provider sampling 移入现有 execution_backend owner，runtime_backend.rs 回到 797 行（含末尾换行计数为 798）；SHELL-01 只检查无 provider 会话的启动与设置操作，不调用需要 eligible root session 和模型路由的 memoryStore/consolidate，保留其按钮可见性断言。
- 上轮 Quality `39348998189` 的前端失败为 facade 行数与 inventory 字段漂移，Rust 为上述 fixture 编译遗漏；Windows Release `39349083451` 已构建成功，失败在 installed SHELL-01 的 noConsoleErrors，与 GUI smoke 失败阶段相同。旧证据只存 console error 计数，不能声称已取到原始 error 文本。
- 当前工作树 `cargo check -p app-server --tests` 与 `thread_search_occurrences_jsonrpc` 2/2 通过；GUI smoke `standalone-shell-01-20261020015650-86182` 通过；提交钩子 5/5 通过。治理定向测试 inventory 4/4 与 runtime facade 检查通过；工作树另有并行 request_context.rs 806 行的未提交失败，候选 HEAD 为 753 行，该并行改动保留不提交。Rust 验证使用已有本地 rusty_v8 缓存；裸 Cargo 的上游预编译包 URL 返回 404，不改系统或依赖。
- 当前远端 Quality：[39356454630](https://github.com/limecloud/lime/actions/runs/39356454630)。Release：[39356523636](https://github.com/limecloud/lime/actions/runs/39356523636)。退出前需核实三平台 Desktop、Quality、公开 assets、R2 和四平台 CLI/npm 的实际结果。
- 分类：current 仍为 Forge/Electron、App Server/runtime 与现有测试 owner；无新增 compat/deprecated/dead 运行路径。修改遵循既有 owner 和窄写集，不降低 facade 上限或引入 mock fallback。
- 后续 Quality `39356454630`：GUI、Windows Shell、lint/typecheck、Integrity 已通过；Frontend 在第 66/140 批发现 Host 偏好文件缺少 storage root 登记，Rust 在 `environment_remote_turn_jsonrpc` 发现 fixture 把冷恢复历史中的上一回合 tool 结果当作本回合结果，导致第二回合未发出 process/start。修复采用工作树已有的两行精确文件登记；provider fixture 只查询最新 user 之后的 tool 结果，read model 断言限定最新回合。
- Release `39356523636` 三平台 Desktop 和公开 assets 已成功；R2 在 Windows nupkg 的 CompleteMultipartUpload 返回 InvalidPart。已请求取消尚未完成的 CLI/npm 构建，npm 根包 1.164.0 仍不存在。R2 current uploader 对该错误最多重新上传三次，成功后仍验证 size/SHA256/content type/cache control，所有 payload 通过后才发布 feed；补成功重试与重试耗尽的回归。301 MiB 文件哈希测试使用独立 30s I/O 预算，避免本地并行编译时默认 5s 超时。
- 本次追加写集：`src/lib/governance/storageRootBoundary.test.ts`、`lime-rs/crates/app-server/tests/environment_remote_turn_jsonrpc.rs`、`scripts/electron/upload-update-feed-r2{,.test}.mjs` 与本计划；其余并行 runtime、GUI、研究证据和构建缓存继续排除。
- 依最新范围继续追加上述全部产品写集与 release notes。当前 `npm run typecheck`、`npm run test:contracts`、`npm run verify:app-version`、storage root 15/15、file targets 9/9、release assets 12/12、R2 uploader 14/14 和远程执行/冷恢复 1/1 通过。首次远程执行复验在本地高负载下等待终态超时，随后同一用例不修改预算取得通过，原始日志 `/tmp/lime-v11640-remote-turn.log` 与后继日志 `/tmp/lime-v11640-remote-turn-2.log` 保留。
- 本轮 Stop Hook public JSON-RPC live/cold/fork 2/2 通过（`/tmp/lime-v11640-stop-receipt.log`）；facade、inventory、current flow control 三文件 35/35 通过（`/tmp/lime-v11640-boundaries.log`）。新增后台恢复事件路由归既有 `AppServerAgentSessionEventDrainRouter.restoreThread`，恢复 inProgress turn 时注册同 identity 路由，消费者 threadClient 同步迁移；不新增第二业务 owner。
- 全部候选的真实 Electron SHELL-01 已通过：`standalone-shell-01-20261020030250-46385`。前端续跑 r25 已执行至140/140批，新增 active-turn 恢复确定性回归 r25 为132/132通过；初始本地路由回归缺少 lifecycle 时间戳的失败保留，后继已补全 current 合同，无放宽 sequence gate。current fixture 聚合仍在执行，结果另行结算。
- 发布策略：先递交全部候选到 main 并收口远端 Quality，再把同版本 tag 以旧 SHA 租约重定位到最终候选；旧 Release run 已取消且 npm 1.164.0 未发布。新 Desktop 产物、R2 更新索引和四平台 CLI/npm 必须基于同一最终候选重新完成。
- 最终候选类型检查再次通过；active-turn 相关8文件139/139通过（`/tmp/lime-active-turn-resume-green-r26.log`）。本轮 current fixture 聚合在 unknown Item 场景所有业务断言通过后，正常退出 Main 的15s期限失败；独立复验同样失败，均没有把 SIGKILL 回收记为通过，日志 `/tmp/lime-v11640-all-current-fixture.log`、`/tmp/lime-v11640-unknown-recheck.log`。其余聚合子场景未执行；SHELL-01 通过不替代该聚合终态，退出缺口继续排查。

## 目标与范围

### 最终候选收口（2026-10-20）

- `467259cb392dbd03eda649c289c14aeb0be5e373` 的 Quality `39403455902` 已完成：Rust Full、Windows Shell Runtime、GUI Smoke 与 Integrity 通过；Frontend Full 仅有测试间语言污染导致的五项失败。保留原日志，污染源测试恢复进入前的有效语言及文档属性，固定 producer→两 consumer 顺序复验30/30通过，未修改生产逻辑或原断言。
- 后继候选包含活动 Turn 判断迁入既有 projection、queue/status 共用单一 thread read owner、Rust runner 输出 drain 修正和 ephemeral 多模型路由验收；旧 queue-only hook 直接迁移，新增 compat/deprecated 为0。当前只接受门禁失败修正和验收记录，Memory phase-2 shared Agent 与全仓模块拆分仍在各自路线图，不扩充本版实现范围。
- Agnes 3.0 Flash 文字与 Image 2.5 Flash 图片已走真实 Electron/IPC/App Server/runtime 完成；服务商设置在1024、1440、2048宽度无横向溢出。问答 r44 业务与正常退出通过，r45正复验合法状态通知零提示。
- 完整 types 最终复核与后继 CI、标签重定位及全部 Desktop/R2/CLI/npm 仍待完成，不能把已触发工作流记为发布成功。原始验证日志保留其空行与空白，不为 diff whitespace 改写原件；源码与文档单独检查。
- 后继完整 `npm run typecheck` exit0，原件 `/tmp/lime-v11640-final-typecheck-verified.log` 与 `.exit`；最终 GUI SHELL-01 `standalone-shell-01-20261020102955-67648` 通过24/24。docs boundary、ephemeral fixture语法、源码/文档diff whitespace通过。42文件候选先提交启动CI；之后新增的并行typed sandbox协议/执行边界尚在开发，保留工作树，待对应owner完成定向与合同后再合入最终发布标签，不把这批在途文件混入已冻结索引。
- 已推送候选 `974627088debee29861263b14698cf73d8651589`，正常提交钩子39/39。完整 Quality `39409169817`：https://github.com/limecloud/lime/actions/runs/39409169817 ，等待终态。typed sandbox切片收口后纳入全部发布；请并行owner在该切片完成后冻结新增实现，让本轮tag、Desktop/R2/CLI/npm基于一个稳定候选结算；Memory shared Agent后续路线图保持active，不在本轮追逐新增实现。
- `974627088` 的远端 Frontend Full已完成141/141批，GUI与Integrity通过，Rust仍运行。后继typed sandbox已同步JSON Schema、manifest、生成TS、App Server/进程执行和Windows ACL；完整contracts通过、TS client 139/139与gateway 6/6通过。GUI独立 `verify:local` r46在完整`npm run typecheck`之后已进入第33/142批，确认新生成类型检查exit0；此后批次尚未结算，不宣称默认门禁通过。先提交这批实现启动最终源码CI，OS sandbox定向/真实执行、稳定产物问答和完整矩阵仍必须在标签之前结算。
- 问答r46已实际验证状态告警0、最终正文/Stop、答案wire、跨线程稿和精确中断，Main0.534秒正常退出；因并行Rust源码变化，末次freshness失败，整轮fail。后继fixture明确执行纳入产物指纹的`dist-electron`侧车，禁止通过宽限、touch产物或豁免freshness结算；冻结后以新run ID复验。
- 最终源码候选 `a6923021a737da63c563d3e6f0724ce33eaf2e0f` 已正常提交/推送，37文件、37/37提交检查通过。完整 Quality `39413060485`：https://github.com/limecloud/lime/actions/runs/39413060485 ，已通过远端lint/types/Integrity，继续Frontend Full、Rust Full、GUI及Windows安全/运行时矩阵。上一候选Quality `39409169817` 已全部success；它不能替代新增sandbox源码的本轮矩阵。当前产品源码已冻结，之后只接收验证所需修正和记录；后续路线图不继续扩入本版。
- `39413060485`终态：Frontend Full、Windows、GUI、Integrity全部success；Rust app-server unit为1977/1978，唯一失败`execution_process_server_enforces_seatbelt_workspace_boundaries`的`!outside_path.exists()`。旧夹具位于系统TMPDIR，而canonical默认workspaceWrite明确允许TMPDIR（exclusion=false），故其outside路径已是合法临时写根，不能证明伪造metadata未授权。release root认领clean的`app-server/src/execution_process/tests.rs`这一份测试：使用home下唯一隐藏tempdir，将真实outside置于默认临时写根之外；所有原断言、伪造metadata输入与生产策略保持。原CI失败保留`/tmp/lime-v11640-a692-rust-ci-failed.log`；新定向与后继CI尚待结算，不把测试修复记作已通过。

- 发布应用、CLI 与 Rust workspace `v1.164.0`，创建并推送 `v1.164.0` 标签。
- 候选起点为已发布的 `v1.163.0`；当前工作树中该标签之后的源码、协议、测试、脚本、治理规则、研究证据和执行计划全部纳入本版。
- 已知构建缓存 `tsconfig.node.tsbuildinfo` 不纳入提交；不回退、不覆盖其他工作树改动。
- 继续沿用 Electron -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection 主链；不新增兼容后端或生产 mock fallback。

## 发版事实源

- `package.json`
- `packages/cli/package.json`
- `lime-rs/Cargo.toml`
- `lime-rs/Cargo.lock`
- `RELEASE_NOTES.md`
- `RELEASE_NOTES.en.md`

## 候选内容

- 异步用户输入、线程目标、目标附件、记忆状态与引用投影。
- Composer、文件树、文件菜单、侧栏分组、分页、个人资料、帮助和快捷键入口。
- canonical history、runtime snapshot、消息/推理/工具生命周期、模型历史和跨协议合同。
- Electron 文件 shell、IPC、窗口目标、工作区操作、App Server、Rust owner 与协议 schema。
- 退役对话导入、旧 OEM 引用和重复命令入口清理，以及对应的测试、治理、研究证据和执行计划。

## 验证与退出条件

1. `npm run verify:app-version` 通过，且仓库内无目标事实源的 `1.163.0` 残留。
2. `npm run typecheck` 通过；协议、命令、治理、发布脚本和相关 Rust/前端定向回归按改动风险通过。
3. `npm run verify:gui-smoke` 尽量通过；若环境限制导致失败，保留日志并在收尾明确证据等级和缺口。
4. `git diff --check`、正常提交钩子预检和 staged 摘要通过。
5. 正常提交候选、推送 `main` 与标签，并复核本地及远端引用指向最终候选；允许发布后 main 追加纯证据提交，但标签固定且 main 必须是其仅含发布证据改动的后代。
6. Desktop 九产物、四平台 CLI 与 npm 根包共14个 GitHub assets、五包 npm registry/dist tags、R2 18对象及六份 feed 通过实际审计；已发布 macOS arm64 CLI 从 registry 隔离下载、完整性校验、原生 `--version` 执行通过。其余三平台 CLI 仅按实际构建/打包证据报告，不冒充本机原生运行。

## 收尾记录

- 本次发布交付100%，候选commit/main/tag推送及同版本标签租约复核完成；本记录、精确白名单与最终收据按窄写集正常提交推送main，tag固定。暂存范围必须仅含发布证据，实际提交快照逐条验证清单摘要；原owner在途工作与构建缓存全部保留，不夹写。
- 版本事实源为package/CLI package、Rust workspace/Cargo.lock，中文和英文Release Notes仅保留v1.164.0；版本一致性、完整typecheck、contracts、GUI、最终Quality/Release及公开渠道验证以本计划顶部和收据为准。
- GUI/runtime 对齐、live provider、Windows/macOS 打包和公证覆盖只按实际证据报告，不因版本发布自动核销。
