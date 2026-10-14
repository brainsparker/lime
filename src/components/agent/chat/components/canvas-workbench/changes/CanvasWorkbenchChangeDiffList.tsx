import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  collapseCanvasWorkbenchDiffContext,
  type CanvasWorkbenchDisplayedDiffLine,
} from "../../../utils/canvasWorkbenchDiff";
import { CanvasWorkbenchDiffState } from "./CanvasWorkbenchDiffState";
import { DiffStats } from "./CanvasWorkbenchChangeStats";
import {
  buildCanvasWorkbenchChangeDiffLines,
  countCanvasWorkbenchChangeItemStats,
  resolveChangeDisplayMeta,
  type CanvasWorkbenchChangeItem,
} from "./CanvasWorkbenchChangesPanelViewModel";
import { CanvasWorkbenchChangeStatusMark } from "./CanvasWorkbenchChangeStatusMark";
import type { CanvasWorkbenchTranslation } from "./CanvasWorkbenchChangesTypes";

interface CanvasWorkbenchChangeDiffListProps {
  items: CanvasWorkbenchChangeItem[];
  selectedChangeItem?: CanvasWorkbenchChangeItem;
  selectionRequestKey?: number;
  fullFileContentById?: Record<string, string>;
  loadFullFile?: boolean;
  collapseDiffContext: boolean;
  textDiffEnabled: boolean;
  panelClassName: string;
  diffVariant: "inline" | "split";
  showWhitespace: boolean;
  wordWrapEnabled: boolean;
  translateWorkbench: CanvasWorkbenchTranslation;
  onSelectChangeItem?: (item: CanvasWorkbenchChangeItem) => void;
}

function buildVisibleDiffLines(
  item: CanvasWorkbenchChangeItem,
  fullFileContentById: Record<string, string> | undefined,
  loadFullFile: boolean,
  collapseDiffContext: boolean,
  textDiffEnabled: boolean,
): CanvasWorkbenchDisplayedDiffLine[] {
  const loadedContent = loadFullFile
    ? fullFileContentById?.[item.id]
    : undefined;
  const diffLines = buildCanvasWorkbenchChangeDiffLines(item, loadedContent);
  if (collapseDiffContext) {
    return collapseCanvasWorkbenchDiffContext(diffLines);
  }
  if (textDiffEnabled) {
    return diffLines;
  }
  return diffLines.filter((line) => line.type !== "context");
}

export function CanvasWorkbenchChangeDiffList({
  items,
  selectedChangeItem,
  selectionRequestKey = 0,
  fullFileContentById,
  loadFullFile = false,
  collapseDiffContext,
  textDiffEnabled,
  panelClassName,
  diffVariant,
  showWhitespace,
  wordWrapEnabled,
  translateWorkbench,
  onSelectChangeItem,
}: CanvasWorkbenchChangeDiffListProps) {
  const fileElements = useRef(new Map<string, HTMLElement>());
  const selectedChangeId = selectedChangeItem?.id;
  useLayoutEffect(() => {
    if (!selectionRequestKey || !selectedChangeId) return;
    fileElements.current
      .get(selectedChangeId)
      ?.scrollIntoView?.({ block: "start", inline: "nearest" });
  }, [selectedChangeId, selectionRequestKey]);
  return (
    <div
      className="h-full min-h-0 overflow-auto bg-[color:var(--lime-surface)]"
      data-testid="canvas-workbench-change-diff-list"
    >
      <div className={diffVariant === "split" ? "min-w-[760px]" : "min-w-0"}>
        {items.map((item) => {
          const diffLines = buildCanvasWorkbenchChangeDiffLines(
            item,
            loadFullFile ? fullFileContentById?.[item.id] : undefined,
          );
          const visibleDiffLines = buildVisibleDiffLines(
            item,
            fullFileContentById,
            loadFullFile,
            collapseDiffContext,
            textDiffEnabled,
          );
          const stats = countCanvasWorkbenchChangeItemStats(item);
          const meta = resolveChangeDisplayMeta(item);
          const active = item.id === selectedChangeItem?.id;

          return (
            <section
              key={item.id}
              data-testid="canvas-workbench-change-diff-file"
              data-change-id={item.id}
              data-review-path={item.path}
              data-selected={active}
              ref={(element) => {
                if (element) fileElements.current.set(item.id, element);
                else fileElements.current.delete(item.id);
              }}
              className={cn(
                "border-b border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)]",
                active && "shadow-[inset_3px_0_0_var(--lime-brand)]",
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-2 border-b border-[color:var(--lime-surface-border)] px-3 text-left transition-colors hover:bg-[color:var(--lime-surface-subtle)]",
                  active
                    ? "bg-[color:var(--lime-surface-subtle)]"
                    : "bg-[color:var(--lime-surface)]",
                )}
                onClick={() => onSelectChangeItem?.(item)}
                aria-pressed={active}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--lime-text-muted)]" />
                  <CanvasWorkbenchChangeStatusMark
                    meta={meta}
                    translateWorkbench={translateWorkbench}
                  />
                  <span className="truncate text-[13px] font-medium text-[color:var(--lime-text-strong)]">
                    {item.path}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold">
                    <DiffStats stats={stats} />
                  </span>
                </span>
              </button>
              {diffLines.length > 0 ? (
                <div className="min-h-[72px]">
                  <CanvasWorkbenchDiffState
                    diffLines={visibleDiffLines}
                    panelClassName={panelClassName}
                    variant={diffVariant}
                    filePath={item.path}
                    showWhitespace={showWhitespace}
                    wordWrapEnabled={wordWrapEnabled}
                    omittedLabel={(count) =>
                      translateWorkbench(
                        "agentChat.canvasWorkbench.coding.changes.omittedLines",
                        { count },
                      )
                    }
                    beforeLabel={translateWorkbench(
                      "agentChat.canvasWorkbench.coding.changes.beforeLabel",
                    )}
                    afterLabel={translateWorkbench(
                      "agentChat.canvasWorkbench.coding.changes.afterLabel",
                    )}
                  />
                </div>
              ) : item.preview ? (
                <pre className="whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-6 text-[color:var(--lime-text-strong)]">
                  {item.preview}
                </pre>
              ) : (
                <div className="px-4 py-3 text-xs text-[color:var(--lime-text-muted)]">
                  {translateWorkbench(
                    "agentChat.canvasWorkbench.coding.changes.noDiff",
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
