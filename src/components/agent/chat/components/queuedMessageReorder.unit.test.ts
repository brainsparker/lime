import { describe, expect, it } from "vitest";
import { getReorderedSubmissionIds } from "./queuedMessageReorder";

describe("getReorderedSubmissionIds", () => {
  it.each([
    ["a", "c", ["b", "c", "a"]],
    ["c", "a", ["c", "a", "b"]],
    ["b", "a", ["b", "a", "c"]],
    ["b", "c", ["a", "c", "b"]],
  ])(
    "按 ID 将 %s 移到 %s，保留其他 ID 相对顺序",
    (sourceId, destinationId, expected) => {
      const submissionIds = ["a", "b", "c"];
      expect(
        getReorderedSubmissionIds({ submissionIds, sourceId, destinationId }),
      ).toEqual(expected);
      expect(submissionIds).toEqual(["a", "b", "c"]);
    },
  );

  it.each([
    { sourceId: "a", destinationId: "a" },
    { sourceId: "missing", destinationId: "b" },
    { sourceId: "a", destinationId: "missing" },
  ])("拒绝相同位置或失效身份 $sourceId -> $destinationId", (ids) => {
    expect(
      getReorderedSubmissionIds({ submissionIds: ["a", "b", "c"], ...ids }),
    ).toBeNull();
  });

  it.each([
    { submissionIds: ["a", "a", "b"] },
    { submissionIds: ["a", " ", "b"] },
    { submissionIds: ["a", "b"], expectedIds: ["a", "b", "c"] },
    { submissionIds: ["a", "c", "b"], expectedIds: ["a", "b", "c"] },
  ])("拒绝重复/空身份或已漂移源快照 $submissionIds", (snapshot) => {
    expect(
      getReorderedSubmissionIds({
        sourceId: "a",
        destinationId: "b",
        ...snapshot,
      }),
    ).toBeNull();
  });
});
