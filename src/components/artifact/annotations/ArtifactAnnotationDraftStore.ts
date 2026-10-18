import { ComposerController } from "@/components/input-kit/ComposerController";
import { atom } from "jotai/vanilla";
import type { ArtifactAnnotationDraftComment } from "./artifactAnnotation";

export interface ArtifactAnnotationDraft {
  readonly scopeKey: string;
  readonly comment: ArtifactAnnotationDraftComment;
  readonly controller: ComposerController;
  readonly pending: boolean;
  readonly failure: "fileChanged" | "submitFailed" | null;
}

/** 会话内未提交的批注视图状态；正文仍只由 ComposerController 持有。 */
export class ArtifactAnnotationDraftStore {
  #snapshot: readonly ArtifactAnnotationDraft[] = [];
  #nextFocusRequest = 0;
  #focus: {
    readonly id: string;
    readonly request: number;
    readonly previewRequestKey?: string;
  } | null = null;
  getFocusSnapshot = () => this.#focus;
  focus(id: string, previewRequestKey?: string): boolean {
    if (!this.#snapshot.some((draft) => draft.comment.id === id)) return false;
    this.#focus = {
      id,
      request: ++this.#nextFocusRequest,
      ...(previewRequestKey ? { previewRequestKey } : {}),
    };
    for (const listener of this.#listeners) listener();
    return true;
  }
  consumeFocus(request: number): void {
    if (this.#focus?.request !== request) return;
    this.#focus = null;
    for (const listener of this.#listeners) listener();
  }
  #listeners = new Set<() => void>();
  #subscriptions = new Map<string, () => void>();

  getSnapshot = () => this.#snapshot;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  create(scopeKey: string, comment: ArtifactAnnotationDraftComment): string {
    const controller = new ComposerController({}, { plainTextMode: true });
    const id = comment.id;
    if (!scopeKey || this.#subscriptions.has(id))
      throw new Error("Invalid annotation draft identity");
    if (comment.screenshot) controller.setAttachments([comment.screenshot]);
    this.#subscriptions.set(
      id,
      controller.subscribe(() => this.#publish([...this.#snapshot])),
    );
    this.#publish([
      ...this.#snapshot,
      {
        scopeKey,
        comment: structuredClone(comment),
        controller,
        pending: false,
        failure: null,
      },
    ]);
    return id;
  }

  reanchor(id: string, comment: ArtifactAnnotationDraftComment): boolean {
    const draft = this.#snapshot.find((entry) => entry.comment.id === id);
    if (
      !draft ||
      draft.pending ||
      comment.id !== id ||
      draft.comment.path !== comment.path ||
      draft.comment.format !== comment.format
    )
      return false;
    draft.controller.setAttachments(
      comment.screenshot ? [comment.screenshot] : [],
    );
    this.#replace(id, {
      ...draft,
      comment: structuredClone(comment),
      failure: null,
    });
    return true;
  }

  begin(id: string): boolean {
    const draft = this.#snapshot.find((entry) => entry.comment.id === id);
    if (!draft || draft.pending || !draft.controller.getDocument().text.trim())
      return false;
    this.#replace(id, { ...draft, pending: true, failure: null });
    return true;
  }

  beginBatch(ids: readonly string[]): boolean {
    if (!ids.length || new Set(ids).size !== ids.length) return false;
    const selected = ids.map((id) =>
      this.#snapshot.find((draft) => draft.comment.id === id),
    );
    if (
      selected.some(
        (draft) =>
          !draft ||
          draft.pending ||
          !draft.controller.getDocument().text.trim(),
      )
    )
      return false;
    const included = new Set(selected);
    this.#publish(
      this.#snapshot.map((draft) =>
        included.has(draft)
          ? { ...draft, pending: true, failure: null }
          : draft,
      ),
    );
    return true;
  }

  finish(
    id: string,
    result: "accepted" | "rejected" | "canceled" | "file-changed",
  ): boolean {
    const draft = this.#snapshot.find((entry) => entry.comment.id === id);
    if (!draft) return false;
    if (result === "accepted" && !draft.controller.getDocument().text.trim()) {
      this.#replace(id, { ...draft, pending: false });
      return this.remove(id);
    }
    this.#replace(id, {
      ...draft,
      pending: false,
      failure:
        result === "file-changed"
          ? "fileChanged"
          : result === "rejected"
            ? "submitFailed"
            : null,
    });
    return false;
  }

  remove(id: string): boolean {
    const draft = this.#snapshot.find((entry) => entry.comment.id === id);
    if (!draft || draft.pending) return false;
    this.#subscriptions.get(id)?.();
    this.#subscriptions.delete(id);
    this.#publish(this.#snapshot.filter((entry) => entry !== draft));
    return true;
  }

  #replace(id: string, draft: ArtifactAnnotationDraft) {
    this.#publish(
      this.#snapshot.map((entry) => (entry.comment.id === id ? draft : entry)),
    );
  }
  #publish(snapshot: readonly ArtifactAnnotationDraft[]) {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}

/** 应用 scope 内共享，页面卸载不丢稿；不同 Jotai Store 互相隔离。 */
export const artifactAnnotationDraftsAtom = atom(
  () => new ArtifactAnnotationDraftStore(),
);
