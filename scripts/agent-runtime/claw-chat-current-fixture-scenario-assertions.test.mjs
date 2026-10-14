import { describe, expect, it } from "vitest";
import { buildScenarioAssertions } from "./claw-chat-current-fixture-scenario-assertions.mjs";

function assertions(summary = {}) {
  return buildScenarioAssertions({
    isInputbarRichRestoreScenario: true,
    summary,
    appServerRequestMethods: [],
    backendLedger: [],
    pageText: "",
  });
}

describe("rich scenario marks Gate wiring", () => {
  function evidence() {
    return {
      inputbarRichRestoreDraftPrepared: {
        marks: { preparation: { ok: true }, codeBoundary: { ok: true } },
      },
      inputbarRichRestoreHistoryBoundary: {
        ok: true,
        marksSemanticsPreserved: true,
      },
      inputbarRichRestoreMarksCanceled: { ok: true },
    };
  }
  const names = [
    "inputbarRichRestoreMarksPrepared",
    "inputbarRichRestoreCodeEditingOnly",
    "inputbarRichRestoreMarksHistory",
    "inputbarRichRestoreMarksCanceled",
  ];

  it("cannot inherit a historical rich green without new marks/code/cancel evidence", () => {
    expect(assertions()).toMatchObject({
      inputbarRichRestoreMarksPrepared: false,
      inputbarRichRestoreCodeEditingOnly: false,
      inputbarRichRestoreMarksHistory: false,
      inputbarRichRestoreMarksCanceled: false,
    });
  });

  it("passes every new assertion only after its concrete stage reports success", () => {
    const result = assertions(evidence());
    expect(names.map((name) => result[name])).toEqual([true, true, true, true]);
  });

  it.each(["paste", "code", "history-semantics", "history-input", "cancel"])(
    "routes failed %s into actual scenario pass/fail",
    (mode) => {
      const summary = evidence();
      if (mode === "paste")
        summary.inputbarRichRestoreDraftPrepared.marks.preparation.ok = false;
      if (mode === "code")
        summary.inputbarRichRestoreDraftPrepared.marks.codeBoundary.ok = false;
      if (mode === "history-semantics")
        summary.inputbarRichRestoreHistoryBoundary.marksSemanticsPreserved = false;
      if (mode === "history-input")
        summary.inputbarRichRestoreHistoryBoundary.ok = false;
      if (mode === "cancel")
        summary.inputbarRichRestoreMarksCanceled.ok = false;
      const result = assertions(summary);
      expect(
        names.map((name) => result[name]).filter((value) => value === false),
      ).toHaveLength(1);
    },
  );

  it("retains the original canonical/media/terminal requirements alongside new marks checks", () => {
    const result = assertions(evidence());
    expect(result.inputbarRichRestoreCanonicalRichInputPreserved).toBe(false);
    expect(result.inputbarRichRestoreImageRestored).toBe(false);
    expect(result.inputbarRichRestoreReadModelCanceled).toBe(false);
  });
});
