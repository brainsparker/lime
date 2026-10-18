import { findElement } from "./presentationPackage";
import { a, fail, children, one, numericId } from "./presentationPackageXml";

export interface PresentationTableRange {
  row: number;
  column: number;
  rowCount: number;
  columnCount: number;
}

export interface Cell extends PresentationTableRange {
  element: Element;
}

export interface Grid {
  element: Element;
  table: Element;
  rowElements: Element[];
  columnElements: Element[];
  cells: Element[][];
  rows: number;
  columns: number;
  owners: Cell[][];
}

export function record(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function span(cell: Element, name: string, maximum: number): number {
  const value = cell.getAttribute(name) ?? "1";
  if (!numericId(value, 1, maximum)) fail("table cell span");
  return Number(value);
}

function merged(cell: Element, name: string): boolean {
  const value = cell.getAttribute(name);
  if (value === null || value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  fail("table merge flag");
}

export function tableGrid(xml: Document, tableId: string): Grid {
  const element = findElement(xml, tableId);
  if (element.localName !== "graphicFrame") fail("table element");
  const graphic = one(element, a, "graphic");
  const data = graphic && one(graphic, a, "graphicData");
  if (
    data?.getAttribute("uri") !==
    "http://schemas.openxmlformats.org/drawingml/2006/table"
  )
    fail("table graphic data");
  const table = one(data, a, "tbl");
  const grid = table && one(table, a, "tblGrid");
  if (!table || !grid) fail("table grid");
  one(table, a, "tblPr");
  const columns = children(grid, a, "gridCol");
  const rows = children(table, a, "tr");
  if (
    !columns.length ||
    columns.length > 100 ||
    !rows.length ||
    rows.length > 100 ||
    rows.some(
      (row) =>
        !numericId(row.getAttribute("h") ?? "", 1, Number.MAX_SAFE_INTEGER),
    ) ||
    columns.some((column) => {
      const width = column.getAttribute("w") ?? "";
      return !numericId(width, 1, Number.MAX_SAFE_INTEGER);
    })
  )
    fail("table grid dimensions");
  const cells = rows.map((row) => children(row, a, "tc"));
  // 只接受每个格网位置都有 tc 的表示；压缩或歧义表示不猜测位置。
  if (cells.some((row) => row.length !== columns.length))
    fail("unsupported compact table grid");
  const owners: Cell[][] = rows.map(() => []);
  cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      const horizontal = merged(cell, "hMerge"),
        vertical = merged(cell, "vMerge");
      const columnCount = span(cell, "gridSpan", columns.length),
        rowCount = span(cell, "rowSpan", rows.length);
      if (horizontal || vertical) return;
      if (r + rowCount > rows.length || c + columnCount > columns.length)
        fail("table merged cell bounds");
      const owner = { element: cell, row: r, column: c, rowCount, columnCount };
      for (let y = r; y < r + rowCount; y++)
        for (let x = c; x < c + columnCount; x++) {
          const member = cells[y][x];
          if (
            owners[y][x] ||
            merged(member, "hMerge") !== x > c ||
            merged(member, "vMerge") !== y > r
          )
            fail("table merge topology");
          const width = span(member, "gridSpan", columns.length),
            height = span(member, "rowSpan", rows.length);
          if (
            (width !== 1 && (x !== c || width !== columnCount)) ||
            (height !== 1 && (y !== r || height !== rowCount))
          )
            fail("table continuation span");
          owners[y][x] = owner;
        }
    });
  });
  for (let row = 0; row < rows.length; row++)
    for (let column = 0; column < columns.length; column++)
      if (!owners[row][column]) fail("orphan table continuation");
  return {
    element,
    table,
    rowElements: rows,
    columnElements: columns,
    cells,
    rows: rows.length,
    columns: columns.length,
    owners,
  };
}

export function cellAt(grid: Grid, row: number, column: number): Cell {
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(column) ||
    row < 0 ||
    column < 0 ||
    row >= grid.rows ||
    column >= grid.columns
  )
    fail("table cell address");
  return grid.owners[row][column];
}

export function validateTableRange(
  grid: Grid,
  range: PresentationTableRange,
): void {
  if (
    !record(range) ||
    Object.keys(range).some(
      (key) => !["row", "column", "rowCount", "columnCount"].includes(key),
    ) ||
    !Number.isInteger(range.rowCount) ||
    !Number.isInteger(range.columnCount) ||
    range.rowCount < 1 ||
    range.columnCount < 1
  )
    fail("table cell range");
  cellAt(grid, range.row, range.column);
  cellAt(
    grid,
    range.row + range.rowCount - 1,
    range.column + range.columnCount - 1,
  );
}

export function selectedCells(
  grid: Grid,
  range: PresentationTableRange,
): Cell[] {
  validateTableRange(grid, range);
  const targets = new Set<Cell>();
  for (let row = range.row; row < range.row + range.rowCount; row++)
    for (
      let column = range.column;
      column < range.column + range.columnCount;
      column++
    ) {
      const cell = grid.owners[row][column];
      if (
        cell.row < range.row ||
        cell.column < range.column ||
        cell.row + cell.rowCount > range.row + range.rowCount ||
        cell.column + cell.columnCount > range.column + range.columnCount
      )
        fail("partial merged table range");
      targets.add(cell);
    }
  return [...targets];
}
