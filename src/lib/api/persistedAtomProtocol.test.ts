import { afterEach, describe, expect, it } from "vitest";
import type {
  PersistedAtomReadRequest,
  PersistedAtomUpdateRequest,
} from "./persistedAtomTypes";
import {
  assertPersistedDraftPayload,
  parsePersistedAtomReadResult,
  parsePersistedAtomUpdateEvent,
  parsePersistedAtomUpdateResult,
} from "./persistedAtomProtocol";
import {
  cleanup,
  createStore,
  home,
  identity,
  local,
  promotion,
  put,
} from "../../../electron/persistedAtomStore.test-support";

afterEach(cleanup);
const metadata = {
  key: "composer-drafts-v1",
  storeRevision: 1,
  persistence: { state: "pending", savedRevision: 0 },
} as const;
const draft = {
  ...identity,
  originScopeKey: JSON.stringify([null, "home", "new-conversation"]),
  state: "draft",
  updatedAt: 1,
  draft: {
    text: "fixture😀",
    attachments: [{ data: "aW1hZ2U=", mediaType: "image/png" }],
  },
} as const;
const read = {
  ...metadata,
  outcome: "ready",
  data: { queryKind: "scope", view: { scope: home, entry: draft } },
} as const;
const update = {
  ...metadata,
  outcome: "applied",
  changed: true,
  entry: draft,
} as const;
const event = { ...metadata, event: "persisted-atom-update" } as const;

describe("strict shared persisted atom transport", () => {
  it("accepts valid complete read/update projections and metadata-only notifications", () => {
    expect(parsePersistedAtomReadResult(read)).toEqual(read);
    expect(parsePersistedAtomUpdateResult(update)).toEqual(update);
    expect(parsePersistedAtomUpdateEvent(event)).toEqual(event);
  });

  it.each([
    { ...event, key: "other-atom" },
    { ...event, draft },
    { ...event, entry: draft },
    { ...event, threadId: "thread" },
    { ...event, event: "other" },
    { ...event, storeRevision: NaN },
    { ...event, storeRevision: -1 },
    { ...event, persistence: { state: "saved", savedRevision: 0 } },
    { ...event, persistence: { state: "pending", savedRevision: 2 } },
    { ...event, persistence: { state: "pending", savedRevision: null } },
    { ...event, persistence: { state: "error", savedRevision: 0 } },
    {
      ...event,
      persistence: {
        state: "unavailable",
        savedRevision: 0,
        diagnostic: { phase: "load", code: "INVALID_STATE" },
      },
    },
    {
      ...event,
      persistence: {
        state: "error",
        savedRevision: 0,
        diagnostic: { phase: "primary", code: "raw private error text" },
      },
    },
    {
      ...event,
      persistence: {
        state: "error",
        savedRevision: 0,
        diagnostic: { phase: "primary", code: "EIO", message: "private" },
      },
    },
  ])(
    "rejects event payload leakage and impossible persistence receipts",
    (input) => {
      expect(() => parsePersistedAtomUpdateEvent(input)).toThrow(
        "invalid persisted atom transport",
      );
    },
  );

  it("accepts sanitized save errors without requiring a send/Quit readiness gate", () => {
    const persistence = {
      state: "error",
      savedRevision: 0,
      diagnostic: { phase: "primary", code: "ENOSPC" },
    };
    expect(
      parsePersistedAtomReadResult({ ...read, persistence }),
    ).toMatchObject({
      outcome: "ready",
      data: { queryKind: "scope", view: { entry: draft } },
    });
    expect(
      parsePersistedAtomUpdateResult({
        ...update,
        persistence,
        changed: false,
      }),
    ).toMatchObject({ outcome: "applied", persistence });
  });

  it.each([
    { ...read, data: { queryKind: "scope", view: null } },
    { ...read, reason: "invalid_request" },
    {
      ...read,
      data: {
        queryKind: "scope",
        view: { scope: { ...home, kind: "cloud" }, entry: draft },
      },
    },
    { ...read, outcome: "invalid", data: { queryKind: "scope", view: null } },
    { ...read, outcome: "invalid", reason: "invalid_request" },
    {
      ...read,
      data: {
        queryKind: "scope",
        view: { scope: local, entry: { ...draft, sessionId: "thread-id" } },
      },
    },
    {
      ...read,
      data: {
        queryKind: "scope",
        view: { scope: home, entry: { ...draft, draft: { text: undefined } } },
      },
    },
    {
      ...read,
      data: {
        queryKind: "scope",
        view: { scope: home, entry: { ...draft, extra: true } },
      },
    },
  ])(
    "rejects malformed read state rather than using an empty fixture fallback",
    (input) => {
      expect(() => parsePersistedAtomReadResult(input)).toThrow(
        "invalid persisted atom transport",
      );
    },
  );

  it.each([
    { ...update, changed: "yes" },
    { ...update, entry: null },
    { ...update, reason: "invalid_payload" },
    { ...update, outcome: "conflict" },
    { ...update, outcome: "conflict", changed: false },
    { ...update, outcome: "invalid", reason: "invalid_payload" },
    { ...update, outcome: "unavailable", changed: true },
    { ...update, outcome: "unknown" },
  ])("rejects invalid update outcomes and changes", (input) => {
    expect(() => parsePersistedAtomUpdateResult(input)).toThrow(
      "invalid persisted atom transport",
    );
  });

  it("accepts payload-free consumption and rejects retained sent content", () => {
    const { draft: _draft, ...base } = draft;
    const consumed = {
      ...base,
      state: "consumed",
      consumption: "accepted",
      consumedAt: 2,
    };
    expect(
      parsePersistedAtomUpdateResult({ ...update, entry: consumed }),
    ).toMatchObject({ entry: consumed });
    expect(() =>
      parsePersistedAtomUpdateResult({
        ...update,
        entry: { ...consumed, draft: { text: "sent" } },
      }),
    ).toThrow();
    expect(() =>
      parsePersistedAtomReadResult({
        ...read,
        data: { queryKind: "scope", view: { scope: home, entry: consumed } },
      }),
    ).toThrow();
  });

  it("checks scope and accepted identity/version/state against the originating request", () => {
    const readRequest: PersistedAtomReadRequest = {
      key: "composer-drafts-v1",
      query: { kind: "scope", scope: home },
    };
    expect(parsePersistedAtomReadResult(read, readRequest)).toEqual(read);
    expect(() =>
      parsePersistedAtomReadResult(read, {
        ...readRequest,
        query: { kind: "scope", scope: { ...home, workspaceId: "other" } },
      }),
    ).toThrow();
    const request: PersistedAtomUpdateRequest = {
      key: "composer-drafts-v1",
      mutation: put(),
    };
    expect(parsePersistedAtomUpdateResult(update, request)).toEqual(update);
    expect(() =>
      parsePersistedAtomUpdateResult(
        { ...update, entry: { ...draft, draftId: "other" } },
        request,
      ),
    ).toThrow();
    expect(() =>
      parsePersistedAtomUpdateResult(
        { ...update, entry: { ...draft, scopeVersion: "old" } },
        request,
      ),
    ).toThrow();
    expect(() =>
      parsePersistedAtomUpdateResult(update, {
        key: "composer-drafts-v1",
        mutation: { op: "consume", identity },
      }),
    ).toThrow();
    const conflict = {
      ...update,
      outcome: "conflict",
      changed: false,
      reason: "version_conflict",
      entry: { ...draft, scopeVersion: "newer" },
    };
    expect(parsePersistedAtomUpdateResult(conflict, request)).toMatchObject({
      outcome: "conflict",
    });
  });

  it("does not execute malformed transport accessors or lose non-JSON content", () => {
    let called = false;
    const malicious = Object.defineProperty({}, "key", {
      enumerable: true,
      get() {
        called = true;
        return "composer-drafts-v1";
      },
    });
    for (const parse of [
      parsePersistedAtomReadResult,
      parsePersistedAtomUpdateResult,
      parsePersistedAtomUpdateEvent,
    ])
      expect(() => parse(malicious)).toThrow();
    expect(called).toBe(false);
    const payload = Object.defineProperty({}, "text", {
      enumerable: true,
      get() {
        called = true;
        return "secret";
      },
    });
    expect(() => assertPersistedDraftPayload(payload)).toThrow();
    expect(called).toBe(false);
    expect(() => assertPersistedDraftPayload({ text: BigInt(1) })).toThrow();
    const readContext = Object.defineProperty({}, "query", {
      enumerable: true,
      get() {
        called = true;
        return home;
      },
    });
    const updateContext = Object.defineProperty({}, "mutation", {
      enumerable: true,
      get() {
        called = true;
        return put();
      },
    });
    expect(() =>
      parsePersistedAtomReadResult(
        read,
        readContext as PersistedAtomReadRequest,
      ),
    ).toThrow();
    expect(() =>
      parsePersistedAtomUpdateResult(
        update,
        updateContext as PersistedAtomUpdateRequest,
      ),
    ).toThrow();
    expect(called).toBe(false);
  });

  it("parses actual Main owner lifecycle responses through put/promotion/metadata/consume and conflict", async () => {
    const { store } = await createStore();
    const readRequest: PersistedAtomReadRequest = {
      key: "composer-drafts-v1",
      query: { kind: "scope", scope: home },
    };
    expect(
      parsePersistedAtomReadResult(
        store.sendPersistedAtomState({ kind: "scope", scope: home }),
        readRequest,
      ),
    ).toMatchObject({ data: { queryKind: "scope", view: { entry: null } } });
    for (const mutation of [
      put(),
      promotion(),
      {
        ...promotion(local, local),
        expectedTarget: identity,
        threadId: "thread-canonical",
      },
      { op: "consume", identity },
    ] as const) {
      const request = { key: "composer-drafts-v1", mutation } as const;
      expect(
        parsePersistedAtomUpdateResult(
          store.updatePersistedAtomState(mutation),
          request,
        ).outcome,
      ).toBe("applied");
      expect(
        parsePersistedAtomUpdateEvent({
          ...store.metadata(),
          event: "persisted-atom-update",
        }).storeRevision,
      ).toBe(store.metadata().storeRevision);
    }
    expect(
      parsePersistedAtomUpdateResult(store.updatePersistedAtomState(put()), {
        key: "composer-drafts-v1",
        mutation: put(),
      }),
    ).toMatchObject({ outcome: "conflict", reason: "retired_draft" });
    await store.flush();
    expect(
      parsePersistedAtomReadResult(
        store.sendPersistedAtomState({ kind: "scope", scope: local }),
        {
          key: "composer-drafts-v1",
          query: { kind: "scope", scope: local },
        },
      ),
    ).toMatchObject({
      data: { queryKind: "scope", view: { entry: null } },
      persistence: { state: "saved", savedRevision: 4 },
    });
  });
});
