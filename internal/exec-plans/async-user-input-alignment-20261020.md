# 异步问题 current 纵切

状态：实施中；同步问答 r18 已验收，组合异步桌面 r19 失败，正在定位。负责人：Codex，2026-10-20。

目标：对齐 `request_user_input_async -> AgentMessage.questions -> 同一发送协调器`，不新增问答 RPC、同步 pending 或业务历史 store。参考与限制见 `internal/research/codex-desktop-rea/async-user-input-audit-20261020.md`。

## 写集与映射

- 后端代理：tool-runtime 工具、canonical/public item、投影/恢复及 schema/生成消费者；配置热区以机械补丁交接。
- Root：`agentProtocolCoreTypes.ts`/声明与 canonical reader；`agentChatShared.ts`、user-input preparation/submission、submit execution 与 submit builder 的权限选项；新异步问题派生 helper、AppScope UI 草稿、panel、共用答案编辑原语；已释放的 Workspace Scene 两文件；五语 agent keys 与定向回归。
- Files 和消息知识删除分别由已有代理负责；不覆盖其写窗。provider/reasoning/memory 热区只读，可信配置接线先核对上下文再合并。
- 上游公开类型 `AsyncUserInputQuestion` 直接复用。GUI 压缩符号仅作证据位置，不冒充原始名称。

## Verification Contract

- 预算：budget:normal；风险：P1。
- 主链：工具 producer → canonical AgentMessage started/completed → App Server JSON-RPC/read model → Renderer 派生 UI → 普通 `turn/steer` 或 `turn/start`。
- 输入：全部有效问题，稳定 source item id；答案只关联同 thread 的真实题目。
- 输出：accepted 工具输出不阻塞模型；答案采用标准 wrapper 数组，不发送附件或权限覆盖；题稿不污染主 Composer。
- 失败终态：工具参数失败零问题事件；发送失败保稿；发送成功只消费未被后续编辑的发送快照；关闭/跳过不 interrupt。
- 单元/组件：严格 parser、跨 thread 关联、canonical accepted 答案、Next/Skip、失败重试、late edit、AppScope 切线程恢复、发送选项穿透。
- 必跑：相关 Rust/前端测试、types、五语、contracts、current fixture 聚合与 GUI smoke；新增真实 Electron 场景验证 canonical producer 与答案 wire。未运行不记为通过。
- Evidence：仓库 artifacts 保存 REA 收据；测试日志及 `.lime/qc/gui-evidence/` 保存实际进程结果。没有 release/打包产物声明。
- 架构影响：在既有工具、canonical item 和发送 owner 内扩展 typed 字段；不建立第二后端。协议与 read model 字段变化同步 architecture，完成前核对目录、依赖方向与门禁。

## 退出条件

后端能力/root/配置真实接线，live/read/rebuild/fork 保留同 identity；前端题目派生与标准发送闭环；旧实现/测试无双轨；真实进程验收完成。当前不满足，不能标记整体 GUI 完成。

## 当前实施与证据

- 2026-10-20 后继 root 收口：在现有六处候选接点逐段合并 canonical `is_root_agent` 和 resolved tools 开关，保留 typed Stop source 并行增量；同步迁移构造调用及定向回归，随后执行公共 JSON-RPC/provider capture 与真实 Electron。窄写集为 execution_request、turn admission、session_config、provider_config、current provider snapshot 接线及其消费者。旧的“默认 false 尚未接线”记录作为此前状态保留，取得新证据前不标完成。
- 结构护栏修复：将 session source 解析原样迁到 `request_context/session_source.rs`，主文件由 806 降至 754 行，不放宽 800 行上限。

- 后端自持叶模块冻结，204项Rust测试通过；schema writer、1058个协议类型生成及drift通过。唯一源ID入口改为 `ItemId::from_source`，旧名称与metadata.delivery解释路径删除。详见 [backend-implementation.md](artifacts/async-user-input-20261020/backend-implementation.md) 与 [backend-freeze.json](artifacts/async-user-input-20261020/backend-freeze.json)。
- Renderer已接严格canonical reader、AppScope题稿/selection、共用答案编辑器、Next/Skip/失败重试/late edit，使用普通sendMessage，主Composer不清。问答发送显式省略权限覆盖，plan以现有模式传递，普通模式不重设collaborationMode。
- 新REA确认每题独立助手行、仅title、未答且未选中时的Answer入口，以及题目标签＋普通用户正文的答案模板；当前时间线已替换整段源text显示，derived ID不改变canonical source identity。手动可重开skipped未答题，不新增已答题重开入口。
- selected async question且无可见附件驱动同一Composer单行；dictation和IME优先级保持。同步panel隐藏async表面但不清题稿；同步pending不触发async selection。
- 前端107项既有本轮回归与新增4项时间线组件回归的并集111项取得通过。日志 `/tmp/lime-async-{ui-unit-r1,ui-regression-r1,ui-component-r2,timeline-tests-r1}.log` 保留；regression-r1中JSDOM Range API失败由component-r2修正后复验，不抹去原失败。
- timeline scoped lint-r1发现正则多余转义，r2已通过；types-r1误用不存在的npm脚本，改实际tsc后r2发现Token字段收窄错误，修正后r3已确认exit0。五语检查100%通过，docs boundary及scoped diff whitespace通过。Files菜单fixture三份node语法检查通过；同步问答/侧栏脚本15项与canonical history1项另有后继通过，同跑的题稿6项是既有并集，不重复累加。真实菜单尚未执行。
- 新REA原件136成员归档并全部hash回读：[selected-question-timeline-integrity.json](artifacts/async-user-input-20261020/selected-question-timeline-integrity.json)。目标未执行，静态证据不冒充运行观察。architecture已由root确认当前owner/依赖方向，图中明确标注未接可信producer。

## 此前阻塞与当前验证

六个可信 root/config 接点和 agent-control fork 已按最新基线逐段合并，保留 typed Stop source 增量，构造式消费者已迁移。candidate patch 仅保留为当时的交接原件，不再作为未实施列表。缺失 canonical Thread 或 resolved config 时 fail closed；普通 fork 可为 root，子 agent 不可借 renderer metadata 开启该工具。

此前 memory 字符串守卫失败原件 `/tmp/lime-codex-contracts-async-r1.log` 保留；后继 root 已完整执行 `npm run test:contracts` 并取得 exit0，不恢复旧 memory 委托链。

异步已有后端定向 4/4＋5/5 通过，后继新增 typed 配置边界回归和完整受影响 Rust crates 正在执行。REA 复用 `ev_c2b5509b493e5e04e3b3676441433bad4398c1386f19e937c69f9697bba0ee40`，本轮 summary 在 `/tmp/lime-async-rea-summary-20261020.json`，7 个静态 JS 成员、parse failures=0、semantic unknowns=611；没有执行参考 App。

同步问答 r18 已通过真实 Electron（见主计划收据）。后继组合问答 fixture 直接通过受控 provider 工具产生异步 canonical Item，等待真实表单可见后才放行模型续跑，随后验证普通答案发送、跨线程题稿和主 Composer 保稿；测试的模型能力由显式 test-only native policy 提供，不冒称生产 catalog 发现已验收。

新 sidecar 已构建成功（`/tmp/lime-async-sidecar-build-r20.log`）。受影响 Rust 串行复验 App Server 1957/1957、agent 295/295 通过（`/tmp/lime-async-trusted-rust-serial-r21.log`）；此前 agent-runtime 265/265 通过。组合桌面 r19 等待 async 表面超时；canonical 历史已含同 source ID 的真实问题，producer 随后触发无可见输出期限，失败原件在 `.lime/qc/gui-evidence/request-user-input/codex-question-20261020-r19/`。尚未确认首次显示与切线程哪个阶段失败，不凭工具已注册判成功；r20 增加细分阶段、DOM 和 invoke trace 诊断后复验。current fixture 聚合、GUI smoke 与默认门禁仍待结算。前端续跑切换至已安装 Node24.21.0；Node23 的 registerHooks 失败和后继原 5 秒 PPTX 组件超时均保留，不改超时或过滤断言。Files/Goal 完整矩阵、生产 catalog 的实验工具能力路由、Windows/live/packaged 继续开放。


## 活动 Turn 恢复缺口（后继定位）

r20 的细分诊断确认首次表单不可见，canonical 问题真实存在且主草稿保留；r19 中另一次主草稿发送未在 r20 复现，不据此归因。r21 使用实际线程导航恢复，界面恢复了初始用户消息但继续丢失问题和终态。current `resumeThread` 在消费快照后只调用 `restoreCommands`；路由明确跳过 inProgress Turn，因此已恢复窗口没有该活动 Turn 的 live route。

REA 参考仍为上述 Ktn/qtn 的同一 Thread/Turn/Item 生命周期及 lIt/mIt canonical 跟随合同；2026-10-20 再次通过 REA summary 复用 `ev_c2b5509b493e5e04e3b3676441433bad4398c1386f19e937c69f9697bba0ee40`，summary ID `ev_1dcc4684f813af880b706b411e13b8a3958c8860f13283b76fbfee87d3315ca0`。没有执行参考应用。Codex `app-server/src/request_processors/thread_lifecycle.rs` 的连接订阅与 current producer 生命周期提供运行边界参考；压缩符号不作为新源码命名。

窄修复沿唯一 `AppServerAgentSessionEventDrainRouter`：将快照恢复入口直接改名 `restoreThread`，同时恢复 active Turn 与 terminal Turn 的 session Command；迁移唯一生产调用及测试，不保留旧 alias。恢复路由固定 canonical Turn ID，首个外线程/外 Turn 事件不得重定向它。既有 sequence gate、终态 tombstone、command/process identity 继续生效。新增确定性回归先复现“没有 subscription”（`/tmp/lime-active-turn-resume-red-r22.log`），再覆盖问题 Item started/completed、真实 terminal、foreign scope 和回收。

另修复题目 Item 先到、active Turn 后到时提前登记导致不自动选题的竞态；用户主动关闭后仍不自动重开，34 项相关回归通过。全量前端迁移了缺正文的旧 canonical fixture，并精确登记共享新线程目标 lowering 的 inputRestoreDraft 消费；不恢复旧目标表单或队列状态。

上述运行缺口的后继 Renderer、真实 Electron、current fixture 和标准 GUI smoke 尚未验收。r19/r20/r21 失败原件保留，不改写为通过。默认前端续跑使用独立 `.lime/test/vitest-smart-gui-alignment-20261020.json`，避免并行进程共写状态。
