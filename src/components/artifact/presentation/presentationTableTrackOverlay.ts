import type { TableNodeData } from "@aiden0z/pptx-renderer";
import type { PresentationController } from "./PresentationController";

export interface PresentationTableTrackTarget {
  axis: "row" | "column";
  index: number;
}

interface Options {
  mount: HTMLElement;
  controller: PresentationController;
  table: TableNodeData;
  scale: number;
  labels: {
    row: (index: number) => string;
    column: (index: number) => string;
    pixels: (size: number) => string;
  };
  onFocusRestore?: (target: PresentationTableTrackTarget) => void;
  measureMinimumRowHeights?: (options: {
    columnWidths: readonly number[];
    minimumRowHeight: number;
  }) => readonly number[] | null;
}

/** 父文档安装受限 iframe 的原生分隔条；仅 Controller 拥有编辑稿和历史。 */
export function installPresentationTableTrackOverlay({
  mount,
  controller,
  table,
  scale,
  labels,
  onFocusRestore,
  measureMinimumRowHeights,
}: Options): () => void {
  if (!Number.isFinite(scale) || scale <= 0) return () => {};
  const installed = controller.getSnapshot();
  const document = mount.ownerDocument;
  const handles: HTMLButtonElement[] = [];
  const current = () => {
    const state = controller.getSnapshot();
    const snapshot = controller.tableEditing.getSnapshot();
    return mount.isConnected &&
      state.isEditing &&
      !state.saving &&
      !state.projecting &&
      state.document === installed.document &&
      state.selectedSlideId === installed.selectedSlideId &&
      state.selectedElementIds.length === 1 &&
      !state.elementInteraction &&
      !state.selectionMarquee &&
      state.primarySelectedElementId === table.id &&
      snapshot?.tableId === table.id
      ? snapshot
      : null;
  };
  type Drag = {
    target: PresentationTableTrackTarget;
    handle: HTMLButtonElement;
    pointerId: number;
    x: number;
    y: number;
    size: number;
    minimum: number;
    boundary: number;
    candidate: number;
    tracks: string;
  };
  let drag: Drag | null = null;
  const signature = (snapshot: NonNullable<ReturnType<typeof current>>) =>
    JSON.stringify([
      snapshot.rowHeights,
      snapshot.columnWidths,
      snapshot.frame,
    ]);
  const value = (handle: HTMLButtonElement, size: number) => {
    handle.setAttribute("aria-valuenow", String(Math.round(size)));
    handle.setAttribute(
      "aria-valuemax",
      String(Math.max(10000, Math.round(size))),
    );
    handle.setAttribute("aria-valuetext", labels.pixels(Math.round(size)));
  };
  const position = (
    target: PresentationTableTrackTarget,
    handle: HTMLElement,
    boundary: number,
  ) => {
    handle.style[target.axis === "column" ? "left" : "top"] =
      `${boundary - 4}px`;
  };
  const finish = (commit: boolean) => {
    if (!drag) return;
    const ending = drag;
    drag = null;
    position(ending.target, ending.handle, ending.boundary);
    value(ending.handle, ending.size);
    delete ending.handle.dataset.resizing;
    if (ending.handle.hasPointerCapture?.(ending.pointerId))
      ending.handle.releasePointerCapture(ending.pointerId);
    const snapshot = current();
    if (
      commit &&
      snapshot &&
      signature(snapshot) === ending.tracks &&
      ending.candidate !== ending.size
    ) {
      if (
        controller.tableEditing.edit({
          type: ending.target.axis === "row" ? "resize-row" : "resize-column",
          tableId: table.id,
          index: ending.target.index,
          size: ending.candidate,
        })
      )
        onFocusRestore?.(ending.target);
    }
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const snapshot = current();
    if (!snapshot || signature(snapshot) !== drag.tracks) {
      finish(false);
      return;
    }
    const dx = (event.screenX - drag.x) / scale;
    const dy = (event.screenY - drag.y) / scale;
    const angle = (table.rotation * Math.PI) / 180;
    // mount 按 rotate * flip 变换；真实屏幕增量先逆旋转，再逆翻转。
    const delta =
      drag.target.axis === "column"
        ? (dx * Math.cos(angle) + dy * Math.sin(angle)) * (table.flipH ? -1 : 1)
        : (-dx * Math.sin(angle) + dy * Math.cos(angle)) *
          (table.flipV ? -1 : 1);
    drag.candidate = Math.max(drag.minimum, drag.size + delta);
    position(
      drag.target,
      drag.handle,
      drag.boundary + drag.candidate - drag.size,
    );
    value(drag.handle, drag.candidate);
    drag.handle.dataset.resizing = "true";
    event.preventDefault();
    event.stopPropagation();
  };
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    move(event);
    finish(true);
  };
  const cancel = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) finish(false);
  };
  const add = (
    axis: PresentationTableTrackTarget["axis"],
    sizes: readonly number[],
  ) => {
    let boundary = 0;
    sizes.forEach((size, index) => {
      boundary += size;
      const initialBoundary = boundary;
      const target = { axis, index };
      const handle = document.createElement("button");
      handle.type = "button";
      handle.dataset.presentationTrack = `${axis}:${index}`;
      handle.dataset.pointerResize =
        axis === "column" || measureMinimumRowHeights
          ? "available"
          : "unavailable";
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-label", labels[axis](index));
      handle.setAttribute(
        "aria-orientation",
        axis === "column" ? "vertical" : "horizontal",
      );
      handle.setAttribute("aria-valuemin", axis === "column" ? "24" : "20");
      value(handle, size);
      Object.assign(handle.style, {
        position: "absolute",
        zIndex: "2",
        padding: "0",
        border: "0",
        background: "transparent",
        pointerEvents: "auto",
        touchAction: "none",
        cursor:
          axis === "column"
            ? "col-resize"
            : measureMinimumRowHeights
              ? "row-resize"
              : "default",
        ...(axis === "column"
          ? { top: "0", width: "8px", height: `${table.size.h}px` }
          : { left: "0", height: "8px", width: `${table.size.w}px` }),
      });
      position(target, handle, initialBoundary);
      const marker = document.createElement("span");
      marker.setAttribute("aria-hidden", "true");
      Object.assign(marker.style, {
        position: "absolute",
        pointerEvents: "none",
        background: "Highlight",
        opacity: "0",
        ...(axis === "column"
          ? { left: "3px", top: "0", width: "2px", height: "100%" }
          : { top: "3px", left: "0", height: "2px", width: "100%" }),
      });
      handle.append(marker);
      handle.addEventListener("focus", () => {
        marker.style.opacity = "1";
      });
      handle.addEventListener("blur", () => {
        marker.style.opacity = "0";
      });
      handle.addEventListener("pointerenter", () => {
        marker.style.opacity = "1";
      });
      handle.addEventListener("pointerleave", () => {
        if (document.activeElement !== handle) marker.style.opacity = "0";
      });
      handle.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        const increase =
          event.key === (axis === "column" ? "ArrowRight" : "ArrowDown");
        const decrease =
          event.key === (axis === "column" ? "ArrowLeft" : "ArrowUp");
        if (!increase && !decrease) return;
        event.preventDefault();
        event.stopPropagation();
        if (drag) return;
        const snapshot = current();
        if (!snapshot) return;
        const currentSize = (
          axis === "column" ? snapshot.columnWidths : snapshot.rowHeights
        )[index];
        const next = Math.max(
          axis === "column" ? 24 : 20,
          currentSize + (increase ? 1 : -1) * (event.shiftKey ? 10 : 1),
        );
        if (
          next !== currentSize &&
          controller.tableEditing.edit({
            type: axis === "row" ? "resize-row" : "resize-column",
            tableId: table.id,
            index,
            size: next,
          })
        )
          onFocusRestore?.(target);
      });
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || drag) return;
        event.preventDefault();
        event.stopPropagation();
        const snapshot = current();
        if (!snapshot) return;
        handle.focus();
        let minimum = axis === "column" ? 24 : 20;
        if (axis === "row") {
          // 完整行内容测量属于 current renderer；没有可信测量时禁止伪拖动。
          const heights = measureMinimumRowHeights?.({
            columnWidths: snapshot.columnWidths,
            minimumRowHeight: 20,
          });
          if (
            !heights ||
            heights.length !== snapshot.rowCount ||
            heights.some((height) => !Number.isFinite(height) || height < 20)
          )
            return;
          minimum = Math.max(20, heights[index]);
        }
        const sizes =
          axis === "column" ? snapshot.columnWidths : snapshot.rowHeights;
        const size = sizes[index];
        if (!Number.isFinite(size)) return;
        drag = {
          target,
          handle,
          pointerId: event.pointerId,
          x: event.screenX,
          y: event.screenY,
          size,
          minimum,
          boundary: initialBoundary,
          candidate: size,
          tracks: signature(snapshot),
        };
        handle.setPointerCapture?.(event.pointerId);
      });
      handle.addEventListener("lostpointercapture", cancel);
      mount.append(handle);
      handles.push(handle);
    });
  };
  add("column", table.columns);
  add(
    "row",
    table.rows.map((row) => row.height),
  );
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", cancel, true);
  return () => {
    finish(false);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", cancel, true);
    handles.forEach((handle) => handle.remove());
  };
}
