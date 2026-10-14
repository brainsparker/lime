import { ChevronDown } from "lucide-react";
import { DiffStats } from "./CanvasWorkbenchChangeStats";

type CanvasWorkbenchTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export function CanvasWorkbenchEmptyDiffPanel({
  messageKey = "agentChat.canvasWorkbench.coding.changes.empty",
  translateWorkbench,
}: {
  messageKey?: string;
  translateWorkbench: CanvasWorkbenchTranslation;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden bg-[color:var(--lime-surface)]">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--lime-text-muted)]" />
          <span className="truncate text-[13px] font-medium text-[color:var(--lime-text-strong)]">
            {translateWorkbench(
              "agentChat.canvasWorkbench.coding.changes.detailTitle",
            )}
          </span>
        </div>
        <span className="font-mono text-[12px] font-semibold">
          <DiffStats stats={{ additions: 0, removals: 0 }} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--lime-surface)]">
        <div className="h-full overflow-auto">
          <div className="grid grid-cols-[52px_28px_minmax(0,1fr)] border-b border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] font-mono text-[12px] leading-6 text-[color:var(--lime-text-muted)]">
            <span className="select-none border-r border-[color:var(--lime-surface-border)] px-2 py-1.5 text-right text-[11px] text-[color:var(--lime-text-muted)]">
              1
            </span>
            <span className="select-none border-r border-[color:var(--lime-surface-border)] px-1 py-1.5 text-center text-[color:var(--lime-text-muted)]">
              {" "}
            </span>
            <span className="px-3 py-1.5">
              {translateWorkbench(messageKey)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
