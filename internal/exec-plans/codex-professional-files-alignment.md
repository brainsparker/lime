# 专业文件与 Codex Desktop 对齐


当前证据状态（2026-10-18）：整个旧 `.lime/` 已消失，本页所列旧本地收据、候选、截图、清单和日志原件均为missing。下文通过结果仅保留历史观察，不能继续视为可复核或有效的当前验收。源码仍在；新候选与重验由 [Presentation计划](codex-presentation-alignment.md) 跟踪，缺失声明见 `internal/research/codex-desktop-rea/validation-evidence-lifecycle-20261018.json`。

状态：active。负责人：root，2026-10-17。主目标沿用 [GUI 全面对齐计划](codex-gui-alignment-current-plan.md)，仅保留主题、多模型与首页 Banner。

最新复核：1.160.0候选2已完成XLSX普通单元格编辑/保存/外部冲突、应用scope保稿与提交前flush，并通过DOCX/PDF/Slides三轮共享回归；标准wrapper2为24/24。冻结收据`.lime/qc/professional-files/workbook-edit-final-20261017-2/receipt.json`，SHA `176685cd012fb03445b17a66d3506030950f1002ca0745d3917989ace05860e7`。CSV/TSV已在同源prepared sidecar候选6原生验收并独立冻结，默认门禁接续，执行细节只由[工作簿计划](codex-workbook-alignment.md)持有。此前1.159.0只读Slides与跨格式收据原件也已missing，不能推广到当前混合根工作树。Presentation顶层正文/对象编辑与保存已进入实现和原生验收，唯一合同由[Presentation计划](codex-presentation-alignment.md)持有；完整分组/表格/幻灯片结构和自动保存/关闭flush仍开放。DOCX/PDF正文编辑范围须有具体入口证据，不能从通用flush gate推断。

## 本轮写集与合同

接续切片：把未提交批注从 Workspace hook 的组件生命周期迁到既有 Jotai 应用 scope，继续由 `ArtifactAnnotationDraftStore` 唯一持有，按 session/thread/path 隔离。新增写集仅为该 Store、Workspace submission hook 及生命周期回归、架构和本计划。参考 batch REA parent `ev_605b8adbcdd0fa9a6f8d08f462ee1208401f5509b5695136a9cb71e59ebed38f`，复核 summary `ev_ddbe356dd8fddd42c266b67ca33e09360fcc37bc7065a09f7ca87fc49d59853d`；原 ASAR app-shared 的 scoped signal、导出和 offset 上下文存于 `.lime/qc/professional-files/annotation-persistence-reference-20261017-1/`。只确认应用 scope 内状态，进程重启耐久性仍 unknown。退出条件：真实组件卸载/重挂载保正文、位置、截图和失败；跨会话不泄露；发送后重挂载不得重复发送，迟到接受只结算原 revision；独立应用 scope 隔离；定向、类型及标准 GUI/原生证据分别记录。无新增 storage key、IPC、后端或兼容双轨。

budget:normal；P1；非 live。先交付 PDF 页面预览，继而接准确位置批注与 canonical 会话提交；DOCX、工作表和幻灯片分别沿同一 artifact surface 扩展，不以文本抽取代替版式预览。

写集：`src/lib/api/fileBrowser.ts` 及其测试、`src/components/artifact/document/`、artifact 分发入口、`src/lib/artifact/previewArtifact` 与对应测试、CanvasWorkbench 的专业预览分发、五语言 workspace 文案、PDF 定向 Electron fixture、本计划与专业文件审计。依赖仅在现有根 manifest/lock 增加 PDF 渲染库，保留其他未提交修改。已有文件先核对摘要；协议、Rust、Plugin、release、tsbuildinfo 和未知参考文件继续只读。

参考：同一 Codex Desktop 26.1007.30912 / build20156、ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。新提取 PDF 原成员 SHA `1532d5f6037ad4d7a869021279cf90fe04d220b28a430cd02f39a4299de338a7`，公开导出 `PdfPreviewPanel`；其余内部命名不冒称上游原名。REA parent `ev_87ba97728327a9b942255e18bb42d20c39afb710e85305de5b35548b614be8f4`，summary `ev_bb295d0f43112d8bf88f335dd0da981fa9dc60060955985b3ded499fd170b374`。四成员仅 inert 静态分析；8056 semantic unknowns、application partial，不能证明参考运行。

Current 主链：文件选择 -> 原 workspace 文件预览/read gateway -> 原 artifact/read model -> ArtifactRenderer -> PdfPreviewPanel。Renderer 只持有加载、分页、缩放、可见页与选区状态，源文件、授权、持久化及会话仍由既有 owner 持有。PDF 字节沿当前 App Server `fs/readFile` 原字节合同读取，不添加 IPC、协议方法、后端或生产 mock。后续批注复用原 Composer typed acceptance，不建立第二 turn loop。

Happy path：打开真实 PDF 后渲染页面及可选文字；分页/缩放/窄屏保持当前页，文件或版本切换清理旧任务。错误、取消/卸载、密码保护与损坏文件显式终止或重试，迟到旧文件不得覆盖当前文件；旧文本抽取/系统打开的 PDF 正向断言迁移。PDF 内容不能执行脚本或自动打开外部链接。

验证：先受影响 unit/component（加载竞态、取消、失败、页码/缩放、五语言及真实分发），再 typecheck/strict lint、版本/依赖验证、标准 GUI smoke、真实 Electron PDF 页面与 canonical Thread/Turn/Item。保留原期限、freshness、Main 正常退出与零生产 mock 守卫。证据分层：组件、标准 GUI、PDF 原生、live/Windows/安装包分别记录；只接受实际完成项。

退出条件：声明范围产品行为与测试通过、旧路径/文档/护栏同步迁移、实际源码/产物身份及失败记录可复核。批注未完成时不得称专业文件闭环完成。架构影响为 Renderer 内同 owner 的格式分发，不新增跨层 owner；根依赖更新后同步说明实际打包边界。

## 交付清单

Slides下一切片写集：新增 `artifact/presentation/`；只在现有previewArtifact/PreviewArtifactRenderer/Workbench分发和annotations联合类型、展示/metadata投影增加presentation分支；五语言及定向/原生fixture同步。公开组件名使用REA确认的 `PresentationPanel`；内部解析/定位名仅为Lime职责名。现有PDF/DOCX/Workbook、Jotai草稿与typed acceptance继续共用，不复制submit owner。

依赖审查：`pptx-browser@4.1.5`包内MIT一致，但fonts.js自动注入Google Fonts外链，且本次未确认资源限额，不选；`@aiden0z/pptx-renderer@1.3.0`包内Apache-2.0、MPL-2.0/ECMA notices与类型已核，原tarball SHA `f867ce7e814454ac048c3857b0db689f884dea633a66e73648860a44cacf0422`。采用固定版本的parseZip/buildPresentation/renderSlide API及ZIP限额；此为Lime实现依赖，不冒称Codex使用该库。新增依赖仅窄patch现有manifest/lock，不覆盖并行修改。参考完整位置schema仍unknown；本实现以源OOXML slideId和原尺寸坐标为明确合同，不伪称精确复原参考内部proto。

验证合同：真实PPTX原字节→有界ZIP/XML→有源slideId的snapshot→受限iframe内版式；分页/缩放、损坏/迟到/取消必须终止清理。禁止文件内容执行脚本、网络或外部导航；单条/跨slide批次与重新定位沿原annotations、SHA校验与canonical会话提交。先真实解析与渲染回归、组件接线、五语言/类型，再完整GUI wrapper和真实Electron。旧PPTX系统打开正向测试迁移为原字节slides；旧二进制PPT仍明确降级。Office编辑/保存/roundtrip另列未完成，不由只读Slides预览冒充。

- [x] PDF 真实页面、文本、分页与缩放（预览候选原生通过，见下）。
- [x] 文件/版本切换、取消/卸载及失败重试（定向回归通过；不扩写为重启耐久性）。
- [x] PDF 页面/文字选区批注、截图、文件版本与会话身份（独立候选原生通过）。
- [x] PDF 单条批注 typed accepted/rejected、失败保留与新输入保护（定向及原生证据，不含批量和重启耐久性）。
- [x] DOCX 版式预览与单条批注（同源隔离 iframe；完整原生通过，见后续记录）。
- [x] 工作表预览与单格/跨表范围反馈（完整原生第7轮通过）。
- [x] 幻灯片只读预览与源 slide identity / 点位置 / 跨页反馈（独立候选五场景通过，见最终结算）。
- [ ] 定向回归、真实 Electron、全仓受影响门禁与清理。
- [ ] Office 原文件编辑、flush/save、外部变更冲突与 roundtrip。

该开放项必须按具体格式的参考证据拆解，不能从共享 `flushEdits / flushPublicFile` 推导每种格式都提供正文编辑。2026-10-17 补读同摘要 DOCX wrapper 的 REA 模块页与 asset view（`ev_f449078645deff7e6a43eb32c0cb2697570f85982aa80195da09affbd750d718`），并保存原字节的有界方法检索。wrapper 与渲染库中未找到这两个方法或 `contentEditable` 字面量；这是有限静态观察，13936 semantic unknowns 仍在，不构成全应用不存在编辑的证明。

| 格式 | 已确认的面板合同 | 编辑/保存后续条件 |
| --- | --- | --- |
| PDF | 页面/TextLayer/位置反馈与原会话提交 | 正文编辑尚未确认为目标能力，先核对应 owner/实际入口 |
| DOCX | parse/render、分页/缩放、clean/redlines、位置反馈 | 不从通用 gate 预建 Word 编辑器；先核具体入口与 ref owner |
| Workbook | 手动单元格编辑状态、可确认方法与 flush/export 相关调用 | 原包编辑、冲突、保存与批注前flush正在独立原生验收；完整Excel特性不由局部合同覆盖 |
| Presentation | 原字节导入、源slideId、编辑回调与CRDT drain | 核具体可编辑对象、导出和保存入口后继续实现，不猜压缩类型 |

总体专业文件和整体 GUI 均未完成；本清单是专业文件范围的退出分母，不能充当全产品完成度。

## 原生验收与修复记录（2026-10-17）

- 第1候选的标准壳 smoke 24/24、正常 Main 退出通过；执行的是标准 `scripts/electron/smoke.mjs` 主体，加独立 freshness 检查，未执行会重编并行 Rust 的完整 `verify:gui-smoke` wrapper。
- PDF 原生第1轮失败：真实 canonical 会话和文件选择通过，PDF 到达明确 error，无页面 pixels/TextLayer，console/page error 为零；Main 以 code0/signal null 正常退出。失败原件留在候选 `.lime/qc/professional-files/pdf-preview-native-20261017-1`。不把壳通过当成 PDF 通过。
- PDF 字节读取已从 renderer fetch(asset URL) 迁到既有 `fileBrowser.readFileBytes -> fs/readFile`；`readFilePreview` 复用同一 bytes owner。取消后未返回的 RPC 不强行伪造取消，但其迟到 bytes 不创建 PDF parser，也不更新旧面板。Host/协议/Rust 未扩展。
- 适合宽度缺陷先取得 1 项红例，再修为单次生效和幂等动作；移除无用的宽度模式状态，以及专业文件上的 Markdown/HTML/Code 切换。当前 5 suite / 44 项定向测试、窄 strict lint 通过。新候选构建与门禁进行中。
- 原生第2轮在首页项目菜单 pointer 选择超时：菜单条目在滚动后移出 viewport，截图与 call log 保留在 `pdf-preview-diagnostic-20261017-2`；不是 workspace ID、权限或 provider 失败。后续菜单定位/滚动仍是 current 产品 gap。PDF fixture 使用真实键盘 Enter 选择同一项目，不采用 force click、DOM handler 或注入业务状态，因此只证明键盘选择路径；没有关闭 pointer 缺口。

该记录不是 PDF/专业文件或整体 GUI 完成声明。完整 wrapper、最新并行后端、批注与 Office 仍未验收。

第3原生候选已显示真实页面 pixels/TextLayer，但虚拟化上限失败。第4轮增加仅观测布局：PDF scroller clientHeight/scrollHeight 均为 3088px，外层 Grid 实际仅 847px，而 Grid 子项增高到 3217px。确认 `CanvasWorkbenchProjectFilesPanel` 的自动最小行高撑大内容。新增窄写集为该文件的 Grid 行与两列 min-height/overflow；保留 `<6` 页面挂载断言，不通过提高上限、跳过或固定 sleep 掩盖问题。

## PDF 批注实施合同（阶段2）

新增窄写集：`src/components/artifact/ArtifactCommentSubmissionContext.tsx`、`src/lib/artifact/fileRevision.ts`、PDF 选区/坐标与批注编辑组件、`workspace/useWorkspaceArtifactCommentSubmission.ts`、`useAgentChatWorkspaceSceneRuntime.tsx` 的单个 Provider 接线与对应测试/五语言。已核对 Scene 在根工作树与预览候选一致且无未知脏改动；Rust/协议/Plugin/发布继续只读。预览阶段候选与后续批注工作树分别验收，不混同源码身份。

目标：页面文字选区及 point 定位形成有文件 SHA-256/pageSize/pageNumber/pageCount 的批注，经既有 `handleInputbarSend` 与 typed runtime/queue acceptance 提交到捕获的 canonical session/thread；不新增 turn loop。源文件重读摘要不符、文件/版本/会话导航变化必须拒绝迟到提交；失败保留本地批注，接受后的 cleanup 使用现有 Composer settlement revision 保护，不清主 Composer 或新输入。PDF 只读预览，无原文件编辑，所以没有虚构的 save/flush gate。

验证：选区坐标变换/摘要与 scope 竞态、typed accepted/rejected、编辑中新输入保护、五语言，继而真实 Electron 从同一 PDF 经批注创建下一 Turn 并读回同一 canonical identity。跨组件卸载的未提交批注耐久性、完整批量 comments accessory、Office 保存/roundtrip 仍需独立实现，未验证前不计完成。

## 本次接续核验

PDF 第5轮已通过 pixels/TextLayer、1→9 分页、缩放、横版页和挂载4页；最后在780px切为单面板后默认聊天页签，原脚本未返回工作台而超时。源码核对是既有显式响应式页签行为，不是 PDF 缩放失败。第6轮误缺 `APP_SERVER_BIN` 导致 fixture 临时 HOME 下 rustup 无默认 toolchain，未启动产品；保留原失败。第7轮使用已声明基线 sidecar，并通过真实工作台页签返回，完整预览场景 exit0。没有 force click、DOM业务注入、放宽期限或虚拟化上限；补强等待要求挂载页数同时大于0。

预览终态：标准 `smoke.mjs` 主体第三轮 pass（24断言；run `standalone-shell-01-20261017061958-5266`），PDF原生 `pdf-preview-native-20261017-7` pass，freshness前后ready、正常Main退出、零console/page错误、同一canonical identity，预览不创建附加Turn。780px截图人工复核。冻结收据 `.lime/qc/professional-files/pdf-preview-final-20261017-1/receipt.json`，SHA `dfb0bd0ac6792776a20a807c57c3c6c066be3393fd576e7bfca004c4b6a546bc`。只绑定1.159.0独立候选；根工作树1.160.0并行Rust/Plugin/发布不在该证明内。完整 `verify:gui-smoke` wrapper、`verify:local` 仍未执行。

阶段2新增窄写集：`PdfAnnotationDraftStore`及回归、`useWorkspaceInputbarSceneRuntime.tsx`仅导出既有`handleInputbarSend`、批注native子场景。查清`handleSendRef`本身不执行Inputbar queue分发后，批注统一调用同一个`handleInputbarSend`，不另写queue入口。最初的handleSendRef接线已替换，不把仅传`composerTarget`当作排队完成。错会话/线程receipt在进入settlement前拒绝；接受后视图已关闭仍可结算原Controller，严格revision保护新输入。

会话内的未提交批注视图状态由`PdfAnnotationDraftStore`持有，正文唯一owner仍为每条批注的`ComposerController`；按canonical session/thread与文件路径隔离，关闭、页虚拟化及文件切换不主动清草稿。文字选区先显示“要求修改”，point与已保存草稿marker可打开同一编辑卡。当前为内存中的会话视图状态，未声称跨整个Workspace卸载、进程重启或强杀恢复。批量提交、截图及与主Composer accessory整合仍开放。

阶段2已取得9suite/93项定向回归（含原Inputbar32项，不与之前测试相加）；窄lint、最终typecheck与独立批注候选正在验证。独立候选位置见`.lime/qc/professional-files/annotation-validation.json`；不得拿预览收据充当新批注通过。

## 2026-10-17 接续：截图与版本恢复

点批注第一阶段原生验收已通过并冻结：`.lime/qc/professional-files/pdf-annotation-final-20261017-1/receipt.json`，SHA `e8f88ba7073b230317e73e9e28f082bc48595d112de151b08a64c733e4fc4fa0`。证明同一 canonical 会话的页面2定位、编辑/关闭/marker重开、正文恢复、typed acceptance后只新增一个Turn且移除对应草稿；零console/page错误、零mock、Main正常退出及前后freshness。它不包含后续截图或重新定位实现，不证明根1.160.0的并行后端。

后续截图沿已显示canvas裁剪（最长边1024）并走既有Composer附件通道，prompt/metadata仅含尺寸与类型；源文件变化先拒绝发送，保留正文，用户明确重新定位后重读文件并更新hash/位置/截图。新增原生场景要求真实鼠标文字选区、canonical region metadata、changed-source零新增Turn、重新定位后的新hash和页码。新候选见`.lime/qc/professional-files/recovery-validation.json`，与前述冻结候选分别验收。

最新定向8suite/65项通过；恢复测试改为切回会话后通过可见列表重开，保留隔离/正文断言。typecheck第2轮发现ComposerController的plainTextMode传入位置错误，已移至第二参数；需以修正后的类型检查与候选重新验证，不将旧类型结果写绿。

## DOCX 版式预览实施合同（阶段3）

窄写集在现有document目录新增DocxPreviewPanel及解析/安全隔离helper和测试，扩展已有previewArtifact/PreviewArtifactRenderer分发、五语言workspace文案、根manifest/lock的精确docx-preview依赖与本计划/审计。PDF原生候选冻结后独立验证DOCX，不混用产物。Rust/协议/Plugin/release继续只读。

参考同一ASAR的docx-preview-panel-79829ce69ce8.js（SHA ced645d7edfa698d65983f4a902682447ddaa8cc478a8acdd7b456072cbe5286）公开导出DocxPreviewPanel；library成员SHA 7302f9d120a6b54000e511b152d04a4648e56d5d6796fb859a1b6749f529024b。REA parent ev_efd39a734807c918d2026b8553f25bf13477bce5ef74d6bc253f80bf722e24d6，summary ev_23674a5b290a5219608b6992b89a5bb0fe0663437c5e5ae2990998ce6e89af3b；2个JS解析成功，semantic partial/truncated，13936 unknowns。wrapper静态确认bytes→parseAsync→parts/symbol校验→renderDocument，renderAltChunks:false/useBase64URL:true，clean/redlines及页码/缩放；链接只保留http/https。该npm确切版本unknown；Lime选0.4.1，API差异按实际类型适配，不声称字节相同。

合同：现有fs/readFile原字节→同一artifact surface→DocxPreviewPanel；显示原生段落/表格/页眉页脚/分页，支持页码、缩放和修订显示；取消/迟到、损坏/重试与五语言有回归。内容在无脚本的sandbox iframe及禁止网络的CSP下呈现，使用inert document构造DOM并禁用altChunk、页面自身导航及主动资源；HTTP/HTTPS链接经既有Host向外打开；不注入主页面样式、不新增后端。只读预览不虚构编辑/save/roundtrip或批注完成。先真实zip解析与组件测试、类型/lint，再独立Electron文件选择/版式/修订场景与标准门禁。

当前专业文件原生fixture入口收敛为`scripts/electron/document-preview-fixture-smoke.mjs`，PDF默认、`--annotations`验证批注、`--docx`验证Word；旧PDF专属脚本在根工作树删除。两种页面分发回归合并为`DocumentPreview.integration.test.tsx`，不保留旧命名包装。历史独立候选和收据仍绑定当时的旧文件名。

## 接续验收与 canonical 批注展示修复

PDF 截图/选区/文件变化恢复第3轮原生通过，收据 `.lime/qc/professional-files/pdf-recovery-final-20261017-1/receipt.json`，SHA `213d633e34d83ce6944fa63e1d5c4318efe49c415c135df900c449fdffe02615`。实际证明截图 PNG 字节 SHA/尺寸从编辑卡到真实 runtime input 一致、真实鼠标文字选区、文件变化时零新增 Turn 和正文保留、重新定位第3页后携带新 SHA 成功发送。总 Turn 为4，IPC94，零 trace/console/page error 与 mock，Main 正常退出且前后 freshness ready；保留第1/2轮失败。此收据明确保留聊天用户气泡暴露技术 JSON 的缺口，不覆盖后续源码。

修复方向为同一 canonical 内容的展示投影：模型输入、文件 SHA、坐标和 canonical item 均保留；只对能通过完整校验并精确重建的 PDF 批注输入生成文件名/页码/正文。普通 JSON、无效位置、未知字段和附加指令原样保留；不靠本地临时 Message 遮蔽。`ConversationTurnTimeline` 与历史展示共用该投影，本地 `displayContent` 复用同一格式化函数。新增无本地 Message 的 canonical DOM 回归（content 与 content_parts）2项通过，相关逻辑/提交/展示62项通过，待新候选原生证明。

DOCX 首轮原生因 iframe 尚无布局却已报告 ready 失败；第2轮保留截图并确认页面出现，但默认窄面板中的表格未达到原有尺寸断言。没有放宽期限或断言。产品 readiness 改为 iframe load 完成后才 ready，翻页/缩放重新等待；原生场景通过真实缩放控件验证可阅读表格，再验证780px适宽。组件7项与 canonical DOM2项通过，新候选 Renderer 构建中，尚不声明 DOCX 原生通过。

最新根工作树 typecheck 第4轮通过。`test:contracts` 第3轮在文档边界聚合阶段失败：并行 `release-v1.160.0-plan.md` 引用外部 limecore 仓库的部署计划 `railway-deploy-2026-10-17.md` 被旧路径扫描命中。未改写发布事实或放松守卫；合同聚合、完整 `verify:gui-smoke` wrapper 与 `verify:local` 仍待关闭。Rust/协议/Plugin/release 保持只读避让。

新候选验收：DOCX 第3轮原生通过，收据 `.lime/qc/professional-files/docx-preview-final-20261017-1/receipt.json`（SHA `541deab393df4bf7068d18f724fbf3deaa2d5f3334b61cf3d54c7d0824ed2b30`）。两页、表格实际布局、页眉、翻页/缩放、修订切换、780px适宽、sandbox和链接属性通过；同一 canonical 会话零额外 Turn，IPC52、error/mock0、Main正常退出、前后freshness。保留首两轮失败，3张产品截图人工复核；不声称 DOCX 批注或编辑已完成。

同候选 PDF 展示原生第1轮通过并冻结 `.lime/qc/professional-files/pdf-display-final-20261017-1/receipt.json`（SHA `863f7bded5b61af4b327d6b55fe1f670309bf15f66f4a3b3f51a5f0aad83374a`）。重复点批注/截图字节/文字选区/变化拒绝/重新定位的真实交互，并新增用户气泡只显示文件名、页码与正文的断言；canonical输入仍含完整定位。截图人工复核，技术JSON展示缺口在该候选关闭。两份收据各有50份源与根工作树SHA一致；版本仍为1.159.0独立后端基线。

最新组合14suite/164项、根typecheck第5轮、窄strict lint和`git diff --check`通过。完整`verify:gui-smoke` wrapper在独立候选执行中；根`verify:local`单独执行，结果不能先写绿。剩余专业文件为DOCX批注、批量comments/主Composer accessory、Workspace卸载/进程重启草稿耐久性、工作表/幻灯片及编辑保存闭环。

## 2026-10-17 接续：共享文档批注 owner 与资源护栏

新增窄写集：document 目录的通用批注模型、`DocumentAnnotationDraftStore`、`DocumentAnnotationCommentEditor`、`DocumentAnnotations`、`DocxPageView`，及原 PDF 消费者、canonical 展示/提交测试、专业文件 fixture 与五语言批注文案。旧 PDF 专用共享类/文件/导出直接迁移，不保留 alias；PDF 页面渲染和 canvas 截图仍由 PDF 格式 owner 持有。Rust、协议、Plugin、release 继续只读。

DOCX 批注参考同一已分析成员 `docx-preview-panel-79829ce69ce8.js` 的 point/region、selectedText/selectionRects、pageNumber/pageSize、编辑卡及 saved/direct 语义。安装包静态证据不构成参考运行。Lime 采用已清洗的无脚本 iframe，新增 `allow-same-origin` 仅供父页面读取 DOM Selection 与挂载定位 portal；不授予 `allow-scripts`、top-navigation、forms 或网络资源，CSP 保持 default/script-src none。当前目标为同页 point/文字选区→共享草稿→版本核验→既有 typed start/queue，失败保稿、明确重新定位、同一 canonical Thread/Turn/Item 与正文展示；尚未声明批量或耐久性完成。

资源护栏：完整 `verify:gui-smoke` wrapper 首轮在独立候选缺少 `lime-rs/resources` 的29处 include_str 编译失败。只复制根未改动的77份资源到候选并记录 `.lime/qc/professional-files/docx-wrapper-inputs-20261017-2.json`；未改根 Rust。对 freshness 先取得资源更新仍 ready 的红例（32pass/1fail），再将 resources 纳入 appServer 输入，验证只使 appServer stale 且重建后恢复 ready。资源/最后 DOCX readiness reset 组合40项通过。第2轮原完整 wrapper 重跑，仍走原 Rust 编译，无额外旁路。

共享批注第一轮回归暴露 metadata 期望仍含 renderer format 及 jsdom 不解析 srcdoc 的旧测试假设；已迁移为 wire type 和实际 iframe DOM load 行为。第二轮13suite/120项通过，覆盖 DOCX 真实 DOM Selection 与坐标、marker/关闭/迟到生命周期、两格式 typed acceptance、canonical content/content_parts。类型、lint、新原生 DOCX/PDF、标准门禁仍待完成；不将迁移前的成功收据扩张为新源码证明。根 verify:local 仍运行默认132批，在实现期间源码发生迁移，因此需补最终写集验证，不能声称固定源码的全量证明。

默认门禁第1轮在33/132批发现上一截图证据 helper 的真实生成脚本缺陷：`Function.toString()`捕获Vitest转换后的import绑定，独立backend执行报`__vite_ssr_import_1__ is not defined`。这是本写集引入，已在生成脚本边界显式传递image evidence/hash依赖；不改断言或忽略失败。补充真实PNG请求到独立stdin/stdout进程/ledger的字节摘要回归，与原reasoning producer共14项通过。默认第2轮重新走前置并使用既有续跑状态；第1轮失败日志保留。共享hook从组件文件移出以满足原strict refresh护栏，没有加eslint禁用；迁移后窄strict lint通过。typecheck第2轮通过，第3轮对拆分后最终源码执行中。

共享拆分后的组合15suite/186项与完整typecheck第3轮通过；包含资源freshness33项和canonical ownership33项，独立生成脚本14项另列。完整wrapper第2轮通过原Renderer/Host/Rust构建及SHELL-01 24项；当前共享批注源码已窄同步同一独立Rust候选，原wrapper第3轮重跑。新的DOCX/PDF候选Renderer构建通过、完整freshness ready。真实DOCX批注第1轮推进到批注工具栏时发现通用文案迁移遗留空格及日文助词；修正三语言并新增五语言真实工具栏/草稿恢复/会话隔离DOM回归，12项通过。首轮原生等待原期限退出后保留原件，再以新Renderer验收，不改locator或放宽期限。

## 2026-10-17 接续：稳定 DOCX 文档与过期范围守卫

固定写集继续限定文档适配器、测试、fixture及相应文档；额外认领原本无脏改动的 method 产品范围矩阵与 `codexMethodProductScopeBoundary.test.ts`。未修改并行 Rust、协议或 Plugin 生产实现。

Agent current fixture 聚合已收取 exit0；覆盖其实际列出的 runtime/GUI 子场景，`liveProviderUsed=false`，不扩张为专业文件通过。完整 GUI wrapper 第3轮也已收取 exit0、标准24项；其源码早于本节最终 iframe 修复，最终源码仍需新 wrapper。

DOCX 原生第2轮卡在 Playwright `mouse.move` 的 drag manager；该工具向无脚本 iframe 注册脚本监听，调用未能返回，不能解释成业务 acceptance 失败。受控 Main54148 经已核验的自身 inspector 请求正常 app.quit，退出 code0/signalnull；没有信号强杀。最初 inspector dynamic import 不支持并产生额外诊断错误，原样记入失败。该轮 trace teardown 失败，整体 exit1，不能计通过；中断记录和诊断图均保留。

产品同一源文档的翻页/缩放改为更新 `docx-preview-view`，保持 iframe/Document identity，文件/修订/source SHA/重试变化才重建。初始空白 load 不设置 Document；旧页 pointerup 监听随切换卸载清理。首轮定向3失败保留，修复后19项通过；完整相关14suite/130项通过，typecheck与窄lint随后通过。

DOCX 第3/4轮以原生 CDP 鼠标事件推进点/文字选区/变化拒绝/保稿/重新定位，全部业务断言已执行，最终因41条 sandbox console error整轮失败，未过滤错误、增加脚本权限或放宽期限。React 源码确认不仅按钮，portal容器也安装 onclick 占位；只迁按钮仍失败，因此移除 iframe 内 React portal，改为父页面原生 DOM 与 addEventListener。按钮与容器 onclick 均为null的回归、定位与Selection/翻页/清理16项通过，最终原生待验。

共享迁移后的 PDF 原生 `document-pdf-annotation-native-20261017-1` 已收取 exit0，含点/截图字节/选区/文件变化拒绝与重新定位、canonical展示、前后身份/freshness和正常退出；本轮新收据尚待冻结，旧收据不追写。

默认 verify:local 第2轮的61批失败包括本写集 fixture 漏登记 external backend 精确白名单，以及过期矩阵仍禁止已经进入当前 Plugin owner 的 marketplace/add/remove/upgrade。前者只登记 `scripts/electron/document-preview-fixture-smoke.mjs`；后者同步为三项 current 同名合同、owner及公共JSON-RPC证据，矩阵174 implemented/71 excluded/0 planned；对应37项通过。不以方法计数证明完整Plugin或GUI完成，不改其余excluded规则。第3轮默认入口正在沿原续跑状态执行。`test:contracts` 的发布文档外部仓库路径误报仍开放，未夹写release事实或放松扫描。

## 批量批注实施合同（2026-10-17，active）

参考复用已分析 batch-controls 成员 SHA cdf7516a5efe0760b5e5f5b0e48881c0c4e5ffde6b826e985e7e76f1bbda21ca、REA parent ev_605b8adbcdd0fa9a6f8d08f462ee1208401f5509b5695136a9cb71e59ebed38f；本轮 asset view ev_8715ccb746047a339d585d311963a95981005b62be971279f6a50e51af5d0793 复核身份，未重新运行分析或参考应用。静态确认 saved comments 按 conversation/file 隔离、防重复、一次 dispatch 携带 comments、失败保稿和 review 导航；内部原名仍 unknown。

窄写集：同一 document annotation model/store/hook/editor/accessory、既有 Workspace 提交 hook 与 Context、五语言、对应测试和原生 fixture。单条和批量均调用同一 submit；批量由已有 per-comment Controller 产生不可变发送快照，临时 Controller 只承载组合输入的既有 typed settlement，不持有可编辑草稿或业务状态。原源文件 SHA、format/path 与 ID 唯一性必须全批次通过；只提交一个 Turn/Queue item。pending 一次发布，阻止并发或部分开始；接受后逐条 revision-safe commit，新输入保留；reject/cancel/fileChanged 均释放 pending 并保稿。同一canonical会话、零mock及普通主Composer不受清理是退出条件；批量不是重启耐久性证明。

## 主 Composer 批注入口合同（2026-10-17，active）

继续复用 REA batch-controls parent/asset view，不执行参考应用。新增窄写集为 `Inputbar/index.tsx` 的单个 accessory 挂载、`DocumentAnnotationComposerAccessory`、共享批量 submission helper、Store 的一次性聚焦意图，以及既有 Context/Workspace hook 的打开文件回调；PDF/DOCX 仅消费同一导航请求。Inputbar 当前无未知改动，其他领域继续避让。

同一 session/thread 的草稿按文件分组展示，可审阅、跳回页码、取消和整组发送。文档浮层与主 Composer 复用同一提交函数及 Store pending，禁止第二批量发送实现。新入口不改变主 Composer 正文/附件或原发送动作；失败/源变化保稿，接受仅 commit 捕获 revision。聚焦请求只是 Renderer 导航意图，不构成业务或持久化 owner。先补 Store/组件真实点击与提交/导航/错会话/重复发送回归，再作真实 Electron 从主 Composer 提交验证。该入口不宣称跨进程耐久性、Workbook/Slides 或原文件编辑保存完成。

## 原生 DOCX 与 canonical 批量结算（2026-10-17）

第5–9轮仍因41/47条 sandbox console error失败，移除 React portal 并未消除错误，先前因果猜测撤回。第11轮保留实际 renderer URL、DocxPreviewPanel chunk SHA及两个 realm 的 EventListener 清单，证明没有加载旧portal chunk，子文档主世界和utility world均有Playwright全局监听器。独立最小例在sandbox true/false、只读locator矩阵均未复现错误，因此不能把普通父页面回调笼统归为被禁止。

fixture所有子文档选择器、文字、属性和尺寸改从父文档读取；真实鼠标点击与拖选仍用CDP Input，不合成Range/业务状态，不装子文档脚本。第12轮因helper局部document遮蔽失败，修正后第13轮完整通过：点批注/关闭/marker恢复、真实文字选区、源变化零Turn拒绝与保稿、明确重新定位、新SHA接受、canonical展示、零console/page/trace/mock及Main正常退出；同Renderer无需放宽sandbox权限。根和候选各一次第10轮分别因stale-source及漏传APP_SERVER_BIN在启动前失败，原件保留。

批量原生第1/2轮均在来源Turn的严格校验失败：surface currentTurnId落后于canonical最新Turn。产品Provider接线改用threadRead.thread_turns.at(-1).id，第4轮完整通过；第3轮构建尚未结束即启动，被原freshness的stale-source拦截，未启动产品，不计成功。没有把来源断言改为任意历史成员。

通过run `docx-annotation-batch-native-20261017-4`：两页保存与上一条/下一条审阅，关闭保稿，单批两条只新增一个Turn，同canonical session/thread/latest originatingTurnId、相同path/SHA、正文显示、marker移除、主Composer草稿保留、前后源码/产物/freshness、零错误/mock及Main正常退出。截图已人工复核；该run早于主Composer新accessory，不能替代其新原生验收。

默认前端 `test:resume` 已续跑至133/133批并exit0；不能把续跑机制写成所有旧批次对最终源码重新校验。后续批量相关16suite165项、主Composer入口15suite246项分别通过；typecheck/窄strict lint在对应源码通过，聚焦请求一次消费的最终回归另列。`test:contracts`第5轮仍只在release文档外部仓库路径引用失败；现仅将该条引用补为外部仓库绝对Markdown链接，不改发布行为或扫描规则，等待新合同聚合结果。

### 2026-10-17 主 Composer 回原文入口修正

真实 `docx-annotation-composer-native-20261017-1` 暴露：主 Composer 跳回 DOCX 时，`openProjectFilePreviewInCanvas` 使用旧 `buildGeneralCanvasStateFromWorkspaceFile`，右侧面落入文本预览；`document_pages` 也未被 `shouldUseProjectedPreviewArtifact` 接受。保留该红例，不归因于尚未证明的 focus 竞态。

本轮窄写集扩展为 `useWorkspaceArtifactOpenRuntime.tsx`、`useWorkspaceArtifactPreviewActions.ts` 和两者对应测试。两个已读取文件入口统一委托现有 `openFilePreviewArtifact -> openArtifactInWorkbench -> PreviewArtifactRenderer`，保留绝对源路径、binary/size；`document_pages` 不再触发第二次文本加载或旧 Canvas document selection。迁移 DOCX/PDF 的旧正向 selection 断言，增加真实 hook 接线与迟到取消回归。复用已有五语言失败文案。并行 Rust、Plugin、release 源码继续避让。尚待本轮定向、构建、真实 Composer 回跳与完整 GUI wrapper。

真实回跳第2轮 DOCX / 第1轮 PDF 均已进入 ready 的正确专业面板，但编辑卡消失；父 DOM 只读诊断保留在 `/tmp/lime-document-composer-live-diagnostic-2.json`。两轮均正常 Main 退出，无强制回收。已将 `openComment` 改为等待既有文件打开结果后再发一次聚焦，并把同一 cancellation predicate 传至文件入口；导航、卸载、新请求、移除草稿和读取失败都不得让迟到请求抢回页面。新增定向后5suite77/77通过。与旧面板的真实接线仍以下一轮 Electron 为准，不将 Promise resolve 自动等同于已完成 DOM 挂载。

等待文件 Promise 的第3轮 DOCX / 第2轮 PDF 仍未恢复编辑卡，保留两个红例与父 DOM 诊断 `/tmp/lime-document-composer-live-diagnostic-3.json`。现为每次回跳生成 `previewRequestKey`，经既有 transient artifact 投影传至两种面板；聚焦意图只由匹配新请求且 sourceSha 就绪的面板消费。旧面板拒绝消费的实际重挂载回归已加入，8suite114/114、strict lint通过。预览标识只属 Renderer 显示意图，不进入 canonical 业务身份、协议或持久化。

最终标准 wrapper 使用原已验收 `lime-docx-validation-emuwtwlv/candidate` 的同一1.159.0后端缓存。同步前逐字节核对两候选 manifest/lock、全部 Rust/Host/AppServer client 源码一致，仅覆盖39份已声明前端/fixture文件；清单 `composer-final-candidate-sync-20261017-1.json` 保留 before/after。这样标准 `verify:gui-smoke` 仍执行完整原入口，不跳过构建或重编根并行热区。原生需等 wrapper 整轮退出后再跑；尚不代表根1.160.0后端验收。

最终请求标识候选的 `docx-annotation-composer-native-20261017-4` 整轮通过：原点/文字/版本恢复、主 Composer 返回原页编辑卡、整批一 Turn、主正文保留，零 console/page/trace/mock、正常 Main 退出（无强制回收）、64源/700产物前后稳定。人工复核主 Composer 审阅截图。标准 wrapper4 亦 exit0、24/24、全部错误/mock为0。PDF 第3轮已恢复编辑卡，但页码被默认初始化滚回1；该轮还出现15秒正常退出超时、自有fixture强制回收，原件保留，退出根因仍 unknown。

PDF 最近 owner 的真实 virtualizer 观察回归先有效1红13绿，证明编辑卡虽然打开，最后一次 scrollToIndex 仍为0；初次 prototype spy 不适用实例字段的测试设置失败另留原件，不能当成产品红例。将批注 hook 移到默认分页/宽度测量初始化之后，原断言不变后14/14通过，strict lint通过。当前源码最新标准 wrapper5 与最终类型检查重跑中；原生 PDF 必须再次证明原页位置和正常退出，后续再验共享 DOCX。

### 2026-10-17 人工视口复核与工作表接续

完整标准 wrapper5 收取 exit0、24/24、错误/mock为0，最终 PDF 顺序修复后的类型第3轮 exit0。PDF 第4轮回原页码和编辑卡通过，后续恢复场景仍直接假定重开前的点批注模式，点击页面未产生编辑卡而超时；该轮 Main 正常退出。fixture 已增加显式开启批注及 aria-pressed=true 断言，第5轮原有完整合同通过，DOCX 主 Composer 第5轮也完整通过。红例、原日志和旧成功合同冻结 `composer-review-20261017-1/receipt.json`，不覆盖历史记录。

人工检查 PDF 第5轮截图发现页码/编辑卡为2但视口仍停在第1页，因此没有将其升级为最终回原页验收。显式跳页改为导航请求，在包含总页面高度的 DOM 提交后执行滚动；原生 fixture 新增目标页顶部和视口的几何关系，下一轮必须同时证明文字、页码、编辑卡、真实视口和正常退出。第3轮退出超时的根因仍 unknown，未以重跑通过冒充定位。

新增工作表只读产品写集与[工作表计划](codex-workbook-alignment.md)。WorkbookPanel、原字节 Worker 解码、源 SHA、真实缓存值与尺寸/合并/可支持样式、A1/键盘/虚拟滚动及五语言已实现；70项定向通过，时间线原二进制拒绝分支同步迁移并与 PDF 导航共23项通过。两条真实分发遗漏及类型 cell.row 声明错误已修正，旧失败日志保留。完整根 frozen lock-only（9个workspace）通过；依赖安装/锁记录另存，未改全局工具链。

当前分类：current 为唯一原文件/预览/共享批注/Composer owner 与新增只读 WorkbookPanel；新增 compat/deprecated 0；旧 XLSX 抽取文本优先断言、专业二进制提前拒绝已替换。专业文件整体仍 partial，工作表范围反馈/编辑保存、幻灯片、跨 Workspace/进程耐久性未关闭。原生候选仍为1.159.0后端，不代表根1.160.0并行后端；不报无分母的整体GUI百分比。


## 导入历史源路径接续（2026-10-17）

本轮额外认领此前无脏改动的 `src/lib/api/agentRuntime/appServerCanonicalItemReader.ts` 及测试；只替换fileChange的path/move_path显示裁剪，不改协议或Rust。源路径属于操作身份，卡片显示名称继续由既有presentation负责。跨层回归连接真实canonical reader、时间线navigation和Workspace打开hook，覆盖无项目导入及同名缓存；单测补macOS、Windows、UNC、相对路径及rename。最初直接传目标的14项通过，只排除了缓存假设，不记录为产品红例。实际红例分别5failed/40passed和5failed/9passed，修复后4suite80项通过。

导入第2轮Main30561、第3轮诊断Main46990均正常code0/signalnull、无强制回收，console/page错误0；整轮仍失败，不计通过。诊断只在本任务renderer读取React owner props，已从源码和候选移除，原始日志与失败summary保留。根类型第2轮exit2仍为并行账户exports缺口，不修改并行文件来取得绿灯。

候选写集扩至93文件，记录 `import-source-path-candidate-sync-20261017-2.json`。新标准wrapper已走完整Renderer/Host/sidecar资产流程，run `standalone-shell-01-20261017112902-59840`、24/24。导入helper保留专业格式DOM/pixels/ZIP噪音与错误断言，额外要求真实fs/readFile参数等于fixture源绝对路径。最终组合收据及三格式回归尚待结算，原冻结收据不追写。


## 操作源路径与 Office 分发最终回归

`readFileChanges` 不再用 `safeDisplayPath` 改写操作字段，保留原 path/rename move_path；显示裁剪仍由 presentation 承担。reader及真实 reader→timeline→Workspace→gateway 跨层先各5项红，随后4suite80项通过。Office 抽取文本误入Markdown的真实红例已修复：删除无消费者的 document_text；PDF/DOCX/Workbook 专用分发，当前尚无renderer的PPTX明确system_open。该降级仍是Slides能力缺口，不计复刻完成。

导入第4轮停在上述Office分发；第5轮六格式预览通过后，拆分GUI helper漏导入 `IMPORTED_PREVIEW_MARKDOWN_FILE` 导致visual-audit失败。两轮原件与正常退出均保留。补齐真实词法导入，并以ESLint no-undef遍历拆分后的五模块，先红后绿；真实浏览器Composer只读函数继续由原withComposerEditorDom序列化。源路径、DOM、原字节、ZIP噪音、三个视口和真实继续对话断言均保留。第6轮完整通过后，依次运行Workbook7、PDF9、DOCX7，均通过。最新组合收据明确排除后续应用scope草稿改动；不是全GUI完成声明。

应用scope批注架构确认：责任开发者root，2026-10-17。状态仍在现有Renderer annotations owner，Jotai仅控制内存生命周期，不新增持久化/业务authority；发送前导航取消、发送后原revision结算与独立应用scope隔离不变。已更新architecture对应文字。参考app-shared静态证据只支持应用scope内存，不把进程重启unknown扩写为已实现。

## 应用 scope 验收结算

应用 scope 批注已独立冻结：标准 wrapper24/24，Workbook 原生第8轮真实设置导航卸载原 Workspace（原 Composer DOM isConnected=false），返回后两条正文、位置、源文件变化错误及主草稿保留；显式重定位后整批仅新增1个Turn。Main code0/signalnull、forcedCleanup null、console/page错误0、freshness前后ready，94源/1688产物无漂移。收据 `.lime/qc/professional-files/annotation-scope-final-20261017-1/receipt.json`，SHA `f40cbab2cbaf82af4696797e4dc5d89c48e8173725c4aa452bb723b7f779b5a4`，设置返回截图已人工复核。该收据不包含后续 Slides 变更；进程重启耐久性仍 unknown。

Slides 当前实现使用固定 `@aiden0z/pptx-renderer@1.3.0`，真实三张 OOXML fixture 的源 slideId 为512/900/300。组件首轮因 iframe Document 复用漏加载事件失败，修复后6项通过且第3轮无 act 警告；单条/跨slide批次/SHA拒绝提交34项通过。导入夹具删除不完整 writeMinimalPptx，迁移真实源字节fixture。DOCX/Slides原生驱动收敛为单一 artifact-frame-driver，无旧别名。新全类型、相关测试、wrapper和Slides原生继续验证，不能引用上一收据作通过。

全仓默认第7轮的前端续跑完成134/134批，Rust阶段因新增AccountUpdated枚举未进入TUI通知target匹配而exit101。Codex current同一函数将账户更新归Global；原目标文件无脏改动，本写集窄扩展至tui/src/app/app_server_event_targets.rs，仅补Global映射与有/无账户回归，不改账户/protocol owner。定向crate验证和原默认入口复验待结算。Slides首轮全类型还发现页面适配器以排除workbook收窄，新增presentation后不再完整；已改为明确pdf/docx guard，原页面35项通过，严格lint通过，类型第2轮进行中。

Slides 第二轮完整标准wrapper24/24通过（run standalone-shell-01-20261017121635-75511），根依赖锁已包含并固定106声明源。全类型第2轮、strict lint、contracts、docs/reference/scripts守卫和根1.160.0版本检查通过；TUI账户通知target定向5项通过。原生首轮在窄屏尺寸变化后立即读取旧几何而失败，截图已显示适宽；保留原失败/正常Main退出/零console-page错误，在原期限内等待同一几何条件后复验，不放宽宽度或ready断言。当前完整原生队列第2轮验证Slides及四格式共享回归。

Slides 第2轮与导入7、DOCX8、PDF10、Workbook9五个串行原生全部通过，106声明源/2022产物零漂移；但人工看图发现上方仍有旧二进制不支持toast，不能据此关闭Slides产品项。新增打开入口回归先得到4fail/37pass，定位两处分发列表漏presentation；补齐两处同一专业预览分支后6suite69项通过。新原生在每次slide ready时断言不支持toast为0，源变更已同步sync4，完整wrapper3及最终原生重新验收，不将旧成功写成最终证据。

默认第8轮停在43/132客户端编译：并行cloud/request消费者先落地，schema20:40才更新、TS生成物仍20:13。已隔离复用原生成器导出72行纯增量handoff，未覆盖根；随后根生成物由另一进程更新到20:51，观察其与隔离结果一致后原入口第9轮续跑。生成证据保留于cloud-types-handoff-20261017-1；第8轮类型第3轮失败保留，不冒称最新根通过。

最终原生队列第3轮：Slides3和导入8通过，DOCX9在打开文件前等待隐藏menu超时，Main正常/零console-page错误。fixture原先无条件点击toggle，可能关闭已打开工作台；现记录开关aria-label且仅closed时点击，仍等待原可见menu和完整文件操作。该修改仅测试导航前置，不跳过任何场景或放宽断言/期限。完整队列第4轮进行中。


## Slides 只读与共享原生最终结算（2026-10-17）

PresentationPanel 对齐同一 artifact/presentation/ owner。源 OOXML slideId 为512/900/300，点位置使用原尺寸坐标；完整位置 proto 与原库版本仍 unknown。固定 @aiden0z/pptx-renderer@1.3.0、有界 ZIP/XML、外链 relationship 剔除和无脚本同源 iframe 已接真实分发与共享批注。旧不完整 writeMinimalPptx、docx-frame-driver 直接迁移，无 alias。

Slides2 虽断言通过，人工截图仍发现不支持toast。两处打开入口漏 presentation 的回归先4红/37绿，补齐后6suite69绿；最终 ready 断言要求旧toast为0。队列3 DOCX9 的 menu 超时保留，前置依工作台实际开关状态操作；原失败原因仅为可能，未确证。

最终队列4 Slides4→导入9→DOCX10→PDF12→Workbook11 全部 exit0；freshness 前后ready、console/page错误0、正常Main code0/signalnull、forcedCleanup null。106声明源码/2133 regular产物无漂移（2045 renderer、34 host、54 client），更正先前2022；单格式原生独立清单93源码。标准wrapper3为24/24。双份收据 .lime/qc/professional-files/presentation-final-20261017-1/receipt.json，SHA b58c5f2371fd49bd338e1a8fb028d4eea8697a43370e20dd8169aa41e57197f3；195份原件含失败历史与验证日志。Composer、接受后、窄屏截图已人工复核，旧收据不追写。

current 为原网关、PresentationPanel 与既有 annotation/Composer owner；新增compat/deprecated为0。dead/deleted 为不完整PPTX构造器、DOCX专用共享驱动名及旧PPTX system_open正向分发；.ppt仍不支持。本只读/反馈合同5/5场景通过，Office编辑/flush/save/冲突/roundtrip仍开放，不代表全产品100%。

根默认7前端134/134后Rust缺AccountUpdated target，按Codex Global映射修复，定向5项通过。默认8缺Cloud生成方法；生成物更新后默认9在Cloud新增account字段的类型同步处失败。原日志均保留，不夹写并行Cloud。全类型2曾通过，不替代当前根结果。全9 workspace offline/frozen/ignore-scripts锁验证通过；依赖锁mtx-decompressor1.8.0，published bundle notice为1.4.2，构建来源未独立复现。

候选后端1.159.0，根1.160.0；最新根默认与GUI/Host/Rust需另验。Office编辑保存、其余GUI/符号、参考运行、live、Windows和安装包仍开放。
