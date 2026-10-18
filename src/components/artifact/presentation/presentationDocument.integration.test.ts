import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPresentationDocument,
  readPresentationSlideIds,
  removeExternalPresentationRelationships,
  renderPresentationSlide,
  sanitizePresentationSlide,
} from "./presentationDocument";

const mocks = vi.hoisted(() => ({ readBytes: vi.fn() }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: mocks.readBytes }));
const fixture = () =>
  new Uint8Array(
    fs.readFileSync(
      "src/components/artifact/presentation/__fixtures__/review.pptx",
    ),
  );

describe("真实PPTX解析与源slide identity", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    mocks.readBytes.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());
  it("原字节构建三张版式，非顺序OOXML slideId不降级成页码", async () => {
    mocks.readBytes.mockResolvedValue(fixture());
    const snapshot = await loadPresentationDocument(
      "/workspace/deck.pptx",
      new AbortController().signal,
    );
    expect(snapshot.slideIds).toEqual(["512", "900", "300"]);
    expect(snapshot.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect([snapshot.model.width, snapshot.model.height]).toEqual([960, 540]);
    for (let index = 0; index < 3; index++) {
      const handle = renderPresentationSlide(snapshot, index);
      try {
        await handle.ready;
        sanitizePresentationSlide(handle.element);
        expect(handle.element.textContent).toContain(
          `SLIDE_PREVIEW_0${index + 1}`,
        );
        expect(handle.element.querySelector("a[href]")).toBeNull();
        expect(handle.element.querySelector("script,iframe,object")).toBeNull();
        expect(handle.element.style.width).toBe("960px");
      } finally {
        handle.dispose();
      }
    }
  });

  it("原读取迟到但已取消时不再导入，损坏ZIP明确失败", async () => {
    let resolve!: (bytes: Uint8Array) => void;
    mocks.readBytes.mockReturnValueOnce(
      new Promise<Uint8Array>((done) => {
        resolve = done;
      }),
    );
    const controller = new AbortController();
    const pending = loadPresentationDocument(
      "/workspace/deck.pptx",
      controller.signal,
    );
    controller.abort();
    resolve(fixture());
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    mocks.readBytes.mockResolvedValueOnce(new Uint8Array([0, 1, 2]));
    await expect(
      loadPresentationDocument(
        "/workspace/broken.pptx",
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });

  it("拒绝DTD、重复slideId与无效XML，移除外部关系并保留内部关系", () => {
    const ns = "http://schemas.openxmlformats.org/presentationml/2006/main";
    for (const xml of [
      "<!DOCTYPE presentation><presentation/>",
      `<p:presentation xmlns:p="${ns}"><p:sldIdLst><p:sldId id="256"/><p:sldId id="256"/></p:sldIdLst></p:presentation>`,
      "<broken>",
    ])
      expect(() => readPresentationSlideIds(xml)).toThrow();
    const xml = removeExternalPresentationRelationships(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="local" Target="slides/slide1.xml"/><Relationship Id="remote" Target="https://example.invalid/a"/><Relationship Id="external" Target="file:///tmp/x" TargetMode="External"/></Relationships>',
    );
    expect(xml).toContain('Id="local"');
    expect(xml).not.toContain('Id="remote"');
    expect(xml).not.toContain('Id="external"');
  });

  it("受限frame节点不携带活动内容或外部导航，保留绘制的canvas与嵌入图像", () => {
    const slide = document.createElement("div");
    slide.innerHTML =
      '<script>1</script><iframe></iframe><a href="javascript:alert(1)" onclick="alert(1)">link</a><img src="https://example.invalid/image"><img src="blob:local-image"><canvas></canvas>';
    const canvas = slide.querySelector("canvas");
    sanitizePresentationSlide(slide);
    expect(slide.querySelector("script,iframe,a[href],[onclick]")).toBeNull();
    expect(slide.querySelectorAll("img")[0].getAttribute("src")).toBeNull();
    expect(slide.querySelectorAll("img")[1].getAttribute("src")).toBe(
      "blob:local-image",
    );
    expect(slide.querySelector("canvas")).toBe(canvas);
  });
});
