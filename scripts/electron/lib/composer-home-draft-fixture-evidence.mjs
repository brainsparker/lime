import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  atomKey,
  assertWorkspaceIndex,
  requireDraftProof,
  savedDraft,
  sha256,
} from "./composer-draft-fixture-evidence.mjs";

const inputMethods = new Set([
  "thread/start",
  "turn/start",
  "turn/steer",
  "thread/queue/add",
  "thread/queue/update",
  "thread/queue/start",
]);

/** Only public visible DOM; no router, React, Controller or PM state. */
export function readHomeDraftSurfaceDom() {
  const visible = (element) =>
    element instanceof HTMLElement &&
    element.isConnected &&
    element.getClientRects().length > 0 &&
    window.getComputedStyle(element).display !== "none" &&
    !["hidden", "collapse"].includes(
      window.getComputedStyle(element).visibility,
    );
  const editors = Array.from(
    document.querySelectorAll(
      '[data-testid="composer-editor"][role="textbox"]',
    ),
  ).filter(visible);
  const editor = editors.length === 1 ? editors[0] : null;
  return {
    electron: window.__LIME_ELECTRON__ === true,
    preload: typeof window.electronAPI?.invoke === "function",
    homeButtonCount: Array.from(
      document.querySelectorAll('[data-testid="app-sidebar-home-button"]'),
    ).filter(visible).length,
    editorCount: editors.length,
    sessionId: editor?.dataset.sessionId ?? null,
    editorText: editor?.textContent ?? null,
    disabled:
      !editor ||
      editor.getAttribute("aria-disabled") === "true" ||
      editor.getAttribute("contenteditable") !== "true",
  };
}

export function assertHomeDraftSurface(snapshot) {
  requireDraftProof(
    snapshot?.electron === true &&
      snapshot.preload === true &&
      snapshot.homeButtonCount === 1 &&
      snapshot.editorCount === 1 &&
      snapshot.sessionId === null &&
      snapshot.disabled === false &&
      typeof snapshot.editorText === "string",
    "public Home has one real unmaterialized editable Composer",
  );
  return { editorCount: 1, sessionId: null, homeButtonCount: 1 };
}

function assertHomeScope(scope, workspaceId) {
  requireDraftProof(
    (workspaceId === null ||
      (typeof workspaceId === "string" && workspaceId.trim().length > 0)) &&
      isDeepStrictEqual(scope, {
        workspaceId,
        kind: "home",
        id: "new-conversation",
      }),
    "actual saved scope exactly matches the public Home workspace, including null",
  );
}

function assertIndex(index, workspaceId, scope, entry) {
  assertHomeScope(scope, workspaceId);
  assertWorkspaceIndex(index, workspaceId, scope, entry);
  requireDraftProof(
    Number.isSafeInteger(index.storeRevision) &&
      index.storeRevision >= 0 &&
      index.persistence?.state === "saved" &&
      index.persistence.savedRevision >= index.storeRevision &&
      typeof index.data.items[0].updatedAt === "number" &&
      Number.isSafeInteger(index.data.items[0].updatedAt) &&
      index.data.items[0].updatedAt >= 0 &&
      index.data.items[0].sessionId == null &&
      index.data.items[0].threadId == null,
    "saved home index is unmaterialized metadata with acknowledged revision",
  );
}

/** Scope comes from the native index after a unique public GUI edit. */
export function assertHomeDraftDiscovery({
  index,
  scopeRead,
  workspaceId,
  probe,
  surface,
}) {
  assertHomeDraftSurface(surface);
  requireDraftProof(
    typeof probe === "string" &&
      probe.length > 0 &&
      surface.editorText === probe &&
      index?.data?.items?.length === 1,
    "one actual native index item corresponds to the unique visible probe",
  );
  const scope = index.data.items[0].scope;
  assertHomeScope(scope, workspaceId);
  const entry = savedDraft(scopeRead, scope);
  assertIndex(index, workspaceId, scope, entry);
  requireDraftProof(
    scopeRead.storeRevision === index.storeRevision &&
      entry.sessionId == null &&
      entry.threadId == null &&
      entry.draft?.format === "composer-draft" &&
      entry.draft.version === 1 &&
      entry.draft.document?.text?.trim() === probe,
    "native home scope payload and index identity match public probe exactly",
  );
  return {
    scope,
    draftId: entry.draftId,
    scopeVersion: entry.scopeVersion,
    storeRevision: index.storeRevision,
    payloadSha256: sha256(entry.draft),
  };
}

export function assertHomeIndexUnchanged(before, after, scope, original) {
  assertIndex(before, scope.workspaceId, scope, original);
  assertIndex(after, scope.workspaceId, scope, original);
  requireDraftProof(
    before.storeRevision === after.storeRevision &&
      isDeepStrictEqual(before.data.items, after.data.items),
    "home index reads preserve exact scope, identity, metadata and revision",
  );
  return {
    scope,
    storeRevision: after.storeRevision,
    itemsSha256: sha256(after.data.items),
  };
}

export function assertEmptyHomeCanonicalInventory(result) {
  requireDraftProof(
    Array.isArray(result?.data) &&
      result.data.length === 0 &&
      Object.hasOwn(result, "nextCursor") &&
      result.nextCursor === null,
    "complete public thread/list inventory remains empty before submission",
  );
  return { threadCount: 0, turnCount: 0, paginationComplete: true };
}

export function assertHomeDraftTrace(trace, editing = false) {
  // This ledger observes GUI safeInvoke diagnostics. The workspace helper uses
  // preload directly; its returned identity is checked separately by the scenario.
  requireDraftProof(
    Array.isArray(trace?.atomOperations) &&
      trace.atomOperations.every(
        (operation) =>
          operation.transport === "electron-ipc" &&
          operation.status === "success",
      ) &&
      (editing
        ? trace.atomOperations.some((operation) => operation.op === "put")
        : trace.atomOperations.length === 0) &&
      Array.isArray(trace.appServerRequestMethods) &&
      trace.appServerRequestMethods.includes("thread/list") &&
      trace.appServerRequestMethods.every(
        (method) => typeof method === "string" && !inputMethods.has(method),
      ) &&
      Number.isSafeInteger(trace.appServerInvokeCount) &&
      trace.appServerInvokeCount > 0 &&
      trace.provenance?.mode === "continuous-storage-append" &&
      typeof trace.provenance.runId === "string" &&
      trace.provenance.runId.length > 0,
    editing
      ? "real GUI owns native home put without canonical materialization or input"
      : "cold Home and native index reads perform no atom update or input request",
  );
  return {
    atomOperationCount: trace.atomOperations.length,
    inputRequestCount: 0,
    traceProvenance: trace.provenance,
  };
}

export function assertHomeColdHydration({
  beforeRevision,
  indexBeforeRevision,
  indexAfterRevision,
  restoredRevision,
  trace,
}) {
  requireDraftProof(
    Number.isSafeInteger(beforeRevision) &&
      beforeRevision >= 0 &&
      indexBeforeRevision === beforeRevision &&
      indexAfterRevision === beforeRevision &&
      restoredRevision === beforeRevision,
    "cold Home reads and rich restoration retain original global revision",
  );
  return {
    storeRevision: beforeRevision,
    ...assertHomeDraftTrace(trace),
  };
}

/** Main owner already parsed actual bytes and enforced the native file budget. */
export function assertHomeSavedEntry(envelope, scope, original) {
  assertHomeScope(scope, scope?.workspaceId);
  const atom = envelope?.atoms?.[atomKey];
  const bindings = Object.entries(atom?.bindings ?? {}).filter(
    ([, id]) => id === original?.draftId,
  );
  requireDraftProof(
    Number.isSafeInteger(envelope?.storeRevision) &&
      envelope.storeRevision >= 0 &&
      original?.state === "draft" &&
      original.sessionId == null &&
      original.threadId == null &&
      bindings.length === 1 &&
      bindings[0][0] ===
        JSON.stringify([scope.workspaceId, scope.kind, scope.id]) &&
      isDeepStrictEqual(atom.entries?.[original.draftId], original),
    "actual saved bytes retain exact unmaterialized home entry and one binding",
  );
  return {
    draftId: original.draftId,
    scopeVersion: original.scopeVersion,
    storeRevision: envelope.storeRevision,
    scope,
    payloadSha256: sha256(original.draft),
  };
}

export function assertHomeSavedFiles(receipts, scope, original, revision) {
  const names = ["host-state.json", "host-state.json.bak"];
  requireDraftProof(
    Array.isArray(receipts) &&
      receipts.length === names.length &&
      receipts.every(
        (receipt, index) =>
          typeof receipt.path === "string" &&
          path.basename(receipt.path) === names[index] &&
          /^[a-f0-9]{64}$/.test(receipt.sha256 ?? "") &&
          receipt.validatedBy === "persistedAtomRecords.parseEnvelope" &&
          receipt.storeRevision === revision &&
          receipt.entryEvidence?.storeRevision === revision &&
          receipt.entryEvidence.draftId === original.draftId &&
          receipt.entryEvidence.scopeVersion === original.scopeVersion &&
          isDeepStrictEqual(receipt.entryEvidence.scope, scope) &&
          receipt.entryEvidence.payloadSha256 === sha256(original.draft),
      ) &&
      receipts[0].sha256 === receipts[1].sha256,
    "both real parsed primary and backup files ran the full home-entry callback",
  );
  return receipts;
}

export function assertHomeSavedBytesUnchanged(before, after) {
  requireDraftProof(
    Array.isArray(before) &&
      before.length === 2 &&
      isDeepStrictEqual(after, before),
    "cold Home, index reads and normal quits preserve exact saved file receipts",
  );
  return {
    files: after.map(({ sha256, storeRevision }) => ({
      sha256,
      storeRevision,
    })),
  };
}
