import {
  buildDocumentAnnotationRequest,
  buildDocumentAnnotationBatchRequest,
  type DocumentAnnotationComment,
} from "../document/documentAnnotation";
import {
  buildWorkbookAnnotationRequest,
  buildWorkbookAnnotationBatchRequest,
  type WorkbookAnnotationComment,
} from "../workbook/workbookAnnotation";
import {
  buildPresentationAnnotationRequest,
  buildPresentationAnnotationBatchRequest,
  type PresentationAnnotationComment,
} from "../presentation/presentationAnnotation";

export type ArtifactAnnotationComment =
  | DocumentAnnotationComment
  | WorkbookAnnotationComment
  | PresentationAnnotationComment;
export type ArtifactAnnotationDraftComment =
  | Omit<DocumentAnnotationComment, "body">
  | Omit<WorkbookAnnotationComment, "body">
  | Omit<PresentationAnnotationComment, "body">;

export function buildArtifactAnnotationRequest(
  comment: ArtifactAnnotationComment,
) {
  if (comment.format === "presentation")
    return buildPresentationAnnotationRequest(comment);
  return comment.format === "workbook"
    ? buildWorkbookAnnotationRequest(comment)
    : buildDocumentAnnotationRequest(comment);
}

export function buildArtifactAnnotationBatchRequest(
  comments: readonly ArtifactAnnotationComment[],
) {
  if (
    comments.length &&
    comments.every(
      (comment): comment is PresentationAnnotationComment =>
        comment.format === "presentation",
    )
  )
    return buildPresentationAnnotationBatchRequest(comments);
  if (
    comments.length &&
    comments.every(
      (comment): comment is WorkbookAnnotationComment =>
        comment.format === "workbook",
    )
  )
    return buildWorkbookAnnotationBatchRequest(comments);
  if (
    comments.length &&
    comments.every(
      (comment): comment is DocumentAnnotationComment =>
        comment.format === "pdf" || comment.format === "docx",
    )
  )
    return buildDocumentAnnotationBatchRequest(comments);
  throw new Error("Invalid artifact annotation batch");
}
