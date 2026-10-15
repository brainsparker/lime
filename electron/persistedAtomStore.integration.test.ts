import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersistedAtomUpdateResult } from "../src/lib/api/persistedAtomTypes";
import {
  persistedAtomFileIO,
  type PersistedAtomFileIO,
} from "./persistedAtomFile";
import { PersistedAtomStore } from "./persistedAtomStore";
import {
  cleanup,
  createRoot,
  createStore,
  deferred,
  entry,
  home,
  identity,
  limits,
  local,
  promotion,
  put,
  trackStore,
} from "./persistedAtomStore.test-support";
afterEach(cleanup);

describe("persisted atom save queue and recovery", () => {
  it("reserves tombstone overhead before accepting a minimal draft at capacity", async () => {
    const minimal = {
      op: "put",
      scope: { workspaceId: null, kind: "draft", id: "x" },
      draftId: "d1",
      expectedVersion: null,
      nextVersion: "v1",
      draft: {},
    } as const;
    const baseline = await createStore();
    expect(baseline.store.updatePersistedAtomState(minimal).outcome).toBe(
      "applied",
    );
    await baseline.store.flush();
    const actualBytes = (
      await readFile(path.join(baseline.root, "host-state.json"))
    ).byteLength;
    const narrow = await createStore({
      limits: { ...limits, maxFileBytes: actualBytes },
    });
    expect(narrow.store.updatePersistedAtomState(minimal)).toMatchObject({
      outcome: "invalid",
      reason: "capacity_exceeded",
      storeRevision: 0,
    });
    const bounded = await createStore({
      limits: { ...limits, maxFileBytes: actualBytes + 128 },
    });
    expect(bounded.store.updatePersistedAtomState(minimal).outcome).toBe(
      "applied",
    );
    expect(
      bounded.store.updatePersistedAtomState({ op: "consume", identity }),
    ).toMatchObject({ outcome: "applied", entry: { state: "consumed" } });
    await bounded.store.flush();
    expect(
      (await readFile(path.join(bounded.root, "host-state.json"))).byteLength,
    ).toBeLessThanOrEqual(actualBytes + 128);
  });

  it("malformed UTF8 durable files fail closed without replacing invalid bytes", async () => {
    const root = await createRoot();
    const broken = Buffer.from([
      0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d,
    ]);
    await writeFile(path.join(root, "host-state.json"), broken);
    const store = new PersistedAtomStore(root, { limits });
    trackStore(store);
    await store.ready;
    expect(store.metadata()).toMatchObject({
      persistence: {
        state: "unavailable",
        diagnostic: { code: "INVALID_STATE" },
      },
    });
    expect(store.updatePersistedAtomState(put()).outcome).toBe("unavailable");
    await store.flush();
    expect(await readFile(path.join(root, "host-state.json"))).toEqual(broken);
  });
  it("coalesces edits over 500 ms and writes only the latest full snapshot", async () => {
    vi.useFakeTimers();
    const rename = vi.fn(persistedAtomFileIO.rename);
    const { store } = await createStore({
      io: { ...persistedAtomFileIO, rename },
    });
    store.updatePersistedAtomState(put());
    await vi.advanceTimersByTimeAsync(250);
    store.updatePersistedAtomState(put(home, "d1", "v2", "v1", "latest"));
    await vi.advanceTimersByTimeAsync(499);
    expect(rename).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await store.flush();
    expect(rename).toHaveBeenCalledTimes(2);
    expect(store.metadata()).toMatchObject({
      storeRevision: 2,
      persistence: { state: "saved", savedRevision: 2 },
    });
  });

  it("a late saved revision cannot mark a newer in-memory edit saved", async () => {
    const started = deferred<void>(),
      release = deferred<void>();
    let first = true;
    const io: PersistedAtomFileIO = {
      ...persistedAtomFileIO,
      rename: async (from, to) => {
        if (first) {
          first = false;
          started.resolve();
          await release.promise;
        }
        await persistedAtomFileIO.rename(from, to);
      },
    };
    const { store, root } = await createStore({ io });
    store.updatePersistedAtomState(put());
    const saving = store.flush();
    await started.promise;
    store.updatePersistedAtomState(
      put(home, "d1", "v2", "v1", "newer pending"),
    );
    release.resolve();
    await saving;
    expect(store.metadata()).toMatchObject({
      storeRevision: 2,
      persistence: { state: "pending", savedRevision: 1 },
    });
    const persisted = JSON.parse(
      await readFile(path.join(root, "host-state.json"), "utf8"),
    );
    expect(persisted.storeRevision).toBe(1);
    expect(entry(store)).toMatchObject({ scopeVersion: "v2" });
    await store.flush();
    expect(store.metadata()).toMatchObject({
      persistence: { state: "saved", savedRevision: 2 },
    });
  });

  it("serializes concurrent flushes without overlapping or rolling the durable revision back", async () => {
    const started = deferred<void>(),
      release = deferred<void>();
    let first = true,
      active = 0,
      maximum = 0;
    const io: PersistedAtomFileIO = {
      ...persistedAtomFileIO,
      writeFile: async (file, text) => {
        active += 1;
        maximum = Math.max(maximum, active);
        if (first) {
          first = false;
          started.resolve();
          await release.promise;
        }
        await persistedAtomFileIO.writeFile(file, text);
        active -= 1;
      },
    };
    const { store } = await createStore({ io });
    store.updatePersistedAtomState(put());
    const oldSave = store.flush();
    await started.promise;
    store.updatePersistedAtomState(put(home, "d1", "v2", "v1"));
    const newSave = store.flush();
    release.resolve();
    await Promise.all([oldSave, newSave]);
    expect(maximum).toBe(1);
    expect(store.metadata()).toMatchObject({
      persistence: { state: "saved", savedRevision: 2 },
    });
  });

  it("keeps latest memory/old durable files after IO failure, without gating further mutations", async () => {
    let fail = false;
    const io = {
      ...persistedAtomFileIO,
      rename: async (from: string, to: string) => {
        if (fail)
          throw Object.assign(new Error("draft text attachment secret"), {
            code: "ENOSPC",
          });
        await persistedAtomFileIO.rename(from, to);
      },
    };
    const { store, root } = await createStore({ io });
    store.updatePersistedAtomState(put());
    await store.flush();
    fail = true;
    store.updatePersistedAtomState(put(home, "d1", "v2", "v1", "new memory"));
    await store.flush();
    expect(store.metadata()).toMatchObject({
      persistence: {
        state: "error",
        savedRevision: 1,
        diagnostic: { phase: "primary", code: "ENOSPC" },
      },
    });
    expect(JSON.stringify(store.metadata())).not.toContain("attachment secret");
    expect(entry(store)).toMatchObject({ scopeVersion: "v2" });
    expect(
      JSON.parse(await readFile(path.join(root, "host-state.json"), "utf8"))
        .storeRevision,
    ).toBe(1);
    const accepted: PersistedAtomUpdateResult = store.updatePersistedAtomState({
      op: "consume",
      identity: { ...identity, scopeVersion: "v2" },
    });
    expect(accepted).toMatchObject({
      outcome: "applied",
      entry: { state: "consumed" },
    });
    fail = false;
    await store.flush();
    expect(store.metadata()).toMatchObject({
      persistence: { state: "saved", savedRevision: 3 },
    });
  });

  it("partial backup failure is an error rather than a false saved receipt", async () => {
    let failBackup = false;
    const io = {
      ...persistedAtomFileIO,
      rename: async (from: string, to: string) => {
        if (failBackup && to.endsWith(".bak"))
          throw Object.assign(new Error("private"), { code: "EIO" });
        await persistedAtomFileIO.rename(from, to);
      },
    };
    const { store, root } = await createStore({ io });
    store.updatePersistedAtomState(put());
    await store.flush();
    failBackup = true;
    store.updatePersistedAtomState(put(home, "d1", "v2", "v1"));
    await store.flush();
    expect(store.metadata()).toMatchObject({
      persistence: {
        state: "error",
        savedRevision: 1,
        diagnostic: { phase: "backup", code: "EIO" },
      },
    });
    expect(
      JSON.parse(await readFile(path.join(root, "host-state.json.bak"), "utf8"))
        .storeRevision,
    ).toBe(1);
    failBackup = false;
    await store.flush();
    expect(store.metadata()).toMatchObject({
      persistence: { state: "saved", savedRevision: 2 },
    });
  });

  it("a new owner restores durable rich records and non-resurrectable tombstones", async () => {
    const { store, root } = await createStore();
    store.updatePersistedAtomState(put());
    store.updatePersistedAtomState(promotion());
    store.updatePersistedAtomState(put(home, "new-home", "new-version"));
    store.updatePersistedAtomState({ op: "consume", identity });
    await store.flush();
    const restored = new PersistedAtomStore(root, { limits });
    trackStore(restored);
    await restored.ready;
    expect(entry(restored, local)).toBeNull();
    expect(entry(restored)).toEqual(entry(store));
    expect(restored.updatePersistedAtomState(put())).toMatchObject({
      outcome: "conflict",
      reason: "retired_draft",
    });
    expect(restored.metadata()).toMatchObject({
      storeRevision: 4,
      persistence: { state: "saved", savedRevision: 4 },
    });
  });

  it("repairs a corrupt primary from valid backup without losing the record", async () => {
    const { store, root } = await createStore();
    store.updatePersistedAtomState(put());
    await store.flush();
    await writeFile(path.join(root, "host-state.json"), "corrupt");
    const restored = new PersistedAtomStore(root, { limits });
    trackStore(restored);
    await restored.ready;
    expect(entry(restored)).toEqual(entry(store));
    expect(restored.metadata()).toMatchObject({
      persistence: { state: "pending", savedRevision: 1 },
    });
    await restored.flush();
    expect(restored.metadata()).toMatchObject({
      persistence: { state: "saved", savedRevision: 1 },
    });
    expect(
      JSON.parse(await readFile(path.join(root, "host-state.json"), "utf8"))
        .storeRevision,
    ).toBe(1);
  });

  it("keeps corrupt durable files unavailable and never overwrites them with empty state", async () => {
    const root = await createRoot();
    await writeFile(
      path.join(root, "host-state.json"),
      "private-broken-primary",
    );
    await writeFile(
      path.join(root, "host-state.json.bak"),
      "private-broken-backup",
    );
    const store = new PersistedAtomStore(root, { limits });
    trackStore(store);
    await store.ready;
    expect(store.updatePersistedAtomState(put())).toMatchObject({
      outcome: "unavailable",
      changed: false,
    });
    await store.flush();
    expect(store.metadata()).toMatchObject({
      persistence: {
        state: "unavailable",
        savedRevision: null,
        diagnostic: { code: "INVALID_STATE" },
      },
    });
    expect(JSON.stringify(store.metadata())).not.toContain("private-broken");
    expect(await readFile(path.join(root, "host-state.json"), "utf8")).toBe(
      "private-broken-primary",
    );
    expect(await readFile(path.join(root, "host-state.json.bak"), "utf8")).toBe(
      "private-broken-backup",
    );
  });

  it("dispose is synchronous best effort and closed stores refuse new mutations", async () => {
    const { store, root } = await createStore();
    store.updatePersistedAtomState(put());
    expect(store.dispose()).toBeUndefined();
    expect(
      store.updatePersistedAtomState(put(home, "d1", "v2", "v1")),
    ).toMatchObject({
      outcome: "unavailable",
      reason: "closed",
    });
    await store.flush();
    expect(
      JSON.parse(await readFile(path.join(root, "host-state.json"), "utf8"))
        .storeRevision,
    ).toBe(1);
  });
});
