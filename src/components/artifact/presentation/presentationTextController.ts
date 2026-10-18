import type { PresentationControllerState } from "./PresentationController";
import type { PresentationTextEdit } from "./presentationTextEditPackage";
import { readPresentationTextBlock } from "./presentationTextDocument";
import {
  createPresentationTextRangeAdapter,
  type PresentationTextPosition,
} from "./presentationTextRange";
import {
  cloneElement,
  paragraphWithRuns,
  presentationTextContent,
  textRun,
  textRuns,
  validateTextInput,
} from "./presentationTextRangeXml";
import { a, r, children, create, one } from "./presentationPackageXml";
import {
  applyTextStyle,
  replaceText,
  type PresentationTextStyle,
} from "./presentationTextPackage";
import { presentationTextSelection } from "./presentationTextSelection";
import { applyPresentationTextRangeStyle } from "./presentationTextStyle";
import {
  parsePresentationTextHtml,
  serializePresentationTextFragment,
} from "./presentationTextHtml";
import { presentationElements } from "./presentationElements";
import {
  presentationTableCells,
  presentationTableCellAt,
} from "./presentationTableSelection";

export type PresentationTextTarget =
  | string
  | { tableId: string; row: number; column: number };

export interface PresentationTextEditorState {
  slideId: string;
  elementId: string;
  cell?: { row: number; column: number };
  blockId: string;
  bodyXml: string;
  value: string;
  anchor: PresentationTextPosition;
  caret: PresentationTextPosition;
  selection: readonly {
    paraIndex: number;
    runIndex: number;
    start: number;
    end: number;
  }[];
  selectedPlainText: string;
  selectedHtml: string;
  revision: number;
  typingStyle: PresentationTextStyle;
  style: PresentationTextStyle;
  canUndo: boolean;
  canRedo: boolean;
}

interface Host {
  getSnapshot(): PresentationControllerState;
  canEdit(): boolean;
  update(patch: Partial<PresentationControllerState>): void;
  hasEdits(): boolean;
  apply(edit: PresentationTextEdit): boolean;
}

const xml = (body: Element) => new XMLSerializer().serializeToString(body);

interface TextDraftCheckpoint {
  body: Element;
  anchor: PresentationTextPosition;
  caret: PresentationTextPosition;
  typingStyle: PresentationTextStyle;
  hyperlinks: { id: string; url: string }[];
}

function selectionStyle(
  body: Element,
  editor: Pick<PresentationTextEditorState, "selection" | "caret">,
): PresentationTextStyle {
  const positions = editor.selection.length ? editor.selection : [editor.caret];
  const styles = positions.map(({ paraIndex, runIndex }) => {
    const paragraph = children(body, a, "p")[paraIndex];
    const run = paragraph && textRuns(paragraph)[runIndex];
    const properties = run && one(run, a, "rPr");
    const paragraphProperties = paragraph && one(paragraph, a, "pPr");
    const defaults =
      paragraphProperties && one(paragraphProperties, a, "defRPr");
    const attribute = (name: string) =>
      properties?.getAttribute(name) ?? defaults?.getAttribute(name);
    const size = attribute("sz");
    const fill =
      (properties && one(properties, a, "solidFill")) ??
      (defaults && one(defaults, a, "solidFill"));
    const color = fill && one(fill, a, "srgbClr")?.getAttribute("val");
    return {
      bold: ["1", "true"].includes(attribute("b") ?? ""),
      italic: ["1", "true"].includes(attribute("i") ?? ""),
      ...(size ? { fontSize: Number(size) / 75 } : {}),
      ...(color && /^[0-9a-f]{6}$/i.test(color) ? { color } : {}),
    };
  });
  const result: PresentationTextStyle = {};
  for (const property of ["bold", "italic", "fontSize", "color"] as const) {
    const value = styles[0]?.[property];
    if (
      value !== undefined &&
      styles.every((style) => style[property] === value)
    )
      Object.assign(result, { [property]: value });
    else if (property === "bold" || property === "italic")
      result[property] = false;
  }
  return result;
}

/** 文本范围与临时 body 委托同一 Controller 的历史、投影及保存。 */
export function presentationTextController(host: Host) {
  let draft:
    | {
        block: NonNullable<ReturnType<typeof readPresentationTextBlock>>;
        body: Element;
        originalXml: string;
        hyperlinks: { id: string; url: string }[];
      }
    | undefined;
  let past: TextDraftCheckpoint[] = [],
    future: TextDraftCheckpoint[] = [];

  function checkpoint(): TextDraftCheckpoint | undefined {
    const editor = host.getSnapshot().textEditor;
    if (!draft || !editor) return;
    return {
      body: cloneElement(draft.body),
      anchor: { ...editor.anchor },
      caret: { ...editor.caret },
      typingStyle: { ...editor.typingStyle },
      hyperlinks: draft.hyperlinks.map((link) => ({ ...link })),
    };
  }

  function remember(previous?: TextDraftCheckpoint) {
    if (!previous) return;
    past.push(previous);
    future = [];
  }

  function restoreDraft(redo: boolean) {
    if (!draft || !canUseDraft()) return false;
    const previous = checkpoint();
    const target = (redo ? future : past).pop();
    if (!previous || !target) return false;
    (redo ? past : future).push(previous);
    draft.hyperlinks = target.hyperlinks.map((link) => ({ ...link }));
    publish(
      cloneElement(target.body),
      target.anchor,
      target.caret,
      target.typingStyle,
    );
    return true;
  }

  const canUseDraft = () => {
    const state = host.getSnapshot();
    return (
      state.isEditing &&
      !state.saving &&
      !state.elementInteraction &&
      !state.selectionMarquee
    );
  };

  function publish(
    body: Element,
    anchor: PresentationTextPosition,
    caret = anchor,
    typingStyle = host.getSnapshot().textEditor?.typingStyle ?? {},
  ) {
    if (!draft) return;
    const selection = presentationTextSelection(
      body,
      draft.block.blockId,
      anchor,
      caret,
    );
    const adapter = createPresentationTextRangeAdapter(
      body,
      draft.block.blockId,
    );
    const bodyXml = xml(body);
    const previous = host.getSnapshot().textEditor;
    const fragment = adapter.getRangeFragment(anchor, caret);
    draft.body = body;
    host.update({
      textEditor: {
        slideId: draft.block.slideId,
        elementId: draft.block.elementId,
        ...(draft.block.cell ? { cell: draft.block.cell } : {}),
        blockId: draft.block.blockId,
        bodyXml,
        value: presentationTextContent(body),
        ...selection,
        selectedHtml: selection.selectedPlainText
          ? serializePresentationTextFragment(
              fragment,
              (id) =>
                draft?.hyperlinks.find((link) => link.id === id)?.url ??
                draft?.block.resolveHyperlink(id),
            )
          : "",
        revision:
          (previous?.revision ?? 0) + (previous?.bodyXml === bodyXml ? 0 : 1),
        typingStyle,
        style: { ...selectionStyle(body, selection), ...typingStyle },
        canUndo: past.length > 0,
        canRedo: future.length > 0,
      },
      dirty: host.hasEdits() || bodyXml !== draft.originalXml,
      failure: null,
    });
  }

  function cancelTextEdit() {
    draft = undefined;
    past = [];
    future = [];
    host.update({ textEditor: null, dirty: host.hasEdits() });
  }

  function commitTextEdit(): boolean {
    if (!host.getSnapshot().textEditor || !draft) return true;
    if (!canUseDraft()) return false;
    const bodyXml = xml(draft.body);
    if (bodyXml === draft.originalXml) {
      cancelTextEdit();
      return true;
    }
    const previous = host.getSnapshot().textEditor;
    host.update({ textEditor: null });
    const referencedLinks = new Set(
      Array.from(draft.body.getElementsByTagNameNS(a, "hlinkClick"), (node) =>
        node.getAttributeNS(r, "id"),
      ),
    );
    const hyperlinks = draft.hyperlinks.filter((link) =>
      referencedLinks.has(link.id),
    );
    if (
      !host.apply({
        slideId: draft.block.slideId,
        elementId: draft.block.elementId,
        ...(draft.block.cell ? { cell: draft.block.cell } : {}),
        bodyXml,
        ...(hyperlinks.length ? { hyperlinks } : {}),
      })
    ) {
      host.update({ textEditor: previous, failure: "invalidEdit" });
      return false;
    }
    draft = undefined;
    past = [];
    future = [];
    return true;
  }

  function textActivateBlockEnd(target: PresentationTextTarget): boolean {
    if (!host.canEdit()) return false;
    const state = host.getSnapshot();
    const elementId = typeof target === "string" ? target : target.tableId;
    let cell =
      typeof target === "string"
        ? undefined
        : { row: target.row, column: target.column };
    if (cell) {
      const element = presentationElements(
        state.document,
        state.selectedSlideId,
      ).find((node) => node.id === elementId);
      const anchor =
        element?.nodeType === "table"
          ? presentationTableCellAt(presentationTableCells(element) ?? [], cell)
          : undefined;
      if (!anchor) return false;
      cell = { row: anchor.row, column: anchor.column };
    }
    const editor = state.textEditor;
    if (
      editor?.elementId === elementId &&
      editor.cell?.row === cell?.row &&
      editor.cell?.column === cell?.column
    )
      return true;
    const block = readPresentationTextBlock(
      state.document,
      state.selectedSlideId,
      elementId,
      cell,
    );
    if (!block || !commitTextEdit()) return false;
    const body = cloneElement(block.body);
    draft = { block, body, originalXml: xml(body), hyperlinks: [] };
    host.update({
      selectedElementIds: [elementId],
      primarySelectedElementId: elementId,
      tableSelection: cell
        ? { tableId: elementId, anchor: cell, focus: cell }
        : null,
    });
    const caret = createPresentationTextRangeAdapter(
      body,
      block.blockId,
    ).positionAtOffset(presentationTextContent(body).length);
    publish(body, caret, caret, {});
    return true;
  }

  function textSetSelection(
    anchor: PresentationTextPosition,
    caret: PresentationTextPosition,
  ) {
    if (!draft || !host.getSnapshot().textEditor || !canUseDraft())
      return false;
    try {
      const previous = host.getSnapshot().textEditor!;
      if (
        JSON.stringify([anchor, caret]) ===
        JSON.stringify([previous.anchor, previous.caret])
      )
        return true;
      publish(draft.body, anchor, caret, {});
      return true;
    } catch {
      return false;
    }
  }

  function mutate(
    change: (
      body: Element,
      editor: PresentationTextEditorState,
    ) => PresentationTextPosition | false,
    hyperlinks: readonly { id: string; url: string }[] = [],
  ) {
    const editor = host.getSnapshot().textEditor;
    if (!draft || !editor || !canUseDraft()) return false;
    try {
      const previous = checkpoint();
      const body = cloneElement(draft.body);
      const caret = change(body, editor);
      if (caret === false) return false;
      if (xml(body) !== xml(draft.body)) remember(previous);
      draft.hyperlinks.push(...hyperlinks);
      publish(body, caret);
      return true;
    } catch {
      host.update({ failure: "invalidEdit" });
      return false;
    }
  }

  function textHandleInput(
    value: string,
    anchorOffset?: number,
    caretOffset = anchorOffset,
  ) {
    const accepted = mutate((body, editor) => {
      const normalized = validateTextInput(value);
      replaceText(body, normalized);
      const adapter = createPresentationTextRangeAdapter(body, editor.blockId);
      const caret = adapter.positionAtOffset(caretOffset ?? normalized.length);
      if (anchorOffset !== undefined) adapter.positionAtOffset(anchorOffset);
      return caret;
    });
    if (
      accepted &&
      draft &&
      anchorOffset !== undefined &&
      anchorOffset !== caretOffset
    ) {
      const editor = host.getSnapshot().textEditor!;
      return textSetSelection(
        createPresentationTextRangeAdapter(
          draft.body,
          editor.blockId,
        ).positionAtOffset(anchorOffset),
        editor.caret,
      );
    }
    return accepted;
  }

  function textHandleBeforeInput(
    inputType: string,
    data: string | null = null,
  ) {
    if (inputType === "historyUndo" || inputType === "historyRedo")
      return restoreDraft(inputType === "historyRedo");
    return mutate((body, editor) => {
      const adapter = createPresentationTextRangeAdapter(body, editor.blockId);
      let start = Math.min(
        adapter.offsetAtPosition(editor.anchor),
        adapter.offsetAtPosition(editor.caret),
      );
      let end = Math.max(
        adapter.offsetAtPosition(editor.anchor),
        adapter.offsetAtPosition(editor.caret),
      );
      const value = presentationTextContent(body);
      let text = data ?? "";
      if (
        [
          "deleteContentBackward",
          "deleteContentForward",
          "deleteByCut",
          "deleteByDrag",
          "deleteContent",
        ].includes(inputType)
      ) {
        if (start === end && inputType !== "deleteByCut") {
          const boundaries = [
            0,
            ...Array.from(
              new Intl.Segmenter(undefined, {
                granularity: "grapheme",
              }).segment(value),
              (segment) => segment.index + segment.segment.length,
            ),
          ];
          if (inputType === "deleteContentBackward")
            start =
              boundaries.filter((offset) => offset < start).at(-1) ?? start;
          else end = boundaries.find((offset) => offset > end) ?? end;
        }
        text = "";
      } else if (inputType === "insertParagraph") text = "\n";
      else if (inputType === "insertLineBreak") {
        const paragraph = children(body, a, "p")[editor.caret.paraIndex];
        const source = textRuns(paragraph)[editor.caret.runIndex];
        const br = create(body, a, "br");
        const properties = source && one(source, a, "rPr");
        if (properties) br.append(cloneElement(properties));
        return adapter.replaceRangeWithFragment(editor.anchor, editor.caret, {
          paragraphs: [paragraphWithRuns(paragraph, [br])],
        });
      } else if (
        ![
          "insertText",
          "insertReplacementText",
          "insertFromPaste",
          "insertFromDrop",
        ].includes(inputType)
      )
        return false;
      const from = adapter.positionAtOffset(start),
        to = adapter.positionAtOffset(end);
      if (!text || !Object.keys(editor.typingStyle).length)
        return adapter.replaceRange(from, to, text);
      const paragraph = children(body, a, "p")[from.paraIndex];
      const source = textRuns(paragraph)[from.runIndex];
      const wrapper = create(body, a, "txBody");
      wrapper.append(create(body, a, "bodyPr"));
      const paragraphs = validateTextInput(text)
        .split("\n")
        .map((part) =>
          paragraphWithRuns(paragraph, [textRun(body, part, source)]),
        );
      wrapper.append(...paragraphs);
      applyTextStyle(wrapper, editor.typingStyle);
      return adapter.replaceRangeWithFragment(from, to, { paragraphs });
    });
  }

  function textHandlePaste(plainText: string, html?: string) {
    const parsed =
      draft && html
        ? parsePresentationTextHtml(html, draft.body.ownerDocument)
        : undefined;
    if (!parsed) return textHandleBeforeInput("insertFromPaste", plainText);
    return mutate(
      (body, editor) =>
        createPresentationTextRangeAdapter(
          body,
          editor.blockId,
        ).replaceRangeWithFragment(
          editor.anchor,
          editor.caret,
          parsed.fragment,
        ),
      parsed.hyperlinks,
    );
  }

  function textApplyStyle(style: PresentationTextStyle) {
    const editor = host.getSnapshot().textEditor;
    if (!draft || !editor || !canUseDraft()) return false;
    const adapter = createPresentationTextRangeAdapter(
      draft.body,
      editor.blockId,
    );
    const anchor = adapter.offsetAtPosition(editor.anchor),
      caret = adapter.offsetAtPosition(editor.caret);
    if (anchor === caret) {
      const wrapper = create(draft.body, a, "txBody");
      wrapper.append(create(draft.body, a, "bodyPr"));
      const paragraph = create(draft.body, a, "p");
      paragraph.append(textRun(draft.body, ""));
      wrapper.append(paragraph);
      try {
        applyTextStyle(wrapper, style);
      } catch {
        return false;
      }
      if (
        Object.entries(style).some(
          ([key, value]) =>
            editor.typingStyle[key as keyof PresentationTextStyle] !== value,
        )
      )
        remember(checkpoint());
      publish(draft.body, editor.anchor, editor.caret, {
        ...editor.typingStyle,
        ...style,
      });
      return true;
    }
    try {
      const body = cloneElement(draft.body);
      if (
        !applyPresentationTextRangeStyle(
          body,
          editor.blockId,
          editor.anchor,
          editor.caret,
          style,
        )
      )
        return false;
      const next = createPresentationTextRangeAdapter(body, editor.blockId);
      if (xml(body) !== xml(draft.body)) remember(checkpoint());
      publish(
        body,
        next.positionAtOffset(anchor),
        next.positionAtOffset(caret),
      );
      return true;
    } catch {
      return false;
    }
  }

  return {
    textActivateBlockEnd,
    textSetSelection,
    textHandleInput,
    textHandleCompositionEnd: textHandleInput,
    textHandleBeforeInput,
    textHandlePaste,
    textApplyStyle,
    textClear: () => textHandleInput(""),
    commitTextEdit,
    cancelTextEdit,
    textPositionAtOffset: (offset: number) =>
      draft
        ? createPresentationTextRangeAdapter(
            draft.body,
            draft.block.blockId,
          ).positionAtOffset(offset)
        : undefined,
    textOffsetAtPosition: (position: PresentationTextPosition) =>
      draft
        ? createPresentationTextRangeAdapter(
            draft.body,
            draft.block.blockId,
          ).offsetAtPosition(position)
        : undefined,
  };
}
