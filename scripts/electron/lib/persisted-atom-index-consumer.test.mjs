import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parsePersistedAtomReadRequest,
  parsePersistedAtomReadResult,
  parsePersistedAtomUpdateEvent,
  parsePersistedAtomUpdateResult,
} from "@/lib/api/persistedAtomProtocol";
import { observePersistedAtomCommand } from "./persisted-atom-fixture.mjs";

const protocol = {
  parseReadRequest: parsePersistedAtomReadRequest,
  parseReadResult: parsePersistedAtomReadResult,
  parseUpdateResult: parsePersistedAtomUpdateResult,
  parseUpdateEvent: parsePersistedAtomUpdateEvent,
};
const key = "composer-drafts-v1";
const metadata = {
  key,
  storeRevision: 4,
  persistence: { state: "saved", savedRevision: 4 },
};
const scope = { workspaceId: "workspace", kind: "draft", id: "draft-tab" };
const item = {
  scope,
  identity: { draftId: "draft", scopeVersion: "v1" },
  updatedAt: 100,
};
const scopeRequest = { key, query: { kind: "scope", scope } };
const indexRequest = {
  key,
  query: { kind: "workspace-index", workspaceId: "workspace" },
};
const scopeResponse = {
  ...metadata,
  outcome: "ready",
  data: { queryKind: "scope", view: { scope, entry: null } },
};
const indexResponse = {
  ...metadata,
  outcome: "ready",
  data: {
    queryKind: "workspace-index",
    workspaceId: "workspace",
    items: [item],
  },
};

function publicBridge(response) {
  const remove = vi.fn();
  const api = {
    devBridgeFallback: false,
    supportsCommand: vi.fn(() => true),
    invoke: vi.fn(async () => response),
    listen: vi.fn(() => remove),
    emit: vi.fn(),
    send: vi.fn(),
  };
  vi.stubGlobal("window", { __LIME_ELECTRON__: true, electronAPI: api });
  const page = { evaluate: vi.fn((callback, args) => callback(args)) };
  return { page, api, remove };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("index consumer public IPC contract (fake native surface; real shared parsers)", () => {
  it.each([
    [scopeRequest, scopeResponse],
    [indexRequest, indexResponse],
    [
      { key, query: { kind: "workspace-index", workspaceId: null } },
      {
        ...indexResponse,
        data: { queryKind: "workspace-index", workspaceId: null, items: [] },
      },
    ],
  ])(
    "uses only public invoke/listen with the exact discriminated query",
    async (request, response) => {
      const { page, api, remove } = publicBridge(response);
      await expect(
        observePersistedAtomCommand(
          page,
          protocol,
          "persisted_atom_read",
          request,
        ),
      ).resolves.toEqual({ result: response, events: [] });
      expect(api.invoke).toHaveBeenCalledExactlyOnceWith(
        "persisted_atom_read",
        request,
      );
      expect(api.listen).toHaveBeenCalledExactlyOnceWith(
        "persisted-atom-update",
        expect.any(Function),
      );
      expect(api.emit).not.toHaveBeenCalled();
      expect(api.send).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { ...metadata, outcome: "ready", view: { scope, entry: null } },
    scopeResponse,
    { ...indexResponse, data: { ...indexResponse.data, workspaceId: null } },
    { ...indexResponse, data: { ...indexResponse.data, workspaceId: "other" } },
    {
      ...indexResponse,
      data: {
        ...indexResponse.data,
        items: [{ ...item, scope: { ...scope, workspaceId: "other" } }],
      },
    },
    {
      ...indexResponse,
      data: {
        ...indexResponse.data,
        items: [
          item,
          { ...item, identity: { draftId: "other", scopeVersion: "v2" } },
        ],
      },
    },
    {
      ...indexResponse,
      data: {
        ...indexResponse.data,
        items: [item, { ...item, scope: { ...scope, id: "other" } }],
      },
    },
    {
      ...indexResponse,
      data: {
        ...indexResponse.data,
        items: [{ ...item, draft: { text: "private content" } }],
      },
    },
    {
      ...indexResponse,
      data: {
        ...indexResponse.data,
        items: [{ ...item, title: "private title" }],
      },
    },
  ])(
    "rejects legacy, uncorrelated or body-bearing receipts after public IPC",
    async (response) => {
      const { page, api, remove } = publicBridge(response);
      await expect(
        observePersistedAtomCommand(
          page,
          protocol,
          "persisted_atom_read",
          indexRequest,
        ),
      ).rejects.toThrow("strict response protocol");
      expect(api.invoke).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { key, scope },
    { key, query: { kind: "workspace-index" } },
    {
      key,
      query: { kind: "workspace-index", workspaceId: "workspace", scope },
    },
    { key, query: { kind: "scope", scope: { ...scope, route: "/private" } } },
  ])(
    "rejects invalid read query before evaluating any browser surface",
    async (request) => {
      const { page, api } = publicBridge(indexResponse);
      await expect(
        observePersistedAtomCommand(
          page,
          protocol,
          "persisted_atom_read",
          request,
        ),
      ).rejects.toThrow("strict read request protocol");
      expect(page.evaluate).not.toHaveBeenCalled();
      expect(api.invoke).not.toHaveBeenCalled();
    },
  );

  it.each([scopeRequest, indexRequest])(
    "preserves unavailable data as null",
    async (request) => {
      const response = {
        ...metadata,
        persistence: { state: "loading", savedRevision: null },
        outcome: "unavailable",
        data: null,
      };
      const { page } = publicBridge(response);
      await expect(
        observePersistedAtomCommand(
          page,
          protocol,
          "persisted_atom_read",
          request,
        ),
      ).resolves.toEqual({ result: response, events: [] });
    },
  );

  it("rejects an accessor without executing it or exposing its error", async () => {
    const get = vi.fn(() => {
      throw new Error("private content");
    });
    const request = Object.defineProperty({ key }, "query", {
      enumerable: true,
      get,
    });
    const { page } = publicBridge(indexResponse);
    const error = await observePersistedAtomCommand(
      page,
      protocol,
      "persisted_atom_read",
      request,
    ).catch((value) => value);
    expect(String(error)).toContain("strict read request protocol");
    expect(String(error)).not.toContain("private content");
    expect(get).not.toHaveBeenCalled();
    expect(page.evaluate).not.toHaveBeenCalled();
  });
});
