import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { CodeBlockNodeView } from "./CodeBlockNodeView";

export interface CodeBlockNodeViewEntry {
  readonly id: string;
  readonly language: string | null;
  readonly autoDetectLanguage: boolean | null;
  readonly selectLanguage: (language: string | null) => boolean;
  readonly focusEditor: () => void;
  readonly getContent: () => string;
  readonly toolbarPortalContainer: HTMLElement;
}

/** Controller-owned registry; entries contain metadata, never editable code. */
export class CodeBlockNodeViewRegistry {
  private readonly nodeViews = new Map<string, CodeBlockNodeView>();
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly CodeBlockNodeViewEntry[] = Object.freeze([]);
  private sequence = 0;
  private destroyed = false;

  readonly createNodeView = (
    node: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
  ): CodeBlockNodeView => {
    if (this.destroyed) throw new Error("Code block registry is destroyed");
    const id = `code-block-${++this.sequence}`;
    const nodeView = new CodeBlockNodeView(node, view, getPos, this, id);
    this.nodeViews.set(id, nodeView);
    this.publish();
    return nodeView;
  };

  readonly getSnapshot = (): readonly CodeBlockNodeViewEntry[] => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    if (this.destroyed) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  unregisterNodeView(id: string, nodeView?: CodeBlockNodeView): void {
    if (nodeView && this.nodeViews.get(id) !== nodeView) return;
    if (this.nodeViews.delete(id)) this.publish();
  }

  publishNodeViewUpdate(id: string, nodeView: CodeBlockNodeView): void {
    if (this.nodeViews.get(id) === nodeView) this.publish();
  }

  isOwnerCurrent(
    id: string,
    nodeView: CodeBlockNodeView,
    view: EditorView,
  ): boolean {
    return (
      !this.destroyed &&
      this.nodeViews.get(id) === nodeView &&
      !view.isDestroyed
    );
  }

  canEdit(id: string, nodeView: CodeBlockNodeView, view: EditorView): boolean {
    return (
      this.isOwnerCurrent(id, nodeView, view) &&
      view.editable &&
      !view.composing
    );
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const nodeViews = [...this.nodeViews.values()];
    this.nodeViews.clear();
    for (const nodeView of nodeViews) nodeView.destroy();
    this.publish();
    this.listeners.clear();
  }

  private publish(): void {
    this.snapshot = Object.freeze(
      [...this.nodeViews.values()].map((nodeView) => nodeView.createEntry()),
    );
    for (const listener of this.listeners) listener();
  }
}
