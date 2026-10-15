import test from "node:test";
import assert from "node:assert/strict";
import {
  assertFirstSendConsumed,
  assertFirstSendNewEdit,
  assertFirstSendReceipt,
  assertFirstSendSavedFiles,
  assertFirstSendScopeObservation,
  assertFirstSendSource,
  assertFirstSendRouteCoverage,
  assertFirstSendTrace,
  assertUnboundScope,
  capturedIdentity,
  newEditText,
} from "./composer-first-send-evidence.mjs";

function sourceInput(route) {
  const project = route === "project-new";
  const scope = {
    workspaceId: project ? "workspace-a" : null,
    kind: "home",
    id: "new-conversation",
  };
  const baseline = { id: "bootstrap-thread", sessionId: "bootstrap-session" };
  const entry = {
    state: "draft",
    draftId: "captured-draft",
    scopeVersion: "z-opaque-original",
    originScopeKey: JSON.stringify([scope.workspaceId, scope.kind, scope.id]),
    draft: { document: { text: "独立的提交正文" } },
  };
  const metadata = {
    key: "composer-drafts-v1",
    outcome: "ready",
    storeRevision: 8,
    persistence: { state: "saved", savedRevision: 8 },
  };
  return {
    scope,
    workspaceId: scope.workspaceId,
    entry,
    expectedMarker: "独立的提交正文",
    workspaceIndex: {
      ...structuredClone(metadata),
      data: {
        queryKind: "workspace-index",
        workspaceId: scope.workspaceId,
        items: [
          {
            scope: structuredClone(scope),
            identity: {
              draftId: entry.draftId,
              scopeVersion: entry.scopeVersion,
            },
            updatedAt: 123,
          },
        ],
      },
    },
    scopeRead: {
      ...structuredClone(metadata),
      data: {
        queryKind: "scope",
        view: {
          scope: structuredClone(scope),
          entry: structuredClone(entry),
        },
      },
    },
    dom: {
      electron: true,
      preload: true,
      editorCount: 1,
      text: "独立的提交正文",
      sessionId: null,
      disabled: false,
      emptyState: true,
    },
    beforeThreads: [baseline],
    preparedThreads: [baseline],
  };
}

const fragments = [
  "独立首发请求",
  "隐藏源一行\n隐藏源二行",
  "const value = '中😀';",
];
function receiptThread(source) {
  return {
    id: "accepted-new-thread",
    sessionId: "accepted-new-session",
    turns: [
      {
        id: "accepted-turn",
        status: "inProgress",
        items: [
          {
            id: "canonical-user-item",
            type: "userMessage",
            content: [{ type: "text", text: fragments.join("\n") }],
          },
        ],
      },
    ],
  };
}

function accepted(route = "search-new") {
  const input = sourceInput(route);
  const source = assertFirstSendSource(route, input);
  const receipt = assertFirstSendReceipt(
    receiptThread(source),
    source,
    fragments,
  );
  return { input, source, receipt };
}

function consumedEnvelope(source, receipt) {
  return {
    storeRevision: 13,
    atoms: {
      "composer-drafts-v1": {
        bindings: {},
        entries: {
          [source.identity.draftId]: {
            ...source.identity,
            originScopeKey: source.originScopeKey,
            sessionId: receipt.sessionId,
            threadId: receipt.threadId,
            state: "consumed",
            consumption: "accepted",
          },
        },
      },
    },
  };
}

for (const route of ["home", "search-new", "project-new"]) {
  test(
    "accepts actual native " +
      route +
      " source and its canonical first receipt",
    () => {
      const { source, receipt } = accepted(route);
      assert.equal(source.route, route);
      assert.equal(source.identity.scopeVersion, "z-opaque-original");
      assert.equal(receipt.canonicalAccepted, true);
      assert.match(receipt.userItemSha256, /^[a-f0-9]{64}$/);
      assert.equal(JSON.stringify(receipt).includes(fragments[1]), false);
    },
  );
}

test("never classifies an existing local send or foreign visible Composer as first submission", () => {
  for (const mutate of [
    (value) => {
      value.scope.kind = "local";
    },
    (value) => {
      value.dom.sessionId = "already-local";
    },
    (value) => {
      value.dom.editorCount = 2;
    },
    (value) => {
      value.dom.preload = false;
    },
    (value) => {
      value.dom.electron = false;
    },
    (value) => {
      value.dom.disabled = true;
    },
    (value) => {
      value.scope.workspaceId = "foreign-workspace";
    },
    (value) => {
      value.entry.sessionId = "promoted-before-send";
    },
  ]) {
    const input = sourceInput("search-new");
    mutate(input);
    assert.throws(() => assertFirstSendSource("search-new", input));
  }
});

test("Home requires the exact native Home scope and its visible empty surface", () => {
  const input = sourceInput("home");
  input.scope.id = "another-home-scope";
  assert.throws(() => assertFirstSendSource("home", input));
  input.scope.id = "new-conversation";
  input.dom.emptyState = false;
  assert.throws(() => assertFirstSendSource("home", input));
});

test("public index and payload prove the stable Home scope without top tabs", () => {
  const input = sourceInput("search-new");
  input.workspaceIndex.data.items.push({
    scope: { workspaceId: null, kind: "local", id: "earlier-session" },
    identity: { draftId: "earlier-edit", scopeVersion: "earlier-version" },
    sessionId: "earlier-session",
    updatedAt: 122,
  });
  const proof = assertFirstSendSource("search-new", input);
  assert.equal(proof.nativeScopeObservation.logicalDraftScopeOnly, true);
  assert.equal(proof.nativeScopeObservation.visibleTabIdentityVerified, false);
  assert.equal(proof.sourceScope.id, "new-conversation");
});

test("native scope lookup fails closed for ambiguity, wrong workspace, identity, revision or payload", () => {
  for (const mutate of [
    (value) => {
      value.workspaceIndex.key = "other-atom";
    },
    (value) => {
      value.workspaceIndex.outcome = "unavailable";
    },
    (value) => {
      value.workspaceIndex.data.queryKind = "scope";
    },
    (value) => {
      value.workspaceIndex.data.workspaceId = "foreign";
    },
    (value) => {
      value.workspaceIndex.data.items = [];
    },
    (value) => {
      value.workspaceIndex.data.items.push(
        structuredClone(value.workspaceIndex.data.items[0]),
      );
    },
    (value) => {
      value.workspaceIndex.data.items[0].scope.workspaceId = "foreign";
    },
    (value) => {
      value.workspaceIndex.data.items[0].scope.kind = "local";
    },
    (value) => {
      value.workspaceIndex.data.items[0].scope.id = "";
    },
    (value) => {
      value.workspaceIndex.data.items[0].sessionId = "already-promoted";
    },
    (value) => {
      value.workspaceIndex.data.items[0].threadId = "already-promoted";
    },
    (value) => {
      value.workspaceIndex.data.items[0].identity.scopeVersion =
        "other-version";
    },
    (value) => {
      value.scopeRead.key = "other-atom";
    },
    (value) => {
      value.scopeRead.outcome = "invalid";
    },
    (value) => {
      value.scopeRead.data.queryKind = "workspace-index";
    },
    (value) => {
      value.scopeRead.data.view.scope.id = "foreign-scope";
    },
    (value) => {
      value.scopeRead.data.view.entry = null;
    },
    (value) => {
      value.scopeRead.persistence.state = "pending";
    },
    (value) => {
      value.scopeRead.persistence.savedRevision = 7;
    },
    (value) => {
      value.workspaceIndex.persistence.state = "pending";
    },
    (value) => {
      value.workspaceIndex.persistence.savedRevision = 7;
    },
    (value) => {
      value.workspaceIndex.storeRevision = 7;
      value.workspaceIndex.persistence.savedRevision = 7;
    },
    (value) => {
      value.scopeRead.data.view.entry.originScopeKey = "foreign-origin";
    },
    (value) => {
      value.scopeRead.data.view.entry.sessionId = "already-promoted";
    },
    (value) => {
      value.scopeRead.data.view.entry.threadId = "already-promoted";
    },
    (value) => {
      value.scopeRead.data.view.entry.draft.document.text = "foreign-payload";
    },
    (value) => {
      value.dom.text = "foreign-visible-input";
    },
    (value) => {
      value.expectedMarker = "";
    },
    (value) => {
      value.workspaceId = "foreign-project";
    },
  ]) {
    const input = sourceInput("search-new");
    mutate(input);
    assert.throws(() => assertFirstSendScopeObservation("search-new", input));
    assert.throws(() => assertFirstSendSource("search-new", input));
  }
});

test("captured rich source cannot diverge from the current saved scope payload", () => {
  const input = sourceInput("search-new");
  input.entry.draft.document.text += " stale captured payload";
  assert.throws(() => assertFirstSendSource("search-new", input));
});

test("each public entry rejects canonical sessions created by input before Send", () => {
  for (const route of ["home", "search-new", "project-new"]) {
    const input = sourceInput(route);
    input.preparedThreads.push({
      id: "unexpected-thread",
      sessionId: "unexpected-session",
    });
    assert.throws(() => assertFirstSendSource(route, input));
  }
});

test("identity version is opaque text, not numeric or ordered", () => {
  for (const version of [1, "", "   ", null, undefined]) {
    assert.throws(() =>
      capturedIdentity({
        state: "draft",
        draftId: "draft",
        scopeVersion: version,
      }),
    );
  }
  const { source, receipt } = accepted();
  const entry = {
    state: "draft",
    draftId: source.identity.draftId,
    scopeVersion: "a-opaque-next",
    sessionId: receipt.sessionId,
    draft: { document: { text: newEditText } },
  };
  assert.equal(
    assertFirstSendNewEdit(entry, source, receipt).newEditPreserved,
    true,
  );
});

test("preexisting local or preexisting canonical thread cannot provide the first-send receipt", () => {
  for (const route of ["home", "search-new", "project-new"]) {
    const { source } = accepted(route);
    for (const mutate of [
      (thread) => {
        thread.id = "bootstrap-thread";
      },
      (thread) => {
        thread.sessionId = "bootstrap-session";
      },
      (thread) => {
        thread.turns.push({ id: "second-turn" });
      },
      (thread) => {
        thread.turns[0].status = "completed";
      },
      (thread) => {
        thread.turns[0].items[0].id = "";
      },
      (thread) => {
        thread.turns[0].items[0].content = [
          { type: "text", text: fragments[0] },
        ];
      },
    ]) {
      const thread = receiptThread(source);
      mutate(thread);
      assert.throws(() => assertFirstSendReceipt(thread, source, fragments));
    }
  }
});

test("scope read proves saved unbinding rather than exposing a consumed entry", () => {
  const { source } = accepted();
  const result = {
    key: "composer-drafts-v1",
    outcome: "ready",
    storeRevision: 13,
    persistence: { state: "saved", savedRevision: 13 },
    data: {
      queryKind: "scope",
      view: { scope: source.sourceScope, entry: null },
    },
  };
  assert.equal(assertUnboundScope(result, source.sourceScope).unbound, true);
  for (const mutate of [
    (value) => {
      value.data.view.entry = { state: "consumed" };
    },
    (value) => {
      value.data.view.scope.id = "another-scope";
    },
    (value) => {
      value.persistence.state = "pending";
    },
    (value) => {
      value.persistence.savedRevision = 12;
    },
  ]) {
    const changed = structuredClone(result);
    mutate(changed);
    assert.throws(() => assertUnboundScope(changed, source.sourceScope));
  }
});

test("saved tombstone preserves exact original identity and accepted local metadata", () => {
  const { source, receipt } = accepted();
  const envelope = consumedEnvelope(source, receipt);
  const proof = assertFirstSendConsumed(envelope, source, receipt);
  assert.equal(proof.sameCapturedIdentity, true);
  assert.equal(proof.sessionId, receipt.sessionId);
  assert.equal(proof.threadId, receipt.threadId);
  assert.equal(proof.noRemainingBinding, true);
  for (const mutate of [
    (entry) => {
      entry.scopeVersion = "another-version";
    },
    (entry) => {
      entry.draftId = "another-draft";
    },
    (entry) => {
      entry.sessionId = "another-session";
    },
    (entry) => {
      entry.threadId = "another-thread";
    },
    (entry) => {
      entry.originScopeKey = "another-origin";
    },
    (entry) => {
      entry.consumption = "clear";
    },
    (entry) => {
      entry.state = "draft";
    },
    (entry) => {
      entry.draft = { document: { text: "must-be-absent" } };
    },
  ]) {
    const changed = structuredClone(envelope);
    mutate(
      changed.atoms["composer-drafts-v1"].entries[source.identity.draftId],
    );
    assert.throws(() => assertFirstSendConsumed(changed, source, receipt));
  }
  envelope.atoms["composer-drafts-v1"].bindings.oldScope =
    source.identity.draftId;
  assert.throws(() => assertFirstSendConsumed(envelope, source, receipt));
});

test("new edit cannot reuse the consumed identity or silently replace current text", () => {
  const { source, receipt } = accepted();
  const entry = {
    state: "draft",
    draftId: "genuine-new-draft",
    scopeVersion: "independent-version",
    sessionId: receipt.sessionId,
    draft: { document: { text: newEditText } },
  };
  assert.equal(
    assertFirstSendNewEdit(entry, source, receipt).newEditPreserved,
    true,
  );
  for (const mutate of [
    (value) => {
      Object.assign(value, source.identity);
    },
    (value) => {
      value.draft.document.text = "restored old submitted text";
    },
    (value) => {
      value.sessionId = "foreign-session";
    },
  ]) {
    const changed = structuredClone(entry);
    mutate(changed);
    assert.throws(() => assertFirstSendNewEdit(changed, source, receipt));
  }
});

test("an old driver that ignores the disk callback cannot satisfy saved identity evidence", () => {
  const expected = {
    draftId: "actual-draft",
    scopeVersion: "opaque-version",
    sameCapturedIdentity: true,
    sessionId: "actual-session",
    threadId: "actual-thread",
  };
  const files = [0, 1].map(() => ({ entryEvidence: { ...expected } }));
  assert.doesNotThrow(() => assertFirstSendSavedFiles(files, expected));
  for (const mutate of [
    (value) => {
      value.pop();
    },
    (value) => {
      delete value[0].entryEvidence;
    },
    (value) => {
      value[1].entryEvidence.scopeVersion = "different";
    },
    (value) => {
      value[1].entryEvidence.sameCapturedIdentity = false;
    },
    (value) => {
      value[1].entryEvidence.threadId = "different";
    },
  ]) {
    const changed = structuredClone(files);
    mutate(changed);
    assert.throws(() => assertFirstSendSavedFiles(changed, expected));
  }
});

test("native production promotion precedes one consume and a later edit put", () => {
  const trace = {
    appServerInvokeCount: 5,
    atomOperations: ["put", "promote", "consume", "put"].map((op) => ({
      op,
      status: "success",
      transport: "electron-ipc",
    })),
  };
  assert.deepEqual(assertFirstSendTrace(trace), {
    promotionIndex: 1,
    consumeIndex: 2,
    productionPromotionBeforeConsume: true,
    newEditPutAfterConsume: true,
  });
  for (const mutate of [
    (value) => {
      value.atomOperations.reverse();
    },
    (value) => {
      value.atomOperations.pop();
    },
    (value) => {
      value.atomOperations.push({ ...value.atomOperations[2] });
    },
    (value) => {
      value.atomOperations[1].transport = "browser-mirror";
    },
    (value) => {
      value.atomOperations[2].status = "error";
    },
    (value) => {
      value.appServerInvokeCount = 0;
    },
  ]) {
    const changed = structuredClone(trace);
    mutate(changed);
    assert.throws(() => assertFirstSendTrace(changed));
  }
});

test("aggregate coverage accepts shared stable Home scopes and independent canonical receipts", () => {
  const proofs = ["home", "search-new", "project-new"].map((route, index) => ({
    route,
    workspaceId: index === 2 ? "workspace-a" : null,
    source: {
      sourceScope: {
        kind: "home",
        id: "new-conversation",
        workspaceId: index === 2 ? "workspace-a" : null,
      },
    },
    receipt: { sessionId: "session-" + index, threadId: "thread-" + index },
  }));
  assert.equal(assertFirstSendRouteCoverage(proofs), true);
  for (const edit of [
    (value) => value.pop(),
    (value) => {
      value[1].route = "materialized-draft";
    },
    (value) => {
      value[1].source.sourceScope.kind = "draft";
    },
    (value) => {
      value[0].source.sourceScope.workspaceId = "inherited";
    },
    (value) => {
      value[2].source.sourceScope.workspaceId = null;
    },
    (value) => {
      value[1].receipt.sessionId = value[0].receipt.sessionId;
    },
    (value) => {
      value[1].receipt.threadId = value[0].receipt.threadId;
    },
  ]) {
    const bad = structuredClone(proofs);
    edit(bad);
    assert.throws(() => assertFirstSendRouteCoverage(bad));
  }
});
