import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePdfAnnotationScreenshot } from "./pdfAnnotationScreenshot";

afterEach(() => vi.restoreAllMocks());

describe("PDF 位置截图", () => {
  const target = {
    pageNumber: 1,
    pageSize: { width: 600, height: 800 },
    anchor: { kind: "point" as const, point: { x: 30, y: 40 } },
  };
  const setup = () => {
    const source = document.createElement("canvas");
    source.width = 1200;
    source.height = 1600;
    const context = {
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      strokeStyle: "",
      lineWidth: 0,
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    return { source, context };
  };

  it("以实际像素比例裁剪页边缘，标记与坐标一致", () => {
    const { source, context } = setup();
    expect(capturePdfAnnotationScreenshot(source, target)).toEqual({
      data: "iVBORw0KGgo=",
      mediaType: "image/png",
      width: 300,
      height: 320,
    });
    expect(context.drawImage).toHaveBeenCalledWith(
      source,
      0,
      0,
      300,
      320,
      0,
      0,
      300,
      320,
    );
    expect(context.arc).toHaveBeenCalledWith(60, 80, 6, 0, Math.PI * 2);
  });

  it("文本区域截图限制尺寸且保留每行选区，截图失败不丢定位", () => {
    const { source, context } = setup();
    source.width = 4800;
    source.height = 6400;
    const rect = { x: 0, y: 0, width: 600, height: 800 };
    const image = capturePdfAnnotationScreenshot(source, {
      ...target,
      anchor: {
        kind: "region",
        rect,
        selectionKind: "text",
        selectedText: "text",
        selectionRects: [rect],
      },
    });
    expect(image?.width).toBe(768);
    expect(image?.height).toBe(1024);
    expect(context.strokeRect).toHaveBeenCalledWith(0, 0, 768, 1024);
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementation(() => {
      throw new Error("canvas unavailable");
    });
    expect(capturePdfAnnotationScreenshot(source, target)).toBeUndefined();
  });
});
