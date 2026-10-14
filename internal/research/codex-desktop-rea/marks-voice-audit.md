# Composer marks 与 dictation：补证和最小实施合同

校准日期：2026-10-14。只读调查，唯一仓库写集为本页；未改产品、测试、Rust、协议或权限，未启动 Electron。
主任务与产品验证结果仍由[当前执行计划](../../exec-plans/codex-gui-alignment-current-plan.md)持有。
本页不重复持久草稿审计，不扩展系统全局听写、原生音频或双向实时语音域。

Lime 的明确缺口是链接与 code block 文档语义，以及听写启动、取消和异步生命周期的完整合同。
已有录音、分段转写、润色、草稿 revision 保护与 App Server 通道属于 current，不能归为全部缺失。
基础 schema 只确认 `link` mark；上游还存在可选 rich PMU schema，不能据基础 schema 断言应用没有其他 marks。

## 来源与证据边界

目标为 `/Applications/ChatGPT.app`，Bundle ID `com.openai.codex`，版本 `26.1007.30912`，build `20156`。
ASAR SHA-256 为 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。

| 来源                                                                                               | 本次用途与限制                                                                                                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [主 Composer 审计](main-composer-audit.md)、[对照报告](report.md)、[证据索引](evidence-index.json) | 复用已确认主链 `LocalConversationPage.uc → app-primary.xc/$X → rpt → Qft`；未重跑相同 REA 分析                           |
| `ev_18100ea823ab540f529ba756499161870e17f824267ed48a0665d3fb48cd0bb4`                              | primary 选定模块 structural complete；semantic partial，100000 node ceiling；parse failures 0；不等于整个应用完整分析    |
| `ev_f20dbab9b4c0a7e6ef566e91958157ca9196742f7ffed73c8682055b7bdf3d16`                              | `xc` export / local `$X` identity；SequenceExpression 返回形状 unknown；不作为 voice 或 mark 行为证明                    |
| `ev_38693c282fb15af95ea4b8f1caa292ed199fee587ea26d709b126123c3fb8153`                              | initial 六个既有 inert 声明；structural complete / semantic unknown；本次新列的 schema、dictation 声明不在这六声明覆盖内 |
| 原成员与普通 Acorn AST                                                                             | 以下补充职责来自完整原成员的有边界 AST/源定位，静态观察、未执行，不冒充新增 REA semantic Evidence                        |

原始资料位于 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/`：

- `composer-editor-evidence/webview/assets/app-primary-6f60e9ac4103.js`，SHA-256 `7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321`，已有 ASAR integrity manifest。
- `composer-editor-dependencies/webview/assets/app-initial-6350d04672d0.js`，SHA-256 `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`；本次重新核对原成员 SHA，普通 AST 解析成功。
- `composer-draft-persistence-artifact/app-shared-8bd9d0399038.js`，原成员 `webview/assets/app-shared-8bd9d0399038.js`，SHA-256 `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245`；精确 link/code block 补证重新核对摘要，复用该原成员，不重复持久草稿研究。
- `composer-editor-analysis-evidence.json`、`composer-editor-export-view.json`、`composer-editor-initial-slices-evidence.json` 为复用 Evidence，不重复生产。

下列坐标均为原成员 UTF-16 半开区间。压缩 local、短 export 和真实 property/method 分别记录；
没有确认上游开发源码的类、hook 或 schema 的 descriptive 名称，不将压缩符号迁为 Lime 命名。

## Marks 与 code block

| 可确认模块 / 锚点                                                             | 静态职责                                                                                                                                                        | Lime current owner / 状态                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| initial `DHr` assignment `[3574502,3575291)`                                  | 基础 link mark 扩展 `href`、literal Markdown 来源及 source app 等 attributes；attribute 存在不证明所有剪贴板/导航行为                                           | [composerSchema.ts](../../../src/components/input-kit/composerSchema.ts)、[types.ts](../../../src/components/input-kit/types.ts)：无 mark 定义，JSON loader 显式拒绝 marks；缺口确认                                                                      |
| initial `mJr` assignment `[3741972,3742419)`                                  | 基础 `code_block` node：语言/自动检测 attributes、`text*`、`pre/code` 解析与 DOM；基础 spec 的 marks 为空                                                       | schema 只有 paragraph 与 inline；types 也只允许 paragraph；缺口确认                                                                                                                                                                                       |
| initial `hJr` assignment `[3742420,3742879)`，schema 参数 `[3742432,3742878)` | 基础 schema 的 nodes 含 code block、inline mentions，marks 只列 link                                                                                            | 这仅说明基础 schema，不说明 rich 分支的完整 mark 清单                                                                                                                                                                                                     |
| initial `cBc` `[10281650,10293903)`                                           | `enableRichText` 为真时选择 `_Jr().pmu.schema()`，否则使用基础 schema；code block、selected text links、plain text 有独立选项；编辑/View plugins 与文档转换组合 | 唯一 Controller + EditorView 已有；需要扩展既有 schema、serializer、keymap 和 View，而不另建 textarea/第二 Controller                                                                                                                                     |
| initial `Rhl` 声明起点 `11201687`；DBc 创建分支                               | provider 默认 `enableCodeBlocks/enableRichText/enableSelectedTextLinks=true`，随后 spread `controllerOptions`；plain text 另有状态                              | 默认选项是静态观察，实际主 surface 的有效覆盖选项与 rich schema 清单仍需单独闭合                                                                                                                                                                          |
| initial `jBc` class `[10302274,10326275)`                                     | `getText`、`getPlainText`、`getPersistedText`、`persistedTextFormat` 根据 Markdown editor/plain text 分支投影；保存格式与用户 prompt 有明确方法分工             | [composerSerialization.ts](../../../src/components/input-kit/composerSerialization.ts)、[ComposerController.ts](../../../src/components/input-kit/ComposerController.ts)：当前投影文本不读取 marks、不生成 code fence；仅加入 schema 不会形成正确提交合同 |

已有 `projectComposerDocument` 同时承担显示文本、PM/UTF-16 span、UTF-8 typed ranges 与 paste 展开；
`ComposerController.submit` 在展开后的投影上形成 submission，原文档在 receipt/history 中保存。
新增 link/code block 会改变提交字符数，不能把 Markdown 字符写回显示文本而复用旧 range；
也不能只渲染样式、发送时丢失 href/语言/fence。

当前有效测试包括 `composerSerialization.test.ts` 的 CRLF、空段落、UTF-8 边界、paste 展开后 ranges、
mention parts、未知 node/kind 与重叠范围拒绝，`composerPositions.test.ts` 的文本/PM 位置，
`ComposerEditor.test.tsx` 的真实 EditorView 事务、键盘/粘贴/IME，以及 Controller 的 history/receipt/revision 测试。
这些必须随 owner 扩展，不能删除有效 unknown 输入校验。当前序列化测试没有 link/code block 的 roundtrip/提交 oracle；
普通 Markdown 正文渲染、Agent 生成 Markdown 和已有 rich-input Gate 均不能补上这个缺口。

最小可实施切片：

1. 只在 input-kit 扩展确认的 link/code block 文档语义及严格 JSON types；未知 mark/node 继续拒绝。上游动态 rich PMU 的完整清单保持 unknown，不凭猜测增加 bold/italic 工具栏。
2. 同 owner 定义显示文档、原始 draft 与 submission/persisted prompt 的转换，重算 Markdown 及 paste 展开后的 typed UTF-8 ranges，保留 atom、语言、原始内容与 revision/receipt。
3. 接入实际 EditorView 的 links/code block 输入与编辑、选择、paste、undo/redo、Enter/IME。先完成序列化/位置/restore 定向回归，再进入真实 rich-input submit → canonical readback Gate；不能只加 DOM 样式或 source-string 护栏。

普通 link mark 的协议、基础 fence、语言和文本转换规则已由下节闭合，不再列为整体 unknown。
仍未确认：rich PMU 的所有 mark/扩展、有效主 surface 选项、其他专用链接/mention 协议、全部 rich 配置组合、
HTML clipboard 回贴、真实 roundtrip、Codex 点击/复制与运行表现。上述最小切片是实施建议，非已实施产品合同。

## Link / code block 精确输入和序列化合同

本节追加于同日，沿上节未答问题只读补证；未执行目标、未复制大块上游代码，未创建新 REA application analysis。
安装包的基础投影与可选 rich serializer 分开列出，不把某个分支的规则扩大为全应用行为。

### Link attributes 与 DOM

initial `DHr` `[3574502,3575291)` 继承 shared export `l$` 的 mark spec。
import 为 `l$ as Eze` `[125508,125517)`，shared export `QLr as l$` `[8109565,8109574)`，
对应 class expression `[5199711,5200621)`。上述短 export/local 仅确认当前安装包身份；开发源码类名 unknown。

| 字段                          | 最终 default | 显式 validate / 附加声明 |
| ----------------------------- | ------------ | ------------------------ | ------------------------ |
| `href`                        | `null`       | `string                  | null`                    |
| `title`                       | `null`       | 未声明 validate          |
| `disabled`                    | `false`      | 未声明 validate          |
| `isAutolink`                  | `false`      | 未声明 validate          |
| `isGeneratedAutolink`         | `false`      | `boolean`                |
| `literalMarkdownOccurrenceId` | `null`       | `number                  | null`；`clipboard:false` |
| `literalMarkdownSource`       | `null`       | `string                  | null`；`clipboard:false` |
| `sourceAppId`                 | `null`       | `string                  | null`                    |

没有独立 label attribute，label 是 mark 覆盖的文本；基础 mark 为 `inclusive:false`。
未声明 validator 的字段不能报告为已有严格类型校验，`number|null` 也不能改述为 integer 校验。

基础 `parseDOM` 为 `a[href]`，要求当前 realm 的 HTMLElement，读取 href/title，
以及 `data-rich-text-autolink`、`data-rich-text-generated-autolink`。
两个属性名的 shared 声明分别起于 `5199637`、`5199667`。
initial wrapper 保留该规则并先验证 href；另有 `span[text-link-href]`，读取 `text-link-title`、
`data-breakable-url` 和 generated-autolink。它没有在这条 span parse 分支读取 literal/source app 字段。

协议链为 initial `VB` `[3570866,3570989)` → shared export `T8` 对应函数 `[4942456,4942542)`
→ HTTP/HTTPS parser `[4939357,4939471)`：trim 后拒绝空值和内部空白，仅接受有效 HTTP/HTTPS；
`VB` 另外接受 URL parser 判为 `mailto:` 的地址。普通 link mark 不接受相对地址、file/javascript URL。
这不排除另有专用 rich-link/mention node 协议。

实际 `toDOM` 由 initial `yHr` `[3571423,3572163)` 覆盖基础 `<a>`：
显式 href 且非 autolink 时建立 button/dialog 属性；否则设置 `data-breakable-url`。
它输出 `text-link-href`、可选 `text-link-title` 和 generated-autolink 标记，调用现成 UI factory 的 contentDOM，
不是直接返回普通 anchor。是否在真实 GUI 打开链接、弹出编辑器仍未执行证明。

### Literal Markdown 与 source app

| initial consumer / 坐标                              | 确认职责                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `xHr` `[3572228,3572376)`                            | source app 优先显式 `sourceAppId` 字符串，否则通过 href resolver 取得来源，再用于 UI factory 的来源 dataAttributes；未观察为授权/提交路由 |
| `VHr` `[3579980,3581474)`                            | 将解析原文、occurrence 与 node/mark 区间关联；可拆分 mark 区间，分配 occurrence ID 并保存原 Markdown 来源                                 |
| `NHr` `[3577836,3578023)`；`HHr` `[3581832,3581906)` | 仅当 literal source 完整覆盖一个解析链接且无 storage marker 时，才可能复用原文                                                            |
| `GHr` `[3582275,3582615)`                            | 要求 href/promptHref、text/promptText、title 与可选 labelFormatting 匹配；不能无条件重放旧 source                                         |
| Controller `updateLink` `[10315800,10316636)`        | 修改 href/label 后关闭 autolink/generated-autolink，清空 occurrence/source；避免旧来源覆盖新编辑                                          |

`clipboard:false` 是 spec 的明确标记，不能由此宣称所有 HTML clipboard transform 已验证。
`sourceAppId` 的展示归属不意味着新的能力权限；Lime 不能用它选择第二后端或推导可执行动作。

### 三种文本与 serializer 分工

| initial method / 坐标                                              | 实际数据流                                                                                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `getText` `[10303823,10303929)`                                    | 默认读 dictation document，调用 `yJr`；无 Markdown serializer 或无格式时使用 `WB`，否则调用 rich serializer             |
| `getPlainText` `[10303929,10304061)`                               | 对 View doc 调用 `WB`，默认 `preserveLinkMarkers:false` 且 `preserveTextLinkMarks:true`；不是 DOM `textContent`         |
| `getPersistedText` `[10304126,10304302)`                           | rich 且非 plain mode 时直接调用 rich serializer；其余调用 `WB` 并开启 `preserveTextLinkMarks`                           |
| `persistedTextFormat` `[10304302,10304401)`                        | rich 且非 plain mode 返回 `markdown`，其他返回 `plain`                                                                  |
| `yJr` `[3744252,3744543)`                                          | rich 投影前移除 literal-paste mark；序列化结果仅含空白/数字实体时退回 `WB`；末段尾空格有单独修正                        |
| `_Jr` `[3742886,3743965)`                                          | rich serializer 先规范化 generated/literal link；移除 literal-paste mark；paragraph-only 与整份文档分别选择下述分隔规则 |
| `parsePromptText` `[10315480,10315800)`；`vJr` `[3743965,3744252)` | rich/non-plain 走 Markdown parser 并恢复末段尾空格；否则走基础 prompt parser，分别受恢复链接/路径/富链接选项控制        |

基础 `WB` `[3584642,3586960)` 合并连续相同 link mark 的文本，再生成保留 href/title 的 prompt。
`preserveTextLinkMarks:true` 时，显式链接一般编码为 `[label](codex-text-link://href)`；
label 恰等于 href 且 title 为 null 时可以保留裸 href。
`preserveLinkMarkers:true` 才尝试复用仍匹配的 literal Markdown 原文，默认调用不能宣称逐字恢复。
`href:null` 的 autolink mark 还有按覆盖文本解析 URL 的分支，不把所有 autolink 简化为同一形状。

普通 formatter 为 shared export `uQ`，函数 `[5268729,5269015)`：

- 无 title：明确形成 `[escapedLabel](escapedHref)`。label helper `[5268563,5268658)` 按顺序转义反斜杠、`](`、`]`；href helper `[5268658,5268729)` 转义反斜杠和 `)`。
- 有 title：构造 `link` 节点、url/title 与 text child，交给 Markdown handler `[664134,664990)`。默认 quote 为双引号，可配置单引号，非空 title 才输出；有空白/控制字符的 destination 使用 `<…>`，title 经 safe 转义。此调用设置 `resourceLink:true`，阻止转为 `<url>` autolink。
- 不能直接给无 title 的字符串模板追加 title；这里复用了实际 Markdown serializer 的转义与 quote/destination 规则。quote selector `[659088,659254)`、autolink gate `[663849,664089)` 与 compile entry `[676577,677190)` 提供静态定位。

### Code block 与 fence / paragraph 规则

基础 node spec 在 initial `mJr` `[3741972,3742419)`；只有 `autoDetectLanguage:true`、`language:null`
两个声明的 attributes，均未声明 validate。`code:true`、`content:"text*"`、`defining:true`、`group:"block"`、基础 `marks:""`。
`parseDOM` 要求 `pre` 下的直接子 `code`，`preserveWhitespace:"full"`。

| initial helper / 坐标                                                                                                          | 语言与 DOM 合同                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IVr` `[3560672,3560985)`                                                                                                      | 按 code 自身、父级的 `data-language`/`data-lang`，再按 `language-*`/`lang-*` class 读取；读取后再过滤，不宣称无效高优先级值会回退下一来源                     |
| `PVr` `[3560494,3560565)`                                                                                                      | 只保留非空且不含空白、反引号的字符串；其他值返回 null                                                                                                         |
| `FVr` `[3560565,3560672)`                                                                                                      | 自动检测未明确为 false 时，`plaintext` 输出为 null；有效显式语言继续保留                                                                                      |
| 基础 `toDOM`，上述 node spec 内                                                                                                | `pre[data-composer-code-block][dir=ltr] > code.hljs`，有效语言加 `data-language`                                                                              |
| rich code class `[3750724,3751709)`；node spec `[3751291,3751437)`、Unist→PM `[3751437,3751600)`、PM→Unist `[3751600,3751708)` | 合并基础与 rich node attributes；解析 Unist `lang` 到 language/autoDetectLanguage，反向写 `lang:FVr(node)`；rich marks 来自自身 spec，不能据基础空 marks 排除 |

基础 `WB` 的 code fence 长度为 `max(3, 正文最长连续反引号数 + 1)`，语言紧跟 opening fence。
正文原样输出，不做 Markdown 转义；按调用者添加行缩进，closing fence 与 opening 一致。
paragraph 每条追加一个换行，整个输出最后只移除一个末尾换行，保留空段落。

rich code Markdown handler 为 shared `[658411,659005)`：默认反引号，可配置波浪线；
fence 长度同样避开正文最长相同字符序列且至少 3，lang/meta 经 safe 转义。
只有显式 `fences:false` 且无语言、内容符合约束时可走缩进代码；
对应 fence selector `[658244,658411)`、缩进 gate `[658093,658244)`、最长序列 helper `[657856,658052)`。
不把基础 `WB` 的固定反引号分支冒充所有 rich 配置的输出。

rich `_Jr.serialize` 在全部 nodes 为 paragraphs 且未要求 `preserveParagraphSpacing` 时，分别序列化每段、
去一个末尾换行再用单换行连接；其他情况整份文档序列化后去一个末尾换行。
paragraph handler `[668209,668324)` 处理 phrasing，实际完整 rich 配置和所有格式组合仍未穷尽。

### Lime 实施映射与复核方法

| current owner                              | 必须消费的合同                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `composerSchema.ts` / `types.ts`           | link/code block 字段、默认与严格 JSON 输入；unknown mark/node 继续拒绝，不默认扩展所有 rich marks                                       |
| `composerSerialization.ts`                 | 显示文本、提交 prompt、保存/恢复表示分别有定义；保留 href/title、code language/body、合法 fence/escaping；typed ranges 在提交表示上重算 |
| `composerPositions.ts` / Controller        | PM 与显示 UTF-16 位置不与 Markdown 字符数混同；保存原 JSON/资源、history、receipt/revision 保留；code block 跨节点编辑与 atom 不拍平    |
| `composerKeymap.ts` / `ComposerEditor.tsx` | 输入/编辑/选择、paste、undo/redo、Enter/IME、链接激活与 code block 行为真正接入 EditorView；DOM 相似不替代序列化合同                    |

复核使用工作区现有 `acorn`，`ecmaVersion:"latest"`、`sourceType:"module"`，不导入或执行目标模块：

1. 对上述原成员字节做 SHA-256 比较。读取为 JavaScript string 后，Acorn `start/end` 即 UTF-16 索引；不能用 Python code-point 索引替代。
2. AST 的 ImportDeclaration / ExportNamedDeclaration 对齐 `l$ as Eze` → `QLr as l$`，以及 `T8`/`uQ` 的确切 export local；以 returned node range 校验身份，不按压缩名跨版本匹配。
3. 对已知 class、函数、assignment 的精确起点使用 `acorn.parseExpressionAt`，检查 node `start/end`、property、method、调用参数；若外层返回 SequenceExpression，选择对应子节点再验证边界，不将整段逗号表达式当作单个 class。需要 import/export identity 时读取模块 AST body。只跟上述 seed，不建立第二次全应用 REA 分析。
4. 复核时在 `HB/gJr/MBc` 等已确定父声明范围内定位 assignment，保留 spec spread 与 serializer 分支；不把看到的单个 object 当成最终 rich schema。
5. 文档仅记录字段、分工、坐标和约束；静态 AST 不能证明真实 DOM/clipboard/GUI/roundtrip 行为。实施者先做有意义的定向行为回归，再按主计划冻结并取得真实 Gate。

## Voice / dictation

| 可确认入口 / 锚点                                                                                                                  | 静态职责                                                                                                                                                               | Lime current owner / 状态                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| primary import `Jt as ohe` `[49232,49241)`；initial export `oml as Jt` `[11343142,11343151)`，local function `[11153450,11163137)` | 接收 source scope、input visibility、dictation enabled、start/update/insert/append/send/cancel/interrupted callbacks；dictation 与 realtime 有组合但并非同一操作       | [useInputbarDictation.ts](../../../src/components/agent/chat/components/Inputbar/hooks/useInputbarDictation.ts)：已有录音与转写组合 hook；上游开发 hook 名称 unknown                                                         |
| primary `Qft` `[1364761,1409306)`；`Bc` 调用 `[1390869,1391330)`，包装动作在 `1391349` 附近                                        | 主 composer 接入上述 hook；明确消费 `isDictationStarting/isDictating/isTranscribing`、`abortDictation` 与 `stopDictation`；`send` 在无可用 submission 时退为 `insert`  | [InputbarCore.tsx](../../../src/components/agent/chat/components/Inputbar/components/InputbarCore.tsx)：只建 `idle/listening/transcribing`；录音期间禁用 editor、隐藏 send；toggle 结束后总是转写/插入，没有独立 cancel      |
| primary `Pst` `[1189434,1190342)`，`Dst` `[1187796,1188157)`、`Ost` `[1188157,1188237)`、`Ast` `[1188293,1188414)`                 | Controller adapter 分别处理 insert/append、pause-for-recovery 与 cancel；以当前 input active 和 scope 决定写入路径                                                     | [composerDictationDraft.ts](../../../src/components/agent/chat/components/Inputbar/hooks/composerDictationDraft.ts)：已有选择区 capture、连续 live/final 替换与 revision 保护；没有上游那套 session/segment/恢复 state owner |
| primary `Mst` `[1188459,1189369)`                                                                                                  | `finishForSend` → submit，未提交成功时仅在 scope/草稿仍一致条件下恢复文本；不证明每种 submit 终态                                                                      | Lime submit/commit/restore 已有接受及 revision 保护；听写仅先插入、后显式发送，不应报告整套发送保护缺失，也不凭静态证据默认自动发送                                                                                          |
| initial `QRc` `[10254209,10264374)`，local class `ZRc` assignment `[10256572,10264367)`                                            | PM dictation plugin/state 与 adapter；transaction mapping 保留区间，session 与 pending transcript/segment；IME composing 时延迟，compositionend 后 flush；dispose 清理 | current 有录音 generation、active identity、preview sequence、draft revision；尚无等价 PM dictation plugin/segment/IME延迟合同，需按实际需要收敛到既有 Controller                                                            |

可确认的 shipped methods 包括 `start` `[10257993,10258495)`、`updateSegment` `[10258936,10259214)`、
`update` `[10259214,10259382)`、`finish` `[10261893,10261960)`、`finishForSend` `[10261960,10262018)`、
`pauseForRecovery` `[10263441,10263652)`、`preserve` `[10263652,10263937)` 与 `cancel` `[10263937,10264366)`。
`cancel` 处理 recoverable 范围恢复，不是简单清空整个草稿；不能将记录过 transcript 的区间任意覆盖或擦掉后来编辑。

Lime current 链为：InputbarCore → useInputbarDictation → renderer `getUserMedia/MediaRecorder/AudioContext`
→ 单声道 PCM WAV → `asrProvider.transcribeVoiceInputAudio/polishVoiceInputText`
→ App Server `voiceTranscription/transcribeAudio` / `voiceTranscription/polishText`
→ `applyDictationTranscript` → 唯一 Controller/EditorView。转写和润色 API 当前有结果校验；未调查未知 Rust 脏区、provider/原生实现细节。

已有保护：unmount reset 递增 generation 并关闭 tracks/sampler/timers；permission success 与 final 转写/润色检查 generation；
preview 检查 activeRecording identity/sequence；`applyDictationTranscript` 拒绝旧 revision，保留周围 atom/附件/路径。

只读发现的最小风险与待先红问题：

- permission await 期间状态仍 idle，可能重复启动；`startRecording` catch 未检查捕获 generation，旧拒绝可能 reset 新录音或发旧 toast。这是静态风险，需 deferred 双请求先红，不能直接宣称真实故障已复现。
- hook 的 cleanup effect 不依赖 Controller identity；`ActiveRecording.draft` 仅记数字 revision。更换 Controller 后数字 revision 相同是否会应用旧 final，需要同 revision、不同 owner 的 deferred 回归；当前按线程 restore 通常增 revision 的保护不能替代 owner 检查。
- 公开 return 只有 toggle，无取消动作。缺少“放弃录音/转写且保留合法当前草稿”的行为与失败后重试证明；停录完成与取消应分开。
- final/live 行为已存在，但缺系统权限、真实麦克风/编码及 App Server/ASR 到用户可见结果的产品 Gate。synthetic 音频与 mocked ASR 不能声称识别质量或原生权限已验证。

有效测试与护栏现状：

| 资产                                          | 当前能证明与应保留内容                                                                                                                       | 缺口                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `InputbarCore.test.tsx`                       | current 录音按钮；mock MediaRecorder/getUserMedia 下录音禁 Enter/send；fake timer/audio sample → mocked ASR 的 live 草稿写入                 | 没有真实 OS 录音；未覆盖 permission 双请求/旧 reject、独立取消、owner 切换 final 与完整失败重试 |
| `composerDictationDraft.unit.test.ts`         | live/final 同区间替换、中英/emoji、周围 atom/附件/路径/paste 不丢；用户改写/新资源/恢复/clear 改 revision 拒绝迟到结果；空结果后仍可正常应用 | 没有跨 Controller identity 同 revision、录音状态机/权限/codec/IME 的证明                        |
| `asrProvider.test.ts`                         | current transcribeAudio/polishText RPC 与结果；旧录音/输出入口 fail closed，不调用旧 Host 命令                                               | mock client 不能代替真实 App Server/ASR 执行                                                    |
| `mainWindowPermissions.test.ts`               | 主窗口媒体申请/检查规则及已实现 clipboard 策略                                                                                               | 不是系统授权弹窗、音轨或录音产品证据；不需为此次实现放宽 permissions                            |
| i18n `types.test.ts`、`loadNamespace.test.ts` | 现有 dictation keys/types/namespace 合同                                                                                                     | 新增 starting/cancel/retry 文案需覆盖五语言与稳定交互回归                                       |
| `legacySurfaceCatalog.json/.test.ts`          | 已删除 Voice preview/device UI、Renderer voice shortcut facade、旧 Host 快捷键命令与 API device helper 回流守卫                              | 守卫有效；不能因上游 global dictation 字符串恢复这些 dead 入口或 mock                           |

本次只审阅以上资产，没有重跑测试。历史主 Composer Gate 不作为本轮 voice 产品验证；
仓库中有现成测试不等于其所有 pending/final/失败路径已被覆盖。

最小可实施切片：

1. 沿 current hook/Controller 加明确 starting 和 cancel 生命周期，统一捕获 generation 与 Controller identity，对迟到 permission success/error、live/final/polish 都验证同一 owner；不创建第二录音/转写后端。
2. 先保留现行“结束录音 → 插入 → 显式发送”路径，区分取消与结束。取消清理音轨、timer、sampler，拒绝迟到结果，回滚仅属于该 session 的插入且不覆盖后来编辑；若需要 PM mapping/IME延迟，在唯一 Controller 内落职责而非拍平 JSON。
3. 补 deferred 权限/取消/final/owner 切换回归、有效旧正向回归与五语言；冻结后以真实 Electron、current RPC、音频输入及可见草稿/显式发送读回获取分级证据。真实麦克风/系统授权仍单独标注，fixture ASR 不冒充 live 识别。

## 状态和交接

| 范围                                                                  | 分类 / 完成边界                                  |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| Controller/EditorView、dictation 录音与 current RPC、revision 防迟到  | current，已有能力；本次未修改或重新验收          |
| link/code block 序列化/编辑、dictation starting/cancel/owner 生命周期 | 待实施；静态确认缺口与待复现风险已分别记录       |
| 全部 rich PMU marks、全局听写/native/realtime、系统权限和识别质量     | unknown / 本次域外，不用基础 schema 或文件名反推 |
| 旧 textarea、旧 Voice preview/device/shortcut/Host facade             | dead / deleted，保留有效回流守卫，未新增 compat  |

本次有边界研究与映射完成；本页范围产品实施完成度 **0%**，真实 Desktop 验证 **0%**。
只做文档格式、链接和原成员/锚点校验，不运行无关全量测试，不将静态补证写成全产品对齐完成。
