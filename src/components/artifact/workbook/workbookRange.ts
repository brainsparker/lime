export interface CellPosition {
  row: number;
  column: number;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export function rangeAddress(range: CellRange): string {
  const start = cellAddress(range.start);
  const end = cellAddress(range.end);
  return start === end ? start : `${start}:${end}`;
}

export function rangeBetween(a: CellPosition, b: CellPosition): CellRange {
  return {
    start: {
      row: Math.min(a.row, b.row),
      column: Math.min(a.column, b.column),
    },
    end: { row: Math.max(a.row, b.row), column: Math.max(a.column, b.column) },
  };
}

export function columnName(column: number): string {
  let name = "";
  for (let value = column; value > 0; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

export function cellAddress({ row, column }: CellPosition): string {
  return `${columnName(column)}${row}`;
}

export function parseCellAddress(value: string): CellPosition | null {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})$/i.exec(value.trim());
  if (!match) return null;
  let column = 0;
  for (const char of match[1].toUpperCase())
    column = column * 26 + char.charCodeAt(0) - 64;
  const row = Number(match[2]);
  return column <= 16384 && row <= 1048576 ? { row, column } : null;
}

export function parseCellRange(value: string): CellRange | null {
  const parts = value.split(":");
  if (parts.length > 2) return null;
  const start = parseCellAddress(parts[0]);
  const end = parseCellAddress(parts[1] ?? parts[0]);
  if (!start || !end || end.row < start.row || end.column < start.column)
    return null;
  return { start, end };
}

export function containsCell(range: CellRange, cell: CellPosition): boolean {
  return (
    cell.row >= range.start.row &&
    cell.row <= range.end.row &&
    cell.column >= range.start.column &&
    cell.column <= range.end.column
  );
}
