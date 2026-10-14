import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  listBrowserTabs,
  listenBrowserTabClosed,
  listenBrowserTabState,
  mountBrowserTab,
  setBrowserTabBounds,
  type BrowserTabState,
} from "@/lib/api/browserTab";
import {
  openBrowserWorkspaceIdentity,
  type BrowserWorkspaceIdentity,
  type BrowserWorkspaceOwner,
} from "@/lib/api/browserWorkspace";
import type { EmbeddedBrowserBounds } from "@/lib/api/embeddedBrowser";
import {
  projectBrowserTabChanges,
  type BrowserTabChange,
} from "./browserTabHydration";
import { resolveElementBounds } from "./browserWorkspaceModel";

interface Params {
  hostAvailable: boolean;
  ensureOwner?: () => Promise<BrowserWorkspaceOwner | null>;
  runtimeSessionId?: string | null;
  threadId: string;
  initialUrl: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  lastBoundsRef: MutableRefObject<EmbeddedBrowserBounds | null>;
  onError: (reason: unknown) => void;
}

interface Projection {
  version: number;
  owner: BrowserWorkspaceOwner | null;
  identity: BrowserWorkspaceIdentity | null;
  tabs: BrowserTabState[];
}

export function useBrowserWorkspaceHydration(params: Params) {
  const key = JSON.stringify([
    params.runtimeSessionId?.trim() ?? null,
    params.threadId.trim(),
    params.hostAvailable,
  ]);
  const resolver = params.runtimeSessionId?.trim()
    ? undefined
    : params.ensureOwner;
  const epoch = useRef({ key, resolver, version: 0, active: false });
  if (epoch.current.key !== key || epoch.current.resolver !== resolver) {
    epoch.current = {
      key,
      resolver,
      version: epoch.current.version + 1,
      active: false,
    };
  }
  const version = epoch.current.version;
  const latestParams = useRef(params);
  latestParams.current = params;
  const [stored, setStored] = useState<Projection>(() => ({
    version,
    owner: null,
    identity: null,
    tabs: [],
  }));
  const receiver = useRef<((change: BrowserTabChange) => void) | null>(null);
  const isCurrent = useCallback(
    () => epoch.current.version === version && epoch.current.active,
    [version],
  );
  const acceptState = useCallback(
    (state: BrowserTabState) => {
      if (isCurrent()) {
        receiver.current?.({ kind: "state", state });
      }
    },
    [isCurrent],
  );

  useEffect(() => {
    epoch.current.active = true;
    let disposed = false;
    let owner: BrowserWorkspaceOwner | null = null;
    let identity: BrowserWorkspaceIdentity | null = null;
    let anchor: BrowserTabState | null = null;
    let tabs: BrowserTabState[] = [];
    let pending = true;
    let changes: BrowserTabChange[] = [];
    const closedViews = new Set<string>();
    const cleanup: Array<() => void> = [];
    const current = () => !disposed && isCurrent();
    const publish = (next: BrowserTabState[]) => {
      if (current()) {
        tabs = next;
        setStored({ version, owner, identity, tabs });
      }
    };
    const receive = (change: BrowserTabChange) => {
      const state = change.kind === "state" ? change.state : change.event;
      if (
        !current() ||
        !identity ||
        state.browserSessionId !== identity.browserSessionId ||
        state.threadId !== owner?.threadId
      ) {
        return;
      }
      if (pending) {
        changes.push(change);
      }
      if (anchor) {
        publish(projectBrowserTabChanges(tabs, [change], anchor, closedViews));
      }
    };
    receiver.current = receive;
    const register = async (subscription: Promise<() => void>) => {
      const stop = await subscription;
      if (current()) {
        cleanup.push(stop);
      } else {
        stop();
      }
    };

    if (params.hostAvailable) {
      void (async () => {
        const input = latestParams.current;
        owner =
          input.runtimeSessionId?.trim() && input.threadId.trim()
            ? {
                runtimeSessionId: input.runtimeSessionId.trim(),
                threadId: input.threadId.trim(),
              }
            : ((await input.ensureOwner?.()) ?? null);
        if (!current()) return;
        if (!owner?.runtimeSessionId || !owner.threadId) {
          throw new Error(
            "Browser workspace requires a canonical conversation",
          );
        }
        identity = await openBrowserWorkspaceIdentity(owner);
        if (!current()) return;
        publish([]);
        await Promise.all([
          register(
            listenBrowserTabState((state) => receive({ kind: "state", state })),
          ),
          register(
            listenBrowserTabClosed((event) =>
              receive({ kind: "closed", event }),
            ),
          ),
        ]);
        if (!current()) return;
        const scope = {
          browserSessionId: identity.browserSessionId,
          threadId: owner.threadId,
        };
        changes = [];
        let snapshot = await listBrowserTabs(scope);
        if (!current()) return;
        if (snapshot.length === 0 && changes.length > 0) {
          const changeCount = changes.length;
          snapshot = await listBrowserTabs(scope);
          if (!current()) return;
          if (snapshot.length === 0 && changes.length > changeCount) {
            throw new Error(
              "Browser tabs changed while the empty snapshot was being read",
            );
          }
        }
        if (snapshot.length > 0) {
          anchor = snapshot[0];
          pending = false;
          publish(
            projectBrowserTabChanges(snapshot, changes, anchor, closedViews),
          );
          changes = [];
          return;
        }
        const element = latestParams.current.viewportRef.current;
        if (!element || !current()) return;
        const bounds = resolveElementBounds(element);
        latestParams.current.lastBoundsRef.current = bounds;
        const primary = await mountBrowserTab({
          ...scope,
          tabId: identity.tabId,
          bounds,
          selected: true,
          url: latestParams.current.initialUrl,
          // A response can outlive this owner. Visibility is restored only by
          // the current workspace after the native identity has been checked.
          visible: false,
        });
        if (!current()) return;
        if (
          primary.browserSessionId !== scope.browserSessionId ||
          primary.threadId !== scope.threadId ||
          primary.tabId !== identity.tabId
        ) {
          throw new Error(
            "Browser mounted tab does not belong to this workspace",
          );
        }
        anchor = primary;
        pending = false;
        publish(
          projectBrowserTabChanges([primary], changes, primary, closedViews),
        );
        changes = [];
      })().catch((reason) => {
        pending = false;
        changes = [];
        cleanup.splice(0).forEach((stop) => stop());
        if (current()) {
          receiver.current = null;
          latestParams.current.onError(reason);
        }
      });
    }
    return () => {
      disposed = true;
      if (epoch.current.version === version) epoch.current.active = false;
      cleanup.forEach((stop) => stop());
      if (receiver.current === receive) receiver.current = null;
      const selected = tabs.find((tab) => tab.selected);
      const bounds = latestParams.current.lastBoundsRef.current;
      if (selected && bounds) {
        void setBrowserTabBounds({
          tabId: selected.tabId,
          bounds,
          visible: false,
        }).catch(() => undefined);
      }
    };
  }, [isCurrent, resolver, params.hostAvailable, version]);

  const projection =
    stored.version === version
      ? stored
      : { version, owner: null, identity: null, tabs: [] };
  return { ...projection, acceptState, isCurrent };
}
