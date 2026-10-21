import { beforeEach, expect, it, vi } from "vitest";
import { createBrowserWorkspaceLinkTab } from "./browserWorkspace";

const host = vi.hoisted(() => ({
  request: vi.fn(),
  consume: vi.fn(),
  mount: vi.fn(),
  close: vi.fn(),
}));
vi.mock("./workspaceRightSurface", () => ({
  requestWorkspaceRightSurface: host.request,
  consumeWorkspaceRightSurfacePending: host.consume,
}));
vi.mock("./browserTab", () => ({
  mountBrowserTab: host.mount,
  closeBrowserTab: host.close,
}));

const owner = {
  runtimeSessionId: "canonical-session",
  threadId: "canonical-thread",
};
beforeEach(() => {
  vi.resetAllMocks();
  host.request.mockImplementation(async (params) => {
    const action = params.metadata.browser.action;
    return {
      requestId: `request-${action}`,
      pending: {
        metadata: {
          browser: {
            browserSessionId: "canonical-browser",
            tabId: action === "open" ? "primary" : "canonical-new",
          },
        },
      },
    };
  });
  host.mount.mockImplementation(async (params) => params);
});

it.each([true, false])(
  "mounts a new link from the canonical identity owner, background=%s",
  async (background) => {
    const result = await createBrowserWorkspaceLinkTab({
      owner,
      url: "http://localhost:4000/a",
      background,
      isCurrent: () => true,
    });
    expect(result).toEqual({
      browserSessionId: "canonical-browser",
      tabId: "canonical-new",
    });
    expect(
      host.request.mock.calls.map(([params]) => params.metadata.browser.action),
    ).toEqual(["open", "createTab"]);
    expect(host.request.mock.calls[1][0]).toMatchObject({
      sessionId: owner.runtimeSessionId,
      metadata: {
        browser: {
          threadId: owner.threadId,
          browserSessionId: "canonical-browser",
        },
      },
    });
    expect(host.consume.mock.calls.map(([params]) => params.requestId)).toEqual(
      ["request-open", "request-createTab"],
    );
    expect(host.mount).toHaveBeenCalledExactlyOnceWith({
      ...result,
      threadId: owner.threadId,
      url: "http://localhost:4000/a",
      selected: !background,
      visible: false,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
  },
);

it("does not mount an identity returned after the owner changed", async () => {
  let current = true;
  const original = host.request.getMockImplementation()!;
  host.request.mockImplementation(async (params) => {
    const result = await original(params);
    if (params.metadata.browser.action === "createTab") current = false;
    return result;
  });
  expect(
    await createBrowserWorkspaceLinkTab({
      owner,
      url: "https://example.com",
      background: true,
      isCurrent: () => current,
    }),
  ).toBeNull();
  expect(host.mount).not.toHaveBeenCalled();
  expect(host.consume).toHaveBeenCalledTimes(2);
});

it("closes only its allocated native tab when the owner changes during mounting", async () => {
  let current = true;
  host.mount.mockImplementation(async (params) => {
    current = false;
    return params;
  });
  expect(
    await createBrowserWorkspaceLinkTab({
      owner,
      url: "https://example.com",
      background: true,
      isCurrent: () => current,
    }),
  ).toBeNull();
  expect(host.close).toHaveBeenCalledExactlyOnceWith("canonical-new");
});

it("propagates native mount failure and rejects a mismatched native identity", async () => {
  host.mount.mockRejectedValueOnce(new Error("native mount rejected"));
  await expect(
    createBrowserWorkspaceLinkTab({
      owner,
      url: "https://example.com",
      background: false,
      isCurrent: () => true,
    }),
  ).rejects.toThrow("native mount rejected");
  host.mount.mockResolvedValueOnce({
    browserSessionId: "other",
    tabId: "canonical-new",
    threadId: owner.threadId,
  });
  await expect(
    createBrowserWorkspaceLinkTab({
      owner,
      url: "https://example.com",
      background: false,
      isCurrent: () => true,
    }),
  ).rejects.toThrow("canonical workspace");
  expect(host.close.mock.calls).toEqual([["canonical-new"], ["canonical-new"]]);
});

it("reports cleanup failure together with native failure instead of claiming the tab was discarded", async () => {
  host.mount.mockRejectedValueOnce(new Error("mount failed"));
  host.close.mockRejectedValueOnce(new Error("close failed"));
  await expect(
    createBrowserWorkspaceLinkTab({
      owner,
      url: "https://example.com",
      background: false,
      isCurrent: () => true,
    }),
  ).rejects.toMatchObject({
    message: "Browser link mount and cleanup failed",
    errors: [
      expect.objectContaining({ message: "mount failed" }),
      expect.objectContaining({ message: "close failed" }),
    ],
  });
});
