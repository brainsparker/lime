import type {
  PresentationData,
  SlideData,
  TableCell,
  TableNodeData,
} from "@aiden0z/pptx-renderer";
import { presentationTextBodyStyle } from "./presentationElements";
import {
  readPresentationTableBorderStyle,
  type PresentationTableBorderStyle,
} from "./presentationTableBorderStyle";

export interface PresentationCellPosition {
  row: number;
  column: number;
}
export interface PresentationCellRange extends PresentationCellPosition {
  rowCount: number;
  columnCount: number;
}
export interface PresentationTableSelection {
  tableId: string;
  anchor: PresentationCellPosition;
  focus: PresentationCellPosition;
}
export interface PresentationTableCell extends PresentationCellPosition {
  rowSpan: number;
  columnSpan: number;
  cell: TableCell;
  frame: { x: number; y: number; width: number; height: number };
}

/** 只接受已验证的完整格网表示；不把原包坐标伪装成参考 cellId。 */
export function presentationTableCells(
  table: TableNodeData,
): PresentationTableCell[] | null {
  const rows = table.rows.length,
    columns = table.columns.length;
  if (
    !rows ||
    !columns ||
    rows > 100 ||
    columns > 100 ||
    rows * columns > 10_000 ||
    table.columns.some((width) => !Number.isFinite(width) || width <= 0) ||
    table.rows.some(
      (row) =>
        !Number.isFinite(row.height) ||
        row.height <= 0 ||
        row.cells.length !== columns,
    )
  )
    return null;
  const grid: (PresentationTableCell | undefined)[][] = Array.from(
    { length: rows },
    () => Array(columns).fill(undefined),
  );
  const cells: PresentationTableCell[] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const cell = table.rows[row].cells[column];
      if (cell.hMerge || cell.vMerge) continue;
      const rowSpan = cell.rowSpan,
        columnSpan = cell.gridSpan;
      if (
        !Number.isInteger(rowSpan) ||
        !Number.isInteger(columnSpan) ||
        rowSpan < 1 ||
        columnSpan < 1 ||
        row + rowSpan > rows ||
        column + columnSpan > columns
      )
        return null;
      const target = {
        row,
        column,
        rowSpan,
        columnSpan,
        cell,
        frame: {
          x: table.columns.slice(0, column).reduce((a, b) => a + b, 0),
          y: table.rows.slice(0, row).reduce((a, b) => a + b.height, 0),
          width: table.columns
            .slice(column, column + columnSpan)
            .reduce((a, b) => a + b, 0),
          height: table.rows
            .slice(row, row + rowSpan)
            .reduce((a, b) => a + b.height, 0),
        },
      };
      for (let r = row; r < row + rowSpan; r++)
        for (let c = column; c < column + columnSpan; c++) {
          if (grid[r][c]) return null;
          const continuation = table.rows[r].cells[c];
          if (
            Boolean(continuation.hMerge) !== c > column ||
            Boolean(continuation.vMerge) !== r > row ||
            continuation.rowSpan !== (r === row ? rowSpan : 1) ||
            continuation.gridSpan !== (c === column ? columnSpan : 1)
          )
            return null;
          grid[r][c] = target;
        }
      cells.push(target);
    }
  return grid.some((row) => row.some((cell) => !cell)) ? null : cells;
}

export function presentationTableCellAt(
  cells: readonly PresentationTableCell[],
  point: PresentationCellPosition,
) {
  if (!Number.isInteger(point.row) || !Number.isInteger(point.column))
    return undefined;
  return cells.find(
    (cell) =>
      point.row >= cell.row &&
      point.row < cell.row + cell.rowSpan &&
      point.column >= cell.column &&
      point.column < cell.column + cell.columnSpan,
  );
}

export function presentationTableRange(
  cells: readonly PresentationTableCell[],
  anchor: PresentationCellPosition,
  focus: PresentationCellPosition,
): PresentationCellRange | null {
  const first = presentationTableCellAt(cells, anchor),
    last = presentationTableCellAt(cells, focus);
  if (!first || !last) return null;
  let top = Math.min(first.row, last.row),
    left = Math.min(first.column, last.column),
    bottom = Math.max(first.row + first.rowSpan, last.row + last.rowSpan),
    right = Math.max(
      first.column + first.columnSpan,
      last.column + last.columnSpan,
    );
  let changed = true;
  while (changed) {
    changed = false;
    for (const cell of cells) {
      if (
        cell.row >= bottom ||
        cell.row + cell.rowSpan <= top ||
        cell.column >= right ||
        cell.column + cell.columnSpan <= left
      )
        continue;
      const bounds = [
        Math.min(top, cell.row),
        Math.min(left, cell.column),
        Math.max(bottom, cell.row + cell.rowSpan),
        Math.max(right, cell.column + cell.columnSpan),
      ];
      if (
        bounds[0] !== top ||
        bounds[1] !== left ||
        bounds[2] !== bottom ||
        bounds[3] !== right
      ) {
        [top, left, bottom, right] = bounds;
        changed = true;
      }
    }
  }
  return {
    row: top,
    column: left,
    rowCount: bottom - top,
    columnCount: right - left,
  };
}

export function presentationTableSnapshot(
  table: TableNodeData,
  selection: PresentationTableSelection | null,
  model?: PresentationData,
  slide?: SlideData,
) {
  const cells = presentationTableCells(table);
  if (!cells) return null;
  const range =
    selection &&
    presentationTableRange(cells, selection.anchor, selection.focus);
  const activeCell =
    range && selection
      ? presentationTableCellAt(cells, selection.focus)!
      : null;
  const selected = range
    ? cells.filter(
        (cell) =>
          cell.row >= range.row &&
          cell.row < range.row + range.rowCount &&
          cell.column >= range.column &&
          cell.column < range.column + range.columnCount,
      )
    : [];
  const style = presentationTextBodyStyle(selected[0]?.cell.textBody);
  const border =
    model && slide
      ? readPresentationTableBorderStyle(
          table,
          range || {
            row: 0,
            column: 0,
            rowCount: table.rows.length,
            columnCount: table.columns.length,
          },
          model,
          slide,
        )
      : {
          status: "unavailable" as const,
          reason: "missing-presentation-context",
        };
  const borderStyle: PresentationTableBorderStyle =
    border.status === "ready" ? border.style : {};
  const mixed = Object.fromEntries(
    Object.keys(style).map((key) => [
      key,
      selected.some((cell) => {
        const value = presentationTextBodyStyle(cell.cell.textBody);
        return (
          value[key as keyof typeof value] !== style[key as keyof typeof style]
        );
      }),
    ]),
  ) as Record<keyof typeof style, boolean>;
  return {
    tableId: table.id,
    frame: {
      left: table.position.x,
      top: table.position.y,
      width: table.size.w,
      height: table.size.h,
    },
    rowCount: table.rows.length,
    columnCount: table.columns.length,
    rowHeights: table.rows.map((row) => row.height),
    columnWidths: table.columns,
    headerRow: ["1", "true"].includes(table.properties?.attr("firstRow") ?? ""),
    headerColumn: ["1", "true"].includes(
      table.properties?.attr("firstCol") ?? "",
    ),
    borderAvailable: border.status === "ready",
    canMerge: selected.length > 1,
    canUnmerge: selected.some(
      (cell) => cell.rowSpan > 1 || cell.columnSpan > 1,
    ),
    selection:
      range && selection
        ? { anchor: selection.anchor, focus: selection.focus, range }
        : null,
    activeCell: activeCell
      ? { row: activeCell.row, column: activeCell.column }
      : null,
    style: { ...style, ...borderStyle },
    mixed: {
      ...mixed,
      borderEdges: borderStyle.borderEdges === undefined,
      borderColor: borderStyle.borderColor === undefined,
      borderWidth: borderStyle.borderWidth === undefined,
      borderStyle: borderStyle.borderStyle === undefined,
    },
  };
}

export type PresentationTableSnapshot = ReturnType<
  typeof presentationTableSnapshot
>;
export type PresentationTableInteraction =
  | { type: "select-all"; tableId: string }
  | {
      type: "reorder";
      tableId: string;
      axis: "row" | "column";
      index: number;
      insertionIndex: number;
    }
  | {
      type: "navigate";
      tableId: string;
      direction: "left" | "right" | "up" | "down" | "next" | "previous";
      extend?: boolean;
    }
  | {
      type: "pointer-down";
      tableId: string;
      target:
        | { kind: "cell" | "body" }
        | { kind: "row" | "column"; index: number };
      point: { x: number; y: number };
      shiftKey?: boolean;
    };
