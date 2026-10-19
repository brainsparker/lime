# Codex 异步问题后端纵切

日期：2026-10-20。状态：自持后端写集已冻结，定向验证通过；可信上下文接线与运行时验收待主任务集成。

本专项实现 `request_user_input_async` → canonical `AgentMessage.questions` →
持久化、live/read/rebuild/fork/public projection。Renderer、主 Composer、统一构建与
Electron Gate B 由根任务持有。

对标依据为[REA 与 current 源码报告](../../../research/codex-desktop-rea/async-user-input-audit-20261020.md)，
完整原件与 REA 记录见 [rea-records.tar.gz](rea-records.tar.gz) 和
[artifact-integrity.json](artifact-integrity.json)。旧安装包的动态启用状态未验证。

## 写集与协作

- `tool-runtime`：新异步 schema、严格全量参数验证、工具定义与 compact surface。
- `agent`：current catalog、executor 独立分支、lifecycle emitter 与 mcp snapshot 的
  typed policy / DirectModelOnly；只修改对应叶模块和定向测试。
- `agent-protocol`：唯一 `AgentMessageDelivery`、`AsyncUserInputQuestion` owner 与
  canonical payload；public v2 复用，不建立重复类型。
- `app-server-protocol`：public questions、schema registry、schema fixtures 与生成
  protocol types；不新增 RPC、requestId 或 isBlocking。
- `app-server`：现有 canonical/public/read/fallback projection、merge、消息 lifecycle
  的异步 per-ID 特例、fork provider history 的窄过滤及定向测试。
- `thread-store`：既有 snapshot merge 保留两个字段与构造式机械补齐。
- `core/config`：`tools.experimental_request_user_input.enabled`，缺省 true，模型能力、
  root 和 DirectModelOnly 继续独立限制开放范围。

未接管其他进程的 provider、reasoning、memory 或 turn execution。热区待合并补丁为
[trusted-context-hotspots.patch](trusted-context-hotspots.patch)，原始上下文摘要见
[trusted-context-hotspots.json](trusted-context-hotspots.json)。该补丁尚未应用。
`is_root_agent` 必须来自 App Server admission 的 canonical Thread.parent_thread_id，
无可信 Thread 时 false；不能用 forked_from_id 或 renderer metadata 代替。

## 实现不变量

1. async 与同步 reverse request、ActionRequired、pending session response 分离。
2. 顶层及题目未知字段拒绝；全部题目验证通过后才发布，无部分题目泄漏。
3. `RuntimeTool::execute_call` 的通用 Started 不生成异步 tool 行；成功 Completed
   以不可变原始参数经同一 validator 生成同 call ID 的 AgentMessage started/completed。
   发布顺序早于调用方取得 accepted 输出，错误、拒绝、取消均零问题 item。
4. canonical 同时包含 final_answer、async、questions；public delivery 从 typed 字段
   读取，移除旧 metadata 字符串解释路径。
5. root、可信 config、模型 experimental_supported_tools 必须同时通过。旧
   send_user_message_async 仅作模型 capability key，不注册同名 runtime 工具。
6. async 为 DirectModelOnly，不能从 CodeMode 嵌套调用；既有 request policy、model
   blocked tools 与 turn surface 仍生效。
7. 异步问题只使用 typed per-ID 生命周期，不占流式正文的单 active slot；重复启动、
   无启动完成及完成后更新仍拒绝。
8. fork 的展示问题不合成为 assistant 文本；模型历史仍保存实际 tool call/result。
9. 序列化、live、完成 merge、rebuild、read 与 public projection 保留 questions 与
   source item identity。Renderer 从 canonical 字段派生状态。

源身份使用唯一 `ItemId::from_source` 入口，Deserialize 与异步 producer 共用；旧
`from_legacy` 名称已删除。`new`、`generated` 和 `parse` 的生成/前缀规则保持。
定向回归发现原构造器会将无下划线的 call ID 加上 `item_`，与 Codex handler
直接使用 `call_id` 不符，现覆盖无前缀 call ID、UUID 与既有前缀 ID 的序列化恢复。

## 验证与退出条件

最终结果见 [backend-validation.log](backend-validation.log)，自持叶模块、共享接点与生成物
的冻结摘要见 [backend-freeze.json](backend-freeze.json)。共享接点可能包含其他并行任务
的改动；摘要用于检测后续漂移，不表示本专项独占整个文件。

| 检查                                           | 结果                                        |
| ---------------------------------------------- | ------------------------------------------- |
| schema writer、生成 TypeScript、protocol drift | 全部通过；1058 个生成协议类型，268633 bytes |
| `agent-protocol` 全量                          | 47/47                                       |
| `app-server-protocol` 全量                     | 144/144                                     |
| schema fixture                                 | 1/1                                         |
| `lime-agent` 异步问题定向                      | 5/5                                         |
| `app-server` 异步问题定向                      | 4/4                                         |
| `thread-store` 异步问题定向                    | 1/1                                         |
| `lime-core config::tools`                      | 1/1                                         |
| `tool-runtime request_user_input_async`        | 1/1                                         |
| 定向 diff whitespace、所改叶文件 rustfmt       | 通过                                        |

合计 204 个 Rust 测试通过。覆盖全量参数验证、root/config/model gate 矩阵、
DirectModelOnly、动态同名工具无法绕 gate、非阻塞 accepted、错误零 item、源 identity、
流式正文并存、merge/rebuild/read/public projection 与 fork provider history。
Node 使用 `/Users/coso/.local/share/rea/runtime/node-v24.21.0-darwin-arm64/bin`；Rust
测试通过仓库 V8 artifact resolver 注入本地归档与 binding，并设置足够的测试线程栈。

剩余集成由主任务持有：

1. 协调六个可信上下文热区，将 canonical root 和 resolved config 接到 typed policy。
   当前占位默认为 false，工具尚未在真实产品链中启用。
2. 合并 [agent-control-fork.patch](agent-control-fork.patch)，排除异步问题展示文本进入
   子 agent 的 assistant message fallback。外部构造式候选补丁为
   [external-constructor-fields.patch](external-constructor-fields.patch)，必须按最新基线
   核对，不能直接覆盖已被其他进程修复的文件。
3. 同步手写 Config 消费者与 Renderer，执行统一 `test:contracts`、
   `verify:gui-smoke`，并追加可信 producer 与真实 runtime/Electron Gate B。

分类：自持实现全部为 current；新增 compat/deprecated 0；已删除旧 `from_legacy`
入口与 metadata.delivery 解释路径，不恢复旧 runtime、别名工具或问答私有 IPC。
本次获授权的自持写集与定向验证完成度 100%；异步问题整体交付尚未完成，不能据此
宣称产品已完整对齐。
