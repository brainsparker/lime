import { beforeEach, describe, expect, it, vi } from "vitest";
import { browserState } from "@/components/agent/chat/workspace/right-surface/browser/browserWorkspace.testFixtures";

const invoke = vi.hoisted(() => vi.fn());
const supports = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: invoke,
  safeListen: vi.fn(),
}));
vi.mock("@/lib/electron-host", () => ({
  getElectronHostBridge: () => ({ listen: () => undefined }),
  isElectronDevBridgeFallbackAvailable: () => false,
  isElectronHostCommandAvailable: supports,
}));
import { isBrowserTabHostAvailable, listBrowserTabs } from "./browserTab";

const scope = { browserSessionId: "browser-session-1", threadId: "thread-1" };
describe("Browser snapshot typed gateway", () => {
  beforeEach(() => {
    invoke.mockReset();
    supports.mockReset().mockReturnValue(true);
  });

  it("preserves every native identity and permits a nonempty snapshot without a selected tab", async () => {
    const tabs = [
      browserState({ selected: false }),
      browserState({
        selected: false,
        tabId: "second",
        viewId: "view-second",
        webContentsId: 102,
      }),
    ];
    invoke.mockResolvedValue(tabs);
    expect(await listBrowserTabs(scope)).toBe(tabs);
    expect(invoke).toHaveBeenCalledWith("browser_tab_list", scope);
  });
  it("requires the snapshot command in host availability", () => {
    supports.mockImplementation((command) => command !== "browser_tab_list");
    expect(isBrowserTabHostAvailable()).toBe(false);
  });
  it("propagates host failure rather than substituting an empty list", async () => {
    invoke.mockRejectedValue(new Error("native missing"));
    await expect(listBrowserTabs(scope)).rejects.toThrow("native missing");
  });
  it("accepts genuine empty and rejects malformed envelopes", async () => {
    invoke.mockResolvedValueOnce([]).mockResolvedValueOnce({ tabs: [] });
    expect(await listBrowserTabs(scope)).toEqual([]);
    await expect(listBrowserTabs(scope)).rejects.toThrow("array");
  });
  it.each([
    { browserSessionId: "foreign-session" },
    { threadId: "foreign-thread" },
    { windowId: 8 },
    { ownerWebContentsId: 42 },
    { webContentsId: 0 },
    { viewId: "" },
    { tabId: "" },
    { selected: true },
  ])("rejects invalid or mixed identities: %j", async (overrides) => {
    invoke.mockResolvedValue([
      browserState(),
      browserState({
        tabId: "second",
        viewId: "view-second",
        webContentsId: 102,
        selected: false,
        ...overrides,
      }),
    ]);
    await expect(listBrowserTabs(scope)).rejects.toThrow();
  });
  it.each(["tabId", "viewId", "webContentsId"] as const)(
    "rejects duplicate %s",
    async (field) => {
      const first = browserState();
      invoke.mockResolvedValue([
        first,
        browserState({
          tabId: "second",
          viewId: "view-second",
          webContentsId: 102,
          selected: false,
          [field]: first[field],
        }),
      ]);
      await expect(listBrowserTabs(scope)).rejects.toThrow(/duplicate/);
    },
  );
});
