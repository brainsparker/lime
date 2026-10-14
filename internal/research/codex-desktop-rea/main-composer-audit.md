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

| 上游职责 / 锚点                                                                         | Lime current owner                         | 对齐范围                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `xc` export `[2384511,2384519)`；wrapper `[1410893,1411176)`；`rpt` `[1411176,1427548)` | Inputbar / useInputbarController           | adapter、scope、生命周期；不机械迁压缩名                                                |
| `Qft` `[1364761,1409306)`                                                               | InputbarCore / useInputbarSend             | 草稿、附件、model/mode、history、queue/steer、submit、voice 组合                        |
| `ft/Rhl` provider；`DBc` `[10301258,10301696)`；`jBc` `[10302274,10326275)`             | useComposerController / ComposerController | 唯一结构化 draft/intent owner；开发源码类名 unknown                                     |
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

- 上游 scoped JSON document retention keys 为 `composer-retained-documents-v1` / `composer-prompt-drafts-v2`；key、存储 owner、client/canonical scope、dispose与提交保护见[保存补证](composer-draft-persistence-audit.md)。真实重启/耐久性/附件保存仍 unknown，Lime 尚未实施持久草稿。
- Lime 已有 draft revision commit 和 inputRestoreEpoch；提交失败保留草稿、旧回执不清理新输入，不能报告为整套保护缺失。
- 完整 marks/code-block/link、按线程/跨重启 persistent rich draft、staged worktree、系统 voice 和 Queue durable active handoff 仍需逐项关闭；当前 schema 与 in-memory scope 不等于完整 Composer 已复刻。
- 主题、多模型与首页 Banner 为用户明确保留项，均不复制 runtime/read model owner。

原始 Evidence 和只读 findings 位于 `~/.local/share/rea/analyses/codex-desktop-2026-10-13/` 的
`composer-editor-*-evidence.json`、`composer-editor-export-view.json`、`composer-editor-findings.json`
及 `composer-editor-controller-observations.json`。仓库只保留映射与 identity，不纳入参考应用源码。
