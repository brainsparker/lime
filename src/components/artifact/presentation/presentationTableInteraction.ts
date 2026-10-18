import type { TableNodeData } from "@aiden0z/pptx-renderer";
import {
  presentationTableCells,
  presentationTableCellAt,
  type PresentationTableInteraction,
  type PresentationTableSelection,
} from "./presentationTableSelection";
import { presentationTableMove } from "./presentationTableMove";

/** 输入命中与导航只返回意图，历史与原包修改仍由同一Controller执行。 */
export function presentationTableInteraction(
  table: TableNodeData,
  currentSelection: PresentationTableSelection | null,
  interaction: PresentationTableInteraction,
): {
  selection: PresentationTableSelection;
  appendRow?: number;
  move?: { axis: "row" | "column"; index: number; insertionIndex: number };
} | null {
  const cells = presentationTableCells(table);
  if (!cells?.length) return null;
  const selection =
    currentSelection?.tableId === table.id ? currentSelection : null;
  let anchor = selection?.anchor ?? cells[0],
    focus = selection?.focus ?? cells[0];
  if (interaction.type === "reorder") {
    const { axis, index, insertionIndex } = interaction;
    const result = presentationTableMove({
      length: axis === "row" ? table.rows.length : table.columns.length,
      index,
      insertionIndex,
      spans: cells.map((cell) => ({
        index: cell[axis],
        count: axis === "row" ? cell.rowSpan : cell.columnSpan,
      })),
    });
    if (result.kind !== "move") return null;
    return {
      selection: trackSelection(table, axis, result.destination),
      move: { axis, index, insertionIndex },
    };
  }
  if (interaction.type === "select-all") {
    anchor = cells[0];
    focus = cells.at(-1)!;
  } else if (interaction.type === "pointer-down") {
    const target = interaction.target;
    if (target.kind === "row" || target.kind === "column") {
      const length =
        target.kind === "row" ? table.rows.length : table.columns.length;
      if (
        !Number.isInteger(target.index) ||
        target.index < 0 ||
        target.index >= length
      )
        return null;
      return {
        selection: trackSelection(
          table,
          target.kind,
          target.index,
          interaction.shiftKey ? selection?.anchor[target.kind] : undefined,
        ),
      };
    }
    if (
      !Number.isFinite(interaction.point.x) ||
      !Number.isFinite(interaction.point.y)
    )
      return null;
    const dx = interaction.point.x - table.position.x - table.size.w / 2,
      dy = interaction.point.y - table.position.y - table.size.h / 2,
      angle = (-table.rotation * Math.PI) / 180;
    let x = dx * Math.cos(angle) - dy * Math.sin(angle) + table.size.w / 2,
      y = dx * Math.sin(angle) + dy * Math.cos(angle) + table.size.h / 2;
    if (table.flipH) x = table.size.w - x;
    if (table.flipV) y = table.size.h - y;
    const cell = cells.find(
      ({ frame }) =>
        x >= frame.x &&
        y >= frame.y &&
        x < frame.x + frame.width &&
        y < frame.y + frame.height,
    );
    if (!cell) return null;
    focus = cell;
    if (!interaction.shiftKey || !selection) anchor = cell;
  } else {
    const current = presentationTableCellAt(cells, focus) ?? cells[0];
    const direction = interaction.direction;
    let cell;
    if (direction === "next" || direction === "previous")
      cell = cells[cells.indexOf(current) + (direction === "next" ? 1 : -1)];
    else
      cell = presentationTableCellAt(cells, {
        row:
          current.row +
          (direction === "down"
            ? current.rowSpan
            : direction === "up"
              ? -1
              : 0),
        column:
          current.column +
          (direction === "right"
            ? current.columnSpan
            : direction === "left"
              ? -1
              : 0),
      });
    if (!selection) cell = cells[0];
    if (!cell && direction === "next" && selection && table.rows.length < 100) {
      const position = { row: table.rows.length, column: 0 };
      return {
        selection: { tableId: table.id, anchor: position, focus: position },
        appendRow: table.rows.length,
      };
    }
    if (!cell) return null;
    focus = cell;
    if (!interaction.extend) anchor = cell;
  }

  return {
    selection: {
      tableId: table.id,
      anchor: { row: anchor.row, column: anchor.column },
      focus: { row: focus.row, column: focus.column },
    },
  };
}

function trackSelection(
  table: TableNodeData,
  axis: "row" | "column",
  index: number,
  anchor = index,
): PresentationTableSelection {
  return {
    tableId: table.id,
    anchor:
      axis === "row" ? { row: anchor, column: 0 } : { row: 0, column: anchor },
    focus:
      axis === "row"
        ? { row: index, column: table.columns.length - 1 }
        : { row: table.rows.length - 1, column: index },
  };
}

export function clampPresentationTableSelection(
  table: TableNodeData,
  selection: PresentationTableSelection | null,
): PresentationTableSelection | null {
  if (
    !selection ||
    selection.tableId !== table.id ||
    !table.rows.length ||
    !table.columns.length
  )
    return null;
  const clamp = (point: { row: number; column: number }) => ({
    row: Math.min(Math.max(0, point.row), table.rows.length - 1),
    column: Math.min(Math.max(0, point.column), table.columns.length - 1),
  });
  return {
    tableId: table.id,
    anchor: clamp(selection.anchor),
    focus: clamp(selection.focus),
  };
}
