# Codex Desktop 与 Lime GUI 全面对齐

状态：active / partial。更新：2026-10-18。主目标是完整实现，单个切片通过不能关闭整体差距。

## 目标与事实源

使用 REA 对齐可确认的 GUI、交互、目录职责、函数、类型、类与调用链；直接迁移或删除旧代码、文档、测试、fixture、snapshot 和冲突护栏。仅保留主题、多模型、首页 Banner，分别继续由 token/skin、catalog/provider 和 Home presentation 持有。

- 参考 `/Applications/ChatGPT.app` 实际为 Codex Desktop，Bundle ID `com.openai.codex`，版本 `26.1007.30912`、build `20156`；ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- REA 6.4.0，独立 Node 24.21.0。复用匹配 Evidence，不将静态代码写成运行结果，不将压缩变量写成原始源码符号。
- Runtime/协议参考 `/Users/coso/Documents/dev/rust/codex`，已核 HEAD `31434401fa3cd111866acdc1bba2a73b561f53d5`。公开仓库没有 Desktop 前端；附带 CLI `0.162.0-alpha.17.2` 与该 HEAD 的精确构建等价 unknown。
- 唯一业务链为 `Product Surface -> App Server JSON-RPC -> RuntimeCore -> Thread/Turn/Item projection`；Desktop 与 CLI/TUI 共享协议、runtime、持久化和工具 owner。

设计和质量规则见 [design-language](../aiprompts/design-language.md)、[quality-workflow](../aiprompts/quality-workflow.md)；研究与命名映射见 [report](../research/codex-desktop-rea/report.md)、[结构账本](../research/codex-desktop-rea/structure-alignment-ledger.md)、[Evidence 索引](../research/codex-desktop-rea/evidence-index.json)。`lime-design-language` 与 `lime-quality-workflow` 已按当前目标更新，规则完成不代表产品完成。

本页只维护活动状态与领域导航。逐轮过程保留在 [早期历史](codex-gui-alignment-history-20261015.md) 和 [2026-10-17 历史快照](codex-gui-alignment-history-20261017.md)，不再并列维护历史“下一刀”。用户曾清理 `.lime/`；缺失原件不能恢复为有效证据，后续冻结件独立绑定来源。

## 当前阶段与写集

主线为专业文件编辑与保存，PPTX基础cell与行列结构候选1/2已分别冻结新原生收据；候选2全Presentation与helper 292项、types/contracts/标准GUI及13阶段真实Electron通过。当前推进高级表格合并/移动/均分、单轨键盘/指针与边框选项，仍沿同一历史/保存链；高级候选3已冻结：455/455、完整types/contracts、标准wrapper4、真实native6的26阶段通过；11251声明源/1051 regular产物零漂移，收据SHA `98fded23d03412c5793e8a91d15b0c9191dad1f4cc119cff7c52f70eb64c778f`。候选4已独立冻结：716/716、最终边框17/17、types/contracts及标准GUI通过；custom native3的16阶段、124 IPC、错误/mock0、Main正常退出，11272声明源/1162 regular产物终态零漂移。收据 `presentation-table-format-final-20261018-1/receipt.json` SHA `dc1ff140edcff54136ae5136cc20ffe68ca27c7ef6620b1b028777a87c03788b`。native1/2失败保留；真实Electron DPR量化同时严格核验声明与computed，不放宽精度。多选集合111项通过并独立冻结35份对象/验收入口源，下一独立候选不混rich。富文本OPC来源、范围样式及HTML codec已各自定向验证，唯一协调模块/受控DOM正在接线，未宣称GUI通过。XLSX、CSV/TSV、PPTX基础编辑曾有固定候选验收，结构与导航第三轮也曾观察到正常通过；随后整个 `.lime/` 消失，所有旧原件当前missing，均须新候选重验。代码仍在，历史结果不能替代当前源码证据。

root 写集：`artifact/presentation/`、Workspace 批注 flush 的最小接线、五语言 workspace 文案、Presentation 原生 helper 与既有 document fixture 接线、对应测试/架构/领域计划。独立 worker 的包编辑和静态 caller 问题限定在各自认领文件；不覆盖其他改动。

生命周期扩展的Workbench Layout/DocumentState、外层关闭/收起、Toolbar与共享文件动作继续委托已有格式Controller。协议`--check`只读修复已在源码，旧wrapper3与结构原生3的通过原件随后丢失。新门禁使用新声明源与产物身份，不恢复旧时间戳、清单或收据。具体失败与缺失状态由Presentation计划及[生命周期声明](../research/codex-desktop-rea/validation-evidence-lifecycle-20261018.json)持有。

避让 Plugin、Cloud、Rust、协议/生成客户端及 release 并行生产写集。固定候选通过不能推广为最新根通过。根正常前端resume4已完成136批并exit0；它不按源码摘要失效旧通过批次，之后新增字节仍须定向验证。最近表格阶段`verify:local`曾在protocol测试期限失败，原期限定向6/6后正常续跑；尚无最新根默认门禁整轮通过。更早根默认 `verify:local` 第12轮已 exit101：前端133/133批与contracts阶段通过，App Server lib 1941通过/5失败，后续GUI未执行。五项使用原编译binary串行定向复验5/5通过（44.09秒），未修改期限；该结果不替代原默认门禁。此前暂停的rustc43554已核身份并SIGCONT恢复，原进程完成，无遗留挂起责任。日志和resume收据由Presentation计划归档。

PPTX 详细合同、失败和退出条件唯一由 [Presentation 计划](codex-presentation-alignment.md) 持有；跨格式只维护 [专业文件计划](codex-professional-files-alignment.md)，工作簿来源纠正只维护 [工作簿计划](codex-workbook-alignment.md)。

## 已采用能力与证据边界

| 范围                     | current owner 与状态                                                                                         | 仍开放的范围                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 设计/质量 skills         | 已更新保留差异、结构命名和门禁规则                                                                           | 产品全面对齐另验                                            |
| 历史与正文               | threadVirtualizer、VirtualizedTurnList、canonical正文                                                        | 全变体视觉与平台证据                                        |
| 审批与队列               | PendingRequestItemPanel、ApprovalCard、QueuedMessageList                                                     | 自动审查与全部审批变体                                      |
| Files/diff/右侧面        | ReviewThreadSidePanelTab、ChangesPanel、RightSurfaceHost                                                     | 其他 editor/surface 的完整行为                              |
| Composer/草稿/新建       | Controller、NodeView、Coordinator、Host Store/File；前一切片固定身份验收                                     | 完整符号、OS输入和平台证据                                  |
| 设置导航与草稿           | canonical sections/path、统一draft与字段保存；Memory、Search、Provider、Environment、Policy、Profile局部验收 | 其余草稿 owner、整页结构/布局/行为                          |
| 设置内容搜索             | 同一settingsSearchDocuments与导航owner，36目标已有历史验收；Developer/Media新增11目标已实现并定向验证        | 累计47目标的后继真实桌面验收、其余current设置内容与保稿场景 |
| Profile                  | 本地内容/布局与认证入口分离                                                                                  | 公共GET/PATCH、eligibility、username/pins/upload等真实合同  |
| PDF/DOCX/Workbook/Slides | 原字节预览、统一批注/批次、应用scope草稿与回原文分别验收                                                     | DOCX/PDF正文编辑入口待证；PPTX编辑继续实现                  |
| Workbook编辑             | XLSX普通单元格、CSV/TSV保存与重开、冲突、flush有固定候选证据                                                 | 完整Excel编辑/公式/样式/图表等范围                          |
| Thread settings          | scoped EventBus/adapter/既有cache，idle model/cwd局部验收                                                    | active/future Turn执行语义                                  |

专业文件历史收据（下列原件均已missing，保留原摘要仅供追溯）：

- XLSX及三格式共享回归：`.lime/qc/professional-files/workbook-edit-final-20261017-2/receipt.json`，SHA `176685cd012fb03445b17a66d3506030950f1002ca0745d3917989ace05860e7`。
- CSV/TSV同源prepared sidecar候选6：`.lime/qc/professional-files/workbook-delimited-final-20261017-1/receipt.json`，SHA `c0995d82c06c613c627b6db03e86c901e34a245e384c49e0718a6c685b00dd45`。混用根debug的旧两轮仅诊断，具体来源纠正见工作簿计划。
- PPTX基础编辑：候选 `.lime/validation/presentation-edit-1.160.0-20261017-1` 的标准wrapper4和完整原生3通过；8670声明源/2233 regular产物零漂移、173 IPC、错误/mock 0、Main正常退出。双份收据 `.lime/qc/professional-files/presentation-edit-final-20261018-1/receipt.json`，SHA `35a781088939c351c8a2b7a00c81dda80699b019d3168331b604fdf536525d2f`。指针及旧重载选区测试的前两次失败均保留。根幻灯片结构操作、500ms自动保存和文件动作/导航flush扩展另建候选，不能扩大该收据。

旧收据当前无法从本地原件复核，以下摘要不构成当前产品验收。新恢复的表格静态合同和codec测试独立绑定新原件，不恢复这些历史收据。更早逐轮收据、失败与证据缺失声明保留在历史和领域计划。

## 共同验证合同与退出条件

风险按领域选择，PPTX当前为P1、非live。不得放宽正常Main退出15秒期限、freshness、来源/产物摘要、身份和零mock守卫，不skip、不滤错、不手改续跑状态。

1. 参考模块/可确认符号 → 唯一current owner → 状态/输入输出 → 调用者/删除项 → 测试与Evidence必须可追溯。
2. 定向行为覆盖成功、失败保稿、在途/迟到响应、scope/revision/readiness及真实卸载恢复；五语言、键盘/IME和焦点同验。
3. GUI主路径执行标准 `verify:gui-smoke`；Gate B包含真实Electron/preload/IPC、`app_server_handle_json_lines`、current JSON-RPC、同一canonical Thread/Turn/Item和用户可见状态。
4. 最终证据核对声明源、regular产物、prepared sidecar与前后freshness；正常Main code0/signalnull，强制回收只能发生在失败清理且不得算通过。
5. 固定候选与最新根分开结算；真实fixture使用受控external backend时明示绕过production provider，不冒称live、Windows或安装包。
6. 架构/owner变更同步架构图与责任开发者确认；旧实现/文档/正向测试与冲突护栏一起迁移，不能为旧snapshot恢复双轨。

## 分类、未完成范围与下一刀

current：表中唯一owner及本轮Presentation扩展。compat：仅现存已登记委托，不扩张。deprecated/dead：已被替代的组件、别名、第二份草稿状态及旧正向fixture直接迁出；精确删除清单由领域计划与结构账本持有，新能力不得恢复旧runtime。

下一刀验收对象/builtin候选5（初始11288声明源、35份冻结窄同步；新增命中测试后11289声明源）：独立builtin、多选/框选、批量变换与对象层级。builtin 原生1因独立源稿遗漏 Broken.pptx 失败；原生2/3全选失败后，组件红例证明cell未接管对象焦点的可达缺陷，修复后根63项/候选56项通过。原生4/5的实际命中原件进一步证明这些run点击格中心时命中了遮挡的se缩放手柄（双翻转、40px首格、25%缩放），并非已点击cell；原生驱动增加同一目标内部命中检测和4项回归，未使用DOM click/focus。原生6已真实cell焦点/20格全选，之后严格区分工具栏三位显示1.333与原包12700EMU/renderer4/3，修正旧无限精度显示断言。原生7已完成14阶段/116 IPC且功能错误0，但Main正常退出15秒超时，失败清理SIGKILL，整体exit1；原生8同源14阶段通过、Main正常退出但不伪称已定位7的根因；对象原生3的17阶段/90 IPC已通过，builtin9最终14阶段/118 IPC通过，候选5已冻结11289源/1384产物，收据SHA b814cf3479dd6e6e3ba1db70a91d002358082e707b07a5c6d7486636dd05ebb0；后继rich候选6开始集成。失败原件全部保留，不放宽期限；焦点补丁后的标准GUI已通过。富文本 canonical 范围、局部草稿撤销/重做、内部链接保留和工具栏焦点已接同一 Controller，83项段落/DOM相关回归通过；旧 textarea 原生调用已迁移，真实 Chromium 列表、行距与 OS 删除待独立候选。Workbook 纯文本矩形剪贴板94项本地回归与12项原包helper通过，五语言及独立三格式入口已接，原生待验。group/ungroup producer尚未确认，保持unknown，不把GROUP枚举当可编辑证据。独立前端切片MCP草稿保护44项、Media blur/commit草稿保护37项、Queue拖拽/方向键重排65项已交付冻结收据，Experimental草稿35项及独立静态锚点补充36项已冻结；Developer/Media静态搜索继续实施。以上均为局部renderer证据，真实设置/queue fixture待独立候选集成，不扩大为桌面通过，窄缺口列表见`internal/research/codex-desktop-rea/gui-remaining-implementation-20261018.md`。随后回到其余设置内容/布局、公共Profile、未映射GUI/原生应用入口和结构符号。协议/认证缺口交回持有真实owner的并行工作，不造API、本地身份fallback或假可用flag。

整体仍partial；尚缺完整产品分母，不给伪整体百分比。专业文件预览、某批搜索目标、组件测试或规则全部通过均不等于整个GUI完成。参考运行、OS IME/mic/主题事件、全skin、完整production/live、Windows/安装包及进程重启耐久性只能由各自真实证据关闭。

## 2026-10-18 接续：富文本与后继集成

候选6 `.lime/validation/presentation-rich-1.160.0-20261018-6` 从最终零漂移候选5复制，只叠加53份冻结富文本输入；11317份声明源，输入清单SHA `10a5f92b89a0fc8a30dc26d0aac91e607810d824efddf64270518d3989c245c7`。完整类型与contracts通过，Presentation40套987项、富文本原生helper11项、DOM/options38项通过；标准GUI与真实富文本原生尚在执行，未冻结产品收据。旧8场景的textarea驱动已迁入同一contenteditable helper，需风险匹配的真实回归。

Workbook后继只接18份已冻结输入；设置/Queue后继由独立overlay准备，不把根并行Plugin/Cloud/Rust/协议字节混入。设置草稿原生脚本已冻结47项通过，收据 `.lime/qc/settings/draft-native-20261018-1/implementation-receipt.json` SHA `313242427e2dd4ce97a23eb5a38ec987adf3d351da1199e62ca9a94103808bee`；这是脚本验证，Developer/MCP真实进程仍待执行。

公共Profile只读复核已确认共享account认证和cloud/request的静态主链，但后者仅GET/POST/PUT/DELETE的当前tenant/client JSON transport。公共page GET/PATCH、eligibility、is_self/can_edit/preview、username/pins/upload仍缺同义业务合同；会话username/avatarUrl与本地nickname/bio不能关闭这些差距。独立报告 `.lime/qc/gui-remaining/public-profile-contract-audit-20261018-1/report.md`，收据SHA `ec8fd0bdbe521b0bf5ab5fc70ab13054c9a9facd3139492e90da038f6fac802d`。现行鉴权请求owner为oemCloudControlPlaneRuntime→cloud，未恢复不存在的cloudAccountRequests.ts包装。
