# 异步问题 current 纵切

状态：实施中，未取得真实桌面验收。负责人：Codex，2026-10-20。

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

- 后端自持叶模块冻结，204项Rust测试通过；schema writer、1058个协议类型生成及drift通过。唯一源ID入口改为 `ItemId::from_source`，旧名称与metadata.delivery解释路径删除。详见 [backend-implementation.md](artifacts/async-user-input-20261020/backend-implementation.md) 与 [backend-freeze.json](artifacts/async-user-input-20261020/backend-freeze.json)。
- Renderer已接严格canonical reader、AppScope题稿/selection、共用答案编辑器、Next/Skip/失败重试/late edit，使用普通sendMessage，主Composer不清。问答发送显式省略权限覆盖，plan以现有模式传递，普通模式不重设collaborationMode。
- 新REA确认每题独立助手行、仅title、未答且未选中时的Answer入口，以及题目标签＋普通用户正文的答案模板；当前时间线已替换整段源text显示，derived ID不改变canonical source identity。手动可重开skipped未答题，不新增已答题重开入口。
- selected async question且无可见附件驱动同一Composer单行；dictation和IME优先级保持。同步panel隐藏async表面但不清题稿；同步pending不触发async selection。
- 前端107项既有本轮回归与新增4项时间线组件回归的并集111项取得通过。日志 `/tmp/lime-async-{ui-unit-r1,ui-regression-r1,ui-component-r2,timeline-tests-r1}.log` 保留；regression-r1中JSDOM Range API失败由component-r2修正后复验，不抹去原失败。
- timeline scoped lint-r1发现正则多余转义，r2已通过；types-r1误用不存在的npm脚本，改实际tsc后r2发现Token字段收窄错误，修正后r3已确认exit0。五语检查100%通过，docs boundary及scoped diff whitespace通过。Files菜单fixture三份node语法检查通过；同步问答/侧栏脚本15项与canonical history1项另有后继通过，同跑的题稿6项是既有并集，不重复累加。真实菜单尚未执行。
- 新REA原件136成员归档并全部hash回读：[selected-question-timeline-integrity.json](artifacts/async-user-input-20261020/selected-question-timeline-integrity.json)。目标未执行，静态证据不冒充运行观察。architecture已由root确认当前owner/依赖方向，图中明确标注未接可信producer。

## 阻塞与下一刀

六个可信root/config接点发现 `current_provider_turn.rs` 树外变化，按并行协作规则已提交最小补丁并询问接管写窗，尚未收到明确答复；不得把时间流逝视为同意。候选 `trusted-context-hotspots.patch`、fork语义与外部构造式补丁均未应用。当前策略仍默认false，真实模型不开放该工具。

统一contracts已实际执行，protocol drift通过，随后外部memory owner旧源码字符串守卫失败：要求 `self.app_data_source.consolidate_memory_store(params).await`，当前实现已改变。原失败 `/tmp/lime-codex-contracts-async-r1.log` 保留，待owner对齐守卫；不回退memory实现或放宽其他合同。

该guard源码归属未确认，已在 [memory-contract-guard.patch](artifacts/async-user-input-20261020/memory-contract-guard.patch) 准备迁移到真实route/backend委托的最小候选，`git apply --check`通过但未应用。contracts后续独立检查已实际执行：commands、harness、modality、scripts、Electron release、Desktop reference与CLI boundary通过；这不把聚合contracts变成通过。

`npm run electron:build`已通过：新Renderer、Host/preload、协议client与Rust sidecar资产完整构建；当前进入侧栏r11真实Electron专项。构建存在外部memory模块的既有dead-code warning，未修改该并行模块。异步producer仍关闭，构建成功不证明异步功能端到端启用。

继续补新Renderer/Host、真实侧栏r11与同步问答、Files/Goal矩阵、`smoke:agent-runtime-current-fixture`、GUI smoke和默认门禁。异步Gate B必须在可信接线完成后通过真实模型fixture产生canonical问题；不允许renderer注入模拟producer。
