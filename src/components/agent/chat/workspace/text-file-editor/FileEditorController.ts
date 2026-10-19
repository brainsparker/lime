import type {
  TextFileSnapshot,
  TextFileStorage,
} from "@/lib/api/textFileStorage";
import type { Extension } from "@codemirror/state";
import {
  applyDiskContent,
  getExternalReview,
  MAX_EDITABLE_FILE_BYTES,
  normalizeLineEndings,
  preserveLineEndings,
  type FileDocument,
} from "./fileDocument";

export interface FileEditorDraft {
  content: string;
  document: FileDocument;
  history?: Extension;
}

export interface FileEditorState {
  loadState: "loading" | "loaded" | "error";
  content: string;
  document: FileDocument | null;
  hasUnsavedChanges: boolean;
  hasSaveError: boolean;
  isSaving: boolean;
  isReadOnly: boolean;
}

/** 只拥有该文件标签的编辑事务；磁盘读写统一委托current App Server。 */
export class FileEditorController {
  private state: FileEditorState = {
    loadState: "loading",
    content: "",
    document: null,
    hasUnsavedChanges: false,
    hasSaveError: false,
    isSaving: false,
    isReadOnly: false,
  };
  private listeners = new Set<() => void>();
  private lifetime = new AbortController();
  private diskReadRevision = 0;
  private externalSyncRevision = 0;
  private baseMtimeMs = 0;
  private reviewDiskSnapshot: TextFileSnapshot | null = null;
  private savePromise: Promise<boolean> | null = null;
  private autosave: ReturnType<typeof setTimeout> | undefined;
  private draftTimeout: ReturnType<typeof setTimeout> | undefined;
  private draft: FileEditorDraft | null = null;
  private isDisposed = false;
  private editorHistory: (() => Extension | undefined) | null = null;

  constructor(
    private storage: TextFileStorage,
    private options: {
      fileKind?: "text" | "markdown";
      onDraftChange?: (draft: FileEditorDraft | null) => void;
    } = {},
  ) {}

  getSnapshot = () => this.state;
  getDraft = () => this.draft;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<FileEditorState>) {
    if (this.lifetime.signal.aborted) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  async load(initialDraft: FileEditorDraft | null = null) {
    const revision = ++this.diskReadRevision;
    try {
      const snapshot = await this.storage.read(this.lifetime.signal);
      if (
        this.isDisposed ||
        this.lifetime.signal.aborted ||
        revision !== this.diskReadRevision
      )
        return;
      const restore =
        initialDraft &&
        !(
          initialDraft.content === initialDraft.document.baseContent &&
          (this.options.fileKind === "markdown" ||
            initialDraft.document.kind === "ready")
        );
      const content = restore ? initialDraft.content : snapshot.content;
      const document = restore
        ? applyDiskContent(initialDraft.document, content, snapshot.content)
        : { kind: "ready" as const, baseContent: snapshot.content };
      this.draft = initialDraft?.content === content ? initialDraft : null;
      this.baseMtimeMs = snapshot.mtimeMs;
      this.reviewDiskSnapshot = document.kind === "conflict" ? snapshot : null;
      this.update({
        loadState: "loaded",
        content: normalizeLineEndings(content),
        document,
        hasUnsavedChanges:
          document.kind === "conflict" || content !== document.baseContent,
        isReadOnly:
          (content === snapshot.content
            ? snapshot.sizeBytes
            : new TextEncoder().encode(content).byteLength) >
          MAX_EDITABLE_FILE_BYTES,
      });
      this.scheduleAutosave();
    } catch {
      if (revision === this.diskReadRevision)
        this.update({ loadState: "error" });
    }
  }

  getContent() {
    return preserveLineEndings(
      this.state.content,
      this.state.document?.baseContent ?? "",
    );
  }

  edit(content: string) {
    if (
      this.isDisposed ||
      this.state.loadState !== "loaded" ||
      this.state.isReadOnly
    )
      return;
    const normalized = normalizeLineEndings(content);
    this.update({
      content: normalized,
      hasSaveError: false,
      hasUnsavedChanges:
        this.state.document?.kind === "conflict" ||
        preserveLineEndings(
          normalized,
          this.state.document?.baseContent ?? "",
        ) !== this.state.document?.baseContent,
    });
    this.scheduleDraftSnapshot();
    this.scheduleAutosave();
  }

  private applyDiskSnapshot(snapshot: TextFileSnapshot) {
    if (!this.state.document) return;
    const content = this.getContent();
    const document = applyDiskContent(
      this.state.document,
      content,
      snapshot.content,
    );
    if (document.kind === "ready") {
      this.baseMtimeMs = snapshot.mtimeMs;
      this.reviewDiskSnapshot = null;
    } else this.reviewDiskSnapshot = snapshot;
    this.update({
      document,
      hasUnsavedChanges:
        document.kind === "conflict" || content !== document.baseContent,
    });
  }

  async syncExternalChange(): Promise<void> {
    if (this.state.loadState !== "loaded" || this.lifetime.signal.aborted)
      return;
    const sync = ++this.externalSyncRevision;
    const revision = ++this.diskReadRevision;
    try {
      const snapshot = await this.storage.read(this.lifetime.signal);
      if (this.lifetime.signal.aborted || sync !== this.externalSyncRevision)
        return;
      if (revision !== this.diskReadRevision) return this.syncExternalChange();
      this.applyDiskSnapshot(snapshot);
      this.flushDraftSnapshot();
      this.scheduleAutosave();
    } catch {
      if (revision === this.diskReadRevision)
        this.update({ hasSaveError: true });
    }
  }

  resolveExternalChange(action: "edit" | "accept" | "reject") {
    const document = this.state.document;
    if (!document || document.kind !== "conflict") return;
    const review = getExternalReview(document, this.getContent());
    if (!review || !this.reviewDiskSnapshot) return;
    const content = action === "reject" ? review.oldContent : review.newContent;
    this.baseMtimeMs = this.reviewDiskSnapshot.mtimeMs;
    this.reviewDiskSnapshot = null;
    this.update({
      document: { kind: "ready", baseContent: document.diskContent },
      content: normalizeLineEndings(content),
      hasUnsavedChanges: content !== document.diskContent,
      hasSaveError: false,
      isReadOnly:
        new TextEncoder().encode(content).byteLength > MAX_EDITABLE_FILE_BYTES,
    });
    this.flushDraftSnapshot();
    this.scheduleAutosave();
  }

  saveUntilClean = async (): Promise<boolean> => {
    while (!this.lifetime.signal.aborted) {
      if (!(await this.save())) return false;
      if (!this.state.hasUnsavedChanges) return true;
    }
    return false;
  };

  save = async (): Promise<boolean> => {
    this.clearAutosave();
    if (this.lifetime.signal.aborted) return false;
    if (this.savePromise) return (await this.savePromise) ? this.save() : false;
    const document = this.state.document;
    if (!document || document.kind === "conflict" || this.state.isReadOnly)
      return false;
    const content = this.getContent();
    if (content === document.baseContent) {
      this.flushDraftSnapshot();
      return true;
    }
    this.update({ isSaving: true, hasSaveError: false });
    const operation = this.storage
      .write(content, this.baseMtimeMs, this.lifetime.signal)
      .then(async (result) => {
        if (this.lifetime.signal.aborted) return false;
        ++this.diskReadRevision;
        if (result.outcome === "saved") {
          if (this.state.document === document) {
            this.baseMtimeMs = result.mtimeMs;
            this.update({ document: { kind: "ready", baseContent: content } });
            return true;
          }
          await this.syncExternalChange();
          return (
            this.state.document?.kind === "ready" &&
            this.state.document.baseContent === content
          );
        }
        await this.syncExternalChange();
        return (
          this.state.document?.kind === "ready" &&
          this.state.document.baseContent === content
        );
      })
      .catch(() => {
        this.update({ hasSaveError: true });
        return false;
      });
    this.savePromise = operation;
    const saved = await operation;
    if (this.savePromise === operation) this.savePromise = null;
    this.update({
      isSaving: false,
      hasUnsavedChanges:
        this.state.document?.kind === "conflict" ||
        this.getContent() !== this.state.document?.baseContent,
    });
    this.flushDraftSnapshot();
    if (saved) this.scheduleAutosave();
    return saved;
  };

  private scheduleAutosave() {
    this.clearAutosave();
    if (
      !this.isDisposed &&
      this.state.hasUnsavedChanges &&
      !this.state.isReadOnly &&
      this.state.document?.kind === "ready"
    )
      this.autosave = setTimeout(() => {
        void this.save();
      }, 3000);
  }
  private clearAutosave() {
    clearTimeout(this.autosave);
    this.autosave = undefined;
  }
  private scheduleDraftSnapshot() {
    clearTimeout(this.draftTimeout);
    this.draftTimeout = setTimeout(() => this.flushDraftSnapshot(), 500);
  }
  setEditorHistory(getHistory: () => Extension | undefined) {
    this.editorHistory = getHistory;
    return () => {
      if (this.editorHistory !== getHistory) return;
      this.flushDraftSnapshot();
      this.editorHistory = null;
    };
  }
  flushDraftSnapshot() {
    clearTimeout(this.draftTimeout);
    this.draftTimeout = undefined;
    if (!this.state.document || this.lifetime.signal.aborted) return;
    const history = this.editorHistory
      ? this.editorHistory()
      : this.draft?.history;
    this.draft =
      this.state.hasUnsavedChanges || history
        ? { content: this.getContent(), document: this.state.document, history }
        : null;
    this.options.onDraftChange?.(this.draft);
  }
  discard = () => {
    this.dispose(true);
  };
  dispose(discardUnsavedChanges = false) {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (discardUnsavedChanges) {
      this.draft = null;
      this.options.onDraftChange?.(null);
    } else this.flushDraftSnapshot();
    this.clearAutosave();
    clearTimeout(this.draftTimeout);
    this.listeners.clear();
    if (!discardUnsavedChanges && this.state.loadState === "loaded") {
      void this.saveUntilClean().finally(() => {
        this.clearAutosave();
        this.lifetime.abort();
      });
    } else this.lifetime.abort();
  }
}
