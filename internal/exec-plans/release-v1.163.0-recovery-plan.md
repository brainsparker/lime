# v1.163.0 发布恢复

状态：active / 修复远端失败，合并新增候选；尚未重新发布。

## 目标与授权

- 用户要求完成 v1.163.0 发布，将新增改动纳入同一版本，并明确要求不再确认。该授权覆盖必要的提交、main 推送、同版本标签更新及重新发布；不创建分支或 worktree。
- 初次候选提交为 `fb725030e8cb26f31108b115d49c22990f475661`，tree 为 `022822d6cd01804b5281dfc520dacb7d92e285d3`，main/tag 均已推送。原始范围和门禁见 [首次发布计划](release-v1.163.0-plan.md)。
- 新候选纳入当前新增产品、测试、规则和文档，继续排除本地研究文件 `local-conversation-page-a83a1af2c24b.js` 和构建缓存 `tsconfig.node.tsbuildinfo`；保留原文件。不覆盖并行源码。
- 当前 owner：现有 Forge、Electron updater、App Server/runtime、共享侧栏和 Composer。compat/deprecated 不新增；不恢复旧 Harness 入口或生产 mock。

## 失败与修复

初次 Release [39268570286](https://github.com/limecloud/lime/actions/runs/39268570286) 的 Windows 和 macOS arm64 失败；已请求取消余下任务，避免旧候选继续发布。初次 Quality [39268500181](https://github.com/limecloud/lime/actions/runs/39268500181) 的 Integrity、Bridge & Contracts、GUI Smoke 和 Windows Shell Runtime 通过，Frontend Full 和 Rust Full 失败。

1. 侧栏测试错误要求 `toggle-harness` 存在。迁移为旧入口不存在、共享侧栏入口可展开的行为断言；定向 7/7 通过。
2. macOS 已完成公证及 stapling，随后 `stapler validate` 遇到 CloudKit `NSURLErrorDomain -1005` / Error 68。提取共享的临时票据错误识别与有限重试，仅重试同一产物验证；永久错误、Developer ID、签名团队和 Gatekeeper 检查继续 fail closed。
3. Windows N−1 已安装应用在切换设置时按钮脱离 DOM。导航改为根据当前可见入口重新定位，仍以真实 updater 非 idle 会话、候选下载及安装结果作为验收，未直接调用第二次 native check。
4. Rust 两条快速 external backend 流式夹具未消费 stdin 请求即退出，可能在调度压力下先于请求写入结束。夹具先消费请求，失败夹具使用自然退出码以确保部分 stdout 被排空；不修改生产协议或延长断言预算。
5. 新推理完成快照将显式空数组视为权威替换；两条旧测试仍将其当作缺正文的生命周期通知。迁移为缺正文保留、显式空数组清空两种输入，并分别验证增量投影和落库结果，不恢复旧生产语义。
6. 发布守卫递归扫描本地 `.lime` 验证副本导致正向测试超时。将该生成目录与已有 target/dist 排除项统一处理，补充忽略本地产物的回归；源码目录中的旧打包文件仍被拒绝。

## 窄写集与验证

- 本轮直接认领：侧栏测试、`app-server/src/tests/streaming.rs`、canonical store 与 incremental projection 的上述两条旧测试、发布守卫及测试、macOS 票据/信任脚本及测试、Windows N−1 导航及测试、双语发布说明、计划跟踪例外和发布计划。
- 并行增量只读审阅后纳入候选；不夹写 runtime、模型历史、完成快照、Markdown 引用及 Composer 的进行中实现。
- KISS/DRY：复用现有发布链，票据错误识别及重试由单一脚本 owner 提供；SOLID/YAGNI：不新增发布器、runtime 或兼容层。
- macOS/Windows 发布脚本回归 4 文件 54/54，随后补充票据验证预算耗尽测试 8/8（含前轮重跑）；release workflow guard 通过。真实平台结论仍须重新运行远端打包门禁。
- 初次最新 App Server lib 回归为 2001/2002，一条 Skills watcher 原生目录事件测试超时；该用例已单独复测 1/1 通过，未改生产 watcher；完整回归仍待最终结果。
- 完整 typecheck、contracts 和版本一致性通过。新增前端 12 文件 299 项与结构化提交 8 文件 71 项均通过；backend-file 的 Node 原生测试 1/1 通过（最初误交给 Vitest 得到无 suite，已用所属测试器验证）。
- 修正后的流式夹具 4/4 通过；新 GUI 的 Renderer/Host 重建完成，等待最新 App Server 侧车；App Server 完整 lib 回归进行中。后续新推理完成快照及 nested snapshot authority 修正按本轮用户授权一并纳入，公共验证仍在进行。所有日志位于 `.lime/release/v1.163.0/`。
- 最新 App Server lib 为 2000/2005：两条快照旧断言已迁移，两个导入性能测试及一条 watcher 在高并发本机构建中超时，按原预算单独复测。直接启动测试二进制首次因缺少 Cargo 注入的 sherpa 动态库路径未执行测试，随后显式提供本地依赖目录重跑，未改系统设置或性能阈值。
- 快照边界复测初次证明了旧预期仍与 canonical 嵌套事件冲突：缺少正文的 typed item 先被误判为 snapshot。修正 `canonical_item_from_event` 仅在 `summary` 与 `content` 均为数组时标记权威快照；定向 canonical/projection 2/2 通过，`rustfmt --check` 通过。
- 发布守卫命令通过，完整守卫回归 44/44；新增文件树持久化与相关状态回归 6 文件 43/43。并行 GUI 候选 102 的独立矩阵出现正常 Main 退出超时，不作为本版本成功证据，保留原报告；本版本正式 GUI smoke 独立执行。

## 退出条件

1. 新候选源码、依赖、版本和双语说明一致，相关门禁通过并记录漂移。
2. 正常提交钩子通过；main 与 v1.163.0 指向同一新候选。更新标签使用旧 SHA 租约，拒绝覆盖未知远端更改。
3. 新 Release 的三平台桌面构建、平台门禁、产物发布、R2 更新源及四平台 CLI/npm 发布完成，核对实际公开 Release 与 assets。
4. Quality 新候选检查完成；如出现失败，继续定位修复，保持同一版本的产物与源码 identity 一致。
5. 收尾记录实际完成度、产物/CI 链接和剩余产品验证边界；GUI/runtime 整体对齐不随发布自动核销。
