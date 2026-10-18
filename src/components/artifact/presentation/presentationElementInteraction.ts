import type { PresentationElementEdit } from "./presentationPackage";
import {
  normalizePresentationElementSelection,
  normalizePresentationRotation,
  presentationElementSelectionFrame,
  presentationSelectableElements,
  rotatePresentationPoint,
  setSelectedElementId,
  validPresentationElementFrame,
  validPresentationPoint,
  type PresentationElementSelection,
  type PresentationElementTarget,
  type PresentationPoint,
  type PresentationSelectionFrame,
} from "./presentationElementSelection";

export type PresentationElementInteractionMode = "move" | "resize" | "rotate";
export type PresentationResizeCorner =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";
export interface PresentationElementInteraction {
  slideId: string;
  mode: PresentationElementInteractionMode;
  corner?: PresentationResizeCorner;
  preserveRatio: boolean;
  point: PresentationPoint;
  selection: PresentationElementSelection;
  selectionFrame: PresentationSelectionFrame;
  previewFrame: PresentationSelectionFrame;
  targets: readonly PresentationElementTarget[];
  preview: readonly PresentationElementTarget[];
  rotationDelta: number;
  rotationPointerAngle: number;
  moved: boolean;
}

const handles: Record<PresentationResizeCorner, readonly [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};
const center = (
  frame: PresentationSelectionFrame | PresentationElementTarget["frame"],
): PresentationPoint => ({
  x: frame.x + frame.width / 2,
  y: frame.y + frame.height / 2,
});
const pointerAngle = (point: PresentationPoint, origin: PresentationPoint) =>
  (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;
const sameFrame = (
  a: PresentationElementTarget,
  b: PresentationElementTarget,
) =>
  (["x", "y", "width", "height"] as const).every(
    (key) =>
      Math.round(a.frame[key] * 9525) === Math.round(b.frame[key] * 9525),
  ) &&
  Math.round(normalizePresentationRotation(a.rotation) * 60000) % 21600000 ===
    Math.round(normalizePresentationRotation(b.rotation) * 60000) % 21600000;

export function beginElementInteraction(options: {
  slideId: string;
  targets: readonly PresentationElementTarget[];
  selection: PresentationElementSelection | null;
  elementId: string;
  point: PresentationPoint;
  mode: PresentationElementInteractionMode;
  corner?: PresentationResizeCorner;
  preserveRatio?: boolean;
}): PresentationElementInteraction | null {
  if (!options.slideId || !validPresentationPoint(options.point)) return null;
  let selection = normalizePresentationElementSelection(
    options.targets,
    options.selection,
  );
  if (!selection.selectedElementIds.includes(options.elementId))
    selection = setSelectedElementId(options.targets, options.elementId);
  const available = new Map(
    presentationSelectableElements(options.targets).map((target) => [
      target.id,
      target,
    ]),
  );
  const targets = selection.selectedElementIds.flatMap((id) => {
    const target = available.get(id);
    return target ? [{ ...target, frame: { ...target.frame } }] : [];
  });
  const frame = presentationElementSelectionFrame(targets, selection);
  if (!frame || !targets.length) return null;
  if (
    options.mode === "rotate" &&
    (targets.some((target) => target.canRotate === false) ||
      (options.point.x === center(frame).x &&
        options.point.y === center(frame).y))
  )
    return null;
  if (options.mode === "resize") {
    if (
      !options.corner ||
      !handles[options.corner] ||
      targets.some((target) => target.resizeAxis === "none")
    )
      return null;
    const [x, y] = handles[options.corner];
    if (
      targets.some((target) => target.resizeAxis === "horizontal") &&
      (targets.length > 1 || y !== 0)
    )
      return null;
    if (
      (!x || !y) &&
      targets.some(
        (target) =>
          target.allowSingleAxisResize === false ||
          (targets.length > 1 &&
            normalizePresentationRotation(target.rotation) !== 0),
      )
    )
      return null;
  }
  return {
    slideId: options.slideId,
    mode: options.mode,
    corner: options.corner,
    preserveRatio: options.preserveRatio ?? false,
    point: { ...options.point },
    selection,
    selectionFrame: { ...frame },
    previewFrame: { ...frame },
    targets,
    preview: targets.map((target) => ({
      ...target,
      frame: { ...target.frame },
    })),
    rotationDelta: 0,
    rotationPointerAngle: pointerAngle(options.point, center(frame)),
    moved: false,
  };
}

function resize(
  session: PresentationElementInteraction,
  point: PresentationPoint,
  shiftKey: boolean,
  altKey: boolean,
): {
  preview: PresentationElementTarget[];
  previewFrame: PresentationSelectionFrame;
} | null {
  const frame = session.selectionFrame;
  const [x, y] = handles[session.corner!];
  if (
    session.targets.some((target) => target.resizeAxis === "horizontal") &&
    (session.preserveRatio || shiftKey)
  )
    return null;
  const delta = rotatePresentationPoint(
    {
      x: point.x - session.point.x,
      y: point.y - session.point.y,
    },
    { x: 0, y: 0 },
    -frame.rotation,
  );
  let width = frame.width + x * delta.x * (altKey ? 2 : 1);
  let height = frame.height + y * delta.y * (altKey ? 2 : 1);
  if (session.targets.length > 1 || session.preserveRatio || shiftKey) {
    const scale = !x
      ? height / frame.height
      : !y
        ? width / frame.width
        : (frame.width * width + frame.height * height) /
          (frame.width ** 2 + frame.height ** 2);
    width = frame.width * scale;
    height = frame.height * scale;
  }
  const origin = center(frame);
  const movedCenter = rotatePresentationPoint(
    {
      x: origin.x + (altKey ? 0 : (x * (width - frame.width)) / 2),
      y: origin.y + (altKey ? 0 : (y * (height - frame.height)) / 2),
    },
    origin,
    frame.rotation,
  );
  const previewFrame = {
    x: movedCenter.x - width / 2,
    y: movedCenter.y - height / 2,
    width,
    height,
    rotation: frame.rotation,
  };
  if (!validPresentationElementFrame(previewFrame)) return null;
  const preview = session.targets.map((target) => {
    const targetCenter = center(target.frame);
    const local = rotatePresentationPoint(
      targetCenter,
      origin,
      -frame.rotation,
    );
    const scaledCenter = rotatePresentationPoint(
      {
        x: movedCenter.x + ((local.x - origin.x) * width) / frame.width,
        y: movedCenter.y + ((local.y - origin.y) * height) / frame.height,
      },
      movedCenter,
      frame.rotation,
    );
    const w = (target.frame.width * width) / frame.width;
    const h = (target.frame.height * height) / frame.height;
    return {
      ...target,
      frame: {
        x: scaledCenter.x - w / 2,
        y: scaledCenter.y - h / 2,
        width: w,
        height: h,
      },
    };
  });
  return { preview, previewFrame };
}

export function updateElementInteraction(
  session: PresentationElementInteraction,
  options: {
    nextPoint: PresentationPoint;
    shiftKey?: boolean;
    altKey?: boolean;
  },
): PresentationElementInteraction {
  if (!validPresentationPoint(options.nextPoint)) return session;
  let preview: PresentationElementTarget[],
    previewFrame: PresentationSelectionFrame;
  let rotationDelta = session.rotationDelta,
    rotationPointerAngle = session.rotationPointerAngle;
  if (session.mode === "move") {
    let dx = options.nextPoint.x - session.point.x,
      dy = options.nextPoint.y - session.point.y;
    if (options.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    preview = session.targets.map((target) => ({
      ...target,
      frame: {
        ...target.frame,
        x: target.frame.x + dx,
        y: target.frame.y + dy,
      },
    }));
    previewFrame = {
      ...session.selectionFrame,
      x: session.selectionFrame.x + dx,
      y: session.selectionFrame.y + dy,
    };
  } else if (session.mode === "resize") {
    const result = resize(
      session,
      options.nextPoint,
      options.shiftKey ?? false,
      options.altKey ?? false,
    );
    if (!result) return session;
    ({ preview, previewFrame } = result);
  } else {
    const origin = center(session.selectionFrame);
    if (options.nextPoint.x === origin.x && options.nextPoint.y === origin.y)
      return session;
    rotationPointerAngle = pointerAngle(options.nextPoint, origin);
    const step =
      normalizePresentationRotation(
        rotationPointerAngle - session.rotationPointerAngle + 180,
      ) - 180;
    rotationDelta += step;
    const angle = options.shiftKey
      ? Math.round(rotationDelta / 15) * 15
      : rotationDelta;
    preview = session.targets.map((target) => {
      const point = rotatePresentationPoint(
        center(target.frame),
        origin,
        angle,
      );
      return {
        ...target,
        rotation: normalizePresentationRotation(target.rotation + angle),
        frame: {
          ...target.frame,
          x: point.x - target.frame.width / 2,
          y: point.y - target.frame.height / 2,
        },
      };
    });
    previewFrame = {
      ...session.selectionFrame,
      rotation: normalizePresentationRotation(
        session.selectionFrame.rotation + angle,
      ),
    };
  }
  if (
    !validPresentationElementFrame(previewFrame) ||
    preview.some((target) => !validPresentationElementFrame(target.frame))
  )
    return session;
  return {
    ...session,
    preview,
    previewFrame,
    rotationDelta,
    rotationPointerAngle,
    moved: preview.some(
      (target, index) => !sameFrame(session.targets[index], target),
    ),
  };
}

/** Controller 以返回的 null 清空交互；一次提交由既有 edit log/history owner 接收。 */
export function endElementInteraction(
  session: PresentationElementInteraction | null,
  { commit }: { commit: boolean },
): { session: null; edits: PresentationElementEdit[] } {
  if (!session || !commit || !session.moved)
    return { session: null, edits: [] };
  return {
    session: null,
    edits: session.preview.flatMap((target, index) => {
      const original = session.targets[index];
      if (sameFrame(original, target)) return [];
      const rotationChanged =
        Math.round(normalizePresentationRotation(original.rotation) * 60000) %
          21600000 !==
        Math.round(normalizePresentationRotation(target.rotation) * 60000) %
          21600000;
      return [
        {
          slideId: session.slideId,
          elementId: target.id,
          frame: {
            ...target.frame,
            ...(rotationChanged ? { rotation: target.rotation } : {}),
          },
        },
      ];
    }),
  };
}
