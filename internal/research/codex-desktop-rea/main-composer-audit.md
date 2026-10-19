# 主 Composer：结构、输入与生命周期

校准日期：2026-10-14。参考为本机 Codex Desktop `26.1007.30912` / build `20156`；ASAR SHA-256
`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
本页记录静态观察与实施合同；测试结果以 [当前执行计划](../../exec-plans/codex-gui-alignment-current-plan.md) 为准。

## 证据与名称边界

| 证据                                                                  | 覆盖与限制                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ev_18100ea823ab540f529ba756499161870e17f824267ed48a0665d3fb48cd0bb4` | 主模块 structural complete；semantic partial，100000 node ceiling；parse failures 0         |
| `ev_f20dbab9b4c0a7e6ef566e91958157ca9196742f7ffed73c8682055b7bdf3d16` | `xc` export / local `$X`；返回形状 unknown，Unsupported SequenceExpression                  |
| `ev_38693c282fb15af95ea4b8f1caa292ed199fee587ea26d709b126123c3fb8153` | initial 六个 inert 声明；structural complete，semantic unknown；不含原模块 bootstrap 上下文 |

原成员 `webview/assets/app-primary-6f60e9ac4103.js` SHA-256：
`7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321`。
`webview/assets/app-initial-6350d04672d0.js` SHA-256：
`604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`。
以下锚点均为原文件 UTF16 半开区间，不是格式化副本的行号。

主路径为 `LocalConversationPage.uc → app-primary.xc/$X → rpt → Qft`。
`RichTextInput` 与 `CodexComposerAdapter` 只确认样式/诊断名称，未确认同名 descriptive export；
压缩局部符号不作为 Lime 函数、类、目录的迁名依据。UtilityBar、BrowserSkillsComposer 和 Sketch 不代表主 editor。

| 上游职责 / 锚点                                                                         | Lime current owner                             | 对齐范围                                                                          |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `xc` export `[2384511,2384519)`；wrapper `[1410893,1411176)`；`rpt` `[1411176,1427548)` | Inputbar / useInputbarController               | adapter、scope、生命周期；不机械迁压缩名                                          |
| `Qft` `[1364761,1409306)`                                                               | InputbarCore / useInputbarSend                 | 草稿、附件、model/mode、history、queue/steer、submit、voice 组合                  |
| `ft/Rhl` provider；`DBc` `[10301258,10301696)`；`jBc` `[10302274,10326275)`             | useComposerController / ComposerController     | 唯一结构化 draft/intent owner；开发源码类名 unknown                               |
| `cBc` `[10281650,10293903)`；`uHc` `[10366158,10371697)`                                | ComposerEditor / composerKeymap / BaseComposer | Controller state + EditorView transaction、schema/keymap 分工；真实产品验收见计划 |

## 附件 generation

上游文件附件 `Cst` 捕获 generation `[1186874,1186885)`，完成后检查
`[1187110,1187123)` 与取消 ID `[1187125,1187133)`；host 变化递增
`[1345094,1345106)`；Qft 清空草稿递增 `[1386648,1386661)`，显式递增 callback
`[1388227,1388240)`。这支持生命周期边界，不证明每条上游图片 helper 与本地实现精确等价。

Lime 首页 `useEmptyStateAttachments` 和会话 `useImageAttachments` 原来在 await 后直接 append，
clear/replace 不失效旧读取。deferred FileReader 已在两个 hook 中复现 clear、replace、unmount 后的旧 success/error；
修复限定为共享 generation/lifecycle 原语，附件 state、格式、容量、路径与用户文案仍由原 owner 处理。
迟到 success 不改变新草稿，迟到 error 不发送旧 toast；新代正常接收必须有正向回归。
不能由此推导跨线程挂载或跨重启图片持久化已证明。

## IME 与显式提交

`cBc` 在 UTF16 `10282434` 检查 `event.isComposing / view.composing / keyCode===229`；
`uHc` 在 `10371337` 的 compositionEnd 只更新编辑状态。`jBc` 的
addSubmitHandler `[10321981,10322190)`、requestSubmitWhenReady `[10322190,10322389)`、
setSubmitReady `[10322389,10322456)`、submitPendingWhenReady `[10322569,10322759)`
属于显式请求、submitReady、isCurrent 和文档 watcher 的提交协调，不是候选确认自动发送。

Lime 删除候选 Enter → pendingImeSendRef → compositionEnd RAF send 的旧路径及 `ime` trigger 类型。
compositionstart/ref、native isComposing、Process、229 保护编辑；候选确认与 compositionEnd 均不提交，
下一次普通 Enter或显式按钮继续走现有提交链。按钮行为不由组合状态一概禁止。
旧“确认候选自动发送”正向测试迁为负向及随后显式提交正向，未新增 compat。

真实 Electron rich-input fixture 的 IME 证据使用合成 DOM composition/keydown，检查无提交 IPC、同线程空 canonical 历史，
再通过真实按钮提交富输入。它证明产品事件/请求边界，不冒充 macOS/Windows 系统输入法候选窗口或 Codex 实时 GUI。

## 已实施结构与验证边界

Lime 已直接替换主 textarea 为 ProseMirror EditorView。Controller 持有唯一 EditorState；View 回交事务，snapshot/revision 原子发布。严格 JSON、atom、paste、history 和 UTF16/UTF8 映射各有独立 owner；现有 `@tiptap/pm` 提供实现，不复制上游应用源码。

receipt 的 draft 保留原始折叠 JSON 和资源用于恢复，submission 展开 paste 并携带 typed textElements/mentions，显式传至 start/steer/queue。Workspace 共享 Controller 跨首页与会话，避免 surface 切换丢草稿；发送锁必须等实际接受结果，旧 revision 不能 clear 新输入。原 Plugin/Skill sidecar badge 与文本替换 helpers 已删除，主输入命名和五语言 key 迁为 editor；fixture 使用唯一可见同 session contenteditable，真实 DOM 键盘/粘贴驱动 EditorView。

上述为实现结构，单测、fixture oracle 和真实 Electron Gate 结果以当前执行计划为准；不复用旧 textarea 门禁作为新产品证据。

## 剩余结构合同

- 上游 scoped JSON document retention keys 为 `composer-retained-documents-v1` / `composer-prompt-drafts-v2`；Lime 已采用 Controller → ComposerDraftCoordinator → PersistedAtomHost/Store/File 的持久草稿主链，存储与公开导航合同见[保存补证](composer-draft-persistence-audit.md)。局部重载/恢复验收不能关闭所有窗口 quit、跨进程耐久性和附件恢复分支。
- Lime 已有 draft revision commit 和 inputRestoreEpoch；提交失败保留草稿、旧回执不清理新输入，不能报告为整套保护缺失。
- 完整 marks/code-block/link、按线程/跨重启 persistent rich draft、staged worktree、系统 voice 和 Queue durable active handoff 仍需逐项关闭；当前 schema 与 in-memory scope 不等于完整 Composer 已复刻。
- 主题、多模型与首页 Banner 为用户明确保留项，均不复制 runtime/read model owner。

原始 Evidence 和只读 findings 位于 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/` 的
`composer-editor-*-evidence.json`、`composer-editor-export-view.json`、`composer-editor-findings.json`
及 `composer-editor-controller-observations.json`。仓库只保留映射与 identity，不纳入参考应用源码。

## 2026-10-19 主视图与底栏校准

47 的主控制链 parent `ev_0b3be8d21e101b4df02aae5ed05108e403a702ade047f8bf3b4d022d378aa914` 包含 Qft/rpt/$X 三个完整声明，61,203 bytes、16,322 AST、parse 0、semantic unknown 2,913。48 的 parent `ev_f2b3325f4913e5eb8a5c6ea5f703ac3d62f91a4187872dd3d62ac9d9624ab667` 包含 X7e、Fdl、布局槽位及 scope assignment 共 23 个完整片段，42,080 bytes、15,843 AST、parse 0、semantic unknown 2,882。两次都只解析 inert 安装包字节，没有执行参考 GUI。

实际链路为 `Qft → X7e → app-initial.On/Fdl → $S.AdaptiveFooter/Input/FooterControls`。`$S` 的明文槽位包括 `Body`、`Input`、`AdaptiveFooter`、`FooterInlineControls`、`FooterExpandingControls`、`FooterActions`；原函数名仍是压缩符号。多行模式输入占满首行，leading controls 和 model/secondary/primary actions 位于底行；单行和 dictation 有独立自适应规则。展开控制独立于发送动作，输入区为其预留尾部空间。

CSS 成员 `webview/assets/app-initial-99e8b4b455fa.css` SHA `1a75f9180b89d2457dc09e4efea288436c9cf6d44e5ba59b2c03d3d571b7bf61` 的匹配规则使用 grid、多行三列 `minmax(0,auto) auto minmax(0,1fr)`、5px 列间隔和共享 footer 底距；没有旧 Lime 输入两侧按钮加独立分隔底栏的结构。CSS 匹配属于安装包静态辅助证据，不能据此声称参考运行中的模式或主题值。

Lime current 多行视图现由 `ComposerLayout.AdaptiveFooter` 接收 input/leading/model/trailing 槽位，仍由同一 InputbarCore/Controller 组合。删除旧 MainRow、BottomBar、空输入强制 floating-collapsed 和重复附件入口；原 1,036 行混合样式拆为 746 行控件样式及 232 行 composerStyles。主题、多模型与首页 136px 编辑区继续由现有 owner 承接。47 项相关测试分轮通过（首轮 45/47，原 5 秒超时两套串行复核 9/9），strict lint 通过；49完整类型已通过，真实home800几何失败；后继54独立质量与桌面仍待验。

本次只关闭多行槽位迁移。上游 `auto-single-line` 的宽度测量、composition 锁定和完整 voice/dictation layout 尚未移植，不能将本切片称为整套 Composer 对齐完成。执行与后继桌面证据由[活动计划](../../exec-plans/codex-composer-layout-20261019.md)维护。

50进一步分析实际策略：parent `ev_e74e1af289bfe4b44f9d691f18aa79ec95a893d4a5777f632a16322c35804154`，三个完整声明、2,692 bytes、1,024 AST、parse0、198 semantic unknown。multiline显式返回非单行；auto-single-line遇可见附件、多段/换行或voice时退出单行，其余遵循lockedLayout或实际textFitsSingleLine。外层在composition开始时保存当前layout、结束时释放；compact/goal/awaiting和dictation transcript覆盖规则单独处理。完整记录见`composer-mode-bundle-manifest-50.json`，并未执行参考或确认当前flags；测宽依赖尚需聚焦补证。

49真实home-800证据确认model控件侵入听写/发送；标准GUI通过没有关闭该几何风险。后继53据51/52的实测宽度策略，为现有唯一模型槽位提供expanded/compact/hidden显示模式，先收标签、再实测、必要时隐藏，放大后恢复。新增input-kit/InlineControlLayout与ModelSelectorTrigger，原ModelSelector迁移trigger调用、删除固定触发器markup；模型catalog、选择、reasoning和配置owner不变。2项回归覆盖首次窄布局、收起/隐藏/恢复、入口可操作、同EditorView/选择区/焦点/完整draft；strict lint通过。新增异步挂载回归暴露effect初始无trigger不再测量的问题；53冻结字节保留，54持续观察容器并在控件/名称更换时重新实测，根生命周期3项通过，独立质量与真实桌面待验。

55已补测量生产者：同包完整uHc/vdl/cGc，REA parent `ev_b7fca04b25e3ad1c0bd9ba80ea1778bad6c0db9d5ceff125c2648ca3edb183d2`。singleLine且非dictating时测实际editor纵向或textblock横向溢出，ResizeObserver、字体完成和Controller订阅重测并清理。6094bytes、1866AST、parse0、406semantic unknown；未执行参考。预测投影不是接受正文，详见55完整bundle。54真实首页三尺寸通过；会话52px高度失败，后继56修默认88px并删除旧FileManager专属入口，独立验证待执行，不能把54的标准GUI通过记成产品通过。

## 上下文建议后继（2026-10-19）

REA82/83/84/86将 +、typed @、$、slash、Controller与overlay分开取得完整静态声明；目标摘要不变。明文Controller方法已对齐，压缩组件名未冒充开发名称。当前Lime以ProseMirror插件保存唯一建议状态，ContextualSuggestions组合current资源、SuggestionList处理键盘/焦点/异步失败；首页和会话共享，旧Plus/CharacterMention/独立Skills/Plugin面板与模板徽标已删除。

86 Evidence `ev_a21ec371c3d4a4de726304005edf9eda5453331391902c87f9221e9fabf79792` 确认紧凑overlay为4px间距、anchor宽度与availableHeight，未观察参考应用运行。Lime已移除420px上限；完整expanded/zoom状态、所有来源种类与native capture仍未落齐。完整映射、删除与最终产品验证以[本切片计划](../../exec-plans/codex-composer-context-suggestions-20261019.md)为准。


## 技能显示与提交（REA88/89/90，2026-10-19）

同一包的$6r/nHr/fAr与sJr/GB确认：显式displayName优先，fallback格式化name；可见标签与promptLinkLabel分离，skill发送$加name并保留非空path。10加5完整声明、6103加673字节、1801加202 AST，parse0；原件及gzip manifest见上下文计划。静态证据不证明参考运行，压缩符号仅定位。Lime current catalog、PM atom和suggestion消费者已迁移并等待冻结90产品验证；旧installed_skill dispatch额外slash前缀及其余能力来源仍为gap。


REA92/93/94后继：getText/getPersistedText/mentioned paths、eFi的inline-flow DOM/CSS和sJr→SV→shared.LE/Hki默认glyph分别取得独立完整REA证据与gzip回读保全。默认mention无统一背景pill，icon/label分离，medium、0padding、3px图标间隔；显示名称不改变canonical `$name`与typed Skill路径。Lime92已迁移Controller消费者、导航和提交，删除旧installed_skill额外slash路由/fallback/route徽标；新字节独立产品验收中。自定义icon、file/plugin图标、点击行为与canonical时间线展示尚未完整对齐。91 Goal失败由真实ledger确认自动续跑，fixture将走真实GUI暂停再要求空闲与首轮completed，不放宽终态或期限。详见活动上下文计划。

REA95补证提交/历史/正文链10声明（22149bytes、6370 AST、parse0），Evidence `ev_6abdbfee18fb272f9557c8be99713836061a6982671dea18ba36ca57c6b87cf1`。GB的text不是整个serializer结果；WB/n2会携带Markdown链接，transport后续仍须逐支路核对。Hm的已读正文投影不把独立skill/mention rows变成标签，Lime93根已删除canonical时间线的额外`@`徽标、无path标签helper和专用组件分支；38项消息与33项复制风险通过，独立产品验证待验。这一步只关闭重复徽标实现，不能关闭完整引用serializer/consumer差距。

93独立候选已通过102项与完整预检、新Renderer、真实标准GUI/rich、54观察48截图；canonical正文仍不凭sidecar元数据生成额外标签。94按REA89 sJr补mention leafText显示名称，根真实EditorView先红后绿，6套112项及strict lint通过；canonical输入、typed路径和UTF8合同不变，新构建产品证据待验。REA96 `ev_39097e6ae3706546f0f855f241d5faabb6160b473899103b147080aafd9cc3fa`认证并提取m7c/q3c/J3c/FBc/e6c/X3c/Y3c/Z6r/YL九个完整声明（18278bytes、7615 AST、parse0），完整Evidence gzip逐字节回读保全。分类依据href与label；Skill按规范化path优先，否则name/displayName匹配且只接受唯一结果；无目录无href时保留文字，不伪造安装项。打开技能文件还要求本地同host、非远程、可识别Skill定义文件或真实模板目标；加载中的元数据不抢先打开。App与Plugin各自使用current catalog/host/readiness，不由任意文字绑定。上述是静态消费者合同，依赖仍有未解析分支，未执行参考，不能声称全部catalog/remote/点击分支已穷尽。

94已结算passed：11套150项、strict lint、完整types/contracts/i18n/治理、新Renderer、标准GUI、真实rich及54观察48截图通过；sourceDrift空、freshness前后ready、Main正常退出。10134源/325产物manifest SHA `67068b0804a774aae5f51b3008499f93eb93077df40766bf5781a1f1fe52694b`，已查看dark/thread最终截图。

95实施：REA96/97的Skill consumer→skillPromptLink、PromptLinks既有useLimeSkills目录接线、SkillPromptLink与Markdown的remarkPromptLinks；canonical用户正文和MessageUserBody共用。composerMention glyph与inlineMentionStyles共享，删除原Composer重复样式，无alias/第二目录store/backend。保留原label/path属性、只接受唯一目录、loading/缺失/歧义只读，只有current本地已识别定义文件可经现有artifact/file owner打开并带原itemId。原路径先于Markdown URL transform保留；普通HTTP、code、危险URI不绑定。根首轮77项通过；新增资源路径原2失败/26通过保留，修正HAST属性名称后28项通过，独立新Renderer/桌面待验。完整链接serializer、plugin/app、gallery/custom icon、remote/原生平台与全GUI仍partial。


### 96：正文引用词法校准

95已结算failed：风险测试、完整预检、新Renderer、标准GUI和真实rich通过；54项Composer观察后，新增真实提交回合interrupted，模型收据只有GET models。截图另暴露多条$Skill被remarkMath吞入数学节点；两项均不算通过。sourceDrift空、Main正常exit0/signalnull且无强杀，325产物manifest SHA 5b2ec7c6664c61b27f5395a861c6eff3d3aa556cf3bb356fa7f9ab43ea1a39ff，原截图/收据不可变。启动器源码确认backendMode默认unavailable，Rust UnavailableBackend拒绝start_turn；不是provider端口已被证实故障。

REA98/99补证：RH的composerLink在词法阶段优先于Math，原始label独立于渲染children；lcn允许路径空格和转义闭合符，qVr/aH分别解码label/path。98 Evidence ev_8bd6d2b1ec01c1cdd03ecf68f8fce75c9f4bd9270ef1a838da6269fb01b00697（9声明2575bytes/920AST）；99 Evidence ev_835761eb2518d6b90986a82a96730e8d6af7f22f813ac724ae99c2d4256804f0（5声明1930bytes/629AST），parse0，完整JSON gzip逐字节回读保全。98的QVr/$Vr只有未初始化声明，常量值仍unknown；全部静态、未运行参考。

96根实现：remarkPromptLinks由解析后遍历直接替换为现有remark管线的micromark/fromMarkdown扩展；composerLink复用已安装marked处理native title，再按REA scanner识别资源路径；MarkdownLink接管原inline anchor分支并读取原始label，不留旧分支/alias。格式标签、Unicode/空格/Windows路径、反斜杠/括号、多引用与独立数学、code/escape/image和普通HTTP回归共6套70项通过，原4失败/7通过保留。早期96格式标签red用已解析目录却期待原格式，期望本身不符合consumer；后继改为unknown path并按REA99保留原始label，不能将该旧red当产品缺陷证明。新字节产品验证仍待。

current仍是既有Markdown/Skill catalog/文件owner；新增compat/deprecated为0，旧AST-only引用遍历与inline anchor重复分支已替换。全GUI仍partial，真实新字节验证归Composer计划Contract96。


96独立候选已结算failed-before-build：13套风险测试和strict lint通过；正式types发现remark插件的Processor<Root> this与Pluggable不兼容，以及缺失remark-parse的Data类型扩展。sourceDrift空；没有Renderer/Host产物，不伪造artifact manifest或GUI通过。原类型日志及收据SHA保全在candidate-context-types-failure-96.json。97只修this为项目统一Processor并补type-only remark-parse导入，不改变运行行为或放宽tsconfig；从failed96/sourceDrift0精确叠加该文件及六事实源。Contract96全部产品/退出要求继续有效。


97结算：13套161项、strict lint、完整types/contracts/i18n/unused/scripts/legacy及新Renderer通过。原runner在复用Host时误将95产物的sourceManifest与96源码比较，失败收据保留；recovery1认证原10步日志/源码/Renderer且改为95自身摘要，从未跳过失败产品门禁。标准GUI通过，rich全部business/assertions通过且零console/page错误，但Main原15秒正常退出超时，失败回收SIGKILL；整轮仍failed，不能称正常退出。10144源/325产物冻结manifest SHA 3ca5b1abcae5cf283e6f05a8c8a265acb453cd3aa79c11b4743fa4ab3e882239，sourceDrift空。尚未执行的matrix另立独立收据执行；其结果不能覆盖原rich退出失败。退出根因尚未定位，不归因于本次词法变更，也不放宽deadline。


97独立matrix的54项Composer观察已完成，真实截图显示4条引用和助手完成文本；随后采集器错误使用requests().body（实际API只返回bodySummary），finally再次Buffer.byteLength(undefined)导致原错误与正常退出收据未落盘。independent-context-matrix-verification-97.json明确failed；原summary的running只是最后检查点，不是存活或通过证据，原日志/截图保留。不能从截图推断后续copy/file或正常Main通过。98在原fixture增加显式requestMarkers布尔摘要，真实HTTP回归证明不暴露payload/凭证；finally前保存原错误并保证始终进入既有teardown。原prompt/身份/54项、零mock与15秒退出合同不变。

REA101退出补证：认证同ASAR与main成员09d19386e1f23cf4ccbc950fc40d85a1e8a064a08be588b2a4be6a89f6ada9e6，4完整声明2345bytes/671AST、parse0，Evidence ev_ce638abaf49a49db7d0fd9ed7bef81e46f79d79bb8869d1577376980c6ea1c97，gzip SHA fb079856960b9a96edc36c52be63388d21664b26a898e253f8ab8b8df7e14946。eZe先allSettled(global/settings/tracing等flush)，再u7(flushAndDisposeContext,5000)，最后dispose与第二次quit；5秒仅约束后一个context drain，不是整个退出期限。不能据此给Lime加总超时或声称修复当前Main阻塞；实际根因仍unknown。全部静态，未执行参考。

2026-10-19 后继99：98真实runtime marker POST、同一Thread/Turn/UserItem completed、54项Composer观察、四引用和原生全文复制通过；点击Skill误走通用产物链，SKILL.md标签出现但右侧Terminal保持active，文件breadcrumb超时。98整轮failed，Main正常code0/signalnull、sourceDrift空；325产物manifest SHA `02d76b67bc369fe2a86daa8bc4d1ed4dcf349c46fabd3eebe8ce19794e1e0e96`，原错误/截图不覆盖。按既有REA96 J3c/e6c openInSidePanel与文件owner合同，99把文本类file_preview直接接到openWorkspaceFile；删除该路径的产物副本读取/注册与canvas选择，沿同一LocalState复用空Files、路径tab/contentInstance与owner epoch。无需新store/backend/兼容层；Office/媒体格式owner仍独立承接。根回归先复现1失败/17通过；初次修复误截Office六例已保全，后继按现有contentKind路由限定文本类。


2026-10-19 结算：99原轮matrix因未hover展开复制footer而被正文拦截，整轮failed且原收据/截图/325产物保留（manifest SHA a3d17d7b7cd098da1fdbda2b6a9a8df9126122ae9521c2c7529b631746e7a3c8）。同一冻结源/产物的99 recovery1只改外部采集器，复用既有prepareCopyAction真实hover/geometry后click，无force或产品注入；认证原18套212项与11步已完成门禁，重验matrix60观察及rich均passed。四引用/三主题重载、原生全文复制、click/Enter/Space进入Files及原文件不变通过；rich保留完整同一Thread/Turn/UserItem与四输入、图片原字节、取消/草稿恢复。matrix Main39255、rich Main51767均正常code0/signalnull，无强制回收，原15秒/identity/mock0/freshness不放宽；10145源/325产物冻结manifest SHA db3e1ce11fd6d103707ae84774f30da775beb583237b482851f0459e2f528586，sourceDrift空。预览区仍偏窄；97退出根因、真正atom→Markdown提交与全GUI保持partial。

102实施：REA89 GB→92 WB→95 n2/GVr/KVr的资源格式映射到既有composerLinks.formatResourceLink与serializeComposerDocument，HTTP无title链接复用相同formatter但原URL校验不变；普通Skill/file/plugin atom输出[label](path)，不再创建wire text_elements，paste/显式element按最终UTF8重算。显示/JSON草稿继续由projectComposerDocument管理；typed path身份暂保留，未迁移共享Rust文本parser。删除旧裸label提交和Skill范围正向/护栏，迁移rich独立literal oracle、资源路径负向以及正文显示名断言。根先红4例，首轮482项中2项旧恢复/手写范围期望失败保全，修正后相关110项和fixture130项通过；独立新Renderer/Gate B待验。不冒充完整wire、全部consumer或全GUI对齐。

2026-10-19 102/104更新：资源Markdown提交候选102的19套336项、strict lint/types/contracts/i18n/治理、新Renderer及标准GUI通过；原矩阵60项业务观察完成，但Main原15秒正常退出超时，整轮failed，sourceDrift空、325产物manifest SHA 725e417ad2072fcd80510e672858e9995c7590985f64829ef85701f407f082b0。102 recovery1再次完成60观察但同一退出门禁failed；7秒被动sample超时且无有效栈，不能归因或当修复证据。原件均保留，rich独立补测中；97/102退出根因open。

104沿REA103 recovery1的dzt/DC/ozt/wn合同实施文件树默认关闭、共享开关与250px临时宽度（min200/max60%）；不凭截图调整固定像素。泛化既有Host bool owner并直接删除summary专用方法，无alias；Summary、Files、Changes及Workbench消费者收敛同一typed gateway，删除每入口局部开关和true默认。Host7套193项、消费者6套44项已通过；真实桌面三主题/多宽度、保存重载与Files/Changes共享待验。`internal/exec-plans/codex-file-tree-visibility-20261019.md`。无新增业务owner/兼容层，不扩写未知Rust、发布和architecture增量；全GUI保持partial。
