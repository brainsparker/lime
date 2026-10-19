import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { summarizeClipboardCopyProof } from "./claw-chat-current-fixture-user-message-collapse-clipboard-observation.mjs";
import { summarizeCopyActionPhases } from "./claw-chat-current-fixture-user-message-collapse-copy-action.mjs";
import {
  sameInvokeTraceCollectorProvenance,
  validateInvokeTraceCollectorCapture,
} from "../lib/invoke-trace-collector.mjs";

const INPUT_METHODS = new Set([
  "turn/start",
  "turn/steer",
  "thread/queue/add",
  "thread/queue/update",
  "thread/queue/delete",
  "thread/queue/reorder",
  "thread/queue/start",
]);
const CURRENT_COMMAND = "app_server_handle_json_lines";
const TRACE_LIMIT = 240;

export function collapseTextIdentity(text) {
  return typeof text === "string"
    ? {
        length: text.length,
        sha256: createHash("sha256").update(text).digest("hex"),
      }
    : null;
}

const FAILURE_STAGES = new Set([
  "canonical-read",
  "trace-baseline",
  "initial-collapsed",
  "reference-collapsed",
  "copy-collapsed",
  "pointer-expanded",
  "reference-expanded",
  "copy-expanded",
  "keyboard-collapsed",
  "keyboard-expanded",
  "pointer-collapsed",
  "canonical-read-final",
  "oracle",
  "rich-precondition",
]);
const safeId = (value) =>
  typeof value === "string" &&
  value.length <= 256 &&
  /^[A-Za-z0-9._:-]+$/.test(value)
    ? value
    : null;
const safeCount = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : null;
const safeNumber = (value) => (Number.isFinite(value) ? value : null);
const safeEnum = (value, choices) =>
  choices.includes(value) ? value : "unknown";
const safeTextIdentity = (value) =>
  safeCount(value?.length) !== null &&
  typeof value?.sha256 === "string" &&
  /^[a-f0-9]{64}$/.test(value.sha256)
    ? { length: value.length, sha256: value.sha256 }
    : null;
const safeRect = (value) =>
  value && typeof value === "object"
    ? Object.fromEntries(
        ["top", "left", "right", "bottom", "width", "height"].map((key) => [
          key,
          safeNumber(value[key]),
        ]),
      )
    : null;

function safeMountedUser(value = {}) {
  if (!value || typeof value !== "object") value = {};
  return {
    messageId: safeId(value.messageId),
    itemId: safeId(value.itemId),
    turnId: safeId(value.turnId),
    groupTurnId: safeId(value.groupTurnId),
    renderEntryKind: safeEnum(value.renderEntryKind, [
      "canonical_turn",
      "message_group",
    ]),
    directSegmentKind: safeEnum(value.directSegmentKind, ["message", "media"]),
    layoutVisible: value.layoutVisible === true,
    itemMatches: value.itemMatches === true,
    turnMatches: value.turnMatches === true,
    clientMatches: value.clientMatches === true,
    rootCount: safeCount(value.rootCount),
    state: safeEnum(value.state, ["collapsed", "expanded", "short"]),
    rect: safeRect(value.rect),
  };
}

function safeFailureDom(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    electron: value.electron === true,
    preload: value.preload === true,
    ...Object.fromEntries(
      [
        "bubbleCount",
        "rootCount",
        "viewportCount",
        "fullCount",
        "toggleCount",
        "footerCount",
        "copyCount",
        "mountedUserCount",
        "itemMatchCount",
        "exactIdentityBubbleCount",
        "clientMatchCount",
      ].map((key) => [key, safeCount(value[key])]),
    ),
    role: safeEnum(value.role, ["user"]),
    messageId: safeId(value.messageId),
    turnId: safeId(value.turnId),
    itemId: safeId(value.itemId),
    groupTurnId: safeId(value.groupTurnId),
    renderEntryKind: safeEnum(value.renderEntryKind, [
      "canonical_turn",
      "message_group",
    ]),
    directSegmentKind: safeEnum(value.directSegmentKind, ["message", "media"]),
    bodyKind: safeEnum(value.bodyKind, ["installed_skill_span", "markdown"]),
    state: safeEnum(value.state, ["collapsed", "expanded", "short"]),
    ariaExpanded: value.ariaExpanded === true,
    ariaExpandedValue: safeEnum(value.ariaExpandedValue, ["true", "false"]),
    ariaControls: safeId(value.ariaControls),
    viewportId: safeId(value.viewportId),
    controlsMatch: value.controlsMatch === true,
    ...Object.fromEntries(
      ["lineHeight", "threshold", "naturalHeight", "viewportHeight"].map(
        (key) => [key, safeNumber(value[key])],
      ),
    ),
    overflowY: safeEnum(value.overflowY, [
      "visible",
      "hidden",
      "clip",
      "auto",
      "scroll",
    ]),
    headPresent: value.headPresent === true,
    tailPresent: value.tailPresent === true,
    renderedFullTextPresent: value.renderedFullTextPresent === true,
    renderedTextIdentity: safeTextIdentity(value.renderedTextIdentity),
    tailInsideContentViewport: value.tailInsideContentViewport === true,
    mountedUsers: Array.isArray(value.mountedUsers)
      ? value.mountedUsers.map(safeMountedUser)
      : [],
  };
}

function safeClipboardPhases(facts) {
  const source = facts.clipboardPhases ?? facts.clipboard;
  const failedPhase = {
    "copy-collapsed": "collapsed",
    "copy-expanded": "expanded",
  }[facts.stage];
  return Object.fromEntries(
    ["collapsed", "expanded"].flatMap((phase) => {
      const value = summarizeClipboardCopyProof(
        phase === failedPhase && facts.clipboardCopyEvidence
          ? facts.clipboardCopyEvidence
          : source?.[phase],
      );
      return value ? [[phase, value]] : [];
    }),
  );
}

// Failure evidence is diagnostic only. Rebuild every nested object from an
// explicit allowlist; generic error.evidence and raw trace/body fields never pass.
export function summarizeUserMessageCollapseFailure(facts = {}) {
  const expected = facts.expected ?? {};
  const users = facts.beforeRead
    ? userItems(facts.beforeRead).map(({ turnId, item }) => ({
        turnId,
        itemId: item.id,
        clientId: item.clientId,
        contentPartCount: Array.isArray(item.content)
          ? item.content.length
          : null,
      }))
    : facts.canonical?.users;
  const trace = facts.traceBefore;
  const provenance = trace?.provenance ?? facts.trace ?? {};
  const clipboardPhases = safeClipboardPhases(facts);
  const copyActionPhases = summarizeCopyActionPhases(facts.copyActionPhases);
  return {
    schemaVersion: 1,
    scope: "user-message-collapse",
    stage: FAILURE_STAGES.has(facts.stage) ? facts.stage : "unknown",
    requestedState: safeEnum(facts.requestedState, ["collapsed", "expanded"]),
    expected: {
      threadId: safeId(expected.threadId),
      turnId: safeId(expected.turnId),
      itemId: safeId(expected.itemId),
      clientId: safeId(expected.clientId),
      renderEntryKind: safeEnum(expected.renderEntryKind, [
        "canonical_turn",
        "message_group",
      ]),
      textIdentity: safeTextIdentity(
        expected.textIdentity ?? collapseTextIdentity(expected.text),
      ),
    },
    canonical: {
      observed: facts.beforeRead
        ? observedRead(facts.beforeRead, expected)
        : facts.canonical?.observed === true,
      users: Array.isArray(users)
        ? users.map((value) => ({
            turnId: safeId(value?.turnId),
            itemId: safeId(value?.itemId),
            clientId: safeId(value?.clientId),
            contentPartCount: safeCount(value?.contentPartCount),
          }))
        : [],
    },
    observed: safeFailureDom(facts.observed),
    currentObserved: safeFailureDom(facts.currentObserved),
    snapshotUnavailable: facts.snapshotUnavailable === true,
    ...(facts.collapseChecks && typeof facts.collapseChecks === "object"
      ? {
          checks: Object.fromEntries(
            [
              "expectationValid",
              "exactVisibleEntry",
              "measuredTwentyLineThreshold",
              "realVisualTransitions",
              "completeRenderedBodyRetained",
              "trustedPointerAndKeyboard",
              "collapsedClipboardFullText",
              "expandedClipboardFullText",
              "canonicalFullText",
              "canonicalPartsUnchanged",
              "completeInputBoundary",
              "noAdditionalInput",
              "referencesScoped",
            ].map((name) => [name, facts.collapseChecks[name] === true]),
          ),
        }
      : {}),
    ...(Object.keys(clipboardPhases).length ? { clipboardPhases } : {}),
    ...(Object.keys(copyActionPhases).length ? { copyActionPhases } : {}),
    trace: {
      mode: safeEnum(provenance.mode, ["continuous-storage-append", "ring"]),
      runId: safeId(provenance.runId),
      startedAt:
        typeof provenance.startedAt === "string" &&
        Number.isFinite(Date.parse(provenance.startedAt))
          ? new Date(provenance.startedAt).toISOString()
          : null,
      appendCount: safeCount(provenance.appendCount),
      ringCount: safeCount(provenance.currentRingCount ?? provenance.ringCount),
      complete: (trace?.complete ?? facts.trace?.complete) === true,
      currentIpcOnly:
        (trace?.currentIpcOnly ?? facts.trace?.currentIpcOnly) === true,
      inputCount: safeCount(trace?.inputs?.length ?? facts.trace?.inputCount),
      errorCount: safeCount(trace?.errorCount ?? facts.trace?.errorCount),
    },
  };
}

export function extractUserMessageCollapseFailure(error) {
  try {
    if (!error || !Object.hasOwn(error, "userMessageCollapseEvidence"))
      return null;
    const evidence = error.userMessageCollapseEvidence;
    if (
      !evidence ||
      typeof evidence !== "object" ||
      Array.isArray(evidence) ||
      evidence.schemaVersion !== 1 ||
      evidence.scope !== "user-message-collapse"
    )
      return null;
    return summarizeUserMessageCollapseFailure({
      ...evidence,
      collapseChecks: evidence.checks,
    });
  } catch {
    return null;
  }
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// The current transport parser is injected by the GUI helper. Validate its
// complete source first: a missing, saturated or malformed trace is no proof.
export function captureCollapseTraceBoundary(raw, parseRequests) {
  try {
    const entries = JSON.parse(raw);
    if (
      !Array.isArray(entries) ||
      entries.length === 0 ||
      entries.length >= TRACE_LIMIT ||
      typeof parseRequests !== "function"
    )
      throw new Error("incomplete trace");
    return captureTraceEntries(entries, parseRequests);
  } catch {
    return { complete: false, entryDigests: [], inputs: [] };
  }
}

function captureTraceEntries(entries, parseRequests) {
  const expectedRequests = [];
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.timestamp !== "string" ||
      typeof entry.command !== "string" ||
      typeof entry.transport !== "string" ||
      !["success", "error"].includes(entry.status) ||
      !Number.isFinite(entry.duration_ms)
    )
      throw new Error("invalid trace entry");
    if (entry.command !== CURRENT_COMMAND) continue;
    const lines = entry.args_preview?.request?.lines;
    if (!Array.isArray(lines) || lines.length === 0)
      throw new Error("missing request lines");
    for (const line of lines) {
      if (typeof line !== "string") throw new Error("invalid request line");
      const request = JSON.parse(line);
      // The current protocol emits { id, method, params } without a version
      // field. An explicitly supplied version must still identify 2.0.
      if (
        !request ||
        typeof request !== "object" ||
        Array.isArray(request) ||
        (Object.hasOwn(request, "jsonrpc") && request.jsonrpc !== "2.0") ||
        !Object.hasOwn(request, "id") ||
        !(
          (typeof request.id === "string" && request.id.length > 0) ||
          Number.isSafeInteger(request.id)
        ) ||
        typeof request.method !== "string" ||
        request.method.trim().length === 0
      )
        throw new Error("invalid JSON-RPC request");
      expectedRequests.push({
        command: entry.command,
        transport: entry.transport,
        status: entry.status,
        durationMs: entry.duration_ms,
        id: request.id,
        method: request.method,
        params: request.params ?? {},
      });
    }
  }
  const requests = parseRequests(JSON.stringify(entries));
  if (
    !Array.isArray(requests) ||
    !isDeepStrictEqual(requests, expectedRequests)
  )
    throw new Error("partial transport parse");
  return {
    complete: true,
    entryDigests: entries.map(digest),
    currentIpcOnly: entries
      .filter((entry) => entry.command === CURRENT_COMMAND)
      .every((entry) => entry.transport === "electron-ipc"),
    errorCount: entries.filter((entry) => entry.status === "error").length,
    inputs: requests
      .filter((request) => INPUT_METHODS.has(request.method))
      .map((request) => ({
        method: request.method,
        id: request.id,
        threadId: request.params?.threadId ?? null,
        clientId: request.params?.clientUserMessageId ?? null,
        digest: digest(request),
      })),
  };
}

export function captureContinuousTraceBoundary(capture, handle, parseRequests) {
  const observed = validateInvokeTraceCollectorCapture(capture, handle);
  if (!observed.complete || typeof parseRequests !== "function")
    return { complete: false, entryDigests: [], inputs: [], provenance: null };
  try {
    return {
      ...captureTraceEntries(observed.ledgerEntries, parseRequests),
      provenance: observed.provenance,
    };
  } catch {
    return {
      complete: false,
      entryDigests: [],
      inputs: [],
      provenance: observed.provenance,
    };
  }
}

function sameBoundaryProvenance(before, after) {
  if (before.provenance === undefined && after.provenance === undefined)
    return true;
  return sameInvokeTraceCollectorProvenance(
    before.provenance,
    after.provenance,
  );
}

function userItems(read) {
  return (read?.result?.thread?.turns ?? []).flatMap((turn) =>
    (turn.items ?? [])
      .filter((item) => item.type === "userMessage")
      .map((item) => ({ turnId: turn.id, item })),
  );
}

function expectedUser(read, expected) {
  return userItems(read).filter(
    ({ turnId, item }) =>
      turnId === expected.turnId && item.id === expected.itemId,
  );
}

function observedRead(read, expected) {
  const observation = read?.ipcObservation;
  return (
    observation?.electron === true &&
    observation.fallback === false &&
    observation.command === CURRENT_COMMAND &&
    observation.transport === "electron-ipc" &&
    observation.status === "success" &&
    observation.method === "thread/read" &&
    observation.params?.threadId === expected.threadId &&
    observation.params?.includeTurns === true &&
    typeof observation.requestId === "string" &&
    observation.requestId.length > 0 &&
    observation.responseId === observation.requestId &&
    read?.result?.thread?.id === expected.threadId &&
    Array.isArray(read.result.thread.turns) &&
    read.result.thread.turns.every(
      (turn) =>
        turn &&
        typeof turn.id === "string" &&
        turn.id.length > 0 &&
        Array.isArray(turn.items) &&
        turn.items.every(
          (item) =>
            item &&
            typeof item.type === "string" &&
            typeof item.id === "string" &&
            item.id.length > 0,
        ),
    )
  );
}

function validGeometry(snapshot) {
  return (
    [
      snapshot?.lineHeight,
      snapshot?.naturalHeight,
      snapshot?.viewportHeight,
    ].every((value) => Number.isFinite(value) && value > 0) &&
    Math.abs(snapshot.threshold - (20 * snapshot.lineHeight + 1)) < 0.01
  );
}

export function summarizeUserMessageCanonicalPreservation({
  expected,
  beforeRead,
  afterRead,
}) {
  const reads = [beforeRead, afterRead];
  const readsObserved = reads.every((read) => observedRead(read, expected));
  const beforeUsers = readsObserved ? expectedUser(beforeRead, expected) : [];
  const afterUsers = readsObserved ? expectedUser(afterRead, expected) : [];
  const beforeItem = beforeUsers[0]?.item;
  const afterItem = afterUsers[0]?.item;
  const text = Array.isArray(beforeItem?.content)
    ? beforeItem.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
    : null;
  return {
    readsObserved,
    canonicalIdentity:
      beforeUsers.length === 1 &&
      afterUsers.length === 1 &&
      beforeItem?.clientId === expected.clientId &&
      afterItem?.clientId === expected.clientId &&
      reads.every(
        (read) =>
          userItems(read).filter(({ item }) => item.id === expected.itemId)
            .length === 1 &&
          userItems(read).filter(
            ({ item }) => item.clientId === expected.clientId,
          ).length === 1,
      ),
    canonicalFullText: typeof text === "string" && text === expected.text,
    canonicalPartsUnchanged:
      Array.isArray(beforeItem?.content) &&
      beforeItem.content.length > 0 &&
      isDeepStrictEqual(beforeItem.content, afterItem?.content) &&
      (expected.contentParts === undefined ||
        isDeepStrictEqual(beforeItem.content, expected.contentParts)),
    canonicalTextElementsUnchanged:
      Array.isArray(beforeItem?.content) &&
      isDeepStrictEqual(
        beforeItem.content.filter((part) => part.type === "text"),
        afterItem?.content?.filter((part) => part.type === "text"),
      ),
    canonicalUserItemsAndTurnsUnchanged:
      readsObserved &&
      isDeepStrictEqual(userItems(beforeRead), userItems(afterRead)) &&
      isDeepStrictEqual(
        beforeRead.result.thread.turns.map((turn) => turn.id),
        afterRead.result.thread.turns.map((turn) => turn.id),
      ),
  };
}

export function summarizeCollapseInputBoundary({
  traceBefore,
  traceAfter,
  expected = {},
}) {
  const baseline = traceBefore ?? {};
  const final = traceAfter ?? {};
  return {
    completeInputBoundary:
      baseline.complete === true &&
      final.complete === true &&
      sameBoundaryProvenance(baseline, final) &&
      baseline.currentIpcOnly === true &&
      final.currentIpcOnly === true &&
      baseline.errorCount === 0 &&
      final.errorCount === 0 &&
      final.entryDigests?.length >= baseline.entryDigests?.length &&
      isDeepStrictEqual(
        baseline.entryDigests,
        final.entryDigests?.slice(0, baseline.entryDigests.length),
      ),
    noAdditionalInput:
      baseline.complete === true &&
      final.complete === true &&
      sameBoundaryProvenance(baseline, final) &&
      isDeepStrictEqual(baseline.inputs, final.inputs),
    acceptedSubmissionBoundary:
      expected.requireAcceptedSubmission !== true ||
      baseline.inputs?.some(
        (input) =>
          input.method === "turn/start" &&
          input.threadId === expected.threadId &&
          input.clientId === expected.clientId,
      ) === true,
  };
}

export function summarizeUserMessageCollapse(facts = {}) {
  const expected = facts.expected ?? {};
  const snapshots = facts.snapshots ?? [];
  const initial = snapshots[0] ?? {};
  const entryKind = initial.renderEntryKind;
  const phases = [
    "collapsed",
    "expanded",
    "collapsed",
    "expanded",
    "collapsed",
  ];
  const reads = [facts.beforeRead, facts.afterRead];
  const readsObserved = reads.every((read) => observedRead(read, expected));
  const beforeUsers = readsObserved ? expectedUser(reads[0], expected) : [];
  const beforeItem = beforeUsers[0]?.item;
  const baseline = facts.traceBefore ?? {};
  const final = facts.traceAfter ?? {};
  const events = facts.events ?? [];
  const clicks = events.filter((event) => event.type === "click");
  const keys = events.filter(
    (event) => event.type === "keydown" && event.key !== "Tab",
  );
  const checks = {
    expectationValid:
      [
        expected.threadId,
        expected.turnId,
        expected.itemId,
        expected.clientId,
        expected.text,
        expected.headText,
        expected.tailText,
      ].every((value) => typeof value === "string" && value.length > 0) &&
      expected.text?.includes(expected.headText) === true &&
      (expected.text?.trimEnd().endsWith(expected.tailText) === true ||
        (typeof expected.renderedTailText === "string" &&
          expected.renderedTailText.length > 0 &&
          expected.tailText === expected.renderedTailText)),
    ...summarizeUserMessageCanonicalPreservation({
      expected,
      beforeRead: facts.beforeRead,
      afterRead: facts.afterRead,
    }),
    exactVisibleEntry:
      snapshots.length === phases.length &&
      ["canonical_turn", "message_group"].includes(entryKind) &&
      (expected.renderEntryKind === undefined ||
        entryKind === expected.renderEntryKind) &&
      snapshots.every(
        (snapshot) =>
          snapshot.electron === true &&
          snapshot.preload === true &&
          snapshot.bubbleCount === 1 &&
          snapshot.rootCount === 1 &&
          snapshot.viewportCount === 1 &&
          snapshot.fullCount === 1 &&
          snapshot.toggleCount === 1 &&
          snapshot.footerCount === 1 &&
          snapshot.copyCount === 1 &&
          snapshot.role === "user" &&
          snapshot.turnId === expected.turnId &&
          snapshot.groupTurnId === expected.turnId &&
          snapshot.itemId === expected.itemId &&
          snapshot.renderEntryKind === entryKind &&
          (entryKind !== "canonical_turn" ||
            snapshot.directSegmentKind === "message"),
      ),
    measuredTwentyLineThreshold:
      snapshots.length === phases.length &&
      snapshots.every(validGeometry) &&
      snapshots.every(
        (snapshot) => snapshot.naturalHeight > snapshot.threshold,
      ),
    realVisualTransitions:
      snapshots.length === phases.length &&
      snapshots.every((snapshot, index) => {
        if (
          snapshot.state !== phases[index] ||
          snapshot.ariaExpanded !== (phases[index] === "expanded") ||
          !snapshot.controlsMatch
        )
          return false;
        if (phases[index] === "collapsed")
          return (
            ["hidden", "clip"].includes(snapshot.overflowY) &&
            snapshot.viewportHeight <= snapshot.threshold + 0.75 &&
            snapshot.naturalHeight > snapshot.viewportHeight &&
            snapshot.tailInsideContentViewport === false
          );
        return (
          snapshot.viewportHeight >= snapshot.naturalHeight - 0.75 &&
          snapshot.tailInsideContentViewport === true
        );
      }),
    completeRenderedBodyRetained:
      initial.headPresent === true &&
      initial.tailPresent === true &&
      !!initial.renderedTextIdentity &&
      snapshots.every(
        (snapshot) =>
          snapshot.headPresent === true &&
          snapshot.tailPresent === true &&
          snapshot.renderedFullTextPresent === true &&
          isDeepStrictEqual(
            snapshot.renderedTextIdentity,
            initial.renderedTextIdentity,
          ),
      ),
    trustedPointerAndKeyboard:
      clicks.length === 4 &&
      clicks.every(
        (event) => event.trusted === true && event.identityMatches === true,
      ) &&
      clicks.filter((event) => event.detail > 0).length === 2 &&
      clicks.filter((event) => event.detail === 0).length === 2 &&
      keys.length === 2 &&
      isDeepStrictEqual(
        keys.map((event) => event.key),
        ["Enter", " "],
      ) &&
      keys.every(
        (event) =>
          event.trusted === true &&
          event.focused === true &&
          event.identityMatches === true,
      ) &&
      events.some(
        (event) =>
          event.type === "keydown" &&
          event.key === "Tab" &&
          event.trusted === true,
      ),
    collapsedClipboardFullText:
      facts.clipboard?.collapsed?.sentinelObserved === true &&
      facts.clipboard.collapsed.buttonClicked === true &&
      facts.clipboard.collapsed.fullTextMatched === true &&
      isDeepStrictEqual(
        facts.clipboard.collapsed.textIdentity,
        collapseTextIdentity(expected.text),
      ),
    expandedClipboardFullText:
      facts.clipboard?.expanded?.sentinelObserved === true &&
      facts.clipboard.expanded.buttonClicked === true &&
      facts.clipboard.expanded.fullTextMatched === true &&
      isDeepStrictEqual(
        facts.clipboard.expanded.textIdentity,
        collapseTextIdentity(expected.text),
      ),
    ...summarizeCollapseInputBoundary({
      traceBefore: baseline,
      traceAfter: final,
      expected,
    }),
    referencesScoped:
      expected.references === undefined
        ? facts.references?.status === "not-applicable"
        : initial.bodyKind !== "installed_skill_span" &&
          facts.references?.status === "observed" &&
          facts.references.collapsed?.cycleComplete === true &&
          facts.references.collapsed.visibleReferenceReached === true &&
          facts.references.collapsed.tailReferenceReached === false &&
          facts.references.expanded?.cycleComplete === true &&
          facts.references.expanded.visibleReferenceReached === true &&
          facts.references.expanded.tailReferenceReached === true &&
          initial.referenceCounts?.visible === 1 &&
          initial.referenceCounts?.tail === 1 &&
          initial.visibleReferenceInsideContentViewport === true &&
          initial.tailReferenceInsideContentViewport === false,
  };
  return {
    ok: Object.values(checks).every((value) => value === true),
    ...checks,
    threadId: expected.threadId ?? null,
    turnId: expected.turnId ?? null,
    itemId: expected.itemId ?? null,
    clientId: expected.clientId ?? null,
    renderEntryKind: entryKind ?? "unknown",
    bodyKind: initial.bodyKind ?? "unknown",
    fullTextIdentity: collapseTextIdentity(expected.text),
    canonicalPartCount: beforeItem?.content?.length ?? 0,
    inputRequestCountBefore: baseline.inputs?.length ?? null,
    inputRequestCountAfter: final.inputs?.length ?? null,
    referenceEvidence:
      expected.references === undefined ? "not-applicable" : "HTTP-links-only",
    traceProvenance: {
      mode: baseline.provenance?.mode ?? "ring",
      runId: baseline.provenance?.runId ?? null,
      startedAt: baseline.provenance?.startedAt ?? null,
      baselineAppendCount: baseline.provenance?.appendCount ?? null,
      finalAppendCount: final.provenance?.appendCount ?? null,
      baselineRingCount: baseline.provenance?.currentRingCount ?? null,
      finalRingCount: final.provenance?.currentRingCount ?? null,
      sameContinuousInterval:
        baseline.provenance !== undefined &&
        sameBoundaryProvenance(baseline, final),
    },
    claimBoundary:
      "Real Electron current UserMessage display/copy/readback only. No virtualizer anchor, dedicated Skill/plugin/app consumer, packaged-app or screen-reader claim.",
  };
}

export function buildUserMessageCollapseAssertions(summary) {
  const evidence = summary?.inputbarRichRestoreUserMessageCollapse;
  return {
    inputbarRichRestoreUserMessageCollapse:
      evidence?.ok === true &&
      evidence.exactVisibleEntry === true &&
      evidence.canonicalFullText === true &&
      evidence.canonicalPartsUnchanged === true &&
      evidence.completeInputBoundary === true &&
      evidence.noAdditionalInput === true &&
      evidence.collapsedClipboardFullText === true &&
      evidence.expandedClipboardFullText === true &&
      evidence.realVisualTransitions === true &&
      evidence.trustedPointerAndKeyboard === true,
  };
}
