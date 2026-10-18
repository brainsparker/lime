import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  PresentationController,
  PresentationControllerState,
} from "./PresentationController";
import {
  presentationElements,
  presentationElementFrame,
  presentationElementStyle,
  presentationTextBodyStyle,
} from "./presentationElements";
import {
  presentationTableCells,
  presentationTableCellAt,
} from "./presentationTableSelection";
import { usePresentationTableOverlay } from "./usePresentationTableOverlay";
import { installPresentationElementOverlay } from "./presentationElementOverlay";
import { installPresentationTextEditor } from "./presentationTextEditor";

function frameHasFocus(slide: HTMLElement): boolean {
  const frame = slide.ownerDocument.defaultView?.frameElement;
  return !frame || frame.ownerDocument.activeElement === frame;
}

/** 受限 iframe 只接收父文档创建的节点/原生监听器，不开放文档脚本。 */
export function usePresentationEditingOverlay(
  slide: HTMLElement | null,
  scale: number,
  controller?: PresentationController,
  state?: PresentationControllerState,
) {
  const { t } = useTranslation("workspace");
  const latest = useRef(state);
  const restoreFocus = useRef<{ id: string; slideId: string } | null>(null);
  latest.current = state;
  const document = state?.document;
  const rendered = useRef({ slide, document });
  if (rendered.current.slide !== slide || !rendered.current.document)
    rendered.current = { slide, document };
  const slideId = state?.selectedSlideId;
  const editing = state?.isEditing;
  const editorId = state?.textEditor?.elementId;
  const editorCell = state?.textEditor?.cell;
  usePresentationTableOverlay(slide, controller, state, scale);
  useEffect(() => {
    if (
      !slide?.isConnected ||
      !document ||
      rendered.current.document !== document ||
      !slideId ||
      !editing ||
      !controller
    )
      return;
    const dispose = installPresentationElementOverlay({
      slide,
      scale,
      controller,
      labels: {
        element: (id, name) =>
          t("workspace.presentationEditing.element", { id, name }),
        resize: (direction) =>
          t("workspace.presentationEditing.resizeHandle", {
            direction: t(
              `workspace.presentationEditing.direction.${direction}`,
            ),
          }),
        rotate: t("workspace.presentationEditing.rotateHandle"),
        canvas: t("workspace.presentationEditing.selectionCanvas"),
      },
      onFocusRestore: (id, source) => {
        if (!frameHasFocus(slide)) return;
        if (source === "projection" && restoreFocus.current) return;
        restoreFocus.current = { id, slideId };
      },
    });
    const pending = restoreFocus.current;
    if (pending?.slideId === slideId && frameHasFocus(slide)) {
      if (pending.id === "canvas") slide.focus();
      else
        slide
          .querySelector<HTMLElement>(
            `[data-presentation-element-id="${pending.id}"]`,
          )
          ?.focus();
    }
    restoreFocus.current = null;
    return () => {
      const focused = slide.ownerDocument.activeElement as HTMLElement | null;
      const id =
        focused === slide ? "canvas" : focused?.dataset.presentationElementId;
      if (!restoreFocus.current && id && frameHasFocus(slide))
        restoreFocus.current = { id, slideId };
      dispose();
    };
  }, [slide, document, slideId, editing, controller, scale, t]);
  useEffect(() => {
    const editor = latest.current?.textEditor;
    if (!slide || !document || !slideId || !editorId || !editor || !controller)
      return;
    const element = presentationElements(document, slideId).find(
      (node) => node.id === editorId,
    );
    if (!element) return;
    const cell =
      editor.cell && element.nodeType === "table"
        ? presentationTableCellAt(
            presentationTableCells(element) ?? [],
            editor.cell,
          )
        : undefined;
    if (editor.cell && !cell) return;
    const frame = cell?.frame ?? presentationElementFrame(element);
    const style = cell
      ? presentationTextBodyStyle(cell.cell.textBody)
      : presentationElementStyle(element);
    const mount = cell ? slide.ownerDocument.createElement("div") : slide;
    if (cell)
      Object.assign(mount.style, {
        position: "absolute",
        left: `${element.position.x}px`,
        top: `${element.position.y}px`,
        width: `${element.size.w}px`,
        height: `${element.size.h}px`,
        transform: `rotate(${element.rotation}deg) scaleX(${element.flipH ? -1 : 1}) scaleY(${element.flipV ? -1 : 1})`,
        zIndex: "90",
      });
    if (cell) slide.append(mount);
    const dispose = installPresentationTextEditor({
      mount,
      controller,
      label: t("workspace.presentationEditing.text"),
      style: {
        position: "absolute",
        left: `${frame.x}px`,
        top: `${frame.y}px`,
        width: `${Math.max(40, frame.width)}px`,
        height: `${Math.max(30, frame.height)}px`,
        transform: cell ? "none" : `rotate(${element.rotation}deg)`,
        boxSizing: "border-box",
        background: "Canvas",
        color: "CanvasText",
        border: "2px solid Highlight",
        fontSize: `${style.fontSize}px`,
        fontWeight: style.bold ? "bold" : "normal",
        fontStyle: style.italic ? "italic" : "normal",
        whiteSpace: "pre-wrap",
        resize: "none",
        zIndex: "90",
      },
    });
    const input = mount.querySelector<HTMLElement>(
      "[data-presentation-text-editor]",
    );
    return () => {
      const focused = slide.ownerDocument.activeElement === input;
      dispose();
      if (cell) mount.remove();
      if (focused && cell && !latest.current?.textEditor) {
        // 提交/取消后回到活动格；外部控件已获得焦点时不抢回。
        queueMicrotask(() => {
          if (
            slide.isConnected &&
            latest.current?.primarySelectedElementId === editorId
          )
            slide
              .querySelector<HTMLElement>(
                `[data-presentation-cell="${cell.row}:${cell.column}"]`,
              )
              ?.focus();
        });
      }
    };
  }, [
    slide,
    document,
    slideId,
    editorId,
    editorCell?.row,
    editorCell?.column,
    controller,
    t,
  ]);
}
