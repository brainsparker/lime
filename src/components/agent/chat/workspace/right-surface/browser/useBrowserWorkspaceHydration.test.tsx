import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BrowserTabClosedEvent,
  BrowserTabState,
} from "@/lib/api/browserTab";
import type { BrowserWorkspaceOwner } from "@/lib/api/browserWorkspace";
import type { EmbeddedBrowserBounds } from "@/lib/api/embeddedBrowser";
import { browserState, deferred } from "./browserWorkspace.testFixtures";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  mount: vi.fn(),
  bounds: vi.fn(),
  identity: vi.fn(),
  error: vi.fn(),
  states: new Set<(state: BrowserTabState) => void>(),
  closes: new Set<(event: BrowserTabClosedEvent) => void>(),
}));
vi.mock("@/lib/api/browserTab", () => ({
  listBrowserTabs: mocks.list,
  mountBrowserTab: mocks.mount,
  setBrowserTabBounds: mocks.bounds,
  listenBrowserTabState: async (handler: (state: BrowserTabState) => void) => {
    mocks.states.add(handler);
    return () => {
      mocks.states.delete(handler);
    };
  },
  listenBrowserTabClosed: async (
    handler: (event: BrowserTabClosedEvent) => void,
  ) => {
    mocks.closes.add(handler);
    return () => {
      mocks.closes.delete(handler);
    };
  },
}));
vi.mock("@/lib/api/browserWorkspace", () => ({
  openBrowserWorkspaceIdentity: mocks.identity,
}));
import { useBrowserWorkspaceHydration } from "./useBrowserWorkspaceHydration";

let latest: ReturnType<typeof useBrowserWorkspaceHydration>;
function Probe({
  threadId = "thread-1",
  ensureOwner,
  runtimeSessionId = "session-1",
}: {
  threadId?: string;
  runtimeSessionId?: string | null;
  ensureOwner?: () => Promise<BrowserWorkspaceOwner | null>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastBoundsRef = useRef<EmbeddedBrowserBounds | null>({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  });
  latest = useBrowserWorkspaceHydration({
    hostAvailable: true,
    threadId,
    runtimeSessionId,
    ensureOwner,
    initialUrl: "https://example.com/",
    viewportRef,
    lastBoundsRef,
    onError: mocks.error,
  });
  return <div ref={viewportRef} />;
}
const secondary = () =>
  browserState({
    tabId: "second",
    viewId: "second-view",
    webContentsId: 202,
    url: "https://example.com/second",
  });

describe("Browser workspace hydration lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;
  const render = async (props: Parameters<typeof Probe>[0] = {}) => {
    await act(async () => {
      root.render(<Probe {...props} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.states.clear();
    mocks.closes.clear();
    mocks.error.mockReset();
    mocks.list.mockReset().mockResolvedValue([]);
    mocks.identity.mockReset().mockImplementation(async ({ threadId }) => ({
      browserSessionId: `browser-session-${threadId.slice(-1)}`,
      tabId: "browser-session-1:user:primary",
    }));
    mocks.mount
      .mockReset()
      .mockImplementation(async (params) => browserState(params));
    mocks.bounds.mockReset().mockResolvedValue(browserState());
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("restores both live tabs and selected secondary on remount without mounting primary", async () => {
    const tabs = [browserState({ selected: false }), secondary()];
    mocks.list.mockResolvedValue(tabs);
    await render();
    expect(latest.tabs).toEqual(tabs);
    await act(async () => root.render(null));
    expect(mocks.bounds).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: "second", visible: false }),
    );
    await render();
    expect(latest.tabs).toEqual(tabs);
    expect(mocks.mount).not.toHaveBeenCalled();
  });
  it("keeps a closed primary absent and preserves zero-selection intermediate snapshots", async () => {
    const second = secondary();
    mocks.list.mockResolvedValue([second]);
    await render();
    expect(latest.tabs).toEqual([second]);
    expect(mocks.mount).not.toHaveBeenCalled();
    await act(async () => root.render(null));
    mocks.list.mockResolvedValue([{ ...second, selected: false }]);
    await render();
    expect(latest.tabs[0].selected).toBe(false);
    expect(mocks.mount).not.toHaveBeenCalled();
  });
  it("creates primary only after a successful empty snapshot and keeps bootstrap invisible", async () => {
    await render();
    expect(mocks.list).toHaveBeenCalledWith({
      browserSessionId: "browser-session-1",
      threadId: "thread-1",
    });
    expect(mocks.mount).toHaveBeenCalledTimes(1);
    expect(mocks.mount).toHaveBeenCalledWith(
      expect.objectContaining({ visible: false, selected: true }),
    );
    expect(latest.tabs).toHaveLength(1);
  });
  it("fails closed on snapshot failure and unsubscribes buffered events", async () => {
    mocks.list.mockRejectedValue(new Error("snapshot unavailable"));
    await render();
    expect(mocks.mount).not.toHaveBeenCalled();
    expect(latest.tabs).toEqual([]);
    expect(mocks.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "snapshot unavailable" }),
    );
    expect(mocks.states.size + mocks.closes.size).toBe(0);
  });
  it("merges close and selected/URL events ahead of a stale snapshot", async () => {
    const query = deferred<BrowserTabState[]>();
    mocks.list.mockReturnValue(query.promise);
    await render();
    const first = browserState();
    const second = secondary();
    await act(async () => {
      mocks.closes.forEach((handler) =>
        handler({
          browserSessionId: first.browserSessionId,
          threadId: first.threadId,
          tabId: first.tabId,
          viewId: first.viewId,
          reason: "closed",
        }),
      );
      mocks.states.forEach((handler) => handler(second));
      query.resolve([
        first,
        { ...second, selected: false, url: "https://example.com/stale" },
      ]);
    });
    expect(latest.tabs).toEqual([second]);
    await act(async () => latest.acceptState(first));
    expect(latest.tabs).toEqual([second]);
    expect(mocks.mount).not.toHaveBeenCalled();
  });
  it("rechecks empty when an event arrived during the first query", async () => {
    const query = deferred<BrowserTabState[]>();
    mocks.list
      .mockReturnValueOnce(query.promise)
      .mockResolvedValue([secondary()]);
    await render();
    await act(async () => {
      mocks.states.forEach((handler) => handler(secondary()));
      query.resolve([]);
    });
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(latest.tabs).toEqual([secondary()]);
    expect(mocks.mount).not.toHaveBeenCalled();
  });
  it("rejects ABA late snapshots and old operation callbacks", async () => {
    const old = deferred<BrowserTabState[]>();
    mocks.list
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue([secondary()]);
    await render();
    const oldAccept = latest.acceptState;
    await render({ threadId: "thread-2" });
    await render();
    const current = latest.tabs;
    await act(async () => {
      old.resolve([browserState()]);
      oldAccept(browserState());
    });
    expect(latest.tabs).toBe(current);
    expect(latest.tabs).toEqual([secondary()]);
    expect(mocks.mount).not.toHaveBeenCalled();
  });
  it("does not project late bootstrap or show it after owner replacement", async () => {
    const old = deferred<BrowserTabState>();
    mocks.mount.mockReturnValueOnce(old.promise);
    await render();
    expect(mocks.mount).toHaveBeenCalledWith(
      expect.objectContaining({ visible: false }),
    );
    mocks.list.mockResolvedValue([secondary()]);
    await render({ threadId: "thread-2" });
    const current = latest.tabs;
    await act(async () => old.resolve(browserState()));
    expect(latest.tabs).toBe(current);
    expect(mocks.bounds).not.toHaveBeenCalled();
  });
  it("invalidates late owner resolution even when explicit thread props are unchanged", async () => {
    const old = deferred<BrowserWorkspaceOwner | null>();
    await render({ runtimeSessionId: null, ensureOwner: () => old.promise });
    const next = async () => ({
      runtimeSessionId: "session-2",
      threadId: "thread-2",
    });
    await render({ runtimeSessionId: null, ensureOwner: next });
    await act(async () =>
      old.resolve({ runtimeSessionId: "session-1", threadId: "thread-1" }),
    );
    expect(mocks.identity).toHaveBeenCalledTimes(1);
    expect(latest.owner?.threadId).toBe("thread-2");
  });
  it("rejects a mount response with the wrong canonical identity", async () => {
    mocks.mount.mockResolvedValue(browserState({ threadId: "foreign" }));
    await render();
    expect(latest.tabs).toEqual([]);
    expect(mocks.error).toHaveBeenCalled();
  });
  it("rejects callbacks captured before unmount", async () => {
    mocks.list.mockResolvedValue([secondary()]);
    await render();
    const current = latest.acceptState;
    await act(async () => root.render(null));
    expect(latest.isCurrent()).toBe(false);
    await act(async () => current(browserState()));
    expect(mocks.states.size).toBe(0);
  });
});
