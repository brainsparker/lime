import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parsePersistedAtomReadRequest,
  parsePersistedAtomReadResult,
  parsePersistedAtomUpdateEvent,
  parsePersistedAtomUpdateResult,
} from "@/lib/api/persistedAtomProtocol";
import {
  observePersistedAtomCommand,
  runPersistedAtomFixture,
} from "./persisted-atom-fixture.mjs";

const protocol = {
  parseReadRequest: parsePersistedAtomReadRequest,
  parseReadResult: parsePersistedAtomReadResult,
  parseUpdateResult: parsePersistedAtomUpdateResult,
  parseUpdateEvent: parsePersistedAtomUpdateEvent,
};
const atomKey = "composer-drafts-v1";
const eventName = "persisted-atom-update";
const runId = "unit-test";
const appDataRoot = "/isolated/unit-test";
const sha = "a".repeat(64);
const home = {
  workspaceId: `fixture-${runId}`,
  kind: "home",
  id: "new-conversation",
};
const local = {
  workspaceId: `fixture-${runId}`,
  kind: "local",
  id: `session-${runId}`,
};
const token = (suffix, version) => ({
  draftId: `draft-${runId}-${suffix}`,
  scopeVersion: `version-${suffix}-${version}`,
});
const a1 = token("a", 1),
  a2 = token("a", 2),
  b1 = token("b", 1),
  c1 = token("c", 1),
  d1 = token("d", 1),
  e1 = token("e", 1),
  f1 = token("f", 1);
const draftScope = { ...home, kind: "draft", id: `draft-tab-${runId}` };
const otherScope = { ...draftScope, workspaceId: `other-${runId}` };
const nullScope = { ...home, workspaceId: null };
const firstDraft = {
  document: { type: "doc", content: [] },
  text: "fixture 中😀",
};
const finalDraft = {
  document: {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language: "typescript" },
        content: [{ type: "text", text: "const n = 1;" }],
      },
    ],
  },
  text: "const n = 1;",
  selection: { from: 2, to: 4 },
  annotations: [{ kind: "fixture", label: "中😀" }],
  images: [{ source: "fixture-only.png", unavailable: true }],
};
const entry = (identity, draft, metadata = {}) => {
  const origin = [b1.draftId, c1.draftId].includes(identity.draftId)
    ? local
    : home;
  return {
    ...identity,
    originScopeKey: JSON.stringify([
      origin.workspaceId,
      origin.kind,
      origin.id,
    ]),
    updatedAt: 100,
    state: "draft",
    draft,
    ...(origin.kind === "local" ? { sessionId: origin.id } : {}),
    ...metadata,
  };
};
const retired = (identity, consumption = "accepted") => ({
  ...identity,
  originScopeKey: JSON.stringify([home.workspaceId, home.kind, home.id]),
  updatedAt: 100,
  state: "consumed",
  consumption,
  consumedAt: 100,
});
const meta = (revision, state = "pending") => ({
  key: atomKey,
  storeRevision: revision,
  persistence: { state, savedRevision: state === "saved" ? revision : 0 },
});
const read = (scope, entry, revision, state) => ({
  ...meta(revision, state),
  outcome: "ready",
  data: { queryKind: "scope", view: { scope, entry } },
});
const indexRead = (workspaceId, rows, revision, state) => ({
  ...meta(revision, state),
  outcome: "ready",
  data: {
    queryKind: "workspace-index",
    workspaceId,
    items: rows.map(([scope, identity]) => ({
      scope,
      identity,
      updatedAt: 100,
      ...(scope.kind === "local" ? { sessionId: scope.id } : {}),
    })),
  },
});
const scopedEntry = (scope, identity, draft) =>
  entry(identity, draft, {
    originScopeKey: JSON.stringify([scope.workspaceId, scope.kind, scope.id]),
  });
const update = (
  entry,
  revision,
  outcome = "applied",
  changed = true,
  reason,
) => ({
  ...meta(revision),
  outcome,
  changed,
  ...(reason ? { reason } : {}),
  entry,
});
const event = (revision) => ({ ...meta(revision), event: eventName });
const envelope = (revision) => ({ event: eventName, payload: event(revision) });
const observation = (result) => ({
  result,
  events: result.changed ? [envelope(result.storeRevision)] : [],
  transport: "electron-ipc",
});

const fileReceipts = () =>
  Object.fromEntries(
    ["primary", "backup"].map((kind) => [
      kind,
      {
        path: path.join(
          appDataRoot,
          kind === "primary" ? "host-state.json" : "host-state.json.bak",
        ),
        validatedBy: "persistedAtomRecords.parseEnvelope",
        storeRevision: 10,
        sha256: sha,
      },
    ]),
  );

function scriptedDriver({
  mutate,
  firstIdentity,
  secondIdentity,
  exitReceipt,
  files,
  neverSaved = false,
  loadingReads = 0,
} = {}) {
  const promoted = entry(a2, finalDraft, {
    sessionId: local.id,
    threadId: `thread-${runId}`,
  });
  const steps = [
    ["read", read(home, null, 0, "saved")],
    ["index", indexRead(home.workspaceId, [], 0, "saved")],
    ["put", update(entry(a1, firstDraft), 1)],
    ["read", read(home, entry(a1, firstDraft), 1)],
    ["index", indexRead(home.workspaceId, [[home, a1]], 1)],
    ["put", update(entry(a2, finalDraft), 2)],
    [
      "put",
      update(entry(a2, finalDraft), 2, "conflict", false, "version_conflict"),
    ],
    ["put", update(entry(b1, firstDraft), 3)],
    [
      "index",
      indexRead(
        home.workspaceId,
        [
          [home, a2],
          [local, b1],
        ],
        3,
      ),
    ],
    [
      "promote",
      update(entry(a2, finalDraft), 3, "conflict", false, "target_conflict"),
    ],
    ["read", read(home, entry(a2, finalDraft), 3)],
    ["read", read(local, entry(b1, firstDraft), 3)],
    ["clear", update(retired(b1, "clear"), 4)],
    ["promote", update(promoted, 5)],
    ["read", read(home, null, 5)],
    ["read", read(local, promoted, 5)],
    ["consume", update(promoted, 5, "conflict", false, "version_conflict")],
    ["read", read(local, promoted, 5)],
    ["consume", update(retired(a2), 6)],
    ["read", read(local, null, 6)],
    ["index", indexRead(home.workspaceId, [], 6)],
    ["put", update(retired(a2), 6, "conflict", false, "retired_draft")],
    ["put", update(entry(c1, finalDraft), 7)],
    ["consume", update(retired(a2), 7, "applied", false)],
    ["read", read(local, entry(c1, finalDraft), 7)],
    ["put", update(scopedEntry(draftScope, d1, firstDraft), 8)],
    ["put", update(scopedEntry(otherScope, e1, firstDraft), 9)],
    ["put", update(scopedEntry(nullScope, f1, firstDraft), 10)],
    ["read", read(local, entry(c1, finalDraft), 10, "saved")],
    [
      "index",
      indexRead(
        home.workspaceId,
        [
          [local, c1],
          [draftScope, d1],
        ],
        10,
        "saved",
      ),
    ],
    [
      "index",
      indexRead(otherScope.workspaceId, [[otherScope, e1]], 10, "saved"),
    ],
    ["index", indexRead(null, [[nullScope, f1]], 10, "saved")],
    ["read", read(local, entry(c1, finalDraft), 10, "saved")],
    [
      "index",
      indexRead(
        home.workspaceId,
        [
          [local, c1],
          [draftScope, d1],
        ],
        10,
        "saved",
      ),
    ],
    [
      "index",
      indexRead(otherScope.workspaceId, [[otherScope, e1]], 10, "saved"),
    ],
    ["index", indexRead(null, [[nullScope, f1]], 10, "saved")],
    ["read", read(home, null, 10, "saved")],
    ["put", update(retired(a2), 10, "conflict", false, "retired_draft")],
    ["read", read(local, entry(c1, finalDraft), 10, "saved")],
  ];
  const order = [];
  let index = 0;
  const evaluate = vi.fn(async (_callback, args) => {
    if (index === 0 && loadingReads-- > 0) {
      expect(args.command).toBe("persisted_atom_read");
      return observation({
        key: atomKey,
        storeRevision: 0,
        persistence: { state: "loading", savedRevision: null },
        outcome: "unavailable",
        data: null,
      });
    }
    if (neverSaved && index >= 28)
      return observation(read(local, entry(c1, finalDraft), 10));
    const stepIndex = index++;
    const [op, result] = steps[stepIndex];
    expect(args.command).toBe(
      ["read", "index"].includes(op)
        ? "persisted_atom_read"
        : "persisted_atom_update",
    );
    if (!["read", "index"].includes(op)) expect(args.args.mutation.op).toBe(op);
    else {
      expect(args.args.query).toEqual(
        op === "read"
          ? { kind: "scope", scope: result.data.view.scope }
          : { kind: "workspace-index", workspaceId: result.data.workspaceId },
      );
      expect(args.args).not.toHaveProperty("scope");
    }
    expect(args.args.key).toBe(atomKey);
    const value = observation(structuredClone(result));
    mutate?.(value, stepIndex, args);
    order.push(`ipc:${stepIndex}`);
    return value;
  });
  const identity = (generation) => ({
    pid: generation === 1 ? 100 : 101,
    appDataRoot,
    hostSha256: sha,
    preloadSha256: sha,
    eventEmissionGuard: { validated: true, sourceSha256: sha },
    ...(generation === 1 ? firstIdentity : secondIdentity),
  });
  const driver = {
    launch: vi.fn(async ({ generation, appDataRoot: root }) => {
      order.push(`launch:${generation}`);
      expect(root).toBe(appDataRoot);
      return { page: { evaluate }, identity: identity(generation) };
    }),
    inspectFiles: vi.fn(async () => {
      order.push("files");
      return files ?? fileReceipts();
    }),
    close: vi.fn(async (handle) => {
      order.push(`exit:${handle.identity.pid}`);
      return {
        pid: handle.identity.pid,
        exited: true,
        exitCode: 0,
        signal: null,
        mode: "normal",
        ...exitReceipt,
      };
    }),
  };
  return { driver, order, evaluate };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("persisted atom fixture lifecycle (scripted fake bridge; not Electron evidence)", () => {
  it("requires saved files, complete exit, new PID and same scope/version after restart", async () => {
    const { driver, order, evaluate } = scriptedDriver();
    const evidence = await runPersistedAtomFixture({
      driver,
      protocol,
      appDataRoot,
      runId,
    });
    expect(evidence).toMatchObject({
      result: "pass",
      proofLevel: "Desktop persistence",
      runtimeGate: false,
      guiDraftRestoration: false,
      realRuntimeAcceptance: false,
      pids: [100, 101],
      savedRevision: 10,
      normalExitCount: 2,
      ipcInvocationCount: 39,
    });
    expect(order.indexOf("files")).toBeLessThan(order.indexOf("exit:100"));
    expect(order.indexOf("exit:100")).toBeLessThan(order.indexOf("launch:2"));
    expect(evaluate).toHaveBeenCalledTimes(39);
    expect(JSON.stringify(evidence)).not.toContain("const n = 1;");
    expect(JSON.stringify(evidence)).not.toContain("fixture 中😀");
  });

  it("waits for initial Main load through read IPC before creating a draft", async () => {
    const { driver, evaluate } = scriptedDriver({ loadingReads: 2 });
    await expect(
      runPersistedAtomFixture({
        driver,
        protocol,
        appDataRoot,
        runId,
        intervalMs: 1,
      }),
    ).resolves.toMatchObject({ result: "pass", ipcInvocationCount: 41 });
    expect(
      evaluate.mock.calls.slice(0, 3).map((call) => call[1].command),
    ).toEqual(Array(3).fill("persisted_atom_read"));
  });

  it("projects only metadata from file receipts into evidence", async () => {
    const files = fileReceipts();
    files.primary.parsedEnvelope = { draft: "private draft 中😀" };
    files.backup.debug = "private draft 中😀";
    const { driver } = scriptedDriver({ files });
    const evidence = await runPersistedAtomFixture({
      driver,
      protocol,
      appDataRoot,
      runId,
    });
    expect(evidence.files).toEqual(fileReceipts());
    expect(JSON.stringify(evidence)).not.toContain("private draft");
  });

  it.each(["revision", "digest", "path", "parser-owner"])(
    "rejects mismatched backup %s",
    async (fault) => {
      const files = fileReceipts();
      if (fault === "revision") files.backup.storeRevision = 6;
      if (fault === "digest") files.backup.sha256 = "b".repeat(64);
      if (fault === "path") files.backup.path = "/outside/host-state.json.bak";
      if (fault === "parser-owner")
        files.backup.validatedBy = "unvalidated-json";
      const { driver } = scriptedDriver({ files });
      await expect(
        runPersistedAtomFixture({ driver, protocol, appDataRoot, runId }),
      ).rejects.toThrow(/saved backup|same saved snapshot/);
      expect(driver.launch).toHaveBeenCalledTimes(1);
    },
  );

  it("does not treat a saved revision carried by an error state as a success", async () => {
    const { driver } = scriptedDriver({
      mutate: (value, index) => {
        if (index === 28)
          value.result.persistence = {
            state: "error",
            savedRevision: 10,
            diagnostic: { phase: "backup", code: "EIO" },
          };
      },
    });
    await expect(
      runPersistedAtomFixture({ driver, protocol, appDataRoot, runId }),
    ).rejects.toThrow(/disk save unavailable/);
    expect(driver.inspectFiles).not.toHaveBeenCalled();
    expect(driver.launch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "missing current artifacts",
      { firstIdentity: { hostSha256: "unknown" } },
      /Host\/preload/,
    ],
    [
      "renderer emission guard absent",
      {
        firstIdentity: {
          eventEmissionGuard: { validated: false, sourceSha256: sha },
        },
      },
      /source guard/,
    ],
    [
      "different profile",
      { secondIdentity: { appDataRoot: "/other" } },
      /Host\/preload/,
    ],
    ["same PID", { secondIdentity: { pid: 100 } }, /new Main PID/],
    [
      "changed artifacts",
      { secondIdentity: { hostSha256: "b".repeat(64) } },
      /same Host\/preload/,
    ],
    ["not exited", { exitReceipt: { exited: false } }, /complete normal/],
    [
      "killed",
      { exitReceipt: { signal: "SIGKILL", mode: "forced" } },
      /complete normal/,
    ],
    ["bad exit status", { exitReceipt: { exitCode: 1 } }, /complete normal/],
    ["backup missing", { files: {} }, /saved primary/],
  ])("rejects %s", async (_name, options, expected) => {
    const { driver } = scriptedDriver(options);
    await expect(
      runPersistedAtomFixture({ driver, protocol, appDataRoot, runId }),
    ).rejects.toThrow(expected);
  });

  it.each([
    [
      "CAS overwrites body",
      6,
      (value) => {
        value.result.entry.draft = firstDraft;
      },
      /CAS preserves/,
    ],
    [
      "promotion changes version",
      13,
      (value) => {
        value.result.entry.scopeVersion = "wrong";
      },
      /strict response/,
    ],
    [
      "consumed entry carries body",
      18,
      (value) => {
        value.result.entry.draft = firstDraft;
      },
      /strict response/,
    ],
    [
      "late put accepted",
      21,
      (value) => {
        value.result.outcome = "applied";
        value.result.changed = true;
      },
      /strict response/,
    ],
    [
      "restored version drift",
      32,
      (value) => {
        value.result.data.view.entry.scopeVersion = "wrong";
      },
      /same scope\/version/,
    ],
    [
      "missing mutation event",
      2,
      (value) => {
        value.events = [];
      },
      /Main mutation broadcast/,
    ],
    [
      "renderer payload in event",
      2,
      (value) => {
        value.events[0].payload.draft = firstDraft;
      },
      /metadata-only event/,
    ],
    [
      "wrong event envelope",
      2,
      (value) => {
        value.events[0].event = "other";
      },
      /native event envelope/,
    ],
    [
      "http fallback",
      0,
      (value) => {
        value.transport = "http-bridge";
      },
      /native IPC transport/,
    ],
    [
      "consumed index identity remains",
      20,
      (value) => {
        value.result.data.items = indexRead(
          home.workspaceId,
          [[local, a2]],
          6,
        ).data.items;
      },
      /cleared and consumed/,
    ],
    [
      "saved index omits draft binding",
      29,
      (value) => {
        value.result.data.items = value.result.data.items.slice(0, 1);
      },
      /saved workspace index isolation/,
    ],
    [
      "saved index includes stale Home binding",
      29,
      (value) => {
        value.result.data.items[0].scope = home;
        delete value.result.data.items[0].sessionId;
      },
      /saved workspace index isolation/,
    ],
    [
      "foreign workspace in saved index",
      29,
      (value) => {
        value.result.data.items[0].scope.workspaceId = otherScope.workspaceId;
      },
      /strict response/,
    ],
    [
      "saved index revision mismatches files",
      29,
      (value) => {
        value.result.storeRevision = 9;
        value.result.persistence.savedRevision = 9;
      },
      /index and saved file metadata/,
    ],
    [
      "restarted index metadata drifts",
      33,
      (value) => {
        value.result.data.items[0].updatedAt = 101;
      },
      /same detached index metadata/,
    ],
  ])("rejects %s", async (_name, target, alter, expected) => {
    const { driver } = scriptedDriver({
      mutate: (value, index) => {
        if (index === target) alter(value);
      },
    });
    await expect(
      runPersistedAtomFixture({ driver, protocol, appDataRoot, runId }),
    ).rejects.toThrow(expected);
    expect(driver.close).toHaveBeenCalled();
  });

  it("cannot use Map events as a saved receipt and never restarts unsaved state", async () => {
    const { driver } = scriptedDriver({ neverSaved: true });
    await expect(
      runPersistedAtomFixture({
        driver,
        protocol,
        appDataRoot,
        runId,
        timeoutMs: 5,
        intervalMs: 1,
      }),
    ).rejects.toThrow(/real saved revision receipt/);
    expect(driver.inspectFiles).not.toHaveBeenCalled();
    expect(driver.launch).toHaveBeenCalledTimes(1);
  });

  it("suppresses transport error text containing content while still cleaning up", async () => {
    const { driver, evaluate } = scriptedDriver();
    evaluate.mockRejectedValueOnce(new Error("private draft 中😀"));
    const error = await runPersistedAtomFixture({
      driver,
      protocol,
      appDataRoot,
      runId,
    }).catch((value) => value);
    expect(String(error)).not.toContain("private draft");
    expect(driver.close).toHaveBeenCalledTimes(1);
  });
});

describe("public preload observation function (explicit fake native bridge)", () => {
  function nativePage({ bridge = {}, invoke, listen } = {}) {
    let receiver;
    const remove = vi.fn();
    const api = {
      devBridgeFallback: false,
      supportsCommand: vi.fn(() => true),
      listen:
        listen ??
        vi.fn((_name, handler) => {
          receiver = handler;
          return remove;
        }),
      invoke: vi.fn(async () => {
        if (invoke) return invoke((value) => receiver(value));
        receiver(envelope(1));
        return update(entry(a1, firstDraft), 1);
      }),
      emit: vi.fn(),
      ...bridge,
    };
    vi.stubGlobal("window", { __LIME_ELECTRON__: true, electronAPI: api });
    const page = { evaluate: (callback, arg) => callback(arg) };
    const request = {
      key: atomKey,
      mutation: {
        op: "put",
        scope: home,
        draftId: a1.draftId,
        expectedVersion: null,
        nextVersion: a1.scopeVersion,
        draft: firstDraft,
      },
    };
    return { page, api, remove, request };
  }

  it("registers before invoke and uses invoke/listen only", async () => {
    const { page, api, remove, request } = nativePage();
    const observed = await observePersistedAtomCommand(
      page,
      protocol,
      "persisted_atom_update",
      request,
    );
    expect(observed.result.changed).toBe(true);
    expect(api.listen).toHaveBeenCalledWith(eventName, expect.any(Function));
    expect(api.listen.mock.invocationCallOrder[0]).toBeLessThan(
      api.invoke.mock.invocationCallOrder[0],
    );
    expect(api.invoke).toHaveBeenCalledWith("persisted_atom_update", request);
    expect(api.emit).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("waits for the mutation revision even when an older save event arrives first", async () => {
    const { page, remove, request } = nativePage({
      invoke: (send) => {
        send(envelope(0));
        setTimeout(() => send(envelope(1)), 5);
        return update(entry(a1, firstDraft), 1);
      },
    });
    await expect(
      observePersistedAtomCommand(
        page,
        protocol,
        "persisted_atom_update",
        request,
        { timeoutMs: 100 },
      ),
    ).resolves.toMatchObject({ events: [event(0), event(1)] });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it.each([
    { devBridgeFallback: true },
    { supportsCommand: () => false },
    { invoke: undefined },
    { listen: undefined },
  ])("rejects an unavailable or fallback native bridge", async (bridge) => {
    const { page, request } = nativePage({ bridge });
    await expect(
      observePersistedAtomCommand(
        page,
        protocol,
        "persisted_atom_update",
        request,
      ),
    ).rejects.toThrow(/transport failed/);
  });

  it("rejects no-op mutation broadcast and removes its listener", async () => {
    const { page, remove, request } = nativePage({
      invoke: () => update(entry(a1, firstDraft), 1),
    });
    await expect(
      observePersistedAtomCommand(
        page,
        protocol,
        "persisted_atom_update",
        request,
        { timeoutMs: 2 },
      ),
    ).rejects.toThrow(/Main mutation broadcast/);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("never invokes an unregistered command", async () => {
    const { page, api, request } = nativePage();
    await expect(
      observePersistedAtomCommand(
        page,
        protocol,
        "app_server_handle_json_lines",
        request,
      ),
    ).rejects.toThrow(/known command/);
    expect(api.invoke).not.toHaveBeenCalled();
  });

  it("redacts a parser exception rather than echoing rejected input", async () => {
    const { page, request } = nativePage();
    const badProtocol = {
      ...protocol,
      parseUpdateResult: () => {
        throw new Error("private draft 中😀");
      },
    };
    await expect(
      observePersistedAtomCommand(
        page,
        badProtocol,
        "persisted_atom_update",
        request,
      ),
    ).rejects.toThrow("strict response protocol");
  });
});
