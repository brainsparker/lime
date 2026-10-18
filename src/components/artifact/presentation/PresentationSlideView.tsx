import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  presentationFrameHtml,
  renderPresentationSlide,
  sanitizePresentationSlide,
  type PresentationSnapshot,
} from "./presentationDocument";
import type { PresentationAnnotationTarget } from "./presentationAnnotation";
import type {
  PresentationController,
  PresentationControllerState,
} from "./PresentationController";
import { usePresentationEditingOverlay } from "./usePresentationEditingOverlay";

export function PresentationSlideView({
  snapshot,
  index,
  scale,
  title,
  commentMode,
  annotations,
  onAnnotate,
  onFocus,
  onReady,
  onError,
  controller,
  editingState,
}: {
  snapshot: PresentationSnapshot;
  index: number;
  scale: number;
  title: string;
  commentMode: boolean;
  annotations: readonly {
    id: string;
    label: number;
    target: PresentationAnnotationTarget;
  }[];
  onAnnotate: (target: PresentationAnnotationTarget) => void;
  onFocus: (id: string) => void;
  onReady: () => void;
  onError: () => void;
  controller?: PresentationController;
  editingState?: PresentationControllerState;
}) {
  const { t } = useTranslation("workspace");
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameState, setFrameState] = useState<{ document: Document } | null>(
    null,
  );
  const document = frameState?.document ?? null;
  const [slide, setSlide] = useState<HTMLElement | null>(null);
  usePresentationEditingOverlay(slide, scale, controller, editingState);
  useEffect(() => {
    if (!document) return;
    const mount = document.getElementById("slide");
    if (!mount) return;
    let current = true;
    let handle: ReturnType<typeof renderPresentationSlide> | undefined;
    setSlide(null);
    try {
      handle = renderPresentationSlide(snapshot, index);
      const rendered = handle;
      void rendered.ready
        .then(() => {
          if (!current) return;
          sanitizePresentationSlide(rendered.element);
          rendered.element.dataset.slideId = snapshot.slideIds[index];
          mount.replaceChildren(rendered.element);
          setSlide(rendered.element);
          onReady();
        })
        .catch(() => {
          if (current) onError();
        });
    } catch {
      onError();
    }
    return () => {
      current = false;
      handle?.dispose();
      mount.replaceChildren();
    };
  }, [document, frameState, snapshot, index, onReady, onError]);
  useLayoutEffect(() => {
    const mount = document?.getElementById("slide");
    if (!mount || !document) return;
    Object.assign(mount.style, {
      width: `${snapshot.model.width}px`,
      height: `${snapshot.model.height}px`,
      transform: `scale(${scale})`,
    });
    document.body.style.width = `${snapshot.model.width * scale}px`;
    document.body.style.height = `${snapshot.model.height * scale}px`;
  }, [document, frameState, snapshot, scale]);
  useEffect(() => {
    if (!slide || !commentMode) return;
    const annotate = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element).closest("button,a"))
        return;
      const rect = slide.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      onAnnotate({
        slideId: snapshot.slideIds[index],
        position: {
          x:
            Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) *
            snapshot.model.width,
          y:
            Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) *
            snapshot.model.height,
        },
      });
    };
    slide.addEventListener("pointerup", annotate);
    return () => slide.removeEventListener("pointerup", annotate);
  }, [slide, snapshot, index, commentMode, onAnnotate]);
  useEffect(() => {
    if (!slide) return;
    const markers = annotations.map((annotation) => {
      const button = slide.ownerDocument.createElement("button");
      button.type = "button";
      button.textContent = String(annotation.label);
      button.setAttribute(
        "aria-label",
        t("workspace.documentAnnotation.marker", { number: annotation.label }),
      );
      const position = annotation.target.position ?? { x: 20, y: 20 };
      Object.assign(button.style, {
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: "100",
        width: `${24 / scale}px`,
        height: `${24 / scale}px`,
        transform: "translate(-50%,-50%)",
        borderRadius: "50%",
        border: "1px solid ButtonText",
        background: "ButtonFace",
        color: "ButtonText",
      });
      button.addEventListener("click", () => onFocus(annotation.id));
      slide.append(button);
      return button;
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [slide, annotations, onFocus, scale, t]);
  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={presentationFrameHtml}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      className="min-h-0 w-full flex-1 border-0 bg-white"
      data-testid="presentation-slide-frame"
      onLoad={() => {
        const document = frame.current?.contentDocument;
        if (document) setFrameState({ document });
      }}
    />
  );
}
