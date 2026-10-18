import { describe, expect, it } from "vitest";
import {
  buildPresentationAnnotationRequest,
  buildPresentationAnnotationBatchRequest,
  readPresentationAnnotationDisplayContent,
  type PresentationAnnotationComment,
} from "./presentationAnnotation";

const comment: PresentationAnnotationComment = {
  format: "presentation",
  sourceFormat: "pptx",
  id: "note1",
  path: "/workspace/deck.pptx",
  sourceSha256: "a".repeat(64),
  target: { slideId: "258", position: { x: 120, y: 85 } },
  slideNumber: 2,
  slideCount: 3,
  slideSize: { width: 960, height: 540 },
  body: "修改这张幻灯片",
};

describe("Presentation slide identity 批注", () => {
  it("保留源slideId与坐标，canonical缩略可严格重建，额外信息不隐藏", () => {
    const request = buildPresentationAnnotationRequest(comment);
    expect(request.requestMetadata.artifactAnnotation).toEqual({
      type: "presentation",
      id: "note1",
      path: "/workspace/deck.pptx",
      sourceFormat: "pptx",
      sourceSha256: "a".repeat(64),
      target: { slideId: "258", position: { x: 120, y: 85 } },
      slideNumber: 2,
      slideCount: 3,
      slideSize: { width: 960, height: 540 },
      body: "修改这张幻灯片",
    });
    expect(readPresentationAnnotationDisplayContent(request.prompt)).toBe(
      request.displayContent,
    );
    expect(request.displayContent).toContain("deck.pptx · Slide 2");
    expect(
      readPresentationAnnotationDisplayContent(`${request.prompt}\nextra`),
    ).toBeNull();
    expect(
      readPresentationAnnotationDisplayContent(
        request.prompt.replace('"body":', '"extra": true, "body":'),
      ),
    ).toBeNull();
  });

  it("跨slide批次只包含原目标，拒绝混文件、版本、重复id或尺寸", () => {
    const next = {
      ...comment,
      id: "note2",
      target: { slideId: "900" },
      slideNumber: 3,
    };
    const batch = buildPresentationAnnotationBatchRequest([comment, next]);
    expect(
      batch.requestMetadata.artifactAnnotationBatch.comments.map(
        (item) => item.target,
      ),
    ).toEqual([
      { slideId: "258", position: { x: 120, y: 85 } },
      { slideId: "900" },
    ]);
    expect(readPresentationAnnotationDisplayContent(batch.prompt)).toBe(
      batch.displayContent,
    );
    for (const invalid of [
      { ...next, path: "/workspace/other.pptx" },
      { ...next, sourceSha256: "b".repeat(64) },
      { ...next, id: comment.id },
      { ...next, slideCount: 4 },
      { ...next, slideSize: { width: 800, height: 600 } },
    ])
      expect(() =>
        buildPresentationAnnotationBatchRequest([comment, invalid]),
      ).toThrow();
  });

  it.each([
    { target: { slideId: "2" } },
    { target: { slideId: "0258" } },
    { target: { slideId: "2147483648" } },
    { target: { slideId: "258", position: { x: NaN, y: 2 } } },
    { target: { slideId: "258", position: { x: 961, y: 2 } } },
    { target: { slideId: "258", position: { x: -1, y: 2 } } },
    { path: "relative/deck.pptx" },
    { sourceSha256: "invalid" },
    { slideNumber: 4 },
    { slideSize: { width: 0, height: 540 } },
  ])("非法源/slide/坐标拒绝：%j", (invalid) => {
    expect(() =>
      buildPresentationAnnotationRequest({ ...comment, ...invalid }),
    ).toThrow();
  });
});
