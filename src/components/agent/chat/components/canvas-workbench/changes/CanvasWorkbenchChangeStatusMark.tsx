import { cn } from "@/lib/utils";
import type { CanvasWorkbenchChangeDisplayMeta } from "./CanvasWorkbenchChangesPanelViewModel";
import type { CanvasWorkbenchTranslation } from "./CanvasWorkbenchChangesTypes";

function resolveStatusMarkClassName(meta: CanvasWorkbenchChangeDisplayMeta) {
  if (meta.kind === "added") {
    return "bg-[color:var(--lime-brand-soft)] text-[color:var(--lime-brand)] ring-[color:var(--lime-brand-muted)]";
  }
  if (meta.kind === "deleted") {
    return "bg-[color:var(--lime-danger-soft)] text-[color:var(--lime-danger)] ring-[color:var(--lime-danger-border)]";
  }
  if (meta.kind === "renamed") {
    return "bg-[color:var(--lime-info-soft)] text-[color:var(--lime-info)] ring-[color:var(--lime-info-border)]";
  }
  if (meta.kind === "copied") {
    return "bg-[color:var(--lime-info-soft)] text-[color:var(--lime-info)] ring-[color:var(--lime-info-border)]";
  }
  if (meta.kind === "modified") {
    return "bg-[color:var(--lime-warning-soft)] text-[color:var(--lime-warning)] ring-[color:var(--lime-warning-border)]";
  }
  return "bg-[color:var(--lime-surface-subtle)] text-[color:var(--lime-text-muted)] ring-[color:var(--lime-surface-border)]";
}

export function CanvasWorkbenchChangeStatusMark({
  meta,
  translateWorkbench,
  className,
}: {
  meta: CanvasWorkbenchChangeDisplayMeta | null;
  translateWorkbench: CanvasWorkbenchTranslation;
  className?: string;
}) {
  if (!meta) {
    return null;
  }

  const label = translateWorkbench(meta.labelKey);

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-[4px] px-1 font-mono text-[10px] font-bold leading-none ring-1",
        resolveStatusMarkClassName(meta),
        className,
      )}
      title={label}
      data-testid="canvas-workbench-change-status-mark"
      data-change-kind={meta.kind}
    >
      {translateWorkbench(meta.shortLabelKey)}
    </span>
  );
}
