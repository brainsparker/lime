export function selectBrowserRoutes<
  Route extends { tabId: string; selected: boolean },
>(routes: Route[], selectedTabId: string | null): Route[] {
  for (const route of routes) {
    route.selected = route.tabId === selectedTabId;
  }
  return routes;
}
