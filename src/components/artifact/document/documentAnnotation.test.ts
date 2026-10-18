import { describe, expect, it } from "vitest";
import {
  buildDocumentAnnotationRequest,
  buildDocumentAnnotationBatchRequest,
  readDocumentAnnotationDisplayContent,
  resolveDocumentSelection,
  type DocumentAnnotationComment,
} from "./documentAnnotation";

const annotationFixture = (): DocumentAnnotationComment => ({
  format: "pdf" as const,
  id: "comment-1",
  path: "/workspace/report.pdf",
  sourceSha256: "a".repeat(64),
  body: "修改这一处",
  pageNumber: 2,
  pageCount: 12,
  pageSize: { width: 600, height: 800 },
  anchor: { kind: "point", point: { x: 100, y: 200 } },
});

describe("文档批注位置与请求", () => {
  it.each(["pdf", "docx"] as const)(
    "%s 全批次保留位置和源版本，canonical 展示严格重建",
    (format) => {
      const first = {
        ...annotationFixture(),
        format,
        path: `/workspace/report.${format}`,
      };
      const second = {
        ...first,
        id: "comment-2",
        pageNumber: 3,
        body: "第二条修改",
        screenshot: {
          data: "aGVsbG8=",
          mediaType: "image/png" as const,
          width: 100,
          height: 100,
        },
      };
      const request = buildDocumentAnnotationBatchRequest([first, second]);
      expect(
        request.requestMetadata.artifactAnnotationBatch.comments,
      ).toHaveLength(2);
      expect(request.prompt).not.toContain(second.screenshot.data);
      expect(readDocumentAnnotationDisplayContent(request.prompt)).toBe(
        `report.${format} · 2\n修改这一处\n\nreport.${format} · 3\n第二条修改`,
      );
      expect(
        readDocumentAnnotationDisplayContent(request.prompt + "\n额外指令"),
      ).toBeNull();
      expect(
        readDocumentAnnotationDisplayContent(
          request.prompt.replace(
            '"comments": [',
            '"extra": "保留", "comments": [',
          ),
        ),
      ).toBeNull();
      expect(
        readDocumentAnnotationDisplayContent(
          request.prompt.replace('"pageNumber": 3', '"pageNumber": 0'),
        ),
      ).toBeNull();
      expect(
        readDocumentAnnotationDisplayContent(
          request.prompt.replace('"id": "comment-2"', '"id": "comment-1"'),
        ),
      ).toBeNull();
    },
  );

  it("不允许空批次、重复标识或混合文件/格式/源版本", () => {
    const first = annotationFixture();
    expect(() => buildDocumentAnnotationBatchRequest([])).toThrow();
    expect(() => buildDocumentAnnotationBatchRequest([first, first])).toThrow();
    for (const changed of [
      { path: "/workspace/other.pdf" },
      { format: "docx" as const },
      { sourceSha256: "b".repeat(64) },
      { body: "" },
    ])
      expect(() =>
        buildDocumentAnnotationBatchRequest([
          first,
          { ...first, id: "comment-2", ...changed },
        ]),
      ).toThrow();
  });
  it("DOCX 使用相同坐标与显示合同，但不能伪装为 PDF 输入", () => {
    const comment: DocumentAnnotationComment = {
      ...annotationFixture(),
      format: "docx",
      path: "/workspace/report.docx",
    };
    const request = buildDocumentAnnotationRequest(comment);
    expect(request.requestMetadata.artifactAnnotation.type).toBe("docx");
    expect(request.prompt).toContain("Request changes to the DOCX");
    expect(readDocumentAnnotationDisplayContent(request.prompt)).toBe(
      "report.docx · 2\n修改这一处",
    );
    expect(
      readDocumentAnnotationDisplayContent(
        request.prompt.replace('"type": "docx"', '"type": "pdf"'),
      ),
    ).toBeNull();
  });
  it("从完整 canonical 输入重建用户批注展示，不依赖本地临时消息", () => {
    const request = buildDocumentAnnotationRequest({
      ...annotationFixture(),
      path: "C:\\work\\report.pdf",
      screenshot: {
        data: "AA==",
        mediaType: "image/png",
        width: 200,
        height: 100,
      },
    });
    expect(readDocumentAnnotationDisplayContent(request.prompt)).toBe(
      "report.pdf · 2\n修改这一处",
    );
    expect(readDocumentAnnotationDisplayContent(request.prompt)).toBe(
      request.displayContent,
    );
    expect(request.prompt).toContain('"sourceSha256"');
    expect(
      readDocumentAnnotationDisplayContent(`${request.prompt}\n额外要求`),
    ).toBeNull();
    expect(
      readDocumentAnnotationDisplayContent(
        request.prompt.replace('"pageNumber": 2', '"pageNumber": 0'),
      ),
    ).toBeNull();
    expect(
      readDocumentAnnotationDisplayContent(
        request.prompt.replace(
          '"type": "pdf"',
          '"type": "pdf", "extra": "不得隐藏"',
        ),
      ),
    ).toBeNull();
    expect(
      readDocumentAnnotationDisplayContent(
        request.prompt.replace('"x": 100', '"x": 100, "extra": "不得隐藏"'),
      ),
    ).toBeNull();
    expect(
      readDocumentAnnotationDisplayContent('{"body":"普通 JSON 保留"}'),
    ).toBeNull();
  });

  it("保留源版本、页码和页面坐标，不把正文拼为指令字段", () => {
    const comment = annotationFixture();
    const { format, ...annotation } = comment;
    const request = buildDocumentAnnotationRequest(comment);
    expect(request.requestMetadata.artifactAnnotation).toEqual({
      type: format,
      ...annotation,
    });
    expect(JSON.parse(request.prompt.split("\n\n")[1])).toEqual({
      type: format,
      ...annotation,
    });
  });

  it("截图作为媒体独立发送，正文与结构化 metadata 只携带尺寸", () => {
    const screenshot = {
      data: "iVBORw0KGgo=",
      mediaType: "image/png" as const,
      width: 200,
      height: 100,
    };
    const request = buildDocumentAnnotationRequest({
      ...annotationFixture(),
      screenshot,
    });
    expect(request.prompt).not.toContain(screenshot.data);
    expect(request.requestMetadata.artifactAnnotation.screenshot).toEqual({
      mediaType: "image/png",
      width: 200,
      height: 100,
    });
    expect(() =>
      buildDocumentAnnotationRequest({
        ...annotationFixture(),
        screenshot: { ...screenshot, width: 1025 },
      }),
    ).toThrow("screenshot");
  });

  it.each([
    { path: "relative.pdf" },
    { path: "/tmp/a\0.pdf" },
    { id: "" },
    { body: " \n" },
    { sourceSha256: "unknown" },
    { pageNumber: 0 },
    { pageNumber: 1.5 },
    { pageNumber: 13 },
    { pageSize: { width: Infinity, height: 800 } },
    { anchor: { kind: "point", point: { x: NaN, y: 2 } } },
    { anchor: { kind: "point", point: { x: 601, y: 2 } } },
  ])("拒绝无效文件身份或坐标 %j", (patch) => {
    expect(() =>
      buildDocumentAnnotationRequest({
        ...annotationFixture(),
        ...patch,
      } as DocumentAnnotationComment),
    ).toThrow();
  });

  it("拒绝空选区与超出聚合范围的选区，接受跨平台绝对路径", () => {
    const comment = annotationFixture();
    const rect = { x: 10, y: 20, width: 100, height: 50 };
    comment.anchor = {
      kind: "region",
      rect,
      selectionKind: "text",
      selectedText: "原文",
      selectionRects: [rect],
    };
    expect(() => buildDocumentAnnotationRequest(comment)).not.toThrow();
    comment.anchor.selectionRects = [{ ...rect, width: 110 }];
    expect(() => buildDocumentAnnotationRequest(comment)).toThrow("region");
    comment.anchor.selectionRects = [];
    expect(() => buildDocumentAnnotationRequest(comment)).toThrow("region");
    expect(() =>
      buildDocumentAnnotationRequest({
        ...annotationFixture(),
        path: "C:\\work\\report.pdf",
      }),
    ).not.toThrow();
  });

  it("缩放后的同页选区裁剪并转换到 scale 1，跨页选区拒绝", () => {
    const layer = document.createElement("div");
    const start = document.createTextNode("some text");
    layer.appendChild(start);
    const selection = {
      toString: () => "some text",
      rangeCount: 1,
      anchorNode: start,
      focusNode: start,
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 80, top: 240, right: 300, bottom: 280 },
          { left: 100, top: 280, right: 400, bottom: 320 },
        ],
      }),
    } as unknown as Selection;
    const params = {
      selection,
      textLayer: layer,
      pageRect: {
        left: 100,
        top: 200,
        right: 1300,
        bottom: 1800,
        width: 1200,
        height: 1600,
      } as DOMRect,
      pageSize: { width: 600, height: 800 },
      pageNumber: 2,
    };
    expect(resolveDocumentSelection(params)?.anchor).toEqual({
      kind: "region",
      selectedText: "some text",
      selectionKind: "text",
      selectionRects: [
        { x: 0, y: 20, width: 100, height: 20 },
        { x: 0, y: 40, width: 150, height: 20 },
      ],
      rect: { x: 0, y: 20, width: 150, height: 40 },
    });
    expect(
      resolveDocumentSelection({
        ...params,
        selection: {
          ...selection,
          focusNode: document.createTextNode("other page"),
        } as Selection,
      }),
    ).toBeNull();
    expect(resolveDocumentSelection({ ...params, selection: null })).toBeNull();
  });
});
