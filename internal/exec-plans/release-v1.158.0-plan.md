# v1.158.0 发布执行计划

状态：active。发布完成度：55%。目标：完成 v1.158.0 候选验证、提交、tag/main 推送及远端发布审计。

## 授权与候选

- 用户要求「发布 v1.158.0」，随后明确「不要让我确认,全部递交,并完成发布」。完整候选、必要修复、commit/tag/push 和发布复核均已授权，不再请求确认。
- 起点 main/origin/main 和 v1.157.0 均为 `e61d6e87fbecd343d60e9d48c2b81a63caa7f11b`；远端 v1.158.0 不存在。
- 初始工作树 347 路径：214 modified、8 deleted、125 untracked。全部产品、测试、脚本、文档和锁文件改动进入候选。
- 沿用上版明确排除：`local-conversation-page-a83a1af2c24b.js` 为外部分析产物，`tsconfig.node.tsbuildinfo` 为增量缓存；保留本地，不删除、不提交。
- 本轮直接写集：桌面/CLI/Rust 版本事实源、Cargo.lock、双语单页发布说明、本文。产品源码先只读检查与验证，必要修复记录精确路径。
- pnpm lock 无 root release version，现有依赖变化一并纳入；Forge 与 App Server 继承版本，不引入第二份版本事实源。

## 发布内容与边界

- Composer 草稿通过 Coordinator -> Electron Host persisted atom Store/File 保存，覆盖会话隔离、新建导航、接受提交和停止恢复。
- 代码块编辑支持语言选择、自动识别和高亮，结构化输入按接受结果消费或保留。
- 设置章节、侧栏和媒体设置复用现有 owner，移除重复名单、旧草稿事件与已替代实现。
- current：既有 Electron Host/renderer/Composer 与 Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item 主链；新增 compat/deprecated 为零；deleted 项由当前语义回归承接；受控 provider/fixture 仅 test-only。
- 重大架构图的责任确认沿用 current GUI 计划所记录的 2026-10-14/15 root 确认及 architecture 4.3/4.4/4.5；本轮 metadata 不改变业务 authority。整体 GUI 对齐仍 partial。
- KISS/DRY：复用版本、构建和发布入口；YAGNI/SOLID：不引入发布包装、兼容层或第二业务后端。

## 验证与退出条件

1. 版本统一 1.158.0，双语单页 notes；`verify:app-version` 与完整 `typecheck` 通过。
2. contracts、发布/CLI/依赖及受影响 owner 回归按风险通过；已有默认前端 132 批证据按 lineage 记录，不冒充本轮全量重跑。
3. 先 current Agent fixture，再标准 GUI smoke；版本变化后重建真实 Electron/sidecar 产物。
4. 复核固定候选清单和源码漂移，正常 pre-commit，不绕过门禁；连续 commit/tag/main push/tag push，核对远端引用。
5. GitHub Quality/Release、签名/公证、三平台安装/updater、CLI npm 实读收口；只触发 workflow 不算发布完成。

## 证据与进度

- 既有默认前端状态 `passed`，完成时间 2026-10-15T07:39:42.985Z；完整 lineage 与 current22 证据见 `codex-gui-alignment-current-plan.md`。仅证明原候选，版本变化后重新验证发布门禁与受影响路径。
- 本轮命令日志、候选清单和远端审计材料放在忽略目录 `.lime/release/v1.158.0/`。
- live provider、系统 IME/麦克风、Windows 本地 GUI 和安装包等价不以 macOS fixture 替代；远端平台结果分别审计。

## 固定候选与初轮验证

- 检测到并行导航/设置写集继续变化，停止本轮旧工作树 typecheck/contracts/current 聚合，仅终止本轮自有进程。不中断其它 Agent 或用户进程。
- 独立索引固定 tree `cc30c9c3f50f95a57368834d3e4172f6a5d135e2`，358 改动路径；独立 detached worktree `lime-release-v1.158.0-source-4xw7dr7n` 验证，原工作区及索引不覆盖。冻结后的新改动属于后续候选，按差异保留。
- 初轮版本、metadata 格式、CLI npm 9/9 通过。重点 owner 106/111、发布护栏 51/53；所有失败均为既有 5 秒超时，尚无业务断言失败，按单 worker 复验，不提高超时、不改断言。
- 初轮 current 聚合仅历史/缓存组 31 项通过，后续因切换固定源码主动停止，不计完整聚合通过。
- 固定源码的 pnpm 首次启动受本机旧 Corepack 签名 key 缺失阻断；改用 npm 临时缓存中的精确 pnpm@9.15.9，不改全局工具或跳过签名配置。

- 精确 pnpm@9.15.9 已可运行；为避免链接的共享 node_modules 被重装，改在仅含 manifests/lockfile 的临时目录执行离线 frozen lockfile 验证，exit0。
- 固定候选首轮单 worker 201 项：200 passed、1 failed。旧超时全部消失；唯一失败是新增设置切章测试预期 undefined，而 current sections 明确以 `focus={context.executionPolicyFocus ?? null}` 清理执行策略焦点。仅在固定源码修正该测试为 null，保留 focus 清理、Provider 和同章保留全部行为断言，补跑 SettingsPage 与 useAppNavigation。
- 本轮追加窄写集仅 `src/components/settings-v2/_layout/index.test.tsx` 的该单行断言；原工作区并行写集不夹写，提交固定候选后将后续 diff 保留。

- 固定源码完整 `test:contracts` exit0；protocol 1036 types 无漂移、IPC/command/harness/modality/script/release/desktop-reference/CLI/docs 所有门禁通过。
- 设置单行断言修正后 SettingsPage/useAppNavigation 51/51 passed；首轮其它 13 文件通过，发布护栏 53/53、五语言代码块和编辑器均已在原 5 秒时限内通过。既有201项收据中的失败保留，不改写为全绿。
- 固定候选已经包含设置 canonical 参数、返回实际会话与 rail Home 分离的并行实施，双语 notes 按实际候选同步；后续 source diff 保留，不直接夹入未经验证的版本。

- 发现其它进程也在构建桌面壳，已把本轮 Cargo target 改为独立 APFS clone `lime-v1.158.0-cargo-8ngd3xsm/target`，仅复用编译缓存字节，不共享 sidecar/rpath 可变产物。构建与 GUI 产物仍在独立候选目录。

- 固定 current 聚合前3组 31/34/3项通过；第4组299/300通过，唯一失败为trace collector的302次append覆盖超过既有5秒。单独重试仍68/69通过、同项超时；不改超时、不减append/断言。原聚合exit1，不声称完整wrapper绿。
- 从原聚合源码提取未执行的Electron continuation，保留原build owner、全部子场景参数与断言；静态组由独立收据证明，临时runner只在忽略证据目录，不进入产品构建图。正在构建独立1.158.0 Renderer/Host/sidecar。

- 首次固定候选完整typecheck实际exit2：App.tsx两处仍调用已移除的setActiveAgentSessionId。导航已由useAppNavigation.agentLocation及reportAgentLocation持有，旧route->local session状态同步成为重复且失效owner。
- 在固定源码窄修复App.tsx：删除旧session同步及仅供其使用的route变量/import，保留离开Agent时清理streaming；实际会话继续来自既有导航位置投影。不新增state或fallback。已停止本轮未完成的旧Renderer，只重建修复后的产物，重新运行完整npm run typecheck。

- App修复写回原工作区前以冻结blob逐字节确认未漂移；设置测试已出现并行变化，仅在独立候选保留修正，不覆盖原文件。两个修复文件的严格ESLint和Prettier通过。

- 本机两个重型编译同时运行推进过慢，已对本轮独立Renderer编译PID27407发送SIGSTOP，保留进度；先完成完整typecheck，再发送SIGCONT接续。未暂停其它进程，构建入口无超时放宽。

- 暂挂本轮Renderer、降低并发负载后，原trace超时用例按原5秒时限精确复验通过：1项执行、68项由过滤显式跳过，实际1585ms；未改测试、append数量、collector实现或断言。与前轮其余68项通过收据组成完整69项覆盖，原两份超时失败保留。

- 修复后完整 `npm run typecheck` exit0，Renderer与Node两部分均通过，日志`typecheck-frozen-fixed.log`。已向本轮Renderer PID27407发送SIGCONT恢复构建；不存在仍挂起的本轮编译任务。

- 修复后Renderer构建exit0（7081 modules，耗时包含暂挂等待），App Server client与Electron Host typecheck/build及桌面资源构建通过；独立Cargo target正在编译v1.158.0 sidecar。

## 提交与远端Quality

- 本地版本、完整typecheck、contracts、锁文件及受影响静态回归收口后，先正常提交并推main，使Quality与余下桌面验证并行；tag待GUI收口后继续推送，不结束为准备态。
- 首个独立worktree提交因缺少忽略的Husky包装脚本未执行hook；随后amend虽运行hook但暂存差异为空，均不作有效门禁，也均未推送。仅移动独立未发布detached HEAD回原父提交，完整候选索引/文件保留，用仓库现有Husky包装脚本重新正常commit；未使用no-verify或禁用配置。
- 最终正常hook验证348文件、0失败。commit `a092825e86377d5b310b1ab0457703b4420a412b`，359个改动路径，完整提交diff检查通过；已push origin main。主工作区索引在确认无暂存改动后同步新tree，工作区文件及冻结后的并行修改保留。
- 首次Quality列表读取发生在push完成前，只返回旧run，不能计为新候选CI证据；继续按新headSha复核。

- Quality `38724501475` 对精确 commit 的 Integrity、Bridge & Contracts、GUI Smoke 成功；Frontend Full 的 install/lint/typecheck/layer budget 成功，全量在第4批 autoGuide01 停止。
- 测试夹具缺少新增 persisted atom 响应，且会话内场景未提交 session route，落入 current Home 投影。最终窄写集仅 index.testFixtures.tsx：复用现有真实 Coordinator/Store harness、按 persisted command/event 分派测试桥接、退出时 flush/dispose；夹具默认提交既有会话 route，显式 Home/route 场景保留原输入，不修改生产代码或降低断言。autoGuide01 11/11 passed；共享消费者首两文件 workbench01/03 共20项通过，其余继续复验。
- 标准 CI `npm run verify:gui-smoke -- --timeout-ms 1800000` exit0，真实 macOS Electron/IPC/App Server 1.158.0、reload、3视口、memory settings 通过，证据见 ci-gui-smoke.log。
- 本地 continuation 的 unknown-item 场景 businessAssertionsPassed=true，但 normal Main exit 15秒超时，teardown fail，完整子场景仍判失败，未执行后续场景。继续精确复验退出，不把业务通过当完整 Gate B。

- 收口补丁仅测试夹具与本计划，正常 hook 提交并推 main 触发下一轮 Quality；不重复已有生产源码 typecheck/build/Rust 结果。

- 共享夹具16文件105项首轮102通过、3失败；无产品缺陷。补齐三个 current 测试：无激活会话展示独立 Home；当前 action_required 显式从 live 到达，避免把恢复历史提升为可提交表单；旧侧栏恢复负向测试使用其真实 topic-a route。保留消息内 A2UI、历史只读和禁止旧侧栏断言。三个文件13/13复验通过，与其余13文件形成105项完整覆盖。
- 本地 unknown-item 精确重试完整通过：businessAssertions、Main 正常 exit0/no-signal、资源回收均通过，受控 external backend，production mock fallback=0。初轮teardown超时记录保留。所有本轮挂起Renderer已恢复并完成重建；继续使用同一产品产物验证home-hotpath/inputbar-rich-restore，不重建未变化的生产源码。
- 测试补丁 `4cccf2ee57ff1c4ea22c55783290fe79786d7669` 已正常hook提交并推main；新Quality `38726992169`执行中。剩余三文件测试更新及本计划正常提交推main后以最终source复核。

- 最终测试补丁 `5d88ce350726c15d9a8bdb64a2517637e422df3c` 已正常hook提交推main，Quality `38727636026` 的 Integrity、lint、完整typecheck、GUI Smoke成功；Frontend Full 通过批次1–75，第76批旧surface guard仍正向要求已迁出的buildClawAgentParams，失败1/70，其余69通过。
- 窄修复该guard：surface只拥有草稿/预览派生，禁止会话route构造回流；导航接受语义已有index及Gate B覆盖。产品实现无改动，不恢复旧owner。按原130批发现从76续跑，不从第一批无差别重跑；CI前75批与后段/定向结果按source lineage组合，原失败收据保留。
- 本地三条Gate B完整通过并正常Main exit0/no-signal：unknown-item、home-hotpath、inputbar-rich-restore。使用真实Electron/preload/IPC/current App Server和同一session/read model；backendMode=external受控fixture，无live provider声明。摘要与SHA-256记录在gate-b-receipts.json。
