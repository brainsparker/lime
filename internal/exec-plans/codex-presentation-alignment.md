# Presentation 本地编辑与 Codex 对齐

状态：active；负责人 root；2026-10-18。主目标见 [GUI current 计划](codex-gui-alignment-current-plan.md)。保留差异仅为主题、多模型和首页 Banner。

## 已确认参考与实现边界

同一 Codex Desktop 26.1007.30912/build20156，ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。REA 本地 caller parent `ev_7e96cf795451f834a7bddc70daacbc950320070656781f6347f1cf9c759e4299`，presentation parent `ev_363dcdc24c3bb1717c709daf6b82fb17bb7878999d041c4feb0804fd16d24069`，editor asset view `ev_99db9c395716d39135d83502ab0327e4e23c8639a2b08b606208dbdbf992be56`。静态补读原 ASAR：本地 caller 的 `presentationEditingEnabled` 受 feature flag/host/read-write 能力约束，直接进入 SidePanelPresentationPanel → PresentationPanel；不经过 remote PresentationEditor。本地 onPresentationEdit 从 controller 导出 proto，500ms 串行保存；首次重读原字节并获取 ETag，再以 ifMatch 写原 host/path；关闭/下载/分享前 flush。Panel 交互还受 CRDT publishing readiness 约束。参考 feature flag 实际值、运行行为、bridge 下游及原始控制器类名 unknown；不运行参考、不把压缩名当领域名。

可确认的方法包括 setEditingEnabled、textActivateBlockEnd、textHandleInput、textHandleCompositionEnd、nudgeSelectedElements、updateSelectedElementFrame、updateSelectedElementStyle、deleteSelectedElement、undo/redo。按语义迁入 current owner，不为同名创建空壳。

Lime 第一编辑切片在既有 PresentationPanel/PresentationSlideView 内增加顶层文本框文字、位置/尺寸、文本样式、删除及撤销/重做，原包定点修改保留未投影内容；不冒称 Walnut proto/CRDT 实现。既有 fs/readFile/fs/writeFile 没有 ETag/CAS，本切片以两次 SHA 校验拒绝已观察外部变更，无法证明跨进程原子写；协议/Cloud/Plugin 并行 owner 不夹写。完整对象、分组/表格内编辑、增删/排序幻灯片、自动保存/关闭前 flush/CRDT 和精确导出仍须分别结算，不能以本切片关闭完整能力差距。

## 写集与 Verification Contract

P1、非 live。root 负责 presentationDocument、PresentationController/usePresentationController、编辑 overlay/controls 与 PresentationPanel/SlideView 接线、五语言 workspace 文案、组件回归、架构与本计划。独立 worker 仅负责 presentationPackage 与其 unit suite。双方共享既有 owner，无新 runtime、JSON-RPC、持久化或 compat。Plugin/Cloud/Rust、release 和未知产物只读。

输入为真实 PPTX 原字节、slideId 与 elementId；UI 只拥有应用 scope 编辑稿与选区。保存后仍走 current gateway → Electron/preload/IPC → App Server 文件 owner，批注前由既有 flush registry 等待保存；保存导致 SHA 变化时旧批注必须明确重新定位。文字 IME 不误提交，取消不写盘；保存失败/外部变更保稿；保存期间禁止继续编辑和放弃，重复保存共用同一 Promise；Workspace 卸载/重挂载保稿，不宣称进程重启耐久性。

退出条件：真实 OOXML 往返和非目标 payload、控制器竞态/冲突/失败、键盘/IME/五语言/真实组件卸载；类型/lint/contracts、标准 GUI；同源 prepared sidecar 下真实 Electron 编辑→保存→重开、外部变更零覆盖、应用 scope 保稿、批注前 flush，全部 source/artifact/freshness/零mock/正常Main退出守卫保持。未验收不得勾产品完成。

分类：既有 PresentationPanel/SlideView 为 current；新编辑能力只扩展该 owner。新增 compat/deprecated 0；旧只读限定文案/过期测试随实际实现迁移，不删除有效安全守卫。Architecture impact: minor；责任开发者 root 于2026-10-17确认，架构图随实现同步。

## 实施与验证接续

2026-10-17：包编辑66/66、Controller8/8、Panel9/9、Workspace提交38/38已通过，计数分别对应独立suite，不将旧Panel8/8重复累加。真实组件红例发现投影重建时旧slide已脱离文档，却提前消费焦点恢复；现只在已连接slide安装overlay，连续方向键仍聚焦同一原elementId。文字编辑使用原字号/粗体/斜体。首轮lint的side-effect ternary及旧Panel缺writeFileBytes fixture已修；失败日志保留，不改断言或期限。

新候选 `.lime/validation/presentation-edit-1.160.0-20261017-1` 克隆已验收工作簿候选6，先核8660声明源/2010产物，再同步22份本轮文件（8670声明源），未复制并行Plugin/Cloud/Rust变化。准备收据 `.lime/qc/professional-files/presentation-edit-validation-20261017-1/preparation-receipt.json`；标准wrapper、最新完整typecheck及原生编辑/flush待终态。五语言结构8745键无缺失/多余，unused0，4份编辑显示文件硬编码findings0；脚本三文件no-undef为0。架构图已同步同一Controller→原包→投影/既有文件网关与批注flush，无新业务后端。

GUI current计划中的逐轮活动清单已冻结到2026-10-17历史快照；current页只保留当前阶段、领域导航与未完成范围。历史证据不删除、不追写为新结果。

补查原Panel成员确认 `setSelectedSlideIdx(index)` / `setSelectedElementId(id)`，已直接迁移Controller、调用者和测试，不保留selectSlide/selectElement alias；真实slideId仍保存在模型与批注中。原字节有界上下文位于参考目录 `selection-methods.json`。wrapper1在转换阶段仅向本任务候选Vite PID64600发送SIGINT并exit1，日志及中断原因保留；它未完成、没有产品通过结论。最终命名和最新原生等待helper已同步候选，五份增量记录 `selection-migration-sync.json`，8670源终态输入另存 `candidate-sources-final-input.json`；标准wrapper2重新走完整入口，未跳构建或放宽守卫。

## 关闭与文件动作：下一刀只读定位

以下为current源码观察。关闭/导航接线仍待基础编辑Gate B冻结后继续；应用scope保稿不等于已实现关闭前保存。资源等待期间，独立的下载/系统打开切片可先在root实现；不复制到当前候选，另行绑定来源和验证，不能计入本候选通过。

| 转换                             | current owner                                                                                    | 最小接线与失败合同                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 文件选择/重开                    | useCanvasWorkbenchDocumentState.handleOpenDocumentSelection / handleSelectWorkspaceFile          | 改selectedKey/tab与进入loading前flush当前实际文件；失败保持文件、稿件和可见错误 |
| tab选择/新建/关闭                | CanvasWorkbenchLayout / useCanvasWorkbenchToolTabsState                                          | 共用受保护转换；非当前tab不能误保存其他文件                                     |
| 关闭/收起整个面板                | useWorkspaceCanvasLayoutRuntime.handleCloseCanvas / handleToggleCanvas                           | setLayoutMode前flush，两处均覆盖，不能只包关闭按钮                              |
| artifact替换、source/preview切换 | useWorkspaceArtifactPreviewActions.openArtifactInWorkbench / useWorkspaceArtifactViewModeControl | 清空旧preview与选中新artifact前flush；异步后复核请求identity                    |
| 系统打开                         | useWorkspaceCanvasPreviewRuntime / ArtifactToolbar                                               | OS gateway前flush，失败不离开；不把Controller放进OS网关                         |
| 下载                             | CanvasWorkbenchLayout / ArtifactToolbar                                                          | flush后经readFileBytes读取真实二进制；不能从artifact.content构造PPTX文本Blob    |

现有PresentationController/WorkbookController仍是唯一保存authority；无需全局事件或第二套registry。CanvasWorkbenchShell条件渲染会真实卸载Panel，cleanup中的异步保存无法阻止转换。还须把Layout自动聚焦/preview request和document fallback effect纳入同一转换，不能只覆盖按钮。flush前捕获实际Workbench文件/tab/session/epoch/request，await后复核；外层currentCanvasArtifact可能不是文件树当前可见文件，身份必须沿既有props传递。500ms队列归Controller，导航只委托flush；跨进程CAS缺口仍须真实文件owner合同，不能靠前端guard伪装。

资源调度：机器实测内存压力下候选转换与完整typecheck耗时较长。为先闭环产品Gate B，仅向本任务默认local12 cargo27297的后代rustc43554发SIGSTOP，cargo/续跑状态不改、缓存不删、用户与并行进程不动。进程身份和恢复责任记录 `rust-scheduling-pause.json`。候选GUI/原生完成后必须核同一进程身份并SIGCONT继续原Rust门禁；未恢复/未结束前不能汇报默认门禁完成。wrapper1的SIGINT与本次保留进度的调度分别记录，不混为通过或产品修复。

调度接续：最终selection命名后的完整`typecheck`已exit0（`typecheck-final-1.log`）。wrapper2完成renderer与main/preload构建后，assets的cargo6377等待默认local12持有的shared target锁。核对原rustc43554完整command/测试身份后已SIGCONT恢复，收据`rust-scheduling-resume.json`；不再遗留暂停进程。原cargo27297与wrapper2继续正常门禁，不跳assets、不改用root debug。

独立文件动作切片：root认领`ArtifactToolbar.tsx`/其UI测试、`CanvasWorkbenchLayout.tsx`/定向测试、既有LayoutState的旧文本下载helper迁出，以及新共享Blob下载与保存委托hook、五语言workspace键。只处理真实源文件下载和系统打开的保存前置/失败终态/迟到身份；沿用两个current Controller map，不建第二份稿件或保存registry。固定候选1完全不变；新增切片单独定向验证及后续候选验收。

门禁接续：local12原入口exit101，App Server lib为1941通过/5失败，具体为两个conversation import性能期限、skills watcher通知期限和两个external streaming输出期限，原始失败不清除。单独直接启动原测试binary首轮缺Cargo设置的动态库搜索路径而SIGABRT，第二轮仅给该子进程指定真实debug库目录后串行复验五项，尚待终态；不扩大期限，不冒称最新root/默认门禁通过。

wrapper2原标准入口exit1，8670声明源无漂移；新sidecar需要的`libonnxruntime.1.24.4.dylib`被打包为0字节，Electron启动SIGABRT。失败收据`gui-wrapper-2-failure.json`保留库尺寸/摘要；之后同一adjacent源库已为完整26,291,088字节，精确竞争写者unknown。资源脚本仍原位copy，允许读者看到暂时截断文件；root认领干净的prepare-sherpa与electron-app-server-assets及其测试，改为临时文件校验尺寸后原子发布、拒绝空库，并由两个入口复用。33/33资源定向通过；四文件增量独立记录`runtime-publication-sync.json`与`candidate-sources-runtime-publication-input.json`，未把root文件动作或新结构操作复制候选。wrapper3重新执行完整标准入口。

独立文件动作已实现：保存成功后读取真实二进制、失败不打开/下载、同一动作锁、scope/代次防迟到与往返ABA；原文本下载helper删除，Blob下载单一helper；文件名helper迁出工具栏并删除属性测试中复制的生产算法，测试改用实际生产函数。第一轮35/35，迁移算法后相关仍35/35；其证据不能推广为候选1的产品通过。首次误指不存在vitest.config.ts只为启动失败，随后按实际vite.config.ts执行，日志均保留。

## 幻灯片结构原包切片（2026-10-17）

已完成同版本新worker的有界静态定位，原件与25段UTF-16上下文及合同落在 `.lime/qc/professional-files/presentation-structure-reference-20261017-1/`。新REA producer `ev_d457869d73b033f311449f024009a5737a5571e2a1f816466e7bb0a90dd29911`、summary `ev_177901639db927580b6206274c3094f6353f398f54a6a28feccb882e757c1b51`：客户端300秒超时后一次retained查询恢复complete-record；未展开完整limitations，不代表完整语义覆盖或参考运行成功。新增/复制紧跟当前页并选中新页；移动按目标最终index、保持选中slideId；最后一页不能删除，删除选中页取同位后继或末页前驱。新增继承当前页layout，未绑定时选首个既有type=blank，显式无效layout失败；复制/新增清对象选区，移动及删除非当前页保留当前对象选区。详细editor/camera副作用见findings，不由原包codec承担。

本切片worker只认领 `presentationPackage.ts` 的必要内部helper抽取、`presentationPackageXml.ts`、`presentationSlidesPackage.ts` 和对应unit测试；root继续持有Controller/UI/文案/主fixture。输入为原PPTX与真实slideId/layout part路径，输出原包字节及页序/新页id。新增使用真实layout关系并生成可继承的空placeholder，复制notes与私有图表子图时重写关系，共享媒体/master/layout保持共享；删除不破坏其他页引用。规范OPC相对路径允许合法`..`归一化但禁止越过包根；无完整正确处理合同的结构明确失败并由Controller保稿，不静默丢内容。候选1保持冻结；验证只跑OOXML关系/非目标payload/非法结构的定向unit及本写集lint，不启动cargo、Vite或完整typecheck。当前分类为current owner扩展，compat/deprecated新增0；完成产品交互仍由root后续接线与GUI门禁证明。

原包结构codec已实现并通过定向验证：新增结构27/27 + 既有对象66/66（93/93）、6文件strict ESLint、4生产文件独立strict tsc均exit0；不是全库typecheck或GUI/Gate B。新helper按XML安全/OPC图/页序各自拆分，源码均低于500行；测试fixture独立，不改旧对象suite。API为 `editPresentationSlidesPackage(bytes, edits) -> {bytes, slideIds, createdSlideIds}` 与 `readPresentationSlideTemplates(bytes)`。真实OOXML测试覆盖新增继承/显式/首blank版式、空placeholder样式与图片关系、私有notes回指新页、chart/style/colors/chartDrawing/嵌入xlsx独立副本、共享chart删除保留、移到最终index、删除跳转/customShow清理、content types完整及current renderer重解析；非法结构/末页删除失败不改输入。分节sectionLst、comments/diagram/control等未知私有clone、非顶层文本shape占位明确拒绝。无可用真实layout时失败保稿，属于Lime OPC正确性适配而非声称上游禁止无layout；`layoutId`为本地OPC路径。可选extended-properties页标题/主题分组缓存失效，其余元数据保留。完整文件摘要/实际检查与限制落在同目录 `package-verification.json`。Controller/UI/五语言和新Desktop Gate B尚由root继续；本codec完成不等于Presentation或全GUI完成。

最终自审补齐合法OPC“仅Override、无rels Default”边界：新建与复制的关系part补声明，删除源/私有部件时同时删对应rels Override；新增真实包批次回归，最终结构28/28 + 对象66/66（94/94，4.54s），同写集ESLint与独立strict tsc再次exit0。此前93/93是中间结果，验证收据保留该历史并记录最终摘要。最终worker实际写集为包编辑文件、XML helper、PackageGraph、SlidesPackage、结构unit和独立testFixtures（6文件），无Controller/UI/主fixture改动；候选1未同步。

### 2026-10-17 结构接线与真实指针修复（进行中）

root新增 `presentationEdits.ts`，以有序对象/幻灯片操作日志统一Controller投影、undo/redo和保存。连续对象修改仅在结构操作之间合并；复制得到当时内容，复制后修改副本、移动、删除仍能从原包确定性重放。Controller接入addSlide/duplicateSelectedSlide/moveSlide/deleteSlide，新增/复制选择新slideId，失效对象选区清理；保存等待投影时立即锁编辑。原回归发现invalidEdit被保存起始状态清空，已修复为投影成功后才清错误。真实OOXML Controller 13/13，Panel含指针回归10/10。

基础候选wrapper3 exit0，原生首轮 `presentation-edit-native-20261017-1` 失败：pointerdown选择对象展开父工具栏，iframe移动，pointerup的局部clientY变化被误判拖动，对象Y=-843.2。改用稳定screenX/Y记录真实指针位移并处理pointercancel；组件覆盖同屏幕坐标/不同clientY零修改及真实屏幕位移修改，10/10通过。失败Main正常code0/signalnull，forcedCleanup null；无错误过滤或期限变更。仅overlay/Panel测试同步到原候选，8670声明源零漂移；新输入 `candidate-sources-pointer-layout-input.json`，wrapper4重新走标准入口。原失败与同步摘要位于 `presentation-edit-validation-20261017-1/native-1-failure.json`、`pointer-layout-sync.json`。该候选尚无编辑原生通过收据。

根新增500ms自动保存调度，仅持有timer；已提交、投影完成、无在途文字/保存/错误时委托同一Controller串行flush。输入/IME未提交不落盘，卸载取消timer并保留应用scope稿；失败停止自动重试，显式重试仍核外部版本。定向hook3/3 + Panel10/10通过；尚待新候选产品验收。结构控件/五语言由独立worker接线，Workbench文件/tab/请求切换flush由另一worker持有；两者不修改Controller，也不回填候选1。

文件动作切片已完成真实源basename、Workbook保存委托、失败/并发锁/保存阶段ABA/卸载回归，worker定向33/33及4文件strict lint通过，收据 `fileactions-final-worker.json`。与更早Layout/filename35项非简单相加；尚需整体受影响回归与新候选。分类current扩展，新增compat/deprecated为0；旧重复文件名算法和下载Blob逻辑已直接迁出调用，不保留别名。

根默认门禁12终态exit101：App Server lib1941通过/5个时间相关失败；原binary加正确DYLD_LIBRARY_PATH串行定向5/5通过，44.09秒，日志 `local12-failures-targeted-2.log`。不得将定向复验写成默认通过；后续GUI未执行。SIGSTOP原rustc43554已恢复并结束，无遗留挂起进程。新根结构/自动保存尚未被此前typecheck或候选wrapper覆盖。

### 基础编辑固定候选完成（2026-10-18）

wrapper4 `standalone-shell-01-20261017155127-69493` pass。原生2已通过编辑与批注前flush，随后旧批注fixture固定等待第一页而失败：应用scope Controller在重载时正确保留原选区。迁移fixture为先核批注目标slideId，再核重载后同一slideId及最新source SHA；没有删除文件版本、Thread、错误或退出断言。仅该fixture同步，无生产变更，8670源同步前零漂移；原生3 `presentation-edit-native-20261018-3` 全部通过。

已看保存与冲突截图，原文本对象保持可见、X=61/Y=60、加粗与转义正确，冲突正文保留且提示明确。原包9个非目标payload相等、同路径真实重开2次读取/面板替换、外部修改零覆盖、设置卸载/往返保稿、明确放弃接纳外部版本通过。批注前保存后旧SHA拒绝零新增Turn，显式重新定位后同Thread一个completed Turn；单点及跨slide批次、Composer正文保留和源变化拒绝均通过。

8670声明源、2233 regular产物终态核对零漂移，freshness前后ready，prepared sidecar SHA `9e119061b8f0d601ea7a4cb30d688fc0c55ab51bea66b4525328a195a441d7e1` 不漂移；173 IPC、console/page/trace/mock错误0，Main99179正常code0/signalnull，forcedCleanup null。两份独立冻结收据位于根和候选内 `presentation-edit-final-20261018-1/receipt.json`，SHA `35a781088939c351c8a2b7a00c81dda80699b019d3168331b604fdf536525d2f`。根在冻结时58份声明源已有差异（包括新结构/自动保存与并行工作），故不声明最新根通过。当前收据只关闭基础编辑/保存/冲突/批注闭环，完整结构、自动保存与导航flush的新根候选继续。

根结构UI已接线：新PresentationSlideControls及EditingControls引用、五语言各12键，真实Controller/OOXML组件15/15、strictlint/格式/JSON键集合一致通过。新增/复制/双向移动/删除、末页保护、真实版式选择、无模板/模板失败、保存/投影锁、Controller切换隔离都有回归；未将其算入上述基础收据。外层关闭/收起正在现有CanvasLayoutRuntime注册单一可见surface保存guard，scope epoch阻止ABA迟到关闭，不引入全局事件或第二保存registry；外层定向11 + owner护栏2通过，待Workbench接线/类型检查/新原生验收。

自动保存接线后自审修复跨保存undo：保存不再清除历史，Controller分别持有原操作起点、最后落盘snapshot/SHA及已保存日志位置；undo/redo后dirty按日志位置判断，重放仍从同一起点执行，写入前两次核最后落盘SHA。显式放弃回到最后保存文档并重置历史；同版本receiveDocument保留编辑历史。测试覆盖保存锁、保存后undo再写盘、redo再写盘，结合结构/自动保存/控件31/31通过。Toolbar源码/预览切换与关闭也委托同一文件动作guard，失败不离开预览；相关UI19/19。此前两项失败仅测试使用中文标题但suite选择en-US，已修为实际英文可访问标题，无生产回退。结构native新helper由独立worker准备，根主fixture由root接线。

### 结构与生命周期候选（2026-10-18，active）

Workbench导航当前实现完成：DocumentState唯一持有文件动作锁，文件/同路径重开、tab/new/close、模式、preview request、默认文档投影替换与自动聚焦先保存，失败保留已接受context与请求，迟到scope/ABA拒绝；same identity消费最新投影。Layout通过单一生命周期slot注册外层close/toggle guard，避免两层同锁嵌套。新navigation19 + 原Layout13 =32/32，4文件strict lint通过，独立收据`presentation-edit-validation-20261017-1/workbench-navigation-final-worker.json`。root补齐CommandRuntime向Scene的callback返回遗漏，完整`typecheck-root-3.log` exit0；前一轮真实类型失败保留。

新固定候选`.lime/validation/presentation-structure-1.160.0-20261018-1`从基础编辑已验收候选克隆，8670基线声明源先核对零漂移，按认领写集同步43个文件，现8687声明源；Plugin/Cloud/Rust/协议/release并行变化未混入。输入与准备记录由`presentation-structure-validation-20261018-1/`持有，标准wrapper1进行中，不能提前结算通过。首次仅formatter同步脚本因candidate cwd解析根相对路径失败，未发生写入；随后绝对路径同步完成，不是产品失败或门禁绕过。

合并定向回归233项中231通过、2项真实OOXML结构UI因并发达到原5000ms期限失败；未改期限，同原suite以单worker复验15/15通过（16.42秒）。原失败与复验日志均保留。结构native helper的真实master/title+blank layout夹具及独立renderer/production codec重解析4/4通过，严格脚本检查通过；原生将覆盖每次结构操作后自动保存、跨保存undo/redo、真实read/write IPC、原三页payload与同路径重开。旧editing/flush脚本中“提交后永远dirty/结束编辑仍未保存”的过期假设同步迁移，活动textarea期间才可证明不自动commit，不暂停500ms自动保存以迁就fixture。导航原生helper独立准备，真实Electron终态待验。

strict lint进一步发现`usePublicFileAction` cleanup读generation ref警告；改为每次mount推进generation、cleanup仅标记unmounted，保留重挂/ABA拒绝且无ref警告。共享动作/Toolbar/导航44/44及strict lint通过。仅将本任务Vite72141 SIGINT，保留wrapper1中断原因，再从稳定8687输入运行wrapper2；没有混合构建epoch。导航helper随后补真实Electron DownloadItem捕获、固定证据路径、原文件名/完整bytes/SHA校验及finally监听器清理；主fixture传真实app，外部OS打开仍未测。导航解析/证据测试改入Vitest以纳入默认smart runner，首轮JSDOM中import.meta.url非file失败后改真实root fixture路径，4/4通过；旧失败日志保留。

wrapper2 `standalone-shell-01-20261017161844-23492`标准GUI pass，但构建期间在候选跑`test:contracts`发现未复制internal/aiprompts的环境缺口，exit1；不是完整contract通过。该入口最先执行的协议`--check`实际重写再恢复同内容生成文件，导致renderer/host源mtime新于产物，后续freshness明确stale-source。完整状态另存`freshness-after-contract-check.json`，未启动原生、未恢复时间戳或放宽守卫。根完整`test:contracts`随后exit0，候选wrapper3重新完整构建。生成器与贴边测试独立窄修只读比较；不改协议/schema/generated消费者或并行Rust owner。导航/结构最终源清单已为8689，新增fixture只在构建输入之外同步并记录摘要。

### 2026-10-18 结构原生失败与只读检查终态

生成器窄修完成：协议 `--check` 改为内存格式化与逐字节只读比较，6/6回归；真实候选检查前后bytes、mtime、ctime与inode均不变。根完整 `test:contracts` 最终exit0。标准wrapper3 `standalone-shell-01-20261017162639-64267` 通过，8690声明源/2456 regular产物与prepared sidecar完整绑定，freshness ready。未修改协议、schema或生成客户端内容。

原生1 `presentation-structure-native-20261018-1` 失败：继承title新增已真实自动保存，但macOS原生select弹出菜单的合成Home/ArrowDown/Enter未选中blank；尚不能归因于产品。另有projectMemoryGet控制台错误，底层原因待取得；正常Main退出在原15000ms期限失败后，仅回收本次Main72764。失败原件及独立 `native-1-failure.json` 保留，导航和批注尚未执行，不计通过。

本轮窄改fixture：使用Playwright标准selectOption动作触发控件input/change，保留选择值、真实版式关系和落盘断言；新增独立console错误名/消息与失败trace诊断，不过滤错误或修改退出逻辑。2文件helper测试8/8、三文件strict lint通过；8690旧源与2456产物先核零漂移，再只同步三个fixture文件，当前8691源，freshness仍ready。`candidate-sources-native-2-input.json` 与 `native-select-diagnostics-sync.json` 记录来源。原生2使用新run id执行中；不声明OS原生弹出菜单键盘支持或产品通过。

### 表格编辑下一刀：实现合同与写集（active）

有界REA参考位于 `.lime/qc/professional-files/presentation-object-reference-20261018-1/`；53段UTF-16原文、13份源摘要、20个有界搜索和45处引用已校验，安装ASAR与3个成员字节一致。确认 `tableEditing.{subscribe,getSnapshot,interact,edit}`、单元格选区与对象选中分离、cell文字/样式/清空和现有保存队列；参考cellId导入与分组子对象合同未知，不伪造符号。

worker只认领原包table/text codec、必要shape文字helper抽取及其unit/fixture；root只认领同一PresentationController的table投影/动作、presentationEdits有序重放、renderer cell选择/编辑overlay和控件、五语言与定向测试。固定结构候选不混入这些生产变化。tableId继续是既有cNvPr id，逻辑row/column是明确Lime OPC适配，不声称参考cellId或CRDT等价。

退出条件：两个cell不互相覆盖；cell/对象/slide操作原序重放；普通文字、基础样式和清空仅改目标，merged anchor/continuation正确映射或明确拒绝；IME/切换/undo/redo/冲突保稿与同一自动保存/flush链；真实OOXML Controller/component定向、五语言、标准GUI及独立Electron保存/重开证据。表格行列结构、完整样式、尺寸与group子对象继续开放，不能由此切片关闭完整Presentation。架构延伸仍在唯一current Controller和原包owner内，无新runtime、协议或文件后端；后续图同步同一链路。

### 本地原件丢失：验收状态回退（2026-10-18）

原生3已实际exit0，读到summary.ok=true、console/page错误0与Main67699正常code0/signalnull，无强制清理；随后根整个 `.lime/` 消失，候选、声明源清单、产物清单、截图、旧冻结收据及新REA原件均不再存在。外部删除者unknown；不追造旧摘要或将终端观察冒充仍可复核的冻结证据。稳定缺失声明见 `internal/research/codex-desktop-rea/validation-evidence-lifecycle-20261018.json`。本计划上文保留历史，但所有对应本地路径当前均为missing，结构产品验收须由新候选重建。

根源码与本轮表格实现仍在；恢复package.json已声明精确版本的6份专业文件暂存依赖，保持根manifest/lock不变。静态table合同以同安装ASAR摘要重新有界提取并另存新记录。完成表格接线后，在新源码身份上运行真实产品门禁，不使用已删除候选或旧resume收据宣称通过。

### 2026-10-18 表格接线与新验收（active）

`tableEditing`已接入同一Controller/有序重放，受限iframe支持普通格与合并锚点的选择、Shift扩展、键盘导航、双击/F2、中文IME、文字/样式/清空；共享保存/undo/redo/冲突链。五语言新增3键，重复激活保留活动稿，未变化字号不记历史；表格尺寸未同步tracks前明确拒绝，平移可用。首轮原组件/Controller与新overlay31/31，焦点修正后新overlay8/8；完整typecheck及9文件strict lint通过。新定向测试的merge负向样例发现continuation span约束缺口，已收紧至codec一致；最终新回归待worker完成。

默认`verify:local`已启动，新结果独立落在`.lime/qc/professional-files/presentation-table-integration-20261018-1/`。主fixture增加独立`--presentation-table`，与结构/基础编辑/批注源互斥，仍保留基础预览与canonical identity、真实IPC、零错误/mock、正常退出15秒与freshness守卫；源码/产物记录职责迁到`document-preview-provenance.mjs`，避免继续堆大主入口。下一步冻结新根源码快照，运行标准GUI和表格/结构原生重验；不恢复旧原件或收据。架构图与边界已同步并由本责任开发者确认：仍为单一Controller、原包、current文件网关链，无新增后端或read model。

### 表格行列与尺寸下一切片（active，独立于候选1）

新合同`presentation-table-structure-contract.json`及24段精确UTF16上下文确认insert/delete rows/columns、末格Tab新增行、外框与tracks同步resize。root只认领Controller/纯interact helper、overlay焦点、TableStructureControls/原控件、五语言和Controller/component回归；worker只认领原包table结构codec/shared grid与对应真实OOXML测试。候选1冻结内容不变，继续完成其59项集成已通过的基础cell与结构/导航重验。

原包行列操作复制邻轨格式、清新格文字/merge，按插入或删除的逻辑区间重建合并，不迁移被删锚点正文；至少1轨、至多100轨。resize将frame和rowHeights/columnWidths作为同一action，参考raw只要求finite且正，Lime仅加OPC正EMU可表示及sum/frame舍入一致性保护；不人为加入参考raw未要求的16px下限。普通结构操作只clamp选区；末格Tab意图在新投影完成后聚焦新行首格。所有编辑仍沿原有有序历史/自动保存/冲突链，不加双轨。退出条件为真实原包非目标保留/merged/布局/Undo/冲突、五语言/键盘/尺寸控件回归，以及独立新候选GUI+Electron；完成本切片仍不代表完整group/所有对象或全GUI完成。

结构codec47/47、既有cell46/46通过；保留真实renderer重建、未知payload、rotation/flip与merged矩阵验证。root Controller14/14、overlay9/9、完整typecheck、strict lint与格式通过。首轮23项中的唯一失败是旧末格Tab拒绝断言；改为down边界仍拒绝，Tab新增行由独立真实保存测试覆盖。结构写集尚未进入候选1；独立结构helper和候选2继续完成，不扩大候选1字节与证据。架构图已由root确认同步同一Controller/Grid/原包链。

本轮根默认`verify:local`实际exit1：前置lint/i18n/typecheck通过，前端36/134批在protocol-types-check的两项原5000ms期限失败，124通过/2超时。原日志`presentation-table-integration-20261018-1/local-1.log`保留；负载降低后同一6项以原期限串行复验6/6通过（12.90秒），日志`protocol-types-check-recheck-1.log`。正常`npm run test:resume`已启动，不改期限或续跑状态；默认整轮仍未通过。候选1集成59/59、contracts与typecheck exit0，标准GUI已完成全新Rust sidecar编译，等待入口终态与独立native，稳定阶段收据`presentation-table-current-verification.json`仍为partial。

### 新证据冻结与结构候选2（2026-10-18）

候选1标准GUI exit0，基础cell原生1和幻灯片结构/导航/批注原生2均exit0；两个Main正常退出、错误/mock0、真实IPC70/175。11210份全声明源与382份regular产物前后/终态零漂移，prepared sidecar SHA `ad93d9fa3d61e49c30c10c1b5e8a86136d448d748ce412c29cee5487a0573aa7`。独立双份收据`presentation-table-final-20261018-1/receipt.json`，SHA `2ff9a27cec2c30878fd90b6caa43d2b28a4a8e21e94d9f1b9efddd6736d3e681`。结构复验首轮误传DOCX专用`--batch-annotations`而失败；调用修正为Slides自带批次与Composer路径，保留原失败，不改生产或退出守卫。基础保存/重开截图已人工复核。

结构候选2 `.lime/validation/presentation-table-structure-1.160.0-20261018-2`以APFS clone复用候选1完整构建输入/缓存，再同步26份本写集变更，11219份源码声明独立冻结；不复制最新并行Plugin/Cloud/Rust。继承证据仅历史，不作为本候选通过。新增六结构动作按原panel菜单改为可访问Portal菜单，键盘打开/Escape回焦/禁删尽轨9/9回归；主fixture新`--presentation-table-structure`沿基础cell后扩展，参数合法性在启动前检查。独立helper5/5和strict lint通过；标准GUI、全Presentation回归与完整types正在候选2运行。旧candidate1源码/产物/收据不再改写。

候选2全Presentation及两个helper的16suite292/292、完整types、首轮标准GUI已exit0。原生前核出actions键旧值为“表格单元格”，与新增菜单及helper的“表格操作”不符；仅修正五语言该旧键，不混入第三切片新动作。11219源全量先核零漂移，5份label增量和新输入清单独立记录，再运行完整wrapper3。没有手改产物或mtime，前一wrapper不覆盖label修正。

根默认前端续跑到66/135批在Plugin storage guard失败：旧测试正向要求已被并行owner删除的data/agent-plugins。该测试文件原为clean，root只认领该一处护栏，将旧路径改为禁止回流，保留AgentRoot注入及cache/marketplace/name检查；15/15通过，无Plugin生产夹写。下一次正常resume在构建共享client时exit2，缺METHOD_PLUGIN_RECONCILE与PluginReconcileParams，属于并行协议/生成消费者未齐；root避让该写集，未skip或修改resume。具体失败保留frontend-resume-1/2.log，默认整轮仍未通过。

### 其余表格动作第三切片（active，独立于候选2）

新advanced静态合同25段同ASAR上下文确认move、merge/unmerge、border与options；track keyboard独立原函数确认separator/1px/Shift10px/row20/column24。只读合同完成不代表实现。第三切片先实现move-row/column、merge/unmerge、resize-row/column、distribute-rows/columns八动作：codec worker认领原包union/dispatch、共享Dimensions/Merges/Grid和Advanced codec及真实OOXML测试；root认领同一snapshot能力、菜单/五语言、Controller/component回归与overlay最小接线；另一worker只认领新原生track installer/test。互不覆盖，候选2保持冻结。

merged内容保留、不拼接、不清continuation；move使用原序permutation guard，raw普通numeric选区仍只clamp；distribute按所选轴多轨或全表分布。键盘与pointer轨道尺寸合同分开，不能把raw16下限误用于GUI。可靠内容测量未恢复的row pointer明确保留缺口，不写近似字体算法冒充参考。八动作退出条件为原包/renderer/Controller/菜单/焦点/冲突与独立新Electron验收；border/options、pointer reorder/group/rich text与全GUI另计，不标记整体完成。

### 结构候选2冻结与高级接线进度（2026-10-18）

候选2标准wrapper3 `standalone-shell-01-20261017173500-1496`、contracts、完整types与292项集成均exit0；原生 `presentation-table-structure-native-20261018-1` 的基础cell与13阶段结构操作通过，真实IPC124、console/page/trace/mock错误0，Main5282正常code0/signalnull、forcedCleanup null。11219份全声明源、605 regular产物前后/终态零漂移，prepared sidecar SHA `432622fdd8baa5a26ab04730859bc934c878770bdd6b2e00c54432689bc8b445`，freshness前后ready。双份独立收据 `presentation-table-structure-final-20261018-1/receipt.json` SHA `a84586f7cd192f202653592da5c04fa1ee6d4bb5b3cc52fb363926e928211d34`。缩放/重开截图人工复核；保留没有layout的该夹具正常禁新增状态，不冒称全Office编辑或全GUI完成。

高级8动作codec151/151与严格types/lint/format通过，冻结worker收据 `presentation-table-advanced-codec-20261018-1/implementation-receipt.json`。root Controller16、overlay10、selection17共43/43通过；轨道installer初版8/8通过，新接线overlay11/11证明Shift10px、投影后separator回焦、保存后撤销与原格保留。native复核发现pointerdown preventDefault会阻止自然焦点，root补合法current后focus并追加断言，不用fixture强制聚焦掩盖产品问题。后续真实renderer内容测量、border/options codec、独立advanced native helper按窄写集并行，候选1/2完全冻结。

根正常resume3再次exit2：共享client已恢复PluginReconcileParams，但METHOD_PLUGIN_RECONCILE仍未导出。日志 `presentation-table-structure-integration-20261018-1/frontend-resume-3.log` 保留。协议生产/生成写集继续避让，不skip、不改resume或超时，不将定向通过冒充默认全量通过。

### 高级表格读写与真实DOM交互（active）

行列重排contract新增8段同ASAR上下文；旧REA graph在当前连接返回missing，沿完整portable summary与同摘要原包上下文继续有界提取，不冒称新完整图或参考runtime执行。`presentationTableMove`统一原包/GUI的permutation与merged原序连续性；Controller的reorder producer在成功后整轨选择destination，raw普通edit仍numeric clamp。原包错误分类最初抽取时被合并导致4个message回归失败，已恢复range/merged细分；新增Controller2项、原Advanced58与Overlay11共71/71复验通过。另一次Radix Escape回焦断言早于其异步焦点恢复，改为等真实focus条件，未改生产或期限。

真实renderer测量由 `presentationTableMeasure` 唯一持有；几何/格网仅唯一匹配才绑定table，字体loading/无layout明确not-ready，非文字/竖排/out-of-flow/复杂局部变换明确unsupported。独立Chromium3组rich/merged/旋转双flip实际测量→原包resize→重解析后无内容裁切，4项准备态/绑定回归通过；字体fallback只声明浏览器实际布局，不伪造最终glyph font身份。证据 `presentation-table-measure-browser-20261018-1/result.json` SHA `79f6fc91d8f3ed24e10ac06148f274dcd5ac1eef99b1a99a5f984b153da08b81`，只计Gate A。root已接row callback，Electron row pointer另由真实场景验证。

root接表头/边框snapshot与五语言控件，复用codec同一同步style reader，缺主题/样式明确unavailable，不能把explicit-only当resolved。原fixture孤立builtin style仍为实际能力缺口；新custom styles fixture独立带真实OPC关系，未改原文件去伪造可用。新样式控件8项通过（custom继承/五语言/false关闭/独立表头/跨保存重开/unknown禁用）；EMU宽度按半EMU误差验收并修输入显示/等价比较，避免不改值blur记历史。新增reorder11项与严格lint通过，root接线与原生helper待新候选整体验收；完整types首轮4项mixed类型错误保留，已修正为显式text-style键映射，复验待收。

完整types复验和root strict lint均exit0；style/overlay20项、track焦点8项通过。行拖动与重排各5项helper回归通过，已通过独立advanced workflow沿同一真实文件接到原生入口，不继续堆叠主fixture。新候选3将只同步Presentation、五语言workspace、原生helper和本轮文档，候选1/2不改写。退出仍要求标准GUI、完整Presentation、types/contracts及真实Electron保存/历史/重开、源与产物零漂移；helper或Gate A不算该终态。根协议导出已由并行owner恢复，正常resume4已启动，不改原失败状态或期限。

### 候选3、真实布局缺陷与后续边界（2026-10-18，active）

候选3 `.lime/validation/presentation-table-advanced-1.160.0-20261018-3` 经候选2全11219源零漂移核验后APFS clone，窄同步55份文件，声明源11251份；完整types/contracts与标准GUI wrapper1通过。根首次全集453/454在invalid-options进程测试原5000ms超时，未改期限；候选3完整29套454/454随后通过。根正常resume4已exit0并完成136批，续跑不是源码摘要缓存，之后新theme/对象集合改动仍须定向复验；原默认verify:local整轮仍未完成。

高级原生1在键盘列轨焦点等待处失败：窄窗编辑控件持续增高，把画布挤到底部。修复产品控件滚动与40%高度上限，为画布保留操作区域；不隐藏控件或用fixture强制focus。仅控件与实际pointer hit guard两份源同步，标准wrapper2通过。原生2在root新增的未公开driver.scroll调用处失败，回到既有visible API，实际hit guard保留。两轮均console/page错误0、Main正常code0/signalnull、forcedCleanup null；失败不算高级验收。后续独立输入清单与失败原件由 `presentation-table-advanced-integration-20261018-1/` 保留，候选1/2不动。

独立custom格式场景5项与新场景组合合同6项通过，提供`--presentation-table-format`，不混入原2×3基础/高级源稿。启动选项提到单一`document-preview-options`，主fixture降为751行。颜色fill只证明Playwright input/change，不声明OS原生picker。主题override与lnRef dash显示适配在根另一切片继续，候选3不包含；无override且无需展开仍复用原model，派生theme/style只服务本次render，不修改原包或共享model。

新[分组合同](../research/codex-desktop-rea/presentation-group-contract.json)以同ASAR24段/36条有界搜索纠正旧计划：group/ungroup producer未确认，枚举不证明支持，保持unknown待原版行为证据；不再把完整group列为已确认的上游待实现能力。确认的下一刀为`selectedElementIds/primarySelectedElementId`、框选和批量move/resize/rotate，以及canonical caret/run范围和富文本metadata保留。对象集合helper独立认领，root原包新增可选degree rotation及8项真实原包/投影回归通过；这些后续字节均不扩大候选3。所有Office功能、完整设置/Profile与整个GUI仍partial。

### 原生4终态与当前独立写集（2026-10-18，active）

候选3原生4实际exit1：advanced十四阶段与row-resize五阶段（含跨保存Undo/Redo、原生pointercancel和同路径重开）已有独立原件，但reorder首个AltRight后的saved等待15000ms失败。console/page错误0，Main19612正常code0/signalnull，forcedCleanup null；不计高级整体验收通过。失败原件位于候选3自身QC同run目录，未覆盖前三轮失败。源码显示reorder update使用禁止busy的current值隐藏全部grip，自动保存会使已聚焦grip隐藏/失焦；窄修分离显示快照与动作守卫，保存/投影时保持显示、仍拒绝新动作。新增真实Controller保存锁回归，与helper共17/17；candidate全11251源先核零漂移再同步3文件及诊断，声明在candidate-3-sources-reorder-input.json。标准wrapper3进行中，须原生重验后再确认根因关闭。

对象集合Controller/overlay接线由既有edit-scope worker认领，root避让其写集；state直接迁移selectedElementIds/primarySelectedElementId，不保留单ID别名。root认领reorder busy焦点/后续state guard迁移、五语言新增11键（合计55项）、原生脚本及候选冻结/证据。builtin 74定义owner完成150/150公开root renderer逐格parity与许可/来源，package worker认领Style/BorderStyle/Theme/Document及小型StyleDefinition进行同一fallback接线，custom优先、无theme/unknown明确unavailable；不得扩大候选3。rich worker仅认领共享TextRange新owner/TextPackage与定向原包测试，先保相邻run/paragraph/list/link metadata与Unicode范围，不修改Controller/overlay或宣称完整GUI富文本。其余Plugin/Cloud/Rust/协议/发布继续避让。

原生5新增精确失败诊断：文本矩阵、已保存source SHA、整列选区及pressed grip全部正确，唯activeReorder=null。原busy显示修复不足以覆盖SlideView在passive cleanup前replaceChildren的时序；候选3旧state hook窄补同步Controller订阅，在projection/save/document替换前保存mount内active key，且不覆盖显式destination，不在普通cell selection更新时抢焦点。全11251源在补丁前核零漂移，独立native-focus-capture-sync及candidate-3-sources-focus-input记录。focus-capture-candidate-3.log文件命名误用于root cwd，实际是root当时24/24，不计候选；正确candidate cwd重跑focus-capture-candidate-3-2.log同24/24。wrapper4进行中。五轮Main均正常退出、错误/mock守卫不放宽，失败证据保留。

原包对象层级已实现四种已确认direction，完整spTree绘制节点移动保留全部原节点；边界no-op原bytes不重写。presentationEdits遇zOrder先flush，避免连续相对动作被Map合并。旋转8项+层级11项共19/19通过；Controller及单选控件由同一集合接线owner承接，五语言新增四键。原包新增能力不扩大候选3验收。

原生6最终exit0：`presentation-table-advanced-native-20261018-6`的三段advanced/rowResize/reorder均完成，161真实IPC、console/page/trace/mock错误0，Main91505正常code0/signalnull、forcedCleanup null。row/reorder重开截图已人工复核。最终全集并行复验455项中446通过/9失败：7项原5000ms超时，StyleControls随后2项DOM未就绪错误，均保留原日志，不伪绿或改期限；已同源码maxWorkers=1复验，完整types也在收终态，暂未冻结最终收据。此前root新接口/非候选改动不混入该候选。

共享富文本原包owner新49项与既有Package66/Table46通过、严格TS/Lint/格式通过。root将table cell替换/清空直接迁到同一replaceText→TextRange adapter，删除旧mixed-format拒绝包装层，旧负向断言改为相邻异格式run XML逐字保留；此处为后续root字节，既有161项worker收据不自动覆盖该接线。HTML paste、GUI caret/run/fragment仍待实现与原生验证。

候选3最终冻结：原期限maxWorkers=1串行455/455（29套）、完整types exit0、contracts exit0、标准wrapper4与原生6 exit0。11251份全声明源/1051份regular产物及prepared sidecar前后/终态零漂移；14+5+7阶段、161 IPC、全部错误/mock0、Main91505正常退出。双份独立收据 `.lime/qc/professional-files/presentation-table-advanced-final-20261018-1/receipt.json` SHA `98fded23d03412c5793e8a91d15b0c9191dad1f4cc119cff7c52f70eb64c778f`。本候选此后不再改写；theme/builtin/format、集合/z-order/rich root后续字节全部排除，整体GUI仍partial。

2026-10-18 接续：candidate4 `.lime/validation/presentation-table-format-1.160.0-20261018-4` 从零漂移candidate3 APFS克隆并精确同步29文件（11269声明源），types/contracts/标准GUI exit0，32套716/716。独立 custom native1失败原件保留：原包和输入3.25正确，Chromium computed=3。真实Electron hidden probe另证DPR1/2的设备像素量化；原包、inline声明值和computed须分别核验，禁止扩大容差或省略显示校验。Main正常code0、无强清理，产品场景仍未通过。根入口抽出presentation场景调度，独立builtin与elements选项/冲突组合30项Vitest通过、elements另6项Node通过；误投Node suite到Vitest的旧失败保留。

对象集合独立源码19文件111项、strictTS/Lint/格式通过，连同rotation/z-order、reorder新state消费者及原生入口共35文件已在 `.lime/qc/professional-files/presentation-elements-integration-20261018-1/frozen-source` 按摘要冻结，后续候选从此窄源拷贝；root后续rich不得混入。框选SAT属于明确Lime策略，group/ungroup仍unknown。

当前rich接线写集：原始OPC source WeakMap（key=model，snapshot浅拷贝共享来源）、单一TextRange/Selection/Style/Html、TextEditPackage、`presentationTextController` 和 `presentationTextEditor`，委托同一Controller有序日志/冲突保存；无renderer private import或第二业务read model。root首轮真实既有回归46/48：跨cell在途投影与merged continuation入口失败，已修为owned draft可在前一投影中继续输入、target归一到anchor，待复验；首轮完整TS报writer namespace null，交原owner窄修。旧textarea组件断言同步迁受控contenteditable，测试期限与mock/identity守卫不变。架构由root确认同步新owner图，完成度仍partial。

### custom格式候选4冻结与对象候选5（2026-10-18）

候选4最终custom native3通过16个保存阶段、124 IPC，console/page/trace/mock错误0，Main44055正常code0/signalnull、forcedCleanup null、freshness前后ready。11272声明源与1162 regular产物/实际prepared sidecar SHA `8cd0ca612be4fb13a5ab8098261222640cc6e953f4785a930a76aa86a13f5b98`终态零漂移。716/716、最终边框17/17、完整types/contracts和标准GUI通过，重开截图人工复核。双份收据 `presentation-table-format-final-20261018-1/receipt.json` SHA `dc1ff140edcff54136ae5136cc20ffe68ca27c7ef6620b1b028777a87c03788b`。native1失败是Chromium设备像素量化差异，独立真实Electron DPR1/2的240观测验证；native2开始后才同步正确guard，明确排除，native3是唯一最终原生证据。原包EMU/inline声明/computed分别严格核验，不增加容差。

对象/builtin候选5 `.lime/validation/presentation-elements-1.160.0-20261018-5`已从候选4零漂移基线APFS clone，精确同步35份预先冻结源，builtin使用已验证边框helper修正版，provenance只补该必要依赖。11288声明源，未混入root富文本或并行Plugin/Cloud/Rust/协议/发布字节。完整types/contracts及Presentation全集进行中，随后标准GUI与两个独立原生场景顺序运行。

root富文本已有同一Controller/有序text action、原始OPC body/relationships、canonical paragraph/run/char选区、HTML/plain clipboard、受控contenteditable与表格anchor接线。48项既有Controller/Panel/table-overlay回归通过，新增canonical保存/撤销测试补强真实undo保存再redo保存；既有内部slide跳转仅保留，不新增创建能力。8份旧原生场景已迁current DOM并保留原期限/零写/IPC合同，29既有+13新helper回归通过，源码收据 `/tmp/lime-presentation-rich-dom-20261018-source-receipt.json` SHA `57d15dda82cf219a8ac84130f116ab56a615ec19fd758c2f0ec25cd78b6cab62`。本地草稿undo/redo与DOM层补充验证仍在进行，尚无rich产品Gate B。

## 对象候选5与富文本接线继续验收（2026-10-18）

候选5原生2、3在全选20格前失败，未放宽15秒等待或Main正常退出期限。组件红例证明对象焦点未被cell接管的可达路径，current hook最小修复并通过根5套63项；同步旧rich前候选后其5套56项通过。原生3仍失败，随后4/5新增只读frame activeElement、elementFromPoint和几何原件，确认该源稿双向翻转、首格40px、25%缩放时格中心被se缩放手柄覆盖；它才是这些原生点击失败的直接原因，不能把组件可达焦点路径当成该次点击已命中cell的证明。

原生点击驱动现在在同一目标内部选取经真实浏览器elementFromPoint确认可达的位置，完全遮挡则在发任何CDP输入前失败；不调用DOM click/focus、不隐藏手柄或改断言。新增4项遮挡边界单测通过。原生6实际activeElement已为cell0:0，选区20成功；之后旧fixture错误地要求工具栏显示无限精度4/3，而current UI明确显示3位小数，已改为严格等于字符串1.333。原包12700EMU、inline4/3和Chromium computed量化继续分别严格验收，不新增容差。原生7正在按独立新run验保存/撤销/重做/重开，失败1–6原件均保留且不计通过。

富文本候选6窄输入53文件已冻结：35份Presentation源码/测试差异、8份旧场景DOM迁移、2份DOM helper/test、5份共享入口与3份rich场景。精确剥离根Workbook clipboard增量，没有混入并行后台或设置代码；清单位于`.lime/qc/professional-files/presentation-rich-integration-20261018-1/planned-source-sync.json`，SHA2231080b97672bc545633622a115cae4fad4c214daeab54b063201dce5bd812f。该清单尚未构建/运行候选，不构成产品验收。段落增量收据SHA108b39b21113650a2ef6dcbff36df4ca255d8873dbc295dbf151e11320bca37d；独立rich native paragraph helper收据SHAc3076c40b13771757002c1a2722c248c9bfe6d0e3b82abdeb769e5ea4b038b15。

根完整Presentation/Workbook50套首次1081项中1080通过、1项旧mixed-run清空拒绝断言失败，并有worker onTaskUpdate超时；不结算整轮通过。拒绝断言已经迁移为新能力的保真回归：新行空正文、原行全部XML与非目标ZIP原字节保持，独立47/47通过且纳入53份输入。根完整types和两领域strict lint通过；rich/Workbook原包helper23/23通过，DOM/options44/44通过。首次误以Node runner运行Vitest DOM测试失败原日志保留，已按真实runner分别重跑，未修改测试跳过条件。最终GUI与所有真实原生证据仍按候选独立结算。

### builtin原生7退出阻塞诊断（2026-10-18）

原生7 `presentation-table-builtin-native-20261018-7` 已完成全部14个保存/撤销/重做/重开阶段、116真实IPC，console/page/trace/mock错误0，来源/产物/freshness检查通过；但Main45318在before-quit/will-quit/quit后未于15秒内真实退出，失败清理SIGKILL，整体exit1，绝不结算通过。quit时0窗口和2 PipeWrap仅为观察，尚不能归因于产品host或Playwright连接。独立最小启动诊断Main74658通过同一public app.close约0.7秒正常code0/signalnull；不覆盖完整业务场景。候选11289份声明源已再次全量核零漂移，原生8带Playwright协议/浏览器日志重验，复现时采集真实Main栈，保持所有既有期限与守卫。

原生8 `presentation-table-builtin-native-20261018-8` 同一源码完整通过14阶段，Main79452约3.7秒正常code0/signalnull，无强制清理；原生7超时尚未复现，未伪造根因关闭或改生产退出逻辑。对象原生1已通过框选/批量变换/真实pointercancel/跨保存历史，随后单对象层级前超时；current点击已选对象是保留集合并启动集合拖动，旧fixture直接点击集合成员却期待单选。窄改fixture先原生Escape清空，再真实命中目标并验证单选、650ms零写；timeout保留expected/actual DOM。helper6/6通过，11289份声明源先核全量零漂移后只同步该helper，清单更新为candidate-5-sources-element-selection-input.json。对象原生2新run进行，原生1失败保留。无产品源码或期限/门禁改变。

对象原生3 `presentation-elements-native-20261018-3` 已完整通过17阶段、90真实IPC，批量移动/缩放/旋转、原生touch pointercancel、跨保存Undo/Redo、四层级方向与独立重开均严格保持原ZIP/对象内容。console/page/trace/mock错误0、Main19978正常code0/signalnull，正常退出14.25秒仍在原15秒门禁内，未延长期限或强制清理。重开截图已人工复核。原生2所有对象功能通过但same-path app-scope Controller仍editing=true，与旧fixture期望不符；fixture现先GUI结束干净编辑并验650ms零写，再从独立文件标签真实读取，原期望editing=false和SHA/几何/绘制顺序不改。当前最终11289声明源为candidate-5-sources-element-reopen-input.json；builtin9按该最终同源再验，不以旧helper字节的builtin8代替终态。

候选5最终冻结（2026-10-18）：11289份声明源/1384份regular产物及prepared sidecar终态零漂移；35套790项、焦点56项、helper18项、types/contracts/标准GUI通过。builtin9的14阶段/118 IPC与objects3的17阶段/90 IPC均错误/mock0、Main正常code0/signalnull、无强制清理，两张重开截图已人工复核。双份收据 `.lime/qc/professional-files/presentation-elements-final-20261018-1/receipt.json` SHA `b814cf3479dd6e6e3ba1db70a91d002358082e707b07a5c6d7486636dd05ebb0`。旧失败全部保留，builtin7退出超时未定位原因，不据新通过声称修复；富文本及后继字节不属于本冻结候选。

## 富文本候选6原生回归（2026-10-18）

候选6从最终候选5复制并仅接53份冻结输入，11317份声明源。初始40套Presentation987项、rich原包helper11项、DOM/options38项、旧DOM迁移helper25项（Vitest）、完整types/contracts与标准GUI通过。旧helper最初误投Node runner导致5套加载失败，原日志保留；正确Vitest25/25没有修改测试、期限或skip。

真实presentation-rich-native-20261018-1已验证段落CSS/原生选区、中文emoji范围样式、原生按词/按行删除、Enter/ShiftEnter、草稿零写和shape保存Undo/Redo；随后cell HTML粘贴文字正确但原包粗体断言失败，整体exit1。Main15284正常code0/signalnull、forcedCleanup null，不把失败场景算通过。独立真实Electron剪贴板诊断只保存自有fixture，确认macOS在HTML前附加UTF-8 meta标记；原preflight因此拒绝HTML并plain fallback，styles/list/link丢失。

同一presentationTextHtml owner窄修接纳精确惰性UTF-8编码标记，其他meta/资源仍在HTML解析前拒绝。首个移除标记补丁经复核发现会词法拼接相邻文本，新增红例后改为原HTML逐字进入DOMParser、精确meta/head后检，不进行删除或重拼。进一步复现原有异常注释结束点可绕过预扫描；只接受规范注释子集并补4个解析前拒绝反例、1个规范剪贴板片段正例。三个阶段红例日志均保留；最终根/候选3套76/76，strict lint通过。最终两源SHA与全声明源记录在candidate-6-sources-clipboard-comment-input.json，不改原53份冻结清单或先前失败原件。

重建标准GUI后，独立rich2及原8个DOM场景的风险匹配真实回归串行执行：基础editing/flush、navigation、table base/advanced/row resize/reorder、table structure。最终来源/产物/sidecar/freshness、canonical identity、零mock与Main正常15秒退出全部通过才冻结；当前尚未取得最终富文本收据。

### 表格正文验收修正与尺寸诊断（2026-10-18）

`presentation-rich-legacy-advanced-20261018-1` 在基础表格首格保存后失败：原正文的 body/list/paragraph 内容与属性完全一致，canonical writer 只补齐合法 `xmlns` 闭包，旧 XMLSerializer 原文摘要误判。新增正例先复现失败，再将目标正文摘要改为展开后的 namespaceURI/localName、非 xmlns 属性及全部子节点内容；未编辑格的原 XML、格网/几何与非目标 ZIP 摘要不变。正文、段落、列表属性和实际 namespace 变化负例均拒绝，候选5套26/26、strict lint/格式通过。两文件窄同步与11317份完整声明源核验记录在 `table-oracle-sync.json`，不改产品 XML。

`presentation-rich-legacy-editing-20261018-3` 在适合宽度的原15000ms等待失败，Main正常退出、无强制清理与控制台错误。随后只增加公开DOM被动尺寸记录，不改变点击、期限和原有放大>1.2/fit差<2断言；editing4/5/6/7连续通过，记录均为237→296.25→237。navigation3复现并证实初始基线取在展开动画中途（panel/slide 221px），放大及fit时最终panel已237px，fit正确返回237px却与错误基线比较。现仅在取基线前等待相关有限动画结束、两个真实RAF几何稳定及初始fit尺寸一致，仍使用原15000ms期限和原zoom/fit精度；不修改DOM或完成动画，失败原件保留。

advanced2在当前Controller已保留table7选区时重复点击整表，被cell/handle overlay覆盖，真实hit守卫正确拒绝；之后Main也发生15秒正常退出超时，整体失败保留。四个旧场景入口现复用可见current选区，否则仍真实命中整表；所有后续cell/grip输入不变。advanced3/4完整26阶段通过且Main正常退出，未声称已修复偶发退出超时。

最终runner6的structure4第一步插行真实保存通过（6个原cell、11个非目标ZIP保真），第二次点击0:0后选区仍1:1，原等待超时；Main正常退出。失败时panel宽317px，尚不能据此归因。为区分布局移动和产品选区处理，窄写集仅增加frame driver的可选只读诊断和structure调用方：记录原始CDP输入坐标、每个输入前的父层iframe/内层目标命中及前后可见选区，不重试点击、不改变输入或期限。helper两套10/10、strict lint通过，11317份声明源窄同步前后零漂移；最新输入 `candidate-6-sources-table-dispatch-diagnostic-input.json`，新runner7从structure5继续，候选6仍未冻结。

Main退出独立只读调查见 `.lime/qc/electron-main-exit/teardown-static-20261018-1/report.md`（SHA `77691b48149df0f9ad2394c8c652eb9cfd457bbaa97df2fb024bd10ff157e521`）：8项检查、24输入零漂移。正常与失败都有quit、零窗口和两个PipeWrap，不能据此归因；捕获监听随后实际收到SIGKILL，也不支持监听丢失结论。真实复发时沿已有pw:browser及before-quit后8秒owned PID被动sample取证，保持原15秒门禁，未修改产品退出逻辑。
