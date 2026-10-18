import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import type {
  PersistedAtomReadRequest,
  PersistedAtomUpdateRequest,
} from "@/lib/api/persistedAtomTypes";
import {
  PERSISTED_ATOM_UPDATE_EVENT,
  PersistedAtomBridgeError,
  listenPersistedAtomUpdates,
  sendPersistedAtomState,
  updatePersistedAtomState,
} from "./persistedAtoms";

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));

const scope = {
  workspaceId: "workspace",
  kind: "home",
  id: "new-conversation",
} as const;
const metadata = {
  key: "composer-drafts-v1",
  storeRevision: 3,
  persistence: { state: "saved", savedRevision: 3 },
} as const;
const readRequest: PersistedAtomReadRequest = {
  key: metadata.key,
  query: { kind: "scope", scope },
};
const updateRequest: PersistedAtomUpdateRequest = {
  key: metadata.key,
  mutation: {
    op: "put",
    scope,
    draftId: "draft",
    expectedVersion: "v1",
    nextVersion: "v2",
    draft: { text: "private draft 中😀" },
  },
};
const entry = {
  draftId: "draft",
  scopeVersion: "v2",
  originScopeKey: JSON.stringify([scope.workspaceId, scope.kind, scope.id]),
  updatedAt: 100,
  state: "draft",
  draft: { text: "private draft 中😀" },
} as const;
const readResult = () => ({
  ...metadata,
  outcome: "ready",
  data: { queryKind: "scope", view: { scope, entry } },
});
const updateResult = () => ({
  ...metadata,
  outcome: "applied",
  changed: true,
  entry,
});
const updateEvent = () => ({ ...metadata, event: PERSISTED_ATOM_UPDATE_EVENT });

describe("persisted atom typed gateway (explicit fake bridge unit evidence)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(safeListen).mockResolvedValue(vi.fn());
  });

  it("uses the real safeInvoke command boundary with direct read args", async () => {
    vi.mocked(safeInvoke).mockResolvedValue(readResult());
    await expect(sendPersistedAtomState(readRequest)).resolves.toEqual(
      readResult(),
    );
    expect(safeInvoke).toHaveBeenCalledExactlyOnceWith(
      "persisted_atom_read",
      readRequest,
    );
  });

  it("carries the supported Summary boolean through the same typed read/update gateway", async () => {
    const key = "app-shell-summary-panel-pinned";
    const read = { key, query: { kind: "value" } } as const;
    const update = { key, mutation: { op: "set", value: false } } as const;
    const meta = {
      key,
      storeRevision: 4,
      persistence: { state: "saved", savedRevision: 4 },
    };
    vi.mocked(safeInvoke).mockResolvedValueOnce({
      ...meta,
      outcome: "ready",
      data: { queryKind: "value", value: true },
    });
    await expect(sendPersistedAtomState(read)).resolves.toMatchObject({
      data: { value: true },
    });
    vi.mocked(safeInvoke).mockResolvedValueOnce({
      ...meta,
      outcome: "applied",
      changed: true,
      entry: null,
      value: false,
    });
    await expect(updatePersistedAtomState(update)).resolves.toMatchObject({
      value: false,
    });
    expect(safeInvoke).toHaveBeenNthCalledWith(1, "persisted_atom_read", read);
    expect(safeInvoke).toHaveBeenNthCalledWith(
      2,
      "persisted_atom_update",
      update,
    );
  });

  it("sends a conditional mutation rather than a replacement atom", async () => {
    vi.mocked(safeInvoke).mockResolvedValue(updateResult());
    await expect(updatePersistedAtomState(updateRequest)).resolves.toEqual(
      updateResult(),
    );
    expect(safeInvoke).toHaveBeenCalledExactlyOnceWith(
      "persisted_atom_update",
      updateRequest,
    );
  });

  it.each([
    null,
    undefined,
    [],
    {},
    { success: true },
    { diagnostic: { source: "electron-host-diagnostic" } },
  ])("rejects non-protocol read receipt %j", async (response) => {
    vi.mocked(safeInvoke).mockResolvedValue(response);
    await expect(sendPersistedAtomState(readRequest)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([
    { ...readResult(), key: "unknown" },
    { ...readResult(), storeRevision: -1 },
    { ...readResult(), persistence: { state: "saved", savedRevision: 4 } },
    {
      ...readResult(),
      data: {
        queryKind: "scope",
        view: { scope: { ...scope, workspaceId: "other" }, entry },
      },
    },
    {
      ...readResult(),
      data: {
        queryKind: "scope",
        view: { scope, entry: { ...entry, draft: undefined } },
      },
    },
    {
      ...readResult(),
      data: {
        queryKind: "scope",
        view: {
          scope,
          entry: {
            ...entry,
            state: "consumed",
            consumption: "accepted",
            consumedAt: 100,
          },
        },
      },
    },
  ])("rejects malformed or foreign read receipt", async (response) => {
    vi.mocked(safeInvoke).mockResolvedValue(response);
    await expect(sendPersistedAtomState(readRequest)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([
    { ...updateResult(), changed: "yes" },
    { ...updateResult(), outcome: "conflict", reason: "version_conflict" },
    { ...updateResult(), entry: { ...entry, draftId: "other" } },
    { ...updateResult(), entry: { ...entry, scopeVersion: "old" } },
    { ...updateResult(), entry: null },
    { ...updateResult(), payload: "unexpected" },
  ])("rejects malformed or mismatched mutation receipt", async (response) => {
    vi.mocked(safeInvoke).mockResolvedValue(response);
    await expect(updatePersistedAtomState(updateRequest)).rejects.toMatchObject(
      { code: "invalid_response" },
    );
  });

  it("preserves valid conflict and unavailable states without fake saved success", async () => {
    const conflict = {
      ...metadata,
      outcome: "conflict",
      changed: false,
      reason: "version_conflict",
      entry,
    };
    const unavailable = {
      ...metadata,
      persistence: {
        state: "unavailable",
        savedRevision: null,
        diagnostic: { phase: "load", code: "INVALID_STATE" },
      },
      outcome: "unavailable",
      data: null,
    };
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce(conflict)
      .mockResolvedValueOnce(unavailable);
    await expect(updatePersistedAtomState(updateRequest)).resolves.toEqual(
      conflict,
    );
    await expect(sendPersistedAtomState(readRequest)).resolves.toEqual(
      unavailable,
    );
  });

  it.each(["read", "update"])(
    "exposes %s transport failure without the echoed draft or cause",
    async (mode) => {
      const failure = new Error("private draft 中😀 transport failed");
      vi.mocked(safeInvoke).mockRejectedValue(failure);
      const promise =
        mode === "read"
          ? sendPersistedAtomState(readRequest)
          : updatePersistedAtomState(updateRequest);
      const error = await promise.catch((value: unknown) => value);
      expect(error).toBeInstanceOf(PersistedAtomBridgeError);
      expect(error).toMatchObject({ code: "unavailable" });
      expect(String(error)).not.toContain("private draft");
      expect(error).not.toHaveProperty("cause");
      expect(safeInvoke).toHaveBeenCalledTimes(1);
    },
  );

  it("delivers only a strict metadata event and returns the actual unsubscribe", async () => {
    const unsubscribe = vi.fn();
    vi.mocked(safeListen).mockResolvedValue(unsubscribe);
    const handler = vi.fn();
    await expect(listenPersistedAtomUpdates(handler)).resolves.toBe(
      unsubscribe,
    );
    expect(safeListen).toHaveBeenCalledWith(
      PERSISTED_ATOM_UPDATE_EVENT,
      expect.any(Function),
    );
    const receive = vi.mocked(safeListen).mock.calls[0][1];
    receive({ payload: updateEvent() });
    expect(handler).toHaveBeenCalledExactlyOnceWith(updateEvent());
  });

  it.each([
    null,
    {},
    { ...updateEvent(), event: "other" },
    { ...updateEvent(), entry },
    { ...updateEvent(), draft: entry.draft },
    { ...updateEvent(), storeRevision: NaN },
    { ...updateEvent(), persistence: { state: "saved", savedRevision: 99 } },
  ])(
    "drops malformed or content-bearing event without publishing it",
    async (payload) => {
      const handler = vi.fn();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      await listenPersistedAtomUpdates(handler);
      vi.mocked(safeListen).mock.calls[0][1]({ payload });
      expect(handler).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      warn.mockRestore();
      error.mockRestore();
    },
  );

  it("does not swallow errors from a subscriber handling a valid event", async () => {
    const failure = new Error("subscriber failed");
    await listenPersistedAtomUpdates(() => {
      throw failure;
    });
    expect(() =>
      vi.mocked(safeListen).mock.calls[0][1]({ payload: updateEvent() }),
    ).toThrow(failure);
  });

  it("rejects native listener failure with a fixed unavailable error", async () => {
    vi.mocked(safeListen).mockRejectedValue(
      new Error("private draft listener error"),
    );
    await expect(listenPersistedAtomUpdates(vi.fn())).rejects.toMatchObject({
      code: "unavailable",
      message: "Desktop persisted atom bridge unavailable",
    });
  });
});

const indexRequest = (
  workspaceId: string | null,
): PersistedAtomReadRequest => ({
  key: metadata.key,
  query: { kind: "workspace-index", workspaceId },
});
const indexItem = (workspaceId: string | null = scope.workspaceId) => ({
  scope: { ...scope, workspaceId, kind: "draft" },
  identity: { draftId: "draft", scopeVersion: "v2" },
  updatedAt: 100,
});
const indexResult = (workspaceId: string | null = scope.workspaceId) => ({
  ...metadata,
  outcome: "ready",
  data: {
    queryKind: "workspace-index",
    workspaceId,
    items: [indexItem(workspaceId)],
  },
});

describe("same-atom scope and workspace discovery through the shared parser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each(["workspace", null])(
    "preserves the exact index query including %s",
    async (workspaceId) => {
      const request = indexRequest(workspaceId);
      const response = indexResult(workspaceId);
      vi.mocked(safeInvoke).mockResolvedValue(response);
      await expect(sendPersistedAtomState(request)).resolves.toEqual(response);
      expect(safeInvoke).toHaveBeenCalledExactlyOnceWith(
        "persisted_atom_read",
        request,
      );
    },
  );

  it.each([
    { ...indexResult(), data: { ...indexResult().data, workspaceId: "other" } },
    { ...indexResult(), data: { ...indexResult().data, workspaceId: null } },
    {
      ...indexResult(),
      data: { ...indexResult().data, items: [indexItem("other")] },
    },
    {
      ...indexResult(),
      data: { ...indexResult().data, items: [indexItem(null)] },
    },
    {
      ...indexResult(),
      data: {
        ...indexResult().data,
        items: [
          indexItem(),
          {
            ...indexItem(),
            identity: { draftId: "second", scopeVersion: "v1" },
          },
        ],
      },
    },
    {
      ...indexResult(),
      data: {
        ...indexResult().data,
        items: [
          indexItem(),
          { ...indexItem(), scope: { ...indexItem().scope, id: "other" } },
        ],
      },
    },
    {
      ...indexResult(),
      data: {
        ...indexResult().data,
        items: [{ ...indexItem(), draft: entry.draft }],
      },
    },
    {
      ...indexResult(),
      data: {
        ...indexResult().data,
        items: [{ ...indexItem(), title: "private title" }],
      },
    },
    {
      ...indexResult(),
      data: {
        ...indexResult().data,
        items: [{ ...indexItem(), updatedAt: -1 }],
      },
    },
    {
      ...indexResult(),
      data: {
        ...indexResult().data,
        items: [
          { ...indexItem(), identity: { draftId: "draft", scopeVersion: "" } },
        ],
      },
    },
    {
      ...indexResult(),
      data: { ...indexResult().data, items: [indexItem()], attachments: [] },
    },
    { ...indexResult(), view: { scope, entry } },
    readResult(),
  ])(
    "rejects foreign, duplicate or content-bearing index receipts",
    async (response) => {
      vi.mocked(safeInvoke).mockResolvedValue(response);
      await expect(
        sendPersistedAtomState(indexRequest("workspace")),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("rejects index data for a scope read and the removed top-level view", async () => {
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce(indexResult())
      .mockResolvedValueOnce({
        ...metadata,
        outcome: "ready",
        view: { scope, entry },
      });
    await expect(sendPersistedAtomState(readRequest)).rejects.toMatchObject({
      code: "invalid_response",
    });
    await expect(sendPersistedAtomState(readRequest)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([readRequest, indexRequest("workspace"), indexRequest(null)])(
    "keeps loading data null without inventing an empty result",
    async (request) => {
      const response = {
        ...metadata,
        persistence: { state: "loading", savedRevision: null },
        outcome: "unavailable",
        data: null,
      };
      vi.mocked(safeInvoke).mockResolvedValue(response);
      await expect(sendPersistedAtomState(request)).resolves.toEqual(response);
    },
  );

  it.each([
    { key: metadata.key, scope },
    { key: metadata.key, query: { kind: "scope", scope }, scope },
    { key: metadata.key, query: { kind: "workspace-index" } },
    {
      key: metadata.key,
      query: { kind: "workspace-index", workspaceId: null, scope },
    },
    { key: metadata.key, query: { kind: "workspace-index", workspaceId: 1 } },
    {
      key: metadata.key,
      query: { kind: "scope", scope: { ...scope, path: "/private" } },
    },
    { key: "other", query: { kind: "workspace-index", workspaceId: null } },
  ])(
    "rejects invalid read requests before any bridge call",
    async (request) => {
      await expect(
        sendPersistedAtomState(request as unknown as PersistedAtomReadRequest),
      ).rejects.toMatchObject({
        code: "invalid_request",
        message: "Desktop persisted atom request invalid",
      });
      expect(safeInvoke).not.toHaveBeenCalled();
    },
  );

  it("does not execute a query getter or leak its contents", async () => {
    const getter = vi.fn(() => {
      throw new Error("private request");
    });
    const request = Object.defineProperty({ key: metadata.key }, "query", {
      enumerable: true,
      get: getter,
    });
    const error = await sendPersistedAtomState(
      request as PersistedAtomReadRequest,
    ).catch((value: unknown) => value);
    expect(error).toMatchObject({ code: "invalid_request" });
    expect(String(error)).not.toContain("private request");
    expect(getter).not.toHaveBeenCalled();
    expect(safeInvoke).not.toHaveBeenCalled();
  });

  it("correlates an awaited reply to the detached original query", async () => {
    const request = {
      key: metadata.key,
      query: { kind: "workspace-index" as const, workspaceId: "workspace" },
    };
    let reply!: (value: unknown) => void;
    vi.mocked(safeInvoke).mockImplementation(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        }),
    );
    const pending = sendPersistedAtomState(request);
    request.query.workspaceId = "other";
    expect(vi.mocked(safeInvoke).mock.calls[0][1]).toEqual(
      indexRequest("workspace"),
    );
    reply(indexResult("workspace"));
    await expect(pending).resolves.toEqual(indexResult("workspace"));
  });
});
