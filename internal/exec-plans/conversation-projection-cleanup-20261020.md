# 会话事件与 Item 投影清理

状态：completed / unit-verified。责任开发者：sidebar alignment worker。日期：2026-10-20。

## Verification Contract

- 目标：conversationImport 入口已退役后，删除 Event/Item 投影中残留的导入判定、专属时间戳/Item ID/状态旁路与 provenance 字段复制；只保留 current canonical 事件、消息、工具、推理和分页语义。
- 事实源：`RuntimeCore -> canonical event log -> Thread/Turn/Item projection`。参考 Codex `codex-rs/app-server/src/bespoke_event_handling.rs:1087` 的 ItemStarted/ItemCompleted、command start 去重和 `:1434` 的当前宿主时间；显式 Item identity 与 terminal 是当前消费合同，不由导入标记推导。
- 写集（开始前 git status 均干净）：`runtime/event_store.rs`、`event_store/canonical_message_lifecycle.rs` 及 tests；`runtime/thread_item_projection.rs` 与其子模块/测试；`runtime/tool_item_projection.rs` 的专属 metadata 复制。没有共享热区接管、commit、push、分支或其它仓库写入。
- 避让：`runtime.rs`、turn execution、projection_store/protocol、session_runtime_defaults、read_model/session_metadata、processor/thread/projection、memory；Memory/Soul、Knowledge import 和 fork `source_thread_id` 不属于本切片。
- 结果：current 事件使用 append 时钟；消息仍按显式 itemId 去重、按 Item terminal 收口，快照保持覆盖语义；Item ordinal 来自 canonical event log sequence；工具/推理/审批/输出引用的 current 元数据继续保留。
- 失败终态：重复 lifecycle start、错误 owner、完成后迟到更新、退役 raw tool wire 继续 fail closed；terminal tool 不得被 in-progress 事件复活。

## 有效风险与迁移

1. imported Codex 时间戳分支只用于离线历史重放，当前 append 时间与回合状态更新继续共用同一个 timestamp。
2. imported message 无 identity 时绕过按 Turn 合并、带 identity 的 delta 被视作 completed 均属退役旁路。普通显式 itemId、commentary/final phase、累计文字/媒体快照、正文缺失终态不能丢失。
3. imported Plan 使用 `ItemId::from_legacy` 和旧 import delta completed 状态不再可达；统一当前 `ItemId::new` 与事件生命周期状态。普通 canonical event sequence/ordinal 和增量分页身份必须保持。
4. lifecycle 的 ordinal、phase 和通用 metadata 具有 current 风险，保留并用普通 reasoning fixture 验证；只移除 import/sourceClient/sourceProvenance/importVersion/sourceEventSeq 专属复制。
5. 文件读取的 eventClass/operation/toolName 是有效的只读判定来源；改为 current file-read fixture。审批 source/cache、工具 workflow/source、source_event_ids/type、provider metadata 和 outputRefs 保留。

## 验证与退出条件

- 先运行受影响 App Server 模块的 Rust 定向测试，使用仓库 `npm run test:rust:unit` runner 与统一 resolver；必要时由 root 汇总全 crate。
- 对当前 owner 做 scoped retired-marker 扫描与 diff/格式检查；治理删除运行 legacy-report。普通注释遵循 Rust 文件既有英文风格。
- 退出条件：生产写集中无 import 专属判断/透传；有效正向迁移到 current fixture；消息 lifecycle、工具 terminal/identity、推理 snapshot、canonical ordinal/分页回归通过。
- 真实 GUI/sidecar 产物由 root 在 Rust 稳定后统一重建；本次 Rust 单测不冒充 Electron Gate B。

## 本切片验证记录

- 指定 11 个 Rust 文件的 `rustfmt --check --edition 2021 --config skip_children=true` 通过，未递归格式化其它 owner。
- Scoped `git diff --check` 通过；生产与迁移测试写集的 `import`、`sourceClient`、`sourceProvenance` 和旧别名扫描零命中。
- `npm run governance:legacy-report` 通过：边界违规 0、分类漂移候选 0。退役导入入口按 dead/deleted 记录。
- `runtime/tests/external_events/canonical_tool_items.rs` 的 import marker 测试继续保留为负向回流守卫，防止标记绕过 retired raw tool wire 拒绝；不属于旧功能正向入口。
- App Server 定向 Rust 使用统一 runner/resolver，三组全部通过：`runtime::thread_item_projection` 73 项，`runtime::event_store::canonical_message_lifecycle` 10 项，`read_session_projects_runtime_events_into_thread_read_tool_calls` 1 项；合计 84 项，0 失败。
- 冻结源码清单与完整测试日志保存在 [本切片证据目录](artifacts/conversation-projection-cleanup-20261020/frozen-source.json)。冻结后 11 文件 SHA 复核零漂移；未另开全 crate、sidecar 或 GUI 构建。
- 统一编译出现三个写集外的 Memory 警告：`RolloutStatus` unused import、`heartbeat_stage1` dead code、`Review` never constructed；已交 root，不越界修改。
- sidecar 与真实 Electron 仍由 root 集中重建、验收；此处不以 Rust 单测冒充 Desktop Gate B。

分类：current 保留 canonical 事件/投影 owner；compat/deprecated 新增 0；import-only 分支为 dead/deleted。本切片实现与定向验证完成度 100%；整体 GUI 对齐与真实产品验收继续由根计划持有，仍为 partial。
