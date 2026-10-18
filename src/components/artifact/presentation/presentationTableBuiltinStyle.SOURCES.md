# Builtin table style 来源与许可

状态：current。范围是固定 `@aiden0z/pptx-renderer@1.3.0` 所列的 74 种 Office builtin 定义，不代表所有 Office 版本、任意 custom table style 或完整 Office 渲染能力。

## 固定来源

- 上游项目：[@aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)。
- npm 版本：`1.3.0`。
- npm `gitHead` 与 `v1.3.0` tag commit：`0cf5c194b4db2cf9f2531b6a7e24a61338caabf1`。
- 适配原件：[src/renderer/predefinedTableStyles.ts](https://github.com/aiden0z/pptx-renderer/blob/0cf5c194b4db2cf9f2531b6a7e24a61338caabf1/src/renderer/predefinedTableStyles.ts)。
- 原件 SHA256：`c9e2cb30e4ec74c3f3c97d3382b35742f56ca57ee9d3dd47bcc3c109b89917ec`，28,278 bytes / 806 行。
- 上游原件明确声明派生自 LibreOffice `predefined-table-styles.cxx`（MPL-2.0），并与 Microsoft OOXML predefined style map 交叉核对。上游没有给出该 LibreOffice 原件的具体 commit；这里不补造版本。

本目录以下三个适配文件按 MPL-2.0 文件级条款保留来源与通知：

- `presentationTableBuiltinStyle.ts`：规范化 UUID，返回完整、独立的 XML 字符串；公开只读 ID 清单。
- `presentationTableBuiltinStyleData.ts`：保留全部 74 项 UUID → 样式族与 accent 映射。
- `presentationTableBuiltinStyleXml.ts`：保留全部 11 个样式族生成器和 XML helpers，包括 fill、text、first/last row/column、horizontal/vertical band 与 borders。

`presentationTableBuiltinStyle.unit.test.ts` 是独立编写的验证代码，使用 renderer 包公开 root API 对比 builtin fallback 与显式定义的逐格投影，没有调用 private getter/parser/bundle。

## 许可文本与保留通知

上游 npm 包的 `package.json` 与根 LICENSE 标为 Apache-2.0；相关文件自身同时声明 LibreOffice MPL-2.0 派生来源。这里保留两条来源信息，不把包级 Apache 标签替代文件级 MPL 通知：

- [Mozilla Public License 2.0 全文](presentationTableBuiltinStyle.MPL-2.0.txt)。
- [上游包 Apache License 2.0 原文](presentationTableBuiltinStyle.Apache-2.0.txt)。

适配文件包含 MPL Exhibit A 通知和 `SPDX-License-Identifier: MPL-2.0`。分发覆盖文件的源代码或其可执行形式时，应继续携带来源、适用许可和获取对应覆盖源码的方式。完整源文件留在本仓库；其他 Lime 文件的许可不因本适配被替换。

## 相对固定原件的改动

1. 将 UUID 映射、生成器与消费 API 分文件，避免单个文件超过 800 行。
2. 去除 `SafeXmlNode` / `parseXml` 依赖以及可变 DOM 缓存，返回原始 XML 字符串。
3. 入口对调用方 ID 做 `trim().toUpperCase()` 查找；未知、无括号或非 UUID 内容返回 `undefined`，不回退默认样式，不把任意输入拼入 XML。
4. 将只读清单在运行时冻结，避免调用方污染共享 catalog。
5. 按 Lime Prettier 格式统一引号与换行；保留原件的全部定义生成行为和英文算法注释。

本 owner 不选择主题、不解析颜色、不修改原包、不写入 styles part，也不承接 renderer/GUI 接线。显式 custom 定义、direct cell properties、主题关系/覆盖/色映射和 unavailable 边界继续由既有 style/theme/document owner 处理。

## 验证口径

对 74 项分别用真实 OPC theme 关系构建模型，比较公开 renderer 的空 styles list builtin fallback 与显式本 owner XML。四种配置分别关闭所有条件、开启 first/last row 与 horizontal band、开启 first/last column 与 vertical band、开启全部条件；比较表格 CSS 和全部 20 格的 CSS、文字与内部 HTML。另对全部 74 项验证原格 direct border/fill/text 优先级，并验证未知 UUID不回退默认。

这些是 Node/jsdom 的定义与公共 renderer parity，不是 Electron Gate B、PowerPoint、Codex Desktop 运行证据，也不覆盖未知 Office 定义。GUI 与原包保存接线必须另有当前主流程证据。
