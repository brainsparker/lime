import type { ReactNode } from "react";
import type { CanvasWorkbenchChangeDiffStats } from "./CanvasWorkbenchChangesPanelViewModel";

export function DiffStats({
  stats,
}: {
  stats: CanvasWorkbenchChangeDiffStats;
}): ReactNode {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold">
      <span className="text-[color:var(--lime-brand)]">+{stats.additions}</span>
      <span className="text-[color:var(--lime-danger)]">-{stats.removals}</span>
    </span>
  );
}
