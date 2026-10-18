import type { PresentationController } from "./PresentationController";
import type { PresentationTextEditorState } from "./presentationTextController";
import type { PresentationTextPosition } from "./presentationTextRange";
import { a, children, one } from "./presentationPackageXml";
import { textRuns, runText } from "./presentationTextRangeXml";
import {
  presentationTextParagraphLineHeight,
  presentationTextParagraphMarkers,
  presentationTextParagraphStyles,
} from "./presentationTextParagraphStyles";

const blocks = new Set(["div", "p", "li"]);
const rangedDeletions = new Set([
  "deleteWordBackward",
  "deleteWordForward",
  "deleteSoftLineBackward",
  "deleteSoftLineForward",
  "deleteHardLineBackward",
  "deleteHardLineForward",
]);
type EditorEventMap = {
  focus: FocusEvent;
  blur: FocusEvent;
  pointerdown: PointerEvent;
  beforeinput: InputEvent;
  input: Event;
  compositionstart: CompositionEvent;
  compositionupdate: CompositionEvent;
  compositionend: CompositionEvent;
  copy: ClipboardEvent;
  cut: ClipboardEvent;
  paste: ClipboardEvent;
  dragover: DragEvent;
  drop: DragEvent;
  keydown: KeyboardEvent;
};

/** 同时供原生输入与 DOM Range 使用，段落边界与软换行各占一个 UTF-16 单位。 */
export function presentationEditorText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  if (node.nodeType === 1) {
    const element = node as Element;
    if (element.hasAttribute("data-text-placeholder")) return "";
    if (element.localName === "br") return "\n";
  }
  let result = "",
    seen = false;
  for (const child of Array.from(node.childNodes)) {
    const block =
      child.nodeType === 1 && blocks.has((child as Element).localName);
    if (block && seen) result += "\n";
    result += presentationEditorText(child);
    seen = true;
  }
  return result;
}

export function presentationEditorOffset(
  root: HTMLElement,
  node: Node,
  offset: number,
): number | undefined {
  if (!root.contains(node) && node !== root) return;
  try {
    const range = root.ownerDocument.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    return presentationEditorText(range.cloneContents()).length;
  } catch {
    return;
  }
}

function point(
  root: HTMLElement,
  position: PresentationTextPosition,
): [Node, number] | undefined {
  const paragraph = root.querySelector<HTMLElement>(
    `[data-text-paragraph="${position.paraIndex}"]`,
  );
  const run = paragraph?.querySelector<HTMLElement>(
    `[data-text-run="${position.runIndex}"]`,
  );
  if (!run || !paragraph) return;
  if (run.localName === "br")
    return [
      paragraph,
      Array.from(paragraph.childNodes).indexOf(run) + position.charIndex,
    ];
  if (!run.firstChild) run.append(root.ownerDocument.createTextNode(""));
  return [run.firstChild!, position.charIndex];
}

function restoreSelection(
  root: HTMLElement,
  editor: PresentationTextEditorState,
) {
  const selection = root.ownerDocument.getSelection();
  const anchor = point(root, editor.anchor),
    caret = point(root, editor.caret);
  if (!selection || !anchor || !caret) return;
  selection.setBaseAndExtent(...anchor, ...caret);
}

function applyRunStyle(target: HTMLElement, source?: Element) {
  if (!source) return;
  const size = source.getAttribute("sz"),
    bold = source.getAttribute("b"),
    italic = source.getAttribute("i");
  if (size && Number.isFinite(Number(size)))
    target.style.fontSize = `${Number(size) / 75}px`;
  if (bold !== null)
    target.style.fontWeight = ["1", "true"].includes(bold) ? "bold" : "normal";
  if (italic !== null)
    target.style.fontStyle = ["1", "true"].includes(italic)
      ? "italic"
      : "normal";
  const rgb = one(
    one(source, a, "solidFill") ?? source,
    a,
    "srgbClr",
  )?.getAttribute("val");
  if (rgb && /^[0-9a-f]{6}$/i.test(rgb)) target.style.color = `#${rgb}`;
  const font = one(source, a, "latin")?.getAttribute("typeface");
  if (font) target.style.fontFamily = font;
  const decoration = [];
  if (source.getAttribute("u") && source.getAttribute("u") !== "none")
    decoration.push("underline");
  if (
    source.getAttribute("strike") &&
    source.getAttribute("strike") !== "noStrike"
  )
    decoration.push("line-through");
  if (decoration.length) target.style.textDecoration = decoration.join(" ");
}

function render(root: HTMLElement, editor: PresentationTextEditorState) {
  const body = new DOMParser().parseFromString(
    editor.bodyXml,
    "application/xml",
  ).documentElement;
  const paragraphs = children(body, a, "p"),
    properties = paragraphs.map((paragraph) => one(paragraph, a, "pPr")),
    markers = presentationTextParagraphMarkers(properties);
  const nodes = paragraphs.map((paragraph, paraIndex) => {
    const container = root.ownerDocument.createElement("div");
    container.dataset.textParagraph = String(paraIndex);
    container.style.minHeight = "1em";
    const property = properties[paraIndex];
    for (const [name, value] of Object.entries(
      presentationTextParagraphStyles(property),
    ))
      container.style.setProperty(name, value);
    const lineHeight = presentationTextParagraphLineHeight(property);
    if (lineHeight !== undefined) container.style.lineHeight = lineHeight;
    const marker = markers[paraIndex];
    if (marker) {
      container.style.display = "list-item";
      container.style.listStyleType = marker.cssType;
      container.style.listStylePosition = "inside";
      if (marker.ordinal !== undefined)
        container.style.setProperty(
          "counter-set",
          `list-item ${marker.ordinal}`,
        );
    }
    const runs = textRuns(paragraph);
    runs.forEach((run, runIndex) => {
      const node = root.ownerDocument.createElement(
        run.localName === "br" ? "br" : "span",
      );
      node.dataset.textRun = String(runIndex);
      if (run.localName !== "br") node.textContent = runText(run);
      applyRunStyle(node, property ? one(property, a, "defRPr") : undefined);
      applyRunStyle(node, one(run, a, "rPr"));
      container.append(node);
    });
    if (!runs.length) {
      const empty = root.ownerDocument.createElement("span");
      empty.dataset.textRun = "0";
      container.append(empty);
    }
    if (!container.textContent && !container.querySelector("br")) {
      const placeholder = root.ownerDocument.createElement("br");
      placeholder.dataset.textPlaceholder = "";
      container.append(placeholder);
    }
    return container;
  });
  root.replaceChildren(...nodes);
}

/** 宿主只创建受控 DOM；实际范围、片段和保存意图归文本 Controller。 */
export function installPresentationTextEditor({
  mount,
  controller,
  label,
  style,
}: {
  mount: HTMLElement;
  controller: PresentationController;
  label: string;
  style: Partial<CSSStyleDeclaration>;
}) {
  const root = mount.ownerDocument.createElement("div");
  root.contentEditable = "true";
  root.setAttribute("contenteditable", "true");
  root.setAttribute("role", "textbox");
  root.setAttribute("aria-multiline", "true");
  root.setAttribute("aria-label", label);
  root.dataset.presentationTextEditor = "";
  Object.assign(root.style, style, {
    whiteSpace: "pre-wrap",
    overflow: "auto",
    outline: "none",
    cursor: "text",
    userSelect: "text",
    touchAction: "auto",
  });
  let composing = false,
    rendering = false,
    disposed = false,
    rejectNextInput = false;
  let renderedXml: string | undefined;
  const document = root.ownerDocument;
  const events = new (
    document.defaultView?.AbortController ?? AbortController
  )();
  const listen = <K extends keyof EditorEventMap>(
    name: K,
    handler: (event: EditorEventMap[K]) => void,
  ) => root.addEventListener(name, handler, { signal: events.signal });
  const editorFocused = () => {
    const frame = document.defaultView?.frameElement;
    return (
      document.activeElement === root &&
      (!frame || frame.ownerDocument.activeElement === frame)
    );
  };
  const synchronizeSelection = () => {
    if (disposed || rendering || composing || !editorFocused()) return false;
    const selection = document.getSelection();
    if (!selection?.anchorNode || !selection.focusNode) return false;
    const anchor = presentationEditorOffset(
      root,
      selection.anchorNode,
      selection.anchorOffset,
    );
    const caret = presentationEditorOffset(
      root,
      selection.focusNode,
      selection.focusOffset,
    );
    if (anchor === undefined || caret === undefined) return false;
    try {
      const from = controller.textPositionAtOffset(anchor),
        to = controller.textPositionAtOffset(caret);
      return !!from && !!to && controller.textSetSelection(from, to);
    } catch {
      /* 原生组合中的未稳定 Unicode 边界留给 compositionend。 */
      return false;
    }
  };
  const selectDeletionTarget = (event: InputEvent) => {
    if (
      !editorFocused() ||
      typeof event.getTargetRanges !== "function" ||
      presentationEditorText(root) !==
        controller.getSnapshot().textEditor?.value
    )
      return false;
    const ranges = event.getTargetRanges();
    if (ranges.length !== 1) return false;
    const range = ranges[0],
      start = presentationEditorOffset(
        root,
        range.startContainer,
        range.startOffset,
      ),
      end = presentationEditorOffset(root, range.endContainer, range.endOffset);
    if (start === undefined || end === undefined || start >= end) return false;
    const from = controller.textPositionAtOffset(start),
      to = controller.textPositionAtOffset(end);
    return !!from && !!to && controller.textSetSelection(from, to);
  };
  const refresh = () => {
    const editor = controller.getSnapshot().textEditor;
    if (!editor || composing || disposed) return;
    rendering = true;
    try {
      if (editor.bodyXml !== renderedXml) {
        render(root, editor);
        renderedXml = editor.bodyXml;
      }
      if (editorFocused()) restoreSelection(root, editor);
    } finally {
      rendering = false;
    }
  };
  const recover = () => {
    renderedXml = undefined;
    refresh();
  };
  const canonical = (action: () => boolean) => {
    try {
      if (!action()) recover();
    } catch {
      recover();
    }
    refresh();
  };
  const toggleStyle = (property: "bold" | "italic") => {
    const editor = controller.getSnapshot().textEditor;
    return (
      !!editor &&
      controller.textApplyStyle({ [property]: !editor.style[property] })
    );
  };
  const nativeInput = (compositionEnd = false) => {
    if (composing) return;
    const selection = document.getSelection();
    const anchor = selection?.anchorNode
      ? presentationEditorOffset(
          root,
          selection.anchorNode,
          selection.anchorOffset,
        )
      : undefined;
    const caret = selection?.focusNode
      ? presentationEditorOffset(
          root,
          selection.focusNode,
          selection.focusOffset,
        )
      : anchor;
    try {
      if (!compositionEnd && (!editorFocused() || rejectNextInput)) return;
      const value = presentationEditorText(root);
      if (compositionEnd)
        controller.textHandleCompositionEnd(value, anchor, caret);
      else controller.textHandleInput(value, anchor, caret);
    } catch {
      /* 拒绝的原生输入不能留在 DOM；下一轮从 canonical 稿恢复。 */
    } finally {
      rejectNextInput = false;
      recover();
    }
  };
  const inTextControls = (element: Element | null | undefined) =>
    !!element?.closest("[data-presentation-text-controls]");
  const commitOutside = () =>
    queueMicrotask(() => {
      if (disposed || composing || editorFocused()) return;
      const frame = document.defaultView?.frameElement;
      if (
        inTextControls(document.activeElement) ||
        inTextControls(frame?.ownerDocument.activeElement)
      )
        return;
      canonical(() => controller.commitTextEdit());
    });
  const restoreFocusSelection = () => {
    const editor = controller.getSnapshot().textEditor;
    if (editor && !composing && editorFocused()) restoreSelection(root, editor);
  };
  listen("focus", restoreFocusSelection);
  // iframe 内的 activeElement 可在外层 toolbar 获焦期间保留，回焦只触发窗口事件。
  document.defaultView?.addEventListener("focus", restoreFocusSelection, {
    signal: events.signal,
  });
  document.defaultView?.addEventListener("blur", commitOutside, {
    signal: events.signal,
  });
  listen("pointerdown", (event) => event.stopPropagation());
  listen("beforeinput", (event) => {
    event.stopPropagation();
    if (composing || event.isComposing) return;
    const nativeText = [
      "insertText",
      "insertReplacementText",
      "insertParagraph",
      "insertLineBreak",
      "deleteContentBackward",
      "deleteContentForward",
      "deleteContent",
      "deleteByCut",
    ].includes(event.inputType);
    rejectNextInput = true;
    if (!event.cancelable && nativeText) {
      rejectNextInput = false;
      return;
    }
    event.preventDefault();
    if (rangedDeletions.has(event.inputType)) {
      canonical(
        () =>
          selectDeletionTarget(event) &&
          controller.textHandleBeforeInput("deleteContent"),
      );
      return;
    }
    if (!synchronizeSelection()) {
      recover();
      return;
    }
    canonical(() =>
      event.inputType === "formatBold"
        ? toggleStyle("bold")
        : event.inputType === "formatItalic"
          ? toggleStyle("italic")
          : event.inputType === "insertFromDrop"
            ? false
            : controller.textHandleBeforeInput(event.inputType, event.data),
    );
  });
  listen("input", (event) => {
    event.stopPropagation();
    nativeInput();
  });
  listen("compositionstart", (event) => {
    event.stopPropagation();
    if (!synchronizeSelection()) recover();
    rejectNextInput = false;
    composing = true;
  });
  listen("compositionupdate", (event) => event.stopPropagation());
  listen("compositionend", (event) => {
    event.stopPropagation();
    composing = false;
    nativeInput(true);
    rejectNextInput = true;
    commitOutside();
  });
  listen("paste", (event) => {
    event.preventDefault();
    event.stopPropagation();
    rejectNextInput = true;
    if (composing) return;
    canonical(() => {
      if (!event.clipboardData || !synchronizeSelection()) return false;
      return controller.textHandlePaste(
        event.clipboardData.getData("text/plain"),
        event.clipboardData.getData("text/html"),
      );
    });
  });
  for (const name of ["copy", "cut"] as const)
    listen(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (composing) return;
      canonical(() => {
        if (!synchronizeSelection()) return false;
        const editor = controller.getSnapshot().textEditor;
        if (!event.clipboardData || !editor?.selectedPlainText) return false;
        event.clipboardData.setData("text/plain", editor.selectedPlainText);
        event.clipboardData.setData("text/html", editor.selectedHtml);
        if (name !== "cut") return true;
        rejectNextInput = true;
        return controller.textHandleBeforeInput("deleteByCut");
      });
    });
  for (const name of ["dragover", "drop"] as const)
    listen(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (name === "drop") {
        rejectNextInput = true;
        recover();
      }
    });
  listen("keydown", (event) => {
    event.stopPropagation();
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      controller.cancelTextEdit();
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      controller.commitTextEdit();
    }
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      void controller.flushPublicFile();
    }
    if (["b", "i"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      canonical(
        () =>
          synchronizeSelection() &&
          toggleStyle(event.key.toLowerCase() === "b" ? "bold" : "italic"),
      );
    }
    if (["z", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      const redo = event.key.toLowerCase() === "y" || event.shiftKey;
      canonical(
        () =>
          synchronizeSelection() &&
          controller.textHandleBeforeInput(
            redo ? "historyRedo" : "historyUndo",
          ),
      );
    }
  });
  listen("blur", (event) => {
    if (composing) return;
    const destination = event.relatedTarget as Element | null;
    if (inTextControls(destination)) return;
    commitOutside();
  });
  document.addEventListener("selectionchange", synchronizeSelection);
  mount.append(root);
  const unsubscribe = controller.subscribe(refresh);
  refresh();
  root.focus();
  const editor = controller.getSnapshot().textEditor;
  if (editor) restoreSelection(root, editor);
  return () => {
    disposed = true;
    events.abort();
    unsubscribe();
    document.removeEventListener("selectionchange", synchronizeSelection);
    root.remove();
  };
}
