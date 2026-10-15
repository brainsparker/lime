import test from "node:test";
import assert from "node:assert/strict";
import {
  assertEmptyHomeCanonicalInventory,
  assertHomeColdHydration,
  assertHomeDraftDiscovery,
  assertHomeDraftSurface,
  assertHomeDraftTrace,
  assertHomeIndexUnchanged,
  assertHomeSavedBytesUnchanged,
  assertHomeSavedEntry,
  assertHomeSavedFiles,
} from "./composer-home-draft-fixture-evidence.mjs";
import {
  atomKey,
  assertRestartLifecycle,
} from "./composer-draft-fixture-evidence.mjs";

const scope = {
  workspaceId: null,
  kind: "home",
  id: "new-conversation",
};
const probe = "首页唯一公开探针";
const entry = {
  state: "draft",
  draftId: "actual-home-draft",
  scopeVersion: "opaque-version-a",
  originScopeKey: JSON.stringify([scope.workspaceId, scope.kind, scope.id]),
  updatedAt: 123,
  draft: {
    format: "composer-draft",
    version: 1,
    document: {
      text: probe,
      editorDocument: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: probe }] },
        ],
      },
      selectionStart: 1,
      selectionEnd: 4,
      attachments: [{ mediaType: "image/png", data: "durable-png" }],
      pendingPastes: [{ text: "full private paste" }],
      pathReferences: [{ path: "/isolated/file.md", isDir: false }],
    },
  },
};
const clone = (value) => structuredClone(value);
function surface() {
  return {
    electron: true,
    preload: true,
    homeButtonCount: 1,
    editorCount: 1,
    sessionId: null,
    editorText: probe,
    disabled: false,
  };
}
function index() {
  return {
    key: atomKey,
    outcome: "ready",
    storeRevision: 7,
    persistence: { state: "saved", savedRevision: 7 },
    data: {
      queryKind: "workspace-index",
      workspaceId: scope.workspaceId,
      items: [
        {
          scope,
          identity: {
            draftId: entry.draftId,
            scopeVersion: entry.scopeVersion,
          },
          updatedAt: entry.updatedAt,
        },
      ],
    },
  };
}
function scopeRead() {
  return {
    key: atomKey,
    outcome: "ready",
    storeRevision: 7,
    persistence: { state: "saved", savedRevision: 7 },
    data: { queryKind: "scope", view: { scope, entry } },
  };
}
function discovery() {
  return clone({
    index: index(),
    scopeRead: scopeRead(),
    workspaceId: scope.workspaceId,
    probe,
    surface: surface(),
  });
}
function trace() {
  return {
    atomOperations: [],
    appServerRequestMethods: ["workspace/default/ensure", "thread/list"],
    appServerInvokeCount: 2,
    provenance: {
      mode: "continuous-storage-append",
      runId: "real-native-observer",
    },
  };
}
function hydration() {
  return {
    beforeRevision: 7,
    indexBeforeRevision: 7,
    indexAfterRevision: 7,
    restoredRevision: 7,
    trace: trace(),
  };
}
function envelope() {
  return clone({
    storeRevision: 7,
    atoms: {
      [atomKey]: {
        bindings: { [entry.originScopeKey]: entry.draftId },
        entries: { [entry.draftId]: entry },
      },
    },
  });
}
function files() {
  return ["host-state.json", "host-state.json.bak"].map((name) => ({
    path: `/isolated/${name}`,
    sha256: "a".repeat(64),
    storeRevision: 7,
    validatedBy: "persistedAtomRecords.parseEnvelope",
    entryEvidence: assertHomeSavedEntry(envelope(), scope, entry),
  }));
}

test("public Home keeps explicit null scope instead of the ensured default workspace", () => {
  const value = discovery();
  assert.equal(assertHomeDraftDiscovery(value).scope.workspaceId, null);
  value.workspaceId = "default-real-workspace";
  assert.throws(() => assertHomeDraftDiscovery(value));
});

test("public GUI probe is associated with actual current home scope and native identity", () => {
  assert.equal(assertHomeDraftDiscovery(discovery()).draftId, entry.draftId);
  assert.deepEqual(assertHomeDraftSurface(surface()), {
    editorCount: 1,
    sessionId: null,
    homeButtonCount: 1,
  });
});

for (const [name, mutate] of [
  [
    "browser mirror",
    (v) => {
      v.surface.electron = false;
    },
  ],
  [
    "missing preload",
    (v) => {
      v.surface.preload = false;
    },
  ],
  [
    "duplicate Home buttons",
    (v) => {
      v.surface.homeButtonCount = 2;
    },
  ],
  [
    "duplicate editors",
    (v) => {
      v.surface.editorCount = 2;
    },
  ],
  [
    "disabled editor",
    (v) => {
      v.surface.disabled = true;
    },
  ],
  [
    "materialized editor",
    (v) => {
      v.surface.sessionId = "canonical-session";
    },
  ],
  [
    "foreign visible probe",
    (v) => {
      v.surface.editorText = "other";
    },
  ],
  [
    "ambiguous index",
    (v) => {
      v.index.data.items.push(clone(v.index.data.items[0]));
    },
  ],
  [
    "random draftTab scope",
    (v) => {
      v.index.data.items[0].scope.kind = "draft";
      v.index.data.items[0].scope.id = "task-draft-other";
    },
  ],
  [
    "foreign workspace",
    (v) => {
      v.workspaceId = "other-default";
    },
  ],
  [
    "index and payload identity mismatch",
    (v) => {
      v.index.data.items[0].identity.draftId = "other";
    },
  ],
  [
    "different index revision",
    (v) => {
      v.index.storeRevision = 6;
    },
  ],
  [
    "unsaved index",
    (v) => {
      v.index.persistence.state = "pending";
    },
  ],
  [
    "unacknowledged index",
    (v) => {
      v.index.persistence.savedRevision = 6;
    },
  ],
  [
    "materialized index metadata",
    (v) => {
      v.index.data.items[0].sessionId = "new-session";
    },
  ],
  [
    "materialized scope entry",
    (v) => {
      v.scopeRead.data.view.entry.threadId = "new-thread";
    },
  ],
  [
    "different saved probe",
    (v) => {
      v.scopeRead.data.view.entry.draft.document.text = "other";
    },
  ],
]) {
  test(`discovery rejects ${name}`, () => {
    const value = discovery();
    mutate(value);
    assert.throws(() => assertHomeDraftDiscovery(value));
  });
}

test("same-atom home index survives reads with exact metadata", () => {
  assert.equal(
    assertHomeIndexUnchanged(index(), clone(index()), scope, entry)
      .storeRevision,
    7,
  );
  for (const mutate of [
    (v) => {
      v.storeRevision = 8;
      v.persistence.savedRevision = 8;
    },
    (v) => {
      v.data.items[0].updatedAt = 124;
    },
    (v) => {
      v.data.items[0].identity.scopeVersion = "new-version";
    },
    (v) => {
      v.data.items = [];
    },
  ]) {
    const value = clone(index());
    mutate(value);
    assert.throws(() => assertHomeIndexUnchanged(index(), value, scope, entry));
  }
});

test("empty canonical inventory proves no thread or Turn and complete pagination", () => {
  assert.equal(
    assertEmptyHomeCanonicalInventory({ data: [], nextCursor: null }).turnCount,
    0,
  );
  for (const result of [
    { data: [] },
    { data: [], nextCursor: "more" },
    { data: [{ id: "new-thread", turns: [] }], nextCursor: null },
    { items: [], nextCursor: null },
  ])
    assert.throws(() => assertEmptyHomeCanonicalInventory(result));
});

test("cold restoration requires unchanged revision, native trace and no atom mutation", () => {
  assert.equal(assertHomeColdHydration(hydration()).atomOperationCount, 0);
  for (const field of [
    "beforeRevision",
    "indexBeforeRevision",
    "indexAfterRevision",
    "restoredRevision",
  ]) {
    const value = hydration();
    value[field] += 1;
    assert.throws(() => assertHomeColdHydration(value));
  }
});

for (const method of [
  "thread/start",
  "turn/start",
  "turn/steer",
  "thread/queue/add",
  "thread/queue/update",
  "thread/queue/start",
]) {
  test(`home cold trace rejects ${method}`, () => {
    const value = trace();
    value.appServerRequestMethods.push(method);
    assert.throws(() => assertHomeDraftTrace(value));
  });
}

test("native edit put is required and cannot substitute for mutation-free cold restore", () => {
  const value = trace();
  assert.throws(() => assertHomeDraftTrace(value, true));
  value.atomOperations.push({
    op: "put",
    status: "success",
    transport: "electron-ipc",
  });
  assert.equal(assertHomeDraftTrace(value, true).atomOperationCount, 1);
  assert.throws(() => assertHomeDraftTrace(value));
  value.atomOperations[0].transport = "mock";
  assert.throws(() => assertHomeDraftTrace(value, true));
});

test("GUI trace accepts native reads without the direct-preload workspace helper", () => {
  const value = trace();
  value.appServerRequestMethods = ["workspace/ensureReady", "thread/list"];
  assert.equal(assertHomeDraftTrace(value).atomOperationCount, 0);
  value.atomOperations.push({
    op: "put",
    status: "success",
    transport: "electron-ipc",
  });
  assert.equal(assertHomeDraftTrace(value, true).atomOperationCount, 1);
});

test("incomplete trace or absent current App Server read cannot pass", () => {
  for (const mutate of [
    (v) => {
      delete v.atomOperations;
    },
    (v) => {
      v.appServerRequestMethods = ["workspace/default/ensure"];
    },
    (v) => {
      v.appServerInvokeCount = 0;
    },
    (v) => {
      v.provenance.mode = "ring-buffer";
    },
    (v) => {
      v.provenance.runId = "";
    },
  ]) {
    const value = trace();
    mutate(value);
    assert.throws(() => assertHomeDraftTrace(value));
  }
});

test("actual parsed saved envelope preserves full PM JSON, selection and resources", () => {
  assert.equal(
    assertHomeSavedEntry(envelope(), scope, entry).scopeVersion,
    entry.scopeVersion,
  );
  for (const mutate of [
    (v) => {
      v.atoms[atomKey].entries[
        entry.draftId
      ].draft.document.editorDocument.content = [];
    },
    (v) => {
      v.atoms[atomKey].entries[entry.draftId].draft.document.selectionStart = 0;
    },
    (v) => {
      v.atoms[atomKey].entries[
        entry.draftId
      ].draft.document.attachments[0].data = "truncated";
    },
    (v) => {
      v.atoms[atomKey].entries[entry.draftId].draft.document.pendingPastes = [];
    },
    (v) => {
      v.atoms[atomKey].entries[
        entry.draftId
      ].draft.document.pathReferences[0].path = "/foreign.md";
    },
    (v) => {
      v.atoms[atomKey].bindings.other = entry.draftId;
    },
    (v) => {
      v.atoms[atomKey].bindings = {};
    },
    (v) => {
      v.atoms[atomKey].entries[entry.draftId].state = "consumed";
    },
  ]) {
    const value = envelope();
    mutate(value);
    assert.throws(() => assertHomeSavedEntry(value, scope, entry));
  }
});

test("both native parsed files need exact entry evidence and unchanged raw bytes", () => {
  const before = files();
  assert.equal(assertHomeSavedFiles(before, scope, entry, 7).length, 2);
  assert.equal(
    assertHomeSavedBytesUnchanged(before, clone(before)).files.length,
    2,
  );
  for (const mutate of [
    (v) => {
      v[1].validatedBy = "fixture-parser";
    },
    (v) => {
      delete v[1].entryEvidence;
    },
    (v) => {
      v[1].entryEvidence.scope.workspaceId = "foreign";
    },
    (v) => {
      v[1].entryEvidence.payloadSha256 = "changed";
    },
    (v) => {
      v[1].sha256 = "b".repeat(64);
    },
    (v) => {
      v[1].path = v[0].path;
    },
  ]) {
    const value = clone(before);
    mutate(value);
    assert.throws(() => assertHomeSavedFiles(value, scope, entry, 7));
    assert.throws(() => assertHomeSavedBytesUnchanged(before, value));
  }
});

test("two generations need distinct real Main PIDs and the same normally exited profile", () => {
  const entries = [1, 2].map((generation) => ({
    generation,
    pid: generation + 100,
    profile: "/isolated/profile",
    mode: "normal",
    exitCode: 0,
    signal: null,
    exited: true,
  }));
  assertRestartLifecycle(entries, "/isolated/profile", 2);
  for (const mutate of [
    (v) => {
      v[1].pid = v[0].pid;
    },
    (v) => {
      v[1].profile = "/other/profile";
    },
    (v) => {
      v[1].signal = "SIGKILL";
    },
    (v) => {
      v[1].exited = false;
    },
  ]) {
    const value = clone(entries);
    mutate(value);
    assert.throws(() => assertRestartLifecycle(value, "/isolated/profile", 2));
  }
});
