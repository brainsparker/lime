interface BrowserTabScope {
  browserSessionId: string;
  threadId: string;
  windowId: number;
  ownerWebContentsId: number;
}

export function resolveBrowserTabOwnerWindow<
  Window extends { webContents: { id: number } },
>(window: Window | null, senderId: number): Window | null {
  return window?.webContents.id === senderId ? window : null;
}

export function readBrowserTabSnapshot<Route extends BrowserTabScope, State>(
  actor: { id: number; webContents: { id: number } },
  args: Record<string, unknown> | null | undefined,
  routes: Iterable<Route>,
  readState: (route: Route) => State,
): State[] {
  const browserSessionId = requiredKey(
    args?.browserSessionId,
    "browserSessionId",
  );
  const threadId = requiredKey(args?.threadId, "threadId");
  const all = [...routes];
  const sessionRoutes = all.filter(
    (route) => route.browserSessionId === browserSessionId,
  );
  const matchingThread = all.some((route) => route.threadId === threadId);
  if (
    (args?.windowId !== undefined && args.windowId !== actor.id) ||
    (args?.ownerWebContentsId !== undefined &&
      args.ownerWebContentsId !== actor.webContents.id)
  ) {
    throw new Error("Browser tab snapshot actor does not match the IPC sender");
  }
  if (
    sessionRoutes.some(
      (route) =>
        route.threadId !== threadId ||
        route.windowId !== actor.id ||
        route.ownerWebContentsId !== actor.webContents.id,
    ) ||
    (sessionRoutes.length === 0 && matchingThread)
  ) {
    throw new Error(
      "Browser tab snapshot scope does not belong to this window/session/thread",
    );
  }
  return sessionRoutes.map(readState);
}

function requiredKey(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Browser tab snapshot requires ${field}`);
  }
  return value.trim();
}
