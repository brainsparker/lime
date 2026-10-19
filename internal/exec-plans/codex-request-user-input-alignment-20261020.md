# 同步 RequestUserInput 对齐

状态：同步回包/取消及应用内跨线程草稿恢复已实现并通过定向验证；产品 Gate B 由 root 统一结算。负责人：`/root/remove_import_projection`。主目标是修复同步问答的 canonical identity、逐题交互、真实回包与 UI 题稿生命周期；异步问答仍是独立 gap，不用同步 pending 请求替代。

## 参考事实与写集

Codex Desktop `26.1007.30912 / 20156`，ASAR SHA-256 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。复用 REA50 parent `ev_e74e1af289bfe4b44f9d691f18aa79ec95a893d4a5777f632a16322c35804154` 的布局结论，并独立分析 29 个完整声明：`ev_a908f380896c707334ef1867c231f191790e0fbe29708ec243c6a7cb5306f437`。完整输入、来源摘要、UTF-16 source spans 和 Evidence 在 `/tmp/lime-user-input-rea-20261020/`。四个原件摘要经实际复算；静态提取没有运行参考 App，跨模块闭包与运行时 flag 不在覆盖内。

- `pending-request-item-panel-770855267df2.js` 的导出 `PendingRequestItemPanel`：`Ur -> Gr -> primary Ip(vz)`。`Gr` 保留 `isOther/isSecret`；`Zr` 按真实 `question.id` 返回 `{answers:{[id]:{answers:[text]}}}`，空题省略，不拆逗号。
- `Gr` 普通 Escape/dismiss 调用 `interruptThread`；仅 `Ur` 明确传入的 onboarding producer 或按当前 requestId 读到的 scheduled owner 才回 `{answers:{}}`。Lime 当前没有这两个明示 producer，不按 `isBlocking/autoResolutionMs` 猜测例外。`Gr` 从 `Ht(g)` 读取相同 requestId 的 initialDraft，`onDraftChange -> dt` 保存草稿。后续 23 声明 REA `ev_5734ec041f1dd5e183fcd1f5a15c97b1e71e7efb9b79694d4069dd1ea7bf21c4` 已闭合 AppScope 内存 Map、host/thread/request 键、`{answers,questionIndex}`、提交/dismiss 前按 requestId 条件删除；证据覆盖和 unknown 见[草稿研究](../research/codex-desktop-rea/request-user-input-draft-audit-20261020.md)。
- `vz -> s$e/i$e -> dz` 创建独立的 Composer Controller，未替换主草稿。默认选中首选项；逐题左右导航；选项支持数字/上下键；单选后 180ms 推进；无选项显示自由输入，有选项仅 `isOther` 开启自由输入；支持跳题。`isSecret` 明确禁听写；该声明未证明密码遮罩。
- 异步为 `AgentMessage.questions -> shared Bmn/F5t -> initial GS/WS/OIt -> P$e/x$e`，按 host/thread/entity/item 保存题稿，以 `send_user_message_async_question` 普通 follow-up、`send-now` 发送。Lime AgentMessage 只有 delivery、没有 questions，工具快照/catalog 也没有异步 producer；本切片不伪造此能力。
- 压缩符号只用于定位；新组件 `RequestUserInputPanel` 使用已确认的领域词，不冒充还原了上游原始组件名。

写集：`agentActionTypes.ts`；`pendingInteractionController.ts` 与测试；新增独立问答组件及测试；`DecisionPanel` 最小委托并删除已替代 ask_user 逻辑/测试；`PendingInteractionLayer` 的 accepted 结果透传、identity key 与独立 onDismiss；`usePendingInteractions` 按 semantic interaction identity 委托既有 typed interrupt；`useWorkspaceInputbarSceneRuntime` 及测试仅补回调透传；五语言资源、本计划和 architecture 的 3.2.1 窄段。不碰 Inputbar/goal、Rust/protocol/schema、其他 Agent 产物或构建。

草稿扩展窄写集：新增 `RequestUserInputDraftStore.ts` 与 owner/组件回归；`requestUserInputDraft.ts` 增加 UI 稿形状；`RequestUserInputPanel` 注入共享初稿并在用户事件保存、提交/dismiss 前清理；`DecisionPanel/PendingInteractionLayer` 只透传可选 surface host；原组件测试改用隔离应用 Store；本计划、草稿研究与 architecture 3.2.1。不修改 root 的真实 fixture、主计划或构建产物。

## Verification Contract

`budget:normal`，风险 P1。current 链：`item/tool/requestUserInput -> PendingInteractionController -> PendingInteractionLayer -> RequestUserInputPanel -> semantic interaction response -> dispatcher 原始请求闭包 -> ToolRequestUserInputResponse`。既有 Electron/preload/IPC、App Server、tool-runtime 与 canonical thread/turn/item owner 不变。没有新增命令、runtime events、read model 或持久化。

输入：真实 wire question id/flags/options；单题、多题、重复正文、逗号/换行自由答案、跳题、取消、IME、失败重试和 identity 切换。输出只接受 canonical answers 对象，未知/重复 ID 或错误结构留在 pending；合法跳题子集可提交。失败保留本地草稿，重复操作锁住，迟到响应不得污染新请求。secret 不写日志、localStorage、submitted echo 或错误详情；独立编辑器无听写入口。

共享草稿合同：复用既有 Jotai Store，每应用实例初始化独立 UI owner，Map 更新必须 clone，不原地修改 atom 初值或模块全局对象。当前本地 host 使用受控 `local` scope，键为 host/thread/request，值为 `{answers,questionIndex}`；读取额外校验 turn/题目 ID 序列，缺失 canonical scope 不共享保存。编辑、选择、跳题和导航保存；同 Store 跨线程及组件 remount 恢复。submit/dismiss 在原回调之前按 requestId 清共享稿；失败只保留仍挂载内部稿，不自动复活共享 Map；新编辑可重新保存。迟到操作不清新请求，secret 仅内存。没有新增 canonical authority、持久化、TTL 或外部取消清理策略。

取消链：`Escape/关闭 -> onDismiss -> usePendingInteractions.dismiss(interactionId) -> 当前 controller snapshot 的 thread_id/turn_id -> interruptAgentRuntimeTurn -> turn/interrupt`。不调用按 active stream 推断身份、恢复主草稿或提前合成本地停止态的通用 stop owner。中断成功只保留操作锁，等待 dispatcher 的 canonical resolved/turn terminal AbortSignal 移除请求；异常或 accepted=false 显示固定反馈、保留编辑器和草稿并允许重试。`controller.respond(confirmed=false)` fail closed；用户明确全部跳题仍通过 confirmed=true 的 canonical 空 answers 提交。没有新 public method、transport 或后端 owner。

必跑：受影响 component/controller/贯通测试、strict lint、renderer types、窄 diff check。GUI smoke、current fixture、contracts 与真实 Electron Gate B 由根任务在工作树冻结后统一结算；本进程不构建，不宣称 Gate B/live/Windows/packaged。组件和 controller 集成不替代进程边界证明。

退出：唯一 canonical 同步问答组件；删除旧按题文/索引回包、文本猜选项、单题 `{answer}`、逗号拆分和用户 dismiss 伪空答案路径；测试断言真实 UI 到 wire，保留 permission/elicitation 的现有 owner。跨线程 UI 稿恢复、Store/identity 隔离、前置清理和失败/迟到/secret 回归通过；无新增 compat/deprecated 包装。异步问答和真实产品验证单独结算。架构影响为非重大 surface 收敛，未改变跨层 owner；architecture 3.2.1 的依赖图由责任 root 统一确认。

## 验证记录

- 扩展前定向：6 文件 65/65，strict lint、renderer types、窄 diff check 通过（`/tmp/lime-request-user-input-{tests,lint,types}-20261020.log`）。
- 取消扩展后定向：7 文件 101/101，包含真实独立 Composer、DecisionPanel → layer → hook/controller、33 项 workspace 接线与五语言（`/tmp/lime-request-user-input-cancel-tests-20261020.log`）。后续仅新增全部跳题与取消分流回归，受影响单文件 17/17 通过（`/tmp/lime-request-user-input-cancel-skip-tests-20261020.log`）；最终本切片共 102 项定向覆盖，不重复未变的其余六文件。
- strict lint（15 个实际受影响 TS/TSX）exit 0：`/tmp/lime-request-user-input-cancel-lint-20261020.log`；窄 `git diff --check` exit 0。
- renderer `tsc --noEmit --project tsconfig.renderer.json` exit 2：唯一错误是并行避让写集 `workspace/right-surface/FileTree.tsx:149/206` 的 `FileTreeRow` 联合收窄；本切片无类型错误。日志 `/tmp/lime-request-user-input-cancel-types-20261020.log`。未改该文件，已交 root 统一处理并重验。
- 草稿扩展最终定向：5 文件 57/57，包括新增 19 项真实 Editor/Provider 组件回归、2 项 owner 身份/可变引用回归，以及原问答/DecisionPanel/Layer 36 项。日志 `/tmp/lime-request-user-input-draft-final-tests-20261020.log`。清理顺序在回调中记录共享状态、回调外断言，避免被组件异常处理吞掉失败断言；真实 Layer host 透传也在新回归内覆盖。
- 草稿扩展 strict lint（8 个实际受影响 TS/TSX）、renderer types 和窄 `git diff --check` 均 exit 0。日志 `/tmp/lime-request-user-input-draft-final-{lint,types}-20261020.log`。最新完整 renderer typecheck 已通过，取代前述并行 Files 类型阻塞；本进程仍未修改 Files。
- GUI smoke、current fixture、contracts、真实 Electron Gate B、Windows/packaged/live 未由本进程执行；由 root 在工作树冻结后结算，不把组件/静态证据升级为产品进程证明。

分类：`current` 为唯一 typed pending/controller、独立问答视图和 scoped interrupt；`deleted` 为旧 guess-key/文本猜选项/逗号拆分/伪空取消及其过期正向测试；没有新增 compat/deprecated。命令协议、运行时、数据存储和主 Composer owner 不变。

草稿扩展分类：`current` 为每应用 Store 独立的内存 UI 草稿 owner 与逐题表单；已替换只能随组件生命周期保留题稿的旧初始化，无双轨或 compat。已证明的同步 UI 合同、共享恢复与失败/身份回归本切片完成；真实桌面跨线程流程、异步问答及未知参考清理合同不计入完成。architecture 3.2.1 新增共享 UI 草稿节点，已交责任 root 确认。

## Root 产品验证写集与合同

Root 于 2026-10-20 复核 architecture 3.2.1 的图和实际调用链，确认唯一 pending authority、独立问答编辑器与精确 scope 中断；已再次核对每应用 Jotai Store 的内存 UI 草稿节点、host/thread/request 键与清理顺序，没有新增业务状态或协议。Root 只追加 `scripts/electron/request-user-input-fixture-smoke.mjs` 及证据判定测试，不写已冻结的产品实现。

Desktop Gate B 使用隔离 Electron、真实 preload/IPC、`app_server_handle_json_lines`、App Server/runtime 和本地受控 OpenAI-compatible provider。先保留主 Composer 未发草稿，再由真实 provider 发出两道题：完整含逗号选项和自由文本；填第二题后通过真实侧栏切到另一 canonical 线程，再返回核对 request identity、题号、自由答案和主草稿恢复。通过实际面板提交，核对原 reverse request ID 的 canonical JSON-RPC result、同一 thread/turn/item、provider 后续正文和 canonical completed。第二回合由实际面板 Escape，必须观察同 thread/turn 的 `turn/interrupt`、canonical interrupted、未回伪空答案。每次挂载内的问答操作保留主 EditorView；线程切换允许按正常生命周期卸载、重建。freshness、源/产物摘要、零 mock/错误和 Main 原 15 秒正常退出为必过门禁。该验证不证明参考 App 运行、live provider、Windows、packaged、异步问答或跨应用重启恢复。脚本尚待真实运行，不将上述合同记成已通过证据。
