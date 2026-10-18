import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersistedAtomUpdateEvent } from "../src/lib/api/persistedAtomTypes";
import { PersistedAtomHost } from "./persistedAtomHost";

const roots: string[] = [],
  hosts: { host: PersistedAtomHost; root: string }[] = [];
const scope = {
  workspaceId: null,
  kind: "home",
  id: "new-conversation",
} as const;
const request = {
  key: "composer-drafts-v1",
  mutation: {
    op: "put",
    scope,
    draftId: "d1",
    expectedVersion: null,
    nextVersion: "v1",
    draft: {
      text: "fixture private content",
      attachments: [{ data: "c2VjcmV0", mediaType: "image/png" }],
    },
  },
} as const;
async function createHost() {
  const root = await mkdtemp(path.join(tmpdir(), "atom-host-"));
  roots.push(root);
  const events: { name: string; payload: unknown }[] = [];
  const host = new PersistedAtomHost(root, (name, payload) =>
    events.push({ name, payload }),
  );
  hosts.push({ host, root });
  await host.ready;
  return { root, host, events };
}
afterEach(async () => {
  for (const { host, root } of hosts.splice(0)) {
    const revision = host.sendPersistedAtomState({
      key: "composer-drafts-v1",
      query: { kind: "scope", scope: scope },
    }).storeRevision;
    host.dispose();
    if (revision > 0)
      await vi.waitFor(async () => {
        const backup = JSON.parse(
          await readFile(path.join(root, "host-state.json.bak"), "utf8"),
        );
        expect(backup.storeRevision).toBeGreaterThanOrEqual(revision);
      });
  }
  // Disposal is intentionally not an acknowledged Quit protocol; ensure test IO settled before cleanup.
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await vi.waitFor(async () => {
        await rm(root, { recursive: true, force: true });
      });
    }),
  );
});

describe("persisted atom isolated Host command boundary", () => {
  it("accepts only the known atom and reports complete scope projection", async () => {
    const { host } = await createHost();
    expect(host.updatePersistedAtomState(request)).toMatchObject({
      outcome: "applied",
      storeRevision: 1,
    });
    expect(
      host.sendPersistedAtomState({
        key: "composer-drafts-v1",
        query: { kind: "scope", scope: scope },
      }),
    ).toMatchObject({
      outcome: "ready",
      data: {
        queryKind: "scope",
        view: {
          scope,
          entry: {
            draftId: "d1",
            scopeVersion: "v1",
            draft: request.mutation.draft,
          },
        },
      },
    });
  });

  it.each([
    { key: "other-atom", mutation: request.mutation },
    { ...request, path: "/arbitrary/host-state.json" },
    { ...request, budget: Number.MAX_SAFE_INTEGER },
    { key: "composer-drafts-v1", mutation: { op: "replace", value: {} } },
    { mutation: request.mutation },
  ])(
    "refuses unknown keys, paths, caller budgets and full replacements",
    async (input) => {
      const { host, events } = await createHost();
      const count = events.length;
      expect(host.updatePersistedAtomState(input)).toMatchObject({
        outcome: "invalid",
        changed: false,
        storeRevision: 0,
      });
      expect(events).toHaveLength(count);
      expect(
        host.sendPersistedAtomState({
          key: "composer-drafts-v1",
          query: { kind: "scope", scope: scope },
        }),
      ).toMatchObject({
        data: { queryKind: "scope", view: { entry: null } },
      });
    },
  );

  it("validates read fields and scope with explicit errors", async () => {
    const { host } = await createHost();
    expect(
      host.sendPersistedAtomState({
        key: "other",
        query: { kind: "scope", scope: scope },
      }),
    ).toMatchObject({
      outcome: "invalid",
      reason: "invalid_request",
    });
    expect(
      host.sendPersistedAtomState({
        key: "composer-drafts-v1",
        query: { kind: "scope", scope: { ...scope, kind: "cloud" } },
      }),
    ).toMatchObject({ outcome: "invalid", reason: "invalid_request" });
    expect(
      host.sendPersistedAtomState({
        key: "composer-drafts-v1",
        query: { kind: "scope", scope: scope },
        path: "x",
      }),
    ).toMatchObject({ outcome: "invalid", data: null });
  });

  it("serves workspace index through the same read command without another owner or event", async () => {
    const { host, events } = await createHost();
    host.updatePersistedAtomState(request);
    const count = events.length;
    expect(
      host.sendPersistedAtomState({
        key: request.key,
        query: { kind: "workspace-index", workspaceId: null },
      }),
    ).toMatchObject({
      outcome: "ready",
      storeRevision: 1,
      data: {
        queryKind: "workspace-index",
        workspaceId: null,
        items: [{ scope, identity: { draftId: "d1", scopeVersion: "v1" } }],
      },
    });
    expect(
      host.sendPersistedAtomState({
        key: request.key,
        query: { kind: "workspace-index", workspaceId: "other" },
      }),
    ).toMatchObject({ data: { items: [] } });
    expect(events).toHaveLength(count);
  });

  it("rejects removed scope-only requests and nested query getters without invoking them", async () => {
    const { host } = await createHost();
    expect(
      host.sendPersistedAtomState({ key: request.key, scope }),
    ).toMatchObject({
      outcome: "invalid",
      reason: "invalid_request",
      data: null,
    });
    let called = false;
    const query = Object.defineProperty(
      { kind: "workspace-index" },
      "workspaceId",
      {
        enumerable: true,
        get() {
          called = true;
          return null;
        },
      },
    );
    expect(
      host.sendPersistedAtomState({ key: request.key, query }),
    ).toMatchObject({
      outcome: "invalid",
      reason: "invalid_request",
      data: null,
    });
    expect(called).toBe(false);
  });

  it("emits safe revision/persistence notifications without content or runtime fields", async () => {
    const { host, events } = await createHost();
    host.updatePersistedAtomState(request);
    const event = events.filter((event) => (event.payload as PersistedAtomUpdateEvent).key === "composer-drafts-v1").at(-1);
    expect(event?.name).toBe("persisted-atom-update");
    expect(event?.payload).toMatchObject({
      key: "composer-drafts-v1",
      event: "persisted-atom-update",
      storeRevision: 1,
      persistence: { state: "pending", savedRevision: 0 },
    } satisfies Partial<PersistedAtomUpdateEvent>);
    expect(JSON.stringify(events)).not.toContain("fixture private content");
    expect(JSON.stringify(events)).not.toContain("c2VjcmV0");
    expect(event?.payload).not.toHaveProperty("threadId");
    expect(event?.payload).not.toHaveProperty("entry");
  });

  it("normal lifecycle disposal initiates best-effort save without a promise or renderer ACK", async () => {
    const { host, root, events } = await createHost();
    host.updatePersistedAtomState(request);
    const count = events.length;
    expect(host.dispose()).toBeUndefined();
    expect(host.updatePersistedAtomState(request)).toMatchObject({
      outcome: "unavailable",
      reason: "closed",
    });
    await vi.waitFor(async () => {
      const primary = JSON.parse(
        await readFile(path.join(root, "host-state.json"), "utf8"),
      );
      const backup = JSON.parse(
        await readFile(path.join(root, "host-state.json.bak"), "utf8"),
      );
      expect(primary.storeRevision).toBe(1);
      expect(backup).toEqual(primary);
    });
    expect(events).toHaveLength(count);
    const restored = new PersistedAtomHost(root);
    hosts.push({ host: restored, root });
    await restored.ready;
    expect(
      restored.sendPersistedAtomState({
        key: "composer-drafts-v1",
        query: { kind: "scope", scope: scope },
      }),
    ).toMatchObject({
      data: {
        queryKind: "scope",
        view: { entry: { draft: request.mutation.draft } },
      },
    });
  });
});
