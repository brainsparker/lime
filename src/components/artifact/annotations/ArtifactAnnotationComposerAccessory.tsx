import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useArtifactCommentSubmission } from "../ArtifactCommentSubmissionContext";
import type { ArtifactAnnotationDraft } from "./ArtifactAnnotationDraftStore";
import { submitArtifactAnnotationBatch } from "./artifactAnnotationSubmission";

const empty: readonly ArtifactAnnotationDraft[] = [];
const emptySnapshot = () => empty;
const emptySubscribe = () => () => undefined;

export function ArtifactAnnotationComposerAccessory() {
  const { t } = useTranslation("workspace");
  const submission = useArtifactCommentSubmission();
  const drafts = useSyncExternalStore(
    submission?.drafts.subscribe ?? emptySubscribe,
    submission?.drafts.getSnapshot ?? emptySnapshot,
  );
  const [review, setReview] = useState<string | null>(null);
  const mounted = useRef(false);
  const scope = useRef(submission?.scopeKey);
  scope.current = submission?.scopeKey;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!submission) return null;
  const groups = new Map<string, ArtifactAnnotationDraft[]>();
  for (const draft of drafts) {
    if (
      draft.scopeKey !== submission.draftScopeKey ||
      !draft.controller.getDocument().text.trim()
    )
      continue;
    const key = JSON.stringify([draft.comment.format, draft.comment.path]);
    const group = groups.get(key) ?? [];
    group.push(draft);
    groups.set(key, group);
  }
  if (!groups.size) return null;
  return (
    <div
      data-testid="composer-annotation-accessory"
      className="mb-2 flex flex-col gap-2 text-xs"
    >
      {[...groups].map(([key, group]) => {
        const path = group[0].comment.path;
        const filename = path.split(/[\\/]/).at(-1);
        const pending = group.some((draft) => draft.pending);
        return (
          <section
            key={key}
            aria-label={`${t("workspace.documentAnnotation.batchReview")} · ${filename}`}
            className="rounded-xl border border-border bg-background p-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-expanded={review === key}
                className="min-w-0 flex-1 truncate text-left hover:underline"
                onClick={() => setReview(review === key ? null : key)}
              >
                {filename} ·{" "}
                {t("workspace.documentAnnotation.batchCount", {
                  count: group.length,
                })}
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
                onClick={() =>
                  group.forEach((draft) =>
                    submission.drafts.remove(draft.comment.id),
                  )
                }
              >
                {t("workspace.documentAnnotation.cancelBatch")}
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-40"
                onClick={() =>
                  void submitArtifactAnnotationBatch({
                    submission,
                    drafts: group,
                    isCurrent: () =>
                      mounted.current && scope.current === submission.scopeKey,
                  })
                }
              >
                {t(
                  pending
                    ? "workspace.documentAnnotation.sending"
                    : "workspace.documentAnnotation.sendBatch",
                )}
              </button>
            </div>
            {review === key && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {group.map((draft) => (
                  <li key={draft.comment.id}>
                    <button
                      type="button"
                      className="w-full rounded p-2 text-left hover:bg-muted"
                      onClick={() => submission.openComment?.(draft.comment.id)}
                    >
                      <span className="text-muted-foreground">
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
                      <span className="ml-2 whitespace-pre-wrap">
                        {draft.controller.getDocument().text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {group.some((draft) => draft.failure) && (
              <p role="alert" className="mt-1 text-destructive">
                {t(
                  group.some((draft) => draft.failure === "fileChanged")
                    ? "workspace.documentAnnotation.fileChanged"
                    : "workspace.documentAnnotation.submitFailed",
                )}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
