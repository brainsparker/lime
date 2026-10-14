import { describe, expect, it } from "vitest";
import { assertReviewThreadSidePanelEvidence } from "./review-thread-side-panel-gate-b.mjs";

const evidence = {
  host: { electron: true, hasInvoke: true },
  threadId: "thread-review-fixture",
  selected: [
    {
      path: "src/file.ts",
      selected: true,
      visible: true,
      linesMatched: true,
      originalFileOpenStateCorrect: true,
    },
  ],
  externalOpenBefore: 0,
  externalOpenAfter: 0,
};

describe("Files review Gate B evidence boundary", () => {
  it("accepts located diffs on the real host with no external launch", () => {
    expect(() => assertReviewThreadSidePanelEvidence(evidence)).not.toThrow();
  });
  it.each([
    { ...evidence, host: { electron: false, hasInvoke: true } },
    { ...evidence, threadId: "" },
    { ...evidence, selected: [] },
    { ...evidence, selected: [{ selected: true, visible: false }] },
    {
      ...evidence,
      selected: [{ ...evidence.selected[0], linesMatched: false }],
    },
    {
      ...evidence,
      selected: [
        { ...evidence.selected[0], originalFileOpenStateCorrect: false },
      ],
    },
    { ...evidence, externalOpenAfter: 1 },
  ])(
    "rejects incomplete host, identity, diff or navigation evidence",
    (invalid) => {
      expect(() => assertReviewThreadSidePanelEvidence(invalid)).toThrow();
    },
  );
});
