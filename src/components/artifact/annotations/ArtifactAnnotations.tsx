import { useTranslation } from "react-i18next";
import { MessageSquarePlus } from "lucide-react";
import { ArtifactAnnotationCommentEditor } from "./ArtifactAnnotationCommentEditor";
import type { useArtifactAnnotations } from "./useArtifactAnnotations";

type Annotations = Omit<ReturnType<typeof useArtifactAnnotations>, "annotate">;

export function ArtifactAnnotationControls({
  annotations,
  onAdd,
}: {
  annotations: Annotations;
  onAdd?: () => void;
}) {
  const { t } = useTranslation("workspace");
  if (!annotations.submission) return null;
  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        aria-label={t("workspace.documentAnnotation.add")}
        aria-pressed={annotations.commentMode}
        onClick={onAdd ?? annotations.toggleMode}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </button>
      {annotations.fileDrafts.length > 0 && (
        <button
          type="button"
          className="h-8 rounded-md px-2 text-xs hover:bg-muted"
          aria-label={t("workspace.documentAnnotation.drafts", {
            count: annotations.fileDrafts.length,
          })}
          aria-expanded={annotations.showDrafts}
          onClick={annotations.toggleDrafts}
        >
          {t("workspace.documentAnnotation.drafts", {
            count: annotations.fileDrafts.length,
          })}
        </button>
      )}
    </>
  );
}

export function ArtifactAnnotationAccessory({
  annotations,
}: {
  annotations: Annotations;
}) {
  const { t } = useTranslation("workspace");
  const { submission, fileDrafts, activeDraft } = annotations;
  if (!submission) return null;
  return (
    <>
      {!activeDraft &&
        !annotations.showDrafts &&
        annotations.batchDrafts.length > 0 && (
          <div
            role="toolbar"
            aria-label={t("workspace.documentAnnotation.batchReview")}
            data-testid="document-annotation-batch-controls"
            className="absolute bottom-4 left-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-2 text-xs shadow-lg"
          >
            <button
              type="button"
              className="rounded px-2 py-1 hover:bg-muted"
              onClick={annotations.toggleDrafts}
            >
              {t("workspace.documentAnnotation.batchCount", {
                count: annotations.batchDrafts.length,
              })}
            </button>
            <button
              type="button"
              disabled={annotations.batchPending}
              className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
              onClick={annotations.cancelBatch}
            >
              {t("workspace.documentAnnotation.cancelBatch")}
            </button>
            <button
              type="button"
              disabled={annotations.batchPending}
              className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-40"
              onClick={() => void annotations.sendBatch()}
            >
              {t(
                annotations.batchPending
                  ? "workspace.documentAnnotation.sending"
                  : "workspace.documentAnnotation.sendBatch",
              )}
            </button>
            {fileDrafts.some((draft) => draft.failure) && (
              <p role="alert" className="w-full px-2 text-destructive">
                {t(
                  fileDrafts.some((draft) => draft.failure === "fileChanged")
                    ? "workspace.documentAnnotation.fileChanged"
                    : "workspace.documentAnnotation.submitFailed",
                )}
              </p>
            )}
          </div>
        )}
      {annotations.showDrafts && fileDrafts.length > 0 && (
        <aside
          className="absolute bottom-4 right-4 z-20 flex max-h-[70%] w-80 max-w-[calc(100%-2rem)] flex-col gap-2 overflow-auto rounded-xl border border-border bg-background p-3 shadow-lg"
          aria-label={t("workspace.documentAnnotation.drafts", {
            count: fileDrafts.length,
          })}
        >
          {fileDrafts.map((draft) => (
            <div key={draft.comment.id} className="flex items-center gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-md p-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  annotations.focus(draft.comment.id);
                }}
              >
                <span className="block text-xs text-muted-foreground">
                  {draft.comment.format === "presentation"
                    ? t("workspace.presentationPreview.slide", {
                        slide: draft.comment.slideNumber,
                      })
                    : draft.comment.format === "workbook"
                      ? `${draft.comment.sheetName} · ${draft.comment.address}`
                      : t("workspace.documentAnnotation.page", {
                          page: draft.comment.pageNumber,
                        })}
                </span>
                <span className="block truncate">
                  {draft.controller.getDocument().text ||
                    t("workspace.documentAnnotation.placeholder")}
                </span>
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-md hover:bg-muted disabled:opacity-40"
                disabled={draft.pending}
                aria-label={t("workspace.documentAnnotation.remove")}
                onClick={() => submission.drafts.remove(draft.comment.id)}
              >
                ×
              </button>
            </div>
          ))}
        </aside>
      )}
      {activeDraft && (
        <ArtifactAnnotationCommentEditor
          key={JSON.stringify([submission.scopeKey, activeDraft.comment.id])}
          draft={activeDraft}
          store={submission.drafts}
          onClose={annotations.close}
          onRelocate={annotations.relocate}
          onNavigate={
            fileDrafts.length > 1
              ? (offset) => {
                  const index = fileDrafts.findIndex(
                    (draft) => draft.comment.id === activeDraft.comment.id,
                  );
                  const next =
                    fileDrafts[
                      (index + offset + fileDrafts.length) % fileDrafts.length
                    ];
                  annotations.focus(next.comment.id);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
