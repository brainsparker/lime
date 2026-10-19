import { setTimeout as delay } from "node:timers/promises";
import { appServerCallFromPage } from "../electron/mcp-config-fixture-smoke.mjs";
import { parseJsonRpcRequestsFromInvokeTrace } from "../electron/lib/mcp-config-fixture-evidence.mjs";
import { captureInvokeTraceCollector } from "../lib/invoke-trace-collector.mjs";
import {
  prepareCopyAction,
  summarizeCopyActionPhases,
} from "./claw-chat-current-fixture-user-message-collapse-copy-action.mjs";
import {
  startClipboardWriteObservation,
  stopClipboardWriteObservation,
  summarizeClipboardWriteObservation,
  summarizeClipboardCopyProof,
  extractClipboardCopyEvidence,
} from "./claw-chat-current-fixture-user-message-collapse-clipboard-observation.mjs";
import {
  captureCollapseTraceBoundary,
  captureContinuousTraceBoundary,
  collapseTextIdentity,
  extractUserMessageCollapseFailure,
  summarizeUserMessageCollapse,
  summarizeUserMessageCollapseFailure,
} from "./claw-chat-current-fixture-user-message-collapse-evidence.mjs";

const SELECTORS = {
  root: '[data-testid="collapsible-user-message-content"]',
  viewport: '[data-testid="user-message-content-viewport"]',
  full: '[data-testid="user-message-content-full"]',
  toggle: '[data-testid="user-message-content-toggle"]',
  scroll: '[data-testid="message-list-scroll-container"]',
  footer: '[data-testid="user-message-footer"]',
};

// Browser-side observations contain text only transiently. The exported
// evidence carries identities, booleans and measured geometry, never bodies.
export function readCollapseDom({ expected, selectors, copyButtonName }) {
  const layoutVisible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  };
  const mounted = [...document.querySelectorAll('[data-message-role="user"]')];
  const mountedUsers = mounted.map((node) => {
    const group = node.closest('[data-testid="message-turn-group"]');
    const roots = node.querySelectorAll(selectors.root);
    const rect = node.getBoundingClientRect();
    return {
      messageId: node.dataset.messageId ?? null,
      itemId: node.dataset.threadItemId ?? null,
      turnId: node.dataset.runtimeTurnId ?? null,
      groupTurnId: group?.dataset.runtimeTurnId ?? null,
      renderEntryKind: group?.dataset.renderEntryKind ?? null,
      directSegmentKind: node.dataset.directSegmentKind ?? null,
      layoutVisible: layoutVisible(node),
      itemMatches: node.dataset.threadItemId === expected.itemId,
      turnMatches: node.dataset.runtimeTurnId === expected.turnId,
      clientMatches: node.dataset.messageId === expected.clientId,
      rootCount: roots.length,
      state:
        roots.length === 1
          ? (roots[0].dataset.userMessageContentState ?? null)
          : null,
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
    };
  });
  const bubbles = mounted.filter(
    (node) =>
      node.dataset.threadItemId === expected.itemId && layoutVisible(node),
  );
  const bubble = bubbles.length === 1 ? bubbles[0] : null;
  const group = bubble?.closest('[data-testid="message-turn-group"]');
  const roots = bubble?.querySelectorAll(selectors.root) ?? [];
  const root = roots.length === 1 ? roots[0] : null;
  const viewports = root?.querySelectorAll(selectors.viewport) ?? [];
  const fulls = root?.querySelectorAll(selectors.full) ?? [];
  const toggles = root?.querySelectorAll(selectors.toggle) ?? [];
  const viewport = viewports.length === 1 ? viewports[0] : null;
  const full = fulls.length === 1 ? fulls[0] : null;
  const toggle = toggles.length === 1 ? toggles[0] : null;
  const footers =
    bubble?.parentElement?.querySelectorAll(selectors.footer) ?? [];
  const footer = footers.length === 1 ? footers[0] : null;
  const copies = [...(footer?.querySelectorAll("button") ?? [])].filter(
    (node) => node.getAttribute("aria-label") === copyButtonName,
  );
  const viewportRect = viewport?.getBoundingClientRect();
  const fullRect = full?.getBoundingClientRect();
  const lineHeight = full
    ? Number.parseFloat(getComputedStyle(full).lineHeight)
    : null;
  const insideViewport = (rect) =>
    !!rect &&
    !!viewportRect &&
    rect.height > 0 &&
    rect.top >= viewportRect.top - 0.75 &&
    rect.bottom <= viewportRect.bottom + 0.75;
  const tailRange = () => {
    if (!full || !expected.tailText) return null;
    const text = full.textContent;
    const start = text.lastIndexOf(expected.tailText);
    if (start < 0) return null;
    const end = start + expected.tailText.length;
    const walker = document.createTreeWalker(full, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0;
    let foundStart = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const next = offset + node.textContent.length;
      if (!foundStart && start >= offset && start < next) {
        range.setStart(node, start - offset);
        foundStart = true;
      }
      if (foundStart && end <= next) {
        range.setEnd(node, end - offset);
        return range.getBoundingClientRect();
      }
      offset = next;
    }
    return null;
  };
  const links = [...(full?.querySelectorAll("a[href]") ?? [])];
  const visibleReferences = expected.references
    ? links.filter(
        (node) => node.getAttribute("href") === expected.references.visibleHref,
      )
    : [];
  const tailReferences = expected.references
    ? links.filter(
        (node) => node.getAttribute("href") === expected.references.tailHref,
      )
    : [];
  const skillBody = bubble?.querySelector(
    '[data-testid="message-user-skill-content"] .whitespace-pre-wrap',
  );
  const normalized = (text) =>
    String(text ?? "")
      .replace(/\s+/gu, " ")
      .trim();
  const renderedBody = normalized(full?.textContent);
  let renderedOffset = 0;
  const renderedFullTextPresent =
    !!full &&
    (expected.renderedTextParts === undefined
      ? renderedBody.includes(
          normalized(expected.renderedText ?? expected.text),
        )
      : Array.isArray(expected.renderedTextParts) &&
        expected.renderedTextParts.length > 0 &&
        expected.renderedTextParts.every((part) => {
          if (typeof part !== "string" || !normalized(part)) return false;
          const text = normalized(part);
          const start = renderedBody.indexOf(text, renderedOffset);
          if (start < 0) return false;
          renderedOffset = start + text.length;
          return true;
        }));
  return {
    electron: window.__LIME_ELECTRON__ === true,
    preload: typeof window.electronAPI?.invoke === "function",
    mountedUserCount: mountedUsers.length,
    itemMatchCount: mountedUsers.filter((node) => node.itemMatches).length,
    exactIdentityBubbleCount: mountedUsers.filter(
      (node) => node.itemMatches && node.turnMatches && node.layoutVisible,
    ).length,
    clientMatchCount: mountedUsers.filter((node) => node.clientMatches).length,
    mountedUsers,
    bubbleCount: bubbles.length,
    rootCount: roots.length,
    viewportCount: viewports.length,
    fullCount: fulls.length,
    toggleCount: toggles.length,
    footerCount: footers.length,
    copyCount: copies.length,
    role: bubble?.dataset.messageRole ?? null,
    messageId: bubble?.dataset.messageId ?? null,
    turnId: bubble?.dataset.runtimeTurnId ?? null,
    itemId: bubble?.dataset.threadItemId ?? null,
    groupTurnId: group?.dataset.runtimeTurnId ?? null,
    renderEntryKind: group?.dataset.renderEntryKind ?? null,
    directSegmentKind: bubble?.dataset.directSegmentKind ?? null,
    bodyKind: !bubble
      ? null
      : group?.dataset.renderEntryKind === "message_group" && skillBody
        ? "installed_skill_span"
        : "markdown",
    state: root?.dataset.userMessageContentState ?? null,
    ariaExpanded: toggle?.getAttribute("aria-expanded") === "true",
    ariaExpandedValue: toggle?.getAttribute("aria-expanded") ?? null,
    ariaControls: toggle?.getAttribute("aria-controls") ?? null,
    viewportId: viewport?.id ?? null,
    controlsMatch:
      !!viewport?.id && toggle?.getAttribute("aria-controls") === viewport.id,
    lineHeight,
    threshold: lineHeight === null ? null : 20 * lineHeight + 1,
    naturalHeight: fullRect?.height ?? null,
    viewportHeight: viewportRect?.height ?? null,
    overflowY: viewport ? getComputedStyle(viewport).overflowY : null,
    headPresent: full?.textContent.includes(expected.headText) ?? false,
    tailPresent: full?.textContent.includes(expected.tailText) ?? false,
    renderedFullTextPresent,
    renderedText: full?.textContent ?? null,
    tailInsideContentViewport: insideViewport(tailRange()),
    referenceCounts: {
      visible: visibleReferences.length,
      tail: tailReferences.length,
    },
    visibleReferenceInsideContentViewport:
      visibleReferences.length === 1 &&
      insideViewport(visibleReferences[0].getBoundingClientRect()),
    tailReferenceInsideContentViewport:
      tailReferences.length === 1 &&
      insideViewport(tailReferences[0].getBoundingClientRect()),
  };
}

function observeCollapseEventsDom({ expected, selectors }) {
  if (window.__limeUserMessageCollapseObserver)
    throw new Error("UserMessage collapse observer already exists");
  const events = [];
  const handler = (event) => {
    const toggle =
      event.target instanceof Element
        ? event.target.closest(selectors.toggle)
        : null;
    const bubble = toggle?.closest('[data-message-role="user"]');
    const identityMatches =
      bubble?.dataset.threadItemId === expected.itemId &&
      bubble?.dataset.runtimeTurnId === expected.turnId;
    if (event.type === "keydown" && event.key === "Tab") {
      events.push({ type: "keydown", key: "Tab", trusted: event.isTrusted });
      return;
    }
    if (!identityMatches) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    events.push({
      type: event.type,
      key: event.type === "keydown" ? event.key : null,
      trusted: event.isTrusted,
      focused: document.activeElement === toggle,
      identityMatches,
      detail: event.type === "click" ? event.detail : null,
    });
  };
  document.addEventListener("click", handler, true);
  document.addEventListener("keydown", handler, true);
  window.__limeUserMessageCollapseObserver = { handler, events };
}

function takeCollapseEventsDom() {
  const observer = window.__limeUserMessageCollapseObserver;
  if (!observer) return [];
  document.removeEventListener("click", observer.handler, true);
  document.removeEventListener("keydown", observer.handler, true);
  delete window.__limeUserMessageCollapseObserver;
  return observer.events;
}

export async function copyUserMessageFullText({
  page,
  copyButton,
  readClipboardText,
  writeClipboardText,
  expectedText,
  phase,
  timeoutMs = 30_000,
  ensureVisible = async () => undefined,
}) {
  if (
    typeof readClipboardText !== "function" ||
    typeof writeClipboardText !== "function" ||
    typeof page?.evaluate !== "function" ||
    typeof expectedText !== "string" ||
    expectedText.length === 0 ||
    (await copyButton.count()) !== 1
  )
    throw new Error("invalid exact UserMessage clipboard contract");
  const readText = async () => {
    const text = await readClipboardText();
    if (typeof text !== "string")
      throw new Error("real Electron clipboard readback did not return text");
    return text;
  };
  const originalClipboard = await readText();
  let failure;
  let actionFailed = false;
  let handle;
  let observation;
  let sentinel;
  let copied;
  let result;
  let buttonClicked = false;
  let sentinelObserved = false;
  const proof = () =>
    summarizeClipboardCopyProof({
      sentinelObserved,
      buttonClicked,
      fullTextMatched: copied === expectedText,
      textIdentity: collapseTextIdentity(copied),
      actualReadObserved: typeof copied === "string",
      actualEqualsExpected: copied === expectedText,
      actualEqualsSentinel: typeof copied === "string" && copied === sentinel,
      actualTextUtf16Length: typeof copied === "string" ? copied.length : null,
      clipboardWriteObservation: observation,
    });
  try {
    sentinel = `lime-user-message-collapse-${phase}-${Date.now()}`;
    if (sentinel === expectedText)
      throw new Error("clipboard sentinel collision");
    await writeClipboardText(sentinel);
    sentinelObserved = (await readText()) === sentinel;
    if (!sentinelObserved)
      throw new Error("real clipboard sentinel was not delivered");
    await ensureVisible(copyButton);
    handle = await startClipboardWriteObservation(page, expectedText);
    await copyButton.click();
    buttonClicked = true;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      copied = await readText();
      if (copied === expectedText) break;
      await delay(50);
    }
    result = proof();
    return result;
  } catch (error) {
    actionFailed = true;
    failure = error;
    throw error;
  } finally {
    let cleanupFailure;
    let observationCleanupFailed = false;
    let restoreFailed = false;
    if (handle) {
      try {
        observation = summarizeClipboardWriteObservation(
          await stopClipboardWriteObservation(page, handle),
          handle,
        );
        if (!observation.intervalComplete)
          throw new Error("passive clipboard observation is incomplete");
      } catch (error) {
        cleanupFailure = error;
        observationCleanupFailed = true;
      }
    }
    try {
      await writeClipboardText(originalClipboard);
      if ((await readText()) !== originalClipboard)
        throw new Error("real Electron clipboard restoration did not match");
    } catch (error) {
      cleanupFailure ??= error;
      restoreFailed = true;
    }
    if (result) Object.assign(result, proof());
    if (actionFailed || cleanupFailure) {
      const primary = actionFailed ? failure : cleanupFailure;
      try {
        Object.defineProperty(primary, "clipboardCopyEvidence", {
          value: proof(),
          configurable: true,
        });
        if (restoreFailed)
          Object.defineProperty(primary, "clipboardRestoreFailed", {
            value: true,
            configurable: true,
          });
        if (observationCleanupFailed)
          Object.defineProperty(primary, "clipboardObservationCleanupFailed", {
            value: true,
            configurable: true,
          });
      } catch {}
      if (!actionFailed) throw cleanupFailure;
    }
  }
}

export async function runUserMessageCollapseGate({
  page,
  options,
  expected,
  readClipboardText,
  writeClipboardText,
  traceCollector,
  copyButtonName = "复制消息",
  selectors: selectorOverrides = {},
}) {
  if (
    typeof readClipboardText !== "function" ||
    typeof writeClipboardText !== "function"
  )
    throw new Error(
      "UserMessage collapse Gate requires real Electron clipboard read/write callbacks",
    );
  const selectors = { ...SELECTORS, ...selectorOverrides };
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const argument = { expected, selectors, copyButtonName };
  const bubble = page
    .locator('[data-message-role="user"]:visible')
    .filter({ has: page.locator(selectors.root) });
  // Validate canonical IDs before interpolating them into an exact CSS query.
  for (const id of [expected.itemId, expected.turnId])
    if (typeof id !== "string" || !/^[A-Za-z0-9._:-]+$/.test(id))
      throw new Error(
        "invalid canonical identity for UserMessage collapse Gate",
      );
  const target = bubble.and(
    page.locator(
      `[data-thread-item-id="${expected.itemId}"][data-runtime-turn-id="${expected.turnId}"]`,
    ),
  );
  const toggle = target.locator(selectors.toggle);
  const copy = target
    .locator("xpath=..")
    .locator(selectors.footer)
    .getByRole("button", { name: copyButtonName, exact: true });
  let lastSnapshot;
  let requestedState;
  const snapshot = async () => {
    const value = await page.evaluate(readCollapseDom, argument);
    const renderedTextIdentity = collapseTextIdentity(value.renderedText);
    delete value.renderedText;
    lastSnapshot = { ...value, renderedTextIdentity };
    return lastSnapshot;
  };
  const stableSnapshot = async (state) => {
    requestedState = state;
    const startedAt = Date.now();
    let lastKey;
    let lastObserved;
    let stableSamples = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const observed = await snapshot();
      lastObserved = observed;
      const key = JSON.stringify([
        observed.state,
        observed.ariaExpanded,
        observed.lineHeight,
        observed.viewportHeight,
        observed.naturalHeight,
        observed.bubbleCount,
        observed.rootCount,
        observed.toggleCount,
      ]);
      if (
        observed.state === state &&
        observed.bubbleCount === 1 &&
        observed.rootCount === 1 &&
        observed.toggleCount === 1 &&
        [
          observed.lineHeight,
          observed.viewportHeight,
          observed.naturalHeight,
        ].every((value) => Number.isFinite(value) && value > 0)
      ) {
        stableSamples = key === lastKey ? stableSamples + 1 : 1;
        if (stableSamples >= 3) return observed;
      } else stableSamples = 0;
      lastKey = key;
      await delay(50);
    }
    const error = new Error(
      `UserMessage collapse geometry did not settle: ${state}`,
    );
    error.evidence = { requestedState: state, observed: lastObserved };
    throw error;
  };
  const wheelIntoView = async (locator) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if ((await locator.count()) !== 1)
        throw new Error("UserMessage action target is not unique");
      const rect = await locator.boundingBox();
      const scroller = await page.locator(selectors.scroll).boundingBox();
      const viewport = page.viewportSize();
      if (!rect || !scroller || !viewport)
        throw new Error("UserMessage action has no real viewport geometry");
      const top = Math.max(scroller.y, 0);
      const bottom = Math.min(scroller.y + scroller.height, viewport.height);
      if (rect.y >= top + 2 && rect.y + rect.height <= bottom - 2) return;
      await page.mouse.move(
        scroller.x + scroller.width / 2,
        (top + bottom) / 2,
      );
      const delta = Math.max(
        -600,
        Math.min(600, rect.y + rect.height / 2 - (top + bottom) / 2),
      );
      await page.mouse.wheel(0, delta);
      await delay(50);
    }
    throw new Error("real wheel did not expose UserMessage action");
  };
  const focusedToggle = () =>
    toggle.evaluate((node) => document.activeElement === node);
  const tabToToggle = async () => {
    for (let index = 0; index < 400; index += 1) {
      // Always make at least one real Tab transition, including when clicked.
      await page.keyboard.press("Shift+Tab");
      if (await focusedToggle()) return;
    }
    throw new Error("real Tab did not focus the exact UserMessage toggle");
  };
  const probeReferences = async () => {
    await tabToToggle();
    let visibleReferenceReached = false;
    let tailReferenceReached = false;
    for (let index = 0; index < 400; index += 1) {
      await page.keyboard.press("Tab");
      const focus = await target.evaluate(
        (node, { selectors, references }) => {
          const active = document.activeElement;
          const full = node.querySelector(selectors.full);
          const href =
            active instanceof Element && full?.contains(active)
              ? active.getAttribute("href")
              : null;
          return {
            toggle: active === node.querySelector(selectors.toggle),
            visible: href === references.visibleHref,
            tail: href === references.tailHref,
          };
        },
        { selectors, references: expected.references },
      );
      visibleReferenceReached ||= focus.visible;
      tailReferenceReached ||= focus.tail;
      if (focus.toggle)
        return {
          cycleComplete: true,
          visibleReferenceReached,
          tailReferenceReached,
        };
    }
    return {
      cycleComplete: false,
      visibleReferenceReached,
      tailReferenceReached,
    };
  };
  const trace = async () =>
    traceCollector
      ? captureContinuousTraceBoundary(
          await captureInvokeTraceCollector(page, traceCollector),
          traceCollector,
          parseJsonRpcRequestsFromInvokeTrace,
        )
      : captureCollapseTraceBoundary(
          await page.evaluate(() =>
            localStorage.getItem("lime_invoke_trace_buffer_v1"),
          ),
          parseJsonRpcRequestsFromInvokeTrace,
        );
  let observerInstalled = false;
  let gateFailed = false;
  let gateFailure;
  let stage = "canonical-read";
  let beforeRead;
  let traceBefore;
  const clipboard = {};
  const copyActionPhases = {};
  try {
    beforeRead = await appServerCallFromPage(page, "thread/read", {
      threadId: expected.threadId,
      includeTurns: true,
    });
    stage = "trace-baseline";
    traceBefore = await trace();
    if (!traceBefore.complete)
      throw new Error(
        "UserMessage collapse starting trace is incomplete or saturated",
      );
    await page.evaluate(observeCollapseEventsDom, argument);
    observerInstalled = true;
    stage = "initial-collapsed";
    const snapshots = [await stableSnapshot("collapsed")];
    const references =
      expected.references === undefined
        ? { status: "not-applicable" }
        : { status: "observed" };
    stage = "reference-collapsed";
    if (expected.references !== undefined)
      references.collapsed = await probeReferences();
    const copyFull = (phase) =>
      copyUserMessageFullText({
        page,
        copyButton: copy,
        readClipboardText,
        writeClipboardText,
        expectedText: expected.text,
        phase,
        timeoutMs,
        ensureVisible: async () => {
          copyActionPhases[phase] = await prepareCopyAction({
            bubble: target,
            copyButton: copy,
            expected,
            ensureVisible: wheelIntoView,
          });
        },
      });
    stage = "copy-collapsed";
    clipboard.collapsed = await copyFull("collapsed");
    stage = "pointer-expanded";
    await wheelIntoView(toggle);
    await toggle.click();
    snapshots.push(await stableSnapshot("expanded"));
    stage = "reference-expanded";
    if (expected.references !== undefined)
      references.expanded = await probeReferences();
    stage = "copy-expanded";
    clipboard.expanded = await copyFull("expanded");
    stage = "keyboard-collapsed";
    await tabToToggle();
    await page.keyboard.press("Enter");
    snapshots.push(await stableSnapshot("collapsed"));
    if (!(await focusedToggle()))
      throw new Error("Enter lost the exact toggle focus");
    stage = "keyboard-expanded";
    await page.keyboard.press("Space");
    snapshots.push(await stableSnapshot("expanded"));
    stage = "pointer-collapsed";
    await wheelIntoView(toggle);
    await toggle.click();
    snapshots.push(await stableSnapshot("collapsed"));
    const events = await page.evaluate(takeCollapseEventsDom);
    observerInstalled = false;
    stage = "canonical-read-final";
    const afterRead = await appServerCallFromPage(page, "thread/read", {
      threadId: expected.threadId,
      includeTurns: true,
    });
    stage = "oracle";
    const evidence = summarizeUserMessageCollapse({
      expected,
      snapshots,
      beforeRead,
      afterRead,
      traceBefore,
      traceAfter: await trace(),
      events,
      clipboard,
      references,
    });
    if (!evidence.ok) {
      const error = new Error("UserMessage collapse Gate failed");
      error.evidence = evidence;
      throw error;
    }
    return {
      ...evidence,
      snapshots,
      keyboardEvents: events,
      clipboard,
      references,
      copyActionPhases: summarizeCopyActionPhases(copyActionPhases),
    };
  } catch (error) {
    gateFailed = true;
    gateFailure = error;
    const observed = lastSnapshot;
    let currentObserved;
    let snapshotUnavailable = false;
    try {
      currentObserved = await snapshot();
    } catch {
      snapshotUnavailable = true;
    }
    try {
      Object.defineProperty(error, "userMessageCollapseEvidence", {
        value: summarizeUserMessageCollapseFailure({
          stage,
          requestedState,
          expected,
          beforeRead,
          traceBefore,
          observed,
          currentObserved,
          snapshotUnavailable,
          clipboard,
          clipboardCopyEvidence: extractClipboardCopyEvidence(error),
          copyActionPhases: summarizeCopyActionPhases(
            copyActionPhases,
            error,
            stage,
          ),
          collapseChecks: error.evidence,
        }),
        configurable: true,
      });
    } catch {
      // Diagnostics must never replace the original Gate failure.
    }
    throw error;
  } finally {
    if (observerInstalled) {
      try {
        await page.evaluate(takeCollapseEventsDom);
      } catch (error) {
        if (!gateFailed) throw error;
        try {
          Object.defineProperty(gateFailure, "collapseObserverCleanupFailed", {
            value: true,
            configurable: true,
          });
        } catch {}
      }
    }
  }
}

export async function runRichUserMessageCollapseGate({
  page,
  options,
  summary,
  readClipboardText,
  writeClipboardText,
  traceCollector,
  expectedText,
  renderedTextParts,
  renderedTailText,
  headText,
}) {
  const readModel = summary?.inputbarRichRestoreReadModelCanceled;
  const submission = readModel?.richInputSubmission;
  const expected = {
    threadId: summary?.threadId,
    turnId: summary?.inputbarRichRestoreBackendTurnStart?.turnId,
    itemId: submission?.itemId,
    clientId: submission?.clientUserMessageId,
    text: expectedText,
    renderedText: expectedText,
    renderedTextParts,
    renderedTailText,
    headText,
    requireAcceptedSubmission: true,
    renderEntryKind: "canonical_turn",
  };
  try {
    if (
      submission?.ok !== true ||
      readModel.includesCanceled !== true ||
      submission.threadId !== summary.threadId ||
      typeof expectedText !== "string"
    )
      throw new Error(
        "rich UserMessage collapse requires accepted canceled canonical evidence",
      );
    expected.tailText =
      typeof renderedTailText === "string" && renderedTailText.length > 0
        ? renderedTailText
        : expectedText.trimEnd().split(/\s+/u).at(-1);
    return await runUserMessageCollapseGate({
      page,
      options,
      readClipboardText,
      writeClipboardText,
      traceCollector,
      expected,
    });
  } catch (error) {
    let failure = extractUserMessageCollapseFailure(error);
    if (!failure) {
      failure = summarizeUserMessageCollapseFailure({
        stage: "rich-precondition",
        expected,
      });
      try {
        Object.defineProperty(error, "userMessageCollapseEvidence", {
          value: failure,
          configurable: true,
        });
      } catch {}
    }
    try {
      summary.inputbarRichRestoreUserMessageCollapseFailure = failure;
    } catch {
      // A summary writer cannot replace the original Gate failure.
    }
    throw error;
  }
}
