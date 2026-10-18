import { atom } from "jotai/vanilla";
import { readFileBytes, writeFileBytes } from "@/lib/api/fileBrowser";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import {
  importPresentationDocument,
  type PresentationSnapshot,
} from "./presentationDocument";
import { type PresentationElementEdit } from "./presentationPackage";
import {
  applyPresentationEdits,
  type PresentationEdit,
} from "./presentationEdits";
import type { PresentationSlideEdit } from "./presentationSlidesPackage";
import { presentationElements } from "./presentationElements";
import type { PresentationTableEdit } from "./presentationTablePackage";
import {
  presentationTableInteraction,
  clampPresentationTableSelection,
} from "./presentationTableInteraction";

import {
  presentationTableSnapshot,
  type PresentationTableSelection,
  type PresentationTableSnapshot,
  type PresentationTableInteraction,
} from "./presentationTableSelection";

import {
  presentationElementController,
  presentationElementTargets,
  presentationElementFrameEdits,
} from "./presentationElementController";
import { normalizePresentationElementSelection } from "./presentationElementSelection";
import type { PresentationElementInteraction } from "./presentationElementInteraction";
import type { PresentationSelectionMarquee } from "./presentationElementSelection";
import {
  presentationTextController,
  type PresentationTextEditorState,
} from "./presentationTextController";

type TableEditAction = PresentationTableEdit extends infer Edit
  ? Edit extends PresentationTableEdit
    ? Omit<Edit, "slideId">
    : never
  : never;

export interface PresentationControllerState {
  document: PresentationSnapshot;
  isEditing: boolean;
  selectedSlideId: string;
  selectedElementIds: string[];
  primarySelectedElementId: string | null;
  elementInteraction: PresentationElementInteraction | null;
  selectionMarquee: PresentationSelectionMarquee | null;
  textEditor: PresentationTextEditorState | null;
  tableSelection: PresentationTableSelection | null;
  dirty: boolean;
  projecting: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  renderRevision: number;
  failure: "fileChanged" | "saveFailed" | "invalidEdit" | null;
}
interface Files {
  read: typeof readFileBytes;
  write: typeof writeFileBytes;
}

/** 应用内编辑稿唯一 owner；文件保存仍委托 current 网关。 */
export class PresentationController {
  #base: PresentationSnapshot;
  #persisted: PresentationSnapshot;
  #state: PresentationControllerState;
  #edits: readonly PresentationEdit[] = [];
  #savedEdits = this.#edits;
  #past: (readonly PresentationEdit[])[] = [];
  #future: (readonly PresentationEdit[])[] = [];
  #projection = 0;
  #pending: Promise<boolean> = Promise.resolve(true);
  #saving: Promise<boolean> | null = null;
  #listeners = new Set<() => void>();
  #tableSnapshot: PresentationTableSnapshot = null;
  readonly tableEditing = {
    subscribe: (listener: () => void) => this.subscribe(listener),
    getSnapshot: () => this.#tableSnapshot,
    interact: (interaction: PresentationTableInteraction) =>
      this.#interactTable(interaction),
    edit: (edit: TableEditAction) => {
      if (
        !this.#canEdit() ||
        this.#state.selectedElementIds.length !== 1 ||
        edit.tableId !== this.#state.primarySelectedElementId ||
        !this.commitTextEdit()
      )
        return false;
      return this.#applyTable({
        ...edit,
        slideId: this.#state.selectedSlideId,
      });
    },
  };
  #textActions = presentationTextController({
    getSnapshot: () => this.#state,
    canEdit: () => this.#canEdit(),
    update: (patch) => this.#update(patch),
    hasEdits: () => this.#edits !== this.#savedEdits,
    apply: (value) => {
      if (
        !this.#state.isEditing ||
        this.#state.saving ||
        this.#state.elementInteraction ||
        this.#state.selectionMarquee
      )
        return false;
      this.#record({ kind: "text", value });
      this.#rebuild();
      return true;
    },
  });
  textActivateBlockEnd = this.#textActions.textActivateBlockEnd;
  textSetSelection = this.#textActions.textSetSelection;
  textHandleInput = this.#textActions.textHandleInput;
  textHandleCompositionEnd = this.#textActions.textHandleCompositionEnd;
  textHandleBeforeInput = this.#textActions.textHandleBeforeInput;
  textHandlePaste = this.#textActions.textHandlePaste;
  textApplyStyle = this.#textActions.textApplyStyle;
  textClear = this.#textActions.textClear;
  textPositionAtOffset = this.#textActions.textPositionAtOffset;
  textOffsetAtPosition = this.#textActions.textOffsetAtPosition;
  commitTextEdit = this.#textActions.commitTextEdit;
  cancelTextEdit = this.#textActions.cancelTextEdit;
  #elementActions = presentationElementController({
    getSnapshot: () => this.#state,
    elements: () => this.#elements(),
    update: (patch) => this.#update(patch),
    canEdit: () => this.#canEdit(),
    commitTextEdit: () => this.commitTextEdit(),
    apply: (edits) => this.#applyElements(edits),
  });
  setSelectedElementId = this.#elementActions.setSelectedElementId;
  toggleSelectedElementId = this.#elementActions.toggleSelectedElementId;
  selectAllSlideElements = this.#elementActions.selectAllSlideElements;
  beginSelectionMarquee = this.#elementActions.beginSelectionMarquee;
  updateSelectionMarquee = this.#elementActions.updateSelectionMarquee;
  endSelectionMarquee = this.#elementActions.endSelectionMarquee;
  beginElementInteraction = this.#elementActions.beginElementInteraction;
  updateElementInteraction = this.#elementActions.updateElementInteraction;
  endElementInteraction = this.#elementActions.endElementInteraction;
  cancelElementInteraction = this.#elementActions.cancelElementInteraction;
  nudgeSelectedElements = this.#elementActions.nudgeSelectedElements;
  reorderSelectedElement = this.#elementActions.reorderSelectedElement;
  constructor(
    readonly path: string,
    document: PresentationSnapshot,
    private readonly files: Files = {
      read: readFileBytes,
      write: writeFileBytes,
    },
  ) {
    this.#base = document;
    this.#persisted = document;
    this.#state = {
      document,
      isEditing: false,
      selectedSlideId: document.slideIds[0] ?? "",
      selectedElementIds: [],
      primarySelectedElementId: null,
      elementInteraction: null,
      selectionMarquee: null,
      textEditor: null,
      tableSelection: null,
      dirty: false,
      projecting: false,
      saving: false,
      canUndo: false,
      canRedo: false,
      renderRevision: 0,
      failure: null,
    };
  }
  getSnapshot = () => this.#state;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  receiveDocument(document: PresentationSnapshot) {
    if (this.#state.saving) return;
    if (document.sourceSha256 !== this.#persisted.sourceSha256)
      this.cancelElementInteraction();
    if (this.#state.dirty) {
      if (document.sourceSha256 !== this.#persisted.sourceSha256)
        this.#update({ failure: "fileChanged" });
      return;
    }
    if (document.sourceSha256 === this.#persisted.sourceSha256) return;
    this.cancelElementInteraction();
    ++this.#projection;
    this.#pending = Promise.resolve(true);
    this.#base = document;
    this.#persisted = document;
    this.#past = [];
    this.#future = [];
    this.#edits = [];
    this.#savedEdits = this.#edits;
    this.#update({
      document,
      selectedSlideId: document.slideIds.includes(this.#state.selectedSlideId)
        ? this.#state.selectedSlideId
        : (document.slideIds[0] ?? ""),
      projecting: false,
      failure: null,
      canUndo: false,
      canRedo: false,
      renderRevision: this.#state.renderRevision + 1,
    });
  }
  setEditingEnabled(value: boolean) {
    if (!value) {
      this.cancelElementInteraction();
      this.commitTextEdit();
    }
    this.#update({ isEditing: value });
  }
  setSelectedSlideIdx(index: number) {
    const slideId = this.#state.document.slideIds[index];
    if (!slideId) return;
    this.cancelElementInteraction();
    this.commitTextEdit();
    this.#update({
      selectedSlideId: slideId,
      selectedElementIds: [],
      primarySelectedElementId: null,
      elementInteraction: null,
      selectionMarquee: null,
      textEditor: null,
      tableSelection: null,
    });
  }
  updateSelectedElementFrame(
    frame: NonNullable<PresentationElementEdit["frame"]>,
  ) {
    if (this.#state.selectedElementIds.length !== 1) return false;
    const elementId = this.#state.primarySelectedElementId;
    const node = this.#elements().find((element) => element.id === elementId);
    if (
      node?.nodeType === "table" &&
      (!Object.values(frame).every(Number.isFinite) ||
        frame.width <= 0 ||
        frame.height <= 0)
    )
      return false;
    if (!elementId || !this.#canEdit() || !this.commitTextEdit()) return false;
    return this.#applyElements([
      { slideId: this.#state.selectedSlideId, elementId, frame },
    ]);
  }
  updateSelectedElementStyle(
    style: NonNullable<PresentationElementEdit["style"]>,
  ) {
    if (this.#state.textEditor) return this.textApplyStyle(style);
    return this.#selectedEdit({ style });
  }
  deleteSelectedElement() {
    if (!this.#canEdit() || !this.commitTextEdit()) return false;
    return this.#applyElements(
      this.#state.selectedElementIds.map((elementId) => ({
        slideId: this.#state.selectedSlideId,
        elementId,
        deleted: true,
      })),
    );
  }
  addSlide(layoutId?: string) {
    return this.#applySlide(
      { type: "add", afterSlideId: this.#state.selectedSlideId, layoutId },
      true,
    );
  }
  duplicateSelectedSlide() {
    return this.#applySlide(
      { type: "duplicate", slideId: this.#state.selectedSlideId },
      true,
    );
  }
  moveSlide(fromIndex: number, toIndex: number) {
    const slideId = this.#state.document.slideIds[fromIndex];
    return !!slideId && this.#applySlide({ type: "move", slideId, toIndex });
  }
  deleteSlide(index: number) {
    const slideId = this.#state.document.slideIds[index];
    if (!slideId || this.#state.document.slideIds.length <= 1) return false;
    return this.#applySlide({ type: "delete", slideId });
  }
  undo() {
    if (this.#state.saving || this.#state.projecting) return;
    if (this.cancelElementInteraction()) return;
    if (this.#state.textEditor) {
      this.textHandleBeforeInput("historyUndo");
      return;
    }
    const edits = this.#past.pop();
    if (!edits) return;
    this.#future.push(this.#edits);
    this.#edits = edits;
    this.#rebuild();
  }
  redo() {
    if (this.#state.saving || this.#state.projecting) return;
    if (this.cancelElementInteraction()) return;
    if (this.#state.textEditor) {
      this.textHandleBeforeInput("historyRedo");
      return;
    }
    const edits = this.#future.pop();
    if (!edits) return;
    this.#past.push(this.#edits);
    this.#edits = edits;
    this.#rebuild();
  }
  discardEdits() {
    if (this.#state.saving) return;
    this.cancelElementInteraction();
    ++this.#projection;
    this.#pending = Promise.resolve(true);
    this.#base = this.#persisted;
    this.#edits = [];
    this.#savedEdits = this.#edits;
    this.#past = [];
    this.#future = [];
    this.#update({
      document: this.#base,
      selectedSlideId: this.#base.slideIds.includes(this.#state.selectedSlideId)
        ? this.#state.selectedSlideId
        : (this.#base.slideIds[0] ?? ""),
      textEditor: null,
      selectedElementIds: [],
      primarySelectedElementId: null,
      elementInteraction: null,
      selectionMarquee: null,
      dirty: false,
      projecting: false,
      failure: null,
      canUndo: false,
      canRedo: false,
      renderRevision: this.#state.renderRevision + 1,
    });
  }
  async flushEdits(): Promise<boolean> {
    if (
      this.#state.elementInteraction ||
      this.#state.selectionMarquee ||
      !this.commitTextEdit()
    )
      return false;
    return this.#pending;
  }
  flushPublicFile(): Promise<boolean> {
    if (this.#saving) return this.#saving;
    if (this.#state.elementInteraction || this.#state.selectionMarquee)
      return Promise.resolve(false);
    if (!this.commitTextEdit()) return Promise.resolve(false);
    this.#update({ saving: true });
    this.#saving = this.#save().finally(() => {
      this.#saving = null;
      this.#update({ saving: false });
    });
    return this.#saving;
  }
  async #save(): Promise<boolean> {
    if (!(await this.#pending)) return false;
    this.#update({ failure: null });
    if (this.#edits === this.#savedEdits) return true;
    const captured = this.#edits;
    const base = this.#base;
    const expectedSha256 = this.#persisted.sourceSha256;
    try {
      const original = await this.files.read(this.path);
      if ((await hashFileBytes(original)) !== expectedSha256) {
        this.#update({ failure: "fileChanged" });
        return false;
      }
      const { bytes } = await applyPresentationEdits(
        base.sourceBytes,
        captured,
      );
      const document = await importPresentationDocument(
        bytes,
        new AbortController().signal,
      );
      if (
        (await hashFileBytes(await this.files.read(this.path))) !==
        expectedSha256
      ) {
        this.#update({ failure: "fileChanged" });
        return false;
      }
      await this.files.write(this.path, bytes);
      this.#persisted = document;
      this.#savedEdits = captured;
      this.#update({
        document,
        dirty: this.#edits !== this.#savedEdits,
        failure: null,
        canUndo: this.#past.length > 0,
        canRedo: this.#future.length > 0,
        renderRevision: this.#state.renderRevision + 1,
      });
      return true;
    } catch {
      this.#update({ failure: "saveFailed" });
      return false;
    }
  }
  #elements() {
    return presentationElements(
      this.#state.document,
      this.#state.selectedSlideId,
    );
  }
  #canEdit() {
    return (
      this.#state.isEditing &&
      !this.#state.saving &&
      !this.#state.projecting &&
      !this.#state.elementInteraction &&
      !this.#state.selectionMarquee
    );
  }
  #applyTable(
    edit: PresentationTableEdit,
    selection = this.#state.tableSelection,
  ): boolean {
    if (
      !this.#state.isEditing ||
      this.#state.saving ||
      this.#state.elementInteraction ||
      this.#state.selectionMarquee
    )
      return false;
    this.#record({ kind: "table", value: edit });
    this.#rebuild(false, selection);
    return true;
  }
  #interactTable(interaction: PresentationTableInteraction): boolean {
    if (!this.#canEdit()) return false;
    const table = this.#elements().find(
      (element) => element.id === interaction.tableId,
    );
    if (table?.nodeType !== "table") return false;
    const result = presentationTableInteraction(
      table,
      this.#state.tableSelection,
      interaction,
    );
    if (!result || !this.commitTextEdit()) return false;
    if (result.move)
      return this.#applyTable(
        {
          type: result.move.axis === "row" ? "move-row" : "move-column",
          slideId: this.#state.selectedSlideId,
          tableId: table.id,
          index: result.move.index,
          insertionIndex: result.move.insertionIndex,
        },
        result.selection,
      );
    if (result.appendRow !== undefined)
      return this.#applyTable(
        {
          type: "insert-rows",
          slideId: this.#state.selectedSlideId,
          tableId: table.id,
          index: result.appendRow,
        },
        result.selection,
      );
    this.#update({
      selectedElementIds: [table.id],
      primarySelectedElementId: table.id,
      textEditor: null,
      tableSelection: result.selection,
    });
    return true;
  }
  #selectedEdit(edit: Omit<PresentationElementEdit, "slideId" | "elementId">) {
    const elementId = this.#state.primarySelectedElementId;
    return (
      !!elementId &&
      this.#state.selectedElementIds.length === 1 &&
      this.#canEdit() &&
      this.commitTextEdit() &&
      this.#apply({ ...edit, slideId: this.#state.selectedSlideId, elementId })
    );
  }
  #apply(edit: PresentationElementEdit): boolean {
    if (
      !this.#state.isEditing ||
      this.#state.saving ||
      this.#state.elementInteraction ||
      this.#state.selectionMarquee
    )
      return false;
    this.#record({ kind: "element", value: edit });
    this.#rebuild();
    return true;
  }
  #applyElements(edits: readonly PresentationElementEdit[]): boolean {
    if (!edits.length || !this.#canEdit()) return false;
    this.#record(...presentationElementFrameEdits(this.#elements(), edits));
    this.#rebuild();
    return true;
  }
  #applySlide(edit: PresentationSlideEdit, selectCreated = false): boolean {
    this.cancelElementInteraction();
    if (!this.#state.isEditing || this.#state.saving || this.#state.projecting)
      return false;
    if (!this.commitTextEdit()) return false;
    this.#record({ kind: "slide", value: edit });
    this.#rebuild(selectCreated);
    return true;
  }
  #record(...edits: PresentationEdit[]) {
    this.#past.push(this.#edits);
    if (this.#past.length > 100) this.#past.shift();
    this.#future = [];
    this.#edits = [...this.#edits, ...edits];
  }
  #rebuild(selectCreated = false, tableSelection = this.#state.tableSelection) {
    const projection = ++this.#projection;
    const edits = this.#edits;
    const base = this.#base;
    const previousIndex = this.#state.document.slideIds.indexOf(
      this.#state.selectedSlideId,
    );
    this.#update({
      dirty: edits !== this.#savedEdits,
      projecting: true,
      failure: null,
      canUndo: this.#past.length > 0,
      canRedo: this.#future.length > 0,
    });
    this.#pending = (async () => {
      try {
        const { bytes, createdSlideIds } = await applyPresentationEdits(
          base.sourceBytes,
          edits,
        );
        const document = await importPresentationDocument(
          bytes,
          new AbortController().signal,
        );
        if (projection !== this.#projection) return false;
        const selectedSlideId =
          selectCreated && createdSlideIds.length
            ? createdSlideIds.at(-1)!
            : document.slideIds.includes(this.#state.selectedSlideId)
              ? this.#state.selectedSlideId
              : document.slideIds[
                  Math.min(
                    Math.max(0, previousIndex),
                    document.slideIds.length - 1,
                  )
                ];
        const selection = normalizePresentationElementSelection(
          presentationElementTargets(
            presentationElements(document, selectedSlideId),
          ),
          selectedSlideId === this.#state.selectedSlideId ? this.#state : null,
        );
        const table =
          selection.selectedElementIds.length === 1
            ? presentationElements(document, selectedSlideId).find(
                (node) => node.id === selection.primarySelectedElementId,
              )
            : undefined;
        this.#update({
          tableSelection:
            table?.nodeType === "table"
              ? clampPresentationTableSelection(table, tableSelection)
              : null,
          document: { ...document, sourceSha256: this.#persisted.sourceSha256 },
          projecting: false,
          renderRevision: this.#state.renderRevision + 1,
          selectedSlideId,
          ...selection,
        });
        return true;
      } catch {
        if (projection === this.#projection)
          this.#update({ projecting: false, failure: "invalidEdit" });
        return false;
      }
    })();
  }
  #update(patch: Partial<PresentationControllerState>) {
    this.#state = { ...this.#state, ...patch };
    if (
      patch.document ||
      "selectedElementIds" in patch ||
      "primarySelectedElementId" in patch ||
      "selectedSlideId" in patch ||
      "elementInteraction" in patch ||
      "selectionMarquee" in patch ||
      "tableSelection" in patch
    ) {
      const selection = normalizePresentationElementSelection(
        presentationElementTargets(this.#elements()),
        this.#state,
      );
      this.#state = { ...this.#state, ...selection };
      const node =
        this.#state.selectedElementIds.length === 1 &&
        !this.#state.elementInteraction &&
        !this.#state.selectionMarquee
          ? this.#elements().find(
              (element) => element.id === this.#state.primarySelectedElementId,
            )
          : undefined;
      this.#tableSnapshot =
        node?.nodeType === "table"
          ? presentationTableSnapshot(
              node,
              this.#state.tableSelection?.tableId === node.id
                ? this.#state.tableSelection
                : null,
              this.#state.document.model,
              this.#state.document.model.slides[
                this.#state.document.slideIds.indexOf(
                  this.#state.selectedSlideId,
                )
              ],
            )
          : null;
      if (!this.#tableSnapshot?.selection) this.#state.tableSelection = null;
    }
    for (const listener of this.#listeners) listener();
  }
}

export const presentationControllersAtom = atom(
  () => new Map<string, PresentationController>(),
);
