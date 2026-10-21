import { useEffect, useRef } from "react";
import { isBrowserTabHostAvailable } from "@/lib/api/browserTab";
import {
  createBrowserWorkspaceLinkTab,
  type BrowserWorkspaceOwner,
} from "@/lib/api/browserWorkspace";
import { getDesktopPreferences } from "@/lib/api/desktopPreferences";
import {
  isDefaultBrowser,
  openExternalUrlWithSystemBrowser,
} from "@/lib/api/externalUrl";
import { requestWorkspaceRightSurface } from "@/lib/api/workspaceRightSurface";
import {
  externalBrowserUrl,
  resolveLinkOpening,
  type LinkClick,
} from "@/lib/linkOpening";

interface Params {
  sessionId?: string | null;
  threadId?: string | null;
  workspaceId?: string | null;
  workspaceRoot: string | null;
  ensureOwner?: () => Promise<BrowserWorkspaceOwner | null>;
  onOpenBackgroundBrowser: () => void;
  onError: (error: unknown) => void;
}

export function useWorkspaceLinkOpening(params: Params) {
  const key = JSON.stringify([
    params.sessionId,
    params.threadId,
    params.workspaceId,
    params.workspaceRoot,
  ]);
  const epoch = useRef({ key, version: 0, alive: false });
  if (epoch.current.key !== key)
    epoch.current = { key, version: epoch.current.version + 1, alive: false };
  useEffect(() => {
    epoch.current.alive = true;
    return () => {
      epoch.current.alive = false;
      epoch.current.version += 1;
    };
  }, [key]);

  return (url: string, event?: LinkClick & { preventDefault?: () => void }) => {
    const version = epoch.current.version;
    if (event?.button != null && event.button !== 0 && event.button !== 1)
      return;
    event?.preventDefault?.();
    const click: LinkClick | undefined = event
      ? {
          button: event.button,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        }
      : undefined;
    const isCurrent = () =>
      epoch.current.key === key &&
      epoch.current.alive &&
      epoch.current.version === version;
    void (async () => {
      const [preferences, defaultBrowser] = await Promise.all([
        getDesktopPreferences(),
        isDefaultBrowser(),
      ]);
      if (!isCurrent()) return;
      const intent = resolveLinkOpening({
        url,
        click,
        preferences,
        platform: typeof navigator === "undefined" ? "" : navigator.platform,
        browserAvailable: isBrowserTabHostAvailable(),
        isDefaultBrowser: defaultBrowser,
      });
      if (!intent) throw new Error("Invalid browser link");
      if (intent.target === "external-browser") {
        await openExternalUrlWithSystemBrowser(externalBrowserUrl(url));
        return;
      }
      let tabId: string | undefined;
      if (intent.disposition) {
        const owner =
          params.sessionId && params.threadId
            ? {
                runtimeSessionId: params.sessionId,
                threadId: params.threadId,
              }
            : await params.ensureOwner?.();
        if (!isCurrent()) return;
        if (!owner)
          throw new Error("Browser link requires a canonical conversation");
        const next = await createBrowserWorkspaceLinkTab({
          owner,
          url,
          background: intent.disposition === "new-background-tab",
          isCurrent,
        });
        if (!next || !isCurrent()) return;
        if (intent.disposition === "new-background-tab") {
          params.onOpenBackgroundBrowser();
          return;
        }
        tabId = next.tabId;
      }
      await requestWorkspaceRightSurface({
        surfaceKind: "browser",
        origin: "user",
        priority: "foreground",
        reason: "open_thread_output",
        sessionId: params.sessionId ?? null,
        workspaceId: params.workspaceId ?? null,
        workspaceRoot: params.workspaceRoot,
        candidateId: url,
        metadata: { browser: { launchUrl: url, ...(tabId ? { tabId } : {}) } },
      });
    })().catch((error: unknown) => {
      if (isCurrent()) params.onError(error);
    });
  };
}
