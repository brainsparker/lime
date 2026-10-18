import type { PresentationController } from "./PresentationController";
import { presentationElements } from "./presentationElements";
import { presentationElementTargets } from "./presentationElementController";
import {
  presentationElementSelectionFrame,
  type PresentationElementTarget,
  type PresentationPoint,
  type PresentationSelectionFrame,
} from "./presentationElementSelection";
import type { PresentationResizeCorner } from "./presentationElementInteraction";
import { handlePresentationHistoryKey } from "./usePresentationTableOverlay";

interface Options {
  slide: HTMLElement;
  scale: number;
  controller: PresentationController;
  labels: {
    element: (id: string, name: string) => string;
    resize: (corner: PresentationResizeCorner) => string;
    rotate: string;
    canvas: string;
  };
  onFocusRestore: (id: string, source: "action" | "projection") => void;
}
const corners = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
} satisfies Record<PresentationResizeCorner, number[]>;
function place(element: HTMLElement, frame: PresentationSelectionFrame) {
  Object.assign(element.style, {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    transform: `rotate(${frame.rotation}deg)`,
  });
}

/** 原生监听器只把输入交给 Controller；这里不持有几何稿件、原包或历史。 */
export function installPresentationElementOverlay({
  slide,
  scale,
  controller,
  labels,
  onFocusRestore,
}: Options): () => void {
  if (!Number.isFinite(scale) || scale <= 0) return () => {};
  const installed = controller.getSnapshot(),
    document = slide.ownerDocument;
  const nodes = presentationElements(
    installed.document,
    installed.selectedSlideId,
  );
  const targets = presentationElementTargets(nodes);
  const allNodes =
    installed.document.model.slides[
      installed.document.slideIds.indexOf(installed.selectedSlideId)
    ]?.nodes ?? [];
  // renderer 按 slide.nodes 顺序追加原生顶层 wrapper，之前的孩子属于背景/master/layout。
  const rendered = Array.from(slide.children)
    .filter(
      (element) =>
        element.localName === "div" &&
        !Array.from(element.attributes).some(({ name }) =>
          name.startsWith("data-presentation-"),
        ),
    )
    .slice(-allNodes.length);
  const originals = new Map<
    string,
    { element: HTMLElement; left: string; top: string; transform: string }
  >();
  if (allNodes.length && rendered.length === allNodes.length)
    for (const [index, node] of allNodes.entries()) {
      const element = rendered[index] as HTMLElement;
      if (
        Math.abs(parseFloat(element.style.left) - node.position.x) > 0.001 ||
        Math.abs(parseFloat(element.style.top) - node.position.y) > 0.001 ||
        !Number.isFinite(parseFloat(element.style.left)) ||
        !Number.isFinite(parseFloat(element.style.top))
      )
        continue;
      originals.set(node.id, {
        element,
        left: element.style.left,
        top: element.style.top,
        transform: element.style.transform,
      });
    }
  const buttons = new Map<string, HTMLButtonElement>();
  const outline = document.createElement("div");
  outline.dataset.presentationSelection = "true";
  Object.assign(outline.style, {
    position: "absolute",
    border: "1px solid Highlight",
    boxSizing: "border-box",
    pointerEvents: "none",
    zIndex: "85",
  });
  const marquee = document.createElement("div");
  marquee.dataset.presentationMarquee = "true";
  marquee.setAttribute("aria-hidden", "true");
  Object.assign(marquee.style, {
    position: "absolute",
    border: "1px solid Highlight",
    background: "color-mix(in srgb, Highlight 12%, transparent)",
    pointerEvents: "none",
    zIndex: "86",
  });
  type Drag = {
    kind: "element" | "marquee";
    pointerId: number;
    handle: HTMLElement;
    point: PresentationPoint;
    screen: PresentationPoint;
  };
  let drag: Drag | null = null,
    disposed = false;
  const current = () => {
    const state = controller.getSnapshot();
    return !disposed &&
      slide.isConnected &&
      state.isEditing &&
      state.document === installed.document &&
      state.selectedSlideId === installed.selectedSlideId
      ? state
      : null;
  };
  const restoreArtwork = () => {
    for (const { element, left, top, transform } of originals.values()) {
      Object.assign(element.style, { left, top, transform });
      delete element.dataset.presentationPreview;
    }
  };
  const previewArtwork = (
    target: PresentationElementTarget,
    original: PresentationElementTarget,
  ) => {
    const saved = originals.get(target.id);
    if (!saved) return;
    Object.assign(saved.element.style, {
      left: `${target.frame.x + (target.frame.width - original.frame.width) / 2}px`,
      top: `${target.frame.y + (target.frame.height - original.frame.height) / 2}px`,
      transform: `rotate(${target.rotation - original.rotation}deg) ${saved.transform} scale(${target.frame.width / original.frame.width}, ${target.frame.height / original.frame.height})`,
    });
    saved.element.dataset.presentationPreview = "true";
  };
  const sync = () => {
    if (controller.getSnapshot().document !== installed.document) {
      const active = document.activeElement as HTMLElement | null;
      const id = active?.dataset.presentationElementId;
      if (id) onFocusRestore(id, "projection");
      else if (active === slide) onFocusRestore("canvas", "projection");
      else if (
        active &&
        outline.contains(active) &&
        installed.primarySelectedElementId
      )
        onFocusRestore(installed.primarySelectedElementId, "projection");
    }
    const state = current();
    restoreArtwork();
    const preview = new Map(
      state?.elementInteraction?.preview.map((target) => [target.id, target]) ??
        [],
    );
    for (const initial of targets) {
      const target = preview.get(initial.id) ?? initial;
      const button = buttons.get(target.id);
      if (!button) continue;
      place(button, { ...target.frame, rotation: target.rotation });
      const selected = !!state?.selectedElementIds.includes(target.id);
      button.setAttribute("aria-pressed", String(selected));
      button.style.borderColor = selected ? "Highlight" : "transparent";
      button.setAttribute(
        "aria-disabled",
        String(!state || state.saving || state.projecting),
      );
      if (state?.elementInteraction) {
        const original = state.elementInteraction.targets.find(
          ({ id }) => id === target.id,
        );
        if (original) previewArtwork(target, original);
      }
    }
    const frame =
      state?.elementInteraction?.previewFrame ??
      (state ? presentationElementSelectionFrame(targets, state) : null);
    outline.hidden = !frame || !!state?.selectionMarquee;
    if (frame) place(outline, frame);
    for (const handle of outline.querySelectorAll<HTMLButtonElement>("button"))
      handle.setAttribute(
        "aria-disabled",
        String(!state || state.saving || state.projecting),
      );
    const box = state?.selectionMarquee?.frame;
    marquee.hidden = !box;
    if (box) place(marquee, { ...box, rotation: 0 });
  };
  const finish = (commit: boolean) => {
    const ending = drag;
    if (!ending) return;
    drag = null;
    if (ending.handle.hasPointerCapture?.(ending.pointerId))
      ending.handle.releasePointerCapture(ending.pointerId);
    const state = current();
    if (ending.kind === "marquee")
      controller.endSelectionMarquee({ commit: commit && !!state });
    else {
      const id = controller.getSnapshot().primarySelectedElementId;
      if (controller.endElementInteraction({ commit: commit && !!state }) && id)
        onFocusRestore(id, "action");
    }
    sync();
  };
  const start = (
    event: PointerEvent,
    handle: HTMLElement,
    kind: Drag["kind"],
    point: PresentationPoint,
  ) => {
    drag = {
      kind,
      handle,
      pointerId: event.pointerId,
      point,
      screen: { x: event.screenX, y: event.screenY },
    };
    handle.setPointerCapture?.(event.pointerId);
    handle.focus({ preventScroll: true });
    event.preventDefault();
    event.stopPropagation();
  };
  const localPoint = (event: PointerEvent): PresentationPoint => {
    const rect = slide.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    };
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!current()) {
      finish(false);
      return;
    }
    const nextPoint = {
      x: drag.point.x + (event.screenX - drag.screen.x) / scale,
      y: drag.point.y + (event.screenY - drag.screen.y) / scale,
    };
    if (drag.kind === "marquee")
      controller.updateSelectionMarquee({ nextPoint });
    else
      controller.updateElementInteraction({
        nextPoint,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
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
  for (const node of nodes) {
    const target = targets.find(({ id }) => id === node.id);
    if (!target || target.hidden) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.presentationElementId = node.id;
    button.setAttribute("aria-label", labels.element(node.id, node.name));
    Object.assign(button.style, {
      position: "absolute",
      background: "transparent",
      border: "2px solid transparent",
      padding: "0",
      cursor: "move",
      zIndex: "80",
    });
    button.addEventListener("pointerdown", (event) => {
      const state = current();
      if (event.button !== 0 || !state || state.saving || state.projecting)
        return;
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        controller.toggleSelectedElementId(node.id);
        if (!controller.getSnapshot().selectedElementIds.includes(node.id)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      const point = localPoint(event);
      if (
        controller.beginElementInteraction({
          elementId: node.id,
          point,
          mode: "move",
        })
      )
        start(event, button, "element", point);
    });
    button.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      if (event.shiftKey || event.ctrlKey || event.metaKey)
        controller.toggleSelectedElementId(node.id);
      else controller.setSelectedElementId(node.id);
    });
    button.addEventListener("dblclick", () =>
      controller.textActivateBlockEnd(node.id),
    );
    button.addEventListener("lostpointercapture", cancel);
    buttons.set(node.id, button);
    slide.append(button);
  }
  const createHandle = (corner: PresentationResizeCorner | "rotate") => {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.setAttribute(
      "aria-label",
      corner === "rotate" ? labels.rotate : labels.resize(corner),
    );
    if (corner === "rotate") handle.dataset.presentationRotate = "true";
    else handle.dataset.presentationResize = corner;
    const [x, y] = corner === "rotate" ? [0.5, 0] : corners[corner];
    Object.assign(handle.style, {
      position: "absolute",
      left: `${x * 100}%`,
      top: corner === "rotate" ? `${-24 / scale}px` : `${y * 100}%`,
      transform: "translate(-50%, -50%)",
      width: `${10 / scale}px`,
      height: `${10 / scale}px`,
      border: "1px solid Highlight",
      background: "Canvas",
      borderRadius: corner === "rotate" ? "50%" : "2px",
      padding: "0",
      pointerEvents: "auto",
      cursor: corner === "rotate" ? "grab" : `${corner}-resize`,
    });
    handle.addEventListener("pointerdown", (event) => {
      const state = current(),
        point = localPoint(event);
      if (event.button !== 0 || !state?.primarySelectedElementId) return;
      if (
        controller.beginElementInteraction({
          elementId: state.primarySelectedElementId,
          point,
          mode: corner === "rotate" ? "rotate" : "resize",
          ...(corner === "rotate" ? {} : { corner }),
        })
      )
        start(event, handle, "element", point);
    });
    handle.addEventListener("lostpointercapture", cancel);
    outline.append(handle);
  };
  for (const corner of Object.keys(corners) as PresentationResizeCorner[])
    createHandle(corner);
  createHandle("rotate");
  slide.append(outline, marquee);
  const previousTabIndex = slide.getAttribute("tabindex"),
    previousLabel = slide.getAttribute("aria-label"),
    previousTouchAction = slide.style.touchAction;
  slide.tabIndex = 0;
  slide.style.touchAction = "none";
  slide.setAttribute("aria-label", labels.canvas);
  const blank = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest(
        "button,textarea,input,select,[contenteditable],[data-presentation-table-id]",
      )
    )
      return;
    const point = localPoint(event);
    if (
      controller.beginSelectionMarquee({
        point,
        additive: event.shiftKey || event.ctrlKey || event.metaKey,
      })
    )
      start(event, slide, "marquee", point);
  };
  const key = (event: KeyboardEvent) => {
    if (
      event.isComposing ||
      (event.target as Element).closest(
        "textarea,input,select,[contenteditable],[data-presentation-table-id]",
      )
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (drag) finish(false);
      else if (!controller.cancelElementInteraction())
        controller.setSelectedElementId(null);
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "a") {
      event.preventDefault();
      controller.selectAllSlideElements();
      return;
    }
    const id = controller.getSnapshot().primarySelectedElementId;
    if (handlePresentationHistoryKey(event, controller)) {
      if (id) onFocusRestore(id, "action");
      return;
    }
    if (event.key === "Enter" && id) {
      event.preventDefault();
      controller.textActivateBlockEnd(id);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      controller.deleteSelectedElement();
      return;
    }
    const distance = event.shiftKey ? 10 : 1;
    const directions: Record<string, number[]> = {
      ArrowLeft: [-distance, 0],
      ArrowRight: [distance, 0],
      ArrowUp: [0, -distance],
      ArrowDown: [0, distance],
    };
    const delta = directions[event.key];
    if (delta && !modifier && !event.altKey) {
      event.preventDefault();
      if (
        controller.nudgeSelectedElements({ dx: delta[0], dy: delta[1] }) &&
        id
      )
        onFocusRestore(id, "action");
    }
  };
  const blur = () => finish(false);
  slide.addEventListener("pointerdown", blank);
  slide.addEventListener("keydown", key);
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", cancel);
  document.defaultView?.addEventListener("blur", blur);
  const unsubscribe = controller.subscribe(sync);
  sync();
  return () => {
    finish(false);
    disposed = true;
    unsubscribe();
    restoreArtwork();
    buttons.forEach((button) => button.remove());
    outline.remove();
    marquee.remove();
    if (previousTabIndex === null) slide.removeAttribute("tabindex");
    else slide.setAttribute("tabindex", previousTabIndex);
    if (previousLabel === null) slide.removeAttribute("aria-label");
    else slide.setAttribute("aria-label", previousLabel);
    slide.style.touchAction = previousTouchAction;
    slide.removeEventListener("pointerdown", blank);
    slide.removeEventListener("keydown", key);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
    document.defaultView?.removeEventListener("blur", blur);
  };
}
