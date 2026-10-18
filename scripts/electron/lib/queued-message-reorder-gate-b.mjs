import assert from "node:assert/strict";
import {
  isObservedPreloadAppServerResponse,
  parseJsonRpcRequestsFromInvokeTrace,
} from "./mcp-config-fixture-evidence.mjs";
import { appServerCallFromPage } from "../mcp-config-fixture-smoke.mjs";

/** @typedef {import("../../../packages/app-server-client/src/generated/protocol-types.js").QueuedSubmission} QueuedSubmission */
/** @typedef {{data: QueuedSubmission[], observation: Record<string, any>}} QueueRead */
/** @typedef {{type: string, trusted: boolean, submissionId: string | null, action: string | null, key: string | null, order: (string | null)[]}} NativeEvent */
/** @typedef {{sameThread: boolean, dragOrder: string[], keyboardOrder: string[], handleFocused: boolean, idle: boolean}} QueueGui */

/** @param {readonly QueuedSubmission[]} submissions */
function idsOf(submissions) {
  return submissions.map((submission) => submission.id);
}

/**
 * @param {{threadId: string, initialSubmissions: QueuedSubmission[], initial: QueueRead, drag: QueueRead, keyboard: QueueRead, traceRaw: string | null, events: NativeEvent[], gui: QueueGui}} input
 */
export function assertQueuedMessageReorderEvidence(input) {
  const {
    threadId,
    initialSubmissions,
    initial,
    drag,
    keyboard,
    traceRaw,
    events,
    gui,
  } = input;
  assert.equal(
    initialSubmissions.length,
    3,
    "native Queue requires three seeds",
  );
  const initialIds = idsOf(initialSubmissions);
  assert.equal(
    new Set(initialIds).size,
    3,
    "native Queue seed IDs must be unique",
  );
  assert.ok(
    initialSubmissions.every(
      (submission) => submission.id && submission.clientUserMessageId,
    ),
    "native Queue seed identity is missing",
  );
  const inputTypes = new Set(
    initialSubmissions.flatMap((submission) =>
      submission.input.map((item) => item.type),
    ),
  );
  for (const type of /** @type {const} */ ([
    "text",
    "image",
    "skill",
    "mention",
  ])) {
    assert.ok(inputTypes.has(type), `native Queue seed is missing ${type}`);
  }
  const dragOrder = [initialIds[0], initialIds[2], initialIds[1]];
  const snapshots = [
    { name: "initial", read: initial, expected: initialIds },
    { name: "drag", read: drag, expected: dragOrder },
    { name: "keyboard", read: keyboard, expected: initialIds },
  ];
  for (const { name, read, expected } of snapshots) {
    assert.ok(
      isObservedPreloadAppServerResponse(
        read.observation,
        "thread/queue/list",
      ) && read.observation.params?.threadId === threadId,
      `${name}: canonical list lacks matching real preload IPC observation`,
    );
    assert.deepEqual(idsOf(read.data), expected, `${name}: canonical ID order`);
    for (const submission of read.data) {
      const original = initialSubmissions.find(
        (item) => item.id === submission.id,
      );
      assert.deepEqual(
        submission,
        original,
        `${name}: typed input/client identity changed for ${submission.id}`,
      );
    }
  }
  const mutations = parseJsonRpcRequestsFromInvokeTrace(traceRaw).filter(
    (request) =>
      request.method.startsWith("thread/queue/") &&
      !["thread/queue/list"].includes(request.method),
  );
  assert.equal(
    mutations.length,
    2,
    "native Queue requires exactly two mutations",
  );
  for (const [index, request] of mutations.entries()) {
    assert.equal(request.command, "app_server_handle_json_lines");
    assert.equal(request.method, "thread/queue/reorder");
    assert.equal(request.transport, "electron-ipc");
    assert.equal(request.status, "success");
    assert.deepEqual(
      request.params,
      { threadId, queuedSubmissionIds: index === 0 ? dragOrder : initialIds },
      `native Queue reorder ${index + 1}: request identity/order mismatch`,
    );
  }
  assert.ok(
    events.some(
      (event) =>
        event.type === "dragstart" &&
        event.trusted &&
        event.submissionId === initialIds[1] &&
        event.action === "reorder",
    ),
    "native Queue is missing a trusted dragstart on the source handle",
  );
  const drop = events.find(
    (event) =>
      event.type === "drop" &&
      event.trusted &&
      event.submissionId === initialIds[2],
  );
  assert.ok(drop, "native Queue is missing a trusted drop on the target row");
  assert.deepEqual(
    drop.order,
    initialIds,
    "Queue changed order before native drop",
  );
  const key = events.find(
    (event) =>
      event.type === "keydown" &&
      event.trusted &&
      event.submissionId === initialIds[1] &&
      event.action === "reorder" &&
      event.key === "ArrowUp",
  );
  assert.ok(
    key,
    "native Queue is missing a trusted ArrowUp on the source handle",
  );
  assert.deepEqual(
    key.order,
    dragOrder,
    "keyboard did not start from drag readback",
  );
  assert.equal(gui.sameThread, true, "native Queue GUI thread mismatch");
  assert.deepEqual(
    gui.dragOrder,
    dragOrder,
    "native Queue drag GUI order mismatch",
  );
  assert.deepEqual(
    gui.keyboardOrder,
    initialIds,
    "native Queue keyboard GUI order mismatch",
  );
  assert.equal(
    gui.handleFocused,
    true,
    "native Queue lost the source handle focus",
  );
  assert.equal(gui.idle, true, "native Queue admitted an unexpected Turn");
  return { initialIds, dragOrder, mutations };
}

/**
 * @param {import("playwright").Page} page
 * @param {{threadId: string, initialSubmissions: QueuedSubmission[], timeoutMs: number, onStage?: (stage: string) => void}} options
 */
export async function runQueuedMessageReorderGate(page, options) {
  const {
    threadId,
    initialSubmissions,
    timeoutMs,
    onStage = () => {},
  } = options;
  const initialIds = idsOf(initialSubmissions);
  assert.equal(initialIds.length, 3, "native Queue requires three seeds");
  const sourceId = initialIds[1];
  const targetId = initialIds[2];
  const dragOrder = [initialIds[0], targetId, sourceId];
  const list = page.locator('[data-testid="queued-message-list"]');
  assert.equal(await list.getAttribute("data-thread-id"), threadId);
  const row = (/** @type {string} */ id) =>
    list.locator(
      `[data-testid="queued-message-item"][data-submission-id="${id}"]`,
    );
  const source = row(sourceId).locator('[data-queue-action="reorder"]');
  /** @param {string[]} expected */
  const waitForOrder = async (expected) => {
    await page.waitForFunction(
      ({ threadId, expected }) => {
        const list = document.querySelector(
          '[data-testid="queued-message-list"]',
        );
        if (
          !list ||
          list.getAttribute("data-thread-id") !== threadId ||
          list.getAttribute("aria-busy") !== "false"
        )
          return false;
        const actual = Array.from(
          list.querySelectorAll('[data-testid="queued-message-item"]'),
          (row) => row.getAttribute("data-submission-id"),
        );
        return JSON.stringify(actual) === JSON.stringify(expected);
      },
      { threadId, expected },
      { timeout: timeoutMs },
    );
    return await list
      .locator('[data-testid="queued-message-item"]')
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-submission-id") || ""),
      );
  };
  const readCanonical = async () => {
    const response = await appServerCallFromPage(page, "thread/queue/list", {
      threadId,
    });
    assert.ok(
      Array.isArray(response.result?.data),
      "native Queue list has no data",
    );
    return { data: response.result.data, observation: response.ipcObservation };
  };
  await list.locator('[data-queue-action="expand"]').click();
  await waitForOrder(initialIds);
  const observation = await page.evaluateHandle((threadId) => {
    /** @type {NativeEvent[]} */
    const events = [];
    /** @param {Event} event */
    const record = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const list = target.closest('[data-testid="queued-message-list"]');
      if (list?.getAttribute("data-thread-id") !== threadId) return;
      const source = target.closest("[data-submission-id]");
      events.push({
        type: event.type,
        trusted: event.isTrusted,
        submissionId: source?.getAttribute("data-submission-id") ?? null,
        action:
          target
            .closest("[data-queue-action]")
            ?.getAttribute("data-queue-action") ?? null,
        key: event instanceof KeyboardEvent ? event.key : null,
        order: Array.from(
          list.querySelectorAll('[data-testid="queued-message-item"]'),
          (row) => row.getAttribute("data-submission-id"),
        ),
      });
    };
    const types = ["dragstart", "drop", "keydown"];
    for (const type of types) document.addEventListener(type, record, true);
    return {
      events,
      cleanup: () => {
        for (const type of types)
          document.removeEventListener(type, record, true);
      },
    };
  }, threadId);
  try {
    const initial = await readCanonical();
    onStage("native-queue-drag-start");
    await source.dragTo(row(targetId));
    const dragGuiOrder = await waitForOrder(dragOrder);
    const drag = await readCanonical();
    onStage("native-queue-drag-canonical-read");
    await source.focus();
    await source.press("ArrowUp");
    const keyboardGuiOrder = await waitForOrder(initialIds);
    const keyboard = await readCanonical();
    await page.waitForFunction(
      (sourceId) => {
        const focused = document.activeElement;
        return (
          focused?.getAttribute("data-queue-action") === "reorder" &&
          focused
            .closest("[data-submission-id]")
            ?.getAttribute("data-submission-id") === sourceId
        );
      },
      sourceId,
      { timeout: timeoutMs },
    );
    onStage("native-queue-keyboard-canonical-read");
    const gui = await page.evaluate(
      ({ threadId, dragOrder, keyboardOrder }) => {
        const list = document.querySelector(
          '[data-testid="queued-message-list"]',
        );
        return {
          sameThread: list?.getAttribute("data-thread-id") === threadId,
          dragOrder,
          keyboardOrder,
          handleFocused:
            document.activeElement?.getAttribute("data-queue-action") ===
            "reorder",
          idle:
            Boolean(document.querySelector('[data-testid="send-btn"]')) &&
            document
              .querySelector('[data-testid="thread-workspace-header"]')
              ?.getAttribute("data-status") !== "running",
        };
      },
      { threadId, dragOrder: dragGuiOrder, keyboardOrder: keyboardGuiOrder },
    );
    const traceRaw = await page.evaluate(() =>
      window.localStorage.getItem("lime_invoke_trace_buffer_v1"),
    );
    const events = await observation.evaluate((state) => state.events);
    const input = {
      threadId,
      initialSubmissions,
      initial,
      drag,
      keyboard,
      traceRaw,
      events,
      gui,
    };
    const verified = assertQueuedMessageReorderEvidence(input);
    await list.locator('[data-queue-action="collapse"]').click();
    return {
      schemaVersion: 1,
      proofLevel: "Gate B controlled fixture only after actual execution",
      claimBoundary:
        "Two native happy-path reorder actions through real current IPC/canonical reads; no live provider or native failure recovery evidence.",
      ...input,
      ...verified,
      failureRecoveryVerified: false,
    };
  } finally {
    await observation
      .evaluate((state) => state.cleanup())
      .catch(() => undefined);
    await observation.dispose();
  }
}
