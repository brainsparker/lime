# Approval 当前合同与对齐缺口

状态：current，2026-10-13。执行记录见 [Codex GUI current 对齐计划](../../exec-plans/codex-gui-alignment-current-plan.md)。

## 目标

等待人工审批使用 Composer 上方唯一 pending interaction 层，显示完整原因、可检查的操作和真实可用的决定。布局与组件分工依据 REA 核对的 Codex Desktop 安装包；共享授权语义以 public App Server 与 tool-runtime 为事实源。

`PendingRequestItemPanel` 消费现有 `ActionRequired` 投影，`ApprovalCard` 只承接 header/title/subtitle、reason/details、body 与 actions。后者是 Lime 按包中通用卡职责采用的语义名，原包通用卡绑定已压缩；前者是确认的 shipped export。

## 唯一主链

`PendingInteractionLayer -> PendingRequestItemPanel -> PendingInteractionController -> server request dispatcher -> Electron preload/IPC -> app_server_handle_json_lines -> App Server / tool-runtime`

请求是 `item/commandExecution/requestApproval`、`item/fileChange/requestApproval` 或 `item/permissions/requestApproval`，响应使用原 JSON-RPC request id。命令/文件确认分别提交当前 wire `accept`、`acceptForSession`、`decline`、`cancel`；permissions request 复用其独立权限画像合同。不得新增私有 action method 或前端审批 authority。

Renderer 的 `allow_once`、`allow_for_session`、`decline`、`cancel` 只是现有 typed 投影。`decline` 拒绝本动作，`cancel` 中止当前 turn；是否允许某个决定、权限缓存、sandbox 与执行仍由共享 owner 控制。空的声明决定列表不能被 UI 补成可授权动作。

## 呈现与交互

- 显示完整 reason 与已提供的 detail，不固定为一行截断。
- 命令直接显示 public request 的 `command: string`，长命令默认三行并支持展开/收起，不把它猜成 argv 数组。
- `cwd` 与 `grantRoot` 从 public request 投影；网络显示 typed `networkApprovalContext.host/protocol`。不猜风险等级、不从 reason 解析路径、不默认展开任意 JSON 参数。
- 默认主动作允许一次；同时支持会话允许时使用 scoped action 菜单。未提供的决定不显示，菜单文案不声称策略能力超过当前合同。
- 提交期间禁止重复提交；失败保留请求并提供本地化重试状态；已提交请求禁用授权。
- 窄容器下操作纵向排列，主题使用现有语义 token；五语言、键盘与焦点回归覆盖用户可见动作。
- Composer draft/queue 与待审批的同一 thread/turn/item 绑定，历史时间线只读，不重新提交旧审批；approval、user input、MCP elicitation 和 permissions 继续由统一层分流。

## 已确认的缺口

- Codex shell 的 Allow similar commands 依赖 execpolicy amendment；网络 Always allow 依赖 network policy amendment。Lime 当前四种决定不提供它们，不能把它们标成 `allow_for_session` 伪装支持。
- 文件审批还需关联 canonical file-change item 才能显示准确文件列表、增删统计和 diff preview；仅有 `grantRoot` 不等于文件 diff。
- Lime 已有 auto approval review 的通知、typed Rust item 与 `guardian_review` 投影。专用可展开的自动审查解释 UI 仍待对齐；它属于只读审查详情，不能放到人工提交卡或用 StrictReviewStatus 代替。
- Codex 实时窗口观察未运行；当前上游结构证据是经成员 SHA 校验的包源码与 REA 分析，不是点击、动画或像素验收。

## 测试与护栏

删除旧单行组件和禁止 command/details/pre 的正向断言，迁移为可检查操作、声明决定、同请求响应、重复响应拒绝、失败重试与五语言的行为测试。GUI fixture 以 pending card 与命令详情判定 ready，不以高度小于 48px 判定成功。

保留唯一 pending owner、approval 优先级、server request identity、非审批表单分流、历史只读、production mock 禁止与 current terminal/read model 护栏。完成回归关联 wire `turn/completed` 与 canonical 投影。

定向测试之后，执行 current runtime fixture、对应真实 Electron approval fixture、GUI smoke、contracts 与默认本地门禁。外部 fixture 不证明 live Provider；未真正启动 Electron 时不得写 Gate B。所有结果与阻塞回写 current 执行计划。
