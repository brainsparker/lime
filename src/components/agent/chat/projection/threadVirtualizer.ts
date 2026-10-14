export interface ThreadVirtualizerEntry {
  id: string;
  estimatedHeightPx?: number;
}

export interface ThreadVirtualizerLayout {
  keys: string[];
  indexByKey: Map<string, number>;
  heights: number[];
  offsets: number[];
  totalHeight: number;
}

export interface ThreadVirtualizerRange {
  startIndex: number;
  endIndex: number;
}

export function buildThreadLayout(
  entries: readonly ThreadVirtualizerEntry[],
  measuredHeights: ReadonlyMap<string, number>,
  gapPx = 12,
): ThreadVirtualizerLayout {
  const keys: string[] = [];
  const heights: number[] = [];
  const offsets: number[] = [];
  const indexByKey = new Map<string, number>();
  let totalHeight = 0;
  for (const entry of entries) {
    if (keys.length > 0) totalHeight += gapPx;
    indexByKey.set(entry.id, keys.length);
    keys.push(entry.id);
    offsets.push(totalHeight);
    const height = Math.max(
      1,
      measuredHeights.get(entry.id) ?? entry.estimatedHeightPx ?? 280,
    );
    heights.push(height);
    totalHeight += height;
  }
  return { keys, heights, offsets, indexByKey, totalHeight };
}

export function getThreadRange(
  layout: ThreadVirtualizerLayout,
  scrollTop: number,
  viewportHeight: number,
  overscan = 2,
): ThreadVirtualizerRange {
  const length = layout.keys.length;
  if (length === 0) return { startIndex: 0, endIndex: 0 };
  const top = Math.max(0, Math.min(scrollTop, layout.totalHeight));
  const bottom = top + Math.max(0, viewportHeight);
  let low = 0;
  let high = length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (layout.offsets[mid] + layout.heights[mid] <= top) low = mid + 1;
    else high = mid;
  }
  const first = Math.min(length - 1, low);
  low = first;
  high = length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (layout.offsets[mid] < bottom) low = mid + 1;
    else high = mid;
  }
  return {
    startIndex: Math.max(0, first - overscan),
    endIndex: Math.min(length, Math.max(first + 1, low) + overscan),
  };
}

export function preserveThreadAnchor(
  previous: ThreadVirtualizerLayout,
  next: ThreadVirtualizerLayout,
  scrollTop: number,
): number {
  const { startIndex } = getThreadRange(previous, scrollTop, 0, 0);
  // A removed row cannot be an anchor; choose the next surviving visible owner.
  for (let index = startIndex; index < previous.keys.length; index += 1) {
    const nextIndex = next.indexByKey.get(previous.keys[index]);
    if (nextIndex !== undefined) {
      return Math.max(
        0,
        scrollTop + next.offsets[nextIndex] - previous.offsets[index],
      );
    }
  }
  return Math.max(0, Math.min(scrollTop, next.totalHeight));
}
