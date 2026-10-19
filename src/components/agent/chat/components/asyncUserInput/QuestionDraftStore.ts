import { atom } from "jotai/vanilla";
import type { AsyncQuestion, QuestionReply } from "./questions";

export interface QuestionDraft {
  draft: string;
  baseline: string;
  lastSubmission: string | null;
  submitting: boolean;
  skipped: boolean;
}

export interface QuestionSelection {
  turnId: string;
  ids: readonly string[];
  selectedId: string;
}

export interface QuestionDraftSnapshot {
  drafts: ReadonlyMap<string, QuestionDraft>;
  selection: QuestionSelection | null;
}

const EMPTY: QuestionDraftSnapshot = { drafts: new Map(), selection: null };

/** AppScope 视图状态，不复制 canonical 题目、答案历史或权限状态。 */
export class QuestionDraftStore {
  #threads = new Map<string, QuestionDraftSnapshot>();
  #registered = new Map<string, Set<string>>();
  #listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  read = (scope: string): QuestionDraftSnapshot =>
    this.#threads.get(scope) ?? EMPTY;

  #write(scope: string, snapshot: QuestionDraftSnapshot) {
    this.#threads.set(scope, snapshot);
    for (const listener of this.#listeners) listener();
  }

  reconcile(
    scope: string,
    questions: readonly AsyncQuestion[],
    answers: ReadonlyMap<string, string>,
    activeTurnIds: ReadonlySet<string>,
  ) {
    const previous = this.read(scope);
    const drafts = new Map(previous.drafts);
    const registered = this.#registered.get(scope) ?? new Set<string>();
    let changed = false;
    const added: AsyncQuestion[] = [];
    for (const question of questions) {
      const old = drafts.get(question.id);
      const answer = answers.get(question.id);
      if (!old) {
        const baseline = answer ?? "";
        drafts.set(question.id, {
          draft: baseline,
          baseline,
          lastSubmission: answer ?? null,
          submitting: false,
          skipped: false,
        });
        changed = true;
      } else if (
        answer !== undefined &&
        (old.baseline !== answer || old.lastSubmission !== answer)
      ) {
        drafts.set(question.id, {
          ...old,
          baseline: answer,
          lastSubmission: answer,
          draft: old.draft === old.baseline ? answer : old.draft,
        });
        changed = true;
      }
      if (
        !registered.has(question.id) &&
        activeTurnIds.has(question.turnId) &&
        answer === undefined
      )
        added.push(question);
      registered.add(question.id);
    }
    this.#registered.set(scope, registered);
    let selection = previous.selection;
    if (selection) {
      const ids = selection.ids.filter((id) =>
        questions.some(
          (question) =>
            question.id === id && question.turnId === selection?.turnId,
        ),
      );
      if (!ids.includes(selection.selectedId)) {
        selection = null;
        changed = true;
      } else if (ids.length !== selection.ids.length) {
        selection = { ...selection, ids };
        changed = true;
      }
    }
    if (added.length) {
      const turnId = selection?.turnId ?? added[0].turnId;
      const ids = [
        ...new Set([
          ...(selection?.ids ?? []),
          ...added
            .filter((question) => question.turnId === turnId)
            .map((question) => question.id),
        ]),
      ];
      selection = { turnId, ids, selectedId: selection?.selectedId ?? ids[0] };
      changed = true;
    }
    if (changed) this.#write(scope, { drafts, selection });
  }

  edit(scope: string, id: string, draft: string) {
    const snapshot = this.read(scope),
      old = snapshot.drafts.get(id);
    if (!old) return;
    this.#write(scope, {
      ...snapshot,
      drafts: new Map(snapshot.drafts).set(id, { ...old, draft }),
    });
  }

  select(scope: string, question: AsyncQuestion) {
    const snapshot = this.read(scope);
    if (!snapshot.drafts.has(question.id)) return;
    const same =
      snapshot.selection?.turnId === question.turnId &&
      snapshot.selection.ids.includes(question.id);
    this.#write(scope, {
      ...snapshot,
      selection: {
        turnId: question.turnId,
        ids: same ? snapshot.selection!.ids : [question.id],
        selectedId: question.id,
      },
    });
  }

  close(scope: string) {
    const snapshot = this.read(scope);
    this.#write(scope, { ...snapshot, selection: null });
  }

  skip(scope: string, id: string) {
    const snapshot = this.read(scope),
      old = snapshot.drafts.get(id);
    if (!old || old.submitting) return;
    this.#write(scope, {
      ...snapshot,
      drafts: new Map(snapshot.drafts).set(id, {
        ...old,
        draft: "",
        skipped: true,
      }),
    });
  }

  submission(
    scope: string,
    questions: readonly AsyncQuestion[],
  ): QuestionReply[] {
    const { drafts, selection } = this.read(scope);
    if (!selection) return [];
    return selection.ids.flatMap((id) => {
      const question = questions.find(
        (question) =>
          question.id === id && question.turnId === selection.turnId,
      );
      const draft = drafts.get(id);
      return question && draft
        ? [
            {
              questionItemId: id,
              question: question.title,
              answer: draft.draft.trim(),
            },
          ]
        : [];
    });
  }

  setSubmitting(
    scope: string,
    replies: readonly QuestionReply[],
    submitting: boolean,
  ) {
    const snapshot = this.read(scope),
      drafts = new Map(snapshot.drafts);
    for (const reply of replies) {
      const old = drafts.get(reply.questionItemId);
      if (old) drafts.set(reply.questionItemId, { ...old, submitting });
    }
    this.#write(scope, { ...snapshot, drafts });
  }

  accepted(scope: string, replies: readonly QuestionReply[]) {
    const snapshot = this.read(scope),
      drafts = new Map(snapshot.drafts);
    const consumed = new Set<string>();
    for (const reply of replies) {
      const old = drafts.get(reply.questionItemId);
      if (!old) continue;
      if (old.draft.trim() === reply.answer) consumed.add(reply.questionItemId);
      drafts.set(reply.questionItemId, {
        ...old,
        baseline: reply.answer,
        lastSubmission: reply.answer || null,
      });
    }
    const remaining =
      snapshot.selection?.ids.filter((id) => !consumed.has(id)) ?? [];
    const selection =
      snapshot.selection && remaining.length
        ? {
            ...snapshot.selection,
            ids: remaining,
            selectedId: remaining.includes(snapshot.selection.selectedId)
              ? snapshot.selection.selectedId
              : remaining[0],
          }
        : null;
    this.#write(scope, { drafts, selection });
  }
}

export const questionDraftsAtom = atom(() => new QuestionDraftStore());
export function questionScope(hostId: string, threadId: string): string {
  return JSON.stringify([hostId, threadId]);
}
