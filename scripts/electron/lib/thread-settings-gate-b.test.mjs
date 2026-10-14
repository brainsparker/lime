import { describe, expect, it } from "vitest";
import { assertThreadSettingsGateEvidence } from "./thread-settings-gate-b.mjs";

function passingEvidence() {
  return {
    electronPreload: true,
    guiUpdateRequest: true,
    canonicalModel: true,
    canonicalProvider: true,
    canonicalCwd: true,
    modelVisible: true,
    directoryVisible: true,
    sameThread: true,
    drainObserved: true,
    canonicalNotification: true,
    noNewTurns: true,
    noTranscriptNotification: true,
    noFallback: true,
    pageErrorCount: 0,
    consoleErrorCount: 0,
    invokeErrorCount: 0,
  };
}

describe("thread settings production consumer Electron evidence", () => {
  it("accepts current IPC, canonical readback and visible same-thread settings", () => {
    expect(() =>
      assertThreadSettingsGateEvidence(passingEvidence()),
    ).not.toThrow();
  });

  it.each([
    "electronPreload",
    "guiUpdateRequest",
    "canonicalModel",
    "canonicalProvider",
    "canonicalCwd",
    "modelVisible",
    "directoryVisible",
    "sameThread",
    "drainObserved",
    "canonicalNotification",
    "noNewTurns",
    "noTranscriptNotification",
    "noFallback",
  ])("rejects missing %s even if other evidence passed", (field) => {
    expect(() =>
      assertThreadSettingsGateEvidence({
        ...passingEvidence(),
        [field]: false,
      }),
    ).toThrow(field);
  });

  it.each(["pageErrorCount", "consoleErrorCount", "invokeErrorCount"])(
    "rejects nonzero %s",
    (field) => {
      expect(() =>
        assertThreadSettingsGateEvidence({ ...passingEvidence(), [field]: 1 }),
      ).toThrow(/runtime error/);
    },
  );
});
