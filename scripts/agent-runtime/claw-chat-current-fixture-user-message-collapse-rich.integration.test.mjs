import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../electron/mcp-config-fixture-smoke.mjs", () => ({
  appServerCallFromPage: vi.fn(),
}));
import { appServerCallFromPage } from "../electron/mcp-config-fixture-smoke.mjs";
import {
  readCollapseDom,
  runRichUserMessageCollapseGate,
  runUserMessageCollapseGate,
} from "./claw-chat-current-fixture-user-message-collapse.mjs";
import {
  collapseTextIdentity,
  extractUserMessageCollapseFailure,
  summarizeUserMessageCollapseFailure,
} from "./claw-chat-current-fixture-user-message-collapse-evidence.mjs";
import { readCopyActionDom } from "./claw-chat-current-fixture-user-message-collapse-copy-action.mjs";

const BODY = "PRIVATE RICH BODY 😀\n".repeat(30) + "PRIVATE TAIL";
const ORIGINAL = "PRIVATE ORIGINAL CLIPBOARD";
const expected = {
  threadId: "rich-thread",
  turnId: "rich-turn",
  itemId: "rich-item",
  clientId: "rich-client",
  text: BODY,
  renderedText: BODY,
  headText: "PRIVATE RICH",
  tailText: "TAIL",
};
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);

function readModel() {
  return {
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
                type: "userMessage",
                id: expected.itemId,
                clientId: expected.clientId,
                content: [{ type: "text", text: BODY }],
              },
            ],
          },
        ],
      },
    },
  };
}

function richSummary() {
  return {
    threadId: expected.threadId,
    inputbarRichRestoreBackendTurnStart: { turnId: expected.turnId },
    inputbarRichRestoreReadModelCanceled: {
      includesCanceled: true,
      richInputSubmission: {
        ok: true,
        threadId: expected.threadId,
        itemId: expected.itemId,
        clientUserMessageId: expected.clientId,
      },
    },
  };
}

// Controlled fixture integration only: these projections and trusted-input
// records are explicit test dependencies, not real Electron interaction proof.
function fixture({
  kind = "canonical_turn",
  nativeError,
  failReadAt,
  readError,
  delivered = BODY,
  bubbleHoverError,
} = {}) {
  let state = "collapsed";
  let clipboard = ORIGINAL;
  let reads = 0;
  let hovered = false;
  const expectations = [];
  const button = document.querySelector("button");
  const event = (type, detail) =>
    window.__limeUserMessageCollapseObserver.events.push({
      type,
      trusted: true,
      focused: true,
      identityMatches: true,
      ...(type === "click" ? { detail } : { key: detail }),
    });
  const nativeWrite = vi.fn(function writeText(text) {
    if (nativeError) return Promise.reject(nativeError);
    clipboard = text;
    return Promise.resolve();
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: nativeWrite },
    configurable: true,
  });
  const box = async () => ({ x: 0, y: 20, width: 100, height: 20 });
  const copyButton = {
    count: async () => 1,
    boundingBox: box,
    hover: vi.fn(async () => {
      if (!hovered) throw new Error("controlled hidden footer");
    }),
    evaluate: async (callback, argument) =>
      callback === readCopyActionDom
        ? {
            bubbleCount: 1,
            identityMatches: true,
            entryKind: kind,
            footer: {
              tag: "DIV",
              rect: { height: hovered ? 24 : 0 },
              layout: {
                maxHeight: hovered ? "24px" : "0px",
                pointerEvents: hovered ? "auto" : "none",
                opacity: hovered ? 1 : 0,
              },
            },
            hit: {
              relation: hovered ? "copy-button" : "user-bubble",
              acceptsButton: hovered,
            },
          }
        : callback(button, argument),
    click: async () => {
      if (!hovered) throw new Error("controlled hidden footer");
      await navigator.clipboard.writeText(delivered).catch(() => undefined);
    },
  };
  const locator = {
    hover: vi.fn(async () => {
      if (bubbleHoverError) throw bubbleHoverError;
      hovered = true;
    }),
    count: async () => 1,
    boundingBox: box,
    click: async () => {
      state = state === "collapsed" ? "expanded" : "collapsed";
      event("click", 1);
    },
    evaluate: async (callback, argument) => callback(button, argument),
    getByRole: () => copyButton,
  };
  for (const name of ["locator", "filter", "and"])
    locator[name] = () => locator;
  const page = {
    locator: (selector) =>
      selector === '[data-testid="message-list-scroll-container"]'
        ? {
            boundingBox: async () => ({
              x: 0,
              y: 0,
              width: 1000,
              height: 1000,
            }),
          }
        : locator,
    viewportSize: () => ({ width: 1000, height: 1000 }),
    keyboard: {
      press: async (key) => {
        button.focus();
        if (key === "Shift+Tab") {
          event("keydown", "Tab");
          return;
        }
        state = key === "Enter" ? "collapsed" : "expanded";
        event("keydown", key === "Space" ? " " : key);
        event("click", 0);
      },
    },
    evaluate: async (callback, argument) => {
      if (argument?.expected) expectations.push({ ...argument.expected });
      if (callback !== readCollapseDom) return callback(argument);
      return {
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
        itemId: expected.itemId,
        groupTurnId: expected.turnId,
        renderEntryKind: kind,
        directSegmentKind: kind === "canonical_turn" ? "message" : null,
        bodyKind:
          kind === "canonical_turn" ? "markdown" : "installed_skill_span",
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
        renderedText: BODY,
        tailInsideContentViewport: state === "expanded",
      };
    },
  };
  const args = {
    page,
    options: { timeoutMs: 1000 },
    summary: richSummary(),
    expectedText: BODY,
    headText: expected.headText,
    readClipboardText: async () => {
      if (++reads === failReadAt) throw readError;
      return clipboard;
    },
    writeClipboardText: async (text) => {
      clipboard = text;
    },
  };
  return {
    args,
    expectations,
    nativeWrite,
    bubbleLocator: locator,
    copyButton,
    clipboard: () => clipboard,
  };
}

beforeEach(() => {
  document.body.innerHTML = "<button>controlled toggle</button>";
  appServerCallFromPage.mockReset().mockResolvedValue(readModel());
  localStorage.setItem(
    "lime_invoke_trace_buffer_v1",
    JSON.stringify([
      {
        timestamp: "2026-10-14T00:00:00.000Z",
        command: "app_server_handle_json_lines",
        transport: "electron-ipc",
        status: "success",
        duration_ms: 1,
        args_preview: {
          request: {
            lines: [
              JSON.stringify({
                id: "start-id",
                method: "turn/start",
                params: {
                  threadId: expected.threadId,
                  clientUserMessageId: expected.clientId,
                  input: [{ type: "text", text: BODY }],
                },
              }),
            ],
          },
        },
      },
    ]),
  );
});
afterEach(() => {
  window.__limeClipboardWriteObservation?.stop();
  expect(window.__limeUserMessageCollapseObserver).toBeUndefined();
  if (originalClipboard)
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete navigator.clipboard;
  localStorage.clear();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("accepted rich canonical user-message collapse", () => {
  it("requires canonical_turn throughout the rich wrapper and accepts a complete canonical projection", async () => {
    const controlled = fixture();
    const result = await runRichUserMessageCollapseGate(controlled.args);
    expect(result).toMatchObject({
      ok: true,
      exactVisibleEntry: true,
      renderEntryKind: "canonical_turn",
      canonicalFullText: true,
      collapsedClipboardFullText: true,
      expandedClipboardFullText: true,
    });
    expect(controlled.expectations.length).toBeGreaterThan(5);
    expect(
      controlled.expectations.every(
        (value) => value.renderEntryKind === "canonical_turn",
      ),
    ).toBe(true);
    expect(controlled.nativeWrite).toHaveBeenCalledTimes(2);
    expect(controlled.bubbleLocator.hover).toHaveBeenCalledTimes(2);
    expect(controlled.copyButton.hover).toHaveBeenCalledTimes(2);
    expect(result.copyActionPhases.collapsed).toMatchObject({
      input: "locator-hover",
      bubbleHoverCompleted: true,
      buttonHoverCompleted: true,
      observations: {
        beforeHover: {
          footer: { layout: { opacity: 0, pointerEvents: "none" } },
          hit: { acceptsButton: false },
        },
        afterBubbleHover: { hit: { acceptsButton: true } },
        ready: { hit: { acceptsButton: true } },
      },
    });
    expect(controlled.clipboard()).toBe(ORIGINAL);
  });

  it("rejects a complete rich message_group fallback even when Item, Turn, body and copy all match", async () => {
    const controlled = fixture({ kind: "message_group" });
    await expect(
      runRichUserMessageCollapseGate(controlled.args),
    ).rejects.toThrow("UserMessage collapse Gate failed");
    expect(
      controlled.args.summary.inputbarRichRestoreUserMessageCollapseFailure,
    ).toMatchObject({
      stage: "oracle",
      observed: { renderEntryKind: "message_group" },
    });
    expect(controlled.clipboard()).toBe(ORIGINAL);
  });

  it("keeps the generic message_group consumer valid when canonical entry is not required", async () => {
    const controlled = fixture({ kind: "message_group" });
    const result = await runUserMessageCollapseGate({
      ...controlled.args,
      expected,
    });
    expect(result).toMatchObject({
      ok: true,
      exactVisibleEntry: true,
      renderEntryKind: "message_group",
    });
    expect(controlled.clipboard()).toBe(ORIGINAL);
  });

  it("retains both successful copy phase proofs when a later aggregate oracle fails", async () => {
    const controlled = fixture({ kind: "message_group" });
    // A distinct identity mismatch ensures aggregate failure before the
    // canonical-only rich fix, while both clipboard deliveries are exact.
    const originalEvaluate = controlled.args.page.evaluate;
    controlled.args.page.evaluate = async (callback, argument) => {
      const value = await originalEvaluate(callback, argument);
      return callback === readCollapseDom
        ? { ...value, itemId: "wrong-item" }
        : value;
    };
    let failure;
    try {
      await runRichUserMessageCollapseGate(controlled.args);
    } catch (error) {
      failure = error;
    }
    const safe = extractUserMessageCollapseFailure(failure);
    expect(safe).toMatchObject({
      stage: "oracle",
      clipboardPhases: {
        collapsed: {
          fullTextMatched: true,
          textIdentity: collapseTextIdentity(BODY),
          clipboardWriteObservation: {
            intervalComplete: true,
            calls: [{ expectedTextEqual: true, outcome: "fulfilled" }],
          },
        },
        expanded: {
          fullTextMatched: true,
          textIdentity: collapseTextIdentity(BODY),
          clipboardWriteObservation: {
            intervalComplete: true,
            calls: [{ expectedTextEqual: true, outcome: "fulfilled" }],
          },
        },
      },
    });
    expect(
      controlled.args.summary.inputbarRichRestoreUserMessageCollapseFailure,
    ).toEqual(safe);
    expect(JSON.stringify(safe)).not.toContain(BODY);
    expect(JSON.stringify(safe)).not.toContain(ORIGINAL);
  });

  it("retains native rejection diagnostics from both phases in aggregate failure", async () => {
    const controlled = fixture({
      nativeError: new DOMException(
        "Write permission denied.",
        "NotAllowedError",
      ),
    });
    let failure;
    try {
      await runRichUserMessageCollapseGate(controlled.args);
    } catch (error) {
      failure = error;
    }
    const safe = extractUserMessageCollapseFailure(failure);
    expect(safe).toMatchObject({
      stage: "oracle",
      clipboardPhases: {
        collapsed: {
          fullTextMatched: false,
          actualReadObserved: true,
          actualEqualsExpected: false,
          actualEqualsSentinel: true,
          clipboardWriteObservation: {
            intervalComplete: true,
            calls: [
              {
                expectedTextEqual: true,
                outcome: "rejected",
                rejectionName: "NotAllowedError",
                errorKind: "permission-denied",
              },
            ],
          },
        },
        expanded: {
          fullTextMatched: false,
          actualReadObserved: true,
          actualEqualsExpected: false,
          actualEqualsSentinel: true,
          clipboardWriteObservation: {
            intervalComplete: true,
            calls: [
              {
                expectedTextEqual: true,
                outcome: "rejected",
                rejectionName: "NotAllowedError",
                errorKind: "permission-denied",
              },
            ],
          },
        },
      },
    });
    expect(JSON.stringify(safe)).not.toContain(BODY);
    expect(JSON.stringify(safe)).not.toContain("Write permission denied.");
    expect(controlled.clipboard()).toBe(ORIGINAL);
  });

  it("carries a native exception proof through copy-stage failure without replacing the primary error", async () => {
    const original = new Error("controlled read failure");
    const controlled = fixture({
      nativeError: new DOMException(
        "Document is not focused.",
        "NotAllowedError",
      ),
      failReadAt: 3,
      readError: original,
    });
    await expect(runRichUserMessageCollapseGate(controlled.args)).rejects.toBe(
      original,
    );
    expect(extractUserMessageCollapseFailure(original)).toMatchObject({
      stage: "copy-collapsed",
      clipboardPhases: {
        collapsed: {
          sentinelObserved: true,
          fullTextMatched: false,
          clipboardWriteObservation: {
            intervalComplete: true,
            calls: [
              {
                outcome: "rejected",
                rejectionName: "NotAllowedError",
                errorKind: "document-not-focused",
              },
            ],
          },
        },
      },
    });
    expect(controlled.clipboard()).toBe(ORIGINAL);
    expect(
      controlled.args.summary.inputbarRichRestoreUserMessageCollapseFailure,
    ).toEqual(extractUserMessageCollapseFailure(original));
    expect(
      JSON.stringify(extractUserMessageCollapseFailure(original)),
    ).not.toContain(BODY);
    expect(
      JSON.stringify(extractUserMessageCollapseFailure(original)),
    ).not.toContain("Document is not focused.");
  });

  it("keeps the completed collapsed proof when expanded copy readback fails", async () => {
    const original = new Error("controlled expanded read failure");
    const controlled = fixture({ failReadAt: 7, readError: original });
    await expect(runRichUserMessageCollapseGate(controlled.args)).rejects.toBe(
      original,
    );
    const safe = extractUserMessageCollapseFailure(original);
    expect(safe).toMatchObject({
      stage: "copy-expanded",
      clipboardPhases: {
        collapsed: {
          fullTextMatched: true,
          textIdentity: collapseTextIdentity(BODY),
          clipboardWriteObservation: {
            intervalComplete: true,
            calls: [{ outcome: "fulfilled" }],
          },
        },
        expanded: {
          sentinelObserved: true,
          buttonClicked: true,
          actualReadObserved: false,
          clipboardWriteObservation: {
            intervalComplete: true,
            calls: [{ expectedTextEqual: true, outcome: "fulfilled" }],
          },
        },
      },
    });
    expect(controlled.clipboard()).toBe(ORIGINAL);
    expect(JSON.stringify(safe)).not.toContain(BODY);
    expect(JSON.stringify(safe)).not.toContain(ORIGINAL);
  });

  it("preserves a real hover failure with safe hidden-footer geometry in the rich summary", async () => {
    const original = new Error(BODY);
    const controlled = fixture({ bubbleHoverError: original });
    await expect(runRichUserMessageCollapseGate(controlled.args)).rejects.toBe(
      original,
    );
    const safe = extractUserMessageCollapseFailure(original);
    expect(safe).toMatchObject({
      stage: "copy-collapsed",
      copyActionPhases: {
        collapsed: {
          bubbleHoverCompleted: false,
          buttonHoverCompleted: false,
          observations: {
            beforeHover: {
              footer: { layout: { opacity: 0, pointerEvents: "none" } },
              hit: { acceptsButton: false },
            },
            failure: { hit: { relation: "user-bubble", acceptsButton: false } },
          },
        },
      },
      clipboardPhases: {
        collapsed: {
          sentinelObserved: true,
          buttonClicked: false,
          clipboardWriteObservation: null,
        },
      },
    });
    expect(controlled.nativeWrite).not.toHaveBeenCalled();
    expect(controlled.clipboard()).toBe(ORIGINAL);
    expect(
      controlled.args.summary.inputbarRichRestoreUserMessageCollapseFailure,
    ).toEqual(safe);
    expect(JSON.stringify(safe)).not.toContain(BODY);
    expect(JSON.stringify(safe)).not.toContain(ORIGINAL);
  });
});

describe("rich clipboard phase failure whitelist", () => {
  it("re-sanitizes phase proofs without unknown phases, raw bodies, native args or messages", () => {
    const raw = {
      expected,
      stage: "oracle",
      clipboardPhases: {
        collapsed: {
          fullTextMatched: true,
          textIdentity: collapseTextIdentity(BODY),
          clipboard: ORIGINAL,
          clipboardWriteObservation: {
            calls: [
              {
                message: BODY,
                args: [BODY],
                outcome: "rejected",
                rejectionName: "NotAllowedError",
                errorKind: "permission-denied",
              },
            ],
          },
        },
        expanded: { actualEqualsSentinel: true, rawText: BODY },
        unknown: { rawText: BODY },
      },
    };
    const safe = summarizeUserMessageCollapseFailure(raw);
    expect(safe).toMatchObject({
      clipboardPhases: {
        collapsed: {
          fullTextMatched: true,
          textIdentity: collapseTextIdentity(BODY),
          clipboardWriteObservation: {
            calls: [{ outcome: "rejected", errorKind: "permission-denied" }],
          },
        },
        expanded: { actualEqualsSentinel: true },
      },
    });
    expect(Object.keys(safe.clipboardPhases)).toEqual([
      "collapsed",
      "expanded",
    ]);
    expect(JSON.stringify(safe)).not.toContain(BODY);
    expect(JSON.stringify(safe)).not.toContain(ORIGINAL);
    expect(
      extractUserMessageCollapseFailure({ userMessageCollapseEvidence: safe }),
    ).toEqual(safe);
  });
});
