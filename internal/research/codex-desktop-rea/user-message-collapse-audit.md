# 已提交 UserMessage 正文与整条折叠补证

状态：current / 有边界的静态合同已查证，本次不实施 Lime 产品迁移。日期：2026-10-14。

已读普通本地 opening UserMessage 路径按 `text` 字段聚合正文，再对整条用户消息做默认 20 行的高度折叠。与 Lime 取证时源码的明确差距包括长用户消息的整体展开/收起，以及末节补证的正文内联引用消费；大 paste 显示全文本身不能判为差距，也不足以要求逐 paste chip。

## 目标与证据身份

目标为 `/Applications/ChatGPT.app`，显示名 ChatGPT，bundle ID `com.openai.codex`，版本 `26.1007.30912`、build `20156`。沿用 [研究报告](report.md) 与 [证据索引](evidence-index.json) 的身份。原 ASAR SHA-256：`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。

整条折叠部分复用已完成的 `/tmp/lime-rea-user-message-findings.json` 和 `/tmp/lime-rea-user-message-report.md`；末节复用独立完成的 inline findings/report。本次文档落地不重新执行 REA、不运行目标。REA 保留结构/成员/export 身份；下文行为来自已记录的同摘要原文件普通 AST 与静态阅读，不提升为运行证据。

| 范围                         | Evidence ID                                                           | 读取量 / 覆盖                          | 状态                                                    |
| ---------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| 两个原成员 parent            | `ev_8124ca8c62d209e83043e6eb137c7fb2e39aabc6dd19fef9d6720e6f68038b34` | 33,245 bytes；11,149 AST nodes         | structural complete；semantic unknown；parse failures 0 |
| 八个 exact inert 声明 parent | `ev_58ff0f7d9967eced25180e434ba4986a6aec778b29a75139e54a42b63e88517f` | 33,565 bytes；11,766 AST nodes         | structural complete；semantic unknown；parse failures 0 |
| renderer item view           | `ev_54b21e5816408ef4a153892b16571ae76415a30d9b2b70574a0b795fe9148133` | 1/40 项；exports `a/c/i/l/n/o/r/s/t/u` | complete-within-view                                    |
| collapse item view           | `ev_167b72ae70d5a26490b93789868ba7b52d90c4458c361d5a84154dbf3e552ad8` | 1/40 项；exports `n/t`                 | complete-within-view                                    |

两个 item view 的 parent 均为 `ev_8124…`。renderer node 为 `jag_node_b23dfc4f0d1bf9c32727d89b3175ab593b400e29c52cd5c9dc55b6c509eb8d6b`；collapse node 为 `jag_node_1ef4749b080af9e4b2c99e8fbfb833994243586f0b5bdfcee02cc2324378a861`。复用 local-thread/context Evidence `ev_7e96cf795451f834a7bddc70daacbc950320070656781f6347f1cf9c759e4299` 与 primary Evidence `ev_18100ea823ab540f529ba756499161870e17f824267ed48a0665d3fb48cd0bb4`；后者语义为 partial。

八个 scoped 声明缺少原 import/bootstrap，不是完整模块或 export 语义证明。`complete` 只覆盖所选结构，不能证明 runtime 可达。下列成员均在 `webview/assets/`；原记录的八个 SHA 校验一致。

| 代号 | 原成员                                             | SHA-256                                                            |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------ |
| U    | `user-message-dd2539189e70.js`                     | `66184e5b9b1fab3a7dc365418d061f9b7e64afaf6fc5aa01c3150fb7b09660b4` |
| C    | `collapsible-user-message-content-2e9b4cb2b9b4.js` | `4a132bad5f4431ba5b5ed3b9e1e032e66d5ca096e3a25a14daee116e6aa91e65` |
| L    | `local-conversation-thread-c8c5e92ea89e.js`        | `ee192ab3f19d493d64580f7690c94b05c589fe59c1757984e1c5a076976a47eb` |
| T    | `local-conversation-turn-632904a8790c.js`          | `f16c75de8c65e6849f3976cc8e0efec198e7b063ec81ce514ff85b348967b376` |
| R    | `sites-end-resource-78b98c374310.js`               | `4897e9b701726b0874a5036157ea32eb85932a04669ab9e205b820623f8be4a3` |
| S    | `app-shared-8bd9d0399038.js`                       | `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245` |
| P    | `app-primary-6f60e9ac4103.js`                      | `7fe9c00b03cb1de3ebc3a4bf298fc44b13a7fe67ca9cc335a9e2ecda969a1321` |
| A    | `user-message-attachments-178fc2e1502f.js`         | `94aca1d2af52788a45bf7647912c6162b9a59f7d3ab284c35cae591f4f7c8506` |

A 只查附件模块边界，不支撑普通 text/Skill 结论。所有 offset 为**原成员 UTF-16**，区间为半开；不是格式化源码行号。

## 身份与名称边界

| 原绑定        | export 锚点 | 已读原声明范围 / 职责                                       |
| ------------- | ----------- | ----------------------------------------------------------- |
| U `Ft as t`   | `28032`     | `[14655,27493)`；通用已提交用户消息                         |
| U `gt as r`   | `28016`     | `[5121,5994)`；字符串正文与折叠 wrapper                     |
| C `v as t`    | `5057`      | 默认行数锚点 `w=20` 位于 `4773`；整条消息折叠               |
| S `owr as f6` | `8100228`   | `[4979860,4982567)`；typed input 到 user-message projection |
| S `d1 as u6`  | `8123916`   | `[4984671,5003537)`；turn projection                        |
| R `vO as w`   | `413058`    | `[325545,327090)`；turn item renderer wrapper               |
| P `u6e as Hd` | `2375809`   | `[714545,716132)`；字符串 Markdown renderer                 |

REA module view 确认 U/C 的 export 名；压缩绑定由已记录的 exact 原 AST/export 阅读配对。S/R 的原 export 绑定不是 scoped 声明分析产生的完整模块证据。

`collapsible-user-message-content` 是确认的 member stem；`v` 是压缩局部名，`t` 是确认的 export。报告中的 `Collapsible` 是职责称呼；现有两份产物没有它的 diagnostic/displayName/style 精确锚点，不能宣称恢复了开发时组件名。`CollapsibleUserMessageContent` 只是由 member stem 衍生的描述性名称或 Lime 候选名，**不是 confirmed upstream export**。Lime 可在现有 message renderer owner 内选择短领域名，无需把该描述性名称固化为公共 API。

## 最小静态合同

普通本地链为 `typed input → S d1/l1/owr/Hm → user-message.message → R vO/nO → U Ft → U gt → P Hd → C v`。T 的 ``case`user-message` `` 在 `20276`，导入 `w as Ua` 在 `4344`。R 普通分支消费 `n.message`，空正文可有 override；`let e=n.message.trim().length===0` 在 `302441`，`messageContent:n.questionReplies` 在 `309899`。已读普通分支不覆盖 `collapsedLineCount`。

| 已记录节点与原范围        | 静态观察与边界                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S `Fm [338161,338513)`    | 恰好一个 text element、UTF-8 byteRange 覆盖全文且 placeholder 以特殊前缀开头时解析 appInput JSON；前缀定义 ``Mle=`codex-untrusted-app-input:` `` 位于 `339037`。普通 `[Pasted text …]` label 不满足它。 |
| S `Hm [350520,351229)`    | 聚合 `t.text`；`o.push(t.text),s.push(n?.message?.text??t.text)` 在 `350932`。独立 skill/mention rows 未在此段变为正文 chip，image/localImage 另计数。                                                  |
| S `l1`                    | 普通 opening input 交给 owr；当前两份产物没有单列 l1 的原范围，外部消息支路未穷尽。                                                                                                                     |
| S `owr [4979860,4982567)` | 正文消费 Hm 的 displayRawText；已读投影未向 Ft 传原 typed 数组或普通 text_elements。                                                                                                                    |
| R `nO [296758,323118)`    | 普通 body 传字符串给 U Ft；已读自定义 messageContent 是 questionReplies。                                                                                                                               |
| R `vO [325545,327090)`    | item wrapper 委托 nO/bO；不是所有消息来源都已核对。                                                                                                                                                     |
| S `DLi [6763148,6764149)` | 比较真实内容高度与 `lineHeight * collapsedLineCount + 1`；超限初始 collapsed。                                                                                                                          |
| S `kLi [6765112,6765411)` | 配合折叠处理不可见互动元素的 inert；真实键盘行为尚未验证。                                                                                                                                              |

U Ft 的默认 body 经 gt 把同一 text 交 P Hd，再外包 C。C 提供 Show more/less、`aria-expanded`（`3500`）、`maxHeight:`（`2698`）与默认 `w=20`。这是整条用户消息的显示控制，不是每个 paste element 的独立折叠。具体截断/ellipsis 策略没有在当前两份产物沉淀，不能将“阈值 20 行”扩写为“恰好可见 20 行完整正文”。

## Lime 取证时差距与 current owner

以下沿用已完成 findings 的源码观察；后续产品迁移与验收状态由对应执行计划记录，不将本次只读审计当作迁移完成证据。

| current owner                                                                                                                                                                                                                                                                                        | 已记录观察 / 对齐结论                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ComposerController](../../../src/components/input-kit/ComposerController.ts#L244)、[buildUserInputSubmitOp](../../../src/components/agent/chat/utils/buildUserInputSubmitOp.ts#L129)、[agentStreamSubmitDraft](../../../src/components/agent/chat/hooks/agentStreamSubmitDraft.ts#L83)              | 提交展开 paste 全文并保留 textElements/inputMentions；wire 有 text_elements 与独立 skill/mention。保留该结构化合同，不能从 renderer 观察改写 wire。 |
| [MessageListItem](../../../src/components/agent/chat/components/MessageListItem.tsx#L566)、[MessageUserBody](../../../src/components/agent/chat/components/MessageUserBody.tsx#L32)、[messageListUserContentState](../../../src/components/agent/chat/components/messageListUserContentState.ts#L64) | 正文消费字符串和单个 inputCapabilityRoute；installed_skill 标签不是任意 inline mention 身份的完整回放。                                             |
| [用户 body](../../../src/components/agent/chat/components/MessageUserBody.tsx#L53)、[messageListItemProjection](../../../src/components/agent/chat/components/messageListItemProjection.ts#L718)                                                                                                     | 已读用户正文没有整条高度折叠，长历史折叠条件限定 assistant；补齐工作归现有 message renderer owner。                                                 |
| [canonical hydrate](../../../src/components/agent/chat/hooks/agentChatHistoryThreadItems.ts#L43)、[local merge](../../../src/components/agent/chat/hooks/agentChatHistoryLocalMerge.ts#L484)                                                                                                         | 前者消费 content/text/message 与 images，不生成用户 contentParts/route；后者另保留 inputCapabilityRoute。不能泛化为所有技能信息永久丢失。           |

## 剪贴板宿主补证（2026-10-14）

复用同一ASAR与既有main Evidence，按已保存inventory的offset/size读取 `.vite/build/main-CqEoQDOU.js`，成员SHA-256核对为 `09d19386e1f23cf4ccbc950fc40d85a1e8a064a08be588b2a4be6a89f6ada9e6`。以下是新增的有界手工文本观察，不是新REA语义结果或运行证据，未执行目标代码：

- 原成员UTF16约862178/862220处的宿主类提供 `readText()` / `writeText(e)`，分别委托Electron main clipboard。类绑定 `cS` 与继承绑定都是压缩名称，未恢复开发时owner名称。
- 352479附近的 `clipboard-sanitized-write` 放行位于MCP app sandbox的受控session、origin与窗口条件中，不能据此推导主GUI的权限策略。另一个browser session在1533217附近同时设置拒绝的request/check handler。
- 主GUI复制按钮到该宿主服务的完整caller链尚未核对。不能把宿主服务存在当成已证明普通UserMessage复制经该路径，不能把sandbox权限策略移植到主窗口。
- Lime实际复制是否写入全文由真实Electron按钮与main clipboard读回证明；当前失败、定位与修复见主执行计划。native write异常被Lime复制handler捕获，console/page errors为0不能代替复制成功断言。

## Lime 可实施的 20 行合同

以下是基于已确认静态阈值提出的 Lime 实施与验收要求；运行行为尚未验证。写集应限定现有用户正文 renderer 及必要的虚拟列表测量接点，不改变 Composer wire、草稿或逐 paste atom。

| 合同                         | 验收边界                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 默认 `collapsedLineCount=20` | 以真实布局内容高度比较 `20 * lineHeight + 1 px`；仅严格超限才初始收起。测量全量内容，不按字符数或换行数估计；临界值上下各 1 px、软换行与 Markdown 都要覆盖。 |
| 折叠只控制显示               | 保留完整正文及其 canonical 身份；展开/收起不重新提交、不修改消息或 text_elements。精确截断/ellipsis 由 Lime 设计确定，不宣称已复刻上游。                     |
| 展开/收起与可访问性          | 使用可键盘操作的按钮，状态同步 `aria-expanded`；被遮挡的互动内容不进入焦点序列。用户文案覆盖五个已有 locale，验证键盘与辅助技术。                            |
| 测量随布局更新               | 正文、字体、容器宽度或资源布局变化后重测，避免残留高度；重测尊重用户的展开选择。稳定短正文不出现展开按钮。                                                   |
| 复制保留全文                 | 折叠和展开状态下都从完整正文复制；长 paste、Markdown、Unicode 不因裁切而丢字或变成 placeholder。                                                             |
| 列表尺寸与滚动               | 展开/收起后通知现有列表测量，验证历史恢复、resize 和相邻消息不会重叠或跳错位置；在真实 Desktop 路径验收。                                                    |

## unknown、下一切片与验证

本轮没有真实长 paste 提交，也未穷尽 Codex paste producer→wire。若 wire text 含全文，这条 renderer 按全文消费；若 wire 仅占位串，不能凭本切片补出全文。下层 P `Hd:u6e→FC/LH extensions` 的专用 Skill/plugin/app 链接 consumer 已完成[独立静态补证](#正常正文内联引用静态补证)；裸 `$skill/@name`、producer→wire→history 和真实互动仍 unknown。

server steering、外部/云消息、Aeon、questionReplies、后端/历史/重新编辑中的 text_elements 用途未穷尽。真实窗口宽度、默认折叠触发、复制全文、键盘与屏幕阅读器效果未验证；没有 Electron/Codex 运行或 GUI Gate 证据。下一切片可核对正文引用 producer→wire→history 与复制回贴保真；S d1 的 server userMessage 和 l1→Nmn 外部支路仍是独立未知范围，不凭命名猜行为。

写集仅本文件。引用检查对照已完成 findings/report 的目标、Evidence、八个 member SHA、23 个精确锚点、已记录 slice 边界及 Lime 本地链接；运行 Prettier check 与定向 diff 检查，不重新采集源码或运行产品。

分类：研究文档和既有 Lime renderer/Composer owner 为 current；本次无 compat/deprecated/dead 新入口或删除。完成度：本次有边界静态审计记录 100%；本次产品修改 0%；真实交互验证 0%。

## 正常正文内联引用静态补证

日期：2026-10-14。复用 `/tmp/lime-rea-user-message-inline-findings.json` 和 `/tmp/lime-rea-user-message-inline-report.md`，范围仅普通本地已提交 UserMessage 的字符串正文。**已确认实际专用 Skill/plugin/app consumer**；前述 typed sidecar 不直接交给 Ft 的观察仍成立，但正文的 link token 可以进入另一条专用渲染链。

### REA 身份、成员与普通 AST 的分工

REA CLI 曾对既有 primary parent `ev_18100ea823ab540f529ba756499161870e17f824267ed48a0665d3fb48cd0bb4` 取一个 item view：`ev_1765906e19186fbefd6b7d3fe07244f835099802d66645ca2b9c452979fcc6cf`，node 为 `jag_node_727299a63764f56e43af933a0444a20c47b6f5363a9541f9fd171e06c96618a5`。该项是 `module-export:Hd` 身份，1/1963 项、complete-within-view；item 的 `exports` 数组为空，身份来自 namespace/key/observation，不能把它改写成完整 export 枚举。parent 仍有 116,907 semantic unknowns，该返回形状仍因 SequenceExpression 为 unknown。

本切片沿用上表 U/P/S 的原成员 SHA，并加入 I：`webview/assets/app-initial-6350d04672d0.js`，SHA-256 `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`。完成产物记录四个成员 SHA 一致、12 个 exact export、10 个 import、30 个原声明范围、37 个精确锚点与普通 AST parse failures 0；不是新增的全应用分析。

以下连接来自普通 exact 原 AST 与静态阅读，没有对原 initial/shared 做完整 REA 语义分析；**手工确认的 consumer 链不是 REA 完整语义或运行证据**。最小绑定如下，位置仍为原成员 UTF-16：

| 连接                          | exact import / export 范围                                     |
| ----------------------------- | -------------------------------------------------------------- |
| P FC → I bi:isl               | P `bi as FC [57484,57492)`；I `isl as bi [11380226,11380235)`  |
| I Il → S Ybt:VZ lexer         | I `Ybt as Il [115487,115496)`；S `VZ as Ybt [8088341,8088350)` |
| I Yd → S gH:Z6r classifier    | I `gH as Yd [121958,121966)`；S `Z6r as gH [8102044,8102053)`  |
| I vu → S aQ:YVr identity 属性 | I `aQ as vu [117607,117615)`；S `YVr as aQ [8092773,8092782)`  |

### 正常正文的最小消费合同

静态连接为 `U gt → P Hd:u6e → I bi:isl/osl + P LH → S Ybt:VZ lexer → I Nnl/v6i/x6i(link)/q3i → I Enl(esl.a) → I m7c(Yd:S Z6r) → Skill/plugin/app`。箭头表达已读参数、slot 和分支消费，不表示观察到真实调用顺序。正常 gt 未覆盖 `pluginMentionPresentation`，Enl 默认 `interactive`；各分支还有能力、目录和 metadata 条件。

| 节点与原范围                                           | 静态观察 / 合同                                                                                                                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P `RH [713209,714545)`                                 | LH 的 composerLink 把 `[label](path)` 转成 link token，保留解码 label/path；bare `$sites` 由独立 sitesPluginMention extension 转为 plugin URI。不能扩写为所有裸 `$skill` 都被识别。                                  |
| I `q3i [5169051,5169252)`、`Enl [10884622,10885542)`   | link token 实际使用 `components.a`，传 href/title/label/tokens；Enl 的 a consumer 委托 m7c，未匹配时保留外部链接 fallback。不是仅有未消费的分类字符串。                                                              |
| S `Z6r [5549741,5550093)`、I `m7c [10790552,10792952)` | classifier 先识别专用 URI 类型；剩余 href 中，label 以 `$` 开头且 `mxr(href)==null` 才归 skill。m7c 的 skill/plugin/app 分支分别调用 q3c/X3c/Y3c；browser-skill 明确返回 null。                                      |
| I `q3c [10702887,10704714)`                            | 带 conversation/host 请求 skills；有 href 时按 `gf(skill.path)===gf(href)` 匹配，无 href 时才按 name/display-name 匹配，仅一个结果才绑定 resolvedSkill。原 path/URI 与显示 label 分开保留。                          |
| I `J3c [10704714,10706450)`、`FBc [10326615,10328707)` | 选择显示 label/icon/tooltip，生成专用 `inline-mention` span；未满足打开条件时仍可显示 k7。gallery/local-SKILL-definition 条件满足时交 e6c，带准确 path/cwd/hostId 与 side-panel 参数。                               |
| I `e6c [10713174,10718335)`                            | 可打开形态有 role button、Enter/Space/click consumer，经 JG/Zq 处理目标。静态存在不能证明已安装、侧栏可用、点击成功或执行 Skill。                                                                                    |
| I `X3c [10708065,10711100)`、`Y3c [10706450,10708065)` | plugin 使用 `plugin://` 引用、host/cwd/roots 查 metadata，并按解析结果选择导航；app 使用 `app://` ID/host 查 metadata。能力或解析失败有文本/标签 fallback，不是所有 mention 都可点击。                               |
| S `YVr [5269185,5269265)`                              | 携带 `data-prompt-link-href` 与 `data-prompt-link-label`；Skill/plugin/app 标签或交互 wrapper 保留这些属性。Nnl 注册 copy→EBr/DBr，写 `text/html`/`text/plain`；selection/DOM transform/回贴的完整身份保真仍未闭合。 |

`m7c/q3c/J3c/FBc` 等是成员压缩符号，未恢复开发时组件名。`composerLink/sitesPluginMention` 是确认的 extension name，`inline-mention` 是确认的 appearance 值；这些不是上游公开组件 export。上文折叠成员的 `v as t` 身份边界仍适用，不把描述性的 `CollapsibleUserMessageContent` 变成确认名称。

### Lime 取证时同义 owner 与限制

| current owner                                                                                                                                                                                                                                   | 本次源码观察 / 最小接点                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [composerSchema](../../../src/components/input-kit/composerSchema.ts#L21)、[composerSerialization](../../../src/components/input-kit/composerSerialization.ts#L57)                                                                              | 已有 mention atom 的 id/kind/name/path/label 与 typed wire；正文消费 label 并另保留 typed mention。它们是输入身份 owner，不能直接当已提交正文的同义 consumer；上层 label 是否含序列化语法尚待 producer 核对。 |
| [正常用户 body](../../../src/components/agent/chat/components/MessageUserBody.tsx#L59)、[MarkdownRenderer](../../../src/components/agent/chat/components/MarkdownRenderer.tsx#L814)、[HTTP 外链](../../../src/lib/markdown/externalLinks.ts#L8) | 已读正常正文走 GFM/Math、通用 URL transform 和普通 anchor/HTTP 打开；没有上述 href/label 分类、目录解析、专用 inline mention、身份属性和条件导航合同。补齐归既有正文 renderer owner。                         |
| [installed_skill route](../../../src/components/agent/chat/components/messageListUserContentState.ts#L64)、[单个技能标签](../../../src/components/agent/chat/components/MessageListUserContent.tsx#L41)                                         | 单个 route 标签及纯正文不等同任意正文 Skill/plugin/app 引用回放；此结论限定已读 owner，不宣称全仓不存在相关能力。                                                                                             |

实施前先明确 canonical 消息中的正文范围/URI/typed references 的权威投影，复用既有 Composer 身份与 renderer。未解析或歧义时保留展示，不凭任意 `$` 文字绑定已安装 Skill；本切片不要求修改 wire 或把全部 label 伪装成 Markdown。

仍 unknown：producer→wire→history 是否实际采用该链接语法；bare `$skill/@name` 与 plain-text decoration；完整 URL/path normalization、catalog/query 时序、远程 host/readiness；selection/HTML transform 对身份属性的保存和回贴；真实窗口、点击与键盘效果。没有扩展到云/外部全部支路，也没有 GUI Gate 或 E2E 完成声明。

本节只复用完成产物，验证目标、Evidence、成员 SHA、所列原范围/绑定及 Lime 本地引用，并执行 Prettier 和定向 diff 检查。研究与既有 owner 为 current；无 compat/deprecated/dead 新入口或删除。本次静态问题“是否存在实际专用 consumer”已回答，产品修改与真实交互验证仍为 0%。

## 2026-10-19：提交链补证与重复徽标清退

REA95 `ev_6abdbfee18fb272f9557c8be99713836061a6982671dea18ba36ca57c6b87cf1`认证initial/primary/shared原成员摘要，提取Put/fut/Zs/wta/Hm/Eln/Ccn/n2/GVr/KVr十个完整声明（22149bytes、6370 AST、parse0）。[原件范围与摘要](../../exec-plans/artifacts/codex-shared-page-header-20261018/submitted-mentions-extraction-95.json)及[完整Evidence保全摘要](../../exec-plans/artifacts/codex-shared-page-header-20261018/submitted-mentions-bundle-manifest-95.json)可追溯；全部静态、未运行参考应用，未解析的上下文/transport支路不能提升为完整producer到wire证明。

补证确认n2将label/href格式化为Markdown链接；Put从Controller取得正文并委托buildLocalContextForPrompt，wta独立保留本地消息text。Hm仍只聚合text rows；独立skill/mention元数据不直接产生展示标签。不能从GB的单个text字段推出整个GUI最终提交只有裸`$name`，也不能从typed Skill元数据反向生成无path的`@`徽标。

Lime93根写集已删除resolveUserMessageLabels、UserInstalledSkillMessageContent和对应额外标签循环，未改写canonical正文/元数据。旧正向标签期待迁成负向回流断言，图片、长正文折叠、全文复制与精确Item/Turn身份继续覆盖。消息3套38项、复制3套33项及strict lint通过；独立候选产品验证尚待。当前链接serializer/consumer、条件打开、粘贴身份及全GUI仍partial，旧审计中的取证时owner仅作历史观察。

REA96 `ev_39097e6ae3706546f0f855f241d5faabb6160b473899103b147080aafd9cc3fa`认证并提取m7c/q3c/J3c/FBc/e6c/X3c/Y3c/Z6r/YL九个完整声明（18278bytes、7615 AST、parse0），完整Evidence gzip逐字节回读保全。分类依据href与label；Skill按规范化path优先，否则name/displayName匹配且只接受唯一结果；无目录无href时保留文字，不伪造安装项。打开技能文件还要求本地同host、非远程、可识别Skill定义文件或真实模板目标；加载中的元数据不抢先打开。App与Plugin各自使用current catalog/host/readiness，不由任意文字绑定。上述是静态消费者合同，依赖仍有未解析分支，未执行参考，不能声称全部catalog/remote/点击分支已穷尽。

93独立通过8套102项、标准GUI、真实rich与54观察/48截图，删除sidecar徽标已取得冻结字节产品证据；manifest SHA `19f8612ab7147a96c9f94395a87b21450e8d781e05974d2666061b9519c87b65`，sourceDrift空。94仅补PM leafText可见文本，根112项及lint通过；它不实现内联引用consumer。

94已结算passed：11套150项、strict lint、完整types/contracts/i18n/治理、新Renderer、标准GUI、真实rich及54观察48截图通过；sourceDrift空、freshness前后ready、Main正常退出。10134源/325产物manifest SHA `67068b0804a774aae5f51b3008499f93eb93077df40766bf5781a1f1fe52694b`，已查看dark/thread最终截图。

95实施：REA96/97的Skill consumer→skillPromptLink、PromptLinks既有useLimeSkills目录接线、SkillPromptLink与Markdown的remarkPromptLinks；canonical用户正文和MessageUserBody共用。composerMention glyph与inlineMentionStyles共享，删除原Composer重复样式，无alias/第二目录store/backend。保留原label/path属性、只接受唯一目录、loading/缺失/歧义只读，只有current本地已识别定义文件可经现有artifact/file owner打开并带原itemId。原路径先于Markdown URL transform保留；普通HTTP、code、危险URI不绑定。根首轮77项通过；新增资源路径原2失败/26通过保留，修正HAST属性名称后28项通过，独立新Renderer/桌面待验。完整链接serializer、plugin/app、gallery/custom icon、remote/原生平台与全GUI仍partial。


### 96：正文引用词法校准

95已结算failed：风险测试、完整预检、新Renderer、标准GUI和真实rich通过；54项Composer观察后，新增真实提交回合interrupted，模型收据只有GET models。截图另暴露多条$Skill被remarkMath吞入数学节点；两项均不算通过。sourceDrift空、Main正常exit0/signalnull且无强杀，325产物manifest SHA 5b2ec7c6664c61b27f5395a861c6eff3d3aa556cf3bb356fa7f9ab43ea1a39ff，原截图/收据不可变。启动器源码确认backendMode默认unavailable，Rust UnavailableBackend拒绝start_turn；不是provider端口已被证实故障。

REA98/99补证：RH的composerLink在词法阶段优先于Math，原始label独立于渲染children；lcn允许路径空格和转义闭合符，qVr/aH分别解码label/path。98 Evidence ev_8bd6d2b1ec01c1cdd03ecf68f8fce75c9f4bd9270ef1a838da6269fb01b00697（9声明2575bytes/920AST）；99 Evidence ev_835761eb2518d6b90986a82a96730e8d6af7f22f813ac724ae99c2d4256804f0（5声明1930bytes/629AST），parse0，完整JSON gzip逐字节回读保全。98的QVr/$Vr只有未初始化声明，常量值仍unknown；全部静态、未运行参考。

96根实现：remarkPromptLinks由解析后遍历直接替换为现有remark管线的micromark/fromMarkdown扩展；composerLink复用已安装marked处理native title，再按REA scanner识别资源路径；MarkdownLink接管原inline anchor分支并读取原始label，不留旧分支/alias。格式标签、Unicode/空格/Windows路径、反斜杠/括号、多引用与独立数学、code/escape/image和普通HTTP回归共6套70项通过，原4失败/7通过保留。早期96格式标签red用已解析目录却期待原格式，期望本身不符合consumer；后继改为unknown path并按REA99保留原始label，不能将该旧red当产品缺陷证明。新字节产品验证仍待。

current仍是既有Markdown/Skill catalog/文件owner；新增compat/deprecated为0，旧AST-only引用遍历与inline anchor重复分支已替换。全GUI仍partial，真实新字节验证归Composer计划Contract96。


96独立候选已结算failed-before-build：13套风险测试和strict lint通过；正式types发现remark插件的Processor<Root> this与Pluggable不兼容，以及缺失remark-parse的Data类型扩展。sourceDrift空；没有Renderer/Host产物，不伪造artifact manifest或GUI通过。原类型日志及收据SHA保全在candidate-context-types-failure-96.json。97只修this为项目统一Processor并补type-only remark-parse导入，不改变运行行为或放宽tsconfig；从failed96/sourceDrift0精确叠加该文件及六事实源。Contract96全部产品/退出要求继续有效。


REA100补查提交转换：Evidence ev_74cb2596e3f2d7ec0a59e811e829e9ae7861602d0d68a7b424fd4a148a0e40a7，4完整声明2040bytes/594AST、parse0，gzip SHA 4d15859af49e6f80d4de89cbc4fb982d0ac968d791d86a2b2d99862b9077485c，原字节回读保全。Dle普通分支输出context prompt和空text_elements；untrusted/MCP分支另有整段byteRange与placeholder合同，不能混同普通mention；Osn追加image/comment输入。联合REA89 GB、92 WB、95 Put/Zs/fut/Ccn/Eln可确认正常Skill label/path经过Markdown格式化进入prompt，而本地optimistic plain text独立。尚未穷尽特殊附件/全部wire分支，未运行参考。Lime当前serializeComposerDocument仍发送裸label及typed元素；下一刀必须保持canonical路径身份、UTF8范围、失败保稿和恢复，并验证共享runtime对带空格/转义路径的解析，不能凭TUI推断Desktop。当前Rust explicit_candidates的空白拆分是只读发现，尚未迁移；不先删typed身份造成绑定回退到名称。


97结算：13套161项、strict lint、完整types/contracts/i18n/unused/scripts/legacy及新Renderer通过。原runner在复用Host时误将95产物的sourceManifest与96源码比较，失败收据保留；recovery1认证原10步日志/源码/Renderer且改为95自身摘要，从未跳过失败产品门禁。标准GUI通过，rich全部business/assertions通过且零console/page错误，但Main原15秒正常退出超时，失败回收SIGKILL；整轮仍failed，不能称正常退出。10144源/325产物冻结manifest SHA 3ca5b1abcae5cf283e6f05a8c8a265acb453cd3aa79c11b4743fa4ab3e882239，sourceDrift空。尚未执行的matrix另立独立收据执行；其结果不能覆盖原rich退出失败。退出根因尚未定位，不归因于本次词法变更，也不放宽deadline。


97独立matrix的54项Composer观察已完成，真实截图显示4条引用和助手完成文本；随后采集器错误使用requests().body（实际API只返回bodySummary），finally再次Buffer.byteLength(undefined)导致原错误与正常退出收据未落盘。independent-context-matrix-verification-97.json明确failed；原summary的running只是最后检查点，不是存活或通过证据，原日志/截图保留。不能从截图推断后续copy/file或正常Main通过。98在原fixture增加显式requestMarkers布尔摘要，真实HTTP回归证明不暴露payload/凭证；finally前保存原错误并保证始终进入既有teardown。原prompt/身份/54项、零mock与15秒退出合同不变。

REA101退出补证：认证同ASAR与main成员09d19386e1f23cf4ccbc950fc40d85a1e8a064a08be588b2a4be6a89f6ada9e6，4完整声明2345bytes/671AST、parse0，Evidence ev_ce638abaf49a49db7d0fd9ed7bef81e46f79d79bb8869d1577376980c6ea1c97，gzip SHA fb079856960b9a96edc36c52be63388d21664b26a898e253f8ab8b8df7e14946。eZe先allSettled(global/settings/tracing等flush)，再u7(flushAndDisposeContext,5000)，最后dispose与第二次quit；5秒仅约束后一个context drain，不是整个退出期限。不能据此给Lime加总超时或声称修复当前Main阻塞；实际根因仍unknown。全部静态，未执行参考。

2026-10-19 后继99：98真实runtime marker POST、同一Thread/Turn/UserItem completed、54项Composer观察、四引用和原生全文复制通过；点击Skill误走通用产物链，SKILL.md标签出现但右侧Terminal保持active，文件breadcrumb超时。98整轮failed，Main正常code0/signalnull、sourceDrift空；325产物manifest SHA `02d76b67bc369fe2a86daa8bc4d1ed4dcf349c46fabd3eebe8ce19794e1e0e96`，原错误/截图不覆盖。按既有REA96 J3c/e6c openInSidePanel与文件owner合同，99把文本类file_preview直接接到openWorkspaceFile；删除该路径的产物副本读取/注册与canvas选择，沿同一LocalState复用空Files、路径tab/contentInstance与owner epoch。无需新store/backend/兼容层；Office/媒体格式owner仍独立承接。根回归先复现1失败/17通过；初次修复误截Office六例已保全，后继按现有contentKind路由限定文本类。


2026-10-19 结算：99原轮matrix因未hover展开复制footer而被正文拦截，整轮failed且原收据/截图/325产物保留（manifest SHA a3d17d7b7cd098da1fdbda2b6a9a8df9126122ae9521c2c7529b631746e7a3c8）。同一冻结源/产物的99 recovery1只改外部采集器，复用既有prepareCopyAction真实hover/geometry后click，无force或产品注入；认证原18套212项与11步已完成门禁，重验matrix60观察及rich均passed。四引用/三主题重载、原生全文复制、click/Enter/Space进入Files及原文件不变通过；rich保留完整同一Thread/Turn/UserItem与四输入、图片原字节、取消/草稿恢复。matrix Main39255、rich Main51767均正常code0/signalnull，无强制回收，原15秒/identity/mock0/freshness不放宽；10145源/325产物冻结manifest SHA db3e1ce11fd6d103707ae84774f30da775beb583237b482851f0459e2f528586，sourceDrift空。预览区仍偏窄；97退出根因、真正atom→Markdown提交与全GUI保持partial。

102实施：REA89 GB→92 WB→95 n2/GVr/KVr的资源格式映射到既有composerLinks.formatResourceLink与serializeComposerDocument，HTTP无title链接复用相同formatter但原URL校验不变；普通Skill/file/plugin atom输出[label](path)，不再创建wire text_elements，paste/显式element按最终UTF8重算。显示/JSON草稿继续由projectComposerDocument管理；typed path身份暂保留，未迁移共享Rust文本parser。删除旧裸label提交和Skill范围正向/护栏，迁移rich独立literal oracle、资源路径负向以及正文显示名断言。根先红4例，首轮482项中2项旧恢复/手写范围期望失败保全，修正后相关110项和fixture130项通过；独立新Renderer/Gate B待验。不冒充完整wire、全部consumer或全GUI对齐。

2026-10-19 102/104更新：资源Markdown提交候选102的19套336项、strict lint/types/contracts/i18n/治理、新Renderer及标准GUI通过；原矩阵60项业务观察完成，但Main原15秒正常退出超时，整轮failed，sourceDrift空、325产物manifest SHA 725e417ad2072fcd80510e672858e9995c7590985f64829ef85701f407f082b0。102 recovery1再次完成60观察但同一退出门禁failed；7秒被动sample超时且无有效栈，不能归因或当修复证据。原件均保留，rich独立补测中；97/102退出根因open。

104沿REA103 recovery1的dzt/DC/ozt/wn合同实施文件树默认关闭、共享开关与250px临时宽度（min200/max60%）；不凭截图调整固定像素。泛化既有Host bool owner并直接删除summary专用方法，无alias；Summary、Files、Changes及Workbench消费者收敛同一typed gateway，删除每入口局部开关和true默认。Host7套193项、消费者6套44项已通过；真实桌面三主题/多宽度、保存重载与Files/Changes共享待验。`internal/exec-plans/codex-file-tree-visibility-20261019.md`。无新增业务owner/兼容层，不扩写未知Rust、发布和architecture增量；全GUI保持partial。
