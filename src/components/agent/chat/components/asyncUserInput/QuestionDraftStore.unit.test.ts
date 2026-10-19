import { describe, expect, it } from "vitest";
import { createStore } from "jotai/vanilla";
import {
  QuestionDraftStore,
  questionDraftsAtom,
  questionScope,
} from "./QuestionDraftStore";
import type { AsyncQuestion } from "./questions";

const questions: AsyncQuestion[] = [0, 1].map((index) => ({
  id: `q${index}`,
  sourceItemId: "item",
  turnId: "turn",
  title: `Question ${index}`,
  options: ["A", "B"],
}));
const scope = questionScope("local", "thread");
const active = new Set(["turn"]);
const setup = () => {
  const store = new QuestionDraftStore();
  store.reconcile(scope, questions, new Map(), active);
  return store;
};

describe("AppScope async question drafts", () => {
  it("selects active unanswered questions once; close does not reopen from an identical projection", () => {
    const store = setup();
    expect(store.read(scope).selection).toEqual({
      turnId: "turn",
      ids: ["q0", "q1"],
      selectedId: "q0",
    });
    store.edit(scope, "q0", "draft");
    store.close(scope);
    store.reconcile(scope, questions, new Map(), active);
    expect(store.read(scope).selection).toBeNull();
    expect(store.read(scope).drafts.get("q0")?.draft).toBe("draft");
    store.select(scope, questions[0]);
    expect(store.read(scope).selection?.ids).toEqual(["q0"]);
  });

  it("isolates applications and threads and restores an existing selection within its scope", () => {
    const a = createStore(),
      b = createStore();
    expect(a.get(questionDraftsAtom)).not.toBe(b.get(questionDraftsAtom));
    const store = setup();
    store.edit(scope, "q0", "keep");
    store.select(scope, questions[1]);
    const other = questionScope("local", "other");
    store.reconcile(other, questions, new Map(), active);
    store.edit(other, "q0", "other");
    expect(store.read(scope).drafts.get("q0")?.draft).toBe("keep");
    expect(store.read(scope).selection?.selectedId).toBe("q1");
  });

  it("updates an untouched baseline from canonical answers while retaining newer user edits", () => {
    const store = setup();
    store.edit(scope, "q1", "my edit");
    store.reconcile(
      scope,
      questions,
      new Map([
        ["q0", "A"],
        ["q1", "B"],
      ]),
      active,
    );
    expect(store.read(scope).drafts.get("q0")).toMatchObject({
      draft: "A",
      baseline: "A",
      lastSubmission: "A",
    });
    expect(store.read(scope).drafts.get("q1")).toMatchObject({
      draft: "my edit",
      baseline: "B",
      lastSubmission: "B",
    });
    const snapshot = store.read(scope);
    store.reconcile(
      scope,
      questions,
      new Map([
        ["q0", "A"],
        ["q1", "B"],
      ]),
      active,
    );
    expect(store.read(scope)).toBe(snapshot);
  });

  it("keeps failed submissions and consumes only unchanged drafts after a late success", () => {
    const store = setup();
    store.edit(scope, "q0", "A");
    store.edit(scope, "q1", "B");
    const sent = store.submission(scope, questions);
    store.setSubmitting(scope, sent, true);
    store.edit(scope, "q1", "newer");
    store.setSubmitting(scope, sent, false);
    expect(store.read(scope).selection?.ids).toEqual(["q0", "q1"]);
    store.accepted(scope, sent);
    expect(store.read(scope).selection).toEqual({
      turnId: "turn",
      ids: ["q1"],
      selectedId: "q1",
    });
    expect(store.read(scope).drafts.get("q1")).toMatchObject({
      draft: "newer",
      baseline: "B",
      lastSubmission: "B",
      submitting: false,
    });
    store.reconcile(scope, questions, new Map(), active);
    expect(store.read(scope).drafts.get("q1")?.lastSubmission).toBe("B");
  });

  it("skip clears only the current draft; final submission keeps earlier nonempty answers", () => {
    const store = setup();
    store.edit(scope, "q0", "A");
    store.edit(scope, "q1", "B");
    store.skip(scope, "q1");
    expect(store.submission(scope, questions)).toEqual([
      { questionItemId: "q0", question: "Question 0", answer: "A" },
      { questionItemId: "q1", question: "Question 1", answer: "" },
    ]);
    expect(store.read(scope).drafts.get("q1")?.skipped).toBe(true);
  });

  it("does not auto-select completed or already answered history", () => {
    const store = new QuestionDraftStore();
    store.reconcile(scope, questions, new Map([["q0", "A"]]), new Set());
    expect(store.read(scope).selection).toBeNull();
    store.select(scope, questions[0]);
    expect(store.read(scope).drafts.get("q0")?.lastSubmission).toBe("A");
  });
});
