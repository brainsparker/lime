import { fail } from "./presentationPackageXml";
import type { PresentationTableRange } from "./presentationTableGrid";

const mergeAttributes = ["gridSpan", "rowSpan", "hMerge", "vMerge"];

export function resetMerge(cell: Element) {
  for (const attribute of mergeAttributes) cell.removeAttribute(attribute);
}

/** 只写 OOXML merge markers；各物理 cell 的正文、样式与未知 payload 原样保留。 */
export function mergeRange(
  cells: readonly (readonly Element[])[],
  { row, column, rowCount, columnCount }: PresentationTableRange,
) {
  for (let r = row; r < row + rowCount; r++)
    for (let c = column; c < column + columnCount; c++) {
      const cell = cells[r]?.[c];
      if (!cell) fail("table structure merged bounds");
      resetMerge(cell);
      // OOXML 完整矩阵表示：首行保留 rowSpan，首列保留 gridSpan。
      if (c === column && columnCount > 1)
        cell.setAttribute("gridSpan", String(columnCount));
      if (r === row && rowCount > 1)
        cell.setAttribute("rowSpan", String(rowCount));
      if (c > column) cell.setAttribute("hMerge", "1");
      if (r > row) cell.setAttribute("vMerge", "1");
    }
}
