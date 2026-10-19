export const FILE_TREE_ITEM_HEIGHT = 28;
const OVERSCAN = 10;

export interface FileTreePosition {
  path: string;
  depth: number;
  isDirectory: boolean;
}

export function indexFileTreeRows(rows: readonly FileTreePosition[]) {
  const parents: number[] = [];
  const subtreeEnds = rows.map((_, index) => index);
  const directories = new Map<number, number[]>();
  const ancestors: number[] = [];
  rows.forEach((row, index) => {
    while (ancestors.length && rows[ancestors.at(-1)!].depth >= row.depth)
      subtreeEnds[ancestors.pop()!] = index - 1;
    parents[index] = ancestors.at(-1) ?? -1;
    if (row.isDirectory) {
      const level = directories.get(row.depth) ?? [];
      level.push(index);
      directories.set(row.depth, level);
      ancestors.push(index);
    }
  });
  for (const index of ancestors) subtreeEnds[index] = rows.length - 1;
  return { rows, parents, subtreeEnds, directories };
}

export type FileTreeIndex = ReturnType<typeof indexFileTreeRows>;

function lastIndexBefore(indices: readonly number[], limit: number): number {
  let start = 0;
  let end = indices.length;
  while (start < end) {
    const middle = (start + end) >>> 1;
    if (indices[middle] <= limit) start = middle + 1;
    else end = middle;
  }
  return start - 1;
}

export function getFileTreeViewport(
  index: FileTreeIndex,
  scrollTop: number,
  viewportHeight: number,
  stickyFolders: boolean,
) {
  const count = index.rows.length;
  const height = Math.max(0, viewportHeight);
  const totalHeight = count * FILE_TREE_ITEM_HEIGHT;
  const maxScrollTop = Math.max(0, totalHeight - height);
  const top = Math.max(0, Math.min(scrollTop, maxScrollTop));
  const stickyRows: { index: number; top: number }[] = [];
  if (stickyFolders && top > 0) {
    for (let depth = 0; depth < index.directories.size; depth++) {
      const candidates = index.directories.get(depth);
      if (!candidates?.length) break;
      const limit = Math.min(
        count - 1,
        Math.floor(
          (top + depth * FILE_TREE_ITEM_HEIGHT) / FILE_TREE_ITEM_HEIGHT,
        ),
      );
      let candidate = lastIndexBefore(candidates, limit);
      while (
        candidate >= 0 &&
        depth > 0 &&
        index.parents[candidates[candidate]] !== stickyRows[depth - 1]?.index
      )
        candidate--;
      if (candidate < 0) break;
      const rowIndex = candidates[candidate];
      const end = index.subtreeEnds[rowIndex] + 1;
      const rowTop =
        end >= count
          ? depth * FILE_TREE_ITEM_HEIGHT
          : Math.min(
              depth * FILE_TREE_ITEM_HEIGHT,
              end * FILE_TREE_ITEM_HEIGHT - top - FILE_TREE_ITEM_HEIGHT,
            );
      if (rowTop + FILE_TREE_ITEM_HEIGHT <= 0) break;
      stickyRows.push({ index: rowIndex, top: rowTop });
    }
  }
  const stickyHeight = stickyRows.reduce(
    (height, row) => Math.max(height, row.top + FILE_TREE_ITEM_HEIGHT),
    0,
  );
  const visibleStart = Math.min(
    count,
    Math.floor((top + stickyHeight) / FILE_TREE_ITEM_HEIGHT),
  );
  const visibleEnd = Math.min(
    count - 1,
    Math.ceil((top + height) / FILE_TREE_ITEM_HEIGHT) - 1,
  );
  const firstUnoccluded = stickyHeight > 0 ? visibleStart : 0;
  const start = Math.max(firstUnoccluded, visibleStart - OVERSCAN);
  const end =
    height <= stickyHeight || visibleEnd < visibleStart
      ? -1
      : Math.min(count - 1, visibleEnd + OVERSCAN);
  return { start, end, scrollTop: top, totalHeight, stickyHeight, stickyRows };
}

export function getFileTreeFocusScrollTop(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  totalHeight: number,
  stickyHeight: number,
) {
  const top = index * FILE_TREE_ITEM_HEIGHT;
  if (
    index < 0 ||
    (top >= scrollTop + stickyHeight &&
      top + FILE_TREE_ITEM_HEIGHT <= scrollTop + viewportHeight)
  )
    return null;
  return Math.max(
    0,
    Math.min(top - stickyHeight, Math.max(0, totalHeight - viewportHeight)),
  );
}
