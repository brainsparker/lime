import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceLinkOpening } from "./useWorkspaceLinkOpening";
import { MarkdownLink } from "../components/MarkdownLink";
import { LinkOpeningContext } from "../components/LinkOpeningContext";

const calls = vi.hoisted(() => ({
  preferences: vi.fn(),
  request: vi.fn(),
  create: vi.fn(),
  external: vi.fn(),
  defaultBrowser: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/api/desktopPreferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/desktopPreferences")>()),
  getDesktopPreferences: calls.preferences,
}));
vi.mock("@/lib/api/appConfig", () => ({}));
vi.mock("@/lib/api/browserTab", () => ({
  isBrowserTabHostAvailable: () => true,
}));
vi.mock("@/lib/api/browserWorkspace", () => ({
  createBrowserWorkspaceLinkTab: calls.create,
}));
vi.mock("@/lib/api/externalUrl", () => ({
  isDefaultBrowser: calls.defaultBrowser,
  openExternalUrlWithSystemBrowser: calls.external,
}));
vi.mock("@/lib/api/workspaceRightSurface", () => ({
  requestWorkspaceRightSurface: calls.request,
}));

let container: HTMLDivElement, root: Root;
const background = vi.fn();
function Probe({
  thread = "thread-a",
  middle = false,
  markdown = false,
  url = "http://localhost:4000",
}) {
  const open = useWorkspaceLinkOpening({
    sessionId: "session",
    threadId: thread,
    workspaceId: "workspace",
    workspaceRoot: "/project",
    onOpenBackgroundBrowser: background,
    onError: calls.error,
  });
  if (markdown)
    return (
      <LinkOpeningContext.Provider value={open}>
        <MarkdownLink href={url}>Open</MarkdownLink>
      </LinkOpeningContext.Provider>
    );
  return (
    <button onClick={() => open(url, { button: middle ? 1 : 0 })}>Open</button>
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  calls.preferences.mockResolvedValue({});
  calls.defaultBrowser.mockResolvedValue(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it.each([
  {
    name: "web preference independently from local",
    url: "https://docs.example.com",
    preferences: {
      "open-link-in-target-preference": "in-app-browser",
      "open-local-url-in-target-preference": "external-browser",
    },
    click: {},
    target: "in-app",
  },
  {
    name: "local preference independently from web",
    url: "http://localhost:4000",
    preferences: {
      "open-link-in-target-preference": "external-browser",
      "open-local-url-in-target-preference": "in-app-browser",
    },
    click: {},
    target: "in-app",
  },
  {
    name: "explicit web external preference",
    url: "https://docs.example.com",
    preferences: { "open-link-in-target-preference": "external-browser" },
    click: {},
    target: "external",
  },
  {
    name: "primary shortcut before in-app preference",
    url: "https://docs.example.com",
    preferences: { "open-link-in-target-preference": "in-app-browser" },
    click: { metaKey: true },
    target: "external",
  },
  {
    name: "middle click creates a background canonical tab",
    url: "https://docs.example.com",
    preferences: {},
    click: { button: 1 },
    target: "background",
  },
  {
    name: "primary shift selects the new canonical tab",
    url: "https://docs.example.com",
    preferences: {},
    click: { metaKey: true, shiftKey: true },
    target: "foreground",
  },
])(
  "routes a Markdown DOM click using $name",
  async ({ url, preferences, click, target }) => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
    calls.preferences.mockResolvedValue(preferences);
    calls.create.mockResolvedValue({ tabId: "new-canonical-tab" });
    await act(async () => root.render(<Probe markdown url={url} />));
    const event = new MouseEvent("button" in click ? "auxclick" : "click", {
      bubbles: true,
      cancelable: true,
      ...click,
    });
    await act(async () => container.querySelector("a")!.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(calls.preferences).toHaveBeenCalledOnce();
    expect(calls.error).not.toHaveBeenCalled();
    if (target === "external") {
      expect(calls.external).toHaveBeenCalledExactlyOnceWith(url);
      expect(calls.request).not.toHaveBeenCalled();
      expect(calls.create).not.toHaveBeenCalled();
      expect(background).not.toHaveBeenCalled();
      return;
    }
    expect(calls.external).not.toHaveBeenCalled();
    if (target === "background" || target === "foreground")
      expect(calls.create).toHaveBeenCalledExactlyOnceWith({
        owner: { runtimeSessionId: "session", threadId: "thread-a" },
        url,
        background: target === "background",
        isCurrent: expect.any(Function),
      });
    else expect(calls.create).not.toHaveBeenCalled();
    if (target === "background") {
      expect(background).toHaveBeenCalledOnce();
      expect(calls.request).not.toHaveBeenCalled();
      return;
    }
    expect(background).not.toHaveBeenCalled();
    expect(calls.request).toHaveBeenCalledExactlyOnceWith({
      surfaceKind: "browser",
      origin: "user",
      priority: "foreground",
      reason: "open_thread_output",
      sessionId: "session",
      workspaceId: "workspace",
      workspaceRoot: "/project",
      candidateId: url,
      metadata: {
        browser: {
          launchUrl: url,
          ...(target === "foreground" ? { tabId: "new-canonical-tab" } : {}),
        },
      },
    });
  },
);

it("keeps opening enabled after StrictMode effect replay", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    ),
  );
  await act(async () => container.querySelector("button")!.click());
  expect(calls.request).toHaveBeenCalledOnce();
  expect(calls.error).not.toHaveBeenCalled();
});

it.each([false, true])(
  "uses native default browser status for a web link (primary=%s)",
  async (primary) => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
    calls.defaultBrowser.mockResolvedValue(true);
    calls.preferences.mockResolvedValue({
      "open-link-in-target-preference": "external-browser",
    });
    calls.create.mockResolvedValue({ tabId: "default-browser-background" });
    await act(async () =>
      root.render(<Probe markdown url="https://docs.example.com" />),
    );
    await act(async () =>
      container
        .querySelector("a")!
        .dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            metaKey: primary,
          }),
        ),
    );
    expect(calls.defaultBrowser).toHaveBeenCalledOnce();
    expect(calls.external).not.toHaveBeenCalled();
    expect(calls.error).not.toHaveBeenCalled();
    if (primary) {
      expect(calls.create).toHaveBeenCalledExactlyOnceWith({
        owner: { runtimeSessionId: "session", threadId: "thread-a" },
        url: "https://docs.example.com",
        background: true,
        isCurrent: expect.any(Function),
      });
      expect(background).toHaveBeenCalledOnce();
      expect(calls.request).not.toHaveBeenCalled();
    } else {
      expect(calls.create).not.toHaveBeenCalled();
      expect(calls.request).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          candidateId: "https://docs.example.com",
          surfaceKind: "browser",
        }),
      );
    }
  },
);

it.each(["same", "changed", "unmounted"] as const)(
  "waits for OS status without allowing late owner callbacks (%s)",
  async (owner) => {
    let resolve!: (value: boolean) => void;
    calls.defaultBrowser.mockReturnValue(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    await act(async () =>
      root.render(<Probe markdown url="https://docs.example.com" />),
    );
    await act(async () => container.querySelector("a")!.click());
    expect(calls.request).not.toHaveBeenCalled();
    expect(calls.external).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();
    if (owner === "changed") {
      await act(async () => root.render(<Probe thread="thread-b" />));
      await act(async () => root.render(<Probe />));
    }
    if (owner === "unmounted") await act(async () => root.render(null));
    await act(async () => resolve(true));
    expect(calls.external).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.error).not.toHaveBeenCalled();
    expect(calls.request).toHaveBeenCalledTimes(owner === "same" ? 1 : 0);
  },
);

it("rejects an old owner even after A to B to A while config is loading", async () => {
  let resolve!: (value: object) => void;
  calls.preferences.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => root.render(<Probe />));
  await act(async () => container.querySelector("button")!.click());
  await act(async () => root.render(<Probe thread="thread-b" />));
  await act(async () => root.render(<Probe />));
  await act(async () => resolve({}));
  expect(calls.request).not.toHaveBeenCalled();
  expect(calls.create).not.toHaveBeenCalled();
  expect(calls.external).not.toHaveBeenCalled();
});

it.each(["config", "native", "external", "default-browser"] as const)(
  "reports %s failure without opening another target",
  async (failure) => {
    const error = new Error(`${failure} rejected`);
    if (failure === "config") calls.preferences.mockRejectedValue(error);
    if (failure === "default-browser")
      calls.defaultBrowser.mockRejectedValue(error);
    if (failure === "native") calls.create.mockRejectedValue(error);
    if (failure === "external") {
      calls.preferences.mockResolvedValue({
        "open-local-url-in-target-preference": "external-browser",
      });
      calls.external.mockRejectedValue(error);
    }
    await act(async () => root.render(<Probe middle={failure === "native"} />));
    await act(async () => container.querySelector("button")!.click());
    expect(calls.error).toHaveBeenCalledExactlyOnceWith(error);
    expect(calls.request).not.toHaveBeenCalled();
    expect(background).not.toHaveBeenCalled();
    if (failure !== "external") expect(calls.external).not.toHaveBeenCalled();
    if (failure !== "native") expect(calls.create).not.toHaveBeenCalled();
  },
);
