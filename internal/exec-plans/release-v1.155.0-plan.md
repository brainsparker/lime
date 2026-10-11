# v1.155.0 发布执行计划

状态：active；目标：端到端发布 v1.155.0。

## 授权与候选范围

- 用户要求「发布 v1.155.0」，并明确「我出去了,不要找我确认,完整发布」；授权本轮 release commit、tag、main/tag 推送及发布完成核验，不再重复确认。
- 起始 main/远端 main/v1.154.0：`64292f0b6462ca189ba5b5e7668065970f07f999`。目标 tag 本地及远端均不存在。
- 当前 tracked/untracked 产品、文档、测试和脚本改动均纳入候选；完整路径清单和固定源码存于 `.lime/release/v1.155.0/`，不提交该忽略目录。
- 本轮窄写集：root/CLI package version、Cargo workspace/lock version、双语单页 release notes、本文。Cargo 文件保留既有依赖变化。
- 只读候选产品写集：TUI/CLI、agent/protocol、tool-runtime、App Server/protocol、对应 scripts 与 architecture/commands/原执行计划；不覆盖并行开发内容。
- 冻结后的新开发变化保留为未提交差异，不自动混入已验发布候选。冻结前后逐项 SHA256 复核，发布 commit 必须等于固定候选。

## 发布内容与架构确认

- TUI 输入/缩放/外部编辑器、统一剪贴板 worker、语义复制、历史分页阅读及 selection snapshot。
- command display parser 与真实 argv/cwd/process invocation 生命周期；poll/stdin interaction snapshot、canonical 单次开始/完成与 live/read/page/restart 一致性。
- current：Product Surface -> App Server JSON-RPC -> RuntimeCore -> canonical Thread/Turn/Item；各领域由既有 owner 继续演进。
- compat/deprecated：无新增；dead/deleted：旧 clipboard_paste worker、重复 Markdown 表格/链接路径及已迁移的输入/投影入口。test-only：受控 provider 与真实 stdio/PTY fixture，不代表 live provider。
- 架构图由产品改动责任 root 在 `architecture.md` 和原 TUI/CLI 执行计划确认：terminal event -> geometry/input clock -> paste gate -> current view/worker；command invocation -> shared agent lifecycle -> canonical projection -> GUI/CLI/TUI。发布不新增业务 owner 或平行 runtime。

## 退出条件

1. 所有显式发布版本一致为 1.155.0，双语 release notes 仅保留当前版本。
2. `verify:app-version`、完整 `typecheck`、contracts、受影响 Rust owner/脚本测试通过。
3. 固定候选构建通过；真实 command stdio、CLI/TUI PTY 与 GUI smoke 按实际证据记录。
4. 正常 pre-commit 验证通过，release commit/tag/main/tag 推送完成，远端 SHA 相等。
5. GitHub Release 构建/资产、发布及下游任务核验；失败先定位并修复，不将触发 workflow 当作完整发布。

## 验证与进度

- 初始盘点完成；无上一 tag 后已提交产品变更，本版产品差异全部来自当前工作树。
- 已同步 root/CLI package、Cargo workspace 及 36 个本地 workspace lock version；pnpm lock 不含应用显式版本，Forge 从 package version 读取，生成 App Server manifest 由构建入口更新。
- 门禁和远端发布结果待回填。Windows/Linux 原生交互、接收应用 HTML/剪贴板、live provider及完整 Codex 对齐不属于本地 macOS 结果可证明范围。

## 固定候选与首轮门禁

- 固定候选共 240 文件；起始 tree `fd45c33393df27b55dbd8ee8e6518b93c1003a50`，含 158 个 TUI、29 个 tool-runtime、18 个 App Server 文件。完整逐路径 SHA256 在 `frozen-candidate.json`。
- 固定源码目录 `candidate`，APFS clone 的独立 Rust cache 为 `candidate-target`；不写共享开发 target，不复用 v1.154.0 二进制。
- `verify:app-version`、完整 `typecheck`（renderer + node）、`test:contracts`、11 个候选 mjs 的 ESLint 全部 exit0。
- 定向 Vitest 189/189；CLI npm launcher/staging 9/9。App Server client、renderer smoke build、Electron typecheck/host/assets build exit0。
- 正常 pre-commit 预检查 237 个新增/修改文件全部通过，3 个删除文件不计入正向检查；未绕过 hook。
- 冻结后原 TUI/CLI 执行计划追加后续验收记录，保留在主工作树；目前无产品源码漂移。最后提交前再次盘点。
- 按 release workflow 风险矩阵执行必要门禁和 current owner/integration，不自动重跑全量 `verify:local:full`、裸 lint/test 或 Cargo workspace；Rust、最终产物及真实 Gate 仍进行中。

- Rust 首轮 exit101：agent-protocol 43 项通过；App Server 1802 项通过、1 项 `active_wait_recovers_terminal_result_written_after_initial_repair` 失败，错误为人为删除的 child durable identity 在恢复前被 wait 读到。该测试源码未包含候选产品改动，使用固定 40ms sleep；原失败保留 `rust-owner-tests.log`。不计作全绿，正在定向复验与较低测试并发的完整 owner 重验，不放宽业务断言。
- GUI canonical item/thread projection 52/52、Cargo fmt --all --check exit0。

## Rust 复验与真实桌面证据

- 首轮固定 40ms identity fixture 定向复验 1/1 通过。owner 低并发重验中该用例通过，但另一个未修改的 Node partial-output fixture 超过 1s 输出预算；单独复验 1/1 通过。两轮完整失败日志均保留，不冒充全绿。
- 独立执行原六 owner 同批编译的剩余测试产物：App Server protocol 134、Agent 273、tool-runtime 483、TUI 1879 全部通过；未复用旧版本测试产物。
- CLI bin 106、TUI integration 30 + dependency guard 1、MCP exact JSON-RPC 3、model catalog refresh JSON-RPC 2 全部通过；1 个显式 ignored 与 0 测试 helper 不计作产品通过项。
- locked CLI/App Server/code-mode-host fresh build exit0。冻结 runtime siblings 至 `binaries`，CLI 实读 `lime 1.155.0`；CLI SHA256 `6870bb0311d30e593347fd1bc57ad12d216bcbb6c85126ea15ab6d98b01b853e`，App Server SHA256 `1545757ee6aef50eba715153156c021dc9e90609d4291fab4df5d6e3055db0a8`。
- 正式 `npm run verify:gui-smoke` exit0，run `release-v1.155.0-shell`，macOS arm64 1.155.0，24/24 assertions、39 次真实 preload/IPC `app_server_handle_json_lines`、零 mock fallback/legacy/renderer/preload/invoke errors。证明启动/重载/设置/三尺寸布局，不扩大为 provider turn 或打包产物验收。
- 构建结束后首次直接串行执行 App Server binary 用错仓库根 cwd（Cargo 正常以 crate cwd 执行），造成未修改 skills catalog fixture 的预算断言失败；日志 `rust-app-server-serial.log` 保留。纠正为 crate cwd 后定向 1/1 通过，完整串行复验继续；这是发布验证调用问题，未修改生产代码/断言/timeout。

## 完整 owner 收口与真实命令执行

- App Server 在正确 Cargo crate cwd、构建结束后的串行完整复验 `1803/1803` exit0；两项原失败也在本次完整运行通过。先前并发/调用失败保留，未改断言或 timeout，不宣称其历史间歇性已永久消除。
- 其它四个 owner 同一 fresh test executable 在各自 Cargo crate cwd 最终复验全部通过；与前轮重叠项不累计。六个 library owner 唯一通过项共 4615（43+1803+134+273+483+1879），CLI/TUI/公共 JSON-RPC 集成另 142 项。
- actual OS shell + runtime backend + public stdio fixture exit0：`COMMAND_INVOCATION_STDIO_OK`，Thread `01a12d5d-4275-7cf3-aeac-35f21bac1b96` / Turn `turn_063ee9c776e9444ba1d36a1a5c841673`；实际短/静默/PTY 命令、poll/stdin 原 invocation、准备失败 Unknown、单次开始/完成及 live/read/page/restart cold 完整对象相等通过。
- 固定命令 fixture 是受控 provider 请求，非 live provider。CLI 双流 TTY、13 场景 TUI 与历史分页按顺序验收中。

## 最终本地 Gate 与提交范围

- CLI Gate B exit0，主 Thread `01a12d5d-dcd5-7431-89c7-fce429bd96cc` / Turn `turn_cc109f756fb8421caaf8f34442954574`；外层真实 PTY，`CLI_HUMAN_TTY_OK both-streams=tty final-answer=once`，五语言/JSONL/resume/fork/review/images/schema/stdin/output-file/失败退出与冷读通过。
- TUI Gate B 13 场景 exit0，Thread `01a12d5e-f8f1-7623-b46f-e5420ccd4f8b` / Turn `turn_02f5b72082364a3b9cf834a7a49046d3`；raw notes/IME Tab/revisit/once、typed input/backtrack/cold read、copy/status picker、图片/skills、focus/resize/reconnect均通过；隔离 tmux 屏蔽 SIGWINCH 后自动 reflow、editor期间/归还后 resize、首键、canonical exact与 terminal restoration通过。
- history pagination 独立串行 exit0：Thread `01a12d60-cbd6-7152-b15b-a43318234849` 207 items/3 pages；mouse/pager/main selection、阅读 99->120 分组 join、旧页/最新位置/resize/Esc/草稿/零新 turn/terminal restoration通过。command actions Thread `01a12d60-c596-7be1-8a9f-a16117d7fc45` 证明 real stdio projection 与 TUI read/search/list/Unknown/userShell；seed 命令未实际执行，actual OS execution由另一 stdio fixture证明。
- 固定源码逐项 SHA256 无产品漂移；只允许本文追加证据。主暂存区保持起始空状态。冻结后仅原 TUI/CLI 执行计划追加记录，保留为未提交差异，不覆盖并行工作。
- 提交总范围 240 文件。release metadata：`package.json`、`packages/cli/package.json`、`lime-rs/Cargo.toml`、`lime-rs/Cargo.lock`、双语 release notes、本文；candidate changes为固定清单剩余路径，并完整保留 Cargo 的已有 parser 依赖变化。无被无故排除的起始 candidate。
- 用户的完整发布/no-confirm授权已明确，本轮将使用独立索引与固定源码执行正常 hook 的 release commit，再连续 tag/main/tag push与远端身份复核。tag不覆盖已有引用。
- 本地准备与门禁完成；GitHub 多平台构建/签名/公证、updater R2和npm平台包发布尚未完成。暂不把工作流触发视为完整发布。
