import type { BrowserTabState } from "@/lib/api/browserTab";

export function browserState(
  overrides: Partial<BrowserTabState> = {},
): BrowserTabState {
  return {
    activeTurnId: null,
    browserSessionId: "browser-session-1",
    canGoBack: false,
    canGoForward: false,
    controlOwner: "user",
    find: { activeMatchOrdinal: 0, finalUpdate: true, matches: 0, text: "" },
    humanReason: null,
    isLoading: false,
    mark: null,
    origin: "user",
    ownerWebContentsId: 41,
    pageRevision: 0,
    selected: true,
    tabId: "browser-session-1:user:primary",
    threadId: "thread-1",
    title: "Example",
    url: "https://example.com/",
    viewId: "browser:browser-session-1:user:primary",
    webContentsId: 101,
    windowId: 7,
    zoomFactor: 1,
    ...overrides,
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
