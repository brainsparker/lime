import { useCallback, useEffect, useRef, useState } from "react";
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
  ArtifactAnnotationControls,
  ArtifactAnnotationAccessory,
} from "../annotations/ArtifactAnnotations";
import { useArtifactAnnotations } from "../annotations/useArtifactAnnotations";
import {
  loadPresentationDocument,
  type PresentationSnapshot,
} from "./presentationDocument";
import { PresentationSlideView } from "./PresentationSlideView";
import type { PresentationAnnotationTarget } from "./presentationAnnotation";
import { usePresentationController } from "./usePresentationController";
import { PresentationEditingControls } from "./PresentationEditingControls";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; snapshot: PresentationSnapshot };
const buttonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40";

export function PresentationPanel({
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
  const [input, setInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(640);
  const container = useRef<HTMLElement>(null);
  const identity = JSON.stringify([path, previewRequestKey]);
  const [loadedIdentity, setLoadedIdentity] = useState(identity);
  const visible: State =
    loadedIdentity === identity ? state : { status: "loading" };
  const [rendered, setRendered] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => setWidth(element.clientWidth || 640);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoadedIdentity(identity);
    setState({ status: "loading" });
    setRendered("");
    setInput("1");
    setMissing(false);
    if (!isAbsoluteLocalFilePath(path)) {
      setState({ status: "error" });
      return;
    }
    void loadPresentationDocument(path, controller.signal).then(
      (snapshot) => {
        if (!controller.signal.aborted) setState({ status: "ready", snapshot });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [path, identity, attempt]);
  const { controller, state: editingState } = usePresentationController(
    path,
    visible.status === "ready" ? visible.snapshot : undefined,
  );
  const snapshot = visible.status === "ready" ? editingState?.document : null;
  const index = Math.max(
    0,
    snapshot?.slideIds.indexOf(editingState?.selectedSlideId ?? "") ?? 0,
  );
  useEffect(() => setInput(String(index + 1)), [index]);
  const goTo = (next: number) => {
    if (!Number.isFinite(next)) return;
    const current = Math.max(
      0,
      Math.min((snapshot?.slideIds.length ?? 1) - 1, Math.trunc(next)),
    );
    if (snapshot) controller?.setSelectedSlideIdx(current);
    setInput(String(current + 1));
    setMissing(false);
  };
  const annotations = useArtifactAnnotations({
    path,
    format: "presentation",
    sourceSha256: snapshot?.sourceSha256,
    previewRequestKey,
    reload: () => setAttempt((value) => value + 1),
    navigateToComment: (comment) => {
      if (comment.format !== "presentation" || !snapshot) return;
      const next = snapshot.slideIds.indexOf(comment.target.slideId);
      if (next < 0) setMissing(true);
      else goTo(next);
    },
  });
  const annotate = (target: PresentationAnnotationTarget) => {
    if (!snapshot) return;
    annotations.annotate({
      format: "presentation",
      sourceFormat: "pptx",
      id: crypto.randomUUID(),
      path,
      sourceSha256: snapshot.sourceSha256,
      target,
      slideNumber: index + 1,
      slideCount: snapshot.slideIds.length,
      slideSize: { width: snapshot.model.width, height: snapshot.model.height },
    });
  };
  const frameKey = JSON.stringify([
    identity,
    attempt,
    snapshot?.sourceSha256,
    editingState?.renderRevision,
  ]);
  const renderKey = JSON.stringify([frameKey, index]);
  const ready = useCallback(() => setRendered(renderKey), [renderKey]);
  const fail = useCallback(() => setState({ status: "error" }), []);
  const scale = snapshot
    ? Math.min(1, width / snapshot.model.width) * zoom
    : zoom;
  return (
    <section
      ref={container}
      aria-label={title}
      data-testid="presentation-panel"
      data-source-sha256={snapshot?.sourceSha256}
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s" &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          void controller?.flushPublicFile();
        }
      }}
      data-status={
        visible.status === "ready" && rendered !== renderKey
          ? "loading"
          : visible.status
      }
      className="relative flex h-full min-h-[240px] min-w-0 flex-col bg-background text-foreground"
    >
      {visible.status === "loading" ? (
        <div role="status" className="m-auto p-4 text-sm text-muted-foreground">
          {t("workspace.presentationPreview.loading")}
        </div>
      ) : visible.status === "error" ? (
        <div className="m-auto flex flex-col items-center gap-3 p-4 text-sm">
          <p role="alert">{t("workspace.presentationPreview.failed")}</p>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw className="h-4 w-4" />
            {t("workspace.pdfPreview.retry")}
          </button>
        </div>
      ) : (
        snapshot && (
          <>
            {controller && editingState && (
              <PresentationEditingControls
                controller={controller}
                state={editingState}
                onDiscard={() => setAttempt((value) => value + 1)}
              />
            )}
            <div
              role="toolbar"
              aria-label={t("workspace.presentationPreview.toolbar")}
              className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-b border-border p-2"
            >
              <ArtifactAnnotationControls annotations={annotations} />
              <button
                type="button"
                className={buttonClass}
                aria-label={t("workspace.presentationPreview.previous")}
                disabled={
                  index === 0 ||
                  editingState?.projecting ||
                  editingState?.saving
                }
                onClick={() => goTo(index - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                className="h-8 w-12 rounded-md border border-border bg-background text-center text-sm"
                aria-label={t("workspace.presentationPreview.slideNumber")}
                inputMode="numeric"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    goTo(Number(input) - 1);
                  }
                }}
                onBlur={() => setInput(String(index + 1))}
              />
              <span className="text-xs text-muted-foreground">
                / {snapshot.slideIds.length}
              </span>
              <button
                type="button"
                className={buttonClass}
                aria-label={t("workspace.presentationPreview.next")}
                disabled={
                  index + 1 === snapshot.slideIds.length ||
                  editingState?.projecting ||
                  editingState?.saving
                }
                onClick={() => goTo(index + 1)}
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
              <span className="text-xs tabular-nums">
                {Math.round(scale * 100)}%
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
                className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                onClick={() => setZoom(1)}
              >
                {t("workspace.pdfPreview.fitWidth")}
              </button>
              {annotations.submission && (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                  onClick={() =>
                    annotate({ slideId: snapshot.slideIds[index] })
                  }
                >
                  {t("workspace.documentAnnotation.askForChange")}
                </button>
              )}
            </div>
            {missing && (
              <p role="alert" className="p-2 text-xs text-destructive">
                {t("workspace.presentationPreview.targetMissing")}
              </p>
            )}
            <PresentationSlideView
              key={JSON.stringify([identity, attempt])}
              snapshot={snapshot}
              index={index}
              scale={scale}
              title={t("workspace.presentationPreview.slide", {
                slide: index + 1,
              })}
              onReady={ready}
              onError={fail}
              commentMode={annotations.commentMode && !editingState?.isEditing}
              controller={controller}
              editingState={editingState}
              onAnnotate={annotate}
              onFocus={annotations.focus}
              annotations={annotations.fileDrafts.flatMap((draft, offset) =>
                draft.comment.format === "presentation" &&
                draft.comment.target.slideId === snapshot.slideIds[index] &&
                draft.comment.sourceSha256 === snapshot.sourceSha256
                  ? [
                      {
                        id: draft.comment.id,
                        label: offset + 1,
                        target: draft.comment.target,
                      },
                    ]
                  : [],
              )}
            />
            <ArtifactAnnotationAccessory annotations={annotations} />
          </>
        )
      )}
    </section>
  );
}
