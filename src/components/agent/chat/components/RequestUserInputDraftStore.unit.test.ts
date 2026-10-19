import { describe, expect, it } from "vitest";
import { RequestUserInputDraftStore } from "./RequestUserInputDraftStore";
import type { RequestUserInputDraftState } from "./requestUserInputDraft";

describe("RequestUserInputDraftStore identity and ownership", () => {
  const identity = {
    key: "current-key",
    requestId: "current-request",
    questionKey: "questions",
  };
  const draft = (): RequestUserInputDraftState => ({
    answers: { answer: { selectedOptionId: null, freeformText: "保留" } },
    questionIndex: 0,
  });

  it("旧 requestId 清理不删除当前稿，匹配请求才删除", () => {
    const store = new RequestUserInputDraftStore();
    store.save(identity, draft());
    store.clear(identity.key, "old-request");
    expect(store.read(identity)).toEqual(draft());
    store.clear(identity.key, identity.requestId);
    expect(store.read(identity)).toBeNull();
  });

  it("保存和读取都不泄漏可变答案引用，identity 形状变化不能读取", () => {
    const store = new RequestUserInputDraftStore();
    const original = draft();
    store.save(identity, original);
    original.answers.answer.freeformText = "外部修改";
    const read = store.read(identity)!;
    read.answers.answer.freeformText = "读取者修改";
    expect(store.read(identity)).toEqual(draft());
    expect(
      store.read({ ...identity, questionKey: "new-questions" }),
    ).toBeNull();
    expect(store.read({ ...identity, requestId: "other-request" })).toBeNull();
  });
});
