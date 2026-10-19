import { memo, type ReactNode } from "react";
import { Code2, Eye, FileCode2, FileText, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveLocalFilePreviewUrl } from "@/lib/api/fileSystem";
import { ArtifactRenderer } from "@/components/artifact";
import { CodePreview } from "@/components/general-chat/bridge";
import { MarkdownRenderer } from "../MarkdownRenderer";
import type { CanvasWorkbenchResolvedSelection } from "../CanvasWorkbenchLayoutViewModel";
import type {
  CanvasWorkbenchPreviewMode,
  CanvasWorkbenchPreviewModeState,
} from "./CanvasWorkbenchPreviewModeViewModel";
import { resolveCanvasWorkbenchHtmlPreviewFrameState } from "./CanvasWorkbenchPreviewModeViewModel";

type CanvasWorkbenchTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

interface CanvasWorkbenchPreviewModePanelProps {
  context: CanvasWorkbenchResolvedSelection | null;
  mode: CanvasWorkbenchPreviewMode;
  modeState: CanvasWorkbenchPreviewModeState;
  translateWorkbench: CanvasWorkbenchTranslation;
  onSelectMode?: (mode: CanvasWorkbenchPreviewMode) => void;
  toolbarActions?: ReactNode;
  className?: string;
}

function resolveModeIcon(mode: CanvasWorkbenchPreviewMode): ReactNode {
  if (mode === "markdown") {
    return <FileText className="h-4 w-4" />;
  }
  if (mode === "html") {
    return <Globe2 className="h-4 w-4" />;
  }
  return <Code2 className="h-4 w-4" />;
}

function resolvePreviewTitle(
  context: CanvasWorkbenchResolvedSelection | null,
  modeState: CanvasWorkbenchPreviewModeState,
): string {
  return (
    context?.selectionPath ||
    context?.subtitle ||
    modeState.path ||
    context?.title ||
    ""
  );
}

function shouldRenderArtifactDirectly(
  artifact: NonNullable<
    Extract<
      CanvasWorkbenchResolvedSelection["target"],
      { kind: "artifact" | "synthetic-artifact" }
    >["artifact"]
  >,
): boolean {
  if (artifact.meta.previewArtifact !== true) {
    return false;
  }

  return (
    artifact.meta.renderMode === "media" ||
    artifact.meta.renderMode === "document_pages" ||
    artifact.meta.renderMode === "workbook" ||
    artifact.meta.renderMode === "presentation" ||
    artifact.meta.renderMode === "system_open" ||
    artifact.meta.renderMode === "unsupported"
  );
}

export const CanvasWorkbenchPreviewModePanel = memo(
  function CanvasWorkbenchPreviewModePanel({
    context,
    mode,
    modeState,
    translateWorkbench,
    onSelectMode,
    toolbarActions,
    className,
  }: CanvasWorkbenchPreviewModePanelProps) {
    if (!context) {
      return (
        <div
          data-testid="canvas-workbench-preview-mode-panel"
          data-preview-mode={mode}
          className={cn("h-full min-h-0 bg-background p-5", className)}
        >
          <div className="rounded-[10px] border border-dashed border-border bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
            {translateWorkbench(
              "agentChat.canvasWorkbench.coding.preview.mode.empty",
            )}
          </div>
        </div>
      );
    }

    if (context.target.kind === "loading") {
      return (
        <div
          data-testid="canvas-workbench-preview-mode-panel"
          data-preview-mode={mode}
          className={cn("h-full min-h-0 bg-background p-5", className)}
        >
          <div
            className="rounded-[10px] border border-dashed border-border bg-muted/50 px-4 py-5 text-sm text-muted-foreground"
            data-testid="canvas-workbench-preview-loading"
          >
            {translateWorkbench(
              "agentChat.canvasWorkbench.coding.preview.mode.loading",
            )}
          </div>
        </div>
      );
    }

    if (context.target.kind === "unsupported") {
      return (
        <div
          data-testid="canvas-workbench-preview-mode-panel"
          data-preview-mode={mode}
          className={cn("h-full min-h-0 bg-background p-5", className)}
        >
          <div
            className="rounded-[10px] border border-dashed border-border bg-muted/50 px-4 py-5 text-sm text-muted-foreground"
            data-testid="canvas-workbench-preview-unsupported"
          >
            {context.target.reason}
          </div>
        </div>
      );
    }

    if (!modeState.hasContent) {
      return (
        <div
          data-testid="canvas-workbench-preview-mode-panel"
          data-preview-mode={mode}
          className={cn("h-full min-h-0 bg-background p-5", className)}
        >
          <div className="rounded-[10px] border border-dashed border-border bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
            {translateWorkbench(
              "agentChat.canvasWorkbench.coding.preview.mode.empty",
            )}
          </div>
        </div>
      );
    }

    const title = resolvePreviewTitle(context, modeState);
    const artifactPreviewCandidate =
      context.target.kind === "artifact" ||
      context.target.kind === "synthetic-artifact"
        ? context.target.artifact
        : null;
    const artifactPreview =
      artifactPreviewCandidate &&
      shouldRenderArtifactDirectly(artifactPreviewCandidate)
        ? artifactPreviewCandidate
        : null;
    const htmlPreviewFrame =
      mode === "html"
        ? resolveCanvasWorkbenchHtmlPreviewFrameState(
            context,
            resolveLocalFilePreviewUrl,
          )
        : null;
    const codeLanguage =
      mode === "html" ? "html" : modeState.language || "text";
    const previewMode = modeState.isMarkdownLike
      ? "markdown"
      : modeState.isHtmlLike
        ? "html"
        : null;
    const nextMode = mode === "code" ? previewMode : "code";
    const switchLabel = translateWorkbench(
      mode === "code"
        ? "agentChat.canvasWorkbench.coding.preview.mode.viewPreview"
        : "agentChat.canvasWorkbench.coding.preview.mode.viewSource",
    );

    return (
      <section
        data-testid="canvas-workbench-preview-mode-panel"
        data-preview-mode={mode}
        className={cn("flex h-full min-h-0 flex-col bg-background", className)}
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-muted/50 text-muted-foreground">
              {resolveModeIcon(mode)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-foreground">
                {context.title}
              </div>
              {title ? (
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {title}
                </div>
              ) : null}
            </div>
          </div>
          {!artifactPreview && previewMode && nextMode && onSelectMode ? (
            <button
              type="button"
              data-testid="file-preview-mode-toggle"
              aria-label={switchLabel}
              title={switchLabel}
              onClick={() => onSelectMode(nextMode)}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {mode === "code" ? (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {switchLabel}
            </button>
          ) : null}
          {toolbarActions}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          {artifactPreview ? (
            <ArtifactRenderer
              artifact={artifactPreview}
              hideToolbar={true}
              tone="light"
            />
          ) : mode === "markdown" ? (
            <div
              data-testid="canvas-workbench-markdown-preview"
              className="h-full overflow-auto bg-background px-6 py-5"
            >
              <MarkdownRenderer
                content={context.content}
                baseFilePath={context.selectionPath}
              />
            </div>
          ) : mode === "html" ? (
            <iframe
              data-testid="canvas-workbench-html-preview"
              src={htmlPreviewFrame?.src || undefined}
              srcDoc={htmlPreviewFrame?.srcDoc}
              sandbox={htmlPreviewFrame?.sandbox}
              className="h-full min-h-[420px] w-full border-0 bg-background"
              title={
                context.title ||
                translateWorkbench(
                  "agentChat.canvasWorkbench.coding.preview.mode.htmlTitle",
                )
              }
            />
          ) : (
            <div
              data-testid="canvas-workbench-code-preview"
              className="h-full min-h-0 bg-background"
            >
              <CodePreview
                code={context.content}
                language={codeLanguage}
                isEditing={false}
              />
            </div>
          )}
        </div>
      </section>
    );
  },
);

CanvasWorkbenchPreviewModePanel.displayName = "CanvasWorkbenchPreviewModePanel";
