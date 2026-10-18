import type { TableNodeData } from "@aiden0z/pptx-renderer";
import type { PresentationController } from "./PresentationController";
import { presentationTableCells } from "./presentationTableSelection";
import { presentationTableMove } from "./presentationTableMove";

export interface PresentationTableReorderTarget {
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
    hint: string;
  };
  onFocusRestore?: (target: PresentationTableReorderTarget) => void;
}

/** 原生 grip 只产生重排意图；Controller 与原包 owner 共享合并连续性约束和历史。 */
export function installPresentationTableReorderOverlay({
  mount,
  controller,
  table,
  scale,
  labels,
  onFocusRestore,
}: Options): () => void {
  const cells = presentationTableCells(table);
  if (!cells || !Number.isFinite(scale) || scale <= 0) return () => {};
  const document = mount.ownerDocument;
  const installed = controller.getSnapshot();
  const handles: HTMLButtonElement[] = [];
  const bridges: HTMLElement[] = [];
  let hovered: { row: number; column: number } | null = null;
  let disposed = false;
  const current = (displayOnly = false) => {
    const state = controller.getSnapshot();
    const snapshot = controller.tableEditing.getSnapshot();
    return !disposed &&
      mount.isConnected &&
      state.isEditing &&
      (displayOnly || (!state.saving && !state.projecting)) &&
      !state.elementInteraction &&
      !state.selectionMarquee &&
      state.document === installed.document &&
      state.selectedSlideId === installed.selectedSlideId &&
      state.selectedElementIds.length === 1 &&
      state.primarySelectedElementId === table.id &&
      snapshot?.tableId === table.id
      ? snapshot
      : null;
  };
  const signature = (snapshot: NonNullable<ReturnType<typeof current>>) =>
    JSON.stringify([
      snapshot.rowHeights,
      snapshot.columnWidths,
      snapshot.frame,
    ]);
  const tracks = {
    row: table.rows.map((row) => row.height),
    column: table.columns,
  };
  const offsets = {
    row: [0],
    column: [0],
  };
  for (const axis of ["row", "column"] as const)
    for (const size of tracks[axis])
      offsets[axis].push(offsets[axis].at(-1)! + size);
  const preflight = (
    { axis, index }: PresentationTableReorderTarget,
    insertionIndex: number,
  ) =>
    presentationTableMove({
      length: tracks[axis].length,
      index,
      insertionIndex,
      spans: cells.map((cell) => ({
        index: cell[axis],
        count: axis === "row" ? cell.rowSpan : cell.columnSpan,
      })),
    });
  type Drag = {
    target: PresentationTableReorderTarget;
    handle: HTMLButtonElement;
    pointerId: number;
    x: number;
    y: number;
    start: number;
    signature: string;
    moved: boolean;
    insertionIndex: number;
    valid: boolean;
  };
  let drag: Drag | null = null;
  const guide = document.createElement("div");
  guide.setAttribute("aria-hidden", "true");
  guide.hidden = true;
  Object.assign(guide.style, {
    position: "absolute",
    zIndex: "3",
    pointerEvents: "none",
    borderRadius: "999px",
    background: "Highlight",
  });
  mount.append(guide);
  const update = () => {
    // 保存/投影期间保留可见 grip 和焦点，动作仍由 current() 的忙碌守卫拒绝。
    const snapshot = current(true);
    for (const handle of handles) {
      const [axis, raw] = handle.dataset.presentationReorder!.split(":") as [
        "row" | "column",
        string,
      ];
      const index = Number(raw);
      const selection = snapshot?.selection;
      const selected =
        selection &&
        (axis === "row"
          ? selection.range.columnCount === snapshot.columnCount
          : selection.range.rowCount === snapshot.rowCount)
          ? selection.focus[axis]
          : undefined;
      const visible =
        hovered?.[axis] ?? snapshot?.activeCell?.[axis] ?? selected;
      const active = document.activeElement === handle;
      const moving = drag?.target.axis === axis && drag.target.index === index;
      handle.hidden =
        !snapshot ||
        !(index === visible || index === selected || active || moving);
      handle.style.display = handle.hidden ? "none" : "flex";
      handle.setAttribute("aria-pressed", String(index === selected));
      const emphasized =
        active ||
        moving ||
        index === selected ||
        handle.dataset.hovered === "true";
      const marker = handle.firstElementChild as HTMLElement;
      marker.style.width = emphasized || axis === "column" ? "20px" : "7px";
      marker.style.height = emphasized || axis === "row" ? "20px" : "7px";
      marker.style.borderRadius = emphasized ? "6px" : "5px";
      (marker.firstElementChild as SVGElement).style.visibility = emphasized
        ? "visible"
        : "hidden";
    }
    for (const bridge of bridges)
      bridge.hidden = !snapshot || !(hovered ?? snapshot.activeCell) || !!drag;
  };
  const finish = (commit: boolean) => {
    if (!drag) return;
    const ending = drag;
    drag = null;
    guide.hidden = true;
    delete guide.dataset.valid;
    delete guide.dataset.insertionIndex;
    delete ending.handle.dataset.reordering;
    delete ending.handle.dataset.reorderValid;
    ending.handle.style.cursor = "grab";
    if (ending.handle.hasPointerCapture?.(ending.pointerId))
      ending.handle.releasePointerCapture(ending.pointerId);
    const snapshot = current();
    if (
      commit &&
      ending.moved &&
      ending.valid &&
      snapshot &&
      signature(snapshot) === ending.signature
    ) {
      const result = preflight(ending.target, ending.insertionIndex);
      if (
        result.kind === "move" &&
        controller.tableEditing.interact({
          type: "reorder",
          tableId: table.id,
          ...ending.target,
          insertionIndex: ending.insertionIndex,
        })
      )
        onFocusRestore?.({
          axis: ending.target.axis,
          index: result.destination,
        });
    }
    update();
  };
  const inverse = (dx: number, dy: number) => {
    const angle = (table.rotation * Math.PI) / 180;
    return {
      column:
        ((dx * Math.cos(angle) + dy * Math.sin(angle)) / scale) *
        (table.flipH ? -1 : 1),
      row:
        ((-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale) *
        (table.flipV ? -1 : 1),
    };
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const snapshot = current();
    if (!snapshot || signature(snapshot) !== drag.signature) {
      finish(false);
      return;
    }
    const delta = inverse(event.screenX - drag.x, event.screenY - drag.y);
    if (Math.hypot(delta.row, delta.column) > 3) drag.moved = true;
    if (!drag.moved) return;
    const axis = drag.target.axis;
    const position = drag.start + delta[axis];
    const insertionIndex = tracks[axis].findIndex(
      (size, index) => position < offsets[axis][index] + size / 2,
    );
    drag.insertionIndex =
      insertionIndex < 0 ? tracks[axis].length : insertionIndex;
    drag.valid = preflight(drag.target, drag.insertionIndex).kind !== "invalid";
    drag.handle.dataset.reordering = "true";
    drag.handle.dataset.reorderValid = String(drag.valid);
    drag.handle.style.cursor = drag.valid ? "grabbing" : "not-allowed";
    guide.dataset.presentationReorderGuide = axis;
    guide.dataset.valid = String(drag.valid);
    guide.dataset.insertionIndex = String(drag.insertionIndex);
    guide.hidden = !drag.valid;
    Object.assign(
      guide.style,
      axis === "column"
        ? {
            left: `${offsets.column[drag.insertionIndex] - 1}px`,
            top: "0",
            width: "2px",
            height: `${table.size.h}px`,
          }
        : {
            left: "0",
            top: `${offsets.row[drag.insertionIndex] - 1}px`,
            height: "2px",
            width: `${table.size.w}px`,
          },
    );
    event.preventDefault();
    event.stopPropagation();
    update();
  };
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    move(event);
    event.preventDefault();
    event.stopPropagation();
    finish(true);
  };
  const cancel = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finish(false);
  };
  const escape = (event: KeyboardEvent) => {
    if (!drag || event.key !== "Escape" || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    finish(false);
  };
  const select = (target: PresentationTableReorderTarget, shiftKey = false) =>
    controller.tableEditing.interact({
      type: "pointer-down",
      tableId: table.id,
      target: { kind: target.axis, index: target.index },
      point: { x: table.position.x, y: table.position.y },
      shiftKey,
    });
  for (const axis of ["column", "row"] as const) {
    const bridge = document.createElement("div");
    bridge.dataset.presentationReorderBridge = axis;
    bridge.setAttribute("aria-hidden", "true");
    Object.assign(bridge.style, {
      position: "absolute",
      zIndex: "1",
      pointerEvents: "auto",
      ...(axis === "column"
        ? {
            left: "-24px",
            top: "-24px",
            width: "calc(100% + 24px)",
            height: "24px",
          }
        : { left: "-24px", top: "0", width: "24px", height: "100%" }),
    });
    for (const type of ["pointerdown", "pointermove"])
      bridge.addEventListener(type, (event) => event.stopPropagation());
    mount.append(bridge);
    bridges.push(bridge);
    tracks[axis].forEach((size, index) => {
      const target = { axis, index };
      const handle = document.createElement("button");
      handle.type = "button";
      handle.dataset.presentationReorder = `${axis}:${index}`;
      handle.setAttribute("aria-label", labels[axis](index));
      handle.title = labels.hint;
      Object.assign(handle.style, {
        position: "absolute",
        zIndex: "4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        touchAction: "none",
        width: "24px",
        height: "24px",
        padding: "0",
        border: "0",
        background: "transparent",
        cursor: "grab",
        borderRadius: "6px",
        outlineOffset: "2px",
        ...(axis === "column"
          ? { left: `${offsets.column[index] + size / 2 - 12}px`, top: "-12px" }
          : { left: "-12px", top: `${offsets.row[index] + size / 2 - 12}px` }),
      });
      const marker = document.createElement("span");
      marker.setAttribute("aria-hidden", "true");
      Object.assign(marker.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        background: "Highlight",
        border: "2px solid white",
        boxShadow: "0 0 0 1px rgba(255,255,255,.65)",
        boxSizing: "border-box",
      });
      const icon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      icon.setAttribute("width", "12");
      icon.setAttribute("height", "12");
      icon.setAttribute("viewBox", "0 0 12 12");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute(
        "d",
        axis === "column" ? "M3 5h6M3 7h6" : "M5 3v6M7 3v6",
      );
      path.setAttribute("stroke", "white");
      path.setAttribute("stroke-width", "1");
      path.setAttribute("stroke-linecap", "round");
      icon.append(path);
      marker.append(icon);
      handle.append(marker);
      handle.addEventListener("focus", update);
      handle.addEventListener("blur", update);
      handle.addEventListener("pointerenter", () => {
        handle.dataset.hovered = "true";
        update();
      });
      handle.addEventListener("pointerleave", () => {
        delete handle.dataset.hovered;
        update();
      });
      handle.addEventListener("pointermove", (event) => {
        if (!drag) event.stopPropagation();
      });
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || drag || !current()) return;
        event.preventDefault();
        event.stopPropagation();
        handle.focus({ preventScroll: true });
        if (!select(target, event.shiftKey)) return;
        const snapshot = current();
        if (!snapshot) return;
        const rect = handle.getBoundingClientRect();
        const offset = inverse(
          event.clientX - rect.left - rect.width / 2,
          event.clientY - rect.top - rect.height / 2,
        );
        drag = {
          target,
          handle,
          pointerId: event.pointerId,
          x: event.screenX,
          y: event.screenY,
          start: offsets[axis][index] + size / 2 + offset[axis],
          signature: signature(snapshot),
          moved: false,
          insertionIndex: index,
          valid: true,
        };
        try {
          handle.setPointerCapture?.(event.pointerId);
        } catch {
          /* 节点移除由连接与文档身份守卫取消。 */
        }
        update();
      });
      handle.addEventListener("click", (event) => {
        event.stopPropagation();
        if (event.detail === 0 && current()) select(target);
      });
      handle.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if (drag) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (!event.altKey || !current()) return;
        const previous =
          event.key === (axis === "row" ? "ArrowUp" : "ArrowLeft");
        const next =
          event.key === (axis === "row" ? "ArrowDown" : "ArrowRight");
        if (!previous && !next) return;
        event.preventDefault();
        event.stopPropagation();
        const insertionIndex = previous ? index - 1 : index + 2;
        const result = preflight(target, insertionIndex);
        if (
          result.kind === "move" &&
          controller.tableEditing.interact({
            type: "reorder",
            tableId: table.id,
            ...target,
            insertionIndex,
          })
        )
          onFocusRestore?.({ axis, index: result.destination });
      });
      handle.addEventListener("lostpointercapture", cancel);
      mount.append(handle);
      handles.push(handle);
    });
  }
  const hover = (event: PointerEvent) => {
    if (drag) return;
    const element = event.target as HTMLElement | null;
    const key = element?.closest<HTMLElement>("[data-presentation-cell]")
      ?.dataset.presentationCell;
    if (!key) return;
    const [row, column] = key.split(":").map(Number);
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(column) ||
      row < 0 ||
      row >= table.rows.length ||
      column < 0 ||
      column >= table.columns.length
    )
      return;
    hovered = { row, column };
    update();
  };
  const leave = () => {
    if (!drag) {
      hovered = null;
      update();
    }
  };
  mount.addEventListener("pointermove", hover);
  mount.addEventListener("pointerleave", leave);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", cancel, true);
  document.addEventListener("keydown", escape, true);
  const unsubscribe = controller.subscribe(() => {
    const snapshot = current();
    if (drag && (!snapshot || signature(snapshot) !== drag.signature))
      finish(false);
    update();
  });
  update();
  return () => {
    disposed = true;
    unsubscribe();
    finish(false);
    mount.removeEventListener("pointermove", hover);
    mount.removeEventListener("pointerleave", leave);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", cancel, true);
    document.removeEventListener("keydown", escape, true);
    guide.remove();
    for (const node of [...handles, ...bridges]) node.remove();
  };
}
