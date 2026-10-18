export type ThreadSummaryDisplayMode = "overlay" | "shift" | "gutter";

/** Shipped thread-summary-panel-layout contract, measured in the main pane. */
export function getThreadSummaryDisplayMode(
  mainContentTargetWidth: number,
  panelWidth = 300,
): ThreadSummaryDisplayMode {
  const gutter = (mainContentTargetWidth - 736) / 2;
  const extraWidth = panelWidth - 300;
  return gutter < 180 + extraWidth / 2
    ? "overlay"
    : gutter < 400 + extraWidth
      ? "shift"
      : "gutter";
}

export function getThreadSummaryContentShift(
  displayMode: ThreadSummaryDisplayMode,
  isPinned: boolean,
  panelWidth = 300,
): number {
  return isPinned && displayMode === "shift"
    ? -(308 + panelWidth - 300) / 2
    : 0;
}
