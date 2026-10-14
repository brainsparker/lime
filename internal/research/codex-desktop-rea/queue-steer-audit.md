# Queue active-turn Steer 合同核对

日期：2026-10-14。状态：只读补证；不是产品实现或运行验收。目标安装包、ASAR摘要和来源锚点见 [证据索引](evidence-index.json)，实施主线见 [current计划](../../exec-plans/codex-gui-alignment-current-plan.md)。

## 参考包观察

真实callback为 `QueuedMessageList.onSendNowMessage`，不是推测的 `onApply`。静态调用链：

```text
QueuedMessageList.onSendNowMessage
  -> handleSendNowMessage -> queued actions.start
  -> sendQueuedMessageNow -> submitPrepared -> turn/steer
```

后续节点是已核对成员内的可读属性/语义职责；外部函数、类的原始开发名称仍unknown，不能将压缩local别名迁入Lime。

| 路径 | 观察 | 边界 |
| --- | --- | --- |
| active | 等待真实active Turn ID；发送expectedTurnId与原clientUserMessageId；steer成功后才queue/delete，之后清除本地投影 | 每个异步阶段校验owner/thread/queue snapshot；不先删除队列 |
| idle | thread/queue/start | 不把idle start伪装active steer |
| 确定失败 | 清理optimistic steering Item，保留队列并呈现失败/暂停 | 可以编辑或重试 |
| 送达未知 | 保留request/client/server queue identity；sending/outcome-unknown阻止重发 | history确认同client输入已接受后只重试queue消费，不再steer |
| 目标变化 | 明确ExpectedTurnMismatch有一次重新绑定重试 | unknown不进入该重试 |
| 跨窗口发送锁 | active TTL 2分钟，sent tombstone TTL 10分钟 | 不能证明持久exactly-once或TTL外去重 |

Queue/Host REA复用既有Evidence；app-primary、app-initial、app-shared外部owner补证为按ASAR offset/size读取、核对integrity的**手工静态观察**，没有重跑全包或执行目标。完整跨重启receipt、TTL外去重、实际故障行为仍unknown。

## 公开Rust与Lime current

公开Codex revision `31434401fa3cd111866acdc1bba2a73b561f53d5`：

- `ext/queue/src/service.rs:367` 的start仅idle，成功启动后删除Queue，没有合并active steer。
- `app-server/src/request_processors/turn_processor.rs:1044` 验证expected ID、输入、权限/provider并调用core，映射mismatch/no-active/Review/Compact拒绝。
- `core/src/session/turn_input.rs:803` 在active-turn锁内校验目标/任务种类并追加pending input；受查路径未将client ID作为幂等键。

Lime current已有idle Queue start及普通steer/session actor，但还没有Queue接受/消费完整合同。源码推导的风险尚未运行复现：

- `runtime/turn_execution.rs` 的steer_turn先actor接受、后append_runtime_events；日志失败时输入可能已发布，error重试可能重复push。
- `session_loop/input_queue.rs` 的push_steer不按submission/client去重；稳定Item/client名字不等于provider幂等。
- `runtime/event_store.rs` 遇终态会返回Ok(empty)；actor接受后快速终态可能出现ACK成功但没有输入事件。
- Queue允许重复client ID，已有 `runtime/tests/thread_queue.rs` 回归；消费必须明确queue ID，不能仅凭client ID定位。

## 最小正确后续合同

先以隔离fixture复现写日志失败、ACK丢失和终态竞争，再限定既有owner修复；不能只串联普通steer和delete后宣称故障关闭。

后端Queue handoff必须携带queue ID与expected Turn ID，从canonical Queue读取完整input/client/稳定Item。唯一session actor串行校验目标、持久化接受与发布输入，持久化失败不发布；同一operation重试只读receipt。materializer用同一接受事实迁移稳定User Item并消费pending Turn，不建立第二Queue/history store。

ACK丢失、投影失败或消费失败只能修复receipt/projection/消费，不能再次push。无法证明接受时保留unknown并禁止自动重发；持久化后发布前崩溃的恢复需单独定义。保证只能写“唯一durable admission”，ACK不能证明模型已消费输入。

候选写集：processor/turn、runtime/thread_queue独立handoff、turn_execution窄委托、session_loop的handle/actor/input_queue、既有event/materializer/store，以及必要protocol/client/Queue DTO和GUI接线。这是Lime本地扩展合同，不能冒充上游确认wire字段。

退出测试：并发/重复请求、重复client ID、mismatch、Review/Compact、日志失败、接受后断连、持久化后投影失败、消费失败、终态竞争、同库/分库冷恢复和同Item/input/media GUI读回。scheduler、unload、export及全局status不在此候选写集。
