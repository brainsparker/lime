import { describe, expect, it } from "vitest";
import {
  PERSISTED_ATOM_LIMITS,
  parsePersistedAtomReadQuery,
  parsePersistedAtomReadRequest,
  parsePersistedAtomReadResult,
} from "./persistedAtomProtocol";
import type { PersistedAtomReadRequest } from "./persistedAtomTypes";

const scope = { workspaceId: "w", kind: "draft", id: "tab-1" } as const;
const item = {
  scope,
  identity: { draftId: "d1", scopeVersion: "v1" },
  updatedAt: 1,
} as const;
const request = {
  key: "composer-drafts-v1",
  query: { kind: "workspace-index", workspaceId: "w" },
} as const;
const metadata = {
  key: "composer-drafts-v1",
  storeRevision: 3,
  persistence: { state: "saved", savedRevision: 3 },
} as const;
const index = {
  ...metadata,
  outcome: "ready",
  data: { queryKind: "workspace-index", workspaceId: "w", items: [item] },
} as const;

describe("strict workspace draft discovery transport", () => {
  it("shares one exact read request/query validator for Host and consumers", () => {
    expect(parsePersistedAtomReadRequest(request)).toEqual(request);
    expect(parsePersistedAtomReadQuery(request.query)).toEqual(request.query);
    const scopeRequest = {
      key: request.key,
      query: { kind: "scope", scope },
    } as const;
    expect(parsePersistedAtomReadRequest(scopeRequest)).toEqual(scopeRequest);
    expect(
      parsePersistedAtomReadRequest({
        ...request,
        query: { kind: "workspace-index", workspaceId: null },
      }),
    ).toMatchObject({ query: { workspaceId: null } });
  });

  it.each([
    { key: request.key, scope },
    { ...request, key: "other" },
    { ...request, path: "/tmp/arbitrary.json" },
    { ...request, query: null },
    { ...request, query: { kind: "workspace-index" } },
    { ...request, query: { kind: "workspace-index", workspaceId: 1 } },
    { ...request, query: { kind: "workspace-index", workspaceId: "" } },
    { ...request, query: { kind: "workspace-index", workspaceId: "a\u0000b" } },
    {
      ...request,
      query: { kind: "workspace-index", workspaceId: "x".repeat(4_097) },
    },
    { ...request, query: { kind: "workspace-index", workspaceId: "w", scope } },
    { ...request, query: { kind: "scope", scope, workspaceId: "w" } },
    {
      ...request,
      query: { kind: "scope", scope: { ...scope, path: "secret" } },
    },
    {
      ...request,
      query: { kind: "scope", scope: { ...scope, kind: "remote" } },
    },
    { ...request, query: { kind: "other", workspaceId: "w" } },
  ])(
    "rejects old scope-only requests, unknown fields and invalid namespaces",
    (input) => {
      expect(() => parsePersistedAtomReadRequest(input)).toThrow(
        "invalid persisted atom transport",
      );
    },
  );

  it("accepts complete metadata-only discovery, null namespace and an empty index", () => {
    expect(parsePersistedAtomReadResult(index, request)).toEqual(index);
    const empty = {
      ...index,
      data: { ...index.data, workspaceId: null, items: [] },
    };
    expect(
      parsePersistedAtomReadResult(empty, {
        ...request,
        query: { kind: "workspace-index", workspaceId: null },
      }),
    ).toEqual(empty);
    const local = {
      ...item,
      scope: { workspaceId: "w", kind: "local", id: "session" },
      sessionId: "session",
      threadId: "canonical-thread",
    };
    expect(
      parsePersistedAtomReadResult(
        { ...index, data: { ...index.data, items: [local] } },
        request,
      ),
    ).toMatchObject({ data: { items: [local] } });
  });

  it("correlates queryKind and exact request scope/workspace including null", () => {
    const response = {
      ...metadata,
      outcome: "ready",
      data: { queryKind: "scope", view: { scope, entry: null } },
    };
    const scopeRequest = {
      key: request.key,
      query: { kind: "scope", scope },
    } as const;
    expect(parsePersistedAtomReadResult(response, scopeRequest)).toEqual(
      response,
    );
    expect(() => parsePersistedAtomReadResult(response, request)).toThrow();
    expect(() => parsePersistedAtomReadResult(index, scopeRequest)).toThrow();
    for (const workspaceId of [null, "other"])
      expect(() =>
        parsePersistedAtomReadResult(index, {
          ...request,
          query: { kind: "workspace-index", workspaceId },
        }),
      ).toThrow();
    for (const changed of [
      { ...scope, workspaceId: null },
      { ...scope, kind: "local" as const },
      { ...scope, id: "other" },
    ])
      expect(() =>
        parsePersistedAtomReadResult(response, {
          ...scopeRequest,
          query: { kind: "scope", scope: changed },
        }),
      ).toThrow();
    for (const invalid of [null, false, { key: request.key, scope }])
      expect(() =>
        parsePersistedAtomReadResult(
          index,
          invalid as unknown as PersistedAtomReadRequest,
        ),
      ).toThrow();
  });

  it.each([
    { ...index, view: { scope, entry: null } },
    { ...index, data: null },
    { ...index, data: { ...index.data, queryKind: "unknown" } },
    { ...index, data: { ...index.data, view: { scope, entry: null } } },
    { ...index, data: { ...index.data, title: "private" } },
    { ...index, data: { ...index.data, workspaceId: "other" } },
    {
      ...index,
      data: {
        ...index.data,
        items: [{ ...item, scope: { ...scope, workspaceId: null } }],
      },
    },
    {
      ...index,
      data: {
        ...index.data,
        items: [{ ...item, scope: { ...scope, workspaceId: "other" } }],
      },
    },
    {
      ...index,
      data: {
        ...index.data,
        items: [{ ...item, scope: { ...scope, kind: "home" } }],
      },
    },
    {
      ...index,
      data: {
        ...index.data,
        items: [{ ...item, identity: { ...item.identity, scopeVersion: "" } }],
      },
    },
    {
      ...index,
      data: {
        ...index.data,
        items: [{ ...item, identity: { ...item.identity, extra: true } }],
      },
    },
    { ...index, data: { ...index.data, items: [{ ...item, updatedAt: -1 }] } },
    { ...index, data: { ...index.data, items: [{ ...item, updatedAt: NaN }] } },
    { ...index, data: { ...index.data, items: [{ ...item, sessionId: "" }] } },
    { ...index, data: { ...index.data, items: [{ ...item, threadId: 7 }] } },
    {
      ...index,
      data: {
        ...index.data,
        items: [{ ...item, scope: { ...scope, kind: "local", id: "session" } }],
      },
    },
    {
      ...index,
      data: {
        ...index.data,
        items: [
          {
            ...item,
            scope: { ...scope, kind: "local", id: "session" },
            sessionId: "thread-id",
          },
        ],
      },
    },
    { ...index, data: { ...index.data, items: [item, item] } },
    {
      ...index,
      data: {
        ...index.data,
        items: [
          item,
          { ...item, identity: { draftId: "other", scopeVersion: "v1" } },
        ],
      },
    },
    {
      ...index,
      data: {
        ...index.data,
        items: [
          item,
          {
            ...item,
            scope: { ...scope, id: "tab-2" },
            identity: { ...item.identity, scopeVersion: "v2" },
          },
        ],
      },
    },
    {
      ...index,
      data: {
        ...index.data,
        items: [item, { ...item, scope: { ...scope, id: "tab-2" } }],
      },
    },
    { ...index, data: { ...index.data, items: {} } },
    {
      ...index,
      data: {
        ...index.data,
        items: Array(PERSISTED_ATOM_LIMITS.maxBindings + 1).fill(item),
      },
    },
    { ...index, storeRevision: -1 },
    { ...index, persistence: { state: "saved", savedRevision: 2 } },
    { ...index, persistence: { state: "loading", savedRevision: null } },
    { ...index, persistence: { state: "pending", savedRevision: 4 } },
    { ...index, reason: "invalid_request" },
    { ...index, outcome: "invalid", reason: "invalid_request" },
    { ...index, outcome: "unavailable" },
  ])(
    "rejects malformed, mismatched, duplicate or impossible discovery projections",
    (input) => {
      expect(() => parsePersistedAtomReadResult(input, request)).toThrow(
        "invalid persisted atom transport",
      );
    },
  );

  it.each([
    "draft",
    "entry",
    "title",
    "editorDocument",
    "attachments",
    "media",
    "inputCapabilityRoute",
    "originScopeKey",
    "state",
  ])("rejects content or extra item field %s", (field) => {
    const input = {
      ...index,
      data: { ...index.data, items: [{ ...item, [field]: "private" }] },
    };
    expect(() => parsePersistedAtomReadResult(input, request)).toThrow();
  });

  it("distinguishes invalid/unavailable data=null from ready empty discovery", () => {
    const invalid = {
      ...metadata,
      outcome: "invalid",
      reason: "invalid_request",
      data: null,
    };
    const unavailable = {
      ...metadata,
      outcome: "unavailable",
      reason: "closed",
      data: null,
    };
    expect(parsePersistedAtomReadResult(invalid, request)).toEqual(invalid);
    expect(parsePersistedAtomReadResult(unavailable, request)).toEqual(
      unavailable,
    );
    expect(() =>
      parsePersistedAtomReadResult({ ...invalid, reason: undefined }, request),
    ).toThrow();
    expect(() =>
      parsePersistedAtomReadResult(
        { ...metadata, outcome: "ready", view: null },
        request,
      ),
    ).toThrow();
  });

  it("rejects request/query/item/array accessors, sparse arrays, symbols and hidden fields without executing getters", () => {
    let called = 0;
    const accessor = (field: string) =>
      Object.defineProperty({}, field, {
        enumerable: true,
        get() {
          called += 1;
          return "private";
        },
      });
    for (const input of [
      accessor("query"),
      { ...request, query: accessor("workspaceId") },
      { ...request, query: { kind: "scope", scope: accessor("id") } },
      { ...request, [Symbol("private")]: "value" },
      Object.defineProperty({ ...request }, "hidden", { value: "private" }),
    ])
      expect(() => parsePersistedAtomReadRequest(input)).toThrow();
    const getItem = Object.defineProperty([], "0", {
      enumerable: true,
      get() {
        called += 1;
        return item;
      },
    });
    const hidden = Object.defineProperty([item], "hidden", {
      value: "private",
    });
    const symbol = Object.assign([item], { [Symbol("private")]: "private" });
    for (const items of [
      [accessor("identity")],
      getItem,
      Array(1),
      hidden,
      symbol,
    ])
      expect(() =>
        parsePersistedAtomReadResult(
          { ...index, data: { ...index.data, items } },
          request,
        ),
      ).toThrow();
    expect(called).toBe(0);
  });
});
