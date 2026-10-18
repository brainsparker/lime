import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import "./pdfPreview.css";
import { capturePdfAnnotationScreenshot } from "./pdfAnnotationScreenshot";
import {
  resolveDocumentSelection,
  type DocumentAnnotationTarget,
  type DocumentAnnotationAnchor,
} from "./documentAnnotation";

export function PdfPageView({
  document,
  pageNumber,
  width,
  onRenderError,
  commentMode = false,
  onAnnotate,
  annotations = [],
  onFocusAnnotation,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  onRenderError: () => void;
  commentMode?: boolean;
  onAnnotate?: (target: DocumentAnnotationTarget) => void;
  annotations?: readonly {
    id: string;
    label: number;
    anchor: DocumentAnnotationAnchor;
  }[];
  onFocusAnnotation?: (id: string) => void;
}) {
  const { t } = useTranslation("workspace");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(width * 1.414);
  const [selectionTarget, setSelectionTarget] =
    useState<DocumentAnnotationTarget | null>(null);
  const pageSizeRef = useRef({ width: 0, height: 0 });
  const annotate = (target: DocumentAnnotationTarget) => {
    const screenshot = canvasRef.current
      ? capturePdfAnnotationScreenshot(canvasRef.current, target)
      : undefined;
    onAnnotate?.({ ...target, ...(screenshot ? { screenshot } : {}) });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const text = textRef.current;
    let current = true;
    let renderTask: RenderTask | undefined;
    let textLayer: TextLayer | undefined;
    setReady(false);
    setSelectionTarget(null);
    const render = async () => {
      const page = await document.getPage(pageNumber);
      if (!current) return;
      if (!canvas || !text) return;
      const base = page.getViewport({ scale: 1 });
      pageSizeRef.current = { width: base.width, height: base.height };
      const viewport = page.getViewport({ scale: width / base.width });
      text.style.setProperty("--total-scale-factor", String(viewport.scale));
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setHeight(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF canvas unavailable");
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: text,
        viewport,
      });
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (current) setReady(true);
    };
    void render().catch(() => {
      if (current) onRenderError();
    });
    return () => {
      current = false;
      renderTask?.cancel();
      textLayer?.cancel();
      text?.replaceChildren();
    };
  }, [document, onRenderError, pageNumber, width]);

  return (
    <div
      className="lime-pdf-page relative shrink-0 bg-white shadow-sm"
      data-pdf-page={pageNumber}
      data-rendered={ready}
      style={{ width, height }}
      role="group"
      aria-label={t("workspace.pdfPreview.pageLabel", { page: pageNumber })}
      onPointerUp={(event) => {
        if (
          !ready ||
          !onAnnotate ||
          event.button !== 0 ||
          !textRef.current ||
          (event.target as Element).closest("button")
        )
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        const target = resolveDocumentSelection({
          selection: window.getSelection(),
          textLayer: textRef.current,
          pageRect: rect,
          pageSize: pageSizeRef.current,
          pageNumber,
        });
        if (target) setSelectionTarget(target);
        else if (commentMode && rect.width && rect.height)
          annotate({
            pageNumber,
            pageSize: pageSizeRef.current,
            anchor: {
              kind: "point",
              point: {
                x:
                  Math.max(
                    0,
                    Math.min(1, (event.clientX - rect.left) / rect.width),
                  ) * pageSizeRef.current.width,
                y:
                  Math.max(
                    0,
                    Math.min(1, (event.clientY - rect.top) / rect.height),
                  ) * pageSizeRef.current.height,
              },
            },
          });
      }}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <div ref={textRef} className="textLayer" />
      {ready &&
        annotations.map((annotation) => {
          const point =
            annotation.anchor.kind === "point"
              ? annotation.anchor.point
              : annotation.anchor.rect;
          return (
            <button
              key={annotation.id}
              type="button"
              className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-background text-xs text-foreground shadow"
              aria-label={t("workspace.documentAnnotation.marker", {
                number: annotation.label,
              })}
              style={{
                left: `${(point.x / pageSizeRef.current.width) * 100}%`,
                top: `${(point.y / pageSizeRef.current.height) * 100}%`,
              }}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={() => onFocusAnnotation?.(annotation.id)}
            >
              {annotation.label}
            </button>
          );
        })}
      {ready && selectionTarget?.anchor.kind === "region" && (
        <button
          type="button"
          className="absolute z-20 max-w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground shadow-lg"
          style={{
            left: `${Math.min(65, (selectionTarget.anchor.rect.x / selectionTarget.pageSize.width) * 100)}%`,
            top: `${Math.min(90, ((selectionTarget.anchor.rect.y + selectionTarget.anchor.rect.height) / selectionTarget.pageSize.height) * 100)}%`,
          }}
          onMouseDown={(event) => event.preventDefault()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={() => {
            annotate(selectionTarget);
            setSelectionTarget(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          {t("workspace.documentAnnotation.askForChange")}
        </button>
      )}
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm text-slate-500"
          role="status"
        >
          {t("workspace.pdfPreview.loading")}
        </div>
      )}
    </div>
  );
}
