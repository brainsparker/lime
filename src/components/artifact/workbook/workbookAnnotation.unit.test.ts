import { describe, expect, it } from "vitest";
import {
  buildWorkbookAnnotationRequest,
  buildWorkbookAnnotationBatchRequest,
  readWorkbookAnnotationDisplayContent,
  type WorkbookAnnotationComment,
} from "./workbookAnnotation";
import { buildArtifactAnnotationBatchRequest } from "../annotations/artifactAnnotation";

const comment = (id = "range-1"): WorkbookAnnotationComment => ({
  id,
  format: "workbook",
  sourceFormat: "xlsx",
  path: "/workspace/report.xlsx",
  sourceSha256: "a".repeat(64),
  sheetId: "2",
  sheetName: "预算 2026",
  address: "B2:C4",
  body: "请更新税率。",
});

describe("工作表位置反馈合同", () => {
  it("保存原工作表标识与范围，不引入页码或假页面坐标", () => {
    const request = buildWorkbookAnnotationRequest(comment());
    expect(request.requestMetadata).toEqual({
      artifactAnnotation: {
        type: "workbook",
        id: "range-1",
        sourceFormat: "xlsx",
        path: "/workspace/report.xlsx",
        sourceSha256: "a".repeat(64),
        sheetId: "2",
        sheetName: "预算 2026",
        address: "B2:C4",
        body: "请更新税率。",
      },
    });
    expect(readWorkbookAnnotationDisplayContent(request.prompt)).toBe(
      "report.xlsx · 预算 2026!B2:C4\n请更新税率。",
    );
    expect(
      readWorkbookAnnotationDisplayContent(
        request.prompt.replace('"B2:C4"', '"$B$2:$C$4"'),
      ),
    ).toBeNull();
    expect(
      readWorkbookAnnotationDisplayContent(
        request.prompt.replace('"body":', '"unexpected": true, "body":'),
      ),
    ).toBeNull();
  });
  it.each([
    "A0",
    "C4:B2",
    "XFE1",
    "A1048577",
    "Sheet1!B2",
    "B2:C4:D6",
    "b2:c4",
  ])("拒绝非法或非规范范围 %s", (address) => {
    expect(() =>
      buildWorkbookAnnotationRequest({ ...comment(), address }),
    ).toThrow();
  });
  it("跨工作表批次保持每个目标，异文件/版本/格式/重复身份拒绝", () => {
    const comments = [
      comment(),
      { ...comment("range-2"), sheetId: "3", sheetName: "明细", address: "A1" },
    ];
    const result = buildWorkbookAnnotationBatchRequest(comments);
    expect(
      result.requestMetadata.artifactAnnotationBatch.comments.map(
        ({ sheetName, address }) => ({ sheetName, address }),
      ),
    ).toEqual([
      { sheetName: "预算 2026", address: "B2:C4" },
      { sheetName: "明细", address: "A1" },
    ]);
    expect(readWorkbookAnnotationDisplayContent(result.prompt)).toContain(
      "明细!A1",
    );
    for (const change of [
      { path: "/other.xlsx" },
      { sourceSha256: "b".repeat(64) },
      { sourceFormat: "csv" as const },
      { id: "range-1" },
    ])
      expect(() =>
        buildWorkbookAnnotationBatchRequest([
          comments[0],
          { ...comments[1], ...change },
        ]),
      ).toThrow();
    expect(() => buildArtifactAnnotationBatchRequest([])).toThrow();
  });
});
