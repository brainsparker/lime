import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  resolveDocumentSelection,
  type DocumentAnnotationTarget,
  type DocumentAnnotationAnchor,
} from "./documentAnnotation";
import { docxPreviewStyle } from "./docxDocument";

export function DocxPageView({
  html,
  title,
  pageNumber,
  pageCount,
  pageWidth,
  scale,
  onReady,
  commentMode,
  onAnnotate,
  annotations,
  onFocusAnnotation,
}: {
  html: string;
  title: string;
  pageNumber: number;
  pageCount: number;
  pageWidth: number;
  scale: number;
  onReady: () => void;
  commentMode: boolean;
  onAnnotate?: (target: DocumentAnnotationTarget) => void;
  annotations: readonly {
    id: string;
    label: number;
    anchor: DocumentAnnotationAnchor;
  }[];
  onFocusAnnotation: (id: string) => void;
}) {
  const { t } = useTranslation("workspace");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const page =
    frameDocument?.querySelector<HTMLElement>(
      `section.docx[data-docx-page="${pageNumber}"]`,
    ) ?? null;
  const [selection, setSelection] = useState<DocumentAnnotationTarget | null>(
    null,
  );
  useLayoutEffect(() => {
    if (!frameDocument || !page) return;
    let style = frameDocument.getElementById("docx-preview-view");
    if (!style) {
      style = frameDocument.createElement("style");
      style.id = "docx-preview-view";
      frameDocument.body.append(style);
    }
    style.textContent = docxPreviewStyle(pageCount, pageNumber, scale);
    page.style.position = "relative";
    setSelection(null);
    frameDocument.getSelection()?.removeAllRanges();
    onReady();
  }, [frameDocument, page, pageCount, pageNumber, scale, onReady]);
  useEffect(() => {
    if (!page || !onAnnotate) return;
    const document = page.ownerDocument;
    const pointerUp = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element).closest("button,a"))
        return;
      const rect = page.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const pageSize = { width: pageWidth, height: rect.height / scale };
      const selected = resolveDocumentSelection({
        selection: document.getSelection(),
        textLayer: page,
        pageRect: rect,
        pageSize,
        pageNumber,
      });
      setSelection(selected);
      if (!selected && commentMode)
        onAnnotate({
          pageNumber,
          pageSize,
          anchor: {
            kind: "point",
            point: {
              x:
                Math.max(
                  0,
                  Math.min(1, (event.clientX - rect.left) / rect.width),
                ) * pageSize.width,
              y:
                Math.max(
                  0,
                  Math.min(1, (event.clientY - rect.top) / rect.height),
                ) * pageSize.height,
            },
          },
        });
    };
    page.addEventListener("pointerup", pointerUp);
    return () => page.removeEventListener("pointerup", pointerUp);
  }, [page, onAnnotate, commentMode, pageNumber, pageWidth, scale]);

  useLayoutEffect(() => {
    if (!page) return;
    const buttons: HTMLButtonElement[] = [];
    const addButton = (label: string, activate: () => void) => {
      const button = page.ownerDocument.createElement("button");
      button.type = "button";
      button.textContent = label;
      Object.assign(button.style, {
        position: "absolute",
        border: "1px solid ButtonText",
        background: "ButtonFace",
        color: "ButtonText",
        cursor: "pointer",
        fontSize: `${12 / scale}px`,
      });
      // 不使用 React portal：React 也会在 portal 容器安装 DOM onclick 占位。
      button.addEventListener("click", activate);
      page.append(button);
      buttons.push(button);
      return button;
    };
    for (const annotation of annotations) {
      const point =
        annotation.anchor.kind === "point"
          ? annotation.anchor.point
          : annotation.anchor.rect;
      const button = addButton(String(annotation.label), () =>
        onFocusAnnotation(annotation.id),
      );
      button.setAttribute(
        "aria-label",
        t("workspace.documentAnnotation.marker", { number: annotation.label }),
      );
      Object.assign(button.style, {
        zIndex: "10",
        left: `${point.x}px`,
        top: `${point.y}px`,
        transform: "translate(-50%, -50%)",
        width: `${24 / scale}px`,
        height: `${24 / scale}px`,
        borderRadius: "50%",
        padding: "0",
      });
    }
    if (selection?.anchor.kind === "region") {
      const button = addButton(
        t("workspace.documentAnnotation.askForChange"),
        () => {
          onAnnotate?.(selection);
          setSelection(null);
          page.ownerDocument.getSelection()?.removeAllRanges();
        },
      );
      button.addEventListener("mousedown", (event) => event.preventDefault());
      Object.assign(button.style, {
        zIndex: "20",
        left: `${Math.min(pageWidth * 0.65, selection.anchor.rect.x)}px`,
        top: `${selection.anchor.rect.y + selection.anchor.rect.height}px`,
        maxWidth: `${pageWidth * 0.35}px`,
        padding: `${8 / scale}px ${12 / scale}px`,
        borderRadius: `${6 / scale}px`,
      });
    }
    return () => buttons.forEach((button) => button.remove());
  }, [
    page,
    annotations,
    onFocusAnnotation,
    onAnnotate,
    selection,
    pageWidth,
    scale,
    t,
  ]);

  return (
    <iframe
      ref={frameRef}
      className="min-h-0 w-full flex-1 border-0 bg-white"
      sandbox="allow-same-origin allow-popups"
      referrerPolicy="no-referrer"
      title={title}
      srcDoc={html}
      onLoad={() => {
        const document = frameRef.current?.contentDocument;
        if (document?.querySelector("section.docx[data-docx-page]"))
          setFrameDocument(document);
      }}
    />
  );
}
