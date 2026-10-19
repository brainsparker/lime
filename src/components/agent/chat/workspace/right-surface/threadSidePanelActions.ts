import type { ReactNode } from "react";
import type { WorkspaceRightSurfaceKind } from "./rightSurfaceTypes";

export interface ThreadSidePanelAction {
  id: string;
  kind: WorkspaceRightSurfaceKind;
  title: string;
  icon: ReactNode;
  keyboardShortcut?: string;
  isMcpProvided?: boolean;
  showInNewTabTools?: boolean;
  deferSelectionUntilDropdownClose?: boolean;
}

export function projectNewTabTools(
  actions: readonly ThreadSidePanelAction[],
  hasChat: boolean,
) {
  const visible = actions.filter(
    (action) => action.showInNewTabTools !== false,
  );
  const extensions = visible.filter((action) => action.isMcpProvided);
  const builtin = visible.filter((action) => !action.isMcpProvided);
  const sorted = [
    ...builtin.filter((action) => action.keyboardShortcut),
    ...builtin.filter((action) => !action.keyboardShortcut),
  ];
  const slots = hasChat ? 5 : 6;
  const count = builtin.length > slots || extensions.length ? slots - 1 : slots;
  return {
    primary: sorted.slice(0, count),
    overflow: sorted.slice(count),
    extensions,
  };
}
