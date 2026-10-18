import { useDocumentAnnotations } from "./useDocumentAnnotations";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { isAbsoluteLocalFilePath } from "@/lib/api/fileSystem";
import { loadPdfDocument, isPdfPasswordError } from "./pdfDocument";
import { PdfPageView } from "./PdfPageView";
import {
  ArtifactAnnotationControls,
  ArtifactAnnotationAccessory,
} from "../annotations/ArtifactAnnotations";

interface PdfPreviewPanelProps {
  path: string;
  title: string;
  previewRequestKey?: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

type PdfState =
  | { status: "loading" }
  | {
      status: "ready";
      document: PDFDocumentProxy;
      pageRatio: number;
      sourceSha256: string;
    }
  | { status: "error"; password: boolean };

const buttonClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40";

export function PdfPreviewPanel({
  path,
  title,
  previewRequestKey,
  initialPage = 1,
  onPageChange,
}: PdfPreviewPanelProps) {
  const { t } = useTranslation("workspace");
  const [state, setState] = useState<PdfState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [scrollRequest, setScrollRequest] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(640);
  const scrollRef = useRef<HTMLDivElement>(null);
  const failDocumentRef = useRef<() => void>(() => undefined);
  const pageRef = useRef(page);
  pageRef.current = page;
  const identity = `${path}\0${previewRequestKey ?? ""}`;
  const [loadedIdentity, setLoadedIdentity] = useState(identity);
  const visibleState: PdfState =
    loadedIdentity === identity ? state : { status: "loading" };
  const pageCount =
    visibleState.status === "ready" ? visibleState.document.numPages : 0;
  const width = Math.max(160, (containerWidth - 32) * zoom);
  const pageRatio =
    visibleState.status === "ready" ? visibleState.pageRatio : 1.414;
  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => width * pageRatio + 24,
    overscan: 1,
    onChange: (instance, scrolling) => {
      // 尺寸测量也会通知；只有真实滚动才能替换显式选择的页码。
      if (!scrolling) return;
      const top = instance.scrollOffset ?? 0;
      const current = instance
        .getVirtualItems()
        .find((item) => item.end > top + 1);
      if (current) setPage(current.index + 1);
    },
  });

  const goToPage = (next: number) => {
    const value = Number.isFinite(next)
      ? Math.min(pageCount, Math.max(1, Math.trunc(next)))
      : page;
    setPage(value);
    setPageInput(String(value));
    pageRef.current = value;
    setScrollRequest(value);
  };

  // 等包含页面总高度的新 DOM 提交后定位，避免加载帧内的滚动被空容器截到 0。
  useLayoutEffect(() => {
    if (scrollRequest === null || !pageCount) return;
    virtualizer.scrollToIndex(scrollRequest - 1, { align: "start" });
    setScrollRequest(null);
  }, [scrollRequest, pageCount, virtualizer]);

  useEffect(() => {
    let current = true;
    setLoadedIdentity(identity);
    setState({ status: "loading" });
    setPage(1);
    setZoom(1);
    if (!isAbsoluteLocalFilePath(path)) {
      setState({ status: "error", password: false });
      return;
    }
    const task = loadPdfDocument(path);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      void task.destroy().catch(() => undefined);
    };
    failDocumentRef.current = () => {
      release();
      if (current) setState({ status: "error", password: false });
    };
    void task.promise
      .then(async ({ document, sourceSha256 }) => {
        const first = await document.getPage(1);
        if (!current) return;
        const viewport = first.getViewport({ scale: 1 });
        setState({
          status: "ready",
          document,
          pageRatio: viewport.height / viewport.width,
          sourceSha256,
        });
      })
      .catch((error: unknown) => {
        release();
        if (current)
          setState({ status: "error", password: isPdfPasswordError(error) });
      });
    return () => {
      current = false;
      release();
    };
  }, [attempt, identity, path]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setContainerWidth(element.clientWidth),
    );
    observer.observe(element);
    setContainerWidth(element.clientWidth || 640);
    return () => observer.disconnect();
  }, [visibleState.status]);

  useEffect(() => {
    setPageInput(String(page));
    if (pageCount) onPageChange?.(page);
  }, [onPageChange, page, pageCount]);

  useEffect(() => {
    if (!pageCount) return;
    virtualizer.scrollToIndex(
      Math.min(pageCount, Math.max(1, initialPage)) - 1,
      { align: "start" },
    );
  }, [pageCount, initialPage, identity, virtualizer]);

  useEffect(() => {
    virtualizer.measure();
    if (pageCount)
      virtualizer.scrollToIndex(pageRef.current - 1, { align: "start" });
  }, [width, pageCount, virtualizer]);

  const annotations = useDocumentAnnotations({
    path,
    previewRequestKey,
    format: "pdf",
    sourceSha256:
      visibleState.status === "ready" ? visibleState.sourceSha256 : undefined,
    pageCount,
    reload: () => setAttempt((value) => value + 1),
    goToPage,
  });

  const onRenderError = useCallback(() => failDocumentRef.current(), []);

  const adjustZoom = (delta: number) => {
    setZoom((value) =>
      Math.min(3, Math.max(0.25, Math.round((value + delta) * 100) / 100)),
    );
  };

  return (
    <section
      className="relative flex h-full min-h-[240px] min-w-0 flex-col bg-background text-foreground"
      data-testid="pdf-preview-panel"
      data-status={visibleState.status}
      aria-label={title}
    >
      {visibleState.status === "loading" ? (
        <div
          role="status"
          className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          {t("workspace.pdfPreview.loading")}
        </div>
      ) : visibleState.status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-sm">
          <p role="alert">
            {t(
              visibleState.password
                ? "workspace.pdfPreview.passwordRequired"
                : "workspace.pdfPreview.failed",
            )}
          </p>
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
            aria-label={t("workspace.pdfPreview.toolbar")}
            className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-b border-border p-2"
          >
            <ArtifactAnnotationControls annotations={annotations} />
            <button
              type="button"
              className={buttonClass}
              aria-label={t("workspace.pdfPreview.previousPage")}
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              className="h-8 w-12 rounded border border-border bg-background px-1 text-center text-sm"
              aria-label={t("workspace.pdfPreview.pageNumber")}
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => goToPage(Number(pageInput))}
              onKeyDown={(event) => {
                if (event.key === "Enter") goToPage(Number(pageInput));
              }}
            />
            <span className="text-sm text-muted-foreground" aria-live="polite">
              / {pageCount}
            </span>
            <button
              type="button"
              className={buttonClass}
              aria-label={t("workspace.pdfPreview.nextPage")}
              disabled={page >= pageCount}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="mx-1 h-4 border-l border-border" />
            <button
              type="button"
              className={buttonClass}
              aria-label={t("workspace.pdfPreview.zoomOut")}
              disabled={zoom <= 0.25}
              onClick={() => adjustZoom(-0.25)}
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
              onClick={() => adjustZoom(0.25)}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="h-8 rounded-md px-2 text-xs hover:bg-muted"
              onClick={() => {
                setZoom(1);
              }}
            >
              {t("workspace.pdfPreview.fitWidth")}
            </button>
          </div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-auto bg-muted/50"
            data-testid="pdf-preview-pages"
            tabIndex={0}
          >
            <div
              className="relative mx-auto"
              style={{
                height: virtualizer.getTotalSize(),
                width: width + 32,
                minWidth: "100%",
              }}
            >
              {virtualizer.getVirtualItems().map((item) => (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 flex w-full justify-center pb-6"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <PdfPageView
                    document={visibleState.document}
                    pageNumber={item.index + 1}
                    width={width}
                    onRenderError={onRenderError}
                    commentMode={annotations.commentMode}
                    onAnnotate={
                      annotations.submission ? annotations.annotate : undefined
                    }
                    annotations={annotations.fileDrafts
                      .filter(
                        (draft) =>
                          draft.comment.sourceSha256 ===
                            visibleState.sourceSha256 &&
                          draft.comment.pageNumber === item.index + 1,
                      )
                      .map((draft) => ({
                        id: draft.comment.id,
                        anchor: draft.comment.anchor,
                        label: annotations.fileDrafts.indexOf(draft) + 1,
                      }))}
                    onFocusAnnotation={annotations.focus}
                  />
                </div>
              ))}
            </div>
          </div>
          <ArtifactAnnotationAccessory annotations={annotations} />
        </>
      )}
    </section>
  );
}
