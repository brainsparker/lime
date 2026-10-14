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

const PRIVATE = "private message body / credential fixture";
const expected = {
  threadId: "thread-fixture",
  turnId: "turn-fixture",
  itemId: "item-fixture",
  clientId: "client-fixture",
  text: PRIVATE,
  headText: "private",
  tailText: "fixture",
};
const selectors = {
  root: '[data-testid="collapsible-user-message-content"]',
  viewport: '[data-testid="user-message-content-viewport"]',
  full: '[data-testid="user-message-content-full"]',
  toggle: '[data-testid="user-message-content-toggle"]',
  footer: '[data-testid="user-message-footer"]',
};
const rect = {
  x: 1,
  y: 2,
  top: 2,
  left: 1,
  right: 301,
  bottom: 102,
  width: 300,
  height: 100,
};
function mount({
  itemId = "other-item",
  turnId = expected.turnId,
  messageId = "other-client",
  kind = "canonical_turn",
  hidden = false,
} = {}) {
  const group = document.createElement("div");
  group.dataset.testid = "message-turn-group";
  group.dataset.runtimeTurnId = turnId;
  group.dataset.renderEntryKind = kind;
  const user = document.createElement("div");
  Object.assign(user.dataset, {
    messageRole: "user",
    threadItemId: itemId,
    runtimeTurnId: turnId,
    messageId,
    directSegmentKind: "message",
  });
  user.textContent = PRIVATE;
  if (hidden) user.style.display = "none";
  group.append(user);
  document.body.append(group);
  return user;
}
function dom() {
  return readCollapseDom({ expected, selectors, copyButtonName: "复制消息" });
}
function canonicalRead() {
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
                id: expected.itemId,
                type: "userMessage",
                clientId: expected.clientId,
                content: [{ type: "text", text: PRIVATE }],
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
function pageWith(evaluate) {
  const locator = {};
  for (const name of ["locator", "filter", "and", "getByRole"])
    locator[name] = () => locator;
  return {
    locator: () => locator,
    evaluate: evaluate ?? (async (callback, argument) => callback(argument)),
  };
}
function traceEntry() {
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
            id: "read-id",
            method: "thread/read",
            params: { threadId: expected.threadId, includeTurns: true },
          }),
        ],
      },
    },
  };
}
beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  localStorage.setItem(
    "lime_invoke_trace_buffer_v1",
    JSON.stringify([traceEntry()]),
  );
  window.__LIME_ELECTRON__ = true;
  window.electronAPI = { invoke: () => undefined };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    rect,
  );
  appServerCallFromPage.mockReset().mockResolvedValue(canonicalRead());
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  localStorage.clear();
  delete window.__LIME_ELECTRON__;
  delete window.electronAPI;
  expect(window.__limeUserMessageCollapseObserver).toBeUndefined();
});

describe("safe UserMessage collapse failure evidence", () => {
  it("allowlists nested diagnostics, canonical identities and hashes without bodies or raw trace", () => {
    const raw = {
      stage: "initial-collapsed",
      requestedState: "collapsed",
      expected,
      beforeRead: canonicalRead(),
      observed: {
        ...dom(),
        renderedText: PRIVATE,
        body: PRIVATE,
        html: PRIVATE,
        ledgerEntries: [PRIVATE],
      },
      traceBefore: {
        complete: true,
        currentIpcOnly: true,
        inputs: [{ id: "input-id", params: { text: PRIVATE } }],
        errorCount: 0,
        ledgerEntries: [PRIVATE],
        provenance: {
          mode: "continuous-storage-append",
          runId: "collector-run",
          startedAt: "2026-10-14T00:00:00Z",
          appendCount: 32733,
          currentRingCount: 240,
          seedEntries: [PRIVATE],
        },
      },
      traceRaw: PRIVATE,
      clipboard: PRIVATE,
    };
    const failure = summarizeUserMessageCollapseFailure(raw);
    expect(failure.expected.textIdentity).toEqual(
      collapseTextIdentity(PRIVATE),
    );
    expect(failure.canonical).toEqual({
      observed: true,
      users: [
        {
          turnId: expected.turnId,
          itemId: expected.itemId,
          clientId: expected.clientId,
          contentPartCount: 1,
        },
      ],
    });
    expect(failure.trace).toMatchObject({
      appendCount: 32733,
      ringCount: 240,
      complete: true,
      inputCount: 1,
    });
    const serialized = JSON.stringify(failure);
    expect(serialized).not.toContain(PRIVATE);
    for (const key of [
      "ledgerEntries",
      "seedEntries",
      "traceRaw",
      "clipboard",
      "params",
      'renderedText"',
    ])
      expect(serialized).not.toContain(key);
    expect(
      extractUserMessageCollapseFailure({
        userMessageCollapseEvidence: failure,
      }),
    ).toEqual(failure);
  });

  it.each([
    null,
    undefined,
    1,
    "private",
    [],
    {},
    { schemaVersion: 1, scope: "long-list" },
    { schemaVersion: 2, scope: "user-message-collapse" },
  ])("rejects unsupported dedicated evidence: %s", (value) => {
    expect(
      extractUserMessageCollapseFailure({ userMessageCollapseEvidence: value }),
    ).toBeNull();
  });

  it("ignores generic error.evidence and inherited fields", () => {
    const failure = summarizeUserMessageCollapseFailure({ expected });
    expect(extractUserMessageCollapseFailure({ evidence: failure })).toBeNull();
    expect(
      extractUserMessageCollapseFailure(
        Object.create({ userMessageCollapseEvidence: failure }),
      ),
    ).toBeNull();
  });

  it("re-sanitizes dedicated evidence rather than trusting its existing shape", () => {
    const failure = summarizeUserMessageCollapseFailure({ expected });
    failure.expected.text = PRIVATE;
    failure.observed = {
      renderedText: PRIVATE,
      bubbleCount: -2,
      threshold: Infinity,
      itemId: "unsafe id",
      ariaExpandedValue: PRIVATE,
      mountedUsers: [
        null,
        {
          messageId: "client-safe",
          html: PRIVATE,
          renderEntryKind: PRIVATE,
          rect: { width: Infinity, top: -5 },
        },
      ],
    };
    failure.rawCollector = { seedEntries: [PRIVATE] };
    const safe = extractUserMessageCollapseFailure({
      userMessageCollapseEvidence: failure,
    });
    expect(JSON.stringify(safe)).not.toContain(PRIVATE);
    expect(safe.observed).toMatchObject({
      bubbleCount: null,
      threshold: null,
      itemId: null,
      ariaExpandedValue: "unknown",
    });
    expect(safe.observed.mountedUsers[1]).toMatchObject({
      messageId: "client-safe",
      renderEntryKind: "unknown",
      rect: { top: -5, width: null },
    });
  });

  it("does not execute a throwing diagnostic getter as a new failure", () => {
    const error = {};
    Object.defineProperty(error, "userMessageCollapseEvidence", {
      get() {
        throw new Error(PRIVATE);
      },
    });
    expect(extractUserMessageCollapseFailure(error)).toBeNull();
  });
});

describe("mounted UserMessage identity diagnostics", () => {
  it("lists every mounted identity when the exact target is absent", () => {
    mount({ messageId: expected.clientId, kind: "message_group" });
    mount({ itemId: "hidden-item", messageId: "hidden-client", hidden: true });
    const observation = dom();
    expect(observation).toMatchObject({
      bubbleCount: 0,
      mountedUserCount: 2,
      itemMatchCount: 0,
      exactIdentityBubbleCount: 0,
      clientMatchCount: 1,
      itemId: null,
    });
    const failure = summarizeUserMessageCollapseFailure({
      expected,
      observed: observation,
    });
    expect(failure.observed.mountedUsers).toHaveLength(2);
    expect(failure.observed.mountedUsers[0]).toMatchObject({
      itemId: "other-item",
      messageId: expected.clientId,
      renderEntryKind: "message_group",
      clientMatches: true,
      layoutVisible: true,
    });
    expect(failure.observed.mountedUsers[1].layoutVisible).toBe(false);
    expect(failure.observed.renderEntryKind).toBe("unknown");
    expect(failure.observed.bodyKind).toBe("unknown");
    expect(JSON.stringify(failure)).not.toContain(PRIVATE);
  });

  it("preserves both duplicate targets and fails the existing unique-bubble condition", () => {
    mount({ itemId: expected.itemId, messageId: expected.clientId });
    mount({ itemId: expected.itemId, messageId: "duplicate-client" });
    const observed = dom();
    expect(observed).toMatchObject({
      bubbleCount: 2,
      exactIdentityBubbleCount: 2,
      rootCount: 0,
      itemId: null,
    });
    const failure = summarizeUserMessageCollapseFailure({ expected, observed });
    expect(
      failure.observed.mountedUsers.map((value) => value.messageId),
    ).toEqual([expected.clientId, "duplicate-client"]);
  });

  it("records item-only versus item-and-turn matching without weakening the current oracle", () => {
    mount({
      itemId: expected.itemId,
      turnId: "wrong-turn",
      messageId: expected.clientId,
    });
    expect(dom()).toMatchObject({
      bubbleCount: 1,
      itemMatchCount: 1,
      exactIdentityBubbleCount: 0,
      turnId: "wrong-turn",
    });
  });

  it("keeps the browser callback independently serializable", () => {
    mount();
    const callback = Function(`return (${readCollapseDom.toString()})`)();
    expect(
      callback({ expected, selectors, copyButtonName: "复制消息" })
        .mountedUserCount,
    ).toBe(1);
  });
});

describe("rich failure propagation and observer cleanup", () => {
  it("persists initial collapsed diagnostics in the rich summary and rethrows its original Error", async () => {
    mount({ messageId: expected.clientId, kind: "message_group" });
    const summary = richSummary();
    let failure;
    try {
      await runRichUserMessageCollapseGate({
        page: pageWith(),
        options: { timeoutMs: 10 },
        summary,
        readClipboardText: async () => "clipboard",
        writeClipboardText: async () => undefined,
        expectedText: PRIVATE,
        headText: "private",
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe(
      "UserMessage collapse geometry did not settle: collapsed",
    );
    const safe = extractUserMessageCollapseFailure(failure);
    expect(summary.inputbarRichRestoreUserMessageCollapseFailure).toEqual(safe);
    expect(safe).toMatchObject({
      stage: "initial-collapsed",
      requestedState: "collapsed",
      canonical: { observed: true },
      observed: { bubbleCount: 0, mountedUserCount: 1, clientMatchCount: 1 },
    });
    expect(safe.observed.mountedUsers[0].messageId).toBe(expected.clientId);
    expect(
      JSON.stringify(summary.inputbarRichRestoreUserMessageCollapseFailure),
    ).not.toContain(PRIVATE);
  });

  it("preserves a canonical read failure while attaching a safe current mounted list", async () => {
    mount();
    const original = new Error("controlled canonical read failure");
    original.evidence = { body: PRIVATE, traceRaw: PRIVATE };
    appServerCallFromPage.mockRejectedValueOnce(original);
    await expect(
      runUserMessageCollapseGate({
        page: pageWith(),
        expected,
        readClipboardText: async () => "clipboard",
        writeClipboardText: async () => undefined,
      }),
    ).rejects.toBe(original);
    const safe = extractUserMessageCollapseFailure(original);
    expect(safe).toMatchObject({
      stage: "canonical-read",
      currentObserved: { mountedUserCount: 1 },
      canonical: { observed: false },
    });
    expect(JSON.stringify(safe)).not.toContain(PRIVATE);
  });

  it("records snapshot unavailability without masking the primary failure", async () => {
    const original = new Error("controlled primary failure");
    appServerCallFromPage.mockRejectedValueOnce(original);
    await expect(
      runUserMessageCollapseGate({
        page: pageWith(async () => {
          throw new Error("controlled observation failure");
        }),
        expected,
        readClipboardText: async () => "clipboard",
        writeClipboardText: async () => undefined,
      }),
    ).rejects.toBe(original);
    expect(extractUserMessageCollapseFailure(original)).toMatchObject({
      snapshotUnavailable: true,
      observed: null,
      currentObserved: null,
    });
  });

  it("keeps a frozen primary Error intact even when diagnostic attachment is unavailable", async () => {
    const original = Object.freeze(new Error("controlled frozen failure"));
    appServerCallFromPage.mockRejectedValueOnce(original);
    await expect(
      runUserMessageCollapseGate({
        page: pageWith(),
        expected,
        readClipboardText: async () => "clipboard",
        writeClipboardText: async () => undefined,
      }),
    ).rejects.toBe(original);
    expect(extractUserMessageCollapseFailure(original)).toBeNull();
  });

  it("records rich preconditions without performing a GUI action", async () => {
    const summary = richSummary();
    summary.inputbarRichRestoreReadModelCanceled.richInputSubmission.ok = false;
    await expect(
      runRichUserMessageCollapseGate({
        page: pageWith(),
        summary,
        expectedText: PRIVATE,
      }),
    ).rejects.toThrow("requires accepted canceled canonical evidence");
    expect(summary.inputbarRichRestoreUserMessageCollapseFailure).toMatchObject(
      {
        stage: "rich-precondition",
        expected: { itemId: expected.itemId, clientId: expected.clientId },
      },
    );
    expect(appServerCallFromPage).not.toHaveBeenCalled();
    expect(
      JSON.stringify(summary.inputbarRichRestoreUserMessageCollapseFailure),
    ).not.toContain(PRIVATE);
  });
});
