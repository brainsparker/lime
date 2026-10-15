import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PERSISTED_ATOM_LIMITS,
  parsePersistedAtomReadResult,
} from "../src/lib/api/persistedAtomProtocol";
import type {
  DraftScope,
  PersistedAtomEnvelope,
  PersistedDraftEntry,
} from "../src/lib/api/persistedAtomTypes";
import { projectWorkspaceDraftIndex, scopeKey } from "./persistedAtomRecords";
import {
  cleanup,
  createStore,
  entry,
  home,
  identity,
  local,
  put,
} from "./persistedAtomStore.test-support";
import { PersistedAtomStore } from "./persistedAtomStore";

afterEach(cleanup);
const scope = (id: string, workspaceId: string | null = "w"): DraftScope => ({
  workspaceId,
  kind: "draft",
  id,
});
function index(store: PersistedAtomStore, workspaceId: string | null = "w") {
  const query = { kind: "workspace-index", workspaceId } as const;
  const result = parsePersistedAtomReadResult(
    store.sendPersistedAtomState(query),
    {
      key: "composer-drafts-v1",
      query,
    },
  );
  if (result.outcome !== "ready" || result.data.queryKind !== "workspace-index")
    throw new Error("expected ready workspace index");
  return result;
}
function items(store: PersistedAtomStore, workspaceId: string | null = "w") {
  const result = index(store, workspaceId);
  if (result.data.queryKind !== "workspace-index")
    throw new Error("wrong query");
  return result.data.items;
}

describe("same-owner workspace draft index", () => {
  it("isolates exact workspaces including null and returns empty metadata discovery", async () => {
    const { store } = await createStore();
    const scopes = [
      home,
      scope("same"),
      scope("same", "other"),
      scope("same", null),
      local,
    ];
    for (const [i, value] of scopes.entries())
      expect(store.updatePersistedAtomState(put(value, `d${i}`)).outcome).toBe(
        "applied",
      );
    expect(items(store).map((item) => item.scope)).toEqual([
      scope("same"),
      local,
    ]);
    expect(items(store, null).map((item) => item.scope)).toEqual([
      scope("same", null),
      home,
    ]);
    expect(items(store, "other").map((item) => item.scope)).toEqual([
      scope("same", "other"),
    ]);
    expect(items(store, "missing")).toEqual([]);
    expect(
      store.sendPersistedAtomState({ kind: "scope", scope: scope("missing") }),
    ).toMatchObject({
      outcome: "ready",
      data: { queryKind: "scope", view: { entry: null } },
    });
  });

  it("uses current promoted binding and removes consumed records without exposing payload", async () => {
    const { store } = await createStore();
    store.updatePersistedAtomState(put());
    store.updatePersistedAtomState({
      op: "promote",
      source: home,
      target: local,
      identity,
      expectedTarget: null,
      sessionId: local.id,
      threadId: "canonical-thread",
    });
    expect(items(store, null)).toEqual([]);
    expect(items(store)).toEqual([
      {
        scope: local,
        identity,
        updatedAt: 1_000,
        sessionId: local.id,
        threadId: "canonical-thread",
      },
    ]);
    expect(entry(store, local)?.originScopeKey).toBe(scopeKey(home));
    expect(JSON.stringify(items(store))).not.toMatch(
      /rich 中文|attachments|mediaType|editorDocument|inputCapabilityRoute|originScopeKey/,
    );
    expect(
      store.updatePersistedAtomState({ op: "consume", identity }).outcome,
    ).toBe("applied");
    expect(items(store)).toEqual([]);
    expect(items(store, null)).toEqual([]);
    expect(store.updatePersistedAtomState(put()).reason).toBe("retired_draft");
  });

  it("preserves the single binding invariant across rejected aliases and repeated promotions", async () => {
    const { store } = await createStore();
    const a = scope("a"),
      b = scope("b"),
      c = scope("c");
    store.updatePersistedAtomState(put(a));
    expect(store.updatePersistedAtomState(put(b)).outcome).toBe("conflict");
    expect(
      store.updatePersistedAtomState(put(b, "d1", "v2", "v1")).outcome,
    ).toBe("conflict");
    const promote = (source: DraftScope, target: DraftScope) =>
      store.updatePersistedAtomState({
        op: "promote",
        source,
        target,
        identity,
        expectedTarget: null,
      });
    expect(promote(a, b).outcome).toBe("applied");
    expect(promote(a, b).changed).toBe(false);
    expect(promote(b, c).outcome).toBe("applied");
    expect(items(store).map((item) => item.scope)).toEqual([c]);
    expect(entry(store, a)).toBeNull();
    expect(entry(store, b)).toBeNull();
  });

  it("orders by newest time then canonical scope key without environment-sensitive collation", async () => {
    let time = 10;
    const { store } = await createStore({ now: () => time });
    for (const id of ["z", "ä", "Z", "a", "😀", "\ue000"])
      store.updatePersistedAtomState(put(scope(id), `d-${id}`));
    time = 11;
    store.updatePersistedAtomState(put(scope("newest"), "d-newest"));
    expect(items(store).map((item) => item.scope.id)).toEqual([
      "newest",
      "Z",
      "a",
      "z",
      "ä",
      "\ue000",
      "😀",
    ]);
    expect(items(store)).toEqual(items(store));
  });

  it("does not read/write disk, broadcast, change metadata or update timestamps while reading", async () => {
    const now = vi.fn(() => 1_000);
    const calls: string[] = [];
    const { store } = await createStore({
      now,
      io: {
        readFile: async () => {
          calls.push("read");
          throw { code: "ENOENT" };
        },
        mkdir: async () => {
          calls.push("mkdir");
        },
        writeFile: async () => {
          calls.push("write");
        },
        rename: async () => {
          calls.push("rename");
        },
        removeTemporary: async () => {
          calls.push("remove");
        },
      },
    });
    store.updatePersistedAtomState(put(scope("a")));
    await store.flush();
    const metadata = store.metadata(),
      body = entry(store, scope("a"));
    const listener = vi.fn();
    store.subscribe(listener);
    const baselineCalls = [...calls],
      baselineTimeCalls = now.mock.calls.length;
    for (let i = 0; i < 3; i += 1) {
      expect(index(store).storeRevision).toBe(metadata.storeRevision);
      expect(items(store)[0].updatedAt).toBe(1_000);
      expect(store.metadata()).toEqual(metadata);
      expect(entry(store, scope("a"))).toEqual(body);
    }
    expect(calls).toEqual(baselineCalls);
    expect(now).toHaveBeenCalledTimes(baselineTimeCalls);
    expect(listener).not.toHaveBeenCalled();
    // Projection objects cannot mutate the store owner.
    const projection = items(store)[0];
    Object.assign(projection.scope, { id: "mutated" });
    Object.assign(projection.identity, { scopeVersion: "mutated" });
    expect(items(store)[0].scope.id).toBe("a");
    expect(items(store)[0].identity.scopeVersion).toBe("v1");
  });

  it("returns the complete small-budget index without read capacity truncation", async () => {
    const { store } = await createStore({
      limits: { ...PERSISTED_ATOM_LIMITS, maxEntries: 3, maxBindings: 3 },
    });
    for (let i = 0; i < 3; i += 1)
      store.updatePersistedAtomState(put(scope(`s${i}`), `d${i}`));
    expect(
      store.updatePersistedAtomState(put(scope("over"), "over")).reason,
    ).toBe("capacity_exceeded");
    expect(items(store)).toHaveLength(3);
    expect(index(store).storeRevision).toBe(3);
  });

  it("returns all 10,000 validated bindings from one synchronous loaded-store snapshot", async () => {
    const entries: Record<string, PersistedDraftEntry> = {},
      bindings: Record<string, string> = {};
    for (let i = 0; i < 10_000; i += 1) {
      const current = scope(`s${i}`),
        draftId = `d${i}`;
      const key = scopeKey(current);
      entries[draftId] = {
        draftId,
        scopeVersion: "v1",
        originScopeKey: key,
        updatedAt: i,
        state: "draft",
        draft: {},
      };
      bindings[key] = draftId;
    }
    const envelope: PersistedAtomEnvelope = {
      format: "electron-persisted-atom-state",
      version: 1,
      storeRevision: 10_000,
      atoms: { "composer-drafts-v1": { entries, bindings } },
    };
    const buffer = Buffer.from(JSON.stringify(envelope));
    const { store } = await createStore({
      limits: PERSISTED_ATOM_LIMITS,
      io: {
        readFile: async () => buffer,
        mkdir: async () => {
          throw new Error("unexpected write");
        },
        writeFile: async () => {
          throw new Error("unexpected write");
        },
        rename: async () => {
          throw new Error("unexpected write");
        },
        removeTemporary: async () => {
          throw new Error("unexpected write");
        },
      },
    });
    const result = index(store);
    expect(result.storeRevision).toBe(10_000);
    if (result.data.queryKind !== "workspace-index")
      throw new Error("wrong query");
    expect(result.data.items).toHaveLength(10_000);
    expect(result.data.items[0].identity.draftId).toBe("d9999");
    expect(result.data.items.at(-1)?.identity.draftId).toBe("d0");
    expect(store.metadata()).toMatchObject({
      storeRevision: 10_000,
      persistence: { state: "saved", savedRevision: 10_000 },
    });
  }, 20_000);

  it("rejects old bare scopes and malformed queries and distinguishes closed from empty", async () => {
    const { store } = await createStore();
    for (const query of [
      home,
      { kind: "workspace-index", workspaceId: undefined },
      { kind: "workspace-index", workspaceId: null, path: "/tmp/private" },
      { kind: "scope", scope: home, extra: true },
    ])
      expect(store.sendPersistedAtomState(query)).toMatchObject({
        outcome: "invalid",
        reason: "invalid_request",
        data: null,
      });
    store.dispose();
    expect(
      store.sendPersistedAtomState({
        kind: "workspace-index",
        workspaceId: null,
      }),
    ).toMatchObject({ outcome: "unavailable", reason: "closed", data: null });
  });

  it("reports failed load as unavailable instead of an empty index that could discard saved state", async () => {
    const { store } = await createStore({
      io: {
        readFile: async () => {
          throw { code: "EACCES" };
        },
        mkdir: async () => {
          throw new Error("unexpected write");
        },
        writeFile: async () => {
          throw new Error("unexpected write");
        },
        rename: async () => {
          throw new Error("unexpected write");
        },
        removeTemporary: async () => {
          throw new Error("unexpected write");
        },
      },
    });
    expect(
      store.sendPersistedAtomState({
        kind: "workspace-index",
        workspaceId: null,
      }),
    ).toMatchObject({
      outcome: "unavailable",
      data: null,
      persistence: {
        state: "unavailable",
        diagnostic: { phase: "load", code: "EACCES" },
      },
    });
  });

  it("projects only valid live current bindings and excludes orphans, tombstones and malformed bindings", () => {
    const current = scope("current"),
      old = scope("origin", null);
    const live: PersistedDraftEntry = {
      ...identity,
      originScopeKey: scopeKey(old),
      updatedAt: 2,
      state: "draft",
      draft: { text: "private" },
    };
    const { draft: _draft, ...base } = live;
    const consumed: PersistedDraftEntry = {
      ...base,
      draftId: "consumed",
      state: "consumed",
      consumption: "clear",
      consumedAt: 3,
    };
    const entries = new Map<string, PersistedDraftEntry>([
      ["d1", live],
      ["orphan", { ...live, draftId: "orphan" }],
      ["consumed", consumed],
      ["bad-local", { ...live, draftId: "bad-local", sessionId: "wrong" }],
      ["mismatch", { ...live, draftId: "different" }],
    ]);
    const bindings = new Map([
      [scopeKey(current), "d1"],
      [scopeKey(scope("dangling")), "missing"],
      [scopeKey(scope("consumed")), "consumed"],
      [scopeKey(local), "bad-local"],
      [scopeKey(scope("mismatch")), "mismatch"],
      ["malformed", "d1"],
      [JSON.stringify(["w", "draft", "current"]) + " ", "d1"],
    ]);
    expect(projectWorkspaceDraftIndex(bindings, entries, "w")).toEqual([
      { scope: current, identity, updatedAt: 2 },
    ]);
    expect(projectWorkspaceDraftIndex(bindings, entries, null)).toEqual([]);
    expect(entries.get("d1")).toBe(live);
    expect(bindings.size).toBe(7);
  });
});
