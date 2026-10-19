# Files 文件树交互对齐核查

状态：静态调查、搜索共享树与本地文件菜单纵切已实施；完整菜单和真实 Electron 验收分别结算。本文区分通用框架、工作区消费者与 Lime 实现，不由缺少截图推断源码缺失。

## 来源与限制

目标为 `/Applications/ChatGPT.app`，Codex Desktop `26.1007.30912 / 20156`。本轮重读 ASAR SHA256，仍为 `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。没有执行参考应用、bootstrap 或原生 helper；当前 flags、账号与 OS 实际菜单仍未观察。

优先复用[工作区消费者报告](workspace-file-tree-consumers-audit.md)与以下完整 REA 记录；四份 gzip 均重新核对摘要、完整解压并解析 JSON，见[完整性收据](../../exec-plans/artifacts/file-tree-interactions-20261020/reused-evidence-integrity.json)。`.readable` 只帮助阅读，范围与摘要以原始成员和提取记录为准。

| 记录                                                                                                                                               | 已证范围                                                                                                      | 限制                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| REA58 `ev_00921a8c268f2a8a8545c0d31c671d616f9432f2f8a5c29d51216e6f07e3c286`                                                                        | base tree、正常/搜索/审阅消费者、目录 query、文件与标签菜单 wrapper；6 文件，96,244 bytes，32,076 AST，parse0 | 静态接线，语义覆盖 unknown                             |
| REA37 `ev_5a4cce6772170c93ab2a3f0fee5c820611a9624810cba56f4468bb5f8eed5ef7`                                                                        | bka/xAa/TAa/EAa/DAa 完整行/树语义                                                                             | 292 semantic unknown；不代表产品开启所有框架功能       |
| REA43 `ev_45f94bb253033bec57cfe9b6ae8a3fb696432a4b32a3803181805756c81b8075`、`ev_5fb0a8d763a1246e424944a45b8bc2be242d4b54db2902e326a555dd8563df2a` | viewport、sticky、可见窗口依赖                                                                                | 239 semantic unknown；不证明运行布局                   |
| REA59 `ev_53927f67a2cde7b59bb3ed9522076db3a31922f78516c1a9a87024256def3729`                                                                        | hsa/gsa/ysa/bsa/msa 五个完整文件/标签菜单 builder                                                             | 不包含完整原生 target provider、library 菜单或运行结果 |
| REA36 `base-file-tree-interaction-evidence-36.json` 与 REA34 controller/model                                                                      | OAa 输入与 ODa 选择/重命名/搜索状态；完整惯性声明                                                             | 压缩局部名不是原始开发命名；产品开启条件需继续看消费者 |

原 interaction 提取未包含指针修饰键决策 `xka`，本轮只补该 264-byte 完整函数，没有重跑整个安装包。新 parent 为 `ev_8da784365573ec4cf8669d8de4f30f73273313223f8b94ef894dac3829f3b6c2`；1 文件，84 AST，parse0，findings0，17 semantic unknown；coverage=unknown、truncated=false、omitted nodes/relations=0。原 initial 成员 SHA 为 `604b5d2de4fbb41f3d0dc5b3662129c558e1c7b8aac8cc87225286f58dcfaf8f`，UTF-16 `[5822573,5822837)`、byte `[5834106,5834370)`，函数 SHA 为 `846c0ccaa7da112ee0386fe3b5c0572ce8b587fb22c26f61e579b689257bc65c`。见[提取来源](../../exec-plans/artifacts/file-tree-interactions-20261020/source-manifest.json)与[完整 REA](../../exec-plans/artifacts/file-tree-interactions-20261020/rea-evidence.json)。新记录仍是静态证据，不能提升成事件执行证据。

## 可确认的导出与 current owner

| 实际安装包符号/导出                                                                                                            | 已证职责                                                                                             | Lime current owner 与边界                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `base-file-tree-651d700763e3.js` 的 `Le as t`，正常消费者 import 为 `Ct`                                                       | paths、selectedPath、expanded/scroll 状态、28px、外层文件菜单；内建 search=false、stickyFolders=true | `right-surface/FileTree`、`WorkspaceDirectoryTree`、`useFileTreeViewport`、`fileTreeViewport`；不是可确认原名 `BaseFileTree`        |
| 同成员 `Me as r`                                                                                                               | 从 native composedPath 找 `data-item-type=file` 的 `data-item-path`                                  | FileTree 外层菜单按同一 native composedPath 提取真实文件路径                                                                        |
| initial `qAa as klt`，由 base `Ee` 构建                                                                                        | framework model、注册/清理与选择回调                                                                 | 目录缓存仍归 `useCanvasWorkbenchFileTreeState`；Renderer 不复制该业务读取 owner                                                     |
| initial `ODa`、`OAa`、`EAa`、`Yka/Jka/ZOa`                                                                                     | controller、交互、树行、viewport/sticky                                                              | 现 `FileTree`、`fileTreeRows` 与 viewport 纯投影；这些局部压缩名不能拿来改 TS 函数/类名                                             |
| side-pane 的 `qt/Jt/Yt/Gt/Zt/Qt`                                                                                               | 工作区目录、普通/搜索树、搜索路径投影与打开合同                                                      | `WorkspaceFileTree`、`WorkspaceFileThreadSidePanelTab`、`openWorkspaceFile`；内部原始开发名 unknown                                 |
| `workspace-file-context-menu-trigger…` 的 `d as t`，导入 `cgt`                                                                 | 外部文件入口菜单 wrapper，委托 initial `hsa as cgt`，再到 `gsa`                                      | Lime current wrapper 只交付本地树/标签的 Save as、Copy path 子集；参考不直接追加 library 菜单，不能与树行或标签菜单混成一个 builder |
| `workspace-file-tab-context-menu…` 明文导出 `getWorkspaceFileTabContextMenuItems` / `prefetchWorkspaceFileTabContextMenuItems` | 文件标签菜单与同一 target query 预取                                                                 | 本地子集已用明文 getWorkspaceFileTabContextMenuItems；target query/prefetch 与完整菜单仍缺                                          |

仅最后两个明文导出可按原名称直接对齐。其余组件/类采用短领域职责名，报告保留映射，不伪造已恢复原始 TS 目录或类名。

## 多选、键盘与重命名

通用 controller 使用 selection Set、anchor、selectionVersion。`xka → OAa → ODa` 的已证指针规则为：

| 输入           | 通用框架决策                                           |
| -------------- | ------------------------------------------------------ |
| 普通单击       | single；目录才 toggle                                  |
| Ctrl/Meta 单击 | toggle；目录不 toggle                                  |
| Shift 单击     | anchor 到目标的可见范围；Ctrl/Meta 同时按下则 additive |
| sticky 行单击  | 上述选择规则，同时 reveal canonical；关闭内建 search   |

`OAa` 还处理 Shift+上下扩选、Ctrl/Meta+Space 切换 focused selection、Ctrl/Meta+A 全选可见行。无修饰方向键改变焦点/展开，不自动打开文件；Home/End 到首末。IME 与普通文字输入的消费条件独立。

这些框架能力不等于工作区批量操作合同：`Le` 只接受一个 `selectedPath`，selection 回调把 `e[0]` 写入状态；`qt/Zt` 从选择数组取首个非目录路径打开 preview。`Le` 的 `Ke` effect 在受控路径/paths/resetKey 等变化时把集合归一成该单一路径。搜索 `Yt` 也只从命中数组取一个文件，没有批量打开/删除。由静态代码可以确认修饰键分支存在，以及受控单一路径回写；持久多选的最终交互与每种 rerender 时序仍须运行观察。当前 Lime 明确只有 `selectedPath`，不能把未实现整套通用多选或批量菜单写成已对齐，也不应先新增未经确认的产品行为。

重命名在 model/controller 由 `renaming` 显式启用，`OAa` 的 `renamingEnabled` 默认 false；开启后 F2、Enter 提交、Escape 取消、blur 提交属于通用框架。当前 `Le` 构建 model 没有传 renaming，正常 `Jt` 和搜索 `Yt` 也没有开启；已读树菜单及 REA59 五 builder 未提供 rename/delete。结论限定于这些 current 工作区消费者：**此切片不应新增 rename/delete**，不能用通用框架支持证明产品必须显示。其他消费者或未来版本不在该否定范围。

## 右键与文件菜单

必须区分三条链：

1. 树行：`Le` 的 native `onContextMenu → Me` 只提取 file 路径，`je` 将 display path 映回真实 target。外层 menu `awaitBeforeOpen=false`，`We` 预取同一 query，`Ue` 使用同一目标/可用性快照，`Oe` 按实际参数选择 review 文案族的 Open with、可用 Save as、Copy path、hostId 存在时 Add to chat。loading 显式 disabled；target 为 null 返回空项。正常树仅 `environmentId == null` 开启；搜索分支仅在无 environment 的本地 query 下出现。
2. 文件内容/menu trigger：`cgt → hsa → gsa`，按 capability、host、openMode 组织 View file / View in Codex Browser、preferred/Open with、条件 GitHub、Save as、Copy path、非 workspace Copy file contents、本地 Reveal path。wrapper 透传 children 之外的参数；已读声明不能证明编辑器整块内容实际挂载该 wrapper，更不能推断所有消费者传同一 openMode。
3. 文件标签：明文 `getWorkspaceFileTabContextMenuItems` 实际绑定 `ysa`，`prefetchWorkspaceFileTabContextMenuItems` 绑定 `bsa → msa`。`ysa` 调 `hsa` 时只传 cwd/hostId/path，不传 openMode；存在 libraryFileId 才 prepend 独立 library builder。它与内容 wrapper 共用底层 gsa，但不是同一个入口。不能把“工作区文件标签”按名字等同于 `openMode=workspace`，也不能复制树的项目列表充当标签菜单。

本轮实施前 `WorkspaceDirectoryTree/WorkspaceFileTree` 没有右键 handler，Files 文件标签也没有上述同义 builder；现本地菜单纵切见文末。已有 Artifact/Canvas 的 Copy/Reveal 按钮是有效 current 能力，不能据其存在宣称已实现 Files 菜单。完整原生 target discovery/readiness/preference owner 仍是[已登记缺口](../../exec-plans/artifacts/codex-shared-page-header-20261018/thread-controls/file-open-contract.md)，现 `FileShellHost` 只有 default open/reveal/file icon/独立预览窗等部分能力，save-copy 归既有 App Server 文件能力；不能填固定应用列表或假可用菜单。

通用 composition 的 Shift+F10/ContextMenu 仅在自身 context menu 被启用时执行；base 外层菜单与该 composition 是不同链。此轮没有证据断言完整 OS 键盘菜单或目录菜单必定启用，不在首刀增加。

## 搜索与 sticky：明确的实现差距

上游 `qt` 持有外部 query；`environmentId != null` 时不显示搜索。query 非空转 `Yt`，否则转 `Jt`。`Yt/Gt` 对命中 path 去重并转换树路径，将目录层级交给同一 `Ct/Le`：`flattenEmptyDirectories=true`、命中文件的祖先初始展开、`resetKey=query`，内建 tree search 仍 false。loading 与 no matching files 各有终态。selection 打开 preview，double-click/open 打开非 preview；这部分 Lime 已在 current owner 接线，不能回退。

Lime 目录模式此前已具备 28px、overscan10、层级/同级 ARIA、单 Tab 焦点、parked 离屏焦点、sticky 父目录和 push-off，以及同一 canonical 路径回调；已有真实 Electron 证据在原计划，不能因为本轮没截图而说其未实现。实施前 `WorkspaceFileTree` 的**搜索模式是普通 button 列表**，直接显示 `file.path`，绕开共享树，因此缺少相同层级、flatten、树键盘、viewport、sticky 和 query reset 的树状态。本切片已删除该分支，目录与搜索均委托唯一 `FileTree`。

原 query effect 使用 current 标记阻止已失效 Promise 写入，属于有效保护；但原结果不是 root/query 的带身份投影，切 root/query 到下一请求期间仍可能展示上一 scope 的旧结果。现保留该生命周期保护，并将 loading/ready/error 结果绑定 root/query；只有匹配当前身份才可显示，失败、清空和卸载不回流，没有改变 App Server 的 fuzzy query authority。

sticky 基础已经实现，不重写算法。搜索改用同一 Renderer 后自然复用 viewport/sticky；继续验证 sticky overlay 不重复暴露 treeitem、父层背景/层级、折叠后的 canonical focus 与离屏行，不另起一套 sticky/search tree。

## 实施写集与验证

本切片已直接替换平面搜索分支，目录列表与 fuzzy 命中通过纯视图投影进入一个共享 Renderer。真实目录缓存继续由原 owner 加载；搜索祖先与 flatten 是临时视图投影，不伪造 DirectoryListing 写回缓存，也不增加持久文件 store。root/query 构成搜索显示 scope；query 改变重置本次搜索的展开与焦点，清空回到原目录展开状态。搜索输入不因结果刷新失焦。

实际产品与测试写集：

- `right-surface/WorkspaceFileTree.tsx`：删除平面结果 Renderer，持有带 scope 的搜索结果，接相同树与 reset 生命周期。
- `right-surface/WorkspaceDirectoryTree.tsx`：保留目录数据适配入口，将唯一行 Renderer 拆给共享 `FileTree.tsx`。
- 新 `right-surface/FileTree.tsx`：承接已有 DOM/键盘/viewport/sticky，不更换 owner 或静态样式。
- 新 `right-surface/fileTreeRows.ts` 及定向测试：真实目录与搜索结果的纯行投影、去重、祖先展开、单目录链 flatten；不请求网络或写 cache。
- 新 `WorkspaceFileTree.component.test.tsx`，覆盖实际 input、DOM 与在途状态；既有 `WorkspaceDirectoryTree.test.tsx` / `WorkspaceFileThreadSidePanelTab.test.tsx` 无需修改，其有效迟到保护风险继续通过。
- 执行计划与 architecture 对应文件树 owner 段；改图由 root 核对后才能标记该结构切片完成。

定向回归已证明实际搜索 input → mocked current fuzzy gateway → tree/treeitem → 键盘回调，含 preview/nonpreview、query 改变展开/selection reset、清空还原目录展开、输入焦点不丢失、root/query 在途/迟到、空/错误、POSIX 根/Windows 操作路径与 500 结果 viewport/sticky；复用现五语文案。共享目录/viewport/文件标签/面包屑/排序最终共 8 套 54 项通过，见[定向日志](../../exec-plans/artifacts/file-tree-interactions-20261020/search-final-tests.log)。这是组件和纯投影证据，未执行真实 fuzzy App Server 或 Electron 进程。最终静态门禁与源码冻结见[执行计划](../../exec-plans/file-tree-search-20261020.md)，renderer freshness、GUI smoke 与 Electron Gate B 交 root 统一执行；本子任务没有构建。

current 为唯一 FileTree、目录与搜索的纯行投影、既有目录/预览 owner；compat/deprecated 新增 0；dead/deleted 为旧平面搜索分支与内联重复 Renderer/目录投影。研究、已证搜索行为、该切片结构和清理各 100%（分母仅此切片），产品进程验收待 root 结算，不能由此宣称完整 Files 或 GUI 已对齐。完整原生 target/file-tab/content 菜单仍 gap；通用多选及重命名的产品开启边界保持上述静态限制。

## 菜单后继只读核查：入口与实际启用条件

本节由 root 单独安排，只更新本文；6 个冻结源码/测试、architecture、执行计划、fixture 与构建均未修改。继续复用匹配同一 ASAR 的 REA58/59 和文件目标应用记录，没有重跑安装包分析、启动参考应用或执行原生 helper。五个 REA59 提取文件逐项重验 SHA 全匹配，原 initial 成员 SHA 也匹配；原 192 semantic unknown 与未观察 flags 的限制继续有效。

本节修正旧报告一个映射错误：内容 wrapper 导入 `cgt`，而原 initial 明确导出 `hsa as cgt`；标签模块导入 `agt/sgt`，原 initial 明确导出 `ysa as agt`、`bsa as sgt`。因此 **content wrapper 不是 ysa，只有标签 ysa 追加 library 项**。`lgt` 绑定初始化函数 `vsa`，不能把该初始化函数当菜单 builder。两份 wrapper 完整声明已在 REA58；五个 builder 完整声明已在 REA59，此次只是核对同源绑定，不建立新的原始 TS 名称。

| 菜单入口         | 实际静态链与开启条件                                                                                                                                                                                                                            | 明确不能由该链推出的行为                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 普通工作区树     | `qt → Jt → Ct/Le`，`Jt` 仅在 `environmentId == null` 传 `contextMenuEnabled=true`；`Le` 的外层菜单按 native composedPath 寻找 file 行、映射真实 target。`awaitBeforeOpen=false`；打开前预取同一 target query，loading 时显示 disabled Open in。 | 目录右键、全体 row 的 composition 菜单、rename/delete、批量文件动作。`renderContextMenu` 的通用可选能力不是这条实际链。                                                      |
| 工作区搜索树     | `qt` 在无 environment 时才使用非空 query；`Yt → Ct/Le` 没有关闭外层菜单，沿 base 默认启用；路径来自 `Gt` 的 displayPath/真实 path 映射。                                                                                                        | 不能把显示的 flatten 目录名当文件操作路径；不能把 environment/remote 场景按本地静态分支开放。                                                                                |
| 文件内容 wrapper | `d` 把 children 以外的参数透传给 `hsa`，通过共享 MenuTrigger 的 `getItems` 生成菜单。`hsa → gsa`；没有 library prepend。                                                                                                                        | 后继完整消费者补证见文末：Files 相关入口是面包屑按钮；另有附件、资源卡和 turn diff 行。**不能给整个 CodeMirror 编辑面一律加同一文件菜单**，也不能一律传 openMode=workspace。 |
| 文件标签         | 明文 `getWorkspaceFileTabContextMenuItems → ysa → hsa → gsa`；`ysa` 只向 hsa 传 cwd/hostId/path，没有传 openMode；有 libraryFileId 才前置异步 library 菜单。预取为 `prefetchWorkspaceFileTabContextMenuItems → bsa → msa`，同一 target query。  | 文件来自工作区，不表示内部 openMode 是 workspace；不能直接照搬树行项目或把 library 菜单无条件加入本地文件。                                                                  |

实际标签注册也有旁路：同源 initial 的 artifact 标签在 `hostId === durable` 时直接走 library builder；source 标签在 `path == null || Ql(hostId)` 时走 library builder，其余才调用上述明文 workspace builder，传 cwd/hostId/path/libraryFileId。`Ql` 的完整含义未在本轮恢复，保留符号条件，不扩写为全部 remote。这里是对**保留原成员的局部原文核对**，不冒充 REA59 分析范围包含完整注册模块：两处 2,000 字符上下文分别为 UTF-16 `[5405357,5407357)`、byte `[5416864,5418864)`、SHA `9cccb2137f1ccdae3bcea3c8a913a8a5055dcdd07889c7750fbdc102d3b1a889`，以及 UTF-16 `[5512200,5514200)`、byte `[5523715,5525715)`、SHA `7bffd7d4371aaef32bd7df468bc5a499fc9728b746bd2d9d74876ba99d1c5be6`。没有由局部上下文推断完整注册、运行可达性或当前 flag。

### 逐项合同与顺序

| 项目                        | 树 `Le/Oe`                                                                                                                             | 内容与标签的底层 `hsa/gsa`                                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首选应用/Open in            | 首选目标存在时放前部；目标未加载先给 disabled loading；不存在目标仍可保留后部动作。打开携真实 path/appPath，`persistPreferred=false`。 | hsa 等待 target query 与可选 GitHub 查询，两项失败各自归 null；gsa 从同一 query 计算 primary/visible targets。普通模式按共享 target builder 输出首选及 submenu；可在应用内浏览器查看的本地文件分支改为 Open with submenu。 |
| View file / View in browser | 此树 builder 没有独立项目。                                                                                                            | `openInSidePanel=true` 才给 View file；否则需非 workspace、browser capability、非 remote host、路径分类 predicate 同时成立才给 View in browser。不能硬编码全文件支持浏览器；view 动作与外部 target 动作的参数不同。        |
| GitHub                      | 此树 builder 没有独立项目。                                                                                                            | 只有 hsa 可选查询返回非 null 链接才给 Open in GitHub；cwd 缺失或 openMode=workspace 时不查。host config、path、line 进入查询；不能仅拼接项目名/分支猜链接。                                                                |
| 分隔线                      | Open in/loading 与尾部动作之间一个分隔线。                                                                                             | primary 或 GitHub 至少一个存在时，才在 open 部分后放分隔线；不能在空组仍画分隔线。                                                                                                                                         |
| Save as                     | saveCopy capability 存在时添加，排在尾部动作第一位。                                                                                   | 仅非 workspace 且 saveCopy capability 存在时添加；标签 ysa 没传 workspace，因此不能按标签名称把该项删掉。                                                                                                                  |
| Copy path                   | `Le` 总是传入非 null 的 copy 回调，因此实际文件树尾部包含；builder 的回调可选只是通用参数形状。                                        | 总是有，使用 cwd/path 解析后的操作路径；原生 clipboard 失败回共用复制 helper。                                                                                                                                             |
| Copy file contents          | 此树 builder 没有该项。                                                                                                                | 仅非 workspace；调用原文件读取 query/cache，不取路径字符串或预览截断文本。尚未把此 helper 完整纳入本轮 REA；编辑器未保存草稿是否参与没有新结论。                                                                           |
| Reveal path                 | 此树 builder 没有独立该项；fileManager 可作为真实 target 的一种出现，取决于 target query。                                             | 非 remote host 才有；平台文案为 Finder/Explorer/File Manager，动作仍用同一 `fileManager` target。                                                                                                                          |
| Add to chat                 | `hostId != null` 才给；通过 `add-context-file` mutation 携 hostId/path。                                                               | 本次五个 builder 没有该项，不能从树菜单复制进来。mutation 的新/当前会话、聚焦及 host 行为仍需单独证据。                                                                                                                    |
| Library                     | 此树 builder 没有。                                                                                                                    | 只由标签 ysa 在 libraryFileId 存在时追加到头部，内部 library builder 未在本轮核查，不填占位项。                                                                                                                            |
| Rename/delete/multi-select  | 实际消费者未开启 rename；无对应菜单项目，选择仍归受控单一路径。                                                                        | 本次五 builder 无 rename/delete/bulk 项。通用框架存在相关机制不构成该产品菜单合同。                                                                                                                                        |

顺序、分隔线、loading、null target 和 capability 都是 builder 的输入输出合同，应在后继测试当前 owner 上验证；不要以任一菜单数组“包含这些文案”替代完整接线。

文案选择还有一个容易误判的实际分支：`Oe` 用 `onCopyPath == null ? workspace : review` 选择 message 族，而 `Le` 实际总传 imported `TT` copy 回调；所以该实际树会选 review 族的 `Open with`/`review-file-tree-open`，不能只看工作区组件名就套 `Open in…` 文案。这里核对了原始 base 成员的完整 Oe 与 Le 接线，并非只看 readable 副本。后继按输入合同和实际消费者校准文案、ID 与五语言；不要将这两个分支混成自选的第三套产品词。

### Lime current owner 映射与可实施范围

以下是读取当前源码得到的映射，不是本轮新实现，也不将已存在但不同语义的能力计作 Files 菜单完成。

| 参考职责                   | Lime current owner / 事实                                                                                                                                                                                                                                            | 后继边界                                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 树目标 identity 和菜单触发 | 冻结 `FileTree` 已有 file/folder、data-item-path、真实 path 回调；`WorkspaceDirectoryTree` 与搜索共用它。调查时无 Files context handler；现接入见文末。                                                                                                              | 可在唯一 FileTree 外层接文件专用菜单；保留 native composedPath→file-only、搜索 display/操作 path 区分及 tree pin-exempt。禁止目录项、另一树 store 或每行第二套 controller。                                                                  |
| 文件标签菜单与预取         | `RightSurfaceTabStrip` 按同一 tabId/filePath/contentInstance 展示；调查时无菜单，现本地接入见文末。`threadSidePanelTabs`、`openWorkspaceFile` 和 `useWorkspaceRightSurfaceLocalStateRuntime` 是标签 identity/preview/pin 唯一 owner；关闭经 `useFileTabCloseGuard`。 | 可用可确认的明文 builder 名称建唯一模块，预取和打开复用同一 scope/target snapshot；异步结果校验仍存活的 tab 实例。不能另建 tabs、把菜单关闭绕过 dirty guard，或创建第二份 filePath 选择状态。                                                |
| 文件内容与源码/预览        | `WorkspaceFileThreadSidePanelTab → TextFileEditorTabContent → FileEditorController/CodeMirror`；媒体沿 `CanvasWorkbenchPreviewModePanel/ArtifactRenderer`。`TextFileEditorTabContent` 顶栏已有 `ArtifactPreviewHeader`。                                             | 按文末已证面包屑按钮及各附件/资源卡参数接相应入口；保留编辑器原有文本选择/复制菜单。现顶栏文件主动作不是三类右键菜单的替代品。                                                                                                               |
| 默认外部打开与定位         | `src/lib/api/fileSystem.ts` typed gateway → `electron/FileShellHost`，有 `openWithDefaultApp/revealInFinder/getFileIconDataUrl/openFilePreviewWindow`。已有真实文件与错误传播测试。                                                                                  | 在这个 OS 文件壳扩展 target discovery/detect/icon/open/preference，保持同一 IPC/preload/gateway/catalog。`openWithDefaultApp` 不能假冒完整 preferred/Open in 目标列表；独立 HTML PreviewWindow 也不能假冒 Codex 内嵌浏览器。                 |
| Save as                    | `saveFileCopy` 使用统一 save dialog → current `fileBrowser.copyFile`；`usePublicFileAction` 在原编辑 owner flush，并防 scope 迟到；`ArtifactPreviewHeader` 已委托。                                                                                                  | 可直接复用对话框与复制 owner，按各 builder capability/模式过滤。菜单应复用相同动作 scope；不新增 renderer fs、Electron 字节复制或第二次保存后端。源码草稿与文档 controller 的 flush 边界需分别验证。                                         |
| Copy path/contents         | 当前 UI 有 `navigator.clipboard.writeText` 用法，调查时 Files 无共用菜单复制 owner；现复用统一菜单 action hook。`fileBrowser.readFileBytes`/`textFileStorage` 经真实 App Server 读取；`readFilePreview` 有 2MiB 预览上限。                                           | 本地 copy path 是最小可实施项；完整 contents 必须走现 file owner，不能取 2MiB 预览代替完整内容；clipboard 失败显式终态。不能借用诊断专用 clipboard 文案/业务 helper。                                                                        |
| Add to chat                | 当前 ComposerController 唯一草稿内已有 pathReferences；`usePathReferences([], composerController)` 和 `useComposerAttachments.addPathReferences` 委托它，`createPathReference` 提供路径 identity。`MessagePathReference` 目前没有 hostId。                           | 本地候选接线可复用同一 ComposerController，但要补 reference mutation 的会话/聚焦语义与 host 表达合同；不先宣称 remote 对齐。`useThemeContextWorkspace.addFileContext` 会上传材料、要求主题和项目，是不同业务，不能接来冒充树的 Add to chat。 |
| View file / Changes        | 文件打开归上述 openWorkspaceFile；Changes 归 `ReviewThreadSidePanelTab → CanvasWorkbenchChangesPanel → useCanvasWorkbenchReviewState`，消费 canonical reviewThread/target。                                                                                          | View file 委托同一 Files 标签 owner；Changes 与文件选择保持分工。不能为菜单重建 diff、把本地文件 preview 伪装 review，或直接切换 private review state。                                                                                      |
| View in browser            | 当前右侧 Browser 由既有 Browser surface/coordinator/embedded browser host 维护。                                                                                                                                                                                     | 只有参考 capability 与路径分类合同被确认后才消费同一 Browser owner；不从菜单创建第二 browser runtime，不用默认系统打开冒充内嵌浏览器。                                                                                                       |
| GitHub 链接                | `src/lib/api/projectGit.ts → App Server processor/runtime → services/project_git_service` 已拥有 Git status/diff/commit/branch/worktree。当前这条 typed gateway 未提供文件 GitHub permalink；thread gitInfo.originUrl 只是另一来源的 metadata。                      | 原生 qoa 的 repository/ref/path/line 解析还需完整补证；若增加能力，落在同一 Git service/协议链。不能拼 thread metadata 冒充当前磁盘仓库权威，也不能在 Electron/renderer 再跑 git 创建平行 owner。                                            |
| Library                    | 当前 Files tab 只持 filePath/content instance，没有上述 libraryFileId 路由合同。                                                                                                                                                                                     | 保持真实缺口；不能为展示菜单附会 Lime 材料库业务，也不为未知分支预建 runtime。                                                                                                                                                               |

按已有证据可以先实现本地 **file-only 触发、真实路径 Copy path、capability Save as、明文文件标签 builder 与 identity/迟到保护**，同时迁移文案、五语言和行为断言。这是已实施的本地子集，**仍不能标记完整 Files 菜单对齐**。无真实异步 target query 时不创建空 prefetch 函数；预取入口继续登记为缺口。完整首选/Open in 要先关闭现 FileShellHost 的 target/readiness/preference 缺口；内容 wrapper 的静态挂载已在文末补证，Lime 接线、GitHub、library、Add to chat host/会话语义、OS/remote 运行仍分别开放。没有证据要求提前新增 rename、目录删除或持久多选。

### 清理清单与禁止误删

本次 bounded 搜索已覆盖 `right-surface`、Files 内容入口、源码编辑器、`ArtifactPreviewHeader`、fileShell gateway/Host、projectGit gateway/service 和上述现有消费者，**没有找到一套待删的旧 Files 树/标签菜单模块**。它们当前是能力缺口，不能为了“清理”虚构 dead 文件。明确动作如下：

- 已修正文档把 content wrapper 归为 ysa、把所有 workspace 标签等同于 openMode=workspace 的错误；后继主事实源需采用本节映射，旧 REA 原始记录保持不可变。
- 新菜单交付时直接替换相关触发点，删除同一触发点的重复临时项目数组、过期平面选择器/正向断言与 hardcoded 可用 app 列表；本轮未发现这些 app 列表存在于当前 Files，因此这里是实施约束，不能计作已经删除。
- `ArtifactPreviewHeader` 的主动作与下拉仍有现消费者，且参考也有文件主动作；应与目标 query 合流，不能因 Files 右键新增就整件删除。`useWorkspaceCanvasPreviewRuntime.handleOpenCanvasWorkbenchPath/handleRevealCanvasWorkbenchPath` 也仍被 Scene/TaskRail/现文件动作消费，不属于 dead；后继只迁移重叠委托，不整段误删。
- `FileEditorController` 的 dirty/save/watch、CodeMirror 选区/历史、tab contentInstance/preview/pin、目录 cache、Diff/Changes owner 均为 current；菜单不得以复制状态、绕开 guard 或恢复旧 Canvas/项目工具路径为代价。
- 原 `ProjectPathOpenTool/openProjectPathWithTool/open_project_path_with_tool/projectToolsHost` 已在先前切片删除，不恢复 alias 或固定枚举兜底；扩展唯一 FileShellHost。

只读后继分类：current 是上述 owner；compat/deprecated 新增 0；本轮产品删除 0、文档错误映射已替换；原生目标实现与其余未证能力保持 gap，后续静态闭包补证见文末。只对本报告执行格式/文档边界检查并核对冻结源码 SHA，不重复产品测试或构建；该核查不改变先前 8 套 54 项的验证归属，也不产生新的 Gate A/B。

## 本地菜单纵切实施结算（2026-10-20）

搜索/目录仍共用唯一 `FileTree`。树外层 `WorkspaceFileContextMenu` 只从原生 composedPath 提取 file 行操作 path；目录与空白不打开文件菜单，不在每行建第二套 controller。`RightSurfaceTabStrip` 对已有 filePath 的 Files 标签使用同一 wrapper，明文 `getWorkspaceFileTabContextMenuItems` 是唯一标签 builder。现 `hasDesktopHostInvokeCapability()` 可用时依次 Save as、Copy path，否则只投影 Copy path；它是已证项目的本地子集，不能把未实现的 preferred/Open with 视为已完成。

树与标签委托 `useWorkspaceFileActions`；Copy path 使用真实路径和系统剪贴板，失败走五语公共错误出口。Save as 先调用同一 `FileTabLifecycle.saveFile → saveUntilClean`，再委托既有 `usePublicFileAction` 的文档 controller flush，最后经 `saveFileCopy → save dialog → current App Server copyFile`。tabStrip 与内容分发同一 lifecycle 实例，关闭/dirty 确认继续归原 guard，不创建第二保存后端。原生对话框取消不产生复制；保存失败保留编辑；root/query、菜单换目标、同路径 tab 实例替换或卸载后拒绝迟到复制。

原先调查没有旧 Files 菜单模块可删；本切片直接替换触发点，新增 compat/deprecated 0，不恢复退休项目工具路径。原平面搜索列表及重复 renderer 已在前驱删除，旧冻结不覆盖。完整原生 target/preference、target query/prefetch、标签 Copy contents、内容入口接线、GitHub、library、Add to chat 与 remote/OS 观察保持独立缺口；Codex 内容 wrapper 的静态挂载与 target 输入闭包见下节。不填假目标、不造空预取，不冒用 Lime 材料库。源码冻结与本切片验证见 [执行计划](../../exec-plans/file-menus-20261020.md) 与 [新冻结](../../exec-plans/artifacts/file-menus-20261020/source-freeze.json)。

## 原生目标、偏好与内容入口的闭包核查（2026-10-20）

本节只读核查后继原生目标纵切，未改生产源、共享架构或主执行计划，未构建或启动 Electron。继续复用同一安装包 `26.1007.30912 / build20156`，ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`。新输入只补此前未完整闭合的 query key/global preference producer、打开路由、setting producer、实际 wrapper 消费者，以及 root 请求核对的主窗口尺寸；没有重分析已完整取证的 OS service/catalog。

### 证据边界

| 证据                                                                                                                                                                                                                     | 精确范围                                                                                 | 限制                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 复用 `ev_0daa872fe19c21e16b59481db620a16b3ba959bdaca2298e5d02ea72909af414` 与 `ev_b6a90ef2b299d4b6bfb753ff549cdc151433dd37c0dd262dfd37ad8e671ce912`                                                                      | 完整 use-target-apps 模块、query/selectors producer                                      | 可证明加载与投影合同，不证明本机已装应用                                                                                                       |
| 复用 `ev_d64c045d267189fd8da693277bf044defe2e4f4dd138962a839b4f7e28fd480e`、`ev_61ee26c8db6b1e953aae11e63030b9760626cc71a7531da75aa4fd452efa6d79`、`ev_a4cb83333838c8893b1b7cca700326c95239cc1f00da33ca8ea9840c299a090d` | 完整 main open-in service、配置/选择 helper、17 个平台 helper，包含 zQ 的 validated read | 不恢复压缩 class 的原开发名称；不等于实际 launch 成功                                                                                          |
| 新 `ev_e37514ba7ab0a3a548c79b19cc73f04b773ba1729431084041a070a2d12a7ce6`                                                                                                                                                 | 24 个完整声明或方法/配置节点；输入 35,353 bytes，10,502 AST，24/24 parse、failure0       | 语义覆盖 unknown；显式 audit wrapper 不代表产品类名；命名空间别名未自动解析为 BrowserWindow，不能将图中 browser_windows=0 当作没有原始构造调用 |
| 新 `ev_7c1332bc5041f6a27c07cf90d25764e8887a52f283930a6af3aa0ca320f075cc`                                                                                                                                                 | 同源 main 的完整 `Qge=1280` 变量声明；包装后 14 bytes，1/1 parse、failure0               | 仅与上一行的完整 createWindow 配对说明初始宽度；无 GUI 运行结论                                                                                |

完整新 evidence、原字节范围/UTF-16 范围、SHA、包装方式与可复现提取器见 [source-manifest](../../exec-plans/artifacts/file-target-closure-20261020/source-manifest.json)、[REA evidence](../../exec-plans/artifacts/file-target-closure-20261020/rea-evidence.json.gz)、[REA summary](../../exec-plans/artifacts/file-target-closure-20261020/rea-summary.json)。常量补证见 [constant manifest](../../exec-plans/artifacts/file-target-closure-20261020/window-constant-manifest.json) 和 [constant evidence](../../exec-plans/artifacts/file-target-closure-20261020/window-constant-rea-evidence.json.gz)。新增 settings 成员 `.vite/build/src-CP7XXlpZ.js` 为 203,781 bytes、SHA `79623d50989f9efbcb8e5752c56b3cc608a0f5993c05112e03e11b718ac7a586`；所有保存成员均与当前 ASAR header integrity 一致。没有运行目标 bootstrap、native discovery、应用 launch 或写入目标 settings。

### 一个目标快照贯穿 readiness、菜单与打开

`hsa/msa` 与 use-target-apps 使用同一 zG query。完整 `lzi` 的 key 是 `["open-in-targets", JSON.stringify(params)]`；params 保留 cwd、hostId、path 与 deferEnrichment 条件，不能将不同 host/path 的快照合并。默认 staleTime 为一分钟。`hsa` 等待真实 target query，与可选 GitHub query 各自捕获失败后再交 gsa；没有真实 target query 时不补空 prefetch。

use-target-apps 的 `canLoadTargets` 由 `cwd ?? openPath` 决定，不用前端硬编码 installed app 判断。延迟 enrichment 先得到 catalog/偏好快照，再逐目标执行 native detect；detect 失败只使该项不可用，available 后才取 icon，icon 失败保留 null。每次更新重算 availableTargets；signal 已 abort 不回写 cache。正常 local URL/browser-path 分支可先写 known browser 快照，再做完整 scan。这些阶段不能折叠为“catalog 里的项目都 ready”，也不能等所有图标成功才宣布可打开。

`$oa/esa/psa` 共同决定菜单：有 appPath 的 native 项出现时选 native 集；native 模式但没有该集合时只保留 systemDefault/fileManager；editor 模式按 availableTargets 与 hidden 过滤。preferred 必须仍在可选集合，否则选第一个可选目标；visibleTargets 可包含可用的 hidden 项供 submenu。相同 target 通过 target 与 appPath 共同定位，不能只按 target 字符串去重所有原生应用。

明文 service 方法可对齐为 `getTargets`、`detectTarget`、`loadTargetIcon`、`open`、`setGlobalPreferredTarget`。其 main class 只有压缩符号 JQ，原类名不可还原，不以猜测名称标注“源码一致”。`detectTarget` 最终检查 worker `get-target-command` 的真实结果；getTargets 再按 host config 过滤可用目标。catalog 32 个定义仅表示支持集合，不表示当前用户安装 32 个应用。

### 偏好的读、写与 Host 终点

settings producer 把 `openInTargetPreferences` 定义为 global-state 存储，key 为 `open-in-target-preferences`，default `{}`，schema 只有可选 `global:string` 和 `perPath:Record<string,string>`。`customFileHandlers` 则是 configuration 存储，key 为 `custom_file_handlers`，default `{}`；不是同一 renderer localStorage。自定义 map 值的完整 schema 是 `label/icon/command` 非空字符串、args 字符串数组默认空、input 为 `path/json_argument/json_stdin` 默认 path、supports_ssh 默认 false。

读偏好先由 zQ 通过当前 builtin/custom catalog 的 BQ 校验 target id，丢弃已不存在的 global/perPath 值；HQ 再按 cwd 的 perPath 优先、global 次之取值，VQ 仍用真实 available 集合复验。UQ 写入 global，并且 cwd 存在时同时写 perPath。`setGlobalPreferredTarget` 只传 null cwd。不能把 perPath 实现成独立覆盖所有 global 写入的第二配置 owner，也不能把一个未知或不可用的偏好直接投影为 ready。

use-target-apps 的 open 只有 `persistPreferred && cwd` 才乐观更新同一快照，并传 `persistPreferredTargetPath`；普通 `gsa` 的菜单打开回调没有该标志，资源卡 native/fileManager 选择还显式传 false。main open 只有请求明确带该路径，且显式选择或原来无偏好时才写偏好。**普通右键选择不能一律保存为默认。** 全局偏好 mutation 使用明文 `openIn.setGlobalPreferredTarget`，成功后更新/刷新 `{cwd:null}` 对应的同一 query。

完整 JG 先处理专用 cloud/source、浏览器与 side-panel 路由；显式 target、workspace 模式或显式 preference path 会进入 Host 打开分支，保留 path/cwd/hostId/appPath/location。正常 scope 的 mutation 委托 jBi；其非 durable 分支调用真实 `openIn.open`，仅成功、非 workspace、非 fileManager 时记录 recent file。durable 分支另委托 open-cloud-file，不能把所有 host 都降为本地 shell。main service 最后经既有平台 RQ/$Re/qa 等 launch，显式目标检测失败返回失败；不伪造默认打开成功，也不建立第二 agent runtime。JG 中 Ql 等未展开 helper 的完整 host 分类仍保留符号条件，不能由一处 durable 判断推广到全部 remote。

### 内容 wrapper 的真实消费者

对当前 ASAR 的 14,770 个 webview JS 成员、381,823,019 bytes 做精确文件名扫描，只有下列四个模块有真实静态 import；其他命中是 Vite dependency arrays 或 wrapper 自身 source-map 注释。扫描范围与每个命中 SHA/静态 import 原文见 [consumer-scan](../../exec-plans/artifacts/file-target-closure-20261020/consumer-scan.json)。五个实际 consumer 函数均完整进入上述新 REA，不以局部文本命中冒充完整消费者。

| 完整消费者                          | 实际包裹及参数                                                                                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| review-file-source-breadcrumb 的 Tn | 包裹面包屑 Popover 的 button；cwd 为既有 helper z(root) 的结果，path 为 active path 解析结果或 root；hostId 保留。`shouldExpandActivePath` 为真时 openMode=workspace，否则 file。没有包整个源码编辑区；z 的内部语义未纳入新窄输入。 |
| local-conversation-turn 的 sc       | 包裹生成资源卡；传 cwd、hostId、path、onOpenTargetSelected，openInSidePanel=true；无 openMode=workspace。Open in 按钮与右键复用同一 targets/readiness 输入。                                                                        |
| sites-end-resource 的 \_D/vD        | 包裹两种 turn diff 文件行的按钮；传 cwd、hostId、path；不为此另建 diff owner。                                                                                                                                                      |
| user-message-attachments 的 jn      | 仅有有效 path 且不是 sharedThread 时包裹附件 pill/card；传 cwd、hostId、path、line/endLine、attachmentPreviewOrigin、isAttachmentPreview 与 openInSidePanel。upload 专有分支与 sharedThread 不套此文件菜单。                        |

因此 Lime 下一内容入口应按现有 ArtifactPreviewHeader/面包屑实际按钮、附件/资源卡各自职责迁移，保留 text editor 自己的选区与复制交互；不能为了补“内容菜单”把整个 CodeMirror、所有 document canvas 或所有附件都一律包裹。五个 consumer 的压缩局部名仅作证据定位，不改生产组件名为 Tn/sc/等。

### 最小可实施纵切与未关闭范围

下一刀是沿唯一 `FileShellHost → preload/IPC/catalog → typed gateway → 同一 target query → 现菜单 builder/主动作` 建立真实 local target/readiness/preference 输入；保留现 Save as 的 FileTabLifecycle/dirty flush 链和标签 contentInstance 迟到保护。先交付真实检测与 open 验证、global-state 偏好 schema/存取、同快照 primary/submenu/loading，再把 prefetch 接入这个真实 query，并迁移重复主动作委托。每层只设一个 owner；同步协议/消费者/fixture、五语言、行为断言与真实 Electron Gate B。可确认的 method/query/setting 名称直接复用，未知原类名继续 unknown。

原生文件关联发现仍有实质缺口：macOS 的 launch-services-helper 只掌握 Mach-O 元数据及外围 execFile/2000ms/去重合同，内部关联枚举与当前机器返回未恢复；Windows/Linux 更深的原生 provider、部分 JetBrains 探测链和全扩展名分类也未完全恢复。因此不能仅靠 catalog 或任意系统猜测脚本声称 full native app matching 已对齐。GitHub permalink、library builder、Add to chat 的 host/会话/聚焦语义、完整文件 Copy contents 与 remote 运行保持独立 gap。本节关闭的是静态 target/settings/router/内容挂载输入事实，不是这些能力的生产实现或运行验收。

### 主窗口尺寸的附加核对

同源 main 的完整 `createWindow` 默认 `a={width:Qge,height:820}`，补证 Qge=1280。普通 primary 窗口可被现存 bounds 恢复覆盖；Windows 的初始尺寸还会按 workArea 比例约束。明文 `getPrimaryMinimumSize` 返回 480×600；`O1e(primary, minimum)` 原样传该值，最终 BrowserWindow 选项是 `minWidth:A?.width,minHeight:A?.height`。restore、sync、persist 与 clamp 均复用同一 minimum。detached/secondary/hud 的 400×400 是其它 appearance，不替代 primary 合同。用户屏幕 workArea/缩放/系统约束与 renderer 模拟 viewport 的实测须分别记录；静态默认 1280×820 不保证该显示器能创建此实际高度。本 Agent 未改 main 或测试 fixture，生产最小补丁与原生窗口复验由 root 持有。

本节分类：current 是唯一 OS FileShellHost、菜单/文件保存 owner 与新增静态证据；compat/deprecated 新增 0，生产删除/修改 0；旧“内容 wrapper 挂载未查明”的当前结论已替换。静态输入闭包研究 100%（分母仅上表已取证范围），Files/GUI 完整实现百分比不能从此推出。只运行提取完整性、REA parse、格式与文档边界校验并检查冻结漂移，不重复产品测试；没有新增 Gate A/B。

## launch-services-helper 的原件、能力与执行边界复核（2026-10-20）

本节继续只读核查，不修改生产、测试或已有生成证据，不安装引擎，也不启动参考 GUI、Lime、Electron 或 helper。重新读取原件 `/Applications/ChatGPT.app/Contents/Resources/native/launch-services-helper`，大小 162,848 bytes、SHA `2805f57082722f1a15293961abc313536ffd811368f1021ebc1154d9dbd1ed33`，与既有 Mach-O Evidence `ev_156083a014118e0d50604f3256d9c0b81b0eff214af16ca1dea450f14b060eff` 一致。因此复用原 evidence，不重跑相同 inspect-macho。原 evidence 记录 arm64、LC_MAIN file offset 4416、NSWorkspace 与 LSCopyApplicationURLsForURL 等 imports；这些是静态元数据，不证明各 API 在查询入口实际被调用、调用顺序或参数。

当前 REA 6.4.0 的 `providers` 实际结果如下。静态 Mach-O/dispatch 检查可用，但三种 deep provider 均不可用，不能继续得到可靠的 helper 函数体、控制流、调用引用和数据流。没有把引擎不可用解释为目标不具备该功能，也没有在没有新条件时重复失败的 native 分析。

| deep provider | 实际状态与原因                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Ghidra        | unavailable / not_configured；GHIDRA_INSTALL_DIR 未设置，analyzeHeadless、匹配的 darwin/arm64 native decompiler 与 Java runtime 均不可用。 |
| Hopper        | unavailable / executable_missing；`/Applications/Hopper Disassembler.app/Contents/MacOS/hopper` 缺失或不可执行。                           |
| IDA           | unavailable / not_configured；没有 REA_IDA_MCP_CONFIG，未探测 live connection。                                                            |

### 已证的发现请求及结果处理

复用完整 producer Evidence `ev_a9b22da43b9fe244374a511b7aa479379c1507b1655e4360b08dfd1a2a27deb2`：`ww/kme` 只选择实际存在的 helper 文件，优先 resources/native，随后是开发 app 下 build/Release-arch。Tw 只在 darwin 调用 `execFile(helper,args,{timeout:2000})`，读 stdout、JSON.parse 并校验 schema；非 darwin、找不到原件、进程错误、超时、无效 JSON 或 schema 失败均归 null。JS 没有给该调用显式 input/stdin；不能把这个事实扩写为已还原 helper 内部所有输入通道。

- 文件关联请求 Dme 的 args 为 `[filePath]`，输出为应用数组，每项必有 appPath、bundleId、displayName，可选 isDefault。
- 浏览器关联请求 Sw 的 args 为 `["list-web-url-handlers"]`，输出为 `{applications,defaultApplicationPath}`，后者允许 null/缺省。
- 文件关联的 JZ 仅在 darwin 返回结果；null 归空数组。它先过滤 appPath 不以 `.app` 结尾及明确排除的三个 bundle id，再按 appPath 去重，合并相同路径任何 isDefault=true，随后按 prioritizedBundleIds 排序、最后应用 limit。这里的 default 标记合并与 priority 排序是不同职责，不能将全部排序简单改写成“默认应用在前”。后续特定文件分支另有 default 优先排序。
- YQ 把 provider 的真实应用结果映射为 `id="app:"+appPath`、`target="systemDefault"`、kind=native，保留 appPath/bundleId/displayName，读取图标失败时保留平台 fallback icon，并标记 available=true。`app:…` 是列表 identity；打开请求仍传 systemDefault 与 appPath，不能把 app identity 当 catalog 的 worker target。

catalog 的 systemDefault.detect 返回 `system-default` marker，只表示平台默认打开入口可用；editor target 还需真实命令检测，native app 项则来自平台关联 provider。三者不是同一种 availability 事实。32 项支持 catalog、一个 systemDefault marker 或 null→空列表，都不能替代某机器具体应用的发现证据。本 REA 核查未执行查询，没有保存本机安装清单或私密路径。

### 实际 open 与 helper 查询分开

复用完整 service、catalog、launcher、platform Evidence：用户选择原生关联项后，service.open 保留 systemDefault 与 appPath，复验目标，依次委托 RQ → $Re → catalog 的 darwin systemDefault.open → wRe → qa。wRe 的真实命令是 `/usr/bin/open`；有 appPath 时 args 为 `["-a",appPath,path]`，否则为 `[path]`。qa 经 spawn 使用参数数组并观察 error/exit code。显式 target 不可用、平台启动失败等最终返回 success=false；不得把“已生成 args”计作打开成功。URL 且没有 appPath 时 service 另走外部浏览器 bridge，不能将该分支与普通文件 shell.openPath 混为一个入口。上述已证调用链没有用 launch-services-helper 承担菜单实际打开，但这不排除 helper 在别的功能入口具有其它行为。

### 为什么没有执行只读发现探针

root 仅条件授权在已确认入口只读后，通过 REA 对所选原件运行精确发现请求；该条件目前未满足。外围 JS 的请求名与返回 schema 只能证明调用方的枚举用途，不能证明 helper 进程启动与内部命令分派没有额外写入。对同一已校验 main 成员完整补读还确认该 helper 同时承载 `notify-download-complete` 与 `set-app-icon` 命令；不是所有调用都属于查询。以下是原文定位补读，不扩大已有 REA46 parent 的分析范围：

| 完整原始声明                                                                                                                 | UTF-16 范围       | byte 范围         | SHA-256                                                            |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------- | ------------------------------------------------------------------ |
| xw：`Tw(["app-for-bundle-id",id],nullableApplicationSchema)`                                                                 | [1024021,1024091) | [1024048,1024118) | `cd60192ed921596373175a957be51687c7e903769b1d04852f171d8efaabe294` |
| Cw：`Tw(["notify-download-complete",path],trueSchema)`                                                                       | [1024152,1024222) | [1024179,1024249) | `6fd056aab8707d5b29fb36f134eaa7b968ba4c3a180738a88ce7ae73506489cc` |
| Ome：darwin packaged 条件下，串行 execFile(helper,["set-app-icon",appPath,preference,resourceName或空字符串],{timeout:5000}) | [1024222,1024549) | [1024249,1024576) | `d114f0bf7c642c943ce5470f32ad097e92874db0ef77a99e2aa96ddabbd26fd4` |

这不证明查询命令会执行这些可变命令；它说明必须恢复实际分派/启动控制流后才能排除副作用。在 deep provider 不可用的现状下，未执行 helper，也未转用普通 shell 调用绕开这一条件。内部 API 调用/角色参数、候选组合、真实系统关联、排序来源、启动副作用以及本机实际输出保持 unknown。下一步需可用原生分析 provider 或可核实的该原件源代码；本轮没有安装/配置引擎的授权动作，也不以猜测的 NSWorkspace/LaunchServices 实现替代原件事实。

本节 current 为既有元数据/外围 JS 合同与本报告；compat/deprecated 新增 0，生产/测试/生成物修改 0。外围发现请求与实际 open 的静态合同已核清；helper 内部及运行只读性未闭合，因此不计算为完整原生关联发现实现，不新增 Gate A/B。报告格式、文档边界与原文身份核验通过后结算，既有 product validation 与原始证据保持原样。

## 实施后继：Lime 唯一文件壳与真实平台原语

以下为实施记录，不补写为上述 Codex helper 的内部分析或运行证据。Lime 自有 Swift 源码已明确 `launchServices.urlHandlers → NSWorkspace.urlsForApplications(toOpen:)`，`launchServices.bundleIdentifier → NSWorkspace.urlForApplication(toOpen:)`；后继通过现 SystemUtilityHost 的同一 native client 复用它们，没有新增 native host、重建 helper 或执行 Codex 原件。应用身份取 `app:${appPath}`，实际请求仍为 systemDefault/appPath；显示名由真实 app 路径 basename 投影，完整平台 localized displayName 仍未取回。

FileShellHost 现有五个明文方法 getTargets/detectTarget/loadTargetIcon/open/setGlobalPreferredTarget。支持入口 catalog 与真实关联应用/文件系统存在性分开；发现失败明确 unavailable，Windows 完整发现为 unsupported，内建默认/文件管理器入口不能代替关联集合。显式目标打开前再查真实关联与存在性；macOS 使用已证 `/usr/bin/open` 参数数组与进程退出结果，Windows 委托 Electron shell，均传播错误。remote host、非绝对路径和错误 native identity 拒绝进入本地 launch。原 open_with_default_app IPC/Host/catalog 已删除，现默认打开 gateway 直接委托同一 openIn.open；退役名仅留负向测试与守卫。

Host 在统一 appDataRoot 的单一 open-in-target-preferences 值保存 global/perPath，串行原子替换；普通菜单选择不写，明确 persistPreferredTargetPath 成功后才同时写两者，全局设置只改 global。Renderer 共享一个一分钟 open-in-targets query，key 保留 cwd/hostId/path/deferEnrichment；真实预取与 tree/tab/breadcrumb 复用，detect 失败只取消该目标，图标失败保留可用性，abort 不回写。树等待期间只给 disabled Open in；标签/内容等待目标后开启，实际打开组后才有分隔线。

已证 FileSourceBreadcrumb 的实际按钮接同一 wrapper，目录 workspace/file 模式与真实路径分开；没有给整个 CodeMirror/文档编辑面包菜单。目录树行仍无菜单。内容/标签 Reveal 使用同一 fileManager target；原保存与 FileTabLifecycle 身份保护继续唯一。定向测试与源码冻结见后继执行计划及 `artifacts/file-targets-20261020`；这些测试使用显式测试 native/query fixture，不代表真实 OS 发现、打开成功或 Desktop Gate B。完整 editor/custom target、Windows 关联集合、remote、Copy contents、GitHub/library/Add to chat、其它实际内容消费者仍未完成，交后继证据闭合，不创建假占位项。
