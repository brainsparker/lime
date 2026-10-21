import {
  consumeWorkspaceRightSurfacePending,
  requestWorkspaceRightSurface,
  type WorkspaceRightSurfaceAppServerClient,
} from "./workspaceRightSurface";
import { closeBrowserTab, mountBrowserTab } from "./browserTab";

export interface BrowserWorkspaceIdentity {
  browserSessionId: string;
  tabId: string;
}

export interface BrowserWorkspaceOwner {
  runtimeSessionId: string;
  threadId: string;
}

export interface BrowserWorkspaceIdentityDeps {
  appServerClient?: WorkspaceRightSurfaceAppServerClient;
}

export async function openBrowserWorkspaceIdentity(
  params: {
    runtimeSessionId?: string | null;
    threadId: string;
  },
  deps: BrowserWorkspaceIdentityDeps = {},
): Promise<BrowserWorkspaceIdentity> {
  return await requestBrowserIdentity(
    {
      action: "open",
      runtimeSessionId: params.runtimeSessionId,
      threadId: params.threadId,
    },
    deps,
  );
}

export async function createBrowserWorkspaceTabIdentity(
  params: {
    browserSessionId: string;
    runtimeSessionId?: string | null;
    threadId: string;
  },
  deps: BrowserWorkspaceIdentityDeps = {},
): Promise<BrowserWorkspaceIdentity> {
  return await requestBrowserIdentity(
    {
      action: "createTab",
      browserSessionId: params.browserSessionId,
      runtimeSessionId: params.runtimeSessionId,
      threadId: params.threadId,
    },
    deps,
  );
}

export async function createBrowserWorkspaceLinkTab(
  params: {
    owner: BrowserWorkspaceOwner;
    url: string;
    background: boolean;
    isCurrent: () => boolean;
  },
  deps: BrowserWorkspaceIdentityDeps = {},
): Promise<BrowserWorkspaceIdentity | null> {
  if (!params.isCurrent()) return null;
  const workspace = await openBrowserWorkspaceIdentity(params.owner, deps);
  if (!params.isCurrent()) return null;
  const next = await createBrowserWorkspaceTabIdentity(
    {
      ...params.owner,
      browserSessionId: workspace.browserSessionId,
    },
    deps,
  );
  if (!params.isCurrent()) return null;
  try {
    const state = await mountBrowserTab({
      ...next,
      threadId: params.owner.threadId,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      selected: !params.background,
      url: params.url,
      visible: false,
    });
    if (
      state.browserSessionId !== next.browserSessionId ||
      state.tabId !== next.tabId ||
      state.threadId !== params.owner.threadId
    )
      throw new Error(
        "Browser link tab does not belong to the canonical workspace",
      );
  } catch (error) {
    try {
      await closeBrowserTab(next.tabId);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Browser link mount and cleanup failed",
      );
    }
    throw error;
  }
  if (!params.isCurrent()) {
    await closeBrowserTab(next.tabId);
    return null;
  }
  return next;
}

async function requestBrowserIdentity(
  params: {
    action: "open" | "createTab";
    browserSessionId?: string;
    runtimeSessionId?: string | null;
    threadId: string;
  },
  deps: BrowserWorkspaceIdentityDeps,
): Promise<BrowserWorkspaceIdentity> {
  const response = await requestWorkspaceRightSurface(
    {
      surfaceKind: "browser",
      origin: "renderer",
      priority: "background",
      reason: `browser_identity_${params.action}`,
      sessionId: params.runtimeSessionId ?? null,
      ttlMs: 30_000,
      metadata: {
        browser: {
          action: params.action,
          ...(params.browserSessionId
            ? { browserSessionId: params.browserSessionId }
            : {}),
          threadId: params.threadId,
        },
      },
    },
    deps,
  );
  try {
    const identity = readBrowserIdentity(response.pending.metadata);
    if (!identity) {
      throw new Error("App Server did not return a canonical Browser identity");
    }
    return identity;
  } finally {
    await consumeWorkspaceRightSurfacePending(
      { requestId: response.requestId },
      deps,
    );
  }
}

function readBrowserIdentity(value: unknown): BrowserWorkspaceIdentity | null {
  if (!isRecord(value)) {
    return null;
  }
  const browser = value.browser;
  if (!isRecord(browser)) {
    return null;
  }
  const browserSessionId = readNonEmptyString(browser.browserSessionId);
  const tabId = readNonEmptyString(browser.tabId);
  return browserSessionId && tabId ? { browserSessionId, tabId } : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
