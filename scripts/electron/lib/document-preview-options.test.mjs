import { describe, expect, it } from "vitest";
import { parseDocumentPreviewOptions } from "./document-preview-options.mjs";

const input = (...flags) => [
  "node",
  "fixture.mjs",
  "independent-file",
  ...flags,
];

describe("独立专业文件场景的启动合同", () => {
  it("工作表剪贴板使用独立的三格式源稿", () => {
    expect(
      parseDocumentPreviewOptions(input("--workbook", "--workbook-clipboard")),
    ).toMatchObject({
      format: "workbook",
      filename: "Preview-report.xlsx",
      withWorkbookClipboard: true,
      withWorkbookEditing: false,
      withDelimitedEditing: false,
      withAnnotations: false,
    });
  });

  it.each([
    ["--workbook-clipboard"],
    ["--presentation", "--workbook-clipboard"],
    ["--workbook", "--workbook-clipboard", "--annotations"],
    ["--workbook", "--workbook-clipboard", "--workbook-editing"],
    ["--workbook", "--workbook-clipboard", "--delimited-editing"],
  ])("资源创建前拒绝工作表剪贴板冲突源稿 %j", (...flags) => {
    expect(() => parseDocumentPreviewOptions(input(...flags))).toThrow();
  });

  it("custom style 场景使用自己的文件，不进入六格基础编辑", () => {
    expect(
      parseDocumentPreviewOptions(
        input("--presentation", "--presentation-table-format"),
      ),
    ).toMatchObject({
      format: "presentation",
      filename: "Preview-report.pptx",
      withPresentationTableFormat: true,
      withPresentationTable: false,
    });
  });

  it.each([
    ["--presentation-table-format"],
    ["--presentation", "--presentation-table-format", "--presentation-table"],
    [
      "--presentation",
      "--presentation-table-format",
      "--presentation-table-advanced",
    ],
    ["--presentation", "--presentation-table-format", "--annotations"],
    ["--presentation", "--presentation-table-format", "--presentation-editing"],
    ["--presentation-table-builtin"],
    ["--presentation-elements"],
    ["--presentation-rich-text"],
    ["--presentation", "--presentation-rich-text", "--annotations"],
    ["--presentation", "--presentation-rich-text", "--presentation-navigation"],
    ["--presentation", "--presentation-rich-text", "--presentation-elements"],
    [
      "--presentation",
      "--presentation-rich-text",
      "--presentation-table-builtin",
    ],
    [
      "--presentation",
      "--presentation-rich-text",
      "--presentation-table-format",
    ],
    ["--presentation", "--presentation-rich-text", "--presentation-table"],
    ["--presentation", "--presentation-elements", "--annotations"],
    ["--presentation", "--presentation-elements", "--presentation-navigation"],
    ["--presentation", "--presentation-elements", "--presentation-table"],
    [
      "--presentation",
      "--presentation-elements",
      "--presentation-table-builtin",
    ],
    [
      "--presentation",
      "--presentation-table-builtin",
      "--presentation-table-format",
    ],
    [
      "--presentation",
      "--presentation-table-builtin",
      "--presentation-table-advanced",
    ],
    [
      "--presentation",
      "--presentation-table-builtin",
      "--presentation-structure",
    ],
  ])("资源创建前拒绝冲突源稿 %j", (...flags) => {
    expect(() => parseDocumentPreviewOptions(input(...flags))).toThrow();
  });

  it.each([
    ["--presentation-table-builtin", "withPresentationTableBuiltin"],
    ["--presentation-elements", "withPresentationElements"],
    ["--presentation-rich-text", "withPresentationRichText"],
  ])("%s 只选择独立源稿", (flag, field) => {
    expect(
      parseDocumentPreviewOptions(input("--presentation", flag)),
    ).toMatchObject({
      format: "presentation",
      [field]: true,
      withPresentationTable: false,
      withPresentationTableFormat: false,
      withPresentationEditing: false,
    });
  });
});
