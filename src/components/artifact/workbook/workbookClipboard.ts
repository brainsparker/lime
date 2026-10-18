import { parseDelimitedRows } from "./delimitedWorkbook";
import { isValidWorkbookCellInput } from "./workbookCellValue";
import type { WorkbookCellEdit } from "./workbookPackage";
import { cellAddress, type CellRange } from "./workbookRange";
import type { WorkbookSheet, WorkbookSnapshot } from "./workbookSnapshot";

export interface WorkbookClipboardPayload {
  plainText: string;
}

const maxCells = 100000;
const maxBytes = 20 * 1024 * 1024;

function validRange(sheet: WorkbookSheet, range: CellRange): boolean {
  const { start, end } = range;
  return (
    [start.row, start.column, end.row, end.column].every(Number.isInteger) &&
    start.row >= 1 &&
    start.column >= 1 &&
    end.row >= start.row &&
    end.column >= start.column &&
    end.row <= sheet.rowCount &&
    end.column <= sheet.columnCount &&
    (end.row - start.row + 1) * (end.column - start.column + 1) <= maxCells &&
    !sheet.merges.some(
      (merge) =>
        merge.start.row <= end.row &&
        merge.end.row >= start.row &&
        merge.start.column <= end.column &&
        merge.end.column >= start.column,
    )
  );
}

function quoteField(value: string): string {
  // 空字段加引号，使末尾全空行也能通过同一个 TSV parser 无损往返。
  return value === "" || /[\t\r\n"]/.test(value)
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}

/** 仅复制投影的显示文本；公式缓存不可用时不计算或回退到公式源码。 */
export function copyWorkbookRange(
  sheet: WorkbookSheet,
  range: CellRange,
): WorkbookClipboardPayload | null {
  if (!validRange(sheet, range)) return null;
  const rows: string[] = [];
  let bytes = 0;
  const encoder = new TextEncoder();
  for (let row = range.start.row; row <= range.end.row; row++) {
    const fields: string[] = [];
    for (let column = range.start.column; column <= range.end.column; column++)
      fields.push(
        quoteField(sheet.cells[cellAddress({ row, column })]?.text ?? ""),
      );
    const line = fields.join("\t");
    bytes += encoder.encode(line).byteLength + (rows.length ? 1 : 0);
    if (bytes > maxBytes) return null;
    rows.push(line);
  }
  return { plainText: rows.join("\n") };
}

/** 整个矩形验证通过后才返回编辑，不拥有投影、保存或第二套 TSV parser。 */
export function pasteWorkbookRange(
  document: WorkbookSnapshot,
  sheetId: string,
  selection: CellRange,
  payload: WorkbookClipboardPayload,
): { range: CellRange; edits: WorkbookCellEdit[] } | null {
  const sheet = document.sheets.find((sheet) => sheet.id === sheetId);
  if (
    !sheet ||
    !validRange(sheet, selection) ||
    typeof payload?.plainText !== "string" ||
    payload.plainText.length > maxBytes ||
    new TextEncoder().encode(payload.plainText).byteLength > maxBytes
  )
    return null;
  try {
    const rows =
      payload.plainText === "" || payload.plainText === "\uFEFF"
        ? [[""]]
        : parseDelimitedRows(payload.plainText, "\t").map((row) =>
            row.fields.map((field) => field.value),
          );
    // 文件 parser 消费文件 BOM；剪贴板中的首字符属于用户的单元格文本。
    if (payload.plainText.startsWith("\uFEFF") && rows[0]?.length)
      rows[0][0] = "\uFEFF" + rows[0][0];
    const width = rows[0]?.length ?? 0;
    if (
      !width ||
      rows.length * width > maxCells ||
      rows.some(
        (row) =>
          row.length !== width ||
          row.some((value) => !isValidWorkbookCellInput(value)),
      )
    )
      return null;
    const range = {
      start: { ...selection.start },
      end: {
        row: selection.start.row + rows.length - 1,
        column: selection.start.column + width - 1,
      },
    };
    if (!validRange(sheet, range)) return null;
    let cellCount = document.sheets.reduce(
      (count, sheet) => count + Object.keys(sheet.cells).length,
      0,
    );
    const edits: WorkbookCellEdit[] = [];
    for (const [rowIndex, values] of rows.entries())
      for (const [columnIndex, value] of values.entries()) {
        const address = cellAddress({
          row: range.start.row + rowIndex,
          column: range.start.column + columnIndex,
        });
        if (!Object.hasOwn(sheet.cells, address) && ++cellCount > maxCells)
          return null;
        edits.push({ sheetId, address, value });
      }
    return { range, edits };
  } catch {
    return null;
  }
}
