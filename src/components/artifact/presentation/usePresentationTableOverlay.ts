import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  PresentationController,
  PresentationControllerState,
} from "./PresentationController";
import { presentationElements } from "./presentationElements";
import { presentationTableCells } from "./presentationTableSelection";
import { installPresentationTableTrackOverlay } from "./presentationTableTrackOverlay";
import {
  findPresentationTableElement,
  measurePresentationTableRows,
} from "./presentationTableMeasure";
import { installPresentationTableReorderOverlay } from "./presentationTableReorderOverlay";

function columnLabel(index: number) {
  let value = "";
  for (
    let column = index + 1;
    column > 0;
    column = Math.floor((column - 1) / 26)
  )
    value = String.fromCharCode(65 + ((column - 1) % 26)) + value;
  return value;
}

export function handlePresentationHistoryKey(
  event: KeyboardEvent,
  controller: PresentationController,
) {
  if (event.isComposing || !(event.metaKey || event.ctrlKey)) return false;
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    void controller.flushPublicFile();
    return true;
  }
  if (event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) controller.redo();
    else controller.undo();
    return true;
  }
  return false;
}

/** 单元格覆盖层只投递 current Controller 动作，原包格网仍是编辑目标。 */
export function usePresentationTableOverlay(
  slide: HTMLElement | null,
  controller?: PresentationController,
  state?: PresentationControllerState,
  scale = 1,
) {
  const { t } = useTranslation("workspace");
  const restoreFocus = useRef<string | null>(null);
  const document = state?.document,
    slideId = state?.selectedSlideId,
    tableId =
      state?.selectedElementIds.length === 1
        ? state.primarySelectedElementId
        : null,
    selection = state?.tableSelection,
    editing =
      state?.isEditing && !state.elementInteraction && !state.selectionMarquee;
  useEffect(() => {
    if (!slide?.isConnected || !controller || !document || !slideId || !editing)
      return;
    const table = presentationElements(document, slideId).find(
      (element) => element.id === tableId,
    );
    if (table?.nodeType !== "table") return;
    const cells = presentationTableCells(table);
    if (!cells) return;
    const mount = slide.ownerDocument.createElement("div");
    mount.dataset.presentationTableId = table.id;
    Object.assign(mount.style, {
      position: "absolute",
      left: `${table.position.x}px`,
      top: `${table.position.y}px`,
      width: `${table.size.w}px`,
      height: `${table.size.h}px`,
      transform: `rotate(${table.rotation}deg) scaleX(${table.flipH ? -1 : 1}) scaleY(${table.flipV ? -1 : 1})`,
      zIndex: "81",
      pointerEvents: "none",
    });
    for (const cell of cells) {
      const button = slide.ownerDocument.createElement("button");
      button.type = "button";
      button.dataset.presentationCell = `${cell.row}:${cell.column}`;
      button.setAttribute(
        "aria-label",
        t("workspace.presentationTable.cell", {
          row: cell.row + 1,
          column: cell.column + 1,
        }),
      );
      button.setAttribute("aria-pressed", "false");
      Object.assign(button.style, {
        position: "absolute",
        left: `${cell.frame.x}px`,
        top: `${cell.frame.y}px`,
        width: `${cell.frame.width}px`,
        height: `${cell.frame.height}px`,
        background: "transparent",
        border: "1px solid transparent",
        padding: "0",
        pointerEvents: "auto",
        cursor: "text",
      });
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        let x = cell.frame.x + cell.frame.width / 2 - table.size.w / 2,
          y = cell.frame.y + cell.frame.height / 2 - table.size.h / 2;
        if (table.flipH) x = -x;
        if (table.flipV) y = -y;
        const angle = (table.rotation * Math.PI) / 180;
        if (
          controller.tableEditing.interact({
            type: "pointer-down",
            tableId: table.id,
            target: { kind: "cell" },
            shiftKey: event.shiftKey,
            point: {
              x:
                table.position.x +
                table.size.w / 2 +
                x * Math.cos(angle) -
                y * Math.sin(angle),
              y:
                table.position.y +
                table.size.h / 2 +
                x * Math.sin(angle) +
                y * Math.cos(angle),
            },
          })
        ) {
          // 对象交互曾显式取得焦点，进入格选区时必须交还给真实单元格。
          event.preventDefault();
          event.stopPropagation();
          restoreFocus.current = null;
          button.focus({ preventScroll: true });
        }
      });
      button.addEventListener("dblclick", () =>
        controller.textActivateBlockEnd({
          tableId: table.id,
          row: cell.row,
          column: cell.column,
        }),
      );
      button.addEventListener("keydown", (event) => {
        if (
          event.isComposing ||
          handlePresentationHistoryKey(event, controller)
        )
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          controller.setSelectedElementId(table.id);
          return;
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "a"
        ) {
          event.preventDefault();
          controller.tableEditing.interact({
            type: "select-all",
            tableId: table.id,
          });
          return;
        }
        const snapshot = controller.tableEditing.getSnapshot();
        if (
          (event.key === "Enter" || event.key === "F2") &&
          snapshot?.activeCell
        ) {
          event.preventDefault();
          controller.textActivateBlockEnd({
            tableId: table.id,
            ...snapshot.activeCell,
          });
          return;
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          snapshot?.selection
        ) {
          event.preventDefault();
          controller.tableEditing.edit({
            type: "clear-cells",
            tableId: table.id,
            range: snapshot.selection.range,
          });
          return;
        }
        const direction = (
          {
            ArrowLeft: "left",
            ArrowRight: "right",
            ArrowUp: "up",
            ArrowDown: "down",
            Tab: event.shiftKey ? "previous" : "next",
          } as const
        )[
          event.key as
            | "ArrowLeft"
            | "ArrowRight"
            | "ArrowUp"
            | "ArrowDown"
            | "Tab"
        ];
        if (direction && !(event.metaKey || event.ctrlKey || event.altKey)) {
          event.preventDefault();
          controller.tableEditing.interact({
            type: "navigate",
            tableId: table.id,
            direction,
            extend: event.key !== "Tab" && event.shiftKey,
          });
          // React 重建选区覆盖层后再恢复到真实活动格。
          restoreFocus.current = "active";
        }
      });
      mount.append(button);
    }
    mount.addEventListener("keydown", (event) => {
      const target = event.target as HTMLElement;
      if (
        target.dataset.presentationTrack ||
        target.dataset.presentationReorder
      )
        handlePresentationHistoryKey(event, controller);
    });
    slide.append(mount);
    const renderedTable = findPresentationTableElement(slide, table);
    const disposeTracks = installPresentationTableTrackOverlay({
      mount,
      controller,
      table,
      scale,
      labels: {
        row: (index) =>
          t("workspace.presentationTable.rowHeight", { row: index + 1 }),
        column: (index) =>
          t("workspace.presentationTable.columnWidth", {
            column: columnLabel(index),
          }),
        pixels: (size) => t("workspace.presentationTable.pixels", { size }),
      },
      onFocusRestore: ({ axis, index }) => {
        restoreFocus.current = `track:${axis}:${index}`;
      },
      measureMinimumRowHeights: renderedTable
        ? ({ columnWidths, minimumRowHeight }) => {
            const measured = measurePresentationTableRows({
              table,
              element: renderedTable,
              columnWidths,
              minimumRowHeight,
            });
            return measured.status === "ready" ? measured.rowHeights : null;
          }
        : undefined,
    });
    const disposeReorder = installPresentationTableReorderOverlay({
      mount,
      controller,
      table,
      scale,
      labels: {
        row: (index) =>
          t("workspace.presentationTable.reorderRow", { row: index + 1 }),
        column: (index) =>
          t("workspace.presentationTable.reorderColumn", {
            column: columnLabel(index),
          }),
        hint: t("workspace.presentationTable.reorderHint"),
      },
      onFocusRestore: ({ axis, index }) => {
        restoreFocus.current = `reorder:${axis}:${index}`;
      },
    });
    const unsubscribe = controller.subscribe(() => {
      const next = controller.getSnapshot();
      if (
        restoreFocus.current ||
        !next.isEditing ||
        next.selectedSlideId !== slideId ||
        next.selectedElementIds.length !== 1 ||
        next.primarySelectedElementId !== table.id ||
        (!next.projecting && !next.saving && next.document === document)
      )
        return;
      const active = slide.ownerDocument.activeElement as HTMLElement | null;
      if (!active || !mount.contains(active)) return;
      if (active.dataset.presentationTrack)
        restoreFocus.current = `track:${active.dataset.presentationTrack}`;
      else if (active.dataset.presentationReorder)
        restoreFocus.current = `reorder:${active.dataset.presentationReorder}`;
      else if (active.dataset.presentationCell)
        restoreFocus.current = active.dataset.presentationCell;
    });
    return () => {
      unsubscribe();
      const active = slide.ownerDocument.activeElement as HTMLElement | null;
      if (
        active &&
        mount.contains(active) &&
        restoreFocus.current !== "active"
      ) {
        if (active.dataset.presentationTrack)
          restoreFocus.current = `track:${active.dataset.presentationTrack}`;
        else if (
          active.dataset.presentationReorder &&
          !restoreFocus.current?.startsWith("reorder:")
        )
          restoreFocus.current = `reorder:${active.dataset.presentationReorder}`;
        else if (active.dataset.presentationCell)
          restoreFocus.current = active.dataset.presentationCell;
      }
      disposeTracks();
      disposeReorder();
      mount.remove();
    };
  }, [slide, controller, document, slideId, tableId, editing, scale, t]);
  useEffect(() => {
    if (!slide || !controller) return;
    const snapshot = controller.tableEditing.getSnapshot();
    const range = snapshot?.selection?.range;
    const focusTarget =
      restoreFocus.current === "active" && snapshot?.activeCell
        ? `${snapshot.activeCell.row}:${snapshot.activeCell.column}`
        : restoreFocus.current;
    if (
      focusTarget?.startsWith("track:") ||
      focusTarget?.startsWith("reorder:")
    ) {
      const [kind, axis, index] = focusTarget.split(":");
      const track = slide.querySelector<HTMLElement>(
        `[data-presentation-${kind}="${axis}:${index}"]`,
      );
      if (track) {
        track.focus();
        restoreFocus.current = null;
      }
    }
    for (const button of slide.querySelectorAll<HTMLButtonElement>(
      "[data-presentation-cell]",
    )) {
      const [row, column] = button.dataset
        .presentationCell!.split(":")
        .map(Number);
      const selected =
        !!range &&
        row >= range.row &&
        row < range.row + range.rowCount &&
        column >= range.column &&
        column < range.column + range.columnCount;
      button.setAttribute("aria-pressed", String(selected));
      button.style.border = selected
        ? "2px solid Highlight"
        : "1px solid transparent";
      button.style.background = selected
        ? "color-mix(in srgb, Highlight 12%, transparent)"
        : "transparent";
      if (button.dataset.presentationCell === focusTarget) {
        button.focus();
        restoreFocus.current = null;
      }
    }
  }, [slide, controller, document, selection]);
}
