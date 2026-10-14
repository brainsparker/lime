import { describe, expect, it } from "vitest";
import { request as currentRequest } from "../../packages/app-server-client/src/protocol.ts";
import { parseJsonRpcRequestsFromInvokeTrace } from "../electron/lib/mcp-config-fixture-evidence.mjs";
import {
  buildUserMessageCollapseAssertions,
  captureCollapseTraceBoundary,
  collapseTextIdentity,
  summarizeCollapseInputBoundary,
  summarizeUserMessageCanonicalPreservation,
  summarizeUserMessageCollapse,
} from "./claw-chat-current-fixture-user-message-collapse-evidence.mjs";

function traceEntry(method = "thread/read", params = {}) {
  return {
    timestamp: "2026-10-14T00:00:00.000Z",
    command: "app_server_handle_json_lines",
    transport: "electron-ipc",
    status: "success",
    duration_ms: 1,
    args_preview: {
      request: {
        lines: [
          JSON.stringify({
            jsonrpc: "2.0",
            id: "fixture-read",
            method,
            params,
          }),
        ],
      },
    },
  };
}

function boundary(entries) {
  return captureCollapseTraceBoundary(
    JSON.stringify(entries),
    parseJsonRpcRequestsFromInvokeTrace,
  );
}

function fixture(kind = "canonical_turn") {
  const text = `${"正文😀\n".repeat(30)}结尾😀`;
  const content = [
    {
      type: "text",
      text,
      text_elements: [{ byteRange: { start: 0, end: 6 }, placeholder: "正文" }],
    },
    { type: "skill", name: "fixture-skill", path: "/fixture/SKILL.md" },
    { type: "mention", name: "file.ts", path: "/fixture/file.ts" },
    { type: "image", url: "sidecar://media/fixture.png", detail: null },
  ];
  const expected = {
    threadId: "thread-fixture",
    turnId: "turn-fixture",
    itemId: "item-fixture",
    clientId: "client-fixture",
    text,
    headText: "正文😀",
    tailText: "结尾😀",
    contentParts: structuredClone(content),
    renderEntryKind: kind,
    requireAcceptedSubmission: true,
  };
  const read = {
    ipcObservation: {
      electron: true,
      fallback: false,
      command: "app_server_handle_json_lines",
      transport: "electron-ipc",
      status: "success",
      method: "thread/read",
      params: { threadId: expected.threadId, includeTurns: true },
      requestId: "read-id",
      responseId: "read-id",
    },
    result: {
      thread: {
        id: expected.threadId,
        turns: [
          {
            id: expected.turnId,
            items: [
              {
                id: expected.itemId,
                type: "userMessage",
                clientId: expected.clientId,
                content,
              },
            ],
          },
        ],
      },
    },
  };
  const start = traceEntry("turn/start", {
    threadId: expected.threadId,
    clientUserMessageId: expected.clientId,
    input: content,
  });
  const snapshots = [
    "collapsed",
    "expanded",
    "collapsed",
    "expanded",
    "collapsed",
  ].map((state) => ({
    electron: true,
    preload: true,
    bubbleCount: 1,
    rootCount: 1,
    viewportCount: 1,
    fullCount: 1,
    toggleCount: 1,
    footerCount: 1,
    copyCount: 1,
    role: "user",
    turnId: expected.turnId,
    groupTurnId: expected.turnId,
    itemId: expected.itemId,
    renderEntryKind: kind,
    directSegmentKind: kind === "canonical_turn" ? "message" : null,
    bodyKind: kind === "canonical_turn" ? "markdown" : "installed_skill_span",
    state,
    ariaExpanded: state === "expanded",
    controlsMatch: true,
    lineHeight: 27,
    threshold: 541,
    naturalHeight: 900,
    viewportHeight: state === "expanded" ? 900 : 541,
    overflowY: state === "expanded" ? "visible" : "hidden",
    headPresent: true,
    tailPresent: true,
    renderedFullTextPresent: true,
    renderedTextIdentity: collapseTextIdentity(text),
    tailInsideContentViewport: state === "expanded",
  }));
  const click = (detail) => ({
    type: "click",
    detail,
    trusted: true,
    identityMatches: true,
  });
  const key = (value) => ({
    type: "keydown",
    key: value,
    trusted: true,
    focused: true,
    identityMatches: true,
  });
  const copy = {
    sentinelObserved: true,
    buttonClicked: true,
    fullTextMatched: true,
    textIdentity: collapseTextIdentity(text),
  };
  return {
    expected,
    beforeRead: read,
    afterRead: structuredClone(read),
    snapshots,
    traceBefore: boundary([start]),
    traceAfter: boundary([start, traceEntry()]),
    events: [
      click(1),
      key("Tab"),
      key("Enter"),
      click(0),
      key(" "),
      click(0),
      click(1),
    ],
    clipboard: {
      collapsed: structuredClone(copy),
      expanded: structuredClone(copy),
    },
    references: { status: "not-applicable" },
  };
}

describe("UserMessage collapse observation contract", () => {
  it.each(["canonical_turn", "message_group"])(
    "closes %s without conflating entry kinds",
    (kind) => {
      const evidence = summarizeUserMessageCollapse(fixture(kind));
      expect(evidence.ok).toBe(true);
      expect(evidence.renderEntryKind).toBe(kind);
      expect(evidence.referenceEvidence).toBe("not-applicable");
      expect(evidence).not.toHaveProperty("text");
      expect(evidence).not.toHaveProperty("contentParts");
    },
  );

  it.each([
    [
      "wrong visible Item",
      "exactVisibleEntry",
      (f) => {
        f.snapshots[0].itemId = "wrong";
      },
    ],
    [
      "wrong visible Turn",
      "exactVisibleEntry",
      (f) => {
        f.snapshots[0].turnId = "wrong";
      },
    ],
    [
      "wrong entry",
      "exactVisibleEntry",
      (f) => {
        f.snapshots[0].renderEntryKind = "message_group";
      },
    ],
    [
      "missing direct segment",
      "exactVisibleEntry",
      (f) => {
        f.snapshots[0].directSegmentKind = null;
      },
    ],
    [
      "duplicate bubble",
      "exactVisibleEntry",
      (f) => {
        f.snapshots[0].bubbleCount = 2;
      },
    ],
    [
      "duplicate copy",
      "exactVisibleEntry",
      (f) => {
        f.snapshots[0].copyCount = 2;
      },
    ],
    [
      "unmeasured height",
      "measuredTwentyLineThreshold",
      (f) => {
        f.snapshots[0].naturalHeight = NaN;
      },
    ],
    [
      "threshold equality",
      "measuredTwentyLineThreshold",
      (f) => {
        f.snapshots[0].naturalHeight = 541;
      },
    ],
    [
      "guessed threshold",
      "measuredTwentyLineThreshold",
      (f) => {
        f.snapshots[0].threshold = 20;
      },
    ],
    [
      "ARIA-only expand",
      "realVisualTransitions",
      (f) => {
        f.snapshots[1].viewportHeight = 541;
      },
    ],
    [
      "tail still clipped",
      "realVisualTransitions",
      (f) => {
        f.snapshots[1].tailInsideContentViewport = false;
      },
    ],
    [
      "hidden prefix copied",
      "collapsedClipboardFullText",
      (f) => {
        f.clipboard.collapsed.textIdentity = collapseTextIdentity("正文😀");
      },
    ],
    [
      "Unicode tail lost",
      "expandedClipboardFullText",
      (f) => {
        f.clipboard.expanded.textIdentity = collapseTextIdentity(
          f.expected.text.slice(0, -1),
        );
      },
    ],
    [
      "stale clipboard",
      "expandedClipboardFullText",
      (f) => {
        f.clipboard.expanded.sentinelObserved = false;
      },
    ],
    [
      "partial rendered body",
      "completeRenderedBodyRetained",
      (f) => {
        f.snapshots[0].renderedFullTextPresent = false;
      },
    ],
    [
      "body changes on expand",
      "completeRenderedBodyRetained",
      (f) => {
        f.snapshots[1].renderedTextIdentity = collapseTextIdentity("changed");
      },
    ],
    [
      "synthetic Enter",
      "trustedPointerAndKeyboard",
      (f) => {
        f.events[2].trusted = false;
      },
    ],
    [
      "nonfocused Enter",
      "trustedPointerAndKeyboard",
      (f) => {
        f.events[2].focused = false;
      },
    ],
    [
      "double keyboard toggle",
      "trustedPointerAndKeyboard",
      (f) => {
        f.events.push({ ...f.events[3] });
      },
    ],
    [
      "canonical text drift",
      "canonicalPartsUnchanged",
      (f) => {
        f.afterRead.result.thread.turns[0].items[0].content[0].text += "new";
      },
    ],
    [
      "text element drift",
      "canonicalTextElementsUnchanged",
      (f) => {
        f.afterRead.result.thread.turns[0].items[0].content[0].text_elements[0].byteRange.end += 1;
      },
    ],
    [
      "canonical media drift",
      "canonicalPartsUnchanged",
      (f) => {
        f.afterRead.result.thread.turns[0].items[0].content[3].url = "changed";
      },
    ],
    [
      "wrong canonical client",
      "canonicalIdentity",
      (f) => {
        f.afterRead.result.thread.turns[0].items[0].clientId = "other";
      },
    ],
    [
      "fallback read",
      "readsObserved",
      (f) => {
        f.beforeRead.ipcObservation.fallback = true;
      },
    ],
    [
      "wrong read response",
      "readsObserved",
      (f) => {
        f.afterRead.ipcObservation.responseId = "other";
      },
    ],
    [
      "trace unavailable",
      "completeInputBoundary",
      (f) => {
        f.traceAfter.complete = false;
      },
    ],
    [
      "trace prefix evicted",
      "completeInputBoundary",
      (f) => {
        f.traceAfter.entryDigests.shift();
      },
    ],
    [
      "trace error",
      "completeInputBoundary",
      (f) => {
        f.traceAfter.errorCount = 1;
      },
    ],
  ])("rejects %s", (_name, check, mutate) => {
    const facts = fixture();
    mutate(facts);
    const evidence = summarizeUserMessageCollapse(facts);
    expect(evidence[check]).toBe(false);
    expect(evidence.ok).toBe(false);
  });

  it.each([
    "turn/start",
    "turn/steer",
    "thread/queue/add",
    "thread/queue/update",
    "thread/queue/delete",
    "thread/queue/reorder",
    "thread/queue/start",
  ])("rejects a new %s even in another Thread", (method) => {
    const facts = fixture();
    facts.traceAfter.inputs.push({
      method,
      threadId: "other-thread",
      digest: "new",
    });
    expect(summarizeUserMessageCollapse(facts).noAdditionalInput).toBe(false);
  });

  it("rejects duplicate canonical Item identity in another Turn", () => {
    const facts = fixture();
    for (const read of [facts.beforeRead, facts.afterRead])
      read.result.thread.turns.push({
        id: "other-turn",
        items: [structuredClone(read.result.thread.turns[0].items[0])],
      });
    expect(
      summarizeUserMessageCanonicalPreservation(facts).canonicalIdentity,
    ).toBe(false);
  });

  it("checks HTTP link focus only when the fixture provides real references", () => {
    const facts = fixture();
    facts.expected.references = {
      visibleHref: "https://fixture.test/head",
      tailHref: "https://fixture.test/tail",
    };
    facts.snapshots[0].referenceCounts = { visible: 1, tail: 1 };
    facts.snapshots[0].visibleReferenceInsideContentViewport = true;
    facts.snapshots[0].tailReferenceInsideContentViewport = false;
    facts.references = {
      status: "observed",
      collapsed: {
        cycleComplete: true,
        visibleReferenceReached: true,
        tailReferenceReached: false,
      },
      expanded: {
        cycleComplete: true,
        visibleReferenceReached: true,
        tailReferenceReached: true,
      },
    };
    expect(summarizeUserMessageCollapse(facts).referencesScoped).toBe(true);
    facts.references.collapsed.tailReferenceReached = true;
    expect(summarizeUserMessageCollapse(facts).referencesScoped).toBe(false);
    facts.references.collapsed.tailReferenceReached = false;
    facts.snapshots[0].bodyKind = "installed_skill_span";
    expect(summarizeUserMessageCollapse(facts).referencesScoped).toBe(false);
  });

  it("requires a complete focus cycle and a reachable visible link", () => {
    const facts = fixture();
    facts.expected.references = { visibleHref: "head", tailHref: "tail" };
    facts.references = {
      status: "observed",
      collapsed: { cycleComplete: false },
    };
    expect(summarizeUserMessageCollapse(facts).referencesScoped).toBe(false);
  });

  it("supports seeded canonical readback without claiming accepted submission", () => {
    const facts = fixture();
    facts.expected.requireAcceptedSubmission = false;
    facts.traceBefore = boundary([traceEntry()]);
    facts.traceAfter = boundary([traceEntry(), traceEntry()]);
    expect(summarizeUserMessageCollapse(facts).ok).toBe(true);
  });

  it("registers the aggregate scenario assertion without trusting bare ok", () => {
    expect(
      buildUserMessageCollapseAssertions({})
        .inputbarRichRestoreUserMessageCollapse,
    ).toBe(false);
    expect(
      buildUserMessageCollapseAssertions({
        inputbarRichRestoreUserMessageCollapse: { ok: true },
      }).inputbarRichRestoreUserMessageCollapse,
    ).toBe(false);
    expect(
      buildUserMessageCollapseAssertions({
        inputbarRichRestoreUserMessageCollapse:
          summarizeUserMessageCollapse(fixture()),
      }).inputbarRichRestoreUserMessageCollapse,
    ).toBe(true);
  });
});

describe("complete UserMessage input trace window", () => {
  function entryFor(request) {
    const entry = traceEntry();
    entry.args_preview.request.lines = [JSON.stringify(request)];
    return entry;
  }

  it("accepts the current sender's request with no jsonrpc version field", () => {
    const request = currentRequest(1, "turn/start", {
      threadId: "thread-current",
      clientUserMessageId: "client-current",
      input: [],
    });
    expect(Object.hasOwn(request, "jsonrpc")).toBe(false);
    const observed = boundary([entryFor(request)]);
    expect(observed.complete).toBe(true);
    expect(observed.inputs).toMatchObject([
      {
        method: "turn/start",
        id: 1,
        threadId: "thread-current",
        clientId: "client-current",
      },
    ]);
  });

  it.each([0, -1, 42, "fixture-read"])(
    "accepts valid current request id %s",
    (id) => {
      expect(
        boundary([entryFor(currentRequest(id, "thread/read"))]).complete,
      ).toBe(true);
    },
  );

  it("continues to accept an explicit 2.0 version", () => {
    expect(boundary([traceEntry()]).complete).toBe(true);
  });

  it.each([null, true, false, 2, "1.0", "2", "", {}, []])(
    "rejects an incorrect explicit version %j",
    (jsonrpc) => {
      expect(
        boundary([entryFor({ id: 1, method: "thread/read", jsonrpc })])
          .complete,
      ).toBe(false);
    },
  );

  it.each([
    null,
    true,
    false,
    0,
    1,
    "request",
    [],
    [{ id: 1, method: "thread/read" }],
  ])("rejects non-object request envelope %j", (request) => {
    expect(boundary([entryFor(request)]).complete).toBe(false);
  });

  it.each([null, true, false, 1.5, "", {}, [], Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid request id %j",
    (id) => {
      expect(boundary([entryFor({ id, method: "thread/read" })]).complete).toBe(
        false,
      );
    },
  );

  it("rejects a request with a missing id", () => {
    expect(boundary([entryFor({ method: "thread/read" })]).complete).toBe(
      false,
    );
  });

  it.each([null, true, 1, "", " \t\n", {}, []])(
    "rejects invalid method %j",
    (method) => {
      expect(boundary([entryFor({ id: 1, method })]).complete).toBe(false);
    },
  );

  it("rejects a request with a missing method", () => {
    expect(boundary([entryFor({ id: 1 })]).complete).toBe(false);
  });

  it.each([null, [], {}, "request", [null], [1], [""], [" "]])(
    "rejects invalid request lines %j",
    (lines) => {
      const entry = traceEntry();
      entry.args_preview.request.lines = lines;
      expect(boundary([entry]).complete).toBe(false);
    },
  );

  it("rejects parser projections with missing fields, even with the correct count", () => {
    const raw = JSON.stringify([traceEntry()]);
    expect(captureCollapseTraceBoundary(raw, () => [{}]).complete).toBe(false);
    expect(
      captureCollapseTraceBoundary(raw, (value) =>
        parseJsonRpcRequestsFromInvokeTrace(value).map((request) => ({
          ...request,
          id: "wrong-id",
        })),
      ).complete,
    ).toBe(false);
  });

  it.each([null, "broken", "{}", "[]"])("fails closed for %s", (raw) => {
    expect(
      captureCollapseTraceBoundary(raw, parseJsonRpcRequestsFromInvokeTrace)
        .complete,
    ).toBe(false);
  });
  it("fails closed when the ring is saturated", () => {
    expect(
      boundary(Array.from({ length: 240 }, () => traceEntry())).complete,
    ).toBe(false);
  });
  it("rejects truncated or missing current request lines", () => {
    const entry = traceEntry();
    entry.args_preview.request.lines = ["{truncated"];
    expect(boundary([entry]).complete).toBe(false);
    delete entry.args_preview;
    expect(boundary([entry]).complete).toBe(false);
  });
  it("rejects partial transport parsing", () => {
    expect(
      captureCollapseTraceBoundary(JSON.stringify([traceEntry()]), () => [])
        .complete,
    ).toBe(false);
  });
  it("allows readonly queue/list without treating it as a submission", () => {
    const before = boundary([traceEntry()]);
    const after = boundary([traceEntry(), traceEntry("thread/queue/list")]);
    expect(
      summarizeCollapseInputBoundary({
        traceBefore: before,
        traceAfter: after,
      }),
    ).toEqual({
      completeInputBoundary: true,
      noAdditionalInput: true,
      acceptedSubmissionBoundary: true,
    });
  });
});
