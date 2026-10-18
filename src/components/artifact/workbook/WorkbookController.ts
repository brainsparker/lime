import { isValidWorkbookCellInput } from "./workbookCellValue";
import { atom } from "jotai/vanilla";
import { readFileBytes, writeFileBytes } from "@/lib/api/fileBrowser";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import { editDelimitedWorkbook } from "./delimitedWorkbook";
import {
  copyWorkbookRange,
  pasteWorkbookRange,
  type WorkbookClipboardPayload,
} from "./workbookClipboard";
import { editWorkbookPackage, type WorkbookCellEdit } from "./workbookPackage";
import {
  parseCellAddress,
  rangeAddress,
  type CellRange,
} from "./workbookRange";
import {
  resolveWorkbookSourceFormat,
  type WorkbookSnapshot,
} from "./workbookSnapshot";

interface Edit extends WorkbookCellEdit {
  revision: number;
}
export interface WorkbookEditor {
  sheetId: string;
  address: string;
  value: string;
  mode: "cell" | "formula";
}
export interface WorkbookControllerState {
  document: WorkbookSnapshot;
  editor: WorkbookEditor | null;
  edits: readonly Edit[];
  isEditing: boolean;
  dirty: boolean;
  saving: boolean;
  failure: "fileChanged" | "saveFailed" | "invalidEdit" | "invalidPaste" | null;
  activeSheetId: string;
  selections: Readonly<Record<string, CellRange>>;
}
interface Files {
  read: typeof readFileBytes;
  write: typeof writeFileBytes;
}

function cellInput(
  document: WorkbookSnapshot,
  sheetId: string,
  address: string,
) {
  const cell = document.sheets.find((sheet) => sheet.id === sheetId)?.cells[
    address
  ];
  return cell?.formula ? `=${cell.formula}` : (cell?.raw ?? "");
}

function project(
  document: WorkbookSnapshot,
  edits: readonly Edit[],
  formulaCacheInvalid: boolean,
  formulas: boolean,
): WorkbookSnapshot {
  return {
    ...document,
    sheets: document.sheets.map((sheet) => {
      const cells = { ...sheet.cells };
      if (formulaCacheInvalid)
        for (const [address, cell] of Object.entries(cells))
          if (cell.formula) cells[address] = { ...cell, raw: "", text: "" };
      for (const edit of edits.filter((edit) => edit.sheetId === sheet.id)) {
        const formula =
          formulas && edit.value.startsWith("=") && edit.value.length > 1
            ? edit.value.slice(1)
            : undefined;
        const raw = formula
          ? ""
          : formulas && edit.value.startsWith("'")
            ? edit.value.slice(1)
            : edit.value;
        cells[edit.address] = {
          ...cells[edit.address],
          raw,
          text: raw,
          formula,
          style: cells[edit.address]?.style ?? {},
        };
      }
      return { ...sheet, cells };
    }),
  };
}

/** 文件编辑视图状态。保存只委托 current 文件网关，不拥有业务 runtime 或文件历史。 */
export class WorkbookController {
  #base: WorkbookSnapshot;
  #state: WorkbookControllerState;
  #listeners = new Set<() => void>();
  #revision = 0;
  #saving: Promise<boolean> | null = null;
  constructor(
    readonly path: string,
    document: WorkbookSnapshot,
    private readonly files: Files = {
      read: readFileBytes,
      write: writeFileBytes,
    },
  ) {
    this.#base = document;
    this.#state = {
      activeSheetId: document.sheets[0]?.id ?? "",
      selections: {},
      document,
      edits: [],
      editor: null,
      isEditing: false,
      dirty: false,
      saving: false,
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
  receiveDocument(document: WorkbookSnapshot) {
    if (this.#state.saving) return;
    if (this.#state.dirty) {
      if (document.sourceSha256 !== this.#base.sourceSha256)
        this.#update({ failure: "fileChanged" });
      return;
    }
    this.#base = document;
    this.#update({
      document,
      editor: null,
      failure: null,
      activeSheetId: document.sheets.some(
        (sheet) => sheet.id === this.#state.activeSheetId,
      )
        ? this.#state.activeSheetId
        : (document.sheets[0]?.id ?? ""),
    });
  }
  setActiveSheetName(name: string) {
    const sheet = this.#state.document.sheets.find(
      (sheet) => sheet.name === name,
    );
    if (sheet && this.flushEdits()) this.#update({ activeSheetId: sheet.id });
  }
  setSelectionRect(sheetId: string, range: CellRange) {
    const previous = this.#state.selections[sheetId];
    if (previous && rangeAddress(previous) === rangeAddress(range)) return;
    this.#update({
      selections: { ...this.#state.selections, [sheetId]: range },
    });
  }
  setEditing(value: boolean) {
    if (!value && !this.flushEdits()) return;
    this.#update({ isEditing: value });
  }
  openCellEditor(
    sheetId: string,
    address: string,
    initialValue?: string,
    mode: "cell" | "formula" = "cell",
  ): boolean {
    const sheet = this.#state.document.sheets.find(
      (sheet) => sheet.id === sheetId,
    );
    const position = parseCellAddress(address);
    if (
      !this.#state.isEditing ||
      this.#state.saving ||
      !sheet ||
      !position ||
      position.row > sheet.rowCount ||
      position.column > sheet.columnCount
    )
      return false;
    if (!this.flushEdits()) return false;
    this.#update({
      editor: {
        sheetId,
        address,
        value:
          initialValue ?? cellInput(this.#state.document, sheetId, address),
        mode,
      },
    });
    return true;
  }
  updateFormulaInput(value: string) {
    if (!this.#state.editor || this.#state.saving) return;
    const editor = { ...this.#state.editor, value };
    this.#update({
      editor,
      dirty:
        this.#state.edits.length > 0 ||
        value !== cellInput(this.#base, editor.sheetId, editor.address),
      failure: null,
    });
  }
  commitCellEdit(value = this.#state.editor?.value): boolean {
    const editor = this.#state.editor;
    if (!editor || value === undefined) return true;
    if (!isValidWorkbookCellInput(value)) {
      this.#update({ failure: "invalidEdit" });
      return false;
    }
    const edits = this.#state.edits.filter(
      (edit) =>
        edit.sheetId !== editor.sheetId || edit.address !== editor.address,
    );
    if (value !== cellInput(this.#base, editor.sheetId, editor.address))
      edits.push({
        sheetId: editor.sheetId,
        address: editor.address,
        value,
        revision: ++this.#revision,
      });
    this.#update({
      edits,
      editor: null,
      dirty: edits.length > 0,
      document: project(
        this.#base,
        edits,
        edits.length > 0,
        this.path.toLowerCase().endsWith(".xlsx"),
      ),
      failure: null,
    });
    return true;
  }
  cancelCellEdit() {
    this.#update({
      editor: null,
      dirty: this.#state.edits.length > 0,
      failure: null,
    });
  }
  flushEdits(): boolean {
    return this.commitCellEdit();
  }
  requestClipboardPayload(
    copyKind: "copy" | "cut",
  ): WorkbookClipboardPayload | null {
    if (copyKind !== "copy" || this.#state.editor) return null;
    const sheet = this.#state.document.sheets.find(
      (sheet) => sheet.id === this.#state.activeSheetId,
    );
    return sheet ? copyWorkbookRange(sheet, this.#selection(sheet.id)) : null;
  }
  pasteClipboardData(payload: WorkbookClipboardPayload): boolean {
    if (!this.#state.isEditing || this.#state.saving || this.#state.editor)
      return false;
    const sheetId = this.#state.activeSheetId;
    const paste = pasteWorkbookRange(
      this.#state.document,
      sheetId,
      this.#selection(sheetId),
      payload,
    );
    if (!paste) {
      this.#update({ failure: "invalidPaste" });
      return false;
    }
    const addresses = new Set(paste.edits.map((edit) => edit.address));
    const edits = this.#state.edits.filter(
      (edit) => edit.sheetId !== sheetId || !addresses.has(edit.address),
    );
    const revision = ++this.#revision;
    for (const edit of paste.edits)
      if (edit.value !== cellInput(this.#base, sheetId, edit.address))
        edits.push({ ...edit, revision });
    this.#update({
      edits,
      dirty: edits.length > 0,
      document: project(
        this.#base,
        edits,
        edits.length > 0,
        this.path.toLowerCase().endsWith(".xlsx"),
      ),
      selections: { ...this.#state.selections, [sheetId]: paste.range },
      failure: null,
    });
    return true;
  }
  #selection(sheetId: string): CellRange {
    return (
      this.#state.selections[sheetId] ?? {
        start: { row: 1, column: 1 },
        end: { row: 1, column: 1 },
      }
    );
  }
  discardEdits() {
    if (this.#state.saving) return;
    this.#update({
      document: this.#base,
      edits: [],
      editor: null,
      dirty: false,
      failure: null,
    });
  }
  flushPublicFile(): Promise<boolean> {
    if (this.#saving) return this.#saving;
    if (!this.flushEdits()) return Promise.resolve(false);
    if (!this.#state.edits.length) return Promise.resolve(true);
    this.#update({ saving: true, failure: null });
    this.#saving = this.#save().finally(() => {
      this.#saving = null;
      this.#update({ saving: false });
    });
    return this.#saving;
  }
  async #save(): Promise<boolean> {
    const captured = this.#state.edits;
    try {
      const original = await this.files.read(this.path);
      if ((await hashFileBytes(original)) !== this.#base.sourceSha256) {
        this.#update({ failure: "fileChanged" });
        return false;
      }
      const format = resolveWorkbookSourceFormat(this.path);
      if (!format) throw new Error("Unsupported workbook format");
      const bytes =
        format === "xlsx"
          ? await editWorkbookPackage(original, captured)
          : editDelimitedWorkbook(
              original,
              format === "tsv" ? "\t" : ",",
              captured,
            );
      // 序列化可能耗时，再检查一次；current fs/writeFile 本身没有跨外部进程的 CAS 合同。
      if (
        (await hashFileBytes(await this.files.read(this.path))) !==
        this.#base.sourceSha256
      ) {
        this.#update({ failure: "fileChanged" });
        return false;
      }
      await this.files.write(this.path, bytes);
      const sourceSha256 = await hashFileBytes(bytes);
      const formulas = format === "xlsx";
      const base = {
        ...project(this.#base, captured, true, formulas),
        sourceSha256,
      };
      const edits = this.#state.edits.filter(
        (edit) => !captured.some((sent) => sent.revision === edit.revision),
      );
      this.#base = base;
      this.#update({
        document: project(base, edits, edits.length > 0, formulas),
        edits,
        dirty: edits.length > 0,
        failure: null,
      });
      return true;
    } catch {
      this.#update({ failure: "saveFailed" });
      return false;
    }
  }
  #update(patch: Partial<WorkbookControllerState>) {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener();
  }
}

/** 按源路径保留应用内未保存编辑；独立 Jotai scope 不共享数据。 */
export const workbookControllersAtom = atom(
  () => new Map<string, WorkbookController>(),
);
