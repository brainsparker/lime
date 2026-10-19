import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistedAtomStore } from "./persistedAtomStore";
import { PersistedAtomHost } from "./persistedAtomHost";
import { Buffer } from "node:buffer";
import { SUMMARY_PANEL_PIN_ATOM_KEY as key } from "../src/lib/api/persistedAtomTypes";
import {
  parsePersistedAtomReadRequest,
  parsePersistedAtomReadResult,
  parsePersistedAtomUpdateResult,
  PERSISTED_ATOM_LIMITS,
} from "../src/lib/api/persistedAtomProtocol";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await vi.waitFor(() => rm(root, { recursive: true, force: true }));
});
async function rootDirectory() {
  const root = await mkdtemp(path.join(tmpdir(), "summary-pin-"));
  roots.push(root);
  return root;
}

describe("Summary pin in the existing persisted atom owner", () => {
  it("reserves the shared pin value before accepting a draft at the file budget", async () => {
    const root = await rootDirectory();
    const draft = {
      op: "put",
      scope: { workspaceId: null, kind: "home", id: "new-conversation" },
      draftId: "draft-budget",
      expectedVersion: null,
      nextVersion: "v1",
      draft: { text: "x".repeat(512) },
    };
    const baseline = new PersistedAtomStore(root, { now: () => 1 });
    await baseline.ready;
    expect(baseline.updatePersistedAtomState(draft).outcome).toBe("applied");
    await baseline.flush();
    baseline.dispose();
    await baseline.flush();
    const envelope = JSON.parse(
      await readFile(path.join(root, "host-state.json"), "utf8"),
    );
    // The budget reserves future revisions and the longer boolean representation.
    envelope.storeRevision = Number.MAX_SAFE_INTEGER;
    envelope.atoms[key] = false;
    const maxFileBytes = Buffer.byteLength(JSON.stringify(envelope), "utf8");
    for (const extraBytes of [-1, 0]) {
      const store = new PersistedAtomStore(await rootDirectory(), {
        now: () => 1,
        limits: {
          ...PERSISTED_ATOM_LIMITS,
          maxFileBytes: maxFileBytes + extraBytes,
        },
      });
      try {
        await store.ready;
        expect(store.updatePersistedAtomState(draft)).toMatchObject(
          extraBytes < 0
            ? {
                outcome: "invalid",
                reason: "capacity_exceeded",
                changed: false,
              }
            : { outcome: "applied", changed: true },
        );
        if (extraBytes === 0) {
          expect(
            store.updateBooleanState(key, { op: "set", value: false }).outcome,
          ).toBe("applied");
          await store.flush();
          expect(store.sendBooleanState(key).persistence.state).toBe("saved");
        }
      } finally {
        store.dispose();
        await store.flush();
      }
    }
  });

  it("starts pinned, saves false alongside drafts, and restores through the real file owner", async () => {
    const root = await rootDirectory();
    const store = new PersistedAtomStore(root);
    await store.ready;
    expect(store.sendBooleanState(key)).toMatchObject({
      key,
      data: { queryKind: "value", value: true },
    });
    const draft = store.updatePersistedAtomState({
      op: "put",
      scope: { workspaceId: null, kind: "home", id: "new-conversation" },
      draftId: "draft-1",
      expectedVersion: null,
      nextVersion: "v1",
      draft: { text: "retained draft" },
    });
    expect(draft.outcome).toBe("applied");
    const request = { key, mutation: { op: "set", value: false } } as const;
    const update = store.updateBooleanState(key, request.mutation);
    expect(parsePersistedAtomUpdateResult(update, request)).toMatchObject({
      outcome: "applied",
      changed: true,
      value: false,
      storeRevision: 2,
    });
    await store.flush();
    store.dispose();
    await store.flush();
    const file = JSON.parse(
      await readFile(path.join(root, "host-state.json"), "utf8"),
    );
    expect(file.atoms[key]).toBe(false);
    expect(file.atoms["composer-drafts-v1"].entries["draft-1"].draft.text).toBe(
      "retained draft",
    );
    const restored = new PersistedAtomStore(root);
    await restored.ready;
    expect(restored.sendBooleanState(key)).toMatchObject({
      data: { value: false },
      persistence: { state: "saved", savedRevision: 2 },
    });
    expect(restored.updateBooleanState(key, request.mutation)).toMatchObject({
      changed: false,
      storeRevision: 2,
    });
    restored.dispose();
    await restored.flush();
  });

  it("shares Host IPC contracts, rejects arbitrary mutations, and broadcasts metadata only", async () => {
    const root = await rootDirectory();
    const events: unknown[] = [];
    const host = new PersistedAtomHost(root, (_name, event) =>
      events.push(event),
    );
    await host.ready;
    const read = { key, query: { kind: "value" } } as const;
    expect(
      parsePersistedAtomReadResult(host.sendPersistedAtomState(read), read),
    ).toMatchObject({ data: { value: true } });
    expect(
      host.updatePersistedAtomState({
        key,
        mutation: { op: "set", value: false },
      }),
    ).toMatchObject({ key, outcome: "applied", value: false });
    const revision = host.sendPersistedAtomState(read).storeRevision;
    for (const mutation of [
      { op: "set", value: "false" },
      { op: "put", value: false },
      { op: "set", value: true, path: "/tmp/foreign" },
    ]) {
      expect(host.updatePersistedAtomState({ key, mutation })).toMatchObject({
        outcome: "invalid",
        changed: false,
        storeRevision: revision,
      });
    }
    const pinEvents = events.filter(
      (event) => (event as { key: string }).key === key,
    );
    expect(pinEvents.length).toBeGreaterThan(0);
    for (const event of pinEvents) {
      expect(Object.keys(event as object).sort()).toEqual([
        "event",
        "key",
        "persistence",
        "storeRevision",
      ]);
    }
    host.dispose();
    // The Host has no Quit handshake. Observe its existing background flush.
    await vi.waitFor(async () => {
      const saved = JSON.parse(
        await readFile(path.join(root, "host-state.json.bak"), "utf8"),
      );
      expect(saved.atoms[key]).toBe(false);
    });
  });

  it("rejects cross-atom data and receipts instead of accepting a pin as a draft", () => {
    const meta = {
      key,
      storeRevision: 1,
      persistence: { state: "saved", savedRevision: 1 },
    };
    const read = { key, query: { kind: "value" } } as const;
    expect(() =>
      parsePersistedAtomReadRequest({
        key,
        query: { kind: "scope", scope: {} },
      }),
    ).toThrow();
    expect(() =>
      parsePersistedAtomReadResult(
        {
          ...meta,
          outcome: "ready",
          data: { queryKind: "value", value: "false" },
        },
        read,
      ),
    ).toThrow();
    expect(() =>
      parsePersistedAtomReadResult(
        {
          ...meta,
          key: "composer-drafts-v1",
          outcome: "unavailable",
          data: null,
        },
        read,
      ),
    ).toThrow();
    expect(() =>
      parsePersistedAtomUpdateResult(
        {
          ...meta,
          outcome: "applied",
          changed: true,
          entry: null,
          value: false,
        },
        { key, mutation: { op: "set", value: true } },
      ),
    ).toThrow();
    expect(() =>
      parsePersistedAtomUpdateResult({
        ...meta,
        outcome: "applied",
        changed: true,
        entry: {},
        value: true,
      }),
    ).toThrow();
  });
});
