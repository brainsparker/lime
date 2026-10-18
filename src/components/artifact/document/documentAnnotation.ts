export interface DocumentPoint {
  x: number;
  y: number;
}

export interface DocumentRect extends DocumentPoint {
  width: number;
  height: number;
}

export interface DocumentAnnotationScreenshot {
  data: string;
  mediaType: "image/png";
  width: number;
  height: number;
}

export type DocumentAnnotationAnchor =
  | { kind: "point"; point: DocumentPoint }
  | {
      kind: "region";
      rect: DocumentRect;
      selectedText: string;
      selectionKind: "text";
      selectionRects: DocumentRect[];
    };

export interface DocumentAnnotationTarget {
  pageNumber: number;
  pageSize: { width: number; height: number };
  anchor: DocumentAnnotationAnchor;
  screenshot?: DocumentAnnotationScreenshot;
}

export interface DocumentAnnotationComment extends DocumentAnnotationTarget {
  format: "pdf" | "docx";
  id: string;
  path: string;
  sourceSha256: string;
  pageCount: number;
  body: string;
}

const requestPrefix = (format: DocumentAnnotationComment["format"]) =>
  `Request changes to the ${format === "pdf" ? "PDF" : "DOCX"} using this annotation. Verify the source file revision before editing. Coordinates use the displayed page at scale 1, with the origin at the top left.\n\n`;
const batchPrefix = (format: DocumentAnnotationComment["format"]) =>
  `Request changes to the ${format === "pdf" ? "PDF" : "DOCX"} using these annotations as one batch. Verify the source file revision before editing. Coordinates use the displayed page at scale 1, with the origin at the top left.\n\n`;

export function formatDocumentAnnotationComment(
  comment: Pick<DocumentAnnotationComment, "path" | "pageNumber" | "body">,
): string {
  return `${comment.path.split(/[\\/]/).at(-1)} · ${comment.pageNumber}\n${comment.body}`;
}

/** 仅识别可完整重建的批注输入；原 canonical 内容仍用于模型、审计和恢复。 */
export function readDocumentAnnotationDisplayContent(
  content: string,
): string | null {
  const format = (["pdf", "docx"] as const).find((value) =>
    content.startsWith(requestPrefix(value)),
  );
  if (!format) return readDocumentAnnotationBatchDisplayContent(content);
  try {
    const value: unknown = JSON.parse(
      content.slice(requestPrefix(format).length),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const record = value as Record<string, unknown>;
    const { type, screenshot, ...comment } = record;
    if (
      type !== format ||
      !hasOnlyKeys(comment, [
        "id",
        "path",
        "sourceSha256",
        "pageCount",
        "body",
        "pageNumber",
        "pageSize",
        "anchor",
      ]) ||
      !hasOnlyKeys(comment.pageSize, ["width", "height"])
    )
      return null;
    const anchor = comment.anchor as Record<string, unknown> | null;
    if (!anchor || (anchor.kind !== "point" && anchor.kind !== "region"))
      return null;
    if (anchor.kind === "point") {
      if (
        !hasOnlyKeys(anchor, ["kind", "point"]) ||
        !hasOnlyKeys(anchor.point, ["x", "y"])
      )
        return null;
    } else if (
      !hasOnlyKeys(anchor, [
        "kind",
        "rect",
        "selectedText",
        "selectionKind",
        "selectionRects",
      ]) ||
      !hasOnlyKeys(anchor.rect, ["x", "y", "width", "height"]) ||
      !Array.isArray(anchor.selectionRects) ||
      !anchor.selectionRects.every((rect) =>
        hasOnlyKeys(rect, ["x", "y", "width", "height"]),
      )
    )
      return null;
    if (
      screenshot !== undefined &&
      !hasOnlyKeys(screenshot, ["mediaType", "width", "height"])
    )
      return null;
    const reconstructed = buildDocumentAnnotationRequest({
      format,
      ...comment,
      // 媒体字节独立传输；此值仅复用已有截图尺寸校验，不进入重建文本。
      ...(screenshot ? { screenshot: { ...screenshot, data: "AA==" } } : {}),
    } as DocumentAnnotationComment);
    if (reconstructed.prompt !== content) return null;
    return formatDocumentAnnotationComment(
      comment as unknown as DocumentAnnotationComment,
    );
  } catch {
    return null;
  }
}

function readDocumentAnnotationBatchDisplayContent(
  content: string,
): string | null {
  const format = (["pdf", "docx"] as const).find((value) =>
    content.startsWith(batchPrefix(value)),
  );
  if (!format) return null;
  try {
    const value: unknown = JSON.parse(
      content.slice(batchPrefix(format).length),
    );
    if (
      !hasOnlyKeys(value, ["type", "path", "comments"]) ||
      value.type !== format ||
      !Array.isArray(value.comments)
    )
      return null;
    const comments = value.comments.map((record: unknown) => {
      if (
        !hasOnlyKeys(record, [
          "type",
          "id",
          "path",
          "sourceSha256",
          "pageCount",
          "body",
          "pageNumber",
          "pageSize",
          "anchor",
          "screenshot",
        ]) ||
        !readDocumentAnnotationDisplayContent(
          `${requestPrefix(format)}${JSON.stringify(record, null, 2)}`,
        )
      )
        throw new Error("Invalid batch annotation");
      const { type: _type, screenshot, ...comment } = record;
      return {
        ...comment,
        format,
        ...(screenshot
          ? { screenshot: { ...(screenshot as object), data: "AA==" } }
          : {}),
      } as DocumentAnnotationComment;
    });
    const request = buildDocumentAnnotationBatchRequest(comments);
    return request.prompt === content ? request.displayContent : null;
  } catch {
    return null;
  }
}

export function buildDocumentAnnotationBatchRequest(
  comments: readonly DocumentAnnotationComment[],
) {
  const first = comments[0];
  if (
    !first ||
    new Set(comments.map((comment) => comment.id)).size !== comments.length ||
    comments.some(
      (comment) =>
        comment.path !== first.path ||
        comment.format !== first.format ||
        comment.sourceSha256 !== first.sourceSha256,
    )
  )
    throw new Error("Invalid document annotation batch");
  const requests = comments.map(buildDocumentAnnotationRequest);
  const metadata = {
    type: first.format,
    path: first.path,
    comments: requests.map(
      (request) => request.requestMetadata.artifactAnnotation,
    ),
  };
  return {
    displayContent: requests
      .map((request) => request.displayContent)
      .join("\n\n"),
    prompt: `${batchPrefix(first.format)}${JSON.stringify(metadata, null, 2)}`,
    requestMetadata: { artifactAnnotationBatch: metadata },
  };
}

function hasOnlyKeys(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key)),
  );
}

export function resolveDocumentSelection({
  selection,
  textLayer,
  pageRect,
  pageSize,
  pageNumber,
}: {
  selection: Selection | null;
  textLayer: HTMLElement;
  pageRect: DOMRect;
  pageSize: DocumentAnnotationTarget["pageSize"];
  pageNumber: number;
}): DocumentAnnotationTarget | null {
  const selectedText = selection?.toString().trim();
  if (
    !selectedText ||
    selectedText.length > 16_384 ||
    !selection?.rangeCount ||
    !textLayer.contains(selection.anchorNode) ||
    !textLayer.contains(selection.focusNode) ||
    pageRect.width <= 0 ||
    pageRect.height <= 0
  )
    return null;
  const rects = Array.from(selection.getRangeAt(0).getClientRects())
    .map((rect) => {
      const left = Math.max(rect.left, pageRect.left);
      const top = Math.max(rect.top, pageRect.top);
      const right = Math.min(rect.right, pageRect.right);
      const bottom = Math.min(rect.bottom, pageRect.bottom);
      return {
        x: ((left - pageRect.left) / pageRect.width) * pageSize.width,
        y: ((top - pageRect.top) / pageRect.height) * pageSize.height,
        width: ((right - left) / pageRect.width) * pageSize.width,
        height: ((bottom - top) / pageRect.height) * pageSize.height,
      };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!rects.length) return null;
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  return {
    pageNumber,
    pageSize,
    anchor: {
      kind: "region",
      selectedText,
      selectionKind: "text",
      selectionRects: rects,
      rect: {
        x,
        y,
        width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x,
        height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y,
      },
    },
  };
}

export function buildDocumentAnnotationRequest(
  comment: DocumentAnnotationComment,
) {
  if (
    !["pdf", "docx"].includes(comment.format) ||
    !comment.body.trim() ||
    !comment.id.trim() ||
    comment.id !== comment.id.trim() ||
    !isAbsoluteLocalFilePath(comment.path) ||
    comment.path.includes("\0") ||
    !/^[a-f0-9]{64}$/.test(comment.sourceSha256)
  )
    throw new Error("Invalid document annotation");
  const { anchor, pageSize, pageNumber, pageCount } = comment;
  const numbers = [pageNumber, pageCount, pageSize.width, pageSize.height];
  if (
    numbers.some((value) => !Number.isFinite(value)) ||
    !Number.isInteger(pageNumber) ||
    !Number.isInteger(pageCount) ||
    pageNumber < 1 ||
    pageNumber > pageCount ||
    pageSize.width <= 0 ||
    pageSize.height <= 0
  )
    throw new Error("Invalid document page");
  const points =
    anchor.kind === "point"
      ? [anchor.point]
      : [anchor.rect, ...anchor.selectionRects];
  if (
    points.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.y < 0 ||
        point.x > pageSize.width ||
        point.y > pageSize.height,
    )
  )
    throw new Error("Invalid document anchor");
  if (
    anchor.kind === "region" &&
    (anchor.selectionKind !== "text" ||
      !anchor.selectedText.trim() ||
      anchor.selectedText.length > 16_384 ||
      !anchor.selectionRects.length ||
      [anchor.rect, ...anchor.selectionRects].some(
        (rect) =>
          !Number.isFinite(rect.width) ||
          !Number.isFinite(rect.height) ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          rect.x < anchor.rect.x - 0.01 ||
          rect.y < anchor.rect.y - 0.01 ||
          rect.x + rect.width > anchor.rect.x + anchor.rect.width + 0.01 ||
          rect.y + rect.height > anchor.rect.y + anchor.rect.height + 0.01 ||
          rect.x + rect.width > pageSize.width + 0.01 ||
          rect.y + rect.height > pageSize.height + 0.01,
      ))
  )
    throw new Error("Invalid document region");
  const { screenshot, format, ...annotation } = comment;
  if (
    screenshot &&
    (screenshot.mediaType !== "image/png" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(screenshot.data) ||
      screenshot.data.length > 6_000_000 ||
      !Number.isInteger(screenshot.width) ||
      !Number.isInteger(screenshot.height) ||
      screenshot.width < 1 ||
      screenshot.height < 1 ||
      screenshot.width > 1024 ||
      screenshot.height > 1024)
  )
    throw new Error("Invalid document screenshot");
  const metadata = {
    type: format,
    ...annotation,
    ...(screenshot
      ? {
          screenshot: {
            mediaType: screenshot.mediaType,
            width: screenshot.width,
            height: screenshot.height,
          },
        }
      : {}),
  };
  return {
    displayContent: formatDocumentAnnotationComment(comment),
    prompt: `${requestPrefix(format)}${JSON.stringify(metadata, null, 2)}`,
    requestMetadata: { artifactAnnotation: metadata },
  };
}
import { isAbsoluteLocalFilePath } from "@/lib/api/fileSystem";
