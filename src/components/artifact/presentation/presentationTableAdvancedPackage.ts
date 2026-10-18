import { fail } from "./presentationPackageXml";
import {
  validateTableRange,
  type Grid,
  type PresentationTableRange,
} from "./presentationTableGrid";
import {
  dimension,
  emu,
  sum,
  tracks,
  frameElements,
  consistent,
} from "./presentationTableDimensions";
import { resetMerge, mergeRange } from "./presentationTableMerges";
import { presentationTableMove } from "./presentationTableMove";

type Identity = { slideId: string; tableId: string };
type Move = { index: number; count?: number; insertionIndex: number };
export type PresentationTableAdvancedEdit = Identity &
  (
    | ({ type: "move-row" } & Move)
    | ({ type: "move-column" } & Move)
    | { type: "merge-cells"; range: PresentationTableRange }
    | { type: "unmerge-cells"; range: PresentationTableRange }
    | {
        type: "resize-row";
        index: number;
        size: number;
        rowHeights?: readonly number[];
      }
    | {
        type: "resize-column";
        index: number;
        size: number;
        columnWidths?: readonly number[];
      }
    | { type: "distribute-rows"; range: PresentationTableRange }
    | { type: "distribute-columns"; range: PresentationTableRange }
  );

type Axis = "row" | "column";
type MoveEdit = Extract<
  PresentationTableAdvancedEdit,
  { type: "move-row" | "move-column" }
>;

function geometry(grid: Grid) {
  const dimensions = tracks(grid);
  const { extent } = frameElements(grid);
  consistent(dimension(extent, "cx"), dimensions.widths);
  consistent(dimension(extent, "cy"), dimensions.heights);
  return { ...dimensions, extent };
}

/** 按原槽位重排 DOM；未知兄弟节点保持原位，不复制任何身份或 relationship。 */
function reorder(elements: readonly Element[], order: readonly number[]) {
  const slots = elements.map((element) => {
    const slot = element.ownerDocument.createComment("table-track");
    element.parentNode!.insertBefore(slot, element);
    return slot;
  });
  for (let index = 0; index < slots.length; index++) {
    slots[index].parentNode!.insertBefore(elements[order[index]], slots[index]);
    slots[index].remove();
  }
}

function move(grid: Grid, edit: MoveEdit): boolean {
  const axis = edit.type === "move-row" ? "row" : "column";
  const length = axis === "row" ? grid.rows : grid.columns;
  const result = presentationTableMove({
    length,
    ...edit,
    spans: [...new Set(grid.owners.flat())].map((owner) => ({
      index: owner[axis],
      count: axis === "row" ? owner.rowCount : owner.columnCount,
    })),
  });
  if (result.kind === "invalid")
    fail(
      result.reason === "merged"
        ? "table move would split a merged cell"
        : "table move range",
    );
  if (result.kind === "unchanged") return false;
  const { order } = result;
  const { heights, extent } = geometry(grid);
  if (axis === "row") {
    reorder(grid.rowElements, order);
    extent.setAttribute("cy", String(sum(heights)));
  } else {
    reorder(grid.columnElements, order);
    for (const row of grid.cells) reorder(row, order);
  }
  return true;
}

function unmerge(grid: Grid, range: PresentationTableRange): boolean {
  const targets = new Set(
    grid.owners
      .slice(range.row, range.row + range.rowCount)
      .flatMap((row) =>
        row.slice(range.column, range.column + range.columnCount),
      ),
  );
  let changed = false;
  for (const owner of targets) {
    if (owner.rowCount === 1 && owner.columnCount === 1) continue;
    for (let row = owner.row; row < owner.row + owner.rowCount; row++)
      for (
        let column = owner.column;
        column < owner.column + owner.columnCount;
        column++
      )
        resetMerge(grid.cells[row][column]);
    changed = true;
  }
  return changed;
}

function writeTracks(
  grid: Grid,
  axis: Axis,
  dimensions: readonly number[],
  extent: Element,
) {
  const elements = axis === "row" ? grid.rowElements : grid.columnElements;
  elements.forEach((element, index) =>
    element.setAttribute(axis === "row" ? "h" : "w", String(dimensions[index])),
  );
  extent.setAttribute(axis === "row" ? "cy" : "cx", String(sum(dimensions)));
}

function resizeTrack(
  grid: Grid,
  edit: Extract<
    PresentationTableAdvancedEdit,
    { type: "resize-row" | "resize-column" }
  >,
) {
  const axis = edit.type === "resize-row" ? "row" : "column";
  const length = axis === "row" ? grid.rows : grid.columns;
  if (
    !Number.isInteger(edit.index) ||
    edit.index < 0 ||
    edit.index >= length ||
    !Number.isFinite(edit.size) ||
    edit.size < 16
  )
    fail("table track resize");
  const supplied =
    edit.type === "resize-row" ? edit.rowHeights : edit.columnWidths;
  if (
    supplied !== undefined &&
    (!Array.isArray(supplied) || supplied.length !== length)
  )
    fail("table track resize dimensions");
  const { heights, widths, extent } = geometry(grid);
  const dimensions =
    supplied === undefined
      ? axis === "row"
        ? heights
        : widths
      : Array.from(supplied, (value) => emu(value, true));
  dimensions[edit.index] = emu(edit.size, true);
  // 先验证总和，避免超出安全 EMU 范围时写入局部状态。
  sum(dimensions);
  writeTracks(grid, axis, dimensions, extent);
}

function distribute(
  grid: Grid,
  edit: Extract<
    PresentationTableAdvancedEdit,
    { type: "distribute-rows" | "distribute-columns" }
  >,
) {
  validateTableRange(grid, edit.range);
  const axis = edit.type === "distribute-rows" ? "row" : "column";
  const { heights, widths, extent } = geometry(grid);
  const dimensions = axis === "row" ? heights : widths;
  const start = edit.range[axis];
  const count = axis === "row" ? edit.range.rowCount : edit.range.columnCount;
  const total = sum(dimensions.slice(start, start + count));
  const equal = Math.floor(total / count),
    remainder = total % count;
  // OOXML 只能存整数 EMU；余数逐轨分配，区间总和不变且任意两轨相差至多1 EMU。
  for (let offset = 0; offset < count; offset++)
    dimensions[start + offset] = equal + (offset < remainder ? 1 : 0);
  writeTracks(grid, axis, dimensions, extent);
}

/** 八种原包动作复用已验证格网；返回 false 时调用者保留原包字节。 */
export function applyPresentationTableAdvanced(
  grid: Grid,
  edit: PresentationTableAdvancedEdit,
): boolean {
  switch (edit.type) {
    case "move-row":
    case "move-column":
      return move(grid, edit);
    case "merge-cells":
    case "unmerge-cells": {
      validateTableRange(grid, edit.range);
      const changed = unmerge(grid, edit.range);
      if (edit.type === "unmerge-cells") return changed;
      mergeRange(grid.cells, edit.range);
      return true;
    }
    case "resize-row":
    case "resize-column":
      resizeTrack(grid, edit);
      return true;
    case "distribute-rows":
    case "distribute-columns":
      distribute(grid, edit);
      return true;
  }
}
