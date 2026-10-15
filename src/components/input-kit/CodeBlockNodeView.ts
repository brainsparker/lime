import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView, NodeView, ViewMutationRecord } from "@tiptap/pm/view";
import type {
  CodeBlockNodeViewEntry,
  CodeBlockNodeViewRegistry,
} from "./CodeBlockNodeViewRegistry";
import { normalizeCodeBlockLanguage } from "./composerCodeBlockLanguage";

/** Presentation around PM's contentDOM; the editor owns all code children. */
export class CodeBlockNodeView implements NodeView {
  readonly dom: HTMLDivElement;
  readonly contentDOM: HTMLElement;
  readonly toolbarPortalContainer: HTMLDivElement;
  private readonly pre: HTMLPreElement;
  private destroyed = false;

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly registry: CodeBlockNodeViewRegistry,
    readonly id: string,
  ) {
    if (node.type.name !== "code_block") throw new Error("Expected code_block");
    const document = view.dom.ownerDocument;
    this.dom = document.createElement("div");
    this.dom.dataset.composerCodeBlock = "true";
    this.dom.dataset.composerCodeBlockWrap = "false";
    this.toolbarPortalContainer = document.createElement("div");
    this.toolbarPortalContainer.dataset.composerCodeBlockToolbar = "true";
    this.toolbarPortalContainer.contentEditable = "false";
    this.toolbarPortalContainer.setAttribute("contenteditable", "false");
    this.pre = document.createElement("pre");
    this.pre.dir = "ltr";
    this.contentDOM = document.createElement("code");
    this.contentDOM.setAttribute("spellcheck", "false");
    this.pre.append(this.contentDOM);
    this.dom.append(this.toolbarPortalContainer, this.pre);
    this.updateCodeElement();
  }

  update(node: ProseMirrorNode): boolean {
    if (this.destroyed || node.type !== this.node.type) return false;
    const changed = !node.eq(this.node);
    this.node = node;
    this.updateCodeElement();
    if (changed) this.registry.publishNodeViewUpdate(this.id, this);
    return true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.registry.unregisterNodeView(this.id, this);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (this.toolbarPortalContainer.contains(mutation.target)) return true;
    return (
      mutation.type === "attributes" &&
      (mutation.target === this.dom ||
        mutation.target === this.pre ||
        mutation.target === this.contentDOM)
    );
  }

  stopEvent(event: Event): boolean {
    return (
      !!event.target &&
      this.toolbarPortalContainer.contains(event.target as globalThis.Node)
    );
  }

  createEntry(): CodeBlockNodeViewEntry {
    return Object.freeze({
      id: this.id,
      language: this.getLanguage(),
      autoDetectLanguage: this.getAutoDetectLanguage(),
      selectLanguage: this.selectLanguage,
      focusEditor: this.focusEditor,
      getContent: this.getContent,
      toolbarPortalContainer: this.toolbarPortalContainer,
    });
  }

  readonly selectLanguage = (selection: string | null): boolean => {
    if (!this.canEdit()) return false;
    const current = this.currentNode();
    if (!current) return false;
    const supportsAuto = Object.prototype.hasOwnProperty.call(
      current.node.type.spec.attrs ?? {},
      "autoDetectLanguage",
    );
    if (selection === "auto" && !supportsAuto) return false;
    const explicit =
      selection === null || selection === "auto"
        ? null
        : normalizeCodeBlockLanguage(selection);
    if (selection !== null && selection !== "auto" && explicit === null)
      return false;
    const language =
      selection === "auto"
        ? null
        : selection === null
          ? supportsAuto
            ? "plaintext"
            : null
          : explicit;
    const attrs = {
      ...current.node.attrs,
      language,
      ...(supportsAuto ? { autoDetectLanguage: selection === "auto" } : {}),
    };
    if (
      attrs.language === current.node.attrs.language &&
      (!supportsAuto ||
        attrs.autoDetectLanguage === current.node.attrs.autoDetectLanguage)
    )
      return false;
    // Recheck guards after getPos/current-node reads; no stale toolbar writes.
    if (!this.canEdit()) return false;
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(current.pos, undefined, attrs),
    );
    return true;
  };

  readonly focusEditor = (): void => {
    if (this.canEdit() && this.currentNode()) this.view.focus();
  };

  readonly getContent = (): string =>
    this.currentNode()?.node.textContent ?? "";

  getAutoDetectLanguage(): boolean | null {
    return Object.prototype.hasOwnProperty.call(
      this.node.type.spec.attrs ?? {},
      "autoDetectLanguage",
    )
      ? this.node.attrs.autoDetectLanguage !== false
      : null;
  }

  updateCodeElement(): void {
    const language = this.getLanguage();
    this.dom.dataset.composerCodeBlockWrap = "false";
    this.contentDOM.className =
      "hljs" + (language ? ` language-${language}` : "");
  }

  private getLanguage(): string | null {
    const raw = this.node.attrs.language;
    return (
      normalizeCodeBlockLanguage(raw) ??
      (typeof raw === "string" && /^[A-Za-z0-9_+#.-]+$/.test(raw) ? raw : null)
    );
  }

  private canEdit(): boolean {
    return !this.destroyed && this.registry.canEdit(this.id, this, this.view);
  }

  private currentNode(): { pos: number; node: ProseMirrorNode } | null {
    if (
      this.destroyed ||
      this.view.isDestroyed ||
      !this.registry.isOwnerCurrent(this.id, this, this.view)
    )
      return null;
    let pos: number | undefined;
    try {
      pos = this.getPos();
    } catch {
      return null;
    }
    if (
      pos === undefined ||
      !Number.isInteger(pos) ||
      pos < 0 ||
      pos >= this.view.state.doc.content.size
    )
      return null;
    const node = this.view.state.doc.nodeAt(pos);
    return node?.type === this.node.type && node === this.node
      ? { pos, node }
      : null;
  }
}
