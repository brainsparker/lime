import type { PresentationElementEdit } from "./presentationPackage";

export type PresentationElementFrame = Omit<
  NonNullable<PresentationElementEdit["frame"]>,
  "rotation"
>;
export interface PresentationPoint {
  x: number;
  y: number;
}
export interface PresentationSelectionFrame extends PresentationElementFrame {
  rotation: number;
}
export interface PresentationElementTarget {
  id: string;
  frame: PresentationElementFrame;
  rotation: number;
  flipH?: boolean;
  flipV?: boolean;
  hidden?: boolean;
  resizeAxis?: "both" | "horizontal" | "none";
  allowSingleAxisResize?: boolean;
  canRotate?: boolean;
}
export interface PresentationElementSelection {
  selectedElementIds: string[];
  primarySelectedElementId: string | null;
}
export interface PresentationSelectionMarquee {
  targets: readonly PresentationElementTarget[];
  point: PresentationPoint;
  nextPoint: PresentationPoint;
  additive: boolean;
  initialSelection: PresentationElementSelection;
  selection: PresentationElementSelection;
  frame: PresentationElementFrame | null;
  moved: boolean;
}

export function validPresentationPoint(point: PresentationPoint): boolean {
  return [point.x, point.y].every(
    (value) =>
      Number.isFinite(value) && Number.isSafeInteger(Math.round(value * 9525)),
  );
}

export function validPresentationElementFrame(
  frame: PresentationElementFrame,
): boolean {
  const values = [frame.x, frame.y, frame.width, frame.height].map((value) =>
    Number.isFinite(value) ? Math.round(value * 9525) : NaN,
  );
  return values.every(Number.isSafeInteger) && values[2] > 0 && values[3] > 0;
}

export function normalizePresentationRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export function rotatePresentationPoint(
  point: PresentationPoint,
  center: PresentationPoint,
  rotation: number,
): PresentationPoint {
  const angle = (rotation * Math.PI) / 180;
  const dx = point.x - center.x,
    dy = point.y - center.y;
  return {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

export function presentationElementCorners(
  target: Pick<PresentationElementTarget, "frame" | "rotation">,
): PresentationPoint[] {
  const { x, y, width, height } = target.frame;
  const center = { x: x + width / 2, y: y + height / 2 };
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ].map((point) => rotatePresentationPoint(point, center, target.rotation));
}

export function presentationSelectableElements(
  targets: readonly PresentationElementTarget[],
): PresentationElementTarget[] {
  const ids = new Set<string>();
  return targets.filter((target) => {
    const angle = Math.round(target.rotation * 60000);
    if (
      !target.id ||
      ids.has(target.id) ||
      target.hidden ||
      !validPresentationElementFrame(target.frame) ||
      !Number.isFinite(target.rotation) ||
      !Number.isInteger(angle) ||
      angle < -2147483648 ||
      angle > 2147483647
    )
      return false;
    ids.add(target.id);
    return true;
  });
}

export function normalizePresentationElementSelection(
  targets: readonly PresentationElementTarget[],
  selection: PresentationElementSelection | null,
): PresentationElementSelection {
  const available = new Set(
    presentationSelectableElements(targets).map(({ id }) => id),
  );
  const selectedElementIds = [
    ...new Set(selection?.selectedElementIds ?? []),
  ].filter((id) => available.has(id));
  const primary = selection?.primarySelectedElementId;
  return {
    selectedElementIds,
    primarySelectedElementId:
      primary && selectedElementIds.includes(primary)
        ? primary
        : (selectedElementIds.at(-1) ?? null),
  };
}

export function setSelectedElementId(
  targets: readonly PresentationElementTarget[],
  elementId: string | null,
): PresentationElementSelection {
  return normalizePresentationElementSelection(targets, {
    selectedElementIds: elementId ? [elementId] : [],
    primarySelectedElementId: elementId,
  });
}

export function selectAllSlideElements(
  targets: readonly PresentationElementTarget[],
): PresentationElementSelection {
  return normalizePresentationElementSelection(targets, {
    selectedElementIds: targets.map(({ id }) => id),
    primarySelectedElementId: null,
  });
}

export function presentationElementSelectionFrame(
  targets: readonly PresentationElementTarget[],
  selection: PresentationElementSelection | null,
): PresentationSelectionFrame | null {
  const selected = new Set(
    normalizePresentationElementSelection(targets, selection)
      .selectedElementIds,
  );
  const elements = presentationSelectableElements(targets).filter(({ id }) =>
    selected.has(id),
  );
  if (!elements.length) return null;
  if (elements.length === 1)
    return { ...elements[0].frame, rotation: elements[0].rotation };
  const corners = elements.flatMap(presentationElementCorners);
  const x = Math.min(...corners.map((point) => point.x));
  const y = Math.min(...corners.map((point) => point.y));
  const frame = {
    x,
    y,
    width: Math.max(...corners.map((point) => point.x)) - x,
    height: Math.max(...corners.map((point) => point.y)) - y,
    rotation: 0,
  };
  return validPresentationElementFrame(frame) ? frame : null;
}

export function beginSelectionMarquee(options: {
  targets: readonly PresentationElementTarget[];
  selection: PresentationElementSelection | null;
  point: PresentationPoint;
  additive?: boolean;
}): PresentationSelectionMarquee | null {
  if (!validPresentationPoint(options.point)) return null;
  const targets = presentationSelectableElements(options.targets).map(
    (target) => ({
      ...target,
      frame: { ...target.frame },
    }),
  );
  const initialSelection = normalizePresentationElementSelection(
    targets,
    options.selection,
  );
  return {
    targets,
    point: { ...options.point },
    nextPoint: { ...options.point },
    additive: options.additive ?? false,
    initialSelection,
    selection: {
      ...initialSelection,
      selectedElementIds: [...initialSelection.selectedElementIds],
    },
    frame: null,
    moved: false,
  };
}

/** 参考包尚未恢复框选相交 helper；此处明确使用旋转矩形的 SAT 相交。 */
function intersectsMarquee(
  target: PresentationElementTarget,
  frame: PresentationElementFrame,
): boolean {
  const points = presentationElementCorners(target);
  const rectangle = presentationElementCorners({ frame, rotation: 0 });
  const angle = (target.rotation * Math.PI) / 180;
  return [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: -Math.sin(angle), y: Math.cos(angle) },
  ].every((axis) => {
    const a = points.map((point) => point.x * axis.x + point.y * axis.y);
    const b = rectangle.map((point) => point.x * axis.x + point.y * axis.y);
    return Math.max(...a) >= Math.min(...b) && Math.max(...b) >= Math.min(...a);
  });
}

export function updateSelectionMarquee(
  session: PresentationSelectionMarquee,
  { nextPoint }: { nextPoint: PresentationPoint },
): PresentationSelectionMarquee {
  if (!validPresentationPoint(nextPoint)) return session;
  const frame = {
    x: Math.min(session.point.x, nextPoint.x),
    y: Math.min(session.point.y, nextPoint.y),
    width: Math.abs(nextPoint.x - session.point.x),
    height: Math.abs(nextPoint.y - session.point.y),
  };
  if (!validPresentationPoint({ x: frame.width, y: frame.height }))
    return session;
  const moved = frame.width > 0 || frame.height > 0;
  const hits = validPresentationElementFrame(frame)
    ? session.targets
        .filter((target) => intersectsMarquee(target, frame))
        .map(({ id }) => id)
    : [];
  return {
    ...session,
    nextPoint: { ...nextPoint },
    frame: moved ? frame : null,
    moved,
    selection: normalizePresentationElementSelection(session.targets, {
      selectedElementIds: [
        ...(session.additive
          ? session.initialSelection.selectedElementIds
          : []),
        ...hits,
      ],
      primarySelectedElementId:
        hits.at(-1) ??
        (session.additive
          ? session.initialSelection.primarySelectedElementId
          : null),
    }),
  };
}

export function endSelectionMarquee(
  session: PresentationSelectionMarquee | null,
  { commit }: { commit: boolean },
): { session: null; selection: PresentationElementSelection | null } {
  if (!session) return { session: null, selection: null };
  return {
    session: null,
    selection: !commit
      ? session.initialSelection
      : !session.moved && !session.additive
        ? setSelectedElementId(session.targets, null)
        : session.selection,
  };
}
