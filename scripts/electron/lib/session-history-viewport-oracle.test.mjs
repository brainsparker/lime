import { describe, expect, it } from "vitest";
import { assertViewportWindowReplacement } from "./session-history-long-list-oracle.mjs";

const evidence = {
  scrollInput: "electron-mouse-wheel",
  initialMountedCount: 8,
  middleMountedCount: 10,
  middleVisibleCount: 5,
  hasFullScrollRange: true,
  replacedWindow: true,
  unmountedInitialRows: true,
  restoredTail: true,
};

describe("long history viewport evidence", () => {
  it("requires actual DOM replacement and scroll geometry", () => {
    expect(() => assertViewportWindowReplacement(evidence)).not.toThrow();
  });
  it.each([
    { scrollInput: undefined },
    { initialMountedCount: 240 },
    { middleMountedCount: 240 },
    { middleVisibleCount: 0 },
    { hasFullScrollRange: false },
    { replacedWindow: false },
    { unmountedInitialRows: false },
    { restoredTail: false },
  ])(
    "rejects a tail window or all-mounted list masquerading as virtualization",
    (patch) => {
      expect(() =>
        assertViewportWindowReplacement({ ...evidence, ...patch }),
      ).toThrow();
    },
  );
});
