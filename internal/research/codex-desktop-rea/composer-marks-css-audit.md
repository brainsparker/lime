# Composer link/code 样式补证

日期：2026-10-14。复用同一 Codex Desktop 版本与 ASAR 摘要，扫描安装包内317个 packed CSS成员、2687091 bytes，逐成员核对inventory integrity。这里是有界文本观察，不是新的REA semantic或参考应用运行证据；原始CSS与观察记录只留本机分析目录。

| 成员与SHA-256 | 可观察选择器与规则 | 边界 |
| --- | --- | --- |
| `app-initial-99e8b4b455fa.css` / `1a75f9180b89d2457dc09e4efea288436c9cf6d44e5ba59b2c03d3d571b7bf61` | 生成选择器 `_RichTextInput_juri1_1 .ProseMirror [data-composer-code-block]` 约UTF16位置189069：container宽度/最小宽度、圆角、surface背景与clip；直接子块margin为0，内部 `>pre` 有mono字体、padding、tab-size4与横向滚动；`>pre>code`为block，另有toolbar背景 | CSS存在不证明当前主surface有效NodeView。生成CSS名不作为原始源码类名 |
| `app-shared-9a94b907ed47.css` / `69f929f71947824fed18365d54c8aa0c975a856649339e585a50f6f547e215d7` | 约UTF16位置68979的mention样式对breakable URL做ltr/isolate与换行，对text-link-href移除inline padding | 需要追踪实际mark NodeView与生成class的绑定，不能把plain span自动判定为视觉等价 |
| `content-bc0b899e44c2.css` / `3875ca200b50e2b5f3868d3091610a5250db34e8f4e05f2957efcd484ec249cb` | 约UTF16位置18290：`data-composer-code-block-wrap=true` 时内部pre/code采用pre-wrap/anywhere | wrap状态来源、默认值与toolbar交互仍unknown |

Lime本批对齐基础schema、link/code语义、Markdown发送和完整draft恢复；schema当前生成 `pre[data-composer-code-block]>code`，与以上container `>pre>code` 的CSS选择器形状不同。这个观察不能证明Codex当前主surface始终采用后一形状，但基础schema的通过不关闭完整NodeView/toolbar/样式合同。

后续在既有ComposerEditor/View插件owner追踪NodeView选择与有效选项，确认后复用Lime主题token实现；不得为CSS推断增加第二Controller。主动链接导航/编辑、code toolbar、wrap与完整rich PMU继续单列待办，当前富输入Gate仅证明其声明的基础文档、键盘、发送与恢复合同。

实施进度与具体产品证据见[当前计划](../../exec-plans/codex-gui-alignment-current-plan.md)；迁移前语义证据见[marks/voice审计](marks-voice-audit.md)。
