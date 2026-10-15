# Codex Desktop 设置导航对齐审计

七 member 静态审计及第一切片的正式采用记录；章节 owner 与公开 SettingsPage 已迁移，真实 Electron 15 章节/24 首屏状态已通过。canonical 路由、返回、内容搜索和 dirty authority 仍待交付。

## 证据范围

目标实际位于 `/Applications/ChatGPT.app`，displayName 为 ChatGPT，但 bundleId 是 `com.openai.codex`，version `26.1007.30912`、build `20156`。此证据归 Codex Desktop，不归消费者 ChatGPT Desktop。ASAR SHA `75e397e2280dde93b70a85aa926f4282c728eacc84dfeb15ba7fb6ddd84628af`，bytes `567757587`。下文 `evidence/` 路径相对恢复目录 `/var/folders/87/s6cpr7hd1_v43cs833x4s_900000gn/T/lime-code-nodeview-recovery-oulq764w/settings-navigation-audit-candidate/`；七 member 的原字节、hash、ASAR offset 见其中 `evidence/member-manifest.json`；格式化副本仅供阅读，定位以原压缩 JS byte offsets 为准。

REA full Evidence `ev_4bf8bfc7ccb14fb058096dd32864ae7f9ab83a8f0ad9acb46cfd79b5379ab36c`；summary Evidence `ev_6d2230454a838f113f4e61d100fb41d47ea6b241100765d84eb35674dcd71478`；输入 corpus SHA `2c618ae2c6acb241a854e3f71191626c857485ed664d43dc91a887d7f1730c35`。七 JS 全部解析，101646 bytes、25710 AST nodes、670 findings、0 parse failures。application complete 仅对这七个输入成立；semantic unknown，5265 unknowns，未执行 bootstrap 或包内代码。

仅确认公开导出原名 `SettingsPage`、`VisibleSettingsCommandMenuSectionItems`、`SettingsExternalSection`。`use-visible-settings-sections` 的导出只有压缩 alias `a/i/n/o/r/s/t`，不得声称已恢复内部 hook 或 sidebar 的原源码名。registry 来源是 app-initial，未提取完整 registry；不得使用 app-shared icon alias 做命名映射。

可下结论的范围：page shell、可见性/navigation 投影、section route/state、命令菜单共享消费、host filter、搜索入口/结果模型与未保存变更对话框。search-documents 内容 chunk、完整 registry/default page、外部 dirty authority、所有 mode/auth/host 的实际运行可见性仍 unknown。包内字符串不能当作当前帐号已启用功能，也不能据七 member 宣称整个设置应用或全量 dirty enforcement 完整。

以下映射和下一切片由 root 正式采用；全部15个 current 依赖、冻结摘要和 byte anchors 已核。source-only 审计完成度 100%；第一切片首屏读取已有真实 Electron 证据，设置完整交互完成度不量化。

## 迁移前映射（原始事实）

Lime 已有唯一 current 设置入口与真实页面；主要差距是导航事实分散、路由与局部选择脱节、搜索只过滤导航标题。目标证据是 bundle `com.openai.codex` 的 shipped artifact，不是消费者 ChatGPT Desktop。置信范围与 Evidence ID 见上文。

| 维度             | Codex Desktop 七 member 可确认事实                                                                                                                                                                 | Lime current 事实                                                                                                              | 差距与含义                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 页面入口/命名    | settings-page 原 byte 48070 公开导出 `SettingsPage`                                                                                                                                                | `src/components/settings-v2/index.ts:7` 将 `SettingsLayoutV2` alias 为 `SettingsPageV2`，`AppPageContent.tsx:298` 唯一生产入口 | current 可以直接导出短领域名 `SettingsPage`，不继续增加 V2/compat 外壳；内部目标原名未恢复的不强行对齐                        |
| 可见性与导航投影 | use-visible 原 byte 38628 的返回对象包含 visible/active/redirect/error/render/navigation 与 enterprise label；page/command menu 共享消费                                                           | `_layout/index.tsx:244` ACTIVE_SETTINGS_TABS、`:272` preload switch、`:321` render switch，category hook 另维护导航            | 先由一个章节 owner 同时派生可用页、导航、预加载和渲染；目前新增/删除页有多份名单漂移风险                                      |
| 分组             | settings-page 包内分组为 Personal、无 heading 的 Teams、Integrations、Coding；成员受 mode/auth/host 可见性过滤                                                                                     | `hooks/useSettingsCategory.ts:52` 固定 Overview/Account/General/Agent/System 五组                                              | 分组机制可借鉴；具体章节不可照搬为已启用功能。Lime 多模型/媒体等业务继续保留其 owner                                          |
| 章节路由         | page 从 `/settings/:section/*` 解析章节，同投影提供 active section 和 redirect；local-environments 可映射 `worktrees?tab=environments`，cloud-settings 可映射 `cloud-environments?tab=preferences` | `AppPageContent.tsx:300` 消费 PageParams 初始 tab；`_layout/index.tsx:475` local activeTab，`:487` 内部切页只 setState         | 内部导航应更新 canonical PageParams，统一直达、点击和重进恢复，避免 shell 路由仍指向旧章节                                    |
| 返回语义         | settings-route-state 有 `returnToPreviousHistoryEntry`，page `function si` 原 byte 47746 优先 history -1，其次 return path，最后 `/`                                                               | `_layout/index.tsx:515` handleBackHome 固定 agent Home                                                                         | 当前返回不能恢复来处；下一刀要保存真实进入上下文并由现有 navigation owner 处理，不另建第二套 history                          |
| 搜索模型         | settings-page messageTextGroups/terms/message IDs、section/path/hash、scrollText；键盘 highlight/select/Escape；搜索目标可落到具体内容                                                             | `SettingsSidebar.tsx:340` title/group substring filter，`:410` Ctrl/Meta+F focus；没有 row target 文档模型                     | 导航过滤只能定位页，无法定位具体设置。先收敛 owner，再建立可翻译的 row/section target，不猜未提取 search-documents 的覆盖内容 |
| 预加载           | page/命令导航存在 section prefetch 消费                                                                                                                                                            | Lime `_layout/index.tsx:497` prefetchedTabsRef + preloadSettingsTab；失败会移除缓存重试                                        | Lime 已具备页面预加载机制；缺口主要是清单收敛，不重复造 cache/loader                                                          |
| 未保存导航       | page 包含 requestNavigation gateway、pendingNavigation 与 unsaved dialog；external dirty authority 未在七 member 中完整展开                                                                        | current shell handleTabChange/handleBackHome 未提供统一 pending dirty 导航网关                                                 | shell 未具备可确认的统一保护，但不能推断所有具体页面都丢数据；需后续逐 owner 确认实际 dirty authority，再接统一导航入口       |
| host/帐号状态    | visibility projection 消费 local/remote host 和 mode/auth，存在 cloudPreferencesAccessError、shouldRenderRouteContent 等结果                                                                       | current category 固定；profile render 内有 OEM managed account 条件                                                            | 能确定机制差距，不能声称所有 target host/auth 功能可用；未来只把已有实际 readiness/capability 投影到设置 owner                |

所有 byte 值均为原 member 内 offset；绝对 ASAR offset 与验证过的 marker 见 `evidence/byte-anchors.json`。可读副本行号不用于原字节身份。

迁移前分类：`settings-v2`、`SettingsSidebar`、category hook、PageParams 入口和 preload/render 是 current，尽管名字仍有 V2。`Experimental -> Developer` 是现存 compat 直达委托，不新增第二个实验页。`SETTINGS_GROUPS` 在 `src/types/settings.ts:70` 只有定义、无生产消费者，是重复 dead 候选；`ExecutionTracker` 只剩 enum 与旧 fallback 测试，是 dead 候选。旧 `components/settings/**` 导入有负向 guard，继续禁止回流。上述为迁移前快照；SETTINGS_GROUPS、ExecutionTracker、V2 导出别名现已删除，详见下方正式采用收据。Experimental 仍仅委托 Developer。

不能下结论的范围：默认页是否应该永久保留 Home、完整章节 registry、搜索索引内容覆盖、所有 host/auth 分支和 dirty enforcement。无需为了本轮映射继续提取其他 chunk。后续实施涉及这些行为时再定向补证。

## 迁移合同与后续切片

主目标是让同一设置章节事实驱动导航、可用性、预加载、渲染与 canonical PageParams。章节收敛已正式采用并完成定向与真实首屏读取验证；后续推进 canonical 路由、返回与内容搜索。

已采用的 first slice 保持现有业务章节和默认页，通过短的领域模块承载 current section 清单；将 ACTIVE_SETTINGS_TABS、category hook 与 preload/render 的重复定义收敛为同一 owner 的派生结果。`SettingsPageV2` 直接迁移为公开 `SettingsPage`，同步唯一生产消费者与测试；不保留无消费者 alias。分组/页面中文文案不在本刀重做，也不扩展 MCP/Skills/模型业务。

窄写集应限定 `src/components/settings-v2/index.ts`、`_layout/index.tsx`、`hooks/useSettingsCategory.ts`、`src/types/settings.ts`、`src/components/AppPageContent.tsx` 和对应定向测试。新增领域文件进入现有 settings owner；若实际写集涉及 `_layout/SettingsSidebar.tsx` 或 navigation/PageParams，先在正式执行计划声明并避让脏区。当前 source hash 观察值见 manifest，不是未来实施可覆盖他人改动的授权。

完成单一 owner 后，second slice 再把当前内部切页接入现有 navigation/PageParams，保存返回上下文，统一直达、click、back 和重进投影。真实 dirty authority 尚未确认，不提前新造全局 dirty state；搜索 row target 也后置，需按当前已存在设置内容与五语言翻译定义索引，不能直接复制包内隐藏功能清单。

退出条件：所有 current 设置页只登记一次；导航、可用页、prefetch/render 无孤儿条目；现有 providerView/providerFocus/executionPolicyFocus 直达保真；Experimental 仅委托 Developer；删除无消费者 SETTINGS_GROUPS 与 ExecutionTracker 时同步测试；保留 legacy import 负向 guard。未知 tab/default Home 断言跟随明确决策改写，不能把旧测试当永久产品合同。

第一切片的定向验证覆盖 `_layout/index.test.tsx`、`_layout/SettingsSidebar.test.tsx`、`hooks/useSettingsCategory.test.tsx`、`legacy-import-guard.test.ts` 及 AppPageContent 消费测试。实施触及 GUI 后按仓库规则跑真实 current `npm run verify:gui-smoke`，并对受影响的 settings current smoke 使用真实 Electron/preload/App Server。已读可复用 consumers 为 `scripts/settings-all-pages-current-smoke.mjs`、`scripts/agent-qc/project-gate-settings-a.mjs`、`scripts/electron/settings-about-fixture-smoke.mjs`、`scripts/electron/mcp-config-fixture-smoke.mjs`；各真实验收入口结果单独记录，单凭静态审计或定向测试不宣称 Gate A/B。

KISS/DRY 通过单一登记避免四份名单；YAGNI 通过先收敛已有页、推迟未知 registry/dirty/search 行为；SOLID 通过章节 owner 负责事实、页面继续负责业务、现有 navigation owner 负责路由。source-only 审计与 first slice 源码迁移均 100%，该切片首屏读取已通过；后续路由、返回、搜索与 dirty authority 尚未交付。

## 第一切片正式采用（2026-10-15）

root核对冻结manifest/patch/29项证据与九源before/after后，正式采用单一sections owner、SettingsPage公开名和调用者迁移；删除重复可用性/preload/render名单、SETTINGS_GROUPS/ExecutionTracker与V2别名。业务页（含媒体脏区）未夹写。收据 `.lime/qc/settings-sections/formal-adoption.json` SHA `84a53337dac5103e9df8c5a28e0457a2b7c54b8eb2fc297949ab4543a4bbd1c8`；架构4.4由root确认。上文映射表保留迁移前事实，正式source采用100%，正式六suite78/78、九源lint/格式通过；receipt `.lime/qc/settings-sections/formal-directed-receipt.json` SHA `d9e7c32d6ad0a2c473e4fe55f356c910fe7544e2b1cfd289f07a8f034699df10`。设置验收清单已迁15current keys，补Skills删旧连接器/自动化，用唯一testid与active确认；core/states定向10/10 exit0，收据 `.lime/qc/settings-sections/formal-oracle-receipt.json`，真实首屏读取验收settings-current-native-20261015-2 exit0：15章节key/24可见状态、157原生bridge read、零console/page/trace errors，Main22039正常code0/signalnull；证据`.lime/qc/settings-sections/settings-current-native-20261015-2/summary.json`。这不证明写入、canonical内部路由、返回、内容搜索、dirty authority、live或Windows。

## 第二切片只读预检（2026-10-15）

本轮尚未修改设置产品源码。`useAppNavigation` 已有 requested/committed 与 requestId，设置进入上下文应由它承接；不新增全局 history owner。`SettingsPage` 的 activeTab/providerView/developerLabTab 目前从 initial props 复制为局部状态，内部点击不更新 PageParams。下一刀应让同一 canonical 参数驱动章节与焦点，保留 providerView/providerFocus/executionPolicyFocus 和 Experimental 委托语义；离开章节后不重放旧焦点。

`SettingsNavigation` 当前将 rail Home 与页头返回共用 onBackHome；对齐返回来处时必须分开两种用户动作，Home 图标仍进入首页，返回按钮恢复进入设置前的已提交目标。恢复目标不能意外重放 newConversationRequest、初始发送或其他一次性 intent。精确返回会话应与现有 reload 最小会话参数投影配合，不能仅保存旧 params 后再次触发发送。

另一个必要合同：Home 首发 materialize 后，根 PageParams 未必已有真实会话 identity；App 已消费 `onAgentSessionChange` 的实际可见会话投影。单纯保存进入设置前的 PageParams 可能返回 Home 或重放旧初始输入。实施前须沿该 current 回调及真实 workspace 确认返回目标，覆盖“Home 首发后 → 设置 → 返回同一会话”和“已有会话 → 设置内部切章 → 返回”两条真实路径；不得把旧初始参数当成实际可见会话 authority。

该切片需要同步 `_layout/SettingsNavigation.tsx`、layout、useAppNavigation、App/AppPageContent 接线、五语言返回文案及稳定测试；现有 `settings-home-button` 消费者包括 settings-about Electron fixture、project-gate-settings-a 与 tool-surface-page smoke，必须按真实返回语义迁移，而非强制保留“永远回Home”的旧正向断言。当前 native15章节/24首屏证据仍只证明读取，不覆盖该后续导航合同。search 与 dirty authority 仍待实际 owner 调查。

进一步只读核实：`useWorkspaceContextSurfaceRuntime` 已同时拥有实际 `sessionId` 与 `runtimeWorkspaceId`，但现有 `onSessionChange` 只发布 sessionId；App 的 `activeAgentSessionId` 同样没有 workspace。第二切片应沿这条既有投影回调携带可见 workspace，或在同一 owner 提供等价的只读位置快照，避免用根 PageParams 的旧 projectId 代替当前 workspace。它属于导航显示上下文，不扩展为业务状态或第二 read model；实现与定向/真实路径验证尚未开始。

## Current dirty owner 只读预检（2026-10-15）

本次仅检索 `src/components/settings-v2` 与 `useAppNavigation` 中的 dirty/unsaved 命名并追踪命中的实际消费者，未修改设置产品代码，也不是完整表单清单。已确认两个 current 章节具有自己的未保存状态：Memory 比较本地 draft 与 snapshot，Cancel 恢复 snapshot，Save 经既有 saveConfig 成功后同步两者；Web Search 比较本地 draft 字段与已加载配置，Save 构造同一配置 owner 的更新。两者分别由 `sections.tsx` 直接渲染，当前章节回调未传递 dirty 导航接口。

`ChannelsDebugWorkbench` 也有 channels/gateway 与 initialJson 的比较，但唯一生产消费者位于 `components/channels/ImConfigPage`，不在这次15章节 registry 内。不能因文件位于 settings-v2 下就将其登记成当前设置章节，或用其 dirty 状态替代 Memory/Web Search。

当前已检查的 SettingsPage handleTabChange/handleBackHome 没有 pending-navigation/dirty gateway。后续保护应让现有表单 owner 报告当前编辑状态，并由唯一导航入口消费；不要在 shell 复制配置或重算业务 dirty。其他表单、弹窗、独立页面和参考应用外部 dirty authority 未穷举，完整覆盖仍 unknown。此预检不证明实际导航丢稿，真实失败/保存/取消路径仍须验证。
