import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useArtifactCommentSubmission } from "../ArtifactCommentSubmissionContext";
import type {
  ArtifactAnnotationDraft,
  ArtifactAnnotationDraftStore,
} from "./ArtifactAnnotationDraftStore";

export function ArtifactAnnotationCommentEditor({
  draft: initialDraft,
  store,
  onClose,
  onRelocate,
  onNavigate,
}: {
  draft: ArtifactAnnotationDraft;
  store: ArtifactAnnotationDraftStore;
  onClose: () => void;
  onRelocate?: () => void;
  onNavigate?: (offset: number) => void;
}) {
  const { t } = useTranslation("workspace");
  const submission = useArtifactCommentSubmission();
  const drafts = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const draft = drafts.find(
    (entry) => entry.comment.id === initialDraft.comment.id,
  );
  const { controller } = initialDraft;
  const document = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const active = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scope = useRef(submission?.scopeKey);
  useEffect(() => {
    active.current = true;
    textarea.current?.focus({ preventScroll: true });
    return () => {
      active.current = false;
    };
  }, []);
  const send = async () => {
    if (!submission || !draft || !store.begin(draft.comment.id)) return;
    const comment = {
      ...draft.comment,
      body: controller.getSnapshot().document.text,
    };
    try {
      const result = await submission.submit({
        comment,
        controller,
        scopeKey: scope.current ?? "",
        isCurrent: () => active.current,
      });
      const removed = store.finish(draft.comment.id, result);
      if (removed && active.current) onClose();
    } catch {
      store.finish(draft.comment.id, "rejected");
    }
  };
  if (!draft) return null;
  const { comment: target, pending, failure } = draft;
  return (
    <form
      className="absolute bottom-4 right-4 z-20 flex max-h-[90%] w-80 max-w-[calc(100%-2rem)] flex-col gap-2 overflow-auto rounded-xl border border-border bg-background p-3 shadow-lg"
      data-testid="document-annotation-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span>
          {target.format === "presentation"
            ? t("workspace.presentationPreview.slide", {
                slide: target.slideNumber,
              })
            : target.format === "workbook"
              ? `${target.sheetName} · ${target.address}`
              : t("workspace.documentAnnotation.page", {
                  page: target.pageNumber,
                })}
        </span>
        {onNavigate && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              disabled={pending}
              aria-label={t("workspace.documentAnnotation.previous")}
              onClick={() => onNavigate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              disabled={pending}
              aria-label={t("workspace.documentAnnotation.next")}
              onClick={() => onNavigate(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          className="rounded p-1 hover:bg-muted"
          disabled={pending}
          onClick={onClose}
          aria-label={t("workspace.documentAnnotation.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {"anchor" in target && target.anchor.kind === "region" && (
        <blockquote className="max-h-20 overflow-auto border-l-2 border-border pl-2 text-xs text-muted-foreground">
          {target.anchor.selectedText}
        </blockquote>
      )}
      {target.screenshot && (
        <img
          className="max-h-24 w-full object-contain"
          alt={t("workspace.documentAnnotation.screenshot")}
          src={`data:image/png;base64,${target.screenshot.data}`}
        />
      )}
      <textarea
        ref={textarea}
        className="min-h-20 resize-y rounded-md border border-border bg-background p-2 text-sm"
        aria-label={t("workspace.documentAnnotation.comment")}
        placeholder={t("workspace.documentAnnotation.placeholder")}
        value={document.document.text}
        onChange={(event) => controller.setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void send();
          } else if (event.key === "Escape" && !pending) {
            event.preventDefault();
            onClose();
          }
        }}
      />
      {failure && (
        <p role="alert" className="text-xs text-destructive">
          {t(`workspace.documentAnnotation.${failure}`)}
        </p>
      )}
      {failure === "fileChanged" && onRelocate && (
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          disabled={pending}
          onClick={onRelocate}
        >
          {t("workspace.documentAnnotation.relocate")}
        </button>
      )}
      <button
        type="submit"
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
        disabled={pending || !submission || !document.document.text.trim()}
      >
        {t(
          pending
            ? "workspace.documentAnnotation.sending"
            : "workspace.documentAnnotation.send",
        )}
      </button>
    </form>
  );
}
