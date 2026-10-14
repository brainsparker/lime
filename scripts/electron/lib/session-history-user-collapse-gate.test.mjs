import { afterEach, describe, expect, it, vi } from "vitest";
import { extractLongListCollapseFailure } from "./session-history-user-collapse-geometry.mjs";

const shape = vi.hoisted(() => ({
  sessionId: "fixture-session",
  rootCount: 1,
  scroll: { top: 0 },
  rows: [{ turnId: "fixture-turn", top: 32 }],
}));
vi.mock(
  "./session-history-user-collapse-geometry.mjs",
  async (importOriginal) => ({
    ...(await importOriginal()),
    readCanonicalCollapseGeometry: async () => shape,
    waitForCanonicalCollapseGeometry: async () => shape,
    assertCanonicalCollapseGeometry: (snapshot) => snapshot,
    assertLongListCollapseLoadedTailRange: () => ({}),
    assertLongListCollapseMountedNeighbors: () => ({}),
  }),
);
import { runCanonicalLongListCollapseGate } from "./session-history-user-collapse-gate.mjs";

const probe = {
  sessionId: "fixture-session",
  turnId: "fixture-turn",
  itemId: "fixture-item",
  sha256: "a".repeat(64),
  textUtf16Length: 42,
};
const page = {
  locator: () => ({ hover: async () => undefined }),
  evaluate: async () => shape,
  waitForTimeout: async () => undefined,
};

afterEach(() => vi.restoreAllMocks());

describe("long-list shared exact-copy gate", () => {
  it.each([
    { match: false },
    { sha256: "b".repeat(64) },
    { textUtf16Length: 41 },
    { readSource: "renderer-clipboard" },
  ])(
    "preserves the strict exact-copy rejection and safe evidence for %j",
    async (mismatch) => {
      const clipboardCopyEvidence = {
        actualReadObserved: true,
        actualEqualsSentinel: true,
        clipboard: "PRIVATE CLIPBOARD",
        clipboardWriteObservation: {
          calls: [
            {
              expectedTextEqual: true,
              rejectionName: "NotAllowedError",
              errorKind: "permission-denied",
              outcome: "rejected",
              message: "PRIVATE NATIVE ERROR",
              args: ["PRIVATE BODY"],
            },
          ],
        },
      };
      const hooks = {
        beginReadOnly: async () => ({}),
        finishReadOnly: vi.fn(),
        verifyExactCopy: vi.fn(async () => ({
          match: true,
          sha256: probe.sha256,
          textUtf16Length: probe.textUtf16Length,
          readSource: "electron-main-clipboard",
          ...mismatch,
          clipboardCopyEvidence,
        })),
      };
      let failure;
      try {
        await runCanonicalLongListCollapseGate(page, probe, hooks, {
          timeoutMs: 100,
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      expect(failure.message).toContain("copy 未证明真实剪贴板完整");
      const evidence = extractLongListCollapseFailure(failure);
      expect(evidence).toMatchObject({
        stage: "collapsed-copy",
        clipboardCopyEvidence: {
          actualReadObserved: true,
          actualEqualsSentinel: true,
          clipboardWriteObservation: {
            intervalComplete: false,
            calls: [
              {
                outcome: "rejected",
                rejectionName: "NotAllowedError",
                errorKind: "permission-denied",
              },
            ],
          },
        },
      });
      expect(hooks.verifyExactCopy).toHaveBeenCalledExactlyOnceWith({
        page,
        probe,
        state: "collapsed",
        bubbleSelector: expect.any(String),
      });
      const selector = hooks.verifyExactCopy.mock.calls[0][0].bubbleSelector;
      expect(selector).toContain('[data-thread-item-id="fixture-item"]');
      expect(selector).toContain('[data-runtime-turn-id="fixture-turn"]');
      expect(hooks.finishReadOnly).not.toHaveBeenCalled();
      expect(JSON.stringify(evidence)).not.toContain("PRIVATE");
    },
  );
});
