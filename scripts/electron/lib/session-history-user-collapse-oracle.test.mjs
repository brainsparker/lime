// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyLongListUserMessageProbe,
  bindLongListUserMessageProbe,
  createLongListUserMessageProbe,
  summarizeLongListUserMessageProbe,
} from "./session-history-user-collapse-fixture.mjs";
import {
  assertCanonicalCollapseGeometry,
  assertCanonicalRenderedBodyPreserved,
  assertNoTurnRowOverlap,
  assertSurvivingNeighborAnchor,
  assertLongListCollapseLoadedTailRange,
  assertLongListCollapseMountedNeighbors,
  summarizeLongListCollapseFailure,
  extractLongListCollapseFailure,
} from "./session-history-user-collapse-geometry.mjs";
import {
  THREAD_READ_LONG_LIST,
  THREAD_READ_LONG_LIST_USER_COLLAPSE,
} from "./session-history-long-list-fixture.mjs";
import { assertLongListCollapseColdRestartIdentity } from "./session-history-user-collapse-gate.mjs";
import { assertLongListCollapseTrustedInput } from "./session-history-user-collapse-input.mjs";

function makeFixture() {
  return {
    sessionId: "canonical-collapse-session",
    threadId: "canonical-collapse-thread",
    turns: Array.from({ length: 240 }, (_, index) => ({
      turnId: `turn-${index + 1}`,
      userText: `original user ${index + 1}`,
      userInputs: [{ type: "text", text: `original user ${index + 1}` }],
      reasoningItemId: `reasoning-${index + 1}`,
      assistantItemId: `assistant-${index + 1}`,
      assistantText: `assistant ${index + 1}`,
    })),
  };
}

function geometry(probe, state = "collapsed") {
  const expanded = state === "expanded";
  const targetHeight = expanded ? 5000 : 600;
  const successorOffset = 10000 + targetHeight;
  const target = {
    key: `canonical:${probe.turnId}`,
    turnId: probe.turnId,
    kind: "canonical_turn",
    offset: 10000,
    top: -targetHeight - 8,
    bottom: -8,
    height: targetHeight,
    relativeTop: -targetHeight - 8,
    visible: false,
  };
  const successor = {
    key: `canonical:${probe.nextTurnId}`,
    turnId: probe.nextTurnId,
    kind: "canonical_turn",
    offset: successorOffset,
    top: -8,
    bottom: 172,
    height: 180,
    relativeTop: -8,
    visible: true,
  };
  return {
    sessionId: probe.sessionId,
    turnId: probe.turnId,
    itemId: probe.itemId,
    bubbleCount: 1,
    rootCount: 1,
    rowKey: target.key,
    directKind: "message",
    entryKind: "canonical_turn",
    state,
    viewport: { height: expanded ? 4800 : 400 },
    full: { height: 4800, scrollHeight: 4800, hasStart: true, hasTail: true },
    lineHeight: 20,
    toggle: {
      tag: "BUTTON",
      expanded: String(expanded),
      controlsViewport: true,
    },
    firstLink: { count: 1, inert: false, clippedInContentViewport: true },
    tailLink: {
      count: 1,
      inert: !expanded,
      clippedInContentViewport: expanded,
    },
    scroll: { distanceToBottom: 1500 },
    rows: [target, successor],
    firstVisible: successor,
  };
}

describe("canonical long-list user collapse fixture", () => {
  it("augments one non-tail user Item while preserving neighbors and tail", () => {
    const fixture = makeFixture();
    const baseline = structuredClone(fixture);
    const probe = createLongListUserMessageProbe(fixture);
    applyLongListUserMessageProbe(fixture, probe);
    const bound = bindLongListUserMessageProbe(fixture, probe);
    expect(bound.ordinal).toBe(232);
    expect(bound.itemId).toBe("item_user-turn-232");
    expect(bound.clientId).toBe("client-turn-232");
    expect(bound.previousTurnId).toBe("turn-231");
    expect(bound.nextTurnId).toBe("turn-233");
    expect(bound.text).toContain("😀 𠮷 e\u0301 👩‍💻");
    expect(bound.text).toContain(
      `[${bound.visibleLabel}](${bound.visibleHref})`,
    );
    expect(bound.text).toContain(`[${bound.hiddenLabel}](${bound.hiddenHref})`);
    expect(bound.textUtf8Length).toBeGreaterThan(bound.textUtf16Length);
    expect(fixture.turns[231].userInputs).toEqual([
      { type: "text", text: bound.text },
    ]);
    for (const index of [0, 230, 232, 239])
      expect(fixture.turns[index]).toEqual(baseline.turns[index]);
    expect(fixture.turns[231].assistantText).toBe(
      baseline.turns[231].assistantText,
    );
    expect(summarizeLongListUserMessageProbe(bound)).not.toHaveProperty("text");
  });

  it.each([1, 239, 240, 0, -1, 1.5])(
    "rejects edge or invalid ordinal %s",
    (ordinal) => {
      expect(() =>
        createLongListUserMessageProbe(makeFixture(), { ordinal }),
      ).toThrow();
    },
  );

  it("requires actual seed identity and rejects a moved target", () => {
    const fixture = makeFixture();
    const probe = createLongListUserMessageProbe(fixture);
    fixture.turns[231].turnId = "another-turn";
    expect(() => applyLongListUserMessageProbe(fixture, probe)).toThrow();
    expect(() =>
      bindLongListUserMessageProbe({ sessionId: "", threadId: "" }, probe),
    ).toThrow();
  });
});

describe("actual virtual tail page selection", () => {
  const fixture = makeFixture();
  const probe = createLongListUserMessageProbe(fixture);
  const snapshot = {
    virtual: { totalEntries: 14, startIndex: 0, endIndex: 7 },
    rows: [
      ...[probe.previousTurnId, probe.turnId, probe.nextTurnId].map(
        (turnId) => ({
          turnId,
          kind: "canonical_turn",
        }),
      ),
      { turnId: probe.tailTurnId, kind: "canonical_turn" },
    ],
  };
  it("seeds 232 with 231/233 neighbors inside the observed 227–240 window", () => {
    const actual = THREAD_READ_LONG_LIST_USER_COLLAPSE;
    expect(actual.ordinal).toBe(232);
    expect(THREAD_READ_LONG_LIST.turns[231].userText).toBe(actual.text);
    expect(actual.previousTurnId).toBe(THREAD_READ_LONG_LIST.turns[230].turnId);
    expect(actual.nextTurnId).toBe(THREAD_READ_LONG_LIST.turns[232].turnId);
    expect(
      assertLongListCollapseLoadedTailRange(snapshot, probe),
    ).toMatchObject({
      totalEntries: 14,
      firstOrdinal: 227,
      lastOrdinal: 240,
      probeOrdinal: 232,
      neighborsInside: true,
      completeLoadedIdentityClaim: false,
    });
    expect(assertLongListCollapseMountedNeighbors(snapshot, probe)).toEqual({
      previousTurnId: "turn-231",
      turnId: "turn-232",
      nextTurnId: "turn-233",
    });
  });
  it("rejects old 224, an unloaded neighbor, and a missing canonical tail", () => {
    for (const ordinal of [224, 227, 239])
      expect(() =>
        assertLongListCollapseLoadedTailRange(
          snapshot,
          createLongListUserMessageProbe(fixture, { ordinal }),
        ),
      ).toThrow();
    expect(() =>
      assertLongListCollapseLoadedTailRange(
        {
          ...snapshot,
          rows: snapshot.rows.slice(0, -1),
        },
        probe,
      ),
    ).toThrow();
    expect(() =>
      assertLongListCollapseLoadedTailRange(
        { ...snapshot, virtual: {} },
        probe,
      ),
    ).toThrow();
  });
  it("requires actual unique mounted canonical identities independently of the count", () => {
    for (const rows of [
      snapshot.rows.slice(1),
      [...snapshot.rows, snapshot.rows[1]],
      snapshot.rows.map((row) => ({ ...row, kind: "message_group" })),
    ])
      expect(() =>
        assertLongListCollapseMountedNeighbors({ ...snapshot, rows }, probe),
      ).toThrow();
  });
});

describe("safe long-list failure evidence", () => {
  it("retains before/after geometry through extraction and drops unknown private fields", () => {
    const probe = bindLongListUserMessageProbe(
      makeFixture(),
      createLongListUserMessageProbe(makeFixture()),
    );
    const raw = {
      phase: "interactive",
      stage: "collapse-anchor",
      probe,
      observations: {
        beforeAnchor: {
          ...geometry(probe, "expanded"),
          clipboard: "PRIVATE CLIPBOARD",
        },
        afterAnchor: { ...geometry(probe), text: "PRIVATE BODY" },
        private: { text: "PRIVATE OBSERVATION" },
      },
      trace: { complete: false, entryCount: 300, raw: "PRIVATE REQUEST" },
      private: "PRIVATE TOP LEVEL",
    };
    const error = new Error("geometry failed");
    error.userMessageCollapseEvidence = summarizeLongListCollapseFailure(raw);
    const summary = extractLongListCollapseFailure(error);
    expect(summary.stage).toBe("collapse-anchor");
    expect(summary.probe.turnId).toBe(probe.turnId);
    expect(summary.observations.beforeAnchor.mountedRows[0].height).toBe(5000);
    expect(summary.observations.afterAnchor.mountedRows[0].height).toBe(600);
    expect(summary.observations.afterAnchor.completeLoadedIdentityClaim).toBe(
      false,
    );
    expect(summary.trace.entryCount).toBe(300);
    expect(JSON.stringify(summary)).not.toContain("PRIVATE");
    expect(JSON.stringify(summary)).not.toContain(probe.text);
    expect(extractLongListCollapseFailure({ evidence: raw })).toBeNull();
    expect(extractLongListCollapseFailure(new Error("unrelated"))).toBeNull();
    expect(
      extractLongListCollapseFailure({ userMessageCollapseEvidence: null }),
    ).toBeNull();
    expect(
      extractLongListCollapseFailure({
        userMessageCollapseEvidence: "PRIVATE BODY",
      }),
    ).toBeNull();
  });
  it("rejects body-shaped identities and unrecognized phases instead of spreading them", () => {
    const summary = summarizeLongListCollapseFailure({
      phase: "PRIVATE PHASE",
      stage: "PRIVATE STAGE",
      probe: { turnId: "PRIVATE BODY" },
      observations: {
        current: {
          rows: [
            {
              key: "PRIVATE BODY",
              turnId: "PRIVATE BODY",
              text: "PRIVATE BODY",
            },
          ],
          full: {
            text: "PRIVATE BODY",
            textIdentity: { sha256: "PRIVATE BODY" },
          },
        },
      },
    });
    expect(summary.phase).toBeNull();
    expect(summary.stage).toBeNull();
    expect(summary.probe.turnId).toBeNull();
    expect(JSON.stringify(summary)).not.toContain("PRIVATE");
  });
  it("keeps safe clipboard diagnostics and removes nested bodies, native args and messages", () => {
    const error = new Error("PRIVATE ERROR MESSAGE");
    error.userMessageCollapseEvidence = {
      stage: "collapsed-copy",
      clipboardCopyEvidence: {
        actualReadObserved: true,
        actualEqualsSentinel: true,
        textIdentity: {
          length: 42,
          sha256: "a".repeat(64),
          text: "PRIVATE BODY",
        },
        clipboard: "PRIVATE CLIPBOARD",
        clipboardWriteObservation: {
          runId: "6bd1b447-6761-484e-86ae-bf49d52f11aa",
          calls: [
            {
              argumentType: "string",
              textUtf16Length: 42,
              expectedTextEqual: true,
              outcome: "rejected",
              rejectionName: "NotAllowedError",
              errorKind: "permission-denied",
              args: ["PRIVATE BODY"],
              message: "PRIVATE NATIVE ERROR",
            },
          ],
        },
      },
    };
    const evidence = extractLongListCollapseFailure(error);
    expect(evidence.clipboardCopyEvidence).toMatchObject({
      actualReadObserved: true,
      actualEqualsSentinel: true,
      textIdentity: { length: 42, sha256: "a".repeat(64) },
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
    });
    expect(JSON.stringify(evidence)).not.toContain("PRIVATE");
  });
});

describe("canonical collapse geometry evidence", () => {
  const probe = bindLongListUserMessageProbe(
    makeFixture(),
    createLongListUserMessageProbe(makeFixture()),
  );
  it("requires real clipping and re-expansion with source and focus identity", () => {
    for (const state of ["collapsed", "expanded"]) {
      expect(() =>
        assertCanonicalCollapseGeometry(geometry(probe, state), probe, state),
      ).not.toThrow();
    }
  });

  it.each([
    { sessionId: "foreign" },
    { itemId: "foreign" },
    { turnId: "foreign" },
    { entryKind: "message_group" },
    { directKind: null },
    { bubbleCount: 2 },
    { rootCount: 2 },
    { rowKey: null },
    { state: "expanded" },
    { lineHeight: null },
    { viewport: { height: 4800 } },
    { full: { height: 399, hasStart: true, hasTail: true } },
    { full: { height: 4800, hasStart: true, hasTail: false } },
    { toggle: { tag: "BUTTON", expanded: "true", controlsViewport: true } },
    { toggle: { tag: "DIV", expanded: "false", controlsViewport: true } },
    { toggle: { tag: "BUTTON", expanded: "false", controlsViewport: false } },
    { firstLink: { count: 1, inert: true, clippedInContentViewport: true } },
    { tailLink: { count: 1, inert: false, clippedInContentViewport: false } },
    { tailLink: { count: 1, inert: true, clippedInContentViewport: true } },
  ])("rejects incomplete or ARIA-only collapsed evidence: %j", (patch) => {
    expect(() =>
      assertCanonicalCollapseGeometry(
        { ...geometry(probe), ...patch },
        probe,
        "collapsed",
      ),
    ).toThrow();
  });

  it.each([
    { viewport: { height: 400 } },
    { tailLink: { count: 1, inert: true, clippedInContentViewport: true } },
    { tailLink: { count: 1, inert: false, clippedInContentViewport: false } },
  ])(
    "rejects expanded state that still clips or disables tail: %j",
    (patch) => {
      expect(() =>
        assertCanonicalCollapseGeometry(
          { ...geometry(probe, "expanded"), ...patch },
          probe,
          "expanded",
        ),
      ).toThrow();
    },
  );

  it("rejects actual mounted-row overlap", () => {
    expect(() =>
      assertNoTurnRowOverlap([
        { key: "a", top: 0, bottom: 100, height: 100 },
        { key: "b", top: 90, bottom: 190, height: 100 },
      ]),
    ).toThrow();
  });

  it("requires complete rendered text identity across visual states", () => {
    const full = { textIdentity: { length: 4500, sha256: "a".repeat(64) } };
    expect(() =>
      assertCanonicalRenderedBodyPreserved(
        { full },
        { full: structuredClone(full) },
      ),
    ).not.toThrow();
    expect(() =>
      assertCanonicalRenderedBodyPreserved(
        { full },
        { full: { textIdentity: { length: 400, sha256: "b".repeat(64) } } },
      ),
    ).toThrow();
    expect(() =>
      assertCanonicalRenderedBodyPreserved({ full: {} }, { full }),
    ).toThrow();
  });
});

describe("surviving canonical neighbor anchor", () => {
  const probe = bindLongListUserMessageProbe(
    makeFixture(),
    createLongListUserMessageProbe(makeFixture()),
  );
  it("compares surviving successor position and measured sibling gap", () => {
    const proof = assertSurvivingNeighborAnchor(
      geometry(probe, "expanded"),
      geometry(probe),
      probe,
    );
    expect(proof.policy).toBe("surviving-successor-turn");
    expect(proof.driftPx).toBe(0);
    expect(proof.removedInternalOffsetPreservation).toBe("not asserted");
  });

  it.each([
    "tail",
    "internal-offset",
    "changed-key",
    "drift",
    "offset",
    "unmounted-target",
    "no-resize",
  ])("rejects invalid anchor evidence: %s", (kind) => {
    const before = geometry(probe, "expanded");
    const after = geometry(probe);
    if (kind === "tail") after.scroll.distanceToBottom = 0;
    if (kind === "internal-offset") after.firstVisible.turnId = probe.turnId;
    if (kind === "changed-key") after.firstVisible.key = "foreign-key";
    if (kind === "drift") after.firstVisible.relativeTop += 20;
    if (kind === "offset") after.firstVisible.offset += 50;
    if (kind === "unmounted-target") after.rows.shift();
    if (kind === "no-resize") after.rows[0].height = before.rows[0].height;
    expect(() => assertSurvivingNeighborAnchor(before, after, probe)).toThrow();
  });
});

describe("cold restart user collapse identity", () => {
  const probe = bindLongListUserMessageProbe(
    makeFixture(),
    createLongListUserMessageProbe(makeFixture()),
  );
  const restart = {
    oldPid: 111,
    newPid: 222,
    oldProcessExited: true,
    navigation: "sidebar",
    previous: {
      restartPrecondition: {
        expanded: true,
        itemId: probe.itemId,
        turnId: probe.turnId,
      },
    },
  };
  it("accepts distinct real-process identity and previously expanded Item", () => {
    expect(() =>
      assertLongListCollapseColdRestartIdentity(restart, probe),
    ).not.toThrow();
  });
  it.each([
    { oldPid: 222 },
    { newPid: null },
    { oldProcessExited: false },
    { navigation: "reload" },
    { previous: null },
    {
      previous: {
        restartPrecondition: {
          expanded: false,
          itemId: probe.itemId,
          turnId: probe.turnId,
        },
      },
    },
    {
      previous: {
        restartPrecondition: {
          expanded: true,
          itemId: "foreign",
          turnId: probe.turnId,
        },
      },
    },
  ])("rejects reload or unproved cold restart: %j", (patch) => {
    expect(() =>
      assertLongListCollapseColdRestartIdentity(
        { ...restart, ...patch },
        probe,
      ),
    ).toThrow();
  });
});

describe("long-list trusted interaction evidence", () => {
  const events = [
    { type: "wheel", trusted: true, deltaY: -200 },
    { type: "wheel", trusted: true, deltaY: 200 },
    { type: "keydown", trusted: true, key: "Tab", shift: true, focused: true },
    { type: "keydown", trusted: true, key: "Tab", shift: false, focused: true },
    {
      type: "keydown",
      trusted: true,
      key: "Enter",
      toggle: true,
      focused: true,
    },
    { type: "keydown", trusted: true, key: " ", toggle: true, focused: true },
    { type: "click", trusted: true, toggle: true, detail: 1 },
  ];
  it("requires observed trusted wheels, Tab and toggle interactions", () => {
    expect(() =>
      assertLongListCollapseTrustedInput(events, "interactive"),
    ).not.toThrow();
    expect(() =>
      assertLongListCollapseTrustedInput(events.slice(0, 4), "cold-restart"),
    ).not.toThrow();
  });
  it.each([
    "synthetic",
    "no-wheel",
    "no-back-tab",
    "no-forward-tab",
    "no-enter",
    "no-space",
    "no-pointer",
  ])("rejects missing or untrusted evidence: %s", (kind) => {
    let changed = structuredClone(events);
    if (kind === "synthetic") changed[0].trusted = false;
    if (kind === "no-wheel")
      changed = changed.filter((event) => event.type !== "wheel");
    if (kind === "no-back-tab")
      changed = changed.filter(
        (event) => !(event.key === "Tab" && event.shift),
      );
    if (kind === "no-forward-tab")
      changed = changed.filter(
        (event) => !(event.key === "Tab" && !event.shift),
      );
    if (kind === "no-enter")
      changed = changed.filter((event) => event.key !== "Enter");
    if (kind === "no-space")
      changed = changed.filter((event) => event.key !== " ");
    if (kind === "no-pointer") changed.at(-1).detail = 0;
    expect(() =>
      assertLongListCollapseTrustedInput(changed, "interactive"),
    ).toThrow();
  });
});
