# Codex 侧栏与退役链清理

状态：active / partial。负责人：当前 Codex 实施进程。目标：按用户指定的 `rail-with-contextual-sidebar` 完成侧栏布局、交互、结构和清理，保留主题、多模型、首页 Banner。没有提交、推送、建分支、清理空间或停止其他进程。

## 事实与映射

安装包 `/Applications/ChatGPT.app` 实际 Bundle ID 为 `com.openai.codex`，26.1007.30912 / build20156；ASAR SHA256 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。复用匹配版本的 REA，并使用独立 Node24.21.0。

| 上游证据 | current owner / 合同 | 迁移或清理 |
| --- | --- | --- |
| REA `ev_e37514ba7ab0a3a548c79b19cc73f04b773ba1729431084041a070a2d12a7ce6`、`ev_7c1332bc5041f6a27c07cf90d25764e8887a52f283930a6af3aa0ca320f075cc`，完整 createWindow/getPrimaryMinimumSize 与 Qge 声明 | electron/main.ts：primary 初始1280×820、最小480×600，屏幕实际可用区域仍由原生窗口系统约束 | 删除1440×920及980×680旧值；fixture不再修改生产minimum，直接核验原生getMinimumSize/getContentSize |
| REA `ev_ae91adc4fca524b34a183b550a9641a0be0794f621774d96b8c68457934fc090`，cDs / D2o | AppSidebar / useSidebarWidth / SidebarResizeHandle：展开290..520、折叠52、设置240..520 | 删除展开240下限，约束旧宽度偏好；共享宽度机制接受实际宿主下限 |
| REA `ev_0d32cbac7d5e943a3dc16c798513bb3eaede212d475bb2d3978f4242182128ce`，nSs / g2 / navigation CSS | AppSidebarSection / useSidebarSections / ConversationShelf：30px/r10/p8、分组折叠、hover操作、Projects5、Recents独立10、当前identity保留 | 删除分组前合计截断、孤立split helper、常驻分组操作排版；[详细计划](codex-sidebar-sections-20261020.md) |
| 本轮 REA `ev_06897fd3c273c7d856bbe452f07615486591d2ce1bdceac0a1cac5cd1101f28d`，iPo → ZNo → QNo → ProfileDropdownItems | SidebarProfileFooter / ProfileDropdownItems：36px紧凑入口、24px头像、right/end菜单、共享账号登录/退出/资料/用量/设置 | 删除旧AppSidebarAccountMenu、卡片/套餐/语言子菜单孤岛及约580行Account样式；迁移5语言、测试和fixture消费者 |
| REA50/55、rpt / chl / oLt | ComposerLayout / useComposerLayout / InputbarCore：普通默认multiline，实际听写waveform/text、IME锁layout、保持EditorView、溢出观察 | 不恢复空稿缩小；清理固定layout无实际听写状态接线；4文件44项定向回归，包含真实EditorView的IME/听写切换 |
| 公开Codex canonical Thread/Turn/Item，现存恢复owner | App Server protocol/client/runtime及canonical renderer history | 删除conversationImport协议/scan/preview/commit/job、导入专用runtime、元数据、摘要、超时、renderer路径、19个脚本及旧正向护栏；有效历史/流式/图片/失败/分页测试迁到current owner |

压缩符号不是原始源码名称。只有 `ProfileDropdownItems` 是安装包明确导出；其余采用现有职责命名，不制造同名包装。账号仅消费 `cloudAccount` 投影，登录退出委托既有App Server账号owner。显示顺序/折叠是本地presentation偏好，不存业务会话。

本轮账号静态原件、摘要与REA完整记录位于 `artifacts/codex-sidebar-20261020/account/`：4/4文件解析、0失败、57716字节；未执行参考包。REA原件还确认Codex具有条件性invite与Help能力：删除的是Lime旧referral业务链，不能声称Codex完全没有邀请功能。目标邀请/Help/远端账号能力尚需按真实服务合同对齐，不恢复旧Lime返利实现冒充。

Codex支持标题/rename与自定义Thread Section，保留canonical能力；需隐藏的是被UnifiedTabStrip接管后的重复标题。36px Home conversations条件分支尚无参考运行证据，不把全部行硬改36。

## 写集与架构确认

本轮只修改侧栏/Composer/导入及referral退役链、其直接资源/消费者/生成物/测试/护栏、计划。避让工作树中并行provider turn/reasoning/memory等Rust改动；schema重新生成包含这些已有合法变更，不回滚。

架构责任确认：当前实施进程核对 `internal/aiprompts/architecture.md`，删除导入架构段并记录退役；没有新runtime、业务store、transport或authority。主链保持 `Desktop Host -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection`。

## Agent Verification Contract

- 预算：normal；风险P1；使用本地受控fixture，不调用live provider。
- GUI入口：AppSidebar / InputbarCore；网关：current账号/线程/turn typed client；bridge：preload/IPC `app_server_handle_json_lines`。
- App Server：账号account/read/login/logout；历史thread/read、thread/turns/list、thread/list及现有turn/start，不再有conversationImport方法。
- read model：同一canonical Thread/Turn/Item、CloudAccountView只投影共享账号。
- 成功：独立分组预算与当前identity正确、折叠/排序可恢复、账号菜单键盘可用、听写切换保留EditorView；普通历史不受导入元数据控制。
- 失败：账号失败可重试；provider/tool失败保持canonical终态；禁止生产mock fallback、跳过退出门禁或手改通过收据。
- 必需证据：定向组件/协议/契约、真实Electron新产物smoke、受影响current fixture、GUI状态与IPC/RPC关联；本轮不声称Windows或参考GUI运行通过。

## 验证与退出条件

已通过：protocol 143单元+1schema集成、client128、历史投影/清理28文件546用例、Composer23、分组8文件70、账号4、完整test:contracts、renderer类型、app-version、scripts治理；具体新源码全量复验由收尾记录覆盖。

进行中：目标附件与同步问答后继、最终shell/types、新renderer/host、GUI smoke和current fixture。旧二进制reviewer fixture首回合出现读取interrupted但durable最终completed，原始失败保留；根因修复与新sidecar重验由后段记录。

退出需同时满足：current调用零残留、退役路径物理删除、有效回归迁移、五语言通过、新产物真实Electron证据、无未处理本轮失败。整体GUI仍partial；异步awaited、新线程目标、参考运行flag、完整菜单/账号及Help新产物等未验收项继续归current主计划，局部通过不等于全面完成。

分类：current为上表唯一owner；新增compat/deprecated为0；dead/deleted为导入链、旧referral链与旧账号卡片孤岛。无法给整体GUI编造完成百分比；本切片按上表五类逐项验收，不把静态证据当运行通过。

### r5 真实分页失败与读取层修复

`codex-sidebar-20261020-r5` 保留失败：真实 canonical seed 为 7 项目、23 线程；中间位置的 Recents 固定 10 条只显示 9 条。源码根因为 `listCanonicalSessionOverviews` 遍历 Pinned、custom、null scope 后共用 `requestedLimit=11` 并对合并结果截断，前两组各占一条，不是虚拟化。此前 r3/r4 和本次失败均不覆盖。

侧栏改用既有 session gateway 的 `listRecentThreads`，保留真实 canonical `nextCursor`。唯一 `loadSidebarSessions` 分别读取 source，未分组含大量项目线程时推进 cursor 到独立 Recents 预算或来源结束；分类复用 `sessionBelongsToProject`。删除 hook 内旧平面请求 helper，不改通用列表总预算，不新增业务 store/read model。参考 REA 补证确认 catalog pageScope/host 独立 cursor/exhausted；Codex 主 sidebar source 没有 sectionId，Lime 的分组 scope 是本地协议适配，不能冒称参考原 RPC 拆分或已完成全部 catalog scheduler。

初次回归的 5 文件 46 项通过，首轮夹具 sourceHasMore 预期错误日志保留。后继追加“短页有 cursor/full 页无 cursor”回归，不以长度猜来源结束；最终 tests/types/新产物 Electron 按后继收据结算。临时 prefix 重读方案已直接替换，不保留双轨或 sectionId 内部 option。

### r6—r8 与原生窗口纠偏

r6 已真实加载14条后，自动分页卸载sentinel导致测试滚动节点detach；改为滚动稳定容器，仍严格断言14条。r7 已通过两种分页、折叠/排序恢复、身份与hover，随后请求960×900实际为980×797：旧minWidth与当前显示器workArea共同限制原生窗口。r8临时降低自有测试窗口minimum、使用720高度后通过浅色三宽、Profile/Help底部几何、Dialog焦点与设置内快捷键；随后从Settings点击已卸载的sidebar入口超时，改走现有settings-back-button再回Home。三轮失败与正常Main退出收据全部保留，不改写为通过。

独立REA补证后直接修正生产primary尺寸，并删除r8的minimum override；新run继续断言生产minimum480×600及真实contentSize，不用CDP视口冒充原生尺寸。原件位于 `artifacts/file-target-closure-20261020/`，完整方法24/24解析、常量1/1解析、无parse failure；这只是指定安装包静态证据，不证明参考GUI运行或Windows布局。当前窄写集为main窗口选项、sidebar fixture、计划/架构/证据索引；不碰并行Rust热区。Host重建及后继真实验收执行中。

## 深层合同收敛与当前验证（2026-10-20）

追加验证与修正：App Server 最终大集原为1944/1947通过；两处新回归的预期误写已校正为canonical `item_message-1`与`canonical_thread_store`，canonical筛选273/273通过。第三处Skills watcher失败经对照确认存在通知先于watch迁移的竞态，现回调只signal，同一reconcile任务先重建watch再通知；旧顺序两项确定性回归均失败，最终watcher12/12通过，未增加sleep或放宽超时。日志分别为`/tmp/lime-skills-watcher-order-{red,green}-20261020.log`。

侧栏Gate B首轮保留失败：RPC已写入7项目/23线程，正常退出成功，但固定10条断言没有区分分页模式。沿同一ASAR补读`nSs -> TSs -> kPo -> _Po`并经REA得到`ev_95e17fe1ed110460bab4d65b5b01580c6a3b2cc9e6d31969caba53faa847ec2c`（4/4解析、41603bytes、14376 AST、0 parse failure；semantic unknown、无参考运行）。确认最后一组使用infiniteScroll，其余使用button；forced item追加到首屏之后，不替换首屏最后一条；来源已结束且只剩一条时直接展示。实现、组件测试与真实fixture一起迁移。不能把高窗口自动显示14条误报为Codex差距；真实fixture分别验无限滚动、移动分组后的10条初始预算和显式展开。新产物通过前仍为partial。

继续检查四层消费者后，发现退役导入metadata仍能影响canonical设置、事件/Item与公共协议。本轮直接删除导入identity/query、nested importedContinuation/importedThreadSettings读取和回写、source timestamp/消息合并/Plan ID旁路及public ThreadItemMetadata/ThreadItemSourceProvenance。公共schema、生成客户端、所有Rust/TUI构造与TS reader同步迁移；当前工具metadata和typed plan字段保留。canonical文件读取仍由当前操作标记表示，旧sourceProvenance不能把文件变更改判为只读产物。

canonical顶层provider/model/cwd/approval等是唯一sticky defaults。history ingestion只接受本次request/harness显式选项，旧session kind不能自动开启。增加负向回归覆盖旧nested配置不能覆盖当前字段、历史标记不能改变文件动作及默认ingest。canonical settings恢复/repair、当前reviewer override和cold resume均保留，未新增兼容层。

新App Server严格public reviewer fixture已通过：binary SHA `12e0939883e16b32397a1034ddab98f6668b8172264d414d7664d5f8ee22d0dc`，runtime backend、本地受控provider，6回合覆盖user approved及auto_review approved/denied/invalid/cancel，实际执行3条命令，thread/read终态一致。日志 `/tmp/lime-codex-reviewer-fixture-r4.log`。这是App Server integration，不替代Electron或live provider。

Help与真实UI命令注册表按REA审计实现：Profile Help子菜单实际bottom几何、独立KeyboardShortcutsDialog、同一showKeyboardShortcuts、真实搜索/设置/文档handler与平台键位；AppShell唯一常驻Host在Sidebar卸载后继续持有注册、弹窗和返回焦点。旧文档hotkey静态副本4文件删除并补dead守卫。最终10套58项、renderer types/strict lint/docs通过；jsdom不支持HeaderToolbar既有@container语法的4条parser日志保留，未屏蔽。实际桌面菜单/焦点/设置快捷键待本轮fixture验收。已有线程目标纯文本纵切97项通过、旧独立编辑框与弹窗删除，附件后继在实施。architecture已同步Renderer owner和责任确认；无新runtime或authority。

线程读取修复：首次取得inProgress后等待actor，期间真实terminal已经持久化时，旧逻辑会误判interrupted。现仅对疑似孤立候选在采样后复核canonical，复制完整terminal并保留原itemsView/分页成员/游标；真正cold orphan仍interrupted。Codex参考为8c076942的thread_processor/read_thread_view与thread_lifecycle。16项确定性回归通过，含三入口21组terminal/view组合；最新sidecar严格reviewer公共JSON-RPC fixture再次通过，二进制SHA `91331a9169a4ab6f49d63fc69b2ca2a47971f0ef592549c5dd84b86788463941`，六回合、三条真实命令，受控provider/live=false，日志`/tmp/lime-codex-reviewer-fixture-r5.log`。专项计划thread-runtime-snapshot-consistency-2026-10-20.md的实现摘要归并于此，避免被本地忽略规则遮蔽。

五语言本轮累计删除760条死文案（675条旧入口＋85条无消费者knowledge状态）；删除knowledgeHubState及其镜像测试。完整率100%、missing/extra/unused均0。侧栏统一new-chat ID及17处消费者，5文件80项通过；Composer4文件44项通过。没有为了旧测试恢复旧导航栏。

verify:local首次在第15/139批因首页夹具断言旧线程导航失败；已迁移canonical路由与旧账号/导入/mention/知识包等fixture，保留换号、迟到、注销、canonical历史及富输入的有效覆盖。r16续跑最终147/147批通过（`.lime/test/vitest-smart-last-run.json`，日志`/tmp/lime-codex-frontend-resume-node24-r16.log`）；生产入口扫描排除testFixtures，未把测试夹具加入生产白名单。完整test:contracts r7通过。默认入口r6此前lint/五语言/完整类型通过；r7在实施中问答import的lint失败已交责任代理修正，不能把分阶段通过写成默认入口一次通过。后继owner改动补定向回归；最终构建/真实Electron与current fixture待结算。
