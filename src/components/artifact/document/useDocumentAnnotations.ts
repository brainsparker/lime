import { useArtifactAnnotations } from "../annotations/useArtifactAnnotations";
import type { ArtifactAnnotationDraft } from "../annotations/ArtifactAnnotationDraftStore";
import type {
  DocumentAnnotationComment,
  DocumentAnnotationTarget,
} from "./documentAnnotation";

type PageDraft = ArtifactAnnotationDraft & {
  comment: Omit<DocumentAnnotationComment, "body">;
};

const isPageDraft = (draft: ArtifactAnnotationDraft): draft is PageDraft =>
  draft.comment.format === "pdf" || draft.comment.format === "docx";

/** 页面坐标只在文档适配器中使用，草稿与提交属于共享批注 owner。 */
export function useDocumentAnnotations(params: {
  path: string;
  format: DocumentAnnotationComment["format"];
  sourceSha256?: string;
  pageCount: number;
  reload: () => void;
  goToPage?: (page: number) => void;
  previewRequestKey?: string;
}) {
  const annotations = useArtifactAnnotations({
    ...params,
    navigateToComment: (comment) => {
      if (comment.format === "pdf" || comment.format === "docx")
        params.goToPage?.(comment.pageNumber);
    },
  });
  return {
    ...annotations,
    fileDrafts: annotations.fileDrafts.filter(isPageDraft),
    activeDraft:
      annotations.activeDraft && isPageDraft(annotations.activeDraft)
        ? annotations.activeDraft
        : undefined,
    annotate: (target: DocumentAnnotationTarget) => {
      if (!params.sourceSha256) return;
      annotations.annotate({
        ...target,
        format: params.format,
        path: params.path,
        sourceSha256: params.sourceSha256,
        pageCount: params.pageCount,
        id: crypto.randomUUID(),
      });
    },
  };
}
