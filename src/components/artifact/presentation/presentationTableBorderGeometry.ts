import {
  validateTableRange,
  type Grid,
  type Cell,
  type PresentationTableRange,
} from "./presentationTableGrid";
import { sides, type Side } from "./presentationTableStyle";

export interface TableEdge {
  cell: Cell;
  side: Side;
  horizontal: boolean;
  cross: number;
  start: number;
  end: number;
  group: "outside" | "rows" | "columns";
}

/** 共边两侧都保留；raw 范围不扩张，允许仅触及合并格的一部分。 */
export function* tableEdges(
  grid: Grid,
  range: PresentationTableRange,
): Generator<TableEdge> {
  validateTableRange(grid, range);
  for (const cell of new Set(grid.owners.flat())) {
    for (const side of sides) {
      const horizontal = side === "top" || side === "bottom";
      const cross = horizontal
        ? cell.row + (side === "bottom" ? cell.rowCount : 0)
        : cell.column + (side === "right" ? cell.columnCount : 0);
      const lower = horizontal ? range.row : range.column;
      const upper = lower + (horizontal ? range.rowCount : range.columnCount);
      if (cross < lower || cross > upper) continue;
      const origin = horizontal ? range.column : range.row;
      const position = horizontal ? cell.column : cell.row;
      const start = Math.max(origin, position);
      const end = Math.min(
        origin + (horizontal ? range.columnCount : range.rowCount),
        position + (horizontal ? cell.columnCount : cell.rowCount),
      );
      if (start >= end) continue;
      yield {
        cell,
        side,
        horizontal,
        cross,
        start,
        end,
        group:
          cross === lower || cross === upper
            ? "outside"
            : horizontal
              ? "rows"
              : "columns",
      };
    }
  }
}

/** selection snapshot 扩到闭包；preset 的写入范围仍使用原请求。 */
export function mergedTableRange(
  grid: Grid,
  range: PresentationTableRange,
): PresentationTableRange {
  validateTableRange(grid, range);
  let { row, column, rowCount, columnCount } = range;
  for (;;) {
    let bottom = row + rowCount,
      right = column + columnCount;
    const previous = [row, column, bottom, right].join(":");
    for (let y = row; y < bottom; y++)
      for (let x = column; x < right; x++) {
        const cell = grid.owners[y][x];
        row = Math.min(row, cell.row);
        column = Math.min(column, cell.column);
        bottom = Math.max(bottom, cell.row + cell.rowCount);
        right = Math.max(right, cell.column + cell.columnCount);
      }
    rowCount = bottom - row;
    columnCount = right - column;
    if (previous === [row, column, bottom, right].join(":"))
      return { row, column, rowCount, columnCount };
  }
}
