import { isAbsoluteLocalFilePath } from "@/lib/api/fileSystem";

export interface PresentationAnnotationTarget {
  slideId: string;
  position?: { x: number; y: number };
}

export interface PresentationAnnotationComment {
  format: "presentation";
  sourceFormat: "pptx";
  id: string;
  path: string;
  sourceSha256: string;
  target: PresentationAnnotationTarget;
  slideNumber: number;
  slideCount: number;
  slideSize: { width: number; height: number };
  body: string;
  screenshot?: never;
}

const prefix = (batch: boolean) =>
  `Request changes to the presentation using ${batch ? "these annotations as one batch" : "this annotation"}. Verify the source file revision before editing. Targets use the original OOXML slide identifier and intrinsic slide coordinates.\n\n`;

export function buildPresentationAnnotationRequest(
  comment: PresentationAnnotationComment,
) {
  const { target, slideSize } = comment;
  if (
    comment.format !== "presentation" ||
    comment.sourceFormat !== "pptx" ||
    typeof comment.id !== "string" ||
    !comment.id.trim() ||
    comment.id !== comment.id.trim() ||
    !isAbsoluteLocalFilePath(comment.path) ||
    comment.path.includes("\0") ||
    !/^[a-f0-9]{64}$/.test(comment.sourceSha256) ||
    typeof comment.body !== "string" ||
    !comment.body.trim() ||
    !target ||
    typeof target.slideId !== "string" ||
    !/^[1-9][0-9]*$/.test(target.slideId) ||
    !Number.isSafeInteger(Number(target.slideId)) ||
    Number(target.slideId) < 256 ||
    Number(target.slideId) > 2147483647 ||
    !Number.isInteger(comment.slideNumber) ||
    !Number.isInteger(comment.slideCount) ||
    comment.slideNumber < 1 ||
    comment.slideNumber > comment.slideCount ||
    !slideSize ||
    !Number.isFinite(slideSize.width) ||
    !Number.isFinite(slideSize.height) ||
    slideSize.width <= 0 ||
    slideSize.height <= 0 ||
    (target.position !== undefined &&
      (!Number.isFinite(target.position?.x) ||
        !Number.isFinite(target.position?.y) ||
        target.position.x < 0 ||
        target.position.y < 0 ||
        target.position.x > slideSize.width ||
        target.position.y > slideSize.height)) ||
    comment.screenshot !== undefined
  )
    throw new Error("Invalid presentation annotation");
  const metadata = {
    type: "presentation" as const,
    id: comment.id,
    path: comment.path,
    sourceFormat: comment.sourceFormat,
    sourceSha256: comment.sourceSha256,
    target: {
      slideId: target.slideId,
      ...(target.position ? { position: { ...target.position } } : {}),
    },
    slideNumber: comment.slideNumber,
    slideCount: comment.slideCount,
    slideSize: { ...slideSize },
    body: comment.body,
  };
  const displayContent = `${comment.path.split(/[\\/]/).at(-1)} · Slide ${comment.slideNumber}\n${comment.body}`;
  return {
    displayContent,
    prompt: `${prefix(false)}${JSON.stringify(metadata, null, 2)}`,
    requestMetadata: { artifactAnnotation: metadata },
  };
}

export function buildPresentationAnnotationBatchRequest(
  comments: readonly PresentationAnnotationComment[],
) {
  const first = comments[0];
  if (
    !first ||
    new Set(comments.map((comment) => comment.id)).size !== comments.length ||
    comments.some(
      (comment) =>
        comment.path !== first.path ||
        comment.sourceSha256 !== first.sourceSha256 ||
        comment.slideCount !== first.slideCount ||
        comment.slideSize.width !== first.slideSize.width ||
        comment.slideSize.height !== first.slideSize.height,
    )
  )
    throw new Error("Invalid presentation annotation batch");
  const requests = comments.map(buildPresentationAnnotationRequest);
  const metadata = {
    type: "presentation" as const,
    path: first.path,
    comments: requests.map(
      (request) => request.requestMetadata.artifactAnnotation,
    ),
  };
  return {
    displayContent: requests
      .map((request) => request.displayContent)
      .join("\n\n"),
    prompt: `${prefix(true)}${JSON.stringify(metadata, null, 2)}`,
    requestMetadata: { artifactAnnotationBatch: metadata },
  };
}

/** 只缩略严格可重建的 canonical 输入，保留未知格式原文。 */
export function readPresentationAnnotationDisplayContent(content: string) {
  const batch = content.startsWith(prefix(true));
  if (!batch && !content.startsWith(prefix(false))) return null;
  try {
    const value = JSON.parse(content.slice(prefix(batch).length));
    if (!value || value.type !== "presentation") return null;
    const rebuild = (record: Record<string, unknown>) => ({
      ...record,
      format: "presentation" as const,
    });
    const result = batch
      ? buildPresentationAnnotationBatchRequest(value.comments.map(rebuild))
      : buildPresentationAnnotationRequest(
          rebuild(value) as PresentationAnnotationComment,
        );
    return result.prompt === content ? result.displayContent : null;
  } catch {
    return null;
  }
}
