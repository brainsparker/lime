# 共享 Shell 权限解析对齐

状态：completed（Bash/POSIX 与 PowerShell 字面量权限/实际 shell 路由切片均100%）。
归属全局 Codex 对齐计划；全局仍 active / partial，Windows 实机未验证。

目标：普通字符串、注释和文件名不再触发危险命令拒绝；真实危险调用在
复合命令、控制流、命令替换和常用 wrapper 中继续被识别。GUI、CLI、TUI
共用既有 tool-runtime 权限 owner 与 App Server 执行路径。

事实（Bash/POSIX 切片起点）：App Server execution_process 的两条生产校验入口均调用
check_shell_command_permission。Bash 当前对整条源码执行 contains，导致
printf 'SHUTDOWN_PARTIAL' 被拒绝。Codex shell-command/bash.rs 的
parse_shell_lc_literal_commands 遍历 command 节点；危险分类器按 executable
和 argv 判定，递归检查 wrapper。参考 checkout 保持只读。
参考HEAD：a9b0815167c27ab13719dd12d13b63e02b70d221，本轮重新核对未变化。

窄写集：tool-runtime/src/shell_permission.rs 与同名 Bash/tests 子模块；
shell_analysis.rs 和 shell_analysis/bash.rs 的 invocation/path helper（开始时
clean，原内容补入上述备份；路径候选与 mutation warning 接受 argv，删除
仅由旧 permission 使用的字符串设备重定向 helper，不保留双轨）；
scripts/app-server/command-shutdown-fixture.mjs 的真实输出 marker，以及
既有 scripts/agent-runtime/command-continuation-electron-gate-b.mjs 的
COMMAND_SHUTDOWN_READY literal/可见输出断言（原文件先备份）；本计划及
全局计划的索引。开始时 shell_permission 为 clean，fixture 和全局计划属于
本任务既有 untracked 写集，备份 /tmp/lime-shell-policy-before。
收尾补入.gitignore的一条精确计划例外；它原先只有本任务全局计划例外改动，
不触碰其它规则。否则新领域计划会被既有exec-plans冻结白名单忽略。
GUI/TUI projection、settings、i18n、其它 runtime 热区只读；不创建 Agent、
分支或提交。按 KISS 复用现有 tree-sitter/shlex 依赖和路径护栏，不将
presentation parse_command 当作安全证明，不新增后端、协议或依赖。

退出条件：先记录误报回归 red；Bash 字面量、嵌套调用、真正危险命令与
路径护栏 targeted tests 全绿；tool-runtime strict Clippy 通过；新产物真实
stdio/CLI fixture 使用原 SHUTDOWN_PARTIAL 输出通过；共享 GUI current fixture
与 GUI smoke 按风险验证。所有证据明确源码/产物和等级。

范围限制：本切片只收口 Bash/POSIX 语义；PowerShell 的 regex 与解析边界
另行推进，不能以 macOS unit 代替 Windows 实机证据。未知动态语法不作为
安全证明，沿现有 RequiresConfirmation / App Server approval 合同处理。
owner 图、公开 RPC/schema 和 GUI 扩展能力不变，不构成重大架构迁移。

验证进度：

- 标准 targeted unit 首次启动在 V8 归档下载阶段阻塞，未进入 Cargo；构建
  target 和 archive 缓存已在本轮开始前缺失。停止本进程的下载/runner，不
  触碰 Electron dev 进程的并行下载。记录 /tmp/lime-shell-policy-red.log。
- 旧 frozen App Server SHA 为前轮 terminal 的 9413d2be...；恢复真实 fixture
  的 SHUTDOWN_PARTIAL 后 Command 实际变为 failed，未启动 OS process。
  /tmp/lime-shell-policy-fixture-red.log 和 command-shutdown-1kf31f/failure.json。
- 临时 /tmp/lime-shell-policy-red-unit 仅复用备份原模块并加载本轮回归，
  4组red：普通字符串误拒绝、拼接可执行名漏检、动态执行错误Allow、
  ./build删除前缀误拒绝；/tmp/lime-shell-policy-source-red.log。
- 临时 /tmp/lime-shell-policy-unit 通过软链接编译当前真实 policy/path/analysis
  源码，22项全绿；/tmp/lime-shell-policy-source-unit.log。它是独立源码unit
  证据，不冒充完整 tool-runtime crate 或 App Server Gate B。
- 语法树遍历控制流/替换/重定向；literal executable/argv 分类；递归检查
  shell -c、eval 和常用 wrapper，深度上限8。env split-string 与 option operand
  不作为普通命令参数解析。路径候选仍由 shell_analysis/path_guard owner
  承接。quoted executable 与转义拼接正常lowering，presentation parser不参与。
- V8官方归档用断点和4段下载恢复；归档23,542,428字节，官方 SHA-256
  00adbb48798848c77550441c68673a5e8529b8e1b73eabcdee232cb39b40f4a1；
  binding官方摘要ca5adf0c...同时验证，通过后发布到原cache。
  /tmp/lime-shell-policy-v8-ranges.log。未修改依赖、锁文件或源码构建配置。
- 22项源码unit与临时 lib strict Clippy已通过；新增helper不使用allow。
  标准 App Server/tool-runtime unit exit0：1818 + 493 = 2311项，
  /tmp/lime-shell-policy-rust-unit.log。标准 tool-runtime lib strict Clippy
  也exit0，/tmp/lime-shell-policy-build.log（后续CLI构建仍在进行）。
- 初次标准构建等待既有 Electron dev Cargo锁；其Sherpa原生依赖下载恢复
  后继续。不终止或修改开发进程。标准 GUI renderer已重建成功。
- 新 App Server于23:05生成，晚于本轮最后源码修改22:53；新sidecar副本
  /tmp/lime-shell-policy-reviewed.json，App Server摘要
  6e6c013491dbff117f207bff9bc8a1b50cd0513151f04608a44add364d3b488d，
  code-mode-host摘要905994a4a6f6105d453e7c4b8673c41c63807c5b0e1fae9bd25b313b42014932。
  补齐macOS rpath后冻结；该元数据的CLI路径此时仍为旧artifact，未用于CLI验收，
  待本轮CLI构建成功后替换并重新记账。
- 新sidecar真实stdio idle/active EOF fixture均exit0，SHUTDOWN_PARTIAL原字符串
  已执行、关闭后OS进程退出、冷恢复terminal保留原identity及输出；
  /tmp/lime-shell-policy-stdio-final.log。evidence目录分别为
  command-shutdown-tychiX和command-shutdown-5TWapA。
- contracts exit0；fmt、Prettier、docs边界、scripts治理、diff check通过。
  GUI特性保留回归2/2通过，/tmp/lime-shell-policy-kept-features.log，证明现有
  Banner/Hero/主题与多模态/多模型入口（Unit/Component，非真实Desktop证明）。
- 新CLI构建exit0后冻结至同一reviewed目录，CLI摘要
  05892a52c8000c264c296562a8dadfdf420c7df0183355657b431f05c3a64a25。
  后续构建的App Server实际摘要与上述sidecar副本完全一致；元数据CLI路径已
  替换为本轮产物，未将旧CLI用于本轮CLI/TUI验收。
- 完整CLI Gate B exit0：/tmp/lime-shell-policy-cli-gate-b.log，含真实lime exec、
  stdio、三种shutdown、冷恢复、SIGINT、resume/fork、图片、schema和stdin。
  CLI人类输出的外层TTY分支因outer-stdin-tty=false标为not-run；未伪称通过。
- 完整TUI Gate B exit0：/tmp/lime-shell-policy-tui-gate-b.log，真实PTY、alternate
  screen、键盘、审批、中断、图片/Skills、tmux缩放、reconnect和terminal restore。
- 首次Desktop fixture在import electron时发现runtime executable缺失，停在
  下载阶段，没有进入GUI场景。仅终止本fixture的installer子进程并保留失败log
  /tmp/lime-shell-policy-desktop-command.log，不触碰其它桌面进程。
  用标准installer从npm镜像恢复已锁定Electron42.3.3，仍使用package内官方
  checksums.json验证；归档摘要
  13844d9b50c72d1f8aeb5315398119798bdb5bd3fa9e2d89f4306fd501c48c8d。
  /tmp/lime-shell-policy-electron-runtime-restore.log；没有升级或修改manifest/lock。
- 恢复后GUI Command Gate B exit0，/tmp/lime-shell-policy-desktop-command-restored.log。
  仓库证据 .lime/qc/gui-evidence/shell-permission-2026-10-12/command-continuation.json
  和同名PNG。两个live renderer/reload场景均shutdownLiteralVisible=true，原
  Command输出/terminal/草稿保留；真实Electron/preload/IPC/current turn/start，
  sidecar父进程为Electron，mockFallbackCount=0，console/pageErrors为空。
  backend=runtime，liveProviderUsed=false；kind=live指renderer场景，不能当作
  live model证据。已目视截图，Command文本和输出可见，皮肤/Composer入口保留。
- GUI current聚合回归exit0，/tmp/lime-shell-policy-current-fixture.log，涵盖图片/
  自然语言媒体、停止后继续、审批、rich draft、steer、Plan、Skills、MCP、
  typed retry、history和文章工作区；真实Electron current bridge，仍为受控
  provider/backend fixture，liveProviderUsed=false。
- 标准GUI smoke exit0，/tmp/lime-shell-policy-gui-smoke.log；真实Electron启动、
  reload、Settings和三种窗口尺寸。结构化证据
  .lime/qc/project-gates/standalone-shell-01-20261012153747-14802/shell-01-electron-smoke/summary.json，
  result=pass；该smoke只证明shell/布局，不替代上方Command turn证据。

最终裁决：

退出条件全部满足。标准App Server/tool-runtime 2311项unit、lib strict Clippy、
contracts、真实stdio / CLI / TUI / Desktop Command、GUI current聚合与GUI smoke
均exit0；源文件hash和冻结产物hash在最终Gate后无漂移。汇总
/tmp/lime-shell-policy-product-results.json，源码
/tmp/lime-shell-policy-source-hashes.json，产物/tmp/lime-shell-policy-reviewed.json。
当前标准GUI资源manifest也与冻结App Server/code-mode-host摘要相同。

分类：current为既有tool-runtime permission、shell_analysis/path_guard和
App Server执行owner；test-only为两条既有真实fixture及临时源码unit harness。
已删除Bash全文危险子串表、全文warning regex、旧字符串设备重定向helper，
没有compat/deprecated包装或第二套后端。共享argv path helper仍归原owner，
KISS/DRY/单一职责体现在已有grammar/依赖、唯一路径护栏和同名领域子模块。
GUI多模态、多模型、主题、Banner/Hero保持；没有改动GUI/TUI projection、
settings、i18n、外部Codex checkout、公开协议、schema、依赖或锁文件。
未创建Agent、提交、推送、分支或修改用户数据。

完成度仅适用于Bash/POSIX切片100%。PowerShell文本regex、Windows实机、live
provider、packaged和Codex Desktop视觉仍未验证；全局目录/命名/风格矩阵及
Command取消终态分类保持active。未跑verify:local全仓聚合或workspace all-target
strict，不把当前lib strict与定向/产品Gate提升为全平台或release readiness。

## PowerShell 与实际 shell 路由切片（2026-10-13，completed）

主目标：三端继续共用 App Server / tool-runtime，权限判断依据真实 argv 与字面量
命令语义；删除 PowerShell 全文危险/警告 regex 的普通文本误报。

窄写集：tool-runtime 的 shell.rs、shell_permission.rs 与同名子模块/tests、
shell_analysis.rs、shell_analysis/common.rs、shell_analysis/powershell.rs、
unified_exec/shell.rs 与既有 tests；App Server execution_process.rs 仅权限调用
签名与 argv 传递点、同名 tests；workspace / tool-runtime manifest 与 Cargo.lock；
本执行计划和全局执行计划。新 PowerShell literal parser 留在 permission owner，
保留 Codex Apache-2.0 LICENSE / NOTICE。初始备份 /tmp/lime-powershell-policy-before。

避让：GUI/TUI projection、settings、i18n、runtime canonical 等未知脏热区；
execution_process.rs 的非权限逻辑不接管。公开 Codex checkout 只读。
本轮用户持续授权当前全局对齐，无提交、推送、分支、子 Agent 或全局安装。

只读发现：PowerShell 旧全文 regex 对 Write-Output 的危险字面量误拒绝；
check_shell_command_permission 按 OS 而非 argv 分流；shell text stripping 不支持
绝对 shell path / -lc；macOS 显式 pwsh 仍被构造为 POSIX -lc。
参考 Codex a9b0815167c27ab13719dd12d13b63e02b70d221 的
shell-command/command_safety/powershell_tree_sitter.rs。采用受限 CST + literal argv，
未知、parse recovery、动态与 #requires 必须 RequiresConfirmation，不能安全推断。
不接入 presentation parser，不建立 runtime AST 子进程池或第二套后端。

退出条件：先取得误报与路由 red；新增字面量/真实危险/动态/嵌套/路径回归；
定向与标准 owner tests、fmt/lib strict、manifest/version 与 contracts 通过；
新产物 stdio/CLI/TUI/GUI current 与 GUI smoke；能取得 portable pwsh 时补真实
PowerShell 执行，仅运行无害命令。没有 Windows 本机、live provider、packaged
证据时显式记录未验证。共享审批合同保持，不把 RequiresConfirmation 说成硬拒绝。
本切片未完成，全局仍 active / partial，没有可信全局百分比分母。

写集追加：shell_permission/bash.rs 只补跨 shell 委托；scripts/app-server/powershell-command-fixture.mjs 新增 test-only 真实 stdio/CLI PowerShell fixture，复用既有 provider 与协议消费者，无生产入口。

进展：

- 标准 tool-runtime 原实现 red（2组失败）和 App Server argv路由 red（1组失败）
  已取得：/tmp/lime-powershell-policy-red.log、/tmp/lime-powershell-policy-route-red.log。
- 新增 tree-sitter-powershell =0.26.4，与 Codex 固定版本一致；manifest消费者与
  Cargo.lock同步，仅新增1个package。协议/schema未变。
- Codex PowerShell literal CST 与 AST输出语料保留 Apache-2.0 LICENSE/NOTICE，
  适配 Rust 2021，不升级edition；parser、分类、路径guard仍各守单一职责。
  语料全部通过；动态/复杂语法与 #requires 保守审批，原全文危险/警告regex删除。
- 按实际argv辨认POSIX/PowerShell/CMD，不再按OS猜测；绝对路径、-lc、脚本边界
  保留；pwsh 在所有平台使用 -Command，login=false携带-NoProfile。跨shell递归
  委托并共用深度上限8。CMD仍为opaque/approval，不宣称完整CMD语义解析。
- 首次literal回归的 Rest`art 是BEL转义，不是Restart；校正为真实 Re`start。
  首次移植遇Rust2024 let-chain语法，已用Rust2021同义代码适配；失败证据保留在
  /tmp/lime-powershell-policy-targeted.log（该日志后续覆盖为新源码定向结果）。
- 官方PowerShell7.6.6 portable归档70,604,356字节，SHA-256
  6df833d094ebac1c1a74340d7b3437f4aaf5e03ce640484a1c4359f3ce8b3db1，
  与官方GitHub release digest一致；隔离/tmp/lime-powershell-7.6.6，真实版本与
  Write-Output测试通过。不全局安装、不修改系统环境；网络失败后官方Range分段
  下载并验证完整摘要。/tmp/lime-powershell-download.log。
- 首次strict Clippy误包含transitive crate，报既有agent-protocol large_enum_variant /
  derivable_impls；只读登记，未接管其owner。随后按tool-runtime lib --no-deps
  strict边界验证，不使用allow压制；不冒充workspace all-target全绿。

追加认领上一轮持有的 scripts/agent-runtime/command-continuation-electron-gate-b.mjs：可选显式 PowerShell shell，复用已有 live/reload 场景、preload/IPC、canonical output 和草稿断言，不改 GUI 实现。

2026-10-13 新产物验证中：

- 标准tool-runtime500/500、App Server1819/1819全部通过；首次默认高并发
  App Server两项失败为late durable identity recovery与1秒external stream timeout。
  无产品或测试断言修改，降低为8个test线程后整套1819项绿；首轮与续跑log均保留。
  /tmp/lime-powershell-policy-tool-runtime.log、/tmp/lime-powershell-policy-app-server-retry.log、
  首轮 /tmp/lime-powershell-policy-rust-unit.log。共2319项，不把68条corpus重复加总。
- tool-runtime lib --no-deps strict Clippy与CLI/App Server/code-mode-host标准构建
  exit0；contracts、app-version、scripts governance、crate fmt、GUI特性保留2/2通过。
  源码快照 /tmp/lime-powershell-policy-source-hashes.json；GUI特性回归只属Unit/Component。
- 冻结新产物 /tmp/lime-powershell-policy-reviewed.json，目录
  /var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/powershell-policy-reviewed-5j0Thm：
  CLI 1a53fda15d1c0727e29d02fa465852976cef6d3435e0fbf9a46c205d327bf039；
  App Server 008414d463205c5ee7821a42e2bc72255e9ed77b7e4b86dc0235782d7184a342；
  code-mode-host 2995b4c18c42c3d8da9645c8d84982b1b2b15a7c15a0cd3dc54cc6983fe3b71b。
  先收取build exit0、补macOS loader rpath再冻结，后续产品gate均选此副本。
- 新PowerShell stdio与真实CLI Gate B均exit0，分别
  /tmp/lime-powershell-policy-powershell-stdio.log与-powershell-cli.log。
  真实portable pwsh执行原Restart-Computer字面量、读取带空格文件名和encoded
  Clear-Disk普通输出；runtime provider capture、actual processId、两次tool执行、
  canonical Thread/Turn/Item、分页与冷读完全一致。仅执行无害命令；危险分类只测
  policy、没有启动危险OS命令。liveProviderUsed=false。

复查新增发现：Codex默认删除别名包含rd/rmdir。当前literal parser已正确lowering，
但原shell_analysis alias表漏了这两项与clc，导致rd .git/config错误Allow。
先保留标准owner red /tmp/lime-powershell-policy-alias-red.log，再在同一alias owner
补齐，root移除判断直接使用PathMutationKind::Remove，删除permission重复alias
名单；saps/start/Invoke-Item/ii也按真实process launch走审批，quoted data仍Allow。
该补丁晚于第一次产物冻结；第一轮产品结果属于前一冻结版本，不冒充最终源码。
最终需新构建/新冻结/重验，相关log用alias-final和final前缀区分。

首轮Desktop PowerShell场景实际进程成功输出Restart-Computer，但fixture在running
行内找输出，120秒timeout。真实event-store有两条实际output delta，失败截图显示
摘要折叠；ToolCallDisplay的running状态暂不展示result panel，且panel是row的同级。
这是fixture断言时机/DOM范围错误，未修改GUI产品来迁就测试。现改为等待原进程
completed，再显式点击原组件输出disclosure并在result panel内断言文本；消除原
marker只命中command headline的弱证据。首次失败json/png另存first前缀。
运行中结果面板的产品差异登记为全局下一刀，当前窄permission写集不接管GUI热区。

最终源码阶段（2026-10-13）：

- 最后别名补丁后标准tool-runtime501项、App Server1819项均全绿，共2320项。
  tool-runtime lib --no-deps strict Clippy通过；无allow、无测试断言弱化。
  /tmp/lime-powershell-policy-alias-final.log与-final-app-server.log。
- 最终重建/冻结元数据 /tmp/lime-powershell-policy-final-reviewed.json：
  CLI 1a53fda15d1c0727e29d02fa465852976cef6d3435e0fbf9a46c205d327bf039；
  App Server 6a0b2df6aa4a4b4dcd24db02bb36c36fec1c1bcd6a5ac92b9806ca1ecc1958f4；
  code-mode-host 2995b4c18c42c3d8da9645c8d84982b1b2b15a7c15a0cd3dc54cc6983fe3b71b。
  CLI/code-mode-host摘要未变是相同源码的可复用产物，App Server对应最终policy。
  最终源码快照 /tmp/lime-powershell-policy-final-source-hashes.json。
- 最终真实Desktop PowerShell两场景exit0，原Restart-Computer普通文本在真正
  result panel可见，canonical output同内容；renderer reload原identity/stream
  notification/终态/草稿保持，sidecar父进程=Electron，preload/IPC=true，mock=0，
  console/pageErrors为空。已目视截图；证据
  .lime/qc/gui-evidence/powershell-permission-2026-10-13/command-continuation.json及PNG。
  kind=live是renderer场景，backend=runtime且liveProviderUsed=false，不当live模型证明。
- 最终PowerShell stdio与CLI都exit0，repo evidence为同目录powershell-stdio.json /
  powershell-cli.json，portable可执行文件sha256
  86966ef5e53763c0d7cac9981b9b36c30245185dc347ca69ddfb815c665bf515。
- 最终完整CLI Gate B exit0，-final-cli-gate-b.log，恢复/中断/三种shutdown/图片/
  schema/stdin与输出文件通过；outer-stdin-tty=false的人类TTY分支显式not-run。
  TUI / GUI current聚合 / GUI smoke继续收取退出状态，不提前标完成。

全局后续差异登记：运行中ToolCallDisplay result panel隐藏，现仅验收到process
completed后的真实结果。PowerShell PTY启动的CSI private mode序列在GUI文字中有
[?1h残留（截图可见），需后续共享terminal output/presentation owner单独处理。
本切片没有修改投影来掩盖这两项；不把permission验收扩大成全视觉复刻完成。

### PowerShell 切片最终裁决

最后别名补丁后的7条产品gate均exit0：真实PowerShell stdio、真实PowerShell CLI、
完整CLI Gate B、完整TUI Gate B、PowerShell Desktop live/reload、GUI current聚合、
标准GUI smoke。TUI是实际PTY/alternate screen/键盘/审批/中断/resize/reconnect和
terminal restore；该完整终端回归不是Windows TUI实机或TUI PowerShell专用场景。
GUI current聚合继续覆盖图片/媒体、审批、停止继续、rich draft、steer、Plan、
Skills、MCP、retry、history和文章工作区；真实current bridge，liveProviderUsed=false。
GUI smoke真实Electron启动/reload/Settings和3种尺寸，结构化摘要为
.lime/qc/project-gates/standalone-shell-01-20261012171312-27936/shell-01-electron-smoke/summary.json，
result=pass。各-final-\*.log与/tmp/lime-powershell-policy-final-product-results.json
分别记录退出状态；所有必要进程session均收取exit0。

源码/冻结产物最后无漂移。仓库验收账本
.lime/qc/gui-evidence/powershell-permission-2026-10-13/validation.json收录最终hash、
标准GUI资源摘要、2320项Rust unit、68条AST corpus、产品gate及未验证边界。
标准GUI resource摘要独立记录，不以冻结副本代替resource实际产物。

治理分类：current为既有tool-runtime permission、shell/shell_analysis/path_guard与
App Server执行owner；test-only为68条Codex AST语料、专用stdio/CLI fixture与既有
Desktop fixture；deleted为PowerShell全文danger/warning regex、字符串symlink/git/
sleep权限入口与未使用normalize工具名helper。未新增compat/deprecated双轨或后端。
受限parser只负责literal lowering；未知语法/动态/#requires进入既有审批合同，
RequiresConfirmation不是安全证明，也不是不可绕过硬拒绝。仍未接入AST oracle，
here-string/call operator/scriptblock/redirection不猜测为literal安全命令。

工程原则：KISS用既有App Server调用点直接传argv，未知语法保守审批；DRY由
唯一shell kind、Git invocation和path guard承接，共享跨shell委托/深度8；单一
职责分离CST lowering、命令分类与路径owner。新增非生成Rust模块均小于800行，
保留Apache-2.0归因，仅增加固定grammar依赖及同步lock，不改协议/schema或GUI文案。
本轮实际写集即上方窄写集（含明确追加的Bash委托与两条fixture）；GUI/TUI投影、
settings、i18n、architecture和取消终态未知脏热区未接管，没有提交/推送/分支/
子Agent/全局安装/用户数据修改。下一刀仍由当前任务按新窄写集推进GUI运行中
Command输出及CSI展示；取消分类需先完整追踪Codex error mapping再决定修改。

本切片退出条件完成，100%。全局仍partial；Windows实机、live provider、packaged、
Codex Desktop真实视觉及全仓verify:local/all-target strict未验证，原因是本次限定
macOS共享权限切片且相关owner/平台证据独立；不升级为全面复刻或release readiness。
全局完成度没有可信分母，不编造百分比。已发现的GUI两项展示差异和目录/命名/
风格映射继续按全局计划推进。
