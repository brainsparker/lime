import type {
  DocumentAnnotationScreenshot,
  DocumentAnnotationTarget,
} from "./documentAnnotation";

/** 从已显示的同一页像素截取上下文，不重新读取或重新解释源文件。 */
export function capturePdfAnnotationScreenshot(
  canvas: HTMLCanvasElement,
  target: DocumentAnnotationTarget,
): DocumentAnnotationScreenshot | undefined {
  if (
    !canvas.width ||
    !canvas.height ||
    !target.pageSize.width ||
    !target.pageSize.height
  )
    return;
  const { anchor, pageSize } = target;
  const point = anchor.kind === "point" ? anchor.point : anchor.rect;
  const padding = anchor.kind === "point" ? 120 : 24;
  const left = Math.max(0, point.x - padding);
  const top = Math.max(0, point.y - padding);
  const right = Math.min(
    pageSize.width,
    point.x + (anchor.kind === "point" ? 0 : anchor.rect.width) + padding,
  );
  const bottom = Math.min(
    pageSize.height,
    point.y + (anchor.kind === "point" ? 0 : anchor.rect.height) + padding,
  );
  const scaleX = canvas.width / pageSize.width;
  const scaleY = canvas.height / pageSize.height;
  const sourceWidth = (right - left) * scaleX;
  const sourceHeight = (bottom - top) * scaleY;
  if (sourceWidth <= 0 || sourceHeight <= 0) return;
  const scale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight));
  const result = document.createElement("canvas");
  result.width = Math.max(1, Math.round(sourceWidth * scale));
  result.height = Math.max(1, Math.round(sourceHeight * scale));
  try {
    const context = result.getContext("2d");
    if (!context) return;
    context.drawImage(
      canvas,
      left * scaleX,
      top * scaleY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      result.width,
      result.height,
    );
    context.strokeStyle = "#e11d48";
    context.lineWidth = 2;
    if (anchor.kind === "point") {
      context.beginPath();
      context.arc(
        (point.x - left) * scaleX * scale,
        (point.y - top) * scaleY * scale,
        6,
        0,
        Math.PI * 2,
      );
      context.stroke();
    } else {
      for (const rect of anchor.selectionRects)
        context.strokeRect(
          (rect.x - left) * scaleX * scale,
          (rect.y - top) * scaleY * scale,
          rect.width * scaleX * scale,
          rect.height * scaleY * scale,
        );
    }
    const url = result.toDataURL("image/png");
    const data = url.startsWith("data:image/png;base64,") ? url.slice(22) : "";
    if (!data) return;
    return {
      data,
      mediaType: "image/png",
      width: result.width,
      height: result.height,
    };
  } catch {
    // 截图失败不阻止批注，页面坐标和源文件版本仍为定位依据。
    return;
  }
}
