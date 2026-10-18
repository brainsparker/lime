# 工作表与 Codex Desktop 对齐


当前证据状态（2026-10-18）：整个旧 `.lime/` 已消失，本页所列旧本地收据、候选、截图、清单和日志原件均为missing。下文通过结果仅保留历史观察，不能继续视为可复核或有效的当前验收。源码仍在；新候选与重验由 [Presentation计划](codex-presentation-alignment.md) 跟踪，缺失声明见 `internal/research/codex-desktop-rea/validation-evidence-lifecycle-20261018.json`。

状态：只读、范围反馈及XLSX普通单元格编辑/保存已原生验收；CSV/TSV原生保存已验收，全仓门禁接续中；负责人 root；2026-10-17。主目标见 [GUI current 计划](codex-gui-alignment-current-plan.md)，专业文件总进度见 [专业文件计划](codex-professional-files-alignment.md)。仅保留 Lime 主题、多模型和首页 Banner。

## 事实源与边界

复用同一 Codex Desktop 26.1007.30912/build20156，ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。`WorkbookPanel` 公开名、bytes/format 成对输入、import/frame/worker readiness、默认只读与销毁 drain 的静态合同来自 REA parent `ev_e43b4b7ce0e35465a48ce864b3da1b7c8d892cb8955c0fc33431e3d2195215dd`；721564 字节实现摘要 `fff4db5c2d594b7bcaec3569f6ab335d2fd0b982a891109c5a053210ef30a6e9`，28165 semantic unknowns、partial/truncated。未运行参考；内部压缩类名不恢复为猜测别名。

工作表沿同一文件树/会话 artifact、原字节 gateway、App Server `fs/readFile` 与统一右侧面。Renderer 只负责解码后的工作表、选择、滚动和呈现；不建立第二业务后端或文件历史。范围反馈必须使用 sheet/range，不能套用 PDF 的页码/坐标。现有 DocumentAnnotation 不先行改名成无同义的新模型。

## Verification Contract

budget:normal；P1；非 live。第一阶段为 XLSX/CSV/TSV 的真实工作表读取与只读审阅，分开处理后续范围批注、编辑/保存与 roundtrip。首阶段必须显示实际工作表及单元格、页签、行列定位和公式/缓存值，保留可支持的尺寸、合并与样式；明确错误与未支持格式，不以抽取文本或假表格宣称版式完成。公式不求值，链接与文件内容不能执行脚本或发起主动网络请求。

窄写集预期为 `src/components/artifact/workbook/`、现有 previewArtifact/renderer/Canvas 分发及测试、五语言 workspace 文案、既有 Electron 专业文件 fixture 内的工作表场景、本计划/架构/研究账本。解析依赖只在根 manifest/lock 的具体字段更新，保留并行改动；实施前核对这些文件的最新摘要。Rust、App Server 协议、Plugin、发布生产路径及外部仓库继续避让。

验证顺序：有意义的真实 XLSX/CSV 样例与解码/生命周期定向回归；组件页签/位置/键盘/取消/迟到/failure/five-language；类型与严格 lint、contracts/版本和脚本治理；完整标准 GUI wrapper；同源独立候选的真实 Electron 文件树及会话 artifact 双入口、同一 canonical identity、零附加 Turn、零 console/page/trace/mock、源码/产物/freshness 前后稳定与正常 Main 退出。只读预览不冒称编辑保存、范围反馈、live、Windows 或参考运行。

## 退出条件与后续

- [x] 第一阶段：真实工作表解码、只读表格与导航；迁移旧 XLSX 文本优先断言，清理重复分发。
- [x] 对应组件与固定候选真实 Electron 合同通过并冻结；最新根全仓门禁另列。
- [x] sheet/range 位置反馈、单条/整批/失败保稿与应用scope卸载恢复已沿原Composer验收。
- [x] XLSX普通单元格编辑、原包保存/roundtrip、外部变化拒绝、应用scope恢复与批注前flush完成固定候选验收。
- [ ] CSV/TSV保存与完整词法字节比较已通过业务断言；完整原生还需正常Main退出。
- [ ] 最新根默认门禁及current fixture聚合通过；并行变更另按实际身份报告。
- [ ] 完整Excel编辑/公式/高级对象与进程重启耐久性继续按具体合同取证和实现。

## 实施与验证记录（按阶段保留历史）

新增 current `src/components/artifact/workbook/WorkbookPanel.tsx`，公开名称与 REA export 对齐；内部 `WorkbookGrid`、`workbookDocument`、`loadWorkbookDocument`、Worker 和 snapshot/range helper 为 Lime 的职责拆分名，不声称恢复了上游压缩类名。`previewArtifact` 使用 `workbook` content kind/render mode，文件树和会话 artifact 共用同一个 lazy renderer。旧 XLSX 系统打开、抽取文本优先的正向断言已直接替换；时间线原先提前拒绝专业二进制的入口统一进入现有原文件打开函数。新增 compat/deprecated 0。

首阶段实现为只读 XLSX/CSV/TSV，工作表页签、双轴虚拟滚动、A1 定位、键盘、合并、隐藏行列、尺寸、可表达的颜色/字体/边框/数字格式。公式栏显示原式，表格只读缓存结果，独立手写 OOXML 的 `1+1` 缓存为7，测试必须显示7而非计算2。链接、HTML 样字段和公式样 CSV 都只作为文本。图表、图片、透视表、冻结窗格、完整 Excel 主题格式、编辑/计算/保存、批注范围与 roundtrip 尚未实现。

字节读取继续走 `readFileBytes -> fs/readFile`；原字节 SHA 在转移至 Worker 前计算。文件/预览标识/重试变化销毁旧导入，读取中取消不创建 Worker，解析中取消显式结算并终止，迟到结果不覆盖新面板。输入限制为20 MB、20万行、1024列、10万个参与投影单元格；XLSX 解压由依赖完成后检查模型规模，未宣称流式解压内存上限。错误/超限/重试文案覆盖五语言。

依赖固定为 `exceljs@4.4.0`、`ssf@0.11.2`。项目 pnpm9.15.9直接增量解析失败于既有 workspace 的 registry-only `@limecloud/app-server-client@1.71.0` 无发布版本；没有改 workspace manifest 或全局 Corepack。隔离解析新闭包后合入原锁文件，保留12个已有共享 snapshot，隔离 frozen-lockfile 安装已通过；完整根9个workspace的 frozen lock-only 检查也已通过。清单 `.lime/qc/professional-files/workbook-lock-merge-20261017-1.json`。候选只增加精确依赖和声明前端/fixture，不覆盖并行后端，仍为1.159.0基线。

70项解析/生命周期/五语言/真实虚拟滚动与分发测试通过；第一轮2项真实消费者分发失败来自 Canvas 仍缺 workbook 直达分支，修复后原断言全绿。时间线专业文件与 PDF 导航再补23项通过。strict lint 第1轮2项语法/全局类型配置失败，修复后通过；完整类型第1轮发现 ExcelJS cell.row 声明为string，使用Number转换修复，最终类型和标准 GUI wrapper 待验。新原生场景必须证明文件树 XLSX/CSV/TSV、缓存值/样式/远端单元格可见性、损坏后重试、同一 canonical artifact 与零新增 Turn、正常退出；不以组件通过预先写产品完成。

Architecture impact: minor；Responsible developer confirmation: root, 2026-10-17。同一预览 owner 与既有协议，未增加业务后端或持久化事实源；架构图与主计划同步。第一阶段尚未验收，后续范围反馈、编辑保存和全产品 GUI 分母继续开放。

## 原生复核与门禁（接续）

2026-10-17 接续写集：继续完成 sheet/range 反馈。把 PDF/DOCX 已共用的批注草稿、编辑卡、主 Composer accessory、批次 settlement 移到 `artifact/annotations/` 唯一 owner，直接迁移调用者和测试并删除旧路径；页面坐标仍由 document adapter 持有。工作表目标使用 `sheetName/sheetId/address`、原文件 SHA 与格式，禁止伪造 pageNumber。工作表真实 A1 范围选择/Shift 扩选、单条/整批、回原位置、失败保稿、文件变化重新定位沿同一 typed acceptance 验证；不新增 runtime、协议或保存接口。参考为同一 REA parent，补读原成员中 `addCommentThread` 与导航到范围的原字节，不把压缩名当原始符号。架构影响 minor；责任开发者 root 确认：跨格式仅收敛 Renderer 草稿 owner，不改变主链 authority。

工作表原生第5轮失败原因是 fixture 错把 artifact/write 的 canonical fileChange 当只读 file_artifact；第6轮已从真实文件变更入口打开原字节，末尾发现共享 fixture 的“item 完全不变”与主动新增 artifact 冲突。改为严格校验原有 item 顺序/身份保留且只增加本次 event 对应的唯一 item，零新增 Turn/provider 请求继续保留。没有修改 canonical 投影或制造 file.read metadata。

第一轮完整标准 wrapper `standalone-shell-01-20261017094857-12433` exit0，24/24。根完整 Renderer/Node 类型检查第2轮 exit0；`test:resume` 追加第135批，3个新增工作表文件23/23通过，保留原134批历史结果，不将旧通过批次当成最终源码全部重跑。

原生 `workbook-preview-native-20261017-1` 保留 exit1：原文件 A1 黄色填充被工作台全局 `bg-background !important` 规则覆盖为白色。单元格有原文件填充时移除该主题背景类；无填充时继续使用主题。补组件回归，原生颜色断言保持不变。双轴导航同时补 `scrollPaddingStart`，防止返回靠前位置时目标被固定行列标题遮住；这是预防性修正，首轮尚未运行到该几何断言，不能记作已观测根因。Main 正常 code0/signal null 退出，强制清理0。

默认 `verify:local` 首轮在硬编码扫描失败于公式栏 `fx`，已替换为现有公式图标，单文件扫描 findings0。接续本地门禁和新标准 wrapper 运行中；39项 PDF/工作表/预览分发通过。读取 public artifact/write 合同时发现新 fixture 的空 content 不合法，已按现有非空合同修正，保留区别于原文件单元格的显式元数据内容，真实预览仍必须读取原字节；没有改后端合同或降低原验收。

锁文件比较 `.lime/qc/professional-files/workbook-lock-comparison-20261017-1.json`：根与候选字节 SHA 不同，但 YAML 规范化后的依赖语义完全一致；差异来自 frozen lock-only 的格式规范化。不能报告全文件 SHA 相同。新候选源同步记录见 `workbook-candidate-sync-20261017-2.json`；原失败目录已双份保留。专业文件/工作表计划已加入 `.gitignore` 窄白名单及执行导航，确保可作为仓库内 versioned artifact 审阅。

### 2026-10-17 真实范围与导入护栏接续

范围原生第1轮在 runtime accepted 后立即读 provider ledger；失败保留，随后原 ledger 已有完整单条 metadata，修正 fixture 为先等 canonical completed 再核验，原120秒及全部身份断言保持。第2轮单条通过，跨表批次在“明细”真实点击失败：批注工具条覆盖底部页签。WorkbookPanel 将浮层限制在 grid 容器，页签保持独立；同一 pointer 场景重验，不使用 force click 或注入事件。两轮 Main 都正常 code0/signal null，forcedCleanup0。

默认第3轮在旧导入预览守卫要求 budget.xlsx 文本样例失败；窄写集扩展为 `codex-import-fidelity-acceptance-matrix.test.mjs`、两份对应路线图与导入 click-through 的文件样例/预览观测。直接迁 PDF/DOCX 到页面、XLSX到工作表、PPTX到明确system_open；不以旧后端抽取断言恢复文本优先。1891行 GUI helper 只抽出文件预览职责到相邻专用 helper，新逻辑全部落于小文件；其余导入/历史/视觉逻辑不增加，后续拆分不属于本刀完成声明。导入业务、协议、Rust与发布继续只读。目标是实际导入文件入口验证 current renderer、原字节与零ZIP噪音；旧点击通过记录不计新合同通过。

第3轮跨批次范围退回 A1:C1；第4轮先验证 grid aria-activedescendant/选中状态，仍在同一位置超时，证实不是只读输入值的断言问题。只读诊断 `/tmp/lime-workbook-range-own-diagnostic-4.json` 绑定该候选renderer，显示ready、A1:C1和真实A1选区。窄写集扩展为原无脏改动的 `hooks/useArtifactAutoPreviewSync.ts` 及测试：源预览此前进入生成文档文本轮询，空正文满足autoSync，文本merge重写artifact与updatedAt。3项先红，现直接拒绝previewArtifact的自动文本同步与merge，原生尚待证明选择恢复；未删生成文档正常streaming同步。定向4suite50项通过，类型/lint与新完整wrapper进行中，候选90声明文件零漂移。此修复同时收敛PDF/DOCX/Workbook重复读取owner，不新增别名或后端。

默认第4轮在43/133批的ProviderSetting手动模型测试失败。测试callback返回成功却未像真实父组件更新provider投影，保存结束后原props自然覆盖本地modelList。只迁该用例的onUpdate夹具，真实触发rerender返回模型投影；保留完整request和最终可见模型断言，生产多模型逻辑不改。该测试文件原无脏改动，修改范围为单一case；定向待验。此前27批旧导入护栏已在原续跑通过125项。

### 当前重载边界修复

ProviderSetting夹具26项通过。默认第5轮前置lint、五语言扫描43文件/findings0和类型通过，随后pretest构建账户客户端失败：METHOD_ACCOUNT_LOGIN_START/READ/LOGOUT及LoginAccountParams/GetAccountParams尚未生成到protocol。packages客户端文件在该轮发生并行变化，本写集保持只读；不重置Vitest续跑状态，不宣称默认门禁已通过。

完整标准wrapper第4轮24/24、独立根完整类型通过。工作表批注第5轮单条完整通过，后续范围仍回A1:C1；原120秒失败与Main76848正常code0/signal null、forcedCleanup null均保留。自有renderer只读诊断绑定该候选：ready且key已随updatedAt变化。自动同步修复并未单独关闭问题，不再把它当唯一根因。

新窄写集为PreviewArtifactRenderer及真实WorkbookPanel集成回归、useWorkspaceArtifactPreviewActions的明确打开请求和测试。messageArtifacts的同路径merge会取最大updatedAt；专业预览不能以消息时间充当文件版本。集成红例先证明第二次读取及丢选区；改为没有明确previewRequestKey时保持同一预览，主动打开生成新请求、批注回原文保留指定请求。5suite53项通过，包含真实选区/DOM identity与明确重开仍取消并重新读取，不放宽原生断言或期限。91声明文件已同步候选且零漂移，记录workbook-annotation-candidate-sync-20261017-6.json；最新标准wrapper与完整原生仍待验。

## 最新范围批注与源路径回归（2026-10-17）

`workbook-annotation-native-20261017-6`已完成单条、跨表两条批次、文件变化拒绝/零新请求/保稿、逐条重新定位到新SHA、主Composer整批只一Turn、原主输入保留与同一canonical身份；provider请求总数3，console/page/trace/mock错误0，IPC147，Main23379正常code0/signalnull、forcedCleanup null。人工检查范围选区、缓存7及工具条页签位置通过。PDF第8轮和DOCX第6轮也完成共享owner原生回归；这组证据早于后续canonical源路径修复。

导入完整流程发现 `readFileChanges`误将绝对路径裁成basename；投影及跨层真实红例修复后80项通过。93文件候选的新标准wrapper24/24通过，新完整导入及工作表/PDF/DOCX再验中。源路径修复未绕过文件读取错误或恢复抽取文本。原生与默认门禁最终结算前，当前退出项保持开放；编辑/保存/flush/roundtrip仍是独立未完成合同。

## 共享范围反馈组合验收

最新Workbook范围原生 `workbook-annotation-native-20261017-7` 完整通过，摘要SHA `b40aba9c745dd42b55c6a984ccb62f91eff660e9c4ff3928958579cb02911a9e`。同一固定候选串行导入6、Workbook7、PDF9、DOCX7全部通过，94声明源/1688产物零漂移、错误0、正常Main退出。收据 `import-source-path-final-20261017-1` 关闭前述“最终共享原生待验”，不关闭后续应用scope草稿迁移、Office编辑/保存或Slides。随后Workspace设置往返将通过真实DOM卸载/返回验证两条批注、原文件变化错误、主Composer及显式重定位；正在新构建验收，不回写旧收据。

应用 scope 批注已独立冻结：标准 wrapper24/24，Workbook 原生第8轮真实设置导航卸载原 Workspace（原 Composer DOM isConnected=false），返回后两条正文、位置、源文件变化错误及主草稿保留；显式重定位后整批仅新增1个Turn。Main code0/signalnull、forcedCleanup null、console/page错误0、freshness前后ready，94源/1688产物无漂移。收据 `.lime/qc/professional-files/annotation-scope-final-20261017-1/receipt.json`，SHA `f40cbab2cbaf82af4696797e4dc5d89c48e8173725c4aa452bb723b7f779b5a4`，设置返回截图已人工复核。该收据不包含后续 Slides 变更；进程重启耐久性仍 unknown。

## 编辑、保存与 roundtrip 合同（2026-10-17，active）

主目标：从已冻结的只读/范围反馈进入原文件编辑；根Cloud/Plugin继续避让。写集限定workbook/、同一fileBrowser原字节写gateway、Workspace批注提交前的文件flush接线与对应测试、五语言、本计划/架构/审计。依赖仅把既有锁图jszip@3.10.2提升为直接依赖（MIT分支），不升级其他包。源包的非目标XML、图片、图表与未知成员保持payload；不以ExcelJS重新导出丢失未投影内容。

REA复用同一parent与同摘要原成员，原字节观察openCellEditor/commitCellEdit/updateFormulaInput/cancelCellEdit、requestExport/flushCrdtUpdates；这些可确认方法名尽量对齐。WorkbookController为Lime职责类名，原压缩类名不猜测。current fs/writeFile与Codex均无CAS字段，本切片保存前重读SHA并在序列化后再次核验，检测已观测外部修改、失败保稿；不宣称跨外部进程原子compare-and-swap。文件版本改变需要显式放弃/重新打开，不能静默覆盖。

编辑默认关闭，显式进入；单元格/公式栏、Enter/Tab提交与Escape取消、IME不误提交、跨sheet和Workspace卸载保留应用内草稿。保存前flushEdits，写原格式原路径，成功按捕获revision结算，新输入不清；失败/冲突保留所有编辑。XLSX仅修改目标单元格XML，保留样式/其余成员；公式变动清理过期缓存并请求Excel重算，Renderer不执行公式或外链。CSV/TSV保留分隔符/BOM/编码/换行与未改字段语义，公式样文本不求值。关闭应用后的耐久性不在本内存合同。

验证：真实OOXML与CSV/TSV roundtrip、非目标payload摘要、冲突/写失败/重复保存/保存中新revision、组件键盘和五语言；类型/lint/contracts/锁与标准GUI；真实Electron编辑→保存→重开原字节、外部修改零覆盖、批注前flush并沿canonical原链提交、零mock/error/正常退出和freshness。未通过前不勾编辑完成。

### 编辑实现与验收准备

current 实现为 `WorkbookController`（Jotai application scope）、`WorkbookEditingControls`、原 XLSX 包修改 `workbookPackage` 和统一 CSV/TSV 词法 `delimitedWorkbook`。读取、编辑、保存与范围反馈共用源路径及文件版本；删除重复 CSV parser、旧只读提示与重复 sheetIndex authority。新增 compat/deprecated 0；没有新增协议或文件历史。受保护表/分组公式的保存明确失败，公式由外部表格引擎重算；完整 Excel 编辑仍是能力缺口。

7 suite 91项定向回归通过，覆盖原包往返/非目标payload、两次源摘要检查、写失败保稿、IME与Workspace卸载恢复、原字节gateway、批注提交前flush。日志 `/tmp/lime-workbook-edit-related-20261017-2.log`。五语言完整性通过；完整Renderer/Node类型第2轮与标准GUI正在运行。strict lint第4轮通过，原生fixture新增保存→重开→外部冲突→设置卸载/返回→明确放弃，以及提交前自动保存→旧批注SHA拒绝→显式重新定位后沿原canonical链接受；后者尚未运行，不以组件结果替代原生通过。

旧1.159.0临时候选被外部空间清理移除，旧Slides最终收据以仓库内冻结件为准。六项专业文件依赖恢复在 `.lime/dependencies/professional-files-20261017/`，根链接指向该持久目录；根9workspace frozen lock-only通过，未改变workspace的registry依赖或全局工具。首次恢复误进入根workspace的安装失败及旧候选同步/构建失败保留原日志，不计新实现build通过。

新验收改用根1.160.0标准wrapper构建，再创建 `.lime/validation/` 内持久候选。根wrapper前记录8591份声明源摘要；随后仅扩展原生测试脚本的flush场景，需在后验清单单列该已知fixture变化，并检查是否存在其他并行漂移。架构图已补Controller→原包edit→两次读SHA→原gateway写入、Workspace提交前flush边界。Architecture impact: minor；Responsible developer confirmation: root, 2026-10-17。真实原生/最终门禁完成前，编辑退出项保持开放。

根新版完整标准wrapper `standalone-shell-01-20261017133528-59598` 24/24通过，完整类型/命令合同通过；持久候选1复制时8660声明源与1899产物逐份无差异、freshness ready。原生1保留exit1：保存/原字节重开、外部冲突零覆盖已通过；设置确实卸载Panel，返回会话后右侧面关闭，fixture却直接等待旧Panel恢复而超时。修改为用户实际重新打开工作台文件树原路径，再核应用scope编辑保留，不新增自动打开行为或缩短断言。Main67180正常code0/signalnull退出、forcedCleanup null。人工截图另发现窄面板工具栏将标题与动作挤在同一行、冲突提示只占约半宽；Panel将标题/批注与编辑动作分行，错误使用整行，原生补几何断言。新源码须重建/重验，不扩写候选1通过范围。

### 工作簿保存原生结算与共享回归

固定1.160.0候选2完成Workbook原生2（保存/重开、外部冲突零覆盖、设置真实卸载后经文件树重开保稿、取消放弃/明确放弃、提交前自动保存、旧SHA批注拒绝/保稿、重新定位接受、跨表批次），以及DOCX/PDF/Slides三原生共享回归。四轮各104份内部声明源/2010regular产物前后无漂移，freshness均ready，console/page/trace/mock错误0，Main分别49012/58063/59836/61916正常code0/signalnull退出，forcedCleanup null。外层候选8660声明源/2010产物核验稳定；标准wrapper2 `standalone-shell-01-20261017134718-42385` 24/24。人工复核保存、冲突、放弃和flush接受截图；237px面板的错误宽213px，已修复旧工具栏挤压。

79份证据双目录冻结于 `.lime/qc/professional-files/workbook-edit-final-20261017-2/receipt.json`，SHA `176685cd012fb03445b17a66d3506030950f1002ca0745d3917989ace05860e7`。只证明该固定组合；创建freeze1时根Plugin owner已变化，摘要核验中止并保留aborted.json。最终freeze2明确记录根Plugin Rust与四份GUI源码/测试漂移及新增remote模块，不宣称最新根零漂移。Current fixture聚合已完成前置定向场景，重建根sidecar时因并行remote/projection、wire模块暂缺及AppsReadResponse.data类型错误失败，保留 `/tmp/lime-workbook-edit-agent-fixture-20261017-1.log`；不改对方代码或绕过freshness。默认local10在旧选区A1重置断言失败：应用scope文件编辑要求保留B2:C3，测试迁移为仍重读/销毁旧导入、创建新DOM且保留选区，并以独立Jotai Store隔离用例。13项回归通过，local11沿原状态续跑。

XLSX普通单元格编辑/保存与共享提交产品合同已验收；完整Excel特性、CSV/TSV原生保存（已通过真实字节unit/component roundtrip，正在补原生）、默认全仓门禁及完整GUI继续开放。候选3只扩展两份既有fixture的CSV/TSV保存/重开/原词法逐字节断言，生产源码与产物沿候选2逐份相同，不重新构建或混入并行Plugin改动。没有新增compat/deprecated；删除项仍为重复CSV parser、只读文案与重复sheetIndex authority。

### CSV/TSV 重开与默认门禁失败诊断

接续写集为两份原生fixture、`image-gen/index.test.tsx`和本计划/索引；Cloud/Plugin生产owner继续只读。候选3原生`workbook-delimited-save-native-20261017-1`保留exit1：CSV已经真实保存且完整字节相等，第二次文件树打开在previewRequestKey变化断言超时；Main97238正常code0/signalnull。文件树的`workspaceFilePreview`投影不持有previewRequestKey，其既有生命周期通过loading卸载旧Panel再读取；不能套用会话artifact的明确请求键。fixture改为同时要求旧DOM断连、新文件ready、磁盘SHA相等及连续trace中新增长同路径真实Electron IPC fs/readFile；保存词法与零新增Turn断言保留，不修改生产行为或期限。新候选原生尚待验。

默认local11沿原状态通过至93批，在94/133批ImageGen两个卸载timer断言失败，独立完整复现9绿2红。临时spy诊断保留于`.lime/qc/professional-files/workbook-edit-root-validation-20261017-4/image-gen-timer-diagnostic.log`：实际残留来自新Cloud Account真实订阅的250ms event drain及jsdom诊断Storage的0ms通知，消息3000ms timer已被清理。组件fixture在typed account与notification订阅边界隔离，无生产改动；延迟保存夹具同时改为真正执行updater后再返回，避免把“成功完成”误测成更新未执行的错误路径。原卸载全局timer=0和新消息完整3秒断言保持，11/11完整定向通过；未清timer蒙混、未手改默认续跑状态。临时诊断插桩已移除，原测试与摘要留存。Architecture impact:none（仅测试）。current为既有产品owner，新增compat/deprecated/dead生产项0。


CSV/TSV原生2在候选4已完成两格式保存、完整原词法字节比较和重新读取：每次重开都有旧DOM卸载、原文件SHA相等及2次同路径真实IPC读。IPC126、trace/console/page/mock错误0、104声明源无漂移、产物及当次sidecar前后断言通过、freshness前后ready。但Main73916未在原15秒内正常退出，整轮exit1；仅在失败后SIGKILL回收，不能计通过。保留候选4原summary/截图/日志。此退出超时根因unknown；下一轮仅扩展同一fixture的只读Main生命周期、活动资源和debugger等待观察，不改产品/退出路径/期限/断言。

来源纠正：原生2默认解析到根`lime-rs/target/debug/app-server`，SHA `575ecd9588719c730618c24228151dfff72f809f7e8d511b97c6c2853bbe02bb`；原生3虽summary.ok=true且Main21789正常退出，实际仍为根debug，SHA `c567e11b12b815e4b941ab9d8570073e9f5f0443e4158c0a894bdfac6f1fc565`。两者均不是冻结候选2的prepared sidecar，不能推广为同源组合验收，正常退出也不能证明原超时根因修复。旧XLSX冻结收据不追写。

fixture已删除dev binary resolver，默认选择候选内prepared sidecar；显式`APP_SERVER_BIN`也必须与prepared sidecar逐字节SHA一致，否则启动前拒绝。保留前后源/产物/sidecar/freshness及15秒正常Main退出守卫。候选6沿候选5逐份核验8660声明源、2010产物，仅fixture入口变化，生产源和产物差异均0；准备收据位于`.lime/qc/professional-files/workbook-edit-root-validation-20261017-6/preparation-receipt.json`。原生4显式绑定候选prepared SHA `d491fc0d711aeb43d6eec7fec32cec1b7ec868087a5fa974ed325c76700835a7`，完整exit0；不以混源passed替代。

CSV/TSV独立验收关闭：原生4完成两格式保存/完整词法字节/每次重开2次成功同路径IPC读及旧Panel断连，129次真实IPC，trace/console/page/mock错误0；Main47003正常code0/signalnull、forcedCleanup null，未改15秒期限。8660声明源/2010regular产物前后零漂移、freshness ready；CSV/TSV截图人工复核。负向实际运行在freshness阶段拒绝不同根debug SHA，未创建Thread或启动Electron。15份证据双目录冻结于`.lime/qc/professional-files/workbook-delimited-final-20261017-1/receipt.json`，SHA `c0995d82c06c613c627b6db03e86c901e34a245e384c49e0718a6c685b00dd45`。根冻结时已有12份并行源码差异，收据明示；不宣称最新根通过。脚本no-undef首次自设环境漏列浏览器evaluate全局而报8项，按Node与浏览器双上下文配置后2文件0错误/0warning；没有改脚本或关闭规则。默认local12已通过类型并越过94批ImageGen，继续原状态续跑，尚未完成。

## 矩形文本复制与 TSV 粘贴（2026-10-18，原生待验）

主目标是补齐同一 Workbook 编辑 owner 的范围剪贴板垂直切片。本轮窄写集为新增 `workbookClipboard.ts` 及纯函数测试、现有 `WorkbookController.ts` 与独立剪贴板测试、`WorkbookGrid.tsx` 与独立原生事件组件测试、本节。五语言 `workspace.workbookPreview.invalidPaste` 由 root 在共享语言 owner 补齐。未修改 writer、导入器、协议、Rust、Presentation、发布或原生入口；不启动 Electron。

参考只读核实同一安装包及同摘要 `webview/assets/workbook-panel-4f197d9d8ac4.js` 原成员，复用 REA parent `ev_e43b4b7ce0e35465a48ce864b3da1b7c8d892cb8955c0fc33431e3d2195215dd`。UTF-16 offset 46074 确认 `requestClipboardPayload(copyKind)`；46519 确认 `pasteClipboardData(payload)`；141167/143000 确认纯文本/HTML/结构 MIME 的读写；140750 附近确认 grid 焦点且不在输入框时才取得剪贴板所有权。未执行参考 bundle，也未新增全扫描。参考 request 经 worker 异步返回；Lime 当前 snapshot/OPC owner 同步返回纯文本，直接使用真实 `ClipboardEvent.clipboardData`，不伪造 worker/Promise 或新增系统权限入口。

current 合同：`requestClipboardPayload("copy")` 只读当前表选区的 `cell.text`，缺失或已失效公式缓存为空，不读取 raw/公式源码补算。TSV 使用 TAB 列分隔、LF 行分隔，含引号/TAB/CR/LF 的字段双引号转义，空字段也加引号以保留末尾全空行；不 trim 尾空格或改写多语言字符，隐藏行列按逻辑矩形包含。`pasteClipboardData({plainText})` 从选区左上角放置实际矩阵，不平铺到原选区；空 plainText 清除单格。解析复用唯一 `parseDelimitedRows`，保留字段引号换行及首 BOM 文本字符。

矩形、每格输入、UTF-8 20 MiB、10 万 cell、当前工作表边界及全工作簿投影 cell 数均在提交前校验；原选区或目标与 merged 相交、ragged、非法控制字符/超长值整批拒绝。拒绝保留 document/edits/selection 引用与活跃输入；只更新准确五语言失败提示。活跃输入、只读或 saving 时不启动范围粘贴；输入框继续原生 copy/paste。成功范围编辑仅一次 Controller 通知/投影，保留其他本地编辑及原样式，复用 `flushPublicFile`、原包 writer 和两次源 SHA 校验。XLSX 前导 `=` 沿既有公式合同，修改清全工作簿缓存但不计算；CSV/TSV 的公式样值及前导单引号全部保留字面。

`cut` 返回 null 且 Grid 不接 onCut；HTML、结构 MIME、相对引用迁移、merged 复制/粘贴与 tile 语义仍未实现，不能由已见 key 推断完整 proto 或宣称对齐完成。新增 compat/deprecated 0、删除生产代码 0；新 helper 只拥有转换/验证，未建立第二套解析、草稿、保存或业务事实源。

本地最终验证：工作表目录 10 suite / 94 项全绿，其中新剪贴板 35 项，包含手写 TSV、缓存 7/不求值、隐藏格、多语言、空末行、整批拒绝、输入隔离、单次通知/写入、原包 payload/样式保留、双次 SHA 冲突与失败保稿。六文件严格 ESLint 0 错误/0 警告、Prettier 通过；包含测试及真实依赖的窄 strict TypeScript 通过。初次 3 项断言错误已修正为 CSV 无 formula 属性及 XLSX 跨表缓存全部失效；初次测试类型问题已修正。`/tmp` 临时 TS 配置自动环境类型导致的两处外部 readFile 返回类型误判，在显式 root `node_modules/@types` 与 node/react/react-dom types 后消失，未修改共享源码或放松规则。最终日志 `/tmp/lime-workbook-clipboard-{tests,lint,types,format}-20261018.log`，源码收据 `/tmp/lime-workbook-clipboard-source-receipt-20261018.json`。

- [x] 实现与本地定向合同完成（本切片本地完成度 100%）。
- [x] root 将最小 ClipboardEvent → Controller → workbookClipboard → 既有 flush/writer 接线补入共享架构图并确认，Architecture impact: minor；责任 root，2026-10-18。
- [ ] root 集成同源候选、标准 GUI 及真实 Electron 系统剪贴板/键盘保存往返，核验同一 canonical identity、实际 gateway trace、零错误、源/产物稳定与正常退出。
- [ ] 原生证据冻结后再结算本切片产品完成度；94 项本地测试不替代 Gate B，旧 missing 收据不复活。

根接线增量（2026-10-18）：五语言 invalidPaste 已补齐，独立 `--workbook-clipboard` 入口在创建进程与源稿前拒绝混入 annotations、普通编辑或 delimited 场景，分别生成 XLSX/CSV/TSV 原稿。三格式均由既有真实文件树与系统剪贴板 helper 打开/重开，外层保留 canonical identity、实际 IPC、零 mock、freshness、源/产物/sidecar 摘要及 Main 正常退出守卫。helper 12 项手写原包 oracle 已通过；新入口及真实三格式执行待独立候选验证，未扩大旧候选证据。
