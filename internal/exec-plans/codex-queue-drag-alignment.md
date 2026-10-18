# Queue 拖拽与键盘重排对齐

日期：2026-10-18。状态：renderer 实现与定向验证完成；真实桌面验收待主线集成。负责人：`presentation_advanced_native`。

主目标是补齐已证实的 Queue 拖拽入口；当前阶段只实现 renderer owner 与定向验证，真实 Electron、canonical readback 与共享总计划由主 agent 集成。

## 参考与边界

- 复用 [非专业文件剩余切片第 3 项](../research/codex-desktop-rea/gui-remaining-implementation-20261018.md)与[导航审计](../research/codex-desktop-rea/navigation-composer-audit.md)：Codex Desktop `26.1007.30912` / build `20156`，ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。
- REA Evidence `ev_b2f93fdf5156589566b6f36f922085b8f76f3a1b99f02997f3b0c74188fd3578`，`queued-message-list-77acfdcb3f8a.js` SHA `f4a09693e66fc208014ac2fb5d0c00c1a3949375d0b410348b56db569729d9dc`，UTF-16 `18663` 的 `onDragEnd:c` 证明存在拖拽处理入口。内部原始 handler / class 名称仍 unknown，不声称恢复。
- current owner：`QueuedMessageList` 的展示与交互；唯一写入路径仍是 `reorderThreadQueue -> App Server thread/queue/reorder`。复用 `runAction` 同步锁、thread 实例隔离和请求迟到防护。
- drag 只保留交互 snapshot；drop 校验实例/thread/source/完整 ID 顺序、canonical submissions snapshot、mutation epoch 与 DataTransfer 身份。成功仅 refresh，失败不改队列；不建立本地乐观队列。
- 原生 drag handle 与上下按钮、handle 的 ArrowUp/ArrowDown 共用按 source/destination ID 的动作；Escape、dragend、相同位置、失效 drop 均零请求。复用现有五语言可访问名称，不增加依赖或文案。

## 窄写集与避让

- `src/components/agent/chat/components/QueuedMessageList.tsx`
- 同目录 `queuedMessageReorder.ts`、`queuedMessageReorder.unit.test.ts`、`QueuedMessageList.reorder.component.test.tsx`
- 本计划。

开始时组件与现有 `QueuedMessageList.test.tsx` 均 clean，主 agent 已确认其他 worker 只持有 MCP/Experimental 与 Media。现有富输入/图片/编辑/发送/删除合同保留。只读既有 hook、typed action、协议与证据；不写 runtime、queue API、Composer、语言、共享总计划、架构、候选或 Electron。

## Verification Contract

- 预算 `budget:tight`；风险 P1，renderer 队列交互。
- Current 主链：`QueuedMessageList -> reorderThreadQueue -> current App Server JSON-RPC -> canonical queued submissions -> scoped queue reader`；bridge/runtime 不变，本切片的定向测试只证明 renderer 与既有 typed gateway 的接线。
- Happy path：三项以上文本/图片/skill/path 富输入，只提交完整重新排列的 submission IDs，输入与 client identity 不改；待真实 readback 后显示 canonical 顺序。
- 失败终态：错误使用既有 actionFailed，原顺序保留；锁释放可重试；旧 thread 的迟到完成不影响新实例。
- deterministic：纯顺序转换、实际 DOM drag/drop/keyboard/按钮、失败/取消/在途/失效 snapshot/thread A→B→A/focus；静态检查为精确源码 typecheck、ESLint、Prettier 与 diff check。
- 本 worker 禁止 Electron、候选和全量；`smoke:agent-runtime-current-fixture`、`verify:gui-smoke`、`verify:local` 与 Queue Gate B 交主 agent，未执行不能报告产品通过。
- 架构影响：非重大；未改变 owner、协议、read model、依赖方向或交付门禁。架构图更新不适用。

## 退出条件与结果

- [x] 按 ID 的单一 reorder 动作与原生拖拽/键盘入口完成。
- [x] 定向回归覆盖富输入、canonical 顺序、失败/取消、加载/在途、失效源/目标/源顺序、跨 thread 与焦点。
- [x] 类型、lint、格式及既有组件回归通过。
- [x] 精确源码 SHA 固定如下；收据 `/tmp/lime-queue-drag-source-receipt-20261018.json` 随本次释放交主 agent。

验证命令与结果：

- `npm test -- <四个定向测试文件>` 首轮 64/64；补充内部拖拽事件归属测试后，以 `node node_modules/vitest/vitest.mjs run <相同四文件> --reporter=json --outputFile=/tmp/lime-queue-drag-vitest-20261018.json` 验证最终源码 **65/65**：新 DOM 场景 31、顺序转换 11、原组件 17、富输入 6。
- `node /tmp/lime-queue-drag-typecheck-20261018.cjs`：读取真实 renderer tsconfig 与 import graph，检查四个精确源/测试文件的 syntactic/semantic 以及全局/options diagnostics，**0 diagnostics**。不检查无关源码的 semantic body，不冒充全仓 typecheck。
- 精确四文件 `eslint --max-warnings 0`、`prettier --check` 及组件 `git diff --check` 均通过。
- 原 `QueuedMessageList.test.tsx`、`queuedMessageInput.ts` 与其测试未修改，仍覆盖编辑/图片/发送/删除合同。内部原生 drop 已 stopPropagation，外部 drag 不被队列接管，避免冒用附件 owner。

| 固定源文件                                     | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `QueuedMessageList.tsx`                        | `166e28c829256a98eed6a00617fb9a48d8f8a525be7eabe25b57ad2cd89ebd57` |
| `queuedMessageReorder.ts`                      | `b13480892ad1d011995571a7acd92fa56129c9e34766250c489121318180c801` |
| `queuedMessageReorder.unit.test.ts`            | `ca973aeb53830f8e13d9c6e708e24dcb5ed64b2f80bc901e037a93584e50ab56` |
| `QueuedMessageList.reorder.component.test.tsx` | `601309758a49bfcd9dfce80d880f2df12b55a0ac0f44bc0316d9c70ce6ab3d47` |

完成度分母：本切片 renderer 行为、共享动作与定向回归 100%；真实原生拖拽、current queue fixture/readback、Electron Gate B 尚未执行。上述 DOM 用的是显式 test-only queue fixture，不证明真实拖拽设备、IPC 或 runtime 已通过。

下一刀归属：主 agent 集成后，通过 `queued-message-item[data-submission-id]` 行与 `data-queue-action="reorder"` handle 验证真实拖拽；ArrowUp/ArrowDown 验同一 `thread/queue/reorder` 和 canonical 顺序。`smoke:agent-runtime-current-fixture`、`verify:gui-smoke`、`verify:local` 未跑，原因是本 worker 的明确边界禁止 Electron、候选与全量。未形成 release evidence。

分类：新增 helper/交互为 current；测试为 test-only；不新增 compat/deprecated。旧 index-only move 路径已直接替换，无 alias；没有其它删除项。主题、多模型与首页 Banner 未触碰。
