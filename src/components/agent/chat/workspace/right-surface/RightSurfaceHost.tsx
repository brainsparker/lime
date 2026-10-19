import type { ReactNode, SyntheticEvent } from "react";
import type { ThreadSidePanelTab } from "./threadSidePanelTabs";
import type {
  RightSurfaceDefinition,
  WorkspaceRightSurfaceKind,
} from "./rightSurfaceTypes";

interface RightSurfaceHostProps {
  activeSurface: WorkspaceRightSurfaceKind | null;
  definitions: readonly RightSurfaceDefinition[];
  idPrefix: string;
  tabId: string;
  tabs: readonly ThreadSidePanelTab[];
  onPinTab: (tabId: string) => void;
  previewTabId: string | null;
}

/** Pane only. 标签由同一份 projection 交给共享 UnifiedTabStrip。 */
export function RightSurfaceHost({
  activeSurface,
  definitions,
  idPrefix,
  tabId,
  tabs,
  onPinTab,
  previewTabId,
}: RightSurfaceHostProps): ReactNode {
  if (!tabs.length) return null;
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-testid="workspace-right-surface-host"
      data-surface={activeSurface}
    >
      {tabs.map((tab) => {
        const definition = definitions.find((item) => item.kind === tab.kind);
        if (!definition) return null;
        const active = activeSurface === tab.kind && tab.tabId === tabId;
        const pinPreview = (event: SyntheticEvent) => {
          if (
            previewTabId === tab.tabId &&
            !event.nativeEvent
              .composedPath()
              .some(
                (target) =>
                  target instanceof Element &&
                  target.hasAttribute("data-tab-preview-pin-exempt"),
              )
          )
            onPinTab(tab.tabId);
        };
        return (
          <div
            key={tab.dndId ?? tab.contentInstance ?? tab.tabId}
            id={`${idPrefix}-panel-${tab.tabId}`}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-tab-${tab.tabId}`}
            hidden={!active}
            className="min-h-0 flex-1 w-full overflow-hidden"
            data-testid={
              active ? "workspace-right-surface-active-pane" : undefined
            }
            onKeyDownCapture={pinPreview}
            onPointerDownCapture={pinPreview}
          >
            {definition.render({ activeSurface, tab })}
          </div>
        );
      })}
    </div>
  );
}
