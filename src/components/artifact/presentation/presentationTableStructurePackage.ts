import { a, fail, children, one } from "./presentationPackageXml";
import {
  record,
  type Grid,
  type PresentationTableRange,
} from "./presentationTableGrid";
import {
  dimension,
  sum,
  emu,
  frameElements,
  tracks,
  consistent,
} from "./presentationTableDimensions";
import { resetMerge, mergeRange } from "./presentationTableMerges";

type Identity = { slideId: string; tableId: string };
export type PresentationTableStructureEdit = Identity &
  (
    | { type: "insert-rows"; index: number; count?: number }
    | { type: "delete-rows"; index: number; count?: number }
    | { type: "insert-columns"; index: number; count?: number }
    | { type: "delete-columns"; index: number; count?: number }
    | {
        type: "resize-table";
        frame: { left: number; top: number; width: number; height: number };
        rowHeights: readonly number[];
        columnWidths: readonly number[];
      }
  );

function resize(
  grid: Grid,
  edit: Extract<PresentationTableStructureEdit, { type: "resize-table" }>,
) {
  if (
    !record(edit.frame) ||
    Object.keys(edit.frame).some(
      (key) => !["left", "top", "width", "height"].includes(key),
    ) ||
    !Array.isArray(edit.rowHeights) ||
    !Array.isArray(edit.columnWidths) ||
    edit.rowHeights.length !== grid.rows ||
    edit.columnWidths.length !== grid.columns
  )
    fail("table resize dimensions");
  const frame = {
    left: emu(edit.frame.left, false),
    top: emu(edit.frame.top, false),
    width: emu(edit.frame.width, true),
    height: emu(edit.frame.height, true),
  };
  const heights = edit.rowHeights.map((value) => emu(value, true));
  const widths = edit.columnWidths.map((value) => emu(value, true));
  consistent(frame.width, widths);
  consistent(frame.height, heights);
  const { offset, extent } = frameElements(grid);
  grid.rowElements.forEach((row, index) =>
    row.setAttribute("h", String(heights[index])),
  );
  grid.columnElements.forEach((column, index) =>
    column.setAttribute("w", String(widths[index])),
  );
  offset.setAttribute("x", String(frame.left));
  offset.setAttribute("y", String(frame.top));
  // 序列化后的外框以已舍入轨道总和为准，避免制造一份不一致的格网。
  extent.setAttribute("cx", String(sum(widths)));
  extent.setAttribute("cy", String(sum(heights)));
}

function assertCloneable(element: Element) {
  for (const node of [
    element,
    ...Array.from(element.getElementsByTagName("*")),
  ]) {
    if (
      /\/(?:office|drawingml)\//.test(node.namespaceURI ?? "") &&
      /(?:Id|ID)$/.test(node.localName)
    )
      fail("unsupported table clone identity");
    for (const attribute of Array.from(node.attributes)) {
      if (
        attribute.namespaceURI ===
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
      )
        fail("unsupported table clone relationship");
      if (/^(?:id|creationId|rowId|colId)$/i.test(attribute.localName))
        fail("unsupported table clone identity");
    }
  }
}

function cloneCell(cell: Element, clearText: (cell: Element) => void): Element {
  assertCloneable(cell);
  const clone = cell.cloneNode(true) as Element;
  clearText(clone);
  resetMerge(clone);
  return clone;
}

function insertRows(
  grid: Grid,
  index: number,
  count: number,
  clearText: (cell: Element) => void,
) {
  const template = grid.rowElements[Math.min(index, grid.rows - 1)];
  assertCloneable(template);
  const before =
    grid.rowElements[index] ?? grid.rowElements.at(-1)!.nextSibling;
  for (let added = 0; added < count; added++) {
    const row = template.cloneNode(true) as Element;
    for (const cell of children(row, a, "tc")) {
      clearText(cell);
      resetMerge(cell);
    }
    grid.table.insertBefore(row, before);
  }
}

function insertColumns(
  grid: Grid,
  index: number,
  count: number,
  clearText: (cell: Element) => void,
) {
  const template = grid.columnElements[Math.min(index, grid.columns - 1)];
  assertCloneable(template);
  const parent = template.parentNode!;
  const before =
    grid.columnElements[index] ?? grid.columnElements.at(-1)!.nextSibling;
  for (let added = 0; added < count; added++)
    parent.insertBefore(template.cloneNode(true), before);
  grid.cells.forEach((cells, rowIndex) => {
    const before = cells[index] ?? cells.at(-1)!.nextSibling;
    const template = cells[Math.min(index, grid.columns - 1)];
    for (let added = 0; added < count; added++)
      grid.rowElements[rowIndex].insertBefore(
        cloneCell(template, clearText),
        before,
      );
  });
}

function remapMerge(
  range: PresentationTableRange,
  axis: "row" | "column",
  index: number,
  count: number,
  insert: boolean,
): PresentationTableRange | null {
  let start = range[axis];
  const span = axis === "row" ? "rowCount" : "columnCount";
  let end = start + range[span] - 1;
  if (insert) {
    if (index <= start) {
      start += count;
      end += count;
    } else if (index <= end) end += count;
  } else {
    const surviving = Array.from(
      { length: end - start + 1 },
      (_, offset) => start + offset,
    )
      .filter((track) => track < index || track >= index + count)
      .map((track) => (track >= index + count ? track - count : track));
    if (!surviving.length) return null;
    start = surviving[0];
    end = surviving.at(-1)!;
  }
  return { ...range, [axis]: start, [span]: end - start + 1 };
}

function rebuildMerges(grid: Grid, ranges: readonly PresentationTableRange[]) {
  const cells = children(grid.table, a, "tr").map((row) =>
    children(row, a, "tc"),
  );
  for (const row of cells) for (const cell of row) resetMerge(cell);
  for (const range of ranges) mergeRange(cells, range);
}

/** 原包结构适配；clearText 复用 cell codec 的保守正文校验与格式保留。 */
export function applyPresentationTableStructure(
  grid: Grid,
  edit: PresentationTableStructureEdit,
  clearText: (cell: Element) => void,
): void {
  if (edit.type === "resize-table") {
    resize(grid, edit);
    return;
  }
  const axis = edit.type.endsWith("rows") ? "row" : "column";
  const insert = edit.type.startsWith("insert-");
  const size = axis === "row" ? grid.rows : grid.columns;
  const count = edit.count === undefined ? 1 : edit.count;
  if (
    !Number.isInteger(edit.index) ||
    edit.index < 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    (insert
      ? edit.index > size || size + count > 100
      : edit.index + count > size || count >= size)
  )
    fail("table structure range");
  const { widths, heights } = tracks(grid);
  const { extent } = frameElements(grid);
  consistent(dimension(extent, "cx"), widths);
  consistent(dimension(extent, "cy"), heights);
  const merged = [...new Set(grid.owners.flat())]
    .filter((cell) => cell.rowCount > 1 || cell.columnCount > 1)
    .map(({ row, column, rowCount, columnCount }) => ({
      row,
      column,
      rowCount,
      columnCount,
    }))
    .map((range) => remapMerge(range, axis, edit.index, count, insert))
    .filter((range): range is PresentationTableRange => range !== null);
  if (insert) {
    if (axis === "row") insertRows(grid, edit.index, count, clearText);
    else insertColumns(grid, edit.index, count, clearText);
  } else if (axis === "row") {
    for (const row of grid.rowElements.slice(edit.index, edit.index + count))
      row.remove();
  } else {
    for (const column of grid.columnElements.slice(
      edit.index,
      edit.index + count,
    ))
      column.remove();
    for (const row of grid.cells)
      for (const cell of row.slice(edit.index, edit.index + count))
        cell.remove();
  }
  rebuildMerges(grid, merged);
  if (axis === "row")
    extent.setAttribute(
      "cy",
      String(
        sum(children(grid.table, a, "tr").map((row) => dimension(row, "h"))),
      ),
    );
  else {
    const parent = one(grid.table, a, "tblGrid")!;
    extent.setAttribute(
      "cx",
      String(
        sum(
          children(parent, a, "gridCol").map((column) =>
            dimension(column, "w"),
          ),
        ),
      ),
    );
  }
}
