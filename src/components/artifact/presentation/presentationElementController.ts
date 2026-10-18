import type { SlideNode } from "@aiden0z/pptx-renderer";
import type { PresentationControllerState } from "./PresentationController";
import type {
  PresentationElementEdit,
  PresentationElementOrder,
} from "./presentationPackage";
import type { PresentationEdit } from "./presentationEdits";
import { presentationElementFrame } from "./presentationElements";
import {
  beginElementInteraction,
  endElementInteraction,
  updateElementInteraction,
} from "./presentationElementInteraction";
import {
  beginSelectionMarquee,
  endSelectionMarquee,
  normalizePresentationElementSelection,
  selectAllSlideElements,
  setSelectedElementId,
  updateSelectionMarquee,
  type PresentationElementSelection,
  type PresentationElementTarget,
  type PresentationPoint,
} from "./presentationElementSelection";

interface Host {
  getSnapshot: () => PresentationControllerState;
  elements: () => readonly SlideNode[];
  update: (patch: Partial<PresentationControllerState>) => void;
  canEdit: () => boolean;
  commitTextEdit: () => boolean;
  apply: (edits: readonly PresentationElementEdit[]) => boolean;
}

export function presentationElementTargets(
  nodes: readonly SlideNode[],
): PresentationElementTarget[] {
  return nodes.map((node) => ({
    id: node.id,
    frame: presentationElementFrame(node),
    rotation: node.rotation,
    flipH: node.flipH,
    flipV: node.flipV,
    resizeAxis:
      node.nodeType === "shape" &&
      node.textBody?.bodyProperties?.child("spAutoFit").exists()
        ? "horizontal"
        : "both",
    hidden: ["1", "true"].includes(
      node.source
        .child(
          node.nodeType === "picture"
            ? "nvPicPr"
            : node.nodeType === "table" || node.nodeType === "chart"
              ? "nvGraphicFramePr"
              : "nvSpPr",
        )
        .child("cNvPr")
        .attr("hidden") ?? "",
    ),
    allowSingleAxisResize: node.nodeType !== "table",
  }));
}

/** 表格外框与原生行列格网在同一历史批次缩放，旋转仍交给元素原包 owner。 */
export function presentationElementFrameEdits(
  nodes: readonly SlideNode[],
  edits: readonly PresentationElementEdit[],
): PresentationEdit[] {
  return edits.flatMap((edit): PresentationEdit[] => {
    const node = nodes.find((node) => node.id === edit.elementId),
      frame = edit.frame;
    if (
      node?.nodeType !== "table" ||
      !frame ||
      (frame.width === node.size.w && frame.height === node.size.h)
    )
      return [{ kind: "element", value: edit }];
    const resize: PresentationEdit = {
      kind: "table",
      value: {
        type: "resize-table",
        slideId: edit.slideId,
        tableId: node.id,
        frame: {
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        },
        rowHeights: node.rows.map(
          (row) => (row.height * frame.height) / node.size.h,
        ),
        columnWidths: node.columns.map(
          (width) => (width * frame.width) / node.size.w,
        ),
      },
    };
    return frame.rotation === undefined
      ? [resize]
      : [resize, { kind: "element", value: edit }];
  });
}

/** 只协调唯一 Controller 的状态；原包、编辑日志和历史仍由 host 拥有。 */
export function presentationElementController(host: Host) {
  const targets = () => presentationElementTargets(host.elements());
  const select = (selection: PresentationElementSelection) =>
    host.update({
      ...selection,
      textEditor: null,
      tableSelection: null,
      elementInteraction: null,
      selectionMarquee: null,
    });
  const cancel = () => {
    const state = host.getSnapshot();
    const active = !!(state.elementInteraction || state.selectionMarquee);
    const restored = endSelectionMarquee(state.selectionMarquee, {
      commit: false,
    }).selection;
    if (active)
      host.update({
        ...(restored ?? {}),
        elementInteraction: null,
        selectionMarquee: null,
      });
    return active;
  };
  return {
    cancelElementInteraction: cancel,
    reorderSelectedElement(direction: PresentationElementOrder) {
      const state = host.getSnapshot();
      if (
        !host.canEdit() ||
        state.selectedElementIds.length !== 1 ||
        !state.primarySelectedElementId
      )
        return false;
      const nodes =
        state.document.model.slides[
          state.document.slideIds.indexOf(state.selectedSlideId)
        ]?.nodes ?? [];
      const index = nodes.findIndex(
        (node) => node.id === state.primarySelectedElementId,
      );
      if (
        index < 0 ||
        (direction.startsWith("bring-")
          ? index === nodes.length - 1
          : index === 0)
      )
        return false;
      if (!host.commitTextEdit() || host.getSnapshot().projecting) return false;
      return host.apply([
        {
          slideId: state.selectedSlideId,
          elementId: state.primarySelectedElementId,
          zOrder: direction,
        },
      ]);
    },
    setSelectedElementId(elementId: string | null) {
      const state = host.getSnapshot();
      if (state.saving || state.projecting || !host.commitTextEdit()) return;
      const selection = setSelectedElementId(targets(), elementId);
      if (elementId && !selection.selectedElementIds.length) return;
      select(selection);
    },
    toggleSelectedElementId(elementId: string) {
      const state = host.getSnapshot();
      if (state.saving || state.projecting || !host.commitTextEdit()) return;
      const selected = state.selectedElementIds.includes(elementId);
      select(
        normalizePresentationElementSelection(targets(), {
          selectedElementIds: selected
            ? state.selectedElementIds.filter((id) => id !== elementId)
            : [...state.selectedElementIds, elementId],
          primarySelectedElementId: selected ? null : elementId,
        }),
      );
    },
    selectAllSlideElements() {
      if (!host.canEdit() || !host.commitTextEdit()) return false;
      select(selectAllSlideElements(targets()));
      return true;
    },
    beginSelectionMarquee(options: {
      point: PresentationPoint;
      additive?: boolean;
    }) {
      if (
        !host.canEdit() ||
        !host.commitTextEdit() ||
        host.getSnapshot().projecting
      )
        return false;
      const session = beginSelectionMarquee({
        ...options,
        targets: targets(),
        selection: host.getSnapshot(),
      });
      if (!session) return false;
      host.update({
        selectionMarquee: session,
        textEditor: null,
        tableSelection: null,
      });
      return true;
    },
    updateSelectionMarquee(options: { nextPoint: PresentationPoint }) {
      const session = host.getSnapshot().selectionMarquee;
      if (!session) return false;
      const next = updateSelectionMarquee(session, options);
      host.update({ selectionMarquee: next, ...next.selection });
      return true;
    },
    endSelectionMarquee(options: { commit: boolean }) {
      const result = endSelectionMarquee(
        host.getSnapshot().selectionMarquee,
        options,
      );
      if (!result.selection) return false;
      host.update({ ...result.selection, selectionMarquee: null });
      return true;
    },
    beginElementInteraction(
      options: Omit<
        Parameters<typeof beginElementInteraction>[0],
        "slideId" | "targets" | "selection"
      >,
    ) {
      if (
        !host.canEdit() ||
        !host.commitTextEdit() ||
        host.getSnapshot().projecting
      )
        return false;
      const state = host.getSnapshot();
      const session = beginElementInteraction({
        ...options,
        slideId: state.selectedSlideId,
        targets: targets(),
        selection: state,
      });
      if (!session) return false;
      host.update({
        ...session.selection,
        elementInteraction: session,
        textEditor: null,
        tableSelection: null,
      });
      return true;
    },
    updateElementInteraction(
      options: Parameters<typeof updateElementInteraction>[1],
    ) {
      const session = host.getSnapshot().elementInteraction;
      if (!session) return false;
      host.update({
        elementInteraction: updateElementInteraction(session, options),
      });
      return true;
    },
    endElementInteraction(options: { commit: boolean }) {
      const result = endElementInteraction(
        host.getSnapshot().elementInteraction,
        options,
      );
      host.update({ elementInteraction: null });
      return result.edits.length > 0 && host.apply(result.edits);
    },
    nudgeSelectedElements({ dx, dy }: { dx: number; dy: number }) {
      if (
        !host.canEdit() ||
        !host.commitTextEdit() ||
        host.getSnapshot().projecting
      )
        return false;
      const state = host.getSnapshot();
      const session = beginElementInteraction({
        slideId: state.selectedSlideId,
        targets: targets(),
        selection: state,
        elementId: state.primarySelectedElementId ?? "",
        point: { x: 0, y: 0 },
        mode: "move",
      });
      if (!session) return false;
      const result = endElementInteraction(
        updateElementInteraction(session, { nextPoint: { x: dx, y: dy } }),
        { commit: true },
      );
      return result.edits.length > 0 && host.apply(result.edits);
    },
  };
}
