import type {
  BrowserTabClosedEvent,
  BrowserTabState,
} from "@/lib/api/browserTab";

export type BrowserTabChange =
  | { kind: "state"; state: BrowserTabState }
  | { kind: "closed"; event: BrowserTabClosedEvent };

export function projectBrowserTabChanges(
  snapshot: readonly BrowserTabState[],
  changes: readonly BrowserTabChange[],
  anchor: BrowserTabState,
  closedViews: Set<string>,
): BrowserTabState[] {
  let tabs = snapshot.filter((state) => !closedViews.has(state.viewId));
  for (const change of changes) {
    if (change.kind === "closed") {
      const event = change.event;
      if (
        event.browserSessionId !== anchor.browserSessionId ||
        event.threadId !== anchor.threadId
      ) {
        continue;
      }
      closedViews.add(event.viewId);
      tabs = tabs.filter(
        (tab) => tab.tabId !== event.tabId || tab.viewId !== event.viewId,
      );
      continue;
    }
    const state = change.state;
    if (!sameBrowserTabOwner(state, anchor) || closedViews.has(state.viewId)) {
      continue;
    }
    tabs = state.selected
      ? tabs.map((tab) => ({ ...tab, selected: false }))
      : [...tabs];
    const index = tabs.findIndex((tab) => tab.tabId === state.tabId);
    if (index < 0) {
      tabs.push(state);
    } else {
      tabs[index] = state;
    }
  }
  return tabs;
}

export function sameBrowserTabOwner(
  state: BrowserTabState,
  anchor: BrowserTabState,
): boolean {
  return (
    state.browserSessionId === anchor.browserSessionId &&
    state.threadId === anchor.threadId &&
    state.windowId === anchor.windowId &&
    state.ownerWebContentsId === anchor.ownerWebContentsId
  );
}
