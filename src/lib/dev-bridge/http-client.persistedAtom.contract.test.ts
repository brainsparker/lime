import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/desktop-runtime", () => ({
  hasDesktopHostInvokeCapability: () => false,
  hasDesktopHostRuntimeMarkers: () => false,
}));
import {
  __resetDevBridgeHttpStateForTests,
  invokeViaHttp,
} from "./http-client";

const privateText = "PRIVATE_HTTP_DRAFT_中😀";
const args = {
  key: "composer-drafts-v1",
  mutation: { op: "put", draft: { text: privateText } },
};
function healthy() {
  return new Response(
    JSON.stringify({ status: "ok", transport: "electron-host" }),
    { status: 200 },
  );
}

describe("persisted atom HTTP diagnostic privacy", () => {
  beforeEach(() => {
    __resetDevBridgeHttpStateForTests();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    __resetDevBridgeHttpStateForTests();
  });

  it.each([
    {
      kind: "scope",
      scope: { workspaceId: privateText, kind: "draft", id: privateText },
    },
    { kind: "workspace-index", workspaceId: privateText },
    { kind: "workspace-index", workspaceId: null },
  ])(
    "preserves the read query/data without logging scope or workspace content",
    async (query) => {
      const request = { key: "composer-drafts-v1", query };
      const response = {
        key: "composer-drafts-v1",
        storeRevision: 0,
        persistence: { state: "saved", savedRevision: 0 },
        outcome: "ready",
        data:
          query.kind === "scope"
            ? { queryKind: "scope", view: { scope: query.scope, entry: null } }
            : {
                queryKind: "workspace-index",
                workspaceId: query.workspaceId,
                items: [],
              },
      };
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(healthy())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ result: response }), { status: 200 }),
        );
      vi.stubGlobal("fetch", fetch);
      await expect(
        invokeViaHttp("persisted_atom_read", request),
      ).resolves.toEqual(response);
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
        cmd: "persisted_atom_read",
        args: request,
      });
      expect(console.log).toHaveBeenCalledWith(
        "[DevBridge] HTTP 调用: persisted_atom_read",
        { key: "composer-drafts-v1" },
      );
      expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(
        privateText,
      );
    },
  );

  it("keeps the real wire payload and logs only fixed metadata", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(healthy())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { outcome: "applied" } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(invokeViaHttp("persisted_atom_update", args)).resolves.toEqual(
      { outcome: "applied" },
    );
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      cmd: "persisted_atom_update",
      args,
    });
    expect(console.log).toHaveBeenCalledWith(
      "[DevBridge] HTTP 调用: persisted_atom_update",
      { key: "composer-drafts-v1", op: "put" },
    );
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(
      privateText,
    );
  });

  it("does not echo rejected draft content to HTTP console diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(healthy())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: privateText }), { status: 200 }),
        ),
    );
    await expect(invokeViaHttp("persisted_atom_update", args)).rejects.toThrow(
      privateText,
    );
    const messages = [
      ...vi.mocked(console.log).mock.calls,
      ...vi.mocked(console.debug).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ];
    expect(
      messages
        .flat()
        .map((value) =>
          value instanceof Error ? value.message : JSON.stringify(value),
        )
        .join("\n"),
    ).not.toContain(privateText);
    expect(console.error).toHaveBeenCalledWith(
      "[DevBridge] HTTP 调用失败: persisted_atom_update",
      "Persisted atom IPC request failed",
    );
  });

  it("preserves existing console arguments for other commands", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(healthy())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ result: [] }), { status: 200 }),
        ),
    );
    const request = { workspaceId: "workspace-1" };
    await invokeViaHttp("workspace_list", request);
    expect(vi.mocked(console.log).mock.calls[0][1]).toBe(request);
  });
});
