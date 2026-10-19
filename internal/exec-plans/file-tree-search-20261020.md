# Files 搜索复用共享树

状态：源码已冻结，定向验证完成；root 已完成架构复核，待统一产品进程验收。负责人：rea_sidebar_alignment_audit。主目标：按[REA 调查](../research/codex-desktop-rea/file-tree-interactions-audit-20261020.md)将 current 平面搜索结果替换为唯一共享树 Renderer，不增加未证 rename/多选/菜单行为。

窄写集：`right-surface/WorkspaceFileTree.tsx`、`WorkspaceDirectoryTree.tsx`；新 `FileTree.tsx`、`fileTreeRows.ts` 与纯投影/搜索组件测试；必要时迁 `WorkspaceDirectoryTree.test.tsx`、`WorkspaceFileThreadSidePanelTab.test.tsx` 的旧断言。上述目标实施前 git status clean。架构仅约5681的目录 renderer 段和小图，经 root 授权该窗口。独立报告、计划、`artifacts/file-tree-interactions-20261020/` 保存证据。其他 Files/viewport/目录读取/protocol/Electron/root fixture/build/主计划只读，不覆盖并行改动。

## Verification Contract

- current 链：搜索 input → `searchProjectFiles → AppServerClient.searchFiles`；root/query 结果身份 → 纯树行投影 → 同一 FileTree/viewport/sticky → 既有 onSelectFile → canonical 文件标签。目录缓存与文件读取仍归现 owner。
- 显示状态：搜索命中生成临时层级/祖先/flatten 投影，不伪造或写回 DirectoryListing；query 构成 resetKey；搜索局部展开/选中不覆盖普通目录展开或业务标签身份。
- Happy path：输入命中目录树，祖先初始展开、单目录链 flatten；方向/Home/End、单击 preview、双击非preview、虚拟化/sticky 沿同一 renderer。清空恢复普通目录，输入焦点保持。
- 风险/终态：空、错误、root/query 在途与迟到、卸载、旧选中/展开残留、Windows 操作路径、超大命中集、共享面包屑回归。
- 必跑：纯投影与实际搜索 DOM 组件、既有目录/viewport/文件标签/面包屑定向回归；scoped lint/Renderer tsc/format/docs/diff。新实现冻结后交 root 唯一 renderer freshness、GUI smoke 和真实 Electron Gate B；本任务不构建。
- 架构：Renderer 展示职责拆分，无新协议、业务 authority、目录持久化或 runtime。root 复核更新图后记录确认；未确认不标产品验收完成。
- 退出：行为、结构/清理、定向验证分别结算；compat/deprecated 新增0，平面搜索分支删除。当前不能宣称完整 Files/GUI 对齐或原生/Windows 进程验收。

## 记录

- REA58/37/43/59 完整 gzip 重新摘要核对、解压和 JSON 解析通过；仅为缺失 xka helper 补264bytes聚焦分析，未执行参考。
- root 已确认首刀与架构局部写窗口，禁止独自构建与覆盖并行产品写集。
- 已将原目录 DOM/键盘/viewport/sticky 移入唯一 `FileTree`，目录适配器只投影真实 cache；删除 `WorkspaceFileTree` 平面搜索分支与重复 Renderer，搜索命中进入纯临时路径树，按 root/query 重置并拒绝旧 scope。
- 新增 6 项纯投影、9 项真实 DOM 组件回归；既有目录/viewport/文件标签测试未修改。首轮 5 套 34 项通过；扩大到面包屑和排序消费者后 8 套 53 项通过；补充 `/` 根工作区绝对祖先身份后最终 8 套 54 项通过，零 act warning/未处理异常，见 `artifacts/file-tree-interactions-20261020/search-final-tests.log`。
- scoped eslint、format、docs boundary、legacy report、diff check 均已 exit 0。Renderer tsc 初轮发现新 FileTreeRow 状态 union 无法按 kind 排除，已拆三个独立 discriminant 后 exit 0；因执行期间包含根路径补丁，另跑冻结版本亦 exit 0（`renderer-tsc-frozen.log`）。最终命令与日志摘要见 `validation.json`，冻结后 6 源 SHA 零漂移见 `source-drift-check.json`。
- 已在 architecture 目录 Renderer 段补唯一 FileTree 与两类纯投影图，并向 root 发确认请求；root 于2026-10-20核对实际目录/搜索投影、唯一Renderer和业务读取/打开依赖，并确认该图；产品进程验收仍独立结算。
- 6 源/测试已冻结，清单 `artifacts/file-tree-interactions-20261020/source-freeze.json`，SHA256 `b5c023cc6b6185dd61dd761c20f27b445cb8fd5f4a92031104ae0415fab8331a`；冻结后不再修改产品，交 root 统一 freshness 与真实 Electron。

## 分类与验收边界

| 分类                | 最终落点/动作                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| current             | `FileTree` 唯一 DOM/keyboard/viewport/sticky；`WorkspaceDirectoryTree` 真实目录薄适配；`fileTreeRows` 目录与搜索纯行投影；`WorkspaceFileTree` query/root 请求显示身份 |
| compat / deprecated | 新增 0；无 alias、包装旧平面分支或第二 cache                                                                                                                          |
| dead / deleted      | 原平面搜索 button map；原 `WorkspaceDirectoryTree` 内联重复 DOM 和目录投影（迁入唯一 owner，旧位置删除）                                                              |
| test-only           | 两个新增纯投影/DOM 测试；组件测试明确 mock fuzzy gateway，不冒充跨进程执行                                                                                            |
| open                | 完整原生 target、Files 树/内容/标签菜单；通用多选和重命名的产品开启证据；root 统一真实 Electron 与 GUI smoke                                                          |

本切片不改协议、Electron、Rust、gateway、真实目录缓存、viewport 算法或现有用户文案。主题、多模型和首页 Banner 继续原 owner。KISS/DRY 通过唯一 Renderer 与纯行投影实现；搜索视图状态留在 surface，业务读取/打开 authority 保持现有 owner。研究、已证搜索行为、结构与清理各 100%（分母仅本切片）；真实产品进程验收未完成，完整 Files/GUI 完成度由主计划结算。

Root 产品验证认领 `scripts/electron/lib/thread-side-panel-new-tab-scenario.mjs`：迁移旧平面列表的相对 title 选择器为 canonical 绝对路径；在隔离工作区增加真实嵌套文件，走现有 fuzzy gateway，验证单目录链 flatten、treeitem 层级及方向键焦点，再复用原 preview/固定标签/编辑器生命周期场景。只改 fixture，不恢复旧产品 DOM；后继由现有 claw-chat 的 right-surface-visual-matrix 场景执行，真实进程结果另记。
