import { isAbsoluteLocalFilePath } from "@/lib/api/fileSystem";
import { cellAddress, parseCellRange } from "./workbookRange";
import type { WorkbookSourceFormat } from "./workbookSnapshot";

export interface WorkbookAnnotationTarget {
  sheetName: string;
  sheetId: string;
  address: string;
}

export interface WorkbookAnnotationComment extends WorkbookAnnotationTarget {
  format: "workbook";
  sourceFormat: WorkbookSourceFormat;
  id: string;
  path: string;
  sourceSha256: string;
  body: string;
  screenshot?: never;
}

const prefix = (batch: boolean) =>
  `Request changes to the workbook using ${batch ? "these annotations as one batch" : "this annotation"}. Verify the source file revision before editing. Targets use the original sheet name, sheet identifier and A1 cell range.\n\n`;

export function formatWorkbookAnnotationComment(
  comment: Pick<
    WorkbookAnnotationComment,
    "path" | "sheetName" | "address" | "body"
  >,
) {
  return `${comment.path.split(/[\\/]/).at(-1)} · ${comment.sheetName}!${comment.address}\n${comment.body}`;
}

export function buildWorkbookAnnotationRequest(
  comment: WorkbookAnnotationComment,
) {
  const range =
    typeof comment.address === "string"
      ? parseCellRange(comment.address)
      : null;
  const normalized =
    range &&
    (cellAddress(range.start) === cellAddress(range.end)
      ? cellAddress(range.start)
      : `${cellAddress(range.start)}:${cellAddress(range.end)}`);
  if (
    comment.format !== "workbook" ||
    !["xlsx", "csv", "tsv"].includes(comment.sourceFormat) ||
    typeof comment.body !== "string" ||
    !comment.body.trim() ||
    typeof comment.id !== "string" ||
    !comment.id.trim() ||
    comment.id !== comment.id.trim() ||
    !isAbsoluteLocalFilePath(comment.path) ||
    comment.path.includes("\0") ||
    !/^[a-f0-9]{64}$/.test(comment.sourceSha256) ||
    typeof comment.sheetName !== "string" ||
    !comment.sheetName.trim() ||
    comment.sheetName.length > 256 ||
    typeof comment.sheetId !== "string" ||
    !comment.sheetId.trim() ||
    comment.sheetId.length > 256 ||
    !normalized ||
    normalized !== comment.address ||
    comment.screenshot !== undefined
  )
    throw new Error("Invalid workbook annotation");
  const metadata = {
    type: "workbook" as const,
    id: comment.id,
    path: comment.path,
    sourceSha256: comment.sourceSha256,
    sourceFormat: comment.sourceFormat,
    sheetName: comment.sheetName,
    sheetId: comment.sheetId,
    address: comment.address,
    body: comment.body,
  };
  return {
    displayContent: formatWorkbookAnnotationComment(comment),
    prompt: `${prefix(false)}${JSON.stringify(metadata, null, 2)}`,
    requestMetadata: { artifactAnnotation: metadata },
  };
}

export function buildWorkbookAnnotationBatchRequest(
  comments: readonly WorkbookAnnotationComment[],
) {
  const first = comments[0];
  if (
    !first ||
    new Set(comments.map((comment) => comment.id)).size !== comments.length ||
    comments.some(
      (comment) =>
        comment.path !== first.path ||
        comment.sourceSha256 !== first.sourceSha256 ||
        comment.sourceFormat !== first.sourceFormat,
    )
  )
    throw new Error("Invalid workbook annotation batch");
  const requests = comments.map(buildWorkbookAnnotationRequest);
  const metadata = {
    type: "workbook" as const,
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

/** 只缩略能按同一合同逐字重建的输入，其他内容仍显示 canonical 原文。 */
export function readWorkbookAnnotationDisplayContent(
  content: string,
): string | null {
  const batch = content.startsWith(prefix(true));
  if (!batch && !content.startsWith(prefix(false))) return null;
  try {
    const value = JSON.parse(content.slice(prefix(batch).length));
    if (!value || value.type !== "workbook") return null;
    const rebuild = (record: Record<string, unknown>) => ({
      ...record,
      format: "workbook" as const,
    });
    const result = batch
      ? buildWorkbookAnnotationBatchRequest(value.comments.map(rebuild))
      : buildWorkbookAnnotationRequest(
          rebuild(value) as WorkbookAnnotationComment,
        );
    return result.prompt === content ? result.displayContent : null;
  } catch {
    return null;
  }
}
