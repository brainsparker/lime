import { useDocumentAnnotations } from "./useDocumentAnnotations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { isAbsoluteLocalFilePath } from "@/lib/api/fileSystem";
import {
  buildDocxPreviewHtml,
  loadDocxDocument,
  type DocxDocumentSnapshot,
} from "./docxDocument";
import { DocxPageView } from "./DocxPageView";
import {
  ArtifactAnnotationControls,
  ArtifactAnnotationAccessory,
} from "../annotations/ArtifactAnnotations";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; snapshot: DocxDocumentSnapshot };
const buttonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40";

export function DocxPreviewPanel({
  path,
  title,
  previewRequestKey,
}: {
  path: string;
  title: string;
  previewRequestKey?: string;
}) {
  const { t } = useTranslation("workspace");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [changes, setChanges] = useState(false);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(640);
  const [loadedPresentation, setLoadedPresentation] = useState<string | null>(
    null,
  );
  const containerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setWidth(element.clientWidth || 640),
    );
    observer.observe(element);
    setWidth(element.clientWidth || 640);
    return () => observer.disconnect();
  }, []);
  const identity = JSON.stringify([path, previewRequestKey, changes]);
  const [loadedIdentity, setLoadedIdentity] = useState(identity);
  const visible: State =
    loadedIdentity === identity ? state : { status: "loading" };
  useEffect(() => {
    const controller = new AbortController();
    setLoadedIdentity(identity);
    setState({ status: "loading" });
    setLoadedPresentation(null);
    setPage(1);
    setPageInput("1");
    if (!isAbsoluteLocalFilePath(path)) {
      setState({ status: "error" });
      return;
    }
    void loadDocxDocument(path, changes, controller.signal).then(
      (snapshot) => {
        if (!controller.signal.aborted) setState({ status: "ready", snapshot });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [attempt, changes, identity, path]);
  const snapshot = visible.status === "ready" ? visible.snapshot : null;
  const scale = snapshot
    ? Math.min(1, width / snapshot.pageWidths[page - 1]) * zoom
    : zoom;
  const html = useMemo(
    () => (snapshot ? buildDocxPreviewHtml(snapshot, 1, 1) : ""),
    [snapshot],
  );
  const frameKey = JSON.stringify([identity, attempt, snapshot?.sourceSha256]);
  const presentationKey = JSON.stringify([frameKey, page, scale]);
  const markReady = useCallback(
    () => setLoadedPresentation(presentationKey),
    [presentationKey],
  );
  const goTo = (next: number) => {
    const current = Number.isFinite(next)
      ? Math.max(1, Math.min(snapshot?.pageCount ?? 1, Math.trunc(next)))
      : page;
    setPage(current);
    setPageInput(String(current));
  };
  const annotations = useDocumentAnnotations({
    path,
    previewRequestKey,
    format: "docx",
    sourceSha256: snapshot?.sourceSha256,
    pageCount: snapshot?.pageCount ?? 0,
    reload: () => setAttempt((value) => value + 1),
    goToPage: goTo,
  });

  return (
    <section
      ref={containerRef}
      className="relative flex h-full min-h-[240px] min-w-0 flex-col bg-background text-foreground"
      aria-label={title}
      data-testid="docx-preview-panel"
      data-status={
        visible.status === "ready" && loadedPresentation !== presentationKey
          ? "loading"
          : visible.status
      }
    >
      {visible.status === "loading" ? (
        <div
          role="status"
          className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          {t("workspace.docxPreview.loading")}
        </div>
      ) : visible.status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-sm">
          <p role="alert">{t("workspace.docxPreview.failed")}</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw className="h-4 w-4" />
            {t("workspace.pdfPreview.retry")}
          </button>
        </div>
      ) : (
        <>
          <div
            role="toolbar"
            aria-label={t("workspace.docxPreview.toolbar")}
            className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-b border-border p-2"
          >
            <ArtifactAnnotationControls annotations={annotations} />
            <button
              type="button"
              className={buttonClass}
              aria-label={t("workspace.pdfPreview.previousPage")}
              disabled={page <= 1}
              onClick={() => goTo(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              className="h-8 w-12 rounded-md border border-border bg-background text-center text-xs"
              aria-label={t("workspace.pdfPreview.pageNumber")}
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => goTo(Number(pageInput))}
              onKeyDown={(event) => {
                if (event.key === "Enter") goTo(Number(pageInput));
              }}
            />
            <span className="text-xs text-muted-foreground">
              / {snapshot?.pageCount}
            </span>
            <button
              type="button"
              className={buttonClass}
              aria-label={t("workspace.pdfPreview.nextPage")}
              disabled={page >= (snapshot?.pageCount ?? 1)}
              onClick={() => goTo(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-label={t("workspace.pdfPreview.zoomOut")}
              disabled={zoom <= 0.25}
              onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-xs">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className={buttonClass}
              aria-label={t("workspace.pdfPreview.zoomIn")}
              disabled={zoom >= 3}
              onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="h-8 rounded-md px-2 text-xs hover:bg-muted"
              onClick={() => setZoom(1)}
            >
              {t("workspace.pdfPreview.fitWidth")}
            </button>
            {snapshot?.hasRedlines && (
              <button
                type="button"
                className="h-8 rounded-md px-2 text-xs hover:bg-muted"
                aria-pressed={changes}
                onClick={() => setChanges((value) => !value)}
              >
                {t("workspace.docxPreview.changes")}
              </button>
            )}
          </div>
          <DocxPageView
            key={frameKey}
            title={title}
            html={html}
            pageNumber={page}
            pageCount={snapshot?.pageCount ?? 0}
            pageWidth={snapshot?.pageWidths[page - 1] ?? 640}
            scale={scale}
            onReady={markReady}
            commentMode={annotations.commentMode}
            onAnnotate={
              annotations.submission ? annotations.annotate : undefined
            }
            annotations={annotations.fileDrafts
              .filter(
                (draft) =>
                  draft.comment.sourceSha256 === snapshot?.sourceSha256 &&
                  draft.comment.pageNumber === page,
              )
              .map((draft) => ({
                id: draft.comment.id,
                label: annotations.fileDrafts.indexOf(draft) + 1,
                anchor: draft.comment.anchor,
              }))}
            onFocusAnnotation={annotations.focus}
          />
          <ArtifactAnnotationAccessory annotations={annotations} />
        </>
      )}
    </section>
  );
}
