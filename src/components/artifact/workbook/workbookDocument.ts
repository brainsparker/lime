import ExcelJS from "exceljs";
import {
  decodeDelimitedWorkbook,
  parseDelimitedRows,
} from "./delimitedWorkbook";
import { format as formatNumber } from "ssf";
import type { CSSProperties } from "react";
import { cellAddress, parseCellRange } from "./workbookRange";
import {
  WorkbookImportError,
  type WorkbookCell,
  type WorkbookSheet,
  type WorkbookSourceFormat,
} from "./workbookSnapshot";

const limits = {
  rows: 200_000,
  columns: 1024,
  cells: 100_000,
  bytes: 20 * 1024 * 1024,
};

function checkSize(rows: number, columns: number, cells: number) {
  if (rows > limits.rows || columns > limits.columns || cells > limits.cells)
    throw new WorkbookImportError("tooLarge");
}

function emptySheet(id: string, name: string): WorkbookSheet {
  return {
    id,
    name,
    rowCount: 30,
    columnCount: 10,
    rowHeights: {},
    columnWidths: {},
    cells: {},
    merges: [],
  };
}

/** CSV/TSV 保留原始字符串；公式、链接和以 = 开头的字段都不执行。 */
export function parseDelimitedWorkbook(
  text: string,
  delimiter: "," | "\t",
): WorkbookSheet[] {
  const sheet = emptySheet("delimited", "Sheet1");
  const rows = parseDelimitedRows(text, delimiter);
  rows.forEach((row, rowIndex) => {
    sheet.rowCount = Math.max(sheet.rowCount, rowIndex + 1);
    sheet.columnCount = Math.max(sheet.columnCount, row.fields.length);
    row.fields.forEach(({ value }, columnIndex) => {
      if (value)
        sheet.cells[
          cellAddress({ row: rowIndex + 1, column: columnIndex + 1 })
        ] = {
          text: value,
          raw: value,
          style: {},
        };
    });
  });
  return [sheet];
}

function color(value?: Partial<ExcelJS.Color>): string | undefined {
  const argb = value?.argb;
  if (!argb || !/^[\da-f]{8}$/i.test(argb)) return undefined;
  return `#${argb.slice(2)}`;
}

function border(value?: Partial<ExcelJS.Border>): string | undefined {
  if (!value?.style) return undefined;
  const kind =
    value.style === "double"
      ? "double"
      : value.style.includes("dash")
        ? "dashed"
        : value.style === "dotted"
          ? "dotted"
          : "solid";
  const width =
    value.style === "double" || value.style === "thick"
      ? 3
      : value.style.startsWith("medium")
        ? 2
        : 1;
  return `${width}px ${kind} ${color(value.color) ?? "var(--border)"}`;
}

function cellStyle(cell: ExcelJS.Cell): CSSProperties {
  const { font, alignment, fill, border: edges } = cell;
  const style: CSSProperties = {
    color: color(font?.color),
    fontWeight: font?.bold ? 700 : undefined,
    fontStyle: font?.italic ? "italic" : undefined,
    fontFamily: font?.name,
    fontSize: font?.size ? `${font.size}pt` : undefined,
    textDecoration:
      [font?.underline && "underline", font?.strike && "line-through"]
        .filter(Boolean)
        .join(" ") || undefined,
    textAlign:
      alignment?.horizontal === "centerContinuous"
        ? "center"
        : alignment?.horizontal === "distributed" ||
            alignment?.horizontal === "fill"
          ? undefined
          : alignment?.horizontal,
    whiteSpace: alignment?.wrapText ? "pre-wrap" : "pre",
    borderTop: border(edges?.top),
    borderBottom: border(edges?.bottom),
    borderLeft: border(edges?.left),
    borderRight: border(edges?.right),
  };
  if (fill?.type === "pattern" && fill.pattern === "solid")
    style.backgroundColor = color(fill.fgColor);
  return style;
}

function scalar(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date)
    return Number.isNaN(value.valueOf()) ? "" : value.toISOString();
  if (typeof value === "object") {
    if ("error" in value) return String(value.error);
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText
        .map((part: { text?: string }) => part.text ?? "")
        .join("");
    if ("text" in value) return String(value.text);
    return "";
  }
  return String(value);
}

function projectCell(cell: ExcelJS.Cell, date1904: boolean): WorkbookCell {
  const formula = cell.formula;
  const value = formula ? cell.result : cell.value;
  const raw = scalar(value);
  let text = raw;
  const serial =
    value instanceof Date ? value.valueOf() / 86400000 + 25569 : value;
  if (typeof serial === "number" && Number.isFinite(serial) && cell.numFmt) {
    try {
      text = formatNumber(cell.numFmt, serial, {
        date1904: value instanceof Date ? false : date1904,
      });
    } catch {
      /* 未支持的自定义格式保留原始缓存值。 */
    }
  } else if (typeof value === "boolean") text = value ? "TRUE" : "FALSE";
  return { text, raw, formula, style: cellStyle(cell) };
}

export async function importWorkbook(
  bytes: Uint8Array,
  format: WorkbookSourceFormat,
): Promise<WorkbookSheet[]> {
  if (bytes.byteLength > limits.bytes)
    throw new WorkbookImportError("tooLarge");
  if (format !== "xlsx") {
    return parseDelimitedWorkbook(
      decodeDelimitedWorkbook(bytes).text,
      format === "tsv" ? "\t" : ",",
    );
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new WorkbookImportError("invalid");
  }
  let cells = 0;
  const sheets: WorkbookSheet[] = [];
  for (const source of workbook.worksheets) {
    if (source.state !== "visible") continue;
    checkSize(source.rowCount, source.columnCount, cells);
    const sheet = emptySheet(String(source.id), source.name);
    sheet.rowCount = Math.max(30, source.rowCount);
    sheet.columnCount = Math.max(10, source.columnCount);
    source.eachRow({ includeEmpty: false }, (row) => {
      if (row.hidden || row.height)
        sheet.rowHeights[row.number] = row.hidden
          ? 0
          : Math.max(1, (row.height! * 4) / 3);
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.type === ExcelJS.ValueType.Merge) return;
        checkSize(Number(cell.row), Number(cell.col), ++cells);
        sheet.cells[cell.address] = projectCell(
          cell,
          workbook.properties.date1904 ?? false,
        );
      });
    });
    source.columns.forEach((column, index) => {
      if (column.hidden || column.width)
        sheet.columnWidths[index + 1] = column.hidden
          ? 0
          : Math.max(8, (column.width ?? 12) * 7 + 5);
    });
    for (const address of source.model.merges ?? []) {
      const range = parseCellRange(address);
      if (!range) throw new WorkbookImportError("invalid");
      checkSize(range.end.row, range.end.column, cells);
      sheet.merges.push(range);
      sheet.rowCount = Math.max(sheet.rowCount, range.end.row);
      sheet.columnCount = Math.max(sheet.columnCount, range.end.column);
    }
    sheets.push(sheet);
  }
  if (!sheets.length) throw new WorkbookImportError("invalid");
  return sheets;
}
