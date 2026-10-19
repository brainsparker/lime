# Codex 同步问答草稿存储与生命周期

状态：静态研究完成；已据此实现 Lime 应用内共享问答草稿，产品 Gate B 由 root 统一验证。调查日期：2026-10-20。

已确认的参考合同是 AppScope 内共享的问答草稿 Map，按 host/thread/request 组合键存放，
提交与 Escape/dismiss 按 requestId 条件删除。它支持同一 AppScope 中的请求重新挂载时读取
已有 draft。Lime 的实现与定向验证见文末；参考 App 的实际导航、重启与窗口行为仍未运行观察。

## 目标与证据

目标为已保全的 Codex Desktop `26.1007.30912 / 20156`，ASAR SHA-256：
`75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
原件根目录为 `/Users/coso/.local/share/rea/analyses/codex-desktop-2026-10-13/`。

| 原件相对路径 | SHA-256 |
| --- | --- |
| `approval-artifact/webview/assets/pending-request-item-panel-770855267df2.js` | `65c883ee4c9b507b6fe86e9edd73ac0eb2e085730dfbb1f72d0761ccde22be69` |
| `composer-editor-dependencies/webview/assets/app-initial-6350d04672d0.js` | `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f` |
| `composer-draft-persistence-artifact/app-shared-8bd9d0399038.js` | `607ad0866dd25ed3764711b4467a9b60708353a599485b5249ff4cbe0e870245` |

原件摘要本次重新计算并写入 manifest。Acorn 对完整原件解析后定位 import/export 与完整函数声明，
按原始 UTF-16 source span 精确提取，没有执行 bundle 或增加模拟实现。

- 新 REA Evidence：`ev_5734ec041f1dd5e183fcd1f5a15c97b1e71e7efb9b79694d4069dd1ea7bf21c4`。
- 输入目录摘要：`177a0ce17fbb1b6b8113e9148577f9c208059bf62e8ff6ddcd732a106d2c8346`。
- 完整产物：`/tmp/lime-user-input-draft-rea-20261020/{manifest.json,input/,evidence.json,summary.json}`。
- 23 个完整声明、11,983 bytes、4,322 AST nodes、parse failure 0；application inventory 无截断/遗漏。
- semantic coverage 为 `unknown`，关系族为 `partial`，omitted nodes/relations 均为 0。
  提取输入未保留完整模块闭包；跨模块别名通过完整原件的 AST import/export 核对，不能写成 REA 已自动闭合全部调用关系。
- 逐题 UI、draft 形状与初始化同时复用既有 29 声明 Evidence：
  `ev_a908f380896c707334ef1867c231f191790e0fbe29708ec243c6a7cb5306f437`，
  产物位于 `/tmp/lime-user-input-rea-20261020/`。
- `targetExecuted=false`：没有运行参考 App，不是 Electron 运行、重启恢复或磁盘取证结论。

## 确认的符号映射

下列压缩符号只用于原件定位，不能当成上游未压缩函数名迁入 Lime。

| 调用处 | 原件绑定 | 职责与原件 UTF-16 span |
| --- | --- | --- |
| pending panel `ut` | initial export `SE` → `w0s` | `JSON.stringify([hostId, conversationId, requestId])`；9305042..9305093 |
| pending panel `Ht` | initial export `wE` → `D0s` | 共享 signal；由 `O0s` 初始化；9305284..9305354 |
| pending panel `dt` | initial export `TE` → `T0s` | 复制 Map 后 `set(key, draftEntry)`；9305093..9305166 |
| pending panel `Wt` | initial export `xE` → `E0s` | 先比对现存 requestId，再复制 Map 删除 key；9305166..9305276 |
| initial `fd` | shared export `don` → `Uk` | 在指定 scope 中构造/缓存 signal；1690719..1691032 |
| initial `q` | shared export `H0t` → `X` | `bF` 中 `X=sO("AppScope")`；2081717..2081777 |
| shared `Vk` | shared local `Vk` | 在 scope node 的 `signalBindings` 缓存绑定；1687804..1688066 |
| shared `dlt/ult/sct` | shared local declarations | scope node 创建、React provider 挂载/卸载与 disposal；完整 span 见 manifest |

`O0s` 的完整初始化为 `D0s=fd(q,()=>new Map)`。`q` 是 `AppScope` token，
`fd` 是共享 signal 构造器。它不是问题面板自己的 React `useState`，也没有使用问答工具的
Thread/Turn/Item 持久化或 provider 业务存储。

## 已观察到的生命周期

| 阶段 | 静态观察及含义 |
| --- | --- |
| 创建 signal | `Uk` 委托 `Vk("signal", scope, factory)`；首次绑定运行 initializer，新值为 Map。`dlt` 为 scope node 建立 `signalBindings: WeakMap` 和 store。 |
| 请求身份 | `Gr` 使用 hostId、conversationId、requestId 的组合键；读到条目后额外核对 `entry.requestId===request.requestId`。同线程不同 request 不借用答案。 |
| draft 写入 | `Gr.onDraftChange` 把 `{conversationId,draft,requestId}` 交给 `T0s`；每次复制 Map 并替换该 key，没有合并不同请求答案。 |
| draft 内容 | `vz` 保存 `{answers,questionIndex}`，答案包含所选选项和自由文本；初始化分别读取 `initialDraft.answers` 与 `initialDraft.questionIndex`。来源为既有 29 声明 Evidence。 |
| 重新挂载 | `Gr` 仅在同 requestId 且条目 draft 含 `answers` 时传入 initialDraft。因此在同一仍存活 AppScope、同一 identity 下，重新挂载可读取已有题稿及题号。实际导航是否维持该 scope 尚未运行观察。 |
| 提交 | `Gr` 先调用 `E0s` 清 draft，再生成 canonical answers 并调用 `replyWithUserInputResponse`。清理发生在回复调用之前，没有观察到失败后自动恢复共享 Map 的分支。 |
| Escape/dismiss | `Gr` 先调用 `E0s`，随后按明确 producer 选择空响应或普通 `interruptThread`。中断失败只接 danger toast；该回调本身没有重写共享 draft。仍挂载的问答内部 state 与共享 Map 是不同生命周期。 |
| 条件删除 | `E0s` 在条目 requestId 不匹配时返回原 Map，避免旧操作删除另一个请求。 |
| scope 生命周期 | `ult` 在 provider 生命周期管理 scope node；无保留父 scope 的普通卸载分支会调度 `sct`。`sct` 处置注册 lifecycle、family value 和 retained child scope。不能把组件卸载等同于 AppScope 卸载，也不能从这些函数推断立即内存清零。 |

`sO("AppScope")` 没有传 retain 参数；`Yit` 对未指定 autoDispose 返回 Infinity。
这只说明通用 retain delay 的默认值，不能据此宣称根 AppScope 永不卸载；
`ult` 对普通 provider 和 retained child provider 使用不同分支。

## 存储、secret 与未确认范围

23 声明显示的是 scope signal/store 与 Map 的内存数据流，没有问答草稿专用的 localStorage、
文件、IPC 或 App Server 保存调用。可以确认这里有共享 UI 草稿 owner；不能据此证明整个 App
不存在外部 hydration、调试导出或其他持久化消费者。没有运行重启/多窗口，因此不声明落盘、
跨窗口共享、进程恢复、断线恢复或完整持久化缺失。

`Gr.onDraftChange` 没有按 `isSecret` 过滤；若 secret 回答触发同一 draft callback，也会经过该
内存 Map 写入。`isSecret` 在已分析 UI 明确控制 dictation disabled，未证明密码遮罩。
此观察不证明 secret 落盘，也不授权 Lime 将 secret 草稿持久化或写入日志。

对现有保存的 JS 子集做了有界 import/export 搜索，并按原件 SHA 去重；
只有 pending-request-item-panel 导入 initial 的 `wE/TE/xE`。该搜索不是完整 ASAR 全消费者证明。
没有从这些声明闭合 server-side resolved、外部取消、超时、线程删除、关闭窗口之后的
额外 draft 清理，也没有观察到 TTL；这些项保持 unknown，不添加猜测的清理策略。

## Lime 实现映射与验证边界

`RequestUserInputDraftStore` 是唯一共享 UI 稿 owner，由 `requestUserInputDraftsAtom` 沿既有
Jotai 模式按应用 Store 独立初始化；实例内 Map 的保存和删除都复制 Map，读写答案同时复制，
不使用模块全局 Map，也不扩大根 App Provider。当前单 Desktop host 使用受控 `local` 常量，
可选 `hostId` 仅为 surface scope，不新增远端 host authority 或协议字段。

Map 按 `[hostId,threadId,requestId]` 保存 `{answers,questionIndex}`；读取还核对 requestId、
当前 turn 和题目 ID 序列，避免 identity 被替换时误借答案；缺失 scope 不共享保存。
`PendingInteractionLayer → DecisionPanel → RequestUserInputPanel` 透传 surface host，
面板在同 Store 重新挂载时读取题稿与题号，编辑、选择、跳题和导航时保存。

提交与 dismiss 在调用原回调前按 requestId 条件清稿。失败只保留仍挂载的内部编辑器，
不通过 render/effect 自动恢复共享 Map；下一次用户编辑或导航可以重新保存。
旧请求迟到结果只触及旧实例，不在 await 后删除共享 Map。secret 使用同一内存 owner，
不写 Storage、日志、IPC、App Server 或普通主 Composer 草稿。

组件/owner 定向回归覆盖线程切回与真实 remount、不同应用 Store、host/thread/request/turn/
question identity、前置清理、拒绝和异常后的内部留稿、迟到结果、secret 与防可变引用泄漏。
定向验证不证明参考 App 运行、重启/跨窗口恢复，也不替代真实 Electron Gate B；
无已证明的 TTL、外部 resolved 或线程删除清理，保持 unknown，不添加猜测策略。
实现和验证账本为[同步问答计划](../../exec-plans/codex-request-user-input-alignment-20261020.md)。
